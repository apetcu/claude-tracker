import { useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { MessageList } from "../components/conversation/MessageList";
import { ToolBreakdown } from "../components/metrics/ToolBreakdown";
import { FileContributions } from "../components/metrics/FileContributions";
import { formatNumber, formatDuration, formatDate, formatRelative } from "../lib/format";
import { PromptText } from "../components/PromptText";
import { useState } from "react";

interface SessionData {
  id: string;
  projectId: string;
  projectName: string;
  startedAt: string;
  messages: ConversationMessage[];
  metrics: SessionMetrics;
  source?: "claude" | "cursor";
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
  timestamp: string;
  uuid: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string | { type: string; text: string }[];
}

interface SessionMetrics {
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  toolUsage: Record<string, number>;
  totalTokens: { input: number; output: number; cacheRead: number; cacheCreation: number };
  durationMs: number;
  linesAdded: number;
  linesRemoved: number;
  fileContributions: Record<string, { added: number; removed: number }>;
}

function firstPromptText(messages: ConversationMessage[]): string {
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    if (typeof msg.content === "string") return msg.content;
    for (const b of msg.content) {
      if (b.type === "text" && b.text?.trim()) return b.text;
    }
  }
  return "";
}

function MetricPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const display = typeof value === "number" ? formatNumber(value) : value;
  return (
    <div className="flex flex-col items-center px-3 py-2">
      <span className={`text-base font-semibold ${color ?? "text-text-primary"}`}>{display}</span>
      <span className="text-[11px] text-text-muted">{label}</span>
    </div>
  );
}

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session, loading } = useApi<SessionData>(`/api/sessions/${id}`);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted text-sm">Loading session...</div>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted text-sm">Session not found</div>
      </div>
    );
  }

  const m = session.metrics;
  const prompt = firstPromptText(session.messages);
  const totalTokens = m.totalTokens.input + m.totalTokens.output;
  const totalTools = Object.values(m.toolUsage).reduce((a, b) => a + b, 0);
  const hasFileContribs = m.fileContributions && Object.keys(m.fileContributions).length > 0;
  const hasToolUsage = m.toolUsage && Object.keys(m.toolUsage).length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-surface-secondary">
        {/* Breadcrumb + actions */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <Link
            to={`/projects/${session.projectId}`}
            className="text-xs text-text-muted hover:text-accent transition-colors"
          >
            {session.projectName}
          </Link>
          <span className="text-xs text-text-muted">/</span>
          <span className="text-xs text-text-muted font-mono">{session.id.slice(0, 8)}</span>
          {session.source === "cursor" && (
            <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-teal-500/15 text-teal-400 uppercase tracking-wider">
              Cursor
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-text-muted">
              {formatDate(session.startedAt)} &middot; {formatRelative(session.startedAt)}
            </span>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-tertiary transition-colors"
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                {sidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12H12m-8.25 5.25h16.5" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Prompt preview */}
        {prompt && (
          <div className="px-4 pb-2 text-sm text-text-secondary">
            <PromptText text={prompt} maxLength={200} />
          </div>
        )}

        {/* Quick stats bar */}
        <div className="flex items-center gap-0 px-2 pb-2 overflow-x-auto">
          <MetricPill label="Messages" value={m.messageCount} />
          <div className="w-px h-6 bg-border shrink-0" />
          <MetricPill label="Tools" value={totalTools} />
          {m.durationMs > 0 && (
            <>
              <div className="w-px h-6 bg-border shrink-0" />
              <MetricPill label="Duration" value={formatDuration(m.durationMs)} />
            </>
          )}
          <div className="w-px h-6 bg-border shrink-0" />
          <MetricPill label="Tokens" value={formatNumber(totalTokens)} />
          {m.totalTokens.cacheRead > 0 && (
            <>
              <div className="w-px h-6 bg-border shrink-0" />
              <MetricPill label="Cache Read" value={formatNumber(m.totalTokens.cacheRead)} />
            </>
          )}
          {(m.linesAdded > 0 || m.linesRemoved > 0) && (
            <>
              <div className="w-px h-6 bg-border shrink-0" />
              <MetricPill label="Lines" value={`+${formatNumber(m.linesAdded)} / -${formatNumber(m.linesRemoved)}`} color={m.linesAdded > m.linesRemoved ? "text-success" : "text-danger"} />
            </>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Conversation */}
        <div className="flex-1 min-w-0 overflow-auto p-4">
          <MessageList messages={session.messages} />
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-72 shrink-0 border-l border-border overflow-auto bg-surface-secondary/50">
            <div className="p-4 space-y-4">
              {/* Session info */}
              <div>
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Session Info
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">ID</span>
                    <span className="text-text-secondary font-mono">{session.id.slice(0, 12)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Started</span>
                    <span className="text-text-secondary">{formatDate(session.startedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">User msgs</span>
                    <span className="text-text-secondary">{m.userMessages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Assistant msgs</span>
                    <span className="text-text-secondary">{m.assistantMessages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Input tokens</span>
                    <span className="text-text-secondary">{formatNumber(m.totalTokens.input)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Output tokens</span>
                    <span className="text-text-secondary">{formatNumber(m.totalTokens.output)}</span>
                  </div>
                  {m.totalTokens.cacheRead > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Cache read</span>
                      <span className="text-text-secondary">{formatNumber(m.totalTokens.cacheRead)}</span>
                    </div>
                  )}
                  {m.totalTokens.cacheCreation > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Cache created</span>
                      <span className="text-text-secondary">{formatNumber(m.totalTokens.cacheCreation)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tool usage */}
              {hasToolUsage && (
                <div>
                  <ToolBreakdown tools={m.toolUsage} />
                </div>
              )}

              {/* File contributions */}
              {hasFileContribs && (
                <div>
                  <FileContributions files={m.fileContributions} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
