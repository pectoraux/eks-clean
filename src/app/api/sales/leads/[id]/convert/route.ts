// Convert a lead to a customer (credits commission)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, notFound, parseJson } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";

const convertSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  password: z.string().min(8).default("EksClean123!"),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "sales:leads:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, convertSchema);
    const lead = await db.lead.findUnique({ where: { id }, include: { salesAgent: true } });
    if (!lead) throw notFound();
    if (lead.status === "CONVERTED") throw new Error("Lead already converted");

    const user = await db.user.create({
      data: {
        email: body.email,
        fullName: body.fullName,
        phone: body.phone,
        passwordHash: hashPassword(body.password),
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    const customer = await db.customer.create({
      data: { userId: user.id, marketingOptIn: true },
    });

    await db.lead.update({
      where: { id },
      data: { status: "CONVERTED", convertedCustomerId: customer.id },
    });

    // Credit commission to sales agent
    if (lead.salesAgent) {
      const commission = Math.round(50 * 100); // 50 GHS flat per conversion (minor units)
      await db.salesAgent.update({
        where: { id: lead.salesAgent.id },
        data: {
          convertedLeads: { increment: 1 },
          totalCommissionMinor: { increment: commission },
        },
      });
      await db.lead.update({
        where: { id },
        data: { commissionCreditedMinor: commission },
      });
    }

    await writeAudit({
      action: "sales.lead_convert",
      resourceType: "Lead",
      resourceId: id,
      after: { customerId: customer.id },
    });
    return { customer, lead };
  });
}
