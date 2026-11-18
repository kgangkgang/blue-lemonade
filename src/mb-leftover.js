// 1.7.8 답 본문에 남은 미트볼 변화 줄 숨기기 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
//   (11-18 사용자 「이건 뭐냐 왜 보이는 거지」: 답 끝에 「loc: … npc: … aff: … trust: … event: …」 가 글처럼 보였어요)
//   까닭: 그 확장은 <meatball> · <status> 로 감싼 덩이만 본문에서 떼어 보관해요. 모델이 가끔 다른 태그(그 답은 <memory>)로 감싸 쓰면 덩이가 본문에 남고,
//     칩은 그 확장이 따로 읽어 붙여요 — 숫자는 들어갔는데 줄이 그대로 보여요(번역본도 그 줄을 옮겨 적을 뿐이에요).
//   하는 일(보이는 것만): 그 확장이 이 답(지금 스와이프)의 변화를 이미 읽어 간 때에만, 본문 화면에서 「그 확장 키: 값」 이 둘 이상 이어진 것만으로 된 칸에 표식(data-bl-mb-left)을
//     달고 그 칸만 숨겨요(인라인 display — 맞춤 시트는 그 확장 이름 밖을 안 건드리는 약속이라 · 표식이 없어지면 되돌려요). 원문 · 편집 창 · 번역 원문은 그대로라 편집 창을 열면 보이고, 「원작 그대로 보기」 · 「답 아래 변동 칩 모양」 끔이면 다시 보여요.
//     그 확장이 아무것도 못 읽은 답 · 내 메시지 · 글 속에 섞인 「aff:」 · 키 하나뿐인 줄 · 본문 전체가 그 덩이인 답은 그대로 둬요.
//   감시자를 새로 걸지 않아요(메시지 꾸미기 · 공용 #chat 구독). 시험: tools/tests/mb-leftover.mjs
import { addMessageDecorator } from './message-decor.js';
import { onMbRawChange } from './mb-arrow.js';   // 1.7.8 「원작 그대로 보기」 바뀜은 화살표 모듈의 구독을 나눠 써요(감시 허브 구독 자리를 늘리지 않게)
import { mbOff, onMbOff } from './mb-switch.js';

export const ATTR = 'data-bl-mb-left';
const KEY = 'chips';   // 미트볼 맞춤 「답 아래 변동 칩 모양」 — 끄거나 「원작 그대로 보기」면 숨기지 않아요
export const offView = doc => !!doc?.body?.hasAttribute?.('data-bl-ext-raw') || mbOff(KEY, doc);
const hide = el => { el.setAttribute(ATTR, '1'); el.style.setProperty('display', 'none', 'important'); };
const show = el => { el.removeAttribute(ATTR); el.style.removeProperty('display'); if (!el.getAttribute('style')) el.removeAttribute('style'); };
// 그 확장 변화 줄의 키 가운데 본문 끝 덩이에 자주 오는 것(영어 · 한국어) — 테마가 고른 목록
const KEYS = ['loc', 'location', 'place', 'room', 'aff', 'affection', 'trust', 'friendship', 'rel', 'pair', 'pairaff', 'date', 'days', 'time', 'period', 'slot', 'event',
    'ach', 'memo', 'note', 'msg', 'npc', 'roll', 'quest', 'news', 'rumor', 'post', 'curse', 'weather', 'cash', 'money', 'item', 'stat', 'attr', 'cond', 'stock', 'decor',
    '위치', '장소', '호감', '호감도', '신뢰', '신뢰도', '애정', '우정', '관계', '날짜', '시간', '시간대', '일정', '메모', '인물', '날씨', '돈', '소지금', '아이템', '상태', '퀘스트'];
const MARK = new RegExp(`(^|\\s)(${KEYS.join('|')})\\s*[:：]`, 'gi');
/** 글 전체가 「키: 값」 이 둘 이상 이어진 덩이인가(처음부터 그 확장 키로 시작) */
export function statusRun(text) {
    const s = String(text ?? '').replace(/\s+/g, ' ').trim(); if (!s) return false;
    MARK.lastIndex = 0; const hits = [...s.matchAll(MARK)];
    return hits.length >= 2 && hits[0].index === 0;
}
/** 칸 글(줄바꿈 <br> · 칸 경계는 빈칸으로 — textContent 는 <br> 을 빼서 「(1F)npc:」 처럼 붙었어요 · 리그 11-18) · 그 확장 칩 자리는 빼요 */
const SLOT = '.ss-slot, .custom-ss-slot, .ss-msgcard';
export function textOf(el) {
    let s = '';
    const walk = n => {
        for (let c = n.firstChild; c; c = c.nextSibling) {
            if (c.nodeType === 3) s += c.nodeValue;
            else if (c.nodeType === 1 && !c.matches?.(SLOT)) { if (c.tagName === 'BR') { s += ' '; continue; } s += ' '; walk(c); s += ' '; }
        }
    };
    walk(el); return s.replace(/\s+/g, ' ').trim();
}
/** 지금 스와이프에 그 확장이 읽어 간 변화가 있나 */
const readOps = m => { const ops = m?.extra?.statussim?.bySwipe?.[m?.swipe_id ?? 0]; return Array.isArray(ops) && ops.length > 0; };
/** 메시지 하나: 표식을 다시 달아요 → 단 수 */
export function markLeftovers(mes, m) {
    const box = mes?.querySelector?.('.mes_text'); if (!box) return 0;
    for (const el of box.querySelectorAll(`[${ATTR}]`)) show(el);
    if (offView(mes.ownerDocument) || !m || m.is_user || m.is_system || !readOps(m)) return 0;
    const whole = textOf(box);   // 그 확장 칩 자리는 빼고
    let n = 0;
    for (const el of box.querySelectorAll('*')) {
        if (el.closest(`[${ATTR}]`) || el.closest('pre, code, textarea, .ss-slot, .custom-ss-slot, .ss-msgcard')) continue;
        const t = textOf(el);
        if (!statusRun(t) || t === whole) continue;
        hide(el); n++;
    }
    return n;
}
let on = false;
export function startMbLeftover(doc = globalThis.document, { decorate = addMessageDecorator, chat = () => globalThis.SillyTavern?.getContext?.()?.chat } = {}) {
    if (on || !doc?.body) return false;
    on = true;
    const run = list => { const c = chat(); if (!Array.isArray(c)) return; for (const mes of list) { const id = Number(mes?.getAttribute?.('mesid')); if (Number.isInteger(id)) try { markLeftovers(mes, c[id]); } catch { /* 글 그대로 */ } } };
    const all = () => run([...doc.querySelectorAll('#chat .mes')]);
    onMbOff(doc, [KEY], all);
    try { onMbRawChange(all); } catch { /* 다음 그림 때 */ }
    try { decorate('미트볼 본문에 남은 변화 줄', run, { settle: 0, live: false, order: 97, filter: r => !!r?.target?.closest?.('.mes_text') && !r.target.closest('.ss-msgcard, .ss-slot, .custom-ss-slot') }); } catch { /* 글 그대로 */ }
    return true;
}
