import { useState } from "react";

interface ToolUseBlockProps {
  name: string;
  input: Record<string, unknown>;
}

const TOOL_COLORS: Record<string, string> = {
  Read: "text-blue-400",
  Bash: "text-orange-400",
  Edit: "text-purple-400",
  Write: "text-emerald-400",
  Glob: "text-yellow-400",
  Grep: "text-orange-300",
  Agent: "text-pink-400",
  Task: "text-cyan-400",
  WebFetch: "text-indigo-400",
  WebSearch: "text-teal-400",
};

function summarize(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "Read":
      return String(input.file_path ?? "");
    case "Write":
      return String(input.file_path ?? "");
    case "Edit":
      return String(input.file_path ?? "");
    case "Bash":
      return String(input.command ?? "").slice(0, 80);
    case "Glob":
      return String(input.pattern ?? "");
    case "Grep":
      return String(input.pattern ?? "");
    case "Agent":
    case "Task":
      return String(input.description ?? input.prompt ?? "").slice(0, 80);
    default:
      return "";
  }
}

export function ToolUseBlock({ name, input }: ToolUseBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = TOOL_COLORS[name] ?? "text-gray-400";
  const summary = summarize(name, input);

  return (
    <div className="border border-border rounded-md overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-surface-tertiary hover:bg-border/30 transition-colors text-left"
      >
        <span className={`font-mono font-medium ${colorClass}`}>{name}</span>
        {summary && (
          <span className="text-text-muted truncate font-mono">{summary}</span>
        )}
        <span className="ml-auto text-text-muted shrink-0">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <pre className="p-3 bg-surface text-text-secondary overflow-auto max-h-60 text-xs leading-relaxed">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}
