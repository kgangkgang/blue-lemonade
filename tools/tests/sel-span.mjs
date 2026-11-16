// 1.6.0 여기부터 · 여기까지 (src/quick/sel-span.js · 설정 quick.selSpan · 기본 켬) — jsdom 으로 실제 DOM · Selection · 감시 · 타이머를 돌려 봐요.
//   · 시작 표시 기억(글자 자리 + 앞뒤 조각 · 메시지 줄 표식 · Highlight · 안내 칩) · 도구 줄 단추가 바뀌는 차례(여기부터 → 여기까지 → 복사)
//   · 범위 만들기: 뒤쪽 · 앞쪽(뒤집기) · 같은 메시지 · 표시가 고른 글 안 · 여러 메시지
//   · 다시 그려진 메시지에서 자리 되찾기(앞에 글이 붙음 · 스트리밍 · 편집 칸 · 못 찾으면 맨 앞)
//   · 거두기: 취소 · 다른 채팅 · 메시지 사라짐(알림) · 같은 채팅 다시 그리기(다시 붙임) · 5분 · 설정 끔
//   · 복사 = Selection.toString · 설정 연결
//   node tools/tests/sel-span.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2). 공개 CI 는 `cd tools && npm ci` 뒤 `. tools` 로 불러요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const url = rel => pathToFileURL(path.join(root, rel)).href;
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  통과  ${name}`); }
    catch (error) { fail++; console.log(`  실패  ${name}\n${error?.stack || error}`); }
}

const WORDS = ['하나', '둘', '셋', '넷', '다섯', '여섯'];
const mesHtml = i => `<div class="mes" mesid="${i}"><div class="mes_block"><div class="ch_name"><span class="name_text">이름${i}</span></div><div class="mes_text"><p>${WORDS[i]}번째 메시지의 <b>첫 문단</b>이에요. 표식${i}A 낱말이 있어요.</p><p>둘째 문단 표식${i}B 끝이에요.</p></div></div></div>`;
const chatHtml = () => WORDS.map((_, i) => mesHtml(i)).join('');
const dom = new JSDOM(`<!doctype html><html><head></head><body class="salty"><div id="chat">${chatHtml()}</div><div id="send_form"><textarea id="send_textarea"></textarea></div></body></html>`, { pretendToBeVisual: true, url: 'http://st.test/' });
const { window } = dom;
const { document } = window;
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'Event', 'Node', 'NodeFilter', 'MutationObserver', 'Range', 'localStorage', 'requestAnimationFrame', 'getComputedStyle']) globalThis[key] = window[key];
window.matchMedia = () => ({ matches: false });
window.Range.prototype.getClientRects = function () { return this.collapsed ? [] : [{ left: 10, right: 100, top: 100, bottom: 120, width: 90, height: 20 }]; };   // 도구 줄이 「고른 글이 그려져 있다」고 보게
class FakeHighlight { constructor(...ranges) { this.ranges = ranges; } }
globalThis.Highlight = FakeHighlight;
globalThis.CSS = { highlights: new Map() };
const toasts = [];
globalThis.toastr = Object.fromEntries(['info', 'success', 'warning', 'error'].map(kind => [kind, (text) => { toasts.push([kind, text]); }]));
let copied = null;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (text) => { copied = text; } } } });

const CHAT_CHANGED = 'chat_id_changed';
const listeners = new Map();
const eventSource = {
    on(type, fn) { (listeners.get(type) || listeners.set(type, []).get(type)).push(fn); },
    removeListener(type, fn) { const list = listeners.get(type) || []; const at = list.indexOf(fn); if (at >= 0) list.splice(at, 1); },
    emit(type, ...args) { for (const fn of [...(listeners.get(type) || [])]) fn(...args); },
};
const st = { chatId: 'chat-A', extensionSettings: {} };
const context = { get extensionSettings() { return st.extensionSettings; }, eventSource, eventTypes: { CHAT_CHANGED }, getCurrentChatId: () => st.chatId, saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => context };

const { getSettings } = await import(url('src/settings.js'));
const bar = await import(url('src/selection-bar.js'));
const S = await import(url('src/quick/sel-span.js'));
const settings = getSettings();
const chat = document.getElementById('chat');
chat.getBoundingClientRect = () => ({ left: 0, right: 384, top: 0, bottom: 700, width: 384, height: 700 });   // 고른 글(가짜 자리 100 ~ 120)이 채팅 칸 안에 보이게
const mesAt = i => chat.querySelector(`.mes[mesid="${i}"]`);
const textOf = i => mesAt(i).querySelector('.mes_text');

/** 메시지 i 의 글에서 word 를 고른다 (글자 노드 안) */
function pick(i, word) {
    const walker = document.createTreeWalker(textOf(i), window.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.data.indexOf(word);
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(node, at); range.setEnd(node, at + word.length);
        const selection = document.getSelection();
        selection.removeAllRanges(); selection.addRange(range);
        return range;
    }
    throw new Error(`「${word}」 없음 (#${i})`);
}
const selected = () => document.getSelection().toString();
const unselect = () => document.getSelection().removeAllRanges();
/** 도구 줄이 지금 고른 글로 다시 보게 하고(300ms) 뜬 단추 id 들 */
async function toolsNow() {
    document.dispatchEvent(new window.Event('selectionchange'));
    await sleep(380);
    const chip = document.getElementById('cg-select-chip');
    return !chip || chip.hidden ? [] : [...chip.querySelectorAll('button[data-tool]')].map(b => b.dataset.tool);
}
const press = id => document.querySelector(`#cg-select-chip button[data-tool="${id}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
const reset = () => { S.clearMark(); unselect(); toasts.length = 0; chat.innerHTML = chatHtml(); st.chatId = 'chat-A'; };

await test('설정 연결: 기본 켬 · 켤 때만 받음 · 설정 줄 · 찾기 · 이름표 · 키 목록 · 도움말 · CI', () => {
    assert.match(read('src/settings.js'), /quick: \{[^}]*selSpan: true/);
    assert.equal(settings.quick.selSpan, true);
    const f = read('src/features.js');
    assert.match(f, /const selSpan = qx && q\.selSpan !== false;\n\s+if \(selSpan \|\| modules\.selspan\) load\('selspan', '\.\/quick\/sel-span\.js'\)\.then\(m => m\?\.syncSelSpan\(selSpan\)\);/);
    assert.match(read('src/panel.js'), /row\('여기부터 · 여기까지', toggle\('quick\.selSpan', s\.quick\?\.selSpan !== false\), '[^']+'\)/);
    assert.match(read('src/settings-search.js'), /'quick\.selSpan'\]/);
    assert.match(read('src/settings-labels.js'), /'quick\.selSpan':'여기부터 · 여기까지'/);
    assert.ok(JSON.parse(read('tools/tests/settings-keys-1000.json')).keys.includes('quick.selSpan'));
    const help = read('src/longpress-help-data.js');
    for (const key of ['여기부터 고르기 시작', '시작 표시부터 여기까지 고르기', '고른 범위 복사', 'bl-span-guide']) assert.ok(help.includes(`"${key}"`), key);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/sel-span\.mjs \. tools/);
});

await test('자리 찾기(locate): 같은 자리 · 밀린 자리 · 가장 가까운 곳 · 짧은 조각은 안 믿음 · 없으면 -1', () => {
    const text = '가나다라마바사 표식 아자차카타파하 표식 끝';
    const at = text.indexOf('표식');
    const m = { chars: at, before: text.slice(0, at), after: text.slice(at, at + 24) };
    assert.equal(S.locate(text, m), at);
    assert.equal(S.locate(`앞에 붙은 글 ${text}`, m), at + '앞에 붙은 글 '.length);
    assert.equal(S.locate(`${text} 뒤에 붙는 글`, m), at, '스트리밍으로 뒤가 늘어도 그 자리');
    const second = text.lastIndexOf('표식');
    assert.equal(S.locate(text, { chars: second + 1, before: '', after: '표식 ' }), -1, '세 글자 조각으로는 찾지 않는다');
    assert.equal(S.locate('전혀 다른 글이에요', m), -1);
    assert.equal(S.locate('XX표식 아자차카타 YY 표식 아자차카타', { chars: 14, before: '', after: '표식 아자차카타' }), 14, '여러 곳이면 가장 가까운 곳');
});

await test('「여기부터」: 시작 자리를 기억하고 선택을 푼다 · 메시지 줄 표식 · 첫 낱말 칠하기 · 안내 칩 · 줄의 단추가 「여기까지」로', async () => {
    reset();
    S.syncSelSpan(true);
    pick(1, '표식1A');
    assert.deepEqual((await toolsNow()).filter(id => id.startsWith('span')), ['spanfrom']);
    press('spanfrom');
    assert.equal(selected(), '', '선택을 푼다');
    const state = S._span.state();
    assert.equal(state.mesid, '1');
    assert.equal(textOf(1).textContent.slice(state.chars, state.chars + 4), '표식1A');
    assert.ok(state.after.startsWith('표식1A') && state.before.length > 0);
    assert.ok(mesAt(1).hasAttribute(S.FLAG_ATTR));
    assert.equal(chat.querySelectorAll(`[${S.FLAG_ATTR}]`).length, 1);
    assert.equal(globalThis.CSS.highlights.get(S.HIGHLIGHT).ranges[0].toString(), '표식1A', '공백 전까지 첫 낱말');
    const guide = document.getElementById(S.GUIDE_ID);
    assert.ok(guide && /끝낼 곳의 글을 고른 뒤 「여기까지」/.test(guide.textContent) && guide.querySelector('button.bl-span-guide-cancel').textContent === '취소');
    assert.equal(textOf(1).innerHTML, new JSDOM(mesHtml(1)).window.document.querySelector('.mes_text').innerHTML, '메시지 글 DOM 은 그대로');
    pick(4, '표식4B');
    assert.deepEqual((await toolsNow()).filter(id => id.startsWith('span')), ['spanto'], '표시가 있는 동안은 「여기까지」만');
});

await test('「여기까지」: 시작 표시부터 고른 글의 끝까지 한 선택(여러 메시지) · 표시를 거둔다 · 그 범위에는 「복사」', async () => {
    press('spanto');
    const text = selected();
    assert.ok(text.startsWith('표식1A 낱말이 있어요.'), text.slice(0, 30));
    assert.ok(text.endsWith('둘째 문단 표식4B'), text.slice(-30));
    for (const word of ['표식2A', '표식3B', '넷번째 메시지']) assert.ok(text.includes(word), word);
    assert.ok(!text.includes('하나번째') && !text.includes('표식5A') && !text.includes('표식4B 끝'));
    assert.equal(document.getSelection().rangeCount, 1);
    assert.equal(S._span.state(), null);
    assert.equal(document.getElementById(S.GUIDE_ID), null);
    assert.equal(chat.querySelectorAll(`[${S.FLAG_ATTR}]`).length, 0);
    assert.equal(globalThis.CSS.highlights.has(S.HIGHLIGHT), false);
    assert.ok(toasts.some(([kind, t]) => kind === 'success' && t === '메시지 4개에 걸쳐 골랐어요.'));
    const found = bar.currentSelection();
    assert.equal(found.single, false);
    assert.deepEqual(found.roots.map(r => r.closest('.mes').getAttribute('mesid')), ['1', '2', '3', '4'], '로그 복사가 읽는 메시지 차례');
    const tools = await toolsNow();
    assert.ok(tools.includes('spancopy') && !tools.includes('spanfrom') && !tools.includes('spanto'), tools.join());
    copied = null;
    document.execCommand = () => false;
    press('spancopy');
    await sleep(30);
    assert.equal(copied, text, '복사 명령이 막힌 곳은 떠 둔 글 = Selection.toString');
    assert.equal(selected(), text, '복사한 뒤에도 범위는 골라진 채');
    // 브라우저의 복사 명령이 되면 그 명령을 범위가 골라진 채로 부른다(평소 복사와 같은 길) — 떠 둔 글은 쓰지 않는다
    let execSelected = null; copied = null;
    document.execCommand = (name) => { execSelected = name === 'copy' ? selected() : null; return true; };
    await toolsNow();   // 복사 뒤 줄이 그 범위로 다시 뜬다
    try { press('spancopy'); await sleep(30); } finally { delete document.execCommand; }
    assert.equal(execSelected, text);
    assert.equal(copied, null);
    assert.equal(selected(), text);
    // 다른 글을 고르면 평소 선택 — 「복사」는 없고 「여기부터」가 돌아온다
    pick(2, '표식2B');
    const after = await toolsNow();
    assert.ok(after.includes('spanfrom') && !after.includes('spancopy'), after.join());
});

await test('끝이 시작보다 앞이면 뒤집는다 · 같은 메시지 · 표시가 고른 글 안이면 고른 글 그대로', () => {
    reset();
    S.setMark({ range: pick(4, '표식4A') });
    assert.equal(S.selectTo({ range: pick(2, '표식2B') }), true);
    assert.ok(selected().startsWith('표식2B 끝이에요.') && selected().endsWith('첫 문단이에요. '), selected());
    assert.ok(selected().includes('표식3A') && !selected().includes('표식4A'));

    S.setMark({ range: pick(3, '첫 문단') });
    S.selectTo({ range: pick(3, '표식3B') });
    assert.equal(selected(), '첫 문단이에요. 표식3A 낱말이 있어요.둘째 문단 표식3B');

    S.setMark({ range: pick(3, '표식3B') });
    S.selectTo({ range: pick(3, '첫 문단') });
    assert.equal(selected(), '첫 문단이에요. 표식3A 낱말이 있어요.둘째 문단 ');

    S.setMark({ range: pick(5, '표식5A') });
    const whole = document.createRange();
    whole.selectNodeContents(textOf(5));
    S.selectTo({ range: whole });
    assert.equal(selected(), textOf(5).textContent);
});

await test('다시 그려진 메시지에서 자리 되찾기: 앞에 글이 붙음 · 스트리밍 · 편집 칸이 열린 동안은 기다림 · 못 찾으면 맨 앞(알림)', async () => {
    reset();
    S.setMark({ range: pick(2, '표식2A') });
    unselect();
    const before = S._span.state().chars;
    const root = textOf(2);
    const html = root.innerHTML;
    root.innerHTML = `<p>번역기가 붙인 머리말.</p>${html}`;
    await sleep(S.REFIND_MS + 80);
    assert.equal(S._span.state().chars, before + '번역기가 붙인 머리말.'.length);
    assert.equal(globalThis.CSS.highlights.get(S.HIGHLIGHT).ranges[0].toString(), '표식2A', '칠한 낱말도 새 노드로');
    // 스트리밍: 끝에 글이 늘어난다
    const moved = S._span.state().chars;
    root.lastElementChild.append(' 이어지는 답이 계속 붙어요.');
    await sleep(S.REFIND_MS + 80);
    assert.equal(S._span.state().chars, moved);
    // 편집: 글이 편집 칸으로 바뀐 동안은 자리를 버리지 않는다
    const shown = root.innerHTML;
    root.innerHTML = '<textarea class="edit_textarea">원문</textarea>';
    await sleep(S.REFIND_MS + 80);
    assert.equal(S._span.state().chars, moved);
    assert.equal(globalThis.CSS.highlights.has(S.HIGHLIGHT), false);
    root.innerHTML = shown.replace('셋번째', '고친 셋번째');
    await sleep(S.REFIND_MS + 80);
    assert.equal(S._span.state().chars, moved + '고친 '.length);
    assert.equal(toasts.length, 0);
    // 그 낱말이 없어지면 메시지 맨 앞으로
    root.innerHTML = '<p>완전히 새로 쓴 답이에요.</p>';
    await sleep(S.REFIND_MS + 80);
    assert.equal(S._span.state().chars, 0);
    assert.ok(toasts.some(([kind, t]) => kind === 'info' && /맨 앞으로/.test(t)));
    S.selectTo({ range: pick(3, '표식3A') });
    assert.ok(selected().startsWith('완전히 새로 쓴 답이에요.') && selected().endsWith('표식3A'));
});

await test('거두기: 취소 · 다른 채팅 · 설정 끔 — 감시 · 표식 · 칩이 남지 않는다', async () => {
    reset();
    S.setMark({ range: pick(1, '표식1A') });
    document.querySelector(`#${S.GUIDE_ID} .bl-span-guide-cancel`).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(S._span.state(), null);
    assert.equal(document.getElementById(S.GUIDE_ID), null);
    assert.equal(chat.querySelectorAll(`[${S.FLAG_ATTR}]`).length, 0);
    assert.equal((listeners.get(CHAT_CHANGED) || []).length, 0, '채팅 바뀜 리스너를 뗀다');

    S.setMark({ range: pick(1, '표식1A') });
    assert.equal((listeners.get(CHAT_CHANGED) || []).length, 1);
    st.chatId = 'chat-B';
    eventSource.emit(CHAT_CHANGED);
    assert.equal(S._span.state(), null);
    assert.equal(toasts.length, 0, '채팅을 바꾸면 조용히');
    st.chatId = 'chat-A';

    S.setMark({ range: pick(1, '표식1A') });
    S.syncSelSpan(false);
    assert.equal(S._span.state(), null);
    pick(2, '표식2A');
    assert.deepEqual((await toolsNow()).filter(id => id.startsWith('span')), [], '끄면 단추가 없다');
    S.syncSelSpan(true);
    settings.quick.selSpan = false;
    assert.deepEqual((await toolsNow()).filter(id => id.startsWith('span')), [], '설정이 꺼져 있으면 단추가 없다');
    settings.quick.selSpan = true;
    assert.deepEqual((await toolsNow()).filter(id => id.startsWith('span')), ['spanfrom']);
});

