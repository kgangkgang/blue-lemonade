// 1.8.2 미트볼 2.10 「속마음」 번역 — 기능 다리(src/ext-bridge.js)가 그 확장을 찾은 뒤 한 번 켜요. 그 확장 판에 말풍선(app.mindPop)이 없으면(2.9.x 까지) 아무것도 안 해요.
//   11-19 사용자(폰 사진): 「속마음 나오자마자 원어 보이고 바로 사라지는데 번역본으로 다시 나오게 해 줘 아니면 좀 기다렸다가 번역본으로 처음부터 나오던지」 ·
//   「속마음은 번역 버튼 눌러도 번역 안 됨」. 그 확장은 속마음 · 관전자 한마디를 이야기 언어(일본어 등) 그대로 받아 말풍선으로 띄우고, 그 확장 화면 번역(사전 · 영어 글만)은
//   영어가 아닌 글을 코드 값으로 보고 건너뛰어 번역 단추를 눌러도 그대로였어요.
//   ① 말풍선: 그 확장이 화면을 그릴 때마다 부르는 app.mindPop 을 감싸요. 새 속마음이 내 언어가 아니고 번역이 아직 없으면 그 한마디만 잠깐 「이번 턴 것이 아닌 것」으로 보이게 해
//      그 확장이 띄우지 않게 하고(그 확장 자료는 부르는 동안만 바꾸고 곧바로 되돌려요), 그 확장 번역 길(trText — 번역 담당 · 번역 모델 · 지침 그대로)로 옮겨요.
//      번역이 오면 번역본을 같은 자리에 넣어 그 확장에게 다시 그리라고 해요 → 그 확장이 번역본으로 처음부터 띄우고, 사라지는 시간도 그때부터 세요(그 확장 셈 그대로).
//      6초(WAIT_MS) 안에 안 오면 원문으로 띄우고, 번역이 나중에 오면 그 말풍선을 같은 꼴 번역본으로 바꿔 끼우고 사라지는 시간을 그때부터 다시 세요.
//      번역이 이미 있으면(같은 글 · 이 기기 모음) 기다리지 않고 바로 번역본이에요. 채팅을 막 열었을 때 있던 것은 그 확장처럼 띄우지 않아요(그때는 원문 열쇠 그대로).
//   ② 속마음 탭 · 띠 칸 · 관전석 · 지난 속마음 글: 신호 시트(src/mb-mind-tr.css)의 0.001초 신호(animationstart — 감시자 · 타이머 없음)로 그려질 때 번역본을 적어요(원문은 title 「원문: …」).
//      그 확장 「상태창 전체 번역」 · 「남은 글 번역하기」 단추를 누르면 지금 상태의 속마음 · 지난 속마음 · 관전석 글 가운데 번역이 없는 것을 같은 길로 한 번에 옮겨요.
//   번역 모음(캐시): 이 기기 localStorage 한 칸(언어별 최근 400개) — 말풍선 · 탭이 같이 써서 같은 글은 한 번만 번역해요. 그 확장 사전(채팅 메타 tr)은 영어 열쇠만 받아 쓰지 않아요.
//   언제: 자동(말풍선 · 탭)은 그 확장이 「영어로 저장」 계열(번역을 쓰는 설정)이고 그 확장 「새 글 자동 번역」이 지금 번역 담당에 켜진 때만(ext-bridge-tr.js 와 같은 규칙) ·
//         번역 단추를 누르면 늘 · 글이 이미 내 언어(번역 언어)면 아무것도 안 해요 · 스위치 「속마음 번역해서 띄우기」(mindtr)를 끄면 원작 그대로(바꿔 적은 글도 원문으로 되돌려요).
//   원작 파일 · 함수는 고치지 않아요 — 그 확장이 내보낸 함수(app.mindPop · trText · numOf)를 같은 주소로 불러요. 원작 코드 · 글은 옮기지 않았어요.
//   시험: tools/tests/mb-mind-tr.mjs
import { mbOff, onMbOff } from './mb-switch-core.js';
import { holdSheet } from './boot-gate.js';

