import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatNumber } from "../../lib/format";

interface TimelineEntry {
  date: string;
  tokenInput: number;
  tokenOutput: number;
}

interface TokenBurnChartProps {
  data: TimelineEntry[];
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

function formatYTick(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export function TokenBurnChart({ data }: TokenBurnChartProps) {
  if (!data.length) return null;

  const numericData = data.map((d) => ({
    ...d,
    ts: new Date(d.date).getTime(),
  }));

  return (
    <div className="p-4 bg-surface-secondary border border-border rounded-lg flex flex-col">
      <h3 className="text-xs font-medium text-text-muted mb-3">Token Burn</h3>
      <div className="flex-1 relative min-h-[200px]">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={numericData}>
              <defs>
                <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatXTick}
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatYTick}
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickLine={false}
                axisLine={false}
                width={40}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={formatXTick}
                formatter={(value: number, name: string) => [
                  formatNumber(value),
                  name,
                ]}
              />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: "#71717a" }}
              />
              <Area
                type="monotone"
                dataKey="tokenInput"
                name="Input"
                stroke="#f59e0b"
                fill="url(#colorInput)"
                strokeWidth={2}
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="tokenOutput"
                name="Output"
                stroke="#3b82f6"
                fill="url(#colorOutput)"
                strokeWidth={2}
                stackId="1"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
