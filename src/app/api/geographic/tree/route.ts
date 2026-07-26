// Geographic tree — full hierarchy
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { getGeographicTree, geographicMetrics } from "@/lib/modules/geographic/service";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "analytics:read" as never);
    const url = new URL(req.url);
    if (url.searchParams.get("metrics") === "true") return geographicMetrics();
    return { tree: await getGeographicTree() };
  });
}
