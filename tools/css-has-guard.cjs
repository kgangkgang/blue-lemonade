/* =========================================================
   :has() 앞 지킴 달기 (1.0.0 극한 최적화) — build-css.cjs 가 css-key 다음에 부른다

   왜: 크롬은 맨 오른쪽 칸부터, 칸 안은 왼쪽부터 견줘요. `body.salty #nonQRFormItems > :where(:not(…)):where(.fa-solid, :has(> i:only-child))` 는
   맨 오른쪽 칸에 이름이 없어서 문서의 모든 요소가 후보이고, 부모가 #nonQRFormItems 인지 보기 전에 :has() 부터 견줘요.
   :has() 를 한 번 견준 요소와 그 조상은 「:has() 영향」 표시가 붙어서, 그 아래가 바뀔 때마다(메시지 단추 · 서랍 글 …) 다시 계산돼요 —
   폰 리그 채팅 전환 재계산의 25% 가 테마 :has() 몫이었어요(규칙만 지웠을 때 1,150 → 870ms).

   바꾸는 것: :has() 가 든 칸 맨 앞(태그 바로 뒤)에 그 앞 칸들을 그대로 옮긴 `:where(앞 칸들 결합자 *)` 를 넣어요.
     body.salty #x > :where(:not(.a)):has(> i)  →  body.salty #x > :where(body.salty #x > *):where(:not(.a)):has(> i)
     · :where 는 특이도 0 · 어차피 맞아야 하는 조건이라 뜻 · 특이도 · 규칙 순서 · 선언이 그대로예요
     · 앞 칸이 안 맞는 요소는 :has() 까지 가지 않아요(「:has() 영향」 표시가 안 붙어요)
     · 앞 칸이 너무 길면 바로 앞 칸만 · 그래도 길거나 앞 칸에 :has() 가 있으면 그대로 둬요
   ========================================================= */
'use strict';

const MAX_PREFIX = 320;

