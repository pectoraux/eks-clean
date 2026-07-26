"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface TimeOff { id: string; type: string; startDate: string; endDate: string; status: string; reason: string | null; worker: { user: { fullName: string } }; }
interface Shift { id: string; date: string; startTime: string; endTime: string; type: string; status: string; zone: string | null; worker: { user: { fullName: string } }; }
interface Skill { id: string; code: string; name: string; category: string; levels: number; _count: { assessments: number }; }
interface Metrics { totalWorkers: number; activeWorkers: number; pendingTimeOff: number; scheduledToday: number; onLeaveToday: number; avgPerformanceScore: number; }

export function WorkforcePanel() {
  const [tab, setTab] = useState<"overview" | "timeoff" | "shifts" | "skills">("overview");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [timeoff, setTimeoff] = useState<TimeOff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const { toast } = useToast();

  async function loadMetrics() { try { setMetrics(await api<Metrics>("/api/workforce/metrics")); } catch {} }
  async function loadTimeoff() { try { setTimeoff((await api<{ items: TimeOff[] }>("/api/workforce/timeoff?status=PENDING")).items); } catch {} }
  async function loadShifts() { try { setShifts((await api<{ items: Shift[] }>("/api/workforce/shifts")).items); } catch {} }
  async function loadSkills() { try { setSkills((await api<{ items: Skill[] }>("/api/workforce/skills")).items); } catch {} }

  useEffect(() => {
    if (tab === "overview") loadMetrics();
    if (tab === "timeoff") loadTimeoff();
    if (tab === "shifts") loadShifts();
    if (tab === "skills") loadSkills();
  }, [tab]);

  async function approve(id: string) {
    try { await api(`/api/workforce/timeoff/${id}/approve`, { method: "POST" }); toast({ title: "Approved" }); loadTimeoff(); } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
  }
  async function deny(id: string) {
    const reason = window.prompt("Denial reason:");
    if (!reason) return;
    try { await api(`/api/workforce/timeoff/${id}/deny`, { method: "POST", body: JSON.stringify({ denialReason: reason }) }); toast({ title: "Denied" }); loadTimeoff(); } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["overview", "timeoff", "shifts", "skills"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">{t}</Button>
        ))}
      </div>

      {tab === "overview" && metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Workers</div><div className="text-2xl font-bold">{metrics.totalWorkers}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active</div><div className="text-2xl font-bold text-green-600">{metrics.activeWorkers}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pending Time-Off</div><div className="text-2xl font-bold text-amber-600">{metrics.pendingTimeOff}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Scheduled Today</div><div className="text-2xl font-bold">{metrics.scheduledToday}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">On Leave Today</div><div className="text-2xl font-bold">{metrics.onLeaveToday}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Avg Performance</div><div className="text-2xl font-bold">{metrics.avgPerformanceScore.toFixed(1)}</div></CardContent></Card>
        </div>
      )}

      {tab === "timeoff" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Pending Time-Off Requests ({timeoff.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {timeoff.map((t) => (
                <div key={t.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{t.worker.user.fullName}</div>
                    <div className="text-xs text-muted-foreground">{t.type} · {new Date(t.startDate).toLocaleDateString()} → {new Date(t.endDate).toLocaleDateString()}</div>
                    {t.reason && <div className="text-xs text-muted-foreground mt-1">{t.reason}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => approve(t.id)}>Approve</Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deny(t.id)}>Deny</Button>
                  </div>
                </div>
              ))}
              {timeoff.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No pending time-off requests.</div>}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "shifts" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent Shifts ({shifts.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Worker</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Time</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Zone</th>
                  <th className="text-left p-3">Status</th>
                </tr></thead>
                <tbody>
                  {shifts.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{s.worker.user.fullName}</td>
                      <td className="p-3">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="p-3">{s.startTime}–{s.endTime}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{s.type}</Badge></td>
                      <td className="p-3 text-xs">{s.zone ?? "—"}</td>
                      <td className="p-3"><Badge variant={s.status === "COMPLETED" ? "default" : s.status === "NO_SHOW" ? "destructive" : "secondary"} className="text-xs">{s.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "skills" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Skills Matrix ({skills.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-right p-3">Levels</th>
                  <th className="text-right p-3">Assessed</th>
                </tr></thead>
                <tbody>
                  {skills.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{s.code}</td>
                      <td className="p-3">{s.name}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{s.category}</Badge></td>
                      <td className="p-3 text-right">{s.levels}</td>
                      <td className="p-3 text-right">{s._count.assessments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
