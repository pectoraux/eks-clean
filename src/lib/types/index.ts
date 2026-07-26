/**
 * Eks-Clean — Domain Types
 * Centralized type definitions for all bounded contexts.
 */

// ============================================================================
//  RBAC
// ============================================================================

export type Role =
  | "CUSTOMER"
  | "WORKER"
  | "FIELD_MANAGER"
  | "SALES_AGENT"
  | "ADMIN";

export const ALL_ROLES: Role[] = [
  "CUSTOMER",
  "WORKER",
  "FIELD_MANAGER",
  "SALES_AGENT",
  "ADMIN",
];

// ============================================================================
//  BOOKING LIFECYCLE
// ============================================================================

export type BookingStatus =
  | "draft"
  | "requested"
  | "assigned"
  | "worker_accepted"
  | "worker_en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "rated"
  | "cancelled"
  | "disputed";

export const BOOKING_STATUS_FLOW: Record<BookingStatus, BookingStatus[]> = {
  draft: ["requested", "cancelled"],
  requested: ["assigned", "cancelled"],
  assigned: ["worker_accepted", "cancelled", "requested"],
  worker_accepted: ["worker_en_route", "cancelled"],
  worker_en_route: ["arrived", "cancelled"],
  arrived: ["in_progress", "cancelled"],
  in_progress: ["completed", "disputed"],
  completed: ["rated", "disputed"],
  rated: [],
  cancelled: [],
  disputed: ["completed", "cancelled"],
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  draft: "Draft",
  requested: "Requested",
  assigned: "Assigned",
  worker_accepted: "Accepted",
  worker_en_route: "En Route",
  arrived: "Arrived",
  in_progress: "In Progress",
  completed: "Completed",
  rated: "Rated",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

// ============================================================================
//  PAYMENTS
// ============================================================================

export interface PaymentCustomer {
  id: string;
  payswapCustomerId: string;
}

export interface PaymentIntentResult {
  id: string;
  payswapPaymentIntentId: string;
  status: string;
  clientSecret?: string;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
  payswapCheckoutSessionId: string;
}

export interface SubscriptionResult {
  id: string;
  payswapSubscriptionId: string;
  status: string;
  currentPeriodEnd?: Date;
}

export interface RefundResult {
  id: string;
  payswapRefundId: string;
  status: string;
  amountMinor: number;
}

export interface TransferResult {
  id: string;
  payswapTransferId: string;
  status: string;
  amountMinor: number;
}

export interface ConnectedAccountResult {
  id: string;
  payswapAccountId: string;
  onboardingUrl?: string;
  detailsSubmitted: boolean;
}

export interface WebhookVerificationResult {
  valid: boolean;
  event: {
    id: string;
    type: string;
    data: unknown;
  };
}

// ============================================================================
//  AUDIT
// ============================================================================

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  actorType?: "SYSTEM" | "CUSTOMER" | "WORKER" | "ADMIN";
}

// ============================================================================
//  EVENTS
// ============================================================================

export interface DomainEventPayload {
  eventType: string;
  bookingId?: string;
  actorId?: string;
  actorType?: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}
