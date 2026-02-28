import { useState } from "react";

interface ToolBreakdownProps {
  tools: Record<string, number>;
}

const DEFAULT_LIMIT = 10;

const TOOL_COLORS: Record<string, string> = {
  Read: "#60a5fa",
  Bash: "#f97316",
  Edit: "#a78bfa",
  Write: "#34d399",
  Glob: "#fbbf24",
  Grep: "#fb923c",
  Agent: "#f472b6",
  Task: "#22d3ee",
  WebFetch: "#818cf8",
  WebSearch: "#2dd4bf",
};

export function ToolBreakdown({ tools }: ToolBreakdownProps) {
  const [expanded, setExpanded] = useState(false);
  const sorted = Object.entries(tools).sort(([, a], [, b]) => b - a);
  const max = sorted[0]?.[1] ?? 1;
  const hasMore = sorted.length > DEFAULT_LIMIT;
  const visible = expanded ? sorted : sorted.slice(0, DEFAULT_LIMIT);

  return (
    <div className="p-4 bg-surface-secondary border border-border rounded-lg">
      <h3 className="text-xs font-medium text-text-muted mb-3">Tool Usage</h3>
      <div className="space-y-2">
        {visible.map(([name, count]) => (
          <div key={name} className="flex items-center gap-2">
            <span className="text-xs text-text-secondary w-20 truncate shrink-0">{name}</span>
            <div className="flex-1 h-4 bg-surface-tertiary rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${(count / max) * 100}%`,
                  backgroundColor: TOOL_COLORS[name] ?? "#6b7280",
                }}
              />
            </div>
            <span className="text-xs text-text-muted w-12 text-right shrink-0">{count}</span>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-accent hover:text-accent-hover transition-colors"
        >
          {expanded ? "Show less" : `Show all (${sorted.length})`}
        </button>
      )}
    </div>
  );
}
