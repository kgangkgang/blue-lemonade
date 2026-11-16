// 떠 있는 작은 메뉴(채팅 정리 ⋮ · 프롬프트 폴더 ⋮ · 편의 기능 공용 메뉴)의 바깥을 눌러 닫을 때, 손을 뗄 때의 click 을 한 번 삼키는지.
//   세 메뉴는 화면을 덮는 층을 pointerdown 에서 바로 떼요 — 폰에서는 뒤따르는 click 이 층이 사라진 자리(목록 줄 · 프롬프트 스위치)에 떨어졌어요(1.5.8 까지 세 곳 모두 지킴 없음).
//   채팅 정리는 chat-organizer.mjs 가 진짜 화면으로 봐요. 여기서는 세 파일의 swallowNextClick 을 잘라 같은 동작인지 보고, 바깥 누름 줄이 그것을 부르는지 봐요.
//   node tools/tests/menu-outside-click.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const FILES = ['src/chat-organizer.js', 'src/prompt-folders.js', 'src/quick/shared.js'];
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };

function fakeDocument() {
    const ls = [];
    return { ls,
        addEventListener(type, fn, capture) { ls.push({ type, fn, capture }); },
        removeEventListener(type, fn, capture) { const i = ls.findIndex(l => l.type === type && l.fn === fn && l.capture === capture); if (i >= 0) ls.splice(i, 1); },
        fire(type, init = {}) { const e = { type, isTrusted: true, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...init }; for (const l of [...ls]) if (l.type === type) l.fn(e); return e; } };
}
for (const file of FILES) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const start = source.indexOf('\nfunction swallowNextClick(');
    test(`${file}: 바깥 누름으로 닫을 때 swallowNextClick 을 불러요`, () => {
        assert.ok(start >= 0, 'swallowNextClick 이 있어요');
        assert.ok(source.includes("if (event.target === layer) { event.preventDefault(); closeMenu(); swallowNextClick(); }"));
    });
    const body = source.slice(start + 1, source.indexOf('\n}\n', start) + 3);
    const make = () => { const document = fakeDocument(); const timers = []; const run = new Function('document', 'setTimeout', 'clearTimeout', `${body}; return swallowNextClick;`)(document, (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, id => { timers[id - 1].cleared = true; }); return { document, timers, run }; };
    test(`${file}: 손 click 한 번만 삼키고 리스너를 다 떼요`, () => {
        const t = make(); t.run();
        assert.ok(t.document.ls.every(l => l.capture === true), '캡처 단계');
        const first = t.document.fire('click');
        assert.ok(first.prevented && first.stopped);
        assert.equal(t.document.ls.length, 0); assert.ok(t.timers[0].cleared);
    });
    test(`${file}: 코드가 부른 click 은 그대로 · 다음 누름 · 키 · 시간이 지나면 풀려요`, () => {
        let t = make(); t.run();
        const scripted = t.document.fire('click', { isTrusted: false });
        assert.ok(!scripted.prevented && !scripted.stopped); assert.equal(t.document.ls.length, 3, '아직 기다려요');
        t.document.fire('pointerdown'); assert.equal(t.document.ls.length, 0, '다음 누름이 시작되면 풀려요');
        assert.ok(!t.document.fire('click').prevented);
        t = make(); t.run(); t.document.fire('keydown'); assert.equal(t.document.ls.length, 0);
        t = make(); t.run(); assert.ok(t.timers[0].ms > 0 && t.timers[0].ms <= 1500); t.timers[0].fn(); assert.equal(t.document.ls.length, 0, '시간이 지나면 풀려요');
    });
}
test('src/quick/preset-folders.js: 프리셋 폴더 목록도 바깥 누름으로 닫을 때 같은 지킴(shared.js 것)을 불러요', () => {
    const source = fs.readFileSync(path.join(root, 'src/quick/preset-folders.js'), 'utf8');
    assert.ok(source.includes("if (event.target === layer) { event.preventDefault(); close(); swallowNextClick(); }"));
    assert.ok(source.includes('swallowNextClick } from ' + JSON.stringify('./shared.js').replaceAll(String.fromCharCode(34), String.fromCharCode(39))), 'shared.js 에서 가져와요');
    assert.ok(fs.readFileSync(path.join(root, 'src/quick/shared.js'), 'utf8').includes('export { swallowNextClick };'));
});
console.log(`menu-outside-click: ${passed} passed`);
