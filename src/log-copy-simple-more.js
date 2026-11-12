// 1.1.8 「테마로 담기」를 더 많은 틀로 — 한 꼴로 안 늘어나서 못 받던 마트 심플 틀을 등록 값으로 바꾸는 두 길(받을 때 한 번 · log-copy-simple-frame.js 가 불러요).
//   ① 줄 갈래(vary): 줄마다 덤 class(줄 차례 gk-q1 · gk-q2 · 박자 gk-b1~4 · 화자 글자 gk-lA · 끝 꾸밈 <span class="gk-pf">)가 달라 꼴이 여럿인 틀.
//      화자 글자를 단 class 는 {{화자}} 로 모으고, 그래도 여럿이면 줄 종류마다 견본 차례대로 돌려 써요(cycle).
//      대사 줄 하나에만 끝 꾸밈이 붙은 틀(호감도 하트 · 반창고)은 그 꾸밈을 한 줄에만 — 견본이 첫 줄이면 첫 줄, 끝 줄이면 끝 줄(accent).
//   ② 칸 묶음(units): 메시지마다 감싸는 칸이 있는 틀(디스코드 · X 타래 · 미니홈피 · 통화 기록 …). 견본 두 메시지를 칸 둘로 떼어
//      첫 칸은 첫 묶음 하나에, 둘째 칸은 나머지 묶음마다 되풀이해요. 묶음 = 메시지 안 [지문 … 대사 …] 한 덩이(대사 뒤 지문이 오면 새 묶음).
//      칸 하나에 세 판: 지문 + 대사(both) · 지문만(nr — 대사를 감싼 칸을 뺌) · 대사만(dl — 지문과 빈 칸을 뺌).
//   소리 카드를 감싼 줄(gk-sv > gk-si > gk-sd — 라디오)은 소리 줄처럼 빼요(테마 복사 글은 소리를 못 살려요 · 보이는 것만).
// DOM 없는 순수 모듈 — 시험 tools/tests/log-copy-simple-more.mjs.

// 이 모듈의 까닭 글은 밖에 안 나가요(frameFromHtml 이 처음 까닭을 돌려줘요) — 묶음 크기를 아끼려고 한 줄로
const fail = () => { throw new Error('줄마다 꾸밈이 다른 틀이에요'); };
export const SOUND_WRAP = /^<div class="gk-sv"><div class="gk-si"><div class="gk-sd">.*<\/div><\/div><\/div>$/;
const NRV = /^<p class="(gk-nr(?: [\w-]+)*)">(?:(?!<\/?p\b).)+<\/p>$/;
const NMV = /^<p class="(gk-nm(?: [\w-]+)*)">[^<]+<\/p>$/;
const DECO = '(?:&#8288;)?(?:<span class="[\\w -]+">(?:<span class="[\\w -]+"></span>)*</span>)*';
const DLV = new RegExp(`^<p class="(gk-dl(?: [\\w-]+)*)"([^>]*)><span class="gk-d gk-d([A-Z])">(?:(?!</?(?:p|span)\\b).)+</span>(${DECO})</p>$`);
const DELAY = /ease-out [\d.]+s both/;

