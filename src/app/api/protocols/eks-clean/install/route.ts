/**
 * Install Eks-Clean protocol into an organization via the Protocol SDK.
 * This route reads the protocol definition and registers all its components
 * into the OpsOS kernel — WITHOUT modifying the kernel.
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { eksCleanProtocol } from "@/protocols/eks-clean";
import { z } from "zod";

export const maxDuration = 60;

const installSchema = z.object({ organizationId: z.string() });

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");

    const body = await parseJson(req, installSchema);
    const orgId = body.organizationId;
    const protocol = eksCleanProtocol;

    // 1. Register capabilities
    const capabilities = protocol.registerCapabilities();
    for (const cap of capabilities) {
      await db.capability.upsert({
        where: { organizationId_code_version: { organizationId: orgId, code: cap.code, version: cap.version ?? "1.0.0" } },
        update: { name: cap.name, description: cap.description, isActive: true, protocolId: "eks-clean",
          requiredResources: cap.requiredResources ? JSON.stringify(cap.requiredResources) : null,
          requiredSkills: cap.requiredSkills ? JSON.stringify(cap.requiredSkills) : null,
          inputsJson: cap.inputs ? JSON.stringify(cap.inputs) : null,
          outputsJson: cap.outputs ? JSON.stringify(cap.outputs) : null,
          costModelJson: cap.costModel ? JSON.stringify(cap.costModel) : null,
          qualityMetricsJson: cap.qualityMetrics ? JSON.stringify(cap.qualityMetrics) : null,
        },
        create: {
          organizationId: orgId, code: cap.code, name: cap.name, version: cap.version ?? "1.0.0",
          description: cap.description, protocolId: "eks-clean", isActive: true,
          requiredResources: cap.requiredResources ? JSON.stringify(cap.requiredResources) : null,
          requiredSkills: cap.requiredSkills ? JSON.stringify(cap.requiredSkills) : null,
          inputsJson: cap.inputs ? JSON.stringify(cap.inputs) : null,
          outputsJson: cap.outputs ? JSON.stringify(cap.outputs) : null,
          costModelJson: cap.costModel ? JSON.stringify(cap.costModel) : null,
          qualityMetricsJson: cap.qualityMetrics ? JSON.stringify(cap.qualityMetrics) : null,
        },
      });
    }

    // 2. Register rules
    const rules = protocol.registerRules();
    for (const rule of rules) {
      await db.rule.create({
        data: {
          organizationId: orgId, name: rule.name, triggerEvent: rule.triggerEvent,
          priority: rule.priority ?? 100, isActive: true, protocolId: "eks-clean",
          conditionsJson: JSON.stringify(rule.conditions),
          actionsJson: JSON.stringify(rule.actions),
        },
      }).catch(() => {}); // skip duplicates
    }

    // 3. Register policies
    const policies = protocol.registerPolicies();
    for (const policy of policies) {
      await db.policy.upsert({
        where: { organizationId_key: { organizationId: orgId, key: policy.key } },
        update: { name: policy.name, policyType: policy.policyType, effect: policy.effect, priority: policy.priority ?? 100, isActive: true, protocolId: "eks-clean",
          conditionsJson: policy.conditions ? JSON.stringify(policy.conditions) : null,
          actionsJson: policy.actions ? JSON.stringify(policy.actions) : null,
        },
        create: {
          organizationId: orgId, key: policy.key, name: policy.name, policyType: policy.policyType,
          effect: policy.effect, priority: policy.priority ?? 100, isActive: true, protocolId: "eks-clean",
          conditionsJson: policy.conditions ? JSON.stringify(policy.conditions) : null,
          actionsJson: policy.actions ? JSON.stringify(policy.actions) : null,
        },
      });
    }

    // 4. Register workflows
    const workflows = protocol.registerWorkflows();
    for (const wf of workflows) {
      await db.workflowDefinition.upsert({
        where: { organizationId_key: { organizationId: orgId, key: wf.key } },
        update: { name: wf.name, stagesJson: JSON.stringify(wf.stages), isActive: true, protocolId: "eks-clean",
          approvalRulesJson: wf.approvalRules ? JSON.stringify(wf.approvalRules) : null,
          completionRulesJson: wf.completionRules ? JSON.stringify(wf.completionRules) : null,
          estimatedDurationMin: wf.estimatedDurationMin,
        },
        create: {
          organizationId: orgId, key: wf.key, name: wf.name, protocolId: "eks-clean",
          stagesJson: JSON.stringify(wf.stages), isActive: true,
          approvalRulesJson: wf.approvalRules ? JSON.stringify(wf.approvalRules) : null,
          completionRulesJson: wf.completionRules ? JSON.stringify(wf.completionRules) : null,
          estimatedDurationMin: wf.estimatedDurationMin,
        },
      });
    }

    // 5. Register marketplace
    const marketplaces = protocol.registerMarketplace();
    for (const mkt of marketplaces) {
      await db.marketplace.create({
        data: { organizationId: orgId, name: mkt.name, marketplaceType: mkt.marketplaceType, optimizationGoals: mkt.optimizationGoals, isActive: true },
      }).catch(() => {});
    }

    // 6. Register the protocol installation record
    const installation = await db.protocolInstallation.upsert({
      where: { organizationId_protocolKey: { organizationId: orgId, protocolKey: protocol.key } },
      update: {
        protocolVersion: protocol.version, name: protocol.name, description: protocol.description,
        capabilitiesJson: JSON.stringify(capabilities.map(c => c.code)),
        intentDefinitionsJson: JSON.stringify(protocol.registerIntentDefinitions()),
        policiesJson: JSON.stringify(policies.map(p => p.key)),
        rulesJson: JSON.stringify(rules.map(r => r.name)),
        workflowsJson: JSON.stringify(workflows.map(w => w.key)),
        marketplaceJson: JSON.stringify(marketplaces.map(m => m.name)),
        pricingJson: JSON.stringify(protocol.registerPricing()),
        dashboardsJson: JSON.stringify(protocol.registerDashboards()),
        readModelsJson: JSON.stringify(protocol.registerReadModels()),
        analyticsJson: JSON.stringify(protocol.registerAnalytics()),
        apiEndpointsJson: JSON.stringify(protocol.registerApi()),
        uiComponentsJson: JSON.stringify(protocol.registerUi()),
        compilerStagesJson: JSON.stringify(protocol.registerCompilerStages()),
        status: "ACTIVE", activatedAt: new Date(),
      },
      create: {
        organizationId: orgId, protocolKey: protocol.key, protocolVersion: protocol.version,
        name: protocol.name, description: protocol.description,
        capabilitiesJson: JSON.stringify(capabilities.map(c => c.code)),
        intentDefinitionsJson: JSON.stringify(protocol.registerIntentDefinitions()),
        policiesJson: JSON.stringify(policies.map(p => p.key)),
        rulesJson: JSON.stringify(rules.map(r => r.name)),
        workflowsJson: JSON.stringify(workflows.map(w => w.key)),
        marketplaceJson: JSON.stringify(marketplaces.map(m => m.name)),
        pricingJson: JSON.stringify(protocol.registerPricing()),
        dashboardsJson: JSON.stringify(protocol.registerDashboards()),
        readModelsJson: JSON.stringify(protocol.registerReadModels()),
        analyticsJson: JSON.stringify(protocol.registerAnalytics()),
        apiEndpointsJson: JSON.stringify(protocol.registerApi()),
        uiComponentsJson: JSON.stringify(protocol.registerUi()),
        compilerStagesJson: JSON.stringify(protocol.registerCompilerStages()),
        status: "ACTIVE", activatedAt: new Date(),
      },
    });

    return {
      installed: true,
      protocol: { key: protocol.key, name: protocol.name, version: protocol.version },
      registered: {
        capabilities: capabilities.length,
        intents: protocol.registerIntentDefinitions().length,
        policies: policies.length,
        rules: rules.length,
        workflows: workflows.length,
        marketplaces: marketplaces.length,
        pricing: protocol.registerPricing().length,
        dashboards: protocol.registerDashboards().length,
        readModels: protocol.registerReadModels().length,
        analytics: protocol.registerAnalytics().length,
        apiEndpoints: protocol.registerApi().length,
        uiComponents: protocol.registerUi().length,
        compilerStages: protocol.registerCompilerStages().length,
      },
      installationId: installation.id,
    };
  });
}
