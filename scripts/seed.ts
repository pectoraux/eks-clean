/**
 * ============================================================================
 *  Eks-Clean — Seed Script
 * ============================================================================
 *  Produces a realistic demo dataset:
 *   - 1 admin + 2 field managers + 3 sales agents
 *   - 10 customers (with addresses, household profiles)
 *   - 15 workers (KYC verified, with skills, availabilities, ratings)
 *   - 8 service types + 5 subscription plans
 *   - 20+ bookings (various statuses) + ratings + payment intents
 *   - 12 inventory items + warehouse stock + movements
 *   - 6 feature flags (marketplace, AI modules, etc.)
 *   - 4 laundry orders + 3 waste schedules
 *   - Audit logs + domain events for the seeded bookings
 * ============================================================================
 */

import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

async function main() {
  console.log("🌱 Seeding Eks-Clean...");

  // -- Admin & staff
  const admin = await db.user.create({
    data: {
      email: "admin@eksclean.example",
      passwordHash: hashPassword("EksClean123!"),
      fullName: "Ama Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  // -- Non-demo admin (real account for ekontetevi@gmail)
  const realAdmin = await db.user.create({
    data: {
      email: "ekontetevi@gmail",
      passwordHash: hashPassword("Payswap123456"),
      fullName: "Ekonte Tevi",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  console.log(`   Created non-demo admin: ekontetevi@gmail (id: ${realAdmin.id})`);

  // -- A few sample waitlist entries (so the admin UI has something to show)
  const waitlistEmails = [
    ["Kojo Applicant", "kojo.applicant@example.com", "CUSTOMER", "+233241111222"],
    ["Akua Worker", "akua.worker@example.com", "WORKER", "+233243333444"],
    ["Yaa Sales", "yaa.sales@example.com", "SALES_AGENT", "+233245555666"],
    ["Kwame Manager", "kwame.manager@example.com", "FIELD_MANAGER", "+233247777888"],
    ["Ama Rejected", "ama.rejected@example.com", "CUSTOMER", "+233249990000"],
  ];
  for (const [name, email, role, phone] of waitlistEmails) {
    const status = email.startsWith("ama.rejected") ? "REJECTED" : "PENDING";
    await db.waitlistEntry.create({
      data: {
        email,
        fullName: name,
        phone,
        passwordHash: hashPassword("EksClean123!"),
        requestedRole: role,
        status,
        ...(status === "REJECTED" ? { rejectionReason: "Duplicate application", reviewedBy: admin.id, reviewedAt: new Date() } : {}),
        source: "WEB",
      },
    });
  }
  console.log(`   Created ${waitlistEmails.length} waitlist entries`);

  const fm1User = await db.user.create({
    data: {
      email: "fm1@eksclean.example",
      passwordHash: hashPassword("EksClean123!"),
      fullName: "Kwesi Mensah",
      role: "FIELD_MANAGER",
      status: "ACTIVE",
    },
  });
  const fm1 = await db.fieldManager.create({
    data: { userId: fm1User.id, region: "Accra-Central", hireDate: new Date("2024-01-15") },
  });

  const sa1User = await db.user.create({
    data: {
      email: "sales1@eksclean.example",
      passwordHash: hashPassword("EksClean123!"),
      fullName: "Akosua Sales",
      role: "SALES_AGENT",
      status: "ACTIVE",
    },
  });
  const sa1 = await db.salesAgent.create({
    data: {
      userId: sa1User.id,
      territory: "East-Legon",
      referralCode: "EKS-EAST01",
      commissionRate: 0.07,
    },
  });

  // -- Service types
  const services = [
    { code: "HOME_CLEANING", name: "Home Cleaning", category: "CLEANING", basePriceMinor: 5000, priceUnit: "PER_HOUR", estimatedDurationMin: 180, requiresCertification: null },
    { code: "DEEP_CLEANING", name: "Deep Cleaning", category: "CLEANING", basePriceMinor: 8000, priceUnit: "PER_HOUR", estimatedDurationMin: 360, requiresCertification: "DEEP_CLEAN" },
    { code: "OFFICE_CLEANING", name: "Office Cleaning", category: "CLEANING", basePriceMinor: 6000, priceUnit: "PER_HOUR", estimatedDurationMin: 240, requiresCertification: null },
    { code: "MOVE_IN_CLEANING", name: "Move-In Cleaning", category: "CLEANING", basePriceMinor: 12000, priceUnit: "PER_JOB", estimatedDurationMin: 480, requiresCertification: null },
    { code: "MOVE_OUT_CLEANING", name: "Move-Out Cleaning", category: "CLEANING", basePriceMinor: 12000, priceUnit: "PER_JOB", estimatedDurationMin: 480, requiresCertification: null },
    { code: "LAUNDRY_PICKUP", name: "Laundry Pickup", category: "LAUNDRY", basePriceMinor: 3000, priceUnit: "PER_JOB", estimatedDurationMin: 60, requiresCertification: "LAUNDRY" },
    { code: "CARPET_CLEANING", name: "Carpet Cleaning", category: "CLEANING", basePriceMinor: 4500, priceUnit: "PER_SQ_M", estimatedDurationMin: 120, requiresCertification: "CARPET" },
    { code: "WINDOW_CLEANING", name: "Window Cleaning", category: "CLEANING", basePriceMinor: 3500, priceUnit: "PER_HOUR", estimatedDurationMin: 90, requiresCertification: "WINDOW" },
    { code: "CAR_WASH", name: "Car Wash", category: "DETAILING", basePriceMinor: 2500, priceUnit: "PER_JOB", estimatedDurationMin: 45, requiresCertification: "VEHICLE" },
    { code: "WASTE_COLLECTION", name: "Waste Collection", category: "WASTE", basePriceMinor: 1500, priceUnit: "PER_JOB", estimatedDurationMin: 30, requiresCertification: null },
  ];
  const serviceMap: Record<string, string> = {};
  for (const s of services) {
    const r = await db.serviceType.create({ data: s });
    serviceMap[s.code] = r.id;
  }

  // -- Subscription plans
  const plans = [
    { serviceCode: "HOME_CLEANING", name: "Weekly Home Cleaning", cadence: "WEEKLY", cadenceDays: 7, billingPriceMinor: 18000, discountPercent: 0.1 },
    { serviceCode: "HOME_CLEANING", name: "Bi-weekly Home Cleaning", cadence: "BIWEEKLY", cadenceDays: 14, billingPriceMinor: 18000, discountPercent: 0.05 },
    { serviceCode: "WASTE_COLLECTION", name: "Weekly Waste Pickup", cadence: "WEEKLY", cadenceDays: 7, billingPriceMinor: 5000, discountPercent: 0.1 },
    { serviceCode: "OFFICE_CLEANING", name: "Monthly Office Cleaning", cadence: "MONTHLY", cadenceDays: 30, billingPriceMinor: 50000, discountPercent: 0.15 },
    { serviceCode: "LAUNDRY_PICKUP", name: "Weekly Laundry", cadence: "WEEKLY", cadenceDays: 7, billingPriceMinor: 10000, discountPercent: 0.1 },
  ];
  for (const p of plans) {
    await db.subscriptionPlan.create({
      data: {
        serviceTypeId: serviceMap[p.serviceCode],
        name: p.name,
        cadence: p.cadence,
        cadenceDays: p.cadenceDays,
        billingPriceMinor: p.billingPriceMinor,
        discountPercent: p.discountPercent,
        isActive: true,
      },
    });
  }

  // -- Customers
  const customerNames = [
    ["Adwoa Boateng", "adwoa@example.com"],
    ["Kofi Asante", "kofi@example.com"],
    ["Esi Owusu", "esi@example.com"],
    ["Yaw Darko", "yaw@example.com"],
    ["Akua Frimpong", "akua@example.com"],
    ["Kojo Antwi", "kojo@example.com"],
    ["Ama Serwaa", "ama@example.com"],
    ["Kwabena Nyame", "kwabena@example.com"],
    ["Abena Sefa", "abena@example.com"],
    ["Nana Yaw", "nana@example.com"],
  ];
  const customers: { id: string; userId: string }[] = [];
  for (const [name, email] of customerNames) {
    const u = await db.user.create({
      data: {
        email,
        passwordHash: hashPassword("EksClean123!"),
        fullName: name,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    const c = await db.customer.create({
      data: { userId: u.id, customerTier: ["STANDARD", "SILVER", "GOLD"][Math.floor(Math.random() * 3)] },
    });
    const addr = await db.address.create({
      data: {
        customerId: c.id,
        label: "Home",
        line1: `${Math.floor(Math.random() * 200)} Spintex Road`,
        city: "Accra",
        region: "Greater Accra",
        country: "Ghana",
        latitude: 5.6 + Math.random() * 0.1,
        longitude: -0.1 + Math.random() * 0.1,
        isDefault: true,
      },
    });
    await db.householdProfile.create({
      data: {
        customerId: c.id,
        name: "Main Home",
        propertyType: "APARTMENT",
        bedrooms: 1 + Math.floor(Math.random() * 4),
        bathrooms: 1 + Math.floor(Math.random() * 3),
        hasPets: Math.random() > 0.7,
        hasChildren: Math.random() > 0.5,
      },
    });
    customers.push({ id: c.id, userId: u.id });
  }

  // -- Workers
  const workerNames = [
    ["Samuel Oti", "samuel.w@eksclean.example"],
    ["Grace Lartey", "grace.w@eksclean.example"],
    ["Daniel Quaye", "daniel.w@eksclean.example"],
    ["Joyce Appiah", "joyce.w@eksclean.example"],
    ["Michael Tetteh", "michael.w@eksclean.example"],
    ["Patricia Mensah", "patricia.w@eksclean.example"],
    ["Joseph Owusu", "joseph.w@eksclean.example"],
    ["Linda Adjei", "linda.w@eksclean.example"],
    ["Emmanuel Tagoe", "emmanuel.w@eksclean.example"],
    ["Sarah Ankomah", "sarah.w@eksclean.example"],
    ["Peter Adjei", "peter.w@eksclean.example"],
    ["Blessing Agyemang", "blessing.w@eksclean.example"],
    ["Francis Boadi", "francis.w@eksclean.example"],
    ["Christiana Nkansah", "christiana.w@eksclean.example"],
    ["Isaac Boateng", "isaac.w@eksclean.example"],
  ];
  const workers: { id: string; userId: string }[] = [];
  for (let i = 0; i < workerNames.length; i++) {
    const [name, email] = workerNames[i];
    const u = await db.user.create({
      data: {
        email,
        passwordHash: hashPassword("EksClean123!"),
        fullName: name,
        role: "WORKER",
        status: "ACTIVE",
      },
    });
    const w = await db.worker.create({
      data: {
        userId: u.id,
        employeeId: `EKS-W-${(1000 + i).toString()}`,
        status: "ACTIVE",
        onboardingStep: "LIVE",
        kycStatus: "VERIFIED",
        kycSubmittedAt: new Date("2024-06-01"),
        kycVerifiedAt: new Date("2024-06-05"),
        averageRating: 3.8 + Math.random() * 1.2,
        totalRatings: Math.floor(Math.random() * 50),
        completedJobs: Math.floor(Math.random() * 100),
        homeLatitude: 5.6 + Math.random() * 0.1,
        homeLongitude: -0.1 + Math.random() * 0.1,
        preferredRadiusKm: 10 + Math.floor(Math.random() * 20),
        hireDate: new Date(2024, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)),
      },
    });
    workers.push({ id: w.id, userId: u.id });
    // Skills
    const skillPool = ["HOME_CLEANING", "DEEP_CLEAN", "WINDOW", "CARPET", "LAUNDRY", "VEHICLE"];
    const numSkills = 2 + Math.floor(Math.random() * 3);
    for (const skill of skillPool.slice(0, numSkills)) {
      await db.workerSkill.create({
        data: {
          workerId: w.id,
          skillCode: skill,
          proficiency: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"][Math.floor(Math.random() * 4)],
        },
      });
    }
    // Availabilities (Mon-Sat 8-17)
    for (let day = 1; day <= 6; day++) {
      await db.workerAvailability.create({
        data: { workerId: w.id, dayOfWeek: day, startTime: "08:00", endTime: "17:00", isAvailable: true },
      });
    }
    // Certifications
    await db.workerCertification.create({
      data: {
        workerId: w.id,
        type: "SAFETY",
        name: "Chemical Safety Basics",
        issuedBy: "Eks-Clean Academy",
        issuedAt: new Date("2024-06-10"),
        expiresAt: new Date("2026-06-10"),
        status: "ACTIVE",
      },
    });
  }

  // -- Inventory
  const inventoryItems = [
    { sku: "CHEM-001", name: "Multi-Surface Cleaner (5L)", category: "CHEMICAL", unit: "LITER", reorderLevel: 20, hazardLevel: "LOW", approvedSurfaces: "TILES,WOOD,LAMINATE,GLASS", mixingInstructions: "1:20 with water", ppeRequired: "GLOVES" },
    { sku: "CHEM-002", name: "Marble Polish (1L)", category: "CHEMICAL", unit: "LITER", reorderLevel: 10, hazardLevel: "MEDIUM", approvedSurfaces: "MARBLE,GRANITE", ppeRequired: "GLOVES,GOGGLES" },
    { sku: "CHEM-003", name: "Carpet Shampoo (5L)", category: "CHEMICAL", unit: "LITER", reorderLevel: 15, hazardLevel: "LOW", approvedSurfaces: "FABRIC,CARPET", ppeRequired: "GLOVES" },
    { sku: "CHEM-004", name: "Glass Cleaner (1L)", category: "CHEMICAL", unit: "LITER", reorderLevel: 25, hazardLevel: "LOW", approvedSurfaces: "GLASS", ppeRequired: "GLOVES" },
    { sku: "TOOL-001", name: "Microfiber Cloth (Pack 10)", category: "TOOL", unit: "BOX", reorderLevel: 10, hazardLevel: null },
    { sku: "TOOL-002", name: "Mop + Bucket Set", category: "TOOL", unit: "UNIT", reorderLevel: 5, hazardLevel: null },
    { sku: "TOOL-003", name: "Vacuum Cleaner (Industrial)", category: "EQUIPMENT", unit: "UNIT", reorderLevel: 3, hazardLevel: null },
    { sku: "PPE-001", name: "Nitrile Gloves (Box 100)", category: "PPE", unit: "BOX", reorderLevel: 15, hazardLevel: null },
    { sku: "PPE-002", name: "Safety Goggles", category: "PPE", unit: "UNIT", reorderLevel: 20, hazardLevel: null },
    { sku: "PPE-003", name: "Face Mask (Pack 50)", category: "PPE", unit: "BOX", reorderLevel: 10, hazardLevel: null },
    { sku: "EQUIP-001", name: "Pressure Washer", category: "EQUIPMENT", unit: "UNIT", reorderLevel: 2, hazardLevel: "MEDIUM" },
    { sku: "CONS-001", name: "Trash Bags (Pack 100)", category: "CONSUMABLE", unit: "BOX", reorderLevel: 20, hazardLevel: null },
  ];
  for (const item of inventoryItems) {
    const created = await db.inventoryItem.create({ data: item });
    await db.warehouseStock.create({
      data: {
        itemId: created.id,
        warehouseCode: "MAIN",
        quantity: item.reorderLevel + Math.floor(Math.random() * 50),
      },
    });
  }

  // -- Feature flags
  const flags = [
    { key: "marketplace.open", description: "Open marketplace to independent workers", enabled: false, rolloutPercent: 0 },
    { key: "ai.demand_forecast", description: "AI demand forecasting", enabled: true, rolloutPercent: 100, targetRoles: "ADMIN,FIELD_MANAGER" },
    { key: "ai.dispatch_optimizer", description: "AI dispatch optimizer", enabled: false, rolloutPercent: 0 },
    { key: "ai.qa_prediction", description: "AI quality prediction", enabled: false, rolloutPercent: 0 },
    { key: "ai.support_assistant", description: "Customer support AI assistant", enabled: true, rolloutPercent: 50 },
    { key: "module.laundry", description: "Laundry module", enabled: true, rolloutPercent: 100 },
    { key: "module.waste", description: "Waste collection module", enabled: true, rolloutPercent: 100 },
  ];
  for (const f of flags) {
    await db.featureFlag.create({ data: f });
  }

  // -- Bookings (20 across various statuses)
  const bookingStatuses = ["requested", "assigned", "worker_accepted", "worker_en_route", "arrived", "in_progress", "completed", "rated", "cancelled", "disputed"];
  const now = Date.now();
  for (let i = 0; i < 25; i++) {
    const cust = customers[i % customers.length];
    const worker = workers[i % workers.length];
    const svc = services[i % services.length];
    const status = bookingStatuses[i % bookingStatuses.length];
    const start = new Date(now - (25 - i) * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + svc.estimatedDurationMin * 60 * 1000);
    const addr = await db.address.findFirst({ where: { customerId: cust.id } });

    const booking = await db.booking.create({
      data: {
        code: `EKS-2026-${(100001 + i).toString()}`,
        customerId: cust.id,
        serviceTypeId: serviceMap[svc.code],
        addressId: addr!.id,
        status,
        scheduledStart: start,
        scheduledEnd: end,
        workerCount: 1,
        notes: i % 3 === 0 ? "Please focus on kitchen and bathrooms." : null,
        priceMinor: svc.basePriceMinor * 2,
        totalMinor: svc.basePriceMinor * 2,
        currency: "GHS",
        source: i % 4 === 0 ? "AGENT" : "WEB",
        ...(status === "in_progress" || status === "completed" || status === "rated" ? { actualStart: new Date(start.getTime() + 5 * 60 * 1000) } : {}),
        ...(status === "completed" || status === "rated" ? { actualEnd: new Date(end.getTime() - 10 * 60 * 1000) } : {}),
        ...(status === "cancelled" ? { cancellationReason: "Customer request" } : {}),
      },
    });

    // Assignment
    if (["assigned", "worker_accepted", "worker_en_route", "arrived", "in_progress", "completed", "rated"].includes(status)) {
      await db.workerAssignment.create({
        data: {
          workerId: worker.id,
          bookingId: booking.id,
          assignedBy: "system",
          status: "ACCEPTED",
          acceptedAt: new Date(start.getTime() - 30 * 60 * 1000),
          estimatedTravelMinutes: 15,
        },
      });
    }

    // Status history
    await db.bookingStatusHistory.create({
      data: { bookingId: booking.id, toStatus: "requested", actorType: "CUSTOMER" },
    });
    if (status !== "requested" && status !== "draft") {
      await db.bookingStatusHistory.create({
        data: { bookingId: booking.id, fromStatus: "requested", toStatus: "assigned", actorType: "SYSTEM" },
      });
    }

    // Rating + payment for completed/rated
    if (status === "rated" || status === "completed") {
      const overall = 3 + Math.floor(Math.random() * 3);
      await db.rating.create({
        data: {
          bookingId: booking.id,
          customerId: cust.id,
          workerId: worker.id,
          punctuality: overall,
          professionalism: overall,
          cleanliness: overall,
          friendliness: overall,
          overall,
          comment: overall >= 5 ? "Excellent service!" : "Good work overall.",
        },
      });
      await db.paymentIntent.create({
        data: {
          bookingId: booking.id,
          customerId: cust.id,
          payswapPaymentIntentId: `psw_pi_seed_${booking.id.slice(-6)}`,
          amountMinor: booking.totalMinor,
          currency: "GHS",
          status: "succeeded",
          capturedAt: new Date(start.getTime() + 30 * 60 * 1000),
          description: `Booking ${booking.code}`,
        },
      });
    }

    // Domain event
    await db.domainEvent.create({
      data: {
        bookingId: booking.id,
        eventType: "booking.created",
        payloadJson: JSON.stringify({ code: booking.code, service: svc.code }),
        actorId: cust.userId,
        actorType: "CUSTOMER",
      },
    });
  }

  // -- A few active subscriptions
  for (let i = 0; i < 4; i++) {
    const cust = customers[i];
    const plan = await db.subscriptionPlan.findFirst({ where: { name: { contains: "Weekly Home" } } });
    if (plan) {
      await db.subscription.create({
        data: {
          customerId: cust.id,
          planId: plan.id,
          payswapSubscriptionId: `psw_sub_seed_${i}`,
          status: "ACTIVE",
          startDate: new Date(now - 30 * 24 * 60 * 60 * 1000),
          nextBillingDate: new Date(now + 7 * 24 * 60 * 60 * 1000),
          autoRenew: true,
        },
      });
    }
  }

  // -- Laundry orders
  const completedBookings = await db.booking.findMany({
    where: { serviceType: { code: "LAUNDRY_PICKUP" } },
    take: 4,
  });
  for (const b of completedBookings) {
    await db.laundryOrder.create({
      data: {
        bookingId: b.id,
        totalGarments: 8 + Math.floor(Math.random() * 12),
        totalWeightKg: 3 + Math.random() * 5,
        status: ["PICKUP_PENDING", "WASHING", "IRONING", "DELIVERED"][Math.floor(Math.random() * 4)],
      },
    });
  }

  // -- Waste schedules
  for (let i = 0; i < 3; i++) {
    await db.wasteSchedule.create({
      data: {
        zoneCode: `ZONE-${String.fromCharCode(65 + i)}`,
        pickupDay: 1 + i,
        pickupWindow: "06:00-10:00",
        wasteCategories: "ORGANIC,RECYCLABLE,GENERAL",
        isActive: true,
        nextPickupDate: new Date(now + (1 + i) * 24 * 60 * 60 * 1000),
      },
    });
  }

  // -- Sales leads
  for (let i = 0; i < 5; i++) {
    await db.lead.create({
      data: {
        salesAgentId: sa1.id,
        name: `Prospect ${i + 1}`,
        phone: `+23324${Math.floor(1000000 + Math.random() * 8999999)}`,
        email: `prospect${i + 1}@example.com`,
        address: `${100 + i} Oxford Street`,
        source: "DOOR_TO_DOOR",
        status: ["NEW", "CONTACTED", "INTERESTED", "CONVERTED", "LOST"][i],
      },
    });
  }

  // -- Audit logs
  for (let i = 0; i < 10; i++) {
    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: ["user.login", "booking.create", "worker.approve", "subscription.create"][i % 4],
        resourceType: "System",
        outcome: "SUCCESS",
        ipAddress: "127.0.0.1",
      },
    });
  }

  console.log("✅ Seed complete");
  console.log(`   Users: ${await db.user.count()}`);
  console.log(`   Customers: ${await db.customer.count()}`);
  console.log(`   Workers: ${await db.worker.count()}`);
  console.log(`   Service Types: ${await db.serviceType.count()}`);
  console.log(`   Bookings: ${await db.booking.count()}`);
  console.log(`   Subscriptions: ${await db.subscription.count()}`);
  console.log(`   Inventory Items: ${await db.inventoryItem.count()}`);
  console.log(`   Audit Logs: ${await db.auditLog.count()}`);
  console.log(`   Domain Events: ${await db.domainEvent.count()}`);
  console.log("");
  console.log("Login accounts:");
  console.log("  Real admin:    ekontetevi@gmail / Payswap123456  (non-demo, can approve waitlist)");
  console.log("  Demo admin:    admin@eksclean.example / EksClean123!");
  console.log("  Demo FM:       fm1@eksclean.example / EksClean123!");
  console.log("  Demo Sales:    sales1@eksclean.example / EksClean123!");
  console.log("  Demo Customer: adwoa@example.com / EksClean123!");
  console.log("  Demo Worker:   samuel.w@eksclean.example / EksClean123!");
  console.log("");
  console.log(`Waitlist: ${await db.waitlistEntry.count()} entries (5 seeded: 4 PENDING + 1 REJECTED)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
