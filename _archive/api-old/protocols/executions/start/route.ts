// Protocol executions — start, complete step, finish
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { startExecution, completeStep, finishExecution } from "@/lib/modules/protocols/service";
import { z } from "zod";

const startSchema = z.object({
  protocolId: z.string(),
  workerId: z.string(),
  bookingId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "protocols:execute");
    const body = await parseJson(req, startSchema);
    const execution = await startExecution(body);
    await writeAudit({ action: "protocol.execution_start", resourceType: "ProtocolExecution", resourceId: execution.id });
    return { execution };
  });
}
