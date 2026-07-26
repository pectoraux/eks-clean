// SCM suppliers — list + create
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createSupplier } from "@/lib/modules/scm/service";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  code: z.string(),
  name: z.string(),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
  taxId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "scm:read");
    const items = await db.supplier.findMany({
      where: { isActive: true },
      include: { _count: { select: { purchaseOrders: true } } },
      orderBy: { name: "asc" },
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "scm:manage");
    const body = await parseJson(req, schema);
    return { supplier: await createSupplier(body) };
  });
}
