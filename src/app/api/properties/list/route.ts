// Properties — list + create
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createProperty, listPropertiesForCustomer } from "@/lib/modules/property-twin/service";
import { z } from "zod";

const schema = z.object({
  organizationId: z.string(),
  customerId: z.string(),
  name: z.string(),
  propertyType: z.string().default("HOUSE"),
  addressId: z.string().optional(),
  geoZoneId: z.string().optional(),
  bedrooms: z.number().int().default(1),
  bathrooms: z.number().int().default(1),
  squareMeters: z.number().optional(),
  floors: z.number().int().default(1),
  hasPets: z.boolean().default(false),
  petDetails: z.string().optional(),
  hasChildren: z.boolean().default(false),
  accessNotes: z.string().optional(),
  parkingAvailable: z.boolean().default(false),
  specialInstructions: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "customers:read" as never);
    const url = new URL(req.url);
    const customerId = url.searchParams.get("customerId");
    if (customerId) return { items: await listPropertiesForCustomer(customerId) };
    const items = await db.property.findMany({
      include: { customer: { include: { user: true } }, _count: { select: { rooms: true, timeline: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "customers:update" as never);
    const body = await parseJson(req, schema);
    return { property: await createProperty(body) };
  });
}
