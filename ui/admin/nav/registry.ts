import type {
  AppModule,
  Feature,
  FeatureInput,
  FlatRoute,
  ModuleSection,
  NavBadge,
} from "./types";

/**
 * The admin nav registry.
 *
 * A plugin contributes navigation by calling `registerModule()` from its
 * `ui/admin/nav.ts`; the admin surface imports every plugin's file with a glob,
 * so this file knows nothing about any business domain. (HKM 0.3 inverted this:
 * a `modules/index.ts` side-effect-imported all fourteen domain definitions, so
 * the foundation named every domain and a new one meant editing the shell.)
 *
 * Registration is import-time and idempotent by id — a module registered twice
 * replaces itself rather than appearing twice.
 */

const modules = new Map<string, AppModule>();
const featureRegistry = new Map<string, Feature>();

/** Enabled features → runtime badge override (undefined = use the default). */
const enabledFeatures = new Map<string, NavBadge | undefined>();

// ─── Registration ─────────────────────────────────────────────────────────────

const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

/**
 * Register a module. Call at import time from a plugin's `ui/admin/nav.ts`.
 *
 * Registration is by id, so re-registering REPLACES — which is what lets a
 * project override a plugin's section from its own `nav/` file (globbed last).
 * That same behaviour makes an accidental id collision between two plugins
 * invisible: one section simply never appears. The platform hard-fails a boot
 * when two plugins claim the same route; the nav cannot fail a boot, so it says
 * so instead.
 */
export function registerModule(mod: AppModule): void {
  if (isDev && modules.has(mod.id)) {
    const previous = modules.get(mod.id)!;
    if (previous.sectionLabel !== mod.sectionLabel) {
      console.warn(
        `[pageflow/admin] nav module id "${mod.id}" was registered twice ` +
          `("${previous.sectionLabel}" → "${mod.sectionLabel}"). The later one wins. ` +
          `If that was not a deliberate project override, give one of them a unique id.`,
      );
    }
  }
  modules.set(mod.id, mod);
}

export function unregisterModule(id: string): void {
  modules.delete(id);
}

/** Register a feature definition so it appears in listings and can carry a default badge. */
export function registerFeature(feature: Feature): void {
  featureRegistry.set(feature.id, feature);
}

// ─── Enabled set ──────────────────────────────────────────────────────────────

export function enableFeature(input: FeatureInput): void {
  if (typeof input === "string") enabledFeatures.set(input, undefined);
  else enabledFeatures.set(input.id, input.badge);
}

export function disableFeature(id: string): void {
  enabledFeatures.delete(id);
}

/**
 * Replace the whole enabled set.
 *
 * Badge resolution, first match wins:
 *   1. the item's own `badge`
 *   2. a runtime badge keyed by the ITEM id (lets the server re-badge one item)
 *   3. a runtime badge keyed by the item's `feature`
 *   4. the registered feature's default `badge`
 */
export function setEnabledFeatures(inputs: FeatureInput[]): void {
  enabledFeatures.clear();
  for (const input of inputs) {
    if (typeof input === "string") enabledFeatures.set(input, undefined);
    else enabledFeatures.set(input.id, input.badge);
  }
  warnAboutUnmatchedFeatures();
}

export function isFeatureEnabled(id: string): boolean {
  return enabledFeatures.has(id);
}

export function getAllFeatures(): Feature[] {
  return Array.from(featureRegistry.values());
}

/** Enabled features with the active badge merged in. */
export function getEnabledFeatures(): (Feature & { activeBadge?: NavBadge })[] {
  return Array.from(enabledFeatures.entries()).map(([id, runtimeBadge]) => {
    const registered = featureRegistry.get(id) ?? { id, label: id };
    return { ...registered, activeBadge: runtimeBadge ?? registered.badge };
  });
}

/**
 * A deployment enables features in `proj.json`; if nothing consumes an id the
 * flag silently does nothing — no nav item, no error, no log. That has cost real
 * time before (a project declared five flags whose modules were not registered).
 * Say so instead.
 *
 * An id is legitimate when it names a registered feature, gates a module or
 * item, or names an item — the server also uses the features array to re-badge
 * an individual item by id.
 */
/**
 * Warned-about flag sets, so the message appears once per distinct set rather
 * than on every render. `selectNavSections` runs `setEnabledFeatures` during
 * render, and BOTH the sidebar and the header call it — without this the warning
 * repeats several times per navigation and becomes noise nobody reads.
 */
const warnedFeatureSets = new Set<string>();

