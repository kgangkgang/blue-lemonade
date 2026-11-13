// 원본 블루레몬에이드 1122fac1 의 src/log-copy-pretty.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(글꾸 마트 「🍽️ 시식하기」가 테마 로그 복사와 같은 모양으로 그리려고 써요)
// 로그 복사 — 「HTML 복사」 코드를 사람이 읽고 고치기 쉬운 꼴로 (1.0.1 · 11-03 사용자 요구: 「사이트에 올리기 전에 수정하고 싶을 수도 있으니 인간 친화적으로」)
// ① 줄 나눔 · 2칸 들여쓰기는 띄어쓰기가 생겨도 화면에 안 나오는 자리에서만 넣어요 — 블록 칸의 맨 앞 · 맨 끝 · 블록 요소 바로 앞뒤(줄 끝 · 줄 머리 공백은 브라우저가 지워요),
//    flex · grid · 표 칸 사이(공백만 든 글은 그리지 않아요). 인라인 글 · 인라인 블록(알약 등) 사이에는 절대 안 넣고, white-space:pre* 가 걸린 요소 안은 손대지 않아요
//    → 붙인 곳에서 원래 한 줄 HTML 과 화소 단위로 같아요(tools/tests/log-copy-pretty.mjs · 리그 스크린샷 대조).
// ② 주석: 맨 앞 안내 한 줄(보이는 글씨는 전부 바꿔도 돼요) · 메시지마다 「▼ 메시지 N 시작 ~ ▲ 메시지 N 끝」 · 메시지 안 「이름」 · 「본문」 · 머리 칸(제목 · 날짜 · 보낸 이 · 꼬리말 … (글자만 바꿔요))
//    · 틀이 그리는 꾸밈 글(겉면 글 · 표지판 · 도장 …)도 「꾸밈 글 「…」 (글자만 바꿔요)」.
//    자리는 렌더러가 단 미리보기 표시로 찾아요: data-bl-msg(메시지) · data-bl-name(이름) · data-bl-body(본문 칸, 없으면 이름 바로 뒤) · data-f="title" 등(고칠 칸).
//    data-bl-* 는 걷고 data-f 는 남겨요(안내 주석이 「data-f 칸의 글자만 바꿔요」라고 가리켜요).
// DOM 없는 순수 함수(node 로 시험) · 시작 그래프 밖 — 로그 복사 시트(log-copy-sheet.js)와 tools/mart-build.mjs 가 불러요.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title', 'xmp']);
const PRE_TAGS = new Set(['pre', 'textarea', 'listing', 'xmp', 'plaintext']);
const HIDDEN_TAGS = new Set(['style', 'script', 'template', 'title', 'head', 'meta', 'link', 'base', 'noscript']);
const TAG_DISPLAY = {
    div: 'block', p: 'block', section: 'block', article: 'block', aside: 'block', header: 'block', footer: 'block', nav: 'block', main: 'block',
    blockquote: 'block', figure: 'block', figcaption: 'block', details: 'block', summary: 'block', ul: 'block', ol: 'block', dl: 'block', dt: 'block', dd: 'block',
    h1: 'block', h2: 'block', h3: 'block', h4: 'block', h5: 'block', h6: 'block', hr: 'block', pre: 'block', address: 'block', fieldset: 'block', form: 'block', center: 'block',
    li: 'list-item', table: 'table', caption: 'table-caption', thead: 'table-header-group', tbody: 'table-row-group', tfoot: 'table-footer-group', tr: 'table-row',
    td: 'table-cell', th: 'table-cell', colgroup: 'table-column-group', col: 'table-column',
};
const BLOCK_LEVEL = /^(block|list-item|table|flex|grid|flow-root|table-[a-z-]+|block flow|block flex|block grid|block table|block flow-root)$/;
const BLOCK_CONTAINER = /^(block|inline-block|list-item|flow-root|table-cell|table-caption|block flow|inline flow-root|block flow-root)$/;
const FLEXISH = /^(flex|inline-flex|grid|inline-grid|block flex|inline flex|block grid|inline grid)$/;
const TABLEISH = /^(table|inline-table|table-row-group|table-header-group|table-footer-group|table-row|table-column-group)$/;
const WS = /^[ \t\n\r\f]*$/;

// ── 읽기: HTML 글 → 나무 (태그 글자를 그대로 들고 있어서 다시 쓰면 원래 글과 같아요) ──
const OPEN = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/y;
const CLOSE = /<\/([a-zA-Z][\w:-]*)\s*>/y;

