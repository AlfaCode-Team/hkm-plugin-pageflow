import type { ElementType } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@lib/utils";

export interface KpiCardProps {
  label: string;
  value: string | number;
  /** Delta text, e.g. "+12.4%". */
  change?: string;
  trend?: "up" | "down" | "neutral";
  description?: string;
  icon?: ElementType;
  className?: string;
}

/**
 * A single headline number with an optional trend.
 *
 * For a row of counts derived from a list, prefer `StatStrip` in
 * `ResourceListShell` — this one is for a dashboard tile that carries a
 * period-over-period comparison.
 */
export function KpiCard({
  label,
  value,
  change,
  trend = "neutral",
  description,
  icon: Icon,
  className,
}: KpiCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
      </div>

      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</p>

      {(change || description) && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          {change && trend === "up" && (
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
          )}
          {change && trend === "down" && (
            <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
          )}
          {change && (
            <span
              className={cn(
                "font-medium",
                trend === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : trend === "down"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground",
              )}
            >
              {change}
            </span>
          )}
          {description && <span className="text-muted-foreground">{description}</span>}
        </div>
      )}
    </div>
  );
}
