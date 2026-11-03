// 로그 복사 — 단어 바꾸기 · 이름 숨기기 (떠 온 로그 자료를 고쳐요 · DOM 없는 순수 함수 · node 로 시험)
// 서식은 그대로: 글 조각(형광펜 · 색 칸) 경계에 걸친 낱말도 찾아, 바뀐 글은 그 낱말이 시작한 조각에 넣고 나머지 조각에서는 그 부분만 빼요.
// 문단 · 줄바꿈 너머로는 찾지 않아요. 한국어 조사는 바꾼 말의 받침에 맞춰요(번역기 용어집의 particleFor 를 그대로).
// 이름 숨기기는 채팅 캡처 「로그 공유 · 이름 가림」 설정(captureTools.redact · names · mask · maskStyles)을 같이 써요 — 원래 글자는 결과에 남지 않아요.
import { particleFor } from './addons/translator/glossary-match.js';
import { parseColor, contrast } from './shared/ink-paint.js';

const escape = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HANGUL_TAIL = /^[가-힣]{1,5}/;
const BREAK = '\u0000';

// 채팅 캡처 가림 모양(capture-privacy.js paintMasks)의 같은 색 — 글 로그에서는 모양 대신 같은 색 칸 · 기호로
const MASK_FILL = { white: '#fafafa', black: '#111318' };
const tapeFill = dark => (dark ? '#b5cfe5' : '#f7dc84');

/** 메시지 노드 나무의 글 조각들 — 문단 · 줄바꿈 자리에 끊김 표시 */
function textSlots(nodes) {
    const slots = [];
    const walk = (list) => {
        for (const node of list) {
            if (node.t === 'text') slots.push({ holder: list, node });
            else if (node.t === 'br' || node.t === 'hr') slots.push(null);
            else if (node.t === 'el') {
                if (node.block) slots.push(null);
                walk(node.children ?? []);
                if (node.block) slots.push(null);
            }
        }
    };
    walk(nodes);
    return slots;
}

/**
 * 한 메시지 글에 바꾸기 적용. edits(text, at) → [{ start, end, replace: string | node }]
 * replace 가 노드면(가림 칸) 그 자리에 넣어요.
 */
function applyEdits(nodes, find) {
    const slots = textSlots(nodes);
    let text = '';
    const spans = [];
    for (const slot of slots) {
        if (!slot) { text += BREAK; continue; }
        spans.push({ ...slot, start: text.length, end: text.length + slot.node.text.length });
        text += slot.node.text;
    }
    const edits = find(text);
    let count = 0;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
        const touched = spans.filter(s => s.start < edit.end && s.end > edit.start);
        if (!touched.length) continue;
        count++;
        // 뒤 조각부터: 걸친 부분만 빼요
        for (const span of touched.slice(1).reverse()) {
            const from = Math.max(edit.start, span.start) - span.start, to = Math.min(edit.end, span.end) - span.start;
            span.node.text = span.node.text.slice(0, from) + span.node.text.slice(to);
        }
        const first = touched[0];
        const from = edit.start - first.start, to = Math.min(edit.end, first.end) - first.start;
        const before = first.node.text.slice(0, from), after = first.node.text.slice(to);
        if (typeof edit.replace === 'string') first.node.text = before + edit.replace + after;
        else {
            const at = first.holder.indexOf(first.node);
            const parts = [before ? { t: 'text', text: before } : null, edit.replace, after ? { t: 'text', text: after } : null].filter(Boolean);
            first.holder.splice(at, 1, ...parts);
        }
    }
    // 빈 글 조각 · 빈 인라인 요소는 걷어요
    const prune = (list) => {
        for (let i = list.length - 1; i >= 0; i--) {
            const node = list[i];
            if (node.t === 'text' && !node.text) list.splice(i, 1);
            else if (node.t === 'el') { prune(node.children ?? []); if (!node.block && !node.children.length && !node.mask) list.splice(i, 1); }
        }
    };
    prune(nodes);
    return count;
}

