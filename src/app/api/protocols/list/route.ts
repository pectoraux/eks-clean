// Protocols list + create
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { listProtocols, createProtocol } from "@/lib/modules/protocols/service";
import { z } from "zod";

const protocolSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  serviceTypeId: z.string().optional(),
  surfaceCode: z.string().optional(),
  estimatedDurationMin: z.number().int().min(1),
  safetyNotes: z.string().optional(),
  steps: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    expectedDurationMin: z.number().int().min(1),
    requiresPhoto: z.boolean().optional(),
    ppeRequired: z.string().optional(),
    equipmentRequired: z.string().optional(),
    qualityChecklist: z.array(z.string()).optional(),
    chemicals: z.array(z.object({
      itemId: z.string(),
      quantityPerSqM: z.number().optional(),
      notes: z.string().optional(),
    })).optional(),
  })),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "protocols:read");
    const url = new URL(req.url);
    return { items: await listProtocols({
      serviceTypeId: url.searchParams.get("serviceTypeId") || undefined,
      surfaceCode: url.searchParams.get("surfaceCode") || undefined,
      activeOnly: url.searchParams.get("activeOnly") !== "false",
    }) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "protocols:manage");
    const body = await parseJson(req, protocolSchema);
    const protocol = await createProtocol({ ...body, createdBy: session?.sub });
    await writeAudit({ action: "protocol.create", resourceType: "CleaningProtocol", resourceId: protocol.id });
    return { protocol };
  });
}
