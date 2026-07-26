import { NextRequest } from "next/server";
import { rotateRefreshToken } from "@/lib/auth";
import { handle, parseJson, getIp, getUserAgent, unauthorized } from "@/lib/utils/api";
import { z } from "zod";

const schema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const body = await parseJson(req, schema);
    const session = await rotateRefreshToken(body.refreshToken, {
      userAgent: getUserAgent(req),
      ipAddress: getIp(req),
    });
    if (!session) throw unauthorized("Invalid or expired refresh token");
    return { session };
  });
}
