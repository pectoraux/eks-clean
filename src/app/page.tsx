"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/client";
import { AuthPanel } from "@/components/eks/auth-panel";
import { AnalyticsOverview } from "@/components/eks/analytics-overview";
import { BookingsPanel } from "@/components/eks/bookings-panel";
import { WorkersPanel } from "@/components/eks/workers-panel";
import { CustomersPanel } from "@/components/eks/customers-panel";
import { ServicesPanel } from "@/components/eks/services-panel";
import { DispatchPanel } from "@/components/eks/dispatch-panel";
import { InventoryPanel } from "@/components/eks/inventory-panel";
import { SubscriptionsPanel } from "@/components/eks/subscriptions-panel";
import { AuditPanel } from "@/components/eks/audit-panel";
import { ArchitecturePanel } from "@/components/eks/architecture-panel";
import { RealtimeFeed } from "@/components/eks/realtime-feed";
import { NewBookingForm } from "@/components/eks/new-booking-form";
import { Sparkles, Activity, Calendar, Users, Wrench, Truck, Package, Repeat, Shield, BookOpen, LayoutDashboard } from "lucide-react";

export default function Home() {
  const { session } = useAuth();
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header session={session} />
      <main className="flex-1 container mx-auto px-4 py-6">
        {!session ? (
          <Landing onAuthed={() => {}} />
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1 mb-4 bg-muted/50 p-1">
              <TabsTrigger value="dashboard" className="gap-1.5"><LayoutDashboard className="w-3.5 h-3.5" /> Dashboard</TabsTrigger>
              <TabsTrigger value="bookings" className="gap-1.5"><Calendar className="w-3.5 h-3.5" /> Bookings</TabsTrigger>
              <TabsTrigger value="dispatch" className="gap-1.5"><Truck className="w-3.5 h-3.5" /> Dispatch</TabsTrigger>
              <TabsTrigger value="workers" className="gap-1.5"><Wrench className="w-3.5 h-3.5" /> Workers</TabsTrigger>
              <TabsTrigger value="customers" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Customers</TabsTrigger>
              <TabsTrigger value="services" className="gap-1.5"><Package className="w-3.5 h-3.5" /> Services</TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-1.5"><Repeat className="w-3.5 h-3.5" /> Subscriptions</TabsTrigger>
              <TabsTrigger value="inventory" className="gap-1.5"><Package className="w-3.5 h-3.5" /> Inventory</TabsTrigger>
              <TabsTrigger value="audit" className="gap-1.5"><Shield className="w-3.5 h-3.5" /> Audit</TabsTrigger>
              <TabsTrigger value="architecture" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Architecture</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                  <AnalyticsOverview />
                  {session.user.role === "CUSTOMER" && <NewBookingForm />}
                </div>
                <div className="space-y-4">
                  <AuthPanel />
                  <RealtimeFeed />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bookings"><BookingsPanel /></TabsContent>
            <TabsContent value="dispatch"><DispatchPanel /></TabsContent>
            <TabsContent value="workers"><WorkersPanel /></TabsContent>
            <TabsContent value="customers"><CustomersPanel /></TabsContent>
            <TabsContent value="services"><ServicesPanel /></TabsContent>
            <TabsContent value="subscriptions"><SubscriptionsPanel /></TabsContent>
            <TabsContent value="inventory"><InventoryPanel /></TabsContent>
            <TabsContent value="audit"><AuditPanel /></TabsContent>
            <TabsContent value="architecture"><ArchitecturePanel /></TabsContent>
          </Tabs>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Header({ session }: { session: ReturnType<typeof useAuth.getState>["session"] }) {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">E</div>
          <div>
            <div className="font-semibold leading-none">Eks-Clean</div>
            <div className="text-[10px] text-muted-foreground">Household Services OS</div>
          </div>
        </div>
        {session && (
          <div className="text-sm">
            <span className="text-muted-foreground hidden sm:inline">Signed in as </span>
            <span className="font-medium">{session.user.fullName}</span>
            <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">{session.user.role}</span>
          </div>
        )}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto px-4 py-3 text-xs text-muted-foreground flex justify-between">
        <div>Eks-Clean v1.0 · Next.js · Prisma · Payswap · socket.io</div>
        <div>© 2026 Eks-Clean</div>
      </div>
    </footer>
  );
}

function Landing({ onAuthed }: { onAuthed: () => void }) {
  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
            <Sparkles className="w-3 h-3" /> Production-grade · Domain-driven · Event-driven
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Eks-Clean</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            An operating system for household services businesses — customers, workers,
            field operations, logistics, subscriptions, inventory, quality assurance, analytics,
            and a future gig marketplace.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Feature title="Modular by design" body="17 bounded contexts, each with its own service, schema, and events. Add new services without code changes." />
          <Feature title="Payment-gateway abstracted" body="Payswap is the only implementation. No business logic depends on it directly. Card data never touches this app." />
          <Feature title="Realtime operations" body="socket.io broadcasts booking transitions, dispatch offers, and admin alerts to every connected client." />
          <Feature title="Audit-grade" body="Every state change is persisted to the audit log and domain events. Soft-deletes preserve history." />
          <Feature title="RBAC + MFA-ready" body="5 roles, 40+ permissions, JWT + refresh-token rotation, rate-limited login, MFA hooks ready." />
          <Feature title="Future-ready" body="Marketplace, AI assistants, and new service categories are gated behind feature flags — flip on at runtime." />
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="font-medium mb-1">Demo accounts (password: <code>EksClean123!</code>)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div><code>admin@eksclean.example</code> — full access</div>
            <div><code>fm1@eksclean.example</code> — field manager</div>
            <div><code>sales1@eksclean.example</code> — sales agent</div>
            <div><code>adwoa@example.com</code> — customer</div>
            <div><code>samuel.w@eksclean.example</code> — worker</div>
            <div><code>kofi@example.com</code> — customer</div>
          </div>
        </div>
      </div>
      <div className="lg:sticky lg:top-6 h-fit">
        <AuthPanel />
      </div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{body}</div>
    </div>
  );
}
