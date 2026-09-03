#!/usr/bin/env python3
"""
Build PAGEFLOW_ADMIN_GUIDE.pdf.

Content is authored as blocks below; this emits LaTeX and runs lualatex twice
(for the table of contents). Prose is escaped automatically and `backticks`
become inline code, so the author never hand-escapes LaTeX.
"""
import re
import subprocess
import sys
from pathlib import Path

OUT = "PAGEFLOW_ADMIN_GUIDE"

# ── escaping ──────────────────────────────────────────────────────────────────

_TEX = {
    "\\": r"\textbackslash{}", "{": r"\{", "}": r"\}", "$": r"\$",
    "&": r"\&", "#": r"\#", "^": r"\textasciicircum{}", "_": r"\_",
    "%": r"\%", "~": r"\textasciitilde{}",
}


def esc(s: str) -> str:
    # Paths are everywhere in this document and LaTeX will not break at a slash,
    # so a long one overflows the margin. Allow a break after each slash and
    # after a hyphen inside a slug. Only prose/tables/captions pass through here
    # — listings are verbatim and unaffected.
    out = "".join(_TEX.get(c, c) for c in s)
    out = out.replace("/", "/\\allowbreak{}")
    out = re.sub(r"(?<=[a-z])-(?=[a-z])", "-\\\\allowbreak{}", out)
    return out


def prose(s: str) -> str:
    """Escape prose, turning `x` into inline code and **x** into bold."""
    out, i = [], 0
    for m in re.finditer(r"`([^`]+)`|\*\*([^*]+)\*\*", s):
        out.append(esc(s[i:m.start()]))
        if m.group(1) is not None:
            out.append(r"\Code{%s}" % esc(m.group(1)))
        else:
            out.append(r"\textbf{%s}" % esc(m.group(2)))
        i = m.end()
    out.append(esc(s[i:]))
    return "".join(out)


# ── block helpers ─────────────────────────────────────────────────────────────

def H1(t):   return "\\needspace{5\\baselineskip}\n\\section{%s}\n" % prose(t)
def H2(t):   return "\\subsection{%s}\n" % prose(t)
def H3(t):   return "\\subsubsection{%s}\n" % prose(t)
def P(t):    return prose(" ".join(t.split())) + "\n\n"
def RAW(t):  return t + "\n"


def CODE(body, lang="none", caption=None):
    opts = "language=%s" % lang if lang != "none" else "language={}"
    if caption:
        opts += ",title={%s}" % esc(caption)
    return "\\begin{lstlisting}[%s]\n%s\n\\end{lstlisting}\n" % (opts, body.strip("\n"))


def BULLETS(items):
    body = "\n".join("  \\item %s" % prose(i) for i in items)
    return "\\begin{itemize}[leftmargin=1.2em,itemsep=2pt,topsep=3pt]\n%s\n\\end{itemize}\n" % body


def STEPS(items):
    body = "\n".join("  \\item %s" % prose(i) for i in items)
    return "\\begin{enumerate}[leftmargin=1.4em,itemsep=3pt,topsep=3pt]\n%s\n\\end{enumerate}\n" % body


def TABLE(headers, rows, spec=None):
    spec = spec or ("l" * len(headers))
    head = " & ".join("\\textbf{%s}" % prose(h) for h in headers)
    body = " \\\\\n".join(" & ".join(prose(c) for c in r) for r in rows)
    return (
        "\\begin{center}\\small\n\\begin{tabular}{%s}\n\\toprule\n%s \\\\\n"
        "\\midrule\n%s \\\\\n\\bottomrule\n\\end{tabular}\\end{center}\n"
        % (spec, head, body)
    )


def BOX(title, body, color="trap"):
    return ("\\begin{%sbox}{%s}\n%s\n\\end{%sbox}\n"
            % (color, prose(title), prose(" ".join(body.split())), color))


def BOXRAW(title, body, color="trap"):
    return "\\begin{%sbox}{%s}\n%s\n\\end{%sbox}\n" % (color, prose(title), body, color)


# ── preamble ──────────────────────────────────────────────────────────────────

