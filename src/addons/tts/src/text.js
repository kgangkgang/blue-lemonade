// TTS · 글 나누기
// 메시지 원문 → 순서대로 놓인 조각(Segment): 대화문 · 서술 · 행동 · 속마음
// ST 모듈을 쓰지 않는다 (node 로 단독 테스트: tests/text.test.mjs).
//
// Segment = { kind, text, raw, color, tags, speakerHint, line }
//   kind        'dialogue' | 'narration' | 'action' | 'thought'
//   text        읽을 글 (여닫이 글자·마크다운 뺌). text === '' 이면 속마음 마커(이름만 전달, 읽지 않음)
//   raw         강조 검색용 원문 조각 (태그·마크다운 없음, 줄바꿈은 그대로)
//   color       감싼 <span style="color"> / <font color> / 데우스 #hex "…" 의 색 '#rrggbb' 또는 null
//   tags        감싼 표현 태그 (shout, whispering …) 바깥→안, 소문자
//   speakerHint 이름 표시가 있으면 그 이름: true_thoughts character= · "이름: 「" · 이름「 · 보이는 속마음 라벨
//   line        원문 줄 번호 (0부터, <br> 도 줄바꿈으로 셈)
//
// segmentMessage(rawText, opts)
//   opts = { skipTags:Set, skipCode:true, stripRegex:[RegExp], userName, charName, knownNames:[],
//            final:true,            // false = 답장이 아직 오는 중 → 끝의 덜 끝난 조각은 내지 않음
//            routes:{ thought } }   // thought 가 'skip' 이 아니면 true_thoughts 내용을 속마음 조각으로 냄
//
// 설계(§5.5)와 다른 점: 서술은 빈 줄 문단이 아니라 줄마다 나눈다 — 화자 배우기(speakers.js)가 줄 단위로 판정하고,
// 재생기가 같은 목소리의 이웃 조각을 다시 합치므로 읽기 결과는 같다.
//
// parseRegexLines(text) → RegExp[]: 설정의 "지울 글(정규식)" 줄들. index.js · player.js · speakers.js 가 같은 규칙을 쓴다.

export const EXPRESSIVE_TAGS = new Set(['shout', 'quiet', 'angry', 'excited', 'dizzy', 'crying', 'anxious', 'hurt', 'intoxicated', 'whispering', 'whisper', 'trembling', 'deadpan']);
// 닫는 태그가 없으면 글 끝까지 지우는 건너뛸 태그 (블록)
const BLOCK_SKIP = new Set(['details', 'tracker', 'scene_plan', 'think', 'thinking', 'reasoning']);
// 내용이 없는 태그
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'wbr', 'source', 'meta', 'link', 'area', 'col', 'embed', 'track', 'param']);
// 줄을 나누는 블록 태그 (앞뒤에 줄바꿈을 넣어 서술이 붙지 않게)
const BLOCK_TAGS = new Set(['p', 'div', 'li', 'ul', 'ol', 'dl', 'dt', 'dd', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'hr', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'main', 'figure', 'figcaption', 'summary', 'details', 'table', 'thead', 'tbody', 'tfoot']);
const TAG_RE = /<(\/?)([a-zA-Z_][\w:.-]*)((?:\s[^<>]*)?)>/g;

// 대화문 여닫이 글자: 여는 글자 → 닫는 글자 (ASCII ' 는 안 씀)
const CLOSER = { '“': '”', '"': '"', '「': '」', '『': '』', '«': '»', '＂': '＂', '‘': '’' };
const ONE_LINE = new Set(['"', '＂']); // 좌우 같은 모양 → 한 줄 안에서만 짝을 찾음
const LETTER = /[\p{L}\p{N}]/u;
const ACTION_RE = /(?<!\*)\*(?![*\s])([^*\n]+?)(?<!\s)\*(?!\*)/g; // *행동* (**굵게** 는 아님)
const LABEL_RE = /^\*?\s*(.+?)\s+true\s+thoughts?\s*[:：]\s*/i;   // 보이는 속마음 라벨 "*Name true thoughts: …*"

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const NAMED_COLORS = {
    black: '#000000', white: '#ffffff', red: '#ff0000', lime: '#00ff00', blue: '#0000ff', yellow: '#ffff00',
    cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff', silver: '#c0c0c0', gray: '#808080',
    grey: '#808080', maroon: '#800000', olive: '#808000', green: '#008000', purple: '#800080', teal: '#008080',
    navy: '#000080', orange: '#ffa500', pink: '#ffc0cb', gold: '#ffd700', violet: '#ee82ee', brown: '#a52a2a',
};

