"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, useAuth } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { Server, Brain, Boxes, Zap, Database, GitBranch, Workflow, Settings, Activity, Layers, Globe, Sparkles } from "lucide-react";

export default function AdminConsole() {
  const { session, setSession, clear } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("admin@opsos.io");
  const [password, setPassword] = useState("OpsOS123!");
  const [tab, setTab] = useState("overview");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [apps, setApps] = useState<Array<Record<string, unknown>>>([]);
  const [protocols, setProtocols] = useState<Array<Record<string, unknown>>>([]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ user: { id: string; email: string; fullName: string; organizationId: string | null }; session: { accessToken: string; refreshToken: string } }>("/api/opsos/auth/login", {
        method: "POST", body: JSON.stringify({ email, password }),
      });
      setSession({ ...r.session, user: { ...r.user, role: "ADMIN" } as never });
      if (r.user.organizationId) setOrgId(r.user.organizationId);
      toast({ title: `Welcome, ${r.user.fullName}` });
    } catch (e) {
      toast({ title: "Login failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function loadData() {
    if (!orgId) return;
    try {
      const [appList, protoList, res, cap, dem, ev, rule] = await Promise.all([
        api<{ items: Array<Record<string, unknown>> }>(`/api/admin/apps?organizationId=${orgId}`).catch(() => ({ items: [] })),
        api<{ items: Array<Record<string, unknown>> }>(`/api/admin/protocols?organizationId=${orgId}`).catch(() => ({ items: [] })),
        api<{ items: unknown[] }>(`/api/opsos/resources/list?organizationId=${orgId}`).catch(() => ({ items: [] })),
        api<{ items: unknown[] }>(`/api/opsos/capabilities/list?organizationId=${orgId}`).catch(() => ({ items: [] })),
        api<{ items: unknown[] }>(`/api/opsos/demand/list?organizationId=${orgId}`).catch(() => ({ items: [] })),
        api<{ items: unknown[] }>(`/api/opsos/events?organizationId=${orgId}&limit=1000`).catch(() => ({ items: [] })),
        api<{ items: unknown[] }>(`/api/opsos/rules/list?organizationId=${orgId}`).catch(() => ({ items: [] })),
      ]);
      setApps(appList.items);
      setProtocols(protoList.items);
      setStats({ resources: res.items.length, capabilities: cap.items.length, demands: dem.items.length, events: ev.items.length, rules: rule.items.length });
    } catch {}
  }

  useEffect(() => { if (orgId) loadData(); }, [orgId]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">O</div>
              <div>
                <CardTitle className="text-xl">OpsOS Admin</CardTitle>
                <div className="text-xs text-muted-foreground">Platform Administration Console</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={login} className="space-y-3">
              <input className="w-full px-3 py-2 border rounded" type="text" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input className="w-full px-3 py-2 border rounded" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="submit" className="w-full">Sign In</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = [
    { key: "overview", label: "Overview", icon: Server },
    { key: "protocols", label: "Protocol Manager", icon: Brain },
    { key: "apps", label: "Applications", icon: Globe },
    { key: "runtime", label: "Runtime", icon: Activity },
    { key: "inspector", label: "Inspector", icon: Zap },
    { key: "marketplace", label: "Marketplace", icon: Boxes },
    { key: "events", label: "Event Store", icon: Database },
    { key: "rules", label: "Rules Engine", icon: GitBranch },
    { key: "workflows", label: "Workflows", icon: Workflow },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">O</div>
            <div>
              <div className="font-semibold text-sm leading-none">OpsOS</div>
              <div className="text-[10px] text-muted-foreground">Admin Console</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <button key={item.key} onClick={() => setTab(item.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${tab === item.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <item.icon className="w-4 h-4" /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t">
          <div className="text-xs text-muted-foreground mb-2">{session.user.fullName}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => router.push("/apps/eks-clean")}>View Apps</Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => clear()}>Sign out</Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {tab === "overview" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Platform Overview</h1>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Applications", value: apps.length, icon: Globe },
                { label: "Protocols", value: protocols.length, icon: Brain },
                { label: "Resources", value: stats.resources ?? 0, icon: Boxes },
                { label: "Capabilities", value: stats.capabilities ?? 0, icon: Layers },
                { label: "Events", value: stats.events ?? 0, icon: Database },
              ].map((c) => (
                <Card key={c.label}><CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div><div className="text-xs text-muted-foreground">{c.label}</div><div className="text-2xl font-bold">{c.value}</div></div>
                    <c.icon className="w-8 h-8 opacity-20" />
                  </div>
                </CardContent></Card>
              ))}
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Architecture</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default">OpsOS Kernel</Badge><span>→</span>
                  <Badge variant="secondary">Protocol</Badge><span>→</span>
                  <Badge variant="secondary">Application</Badge><span>→</span>
                  <Badge variant="outline">Organization</Badge><span>→</span>
                  <Badge variant="outline">Users</Badge>
                </div>
                <p className="mt-2">A protocol is installed once. Multiple application instances can be created from the same protocol — each with its own branding, domain, users, and configuration.</p>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "protocols" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Protocol Manager</h1>
              <Button onClick={async () => {
                if (!orgId) return;
                try {
                  await api(`/api/protocols/eks-clean/install`, { method: "POST", body: JSON.stringify({ organizationId: orgId }) });
                  toast({ title: "Eks-Clean protocol installed" });
                  loadData();
                } catch (e) { toast({ title: "Install failed", variant: "destructive" }); }
              }}>Install Eks-Clean Protocol</Button>
            </div>
            <Card><CardContent className="p-0">
              <div className="divide-y">
                {protocols.map((p) => (
                  <div key={p.id as string} className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-medium">{p.name as string}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.protocolKey as string} v{p.protocolVersion as string}</div>
                    </div>
                    <Badge variant={p.status === "ACTIVE" ? "default" : "secondary"}>{p.status as string}</Badge>
                  </div>
                ))}
                {protocols.length === 0 && <div className="p-8 text-center text-muted-foreground">No protocols installed.</div>}
              </div>
            </CardContent></Card>
          </div>
        )}

        {tab === "apps" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Applications</h1>
              <Button onClick={async () => {
                if (!orgId) return;
                try {
                  const r = await api<{ application: { id: string; slug: string } }>(`/api/apps/create`, {
                    method: "POST", body: JSON.stringify({ organizationId: orgId, protocolKey: "eks-clean", name: "Eks-Clean", slug: "eks-clean" }),
                  });
                  toast({ title: "Application created", description: `Access at /apps/${r.application.slug}` });
                  loadData();
                } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
              }}>Create Application</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {apps.map((a) => (
                <Card key={a.id as string} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/apps/${a.slug}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white" style={{ background: (a.primaryColor as string) || "#0066FF" }}>
                        {(a.name as string).charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{a.name as string}</div>
                        <div className="text-xs text-muted-foreground">/apps/{a.slug as string} · {(a.protocolKey as string)}</div>
                      </div>
                      <Badge variant={a.status === "ACTIVE" ? "default" : "secondary"}>{a.status as string}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {apps.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">No applications yet. Create one to get started.</CardContent></Card>}
            </div>
          </div>
        )}

        {tab === "runtime" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Runtime</h1>
            <Card><CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><div className="text-muted-foreground">Mode</div><div className="font-medium">WALL</div></div>
                <div><div className="text-muted-foreground">Deterministic</div><div className="font-medium text-green-600">Yes</div></div>
                <div><div className="text-muted-foreground">Event-Sourced</div><div className="font-medium text-green-600">Yes</div></div>
              </div>
            </CardContent></Card>
          </div>
        )}

        {tab === "inspector" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Inspector</h1>
            <InspectorView orgId={orgId} />
          </div>
        )}

        {tab === "marketplace" && (
          <div className="space-y-4"><h1 className="text-2xl font-bold">Marketplace</h1><Card><CardContent className="p-8 text-center text-muted-foreground">Marketplace management — capacity trading, offers, reservations.</CardContent></Card></div>
        )}
        {tab === "events" && <EventStoreView orgId={orgId} />}
        {tab === "rules" && <RulesView orgId={orgId} />}
        {tab === "workflows" && <div className="space-y-4"><h1 className="text-2xl font-bold">Workflows</h1><Card><CardContent className="p-8 text-center text-muted-foreground">Configurable workflow engine — stages, tasks, checklists, quality gates.</CardContent></Card></div>}
        {tab === "settings" && <div className="space-y-4"><h1 className="text-2xl font-bold">Settings</h1><Card><CardContent className="p-8 text-center text-muted-foreground">Platform settings, feature flags, API keys, secrets.</CardContent></Card></div>}
      </main>
    </div>
  );
}

function InspectorView({ orgId }: { orgId: string | null }) {
  const [data, setData] = useState<{ stats: Record<string, number>; graph: { nodes: unknown[]; edges: unknown[] } } | null>(null);
  useEffect(() => {
    if (!orgId) return;
    api<{ stats: Record<string, number>; graph: { nodes: unknown[]; edges: unknown[] } }>(`/api/opsos/inspector/graph?organizationId=${orgId}`).then(setData).catch(() => {});
  }, [orgId]);
  if (!data) return <div className="text-muted-foreground">Loading...</div>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Object.entries(data.stats).map(([k, v]) => (
          <Card key={k}><CardContent className="p-3"><div className="text-xs text-muted-foreground capitalize">{k}</div><div className="text-xl font-bold">{v}</div></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-4">
        <div className="text-sm text-muted-foreground">Execution Graph: {data.graph.nodes.length} nodes, {data.graph.edges.length} edges</div>
      </CardContent></Card>
    </div>
  );
}

function EventStoreView({ orgId }: { orgId: string | null }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    if (!orgId) return;
    api<{ items: Array<Record<string, unknown>> }>(`/api/opsos/events?organizationId=${orgId}&limit=50`).then(r => setItems(r.items)).catch(() => {});
  }, [orgId]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Event Store ({items.length})</h1>
      <Card><CardContent className="p-0">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase sticky top-0"><tr><th className="text-left p-3">Aggregate</th><th className="text-left p-3">Event</th><th className="text-right p-3">Ver</th><th className="text-left p-3">Time</th></tr></thead>
            <tbody>{items.map((e) => (<tr key={e.id as string} className="border-b last:border-0 hover:bg-muted/30"><td className="p-3 font-mono text-xs">{e.aggregateType as string}</td><td className="p-3 font-mono text-xs">{e.eventType as string}</td><td className="p-3 text-right">{e.version as number}</td><td className="p-3 text-xs text-muted-foreground">{new Date(e.occurredAt as string).toLocaleString()}</td></tr>))}</tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

function RulesView({ orgId }: { orgId: string | null }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    if (!orgId) return;
    api<{ items: Array<Record<string, unknown>> }>(`/api/opsos/rules/list?organizationId=${orgId}`).then(r => setItems(r.items)).catch(() => {});
  }, [orgId]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Rules Engine ({items.length})</h1>
      <Card><CardContent className="p-0">
        <div className="divide-y">{items.map((r) => (<div key={r.id as string} className="p-3"><div className="flex justify-between"><span className="font-medium text-sm">{r.name as string}</span><Badge variant={r.isActive ? "default" : "secondary"} className="text-xs">{r.isActive ? "Active" : "Inactive"}</Badge></div><div className="text-xs text-muted-foreground mt-1">Trigger: {r.triggerEvent as string}</div></div>))}</div>
      </CardContent></Card>
    </div>
  );
}
