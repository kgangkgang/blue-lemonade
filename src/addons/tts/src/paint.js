// TTS · 색 없는 대사에 화자 색 (테마 6.2.3)
// AI 가 대사마다 <span style="color:#hex">「…」</span> 로 인물 색을 넣다가 몇 줄을 빼먹으면, 그 줄은 실리태번 따옴표 색이라 다른 인물의 대사처럼 보인다.
// 재생기와 같은 화자(색 → 이름표 → 대사 분석의 화자 찾기 · player.dialogueSpeakers)로, 색 없는 대사를 그 인물이 이 채팅에서 쓴 색(speakers.colorOfName)으로 칠한다.
//
// - 화면에서만: 대사(q 요소, 없으면 여닫이 글자까지)를 AI 가 쓴 것과 같은 <span style="color: #hex" data-lv-paint="이름"> 으로 감싼다.
//   메시지 원문 · 채팅 파일은 그대로. 테마의 대사 꾸밈 · 형광펜 · 톤 규칙이 [style*="color"] 로 그대로 먹고, tone.js 관찰자가 --bl-hue 를 붙인다.
// - 다시 그리기 · 스와이프 · 편집 · 번역 표시가 바뀌면 #chat 관찰자가 그 메시지를 다시 칠한다 (0.3초 묶음 · 생성 중인 마지막 메시지는 쉼).
// - 화자를 못 찾았거나(보낸 쪽 이름으로 떨어짐) 그 인물의 색을 모르면 손대지 않는다. 칠한 줄은 data-lv-paint 표시만 (툴팁 없음).
// - LLM: 저장된 대사 분석만 쓴다. 새 답장(과 채팅을 열 때 마지막 답장)에 화자를 모르는 색 없는 대사가 있고 분석이 없을 때만, 재생기가 읽을 때와
//   같은 분석 요청을 한 번 (player.analyzeForPaint — 같은 저장 자리라 나중에 읽을 때 다시 값을 치르지 않음). 메시지 글마다 한 번만 시도.
//
// 밖으로: init() · destroy() · refresh() · paintMessage(mesId) · onRendered(mesId, type) · onChatChanged() · onGenStarted() · onGenEnded()

import { chat } from '../../../../../../../../script.js';
import { getContext } from '../../../../../../../extensions.js';
import { settings } from './settings.js';
import { runtimeEnabled } from './runtime.js';
import { textIndex, scanDialogue, colorFromBareHex, previewing } from './clickplay.js';   // 7.0.2 previewing
import { colorOfName, normColor } from './speakers.js';
import * as player from './player.js';
import { log } from './log.js';
import { PAINT_ATTR, planPaint, needsSpeakers } from './paint-core.js';

