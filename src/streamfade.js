// 가벼운 페이드 인 (2.9.5) — 스트리밍 중인 답변에서 방금 도착한 글자만 부드럽게 나타나게.
//
// 실리태번의 '스트리밍 페이드 인'은 낱말마다 <span class="text_segment"> 를 만들어 morphdom 으로 이어 붙인다.
// 데우스 답변 하나가 요소 1만 개가 되고, 스트리밍 한 걸음마다 그 1만 개를 다시 스타일 계산 → 폰에서 가장 큰 비용이었다.
// 그 설정을 끄면 실리태번은 걸음마다 .mes_text 의 innerHTML 을 통째로 새로 쓴다 (요소가 매번 새로 생김).
// 그래서 CSS 애니메이션을 문단에 걸면 매 걸음 처음부터 다시 돈다 → 깜빡임. 대신 이렇게 한다:
//
//  1. 스트리밍 중인 .mes_text 하나만 MutationObserver 로 지켜보다가, 바뀐 그 마이크로태스크에서 바로 본다.
//     실리태번이 innerHTML 을 쓴 직후 · 그리기 전이라 감싸기 전 화면이 나갈 틈이 없고, 스타일 계산도 한 번으로 끝난다.
//     (rAF 로 미뤘더니 애니메이션이 돌고 있을 때 Blink 가 rAF 앞에서 스타일을 먼저 계산해, 감싸기 때문에 한 프레임에
//     스타일 · 레이아웃이 두 번 돌았다 — 4배 느린 CPU 에서 답변 하나에 약 1초). 옵저버는 스트림을 시작할 때 만들어서
//     캐릭터 에셋처럼 같은 때 글자를 고치는 확장의 옵저버보다 뒤에 불린다.
//  2. 글자 수(textContent)만으로 '이전 걸음 뒤에 새로 붙은 구간'을 찾는다 — 레이아웃을 읽지 않는다.
//  3. 새 구간과, 아직 페이드가 덜 끝난 최근 구간 몇 개만 <bl-fade> 로 감싼다 (걸음마다 요소 몇 개).
//     구간마다 도착한 시각을 기억해 animation-delay 를 음수(-지난 시간)로 주므로, 요소가 새로 만들어져도
//     투명도가 이어서 진행된다 — 오래된 글자는 다시 흐려지지 않고, 레이아웃도 안 바뀐다 (opacity 만).
//  4. 스트림이 끝나면 지켜보기를 멈추고, 애니메이션이 끝난 뒤 감싼 요소를 풀어 실리태번이 그린 모양 그대로 돌려놓는다.
//
// 켜짐 조건: 테마 켬 · 채팅 › 화면 '가벼운 페이드 인' 켬 · 실리태번 페이드 인 끔 (켜져 있으면 그쪽이 하므로 쉼) ·
// 기기의 '동작 줄이기'(prefers-reduced-motion) 아님. 히스토리 · 이미 그려진 스와이프 · 편집에는 붙지 않는다.
import { getSettings } from './settings.js';

const TAG = 'bl-fade';
const HIDDEN = 'style, script, template';                         // 화면에 안 나오는 글자 — 위치 셈에서 뺀다
const HIDDEN_TAGS = new Set(['STYLE', 'SCRIPT', 'TEMPLATE']);
const NO_WRAP = 'pre, code, textarea, select, option, svg, math'; // 감싸면 안 되는 곳 (실리태번 페이드 인도 pre/code 는 건너뜀)
const SIG = 40;   // 이전 글의 끝 조각으로 새 글 안에서 '어디까지가 옛 글인지' 찾는 길이
const SLACK = 24; // 못 찾았을 때 새 구간을 (새로 받은 글자 수 + 이만큼)으로 제한 — 앞쪽 글이 통째로 다시 흐려지지 않게
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let target = null;      // 지금 지켜보는 .mes_text
let observer = null;
let prevText = '';
let buckets = [];       // { s, e, t } — 보이는 글자 위치 [s, e) 가 t(performance.now) 에 도착
let wrappers = [];      // 지금 문서에 넣어 둔 <bl-fade>
let duration = 400;
let decided = false;    // 이번 생성에서 붙일지 이미 정했는가 (토큰마다 설정을 다시 읽지 않게)
let processor = null;   // 실리태번 StreamingProcessor — result(받은 원문) 길이로 한 걸음에 새로 온 글자 수를 가늠
let lastRaw = 0;
const stats = { steps: 0, wrapped: 0, ms: 0 };

function wanted() {
    const s = getSettings();
    if (!s.enabled || !s.chat?.streamFade) return false;
    if (reduceMotion.matches) return false;
    return !SillyTavern.getContext().powerUserSettings?.stream_fade_in;
}

/** 페이드 길이: 실리태번은 낱말마다 300ms. 한 걸음(1000/fps)이 길면 두 걸음에 걸쳐 스미게 (5fps → 400ms) */
function pickDuration() {
    const fps = Number(SillyTavern.getContext().powerUserSettings?.streaming_fps) || 30;
    return Math.round(Math.min(600, Math.max(300, 2000 / fps)));
}

