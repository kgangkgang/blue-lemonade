// 로그 복사 — 고른 채팅을 화면에 보이던 모양 그대로 떠 온다 (log-copy.js 가 고른 글 도구 줄에서 부른다 · 시작 그래프 밖)
// 대사 색 · 형광펜 띠 · 속마음 기울기 · 글꼴 · 자간은 #chat 안에서만 먹는 테마 · 프리셋 규칙이라 HTML 을 그대로 복사하면 다 빠진다.
// 그래서 고른 범위의 요소마다 원래 자리의 계산된 모양(getComputedStyle)을 읽어 값으로 적어 둔다 → log-copy-render.js 가 인라인 style 로 쓴다.
// 결과는 DOM 이 없는 순수 자료(메시지 → 노드 나무)라 단위 시험이 같은 모양을 바로 만든다.
import { parseColor, cssColor, svgPaint, pillSpan, bandImage, textInk, compose } from './shared/ink-paint.js';
import { chatTimeMs } from './chat-organizer-core.js';

const SKIP = 'script, style, template, textarea, input, select, button, iframe, svg, canvas, video, audio, img, picture, noscript, object, embed, .mes_buttons, .mes_edit_buttons, .ss-slot, .custom-ss-slot, .ss-msgcard';   // 끝 셋: 상태창 확장이 답 글 끝에 다는 변동 칩 칸(글이 아니라 표시 — 복사물에 「체력 −12」 같은 칩 글자가 섞였어요)
// 상속되는 글자 모양 — 문단마다 다시 적는다 (받는 편집기의 CSS 가 span · div 에 글꼴을 걸어도 이기도록)
const FONT_KEYS = ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'line-height', 'word-break'];   // word-break: 한국어 줄 끊김(화면 그대로 — keep-all 을 덧대면 양쪽 맞춤 줄의 낱말 사이가 벌어져요)
const GENERIC = /(^|,)\s*(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace)\s*$/i;
const SERIFISH = /batang|myeongjo|myungjo|serif|명조|바탕|mincho|song/i;

