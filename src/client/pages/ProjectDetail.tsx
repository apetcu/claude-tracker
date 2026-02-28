import { useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { StatCard } from "../components/metrics/StatCard";
import { ToolBreakdown } from "../components/metrics/ToolBreakdown";
import { FileContributions } from "../components/metrics/FileContributions";
import { formatDate, formatRelative, formatDuration, formatNumber } from "../lib/format";
import { PromptText } from "../components/PromptText";

interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  sessionCount: number;
  lastActive: string;
  source?: "claude" | "cursor";
  sources?: ("claude" | "cursor")[];
}

interface Session {
  id: string;
  firstPrompt: string;
  startedAt: string;
  messageCount: number;
  toolUseCount: number;
  durationMs: number;
  source?: "claude" | "cursor";
}

interface SourceLines {
  added: number;
  removed: number;
}

interface ProjectMetrics {
  totalSessions: number;
  totalMessages: number;
  totalTokens: { input: number; output: number; cacheRead: number; cacheCreation: number };
  toolUsage: Record<string, number>;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  linesBySource: Record<string, SourceLines>;
  fileContributions: Record<string, { added: number; removed: number }>;
  humanLines?: number;
  humanWords?: number;
  humanChars?: number;
}

const SOURCE_COLORS: Record<string, { bar: string; bg: string; text: string; label: string }> = {
  claude: { bar: "bg-purple-500", bg: "bg-purple-500/15", text: "text-purple-400", label: "Claude" },
  cursor: { bar: "bg-teal-500", bg: "bg-teal-500/15", text: "text-teal-400", label: "Cursor" },
};

