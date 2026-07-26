// Enterprise contracts — list + create
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createContract, contractMetrics } from "@/lib/modules/contracts/service";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  customerId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  slaTier: z.string().optional(),
  autoRenew: z.boolean().optional(),
  renewalPeriodMonths: z.number().int().optional(),
  accountManagerId: z.string().optional(),
  lines: z.array(z.object({
    serviceTypeId: z.string(),
    billingCycle: z.string(),
    unitPriceMinor: z.number().int(),
    minimumVolume: z.number().int().optional(),
    includedVolume: z.number().int().optional(),
    overagePriceMinor: z.number().int().optional(),
  })),
  slas: z.array(z.object({
    metric: z.string(),
    targetHours: z.number().int().optional(),
    targetPercent: z.number().optional(),
    penaltyPercent: z.number().optional(),
  })).optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "contracts:read");
    const url = new URL(req.url);
    if (url.searchParams.get("metrics") === "true") {
      return contractMetrics();
    }
    const items = await db.enterpriseContract.findMany({
      include: {
        customer: { include: { user: true } },
        _count: { select: { lines: true, milestones: true, billingSchedule: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "contracts:manage");
    const body = await parseJson(req, schema);
    return { contract: await createContract({
      ...body,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    }) };
  });
}
