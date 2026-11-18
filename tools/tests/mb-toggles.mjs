// 1.7.3 미트볼 맞춤 스위치 — 블루레몬이 미트볼 상태창에 손대는 것 하나하나를 켜고 끄는 스위치(src/mb-switch.js 표 · html 표식 data-bl-mb-off)
//   ① 표(열쇠 · 갈래 · 해요체 한 줄) ② 설정(기본 전부 켬 · 옛 키 그대로 · 전부 끄기 / 켜기 · 고르는 칸 되돌리기) ③ 맞춤 시트 묶음 문(모든 규칙 · 특이도 그대로 · 전부 끄면 0 규칙)
//   ④ 스위치마다 꺼짐 → 그 일을 안 함(가짜 문서 · 가짜 문맥) ⑤ 설정 찾기 · 설정 창 바로가기
//   node tools/tests/mb-toggles.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const load = file => import(pathToFileURL(path.join(root, file)).href);
const require = createRequire(import.meta.url);
// KEEP_GOING=1: 실패해도 끝까지(고치기 전 판에 돌려 어느 스위치가 없는지 한 번에 볼 때)
let n = 0, bad = 0; const ok = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (error) { if (!process.env.KEEP_GOING) throw error; bad++; console.log('not ok', name, '—', String(error?.message || error).split(String.fromCharCode(10))[0].slice(0, 140)); } };

const SW = await load('src/mb-switch.js');
const ALL = SW.MB_KEYS;

// ── 가짜 문서: html 표식만 읽고 바꾸는 작은 꼴 ─────────────────────────────
function fakeDoc({ off = '', salty = true, raw = false } = {}) {
    const listeners = {};
    const attrs = off ? { 'data-bl-mb-off': off } : {};
    const bodyAttrs = raw ? { 'data-bl-ext-raw': '' } : {};
    return {
        listeners,
        documentElement: { getAttribute: k => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: k => { delete attrs[k]; } },
        body: { classList: { contains: c => c === 'salty' && salty }, hasAttribute: k => k in bodyAttrs, getAttribute: k => bodyAttrs[k] ?? null },
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        dispatchEvent(e) { for (const fn of listeners[e.type] || []) fn(e); return true; },
        setOff(v) { if (v) attrs['data-bl-mb-off'] = v; else delete attrs['data-bl-mb-off']; },
    };
}

// ── ① 표 ─────────────────────────────
await ok('표: 열쇠는 하나씩 · 갈래는 화면 / 데이터 · 이름 · 해요체 한 줄 · 파일', () => {
    assert.equal(new Set(ALL).size, ALL.length, '같은 열쇠 둘');
    for (const sw of SW.MB_SWITCHES) {
        assert.match(sw.key, /^[a-z]{2,12}$/, sw.key);
        assert.ok(['screen', 'data'].includes(sw.kind), sw.key);
        assert.ok(SW.MB_GROUPS.some(([id]) => id === sw.group), `${sw.key} 묶음`);
        assert.ok(sw.name && !/버튼|입력칸/.test(sw.name + sw.desc), `${sw.key} 낱말(단추 · 입력창)`);
        assert.match(sw.desc.replace(/\([^()]*\)$/, ''), /요$/, `${sw.key} 설명은 해요체로 끝나요(끝 괄호 덧말은 빼고)`);
        assert.ok(!/[^ ]·|·[^ ]/.test(sw.name + sw.desc), `${sw.key} 가운뎃점 앞뒤 띄움`);
        assert.ok(!/」 (로|으로|을|를|은|는|이|가|와|과|에서|일 때)[ ,.]/.test(sw.name + sw.desc), `${sw.key} 낫표 뒤 조사는 붙여요`);
        assert.ok(sw.file, sw.key);
    }
    assert.ok(SW.MB_SWITCHES.filter(sw => sw.kind === 'screen').length >= 30 && SW.MB_SWITCHES.filter(sw => sw.kind === 'data').length >= 12);
    // 이미 있던 스위치는 키를 바꾸지 않았어요
    for (const [key, setting] of [['back', 'chat.mbBack'], ['floors', 'chat.mbMapFloors'], ['autoen', 'chat.mbAutoEn'], ['hidden', 'chat.mbHiddenSync'], ['helpers', 'chat.mbHelpers'], ['album', 'chat.mbAlbumBtn'], ['face', 'chat.mbFace'], ['prompt', 'chat.mbPrompt']]) assert.equal(SW.switchOf(key)?.setting, setting, key);
});

