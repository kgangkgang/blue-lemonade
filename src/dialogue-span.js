// 5.2.2: 줄을 넘는 대사 색칠. 실리태번은 따옴표 대사를 `(".*?")|(“.*?”)` 처럼 한 줄 안에서만 <q> 로 감싼다(script.js messageFormatting,
// `.` 이 줄바꿈을 안 넘음). 그래서 “ 로 열고 한두 줄 아래에서 ” 로 닫는 대사는 서술 색 그대로였다 (커뮤니티 제보: 큰따옴표 색이 가끔 안 먹음).
// 여기서는 그려진 뒤의 글 노드를 훑어, 같은 토막 안에서 닫히지 않은 여는 따옴표를 찾고 뒤 토막에서 닫는 따옴표를 찾으면
// 그 사이 글 조각마다 <q class="bl-q-span"> 을 씌운다 (조각마다 하나 — 줄바꿈 · 문단 구조는 그대로). 저장된 본문은 건드리지 않는다.
// 섞어 쓰거나 뒤집어 쓴 큰따옴표(”…” · “…“ · „…“ · „…” · “…" · "…” · ″…″)도 실리태번은 대사로 안 본다 — 같은 토막 안에서
// 짝이 분명할 때만 같은 <q class="bl-q-span"> 으로 감싼다 (pairMixed). 실리태번이 만든 q 를 넘어서는 짝짓지 않는다.
const PAIRS = { '“': '”', '"': '"', '「': '」', '『': '』', '«': '»', '＂': '＂' };
const OPENERS = Object.keys(PAIRS);
const SKIP = 'q, pre, code, script, style, textarea, .bl-quote-lead, details[class*="custom-dem-card"], .custom-dem-track, .custom-dem-track-recovery';
const created = new Set();
// 여기서 만든 q: 섞인 따옴표 대사(mixed) · 여러 줄 대사 조각(pieces). 여러 줄 대사 찾기는 이것을 넘지 않는다 —
// 감싸기 전엔 그 안의 따옴표에서 찾기가 멈추거나 닫혔는데, 감싼 뒤 다시 훑을 때 넘어가면 짝 잃은 따옴표가 멀리까지 칠한다.
// pieces 는 대사 줄 표시(typography)가 *강조* 안에 든 조각도 줄 머리로 보게 하는 데도 쓴다
const mixed = new WeakSet(), pieces = new WeakSet();
// 닿는 거리는 '글 토막' 수로 잰다. 토막 = 줄바꿈 · 블록 · 건너뛴 요소(q · 코드 …) · 그 밖의 요소에서 끊기는 글 한 조각.
// 글 속 꾸밈(*강조* · 다른 확장의 형광펜 <mark> · 실리태번 '스트리밍 페이드 인'의 낱말 칸 span.text_segment)은 토막을 끊지 않는다 —
// 예전엔 글 노드 수로 재서, 한 줄이 이런 꾸밈으로 여러 노드가 되면 두세 줄 만에 한도가 찼고 홀로 선 " 노드는 여는 것 · 닫는 것 둘 다로 보였다.
// 꾸밈이 없으면 토막 = 글 노드라 예전과 같은 거리 · 같은 판정이다
const MAX_SPAN_UNITS = 40; // 이만큼 뒤 토막까지만 닫는 따옴표를 찾는다 (메시지 전체를 대사로 잘못 칠하지 않게)
const MAX_STRAIGHT_UNITS = 6; // 곧은따옴표는 여닫음이 같은 글자라 짝 잃은 것 하나가 멀리까지 칠할 수 있어 짧게만
const BLOCK = /^(BR|P|DIV|LI|UL|OL|DL|DT|DD|BLOCKQUOTE|H[1-6]|DETAILS|SUMMARY|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|CAPTION|PRE|HR|SECTION|ARTICLE|ASIDE|HEADER|FOOTER|NAV|MAIN|FIGURE|FIGCAPTION|CENTER|ADDRESS|FIELDSET|LEGEND|FORM|MENU|DIALOG|HGROUP|SEARCH)$/;
const INLINE = /^(EM|STRONG|U|DEL|MARK|FONT)$/; // 마크다운이 만드는 꾸밈 · 형광펜 · 글자색 (그 밖의 요소는 예전처럼 토막을 끊는다)
const through = el => INLINE.test(el.nodeName) || el.matches('span.text_segment, span.bl-dialogue-tildes');
// LLM 번역기의 줄 칸(번역문 · 원문)은 서로 다른 글 — 짝은 같은 쪽 줄끼리만 (lane: 't' 번역문, 'o' 원문, '' 그 밖)
const laneAt = el => { for (let p = el.parentElement; p && !p.matches('.mes_text, .salty-sample'); p = p.parentElement) if (laneOf(p)) return true; return false; };
const laneOf = el => /(^|\s)(custom-)?translated_text(\s|$)/.test(el.className) ? 't' : /(^|\s)(custom-)?original_text(\s|$)/.test(el.className) ? 'o' : null;

