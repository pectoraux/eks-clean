"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/client";

interface Worker {
  id: string;
  employeeId: string | null;
  status: string;
  kycStatus: string;
  averageRating: number;
  totalRatings: number;
  completedJobs: number;
  preferredRadiusKm: number;
  onboardingStep: string;
  user: { id: string; email: string; fullName: string; phone: string | null; status: string };
  skills: Array<{ skillCode: string; proficiency: string }>;
  _count: { ratings: number; assignments: number };
}

export function WorkersPanel() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { session } = useAuth();
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "FIELD_MANAGER";

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ items: Worker[]; total: number }>("/api/workers?status=ACTIVE");
      setWorkers(r.items);
    } catch (e) {
      toast({ title: "Load failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function action(workerId: string, action: "approve" | "suspend" | "reactivate") {
    try {
      await api(`/api/workers/${workerId}`, { method: "PATCH", body: JSON.stringify({ action }) });
      toast({ title: `Worker ${action}` });
      load();
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
        <div className="text-xs text-muted-foreground ml-auto">{workers.length} workers</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {workers.map((w) => (
          <Card key={w.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{w.user.fullName}</div>
                  <div className="text-xs text-muted-foreground">{w.user.email}</div>
                </div>
                <Badge variant={w.status === "ACTIVE" ? "default" : "secondary"}>{w.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {w.skills.slice(0, 4).map((s) => (
                  <span key={s.skillCode} className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.skillCode}</span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t">
                <div>
                  <div className="text-muted-foreground">Rating</div>
                  <div className="font-medium">★ {w.averageRating.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Jobs</div>
                  <div className="font-medium">{w.completedJobs}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">KYC</div>
                  <div className="font-medium">{w.kycStatus}</div>
                </div>
              </div>
              {canManage && (
                <div className="flex gap-1 pt-2">
                  {w.status !== "ACTIVE" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => action(w.id, "reactivate")}>Activate</Button>}
                  {w.status === "ACTIVE" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => action(w.id, "suspend")}>Suspend</Button>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
