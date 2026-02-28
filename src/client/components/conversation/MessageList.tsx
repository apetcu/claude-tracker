import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";

interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string | { type: string; text: string }[];
  tool_use_id?: string;
}

interface Message {
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

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="space-y-4 pb-8">
      {messages.map((msg) =>
        msg.role === "user" ? (
          <UserMessage key={msg.uuid} message={msg} />
        ) : (
          <AssistantMessage key={msg.uuid} message={msg} />
        )
      )}
    </div>
  );
}
