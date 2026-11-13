// 1.0.0 극한 최적화: 애드온 첫 장 — 창 밖 규칙은 전부 남고, 뺀 규칙은 창 표시가 있는 것뿐이고, 첫 장은 전체 시트의 부분 집합(같은 순서)이에요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { ADDON_BOOT_CSS, ADDON_CSS_SENTINEL, LATE_STYLE_IDS, bootSheetOf } = await import(pathToFileURL(path.join(root, 'src/addon-style-bundle.js')).href);
const LATE_ADDONS = new Set((/LATE_ADDONS=new Set\(\[([^\]]+)\]/.exec((read('src/addons.js') + read('src/addons-panel.js')))[1].match(/'[\w-]+'/g) || []).map(x => x.slice(1, -1)));
const { outerChain } = require('../css-scope-defer.cjs');
const { dropComments } = await import(pathToFileURL(path.join(root, 'tools/build-addon-css.mjs')).href);
const test = (name, fn) => { fn(); console.log(`ok - ${name}`); };

/** 규칙 글 목록(조건 묶음 안까지 평평하게) */
function rules(css) {
    const out = [];
    const walk = (text, cond) => {
        let i = 0;
        while (i < text.length) {
            const open = text.indexOf('{', i); if (open < 0) break;
            let depth = 1, k = open + 1, quote = null;
            while (k < text.length && depth) { const c = text[k]; if (quote) { if (c === quote && text[k - 1] !== '\\') quote = null; } else if (c === '"' || c === "'") quote = c; else if (c === '{') depth++; else if (c === '}') depth--; k++; }
            const prelude = text.slice(i, open).replace(/^[^]*;/, '').trim().replace(/\s+/g, ' ');
            const body = text.slice(open + 1, k - 1);
            if (/^@(media|supports|container|layer)\b/.test(prelude)) walk(body, `${cond}|${prelude}`);
            else if (!prelude.startsWith('@')) out.push({ key: `${cond}|${prelude}|${body.replace(/\s+/g, ' ').trim()}`, selector: prelude });
            i = k;
        }
    };
    walk(dropComments(css), '');
    return out;
}
const splitParts = sel => { const out = []; let depth = 0, cur = ''; for (const ch of sel) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };

for (const [id, spec] of Object.entries(ADDON_BOOT_CSS)) {
    test(`${id}: 첫 장은 전체의 부분 집합 · 뺀 규칙은 창 표시가 있는 것뿐 · 표지 규칙`, () => {
        const boot = read(`src/addons/${bootSheetOf(id)}`), full = rules(read(`src/addons/${id}/style.css`));
        const bootRules = rules(boot).filter(r => !r.key.includes(`animation:${ADDON_CSS_SENTINEL}`));
        const order = new Map(); full.forEach((r, i) => { if (!order.has(r.key)) order.set(r.key, []); order.get(r.key).push(i); });
        let at = -1;
        for (const r of bootRules) {
            const slots = order.get(r.key);
            assert.ok(slots, `전체 시트에 없는 규칙: ${r.selector.slice(0, 80)}`);
            const next = slots.find(i => i > at);
            assert.ok(next !== undefined, `순서가 달라요: ${r.selector.slice(0, 80)}`);
            at = next;
        }
        const kept = new Set(bootRules.map(r => r.key));
        const panel = new RegExp(`(?<![\\w-])(?:${spec.panel})`), keep = new RegExp(`(?<![\\w-])(?:${spec.keep})`);
        for (const r of full) {
            if (kept.has(r.key)) continue;
            for (const part of splitParts(r.selector)) { const chain = outerChain(part.trim()); assert.ok(panel.test(chain) && !keep.test(chain), `창 밖 규칙을 뺐어요: ${part.trim().slice(0, 80)}`); }
        }
        assert.ok(boot.includes(`@keyframes ${ADDON_CSS_SENTINEL}`) && boot.includes(`animation:${ADDON_CSS_SENTINEL} 1ms`));
        assert.equal(/--[\w-]*(?:css-)?version\s*:/.test(boot), /--[\w-]*(?:css-)?version\s*:/.test(read(`src/addons/${id}/style.css`)), '판 변수는 남겨요(파일 어긋남 검사)');
    });
}
test('늦은 애드온 표가 addons.js 와 같아요', () => assert.deepEqual([...LATE_STYLE_IDS].sort(), [...LATE_ADDONS].sort()));
test('전체 시트로 바꾸는 길: 처음 누름 · 전체 CSS · 표지 규칙 · 실패하면 첫 장 그대로 다시 시도', () => {
    const addons = (read('src/addons.js') + read('src/addons-panel.js'));
    assert.match(addons, /onGate\('press',upgradeAddonStyles,'addon-css'\)/);
    assert.match(addons, /addEventListener\('bl:full-css',upgradeAddonStyles\)/);
    assert.match(addons, /addEventListener\('animationstart',event=>\{if\(event\.animationName===ADDON_CSS_SENTINEL\)upgradeAddonStyles\(\);\},true\)/);
    assert.match(addons, /else\{full\.remove\(\);pendingSheets\.set\(link,href\);\}/);
    assert.match(addons, /link\.after\(full\)/, '같은 자리 — 규칙 순서 그대로');
    assert.match(read('src/lite.js'), /dispatchEvent\(new Event\('bl:full-css'\)\)/);
});
test('처음 쓸 때 시작하는 애드온은 시작 전에도 「새로고침 필요」로 세지 않아요', () => {
    const addons = (read('src/addons.js') + read('src/addons-panel.js'));
    assert.match(addons, /switchNeedsReload\(s, new Set\(\[\.\.\.running, \.\.\.\(lateStarted \? \[\] : lateIds\)\]\), RELOAD_ADDONS\)/);
});
