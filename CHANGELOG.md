# Changelog

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
