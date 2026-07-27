/** OpsOS seed — creates org, admin user, sample resources, capabilities, demands, rules */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, pbkdf2Sync } from "crypto";

const p = new PrismaClient();
const PBKDF2_ITER = 120000, PBKDF2_KEYLEN = 32, PBKDF2_DIGEST = "sha256";
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = pbkdf2Sync(password, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `pbkdf2$${PBKDF2_ITER}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

async function main() {
  console.log("🌱 Seeding OpsOS kernel...");

  // 1. Organization
  const org = await p.organization.create({
    data: { code: "OPSOS-DEFAULT", name: "OpsOS Default Org", currency: "USD", timezone: "UTC", plan: "ENTERPRISE", environment: "PRODUCTION" },
  });
  console.log(`  Org: ${org.name} (${org.id})`);

  // 2. Admin user
  const admin = await p.user.create({
    data: { email: "admin@opsos.io", passwordHash: hashPassword("OpsOS123!"), fullName: "OpsOS Admin", status: "ACTIVE", organizationId: org.id },
  });
  console.log(`  Admin: ${admin.email}`);

  // 3. Resources (domain-independent types)
  const resources = [
    { code: "RES-001", name: "Field Worker Alpha", resourceType: "WORKER", metadata: { skills: ["general"], zone: "zone-1" } },
    { code: "RES-002", name: "Field Worker Beta", resourceType: "WORKER", metadata: { skills: ["general", "specialized"], zone: "zone-2" } },
    { code: "RES-003", name: "Service Vehicle 1", resourceType: "VEHICLE", metadata: { type: "van", capacity: "large" } },
    { code: "RES-004", name: "Equipment Bundle A", resourceType: "EQUIPMENT", metadata: { items: ["vacuum", "tools"] } },
  ];
  for (const r of resources) {
    await p.resource.create({ data: { organizationId: org.id, ...r, metadataJson: JSON.stringify(r.metadata) } });
  }
  console.log(`  Resources: ${resources.length}`);

  // 4. Capabilities (registered by protocols — these are examples)
  const caps = [
    { code: "CAP-GENERAL-SERVICE", name: "General Service Capability", version: "1.0.0", description: "Generic service execution", costModel: { baseCost: 5000, perUnit: "hour" } },
    { code: "CAP-SPECIALIZED-SERVICE", name: "Specialized Service Capability", version: "1.0.0", description: "Requires specialized resources", costModel: { baseCost: 8000, perUnit: "hour" } },
  ];
  for (const c of caps) {
    await p.capability.create({ data: { organizationId: org.id, ...c, costModelJson: JSON.stringify(c.costModel) } });
  }
  console.log(`  Capabilities: ${caps.length}`);

  // 5. Demands (examples)
  for (let i = 0; i < 5; i++) {
    await p.demand.create({
      data: {
        organizationId: org.id, code: `DEM-2026-${100001 + i}`,
        source: "EXTERNAL", capabilityCode: i % 2 === 0 ? "CAP-GENERAL-SERVICE" : "CAP-SPECIALIZED-SERVICE",
        quantity: 1, priority: ["NORMAL", "HIGH", "URGENT"][i % 3], status: "DETECTED",
        constraintsJson: JSON.stringify({ time: "flexible", location: "zone-1" }),
      },
    });
  }
  console.log(`  Demands: 5`);

  // 6. Rules (examples)
  await p.rule.create({
    data: {
      organizationId: org.id, name: "High Priority Auto-Escalate",
      description: "Auto-escalate urgent demands", triggerEvent: "demand.detected",
      priority: 50, isActive: true,
      conditionsJson: JSON.stringify([{ field: "priority", operator: "EQ", value: "URGENT" }]),
      actionsJson: JSON.stringify([{ actionType: "NOTIFY", config: { role: "MANAGER", message: "Urgent demand detected" }, isAsync: true }]),
    },
  });
  await p.rule.create({
    data: {
      organizationId: org.id, name: "Resource Utilization Alert",
      description: "Alert when utilization is high", triggerEvent: "resource.allocated",
      priority: 75, isActive: true,
      conditionsJson: JSON.stringify([{ field: "utilization", operator: "GT", value: 90 }]),
      actionsJson: JSON.stringify([{ actionType: "NOTIFY", config: { role: "MANAGER", message: "High utilization" }, isAsync: true }]),
    },
  });
  console.log(`  Rules: 2`);

  // 7. Policies (examples)
  await p.policy.create({
    data: { organizationId: org.id, key: "POLICY-DEFAULT-ALLOW", name: "Default Allow", policyType: "ACCESS", effect: "ALLOW", priority: 100 },
  });
  console.log(`  Policies: 1`);

  // 8. Events (seed the event store)
  for (let i = 0; i < 5; i++) {
    await p.event.create({
      data: {
        organizationId: org.id, aggregateType: "DEMAND", aggregateId: `seed-demand-${i}`,
        eventType: "demand.detected", version: 1,
        payloadJson: JSON.stringify({ priority: "NORMAL", source: "EXTERNAL" }),
        metadataJson: JSON.stringify({ actorType: "SYSTEM" }),
      },
    });
  }
  console.log(`  Events: 5`);

  // 9. Runtime clock
  await p.runtimeClock.create({ data: { organizationId: org.id, mode: "WALL", tickDurationMs: 1000 } });
  console.log(`  RuntimeClock: initialized`);

  console.log("\n✅ OpsOS seed complete");
  console.log("Login: admin@opsos.io / OpsOS123!");
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
