import { watch, type FSWatcher } from "fs";
import { stat } from "fs/promises";
import { join } from "path";
import { getProjectsDir } from "./scanner";
import { invalidateSession } from "./cache";
import { humanizeName } from "./util";

export interface ActivityEvent {
  type: string;
  projectId: string;
  projectName: string;
  sessionId: string;
  timestamp: string;
  /** What's happening right now */
  action?: string;
  /** Extra detail: tool name, file path, command, etc. */
  detail?: string;
  /** First user prompt in the session */
  firstPrompt?: string;
  /** Working directory for the session */
  cwd?: string;
  /** Model being used */
  model?: string;
  /** Cost info from the session (input + output tokens) */
  costUsd?: number;
  /** Total message count so far */
  messageCount?: number;
  /** Total tool use count so far */
  toolUseCount?: number;
}

type BroadcastFn = (data: ActivityEvent) => void;

let watcher: FSWatcher | null = null;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface ExtractedAction {
  action: string;
  detail: string;
  firstPrompt?: string;
  cwd?: string;
  model?: string;
  costUsd?: number;
  messageCount?: number;
  toolUseCount?: number;
}

/**
 * Read session file and extract the latest meaningful event plus session metadata.
 */
async function extractLatestAction(
  filePath: string
): Promise<ExtractedAction> {
  try {
    const s = await stat(filePath);
    const size = s.size;

    // Read the full file for metadata, but only if reasonably sized.
    // For large files, read head (for metadata) + tail (for latest action).
    const fd = Bun.file(filePath);
    let headBuf = "";
    let tailBuf = "";

    if (size <= 32768) {
      // Small file: read everything
      headBuf = await fd.text();
      tailBuf = headBuf;
    } else {
      // Large file: read first 8KB for metadata + last 8KB for latest action
      headBuf = await fd.slice(0, 8192).text();
      tailBuf = await fd.slice(size - 8192, size).text();
    }

    // Extract metadata from the head
    const headLines = headBuf.split("\n").filter((l) => l.trim());
    let firstPrompt = "";
    let cwd = "";
    let model = "";

    for (const line of headLines) {
      let ev: Record<string, unknown>;
      try { ev = JSON.parse(line); } catch { continue; }

      // Get cwd and model from the first system/init event
      if (!cwd && ev.cwd) cwd = String(ev.cwd);
      if (!model && ev.model) model = String(ev.model);
      if (!model && ev.message) {
        const msg = ev.message as Record<string, unknown>;
        if (msg.model) model = String(msg.model);
      }

      // Get first user prompt
      if (!firstPrompt && ev.type === "user") {
        const msg = ev.message as Record<string, unknown> | undefined;
        if (msg?.content) {
          const content = msg.content;
          if (typeof content === "string") {
            firstPrompt = content.replace(/\s+/g, " ").trim().slice(0, 200);
          } else if (Array.isArray(content)) {
            const textBlock = (content as Record<string, unknown>[]).find((b) => b.type === "text");
            if (textBlock?.text) {
              firstPrompt = String(textBlock.text).replace(/\s+/g, " ").trim().slice(0, 200);
            }
          }
        }
      }

      if (firstPrompt && cwd && model) break;
    }

    // Count messages and tool uses from all available lines
    const allLines = size <= 32768 ? headBuf.split("\n") : [...headBuf.split("\n"), ...tailBuf.split("\n")];
    let messageCount = 0;
    let toolUseCount = 0;
    let costUsd = 0;

    for (const line of allLines) {
      if (!line.trim()) continue;
      let ev: Record<string, unknown>;
      try { ev = JSON.parse(line); } catch { continue; }

      if (ev.type === "user" || ev.type === "assistant") messageCount++;

      if (ev.type === "assistant") {
        const msg = ev.message as Record<string, unknown> | undefined;
        if (msg?.content && Array.isArray(msg.content)) {
          for (const block of msg.content as Record<string, unknown>[]) {
            if (block.type === "tool_use") toolUseCount++;
          }
        }
        // Extract cost from usage
        if (msg?.usage) {
          const usage = msg.usage as Record<string, unknown>;
          const inputTokens = (usage.input_tokens as number) || 0;
          const outputTokens = (usage.output_tokens as number) || 0;
          // Approximate cost (Claude Sonnet pricing as rough estimate)
          costUsd += (inputTokens * 3 + outputTokens * 15) / 1_000_000;
        }
      }
    }

    // Extract latest action from the tail
    const lines = tailBuf.split("\n").filter((l) => l.trim());
    const meta = { firstPrompt, cwd, model, costUsd: costUsd || undefined, messageCount, toolUseCount };

    // Walk backwards to find the last meaningful event
    for (let i = lines.length - 1; i >= 0; i--) {
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(lines[i]);
      } catch {
        continue;
      }

      const eventType = event.type as string;

      // Skip noise
      if (["progress", "queue-operation", "file-history-snapshot"].includes(eventType)) {
        continue;
      }

      // System events
      if (eventType === "system") {
        const sub = event.subtype as string | undefined;
        if (sub === "turn_duration") {
          const ms = event.durationMs as number;
          const secs = Math.round(ms / 1000);
          return { action: "Turn completed", detail: `${secs}s`, ...meta };
        }
        return { action: `System: ${sub ?? "event"}`, detail: "", ...meta };
      }

      // Assistant message with tool use or text
      if (eventType === "assistant") {
        const msg = event.message as Record<string, unknown> | undefined;
        if (!msg) continue;
        const content = msg.content;

        if (Array.isArray(content)) {
          // Find the last tool_use or text block
          for (let j = content.length - 1; j >= 0; j--) {
            const block = content[j] as Record<string, unknown>;
            if (block.type === "tool_use") {
              const name = block.name as string;
              const input = block.input as Record<string, unknown> | undefined;
              return {
                action: `Using ${name}`,
                detail: summarizeToolInput(name, input),
                ...meta,
              };
            }
            if (block.type === "text" && block.text) {
              const text = (block.text as string).trim();
              if (text) {
                return {
                  action: "Responding",
                  detail: text.slice(0, 120),
                  ...meta,
                };
              }
            }
          }
        }

        if (typeof content === "string" && content.trim()) {
          return { action: "Responding", detail: content.trim().slice(0, 120), ...meta };
        }
        continue;
      }

      // User message
      if (eventType === "user") {
        const msg = event.message as Record<string, unknown> | undefined;
        if (!msg) continue;
        const content = msg.content;

        // Check if it's a tool result
        if (Array.isArray(content)) {
          for (const block of content) {
            const b = block as Record<string, unknown>;
            if (b.type === "tool_result") {
              return { action: "Tool result received", detail: "", ...meta };
            }
          }
        }

        const text =
          typeof content === "string"
            ? content
            : Array.isArray(content)
              ? (content.find((b: Record<string, unknown>) => b.type === "text") as Record<string, unknown> | undefined)?.text as string ?? ""
              : "";

        if (text.trim()) {
          return { action: "User message", detail: text.trim().slice(0, 120), ...meta };
        }
      }
    }
  } catch {
    // File read error - not critical
  }

  return { action: "Activity detected", detail: "", firstPrompt: "", cwd: "", model: "", messageCount: 0, toolUseCount: 0 };
}