// ───────── 글자 위치 ─────────
function textWalker(root, hidden) {
    const filter = hidden ? { acceptNode: n => (HIDDEN_TAGS.has(n.parentElement?.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) } : null;
    return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, filter);
}

/**
 * 화면에 나오는 글자 전부 (style · script 속 글자 빼고). textContent 한 번에 받아, 정규식 카드가 넣은 <style> 글자만
 * 순서대로 도려낸다 — 글자 노드 1000여 개를 JS 로 훑지 않게 (데우스 답변에는 카드마다 <style> 이 있음)
 */
function visibleText(root, hidden) {
    const full = root.textContent;
    if (!hidden) return full;
    let text = '', from = 0;
    for (const el of root.querySelectorAll(HIDDEN)) {
        const inner = el.textContent;
        if (!inner) continue;
        const at = full.indexOf(inner, from);
        if (at < 0) continue;
        text += full.slice(from, at);
        from = at + inner.length;
    }
    return text + full.slice(from);
}

/**
 * 새 글(next)에서 옛 글(prev)이 끝나는 위치(end)와, 옛 글 끝부분이 얼마나 밀렸는지(shift).
 * - 그냥 뒤에 붙었으면: end = 옛 길이, shift 0 (거의 항상)
 * - 앞쪽이 바뀌었으면 (다른 확장이 낱말을 바꿈 등): 옛 글의 끝 조각을 새 글에서 찾아 그 뒤부터 새 글자
 * - 끝 조각도 없으면 (마크다운이 끝에서 모양을 바꿈 · 번역문이 원문으로 통째로 바뀜 등): 앞에서부터 같은 데까지,
 *   단 새 글은 (늘어난 글자 수와 새로 받은 원문 글자 수 중 작은 것) + SLACK 보다 길게 잡지 않음
 */
function locate(prev, next, received) {
    const P = prev.length, L = next.length;
    if (next.startsWith(prev)) return { end: P, shift: 0, found: true };
    if (P >= 12) {
        const from = Math.max(0, P - SIG), to = P - 2; // 맨 끝 두 글자는 짝 맞추기 따옴표 · 별표일 수 있어 뺌
        const sig = prev.slice(from, to);
        const at = next.lastIndexOf(sig);
        if (at >= 0) {
            let k = at + sig.length, j = to;
            while (j < P && k < L && next.charCodeAt(k) === prev.charCodeAt(j)) { k++; j++; }
            return { end: k, shift: at - from, found: true };
        }
    }
    let p = 0;
    const max = Math.min(P, L);
    while (p < max && next.charCodeAt(p) === prev.charCodeAt(p)) p++;
    return { end: Math.max(p, L - Math.min(Math.max(0, L - P), received) - SLACK, 0), shift: 0, found: false };
}

// ───────── 감싸기 ─────────
function unwrap(list) {
    const parents = new Set();
    for (const w of list) {
        if (!w.isConnected) continue;
        parents.add(w.parentNode);
        w.replaceWith(...w.childNodes);
    }
    for (const parent of parents) parent.normalize(); // 잘라 둔 글자 조각을 다시 하나로 (실리태번이 그린 모양 그대로)
}

function wrap(piece, age) {
    const w = document.createElement(TAG);
    w.style.animationDuration = `${duration}ms`;
    w.style.animationDelay = `${-Math.round(age)}ms`;
    piece.parentNode.insertBefore(w, piece);
    w.appendChild(piece);
    wrappers.push(w);
}

/** 보이는 글자 위치 구간들을 뒤에서부터 훑어 감싼다. 최근 구간만 보므로 답변 끝의 글자 노드 몇 개만 지나간다 */
function wrapBuckets(root, hidden, total, now) {
    if (!buckets.length) return;
    let lowest = total;
    for (const b of buckets) lowest = Math.min(lowest, b.s);
    const walker = textWalker(root, hidden);
    let last = root;
    while (last.lastChild) last = last.lastChild;
    walker.currentNode = last;
    let node = last.nodeType === Node.TEXT_NODE && !(hidden && HIDDEN_TAGS.has(last.parentElement?.tagName)) ? last : walker.previousNode();
    let pos = total;
    const found = [];
    while (node && pos > lowest) {
        const start = pos - node.data.length;
        found.push([node, start, pos]);
        pos = start;
        node = walker.previousNode();
    }
    for (const [text, start, end] of found) {
        if (!/\S/.test(text.data)) continue;                         // 빈칸 · 줄바꿈뿐인 조각은 그대로 (블록 사이에 인라인 상자를 안 만듦)
        const segs = [];
        for (const b of buckets) {
            const a = Math.max(b.s, start), z = Math.min(b.e, end);
            if (z > a) segs.push({ a: a - start, z: z - start, age: now - b.t });
        }
        if (!segs.length) continue;
        const blocked = text.parentElement?.closest(NO_WRAP);
        if (!text.parentElement || (blocked && root.contains(blocked))) continue;
        segs.sort((x, y) => y.a - x.a);                              // 뒤 구간부터 잘라야 앞 위치가 안 밀림
        const rest = text;
        for (const { a, z, age } of segs) {
            if (z < rest.data.length) rest.splitText(z);
            const piece = a > 0 ? rest.splitText(a) : rest;
            if (/\S/.test(piece.data)) wrap(piece, age);
        }
    }
}