export const KEY = 'mindtr';
export const SHEET_ID = 'bl-mb-mind-tr-css';
export const WAIT_MS = 6000;
export const ANIM = 'bl-mb-mind-seen';
export const STORE = 'bl-mb-mind-tr-v1';
export const STORE_MAX = 400;
export const SRC_ATTR = 'data-bl-mind-src';
// 1.8.2(2.10 새 기능 맞춤): 관전석 이름(.ss-wt-feed … > b — 주변인 · 실시간 채팅은 AI 가 이야기 언어로 이름을 지어요) · HUD · 미니바 「속마음」 칸 글(.t-mind .m)도
export const SEL = '.ss-scope :is(.ss-mindc .ss-mind.big, .ss-mind-log li > span, .ss-wt-feed li > div > p, .ss-wt-feed li > div > b, .ss-mind-bub > em, .ss-t.t-mind .p > .m)';
const TRIGGER = '[data-act="trsheet"], [data-s-act="trsheet"], .ss-trf-go';   // 그 확장 번역 단추(src/ext-bridge-tr.js 와 같은 것)
const BATCH = 20;
const OUT_MS = 450;   // 그 확장 말풍선 나가는 움직임 길이

const HANGUL = /[가-힣]/, KANA = /[぀-ヿ]/, HAN = /[一-鿿]/, LATIN = /[A-Za-z]/;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** 번역 언어(그 확장 설정 trCode → trLang 이름) — 모르면 ko */
export function langOf(set = {}) {
    const code = String(set?.trCode ?? '').trim().toLowerCase();
    if (code) return code.split(/[-_]/)[0];
    const name = String(set?.trLang ?? '');
    if (/english|영어/i.test(name)) return 'en';
    if (/日本|japan|일본/i.test(name)) return 'ja';
    if (/中文|chinese|중국/i.test(name)) return 'zh';
    return 'ko';
}

/** 이 글을 번역 언어로 옮길 일이 있나 — 글자(낱자)가 둘 넘고 번역 언어 글자가 없을 때만(카모지 · 그림 글자만이면 아니에요) */
export function needsTr(text, lang = 'ko') {
    const t = String(text ?? '').trim();
    if (!t || t.length > 2000) return false;
    if ((t.match(/\p{L}/gu) ?? []).length < 2) return false;
    if (lang === 'ko') return !HANGUL.test(t);
    if (lang === 'ja') return !KANA.test(t);
    if (lang === 'zh') return !HAN.test(t) || KANA.test(t);
    if (lang === 'en') return HANGUL.test(t) || KANA.test(t) || HAN.test(t);
    return false;   // 그 밖 언어는 글자로 가릴 수 없어요 — 원작 그대로
}
/** 번역기가 돌려준 글이 번역 언어인가(그대로 돌려준 것 · 실패를 거르려고) */
export function looksDone(out, src, lang = 'ko') {
    const t = String(out ?? '').trim();
    if (!t || t === String(src ?? '').trim()) return false;
    return !needsTr(t, lang);
}

/**
 * 지금 턴의 속마음 · 관전자 한마디(그 확장 말풍선이 고르는 것과 같은 범위) → [{ who, text, obj, key, covered }]
 *   key 는 그 확장이 띄운 것을 기억하는 열쇠와 같은 꼴(종류 · 턴 · 이름 · 글) — 우리 쪽에서 「새 것」을 가르는 데만 써요.
 */