/** 화면 글꼴 이름 그대로 + 일반 대체 글꼴 (받는 쪽에 그 글꼴이 없을 때) · 큰따옴표는 홑따옴표로 (style="…" 안에 들어간다) */
export function fontStack(value) {
    let stack = String(value ?? '').replace(/"/g, "'").replace(/[<>;{}]/g, '').trim();
    if (!stack) stack = 'sans-serif';
    if (!GENERIC.test(stack)) stack += SERIFISH.test(stack.split(',')[0]) ? ', serif' : ', sans-serif';
    return stack;
}

const px = value => {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? `${Math.round(n * 100) / 100}px` : '';
};
const lineHeight = value => (value === 'normal' ? 'normal' : px(value) || 'normal');

/**
 * @param {{ range: Range, roots: Element[] }} target 고른 글 (src/selection-bar.js)
 * @param {{ context?: object }} [options] context: SillyTavern.getContext() (메시지 시각 · 이름 · 채팅 이름)
 */
export function captureLog(target, { context = globalThis.SillyTavern?.getContext?.() } = {}) {
    const range = target?.range;
    const roots = (target?.roots ?? []).filter(root => root?.isConnected);
    if (!range || !roots.length) return null;
    const doc = roots[0].ownerDocument;
    const view = doc.defaultView;
    const computed = new Map();
    const cs = (element, pseudo) => {
        const key = pseudo ? `${pseudo}` : '';
        let bag = computed.get(element);
        if (!bag) { bag = {}; computed.set(element, bag); }
        return bag[key] ??= view.getComputedStyle(element, pseudo || null);
    };
    const isInline = style => style.display.startsWith('inline') || style.display === 'contents' || style.display.startsWith('ruby');

    /** 요소 뒤에 실제로 보이는 바탕색 — 위로 올라가며 겹친 바탕색을 섞는다 (그림 바탕은 색만).
     *  상자를 덮는 ::before · ::after 바탕(테마의 내 메시지 옅은 면 같은 것)도 그 상자 바탕 위에 한 겹으로 */
    const cover = (node, which) => {
        const style = cs(node, which);
        if (!style.content || style.content === 'none' || style.content === 'normal' || !/absolute|fixed/.test(style.position)) return null;
        const color = parseColor(style.backgroundColor);
        if (!color || color.a <= 0.01) return null;
        const width = Number.parseFloat(style.width), height = Number.parseFloat(style.height);
        return width >= node.clientWidth * 0.8 && height >= node.clientHeight * 0.8 ? color : null;
    };
    const backdrop = (element) => {
        const stack = [];
        for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
            const own = [];
            const color = parseColor(cs(node).backgroundColor);
            if (color && color.a > 0.01) own.push(color);
            for (const which of ['::before', '::after']) { const layer = cover(node, which); if (layer) own.push(layer); }
            stack.push(own);
            if (color && color.a >= 0.999) break;
        }
        const root = parseColor(view.getComputedStyle(doc.documentElement).getPropertyValue('--salty-bg')) ?? { r: 255, g: 255, b: 255, a: 1 };
        return cssColor(stack.reverse().flat().reduce((under, over) => compose(over, under), { ...root, a: 1 }));
    };

    const fontOf = (style) => {
        const ink = textInk(style);
        return {
            color: ink ? cssColor(ink) : '',
            'font-family': fontStack(style.fontFamily),
            'font-size': px(style.fontSize),
            'font-weight': String(Number.parseInt(style.fontWeight, 10) || 400),
            'font-style': style.fontStyle === 'normal' ? 'normal' : 'italic',
            'letter-spacing': style.letterSpacing === 'normal' ? 'normal' : px(style.letterSpacing) || 'normal',
            'line-height': lineHeight(style.lineHeight),
            'word-break': /^(normal|keep-all|break-all|break-word)$/.test(style.wordBreak) ? style.wordBreak : 'normal',
        };
    };

    /** 글을 감싼 인라인 요소의 띠 (꽉 찬 바탕 · 형광펜 그림 · 강조 아래 띠) — bookmarks/excerpt-capture.js 와 같은 읽기 */
    const band = (element, style) => {
        const shaped = (color, span, size, positionY) => {
            const part = span?.pill ? pillSpan(size, positionY) : span;
            const image = part ? bandImage(color, part.from, part.to) : '';
            return image ? { 'background-image': image } : { 'background-color': color };
        };
        if (/text/.test(style.webkitBackgroundClip || style.backgroundClip || '')) return null;
        const mask = [style.webkitMaskImage, style.maskImage].find(value => value && value !== 'none') ?? '';
        const color = parseColor(style.backgroundColor);
        if (color && color.a > 0.02) {
            const paint = mask ? svgPaint(mask) : null;
            if (!paint) return { 'background-color': cssColor(color) };
            return shaped(cssColor(color, color.a * (paint.opacity ?? 0.4)), paint.span, style.webkitMaskSize || style.maskSize, style.webkitMaskPositionY || style.maskPosition);
        }
        const image = style.backgroundImage;
        if (image && image !== 'none' && !element.matches('del, s, strike')) {
            if (image.includes('data:image/svg+xml')) {
                const paint = svgPaint(image);
                if (paint?.color) return shaped(cssColor(paint.color, paint.color.a * (paint.opacity ?? 1)), paint.span, style.backgroundSize, style.backgroundPositionY);
                const marker = parseColor(style.getPropertyValue('--salty-marker'));
                if (marker && marker.a > 0.02) return shaped(cssColor(marker, Math.min(marker.a, 0.6)), paint?.span, style.backgroundSize, style.backgroundPositionY);
            } else if (/^linear-gradient\(/.test(image) && !/url\(/i.test(image)) return { 'background-image': image.replace(/"/g, "'") };
        }
        const shadow = style.boxShadow;
        if (shadow && shadow !== 'none' && /inset/.test(shadow)) {
            const hit = shadow.match(/^(rgba?\([^)]*\))\s+0px\s+(-[\d.]+)px\s+0px(?:\s+0px)?\s+inset$/);
            const ink = hit && parseColor(hit[1]);
            const height = element.getClientRects()[0]?.height;
            if (ink && ink.a > 0.02 && height > 0) {
                const imageBand = bandImage(cssColor(ink), 100 - Math.min(100, (-Number(hit[2]) / height) * 100), 100);
                if (imageBand) return { 'background-image': imageBand };
            }
        }
        return null;
    };

    const borders = (style) => {
        const out = {};
        for (const side of ['top', 'right', 'bottom', 'left']) {
            const width = Number.parseFloat(style[`border${side[0].toUpperCase()}${side.slice(1)}Width`]);
            const kind = style[`border${side[0].toUpperCase()}${side.slice(1)}Style`];
            const color = parseColor(style[`border${side[0].toUpperCase()}${side.slice(1)}Color`]);
            if (width > 0 && kind !== 'none' && kind !== 'hidden' && color && color.a > 0.02) out[`border-${side}`] = `${px(width)} ${kind} ${cssColor(color)}`;
        }
        return out;
    };
    const box = (style, keys) => {
        const out = {};
        for (const key of keys) {
            const value = px(style.getPropertyValue(key));
            if (value && value !== '0px') out[key] = value;
        }
        return out;
    };

    /** 이 요소에 적을 모양 — 상속값(inh)과 같은 것은 빼고, 문단에는 글자 모양을 늘 적는다 */
    const styleOf = (element, style, block, inh, cutStart) => {
        const out = {};
        const font = fontOf(style);
        for (const key of FONT_KEYS) {
            if (!font[key]) continue;
            if (block || font[key] !== inh[key]) out[key] = font[key];
        }
        const lines = new Set();
        if (element.matches('del, s, strike')) lines.add('line-through');
        for (const word of String(style.textDecorationLine || '').split(/\s+/)) if (/^(underline|overline|line-through)$/.test(word)) lines.add(word);
        if (lines.size) {
            out['text-decoration-line'] = [...lines].join(' ');
            const color = parseColor(style.textDecorationColor);
            if (color && color.a > 0.05 && cssColor(color) !== font.color) out['text-decoration-color'] = cssColor(color);
        }
        if (style.textShadow && style.textShadow !== 'none') out['text-shadow'] = style.textShadow.replace(/"/g, "'");
        if (block) {
            if (element.matches('li')) Object.assign(out, { display: 'list-item' });
            Object.assign(out, box(style, ['margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left']), borders(style));
            const color = parseColor(style.backgroundColor);
            if (color && color.a > 0.02) out['background-color'] = cssColor(color);
            if (out['background-color'] || Object.keys(out).some(key => key.startsWith('border-'))) {
                const radius = px(style.borderTopLeftRadius);
                if (radius && radius !== '0px') out['border-radius'] = radius;
            }
            if (style.textAlign && !/^(start|left|-webkit-auto)$/.test(style.textAlign)) out['text-align'] = style.textAlign === 'end' ? 'right' : style.textAlign;
            const indent = px(style.textIndent);
            if (!cutStart && indent && indent !== '0px') out['text-indent'] = indent;
            if (/^(pre|pre-wrap|break-spaces)$/.test(style.whiteSpace)) out['white-space'] = 'pre-wrap';
            if (element.matches('ul, ol')) out['list-style-type'] = style.listStyleType || (element.matches('ol') ? 'decimal' : 'disc');
        } else {
            Object.assign(out, band(element, style));
            if (out['background-color'] || out['background-image']) {
                Object.assign(out, box(style, ['padding-left', 'padding-right']));
                const radius = px(style.borderTopLeftRadius);
                if (radius && radius !== '0px') out['border-radius'] = radius;
            }
            if (/^(sub|super)$/.test(style.verticalAlign)) out['vertical-align'] = style.verticalAlign;
            if (style.fontFamily && /mono|code|courier|consol/i.test(style.fontFamily) && element.matches('code, kbd, samp')) out['font-family'] = fontStack(style.fontFamily);
        }
        return out;
    };

    /** 마크다운으로 옮길 때 쓰는 뜻 (색은 못 옮기니 굵게 · 기울임 · 인용 · 목록 · 제목만) */
    const kindOf = (element, style, block, base) => {
        const tag = element.tagName;
        if (block) {
            if (/^H[1-6]$/.test(tag)) return tag.toLowerCase();
            if (tag === 'BLOCKQUOTE') return 'quote';
            if (tag === 'LI') return 'li';
            if (tag === 'UL' || tag === 'OL') return tag.toLowerCase();
            if (tag === 'PRE') return 'pre';
            return 'p';
        }
        if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP') return 'code';
        const kinds = [];
        if ((Number.parseInt(style.fontWeight, 10) || 400) - base.weight >= 200) kinds.push('strong');
        if (style.fontStyle !== 'normal' && !base.italic) kinds.push('em');
        if (element.matches('del, s, strike')) kinds.push('del');
        return kinds.join(' ') || null;
    };

    /** ::before · ::after 의 글자 (테마 · 프리셋이 따옴표 · 기호를 그려 넣은 것). 그 요소의 시작 · 끝이 고른 범위 안일 때만 */
    const pseudo = (element, which, inh) => {
        const style = cs(element, which);
        const content = style.content;
        if (!content || content === 'none' || content === 'normal') return null;
        const text = content.match(/^"((?:[^"\\]|\\.)*)"$/)?.[1]?.replace(/\\(.)/g, '$1');
        if (!text || !text.trim() || style.display === 'none') return null;
        const inside = which === '::before' ? range.comparePoint(element, 0) >= 0 : range.comparePoint(element, element.childNodes.length) <= 0;
        if (!inside) return null;
        const font = fontOf(style);
        const own = {};
        for (const key of FONT_KEYS) if (font[key] && font[key] !== inh[key]) own[key] = font[key];
        return { t: 'el', block: false, tag: 'span', kind: null, style: own, children: [{ t: 'text', text }] };
    };

    const rendered = (element, style) => {
        if (style.display === 'none') return false;
        if (style.display !== 'contents' && element.tagName !== 'BR' && typeof element.checkVisibility === 'function' && !element.checkVisibility()) return false;
        return true;
    };

    // 시작 글자가 문단 가운데면 그 문단의 첫 줄 들여쓰기는 빼야 한다 (고른 글은 그 줄 처음이 아니다)
    const cutBlocks = new Set();
    for (let node = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement; node && !node.matches?.('#chat'); node = node.parentElement) {
        try {
            const before = doc.createRange();
            before.setStart(node, 0);
            before.setEnd(range.startContainer, range.startOffset);
            if (before.toString().trim()) cutBlocks.add(node);
        } catch { /* 범위 밖 */ }
        if (node.classList?.contains('mes_text')) break;
    }

    const walk = (parent, out, inh, base) => {
        for (const node of parent.childNodes) {
            if (!range.intersectsNode(node)) continue;
            if (node.nodeType === 3) {
                let text = node.data;
                if (node === range.endContainer) text = text.slice(0, range.endOffset);
                if (node === range.startContainer) text = text.slice(range.startOffset);
                if (!text) continue;
                const style = cs(parent);
                if (style.visibility !== 'visible' || style.userSelect === 'none') continue;
                const keep = /^(pre|pre-wrap|pre-line|break-spaces)$/.test(style.whiteSpace);
                if (!keep) {
                    if (!text.trim() && /\n/.test(text)) continue;   // 문단 사이 줄바꿈 들여쓰기
                    text = text.replace(/[ \t\r\n\f]+/g, ' ');
                }
                out.push({ t: 'text', text });
                continue;
            }
            if (node.nodeType !== 1 || node.matches(SKIP)) continue;
            const style = cs(node);
            if (!rendered(node, style)) continue;
            if (node.tagName === 'BR') { out.push({ t: 'br' }); continue; }
            if (node.tagName === 'HR') {
                const color = parseColor(style.borderTopColor);
                out.push({ t: 'hr', style: { 'border-top': `1px solid ${color ? cssColor(color) : 'currentColor'}`, ...box(style, ['margin-top', 'margin-bottom']) } });
                continue;
            }
            if (style.display === 'contents') { walk(node, out, inh, base); continue; }
            const block = !isInline(style);
            const own = styleOf(node, style, block, inh, cutBlocks.has(node));
            const next = { ...inh };
            for (const key of FONT_KEYS) if (own[key]) next[key] = own[key];
            const element = { t: 'el', block, tag: block ? (node.matches('ul, ol, li') ? node.tagName.toLowerCase() : 'div') : 'span', kind: kindOf(node, style, block, base), style: own, children: [] };
            const before = pseudo(node, '::before', next);
            if (before) element.children.push(before);
            walk(node, element.children, next, base);
            const after = pseudo(node, '::after', next);
            if (after) element.children.push(after);
            if (element.children.length) out.push(element);
        }
    };

    /** 11-14 메시지의 그림 — 글 안 <img>(캐릭터 에셋 · 생성 그림 · 본문 그림: 고른 범위에 걸친 것, top 이면 고른 자리 앞 것도) · 메시지에 붙인 그림(.mes_media_wrapper — top 일 때).
     *  보이는 것 · 64px 넘는 것만(아이콘 · 이모지 그림 빼고) · 상태창 칩 칸 · 단추 줄 안은 빼요. 주소는 절대 주소(올릴지는 log-copy-pics.js 가 정해요) */
    const PIC_SKIP = '.mes_buttons, .mes_edit_buttons, .ss-slot, .custom-ss-slot, .ss-msgcard, button, a.mes_img_enlarge';
    const picOk = (img) => {
        const src = img.currentSrc || img.src || '';
        if (!/^(https?:|data:image\/(png|gif|jpe?g|webp|avif);)/i.test(src) || img.closest(PIC_SKIP) || img.classList.contains('error')) return '';
        if (typeof img.checkVisibility === 'function' && !img.checkVisibility()) return '';
        // 검토 사3: 크기는 화면에 보이는 크기로 — 원본이 커도 글 속에 작게 띄운 스티커 · 이모지 그림 · 아이콘은 빼요
        const box = img.getBoundingClientRect?.() ?? { width: 0, height: 0 };
        const w = box.width || img.clientWidth || 0, h = box.height || img.clientHeight || 0;
        return w >= 64 && h >= 64 ? src : '';
    };
    const picsOf = (root, mes, top) => {
        const out = [];
        // 원본 가로세로도 적어요(복사 글 aspect-ratio — 깡통에서 그림이 늦게 떠도 글이 안 밀리게 · 검토 사7)
        const add = (src, img) => { if (src && !out.some(p => p.src === src) && out.length < 40) out.push({ src, ...(img?.naturalWidth && img?.naturalHeight ? { w: img.naturalWidth, h: img.naturalHeight } : {}) }); };
        for (const img of root.querySelectorAll('img')) {
            let inside = range.intersectsNode(img);
            if (!inside && top) { try { inside = range.comparePoint(img, 0) < 0; } catch { inside = false; } }   // 고른 자리 앞(글자 없는 머리) 그림
            if (inside) add(picOk(img), img);
        }
        if (top) for (const img of mes?.querySelectorAll('.mes_media_wrapper img.mes_img') ?? []) add(picOk(img), img);
        return out;
    };
    /** 검토 보4: 고른 자리 앞에 「보이는 글자」가 있나 — walk 와 같은 규칙(<style> · 건너뛰는 칸 · 안 보이는 글 · 고를 수 없는 글은 안 세요).
     *  Range.toString() 은 <style> 안 글 · 숨긴 글까지 세서, 본문 맨 앞에 <style> 이 있는 메시지(상태창 프리셋)는 첫 글자부터 골라도 「가운데부터」가 됐어요 */
    const textBefore = (root) => {
        if (!root.contains(range.startContainer)) return false;   // 고른 자리가 이 칸 앞(이름 줄 등) — 칸 처음부터예요
        const tw = doc.createTreeWalker(root, 4);
        for (let node = tw.nextNode(); node; node = tw.nextNode()) {
            let pos;
            try { pos = range.comparePoint(node, 0); } catch { return false; }
            const isStart = node === range.startContainer;
            if (pos >= 0 && !isStart) break;   // 고른 자리부터는 그만
            const text = isStart ? node.data.slice(0, range.startOffset) : node.data;
            if (!text.trim()) continue;
            const parent = node.parentElement;
            if (!parent || parent.closest(SKIP) || parent.closest('style, script, template, noscript')) continue;
            const style = cs(parent);
            if (style.visibility !== 'visible' || style.userSelect === 'none' || style.display === 'none') continue;
            if (typeof parent.checkVisibility === 'function' && !parent.checkVisibility()) continue;
            return true;
        }
        return false;
    };

    const chat = doc.getElementById('chat');
    const chatBg = backdrop(chat ?? roots[0]);
    const first = cs(roots[0]);
    const baseFont = fontOf(first);
    const messages = [];
    // 11-14 글 속 그림(log-copy-pics.js): 첫 메시지를 글 처음부터 골랐으면(앞에 글자 없음) 고른 자리 앞 그림 · 메시지에 붙인 그림도 그 메시지 것으로
    let fromTop = true;
    try { fromTop = !textBefore(roots[0]); } catch { fromTop = false; }
    for (const root of roots) {
        const mes = root.closest('.mes');
        const style = cs(root);
        const font = fontOf(style);
        const index = Number.parseInt(mes?.getAttribute('mesid') ?? '', 10);
        const data = Number.isInteger(index) ? context?.chat?.[index] : null;
        const nameEl = mes?.querySelector('.name_text');
        const name = (nameEl?.textContent || data?.name || mes?.getAttribute('ch_name') || '').trim();
        const nameStyle = nameEl ? cs(nameEl) : null;
        const nameFont = nameStyle ? fontOf(nameStyle) : font;
        const when = data?.send_date ? new Date(chatTimeMs(data.send_date, context?.timestampToMoment) || NaN) : null;   // 버그 사냥 2: 옛 꼴 시각도(채팅 정리와 같은 읽기 — 전엔 날짜가 오늘로 · 시각 줄이 비었어요)
        const own = backdrop(root);
        const bubble = own !== chatBg ? { 'background-color': own, ...(px(cs(mes).borderTopLeftRadius) !== '0px' ? { 'border-radius': px(cs(mes).borderTopLeftRadius) } : {}) } : null;
        const nodes = [];
        const solid = (value, under) => { const c = parseColor(value); const b = parseColor(under); return c && b && c.a < 0.999 ? cssColor(compose(c, b)) : value; };
        const opaque = (list, under) => { for (const node of list) { if (node.style?.color) node.style.color = solid(node.style.color, under); if (node.children) opaque(node.children, under); } };
        font.color = solid(font.color, own);
        const inh = { ...font };
        walk(root, nodes, inh, { weight: Number.parseInt(style.fontWeight, 10) || 400, italic: style.fontStyle !== 'normal' });
        const pics = picsOf(root, mes, root === roots[0] ? fromTop : true);
        // 1.5.8 TTS 대사 분석이 이 메시지에 적어 둔 화자(줄 열쇠 → 이름) — 다른 틀이 대사마다 인물표 색을 입힐 때 먼저 봐요(log-copy-tone.js whoFinder · 읽기만)
        const said = [];
        try { for (const seg of data?.extra?.lemon_voice?.analysis?.segs ?? []) if (seg && typeof seg.h === 'string' && typeof seg.speaker === 'string' && seg.speaker.trim()) said.push([seg.h, seg.speaker.trim()]); } catch { /* 분석 없음 */ }
        if (!nodes.length && !pics.length) continue;   // 검토 보3: 글 없이 그림만 있는 메시지(그림 생성 결과 · 첨부만)도 남겨요 — 그림이 안 들어가면 시트가 이름 줄을 비워요
        opaque(nodes, own);
        messages.push({
            index: Number.isInteger(index) ? index : null,
            user: mes?.getAttribute('is_user') === 'true',
            name,
            nameStyle: { color: nameFont.color, 'font-family': nameFont['font-family'], 'font-size': nameFont['font-size'], 'font-weight': nameFont['font-weight'], 'letter-spacing': nameFont['letter-spacing'] },
            time: when && Number.isFinite(when.getTime()) ? when.getTime() : null,
            font,
            bubble,
            nodes,
            ...(pics.length ? { pics } : {}),
            ...(said.length ? { said } : {}),
        });
    }
    if (!messages.length) return null;
    // 갤러리 틀이 쓰는 그림: 고른 범위에 걸친 메시지 글 안 그림(주소는 절대 주소 — 실리태번 밖에서는 그 서버에서만 보여요)
    const images = [];
    for (const root of roots) for (const img of root.querySelectorAll('img')) {
        if (!range.intersectsNode(img) || images.length >= 40) continue;
        const src = img.currentSrc || img.src || '';
        if (/^(https?:|data:image\/(png|gif|jpe?g|webp|avif);)/i.test(src) && !images.some(x => x.src === src)) images.push({ src, alt: (img.getAttribute('alt') || img.getAttribute('title') || '').trim().slice(0, 60) });
    }
    const ctx = context ?? {};
    const character = ctx.characters?.[ctx.characterId];
    // 채팅 파일 이름이 실리태번 자동 이름(「캐릭터 - 2026-11-04@12h30m05s」)이면 제목으로 쓰지 않아요
    function chatTitleOf(c) {
        let id = '';
        try { id = String(c.getCurrentChatId?.() ?? c.chatId ?? ''); } catch { id = ''; }
        id = id.replace(/\.jsonl$/i, '').trim();
        return /\s-\s\d{4}-\d{1,2}-\d{1,2}\s*@\s*\d{1,2}h\s*\d{1,2}m/i.test(id) ? '' : id.slice(0, 80);
    }
    const group = ctx.groupId ? ctx.groups?.find?.(g => g.id === ctx.groupId) : null;
    return {
        chatName: String(group?.name || character?.name || ctx.name2 || '').trim(),
        charName: String(character?.name || ctx.name2 || group?.name || '').trim(),   // 1.0.1 머리 「깡통」 알약
        chatTitle: chatTitleOf(ctx),   // 1.0.1 머리 큰 제목(지금 채팅 이름 · 자동 이름이면 빈칸 → 「Title」)
        userName: String(ctx.name1 || '').trim(),
        base: { bg: chatBg, ...baseFont },
        messages,
        images,
    };
}
