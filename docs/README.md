# Plugin docs

## `PAGEFLOW_ADMIN_GUIDE.pdf`

The guide to building admin UI in *other* plugins with `@pageflow/admin` — the
persistent shell, the nav and settings registries, the list/table kit, and the
traps that a type-checker cannot see. Ships at `ui/PAGEFLOW_ADMIN_GUIDE.pdf`
alongside the other Pageflow PDFs.

**It is generated, not hand-edited.** Content lives in `build-admin-guide.py` as
ordered blocks (`H1`, `P`, `CODE`, `TABLE`, `BOX`); the script emits LaTeX and
runs `lualatex` twice for the table of contents. Prose is escaped automatically
and `` `backticks` `` become inline code, so nothing here needs hand-escaping.

```bash
cd plugins/hkm-plugin-pageflow/docs
python3 build-admin-guide.py            # writes PAGEFLOW_ADMIN_GUIDE.pdf here
cp PAGEFLOW_ADMIN_GUIDE.pdf ../ui/
```

Requires `lualatex` with `listings`, `tcolorbox`, `tocloft`, `needspace`,
`fontspec`, and the DejaVu Sans + Fira Code fonts. On Debian/Kali:
`texlive-luatex texlive-latex-extra fonts-firacode`.

### Why the generator lives here and not in `ui/`

`hkm ui sync` mirrors a plugin's entire `ui/` tree into every project's
`frontend/plugins/<slug>/`. It already skips `.pdf` (see `skip_exts` in
`tools/src/lib/plugin_ui.zig`) but not `.py`, so a build script inside `ui/`
would be copied into every project frontend that enables this plugin. Build
tooling is not shipped UI, so it sits at the plugin root instead.

### Keeping it honest

Every code sample is meant to compile against the real exports. When
`@pageflow/admin` changes shape, update the blocks in the generator and rebuild —
a guide that documents a signature the code no longer has is worse than no guide,
because it is trusted.
