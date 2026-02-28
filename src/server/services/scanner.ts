import { readdir, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { DataSource } from "../types";
import { parseSessionMetadata } from "./parser";

const PROJECTS_DIR = join(homedir(), ".claude", "projects");

export interface SessionFile {
  id: string;
  path: string;
  mtime: Date;
  size: number;
  source: DataSource;
}

export interface ScannedProject {
  id: string;
  dir: string;
  /** Primary source (or first source found) */
  source: DataSource;
  /** All sources contributing to this project */
  sources: DataSource[];
  sessionFiles: SessionFile[];
}

export async function scanClaudeProjects(): Promise<ScannedProject[]> {
  try {
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects: ScannedProject[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const projectDir = join(PROJECTS_DIR, entry.name);
      const files = await readdir(projectDir, { withFileTypes: true });

      const sessionFiles: SessionFile[] = [];
      for (const f of files) {
        if (!f.name.endsWith(".jsonl") || f.isDirectory()) continue;
        const filePath = join(projectDir, f.name);
        const s = await stat(filePath);
        sessionFiles.push({
          id: f.name.replace(".jsonl", ""),
          path: filePath,
          mtime: s.mtime,
          size: s.size,
          source: "claude",
        });
      }

      if (sessionFiles.length > 0) {
        projects.push({
          id: entry.name,
          dir: projectDir,
          source: "claude",
          sources: ["claude"],
          sessionFiles,
        });
      }
    }

    return projects;
  } catch {
    return [];
  }
}

/** @deprecated Use scanAllProjects() instead */
export const scanProjects = scanClaudeProjects;

/**
 * Scan all sources and merge projects that point to the same filesystem path.
 */
export async function scanAllProjects(): Promise<ScannedProject[]> {
  const { scanCursorProjects } = await import("./cursor-scanner");
  const [claude, cursor] = await Promise.all([
    scanClaudeProjects(),
    scanCursorProjects(),
  ]);

  // Resolve actual workspace paths for Claude projects (from session cwd)
  const pathToProject = new Map<string, ScannedProject>();

  // Process Claude projects first — resolve cwd from session metadata
  for (const p of claude) {
    let resolvedPath = "";
    // Try each session file until we find a cwd
    for (const sf of p.sessionFiles) {
      if (resolvedPath) break;
      try {
        const meta = await parseSessionMetadata(sf.path);
        if (meta.cwd) resolvedPath = meta.cwd;
      } catch { /* skip */ }
    }

    if (resolvedPath) {
      p.dir = resolvedPath;
      pathToProject.set(resolvedPath, p);
    } else {
      pathToProject.set(`claude:${p.id}`, p);
    }
  }

  // Process Cursor projects — merge if same path exists
  for (const p of cursor) {
    const resolvedPath = p.dir;
    const existing = pathToProject.get(resolvedPath);

    if (existing) {
      // Merge: add Cursor sessions into the existing Claude project
      existing.sessionFiles.push(...p.sessionFiles);
      if (!existing.sources.includes("cursor")) {
        existing.sources.push("cursor");
      }
    } else {
      pathToProject.set(resolvedPath, p);
    }
  }

  return [...pathToProject.values()];
}

export function getProjectsDir(): string {
  return PROJECTS_DIR;
}
