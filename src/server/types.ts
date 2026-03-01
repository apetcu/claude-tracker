// --- Raw JSONL event types ---

export interface RawEvent {
  type: "user" | "assistant" | "system" | "progress" | "queue-operation";
  subtype?: string;
  parentUuid?: string;
  sessionId: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  teamName?: string;
  agentName?: string;
  slug?: string;
  uuid?: string;
  timestamp?: string;

  // user/assistant events
  message?: RawMessage;

  // system events
  durationMs?: number;
}

export interface RawMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
  model?: string;
  id?: string;
  usage?: TokenUsage;
  stop_reason?: string | null;
}

export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result" | "image";
  text?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  content?: string | { type: string; text: string }[];
  tool_use_id?: string;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
}

// --- Data source ---

export type DataSource = "claude" | "cursor";

// --- Processed types ---

export interface Project {
  id: string; // dir name under ~/.claude/projects/
  name: string; // human-readable
  path: string; // cwd from first event
  sessionCount: number;
  lastActive: string;
  messageCount: number;
  source?: DataSource;
}

export interface SessionSummary {
  id: string;
  projectId: string;
  firstPrompt: string;
  startedAt: string;
  messageCount: number;
  toolUseCount: number;
  durationMs: number;
  source?: DataSource;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
  timestamp: string;
  uuid: string;
  usage?: TokenUsage;
}

export interface SessionDetail {
  id: string;
  projectId: string;
  projectName: string;
  startedAt: string;
  messages: ConversationMessage[];
  metrics: SessionMetrics;
  source?: DataSource;
}

export interface FileContribution {
  added: number;
  removed: number;
}

export interface SessionMetrics {
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  toolUsage: Record<string, number>;
  totalTokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
  };
  durationMs: number;
  linesAdded: number;
  linesRemoved: number;
  fileContributions: Record<string, FileContribution>;
  humanLines: number;
  humanWords: number;
  humanChars: number;
}

export interface GlobalMetrics {
  totalProjects: number;
  totalSessions: number;
  totalMessages: number;
  totalTokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
  };
  toolUsage: Record<string, number>;
  timeline: { date: string; sessions: number; messages: number; claudeSessions: number; claudeMessages: number; cursorSessions: number; cursorMessages: number; tokenInput: number; tokenOutput: number }[];
  totalLinesAdded: number;
  totalLinesRemoved: number;
}

export interface SourceLines {
  added: number;
  removed: number;
}

export interface ProjectMetrics {
  totalSessions: number;
  totalMessages: number;
  totalTokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
  };
  toolUsage: Record<string, number>;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  linesBySource: Record<string, SourceLines>;
  fileContributions: Record<string, FileContribution>;
  timeline: { date: string; sessions: number; messages: number; claudeSessions: number; claudeMessages: number; cursorSessions: number; cursorMessages: number; tokenInput: number; tokenOutput: number }[];
  humanLines: number;
  humanWords: number;
  humanChars: number;
}