/** class 목록에서 그 줄 화자 글자로 끝나는 class(gk-nA · gk-lA · gk-aA …)를 {{화자}} 로 */
export const whoClass = (cls, X) => cls.split(' ').map(c => c.replace(/^(gk-[a-z][a-z0-9]*)([A-Z])$/, (all, head, x) => (x === X ? `${head}{{화자}}` : all))).join(' ');
const whoTags = (html, X) => html.replace(/(<[a-z][\w-]*\b[^>]*?\sclass=")([^"]*)"/g, (all, a, cls) => `${a}${whoClass(cls, X)}"`);

/** 줄 갈래: 로그 줄 하나 → { kind, form, deco } | null(꼴 밖) */
export function varyRow(line) {
    let m;
    if ((m = line.match(NRV))) return { kind: '지문', form: `<p class="${m[1]}">{{지문}}</p>`, deco: '' };
    if ((m = line.match(NMV))) {
        const X = (m[1].match(/\bgk-n([A-Z])\b/) || [])[1];
        return X ? { kind: '이름', form: `<p class="${whoClass(m[1], X)}">{{이름}}</p>`, deco: '' } : null;
    }
    if ((m = line.match(DLV))) {
        const X = m[3], deco = whoTags(m[4], X);
        return { kind: '대사', form: `<p class="${whoClass(m[1], X)}"${m[2].replace(DELAY, 'ease-out {{지연}} both')}><span class="gk-d gk-d{{화자}}">{{대사}}</span>${deco}</p>`, deco };
    }
    return null;
}

/** 줄 종류마다 견본 차례의 꼴 목록 → { rows, vary } (vary 는 꼴이 여럿인 종류만) */
export function varyForms(found) {
    const rows = {}, vary = {};
    for (const kind of ['지문', '이름', '대사']) {
        const list = found.filter(r => r.kind === kind);
        if (!list.length) fail();
        const forms = list.map(r => r.form);
        if (new Set(forms).size === 1) { rows[kind] = forms[0]; continue; }
        const decked = list.map((r, i) => (r.deco ? i : -1)).filter(i => i >= 0);
        const bare = new Set(list.map(r => (r.deco ? r.form.replace(`</span>${r.deco}</p>`, '</span></p>') : r.form)));
        if (decked.length === 1 && bare.size === 1 && new Set(forms).size === 2) {
            const at = decked[0];
            rows[kind] = [...bare][0];
            vary[kind] = { base: rows[kind], accent: forms[at], at: at > 0 && at === list.length - 1 ? 'last' : 'first' };
        } else { rows[kind] = forms[0]; vary[kind] = { forms }; }
    }
    return { rows, vary };
}

// ── 칸 묶음: 틀 글 → 나무(틀 꼴이 반듯한 HTML 이라 작은 읽개로 돼요 · 못 읽으면 던져요) ──
const VOID = new Set(['br', 'hr', 'wbr', 'img']);
function parse(text) {
    const root = { tag: '', open: '', close: '', cls: [], kids: [] }, stack = [root];
    const re = /(<!--[\s\S]*?-->)|<\/([a-z][\w-]*)\s*>|<([a-z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*>|([^<]+)/gy;
    let m;
    while (re.lastIndex < text.length) {
        const at = re.lastIndex;
        if (!(m = re.exec(text))) fail();
        const top = stack[stack.length - 1];
        if (m[1] || m[5]) top.kids.push({ text: m[0], up: top });
        else if (m[2]) { if (top.tag !== m[2]) fail(); top.close = m[0]; stack.pop(); }
        else {
            const node = { tag: m[3], open: m[0], cls: ((m[4].match(/\sclass="([^"]*)"/) || [])[1] || '').split(/\s+/).filter(Boolean), kids: [], close: '', up: top };
            top.kids.push(node);
            if (!VOID.has(node.tag)) stack.push(node);
        }
    }
    if (stack.length !== 1) fail();
    return root;
}
const html = n => (n.text ?? n.open + n.kids.map(html).join('') + n.close);
const walk = (n, fn) => { fn(n); for (const k of n.kids ?? []) walk(k, fn); };
const is = (n, c) => !!n.cls?.includes(c);
const isRow = n => (n.tag === 'p' && (is(n, 'gk-nr') || is(n, 'gk-dl'))) || ((n.tag === 'p' || n.tag === 'span') && is(n, 'gk-nm'));
const blank = n => n.text !== undefined && !n.text.trim();
const inside = (n, a) => { for (let p = n; p; p = p.up) if (p === a) return true; return false; };
const pathOf = n => { const out = []; for (let p = n; p; p = p.up) out.unshift(p); return out; };
function lca(nodes) {
    const paths = nodes.map(pathOf);
    let i = 0;
    while (paths.every(p => p[i] && p[i] === paths[0][i])) i++;
    return paths[0][i - 1];
}
/** 노드를 부모에서 빼요(뒤 줄바꿈 하나도 — 빈 줄이 안 남게) */
function drop(n) {
    const kids = n.up.kids, i = kids.indexOf(n);
    kids.splice(i, kids[i + 1] && blank(kids[i + 1]) ? 2 : 1);
}
/** 뺀 자리 위로 글도 · 로그 줄도 · 자리표도 없이 빈 칸만 남으면 그 칸도 빼요(stop 은 칸 목록 높이) */
function prune(parent, stop) {
    for (let p = parent; p && p !== stop && p.up; ) {
        let full = false;
        walk(p, (k) => { if ((k.text !== undefined && k.text.trim() && !k.text.startsWith('<!--')) || isRow(k)) full = true; });
        if (full) return;
        const up = p.up; drop(p); p = up;
    }
}
const cloneOf = (n, up = null) => {
    if (n.text !== undefined) return { text: n.text, up };
    const c = { ...n, cls: [...n.cls], up, kids: [] };
    c.kids = n.kids.map(k => cloneOf(k, c));
    return c;
};
const setOpen = (n, fn) => { n.open = n.open.replace(/(\sclass=")([^"]*)"/, (all, a, v) => `${a}${fn(v)}"`); };

