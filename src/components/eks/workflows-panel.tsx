"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface Definition { id: string; key: string; name: string; entityType: string; isActive: boolean; _count: { instances: number; actions: number; triggers: number }; }
interface Instance { id: string; currentState: string; entityType: string; entityId: string; startedAt: string; completedAt: string | null; definition: { key: string; name: string }; _count: { transitionLogs: number }; }

export function WorkflowsPanel() {
  const [tab, setTab] = useState<"definitions" | "instances">("definitions");
  const [defs, setDefs] = useState<Definition[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const { toast } = useToast();

  async function loadDefs() { try { const r = await api<{ items: Definition[] }>("/api/workflows/definitions"); setDefs(r.items); } catch {} }
  async function loadInstances() { try { const r = await api<{ items: Instance[] }>("/api/workflows/instances"); setInstances(r.items); } catch {} }

  useEffect(() => {
    if (tab === "definitions") loadDefs();
    if (tab === "instances") loadInstances();
  }, [tab]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["definitions", "instances"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">{t}</Button>
        ))}
      </div>

      {tab === "definitions" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Workflow Definitions ({defs.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Key</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Entity</th>
                  <th className="text-right p-3">Instances</th>
                  <th className="text-right p-3">Actions</th>
                  <th className="text-right p-3">Triggers</th>
                  <th className="text-left p-3">Status</th>
                </tr></thead>
                <tbody>
                  {defs.map((d) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{d.key}</td>
                      <td className="p-3">{d.name}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{d.entityType}</Badge></td>
                      <td className="p-3 text-right">{d._count.instances}</td>
                      <td className="p-3 text-right">{d._count.actions}</td>
                      <td className="p-3 text-right">{d._count.triggers}</td>
                      <td className="p-3"><Badge variant={d.isActive ? "default" : "secondary"} className="text-xs">{d.isActive ? "Active" : "Inactive"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "instances" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Workflow Instances ({instances.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Definition</th>
                  <th className="text-left p-3">Entity</th>
                  <th className="text-left p-3">Current State</th>
                  <th className="text-right p-3">Transitions</th>
                  <th className="text-left p-3">Started</th>
                  <th className="text-left p-3">Status</th>
                </tr></thead>
                <tbody>
                  {instances.map((i) => (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-xs">{i.definition.name}</td>
                      <td className="p-3 font-mono text-xs">{i.entityType}:{i.entityId.slice(-6)}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{i.currentState}</Badge></td>
                      <td className="p-3 text-right">{i._count.transitionLogs}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(i.startedAt).toLocaleString()}</td>
                      <td className="p-3"><Badge variant={i.completedAt ? "default" : "secondary"} className="text-xs">{i.completedAt ? "Completed" : "Active"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">AI-Ready Action Types</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>The workflow engine supports pluggable side-effect actions per transition. AI actions are wired through adapters but not auto-executed in this build:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              ["AI_LLM", "Call an LLM with prompt template + context"],
              ["AI_FORECAST", "Invoke demand / churn forecast model"],
              ["AI_CLASSIFY", "Classify ticket / lead / quality issue"],
              ["WEBHOOK", "POST to external URL"],
              ["EMAIL", "Send templated email"],
              ["NOTIFICATION", "Push in-app notification"],
              ["QUEUE_JOB", "Enqueue background job"],
              ["UPDATE_FIELD", "Mutate entity field"],
              ["GATEWAY_CALL", "Invoke PaymentGateway method"],
            ].map(([type, desc]) => (
              <div key={type} className="border rounded p-2">
                <div className="font-mono text-xs font-medium">{type}</div>
                <div className="text-xs">{desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
