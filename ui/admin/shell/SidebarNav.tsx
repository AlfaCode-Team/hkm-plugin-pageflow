import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  type ReactNode,
} from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { Link } from "@pageflow/react";
import { Popover, PopoverContent, PopoverTrigger } from "@ui/popover";
import { cn } from "@lib/utils";
import { selectNavSections } from "../nav/registry";
import { resolveIcon } from "../nav/icons";
import type {
  ModuleNavItem as NavItem,
  ModuleSection as NavSection,
  NavBadge,
} from "../nav/types";
import { useAdminShell, useCurrentPath } from "./useAdminShell";

export type { NavSection, NavItem, NavBadge };

const BADGE_STYLES: Record<NavBadge["variant"], string> = {
  new: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  paid: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  beta: "bg-violet-500/15 text-violet-500 border-violet-500/20",
  soon: "bg-sky-500/15 text-sky-500 border-sky-500/20",
};

function NavBadgeChip({ badge }: { badge: NavBadge }) {
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none",
        BADGE_STYLES[badge.variant],
      )}
    >
      {badge.label}
    </span>
  );
}

/**
 * Row metrics for the overflow calculator, read from CSS custom properties.
 *
 * The calculator decides what fits WITHOUT measuring every row, so these must
 * track the padding the rows actually render with. 0.3 hard-coded them in this
 * file with a comment admitting "a padding change here is a silent miscount" —
 * survivable in one app, untraceable once projects restyle the sidebar. Now they
 * come from `theme.css`, where the padding is also a project's to change.
 */
interface Metrics {
  item: number;
  sectionLabel: number;
  sectionGap: number;
}

const FALLBACK: Record<"roomy" | "compact", Metrics> = {
  roomy: { item: 36, sectionLabel: 28, sectionGap: 16 },
  compact: { item: 32, sectionLabel: 24, sectionGap: 12 },
};

function readMetrics(el: Element | null, compact: boolean): Metrics {
  const fallback = compact ? FALLBACK.compact : FALLBACK.roomy;
  if (!el || typeof window === "undefined") return fallback;

  const style = window.getComputedStyle(el);
  const px = (name: string, or: number) => {
    const raw = style.getPropertyValue(name).trim();
    const n = raw.endsWith("px") ? Number.parseFloat(raw) : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : or;
  };
  const suffix = compact ? "-compact" : "";

  return {
    item: px(`--nav-row-h${suffix}`, fallback.item),
    sectionLabel: px(`--nav-section-label-h${suffix}`, fallback.sectionLabel),
    sectionGap: px(`--nav-section-gap${suffix}`, fallback.sectionGap),
  };
}

const MORE_BUTTON_HEIGHT = 52;
const NAV_PADDING = 16;
const FOOTER_SAFE_BUFFER = 10;
const RESIZE_THROTTLE_MS = 150;

function ExpandableChildren({ isOpen, children }: { isOpen: boolean; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(isOpen ? undefined : 0);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (isOpen) {
      setHeight(el.scrollHeight);
      const timer = setTimeout(() => setHeight(undefined), 200);
      return () => clearTimeout(timer);
    }
    // Start the collapse from the measured height so the transition has a from-value.
    setHeight(el.scrollHeight);
    requestAnimationFrame(() => setHeight(0));
  }, [isOpen]);

  return (
    <div
      ref={contentRef}
      className="overflow-hidden transition-[height,opacity] duration-200 ease-out"
      style={{ height: height !== undefined ? `${height}px` : "auto", opacity: isOpen ? 1 : 0 }}
    >
      {children}
    </div>
  );
}

/**
 * Nav row. A real anchor via Pageflow's `Link`, so middle-click, ⌘/Ctrl-click,
 * "copy link address" and the browser's status preview all work — a `<button>`
 * plus `window.location.href` supported none of them, and the latter also
 * discarded the SPA runtime on every navigation.
 */
