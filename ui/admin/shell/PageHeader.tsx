import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type DependencyList,
  type ReactNode,
} from "react";
import { Button } from "@ui/button";

/**
 * The page header/footer bars.
 *
 * This is the CONTRIBUTION SEAM between a page and the shell: the page declares
 * what it wants shown, the layout decides where it renders, and neither imports
 * the other. Copy this shape for any future shell slot — it is the reason a
 * plugin page can put a "Save" button in the app chrome without the chrome
 * knowing that plugin exists.
 */

export interface PageHeaderAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost" | "destructive";
  /** Greys the button out — for "nothing to save" states. */
  disabled?: boolean;
}

export interface PageHeaderState {
  title: string;
  description?: string;
  actions?: PageHeaderAction[] | ReactNode;
}

interface PageHeaderContextType {
  header: PageHeaderState | null;
  setHeader: (state: PageHeaderState) => void;
  clearHeader: () => void;
}

export const PageHeaderContext = createContext<PageHeaderContextType>({
  header: null,
  setHeader: () => {},
  clearHeader: () => {},
});

export function usePageHeader() {
  return useContext(PageHeaderContext);
}

/**
 * Declare this page's header. Clears on unmount, so navigating away never leaves
 * the previous page's title in the bar.
 *
 * ```tsx
 * useSetPageHeader({
 *   title: "Properties",
 *   description: "Every unit in the portfolio",
 *   actions: [{ label: "Add property", onClick: openCreate }],
 * }, [openCreate]);
 * ```
 */
export function useSetPageHeader(state: PageHeaderState, deps: DependencyList = []) {
  const { setHeader, clearHeader } = usePageHeader();
  useEffect(() => {
    setHeader(state);
    return () => clearHeader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function isActionArray(actions: unknown): actions is PageHeaderAction[] {
  return (
    Array.isArray(actions) &&
    actions.every(
      (action) =>
        typeof action === "object" &&
        action !== null &&
        typeof (action as PageHeaderAction).label === "string" &&
        typeof (action as PageHeaderAction).onClick === "function",
    )
  );
}

export function HeaderActions({ actions }: { actions?: PageHeaderAction[] | ReactNode }) {
  if (!actions) return null;

  if (!isActionArray(actions)) return <>{actions}</>;
  if (actions.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 md:gap-2">
      {actions.map((action, i) => (
        <Button
          key={`${action.label}-${i}`}
          variant={action.variant ?? (i === actions.length - 1 ? "default" : "outline")}
          size="sm"
          onClick={action.onClick}
          disabled={action.disabled}
          className="h-8 gap-1.5 px-2.5 text-xs md:px-3 md:text-sm"
        >
          {action.icon}
          <span className="hidden sm:inline">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}

export function PageHeaderBar() {
  const { header } = usePageHeader();
  if (!header) return null;

  return (
    <div className="shrink-0 border-b border-border bg-background px-3 py-2.5 md:px-6 md:py-3">
      <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground md:text-base lg:text-lg">
            {header.title}
          </h1>
          {header.description && (
            <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">
              {header.description}
            </p>
          )}
        </div>
        {header.actions && (
          <div className="flex w-full shrink-0 items-center overflow-x-auto md:w-auto">
            <HeaderActions actions={header.actions} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page footer ──────────────────────────────────────────────────────────────

export interface PageFooterState {
  content: ReactNode;
}

interface PageFooterContextType {
  footer: PageFooterState | null;
  setFooter: (state: PageFooterState) => void;
  clearFooter: () => void;
}

export const PageFooterContext = createContext<PageFooterContextType>({
  footer: null,
  setFooter: () => {},
  clearFooter: () => {},
});

export function usePageFooter() {
  return useContext(PageFooterContext);
}

/** Declare a sticky footer bar for this page (bulk-action strips, save bars). */
export function useSetPageFooter(state: PageFooterState, deps: DependencyList = []) {
  const { setFooter, clearFooter } = usePageFooter();
  useEffect(() => {
    setFooter(state);
    return () => clearFooter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function PageFooterBar() {
  const { footer } = usePageFooter();
  if (!footer) return null;

  return (
    <div className="z-20 shrink-0 border-t border-border bg-background/95 px-5 py-3.5 backdrop-blur supports-backdrop-filter:bg-background/80">
      {footer.content}
    </div>
  );
}

/**
 * Both providers in one, so `AdminLayout` mounts a single element and a custom
 * layout can reuse the pair without re-deriving the state wiring.
 */
export function PageChromeProvider({
  children,
  initialHeader = null,
}: {
  children: ReactNode;
  initialHeader?: PageHeaderState | null;
}) {
  const [header, setHeader] = useState<PageHeaderState | null>(initialHeader);
  const [footer, setFooter] = useState<PageFooterState | null>(null);

  const headerValue = useMemo(
    () => ({ header, setHeader, clearHeader: () => setHeader(null) }),
    [header],
  );
  const footerValue = useMemo(
    () => ({ footer, setFooter, clearFooter: () => setFooter(null) }),
    [footer],
  );

  return (
    <PageHeaderContext.Provider value={headerValue}>
      <PageFooterContext.Provider value={footerValue}>{children}</PageFooterContext.Provider>
    </PageHeaderContext.Provider>
  );
}
