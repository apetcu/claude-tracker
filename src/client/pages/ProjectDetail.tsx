import { useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { StatCard } from "../components/metrics/StatCard";
import { ToolBreakdown } from "../components/metrics/ToolBreakdown";
import { FileContributions } from "../components/metrics/FileContributions";
import { formatDate, formatRelative, formatDuration, truncate, formatNumber } from "../lib/format";

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
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useApi<ProjectInfo>(`/api/projects/${id}`);
  const { data: sessions, loading } = useApi<Session[]>(`/api/projects/${id}/sessions`);
  const { data: metrics } = useApi<ProjectMetrics>(`/api/metrics/project/${id}`);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{project?.name ?? id}</h2>
        {project?.path && (
          <p className="text-xs text-text-muted mt-1 font-mono">{project.path}</p>
        )}
      </div>

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Sessions" value={metrics.totalSessions} />
          <StatCard label="Messages" value={metrics.totalMessages} />
          <StatCard label="Lines Added" value={metrics.totalLinesAdded} />
          <StatCard
            label="Tokens"
            value={metrics.totalTokens.input + metrics.totalTokens.output}
            sub={`${formatNumber(metrics.totalTokens.cacheRead)} cached`}
          />
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {metrics.toolUsage && <ToolBreakdown tools={metrics.toolUsage} />}
          {metrics.fileContributions && <FileContributions files={metrics.fileContributions} />}
        </div>
      )}

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
                      {truncate(s.firstPrompt || "No prompt", 120)}
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
