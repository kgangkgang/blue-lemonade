// 원본 omni-next(1.0.7) 의 src/log-copy-bare-fit.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(시식 창도 빼고 나서 글을 덮게 된 장식을 테마와 같은 길로 걷어요) · 바꾼 것은 아래 import 의 판 꼬리표뿐
// 로그 복사 — 1.0.7 「보일 것」 빼기 뒤 정리(11-07 사용자 「글꾸마트에서 복사해 오면 오른쪽 위 컴퓨터가 내려와 글을 덮어 · 이런 것들 없애줘」).
// 빼기(log-copy-bare.js)로 제목 · 위 글 · 아래 글이 빠지면, 틀 기준으로 자리를 잡은 떠 있는(absolute) 장식(제목 옆 아이콘 · 꼬리말 옆 스티커 …)
// 밑으로 글이 올라와 장식이 글자를 덮어요. 글자만 보고는 알 수 없어 실제로 그려 봐요:
//   폰 · 태블릿 · PC 폭 여러 개에서 빼기 전에는 글을 안 덮던 장식이 빼고 나서 글자 위를 덮으면 그 장식을 걷어요(글자가 장식 위에 오면 읽히니 그대로).
// 메시지(data-bl-msg) 안은 손대지 않아요. 화면(DOM)이 없으면(시험 · node) 받은 그대로예요.
import { dropPaths } from './log-copy-bare.js?v=20261108a';

const LETTER = /[\p{L}\p{N}]/u;
const WIDTHS = [340, 384, 440, 560, 760];   // 폰 몇 가지 · 태블릿 · PC 채팅 폭 — 한 폭이라도 새로 덮으면 걷어요
const cache = new Map();

/** 스타일이 섞이지 않는 빈 측정 칸(미리보기 iframe 과 같은 빈 문서) */
function measureFrame(doc) {
    const frame = doc.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    // 안 보이게(투명 · 화면 밖) 두되 visibility 는 쓰지 않아요 — 안쪽 문서에서 「그 점에 무엇이 맨 위에 그려졌나」를 물어야 해요
    frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:1100px;height:700px;border:0;opacity:0;pointer-events:none';
    doc.body.append(frame);
    const inner = frame.contentDocument;
    if (!inner?.body) { frame.remove(); return null; }
    inner.body.style.cssText = 'margin:0';
    const still = inner.createElement('style');   // 움직임을 멈추고(제자리에서 재요) · 누르기를 막은 장식도 「맨 위」 물음에 걸리게
    still.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;pointer-events:auto!important}';
    inner.head.append(still);
    const host = inner.createElement('div');
    inner.body.append(host);
    return { frame, host, win: frame.contentWindow };
}

/** el 에서 stop 바로 아래까지 올라가며 쌓임 자리(가장 바깥 z-index · 떠 있나) */
function layer(el, stop, win) {
    let z = null, pos = false;
    for (let e = el; e && e !== stop; e = e.parentElement) {
        const cs = win.getComputedStyle(e);
        if (cs.position === 'static') continue;
        pos = true;
        const n = Number.parseInt(cs.zIndex, 10);
        if (!Number.isNaN(n)) z = n;
    }
    return { z: z ?? 0, pos };
}
/** 그 점에서 장식이 글자보다 위에 그려지나 — 측정 칸에 물어요(잘린 곳 · 쌓임 순서를 브라우저가 판단) · 물을 수 없으면 쌓임 순서 근사 */
function seenAbove(deco, text, win, x, y) {
    const doc = win.document;
    if (typeof doc.elementsFromPoint !== 'function') return above(deco, text, win);
    let shift = 0;
    if (y < 0 || y >= win.innerHeight) { const was = win.scrollY; win.scrollTo(0, was + Math.round(y - win.innerHeight / 2)); shift = win.scrollY - was; }
    const stack = doc.elementsFromPoint(x, y - shift);
    if (shift) win.scrollTo(0, win.scrollY - shift);
    const d = stack.findIndex(e => deco.contains(e));
    if (d < 0) return false;   // 잘려서 안 보여요
    const t = stack.findIndex(e => e.contains(text));
    return t >= 0 && d < t;
}
/** 장식이 그 글자 위에 그려지나(쌓임 순서 근사) */
function above(deco, text, win) {
    let common = deco.parentElement;
    while (common && !common.contains(text)) common = common.parentElement;
    if (!common) return false;
    const d = layer(deco, common, win), t = layer(text.parentElement, common, win);
    if (d.z !== t.z) return d.z > t.z;
    if (d.pos !== t.pos) return d.pos;
    return !!(text.compareDocumentPosition(deco) & 4);   // 같은 층이면 뒤에 쓴 것이 위
}
const keyOf = el => el.tagName + '|' + (el.getAttribute('style') || '');
const pathOf = (el, host) => { const path = []; for (let e = el; e && e !== host; e = e.parentElement) path.unshift([...e.parentElement.children].indexOf(e)); return path; };