function StackedBar({ segments, total }: { segments: { value: number; color: string; label: string }[]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex h-3 rounded-full overflow-hidden bg-surface-tertiary">
      {segments.map((seg) => {
        const pct = (seg.value / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={seg.label}
            className={`h-full ${seg.color} transition-all`}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: ${formatNumber(seg.value)}`}
          />
        );
      })}
    </div>
  );
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useApi<ProjectInfo>(`/api/projects/${id}`);
  const { data: sessions, loading } = useApi<Session[]>(`/api/projects/${id}/sessions`);
  const { data: metrics } = useApi<ProjectMetrics>(`/api/metrics/project/${id}`);

  const netLines = (metrics?.totalLinesAdded ?? 0) - (metrics?.totalLinesRemoved ?? 0);
  const avgLinesPerSession = metrics && metrics.totalSessions > 0
    ? Math.round(metrics.totalLinesAdded / metrics.totalSessions) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-text-primary">{project?.name ?? id}</h2>
          {project?.sources?.includes("claude") && project?.sources?.includes("cursor") && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 uppercase tracking-wider">
              Claude + Cursor
            </span>
          )}
          {project?.sources?.includes("cursor") && !project?.sources?.includes("claude") && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400 uppercase tracking-wider">
              Cursor
            </span>
          )}
        </div>
        {project?.path && (
          <p className="text-xs text-text-muted mt-1 font-mono">{project.path}</p>
        )}
      </div>

      {/* Top stats */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Sessions" value={metrics.totalSessions} />
          <StatCard label="Messages" value={metrics.totalMessages} />
          <StatCard
            label="Tokens"
            value={metrics.totalTokens.input + metrics.totalTokens.output}
            sub={`${formatNumber(metrics.totalTokens.cacheRead)} cached`}
          />
          <StatCard
            label="Lines Added"
            value={metrics.totalLinesAdded}
            sub={`-${formatNumber(metrics.totalLinesRemoved)} removed`}
          />
        </div>
      )}

      {/* Contribution breakdown */}
      {metrics && metrics.totalLinesAdded > 0 && (() => {
        const sources = Object.entries(metrics.linesBySource ?? {});
        const hasBothSources = sources.length > 1;
        const addedSegments = sources.map(([src, lines]) => ({
          value: lines.added,
          color: SOURCE_COLORS[src]?.bar ?? "bg-gray-500",
          label: SOURCE_COLORS[src]?.label ?? src,
        }));
        const removedSegments = sources.map(([src, lines]) => ({
          value: lines.removed,
          color: SOURCE_COLORS[src]?.bar ?? "bg-gray-500",
          label: SOURCE_COLORS[src]?.label ?? src,
        }));

        return (
          <div className="p-4 bg-surface-secondary border border-border rounded-lg space-y-4">
            <h3 className="text-sm font-medium text-text-secondary">Contributions</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AI contributions */}
              <div className="p-4 bg-surface-tertiary rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">AI</div>
                  <span className="text-sm font-medium text-text-primary">AI Contributions</span>
                  <span className="text-[11px] text-text-muted ml-auto">via Write / Edit tools</span>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-lg font-semibold text-success">+{formatNumber(metrics.totalLinesAdded)}</div>
                    <div className="text-[11px] text-text-muted">added</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-danger">-{formatNumber(metrics.totalLinesRemoved)}</div>
                    <div className="text-[11px] text-text-muted">removed</div>
                  </div>
                  <div>
                    <div className={`text-lg font-semibold ${netLines >= 0 ? "text-success" : "text-danger"}`}>
                      {netLines >= 0 ? "+" : ""}{formatNumber(netLines)}
                    </div>
                    <div className="text-[11px] text-text-muted">net</div>
                  </div>
                </div>

                {/* Stacked bars */}
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-text-muted">Lines added</span>
                      <span className="text-[11px] text-text-muted font-mono">{formatNumber(metrics.totalLinesAdded)}</span>
                    </div>
                    <StackedBar segments={addedSegments} total={metrics.totalLinesAdded} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-text-muted">Lines removed</span>
                      <span className="text-[11px] text-text-muted font-mono">{formatNumber(metrics.totalLinesRemoved)}</span>
                    </div>
                    <StackedBar segments={removedSegments} total={metrics.totalLinesRemoved} />
                  </div>
                </div>

                {/* Legend (only if both sources) */}
                {sources.length > 0 && (
                  <div className="flex items-center gap-4 pt-1">
                    {sources.map(([src, lines]) => {
                      const cfg = SOURCE_COLORS[src];
                      if (!cfg) return null;
                      const pct = metrics.totalLinesAdded > 0 ? Math.round((lines.added / metrics.totalLinesAdded) * 100) : 0;
                      return (
                        <div key={src} className="flex items-center gap-1.5">
                          <div className={`w-2.5 h-2.5 rounded-sm ${cfg.bar}`} />
                          <span className={`text-[11px] ${cfg.text}`}>{cfg.label}</span>
                          <span className="text-[11px] text-text-muted font-mono">
                            +{formatNumber(lines.added)} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Human */}
              <div className="p-4 bg-surface-tertiary rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">H</div>
                  <span className="text-sm font-medium text-text-primary">Human</span>
                  <span className="text-[11px] text-text-muted ml-auto">instructions &amp; prompts</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-lg font-semibold text-text-primary">{formatNumber(metrics.humanLines ?? 0)}</div>
                    <div className="text-[11px] text-text-muted">lines</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-text-primary">{formatNumber(metrics.humanWords ?? 0)}</div>
                    <div className="text-[11px] text-text-muted">words</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-text-primary">{formatNumber(metrics.humanChars ?? 0)}</div>
                    <div className="text-[11px] text-text-muted">chars</div>
                  </div>
                </div>
                {(metrics.humanLines ?? 0) > 0 && metrics.totalLinesAdded > 0 && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-text-muted">Leverage</span>
                      <span className="text-sm font-semibold text-accent">
                        {(metrics.totalLinesAdded / (metrics.humanLines ?? 1)).toFixed(1)}x
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Each line of instructions produced ~{(metrics.totalLinesAdded / (metrics.humanLines ?? 1)).toFixed(0)} lines of code
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Avg per session */}
            {avgLinesPerSession > 0 && (
              <div className="text-xs text-text-muted text-center pt-1">
                Average {formatNumber(avgLinesPerSession)} lines of code per session
              </div>
            )}
          </div>
        );
      })()}

      {/* Tool usage & file contributions */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {metrics.toolUsage && Object.keys(metrics.toolUsage).length > 0 && (
            <ToolBreakdown tools={metrics.toolUsage} />
          )}
          {metrics.fileContributions && Object.keys(metrics.fileContributions).length > 0 && (
            <FileContributions files={metrics.fileContributions} />
          )}
        </div>
      )}

      {/* Sessions list */}
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-3">
          Sessions ({sessions?.length ?? 0})
        </h3>
        {loading ? (
          <div className="text-text-muted text-sm">Loading...</div>
        ) : (
          <div className="space-y-1">
            {sessions
              ?.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
              .map((s) => (
                <Link
                  key={s.id}
                  to={`/sessions/${s.id}`}
                  className="flex items-center gap-4 p-3 bg-surface-secondary border border-border rounded-lg hover:border-border-hover transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">
                      <PromptText text={s.firstPrompt} maxLength={120} />
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-text-muted items-center">
                      {s.source === "cursor" && (
                        <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-teal-500/15 text-teal-400 uppercase tracking-wider">Cursor</span>
                      )}
                      <span>{formatDate(s.startedAt)}</span>
                      <span>{s.messageCount} msgs</span>
                      <span>{s.toolUseCount} tools</span>
                      {s.durationMs > 0 && <span>{formatDuration(s.durationMs)}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-text-muted shrink-0">
                    {formatRelative(s.startedAt)}
                  </span>
                </Link>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
