// 전개 지시 — 다음 전개를 적어 두면 보낼 때마다 프롬프트에 끼워 넣는다.
// Direction-Manager-Lite를 한국어로 새로 만든 확장. 입력창 버튼 색으로 켜짐/꺼짐을 바로 알 수 있다.
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types } from '../../../../../../../script.js';
import { POPUP_TYPE, callGenericPopup } from '../../../../../../popup.js';

import { getChatCompletionModel, oai_settings } from '../../../../../../openai.js';
import { insertDirection } from './prompt.js';

const MODULE = 'jeongaejisi';
const OLD_MODULE = 'Direction-Manager-Lite';
const VERSION = '1.1.2';

// AI에게 보내는 글이라 원래 확장의 영어 프롬프트를 그대로 쓴다. (뜻은 설정 화면에 한국어로 적어 둠)
const DEFAULT_PROMPT = `<direction>
- Resume the story based on the director's instructions below.
- The director only provides drafts; refine them into natural prose instead of directly quoting the sentences.
- Creatively construct and fill in any parts lacking persuasive causality so that the narrative suggested by the director unfolds smoothly.

[Direction(If blank, develop the story as you see fit): {{direction}}]
</direction>`;

const DEFAULTS = Object.freeze({
    extensionEnabled: true,          // 입력창 버튼 표시 + 주입 전체 스위치
    direction: { enabled: false, content: '' },
    directionPrompt: DEFAULT_PROMPT,
    promptDepth: 1,                  // 0: 맨 끝, N: 끝에서 N번째 메시지 앞
    onColor: '',                     // 켜짐 표시 색. 비우면 테마의 대사 색
});

function settings() {
    return extension_settings[MODULE];
}

function save() {
    saveSettingsDebounced();
}

function clampDepth(value) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 1;
}

function initSettings() {
    if (!extension_settings[MODULE] || typeof extension_settings[MODULE] !== 'object') {
        const store = structuredClone(DEFAULTS);
        // 처음 켤 때 이전 확장의 설정(켜짐, 적어 둔 지시, 프롬프트, 깊이)을 옮겨 온다.
        const old = extension_settings[OLD_MODULE];
        if (old && typeof old === 'object') {
            if (typeof old.extensionEnabled === 'boolean') store.extensionEnabled = old.extensionEnabled;
            if (old.direction && typeof old.direction === 'object') {
                store.direction.enabled = !!old.direction.enabled;
                store.direction.content = String(old.direction.content ?? '');
            }
            if (typeof old.directionPrompt === 'string' && old.directionPrompt.trim()) store.directionPrompt = old.directionPrompt;
            if (Number.isInteger(old.promptDepth)) store.promptDepth = old.promptDepth;
            store.migratedFrom = OLD_MODULE;
        }
        extension_settings[MODULE] = store;
        save();
    }
    const store = settings();
    store.direction = { enabled: false, content: '', ...(store.direction ?? {}) };
    store.direction.content = String(store.direction.content ?? '');
    if (typeof store.directionPrompt !== 'string') store.directionPrompt = DEFAULT_PROMPT;
    store.promptDepth = clampDepth(store.promptDepth);
    store.extensionEnabled = store.extensionEnabled !== false;
    store.onColor = parseColorCode(store.onColor) ?? '';
}

/** 실제로 보낼 때 들어가는 상태인지 */
function isActive() {
    const store = settings();
    return store.extensionEnabled && store.direction.enabled;
}

function hasContent() {
    return settings().direction.content.trim() !== '';
}

// ── 색 ──────────────────────────────────────────────────────

// 받는 형식: #fac679, fac679, #fff, rgb(250, 198, 121), 250,198,121 → '#rrggbb' (잘못된 값은 null)
function parseColorCode(text) {
    const value = String(text ?? '').trim().toLowerCase();
    const hex = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hex) {
        const digits = hex[1].length === 3 ? [...hex[1]].map(digit => digit + digit).join('') : hex[1];
        return `#${digits}`;
    }
    const rgb = value.match(/^(?:rgba?\s*\()?\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/\s]\s*[\d.]+%?\s*)?\)?$/);
    if (rgb) {
        const channels = rgb.slice(1, 4).map(Number);
        if (channels.every(channel => channel <= 255)) return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
    }
    return null;
}

