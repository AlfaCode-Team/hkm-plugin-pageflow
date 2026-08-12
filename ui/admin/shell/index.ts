export { AdminLayout, default as AdminLayoutDefault } from "./AdminLayout";
export type { AdminLayoutProps } from "./AdminLayout";

export { AuthLayout } from "./AuthLayout";
export type { AuthLayoutProps } from "./AuthLayout";

export { SidebarContent } from "./Sidebar";
export type { SidebarContentProps } from "./Sidebar";

export { SidebarNav } from "./SidebarNav";
export { DashboardHeader } from "./Header";
export type { DashboardHeaderProps } from "./Header";

export { OrgSwitcher } from "./OrgSwitcher";
export type { OrgSwitcherProps } from "./OrgSwitcher";

export { ThemeToggle } from "./ThemeToggle";

// Re-exported for convenience. It LIVES in @pageflow/react because it is
// dependency-free and every surface — public included — wants one; import it
// from there when you are not already pulling in the admin shell.
export { AppErrorBoundary } from "@pageflow/react";

export {
  PageChromeProvider,
  PageHeaderBar,
  PageFooterBar,
  PageHeaderContext,
  PageFooterContext,
  HeaderActions,
  usePageHeader,
  usePageFooter,
  useSetPageHeader,
  useSetPageFooter,
} from "./PageHeader";
export type {
  PageHeaderAction,
  PageHeaderState,
  PageFooterState,
} from "./PageHeader";

export { useAdminShell, useCurrentPath } from "./useAdminShell";
export type { AdminShellState } from "./useAdminShell";
export type { AdminShellProps, AdminShellTenant, AdminShellUser } from "./types";
