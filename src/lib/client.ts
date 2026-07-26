/**
 * Frontend API client + auth store (Zustand) for Eks-Clean dashboard.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
//  Session
// ---------------------------------------------------------------------------

interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string; fullName: string };
}

interface AuthState {
  session: Session | null;
  setSession: (s: Session | null) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (s) => set({ session: s }),
      clear: () => set({ session: null }),
    }),
    { name: "eks-auth" },
  ),
);

// ---------------------------------------------------------------------------
//  Fetch wrapper — auto-attach access token, auto-rotate on 401
// ---------------------------------------------------------------------------

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { session } = useAuth.getState();
  const headers = new Headers(init.headers || {});
  if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let res = await fetch(path, { ...init, headers });

  // Try refresh on 401
  if (res.status === 401 && session?.refreshToken) {
    const r = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (r.ok) {
      const data = await r.json();
      const newSession = data.data.session as Session;
      useAuth.getState().setSession(newSession);
      headers.set("Authorization", `Bearer ${newSession.accessToken}`);
      res = await fetch(path, { ...init, headers });
    } else {
      useAuth.getState().clear();
    }
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } }).error?.message || res.statusText;
    throw new Error(msg);
  }
  return (json as { data: T }).data ?? (json as T);
}
