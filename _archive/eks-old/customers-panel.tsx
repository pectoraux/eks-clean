"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  customerTier: string;
  loyaltyPoints: number;
  marketingOptIn: boolean;
  createdAt: string;
  user: { id: string; email: string; fullName: string; phone: string | null; status: string };
  addresses: Array<{ id: string; label: string; line1: string; city: string; isDefault: boolean }>;
  _count: { bookings: number; subscriptions: number };
}

export function CustomersPanel() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ items: Customer[]; total: number }>("/api/customers");
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
        <div className="text-xs text-muted-foreground ml-auto">{items.length} customers</div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Tier</th>
                  <th className="text-left p-3">Address</th>
                  <th className="text-right p-3">Bookings</th>
                  <th className="text-right p-3">Subscriptions</th>
                  <th className="text-left p-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">{c.user.fullName}</td>
                    <td className="p-3 text-xs">{c.user.email}</td>
                    <td className="p-3"><span className="text-xs bg-muted px-1.5 py-0.5 rounded">{c.customerTier}</span></td>
                    <td className="p-3 text-xs text-muted-foreground">{c.addresses[0]?.line1 ?? "—"}</td>
                    <td className="p-3 text-right">{c._count.bookings}</td>
                    <td className="p-3 text-right">{c._count.subscriptions}</td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
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