PREAMBLE = r"""
\documentclass[11pt,a4paper]{article}

\usepackage{fontspec}
\setmainfont{DejaVu Sans}[Scale=0.94]
\setmonofont{Fira Code}[Scale=0.78]

\usepackage[margin=2.1cm,top=2.3cm,bottom=2.3cm]{geometry}
\usepackage{xcolor}
\usepackage{listings}
\usepackage{booktabs}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage{fancyhdr}
\usepackage[most]{tcolorbox}
\usepackage{tocloft}
\setlength{\cftsecnumwidth}{2.1em}
\setlength{\cftsubsecnumwidth}{2.9em}
\setlength{\cftsubsubsecnumwidth}{3.6em}
\setlength{\cftbeforesecskip}{4pt}
\usepackage{needspace}
\usepackage[hidelinks]{hyperref}

\definecolor{ink}{HTML}{1A1D21}
\definecolor{accent}{HTML}{2563EB}
\definecolor{muted}{HTML}{6B7280}
\definecolor{codebg}{HTML}{F6F7F9}
\definecolor{codeframe}{HTML}{E1E4E8}
\definecolor{kw}{HTML}{7C3AED}
\definecolor{str}{HTML}{047857}
\definecolor{cmt}{HTML}{6B7280}
\definecolor{trapc}{HTML}{B91C1C}
\definecolor{rulec}{HTML}{047857}
\definecolor{notec}{HTML}{2563EB}

\color{ink}

\titleformat{\section}{\Large\bfseries\color{accent}}{\thesection}{0.6em}{}
\titlespacing*{\section}{0pt}{0pt}{10pt}
\titleformat{\subsection}{\large\bfseries}{\thesubsection}{0.6em}{}
\titlespacing*{\subsection}{0pt}{14pt}{6pt}
\titleformat{\subsubsection}{\normalsize\bfseries\color{muted}}{}{0em}{}
\titlespacing*{\subsubsection}{0pt}{11pt}{4pt}

\pagestyle{fancy}\fancyhf{}
\renewcommand{\headrulewidth}{0.2pt}
\fancyhead[L]{\footnotesize\color{muted}@pageflow/admin --- extending plugins}
\fancyfoot[C]{\footnotesize\color{muted}\thepage}

\lstset{
  basicstyle=\ttfamily\footnotesize,
  backgroundcolor=\color{codebg},
  frame=single, framesep=5pt, rulecolor=\color{codeframe},
  xleftmargin=2pt, xrightmargin=2pt,
  breaklines=true, breakatwhitespace=false,
  showstringspaces=false, columns=fullflexible, keepspaces=true,
  keywordstyle=\color{kw}\bfseries,
  stringstyle=\color{str},
  commentstyle=\color{cmt}\itshape,
  aboveskip=8pt, belowskip=8pt,
  literate=
    {→}{{$\rightarrow$}}1 {✓}{{\color{rulec}\textbf{+}}}1 {✗}{{\color{trapc}\textbf{!}}}1
    {─}{{-}}1 {│}{{|}}1 {├}{{|}}1 {└}{{|}}1 {…}{{...}}1
    {á}{{\'a}}1 {é}{{\'e}}1 {ü}{{\"u}}1 {—}{{---}}1 {·}{{$\cdot$}}1
    {“}{{"}}1 {”}{{"}}1 {’}{{'}}1
}

\lstdefinelanguage{ts}{
  morekeywords={import,from,export,default,const,let,function,return,interface,type,
    if,else,await,async,new,class,extends,implements,void,null,undefined,true,false,as},
  morecomment=[l]{//}, morecomment=[s]{/*}{*/},
  morestring=[b]", morestring=[b]', morestring=[b]`,
}
\lstdefinelanguage{php}{
  morekeywords={public,private,protected,final,class,function,return,use,namespace,
    declare,strict_types,readonly,new,null,true,false,array,string,int,bool,match,if,foreach},
  sensitive=true, morecomment=[l]{//}, morecomment=[s]{/*}{*/},
  morestring=[b]', morestring=[b]",
}
\lstdefinelanguage{jsonc}{
  morestring=[b]", morecomment=[l]{//},
  morekeywords={true,false,null},
}

\newcommand{\Code}[1]{{\ttfamily\small\color{ink}#1}}

\newtcolorbox{trapbox}[1]{colback=trapc!4,colframe=trapc!55,
  fonttitle=\bfseries\small,title=#1,boxrule=0.5pt,left=6pt,right=6pt,top=4pt,bottom=4pt,
  before skip=8pt, after skip=8pt}
\newtcolorbox{rulebox}[1]{colback=rulec!4,colframe=rulec!55,
  fonttitle=\bfseries\small,title=#1,boxrule=0.5pt,left=6pt,right=6pt,top=4pt,bottom=4pt,
  before skip=8pt, after skip=8pt}
\newtcolorbox{notebox}[1]{colback=notec!4,colframe=notec!50,
  fonttitle=\bfseries\small,title=#1,boxrule=0.5pt,left=6pt,right=6pt,top=4pt,bottom=4pt,
  before skip=8pt, after skip=8pt}

\setlength{\parindent}{0pt}
\setlength{\parskip}{5pt}
\emergencystretch=2.5em

\begin{document}
"""

TITLE = r"""
\begin{titlepage}
\centering
\vspace*{3.2cm}
{\Huge\bfseries\color{accent} @pageflow/admin\par}
\vspace{0.7cm}
{\LARGE Building admin UI in your plugins\par}
\vspace{0.5cm}
{\large\color{muted} AlfacodeTeam PhpServicePlatform --- Sentinel\par}
\vspace{2.4cm}
\begin{minipage}{0.78\textwidth}\small\color{muted}
A practical guide to the admin foundation shipped by the Pageflow plugin:
the persistent shell, the navigation registry, the settings-tab seam, and the
list/table kit --- and how any other plugin plugs into them without the
foundation ever learning that plugin's name.

\vspace{0.5em}
Every example is a complete, working file. The traps are real defects that have
already been found in this codebase, not hypotheticals.
\end{minipage}
\vfill
{\footnotesize\color{muted}Reference: plugins/hkm-plugin-pageflow/ui/admin/README.md\par}
\end{titlepage}

\tableofcontents
\clearpage
"""

# ── content ───────────────────────────────────────────────────────────────────

D = []
A = D.append

# ============================================================ 1. Mental model
A(H1("The idea in one page"))

A(P("""A plugin owns a business domain. It should ship the PAGES for that domain
and nothing else --- no sidebar, no header, no table component, no pagination,
no empty-state illustration. All of that is `@pageflow/admin`, the admin
foundation shipped inside the Pageflow plugin."""))

A(P("""The hard part is the reverse direction. A sidebar has to know your plugin
exists in order to show a link to it. A settings screen has to render your
panel. If those relationships are written as imports, the foundation ends up
importing every business domain in the application --- which is exactly the
coupling this architecture forbids on the PHP side."""))

A(P("""So the direction is inverted. The foundation exposes REGISTRIES, your
plugin writes into them at import time, and the surface discovers your file with
a glob. Nothing in the foundation ever names your plugin."""))

A(CODE("""
plugins/hkm-plugin-rental/ui/
├─ ui.json                     alias "@rental", surfaces map
├─ index.ts                    barrel — shared bits other code may import
├─ admin/
│   ├─ nav.ts                  ← registers your sidebar section  (globbed)
│   └─ Pages/Rental/*.tsx      ← your admin pages                (globbed)
└─ site/Pages/Rental/*.tsx     ← your public pages               (globbed)

                    ▲ discovered, never imported by the foundation
""", caption="What a plugin ships"))

A(TABLE(
    ["You want to add…", "Mechanism", "Foundation import?"],
    [["a sidebar section", "registerModule() in ui/admin/nav.ts", "no — globbed"],
     ["an admin page", "admin/Pages/<Dir>/<Name>.tsx", "no — globbed"],
     ["a settings panel", "registerSettingsTab()", "no — globbed"],
     ["a context provider", "AdminLayout providers prop", "no — passed in"],
     ["a page title / actions", "useSetPageHeader()", "you import the hook"]],
    spec="lll"))

A(P("""The three aliases `@ui/*` (shadcn), `@lib/utils` and `@providers/theme`
come from the PROJECT, not from any plugin. Your plugin may use them; it must
not ship them."""))

