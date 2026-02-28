import { formatNumber } from "../../lib/format";

interface CodeContributionProps {
  linesAdded: number;
  linesRemoved: number;
}

export function CodeContribution({ linesAdded, linesRemoved }: CodeContributionProps) {
  return (
    <div className="p-4 bg-surface-secondary border border-border rounded-lg">
      <h3 className="text-xs font-medium text-text-muted mb-3">Code Contribution</h3>
      <div className="flex gap-4">
        <div>
          <span className="text-success text-xl font-semibold">+{formatNumber(linesAdded)}</span>
          <div className="text-xs text-text-muted">lines added</div>
        </div>
        <div>
          <span className="text-danger text-xl font-semibold">-{formatNumber(linesRemoved)}</span>
          <div className="text-xs text-text-muted">lines removed</div>
        </div>
      </div>
    </div>
  );
}
