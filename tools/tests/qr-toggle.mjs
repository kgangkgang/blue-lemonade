// 퀵 리플라이 줄 접기 (src/addons/qrtoggle — 기본 꺼짐)
//   · 순수: 저장값 다듬기(호환판 상태 이어받기) · 단추 글 · 누름 키
//   · 가짜 브라우저: 켜면 요술봉 뒤에 단추 · 누르면 접힘(body class) · 기억 · Enter/Space · 입력판이 다시 그려지면 단추 복구
//     · 다른 확장의 단추가 있으면 물러남 · 끄면 단추 · 스타일 · 감시를 걷음
//   · 연결: 켤 때만 받음 · 설정 창 · 찾기 · 이름표 · 설정 키 · 출처 표기 세 곳 · MIT 전문
//   node tools/tests/qr-toggle.mjs .
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('qr-toggle');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const core = await load('src/addons/qrtoggle/core.js');

await test('저장값 다듬기: 처음이면 펼친 채로 · 호환판 상태는 한 번 이어받아요', () => {
    assert.deepEqual(core.tidyState(undefined, undefined), { open: true });
    assert.deepEqual(core.tidyState(null, { isOpen: false }), { open: false });
    assert.deepEqual(core.tidyState({}, { isOpen: true }), { open: true });
    assert.deepEqual(core.tidyState({ open: false }, { isOpen: true }), { open: false }, '우리 값이 있으면 그쪽이 먼저');
    assert.deepEqual(core.tidyState({ open: 'yes' }, { isOpen: 'no' }), { open: true }, '이상한 값은 기본으로');
});

await test('단추 글 · 화살표 · 누름 키', () => {
    assert.deepEqual(core.buttonView(true), { label: '퀵 리플라이 접기', icon: 'fa-chevron-down', off: 'fa-chevron-up', expanded: 'true' });
    assert.deepEqual(core.buttonView(false), { label: '퀵 리플라이 펼치기', icon: 'fa-chevron-up', off: 'fa-chevron-down', expanded: 'false' });
    assert.equal(core.isPressKey('Enter'), true); assert.equal(core.isPressKey(' '), true); assert.equal(core.isPressKey('a'), false);
});

// ── 가짜 브라우저 ──
class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.id = ''; this.className = ''; this.children = []; this.parent = null; this.attrs = {}; this.listeners = {}; this.title = ''; this.tabIndex = -1; this.textContent = ''; }
    get classList() {
        const el = this, list = () => el.className.split(/\s+/).filter(Boolean);
        return { contains: c => list().includes(c), add(c) { if (!list().includes(c)) el.className = [...list(), c].join(' '); }, remove(c) { el.className = list().filter(x => x !== c).join(' '); }, toggle(c, force) { const want = force === undefined ? !list().includes(c) : !!force; want ? this.add(c) : this.remove(c); return want; } };
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    dispatchEvent(event) { for (const fn of this.listeners[event.type] || []) fn(event); return true; }
    append(...nodes) { for (const node of nodes) { node.remove?.(); node.parent = this; this.children.push(node); } notify(); }
    insertAdjacentElement(_where, node) { const list = this.parent.children; node.parent = this.parent; list.splice(list.indexOf(this) + 1, 0, node); notify(); return node; }
    remove() { if (!this.parent) return; this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; notify(); }
    find(id) { if (this.id === id) return this; for (const child of this.children) { const hit = child.find(id); if (hit) return hit; } return null; }
}
const observers = new Set(), frames = [];
let notifying = false;
function notify() { if (notifying) return; notifying = true; try { for (const o of observers) o.fn(); } finally { notifying = false; } }
const flush = () => { for (let i = 0; frames.length && i < 5; i++) frames.splice(0).forEach(fn => fn()); };
const body = new El('body'), head = new El('head');
const form = Object.assign(new El('div'), { id: 'send_form' }), bar = Object.assign(new El('div'), { id: 'qr--bar', className: 'bl-qr-more-right' });
const wand = Object.assign(new El('div'), { id: 'extensionsMenuButton' }), after = Object.assign(new El('div'), { id: 'jj-button' });
form.append(bar, wand, after); body.append(form);
globalThis.document = { body, head, createElement: tag => new El(tag), getElementById: id => body.find(id) || head.find(id) };
globalThis.MutationObserver = class { constructor(fn) { this.fn = fn; } observe() { observers.add(this); } disconnect() { observers.delete(this); } };
globalThis.requestAnimationFrame = fn => frames.push(fn);
globalThis.Event = class { constructor(type) { this.type = type; } };
const toasts = []; globalThis.toastr = { info: (...a) => toasts.push(a) };
const chat = []; let saves = 0;
const extensionSettings = {};
globalThis.SillyTavern = { getContext: () => ({ extensionSettings, saveSettingsDebounced: () => saves++, eventSource: { on: (name, fn) => chat.push(fn) }, event_types: { CHAT_CHANGED: 'chat' } }) };
const mod = await load('src/addons/qrtoggle/index.js');
const { BUTTON_ID, BODY_CLASS, STYLE_ID } = mod._forTest;
const button = () => document.getElementById(BUTTON_ID);
const press = () => { button().dispatchEvent({ type: 'click' }); flush(); };

