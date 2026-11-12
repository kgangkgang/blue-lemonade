// 원본 블루레몬에이드 1.1.2(codex/release-112)의 src/log-copy-render.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(글꾸 마트 「🍽️ 시식하기」 · 「HTML 복사」가 테마 로그 복사와 같은 모양 · 같은 붙여 넣기 꼴로 내려고 써요)
// 로그 복사 — 떠 온 로그(log-copy-capture.js 의 자료)를 붙여 넣을 HTML · 마크다운 · 글로 쓴다 (DOM 없는 순수 함수 · node 로 시험)
// HTML 은 전부 인라인 style 만: class · <style> · <script> · CSS 변수 · 외부 파일 없이 (커뮤니티 편집기가 지워도 모양이 남게).
// 틀(글꾸 모양)은 log-copy-presets.js — 여기는 로그 본문(「그대로」)과 마크다운 · 글.
import { contrast, parseColor, compose } from './shared/ink-paint.js';
import { spoilerHtml } from './log-copy-spoiler.js?v=20261112a';   // 1.0.1 미리보기에서 숨긴 글을 틀을 바꿔 다시 그릴 때

export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const cleanValue = value => String(value ?? '').replace(/"/g, "'").replace(/[<>{};\\]/g, '').trim();

/** { 'font-size': '15px', … } → 'font-size:15px;…' (빈 값은 빼요) */
export function styleAttr(style) {
    return Object.entries(style ?? {})
        .filter(([key, value]) => /^[a-z-]+$/.test(key) && value !== undefined && value !== null && cleanValue(value) !== '')
        .map(([key, value]) => `${key}:${cleanValue(value)}`)
        .join(';');
}
const escAttr = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
/** 맨 바깥 태그에 표시 하나 (미리보기 전용 data-bl-* — 복사할 때 소독이 걷어요) */
export const mark = (html, attr) => html.replace(/^<([a-z]+)/, (_, name) => `<${name} ${attr}`);   // 함수 치환 — 표시 값(이름)에 $ 가 있어도 그대로
// 1.1.2 flex · grid · inline-block 칸은 첫 줄 들여쓰기를 물려받지 않게(text-indent:0) — 본문에 들여쓰기가 있으면 안쪽 이름표 · 알약 · 단추 줄 앞에 빈칸이 생겼어요(실제 글에서 확인)
const OWN_LINE = /^(inline-block|inline-flex|flex|grid|inline-grid|inline-table|table)$/;
export const tag = (name, style, inner) => {
    if (style && OWN_LINE.test(String(style.display ?? '').trim()) && style['text-indent'] == null) style = { ...style, 'text-indent': '0' };
    const attr = style ? styleAttr(style) : '';
    return `<${name}${attr ? ` style="${escAttr(attr)}"` : ''}>${inner}</${name}>`;
};


// ── 글자색은 요소마다 인라인으로 (사용자 규칙: 붙인 곳 바탕 · 글자색 · <style> 이 무엇이든 안 보이는 글자 0) ──
// 바탕을 칠한 요소든 글자만 든 요소든, color 가 없는 요소에 부모의 실제 글자색을 적어요 — 상속 · 꾸밈 블록에 기대는 글자색 0개.
const VOID_TAGS = new Set(['img', 'br', 'col', 'hr', 'input', 'meta', 'wbr', 'source', 'link']);
export function inkEverywhere(html, rootInk, { bg: rootBg = null, candidates = [], keepOwn = false } = {}) {
    // keepOwn(1.0.1 받은 글꾸 틈 템플릿): 틀이 적어 둔 글색은 바꾸지 않아요 — 그림(svg · 그러데이션) 위 글은 바탕을 몰라 잘못 고쳐지던 것. 색 없는 글만 채워요
    // 바탕도 따라가며(인라인 background-color — 반투명은 섞어서) 글자색 대비가 4.5 아래면 읽히는 색으로 바꿔요
    // (화면에서 일부러 옅게 칠한 글자 — 예: 취소선 글자 채움 55% — 도 붙인 곳에서는 안 보일 수 있어요. 사용자 규칙이 「보이는 그대로」보다 먼저)
    const stack = [{ ink: rootInk, bg: parseColor(rootBg) }];
    const pick = (bg) => {
        const list = [rootInk, ...candidates].filter(Boolean);
        return list.find(c => contrast(c, bg) >= 4.5) ?? list.reduce((best, c) => (contrast(c, bg) > contrast(best, bg) ? c : best), list[0]);
    };
    return String(html).replace(/<(\/?)([a-zA-Z][\w-]*)((?:\s[^<>]*?)?)(\/?)>/g, (all, close, name, attrs, self) => {
        const tagName = name.toLowerCase();
        if (close) { if (!VOID_TAGS.has(tagName) && stack.length > 1) stack.pop(); return all; }
        if (VOID_TAGS.has(tagName) || tagName === 'style' || tagName === 'script' || self) return all;
        const parent = stack[stack.length - 1];
        const m = attrs.match(/\sstyle="([^"]*)"/);
        const style = m?.[1] ?? '';
        const own = style.match(/(?:^|;)\s*color:\s*([^;]+)/);
        const bgValue = style.match(/(?:^|;)\s*background-color:\s*([^;]+)/)?.[1];
        const ownBg = bgValue ? parseColor(bgValue) : null;
        const bg = ownBg && ownBg.a > 0.01 ? (ownBg.a >= 0.999 || !parent.bg ? ownBg : compose(ownBg, parent.bg)) : parent.bg;
        let color = own ? own[1].trim() : parent.ink;
        const masked = own && bgValue && own[1].trim() === bgValue.trim();   // 이름 가림 칸(글자 = 바탕) 은 그대로
        if (!masked && !(keepOwn && own) && bg && color && contrast(color, bg) < 4.5) color = pick(bg);
        let next = attrs;
        // 치환은 함수 꼴로만(1.1.2) — 받은 글꾸의 style 값이 치환 글이 되면 값 속 $' · $& 가 풀려 뒤 속성 글이 따옴표 안으로 끌려와요
        if (own && color !== own[1].trim()) next = attrs.replace(m[0], () => ` style="${style.replace(own[0], () => `${own[0].startsWith(';') ? ';' : ''}color:${color}`)}"`);
        else if (!own && color) next = m ? attrs.replace(m[0], () => ` style="color:${color};${style}"`) : `${attrs} style="color:${color}"`;
        stack.push({ ink: color, bg });
        return `<${name}${next}>`;
    });
}

