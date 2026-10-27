// 단추 길게 누르기 설명: 사전 품질 · 커버리지 · 열쇠 찾기 · 짧은 누름 그대로 · 길게 누른 뒤 click 한 번만 막기.
//   node tools/tests/longpress-help.mjs [테마 루트] [실리태번 public 폴더(있으면 열쇠가 실제 화면에 있는지도 봐요)]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const stPublic = process.argv[3] ? path.resolve(process.argv[3]) : '';
const mod = await import(pathToFileURL(path.join(root, 'src/longpress-help.js')));
const { HELP } = await import(pathToFileURL(path.join(root, 'src/longpress-help-data.js')));
const { renderData } = await import(pathToFileURL(path.join(root, 'tools/build-longpress-help.mjs')));
const source = JSON.parse(fs.readFileSync(path.join(root, 'tools/scripts-src/longpress-help/help.json'), 'utf8'));
const { findHelp, indexHelp, menuHelp, startLongpressHelp, SKIP, HOVER_SKIP, HOLD_MS, HOVER_MS, PREFETCH_MS } = mod;

// ── 1. 만든 파일 = 원본, 사전 품질 ──
assert.equal(fs.readFileSync(path.join(root, 'src/longpress-help-data.js'), 'utf8'), renderData(source), 'longpress-help-data.js 가 help.json 과 달라요 — node tools/build-longpress-help.mjs');
assert.equal(HELP.length, source.entries.length);
assert(HELP.length >= 300, `설명 항목이 ${HELP.length}개뿐이에요`);
const W = (...c) => String.fromCharCode(...c); // 금지어는 글자 코드로(이 파일이 출하 검사의 금지어 검사에 걸리지 않게)
const BANNED = new RegExp([W(0xCC10, 0xBE60), W(0xAC24) + '(?![가-힣])', W(0xBC84, 0xADF8, 0x20, 0xC5C6, 0xC74C), '\\d+' + W(0xBC30) + ' '].join('|'));
const GENERIC = /^(menu_button|menu_button_icon|mes_button|interactable|fa|fa-.+|fa-fw|margin0|flex-container|right_menu_button|list-group-item|displayNone|wide100p|justifyCenter|alignItemsCenter)$/;
const seen = new Map();
for (const e of source.entries) {
    const label = `${e.title} (${e.where})`;
    assert(typeof e.title === 'string' && e.title.length >= 2 && e.title.length <= 24 && !/[.?!。]$/.test(e.title), `${label}: 제목 길이 · 끝 글자`);
    assert(typeof e.text === 'string' && e.text.length >= 30 && e.text.length <= 240, `${label}: 설명 길이 ${e.text?.length}`);
    const sentences = e.text.split(/(?<=[요다][.)）]*)\s+(?=\S)/).filter(Boolean);
    assert(sentences.length >= 1 && sentences.length <= 4, `${label}: 문장 ${sentences.length}개`);
    assert(/(?:요|다|니다)[.)）]*$/.test(e.text.trim()), `${label}: 해요체로 끝나지 않아요`);
    assert(!/(?:^|\s)(?:합니다|입니다|한다|된다)[.]?(?:\s|$)/.test(e.text), `${label}: 해요체가 아닌 문장`);
    assert(!BANNED.test(e.text) && !BANNED.test(e.title), `${label}: 금지어`);
    assert(!/\b[A-Za-z]+(?:[\s-]+[A-Za-z]+){4,}\b/.test(e.text), `${label}: 영어 문장`);
    assert(!/[A-Za-z]:[\\/]|Users[\\/]|yunzhu/i.test(JSON.stringify(e)), `${label}: 로컬 경로 · 이름`);
    assert(e.evidence && e.evidence.length > 4, `${label}: 근거 없음`);
    const keys = [...e.ids.map(x => '#' + x), ...e.classes.map(x => '.' + x), ...e.texts.map(x => 't:' + x)];
    assert(keys.length, `${label}: 열쇠 없음`);
    for (const c of e.classes) assert(!GENERIC.test(c), `${label}: 흔한 class 열쇠 ${c}`);
    if (e.scope) assert.doesNotThrow(() => mustParse(e.scope), `${label}: scope 선택자`);
    for (const k of keys) {
        const key = `${k}@${e.scope}`;
        assert(!seen.has(key), `${label}: 열쇠 ${key} 가 「${seen.get(key)}」와 겹쳐요`);
        seen.set(key, e.title);
    }
}
// 범위 밖으로 뺀 곳은 사전에도 없어야 해요(실리태번 원본 길게 누르기)
for (const id of ['world_button', 'persona_lore_button']) assert(!HELP.some(e => e.ids?.includes(id)), `#${id} 는 실리태번이 길게 누르기를 써요`);
assert(!HELP.some(e => e.classes?.some(c => c === 'chat_lorebook_button' || c === 'swipes-counter')));
// 제외 선택자: 원본 excluded 는 모두 런타임 SKIP 에 있어요
const skipParts = new Set(SKIP.split(',').map(s => s.trim()));
for (const x of source.excluded) for (const part of x.selector.split(',')) assert(skipParts.has(part.trim()), `SKIP 에 ${part.trim()} 이 없어요`);