await test('켜기 전에는 아무것도 없어요', () => {
    assert.equal(button(), null); assert.equal(document.getElementById(STYLE_ID), null); assert.equal(observers.size, 0); assert.equal(chat.length, 0);
});

await test('켜면 요술봉 바로 뒤에 단추 · 스타일 하나 · 펼친 채로 시작', () => {
    mod.syncQrToggle(true); flush();
    assert.equal(form.children.indexOf(button()), form.children.indexOf(wand) + 1);
    assert.equal(button().getAttribute('role'), 'button'); assert.equal(button().tabIndex, 0);
    assert.equal(button().title, '퀵 리플라이 접기'); assert.equal(button().getAttribute('aria-expanded'), 'true');
    assert.ok(button().classList.contains('fa-chevron-down') && !button().classList.contains('fa-chevron-up'));
    assert.equal(body.classList.contains(BODY_CLASS), false);
    assert.match(document.getElementById(STYLE_ID).textContent, /body\.bl-qr-folded #qr--bar\{display:none!important\}/);
    mod.syncQrToggle(true); flush();
    assert.equal(head.children.length, 1); assert.equal(form.children.filter(x => x.id === BUTTON_ID).length, 1); assert.equal(chat.length, 1, '다시 불러도 하나씩');
});

await test('누르면 접히고 기억해요 · 줄의 class 는 건드리지 않아요', () => {
    press();
    assert.equal(body.classList.contains(BODY_CLASS), true);
    assert.equal(extensionSettings.blue_lemonade_qrfold.open, false); assert.equal(saves, 1);
    assert.equal(button().title, '퀵 리플라이 펼치기'); assert.equal(button().getAttribute('aria-expanded'), 'false');
    assert.ok(button().classList.contains('fa-chevron-up') && !button().classList.contains('fa-chevron-down'));
    assert.equal(bar.className, 'bl-qr-more-right');
});

await test('펼치면 줄에 scroll 사건을 보내 테마가 양끝 흐림을 다시 재요 · Enter · Space', () => {
    let scrolls = 0, prevented = 0; bar.addEventListener('scroll', () => scrolls++);
    button().dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: () => prevented++ }); flush();
    assert.equal(body.classList.contains(BODY_CLASS), false); assert.equal(scrolls, 1);
    button().dispatchEvent({ type: 'keydown', key: ' ', preventDefault: () => prevented++ }); flush();
    assert.equal(body.classList.contains(BODY_CLASS), true); assert.equal(scrolls, 1, '접을 때는 안 보내요');
    button().dispatchEvent({ type: 'keydown', key: 'a', preventDefault: () => prevented++ });
    assert.equal(prevented, 2); assert.equal(body.classList.contains(BODY_CLASS), true);
});

await test('입력판이 다시 그려져 단추가 사라지면 되살려요(접힘 그대로) · 채팅이 바뀌어도', () => {
    button().remove(); flush();
    assert.ok(button(), '감시가 되살려요');
    assert.equal(button().title, '퀵 리플라이 펼치기'); assert.equal(body.classList.contains(BODY_CLASS), true);
    form.children = form.children.filter(x => x.id !== BUTTON_ID);   // 감시가 못 본 채 사라진 경우
    chat[0](); flush();
    assert.ok(button(), 'CHAT_CHANGED 에서도 되살려요');
});

await test('다른 확장의 단추가 있으면 내장 쪽이 물러나고 한 번만 알려요', () => {
    for (const id of core.OTHER_BUTTONS) {
        const other = Object.assign(new El('div'), { id }); wand.insertAdjacentElement('afterend', other); flush();
        assert.equal(button(), null, id);
        assert.equal(body.classList.contains(BODY_CLASS), false, '우리 class 로 줄을 숨긴 채 남기지 않아요');
        other.remove(); flush();
        assert.ok(button(), '그 단추가 사라지면 다시 넣어요');
        assert.equal(body.classList.contains(BODY_CLASS), true);
    }
    assert.equal(toasts.length, 1);
});