// ── 노드 나무 → HTML ─────────────────────────────────────────

/** inkFix: 바탕(bg)과 대비가 낮은 글자색을 팔레트 글자색(ink)으로 (메신저 말풍선) · relayout: 양쪽 맞춤 · 첫 줄 들여쓰기 빼기 (좁은 칸) */
export function nodesHtml(nodes, { inkFix = null, trimEdges = false, relayout = false } = {}) {
    const fix = (style) => {
        if (!inkFix || !style) return style;
        const out = { ...style };
        for (const key of ['color', 'text-decoration-color']) if (out[key] && contrast(out[key], inkFix.bg) < 4.5) out[key] = inkFix.ink;
        delete out['background-color'];   // 문단 바탕(카드 등)은 말풍선 면이 대신한다 — 글 조각의 띠(span)는 그대로
        return out;
    };
    const one = (node, edge) => {
        if (node.t === 'text') return esc(node.text);
        if (node.t === 'br') return '<br>';
        if (node.t === 'hr') return tag('div', { ...node.style, height: '0', 'max-width': '100%' }, '');
        let style = node.style;
        if (node.block) {
            style = inkFix ? fix(style) : { ...style };
            if (edge?.first) delete style['margin-top'];
            if (edge?.last) delete style['margin-bottom'];
            if (relayout && style['text-align'] === 'justify') delete style['text-align'];   // 좁은 칸에 다시 놓을 때 양쪽 맞춤은 낱말 사이가 벌어져요
            if (relayout === true) delete style['text-indent'];   // 말풍선 · 알림은 첫 줄 들여쓰기도 빼요
            if (node.tag === 'ul' || node.tag === 'ol') style = { margin: '0', 'padding-left': style['padding-left'] || '1.5em', ...style };
        } else if (inkFix && style?.color && contrast(style.color, inkFix.bg) < 4.5) style = { ...style, color: inkFix.ink };
        const inner = node.children.map((child, i) => one(child, node.block && edge ? { first: edge.first && i === 0, last: edge.last && i === node.children.length - 1 } : null)).join('');
        if (node.kind === 'spoiler') return spoilerHtml(inner, node.sp, !node.block);   // 1.0.1 미리보기에서 숨긴 글(log-copy-spoiler.js previewModel) — sp 는 시트가 지금 팔레트로 채워요
        return tag(node.tag === 'ul' || node.tag === 'ol' || node.tag === 'li' ? node.tag : node.block ? 'div' : 'span', style, inner);
    };
    return nodes.map((node, i) => one(node, trimEdges ? { first: i === 0, last: i === nodes.length - 1 } : null)).join('');
}

export const baseFont = font => ({ color: font.color, 'font-family': font['font-family'], 'font-size': font['font-size'], 'font-weight': font['font-weight'], 'font-style': font['font-style'] === 'italic' ? 'italic' : undefined, 'letter-spacing': font['letter-spacing'], 'line-height': font['line-height'], 'word-break': font['word-break'] || undefined });
export const lineGap = font => (/px$/.test(font['line-height'] ?? '') ? font['line-height'] : '1.6em');

