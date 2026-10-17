// Fruit settings rows follow the chosen entry: the quick-reply name only for QR, cat size and tail/paw jump only for the cat.
// node tools/tests/fruit-entry-rows.mjs [root]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const style = (await import(pathToFileURL(path.join(root, 'src/scripts/bundled/fruit-style.js')).href)).default;
const entry = fs.readFileSync(path.join(root, 'src/scripts/fruit-entry.js'), 'utf8');
let passed = 0;
const ok = (cond, name) => { assert.ok(cond, name); passed++; };

ok(/const entry = doc\.body\?\.getAttribute\('data-bl-fruit-entry'\);\s*if \(!toggle \|\| \(entry && entry !== 'qr'\)\)/.test(style), 'name row is mounted only in QR entry mode');
ok(style.includes("'fh-row fh-stack bl-fruit-qr-name'"), 'name row stacks (name above, field below)');
ok(style.includes("attributeFilter: ['class', 'data-bl-fruit-entry']"), 'switching the entry re-syncs the name row');
ok(style.includes('.bl-fruit-qr-name > .fh-v { flex:none;'), 'field box has no flex-basis that turns into height in stacked phone rows');
ok(!style.includes('.bl-fruit-qr-name > .fh-v { flex:1 1 9em; }'), 'old 9em basis is gone');
ok(/querySelectorAll\('\[data-ball-size\],\[data-entry-toggle="jump"\]'\)/.test(entry), 'cat-only rows are found');
ok(/const want=mode==='cat'\?hiddenRows\.get\(row\):'none'/.test(entry), 'cat-only rows show only for the cat entry and restore their own display');
ok(/for\(const \[row,before\] of hiddenRows\)/.test(entry) || entry.includes('hiddenRows)if(row.style.display'), 'rows hidden by the theme are restored when it stops');
console.log(`fruit-entry-rows: ${passed} passed`);
