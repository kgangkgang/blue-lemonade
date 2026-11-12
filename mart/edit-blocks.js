// 11-12 「글 고치기」 공용 편집 모듈 — 마트 크게 보기 · 테마 로그 복사 창이 같이 써요(테마는 tools/mart/geulkku-mart-copy.mjs 들머리에 이 파일을 더해 그대로 떠 가요).
//   ① 칸 매기기 markSlots: tune.js editables(글 HTML 정규식)와 같은 규칙 · 같은 번호로 미리보기 DOM 에 data-bl-ed 를 달아요 — 번호가 곧 고친 글(texts)의 열쇠예요
//   ② 점선 블록: 고칠 수 있는 칸마다 PPT 텍스트 상자처럼 점선 테두리 · 누르면 그 자리에서 고쳐요 · 고치는 칸은 진하게 · 바깥 누르기나 Enter 로 끝(Shift+Enter 줄바꿈)
//   ③ 전 · 후: 소품(details)이 있는 틀은 미리보기 위에 「전 · 후」(여럿이면 「전 · 후 1 · 후 2 …」) — 고른 상태로 멈춰 두고 그때 보이는 칸을 고쳐요
//   ④ 칸 단위 되돌리기 · 다시하기(한 칸을 고치고 끝낼 때마다 한 칸)
//   이 모듈은 DOM 만 만져요. 고친 글 저장은 부르는 쪽이 칸의 'input' 이벤트(contenteditable)로 받아요 — 되돌리기 · 다시하기도 칸 글을 바꾼 뒤 'input' 을 내요.
//   쓰는 법(API)은 맨 아래 createEditBlocks 주석과 W/outputs/글꾸/편집-모드-공용-모듈.md 에 있어요.
import { EDIT_CLASSES, EDIT_TAGS, hasLetters } from './tune.js?v=20261112e';

const RICH = ['B', 'I', 'STRONG', 'EM', 'S', 'BR'];   // tune.js LEAF 와 같은 「꾸밈 태그」(속성 없는 것만)
const SKIP = ['STYLE', 'SCRIPT', 'AUDIO', 'BR', 'TITLE'];
/** 글자만 든 요소인가(꾸밈 태그는 속성 없이만 · 주석이 들면 아니에요) — tune.js LEAF 와 같은 뜻 · 마트가 런타임에 붙인 숨기기 · 테이프 칸은 봐줘요 */
const leafy = el => ![...el.childNodes].some(n => n.nodeType === 8)
    && [...el.querySelectorAll('*')].every(c => (RICH.includes(c.tagName) && !c.attributes.length) || c.hasAttribute('data-bl-mask') || !!c.closest('[data-bl-spoiler]'));

/**
 * 미리보기 DOM 의 글 칸에 번호(data-bl-ed)를 달아요 — tune.js editables(html) 과 같은 번호.
 *   바탕 칸(EDIT_CLASSES · ✎ 주석 · em/strong/s)이 먼저 0 ~ n-1, 그 밖에 글자(글자 · 숫자)가 든 잎 요소(소품 글자)는 그 뒤 n ~ (덧칸 — 예전에 고친 글 번호가 안 밀려요)
 * @param {Element} root  .gk 뿌리
 * @returns {Element[]} 번호 차례의 칸들
 */
export function markSlots(root) {
    const base = [], extra = [];
    let inside = null;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let el = walk.nextNode(); el; el = walk.nextNode()) {
        if (inside?.contains(el)) { el.removeAttribute('contenteditable'); delete el.dataset.blEd; continue; }   // 한 칸 안의 꾸밈은 따로 칸이 아니에요
        delete el.dataset.blEd;
        if (el.closest('.blsp-h')) continue;   // 숨긴 줄의 흐린 사본은 칸이 아니에요(칸 번호는 숨기기 전과 같아요)
        if (SKIP.includes(el.tagName) || !leafy(el)) continue;
        inside = el;   // 글자만 든 요소는 칸이든 아니든 속까지 한 덩이(정규식 LEAF 가 통째로 지나가는 것과 같아요)
        let prev = el.previousSibling; while (prev && prev.nodeType === 3 && !prev.data.trim()) prev = prev.previousSibling;
        const marked = prev?.nodeType === 8 && /^\s*✎/.test(prev.data);
        const hit = EDIT_CLASSES.find(c => el.classList.contains(c));
        if (hit || marked || EDIT_TAGS.includes(el.tagName.toLowerCase())) { if (!(hit === 'gk-hl' && !el.textContent.trim())) base.push(el); continue; }
        if (hasLetters(el.textContent)) extra.push(el);
    }
    const all = [...base, ...extra];
    all.forEach((el, i) => { el.dataset.blEd = String(i); });
    return all;
}

