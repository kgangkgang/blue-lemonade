// 9.0.6 CSS 덮어쓰기 감사: 만든 style.css 에서 같은 조건(@media 등) · 같은 선택자 · 같은 속성을 뒤 규칙이 다시 쓰는 곳.
//   · 덮인 선언: 뒤 선언의 중요도(!important)가 앞과 같거나 높으면 앞 선언은 화면에 나올 일이 없다(같은 선택자 = 같은 특이도)
//     — 단 뒤 값이 옛 브라우저에서 못 읽힐 수 있는 값(css-lib fragileValue)이거나 :has 규칙(lite.js 가 미루거나 다시 씀)은 뺀다
//   · !important 싸움: 서로 다른 모듈이 같은 선택자 · 속성을 둘 다 !important 로 쓰는 곳
//   node tools/audit/css-overrides.mjs [저장소] [--json 결과.json] [--list N]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, writeJson, argValue } from './lib.mjs';

const lib = createRequire(import.meta.url)(path.join(ROOT, 'tools/css-lib.cjs'));
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const marks = [...css.matchAll(/\/\* css\/([\w.-]+) \*\//g)].map(m => ({ at: m.index, name: m[1] }));
const moduleAt = pos => { let lo = 0, hi = marks.length - 1, best = '?'; while (lo <= hi) { const mid = (lo + hi) >> 1; if (marks[mid].at <= pos) { best = marks[mid].name; lo = mid + 1; } else hi = mid - 1; } return best; };
const tree = lib.parse(css);
const rules = lib.flatRules(tree);
const last = new Map();   // key → { module, important, value, start }
const overridden = [], wars = new Map();
let decls = 0;
for (const rule of rules) {
    const mod = moduleAt(rule.start);
    for (const sel of lib.topSplit(rule.selector)) {
        const s = sel.trim();
        if (/:has\(/.test(s)) continue;
        const ctx = rule.ctx.join(' | ');
        for (const d of rule.decls) {
            if (d.nested) continue;
            decls++;
            const key = `${ctx}§${s}§${d.lname}`;
            const prev = last.get(key);
            if (prev && (d.important || !prev.important) && !lib.fragileValue(d.value)) {
                overridden.push({ selector: s, ctx, prop: d.lname, earlier: prev.module, later: mod, same: prev.module === mod, bytes: prev.bytes, value: prev.value, by: d.value });
            }
            if (prev && prev.important && d.important && prev.module !== mod) {
                const pair = `${prev.module} → ${mod}`;
                wars.set(pair, (wars.get(pair) || 0) + 1);
            }
            last.set(key, { module: mod, important: d.important, value: d.value, bytes: d.end - d.start });
        }
    }
}
const bytes = overridden.reduce((n, o) => n + o.bytes, 0);
const cross = overridden.filter(o => !o.same);
console.log(`[덮인 선언] 선언 ${decls}개 중 같은 조건 · 선택자 · 속성을 뒤에서 다시 써서 안 보이는 앞 선언 ${overridden.length}개 (약 ${(bytes / 1024).toFixed(1)}KB) · 그중 다른 모듈이 덮음 ${cross.length}`);
const byPair = new Map();
for (const o of cross) { const k = `${o.earlier} → ${o.later}`; byPair.set(k, (byPair.get(k) || 0) + 1); }
console.log('  다른 모듈끼리 많이 덮는 짝:');
for (const [k, n] of [...byPair].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`    ${n} ${k}`);
console.log(`[!important 싸움] 다른 모듈이 같은 선택자 · 속성을 둘 다 !important 로: ${[...wars.values()].reduce((a, b) => a + b, 0)}곳`);
for (const [k, n] of [...wars].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`    ${n} ${k}`);
const n = Number(argValue('--list') || 0);
for (const o of overridden.slice(0, n)) console.log(`  ${o.earlier}${o.same ? '' : ' → ' + o.later} ${o.ctx ? '[' + o.ctx + '] ' : ''}${o.selector} { ${o.prop}: ${o.value} } ← ${o.by}`);
const out = argValue('--json');
if (out) writeJson(out, { decls, overridden, wars: Object.fromEntries(wars) });
