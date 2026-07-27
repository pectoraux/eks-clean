// OpsOS Capabilities — list + create
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { z } from "zod";

export const maxDuration = 60;

const schema = z.object({
  organizationId: z.string(), code: z.string(), name: z.string(), version: z.string().default("1.0.0"),
  description: z.string().optional(), requiredResources: z.any().optional(), requiredSkills: z.any().optional(),
  inputs: z.any().optional(), outputs: z.any().optional(), costModel: z.any().optional(),
  protocolId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    const items = await db.capability.findMany({
      where: orgId ? { organizationId: orgId } : {},
      orderBy: { createdAt: "desc" }, take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const body = await parseJson(req, schema);
    return { capability: await db.capability.create({ data: {
      organizationId: body.organizationId, code: body.code, name: body.name,
      version: body.version, description: body.description,
      requiredResources: body.requiredResources ? JSON.stringify(body.requiredResources) : null,
      requiredSkills: body.requiredSkills ? JSON.stringify(body.requiredSkills) : null,
      inputsJson: body.inputs ? JSON.stringify(body.inputs) : null,
      outputsJson: body.outputs ? JSON.stringify(body.outputs) : null,
      costModelJson: body.costModel ? JSON.stringify(body.costModel) : null,
      protocolId: body.protocolId,
    } }) };
  });
}
