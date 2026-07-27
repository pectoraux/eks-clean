/** Quick seed of critical missing data on new Neon DB */
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
  // 1. Create real admin if missing
  const existingAdmin = await p.user.findUnique({ where: { email: "ekontetevi@gmail" } });
  if (!existingAdmin) {
    await p.user.create({
      data: {
        email: "ekontetevi@gmail",
        passwordHash: hashPassword("Payswap123456"),
        fullName: "Ekonte Tevi",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    console.log("✓ Created real admin: ekontetevi@gmail");
  } else {
    console.log("  Real admin already exists");
  }

  // 2. Create waitlist entries if missing
  const wlCount = await p.waitlistEntry.count();
  if (wlCount === 0) {
    const waitlistEmails = [
      ["Kojo Applicant", "kojo.applicant@example.com", "CUSTOMER"],
      ["Akua Worker", "akua.worker@example.com", "WORKER"],
      ["Yaa Sales", "yaa.sales@example.com", "SALES_AGENT"],
      ["Kwame Manager", "kwame.manager@example.com", "FIELD_MANAGER"],
    ];
    for (const [name, email, role] of waitlistEmails) {
      await p.waitlistEntry.create({
        data: { email, fullName: name, passwordHash: hashPassword("EksClean123!"), requestedRole: role, status: "PENDING", source: "WEB" },
      });
    }
    console.log("✓ Created 4 waitlist entries");
  } else {
    console.log(`  Waitlist already has ${wlCount} entries`);
  }

  // 3. Create feature flags if missing
  const ffCount = await p.featureFlag.count();
  if (ffCount === 0) {
    const flags = [
      { key: "marketplace.open", description: "Open marketplace to independent workers", enabled: false, rolloutPercent: 0 },
      { key: "ai.demand_forecast", description: "AI demand forecasting", enabled: true, rolloutPercent: 100, targetRoles: "ADMIN,FIELD_MANAGER" },
      { key: "ai.dispatch_optimizer", description: "AI dispatch optimizer", enabled: false, rolloutPercent: 0 },
      { key: "ai.qa_prediction", description: "AI quality prediction", enabled: false, rolloutPercent: 0 },
      { key: "ai.support_assistant", description: "Customer support AI assistant", enabled: true, rolloutPercent: 50 },
      { key: "module.laundry", description: "Laundry module", enabled: true, rolloutPercent: 100 },
      { key: "module.waste", description: "Waste collection module", enabled: true, rolloutPercent: 100 },
    ];
    for (const f of flags) await p.featureFlag.create({ data: f });
    console.log("✓ Created 7 feature flags");
  } else {
    console.log(`  Feature flags already has ${ffCount} entries`);
  }

  // 4. Create some bookings if missing
  const bkCount = await p.booking.count();
  if (bkCount === 0) {
    const customers = await p.customer.findMany({ take: 5, include: { addresses: true } });
    const services = await p.serviceType.findMany();
    const now = Date.now();
    let count = 0;
    for (let i = 0; i < 10; i++) {
      const cust = customers[i % customers.length];
      const svc = services[i % services.length];
      const addr = cust.addresses[0];
      if (!addr) continue;
      const start = new Date(now - (10 - i) * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + (svc.estimatedDurationMin || 180) * 60 * 1000);
      const status = ["requested", "assigned", "in_progress", "completed", "rated", "cancelled"][i % 6];
      try {
        await p.booking.create({
          data: {
            code: `EKS-2026-${100001 + i}`,
            customerId: cust.id,
            serviceTypeId: svc.id,
            addressId: addr.id,
            status,
            scheduledStart: start,
            scheduledEnd: end,
            workerCount: 1,
            priceMinor: svc.basePriceMinor * 2,
            totalMinor: svc.basePriceMinor * 2,
            currency: "GHS",
            source: "WEB",
          },
        });
        count++;
      } catch (e) { /* skip */ }
    }
    console.log(`✓ Created ${count} bookings`);
  } else {
    console.log(`  Bookings already has ${bkCount} entries`);
  }

  // 5. Create default organization if missing
  const orgCount = await p.organization.count();
  if (orgCount === 0) {
    const org = await p.organization.create({
      data: { code: "EKS-CLEAN", name: "Eks-Clean", currency: "GHS", timezone: "Africa/Accra", plan: "ENTERPRISE" },
    });
    console.log("✓ Created organization:", org.name);
    // Assign all entities to org
    await p.user.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
    await p.customer.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
    await p.worker.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
    await p.serviceType.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
    await p.inventoryItem.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
    console.log("✓ Assigned all entities to org");
  } else {
    console.log(`  Organization already has ${orgCount} entries`);
  }

  // 6. Create missing demo accounts if they don't exist
  const demos = [
    { email: "fm1@eksclean.example", fullName: "Kwesi Mensah", role: "FIELD_MANAGER" },
    { email: "sales1@eksclean.example", fullName: "Akosua Sales", role: "SALES_AGENT" },
  ];
  for (const d of demos) {
    const exists = await p.user.findUnique({ where: { email: d.email } });
    if (!exists) {
      const u = await p.user.create({ data: { email: d.email, passwordHash: hashPassword("EksClean123!"), fullName: d.fullName, role: d.role, status: "ACTIVE" } });
      if (d.role === "FIELD_MANAGER") await p.fieldManager.create({ data: { userId: u.id } });
      if (d.role === "SALES_AGENT") await p.salesAgent.create({ data: { userId: u.id, referralCode: `EKS-${u.id.slice(0, 6).toUpperCase()}` } });
      console.log(`✓ Created demo ${d.role}: ${d.email}`);
    }
  }

  // Summary
  console.log("\n=== Final DB state ===");
  console.log("Users:", await p.user.count());
  console.log("Customers:", await p.customer.count());
  console.log("Workers:", await p.worker.count());
  console.log("Bookings:", await p.booking.count());
  console.log("Services:", await p.serviceType.count());
  console.log("Waitlist:", await p.waitlistEntry.count());
  console.log("FeatureFlags:", await p.featureFlag.count());
  console.log("Organizations:", await p.organization.count());

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
