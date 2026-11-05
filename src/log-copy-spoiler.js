// 로그 복사 — 숨긴 글(눌러야 보이는 글)과 미리보기 → 마크다운 (시트의 미리보기 iframe 문서에서 돌아요 · 시작 그래프 밖)
// 숨긴 글은 스크립트 없이 손 · 마우스로 동작하는 <details><summary> 예요. 문장 일부는 글줄 안(inline), 문단 여러 개는 블록.
// 꾸밈 블록(<style>, 클래스 blsp-*)이 살아 있으면: 접힌 동안 그 글을 흐리게 보여 주고 누르면 드러나요.
// <style> 이 지워져도: summary 의 「숨겨진 글 보기」 알약만 보이고(흐린 사본은 인라인 display:none) 눌러 펼치는 동작은 그대로예요.

export const SPOILER_LABEL = '숨겨진 글 보기';

// 글 칸들은 인라인 style 을 가져서 꾸밈 블록 규칙은 !important 로 이겨요
const STYLE = '.blsp-s>summary{list-style:none}'
    + '.blsp-s>summary::-webkit-details-marker{display:none}'
    + '.blsp-s:not([open])>summary>.blsp-l{display:none!important}'
    + '.blsp-s:not([open])>summary>.blsp-b{display:inline!important;filter:blur(5px);-webkit-user-select:none;user-select:none;transition:filter .2s}'
    + '.blsp-k:not([open])>summary>.blsp-b{display:block!important}'
    + '.blsp-s:not([open])>summary:hover>.blsp-b,.blsp-s:not([open])>summary:focus-visible>.blsp-b{filter:blur(3px)}'
    + '.blsp-s[open]>summary{display:none!important}';
/** 꾸밈 블록 글 (복사 결과 맨 앞에 하나) */
export const spoilerStyle = () => `<style>${STYLE}</style>`;

const blockOf = (doc, node) => {
    for (let el = node?.nodeType === 1 ? node : node?.parentElement; el && el !== doc.body; el = el.parentElement) {
        const display = doc.defaultView.getComputedStyle(el).display;
        if (!display.startsWith('inline') && display !== 'contents') return el;
    }
    return doc.body;
};
const make = (doc, tag, cls, style) => {
    const el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (style) el.setAttribute('style', style);
    return el;
};

const labelStyle = (c, ui) => `display:inline-block;padding:0 8px;border:1px solid ${c.line};border-radius:6px;background-color:${c.raised};color:${c.muted};font-family:${String(ui.family).replace(/"/g, "'")};font-size:13px;font-style:normal;font-weight:650;line-height:1.6;letter-spacing:${ui.tracking};text-indent:0`;
const escText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/** 1.0.1 숨긴 글 마크업을 글자로 — 미리보기에서 숨긴 글을 틀 · 색을 바꿔 다시 그릴 때(log-copy-render.js nodesHtml · kind 'spoiler'). wrapSpoiler 와 같은 모양 */
export function spoilerHtml(inner, sp, inline = true) {
    const c = { line: sp?.line || '#8884', raised: sp?.raised || 'transparent', muted: sp?.muted || 'inherit' }, ui = { family: sp?.family || 'inherit', tracking: sp?.tracking || '0' };
    const details = `display:${inline ? 'inline-block;max-width:100%;vertical-align:baseline' : 'block;margin:8px 0'}`;
    const blur = inline ? 'span' : 'div', content = inline ? 'span' : 'div';
    return `<details class="${inline ? 'blsp-s' : 'blsp-s blsp-k'}" data-bl-spoiler="" style="${details}"><summary class="blsp-h" style="display:${inline ? 'inline' : 'block'};list-style:none;cursor:pointer"><span class="blsp-l" style="${escText(labelStyle(c, ui))}">${SPOILER_LABEL}</span><${blur} class="blsp-b" aria-hidden="true" style="display:none">${inner}</${blur}></summary><${content} class="blsp-c">${inner}</${content}></details>`;
}

