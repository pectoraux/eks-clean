/**
 * ============================================================================
 *  Eks-Clean — Payment Gateway Abstraction
 * ============================================================================
 *  CRITICAL CONTRACT: This application MUST NEVER implement payment logic.
 *  Payments are delegated entirely to Payswap's REST API.
 *  This application only stores payment references (Payswap ids).
 *
 *  - No business logic depends directly on Payswap.
 *  - All modules depend on `PaymentGateway` interface.
 *  - The only implementation is `PayswapGateway`.
 *  - In dev/test, `PayswapGateway` runs in `MOCK` mode: it generates
 *    deterministic Payswap-shaped ids and simulates success/failure, so the
 *    rest of the system can exercise end-to-end flows without real money.
 * ============================================================================
 */

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

export interface CreateCustomerInput {
  email: string;
  name: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentInput {
  customerId?: string;
  amountMinor: number;
  currency: string;
  description?: string;
  bookingId?: string;
  metadata?: Record<string, string>;
}

export interface CreateCheckoutSessionInput {
  customerId?: string;
  amountMinor: number;
  currency: string;
  description?: string;
  bookingId?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionInput {
  customerId: string;
  priceId: string;
  metadata?: Record<string, string>;
}

export interface CreateRefundInput {
  paymentIntentId: string;
  amountMinor?: number; // partial refund if provided
  reason?: string;
}

export interface TransferToWorkerInput {
  amountMinor: number;
  currency: string;
  destinationAccountId: string; // Payswap connected account
  transferGroup?: string;
  metadata?: Record<string, string>;
}

export interface CreateConnectedAccountInput {
  email: string;
  country: string;
  workerId: string;
}

/**
 * The PaymentGateway interface.
 * All application code MUST depend on this interface, never on PayswapGateway.
 */
export interface PaymentGateway {
  createCustomer(input: CreateCustomerInput): Promise<PaymentCustomer>;
  createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResult>;
  capturePayment(paymentIntentId: string): Promise<PaymentIntentResult>;
  refundPayment(input: CreateRefundInput): Promise<RefundResult>;
  createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSessionResult>;
  createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<SubscriptionResult>;
  cancelSubscription(
    subscriptionId: string,
    reason?: string,
  ): Promise<SubscriptionResult>;
  transferToWorker(input: TransferToWorkerInput): Promise<TransferResult>;
  createConnectedAccount(
    input: CreateConnectedAccountInput,
  ): Promise<ConnectedAccountResult>;
  verifyWebhook(
    rawBody: string,
    signature: string,
  ): Promise<WebhookVerificationResult>;
  // Sync invoice state from Payswap into our DB (we only store references).
  syncInvoice(payswapInvoiceId: string): Promise<{
    payswapInvoiceId: string;
    status: string;
    amountMinor: number;
    paidAt?: Date;
    hostedUrl?: string;
    pdfUrl?: string;
  }>;
}
