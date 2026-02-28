import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { formatDate, formatDuration, truncate } from "../../lib/format";

interface Session {
  id: string;
  firstPrompt: string;
  startedAt: string;
  messageCount: number;
  toolUseCount: number;
  durationMs: number;
  source?: "claude" | "cursor";
}

interface SessionTimelineProps {
  sessions: Session[];
  onSessionClick: (id: string) => void;
  dateRange?: [number, number];
}

const CLAUDE_COLOR = "#6c63ff";
const CURSOR_COLOR = "#2dd4bf";

const tooltipStyle = {
  background: "#1e2130",
  border: "1px solid #2a2d3a",
  borderRadius: 6,
  fontSize: 12,
};

function dotSize(messageCount: number): number {
  // Clamp radius between 4 and 20px based on message count
  return Math.max(4, Math.min(20, 4 + Math.sqrt(messageCount) * 2));
}

interface DataPoint {
  date: number;
  dateLabel: string;
  messageCount: number;
  id: string;
  firstPrompt: string;
  durationMs: number;
  toolUseCount: number;
  source: "claude" | "cursor";
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as DataPoint;
  return (
    <div style={tooltipStyle} className="px-3 py-2 shadow-lg">
      <div className="text-text-primary text-xs font-medium mb-1">
        {truncate(d.firstPrompt, 80)}
      </div>
      <div className="text-text-muted text-[11px] space-y-0.5">
        <div>{d.dateLabel}</div>
        <div>{d.messageCount} messages &middot; {d.toolUseCount} tools</div>
        {d.durationMs > 0 && <div>{formatDuration(d.durationMs)}</div>}
      </div>
    </div>
  );
}

export function SessionTimeline({ sessions, onSessionClick, dateRange }: SessionTimelineProps) {
  if (!sessions.length) return null;

  const claudeData: DataPoint[] = [];
  const cursorData: DataPoint[] = [];

  for (const s of sessions) {
    const point: DataPoint = {
      date: new Date(s.startedAt).getTime(),
      dateLabel: formatDate(s.startedAt),
      messageCount: s.messageCount,
      id: s.id,
      firstPrompt: s.firstPrompt,
      durationMs: s.durationMs,
      toolUseCount: s.toolUseCount,
      source: s.source ?? "claude",
    };
    if (s.source === "cursor") {
      cursorData.push(point);
    } else {
      claudeData.push(point);
    }
  }

  const hasClaude = claudeData.length > 0;
  const hasCursor = cursorData.length > 0;

  const formatXTick = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex-1 relative min-h-[300px]">
      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <XAxis
              dataKey="date"
              type="number"
              domain={dateRange ?? ["dataMin", "dataMax"]}
              tickFormatter={formatXTick}
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              name="Date"
            />
            <YAxis
              dataKey="messageCount"
              type="number"
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              width={30}
              allowDecimals={false}
              name="Messages"
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={false}
            />
            {hasClaude && hasCursor && (
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: "#71717a" }}
              />
            )}
            {hasClaude && (
              <Scatter
                name="Claude"
                data={claudeData}
                fill={CLAUDE_COLOR}
                cursor="pointer"
                onClick={(entry: DataPoint) => onSessionClick(entry.id)}
              >
                {claudeData.map((d) => (
                  <Cell
                    key={d.id}
                    r={dotSize(d.messageCount)}
                    fillOpacity={0.7}
                  />
                ))}
              </Scatter>
            )}
            {hasCursor && (
              <Scatter
                name="Cursor"
                data={cursorData}
                fill={CURSOR_COLOR}
                cursor="pointer"
                onClick={(entry: DataPoint) => onSessionClick(entry.id)}
              >
                {cursorData.map((d) => (
                  <Cell
                    key={d.id}
                    r={dotSize(d.messageCount)}
                    fillOpacity={0.7}
                  />
                ))}
              </Scatter>
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
