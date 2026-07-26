"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  reorderLevel: number;
  hazardLevel: string | null;
  ppeRequired: string | null;
  approvedSurfaces: string | null;
  warehouseStock: Array<{ warehouseCode: string; quantity: number; reservedQty: number }>;
}

export function InventoryPanel() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ items: InventoryItem[] }>("/api/inventory/items");
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
        <div className="text-xs text-muted-foreground ml-auto">{items.length} items</div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">SKU</th>
                  <th className="text-left p-3">Item</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-right p-3">Stock</th>
                  <th className="text-right p-3">Reorder</th>
                  <th className="text-left p-3">Hazard</th>
                  <th className="text-left p-3">PPE</th>
                  <th className="text-left p-3">Surfaces</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const qty = i.warehouseStock[0]?.quantity ?? 0;
                  const low = qty <= i.reorderLevel;
                  return (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{i.sku}</td>
                      <td className="p-3">{i.name}</td>
                      <td className="p-3"><Badge variant="outline">{i.category}</Badge></td>
                      <td className={`p-3 text-right font-medium ${low ? "text-red-600" : ""}`}>{qty} {i.unit}</td>
                      <td className="p-3 text-right text-xs text-muted-foreground">{i.reorderLevel}</td>
                      <td className="p-3 text-xs">{i.hazardLevel ?? "—"}</td>
                      <td className="p-3 text-xs">{i.ppeRequired ?? "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">{i.approvedSurfaces ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
