// 8.0.9 데우스 V3 하늘(dem-sky.js) — 트래커 시각으로 해 · 달 자리, 날짜로 달 위상
//   node tools/tests/dem-sky.mjs <테마 루트>   (공개 저장소는 '.')
// 확인하는 것:
//   1) minutesOf: 12시간 · 24시간 · 오전/오후 · 「3시 20분」 꼴을 분으로, 글자만 있는 칸 이름(dawn)은 null
//   2) orbAt: 해는 6:00~19:00(양 끝 3%/97% · 33%, 한낮 꼭대기 0%), 달은 19:00~6:00 — 원작 9칸의 해/달 가름과 같은 경계
//   3) dayOf · phaseOf: 「5월 3일」 · ISO · 영어 달 이름에서 「일」, 1일 신월 · 16일 보름 · 글의 보름달/초승달 말이 먼저
//   4) 켜고 끄기: 요소에 --ox · --oy · --gx(달이면 --orb-m · --moon-r)를 인라인으로 덧씌우고, 끄면 모두 떼어 원작으로
//   6) 8.1.0 설정 창 미리보기의 숨은 표본 자리(dressDemSky): 스킨 켬이면 채팅과 같은 계산, 끔이면 떼기
//   5) 설정 · 기능 로더 · CSS: chat.demGlow 기본 35 · 0~100 · 이름표, features.js 가 dem-sky 를 부름, 30-dem-skin 이 --bl-dem-glow 를 씀, 「카드 이모티콘」 끔이 __glyph 도 숨김
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.'), url = pathToFileURL(root + '/');
const read = rel => fs.readFile(path.join(root, rel), 'utf8');
let passed = 0; const check = (name, fn) => { fn(); passed++; };

