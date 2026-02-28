import Markdown from "react-markdown";
import { ToolUseBlock } from "./ToolUseBlock";

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

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-surface-tertiary text-text-secondary flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
        C
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="text-xs text-text-muted">
          {new Date(message.timestamp).toLocaleTimeString()}
          {message.usage && (
            <span className="ml-2">
              {message.usage.input_tokens + message.usage.output_tokens} tokens
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
