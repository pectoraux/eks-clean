"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Calendar, Home, User, Clock, CheckCircle2 } from "lucide-react";

interface AppInfo {
  id: string;
  name: string;
  slug: string;
  protocolKey: string;
  primaryColor: string;
  accentColor: string;
  description: string | null;
  status: string;
}

interface AppSession {
  accessToken: string;
  appUser: { id: string; role: string; userId: string };
}

const APP_SESSION_KEY = "opsos-app-session";

export default function AppPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const slug = params.appSlug as string;

  const [app, setApp] = useState<AppInfo | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [view, setView] = useState<"landing" | "login" | "register" | "dashboard" | "book" | "services">("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [services, setServices] = useState<Array<Record<string, unknown>>>([]);
  const [demands, setDemands] = useState<Array<Record<string, unknown>>>([]);

  // Load app info
  useEffect(() => {
    if (!slug) return;
    let active = true;
    (async () => {
      try {
        const r = await api<{ app: AppInfo }>(`/api/apps/${slug}`);
        if (!active) return;
        if (!r || !r.app) {
          toast({ title: "Application not found", variant: "destructive" });
          return;
        }
        setApp(r.app);
        // Check for existing session
        const stored = localStorage.getItem(`${APP_SESSION_KEY}-${slug}`);
        if (stored) {
          const sess = JSON.parse(stored) as AppSession;
          setSession(sess);
          setView("dashboard");
        }
      } catch {
        if (active) toast({ title: "Application not found", variant: "destructive" });
      }
    })();
    return () => { active = false; };
  }, [slug]);

  // Load services when session is available
  useEffect(() => {
    if (!session || !app) return;
    (async () => {
      try {
        const r = await fetch(`/api/apps/${slug}/services`, {
          method: "GET",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        setServices(r.items);
      } catch {}
    })();
  }, [session, app, slug]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ session: AppSession }>(`/api/apps/${slug}/auth/login`, {
        method: "POST", body: JSON.stringify({ email, password }),
      });
      setSession(r.session);
      localStorage.setItem(`${APP_SESSION_KEY}-${slug}`, JSON.stringify(r.session));
      setView("dashboard");
      toast({ title: "Welcome back!" });
    } catch (e) {
      toast({ title: "Login failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function doRegister(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ session: AppSession }>(`/api/apps/${slug}/auth/register`, {
        method: "POST", body: JSON.stringify({ email, password, fullName }),
      });
      setSession(r.session);
      localStorage.setItem(`${APP_SESSION_KEY}-${slug}`, JSON.stringify(r.session));
      setView("dashboard");
      toast({ title: "Account created!" });
    } catch (e) {
      toast({ title: "Registration failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  function logout() {
    setSession(null);
    localStorage.removeItem(`${APP_SESSION_KEY}-${slug}`);
    setView("landing");
  }

  if (!app) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const primaryColor = app.primaryColor || "#0066FF";

  // --- LANDING PAGE (no auth required) ---
  if (view === "landing" && !session) {
    return (
      <div className="min-h-screen flex flex-col bg-background" style={{ "--primary": primaryColor } as React.CSSProperties}>
        <header className="border-b" style={{ background: primaryColor }}>
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-white/20 flex items-center justify-center font-bold text-white">{app.name.charAt(0)}</div>
              <span className="font-semibold text-white">{app.name}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="text-white hover:bg-white/20" onClick={() => setView("login")}>Sign In</Button>
              <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={() => setView("register")}>Get Started</Button>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full" style={{ background: `${primaryColor}15`, color: primaryColor }}>
              <Sparkles className="w-3 h-3" /> Powered by OpsOS
            </div>
            <h1 className="text-5xl font-bold tracking-tight">{app.name}</h1>
            <p className="text-xl text-muted-foreground">{app.description || "Professional cleaning services at your fingertips"}</p>
            <div className="flex gap-3 justify-center pt-4">
              <Button size="lg" style={{ background: primaryColor }} onClick={() => setView("register")}>Get Started Free</Button>
              <Button size="lg" variant="outline" onClick={() => setView("login")}>Sign In</Button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
            {[
              { icon: Calendar, title: "Easy Booking", desc: "Schedule cleaning in seconds. Choose your service, time, and frequency." },
              { icon: Home, title: "Property Profile", desc: "We learn your home — rooms, surfaces, and preferences for personalized service." },
              { icon: CheckCircle2, title: "Quality Guaranteed", desc: "Every cleaning is inspected. Not happy? We'll make it right." },
            ].map((f) => (
              <Card key={f.title}><CardContent className="p-6 text-center">
                <f.icon className="w-10 h-10 mx-auto mb-3" style={{ color: primaryColor }} />
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent></Card>
            ))}
          </div>
        </main>

        <footer className="border-t py-4">
          <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
            {app.name} · Powered by <span className="font-medium">OpsOS</span>
          </div>
        </footer>
      </div>
    );
  }

  // --- LOGIN / REGISTER ---
  if (view === "login" || view === "register") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white" style={{ background: primaryColor }}>{app.name.charAt(0)}</div>
              <div>
                <CardTitle className="text-xl">{app.name}</CardTitle>
                <div className="text-xs text-muted-foreground">{view === "login" ? "Sign in to your account" : "Create your account"}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={view === "login" ? doLogin : doRegister} className="space-y-3">
              {view === "register" && <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />}
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="submit" className="w-full" style={{ background: primaryColor }}>{view === "login" ? "Sign In" : "Create Account"}</Button>
              <Button type="button" variant="link" className="w-full text-xs" onClick={() => setView(view === "login" ? "register" : "login")}>
                {view === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-xs" onClick={() => setView("landing")}>← Back to home</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- DASHBOARD (authenticated) ---
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b" style={{ background: primaryColor }}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-white/20 flex items-center justify-center font-bold text-white">{app.name.charAt(0)}</div>
            <span className="font-semibold text-white">{app.name}</span>
          </div>
          <nav className="flex items-center gap-1">
            <Button variant="ghost" className="text-white hover:bg-white/20 text-sm" onClick={() => setView("dashboard")}>Dashboard</Button>
            <Button variant="ghost" className="text-white hover:bg-white/20 text-sm" onClick={() => setView("services")}>Services</Button>
            <Button variant="ghost" className="text-white hover:bg-white/20 text-sm" onClick={() => setView("book")}>Book</Button>
            <Button variant="ghost" className="text-white hover:bg-white/20 text-sm" onClick={logout}>Sign Out</Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {view === "dashboard" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Welcome back!</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card><CardContent className="p-4">
                <Calendar className="w-6 h-6 mb-2" style={{ color: primaryColor }} />
                <div className="text-xs text-muted-foreground">Active Bookings</div>
                <div className="text-2xl font-bold">{demands.length}</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <CheckCircle2 className="w-6 h-6 mb-2" style={{ color: primaryColor }} />
                <div className="text-xs text-muted-foreground">Completed Services</div>
                <div className="text-2xl font-bold">0</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <Clock className="w-6 h-6 mb-2" style={{ color: primaryColor }} />
                <div className="text-xs text-muted-foreground">Next Service</div>
                <div className="text-sm font-medium">No upcoming</div>
              </CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
              <CardContent>
                <Button style={{ background: primaryColor }} onClick={() => setView("book")}>Book a Cleaning</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {view === "services" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Our Services</h1>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <Card key={s.id as string} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="font-medium">{s.name as string}</div>
                    <div className="text-xs text-muted-foreground">{(s.description as string) ?? ""}</div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Badge variant="outline" className="text-xs">{(s.code as string)?.replace("CAP-", "")}</Badge>
                      <Button size="sm" style={{ background: primaryColor }} onClick={() => setView("book")}>Book</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {services.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">No services available.</CardContent></Card>}
            </div>
          </div>
        )}

        {view === "book" && (
          <div className="space-y-4 max-w-2xl">
            <h1 className="text-2xl font-bold">Book a Service</h1>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Service</label>
                  <select className="w-full px-3 py-2 border rounded mt-1" onChange={(e) => {
                    const svc = services.find(s => s.id === e.target.value);
                    // Store selected service
                  }}>
                    <option value="">Select a service...</option>
                    {services.map((s) => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground">Date</label><Input type="date" /></div>
                  <div><label className="text-xs text-muted-foreground">Time</label><Input type="time" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground">Rooms</label><Input type="number" defaultValue={3} /></div>
                  <div><label className="text-xs text-muted-foreground">Bathrooms</label><Input type="number" defaultValue={2} /></div>
                </div>
                <Button className="w-full" style={{ background: primaryColor }} onClick={async () => {
                  toast({ title: "Booking created!", description: "We'll assign a cleaner shortly." });
                  setView("dashboard");
                }}>Book Now</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <footer className="border-t py-3">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          {app.name} · Powered by OpsOS
        </div>
      </footer>
    </div>
  );
}
