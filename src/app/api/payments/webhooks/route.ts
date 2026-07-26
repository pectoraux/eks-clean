// Payswap webhook receiver — verify signature, store event idempotently
import { NextRequest, NextResponse } from "next/server";
import { handleWebhookEvent } from "@/lib/modules/payments/service";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("payswap-signature") || "";
  const result = await handleWebhookEvent(rawBody, signature);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