// ---------- 작은 도구

function decodeEntities(s) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#[xX][0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z]{2,8});/g, (m, e) => {
        if (e[0] === '#') {
            const n = /^#[xX]/.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
        }
        const v = ENTITIES[e.toLowerCase()];
        return v === undefined ? m : v;
    });
}

/** CSS 색 → '#rrggbb' (소문자) 또는 null */
export function normColor(v) {
    if (v == null) return null;
    const c = String(v).trim().toLowerCase().replace(/\s*!important$/, '');
    let m = /^#([0-9a-f]{3})[0-9a-f]?$/.exec(c);
    if (m) return '#' + m[1].split('').map(x => x + x).join('');
    m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(c);
    if (m) return '#' + m[1];
    m = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/.exec(c);
    if (m) return '#' + [m[1], m[2], m[3]].map(n => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
    return NAMED_COLORS[c] || null;
}

function attrValue(attrs, name) {
    const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|“([^”]*)”|([^\\s"'>]+))`, 'i').exec(attrs);
    return m ? (m[1] ?? m[2] ?? m[3] ?? m[4]) : null;
}

/** 태그 속성에서 색: style="…color:#x…" (모든 태그) · <font color="#x"> */
function colorOf(name, attrs) {
    if (!attrs) return null;
    const style = attrValue(attrs, 'style');
    if (style) {
        const c = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
        if (c) { const n = normColor(c[1]); if (n) return n; }
    }
    if (name === 'font') return normColor(attrValue(attrs, 'color'));
    return null;
}

function characterAttr(attrs) {
    if (!attrs) return null;
    const m = /\bcharacter\s*=\s*["“'‘]?\s*([^"”“'‘’<>\s]+)/i.exec(attrs);
    return m ? m[1] : null;
}

/** [a, e) 를 빈칸으로 (줄바꿈은 남겨 줄 번호를 지킴) */
function blank(s, a, e) {
    if (e <= a) return s;
    return s.slice(0, a) + s.slice(a, e).replace(/[^\n]/g, ' ') + s.slice(e);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

/** 마크다운 표시·매크로·안 보이는 글자 지우기 (태그는 이미 없음) */
function stripMarkup(s) {
    return s
        .replace(/[\u200b-\u200f\u2028\u2029\ufeff]/g, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')            // 그림
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')         // 링크 → 글
        .replace(/\{\{[^{}]*\}\}/g, '')                  // 남은 매크로 {{img::…}}
        .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')        // 제목 #
        .replace(/^[ \t]*>[ \t]?/gm, '')                 // 인용 >
        .replace(/^[ \t]*[-+*][ \t]+/gm, '')             // 목록 표시 -
        .replace(/`+/g, '')                              // 코드 표시
        .replace(/~~(?=\S)([^~\n]+?)(?<=\S)~~/g, '$1')  // ~~취소선~~ 만 (늘임 "쨔~~~앙" 은 그대로)
        .replace(/\*\*|__/g, '')
        .replace(/\*/g, '')
        .replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, '');
}

/** 설정의 정규식 줄들 → RegExp[] (한 줄에 하나; "/패턴/플래그" 꼴도 됨; 항상 g 를 붙임; 잘못된 줄은 건너뜀) */
export function parseRegexLines(text) {
    const out = [];
    for (const line of String(text || '').split('\n')) {
        const t = line.trim();
        if (!t) continue;
        const m = /^\/(.+)\/([a-z]*)$/.exec(t);
        try { out.push(m ? new RegExp(m[1], m[2].includes('g') ? m[2] : `${m[2]}g`) : new RegExp(t, 'g')); }
        catch { /* 잘못된 정규식은 건너뜀 */ }
    }
    return out;
}

/** 자유 글 → 읽을 글 (태그·엔티티·마크다운 정리, 공백 모음) */
export function stripForSpeech(text) {
    const s = String(text ?? '').replace(/\r\n?/g, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<!--[\s\S]*?(?:-->|$)/g, ' ');
    return stripMarkup(decodeEntities(s.replace(TAG_RE, ' '))).replace(/\s+/g, ' ').trim();
}

/** 글의 언어: 한글 → ko · 가나 → ja · 한자만 → zh · 라틴 → en · 모름 → '' */
export function detectLang(text) {
    const s = String(text ?? '');
    const count = (re) => (s.match(re) || []).length;
    const h = count(/[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]/g);
    const k = count(/[\u3040-\u30ff\u31f0-\u31ff]/g);
    const c = count(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
    const l = count(/[A-Za-z\u00c0-\u024f]/g);
    if (h && h >= k && h * 4 >= l) return 'ko';
    if (k && k * 4 >= l) return 'ja';
    if (c && !k && !h && c * 4 >= l) return 'zh';
    if (l) return 'en';
    return h ? 'ko' : k ? 'ja' : c ? 'zh' : '';
}

// ---------- 1~3단계: 정리 · 건너뛸 태그

function normalizeSkipTags(v) {
    const list = v instanceof Set ? [...v] : Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
    return new Set(list.map(x => String(x).trim().toLowerCase()).filter(Boolean));
}

function globalRe(rx) {
    try {
        if (rx instanceof RegExp) return rx.flags.includes('g') ? rx : new RegExp(rx.source, rx.flags + 'g');
        if (typeof rx === 'string' && rx.trim()) return new RegExp(rx, 'g');
    } catch { /* 잘못된 정규식은 건너뜀 */ }
    return null;
}

/** 코드 블록(```…``` · ~~~…~~~)을 빈칸으로. 줄 머리에서 시작한 것만 (글 속 "쨔~~~앙" 은 아님); 안 닫힌 ``` 는 끝까지 */
function blankFences(work) {
    const lines = work.split('\n');
    const ranges = [];
    let open = -1, ch = '';
    for (let i = 0; i < lines.length; i++) {
        const m = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/.exec(lines[i]);
        if (!m) continue;
        if (open < 0) { if (m[1][0] === '`' && m[2].includes('`')) continue; open = i; ch = m[1][0]; }
        else if (m[1][0] === ch && !m[2].trim()) { ranges.push([open, i]); open = -1; }
    }
    if (open >= 0 && ch === '`') ranges.push([open, lines.length - 1]);
    for (const [a, e] of ranges) for (let i = a; i <= e; i++) lines[i] = ' '.repeat(lines[i].length);
    return lines.join('\n');
}

/** 이름이 name 인 여는 태그 뒤(from)에서 짝이 되는 닫는 태그의 끝 위치, 없으면 -1 (겹침을 셈) */
function findClose(s, name, from) {
    const re = new RegExp(`<(\\/?)${escapeRe(name)}(?=[\\s/>])[^<>]*>`, 'gi');
    re.lastIndex = from;
    let depth = 1, m;
    while ((m = re.exec(s))) {
        if (m[1]) { if (--depth === 0) return m.index + m[0].length; }
        else if (!/\/\s*>$/.test(m[0])) depth++;
    }
    return -1;
}

/** 건너뛸 태그 짝을 내용까지 빈칸으로. 안 닫힘: 블록 태그는 끝까지, 그 밖은 태그만 */
function blankSkipTags(work, skip) {
    if (!skip.size) return work;
    const re = new RegExp(TAG_RE.source, 'g');
    let m;
    while ((m = re.exec(work))) {
        const name = m[2].toLowerCase();
        if (!skip.has(name)) continue;
        const a = m.index, tagEnd = a + m[0].length;
        let e = tagEnd;
        if (!m[1] && !VOID_TAGS.has(name) && !/\/\s*$/.test(m[3] || '')) {
            const close = findClose(work, name, tagEnd);
            if (close >= 0) e = close;
            else if (BLOCK_SKIP.has(name)) e = work.length;
        }
        work = blank(work, a, e);
        re.lastIndex = e;
    }
    return work;
}

// ---------- 4단계: 태그를 벗기며 문맥(색·표현 태그·이름) 기록

function snapshot(stack) {
    const ctx = { color: null, colorEl: null, tags: [], hint: null, thoughtEl: null };
    for (const el of stack) {
        if (el.color) { ctx.color = el.color; ctx.colorEl = el; }
        if (el.expr) ctx.tags.push(el.expr);
        if (el.hint && !el.thought) ctx.hint = el.hint;
        if (el.thought) ctx.thoughtEl = el;
    }
    return ctx;
}

/** 태그 없는 글(flat)과, 글 구간마다의 문맥(runs) */
function flatten(work) {
    const runs = [], stack = [];
    let flat = '', ctx = null, seq = 0, last = 0, m;
    const emit = (chunk) => {
        if (!chunk) return;
        chunk = decodeEntities(chunk);
        if (!ctx) ctx = snapshot(stack);
        const start = flat.length;
        flat += chunk;
        const r = runs[runs.length - 1];
        if (r && r.ctx === ctx) r.end = flat.length; else runs.push({ start, end: flat.length, ctx });
    };
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(work))) {
        emit(work.slice(last, m.index));
        last = m.index + m[0].length;
        const nl = m[0].match(/\n/g);
        if (nl) emit(nl.join('')); // 태그 안 줄바꿈은 줄 번호 유지용으로 남김
        const name = m[2].toLowerCase(), attrs = m[3] || '';
        if (BLOCK_TAGS.has(name) && flat && !flat.endsWith('\n')) emit('\n');
        if (m[1]) { // 닫는 태그: 같은 이름 중 가장 안쪽까지 닫는다
            let i = stack.length - 1;
            while (i >= 0 && stack[i].name !== name) i--;
            if (i >= 0) { for (let k = stack.length - 1; k >= i; k--) stack[k].closed = true; stack.length = i; ctx = null; }
            continue;
        }
        if (VOID_TAGS.has(name) || /\/\s*$/.test(attrs)) continue;
        stack.push({
            id: ++seq, name, closed: false,
            color: colorOf(name, attrs),
            expr: EXPRESSIVE_TAGS.has(name) ? name : null,
            hint: characterAttr(attrs),
            thought: name === 'true_thoughts',
        });
        ctx = null;
    }
    emit(work.slice(last));
    return { flat, runs };
}

function ctxFinder(runs) {
    const empty = snapshot([]);
    return (pos) => {
        let lo = 0, hi = runs.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1, r = runs[mid];
            if (pos < r.start) hi = mid - 1; else if (pos >= r.end) lo = mid + 1; else return r.ctx;
        }
        return empty;
    };
}

function lineFinder(s) {
    const nl = [];
    for (let i = s.indexOf('\n'); i >= 0; i = s.indexOf('\n', i + 1)) nl.push(i);
    return (pos) => { // pos 앞의 줄바꿈 수
        let lo = 0, hi = nl.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (nl[mid] < pos) lo = mid + 1; else hi = mid; }
        return lo;
    };
}

// ---------- 5단계: 대화문 짝 찾기

function paraEnd(s, from) { // 다음 빈 줄(문단 끝) 위치, 없으면 -1
    const re = /\n[ \t]*\n/g;
    re.lastIndex = from;
    const m = re.exec(s);
    return m ? m.index : -1;
}

function findCloser(s, closer, from, to) {
    for (let k = s.indexOf(closer, from); k >= 0 && k < to; k = s.indexOf(closer, k + 1)) {
        if (closer === '’' && LETTER.test(s[k + 1] || '')) continue; // don’t 의 ’ 는 닫는 글자가 아님
        return k;
    }
    return -1;
}

/** 대화문 구간 [{start,end,is,ie,complete}] — start/end 는 여닫이 글자 포함, is/ie 는 안쪽 */
function scanDialogue(body, final) {
    const out = [], n = body.length;
    let i = 0;
    while (i < n) {
        const ch = body[i], closer = CLOSER[ch];
        if (!closer || (ch === '‘' && LETTER.test(body[i - 1] || ''))) { i++; continue; }
        const oneLine = ONE_LINE.has(ch);
        let bound = oneLine ? body.indexOf('\n', i) : paraEnd(body, i);
        if (bound < 0) bound = n;
        const j = findCloser(body, closer, i + 1, bound);
        if (j >= 0) { out.push({ start: i, end: j + 1, is: i + 1, ie: j, complete: true }); i = j + 1; continue; }
        if (!/\S/.test(body.slice(bound))) { // 글 끝에서 안 닫힘: 다 온 글이면 끝까지 대화문, 오는 중이면 내지 않음
            out.push({ start: i, end: n, is: i + 1, ie: n, complete: !!final });
            break;
        }
        if (oneLine) { i++; continue; } // 한 줄 안에 짝이 없는 " 는 그냥 글자
        out.push({ start: i, end: bound, is: i + 1, ie: bound, complete: true }); // 여러 문단 대화의 첫 문단
        i = bound;
    }
    return out;
}

// ---------- 본체

// 1.2.4: 사용자의 "지울 글" 줄이 <true_thoughts> 태그까지 지우면 (데우스 정리 줄 `</?(…|true_thoughts)[^>]*>`) 속마음 조각이 하나도 안 생겨
// 속마음을 누르면 원문과 짝을 못 찾고 화면(번역) 글을 읽었다 → 지우기 동안 태그만 자리표(사용 영역 글자)로 바꿔 두었다가 되돌린다.
// 안의 글은 다른 줄의 규칙을 그대로 받는다. 속마음을 읽을지는 routes.thought 가 정한다
const THOUGHT_TAG_RE = /<\/?true_thoughts\b[^<>]*>/gi;
const HOLD_RE = /\uE000(\d+)\uE001/g;
function applyStrip(work, list) {
    const rxs = (list || []).map(globalRe).filter(Boolean);
    if (!rxs.length) return work;
    const kept = [];
    work = work.replace(THOUGHT_TAG_RE, (m) => { kept.push(m); return `\uE000${kept.length - 1}\uE001`; });
    for (const g of rxs) work = work.replace(g, '');
    return kept.length ? work.replace(HOLD_RE, (m, i) => kept[Number(i)] ?? '') : work;
}

export function segmentMessage(rawText, opts = {}) {
    const final = opts.final !== false;
    const skipCode = opts.skipCode !== false;
    const skip = normalizeSkipTags(opts.skipTags);
    skip.delete('true_thoughts'); // 속마음은 따로 다룬다 (이름 마커를 남겨야 함)
    const readThought = !!(opts.routes && opts.routes.thought && opts.routes.thought !== 'skip');
    const known = new Set([...(opts.knownNames || []), opts.userName, opts.charName].filter(Boolean).map(n => String(n).toLowerCase().replace(/\s+/g, '')));
    const isKnown = (name) => !known.size || known.has(String(name).toLowerCase().replace(/\s+/g, ''));

    // 1~2. 정리
    let work = String(rawText ?? '').replace(/\r\n?/g, '\n');
    if (!work.trim()) return [];
    work = applyStrip(work, opts.stripRegex);
    if (skipCode) work = blankFences(work);
    work = work.replace(/<!--[\s\S]*?(?:-->|$)/g, m => m.replace(/[^\n]/g, ' '));
    work = work.replace(/<br\s*\/?>/gi, '\n');
    // 3. 건너뛸 태그
    work = blankSkipTags(work, skip);
    // 데우스 맨 색 표기  #e63946 "…"  → <font>
    work = work.replace(/(^|\s)#([0-9a-fA-F]{6})[ \t]*("[^"\n]*"|“[^”\n]*”|「[^」\n]*」|『[^』\n]*』)/g, '$1<font color="#$2">$3</font>');
    // 4. 태그 벗기기
    const { flat, runs } = flatten(work);
    const ctxAt = ctxFinder(runs);
    const lineAt = lineFinder(flat);
    const pieces = []; // { kind, pos, end, slice, ctx, hint, complete }

    // 속마음 블록: 이름 마커 (또는 읽을 때는 내용) — 그 자리는 빈칸으로
    let body = flat;
    for (let i = 0; i < runs.length; i++) {
        const el = runs[i].ctx.thoughtEl;
        if (!el) continue;
        const start = runs[i].start;
        let end = runs[i].end;
        while (i + 1 < runs.length && runs[i + 1].ctx.thoughtEl === el) end = runs[++i].end;
        body = blank(body, start, end);
        if (readThought) pieces.push({ kind: 'thought', pos: start, end, slice: flat.slice(start, end), ctx: runs[i].ctx, hint: el.hint, complete: final || el.closed });
        else if (el.hint) pieces.push({ kind: 'thought', pos: start, end, slice: '', ctx: runs[i].ctx, hint: el.hint, complete: true, marker: true });
    }

    // 5. 대화문
    const dialogs = scanDialogue(body, final);
    const colorWithQuote = new Set();
    for (const d of dialogs) { const c = ctxAt(d.start).colorEl; if (c) colorWithQuote.add(c); }

    // 7. 줄 앞 이름: "이름: 「" · 이름「 (첫 대화문이 정하고 그 줄의 대화문 모두에 붙임)
    const lineHint = new Map();
    const covered = [];
    for (const d of dialogs) {
        const line = lineAt(d.start);
        if (!lineHint.has(line)) {
            const ls = body.lastIndexOf('\n', d.start - 1) + 1;
            const prefix = body.slice(ls, d.start).replace(/[*_~`]/g, '');
            let name = null, m;
            if ((m = /^\s*([^\s:：「『“"]{1,20})\s*[:：]\s*$/.exec(prefix))) name = m[1];
            else if ((body[d.start] === '「' || body[d.start] === '『') && (m = /^\s*([^\s「『]{1,20})$/.exec(prefix)) && isKnown(m[1])) name = m[1];
            lineHint.set(line, name);
            if (name) covered.push([ls, d.start]); // 이름 표시는 읽지 않음
        }
        const ctx = ctxAt(d.start);
        pieces.push({ kind: 'dialogue', pos: d.start, end: d.end, slice: body.slice(d.is, d.ie), ctx, hint: lineHint.get(line) || ctx.hint, complete: d.complete });
        covered.push([d.start, d.end]);
    }

    // 5. 나머지: *행동* · 서술 (줄마다)
    covered.sort((a, b) => a[0] - b[0]);
    const gaps = [];
    let cur = 0;
    for (const [a, e] of covered) { if (a > cur) gaps.push([cur, a]); cur = Math.max(cur, e); }
    if (cur < body.length) gaps.push([cur, body.length]);
    const pushText = (kind, pos, end, slice, complete) => {
        if (!slice.trim()) return;
        const ctx = ctxAt(pos + (slice.length - slice.trimStart().length));
        let hint = ctx.hint, k = kind, text = slice;
        const label = (ctx.colorEl || kind === 'action') ? LABEL_RE.exec(slice.trim()) : null;
        if (label) { // 보이는 속마음 라벨
            k = 'thought';
            hint = label[1].replace(/^\*+|\*+$/g, '').replace(/['’]s$/i, '').trim() || hint;
            text = slice.trim().slice(label[0].length);
        } else if (kind === 'narration' && ctx.colorEl && (ctx.colorEl.name === 'span' || ctx.colorEl.name === 'font') && !colorWithQuote.has(ctx.colorEl)) {
            k = 'dialogue'; // 여닫이 글자 없이 색만 입힌 대사
            complete = final || ctx.colorEl.closed;
        }
        pieces.push({ kind: k, pos, end, slice: text, ctx, hint, complete, marker: k === 'thought' && !text.trim() && !!hint });
    };
    for (const [a, e] of gaps) {
        const g = body.slice(a, e);
        let last = 0, m;
        ACTION_RE.lastIndex = 0;
        const rest = []; // 행동을 뺀 나머지 [start, end)
        while ((m = ACTION_RE.exec(g))) {
            rest.push([last, m.index]);
            pushText('action', a + m.index, a + m.index + m[0].length, m[1], true);
            last = m.index + m[0].length;
        }
        rest.push([last, g.length]);
        for (const [rs, re] of rest) {
            let p = rs;
            while (p < re) {
                let q = g.indexOf('\n', p);
                if (q < 0 || q > re) q = re;
                if (q > p) pushText('narration', a + p, a + q, g.slice(p, q), final || body.indexOf('\n', a + q) >= 0);
                p = q + 1;
            }
        }
    }

    // 8. 다듬어서 순서대로
    pieces.sort((x, y) => x.pos - y.pos);
    const out = [];
    for (const p of pieces) {
        if (!p.complete) continue;
        if (p.marker) { out.push({ kind: 'thought', text: '', raw: '', color: p.ctx.color, tags: p.ctx.tags.slice(), speakerHint: p.hint || null, line: lineAt(p.pos) }); continue; }
        const raw = stripMarkup(p.slice).trim();
        const text = raw.replace(/\s+/g, ' ').trim();
        if (!LETTER.test(text)) continue;
        out.push({ kind: p.kind, text, raw, color: p.ctx.color, tags: p.ctx.tags.slice(), speakerHint: p.hint || null, line: lineAt(p.pos) });
    }
    return out;
}

/** 차례대로 짝지으면 색이 부딪치나 (둘 다 색이 있는데 다름) — 수만 같고 한 줄씩 밀린 것 (원문에만 있는 영어 "…" + 번역문에만 있는 ‘…’) */
export function colorsClash(src, disp) {
    return src.some((o, i) => !!o.color && !!disp[i]?.color && o.color !== disp[i].color);
}
/** 원문 조각(srcSegs)의 색·이름을 번역문 조각(dispSegs)에 옮김 — 대화문 수가 같고 (1.2.4) 색이 부딪치지 않을 때만 차례대로 */
export function pairSegments(srcSegs, dispSegs) {
    const src = (srcSegs || []).filter(s => s.kind === 'dialogue');
    const disp = (dispSegs || []).filter(s => s.kind === 'dialogue');
    const copy = (s) => ({ ...s, tags: (s.tags || []).slice() });
    if (!src.length || src.length !== disp.length || colorsClash(src, disp)) return (dispSegs || []).map(copy);
    let i = 0;
    return dispSegs.map(s => {
        if (s.kind !== 'dialogue') return copy(s);
        const o = src[i++];
        return { ...copy(s), color: o.color || s.color || null, speakerHint: s.speakerHint || o.speakerHint || null, tags: s.tags && s.tags.length ? s.tags.slice() : (o.tags || []).slice() };
    });
}

/**
 * 화면 번역문(display_text)을 읽을 글로 — LLM 번역의 '원문 <> 번역문 함께 보기' 손질 (1.3.2).
 * 세 보기 모두 '사용 안 함'(번역문만) 화면과 같은 글을 읽게 번역문 쪽만 남긴다:
 *  · 접기:        <details class="llm-translator-details mode-folded"><summary …>번역문</summary>원문</details> → 번역문
 *  · 원문 먼저:   <details class="llm-translator-details mode-original-first"><summary …>원문</summary>번역문</details> → 번역문
 *    (줄마다 감싼 것 · 통째로 감싼 것 둘 다. 예전엔 details 가 '건너뛸 태그'라 이 두 보기에서는 번역문을 하나도 안 읽었다)
 *  · 펼침:        <span class="translated_text mode-unfolded">번역문</span><br><span class="original_text mode-unfolded">원문</span> → 번역문
 *    (예전엔 줄마다 번역문 다음에 원문까지 읽었다 — 정확성 점검 2026-10-06 #9)
 *  · 문단 간격 요소(.llmt-para-gap)는 지운다 — 그 자리가 '사용 안 함' 화면의 빈 줄이다.
 * 줄 머리 표시(1. · - · # · >) · 표 · 가로줄은 칸 밖에 있어 그대로 남는다 → '사용 안 함'과 같다. 다른 글(상태창 details 등)은 손대지 않는다.
 * 감춤 토큰이 든 통째 보기(마스킹 + 줄 수 불일치)는 표시 없이 원문 · 번역문을 이어 붙인 글이라 가를 수 없어 그대로 둔다.
 */
const LLMT_LINE = '<details class="llm-translator-details ';
const LLMT_UNF_ORIG = '<br><span class="original_text mode-unfolded">';
const LLMT_GAP = '<div class="llmt-para-gap"></div>';
/** <span class="translated_text …">…</span> 하나뿐이면 그 안 글 */
function unwrapTranslated(part) {
    const t = part.trim();
    const m = /^<span class="translated_text[^"]*">/.exec(t);
    if (!m) return part;
    return findClose(t, 'span', m[0].length) === t.length ? t.slice(m[0].length, t.length - '</span>'.length) : part;
}
export function speechDisplay(display) {
    let text = String(display ?? '');
    if (!text.includes(LLMT_LINE) && !text.includes(LLMT_UNF_ORIG) && !text.includes(LLMT_GAP)) return text;
    // 접기 · 원문 먼저: 감싼 칸마다 번역문 쪽으로 바꿔 끼운다 (칸 안에 다른 details 가 있어도 짝을 세어 닫는 태그를 찾는다)
    let from = 0;
    for (;;) {
        const at = text.indexOf(LLMT_LINE, from);
        if (at < 0) break;
        const openEnd = text.indexOf('>', at) + 1;
        const close = openEnd > 0 ? findClose(text, 'details', openEnd) : -1;
        if (close < 0) { from = at + LLMT_LINE.length; continue; }
        const originalFirst = /mode-original-first/.test(text.slice(at, openEnd));
        const inner = text.slice(openEnd, close - '</details>'.length);
        const sum = /<summary\b[^<>]*>/i.exec(inner);
        const sumEnd = sum ? findClose(inner, 'summary', sum.index + sum[0].length) : -1;
        if (!sum || sumEnd < 0) { from = close; continue; }
        const kept = unwrapTranslated(originalFirst ? inner.slice(sumEnd) : inner.slice(sum.index + sum[0].length, sumEnd - '</summary>'.length));
        text = text.slice(0, at) + kept + text.slice(close);
        from = at + kept.length;
    }
    // 펼침: 줄 끝의 원문 칸을 떼고 번역문 칸을 벗긴다 (renderInterleaved 가 줄마다 '\n' 으로 잇는다 — 원문 칸은 늘 그 줄의 끝)
    if (text.includes(LLMT_UNF_ORIG)) {
        text = text.split('\n').map((line) => {
            const u = line.indexOf(LLMT_UNF_ORIG);
            if (u < 0) return line;
            const head = line.slice(0, u);
            const s = head.indexOf('<span class="translated_text mode-unfolded">');
            return s < 0 ? head : head.slice(0, s) + unwrapTranslated(head.slice(s));
        }).join('\n');
    }
    return text.split(LLMT_GAP).join('');
}
