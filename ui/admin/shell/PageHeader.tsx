import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type DependencyList,
  type ReactNode,
} from "react";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { Link } from "@pageflow/react";
import { Button } from "@ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui/dropdown-menu";
import { cn } from "@lib/utils";
import { ContentContainer } from "./content";

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
  /**
   * Always in the "More" menu, never a button of its own. For what is rare or
   * risky (reset, delete, move): a button beside "Edit" gets clicked by habit.
   */
  menu?: boolean;
}

/**
 * Where "up" is from this page.
 *
 * A DETAIL page needs this and a list page does not, which is why it belongs
 * here rather than in the sidebar: the sidebar answers "where can I go", and
 * this answers "where did I come from". Rendering it inside the header bar —
 * before the title, on the same line — is what keeps it from scrolling away
 * with the content, which is exactly when somebody reaches for it.
 *
 * `label` is not drawn at any breakpoint; it is the accessible name. The
 * control is an arrow and nothing else, because a detail page's header already
 * says what you are looking at and repeating "All businesses" beside it spends
 * the widest part of the bar on the one thing the user is leaving.
 */
export interface PageHeaderBack {
  href: string;
  /** Accessible name, e.g. "Back to all businesses". Required — an icon-only
   *  control with no name is unusable with a screen reader. */
  label: string;
}

/**
 * One level in this page's place in the hierarchy — NOT a page you visited.
 *
 * The nav registry describes two levels (a sidebar item and its children), so
 * it can place `/businesses` but knows nothing of `/businesses/{id}/branches`
 * or of what that id is called. A page that sits deeper states its own chain,
 * because it is the only thing holding the entity's name.
 */
export interface PageCrumb {
  label: string;
  /**
   * Where this level lives. Omit it on the page you are already on, and on a
   * grouping level that has no page of its own — a crumb without an href is
   * rendered as text rather than as a link that goes nowhere.
   */
  href?: string;
}

