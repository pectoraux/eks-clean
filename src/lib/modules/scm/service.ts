/**
 * ============================================================================
 *  Supply Chain Management — suppliers, POs, goods receipts, transfers
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Suppliers
// ---------------------------------------------------------------------------

export async function createSupplier(input: {
  code: string; name: string; contactName?: string; email?: string; phone?: string;
  address?: string; paymentTerms?: string; taxId?: string;
}) {
  const existing = await db.supplier.findUnique({ where: { code: input.code } });
  if (existing) throw conflict(`Supplier ${input.code} exists`);
  return db.supplier.create({ data: input });
}

// ---------------------------------------------------------------------------
//  Purchase Orders
// ---------------------------------------------------------------------------

export async function createPurchaseOrder(input: {
  supplierId: string;
  warehouseCode?: string;
  expectedDeliveryAt?: Date;
  notes?: string;
  placedBy?: string;
  lines: Array<{ itemId: string; quantity: number; unitCostMinor: number }>;
}) {
  const supplier = await db.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) throw notFound("Supplier not found");

  const subtotalMinor = input.lines.reduce((s, l) => s + l.unitCostMinor * l.quantity, 0);
  const taxMinor = Math.round(subtotalMinor * 0.05); // 5% VAT placeholder
  const shippingMinor = 0;
  const totalMinor = subtotalMinor + taxMinor + shippingMinor;

  const code = `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
  const po = await db.purchaseOrder.create({
    data: {
      code,
      supplierId: input.supplierId,
      warehouseCode: input.warehouseCode ?? "MAIN",
      status: "DRAFT",
      expectedDeliveryAt: input.expectedDeliveryAt,
      subtotalMinor,
      taxMinor,
      shippingMinor,
      totalMinor,
      notes: input.notes,
      placedBy: input.placedBy,
      lines: {
        create: input.lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitCostMinor: l.unitCostMinor,
          totalMinor: l.unitCostMinor * l.quantity,
        })),
      },
    },
    include: { lines: { include: { item: true } }, supplier: true },
  });

  await publish({ eventType: "scm.po_created", payload: { poId: po.id, code, totalMinor } });
  return po;
}

export async function transitionPO(poId: string, action: "submit" | "approve" | "send" | "cancel", actorId?: string) {
  const po = await db.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw notFound("PO not found");

  const transitions: Record<string, { from: string[]; to: string; actorField?: string }> = {
    submit: { from: ["DRAFT"], to: "SUBMITTED" },
    approve: { from: ["SUBMITTED"], to: "APPROVED", actorField: "approvedBy" },
    send: { from: ["APPROVED"], to: "SENT" },
    cancel: { from: ["DRAFT", "SUBMITTED", "APPROVED"], to: "CANCELLED" },
  };
  const t = transitions[action];
  if (!t.from.includes(po.status)) {
    throw conflict(`Cannot ${action} PO in ${po.status} state`);
  }

  return db.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: t.to,
      ...(t.actorField && actorId ? { [t.actorField]: actorId } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
//  Goods Receipts
// ---------------------------------------------------------------------------

export async function receiveGoods(poId: string, input: {
  receivedBy: string;
  qualityCheckPassed?: boolean;
  notes?: string;
  lines: Array<{ poLineId: string; itemId: string; quantityReceived: number; quantityRejected?: number; rejectionReason?: string }>;
}) {
  const po = await db.purchaseOrder.findUnique({
    where: { id: poId },
    include: { lines: true },
  });
  if (!po) throw notFound("PO not found");
  if (!["SENT", "PARTIALLY_RECEIVED"].includes(po.status)) {
    throw conflict(`Cannot receive PO in ${po.status} state`);
  }

  const code = `GR-${po.code}`;
  const receipt = await db.goodsReceipt.create({
    data: {
      code,
      purchaseOrderId: poId,
      receivedBy: input.receivedBy,
      qualityCheckPassed: input.qualityCheckPassed ?? true,
      notes: input.notes,
      lines: {
        create: input.lines.map((l) => ({
          poLineId: l.poLineId,
          itemId: l.itemId,
          quantityReceived: l.quantityReceived,
          quantityRejected: l.quantityRejected ?? 0,
          rejectionReason: l.rejectionReason,
        })),
      },
    },
    include: { lines: true },
  });

  // Update PO line received quantities + warehouse stock
  for (const line of input.lines) {
    const poLine = po.lines.find((l) => l.id === line.poLineId);
    if (!poLine) continue;
    await db.purchaseOrderLine.update({
      where: { id: line.poLineId },
      data: { receivedQty: { increment: line.quantityReceived } },
    });
    // Add to warehouse stock
    await db.warehouseStock.upsert({
      where: { itemId_warehouseCode: { itemId: line.itemId, warehouseCode: po.warehouseCode } },
      update: { quantity: { increment: line.quantityReceived } },
      create: { itemId: line.itemId, warehouseCode: po.warehouseCode, quantity: line.quantityReceived },
    });
    // Record movement
    await db.inventoryMovement.create({
      data: {
        itemId: line.itemId,
        toLocation: po.warehouseCode,
        quantity: line.quantityReceived,
        reason: "RESTOCK",
        referenceId: poId,
        performedBy: input.receivedBy,
      },
    });
  }

  // Update PO status to PARTIALLY_RECEIVED or RECEIVED
  const allComplete = po.lines.every((l) => {
    const receivedInThis = input.lines.filter((i) => i.poLineId === l.id).reduce((s, i) => s + i.quantityReceived, 0);
    return l.receivedQty + receivedInThis >= l.quantity;
  });
  await db.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: allComplete ? "RECEIVED" : "PARTIALLY_RECEIVED",
      actualDeliveryAt: allComplete ? new Date() : null,
    },
  });

  await publish({ eventType: "scm.goods_received", payload: { poId, receiptId: receipt.id } });
  return receipt;
}

// ---------------------------------------------------------------------------
//  Supplier performance — recomputed periodically
// ---------------------------------------------------------------------------

export async function computeSupplierPerformance(supplierId: string, period: string) {
  const pos = await db.purchaseOrder.findMany({
    where: { supplierId, status: "RECEIVED" },
    include: { receipts: true },
  });
  if (pos.length === 0) {
    return db.supplierPerformance.upsert({
      where: { supplierId_period: { supplierId, period } },
      update: { onTimeDeliveryRate: 0, qualityAcceptanceRate: 0, averageLeadTimeDays: 0, totalOrders: 0, totalOrdersMinor: 0 },
      create: { supplierId, period, onTimeDeliveryRate: 0, qualityAcceptanceRate: 0, averageLeadTimeDays: 0, totalOrders: 0, totalOrdersMinor: 0 },
    });
  }
  const onTime = pos.filter((p) => !p.expectedDeliveryAt || (p.actualDeliveryAt && p.actualDeliveryAt <= p.expectedDeliveryAt)).length;
  const onTimeRate = onTime / pos.length;

  let totalLines = 0;
  let acceptedLines = 0;
  let totalLeadTimeDays = 0;
  let totalValue = 0;
  for (const p of pos) {
    totalValue += p.totalMinor;
    for (const r of p.receipts) {
      // Note: would need to count lines but we'll approximate
    }
    if (p.actualDeliveryAt) {
      totalLeadTimeDays += (p.actualDeliveryAt.getTime() - p.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    }
  }
  return db.supplierPerformance.upsert({
    where: { supplierId_period: { supplierId, period } },
    update: {
      onTimeDeliveryRate: onTimeRate,
      qualityAcceptanceRate: 0.95, // placeholder
      averageLeadTimeDays: pos.length > 0 ? totalLeadTimeDays / pos.length : 0,
      totalOrders: pos.length,
      totalOrdersMinor: totalValue,
    },
    create: {
      supplierId,
      period,
      onTimeDeliveryRate: onTimeRate,
      qualityAcceptanceRate: 0.95,
      averageLeadTimeDays: pos.length > 0 ? totalLeadTimeDays / pos.length : 0,
      totalOrders: pos.length,
      totalOrdersMinor: totalValue,
    },
  });
}
