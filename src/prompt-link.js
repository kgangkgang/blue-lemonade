// 캐릭터 이름 연동 (6.5.2 · 6.7.5 여러 줄) — 프롬프트 › 과일 의 「캐릭터 이름 연동」 스위치와 연동 줄 (prompt-tools.js fruitPromptMarkup 에 끼운다).
// 줄마다 「이름에 든 말」과 카드(여러 장)를 고른다. 그 말이 든 프롬프트·정규식(전역 · 카드 · 프리셋)은 고른 카드의 채팅을 열 때 켜지고 다른 채팅에서는 꺼진다.
// 카드를 안 고른 줄은 말과 이름이 같은 카드로 (6.5.2 동작 그대로). 이름 자리가 「기본」이거나 말만 빠진 같은 이름의 프롬프트는 짝으로 반대로 켜지고,
// 여러 줄이 같은 짝을 쓰면 어느 줄에도 안 맞을 때만 켜진다 — 예: 「대사 색상 (A · 이름)」 ↔ 「대사 색상 (A · 기본)」, 「| Dialogue Color (이름) |」 ↔ 「| Dialogue Color |」.
// 지금 고른 채팅 완성 프리셋에만 적용되므로 어느 프리셋에서도 같은 규칙이다.
// 켜고 끄기 · 저장 · 다시 그리기는 프롬프트 귀속(promptbind.js syncPromptBinds 의 이름 규칙)이 맡는다. 말 · 카드는 설정(promptLink.rows)에만 있고 코드에는 없다.
import { getSettings, saveSettings } from './settings.js';

const MAX_ROWS = 20;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = value => Array.from(String(value ?? '').trim()).slice(0, 80).join('');
const blank = () => ({ word: '', cards: [] });
function link() {
    const s = getSettings();
    if (!s.promptLink || typeof s.promptLink !== 'object') s.promptLink = { on: false, rows: [] };
    if (!Array.isArray(s.promptLink.rows)) s.promptLink.rows = [];
    return s.promptLink;
}
/** i 번째 줄 — 화면에만 있던 빈 줄(줄이 하나도 없을 때)을 고치면 그때 설정에 들어간다 */
function rowAt(i) {
    const rows = link().rows;
    while (rows.length <= i && rows.length < MAX_ROWS) rows.push(blank());
    if (!rows[i] || typeof rows[i] !== 'object') rows[i] = blank();
    if (!Array.isArray(rows[i].cards)) rows[i].cards = [];
    return rows[i];
}
function cardName(avatar) {
    try { const c = (globalThis.SillyTavern?.getContext?.()?.characters || []).find(x => x?.avatar === avatar); if (c?.name) return String(c.name).trim(); } catch { /* 문맥 없음 */ }
    return String(avatar).replace(/\.[a-z0-9]+$/i, '');
}
const cardsLabel = cards => (cards.length ? cards.map(cardName).join(' · ') : '카드 고르기');
function hint(row) {
    if (!clean(row.word)) return '프롬프트·정규식 이름에 든 말을 적어 주세요.';
    return row.cards.length ? `고른 카드 ${row.cards.length}장의 채팅에서 켜져요. 그룹이면 구성원 중 하나라도 있으면 돼요.` : `카드를 안 고르면 이름이 「${clean(row.word)}」인 카드에서 켜져요.`;
}
function rowMarkup(row, i, saved = true) {
    const n = i + 1;
    return `<div class="bl-link-row" data-link-row="${i}" role="group" aria-label="연동 ${n}">`
        + `<div class="bl-link-head"><b>연동 ${n}</b>${saved ? `<button type="button" class="salty-btn bl-link-mini" data-link-remove aria-label="연동 ${n} 지우기">지우기</button>` : ''}</div>`
        + `<label class="salty-stack bl-link-field"><span>프롬프트·정규식 이름에 든 말</span><input type="text" class="text_pole" data-link-word value="${esc(row.word)}" maxlength="80" placeholder="예: 캐릭터나 작품 이름" autocomplete="off"></label>`
        + `<div class="salty-stack bl-link-field"><span>카드</span><button type="button" class="bl-prompt-card-trigger" data-link-pick aria-label="연동 ${n} 카드 선택" aria-haspopup="dialog"><span data-link-cards>${esc(cardsLabel(row.cards))}</span><i class="fa-solid fa-address-card" aria-hidden="true"></i></button></div>`
        + `<small class="bl-link-hint" data-link-hint>${esc(hint(row))}</small><small class="bl-link-hint" data-link-found hidden></small></div>`;
}
const rowsMarkup = () => { const rows = link().rows; return rows.length ? rows.map((row, i) => rowMarkup(row, i)).join('') : rowMarkup(blank(), 0, false); };   // 줄이 없으면 지우기 없는 빈 줄 하나

