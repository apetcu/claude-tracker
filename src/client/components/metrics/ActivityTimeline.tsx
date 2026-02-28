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
  dateRange?: [number, number];
}

const tooltipStyle = {
  background: "#1e2130",
  border: "1px solid #2a2d3a",
  borderRadius: 6,
  fontSize: 12,
};

function formatXTick(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityTimeline({ data, dateRange }: TimelineProps) {
  if (!data.length) return null;

  const hasClaude = data.some((d) => d.claudeMessages > 0);
  const hasCursor = data.some((d) => d.cursorMessages > 0);

  // Convert date strings to timestamps for numeric X axis
  const numericData = data.map((d) => ({
    ...d,
    ts: new Date(d.date).getTime(),
  }));

  const domain: [number, number] = dateRange ?? [
    Math.min(...numericData.map((d) => d.ts)),
    Math.max(...numericData.map((d) => d.ts)),
  ];

  return (
    <div className="p-4 bg-surface-secondary border border-border rounded-lg flex flex-col">
      <h3 className="text-xs font-medium text-text-muted mb-3">Activity Timeline</h3>
      <div className="flex-1 relative min-h-[200px]">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={numericData}>
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
                dataKey="ts"
                type="number"
                domain={domain}
                tickFormatter={formatXTick}
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
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={formatXTick}
              />
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
      </div>
    </div>
  );
}
