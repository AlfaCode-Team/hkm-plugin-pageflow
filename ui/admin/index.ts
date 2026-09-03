/**
 * `@pageflow/admin` — the admin foundation.
 *
 * The shell, the navigation registry and the domain-free building blocks every
 * admin page needs, so a plugin ships PAGES and nothing else.
 *
 * ```tsx
 * import { AdminLayout, useSetPageHeader, ResourceListShell } from "@pageflow/admin";
 *
 * export default function Properties() {
 *   useSetPageHeader({ title: "Properties" });
 *   return <ResourceListShell …>{rows}</ResourceListShell>;
 * }
 * Properties.layout = (page: ReactNode) => <AdminLayout>{page}</AdminLayout>;
 * ```
 *
 * Nothing in `@pageflow/core` or `@pageflow/react` imports this entry point, so
 * an API-only or headless deployment never pulls the shell into its bundle.
 *
 * It depends on the PROJECT for three aliases the frontend template provides:
 * `@ui/*` (shadcn kit), `@lib/utils` (`cn`) and `@providers/theme`.
 */

export * from "./nav";
export * from "./shell";
export * from "./data";
export * from "./forms";
export * from "./hooks";
