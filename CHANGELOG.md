# Changelog

## 1.10.0 — 2026-10-21

### Added
- `PageHeaderAction.menu` — the action goes in the header's new "More" (⋯)
  menu at every width.
- `ResourceListShell` `toolbar` prop, and `FilterSelect` / `FilterBar`: a
  list's filters under its search box, labelled and sized one way, full width
  on a phone.

### Changed
- The header bar keeps the title first: title and description are one line
  each from `md` up (two on a phone, full text in the tooltip). Button actions
  show the primary plus up to two others, the rest in "More"; on a phone the
  primary and "More" only. JSX actions get their own row on a phone and at most
  60% of the bar from `md` up, instead of taking their full width before the
  title got any.
- The breadcrumb stays on one line: parent and current page only on a phone,
  each label truncated. The clock is hidden on a phone.
- `StatStrip` is two cards to a row on a phone and `KpiCard` is more compact
  there. `ResourceListShell` has tighter padding on a phone, and no longer wraps
  its content in `container` or adds vertical padding of its own: the layout's
  column is already padded, so a project whose `container` pads itself put
  list pages up to 6rem further in than their header.

### Fixed
- Header buttons with no icon were empty boxes on a phone: the label was hidden
  below `sm` and only the icon drawn. Labels are always drawn now.

## 1.9.0 — 2026-10-20

### Added
- Opt-in Content-Security-Policy nonce. The responder reads a `csp_nonce`
  request attribute, or mints one when `PAGEFLOW_CSP_HEADER` (a policy with a
  `{nonce}` placeholder) is set, and sends that policy on HTML responses. The
  stock layout stamps the nonce on its inline scripts and on the tags
  ViteManifest emits, and exposes it to layouts as `$cspNonce`.
  `PageflowResponder::mintNonce()` and `PageflowPage::renderScript(?string $nonce)`
  are new. With no nonce the output is unchanged.

### Fixed
- `PageflowPage::renderScript()` encodes `<`, `>` and `&` in the page JSON
  (`JSON_HEX_TAG | JSON_HEX_AMP`). Inside a `<script>` element HTML escaping
  does not apply, so a prop containing `</script>` ended the element early and
  ran whatever followed. The parsed value is unchanged.
