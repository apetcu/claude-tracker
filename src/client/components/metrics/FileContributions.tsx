import { useState } from "react";
import { formatNumber } from "../../lib/format";

interface FileContribution {
  added: number;
  removed: number;
}

interface FileContributionsProps {
  files: Record<string, FileContribution>;
}

type SortKey = "added" | "removed" | "net" | "name";

function fileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

function dirPath(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

export function FileContributions({ files }: FileContributionsProps) {
  const [sortBy, setSortBy] = useState<SortKey>("added");
  const [expanded, setExpanded] = useState(true);

  const entries = Object.entries(files);
  if (entries.length === 0) return null;

  const sorted = entries.sort(([aPath, a], [bPath, b]) => {
    switch (sortBy) {
      case "added":
        return b.added - a.added;
      case "removed":
        return b.removed - a.removed;
      case "net":
        return (b.added - b.removed) - (a.added - a.removed);
      case "name":
        return aPath.localeCompare(bPath);
    }
  });

  const maxAdded = Math.max(...entries.map(([, f]) => f.added), 1);

  return (
    <div className="p-4 bg-surface-secondary border border-border rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-text-muted hover:text-text-secondary flex items-center gap-1"
        >
          <span>{expanded ? "▾" : "▸"}</span>
          Files Changed ({entries.length})
        </button>
        {expanded && (
          <div className="flex gap-1">
            {(["added", "removed", "net", "name"] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  sortBy === key
                    ? "bg-accent/20 text-accent"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {key === "added" ? "+lines" : key === "removed" ? "-lines" : key}
              </button>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="space-y-1 max-h-96 overflow-auto">
          {sorted.map(([path, fc]) => {
            const net = fc.added - fc.removed;
            return (
              <div key={path} className="group flex items-center gap-2 py-1 text-xs">
                <div className="flex-1 min-w-0 flex items-baseline gap-1">
                  <span className="text-text-primary font-mono truncate" title={path}>
                    {fileName(path)}
                  </span>
                  <span className="text-text-muted font-mono text-[10px] truncate hidden group-hover:inline" title={path}>
                    {dirPath(path)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono">
                  <span className="text-success w-14 text-right">+{formatNumber(fc.added)}</span>
                  <span className="text-danger w-14 text-right">-{formatNumber(fc.removed)}</span>
                  <div className="w-20 h-3 bg-surface-tertiary rounded overflow-hidden flex">
                    <div
                      className="h-full bg-success/70"
                      style={{ width: `${(fc.added / maxAdded) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
