/** Milestone 4 seed — Enterprise, Work Orders, Assets, Rules */
import { db } from "../src/lib/db";

async function main() {
  console.log("🌱 Seeding Milestone 4...");
  const org = await db.organization.findFirst();
  if (!org) { console.error("Run seed-milestone3.ts first."); process.exit(1); }
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  const customers = await db.customer.findMany({ take: 3 });

  // Enterprise
  console.log("  → Enterprise");
  const ent = await db.enterprise.create({ data: { organizationId: org.id, name: "Acme Corp", legalName: "Acme Corporation Ltd", taxId: "GV-12345", industry: "Technology", size: "LARGE" } });
  const dept = await db.department.create({ data: { enterpriseId: ent.id, name: "Facilities", code: "FAC" } });
  const cc = await db.costCenter.create({ data: { enterpriseId: ent.id, departmentId: dept.id, code: "CC-FAC-01", name: "Cleaning Budget", budgetAnnualMinor: 5000000 } });
  await db.budgetOwner.create({ data: { costCenterId: cc.id, userId: admin!.id, allocationMinor: 5000000, approvalLimitMinor: 100000 } });
  await db.enterpriseApprover.create({ data: { enterpriseId: ent.id, userId: admin!.id, approvalLevel: 1, maxApprovalMinor: 500000 } });
  await db.enterprisePurchaseOrder.create({ data: { enterpriseId: ent.id, costCenterId: cc.id, code: `EPO-2026-${Math.floor(Math.random()*90000+10000)}`, title: "Quarterly cleaning supplies", totalMinor: 350000, status: "APPROVED", requestedBy: admin!.id, approvedBy: admin!.id, approvedAt: new Date(), itemsJson: JSON.stringify([{ description: "Chemicals bulk order", quantity: 50, unitPriceMinor: 5000 }]) } });
  await db.enterprisePurchaseOrder.create({ data: { enterpriseId: ent.id, costCenterId: cc.id, code: `EPO-2026-${Math.floor(Math.random()*90000+10000)}`, title: "New vacuum cleaners", totalMinor: 150000, status: "SUBMITTED", requestedBy: admin!.id, itemsJson: JSON.stringify([{ description: "Industrial vacuum", quantity: 3, unitPriceMinor: 50000 }]) } });

  // Work Orders
  console.log("  → Work Orders");
  for (let i = 0; i < 5; i++) {
    const wo = await db.workOrder.create({ data: { organizationId: org.id, code: `WO-2026-${Math.floor(Math.random()*90000+10000)}`, title: `Work Order #${i+1}`, workOrderType: ["CLEANING","MAINTENANCE","INSPECTION"][i%3], status: ["OPEN","ASSIGNED","IN_PROGRESS","COMPLETED","COMPLETED"][i], priority: ["NORMAL","HIGH","URGENT","NORMAL","LOW"][i], customerId: customers[i%customers.length].id, estimatedCostMinor: 20000 + i*5000, scheduledStart: new Date(Date.now() + i*24*60*60*1000) } });
    await db.workOrderStatusHistory.create({ data: { workOrderId: wo.id, toStatus: "OPEN", changedByType: "SYSTEM" } });
    if (wo.status === "COMPLETED") { await db.workOrderInspection.create({ data: { workOrderId: wo.id, inspectedBy: admin!.id, inspectionType: "QUALITY", score: 85+i*2, passed: true, findings: "All checks passed" } }); }
    await db.workOrderTask.create({ data: { workOrderId: wo.id, order: 1, title: "Initial assessment", status: i >= 3 ? "COMPLETED" : "PENDING", completedAt: i >= 3 ? new Date() : null } });
  }

  // Assets
  console.log("  → Assets");
  const building = await db.asset.create({ data: { organizationId: org.id, code: "BLD-001", name: "Head Office Building", assetType: "BUILDING", location: "Spintex, Accra", purchaseCostMinor: 2000000, currentValueMinor: 1800000, maintenanceIntervalDays: 365 } });
  const hvac = await db.asset.create({ data: { organizationId: org.id, parentAssetId: building.id, code: "HVAC-001", name: "Main HVAC System", assetType: "HVAC", manufacturer: "Daikin", model: "RXYQ24", serialNumber: "DK-2023-45678", purchaseCostMinor: 300000, currentValueMinor: 250000, maintenanceIntervalDays: 90, nextMaintenanceAt: new Date(Date.now() - 5*24*60*60*1000) } });
  const vehicle = await db.asset.create({ data: { organizationId: org.id, code: "VEH-001", name: "Toyota Hilux", assetType: "VEHICLE", manufacturer: "Toyota", model: "Hilux", serialNumber: "GR-1234-A", purchaseCostMinor: 400000, currentValueMinor: 300000, maintenanceIntervalDays: 180, nextMaintenanceAt: new Date(Date.now() + 30*24*60*60*1000) } });
  await db.assetMaintenance.create({ data: { assetId: hvac.id, maintenanceType: "PREVENTIVE", status: "COMPLETED", completedAt: new Date(Date.now() - 90*24*60*60*1000), performedBy: admin!.id, description: "Filter replacement", costMinor: 5000, findings: "Filters replaced, system running well" } });
  await db.assetMaintenance.create({ data: { assetId: hvac.id, maintenanceType: "PREVENTIVE", status: "SCHEDULED", scheduledAt: new Date(Date.now() - 5*24*60*60*1000), description: "Quarterly inspection" } });

  // Rules Engine
  console.log("  → Rules Engine");
  await db.rule.create({
    data: {
      organizationId: org.id, name: "Low Rating Alert", description: "If customer rates below 3, create QA inspection + notify manager",
      triggerEvent: "booking.rated", triggerType: "EVENT", priority: 50, isActive: true, createdBy: admin!.id,
      conditions: { create: [{ order: 0, field: "rating.overall", operator: "LT", valueJson: "3", logicOperator: "AND" }] },
      actions: { create: [
        { order: 0, actionType: "CREATE_INSPECTION", name: "Create QA inspection", configJson: JSON.stringify({ type: "QUALITY", priority: "HIGH" }), isAsync: false },
        { order: 1, actionType: "NOTIFY", name: "Notify manager", configJson: JSON.stringify({ role: "FIELD_MANAGER", message: "Low rating received" }), isAsync: true },
        { order: 2, actionType: "APPLY_DISCOUNT", name: "Offer 10% discount", configJson: JSON.stringify({ percent: 10 }), isAsync: false },
      ] },
    },
  });
  await db.rule.create({
    data: {
      organizationId: org.id, name: "Overdue Maintenance Alert", description: "If asset maintenance is overdue, notify manager",
      triggerEvent: "asset.maintenance_overdue", triggerType: "SCHEDULED", priority: 75, isActive: true, createdBy: admin!.id,
      conditions: { create: [{ order: 0, field: "daysOverdue", operator: "GT", valueJson: "0", logicOperator: "AND" }] },
      actions: { create: [{ order: 0, actionType: "NOTIFY", name: "Notify facilities manager", configJson: JSON.stringify({ role: "FIELD_MANAGER", message: "Asset maintenance overdue" }), isAsync: true }] },
    },
  });

  console.log("✅ Milestone 4 seed complete");
  console.log(`   Enterprises: ${await db.enterprise.count()}, Departments: ${await db.department.count()}, Cost Centers: ${await db.costCenter.count()}, POs: ${await db.enterprisePurchaseOrder.count()}`);
  console.log(`   Work Orders: ${await db.workOrder.count()}, Inspections: ${await db.workOrderInspection.count()}`);
  console.log(`   Assets: ${await db.asset.count()}, Maintenance: ${await db.assetMaintenance.count()}`);
  console.log(`   Rules: ${await db.rule.count()}`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
