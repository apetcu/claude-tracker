import { access } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { Database } from "bun:sqlite";
import type { ConversationMessage, ContentBlock } from "../types";
import type { ParsedSession, FileContribution } from "./parser";

/**
 * Cursor tool names → normalized names (matching Claude Code conventions).
 */
const TOOL_NAME_MAP: Record<string, string> = {
  edit_file: "Edit",
  create_file: "Write",
  run_terminal_command: "Bash",
  read_file: "Read",
  list_directory: "Glob",
  file_search: "Glob",
  search_files: "Grep",
  codebase_search: "Grep",
  grep_search: "Grep",
};

/** Bubble type constants from Cursor */
const BUBBLE_USER = 1;
const BUBBLE_ASSISTANT = 2;

const GLOBAL_DB_PATH = join(
  homedir(),
  "Library",
  "Application Support",
  "Cursor",
  "User",
  "globalStorage",
  "state.vscdb"
);

interface CursorBubble {
  type: number; // 1=user, 2=assistant
  text?: string;
  richText?: string;
  tokenCount?: { inputTokens?: number; outputTokens?: number };
  codeBlocks?: CursorCodeBlock[];
  timingInfo?: {
    clientStartTime?: number;
    clientEndTime?: number;
    clientSettleTime?: number;
  };
  bubbleId?: string;
}

interface CursorCodeBlock {
  content?: string;
  languageId?: string;
  uri?: { _fsPath?: string; path?: string };
}

/**
 * Parse a Cursor session (composer) from SQLite databases.
 * Workspace DB has composer metadata, global DB has bubble (message) data.
 */
export async function parseCursorSession(
  dbPath: string,
  sessionId: string,
  projectId: string
): Promise<ParsedSession> {
  // Bubbles are in the global database, keyed by composerId
  const bubbles = await loadBubblesFromGlobal(sessionId);

  // Get composer createdAt from workspace DB as fallback timestamp
  // (bubble timingInfo is almost always missing or relative offsets)
  const createdAt = getComposerCreatedAt(dbPath, sessionId);

  return buildParsedSession(bubbles, sessionId, projectId, createdAt);
}

/**
 * Look up composer createdAt from the workspace state.vscdb.
 */
function getComposerCreatedAt(dbPath: string, composerId: string): string {
  try {
    const db = new Database(dbPath, { readonly: true });
    try {
      for (const table of ["ItemTable", "cursorDiskKV"]) {
        const row = db
          .query(`SELECT value FROM ${table} WHERE key = 'composer.composerData'`)
          .get() as { value: string } | null;
        if (row?.value) {
          const data = JSON.parse(row.value);
          const composer = (data.allComposers ?? []).find(
            (c: { composerId: string }) => c.composerId === composerId
          );
          if (composer?.createdAt && composer.createdAt > 1_000_000_000) {
            // createdAt may be in milliseconds or seconds
            const ts = composer.createdAt > 1_000_000_000_000
              ? composer.createdAt
              : composer.createdAt * 1000;
            return new Date(ts).toISOString();
          }
        }
      }
    } finally {
      db.close();
    }
  } catch { /* ignore */ }
  return "";
}

/**
 * Load bubbles from the global Cursor state.vscdb.
 * Keys are: bubbleId:<composerId>:<bubbleId>
 */
async function loadBubblesFromGlobal(composerId: string): Promise<CursorBubble[]> {
  try {
    await access(GLOBAL_DB_PATH);
  } catch {
    return [];
  }

  const db = new Database(GLOBAL_DB_PATH, { readonly: true });
  try {
    const rows = db
      .query("SELECT value FROM cursorDiskKV WHERE key LIKE ?")
      .all(`bubbleId:${composerId}:%`) as { value: string }[];

    const bubbles: CursorBubble[] = [];
    for (const row of rows) {
      try {
        bubbles.push(JSON.parse(row.value));
      } catch { /* skip malformed */ }
    }

    // Sort by timing
    bubbles.sort((a, b) => {
      const ta = a.timingInfo?.clientStartTime ?? 0;
      const tb = b.timingInfo?.clientStartTime ?? 0;
      return ta - tb;
    });

    return bubbles;
  } catch {
    return [];
  } finally {
    db.close();
  }
}

function normalizeTool(name: string): string {
  return TOOL_NAME_MAP[name] ?? name;
}

