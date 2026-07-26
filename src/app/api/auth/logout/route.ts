import { NextRequest } from "next/server";
import { revokeRefreshToken } from "@/lib/auth";
import { handle, parseJson, ok } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { getSessionFromHeaders } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const body = await parseJson(req, schema);
    await revokeRefreshToken(body.refreshToken);
    const session = await getSessionFromHeaders(req.headers);
    await writeAudit({
      action: "user.logout",
      resourceType: "User",
      resourceId: session?.sub,
    });
    return ok({ ok: true });
  });
}