await test('메시지가 지워지면 거두고 알린다 · 같은 채팅이 통째로 다시 그려지면 새 요소에 다시 붙인다', async () => {
    reset();
    S.setMark({ range: pick(3, '표식3B') });
    unselect();
    const chars = S._span.state().chars;
    chat.innerHTML = chatHtml();   // reloadCurrentChat: 요소가 전부 새것
    eventSource.emit(CHAT_CHANGED);
    await sleep(S.LOST_MS + 120);
    assert.equal(S._span.state()?.mes, mesAt(3), '같은 번호 · 같은 글의 새 요소');
    assert.equal(S._span.state().chars, chars);
    assert.ok(mesAt(3).hasAttribute(S.FLAG_ATTR));
    assert.equal(toasts.length, 0);
    // 「더 보기」로 위에 메시지가 붙어도 그대로
    chat.insertAdjacentHTML('afterbegin', '<div class="mes" mesid="90"><div class="mes_text"><p>옛 메시지</p></div></div>');
    await sleep(S.LOST_MS + 120);
    assert.equal(S._span.state()?.mes, mesAt(3));
    // 그 메시지를 지운다 — 뒤 메시지가 번호를 물려받아도 글이 달라 붙지 않는다
    mesAt(3).remove();
    mesAt(4).setAttribute('mesid', '3');
    await sleep(S.LOST_MS + 120);
    assert.equal(S._span.state(), null);
    assert.ok(toasts.some(([kind, t]) => kind === 'warning' && /사라져 표시를 거뒀어요/.test(t)));
    assert.equal(document.getElementById(S.GUIDE_ID), null);
});

