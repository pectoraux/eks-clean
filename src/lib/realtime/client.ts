"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

// On Vercel (and other deployments without the realtime mini-service),
// the socket.io connection will simply fail to connect. We still expose
// `getSocket()` so callers don't crash — the RealtimeFeed UI shows a
// "disconnected" indicator and life goes on. On space-z.ai / local dev,
// Caddy proxies the connection to the mini-service on port 3001.

const isVercel = typeof window !== "undefined" && (
  window.location.hostname.endsWith(".vercel.app") ||
  window.location.hostname === "eks-clean.vercel.app"
);

export function getSocket(): Socket {
  if (socket) return socket;
  if (isVercel) {
    // Return a stub socket that never connects — callers handle "disconnect" gracefully.
    socket = io("/?XTransformPort=3001", {
      transports: ["polling"],
      reconnection: false,
      timeout: 3000,
      autoConnect: false,
    });
    return socket;
  }
  socket = io("/?XTransformPort=3001", {
    transports: ["websocket", "polling"],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  });
  return socket;
}

export function subscribe(channel: string, event: string, handler: (payload: unknown) => void): () => void {
  if (isVercel) return () => {}; // no-op on Vercel
  const s = getSocket();
  const onConnect = () => s.emit("subscribe", channel);
  if (s.connected) onConnect();
  s.on("connect", onConnect);
  s.on(event, handler);
  return () => {
    s.off("connect", onConnect);
    s.off(event, handler);
    s.emit("unsubscribe", channel);
  };
}

export function isRealtimeEnabled(): boolean {
  return !isVercel;
}
