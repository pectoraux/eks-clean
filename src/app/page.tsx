"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/client";
import { AuthPanel } from "@/components/eks/auth-panel";
import { RealtimeFeed } from "@/components/eks/realtime-feed";
import { Sparkles, Activity, Calendar, Users, Wrench, Truck, Package, Repeat, Shield, BookOpen, LayoutDashboard, Briefcase, GraduationCap, Workflow, Heart } from "lucide-react";

// Lazy-load all heavy panels to reduce initial compile memory footprint.
const AnalyticsOverview = dynamic(() => import("@/components/eks/analytics-overview").then(m => ({ default: m.AnalyticsOverview })));
const NewBookingForm = dynamic(() => import("@/components/eks/new-booking-form").then(m => ({ default: m.NewBookingForm })));
const BookingsPanel = dynamic(() => import("@/components/eks/bookings-panel").then(m => ({ default: m.BookingsPanel })));
const WorkersPanel = dynamic(() => import("@/components/eks/workers-panel").then(m => ({ default: m.WorkersPanel })));
const CustomersPanel = dynamic(() => import("@/components/eks/customers-panel").then(m => ({ default: m.CustomersPanel })));
const ServicesPanel = dynamic(() => import("@/components/eks/services-panel").then(m => ({ default: m.ServicesPanel })));
const DispatchPanel = dynamic(() => import("@/components/eks/dispatch-panel").then(m => ({ default: m.DispatchPanel })));
const InventoryPanel = dynamic(() => import("@/components/eks/inventory-panel").then(m => ({ default: m.InventoryPanel })));
const SubscriptionsPanel = dynamic(() => import("@/components/eks/subscriptions-panel").then(m => ({ default: m.SubscriptionsPanel })));
const AuditPanel = dynamic(() => import("@/components/eks/audit-panel").then(m => ({ default: m.AuditPanel })));
const ArchitecturePanel = dynamic(() => import("@/components/eks/architecture-panel").then(m => ({ default: m.ArchitecturePanel })));
const CrmPanel = dynamic(() => import("@/components/eks/crm-panel").then(m => ({ default: m.CrmPanel })));
const OperationsPanel = dynamic(() => import("@/components/eks/operations-panel").then(m => ({ default: m.OperationsPanel })));
const LmsPanel = dynamic(() => import("@/components/eks/lms-panel").then(m => ({ default: m.LmsPanel })));
const EnterprisePanel = dynamic(() => import("@/components/eks/enterprise-panel").then(m => ({ default: m.EnterprisePanel })));
const WorkflowsPanel = dynamic(() => import("@/components/eks/workflows-panel").then(m => ({ default: m.WorkflowsPanel })));

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
              <TabsTrigger value="crm" className="gap-1.5"><Heart className="w-3.5 h-3.5" /> CRM</TabsTrigger>
              <TabsTrigger value="operations" className="gap-1.5"><Activity className="w-3.5 h-3.5" /> Operations</TabsTrigger>
              <TabsTrigger value="lms" className="gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> LMS</TabsTrigger>
              <TabsTrigger value="enterprise" className="gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Enterprise</TabsTrigger>
              <TabsTrigger value="workflows" className="gap-1.5"><Workflow className="w-3.5 h-3.5" /> Workflows</TabsTrigger>
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
            <TabsContent value="crm"><CrmPanel /></TabsContent>
            <TabsContent value="operations"><OperationsPanel /></TabsContent>
            <TabsContent value="lms"><LmsPanel /></TabsContent>
            <TabsContent value="enterprise"><EnterprisePanel /></TabsContent>
            <TabsContent value="workflows"><WorkflowsPanel /></TabsContent>
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
        <div>Eks-Clean v2.0 ERP · Next.js · Prisma · Payswap · socket.io</div>
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
            <Sparkles className="w-3 h-3" /> Production-grade ERP · 26 modules · Event-driven
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Eks-Clean</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            A complete Household Operations ERP — customers, workers, dispatch, logistics,
            subscriptions, inventory, quality, CRM, cleaning protocols, training LMS,
            supply chain, fleet, enterprise contracts, configurable workflows, advanced
            analytics, and a future gig marketplace.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Feature title="26 bounded contexts" body="9 new ERP modules layered on the original 17 — CRM, Protocols, LMS, SCM, Fleet, Contracts, Workflows, Analytics+, AI-ready actions." />
          <Feature title="Payment-gateway abstracted" body="Payswap is the only implementation. No business logic depends on it directly. Card data never touches this app." />
          <Feature title="Configurable workflow engine" body="Versioned state machines with guards, triggers, and AI-ready action adapters (LLM, forecast, classify, webhook)." />
          <Feature title="Audit-grade + RBAC" body="5 roles, 60+ permissions, JWT + refresh rotation, audit log on every state change, soft-deletes." />
          <Feature title="Realtime operations" body="socket.io broadcasts booking transitions, dispatch offers, contract milestones, workflow transitions." />
          <Feature title="Enterprise B2B + B2C" body="Per-customer SLAs, milestone tracking, billing schedules, contract performance metrics — alongside consumer subscriptions." />
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="font-medium mb-1">Quick login (demo accounts)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div><code>ekontetevi@gmail</code> — <strong>real admin</strong> (password: <code>Payswap123456</code>)</div>
            <div><code>admin@eksclean.example</code> — demo admin (<code>EksClean123!</code>)</div>
            <div><code>fm1@eksclean.example</code> — field manager</div>
            <div><code>sales1@eksclean.example</code> — sales agent</div>
            <div><code>adwoa@example.com</code> — customer</div>
            <div><code>samuel.w@eksclean.example</code> — worker</div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Sign-up is waitlist-based: requests go to a queue, the admin approves each one before an account is created.
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
