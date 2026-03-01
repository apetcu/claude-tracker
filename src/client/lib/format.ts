export function formatNumber(n: number): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelative(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remainSecs}s`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}

// API pricing per million tokens: [input, output, cacheRead]
const MODEL_PRICING: Record<string, [number, number, number]> = {
  opus:   [15, 75, 1.5],
  sonnet: [3, 15, 0.3],
  haiku:  [0.8, 4, 0.08],
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number
): number {
  const m = model.match(/(opus|sonnet|haiku)/i);
  const tier = m ? m[1].toLowerCase() : "sonnet";
  const [inputRate, outputRate, cacheRate] = MODEL_PRICING[tier] ?? MODEL_PRICING.sonnet;
  const nonCacheInput = Math.max(0, inputTokens - cacheReadTokens);
  return (nonCacheInput * inputRate + outputTokens * outputRate + cacheReadTokens * cacheRate) / 1_000_000;
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return "<$0.01";
  if (cost < 1) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(2)}`;
}

export function shortModel(model: string): string {
  if (!model) return "";
  // Match patterns like "claude-opus-4-6", "claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001"
  const m = model.match(/(?:claude-)?(opus|sonnet|haiku)-?(\d+)?-?(\d+)?/i);
  if (!m) return "";
  const name = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  const major = m[2];
  const minor = m[3];
  if (!major) return name;
  // Skip minor if it looks like a date (8 digits)
  if (minor && minor.length >= 8) return `${name} ${major}`;
  if (minor) return `${name} ${major}.${minor}`;
  return `${name} ${major}`;
}

export function modelBadgeClass(model: string): string {
  if (!model) return "bg-zinc-500/15 text-zinc-400";
  if (model.includes("opus")) return "bg-amber-500/15 text-amber-400";
  if (model.includes("sonnet")) return "bg-blue-500/15 text-blue-400";
  if (model.includes("haiku")) return "bg-emerald-500/15 text-emerald-400";
  return "bg-zinc-500/15 text-zinc-400";
}
