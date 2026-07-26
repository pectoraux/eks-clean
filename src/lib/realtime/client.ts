"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
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
