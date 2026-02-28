import { Hono } from "hono";
import { scanProjects } from "../services/scanner";
import { parseSessionMetadata, parseSessionFile } from "../services/parser";
import { getCachedSession } from "../services/cache";
import { humanizeName } from "../services/util";

const app = new Hono();

// GET /api/projects
app.get("/", async (c) => {
  const projects = await scanProjects();

  const result = await Promise.all(
    projects.map(async (p) => {
      // Get last modified time and metadata from first file
      let lastActive = new Date(0).toISOString();
      let messageCount = 0;

      for (const f of p.sessionFiles) {
        if (f.mtime.toISOString() > lastActive) {
          lastActive = f.mtime.toISOString();
        }
      }

      return {
        id: p.id,
        name: humanizeName(p.id),
        sessionCount: p.sessionFiles.length,
        lastActive,
        messageCount, // Will be computed lazily
      };
    })
  );

  return c.json(result.sort((a, b) => b.lastActive.localeCompare(a.lastActive)));
});

// GET /api/projects/:id
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const projects = await scanProjects();
  const project = projects.find((p) => p.id === id);

  if (!project) return c.json({ error: "Project not found" }, 404);

  // Get cwd from first session
  let path = "";
  if (project.sessionFiles.length > 0) {
    const meta = await parseSessionMetadata(project.sessionFiles[0].path);
    path = meta.cwd;
  }

  let lastActive = new Date(0).toISOString();
  for (const f of project.sessionFiles) {
    if (f.mtime.toISOString() > lastActive) {
      lastActive = f.mtime.toISOString();
    }
  }

  return c.json({
    id: project.id,
    name: humanizeName(project.id),
    path,
    sessionCount: project.sessionFiles.length,
    lastActive,
  });
});

// GET /api/projects/:id/sessions
app.get("/:id/sessions", async (c) => {
  const id = c.req.param("id");
  const projects = await scanProjects();
  const project = projects.find((p) => p.id === id);

  if (!project) return c.json({ error: "Project not found" }, 404);

  const sessions = await Promise.all(
    project.sessionFiles.map(async (f) => {
      const session = await getCachedSession(f.id, f.path, parseSessionFile, id);
      return {
        id: session.sessionId,
        firstPrompt: session.firstPrompt,
        startedAt: session.startedAt,
        messageCount: session.messages.length,
        toolUseCount: Object.values(session.toolUsage).reduce((a, b) => a + b, 0),
        durationMs: session.durationMs,
      };
    })
  );

  return c.json(sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
});

export default app;