/** @returns {{ type: 'root', children: any[] } | null} 못 읽으면 null */
export function parseHtml(html) {
    const src = String(html ?? '');
    const root = { type: 'root', children: [], parent: null };
    const stack = [root];
    const add = node => { const top = stack[stack.length - 1]; node.parent = top; top.children.push(node); return node; };
    const text = (value) => {
        if (!value) return;
        const top = stack[stack.length - 1], last = top.children[top.children.length - 1];
        if (last?.type === 'text') last.text += value; else add({ type: 'text', text: value });
    };
    let i = 0;
    while (i < src.length) {
        const lt = src.indexOf('<', i);
        if (lt < 0) { text(src.slice(i)); break; }
        text(src.slice(i, lt));
        i = lt;
        if (src.startsWith('<!--', i)) {
            const end = src.indexOf('-->', i + 4);
            if (end < 0) return null;
            add({ type: 'comment', raw: src.slice(i, end + 3) });
            i = end + 3;
            continue;
        }
        if (src.startsWith('<!', i) || src.startsWith('<?', i)) {   // <!doctype …> 같은 것 — 그대로 둬요
            const end = src.indexOf('>', i);
            if (end < 0) return null;
            add({ type: 'comment', raw: src.slice(i, end + 1), other: true });
            i = end + 1;
            continue;
        }
        CLOSE.lastIndex = i;
        const close = CLOSE.exec(src);
        if (close) {
            const name = close[1].toLowerCase();
            let k = stack.length - 1;
            while (k > 0 && stack[k].tag !== name) k--;
            if (k === 0) return null;   // 짝 없는 닫는 태그 — 손대지 않아요
            if (k !== stack.length - 1) return null;   // 안 닫힌 요소가 끼어 있음
            stack[k].closeRaw = close[0];
            stack.length = k;
            i = CLOSE.lastIndex;
            continue;
        }
        OPEN.lastIndex = i;
        const open = OPEN.exec(src);
        if (!open) { text('<'); i += 1; continue; }
        const tag = open[1].toLowerCase();
        const node = add({ type: 'el', tag, open: open[0], attrs: open[2], children: [], closeRaw: '' });
        i = OPEN.lastIndex;
        if (VOID.has(tag) || open[3]) continue;
        if (RAW.has(tag)) {
            const end = src.toLowerCase().indexOf(`</${tag}`, i);
            if (end < 0) return null;
            if (end > i) node.children.push({ type: 'text', text: src.slice(i, end), parent: node, raw: true });
            CLOSE.lastIndex = end;
            const c = CLOSE.exec(src);
            if (!c) return null;
            node.closeRaw = c[0];
            i = CLOSE.lastIndex;
            continue;
        }
        stack.push(node);
    }
    if (stack.length !== 1) return null;
    return root;
}

