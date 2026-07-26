"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface Subscription {
  id: string;
  status: string;
  startDate: string;
  nextBillingDate: string | null;
  autoRenew: boolean;
  plan: { name: string; cadence: string; cadenceDays: number; billingPriceMinor: number; serviceType: { code: string; name: string } };
  customer: { user: { fullName: string } };
}

function minorToGhs(m: number) { return `₵${(m / 100).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`; }

export function SubscriptionsPanel() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ items: Subscription[] }>("/api/subscriptions");
      setItems(r.items);
    } catch (e) {
      toast({ title: "Load failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(id: string, action: "pause" | "resume" | "cancel") {
    try {
      await api(`/api/subscriptions/${id}/${action}`, { method: "POST" });
      toast({ title: `Subscription ${action}d` });
      load();
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
        <div className="text-xs text-muted-foreground ml-auto">{items.length} subscriptions</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{s.plan.name}</div>
                  <div className="text-xs text-muted-foreground">{s.customer.user.fullName}</div>
                </div>
                <Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>{s.status}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t">
                <div><div className="text-muted-foreground">Cadence</div><div className="font-medium">{s.plan.cadence}</div></div>
                <div><div className="text-muted-foreground">Price</div><div className="font-medium">{minorToGhs(s.plan.billingPriceMinor)}</div></div>
                <div><div className="text-muted-foreground">Auto-renew</div><div className="font-medium">{s.autoRenew ? "Yes" : "No"}</div></div>
              </div>
              {s.nextBillingDate && (
                <div className="text-xs text-muted-foreground">Next billing: {new Date(s.nextBillingDate).toLocaleDateString()}</div>
              )}
              <div className="flex gap-1 pt-2">
                {s.status === "ACTIVE" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => act(s.id, "pause")}>Pause</Button>}
                {s.status === "PAUSED" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => act(s.id, "resume")}>Resume</Button>}
                {s.status !== "CANCELLED" && <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => act(s.id, "cancel")}>Cancel</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
