import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Menu, PanelLeft } from "lucide-react";
import { Link } from "@pageflow/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ui/breadcrumb";
import { selectNavSections } from "../nav/registry";
import { usePageHeader } from "./PageHeader";
import { useAdminShell, useCurrentPath } from "./useAdminShell";

interface Crumb {
  label: string;
  path: string;
}

/**
 * Deepest static nav-registry label for `path`, prefix-matched the same way
 * the old fixed-depth breadcrumb did. Used only as a fallback for a page that
 * has not set its own `useSetPageHeader` title (or hasn't yet, mid-swap) —
 * the live title is preferred because it carries the real entity name
 * ("Uganda Music Awards 2026"), which no static route table knows.
 */
function navRegistryLabel(path: string, features: ReturnType<typeof useAdminShell>["features"]): string | null {
  let best: { label: string; length: number } | null = null;

  for (const section of selectNavSections(features)) {
    for (const item of section.items) {
      for (const child of item.children ?? []) {
        if (path === child.path || path.startsWith(child.path + "/")) {
          if (!best || child.path.length > best.length) {
            best = { label: child.label, length: child.path.length };
          }
        }
      }
      if (path === item.path || path.startsWith(item.path + "/")) {
        if (!best || item.path.length > best.length) {
          best = { label: item.label, length: item.path.length };
        }
      }
    }
  }

  return best?.label ?? null;
}

/** Last resort: turn "/editions/abc123" into "Abc123" so a crumb never shows
    a raw path or goes blank while nothing else has an opinion yet. */
function fallbackLabel(path: string): string {
  const last = path.split("/").filter(Boolean).pop();
  if (!last) return "Home";
  return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface DashboardHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isMobile?: boolean;
  /** Rendered on the right, before the clock. */
  actions?: ReactNode;
  /** Show a live clock. Default true. */
  clock?: boolean;
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <time
        dateTime={now.toISOString()}
        className="text-sm font-medium tabular-nums text-foreground"
      >
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </time>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
      </span>
    </div>
  );
}

/**
 * Top bar: sidebar toggle, breadcrumbs, optional actions and clock.
 *
 * Breadcrumbs are a FLOW HISTORY, not a fixed-depth route match. 0.3's
 * successor here read the static nav registry — module → item → item's
 * direct children — which only ever has two levels below Home, so a real
 * drill-down (an event → one of its categories → one of that category's
 * contestants) got flattened to whatever the LAST registry match was. Every
 * page already sets its own title via `useSetPageHeader` (an edition's own
 * name, a contestant's own name, …), so the trail below is built from pages
 * actually visited, each labelled with its own live title — it grows exactly
 * as deep as the click-path that produced it, with no registry depth to run
 * out of. Revisiting an earlier crumb (Back, or clicking one) truncates back
 * to it rather than growing forever; landing on Home starts a fresh trail.
 *
 * `window.location.pathname` — what 0.3 read here — is a value captured once
 * at render that never updates, so after any client-side navigation the
 * sidebar highlight moved and the breadcrumb did not. Its crumb links were
 * also raw `window.location.href` assignments, i.e. a full page load that
 * threw away the SPA runtime. Both are `usePage()`-driven and `<Link>`-based
 * now.
 */
export function DashboardHeader({
  sidebarOpen,
  onToggleSidebar,
  isMobile,
  actions,
  clock = true,
}: DashboardHeaderProps) {
  const { features, homePath } = useAdminShell();
  const currentPath = useCurrentPath();
  const { header } = usePageHeader();
  const featureKey = JSON.stringify(features);

  // `features` is a new array reference every render (see useAdminShell), so
  // this keys on its content instead — otherwise every render would re-walk
  // the nav registry even when nothing about it changed.
  const resolvedLabel = useMemo(
    () => header?.title || navRegistryLabel(currentPath, features) || fallbackLabel(currentPath),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPath, featureKey, header?.title],
  );

  const [trail, setTrail] = useState<Crumb[]>([{ label: "Home", path: homePath }]);

  useEffect(() => {
    setTrail((previous) => {
      if (currentPath === homePath) {
        const alreadyHome =
          previous.length === 1 && previous[0].path === homePath && previous[0].label === "Home";
        return alreadyHome ? previous : [{ label: "Home", path: homePath }];
      }

      const last = previous[previous.length - 1];
      if (last?.path === currentPath) {
        // Same page as last render — only the label may have caught up (the
        // live title arrives one effect tick after the path does).
        return last.label === resolvedLabel
          ? previous
          : [...previous.slice(0, -1), { label: resolvedLabel, path: currentPath }];
      }

      const revisited = previous.findIndex((crumb) => crumb.path === currentPath);
      if (revisited !== -1) return previous.slice(0, revisited + 1);

      return [...previous, { label: resolvedLabel, path: currentPath }];
    });
  }, [currentPath, homePath, resolvedLabel]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-expanded={isMobile ? undefined : sidebarOpen}
        aria-label={isMobile ? "Open menu" : sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {isMobile ? <Menu className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
      </button>

      <div className="h-5 w-px bg-border" />

      <Breadcrumb>
        <BreadcrumbList>
          {trail.map((crumb, i) => {
            const isLast = i === trail.length - 1;
            return (
              <span key={`${crumb.path}-${i}`} className="inline-flex items-center gap-1.5">
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.path} className="transition-colors hover:text-foreground">
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-3">
        {actions}
        {clock && <LiveClock />}
      </div>
    </header>
  );
}
