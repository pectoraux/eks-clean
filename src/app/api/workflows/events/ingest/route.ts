import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { ingestEvent } from "@/lib/modules/workflows/service";
import { z } from "zod";

const schema = z.object({
  eventType: z.string(),
  payload: z.record(z.unknown()),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workflows:execute");
    const body = await parseJson(req, schema);
    await ingestEvent(body.eventType, body.payload);
    return { ok: true };
  });
}
