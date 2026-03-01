import { Hono } from "hono";
import { cors } from "hono/cors";
import projectsRoutes from "./routes/projects";
import sessionsRoutes from "./routes/sessions";
import metricsRoutes from "./routes/metrics";
import { startWatcher, startCursorWatcher } from "./services/watcher";
import { invalidateAll } from "./services/cache";

const app = new Hono();

app.use("*", cors({ origin: "*" }));

app.route("/api/projects", projectsRoutes);
app.route("/api/sessions", sessionsRoutes);
app.route("/api/metrics", metricsRoutes);

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.post("/api/cache/clear", (c) => {
  invalidateAll();
  return c.json({ status: "ok", message: "Cache cleared" });
});

// WebSocket connections
const wsClients = new Set<{ send: (data: string) => void }>();

function broadcast(data: object): void {
  const json = JSON.stringify(data);
  for (const client of wsClients) {
    try {
      client.send(json);
    } catch {
      wsClients.delete(client);
    }
  }
}

// Start file watchers
startWatcher(broadcast);
startCursorWatcher(broadcast);

const server = Bun.serve({
  port: 3001,
  fetch(req) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined as unknown as Response;
    }

    return app.fetch(req);
  },
  websocket: {
    idleTimeout: 120,
    open(ws) {
      wsClients.add(ws);
      ws.send(JSON.stringify({ type: "connected", timestamp: new Date().toISOString() }));
    },
    message(_ws, _message) {
      // No client->server messages needed
    },
    close(ws) {
      wsClients.delete(ws);
    },
  },
});

console.log(`[server] Coding Activity API running on http://localhost:${server.port}`);
