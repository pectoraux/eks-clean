// Property detail + timeline + recommendations
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { getProperty, addRoom, addAppliance, addPropertyPhoto, recordTimelineEvent, recordCleaning, getPropertyRecommendations, getPropertyTimeline } from "@/lib/modules/property-twin/service";
import { z } from "zod";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "customers:read" as never);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "recommendations") return getPropertyRecommendations(id);
    if (url.searchParams.get("action") === "timeline") return { items: await getPropertyTimeline(id, 50) };
    return { property: await getProperty(id) };
  });
}

const roomSchema = z.object({ name: z.string(), roomType: z.string().default("BEDROOM"), floor: z.number().int().default(1), areaSqM: z.number().optional(), notes: z.string().optional() });
const applianceSchema = z.object({ name: z.string(), brand: z.string().optional(), model: z.string().optional(), location: z.string().optional(), notes: z.string().optional() });
const photoSchema = z.object({ url: z.string(), caption: z.string().optional(), photoType: z.string().default("GENERAL"), roomId: z.string().optional() });
const timelineSchema = z.object({ eventType: z.string(), title: z.string(), description: z.string().optional(), bookingId: z.string().optional(), workerId: z.string().optional() });
const cleaningSchema = z.object({ bookingId: z.string().optional(), cleanedAt: z.string(), durationMin: z.number().int(), roomsCleaned: z.number().int(), qualityScore: z.number().optional(), notes: z.string().optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "customers:update" as never);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "room";
    if (action === "room") { const body = await parseJson(req, roomSchema); return { room: await addRoom(id, body) }; }
    if (action === "appliance") { const body = await parseJson(req, applianceSchema); return { appliance: await addAppliance(id, body) }; }
    if (action === "photo") { const body = await parseJson(req, photoSchema); return { photo: await addPropertyPhoto(id, { ...body, takenBy: session?.sub }) }; }
    if (action === "timeline") { const body = await parseJson(req, timelineSchema); return { event: await recordTimelineEvent(id, body) }; }
    if (action === "cleaning") {
      const body = await parseJson(req, cleaningSchema);
      return { record: await recordCleaning(id, { ...body, cleanedAt: new Date(body.cleanedAt) }) };
    }
    return { error: "Unknown action" };
  });
}