function warnAboutUnmatchedFeatures(): void {
  if (enabledFeatures.size === 0) return;

  const known = new Set<string>(featureRegistry.keys());

  for (const mod of modules.values()) {
    known.add(mod.id);
    mod.features?.forEach((f) => known.add(f));
    for (const item of mod.items ?? []) {
      known.add(item.id);
      if (item.feature) known.add(item.feature);
      for (const child of item.children ?? []) {
        known.add(child.id);
        if (child.feature) known.add(child.feature);
      }
    }
  }

  const orphans = Array.from(enabledFeatures.keys()).filter((id) => !known.has(id));
  if (orphans.length === 0) return;

  const key = orphans.join("|");
  if (warnedFeatureSets.has(key)) return;
  warnedFeatureSets.add(key);

  console.warn(
    `[pageflow/admin] ${orphans.length} feature flag(s) match no registered ` +
      `module, item or feature and will have no effect: ${orphans.join(", ")}. ` +
      `Either the owning plugin is disabled, or the flag is misspelled in proj.json.`,
  );
}

// ─── Reading ──────────────────────────────────────────────────────────────────

function itemVisible(feature?: string): boolean {
  return feature === undefined || enabledFeatures.has(feature);
}

function resolvedBadge(
  itemBadge: NavBadge | undefined,
  feature: string | undefined,
  itemId: string,
): NavBadge | undefined {
  if (itemBadge) return itemBadge;
  const byItemId = enabledFeatures.get(itemId);
  if (byItemId) return byItemId;
  if (!feature) return undefined;
  return enabledFeatures.get(feature) ?? featureRegistry.get(feature)?.badge;
}

/** Enabled modules, sorted by `order`, with module-level feature gates applied. */
export function getModules(): AppModule[] {
  return Array.from(modules.values())
    .filter((m) => m.enabled !== false)
    .filter((m) => !m.features || m.features.every((f) => enabledFeatures.has(f)))
    .sort((a, b) => a.order - b.order);
}

/**
 * Sidebar sections for the CURRENTLY enabled features. Items and children whose
 * feature is off are dropped; a section left with no items disappears entirely.
 */
export function getNavSections(): ModuleSection[] {
  const sections: ModuleSection[] = [];

  for (const mod of getModules()) {
    const items = mod.items
      .filter((item) => itemVisible(item.feature))
      .map((item) => ({
        ...item,
        badge: resolvedBadge(item.badge, item.feature, item.id),
        children: item.children
          ?.filter((child) => itemVisible(child.feature))
          .map((child) => ({
            ...child,
            badge: resolvedBadge(child.badge, child.feature, child.id),
          })),
      }));

    if (items.length > 0) sections.push({ label: mod.sectionLabel, items });
  }

  return sections;
}

/**
 * Run `read` with `inputs` applied, then restore the previous enabled set.
 *
 * `setEnabledFeatures()` writes module-level state, so calling it during React's
 * render phase is a side effect — unsafe under StrictMode's double-invoke and
 * under concurrent rendering, and doubly so because two components (the sidebar
 * and the header) both need the gated nav during the same render. The restore
 * lives HERE, once: an earlier revision had this try/finally copy-pasted into
 * each selector, which is exactly the shape where one gets fixed and the other
 * silently keeps leaking state.
 */
function withFeatures<T>(inputs: FeatureInput[], read: () => T): T {
  const previous: FeatureInput[] = Array.from(enabledFeatures.entries()).map(
    ([id, badge]) => (badge ? { id, badge } : id),
  );

  try {
    setEnabledFeatures(inputs);
    return read();
  } finally {
    enabledFeatures.clear();
    for (const input of previous) {
      if (typeof input === "string") enabledFeatures.set(input, undefined);
      else enabledFeatures.set(input.id, input.badge);
    }
  }
}

/** Pure variant of {@link getNavSections} — safe to call during render. */
export function selectNavSections(inputs: FeatureInput[]): ModuleSection[] {
  return withFeatures(inputs, getNavSections);
}

/** Flatten every visible route — for breadcrumbs and command palettes. */
export function getFlatRoutes(): FlatRoute[] {
  const routes: FlatRoute[] = [];

  for (const mod of getModules()) {
    for (const item of mod.items) {
      if (!itemVisible(item.feature)) continue;

      if (item.component) {
        routes.push({ path: item.path, component: item.component, label: item.label });
      }

      for (const child of item.children ?? []) {
        if (!itemVisible(child.feature)) continue;
        if (child.component) {
          routes.push({
            path: child.path,
            component: child.component,
            parentLabel: item.label,
            label: child.label,
          });
        }
      }
    }
  }

  return routes;
}

/** Pure variant of {@link getFlatRoutes} — safe to call during render. */
export function selectFlatRoutes(inputs: FeatureInput[]): FlatRoute[] {
  return withFeatures(inputs, getFlatRoutes);
}

/** Test helper. Never call from application code. */
export function __resetRegistry(): void {
  modules.clear();
  featureRegistry.clear();
  enabledFeatures.clear();
  warnedFeatureSets.clear();
}