// ── 2. 커버리지: 요청 범위의 대표 단추 ──
const has = (kind, key) => HELP.some(e => e[kind]?.includes(key));
const mustIds = ['bind_preset_to_connection', 'settings_preset_openai', 'update_oai_preset', 'new_oai_preset', 'delete_oai_preset', 'export_oai_preset', 'import_oai_preset',
    'temp_openai', 'top_p_openai', 'freq_pen_openai', 'stream_toggle', 'openai_max_context', 'openai_max_tokens', 'openai_show_thoughts', 'openai_reasoning_effort', 'squash_system_messages',
    'main_api', 'chat_completion_source', 'test_api_button', 'connection_profiles', 'create_connection_profile', 'context_presets', 'instruct_enabled', 'sysprompt_enabled', 'reasoning_auto_parse', 'custom_stopping_strings',
    'extensions_details', 'third_party_extension_button', 'options_button', 'option_regenerate', 'option_start_new_chat', 'extensionsMenuButton', 'send_but', 'mes_continue', 'mes_impersonate', 'mes_stop',
    'rm_button_create', 'favorite_button', 'export_button', 'delete_button', 'persona_rename_button', 'lock_user_name', 'lock_persona_to_char', 'world_create_button', 'world_popup_new', 'world_popup_delete'];
const mustClasses = ['extraMesButtonsHint', 'mes_edit', 'mes_copy', 'mes_translate', 'mes_hide', 'mes_create_branch', 'mes_edit_done', 'mes_edit_delete', 'swipe_left', 'swipe_right'];
for (const id of mustIds) assert(has('ids', id), `#${id} 설명이 없어요`);
for (const c of mustClasses) assert(has('classes', c), `.${c} 설명이 없어요`);
// 사슬 단추: 켬/끔 · 기본값을 말해요
const chain = HELP.find(e => e.ids?.includes('bind_preset_to_connection'));
assert(/켜/.test(chain.text) && /끄/.test(chain.text) && /기본/.test(chain.text), '사슬 단추 설명에 켬 · 끔 · 기본값');

