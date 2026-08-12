import type { ReactNode } from "react";
import { Bell, CircleHelp, LogOut, Settings } from "lucide-react";
import { Link, router } from "@pageflow/react";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/avatar";
import { Separator } from "@ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@ui/popover";
import { cn } from "@lib/utils";
import { SidebarNav } from "./SidebarNav";
import { ThemeToggle } from "./ThemeToggle";
import { useAdminShell } from "./useAdminShell";

/** Hide the middle of the local-part: `sha***@example.com`. */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  if (name.length <= 4) return `${name}***@${domain}`;
  return `${name.slice(0, 4)}***@${domain}`;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export interface SidebarContentProps {
  /** Rendered above the nav — normally the connected `<OrgSwitcher>`. */
  header?: ReactNode;
  /** Rendered between the nav and the user row. */
  footer?: ReactNode;
  /** Opens a notification panel. Omit to hide the bell. */
  onNotifications?: () => void;
  /** Opens help. Omit to hide the button. */
  onHelp?: () => void;
}

const ICON_BUTTON =
  "flex items-center justify-center rounded-md p-2 text-sidebar-fg-muted hover:bg-sidebar-hover hover:text-sidebar-fg-active sidebar-transition";

/**
 * Sidebar body: header slot, navigation, user footer.
 *
 * Every action here is WIRED. In 0.3 the notification, help and — most
 * importantly — log-out buttons were `<button>` elements with no handler, so the
 * only way out of the admin was to clear a cookie by hand.
 */
export function SidebarContent({
  header,
  footer,
  onNotifications,
  onHelp,
}: SidebarContentProps) {
  const { user, accountUrl, settingsUrl, logoutUrl, notificationCount } = useAdminShell();

  // POST, not a link: log-out is a state change, and a GET is CSRF-reachable
  // from any page that can embed an image. Pageflow attaches the CSRF token.
  const logout = () => router.post(logoutUrl);

  return (
    <>
      {header && (
        <div className="shrink-0 border-b border-sidebar-border p-3">{header}</div>
      )}

      <SidebarNav />

      {footer}

      <div className="shrink-0 space-y-2 border-t border-sidebar-border p-3">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-sidebar-hover sidebar-transition"
            >
              <Avatar className="h-8 w-8 shrink-0">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                  {initials(user.displayName ?? "")}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-sidebar-fg-active">
                  {user.displayName}
                </span>
                {user.email && (
                  <span className="block truncate text-xs text-sidebar-fg-muted">
                    {maskEmail(user.email)}
                  </span>
                )}
              </span>
            </button>
          </PopoverTrigger>

          <PopoverContent
            side="top"
            align="start"
            sideOffset={8}
            className="z-100 w-56 rounded-lg border border-border bg-popover p-1.5 shadow-xl"
          >
            <div className="px-2 py-2">
              <p className="truncate text-sm font-medium text-foreground">{user.displayName}</p>
              {user.email && (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>
            <Separator className="my-1" />
            <Link
              href={accountUrl}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-popover-foreground transition-colors hover:bg-muted"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span>Account settings</span>
            </Link>
            {onNotifications && (
              <button
                type="button"
                onClick={onNotifications}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-popover-foreground transition-colors hover:bg-muted"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                <span>Notifications</span>
              </button>
            )}
            {onHelp && (
              <button
                type="button"
                onClick={onHelp}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-popover-foreground transition-colors hover:bg-muted"
              >
                <CircleHelp className="h-4 w-4" aria-hidden="true" />
                <span>Help &amp; support</span>
              </button>
            )}
            <Separator className="my-1" />
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Log out</span>
            </button>
          </PopoverContent>
        </Popover>

        <Separator className="bg-sidebar-border" />

        <div className="flex items-center justify-between">
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-0.5">
              <ThemeToggle />

              {onNotifications && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onNotifications}
                      aria-label={
                        notificationCount
                          ? `Notifications (${notificationCount} unread)`
                          : "Notifications"
                      }
                      className={cn(ICON_BUTTON, "relative")}
                    >
                      <Bell className="h-4 w-4" aria-hidden="true" />
                      {!!notificationCount && (
                        <span className="absolute right-1 top-1 flex h-1.5 w-1.5 rounded-full bg-destructive" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Notifications
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={settingsUrl} aria-label="Settings" className={ICON_BUTTON}>
                    <Settings className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Settings
                </TooltipContent>
              </Tooltip>

              {onHelp && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onHelp}
                      aria-label="Help and support"
                      className={ICON_BUTTON}
                    >
                      <CircleHelp className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Help &amp; support
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={logout}
                  aria-label="Log out"
                  className={cn(ICON_BUTTON, "hover:text-destructive")}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Log out
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  );
}