export function mindItems(state, { modOn = () => true, covered = () => false } = {}) {
    const out = [], turn = state?.turn, seen = new Set();
    const rel = modOn('rel') ? (Array.isArray(state?.data?.rel?.user) ? state.data.rel.user : []) : [];
    const prof = modOn('profile') ? (Array.isArray(state?.data?.profile?.list) ? state.data.profile.list : []) : [];
    for (const r of [...rel.filter(r => r && !r.out), ...prof.filter(p => p && p.role !== 'user' && !rel.some(x => x?.name === p.name))]) {
        if (!r?.name || seen.has(r.name)) continue;
        seen.add(r.name);
        const m = r.mind;
        if (!isObj(m) || !m.text || m.turn !== turn) continue;
        let cov = false; try { cov = !!covered(r); } catch { cov = false; }
        out.push({ who: String(r.name), text: String(m.text), obj: m, key: `m|${turn}|${r.name}|${m.text}`, covered: cov });
    }
    for (const w of Array.isArray(state?.watch) ? state.watch : []) {
        if (!isObj(w) || w.turn !== turn || !w.text) continue;
        out.push({ who: String(w.who ?? ''), text: String(w.text), obj: w, key: `w|${turn}|${w.who}|${w.text}`, covered: false });
    }
    return out;
}
/** 번역 단추를 눌렀을 때 옮길 글 전부: 지금 · 지난 속마음 · 관전석 */
export function allMindTexts(state) {
    const out = new Set();
    const add = t => { if (typeof t === 'string' && t.trim()) out.add(t.trim()); };
    for (const list of [state?.data?.rel?.user, state?.data?.profile?.list]) for (const r of Array.isArray(list) ? list : []) {
        add(r?.mind?.text);
        for (const x of Array.isArray(r?.mindLog) ? r.mindLog : []) add(x?.text);
    }
    for (const w of Array.isArray(state?.watch) ? state.watch : []) { add(w?.text); add(w?.who); }   // 관전자 이름도(내 언어면 needsTr 이 걸러요)
    return [...out];
}

