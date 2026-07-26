/**
 * Eks-Clean ERP — Extended seed script for the 9 new modules.
 * Run AFTER the main `scripts/seed.ts` to populate CRM, Protocols, LMS,
 * SCM, Fleet, Contracts, Workflows, and Advanced Analytics demo data.
 */

import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

async function main() {
  console.log("🌱 Seeding Eks-Clean ERP modules...");

  // Need admin user (created by main seed)
  const admin = await db.user.findUnique({ where: { email: "admin@eksclean.example" } });
  if (!admin) {
    console.error("Run scripts/seed.ts first to create base users.");
    process.exit(1);
  }
  const customers = await db.customer.findMany({ take: 10 });
  const workers = await db.worker.findMany({ take: 15, include: { user: true } });
  const services = await db.serviceType.findMany();
  const homeCleaning = services.find((s) => s.code === "HOME_CLEANING")!;
  const officeCleaning = services.find((s) => s.code === "OFFICE_CLEANING")!;
  const deepCleaning = services.find((s) => s.code === "DEEP_CLEANING")!;

  // =========================================================================
  //  CRM — segments, deals, touchpoints, health scores
  // =========================================================================
  console.log("  → CRM");
  const goldSegment = await db.crmSegment.create({
    data: {
      name: "Gold Customers",
      description: "Customers with GOLD tier",
      rulesJson: JSON.stringify([{ field: "tier", op: "eq", value: "GOLD" }]),
      isDynamic: true,
    },
  });
  // Manually add gold-tier customers as members
  const goldCustomers = await db.customer.findMany({ where: { customerTier: "GOLD" } });
  if (goldCustomers.length > 0) {
    await db.crmSegmentMembership.createMany({
      data: goldCustomers.map((c) => ({ segmentId: goldSegment.id, customerId: c.id, reason: "tier_match" })),
    });
    await db.crmSegment.update({ where: { id: goldSegment.id }, data: { memberCount: goldCustomers.length } });
  }

  // Deals — pipeline across stages
  const dealStages = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON"] as const;
  for (let i = 0; i < 8; i++) {
    await db.crmDeal.create({
      data: {
        customerId: customers[i % customers.length].id,
        title: `Cleaning deal #${i + 1}`,
        valueMinor: 50000 + i * 10000,
        stage: dealStages[i % dealStages.length],
        probability: [0.1, 0.25, 0.5, 0.75, 1.0][i % 5],
        expectedCloseAt: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000),
        ownerAgentId: admin.id,
        ...(i === 7 ? { closedAt: new Date() } : {}),
      },
    });
  }

  // Touchpoints
  for (let i = 0; i < 15; i++) {
    await db.crmTouchpoint.create({
      data: {
        customerId: customers[i % customers.length].id,
        channel: ["EMAIL", "CALL", "WHATSAPP", "IN_PERSON"][i % 4],
        direction: i % 3 === 0 ? "INBOUND" : "OUTBOUND",
        subject: `Follow-up #${i + 1}`,
        body: "Checking in about your recent service.",
        agentId: admin.id,
        outcome: ["ANSWERED", "INTERESTED", "NO_ANSWER", "CONVERSION"][i % 4],
        occurredAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Health scores — compute simple scores
  for (const c of customers) {
    const score = 30 + Math.floor(Math.random() * 70);
    const tier = score >= 80 ? "CHAMPION" : score >= 60 ? "GOOD" : score >= 40 ? "OK" : "RISK";
    await db.customerHealthScore.create({
      data: {
        customerId: c.id,
        score,
        tier,
        factorsJson: JSON.stringify({ recency: 0.6, frequency: 0.4, spend: 0.5, engagement: 0.3, complaints: 0.9 }),
      },
    });
    await db.customerCrmRelations.upsert({
      where: { customerId: c.id },
      update: { healthScore: score, healthTier: tier, touchpointCount: 2, journeyStage: "ACTIVE" },
      create: { customerId: c.id, healthScore: score, healthTier: tier, touchpointCount: 2, journeyStage: "ACTIVE" },
    });
  }

  // =========================================================================
  //  Cleaning Protocols
  // =========================================================================
  console.log("  → Cleaning Protocols");
  const protocol = await db.cleaningProtocol.create({
    data: {
      code: "PROTO-HOME-001",
      name: "Standard Home Cleaning",
      description: "Complete home cleaning protocol covering all rooms",
      serviceTypeId: homeCleaning.id,
      surfaceCode: null,
      estimatedDurationMin: 180,
      safetyNotes: "Wear gloves when handling chemicals. Ventilate rooms.",
      createdBy: admin.id,
      steps: {
        create: [
          { order: 1, title: "Arrival & Setup", description: "Park, greet customer, lay down mats", expectedDurationMin: 10, requiresPhoto: false, ppeRequired: "GLOVES", qualityChecklist: '["Uniform on","Mats laid","Customer greeted"]' },
          { order: 2, title: "Kitchen Cleaning", description: "Degrease surfaces, sanitize counters, clean appliances exterior", expectedDurationMin: 45, requiresPhoto: true, ppeRequired: "GLOVES", equipmentRequired: "Microfiber cloths, spray bottles", qualityChecklist: '["Counters clean","Sink sanitized","Floor swept"]' },
          { order: 3, title: "Bathroom Sanitization", description: "Scrub tiles, sanitize toilet, clean mirror", expectedDurationMin: 30, requiresPhoto: true, ppeRequired: "GLOVES,GOGGLES", qualityChecklist: '["Toilet sanitized","Mirror spotless","Tiles scrubbed"]' },
          { order: 4, title: "Living Areas", description: "Dust, vacuum, mop floors", expectedDurationMin: 40, requiresPhoto: false, qualityChecklist: '["Dusted","Vacuumed","Mopped"]' },
          { order: 5, title: "Bedrooms", description: "Make beds, dust, vacuum", expectedDurationMin: 30, requiresPhoto: false, qualityChecklist: '["Beds made","Dusted","Vacuumed"]' },
          { order: 6, title: "Final Inspection & Handover", description: "Walk-through with customer, collect feedback", expectedDurationMin: 15, requiresPhoto: true, qualityChecklist: '["Customer signed off","Photos uploaded","Feedback collected"]' },
        ],
      },
    },
    include: { steps: true },
  });

  // Execute the protocol a few times
  const completedBookings = await db.booking.findMany({
    where: { status: "rated" },
    take: 3,
    include: { assignments: true },
  });
  for (const b of completedBookings) {
    const workerId = b.assignments[0]?.workerId;
    if (!workerId) continue;
    const execution = await db.protocolExecution.create({
      data: {
        bookingId: b.id,
        protocolId: protocol.id,
        workerId,
        status: "COMPLETED",
        startedAt: new Date(b.scheduledStart.getTime()),
        completedAt: new Date(b.scheduledEnd.getTime()),
        complianceScore: 85 + Math.random() * 15,
        stepExecutions: {
          create: protocol.steps.map((s) => ({
            stepId: s.id,
            status: "COMPLETED",
            startedAt: new Date(b.scheduledStart.getTime() + s.order * 10 * 60 * 1000),
            completedAt: new Date(b.scheduledStart.getTime() + (s.order + 1) * 10 * 60 * 1000),
            photoUrl: s.requiresPhoto ? `https://example.com/photos/${b.id}-${s.id}.jpg` : null,
            deviationFlag: Math.random() < 0.1,
            actualDurationMin: s.expectedDurationMin,
          })),
        },
      },
    });
  }

  // =========================================================================
  //  LMS — courses, lessons, exams, enrollments, certifications
  // =========================================================================
  console.log("  → LMS");
  const safetyCourse = await db.course.create({
    data: {
      code: "LMS-SAFETY-101",
      title: "Chemical Safety Basics",
      description: "Learn safe handling of cleaning chemicals",
      category: "SAFETY",
      difficulty: "BEGINNER",
      estimatedHours: 2,
      isActive: true,
      createdBy: admin.id,
    },
  });
  await db.lesson.createMany({
    data: [
      { courseId: safetyCourse.id, order: 1, title: "Introduction to Chemical Hazards", durationMin: 20, passingScorePercent: 70, contentMarkdown: "# Intro\n\nCleaning chemicals can be hazardous..." },
      { courseId: safetyCourse.id, order: 2, title: "Reading Safety Data Sheets", durationMin: 25, passingScorePercent: 70, contentMarkdown: "# SDS\n\nEvery chemical has an SDS..." },
      { courseId: safetyCourse.id, order: 3, title: "Proper PPE Usage", durationMin: 30, passingScorePercent: 70, contentMarkdown: "# PPE\n\nGloves, goggles, masks..." },
      { courseId: safetyCourse.id, order: 4, title: "Emergency Procedures", durationMin: 35, passingScorePercent: 70, contentMarkdown: "# Emergencies\n\nSpills, exposure, inhalation..." },
    ],
  });
  await db.exam.create({
    data: {
      courseId: safetyCourse.id,
      title: "Chemical Safety Final Exam",
      passingScorePercent: 70,
      timeLimitMin: 45,
      maxAttempts: 3,
      isFinal: true,
      questionsJson: JSON.stringify([
        { id: "q1", text: "What does SDS stand for?", type: "multiple_choice", options: ["Safety Data Sheet", "Standard Delivery System", "Surface Density Standard", "Sanitary Disinfection System"], correctAnswer: "Safety Data Sheet", points: 1 },
        { id: "q2", text: "Which PPE is required for handling strong acids?", type: "multiple_choice", options: ["Gloves only", "Gloves and goggles", "No PPE needed", "Mask only"], correctAnswer: "Gloves and goggles", points: 1 },
        { id: "q3", text: "True or False: Chemicals can be mixed to save time.", type: "true_false", options: ["True", "False"], correctAnswer: "False", points: 1 },
      ]),
    },
  });

  // Enroll workers and mark some as completed with certifications
  for (let i = 0; i < 10; i++) {
    const w = workers[i];
    const status = i < 5 ? "COMPLETED" : i < 8 ? "IN_PROGRESS" : "NOT_STARTED";
    const cert = i < 5 ? await db.certification.create({
      data: {
        workerId: w.id,
        courseId: safetyCourse.id,
        certificateNumber: `EKS-CERT-SAFETY-${1000 + i}`,
        issuedAt: new Date(Date.now() - (5 - i) * 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + (365 - (5 - i) * 30) * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
        issuedBy: admin.id,
      },
    }) : null;
    await db.enrollment.create({
      data: {
        workerId: w.id,
        courseId: safetyCourse.id,
        status,
        enrolledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        startedAt: status !== "NOT_STARTED" ? new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) : null,
        completedAt: status === "COMPLETED" ? new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) : null,
        finalScorePercent: status === "COMPLETED" ? 75 + Math.floor(Math.random() * 25) : null,
        certificateId: cert?.id,
        assignedBy: admin.id,
      },
    });
    if (cert) {
      await db.recertificationSchedule.create({
        data: {
          certificationId: cert.id,
          dueAt: new Date(cert.expiresAt!.getTime() - 30 * 24 * 60 * 60 * 1000),
          status: "SCHEDULED",
        },
      });
    }
  }

  // =========================================================================
  //  SCM — suppliers, POs, receipts
  // =========================================================================
  console.log("  → Supply Chain");
  const supplier1 = await db.supplier.create({
    data: { code: "SUP-001", name: "Accra Chemical Supplies Ltd", contactName: "John Mensah", email: "john@accrachem.com", phone: "+23324123456", paymentTerms: "NET_30", rating: 4.5 },
  });
  const supplier2 = await db.supplier.create({
    data: { code: "SUP-002", name: "Ghana Equipment Co", contactName: "Sarah Owusu", email: "sarah@ghanaequip.com", phone: "+23324654321", paymentTerms: "NET_15", rating: 4.2 },
  });

  // Get some inventory items
  const chemicals = await db.inventoryItem.findMany({ where: { category: "CHEMICAL" }, take: 3 });
  const tools = await db.inventoryItem.findMany({ where: { category: "TOOL" }, take: 2 });
  if (chemicals.length > 0) {
    await db.purchaseOrder.create({
      data: {
        code: `PO-2026-100001`,
        supplierId: supplier1.id,
        warehouseCode: "MAIN",
        status: "SENT",
        expectedDeliveryAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        subtotalMinor: 250000,
        taxMinor: 12500,
        shippingMinor: 5000,
        totalMinor: 267500,
        placedBy: admin.id,
        lines: {
          create: chemicals.map((c, i) => ({
            itemId: c.id,
            quantity: 20 + i * 5,
            unitCostMinor: 25000 + i * 5000,
            totalMinor: (20 + i * 5) * (25000 + i * 5000),
          })),
        },
      },
    });
  }
  if (tools.length > 0) {
    await db.purchaseOrder.create({
      data: {
        code: `PO-2026-100002`,
        supplierId: supplier2.id,
        warehouseCode: "MAIN",
        status: "RECEIVED",
        actualDeliveryAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        subtotalMinor: 150000,
        taxMinor: 7500,
        shippingMinor: 3000,
        totalMinor: 160500,
        placedBy: admin.id,
        approvedBy: admin.id,
        lines: {
          create: tools.map((t, i) => ({
            itemId: t.id,
            quantity: 10 + i * 5,
            receivedQty: 10 + i * 5,
            unitCostMinor: 30000,
            totalMinor: (10 + i * 5) * 30000,
          })),
        },
      },
    });
  }

  // =========================================================================
  //  Fleet — vehicles, fuel, maintenance
  // =========================================================================
  console.log("  → Fleet");
  const vehicles = [
    { plateNumber: "GR-1234-A", make: "Toyota", model: "Hilux", year: 2022, type: "TRUCK", mileageKm: 45000 },
    { plateNumber: "GR-5678-B", make: "Honda", model: "CG125", year: 2023, type: "MOTORBIKE", mileageKm: 12000 },
    { plateNumber: "GR-9012-C", make: "Yamaha", model: "YZF", year: 2023, type: "MOTORBIKE", mileageKm: 8000 },
    { plateNumber: "GR-3456-D", make: "Nissan", model: "Urvan", year: 2021, type: "VAN", mileageKm: 78000 },
  ];
  for (const v of vehicles) {
    await db.vehicle.create({
      data: {
        ...v,
        status: "ACTIVE",
        fuelLevelPercent: 60 + Math.random() * 40,
        nextServiceKm: v.mileageKm + 5000,
        nextServiceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        insuranceExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        roadworthyExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
  }
  // Fuel logs for first vehicle
  const firstVehicle = await db.vehicle.findFirst();
  if (firstVehicle) {
    for (let i = 0; i < 5; i++) {
      await db.fuelLog.create({
        data: {
          vehicleId: firstVehicle.id,
          at: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
          liters: 30 + Math.random() * 20,
          costMinor: 120000 + Math.floor(Math.random() * 50000),
          odometerKm: firstVehicle.mileageKm - i * 200,
          stationName: "Goil Spintex",
        },
      });
    }
  }

  // =========================================================================
  //  Enterprise Contracts
  // =========================================================================
  console.log("  → Enterprise Contracts");
  const businessCustomers = customers.slice(0, 3);
  for (let i = 0; i < businessCustomers.length; i++) {
    const c = businessCustomers[i];
    await db.enterpriseContract.create({
      data: {
        contractNumber: `EKS-ENT-2026-${1000 + i}`,
        customerId: c.id,
        title: `Annual cleaning contract ${i + 1}`,
        description: "Weekly office cleaning + monthly deep clean",
        status: "ACTIVE",
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 275 * 24 * 60 * 60 * 1000),
        slaTier: ["STANDARD", "PREMIUM", "ENTERPRISE"][i],
        autoRenew: true,
        renewalPeriodMonths: 12,
        accountManagerId: admin.id,
        signedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        signedBy: admin.id,
        totalContractValueMinor: 500000 + i * 200000,
        lines: {
          create: [
            { serviceTypeId: officeCleaning.id, billingCycle: "WEEKLY", unitPriceMinor: 5000, minimumVolume: 4, includedVolume: 4, overagePriceMinor: 6000 },
            { serviceTypeId: deepCleaning.id, billingCycle: "MONTHLY", unitPriceMinor: 15000, minimumVolume: 1, includedVolume: 1, overagePriceMinor: 18000 },
          ],
        },
        slas: {
          create: [
            { metric: "RESPONSE_TIME", targetHours: 24, penaltyPercent: 5 },
            { metric: "QUALITY_SCORE", targetPercent: 0.9, penaltyPercent: 10 },
          ],
        },
        billingSchedule: {
          create: Array.from({ length: 6 }).map((_, m) => ({
            periodStart: new Date(Date.now() + (m - 3) * 30 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(Date.now() + (m - 2) * 30 * 24 * 60 * 60 * 1000),
            amountMinor: 80000,
            status: m < 3 ? "PAID" : "SCHEDULED",
            paidAt: m < 3 ? new Date(Date.now() + (m - 3) * 30 * 24 * 60 * 60 * 1000) : null,
          })),
        },
      },
    });
  }

  // =========================================================================
  //  Workflow Engine — definitions + instances
  // =========================================================================
  console.log("  → Workflows");
  await db.workflowDefinition.create({
    data: {
      key: "booking.lifecycle",
      name: "Booking Lifecycle",
      description: "Default state machine for service bookings",
      entityType: "BOOKING",
      isActive: true,
      createdBy: admin.id,
      statesJson: JSON.stringify([
        { key: "draft", label: "Draft", isInitial: true, color: "gray" },
        { key: "requested", label: "Requested", color: "blue" },
        { key: "assigned", label: "Assigned", color: "indigo" },
        { key: "in_progress", label: "In Progress", color: "purple" },
        { key: "completed", label: "Completed", isFinal: true, color: "green" },
        { key: "cancelled", label: "Cancelled", isFinal: true, color: "red" },
      ]),
      transitionsJson: JSON.stringify([
        { from: "draft", to: "requested", key: "submit", label: "Submit" },
        { from: "requested", to: "assigned", key: "assign", label: "Auto-Assign" },
        { from: "assigned", to: "in_progress", key: "start", label: "Start" },
        { from: "in_progress", to: "completed", key: "complete", label: "Complete" },
        { from: "requested", to: "cancelled", key: "cancel", label: "Cancel" },
        { from: "assigned", to: "cancelled", key: "cancel", label: "Cancel" },
      ]),
      actions: {
        create: [
          { transitionKey: "complete", actionType: "EMAIL", name: "Send receipt", configJson: JSON.stringify({ template: "booking_receipt" }), order: 1, isAsync: true, timeoutSec: 30 },
          { transitionKey: "complete", actionType: "AI_FORECAST", name: "Update demand forecast", configJson: JSON.stringify({ horizon_days: 14 }), order: 2, isAsync: true, timeoutSec: 60 },
          { transitionKey: "cancel", actionType: "PAYMENT_REFUND", name: "Initiate refund", configJson: JSON.stringify({ full: true }), order: 1, isAsync: true, timeoutSec: 45 },
        ],
      },
      triggers: {
        create: [
          { eventPattern: "booking.created", conditionsJson: null, actionIdsJson: null, isEnabled: true },
        ],
      },
    },
  });

  await db.workflowDefinition.create({
    data: {
      key: "contract.lifecycle",
      name: "Enterprise Contract Lifecycle",
      entityType: "CONTRACT",
      isActive: true,
      createdBy: admin.id,
      statesJson: JSON.stringify([
        { key: "draft", label: "Draft", isInitial: true },
        { key: "sent", label: "Sent" },
        { key: "active", label: "Active" },
        { key: "expiring", label: "Expiring" },
        { key: "expired", label: "Expired", isFinal: true },
        { key: "terminated", label: "Terminated", isFinal: true },
      ]),
      transitionsJson: JSON.stringify([
        { from: "draft", to: "sent", key: "send" },
        { from: "sent", to: "active", key: "activate" },
        { from: "active", to: "expiring", key: "near_expiry" },
        { from: "expiring", to: "expired", key: "expire" },
        { from: "active", to: "terminated", key: "terminate" },
      ]),
    },
  });

  // Create a workflow instance for an existing booking
  const sampleBooking = await db.booking.findFirst({ where: { status: "in_progress" } });
  if (sampleBooking) {
    const def = await db.workflowDefinition.findUnique({ where: { key: "booking.lifecycle" } });
    if (def) {
      await db.workflowInstance.create({
        data: {
          definitionId: def.id,
          entityType: "BOOKING",
          entityId: sampleBooking.id,
          currentState: "in_progress",
          contextJson: JSON.stringify({ bookingCode: sampleBooking.code }),
        },
      });
    }
  }

  // =========================================================================
  //  Advanced Analytics — saved view + snapshots
  // =========================================================================
  console.log("  → Advanced Analytics");
  await db.analyticsView.create({
    data: {
      name: "Operations Overview",
      description: "Key operational metrics for daily review",
      ownerId: admin.id,
      scope: "GLOBAL",
      isPublic: true,
      configJson: JSON.stringify([
        { widgetType: "kpi", dataSource: "bookings", params: { metric: "completion_rate" } },
        { widgetType: "chart", dataSource: "revenue", params: { days: 30 } },
        { widgetType: "table", dataSource: "bookings", params: { status: "disputed" } },
      ]),
    },
  });
  await db.analyticsReport.create({
    data: {
      name: "Weekly Operations Report",
      schedule: "WEEKLY",
      recipientsJson: JSON.stringify(["admin@eksclean.example"]),
      configJson: JSON.stringify({ include: ["bookings", "revenue", "ratings"] }),
      format: "PDF",
      nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: true,
      createdBy: admin.id,
    },
  });

  // Snapshots — last 7 days of revenue
  for (let i = 0; i < 7; i++) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await db.analyticsSnapshot.create({
      data: {
        metricKey: "revenue.daily",
        period: day,
        periodType: "DAY",
        value: 20000 + Math.random() * 80000,
      },
    });
  }

  console.log("✅ ERP seed complete");
  console.log(`   CRM: ${await db.crmDeal.count()} deals, ${await db.crmTouchpoint.count()} touchpoints, ${await db.customerHealthScore.count()} health scores`);
  console.log(`   Protocols: ${await db.cleaningProtocol.count()} protocols, ${await db.protocolExecution.count()} executions`);
  console.log(`   LMS: ${await db.course.count()} courses, ${await db.enrollment.count()} enrollments, ${await db.certification.count()} certifications`);
  console.log(`   SCM: ${await db.supplier.count()} suppliers, ${await db.purchaseOrder.count()} POs`);
  console.log(`   Fleet: ${await db.vehicle.count()} vehicles`);
  console.log(`   Contracts: ${await db.enterpriseContract.count()} contracts`);
  console.log(`   Workflows: ${await db.workflowDefinition.count()} definitions, ${await db.workflowInstance.count()} instances`);
  console.log(`   Analytics: ${await db.analyticsView.count()} views, ${await db.analyticsSnapshot.count()} snapshots`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
