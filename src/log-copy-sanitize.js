// 로그 복사 — 붙여 넣은 글꾸 HTML(「+ 내 글꾸」)과 미리보기에서 고친 결과를 소독한다 (브라우저 DOMParser — 실행 없이 읽기만).
// 걷는 것: 실행 · 끼워 넣기 요소(script · iframe · object · embed · form · meta · link · base …), on* 속성, srcdoc · formaction,
//   javascript: · vbscript: · data:(그림 말고) 주소, style 의 expression() · behavior · -moz-binding · @import · 나쁜 url().
// 미리보기용 표시(data-f · data-bl-slot · contenteditable)도 복사 결과에서는 걷는다.
// 1.0.1 그림 부품: style 의 url('data:image/svg+xml,…') 은 svg 가 그림만일 때(log-copy-template.js safeSvgData) 남기고, 아니면 통째로 none.
//   1.1.8 큰따옴표 꼴 url("data:image/svg+xml,…")도 같은 검사로(글꾸 마트 형광펜 무늬 · 점검 1112 #3 — 전엔 140 → 88 로 지워졌어요).
import { SVG_DATA_URL, SVG_DATA_URL_DQ, safeSvgData } from './log-copy-template.js';

const DROP = 'script, iframe, frame, frameset, object, embed, applet, form, input, button, textarea, select, option, optgroup, datalist, keygen, meta, link, base, noscript, template, portal, param, audio, video, source, track, foreignObject, set, dialog';
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'background', 'poster', 'cite', 'longdesc', 'lowsrc', 'dynsrc', 'data', 'codebase', 'manifest', 'ping']);
const DROP_ATTRS = new Set(['srcdoc', 'formaction', 'contenteditable', 'spellcheck', 'autofocus', 'is', 'nonce']);
const IMAGE_DATA = /^data:image\/(?:png|gif|jpe?g|webp|avif|bmp);/i;
const BAD_CSS = /expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:|vbscript\s*:|@import|url\s*\(\s*(?!['"]?\s*(?:https?:|data:image\/(?:png|gif|jpe?g|webp|avif)|#|\/(?!\/)|\.))['"]?\s*/gi;   // 1.1.0 허용 주소 검사를 따옴표 뒤에서 — 전엔 ['"]? 가 물러나 따옴표 낀 url('https://…') · url("data:image/png…") · url('/a.png') 의 url( 이 지워져 선언이 깨졌어요

/** 주소 하나가 안전한가: http(s) · mailto · tel · # · 상대 경로 · 그림 data: 만 */
export function safeUrl(value) {
    const text = String(value ?? '').replace(/[\u0000- \u007f-\u009f]+/g, '').toLowerCase();
    if (!text) return true;
    if (IMAGE_DATA.test(text)) return true;
    const scheme = text.match(/^([a-z][a-z0-9+.-]*):/);
    if (!scheme) return true;   // 상대 경로 · #
    return ['http', 'https', 'mailto', 'tel'].includes(scheme[1]);
}

/** CSS 글 하나(style 속성 · <style> 안)에서 위험한 조각을 걷는다 */
export function safeCss(text) {
    const keep = [];
    let out = String(text ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\u0001/g, '')
        .replace(SVG_DATA_URL, (all, data) => (safeSvgData(data) ? `\u0001${keep.push(all) - 1}\u0001` : 'none'))   // 그림 부품은 잠시 맡겨 두기
        .replace(SVG_DATA_URL_DQ, (all, data) => (safeSvgData(data, { anyQuote: true }) ? `\u0001${keep.push(all) - 1}\u0001` : 'none'));   // 1.1.8 큰따옴표 꼴(마트 형광펜 무늬) — 전엔 url(" 만 지워져 선언이 깨지고 무늬가 사라졌어요
    // 걷은 뒤 다시 붙는 조각까지 — 더 걷을 게 없을 때까지(전엔 세 번만 돌아 네 겹 끼우기 @im@im@im@importportportport 가 남았어요)
    const strip = () => { for (let prev; prev !== out;) { prev = out; out = out.replace(BAD_CSS, ''); } };
    strip();
    // CSS 이스케이프로 가린 낱말(@\69mport · \75rl( …): 풀어 본 글이 걸리면 거꾸로 빗금을 전부 걷고 다시 걷어요
    if (out.includes('\\') && out.replace(/\\([0-9a-f]{1,6})\s?/gi, (all, hex) => String.fromCodePoint(Math.min(Number.parseInt(hex, 16), 0x10ffff) || 0xfffd)).replace(/\\/g, '').search(BAD_CSS) >= 0) { out = out.replace(/\\/g, ''); strip(); }
    return out.replace(/<\/?\s*style/gi, '').replace(/\u0001(\d+)\u0001/g, (_, i) => keep[Number(i)] ?? '');
}

/** 요소 나무를 그 자리에서 소독 (root 자신은 남긴다) */
export function sanitizeTree(root, { keepPreviewMarks = false } = {}) {
    for (const element of [...root.querySelectorAll(DROP)]) element.remove();
    for (const element of [...root.querySelectorAll('animate, animateMotion, animateTransform')]) {
        if (/href|on/i.test(element.getAttribute('attributeName') || '')) element.remove();
    }
    for (const element of [root, ...root.querySelectorAll('*')]) {
        for (const attr of [...element.attributes]) {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on') || DROP_ATTRS.has(name)) { element.removeAttribute(attr.name); continue; }
            if (!keepPreviewMarks && (name === 'data-f' || (name.startsWith('data-bl-') && name !== 'data-bl-egg'))) { element.removeAttribute(attr.name); continue; }   // 1.0.1 누르면 반응(data-bl-egg)은 모양이라 남겨요
            if (URL_ATTRS.has(name) && !safeUrl(attr.value)) { element.removeAttribute(attr.name); continue; }
            if (name === 'srcset' && attr.value.split(',').some(part => !safeUrl(part.trim().split(/\s+/)[0]))) { element.removeAttribute(attr.name); continue; }
            if (name === 'style') {
                const clean = safeCss(attr.value);
                if (clean !== attr.value) element.setAttribute('style', clean);
            }
            if (name === 'http-equiv') element.removeAttribute(attr.name);
        }
        if (element.tagName.toLowerCase() === 'style') element.textContent = safeCss(element.textContent);
        if (element.tagName === 'A' && element.getAttribute('target')) element.setAttribute('rel', 'noopener noreferrer');
    }
    return root;
}

/** HTML 글 → 소독한 HTML 글 */
export function sanitizeHtml(html, { keepPreviewMarks = false, doc = null } = {}) {
    const parsed = (doc ? new doc.defaultView.DOMParser() : new DOMParser()).parseFromString(`<!doctype html><html><head></head><body>${String(html ?? '')}</body></html>`, 'text/html');
    // <head> 로 올라간 <style> 은 본문 앞으로 (붙여 넣은 글꾸의 꾸밈 블록)
    const styles = [...parsed.head.querySelectorAll('style')];
    sanitizeTree(parsed.body, { keepPreviewMarks });
    const head = styles.map(style => `<style>${safeCss(style.textContent)}</style>`).join('');
    return head + parsed.body.innerHTML;
}

// ── 내 글꾸의 로그 자리 ─────────────────────────────────────

/** root 에서 element 까지의 자식 번호 길 */
export function slotPath(element, root) {
    const path = [];
    for (let node = element; node && node !== root; node = node.parentElement) {
        const parent = node.parentElement;
        if (!parent) return null;
        path.unshift([...parent.children].indexOf(node));
    }
    return path;
}
export function fromPath(root, path) {
    let node = root;
    for (const index of path ?? []) {
        node = node?.children?.[index];
        if (!node) return null;
    }
    return node === root ? null : node;
}

const PLACEHOLDER = /여기에|여기|로그|본문|내용|log|content|text here|lorem/i;
/** 자리를 아직 안 정했으면: 자리 글(「여기에 · 로그 · 본문」)이 든 가장 큰 칸 → 없으면 글이 가장 긴 칸 */
export function guessSlot(root) {
    const blocks = [...root.querySelectorAll('div, td, section, article, p, blockquote, span')].filter(el => !el.querySelector('div, td, section, article, p, blockquote'));
    const sized = el => (el.textContent || '').trim().length;
    const marked = blocks.filter(el => PLACEHOLDER.test(el.textContent || ''));
    const pick = list => list.reduce((best, el) => (!best || sized(el) > sized(best) ? el : best), null);
    return pick(marked) ?? pick(blocks) ?? root.firstElementChild ?? null;
}

// ── 갤러리: 붙여 넣은 이미지 코드 · 주소 → 그림 목록 ──
/** <img> 코드(통째로) · 이미지 주소 줄 → [{ src, alt }] (소독 뒤 http(s) · 그림 data: 만, 40장까지) */
export function imagesFromCode(text, { doc = null } = {}) {
    const raw = String(text ?? '');
    const out = [];
    const add = (src, alt = '') => { const value = String(src ?? '').trim(); if (value && /^(https?:\/\/|data:image\/(png|gif|jpe?g|webp|avif);)/i.test(value) && safeUrl(value) && !out.some(x => x.src === value) && out.length < 40) out.push({ src: value, alt: String(alt ?? '').trim().slice(0, 60) }); };
    if (/<img[\s/>]/i.test(raw)) {
        const parsed = (doc ? new doc.defaultView.DOMParser() : new DOMParser()).parseFromString(`<body>${sanitizeHtml(raw, { doc })}</body>`, 'text/html');
        for (const img of parsed.querySelectorAll('img')) add(img.getAttribute('src'), img.getAttribute('alt') || img.getAttribute('title'));
    }
    for (const line of raw.replace(/<[^>]*>/g, ' ').split(/\s+/)) if (/^https?:\/\/\S+$/i.test(line) && /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(line)) add(line);
    return out;
}
