// 11-12 글꾸 마트 「내 글꾸」 — 남이 만든 글꾸 HTML · 예전에 쓰던 글꾸 · 마트에서 복사한 글을 붙여 넣어 마트에서 미리보기 · 내 글 넣기 · 복사로 써요.
//   테마 로그 복사 「+ 내 글꾸」(log-copy-sheet.js 589~610줄 — 소독 · 60KB · 20개 · 이름 「내 글꾸 n」) 꼴.
//   - 마트에서 복사한 글(뿌리 div.gk + 틀 <style>)이면 마트 틀처럼 읽어 깡통 · 깡캐 색 · 조절 칸 · 내 글 넣기가 다 돼요(simple).
//   - 그 밖의 HTML 은 그대로 보여 주고, 내 글은 「글 자리」(자동으로 고른 칸 · 직접 고른 칸)에 넣어요.
//   - 깡통 정화기에서 죽거나 바뀌는 것은 넣을 때 알려 줘요(kkLint — 허브 글꾸 0-3 · 0-6 규칙).
//   - 미리보기에서는 붙인 글의 <style> 을 그 카드 안에만 걸리게 고쳐요(scopeCss — 마트 화면을 덮지 않게). 복사 글은 소독한 원래 글 그대로예요.
//   소독(cleanOwn) · 글 자리(fillSlot)만 브라우저 DOM 을 쓰고 나머지는 순수 함수(node 시험 — tools/geulkku-simple-test.mjs).
import { simpleFrameInfo } from './simple-frames.js?v=20261112a';

export const OWN_KEY = 'bl-mart-own-v1';
export const OWN_MAX = 20;          // 테마와 같아요
export const OWN_BYTES = 60000;     // 붙여 넣는 글 한 벌 상한(테마 60KB)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ── 깡통 정화기 점검 ──
/**
 * 붙여 넣은 글에서 깡통(커뮤니티 글쓰기)에 올리면 지워지거나 바뀌는 것 — [{ id, level: 'die' | 'fix', msg }]
 *   die: 올리면 사라지거나 모양이 바뀌어요(고쳐야 해요) · fix: 마트 「HTML 복사」가 저절로 고쳐요 · check: 경우에 따라(살펴볼 것)
 */
