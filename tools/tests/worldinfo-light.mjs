// 월드인포 큰 목록 경량화 (src/worldinfo-light.js + css/12-worldinfo.css) — 가짜 DOM 흉내.
// 목록 뿌리에만 childList 감시자 · 항목 80개 이상이면 bl-wi-light · 아래로 내려가면 뗀다 · 끄면 감시자 · 클래스를 뗀다. CSS 는 펼친 항목(아이콘 .up) · 드래그 중 항목을 뺀다.
//   node tools/tests/worldinfo-light.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

const classes = new Set();
const list = { id: 'world_popup_entries_list', entries: 0, classList: { contains: c => classes.has(c), toggle(c, force) { if (force) classes.add(c); else classes.delete(c); }, remove: c => classes.delete(c) },
    querySelectorAll(sel) { assert.equal(sel, ':scope > .world_entry', '직계 자식만 센다'); return Array.from({ length: list.entries }); } };
let present = true;
globalThis.document = { getElementById: id => (present && id === 'world_popup_entries_list' ? list : null) };
const observers = [];
class FakeMO { constructor(cb) { this.cb = cb; observers.push(this); } observe(target, opts) { this.target = target; this.opts = opts; } disconnect() { this.dead = true; } }
globalThis.MutationObserver = FakeMO;

const wl = await import(pathToFileURL(path.join(root, 'src/worldinfo-light.js')));
t('기준은 80개', () => assert.equal(wl.THRESHOLD, 80));
list.entries = 25;
wl.syncWorldInfoLight(true);
t('켜면 목록 뿌리에만 childList 감시자(subtree 없음) · 25개(기본 쪽 크기)면 가볍게 아님', () => {
    assert.equal(observers.length, 1); assert.equal(observers[0].target, list); assert.deepEqual(observers[0].opts, { childList: true });
    assert.deepEqual(wl._forTest.state(), { on: true, watching: true, light: false });
});
t('두 번 켜도 감시자 하나', () => { wl.syncWorldInfoLight(true); assert.equal(observers.length, 1); });
t('항목이 다시 그려져 80개가 되면(감시자 알림) bl-wi-light', () => { list.entries = 80; observers[0].cb([]); assert.equal(wl._forTest.state().light, true); });
t('79개로 줄면 뗀다', () => { list.entries = 79; observers[0].cb([]); assert.equal(wl._forTest.state().light, false); });
t('500개 → 가볍게 · measure() 가 상태를 돌려준다', () => { list.entries = 500; assert.equal(wl.measure(), true); assert.ok(classes.has(wl.CLASS)); });
t('끄면 감시자 · 클래스를 떼고, 알림이 더 와도 아무 일 없다', () => {
    wl.syncWorldInfoLight(false);
    assert.ok(observers[0].dead); assert.ok(!classes.has(wl.CLASS)); assert.deepEqual(wl._forTest.state(), { on: false, watching: false, light: false });
    assert.equal(wl.measure(), false);
});
t('목록이 아직 없으면 켜도 걸지 않는다 · 다음 켜기에 생기면 건다', () => {
    present = false; wl.syncWorldInfoLight(true); assert.equal(wl._forTest.state().watching, false);
    present = true; wl.syncWorldInfoLight(true); assert.equal(observers.length, 2); assert.equal(wl._forTest.state().light, true, '500개 그대로니 바로 가볍게');
    wl.syncWorldInfoLight(false);
});

// ---- CSS · 연결
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
t('CSS: .bl-wi-light 의 접힌 항목에만 content-visibility:auto + contain-intrinsic-size · 펼친 항목(아이콘 .up) · 드래그 중 · 자리표시는 제외 · style.css 에 들어 있다', () => {
    const css = read('css/12-worldinfo.css');
    const rule = css.match(/body\.salty #WorldInfo #world_popup_entries_list\.bl-wi-light > \.world_entry([^{]*)\{([^}]*)\}/);
    assert.ok(rule, '규칙이 있다');
    assert.ok(rule[1].includes(':not(.ui-sortable-helper, .ui-sortable-placeholder)'), '드래그 중 · 자리표시 제외');
    assert.ok(rule[1].includes(':not(:has(> form > .inline-drawer > .inline-drawer-header .inline-drawer-icon.up))'), '펼친 항목(아이콘 .up) 제외');
    assert.ok(!/\[\s*style/.test(rule[1]), ':has 안에 inline style 선택자를 두지 않는다 (long-chat-perf 규칙)');
    assert.match(rule[2], /content-visibility:\s*auto/); assert.match(rule[2], /contain-intrinsic-size:\s*auto 56px/);
    assert.ok(read('style.css').includes('#world_popup_entries_list.bl-wi-light > .world_entry'), 'style.css 다시 만들었다');
});
t('설정 chat.worldInfoLight 기본 켬 · 보정 · 초기화에서 남김 · CHAT_BEHAVIOR · features(바이바이면 쉼) · 패널 줄 · 라벨 · CI', () => {
    const settings = read('src/settings.js');
    assert.match(settings, /codePlain: false, worldInfoLight: true,/); assert.match(settings, /s\.chat\.worldInfoLight = flag\(s\.chat\.worldInfoLight, true\)/); assert.match(settings, /'codePlain', 'worldInfoLight'[^\]]*\]\) \{/);
    assert.match(read('src/styles.js'), /'codePlain', 'worldInfoLight'[^\]]*\];/);
    assert.match(read('src/features.js'), /const worldInfoLight = on && s\.chat\?\.worldInfoLight !== false && !restingFor\('worldInfoLight'\);\n\s+if \(worldInfoLight \|\| modules\.wilight\) load\('wilight', '\.\/worldinfo-light\.js'\)\.then\(m => m\?\.syncWorldInfoLight\(worldInfoLight\)\)/);
    const panel = read('src/panel.js'); assert.ok(panel.includes("toggle('chat.worldInfoLight', s.chat.worldInfoLight !== false)") && panel.includes("restNote('worldInfoLight')"));
    assert.ok(read('src/settings-labels.js').includes('"chat.worldInfoLight":"월드인포 긴 목록 가볍게"'));
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/worldinfo-light\.mjs \./);
});

console.log(`PASS worldinfo-light: ${n} checks`);