// ── 요소 성질 (인라인 style 과 태그 기본값만 봐요 — 복사 HTML 은 인라인 style 만 써요) ──
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
/** 속성 목록 [{ name, value, start, end }] — start · end 는 여는 태그 글(open) 안 자리(앞 공백 포함) */
function attrsOf(node) {
    if (node._attrs) return node._attrs;
    const list = [];
    const base = 1 + node.tag.length;   // '<' + 태그 이름 뒤 = 속성 글(attrs)이 시작하는 자리
    let prev = base;
    for (const m of node.attrs.matchAll(ATTR)) {
        const end = base + m.index + m[0].length;
        list.push({ name: m[1].toLowerCase(), value: m[2] ?? m[3] ?? m[4] ?? '', start: prev, end });
        prev = end;
    }
    node._attrs = list;
    return list;
}
const attrValue = (node, name) => attrsOf(node).find(a => a.name === name)?.value ?? null;
const unescapeAttr = value => String(value ?? '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function styleOf(node) {
    if (node._style) return node._style;
    const out = {};
    const raw = attrValue(node, 'style');
    if (raw) {
        for (const part of unescapeAttr(raw).split(';')) {
            const colon = part.indexOf(':');
            if (colon < 0) continue;
            const key = part.slice(0, colon).trim().toLowerCase();
            const value = part.slice(colon + 1).replace(/!\s*important\s*$/i, '').trim().toLowerCase().replace(/\s+/g, ' ');
            if (key) out[key] = value;
        }
    }
    node._style = out;
    return out;
}
function displayOf(node) {
    const own = styleOf(node).display;
    if (own) return own;
    if (attrValue(node, 'hidden') !== null) return 'none';
    if (HIDDEN_TAGS.has(node.tag)) return 'none';
    return TAG_DISPLAY[node.tag] ?? 'inline';
}
const isPreEl = node => node.type === 'el' && (PRE_TAGS.has(node.tag) || /^(pre|pre-wrap|pre-line|break-spaces)\b/.test(styleOf(node)['white-space'] ?? ''));
const outOfFlow = (node) => {
    const s = styleOf(node);
    return /^(absolute|fixed)$/.test(s.position ?? '') || /^(left|right|inline-start|inline-end)$/.test(s.float ?? '');
};
/** 줄 나눔 판단용 갈래: skip(공백 판단에 안 끼어요 — 주석 · 공백 글 · 안 보이는 요소 · 흐름 밖 요소) · block(흐름 안 블록) · inline */
function kindOf(node) {
    if (node.type === 'comment') return 'skip';
    if (node.type === 'text') return WS.test(node.text) ? 'skip' : 'inline';
    const display = displayOf(node);
    if (display === 'none') return 'skip';
    if (outOfFlow(node)) return 'skip';
    return BLOCK_LEVEL.test(display) ? 'block' : 'inline';
}
/** 그 요소 안 자식 사이에 줄을 넣을 수 있는 갈래: block(블록 칸) · any(flex · grid · 공백만 든 표 칸) · none */
function containerOf(node) {
    if (node.type === 'root') return 'block';
    if (RAW.has(node.tag) || VOID.has(node.tag)) return 'none';
    const display = displayOf(node);
    if (FLEXISH.test(display)) return 'any';
    if (TABLEISH.test(display)) return node.children.every(c => c.type !== 'text' || WS.test(c.text)) ? 'any' : 'none';
    if (BLOCK_CONTAINER.test(display)) return 'block';
    return 'none';
}
/** 자식 i 앞(i = 자식 수면 닫는 태그 앞)에 줄 나눔을 넣어도 모양이 그대로인가 */
function safeAt(children, i, container) {
    if (container === 'any') return true;
    if (container !== 'block') return false;
    let before = true;
    for (let j = i - 1; j >= 0; j--) { const k = kindOf(children[j]); if (k === 'skip') continue; before = k === 'block'; break; }
    if (before) return true;
    for (let j = i; j < children.length; j++) { const k = kindOf(children[j]); if (k === 'skip') continue; return k === 'block'; }
    return true;
}
/** 줄을 나눌 만한 요소: 주석 · 블록 자식 · 흐름 밖 장식 · 안에 줄이 생기는 칸(인라인 블록 말풍선 등)이 있거나, flex · 표처럼 자식 요소가 둘 이상 */
function structural(node, container) {
    if (container === 'none') return false;
    if (node.children.some(c => c.type === 'comment' || (c.type === 'el' && (kindOf(c) === 'block' || (kindOf(c) === 'skip' && displayOf(c) !== 'none') || (c.closeRaw && containerOf(c) !== 'none' && c.children.some(g => g.type === 'el')))))) return true;
    return container === 'any' && node.children.filter(c => c.type === 'el').length > 1;
}

