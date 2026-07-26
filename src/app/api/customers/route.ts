import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, unauthorized, notFound, parseJson } from "@/lib/utils/api";
import { z } from "zod";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    // Customers can only see their own profile
    let where = {};
    if (session.role === "CUSTOMER") {
      const c = await db.customer.findUnique({ where: { userId: session.sub } });
      if (!c) throw notFound();
      where = { id: c.id };
    }

    const [items, total] = await Promise.all([
      db.customer.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, fullName: true, phone: true, role: true, status: true } },
          addresses: true,
          _count: { select: { bookings: true, subscriptions: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.customer.count({ where }),
    ]);
    return { items, total };
  });
}

const addressSchema = z.object({
  label: z.string().default("Home"),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("Ghana"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  instructions: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  // Adds an address for the current customer
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const body = await parseJson(req, addressSchema);
    const c = await db.customer.findUnique({ where: { userId: session.sub } });
    if (!c) throw notFound("Customer profile not found");
    const addr = await db.address.create({
      data: { ...body, customerId: c.id },
    });
    if (body.isDefault) {
      await db.address.updateMany({
        where: { customerId: c.id, id: { not: addr.id } },
        data: { isDefault: false },
      });
    }
    return { address: addr };
  });
}
