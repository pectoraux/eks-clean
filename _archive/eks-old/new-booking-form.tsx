"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, useAuth } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface ServiceType { id: string; code: string; name: string; basePriceMinor: number; }
interface Address { id: string; label: string; line1: string; city: string; }

function minorToGhs(m: number) { return `₵${(m / 100).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`; }

export function NewBookingForm({ onCreated }: { onCreated?: () => void }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceType[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("3");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ items: ServiceType[] }>("/api/services").then((r) => setServices(r.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    api<{ items: Array<{ id: string; label: string; line1: string; city: string }> } & unknown>("/api/customers")
      .then((r) => {
        const c = (r as { items: Array<{ addresses: Address[] }> }).items?.[0];
        if (c?.addresses) setAddresses(c.addresses);
      })
      .catch(() => {});
  }, [session]);

  const start = date && time ? new Date(`${date}T${time}:00`) : null;
  const end = start ? new Date(start.getTime() + Number(duration) * 60 * 60 * 1000) : null;
  const selectedService = services.find((s) => s.id === serviceId);
  const estimated = selectedService && start && end
    ? Math.round(selectedService.basePriceMinor * Number(duration))
    : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!start || !end) return;
    setLoading(true);
    try {
      const r = await api<{ booking: { id: string; code: string; totalMinor: number } }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          serviceTypeId: serviceId,
          addressId,
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
          notes,
        }),
      });
      toast({ title: "Booking created", description: `${r.booking.code} — ${minorToGhs(r.booking.totalMinor)}` });
      onCreated?.();
      setNotes(""); setDate("");
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (!session || session.user.role !== "CUSTOMER") {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Sign in as a customer to create a new booking.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">New Booking</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Service</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
              <SelectContent>
                {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({minorToGhs(s.basePriceMinor)}/hr)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Address</Label>
            <Select value={addressId} onValueChange={setAddressId}>
              <SelectTrigger><SelectValue placeholder="Select address" /></SelectTrigger>
              <SelectContent>
                {addresses.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}: {a.line1}, {a.city}</SelectItem>)}
              </SelectContent>
            </Select>
            {addresses.length === 0 && <div className="text-xs text-muted-foreground">Add an address first.</div>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hours</Label>
              <Input type="number" min="1" max="12" value={duration} onChange={(e) => setDuration(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
          </div>
          {estimated > 0 && (
            <div className="text-sm border-t pt-2">
              <span className="text-muted-foreground">Estimated total: </span>
              <span className="font-medium">{minorToGhs(estimated)}</span>
            </div>
          )}
          <Button type="submit" disabled={loading || !serviceId || !addressId || !date} className="w-full">
            {loading ? "Creating…" : "Create Booking"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