/** 지금 적용되는 켜짐 색 (설정 색 또는 테마의 대사 색)을 #rrggbb로 */
function effectiveOnColor() {
    if (settings().onColor) return settings().onColor;
    return parseColorCode(getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor')) ?? '#e18a24';
}

function contrastInk(hex) {
    const value = Number.parseInt(hex.slice(1), 16);
    const luminance = 0.299 * (value >> 16 & 255) + 0.587 * (value >> 8 & 255) + 0.114 * (value & 255);
    return luminance > 160 ? '#1b1820' : '#ffffff';
}

/** 테마 글자색이 밝으면 어두운 테마다. 빠른 편집 창의 불투명 바탕을 여기에 맞춘다. */
function isDarkTheme() {
    const text = getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBodyColor');
    const channels = text.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)?.slice(1, 4).map(Number);
    if (!channels) return true;
    const [red, green, blue] = channels;
    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > 0.5;
}

function applyOnColor() {
    const rootStyle = document.documentElement.style;
    if (settings().onColor) rootStyle.setProperty('--jj-on-color', settings().onColor);
    else rootStyle.removeProperty('--jj-on-color');
    rootStyle.setProperty('--jj-on-ink', contrastInk(effectiveOnColor()));
    rootStyle.setProperty('--jj-base', isDarkTheme() ? '#141318' : '#fbf9f6');
}

/**
 * 테마 색이 실제로 바뀌었을 때만 다시 계산한다.
 * applyOnColor도 <html style>에 쓰기 때문에, 이 확인이 없으면 감시가 제 글씨에 다시 불려 돌고 돈다.
 */
let onColorSignature = '';
let onColorSource = null;
function syncOnColor() {
    // 1.1.2: 계산된 스타일을 읽기 전에 색이 바뀔 수 있는 곳만 값싸게 견준다 — <html style> · 블루 레몬에이드의 색 변수 칸 · 밝음/어두움 클래스 ·
    // 스타일 시트 수. 답이 스트리밍되는 동안 실리태번이 body 클래스를 붙였다 떼는 것만으로 매번 문서 전체 스타일 계산을 돌렸다 (폰 흉내 한 턴 0.1초).
    const source = [settings().onColor, document.documentElement.getAttribute('style'), document.getElementById('salty-vars')?.textContent, document.body.classList.contains('salty'), document.body.classList.contains('salty-dark'), document.styleSheets.length].join('|');
    if (source === onColorSource) return;
    onColorSource = source;
    const style = getComputedStyle(document.documentElement);
    const signature = [settings().onColor, style.getPropertyValue('--SmartThemeQuoteColor').trim(), style.getPropertyValue('--SmartThemeBodyColor').trim()].join('|');
    if (signature === onColorSignature) return;
    onColorSignature = signature;
    applyOnColor();
}

// ── 프롬프트 주입과 {{direction}} 매크로 ────────────────────

/**
 * 실리태번은 1.13.5부터 generateRaw(다른 확장이 따로 보내는 요청 — 다시 쓰기, 장기 기억 요약 등)에서도 같은 이벤트를 쏜다.
 * 거기에 "지시대로 이야기를 이어 가라"가 끼면 그 요청이 엉뚱하게 나오므로 본 생성(prepareOpenAIMessages)에만 넣는다.
 * 이벤트 데이터에는 둘을 가를 값이 없어 호출 경로로 본다. 경로를 못 읽는 브라우저에서는 예전처럼 넣는다.
 */
function isRawGeneration() {
    return /\bgenerateRaw(?:Data)?\b/.test(new Error().stack ?? '');
}