/** 프롬프트 › 과일 묶음 아래에 들어가는 설정 (스위치 줄은 bl-prompt-tools 의 격자 규칙, 연동 줄은 이름 위 · 칸 아래 세로 2줄) */
export function promptLinkMarkup() {
    const s = link();
    return `<div class="bl-prompt-tools bl-prompt-link" data-prompt-link><div class="salty-group">`
        + `<div class="salty-row bl-prompt-tool-row" data-search-anchor="캐릭터 이름 연동"><span>캐릭터 이름 연동</span><label class="salty-switch"><input type="checkbox" data-prompt-link-on aria-label="캐릭터 이름 연동" ${s.on ? 'checked' : ''}><span></span></label>`
        + `<small>줄마다 적은 말이 이름에 든 프롬프트·정규식은 고른 카드의 채팅에서만 켜져요. 이름 자리가 「기본」이거나 말만 빠진 짝 프롬프트는 어느 줄에도 안 맞을 때 켜져요. 지금 고른 채팅 완성 프리셋에 적용돼요.</small></div>`
        + `<div class="bl-link-rows" data-link-rows>${rowsMarkup()}</div>`
        + `<div class="bl-link-actions"><button type="button" class="salty-btn bl-link-mini" data-link-add>+ 연동 줄 추가</button></div>`
        + `</div><p class="salty-note" data-prompt-link-status role="status" aria-live="polite"></p></div>`;
}