/** 괄호 · 대괄호 · 따옴표 밖에서 칸과 결합자로 나눠요 → [칸, 결합자, 칸, …] */
function chain(selector) {
    const out = [];
    let cur = '', depth = 0, quote = null, i = 0;
    const text = selector.trim();
    while (i < text.length) {
        const ch = text[i];
        if (quote) { cur += ch; if (ch === quote && text[i - 1] !== '\\') quote = null; i++; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; i++; continue; }
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (!depth && /[\s>+~]/.test(ch)) {
            let j = i, comb = ' ';
            while (j < text.length && /[\s>+~]/.test(text[j])) { if (text[j] !== ' ' && text[j] !== '\n' && text[j] !== '\t') comb = text[j]; j++; }
            out.push(cur, comb); cur = ''; i = j; continue;
        }
        cur += ch; i++;
    }
    out.push(cur);
    return out;
}
function splitList(text) {
    const out = []; let depth = 0, quote = null, cur = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) { cur += ch; if (ch === quote && text[i - 1] !== '\\') quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (ch === ',' && !depth) { out.push(cur); cur = ''; continue; }
        cur += ch;
    }
    out.push(cur);
    return out;
}
const join = list => list.map((t, i) => (i % 2 ? (t === ' ' ? ' ' : ` ${t} `) : t)).join('');
/** 칸 앞의 태그 · id · class · 속성 뒤 자리(첫 가상 클래스 앞) — 이름이 먼저 걸러 주게 */
function afterTag(compound) {
    const m = /^(?:\*|[A-Za-z][\w-]*)?(?:[.#][\w-]+|\[[^\]]*\])*/.exec(compound);
    return m ? m[0].length : 0;
}
/** 칸 안에서 :has 가 든 첫 가상 클래스(맨 바깥) 자리 — 지킴은 그 바로 앞에(앞의 값싼 거르기가 먼저 돌게) */
function hasStart(compound) {
    let depth = 0, start = -1;
    for (let i = 0; i < compound.length; i++) {
        const ch = compound[i];
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        else if (ch === ':' && depth === 0 && compound[i + 1] !== ':') start = i;
        if (start >= 0 && depth === 0 && ch === ')') {
            if (compound.slice(start, i + 1).includes(':has(')) return start;
            start = -1;
        }
    }
    return afterTag(compound);
}
function guardPart(part, stats) {
    if (!part.includes(':has(')) return part;
    const items = chain(part);
    let changed = false;
    for (let k = 2; k < items.length; k += 2) {
        const compound = items[k];
        if (!compound.includes(':has(')) continue;
        const before = items.slice(0, k - 1);
        if (before.some(t => t.includes(':has(') || t.includes('::'))) { stats.skipped++; continue; }
        // 앞 칸이 문서 뿌리(html · body · :root)뿐이면 지킴은 늘 맞아서 조상을 끝까지 걷기만 해요 — 달지 않아요(휴지통 규칙: 요소 9천 개마다 body 까지 걷던 것)
        if (before.filter((t, i) => i % 2 === 0).every(t => /^(?:html|body|:root)(?![\w-])/.test(t))) { stats.skipped++; continue; }
        let prefix = join(before);
        if (prefix.length > MAX_PREFIX) prefix = before[before.length - 1];
        if (prefix.length > MAX_PREFIX) { stats.skipped++; continue; }
        const comb = items[k - 1] === ' ' ? ' ' : ` ${items[k - 1]} `;
        const at = hasStart(compound);
        // 지킴 안의 맨 오른쪽은 이 칸의 이름(태그 · id · class · 속성)으로 — `*` 이면 앞 칸 class 가 바뀔 때 그 아래 전부를 다시 계산해요(서랍 openDrawer 마다 요소 3천 개)
        const key = compound.slice(0, afterTag(compound)) || '*';
        const guard = `:where(${prefix}${comb}${key})`;
        if (compound.includes(guard)) continue;   // 이미 있어요
        items[k] = `${compound.slice(0, at)}${guard}${compound.slice(at)}`;
        changed = true; stats.guarded++;
    }
    return changed ? join(items) : part;
}
function walk(text, stats) {
    let out = '', i = 0;
    const n = text.length;
    while (i < n) {
        const open = text.indexOf('{', i);
        if (open < 0) { out += text.slice(i); break; }
        const head = text.slice(i, open);
        const semi = head.lastIndexOf(';');
        const close = head.lastIndexOf('}');
        const cut = Math.max(semi, close);
        const before = cut >= 0 ? head.slice(0, cut + 1) : '';
        let prelude = cut >= 0 ? head.slice(cut + 1) : head;
        let comment = '';
        const lastComment = prelude.lastIndexOf('*/');
        if (lastComment >= 0) { comment = prelude.slice(0, lastComment + 2); prelude = prelude.slice(lastComment + 2); }
        let depth = 1, k = open + 1, quote = null;
        while (k < n && depth) {
            const ch = text[k];
            if (quote) { if (ch === quote && text[k - 1] !== '\\') quote = null; }
            else if (ch === '"' || ch === "'") quote = ch;
            else if (ch === '{') depth++;
            else if (ch === '}') depth--;
            k++;
        }
        const body = text.slice(open + 1, k - 1);
        const sel = prelude.trim();
        out += before + comment;
        if (/^@(media|supports|container|layer)\b/.test(sel)) out += `${prelude}{${walk(body, stats)}}`;
        else if (sel.startsWith('@') || !sel.includes(':has(')) out += `${prelude}{${body}}`;
        else out += `${prelude.slice(0, prelude.length - prelude.trimStart().length)}${splitList(sel).map(p => guardPart(p.trim(), stats)).join(', ')} {${body}}`;
        i = k;
    }
    return out;
}
function guardHas(text) {
    const stats = { guarded: 0, skipped: 0 };
    return { text: walk(text, stats), stats };
}
module.exports = { guardHas, guardPart, chain };
