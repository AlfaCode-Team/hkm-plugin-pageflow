import type { FeatureInput } from "../nav/types";

/**
 * What the admin shell needs from the server, under the reserved `adminShell`
 * shared prop.
 *
 * HKM 0.3 threaded `page.props` through the shell as `any` and had the sidebar
 * reach into `props.projects.current.features` — one project's data model
 * hard-coded into the chrome. This is that contract written down, so the shell
 * depends on a shape rather than on a project.
 *
 * Share it once, server-side, and every page gets it:
 *
 * ```php
 * pageflow_share('adminShell', [
 *     'user'     => [
 *         'id'          => $identity->userId,
 *         'displayName' => $identity->fullName ?: $identity->username,
 *         'email'       => $identity->email,
 *         'avatarUrl'   => $identity->avatarUrl,
 *     ],
 *     'tenant'   => $tenant,          // ?['id','name','logoUrl']
 *     'tenants'  => $memberships,     // [['id','name','logoUrl']]
 *     'features' => $ctx?->features ?? [],
 * ]);
 * ```
 *
 * Every field is optional at runtime: a page rendered before login, or a surface
 * that shares nothing, still gets a shell — a guest user row and an empty nav —
 * instead of a crash.
 */
export interface AdminShellProps {
  user?: AdminShellUser;
  /** The tenant the request resolved to, when the app is multi-tenant. */
  tenant?: AdminShellTenant | null;
  /** Tenants this user may switch to. Empty or absent hides the switcher. */
  tenants?: AdminShellTenant[];
  /**
   * Enabled feature flags. Strings, or `{ id, badge }` to re-badge an item.
   * Source: `proj.json` `features[]` via `DomainContext->features`.
   */
  features?: FeatureInput[];
  /** Where the nav's "home" crumb points. Default `/admin`. */
  homePath?: string;
  /** POST target for the sidebar's log-out action. Default `/auth/logout`. */
  logoutUrl?: string;
  /** Link target for the sidebar's account action. Default `/account/profile`. */
  accountUrl?: string;
  /** Link target for the sidebar's settings action. Default `/admin/settings`. */
  settingsUrl?: string;
  /** Unread notification count shown on the bell. */
  notificationCount?: number;
  /** Product/brand name shown when no tenant is resolved. */
  appName?: string;
}

export interface AdminShellUser {
  id: string;
  /** Falls back to the email local-part, then "Account", when absent. */
  displayName?: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface AdminShellTenant {
  id: string;
  name: string;
  logoUrl?: string | null;
  /** Free-form label rendered beside the name (plan, role, status…). */
  meta?: string;
}
