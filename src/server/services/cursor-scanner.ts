import { readdir, readFile, access } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { Database } from "bun:sqlite";
import type { ScannedProject } from "./scanner";

const CURSOR_STORAGE_DIR = join(
  homedir(),
  "Library",
  "Application Support",
  "Cursor",
  "User",
  "workspaceStorage"
);

const GLOBAL_DB_PATH = join(
  homedir(),
  "Library",
  "Application Support",
  "Cursor",
  "User",
  "globalStorage",
  "state.vscdb"
);

interface ComposerHead {
  composerId: string;
  createdAt: number;
  unifiedMode?: string;
  isArchived?: boolean;
}

interface ComposerData {
  allComposers: ComposerHead[];
}

/**
 * Get the set of composer IDs that actually have bubbles (messages) in the global DB.
 * This filters out empty composers that were created but never used.
 */
function getComposerIdsWithBubbles(): Set<string> {
  try {
    const db = new Database(GLOBAL_DB_PATH, { readonly: true });
    try {
      // Keys are formatted as bubbleId:<composerId>:<bubbleId>
      // Extract distinct composer IDs
      const rows = db
        .query("SELECT DISTINCT substr(key, 10, 36) AS cid FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'")
        .all() as { cid: string }[];
      return new Set(rows.map((r) => r.cid));
    } finally {
      db.close();
    }
  } catch {
    return new Set();
  }
}

export async function scanCursorProjects(): Promise<ScannedProject[]> {
  try {
    await access(CURSOR_STORAGE_DIR);
  } catch {
    return [];
  }

  const projects: ScannedProject[] = [];
  const activeComposers = getComposerIdsWithBubbles();

  let dirNames: string[];
  try {
    dirNames = await readdir(CURSOR_STORAGE_DIR);
  } catch {
    return [];
  }

  for (const dirName of dirNames) {
    const workspaceDir = join(CURSOR_STORAGE_DIR, dirName);
    const dbPath = join(workspaceDir, "state.vscdb");
    const workspaceJsonPath = join(workspaceDir, "workspace.json");

    // Check state.vscdb exists
    try {
      await access(dbPath);
    } catch {
      continue;
    }

    // Read workspace.json to get project folder path
    let projectFolder = "";
    try {
      const wsRaw = await readFile(workspaceJsonPath, "utf-8");
      const wsData = JSON.parse(wsRaw);
      if (wsData.folder) {
        // folder is a URI like file:///Users/foo/project
        // Remote/background workspaces use vscode-remote:// — skip those
        if (wsData.folder.startsWith("vscode-remote://")) continue;
        projectFolder = decodeURIComponent(
          wsData.folder.replace(/^file:\/\//, "")
        );
      }
    } catch {
      // workspace.json missing or unreadable — skip this workspace
      continue;
    }

    // Skip workspaces without a valid project folder
    if (!projectFolder) continue;

    // Read composer data from SQLite
    let composers: ComposerHead[] = [];
    try {
      const db = new Database(dbPath, { readonly: true });
      try {
        // Try ItemTable first (more common)
        const row = db
          .query("SELECT value FROM ItemTable WHERE key = 'composer.composerData'")
          .get() as { value: string } | null;

        if (row?.value) {
          const data: ComposerData = JSON.parse(row.value);
          composers = data.allComposers?.filter((c) => !c.isArchived) ?? [];
        }

        // Also try cursorDiskKV
        if (composers.length === 0) {
          const kvRow = db
            .query("SELECT value FROM cursorDiskKV WHERE key = 'composer.composerData'")
            .get() as { value: string } | null;

          if (kvRow?.value) {
            const data: ComposerData = JSON.parse(kvRow.value);
            composers = data.allComposers?.filter((c) => !c.isArchived) ?? [];
          }
        }
      } finally {
        db.close();
      }
    } catch {
      continue;
    }

    // Filter to only composers that have actual bubbles (messages) in the global DB
    composers = composers.filter((c) => activeComposers.has(c.composerId));

    if (composers.length === 0) continue;

    const projectId = `cursor-${dirName}`;

    // Each composer becomes a "session file" entry
    const sessionFiles = composers.map((c) => ({
      id: c.composerId,
      path: dbPath, // all sessions live in the same SQLite db
      mtime: new Date(c.createdAt),
      size: 0, // not meaningful for SQLite-backed sessions
      source: "cursor" as const,
    }));

    projects.push({
      id: projectId,
      dir: projectFolder || workspaceDir,
      source: "cursor",
      sources: ["cursor"],
      sessionFiles,
    });
  }

  return projects;
}
