// 캐릭터 이름 연동 (6.5.2) — 프롬프트 › 과일 의 「캐릭터 이름 연동」 스위치와 이름 칸 (prompt-tools.js fruitPromptMarkup 에 끼운다).
// 이름을 적어 두면 그 이름이 든 프롬프트·정규식(전역 · 카드 · 프리셋)은 그 캐릭터의 채팅을 열 때 켜지고 다른 채팅에서는 꺼진다.
// 이름 자리가 「기본」이거나 이름(과 옆의 · 괄호)만 빠진 같은 이름의 프롬프트는 짝으로 반대로 켜진다 — 예: 「대사 색상 (A · 이름)」 ↔ 「대사 색상 (A · 기본)」,
// 「| Dialogue Color (이름) |」 ↔ 「| Dialogue Color |」. 지금 고른 채팅 완성 프리셋에만 적용되므로 어느 프리셋에서도 같은 규칙이다.
// 켜고 끄기 · 저장 · 다시 그리기는 프롬프트 귀속(promptbind.js syncPromptBinds 의 이름 규칙)이 맡는다. 이름은 설정(promptLink.name)에만 있고 코드에는 없다.
import { getSettings, saveSettings } from './settings.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = value => Array.from(String(value ?? '').trim()).slice(0, 80).join('');
function link() {
    const s = getSettings();
    if (!s.promptLink || typeof s.promptLink !== 'object') s.promptLink = { on: false, name: '' };
    return s.promptLink;
}

/** 프롬프트 › 과일 묶음 아래에 들어가는 설정 (같은 줄 모양 — bl-prompt-tools 의 격자 규칙을 그대로 쓴다) */
export function promptLinkMarkup() {
    const s = link();
    return `<div class="bl-prompt-tools bl-prompt-link" data-prompt-link><div class="salty-group">`
        + `<div class="salty-row bl-prompt-tool-row" data-search-anchor="캐릭터 이름 연동"><span>캐릭터 이름 연동</span><label class="salty-switch"><input type="checkbox" data-prompt-link-on aria-label="캐릭터 이름 연동" ${s.on ? 'checked' : ''}><span></span></label>`
        + `<small>적어 둔 이름이 든 프롬프트·정규식은 그 캐릭터 채팅을 열 때 켜지고 다른 채팅에서는 꺼져요. 이름 자리가 「기본」이거나 이름만 빠진 같은 이름의 프롬프트는 반대로 켜져요. 지금 고른 채팅 완성 프리셋에 적용돼요.</small></div>`
        + `<div class="salty-row bl-prompt-tool-row"><span>캐릭터 이름</span><input type="text" data-prompt-link-name aria-label="연동할 캐릭터 이름" maxlength="80" placeholder="캐릭터 카드의 이름" value="${esc(s.name)}" style="width:12em;max-width:55%;min-width:0"></div>`
        + `</div><p class="salty-note" data-prompt-link-status role="status" aria-live="polite"></p></div>`;
}

function resync() {
    return import('./promptbind.js').then(async m => ({ changed: await m.syncPromptBinds('ui'), found: await m.linkReport() })).catch(() => null);
}
/** 설정 창은 다시 그려지므로 문서에 한 번 걸어 둔다 — 스위치 · 이름 칸의 change 만 듣는다 (이름은 칸을 떠날 때 저장) */
async function onChange(event) {
    const target = event.target;
    const box = target?.closest?.('[data-prompt-link]');
    if (!box) return;
    const s = link();
    const status = box.querySelector('[data-prompt-link-status]');
    const say = text => { if (status?.isConnected) status.textContent = text; };
    if (target.hasAttribute('data-prompt-link-on')) s.on = target.checked === true;
    else if (target.hasAttribute('data-prompt-link-name')) {
        const name = clean(target.value);
        if (target.value !== name) target.value = name;
        if (name === s.name && !s.on) return;
        s.name = name;
    } else return;
    saveSettings();
    if (!s.on) { say('껐어요. 프롬프트와 정규식은 지금 상태 그대로예요.'); return; }
    if (!s.name) { say('캐릭터 카드의 이름을 적어 주세요.'); return; }
    say('지금 채팅에 맞추는 중…');
    const result = await resync();
    if (!result) { say('프롬프트 관리자를 읽지 못했어요. 채팅 완성 프리셋을 고른 뒤 다시 켜 주세요.'); return; }
    const { found, changed } = result;
    if (!found.prompts && !found.regex) { say('지금 프리셋에 그 이름이 든 프롬프트·정규식이 없어요. 채팅을 열 때마다 다시 확인해요.'); return; }
    say(`이름이 든 프롬프트 ${found.prompts}개 · 짝 ${found.twins}개 · 정규식 ${found.regex}개를 찾았어요. ${changed ? `${changed}개를 지금 채팅에 맞췄어요.` : '이미 지금 채팅에 맞아요.'}`);
}
let installed = false;
export function installPromptLink(doc = typeof document === 'undefined' ? null : document) {
    if (installed || !doc?.addEventListener) return;
    installed = true;
    doc.addEventListener('change', onChange);
}
installPromptLink();