await test('5분이 지나면 거두고 알린다', () => {
    reset();
    const real = globalThis.setTimeout, timers = [];
    globalThis.setTimeout = (fn, ms, ...rest) => { timers.push([fn, ms]); return real(fn, ms > 60000 ? 2 ** 30 : ms, ...rest); };
    try { S.setMark({ range: pick(0, '표식0A') }); } finally { globalThis.setTimeout = real; }
    const ttl = timers.find(([, ms]) => ms === S.SPAN_TTL_MS);
    assert.ok(ttl, '5분 타이머');
    assert.equal(S.SPAN_TTL_MS, 300000);
    ttl[0]();
    assert.equal(S._span.state(), null);
    assert.ok(toasts.some(([kind, t]) => kind === 'info' && /5분이 지나/.test(t)));
    assert.equal(chat.querySelectorAll(`[${S.FLAG_ATTR}]`).length, 0);
});

await test('이름 줄에서 시작한 끌기는 걸친 첫 메시지 글의 맨 앞 · Highlight 가 없는 브라우저도 줄 표식 · 칩은 뜬다', () => {
    reset();
    const range = document.createRange();
    range.setStart(mesAt(2).querySelector('.name_text').firstChild, 0);
    range.setEnd(textOf(3).querySelector('p').firstChild, 3);
    const keep = globalThis.Highlight;
    globalThis.Highlight = undefined;
    try {
        assert.equal(S.setMark({ range, roots: [textOf(2), textOf(3)] }), true);
        assert.equal(S._span.state().mesid, '2');
        assert.equal(S._span.state().chars, 0);
        assert.ok(mesAt(2).hasAttribute(S.FLAG_ATTR) && document.getElementById(S.GUIDE_ID));
        assert.equal(globalThis.CSS.highlights.has(S.HIGHLIGHT), false);
    } finally { globalThis.Highlight = keep; S.clearMark(); }
});

console.log(`sel-span: ${pass} 통과${fail ? ` · ${fail} 실패` : ''}`);
process.exit(fail ? 1 : 0);