const DEBOUNCE_MS = 300;
const SLICE_MS = 12;                       // 한 번에 칠하는 시간 — 넘으면 쉬었다가 이어서 (폰에서 채팅을 열 때 길게 막지 않게)
const OPEN_DELAY_MS = 1200;                // 채팅을 연 뒤 마지막 답장을 볼 때까지 (메시지가 다 그려지게)
const QUOTE_OPENERS = /[「『“"«＂„]/;      // 대화문 여는 글자가 하나도 없으면 그 메시지는 건너뜀 (싸게)
const BLOCK = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'DL', 'DT', 'DD', 'TD', 'TH', 'TR', 'TABLE', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'DETAILS', 'SUMMARY', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
let observer = null, timer = 0, openTimer = 0, generating = false;
const dirty = new Set();
const tried = new WeakMap();                // 메시지 객체 → 분석을 시도한 'swipe|글'

/** 켜져 있나: TTS 애드온이 돌고 · 설정 「색 없는 대사에 화자 색」 */
export const enabled = () => runtimeEnabled() && settings().speaker_paint !== false;

const mesIdOf = (el) => { const n = Number(el?.getAttribute?.('mesid')); return Number.isInteger(n) ? n : null; };
const mesEl = (mesId) => document.querySelector(`#chat .mes[mesid="${mesId}"]`);
const isLast = (mesId) => mesId === chat.length - 1;

/** 우리가 감싼 span 만 푼다 (안의 글 · 요소는 그대로 제자리) */
function unwrap(root) {
    for (const sp of root.querySelectorAll(`span[${PAINT_ATTR}]`)) sp.replaceWith(...sp.childNodes);
}

/** 글자 노드를 감싼 요소에 제 글자색이 있나: 인라인 색 · font color · 정규식이 class 로 꾸민 글자(custom-…). 우리가 칠한 span 은 「색 없음」으로 본다 */
function ownColor(node, root) {
    for (let el = node.parentNode; el && el !== root; el = el.parentNode) {
        if (el.nodeType !== 1 || el.hasAttribute?.(PAINT_ATTR)) continue;
        const c = String(el.style?.color || '').trim().toLowerCase();
        if (c && !/^(inherit|initial|unset|revert|currentcolor)$/.test(c)) return true;
        if (el.tagName === 'FONT' && el.getAttribute('color')) return true;
        if (/(?:^|\s)custom-/.test(String(el.className || ''))) return true;
    }
    return false;
}
/** 대화문 짝의 첫 글자 노드 (안쪽 글이 있는 첫 노드) */
function firstNode(nodes, d) {
    for (const n of nodes) {
        const v = String(n.node.nodeValue || '');
        if (n.start + v.length <= d.is || n.start >= d.ie) continue;
        if (/\S/.test(v.slice(Math.max(0, d.is - n.start), d.ie - n.start))) return n.node;
    }
    return null;
}
/** 대화문 짝이 이미 글자색을 가졌나 (첫 글자 노드로 판단 · 데우스 맨 색 표기 #hex "…" 도) */
function quoteColored(nodes, flat, d, root) {
    const n = firstNode(nodes, d);
    return (n ? ownColor(n, root) : false) || !!colorFromBareHex(flat, d.start);
}

/** 화면의 대화문 짝 [{ d, text, colored }] */
function quotesOf(root) {
    const { nodes, flat } = textIndex(root, { computed: false });
    const list = scanDialogue(flat).map(d => ({ d, text: flat.slice(d.is, d.ie), colored: false }));
    for (const q of list) q.colored = quoteColored(nodes, flat, q.d, root);
    return { nodes, flat, list };
}
/** 그 대사를 이미 감싼 우리 span (없으면 null) */
function paintedSpan(nodes, d, root) {
    const n = firstNode(nodes, d);
    for (let el = n?.parentNode; el && el !== root; el = el.parentNode) if (el.nodeType === 1 && el.hasAttribute(PAINT_ATTR)) return el;
    return null;
}

function paintSpan(color, name) {
    const span = document.createElement('span');
    span.setAttribute('style', `color: ${color}`);
    span.setAttribute(PAINT_ATTR, name);
    return span;
}

/** 대화문 짝 하나를 색 span 으로 감싼다: 그 대사만 담은 요소(q 등)가 있으면 그 요소째, 아니면 글자 범위 (여닫이 포함). 못 감싸면 false */
function wrapQuote(root, nodes, flat, d, color, name) {
    const parts = nodes.filter(n => n.start < d.end && n.start + String(n.node.nodeValue || '').length > d.start);
    if (!parts.length) return false;
    const want = flat.slice(d.start, d.end).replace(/\s+/g, ' ').trim();
    // 1) 모든 글자 노드를 품은 요소 가운데 글이 이 대사와 같은 가장 바깥 인라인 요소(보통 <q>「…」</q>, <em><q>…</q></em> 면 em)째.
    //    문단 · div 같은 블록은 감싸지 않는다 (AI 의 색 span 도 문단 안에 있다)
    let common = parts[0].node.parentNode;
    while (common && common !== root && !parts.every(p => common.contains(p.node))) common = common.parentNode;
    let target = null;
    for (let el = common; el && el !== root && el.nodeType === 1; el = el.parentNode) {
        if (BLOCK.has(el.tagName) || String(el.textContent || '').replace(/\s+/g, ' ').trim() !== want) break;
        target = el;
    }
    if (target) {
        const span = paintSpan(color, name);
        target.before(span); span.append(target);
        return true;
    }
    // 2) 글자 범위: 한 글자 노드 안이면 쪼개서, 아니면 Range 로 (요소를 반쯤 자르는 범위면 손대지 않음)
    try {
        const first = parts[0], last = parts[parts.length - 1];
        const range = document.createRange();
        range.setStart(first.node, Math.max(0, d.start - first.start));
        range.setEnd(last.node, Math.min(String(last.node.nodeValue || '').length, d.end - last.start));
        range.surroundContents(paintSpan(color, name));
        return true;
    } catch { return false; }
}

/**
 * 메시지 하나를 칠한다 (먼저 칠했던 것은 풀고 다시). 칠한 줄 수를 준다.
 * 생성 중인 마지막 메시지 · 편집 중 · 내 메시지 · 시스템 메시지는 건너뜀 (꺼져 있으면 푼 채로 끝)
 */
export function paintMessage(mesId, el = null) {
    if (previewing()) return 0;
    const box = el || mesEl(mesId);
    const root = box?.querySelector('.mes_text');
    if (!root) return 0;
    const had = root.querySelectorAll(`span[${PAINT_ATTR}]`);
    const mes = chat[mesId];
    const skip = !enabled() || !mes || mes.is_user || mes.is_system || (generating && isLast(mesId))
        || !!box.querySelector('.edit_textarea') || root.isContentEditable || !QUOTE_OPENERS.test(root.textContent || '');
    if (skip) { if (had.length) unwrap(root); return 0; }
    let { nodes, flat, list } = quotesOf(root);
    if (!list.some(q => !q.colored)) { if (had.length) unwrap(root); return 0; }   // 색 없는 대사가 없으면 화자를 구하지 않는다
    let speakers = [];
    try { speakers = player.dialogueSpeakers(mesId); } catch (e) { log('err', `화자 색: 화자 구하기 실패 ${String(e?.message || e).slice(0, 40)}`); return 0; }
    let userName = '';
    try { userName = String(getContext()?.name1 || ''); } catch { userName = ''; }
    const colorOf = (name) => colorOfName(name, { userName });
    let plan = speakers.length ? planPaint(list, speakers, colorOf) : [];
    // 이미 그대로 칠해져 있으면 DOM 을 건드리지 않는다 (다시 그리지 않은 메시지 · 같은 결과)
    if (had.length === plan.length && plan.every(p => {
        const sp = paintedSpan(nodes, list[p.index].d, root);
        return sp && sp.getAttribute(PAINT_ATTR) === p.name && normColor(sp.style.color) === p.color;
    })) return plan.length;
    if (had.length) {
        unwrap(root);
        ({ nodes, flat, list } = quotesOf(root));
        plan = planPaint(list, speakers, colorOf);
    }
    let n = 0;
    // 뒤에서부터 감싼다 — 글자 노드를 쪼개도 앞쪽 자리 번호는 그대로
    for (const p of plan.slice().reverse()) if (wrapQuote(root, nodes, flat, list[p.index].d, p.color, p.name)) n++;
    return n;
}

/** 화자를 모르는 색 없는 대사가 있나 (DOM + 화자 목록) — 그때만 분석을 부른다 */
function needsAnalysis(mesId) {
    const root = mesEl(mesId)?.querySelector('.mes_text');
    if (!root || !QUOTE_OPENERS.test(root.textContent || '')) return false;
    const { list } = quotesOf(root);
    if (!list.some(q => !q.colored)) return false;
    let speakers = [];
    try { speakers = player.dialogueSpeakers(mesId); } catch { return false; }
    return needsSpeakers(list, speakers);
}

/** 1.9.7 LLM 번역 애드온이 이 답의 자동 번역을 건너뛰는 까닭 — 'system'(눈 끈) | 'korean' | null (애드온이 없거나 자동 번역이 꺼져 있으면 null) */
function translatorSkipReason(mes) {
    try { return globalThis[Symbol.for('blue-lemonade.translator')]?.autoSkipReason?.(mes) ?? null; } catch { return null; }
}

/** 새 답장 · 채팅을 연 뒤 마지막 답장: 화자를 모르는 색 없는 대사가 있으면 대사 분석 한 번 (메시지 글마다 한 번) → 다시 칠함 */
async function maybeAnalyze(mesId) {
    if (!enabled() || !Number.isInteger(mesId)) return;
    const mes = chat[mesId];
    if (!mes || mes.is_user || mes.is_system) return;
    const key = `${mes.swipe_id ?? 0}|${mes.mes}`;
    if (tried.get(mes) === key || !needsAnalysis(mesId)) return;
    // 눈 끈 답만 쉰다 — 한국어 답도 화자 색 분석은 필요하다(6.9.7 처럼). 쉰 답은 tried 에 적지 않는다(눈을 다시 뜨면 분석)
    if (translatorSkipReason(mes) === 'system') { log('info', '화자 색: 번역 애드온이 눈 끈 답으로 건너뛰어 대사 분석도 쉼'); return; }
    tried.set(mes, key);
    let a = null;
    try { a = await player.analyzeForPaint(mesId); } catch (e) { log('err', `화자 색: 분석 실패 ${String(e?.message || e).slice(0, 40)}`); a = null; }
    if (a && chat[mesId] === mes) queue(mesId);
}

// ---------- 다시 칠하기 (관찰자 · 묶음)
function queue(mesId) {
    if (!Number.isInteger(mesId)) return;
    dirty.add(mesId);
    clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
}
function flush() {
    timer = 0;
    if (!observer) { dirty.clear(); return; }
    const t0 = performance.now();
    // 아래(최근) 메시지부터 — 화면에 보이는 쪽이 먼저
    for (const id of [...dirty].sort((a, b) => b - a)) {
        dirty.delete(id);
        try { paintMessage(id); } catch (e) { log('err', `화자 색: 칠하기 실패 ${String(e?.message || e).slice(0, 40)}`); }
        if (dirty.size && performance.now() - t0 > SLICE_MS) { timer = setTimeout(flush, 16); break; }
    }
    observer.takeRecords();   // 우리가 바꾼 것은 다시 부르지 않게
}
function onMutations(records) {
    if (!enabled() || previewing()) return;
    for (const r of records) {
        const t = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        const box = t?.closest?.('.mes');
        if (box) { const id = mesIdOf(box); if (id !== null) dirty.add(id); continue; }
        for (const node of r.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.matches?.('.mes')) { const id = mesIdOf(node); if (id !== null) dirty.add(id); }
            else for (const m of node.querySelectorAll?.('.mes') || []) { const id = mesIdOf(m); if (id !== null) dirty.add(id); }
        }
    }
    if (!dirty.size) return;
    clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
}

