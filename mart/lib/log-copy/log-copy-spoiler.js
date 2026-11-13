// 원본 omni-next c3528bad7 의 src/log-copy-spoiler.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(글꾸 마트 숨기기가 테마 로그 복사와 같은 모양으로 그리려고 써요 · 11-12 숨긴 글 문단 div.blsp-p 고침까지)
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

/** 1.1.3 숨긴 글이 든 문단의 표시 — <p> 안에는 <details> 를 둘 수 없어요(HTML 글자로 옮기면 브라우저가 <details> 앞에서 <p> 를 닫아 문단이 쪼개지고,
 *  숨긴 글 · 뒤 글자가 문단 밖으로 나가 틀의 글자색 · 글꼴을 잃어요 — 밤 틀을 밝은 게시판에 붙이면 검은 글자가 어두운 칸 위에 놓여 안 보였어요).
 *  그래서 숨긴 글이 든 <p> 는 <div class="… blsp-p"> 로 바꾸고, 틀 <style> 의 문단(p) 규칙마다 같은 선언의 .blsp-p 짝을 붙여요(paragraphTwin).
 *  문단이 <p> 인 틀은 1.1.3 기본 글꾸 새 틀(과 꺼 둔 심플 새 틀)뿐이에요 — 그 밖의 틀은 문단이 div 라 그대로예요. */
export const PARA_CLASS = 'blsp-p';
const P_TYPE = /(^|[\s>+~(,])p(?=$|[\s>+~.:#[),])/;   // 선택자 안의 p 태그(앞: 처음 · 빈칸 · 결합자 · 괄호 / 뒤: 끝 · 빈칸 · 결합자 · class · 가상 · 속성)
const P_TYPE_ALL = new RegExp(P_TYPE.source, 'g');
/** 선택자 목록을 맨 바깥 쉼표로 나눠요(:is( ) · :not( ) 안의 쉼표는 그대로) */
function splitSelectors(list) {
    const out = [];
    let depth = 0, start = 0;
    for (let i = 0; i < list.length; i++) {
        const ch = list[i];
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
        else if (ch === ',' && depth === 0) { out.push(list.slice(start, i)); start = i + 1; }
    }
    out.push(list.slice(start));
    return out;
}
/**
 * 틀 <style> 글의 문단(p 태그) 규칙마다 .blsp-p 짝 선택자를 더해요 — 선언은 그대로, 그 규칙의 선택자 목록 끝에 붙여요(규칙 수 · 차례 그대로).
 * p 태그 선택자가 없거나 이미 짝이 있으면 그대로 돌려줘요(두 번 걸어도 같아요). 순수 함수.
 */
export function paragraphTwin(css) {
    const text = String(css ?? '');
    if (text.includes(`.${PARA_CLASS}`)) return text;
    return text.replace(/([^{}]+)\{/g, (all, prelude) => {
        if (prelude.trim().startsWith('@') || !P_TYPE.test(prelude.trim())) return all;
        const lead = prelude.match(/^\s*/)[0], body = prelude.slice(lead.length).replace(/\s+$/, '');
        const twins = splitSelectors(body).map(s => s.trim()).filter(s => P_TYPE.test(s)).map(s => s.replace(P_TYPE_ALL, (m, before) => `${before}.${PARA_CLASS}`));
        return twins.length ? `${lead}${body},${twins.join(',')}{` : all;
    });
}
/** HTML 글자(틀이 그린 글)에서: 숨긴 글이 든 <p …> … </p> 를 <div class="… blsp-p"> 로 — 바꾼 것이 있으면 맨 앞 <style> 에 짝 규칙도. 순수 함수 */
export function unparagraphHtml(html) {
    const text = String(html ?? '');
    if (!text.includes('data-bl-spoiler')) return text;
    let changed = false;
    const out = text.replace(/<p\b([^>]*)>((?:(?!<\/?p\b)[\s\S])*?)<\/p>/g, (all, attrs, inner) => {
        if (!inner.includes('data-bl-spoiler')) return all;
        changed = true;
        const cls = attrs.match(/\sclass="([^"]*)"/);
        const next = cls ? attrs.replace(cls[0], ` class="${`${cls[1]} ${PARA_CLASS}`.trim()}"`) : ` class="${PARA_CLASS}"${attrs}`;
        return `<div${next}>${inner}</div>`;
    });
    return changed ? out.replace(/(<style>)([\s\S]*?)(<\/style>)/, (all, open, css, close) => open + paragraphTwin(css) + close) : text;
}
/** 미리보기 문서에서: 막 넣은 숨긴 글(details)이 <p> 안이면 그 <p> 를 div.blsp-p 로 바꾸고(속성 · 자식 그대로) 틀 <style> 에 짝 규칙을 더해요 */
function unparagraph(doc, details) {
    let swapped = false;
    for (let p = details.parentElement?.closest('p'); p; p = details.parentElement?.closest('p')) {
        const div = doc.createElement('div');
        for (const a of [...p.attributes]) div.setAttribute(a.name, a.value);
        div.classList.add(PARA_CLASS);
        div.append(...p.childNodes);
        p.replaceWith(div);
        swapped = true;
    }
    if (!swapped) return;
    for (const style of doc.body.querySelectorAll('style:not([data-bl-sp])')) {
        const next = paragraphTwin(style.textContent);
        if (next !== style.textContent) style.textContent = next;
    }
}

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
    const details = `display:${inline ? 'inline-block;max-width:100%;vertical-align:baseline;text-indent:0' : 'block;margin:8px 0'}`;
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
    const details = make(doc, 'details', inline ? 'blsp-s' : 'blsp-s blsp-k', inline ? 'display:inline-block;max-width:100%;vertical-align:baseline;text-indent:0' : 'display:block;margin:8px 0');   // 글줄 안 숨긴 글: 펼침 칸(details 내용 칸)이 블록이라 inline 이면 줄이 끊겨요 → 인라인 블록
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
    unparagraph(doc, details);   // 1.1.3 기본 글꾸 새 틀은 문단이 <p> — 그 안의 <details> 는 복사 글에서 문단을 쪼개요
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