function NavAnchor({
  href,
  isActive,
  className,
  children,
}: {
  href: string;
  isActive: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} aria-current={isActive ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}

function OverflowMenu({ items, activeId }: { items: NavItem[]; activeId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="mb-2.5 shrink-0 border-t border-sidebar-border px-3 py-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`More navigation (${items.length} items)`}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-fg-active sidebar-transition"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>More</span>
            <span className="ml-auto rounded-full bg-sidebar-hover px-2 py-0.5 text-[10px] font-medium text-sidebar-fg-muted">
              {items.length}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="end"
          sideOffset={12}
          className="z-100 w-60 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-xl"
        >
          <ul className="space-y-0.5">
            {items.map((item) => {
              const Icon = resolveIcon(item.icon);
              const hasChildren = (item.children?.length ?? 0) > 0;
              const isExpanded = expandedId === item.id;
              const isActive =
                activeId === item.id || (item.children?.some((c) => c.id === activeId) ?? false);

              const rowClass = cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-popover-foreground hover:bg-muted",
              );

              return (
                <li key={item.id}>
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                      aria-expanded={isExpanded}
                      className={rowClass}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && <NavBadgeChip badge={item.badge} />}
                      <ChevronRight
                        aria-hidden="true"
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                          isExpanded && "rotate-90",
                        )}
                      />
                    </button>
                  ) : (
                    <NavAnchor href={item.path} isActive={isActive} className={rowClass}>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && <NavBadgeChip badge={item.badge} />}
                    </NavAnchor>
                  )}

                  {hasChildren && (
                    <ExpandableChildren isOpen={isExpanded}>
                      <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2.5">
                        {item.children!
                          .filter((child) => !child.hidden)
                          .map((child) => (
                            <li key={child.id}>
                              <NavAnchor
                                href={child.path}
                                isActive={activeId === child.id}
                                className={cn(
                                  "flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                                  activeId === child.id
                                    ? "text-accent-foreground font-medium"
                                    : "text-muted-foreground hover:text-popover-foreground",
                                )}
                              >
                                <span className="flex-1 truncate">{child.label}</span>
                                {child.badge && <NavBadgeChip badge={child.badge} />}
                              </NavAnchor>
                            </li>
                          ))}
                      </ul>
                    </ExpandableChildren>
                  )}
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * The sidebar navigation.
 *
 * Reads the module registry (populated at import time by each plugin's
 * `ui/admin/nav.ts`), gates it on the server-supplied feature list, and fits as
 * many rows as the viewport allows — the rest go into a "More" popover.
 */
