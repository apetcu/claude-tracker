import { useWebSocket } from "../hooks/useWebSocket";
import { formatRelative } from "../lib/format";
import { Link } from "react-router-dom";

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

function actionColor(action: string): string {
  return ACTION_COLORS[action] ?? "text-text-secondary";
}

export function ActivityFeed() {
  const { events, connected } = useWebSocket();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${connected ? "bg-success" : "bg-danger"}`}
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
        <div className="space-y-1.5">
          {events.map((event, i) => {
            if (event.type === "connected") return null;

            const action = (event.action as string) ?? "";
            const detail = (event.detail as string) ?? "";
            const projectName = (event.projectName as string) ?? event.projectId ?? "";

            return (
              <div
                key={`${event.timestamp}-${i}`}
                className="p-3 bg-surface-secondary border border-border rounded-lg text-sm"
              >
                <div className="flex items-center gap-3">
                  <Link
                    to={`/projects/${event.projectId}`}
                    className="text-xs font-medium text-text-primary hover:text-accent transition-colors truncate shrink-0 max-w-48"
                  >
                    {projectName}
                  </Link>

                  <span className={`text-xs font-mono font-medium shrink-0 ${actionColor(action)}`}>
                    {action}
                  </span>

                  {event.timestamp && (
                    <span className="text-text-muted text-[11px] ml-auto shrink-0">
                      {formatRelative(event.timestamp as string)}
                    </span>
                  )}
                </div>

                {detail && (
                  <div className="mt-1 text-xs text-text-muted font-mono truncate" title={detail}>
                    {detail}
                  </div>
                )}

                <div className="mt-1">
                  <Link
                    to={`/sessions/${event.sessionId}`}
                    className="text-[11px] text-text-muted hover:text-accent transition-colors font-mono"
                  >
                    {(event.sessionId as string)?.slice(0, 8)}...
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
