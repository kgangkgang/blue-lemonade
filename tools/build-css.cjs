#!/usr/bin/env node
/* =========================================================
   style.css 만들기 (3.0.0) — tools/build-css.cjs

   원본은 css/*.css (이름 순서 = 폭포 순서). 이 도구가 차례대로 이어 붙여 style.css 를 쓴다.
   설치 · zip · 깃허브는 지금처럼 style.css 한 파일만 쓴다 (css/ 는 개발용).
   설명 주석은 css/ 에만 두고 style.css 에서는 뺀다 (모듈마다 'css/이름' 표시 주석 한 줄만 남김) — 뺀 결과의 규칙 구조가
   원본과 같은지 매번 확인하고, 다르면 멈춘다. 규칙을 찾을 때는 style.css 의 모듈 표시로 css/ 파일을 연다.

     node tools/build-css.cjs            css/ → style.css
     node tools/build-css.cjs --check    다시 만들면 style.css 와 같은가만 본다 (다르면 종료 코드 1)
     node tools/build-css.cjs --force    style.css 를 손으로 고친 흔적이 있어도 덮어쓴다 (그 고친 것은 사라진다)

   지키는 것
   · style.css 를 직접 고치면 다음 빌드가 그걸 지운다 → 머리 주석의 해시로 알아채고 멈춘다.
     그럴 땐 고친 규칙을 알맞은 css/ 모듈로 옮긴 뒤 --force.
   · css/99-lazy-panel.css 는 반드시 맨 뒤 (src/lite.js 가 이 칸을 통째로 작은 <style> 로 떼어
     서랍 · 팝업이 열렸을 때만 켠다 — 맨 뒤라서 떼어 내도 폭포 순서가 그대로다). 그 뒤에 모듈을 두면 멈춘다.
   · 모듈 파일 이름: 두 자리 숫자-이름.css (생성 모듈은 .gen.css), 첫 줄은 머리 주석 '/* ===== css/<이름> ====='
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'css');
const OUT = path.join(ROOT, 'style.css');
// 게으른 칸(99-lazy-panel) 만 따로 한 벌 더 — src/lite.js 가 시작할 때 이것만 받는다.
// 예전에는 1.8KB 를 얻으려고 style.css 842KB 를 다시 받아 통째로 문자열로 풀었다.
// src/ 아래여야 한다 — release_gate 의 inventory 는 최상위 4개 + src/**.{js,css} 만 담는다.
const LAZY_OUT = path.join(ROOT, 'src', 'lazy-panel.gen.css');
const LAZY = '99-lazy-panel.css';
const LAZY_SENTINEL = '#salty-lazy-panel-start';
const HASH_SLOT = '@@HASH@@';

function modules(dir = CSS_DIR) {
    const names = fs.readdirSync(dir).filter(n => n.endsWith('.css')).sort();
    const bad = names.filter(n => !/^\d\d-[a-z0-9.-]+\.css$/.test(n));
    if (bad.length) throw new Error(`모듈 이름 규칙(두 자리 숫자-이름.css)에 안 맞음: ${bad.join(', ')}`);
    const dup = names.map(n => n.slice(0, 2)).filter((p, i, a) => a.indexOf(p) !== i);
    if (dup.length) throw new Error(`같은 번호가 두 번: ${[...new Set(dup)].join(', ')}`);
    if (!names.includes(LAZY)) throw new Error(`${LAZY} 가 없음`);
    if (names[names.length - 1] !== LAZY) throw new Error(`${LAZY} 뒤에 모듈이 있음: ${names.slice(names.indexOf(LAZY) + 1).join(', ')} — 게으른 칸은 맨 뒤여야 한다`);
    return names;
}

/**
 * 주석 빼기 (3.0.0): 설명은 css/ 모듈에 두고 설치되는 style.css 에서는 뺀다 (730KB → 약 550KB, gzip 150KB → 75KB).
 * 주석 양옆이 둘 다 낱말 글자면(예: `.a/(주석)/.b`, `1px/(주석)/2px`) 빼면 두 토큰이 붙어 뜻이 바뀔 수 있어 그대로 둔다.
 * 문자열 · 따옴표 없는 url( … ) 안은 건드리지 않는다. 빈 줄 · 줄 끝 공백도 정리한다.
 */