/** 상자 안 글 노드를 차례로 { node, blank, unit, cut, title, barrier }.
 *  unit = 글 토막 번호, cut = 그 토막이 블록 경계가 아니라 요소(q · 코드 · 그림 · 모르는 요소) 바로 뒤에서 시작,
 *  title = <summary> 안, barrier = 바로 앞에 여기서 만든 q 가 있다 */
function scan(box) {
    const out = [];
    let unit = 0, cut = false, title = 0, lane = '';
    const barrier = {};
    const visit = (parent) => {
        for (let node = parent.firstChild; node; node = node.nextSibling) {
            if (node.nodeType === 3) {
                out.push({ node, blank: !node.data.trim(), unit, cut, title: title > 0, barrier: !!barrier[lane], lane });
                barrier[lane] = false;
                continue;
            }
            if (node.nodeType !== 1) continue;
            const skip = node.matches(SKIP);
            if (!skip && through(node)) { visit(node); continue; }
            const block = BLOCK.test(node.nodeName);
            unit++; cut = !block;
            if (skip) barrier[lane] ||= mixed.has(node) || pieces.has(node);
            else {
                const sum = node.nodeName === 'SUMMARY', outer = lane;
                if (sum) title++;
                lane = laneOf(node) ?? lane;
                visit(node);
                lane = outer;
                if (sum) title--;
            }
            unit++; cut = !block;
        }
    };
    visit(box);
    return out;
}

/** 글 노드를 토막으로 묶는다: { from, to, text(이어 붙인 글), starts, first · last(공백 아닌 첫 · 끝 노드, 없으면 -1), cut, title, barrier } */
function unitsOf(all) {
    const units = [];
    let u = null;
    for (let k = 0; k < all.length; k++) {
        const e = all[k];
        if (!u || all[u.from].unit !== e.unit) units.push(u = { from: k, to: k, text: '', starts: [], first: -1, last: -1, cut: e.cut, title: e.title, barrier: false, lane: e.lane });
        u.to = k;
        u.starts.push(u.text.length);
        u.text += e.node.data;
        if (e.barrier) u.barrier = true;
        if (!e.blank) { if (u.first < 0) u.first = k; u.last = k; }
        e.u = u;
    }
    return units;
}
/** 토막 글의 pos 번째 글자가 든 [글 노드 번호, 그 안 자리] */
function locate(all, u, pos) {
    for (let k = u.from; k <= u.to; k++) {
        const s = u.starts[k - u.from];
        if (pos < s + all[k].node.data.length) return [k, pos - s];
    }
    return [u.to, pos - u.starts[u.to - u.from]];
}

/** 토막 안에서 닫히지 않은 마지막 여는 따옴표 위치 (없으면 null) */
function unclosedOpener(text) {
    let open = null, at = -1;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (open) { if (c === PAIRS[open] && (open !== '"' || closesStraight(text, i))) { open = null; at = -1; } continue; }
        if (OPENERS.includes(c) && (c !== '"' || opensStraight(text, i))) { open = c; at = i; }
    }
    return open ? { open, at } : null;
}
// 곧은따옴표는 여닫음이 같은 글자라 자리로 가른다: 앞이 처음 · 공백 · 여는 괄호면 여는 것, 뒤가 끝 · 공백 · 문장부호면 닫는 것
const opensStraight = (text, i) => i === 0 || /[\s([{【〈《「『—-]/.test(text[i - 1]);
const closesStraight = (text, i) => i === text.length - 1 || /[\s)\]}】〉》」』.,!?;:…—-]/.test(text[i + 1]);

