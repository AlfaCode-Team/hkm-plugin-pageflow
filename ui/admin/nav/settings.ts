import type { ComponentType } from "react";
import type { FeatureInput } from "./types";

/**
 * Settings-tab registry.
 *
 * A settings screen is the one place where several plugins genuinely want to
 * render into ONE page: company info belongs to Settings, email to Mail, domains
 * to Tenancy, OAuth clients to OAuth2, sessions to Auth. HKM 0.3 solved this by
 * having a single 623-line `Settings.tsx` import panels from five different
 * places — which, transplanted onto plugins, would mean the Settings plugin
 * importing from five others. GDA forbids that between PHP modules and there is
 * no reason to allow it between their UIs.
 *
 * So the seam is the same shape as the nav registry: each plugin declares its
 * tab from its own `ui/admin/nav.ts`, and whichever page renders the settings
 * screen reads them back.
 *
 * ```ts
 * registerSettingsTab({
 *   id: "email",
 *   label: "Email",
 *   group: "Communication",
 *   order: 30,
 *   feature: "mail",
 *   component: EmailSettingsPanel,
 * });
 * ```
 */
export interface SettingsTab {
  /** Unique across all plugins. Convention: the plugin slug, or `slug.section`. */
  id: string;
  label: string;
  description?: string;
  /** Optional heading to group tabs under in the rail. */
  group?: string;
  /** Lower first. Reserve <20 for general/identity, >80 for danger-zone tabs. */
  order: number;
  /** Visible only while this feature is enabled. */
  feature?: string;
  /**
   * Extra search terms for the settings page's filter.
   *
   * A settings page grows past the point where anyone remembers which tab holds
   * a field — "DKIM" lives under Email, "basis points" under Voting — and a
   * label alone does not say so. These are matched alongside the label,
   * description and group, so a field is findable without knowing its tab.
   *
   * Write what a person would actually type, including the words the UI does
   * NOT use: "smtp", "spf", "2fa", "webhook", "retention".
   */
  keywords?: string[];
  /** Icon component or a name registered via `registerIcons()`. */
  icon?: ComponentType | string;
  /**
   * The panel. It receives whatever the settings page passes as `value` plus an
   * `onChange` — deliberately loose, because what a tab edits is the owning
   * plugin's business, not the registry's.
   */
  component: ComponentType<SettingsTabProps>;
}

export interface SettingsTabProps {
  /** The settings object the page is editing. */
  value: Record<string, unknown>;
  /** Report a change; the page owns dirty-tracking and saving. */
  onChange: (patch: Record<string, unknown>) => void;
  /** True while a save is in flight. */
  saving?: boolean;
}

const tabs = new Map<string, SettingsTab>();

const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

/**
 * Register a settings tab. Import-time, and by id — so re-registering REPLACES,
 * which is how a project overrides a plugin's panel. The same behaviour hides an
 * accidental collision between two plugins, so say so (see the equivalent note
 * on `registerModule`).
 */
export function registerSettingsTab(tab: SettingsTab): void {
  if (isDev && tabs.has(tab.id)) {
    const previous = tabs.get(tab.id)!;
    if (previous.label !== tab.label) {
      console.warn(
        `[pageflow/admin] settings tab id "${tab.id}" was registered twice ` +
          `("${previous.label}" → "${tab.label}"). The later one wins. Namespace ` +
          `the id with your plugin slug (e.g. "mail.smtp") if this was not deliberate.`,
      );
    }
  }
  tabs.set(tab.id, tab);
}

export function unregisterSettingsTab(id: string): void {
  tabs.delete(id);
}

/**
 * Tabs visible for the given enabled-feature set, ordered.
 *
 * Pure — it takes the feature list rather than reading shared mutable state, so
 * it is safe to call during render (same reasoning as `selectNavSections`).
 */
export function selectSettingsTabs(features: FeatureInput[]): SettingsTab[] {
  const enabled = new Set(
    features.map((f) => (typeof f === "string" ? f : f.id)),
  );

  return Array.from(tabs.values())
    .filter((tab) => tab.feature === undefined || enabled.has(tab.feature))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/** Every registered tab, ungated. */
export function getSettingsTabs(): SettingsTab[] {
  return Array.from(tabs.values()).sort((a, b) => a.order - b.order);
}

/** Test helper. Never call from application code. */
export function __resetSettingsTabs(): void {
  tabs.clear();
}