// ───────── 한 걸음 ─────────
function step() {
    if (!target) return;
    if (!target.isConnected) { detach(false); return; }
    const t0 = performance.now();
    const hidden = !!target.querySelector(HIDDEN);
    const text = visibleText(target, hidden);
    const intact = wrappers.every(w => w.isConnected);
    if (text === prevText && intact) return;

    const now = performance.now();
    if (text !== prevText) {
        // 이어 쓰기에서 번역기가 번역문을 보여 주던 메시지는 실리태번이 원문 + 이어 쓴 글로 통째로 바꿔 써서 옛 글을 못 찾는다 —
        // 그때도 새 글은 이번에 새로 받은 원문 글자 수만큼만 (옛 글 전체가 흐려졌다 나타나지 않게)
        const raw = String(processor?.result ?? '').length;
        const { end, shift } = locate(prevText, text, Math.max(0, raw - lastRaw));
        lastRaw = raw;
        for (const b of buckets) {
            b.s = Math.min(Math.max(0, b.s + shift), end);
            b.e = Math.min(Math.max(0, b.e + shift), end);
        }
        if (text.length > end) buckets.push({ s: end, e: text.length, t: now });
        else if (intact && shift === end - prevText.length) {
            // 새 글자 없이 위쪽 글자만 바뀜 (헬퍼 스크립트가 카드 제목을 번역하는 등) — 감싼 요소는 그대로 맞으니 위치만 옮김
            buckets = buckets.filter(b => b.e > b.s && now - b.t < duration);
            prevText = text;
            return;
        }
    }
    buckets = buckets.filter(b => b.e > b.s && now - b.t < duration);

    unwrap(wrappers);     // 실리태번이 innerHTML 을 새로 썼으면 이미 문서 밖이라 할 일 없음
    wrappers = [];
    wrapBuckets(target, hidden, text.length, now);
    observer?.takeRecords(); // 방금 우리가 한 감싸기는 다시 보지 않음
    prevText = text;
    stats.steps++;
    stats.wrapped += wrappers.length;
    stats.ms += performance.now() - t0;
}

// ───────── 붙이기 · 떼기 ─────────
function attach(el, type, streamer) {
    detach(true);
    target = el;
    duration = pickDuration();
    buckets = [];
    wrappers = [];
    // 이어 쓰기는 옛 글이 그대로 남으니 거기서부터, 새 답 · 스와이프는 처음('...' 자리)부터 전부 새 글자
    prevText = type === 'continue' ? visibleText(el, !!el.querySelector(HIDDEN)) : '';
    processor = streamer;
    lastRaw = type === 'continue' ? 0 : String(streamer?.result ?? '').length;
    observer = new MutationObserver(step);
    observer.observe(el, { childList: true, subtree: true, characterData: true });
}

/** @param {boolean} flush 마지막 걸음(끝 글자)이 아직 안 감싸졌으면 지금 감싼다 */
function detach(flush = true) {
    if (!target) return;
    const pending = observer && observer.takeRecords().length;
    if (flush && pending && target.isConnected) step();
    observer?.disconnect();
    observer = null;
    target = null;
    processor = null;
    buckets = [];
    prevText = '';
    // 페이드가 다 끝난 뒤 감싼 요소를 푼다 (그 사이 실리태번 · 번역기가 다시 그렸으면 이미 문서 밖)
    const left = wrappers;
    wrappers = [];
    if (left.length) setTimeout(() => unwrap(left), duration + 150);
}

export function startStreamFade() {
    const { eventSource, event_types } = SillyTavern.getContext();
    eventSource.on(event_types.GENERATION_STARTED, (_type, _params, dryRun) => {
        if (!dryRun) decided = false;
    });
    eventSource.on(event_types.STREAM_TOKEN_RECEIVED, () => {
        if (decided) return;
        decided = true;
        if (!wanted()) return;
        const sp = SillyTavern.getContext().streamingProcessor;
        const el = sp?.messageTextDom;
        if (!sp || sp.type === 'impersonate' || !(el instanceof HTMLElement) || !el.isConnected) return;
        attach(el, sp.type, sp);
    });
    for (const ev of [event_types.GENERATION_ENDED, event_types.GENERATION_STOPPED, event_types.MESSAGE_RECEIVED, event_types.CHAT_CHANGED]) {
        eventSource.on(ev, () => detach(true));
    }
    // 스트리밍 도중 실리태번 페이드 인을 켜면 그쪽(morphdom)이 이 요소들과 섞이지 않게 바로 뗌
    $(document).on('input', '#stream_fade_in', () => detach(false));
}

// 테스트용 (window.Salty.streamFadeState)
export function streamFadeState() {
    return { attached: !!target, wrappers: wrappers.filter(w => w.isConnected).length, buckets: buckets.length, duration, decided, ...stats };
}