/** 여는 따옴표 open 아래 토막 글에서 닫는 자리 (없으면 -1, 짝이 안 맞아 그만둘 때 -2) */
function closeAt(text, open) {
    const closer = PAIRS[open], double = open === '“' || open === '"';
    for (let k = 0; k < text.length; k++) {
        const c = text[k];
        // 숫자 바로 뒤 따옴표는 인치 · 초 표시(12" · 30" · 12”) — " 는 짝으로 치지 않고(짝 잃은 " 가 거기까지 칠하지 않게), 아래의 '홀로 나옴'에도 넣지 않는다
        const inch = /\d/.test(text[k - 1] ?? '');
        if (c === '"' && inch) continue;
        if (c === closer && (closer !== '"' || closesStraight(text, k))) return k;
        if (c === open && (open !== '"' || opensStraight(text, k))) return -2; // 닫기 전에 같은 따옴표가 또 열림 — 짝이 안 맞는 글
        // 닫기 전에 다른 모양의 큰따옴표가 홀로 나옴(“…" · "…” 처럼 섞여 닫힌 여러 줄 대사, 짝 잃은 따옴표) — 어느 것과 짝인지 몰라 그만둔다.
        // 한 줄 안에서 짝이 맞는 것은 이미 q 라 여기 안 보인다
        if (double && !inch && (open === '"' ? c === '“' || c === '”' : c === '"' && (opensStraight(text, k) || closesStraight(text, k)))) return -2;
    }
    return -1;
}

function wrap(node) {
    const q = document.createElement('q');
    q.className = 'bl-q-span';
    node.replaceWith(q);
    q.append(node);
    created.add(q);
    return q;
}

// 토막 가운데의 공백 노드인가 (앞뒤로 같은 토막 글이 있다) — 강조 · 페이드 인 낱말 칸 사이 띄어쓰기도 대사로.
// 토막 머리 · 꼬리의 공백(문단 사이 \n · 그림 · 블록 옆)은 감싸면 '채우기' 스타일에서 빈 줄이 생겨 둔다
const inner = (all, m) => all[m].node.data.length > 0 && m > all[m].u.first && m < all[m].u.last;

/** all[a] 의 x 번째 글자부터 all[b] 의 y 번째 글자까지를 글 조각마다 q 로. 만든 q 들을 돌려준다 */
function wrapRange(all, a, x, b, y) {
    if (a === b) {
        const mid = x > 0 ? all[a].node.splitText(x) : all[a].node;
        if (y + 1 - x < mid.data.length) mid.splitText(y + 1 - x);
        return [wrap(mid)];
    }
    const last = all[b].node, made = [];
    if (y + 1 < last.data.length) last.splitText(y + 1);
    made.push(wrap(x > 0 ? all[a].node.splitText(x) : all[a].node));
    for (let m = a + 1; m < b; m++) if (all[m].lane === all[a].lane && (!all[m].blank || inner(all, m))) made.push(wrap(all[m].node));
    made.push(wrap(last));
    return made;
}

// ── 섞인 · 뒤집힌 큰따옴표 (한 토막 안) ──
const MIXED = new Set(['””', '““', '„“', '„”', '“"', '"”', '″″']);
const PLAIN = new Set(['“”', '""']); // 실리태번이 감싸는 짝 — 짝으로 세기만 하고 감싸지 않는다
/** 한 토막 글의 따옴표들을 앞에서부터 둘씩 짝짓는다. 맨 앞의 닫기만 되는 것(윗줄에서 이어 온 대사의 끝) ·
 *  맨 뒤의 여는 것(아랫줄로 이어지는 대사)은 여러 줄 대사 몫이라 둔다. 그 밖에 짝이 안 맞는 따옴표가 하나라도 끼면
 *  어느 것끼리 짝인지 모르니 토막 전체를 건너뛴다 */