/** 소품 단계 — 숨기기(spoiler) 말고 틀이 쓰는 details 를 문서 차례로 · 단계 수 = details 수 + 1(전 · 후 1 · 후 2 …) */
export const propDetails = root => [...root.querySelectorAll('details')].filter(d => !d.matches('[data-bl-spoiler], .blsp-s'));
export const stepLabels = n => (n <= 0 ? [] : n === 1 ? ['전', '후'] : ['전', ...Array.from({ length: n }, (_, i) => `후 ${i + 1}`)]);

/** 고른 단계로 멈춰 둬요 — 앞에서 k 개 details 를 열고 나머지는 닫은 뒤, 움직임은 끝 모습으로(끝없는 움직임은 멈춤) */
export function setStep(root, k) {
    const ds = propDetails(root);
    root.classList.add('bl-eb-freeze');
    ds.forEach((d, i) => { const open = i < k; d.open = open; d.dataset.blHold = String(open); });
    settle(root);
}
function settle(root) {
    for (const a of root.getAnimations?.({ subtree: true }) || []) { try { a.finish(); } catch { try { a.pause(); } catch { /* 그대로 */ } } }
}

const CSS = `.bl-eb-on [data-bl-ed]{outline:1.5px dashed color-mix(in srgb,var(--bl-eb-c,#2477d3) 85%,transparent)!important;outline-offset:2px!important;border-radius:2px;cursor:text;min-width:.6em;min-height:1em}
.bl-eb-on [data-bl-ed]:hover{outline-style:solid!important;position:relative;z-index:3}
.bl-eb-on [data-bl-ed]:focus{outline:2px solid var(--bl-eb-c,#2477d3)!important;outline-offset:2px!important;background-color:color-mix(in srgb,var(--bl-eb-c,#2477d3) 12%,transparent);position:relative;z-index:4}
.bl-eb-freeze,.bl-eb-freeze *{transition:none!important}
.bl-eb-steps{display:flex;gap:6px;align-items:center;margin:0 0 10px;font:600 13px/1.2 system-ui,sans-serif}
.bl-eb-steps>span{opacity:.7;margin-right:2px}
.bl-eb-steps button{min-width:44px;min-height:32px;padding:4px 12px;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:999px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.bl-eb-steps button[aria-pressed=true]{border-color:var(--bl-eb-c,#2477d3);background:var(--bl-eb-c,#2477d3);color:#fff}`;
function ensureCss(doc) {
    if (doc.getElementById('bl-eb-css')) return;
    const s = doc.createElement('style'); s.id = 'bl-eb-css'; s.textContent = CSS; doc.head.append(s);
}

/**
 * 편집 모드 한 벌을 만들어요.
 * @param {Element} host  미리보기 칸(그 안에 .gk 가 있어요 — 다시 그려져도 refresh() 로 다시 걸어요)
 * @param {{ onStep?: (k:number)=>void, label?: string }} [opt]
 * @returns {{ on:boolean, setOn(v:boolean):void, refresh():void, step:number, setStep(k:number):void, steps():string[], undo():boolean, redo():boolean, canUndo():boolean, canRedo():boolean, slots():Element[], destroy():void }}
 *   - setOn(true): 칸 번호 · 점선 블록 · contenteditable · (소품이 있으면) 전 · 후 막대. false: 다 떼고 소품 상태를 켜기 전으로 · 움직임 되살림
 *   - refresh(): 부르는 쪽이 미리보기를 새로 그린 뒤 불러요(번호 · 블록 · 고른 단계를 다시 걸어요)
 *   - undo() · redo(): 칸 단위 — 바꾼 칸에 'input' 이벤트를 내요(부르는 쪽 저장 길 그대로)
 */
