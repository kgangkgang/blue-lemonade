// 8.0.6 작가 노트 「페르소나 위치」 · 「캐릭터 설명 위치」 (사용자 10-27: 작가 노트를 페르소나처럼 쓰니 페르소나 토큰 위에 얹어 보내기)
// 작가 노트 창(이 채팅에서만)의 위치 고르기에 두 칸을 더한다. 고르면 작가 노트 본문이 그 설명 바로 위에 붙어 간다(역할 · 삽입 빈도 · 매크로 ·
// 캐릭터 노트 합치기 · 월드 인포의 작가 노트 위/아래 항목 · 페르소나 TOP_AN/BOTTOM_AN 합치기는 본체가 만든 그대로).
// 본체 설정과의 관계:
//   - 고른 값은 채팅 메타데이터의 테마 칸(bl_note_anchor)에만 적는다. 본체 위치(note_position)는 사용자가 마지막으로 고른 본체 값 그대로라
//     테마를 끄거나 지우면 그 본체 위치로 예전처럼 들어간다(이상한 값이 남지 않음).
//   - 보낼 때는 본체의 작가 노트 확장 프롬프트를 「넣지 않음(NONE)」으로 보이게만 하고(값은 그대로 — 월드 인포 · 페르소나 합치기가 읽는다),
//     prompt-anchors 가 그 값을 설명 바로 위에 넣는다. 저장되는 값은 하나도 바뀌지 않는다.
//   - 붙일 곳이 없으면(채팅 완성에서 그 표식을 꺼 둠 · 스토리 문자열에 그 칸이 없음) 본체 위치로 보낸다.
import { getSettings } from './settings.js';
import { registerAnchorSource, anchorAvailable, ANCHOR_LABEL, ANCHOR_HINT, isAnchor } from './prompt-anchors.js';
import { promptManager } from '../../../../openai.js';

export const AN_KEY = '2_floating_prompt';
export const META_KEY = 'bl_note_anchor';
const TRAP = Symbol.for('bl.noteAnchorTrap');
const ROLE_NAME = ['system', 'user', 'assistant'];

const ctx = () => SillyTavern.getContext();
const featureOn = () => { try { return getSettings().enabled !== false; } catch { return true; } };
const api = () => (ctx().mainApi === 'openai' ? 'openai' : 'text');

/** 이 채팅에서 고른 자리 (끔 · 모르는 값이면 null) */
export function chosenAnchor(meta = ctx().chatMetadata) {
    const value = meta?.[META_KEY];
    return isAnchor(value) ? value : null;
}

/** 지금 보낼 때 테마가 자리를 맞추는가 */
function placing(which = api()) {
    const anchor = featureOn() ? chosenAnchor() : null;
    return anchor && anchorAvailable(anchor, which) ? anchor : null;
}

// ── 본체 작가 노트 확장 프롬프트 가로채기 ──────────────────────────
// extension_prompts['2_floating_prompt'] 에 읽기 · 쓰기 문을 단다. 쓰기는 그대로 받아 두고, 읽을 때 자리를 맞추는 중이면 position 만 NONE(-1).
// 채팅을 바꾸면 본체가 extension_prompts 를 새 객체로 바꾸므로 생성을 시작할 때마다 다시 단다.
let stored;
export function installTrap(prompts = ctx().extensionPrompts) {
    if (!prompts || typeof prompts !== 'object') return false;
    const current = Object.getOwnPropertyDescriptor(prompts, AN_KEY);
    if (current?.get?.[TRAP]) return true;
    stored = current && 'value' in current ? current.value : undefined;
    const get = () => {
        if (!stored || typeof stored !== 'object') return stored;
        return placing() ? { ...stored, position: -1 } : stored;
    };
    get[TRAP] = true;
    Object.defineProperty(prompts, AN_KEY, { configurable: true, enumerable: true, get, set: value => { stored = value; } });
    return true;
}
export const storedNote = () => stored;

