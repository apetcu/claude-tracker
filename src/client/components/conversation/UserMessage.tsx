import Markdown from "react-markdown";
import { PromptText } from "../PromptText";

interface ContentBlock {
  type: string;
  text?: string;
  content?: string | { type: string; text: string }[];
  tool_use_id?: string;
}

interface UserMessageProps {
  message: {
    content: string | ContentBlock[];
    timestamp: string;
  };
}

function extractParts(content: string | ContentBlock[]): { text: string; toolResults: string[] } {
  if (typeof content === "string") return { text: content, toolResults: [] };
  const toolResults: string[] = [];
  const texts: string[] = [];

  for (const b of content) {
    if (b.type === "text" && b.text) {
      texts.push(b.text);
    } else if (b.type === "tool_result") {
      if (typeof b.content === "string") {
        toolResults.push(b.content.slice(0, 200));
      } else if (Array.isArray(b.content)) {
        for (const c of b.content) {
          if (c.type === "text") toolResults.push(c.text?.slice(0, 200) ?? "");
        }
      }
    }
  }

  return { text: texts.join("\n"), toolResults };
}

/** Check if text has XML-like tags that PromptText should handle */
function hasXmlTags(text: string): boolean {
  return /<(teammate-message|command-message|command-name)\b/.test(text);
}

export function UserMessage({ message }: UserMessageProps) {
  const { text, toolResults } = extractParts(message.content);

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
        U
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-text-muted mb-1.5">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
        {text && (
          hasXmlTags(text) ? (
            <div className="text-sm text-text-primary">
              <PromptText text={text} maxLength={5000} />
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none text-text-primary">
              <Markdown>{text.slice(0, 5000)}</Markdown>
            </div>
          )
        )}
        {toolResults.length > 0 && (
          <div className="mt-2 space-y-1">
            {toolResults.map((tr, i) => (
              <div
                key={i}
                className="text-[11px] text-text-muted font-mono bg-surface-tertiary rounded px-2 py-1 truncate"
              >
                Tool result: {tr}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