// ── 3. 작은 DOM 흉내 ──
function mustParse(selector) { return selector.split(',').map(s => parseComplex(s.trim())); }
function parseComplex(s) {
    const parts = []; let rest = s.trim(), comb = ' ';
    while (rest) {
        const m = /^((?:[\w-]+|\*)?(?:#[\w-]+|\.[\w-]+|\[[^\]]+\]|:not\((?:[^()]|\([^()]*\))*\))*)\s*(>)?\s*/.exec(rest);
        if (!m || !m[1]) throw Error('selector ' + s);
        parts.push({ comb, compound: m[1] }); comb = m[2] ? '>' : ' '; rest = rest.slice(m[0].length);
    }
    return parts;
}
function matchCompound(el, c) {
    const re = /([\w-]+|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=("?)([^"\]]*)\5)?\]|:not\(((?:[^()]|\([^()]*\))*)\)/y;
    let m; re.lastIndex = 0;
    while (re.lastIndex < c.length && (m = re.exec(c))) {
        if (m[1] && m[1] !== '*' && el.tagName !== m[1].toUpperCase()) return false;
        if (m[2] && el.id !== m[2]) return false;
        if (m[3] && !el.classList.contains(m[3])) return false;
        if (m[4] && (!el.hasAttribute(m[4]) || (m[6] !== undefined && m[5] + m[6] !== '' && el.getAttribute(m[4]) !== m[6]) || (m[5] === '"' && m[6] === '' && el.getAttribute(m[4]) !== ''))) return false;
        if (m[7] && matchCompound(el, m[7])) return false;
    }
    return true;
}
function matchParts(el, parts, i) {
    if (!el || !matchCompound(el, parts[i].compound)) return false;
    if (i === 0) return true;
    if (parts[i].comb === '>') return matchParts(el.parentElement, parts, i - 1);
    for (let up = el.parentElement; up; up = up.parentElement) if (matchParts(up, parts, i - 1)) return true;
    return false;
}
class El {
    constructor(tag, attrs = {}, ...kids) {
        this.tagName = tag.toUpperCase(); this.nodeType = 1; this.attrs = {}; this.children = []; this.parentElement = null; this.isConnected = true; this.style = {};
        for (const [k, v] of Object.entries(attrs)) this.setAttribute(k, v);
        for (const k of kids) { k.parentElement = this; this.children.push(k); }
    }
    get id() { return this.attrs.id || ''; }
    get htmlFor() { return this.attrs.for || ''; }
    get classList() { const list = (this.attrs.class || '').split(/\s+/).filter(Boolean); return Object.assign(list, { contains: c => list.includes(c) }); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    hasAttribute(k) { return k in this.attrs; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    removeAttribute(k) { delete this.attrs[k]; }
    matches(sel) { return mustParse(sel).some(parts => matchParts(this, parts, parts.length - 1)); }
    closest(sel) { for (let n = this; n; n = n.parentElement) if (n.matches(sel)) return n; return null; }
    querySelectorAll(sel) { const out = []; const walk = n => { for (const k of n.children) { if (k.matches(sel)) out.push(k); walk(k); } }; walk(this); return out; }
}
const h = (tag, attrs, ...kids) => new El(tag, attrs, ...kids);
assert(h('input', { type: 'text' }).matches('input[type=text]'));
assert(h('input', {}).matches('input:not([type])') && !h('input', { type: 'checkbox' }).matches('input:not([type])'));
assert(h('div', { contenteditable: '' }).matches('[contenteditable=""]') && !h('div', { contenteditable: 'false' }).matches('[contenteditable=""]'));

// ── 4. 열쇠 찾기 ──
const index = indexHelp(HELP);
const icon = h('i', { class: 'fa-solid fa-link' });
const chainLabel = h('label', { for: 'bind_preset_to_connection', class: 'margin0 menu_button menu_button_icon', title: '프리셋을 API 연결에 묶기', 'data-i18n': '[title]Bind presets to API connections' }, h('input', { id: 'bind_preset_to_connection', type: 'checkbox', class: 'displayNone' }), icon);
const presetBlock = h('div', { id: 'respective-presets-block' }, chainLabel);
h('body', {}, h('div', { id: 'left-nav-panel' }, presetBlock));
assert.equal(findHelp(icon, index)?.entry.title, chain.title, '사슬 아이콘 → label[for] → id');
assert.equal(findHelp(chainLabel, index)?.entry, chain);
// 실리태번이 id 를 바꿔도 data-i18n 키로 따라가요
const moved = h('div', { class: 'menu_button', 'data-i18n': '[title]Bind presets to API connections', title: '번역된 제목' });
h('body', {}, moved);
assert.equal(findHelp(moved, index)?.entry, chain, 'i18n 키 열쇠');
// 체크 항목: 글자 span 을 눌러도 label 안 input id
const streamSpan = h('span', { 'data-i18n': 'Streaming' });
h('body', {}, h('label', { class: 'checkbox_label' }, h('input', { id: 'stream_toggle', type: 'checkbox' }), streamSpan));
assert(findHelp(streamSpan, index)?.entry.ids.includes('stream_toggle'), '체크 항목 글자 → 안쪽 input id');
// 샘플러: 제목을 눌러도 range-block 안 입력 id
const tempTitle = h('div', { class: 'range-block-title', 'data-i18n': 'Temperature' });
h('body', {}, h('div', { class: 'range-block' }, tempTitle, h('div', { class: 'range-block-range' }, h('input', { type: 'range', id: 'temp_openai' }))));
assert(findHelp(tempTitle, index)?.entry.ids.includes('temp_openai'), '샘플러 제목 → range 입력 id');
// 메시지 단추: class + scope .mes, 메시지 밖으로는 안 올라가요
const edit = h('div', { class: 'mes_button mes_edit fa-solid fa-pencil', title: 'Edit', 'data-i18n': '[title]Edit' });
const hint = h('div', { class: 'mes_button extraMesButtonsHint fa-solid fa-ellipsis', title: 'Message Actions' });
const copy = h('div', { class: 'mes_button mes_copy fa-solid fa-copy', title: 'Copy' });
const translate = h('div', { class: 'mes_button mes_translate fa-solid fa-language' });
const hidden = h('div', { class: 'mes_button mes_unhide fa-solid fa-eye-slash' });
const unknown = h('div', { class: 'mes_button some_ext_button' });
const mes = h('div', { class: 'mes', mesid: '3' }, h('div', { class: 'mes_block' }, h('div', { class: 'ch_name' }, h('div', { class: 'mes_buttons' }, hint, h('div', { class: 'extraMesButtons' }, translate, copy, hidden, unknown), edit))));
h('body', {}, h('div', { id: 'chat' }, mes));
assert(findHelp(edit, index)?.entry.classes.includes('mes_edit'));
assert.equal(findHelp(unknown, index), null, '모르는 단추는 설명 없음');
const outside = h('div', { class: 'mes_edit' }); h('body', {}, h('div', { id: 'somewhere' }, outside));
assert.equal(findHelp(outside, index), null, 'scope .mes 밖의 같은 class 는 안 맞아요');
const view = { getComputedStyle: el => ({ display: el === hidden ? 'none' : 'flex' }) };
const menu = menuHelp(hint, findHelp(hint, index).entry, index, view);
assert.deepEqual(menu.list.map(([t]) => t), [findHelp(translate, index).entry.title, findHelp(copy, index).entry.title], '… 목록 = 보이는 단추 가운데 설명이 있는 것');
const allHidden = menuHelp(hint, findHelp(hint, index).entry, index, { getComputedStyle: () => ({ display: 'none' }) });
assert(allHidden.list.length >= 3, '단추 줄이 통째로 숨어 있으면 직접 숨긴 것만 빼고 보여요');
// 테마 애드온 글 열쇠(scope 로 가림)
const prev = h('button', { 'aria-label': '이전 답' });
h('body', {}, h('div', { id: 'bl-onehand' }, prev));
assert(findHelp(prev, index)?.entry, '한 손 줄 이전 답');
const prevElse = h('button', { 'aria-label': '이전 답' }); h('body', {}, prevElse);
assert.equal(findHelp(prevElse, index), null, 'scope 밖 같은 글은 안 맞아요');

// ── 5. 누르기 흐름 (가짜 시계 · 이벤트) ──
function makeEnv({ enabled = () => true } = {}) {
    let now = 0, seq = 0; const timers = new Map(), listeners = [];
    const target = (where) => ({ addEventListener: (type, fn, opt) => listeners.push({ where, type, fn, capture: opt === true || !!opt?.capture }), removeEventListener: (type, fn) => { const i = listeners.findIndex(l => l.where === where && l.type === type && l.fn === fn); if (i >= 0) listeners.splice(i, 1); } });
    const doc = target('doc'), host = { ...target('host'), Element: El, navigator: {}, setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id; }, clearTimeout: id => timers.delete(id) };
    let loads = 0; const opened = [];
    const stop = startLongpressHelp({ isEnabled: enabled, doc, host, load: () => { loads++; return { HELP }; }, open: help => opened.push(help) });
    const fire = (type, el, extra = {}) => {
        const ev = { type, target: el, pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch', clientX: 10, clientY: 10, defaultPrevented: false, stopped: false, ...extra,
            preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, stopPropagation() { this.stopped = true; } };
        for (const where of ['host', 'doc']) for (const l of listeners.filter(l => l.where === where && l.type === type)) { if (ev.stopped) break; l.fn(ev); }
        return ev;
    };
    const advance = async ms => { const until = now + ms; for (;;) { const next = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; timers.delete(next[0]); now = next[1].at; await next[1].fn(); await new Promise(r => setImmediate(r)); } now = until; await new Promise(r => setImmediate(r)); };
    return { fire, advance, opened, get loads() { return loads; }, timers, stop };
}
// 짧은 누름: 원래 동작 그대로, 사전도 안 읽어요
{
    const env = makeEnv();
    env.fire('pointerdown', icon); await env.advance(120); const up = env.fire('pointerup', icon); const click = env.fire('click', icon);
    assert(!up.defaultPrevented && !up.stopped && !click.defaultPrevented && !click.stopped, '짧은 누름은 막지 않아요');
    await env.advance(2000);
    assert.equal(env.opened.length, 0); assert.equal(env.loads, 0, '짧은 누름은 사전을 읽지 않아요');
    env.stop();
}
// 길게 누름: 설명 창 · 손 뗄 때 pointerup · click 한 번만 막기 · 다음 누름은 그대로
{
    const env = makeEnv();
    env.fire('pointerdown', icon); await env.advance(PREFETCH_MS + 10); assert.equal(env.loads, 1, '0.2초 넘게 누르면 미리 읽어요');
    await env.advance(HOLD_MS);
    assert.equal(env.opened.length, 1); assert.equal(env.opened[0].title, chain.title); assert.deepEqual(env.opened[0].body, [chain.text]);
    const up = env.fire('pointerup', icon); const click = env.fire('click', icon);
    assert(up.stopped && click.defaultPrevented && click.stopped, '길게 누른 뒤 따라오는 click 은 막아요');
    const again = env.fire('click', icon); assert(!again.stopped, '막기는 한 번만');
    env.fire('pointerdown', icon); await env.advance(80); env.fire('pointerup', icon); const next = env.fire('click', icon);
    assert(!next.stopped, '다음 짧은 누름은 원래대로');
    assert.equal(env.loads, 1, '사전은 한 번만 읽어요'); env.stop();
}
// 폰: 창이 뜬 뒤 pointerup 없이 click 이 설명 창으로 떨어져도 막아요(바깥 누르면 닫기가 방금 연 창을 닫지 않게). 그 뒤 창 안 누름 · 키보드 click 은 그대로
{
    const env = makeEnv();
    const dialog = h('dialog', { class: 'bl-tool-dialog bl-wi-help-dialog' }); const close = h('button', {}); dialog.children.push(close); close.parentElement = dialog; h('body', {}, dialog);
    env.fire('pointerdown', icon); await env.advance(HOLD_MS + 10);
    const c = env.fire('click', dialog, { detail: 1 }); assert(c.stopped, '창으로 떨어진 손 뗌 click 도 막아요');
    env.fire('pointerdown', close); env.fire('pointerup', close); const c2 = env.fire('click', close, { detail: 1 }); assert(!c2.stopped, '창 안 닫기 단추는 그대로');
    env.fire('pointerdown', icon); await env.advance(HOLD_MS + 10);
    const k = env.fire('click', close, { detail: 0 }); assert(!k.stopped, '키보드 click 은 그대로'); env.stop();
}
// 폰이 click 을 건너뛰어도, 다음 누름의 click 은 막지 않아요
{
    const env = makeEnv();
    env.fire('pointerdown', icon); await env.advance(HOLD_MS + 10); env.fire('pointerup', icon);
    env.fire('pointerdown', edit); await env.advance(60); env.fire('pointerup', edit); const c = env.fire('click', edit);
    assert(!c.stopped, '새 누름이 오면 막기를 풀어요'); env.stop();
}
// 움직이면 취소 · 설정 끄면 아무것도 안 해요 · 제외 자리 · 글 칸
{
    const env = makeEnv();
    env.fire('pointerdown', icon); await env.advance(200); env.fire('pointermove', icon, { clientX: 40 }); await env.advance(600);
    assert.equal(env.opened.length, 0, '움직이면 취소'); env.stop();
    const off = makeEnv({ enabled: () => false });
    off.fire('pointerdown', icon); await off.advance(900); assert.equal(off.opened.length, 0); assert.equal(off.timers.size, 0, '꺼져 있으면 타이머도 없어요'); off.stop();
    const skip = makeEnv();
    skip.fire('pointerdown', copy); await skip.advance(900); assert.equal(skip.opened.length, 0, '… 메뉴 안 단추는 기존 길게 누르기(꺼내기)가 이겨요');
    const counter = h('div', { class: 'swipes-counter' }); h('body', {}, counter);
    skip.fire('pointerdown', counter); await skip.advance(900); assert.equal(skip.opened.length, 0, '실리태번 스와이프 숫자 길게 누르기가 이겨요');
    const fruit = h('div', { class: 'fh-item', id: 'stream_toggle' }); h('body', {}, h('div', { id: 'fruit-heart-v6' }, fruit));
    skip.fire('pointerdown', fruit); await skip.advance(900); assert.equal(skip.opened.length, 0, '과일의 마음 창 안은 과일 설명이 이겨요');
    const area = h('textarea', { id: 'send_textarea' }); h('body', {}, area);
    skip.fire('pointerdown', area); await skip.advance(900); assert.equal(skip.opened.length, 0, '글 칸은 글 고르기 그대로'); skip.stop();
}
// 설명이 없는 단추: 길게 눌러도 click 을 막지 않아요
{
    const env = makeEnv(); const plain = h('div', { class: 'some-button' }); h('body', {}, plain);
    env.fire('pointerdown', plain); await env.advance(900); env.fire('pointerup', plain); const c = env.fire('click', plain);
    assert.equal(env.opened.length, 0); assert(!c.stopped, '설명이 없으면 원래 click 그대로'); env.stop();
}
// … 단추 길게 누름 = 그 메시지 메뉴 단추 목록
{
    const env = makeEnv();
    env.fire('pointerdown', hint); await env.advance(HOLD_MS + 10);
    assert.equal(env.opened.length, 1); assert(env.opened[0].list.length >= 2, '… 목록'); env.stop();
}
// 폰 contextmenu 가 타이머보다 먼저 오면(사전이 있으면) 그때 띄우고 기본 메뉴를 막아요. 마우스 오른쪽 클릭은 그대로
{
    const env = makeEnv();
    env.fire('pointerdown', icon); await env.advance(PREFETCH_MS + 20);
    const cm = env.fire('contextmenu', icon); assert(cm.defaultPrevented); assert.equal(env.opened.length, 1);
    await env.advance(600); assert.equal(env.opened.length, 1, '두 번 띄우지 않아요'); env.stop();
    const mouse = makeEnv();
    mouse.fire('pointerdown', icon, { pointerType: 'mouse', button: 2 }); const rc = mouse.fire('contextmenu', icon, { pointerType: 'mouse' });
    assert(!rc.defaultPrevented, '오른쪽 클릭 메뉴는 그대로'); mouse.stop();
}
// PC 마우스 올려 두기: title 을 설명으로 바꿨다가 내려가면 원래대로
{
    const env = makeEnv();
    const before = chainLabel.getAttribute('title');
    env.fire('pointerover', chainLabel, { pointerType: 'mouse' }); await env.advance(HOVER_MS + 10);
    assert(chainLabel.getAttribute('title').includes(chain.text), '풍선 글 = 설명');
    env.fire('pointerout', chainLabel, { pointerType: 'mouse' }); assert.equal(chainLabel.getAttribute('title'), before, '원래 title 로');
    env.fire('pointerover', icon, { pointerType: 'touch' }); await env.advance(HOVER_MS + 10); assert.equal(icon.getAttribute('title'), null, '터치는 풍선 글 없음');
    env.fire('pointerover', copy, { pointerType: 'mouse' }); await env.advance(HOVER_MS + 10); assert(copy.getAttribute('title').includes('\n'), '… 메뉴 단추도 PC 풍선 글은 보여요');
    env.stop();
}
assert(!HOVER_SKIP.includes('extraMesButtons'));

// ── 5b. 테마 애드온 단추 열쇠는 테마 소스에 있어요 ──
{
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.js$/.test(e.name) && !/longpress-help/.test(e.name) ? [path.join(dir, e.name)] : []);
    const themeText = [path.join(root, 'index.js'), ...walk(path.join(root, 'src'))].map(f => fs.readFileSync(f, 'utf8')).join('\n');
    const missing = [];
    for (const e of source.entries.filter(e => e.area === '블루레몬에이드 애드온 단추')) for (const key of [...e.ids, ...e.classes, ...e.texts]) if (!themeText.includes(key) && !(/^bl-perf-menu-(\w+)$/.test(key) && themeText.includes('bl-perf-menu-${tab.id}') && new RegExp(`id\\s*:\\s*['"]${key.slice(13)}['"]`).test(themeText))) missing.push(key); // 성능 보조 메뉴 줄은 탭 id 로 만들어요
    assert.deepEqual(missing, [], '테마 소스에 없는 애드온 단추 열쇠');
}