/** 틀 없이 보이는 그대로 — 채팅 바탕 · 글자 모양 그대로의 상자 하나. names: 이름 줄, gap: 메시지 사이 빈 줄 */
export function logHtml(model, { names = true, gap = true, frameless = true, relayout = false } = {}) {
    const body = model.messages.map((message, i) => {
        const last = i === model.messages.length - 1;
        const name = names && message.name ? mark(tag('div', { ...message.nameStyle, 'line-height': '1.4', margin: '0 0 4px' }, esc(message.name)), 'data-bl-name') : '';
        const wrap = { ...(message.bubble ? { ...message.bubble, padding: '8px 12px' } : {}), margin: last ? '0' : `0 0 ${gap ? lineGap(message.font) : '8px'}` };
        return mark(tag('div', wrap, name + nodesHtml(message.nodes, { trimEdges: true, relayout })), 'data-bl-msg');
    }).join('');
    const box = { 'box-sizing': 'border-box', 'max-width': '100%', 'background-color': model.base.bg, ...baseFont(model.base), padding: '12px 16px', 'text-align': 'left', 'overflow-wrap': 'anywhere' };
    if (frameless) box['border-radius'] = '12px';
    return tag('div', box, body);
}

// ── 마크다운 · 글 ───────────────────────────────────────────

const mdEscape = text => text.replace(/([\\`*_~[\]])/g, '\\$1').replace(/^(\s*)([#>+-]|\d+\.)(\s)/, '$1\\$2$3');

function inlineText(nodes, md) {
    return nodes.map((node) => {
        if (node.t === 'text') return md ? mdEscape(node.text) : node.text;
        if (node.t === 'br') return md ? '  \n' : '\n';
        if (node.t !== 'el') return '';
        let inner = inlineText(node.children, md);
        if (!md || !inner.trim()) return inner;
        const kinds = String(node.kind ?? '').split(' ');
        const lead = inner.match(/^\s*/)[0], trail = inner.match(/\s*$/)[0];
        let core = inner.trim();
        if (kinds.includes('spoiler')) return `${lead}(숨긴 글: ${core.replace(/\s*\n+\s*/g, ' / ')})${trail}`;   // 마크다운엔 표준 스포일러가 없어요 — 사실대로
        if (kinds.includes('code')) core = `\`${core.replace(/\\([\\`*_~[\]])/g, '$1').replace(/`/g, 'ˋ')}\``;
        if (kinds.includes('del')) core = `~~${core}~~`;
        if (kinds.includes('em')) core = `*${core}*`;
        if (kinds.includes('strong')) core = `**${core}**`;
        inner = lead + core + trail;
        return inner;
    }).join('');
}

/** 블록 나무 → 문단 목록 (각 문단은 글 한 덩이) */
function blocksText(nodes, md, depth = 0) {
    const out = [];
    let run = [];
    const flush = () => { const text = inlineText(run, md).replace(/[ \t]+\n/g, md ? '  \n' : '\n').trim(); if (text) out.push(text); run = []; };
    for (const node of nodes) {
        if (node.t === 'hr') { flush(); out.push(md ? '---' : '―――'); continue; }
        if (node.t !== 'el' || !node.block) { run.push(node); continue; }
        flush();
        const inner = blocksText(node.children, md, depth + 1);
        if (!inner.length) continue;
        const kind = node.kind;
        if (md && kind === 'quote') out.push(inner.join('\n\n').split('\n').map(line => (line ? `> ${line}` : '>')).join('\n'));
        else if (md && /^h[1-6]$/.test(kind)) out.push(`${'#'.repeat(Number(kind[1]))} ${inner.join(' ')}`);
        else if (kind === 'ul' || kind === 'ol') {
            const items = node.children.filter(child => child.t === 'el');
            out.push(items.map((item, i) => `${kind === 'ol' ? `${i + 1}.` : md ? '-' : '·'} ${blocksText(item.children, md, depth + 1).join(' ')}`).join('\n'));
        } else if (md && kind === 'pre') out.push(`\`\`\`\n${inlineText(node.children, false)}\n\`\`\``);
        else out.push(...inner);
    }
    flush();
    return out;
}

/** 마크다운: 색은 못 따라오니 굵게 · 기울임 · 취소선 · 인용 · 목록 · 제목만 */
export function logMarkdown(model, { names = true, gap = true } = {}) {
    return model.messages.map((message) => {
        const body = blocksText(message.nodes, true).join('\n\n');
        return (names && message.name ? `**${mdEscape(message.name)}**\n\n` : '') + body;
    }).join(gap ? '\n\n&nbsp;\n\n' : '\n\n') + '\n';
}

/** 글만 (서식 없는 칸에 붙일 때) */
export function logText(model, { names = true, gap = true } = {}) {
    return model.messages.map((message) => {
        const body = blocksText(message.nodes, false).join('\n');
        return (names && message.name ? `${message.name}\n` : '') + body;
    }).join(gap ? '\n\n' : '\n') + '\n';
}
