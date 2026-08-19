# Pageflow — Plugin Context for Claude

> Plugin for the **AlfacodeTeam PhpServicePlatform** (Sentinel) kernel.
> Package `alfacode-team/hkm-plugin-pageflow` · namespace `Plugins\Pageflow\` · solves `http.pageflow`
>
> This file is the rule set for THIS repository. It is self-contained for
> day-to-day work; the kernel-wide contracts it builds on are linked at the
> bottom. This is NOT Laravel, NOT Symfony, NOT Slim — do not suggest those
> frameworks' patterns, classes or conventions.

---

## WORKING RULES — VERSION CONTROL (ABSOLUTE)

**NEVER run `git commit`, `git push`, `git tag`, or `gh release` / `gh pr`
unless the user explicitly asks for it in that message.**

Write the changes, run the tests, report what changed — and stop. The user
decides when work is committed, pushed, tagged or released.

This matters more here than in an application repo. This plugin is a **published
package**: every project that requires it consumes what you push. A pushed tag is
immutable on Packagist and cannot be reused, so a premature release is not an
`undo`, it is a new version plus an explanation.

When the work is done, say what is uncommitted and let the user choose.

---

## WORKING RULES — VERIFICATION (READ THE DEFINITION)

**Before calling something you did not write, open its definition.** Not a call
site elsewhere — the definition.

This is not caution for its own sake; it is the measured failure mode of this
codebase. A review of ~5,600 lines of freshly written code found **15 defects**
that `php -l`, PHPStan and `tsc --noEmit` all passed. Every one was a coherent
but false belief about something the code called — a trait method that lived in a
different trait, a link pointing at a POST-only route, a framework default
assumed from the shape of an API rather than read from its source.

```
✓ Trait method   → find the trait that DECLARES it (traits compose; the obvious one is often wrong)
✓ Signature      → read it; argument order and names are not inferable
✓ Route          → read module.json for its METHOD, path, filters[] and requires[]
✓ env() key      → confirm it is in THIS module.json config[], or the boot fails
✓ Kernel API     → read the kernel source, not the shape of the call site
✓ Sibling plugin → read that plugin's API/Contracts/, never its internals
✓ A default that is a URL → someone will click it; confirm it resolves
```

State plainly what you did NOT verify. "Static analysis is clean" is a weak claim
here and must never be presented as evidence the code works. Code that has never
run against a real request has not been tested — say so in those words.

---

## WHAT THIS PLUGIN IS

| | |
|---|---|
| `solves` | `http.pageflow` |
| `requires` | `vite.manifest` |
| `exposes` | `PageflowResponder`, `PageflowChannel` |
| `emits` | — |
| Activation | on-demand — a consumer declares it in `requires[]` |
| Namespace | `Plugins\Pageflow\` |
| Version | `1.2.0` |
| Routes | 2 declared in `module.json` |
| UI | alias `@pageflow`, surfaces — |

---

## `module.json` IS THE SINGLE SOURCE OF TRUTH

Routes, jobs, commands, views, emitted events and every environment variable this
plugin reads are declared in `module.json`. The kernel compiles them at boot.

```
✗ Declaring a route in a PHP file — routes exist ONLY in module.json
✗ Reading an env var that is not in config[] — ValidateConfigStage fails the boot
✗ Naming a requires[] entry that is not some module's solves domain — fails the boot
✗ Putting a port or contract CLASS name in requires[] — module DOMAINS only
✗ Dispatching an event whose name is not in emits[] — nothing is subscribed to it
```

`config[]` is also what `hkm plugins enable pageflow` seeds into the project's
`.env`, so a declared `default` is the value the operator actually receives.
Three shapes, and the difference is load-bearing:

| Declaration | Written to `.env` as | Why |
|---|---|---|
| has `default` | `KEY=value` (active) | the documented default, working out of the box |
| `required`, no default | `KEY=` (active, empty) | `''` counts as MISSING, so the boot still fails loudly until a real secret is supplied |
| optional, no default | `# KEY=` (commented) | `''` is a VALUE and would silently beat this plugin's own internal default |

### Environment variables (`config[]`)

| Key | Type | Required | Default |
|---|---|---|---|
| `PAGEFLOW_VERSION` | string | no | — |
| `PAGEFLOW_ROOT_VIEW` | string | no | — |
| `PAGEFLOW_APP_ID` | string | no | — |
| `PAGEFLOW_CSRF_COOKIE` | string | no | — |
| `PAGEFLOW_CSRF_LIFETIME` | int | no | — |
| `PAGEFLOW_STREAM_INTERVAL` | int | no | — |
| `PAGEFLOW_STREAM_MAX_SECONDS` | int | no | — |
| `PAGEFLOW_PRECOGNITION_ROLLBACK` | bool | no | — |

