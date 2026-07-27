// OpsOS Protocols — list + install
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { z } from "zod";

export const maxDuration = 60;

const installSchema = z.object({
  organizationId: z.string(), protocolKey: z.string(), protocolVersion: z.string(),
  name: z.string(), description: z.string().optional(),
  capabilities: z.any().optional(), intentDefinitions: z.any().optional(),
  policies: z.any().optional(), rules: z.any().optional(), workflows: z.any().optional(),
  marketplace: z.any().optional(), pricing: z.any().optional(),
  dashboards: z.any().optional(), readModels: z.any().optional(),
  analytics: z.any().optional(), apiEndpoints: z.any().optional(), uiComponents: z.any().optional(),
  compilerStages: z.any().optional(), configuration: z.any().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    const items = await db.protocolInstallation.findMany({
      where: orgId ? { organizationId: orgId } : {},
      orderBy: { installedAt: "desc" },
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const body = await parseJson(req, installSchema);
    return { protocol: await db.protocolInstallation.upsert({
      where: { organizationId_protocolKey: { organizationId: body.organizationId, protocolKey: body.protocolKey } },
      update: { protocolVersion: body.protocolVersion, name: body.name, description: body.description,
        capabilitiesJson: body.capabilities ? JSON.stringify(body.capabilities) : null,
        intentDefinitionsJson: body.intentDefinitions ? JSON.stringify(body.intentDefinitions) : null,
        policiesJson: body.policies ? JSON.stringify(body.policies) : null,
        rulesJson: body.rules ? JSON.stringify(body.rules) : null,
        workflowsJson: body.workflows ? JSON.stringify(body.workflows) : null,
        marketplaceJson: body.marketplace ? JSON.stringify(body.marketplace) : null,
        pricingJson: body.pricing ? JSON.stringify(body.pricing) : null,
        dashboardsJson: body.dashboards ? JSON.stringify(body.dashboards) : null,
        readModelsJson: body.readModels ? JSON.stringify(body.readModels) : null,
        analyticsJson: body.analytics ? JSON.stringify(body.analytics) : null,
        apiEndpointsJson: body.apiEndpoints ? JSON.stringify(body.apiEndpoints) : null,
        uiComponentsJson: body.uiComponents ? JSON.stringify(body.uiComponents) : null,
        compilerStagesJson: body.compilerStages ? JSON.stringify(body.compilerStages) : null,
        configurationJson: body.configuration ? JSON.stringify(body.configuration) : null,
        status: "INSTALLED",
      },
      create: {
        organizationId: body.organizationId, protocolKey: body.protocolKey,
        protocolVersion: body.protocolVersion, name: body.name, description: body.description,
        capabilitiesJson: body.capabilities ? JSON.stringify(body.capabilities) : null,
        intentDefinitionsJson: body.intentDefinitions ? JSON.stringify(body.intentDefinitions) : null,
        policiesJson: body.policies ? JSON.stringify(body.policies) : null,
        rulesJson: body.rules ? JSON.stringify(body.rules) : null,
        workflowsJson: body.workflows ? JSON.stringify(body.workflows) : null,
        marketplaceJson: body.marketplace ? JSON.stringify(body.marketplace) : null,
        pricingJson: body.pricing ? JSON.stringify(body.pricing) : null,
        dashboardsJson: body.dashboards ? JSON.stringify(body.dashboards) : null,
        readModelsJson: body.readModels ? JSON.stringify(body.readModels) : null,
        analyticsJson: body.analytics ? JSON.stringify(body.analytics) : null,
        apiEndpointsJson: body.apiEndpoints ? JSON.stringify(body.apiEndpoints) : null,
        uiComponentsJson: body.uiComponents ? JSON.stringify(body.uiComponents) : null,
        compilerStagesJson: body.compilerStages ? JSON.stringify(body.compilerStages) : null,
        configurationJson: body.configuration ? JSON.stringify(body.configuration) : null,
        status: "INSTALLED",
      },
    }) };
  });
}
