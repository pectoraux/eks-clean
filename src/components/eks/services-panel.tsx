"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface ServiceType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  basePriceMinor: number;
  priceUnit: string;
  estimatedDurationMin: number;
  isActive: boolean;
  requiresCertification: string | null;
}

function minorToGhs(m: number) { return `₵${(m / 100).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`; }

export function ServicesPanel() {
  const [items, setItems] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ items: ServiceType[] }>("/api/services");
      setItems(r.items);
    } catch (e) {
      toast({ title: "Load failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading && items.length === 0) return <Skeleton className="h-40 w-full" />;

  const grouped = items.reduce((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {} as Record<string, ServiceType[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
        <div className="text-xs text-muted-foreground ml-auto">{items.length} services</div>
      </div>
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat}>
          <div className="text-xs uppercase text-muted-foreground mb-2">{cat}</div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 space-y-1">
                  <div className="flex justify-between items-start">
                    <div className="font-medium">{s.name}</div>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.priceUnit.replace(/_/g, " ")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{s.description ?? s.code}</div>
                  <div className="flex justify-between items-center pt-2 border-t mt-2">
                    <div className="text-sm font-medium">{minorToGhs(s.basePriceMinor)}</div>
                    <div className="text-xs text-muted-foreground">~{s.estimatedDurationMin} min</div>
                  </div>
                  {s.requiresCertification && (
                    <div className="text-xs text-amber-700">Requires: {s.requiresCertification}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
