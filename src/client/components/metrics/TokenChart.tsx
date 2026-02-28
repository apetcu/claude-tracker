import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatNumber } from "../../lib/format";

interface TokenChartProps {
  data: { input: number; output: number; cacheRead: number; cacheCreation: number };
}

export function TokenChart({ data }: TokenChartProps) {
  const chartData = [
    { name: "Input", value: data.input, fill: "#6c63ff" },
    { name: "Output", value: data.output, fill: "#34d399" },
    { name: "Cache Read", value: data.cacheRead, fill: "#60a5fa" },
    { name: "Cache Create", value: data.cacheCreation, fill: "#fbbf24" },
  ];

  return (
    <div className="p-4 bg-surface-secondary border border-border rounded-lg">
      <h3 className="text-xs font-medium text-text-muted mb-3">Token Usage</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v) => formatNumber(v)}
          />
          <Tooltip
            contentStyle={{
              background: "#1e2130",
              border: "1px solid #2a2d3a",
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value: number) => [formatNumber(value), "Tokens"]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
