import type {
  SessionMetrics,
  GlobalMetrics,
  ProjectMetrics,
  FileContribution,
} from "../types";
import type { ParsedSession } from "./parser";

export function computeSessionMetrics(session: ParsedSession): SessionMetrics {
  return {
    messageCount: session.messages.length,
    userMessages: session.messages.filter((m) => m.role === "user").length,
    assistantMessages: session.messages.filter((m) => m.role === "assistant").length,
    toolUsage: session.toolUsage,
    totalTokens: session.totalTokens,
    durationMs: session.durationMs,
    linesAdded: session.linesAdded,
    linesRemoved: session.linesRemoved,
    fileContributions: session.fileContributions,
    humanLines: session.humanLines,
    humanWords: session.humanWords,
    humanChars: session.humanChars,
  };
}

export function aggregateMetrics(sessions: ParsedSession[]): {
  tokens: GlobalMetrics["totalTokens"];
  toolUsage: Record<string, number>;
  totalMessages: number;
  linesAdded: number;
  linesRemoved: number;
  timeline: GlobalMetrics["timeline"];
  fileContributions: Record<string, FileContribution>;
  humanLines: number;
  humanWords: number;
  humanChars: number;
} {
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  const toolUsage: Record<string, number> = {};
  let totalMessages = 0;
  let linesAdded = 0;
  let linesRemoved = 0;
  let humanLines = 0;
  let humanWords = 0;
  let humanChars = 0;
  const fileContributions: Record<string, FileContribution> = {};

  const dayMap = new Map<string, { sessions: number; messages: number }>();

  for (const s of sessions) {
    tokens.input += s.totalTokens.input;
    tokens.output += s.totalTokens.output;
    tokens.cacheRead += s.totalTokens.cacheRead;
    tokens.cacheCreation += s.totalTokens.cacheCreation;

    for (const [tool, count] of Object.entries(s.toolUsage)) {
      toolUsage[tool] = (toolUsage[tool] ?? 0) + count;
    }

    totalMessages += s.messages.length;
    linesAdded += s.linesAdded;
    linesRemoved += s.linesRemoved;
    humanLines += s.humanLines;
    humanWords += s.humanWords;
    humanChars += s.humanChars;

    for (const [filePath, fc] of Object.entries(s.fileContributions)) {
      const existing = fileContributions[filePath] ??= { added: 0, removed: 0 };
      existing.added += fc.added;
      existing.removed += fc.removed;
    }

    if (s.startedAt) {
      const day = s.startedAt.split("T")[0];
      const existing = dayMap.get(day) ?? { sessions: 0, messages: 0 };
      existing.sessions += 1;
      existing.messages += s.messages.length;
      dayMap.set(day, existing);
    }
  }

  const timeline = Array.from(dayMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { tokens, toolUsage, totalMessages, linesAdded, linesRemoved, timeline, fileContributions, humanLines, humanWords, humanChars };
}

export function computeGlobalMetrics(
  projectCount: number,
  sessionCount: number,
  sessions: ParsedSession[]
): GlobalMetrics {
  const agg = aggregateMetrics(sessions);
  return {
    totalProjects: projectCount,
    totalSessions: sessionCount,
    totalMessages: agg.totalMessages,
    totalTokens: agg.tokens,
    toolUsage: agg.toolUsage,
    timeline: agg.timeline,
    totalLinesAdded: agg.linesAdded,
    totalLinesRemoved: agg.linesRemoved,
  };
}

export function computeProjectMetrics(sessions: ParsedSession[]): ProjectMetrics {
  const agg = aggregateMetrics(sessions);
  return {
    totalSessions: sessions.length,
    totalMessages: agg.totalMessages,
    totalTokens: agg.tokens,
    toolUsage: agg.toolUsage,
    totalLinesAdded: agg.linesAdded,
    totalLinesRemoved: agg.linesRemoved,
    fileContributions: agg.fileContributions,
    humanLines: agg.humanLines,
    humanWords: agg.humanWords,
    humanChars: agg.humanChars,
  };
}
