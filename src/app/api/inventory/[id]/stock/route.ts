// Stock level + movements for an item
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const issueSchema = z.object({
  workerId: z.string(),
  quantity: z.number().int().min(1),
  reason: z.string().default("ISSUED"),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const { id } = await ctx.params;
    const item = await db.inventoryItem.findUnique({
      where: { id },
      include: { warehouseStock: true, workerStock: { include: { worker: { include: { user: true } } } } },
    });
    if (!item) throw notFound();
    return { item };
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "inventory:issue");
    const { id } = await ctx.params;
    const body = await parseJson(req, issueSchema);

    const stock = await db.warehouseStock.findFirst({
      where: { itemId: id, warehouseCode: "MAIN" },
    });
    if (!stock || stock.quantity < body.quantity) {
      throw new Error("Insufficient warehouse stock");
    }

    // Decrement warehouse, increment worker stock
    await db.warehouseStock.update({
      where: { id: stock.id },
      data: { quantity: { decrement: body.quantity } },
    });
    await db.workerInventoryItem.upsert({
      where: { workerId_itemId: { workerId: body.workerId, itemId: id } },
      update: { quantity: { increment: body.quantity } },
      create: { workerId: body.workerId, itemId: id, quantity: body.quantity },
    });
    await db.inventoryMovement.create({
      data: {
        itemId: id,
        fromLocation: "MAIN",
        toLocation: body.workerId,
        quantity: -body.quantity,
        reason: body.reason,
        performedBy: session.sub,
      },
    });

    await writeAudit({
      action: "inventory.issue",
      resourceType: "InventoryItem",
      resourceId: id,
      after: body,
    });
    return { ok: true };
  });
}
