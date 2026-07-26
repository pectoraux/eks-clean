// Compute a dynamic quote
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { saveQuote, computeQuote } from "@/lib/modules/pricing-engine/service";
import { z } from "zod";

const schema = z.object({
  organizationId: z.string(),
  serviceTypeId: z.string(),
  durationHours: z.number().min(0.5),
  distanceKm: z.number().optional(),
  isUrgent: z.boolean().optional(),
  zoneDemandScore: z.number().min(0).max(1).optional(),
  workerScarcityScore: z.number().min(0).max(1).optional(),
  isSubscriber: z.boolean().optional(),
  promotionMultiplier: z.number().optional(),
  isHoliday: z.boolean().optional(),
  isNightJob: z.boolean().optional(),
  propertySqM: z.number().optional(),
  customerId: z.string().optional(),
  propertyId: z.string().optional(),
  bookingId: z.string().optional(),
  save: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "bookings:create" as never);
    const body = await parseJson(req, schema);
    if (body.save) return saveQuote(body);
    return { breakdown: await computeQuote(body) };
  });
}