function mixedPairs(text, chars) {
    const marks = [];
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (!chars.includes(ch)) continue;
        // 숫자 바로 뒤의 " · ″ 는 인치 · 초 표시 (12" · 1′30″) — 따옴표로 세지 않는다 (여러 줄 대사의 여는 따옴표를 가져가지 않게)
        if ((ch === '"' || ch === '″') && /\d/.test(text[i - 1] ?? '')) continue;
        // 여는 자리는 곧은따옴표와 같은 기준에 뒷글자에 붙어 있어야 하고(띄어 쓴 ” 는 기호 이야기),
        // 닫는 자리는 앞 글자에 붙어 있으면 (”…”이라고 처럼 뒤에 토씨가 와도)
        const open = opensStraight(text, i) && i + 1 < text.length && !/\s/.test(text[i + 1]);
        marks.push({ ch, at: i, open, close: ch !== '„' && i > 0 && !/\s/.test(text[i - 1]) });
    }
    const pairs = [];
    for (let k = marks.length && !marks[0].open && marks[0].close ? 1 : 0; k < marks.length; k += 2) {
        const o = marks[k], c = marks[k + 1];
        if (!o.open) return [];
        if (!c) break;
        if (!c.close) return [];
        const kind = o.ch + c.ch;
        if (MIXED.has(kind)) { if (/[\p{L}\p{N}]/u.test(text.slice(o.at + 1, c.at))) pairs.push([o.at, c.at]); }
        else if (!PLAIN.has(kind)) return [];
    }
    return pairs;
}
function pairMixed(box) {
    const all = scan(box), hits = [];
    for (const u of unitsOf(all)) {
        if (u.title || u.first < 0) continue; // <summary> (접는 칸 제목 줄)은 건드리지 않는다
        if (!/[“”„"″]/.test(u.text)) continue;
        // 요소(q · 코드 …) 바로 뒤에서 시작하는 토막은 앞에 글자가 있는 셈 — 첫 따옴표를 여는 것으로 보지 않게
        const pre = u.cut ? 1 : 0, text = (pre ? 'x' : '') + u.text;
        const pairs = [...mixedPairs(text, '“”„"'), ...mixedPairs(text, '″')];
        // 짝 안에 든 짝(“a ″b″ c“)은 바깥 것만 — 안쪽을 먼저 감싸면 바깥 짝이 잘린다. 엇갈린 짝은 둘 다 버린다
        for (const [o, c] of pairs) if (!pairs.some(([o2, c2]) => o2 < o ? o < c2 : o2 > o && o2 < c && c < c2)) hits.push([...locate(all, u, o - pre), ...locate(all, u, c - pre)]);
    }
    // 뒤에서부터 감싼다 — 노드를 자르면 앞 조각이 원래 노드에 남으므로 앞쪽 자리가 그대로 맞다
    hits.sort((p, q) => q[0] - p[0] || q[1] - p[1]);
    for (const [a, x, b, y] of hits) for (const q of wrapRange(all, a, x, b, y)) mixed.add(q);
}

export function wrapSpanningQuotes(root) {
    if (!root?.querySelectorAll) return;
    for (const box of root.matches?.('.mes_text, .salty-sample') ? [root] : root.querySelectorAll('.mes_text, .salty-sample')) {
        if (box.closest(SKIP)) continue;
        // 번역기 줄 칸 안에서 실리태번 q 가 여는 따옴표만 품은 것 = 실리태번이 번역문 · 원문 두 칸을 한 줄로 보고 곧은따옴표를 칸 너머로 짝지은 것 — 풀고 제 칸끼리 다시 짝짓는다
        for (const q of box.querySelectorAll('q:not(.bl-q-span)')) {
            const t = q.textContent;
            if (PAIRS[t[0]] && !(t.length > 1 && t.trimEnd().endsWith(PAIRS[t[0]])) && laneAt(q)) q.replaceWith(...q.childNodes);
        }
        pairMixed(box);
        let guard = 0;
        // 한 번 감싸면 노드 목록이 바뀌므로 다시 훑는다 (감싼 조각은 q 안이라 다음 훑기에서 빠진다)
        while (guard++ < 30) {
            const all = scan(box), units = unitsOf(all);
            let done = false;
            for (let i = 0; i < units.length && !done; i++) {
                if (units[i].first < 0) continue;
                const found = unclosedOpener(units[i].text);
                if (!found) continue;
                const reach = found.open === '"' ? MAX_STRAIGHT_UNITS : MAX_SPAN_UNITS;
                // 같은 메시지 안에서만 (북마크 미리보기 등 다른 상자로 넘어가지 않게)
                for (let j = i + 1, n = 0; j < units.length; j++) {
                    if (units[j].lane !== units[i].lane) continue; // 번역문 줄과 원문 줄은 건너뛰고 세지도 않는다
                    if (units[j].barrier) break; // 여기서 만든 q 를 넘어서는 짝짓지 않는다
                    if (units[j].first < 0) continue;
                    if (++n > reach) break;
                    const end = closeAt(units[j].text, found.open);
                    if (end === -2) break;
                    if (end < 0) continue;
                    // 찾았다: i 의 꼬리, 사이 글 노드 (토막 머리 · 꼬리 공백 노드는 빼고), j 의 머리
                    for (const q of wrapRange(all, ...locate(all, units[i], found.at), ...locate(all, units[j], end))) pieces.add(q);
                    done = true;
                    break;
                }
            }
            if (!done) break;
        }
    }
    for (const q of created) if (!q.isConnected) created.delete(q);
}

/** 여러 줄 대사 조각인가 (섞인 따옴표 · 실리태번 q 는 아니다) */
export const isSpanPiece = q => pieces.has(q);

export function resetSpanningQuotes() {
    for (const q of created) if (q.isConnected) q.replaceWith(...q.childNodes);
    created.clear();
}