/** 이 기기 번역 모음 — { v:1, <언어>: [[원문, 번역], …] } · 오래된 것부터 빠져요 */
export function createStore(storage = globalThis.localStorage) {
    const maps = new Map();
    let data = {};
    try { const o = JSON.parse(storage?.getItem?.(STORE) || '{}'); if (isObj(o)) data = o; } catch { data = {}; }
    const mapOf = lang => {
        if (!maps.has(lang)) maps.set(lang, new Map(Array.isArray(data[lang]) ? data[lang].filter(p => Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string') : []));
        return maps.get(lang);
    };
    let timer = 0;
    const save = () => {
        try {
            const o = { v: 1 };
            for (const [lang, m] of maps) o[lang] = [...m].slice(-STORE_MAX);
            for (const [k, v] of Object.entries(data)) if (!(k in o)) o[k] = v;
            storage?.setItem?.(STORE, JSON.stringify(o));
        } catch { /* 이 기기에 못 적으면 이번 접속 동안만 */ }
    };
    return {
        get: (lang, src) => mapOf(lang).get(String(src).trim()) ?? null,
        has: (lang, src) => mapOf(lang).has(String(src).trim()),
        put(lang, src, out) {
            const m = mapOf(lang), k = String(src).trim();
            m.delete(k); m.set(k, String(out).trim());
            while (m.size > STORE_MAX) m.delete(m.keys().next().value);
            clearTimeout(timer); timer = setTimeout(save, 300);
        },
        size: lang => mapOf(lang).size,
        flush: save,
    };
}

/**
 * mb = { core(app · settings · getMeta · modOn · mindCovered), tr(trText), cfg(numOf) } — 그 확장이 내보낸 것
 */
export function createMindTr(mb, { doc = globalThis.document, timers = globalThis, storage = globalThis.localStorage, toast = globalThis.toastr, chatId = stChatId, wait = WAIT_MS } = {}) {
    const { core, tr, cfg } = mb;
    const store = createStore(storage);
    const set = () => { try { return core.settings?.() ?? {}; } catch { return {}; } };
    const lang = () => langOf(set());
    const off = () => mbOff(KEY, doc);
    /** 자동 번역: 번역을 쓰는 저장 언어(en · enview) + 그 확장 「새 글 자동 번역」 규칙(끔 · 실리 기본 번역일 때만 · 항상) */
    function autoOn() {
        const s = set();
        if (s.ssGenLang !== 'en' && s.ssGenLang !== 'enview') return false;
        const mode = s.trAuto === true ? 'st' : s.trAuto === false ? 'off' : (s.trAuto || 'st');
        return mode === 'always' || (mode === 'st' && (s.trEngine ?? 'st') === 'st');
    }
    const active = () => !off() && autoOn();
    const modOn = id => { try { return typeof core.modOn === 'function' ? core.modOn(id) : true; } catch { return true; } };
    const covered = r => { try { return typeof core.mindCovered === 'function' ? core.mindCovered(r) : false; } catch { return false; } };

    let orig = null, chat;
    const modes = new Map();   // 열쇠 → { m: 'wait' | 'tr' | 'raw', src, who, ko, late }
    const wake = new Map();    // 열쇠 → 원문으로 띄울 타이머
    const pending = new Set(), inflight = new Set(), failed = new Set();
    let flushTimer = 0;
    const log = [];   // 시험 · 진단: [시각, 일]
    const note = what => { log.push([Date.now(), what]); if (log.length > 200) log.shift(); };

    /** 그 확장 app.mindPop 감싸기(한 번) — 없으면 false(2.9.x) */
    function wrap() {
        const app = core.app, fn = app?.mindPop;
        if (typeof fn !== 'function') return false;
        if (fn.__blMindTr) return true;
        orig = fn;
        const wrapped = function (...args) { return pop(this, args); };
        Object.defineProperty(wrapped, '__blMindTr', { value: true });
        app.mindPop = wrapped;
        return true;
    }
    function pop(self, args) {
        const s = core.app?.current?.state;
        if (!s || !orig) return orig?.apply(self, args);
        const cid = chatId();
        const seed = cid !== chat;
        if (seed) { chat = cid; modes.clear(); for (const t of wake.values()) timers.clearTimeout(t); wake.clear(); }
        let items = [];
        try { items = mindItems(s, { modOn, covered }); } catch { items = []; }
        const L = lang(), on = active();
        for (const it of items) {
            if (modes.has(it.key)) continue;
            const base = { src: it.text, who: it.who };
            // 관전자 이름(주변인 · 실시간 채팅은 AI 가 이야기 언어로 지어요) — 모음에 있으면 처음부터 그 이름, 없으면 글과 같은 묶음으로 부탁해요(이름만으로는 기다리지 않아요)
            const nameTr = !seed && on && !it.covered && it.key.startsWith('w|') && needsTr(it.who, L);
            if (nameTr) { const nm = store.get(L, it.who); if (nm) base.name = nm; else if (!failed.has(it.who)) ask(it.who); }
            // 채팅을 막 열었을 때 있던 것 · 가려진 것 · 내 언어 · 꺼짐: 원문 열쇠 그대로(그 확장 동작 그대로)
            if (seed || it.covered || !on || !needsTr(it.text, L)) { modes.set(it.key, { ...base, m: 'raw' }); continue; }
            const ko = store.get(L, it.text);
            if (ko) { modes.set(it.key, { ...base, m: 'tr', ko }); note(`바로 번역본 ${it.who}`); continue; }
            if (failed.has(it.text)) { modes.set(it.key, { ...base, m: 'raw' }); continue; }
            modes.set(it.key, { ...base, m: 'wait' });
            note(`기다림 ${it.who}`);
            ask(it.text);
            const key = it.key;
            wake.set(key, timers.setTimeout(() => expire(key), wait));
        }
        if (modes.size > 600) for (const k of [...modes.keys()].slice(0, 300)) if (modes.get(k)?.m !== 'wait') modes.delete(k);
        const undo = [];
        for (const it of items) {
            const st = modes.get(it.key);
            // 관전자 이름: 처음 띄울 때 정한 이름(st.name)만 넣어요 — 띄운 뒤에 이름이 바뀌면 그 확장이 새 한마디로 보고 한 번 더 띄우니까요
            if (st?.name && st.m !== 'wait') { undo.push([it.obj, 'who', it.obj.who]); it.obj.who = st.name; }
            if (st?.m === 'wait') { undo.push([it.obj, 'turn', it.obj.turn]); it.obj.turn = -1; }
            else if (st?.m === 'tr' && st.ko) { undo.push([it.obj, 'text', it.obj.text]); it.obj.text = st.ko; }
        }
        try { return orig.apply(self, args); }
        finally { for (let i = undo.length - 1; i >= 0; i--) { const [o, k, v] = undo[i]; o[k] = v; } }
    }
    const redraw = () => { try { core.app?.mindPop?.(); } catch (e) { console.warn('[Blue Lemonade] 속마음 번역', e); } };
    /** 기다린 시간이 지나면 원문으로 띄워요(번역이 나중에 오면 그 말풍선을 바꿔 끼워요) */
    function expire(key) {
        wake.delete(key);
        const st = modes.get(key);
        if (st?.m !== 'wait') return;
        modes.set(key, { ...st, m: 'raw', late: true });
        note(`원문으로 ${st.who}`);
        redraw();
    }
    /** 번역이 왔어요 — 기다리던 말풍선은 번역본으로 띄우고, 원문으로 뜬 것은 바꿔 끼우고, 탭 글도 */
    function arrive(src, ko) {
        let again = false;
        for (const [key, st] of modes) {
            if (st.src !== src) continue;
            if (st.m === 'wait') {
                timers.clearTimeout(wake.get(key)); wake.delete(key);
                const name = st.name ?? (key.startsWith('w|') ? store.get(lang(), st.who) : null);   // 같은 묶음으로 온 관전자 이름(아직 안 띄웠으니 지금 정해요)
                modes.set(key, { ...st, m: 'tr', ko, ...(name ? { name } : {}) }); again = true; note(`번역본으로 ${st.who}`);
            }
            else if (st.m === 'raw' && st.late) { modes.set(key, { ...st, late: false }); if (!off()) swapBubble(st.name ?? st.who, ko, key.startsWith('w|') ? store.get(lang(), st.who) : null); }
        }
        if (again) redraw();
    }
    /** 원문으로 이미 뜬 말풍선 → 같은 꼴 번역본(새 마디)으로 바꿔 끼우고 사라지는 시간을 지금부터 · 원래 마디는 문서에서 빠져 그 확장 타이머가 아무 일도 못 해요 */
    function swapBubble(who, ko, name = null) {
        const box = doc.getElementById?.('ss-mind-pops');
        if (!box) return false;
        for (const el of box.querySelectorAll('.ss-mpop')) {
            if (el.classList.contains('out') || el.hasAttribute('data-bl-mind-tr')) continue;
            if ((el.querySelector('.ss-mpop-b small b')?.textContent ?? '') !== who) continue;
            const next = el.cloneNode(true);
            next.setAttribute('data-bl-mind-tr', '');
            next.classList.add('done');
            next.style.animation = 'none';   // 다시 튀어나오지 않고 글만 바뀌게
            const t = next.querySelector('.ss-mpop-t');
            if (t) t.textContent = ko;
            const nb = next.querySelector('.ss-mpop-b small b');   // 원문으로 뜬 관전자 이름도 이때 같이(바꿔 끼운 마디라 그 확장 열쇠와 상관없어요)
            if (nb && name && name !== who) { nb.title = `원문: ${who}`; nb.textContent = name; }
            el.replaceWith(next);
            let sec = 6; try { sec = Number(cfg?.numOf?.(set())?.sec) || 6; } catch { sec = 6; }
            timers.setTimeout(() => { next.style.animation = ''; next.classList.add('out'); timers.setTimeout(() => next.remove(), OUT_MS); }, sec * 1000 + [...ko].length * 30);
            note(`바꿔 끼움 ${who}`);
            return true;
        }
        return false;
    }

    function ask(src) {
        const k = String(src).trim();
        if (!k || inflight.has(k) || store.has(lang(), k)) return;
        pending.add(k);
        timers.clearTimeout(flushTimer);
        flushTimer = timers.setTimeout(() => { flush().catch(e => console.warn('[Blue Lemonade] 속마음 번역', e)); }, 120);
    }
    async function flush() {
        const list = [...pending].filter(k => !inflight.has(k));
        pending.clear();
        if (!list.length) return 0;
        let done = 0;
        for (let i = 0; i < list.length; i += BATCH) done += await run(list.slice(i, i + BATCH));
        return done;
    }
    /** 그 확장 번역 길(trText)로: 여러 줄이면 한 번에(줄 수가 맞을 때만) · 안 맞으면 하나씩 */
    async function run(list) {
        const L = lang();
        for (const k of list) inflight.add(k);
        note(`번역 보냄 ${list.length}`);
        let out = null;
        try {
            if (list.length > 1 && list.every(k => !/\n/.test(k))) {
                try {
                    const r = await tr.trText(list.join('\n'));
                    const lines = String(r ?? '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
                    if (lines.length === list.length) out = lines;
                } catch { out = null; }
            }
            if (!out) out = await Promise.all(list.map(k => Promise.resolve().then(() => tr.trText(k)).catch(() => k)));
        } finally { for (const k of list) inflight.delete(k); }
        let n = 0;
        const got = [];
        list.forEach((k, i) => {
            const ko = String(out?.[i] ?? '').trim();
            if (looksDone(ko, k, L)) { store.put(L, k, ko); failed.delete(k); n++; got.push([k, ko]); }
            else failed.add(k);
        });
        // 모음에 다 넣은 뒤에 알려요 — 한마디 글이 먼저 와서 다시 그릴 때 같은 묶음의 관전자 이름도 이미 있게
        for (const [k, ko] of got) arrive(k, ko);
        note(`번역 옴 ${n}/${list.length}`);
        if (n) paintAll();
        return n;
    }

    /** 탭 · 띠 칸 글 하나 — 번역이 있으면 적고(원문은 표식 · title), 없으면 자동일 때 부탁 */
    function paintEl(el) {
        if (!el?.isConnected) return;
        const L = lang();
        let src = el.getAttribute(SRC_ATTR);
        if (src == null) { src = String(el.textContent ?? '').trim(); if (!needsTr(src, L)) return; }
        if (off()) { restoreEl(el); return; }
        const ko = store.get(L, src);
        if (ko) {
            if (el.textContent !== ko) { el.setAttribute(SRC_ATTR, src); el.textContent = ko; el.title = `원문: ${src}`; }
            return;
        }
        if (active() && !failed.has(src)) ask(src);
    }
    function restoreEl(el) {
        const src = el.getAttribute(SRC_ATTR);
        if (src == null) return;
        el.textContent = src; el.removeAttribute(SRC_ATTR); el.removeAttribute('title');
    }
    function paintAll() { for (const el of doc.querySelectorAll?.(SEL) ?? []) paintEl(el); }
    function restoreAll() { for (const el of doc.querySelectorAll?.(`[${SRC_ATTR}]`) ?? []) restoreEl(el); }

    /** 번역 단추: 지금 상태의 속마음 글 가운데 번역이 없는 것 전부(지난번 실패한 것도 한 번 더) */
    async function clickFill() {
        if (off()) return 0;
        const s = core.app?.current?.state;
        if (!s) return 0;
        const L = lang();
        const list = allMindTexts(s).filter(t => needsTr(t, L) && !store.has(L, t));
        if (!list.length) { paintAll(); return 0; }
        for (const t of list) failed.delete(t);
        let done = 0;
        for (let i = 0; i < list.length; i += BATCH) done += await run(list.slice(i, i + BATCH));
        paintAll();
        try {
            if (done) toast?.success?.(`속마음 ${done}개도 번역했어요.`, 'Blue Lemonade', { timeOut: 3000 });
            else toast?.info?.('속마음은 이번에 번역하지 못했어요. 번역 단추를 다시 누르면 한 번 더 보내요.', 'Blue Lemonade', { timeOut: 4000 });
        } catch { /* 알림 없이 */ }
        return done;
    }
    function onClick(event) {
        if (off() || !event?.target?.closest?.(TRIGGER)) return;
        timers.setTimeout(() => { clickFill().catch(e => console.warn('[Blue Lemonade] 속마음 번역', e)); }, 0);
    }
    function onAnim(event) {
        if (event?.animationName !== ANIM || off()) return;
        try { paintEl(event.target); } catch { /* 원문 그대로 */ }
    }
    function onSwitch(key, isOff) { if (isOff) restoreAll(); else paintAll(); }
    return { wrap, pop, expire, arrive, paintEl, paintAll, restoreAll, clickFill, onClick, onAnim, onSwitch, active, autoOn, store, log, _modes: modes, _failed: failed, flush, get wrapped() { return !!orig; } };
}
/** 신호 시트(src/mb-mind-tr.css) 한 번 */
export function attachSheet(doc, base = import.meta.url) {
    if (doc.getElementById(SHEET_ID)) return false;
    const link = doc.createElement('link');
    link.id = SHEET_ID; link.rel = 'stylesheet'; link.href = new URL('./mb-mind-tr.css', base).href;
    (doc.head || doc.documentElement).append(link);
    try { holdSheet(link); } catch { /* 시트만 늦게 */ }
    return true;
}
function stChatId() { try { return globalThis.SillyTavern?.getContext?.()?.getCurrentChatId?.() ?? null; } catch { return null; } }

let started = null;
/** 기능 다리가 그 확장을 찾은 뒤 한 번 — 그 확장 판에 말풍선이 없으면(2.9.x) 조용히 쉬어요 */
export function startMindTr(doc = globalThis.document) {
    if (started || !doc?.addEventListener) return started;
    started = (async () => {
        const { findBase } = await import('./ext-bridge-tr.js');
        const base = await findBase(doc);
        if (!base) return null;
        const core = await import(new URL('src/core.js', base).href);
        if (typeof core.app?.mindPop !== 'function') return null;   // 2.9.x: 속마음 말풍선 없음 — 번역 · 신호 받기 모두 안 걸어요
        const [tr, cfg] = await Promise.all([import(new URL('src/translate.js', base).href), import(new URL('src/mindcfg.js', base).href).catch(() => ({}))]);
        if (typeof tr.trText !== 'function') return null;
        const mind = createMindTr({ core, tr, cfg }, { doc });
        if (!mind.wrap()) return null;
        attachSheet(doc);
        doc.addEventListener('animationstart', mind.onAnim, true);
        doc.addEventListener('click', mind.onClick, true);
        onMbOff(doc, [KEY], mind.onSwitch);
        try {
            const { eventSource, event_types: types } = globalThis.SillyTavern.getContext();
            if (types?.CHAT_CHANGED) eventSource.on(types.CHAT_CHANGED, () => { mind.wrap(); });   // 그 확장이 다시 걸었을 때를 대비해 한 번 더(감싼 것이면 그대로)
        } catch { /* 처음 감싼 것으로 */ }
        try { globalThis.__blMbMindTr = mind; } catch { /* 진단만 못 걸어요 */ }
        return mind;
    })().catch(error => { console.warn('[Blue Lemonade] 속마음 번역', error); return null; });
    return started;
}