/** 넘침을 자르는 칸(overflow)으로 잘라 낸 보이는 칸 — 떠 있는 요소는 자기 기준 상자(offsetParent)부터 위쪽만 잘라요 */
function visibleRect(el, host, win, floating) {
    let r = el.getBoundingClientRect();
    let { left, top, right, bottom } = r;
    let cb = floating ? el.offsetParent : null;
    for (let e = floating ? el.parentElement : el; e && e !== host.parentElement; e = e.parentElement) {
        if (cb && e !== cb && e.contains(cb)) cb = null;
        if (cb && e !== cb) continue;
        if (cb === e) cb = null;
        const cs = win.getComputedStyle(e);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const q = e.getBoundingClientRect();
        if (cs.overflowX !== 'visible') { left = Math.max(left, q.left); right = Math.min(right, q.right); }
        if (cs.overflowY !== 'visible') { top = Math.max(top, q.top); bottom = Math.min(bottom, q.bottom); }
    }
    return { left, top, right, bottom };
}
/** 그 폭에서 글자 위를 덮는 떠 있는 장식들 — 덮인 글마다 「장식 + 글」 짝 */
function covering(m, html, width) {
    const { host, win } = m;
    host.style.width = width + 'px';
    win.scrollTo(0, 0);   // 칸 좌표는 맨 위에서 재요(가려졌나 물을 때만 잠깐 내려요)
    host.innerHTML = html;
    const decos = [];
    for (const el of host.querySelectorAll('*')) {
        if (el.tagName === 'STYLE' || el.closest('[data-bl-msg]')) continue;
        const cs = win.getComputedStyle(el);
        if ((cs.position !== 'absolute' && cs.position !== 'fixed') || cs.display === 'none' || LETTER.test(el.textContent)) continue;
        const r = visibleRect(el, host, win, true);
        if ((r.right - r.left) * (r.bottom - r.top) >= 30) decos.push({ el, r });
    }
    const out = [];
    if (!decos.length) return out;
    const inDeco = new Set(decos.map(d => d.el));
    const texts = [];
    const walk = host.ownerDocument.createTreeWalker(host, 4);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        if (!LETTER.test(t.data) || t.parentElement?.closest('style')) continue;
        let skip = false;
        for (let e = t.parentElement; e && e !== host; e = e.parentElement) if (inDeco.has(e)) { skip = true; break; }
        if (skip) continue;
        const range = host.ownerDocument.createRange();
        range.selectNodeContents(t);
        const clip = visibleRect(t.parentElement, host, win, false);
        for (const q of range.getClientRects()) {
            const r = { left: Math.max(q.left, clip.left), top: Math.max(q.top, clip.top), right: Math.min(q.right, clip.right), bottom: Math.min(q.bottom, clip.bottom) };
            if ((r.right - r.left) * (r.bottom - r.top) > 4) texts.push({ r, t });
        }
    }
    for (const { el, r } of decos) {
        const hits = new Set();
        for (const { r: q, t } of texts) {
            const w = Math.min(r.right, q.right) - Math.max(r.left, q.left);
            const h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
            if (w > 3 && h > 3 && w * h > 40 && !hits.has(t.data.trim()) && seenAbove(el, t, win, Math.max(r.left, q.left) + w / 2, Math.max(r.top, q.top) + h / 2)) hits.add(t.data.trim());
        }
        if (hits.size) out.push({ keys: [...hits].map(text => keyOf(el) + ' ¶ ' + text), path: pathOf(el, host), tag: el.tagName });
    }
    return out;
}

/**
 * @param {string} before 빼기 전 HTML(renderLog 결과)
 * @param {string} after bareLog 결과
 * @param {{ doc?: Document }} [options]
 * @returns {string} 빼고 나서 글을 덮게 된 장식을 걷은 HTML
 */
export function fitBare(before, after, { doc = globalThis.document } = {}) {
    const a = String(after ?? '');
    if (!doc?.body || !before || a === before || !/position:\s*(?:absolute|fixed)/i.test(a)) return a;
    const id = before + '\n␞\n' + a;
    if (cache.has(id)) return cache.get(id);
    let result = a;
    const m = measureFrame(doc);
    if (m) {
        try {
            const picks = new Map();
            for (const width of WIDTHS) {
                const was = new Set(covering(m, before, width).flatMap(c => c.keys));   // 빼기 전에도 있던 「장식 + 덮인 글」 짝은 틀이 원래 그렇게 생긴 것
                for (const c of covering(m, a, width)) if (c.keys.some(k => !was.has(k))) picks.set(c.path.join('.'), c);
            }
            result = dropPaths(a, [...picks.values()]);
        } catch { result = a; } finally { m.frame.remove(); }
    }
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    cache.set(id, result);
    return result;
}
