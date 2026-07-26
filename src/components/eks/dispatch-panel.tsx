"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "./analytics-overview";

interface QueueItem {
  id: string;
  code: string;
  status: string;
  scheduledStart: string;
  totalMinor: number;
  serviceType: { code: string; name: string };
  customer: { user: { fullName: string } };
  address: { line1: string; city: string; latitude: number | null; longitude: number | null };
  assignments: Array<{ status: string; worker: { id: string; user: { fullName: string } } }>;
}

export function DispatchPanel() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ items: QueueItem[] }>("/api/dispatch");
      setItems(r.items);
    } catch (e) {
      toast({ title: "Load failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function dispatch(bookingId: string) {
    try {
      const r = await api<{ chosen?: string; offered: Array<{ workerId: string; score: number; estimatedTravelMinutes: number }> }>(`/api/dispatch`, {
        method: "POST",
        body: JSON.stringify({ bookingId }),
      });
      toast({
        title: r.chosen ? "Auto-dispatched" : "No candidates",
        description: r.chosen ? `Worker ${r.chosen.slice(-6)} (score ${r.offered[0]?.score.toFixed(2)})` : "Manual dispatch required",
      });
      load();
    } catch (e) {
      toast({ title: "Dispatch failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
        <div className="text-xs text-muted-foreground ml-auto">{items.length} awaiting dispatch</div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Dispatch Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No bookings awaiting dispatch.</div>}
            {items.map((b) => (
              <div key={b.id} className="p-4 flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{b.code}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="text-sm mt-1">{b.serviceType.name} · {b.customer.user.fullName}</div>
                  <div className="text-xs text-muted-foreground">{b.address.line1}, {b.address.city}</div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(b.scheduledStart).toLocaleString()}</div>
                  {b.assignments.length > 0 && (
                    <div className="text-xs mt-1">Offered to: {b.assignments.map(a => a.worker.user.fullName).join(", ")}</div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {b.status === "requested" && <Button size="sm" onClick={() => dispatch(b.id)}>Auto-Dispatch</Button>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Dispatch Algorithm</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>Score = 0.35·rating + 0.25·quality + 0.20·proximity + 0.15·utilization⁻¹ + 0.05·tenure</p>
          <p>Subscription customers get +0.05 priority bonus. Workers with overlapping assignments are excluded.</p>
          <p>Top 3 candidates are scored; the highest is offered. Manager override is always available.</p>
        </CardContent>
      </Card>
    </div>
  );
}
