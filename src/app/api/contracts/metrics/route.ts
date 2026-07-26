import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { contractMetrics } from "@/lib/modules/contracts/service";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "contracts:read");
    return contractMetrics();
  });
}
