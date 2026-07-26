/**
 * ============================================================================
 *  Eks-Clean — API Helpers
 * ============================================================================
 *  Standard JSON response helpers + error types + zod validation.
 * ============================================================================
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import type { AccessTokenPayload } from "@/lib/auth";
import { PermissionDeniedError } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac";
import type { Permission } from "@/lib/rbac";
import type { AuditContext } from "@/lib/types";

// ----------------------------------------------------------------------------
//  Errors
// ----------------------------------------------------------------------------

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "ERROR",
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (m: string, details?: unknown) =>
  new HttpError(400, m, "BAD_REQUEST", details);
export const unauthorized = (m = "Unauthorized") => new HttpError(401, m, "UNAUTHORIZED");
export const forbidden = (m = "Forbidden") => new HttpError(403, m, "FORBIDDEN");
export const notFound = (m = "Not found") => new HttpError(404, m, "NOT_FOUND");
export const conflict = (m: string) => new HttpError(409, m, "CONFLICT");

// ----------------------------------------------------------------------------
//  Response helpers
// ----------------------------------------------------------------------------

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function err(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 403 },
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Validation failed", details: error.issues } },
      { status: 422 },
    );
  }
  console.error("[api] unhandled", error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Internal server error" } },
    { status: 500 },
  );
}

// ----------------------------------------------------------------------------
//  Request helpers
// ----------------------------------------------------------------------------

export async function parseJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const body = await req.json().catch(() => ({}));
  return schema.parse(body);
}

export function getIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
}

export function getUserAgent(req: Request): string | undefined {
  return req.headers.get("user-agent") || undefined;
}

export function auditCtx(req: Request, session?: AccessTokenPayload | null): AuditContext {
  return {
    userId: session?.sub,
    ipAddress: getIp(req),
    userAgent: getUserAgent(req),
  };
}

// ----------------------------------------------------------------------------
//  Auth guard wrapper
// ----------------------------------------------------------------------------

export function requireAuth(session: AccessTokenPayload | null) {
  if (!session) throw unauthorized("Authentication required");
  return session;
}

export function requirePerm(session: AccessTokenPayload | null, perm: Permission) {
  const s = requireAuth(session);
  if (!hasPermission(s.role as never, perm)) {
    throw new PermissionDeniedError(`Role ${s.role} lacks ${perm}`);
  }
  return s;
}

// ----------------------------------------------------------------------------
//  try-handler wrapper — central error handling + audit hook
// ----------------------------------------------------------------------------

export async function handle<T>(
  req: Request,
  fn: () => Promise<T>,
  opts: { audit?: { action: string; resourceType?: string; resourceId?: string } } = {},
): Promise<Response> {
  try {
    const result = await fn();
    if (opts.audit) {
      await writeAudit({
        action: opts.audit.action,
        resourceType: opts.audit.resourceType,
        resourceId: opts.audit.resourceId,
        ctx: { userId: undefined, ipAddress: getIp(req), userAgent: getUserAgent(req) },
      });
    }
    if (result instanceof NextResponse) return result;
    return ok(result);
  } catch (e) {
    return err(e);
  }
}
