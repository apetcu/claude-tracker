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
}

interface Session {
  id: string;
  firstPrompt: string;
  startedAt: string;
  messageCount: number;
  toolUseCount: number;
  durationMs: number;
}

interface ProjectMetrics {
  totalSessions: number;
  totalMessages: number;
  totalTokens: { input: number; output: number; cacheRead: number; cacheCreation: number };
  toolUsage: Record<string, number>;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  fileContributions: Record<string, { added: number; removed: number }>;
  humanLines?: number;
  humanWords?: number;
  humanChars?: number;
}

function ContributionBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-muted w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-text-secondary font-mono w-16 text-right">{formatNumber(value)}</span>
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
        <h2 className="text-lg font-semibold text-text-primary">{project?.name ?? id}</h2>
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
      {metrics && metrics.totalLinesAdded > 0 && (
        <div className="p-4 bg-surface-secondary border border-border rounded-lg space-y-4">
          <h3 className="text-sm font-medium text-text-secondary">Contributions</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Claude */}
            <div className="p-4 bg-surface-tertiary rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">C</div>
                <span className="text-sm font-medium text-text-primary">Claude</span>
                <span className="text-[11px] text-text-muted ml-auto">via Write / Edit tools</span>
              </div>
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
              <ContributionBar label="Added" value={metrics.totalLinesAdded} total={metrics.totalLinesAdded} color="bg-success" />
              <ContributionBar label="Removed" value={metrics.totalLinesRemoved} total={metrics.totalLinesAdded} color="bg-danger" />
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
      )}

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
                    <div className="flex gap-3 mt-1 text-xs text-text-muted">
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