await test('끄면 단추 · 스타일 · 접힘 · 감시를 모두 걷어요 · 다시 켜면 기억한 상태로', () => {
    mod.syncQrToggle(false); flush();
    assert.equal(button(), null); assert.equal(document.getElementById(STYLE_ID), null); assert.equal(body.classList.contains(BODY_CLASS), false); assert.equal(observers.size, 0);
    chat[0](); flush();
    assert.equal(button(), null, '꺼져 있으면 채팅이 바뀌어도 넣지 않아요');
    mod.syncQrToggle(true); flush();
    assert.equal(body.classList.contains(BODY_CLASS), true);
    mod.syncQrToggle(false);
});

await test('연결: 기본 꺼짐 · 켤 때만 받음 · 설정 창 · 찾기 · 이름표 · 설정 키', () => {
    assert.match(read('src/settings.js'), /qrFold: false/);
    assert.match(read('src/features.js'), /load\('qrfold', '\.\/addons\/qrtoggle\/index\.js'\)\.then\(m => m\?\.syncQrToggle\(qrFold\)\)/);
    assert.match(read('src/panel.js'), /toggle\('quick\.qrFold', s\.quick\?\.qrFold === true\)/);
    assert.match(read('src/settings-search.js'), /'quick\.qrFold'\]/);
    assert.match(read('src/settings-labels.js'), /'quick\.qrFold':'퀵 리플라이 줄 접기'/);
    assert.match(read('tools/tests/settings-keys-1000.json'), /"quick\.qrFold"/);
    for (const file of ['index.js', 'src/features.js']) assert.ok(!/from '\.\/(src\/)?addons\/qrtoggle/.test(read(file)), `${file} 는 시작할 때 이 모듈을 받지 않아요`);
});

