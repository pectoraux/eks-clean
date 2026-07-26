/**
 * ============================================================================
 *  Enterprise Contracts — B2B contracts, SLAs, milestones, billing schedules
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Contracts
// ---------------------------------------------------------------------------

export async function createContract(input: {
  customerId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  slaTier?: string;
  autoRenew?: boolean;
  renewalPeriodMonths?: number;
  accountManagerId?: string;
  lines: Array<{
    serviceTypeId: string;
    billingCycle: string;
    unitPriceMinor: number;
    minimumVolume?: number;
    includedVolume?: number;
    overagePriceMinor?: number;
  }>;
  slas?: Array<{
    metric: string;
    targetHours?: number;
    targetPercent?: number;
    penaltyPercent?: number;
  }>;
}) {
  const customer = await db.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw notFound("Customer not found");

  const totalValue = input.lines.reduce((s, l) => s + l.unitPriceMinor * Math.max(l.minimumVolume ?? 1, 12), 0);
  const contractNumber = `EKS-ENT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const contract = await db.enterpriseContract.create({
    data: {
      contractNumber,
      customerId: input.customerId,
      title: input.title,
      description: input.description,
      status: "DRAFT",
      startDate: input.startDate,
      endDate: input.endDate,
      slaTier: input.slaTier ?? "STANDARD",
      autoRenew: input.autoRenew ?? false,
      renewalPeriodMonths: input.renewalPeriodMonths,
      accountManagerId: input.accountManagerId,
      totalContractValueMinor: totalValue,
      lines: { create: input.lines },
      slas: input.slas ? { create: input.slas } : undefined,
    },
    include: { lines: true, slas: true },
  });

  // Generate billing schedule
  const months = Math.max(1, Math.round((input.endDate.getTime() - input.startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));
  for (let i = 0; i < months; i++) {
    const periodStart = new Date(input.startDate.getTime() + i * 30 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    const monthlyAmount = Math.round(totalValue / months);
    await db.contractBillingSchedule.create({
      data: {
        contractId: contract.id,
        periodStart,
        periodEnd,
        amountMinor: monthlyAmount,
        status: "SCHEDULED",
      },
    });
  }

  await publish({ eventType: "contract.created", payload: { contractId: contract.id, contractNumber } });
  return contract;
}

export async function transitionContract(contractId: string, action: "send" | "activate" | "terminate" | "renew", actorId?: string) {
  const contract = await db.enterpriseContract.findUnique({ where: { id: contractId } });
  if (!contract) throw notFound("Contract not found");

  const transitions: Record<string, { from: string[]; to: string; actorField?: string }> = {
    send: { from: ["DRAFT"], to: "SENT" },
    activate: { from: ["SENT", "NEGOTIATING"], to: "ACTIVE", actorField: "signedBy" },
    terminate: { from: ["ACTIVE", "EXPIRING"], to: "TERMINATED" },
    renew: { from: ["EXPIRED", "EXPIRING"], to: "RENEWED" },
  };
  const t = transitions[action];
  if (!t.from.includes(contract.status)) {
    throw conflict(`Cannot ${action} contract in ${contract.status} state`);
  }

  return db.enterpriseContract.update({
    where: { id: contractId },
    data: {
      status: t.to,
      ...(t.actorField && actorId ? { [t.actorField]: actorId, signedAt: new Date() } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
//  Milestones
// ---------------------------------------------------------------------------

export async function addMilestone(contractId: string, input: { name: string; description?: string; dueAt: Date }) {
  return db.contractMilestone.create({
    data: { contractId, ...input, status: "PENDING" },
  });
}

export async function completeMilestone(milestoneId: string) {
  const m = await db.contractMilestone.findUnique({ where: { id: milestoneId } });
  if (!m) throw notFound("Milestone not found");
  return db.contractMilestone.update({
    where: { id: milestoneId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
//  Billing schedule — mark invoiced / paid
// ---------------------------------------------------------------------------

export async function markBillingInvoiced(billingId: string, invoiceId: string) {
  return db.contractBillingSchedule.update({
    where: { id: billingId },
    data: { status: "INVOICED", invoiceId, invoicedAt: new Date() },
  });
}

export async function markBillingPaid(billingId: string) {
  return db.contractBillingSchedule.update({
    where: { id: billingId },
    data: { status: "PAID", paidAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
//  Performance tracking
// ---------------------------------------------------------------------------

export async function recordContractPerformance(contractId: string, input: {
  period: string;
  slaComplianceRate: number;
  qualityScore: number;
  utilizationRate: number;
  issuesCount?: number;
  penaltiesMinor?: number;
  notes?: string;
}) {
  return db.contractPerformance.upsert({
    where: { contractId_period: { contractId, period: input.period } },
    update: input,
    create: { contractId, ...input },
  });
}

// ---------------------------------------------------------------------------
//  Contract metrics
// ---------------------------------------------------------------------------

export async function contractMetrics() {
  const [total, active, expiringSoon, totalValue] = await Promise.all([
    db.enterpriseContract.count(),
    db.enterpriseContract.count({ where: { status: "ACTIVE" } }),
    db.enterpriseContract.count({
      where: {
        status: "ACTIVE",
        endDate: { lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    db.enterpriseContract.aggregate({
      where: { status: "ACTIVE" },
      _sum: { totalContractValueMinor: true },
    }),
  ]);
  return {
    total,
    active,
    expiringSoon,
    totalActiveValueMinor: totalValue._sum.totalContractValueMinor ?? 0,
  };
}
