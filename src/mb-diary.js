// 1.7.8 미트볼 「⚠ 1」 칩이 답마다 붙던 것 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
//   (11-18 사용자 「이 칩 점검은 뭐 어쩌란 거임? 자꾸 채팅마다 뜨는데」)
//   까닭: 그 확장 변화 줄의 키 event(「일정」)는 「날짜 | 제목 | 설명」 꼴의 새 약속이에요(그 확장 출력 규칙의 키 목록). 본편 AI 가 이 키를 「방금 있었던 일」 일지로 여기고
//     날짜 없이 한 문장(「event: 구내식당에서 …」)을 적으면, 그 확장은 날짜를 못 읽어 그 줄을 「못 읽은 줄」로 셈하고 칩 줄 끝에 ⚠ 칩을 붙여요 — 반영할 것이 없는 줄인데 답마다 떠요.
//   하는 일(보이는 것만 · 그 확장 자료 · 계산 · 파일은 안 건드려요):
//     ① 못 읽은 줄이 이런 일지 줄뿐인 답의 ⚠ 칩에 표식(data-bl-mb-diary)을 달아요 → 맞춤 시트(@mb chips)가 숨겨요. 다른 진짜 못 읽은 줄이 같이 있으면 그대로 보여요.
//        칩 점검(🔍 · /ss-pip)으로는 여전히 볼 수 있어요.
//     ② 칩 점검 창의 넘어간 줄은 저장된 글 그대로 보여요 — 그 확장 「화면만 번역」 이 그 창 글에서도 이름만 사전으로 바꿔 끼워 「Hissed in <한국어 이름> <영어 이름>'s …」 처럼 반쯤 섞였어요.
//        넘어간 줄 칸만 원문으로 돌리고 그 확장 번역이 건너뛰는 표식(.ss-notr — 그 확장이 정한 이름)으로 감싸요. 앞 설명 글은 그대로 번역돼요.
//   스위치: 미트볼 맞춤 「답 아래 변동 칩 모양」(chips) — 끄거나 「원작 그대로 보기」면 원작 그대로예요. 감시자를 새로 걸지 않아요(메시지 꾸미기 · 공용 감시 허브). 시험: tools/tests/mb-diary.mjs
import { onMbAdded } from './mb-arrow.js';   // 1.7.8 화살표 모듈의 채팅 밖 구독을 나눠 써요(감시 허브 구독 자리를 늘리지 않게)
import { addMessageDecorator } from './message-decor.js';
import { mbOff } from './mb-switch-core.js';
import { foldBlank } from './blank-fold.js';   // 버그 사냥 7 점자 빈칸 공용 정규화

export const ATTR = 'data-bl-mb-diary';
const WARN = String.fromCodePoint(0x26A0);   // 그 확장 ⚠ 칩의 첫 글자(화면에 그리는 글이 아니라 견주기만 해요)
const KEY = 'chips';
const off = doc => !!doc?.body?.hasAttribute?.('data-bl-ext-raw') || mbOff(KEY, doc);

const DATEISH = /^(\d|D\s*-|내일|모레|글피|오늘|다음|이번|tomorrow|today|tonight|next\b|in\s+\d|on\s+\d|(mon|tues|wednes|thurs|fri|satur|sun)day\b)/i;
/** 일지 꼴 event 줄: 키가 event · 일정이고 값에 「|」(날짜 | 제목) 칸이 없고 지우기(「-이름」)도 날짜로 시작하지도 않는 문장(열다섯 자 이상) */
export function diaryLine(line) {
    const m = /^\s*(event|일정)\s*[:：]\s*(.*)$/i.exec(foldBlank(line)); if (!m) return false;   // 버그 사냥 7 `event:⠀tomorrow…` 도 값 머리 빈칸을 떼고 봐요
    const v = m[2].trim();
    // 날짜처럼 시작하는 짧은 값(「3월 14일」 · 「내일」)은 약속을 적다 만 진짜 못 읽은 줄일 수 있어 그대로 둬요 — 일지는 문장(열다섯 자 이상)이에요
    return v.length >= 15 && !v.includes('|') && !/^[-−]/.test(v) && !DATEISH.test(v);
}
/** 그 확장이 ⚠ 수에 넣는 줄(아는 키의 이상한 값 · 모르는 키인데 숫자 변화) — 테마가 따로 정한 같은 뜻의 판정 */
const counted = (line, snap) => !(snap.missKey ?? []).includes(line) || /[+\-−]\s*\d/.test(line.slice(line.indexOf(':') + 1));
/** ⚠ 를 숨길 답인가: ⚠ 에 들어가는 줄이 하나 이상이고 모두 일지 꼴 event 줄 */
export function quietMiss(snap) {
    if (!snap || !Array.isArray(snap.miss)) return false;
    const list = snap.miss.filter(x => counted(x, snap));
    return list.length > 0 && list.every(diaryLine);
}
/** 칩 줄의 ⚠ 칩(그 확장 data-ss-pip · 글이 ⚠ 로 시작)에 표식을 달거나 떼요 → 단 수. snapOf(답 번호) = 그 확장의 그 답 기록 */
export function markChips(root, snapOf) {
    let n = 0;
    for (const b of root?.querySelectorAll?.('.ss-mchip.pip[data-ss-pip]') || []) {
        const warn = String(b.textContent ?? '').trim().startsWith(WARN);   // 그 확장의 경고 그림 글자로 시작하는 칩(글자를 소스에 그대로 두지 않아요 — 화면용 그림 글자 검사)
        let quiet = false;
        if (warn) { try { quiet = quietMiss(snapOf(Number(b.getAttribute('data-ss-pip')))); } catch { quiet = false; } }
        if (quiet) { if (b.getAttribute(ATTR) !== '1') b.setAttribute(ATTR, '1'); n++; }
        else if (b.hasAttribute(ATTR)) b.removeAttribute(ATTR);
    }
    return n;
}
/** 칩 점검 창 글(번역된 채) → { head(앞 설명 · 빈 줄까지), tail(저장된 줄 그대로) } · 줄 칸이 없으면 null */
export function rawTail(shown, lines) {
    const s = String(shown ?? ''), at = s.lastIndexOf('\n\n');
    if (at < 0 || !Array.isArray(lines) || !lines.length) return null;
    return { head: s.slice(0, at + 2), tail: lines.join('\n') };
}
/**
 * 버그 사냥 4: 칩 점검 창의 빈 줄 뒤 칸에 그 확장이 실제로 보인 줄(그 확장 pipDiag 와 같은 고르기) — 모르면 null(안 건드려요)
 *   칩이 붙은 답(labels): 진짜 못 읽은 줄(seriousList — 여기 counted)만 · 칩이 없는 답의 「값 모양이 달라 못 썼어요」 창: 못 읽은 줄 전부 ·
 *   그 밖의 창(모르는 키 · 바뀐 게 없음)은 변화 줄 목록이라 여기서 다시 못 만들어요. 전엔 늘 counted 로 갈아 끼워 꾸밈 키 줄이 창에서 빠지거나 다른 목록이 바뀌었어요
 */
