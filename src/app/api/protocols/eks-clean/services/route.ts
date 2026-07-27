/**
 * Eks-Clean protocol API: list services (capabilities registered by the protocol)
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle } from "@/lib/utils/api";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    if (!orgId) return { items: [] };

    // Return only capabilities registered by the eks-clean protocol
    const items = await db.capability.findMany({
      where: { organizationId: orgId, protocolId: "eks-clean", isActive: true },
      orderBy: { code: "asc" },
    });
    return { items };
  });
}
