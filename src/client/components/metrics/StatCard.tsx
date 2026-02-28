import { formatNumber } from "../../lib/format";

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  small?: boolean;
}

export function StatCard({ label, value, sub, small }: StatCardProps) {
  const displayValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div className="p-3 bg-surface-secondary border border-border rounded-lg">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`font-semibold text-text-primary ${small ? "text-lg" : "text-2xl"} mt-0.5`}>
        {displayValue}
      </div>
      {sub && <div className="text-xs text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}
