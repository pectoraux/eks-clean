// Find zone by coordinates
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { findZoneForCoordinates } from "@/lib/modules/geographic/service";
import { z } from "zod";

const schema = z.object({ latitude: z.number(), longitude: z.number(), organizationId: z.string().optional() });

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "analytics:read" as never);
    const body = await parseJson(req, schema);
    return findZoneForCoordinates(body.latitude, body.longitude, body.organizationId);
  });
}
