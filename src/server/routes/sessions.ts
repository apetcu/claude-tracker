import { Hono } from "hono";
import { scanAllProjects } from "../services/scanner";
import { parseSessionFile } from "../services/parser";
import { parseCursorSession } from "../services/cursor-parser";
import { getCachedSession } from "../services/cache";
import { computeSessionMetrics } from "../services/metrics";
import { humanizeName } from "../services/util";

const app = new Hono();

// GET /api/sessions/:id
app.get("/:id", async (c) => {
  const sessionId = c.req.param("id");
  const projects = await scanAllProjects();

  // Find which project contains this session
  for (const project of projects) {
    const file = project.sessionFiles.find((f) => f.id === sessionId);
    if (file) {
      const parser = file.source === "cursor" ? parseCursorSession : parseSessionFile;
      const session = await getCachedSession(
        sessionId,
        file.path,
        parser,
        project.id
      );

      return c.json({
        id: session.sessionId,
        projectId: project.id,
        projectName: humanizeName(project.id, project.dir),
        startedAt: session.startedAt,
        messages: session.messages,
        metrics: computeSessionMetrics(session),
        source: file.source,
      });
    }
  }

  return c.json({ error: "Session not found" }, 404);
});

export default app;
