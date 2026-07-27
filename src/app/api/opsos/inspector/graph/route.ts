// OpsOS Inspector — execution graph, provenance, trace
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle } from "@/lib/utils/api";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    if (!orgId) return { graph: { nodes: [], edges: [] } };

    // Build execution graph: demands → intents → plans → tasks
    const [demands, intents, plans, events, rules, resources, capabilities] = await Promise.all([
      db.demand.findMany({ where: { organizationId: orgId }, take: 20, orderBy: { createdAt: "desc" } }),
      db.intent.findMany({ where: { organizationId: orgId }, take: 20, orderBy: { createdAt: "desc" } }),
      db.executionPlan.findMany({ where: { organizationId: orgId }, take: 20, orderBy: { createdAt: "desc" } }),
      db.event.findMany({ where: { organizationId: orgId }, take: 30, orderBy: { occurredAt: "desc" } }),
      db.rule.findMany({ where: { organizationId: orgId, isActive: true }, take: 10 }),
      db.resource.findMany({ where: { organizationId: orgId }, take: 10 }),
      db.capability.findMany({ where: { organizationId: orgId, isActive: true }, take: 10 }),
    ]);

    const nodes: Array<{ id: string; label: string; type: string; status?: string }> = [];
    const edges: Array<{ from: string; to: string; label?: string }> = [];

    for (const d of demands) { nodes.push({ id: d.id, label: d.code, type: "DEMAND", status: d.status }); }
    for (const i of intents) {
      nodes.push({ id: i.id, label: i.code, type: "INTENT", status: i.validationStatus });
      if (i.demandId) edges.push({ from: i.demandId, to: i.id, label: "creates" });
    }
    for (const p of plans) {
      nodes.push({ id: p.id, label: p.code, type: "EXECUTION_PLAN", status: p.status });
      if (p.intentId) edges.push({ from: p.intentId, to: p.id, label: "plans" });
    }
    for (const e of events) {
      nodes.push({ id: e.id, label: e.eventType, type: "EVENT" });
      edges.push({ from: e.aggregateId, to: e.id, label: "emits" });
    }
    for (const r of resources) { nodes.push({ id: r.id, label: r.name, type: "RESOURCE", status: r.status }); }
    for (const c of capabilities) { nodes.push({ id: c.id, label: c.name, type: "CAPABILITY" }); }

    return { graph: { nodes, edges }, stats: { demands: demands.length, intents: intents.length, plans: plans.length, events: events.length, rules: rules.length, resources: resources.length, capabilities: capabilities.length } };
  });
}
