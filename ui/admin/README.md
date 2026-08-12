# `@pageflow/admin` — the admin foundation

The shell, the navigation registry and the domain-free building blocks every
admin page needs, so a **plugin ships pages and nothing else**.

It is a separate entry point from `@pageflow/core` (transport) and
`@pageflow/react` (bindings). Nothing in those imports this, so an API-only or
headless deployment never pulls the shell into its bundle.

```
ui/admin/
├─ nav/      module + feature registry, settings-tab registry, icon registry
├─ shell/    AdminLayout, AuthLayout, sidebar, header, page-header bars
├─ data/     DataTable, ResourceListShell, useResourceList, TableQuery, KPI cards
├─ forms/    FieldHelp, TagInput, SuggestionSelect
└─ hooks/    useMediaQuery, usePageflowErrors, useDebouncedAutosave, useApi
```

> `AppErrorBoundary` is re-exported here for convenience but **lives in
> `@pageflow/react`**. It is dependency-free, and every surface — public
> included — wants one; importing it from the admin entry would drag
> framer-motion and the whole shadcn shell into a marketing bundle.

## What the project must provide

Three aliases, all supplied by the frontend template
(`tools/src/templates/frontend`):

| Alias | Provides |
|---|---|
| `@ui/*` | the shadcn kit (`button`, `table`, `sheet`, `sonner`, …) |
| `@lib/utils` | `cn` |
| `@providers/theme` | `useTheme` → `{ theme, resolvedTheme, setTheme, toggle }` |

…plus the sidebar tokens in `src/shared/styles/theme.css`
(`--sidebar-bg`, `--sidebar-fg*`, `--sidebar-border`, `--sidebar-hover`,
`--sidebar-active`, `--sidebar-section`, `--sidebar-width`, the `--nav-row-*`
metrics and `.sidebar-transition`). A plugin cannot ship the CSS variables its
own components depend on and still be overridable per project, so they live
there. **Restyle freely; keep the names.**

---

## 1. Attaching the layout

Use Pageflow's **persistent layout**, never a wrapper around the page's return:

```tsx
import type { ReactNode } from "react";
import { AdminLayout, useSetPageHeader } from "@pageflow/admin";

export default function Properties() {
  useSetPageHeader({ title: "Properties", actions: [{ label: "Add", onClick: open }] });
  return <ResourceListShell …>{rows}</ResourceListShell>;
}

Properties.layout = (page: ReactNode) => <AdminLayout>{page}</AdminLayout>;
```

`react/App.tsx` applies `Component.layout` **outside** the swapped page, so the
shell instance survives navigation — sidebar scroll, open menus and the overflow
calculation are all preserved. Wrapping inline instead remounts the whole sidebar
on every click.

`AdminLayout` takes **no data props**. Everything it needs comes from the
`adminShell` shared prop, so a page never threads shell state down.

Options worth knowing:

```tsx
<AdminLayout
  providers={[MapProvider]}                 // context providers, outermost first
  headerActions={<GlobalSearch />}          // right of the top bar
  sidebarHeader={<ConnectedOrgSwitcher />}  // above the nav (default: <OrgSwitcher/>)
  sidebarFooter={<StorageMeter />}          // between the nav and the user row
  onNotifications={openPanel}               // omit to hide the bell entirely
  onHelp={openDocs}                         // omit to hide the help button
  clock={false}
/>
```

The sidebar slots are named `sidebar*` deliberately: plain `header`/`footer`
would read as the PAGE header and footer, which are `useSetPageHeader` and
`useSetPageFooter`'s job, not the layout's.

`AuthLayout` is the nav-free equivalent for login / register / consent pages.

---

## 2. The `adminShell` shared prop

Share it once, server-side, and every page gets it:

```php
pageflow_share('adminShell', [
    'user' => [
        'id'          => $identity->userId,
        'displayName' => $identity->fullName ?: $identity->username,
        'email'       => $identity->email,
        'avatarUrl'   => $identity->avatarUrl,
    ],
    'tenant'   => $tenant,      // ?['id','name','logoUrl','meta']
    'tenants'  => $memberships, // switchable tenants; <2 hides the switcher
    'features' => $ctx?->features ?? [],   // proj.json features[]
    'logoutUrl'   => '/auth/logout',
    'accountUrl'  => '/account/profile',
    'settingsUrl' => '/admin/settings',
    'appName'     => env('APP_NAME'),
]);
```

