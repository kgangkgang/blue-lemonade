// 1.5.9 채팅 이름표(.name_text)를 인물 색으로 — 설정 「이름표를 인물 색으로」(chat.namePeople · 기본 끔)
//   인물표(src/people.js — 이 채팅 TTS 대사 색 → 카드별 색 기억 → 프리셋 색)에 색이 정해진 사람의 이름표만 그 색으로 칠해요. 색이 없는 사람은 지금 이름 색 그대로.
//   메시지마다 손대지 않아요: 실리태번이 메시지에 적어 두는 이름(.mes[ch_name])으로 고르는 작은 시트 한 장(#bl-name-people)을 인물표가 바뀔 때만 다시 써요(감시자 · 타이머 없음).
//   색은 그대로 두고 바탕에 묻힐 때만 밝기를 옮겨요(대비 4.5 — shared/char-tone.js fitInk). 이름 글자에 그러데이션을 건 쪽(캐릭터 · 내 이름)은 건드리지 않아요.
import { people } from './people.js';
import { fitInk } from './shared/char-tone.js';

export const NAME_SHEET = 'bl-name-people';
export const NAME_MARK = 'data-bl-name-people';
const MAX_NAMES = 400, MAX_LEN = 80;
const quote = name => String(name).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[\\"]/g, '\\$&');

/**
 * 인물 목록 → 시트 글. 같은 색은 한 규칙으로 묶어요.
 * @param {Array<{ name?: string, names?: string[], color?: string|null }>} list people.list() 꼴
 * @param {{ bg?: string, skipChar?: boolean, skipUser?: boolean }} [o] bg: 채팅 바탕색(주면 대비 맞춤) · skip…: 그쪽 이름 글자에 그러데이션이 걸려 있어 빼요
 */
export function nameCss(list, { bg = '', skipChar = false, skipUser = false } = {}) {
    if (skipChar && skipUser) return '';
    const byInk = new Map(), seen = new Set();
    let count = 0;
    for (const person of list ?? []) {
        const color = /^#[0-9a-f]{6}$/i.test(String(person?.color ?? '')) ? String(person.color).toLowerCase() : '';
        if (!color) continue;
        let ink = color;
        if (bg) { try { ink = fitInk(color, bg) || color; } catch { ink = color; } }
        for (const raw of [person.name, ...(Array.isArray(person.names) ? person.names : [])]) {
            const name = String(raw ?? '').trim();
            if (!name || name.length > MAX_LEN || seen.has(name) || count >= MAX_NAMES) continue;
            seen.add(name); count++;
            if (!byInk.has(ink)) byInk.set(ink, []);
            byInk.get(ink).push(name);
        }
    }
    const who = skipChar ? '[is_user="true"]' : skipUser ? ':not([is_user="true"])' : '';
    // .mes.mes — 큰 프로필 이름 색 규칙(chat-appearance.css)보다 한 칸 무겁게
    return [...byInk].map(([ink, names]) => `body.salty[${NAME_MARK}] #chat .mes.mes:is(${names.map(n => `[ch_name="${quote(n)}"]`).join(',')})${who}:not([is_system="true"]):not(.smallSysMes) .name_text { color: ${ink} !important; }`).join('\n');
}

/** 인물표 명단 + 지금 채팅의 이름(내 이름 · 카드 · 그룹 사람들 — 명단에 없어도 별칭으로 색이 잡히는 이름) */
export function nameList(ctx = null) {
    const out = [], taken = new Set();
    const add = person => { if (!person?.color || taken.has(person.name)) return; taken.add(person.name); out.push(person); };
    try { for (const person of people.list()) add(person); } catch { /* 명단을 못 읽으면 지금 채팅 이름만 */ }
    const extra = [];
    try {
        extra.push(ctx?.name1, ctx?.name2);
        const group = ctx?.groups?.find?.(g => g?.id === ctx.groupId);
        for (const avatar of group?.members ?? []) extra.push(ctx.characters?.find?.(c => c?.avatar === avatar)?.name);
    } catch { /* 채팅 정보가 없으면 명단만 */ }
    for (const name of extra) { const n = String(name ?? '').trim(); if (!n || taken.has(n)) continue; try { const p = people.get(n); if (p?.color) add({ name: n, names: [n], color: p.color }); } catch { /* 그 이름은 지금 색 그대로 */ } }
    return out;
}

let now = { on: false, bg: '', skipChar: false, skipUser: false }, unhook = null, chatHooked = false;
const ctxOf = doc => { try { return (doc.defaultView || globalThis).SillyTavern?.getContext?.() ?? null; } catch { return null; } };
function write(doc) {
    const css = now.on ? nameCss(nameList(ctxOf(doc)), now) : '';
    let sheet = doc.getElementById?.(NAME_SHEET);
    if (!sheet) { if (!css) return css; sheet = doc.createElement('style'); sheet.id = NAME_SHEET; doc.head.appendChild(sheet); }
    if (sheet.textContent !== css) sheet.textContent = css;
    return css;
}
/**
 * 켬 · 끔 맞추기(설정이 바뀔 때마다 apply.js 가 불러요). 켜면 표식(body[data-bl-name-people])과 시트를 두고 인물표 바뀜 · 채팅 바꾸기에 다시 써요. 끄면 표식을 떼고 시트를 비워요.
 * @returns {string} 쓴 시트 글
 */
export function syncNamePeople(on, { bg = '', skipChar = false, skipUser = false } = {}, doc = globalThis.document) {
    if (!doc?.body) return '';
    now = { on: !!on, bg, skipChar: !!skipChar, skipUser: !!skipUser };
    if (doc.body.hasAttribute(NAME_MARK) !== now.on) doc.body.toggleAttribute(NAME_MARK, now.on);
    if (now.on) {
        if (!unhook) { try { unhook = people.onChange(() => { try { write(doc); } catch { /* 다음 바뀜 때 */ } }); } catch { unhook = null; } }
        if (!chatHooked) {
            const c = ctxOf(doc), type = c?.event_types?.CHAT_CHANGED;
            if (type && c.eventSource?.on) { chatHooked = true; try { c.eventSource.on(type, () => { if (now.on) try { write(doc); } catch { /* 다음 바뀜 때 */ } }); } catch { chatHooked = false; } }
        }
    } else if (unhook) { try { unhook(); } catch { /* 이미 뗌 */ } unhook = null; }
    return write(doc);
}