// 생성 종류는 GENERATION_STARTED(prepareOpenAIMessages 보다 먼저)에서 받아 둔다. 조용한 생성(/gen · 요약 · 그림 프롬프트 · 표정)과
// 대신 쓰기(impersonate)에는 넣지 않는다. 한 번 쓰면 비워서 지난 값이 다음 요청에 새지 않게 한다.
let generationType = null;
function trackGeneration(type) {
    generationType = typeof type === 'string' ? type : null;
}

function injectDirection(eventData) {
    const type = generationType;
    generationType = null;
    if (!isActive() || isRawGeneration() || type === 'quiet' || type === 'impersonate') return;
    const store = settings();
    const template = store.directionPrompt;
    const messages = eventData?.chat;
    if (!template?.trim() || !Array.isArray(messages)) return;

    const prefill = type === 'impersonate' ? oai_settings.assistant_impersonation : oai_settings.assistant_prefill;
    insertDirection(messages, template, store.direction.content, store.promptDepth, getChatCompletionModel(oai_settings), { type, prefill });
}

// 프리셋 안에서 {{direction}}을 직접 쓸 수도 있게 매크로로도 둔다. 꺼져 있으면 빈칸이 된다.
function registerDirectionMacro() {
    try {
        getContext().registerMacro?.('direction', () => (isActive() ? settings().direction.content : ''), '전개 지시에 적은 내용 (꺼져 있으면 빈칸)');
    } catch (error) {
        console.warn('[전개 지시] {{direction}} 매크로를 등록하지 못했습니다:', error);
    }
}

// ── 입력창 버튼 ─────────────────────────────────────────────

let button = null;
let popup = null;

function preview(text, length = 50) {
    const line = text.replace(/\s+/g, ' ').trim();
    return line.length > length ? `${line.slice(0, length)}…` : line;
}

function refreshButton() {
    refreshSettingsStatus();
    if (!button) return;
    const on = isActive();
    const filled = hasContent();
    button.hidden = !settings().extensionEnabled;
    button.classList.toggle('is-on', on);
    button.classList.toggle('has-content', filled);
    button.setAttribute('aria-pressed', String(on));
    button.title = !on
        ? '전개 지시 꺼짐 · 눌러서 열기'
        : filled ? `전개 지시 켜짐 · ${preview(settings().direction.content)}` : '전개 지시 켜짐 · 내용이 비어 있어 AI가 알아서 전개해요';
    if (popup) refreshPopup();
}

function ensureButton(attempt = 0) {
    if (document.getElementById('jj-button')) return;
    const textarea = document.getElementById('send_textarea');
    if (!textarea) {
        if (attempt < 30) setTimeout(() => ensureButton(attempt + 1), 1000);
        return;
    }
    button = document.createElement('div');
    button.id = 'jj-button';
    button.className = 'interactable';
    button.tabIndex = 0;
    button.setAttribute('role', 'button');
    button.innerHTML = '<i class="fa-solid fa-feather-pointed"></i><span class="jj-dot" aria-hidden="true"></span>';
    button.addEventListener('click', togglePopup);
    button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        togglePopup();
    });
    placeButton();
    NARROW_SCREEN.addEventListener('change', placeButton);
    refreshButton();
}

// 좁은 화면(휴대폰)에서는 입력창이 한 줄을 통째로 쓰고 버튼들이 아래 줄로 내려가서, 입력창 뒤에 붙이면
// 버튼 혼자 세 번째 줄로 떨어진다. 그래서 좁은 화면에서는 요술봉 바로 옆에 두고, 넓은 화면은 입력창 뒤 그대로 둔다.
// 1000px은 실리태번과 Moonlit 테마가 휴대폰 배치로 바꾸는 폭이다.
const NARROW_SCREEN = window.matchMedia('(max-width: 1000px)');

