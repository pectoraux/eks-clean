import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createEnterprise, enterpriseMetrics } from "@/lib/modules/enterprise-accounts/service";
import { z } from "zod";

const schema = z.object({ organizationId: z.string(), name: z.string(), legalName: z.string().optional(), taxId: z.string().optional(), industry: z.string().optional(), size: z.string().default("MID") });

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "enterprise:read" as never);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    if (url.searchParams.get("metrics") === "true" && orgId) return enterpriseMetrics(orgId);
    const items = await db.enterprise.findMany({ where: orgId ? { organizationId: orgId } : {}, include: { _count: { select: { departments: true, costCenters: true } } }, orderBy: { createdAt: "desc" } });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "enterprise:manage" as never);
    const body = await parseJson(req, schema);
    return { enterprise: await createEnterprise(body) };
  });
}