A(BOX("The one rule that generates all the others",
      "A plugin never imports another plugin's UI in order to render inside a "
      "shared screen. If you feel the need to, the screen is missing a registry "
      "and you should add one.", "rule"))

# ============================================================ 2. Quick start
A(H1("Quick start: an admin page in one file"))

A(P("""This is a complete, working admin page contributed by a plugin. Nothing
else is needed for it to appear at `/admin/rental/properties` with the full
shell --- sidebar, header, breadcrumbs, toasts."""))

A(H2("The page"))
A(CODE("""
// plugins/hkm-plugin-rental/ui/admin/Pages/Rental/Properties.tsx
import type { ReactNode } from "react";
import { usePage } from "@pageflow/react";
import { AdminLayout, useSetPageHeader, DataTable, type Column } from "@pageflow/admin";

interface Property {
  id: string;
  reference: string;
  addressLine: string;
  status: "vacant" | "occupied" | "maintenance";
  monthlyRentCents: number;
}

interface Props extends Record<string, unknown> {
  properties: Property[];
}

const money = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "UGX" })
    .format(cents / 100);

export default function Properties() {
  const { props } = usePage<Props>();

  useSetPageHeader({
    title: "Properties",
    description: "Every unit in the portfolio",
  });

  const columns: Column<Property>[] = [
    { key: "reference",   header: "Ref",     sortable: true },
    { key: "addressLine", header: "Address", sortable: true },
    { key: "status",      header: "Status",  filterable: true,
      filterOptions: [
        { label: "Vacant",      value: "vacant" },
        { label: "Occupied",    value: "occupied" },
        { label: "Maintenance", value: "maintenance" },
      ] },
    { key: "monthlyRentCents", header: "Rent", className: "text-right",
      render: (p) => money(p.monthlyRentCents) },
  ];

  return (
    <div className="container py-6">
      <DataTable
        data={props.properties}
        columns={columns}
        searchKey={["reference", "addressLine"]}
        searchPlaceholder="Search by reference or address…"
        emptyMessage="No properties yet."
      />
    </div>
  );
}

// The shell. Applied OUTSIDE the page by Pageflow, so it survives navigation.
Properties.layout = (page: ReactNode) => <AdminLayout>{page}</AdminLayout>;
""", lang="ts"))

A(H2("The route"))
A(P("""In the plugin's `module.json`. The route-level `requires` pulls in
Pageflow for this route only --- the module itself need not depend on it."""))
A(CODE("""
{
  "routePrefix": "/admin/rental",
  "routes": [
    { "method": "GET", "path": "/properties",
      "handler": "Plugins\\\\Rental\\\\Infrastructure\\\\Http\\\\Controllers\\\\RentalPageController@properties",
      "name": "rental.properties",
      "filters": ["auth"],
      "requires": ["http.pageflow"] }
  ]
}
""", lang="jsonc"))

A(H2("The controller"))
A(CODE("""
<?php
declare(strict_types=1);

namespace Plugins\\Rental\\Infrastructure\\Http\\Controllers;

use AlfacodeTeam\\PhpServicePlatform\\Kernel\\Http\\Request;
use AlfacodeTeam\\PhpServicePlatform\\Kernel\\Http\\Response;
use Plugins\\Pageflow\\Http\\PageflowResponder;
use Plugins\\Rental\\API\\Contracts\\PropertyServiceContract;
use Project\\Http\\Controllers\\Concerns\\InteractsWithGraphSeo;

final class RentalPageController
{
    use InteractsWithGraphSeo;

    public function __construct(
        private readonly PageflowResponder $pageflow,
        private readonly PropertyServiceContract $properties,
    ) {
    }

    /** GET /admin/rental/properties -> component "Rental/Properties" */
    public function properties(Request $request): Response
    {
        return $this->pageflow->render($request, 'Rental/Properties', 'admin', [
            'properties' => array_map(
                static fn ($p) => $p->toArray(),
                $this->properties->all(),
            ),
            // Admin screens are never indexed: correct title + noindex, no graph.
            'seoHead' => $this->seoPrivate('Properties', request: $request),
        ]);
    }
}
""", lang="php"))

A(H2("Wire it up"))
A(CODE("""
hkm plugins enable rental
hkm ui sync                # mirrors ui/ into frontend/plugins/rental + aliases
cd frontend && npm run dev -- --mode admin
"""))

A(BOX("The file path is the component name",
      "admin/Pages/Rental/Properties.tsx becomes the key \"Rental/Properties\", "
      "which is exactly the string the controller renders. Rename the file and "
      "you must rename the string.", "note"))

# ============================================================ 3. Layout
A(H1("The layout"))

A(H2("Attach it, do not wrap with it"))

A(P("""This is the single most important convention in the whole foundation, and
the most common thing ported code gets wrong."""))

A(CODE("""
// ✓ CORRECT — a persistent layout
export default function Properties() {
  return <div>…</div>;
}
Properties.layout = (page: ReactNode) => <AdminLayout>{page}</AdminLayout>;


// ✗ WRONG — wrapping the page's own return
export default function Properties() {
  return (
    <AdminLayout>
      <div>…</div>
    </AdminLayout>
  );
}
""", lang="ts"))

A(P("""Pageflow applies `Component.layout` OUTSIDE the component it swaps
(`ui/react/App.tsx`). Because the layout element is created outside the swap,
React sees the same `AdminLayout` element type before and after a navigation and
preserves its state. Wrapping inline puts the layout INSIDE the swapped subtree,
so every navigation unmounts and remounts the entire sidebar."""))

A(P("What that costs, concretely, on every single click:"))
A(BULLETS([
    "the nav overflow calculation restarts from zero, so the sidebar visibly reflows",
    "any open submenu popover closes",
    "sidebar scroll position resets to the top",
    "the collapse/expand spring animation replays",
]))

A(BOX("Where this comes from",
      "All 46 admin pages in HKM 0.3 wrapped inline, and none of them used the "
      "persistent-layout support the client already had. If you are porting a "
      "0.3 page, this is the first thing to change.", "trap"))

A(H2("AdminLayout options"))

