"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Overview {
  totals: {
    customers: number;
    workers: number;
    bookings: number;
    activeSubscriptions: number;
    completedBookings: number;
    cancelledBookings: number;
    disputedBookings: number;
    revenueMinor: number;
    avgRating: number;
    totalRatings: number;
    completionRate: number;
    cancellationRate: number;
  };
  recentBookings: Array<{
    id: string;
    code: string;
    status: string;
    scheduledStart: string;
    totalMinor: number;
    serviceType: { code: string; name: string };
    customer: { user: { fullName: string } };
  }>;
}

function minorToGhs(m: number) {
  return `₵${(m / 100).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`;
}

export function AnalyticsOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await api<Overview>("/api/analytics/overview");
        if (active) setData(r);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => { active = false; };
  }, []);

  if (error) return <div className="text-sm text-muted-foreground">Sign in to view analytics.</div>;
  if (!data) return <Skeleton className="h-64 w-full" />;

  const { totals: t } = data;
  const cards = [
    { label: "Customers", value: t.customers, sub: "registered" },
    { label: "Workers", value: t.workers, sub: "active" },
    { label: "Bookings", value: t.bookings, sub: `${(t.completionRate * 100).toFixed(0)}% complete` },
    { label: "Revenue", value: minorToGhs(t.revenueMinor), sub: "captured" },
    { label: "Subscriptions", value: t.activeSubscriptions, sub: "active" },
    { label: "Avg Rating", value: t.avgRating.toFixed(2), sub: `${t.totalRatings} ratings` },
    { label: "Cancelled", value: `${(t.cancellationRate * 100).toFixed(0)}%`, sub: `${t.cancelledBookings} bookings` },
    { label: "Disputed", value: t.disputedBookings, sub: "needs review" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-2xl font-bold mt-1">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Bookings</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Service</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-left p-3">Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {data.recentBookings.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{b.code}</td>
                    <td className="p-3">{b.customer.user.fullName}</td>
                    <td className="p-3">{b.serviceType.name}</td>
                    <td className="p-3"><StatusBadge status={b.status} /></td>
                    <td className="p-3 text-right">{minorToGhs(b.totalMinor)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(b.scheduledStart).toLocaleString()}</td>
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

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    requested: "bg-blue-100 text-blue-700",
    assigned: "bg-indigo-100 text-indigo-700",
    worker_accepted: "bg-cyan-100 text-cyan-700",
    worker_en_route: "bg-amber-100 text-amber-700",
    arrived: "bg-orange-100 text-orange-700",
    in_progress: "bg-purple-100 text-purple-700",
    completed: "bg-green-100 text-green-700",
    rated: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-700",
    disputed: "bg-rose-100 text-rose-700",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100"}`}>{status.replace(/_/g, " ")}</span>;
}
