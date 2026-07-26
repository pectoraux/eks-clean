"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { StatusBadge } from "./analytics-overview";

interface Booking {
  id: string;
  code: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  totalMinor: number;
  notes?: string | null;
  serviceType: { id: string; code: string; name: string };
  address: { line1: string; city: string };
  customer: { id: string; user: { fullName: string; email: string } };
  assignments: Array<{ id: string; status: string; worker: { id: string; user: { fullName: string } } }>;
  statusHistory?: Array<{ id: string; fromStatus: string | null; toStatus: string; createdAt: string; actorType: string | null }>;
}

const STATUS_OPTIONS = [
  "assigned", "worker_accepted", "worker_en_route", "arrived",
  "in_progress", "completed", "rated", "cancelled", "disputed",
];

function minorToGhs(m: number) { return `₵${(m / 100).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`; }

export function BookingsPanel() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ items: Booking[]; total: number }>(`/api/bookings${filter ? `?status=${filter}` : ""}`);
      setBookings(r.items);
    } catch (e) {
      toast({ title: "Load failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function transition(bookingId: string, toStatus: string) {
    try {
      await api(`/api/bookings/${bookingId}`, { method: "PATCH", body: JSON.stringify({ toStatus }) });
      toast({ title: `Status → ${toStatus.replace(/_/g, " ")}` });
      load();
      if (selected?.id === bookingId) {
        setSelected(null);
      }
    } catch (e) {
      toast({ title: "Transition failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function dispatch(bookingId: string, workerId?: string) {
    try {
      const r = await api(`/api/bookings/${bookingId}/dispatch`, {
        method: "POST",
        body: JSON.stringify(workerId ? { workerId } : {}),
      });
      toast({ title: "Dispatched", description: `Chosen: ${r.chosen ?? "manual"}` });
      load();
    } catch (e) {
      toast({ title: "Dispatch failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function pay(bookingId: string) {
    try {
      const r = await api<{ url: string }>(`/api/payments/checkout?bookingId=${bookingId}`, { method: "POST" });
      toast({ title: "Checkout session created", description: r.url });
    } catch (e) {
      toast({ title: "Payment failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            <SelectItem value="requested">requested</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
        <div className="text-xs text-muted-foreground ml-auto">{bookings.length} bookings</div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase sticky top-0">
                <tr>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Service</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-left p-3">Scheduled</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">
                      <button onClick={() => setSelected(b)} className="hover:underline">{b.code}</button>
                    </td>
                    <td className="p-3">{b.customer.user.fullName}</td>
                    <td className="p-3">{b.serviceType.name}</td>
                    <td className="p-3"><StatusBadge status={b.status} /></td>
                    <td className="p-3 text-right">{minorToGhs(b.totalMinor)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(b.scheduledStart).toLocaleString()}</td>
                    <td className="p-3 text-right space-x-1">
                      {(b.status === "requested") && (
                        <Button size="sm" variant="outline" onClick={() => dispatch(b.id)}>Auto-Dispatch</Button>
                      )}
                      {(["completed", "rated"].includes(b.status)) && (
                        <Button size="sm" variant="outline" onClick={() => pay(b.id)}>Pay</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setSelected(b)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <BookingDetail booking={selected} onClose={() => setSelected(null)} onTransition={transition} onDispatch={dispatch} />
      )}
    </div>
  );
}

function BookingDetail({ booking, onClose, onTransition, onDispatch }: {
  booking: Booking;
  onClose: () => void;
  onTransition: (id: string, s: string) => void;
  onDispatch: (id: string, w?: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          Booking <span className="font-mono">{booking.code}</span> <StatusBadge status={booking.status} />
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Customer:</span> {booking.customer.user.fullName}</div>
          <div><span className="text-muted-foreground">Service:</span> {booking.serviceType.name}</div>
          <div><span className="text-muted-foreground">Address:</span> {booking.address.line1}, {booking.address.city}</div>
          <div><span className="text-muted-foreground">Total:</span> {minorToGhs(booking.totalMinor)}</div>
          <div><span className="text-muted-foreground">Start:</span> {new Date(booking.scheduledStart).toLocaleString()}</div>
          <div><span className="text-muted-foreground">End:</span> {new Date(booking.scheduledEnd).toLocaleString()}</div>
        </div>
        {booking.notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {booking.notes}</div>}
        {booking.assignments.length > 0 && (
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-1">Assigned Workers</div>
            {booking.assignments.map((a) => (
              <div key={a.id} className="text-sm">{a.worker.user.fullName} — <span className="text-muted-foreground">{a.status}</span></div>
            ))}
          </div>
        )}
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">Status History</div>
          <ol className="space-y-1 text-xs">
            {(booking.statusHistory ?? []).map((h) => (
              <li key={h.id} className="flex gap-2">
                <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</span>
                <span>{h.fromStatus ?? "—"} → <strong>{h.toStatus}</strong></span>
                <span className="text-muted-foreground">({h.actorType?.toLowerCase() ?? "system"})</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {booking.status === "requested" && <Button size="sm" onClick={() => onDispatch(booking.id)}>Auto-Dispatch</Button>}
          {booking.status === "assigned" && <Button size="sm" onClick={() => onTransition(booking.id, "worker_accepted")}>Worker Accept</Button>}
          {booking.status === "worker_accepted" && <Button size="sm" onClick={() => onTransition(booking.id, "worker_en_route")}>En Route</Button>}
          {booking.status === "worker_en_route" && <Button size="sm" onClick={() => onTransition(booking.id, "arrived")}>Arrived</Button>}
          {booking.status === "arrived" && <Button size="sm" onClick={() => onTransition(booking.id, "in_progress")}>Start</Button>}
          {booking.status === "in_progress" && <Button size="sm" onClick={() => onTransition(booking.id, "completed")}>Complete</Button>}
          {!["cancelled", "rated", "disputed"].includes(booking.status) && (
            <Button size="sm" variant="destructive" onClick={() => onTransition(booking.id, "cancelled")}>Cancel</Button>
          )}
          {["completed", "rated"].includes(booking.status) && (
            <Button size="sm" variant="outline" onClick={() => onTransition(booking.id, "disputed")}>Flag Dispute</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
