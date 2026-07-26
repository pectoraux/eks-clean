"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Shield, Database, CreditCard, Zap, Layers, GitBranch, Bell } from "lucide-react";

export function ArchitecturePanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">System Architecture</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-3">
          <p className="text-muted-foreground">
            Eks-Clean is a modular, domain-driven SaaS platform. Each bounded context owns its
            service, schema, and events. The codebase is structured so the in-memory queue / event
            bus can be swapped for Redis BullMQ + Redis Pub/Sub, and SQLite can be swapped for
            PostgreSQL, without changing business logic.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <ArchBox icon={<Layers className="w-4 h-4" />} title="Bounded Contexts">
              auth · customers · workers · field-managers · sales · services · bookings · dispatch ·
              quality · subscriptions · inventory · laundry · waste · payments · marketplace ·
              analytics · notifications
            </ArchBox>
            <ArchBox icon={<CreditCard className="w-4 h-4" />} title="Payment Gateway">
              <code>PaymentGateway</code> interface — sole impl is <code>PayswapGateway</code>.
              No business logic depends on Payswap directly. Card data never touches this app.
            </ArchBox>
            <ArchBox icon={<Zap className="w-4 h-4" />} title="Event-Driven">
              <code>publish()</code> persists to <code>DomainEvent</code> + fans out to subscribers.
              Booking transitions emit <code>booking.status_changed</code>, broadcast via socket.io.
            </ArchBox>
            <ArchBox icon={<Server className="w-4 h-4" />} title="Background Workers">
              <code>getQueue()</code> — BullMQ-compatible API (in-memory in dev). Used for dispatch,
              payouts, recert reminders. Swap for Redis with no caller changes.
            </ArchBox>
            <ArchBox icon={<Shield className="w-4 h-4" />} title="Auth & RBAC">
              JWT (HS256, 15m) + opaque refresh (30d, hashed in DB) + rotation. MFA-ready
              (<code>mfaEnabled</code> / <code>mfaSecret</code>). Permissions data-driven.
            </ArchBox>
            <ArchBox icon={<Database className="w-4 h-4" />} title="Data Layer">
              Prisma ORM with 30+ models. Soft-delete (<code>deletedAt</code>), audit log, rate
              limits, feature flags all DB-backed. Schema portable to PostgreSQL.
            </ArchBox>
            <ArchBox icon={<GitBranch className="w-4 h-4" />} title="Lifecycle">
              Booking status flow is data-driven (<code>BOOKING_STATUS_FLOW</code>). Every
              transition is recorded in <code>BookingStatusHistory</code>.
            </ArchBox>
            <ArchBox icon={<Bell className="w-4 h-4" />} title="Realtime">
              socket.io mini-service on port 3001. Next.js API routes broadcast to channels
              (<code>booking:&lt;id&gt;</code>, <code>worker:&lt;id&gt;</code>, <code>admin:ops</code>).
            </ArchBox>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Module Status</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-2 text-xs">
            {[
              ["Customer Mgmt", "Production"],
              ["Worker Mgmt + KYC", "Production"],
              ["Field Managers", "Production"],
              ["Sales Agents", "Production"],
              ["Service Catalog", "Production"],
              ["Booking Engine", "Production"],
              ["Dispatch Engine", "Production"],
              ["Quality / Ratings", "Production"],
              ["Subscriptions", "Production (Payswap)"],
              ["Inventory", "Production"],
              ["Training", "Production"],
              ["Laundry", "Production"],
              ["Waste Collection", "Production"],
              ["Payments (Payswap)", "Production (mock mode)"],
              ["Analytics", "Production"],
              ["Audit Log", "Production"],
              ["Feature Flags", "Production"],
              ["Marketplace", "Gated (flag: marketplace.open)"],
              ["AI Assistants", "Ready (flags: ai.*)"],
            ].map(([name, status]) => (
              <div key={name} className="flex items-center justify-between p-2 rounded border">
                <span>{name}</span>
                <Badge variant="outline" className="text-[10px]">{status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">API Surface (OpenAPI-ready)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-2 text-xs font-mono">
            {[
              "POST   /api/auth/register",
              "POST   /api/auth/login",
              "POST   /api/auth/refresh",
              "POST   /api/auth/logout",
              "GET    /api/auth/me",
              "GET    /api/customers",
              "POST   /api/customers            (address)",
              "GET    /api/customers/:id",
              "GET    /api/workers",
              "POST   /api/workers",
              "PATCH  /api/workers/:id",
              "POST   /api/workers/:id/kyc",
              "POST   /api/workers/:id/skills",
              "POST   /api/workers/:id/availability",
              "GET    /api/workers/:id/training",
              "GET    /api/services",
              "PATCH  /api/services/:id",
              "GET    /api/bookings",
              "POST   /api/bookings",
              "GET    /api/bookings/:id",
              "PATCH  /api/bookings/:id/status",
              "POST   /api/bookings/:id/dispatch",
              "POST   /api/bookings/:id/payment",
              "POST   /api/bookings/:id/ratings",
              "GET    /api/dispatch",
              "POST   /api/dispatch",
              "GET    /api/subscriptions",
              "POST   /api/subscriptions",
              "POST   /api/subscriptions/:id/pause",
              "POST   /api/subscriptions/:id/resume",
              "POST   /api/subscriptions/:id/cancel",
              "GET    /api/inventory/items",
              "POST   /api/inventory/items",
              "GET    /api/inventory/:id/stock",
              "POST   /api/inventory/:id/stock   (issue)",
              "GET    /api/analytics/overview",
              "GET    /api/analytics/revenue",
              "GET    /api/audit",
              "GET    /api/sales/leads",
              "POST   /api/sales/leads",
              "POST   /api/sales/leads/:id/convert",
              "POST   /api/field-managers/:id/recruits",
              "POST   /api/payments/checkout",
              "GET    /api/payments/intents",
              "POST   /api/payments/intents/:id/capture",
              "POST   /api/payments/intents/:id/refund",
              "POST   /api/payments/payouts",
              "POST   /api/payments/webhooks",
              "GET    /api/laundry/orders",
              "POST   /api/laundry/orders",
              "GET    /api/waste/schedules",
              "POST   /api/waste/schedules",
              "POST   /api/marketplace/applications",
              "POST   /api/marketplace/applications/:id/approve",
              "GET    /api/feature-flags",
              "PATCH  /api/feature-flags",
              "GET    /api/notifications",
              "GET    /api/health",
            ].map((line) => <div key={line} className="p-1 rounded bg-muted/50">{line}</div>)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ArchBox({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-2 font-medium text-sm">{icon} {title}</div>
      <div className="text-xs text-muted-foreground">{children}</div>
    </div>
  );
}
