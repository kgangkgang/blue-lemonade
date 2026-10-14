// Blue Lemonade modification, 2026-10-14; AGPL-3.0. See ../README.md.
import mermaid from 'mermaid';
import './style.css';
// Bridge only: index.js in the addon owns events, strict initialization and retries.
__webpack_public_path__ = globalThis.__blMermaidBase || '/scripts/extensions/third-party/Extension-Mermaid/dist/';
mermaid.startOnLoad = false;
globalThis.__blMermaidEngine = mermaid;