function placeButton() {
    if (!button) return;
    const left = document.getElementById('leftSendForm');
    const wand = document.getElementById('extensionsMenuButton');
    const textarea = document.getElementById('send_textarea');
    if (NARROW_SCREEN.matches && left) {
        if (wand?.parentElement === left) {
            if (wand.nextElementSibling !== button) wand.after(button);
        } else if (button.parentElement !== left) {
            left.append(button);
        }
        // 보이는 순서는 style.css가 정한다 (요술봉 오른쪽 = 맨 끝).
        button.classList.add('is-in-left');
    } else if (textarea) {
        if (textarea.nextElementSibling !== button) textarea.after(button);
        button.classList.remove('is-in-left');
    }
}

// ── 빠른 편집 창 ────────────────────────────────────────────

function footText() {
    const depth = settings().promptDepth;
    const where = depth === 0 ? '프롬프트 맨 끝' : `끝에서 ${depth}번째 메시지 앞`;
    if (!isActive()) return '꺼져 있어서 보내지 않아요. 켜면 적어 둔 내용이 들어가요.';
    return hasContent()
        ? `보낼 때마다 이 지시가 ${where}에 들어가요.`
        : `비워 두면 'AI가 알아서 전개'로 ${where}에 들어가요.`;
}

function refreshPopup() {
    const on = settings().direction.enabled;
    popup.classList.toggle('is-on', isActive());
    popup.querySelector('.jj-switch').setAttribute('aria-checked', String(on));
    popup.querySelector('.jj-state').textContent = isActive() ? '켜짐' : '꺼짐';
    popup.querySelector('.jj-foot-text').textContent = footText();
}

function onOutsidePointer(event) {
    // 지우기 확인 창(실리태번 dialog)을 누를 때는 닫지 않는다.
    if (event.target.closest?.('#jj-popup, #jj-button, dialog')) return;
    closePopup();
}

function onPopupKeydown(event) {
    if (event.key !== 'Escape' || !popup) return;
    event.preventDefault();
    event.stopPropagation();
    closePopup();
}

function openPopup() {
    const store = settings();
    const host = document.getElementById('nonQRFormItems') ?? button.parentElement;
    popup = document.createElement('div');
    popup.id = 'jj-popup';
    popup.innerHTML = `
        <div class="jj-popup-head">
            <button type="button" class="jj-switch" role="switch" aria-label="전개 지시 켜기/끄기"><span></span></button>
            <div class="jj-popup-title"><i class="fa-solid fa-feather-pointed"></i><span>전개 지시</span><span class="jj-state"></span></div>
            <button type="button" class="jj-icon-btn" data-act="clear" title="내용 지우기" aria-label="내용 지우기"><i class="fa-solid fa-eraser"></i></button>
            <button type="button" class="jj-icon-btn" data-act="close" title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="jj-popup-body">
            <textarea class="jj-textarea" rows="3" spellcheck="false" placeholder="다음에 이어질 전개를 적어 주세요. 예: 둘이 비 오는 날 우연히 다시 마주친다"></textarea>
        </div>
        <div class="jj-popup-foot"><i class="fa-solid fa-circle-info"></i><span class="jj-foot-text"></span></div>`;
    const textarea = popup.querySelector('.jj-textarea');
    textarea.value = store.direction.content;

    popup.querySelector('.jj-switch').addEventListener('click', () => {
        store.direction.enabled = !store.direction.enabled;
        save();
        refreshButton();
    });
    textarea.addEventListener('input', () => {
        store.direction.content = textarea.value;
        save();
        refreshButton();
    });
    popup.querySelector('[data-act="close"]').addEventListener('click', closePopup);
    popup.querySelector('[data-act="clear"]').addEventListener('click', async () => {
        if (!store.direction.content) return;
        const confirmed = await callGenericPopup('전개 지시 내용을 모두 지울까요?', POPUP_TYPE.CONFIRM);
        if (!confirmed) return;
        store.direction.content = '';
        textarea.value = '';
        save();
        refreshButton();
    });

    host.append(popup);
    applyOnColor();
    refreshPopup();
    button.classList.add('has-popup');
    void popup.offsetWidth; // 애니메이션 시작점을 확정한다
    popup.classList.add('is-open');
    document.addEventListener('pointerdown', onOutsidePointer, true);
    document.addEventListener('keydown', onPopupKeydown, true);
}

