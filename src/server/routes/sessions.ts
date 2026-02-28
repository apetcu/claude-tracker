import { Hono } from "hono";
import { scanProjects } from "../services/scanner";
import { parseSessionFile } from "../services/parser";
import { getCachedSession } from "../services/cache";
import { computeSessionMetrics } from "../services/metrics";
import { humanizeName } from "../services/util";

const app = new Hono();

// GET /api/sessions/:id
app.get("/:id", async (c) => {
  const sessionId = c.req.param("id");
  const projects = await scanProjects();

  // Find which project contains this session
  for (const project of projects) {
    const file = project.sessionFiles.find((f) => f.id === sessionId);
    if (file) {
      const session = await getCachedSession(
        sessionId,
        file.path,
        parseSessionFile,
        project.id
      );

      return c.json({
        id: session.sessionId,
        projectId: project.id,
        projectName: humanizeName(project.id),
        startedAt: session.startedAt,
        messages: session.messages,
        metrics: computeSessionMetrics(session),
      });
    }
  }

  return c.json({ error: "Session not found" }, 404);
});

export default app;
