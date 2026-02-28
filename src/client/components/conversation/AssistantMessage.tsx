import Markdown from "react-markdown";
import { ToolUseBlock } from "./ToolUseBlock";
import { formatNumber } from "../../lib/format";

interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string | { type: string; text: string }[];
  id?: string;
}

interface AssistantMessageProps {
  message: {
    content: string | ContentBlock[];
    timestamp: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const blocks = typeof message.content === "string"
    ? [{ type: "text" as const, text: message.content }]
    : message.content;

  const totalTokens = message.usage
    ? message.usage.input_tokens + message.usage.output_tokens
    : 0;

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-surface-tertiary text-text-secondary flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
        C
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="text-[11px] text-text-muted flex items-center gap-2">
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
          {totalTokens > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-surface-tertiary text-text-muted">
              {formatNumber(totalTokens)} tokens
            </span>
          )}
        </div>
        {blocks.map((block, i) => {
          if (block.type === "text" && block.text?.trim()) {
            return (
              <div key={i} className="prose prose-invert prose-sm max-w-none text-text-primary">
                <Markdown>{block.text}</Markdown>
              </div>
            );
          }
          if (block.type === "tool_use") {
            return (
              <ToolUseBlock
                key={block.id ?? i}
                name={block.name ?? "Unknown"}
                input={block.input ?? {}}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
