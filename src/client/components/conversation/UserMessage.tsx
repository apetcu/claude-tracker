import Markdown from "react-markdown";

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

function extractText(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  return content
    .map((b) => {
      if (b.type === "text" && b.text) return b.text;
      if (b.type === "tool_result") {
        if (typeof b.content === "string") return `[Tool result]: ${b.content.slice(0, 200)}`;
        if (Array.isArray(b.content))
          return b.content
            .filter((c) => c.type === "text")
            .map((c) => `[Tool result]: ${c.text?.slice(0, 200)}`)
            .join("\n");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function UserMessage({ message }: UserMessageProps) {
  const text = extractText(message.content);

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
        U
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-muted mb-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
        <div className="prose prose-invert prose-sm max-w-none text-text-primary">
          <Markdown>{text.slice(0, 5000)}</Markdown>
        </div>
      </div>
    </div>
  );
}
