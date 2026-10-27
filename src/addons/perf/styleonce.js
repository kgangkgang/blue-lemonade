// 성능 보조 5. 메시지 속 같은 꾸밈 한 번만 넣기
// 프리셋 정규식이 메시지마다 똑같은 <style> 을 넣으면, 실리태번은 그릴 때마다 그 CSS 를 통째로 해석해 선택자 앞에 .mes_text 를 붙이고
// (chats.js decodeStyleTags — css-tools 해석 · 다시 쓰기) 브라우저도 메시지마다 같은 CSS 를 다시 읽는다. 100턴 표본에서 그리기 시간의
// 대부분(과일 계열 146ms 중 139ms · 데우스 750ms 중 570ms, PC)이 이 해석이었다. 서로 다른 style 은 몇 개뿐이다.
// 하는 일: 실리태번 서식 훅(마크다운 뒤, 맨 끝 차례)에서 <style>원문</style> 을 <style>/*bl-dd:열쇠*/</style> 로 바꾸고,
//   열쇠마다 한 번만 실리태번의 같은 함수(encodeStyleTags → decodeStyleTags)로 만든 결과를 #sheld 바로 뒤 칸에 한 벌 둔다.
//   · 저장된 글 · 원문은 그대로다(그릴 때 나온 HTML 만). 실리태번의 범위 붙이기는 메시지마다 같다(접두 '.mes_text ' 고정) —
//     같은 원문이면 결과도 같다. 단 외부 주소 허용(캐릭터별)이 결과를 바꾸므로 열쇠에 넣는다.
//   · 차례: 칸 안 순서 = 문서에서 그 열쇠가 마지막으로 나온 차례. 같은 규칙이 여러 벌이면 마지막 사본이 캐스케이드 차례를 정하므로
//     (styledup.js 와 같은 근거) 화면이 같다. 칸은 #chat 이 든 #sheld 바로 뒤라 다른 문서 style 과의 앞뒤도 그대로다.
//   · 지우기 · 다시 그리기 · 채팅 바꾸기: 이벤트 때 문서의 표시를 세어, 아무도 안 쓰는 열쇠는 칸에서 뺀다(방금 만든 것은 잠깐 둔다).
//   · 건너뛰는 것(원래대로 둠): 해석 실패(CSS ERROR 글이 보여야 함) · @layer(레이어 순서는 처음 나온 자리가 정함) ·
//     이름 줄 빼기(「캐릭터이름:」)에 걸릴 수 있는 글 · 채팅 메시지가 아닌 그리기(messageId < 0).
// 순수한 부분(만들기 · 차례 · 정리)과 DOM 은 문서를 받아 쓴다 — 시험: tools/tests/style-once.mjs

/** 실리태번 encodeStyleTags 와 같은 식 — 실리태번이 범위를 붙이는 style 만 고른다 */
const STYLE_RE = /<style>(.+?)<\/style>/gims;
export const MARK_HEAD = '/*bl-dd:';
const MARK_RE = /^\/\*bl-dd:([a-z0-9]+)\*\/$/;
export const HOLDER_ID = 'bl-style-once';
export const KEY_ATTR = 'data-bl-style-once';

/** 53비트 문자열 해시 (cyrb53) — 열쇠 이름용. 같은 열쇠의 다른 원문은 따로 견줘 막는다 */
export function hash53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** style 요소가 우리 표시면 그 열쇠, 아니면 null (큰 CSS 글은 읽지 않는다) */
export function markKeyOf(node) {
    const text = node?.firstChild;
    if (!text || text.nodeType !== 3 || node.childNodes.length !== 1 || text.length > 64) return null;
    const hit = MARK_RE.exec(text.data);
    return hit ? hit[1] : null;
}

/**
 * @param {object} o
 * @param {(html:string)=>string} o.decode 실리태번과 같은 길: html → decodeStyleTags(encodeStyleTags(html), { prefix: '.mes_text ' })
 * @param {()=>boolean} [o.mediaAllowed] 지금 캐릭터의 외부 주소 허용 (결과가 달라진다)
 * @param {()=>boolean} [o.enabled] 스위치
 * @param {()=>Document|null} [o.doc] 문서 (시험은 가짜)
 * @param {(fn:Function)=>void} [o.queue] 그린 직후 정리 (마이크로태스크)
 * @param {()=>number} [o.now]
 * @param {number} [o.graceMs] 방금 만든 열쇠는 이만큼 안 쓰여도 둔다 (서식을 만든 뒤 조금 늦게 끼우는 코드 대비)
 * @param {number} [o.limit] 기억할 해석 결과 수 (칸에 없는 것부터 잊는다)
 */
