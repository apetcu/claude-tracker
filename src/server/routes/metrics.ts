import { Hono } from "hono";
import { scanAllProjects } from "../services/scanner";
import { parseSessionFile } from "../services/parser";
import { parseCursorSession } from "../services/cursor-parser";
import { getCachedSession } from "../services/cache";
import {
  computeGlobalMetrics,
  computeProjectMetrics,
  computeSessionMetrics,
} from "../services/metrics";

const app = new Hono();

function getParser(source: string) {
  return source === "cursor" ? parseCursorSession : parseSessionFile;
}

// GET /api/metrics/global
app.get("/global", async (c) => {
  const projects = await scanAllProjects();

  const allSessions = await Promise.all(
    projects.flatMap((p) =>
      p.sessionFiles.map((f) =>
        getCachedSession(f.id, f.path, getParser(f.source), p.id)
      )
    )
  );

  const totalSessionCount = projects.reduce((sum, p) => sum + p.sessionFiles.length, 0);
  return c.json(computeGlobalMetrics(projects.length, totalSessionCount, allSessions));
});

// GET /api/metrics/project/:id
app.get("/project/:id", async (c) => {
  const id = c.req.param("id");
  const projects = await scanAllProjects();
  const project = projects.find((p) => p.id === id);

  if (!project) return c.json({ error: "Project not found" }, 404);

  const sessions = await Promise.all(
    project.sessionFiles.map((f) =>
      getCachedSession(f.id, f.path, getParser(f.source), project.id)
    )
  );

  return c.json(computeProjectMetrics(sessions));
});

// GET /api/metrics/session/:id
app.get("/session/:id", async (c) => {
  const sessionId = c.req.param("id");
  const projects = await scanAllProjects();

  for (const project of projects) {
    const file = project.sessionFiles.find((f) => f.id === sessionId);
    if (file) {
      const session = await getCachedSession(
        sessionId,
        file.path,
        getParser(file.source),
        project.id
      );
      return c.json(computeSessionMetrics(session));
    }
  }

  return c.json({ error: "Session not found" }, 404);
});

export default app;
