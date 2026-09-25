/**
 * Runs the REAL `crumbsFor` and asserts the trail it produces.
 *
 * Not a vitest suite: `ui/` has no test runner of its own, and the point of
 * putting the derivation in a dependency-free module was that plain node can
 * execute it — `crumbs.ts` is imported directly and node strips the types
 * (node 22.6+ with `--experimental-strip-types`, unflagged from 23).
 *
 *   node shell/__checks__/crumbs.mjs
 *
 * The fixtures are the hkm vendor console's own nav (frontend/src/surfaces/
 * admin/nav.ts) — including the `hidden` alias child that made `/businesses`
 * read "Business", which is the regression this file exists to hold.
 */
import { crumbsFor } from "../crumbs.ts";

// ── The console's own sidebar, verbatim in the shape the registry yields ────
const sections = [
  {
    label: "Platform",
    items: [
      { id: "overview", label: "Overview", path: "/" },
      {
        id: "businesses",
        label: "Businesses",
        path: "/businesses",
        // The alias: same path as its item, present only to keep the row lit.
        children: [{ id: "businesses-show", label: "Business", path: "/businesses", hidden: true }],
      },
      {
        id: "applications",
        label: "Signup queue",
        path: "/applications",
        children: [
          { id: "applications-show", label: "Application", path: "/applications", hidden: true },
        ],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "licences", label: "Licences", path: "/licences" },
      { id: "sessions", label: "Sessions & devices", path: "/sessions" },
    ],
  },
];

const HOME = "/";

/** What the four business pages declare — see `useBusinessHeader`. */
function businessCrumbs(name, id, section) {
  const head = [
    { label: "Businesses", href: "/businesses" },
    { label: name, href: section === "overview" ? undefined : `/businesses/${id}` },
  ];
  const label = { branches: "Branches", team: "Team", manage: "Manage" };
  return section === "overview" ? head : [...head, { label: label[section] }];
}

/** "Home > Businesses > Acme[link] > Branches" — link-ness is part of the claim. */
const render = (crumbs) =>
  crumbs.map((c) => (c.path === undefined ? c.label : `${c.label}[${c.path}]`)).join(" > ");

let failures = 0;
function check(what, got, want) {
  const line = render(got);
  if (line === want) {
    console.log(`  ok   ${what}\n       ${line}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${what}\n       want ${want}\n       got  ${line}`);
  }
}

console.log("breadcrumbs are a hierarchy, not a history\n");

check(
  "home is its own trail, and is not a link to itself",
  crumbsFor({ currentPath: "/", homePath: HOME, sections, title: "Overview" }),
  "Home",
);

check(
  "a list page the registry knows",
  crumbsFor({ currentPath: "/businesses", homePath: HOME, sections, title: "Businesses" }),
  "Home[/] > Businesses",
);

check(
  "the hidden alias child does not become a level (it read 'Business' before)",
  crumbsFor({ currentPath: "/businesses", homePath: HOME, sections }),
  "Home[/] > Businesses",
);

check(
  "a detail page the registry cannot name falls back to the live title",
  crumbsFor({ currentPath: "/applications/APP-N4LC32", homePath: HOME, sections, title: "Kampala Savings" }),
  "Home[/] > Signup queue[/applications] > Kampala Savings",
);

check(
  "a detail page with no title yet does not show a raw path",
  crumbsFor({ currentPath: "/applications/APP-N4LC32", homePath: HOME, sections }),
  "Home[/] > Signup queue[/applications] > APP N4LC32",
);

check(
  "one business, overview — its own name is the page, so not a link",
  crumbsFor({
    currentPath: "/businesses/b_ACME",
    homePath: HOME,
    sections,
    title: "Acme Ltd",
    declared: businessCrumbs("Acme Ltd", "b_ACME", "overview"),
  }),
  "Home[/] > Businesses[/businesses] > Acme Ltd",
);

for (const section of ["branches", "team", "manage"]) {
  check(
    `one business, ${section} — the section is the last crumb, the name links up`,
    crumbsFor({
      currentPath: `/businesses/b_ACME/${section}`,
      homePath: HOME,
      sections,
      title: "Acme Ltd",
      declared: businessCrumbs("Acme Ltd", "b_ACME", section),
    }),
    `Home[/] > Businesses[/businesses] > Acme Ltd[/businesses/b_ACME] > ${
      section[0].toUpperCase() + section.slice(1)
    }`,
  );
}

// The two failures that motivated the rewrite. A history trail would carry the
// PREVIOUS page into these; a hierarchy cannot, because it never sees one.
check(
  "an unrelated sidebar page is never nested under the page before it",
  crumbsFor({ currentPath: "/sessions", homePath: HOME, sections, title: "Sessions & devices" }),
  "Home[/] > Sessions & devices",
);

check(
  "the trail is the same however you arrived (same input, same output)",
  crumbsFor({
    currentPath: "/businesses/b_ACME/team",
    homePath: HOME,
    sections,
    title: "Acme Ltd",
    declared: businessCrumbs("Acme Ltd", "b_ACME", "team"),
  }),
  "Home[/] > Businesses[/businesses] > Acme Ltd[/businesses/b_ACME] > Team",
);

check(
  "a page under nothing the registry knows still gets Home and itself",
  crumbsFor({ currentPath: "/nowhere/at/all", homePath: HOME, sections, title: "Somewhere" }),
  "Home[/] > Somewhere",
);

console.log(
  failures === 0 ? "\nall trails correct" : `\n${failures} trail(s) wrong`,
);
process.exit(failures === 0 ? 0 : 1);