function summarizeToolInput(
  name: string,
  input?: Record<string, unknown>
): string {
  if (!input) return "";
  switch (name) {
    case "Read":
      return shortPath(String(input.file_path ?? ""));
    case "Write":
      return shortPath(String(input.file_path ?? ""));
    case "Edit":
      return shortPath(String(input.file_path ?? ""));
    case "Bash":
      return String(input.command ?? "").slice(0, 100);
    case "Glob":
      return String(input.pattern ?? "");
    case "Grep":
      return `/${String(input.pattern ?? "")}/` + (input.path ? ` in ${shortPath(String(input.path))}` : "");
    case "Agent":
    case "Task":
      return String(input.description ?? input.prompt ?? "").slice(0, 100);
    case "WebSearch":
      return String(input.query ?? "");
    case "WebFetch":
      return String(input.url ?? "").slice(0, 80);
    default:
      return "";
  }
}

function shortPath(p: string): string {
  const parts = p.split("/");
  if (parts.length <= 3) return p;
  return ".../" + parts.slice(-2).join("/");
}

export function startWatcher(broadcast: BroadcastFn): void {
  const dir = getProjectsDir();

  watcher = watch(dir, { recursive: true }, (_eventType, filename) => {
    if (!filename || !filename.endsWith(".jsonl")) return;
    if (filename.includes("subagents")) return;

    const debounceKey = filename;
    const existing = debounceTimers.get(debounceKey);
    if (existing) clearTimeout(existing);

    debounceTimers.set(
      debounceKey,
      setTimeout(async () => {
        debounceTimers.delete(debounceKey);

        const parts = filename.split("/");
        const sessionFile = parts[parts.length - 1];
        const projectDir = parts.slice(0, -1).join("/");

        const sessionId = sessionFile.replace(".jsonl", "");
        const projectId = projectDir;
        const filePath = join(dir, filename);

        invalidateSession(sessionId);

        const extracted = await extractLatestAction(filePath);

        broadcast({
          type: "session:updated",
          projectId,
          projectName: humanizeName(projectId),
          sessionId,
          timestamp: new Date().toISOString(),
          ...extracted,
        });
      }, 500)
    );
  });

  console.log(`[watcher] Watching ${dir} for changes`);
}

export function stopWatcher(): void {
  watcher?.close();
  watcher = null;
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
}