export function createEditBlocks(host, opt = {}) {
    const doc = host.ownerDocument; ensureCss(doc);
    const st = { on: false, step: 0, hold: null, past: [], future: [], editing: null, before: '' };
    const root = () => host.querySelector('.gk');
    const bar = () => host.querySelector(':scope > .bl-eb-steps');
    const drawBar = () => {
        bar()?.remove();
        const r = root(); if (!st.on || !r) return;
        const labels = stepLabels(propDetails(r).length); if (!labels.length) return;
        const b = doc.createElement('div'); b.className = 'bl-eb-steps'; b.setAttribute('role', 'group'); b.setAttribute('aria-label', '소품 전 · 후');
        b.innerHTML = `<span>${opt.label || '소품'}</span>` + labels.map((l, k) => `<button type="button" data-bl-step="${k}" aria-pressed="${k === st.step}">${l}</button>`).join('');
        host.prepend(b);
    };
    const arm = () => {
        const r = root(); if (!r) return;
        const cells = markSlots(r);
        for (const el of cells) { if (st.on) { el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false'); } else { el.removeAttribute('contenteditable'); el.removeAttribute('spellcheck'); } }
        host.classList.toggle('bl-eb-on', st.on);
        if (st.on) setStep(r, st.step); else r.classList.remove('bl-eb-freeze');
        drawBar();
    };
    const write = (i, html) => { const el = root()?.querySelector(`[data-bl-ed="${i}"]`); if (!el) return false; el.innerHTML = html; el.dispatchEvent(new InputEvent('input', { bubbles: true })); return true; };
    const onFocusIn = (e) => { const el = e.target.closest?.('[data-bl-ed]'); if (!st.on || !el || !host.contains(el)) return; st.editing = el.dataset.blEd; st.before = el.innerHTML; keepInView(el); };
    const onFocusOut = (e) => {
        const el = e.target.closest?.('[data-bl-ed]'); if (!el || el.dataset.blEd !== st.editing) return;
        if (el.innerHTML !== st.before) { st.past.push({ i: st.editing, from: st.before, to: el.innerHTML }); st.future = []; }
        st.editing = null;
    };
    const onKey = (e) => {
        const el = e.target.closest?.('[data-bl-ed]'); if (!st.on || !el) return;
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.stopImmediatePropagation(); el.blur(); }
        if (e.key === 'Escape') { el.innerHTML = st.before; el.dispatchEvent(new InputEvent('input', { bubbles: true })); el.blur(); }
    };
    const onClick = (e) => { const b = e.target.closest?.('[data-bl-step]'); if (!b || !host.contains(b)) return; e.preventDefault(); api.setStep(Number(b.dataset.blStep)); };
    // 폰: 자판이 뜨면 화면이 줄어요 — 고치는 칸을 보이는 자리로
    const keepInView = el => { const go = () => el.scrollIntoView?.({ block: 'center', inline: 'nearest' }); setTimeout(go, 60); doc.defaultView?.visualViewport?.addEventListener('resize', go, { once: true }); };
    host.addEventListener('focusin', onFocusIn); host.addEventListener('focusout', onFocusOut);
    host.addEventListener('keydown', onKey, true); host.addEventListener('click', onClick);
    const api = {
        get on() { return st.on; },
        get step() { return st.step; },
        setOn(v) {
            v = !!v; if (v === st.on) { arm(); return; }
            const r = root();
            if (v) { st.hold = r ? propDetails(r).map(d => d.open) : null; st.step = st.hold ? st.hold.filter(Boolean).length : 0; }
            st.on = v; arm();
            if (!v && r) { const ds = propDetails(r); ds.forEach((d, i) => { d.open = !!st.hold?.[i]; delete d.dataset.blHold; }); st.past = []; st.future = []; }
        },
        refresh: arm,
        setStep(k) { const r = root(); if (!r) return; st.step = Math.max(0, Math.min(propDetails(r).length, k)); setStep(r, st.step); drawBar(); opt.onStep?.(st.step); },
        steps: () => (root() ? stepLabels(propDetails(root()).length) : []),
        undo() { const x = st.past.pop(); if (!x) return false; st.future.push(x); return write(x.i, x.from); },
        redo() { const x = st.future.pop(); if (!x) return false; st.past.push(x); return write(x.i, x.to); },
        canUndo: () => st.past.length > 0,
        canRedo: () => st.future.length > 0,
        slots: () => (root() ? markSlots(root()) : []),
        destroy() { api.setOn(false); host.removeEventListener('focusin', onFocusIn); host.removeEventListener('focusout', onFocusOut); host.removeEventListener('keydown', onKey, true); host.removeEventListener('click', onClick); },
    };
    return api;
}