/**
 * 칸 묶음 → { html(로그 자리에 {{로그}} · {{로그:2}}), units: [칸 둘], rows, nameFill } — 꼴이 어긋나면 Error.
 * @param {string} quiet 소리 줄 · 별칭을 뗀 틀 원래 판
 */
export function unitsOf(quiet) {
    const head = quiet.indexOf('</style>') + 8, tail = quiet.lastIndexOf('</div>');
    if (head < 8 || tail < head) fail();
    const root = parse(quiet.slice(head, tail));
    const nr = [], dl = [], nm = [];
    walk(root, (n) => { if (n.tag === 'p' && is(n, 'gk-nr')) nr.push(n); else if (n.tag === 'p' && is(n, 'gk-dl')) dl.push(n); else if (isRow(n)) nm.push(n); });
    const letter = n => ((is(n, 'gk-dl') ? n.kids[0]?.cls ?? [] : n.cls).join(' ').match(/\bgk-[nd]([A-Z])\b/) || [])[1];
    if (dl.length !== 2 || nr.length < 2) fail();
    const X = dl.map(letter);
    if (!X[0] || !X[1] || X[0] === X[1]) fail();
    const R = lca([...nr, ...dl]);
    const order = []; walk(root, n => order.push(n));
    const pos = n => order.indexOf(n);
    const top = n => pathOf(n).find(p => p.up === R);
    const nameFill = {};
    const msgs = [[], []];
    for (const n of nr) msgs[pos(n) < pos(dl[0]) ? 0 : 1].push(n);
    for (const n of nm) {
        const x = letter(n), i = X.indexOf(x);
        if (!x) fail();
        if (!inside(n, R) || n === R) {   // 로그 밖 이름(미니홈피 주인 칸) — 그릴 때 그 글자 화자 이름으로(견본 글은 모를 때)
            const t = n.kids[0];
            if (n.kids.length !== 1 || t.text === undefined || !t.text.trim()) fail();
            nameFill[x] ??= t.text.trim(); t.text = `{{이름:${x}}}`;
            continue;
        }
        if (i < 0) fail();
        msgs[i].push(n);
    }
    msgs[0].push(dl[0]); msgs[1].push(dl[1]);
    if (!msgs[0].some(n => n.tag === 'p' && is(n, 'gk-nr')) || !msgs[1].some(n => n.tag === 'p' && is(n, 'gk-nr'))) fail();
    const span = list => { const at = list.map(n => R.kids.indexOf(top(n))); return [Math.min(...at), Math.max(...at)]; };
    const [a0, a1] = span(msgs[0]), [b0, b1] = span(msgs[1]);
    if (a1 >= b0) fail();
    // 칸 바로 앞 「✎」 주석은 그 칸 몫(칸마다 같이 되풀이)
    const lead = (from, floor) => { let i = from; while (i - 1 > floor && (blank(R.kids[i - 1]) || R.kids[i - 1].text?.startsWith('<!--'))) i--; while (blank(R.kids[i])) i++; return i; };
    const s0 = lead(a0, -1), s1 = lead(b0, a1);
    const units = [[s0, a1, X[0]], [s1, b1, X[1]]].map(([from, to, x]) => unitOf(R.kids.slice(from, to + 1), x));
    // 틀 글: 칸 둘 자리에 자리표(뒤 칸부터 갈아 끼워 앞 번호가 안 밀리게)
    R.kids.splice(s1, b1 - s1 + 1, { text: '{{로그:2}}', up: R });
    R.kids.splice(s0, a1 - s0 + 1, { text: '{{로그}}', up: R });
    const out = quiet.slice(0, head) + html(root) + quiet.slice(tail);
    if (!out.includes('\n{{로그}}\n') || !out.includes('\n{{로그:2}}\n')) fail();
    return { html: out, units: units.map(u => u.unit), rows: { 지문: units[0].rows.지문, 이름: '<p class="gk-nm gk-n{{화자}}">{{이름}}</p>', 대사: units[0].rows.대사 }, nameFill };
}

