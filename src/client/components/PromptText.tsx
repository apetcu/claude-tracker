import { useState } from "react";

interface ParsedSegment {
  type: "text" | "teammate-message" | "command";
  text: string;
  /** teammate_id for teammate-message tags */
  teammateId?: string;
  /** command name like /init */
  commandName?: string;
}

const TEAMMATE_TOOLTIPS: Record<string, string> = {
  "team-lead": "Team Lead agent coordinating the build team",
};

function getTeammateTooltip(teammateId: string): string {
  return (
    TEAMMATE_TOOLTIPS[teammateId] ??
    `Agent teammate: ${teammateId}`
  );
}

/**
 * Parse a prompt string that may contain XML-like tags into structured segments.
 *
 * Handles:
 * - <teammate-message teammate_id="X"> ... (rest is the task description)
 * - <command-message>X</command-message> <command-name>Y</command-name>
 */
function parsePrompt(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Match <teammate-message teammate_id="...">
    const teammateMatch = remaining.match(
      /^<teammate-message\s+teammate_id="([^"]*)">\s*/
    );
    if (teammateMatch) {
      const teammateId = teammateMatch[1];
      remaining = remaining.slice(teammateMatch[0].length);

      // The rest until the next tag or end is the message content
      // Check for closing tag (may or may not exist)
      const closeIdx = remaining.indexOf("</teammate-message>");
      let content: string;
      if (closeIdx !== -1) {
        content = remaining.slice(0, closeIdx);
        remaining = remaining.slice(closeIdx + "</teammate-message>".length).trimStart();
      } else {
        content = remaining;
        remaining = "";
      }

      segments.push({
        type: "teammate-message",
        text: content.trim(),
        teammateId,
      });
      continue;
    }

    // Match <command-message>X</command-message> <command-name>Y</command-name>
    const commandMatch = remaining.match(
      /^<command-message>(.*?)<\/command-message>\s*<command-name>(.*?)<\/command-name>\s*/
    );
    if (commandMatch) {
      segments.push({
        type: "command",
        text: commandMatch[1],
        commandName: commandMatch[2],
      });
      remaining = remaining.slice(commandMatch[0].length);
      continue;
    }

    // Match standalone <command-message>X</command-message>
    const cmdMsgMatch = remaining.match(
      /^<command-message>(.*?)<\/command-message>\s*/
    );
    if (cmdMsgMatch) {
      segments.push({
        type: "command",
        text: cmdMsgMatch[1],
        commandName: cmdMsgMatch[1],
      });
      remaining = remaining.slice(cmdMsgMatch[0].length);
      continue;
    }

    // Skip any other unrecognized tags
    const unknownTagMatch = remaining.match(/^<[^>]+>/);
    if (unknownTagMatch) {
      remaining = remaining.slice(unknownTagMatch[0].length);
      continue;
    }

    // Plain text — consume until next '<' or end
    const nextTag = remaining.indexOf("<");
    if (nextTag === -1) {
      segments.push({ type: "text", text: remaining });
      remaining = "";
    } else if (nextTag === 0) {
      // Lone '<' not matched by any pattern — consume it as text to avoid infinite loop
      segments.push({ type: "text", text: "<" });
      remaining = remaining.slice(1);
    } else {
      segments.push({ type: "text", text: remaining.slice(0, nextTag) });
      remaining = remaining.slice(nextTag);
    }
  }

  return segments;
}

function Tooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] text-text-primary bg-surface-primary border border-border rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

/**
 * Renders prompt text with intelligent parsing of teammate-message
 * and command XML tags as styled badges with tooltips.
 */
export function PromptText({
  text,
  maxLength = 120,
}: {
  text: string;
  maxLength?: number;
}) {
  if (!text) return <span className="text-text-muted">No prompt</span>;

  const segments = parsePrompt(text);

  // If parsing produced nothing meaningful, show truncated raw text
  if (segments.length === 0) {
    return <span>{text.slice(0, maxLength)}{text.length > maxLength ? "..." : ""}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 flex-wrap">
      {segments.map((seg, i) => {
        switch (seg.type) {
          case "teammate-message":
            return (
              <span key={i} className="inline-flex items-center gap-1.5 min-w-0">
                <Tooltip text={getTeammateTooltip(seg.teammateId ?? "")}>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 text-[11px] font-medium shrink-0 cursor-default">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                    </svg>
                    {seg.teammateId}
                  </span>
                </Tooltip>
                <span className="truncate">
                  {seg.text.length > maxLength
                    ? seg.text.slice(0, maxLength) + "..."
                    : seg.text}
                </span>
              </span>
            );

          case "command":
            return (
              <span key={i} className="inline-flex items-center gap-1.5 min-w-0">
                <Tooltip text={`Slash command: ${seg.commandName}`}>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 text-[11px] font-mono font-medium shrink-0 cursor-default">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    {seg.commandName}
                  </span>
                </Tooltip>
                {seg.text !== seg.commandName && (
                  <span className="truncate text-text-muted">{seg.text}</span>
                )}
              </span>
            );

          case "text":
          default:
            return (
              <span key={i} className="truncate">
                {seg.text.length > maxLength
                  ? seg.text.slice(0, maxLength) + "..."
                  : seg.text}
              </span>
            );
        }
      })}
    </span>
  );
}
