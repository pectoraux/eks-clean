"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface Protocol { id: string; code: string; name: string; surfaceCode: string | null; estimatedDurationMin: number; _count: { steps: number; executions: number }; serviceType: { name: string } | null; }
interface Vehicle { id: string; plateNumber: string; make: string; model: string; year: number; type: string; status: string; mileageKm: number; fuelLevelPercent: number; _count: { maintenance: number; fuelLogs: number; inspections: number }; }
interface PurchaseOrder { id: string; code: string; status: string; totalMinor: number; expectedDeliveryAt: string | null; supplier: { name: string }; _count: { lines: number }; }

function minorToGhs(m: number) { return `₵${(m / 100).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`; }

export function OperationsPanel() {
  const [tab, setTab] = useState<"protocols" | "fleet" | "scm">("protocols");
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const { toast } = useToast();

  async function loadProtocols() { try { const r = await api<{ items: Protocol[] }>("/api/protocols/list"); setProtocols(r.items); } catch {} }
  async function loadVehicles() { try { const r = await api<{ items: Vehicle[] }>("/api/fleet/vehicles"); setVehicles(r.items); } catch {} }
  async function loadPos() { try { const r = await api<{ items: PurchaseOrder[] }>("/api/scm/purchase-orders"); setPos(r.items); } catch {} }

  useEffect(() => {
    if (tab === "protocols") loadProtocols();
    if (tab === "fleet") loadVehicles();
    if (tab === "scm") loadPos();
  }, [tab]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["protocols", "fleet", "scm"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="uppercase">{t}</Button>
        ))}
      </div>

      {tab === "protocols" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Cleaning Protocols ({protocols.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Surface</th>
                  <th className="text-left p-3">Service</th>
                  <th className="text-right p-3">Steps</th>
                  <th className="text-right p-3">Min</th>
                  <th className="text-right p-3">Runs</th>
                </tr></thead>
                <tbody>
                  {protocols.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{p.code}</td>
                      <td className="p-3">{p.name}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{p.surfaceCode ?? "—"}</Badge></td>
                      <td className="p-3 text-xs text-muted-foreground">{p.serviceType?.name ?? "—"}</td>
                      <td className="p-3 text-right">{p._count.steps}</td>
                      <td className="p-3 text-right">{p.estimatedDurationMin}</td>
                      <td className="p-3 text-right">{p._count.executions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "fleet" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Fleet ({vehicles.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Plate</th>
                  <th className="text-left p-3">Make / Model</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Mileage</th>
                  <th className="text-right p-3">Fuel</th>
                </tr></thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{v.plateNumber}</td>
                      <td className="p-3">{v.make} {v.model} ({v.year})</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{v.type}</Badge></td>
                      <td className="p-3"><Badge variant={v.status === "ACTIVE" ? "default" : v.status === "MAINTENANCE" ? "destructive" : "secondary"} className="text-xs">{v.status}</Badge></td>
                      <td className="p-3 text-right">{v.mileageKm.toLocaleString()} km</td>
                      <td className="p-3 text-right">{v.fuelLevelPercent.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "scm" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Purchase Orders ({pos.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Supplier</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Lines</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-right p-3">Action</th>
                </tr></thead>
                <tbody>
                  {pos.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{p.code}</td>
                      <td className="p-3">{p.supplier.name}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{p.status}</Badge></td>
                      <td className="p-3 text-right">{p._count.lines}</td>
                      <td className="p-3 text-right">{minorToGhs(p.totalMinor)}</td>
                      <td className="p-3 text-right">
                        {p.status === "DRAFT" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                            try { await api(`/api/scm/purchase-orders/${p.id}/submit`, { method: "POST" }); toast({ title: "Submitted" }); loadPos(); } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
                          }}>Submit</Button>
                        )}
                        {p.status === "SUBMITTED" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                            try { await api(`/api/scm/purchase-orders/${p.id}/approve`, { method: "POST" }); toast({ title: "Approved" }); loadPos(); } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
                          }}>Approve</Button>
                        )}
                        {p.status === "APPROVED" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                            try { await api(`/api/scm/purchase-orders/${p.id}/send`, { method: "POST" }); toast({ title: "Sent" }); loadPos(); } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
                          }}>Send</Button>
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
    </div>
  );
}
