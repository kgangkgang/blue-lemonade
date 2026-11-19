// 1.8.8 원어 대사 뒤 영어 풀이 줄 접기(11-19 사용자 사진 「네 생일이잖아, 오늘.」 이 두 번).
//   모델이 일본어 대사 줄(「…」 · 『…』) 바로 다음 줄에 그 대사의 영어 풀이를 따옴표로 감싼 기울임 한 줄(*"…"*)로 덧붙일 때가 있어요.
//   번역본을 보이면 두 줄이 같은 한국어가 돼 같은 말이 두 번 보였어요(테마가 겹쳐 그린 것 아님 · 원문에 두 줄).
//   → 번역본이 보일 때만 그 풀이 줄(화면의 문단 하나)을 접어요. 원문 · 번역본 글은 그대로(화면 표시만) · 번역 호출 0.
//   두 줄의 뜻이 같은지는 보지 않고 꼴로만: 원문에서 앞줄이 일본어(가나가 든) 「」/『』 대사 하나 · 다음 줄이 영어(라틴 글자 · 한글 · 가나 없음) 따옴표 기울임 한 줄.
//   화면은 같은 차례의 「대사 문단 + 따옴표 기울임 문단」 짝(둘 다 한글 = 번역본이 보이는 중)에 맞춰요 — 원문과 화면의 짝 수가 다르면 아무것도 안 해요.
//   설정: 「원어 대사 뒤 영어 풀이 접기」(chat.glossFold · 기본 켬) — 끄면 접은 줄을 모두 펴요. 메시지 꾸미기 허브(message-decor.js) 하나에 얹어요(감시자 늘리지 않음).
//   시험: tools/tests/gloss-fold.mjs
import { addMessageDecorator } from './message-decor.js';

const KANA = /[぀-ヿ]/;
const HANGUL = /[가-힣]/;
const LATIN = /\p{Script=Latin}/u;
const MARK = 'data-bl-gloss';
const strip = line => String(line ?? '').replace(/<[^>]*>/g, '').replace(/[⠀ ]/g, ' ').trim();
/** 대사 하나만 든 줄: 「…」 또는 『…』 로 열고 닫음(앞뒤 태그 · 빈칸 무시) */
const dialogue = text => /^[「『][^「『]*[」』]$/.test(text);
/** 따옴표로 감싼 기울임 한 줄(원문 꼴): *"…"* · *“…”* · _"…"_ */
const quotedItalicSrc = line => /^([*_])\s*["“][^\n]*["”]\s*\1$/.test(line);

/**
 * 원문(메시지 mes)의 「대사 줄 + 따옴표 기울임 줄」 짝들(차례대로) → [{ fold }] — fold: 앞줄이 일본어 대사 · 다음 줄이 영어 풀이.
 *   빈 줄은 건너뛰고 「바로 다음 줄」 을 봐요.
 */
export function sourcePairs(mes) {
    const lines = String(mes ?? '').split('\n').map(l => l.replace(/[⠀ ]/g, ' ').trim()).filter(Boolean);
    const out = [];
    for (let i = 0; i + 1 < lines.length; i++) {
        const head = strip(lines[i]), next = lines[i + 1];
        if (!dialogue(head) || !quotedItalicSrc(next)) continue;
        const gloss = strip(next).replace(/^[*_]|[*_]$/g, '');
        out.push({ fold: KANA.test(head) && LATIN.test(gloss) && !HANGUL.test(gloss) && !KANA.test(gloss) });
    }
    return out;
}

/** 화면 문단이 따옴표 기울임 한 줄인가 — 글 대부분이 em/i 안이고 따옴표로 열고 닫음 */
function quotedItalicEl(p) {
    const text = (p.textContent || '').replace(/⠀/g, ' ').trim();
    if (!/^["“].*["”]$/s.test(text) || text.includes('\n')) return false;
    const em = p.querySelector('em, i');
    return !!em && (em.textContent || '').trim().length >= text.length - 2;
}
/** 화면의 「대사 문단 + 따옴표 기울임 문단」 짝(차례대로) → [{ gloss: 문단, shown: 둘 다 한글(번역본) }] */
export function screenPairs(root) {
    const ps = [...(root?.querySelectorAll?.(':scope > p') ?? [])];
    const out = [];
    for (let i = 0; i + 1 < ps.length; i++) {
        const head = (ps[i].textContent || '').replace(/⠀/g, ' ').trim(), next = ps[i + 1];
        if (!dialogue(head) || ps[i].nextElementSibling !== next || !quotedItalicEl(next)) continue;
        out.push({ gloss: next, shown: HANGUL.test(head) && HANGUL.test(next.textContent || '') });
    }
    return out;
}
/** 메시지 하나: 접을 문단을 접고(이미 접은 것 중 이제 아닌 것은 펴요) 접은 수를 돌려줘요 */
export function foldMessage(mesText, mes, on = true) {
    if (!mesText) return 0;
    const want = new Set();
    if (on && mes) {
        const src = sourcePairs(mes);
        if (src.some(x => x.fold)) {
            const scr = screenPairs(mesText);
            if (scr.length === src.length) scr.forEach((x, k) => { if (src[k].fold && x.shown) want.add(x.gloss); });
        }
    }
    for (const el of mesText.querySelectorAll(`[${MARK}]`)) if (!want.has(el)) { el.removeAttribute(MARK); el.style.removeProperty('display'); }
    for (const el of want) if (!el.hasAttribute(MARK)) { el.setAttribute(MARK, 'fold'); el.style.setProperty('display', 'none'); }
    return want.size;
}

let off = null, active = false;
const chatOf = () => { try { return globalThis.SillyTavern?.getContext?.()?.chat ?? []; } catch { return []; } };
function apply(list) {
    const chat = chatOf();
    for (const root of list) {
        const all = root.matches?.('.mes') ? [root] : [...(root.querySelectorAll?.('.mes') ?? [])];
        for (const m of all) {
            const msg = chat[Number(m.getAttribute('mesid'))];
            const text = m.querySelector('.mes_text');
            if (!text) continue;
            // 번역본이 있는 메시지만(원문만 보일 때는 두 줄 말이 달라요) · 원문에 원어 대사가 없으면 바로 끝
            if (!msg?.extra?.display_text || msg.is_user || !KANA.test(String(msg.mes ?? ''))) { if (text.querySelector(`[${MARK}]`)) foldMessage(text, null, false); continue; }
            foldMessage(text, msg.mes, active);
        }
    }
}
/** features.js 가 설정이 바뀔 때마다 불러요 — 끄면 접은 줄을 모두 펴요 */
export function syncGlossFold(on) {
    active = !!on;
    if (active && !off) off = addMessageDecorator('원어 대사 풀이 접기', list => apply(list), { settle: 120, order: 30 });
    if (!active && off) { off(); off = null; }
    const chat = document.getElementById('chat');
    if (!active) { document.querySelectorAll(`#chat [${MARK}]`).forEach(el => { el.removeAttribute(MARK); el.style.removeProperty('display'); }); return; }
    if (chat) requestAnimationFrame(() => apply([chat]));
}
