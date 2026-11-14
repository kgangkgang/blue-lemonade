// 1.4.x 최적화 3차: 과일 창 꾸미기(src/scripts/plain/fruit-style.js)의 다섯 설치가 함께 쓰는 감시 하나(fruitWatchHub)
//   — 예전 감시 열(설치마다 html · body 자식 감시 + 과일 창 subtree 감시)이 받던 기록 종류 그대로, 그 설치만 · 설치 차례대로 깨우는지
//   node tools/tests/fruit-style-hub.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scriptCode } from './script-code.mjs';
const root = path.resolve(process.argv[2] || '.');
const bundled = await scriptCode(root, 'fruit-style');
const at = bundled.lastIndexOf('installFruitStyle(BlueLemonade, ');
const H = new Function(bundled.slice(0, at) + '\nreturn { fruitWatchHub, FW_HELP, FW_READING, FW_SKIN, FW_HOME, FW_EXTRA };')();
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); } };

function rig() {
    const node = name => ({ name, contains(t) { for (let n = t; n; n = n.parent) if (n === this) return true; return false; } });
    const html = node('html'), body = node('body'); body.parent = html;
    const panel = node('fruit'); panel.parent = html;
    const inner = node('inner'); inner.parent = panel;
    const doc = { documentElement: html, body };
    const observers = [];
    class MO { constructor(cb) { this.cb = cb; this.regs = []; this.pending = []; this.disconnects = 0; observers.push(this); } observe(t, o) { this.regs.push([t, o]); } disconnect() { this.regs = []; this.pending = []; this.disconnects++; } takeRecords() { const p = this.pending; this.pending = []; return p; } }
    const hub = H.fruitWatchHub(doc, { MutationObserver: MO });
    const woke = [];
    const subs = Object.fromEntries(['help', 'reading', 'skin', 'home', 'extra'].map(n => [n, hub.add(H[`FW_${n.toUpperCase()}`], () => woke.push(n))]));
    const fire = (...records) => { woke.length = 0; observers[0].cb(records); return woke.slice(); };
    return { html, body, panel, inner, hub, subs, fire, mo: observers[0], observers };
}
const all = ['help', 'reading', 'skin', 'home', 'extra'];
test('감시자는 하나 · 처음엔 html 자식 · body(자식 · class · data-bl-fruit-entry)를 봐요', () => {
    const r = rig();
    assert.equal(r.observers.length, 1);
    assert.deepEqual(r.mo.regs.map(([t, o]) => [t.name, JSON.stringify(o)]), [['html', '{"childList":true}'], ['body', '{"childList":true,"attributes":true,"attributeFilter":["class","data-bl-fruit-entry"]}']]);
});
test('html 자식 기록: 읽기(예전에 body 만 봄)를 뺀 넷 · body 자식: 다섯 · body class: 도움말 뺀 넷 · data-bl-fruit-entry: 더한 칸만', () => {
    const r = rig();
    assert.deepEqual(r.fire({ type: 'childList', target: r.html }), ['help', 'skin', 'home', 'extra']);
    assert.deepEqual(r.fire({ type: 'childList', target: r.body }), all);
    assert.deepEqual(r.fire({ type: 'attributes', attributeName: 'class', target: r.body }), ['reading', 'skin', 'home', 'extra']);
    assert.deepEqual(r.fire({ type: 'attributes', attributeName: 'data-bl-fruit-entry', target: r.body }), ['extra']);
});
test('과일 창 기록은 창을 본(seen) 설치에게만 · 종류별로(자식 다섯 · 글자 읽기 · 더한 칸 · class 겉모습 · style 더한 칸)', () => {
    const r = rig();
    for (const n of ['help', 'skin', 'extra']) r.subs[n].seen(r.panel);
    assert.equal(r.mo.regs.filter(([t]) => t === r.panel).length, 1, '창 감시는 한 번만');
    assert.deepEqual(r.fire({ type: 'childList', target: r.inner }), ['help', 'skin', 'extra']);
    for (const n of ['reading', 'home']) r.subs[n].seen(r.panel);
    assert.deepEqual(r.fire({ type: 'childList', target: r.inner }), all);
    assert.deepEqual(r.fire({ type: 'characterData', target: r.inner }), ['reading', 'extra']);
    assert.deepEqual(r.fire({ type: 'attributes', attributeName: 'class', target: r.inner }), ['skin']);
    assert.deepEqual(r.fire({ type: 'attributes', attributeName: 'style', target: r.inner }), ['extra']);
    assert.deepEqual(r.fire({ type: 'childList', target: r.body }, { type: 'characterData', target: r.inner }), all, '한 묶음 안 여러 종류는 한 번씩');
});
test('창이 바뀌면: 모두 떠난 옛 창 감시만 걷고(쌓인 기록은 먼저 꺼내 나눠요) 새 창을 봐요', () => {
    const r = rig();
    for (const n of all) r.subs[n].seen(r.panel);
    const fresh = { name: 'fresh', contains(t) { return t === this; } };
    r.mo.pending = [{ type: 'characterData', target: r.inner }];
    const woke = [];
    r.subs.help.seen(fresh); r.subs.reading.seen(fresh); r.subs.skin.seen(fresh); r.subs.home.seen(fresh);
    assert.equal(r.mo.disconnects, 0, '아직 더한 칸이 옛 창을 봐요');
    r.subs.extra.seen(fresh);
    assert.equal(r.mo.disconnects, 1);
    assert.deepEqual(r.mo.regs.map(([t]) => t.name), ['html', 'body', 'fresh']);
});
test('끄기: 설치를 다 떼면 감시자를 끊고, 끊은 뒤 기록은 아무도 안 깨워요', () => {
    const r = rig();
    for (const n of all) r.subs[n].off();
    assert.ok(r.mo.disconnects >= 1);
    assert.deepEqual(r.fire({ type: 'childList', target: r.body }), []);
});
test('설치 다섯이 제 종류로 붙고, 예전 감시 열(new MutationObserver)은 입력 줄 감시 하나만 남아요', () => {
    for (const [fn, mask] of [['installFruitHelp', 'FW_HELP'], ['installFruitReading', 'FW_READING'], ['installFruitSkin', 'FW_SKIN'], ['installFruitHomeOrder', 'FW_HOME'], ['installFruitExtraControls', 'FW_EXTRA']]) {
        const body = bundled.slice(bundled.indexOf(`function ${fn}(`));
        const end = body.indexOf('\nfunction ', 10);
        assert.ok(body.slice(0, end < 0 ? undefined : end).includes(`hub.add(${mask},`), fn);
    }
    assert.equal((bundled.match(/new host\.MutationObserver\(/g) || []).length, 2, '감시 하나 + 입력 줄 감시');
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/fruit-style-hub.mjs .'), 'CI 등록');
});
const heart = await scriptCode(root, 'fruit-heart');
test('한글화 쪽 발견 박자(겹침 정리): 「방금 썼다 15초」는 감시 밖 열린 팝업이 있을 때만 다시 칠하고, 고른 팝업 · 깊은 뿌리 · 떨어진 뿌리 · 추론 칸 줄은 그대로', () => {
    assert.match(heart, /if \(popupRoots\.size \|\| \(Date\.now\(\) - recent < 15000 && unseenPopup\(\)\)\) return schedule\(\);/);
    assert.match(heart, /const unseenPopup = \(\) => \{ for \(const branch of branchable\(\) \? outsideChat\(\) : \[doc\.documentElement\]\)/, '팝업은 #chat 밖 가지에서만 찾아요(flush 와 같은 범위)');
    assert.match(heart, /for \(const node of observed\) if \(!node\.isConnected\) return schedule\(\);\n\s*if \(rootAppeared\(\)\) return schedule\(\);/);
    assert.match(heart, /discovery = host\.setInterval\(discover, 1500\);/, '박자는 공용 스케줄러(실행기 대리 창의 setInterval)');
});
console.log(`fruit-style-hub: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
