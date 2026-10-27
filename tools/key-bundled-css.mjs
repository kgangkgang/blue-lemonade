#!/usr/bin/env node
// 8.0.8: 내장 스크립트가 실행 중에 <style> 로 넣는 CSS 에도 규칙 바구니 열쇠(tools/css-key.cjs)를 단다.
//   지금은 src/scripts/bundled/fruit-style.js 하나 — `installFruitStyle(BlueLemonade, "…CSS…")` 의 글자열 리터럴.
//   과일의 마음 창 규칙 215갈래가 `:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) …` 꼴이라
//   크롬이 조상 빠른 거절을 못 해 채팅 300 을 연 문서 전체 다시 계산마다 요소 3.5만 × 215규칙을 끝까지 견줬다(규칙 하나 16ms → 1.3ms).
//   node tools/key-bundled-css.mjs            열쇠를 달아 bundled/fruit-style.js 를 고쳐 쓴다 (그 뒤 node tools/build-plain-scripts.mjs · build-integrity)
//   node tools/key-bundled-css.mjs --check    이미 달려 있는지만 본다 (다르면 종료 코드 1)
//   리터럴은 JSON 으로 읽고 JSON 으로 다시 써서 CSS 글 말고는 한 글자도 안 바뀐다(되읽어 확인). 두 번 돌려도 같다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const K = require(path.join(root, 'tools/css-key.cjs'));
const check = process.argv.includes('--check');
const FILES = [['src/scripts/bundled/fruit-style.js', 'installFruitStyle(BlueLemonade, ']];

function literalEnd(s, q) {   // q = 여는 따옴표 자리 → 닫는 따옴표 자리
    let j = q + 1;
    while (j < s.length) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === '"') return j; j++; }
    throw new Error('글자열 리터럴이 안 닫힘');
}
let stale = 0;
for (const [rel, marker] of FILES) {
    const file = path.join(root, rel);
    const raw = fs.readFileSync(file, 'utf8');
    const at = raw.indexOf('export default ');
    if (at < 0) throw new Error(`${rel}: export default 가 없음`);
    const head = raw.slice(0, at + 'export default '.length);
    const tail = raw.slice(at + 'export default '.length);
    const semi = tail.lastIndexOf(';');
    const outer = tail.slice(0, semi), after = tail.slice(semi);
    const script = JSON.parse(outer);
    if (JSON.stringify(script) !== outer) throw new Error(`${rel}: 바깥 리터럴을 그대로 다시 쓰지 못함(모양이 다름)`);
    const i = script.indexOf(marker + '"');
    if (i < 0) throw new Error(`${rel}: ${marker}" 가 없음`);
    const q = i + marker.length, e = literalEnd(script, q);
    const lit = script.slice(q, e + 1);
    const css = JSON.parse(lit);
    if (JSON.stringify(css) !== lit) throw new Error(`${rel}: CSS 리터럴을 그대로 다시 쓰지 못함(모양이 다름)`);
    const { text, stats } = K.keyize(css);
    const next = script.slice(0, q) + JSON.stringify(text) + script.slice(e + 1);
    const out = head + JSON.stringify(next) + after;
    const same = out === raw;
    const again = K.keyize(text);
    if (again.text !== text) throw new Error(`${rel}: 두 번 돌리면 달라짐`);
    console.log(`${rel}: 갈래 ${stats.branches} · 조상 열쇠 ${stats.ancestor} · 주어 열쇠 ${stats.keyed} · 풀기 ${stats.unwrapped} · ${same ? '[같음] 이미 달려 있음' : check ? '[다름] 열쇠가 안 달려 있음' : '[씀]'}`);
    if (!same) { stale++; if (!check) fs.writeFileSync(file, out); }
}
if (check && stale) process.exitCode = 1;
