import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { StatCard } from "../components/metrics/StatCard";
import { ToolBreakdown } from "../components/metrics/ToolBreakdown";
import { ActivityTimeline } from "../components/metrics/ActivityTimeline";
import { TokenBurnChart } from "../components/metrics/TokenBurnChart";
import { formatRelative, formatNumber } from "../lib/format";

interface ProjectSummary {
  id: string;
  name: string;
  sessionCount: number;
  lastActive: string;
  messageCount: number;
}

interface GlobalMetrics {
  totalProjects: number;
  totalSessions: number;
  totalMessages: number;
  totalTokens: { input: number; output: number; cacheRead: number; cacheCreation: number };
  toolUsage: Record<string, number>;
  timeline: { date: string; sessions: number; messages: number; claudeSessions: number; claudeMessages: number; cursorSessions: number; cursorMessages: number; tokenInput: number; tokenOutput: number }[];
  totalLinesAdded: number;
  totalLinesRemoved: number;
}

export function Dashboard() {
  const { data: projects, loading: loadingProjects } = useApi<ProjectSummary[]>("/api/projects");
  const { data: metrics, loading: loadingMetrics } = useApi<GlobalMetrics>("/api/metrics/global");

  const totalTokens = metrics
    ? metrics.totalTokens.input + metrics.totalTokens.output
    : 0;

  return (
    <div className="space-y-8">
      {/* Overview */}
      <section>
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Projects" value={metrics?.totalProjects ?? 0} />
          <StatCard label="Sessions" value={metrics?.totalSessions ?? 0} />
          <StatCard label="Messages" value={metrics?.totalMessages ?? 0} />
          <StatCard
            label="Lines Written"
            value={metrics?.totalLinesAdded ?? 0}
            sub={metrics ? `${formatNumber(metrics.totalLinesRemoved)} removed` : undefined}
          />
        </div>
      </section>

      {/* Activity */}
      {metrics?.timeline && metrics.timeline.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Activity</h2>
          <ActivityTimeline data={metrics.timeline} />
        </section>
      )}

      {/* Token Usage */}
      {metrics && totalTokens > 0 && (
        <section>
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Token Usage</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Tokens"
                value={totalTokens}
                sub={`${formatNumber(metrics.totalTokens.cacheRead)} cached`}
              />
              <StatCard
                label="Input Tokens"
                value={metrics.totalTokens.input}
              />
              <StatCard
                label="Output Tokens"
                value={metrics.totalTokens.output}
              />
              <StatCard
                label="Cache Read"
                value={metrics.totalTokens.cacheRead}
                sub={metrics.totalTokens.input > 0
                  ? `${Math.round((metrics.totalTokens.cacheRead / metrics.totalTokens.input) * 100)}% of input`
                  : undefined}
              />
            </div>
            {metrics.timeline && metrics.timeline.length > 0 && (
              <TokenBurnChart data={metrics.timeline} />
            )}
          </div>
        </section>
      )}

      {/* Tools */}
      {metrics?.toolUsage && Object.keys(metrics.toolUsage).length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Tools</h2>
          <ToolBreakdown tools={metrics.toolUsage} />
        </section>
      )}

      {/* Projects */}
      <section>
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Projects</h2>
        {loadingProjects || loadingMetrics ? (
          <div className="text-text-muted text-sm">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {projects
              ?.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime())
              .map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="block p-4 bg-surface-secondary border border-border rounded-lg hover:border-border-hover transition-colors"
                >
                  <div className="font-medium text-sm text-text-primary truncate">{p.name}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                    <span>{p.sessionCount} sessions</span>
                    <span>{formatNumber(p.messageCount)} messages</span>
                    <span className="ml-auto">{formatRelative(p.lastActive)}</span>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
