import { createElement, useState, type ComponentType, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sheet, SheetContent, SheetTitle } from "@ui/sheet";
import { Toaster } from "@ui/sonner";
import { useIsMobile } from "../hooks/useMediaQuery";
import { usePageflowErrors } from "../hooks/usePageflowErrors";
import { DashboardHeader } from "./Header";
import { PageChromeProvider, PageFooterBar, PageHeaderBar } from "./PageHeader";
import { SidebarContent } from "./Sidebar";
import { ContentContainer, ContentWidthProvider, type ContentWidth } from "./content";
import { OrgSwitcher } from "./OrgSwitcher";

export interface AdminLayoutProps {
  children: ReactNode;
  /**
   * Context providers wrapped around the whole shell, OUTERMOST FIRST.
   *
   * This is how a plugin injects a provider its own pages need — a map SDK, a
   * query client, a websocket — without the shell importing it. 0.3 hard-wired
   * `MapProvider` into this file, so every admin app in every project paid a
   * Google-Maps dependency to render a sidebar.
   *
   * ```tsx
   * Page.layout = (page) => (
   *   <AdminLayout providers={[MapProvider]}>{page}</AdminLayout>
   * );
   * ```
   */
  providers?: ComponentType<{ children: ReactNode }>[];
  /** Rendered on the right of the top bar. */
  headerActions?: ReactNode;
  /** Show the live clock in the top bar. Default true. */
  clock?: boolean;
  /** Start with the desktop sidebar open. Default true. */
  defaultSidebarOpen?: boolean;
  /** Toast position. Default "top-center". */
  toastPosition?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
  /**
   * How wide the centred content column may get. Default `"default"` (max-w-7xl).
   *
   * `"full"` restores edge-to-edge content for a page that genuinely needs the
   * whole viewport — a wide table, a board, a map. It applies to the page
   * header and footer bars too, so those keep lining up with the content.
   */
  contentWidth?: ContentWidth;

  // ── Sidebar slots ───────────────────────────────────────────────────────────
  // Named `sidebar*` on purpose. An earlier revision inherited `header`/`footer`
  // from SidebarContentProps, which read as the PAGE header and footer — the two
  // things `useSetPageHeader`/`useSetPageFooter` own — and meant two prop names
  // for one slot.

  /** Above the nav. Default: a read-only `<OrgSwitcher>`. */
  sidebarHeader?: ReactNode;
  /** Between the nav and the user row. */
  sidebarFooter?: ReactNode;
  /** Opens a notification panel. Omit to hide the bell entirely. */
  onNotifications?: () => void;
  /** Opens help. Omit to hide the button. */
  onHelp?: () => void;
}

const sidebarVariants = {
  open: {
    width: "var(--sidebar-width)",
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  closed: {
    width: 0,
    opacity: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

/**
 * The admin shell.
 *
 * Attach it as a PERSISTENT layout, not by wrapping the page's own return:
 *
 * ```tsx
 * export default function Properties() { … }
 * Properties.layout = (page: ReactNode) => <AdminLayout>{page}</AdminLayout>;
 * ```
 *
 * Pageflow applies `Component.layout` OUTSIDE the swapped page component
 * (`react/App.tsx`), so the shell instance survives navigation: sidebar scroll,
 * open menus and the overflow calculation are all preserved. HKM 0.3 wrapped
 * inline in all 46 of its pages, which remounted the entire sidebar on every
 * click.
 *
 * It takes no data props — everything it needs comes from the `adminShell`
 * shared prop (see `./types.ts`), so a page never threads shell state down.
 */
export function AdminLayout({
  children,
  providers,
  headerActions,
  clock = true,
  defaultSidebarOpen = true,
  toastPosition = "top-center",
  contentWidth = "default",
  sidebarHeader,
  sidebarFooter,
  onNotifications,
  onHelp,
}: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  // Surfaces validation/visit errors as toasts, ignoring any that belong to a
  // visit the user has already navigated away from.
  usePageflowErrors();

  const sidebar = (
    <SidebarContent
      header={sidebarHeader ?? <OrgSwitcher />}
      footer={sidebarFooter}
      onNotifications={onNotifications}
      onHelp={onHelp}
    />
  );

  const shell = (
    <ContentWidthProvider width={contentWidth}>
    <PageChromeProvider>
      <div className="flex h-screen w-full overflow-hidden">
        {!isMobile && (
          <AnimatePresence initial={false}>
            {sidebarOpen && (
              <motion.aside
                key="sidebar"
                variants={sidebarVariants}
                initial="closed"
                animate="open"
                exit="closed"
                className="flex h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar-bg"
              >
                <div className="flex h-full w-[var(--sidebar-width)] flex-col">{sidebar}</div>
              </motion.aside>
            )}
          </AnimatePresence>
        )}

        {isMobile && (
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent
              side="left"
              className="w-[var(--sidebar-width)] border-sidebar-border bg-sidebar-bg p-0 [&>button]:text-sidebar-fg-muted"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-full flex-col">{sidebar}</div>
            </SheetContent>
          </Sheet>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-10 shrink-0">
            <DashboardHeader
              sidebarOpen={sidebarOpen}
              isMobile={isMobile}
              clock={clock}
              actions={headerActions}
              onToggleSidebar={() =>
                isMobile ? setMobileOpen((o) => !o) : setSidebarOpen((o) => !o)
              }
            />
            <PageHeaderBar />
          </div>

          {/*
            The scroll container. It MUST be overflow-y-auto: the shell root is
            `h-screen overflow-hidden` so the sidebar can stay put, which means
            nothing below it scrolls unless a descendant opts in. With
            `overflow-hidden` here any page taller than the viewport was simply
            CLIPPED — no scrollbar, no indication, the rest of the form just did
            not exist. min-h-0 is what lets a flex child shrink below its content
            height; without it the container grows and the clipping returns.
          */}
          {/*
            The horizontal padding lives on the CONTAINER, not here, so `main`,
            the page header bar and the page footer bar share one column and one
            padding value. It used to be `px-2 pl-6` — 24px on the left, 8px on
            the right — which nothing lined up with, including itself.
          */}
          <main className="min-h-0 flex-1 overflow-y-auto py-6">
            <ContentContainer>{children}</ContentContainer>
          </main>

          <PageFooterBar />
          <Toaster position={toastPosition} />
        </div>
      </div>
    </PageChromeProvider>
    </ContentWidthProvider>
  );

  // Outermost first, so `providers={[A, B]}` renders <A><B>{shell}</B></A>.
  return (providers ?? []).reduceRight(
    (acc, Provider) => createElement(Provider, null, acc),
    shell,
  );
}

export default AdminLayout;