// ── 6. (있으면) 실리태번 설치본: 사전의 id · 글 열쇠가 실제 화면 파일에 있어요 ──
let stChecked = 0;
if (stPublic) {
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (['lib', 'third-party', 'node_modules'].includes(e.name) ? [] : walk(path.join(dir, e.name))) : /\.(html|js)$/.test(e.name) ? [path.join(dir, e.name)] : []);
    const text = [path.join(stPublic, 'index.html'), ...walk(path.join(stPublic, 'scripts'))].map(f => fs.readFileSync(f, 'utf8')).join('\n');
    const missing = [];
    for (const e of source.entries) {
        if (e.area === '블루레몬에이드 애드온 단추') continue;
        for (const id of e.ids) { stChecked++; if (!text.includes(`id="${id}"`) && !text.includes(`id='${id}'`) && !text.includes(`'#${id}'`) && !text.includes(`"#${id}"`)) missing.push('#' + id); }
        for (const c of e.classes) { stChecked++; if (!new RegExp(`class="[^"]*\\b${c}\\b`).test(text) && !text.includes(`.${c}`)) missing.push('.' + c); }
        for (const t of e.texts) { stChecked++; if (!text.includes(t)) missing.push('t:' + t); }
    }
    assert.deepEqual(missing, [], '실리태번 화면에 없는 열쇠');
}
console.log(`Long-press help: ${HELP.length} entries, ${seen.size} keys, ${source.excluded.length} excluded areas${stPublic ? `, ${stChecked} keys found in SillyTavern` : ''} — passed`);