/** 화면에 있는 메시지를 모두 다시 칠한다 (꺼졌으면 칠한 것을 모두 푼다) */
export function refresh() {
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;
    if (!enabled()) { unwrap(chatEl); return; }
    if (previewing()) return;
    for (const m of chatEl.querySelectorAll('.mes[mesid]')) { const id = mesIdOf(m); if (id !== null) dirty.add(id); }
    clearTimeout(timer);
    timer = setTimeout(flush, 0);
}

// ---------- 이벤트 (index.js 가 부른다)
export function onRendered(mesId, type = '') {
    if (!enabled() || !Number.isInteger(mesId)) return;
    if (isLast(mesId)) generating = false;   // 다 그려졌으면 생성은 끝 (끝 신호를 놓쳐도 마지막 답장이 칠해지게)
    queue(mesId);
    if (type === 'impersonate' || type === 'quiet') return;
    void maybeAnalyze(mesId);
}
export function onChatChanged() {
    clearTimeout(openTimer);
    if (!enabled()) return;
    openTimer = setTimeout(() => {
        refresh();
        for (let i = chat.length - 1; i >= 0; i--) { const m = chat[i]; if (m && !m.is_user && !m.is_system) { void maybeAnalyze(i); break; } }
    }, OPEN_DELAY_MS);
}
export function onGenStarted() { generating = true; }
export function onGenEnded() { generating = false; const last = chat.length - 1; if (last >= 0) queue(last); }

export function init() {
    if (observer) return;
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;
    observer = new MutationObserver(onMutations);
    observer.observe(chatEl, { childList: true, subtree: true });
    refresh();
}
export function destroy() {
    clearTimeout(timer); clearTimeout(openTimer); timer = 0; openTimer = 0; dirty.clear();
    if (observer) { observer.disconnect(); observer = null; }
    const chatEl = document.getElementById('chat');
    if (chatEl) unwrap(chatEl);
}