A(CODE("""
<AdminLayout
  providers={[MapProvider, QueryProvider]}   // outermost first
  headerActions={<GlobalSearch />}           // right of the top bar
  sidebarHeader={<ConnectedOrgSwitcher />}   // default: read-only <OrgSwitcher/>
  sidebarFooter={<StorageMeter />}           // between nav and the user row
  onNotifications={() => setPanelOpen(true)} // omit → the bell is hidden
  onHelp={() => open("/docs")}               // omit → the help button is hidden
  clock={false}                              // hide the header clock
  defaultSidebarOpen={false}
  toastPosition="bottom-right"
/>
""", lang="ts"))

A(P("""The sidebar slots are named `sidebarHeader` / `sidebarFooter` on purpose.
Plain `header` and `footer` would read as the PAGE header and footer, which
belong to `useSetPageHeader` and `useSetPageFooter` --- a different thing
entirely."""))

A(H3("providers: how a plugin injects its own dependency"))

A(P("""If your pages need a context provider --- a maps SDK, a query client, a
websocket --- do not add it to the shell. Pass it in, so applications that do not
use your plugin never pay for it."""))

A(CODE("""
// plugins/hkm-plugin-maps/ui/index.ts exports MapProvider
import { MapProvider } from "@maps";

MapPage.layout = (page: ReactNode) => (
  <AdminLayout providers={[MapProvider]}>{page}</AdminLayout>
);
""", lang="ts"))

A(BOX("Why this prop exists",
      "The 0.3 layout hard-wired a Google-Maps provider into the shell itself, so "
      "every admin application in every project paid a maps dependency in order to "
      "render a sidebar. If you ever find yourself editing the foundation to add a "
      "provider, use this prop instead.", "trap"))

A(H2("AuthLayout"))

A(P("""For screens that render before there is an identity --- sign-in,
registration, OAuth consent, email verification. Nav-free by design: there is no
identity yet, so there is nothing to build a sidebar from."""))

A(CODE("""
import { AuthLayout } from "@pageflow/admin";

Login.layout = (page: ReactNode) => (
  <AuthLayout
    brand="Acme"
    links={[{ label: "Privacy", href: "/privacy" }]}
  >
    {page}
  </AuthLayout>
);
""", lang="ts"))

# ============================================================ 4. adminShell
A(H1("Shell data: the adminShell shared prop"))

A(P("""`AdminLayout` takes no data props. Everything it renders --- the user row,
the tenant switcher, which nav sections are visible, where log-out posts to ---
comes from one reserved shared prop called `adminShell`. Your pages never thread
it down."""))

A(H2("Server side --- share it once"))

A(CODE("""
<?php
// A project stage, or your plugin's Provider::boot() — anywhere that runs per
// request BEFORE the responder renders.

pageflow_share('adminShell', [
    'user' => [
        'id'          => $identity->userId,
        'displayName' => $identity->fullName ?: $identity->username,
        'email'       => $identity->email,
        'avatarUrl'   => $identity->avatarUrl,
    ],
    'tenant'   => $tenant,        // ?['id','name','logoUrl','meta']
    'tenants'  => $memberships,   // switchable tenants; fewer than 2 hides the switcher
    'features' => $ctx?->features ?? [],   // proj.json features[]

    'logoutUrl'   => '/auth/logout',
    'accountUrl'  => '/account/profile',
    'settingsUrl' => '/admin/settings',
    'appName'     => env('APP_NAME', 'Admin'),
    'notificationCount' => $unread,
]);
""", lang="php"))

A(P("""`Identity` already carries `username`, `email`, `fullName` and `avatarUrl`
--- the Auth plugin fills them at issuance --- so the user block is a
projection, not a database read. `features` comes from `proj.json` via
`DomainContext`, so enabling a section is a deployment decision, not a code
change."""))

A(H2("Client side --- read it"))

A(CODE("""
import { useAdminShell, useCurrentPath } from "@pageflow/admin";

function TenantBanner() {
  const { user, tenant, tenants, features, appName } = useAdminShell();
  const path = useCurrentPath();      // NOT window.location — see the trap below

  if (!tenant) return null;
  return <p>{user.displayName} · {tenant.name} · {path}</p>;
}
""", lang="ts"))

A(P("""Every field comes back resolved, never `undefined`: `user` falls back to a
guest, `tenants` to an empty array, the URLs to sensible defaults. A surface that
shares nothing still renders a shell rather than crashing."""))

A(BOX("Never derive the path from window.location",
      "window.location.pathname is read once during render and never updates, so "
      "anything computed from it goes stale the moment the user navigates "
      "client-side. Use useCurrentPath(), which reads usePage().url. In 0.3 this "
      "exact bug left the breadcrumb pointing at the previous page while the "
      "sidebar highlight moved on.", "trap"))

# ============================================================ 5. Navigation
A(H1("Contributing navigation"))

A(P("""Create `ui/admin/nav.ts` in your plugin. The admin surface globs
`/plugins/*/admin/nav.ts` and imports every match for its side effects, so
nothing imports your file by name and the foundation never learns your plugin
exists."""))

A(CODE("""
// plugins/hkm-plugin-rental/ui/admin/nav.ts
import { Building2, Wrench, Users } from "lucide-react";
import { registerModule, registerFeature, registerIcons } from "@pageflow/admin";

// Only needed if you use the string form of `icon` anywhere.
registerIcons({ Building2, Wrench, Users });

registerFeature({
  id: "rental",
  label: "Rental management",
  description: "Properties, tenants, leases and maintenance",
  badge: { label: "Beta", variant: "beta" },   // default badge for gated items
});

registerModule({
  id: "rental",                 // MUST be unique across every plugin
  sectionLabel: "Rental",       // the sidebar heading
  order: 40,                    // <10 overview · 10–89 domains · >=90 system
  features: ["rental"],         // whole section hidden unless the flag is on

  items: [
    {
      id: "properties",
      label: "Properties",
      icon: Building2,
      path: "/admin/rental/properties",
      parentPath: "/admin/rental/properties",
      children: [
        { id: "properties-all",    label: "All properties",
          path: "/admin/rental/properties" },
        { id: "properties-create", label: "Add property",
          path: "/admin/rental/properties/create" },
        // Not rendered, but still highlights its parent when active:
        { id: "properties-edit",   label: "Edit",
          path: "/admin/rental/properties/edit", hidden: true },
      ],
    },
    {
      id: "maintenance",
      label: "Maintenance",
      icon: Wrench,
      path: "/admin/rental/maintenance",
      badge: { label: "New", variant: "new" },
    },
    {
      id: "tenants",
      label: "Tenants",
      icon: "Users",                 // string form — resolved via registerIcons
      path: "/admin/rental/tenants",
      feature: "rental-tenants",     // gate ONE item independently
    },
  ],
});
""", lang="ts"))

