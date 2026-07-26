"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface Contract { id: string; contractNumber: string; title: string; status: string; slaTier: string; startDate: string; endDate: string; totalContractValueMinor: number; autoRenew: boolean; customer: { user: { fullName: string } }; _count: { lines: number; milestones: number }; }
interface Metrics { total: number; active: number; expiringSoon: number; totalActiveValueMinor: number; }

function minorToGhs(m: number) { return `₵${(m / 100).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`; }

export function EnterprisePanel() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const { toast } = useToast();

  async function load() {
    try {
      const m = await api<Metrics>("/api/contracts/list?metrics=true");
      setMetrics(m);
      const r = await api<{ items: Contract[] }>("/api/contracts/list");
      setContracts(r.items);
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-3">
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Contracts</div>
            <div className="text-2xl font-bold">{metrics.total}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Active</div>
            <div className="text-2xl font-bold">{metrics.active}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Expiring (30d)</div>
            <div className="text-2xl font-bold text-amber-600">{metrics.expiringSoon}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Active Value</div>
            <div className="text-2xl font-bold">{minorToGhs(metrics.totalActiveValueMinor)}</div>
          </CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Enterprise Contracts ({contracts.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase"><tr>
                <th className="text-left p-3">Contract #</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">SLA</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Value</th>
                <th className="text-left p-3">End</th>
                <th className="text-right p-3">Action</th>
              </tr></thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{c.contractNumber}</td>
                    <td className="p-3">{c.customer.user.fullName}</td>
                    <td className="p-3">{c.title}</td>
                    <td className="p-3"><Badge variant="outline" className="text-xs">{c.slaTier}</Badge></td>
                    <td className="p-3"><Badge variant={c.status === "ACTIVE" ? "default" : c.status === "EXPIRED" || c.status === "TERMINATED" ? "destructive" : "secondary"} className="text-xs">{c.status}</Badge></td>
                    <td className="p-3 text-right">{minorToGhs(c.totalContractValueMinor)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(c.endDate).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      {c.status === "DRAFT" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                          try { await api(`/api/contracts/${c.id}/send`, { method: "POST" }); toast({ title: "Sent for signature" }); load(); } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
                        }}>Send</Button>
                      )}
                      {c.status === "SENT" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                          try { await api(`/api/contracts/${c.id}/activate`, { method: "POST" }); toast({ title: "Activated" }); load(); } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
                        }}>Activate</Button>
                      )}
                      {c.status === "ACTIVE" && (
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={async () => {
                          try { await api(`/api/contracts/${c.id}/terminate`, { method: "POST" }); toast({ title: "Terminated" }); load(); } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
                        }}>Terminate</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