// 아주 작은 DOM 가짜: dem-sky.js 가 쓰는 것만(style.setProperty/removeProperty · dataset · querySelector(All) · getAttribute · textContent)
class El {
    constructor(attrs = {}, text = '', date = '') { this.attrs = attrs; this.text = text; this.dateText = date; this.vars = {}; this.dataset = {}; this.isConnected = true; this.style = { setProperty: (k, v) => { this.vars[k] = v; }, removeProperty: (k) => { delete this.vars[k]; } }; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    get textContent() { return this.text; }
    querySelector(sel) { return sel.includes('__date') && this.dateText ? { textContent: this.dateText } : null; }
}
const tracks = [];
const events = {};
globalThis.document = { querySelectorAll: () => tracks, getElementById: () => null };
globalThis.SillyTavern = { getContext: () => ({ eventSource: { on: (n, f) => { events[n] = f; }, removeListener: (n) => { delete events[n]; } }, event_types: { CHAT_CHANGED: 'chat', CHARACTER_MESSAGE_RENDERED: 'char', MESSAGE_UPDATED: 'upd' } }) };
globalThis.MutationObserver = class { observe() { } disconnect() { } takeRecords() { } };
globalThis.queueMicrotask = fn => fn();

const sky = await import(new URL('src/dem-sky.js', url));

check('시각 읽기: 12시간 · 24시간 · 오전/오후 · 시분 꼴', () => {
    assert.equal(sky.minutesOf('3:20 PM'), 920); assert.equal(sky.minutesOf('15:20'), 920); assert.equal(sky.minutesOf('오후 3:20'), 920);
    assert.equal(sky.minutesOf('3시 20분 오후'), 920); assert.equal(sky.minutesOf('12:00 AM'), 0); assert.equal(sky.minutesOf('12:00 PM'), 720);
    assert.equal(sky.minutesOf('09:46 AM'), 586); assert.equal(sky.minutesOf('dawn'), null); assert.equal(sky.minutesOf(''), null);
});
check('해 · 달 가름과 호 위의 자리(원작 칸 경계 6:00 · 19:00, 양 끝 3/97 · 33, 꼭대기 0)', () => {
    const a = sky.orbAt(360); assert.equal(a.sun, true); assert.equal(a.x, 3); assert.equal(a.y, 33);
    const noon = sky.orbAt(750); assert.equal(noon.sun, true); assert.equal(noon.x, 50); assert.equal(noon.y, 0);
    const dusk = sky.orbAt(1139); assert.equal(dusk.sun, true); assert.ok(dusk.x > 96 && dusk.y > 32);
    const eve = sky.orbAt(1140); assert.equal(eve.sun, false); assert.equal(eve.x, 3); assert.equal(eve.y, 33);
    const mid = sky.orbAt(30); assert.equal(mid.sun, false); assert.ok(mid.x > 40 && mid.x < 60 && mid.y < 2);
    const pre = sky.orbAt(359); assert.equal(pre.sun, false); assert.ok(pre.x > 96);
    for (let m = 0; m < 1440; m += 7) { const o = sky.orbAt(m); assert.ok(o.x >= 3 && o.x <= 97 && o.y >= 0 && o.y <= 33, String(m)); }
});
check('날짜의 「일」 과 위상 8단계(1일 신월 · 16일 보름), 글의 달 모양 말이 먼저', () => {
    assert.equal(sky.dayOf('가상력 12년 5월 3일 목요일'), 3); assert.equal(sky.dayOf('October 27, Tuesday, 2026'), 27);
    assert.equal(sky.dayOf('2026-10-27'), 27); assert.equal(sky.dayOf('16 October'), 16); assert.equal(sky.dayOf('3rd of May'), 3); assert.equal(sky.dayOf('없음'), null);
    assert.equal(sky.phaseOf(1), 0); assert.equal(sky.phaseOf(8), 2); assert.equal(sky.phaseOf(16), 4); assert.equal(sky.phaseOf(23), 6); assert.equal(sky.phaseOf(30), 0); assert.equal(sky.phaseOf(31), 0);
    assert.equal(sky.phaseOf(null), 1); assert.equal(sky.phaseOf(3, '오늘은 보름달이 떴다'), 4); assert.equal(sky.phaseOf(16, 'a thin crescent moon'), 1); assert.equal(sky.phaseOf(16, '그믐달'), 7);
});
check('켜면 요소에 자리 · 달 마스크를 덧씌우고, 끄면 전부 떼어 원작으로', async () => {
    const sun = new El({ 'data-t': '3:20 PM' }, '…', '가상력 12년 5월 3일 목요일');
    const moon = new El({ 'data-t': '9:40 PM' }, '…', '가상력 12년 5월 16일 금요일');
    const word = new El({ 'data-t': 'dawn' }, '…', '');
    tracks.push(sun, moon, word);
    sky.syncDemSky(true);
    assert.ok(events.char, '이벤트를 건다');
    await new Promise(r => setTimeout(r, 150));
    assert.equal(sun.vars['--ox'], '70.5%'); assert.equal(sun.vars['--oy'], '7.4%'); assert.equal(sun.vars['--gx'], '70.5%'); assert.equal(sun.vars['--orb-m'], undefined);
    assert.equal(moon.vars['--orb-m'], 'none', '16일 = 보름달'); assert.equal(moon.vars['--moon-r'], '0deg'); assert.ok(moon.vars['--ox']);
    assert.deepEqual(word.vars, {}, '칸 이름만 있는 시각은 원작 그대로');
    sky.syncDemSky(false);
    assert.deepEqual(sun.vars, {}); assert.deepEqual(moon.vars, {}); assert.equal(sun.dataset.blSky, undefined); assert.equal(events.char, undefined, '이벤트를 뗀다');
});
check('8.1.0 설정 창 미리보기의 숨은 표본 자리도 채팅과 같은 계산으로 입히고(스킨 켬) 떼요(스킨 끔)', () => {
    const day = new El({ 'data-t': '3:20 PM' }, '…', '가상력 12년 5월 3일 목요일'), night = new El({ 'data-t': '9:40 PM' }, '…', '가상력 12년 5월 16일 토요일');
    let asked = '';
    const host = { querySelectorAll: sel => { asked = sel; return [day, night]; } };
    sky.dressDemSky(host, true);
    assert.equal(asked, '.custom-dem-track[data-t]', '표본 자리 안의 트래커만');
    assert.equal(day.vars['--ox'], '70.5%'); assert.equal(day.vars['--orb-m'], undefined, '낮은 해');
    assert.equal(night.vars['--orb-m'], 'none', '16일 밤은 보름달'); assert.ok(night.vars['--oy']);
    sky.dressDemSky(host, false);
    assert.deepEqual(day.vars, {}); assert.deepEqual(night.vars, {}, '스킨을 끄면 원작으로');
    sky.dressDemSky(null, true); // 자리가 없으면 아무것도 안 해요
    const ui = fsSync.readFileSync(path.join(root, 'src/fruit-type-ui.js'), 'utf8');
    assert.ok(ui.includes("dressDemSky(fragHost.host,skinOn())"), '표본을 옮기기 전에 하늘을 입혀요');
    assert.ok(ui.includes("classList.contains('salty-dem-skin')"), '채팅과 같은 조건(카드 스킨)');
});
check('설정 · 로더 · CSS 연결', async () => {
    const settings = await read('src/settings.js'), features = await read('src/features.js'), apply = await read('src/apply.js'), css = await read('css/30-dem-skin.css'), unify = await read('css/08-regex-unify.css'), labels = await read('src/settings-labels.js'), panel = await read('src/panel.js');
    assert.match(settings, /s\.chat\.demGlow = .*: 35/); assert.match(apply, /'--bl-dem-glow'/); assert.match(features, /dem-sky\.js/);
    assert.match(css, /var\(--bl-dem-glow, \.35\)/); assert.match(css, /--salty-accent\) 20%, transparent\) !important/, '기온 칩은 투명 틴트');
    assert.match(unify, /\.custom-dem-track__glyph \{\s*display: none !important/); assert.ok(labels.includes('"chat.demGlow":"테두리 빛"')); assert.match(panel, /slider\('chat\.demGlow', '테두리 빛', 0, 100, 5, 35\)/);
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css.split('8.0.6 데우스 V3')[1].replace(/#0000\b/g, '').replace(/#salty-none/g, '')), 'V3 절에 고정 색이 없다(팔레트 변수만)');
});
console.log(`dem-sky: ${passed} passed`);