A(H2("How visibility is decided"))

A(P("""The enabled feature set comes from the server and travels as
`adminShell.features`:"""))

A(CODE("""
proj.json  "features": [ ... ]
     │
     ▼
DomainContext->features          (project layer, resolved from the host)
     │
     ▼
pageflow_share('adminShell', ['features' => $ctx->features])
     │
     ▼
selectNavSections(features)      (the sidebar, during render)
"""))

A(CODE("""
// projects/<name>/proj.json
{
  "features": [
    "rental",
    "rental-tenants",
    { "id": "maintenance", "badge": { "label": "Preview", "variant": "beta" } }
  ]
}
""", lang="jsonc"))

A(P("""The object form re-badges by id --- and it works on an ITEM id as well as
a feature id, which is how a deployment marks one page as Beta without a code
change."""))

A(H2("Badge resolution order"))
A(TABLE(["Priority", "Source"],
        [["1", "the item's own badge field"],
         ["2", "a runtime badge keyed by the ITEM id"],
         ["3", "a runtime badge keyed by the item's feature"],
         ["4", "the registered feature's default badge"]],
        spec="ll"))

A(BOXRAW("Two things that will bite you", """
\\begin{itemize}[leftmargin=1.2em,itemsep=3pt,topsep=2pt]
\\item \\textbf{Module ids are global.} Two plugins registering \\Code{id: "settings"}
silently replace one another --- one section just never appears. Replacement is
deliberate (it is how a project overrides a plugin's section), so it cannot be an
error. It warns in dev; namespace your id with the plugin slug.
\\item \\textbf{A flag that matches nothing does nothing.} Enabling
\\Code{"rentals"} when the feature is \\Code{"rental"} produces no error and no
section. The registry logs the unmatched ids once --- read the console.
\\end{itemize}
""", "trap"))

A(H2("Nav-only, no page yet"))

A(P("""Do not register nav for routes that do not exist. In 0.3 five modules
contributed roughly 115 items whose routes were never registered; every one of
them 404'd, and the project's `proj.json` carried a comment explaining why they
had to stay disabled. Register the section when the route lands."""))

# ============================================================ 6. Settings tab
A(H1("Contributing a settings tab"))

A(P("""A settings screen is the one place where several plugins genuinely want to
render into one page: company details belong to Settings, SMTP to Mail, domains
to Tenancy, clients to OAuth2, sessions to Auth. Writing that as imports would
make the Settings plugin depend on five others."""))

A(P("So it is the same seam as navigation, with its own registry."))

A(CODE("""
// plugins/hkm-plugin-mail/ui/admin/nav.ts
import { registerSettingsTab, type SettingsTabProps } from "@pageflow/admin";
import { Input } from "@ui/input";
import { Label } from "@ui/label";

function EmailSettingsPanel({ value, onChange, saving }: SettingsTabProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="smtp-host">SMTP host</Label>
        <Input
          id="smtp-host"
          disabled={saving}
          value={String(value.smtpHost ?? "")}
          onChange={(e) => onChange({ smtpHost: e.target.value })}
        />
      </div>
    </div>
  );
}

registerSettingsTab({
  id: "mail.smtp",          // namespace with your slug — ids are global
  label: "Email",
  group: "Communication",
  order: 30,
  feature: "mail",          // hidden unless the flag is on
  component: EmailSettingsPanel,
});
""", lang="ts"))

A(P("""The settings PAGE reads them back and owns dirty-tracking and saving; your
panel only reports changes through `onChange`."""))

A(CODE("""
// whichever page renders the settings screen
import { selectSettingsTabs, useAdminShell } from "@pageflow/admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/tabs";

const { features } = useAdminShell();
const tabs = selectSettingsTabs(features);      // ordered, feature-gated

<Tabs defaultValue={tabs[0]?.id}>
  <TabsList>
    {tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
  </TabsList>
  {tabs.map(({ id, component: Panel }) => (
    <TabsContent key={id} value={id}>
      <Panel value={settings} onChange={patch} saving={saving} />
    </TabsContent>
  ))}
</Tabs>
""", lang="ts"))

# ============================================================ 7. Page header
A(H1("Page header and footer"))

A(P("""The page declares what it wants; the layout decides where it renders.
Neither imports the other. Copy this shape if you ever need a new shell slot ---
it is the reason a plugin page can put a Save button in the application chrome
without the chrome knowing that plugin exists."""))

A(CODE("""
import { useSetPageHeader, useSetPageFooter } from "@pageflow/admin";
import { Button } from "@ui/button";
import { Plus, Save } from "lucide-react";

useSetPageHeader({
  title: "Properties",
  description: "Every unit in the portfolio",
  actions: [
    { label: "Import",       onClick: openImport, variant: "outline" },
    { label: "Add property", onClick: openCreate, icon: <Plus className="h-4 w-4" /> },
  ],
}, [openImport, openCreate]);       // ← deps matter, see below

// A sticky bar at the bottom — bulk actions, unsaved-changes prompts.
useSetPageFooter({
  content: (
    <div className="flex items-center justify-between">
      <span>{selected.length} selected</span>
      <Button onClick={save}><Save className="mr-2 h-4 w-4" /> Save</Button>
    </div>
  ),
}, [selected.length, save]);
""", lang="ts"))

A(BOX("The deps array is not optional in practice",
      "useSetPageHeader takes a dependency list that defaults to []. With the "
      "default, the header is set once on mount and never updates — so a title "
      "that depends on loaded data (\"Invoice #4821\") will stay on its "
      "placeholder forever. Pass the values the header reads.", "trap"))

