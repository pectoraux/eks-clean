/**
 * ============================================================================
 *  Fleet Management — vehicles, maintenance, fuel, inspections, assignments
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

export async function createVehicle(input: {
  plateNumber: string; make: string; model: string; year: number; type: string; color?: string; vin?: string;
}) {
  const existing = await db.vehicle.findUnique({ where: { plateNumber: input.plateNumber } });
  if (existing) throw conflict("Plate number already registered");
  return db.vehicle.create({ data: input });
}

export async function assignVehicle(vehicleId: string, workerId: string, purpose?: string, startingMileageKm?: number) {
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw notFound("Vehicle not found");
  if (vehicle.status !== "ACTIVE") throw badRequest("Vehicle not active");

  // End any existing active assignment
  await db.vehicleAssignment.updateMany({
    where: { vehicleId, returnedAt: null },
    data: { returnedAt: new Date() },
  });

  const assignment = await db.vehicleAssignment.create({
    data: { vehicleId, workerId, purpose, startingMileageKm: startingMileageKm ?? vehicle.mileageKm },
  });

  await db.vehicle.update({
    where: { id: vehicleId },
    data: { assignedWorkerId: workerId },
  });

  await publish({ eventType: "fleet.vehicle_assigned", payload: { vehicleId, workerId } });
  return assignment;
}

export async function returnVehicle(assignmentId: string, endingMileageKm: number, notes?: string) {
  const assignment = await db.vehicleAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw notFound("Assignment not found");
  if (assignment.returnedAt) throw conflict("Already returned");

  const updated = await db.vehicleAssignment.update({
    where: { id: assignmentId },
    data: { returnedAt: new Date(), endingMileageKm, notes },
  });

  // Update vehicle mileage
  await db.vehicle.update({
    where: { id: assignment.vehicleId },
    data: { mileageKm: endingMileageKm, assignedWorkerId: null },
  });

  return updated;
}

export async function logFuel(vehicleId: string, input: {
  liters: number; costMinor: number; odometerKm: number; fuelType?: string; stationName?: string; filledBy?: string; notes?: string;
}) {
  const fuel = await db.fuelLog.create({
    data: { vehicleId, ...input },
  });
  await db.vehicle.update({
    where: { id: vehicleId },
    data: { mileageKm: input.odometerKm, fuelLevelPercent: 100 },
  });
  await publish({ eventType: "fleet.fuel_logged", payload: { vehicleId, liters: input.liters } });
  return fuel;
}

export async function scheduleMaintenance(vehicleId: string, input: {
  scheduledAt?: Date; type: string; description?: string; odometerKm?: number; vendorName?: string;
}) {
  const m = await db.vehicleMaintenance.create({
    data: { vehicleId, status: "SCHEDULED", ...input },
  });
  // Mark vehicle in maintenance if scheduled soon
  await db.vehicle.update({
    where: { id: vehicleId },
    data: { status: "MAINTENANCE" },
  });
  await publish({ eventType: "fleet.maintenance_scheduled", payload: { vehicleId, maintenanceId: m.id } });
  return m;
}

export async function completeMaintenance(maintenanceId: string, input: {
  costMinor: number; odometerKm?: number; performedBy?: string; notes?: string;
}) {
  const m = await db.vehicleMaintenance.findUnique({ where: { id: maintenanceId } });
  if (!m) throw notFound("Maintenance record not found");

  const updated = await db.vehicleMaintenance.update({
    where: { id: maintenanceId },
    data: { status: "COMPLETED", completedAt: new Date(), ...input },
  });

  // Reactivate vehicle
  await db.vehicle.update({
    where: { id: m.vehicleId },
    data: { status: "ACTIVE", ...(input.odometerKm ? { mileageKm: input.odometerKm } : {}) },
  });

  await publish({ eventType: "fleet.maintenance_completed", payload: { maintenanceId, costMinor: input.costMinor } });
  return updated;
}

export async function recordInspection(vehicleId: string, input: {
  inspectedBy?: string; passed: boolean; defects?: Array<{ component: string; severity: string; description: string }>; photoUrls?: string[]; notes?: string;
}) {
  const inspection = await db.vehicleInspection.create({
    data: {
      vehicleId,
      inspectedBy: input.inspectedBy,
      passed: input.passed,
      defectsJson: input.defects ? JSON.stringify(input.defects) : null,
      photoUrls: input.photoUrls ? JSON.stringify(input.photoUrls) : null,
      notes: input.notes,
      nextInspectionDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    },
  });
  if (!input.passed) {
    await db.vehicle.update({ where: { id: vehicleId }, data: { status: "MAINTENANCE" } });
  }
  await publish({ eventType: "fleet.inspection_recorded", payload: { vehicleId, passed: input.passed } });
  return inspection;
}

// ---------------------------------------------------------------------------
//  Fleet dashboard metrics
// ---------------------------------------------------------------------------

export async function fleetMetrics() {
  const [total, active, inMaintenance, totalFuelCost, totalMaintenanceCost] = await Promise.all([
    db.vehicle.count(),
    db.vehicle.count({ where: { status: "ACTIVE" } }),
    db.vehicle.count({ where: { status: "MAINTENANCE" } }),
    db.fuelLog.aggregate({ _sum: { costMinor: true } }),
    db.vehicleMaintenance.aggregate({ _sum: { costMinor: true }, where: { status: "COMPLETED" } }),
  ]);
  return {
    total,
    active,
    inMaintenance,
    totalFuelCostMinor: totalFuelCost._sum.costMinor ?? 0,
    totalMaintenanceCostMinor: totalMaintenanceCost._sum.costMinor ?? 0,
  };
}
