import type { ElementType, ReactNode } from "react";
import { ChevronLeft, ChevronRight, ListFilter, Plus, Search } from "lucide-react";
import { Button } from "@ui/button";
import { Card, CardContent } from "@ui/card";
import { Input } from "@ui/input";
import { cn } from "@lib/utils";

/**
 * The chrome a resource list page shares: a KPI strip, a search + primary-action
 * toolbar, status chips, an empty state, a table region and pagination.
 *
 * In HKM 0.3 six product pages had all of this inline and ~85% identical, so a
 * fix to one never reached the other five. The table BODY stays with the page —
 * the columns are the one part that genuinely differs.
 */

// ── Stat strip ────────────────────────────────────────────────────────────────

export interface StatCard {
  label: string;
  value: number | string;
  icon: ElementType;
  /** Tailwind text + bg pair, e.g. "text-emerald-600 bg-emerald-500/10". */
  color?: string;
}

export function StatStrip({ cards }: { cards: StatCard[] }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cards.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3",
      )}
    >
      {cards.map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
        >
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              color ?? "bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-lg font-bold text-foreground">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Status chips ──────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
  icon?: ElementType;
}

export function FilterChips({
  label = "Status",
  options,
  value,
  onChange,
  counts,
}: {
  label?: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ListFilter className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </span>
      <div
        role="group"
        aria-label={`Filter by ${label.toLowerCase()}`}
        className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
      >
        {options.map(({ value: option, label: optionLabel, icon: Icon }) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              value === option
                ? "border border-border bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {optionLabel}
            <span className="ml-1 text-[10px] opacity-70">{counts[option] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

/**
 * Page numbers around the current page, with ellipses.
 *
 * The pages this replaced rendered `Array.from({length: Math.min(total, 7)})` —
 * always 1…7 — so past page 7 you could only step one page at a time and the
 * strip pointed at pages you were nowhere near.
 */
export function pageWindow(current: number, total: number, span = 5): (number | "…")[] {
  if (total <= span + 2) return Array.from({ length: total }, (_, i) => i + 1);

  const half = Math.floor(span / 2);
  let start = Math.max(2, current - half);
  const end = Math.min(total - 1, start + span - 1);
  start = Math.max(2, end - span + 1);

  const pages: (number | "…")[] = [1];
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export function Pagination({
  page,
  totalPages,
  totalResults,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalResults: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const arrow =
    "flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav
      aria-label="Pagination"
      className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
    >
      <p className="text-xs text-muted-foreground">
        {totalResults} result{totalResults !== 1 ? "s" : ""} &middot; page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={arrow}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {pageWindow(page, totalPages).map((entry, i) =>
          entry === "…" ? (
            <span
              key={`gap-${i}`}
              aria-hidden="true"
              className="flex h-8 w-6 items-center justify-center text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-label={`Page ${entry}`}
              aria-current={entry === page ? "page" : undefined}
              className={cn(
                "h-8 w-8 rounded-md text-xs font-medium transition-colors",
                entry === page
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {entry}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className={arrow}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="px-4 py-16 text-center">
      <div className="mx-auto max-w-sm space-y-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <Icon className="h-10 w-10 text-primary opacity-60" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {actionLabel && onAction && (
          <Button size="lg" className="mt-2" onClick={onAction}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Table wrapper ─────────────────────────────────────────────────────────────

/** Column headings, so no page hand-writes the same six `<th>` classes. */
export interface SimpleColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  /** Hide below `sm`, for columns that are nice-to-have on a phone. */
  hideOnMobile?: boolean;
}

export function SimpleTable({
  columns,
  children,
}: {
  columns: SimpleColumn[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left",
                  col.hideOnMobile && "hidden sm:table-cell",
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export interface ResourceListShellProps {
  stats?: StatCard[];
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  /** Toolbar primary action. Omit when the page has no inline create. */
  createLabel?: string;
  onCreate?: () => void;
  filters?: {
    label?: string;
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
    counts: Record<string, number>;
  };
  /** Rendered instead of the table when there is nothing to show. */
  empty: EmptyStateProps;
  isEmpty: boolean;
  page: number;
  totalPages: number;
  totalResults: number;
  onPageChange: (page: number) => void;
  children: ReactNode;
}

export function ResourceListShell({
  stats,
  search,
  onSearchChange,
  searchPlaceholder,
  createLabel,
  onCreate,
  filters,
  empty,
  isEmpty,
  page,
  totalPages,
  totalResults,
  onPageChange,
  children,
}: ResourceListShellProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="container space-y-6 py-6">
          {stats && stats.length > 0 && <StatStrip cards={stats} />}

          <Card>
            <CardContent className="px-4 py-6 md:py-8">
              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      type="search"
                      placeholder={searchPlaceholder}
                      aria-label={searchPlaceholder}
                      value={search}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="h-10 pl-10 text-sm"
                    />
                  </div>
                  {createLabel && onCreate && (
                    <Button onClick={onCreate} className="shrink-0">
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">{createLabel}</span>
                      <span className="sm:hidden">New</span>
                    </Button>
                  )}
                </div>
                {filters && <FilterChips {...filters} />}
              </div>

              {isEmpty ? <EmptyState {...empty} /> : children}

              <Pagination
                page={page}
                totalPages={totalPages}
                totalResults={totalResults}
                onPageChange={onPageChange}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
