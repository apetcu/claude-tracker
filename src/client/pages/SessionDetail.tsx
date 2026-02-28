import { useParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { MessageList } from "../components/conversation/MessageList";
import { StatCard } from "../components/metrics/StatCard";
import { ToolBreakdown } from "../components/metrics/ToolBreakdown";
import { FileContributions } from "../components/metrics/FileContributions";
import { formatNumber, formatDuration } from "../lib/format";

interface SessionData {
  id: string;
  projectId: string;
  projectName: string;
  startedAt: string;
  messages: ConversationMessage[];
  metrics: SessionMetrics;
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

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session, loading } = useApi<SessionData>(`/api/sessions/${id}`);

  if (loading) return <div className="text-text-muted text-sm">Loading session...</div>;
  if (!session) return <div className="text-text-muted text-sm">Session not found</div>;

  const m = session.metrics;

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1 min-w-0 overflow-auto">
        <MessageList messages={session.messages} />
      </div>

      <div className="w-72 shrink-0 space-y-4 overflow-auto">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Messages" value={m.messageCount} small />
          <StatCard label="User" value={m.userMessages} small />
          <StatCard label="Assistant" value={m.assistantMessages} small />
          {m.durationMs > 0 && (
            <StatCard label="Duration" value={formatDuration(m.durationMs)} small />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Input Tokens" value={formatNumber(m.totalTokens.input)} small />
          <StatCard label="Output Tokens" value={formatNumber(m.totalTokens.output)} small />
          <StatCard label="Cache Read" value={formatNumber(m.totalTokens.cacheRead)} small />
          <StatCard label="Lines +" value={formatNumber(m.linesAdded)} small />
        </div>

        {m.toolUsage && Object.keys(m.toolUsage).length > 0 && (
          <ToolBreakdown tools={m.toolUsage} />
        )}

        {m.fileContributions && Object.keys(m.fileContributions).length > 0 && (
          <FileContributions files={m.fileContributions} />
        )}
      </div>
    </div>
  );
}
