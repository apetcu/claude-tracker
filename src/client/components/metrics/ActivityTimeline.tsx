import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TimelineEntry {
  date: string;
  sessions: number;
  messages: number;
  claudeSessions: number;
  claudeMessages: number;
  cursorSessions: number;
  cursorMessages: number;
}

export interface TimelineProps {
  data: TimelineEntry[];
}

const tooltipStyle = {
  background: "#1e2130",
  border: "1px solid #2a2d3a",
  borderRadius: 6,
  fontSize: 12,
};

export function ActivityTimeline({ data }: TimelineProps) {
  if (!data.length) return null;

  const hasClaude = data.some((d) => d.claudeMessages > 0);
  const hasCursor = data.some((d) => d.cursorMessages > 0);

  return (
    <div className="p-4 bg-surface-secondary border border-border rounded-lg">
      <h3 className="text-xs font-medium text-text-muted mb-3">Activity Timeline</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorClaude" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6c63ff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6c63ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCursor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            width={30}
            allowDecimals={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          {hasClaude && hasCursor && (
            <Legend
              iconType="square"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: "#71717a" }}
            />
          )}
          {hasClaude && (
            <Area
              type="monotone"
              dataKey="claudeMessages"
              name="Claude"
              stroke="#6c63ff"
              fill="url(#colorClaude)"
              strokeWidth={2}
            />
          )}
          {hasCursor && (
            <Area
              type="monotone"
              dataKey="cursorMessages"
              name="Cursor"
              stroke="#2dd4bf"
              fill="url(#colorCursor)"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