export interface PageHeaderState {
  title: string;
  description?: string;
  /** A detail page's way back. Omitted on list pages, which have no "up". */
  back?: PageHeaderBack;
  /**
   * This page's ancestry for the breadcrumb bar, outermost first, INCLUDING
   * this page as the last entry. Home is prepended by the shell, so do not
   * repeat it.
   *
   * Omit it and the shell derives the trail from the nav registry, which is
   * right for anything the registry can place. Declare it when the page is
   * deeper than the registry reaches, or when several sibling pages share one
   * title — four pages about one business all titled with its name are
   * indistinguishable in a breadcrumb unless they each name their own section.
   */
  crumbs?: PageCrumb[];
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

/**
 * How many buttons stand in the bar from `sm` up, the primary included. The
 * rest go into "More": seven equal buttons took the whole bar, squeezed the
 * title onto two lines and put "Reset votes" one slip away from "Edit".
 */
const MAX_VISIBLE_ACTIONS = 3;

/**
 * The bar's buttons. The LAST action is the primary one: it is always shown,
 * with its label. Up to two more stand beside it from `sm` up; on a phone they
 * move into "More" too, so the bar is one button and a menu at any width.
 *
 * Labels are always drawn. They used to be hidden below `sm` with only the
 * icon left, and most actions have no icon — on a phone they were empty boxes.
 */
export function HeaderActions({ actions }: { actions?: PageHeaderAction[] | ReactNode }) {
  if (!actions) return null;

  if (!isActionArray(actions)) return <>{actions}</>;
  if (actions.length === 0) return null;

  const primary = actions[actions.length - 1];
  const others = actions.slice(0, -1);
  const shown = others.filter((a) => !a.menu).slice(0, MAX_VISIBLE_ACTIONS - 1);
  // In "More" at every width: asked for, or past the cap.
  const alwaysInMenu = others.filter((a) => !shown.includes(a));

  const tone = (action: PageHeaderAction, isPrimary: boolean) =>
    action.variant ?? (isPrimary ? "default" : "outline");

  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5 md:gap-2">
      {shown.map((action, i) => (
        <Button
          key={`${action.label}-${i}`}
          variant={tone(action, false)}
          size="sm"
          onClick={action.onClick}
          disabled={action.disabled}
          className="hidden h-8 gap-1.5 px-3 text-sm sm:inline-flex"
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
      {others.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="More actions"
              title="More actions"
              className={cn("h-8 w-8 p-0", alwaysInMenu.length === 0 && "sm:hidden")}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            {others.map((action, i) => (
              <DropdownMenuItem
                key={`${action.label}-${i}`}
                onSelect={action.onClick}
                disabled={action.disabled}
                className={cn(
                  "gap-2",
                  shown.includes(action) && "sm:hidden",
                  action.variant === "destructive" && "text-destructive focus:text-destructive",
                )}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button
        variant={tone(primary, true)}
        size="sm"
        onClick={primary.onClick}
        disabled={primary.disabled}
        className="h-8 max-w-44 gap-1.5 px-3 text-sm sm:max-w-none"
      >
        {primary.icon}
        <span className="truncate">{primary.label}</span>
      </Button>
    </div>
  );
}

/**
 * The arrow, sized and aligned to the title rather than to the bar.
 *
 * `shrink-0` matters: the title is `line-clamp-2`, so on a narrow viewport a
 * long name wraps to two lines and a flexible arrow would be squeezed to
 * nothing. `self-start` with a nudge keeps it on the FIRST line of a wrapped
 * title instead of floating to the vertical centre of the block.
 */
function BackLink({ back }: { back: PageHeaderBack }) {
  return (
    <Link
      href={back.href}
      aria-label={back.label}
      title={back.label}
      className="mt-0.5 flex size-8 shrink-0 items-center justify-center self-start rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:mt-0 md:self-center"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
    </Link>
  );
}

export function PageHeaderBar() {
  const { header } = usePageHeader();
  if (!header) return null;
  const list = isActionArray(header.actions);

  return (
    // The BAR spans the viewport — its border and background are chrome — while
    // its content sits in the same centred column as `main`, so the title lines
    // up with the thing it is titling.
    //
    // The title and description come FIRST and take one line each from `md` up
    // (the full text is in the tooltip). The actions used to be `shrink-0`, so
    // they took their full width before the title got any and a page with
    // filters or seven buttons squeezed its name onto two lines and its
    // description onto three — the bar grew to twice its height, differently
    // on every page.
    //
    // Button lists (`PageHeaderAction[]`) sit on the title's row at every width:
    // HeaderActions keeps them to one button and a "More" menu on a phone.
    // Free-form actions cannot be folded, so on a phone they get their own row,
    // and from `md` up at most 60% of the bar, wrapping inside it.
    <div className="shrink-0 border-b border-border bg-background py-2.5 md:py-3">
      <ContentContainer>
        <div className={cn("flex gap-x-3 gap-y-2 md:items-center md:gap-x-6", list ? "items-center" : "flex-col md:flex-row")}>
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            {header.back && <BackLink back={header.back} />}
            <div className="min-w-0 flex-1">
              <h1
                title={header.title}
                className="line-clamp-2 text-base font-semibold leading-tight text-foreground md:line-clamp-1 lg:text-lg"
              >
                {header.title}
              </h1>
              {header.description && (
                <p
                  title={header.description}
                  className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm md:line-clamp-1"
                >
                  {header.description}
                </p>
              )}
            </div>
          </div>
          {header.actions &&
            (list ? (
              <HeaderActions actions={header.actions} />
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-2 md:max-w-[60%] md:justify-end">
                <HeaderActions actions={header.actions} />
              </div>
            ))}
        </div>
      </ContentContainer>
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
    <div className="z-20 shrink-0 border-t border-border bg-background/95 py-3.5 backdrop-blur supports-backdrop-filter:bg-background/80">
      <ContentContainer>{footer.content}</ContentContainer>
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
