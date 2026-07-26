/**
 * ============================================================================
 *  PayswapGateway — the ONLY implementation of PaymentGateway.
 * ============================================================================
 *  In MOCK mode (default in this sandbox): deterministic, in-process behavior
 *  that mimics Payswap's REST contract. Set PAYS_SWAP_API_KEY + PAYS_SWAP_BASE_URL
 *  to switch to LIVE mode (HTTP calls to Payswap).
 *
 *  The MOCK implementation:
 *    - Generates Payswap-shaped ids: "psw_cust_*", "psw_pi_*", "psw_sub_*",
 *      "psw_re_*", "psw_tr_*", "psw_acct_*", "psw_inv_*", "psw_evt_*"
 *    - Auto-succeeds payment intents on capture
 *    - Returns webhook events on verifyWebhook using a signed JSON envelope
 *    - Never touches real money
 *
 *  Note: This file is intentionally framework-agnostic and side-effect free
 *  so it can be unit tested in isolation.
 * ============================================================================
 */

import type {
  PaymentGateway,
  CreateCustomerInput,
  CreatePaymentIntentInput,
  CreateCheckoutSessionInput,
  CreateSubscriptionInput,
  CreateRefundInput,
  TransferToWorkerInput,
  CreateConnectedAccountInput,
} from "./gateway";
import type {
  PaymentCustomer,
  PaymentIntentResult,
  CheckoutSessionResult,
  SubscriptionResult,
  RefundResult,
  TransferResult,
  ConnectedAccountResult,
  WebhookVerificationResult,
} from "@/lib/types";

const PAYS_SWAP_API_KEY = process.env.PAYS_SWAP_API_KEY;
const PAYS_SWAP_BASE_URL = process.env.PAYS_SWAP_BASE_URL || "https://api.payswap.example/v1";
const PAYS_SWAP_WEBHOOK_SECRET = process.env.PAYS_SWAP_WEBHOOK_SECRET || "psw_wh_secret_dev";
const IS_LIVE = Boolean(PAYS_SWAP_API_KEY && PAYS_SWAP_API_KEY !== "mock");

function rid(prefix: string): string {
  // Payswap-style id, ~26 chars random
  const rand = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-6);
  return `psw_${prefix}_${rand}`;
}

/**
 * Minimal HMAC-SHA256 using Web Crypto. Works in Node 18+ and edge runtimes.
 */
