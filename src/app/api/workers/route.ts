import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, unauthorized, notFound, parseJson } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const workerCreateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  password: z.string().min(8).default("EksClean123!"),
  // optional initial attributes
  homeLatitude: z.number().optional(),
  homeLongitude: z.number().optional(),
  preferredRadiusKm: z.number().int().min(1).max(200).default(15),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const kycStatus = url.searchParams.get("kycStatus") || undefined;
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (kycStatus) where.kycStatus = kycStatus;

    // Workers can only see their own profile
    if (session.role === "WORKER") {
      const w = await db.worker.findUnique({ where: { userId: session.sub } });
      if (!w) throw notFound();
      where.id = w.id;
    }

    const [items, total] = await Promise.all([
      db.worker.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, fullName: true, phone: true, status: true } },
          skills: true,
          certifications: true,
          _count: { select: { ratings: true, assignments: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.worker.count({ where }),
    ]);
    return { items, total };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workers:create");
    const body = await parseJson(req, workerCreateSchema);
    // Create user + worker
    const { hashPassword } = await import("@/lib/auth");
    const user = await db.user.create({
      data: {
        email: body.email,
        passwordHash: hashPassword(body.password),
        fullName: body.fullName,
        phone: body.phone,
        role: "WORKER",
        status: "ACTIVE",
      },
    });
    const worker = await db.worker.create({
      data: {
        userId: user.id,
        homeLatitude: body.homeLatitude,
        homeLongitude: body.homeLongitude,
        preferredRadiusKm: body.preferredRadiusKm,
        onboardingStep: "PROFILE",
        kycStatus: "NOT_SUBMITTED",
      },
      include: { user: true },
    });
    await writeAudit({
      action: "worker.create",
      resourceType: "Worker",
      resourceId: worker.id,
      after: { email: body.email },
    });
    return { worker };
  });
}
