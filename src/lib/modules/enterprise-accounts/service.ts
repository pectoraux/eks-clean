/**
 * Enterprise Accounts — Enterprise → Departments → Cost Centers → Budgets
 */
import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict } from "@/lib/utils/api";

export async function createEnterprise(input: { organizationId: string; name: string; legalName?: string; taxId?: string; industry?: string; size?: string }) {
  return db.enterprise.create({ data: input });
}

export async function createDepartment(enterpriseId: string, input: { name: string; code: string; description?: string; parentDepartmentId?: string; headUserId?: string }) {
  return db.department.create({ data: { ...input, enterpriseId } });
}

export async function createCostCenter(enterpriseId: string, input: { code: string; name: string; departmentId?: string; budgetAnnualMinor?: number; currency?: string }) {
  return db.costCenter.create({ data: { ...input, enterpriseId } });
}

export async function createPurchaseOrder(enterpriseId: string, input: { costCenterId?: string; title: string; description?: string; totalMinor: number; requestedBy?: string; items: Array<{ description: string; quantity: number; unitPriceMinor: number }> }) {
  const code = `EPO-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
  const totalMinor = input.items.reduce((s, i) => s + i.unitPriceMinor * i.quantity, 0);
  return db.enterprisePurchaseOrder.create({
    data: {
      code, enterpriseId, costCenterId: input.costCenterId,
      title: input.title, description: input.description,
      totalMinor, requestedBy: input.requestedBy,
      itemsJson: JSON.stringify(input.items),
    },
  });
}

export async function approvePurchaseOrder(poId: string, approverId: string) {
  const po = await db.enterprisePurchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw notFound("Purchase order not found");
  if (po.status !== "SUBMITTED") throw conflict("PO must be SUBMITTED to approve");
  const updated = await db.enterprisePurchaseOrder.update({
    where: { id: poId },
    data: { status: "APPROVED", approvedBy: approverId, approvedAt: new Date() },
  });
  // Update cost center spent
  if (po.costCenterId) {
    await db.costCenter.update({ where: { id: po.costCenterId }, data: { spentYtdMinor: { increment: po.totalMinor } } });
  }
  await publish({ eventType: "enterprise.po_approved", payload: { poId, totalMinor: po.totalMinor } });
  return updated;
}

export async function enterpriseMetrics(organizationId: string) {
  const [enterprises, departments, costCenters, pos, totalBudget, totalSpent] = await Promise.all([
    db.enterprise.count({ where: { organizationId } }),
    db.department.count({ where: { enterprise: { organizationId } } }),
    db.costCenter.count({ where: { enterprise: { organizationId } } }),
    db.enterprisePurchaseOrder.count({ where: { enterprise: { organizationId } } }),
    db.costCenter.aggregate({ where: { enterprise: { organizationId } }, _sum: { budgetAnnualMinor: true } }),
    db.costCenter.aggregate({ where: { enterprise: { organizationId } }, _sum: { spentYtdMinor: true } }),
  ]);
  return { enterprises, departments, costCenters, purchaseOrders: pos, totalBudgetMinor: totalBudget._sum.budgetAnnualMinor ?? 0, totalSpentMinor: totalSpent._sum.spentYtdMinor ?? 0 };
}