export function kkLint(html) {
    const text = String(html ?? ''), out = [];
    const css = [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    const inline = [...text.matchAll(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)].map(m => m[2] ?? m[3] ?? '');
    const allCss = `${css}\n${inline.join(';\n')}`;
    const tags = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    const add = (id, level, msg) => out.push({ id, level, msg });
    if (/<script\b/i.test(tags)) add('script', 'die', '스크립트(<script>)는 지워져요 — 마트 미리보기에서도 뺐어요');
    if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(tags)) add('on', 'die', '누름 스크립트(onclick 같은 on… 속성)는 지워져요');
    if (/<(iframe|object|embed|form|frame)\b/i.test(tags)) add('embed', 'die', '끼워 넣기(iframe · form · embed …)는 지워져요');
    if (/<link\b/i.test(tags) || /@import\b/i.test(css)) add('import', 'die', '바깥 스타일 · 웹폰트(<link> · @import)는 지워져요');
    if (/@font-face\b/i.test(css)) add('font', 'die', '웹폰트(@font-face)는 안 불러와져요 — 읽는 사람 기기 글꼴로 보여요');
    if (/@property\b/i.test(css)) add('property', 'die', '@property 는 지워져요');
    if (/(?:^|[{}]|,)\s*(?:html|body)(?![\w-])[^{}]*\{/i.test(css)) add('page', 'die', 'html · body 규칙은 붙인 곳 사이트 전체에 걸려요 — 마트 미리보기에서는 뺐어요 · 감싸는 div 의 클래스로 바꿔요');
    if (/position\s*:\s*fixed/i.test(allCss)) add('fixed', 'die', 'position:fixed 는 지워져요');
    if (/overflow(?:-[xy])?\s*:\s*hidden/i.test(allCss)) add('hidden', 'die', 'overflow:hidden 은 폰에서 숨은 스크롤 상자가 돼요 — overflow:clip 으로 바꿔요');
    if (/<[a-z][^>]*\s(?:id|for|name)\s*=/i.test(tags)) add('id', 'die', 'id · for · name 속성은 지워져요 — 체크박스는 label 안에 넣고 클래스로 이어요');
    if (/<[a-z][^>]*\scontenteditable\b/i.test(tags)) add('edit', 'die', 'contenteditable 은 지워져요');
    if (/<svg\b/i.test(tags)) add('svg', 'die', '글 속 <svg> 는 통째로 지워져요 — 그림은 <style> 의 data: 주소로');
    if (/position\s*:\s*absolute/i.test(allCss) && /z-index\s*:/i.test(allCss)) add('float', 'die', '떠 있는 판(absolute + z-index)은 사이트 메뉴 위로 뜨거나 가려져요');
    if (/(?:^|[;{\s])height\s*:\s*[\d.]+%/i.test(allCss) && !/block-size\s*:/i.test(allCss)) add('height', 'die', 'height:% 는 auto 로 바뀌어요 — block-size 를 같이 적어요');
    if (inline.some(s => /url\s*\(/i.test(s))) add('url', 'fix', '글 속 style 의 그림 주소(url)는 지워져요 — 「HTML 복사」가 <style> 규칙으로 옮겨요');
    if (inline.some(s => /(?:^|;)\s*color\s*:/i.test(s) && !/-webkit-text-fill-color/i.test(s))) add('fill', 'fix', '글자색(color)만 적으면 사이트 색으로 덮일 수 있어요 — 「HTML 복사」가 -webkit-text-fill-color 를 같이 적어요');
    const cssColor = [...css.matchAll(/\{([^{}]*)\}/g)].some(m => /(?:^|;)\s*color\s*:/i.test(m[1]) && !/-webkit-text-fill-color/i.test(m[1]));
    if (cssColor) add('fill-css', 'check', '<style> 규칙에 글자색(color)만 적은 곳이 있어요 — 글자가 든 칸이면 사이트 색으로 덮일 수 있어 -webkit-text-fill-color 를 같이 적어요');
    if ((text.match(/<style\b/gi) || []).length > 1) add('styles', 'fix', '<style> 이 여럿이에요 — 감싸는 div 안 하나가 좋아요');
    return out;
}

// ── 마트 복사 글 알아보기 ──
/** 복사 글 위아래 코멘트 빈칸(<p><br></p>) · 주석(✎ 안내)을 떼요 — 마트 틀 꼴(뿌리 div.gk 바로 안 <style>)로 되돌려요 */
export function unwrapCopy(html) {
    return String(html ?? '').replace(/<!--[\s\S]*?-->\n?/g, '').replace(/^\s*(?:<p><br\s*\/?><\/p>\s*)+/i, '').replace(/(?:\s*<p><br\s*\/?><\/p>)+\s*$/i, '').trim();
}
/** 붙여 넣은(소독한) 글 → { html, simple, key } — 마트 틀 꼴이면 simple(마트 틀처럼 칠하고 고쳐요) */
export function ownShape(html) {
    const un = unwrapCopy(html), info = simpleFrameInfo(un);
    if (info && info.key && info.base && info.K0 !== undefined) return { html: un, simple: true, key: info.key };
    return { html: String(html ?? '').trim(), simple: false, key: '' };
}

// ── 미리보기용 <style> 가두기 ──
/** 맨 위 단계에서 규칙을 나눠요(따옴표 · 괄호 안 { } , 는 그대로) */
function splitTop(css, sep) {
    const out = []; let depth = 0, paren = 0, quote = '', start = 0;
    for (let i = 0; i < css.length; i++) {
        const ch = css[i];
        if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
        if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '(') paren++;
        else if (ch === ')') paren = Math.max(0, paren - 1);
        else if (sep === ',' && ch === ',' && !paren) { out.push(css.slice(start, i)); start = i + 1; }
        else if (sep === '}' && ch === '{') depth++;
        else if (sep === '}' && ch === '}') { depth--; if (depth <= 0) { depth = 0; out.push(css.slice(start, i + 1)); start = i + 1; } }
        else if (sep === '}' && ch === ';' && depth === 0) { out.push(css.slice(start, i + 1)); start = i + 1; }   // @charset 같은 한 줄 규칙
    }
    const rest = css.slice(start); if (rest.trim()) out.push(rest);
    return out.map(s => s.trim()).filter(Boolean);
}
const KEEP_AT = /^@(?:-webkit-)?(?:keyframes|font-face|counter-style|page|property|font-feature-values)\b/i;
const NEST_AT = /^@(?:media|supports|container|layer|document)\b/i;
/** CSS 를 scope 안에만 걸리게 — html · body · :root 는 scope 로, 나머지는 scope 뒤에 */
export function scopeCss(css, scope) {
    const text = String(css ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
    return splitTop(text, '}').map((rule) => {
        if (/^@(?:import|charset|namespace)\b/i.test(rule)) return '';
        const at = rule.indexOf('{'); if (at < 0) return '';
        const head = rule.slice(0, at).trim(), body = rule.slice(at);
        if (KEEP_AT.test(head)) return rule;
        if (NEST_AT.test(head)) return `${head}{${scopeCss(body.slice(1, -1), scope)}}`;
        // html · body 규칙은 붙인 곳 사이트 전체를 바꾸는 것이라 미리보기에서 빼요(kkLint 가 알려요) · :root 는 변수 자리라 scope 로
        const sel = splitTop(head, ',').map(s => s.trim()).filter(t => !/^(?:html|body)(?![\w-])/i.test(t) && !/^:root\s+body(?![\w-])/i.test(t)).map(t => (/^:root(?![\w-])/i.test(t) ? t.replace(/^:root/i, scope) : `${scope} ${t}`)).join(',');
        return sel ? `${sel}${body}` : '';
    }).filter(Boolean).join('\n');
}
/** 미리보기 HTML — 모든 <style> 을 그 칸 안에만 걸리게 · 감싸는 div(class mart-own-<id>) */
export function scopePreview(html, id) {
    const cls = `mart-own-${String(id).replace(/[^\w-]/g, '')}`;
    const inner = String(html ?? '').replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (all, a, css, b) => a + scopeCss(css, `.${cls}`) + b);
    return `<div class="mart-own-view ${cls}">${inner}</div>`;
}

// ── 이 브라우저에 기억 ──
const store = () => { try { return globalThis.localStorage; } catch { return null; } };
const cleanRow = (x) => {
    if (!x || typeof x !== 'object' || typeof x.html !== 'string' || !x.html.trim() || x.html.length > OWN_BYTES * 2) return null;
    const id = /^[a-z0-9]{4,16}$/.test(x.id || '') ? x.id : Math.random().toString(36).slice(2, 10);
    const name = String(x.name ?? '').replace(/[<>"'`]/g, '').trim().slice(0, 24) || '내 글꾸';
    const path = Array.isArray(x.path) && x.path.length <= 40 && x.path.every(n => Number.isInteger(n) && n >= 0 && n < 2000) ? x.path : null;
    const warn = Array.isArray(x.warn) ? x.warn.filter(w => w && typeof w.msg === 'string').slice(0, 20).map(w => ({ id: String(w.id || '').slice(0, 20), level: ['fix', 'check'].includes(w.level) ? w.level : 'die', msg: w.msg.slice(0, 200) })) : [];
    return { id, name, html: x.html, simple: x.simple === true, warn, ...(path ? { path } : {}), at: Number(x.at) || 0 };
};
export function ownList() {
    let v = null; try { v = JSON.parse(store()?.getItem(OWN_KEY) || 'null'); } catch { v = null; }
    return Array.isArray(v) ? v.map(cleanRow).filter(Boolean).slice(0, OWN_MAX) : [];
}
const save = list => { try { store()?.setItem(OWN_KEY, JSON.stringify(list.slice(0, OWN_MAX))); return true; } catch { return false; } };
/** 다음 자동 이름 「내 글꾸 n」 */
export function nextOwnName(list = ownList()) { let n = list.length + 1; while (list.some(x => x.name === `내 글꾸 ${n}`)) n++; return `내 글꾸 ${n}`; }
/** 더하기 — 'full'(20개) · 'big'(60KB) · 'quota'(저장 칸이 참) · 그 밖에는 넣은 줄 */
export function addOwn({ name, html, warn = [] }) {
    const list = ownList();
    if (list.length >= OWN_MAX) return 'full';
    if (String(html ?? '').length > OWN_BYTES) return 'big';
    const shape = ownShape(html);
    const row = cleanRow({ name: name || nextOwnName(list), html: shape.html, simple: shape.simple, warn, at: Date.now() });
    if (!row) return null;
    return save([row, ...list]) ? row : 'quota';
}
export function forgetOwn(id) { save(ownList().filter(x => x.id !== id)); }
export function renameOwn(id, name) { const n = String(name ?? '').replace(/[<>"'`]/g, '').trim().slice(0, 24); if (!n) return false; save(ownList().map(x => (x.id === id ? { ...x, name: n } : x))); return true; }
export function setOwnPath(id, path) { save(ownList().map(x => (x.id === id ? { ...x, path: Array.isArray(path) ? path : undefined } : x))); }
/** 목록 항목(마트 카드 꼴) — id 머리 own- · 분류 own */
export const OWN_CAT = 'own';
export function ownItem(row) {
    const die = row.warn.filter(w => w.level === 'die').length;
    return {
        id: `own-${row.id}`, ownId: row.id, own: true, kind: 'geulkku', name: row.name, label: row.name, category: OWN_CAT, categoryLabel: '내 글꾸', copyOnly: true, photo: true,
        simple: row.simple, preview: row.html, warn: row.warn, path: row.path || null,
        desc: `${row.simple ? '마트 꼴이라 색 · 조절 · 내 글 넣기가 다 돼요' : '붙여 넣은 그대로 보여요 · 내 글은 글 자리에 들어가요'}${die ? ` · 깡통에서 바뀌는 것 ${die}개` : ''} · 이 브라우저에만 있어요`,
    };
}

// ── 브라우저: 소독 · 글 자리 ──
/**
 * 붙여 넣은 글 소독(테마 사본 sanitizeHtml) — 소리 카드(audio) · 체크박스(input type=checkbox · radio)는 글꾸 모양이라 남겨요(주소 · 속성은 같은 검사)
 * @param {(html: string) => string} sanitizeHtml lib/log-copy/log-copy-sanitize.js 의 것
 */
export function cleanOwn(html, sanitizeHtml) {
    const keep = String(html ?? '')
        .replace(/<(\/?)audio\b/gi, '<$1bl-keep-audio')
        .replace(/<input\b((?=[^>]*\stype\s*=\s*["']?(?:checkbox|radio)\b)[^>]*?)\s*\/?>/gi, '<bl-keep-input$1></bl-keep-input>');   // 빈 요소라 닫는 태그를 붙여 둬요(안 붙이면 뒤 형제를 품어요)
    return sanitizeHtml(keep).replace(/<(\/?)bl-keep-audio\b/g, '<$1audio').replace(/<bl-keep-input\b([^>]*)><\/bl-keep-input>/g, '<input$1>');
}
/** 내 글 줄 → 글 자리에 넣을 HTML(이름은 굵게 한 줄 · 대사 · 지문 줄) — inline: 자리가 span · p 처럼 문단을 못 품으면 <br> 로 */
export function slotHtml(model, inline = false) {
    const names = model?.names || [];
    const nameOf = who => names[who] || (who === 0 ? '깡통' : '깡캐');
    const rows = [];
    let prev = null;
    for (const l of model?.lines || []) {
        if (l.type === 'nr') { rows.push(l.html); prev = null; continue; }
        if (prev !== l.who) rows.push(`<b>${esc(nameOf(l.who))}</b>`);
        rows.push(l.rich || esc(l.text));
        prev = l.who;
    }
    return inline ? rows.join('<br>') : rows.map(r => `<p>${r}</p>`).join('');
}
/**
 * 마트 꼴이 아닌 글꾸에 내 글을 넣어요 — 고른 자리(path · 감싸는 몸통에서 자식 번호 길)나 자동 자리(guessSlot)의 안을 내 글로.
 * @param {{ parse: (html: string) => Document, guessSlot: Function, fromPath: Function }} dom
 */
export function fillSlot(html, model, path, dom) {
    if (!model?.lines?.length) return html;
    const doc = dom.parse(html), body = doc.body;
    const slot = (path && dom.fromPath(body, path)) || dom.guessSlot(body);
    if (!slot || slot === body || /^(STYLE|SCRIPT|AUDIO|INPUT|IMG|BR|SUMMARY)$/.test(slot.tagName)) return html;
    slot.innerHTML = slotHtml(model, /^(P|SPAN|B|I|EM|STRONG|A|LABEL|H[1-6])$/.test(slot.tagName));
    slot.classList.add('bl-own-slot');
    const styles = [...doc.head.querySelectorAll('style')].map(s => s.outerHTML).join('');
    return styles + body.innerHTML;
}