/** 칸 하나(R 의 자식 몇 개 · 견본 화자 글자 x) → { unit: { both, nr, dl, rows }, rows } */
function unitOf(list, x) {
    const box = { tag: '', open: '', close: '', cls: [], kids: [] };
    box.kids = list.map(n => cloneOf(n, box));
    const find = test => { const out = []; walk(box, n => { if (n !== box && test(n)) out.push(n); }); return out; };
    const nrs = find(n => n.tag === 'p' && is(n, 'gk-nr')), dls = find(n => n.tag === 'p' && is(n, 'gk-dl')), nms = find(n => isRow(n) && is(n, 'gk-nm'));
    if (!nrs.length || dls.length !== 1) fail();
    // 지문 줄은 한 부모 안 이웃(사이엔 빈 글 · 주석만)이어야 한 자리로 모아요
    const sib = nrs[0].up.kids;
    const idx = nrs.map(n => sib.indexOf(n));
    if (idx.some(i => i < 0) || sib.slice(idx[0], idx[idx.length - 1] + 1).some(k => !nrs.includes(k) && !blank(k) && !k.text?.startsWith('<!--'))) fail();
    const order = []; walk(box, n => order.push(n));
    if (order.indexOf(nrs[0]) > order.indexOf(dls[0])) fail();
    // 줄 꼴: 지문 = 여는 태그 + {{지문}} · 대사 = 여는 태그 + 띠 + 뒤 덤(날짜 · 꾸밈)
    const d = dls[0], band = d.kids[0];
    if (!band || band.tag !== 'span' || !is(band, 'gk-d') || band.kids.length !== 1 || band.kids[0].text === undefined) fail();
    for (const n of nms) {
        let t = n.kids[0];
        if (t?.tag === 'span' && !t.cls.length && t.kids.length === 1) t = t.kids[0];   // 11-12 마트 「보이는 글자 = 고칠 칸」 뒤 이름을 맨 span 으로 감싼 꼴(<span>이름</span><span class="gk-ts">…)도 받아요
        if (t?.text === undefined || !t.text.trim() || t.text.startsWith('<!--')) fail();
        t.text = '{{이름}}';
    }
    walk(box, (n) => { if (n.open && n !== box) setOpen(n, v => whoClass(v, x)); });
    const rows = {
        지문: `${nrs[0].open}{{지문}}</p>`,
        대사: `${d.open.replace(DELAY, 'ease-out {{지연}} both')}<span class="gk-d gk-d{{화자}}">{{대사}}</span>${d.kids.slice(1).map(html).join('')}</p>`,
    };
    // 자리표: 첫 지문 줄 → {{지문들}}(나머지 지문 줄은 빼요) · 대사 줄 → {{대사들}}
    const nrSlot = { text: '{{지문들}}' }, dlSlot = { text: '{{대사들}}' };
    for (const n of nrs.slice(1)) drop(n);
    nrSlot.up = nrs[0].up; nrs[0].up.kids.splice(nrs[0].up.kids.indexOf(nrs[0]), 1, nrSlot);
    dlSlot.up = d.up; d.up.kids.splice(d.up.kids.indexOf(d), 1, dlSlot);
    const text = b => b.kids.map(html).join('').trim();
    const both = text(box);
    // 지문만: 대사를 감싼 칸(대사 위로 지문이 없는 가장 높은 칸) 통째로 · 그런 칸이 없으면 대사 줄과 칸 높이의 이름 줄을 빼요
    const onlyNr = cloneOf(box);
    {
        const slot = [], names = [];
        walk(onlyNr, (n) => { if (n.text === '{{대사들}}') slot.push(n); if (n.up === onlyNr && isRow(n)) names.push(n); });
        let c = slot[0];
        while (c.up && c.up !== onlyNr && !hasText(c.up, '{{지문들}}')) c = c.up;
        const parent = c.up, ks = parent.kids, i = ks.indexOf(c), note = ks[i - 1] && blank(ks[i - 1]) ? ks[i - 2] : ks[i - 1];
        drop(c);
        if (note?.text?.startsWith('<!--')) drop(note);   // 뺀 칸 바로 앞 「✎」 주석은 그 칸 몫 — 주인 없이 남지 않게
        if (c.text !== undefined) for (const n of names) drop(n);
        prune(parent, onlyNr);
    }
    // 대사만: 지문 자리 빼고 빈 칸 정리
    const onlyDl = cloneOf(box);
    {
        let slot; walk(onlyDl, (n) => { if (n.text === '{{지문들}}') slot = n; });
        const parent = slot.up; drop(slot); prune(parent, onlyDl);
    }
    return { unit: { both, nr: text(onlyNr), dl: text(onlyDl), rows }, rows };
}
function hasText(n, t) { let hit = false; walk(n, (k) => { if (k.text === t) hit = true; }); return hit; }
