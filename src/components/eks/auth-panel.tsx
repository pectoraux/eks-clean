"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, useAuth } from "@/lib/client";

interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string; fullName: string };
}

export function AuthPanel() {
  const { session, setSession, clear } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("admin@eksclean.example");
  const [password, setPassword] = useState("EksClean123!");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"CUSTOMER" | "WORKER" | "FIELD_MANAGER" | "SALES_AGENT">("CUSTOMER");
  const [loading, setLoading] = useState(false);

  // Demo accounts quick login
  const demos = [
    { label: "Admin", email: "admin@eksclean.example" },
    { label: "Field Mgr", email: "fm1@eksclean.example" },
    { label: "Sales", email: "sales1@eksclean.example" },
    { label: "Customer", email: "adwoa@example.com" },
    { label: "Worker", email: "samuel.w@eksclean.example" },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { email, password }
        : { email, password, fullName, role };
      const r = await api<{ user: { id: string; email: string; role: string; fullName: string }; session: Session }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSession({ ...r.session, user: r.user });
      toast({ title: `Welcome, ${r.user.fullName}`, description: `Role: ${r.user.role}` });
    } catch (e) {
      toast({ title: "Auth failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (session) {
    return (
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
          }}>Sign out</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{mode === "login" ? "Sign in" : "Register"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="fullName" className="text-xs">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="role" className="text-xs">Register as</Label>
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
            {loading ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
          <Button type="button" variant="link" size="sm" className="w-full" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
          </Button>
        </form>

        <div className="mt-4 pt-3 border-t">
          <div className="text-xs text-muted-foreground mb-2">Demo accounts (password: EksClean123!):</div>
          <div className="flex flex-wrap gap-1.5">
            {demos.map((d) => (
              <Button
                key={d.email}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { setEmail(d.email); setPassword("EksClean123!"); setMode("login"); }}
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