function collect({ api: which, anchor }) {
    if (!featureOn() || chosenAnchor() !== anchor) return [];
    const note = stored;
    const raw = typeof note?.value === 'string' ? note.value : '';
    if (!raw.trim()) return [];   // 삽입 빈도에 안 맞는 턴은 본체가 빈 값으로 둔다
    const role = ROLE_NAME[Number(note.role)] ?? 'system';
    let text = raw;
    try {
        // 본체와 같은 매크로 바꾸기: 채팅 완성은 프롬프트 관리자(그룹이면 {{char}} = 참여자 목록), 텍스트 완성은 확장 프롬프트와 같은 substituteParams
        text = which === 'openai' && promptManager?.preparePrompt
            ? promptManager.preparePrompt({ identifier: 'authorsNote', role, content: raw }).content
            : ctx().substituteParams(raw.trim());
    } catch (error) {
        console.warn('[Blue Lemonade] 작가 노트 매크로를 바꾸지 못해 적은 그대로 보내요', error);
    }
    return [{ anchor, text, role, identifier: 'authorsNote' }];
}

// ── 작가 노트 창 라디오 ─────────────────────────────────────
const RADIO = 'bl_note_anchor';
const BODY_RADIO = 'input[name="extension_floating_position"]';

function makeRadio(anchor) {
    const label = document.createElement('label');
    label.className = 'checkbox_label bl-note-anchor';
    label.htmlFor = `${RADIO}_${anchor}`;
    label.title = `작가 노트를 ${ANCHOR_HINT[anchor]}에 붙여 보내요`;
    const input = document.createElement('input');
    input.type = 'radio';
    input.id = `${RADIO}_${anchor}`;
    input.name = RADIO;
    input.value = anchor;
    const text = document.createElement('span');
    text.textContent = ANCHOR_LABEL[anchor];
    label.append(input, text);
    return label;
}

function radios() {
    return [...document.querySelectorAll(`input[name="${RADIO}"]`)];
}

/** 화면을 저장된 값에 맞춘다 — 본체가 자기 라디오를 다시 켠 뒤(loadSettings)에도 부른다 */
export function syncRadios() {
    const group = document.querySelector('#floatingPrompt .floating_prompt_radio_group');
    if (!group) return;
    if (!group.querySelector(`input[name="${RADIO}"]`)) group.append(makeRadio('persona'), makeRadio('char'));
    const on = featureOn();
    const anchor = on ? chosenAnchor() : null;
    for (const label of group.querySelectorAll('.bl-note-anchor')) label.hidden = !on;
    for (const input of radios()) input.checked = input.value === anchor;
    const body = [...document.querySelectorAll(BODY_RADIO)];
    if (anchor) for (const input of body) input.checked = false;
    else if (!body.some(input => input.checked)) {
        const position = ctx().chatMetadata?.note_position;
        const match = body.find(input => Number(input.value) === Number(position));
        if (match) match.checked = true;
    }
}

function choose(anchor) {
    const meta = ctx().chatMetadata;
    if (!meta) return;
    if (anchor) meta[META_KEY] = anchor; else delete meta[META_KEY];
    ctx().saveMetadataDebounced?.();
    syncRadios();
}

let started = false;
export function startNoteAnchor() {
    if (started) return;
    started = true;
    registerAnchorSource('authorsNote', 10, collect);
    installTrap();
    const { eventSource, event_types } = ctx();
    eventSource.on(event_types.GENERATION_STARTED, () => installTrap());
    eventSource.on(event_types.CHAT_CHANGED, () => { installTrap(); syncRadios(); setTimeout(syncRadios, 0); });
    if (event_types.SETTINGS_UPDATED) eventSource.on(event_types.SETTINGS_UPDATED, () => syncRadios());
    document.addEventListener('change', event => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.name === RADIO && target.checked) choose(isAnchor(target.value) ? target.value : null);
        else if (target.matches(BODY_RADIO) && target.checked && chosenAnchor()) choose(null);   // 본체 위치를 고르면 원래 동작으로
    });
    // 작가 노트 창 안의 입력마다 본체가 loadSettings 로 자기 라디오를 다시 켠다 — 그 뒤(거품 단계)에 다시 맞춘다
    const watch = () => {
        const panel = document.getElementById('floatingPrompt');
        if (!panel || panel.dataset.blNoteAnchor) return !!panel;
        panel.dataset.blNoteAnchor = '1';
        for (const type of ['input', 'change']) panel.addEventListener(type, event => { const target = event.target; if (target?.name !== RADIO && !target?.matches?.(BODY_RADIO)) syncRadios(); });
        return true;
    };
    if (!watch()) setTimeout(watch, 1500);
    document.getElementById('option_toggle_AN')?.addEventListener('click', () => setTimeout(syncRadios, 0));
    syncRadios();
}
