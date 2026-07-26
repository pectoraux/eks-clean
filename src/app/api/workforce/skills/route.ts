// Workforce skills — list + create + assess
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createSkill, skillsMatrix } from "@/lib/modules/workforce/service";
import { z } from "zod";

const schema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string().default("GENERAL"),
  description: z.string().optional(),
  levels: z.number().int().min(1).max(10).default(4),
  isCertificationRequired: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:read");
    const url = new URL(req.url);
    return { items: await skillsMatrix({
      category: url.searchParams.get("category") || undefined,
      workerId: url.searchParams.get("workerId") || undefined,
    }) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:paygrades:manage");
    const body = await parseJson(req, schema);
    return { skill: await createSkill(body) };
  });
}