Every field is optional at runtime: a surface that shares nothing still renders
a shell (guest user row, empty nav) instead of crashing. Read it with
`useAdminShell()`, which returns the resolved, non-optional `AdminShellState`.

---

## 3. Contributing navigation

A plugin declares its own nav in `ui/admin/nav.ts`. The admin surface globs
`/plugins/*/admin/nav.ts`, so the registry never names a business domain:

```ts
// plugins/hkm-plugin-rental/ui/admin/nav.ts
import { Building2, Wrench } from "lucide-react";
import { registerModule, registerFeature, registerIcons } from "@pageflow/admin";

registerIcons({ Building2, Wrench });       // only if you use the string form

registerFeature({
  id: "rental",
  label: "Rental management",
  description: "Properties, tenants, leases and maintenance",
});

registerModule({
  id: "rental",
  sectionLabel: "Rental",
  order: 40,
  features: ["rental"],                     // whole section hidden when off
  items: [
    {
      id: "properties",
      label: "Properties",
      icon: Building2,                      // or "Building2"
      path: "/admin/rental/properties",
      parentPath: "/admin/rental/properties",
      children: [
        { id: "properties-all",    label: "All",  path: "/admin/rental/properties" },
        { id: "properties-create", label: "Add",  path: "/admin/rental/properties/create" },
        { id: "properties-edit",   label: "Edit", path: "/admin/rental/properties/edit", hidden: true },
      ],
    },
    { id: "maintenance", label: "Maintenance", icon: Wrench, path: "/admin/rental/maintenance" },
  ],
});
```

Ordering convention: `<10` overview, `10–89` domains, `>=90` system.

**Feature gating** comes from the server — `proj.json` `features[]` →
`DomainContext->features` → `adminShell.features`. Strings enable; the object
form re-badges:

```jsonc
{ "features": ["rental", { "id": "reporting", "badge": { "label": "Beta", "variant": "beta" } }] }
```

A flag matching no registered module, item or feature logs a console warning
naming it — a silently-inert flag has cost real debugging time before.

**`hidden: true`** children participate in active-path matching but are not
rendered, which is how an `/edit` route highlights its parent.

**Active-item matching** is longest-prefix across items *and* children, with
`parentPath` scoping, so `/admin/rental/properties/create` highlights "Add"
rather than "Properties".

**Overflow.** The sidebar fits as many rows as the viewport allows and pushes the
rest into a "More" popover, recalculated on resize and after
`document.fonts.ready`. Row heights come from the `--nav-row-*` CSS variables, so
restyling the sidebar and correcting the arithmetic happen in the same file.

---

## 4. Contributing a settings tab

Same shape, different registry — so the Settings plugin never imports from Mail,
Tenancy, OAuth2 and Auth just to render their panels:

```ts
import { registerSettingsTab } from "@pageflow/admin";

registerSettingsTab({
  id: "email",
  label: "Email",
  group: "Communication",
  order: 30,
  feature: "mail",
  component: EmailSettingsPanel,   // (props: SettingsTabProps) => JSX
});
```

The settings page reads them with `selectSettingsTabs(features)` and owns
dirty-tracking and saving; a tab only reports changes through `onChange`.

---

## 5. Page header and footer

The contribution seam between a page and the chrome. The page declares, the
layout places, neither imports the other:

```tsx
useSetPageHeader({ title, description, actions }, [deps]);   // clears on unmount
useSetPageFooter({ content: <BulkActionBar /> }, [selected]); // sticky bottom bar
```

`actions` is either `PageHeaderAction[]` (rendered as buttons, last one primary)
or arbitrary JSX.

---

## 6. Lists and tables

**`ResourceListShell`** — the chrome a list page shares: stat strip, search +
create toolbar, status chips, empty state, pagination. The table body stays with
the page, because the columns are the one part that genuinely differs.

```tsx
const list = useResourceList({
  initial: props.rows,
  getId: (r) => r.id,
  searchFields: (r) => [r.name, r.reference],
  getStatus: (r) => r.status,
});

<ResourceListShell
  stats={[{ label: "Active", value: list.counts.active ?? 0, icon: Building2 }]}
  search={list.search} onSearchChange={list.setSearch}
  searchPlaceholder="Search properties…"
  createLabel="Add property" onCreate={open}
  filters={{ options: STATUS, value: list.status, onChange: list.setStatus, counts: list.counts }}
  empty={{ icon: Building2, title: "No properties yet", description: "…" }}
  isEmpty={list.filtered.length === 0}
  page={list.page} totalPages={list.totalPages} totalResults={list.filtered.length}
  onPageChange={list.setPage}
>
  <SimpleTable columns={COLUMNS}>{list.paginated.map(renderRow)}</SimpleTable>
</ResourceListShell>
```

