/**
 * App API: Create a new application instance from a protocol
 * POST /api/apps/create
 * Body: { organizationId, protocolKey, name, slug, primaryColor?, accentColor? }
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { z } from "zod";

export const maxDuration = 60;

const createSchema = z.object({
  organizationId: z.string(),
  protocolKey: z.string(),
  name: z.string(),
  slug: z.string(),
  primaryColor: z.string().default("#0066FF"),
  accentColor: z.string().default("#00C896"),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");

    const body = await parseJson(req, createSchema);

    // Check if protocol is installed
    const protocol = await db.protocolInstallation.findUnique({
      where: { organizationId_protocolKey: { organizationId: body.organizationId, protocolKey: body.protocolKey } },
    });
    if (!protocol) throw new Error(`Protocol '${body.protocolKey}' is not installed. Install it first.`);

    // Create the application
    const app = await db.application.create({
      data: {
        organizationId: body.organizationId,
        protocolKey: body.protocolKey,
        slug: body.slug,
        name: body.name,
        description: body.description,
        primaryColor: body.primaryColor,
        accentColor: body.accentColor,
        status: "ACTIVE",
      },
    });

    // Provision default roles
    const roles = [
      { key: "CUSTOMER", name: "Customer", permissions: ["book", "view_history", "subscribe"], isDefault: true },
      { key: "WORKER", name: "Worker", permissions: ["accept_jobs", "update_status", "view_schedule"] },
      { key: "MANAGER", name: "Manager", permissions: ["assign_workers", "view_analytics", "manage_bookings"] },
      { key: "ADMIN", name: "Admin", permissions: ["*"] },
    ];
    for (const role of roles) {
      await db.appRole.create({ data: { applicationId: app.id, ...role } });
    }

    // Provision default routes
    const routes = [
      { path: "/", component: "landing", isPublic: true, order: 0 },
      { path: "/login", component: "login", isPublic: true, order: 1 },
      { path: "/dashboard", component: "dashboard", label: "Dashboard", icon: "home", requiredRole: "CUSTOMER", order: 1 },
      { path: "/services", component: "services", label: "Services", icon: "grid", requiredRole: "CUSTOMER", order: 2 },
      { path: "/book", component: "book", label: "Book", icon: "calendar", requiredRole: "CUSTOMER", order: 3 },
    ];
    for (const route of routes) {
      await db.appRoute.create({ data: { applicationId: app.id, ...route } });
    }

    // Provision default menu
    const menus = [
      { label: "Dashboard", icon: "home", routePath: "/dashboard", order: 1, requiredRole: "CUSTOMER" },
      { label: "Services", icon: "grid", routePath: "/services", order: 2, requiredRole: "CUSTOMER" },
      { label: "Book a Cleaning", icon: "calendar", routePath: "/book", order: 3, requiredRole: "CUSTOMER" },
    ];
    for (const menu of menus) {
      await db.appMenuItem.create({ data: { applicationId: app.id, ...menu } });
    }

    return {
      application: { id: app.id, slug: app.slug, name: app.name, protocolKey: app.protocolKey },
      provisioned: { roles: roles.length, routes: routes.length, menus: menus.length },
    };
  });
}