function closePopup() {
    if (!popup) return;
    const closing = popup;
    popup = null;
    closing.classList.remove('is-open');
    setTimeout(() => closing.remove(), 180);
    button?.classList.remove('has-popup');
    document.removeEventListener('pointerdown', onOutsidePointer, true);
    document.removeEventListener('keydown', onPopupKeydown, true);
}

function togglePopup() {
    if (popup) closePopup();
    else openPopup();
}

// ── 설정 (확장 관리 화면) ───────────────────────────────────

const PROMPT_MEANING = [
    '아래 감독의 지시를 바탕으로 이야기를 이어 간다.',
    '감독은 초안만 준다. 문장을 그대로 인용하지 말고 자연스러운 글로 다듬는다.',
    '설득력 있는 인과가 부족한 부분은 창의적으로 채워서, 감독이 제시한 전개가 매끄럽게 이어지게 한다.',
    '[전개 지시 (비어 있으면 알아서 전개): {{direction}}]',
];

function depthMeaning(depth) {
    if (depth === 0) return '프롬프트 맨 끝';
    if (depth === 1) return '마지막 메시지 앞';
    return `끝에서 ${depth}번째 메시지 앞`;
}

let settingsRoot = null;

/** 설정 맨 위 상태 카드. 입력창에서 켜고 끄거나 내용을 고칠 때도 같이 바뀐다. */
function refreshSettingsStatus() {
    if (!settingsRoot) return;
    const store = settings();
    const on = isActive();
    settingsRoot.querySelector('.jj-status').classList.toggle('is-on', on);
    settingsRoot.querySelector('.jj-status-title').textContent = !store.extensionEnabled
        ? '입력창 버튼이 꺼져 있어요'
        : on ? '전개 지시 켜짐' : '전개 지시 꺼짐';
    settingsRoot.querySelector('.jj-status-text').textContent = !store.extensionEnabled
        ? '아래 ‘입력창 버튼’을 켜면 쓸 수 있어요'
        : hasContent() ? preview(store.direction.content, 70)
            : on ? '비어 있어요 · AI가 알아서 전개해요' : '입력창의 깃털 버튼으로 지시를 적어요';
    const toggle = settingsRoot.querySelector('#jj_direction_switch');
    toggle.setAttribute('aria-checked', String(store.direction.enabled));
    toggle.disabled = !store.extensionEnabled;
    settingsRoot.querySelector('#jj_extension_switch').setAttribute('aria-checked', String(store.extensionEnabled));
}

