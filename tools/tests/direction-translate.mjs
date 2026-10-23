// 전개 지시 — 프롬프트 칸의 번역 보기: 번역본 위 · 원문 아래 · 다시 누르면 접힘 · 같은 글은 캐시 · 원문을 고치면 「원문이 바뀌었어요 · 다시 번역」 · 진행 표시 · 실패 안내
//   node tools/tests/direction-translate.mjs <테마 루트>   (공개 저장소는 '.')
// direction-prompts.mjs 와 같은 틀 (index.js 를 '// ── 시작' 앞까지 떼어 불러온다). 번역은 가짜 엔진(useTranslateEngine)으로만 — 실제 요청을 보내지 않는다.
// 화면은 작은 가짜 DOM: 이 기능이 만드는 마크업(태그 · 속성 · 글)을 읽고, 고르개는 태그 · .클래스 · [속성] · [속성="값"] · [속성^="값"] 와 띄어 쓴 자손만. 예시 글은 지어낸 것.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.'), url = pathToFileURL(root + '/');
const read = rel => fs.readFile(path.join(root, rel), 'utf8');

// ---------- 작은 가짜 DOM
const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
class Text { constructor(text) { this.text = text; this.parentElement = null; } get textContent() { return this.text; } }
class El {
    constructor(tag) {
        this.tagName = tag.toUpperCase(); this.attrs = {}; this.dataset = {}; this.children = []; this.parentElement = null;
        this.hidden = false; this.disabled = false; this.listeners = {};
        const names = new Set(); this.classNames = names;
        this.classList = { add: (...n) => n.forEach(x => names.add(x)), remove: (...n) => n.forEach(x => names.delete(x)), contains: n => names.has(n),
            toggle: (n, force) => { const on = force === undefined ? !names.has(n) : !!force; if (on) names.add(n); else names.delete(n); return on; } };
    }
    set className(value) { this.classNames.clear(); String(value).split(/\s+/).filter(Boolean).forEach(n => this.classNames.add(n)); }
    get className() { return [...this.classNames].join(' '); }
    setAttribute(key, value) {
        value = String(value);
        if (key === 'class') this.className = value;
        else if (key === 'hidden') this.hidden = true;
        else if (key.startsWith('data-')) this.dataset[camel(key.slice(5))] = value;
        else this.attrs[key] = value;
    }
    getAttribute(key) {
        if (key === 'class') return this.className;
        if (key === 'hidden') return this.hidden ? '' : null;
        if (key.startsWith('data-')) return this.dataset[camel(key.slice(5))] ?? null;
        if (key === 'title' && this.title !== undefined) return this.title;
        return key in this.attrs ? this.attrs[key] : null;
    }
    append(...nodes) { for (const node of nodes) { const n = typeof node === 'string' ? new Text(node) : node; n.parentElement = this; this.children.push(n); } }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    get elements() { return this.children.filter(c => c instanceof El); }
    get textContent() { return this.children.map(c => c.textContent).join(''); }
    set textContent(value) { this.children = []; if (value !== '') this.append(new Text(String(value))); }
    get innerHTML() { return this._html ?? ''; }
    set innerHTML(html) {
        this._html = html; this.children = [];
        const stack = [this];
        for (const m of String(html).matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g)) {
            const top = stack.at(-1);
            if (m[4] !== undefined) { top.append(new Text(m[4].replace(/&amp;/g, '&'))); continue; }
            if (m[1]) { stack.pop(); continue; }
            const el = new El(m[2]);
            for (const a of m[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) el.setAttribute(a[1], a[2] ?? '');
            top.append(el);
            if (!/\/\s*$/.test(m[3])) stack.push(el);
        }
    }
    matches(selector) {
        const parts = selector.trim().split(/\s+/);
        if (!matchOne(this, parts.at(-1))) return false;
        let node = this.parentElement;
        for (let i = parts.length - 2; i >= 0; i--) { while (node && !matchOne(node, parts[i])) node = node.parentElement; if (!node) return false; node = node.parentElement; }
        return true;
    }
    querySelectorAll(selector) { const out = []; const walk = el => { for (const c of el.elements) { if (selector.split(',').some(s => c.matches(s))) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    closest(selector) { for (let n = this; n; n = n.parentElement) if (n.matches?.(selector)) return n; return null; }
    contains(node) { for (let n = node; n; n = n.parentElement) if (n === this) return true; return false; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    focus() {}
    scrollIntoView() {}
}
function matchOne(el, compound) {
    if (!(el instanceof El)) return false;
    for (const m of compound.matchAll(/^([a-zA-Z][\w-]*)|\.([\w-]+)|\[([\w-]+)(?:(\^?=)"([^"]*)")?\]/g)) {
        if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
        if (m[2] && !el.classList.contains(m[2])) return false;
        if (m[3]) { const v = el.getAttribute(m[3]); if (v === null) return false; if (m[4] === '=' && v !== m[5]) return false; if (m[4] === '^=' && !v.startsWith(m[5])) return false; }
    }
    return true;
}
globalThis.document = { createElement: tag => new El(tag), getElementById: () => null, querySelector: () => null, addEventListener() {}, removeEventListener() {} };
globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
const warns = [];
const realWarn = console.warn;
console.warn = (...args) => { if (String(args[0]).includes('전개 지시')) warns.push(args); else realWarn(...args); };

// ---------- index.js 앞부분
const { insertInstructions } = await import(new URL('src/addons/direction/prompt.js', url));
const ext = { salty: { addons: { prompt: true } } };
globalThis.__directionTest = { ext, insertInstructions, saves: 0, context: { substituteParams: text => String(text) } };
const js = await read('src/addons/direction/index.js');
const source = js.split('// ── 시작')[0].replace(/^import .*;$/gm, '');
const prelude = 'const {ext:extension_settings,insertInstructions}=globalThis.__directionTest;const getContext=()=>globalThis.__directionTest.context;const saveSettingsDebounced=()=>{globalThis.__directionTest.saves++;};const eventSource={on(){}};const event_types={};const POPUP_TYPE={};const callGenericPopup=async()=>true;const oai_settings={};const getChatCompletionModel=()=>"example-model";const verifyAddonCss=()=>{};const badgeTextHit=()=>true;const showThemeModal=()=>{};';
const hooks = '\nexport function __state(p,e,o,s){popup=p;promptEdit=e;openPromptId=o;settingsRoot=s;}\nexport {initSettings,settings,promptRow,promptEditor,onPromptsInput,onTranslateAct,trStates,trMemo,TR_FAIL};';
const m = await import('data:text/javascript;base64,' + Buffer.from(prelude + source + hooks).toString('base64'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); } catch (error) { fail++; console.log(`  FAIL ${name}\n       ${String(error.stack || error).split('\n').slice(0, 6).join('\n       ')}`); }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

// 가짜 번역 엔진: 부른 글을 적어 두고 「[ko] 원문」 을 돌려준다. cached 는 패널 캐시 흉내
const calls = [];
const panelCache = new Map();
let pending = null;   // 진행 표시를 보려면 약속을 붙잡아 둔다
let failWith = null;
const engine = {
    cached: text => panelCache.get(text) ?? null,
    translate: async text => {
        calls.push(text);
        if (pending) await pending.promise;
        if (failWith) throw failWith;
        return `[ko] ${text}`;
    },
};
const hold = () => { let release; const promise = new Promise(resolve => { release = resolve; }); pending = { promise, release }; };
m.useTranslateEngine(engine);

const fresh = () => {
    ext.jeongaejisi = { extensionEnabled: true, direction: { enabled: false, content: '' }, always: { enabled: false, content: '' }, directionPrompt: 'Continue the story. {{direction}}', promptDepth: 1, presets: [], history: { direction: [], always: [] },
        promptList: [{ id: 'pa', title: '문체 다듬기', content: 'Polish the prose.', enabled: true, at: 1 }, { id: 'pb', title: '같은 글', content: 'Polish the prose.', enabled: false, at: 2 },
            { id: 'pc', title: '캐시', content: 'Keep replies short.', enabled: false, at: 3 }] };
    m.initSettings();
    m.trStates.clear();
    m.trMemo.clear();
    return m.settings();
};
// 깃털 창 흉내: 펼친 줄 하나를 담은 popup
function openRow(id, edit = null) {
    const popup = new El('div'), list = new El('ul');
    list.className = 'jj-pitems';
    popup.append(list);
    const items = m.settings().promptList;
    m.__state(popup, edit, id, null);
    const index = items.findIndex(item => item.id === id);
    const row = m.promptRow(items[index], index, items.length);
    list.append(row);
    return { popup, row, box: () => row.querySelector('.jj-tr'), button: () => row.querySelector('.jj-tr-btn'), text: () => row.querySelector('.jj-tr-text').textContent };
}

await test('펼친 줄: 번역본 상자가 내용 위 · 원문 라벨은 상자 끝(원문 바로 위) · 단추는 ↑ ↓ 다음 · 처음엔 접힘', () => {
    fresh();
    const { row, box, button } = openRow('pa');
    const body = row.querySelector('.jj-pitem-body');
    assert.deepEqual(body.elements.map(el => el.className), ['jj-tr', 'jj-pitem-content', 'jj-pitem-actions'], 'translation above the original');
    assert.deepEqual(box().elements.map(el => el.className), ['jj-tr-head', 'jj-tr-text', 'jj-tr-label jj-tr-orig']);
    assert.equal(box().querySelector('.jj-tr-orig').textContent, '원문');
    assert.equal(box().hidden, true, 'closed at first');
    const acts = row.querySelector('.jj-pitem-actions').elements.map(el => el.dataset.pact || el.className);
    assert.deepEqual(acts, ['up', 'down', 'translate', 'jj-pspacer', 'edit', 'delete']);
    assert.equal(button().getAttribute('aria-label'), '번역 보기');
    assert.equal(button().getAttribute('aria-expanded'), 'false');
    assert.match(button().innerHTML, /fa-solid fa-language/);
});

await test('누르면 번역본이 열리고(진행 표시 → 번역문) · 다시 누르면 접힘 · 또 누르면 요청 없이 바로', async () => {
    fresh(); calls.length = 0;
    const { box, button, text } = openRow('pa');
    hold();
    m.onTranslateAct('translate', 'p:pa');
    assert.equal(box().hidden, false);
    assert.equal(text(), '번역하는 중…');
    assert.equal(button().getAttribute('aria-busy'), 'true');
    assert.match(button().innerHTML, /fa-spinner/, 'spinner while translating');
    assert.equal(button().getAttribute('aria-label'), '번역 접기');
    pending.release(); pending = null; await tick(); await tick();
    assert.equal(text(), '[ko] Polish the prose.');
    assert.equal(button().getAttribute('aria-busy'), 'false');
    assert.match(button().innerHTML, /fa-language/);
    assert.equal(button().getAttribute('aria-expanded'), 'true');
    assert.equal(box().querySelector('.jj-tr-stale').hidden, true);
    assert.equal(box().querySelector('.jj-tr-redo').hidden, true);
    m.onTranslateAct('translate', 'p:pa');
    assert.equal(box().hidden, true, 'second press folds it');
    assert.equal(button().getAttribute('aria-label'), '번역 보기');
    m.onTranslateAct('translate', 'p:pa');
    assert.equal(box().hidden, false);
    assert.equal(text(), '[ko] Polish the prose.', 'shown at once');
    assert.deepEqual(calls, ['Polish the prose.'], 'one request in total');
});

await test('캐시: 같은 글의 다른 줄은 요청 없이 바로 · 패널 캐시에 있는 글도 요청 없이 · 다시 그려도(접었다 펼쳐도) 열린 채', async () => {
    fresh(); calls.length = 0;
    let view = openRow('pa');
    m.onTranslateAct('translate', 'p:pa'); await tick(); await tick();
    view = openRow('pb');
    m.onTranslateAct('translate', 'p:pb');
    assert.equal(view.text(), '[ko] Polish the prose.', 'same text: from the memo, synchronously');
    panelCache.set('Keep replies short.', '짧게 답해요.');
    view = openRow('pc');
    m.onTranslateAct('translate', 'p:pc'); await tick(); await tick();
    assert.equal(view.text(), '짧게 답해요.');
    assert.deepEqual(calls, ['Polish the prose.'], 'cached texts never reach translate()');
    view = openRow('pa');   // 목록을 다시 그림 (펼치기 · 순서 바꾸기)
    assert.equal(view.box().hidden, false, 'state survives a re-render');
    assert.equal(view.text(), '[ko] Polish the prose.');
    panelCache.clear();
});

await test('고치는 칸: 제목 → 번역본 → 원문 칸 → 단추 줄 · 원문을 고치면 「원문이 바뀌었어요 · 다시 번역」 · 다시 번역하면 새 글로', async () => {
    fresh(); calls.length = 0;
    openRow('pa');
    m.onTranslateAct('translate', 'p:pa'); await tick(); await tick();
    const item = m.settings().promptList[0];
    const edit = { id: 'pa', title: item.title, content: item.content };
    const popup = new El('div');
    m.__state(popup, edit, 'pa', null);
    const editor = m.promptEditor(item);
    popup.append(editor);
    assert.deepEqual(editor.elements.map(el => el.className), ['jj-ptitle-input', 'jj-tr', 'jj-pcontent-input', 'jj-pitem-actions']);
    assert.equal(editor.querySelector('.jj-pitem-actions').elements[0].dataset.pact, 'translate', 'button first in the edit row');
    const box = editor.querySelector('.jj-tr');
    assert.equal(box.hidden, false, 'still open while editing');
    assert.equal(box.querySelector('.jj-tr-text').textContent, '[ko] Polish the prose.');
    assert.equal(box.querySelector('.jj-tr-stale').hidden, true);
    m.onPromptsInput({ target: { dataset: { field: 'content' }, value: 'Polish the prose again.' } });   // 원문 칸은 그대로 고칠 수 있다
    assert.equal(edit.content, 'Polish the prose again.');
    assert.equal(box.querySelector('.jj-tr-stale').hidden, false, 'changed marker');
    assert.equal(box.querySelector('.jj-tr-stale').textContent, '원문이 바뀌었어요');
    const redo = box.querySelector('.jj-tr-redo');
    assert.equal(redo.hidden, false); assert.equal(redo.textContent, '다시 번역'); assert.equal(redo.dataset.pact, 'translate-redo');
    assert.equal(box.classList.contains('is-stale'), true);
    m.onPromptsInput({ target: { dataset: { field: 'content' }, value: 'Polish the prose.  ' } });   // 앞뒤 빈칸만 다르면 같은 글
    assert.equal(box.querySelector('.jj-tr-stale').hidden, true);
    m.onPromptsInput({ target: { dataset: { field: 'content' }, value: 'Polish the prose again.' } });
    m.onTranslateAct('translate-redo', 'p:pa'); await tick(); await tick();
    assert.equal(box.querySelector('.jj-tr-text').textContent, '[ko] Polish the prose again.');
    assert.equal(box.querySelector('.jj-tr-stale').hidden, true);
    assert.deepEqual(calls, ['Polish the prose.', 'Polish the prose again.']);
});

await test('실패: 짧은 해요체 안내 + 「다시 시도」 · 패널이 알려 준 까닭(진행 중 등)은 그 글 · 한글화 패널이 꺼져 있으면 켜 달라는 안내', async () => {
    fresh(); calls.length = 0; warns.length = 0;
    failWith = new Error('HTTP 401 unauthorized');
    let view = openRow('pa');
    m.onTranslateAct('translate', 'p:pa'); await tick(); await tick();
    assert.equal(view.text(), '번역하지 못했어요. 번역 연결을 확인해 주세요.');
    assert.equal(view.text(), m.TR_FAIL);
    assert.equal(view.box().querySelector('.jj-tr-text').classList.contains('is-muted'), true);
    const redo = view.box().querySelector('.jj-tr-redo');
    assert.equal(redo.hidden, false); assert.equal(redo.textContent, '다시 시도');
    assert.equal(view.box().querySelector('.jj-tr-stale').hidden, true, 'not a "changed" case');
    assert.equal(warns.length, 1, 'the real error goes to the console');
    failWith = null;
    m.onTranslateAct('translate-redo', 'p:pa'); await tick(); await tick();
    assert.equal(view.text(), '[ko] Polish the prose.', 'retry works');
    failWith = Object.assign(new Error('한글화 패널에서 다른 번역이 진행 중이에요. 끝난 뒤 다시 눌러 주세요.'), { userMessage: true });
    view = openRow('pc');
    m.onTranslateAct('translate', 'p:pc'); await tick(); await tick();
    assert.equal(view.text(), '한글화 패널에서 다른 번역이 진행 중이에요. 끝난 뒤 다시 눌러 주세요.');
    failWith = null;
    // 접었다 다시 펼치면 실패한 것은 다시 시도한다
    m.onTranslateAct('translate', 'p:pc'); m.onTranslateAct('translate', 'p:pc'); await tick(); await tick();
    assert.equal(view.text(), '[ko] Keep replies short.');
    // 한글화 패널 애드온이 꺼져 있으면 요청 없이 안내 (엔진을 가져오기 전에)
    m.useTranslateEngine(null); ext.salty.addons.prompt = false; fresh(); calls.length = 0;
    view = openRow('pa');
    m.trStates.clear();
    m.onTranslateAct('translate', 'p:pa'); await tick(); await tick();
    assert.equal(view.text(), '한글화 패널 애드온을 켜면 번역을 볼 수 있어요.');
    assert.deepEqual(calls, []);
    ext.salty.addons.prompt = true; m.useTranslateEngine(engine);
});

await test('빈 글은 요청하지 않음 · 새로 적는 줄(p:new)의 번역은 저장하면 그 줄로 · 지운 줄의 상태는 버림', async () => {
    fresh(); calls.length = 0;
    const popup = new El('div');
    const edit = { id: 'new', title: '', content: '' };
    m.__state(popup, edit, null, null);
    const editor = m.promptEditor(null);
    popup.append(editor);
    m.onTranslateAct('translate', 'p:new'); await tick();
    assert.equal(editor.querySelector('.jj-tr-text').textContent, '번역할 글이 없어요.');
    assert.deepEqual(calls, []);
    assert.match(js, /if \(trStates\.has\('p:new'\)\) \{ trStates\.set\(`p:\$\{id\}`, trStates\.get\('p:new'\)\); trStates\.delete\('p:new'\); \}/, 'moved to the saved row');
    assert.match(js, /if \(was === 'new'\) trStates\.delete\('p:new'\);/, 'cancel drops it');
    assert.match(js, /trStates\.delete\(`p:\$\{id\}`\);\s*save\(\);\s*renderPrompts\('\[data-pact="add"\]'\);/, 'delete drops it');
});

await test('설정의 전개 지시 프롬프트: 번역본 상자가 칸 위 · 단추는 「기본값으로」 앞 · 고치면 다시 칠함 · 기본값으로도', () => {
    const settingsPart = js.slice(js.indexOf('function buildSettings()'));
    const boxAt = settingsPart.indexOf('<div class="jj-tr" data-tr="s:prompt" hidden>');
    const fieldAt = settingsPart.indexOf('<textarea id="jj_prompt"');
    const buttonAt = settingsPart.indexOf('class="jj-tr-btn" data-pact="translate" data-tr="s:prompt" aria-label="번역 보기"');
    const resetAt = settingsPart.indexOf('id="jj_reset"');
    assert.ok(boxAt > 0 && boxAt < fieldAt, 'box above the field');
    assert.ok(buttonAt > fieldAt && buttonAt < resetAt, 'button in the action row, before reset');
    assert.match(settingsPart, /store\.directionPrompt = prompt\.value;\s*showPromptState\(\);\s*save\(\);\s*paintTranslation\('s:prompt'\);/);
    assert.match(settingsPart, /prompt\.value = DEFAULT_PROMPT;\s*showPromptState\(\);\s*save\(\);\s*paintTranslation\('s:prompt'\);/);
    // 같은 칠하기 함수로: 설정 상자도 열고 접힌다
    fresh(); calls.length = 0;
    const settingsRoot = new El('div');
    settingsRoot.innerHTML = `<div class="jj-tr" data-tr="s:prompt" hidden>${'<div class="jj-tr-head"><span class="jj-tr-label">번역</span><span class="jj-tr-stale" hidden>원문이 바뀌었어요</span><button type="button" class="menu_button jj-small-btn jj-tr-redo" data-pact="translate-redo" hidden><span>다시 번역</span></button></div><div class="jj-tr-text" aria-live="polite"></div><div class="jj-tr-label jj-tr-orig">원문</div>'}</div><button type="button" class="jj-tr-btn" data-pact="translate" data-tr="s:prompt"><i></i></button>`;
    m.__state(null, null, null, settingsRoot);
    m.onTranslateAct('translate', 's:prompt');
    return tick().then(tick).then(() => {
        assert.equal(settingsRoot.querySelector('.jj-tr').hidden, false);
        assert.equal(settingsRoot.querySelector('.jj-tr-text').textContent, '[ko] Continue the story. {{direction}}');
        m.settings().directionPrompt = 'Changed. {{direction}}';
        m.onTranslateAct('translate', 's:prompt'); m.onTranslateAct('translate', 's:prompt');
    }).then(tick).then(tick).then(() => {
        assert.equal(settingsRoot.querySelector('.jj-tr-text').textContent, '[ko] Changed. {{direction}}', 'reopening after an edit translates the new text');
        assert.deepEqual(calls, ['Continue the story. {{direction}}', 'Changed. {{direction}}']);
    });
});

await test('엔진 재사용 · 아이콘 · 모양(아이콘 단추 규격 · 1px 선 · 스크롤바 숨김 · 새 색 없음) · CI', async () => {
    const panel = await read('src/addons/prompt/index.js');
    assert.match(panel, /export async function translatePlainText\(text\) \{[\s\S]*?await translateText\('', source, null, \{ includeTitle: false \}\)[\s\S]*?setCache\(SHARED_TEXT_NS, sharedTextId\(source\), result\)/, 'panel translateText + panel cache');
    assert.match(panel, /export function cachedTextTranslation\(text\) \{[\s\S]*?getCached\(SHARED_TEXT_NS, sharedTextId\(source\)\)/);
    assert.match(panel, /if \(isBusy\) throw Object\.assign\(new Error\('한글화 패널에서 다른 번역이 진행 중이에요/, 'never overlaps a panel run');
    assert.match(panel, /if \(duplicate\) throw/, 'stays off when a standalone panel owns the cache files');
    assert.match(js, /const panel = await import\('\.\.\/prompt\/index\.js'\);\s*await panel\.ready;/);
    assert.match(js, /trEngine = \{ cached: text => panel\.cachedTextTranslation\(text\), translate: text => panel\.translatePlainText\(text\) \};/);
    assert.doesNotMatch(js, /fetch\(|\/api\/backends|chat-completions|runCompletion/, 'no translation path of its own');
    assert.match(panel, /<button class="pt-btn pt-btn-primary pt-act"\s+id="\$\{idPfx\}-trans"><i class="fa-solid fa-language"/, 'panel 번역 button icon');
    assert.match(js, /const TR_ICON = 'fa-solid fa-language';/, 'same icon');
    const css = await read('src/addons/direction/style.css');
    const rule = sel => { const at = css.indexOf(`${sel} {`); assert.ok(at >= 0, sel); return css.slice(at, css.indexOf('}', at)); };
    const btn = rule(':is(#jj-popup, #jj-settings) .jj-tr-btn');
    for (const decl of ['width: 32px;', 'height: 40px;', 'border: 0;', 'background: none;', 'box-shadow: none;', 'color: inherit;', 'font-size: 12.5px;']) assert.ok(btn.includes(decl), decl);
    const face = rule('.jj-tr-text');
    for (const decl of ['border: 1px solid var(--salty-line, var(--SmartThemeBorderColor));', 'background: transparent;', 'box-shadow: none;', 'scrollbar-width: none;']) assert.ok(face.includes(decl), decl);
    assert.match(css, /\.jj-tr-text::-webkit-scrollbar \{ display: none; \}/);
    const block = css.slice(css.indexOf('/* ── 번역 보기'));
    assert.doesNotMatch(block.replace(/var\(--SmartThemeBodyColor\)/g, ''), /#[0-9a-f]{3,8}\b|rgba?\(|gradient|letter-spacing/i, 'palette variables only, no new colors, no letter-spacing');
    assert.match(await read('.github/workflows/release-check.yml'), /node tools\/tests\/direction-translate\.mjs \./, 'registered in CI');
});

console.warn = realWarn;
console.log(`direction-translate: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
