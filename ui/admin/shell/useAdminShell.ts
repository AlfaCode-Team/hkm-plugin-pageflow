import { useMemo } from "react";
import { usePage } from "@pageflow/react";
import type {
  AdminShellProps,
  AdminShellTenant,
  AdminShellUser,
} from "./types";
import type { FeatureInput } from "../nav/types";

const GUEST: AdminShellUser & { displayName: string } = { id: "", displayName: "Guest" };

/**
 * The shell contract with every optional field resolved.
 *
 * Deliberately NOT `Partial` — the whole value of reading the shared prop in one
 * place is that the twelve components downstream never have to null-check it.
 */
export interface AdminShellState {
  user: AdminShellUser & { displayName: string };
  tenant: AdminShellTenant | null;
  tenants: AdminShellTenant[];
  features: FeatureInput[];
  homePath: string;
  logoutUrl: string;
  accountUrl: string;
  settingsUrl: string;
  notificationCount: number;
  appName: string;
}

/**
 * Read the `adminShell` shared prop, normalised and never undefined.
 *
 * Pages do NOT pass this down — the shell reads it off the page itself. That is
 * the whole point: a plugin page says `Page.layout = (p) => <AdminLayout>{p}</AdminLayout>`
 * and never touches shell data.
 */
export function useAdminShell(): AdminShellState {
  const page = usePage<{ adminShell?: AdminShellProps; [key: string]: unknown }>();
  const shell = page.props?.adminShell;

  // Both are arrays the server re-sends on every page object, so they are a NEW
  // reference each navigation even when unchanged. Key on content: `features`
  // because it drives the nav memo downstream, `tenants` because keying on
  // `.length` (an earlier revision) missed a rename or a swapped membership —
  // the list count stays 2 while the names change.
  const featuresKey = JSON.stringify(shell?.features ?? []);
  const tenantsKey = JSON.stringify(shell?.tenants ?? []);

  return useMemo((): AdminShellState => {
    const user: AdminShellState["user"] = shell?.user
      ? {
          ...shell.user,
          displayName:
            shell.user.displayName?.trim() ||
            shell.user.email?.split("@")[0] ||
            "Account",
        }
      : GUEST;

    return {
      user,
      tenant: shell?.tenant ?? null,
      tenants: shell?.tenants ?? [],
      features: shell?.features ?? [],
      homePath: shell?.homePath ?? "/admin",
      logoutUrl: shell?.logoutUrl ?? "/auth/logout",
      accountUrl: shell?.accountUrl ?? "/account/profile",
      settingsUrl: shell?.settingsUrl ?? "/admin/settings",
      notificationCount: shell?.notificationCount ?? 0,
      appName: shell?.appName ?? "Admin",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    featuresKey,
    tenantsKey,
    shell?.user?.id,
    shell?.user?.displayName,
    shell?.user?.email,
    shell?.user?.avatarUrl,
    shell?.tenant?.id,
    shell?.tenant?.name,
    shell?.homePath,
    shell?.logoutUrl,
    shell?.accountUrl,
    shell?.settingsUrl,
    shell?.notificationCount,
    shell?.appName,
  ]);
}

/**
 * The current pathname, from Pageflow's page state rather than
 * `window.location`.
 *
 * `window.location.pathname` is read once during render and never updates, so
 * anything derived from it goes stale after a client-side navigation. 0.3 fixed
 * this in the sidebar and missed it in the header, which is exactly why it lives
 * in one place now.
 */
export function useCurrentPath(): string {
  const page = usePage<Record<string, unknown>>();

  return useMemo(() => {
    try {
      return new URL(
        page.url,
        typeof window === "undefined" ? "http://localhost" : window.location.origin,
      ).pathname;
    } catch {
      return typeof window === "undefined" ? "/" : window.location.pathname;
    }
  }, [page.url]);
}