function stripCss(text) {
    let out = '';
    let kept = 0;
    let i = 0;
    const SAFE = /[\s{};,]/;
    while (i < text.length) {
        const c = text[i];
        if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < text.length && text[j] !== c && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
            out += text.slice(i, j + 1);
            i = j + 1;
            continue;
        }
        if ((c === 'u' || c === 'U') && /^url\(\s*[^"'\s)]/i.test(text.slice(i, i + 6)) && !/[\w-]/.test(text[i - 1] || '')) {
            const j = text.indexOf(')', i);
            out += text.slice(i, j + 1);
            i = j + 1;
            continue;
        }
        if (c === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            const j = end < 0 ? text.length : end + 2;
            const prev = out[out.length - 1];
            const next = text[j];
            if (prev === undefined || next === undefined || SAFE.test(prev) || SAFE.test(next)) { i = j; continue; }
            kept++;
            out += text.slice(i, j);
            i = j;
            continue;
        }
        out += c;
        i++;
    }
    const tidy = out.split('\n').map(l => l.replace(/[ \t]+$/, '')).filter(l => l.trim()).join('\n');
    return { text: tidy, kept };
}

/** 두 CSS 의 규칙 구조(조건 · 선택자 · 선언)가 같은가 — 주석 빼기가 뜻을 바꾸지 않았는지 */
function sameStructure(a, b) {
    const L = require('./css-lib.cjs');
    const sig = (t) => {
        const out = [];
        const walk = (nodes, ctx) => {
            for (const n of nodes) {
                if (n.type === 'rule') out.push(`${ctx} || ${n.selector} { ${n.decls.map(d => `${d.lname}:${L.stripComments(d.value).replace(/\s+/g, ' ')}${d.important ? '!' : ''}`).join(';')} }`);
                else if (n.type === 'at') { if (n.children) walk(n.children, `${ctx} / ${n.prelude}`); else out.push(`${ctx} @ ${L.stripComments(t.slice(n.start, n.end)).replace(/\s+/g, ' ')}`); }
            }
        };
        const tree = L.parse(t);
        if (tree.problems.length) throw new Error(`읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
        walk(tree.children, '');
        return out;
    };
    const x = sig(a), y = sig(b);
    if (x.length !== y.length) return `규칙 수 ${x.length} ≠ ${y.length}`;
    for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return `${k}번째 규칙이 다름:\n  원본 ${x[k].slice(0, 200)}\n  빌드 ${y[k].slice(0, 200)}`;
    return null;
}

function build(dir = CSS_DIR, { bucket = true } = {}) {
    const names = modules(dir);
    const raw = [];
    const parts = [];
    let kept = 0;
    for (const name of names) {
        let text = fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n');
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        if (name === LAZY && !text.includes(`${LAZY_SENTINEL} {}`)) throw new Error(`${LAZY} 에 시작 표시 규칙 '${LAZY_SENTINEL} {}' 가 없음`);
        // 모듈마다 머리 주석이 있어야 한다 (모듈의 설명 · 넣을 규칙)
        if (!text.startsWith(`/* ===== css/${name} =====`)) throw new Error(`${name} 이 머리 주석 '/* ===== css/${name} =====' 으로 시작하지 않음`);
        raw.push(text);
        const s = stripCss(text);
        kept += s.kept;
        // style.css 에서 어느 모듈인지 보이게 한 줄만
        parts.push(`/* css/${name} */\n${s.text}\n`);
    }
    const stripped = parts.join('');
    const bad = sameStructure(raw.join('\n'), stripped);
    if (bad) throw new Error(`주석을 뺀 결과가 원본과 구조가 다름 — ${bad}`);
    // 3.6.0: 맨 오른쪽 칸이 여러 갈래 :is( … ) 인 선택자를 펼쳐 크롬 규칙 묶음에 넣는다 (tools/css-bucket.cjs — 스스로 뜻 · 특이도를 확인)
    const expanded = bucket ? require('./css-bucket.cjs').bucketize(stripped).text : stripped;
    // 4.8.4: 미리보기 전용 규칙은 `@media not all { }` 로 감싸 꺼 둔 채 싣는다 (tools/css-park.cjs — src/lite.js 가 설정창을 열 때 켠다)
    const parked = require('./css-park.cjs').park(expanded);
    const body = parked.text;
    const head = `/* Blue Lemonade style.css — tools/build-css.cjs 가 css/ 의 모듈 ${names.length}개를 이어 붙여 만든 파일(설명 주석은 css/ 에만). 여기서 고치지 말고 css/ 를 고친 뒤 node tools/build-css.cjs (build ${HASH_SLOT}) */\n`;
    const draft = head + body;
    const digest = hashOf(draft);
    return { text: draft.replace(HASH_SLOT, digest), names, digest, kept, parked };
}
function hashOf(textWithSlot) {
    return crypto.createHash('sha1').update(textWithSlot, 'utf8').digest('hex').slice(0, 12);
}
/** style.css 가 마지막 빌드 그대로인가 (머리 주석의 해시로) */
function untouched(text) {
    const m = /\(build ([0-9a-f]{12})\) \*\/\n/.exec(text.slice(0, 400));
    if (!m) return false;
    return hashOf(text.replace(`(build ${m[1]})`, `(build ${HASH_SLOT})`)) === m[1];
}

function firstDiff(a, b) {
    const la = a.split('\n'), lb = b.split('\n');
    for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) return { line: i + 1, was: la[i], now: lb[i] };
    return null;
}

function main(argv) {
    const check = argv.includes('--check');
    const force = argv.includes('--force');
    const { text, names, parked } = build();
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
    if (check) {
        if (current === text) { console.log(`[같음] style.css = css/ 모듈 ${names.length}개`); return 0; }
        const d = current == null ? null : firstDiff(current, text);
        console.error(`[다름] style.css 가 css/ 와 어긋났다${d ? ` — ${d.line}번째 줄\n  지금: ${String(d.was).slice(0, 160)}\n  빌드: ${String(d.now).slice(0, 160)}` : ''}`);
        console.error(current && !untouched(current) ? '  style.css 를 손으로 고친 흔적이 있다 → 고친 규칙을 css/ 로 옮기고 node tools/build-css.cjs --force' : '  node tools/build-css.cjs 로 다시 만들 것');
        return 1;
    }
    if (current === text) {
        // style.css 가 이미 최신이어도 꼬리 파일은 없거나 어긋날 수 있다 (처음 도입 · 손으로 지움)
        const tail = lazyTail(text);
        const had = fs.existsSync(LAZY_OUT) ? fs.readFileSync(LAZY_OUT, 'utf8') : null;
        if (had !== tail) { fs.writeFileSync(LAZY_OUT, tail, 'utf8'); console.log(`[씀] src/lazy-panel.gen.css (${(Buffer.byteLength(tail) / 1024).toFixed(1)}KB)`); }
        console.log(`[그대로] style.css 가 이미 최신 (모듈 ${names.length}개)`);
        return 0;
    }
    if (current != null && !untouched(current) && !force) {
        const d = firstDiff(current, text);
        console.error('[멈춤] style.css 가 마지막 빌드 뒤에 손으로 고쳐졌다 — 덮어쓰면 그 고친 것이 사라진다.');
        if (d) console.error(`  처음 다른 곳 ${d.line}번째 줄\n  지금: ${String(d.was).slice(0, 160)}\n  빌드: ${String(d.now).slice(0, 160)}`);
        console.error('  고친 규칙을 알맞은 css/ 모듈로 옮긴 뒤 node tools/build-css.cjs --force');
        return 1;
    }
    fs.writeFileSync(OUT, text, 'utf8');
    fs.writeFileSync(LAZY_OUT, lazyTail(text), 'utf8');
    console.log(`[씀] style.css ← css/ 모듈 ${names.length}개 (${(Buffer.byteLength(text) / 1024).toFixed(1)}KB) · src/lazy-panel.gen.css ${(Buffer.byteLength(lazyTail(text)) / 1024).toFixed(1)}KB · 미리보기 전용 규칙 ${parked.rules}개를 not all 덩어리 ${parked.blocks}개로 꺼 둠`);
    return 0;
}

if (require.main === module) {
    try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(`[오류] ${e.message}`); process.exitCode = 1; }
}

/** style.css 에서 게으른 칸 시작 표시 뒤를 그대로 잘라 낸다 (src/lite.js 가 비교하는 글과 같아야 한다) */
function lazyTail(text) {
    const mark = `${LAZY_SENTINEL} {}`;
    const at = text.lastIndexOf(mark);
    if (at < 0) throw new Error(`style.css 에 게으른 칸 표시 '${mark}' 가 없음`);
    return text.slice(at + mark.length);
}

module.exports = { build, modules, untouched, LAZY, LAZY_SENTINEL, CSS_DIR, lazyTail, LAZY_OUT };
