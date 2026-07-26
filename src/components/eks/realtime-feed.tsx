"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { subscribe, getSocket } from "@/lib/realtime/client";

interface LiveEvent {
  id: string;
  channel: string;
  event: string;
  payload: unknown;
  at: number;
}

export function RealtimeFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const idRef = useRef(0);

  useEffect(() => {
    const s = getSocket();
    const onConn = () => setConnected(true);
    const onDisc = () => setConnected(false);
    s.on("connect", onConn);
    s.on("disconnect", onDisc);

    // Subscribe to ops channel for any broadcast
    s.emit("subscribe", "admin:ops");

    const handler = (payload: unknown) => {
      const ev: LiveEvent = {
        id: `e${++idRef.current}`,
        channel: "admin:ops",
        event: "broadcast",
        payload,
        at: Date.now(),
      };
      setEvents((prev) => [ev, ...prev].slice(0, 30));
    };
    s.on("booking:created", handler);
    s.on("booking:status", handler);
    s.on("assignment:offered", handler);
    s.on("dispatch:no_candidates", handler);

    return () => {
      s.off("connect", onConn);
      s.off("disconnect", onDisc);
      s.off("booking:created", handler);
      s.off("booking:status", handler);
      s.off("assignment:offered", handler);
      s.off("dispatch:no_candidates", handler);
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          Realtime Activity
          <span className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-muted-foreground font-normal">
            {connected ? "connected" : "disconnected"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-72 overflow-y-auto">
          {events.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground text-center">
              No live events yet. Try creating a booking or transitioning its status.
            </div>
          )}
          {events.map((e) => (
            <div key={e.id} className="p-2 border-b last:border-0 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono">{e.event}</span>
                <span className="text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
              </div>
              <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
