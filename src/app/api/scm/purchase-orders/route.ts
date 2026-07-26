// Purchase orders — list + create
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createPurchaseOrder } from "@/lib/modules/scm/service";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  supplierId: z.string(),
  warehouseCode: z.string().optional(),
  expectedDeliveryAt: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().int().min(1),
    unitCostMinor: z.number().int().min(0),
  })),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "scm:read");
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const items = await db.purchaseOrder.findMany({
      where: { ...(status ? { status } : {}) },
      include: { supplier: true, _count: { select: { lines: true, receipts: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "scm:manage");
    const body = await parseJson(req, schema);
    return { purchaseOrder: await createPurchaseOrder({
      supplierId: body.supplierId,
      warehouseCode: body.warehouseCode,
      expectedDeliveryAt: body.expectedDeliveryAt ? new Date(body.expectedDeliveryAt) : undefined,
      notes: body.notes,
      placedBy: session?.sub,
      lines: body.lines,
    }) };
  });
}