await test('제로 판: 모듈을 받지 않고(호환판 확장을 그대로 쓰면 돼요) 스위치는 회색 · 판 목록의 켜짐 표시', async () => {
    const usage = await load('src/usage-mode.js'), zero = await load('src/zero-panel.js'), versions = await load('src/addon-versions.js');
    assert.equal(usage.ZERO_LOOK.has('qrfold'), false, '제로가 받는 모양 모듈이 아니에요');
    assert.equal(usage.zeroSkips({ usageMode: 'zero' }, 'qrfold'), true);
    assert.equal(usage.zeroSkips({ usageMode: 'both' }, 'qrfold'), false);
    assert.equal(zero.zeroOffPath('quick.qrFold'), true, '설정 창에서 「제로 모드에서 꺼짐」 회색 칸');
    assert.match(read('src/features.js'), /const load = \(name, url\) => zeroSkips\(zeroNow, name\)/);
    assert.match(read('src/panel.js'), /s\.quick\?\.qrFold === true && s\.usageMode !== 'zero' \? addonCreditHtml\('qrtoggle'\)/);
    assert.equal(versions.versionFlags({ quick: { qrFold: true }, addons: { tts: true } }).qrtoggle, true);
    assert.equal(versions.versionFlags({ quick: { qrFold: true }, addons: { tts: true } }).tts, true, '애드온 스위치는 그대로');
    assert.equal(versions.versionFlags({ quick: { qrFold: false } }).qrtoggle, false);
    assert.equal(versions.versionFlags({ quick: { qrFold: true }, usageMode: 'zero' }).qrtoggle, false);
    assert.equal(versions.versionFlags({ quick: { qrFold: true }, usageMode: 'extensions' }).qrtoggle, false);
    assert.equal(versions.versionFlags(undefined).qrtoggle, false);
    const list = await versions.addonVersions(versions.versionFlags({ quick: { qrFold: true } }), { fresh: true, fetcher: async url => ({ ok: true, text: async () => String(url).includes('qrtoggle') ? "export const VERSION = '1.0.0';" : '' }) });
    const mine = list.find(item => item.id === 'qrtoggle');
    assert.deepEqual(mine, { id: 'qrtoggle', label: '퀵 리플라이 줄 접기', version: '1.0.0', on: true });
    for (const file of ['src/diag-file.js', 'src/diagnose.js', 'src/theme-update.js']) assert.match(read(file), /versionFlags\(/, file);
});

await test('줄 앞 「QR 접기 단추」와 겹치지 않아요: 켠 동안만 쉬고 저장값은 그대로 (apply.js 실제 소스 줄로)', () => {
    const apply = read('src/apply.js');
    const lines = [/^\s*if \(s\.chat\.qrFold === false\) want\.add\('salty-qr-fold-off'\);.*$/m, /^\s*if \(s\.chat\.qrFolded === true\) want\.add\('salty-qr-folded'\);.*$/m, /^\s*if \(s\.quick\?\.qrFold === true && s\.usageMode !== 'zero'\) \{ want\.add\('salty-qr-fold-off'\); want\.delete\('salty-qr-folded'\); \}.*$/m].map(re => apply.match(re)?.[0]);
    assert.ok(lines.every(Boolean), 'want 목록 세 줄');
    assert.ok(apply.indexOf(lines[2]) > apply.indexOf(lines[1]), '쉬게 하는 줄이 접힘 줄 뒤에 와야 접힘을 떼요');
    const run = s => { const want = new Set(['salty']); new Function('s', 'want', lines.join('\n'))(s, want); return [...want].sort(); };
    const chat = (qrFold, qrFolded) => ({ qrFold, qrFolded });
    // 켜기: 줄 앞 단추가 쉬어요
    assert.deepEqual(run({ chat: chat(true, false), quick: { qrFold: true } }), ['salty', 'salty-qr-fold-off']);
    // 접힌 채 켜기: 줄 앞 단추로 접어 둔 줄이 풀려요(단추도 없는데 줄이 숨은 채 남지 않게)
    assert.deepEqual(run({ chat: chat(true, true), quick: { qrFold: true } }), ['salty', 'salty-qr-fold-off']);
    // 끄기: 줄 앞 단추와 접어 둔 상태가 그대로 돌아와요
    const saved = { chat: chat(true, true), quick: { qrFold: true } };
    run(saved);
    assert.deepEqual(saved.chat, chat(true, true), '사용자가 고른 저장값은 덮어쓰지 않아요');
    saved.quick.qrFold = false;
    assert.deepEqual(run(saved), ['salty', 'salty-qr-folded']);
    // 새로고침 뒤: 같은 저장값이면 같은 결과(설정에서 매번 계산해요)
    assert.deepEqual(run(JSON.parse(JSON.stringify({ chat: chat(true, true), quick: { qrFold: true } }))), ['salty', 'salty-qr-fold-off']);
    // 줄 앞 단추를 원래 꺼 둔 사람: 새 스위치를 껐다 켜도 꺼진 그대로
    assert.deepEqual(run({ chat: chat(false, false), quick: { qrFold: false } }), ['salty', 'salty-qr-fold-off']);
    // 제로 판 · 편의 묶음이 없는 옛 설정: 건드리지 않아요
    assert.deepEqual(run({ chat: chat(true, true), quick: { qrFold: true }, usageMode: 'zero' }), ['salty', 'salty-qr-folded']);
    assert.deepEqual(run({ chat: chat(true, false) }), ['salty']);
    // 줄 앞 단추는 그 class 를 보고 떼요 · 설정 창에 쉬는 표시
    assert.match(read('src/layout.js'), /classList\.contains\('salty-qr-fold-off'\)\) \{ fold\?\.remove\(\); return; \}/);
    assert.match(read('src/panel.js'), /s\.quick\?\.qrFold === true && s\.usageMode !== 'zero' \? '<b class="bl-rest-note">요술봉 뒤 접기를 쓰는 동안 쉬어요<\/b> ' : ''/);
});

await test('출처: MIT 전문과 저작권 줄 · 고지 · 출처 창 · 카드 꼬리 · 전체 고지', () => {
    const license = read('src/addons/qrtoggle/LICENSE');
    assert.match(license, /^MIT License\n\nCopyright \(c\) 2025 IceFog72\n/);
    assert.match(license, /The above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software\./);
    const notice = read('src/addons/qrtoggle/NOTICE.md');
    for (const needle of ['IceFog72/SillyTavern-SimpleQRBarToggle', 'sdafaff346/stqrtoggle-mod', 'Copyright (c) 2025 IceFog72', 'b40082351f9a42dc8e6ed82b7c7a05e41fa3e397', 'f128dd857b39e394f2fd84bc9fc34bf369e7b9a1', '2026-11-10 Blue Lemonade 수정']) assert.ok(notice.includes(needle), needle);
    for (const file of ['src/addons/qrtoggle/index.js', 'src/addons/qrtoggle/core.js']) assert.match(read(file), /Copyright \(c\) 2025 IceFog72, MIT/, file);
    for (const file of ['THIRD-PARTY-NOTICES.md', 'src/credits.js', 'src/addon-credits.js']) {
        assert.ok(read(file).includes('https://github.com/IceFog72/SillyTavern-SimpleQRBarToggle'), file);
        assert.ok(read(file).includes('https://github.com/sdafaff346/stqrtoggle-mod'), file);
    }
    assert.match(read('src/panel.js'), /addonCreditHtml\('qrtoggle'\)/);
});

done();