const MARK_ATTR = /\s+data-bl-(?!egg\b|peek\b)[\w-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/gi;   // 못 읽은 HTML 을 한 줄로 돌려줄 때만
/** 여는 태그 글 그대로 — 미리보기 표시(data-bl-*)만 빼고 (1.0.1 누르면 반응 data-bl-egg 는 모양이라 남겨요)
 *  11-09 data-bl-peek(미리보기로만 펼친 상자)도 남겨요 — 글꾸 마트는 이 글을 미리보기로 보여 주고 복사할 때 shutPeek 로 닫아요(테마 로그 복사 창은 result 에서 먼저 닫아 이 표시가 오지 않아요) */
function openTag(node) {
    const marks = attrsOf(node).filter(a => a.name.startsWith('data-bl-') && a.name !== 'data-bl-egg' && a.name !== 'data-bl-peek');
    if (!marks.length) return node.open;
    let out = node.open;
    for (const a of marks.reverse()) out = out.slice(0, a.start) + out.slice(a.end);
    return out;
}

// ── 쓰기 ──
/** pretty: 줄 나눔 · 들여쓰기 · 주석, 아니면 한 줄(주석 빼고) — 둘 다 data-bl-* 는 걷어요 */
export function printHtml(root, { pretty = true, indent = '  ', comments = pretty } = {}) {
    const out = [];
    const emit = (node, depth, pre) => {
        if (node.type === 'text') { out.push(node.text); return; }
        if (node.type === 'comment') { if (comments || node.other) out.push(node.raw); return; }
        out.push(openTag(node));
        if (!node.closeRaw) return;   // 빈 요소(br · img …)
        const inPre = pre || isPreEl(node);
        const container = !pretty || inPre ? 'none' : containerOf(node);
        const breaking = structural(node, container);
        const n = node.children.length;
        for (let i = 0; i < n; i++) {
            if (breaking && safeAt(node.children, i, container)) out.push('\n' + indent.repeat(depth + 1));
            emit(node.children[i], depth + 1, inPre);
        }
        if (breaking && n && safeAt(node.children, n, container)) out.push('\n' + indent.repeat(depth));
        out.push(node.closeRaw);
    };
    root.children.forEach((child, i) => {
        if (pretty && i && safeAt(root.children, i, 'block')) out.push('\n');
        emit(child, 0, false);
    });
    return out.join('');
}

// ── 주석 달기 ──
const FIELD_LABEL = { title: '제목', date: '날짜', from: '보낸 이', tail: '꼬리말', mark: '알약(LOG)', char: '깡통', model: '모델', prompt: '프롬프트', info: '추가 정보', page: '쪽 번호', subtitle: '부제', count: '메시지 수' };
/** 주석 안에 넣어도 되는 글: 「--」 · 「>」 시작이 주석을 끝내지 않게 */
const safeComment = text => String(text ?? '').replace(/[\r\n\t]+/g, ' ').replace(/-{2,}/g, '–').replace(/^[>-]+/, '').replace(/[<>]/g, ch => (ch === '<' ? '‹' : '›')).trim();
const commentNode = (text, parent) => ({ type: 'comment', raw: `<!-- ${text} -->`, parent });
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const textOf = node => (node.type === 'text' ? node.text : node.type === 'el' && !RAW.has(node.tag) ? node.children.map(textOf).join('') : '');
const hasAttr = (node, name) => node.type === 'el' && attrValue(node, name) !== null;
function findAll(node, test, { into = () => true } = {}) {
    const out = [];
    const walk = (n) => { for (const c of n.children ?? []) { if (c.type !== 'el') continue; if (test(c)) { out.push(c); if (!into(c)) continue; } walk(c); } };
    walk(node);
    return out;
}
const contains = (outer, inner) => { for (let n = inner; n; n = n.parent) if (n === outer) return true; return false; };
const insertBefore = (node, text) => { const p = node.parent; p.children.splice(p.children.indexOf(node), 0, commentNode(text, p)); };
const insertAfter = (node, text) => { const p = node.parent; p.children.splice(p.children.indexOf(node) + 1, 0, commentNode(text, p)); };

export const LEGEND_HINT = '메시지를 늘리려면 「▼ 메시지 N 시작」부터 「▲ 메시지 N 끝」까지 통째로 복사해 그 끝 바로 뒤에 붙여요';
function annotate(root, label, fields = true) {
    const messages = findAll(root, n => hasAttr(n, 'data-bl-msg'), { into: () => false });
    messages.forEach((message, i) => {
        const name = findAll(message, n => hasAttr(n, 'data-bl-name'))[0] ?? null;
        const body = findAll(message, n => hasAttr(n, 'data-bl-body'))[0] ?? null;
        if (body && !(name && contains(body, name))) body.children.unshift(commentNode('본문', body));
        else if (name) insertAfter(name, '본문');
        else message.children.unshift(commentNode('본문', message));
        if (name) insertBefore(name, '이름');
        const who = safeComment(decode(name ? textOf(name) : unescapeAttr(attrValue(message, 'data-bl-who') ?? ''))).slice(0, 40);
        insertBefore(message, `▼ 메시지 ${i + 1} 시작${who ? ` — ${who}` : ''}${i === 0 ? ` · ${LEGEND_HINT}` : ''}`);
        insertAfter(message, `▲ 메시지 ${i + 1} 끝`);
    });
    for (const field of findAll(root, n => hasAttr(n, 'data-f'))) {
        const key = attrValue(field, 'data-f');
        insertBefore(field, `${FIELD_LABEL[key] ?? safeComment(key)} (글자만 바꿔요)`);
    }
    // 꾸밈 글(1.0.1 사용자 「보이는 글씨는 다 수정 가능하다는 것도」): 메시지 · 고칠 칸 밖에서 틀이 그리는 글(겉면 글 · 표지판 · 역 이름 · 도장 · R.I.P …)도
    // 그 요소 바로 앞에 「꾸밈 글 「…」 (글자만 바꿔요)」 주석 — 이름 · 본문과 같은 눈높이로 찾아요. 글자 · 숫자가 없는 조각(이모지 · 점 · 별)은 빼요.
    const inEditable = n => { for (let q = n; q; q = q.parent) if (q.type === 'el' && (hasAttr(q, 'data-f') || hasAttr(q, 'data-bl-msg'))) return true; return false; };
    const decoText = [];
    const walk = (n) => {
        for (const c of n.children ?? []) {
            if (c.type === 'text') { if (n.type === 'el' && !decoText.includes(n) && /[\p{L}\p{N}]/u.test(decode(c.text)) && !inEditable(n)) decoText.push(n); }
            else if (c.type === 'el' && !RAW.has(c.tag)) walk(c);
        }
    };
    if (messages.length) walk(root);   // 로그 HTML 일 때만(메시지가 있는 글)
    for (const el of decoText) insertBefore(el, `꾸밈 글 「${safeComment(decode(textOf(el))).slice(0, 24)}」 (글자만 바꿔요)`);
    const title = safeComment(label);
    const where = fields ? '그 주석 바로 아래 data-f="title" · "date" · "from" · "tail" 칸' : '그 주석 바로 아래 칸';
    root.children.unshift(commentNode(`블루레몬에이드 로그 복사${title ? ` · 「${title}」` : ''} — 보이는 글씨(제목 · 꼬리말 · 이름 · 본문 · 날짜 · 꾸밈 글)는 전부 바꿔도 돼요 · 제목 · 날짜 · 보낸 이 · 꼬리말은 ${where}의 글자만 바꿔요 · ${LEGEND_HINT} · 본문 줄바꿈은 <br> · 이런 주석은 지워도 모양이 그대로예요`, root));
    return messages.length;
}

/** 줄 나눔 · 주석을 걷은 비교용 글(pretty 가 넣은 것만 걷어요 — 「\n + 공백」 은 원래 글에도 똑같이 걷어요) */
export function plainOf(root) {
    const out = [];
    const emit = (node, pre) => {
        if (node.type === 'text') { out.push(pre || node.raw ? node.text : node.text.replace(/\n[ ]*/g, '')); return; }
        if (node.type === 'comment') { if (node.other) out.push(node.raw); return; }
        out.push(openTag(node));
        if (!node.closeRaw) return;
        const inPre = pre || isPreEl(node);
        for (const c of node.children) emit(c, inPre);
        out.push(node.closeRaw);
    };
    root.children.forEach(c => emit(c, false));
    return out.join('');
}

/**
 * 사람이 고치기 쉬운 HTML — 렌더러 · 미리보기 표시(data-bl-msg · data-bl-name · data-bl-body · data-f)가 남은 HTML 을 받아요.
 * 못 읽는 HTML 이면(짝 안 맞는 태그 등) 한 줄 그대로(표시만 걷어서) 돌려줘요.
 * @param {string} html
 * @param {{ label?: string, indent?: string }} [options] label: 틀 이름(안내 주석에 들어가요)
 * @returns {string}
 */
export function prettyLogHtml(html, { label = '', indent = '  ', head = '', fields = true } = {}) {
    const source = String(head ?? '') + String(html ?? '').trim();   // head: 맨 앞에 붙일 것(1.0.1 글꾸 움직임 <style>) — 안내 주석 바로 아래로 가요
    const tree = parseHtml(source);
    if (!tree) return source.replace(/<[a-zA-Z][^<>]*>/g, tag => tag.replace(MARK_ATTR, ''));
    const want = plainOf(tree);
    annotate(tree, label, fields);
    const pretty = printHtml(tree, { indent });
    const again = parseHtml(pretty);   // 다시 읽어 주석 · 줄 나눔만 걷으면 원래와 같아야 해요(아니면 한 줄로)
    // fields: false(글꾸 마트 「📋 HTML 복사」 — 커뮤니티 편집기는 style · aria-hidden · open · data-bl-egg 만 살려요): 고칠 칸 표시 data-f 도 걷어요(주석이 자리를 알려 줘요)
    const noFields = text => (fields ? text : text.replace(/(<[a-zA-Z][^<>]*?)\s+data-f="[^"]*"/g, '$1'));
    if (!again || plainOf(again) !== want) return noFields(want);
    return noFields(pretty);
}
