import { Hono } from "hono";
import { scanAllProjects } from "../services/scanner";
import { parseSessionMetadata, parseSessionFile } from "../services/parser";
import { parseCursorSession } from "../services/cursor-parser";
import { getCachedSession } from "../services/cache";
import { humanizeName } from "../services/util";
import type { DataSource } from "../types";

const app = new Hono();

function getParser(source: DataSource) {
  return source === "cursor" ? parseCursorSession : parseSessionFile;
}

// GET /api/projects
app.get("/", async (c) => {
  const projects = await scanAllProjects();

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
        name: humanizeName(p.id, p.dir),
        sessionCount: p.sessionFiles.length,
        lastActive,
        messageCount, // Will be computed lazily
        source: p.source,
        sources: p.sources,
      };
    })
  );

  return c.json(result.sort((a, b) => b.lastActive.localeCompare(a.lastActive)));
});

// GET /api/projects/:id
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const projects = await scanAllProjects();
  const project = projects.find((p) => p.id === id);

  if (!project) return c.json({ error: "Project not found" }, 404);

  // Get cwd from first Claude session, or use dir for Cursor-only projects
  let path = "";
  const claudeFile = project.sessionFiles.find((f) => f.source === "claude");
  if (claudeFile) {
    const meta = await parseSessionMetadata(claudeFile.path);
    path = meta.cwd;
  } else {
    path = project.dir;
  }

  let lastActive = new Date(0).toISOString();
  for (const f of project.sessionFiles) {
    if (f.mtime.toISOString() > lastActive) {
      lastActive = f.mtime.toISOString();
    }
  }

  return c.json({
    id: project.id,
    name: humanizeName(project.id, project.dir),
    path,
    sessionCount: project.sessionFiles.length,
    lastActive,
    source: project.source,
    sources: project.sources,
  });
});

// GET /api/projects/:id/sessions
app.get("/:id/sessions", async (c) => {
  const id = c.req.param("id");
  const projects = await scanAllProjects();
  const project = projects.find((p) => p.id === id);

  if (!project) return c.json({ error: "Project not found" }, 404);

  const sessions = await Promise.all(
    project.sessionFiles.map(async (f) => {
      const parser = getParser(f.source);
      const session = await getCachedSession(f.id, f.path, parser, id);
      return {
        id: session.sessionId,
        firstPrompt: session.firstPrompt,
        startedAt: session.startedAt || f.mtime.toISOString(),
        messageCount: session.messages.length,
        toolUseCount: Object.values(session.toolUsage).reduce((a, b) => a + b, 0),
        durationMs: session.durationMs,
        totalTokens: session.totalTokens.input + session.totalTokens.output,
        inputTokens: session.totalTokens.input,
        outputTokens: session.totalTokens.output,
        cacheReadTokens: session.totalTokens.cacheRead,
        model: session.model,
        source: f.source,
      };
    })
  );

  const filtered = sessions.filter((s) => s.firstPrompt || s.messageCount > 0);
  return c.json(filtered.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
});

export default app;