function resync(rows) {
    return import('./promptbind.js').then(async m => ({ changed: await m.syncPromptBinds('ui'), found: await m.linkReport(rows) })).catch(() => null);
}
const sayIn = box => text => { const status = box.querySelector('[data-prompt-link-status]'); if (status?.isConnected) status.textContent = text; };
const rowBox = (box, i) => box.querySelector(`[data-link-row="${i}"]`);
function paintRow(box, i) {
    const el = rowBox(box, i), row = link().rows[i] || blank();
    if (!el) return;
    const hintEl = el.querySelector('[data-link-hint]'), cards = el.querySelector('[data-link-cards]');
    if (hintEl) hintEl.textContent = hint(row);
    if (cards) cards.textContent = cardsLabel(row.cards);
}
function paintRows(box) {
    const list = box.querySelector('[data-link-rows]');
    if (list) list.innerHTML = rowsMarkup();
}
/** 저장 뒤 지금 채팅에 맞추고 줄마다 찾은 개수를 적는다 (꺼져 있으면 맞추지 않는다) */
async function apply(box) {
    const s = link(), say = sayIn(box);
    saveSettings();
    if (!s.on) { say('껐어요. 프롬프트와 정규식은 지금 상태 그대로예요.'); return; }
    if (!s.rows.some(r => clean(r?.word))) { say('연동할 말을 적어 주세요.'); return; }
    say('지금 채팅에 맞추는 중…');
    const result = await resync(s.rows);
    if (!result) { say('프롬프트 관리자를 읽지 못했어요. 채팅 완성 프리셋을 고른 뒤 다시 켜 주세요.'); return; }
    const { found, changed } = result;
    (found.rows || []).forEach((count, i) => {
        const el = rowBox(box, i)?.querySelector('[data-link-found]');
        if (!el?.isConnected) return;
        const any = count.prompts || count.regex;
        el.hidden = !clean(s.rows[i]?.word);
        el.textContent = any ? `지금 프리셋에서 프롬프트 ${count.prompts}개 · 짝 ${count.twins}개 · 정규식 ${count.regex}개를 찾았어요.` : '지금 프리셋에 이 말이 든 프롬프트·정규식이 없어요.';
    });
    if (!found.prompts && !found.regex) { say('지금 프리셋에 그 말이 든 프롬프트·정규식이 없어요. 채팅을 열 때마다 다시 확인해요.'); return; }
    say(changed ? `${changed}개를 지금 채팅에 맞췄어요.` : '이미 지금 채팅에 맞아요.');
}
/** 설정 창은 다시 그려지므로 문서에 한 번 걸어 둔다 — 스위치 · 말 칸의 change 만 듣는다 (말은 칸을 떠날 때 저장) */
async function onChange(event) {
    const target = event.target;
    const box = target?.closest?.('[data-prompt-link]');
    if (!box) return;
    const s = link();
    if (target.hasAttribute('data-prompt-link-on')) s.on = target.checked === true;
    else if (target.hasAttribute('data-link-word')) {
        const i = Number(target.closest?.('[data-link-row]')?.getAttribute('data-link-row'));
        if (!Number.isInteger(i) || i < 0 || i >= MAX_ROWS) return;
        const word = clean(target.value);
        if (target.value !== word) target.value = word;
        if (word === (s.rows[i]?.word ?? '')) return;
        rowAt(i).word = word;
        paintRow(box, i);
    } else return;
    await apply(box);
}
async function onClick(event) {
    const button = event.target?.closest?.('[data-link-add], [data-link-remove], [data-link-pick]');
    const box = button?.closest?.('[data-prompt-link]');
    if (!box || button.disabled) return;
    const s = link(), say = sayIn(box);
    if (button.hasAttribute('data-link-add')) {
        if (s.rows.length >= MAX_ROWS) { say(`연동 줄은 ${MAX_ROWS}개까지예요.`); return; }
        if (!s.rows.length) s.rows.push(blank());   // 화면에만 있던 빈 첫 줄도 함께 넣는다
        s.rows.push(blank());
        saveSettings(); paintRows(box);
        rowBox(box, s.rows.length - 1)?.querySelector('[data-link-word]')?.focus();
        return;
    }
    const i = Number(button.closest('[data-link-row]')?.getAttribute('data-link-row'));
    if (!Number.isInteger(i) || i < 0 || i >= MAX_ROWS) return;
    if (button.hasAttribute('data-link-remove')) {
        const had = s.rows[i] && (clean(s.rows[i].word) || s.rows[i].cards?.length);
        s.rows.splice(i, 1);
        paintRows(box);
        (rowBox(box, Math.min(i, Math.max(s.rows.length - 1, 0)))?.querySelector('[data-link-remove]') || box.querySelector('[data-link-add]'))?.focus();
        if (had) await apply(box); else saveSettings();
        return;
    }
    button.disabled = true;
    try {
        const { openPromptCardPicker } = await import('./prompt-card-picker.js');
        if (!button.isConnected) return;
        openPromptCardPicker({ selected: [...(s.rows[i]?.cards || [])], opener: button, onPick: avatars => {
            if (!box.isConnected || !Array.isArray(avatars)) return;
            if (avatars.join('\n') === (link().rows[i]?.cards || []).join('\n')) return;
            rowAt(i).cards = avatars.slice(0, 50);
            paintRow(box, i);
            apply(box);
        }});
    } catch {
        say('카드 목록을 열지 못했어요. 다시 눌러 주세요.');
    } finally { button.disabled = false; }
}
let installed = false;
export function installPromptLink(doc = typeof document === 'undefined' ? null : document) {
    if (installed || !doc?.addEventListener) return;
    installed = true;
    doc.addEventListener('change', onChange);
    doc.addEventListener('click', onClick);
}
installPromptLink();
