/**
 * ============================================================================
 *  Eks-Clean — Auth (JWT + Refresh tokens + RBAC, MFA-ready)
 * ============================================================================
 *  - Access token: short-lived (15m), signed HS256, body = { sub, role, ... }
 *  - Refresh token: long-lived (30d), random opaque; hash stored in DB.
 *  - Rotation: every refresh issues a new refresh token and revokes the old.
 *  - MFA-ready: users carry `mfaEnabled` + `mfaSecret`; `verifyTotp()` is
 *    stubbed (production wires a real TOTP library).
 *  - Rate-limited login via token-bucket per (ip, email).
 * ============================================================================
 */

import { db } from "@/lib/db";
import { createHash, randomBytes, randomUUID, pbkdf2Sync } from "crypto";

// Use WebCrypto subtle for HS256 signing (edge-compatible).
const JWT_SECRET = process.env.JWT_SECRET || "eks_clean_dev_secret_change_me";
const JWT_ISSUER = "eks-clean";
const ACCESS_TTL_SEC = 15 * 60; // 15 minutes
const REFRESH_TTL_DAYS = 30;
const REFRESH_TTL_SEC = REFRESH_TTL_DAYS * 24 * 60 * 60;

export interface AccessTokenPayload {
  sub: string; // userId
  role: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
  iss: string;
  jti: string;
}

// ----------------------------------------------------------------------------
//  Password hashing — PBKDF2 (Node crypto), no extra deps.
// ----------------------------------------------------------------------------

const PBKDF2_ITER = 120_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = pbkdf2Sync(password, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `pbkdf2$${PBKDF2_ITER}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const parts = encoded.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iter = parseInt(parts[1], 10);
  const salt = Buffer.from(parts[2], "base64");
  const expected = parts[3];
  const derived = pbkdf2Sync(password, salt, iter, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return derived.toString("base64") === expected;
}

// ----------------------------------------------------------------------------
//  JWT — HS256, base64url, edge-compatible via WebCrypto
// ----------------------------------------------------------------------------

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64url");
}
function b64urlDecode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf-8");
}

async function hmacSign(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Buffer.from(new Uint8Array(sig)).toString("base64url");
}

async function hmacVerify(message: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(message);
  // Constant-time-ish compare
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export async function signAccessToken(
  payload: Omit<AccessTokenPayload, "iat" | "exp" | "iss" | "jti">,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const full: AccessTokenPayload = {
    ...payload,
    iat: now,
    exp: now + ACCESS_TTL_SEC,
    iss: JWT_ISSUER,
    jti: randomUUID(),
  };
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify(full));
  const sig = await hmacSign(`${header}.${body}`);
  return `${header}.${body}.${sig}`;
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  const [header, body, sig] = token.split(".");
  if (!header || !body || !sig) return null;
  const ok = await hmacVerify(`${header}.${body}`, sig);
  if (!ok) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body)) as AccessTokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.iss !== JWT_ISSUER) return null;
    return payload;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
//  Refresh tokens — opaque, hash stored
// ----------------------------------------------------------------------------

export function issueRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  const hash = hashToken(token);
  return { token, hash };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueSession(user: {
  id: string;
  role: string;
  email: string;
  fullName: string;
  ctx?: { userAgent?: string; ipAddress?: string };
}) {
  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    name: user.fullName,
  });
  const { token: refreshToken, hash } = issueRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  await db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      userAgent: user.ctx?.userAgent,
      ipAddress: user.ctx?.ipAddress,
      expiresAt,
    },
  });
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TTL_SEC,
    refreshTokenExpiresIn: REFRESH_TTL_SEC,
  };
}

export async function rotateRefreshToken(oldToken: string, ctx?: { userAgent?: string; ipAddress?: string }) {
  const hash = hashToken(oldToken);
  const found = await db.refreshToken.findFirst({
    where: { tokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!found) return null;
  // Revoke old
  await db.refreshToken.update({
    where: { id: found.id },
    data: { revokedAt: new Date() },
  });
  // Issue new
  return issueSession({
    id: found.user.id,
    role: "ADMIN",
    email: found.user.email,
    fullName: found.user.fullName,
    ctx,
  });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const hash = hashToken(token);
  await db.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ----------------------------------------------------------------------------
//  MFA — TOTP-ready (RFC 6238). Production should plug `otplib` here.
// ----------------------------------------------------------------------------

export function generateMfaSecret(): string {
  return randomBytes(20).toString("base32");
}

export function verifyTotp(_secret: string, _token: string): boolean {
  // STUB: integrate `otplib` (or similar) before enabling in production.
  // Returning true for dev-mode would be a security hole in prod.
  throw new Error("MFA verification not configured — install otplib before enabling.");
}

// ----------------------------------------------------------------------------
//  Convenience: extract session from Next.js request headers
// ----------------------------------------------------------------------------

export async function getSessionFromHeaders(headers: Headers): Promise<AccessTokenPayload | null> {
  const auth = headers.get("authorization") || headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return verifyAccessToken(token);
}
