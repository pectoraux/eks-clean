// Inventory items API
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, unauthorized } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const itemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  category: z.enum(["CHEMICAL", "TOOL", "EQUIPMENT", "PPE", "VEHICLE", "CONSUMABLE"]),
  description: z.string().optional(),
  unit: z.string().default("UNIT"),
  reorderLevel: z.number().int().default(10),
  hazardLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  ppeRequired: z.string().optional(),
  approvedSurfaces: z.string().optional(),
  mixingInstructions: z.string().optional(),
  replacementRecommendation: z.string().optional(),
  imageUrl: z.string().optional(),
  initialStock: z.number().int().default(0),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || undefined;
    const items = await db.inventoryItem.findMany({
      where: { ...(category ? { category } : {}), isActive: true },
      include: { warehouseStock: true },
      orderBy: { name: "asc" },
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "inventory:manage");
    const body = await parseJson(req, itemSchema);
    const { initialStock, ...data } = body;
    const item = await db.inventoryItem.create({ data });
    if (initialStock > 0) {
      await db.warehouseStock.create({
        data: { itemId: item.id, warehouseCode: "MAIN", quantity: initialStock },
      });
      await db.inventoryMovement.create({
        data: {
          itemId: item.id,
          toLocation: "MAIN",
          quantity: initialStock,
          reason: "RESTOCK",
          performedBy: session.sub,
        },
      });
    }
    await writeAudit({
      action: "inventory.item_create",
      resourceType: "InventoryItem",
      resourceId: item.id,
      after: body,
    });
    return { item };
  });
}