// ── ② 설정 ─────────────────────────────
await ok('설정: 옛 설정(키 없음)은 전부 켬 · 표식 없음 — 업데이트해도 화면이 안 바뀌어요', () => {
    const s = { chat: {} };
    for (const sw of SW.MB_SWITCHES) if (!sw.choice) assert.equal(SW.switchOn(s, sw.key), true, sw.key);
    assert.equal(SW.offAttrValue(s), '');
    assert.equal(SW.offAttrValue({ chat: { mbBack: true, mbMapFloors: true, mbAutoEn: true, mbHiddenSync: true, mbHelpers: true, mbAlbumBtn: false, mbOff: [] } }), '');
});
await ok('설정: 옛 키로 끈 것도 표식에 — 추억 앨범 단추는 「보이기」(mbAlbumBtn = true)가 끈 것', () => {
    const v = SW.offAttrValue({ chat: { mbBack: false, mbAlbumBtn: true, mbMapFloors: false, mbOff: ['arrow', 'trfill'] } });
    assert.deepEqual(v.split(' ').sort(), ['album', 'arrow', 'back', 'floors', 'trfill']);
});
await ok('설정: 하나 끄기 · 켜기 — 새 열쇠는 mbOff 배열, 옛 키는 그 값', () => {
    const chat = {};
    SW.setSwitch(chat, 'arrow', false); assert.deepEqual(chat.mbOff, ['arrow']);
    SW.setSwitch(chat, 'arrow', true); assert.deepEqual(chat.mbOff, []);
    SW.setSwitch(chat, 'back', false); assert.equal(chat.mbBack, false);
    SW.setSwitch(chat, 'album', false); assert.equal(chat.mbAlbumBtn, true, '숨기기를 끄면 단추가 보여요');
    SW.setSwitch(chat, 'album', true); assert.equal(chat.mbAlbumBtn, false);
});
await ok('설정: 전부 끄기 → 원작 그대로 · 전부 켜기 → 끄기 전 고른 값으로(미트볼 문구 · 얼굴 표시)', () => {
    const chat = { mbPrompt: 'recent', mbFace: 'initial', mbBack: true };
    SW.setAll(chat, false);
    assert.equal(chat.mbPrompt, 'off'); assert.equal(chat.mbFace, 'icon'); assert.equal(chat.mbBack, false); assert.equal(chat.mbAlbumBtn, true);
    assert.equal(SW.offAttrValue({ chat }).split(' ').length, ALL.filter(k => !SW.switchOf(k).choice).length, '고르는 칸 빼고 전부 표식');
    SW.setAll(chat, true);
    assert.equal(chat.mbPrompt, 'recent'); assert.equal(chat.mbFace, 'initial'); assert.equal(SW.offAttrValue({ chat }), '');
    // 미트볼 문구를 고른 적이 없으면 「켜기」로 토큰이 드는 단계를 저절로 고르지 않아요
    const fresh = { mbPrompt: 'off', mbFace: 'icon' }; SW.setAll(fresh, false); SW.setAll(fresh, true);
    assert.equal(fresh.mbPrompt, 'off'); assert.equal(fresh.mbFace, 'icon');
});
await ok('설정: 화면만 / 데이터만 끄기는 그 갈래만', () => {
    const chat = {}; SW.setAll(chat, false, 'screen');
    for (const sw of SW.MB_SWITCHES) if (!sw.choice) assert.equal(SW.switchOn({ chat }, sw.key), sw.kind !== 'screen', sw.key);
    const d = {}; SW.setAll(d, false, 'data');
    for (const sw of SW.MB_SWITCHES) if (!sw.choice) assert.equal(SW.switchOn({ chat: d }, sw.key), sw.kind !== 'data', sw.key);
});
await ok('설정: src/settings.js 가 mbOff · mbAllWas 를 다듬고 「처음으로」 · 스타일에도 남겨요', async () => {
    const src = read('src/settings.js');
    assert.match(src, /s\.chat\.mbOff = Array\.isArray\(s\.chat\.mbOff\)/);
    assert.match(src, /'mbMapFloors', 'mbOff', 'mbAllWas',/);
    assert.match(read('src/styles.js'), /'mbMapFloors', 'mbOff', 'mbAllWas',/);
});
await ok('설정: html 표식 맞추기 — 바뀔 때만 쓰고 문서 사건 한 번(끈 열쇠 · 앞 열쇠)', () => {
    const doc = fakeDoc(); const seen = [];
    doc.defaultView = { CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } } };
    SW.onMbOff(doc, ['arrow', 'dot'], (k, off) => seen.push(`${k}:${off}`));
    assert.equal(SW.syncOffAttr('arrow', doc), true);
    assert.equal(SW.syncOffAttr('arrow', doc), false, '같으면 안 씀');
    assert.equal(SW.mbOff('arrow', doc), true); assert.equal(SW.mbOff('ar', doc), false, '열쇠 낱말 단위');
    SW.syncOffAttr('', doc);
    assert.equal(doc.documentElement.getAttribute('data-bl-mb-off'), null, '다 켜면 표식 없음');
    assert.deepEqual(seen, ['arrow:true', 'arrow:false']);
});

