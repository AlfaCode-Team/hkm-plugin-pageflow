import type { ElementType } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  Calendar,
  ChevronRight,
  CircleHelp,
  Database,
  FileText,
  Folder,
  Gauge,
  Globe,
  Image,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Mail,
  MapPin,
  Package,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Users,
} from "lucide-react";

/**
 * Icon registry — ADDITIVE, so the foundation never has to name a domain.
 *
 * A nav item may pass an icon component directly (`icon: Package`) or a NAME
 * (`icon: "package"`). The name form keeps a plugin's nav definition free of a
 * direct lucide import and lets a project swap an icon without editing plugin
 * code.
 *
 * The base set below is deliberately small — only icons the SHELL itself uses
 * plus a few generic ones. A plugin registers whatever else it needs from its
 * own `ui/admin/nav.ts`:
 *
 * ```ts
 * import { Truck, Warehouse } from "lucide-react";
 * import { registerIcons } from "@pageflow/admin";
 * registerIcons({ Truck, Warehouse });
 * ```
 *
 * Only what is imported somewhere survives tree-shaking, so an app that enables
 * three plugins ships three plugins' worth of icons — not all of lucide.
 */
const registry: Record<string, ElementType> = {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  Calendar,
  ChevronRight,
  CircleHelp,
  Database,
  FileText,
  Folder,
  Gauge,
  Globe,
  Image,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Mail,
  MapPin,
  Package,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Users,
};

/** Add icons to the registry. Later registrations win, so a project can override. */
export function registerIcons(icons: Record<string, ElementType>): void {
  for (const [name, component] of Object.entries(icons)) {
    registry[toPascal(name)] = component;
  }
}

/** Look up an icon by name. Accepts "Package", "package" or "power-off". */
export function getIcon(name: string): ElementType | undefined {
  return registry[toPascal(name)];
}

export function registeredIconNames(): string[] {
  return Object.keys(registry).sort();
}

const warnedMissing = new Set<string>();

/**
 * Resolve a nav item's `icon` field, which is either a component or a name.
 *
 * Falls back to `Folder` so an unregistered name degrades to a visible row
 * rather than crashing the sidebar — but says so once in dev, because a silent
 * fallback looks identical to "someone chose a folder icon" and is otherwise
 * only findable by eye.
 */
export function resolveIcon(icon: ElementType | string | undefined): ElementType {
  if (!icon) return Folder;
  if (typeof icon !== "string") return icon;

  const resolved = registry[toPascal(icon)];
  if (resolved) return resolved;

  if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV && !warnedMissing.has(icon)) {
    warnedMissing.add(icon);
    console.warn(
      `[pageflow/admin] icon "${icon}" is not registered — showing a folder. ` +
        `Call registerIcons({ ${toPascal(icon)} }) from your plugin's ui/admin/nav.ts, ` +
        `or pass the component directly as \`icon\`.`,
    );
  }
  return Folder;
}

function toPascal(name: string): string {
  if (!name.includes("-") && !name.includes("_")) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
