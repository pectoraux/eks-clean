"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  outcome: string;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export function AuditPanel() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ items: AuditEntry[]; total: number }>("/api/audit?limit=200");
      setItems(r.items);
    } catch (e) {
      toast({ title: "Load failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
        <div className="text-xs text-muted-foreground ml-auto">{items.length} entries</div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase sticky top-0">
                <tr>
                  <th className="text-left p-3">Time</th>
                  <th className="text-left p-3">Action</th>
                  <th className="text-left p-3">Resource</th>
                  <th className="text-left p-3">Outcome</th>
                  <th className="text-left p-3">IP</th>
                  <th className="text-left p-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-mono text-xs">{a.action}</td>
                    <td className="p-3 text-xs">{a.resourceType}{a.resourceId ? `:${a.resourceId.slice(-6)}` : ""}</td>
                    <td className="p-3"><Badge variant={a.outcome === "SUCCESS" ? "default" : a.outcome === "FAILURE" ? "destructive" : "secondary"}>{a.outcome}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground">{a.ipAddress ?? "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{a.reason ?? "—"}</td>
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
