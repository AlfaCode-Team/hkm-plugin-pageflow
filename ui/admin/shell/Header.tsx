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
import { crumbsFor } from "./crumbs";
import { useAdminShell, useCurrentPath } from "./useAdminShell";

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
 * BREADCRUMBS ARE A HIERARCHY, NOT A HISTORY. A revision of this file built the
 * trail from pages actually visited, accumulated in state, to escape the nav
 * registry's two-level ceiling. It escaped it by answering a different
 * question, and the answers were wrong in both directions:
 *
 *   - Four sibling pages under one entity (a business's overview, branches,
 *     team and manage) all set the same live title, so walking through them
 *     rendered `Home / Businesses / Acme / Acme / Acme` — the same name once
 *     per click.
 *   - Two unrelated sidebar destinations rendered as though one contained the
 *     other: two sibling rows visited in order produced `Home / Licences /
 *     Sessions`, whose "up" link went to a page Sessions is not inside.
 *
 * A breadcrumb's contract is "where this page sits, and what its parents are",
 * which is a function of the CURRENT path alone — so the trail is derived on
 * every render and holds no state. The registry supplies the two levels it
 * knows; a page deeper than that declares its own chain with the real entity
 * names via `useSetPageHeader({ crumbs })`, which is the thing the registry
 * could never do. The browser already owns history, and its Back button is
 * better at it than any bar we could draw.
 *
 * The derivation itself is in `./crumbs` so it can be run and asserted outside
 * a React tree.
 *
 * `window.location.pathname` — what 0.3 read here — is a value captured once at
 * render that never updates, so after any client-side navigation the sidebar
 * highlight moved and the breadcrumb did not. Its crumb links were also raw
 * `window.location.href` assignments, i.e. a full page load that threw away the
 * SPA runtime. Both are `usePage()`-driven and `<Link>`-based now.
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

  // `features` is a new array reference every render (see useAdminShell), and
  // `header.crumbs` a new array on every page swap, so the memo keys on their
  // CONTENT — otherwise every render would re-walk the nav registry even when
  // nothing about it changed.
  const featureKey = JSON.stringify(features);
  const declaredKey = JSON.stringify(header?.crumbs ?? null);

  const crumbs = useMemo(() => {
    const declared = header?.crumbs;

    return crumbsFor({
      currentPath,
      homePath,
      // The registry is only the FALLBACK, so it is not walked at all once the
      // page has said where it sits. `selectNavSections` writes module state
      // and restores it, which is cheap but not free.
      sections: declared && declared.length > 0 ? [] : selectNavSections(features),
      declared,
      title: header?.title,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, homePath, featureKey, declaredKey, header?.title]);

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
              <span
                key={`${crumb.path ?? "current"}-${i}`}
                className="inline-flex items-center gap-1.5"
              >
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : crumb.path === undefined ? (
                    // A level with no page of its own is still a level: it is
                    // rendered, and it is not a link that goes nowhere. NOT
                    // BreadcrumbPage, which hardcodes aria-current="page" —
                    // two of those in one trail tells a screen reader the trail
                    // has two current pages.
                    <span>{crumb.label}</span>
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
