// 미트볼 상태창 2.9.0 위치 칸 펼침 「갈 곳」 — 스위치 「위치를 누르면 갈 곳 보기」(locgo) 켬 / 끔과 옛 판(2.8.0) 안전
//   ① 표: 화면 스위치 · 기본 켬 · 설정 찾기에 한 줄 ② 시트 원본: 묶음 자리 · 2.9.0 펼침 칸(.ss-t-det.loc)에만 걸림 · :has 없음 · 박힌 색 없음 · 틈은 간격 토큰
//   ③ 켬 / 끔 / 띠 맞춤까지 끔 세 상태에서 어느 규칙이 이기는지(사본의 묶음 문을 읽어 따져요) ④ 손가락 화면: 한 줄 가로 밀기 · 누를 자리 44
//   node tools/tests/mb-locgo.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const require = createRequire(import.meta.url);
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };

const SW = await import(pathToFileURL(path.join(root, 'src/mb-switch.js')).href);
const L = require(path.join(root, 'tools/css-lib.cjs'));
const src = read('src/ext-status.css').replace(/\r\n/g, '\n');
const gen = read('src/ext-status.gen.css');
const DET = '.ss-tb .ss-t-det.loc';

await ok('표: locgo 는 화면만 바꾸는 스위치 · 자리별 맞춤 묶음 · 기본 켬 · 끄면 표식에 적혀요', () => {
    const sw = SW.switchOf('locgo');
    assert.ok(sw, '스위치 표에 locgo');
    assert.equal(sw.kind, 'screen'); assert.equal(sw.group, 'place'); assert.equal(sw.css, true); assert.equal(sw.setting, undefined, '끈 열쇠 목록(chat.mbOff)을 써요');
    assert.equal(sw.name, '위치를 누르면 갈 곳 보기');
    assert.match(sw.more, /2\.9\.0/); assert.match(sw.more, /끄면 예전\(2\.8\.0\)처럼/); assert.match(sw.desc, /끄면 예전처럼/);   // 1.7.7 줄 밑은 한마디 · 자세한 설명은 「?」 창(more)
    assert.equal(SW.switchOn({ chat: {} }, 'locgo'), true, '옛 설정은 켬');
    const chat = {}; SW.setSwitch(chat, 'locgo', false);
    assert.deepEqual(chat.mbOff, ['locgo']); assert.equal(SW.offAttrValue({ chat }), 'locgo');
    SW.setSwitch(chat, 'locgo', true); assert.equal(SW.offAttrValue({ chat }), '');
});
await ok('설정 찾기: 「미트볼 맞춤: 위치를 누르면 갈 곳 보기」 줄이 스위치 표에서 저절로 생겨요', () => {
    const t = read('src/settings-search.js');
    assert.match(t, /MB_SWITCHES\.filter\(sw => !sw\.setting\)\.map\(sw => \['chat','screen',`미트볼 맞춤: \$\{sw\.name\}`/);
    assert.match(SW.switchOf('locgo').words, /갈 곳/); assert.match(SW.switchOf('locgo').words, /위치/);
});

// 원본에서 묶음별 규칙 모으기(표식 → 다음 표식)
const marks = [...src.matchAll(/\/\*\s*@mb\s+([a-z|]+)\s*\*\//g)].map(m => ({ at: m.index, key: m[1] }));
const keyAt = pos => { let k = null; for (const m of marks) { if (m.at < pos) k = m.key; else break; } return k; };
const srcRules = L.flatRules(L.parse(src, [])).filter(r => r.selector.includes('.ss-t-det.loc') || r.selector.includes('.ss-loc-'));
await ok('시트 원본: 갈 곳 규칙은 전부 2.9.0 펼침 칸(.ss-t-det.loc) 안 — 옛 판(2.8.0 · .loc 없음)에는 한 줄도 안 걸려요', () => {
    assert.ok(srcRules.length >= 20, `규칙 ${srcRules.length}개`);
    for (const r of srcRules) for (const part of L.topSplit(r.selector)) {
        assert.ok(part.includes(`body.salty:not([data-bl-ext-raw]) ${DET}`), `펼침 칸 밖: ${part}`);   // 「원작 그대로 보기」면 안 걸려요
        assert.ok(!/:has\(/.test(part), `:has 를 쓰지 않아요: ${part}`);
    }
    const groups = new Set(srcRules.map(r => keyAt(r.start)));
    assert.deepEqual([...groups].sort(), ['band', 'locgo'], '바탕(옛 한 줄 꼴)은 band · 다듬은 이동판은 locgo');
});
await ok('시트 원본: 박힌 색 없음(팔레트 토큰만) · 틈은 간격 토큰 · 새 그림 없음', () => {
    for (const r of srcRules) {
        const body = src.slice(r.bodyStart, r.bodyEnd);
        assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(body), `박힌 색: ${body.slice(0, 80)}`);
        assert.ok(!/url\(/.test(body), '그림 없음');
        for (const m of body.matchAll(/(?:^|[;{\s])gap:\s*([^;]+);/g)) if (keyAt(r.start) === 'locgo') assert.match(m[1], /^var\(--bl-s[12], \d+px\)( var\(--bl-s[12], \d+px\))?$/, `틈은 토큰으로: ${m[1]}`);
    }
});
await ok('시트 원본: 바탕(band) 넷이 다듬은 판(locgo)보다 앞 — 같은 무게라 뒤의 locgo 가 이겨요', () => {
    const base = srcRules.filter(r => keyAt(r.start) === 'band'), fine = srcRules.filter(r => keyAt(r.start) === 'locgo');
    assert.equal(base.length, 4);
    assert.ok(Math.max(...base.map(r => r.start)) < Math.min(...fine.map(r => r.start)));
    for (const b of base) assert.ok(fine.some(f => f.selector === b.selector), `locgo 가 덮는 짝이 없어요: ${b.selector}`);
});

// 사본(묶음 문 달린 것)으로 상태별 이기는 값 — 같은 선택자(무게 같음)끼리는 뒤 규칙이 이겨요
const genRules = L.flatRules(L.parse(gen, []));
const GATE = /^:where\(:root:not\(((?:\[data-bl-mb-off~="[a-z]+"\])+)\)\) > /;
function winner(tail, prop, off, { coarse = false } = {}) {
    let val;
    for (const r of genRules) {
        if (!coarse && /pointer:\s*coarse/.test(JSON.stringify(r.ctx || ''))) continue;
        for (const part of L.topSplit(r.selector)) {
            const m = GATE.exec(part.trim()); if (!m) continue;
            const keys = [...m[1].matchAll(/~="([a-z]+)"/g)].map(x => x[1]);
            if (keys.every(k => off.includes(k))) continue;   // 문: 적힌 열쇠가 모두 꺼져 있으면 안 걸려요
            if (part.trim().slice(m[0].length) !== `body.salty:not([data-bl-ext-raw]) ${DET}${tail}`) continue;
            const d = new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+);`).exec(gen.slice(r.bodyStart, r.bodyEnd) + ';');
            if (d) val = d[1].trim();
        }
    }
    return val;
}
await ok('켬(기본): 갈 곳 줄이 격자 칸으로 풀려 보이고 · 상자 · 머리 줄 · 「이 탭 열기 ›」 글 링크는 날짜 펼침과 같은 공용 꼴(11-20)', () => {
    assert.equal(winner(' > .ss-loc-row', 'display', []), 'contents');
    assert.equal(winner('', 'display', []), 'grid');
    // 11-20 사용자 「날짜 쪽 디자인으로 통일 · 글자 크기도」: 테두리 · 둥근 모서리 · 글자 크기는 덮지 않고(공용 .ss-t-det) · 안여백은 공용과 같은 5 / 8
    for (const prop of ['border', 'border-radius', 'font-size', 'line-height']) assert.equal(winner('', prop, []), undefined, `상자 ${prop} 를 덮지 않아요`);
    assert.equal(winner('', 'padding', []), '5px 8px');
    assert.equal(winner(' > .go', 'grid-column', []), '3'); assert.equal(winner(' > .go', 'grid-row', []), '1');
    for (const prop of ['border', 'height', 'padding', 'font-size', 'display', 'border-radius']) assert.equal(winner(' > .go', prop, []), undefined, `「이 탭 열기」 ${prop} 는 공용 글 링크 꼴 그대로`);
    assert.equal(winner(' > .ss-mini-line', 'min-height', []), undefined, '머리 줄 높이는 날짜 줄과 같게');
    assert.equal(winner(' > .ss-mini-line > span', 'color', []), undefined, '글 색은 날짜 줄과 같게');
    for (const tail of [' > .ss-loc-row > small', ' .ss-loc-go']) assert.equal(winner(tail, 'font-size', []), '.92em', `${tail} 글자 = 머리 줄 글자 크기`);
    assert.equal(winner(' > .ss-mini-line > span', 'font-size', []), 'inherit', '장소 설명도 보여요');
    assert.equal(winner(' .ss-loc-go', 'height', []), '26px', '칩 높이 = 띠 칸 높이');
});
await ok('끔: 예전(2.8.0)처럼 장소 이름 한 줄 — 갈 곳 · 지금 여기 줄과 장소 설명이 안 보여요', () => {
    assert.equal(winner(' > .ss-loc-row', 'display', ['locgo']), 'none');
    assert.equal(winner('', 'flex-direction', ['locgo']), 'row'); assert.equal(winner('', 'display', ['locgo']), undefined, '격자가 아니에요(띠 맞춤의 한 줄 flex)');
    assert.equal(winner(' > .ss-mini-line > span', 'font-size', ['locgo']), '0');
    assert.equal(winner(' > .ss-mini-line > span > b', 'font-size', ['locgo']), '10.12px', '장소 이름은 2.8.0 펼친 칸 글자 크기 그대로');
    assert.equal(winner(' .ss-loc-go', 'height', ['locgo']), undefined);
});
await ok('띠 맞춤(band)까지 끔: 갈 곳 규칙이 하나도 안 걸려요 = 원작 2.9.0 펼침 칸 그대로', () => {
    for (const [tail, prop] of [[' > .ss-loc-row', 'display'], ['', 'display'], ['', 'flex-direction'], [' > .ss-mini-line > span', 'font-size'], [' > .go', 'grid-column']]) assert.equal(winner(tail, prop, ['band', 'locgo']), undefined, `${tail} ${prop}`);
    assert.equal(winner(' > .ss-loc-row', 'display', SW.MB_KEYS), undefined, '전부 끄기');
});
await ok('손가락 화면: 갈 곳 칩은 한 줄에서 가로로 밀고(칸 높이 그대로) · 칩과 「이 탭 열기」 누를 자리 44', () => {
    assert.equal(winner(' .ss-loc-gos', 'flex-wrap', []), 'wrap', '마우스 화면은 줄바꿈');
    assert.equal(winner(' .ss-loc-gos', 'flex-wrap', [], { coarse: true }), 'nowrap');
    assert.equal(winner(' .ss-loc-gos', 'overflow-x', [], { coarse: true }), 'auto');
    assert.equal(winner(' .ss-loc-gos', 'margin-block', [], { coarse: true }), '-9px'); assert.equal(winner(' .ss-loc-gos', 'padding-block', [], { coarse: true }), '9px');
    const touch = src.slice(src.indexOf('@media (pointer: coarse) {'));
    assert.match(touch.slice(0, touch.indexOf('\n}\n')), /\.ss-loc-go::after, [^{]*> \.go::after \{ content: ''; position: absolute; inset: -10px -1px; \}/, '26 + 테두리 안쪽 기준 위아래 10 − 1 = 44');
    assert.equal(winner(' .ss-loc-gos', 'flex-wrap', ['locgo'], { coarse: true }), undefined, '끄면 손가락 화면 규칙도 안 걸려요');
});
console.log(`mb-locgo: ${n}개 통과`);