// 캐릭터 에셋 확장과 같은 카드 모양으로, 세로로 짧게: 상태 카드 → 설정 세 줄 → 접어 둔 프롬프트
function buildSettings() {
    const container = document.getElementById('extensions_settings');
    if (!container || document.getElementById('jj-settings')) return;
    const store = settings();
    const wrapper = document.createElement('div');
    wrapper.id = 'jj-settings';
    wrapper.className = 'jj-settings';
    wrapper.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b><i class="fa-solid fa-feather-pointed"></i> 전개 지시 <button type="button" class="jj-version ext-version" aria-label="전개 지시 사용방법">v${VERSION}</button></b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
              <div class="jj-settings-body">
                <div class="jj-status">
                    <span class="jj-status-dot" aria-hidden="true"></span>
                    <div class="jj-status-main">
                        <strong class="jj-status-title"></strong>
                        <span class="jj-status-text"></span>
                    </div>
                    <button type="button" class="jj-switch" id="jj_direction_switch" role="switch" aria-label="전개 지시 켜기/끄기"><span></span></button>
                </div>

                <div class="jj-card">
                    <div class="jj-row">
                        <div class="jj-row-label"><b>입력창 버튼</b><small>끄면 버튼이 숨고 보내지 않아요</small></div>
                        <button type="button" class="jj-switch" id="jj_extension_switch" role="switch" aria-label="입력창 버튼 쓰기"><span></span></button>
                    </div>
                    <div class="jj-row">
                        <div class="jj-row-label"><b>켜짐 표시 색</b><small>비우면 테마 색</small></div>
                        <div class="jj-color-row">
                            <label class="jj-swatch" title="색 선택기로 고르기"><input type="color" id="jj_on_color_swatch"></label>
                            <input type="text" id="jj_on_color" class="text_pole" placeholder="테마 색"
                                autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="색 코드 (#fac679 또는 250, 198, 121)">
                            <button type="button" id="jj_on_color_reset" class="menu_button jj-small-btn" title="테마 색으로 되돌리기">테마</button>
                        </div>
                    </div>
                    <div class="jj-row">
                        <div class="jj-row-label"><b>삽입 위치</b><small class="jj-depth-meaning"></small></div>
                        <div class="jj-stepper">
                            <button type="button" data-step="-1" aria-label="깊이 줄이기"><i class="fa-solid fa-minus"></i></button>
                            <input type="number" id="jj_depth" min="0" max="100" inputmode="numeric" aria-label="깊이">
                            <button type="button" data-step="1" aria-label="깊이 늘리기"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                </div>

                <details class="jj-card jj-prompt">
                    <summary>
                        <i class="fa-solid fa-scroll"></i><span>프롬프트</span><small class="jj-prompt-state"></small>
                        <i class="fa-solid fa-chevron-down jj-caret" aria-hidden="true"></i>
                    </summary>
                    <div class="jj-prompt-body">
                        <p class="jj-hint"><code>{{direction}}</code> 자리에 적은 지시가 들어가요. AI에게 보내는 글이라 영어로 두었어요.</p>
                        <details class="jj-meaning">
                            <summary>뜻 보기</summary>
                            <ul>${PROMPT_MEANING.map(line => `<li>${line}</li>`).join('')}</ul>
                        </details>
                        <textarea id="jj_prompt" class="text_pole" rows="7" placeholder="전개 지시 프롬프트"></textarea>
                        <div class="jj-prompt-actions">
                            <button type="button" id="jj_reset" class="menu_button jj-small-btn"><i class="fa-solid fa-rotate-left"></i><span>기본값으로</span></button>
                        </div>
                    </div>
                </details>
              </div>
            </div>
        </div>`;
    container.append(wrapper);
    settingsRoot = wrapper;
    wrapper.querySelector(".jj-version").onclick = event => {event.preventDefault();event.stopPropagation();showHelp();};

    const colorCode = wrapper.querySelector('#jj_on_color');
    const swatch = wrapper.querySelector('#jj_on_color_swatch');
    const depth = wrapper.querySelector('#jj_depth');
    const depthMeaningText = wrapper.querySelector('.jj-depth-meaning');
    const prompt = wrapper.querySelector('#jj_prompt');
    const promptState = wrapper.querySelector('.jj-prompt-state');

    const showDepth = () => {
        depth.value = String(store.promptDepth);
        depthMeaningText.textContent = depthMeaning(store.promptDepth);
    };
    const showPromptState = () => {
        promptState.textContent = store.directionPrompt === DEFAULT_PROMPT ? '기본값' : '직접 고침';
    };
    const fill = () => {
        colorCode.value = store.onColor;
        colorCode.classList.remove('is-invalid');
        swatch.value = effectiveOnColor();
        showDepth();
        prompt.value = store.directionPrompt;
        showPromptState();
        refreshSettingsStatus();
    };

    wrapper.querySelector('#jj_direction_switch').addEventListener('click', () => {
        store.direction.enabled = !store.direction.enabled;
        save();
        refreshButton();
    });
    wrapper.querySelector('#jj_extension_switch').addEventListener('click', () => {
        store.extensionEnabled = !store.extensionEnabled;
        if (!store.extensionEnabled) closePopup();
        save();
        refreshButton();
    });

    const setColor = (color) => {
        store.onColor = color;
        applyOnColor();
        swatch.value = effectiveOnColor();
        save();
        refreshButton();
    };
    colorCode.addEventListener('input', () => {
        const text = colorCode.value.trim();
        const color = parseColorCode(text);
        colorCode.classList.toggle('is-invalid', !!text && !color);
        if (!text) setColor('');
        else if (color) setColor(color);
    });
    colorCode.addEventListener('change', () => {
        const color = parseColorCode(colorCode.value);
        if (color) colorCode.value = color;
    });
    colorCode.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        colorCode.blur();
    });
    swatch.addEventListener('input', () => {
        colorCode.value = swatch.value;
        colorCode.classList.remove('is-invalid');
        setColor(swatch.value);
    });
    wrapper.querySelector('#jj_on_color_reset').addEventListener('click', () => {
        colorCode.value = '';
        colorCode.classList.remove('is-invalid');
        setColor('');
    });

    const setDepth = (value) => {
        store.promptDepth = clampDepth(value);
        showDepth();
        save();
        if (popup) refreshPopup();
    };
    depth.addEventListener('change', () => setDepth(depth.value));
    depth.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        depth.blur();
    });
    wrapper.querySelectorAll('.jj-stepper [data-step]').forEach((stepButton) => {
        stepButton.addEventListener('click', () => setDepth(store.promptDepth + Number(stepButton.dataset.step)));
    });

    prompt.addEventListener('input', () => {
        store.directionPrompt = prompt.value;
        showPromptState();
        save();
    });
    wrapper.querySelector('#jj_reset').addEventListener('click', async () => {
        const confirmed = await callGenericPopup('전개 지시 프롬프트를 기본값으로 되돌릴까요?', POPUP_TYPE.CONFIRM);
        if (!confirmed) return;
        store.directionPrompt = DEFAULT_PROMPT;
        prompt.value = DEFAULT_PROMPT;
        showPromptState();
        save();
    });

    fill();
}

// ── 시작 ────────────────────────────────────────────────────

initSettings();

export const ready = new Promise((resolve, reject) => jQuery(() => {
    try {
    applyOnColor();
    registerDirectionMacro();
    buildSettings();
    ensureButton();
    eventSource.on(event_types.GENERATION_STARTED, trackGeneration);
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, injectDirection);
    // 테마를 바꾸면 테마 색을 쓰는 경우의 글자색(켜짐 배지)도 다시 계산한다.
    eventSource.on(event_types.SETTINGS_UPDATED, syncOnColor); // 5.1.3: 저장마다 계산 스타일을 읽지 않고 값싼 서명이 바뀔 때만
    // 설정 저장을 기다리지 않고 테마 색이 바뀌는 그 자리에서 따라간다.
    // 실리태번 테마는 <html style>, 블루 레몬에이드는 <head>의 <style id="salty-vars"> · body 클래스를 바꾼다.
    // 1.1.0: 60ms 뒤에 바로 계산 스타일을 읽으면, 답이 스트리밍되는 도중(실리태번이 body 클래스를 붙였다 뗌)에는 채팅이 막 바뀐
    // 상태라 문서 전체 스타일 계산을 그 자리에서 강제로 돌렸다 (폰 흉내 4배 CPU 답 한 번 0.13초). 화면이 한 번 그려진 직후에 읽으면
    // 스타일이 이미 계산돼 있어 거의 공짜다. 화면이 꺼져 있으면 requestAnimationFrame 이 안 와서 1초 뒤에 그냥 읽는다
    let themeTimer = 0;
    let themeFrame = 0;
    const afterPaint = () => {
        clearTimeout(themeTimer);
        themeTimer = setTimeout(syncOnColor, 0);
    };
    // 5.1.3: 부팅 중엔 확장 CSS·색 변수·body 클래스가 수십 번 바뀌어 그때마다 문서 전체 스타일을 강제로 계산했다
    // (폰 흉내 부팅 0.4~0.9초). 앱이 준비될 때까지는 조용히 있다가 한 번만 맞춘다.
    let bootQuiet = !!document.getElementById('loader');
    if (bootQuiet) eventSource.once(event_types.APP_READY, () => setTimeout(() => { bootQuiet = false; syncOnColor(); }, 1500));
    const watchTheme = new MutationObserver(() => {
        if (bootQuiet || themeFrame) return;
        clearTimeout(themeTimer);
        themeTimer = setTimeout(() => { cancelAnimationFrame(themeFrame); themeFrame = 0; syncOnColor(); }, 1000);
        themeFrame = requestAnimationFrame(() => { themeFrame = 0; afterPaint(); });
    });
    watchTheme.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    watchTheme.observe(document.head, { childList: true, subtree: true, characterData: true });
    watchTheme.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // 배포 ZIP 자체의 버전 누락도 가능하므로 전달 전에 실제 CSS와 검사한다.
    // style.css의 버전 표시가 코드와 다르면 알려 준다.
    setTimeout(() => {
        const cssVersion = getComputedStyle(document.documentElement).getPropertyValue('--jj-css-version').trim().replace(/["']/g, '');
        if (cssVersion !== VERSION) {
            toastr.warning(`전개 지시 파일이 섞였어요 (코드 ${VERSION}, 스타일 ${cssVersion || '예전 것'}). 블루레몬에이드를 업데이트한 뒤 설치 점검을 실행해 주세요.`, '전개 지시', { timeOut: 15000 });
        }
    }, 2000);

    resolve();
    } catch(error) { reject(error); }
}));

export function showHelp() {
    return callGenericPopup('<h3>전개 지시 사용방법</h3><p>입력창 옆 깃털 버튼을 눌러 다음 장면이나 이야기의 방향을 적어요. 켜짐 스위치를 켜면 이후 대화 요청마다 지시가 들어가요.</p><p>한 번만 보내는 기능이 아니에요. 원하는 장면이 끝나면 끄거나 내용을 고쳐 주세요. 꺼도 적어 둔 내용은 남아요.</p><p>삽입 위치 0은 프롬프트 맨 끝, 1은 마지막 메시지 앞이에요. 프롬프트의 {{direction}} 자리에 적은 내용이 들어가요. 이 도구는 별도 모델을 호출하지 않고 현재 대화 요청에 지시를 추가해요.</p><p>입력창 버튼을 끄면 버튼과 지시 삽입이 함께 꺼져요. 기존 단독 전개 지시 확장과 동시에 켜지 마세요.</p>', POPUP_TYPE.TEXT, '', {okButton:'닫기'});
}
let settingsDialog = null;
export async function openPanel() {
    await ready;
    if (!settingsRoot || settingsDialog?.open) return;
    const previous = document.activeElement, anchor = document.createComment('direction settings');
    settingsRoot.before(anchor);
    const body = settingsRoot.querySelector('.inline-drawer-content'), display = body.style.display;
    body.style.display = 'block';
    settingsDialog = document.createElement('dialog');
    settingsDialog.className = 'bl-direction-dialog'; settingsDialog.setAttribute('aria-label','전개 지시');
    settingsDialog.innerHTML = '<header><b>전개 지시</b><button type="button" aria-label="전개 지시 닫기">×</button></header><div class="bl-direction-body"></div>';
    document.body.append(settingsDialog);settingsDialog.querySelector('.bl-direction-body').append(settingsRoot);
    settingsDialog.querySelector('header button').onclick = () => settingsDialog.close();
    settingsDialog.addEventListener('close', () => {body.style.display=display;anchor.replaceWith(settingsRoot);settingsDialog.remove();settingsDialog=null;if(previous?.isConnected)previous.focus();},{once:true});
    settingsDialog.showModal();
}
export function mountInline(host) {
    const button=document.createElement('button');button.type='button';button.className='salty-btn';button.textContent='전개 지시 설정 열기';button.onclick=openPanel;host.replaceChildren(button);return()=>host.replaceChildren();
}