A(P("""Both hooks clear on unmount, so navigating away never leaves the previous
page's title in the bar. `actions` accepts either the array form above or
arbitrary JSX when you need something a button cannot express."""))

# ============================================================ 8. Lists
A(H1("Lists, tables and mutations"))

A(H2("Which one to reach for"))
A(TABLE(["Component", "Use when"],
        [["DataTable", "you want sorting, column filters, a row-action menu and delete confirmation out of the box"],
         ["ResourceListShell + SimpleTable", "you want the full page chrome (stats, chips, empty state) and full control of the row markup"],
         ["useResourceList", "client-side search / status filter / pagination state for either of the above"],
         ["TableQuery", "the dataset is too large to hold, and the server does the filtering"]],
        spec="lp{0.62\\textwidth}"))

A(H2("A complete CRUD page"))

A(P("""This is the pattern most plugin list screens should follow. It uses the
shell for chrome, `useResourceList` for state, and `resourceRequest` for
mutations."""))

A(CODE("""
// plugins/hkm-plugin-rental/ui/admin/Pages/Rental/Properties.tsx
import { useState, type ReactNode } from "react";
import { usePage } from "@pageflow/react";
import {
  AdminLayout, useSetPageHeader,
  ResourceListShell, SimpleTable, useResourceList, resourceRequest,
} from "@pageflow/admin";
import { Building2, CheckCircle2, Wrench } from "lucide-react";
import { Button } from "@ui/button";

interface Property {
  id: string; reference: string; addressLine: string;
  status: "vacant" | "occupied" | "maintenance";
}
interface Props extends Record<string, unknown> { properties: Property[] }

const STATUSES = [
  { value: "all",         label: "All" },
  { value: "vacant",      label: "Vacant",      icon: Building2 },
  { value: "occupied",    label: "Occupied",    icon: CheckCircle2 },
  { value: "maintenance", label: "Maintenance", icon: Wrench },
];

export default function Properties() {
  const { props } = usePage<Props>();
  const [busy, setBusy] = useState(false);

  // Adopts server-sent rows when props change — see the trap below.
  const list = useResourceList<Property>({
    initial: props.properties,
    getId: (p) => p.id,
    searchFields: (p) => [p.reference, p.addressLine],
    getStatus: (p) => p.status,
    pageSize: 20,
  });

  useSetPageHeader({ title: "Properties" }, []);

  const remove = (property: Property) => {
    setBusy(true);
    resourceRequest({
      url: `/ajx/rental/properties/${property.id}`,
      method: "delete",
      failureMessage: "Could not delete that property",
      successMessage: "Property deleted",
      onOk:      () => list.removeItem(property.id),
      onSettled: () => setBusy(false),
    });
  };

  return (
    <ResourceListShell
      stats={[
        { label: "Total",    value: list.counts.all ?? 0,      icon: Building2 },
        { label: "Occupied", value: list.counts.occupied ?? 0, icon: CheckCircle2,
          color: "bg-emerald-500/10 text-emerald-600" },
      ]}
      search={list.search}
      onSearchChange={list.setSearch}
      searchPlaceholder="Search by reference or address…"
      createLabel="Add property"
      onCreate={() => router.visit("/admin/rental/properties/create")}
      filters={{
        options: STATUSES, value: list.status,
        onChange: list.setStatus, counts: list.counts,
      }}
      empty={{
        icon: Building2,
        title: "No properties yet",
        description: "Add your first unit to start tracking occupancy.",
        actionLabel: "Add property",
        onAction: () => router.visit("/admin/rental/properties/create"),
      }}
      isEmpty={list.filtered.length === 0}
      page={list.page}
      totalPages={list.totalPages}
      totalResults={list.filtered.length}
      onPageChange={list.setPage}
    >
      <SimpleTable
        columns={[
          { key: "ref",    label: "Reference" },
          { key: "addr",   label: "Address", hideOnMobile: true },
          { key: "status", label: "Status" },
          { key: "act",    label: "", align: "right" },
        ]}
      >
        {list.paginated.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3 font-medium">{p.reference}</td>
            <td className="hidden px-4 py-3 sm:table-cell">{p.addressLine}</td>
            <td className="px-4 py-3">{p.status}</td>
            <td className="px-4 py-3 text-right">
              <Button variant="ghost" size="sm" disabled={busy}
                      onClick={() => remove(p)}>Delete</Button>
            </td>
          </tr>
        ))}
      </SimpleTable>
    </ResourceListShell>
  );
}

Properties.layout = (page: ReactNode) => <AdminLayout>{page}</AdminLayout>;
""", lang="ts"))

A(BOXRAW("preserveState: the trap behind two separate bugs", """
\\Code{router.post}, \\Code{router.put} and \\Code{router.patch} all default to
\\Code{preserveState: true}, and \\Code{resourceRequest} sets it explicitly. That
means the page component is \\textbf{not remounted} after a mutation.

\\vspace{4pt}
Consequences you must plan for:
\\begin{itemize}[leftmargin=1.2em,itemsep=2pt,topsep=2pt]
\\item Any \\Code{useState(props.x)} you write by hand keeps the value captured on
first mount. \\Code{useResourceList} handles this for you via
\\Code{syncOnPropChange} (default true); hand-rolled state does not.
\\item A \\Code{router.reload(\\{ only: ['rows'] \\})} will appear to do nothing at
all if your state was seeded once and never re-synced.
\\end{itemize}
""", "trap"))

A(H2("Server-side tables"))

A(P("""When the dataset is too large to send, switch `DataTable` into server
mode. Every parameter change --- debounced search, sort, column filter, page ---
arrives in one callback."""))

A(CODE("""
const [rows, setRows]   = useState(props.rows);
const [total, setTotal] = useState(props.total);
const [loading, setLoading] = useState(false);

<DataTable
  serverSide
  data={rows}
  totalRecords={total}
  loading={loading}
  columns={columns}
  onFetchData={({ start, length, search, filters, sortKey, sortDirection }) => {
    setLoading(true);
    router.visit("/admin/rental/properties", {
      method: "get",
      data: { page: start + 1, per_page: length, q: search,
              sort: sortKey, dir: sortDirection,
              ...Object.fromEntries(filters.map((f) => [f.key, f.value])) },
      only: ["rows", "total"],
      preserveState: true,
      preserveScroll: true,
      onSuccess: (page) => { setRows(page.props.rows); setTotal(page.props.total); },
      onFinish:  () => setLoading(false),
    });
  }}
/>
""", lang="ts"))