---

## THE FIVE ACCESS RULES — ABSOLUTE — RUNTIME ENFORCED

```
Controller  →  Service      (published contract interface ONLY)
Service     →  Repository  AND  Gateway   (the ONLY layer calling both)
Repository  →  DatabasePort ONLY          (no HTTP, no vendor SDK)
Gateway     →  Vendor SDK ONLY            (no DB, no services)
Domain      →  NOTHING EXTERNAL           (zero imports outside Domain/)
```

`ModuleContainer::bindInternal()` enforces these at runtime — violations throw
`ScopeViolationException`. A `bindInternal` binding is unreachable from any other
module even when that module declares this one in `requires[]`; only the
contracts in `exposes[]` cross the boundary.

Layer rules that apply to every file in this repo:

- **Controllers are ≤3 lines** — DTO in, service call, `Response` out. No business logic.
- **Services own the transaction + event shape** — `collector->beginCollection()`,
  `transaction->begin()`, work, `commit()`; on `\Throwable` `rollback()` **and**
  `collector->discard()`. Integration events dispatch **only after** a successful
  commit, never inside the `try`.
- **Repositories translate `\PDOException`** into `RepositoryException`, and scope
  every query by tenant where the data is tenant-owned.
- **Gateways translate every vendor exception** into `GatewayException`. No vendor
  exception type escapes the gateway.
- **Domain has zero external imports** and never dispatches — entities buffer
  events and `releaseEvents()`.
- **Money is integer cents in a value object**, never a float.
- **No `static` mutable state in request-scoped classes** — it leaks between
  requests under OpenSwoole.
- **`hash_equals()` for every token/secret comparison**, never `===`.

---

## WHAT THIS PLUGIN IS