/** 찾을 말 → 바꿀 말 (대소문자 무시 · 긴 것 먼저 · 겹치지 않게) + 바로 뒤 조사는 바꾼 말 받침에 맞춤 */
function ruleFinder(rules) {
    const list = rules.filter(r => r && String(r.from ?? '').trim()).map(r => ({ from: String(r.from).trim(), to: String(r.to ?? '') }))
        .sort((a, b) => b.from.length - a.from.length);
    if (!list.length) return null;
    const pattern = new RegExp(list.map(r => escape(r.from)).join('|'), 'giu');
    const byKey = new Map(list.map(r => [r.from.toLowerCase(), r.to]));
    return (text) => {
        const out = [];
        for (const m of text.matchAll(pattern)) {
            const to = byKey.get(m[0].toLowerCase()) ?? '';
            let end = m.index + m[0].length, replace = to;
            const tail = text.slice(end).match(HANGUL_TAIL)?.[0];
            if (tail && to) {
                const fixed = particleFor(to, tail);
                if (fixed !== tail) { replace = to + fixed; end += tail.length; }
            }
            out.push({ start: m.index, end, replace });
        }
        return out;
    };
}

/** 가림 하나 — 모양(capture mask)마다 같은 뜻의 글 칸. 원래 글자는 넣지 않아요 */
export function maskNode(name, { mask = 'auto', style = {}, dark = false, word = '○○' } = {}) {
    const n = Math.max(2, [...String(name)].length);
    if (mask === 'mosaic') return { t: 'text', text: '▒'.repeat(n) };
    if (mask === 'white' || mask === 'black' || mask === 'tape') {
        const fill = style.customColor && parseColor(style.color) ? style.color : mask === 'tape' ? tapeFill(dark) : MASK_FILL[mask];
        return { t: 'el', block: false, tag: 'span', kind: null, mask: true, style: { 'background-color': fill, color: fill, 'border-radius': mask === 'tape' ? '2px' : '4px' }, children: [{ t: 'text', text: '　'.repeat(n) }] };
    }
    return { t: 'text', text: String(word || '○○') };
}
/** 글자로만 쓰는 자리(틀 칸 · 그림 설명)의 가림 글 — word 는 사용자가 정한 가림 글자(기본 ○○) */
export const maskText = (name, mask, word = '○○') => (mask === 'mosaic' ? '▒'.repeat(Math.max(2, [...String(name)].length)) : String(word || '○○'));

function nameFinder(names, options) {
    const list = [...new Set(names.map(n => String(n ?? '').trim()).filter(n => n.length >= 1))].sort((a, b) => b.length - a.length);
    if (!list.length) return null;
    const pattern = new RegExp(list.map(escape).join('|'), 'giu');
    return text => [...text.matchAll(pattern)].map(m => ({ start: m.index, end: m.index + m[0].length, replace: maskNode(m[0], options) }));
}

/**
 * @param {object} model captureLog() 결과 (고치지 않아요 — 고친 사본을 돌려줘요)
 * @param {{ rules?: { from: string, to: string }[], hide?: { names: string[], mask?: string, style?: object } | null }} options
 * @returns {{ model: object, replaced: number, hidden: number }}
 */
export function transformLog(model, { rules = [], hide = null } = {}) {
    const out = structuredClone(model);
    let replaced = 0, hidden = 0;
    const replace = ruleFinder(rules);
    const dark = (() => { const bg = parseColor(model?.base?.bg); return bg ? contrast(bg, { r: 0, g: 0, b: 0, a: 1 }) < contrast(bg, { r: 255, g: 255, b: 255, a: 1 }) : false; })();
    const word = String(hide?.word || '○○');
    const mask = hide ? nameFinder(hide.names ?? [], { mask: hide.mask, style: hide.style ?? {}, dark, word }) : null;
    const names = hide ? new Set((hide.names ?? []).map(n => String(n).trim().toLowerCase()).filter(Boolean)) : null;
    const rewriteText = (text) => {
        let value = String(text ?? '');
        if (replace) for (const e of replace(value).sort((a, b) => b.start - a.start)) value = value.slice(0, e.start) + e.replace + value.slice(e.end);
        if (mask) {
            const finder = nameFinder(hide.names ?? [], { mask: 'auto', word });
            for (const e of (finder?.(value) ?? []).sort((a, b) => b.start - a.start)) value = value.slice(0, e.start) + maskText(value.slice(e.start, e.end), hide.mask, word) + value.slice(e.end);
        }
        return value;
    };
    for (const message of out.messages) {
        if (replace) replaced += applyEdits(message.nodes, replace);
        if (mask) hidden += applyEdits(message.nodes, mask);
        const name = message.name;
        if (name && (replace || mask)) {
            // 11-03: 숨긴 이름이 화자 이름 줄 자체면 ○○ 로 바꾸지 않고 줄을 비워요(사용자 제보: 카드 제목 · 말풍선 위에 ○○ 가 늘 떠 있던 것) — 본문 속 이름만 가림 글자로
            const next = names?.has(name.trim().toLowerCase()) ? '' : rewriteText(name);
            if (next !== name) { message.name = next; if (names?.has(name.trim().toLowerCase())) hidden++; }
        }
    }
    // 틀 칸 · 그림 alt 도 같은 말로 — 부제목 · 꼬리 · 추가 정보나 그림 설명에 이름이 남지 않게요
    const rewriteFields = fields => Object.fromEntries(Object.entries(fields ?? {}).map(([key, value]) => [key, typeof value === 'string' ? rewriteText(value) : value]));
    const rewriteImages = images => (images ?? []).map(image => ({ ...image, alt: rewriteText(image.alt) }));
    const dropOrRewrite = value => (names?.has(String(value ?? '').trim().toLowerCase()) ? '' : rewriteText(value));   // 제목 · 보낸 이 칸이 숨긴 이름 그 자체면 비움
    if (replace || mask) { out.chatName = dropOrRewrite(out.chatName); out.userName = dropOrRewrite(out.userName); if (Array.isArray(out.images)) out.images = rewriteImages(out.images); }
    return { model: out, replaced, hidden, rewriteText, rewriteFields, rewriteImages };
}

