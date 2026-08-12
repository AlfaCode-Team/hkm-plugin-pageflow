import type { ComponentType, ElementType, LazyExoticComponent } from "react";

/** Badge displayed next to a nav item. */
export interface NavBadge {
  label: string;
  variant: "new" | "paid" | "beta" | "soon";
}

/**
 * A named feature flag. A plugin registers the features it understands; the
 * deployment enables the ones it uses. Nav items tied to a disabled feature are
 * hidden — they are never rendered and never routed to.
 *
 * The enabled set comes from the SERVER: `proj.json` `features[]` →
 * `DomainContext->features` → the reserved `adminShell.features` shared prop.
 */
export interface Feature {
  /** Unique feature ID (e.g. "catalog", "travel"). */
  id: string;
  /** Human-readable label shown in feature listings. */
  label: string;
  description?: string;
  /**
   * Default badge applied to every nav item gated by this feature when the item
   * sets none of its own. Overridable per item, or at enable time via
   * `{ id, badge }`.
   */
  badge?: NavBadge;
}

/**
 * Accepted by `setEnabledFeatures` / `enableFeature`. A plain string enables
 * without a badge; the object form attaches a runtime badge that overrides the
 * feature's registered default.
 *
 * @example
 * setEnabledFeatures([
 *   "catalog",
 *   { id: "reporting", badge: { label: "Beta", variant: "beta" } },
 * ]);
 */
export type FeatureInput = string | { id: string; badge?: NavBadge };

/** A child route within a nav item. */
export interface ModuleChild {
  id: string;
  label: string;
  /** Absolute path (e.g. "/admin/products/brands"). */
  path: string;
  /** Base path that owns this child. Used for active matching. */
  parentPath?: string;
  badge?: NavBadge;
  /** When set, this child appears only while the named feature is enabled. */
  feature?: string;
  /** Participates in active-path matching but is not rendered in the sidebar. */
  hidden?: boolean;
  /** Optional component, for consumers building a client-side route table. */
  component?: ComponentType | LazyExoticComponent<ComponentType>;
}

/** A single navigable item in the sidebar. */
export interface ModuleNavItem {
  id: string;
  label: string;
  /**
   * Row icon. Pass a component (`Package` from lucide-react) or a NAME
   * registered via `registerIcons()` — the name form keeps a plugin's nav
   * definition free of a direct lucide import.
   */
  icon: ElementType | string;
  /** Absolute path (e.g. "/admin/products"). */
  path: string;
  /** Base path that owns this item. Used for active matching. */
  parentPath?: string;
  badge?: NavBadge;
  /** When set, this item and its children appear only while the feature is on. */
  feature?: string;
  children?: ModuleChild[];
  component?: ComponentType | LazyExoticComponent<ComponentType>;
}

/** A section in the sidebar (e.g. "Overview", "Catalog"). */
export interface ModuleSection {
  label: string;
  items: ModuleNavItem[];
}

/**
 * A module definition — the unit of extension. ONE per plugin that contributes
 * admin navigation, declared in that plugin's `ui/admin/nav.ts`.
 */
export interface AppModule {
  /** Unique module ID. Convention: the plugin's slug (e.g. "catalog"). */
  id: string;
  /** Sidebar section heading. */
  sectionLabel: string;
  /** Display order — lower first. Reserve <10 for overview, >90 for system. */
  order: number;
  items: ModuleNavItem[];
  /** Default true. */
  enabled?: boolean;
  /** The whole module is visible only while ALL listed features are enabled. */
  features?: string[];
}

/** Flattened route, for breadcrumbs and command palettes. */
export interface FlatRoute {
  path: string;
  component?: ComponentType | LazyExoticComponent<ComponentType>;
  /** Parent item label, when this route came from a child. */
  parentLabel?: string;
  label: string;
}
