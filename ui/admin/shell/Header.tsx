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
import { useAdminShell, useCurrentPath } from "./useAdminShell";

interface Crumb {
  label: string;
  path?: string;
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
 * Breadcrumbs come from the nav registry and the CURRENT PAGE URL. 0.3 read
 * `window.location.pathname` here — a value captured once at render that never
 * updates — so after any client-side navigation the sidebar highlight moved and
 * the breadcrumb did not. Its crumb links were also raw `window.location.href`
 * assignments, i.e. a full page load that threw away the SPA runtime. Both are
 * `usePage()`-driven and `<Link>`-based now.
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
  const featureKey = JSON.stringify(features);

  const crumbs = useMemo<Crumb[]>(() => {
    const trail: Crumb[] = [{ label: "Home", path: homePath }];

    // Longest match wins, so /a/b/c prefers the item that owns /a/b over /a.
    let best: { crumbs: Crumb[]; length: number } | null = null;

    for (const section of selectNavSections(features)) {
      for (const item of section.items) {
        for (const child of item.children ?? []) {
          if (currentPath === child.path || currentPath.startsWith(child.path + "/")) {
            if (!best || child.path.length > best.length) {
              best = {
                crumbs: [{ label: item.label, path: item.path }, { label: child.label }],
                length: child.path.length,
              };
            }
          }
        }

        if (currentPath === item.path || currentPath.startsWith(item.path + "/")) {
          if (!best || item.path.length > best.length) {
            best = { crumbs: [{ label: item.label }], length: item.path.length };
          }
        }
      }
    }

    return best ? [...trail, ...best.crumbs] : trail;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, featureKey, homePath]);

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
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1.5">
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isLast || !crumb.path ? (
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