export function pipLines(snap, title = '') {
    if (!snap || !Array.isArray(snap.miss) || !snap.miss.length) return null;
    if ((snap.labels ?? []).length || snap.roll) return snap.miss.filter(x => counted(x, snap)).slice(0, 8);
    return /값 모양이 달라/.test(String(title ?? '')) ? snap.miss.slice(0, 8) : null;
}
/** 칩 점검 창 안내 줄의 「/ss-pip 12」 → 12 */
export function pipIndex(text) { const m = /\/ss-pip\s+(\d+)/.exec(String(text ?? '')); return m ? Number(m[1]) : null; }

// ── 실리태번 · 그 확장과 잇기 ─────────────────────────
async function mbCore(doc) {
    try {
        const tag = [...(doc?.querySelectorAll?.('script[src]') ?? [])].find(s => /\/meatballstats\/index\.js(?:$|\?)/.test(String(s.src || s.getAttribute?.('src') || '')));
        const src = tag ? String(tag.src || tag.getAttribute('src')) : '';
        if (!src || src.includes('?')) return null;
        return await import(new URL('./src/core.js', src).href);
    } catch { return null; }
}
/** 칩 점검 창 하나: 넘어간 줄 칸을 원문으로(그 확장 번역이 건너뛰게 감쌈) */
function rawPip(box, snapOf) {
    const p = box?.querySelector?.('.ss-pip-res .ss-pre'); if (!p || p.querySelector('.ss-notr')) return false;
    const i = pipIndex(box.querySelector('.ss-hint')?.textContent); if (i === null) return false;
    const lines = pipLines(snapOf(i), box.querySelector('.ss-pip-res b')?.textContent); if (!lines?.length) return false;
    const t = rawTail(p.textContent, lines); if (!t) return false;
    const doc = p.ownerDocument, span = doc.createElement('span'); span.className = 'ss-notr'; span.textContent = t.tail;
    p.textContent = t.head; p.appendChild(span);
    return true;
}
let on = false;
export function startMbDiary(doc = globalThis.document, { added = onMbAdded, decorate = addMessageDecorator, core = null } = {}) {
    if (on || !doc?.body) return false;
    on = true;
    let mod = core;
    const snapOf = i => mod?.app?.current?.snaps?.get?.(i) ?? null;
    const ready = () => (mod ? Promise.resolve(mod) : mbCore(doc).then(m => (mod = m)));
    const sweep = list => { if (off(doc)) return; for (const mes of list) markChips(mes, snapOf); };
    ready().then(() => { try { markChips(doc.getElementById?.('chat') ?? doc, snapOf); } catch { /* 다음 그림 때 */ } }).catch(() => { /* 원작 그대로 */ });
    try { decorate('미트볼 일지 줄 경고 칩', list => { if (mod) sweep(list); else ready().then(() => sweep(list)).catch(() => {}); }, { settle: 0, live: true, order: 96, filter: r => !!r?.target?.closest?.('.ss-msgcard, .ss-slot, .custom-ss-slot') || !!r?.target?.classList?.contains?.('custom-ss-slot') }); } catch { /* 칩 그대로 */ }
    // 칩 점검 창: 그 확장 화면 번역(같은 기록을 받는 감시 콜백)이 글을 바꾼 뒤에 한 박자 미뤄 원문으로
    try {
        added(records => {
            if (off(doc)) return;
            const boxes = new Set();
            for (const r of records) for (const n of r.addedNodes || []) if (n.nodeType === 1) { if (n.matches?.('.ss-pipbox')) boxes.add(n); else for (const b of n.querySelectorAll?.('.ss-pipbox') || []) boxes.add(b); }
            if (!boxes.size) return;
            queueMicrotask(() => ready().then(() => { for (const b of boxes) try { rawPip(b, snapOf); } catch { /* 번역된 그대로 */ } }).catch(() => {}));
        });
    } catch { /* 창 그대로 */ }
    return true;
}