**`DataTable`** — the batteries-included alternative: sorting, column filters,
row-action menu with delete confirmation, and a server-side mode
(`serverSide` + `onFetchData`, search debounced) for datasets too large to hold.

Both default row identity to `item.id`; pass `getId` for anything else.

`useResourceList` **adopts server-sent rows** when `initial` changes
(`syncOnPropChange`, default true). That default is not cosmetic:
`router.post/put/patch` all default to `preserveState: true`, so the page
component is not remounted after a mutation — a plain `useState(initial)` would
keep serving the rows captured on first mount, and a
`router.reload({ only: ['rows'] })` would appear to do nothing. Turn it off only
when the page deliberately owns the list and must keep optimistic edits.

**`resourceRequest`** — one mutation with the outcome reported honestly. It
handles both shapes a Sentinel endpoint can answer with (a populated `errors`
bag, or the `{ error: { code, message, fields } }` envelope as a prop) so no call
site has to know which.

**`TableQuery`** — immutable server-side query state (`setPage`, `setFilter`,
`toggleSort`, `toParams`). Every mutator returns a new instance, so it is safe to
hold in React state.

---

## 7. Everything exported

| Group | Exports |
|---|---|
| nav | `registerModule` `unregisterModule` `registerFeature` `enableFeature` `disableFeature` `setEnabledFeatures` `isFeatureEnabled` `getAllFeatures` `getEnabledFeatures` `getModules` `getNavSections` `selectNavSections` `getFlatRoutes` `selectFlatRoutes` `registerIcons` `getIcon` `resolveIcon` `registeredIconNames` `registerSettingsTab` `selectSettingsTabs` `getSettingsTabs` |
| shell | `AdminLayout` `AuthLayout` `SidebarContent` `SidebarNav` `DashboardHeader` `OrgSwitcher` `ThemeToggle` `PageChromeProvider` `PageHeaderBar` `PageFooterBar` `HeaderActions` `usePageHeader` `usePageFooter` `useSetPageHeader` `useSetPageFooter` `useAdminShell` `useCurrentPath` — plus `AppErrorBoundary`, re-exported from `@pageflow/react` |
| data | `DataTable` `ResourceListShell` `StatStrip` `FilterChips` `Pagination` `pageWindow` `EmptyState` `SimpleTable` `useResourceList` `resourceRequest` `copyToClipboard` `KpiCard` `DetailDrawer` `DrawerSection` `DrawerField` `TableQuery` |
| forms | `FieldHelp` `TagInput` `SuggestionSelect` |
| hooks | `useMediaQuery` `useIsMobile` `useIsTablet` `useIsDesktop` `usePrefersReducedMotion` `usePageflowErrors` `useDebouncedAutosave` `useApi` |

### A note on `usePageflowErrors`

The layouts mount it for you. By default it toasts **transport failures only**
(network down, 5xx) and stays silent on validation errors, because a 422 travels
two paths at once: `core/http/response.ts` fires the global `error` event AND
the visit's `onError`, which is what `useForm`/`<Form>` use to put a message
under each field. Toasting as well would double-report every failed form
submission in the application. Pass `validationToasts: true` on a surface whose
mutations go through bare `router.post` calls, where nothing else renders them.

---

## 8. Rules

```
✓ Attach the shell with Page.layout — never wrap the page's own return.
✓ Read shell data with useAdminShell(); never thread page.props through the chrome.
✓ Contribute nav from your own ui/admin/nav.ts; the registry must not name your domain.
✓ Inject a provider your pages need via <AdminLayout providers={[…]}> — not by editing the shell.
✓ Derive the current path from usePage()/useCurrentPath, never window.location.
✗ Importing another plugin's UI to render inside a shared page — register into the seam instead.
✗ Setting <Head title> on a page — the tab title is server-driven via the `seoHead` prop.
✗ Hard-coding a domain icon into nav/icons.ts — call registerIcons() from your plugin.
✗ Assuming a primary key is named `$id` — pass getId.
```
