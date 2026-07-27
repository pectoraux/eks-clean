// Organizations — list + create
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createOrganization, listOrganizations } from "@/lib/modules/multi-tenant/service";
import { z } from "zod";

const schema = z.object({
  code: z.string(),
  name: z.string(),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  billingEmail: z.string().optional(),
  billingPhone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().default("GHS"),
  timezone: z.string().default("Africa/Accra"),
  plan: z.string().default("STARTER"),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "admin:users" as never);
    return { items: await listOrganizations() };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "admin:users" as never);
    const body = await parseJson(req, schema);
    return { organization: await createOrganization(body) };
  });
}