/** 고른 글 → 숨긴 글. c = 팔레트 값(line · raised · muted), ui = { family, tracking }. 감싼 <details> 또는 null */
export function wrapSpoiler(doc, range, c, ui) {
    if (!range || range.collapsed) return null;
    if (range.startContainer.parentElement?.closest('[data-bl-spoiler]') || range.endContainer.parentElement?.closest('[data-bl-spoiler]')) return null;
    const inline = blockOf(doc, range.startContainer) === blockOf(doc, range.endContainer);
    const piece = range.cloneContents();
    if (!piece.textContent.trim()) return null;
    const frag = range.extractContents();
    const details = make(doc, 'details', inline ? 'blsp-s' : 'blsp-s blsp-k', inline ? 'display:inline-block;max-width:100%;vertical-align:baseline' : 'display:block;margin:8px 0');   // 글줄 안 숨긴 글: 펼침 칸(details 내용 칸)이 블록이라 inline 이면 줄이 끊겨요 → 인라인 블록
    details.setAttribute('data-bl-spoiler', '');
    const summary = make(doc, 'summary', 'blsp-h', `display:${inline ? 'inline' : 'block'};list-style:none;cursor:pointer`);
    const label = make(doc, 'span', 'blsp-l', labelStyle(c, ui));
    label.textContent = SPOILER_LABEL;
    const blur = make(doc, inline ? 'span' : 'div', 'blsp-b', 'display:none');
    blur.setAttribute('aria-hidden', 'true');
    blur.append(piece);
    summary.append(label, blur);
    const content = make(doc, inline ? 'span' : 'div', 'blsp-c', '');
    content.append(frag);
    details.append(summary, content);
    range.insertNode(details);
    ensureStyle(doc);
    return details;
}

/** 숨긴 글 풀기 — 안의 글을 그 자리로 */
export function unwrapSpoiler(details) {
    const content = details?.querySelector(':scope > .blsp-c');
    if (!content) return false;
    details.replaceWith(...content.childNodes);
    return true;
}

/** 지금 고른 자리가 들어 있는 숨긴 글 */
export const spoilerAt = range => (range?.startContainer?.nodeType === 1 ? range.startContainer : range?.startContainer?.parentElement)?.closest?.('[data-bl-spoiler]') ?? null;

/** 미리보기 문서에 꾸밈 블록 하나 (숨긴 글이 있을 때만 — 복사 결과에 그대로 따라가요) */
export function ensureStyle(doc) {
    const has = doc.querySelector('[data-bl-spoiler]');
    let style = doc.body.querySelector('style[data-bl-sp]');
    if (!has) { style?.remove(); return; }
    if (!style) { style = doc.createElement('style'); style.setAttribute('data-bl-sp', ''); style.textContent = STYLE; doc.body.prepend(style); }
}

// ── 미리보기 → 로그 자료 (마크다운이 고친 글 · 숨긴 글까지 따라가게) ──
/** 미리보기 문서의 [data-bl-msg] 메시지들을 log-copy-render.js 의 노드 나무로 */
export function previewModel(doc) {
    const view = doc.defaultView;
    const messages = [...doc.querySelectorAll('[data-bl-msg]')];
    if (!messages.length) return null;
    const convert = (parent, base) => {
        const out = [];
        for (const node of parent.childNodes) {
            if (node.nodeType === 3) { const text = node.data.replace(/[ \t\r\n\f]+/g, ' '); if (text.trim() || text === ' ') out.push({ t: 'text', text }); continue; }
            if (node.nodeType !== 1) continue;
            if (node.matches('style, script, summary, [data-bl-name], .blsp-b')) continue;
            if (node.tagName === 'BR') { out.push({ t: 'br' }); continue; }
            if (node.matches('[data-bl-spoiler]')) {
                const content = node.querySelector(':scope > .blsp-c');
                const blockSp = node.classList.contains('blsp-k');   // 1.0.1 문단 여러 개를 숨긴 블록 숨김은 블록으로
                out.push({ t: 'el', block: blockSp, tag: blockSp ? 'div' : 'span', kind: 'spoiler', style: {}, children: content ? convert(content, base) : [] });
                continue;
            }
            const style = view.getComputedStyle(node);
            if (style.display === 'none') continue;
            const block = !style.display.startsWith('inline');
            let kind = null;
            if (block) {
                if (/^H[1-6]$/.test(node.tagName)) kind = node.tagName.toLowerCase();
                else if (node.matches('ul, ol, li')) kind = node.tagName.toLowerCase();
                else if (Number.parseFloat(style.borderLeftWidth) >= 2 && style.borderLeftStyle !== 'none') kind = 'quote';
                else kind = 'p';
            } else {
                const kinds = [];
                if ((Number.parseInt(style.fontWeight, 10) || 400) - base.weight >= 200) kinds.push('strong');
                if (style.fontStyle !== 'normal' && !base.italic) kinds.push('em');
                if (/line-through/.test(style.textDecorationLine) || node.matches('s, del, strike')) kinds.push('del');
                kind = kinds.join(' ') || null;
            }
            out.push({ t: 'el', block, tag: block ? 'div' : 'span', kind, style: {}, children: convert(node, base) });
        }
        return out;
    };
    return {
        messages: messages.map((el) => {
            const style = view.getComputedStyle(el);
            const base = { weight: Number.parseInt(style.fontWeight, 10) || 400, italic: style.fontStyle !== 'normal' };
            const name = (el.querySelector('[data-bl-name]')?.textContent || el.getAttribute('data-bl-who') || '').trim();
            return { name, nodes: convert(el, base) };
        }),
    };
}
