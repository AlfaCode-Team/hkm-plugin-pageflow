import type { ModuleSection } from "../nav/types";
import type { PageCrumb } from "./PageHeader";

/**
 * Where the breadcrumb trail is decided.
 *
 * It is a SEPARATE, dependency-free module on purpose: the derivation is the
 * part with rules in it, and `DashboardHeader` cannot be executed outside a
 * React tree with a Pageflow page object under it. Here it is a pure function
 * of its arguments, so `shell/__checks__/crumbs.mjs` runs the real thing and
 * asserts the real output.
 */

export interface Crumb {
  label: string;
  /** Absent on a level that is not itself a page, and on the current page. */
  path?: string;
}

/** True when `ancestor` is `path` or one of its parents. */
function covers(ancestor: string, path: string): boolean {
  const base = ancestor.endsWith("/") ? ancestor.slice(0, -1) : ancestor;
  return path === base || path.startsWith(base + "/");
}

/**
 * The nav-registry chain down to `path` — section item, then the matching
 * child — outermost first.
 *
 * Deepest match wins, so `/businesses/{id}/branches` resolves to the
 * `/businesses` item rather than to a shallower one that also prefixes it
 * (the overview at "/" prefixes everything). The registry describes two
 * levels, which is why a page deeper than that declares its own chain and
 * this is only the fallback.
 */
export function registryTrail(path: string, sections: ModuleSection[]): Crumb[] {
  // Two plain locals rather than one `{…} | null`: `take` closes over them, and
  // TypeScript does not track assignments made inside a closure — a nullable
  // accumulator read after the loop narrows to `null` and stops compiling.
  let deepest: Crumb[] = [];
  let depth = -1;

  const take = (crumbs: Crumb[], length: number) => {
    if (length > depth) {
      deepest = crumbs;
      depth = length;
    }
  };

  for (const section of sections) {
    for (const item of section.items) {
      for (const child of item.children ?? []) {
        // A child sharing its item's path is an ACTIVE-MATCHING ALIAS, not a
        // level: the convention for keeping a row lit on its own detail pages
        // is a `hidden` child pointing at the item's own path. Treating it as
        // a level made `/businesses` read "Business" — the alias's label, in
        // the singular, because it was found first at the same depth.
        if (child.path === item.path) continue;
        if (!covers(child.path, path)) continue;

        // The owning item is a real level even when its path does not prefix
        // the child's — the sidebar nests them, so the trail must too.
        take(
          [
            { label: item.label, path: item.path },
            { label: child.label, path: child.path },
          ],
          child.path.length,
        );
      }

      if (covers(item.path, path)) {
        take([{ label: item.label, path: item.path }], item.path.length);
      }
    }
  }

  return deepest;
}

/** Last resort: turn "/editions/abc123" into "Abc123" so a crumb never shows
    a raw path or goes blank while nothing else has an opinion yet. */
export function fallbackLabel(path: string): string {
  const last = path.split("/").filter(Boolean).pop();
  if (!last) return "Home";
  return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface CrumbsFor {
  currentPath: string;
  homePath: string;
  sections: ModuleSection[];
  /** `PageHeaderState.crumbs`, when the page declared one. */
  declared?: PageCrumb[];
  /** `PageHeaderState.title`, preferred over any static label. */
  title?: string;
}

/**
 * This page's trail, derived from WHERE IT IS — never from where the user has
 * been. See the note on `DashboardHeader` for what that replaced and why.
 */
export function crumbsFor({
  currentPath,
  homePath,
  sections,
  declared,
  title,
}: CrumbsFor): Crumb[] {
  // Home is the trail when you are on it, and it is not a link to itself.
  if (currentPath === homePath) return [{ label: "Home" }];

  const home: Crumb = { label: "Home", path: homePath };

  // A page that declares its own chain owns it completely, current page
  // included — it is the only thing that knows the entity's name, and
  // appending a live title under it would just repeat the last crumb.
  if (declared && declared.length > 0) {
    return [
      home,
      ...declared
        .filter((crumb) => crumb.href !== homePath)
        .map((crumb) => ({ label: crumb.label, path: crumb.href })),
    ];
  }

  const trail = registryTrail(currentPath, sections).filter((c) => c.path !== homePath);
  const deepest = trail[trail.length - 1];

  // The registry stopped at an ancestor, so this page is its own last crumb.
  if (deepest?.path !== currentPath) {
    return [home, ...trail, { label: title || fallbackLabel(currentPath) }];
  }

  // The registry named this exact page. Prefer the page's live title, which may
  // carry an entity name no static route table knows.
  return [home, ...trail.slice(0, -1), { label: title || deepest.label }];
}