An Inertia-style SPA bridge: the server returns a **component name + props**, and
the client swaps the page. The PHP side lives here; the React client lives in
`ui/` and is **federated, not vendored** (`hkm ui sync` mirrors it into a
project's `frontend/plugins/<slug>/`).

`PageflowResponder::render($request, $component, $surface, $props = [],
$viteEntry = null, $loadPage = true, $cacheable = false)` returns a JSON page
object for `X-Pageflow` XHR navigations, or an HTML shell on first load. The
client boots from the root element's **`data-page`** attribute
(`PageflowPage::mount($appId)`) — **not** `window.initialPage`.

Partial reloads honour `X-Pageflow-Partial-*`. `PageflowVersionStage` returns
`409 + X-Pageflow-Location` on stale assets so a stale client hard-reloads.
Shared props via `pageflow_share('key', fn($request) => …)`.

## CSRF

The responder renders `<meta name="csrf-token">` into the HTML head, minted from
`APP_KEY` plus the session-cookie binding via `CsrfTokenLayer::make`. The client
reads it and sends `X-CSRF-Token` on mutations — **same-origin only**.
`GET /pageflow/csrf` (throttled) refreshes an expired token for long-lived tabs;
the axios interceptor auto-refreshes on a CSRF 403.

The token is deliberately **NOT** a shared prop, so it stays out of the JSON page
object and out of the service-worker cache.

> `PAGEFLOW_CSRF_COOKIE` **MUST** match the kernel `CsrfTokenLayer`'s
> `bindCookie`, and that cookie must be in Cookie's `encrypt_exempt`. Encryption
> rotates the ciphertext per response, which breaks the binding.

## VALIDATION & PRECOGNITION

`PageflowValidationStage` turns a kernel `ValidationException` into either a
`422 {errors}` (precognition) or a session-flashed **303 redirect-back** (normal
submit). Controllers just throw via their DTOs; the `errors` shared prop surfaces
them and `useForm` shows them. The 303 `Location` is reduced to a same-origin
path — no open redirect.

```
✗ Adding a global error toast on top of useForm's inline field errors — the
  client dispatches a 422 down BOTH paths, so every failed submission reports twice
✗ Assuming router.post remounts the page — it defaults to preserveState: true.
  useState(props.rows) then keeps a stale list after a mutation
```

## REACTIVE PROPS — STALE KEY NAMES, NEVER DATA

`PageflowChannel` (CachePort-backed): a Service calls
`$channel->touch("t:{$tenantId}:dashboard", ['orders'])` after commit. The
tenant-scoped `GET /pageflow/stream` SSE endpoint (auth-gated) pushes **stale key
names only — never data**; the client reacts with a normal authorized partial
reload, so authorization is re-applied on the reload. Reconnect-safe via SSE
`id:`/`Last-Event-ID`; bounded by `PAGEFLOW_STREAM_MAX_SECONDS`. Real push needs
OpenSwoole.

## AUTH PROJECTION AND OFFLINE

`pageflow_auth` shared prop exposes userId/tenant/roles/permissions — **never
tokens**. Client `useAuth()`/`<Can>` gate UI for UX only; the server stays the
authority. `useFlushOnIdentityChange()` purges prefetch + SW cache on
login/logout/tenant-switch.

Offline is opt-in: page objects are cached **only** when the server says so
(`render(..., cacheable: true)` → `X-Pageflow-Cache: 1`, or
`Cache-Control: public`). Authenticated pages are never cached by default;
`no-store`/`private` always win.

## `ui/` — THREE ENTRY POINTS

| Export | Contains |
|---|---|
| `@pageflow/core` | transport |
| `@pageflow/react` | React bindings — `<Link>`, `useForm`, `usePage`, `<Head>`, `<Form>`, `usePrecognition`, `useReactiveProps`, `useAuth`, `<Can>`, `useDirtyGuard`, `usePoll`, `usePrefetch`, `useRemember`, `Deferred`, `WhenVisible` |
| `@pageflow/admin` | the ADMIN FOUNDATION (below) |

`core` and `react` do **not** import `admin`, so a headless deploy never bundles
it. Keep it that way.

### `@pageflow/admin` — the shell, and the rules that keep it domain-free

`AdminLayout`/`AuthLayout`, the nav **module + feature registry** each plugin
contributes to from its own `ui/admin/nav.ts`, a settings-tab registry,
`DataTable`/`ResourceListShell`/`useResourceList`/`TableQuery`,
`KpiCard`/`DetailDrawer`, `FieldHelp`/`TagInput`/`SuggestionSelect`, and
`usePageflowErrors`/`useDebouncedAutosave`/`useMediaQuery`/`useApi`.

The shell reads the reserved **`adminShell`** shared prop (user, tenant(s),
`features` from `DomainContext`, logout/account/settings URLs) — pages never
thread shell state down.

```
✓ Attach chrome with `Page.layout = (p) => <AdminLayout>{p}</AdminLayout>` —
  Pageflow applies it OUTSIDE the swapped component, so the shell survives navigation
✓ Read shell data with useAdminShell(), never by threading page.props through the chrome
✓ Contribute nav/settings tabs from your OWN ui/admin/nav.ts, via the registries
✓ Inject a provider your pages need via <AdminLayout providers={[…]}>
✗ Wrapping a page's own return in <AdminLayout> — remounts the whole sidebar per click
✗ The foundation naming a business domain — a plugin registers itself; the registry
  never enumerates plugins
✗ Importing another plugin's UI to render inside a shared page — use the registry seam
✗ Deriving the current path from window.location — use usePage()/useCurrentPath()
✗ A shell component hard-coding a vendor SDK (maps, editors) — that is a plugin's job
```

CLI `pageflow:types` generates end-to-end `.d.ts`.

---

## TESTING — USE THE GROUND, NOT A HAND-ROLLED BOOTSTRAP

A plugin is not a library: it is declared in `module.json`, compiled by the boot
pipeline, loaded through a dependency graph and resolved in a scoped container.
Almost everything that goes wrong with one goes wrong in that machinery, so a
unit test of its service proves very little — and standing up a whole project to
find out is why plugins go untested.

```php
$ground = PluginGround::for(Provider::class, DependencyProvider::class)
    ->as(Identity::asAdmin('tenant-1'))
    ->env(['SOME_KEY' => 5])
    ->boot();

$ground->db()->onQuery('from things', ['id' => 1]);
$ground->get('/things')->status();                 // the real HttpPipeline
$ground->service(SomeServiceContract::class);      // resolved in this plugin's scope
$ground->events()->dispatched('thing.created');
$ground->destroy();                                // ALWAYS — restores $_ENV + Paths
```

Three behaviours that are easy to get wrong:

- **Security is OPEN by default.** `BindSecurityStage` refuses an empty layer list
  (fail-closed), so the ground installs an allow-all stand-in. Passing any layer to
  `security()` REPLACES it — which is what a test about auth wants.
- **Events are recorded from `emits[]` only.** `EventBus` is `final` with no
  wildcard, so an event dispatched under a name the manifest does not declare is
  never recorded. It reads as "nothing dispatched"; check the manifest first.
- **Required config with no default is filled with a PLACEHOLDER** so the boot
  proceeds. `placeholders()` lists them — anything asserted while one is in play is
  asserted against a stand-in.

`hkm plugin:check` runs the static GDA + UI checks the boot cannot catch and exits
non-zero, so it gates CI. `hkm plugin:probe` boots this plugin for real and
resolves `requires[]` transitively.

```
✗ Booting this plugin against a REAL project root in a test — the kernel writes
  compiled manifests under the active project, so it overwrites that project's
  route/service/config manifests and leaves them that way. The ground's temp
  workspace exists for exactly this.
✗ Leaking a ground (no destroy()) — $_ENV stays mutated and Paths points at a
  deleted directory; the symptom is an unrelated later test failing.
✗ Trusting a "route is protected" assertion while its filter is STUBBED —
  stubbedFilters() lists aliases that did NOT run (auth/throttle come from
  SecurityFilters; load it, or use ->realFilters(), when the filter is the subject).
```

---

## WHAT NEVER TO GENERATE IN THIS REPO

```
✗ git commit / push / tag, or gh pr / gh release, without being asked in that message
✗ Laravel / Symfony / Slim patterns, classes or conventions
✗ Eloquent, Doctrine, Active Record or any ORM — LetMigrate + DatabasePort only
✗ Routes defined in PHP — module.json is the only place
✗ Env vars read but not declared in module.json config[]
✗ Port or contract CLASS names in requires[] — module domains only
✗ Business logic in a Controller — max 3 lines: DTO → service → Response
✗ Integration events dispatched inside a try{} — ONLY after commit
✗ A catch block that rolls back without collector->discard() — phantom events
✗ Vendor exceptions (\PDOException, Stripe, Guzzle) escaping their layer
✗ Another plugin's internal class imported — use its published contract
✗ Authorization decisions in a SecurityLayer — those belong in the Service
✗ float for money — integer cents in a value object
✗ === for token comparison — always hash_equals()
✗ Static mutable state in request-scoped classes — leaks across Swoole requests
✗ Injecting Request or Response into a Service or Repository
✗ Hand-writing ON DUPLICATE KEY / ON CONFLICT — call $db->upsert() (driver-portable)
✗ Adding a kernel change to make this plugin work — the kernel stays domain-ignorant
```

---

## KERNEL REFERENCE

The kernel documents the contracts; this repo documents the plugin. When they
disagree, the code wins — read the definition.

| Topic | Guide |
|---|---|
| Architecture + request lifecycle | [00_SENTINEL_OVERVIEW](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/00_SENTINEL_OVERVIEW.md) |
| Kernel internals | [01_KERNEL](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/01_KERNEL.md) |
| Module contract + `module.json` | [02_MODULE](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/02_MODULE.md) |
| Domain layer | [03_DOMAIN](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/03_DOMAIN.md) |
| Service layer + transaction/event pattern | [04_SERVICE](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/04_SERVICE.md) |
| Repository layer | [05_REPOSITORY](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/05_REPOSITORY.md) |
| Gateway layer | [06_GATEWAY](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/06_GATEWAY.md) |
| Controllers + DTO validation | [07_CONTROLLER](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/07_CONTROLLER.md) |
| Events | [08_EVENTS](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/08_EVENTS.md) |
| SecurityGateway + Identity | [09_SECURITY](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/09_SECURITY.md) |
| Testing + port fakes | [10_TESTING](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/10_TESTING.md) |
| Workers + jobs | [12_WORKER](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/12_WORKER.md) |
| Antipatterns | [13_ANTIPATTERNS](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/13_ANTIPATTERNS.md) |
| Writing a plugin | [16_PLUGINS](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/16_PLUGINS.md) |
| Migrations (LetMigrate) | [18_MIGRATIONS](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/18_MIGRATIONS.md) |
| CSRF | [21_CSRF](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/21_CSRF.md) |
| Routing cookbook | [30_ROUTING_COOKBOOK](https://github.com/AlfaCode-Team/hkm-kernel/blob/main/docs/guides/30_ROUTING_COOKBOOK.md) |

Sibling plugins are separate repositories under
`github.com/AlfaCode-Team/hkm-plugin-<name>`. Depend on one through its
`exposes[]` contract and a `requires[]` domain — never by reaching into its tree.
