"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api, useAuth } from "@/lib/client";

interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string; fullName: string };
}

interface WaitlistEntry {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  requestedRole: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

// All demo accounts + the non-demo admin. Each has a quick-login button.
const DEMO_ACCOUNTS = [
  { label: "Admin (Real)", email: "ekontetevi@gmail", password: "Payswap123456", role: "ADMIN", isReal: true },
  { label: "Admin (Demo)", email: "admin@eksclean.example", password: "EksClean123!", role: "ADMIN" },
  { label: "Field Mgr", email: "fm1@eksclean.example", password: "EksClean123!", role: "FIELD_MANAGER" },
  { label: "Sales Agent", email: "sales1@eksclean.example", password: "EksClean123!", role: "SALES_AGENT" },
  { label: "Customer", email: "adwoa@example.com", password: "EksClean123!", role: "CUSTOMER" },
  { label: "Worker", email: "samuel.w@eksclean.example", password: "EksClean123!", role: "WORKER" },
];

export function AuthPanel() {
  const { session, setSession, clear } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("admin@eksclean.example");
  const [password, setPassword] = useState("EksClean123!");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"CUSTOMER" | "WORKER" | "FIELD_MANAGER" | "SALES_AGENT">("CUSTOMER");
  const [loading, setLoading] = useState(false);
  const [waitlisted, setWaitlisted] = useState<{ email: string } | null>(null);

  // If admin is logged in, show the waitlist admin panel
  const [waitlist, setWaitlist] = useState<WaitlistEntry[] | null>(null);
  useEffect(() => {
    if (session?.user.role === "ADMIN" && !waitlist) {
      api<{ items: WaitlistEntry[] }>("/api/admin/waitlist")
        .then((r) => setWaitlist(r.items))
        .catch(() => setWaitlist([]));
    }
    if (session?.user.role !== "ADMIN") setWaitlist(null);
  }, [session, waitlist]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const r = await api<{ user: { id: string; email: string; role: string; fullName: string }; session: Session }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setSession({ ...r.session, user: r.user });
        toast({ title: `Welcome, ${r.user.fullName}`, description: `Role: ${r.user.role}` });
      } else {
        // Register — puts user on waitlist, does NOT create an account
        const r = await api<{ status: string; message: string }>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, fullName, role }),
        });
        setWaitlisted({ email });
        toast({ title: "You're on the waitlist!", description: r.message });
      }
    } catch (e) {
      toast({ title: mode === "login" ? "Login failed" : "Registration failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function quickLogin(demo: typeof DEMO_ACCOUNTS[number]) {
    setEmail(demo.email);
    setPassword(demo.password);
    setMode("login");
    setWaitlisted(null);
  }

  if (session) {
    return (
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Name:</span> {session.user.fullName}</div>
            <div><span className="text-muted-foreground">Email:</span> {session.user.email}</div>
            <div><span className="text-muted-foreground">Role:</span> <code className="rounded bg-muted px-1.5 py-0.5">{session.user.role}</code></div>
            <Button size="sm" variant="outline" className="w-full" onClick={async () => {
              try { await api("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: session.refreshToken }) }); } catch {}
              clear();
              setWaitlist(null);
            }}>Sign out</Button>
          </CardContent>
        </Card>

        {session.user.role === "ADMIN" && waitlist && (
          <WaitlistAdmin entries={waitlist} onChange={() => setWaitlist(null)} />
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{mode === "login" ? "Sign in" : "Request access"}</CardTitle>
      </CardHeader>
      <CardContent>
        {waitlisted ? (
          <div className="space-y-3 text-center">
            <div className="text-3xl">✓</div>
            <div className="font-medium">You're on the waitlist!</div>
            <div className="text-xs text-muted-foreground">
              We've received your request for <strong>{waitlisted.email}</strong>. Our team will review
              your application and email you when your account is ready.
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => {
              setWaitlisted(null);
              setMode("login");
            }}>Back to sign in</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="fullName" className="text-xs">Full Name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="role" className="text-xs">Requesting access as</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUSTOMER">Customer</SelectItem>
                      <SelectItem value="WORKER">Worker</SelectItem>
                      <SelectItem value="FIELD_MANAGER">Field Manager</SelectItem>
                      <SelectItem value="SALES_AGENT">Sales Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
                  <strong>Heads up:</strong> Sign-up puts you on a waitlist. An admin reviews each
                  request before an account is created.
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Working…" : mode === "login" ? "Sign in" : "Join waitlist"}
            </Button>
            <Button type="button" variant="link" size="sm" className="w-full" onClick={() => setMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Need access? Join the waitlist" : "Have an account? Sign in"}
            </Button>
          </form>
        )}

        <div className="mt-4 pt-3 border-t">
          <div className="text-xs text-muted-foreground mb-2">Quick login (demo accounts):</div>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_ACCOUNTS.map((d) => (
              <Button
                key={d.email}
                type="button"
                size="sm"
                variant={d.isReal ? "default" : "outline"}
                onClick={() => quickLogin(d)}
                title={`${d.email} / ${d.password}`}
              >
                {d.label}
              </Button>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-2">
            Real admin: <code>ekontetevi@gmail</code> / <code>Payswap123456</code>
            <br />
            Demo accounts: <code>EksClean123!</code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
//  Waitlist admin panel — shown only when an admin is logged in
// ---------------------------------------------------------------------------

function WaitlistAdmin({ entries, onChange }: { entries: WaitlistEntry[]; onChange: () => void }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("PENDING");
  const filtered = entries.filter((e) => filter === "ALL" || e.status === filter);

  async function approve(id: string, overrideRole?: string) {
    try {
      await api(`/api/admin/waitlist/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ overrideRole }),
      });
      toast({ title: "Account created", description: "User has been approved and can now sign in." });
      onChange();
    } catch (e) {
      toast({ title: "Approval failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function reject(id: string) {
    const reason = window.prompt("Rejection reason:");
    if (!reason) return;
    try {
      await api(`/api/admin/waitlist/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      toast({ title: "Entry rejected" });
      onChange();
    } catch (e) {
      toast({ title: "Rejection failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          Waitlist
          <Badge variant="secondary">{entries.filter((e) => e.status === "PENDING").length} pending</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-1">
          {["PENDING", "APPROVED", "REJECTED", "ALL"].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFilter(s)}
            >{s}</Button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">No {filter.toLowerCase()} entries.</div>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="border rounded p-2 space-y-1">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-sm">{e.fullName}</div>
                <div className="text-xs text-muted-foreground">{e.email}</div>
              </div>
              <Badge variant={e.status === "PENDING" ? "default" : e.status === "APPROVED" ? "secondary" : "destructive"} className="text-xs">
                {e.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Requested: {e.requestedRole} · {new Date(e.createdAt).toLocaleDateString()}
            </div>
            {e.status === "PENDING" && (
              <div className="flex gap-1 pt-1">
                <Button size="sm" className="h-7 text-xs" onClick={() => approve(e.id)}>Approve & Create Account</Button>
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => reject(e.id)}>Reject</Button>
              </div>
            )}
            {e.status === "REJECTED" && e.rejectionReason && (
              <div className="text-xs text-red-600">Reason: {e.rejectionReason}</div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