A(P("""`TableQuery` is the immutable helper for holding that query state. Every
mutator returns a new instance, so it is safe in React state --- and
`toParams()` produces the flat object above."""))

A(CODE("""
import { TableQuery } from "@pageflow/admin";

const [query, setQuery] = useState(() => TableQuery.from({ length: 25 }));

setQuery((q) => q.setFilter("status", "vacant"));   // resets to page 1
setQuery((q) => q.toggleSort("reference"));          // unsorted → asc → desc → off
router.visit(url, { data: query.toParams() });
""", lang="ts"))

A(H2("Mutations: resourceRequest"))

A(CODE("""
resourceRequest<Property>({
  url: "/ajx/rental/properties",
  method: "post",
  data: { reference, addressLine },
  resultKey: "property",        // prop holding the created row
  only: ["stats"],              // anything else you want refreshed
  successMessage: "Property created",
  failureMessage: "Could not create that property",
  onOk:      (created) => created && list.addItem(created),
  onInvalid: (fields)  => setFieldErrors(fields),   // 422, field-level
  onSettled: ()        => setBusy(false),
});
""", lang="ts"))

A(P("""It handles both shapes a Sentinel endpoint can answer with --- a populated
`errors` bag, or the `{ error: { code, message, fields } }` envelope arriving as
a prop --- so no call site has to know which."""))

A(BOX("error is a reserved prop name",
      "resourceRequest always requests a prop called error and reads it as a "
      "failure envelope. If your page uses error as an ordinary prop, rename it.",
      "trap"))

# ============================================================ 9. Forms + hooks
A(H1("Form controls and hooks"))

A(H2("Controls"))

A(CODE("""
import { FieldHelp, TagInput, SuggestionSelect } from "@pageflow/admin";

// A "?" button beside a label, sized for a wide age range.
<FieldHelp
  title="Property reference"
  rules={["Must be unique", "Letters, numbers and dashes only"]}
  example="BLK-A-12"
>
  The short code your team uses to refer to this unit.
</FieldHelp>

// Tag entry: Enter adds, Backspace on empty removes the last chip.
<TagInput
  label="Amenities"
  items={amenities}
  onChange={setAmenities}
  tone="primary"
  help={{ title: "Amenities", rules: ["One per chip", "Keep them short"] }}
/>

// A dropdown of suggestions over a FREE-TEXT column, with an escape hatch.
<SuggestionSelect
  value={heatingType}
  onChange={setHeatingType}
  options={[{ label: "Central", value: "central" },
            { label: "Solar",   value: "solar" }]}
/>
""", lang="ts"))

A(P("""`SuggestionSelect` exists for a specific failure. A closed dropdown over a
free-text column silently rewrites history: open an old record whose value is not
on the list, the control shows blank, and saving writes that blank over a real
answer. This one starts in custom mode with the original text intact."""))

A(H2("Hooks"))

A(TABLE(["Hook", "What it gives you"],
        [["useAdminShell()", "resolved shell data — user, tenant(s), features, URLs"],
         ["useCurrentPath()", "the current pathname from usePage(), never stale"],
         ["useIsMobile() / useMediaQuery()", "breakpoint state, correct on first paint"],
         ["useDebouncedAutosave()", "debounced save with status + a flush() for cmd-S"],
         ["useApi()", "data that is NOT in the page payload (search-as-you-type)"],
         ["usePageflowErrors()", "already mounted by the layouts — see below"]],
        spec="lp{0.60\\textwidth}"))

A(CODE("""
import { useDebouncedAutosave } from "@pageflow/admin";

const { status, lastSavedAt, flush } = useDebouncedAutosave({
  value: draft,
  save: async (v) => { await api.saveDraft(v); },
  delay: 1200,
  enabled: !loading,
  isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
});

// status: "idle" | "pending" | "saving" | "saved" | "error"
""", lang="ts"))

A(BOXRAW("Do not toast validation errors", """
A 422 travels two paths at once: the client fires the global \\Code{error} event
\\textbf{and} calls the visit's \\Code{onError}, which is what \\Code{useForm} and
\\Code{<Form>} use to put a message under each field.

\\vspace{4pt}
So \\Code{usePageflowErrors} --- already mounted for you by the layouts --- stays
silent on validation by default and only toasts transport failures, which have no
field to attach to. Adding your own toast on top would report every failed form
submission in the application twice. If a surface submits through bare
\\Code{router.post} calls where nothing renders the errors, pass
\\Code{validationToasts: true}.
""", "trap"))

# ============================================================ 10. Both faces
A(H1("Shipping both faces"))

A(P("""A plugin can serve the admin surface and the public site from one `ui/`.
Declare the map in `ui.json`; each surface globs the pages for its own face."""))

A(CODE("""
{
  "alias": "@rental",
  "entry": "index.ts",
  "framework": "react",
  "surfaces": {
    "admin": "admin/Pages",
    "site":  "site/Pages"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.0.0"
  }
}
""", lang="jsonc"))

A(CODE("""
plugins/hkm-plugin-rental/ui/
├─ admin/Pages/Rental/Properties.tsx    → "Rental/Properties"  (AdminLayout)
├─ site/Pages/Rental/Listing.tsx        → "Rental/Listing"     (your own layout)
├─ components/PropertyCard.tsx          shared by both faces
└─ index.ts                             export { PropertyCard }  → "@rental"
"""))

A(P("""Public pages must NOT use `AdminLayout` --- it would pull the whole admin
shell into a marketing bundle. Give them their own layout, or none."""))

A(P("""Declare your own dependencies in `ui.json`. A vendor SDK belongs to the
plugin that needs it, never to the foundation --- that is the whole reason the
foundation ships only `lucide-react`, `framer-motion` and `sonner`."""))

A(H2("Overriding a plugin page from a project"))

A(P("""Surfaces spread the project's own pages FIRST, so declaring the same
component name in the project wins. Nothing in the plugin changes."""))

