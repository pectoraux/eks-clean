"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface PromptTemplate { id: string; key: string; name: string; model: string; temperature: number; isActive: boolean; version: number; }
interface AgentRun { id: string; agentType: string; status: string; modelUsed: string | null; promptTokens: number; completionTokens: number; totalCostMinor: number; latencyMs: number; createdAt: string; }
interface Prediction { id: string; predictionType: string; entityType: string; entityId: string; predictedValue: number; confidence: number; actualValue: number | null; accuracyScore: number | null; generatedAt: string; }
interface Metrics { totalTemplates: number; totalRuns: number; completedRuns: number; failedRuns: number; successRate: number; totalPredictions: number; resolvedPredictions: number; totalEmbeddings: number; totalCostMinor: number; }

export function AiReadyPanel() {
  const [tab, setTab] = useState<"overview" | "prompts" | "runs" | "predictions">("overview");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const { toast } = useToast();

  async function loadMetrics() { try { setMetrics(await api<Metrics>("/api/ai-ready/metrics")); } catch {} }
  async function loadPrompts() { try { setPrompts((await api<{ items: PromptTemplate[] }>("/api/ai-ready/prompts")).items); } catch {} }
  async function loadRuns() { try { setRuns((await api<{ items: AgentRun[] }>("/api/ai-ready/runs")).items); } catch {} }
  async function loadPredictions() { try { setPredictions((await api<{ items: Prediction[] }>("/api/ai-ready/predictions")).items); } catch {} }

  useEffect(() => {
    if (tab === "overview") loadMetrics();
    if (tab === "prompts") loadPrompts();
    if (tab === "runs") loadRuns();
    if (tab === "predictions") loadPredictions();
  }, [tab]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["overview", "prompts", "runs", "predictions"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">{t}</Button>
        ))}
      </div>

      {tab === "overview" && metrics && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Prompt Templates</div><div className="text-2xl font-bold">{metrics.totalTemplates}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Agent Runs</div><div className="text-2xl font-bold">{metrics.totalRuns}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Success Rate</div><div className="text-2xl font-bold text-green-600">{(metrics.successRate * 100).toFixed(0)}%</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Cost</div><div className="text-2xl font-bold">₵{(metrics.totalCostMinor / 100).toFixed(2)}</div></CardContent></Card>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Predictions</div><div className="text-2xl font-bold">{metrics.totalPredictions}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Resolved</div><div className="text-2xl font-bold">{metrics.resolvedPredictions}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Embeddings</div><div className="text-2xl font-bold">{metrics.totalEmbeddings}</div></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">AI Agent Types (ready to wire)</CardTitle></CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>The AI-Ready module stores prompt templates, model configs, embeddings, agent runs, and predictions. To activate an agent, wire a runner that:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Reads a <code>PromptTemplate</code> by key</li>
                <li>Calls <code>renderPrompt()</code> to substitute variables</li>
                <li>Invokes the configured model (<code>AiModelConfig</code>)</li>
                <li>Stores the response via <code>completeAgentRun()</code></li>
                <li>Optionally records a <code>Prediction</code> for later accuracy scoring</li>
              </ol>
              <p className="pt-2">Supported agent types: <strong>SUPPORT_TRIAGE</strong>, <strong>DEMAND_FORECAST</strong>, <strong>DISPATCH_OPTIMIZER</strong>, <strong>QA_PREDICTOR</strong>, <strong>INVENTORY_FORECAST</strong>.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "prompts" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Prompt Templates ({prompts.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Key</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Model</th>
                  <th className="text-right p-3">Temp</th>
                  <th className="text-right p-3">Ver</th>
                  <th className="text-left p-3">Status</th>
                </tr></thead>
                <tbody>
                  {prompts.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{p.key}</td>
                      <td className="p-3">{p.name}</td>
                      <td className="p-3 text-xs">{p.model}</td>
                      <td className="p-3 text-right">{p.temperature.toFixed(2)}</td>
                      <td className="p-3 text-right">{p.version}</td>
                      <td className="p-3"><Badge variant={p.isActive ? "default" : "secondary"} className="text-xs">{p.isActive ? "Active" : "Inactive"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "runs" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Agent Runs ({runs.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Agent</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Model</th>
                  <th className="text-right p-3">Tokens</th>
                  <th className="text-right p-3">Cost</th>
                  <th className="text-right p-3">Latency</th>
                  <th className="text-left p-3">When</th>
                </tr></thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{r.agentType}</td>
                      <td className="p-3"><Badge variant={r.status === "COMPLETED" ? "default" : r.status === "FAILED" ? "destructive" : "secondary"} className="text-xs">{r.status}</Badge></td>
                      <td className="p-3 text-xs">{r.modelUsed ?? "—"}</td>
                      <td className="p-3 text-right text-xs">{r.promptTokens}+{r.completionTokens}</td>
                      <td className="p-3 text-right text-xs">₵{(r.totalCostMinor / 100).toFixed(4)}</td>
                      <td className="p-3 text-right text-xs">{r.latencyMs}ms</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "predictions" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">AI Predictions ({predictions.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Entity</th>
                  <th className="text-right p-3">Predicted</th>
                  <th className="text-right p-3">Confidence</th>
                  <th className="text-right p-3">Actual</th>
                  <th className="text-right p-3">Accuracy</th>
                </tr></thead>
                <tbody>
                  {predictions.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{p.predictionType}</td>
                      <td className="p-3 text-xs">{p.entityType}:{p.entityId.slice(-6)}</td>
                      <td className="p-3 text-right">{p.predictedValue.toFixed(2)}</td>
                      <td className="p-3 text-right">{(p.confidence * 100).toFixed(0)}%</td>
                      <td className="p-3 text-right">{p.actualValue !== null ? p.actualValue.toFixed(2) : "—"}</td>
                      <td className="p-3 text-right">{p.accuracyScore !== null ? `${(p.accuracyScore * 100).toFixed(0)}%` : "—"}</td>
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
