/**
 * ============================================================================
 *  Eks-Clean — Realtime Service (socket.io)
 * ============================================================================
 *  - Port 3001: socket.io server (path: "/" — required by Caddy gateway)
 *  - Port 3002: internal HTTP API (health + emit) — only called by Next.js
 *
 *  Channels (rooms):
 *    booking:<id>     — anyone watching a specific booking
 *    worker:<id>      — a worker's notifications
 *    customer:<id>    — a customer's notifications
 *    admin:ops        — operations dashboard
 * ============================================================================
 */

import { createServer } from "http";
import { Server } from "socket.io";

const SOCKET_PORT = 3001;
const HTTP_PORT = 3002;

// ---------------------------------------------------------------------------
//  Socket.io (port 3001) — Caddy proxies ws:///?XTransformPort=3001 here
// ---------------------------------------------------------------------------

const socketHttpServer = createServer((req, res) => {
  // socket.io will handle this. We just need a server object.
  res.writeHead(404);
  res.end("Not found");
});

const io = new Server(socketHttpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: "/",
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  console.log(`[realtime] connected: ${socket.id}`);

  socket.on("subscribe", (channel: unknown) => {
    if (typeof channel !== "string" || !channel) return;
    socket.join(channel);
    socket.emit("subscribed", { channel });
  });

  socket.on("unsubscribe", (channel: unknown) => {
    if (typeof channel === "string") socket.leave(channel);
  });

  socket.on("broadcast", ({ channel, event, payload }: { channel: string; event: string; payload: unknown }) => {
    if (typeof channel !== "string" || typeof event !== "string") return;
    io.to(channel).emit(event, payload);
  });

  socket.on("disconnect", () => {
    // console.log(`[realtime] disconnected: ${socket.id}`);
  });
});

socketHttpServer.listen(SOCKET_PORT, () => {
  console.log(`[realtime] socket.io listening on :${SOCKET_PORT}`);
});

// ---------------------------------------------------------------------------
//  Internal HTTP API (port 3002) — used by Next.js API routes to broadcast
// ---------------------------------------------------------------------------

const httpServer = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      service: "eks-clean-realtime",
      socketPort: SOCKET_PORT,
      httpPort: HTTP_PORT,
      clients: io.engine.clientsCount,
    }));
    return;
  }

  if (req.url === "/emit" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { channel, event, payload } = JSON.parse(body);
        if (typeof channel !== "string" || typeof event !== "string") {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: "channel and event required" }));
          return;
        }
        io.to(channel).emit(event, payload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, channel, event, clients: io.engine.clientsCount }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`[realtime] internal HTTP API listening on :${HTTP_PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("[realtime] shutting down...");
  socketHttpServer.close();
  httpServer.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