export function createStyleOnce({ decode, mediaAllowed = () => true, enabled = () => true, doc = () => globalThis.document ?? null, queue = fn => queueMicrotask(fn), now = () => Date.now(), graceMs = 1500, limit = 400 }) {
    const byRaw = [new Map(), new Map()];   // [외부 주소 허용] 원문 → 항목 | null(건너뜀)
    const byKey = new Map();                // 열쇠 → 항목 { key, raw, css, flag, used, emitted }
    const nodes = new Map();                // 열쇠 → 칸 안 style
    let holder = null, tick = 0, pending = false;
    const stats = { hits: 0, made: 0, skipped: 0, syncs: 0, moved: 0, removed: 0, readded: 0 };

    function entryFor(raw, flag) {
        const map = byRaw[flag ? 1 : 0];
        const known = map.get(raw);
        if (known !== undefined) { if (known) { known.used = ++tick; stats.hits++; } return known; }
        let out = null;
        try { out = decode(`<style>${raw}</style>`); } catch { out = null; }
        const hit = typeof out === 'string' ? /^<style>([\s\S]*)<\/style>$/.exec(out) : null;
        // 해석 실패(실리태번은 'CSS ERROR: …' 글을 보여 준다) · @layer · 범위가 달라질 수 있는 결과는 원래대로
        if (!hit || /@layer\b/i.test(hit[1]) || hit[1].includes('</style')) { map.set(raw, null); stats.skipped++; trim(); return null; }
        let key = (flag ? 'm' : 'n') + hash53(raw).toString(36) + raw.length.toString(36);
        while (byKey.has(key) && byKey.get(key).raw !== raw) key += 'x';
        const entry = { key, raw, css: hit[1], flag, used: ++tick, emitted: 0 };
        map.set(raw, entry); byKey.set(key, entry); stats.made++;
        trim();
        return entry;
    }
    /** 기억 줄이기 — 칸에 없는 것 중 오래 안 쓴 것부터 */
    function trim() {
        for (const map of byRaw) if (map.size > limit * 2) for (const [raw, e] of map) { if (map.size <= limit) break; if (e === null) map.delete(raw); }
        if (byKey.size <= limit) return;
        const old = [...byKey.values()].filter(e => !nodes.has(e.key)).sort((a, b) => a.used - b.used);
        for (const e of old.slice(0, byKey.size - limit)) { byKey.delete(e.key); byRaw[e.flag ? 1 : 0].delete(e.raw); }
    }

    function mount() {
        const d = doc();
        if (!d?.body) return null;
        if (holder?.isConnected) return holder;
        holder = d.getElementById(HOLDER_ID);
        if (!holder) {
            holder = d.createElement('div');
            holder.id = HOLDER_ID;
            holder.hidden = true;
            holder.setAttribute('aria-hidden', 'true');
        }
        // #chat 이 든 #sheld 바로 뒤 — 메시지 안 style 이 있던 자리와 다른 문서 style 의 앞뒤가 같다
        const sheld = d.getElementById('sheld');
        if (sheld?.parentNode) { if (sheld.nextSibling !== holder) sheld.after(holder); }
        else if (holder.parentNode !== d.body) d.body.append(holder);
        // 칸을 새로 붙였거나 다시 붙였으면 기억한 노드를 다시 찾는다
        nodes.clear();
        for (const el of [...holder.children]) {
            const key = el.getAttribute(KEY_ATTR);
            if (key && byKey.has(key) && !nodes.has(key)) nodes.set(key, el); else el.remove();
        }
        return holder;
    }
    function ensure(entry) {
        entry.emitted = now();
        let el = nodes.get(entry.key);
        if (el && el.parentNode === holder && holder?.isConnected) return el;
        const box = mount();
        if (!box) return null;
        el = nodes.get(entry.key);
        if (el) return el;
        el = box.ownerDocument.createElement('style');
        el.setAttribute(KEY_ATTR, entry.key);
        el.textContent = entry.css;
        box.append(el);
        nodes.set(entry.key, el);
        return el;
    }

    /** 서식 훅: 마크다운 뒤 HTML 에서 style 을 표시로 바꾼다 */
    function transform(html, ctx = {}) {
        if (typeof html !== 'string' || !enabled() || ctx.isReasoning || !(Number(ctx.messageId) >= 0)) return html;
        if (!html.includes('<') || !/<style>/i.test(html)) return html;
        const name = String(ctx.ch_name ?? ctx.characterName ?? '');
        const flag = !!mediaAllowed();
        let changed = false;
        const out = html.replace(STYLE_RE, (whole, raw) => {
            if (raw.startsWith(MARK_HEAD) && MARK_RE.test(raw)) return whole;   // 이미 표시
            // 실리태번은 이 뒤에 「(^|\n)캐릭터이름:」 을 지운다 — 그 글이 CSS 안에 있으면 결과가 달라질 수 있어 그대로
            if (name && raw.includes(name + ':')) { stats.skipped++; return whole; }
            const entry = entryFor(raw, flag);
            if (!entry || !ensure(entry)) return whole;
            changed = true;
            return `<style>${MARK_HEAD}${entry.key}*/</style>`;
        });
        if (changed) schedule();
        return out;
    }

    /** 문서의 표시 → 열쇠 차례(마지막으로 나온 차례) */
    function scan() {
        const d = doc();
        const order = new Map();
        if (!d?.body) return order;
        const list = d.body.getElementsByTagName('style');
        for (let i = 0; i < list.length; i++) {
            const el = list[i];
            if (holder && el.parentNode === holder) continue;
            const key = markKeyOf(el);
            if (key === null) continue;
            order.delete(key);
            order.set(key, i);
        }
        return order;
    }
    /** 칸 정리: 없는 것 다시 넣기 · 안 쓰는 것 빼기 · 차례 맞추기 */
    function sync() {
        pending = false;
        stats.syncs++;
        const order = scan();
        if (!order.size && !nodes.size) return;
        const box = mount();
        if (!box) return;
        const t = now();
        const want = [];
        for (const key of order.keys()) {
            const entry = byKey.get(key);
            if (!entry) continue;   // 잊은 열쇠(아주 드묾) — 그 메시지를 다시 그리면 돌아온다
            if (!nodes.has(key)) { ensure(entry); stats.readded++; }
            entry.used = ++tick;
            want.push(key);
        }
        // 안 쓰는 것: 방금 만든 것은 앞쪽에 잠깐 남기고(쓰는 것보다 앞이라 차례를 뺏지 않는다) 나머지는 뺀다
        const idle = [];
        for (const [key, el] of nodes) {
            if (order.has(key)) continue;
            const entry = byKey.get(key);
            if (entry && t - entry.emitted < graceMs) idle.push(key);
            else { el.remove(); nodes.delete(key); stats.removed++; }
        }
        // 뒤에서부터 제자리 확인 — 하나가 맨 뒤로 간 흔한 경우는 한 번만 옮긴다
        let ref = null;
        const seq = [...idle, ...want];
        for (let i = seq.length - 1; i >= 0; i--) {
            const el = nodes.get(seq[i]);
            if (!el) continue;
            if (el.nextSibling !== ref) { box.insertBefore(el, ref); stats.moved++; }
            ref = el;
        }
        // 남은 다른 것(밖에서 넣은 것)은 맨 앞에 두지 않고 지운다 — 칸은 우리 것만
        const mine = new Set(nodes.values());
        for (const el of [...box.children]) if (!mine.has(el)) el.remove();
    }
    function schedule() {
        if (pending) return;
        pending = true;
        queue(sync);
    }

    /** 문서 밖으로 내보내는 사본(캡처 그림)에서 표시를 원래 CSS 로 되돌린다 — 사본 안 style 로 그리는 가상 요소 꾸밈이 빠지지 않게 */
    function expand(root) {
        if (!root?.querySelectorAll) return 0;
        let n = 0;
        for (const el of root.querySelectorAll('style')) {
            const key = markKeyOf(el);
            const entry = key && byKey.get(key);
            if (entry) { el.textContent = entry.css; n++; }
        }
        return n;
    }

    return { transform, sync, schedule, expand, cssOf: key => byKey.get(key)?.css ?? null, get stats() { return { ...stats, kept: nodes.size, known: byKey.size }; } };
}

/** 실리태번 서식 훅에 붙이기. 훅 · 함수가 없는 옛 실리태번이면 false (아무것도 안 함) */
export function installStyleOnce(once, formatter) {
    if (typeof formatter?.addHook !== 'function' || !formatter.stage?.AFTER_MARKDOWN) return false;
    // 다른 확장의 마크다운 뒤 훅(LATEST = 100)보다도 뒤 — 그쪽은 원래 style 을 본다
    formatter.addHook((mes, ctx) => once.transform(mes, ctx), { stage: formatter.stage.AFTER_MARKDOWN, order: 1000 });
    return true;
}