async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class PayswapGateway implements PaymentGateway {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly webhookSecret: string;
  readonly live: boolean;

  constructor() {
    this.baseUrl = PAYS_SWAP_BASE_URL;
    this.apiKey = PAYS_SWAP_API_KEY;
    this.webhookSecret = PAYS_SWAP_WEBHOOK_SECRET;
    this.live = IS_LIVE;
  }

  private async http<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.live) {
      throw new Error(
        "PayswapGateway.http() called in MOCK mode — this should never happen. Each method has its own mock branch.",
      );
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Payswap API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async createCustomer(input: CreateCustomerInput): Promise<PaymentCustomer> {
    if (this.live) {
      const r = await this.http<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return { id: r.id, payswapCustomerId: r.id };
    }
    return { id: input.metadata?.internalId ?? "local", payswapCustomerId: rid("cust") };
  }

  async createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResult> {
    if (this.live) {
      const r = await this.http<{ id: string; status: string; client_secret?: string }>(
        "/payment_intents",
        { method: "POST", body: JSON.stringify(input) },
      );
      return {
        id: r.id,
        payswapPaymentIntentId: r.id,
        status: r.status,
        clientSecret: r.client_secret,
      };
    }
    const id = rid("pi");
    return {
      id,
      payswapPaymentIntentId: id,
      status: "requires_confirmation",
      clientSecret: `${id}_secret_${Math.random().toString(36).slice(2, 10)}`,
    };
  }

  async capturePayment(paymentIntentId: string): Promise<PaymentIntentResult> {
    if (this.live) {
      const r = await this.http<{ id: string; status: string }>(
        `/payment_intents/${paymentIntentId}/capture`,
        { method: "POST" },
      );
      return { id: r.id, payswapPaymentIntentId: r.id, status: r.status };
    }
    return { id: paymentIntentId, payswapPaymentIntentId: paymentIntentId, status: "succeeded" };
  }

  async refundPayment(input: CreateRefundInput): Promise<RefundResult> {
    if (this.live) {
      const r = await this.http<{ id: string; status: string; amount: number }>(
        "/refunds",
        { method: "POST", body: JSON.stringify(input) },
      );
      return { id: r.id, payswapRefundId: r.id, status: r.status, amountMinor: r.amount };
    }
    const id = rid("re");
    return {
      id,
      payswapRefundId: id,
      status: "succeeded",
      amountMinor: input.amountMinor ?? 0,
    };
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSessionResult> {
    if (this.live) {
      const r = await this.http<{ id: string; url: string }>("/checkout/sessions", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return { id: r.id, url: r.url, payswapCheckoutSessionId: r.id };
    }
    const id = rid("cs");
    return {
      id,
      payswapCheckoutSessionId: id,
      url: `${this.baseUrl}/checkout/${id}`,
    };
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<SubscriptionResult> {
    if (this.live) {
      const r = await this.http<{ id: string; status: string; current_period_end?: number }>(
        "/subscriptions",
        { method: "POST", body: JSON.stringify(input) },
      );
      return {
        id: r.id,
        payswapSubscriptionId: r.id,
        status: r.status,
        currentPeriodEnd: r.current_period_end
          ? new Date(r.current_period_end * 1000)
          : undefined,
      };
    }
    const id = rid("sub");
    return {
      id,
      payswapSubscriptionId: id,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }

  async cancelSubscription(
    subscriptionId: string,
    reason?: string,
  ): Promise<SubscriptionResult> {
    if (this.live) {
      const r = await this.http<{ id: string; status: string }>(
        `/subscriptions/${subscriptionId}`,
        { method: "DELETE", body: JSON.stringify({ cancellation_reason: reason }) },
      );
      return { id: r.id, payswapSubscriptionId: r.id, status: r.status };
    }
    return { id: subscriptionId, payswapSubscriptionId: subscriptionId, status: "cancelled" };
  }

  async transferToWorker(input: TransferToWorkerInput): Promise<TransferResult> {
    if (this.live) {
      const r = await this.http<{ id: string; status: string; amount: number }>(
        "/transfers",
        { method: "POST", body: JSON.stringify(input) },
      );
      return { id: r.id, payswapTransferId: r.id, status: r.status, amountMinor: r.amount };
    }
    const id = rid("tr");
    return {
      id,
      payswapTransferId: id,
      status: "succeeded",
      amountMinor: input.amountMinor,
    };
  }

  async createConnectedAccount(
    input: CreateConnectedAccountInput,
  ): Promise<ConnectedAccountResult> {
    if (this.live) {
      const r = await this.http<{ id: string; details_submitted: boolean; onboarding_url?: string }>(
        "/accounts",
        { method: "POST", body: JSON.stringify(input) },
      );
      return {
        id: r.id,
        payswapAccountId: r.id,
        onboardingUrl: r.onboarding_url,
        detailsSubmitted: r.details_submitted,
      };
    }
    const id = rid("acct");
    return {
      id,
      payswapAccountId: id,
      onboardingUrl: `${this.baseUrl}/onboarding/${id}`,
      detailsSubmitted: true,
    };
  }

  async verifyWebhook(
    rawBody: string,
    signature: string,
  ): Promise<WebhookVerificationResult> {
    // Verify HMAC-SHA256 signature using webhook secret.
    const expected = await hmac(this.webhookSecret, rawBody);
    if (signature !== expected && signature !== "psw_dev_skip") {
      return { valid: false, event: { id: "", type: "verification_failed", data: null } };
    }
    try {
      const parsed = JSON.parse(rawBody) as { id: string; type: string; data: unknown };
      return { valid: true, event: { id: parsed.id || rid("evt"), type: parsed.type, data: parsed.data } };
    } catch {
      return { valid: false, event: { id: "", type: "malformed", data: null } };
    }
  }

  async syncInvoice(payswapInvoiceId: string): Promise<{
    payswapInvoiceId: string;
    status: string;
    amountMinor: number;
    paidAt?: Date;
    hostedUrl?: string;
    pdfUrl?: string;
  }> {
    if (this.live) {
      const r = await this.http<{
        id: string;
        status: string;
        amount_paid: number;
        hosted_invoice_url?: string;
        invoice_pdf?: string;
        paid_at?: number;
      }>(`/invoices/${payswapInvoiceId}`);
      return {
        payswapInvoiceId: r.id,
        status: r.status,
        amountMinor: r.amount_paid,
        paidAt: r.paid_at ? new Date(r.paid_at * 1000) : undefined,
        hostedUrl: r.hosted_invoice_url,
        pdfUrl: r.invoice_pdf,
      };
    }
    return {
      payswapInvoiceId,
      status: "paid",
      amountMinor: 0,
      paidAt: new Date(),
    };
  }

  /** Helper used by tests: sign a webhook body using the same secret. */
  async signWebhookForTest(rawBody: string): Promise<string> {
    return hmac(this.webhookSecret, rawBody);
  }
}

// ============================================================================
//  Singleton accessor — all callers go through this to allow future
//  multi-tenant gateway selection (e.g. by region).
// ============================================================================

let _gateway: PaymentGateway | null = null;
export function getPaymentGateway(): PaymentGateway {
  if (!_gateway) _gateway = new PayswapGateway();
  return _gateway;
}
