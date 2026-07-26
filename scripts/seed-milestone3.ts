/**
 * Milestone 3 seed — Multi-tenancy, Geographic, Property Twin, Workflow v2, Pricing.
 * Run AFTER scripts/seed.ts + scripts/seed-erp.ts + scripts/seed-milestone2.ts.
 */

import { db } from "../src/lib/db";

async function main() {
  console.log("🌱 Seeding Milestone 3 architectural foundations...");

  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) { console.error("Run scripts/seed.ts first."); process.exit(1); }

  // =========================================================================
  //  1. Multi-Tenancy — create the default organization (Eks-Clean itself)
  // =========================================================================
  console.log("  → Multi-Tenancy");
  const org = await db.organization.create({
    data: {
      code: "EKS-CLEAN",
      name: "Eks-Clean",
      legalName: "Eks-Clean Services Ltd",
      billingEmail: "billing@eksclean.example",
      country: "Ghana",
      currency: "GHS",
      timezone: "Africa/Accra",
      plan: "ENTERPRISE",
    },
  });
  console.log(`   Created organization: ${org.name} (${org.id})`);

  // Assign all existing users to this org
  await db.user.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
  await db.customer.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
  await db.worker.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
  await db.serviceType.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
  await db.booking.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
  await db.subscription.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
  await db.inventoryItem.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
  await db.vehicle.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
  await db.enterpriseContract.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
  await db.supplier.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } });
  console.log("   Assigned all existing entities to org");

  // Create branches + areas
  const accraBranch = await db.branch.create({
    data: { organizationId: org.id, code: "ACCRA", name: "Accra Main", address: "Spintex Road, Accra", phone: "+233241234567", managerUserId: admin.id },
  });
  await db.area.create({
    data: { organizationId: org.id, branchId: accraBranch.id, code: "SPINTEX", name: "Spintex Area", managerUserId: admin.id },
  });
  await db.area.create({
    data: { organizationId: org.id, branchId: accraBranch.id, code: "EAST-LEGON", name: "East Legon Area", managerUserId: admin.id },
  });

  // =========================================================================
  //  2. Geographic Intelligence — Ghana → Greater Accra → Accra → districts
  // =========================================================================
  console.log("  → Geographic Intelligence");
  const ghana = await db.geoCountry.create({ data: { code: "GH", name: "Ghana", currency: "GHS", phoneCode: "+233", timezone: "Africa/Accra" } });
  const greaterAccra = await db.geoRegion.create({ data: { countryId: ghana.id, code: "GA", name: "Greater Accra" } });
  const accraCity = await db.geoCity.create({ data: { regionId: greaterAccra.id, code: "ACCRA", name: "Accra", latitude: 5.6037, longitude: -0.1870 } });
  const legrandDist = await db.geoDistrict.create({ data: { cityId: accraCity.id, code: "EAST", name: "East Accra" } });
  const spintexNbr = await db.geoNeighborhood.create({ data: { districtId: legrandDist.id, code: "SPINTEX", name: "Spintex", latitude: 5.6375, longitude: -0.1497 } });
  const eastLegonNbr = await db.geoNeighborhood.create({ data: { districtId: legrandDist.id, code: "EAST-LEGON", name: "East Legon", latitude: 5.6458, longitude: -0.1699 } });

  // Zones with demand scores + pricing multipliers + traffic models
  await db.geoZone.create({
    data: {
      organizationId: org.id, neighborhoodId: spintexNbr.id, code: "ZONE-SPINTEX", name: "Spintex Zone",
      coverageRadiusKm: 8, centerLatitude: 5.6375, centerLongitude: -0.1497,
      trafficModelJson: JSON.stringify({ off_peak: 35, morning_peak: 18, evening_peak: 15, night: 40 }),
      demandScore: 0.7, pricingMultiplier: 1.1,
    },
  });
  await db.geoZone.create({
    data: {
      organizationId: org.id, neighborhoodId: eastLegonNbr.id, code: "ZONE-EAST-LEGON", name: "East Legon Zone",
      coverageRadiusKm: 7, centerLatitude: 5.6458, centerLongitude: -0.1699,
      trafficModelJson: JSON.stringify({ off_peak: 32, morning_peak: 16, evening_peak: 14, night: 38 }),
      demandScore: 0.85, pricingMultiplier: 1.25, // premium area
    },
  });

  // =========================================================================
  //  3. Property Digital Twin — create properties for existing customers
  // =========================================================================
  console.log("  → Property Digital Twin");
  const customers = await db.customer.findMany({ take: 5, include: { addresses: true } });
  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const property = await db.property.create({
      data: {
        organizationId: org.id,
        customerId: c.id,
        name: i === 0 ? "Main House" : `Property ${i + 1}`,
        propertyType: ["HOUSE", "APARTMENT", "TOWNHOUSE"][i % 3],
        addressId: c.addresses[0]?.id,
        bedrooms: 2 + (i % 4),
        bathrooms: 1 + (i % 3),
        squareMeters: 80 + i * 40,
        floors: 1 + (i % 3),
        hasPets: i % 3 === 0,
        hasChildren: i % 2 === 0,
        parkingAvailable: i % 2 === 0,
      },
    });

    // Add rooms
    const rooms = [
      { name: "Master Bedroom", roomType: "BEDROOM", floor: 1 },
      { name: "Kitchen", roomType: "KITCHEN", floor: 1 },
      { name: "Living Room", roomType: "LIVING_ROOM", floor: 1 },
      { name: "Bathroom", roomType: "BATHROOM", floor: 1 },
    ];
    for (const r of rooms) {
      const room = await db.room.create({ data: { propertyId: property.id, ...r, areaSqM: 15 + Math.random() * 20 } });
      // Add surfaces to each room
      if (r.roomType === "KITCHEN") {
        await db.surface.create({ data: { roomId: room.id, surfaceType: "TILES", location: "Floor", condition: "GOOD" } });
        await db.surface.create({ data: { roomId: room.id, surfaceType: "GRANITE", location: "Countertop", condition: "GOOD" } });
      } else if (r.roomType === "BATHROOM") {
        await db.surface.create({ data: { roomId: room.id, surfaceType: "TILES", location: "Walls", condition: i % 2 === 0 ? "FAIR" : "GOOD" } });
      } else {
        await db.surface.create({ data: { roomId: room.id, surfaceType: i === 0 ? "WOOD" : "LAMINATE", location: "Floor", condition: "GOOD" } });
      }
      // Add furniture
      if (r.roomType === "LIVING_ROOM") {
        await db.furniture.create({ data: { roomId: room.id, name: "Sofa", material: "FABRIC", quantity: 1, condition: "GOOD" } });
        await db.furniture.create({ data: { roomId: room.id, name: "Coffee Table", material: "WOOD", quantity: 1, condition: "GOOD" } });
      } else if (r.roomType === "BEDROOM") {
        await db.furniture.create({ data: { roomId: room.id, name: "Bed", material: "WOOD", quantity: 1, condition: "GOOD" } });
      }
    }

    // Add appliances
    await db.appliance.create({ data: { propertyId: property.id, name: "Refrigerator", brand: "Samsung", location: "Kitchen" } });
    await db.appliance.create({ data: { propertyId: property.id, name: "Washing Machine", brand: "LG", location: "Utility Room" } });

    // Add timeline events
    await db.propertyTimelineEvent.create({
      data: { propertyId: property.id, eventType: "INSPECTION", title: "Initial property inspection", description: "Property assessed for cleaning needs", occurredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });
    await db.propertyTimelineEvent.create({
      data: { propertyId: property.id, eventType: "CLEANED", title: "Deep cleaning performed", description: "Full house deep clean", occurredAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    });

    // Add cleaning record
    await db.propertyCleaningRecord.create({
      data: {
        propertyId: property.id,
        cleanedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        durationMin: 180,
        roomsCleaned: 4,
        qualityScore: 85,
        productsUsed: JSON.stringify([{ itemId: "chem-1", quantity: 2 }]),
      },
    });

    // Update property's cleanliness score + next recommended clean
    await db.property.update({
      where: { id: property.id },
      data: {
        lastCleanedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        nextRecommendedCleanAt: new Date(Date.now()), // overdue
        cleanlinessScore: 85,
      },
    });
  }

  // =========================================================================
  //  4. Configurable Workflow Engine v2 — home cleaning workflow
  // =========================================================================
  console.log("  → Workflow Engine v2");
  const homeCleaningService = await db.serviceType.findFirst({ where: { code: "HOME_CLEANING" } });
  if (homeCleaningService) {
    const wf = await db.workflowDefinitionV2.create({
      data: {
        organizationId: org.id,
        key: "home-cleaning-v2",
        name: "Home Cleaning Workflow",
        description: "Configurable workflow for standard home cleaning",
        serviceTypeId: homeCleaningService.id,
        entityType: "BOOKING",
        estimatedDurationMin: 180,
      },
    });

    // Stage 1: Preparation
    const stage1 = await db.workflowStage.create({
      data: { workflowId: wf.id, order: 1, name: "Preparation", stageType: "PREPARATION", estimatedDurationMin: 15, isRequired: true },
    });
    const task1 = await db.workflowTask.create({
      data: { stageId: stage1.id, order: 1, title: "Arrive and greet customer", description: "Park, introduce yourself, confirm scope", estimatedDurationMin: 5, isRequired: true },
    });
    await db.workflowChecklist.create({ data: { taskId: task1.id, item: "Wear clean uniform", isRequired: true, order: 1 } });
    await db.workflowChecklist.create({ data: { taskId: task1.id, item: "Lay down protective mats", isRequired: true, order: 2 } });
    await db.workflowChecklist.create({ data: { taskId: task1.id, item: "Confirm cleaning scope with customer", isRequired: true, order: 3 } });

    // Stage 2: Execution
    const stage2 = await db.workflowStage.create({
      data: { workflowId: wf.id, order: 2, name: "Execution", stageType: "EXECUTION", estimatedDurationMin: 120, isRequired: true },
    });
    const task2 = await db.workflowTask.create({
      data: { stageId: stage2.id, order: 1, title: "Kitchen cleaning", description: "Degrease, sanitize, sweep, mop", estimatedDurationMin: 30, isRequired: true, requiresPhoto: true },
    });
    await db.workflowChecklist.create({ data: { taskId: task2.id, item: "Counters sanitized", isRequired: true, order: 1 } });
    await db.workflowChecklist.create({ data: { taskId: task2.id, item: "Sink cleaned", isRequired: true, order: 2 } });
    await db.workflowChecklist.create({ data: { taskId: task2.id, item: "Floor mopped", isRequired: true, order: 3 } });
    await db.workflowRequiredSkill.create({ data: { taskId: task2.id, skillCode: "SKILL-CHEMSAFE", minLevel: 2 } });
    await db.workflowRequiredProduct.create({ data: { taskId: task2.id, productCode: "CHEM-001", quantity: 0.5, unit: "LITER" } });
    await db.workflowQualityGate.create({ data: { taskId: task2.id, metric: "PHOTO_REQUIRED", failureAction: "BLOCK" } });
    await db.workflowQualityGate.create({ data: { taskId: task2.id, metric: "CHECKLIST_COMPLETE", failureAction: "BLOCK" } });

    const task3 = await db.workflowTask.create({
      data: { stageId: stage2.id, order: 2, title: "Bathroom sanitization", description: "Scrub tiles, sanitize toilet, clean mirror", estimatedDurationMin: 25, isRequired: true, requiresPhoto: true },
    });
    await db.workflowChecklist.create({ data: { taskId: task3.id, item: "Toilet sanitized", isRequired: true, order: 1 } });
    await db.workflowChecklist.create({ data: { taskId: task3.id, item: "Mirror spotless", isRequired: true, order: 2 } });
    await db.workflowRequiredSkill.create({ data: { taskId: task3.id, skillCode: "SKILL-CHEMSAFE", minLevel: 2 } });

    // Stage 3: Review / Handover
    const stage3 = await db.workflowStage.create({
      data: { workflowId: wf.id, order: 3, name: "Handover", stageType: "HANDOVER", estimatedDurationMin: 15, isRequired: true },
    });
    const task4 = await db.workflowTask.create({
      data: { stageId: stage3.id, order: 1, title: "Customer walk-through", description: "Walk through cleaned areas with customer", estimatedDurationMin: 10, isRequired: true },
    });
    await db.workflowChecklist.create({ data: { taskId: task4.id, item: "Customer signed off", isRequired: true, order: 1 } });
    await db.workflowApprovalRule.create({ data: { taskId: task4.id, approverRole: "CUSTOMER", autoApproveIfScoreGte: 90 } });
    await db.workflowQualityGate.create({ data: { taskId: task4.id, metric: "CUSTOMER_SIGNOFF", failureAction: "WARN" } });
  }

  // =========================================================================
  //  5. Dynamic Pricing Engine — pricing rules for each service type
  // =========================================================================
  console.log("  → Dynamic Pricing Engine");
  const services = await db.serviceType.findMany();
  for (const s of services) {
    await db.pricingRule.create({
      data: {
        organizationId: org.id,
        serviceTypeId: s.id,
        name: `Standard ${s.name} pricing`,
        basePriceMinor: s.basePriceMinor,
        priceUnit: s.priceUnit,
        priority: 100,
        distanceBaseKm: 10,
        distancePerKmMinor: 500, // ₵5/km
        urgencyMultiplier: 1.5,
        demandMultiplier: 1.3,
        scarcityMultiplier: 1.4,
        subscriptionDiscount: 0.1,
        promotionMultiplier: 1.0,
        holidayMultiplier: 2.0,
        nightSurchargeMinor: 2000, // ₵20 flat
        largePropertyMultiplier: 1.2,
        largePropertyThreshold: 200,
      },
    });
  }

  // Create a sample quote
  if (homeCleaningService) {
    await db.pricingQuote.create({
      data: {
        organizationId: org.id,
        serviceTypeId: homeCleaningService.id,
        basePriceMinor: 15000,
        distanceChargeMinor: 2500,
        urgencyChargeMinor: 7500,
        demandChargeMinor: 3000,
        scarcityChargeMinor: 0,
        subscriptionDiscountMinor: 1500,
        promotionDiscountMinor: 0,
        holidayChargeMinor: 0,
        nightSurchargeMinor: 0,
        largePropertyChargeMinor: 0,
        finalPriceMinor: 26500,
        currency: "GHS",
        breakdownJson: JSON.stringify({ factors: { distanceKm: 15, isUrgent: true, zoneDemandScore: 0.7, isSubscriber: true } }),
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log("✅ Milestone 3 seed complete");
  console.log(`   Organizations: ${await db.organization.count()}`);
  console.log(`   Branches: ${await db.branch.count()}, Areas: ${await db.area.count()}`);
  console.log(`   Geographic: ${await db.geoCountry.count()} countries, ${await db.geoZone.count()} zones`);
  console.log(`   Properties: ${await db.property.count()}, Rooms: ${await db.room.count()}, Surfaces: ${await db.surface.count()}`);
  console.log(`   Workflow v2: ${await db.workflowDefinitionV2.count()} workflows, ${await db.workflowStage.count()} stages, ${await db.workflowTask.count()} tasks`);
  console.log(`   Pricing: ${await db.pricingRule.count()} rules, ${await db.pricingQuote.count()} quotes`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