// ── ③ 맞춤 시트 묶음 문 ─────────────────────────────
const L = require(path.join(root, 'tools/css-lib.cjs'));
const gateSrc = read('src/ext-status.css').replace(/\r\n/g, '\n');
const gen = fs.existsSync(path.join(root, 'src/ext-status.gen.css')) ? read('src/ext-status.gen.css') : '';   // 없으면 시트 시험이 하나씩 실패해요
await ok('시트: 원본의 묶음 표식은 표에 있는 열쇠만 · 화면 묶음 열쇠(css)는 시트에 한 번 이상', () => {
    const keys = new Set([...gateSrc.matchAll(/\/\*\s*@mb\s+([a-z|]+)\s*\*\//g)].flatMap(m => m[1].split('|')));
    for (const k of keys) assert.ok(ALL.includes(k), `모르는 열쇠 ${k}`);
    for (const sw of SW.MB_SWITCHES) if (sw.css && sw.key !== 'note' && !['read'].includes(sw.key)) assert.ok(keys.has(sw.key), `${sw.key} 묶음이 시트에 없어요`);
    assert.ok(keys.has('read'));
});
await ok('시트: 사본(src/ext-status.gen.css)이 원본과 맞아요 · 맞춤 모듈이 사본을 붙여요', () => {
    const built = require(path.join(root, 'tools/build-css.cjs')).mbStatusText();
    assert.deepEqual(built.problems, []);
    assert.equal(built.text, gen, 'node tools/build-css.cjs 로 다시 만들 것');
    assert.match(read('src/ext-compat.js'), /root: '#ss-settings', css: '\.\/ext-status\.gen\.css'/);
});
const GATE = /^:where\(:root:not\(((?:\[data-bl-mb-off~="[a-z]+"\])+)\)\)(?: > | )|^(?:html|:root)[^\s>+~]*?:where\(:not\(((?:\[data-bl-mb-off~="[a-z]+"\])+)\)\)/;
const gatesOf = sel => L.topSplit(sel).map(part => { const m = GATE.exec(part.trim()); return m ? [...(m[1] || m[2]).matchAll(/~="([a-z]+)"/g)].map(x => x[1]) : null; });
await ok('시트: 모든 규칙 · 모든 선택자에 문 · 특이도는 원본과 같아요(:where = 0)', () => {
    const problems = [];
    const genRules = L.flatRules(L.parse(gen, problems));
    const srcRules = L.flatRules(L.parse(gateSrc, problems));
    assert.deepEqual(problems, []);
    assert.equal(genRules.length, srcRules.length, '규칙 수');
    genRules.forEach((r, i) => {
        const gates = gatesOf(r.selector);
        assert.ok(gates.every(g => g && g.length), `문 없는 선택자: ${r.selector.slice(0, 120)}`);
        const a = L.topSplit(r.selector), b = L.topSplit(srcRules[i].selector);
        assert.equal(a.length, b.length);
        a.forEach((sel, k) => assert.deepEqual(L.spec(sel), L.spec(b[k]), `특이도 ${b[k].slice(0, 80)}`));
    });
    assert.ok(genRules.length >= 600, `규칙 ${genRules.length}`);
});
await ok('시트: 전부 끄면(표식에 모든 열쇠) 걸리는 규칙 0 — 문이 html 하나에 걸려서', () => {
    const off = new Set(ALL);
    const live = [];
    for (const r of L.flatRules(L.parse(gen))) for (const g of gatesOf(r.selector)) if (!g.every(k => off.has(k))) live.push(r.selector);
    assert.deepEqual(live, []);
    // 문은 html(:root) 자신이나 그 바로 아래 body 에 걸린 꼴뿐 — 다른 조상에 걸린 문은 없어요
    assert.ok(!/[^\s(,]:where\(:root/.test(gen.replace(/^:where\(:root/gm, '')), 'html 아닌 자리의 :root 문');
    // 끈 묶음 하나만: 그 묶음 규칙만 꺼지고 나머지는 그대로
    const one = new Set(['arrow']); let offRules = 0, onRules = 0;
    for (const r of L.flatRules(L.parse(gen))) { const g = gatesOf(r.selector)[0]; if (g.every(k => one.has(k))) offRules++; else onRules++; }
    assert.ok(offRules === 2 && onRules > 600, `${offRules} / ${onRules}`);
});
await ok('시트: 작가 노트 넣기 시트도 문 — 신호는 「작가 노트」 · 「채팅 읽기」 둘 다 끈 때만', () => {
    const css = read('src/mb-note.css');
    const rules = L.flatRules(L.parse(css));
    for (const r of rules) assert.ok(gatesOf(r.selector).every(Boolean), r.selector);
    assert.ok(rules.some(r => /\[data-bl-mb-off~="note"\]\[data-bl-mb-off~="read"\]/.test(r.selector) && /ss-instruct/.test(r.selector)));
});
await ok('시트: 선 아이콘 글꼴 이름은 변수 하나 — 「그림 글자를 선 아이콘으로」 를 끄면 없는 이름(bl-mb-none)', () => {
    assert.match(gen, /^:where\(:root:not\(\[data-bl-mb-off~="icons"\]\)\) > body\.salty :is\(#ss-settings, [^)]*dialog\.ss-dlg[^)]*\) \{ --bl-mb-ico: 'bl-mb-icons'; \}/m);
    // 섞인 글꼴 줄(글꼴 묶음)은 변수로 — 선 아이콘 묶음 · 얼굴 고르개 창(그림을 고르는 칸)의 규칙만 글꼴 이름 그대로(@font-face 이름 줄은 빼요)
    for (const l of gen.split('\n').filter(l => /font-family: 'bl-mb-icons'/.test(l) && !/^font-family/.test(l))) assert.ok(/^:where\(:root:not\(\[data-bl-mb-off~="(icons|avapick)"\]\)\)/.test(l), `아이콘 · 고르개 묶음 밖의 글꼴 이름: ${l.slice(0, 120)}`);
});
await ok('시트: 빨간 점 숨김 시트(자바스크립트가 만드는 것)에도 문', async () => {
    const { dotCss } = await load('src/ext-compat.js');
    assert.match(dotCss(['loc']), /^:where\(:root:not\(\[data-bl-mb-off~="dot"\]\)\) > body\.salty/);
});

// ── ④ 스위치마다 꺼짐 → 그 일을 안 함 ─────────────────────────────
await ok('화살표: 끄면 「->」 를 안 감싸요(켜면 감싸요)', async () => {
    const { wrapArrows } = await load('src/mb-arrow.js');
    const make = off => {
        const doc = fakeDoc({ off }); let made = 0;
        doc.createElement = tag => { made++; return { tagName: tag.toUpperCase(), nodeType: 1, childNodes: [], appendChild(c) { this.childNodes.push(c); }, set textContent(v) { this._t = v; } }; };
        doc.createTextNode = v => ({ nodeType: 3, nodeValue: v });
        const text = { nodeType: 3, nodeValue: '저녁 -> 밤' };
        const el = { nodeType: 1, tagName: 'SPAN', ownerDocument: doc, hasAttribute: () => false, closest: () => null, firstChild: text, replaceChild() {} };
        text.nextSibling = null; text.parentNode = el; text.parentElement = el;
        return { el, count: () => made };
    };
    const a = make('arrow'); assert.equal(wrapArrows(a.el), 0); assert.equal(a.count(), 0);
    const b = make('dot'); assert.equal(wrapArrows(b.el), 1, '다른 열쇠를 꺼도 화살표는 그대로');
});
await ok('지우기 확인: 끄면 확인 창 대상이 아니에요(원작처럼 바로)', async () => {
    const { askTarget, ASK } = await load('src/mb-ask.js');
    const target = doc => { const el = { closest: () => el, matches: sel => sel === ASK[0][0], ownerDocument: doc }; return el; };
    const on = fakeDoc(); assert.ok(askTarget(target(on), on));
    const off = fakeDoc({ off: 'ask' }); assert.equal(askTarget(target(off), off), null);
});
await ok('빨간 점: 끄면 눌러도 「봤음」 으로 안 적어요', async () => {
    const { seeDot, clearDots } = await load('src/ext-compat.js');
    const tile = { classList: { contains: () => false }, getAttribute: () => 'loc', querySelector: () => ({}) };
    const target = { closest: () => tile };
    const off = fakeDoc({ off: 'dot' }); assert.equal(seeDot(off, target), '');
    const on = fakeDoc(); on.getElementById = () => ({ textContent: '' }); assert.equal(seeDot(on, target), 'loc'); clearDots(on);
});
await ok('탭 나누기: 끄면 설정 칸을 새로 나누지 않아요(정리한 보기도)', async () => {
    const { buildAll } = await load('src/ext-compat.js');
    const run = off => {
        const doc = fakeDoc({ off }); let touched = 0;
        const rootEl = { id: 'ss-settings', dataset: {}, querySelector: () => { touched++; return null; }, querySelectorAll: () => { touched++; return []; } };
        doc.querySelector = sel => (sel === '#ss-settings' ? rootEl : null);
        doc.getElementById = () => ({});   // 시트는 이미 붙어 있어요
        buildAll(doc);
        return touched;
    };
    assert.equal(run('tabs'), 1, '레몬 칸 자리(내용 칸)만 한 번 봐요 — 1.7.4 맞춤을 다 꺼도 레몬 탭은 남아요(tools/tests/mb-lemon-tab.mjs)');
    assert.ok(run('') > 0, '켜면 칸을 봐요');
});
await ok('얼굴 즉시 칠하기의 표식: 종 배지 · 이름표 두 열 · 꾸미기 묶음은 끈 것만 안 달아요', async () => {
    const { startFaceNow, BAND, LIST, HEAD } = await load('src/mb-face-now.js');
    const doc = fakeDoc(); let cb = null; const hit = { badge: 0, long: 0, deco: 0 };
    startFaceNow(doc, { watch: (_t, _o, fn) => { cb = fn; }, marks: { badge: () => hit.badge++, long: () => hit.long++, deco: () => hit.deco++ }, paint: () => {} });
    const tw = {}; const node = { nodeType: 1, closest: sel => (sel === BAND ? {} : null), matches: sel => sel === LIST || sel === HEAD, parentElement: tw, firstElementChild: null };
    const recs = [{ addedNodes: [node] }];
    doc.setOff('badge grid deco'); cb(recs); assert.deepEqual(hit, { badge: 0, long: 0, deco: 0 });
    doc.setOff('badge'); cb(recs); assert.deepEqual(hit, { badge: 0, long: 1, deco: 1 });
    doc.setOff(''); cb(recs); assert.deepEqual(hit, { badge: 1, long: 2, deco: 2 });
});
await ok('작가 노트 넣기: 끄면 지시칸이 그려져도 단추를 안 놓아요', async () => {
    const { startMbNote, ANIM } = await load('src/mb-note.js');
    const doc = fakeDoc({ off: 'note' }); doc.getElementById = () => ({});
    let touched = 0; const el = { classList: { contains: () => { touched++; return false; } }, tagName: 'DIV' };
    startMbNote(doc);
    const fire = () => { for (const fn of doc.listeners.animationstart || []) fn({ animationName: ANIM, target: el }); };
    fire(); assert.equal(touched, 0);
    doc.setOff(''); fire(); assert.ok(touched > 0, '켜면 자리를 찾아요');
});
await ok('만들기 화면 채팅 읽기: 끄면 고르기 줄을 안 놓아요(정리는 제 스위치를 따라 그대로 불러요)', async () => {
    const { startMbRead, ANIM } = await load('src/mb-read.js');
    const doc = fakeDoc({ off: 'read' });
    const made = []; doc.createElement = tag => { const o = { tag, children: [], classList: { add() {} }, setAttribute() {}, append(...k) { this.children.push(...k); } }; made.push(o); return o; };
    const head = { querySelector: () => null, append() {}, insertBefore() {} };
    const sec = { querySelector: sel => (sel === '.ss-sec-h' ? head : null), insertBefore() {} };
    const wiz = { querySelector: () => null, closest: () => null };
    const el = { tagName: 'TEXTAREA', classList: { contains: c => c === 'ss-w-ins' }, closest: sel => (sel === '.ss-sec' ? sec : sel === '.ss-wizard' ? wiz : null) };
    let rows = 0, cleaned = 0; const P = { cleanupDupes: async () => { cleaned++; return []; }, onFill() {}, onceLevel: () => { rows++; return ''; } };
    startMbRead(doc, { watch: () => {}, settings: async () => ({ chat: {} }), load: async () => P, ctx: () => null });
    const fire = async () => { for (const fn of doc.listeners.animationstart || []) fn({ animationName: ANIM, target: el }); await new Promise(r => setTimeout(r, 10)); };
    await fire(); assert.equal(rows, 0); assert.equal(cleaned, 1);
    doc.setOff(''); await fire(); assert.equal(rows, 1, '켜면 줄을 놓아요');
});
await ok('미트볼 문구: 줄 꼴 규칙 · 변화 장부는 끄면 안 붙여요', async () => {
    const P = await load('src/mb-prompt.js');
    assert.equal(P.rulesOn('light', fakeDoc()), true);
    assert.equal(P.rulesOn('light', fakeDoc({ off: 'rules' })), false);
    assert.equal(P.rulesOn('off', fakeDoc()), false);
    const c = { chat: [{ mes: 'x', extra: { statussim: { bySwipe: [[['aff', 'Mina +5']]] } } }], chatMetadata: {} };
    const was = globalThis.document; globalThis.document = fakeDoc({ off: 'ledger' });
    try { assert.equal(P.withLedger(c, 'BODY'), 'BODY'); globalThis.document = fakeDoc(); assert.notEqual(P.withLedger(c, 'BODY'), 'BODY', '켜면 장부를 앞에 실어요'); }
    finally { globalThis.document = was; }
});
await ok('만든 뒤 바로잡기: 관계 숫자 · 시간대(relfix) · 빈 프로필 채우기(fill)를 따로 끄면 그것만 안 고쳐요', async () => {
    const P = await load('src/mb-prompt.js');
    const make = () => ({ chat: [{ mes: 'x', extra: { statussim: { bySwipe: [[['aff', 'Mina +40'], ['period', 'Evening -> Night']]] } } }],
        chatMetadata: { statussim: { base: { data: { rel: { user: [{ name: 'Mina', aff: 0, trust: 0, label: 'friend' }] }, calendar: { time: '아침', times: ['아침', '낮', '저녁', '밤'] }, profile: { list: [] } } } } } });
    const all = P.reconcileRel(make());
    assert.equal(all.changed.length, 1); assert.ok(all.time); assert.equal(all.added.length, 1);
    const noRel = P.reconcileRel(make(), { rel: false });
    assert.equal(noRel.changed.length, 0); assert.equal(noRel.time, null); assert.equal(noRel.added.length, 1);
    const c = make(); const noFill = P.reconcileRel(c, { fill: false });
    assert.equal(noFill.added.length, 0); assert.equal(c.chatMetadata.statussim.base.data.profile.list.length, 0, '프로필 자료 그대로');
});
await ok('중복 정리 · 합치기: 둘 다 끄면 채팅을 열어도 자료를 안 건드려요', async () => {
    const P = await load('src/mb-prompt.js');
    const c = { chatMetadata: { statussim: { base: { data: { profile: { list: [{ name: 'A', role: 'npc', blFill: 1 }, { name: 'B', aliases: ['A'], role: 'main' }] }, rel: { user: [] } } } } }, saveMetadata: () => { throw new Error('저장하면 안 돼요'); } };
    const doc = fakeDoc({ off: 'dedupe merge' });
    assert.deepEqual(await P.cleanupDupes({ c, doc, force: true, core: null, engine: null }), []);
    assert.equal(c.chatMetadata.statussim.base.data.profile.list.length, 2, '같은 사람 프로필(블루레몬이 더한 것)도 그대로');
});
await ok('기능 다리: 용어집 · 모델 고르기를 끄면 골라 둔 값은 그대로 두고 걸지 않아요', async () => {
    const { createBridge } = await load('src/ext-bridge.js');
    const Core = await load('src/ext-bridge-core.js');
    const ctx = { extensionSettings: { [Core.BRIDGE_KEY]: { [Core.TARGET.id]: { glossary: false, glossaryMain: false, models: { base: { provider: 'openai', model: 'gpt-x' } } } } }, getExtensionManifest: () => null };
    const holder = { getContext: () => ctx };
    let off = new Set();
    const bridge = createBridge({ host: () => holder, theme: () => ({ enabled: true, usageMode: 'both' }), asyncFrames: () => true, gate: k => off.has(k) });
    assert.equal(bridge.sync(), true, '켜면 고른 모델로 걸어요');
    off = new Set(['model']);
    assert.equal(bridge.sync(), false, '끄면 걷어요');
    assert.equal(Core.pickFor(bridge.config(), 'base')?.model, 'gpt-x', '골라 둔 값(화면 · 저장)은 그대로');
});
await ok('화면만 번역 빈틈: 칩 다시 적기 · 사전 고정 낱말 · 남은 영어 메우기를 따로 꺼요', async () => {
    const { createTrFill } = await load('src/ext-bridge-tr.js');
    let meta = 0, slots = 0;
    const mb = { tr: { trString: t => t, addPairs: () => 0, translateView() {}, trJSON: async x => x, missingTr: () => [] }, core: { viewTr: () => true, getMeta: () => { meta++; return { tr: {} }; }, app: { current: { state: { data: {} }, snaps: new Map() } }, settings: () => ({}) }, busy: () => false };
    const doc = fakeDoc({ off: 'trchip trtidy trfill' });
    const fill = createTrFill(mb, { doc, toast: null, timers: { setTimeout() { return 0; }, clearTimeout() {} }, chatId: () => 'c', chat: () => [] });
    const mes = { getAttribute: () => '0', querySelectorAll: () => { slots++; return []; } };
    fill.paint([mes]); assert.equal(slots, 0);
    assert.equal(fill.tidy(), 0); assert.equal(await fill.fill(), 0); assert.equal(meta, 0, '사전을 안 읽고 안 고쳐요');
    doc.setOff(''); fill.paint([mes]); assert.equal(slots, 1, '켜면 칩 자리를 봐요');
    fill.tidy(); assert.ok(meta > 0, '켜면 사전을 봐요');
});
await ok('변화 그래프 · 지도 층별 · 뒤로 가기 · 영어 저장 · 눈 감긴 답: 제 표식(옛 키)과 같은 문', () => {
    assert.match(read('src/mb-trend.js'), /const fitted = doc => [^\n]*!mbOff\('trend', doc\)/);
    assert.match(read('src/mb-map-floors.js'), /getAttribute\?\.\(FLOOR_ATTR\) === 'on'/);
    assert.match(read('src/mb-back.js'), /getAttribute\?\.\(ATTR\) !== 'off'/);
    assert.match(read('src/mb-auto-en.js'), /'data-bl-mb-auto-en'\) === 'on'/);
    assert.match(read('src/apply.js'), /syncOffAttr\(offAttrValue\(s\), document, restyleAhead\);\n[^\n]*\n    \{ const on = want\.has\('salty'\) && s\.chat\.mbHiddenSync/);
    // 표식은 미트볼 문구 동기(줄 꼴 규칙)보다 먼저
    const apply = read('src/apply.js'); assert.ok(apply.indexOf('syncOffAttr(offAttrValue(s)') < apply.indexOf("lateSync('mbPrompt'"));
});

// ── ⑤ 설정 찾기 · 바로가기 ─────────────────────────────
await ok('설정 찾기: 새 스위치마다 한 줄 · 묶음 머리 · 원작 그대로 보기', async () => {
    const { SEARCH_ENTRIES } = await load('src/settings-search.js');
    const titles = new Set(SEARCH_ENTRIES.map(e => e.title));
    for (const sw of SW.MB_SWITCHES) if (!sw.setting) assert.ok(titles.has(`미트볼 맞춤: ${sw.name}`) && SEARCH_ENTRIES.some(e => e.anchor === sw.name), sw.name);   // 제목은 머리말 · 가는 자리(anchor)는 설정 창 줄 이름
    assert.ok(titles.has('미트볼 맞춤') && titles.has('원작 그대로 보기 (이 기기)'));
});
await ok('「미트볼 맞춤」 묶음(전부 · 화면만 · 데이터) — 1.7.4 부터 미트볼 설정 칸의 「블루레몬」 탭이 그려요(tools/tests/mb-lemon-tab.mjs)', () => {
    const panel = read('src/panel.js');
    for (const act of ['mb-fit', 'mb-fit-all', 'mb-fit-raw']) assert.ok(panel.includes(`case '${act}':`), act);
    assert.match(panel, /export function mountMbFit\(container\)/);
    assert.match(panel, /root\.innerHTML = mbFitGroups\(getSettings\(\)\);/);
    assert.match(read('src/mb-lemon.js'), /panel\.mountMbFit\(body\)/);
});

// ── ⑥ 「변경한 설정」 목록(1.7.6): 끈 목록(chat.mbOff)으로 저장하는 스위치도 한 줄씩 ─────────────────────────────
await ok('변경한 설정: 끈 스위치마다 한 줄(가짜 경로 chat.mbOff.<열쇠>) · 「기본값」으로 다시 켜요 · 제 설정 키가 있는 스위치 · 모르는 열쇠는 안 나와요', async () => {
    const D = await load('src/settings-differences.js');
    const { DEFAULTS } = await load('src/settings.js');
    const base = D.changedSettings(structuredClone(DEFAULTS)).length;
    const s = structuredClone(DEFAULTS); s.chat.mbOff = ['locgo', 'arrow', 'nope', 'back'];
    const rows = D.changedSettings(s).filter(x => x.path.startsWith('chat.mbOff'));
    assert.deepEqual(rows, [{ path: 'chat.mbOff.locgo', before: true, value: false }, { path: 'chat.mbOff.arrow', before: true, value: false }]);
    assert.equal(D.changedSettings(s).length, base + 2, '다른 줄은 그대로');
    assert.equal(D.mbOffKey('chat.mbOff.locgo'), 'locgo'); assert.equal(D.mbOffKey('chat.mbOff.back'), '', '제 설정 키(chat.mbBack)가 있는 스위치는 그 키로 나와요'); assert.equal(D.mbOffKey('chat.mbOff.face'), '', '고르는 칸은 빼요'); assert.equal(D.mbOffKey('chat.mbOff'), '');
    assert.equal(D.settingChanged(s, 'chat.mbOff.locgo'), true); assert.equal(D.settingChanged(s, 'chat.mbOff.icons'), false);
    assert.deepEqual(D.settingDefault(s, 'chat.mbOff.locgo'), { allowed: true, value: true });
    assert.equal(D.resetSetting(s, 'chat.mbOff.locgo'), true);
    assert.deepEqual(s.chat.mbOff, ['arrow', 'nope', 'back'], '되돌리면 그 열쇠만 끈 목록에서 빠져요');
    assert.equal(SW.switchOn(s, 'locgo'), true);
    const lemon = await load('src/mb-lemon.js');
    assert.equal(lemon.isLemonPath('chat.mbOff.locgo'), true, '「설정으로」는 레몬 탭으로 데려가요');
    const panel = read('src/panel.js');
    assert.match(panel, /if \(mbOffKey\(path\)\) return `미트볼 맞춤 · \$\{MB_SWITCHES\.find\(sw => sw\.key === mbOffKey\(path\)\)\?\.name \|\| path\}`;/, '목록 이름은 한국어 스위치 이름');
    assert.match(panel, /goMbLemon\(root, mbOffKey\(path\) \? `@mb:\$\{mbOffKey\(path\)\}` : path\)/, '그 스위치 줄을 표시해요');
});

console.log(`mb-toggles: ${n}개 통과${bad ? ` · ${bad}개 실패` : ''}`);
if (bad) process.exitCode = 1;
