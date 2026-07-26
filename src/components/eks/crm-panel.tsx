"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface Deal { id: string; title: string; stage: string; valueMinor: number; probability: number; customer: { user: { fullName: string } }; }
interface Touchpoint { id: string; channel: string; direction: string; subject: string | null; outcome: string | null; occurredAt: string; customer: { user: { fullName: string } }; }
interface HealthScore { id: string; score: number; tier: string; customer: { user: { fullName: string } }; }
interface Segment { id: string; name: string; memberCount: number; _count: { memberships: number }; }

function minorToGhs(m: number) { return `₵${(m / 100).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`; }

export function CrmPanel() {
  const [tab, setTab] = useState<"deals" | "touchpoints" | "health" | "segments">("deals");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [health, setHealth] = useState<HealthScore[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const { toast } = useToast();

  async function loadDeals() {
    try { const r = await api<{ items: Deal[] }>("/api/crm/segments?type=deals"); setDeals(r.items); } catch (e) { /* ignore */ }
  }
  async function loadTouchpoints() {
    try { const r = await api<{ items: Touchpoint[] }>("/api/crm/segments?type=touchpoints"); setTouchpoints(r.items); } catch (e) { /* ignore */ }
  }
  async function loadHealth() {
    try { const r = await api<{ items: HealthScore[] }>("/api/crm/segments?type=health"); setHealth(r.items); } catch (e) { /* ignore */ }
  }
  async function loadSegments() {
    try { const r = await api<{ items: Segment[] }>("/api/crm/segments?type=segments"); setSegments(r.items); } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    if (tab === "deals") loadDeals();
    if (tab === "touchpoints") loadTouchpoints();
    if (tab === "health") loadHealth();
    if (tab === "segments") loadSegments();
  }, [tab]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["deals", "touchpoints", "health", "segments"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">{t}</Button>
        ))}
      </div>

      {tab === "deals" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Sales Pipeline ({deals.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Title</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Stage</th>
                  <th className="text-right p-3">Value</th>
                  <th className="text-right p-3">Prob.</th>
                  <th className="text-right p-3">Action</th>
                </tr></thead>
                <tbody>
                  {deals.map((d) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{d.title}</td>
                      <td className="p-3">{d.customer.user.fullName}</td>
                      <td className="p-3"><Badge variant="outline">{d.stage}</Badge></td>
                      <td className="p-3 text-right">{minorToGhs(d.valueMinor)}</td>
                      <td className="p-3 text-right text-xs">{(d.probability * 100).toFixed(0)}%</td>
                      <td className="p-3 text-right">
                        {d.stage !== "WON" && d.stage !== "LOST" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                            try {
                              const stages = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON"];
                              const next = stages[stages.indexOf(d.stage) + 1];
                              if (next) {
                                await api(`/api/crm/deals/${d.id}/stage`, { method: "POST", body: JSON.stringify({ stage: next }) });
                                toast({ title: `Advanced to ${next}` });
                                loadDeals();
                              }
                            } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
                          }}>Advance →</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "touchpoints" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent Touchpoints ({touchpoints.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {touchpoints.map((t) => (
                <div key={t.id} className="p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{t.customer.user.fullName}</span>
                    <span className="text-xs text-muted-foreground">{new Date(t.occurredAt).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{t.channel}</Badge>
                    <Badge variant="secondary" className="text-xs">{t.direction}</Badge>
                    {t.outcome && <Badge variant="outline" className="text-xs">{t.outcome}</Badge>}
                  </div>
                  {t.subject && <div className="text-xs text-muted-foreground mt-1">{t.subject}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "health" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Customer Health Scores</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-right p-3">Score</th>
                  <th className="text-left p-3">Tier</th>
                </tr></thead>
                <tbody>
                  {health.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{h.customer.user.fullName}</td>
                      <td className="p-3 text-right font-medium">{h.score.toFixed(1)}</td>
                      <td className="p-3"><Badge variant={h.tier === "CHAMPION" ? "default" : h.tier === "RISK" ? "destructive" : "secondary"}>{h.tier}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "segments" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Customer Segments</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {segments.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s._count.memberships} members</div>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                  try {
                    const r = await api<{ added: number; removed: number; total: number }>(`/api/crm/segments/${s.id}/recompute`, { method: "POST" });
                    toast({ title: "Recomputed", description: `+${r.added} -${r.removed} = ${r.total} total` });
                    loadSegments();
                  } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
                }}>Recompute</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
