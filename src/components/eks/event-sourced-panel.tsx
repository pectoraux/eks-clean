"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface Event { id: string; aggregateType: string; aggregateId: string; eventType: string; version: number; occurredAt: string; }
interface Metrics { totalEvents: number; projectionsCount: number; queriesCount: number; recentEvents: Event[]; }

export function EventSourcedPanel() {
  const [tab, setTab] = useState<"overview" | "events" | "projections" | "queries">("overview");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [projections, setProjections] = useState<Array<{ id: string; projectionName: string; aggregateKey: string; valueJson: string; updatedAt: string }>>([]);
  const [queries, setQueries] = useState<Array<{ id: string; name: string; queryType: string; dataSource: string; isPublic: boolean }>>([]);
  const { toast } = useToast();

  async function loadMetrics() { try { setMetrics(await api<Metrics>("/api/analytics-event-sourced/metrics")); } catch {} }
  async function loadEvents() { try { setEvents((await api<{ items: Event[] }>("/api/analytics-event-sourced/events?limit=50")).items); } catch {} }
  async function loadProjections() {
    try {
      // Try monthly_revenue projection
      const r = await api<{ items: Array<{ id: string; projectionName: string; aggregateKey: string; valueJson: string; updatedAt: string }> }>("/api/analytics-event-sourced/projections/monthly_revenue");
      setProjections(r.items);
    } catch { setProjections([]); }
  }
  async function loadQueries() { try { setQueries((await api<{ items: Array<{ id: string; name: string; queryType: string; dataSource: string; isPublic: boolean }> }>("/api/analytics-event-sourced/queries")).items); } catch {} }

  useEffect(() => {
    if (tab === "overview") loadMetrics();
    if (tab === "events") loadEvents();
    if (tab === "projections") loadProjections();
    if (tab === "queries") loadQueries();
  }, [tab]);

  async function rebuildProj() {
    try { await api("/api/analytics-event-sourced/projections/monthly_revenue/rebuild", { method: "POST" }); toast({ title: "Projection rebuilt" }); loadProjections(); } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["overview", "events", "projections", "queries"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">{t}</Button>
        ))}
      </div>

      {tab === "overview" && metrics && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Events</div><div className="text-2xl font-bold">{metrics.totalEvents}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Projections</div><div className="text-2xl font-bold">{metrics.projectionsCount}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Saved Queries</div><div className="text-2xl font-bold">{metrics.queriesCount}</div></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Events</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-96 overflow-y-auto">
                {metrics.recentEvents.map((e) => (
                  <div key={e.id} className="p-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-mono">{e.aggregateType}:{e.eventType}</span>
                      <span className="text-muted-foreground">v{e.version}</span>
                    </div>
                    <div className="text-muted-foreground">{new Date(e.occurredAt).toLocaleString()} · {e.aggregateId.slice(-8)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "events" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Event Log ({events.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase sticky top-0"><tr>
                  <th className="text-left p-3">Aggregate</th>
                  <th className="text-left p-3">Event</th>
                  <th className="text-right p-3">Ver</th>
                  <th className="text-left p-3">Occurred</th>
                </tr></thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{e.aggregateType}:{e.aggregateId.slice(-6)}</td>
                      <td className="p-3 font-mono text-xs">{e.eventType}</td>
                      <td className="p-3 text-right">{e.version}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(e.occurredAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "projections" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">monthly_revenue Projection ({projections.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={rebuildProj}>Rebuild</Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Month</th>
                  <th className="text-left p-3">Value</th>
                  <th className="text-left p-3">Updated</th>
                </tr></thead>
                <tbody>
                  {projections.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono">{p.aggregateKey}</td>
                      <td className="p-3 text-xs">{p.valueJson}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(p.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {projections.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">No projections yet. Click Rebuild to materialize.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "queries" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Saved Queries ({queries.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {queries.map((q) => (
                <div key={q.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{q.name}</div>
                    <div className="text-xs text-muted-foreground">{q.queryType} · {q.dataSource}</div>
                  </div>
                  <Badge variant={q.isPublic ? "default" : "secondary"} className="text-xs">{q.isPublic ? "Public" : "Private"}</Badge>
                </div>
              ))}
              {queries.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No saved queries.</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