// ── 고른 에이드로 역할 색 다시 계산 ─────────────────────────
// 화면 팔레트의 역할 색(본문 · 대사 · 속마음 · 강조 · 보조 · 포인트 · 형광펜 · 면 · 선 …)과 같은 색만 고른 팔레트의 같은 역할 색으로 바꿔요.
// 맞는 역할이 없는 색(글자 모양 설정에서 직접 고른 고정 색 등)은 그대로 두고, 새 바탕에서 대비가 3 아래로 떨어지는 글자색만 그 팔레트 본문색으로.
const near = (a, b, tol = 6) => a && b && Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol && Math.abs((a.a ?? 1) - (b.a ?? 1)) <= 0.03;
const rgbText = c => (c.a >= 0.999 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.round(c.a * 1000) / 1000})`);

/**
 * @param {object} model
 * @param {Record<string, string>} from 화면 팔레트 역할 색 (palettes.js TOKEN_KEYS)
 * @param {Record<string, string>} to 고른 팔레트 역할 색
 */
export function recolorLog(model, from, to) {
    const out = structuredClone(model);
    const pairs = Object.keys(from).filter(key => to[key]).map(key => [parseColor(from[key]), parseColor(to[key]), key]).filter(([a, b]) => a && b);
    const swap = (value) => String(value).replace(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi, (hit) => {
        const c = parseColor(hit);
        const pair = c && pairs.find(([a]) => near(a, c));
        return pair ? rgbText(pair[1]) : hit;
    });
    const bgTo = parseColor(to.bg) ?? parseColor(to.surface);
    const ink = to.text;
    const fixStyle = (style, bg) => {
        if (!style) return style;
        for (const key of Object.keys(style)) if (/color|background|border|shadow/.test(key) && typeof style[key] === 'string') style[key] = swap(style[key]);
        for (const key of ['color', 'text-decoration-color']) if (style[key] && contrast(style[key], bg) < 4.5) style[key] = ink;
        return style;
    };
    const walk = (nodes, bg) => { for (const node of nodes ?? []) { if (node.style && !node.mask) fixStyle(node.style, node.style['background-color'] && parseColor(node.style['background-color'])?.a >= 0.999 ? node.style['background-color'] : bg); if (node.children) walk(node.children, bg); } };
    // 바탕: 화면 바탕이면 새 바탕, 메시지 면(겹친 옅은 면)은 그 팔레트의 한 단계 밝은 면
    out.base.bg = bgTo ? rgbText(bgTo) : swap(out.base.bg);   // 채팅 바탕은 그 팔레트 바탕 역할
    fixStyle(out.base, out.base.bg);
    for (const message of out.messages) {
        if (message.bubble?.['background-color']) {
            const c = parseColor(message.bubble['background-color']);
            const pair = c && pairs.find(([a]) => near(a, c));
            message.bubble = { ...message.bubble, 'background-color': pair ? rgbText(pair[1]) : to.raised ?? message.bubble['background-color'] };
        }
        const bg = message.bubble?.['background-color'] ?? out.base.bg;
        message.font = fixStyle({ ...message.font }, bg);
        if (message.nameStyle) message.nameStyle = fixStyle({ ...message.nameStyle }, bg);
        walk(message.nodes, bg);
    }
    return out;
}
