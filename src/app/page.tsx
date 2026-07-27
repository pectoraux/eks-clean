"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api, useAuth } from "@/lib/client";
import { Server, Workflow, Database, Brain, GitBranch, Boxes, Activity, Layers, Clock, Zap } from "lucide-react";

export default function Home() {
  const { session, setSession, clear } = useAuth();
  const [tab, setTab] = useState("overview");
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ user: { id: string; email: string; fullName: string; organizationId: string | null }; session: { accessToken: string; refreshToken: string } }>("/api/opsos/auth/login", {
        method: "POST", body: JSON.stringify({ email, password }),
      });
      setSession({ ...r.session, user: r.user });
      if (r.user.organizationId) setOrgId(r.user.organizationId);
      toast({ title: `Welcome, ${r.user.fullName}` });
    } catch (e) {
      toast({ title: "Login failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">O</div>
              <div>
                <CardTitle className="text-xl">OpsOS</CardTitle>
                <div className="text-xs text-muted-foreground">Operations Operating System</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={login} className="space-y-3">
              <Input type="text" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="submit" className="w-full">Sign In</Button>
            </form>
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <p>OpsOS is a domain-independent kernel.</p>
              <p>Businesses are installed as Protocols via the Protocol SDK.</p>
              <p>No business-specific concepts exist inside the kernel.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">O</div>
            <div>
              <div className="font-semibold leading-none">OpsOS <span className="text-[10px] text-muted-foreground font-normal ml-1">Operations Operating System</span></div>
              <div className="text-[10px] text-muted-foreground">Domain-Independent Kernel</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm">{session.user.fullName}</span>
            <Button size="sm" variant="outline" onClick={() => clear()}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4 bg-muted/50 p-1">
            <TabsTrigger value="overview" className="gap-1.5"><Server className="w-3.5 h-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="demand" className="gap-1.5"><Activity className="w-3.5 h-3.5" /> Demand</TabsTrigger>
            <TabsTrigger value="resources" className="gap-1.5"><Boxes className="w-3.5 h-3.5" /> Resources</TabsTrigger>
            <TabsTrigger value="capabilities" className="gap-1.5"><Layers className="w-3.5 h-3.5" /> Capabilities</TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5"><Database className="w-3.5 h-3.5" /> Events</TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5"><GitBranch className="w-3.5 h-3.5" /> Rules</TabsTrigger>
            <TabsTrigger value="workflows" className="gap-1.5"><Workflow className="w-3.5 h-3.5" /> Workflows</TabsTrigger>
            <TabsTrigger value="inspector" className="gap-1.5"><Zap className="w-3.5 h-3.5" /> Inspector</TabsTrigger>
            <TabsTrigger value="protocols" className="gap-1.5"><Brain className="w-3.5 h-3.5" /> Protocols</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab orgId={orgId} /></TabsContent>
          <TabsContent value="demand"><DemandTab orgId={orgId} /></TabsContent>
          <TabsContent value="resources"><ResourcesTab orgId={orgId} /></TabsContent>
          <TabsContent value="capabilities"><CapabilitiesTab orgId={orgId} /></TabsContent>
          <TabsContent value="events"><EventsTab orgId={orgId} /></TabsContent>
          <TabsContent value="rules"><RulesTab orgId={orgId} /></TabsContent>
          <TabsContent value="workflows"><WorkflowsTab orgId={orgId} /></TabsContent>
          <TabsContent value="inspector"><InspectorTab orgId={orgId} /></TabsContent>
          <TabsContent value="protocols"><ProtocolsTab orgId={orgId} /></TabsContent>
        </Tabs>
      </main>
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-3 text-xs text-muted-foreground flex justify-between">
          <div>OpsOS v1.0 · Event-Sourced · CQRS · DDD · Deterministic Runtime</div>
          <div>© 2026 OpsOS</div>
        </div>
      </footer>
    </div>
  );
}

// --- Overview Tab ---
function OverviewTab({ orgId }: { orgId: string | null }) {
  const [stats, setStats] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const [demands, resources, capabilities, events, rules, plans] = await Promise.all([
          api<{ items: unknown[] }>(`/api/opsos/demand/list?organizationId=${orgId}`),
          api<{ items: unknown[] }>(`/api/opsos/resources/list?organizationId=${orgId}`),
          api<{ items: unknown[] }>(`/api/opsos/capabilities/list?organizationId=${orgId}`),
          api<{ items: unknown[] }>(`/api/opsos/events?organizationId=${orgId}&limit=1000`),
          api<{ items: unknown[] }>(`/api/opsos/rules/list?organizationId=${orgId}`),
          api<{ items: unknown[] }>(`/api/opsos/demand/list?organizationId=${orgId}`),
        ]);
        setStats({ demands: demands.items.length, resources: resources.items.length, capabilities: capabilities.items.length, events: events.items.length, rules: rules.items.length });
      } catch {}
    })();
  }, [orgId]);

  const cards = [
    { label: "Demands", value: stats.demands ?? 0, icon: Activity, color: "text-blue-600" },
    { label: "Resources", value: stats.resources ?? 0, icon: Boxes, color: "text-green-600" },
    { label: "Capabilities", value: stats.capabilities ?? 0, icon: Layers, color: "text-purple-600" },
    { label: "Events (Store)", value: stats.events ?? 0, icon: Database, color: "text-amber-600" },
    { label: "Rules", value: stats.rules ?? 0, icon: GitBranch, color: "text-red-600" },
    { label: "Execution Plans", value: stats.demands ?? 0, icon: Workflow, color: "text-cyan-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Card key={c.label}><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="text-2xl font-bold">{c.value}</div>
              </div>
              <c.icon className={`w-8 h-8 ${c.color} opacity-20`} />
            </div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">OpsOS Kernel — Bounded Contexts</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {["Identity", "Organizations", "Authentication", "Authorization", "Runtime", "Intent Engine", "Execution Engine", "Workflow Engine", "Rules Engine", "Policy Engine", "Scheduling Engine", "Capability Registry", "Resource Engine", "Marketplace Engine", "Routing Engine", "Recommendation Engine", "Simulation Engine", "Projection Engine", "Event Store", "Read Model Engine", "Notification Engine", "Observability", "Inspector", "Extension Loader", "Configuration", "Feature Flags"].map((ctx) => (
              <div key={ctx} className="flex items-center justify-between p-2 rounded border">
                <span>{ctx}</span>
                <Badge variant="outline" className="text-[10px] bg-green-50">Active</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Universal Lifecycle</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-1">
            {["Demand", "Intent", "Validation", "Policy", "Capability", "Resource", "Scheduling", "Routing", "Execution Plan", "Execution", "Observation", "Measurement", "Learning", "Recommendations"].map((stage, i, arr) => (
              <span key={stage} className="flex items-center gap-1">
                <Badge variant={i < 2 ? "default" : "secondary"} className="text-xs">{stage}</Badge>
                {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Demand Tab ---
function DemandTab({ orgId }: { orgId: string | null }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    if (!orgId) return;
    api<{ items: Array<Record<string, unknown>> }>(`/api/opsos/demand/list?organizationId=${orgId}`).then(r => setItems(r.items)).catch(() => {});
  }, [orgId]);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Demand Pipeline ({items.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase"><tr>
              <th className="text-left p-3">Code</th><th className="text-left p-3">Source</th>
              <th className="text-left p-3">Capability</th><th className="text-left p-3">Status</th>
              <th className="text-left p-3">Priority</th><th className="text-left p-3">Created</th>
            </tr></thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id as string} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{d.code as string}</td>
                  <td className="p-3">{d.source as string}</td>
                  <td className="p-3 text-xs">{(d.capabilityCode as string) ?? "—"}</td>
                  <td className="p-3"><Badge variant="secondary" className="text-xs">{d.status as string}</Badge></td>
                  <td className="p-3"><Badge variant="outline" className="text-xs">{d.priority as string}</Badge></td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(d.createdAt as string).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Resources Tab ---
function ResourcesTab({ orgId }: { orgId: string | null }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    if (!orgId) return;
    api<{ items: Array<Record<string, unknown>> }>(`/api/opsos/resources/list?organizationId=${orgId}`).then(r => setItems(r.items)).catch(() => {});
  }, [orgId]);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Resources ({items.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase"><tr>
              <th className="text-left p-3">Code</th><th className="text-left p-3">Name</th>
              <th className="text-left p-3">Type</th><th className="text-left p-3">Status</th>
            </tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id as string} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{r.code as string}</td>
                  <td className="p-3">{r.name as string}</td>
                  <td className="p-3"><Badge variant="outline" className="text-xs">{r.resourceType as string}</Badge></td>
                  <td className="p-3"><Badge variant={r.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">{r.status as string}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Capabilities Tab ---
function CapabilitiesTab({ orgId }: { orgId: string | null }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    if (!orgId) return;
    api<{ items: Array<Record<string, unknown>> }>(`/api/opsos/capabilities/list?organizationId=${orgId}`).then(r => setItems(r.items)).catch(() => {});
  }, [orgId]);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Capability Registry ({items.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase"><tr>
              <th className="text-left p-3">Code</th><th className="text-left p-3">Name</th>
              <th className="text-left p-3">Version</th><th className="text-left p-3">Protocol</th>
            </tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id as string} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{c.code as string}</td>
                  <td className="p-3">{c.name as string}</td>
                  <td className="p-3 text-xs">{c.version as string}</td>
                  <td className="p-3 text-xs">{(c.protocolId as string)?.slice(-8) ?? "kernel"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Events Tab (Event Store) ---
function EventsTab({ orgId }: { orgId: string | null }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    if (!orgId) return;
    api<{ items: Array<Record<string, unknown>> }>(`/api/opsos/events?organizationId=${orgId}&limit=50`).then(r => setItems(r.items)).catch(() => {});
  }, [orgId]);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Event Store ({items.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase sticky top-0"><tr>
              <th className="text-left p-3">Aggregate</th><th className="text-left p-3">Event</th>
              <th className="text-right p-3">Ver</th><th className="text-left p-3">Occurred</th>
            </tr></thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id as string} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{e.aggregateType as string}:{(e.aggregateId as string)?.slice(-6)}</td>
                  <td className="p-3 font-mono text-xs">{e.eventType as string}</td>
                  <td className="p-3 text-right">{e.version as number}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(e.occurredAt as string).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Rules Tab ---
function RulesTab({ orgId }: { orgId: string | null }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    if (!orgId) return;
    api<{ items: Array<Record<string, unknown>> }>(`/api/opsos/rules/list?organizationId=${orgId}`).then(r => setItems(r.items)).catch(() => {});
  }, [orgId]);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Rules Engine ({items.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {items.map((r) => (
            <div key={r.id as string} className="p-3">
              <div className="flex justify-between">
                <span className="font-medium text-sm">{r.name as string}</span>
                <Badge variant={r.isActive ? "default" : "secondary"} className="text-xs">{r.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Trigger: {r.triggerEvent as string} · Priority: {r.priority as number}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Workflows Tab ---
function WorkflowsTab({ orgId }: { orgId: string | null }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Workflow Engine</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>Workflows are entirely configurable. No workflow is hardcoded.</p>
        <p className="mt-2">Workflow → Stages → Tasks → Checklists → Approvals → Quality Gates → Completion Rules</p>
      </CardContent>
    </Card>
  );
}

// --- Inspector Tab ---
function InspectorTab({ orgId }: { orgId: string | null }) {
  const [graph, setGraph] = useState<{ nodes: Array<{ id: string; label: string; type: string; status?: string }>; edges: Array<{ from: string; to: string; label?: string }> } | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!orgId) return;
    api<{ graph: { nodes: Array<{ id: string; label: string; type: string; status?: string }>; edges: Array<{ from: string; to: string; label?: string }> }; stats: Record<string, number> }>(`/api/opsos/inspector/graph?organizationId=${orgId}`).then(r => { setGraph(r.graph); setStats(r.stats); }).catch(() => {});
  }, [orgId]);

  const typeColors: Record<string, string> = {
    DEMAND: "bg-blue-100 text-blue-800",
    INTENT: "bg-purple-100 text-purple-800",
    EXECUTION_PLAN: "bg-green-100 text-green-800",
    EVENT: "bg-amber-100 text-amber-800",
    RESOURCE: "bg-cyan-100 text-cyan-800",
    CAPABILITY: "bg-pink-100 text-pink-800",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(stats).map(([k, v]) => (
          <Card key={k}><CardContent className="p-3">
            <div className="text-xs text-muted-foreground capitalize">{k}</div>
            <div className="text-xl font-bold">{v}</div>
          </CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Execution Graph</CardTitle></CardHeader>
        <CardContent>
          {graph && graph.nodes.length > 0 ? (
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {graph.nodes.map((n) => (
                <div key={n.id} className="flex items-center gap-2 p-2 border rounded">
                  <span className={`inline-block w-2 h-2 rounded-full ${typeColors[n.type] ? typeColors[n.type].split(" ")[0].replace("bg-", "bg-") : "bg-gray-300"}`} />
                  <span className={`text-xs px-2 py-0.5 rounded ${typeColors[n.type] ?? "bg-gray-100"}`}>{n.type}</span>
                  <span className="text-sm font-mono">{n.label}</span>
                  {n.status && <Badge variant="outline" className="text-xs ml-auto">{n.status}</Badge>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">No execution graph data yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Protocols Tab ---
function ProtocolsTab({ orgId }: { orgId: string | null }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<Record<string, unknown> | null>(null);
  const { toast } = useToast();

  async function loadProtocols() {
    if (!orgId) return;
    try { const r = await api<{ items: Array<Record<string, unknown>> }>(`/api/opsos/protocols/list?organizationId=${orgId}`); setItems(r.items); } catch {}
  }

  useEffect(() => { loadProtocols(); }, [orgId]);

  async function installEksClean() {
    if (!orgId) return;
    setInstalling(true);
    try {
      const r = await api<{ installed: boolean; registered: Record<string, number> }>(`/api/protocols/eks-clean/install`, {
        method: "POST", body: JSON.stringify({ organizationId: orgId }),
      });
      setInstallResult(r);
      toast({ title: "Eks-Clean protocol installed!", description: `${r.registered.capabilities} capabilities, ${r.registered.workflows} workflows, ${r.registered.rules} rules` });
      loadProtocols();
    } catch (e) {
      toast({ title: "Installation failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Protocol SDK</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Protocols are dynamically discovered. Kernel code never changes.</p>
          <p className="mt-2">Every protocol implements:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-2 text-xs font-mono">
            {["registerCapabilities()", "registerIntentDefinitions()", "registerPolicies()", "registerRules()", "registerCompilerStages()", "registerWorkflows()", "registerMarketplace()", "registerPricing()", "registerDashboards()", "registerReadModels()", "registerAnalytics()", "registerApi()", "registerUi()"].map(m => (
              <div key={m} className="p-1 rounded bg-muted/50">{m}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      {items.length === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader><CardTitle className="text-base">Install Eks-Clean Protocol</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Eks-Clean is the first OpsOS protocol. It registers cleaning capabilities
              (residential, commercial, deep, move-in/out, laundry, carpet, upholstery, window, waste),
              surface intelligence, chemical intelligence, property digital twins, dynamic pricing,
              route optimization, enterprise customers, and AI-ready event collection —
              all through the Protocol SDK, without modifying the kernel.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="p-2 border rounded"><strong>11</strong> Capabilities</div>
              <div className="p-2 border rounded"><strong>10</strong> Intent Definitions</div>
              <div className="p-2 border rounded"><strong>4</strong> Policies</div>
              <div className="p-2 border rounded"><strong>5</strong> Rules</div>
              <div className="p-2 border rounded"><strong>4</strong> Workflows</div>
              <div className="p-2 border rounded"><strong>5</strong> Pricing Models</div>
              <div className="p-2 border rounded"><strong>2</strong> Dashboards</div>
              <div className="p-2 border rounded"><strong>6</strong> Read Models</div>
              <div className="p-2 border rounded"><strong>6</strong> Analytics Queries</div>
              <div className="p-2 border rounded"><strong>8</strong> API Endpoints</div>
              <div className="p-2 border rounded"><strong>8</strong> UI Components</div>
              <div className="p-2 border rounded"><strong>4</strong> Compiler Stages</div>
            </div>
            <Button onClick={installEksClean} disabled={installing} className="w-full">
              {installing ? "Installing..." : "Install Eks-Clean Protocol"}
            </Button>
            {installResult && (
              <div className="text-xs text-green-600 mt-2">
                ✓ Installed: {installResult.registered?.capabilities} capabilities, {installResult.registered?.workflows} workflows, {installResult.registered?.rules} rules, {installResult.registered?.policies} policies
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Installed Protocols ({items.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {items.map((p) => (
              <div key={p.id as string} className="p-3 flex justify-between items-center">
                <div>
                  <div className="font-medium text-sm">{p.name as string}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.protocolKey as string} v{p.protocolVersion as string}</div>
                </div>
                <Badge variant={p.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">{p.status as string}</Badge>
              </div>
            ))}
            {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No protocols installed yet. Install a protocol (e.g. Eks-Clean) to add business semantics.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
