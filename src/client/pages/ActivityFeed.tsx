import { useWebSocket } from "../hooks/useWebSocket";
import { formatRelative } from "../lib/format";
import { Link } from "react-router-dom";
import { PromptText } from "../components/PromptText";

const ACTION_COLORS: Record<string, string> = {
  "Using Read": "text-blue-400",
  "Using Bash": "text-orange-400",
  "Using Edit": "text-purple-400",
  "Using Write": "text-emerald-400",
  "Using Glob": "text-yellow-400",
  "Using Grep": "text-orange-300",
  "Using Agent": "text-pink-400",
  "Using WebSearch": "text-teal-400",
  "Using WebFetch": "text-indigo-400",
  Responding: "text-text-secondary",
  "User message": "text-accent",
  "Turn completed": "text-success",
  "Tool result received": "text-text-muted",
};

const ACTION_ICONS: Record<string, string> = {
  "Using Read": "eye",
  "Using Bash": "terminal",
  "Using Edit": "pencil",
  "Using Write": "document-plus",
  "Using Glob": "magnifying-glass",
  "Using Grep": "magnifying-glass",
  "Using Agent": "cpu-chip",
  "Using WebSearch": "globe-alt",
  "Using WebFetch": "globe-alt",
  Responding: "chat-bubble-left",
  "User message": "user",
  "Turn completed": "check-circle",
  "Tool result received": "arrow-down-tray",
};

function actionColor(action: string): string {
  return ACTION_COLORS[action] ?? "text-text-secondary";
}

function ActionIcon({ action }: { action: string }) {
  const icon = ACTION_ICONS[action];
  // Simple SVG icons for key actions
  switch (icon) {
    case "terminal":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      );
    case "eye":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      );
    case "pencil":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
        </svg>
      );
    case "cpu-chip":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      );
    case "check-circle":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      );
    case "user":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
        </svg>
      );
    case "chat-bubble-left":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
      );
    default:
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      );
  }
}

function shortModel(model: string): string {
  if (!model) return "";
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  // Return last segment if it's a model ID like "claude-sonnet-4-..."
  return model.split("-").slice(0, 3).join("-");
}

export function ActivityFeed() {
  const { events, connected } = useWebSocket();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${connected ? "bg-success animate-pulse" : "bg-danger"}`}
        />
        <span className="text-xs text-text-muted">
          {connected ? "Connected - watching for changes" : "Disconnected"}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-text-muted text-sm">
          Waiting for activity... Open or continue a Claude Code session to see events here.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event, i) => {
            if (event.type === "connected") return null;

            const action = (event.action as string) ?? "";
            const detail = (event.detail as string) ?? "";
            const projectName = (event.projectName as string) ?? event.projectId ?? "";
            const firstPrompt = (event.firstPrompt as string) ?? "";
            const source = (event.source as string) ?? "";
            const model = shortModel((event.model as string) ?? "");
            const messageCount = (event.messageCount as number) ?? 0;
            const toolUseCount = (event.toolUseCount as number) ?? 0;
            const cwd = (event.cwd as string) ?? "";
            const shortCwd = cwd ? cwd.split("/").slice(-2).join("/") : "";

            return (
              <div
                key={`${event.timestamp}-${i}`}
                className="p-3 bg-surface-secondary border border-border rounded-lg text-sm hover:border-border-hover transition-colors"
              >
                {/* Row 1: Project name + action badge + timestamp */}
                <div className="flex items-center gap-2">
                  <Link
                    to={`/projects/${event.projectId}`}
                    className="text-xs font-semibold text-text-primary hover:text-accent transition-colors truncate shrink-0 max-w-48"
                  >
                    {projectName}
                  </Link>

                  {source === "cursor" && (
                    <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-teal-500/15 text-teal-400 shrink-0 uppercase tracking-wider">
                      Cursor
                    </span>
                  )}

                  <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium px-1.5 py-0.5 rounded bg-surface-primary shrink-0 ${actionColor(action)}`}>
                    <ActionIcon action={action} />
                    {action}
                  </span>

                  {model && (
                    <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface-primary shrink-0">
                      {model}
                    </span>
                  )}

                  {event.timestamp && (
                    <span className="text-text-muted text-[11px] ml-auto shrink-0">
                      {formatRelative(event.timestamp as string)}
                    </span>
                  )}
                </div>

                {/* Row 2: First prompt (what the session is about) */}
                {firstPrompt && (
                  <div className="mt-1.5 text-xs text-text-secondary truncate">
                    <PromptText text={firstPrompt} maxLength={150} />
                  </div>
                )}

                {/* Row 3: Detail (tool input, response text, etc.) */}
                {detail && (
                  <div className="mt-1 text-[11px] text-text-muted font-mono truncate bg-surface-primary rounded px-2 py-1" title={detail}>
                    {detail}
                  </div>
                )}

                {/* Row 4: Metadata chips */}
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <Link
                    to={`/sessions/${event.sessionId}`}
                    className="text-[11px] text-text-muted hover:text-accent transition-colors font-mono"
                  >
                    {(event.sessionId as string)?.slice(0, 8)}
                  </Link>

                  {messageCount > 0 && (
                    <span className="text-[11px] text-text-muted">
                      {messageCount} msgs
                    </span>
                  )}

                  {toolUseCount > 0 && (
                    <span className="text-[11px] text-text-muted">
                      {toolUseCount} tools
                    </span>
                  )}

                  {shortCwd && (
                    <span className="text-[11px] text-text-muted font-mono truncate max-w-60" title={cwd}>
                      {shortCwd}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