function buildParsedSession(
  bubbles: CursorBubble[],
  sessionId: string,
  projectId: string,
  composerCreatedAt: string
): ParsedSession {
  const messages: ConversationMessage[] = [];
  const toolUsage: Record<string, number> = {};
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  let linesAdded = 0;
  let linesRemoved = 0;
  const fileContributions: Record<string, FileContribution> = {};
  let firstPrompt = "";
  let startedAt = "";
  let lastActive = "";
  let humanLines = 0;
  let humanWords = 0;
  let humanChars = 0;
  let durationMs = 0;

  // Base epoch ms from composer createdAt (used for relative offset calculations)
  const baseEpoch = composerCreatedAt ? new Date(composerCreatedAt).getTime() : 0;

  for (const bubble of bubbles) {
    const rawStart = bubble.timingInfo?.clientStartTime;
    const rawEnd = bubble.timingInfo?.clientEndTime ?? bubble.timingInfo?.clientSettleTime;

    let startTime: number | undefined;
    let endTime: number | undefined;

    if (rawStart && rawStart > 1_000_000_000_000) {
      // Absolute epoch ms
      startTime = rawStart;
    } else if (rawStart && rawStart > 0 && baseEpoch) {
      // Relative offset — add to composer creation time
      startTime = baseEpoch + rawStart;
    }

    if (rawEnd && rawEnd > 1_000_000_000_000) {
      endTime = rawEnd;
    } else if (rawEnd && rawEnd > 0 && baseEpoch) {
      endTime = baseEpoch + rawEnd;
    }

    const ts = startTime
      ? new Date(startTime).toISOString()
      : composerCreatedAt;

    if (ts) {
      if (!startedAt) startedAt = ts;
      lastActive = ts;
    }

    const text = bubble.text ?? "";

    if (bubble.type === BUBBLE_USER) {
      if (!firstPrompt && text.trim()) {
        firstPrompt = text.trim();
      }

      // Count human contribution
      if (text.trim()) {
        humanLines += text.split("\n").length;
        humanWords += text.split(/\s+/).filter(Boolean).length;
        humanChars += text.length;
      }

      // Token count (input tokens up to this point)
      if (bubble.tokenCount?.inputTokens) {
        tokens.input = Math.max(tokens.input, bubble.tokenCount.inputTokens);
      }

      const content: ContentBlock[] = text
        ? [{ type: "text", text }]
        : [];

      messages.push({
        role: "user",
        content,
        timestamp: ts,
        uuid: bubble.bubbleId ?? `cursor-${sessionId}-${messages.length}`,
      });
    } else if (bubble.type === BUBBLE_ASSISTANT) {
      // Count tokens
      if (bubble.tokenCount) {
        if (bubble.tokenCount.outputTokens) {
          tokens.output += bubble.tokenCount.outputTokens;
        }
        if (bubble.tokenCount.inputTokens) {
          tokens.input = Math.max(tokens.input, bubble.tokenCount.inputTokens);
        }
      }

      // Duration from timing info
      if (startTime && endTime) {
        durationMs += endTime - startTime;
      }

      // Build content blocks
      const content: ContentBlock[] = [];

      if (text) {
        content.push({ type: "text", text });
      }

      // Process code blocks for line counting and file contributions
      if (bubble.codeBlocks) {
        for (const cb of bubble.codeBlocks) {
          if (cb.content) {
            const lines = cb.content.split("\n").length;
            linesAdded += lines;

            // Extract file path from uri object
            const fp = cb.uri?._fsPath ?? cb.uri?.path ?? "";
            if (fp) {
              const fc = fileContributions[fp] ??= { added: 0, removed: 0 };
              fc.added += lines;

              // Count as Edit tool usage
              toolUsage["Edit"] = (toolUsage["Edit"] ?? 0) + 1;
            }
          }
        }
      }

      messages.push({
        role: "assistant",
        content,
        timestamp: ts,
        uuid: bubble.bubbleId ?? `cursor-${sessionId}-${messages.length}`,
      });
    }
  }

  return {
    sessionId,
    projectId,
    cwd: "",
    messages,
    toolUsage,
    totalTokens: tokens,
    durationMs,
    linesAdded,
    linesRemoved,
    fileContributions,
    firstPrompt: firstPrompt.slice(0, 200),
    startedAt: startedAt || composerCreatedAt,
    lastActive: lastActive || composerCreatedAt,
    humanLines,
    humanWords,
    humanChars,
    source: "cursor",
  };
}