export function SidebarNav() {
  const { features } = useAdminShell();
  const currentPath = useCurrentPath();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompactScreen, setIsCompactScreen] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < 1440 || window.innerHeight < 900,
  );

  const featureKey = JSON.stringify(features);

  useEffect(() => {
    let timer: number | undefined;
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => setIsCompactScreen(window.innerWidth < 1440 || window.innerHeight < 900),
        RESIZE_THROTTLE_MS,
      );
    };

    window.addEventListener("resize", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Pure: applies the feature list and restores the registry, so rendering never
  // leaves module-level state mutated (StrictMode double-invokes this, and the
  // sidebar is mounted twice — desktop rail + mobile drawer).
  const allSections = useMemo(
    () => selectNavSections(features),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featureKey],
  );

  const [visibleSections, setVisibleSections] = useState<NavSection[]>(allSections);
  const [overflowItems, setOverflowItems] = useState<NavItem[]>([]);

  const calculateOverflow = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const metrics = readMetrics(container, isCompactScreen);
    const sectionShellHeight = (sectionIndex: number) =>
      (sectionIndex > 0 ? metrics.sectionGap : 0) + metrics.sectionLabel;

    const availableHeight = Math.max(
      0,
      container.clientHeight - NAV_PADDING - FOOTER_SAFE_BUFFER,
    );
    let usedHeight = 0;
    const visible: NavSection[] = [];
    const overflow: NavItem[] = [];
    let cutReached = false;

    for (let si = 0; si < allSections.length; si++) {
      const section = allSections[si];

      if (cutReached) {
        overflow.push(...section.items);
        continue;
      }

      for (let ii = 0; ii < section.items.length; ii++) {
        const item = section.items[ii];
        const hasSection =
          visible.length > 0 && visible[visible.length - 1].label === section.label;
        const addSectionShell = !hasSection;
        const needed = metrics.item + (addSectionShell ? sectionShellHeight(visible.length) : 0);

        if (usedHeight + needed <= availableHeight) {
          if (addSectionShell) {
            visible.push({ label: section.label, items: [] });
            usedHeight += sectionShellHeight(visible.length - 1);
          }
          visible[visible.length - 1].items.push(item);
          usedHeight += metrics.item;
          continue;
        }

        overflow.push(item, ...section.items.slice(ii + 1));
        cutReached = true;
        break;
      }
    }

    let finalVisible = visible;
    let finalOverflow = overflow;

    // The "More" button itself takes room. Reclaim rows until it fits.
    if (finalOverflow.length > 0) {
      const navLimit = Math.max(0, availableHeight - MORE_BUTTON_HEIGHT);
      const reclaimed: NavItem[] = [];

      while (usedHeight > navLimit && finalVisible.length > 0) {
        const lastSection = finalVisible[finalVisible.length - 1];
        const lastItem = lastSection.items.pop();
        if (!lastItem) {
          finalVisible.pop();
          usedHeight -= sectionShellHeight(finalVisible.length);
          continue;
        }
        reclaimed.push(lastItem);
        usedHeight -= metrics.item;

        if (lastSection.items.length === 0) {
          finalVisible.pop();
          usedHeight -= sectionShellHeight(finalVisible.length);
        }
      }

      if (reclaimed.length > 0) finalOverflow = [...reclaimed.reverse(), ...finalOverflow];
    }

    // Runs on every observed layout change, so it walks ids rather than
    // serialising the whole tree.
    setVisibleSections((prev) => (sameSections(prev, finalVisible) ? prev : finalVisible));
    setOverflowItems((prev) => (sameItems(prev, finalOverflow) ? prev : finalOverflow));
  }, [allSections, isCompactScreen]);

  useEffect(() => {
    let rafId = 0;

    // The container is `flex-1 min-h-0` inside the sidebar column, so its own box
    // changes whenever any ancestor resizes — observing it alone is sufficient.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(calculateOverflow);
    });
    const container = containerRef.current;
    if (container) observer.observe(container);

    // First pass: wait until the container has actually been laid out.
    const attempt = () => {
      if (containerRef.current && containerRef.current.clientHeight > 0) calculateOverflow();
      else rafId = requestAnimationFrame(attempt);
    };
    rafId = requestAnimationFrame(attempt);

    // Fonts change row heights after first paint. `document.fonts.ready` resolves
    // whether or not this mounted before window load, which a `load` listener did not.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) calculateOverflow();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [calculateOverflow]);

  const pathMatches = useCallback(
    (itemPath: string, parentPath?: string): boolean => {
      if (currentPath === itemPath || currentPath.startsWith(itemPath + "/")) return true;
      if (parentPath) {
        return currentPath === parentPath || currentPath.startsWith(parentPath + "/");
      }
      return false;
    },
    [currentPath],
  );

  /**
   * The base scope for a parent item with children.
   * Priority: item.parentPath → first child's parentPath → first child's path
   * minus its last segment → the item's own path.
   */
  const getItemBase = (item: NavItem): string => {
    if (item.parentPath) return item.parentPath;
    const firstChild = item.children?.[0];
    if (firstChild) {
      if (firstChild.parentPath) return firstChild.parentPath;
      const stripped = firstChild.path.slice(0, firstChild.path.lastIndexOf("/"));
      if (stripped) return stripped;
    }
    return item.path;
  };

  /**
   * Longest-prefix match across items AND children, with `parentPath` scoping.
   *
   * A "default" candidate is one matched only through its parent scope — e.g.
   * `/admin/products/brands/create` matching the Brands item because it lives
   * under `/admin/products/brands`. Real matches always beat defaults, and among
   * equals the longest path wins, so a child never loses to its own parent.
   */
  const activeId = useMemo(() => {
    const candidates: { id: string; length: number; isDefault: boolean }[] = [];

    for (const section of allSections) {
      for (const item of section.items) {
        if (item.children && item.children.length > 0) {
          let childMatched = false;

          for (const child of item.children) {
            if (currentPath === child.path || currentPath.startsWith(child.path + "/")) {
              candidates.push({ id: child.id, length: child.path.length, isDefault: false });
              childMatched = true;
            }
          }

          if (!childMatched) {
            const base = getItemBase(item);
            if (currentPath === base || currentPath.startsWith(base + "/")) {
              candidates.push({ id: item.children[0].id, length: base.length, isDefault: true });
            }
          }
        } else if (pathMatches(item.path, item.parentPath)) {
          const matchLen = item.parentPath
            ? Math.max(item.path.length, item.parentPath.length)
            : item.path.length;
          const isDefault =
            !!item.parentPath &&
            currentPath !== item.path &&
            !currentPath.startsWith(item.path + "/");
          candidates.push({ id: item.id, length: matchLen, isDefault });
        }
      }
    }

    if (candidates.length === 0) return "";

    const real = candidates.filter((c) => !c.isDefault);
    const pool = real.length > 0 ? real : candidates;
    pool.sort((a, b) => b.length - a.length);
    return pool[0].id;
  }, [currentPath, allSections, pathMatches]);

  const isChildActive = useCallback(
    (item: NavItem) => item.children?.some((c) => c.id === activeId) ?? false,
    [activeId],
  );

  const navGap = isCompactScreen ? "gap-3" : "gap-4";
  const navPadding = isCompactScreen ? "px-3 py-1.5" : "px-3 py-2";
  const itemPadding = isCompactScreen ? "px-2 py-1.5" : "px-2 py-2";
  const sectionLabelSpacing = isCompactScreen ? "mb-0.5" : "mb-1";

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 h-full flex-col overflow-hidden">
      <nav aria-label="Main" className={cn("flex min-h-0 flex-col", navGap, navPadding)}>
        {visibleSections.map((section) => {
          const headingId = `sidebar-section-${section.label.replace(/\s+/g, "-").toLowerCase()}`;

          return (
            <div key={section.label} className="animate-in fade-in-0 duration-200">
              <p
                id={headingId}
                className={cn(
                  sectionLabelSpacing,
                  "px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-section",
                )}
              >
                {section.label}
              </p>
              <ul className="space-y-0.5" aria-labelledby={headingId}>
                {section.items.map((item) => {
                  const Icon = resolveIcon(item.icon);
                  const hasChildren = !!item.children?.some((child) => !child.hidden);
                  const isActive = activeId === item.id || isChildActive(item);

                  const rowClass = cn(
                    "flex w-full items-center gap-2.5 rounded-md text-sm sidebar-transition",
                    itemPadding,
                    isActive
                      ? "bg-sidebar-active/15 text-sidebar-fg-active font-medium"
                      : "text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-fg-active",
                  );

                  return (
                    <li key={item.id}>
                      {!hasChildren ? (
                        <NavAnchor href={item.path} isActive={isActive} className={rowClass}>
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="flex-1 truncate text-left">{item.label}</span>
                          {item.badge && <NavBadgeChip badge={item.badge} />}
                        </NavAnchor>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label={`${item.label} submenu`}
                              className={rowClass}
                            >
                              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span className="flex-1 truncate text-left">{item.label}</span>
                              {item.badge && <NavBadgeChip badge={item.badge} />}
                              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="right"
                            align="start"
                            sideOffset={10}
                            className="z-100 w-56 rounded-lg border border-border bg-popover p-1.5 shadow-xl"
                          >
                            <ul className="space-y-0.5">
                              {item.children!
                                .filter((child) => !child.hidden)
                                .map((child) => (
                                  <li key={child.id}>
                                    <NavAnchor
                                      href={child.path}
                                      isActive={activeId === child.id}
                                      className={cn(
                                        "flex w-full items-center gap-1 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                                        activeId === child.id
                                          ? "bg-accent text-accent-foreground font-medium"
                                          : "text-popover-foreground hover:bg-muted",
                                      )}
                                    >
                                      <span className="flex-1 truncate">{child.label}</span>
                                      {child.badge && <NavBadgeChip badge={child.badge} />}
                                    </NavAnchor>
                                  </li>
                                ))}
                            </ul>
                          </PopoverContent>
                        </Popover>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {overflowItems.length > 0 && <OverflowMenu items={overflowItems} activeId={activeId} />}
    </div>
  );
}

/** Structural equality on ids — avoids re-rendering the nav on every observed resize. */
function sameItems(a: NavItem[], b: NavItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id) return false;
  return true;
}

function sameSections(a: NavSection[], b: NavSection[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].label !== b[i].label) return false;
    if (!sameItems(a[i].items, b[i].items)) return false;
  }
  return true;
}
