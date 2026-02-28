import { readdir, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const PROJECTS_DIR = join(homedir(), ".claude", "projects");

export interface ScannedProject {
  id: string;
  dir: string;
  sessionFiles: { id: string; path: string; mtime: Date; size: number }[];
}

export async function scanProjects(): Promise<ScannedProject[]> {
  const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects: ScannedProject[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectDir = join(PROJECTS_DIR, entry.name);
    const files = await readdir(projectDir, { withFileTypes: true });

    const sessionFiles: ScannedProject["sessionFiles"] = [];
    for (const f of files) {
      if (!f.name.endsWith(".jsonl") || f.isDirectory()) continue;
      const filePath = join(projectDir, f.name);
      const s = await stat(filePath);
      sessionFiles.push({
        id: f.name.replace(".jsonl", ""),
        path: filePath,
        mtime: s.mtime,
        size: s.size,
      });
    }

    if (sessionFiles.length > 0) {
      projects.push({
        id: entry.name,
        dir: projectDir,
        sessionFiles,
      });
    }
  }

  return projects;
}

export function getProjectsDir(): string {
  return PROJECTS_DIR;
}
