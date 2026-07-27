// AI predictions — list + record + resolve
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { recordPrediction, resolvePrediction, predictionAccuracyMetrics } from "@/lib/modules/ai-ready/service";
import { z } from "zod";

const recordSchema = z.object({
  predictionType: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  predictedValue: z.number(),
  confidence: z.number().min(0).max(1),
  horizonDays: z.number().int().default(7),
  modelVersion: z.string().optional(),
  featuresJson: z.record(z.string(), z.any()).optional(),
});

const resolveSchema = z.object({ actualValue: z.number() });

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:predictions:read");
    const url = new URL(req.url);
    if (url.searchParams.get("metrics") === "true") {
      return predictionAccuracyMetrics(url.searchParams.get("predictionType") || undefined);
    }
    const predictionType = url.searchParams.get("predictionType") || undefined;
    const items = await db.aiPrediction.findMany({
      where: { ...(predictionType ? { predictionType } : {}) },
      orderBy: { generatedAt: "desc" },
      take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:prompts:manage");
    const body = await parseJson(req, recordSchema);
    return { prediction: await recordPrediction(body) };
  });
}
