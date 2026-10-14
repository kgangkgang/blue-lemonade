# Mermaid source and rebuild

Blue Lemonade modification: 2026-10-14. Extension code: AGPL-3.0 (../LICENSE).
Upstream: https://github.com/SillyTavern/Extension-Mermaid/tree/62265d550ca3dc46737c09bddf0bf328fd1f3469
Mermaid library 11.12.3: MIT; full dependency notices: ../NOTICE.md.

## Preferred editable source

`src/index.js` is the modified library bridge; `webpack.config.js`, `package.json`,
`package-lock.json` and `src/style.css` are included alongside it. The addon
`../index.js` and `../style.css` contain the editable event, UI and rendering code.
`upstream/` contains the unmodified extension entry, stylesheet, build config and
both package files from the pinned commit. No personal settings or chat data.

To build the bridge from editable source with Node.js 20+ and npm:

    npm ci --ignore-scripts
    npm run build

This generates an equivalent `dist/` bundle. Compiler versions/platform can
change minified bytes. The exact published bundle uses the original official
`dist/`, with only three integration changes applied by the included Python tool:

1. The webpack chunk URL reads `globalThis.__blMermaidBase`.
2. Webpack global and script namespace are unique (`blue_lemonade_mermaid`).
3. Replace original chat events and jQuery initialization with an engine-only
   bridge, disable automatic page rendering. The readable entry implements this.

To reproduce the exact shipped bytes (Python 3.9+, no npm needed):

    python rebuild.py --output ../vendor

It downloads ONLY the 42 dist files at the fixed official commit and verifies
every original SHA-256 in `upstream-sha256.json` BEFORE applying transformations.
For offline reconstruction, provide a checkout/archive of that same commit:

    python rebuild.py --upstream /path/to/Extension-Mermaid --output ../vendor

The full upstream source is included locally; dependencies can be obtained from
the exact public npm URLs and integrity hashes in package-lock.json. Mermaid's
preferred library sources are also at https://github.com/mermaid-js/mermaid/tree/mermaid%4011.12.3
and each dependency's source/copyright appears in ../NOTICE.md. No proprietary
service, API key or access to the author's computer is required.

Source, build instructions, original license and notices are distributed with
every theme release and accessible from the in-app copyright screen.