A(CODE("""
frontend/src/surfaces/admin/Pages/Rental/Properties.tsx   ← project's version wins
frontend/plugins/rental/admin/Pages/Rental/Properties.tsx ← plugin's, now shadowed
"""))

A(P("""To remove a plugin route entirely rather than replace its page, use the
project's disable policy --- no fork required:"""))

A(CODE("""
// proj.json
{
  "routePolicy": {
    "disable": [
      "GET /admin/rental/maintenance",   // one route
      "rental.management"                // or a whole module's routes, by domain
    ]
  }
}
""", lang="jsonc"))

A(BOX("A disable spec that matches nothing fails the boot",
      "That is deliberate — it is the anti-typo guard. If the build fails here, "
      "check the spelling against the compiled route manifest.", "note"))

# ============================================================ 11. Traps
A(H1("The trap list"))

A(P("""Every item below is a defect that has actually been found in this
codebase, not a hypothetical. They are the ones a type-checker cannot see."""))

A(TABLE(["What looks right", "What actually happens"],
        [["wrapping the page in <AdminLayout>",
          "the sidebar remounts on every navigation"],
         ["useState(props.rows)",
          "stale after any mutation — preserveState is true by default"],
         ["toasting validation errors",
          "double-reports; useForm already renders them inline"],
         ["router.visit(target) after sign-in",
          "carries a stale CSRF token and stale shell props; use a full load"],
         ["window.location.pathname",
          "read once at render; goes stale after client-side navigation"],
         ["<a href> to any endpoint",
          "405 if the route is POST-only — read module.json first"],
         ["assuming item.$id",
          "a 0.3 storage artefact; identity defaults to item.id, or pass getId"],
         ["importing AppErrorBoundary from @pageflow/admin",
          "pulls the whole shell; it lives in @pageflow/react"],
         ["<Head title=\"...\">",
          "titles are server-driven via the seoHead prop"],
         ["a trait method you have seen elsewhere",
          "traits compose — find the trait that DECLARES it"]],
        spec="p{0.42\\textwidth}p{0.52\\textwidth}"))

A(BOXRAW("Why this list exists", """
A review of roughly 5,600 lines of freshly written code for this foundation found
\\textbf{fifteen defects}. \\Code{tsc --noEmit} was clean throughout and caught
\\textbf{none} of them; \\Code{php -l} caught none.

\\vspace{4pt}
Not one was a typo. Each was a coherent, plausible belief that happened to be
false --- a method on the wrong trait, a link to a POST-only route, a framework
default that was the opposite of what its API implied. Before you report a page
as working, open the definition of what it calls: the trait, the signature, the
route's METHOD, the client's actual default. And say plainly what you did not
verify --- \\emph{type-checks clean} is not evidence that anything works.
""", "trap"))

# ============================================================ 12. Checklist
A(H1("Checklist and cheat sheet"))

A(H2("Adding an admin page to a plugin"))
A(STEPS([
    "Create `ui/admin/Pages/<Dir>/<Name>.tsx` — the path IS the component name.",
    "Attach the shell: `Page.layout = (p) => <AdminLayout>{p}</AdminLayout>`.",
    "Declare the title with `useSetPageHeader({...}, [deps])`. No `<Head title>`.",
    "Add the route to `module.json` with `requires: [\"http.pageflow\"]` and a `filters: [\"auth\"]` where appropriate.",
    "Render it from a controller: `$this->pageflow->render($request, '<Dir>/<Name>', 'admin', [...])` with a `seoHead` from `seoPrivate()`.",
    "Register nav in `ui/admin/nav.ts` — but only once the route exists.",
    "Run `hkm ui sync`, then `npm run dev -- --mode admin`.",
]))

A(H2("Cheat sheet"))
A(CODE("""
Shell                Page.layout = (p) => <AdminLayout>{p}</AdminLayout>
Shell data           const { user, tenant, features } = useAdminShell()
Current path         const path = useCurrentPath()          // never window.location
Title + actions      useSetPageHeader({ title, actions }, [deps])
Sticky footer        useSetPageFooter({ content }, [deps])
Sidebar section      registerModule({...})   in ui/admin/nav.ts
Settings panel       registerSettingsTab({...})
Own provider         <AdminLayout providers={[MyProvider]}>
List chrome          <ResourceListShell …><SimpleTable …>
List state           const list = useResourceList({ initial, getId, searchFields })
Batteries table      <DataTable data columns getId serverSide onFetchData />
Mutation             resourceRequest({ url, method, onOk, onInvalid })
Error boundary       import { AppErrorBoundary } from "@pageflow/react"

Sync after enabling  hkm plugins enable <name> && hkm ui sync
Dev                  npm run dev -- --mode admin
Build all surfaces   npm run build:all
"""))

A(H2("Further reading"))
A(TABLE(["Document", "Covers"],
        [["plugins/hkm-plugin-pageflow/ui/admin/README.md", "every export, in reference form"],
         ["tools/src/templates/frontend/docs/HOW_IT_WORKS.md", "surfaces, federation, adding a page"],
         ["plugins/hkm-plugin-user/ui/README.md", "a worked two-face plugin"],
         ["plugins/hkm-plugin-auth/ui/README.md", "the default sign-in page and how to replace it"],
         ["docs/migration/ADMIN-UI-DISTRIBUTION.md", "the 0.3 map, the layout in detail, the defect log"],
         ["CLAUDE.md", "the platform contract, including the verification rule"]],
        spec="p{0.47\\textwidth}p{0.47\\textwidth}"))

# ── emit ──────────────────────────────────────────────────────────────────────

tex = PREAMBLE + TITLE + "".join(D) + "\n\\end{document}\n"
Path(OUT + ".tex").write_text(tex, encoding="utf-8")

for i in range(2):
    r = subprocess.run(["lualatex", "-interaction=nonstopmode", "-halt-on-error", OUT + ".tex"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        tail = [l for l in r.stdout.splitlines() if l.startswith("!") or "l." in l[:4]]
        print("LaTeX failed on pass", i + 1)
        print("\n".join(tail[-25:] or r.stdout.splitlines()[-25:]))
        sys.exit(1)

print("built", OUT + ".pdf")
