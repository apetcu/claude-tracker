import { readFile } from "fs/promises";
import type {
  RawEvent,
  ConversationMessage,
  ContentBlock,
} from "../types";

const SKIP_TYPES = new Set(["progress", "queue-operation", "file-history-snapshot"]);

export interface FileContribution {
  added: number;
  removed: number;
}

export interface ParsedSession {
  sessionId: string;
  projectId: string;
  cwd: string;
  messages: ConversationMessage[];
  toolUsage: Record<string, number>;
  totalTokens: { input: number; output: number; cacheRead: number; cacheCreation: number };
  durationMs: number;
  linesAdded: number;
  linesRemoved: number;
  fileContributions: Record<string, FileContribution>;
  firstPrompt: string;
  startedAt: string;
  lastActive: string;
}

export async function parseSessionFile(
  filePath: string,
  sessionId: string,
  projectId: string
): Promise<ParsedSession> {
  const raw = await readFile(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());

  // First pass: collect all events, deduplicate assistant messages by message.id
  // For streaming, multiple events share the same message.id - keep the last one
  const userEvents: { event: RawEvent; ts: string }[] = [];
  const assistantByMsgId = new Map<string, { event: RawEvent; ts: string }>();
  const assistantNoId: { event: RawEvent; ts: string }[] = [];
  let durationMs = 0;
  let cwd = "";
  let startedAt = "";
  let lastActive = "";

  for (const line of lines) {
    let event: RawEvent;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (SKIP_TYPES.has(event.type)) continue;

    if (!cwd && event.cwd) cwd = event.cwd;

    const ts = event.timestamp ?? "";
    if (ts) {
      if (!startedAt) startedAt = ts;
      lastActive = ts;
    }

    if (event.type === "system") {
      if (event.subtype === "turn_duration" && event.durationMs) {
        durationMs += event.durationMs;
      }
      continue;
    }

    if (event.type === "user" && event.message?.role === "user") {
      userEvents.push({ event, ts });
      continue;
    }

    if (event.type === "assistant" && event.message?.role === "assistant") {
      const msgId = event.message.id;
      if (msgId) {
        // Keep overwriting - last event for this message id wins (has most complete content)
        assistantByMsgId.set(msgId, { event, ts });
      } else {
        assistantNoId.push({ event, ts });
      }
    }
  }

  // Build messages list in order
  const messages: ConversationMessage[] = [];
  const toolUsage: Record<string, number> = {};
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  let linesAdded = 0;
  let linesRemoved = 0;
  const fileContributions: Record<string, FileContribution> = {};
  let firstPrompt = "";

  // Interleave user and assistant messages by timestamp
  // Collect all deduplicated assistant events
  const allAssistant = [
    ...assistantByMsgId.values(),
    ...assistantNoId,
  ];

  // Merge all events, sort by timestamp
  type TaggedEvent = { kind: "user" | "assistant"; event: RawEvent; ts: string };
  const allEvents: TaggedEvent[] = [
    ...userEvents.map((e) => ({ kind: "user" as const, ...e })),
    ...allAssistant.map((e) => ({ kind: "assistant" as const, ...e })),
  ];
  allEvents.sort((a, b) => a.ts.localeCompare(b.ts));

  for (const { kind, event, ts } of allEvents) {
    const msg = event.message!;

    if (kind === "user") {
      if (!firstPrompt) {
        firstPrompt = extractText(msg.content);
      }
      messages.push({
        role: "user",
        content: msg.content,
        timestamp: ts,
        uuid: event.uuid ?? "",
      });
    } else {
      messages.push({
        role: "assistant",
        content: msg.content,
        timestamp: ts,
        uuid: event.uuid ?? "",
        usage: msg.usage,
      });

      // Count tokens (once per deduplicated message)
      if (msg.usage) {
        tokens.input += msg.usage.input_tokens ?? 0;
        tokens.output += msg.usage.output_tokens ?? 0;
        tokens.cacheRead += msg.usage.cache_read_input_tokens ?? 0;
        tokens.cacheCreation += msg.usage.cache_creation_input_tokens ?? 0;
      }

      // Count tool uses and code contribution
      if (Array.isArray(msg.content)) {
        for (const block of msg.content as ContentBlock[]) {
          if (block.type === "tool_use" && block.name) {
            toolUsage[block.name] = (toolUsage[block.name] ?? 0) + 1;

            if (block.name === "Write" && block.input?.content) {
              const lines = String(block.input.content).split("\n").length;
              linesAdded += lines;
              if (block.input.file_path) {
                const fp = String(block.input.file_path);
                const fc = fileContributions[fp] ??= { added: 0, removed: 0 };
                fc.added += lines;
              }
            }

            if (block.name === "Edit" && block.input) {
              const oldStr = String(block.input.old_string ?? "");
              const newStr = String(block.input.new_string ?? "");
              const oldLines = oldStr ? oldStr.split("\n").length : 0;
              const newLines = newStr ? newStr.split("\n").length : 0;
              linesRemoved += oldLines;
              linesAdded += newLines;
              if (block.input.file_path) {
                const fp = String(block.input.file_path);
                const fc = fileContributions[fp] ??= { added: 0, removed: 0 };
                fc.added += newLines;
                fc.removed += oldLines;
              }
            }
          }
        }
      }
    }
  }

  return {
    sessionId,
    projectId,
    cwd,
    messages,
    toolUsage,
    totalTokens: tokens,
    durationMs,
    linesAdded,
    linesRemoved,
    fileContributions,
    firstPrompt: firstPrompt.slice(0, 200),
    startedAt,
    lastActive,
  };
}

function extractText(content: string | ContentBlock[] | unknown): string {
  if (typeof content === "string") return content.replace(/\s+/g, " ").trim();
  if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === "object" && block !== null) {
        const b = block as ContentBlock;
        if (b.type === "text" && b.text) return b.text.replace(/\s+/g, " ").trim();
      }
    }
  }
  return "";
}

/** Quick metadata extraction: only reads first few events for prompt + cwd */
export async function parseSessionMetadata(
  filePath: string
): Promise<{ cwd: string; firstPrompt: string; startedAt: string }> {
  const raw = await readFile(filePath, "utf-8");
  let cwd = "";
  let firstPrompt = "";
  let startedAt = "";

  const lines = raw.split("\n");
  const limit = Math.min(lines.length, 20);

  for (let i = 0; i < limit; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    try {
      const event: RawEvent = JSON.parse(line);
      if (!cwd && event.cwd) cwd = event.cwd;
      if (!startedAt && event.timestamp) startedAt = event.timestamp;

      if (event.type === "user" && event.message?.role === "user" && !firstPrompt) {
        firstPrompt = extractText(event.message.content).slice(0, 200);
      }

      if (cwd && firstPrompt && startedAt) break;
    } catch {
      continue;
    }
  }

  return { cwd, firstPrompt, startedAt };
}
