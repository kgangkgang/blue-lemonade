// 8.2.5 게시 전 검토에서 확인한 두 가지 (node tools/tests/review-825-fixes.mjs <테마 루트>)
// 1) 상태창 미리보기 복제(src/fruit-type-snapshot.js): 물려받는 속성을 부모와 같다고 건너뛰면, 브라우저 기본 스타일이 그 속성을 직접 정하는 태그
//    (button · input 은 검은 13px 기본 글꼴, em 은 기울임, strong 은 한 단계 더 굵게)는 미리보기에서 기본값으로 바뀌었다(크롬 확인).
//    그런 태그는 부모와 같아도 다 적고, 평범한 div · span 은 그대로 건너뛴다(가벼움은 유지).
// 2) 전개 지시 창(src/addons/direction/index.js closePopup): 타자 뒤 250ms 안에 닫거나 한글 마지막 글자가 조합 중일 때 닫으면
//    미뤄 둔 다시 그리기가 버려져 입력창 깃털 단추(켜짐 단계 · 내용 표시)가 옛 상태로 남았다 — 닫을 때 단추를 한 번 맞춘다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log(`ok ${n + failed} - ${name}`); } catch (e) { failed++; console.log(`not ok ${n + failed} - ${name}\n  ${e.message}`); } };

await test('미리보기 복제: 부모와 같은 값이어도 button · input · em · strong 은 글자색 · 크기 · 모양을 적고, span 은 건너뛴다', async () => {
    const { copyFruitPreview } = await import(pathToFileURL(path.join(root, 'src/fruit-type-snapshot.js')).href);
    const element = (tag, children = []) => {
        const values = new Map();
        return { nodeType: 1, tagName: tag.toUpperCase(), localName: tag, namespaceURI: 'http://www.w3.org/1999/xhtml', childNodes: children, style: {},
            get attributes() { return [...values].map(([name, value]) => ({ name, value })); }, setAttribute: (k, v) => values.set(k, v), getAttribute: k => values.get(k),
            append(c) { this.childNodes.push(c); }, replaceChildren(...c) { this.childNodes = c; } };
    };
    const host = element('div'), pseudo = element('style');
    const target = { createElement: tag => element(tag), createElementNS: (ns, tag) => element(tag), createTextNode: text => ({ nodeType: 3, textContent: text }),
        querySelector: () => host, getElementById: () => pseudo, fonts: new Set() };
    const kids = ['button', 'input', 'em', 'strong', 'span'].map(tag => element(tag, [{ nodeType: 3, textContent: '가' }]));
    const source = element('div', kids);
    const values = { color: 'rgb(220, 230, 255)', 'font-size': '18px', 'font-family': 'Georgia', 'font-style': 'normal', 'font-weight': '700' };
    const css = Object.assign(Object.keys(values), { getPropertyValue: k => values[k] ?? '', content: 'none' });
    const doc = { defaultView: { getComputedStyle: () => css }, fonts: new Set() };
    const own = node => { node.ownerDocument = doc; for (const c of node.childNodes || []) own(c); }; own(source);
    assert.ok(copyFruitPreview(source, target));
    const copied = host.childNodes[0].childNodes;
    for (const [i, tag] of ['BUTTON', 'INPUT', 'EM', 'STRONG'].entries()) {
        for (const key of Object.keys(values)) assert.ok(copied[i].style.cssText.includes(`${key}:${values[key]}`), `${tag} 에 ${key} 가 적혀야 해요 (${copied[i].style.cssText})`);
    }
    assert.ok(!copied[4].style.cssText.includes('color:'), `SPAN 은 부모와 같은 글자색을 건너뛰어요 (${copied[4].style.cssText})`);
});

await test('전개 지시: 한글을 잇달아 치면 다시 그리기가 한 번도 돌지 않은 채 마지막 글자가 조합 중으로 남는다(닫을 때 맞춰야 하는 까닭)', async () => {
    const { attachTypingRefresh } = await import(pathToFileURL(path.join(root, 'src/addons/direction/typing.js')).href);
    let now = 0; const timers = [];
    const setTimer = (fn, ms) => { const t = { fn, at: now + ms, live: true }; timers.push(t); return t; };
    const clearTimer = t => { if (t) t.live = false; };
    const tick = ms => { const end = now + ms; for (;;) { const due = timers.filter(t => t.live && t.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; now = due.at; due.live = false; due.fn(); } now = end; };
    const listeners = {};
    const textarea = { value: '', addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }, removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter(f => f !== fn); } };
    const fire = (type, props = {}) => { for (const fn of listeners[type] || []) fn({ type, ...props }); };
    const refreshes = [];
    const handle = attachTypingRefresh(textarea, { onValue: () => {}, refresh: () => refreshes.push(now), setTimer, clearTimer });
    // 「안녕」: 음절마다 compositionend → 바로 다음 음절 compositionstart (150ms 사이) — 마지막 「녕」은 아직 조합 중
    for (const [i, syllable] of ['안', '녕'].entries()) {
        fire('compositionstart'); textarea.value = '안녕'.slice(0, i) + syllable; fire('input', { isComposing: true }); tick(150);
        if (i === 0) fire('compositionend');
    }
    assert.deepEqual(refreshes, [], '다시 그리기는 아직 한 번도 안 돌았어요');
    assert.equal(handle.composing(), true);
});

await test('전개 지시: closePopup 은 미뤄 둔 것 · 조합 중인 것이 있으면 창을 뗀 뒤 refreshButton() 을 한 번 부른다', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/direction/index.js'), 'utf8');
    const body = src.slice(src.indexOf('function closePopup()'), src.indexOf('function togglePopup()'));
    const stale = body.indexOf('typingRefreshers.some(t => t.pending() || t.composing())');
    const stop = body.indexOf('t.stop()');
    const cleared = body.indexOf('popup = null;');
    const refresh = body.indexOf('if (staleButton) refreshButton();');
    assert.ok(stale >= 0 && stop > stale, '멈추기 전에 미뤄 둔 것이 있었는지 본다');
    assert.ok(refresh > cleared, 'popup 을 비운 뒤에 부른다 (닫히는 창을 다시 그리지 않게)');
});

console.log(`\n${n} 통과 · ${failed} 실패`);
if (failed) process.exit(1);
