import { showThemeModal } from '../../modal.js';
// 전개 지시 — 다음 전개를 적어 두면 보낼 때마다 프롬프트에 끼워 넣는다.
// Direction-Manager-Lite를 한국어로 새로 만든 확장. 입력창 버튼 색으로 켜짐/꺼짐을 바로 알 수 있다.
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types } from '../../../../../../../script.js';
import { POPUP_TYPE, callGenericPopup } from '../../../../../../popup.js';

import { getChatCompletionModel, oai_settings } from '../../../../../../openai.js';
import { insertInstructions } from './prompt.js';
import { verifyAddonCss } from '../../addon-files-check.js';
import { badgeTextHit } from '../../badge-hit.js';
// 7.7.4 시작 덮개 동안은 테마 색을 읽지 않는다
import { afterBoot } from '../../boot-gate.js';

const MODULE = 'jeongaejisi';
const OLD_MODULE = 'Direction-Manager-Lite';
const VERSION = '1.3.6';
// 1.3.6: 프롬프트 쪽 줄을 꾹 눌러(마우스는 끌기 · 키보드 Alt+↑/↓) 순서를 바꾼다 — 목록 순서 = 보내는 순서
// 1.1.5: 깃털 창에 두 쪽 — 전개 지시(이번 전개) · 항상 지시(적은 글 그대로 매번, 예: <OOC: …>). 옆으로 넘기거나 제목을 눌러 바꾼다
// 1.3.4: 테두리 단계 선을 고정 1.3px 로 — 옆 선 아이콘 굵기 (em 비례는 폰에서 두꺼워졌다)
// 1.3.3: 깃털은 모든 단계가 같은 글리프(꺼짐은 흐린 색으로 채움), 테두리를 시안 굵기로 · 줄의 토큰 수는 숫자만
// 1.3.2: 3단계 빛을 보내기 줄의 다른 단추와 같은 세기로 (4px · 65%)
// 1.3.1: 깃털 그라데이션을 없앴다 — 색은 켜짐 색 하나, 보내는 것(전개 지시 · 항상 지시 · 켠 프롬프트) 수만큼 1 테두리 · 2 채움 · 3 채움 + 빛 (data-jj-level)
// 1.3.0: 세 번째 쪽 「프롬프트」 — 가끔 쓰는 프롬프트를 제목 한 줄씩 모아 두고 줄마다 켜고 끈다. 켠 것은 항상 지시 다음 · 전개 지시 앞에 같이 들어간다
const KINDS = ['direction', 'always', 'prompts'];
const TEXT_KINDS = ['direction', 'always'];   // 입력칸 하나짜리 쪽 (저장 · 최근 목록도 이 둘만)
const KIND_LABEL = { direction: '전개 지시', always: '항상 지시', prompts: '프롬프트' };
const HISTORY_MAX = 30;   // 최근: 실제로 보낸 지시 (쪽마다)
const PRESET_MAX = 100;   // 저장: 두 쪽 합쳐서
const PROMPT_MAX = 50;    // 1.3.0 프롬프트 쪽 줄 수
const PROMPT_TITLE_MAX = 60;

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
    always: { enabled: false, content: '' }, // 1.1.5 항상 지시: 적은 글을 틀 없이 그대로 매번 넣는다
    directionPrompt: DEFAULT_PROMPT,
    promptDepth: 1,                  // 0: 맨 끝, N: 끝에서 N번째 메시지 앞
    onColor: '',                     // 켜짐 표시 색. 비우면 테마의 대사 색
    presets: [],                     // 1.1.5 저장한 지시 [{ id, kind, content, at }] (최근 저장이 앞)
    history: { direction: [], always: [] }, // 1.1.5 실제로 보낸 지시 [{ content, at }] (최근이 앞)
    prompts: { enabled: true },      // 1.3.0 프롬프트 쪽 전체 스위치 (줄마다 켜고 끄는 것은 promptList 의 enabled)
    promptList: [],                  // 1.3.0 [{ id, title, content, enabled, at, updated }] (보이는 순서 = 보내는 순서)
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
    store.always = { enabled: false, content: '', ...(store.always && typeof store.always === 'object' ? store.always : {}) };
    store.always.enabled = !!store.always.enabled;
    store.always.content = String(store.always.content ?? '');
    const listed = item => !!item && typeof item === 'object' && typeof item.content === 'string' && item.content.trim() !== '';
    // 같은 글은 하나만, 앞뒤 공백 없이 — 저장 · 최근은 다듬은 글끼리 견준다 (손으로 고친 설정에 공백이 있으면 같은 글이 두 번 들어갔다)
    const unique = (items, key) => { const seen = new Set(); return items.filter(item => { item.content = item.content.trim(); const id = key(item); if (seen.has(id)) return false; seen.add(id); return true; }); };
    store.presets = unique((Array.isArray(store.presets) ? store.presets : []).filter(item => listed(item) && KINDS.includes(item.kind)), item => `${item.kind}\n${item.content}`).slice(0, PRESET_MAX);
    for (const item of store.presets) if (typeof item.id !== 'string' || !item.id) item.id = newId();
    const history = store.history && typeof store.history === 'object' ? store.history : {};
    store.history = Object.fromEntries(TEXT_KINDS.map(kind => [kind, unique((Array.isArray(history[kind]) ? history[kind] : []).filter(listed), item => item.content).slice(0, HISTORY_MAX)]));
    // 1.2.2 즐겨찾기 칩(6.2.8)은 뺐다 — 사용자 10-13 「별 빼줘 · 위의 북마크 표시(저장)로 하는 게 나을듯」.
    //       칩으로 넣어 둔 글은 저장 목록의 전개 지시로 옮기고(같은 글은 한 번만 · 저장 상한 안에서 · 칩 순서대로 맨 위에) 칸은 지운다
    if (Array.isArray(store.favorites)) {
        for (const item of [...store.favorites].reverse()) {
            const text = String((item && typeof item === 'object' ? item.text : item) ?? '').trim();
            if (!text || store.presets.length >= PRESET_MAX || store.presets.some(entry => entry.kind === 'direction' && entry.content === text)) continue;
            store.presets.unshift({ id: newId(), kind: 'direction', content: text, at: Date.now() });
        }
    }
    delete store.favorites;
    // 1.3.0 프롬프트 쪽 — 예전 설정에는 없으니 빈 목록 · 전체 스위치 켜짐으로 시작한다
    store.prompts = { enabled: true, ...(store.prompts && typeof store.prompts === 'object' && !Array.isArray(store.prompts) ? store.prompts : {}) };
    store.prompts.enabled = store.prompts.enabled !== false;
    store.promptList = (Array.isArray(store.promptList) ? store.promptList : []).map(normalizePrompt).filter(Boolean).slice(0, PROMPT_MAX);
    if (typeof store.directionPrompt !== 'string') store.directionPrompt = DEFAULT_PROMPT;
    store.promptDepth = clampDepth(store.promptDepth);
    store.extensionEnabled = store.extensionEnabled !== false;
    store.onColor = parseColorCode(store.onColor) ?? '';
}

/** 프롬프트 한 줄 모양 다듬기. 제목도 글도 없으면 버린다 */
function normalizePrompt(item) {
    if (!item || typeof item !== 'object') return null;
    const title = String(item.title ?? '').replace(/\s+/g, ' ').trim().slice(0, PROMPT_TITLE_MAX);
    const content = String(item.content ?? '');
    if (!title && !content.trim()) return null;
    const at = Number(item.at) > 0 ? Number(item.at) : Date.now();
    const out = { id: typeof item.id === 'string' && item.id ? item.id : newId(), title, content, enabled: item.enabled === true, at };
    if (Number(item.updated) > 0) out.updated = Number(item.updated);
    return out;
}

function newId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** 실제로 보낼 때 들어가는 상태인지 (전개 지시 — 비어 있어도 'AI가 알아서 전개'로 들어간다) */
function isActive() {
    const store = settings();
    return store.extensionEnabled && store.direction.enabled;
}

function hasContent(kind = 'direction') {
    return settings()[kind].content.trim() !== '';
}

/** 항상 지시는 적은 글 그대로라 비어 있으면 보낼 것이 없다 */
function alwaysActive() {
    const store = settings();
    return store.extensionEnabled && store.always.enabled && hasContent('always');
}

/** 1.3.0 켜 둔 프롬프트 (목록 순서, 글이 있는 것만) */
function enabledPrompts() {
    return settings().promptList.filter(item => item.enabled && item.content.trim() !== '');
}

/** 프롬프트 쪽은 항상 지시처럼: 입력창 버튼 + 쪽 스위치가 켜져 있고, 켠 줄이 하나라도 있어야 보낸다 */
function promptsActive() {
    const store = settings();
    return store.extensionEnabled && store.prompts.enabled && enabledPrompts().length > 0;
}

/** 1.3.1 깃털 켜짐 단계: 지금 보내는 것의 수 0~3 (전개 지시 · 항상 지시 · 켠 프롬프트 한 줄 이상) */
function sendLevel() {
    return [isActive(), alwaysActive(), promptsActive()].filter(Boolean).length;
}

function kindActive(kind) {
    return kind === 'always' ? alwaysActive() : kind === 'prompts' ? promptsActive() : isActive();
}

// ── 최근 · 저장 ─────────────────────────────────────────────

/** 최근 목록 맨 앞에 둔다. 이미 맨 앞이면 아무것도 안 바꾼다 (같은 지시로 계속 보낼 때 설정 저장을 부르지 않게) */
function remember(kind, content) {
    const text = String(content ?? '').trim();
    if (!text) return false;
    const list = settings().history[kind];
    if (list[0]?.content === text) return false;
    const index = list.findIndex(entry => entry.content === text);
    if (index >= 0) list.splice(index, 1);
    list.unshift({ content: text, at: Date.now() });
    if (list.length > HISTORY_MAX) list.length = HISTORY_MAX;
    return true;
}

function isSaved(kind, content) {
    const text = String(content ?? '').trim();
    return !!text && settings().presets.some(item => item.kind === kind && item.content === text);
}

/** 'saved' | 'duplicate' | 'full' | 'empty' */
function savePreset(kind, content) {
    const text = String(content ?? '').trim();
    const store = settings();
    if (!text) return 'empty';
    if (isSaved(kind, text)) return 'duplicate';
    if (store.presets.length >= PRESET_MAX) return 'full';
    store.presets.unshift({ id: newId(), kind, content: text, at: Date.now() });
    save();
    return 'saved';
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

/** 지금 적용되는 켜짐 색 (설정 색 또는 테마의 대사 색)을 #rrggbb로. style = 미리 받아 둔 :root 계산 스타일 (applyOnColor) */
function effectiveOnColor(style = null) {
    if (settings().onColor) return settings().onColor;
    return parseColorCode((style ?? getComputedStyle(document.documentElement)).getPropertyValue('--SmartThemeQuoteColor')) ?? '#e18a24';
}

function contrastInk(hex) {
    const value = Number.parseInt(hex.slice(1), 16);
    const luminance = 0.299 * (value >> 16 & 255) + 0.587 * (value >> 8 & 255) + 0.114 * (value & 255);
    return luminance > 160 ? '#1b1820' : '#ffffff';
}

/** 테마 글자색이 밝으면 어두운 테마다. 빠른 편집 창의 불투명 바탕을 여기에 맞춘다. */
function isDarkTheme(style = null) {
    const text = (style ?? getComputedStyle(document.documentElement)).getPropertyValue('--SmartThemeBodyColor');
    const channels = text.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)?.slice(1, 4).map(Number);
    if (!channels) return true;
    const [red, green, blue] = channels;
    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > 0.5;
}

// 5.6.4 (점검 RP-5): 예전엔 [:root 쓰기 → 계산 스타일 읽기]를 세 번 번갈아 해서 부팅 때 문서 전체 스타일 계산을 3~4번 강제했다 (폰 리그 4배 305~402 ms).
// 읽을 값을 먼저 다 읽고(계산은 첫 읽기 한 번) 그다음에 쓴다 — 쓰는 --jj-* 변수는 읽는 테마 색에 쓰이지 않는다.
// 읽은 값으로 syncOnColor 의 서명도 맞춰 둔다 — 부팅 1.5초 뒤의 첫 syncOnColor 가 같은 색이면 다시 칠하지 않게.
function applyOnColor() {
    const style = getComputedStyle(document.documentElement);
    const onInk = contrastInk(effectiveOnColor(style)), base = isDarkTheme(style) ? '#141318' : '#fbf9f6';
    onColorSignature = colorSignature(style);
    const rootStyle = document.documentElement.style;
    if (settings().onColor) rootStyle.setProperty('--jj-on-color', settings().onColor);
    else rootStyle.removeProperty('--jj-on-color');
    rootStyle.setProperty('--jj-on-ink', onInk);
    rootStyle.setProperty('--jj-base', base);
    rootStyle.setProperty('--jj-stroke', isDarkTheme(style) ? 'var(--jj-on)' : 'color-mix(in srgb, var(--jj-on) 80%, #b08000)');   // 1.3.1 테두리 단계 (밝은 테마는 조금 진하게)
    rootStyle.removeProperty('--jj-grad-a');   // 1.3.1 그라데이션은 없앴다 (예전 판이 남긴 값 치우기)
    rootStyle.removeProperty('--jj-grad-b');
}
const colorSignature = style => [settings().onColor, style.getPropertyValue('--SmartThemeQuoteColor').trim(), style.getPropertyValue('--SmartThemeBodyColor').trim(),
    style.getPropertyValue('--salty-pop').trim(), style.getPropertyValue('--salty-accent').trim(), document.body.classList.contains('salty-dark')].join('|');

/**
 * 테마 색이 실제로 바뀌었을 때만 다시 계산한다.
 * applyOnColor도 <html style>에 쓰기 때문에, 이 확인이 없으면 감시가 제 글씨에 다시 불려 돌고 돈다.
 */
let onColorSignature = '';
let onColorSource = null;
// 6.4.5 메시지 속 <style> 은 테마 색을 못 바꾼다(실리태번이 .mes_text 범위로 묶는다) — document.styleSheets.length 를 세면 메시지가 그려질 때마다
//   서명이 바뀌어 렌더 중에 문서 전체 스타일 계산을 강제했다 (답 24개 열기 8.3초). <head> 의 시트만 센다 (감시도 <head> 만 본다)
const headSheets = () => document.head.querySelectorAll('style, link[rel~="stylesheet"]').length;
function syncOnColor() {
    // 1.1.2: 계산된 스타일을 읽기 전에 색이 바뀔 수 있는 곳만 값싸게 견준다 — <html style> · 블루 레몬에이드의 색 변수 칸 · 밝음/어두움 클래스 ·
    // 스타일 시트 수. 답이 스트리밍되는 동안 실리태번이 body 클래스를 붙였다 떼는 것만으로 매번 문서 전체 스타일 계산을 돌렸다 (폰 흉내 한 턴 0.1초).
    const source = [settings().onColor, document.documentElement.getAttribute('style'), document.getElementById('salty-vars')?.textContent, document.body.classList.contains('salty'), document.body.classList.contains('salty-dark'), headSheets()].join('|');
    if (source === onColorSource) return;
    onColorSource = source;
    if (colorSignature(getComputedStyle(document.documentElement)) === onColorSignature) return;
    applyOnColor(); // 서명은 applyOnColor 가 읽은 값으로 맞춘다
}

// ── 프롬프트 주입과 {{direction}} 매크로 ────────────────────

/**
 * 실리태번은 1.13.5부터 generateRaw(다른 확장이 따로 보내는 요청 — 다시 쓰기, 기억 요약 확장 요약 등)에서도 같은 이벤트를 쏜다.
 * 거기에 "지시대로 이야기를 이어 가라"가 끼면 그 요청이 엉뚱하게 나오므로 본 생성(prepareOpenAIMessages)에만 넣는다.
 * 이벤트 데이터에는 둘을 가를 값이 없어 호출 경로로 본다. 경로를 못 읽는 브라우저에서는 예전처럼 넣는다.
 */
function isRawGeneration() {
    return /\bgenerateRaw(?:Data)?\b/.test(new Error().stack ?? '');
}

/**
 * 2026-10-13 지시 글의 {{user}} · {{char}} 같은 매크로를 보내기 직전에 실제 값으로 바꾼다. 실리태번은 CHAT_COMPLETION_PROMPT_READY 를
 * 쏜 뒤 매크로를 다시 바꾸지 않아서, 항상 지시 · 전개 지시에 적은 {{user}} 가 글자 그대로 모델에 갔다.
 * 매크로가 없는 글은 부르지 않고 그대로 둔다 (보내는 글이 한 글자도 안 바뀜). 바꾸다 오류가 나면 적은 그대로 보낸다.
 */
const MACRO_HINT = /\{\{|<(?:USER|BOT|CHAR|CHARIFNOTGROUP|GROUP)>/i;
function substituteMacros(text) {
    if (typeof text !== 'string' || !MACRO_HINT.test(text)) return text;
    try {
        const result = getContext().substituteParams?.(text);
        return typeof result === 'string' ? result : text;
    } catch (error) {
        console.warn('[전개 지시] 매크로를 바꾸지 못해 적은 그대로 보냅니다:', error);
        return text;
    }
}

// 생성 종류는 GENERATION_STARTED(prepareOpenAIMessages 보다 먼저)에서 받아 둔다. 조용한 생성(/gen · 요약 · 그림 프롬프트 · 표정)과
// 대신 쓰기(impersonate)에는 넣지 않는다. 한 번 쓰면 비워서 지난 값이 다음 요청에 새지 않게 한다.
let generationType = null;
// 2026-10-06 dry run(프롬프트 관리자 토큰 계산 = Generate('normal', {}, true))은 이 값을 쓰지도 비우지도 않는다 —
// 겹치면 dry run 이 본 요청의 종류를 먼저 비워 실제 요청에서 지시가 빠졌다. generateRaw 도 본 요청의 값을 비우지 않는다.
function trackGeneration(type, _params, dryRun) {
    if (dryRun) return;
    generationType = typeof type === 'string' ? type : null;
}

function injectDirection(eventData) {
    if (isRawGeneration()) return;
    const dry = !!eventData?.dryRun;
    const type = dry ? 'normal' : generationType;
    if (!dry) generationType = null;
    if (!(isActive() || alwaysActive() || promptsActive()) || type === null || type === 'quiet' || type === 'impersonate') return;
    const store = settings();
    const template = store.directionPrompt;
    const messages = eventData?.chat;
    if (!Array.isArray(messages)) return;
    const direction = isActive() && !!template?.trim();
    const always = alwaysActive();
    const prompts = promptsActive() ? enabledPrompts() : [];
    if (!direction && !always && !prompts.length) return;

    // 항상 지시 먼저, 전개 지시가 끝 쪽 — 같은 자리(삽입 위치)에 system 메시지 둘
    // 1.3.0 켠 프롬프트는 그 사이에 목록 순서대로 하나씩 (항상 지시 → 프롬프트 → 전개 지시). 매크로는 항상 지시와 같게 바꾼다
    const contents = [];
    // 틀의 {{direction}} 자리를 먼저 채운 뒤 글 전체의 매크로를 한 번에 바꾼다 (최근 목록에는 적은 그대로 남는다)
    if (always) contents.push(substituteMacros(store.always.content));
    for (const item of prompts) contents.push(substituteMacros(item.content));
    if (direction) contents.push(substituteMacros(template.replace(/\{\{direction\}\}/gi, () => store.direction.content)));
    const prefill = type === 'impersonate' ? oai_settings.assistant_impersonation : oai_settings.assistant_prefill;
    insertInstructions(messages, contents, store.promptDepth, getChatCompletionModel(oai_settings), { type, prefill, appendUser: direction });

    // 최근: 실제로 보낸 지시만. 이미 맨 앞이면 설정을 저장하지 않는다.
    // 프롬프트 관리자의 토큰 계산(dry run — 답을 받거나 메시지를 고칠 때마다 돈다)은 보낸 것이 아니다: 적다 만 글이 최근에 쌓였다
    if (eventData.dryRun) return;
    let changed = false;
    if (always) changed = remember('always', store.always.content) || changed;
    if (direction && hasContent('direction') && /\{\{direction\}\}/i.test(template)) changed = remember('direction', store.direction.content) || changed; // 틀에 자리가 없으면 글은 안 들어간다
    if (changed) {
        save();
        if (popup && listView === 'history') renderList();
    }
}

// 프리셋 안에서 {{direction}}을 직접 쓸 수도 있게 매크로로도 둔다. 꺼져 있으면 빈칸이 된다.
// 2026-10-13 실리태번은 {{user}} 를 {{direction}} 보다 먼저 바꾸므로 지시 안의 {{user}} 는 여기서 바꿔 돌려준다.
// 지시 글에 {{direction}} 이 또 있으면 그 안쪽은 적은 그대로 (끝없이 돌지 않게)
let expandingMacro = false;
function directionMacroText() {
    if (!isActive()) return '';
    const text = settings().direction.content;
    if (expandingMacro) return text;
    expandingMacro = true;
    try { return substituteMacros(text); } finally { expandingMacro = false; }
}

function registerDirectionMacro() {
    try {
        getContext().registerMacro?.('direction', directionMacroText, '전개 지시에 적은 내용 (꺼져 있으면 빈칸)');
    } catch (error) {
        console.warn('[전개 지시] {{direction}} 매크로를 등록하지 못했습니다:', error);
    }
}

// ── 입력창 버튼 ─────────────────────────────────────────────

let button = null;
let popup = null;
let page = 'direction';   // 1.1.5 깃털 창에 보이는 쪽 (이번 접속 동안 기억)
let listView = null;      // 1.1.5 목록을 보는 중이면 'presets' | 'history'

function preview(text, length = 50) {
    const line = text.replace(/\s+/g, ' ').trim();
    return line.length > length ? `${line.slice(0, length)}…` : line;
}

function refreshButton() {
    refreshSettingsStatus();
    if (!button) return;
    const on = isActive();
    const always = alwaysActive();
    const prompts = promptsActive() ? enabledPrompts() : [];
    const filled = hasContent();
    button.hidden = !settings().extensionEnabled;
    // 1.3.1 켜짐 단계 = 보내는 것의 수 (전개 지시 · 항상 지시 · 켠 프롬프트 한 줄 이상). 전개 지시를 꺼도 다른 것을 보내는 중이면 켜짐 색으로 남는다
    const level = sendLevel();
    button.dataset.jjLevel = String(level);
    button.classList.toggle('is-on', level > 0);
    button.classList.remove('is-always');
    button.classList.toggle('has-content', filled);
    button.setAttribute('aria-pressed', String(level > 0));
    const lines = [!on
        ? '전개 지시 꺼짐'
        : filled ? `전개 지시 켜짐 · ${preview(settings().direction.content)}` : '전개 지시 켜짐 · 내용이 비어 있어 AI가 알아서 전개해요'];
    if (always) lines.push(`항상 지시 켜짐 · ${preview(settings().always.content)}`);
    if (prompts.length) lines.push(`프롬프트 ${prompts.length}개 켜짐 · ${preview(prompts.map(promptTitle).join(' · '))}`);
    button.title = `${lines.join('\n')}\n눌러서 열기 · 길게 누르면 전개 지시 켜기/끄기`;
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
    // 5.1.7: 보내기 번역 💬 와 같은 조작 — 길게 누르면 켜기/끄기, 짧게 누르면 입력창. 길게 누른 뒤 따라오는 click 은 삼킨다
    let pressTimer = null, longPressed = false;
    const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; };
    let touchPress = false;
    button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return; // 오른쪽 · 가운데 버튼은 길게 누르기가 아니다
        touchPress = event.pointerType !== 'mouse';
        longPressed = false;
        cancelPress();
        pressTimer = setTimeout(() => {
            longPressed = true;
            navigator.vibrate?.(20);
            const store = settings();
            store.direction.enabled = !store.direction.enabled;
            save();
            refreshButton();
        }, 550);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => button.addEventListener(type, cancelPress));
    button.addEventListener('contextmenu', (event) => { if (touchPress) event.preventDefault(); }); // 길게 누를 때 폰 메뉴가 뜨지 않게 (마우스 우클릭 메뉴는 둔다)
    button.addEventListener('click', () => {
        if (longPressed) { longPressed = false; return; }
        togglePopup();
    });
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

const PLACEHOLDER = {
    direction: '다음에 이어질 전개를 적어 주세요. 예: 둘이 비 오는 날 우연히 다시 마주친다',
    always: '보낼 때마다 그대로 넣을 글을 적어 주세요. 예: <OOC: 캐릭터 에셋 이미지를 2장 이상 출력하시오.>',
};

function footText() {
    const store = settings();
    const depth = store.promptDepth;
    const where = depth === 0 ? '프롬프트 맨 끝' : `끝에서 ${depth}번째 메시지 앞`;
    if (page === 'prompts') {
        if (!store.extensionEnabled || !store.prompts.enabled) return '꺼져 있어서 보내지 않아요. 켜면 줄마다 켜 둔 프롬프트가 같이 들어가요.';
        const count = enabledPrompts().length;
        return count ? `켜 둔 ${count}개가 항상 지시 다음, 전개 지시 앞에 ${where}에 들어가요.` : '줄 오른쪽 스위치로 켠 프롬프트만 보내요.';
    }
    if (page === 'always') {
        if (!store.extensionEnabled || !store.always.enabled) return '꺼져 있어서 보내지 않아요. 켜면 적은 글이 그대로 매번 들어가요.';
        return hasContent('always') ? `보낼 때마다 이 글이 그대로 ${where}에 들어가요.` : '비어 있어서 보내지 않아요.';
    }
    if (!isActive()) return '꺼져 있어서 보내지 않아요. 켜면 적어 둔 내용이 들어가요.';
    return hasContent()
        ? `보낼 때마다 이 지시가 ${where}에 들어가요.`
        : `비워 두면 'AI가 알아서 전개'로 ${where}에 들어가요.`;
}

function stateText(kind) {
    const store = settings();
    if (kind === 'prompts') {
        if (!store.extensionEnabled || !store.prompts.enabled) return '꺼짐';
        const count = enabledPrompts().length;
        return count ? `${count}개 켜짐` : store.promptList.length ? '켠 것 없음' : '비어 있음';
    }
    if (kindActive(kind)) return '켜짐';
    return kind === 'always' && store.extensionEnabled && store.always.enabled ? '비어 있음' : '꺼짐';
}

function refreshPopup() {
    const store = settings();
    popup.dataset.page = page;
    popup.classList.toggle('is-on', kindActive(page));
    const toggle = popup.querySelector('.jj-switch');
    toggle.setAttribute('aria-checked', String(store[page].enabled));
    toggle.setAttribute('aria-label', `${KIND_LABEL[page]} 켜기/끄기`);
    popup.querySelector('.jj-title-text').textContent = KIND_LABEL[page];
    popup.querySelector('.jj-state').textContent = stateText(page);
    popup.querySelectorAll('.jj-dots b').forEach((dot, index) => dot.classList.toggle('is-current', KINDS[index] === page));
    popup.querySelectorAll('.jj-page').forEach(section => section.classList.toggle('is-off', !kindActive(section.dataset.kind)));
    popup.querySelector('.jj-page-prompts')?.classList.toggle('is-muted', !(store.extensionEnabled && store.prompts.enabled));   // 쪽 스위치가 꺼지면 줄을 흐리게 (줄 스위치는 그대로 보인다)
    popup.querySelector('.jj-foot-text').textContent = footText();
    popup.querySelector('.jj-send').hidden = !sendButton();   // 1.2.3 보내기 단추가 숨은 동안(생성 중 · 스와이프 중 · 명령 실행 중)은 ▶ 도 숨긴다
    // 1.3.0 프롬프트 쪽에는 저장 · 최근 목록과 지우개가 없다 (줄마다 고치기 · 지우기)
    for (const act of ['list', 'clear']) popup.querySelector(`.jj-popup-head [data-act="${act}"]`).hidden = page === 'prompts';
    popup.dataset.jjLevel = String(sendLevel());   // 1.3.1 창 제목 깃털도 입력창 깃털과 같은 단계 모양
    if (page === 'prompts' && popup.dataset.tokPage !== 'prompts') void fillPromptTokens();   // 1.3.2 프롬프트 쪽으로 넘어올 때만 센다
    popup.dataset.tokPage = page;
    syncPagesHeight();
    if (listView) renderList();
}

// 1.3.0 쪽 높이: 글 두 쪽(전개 · 항상)은 예전처럼 둘 중 긴 쪽을 따르고, 프롬프트 쪽(style.css 에서 contain: size — 높이에 끼지 않음)은
//       보는 동안만 그 목록 높이를 잡는다. 목록이 길어도 전개 지시 입력칸이 덩달아 늘어나지 않게
let promptsResize = null;
function syncPagesHeight() {
    const pages = popup?.querySelector('.jj-pages');
    const box = popup?.querySelector('.jj-prompts');
    if (!pages || !box) return;
    const pad = getComputedStyle(pages).boxSizing === 'border-box' ? 6 : 0;   // .jj-pages 위아래 3px (초점 테두리 자리)
    const height = page === 'prompts' && !pages.hidden ? `${Math.ceil(box.offsetHeight) + pad}px` : '0px';
    if (pages.style.minHeight !== height) pages.style.minHeight = height;
}

// 1.2.3 깃털 창 안 ▶ — 지시는 적는 대로 저장돼 있으니 창을 닫고 실리태번의 보내기 단추를 누른다. 빈 입력(이어 쓰기) · 생성 중 규칙은 실리태번 것 그대로
//       (사용자 10-13: 깃털 → 쓰기 → 닫기 → 보내기 네 번을 한 번으로). 글을 넣는 게 아니라 보내기 동작만 — 지시 켜기/끄기는 손대지 않는다
function sendButton(doc = document) {
    const element = doc.getElementById('send_but');
    if (!element || !element.getClientRects().length) return null;
    // 명령 실행 중에는 실리태번이 보내기 단추를 visibility 로 숨긴다(상자는 남는다) — 그때 누르면 아무것도 안 가니 ▶ 도 숨긴다 (테마 없이도 같게)
    if (element.closest?.('.isExecutingCommandsFromChatInput')) return null;
    const view = doc.defaultView;
    if (view?.getComputedStyle && view.getComputedStyle(element).visibility === 'hidden') return null;
    return element;
}

function sendNow(doc = document) {
    const target = sendButton(doc);
    if (!target) return false;
    closePopup();
    target.click();
    return true;
}

// 창이 열려 있는 동안 실리태번의 생성 중 표시(body[data-generating] · [data-swiping]) · 명령 실행 중(#form_sheld class) ·
// 연결 전 숨김(#send_but.displayNone)을 따라 ▶ 를 숨기고 보인다
let sendWatch = null;
function watchSendButton() {
    sendWatch?.disconnect();
    sendWatch = typeof MutationObserver === 'function' ? new MutationObserver(() => { if (popup) refreshPopup(); }) : null;
    if (!sendWatch) return;
    sendWatch.observe(document.body, { attributes: true, attributeFilter: ['data-generating', 'data-swiping'] });
    for (const id of ['form_sheld', 'send_but']) {
        const element = document.getElementById(id);
        if (element) sendWatch.observe(element, { attributes: true, attributeFilter: ['class', 'style'] });
    }
}

function pageTextarea(kind) {
    return popup?.querySelector(`.jj-page[data-kind="${kind}"] .jj-textarea`);
}

// 쪽 넘기기: 가로 스크롤 + 스냅 (손가락으로 밀면 브라우저가 넘기고, 제목을 누르면 여기서 스크롤한다)
let pageTarget = null;   // 코드로 넘기는 중이면 목표 쪽 — 그동안 중간 위치로 제목이 흔들리지 않게
let pageTargetTimer = 0;
let pageFrame = 0;

function pageOffset(kind) {
    const pages = popup.querySelector('.jj-pages');
    return pages.querySelector(`.jj-page[data-kind="${kind}"]`).offsetLeft - pages.firstElementChild.offsetLeft;
}

function showPage(kind, { smooth = true } = {}) {
    page = KINDS.includes(kind) ? kind : 'direction';
    if (!popup) return;
    if (page === 'prompts' && listView) setListView(null);   // 저장 · 최근 목록은 글 쪽에만 — 목록을 닫고 쪽을 보인다
    const pages = popup.querySelector('.jj-pages');
    if (!pages.hidden) {
        const left = pageOffset(page);
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (smooth && !reduce && Math.abs(pages.scrollLeft - left) > 1) {
            pageTarget = page;
            clearTimeout(pageTargetTimer);
            pageTargetTimer = setTimeout(() => { pageTarget = null; }, 700);
            pages.scrollTo({ left, behavior: 'smooth' });
        } else {
            pages.scrollLeft = left;
        }
    }
    refreshPopup();
}

function onPagesScroll() {
    if (pageFrame) return;
    pageFrame = requestAnimationFrame(() => {
        pageFrame = 0;
        const pages = popup?.querySelector('.jj-pages');
        if (!pages || pages.hidden) return;
        const step = Math.abs(pageOffset('always'));   // 한 쪽 폭 (+ 사이)
        if (pageTarget) {
            if (Math.abs(pages.scrollLeft - pageOffset(pageTarget)) > 2) return;
            pageTarget = null;
        }
        // 가장 가까운 쪽 (오른쪽에서 왼쪽으로 쓰는 화면은 값이 음수)
        const kind = step ? KINDS[Math.min(KINDS.length - 1, Math.round(Math.abs(pages.scrollLeft) / step))] : 'direction';
        if (kind === page) return;
        page = kind;
        refreshPopup();
    });
}

// ── 저장 · 최근 목록 ──

function listEntries(view) {
    const store = settings();
    return view === 'presets' ? store.presets.filter(item => item.kind === page) : store.history[page];
}

function iconButton(act, icon, label, index) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'jj-icon-btn';
    element.dataset.act = act;
    element.dataset.index = String(index);
    element.setAttribute('aria-label', label);
    element.innerHTML = `<i class="${icon}"></i>`;
    return element;
}

function renderList() {
    if (!popup) return;
    const box = popup.querySelector('.jj-list');
    const pages = popup.querySelector('.jj-pages');
    const toggle = popup.querySelector('[data-act="list"]');
    const view = listView;
    box.hidden = !view;
    popup.classList.toggle('is-list', !!view);
    toggle.setAttribute('aria-expanded', String(!!view));
    toggle.classList.toggle('is-active', !!view);
    if (!view) {
        if (pages.hidden) {
            pages.hidden = false;
            pages.scrollLeft = pageOffset(page); // 숨겼다 보이면 가로 위치가 처음으로 돌아간다
        }
        return;
    }
    pages.hidden = true;
    box.querySelectorAll('.jj-seg [data-list]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.list === view)));
    const current = settings()[page].content.trim();
    const keep = box.querySelector('[data-act="save-preset"]');
    keep.hidden = view !== 'presets';
    keep.disabled = !current || isSaved(page, current);
    const entries = listEntries(view);
    box.querySelector('.jj-items').replaceChildren(...entries.map((entry, index) => {
        const item = document.createElement('li');
        item.className = 'jj-item';
        item.classList.toggle('is-current', entry.content === current);
        const use = document.createElement('button');
        use.type = 'button';
        use.className = 'jj-item-text';
        use.dataset.act = 'use';
        use.dataset.index = String(index);
        const line = document.createElement('span'); // 줄 자르기(line-clamp)는 단추가 아니라 안쪽 글에 건다
        line.className = 'jj-item-line';
        line.textContent = entry.content;
        use.append(line);
        item.append(use);
        if (view === 'history') {
            const saved = isSaved(page, entry.content);
            const keepButton = iconButton('keep', saved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark', saved ? '저장됨' : '저장', index);
            keepButton.disabled = saved;
            item.append(keepButton);
        }
        item.append(iconButton('remove', 'fa-solid fa-xmark', '목록에서 지우기', index));
        return item;
    }));
    const empty = box.querySelector('.jj-empty');
    empty.hidden = entries.length > 0;
    empty.textContent = view === 'presets' ? '저장한 지시가 없어요.' : '아직 보낸 지시가 없어요.';
}

function setListView(view) {
    listView = (view === 'presets' || view === 'history') && TEXT_KINDS.includes(page) ? view : null;
    renderList();
}

// ── 1.3.0 프롬프트 쪽: 제목 한 줄씩 · 누르면 아래로 내용 · 줄마다 켜기/끄기 ──

let openPromptId = null;   // 펼친 줄 (한 번에 하나)
let promptEdit = null;     // 고치는 중 { id: 줄 id | 'new', title, content } — 창을 닫았다 열어도 이어서 고친다 (이번 접속 동안)

function promptTitle(item) {
    return item.title || preview(item.content, 24) || '제목 없음';
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function makeEl(tag, className, text = null) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== null) element.textContent = text;
    return element;
}

function promptButton(act, className, icon, label, { text = '', disabled = false } = {}) {
    const element = makeEl('button', className);
    element.type = 'button';
    element.dataset.pact = act;
    element.innerHTML = `<i class="${icon}" aria-hidden="true"></i>`;
    if (text) element.append(makeEl('span', '', text));
    else element.setAttribute('aria-label', label);
    element.disabled = disabled;
    return element;
}

// ── 번역 보기 (사용자 「무슨 프롬프트인지 헷갈릴 때 바로 번역본 보면 좋잖아 · 한글화 패널처럼 번역본이 위에, 원문이 아래로」) ──
// 프롬프트가 든 칸(프롬프트 쪽 줄 · 고치는 칸, 설정의 전개 지시 프롬프트) 위에 번역본(읽기 전용 면), 아래에 원문 — 한글화 패널 항목의 「번역 · 원문」 차례 그대로.
// 번역 엔진 · 캐시는 한글화 패널(prompt 애드온)의 translatePlainText · cachedTextTranslation 을 그대로 부른다(새 번역 길 없음).
// 요청은 사람이 단추를 눌렀을 때만 · 같은 글은 캐시에서 바로(이번 접속의 표 → 패널의 파일 캐시). 원문은 그대로 고칠 수 있고, 번역한 글과 달라지면 「원문이 바뀌었어요 · 다시 번역」.
// 칸마다 상태 하나(trStates — 'p:<줄 id>' · 'p:new' · 's:prompt'): 펼침 · 번역한 원문 · 번역문 · 진행 · 실패. 목록을 다시 그려도(펼치기 · 고치기) 남는다.
const TR_ICON = 'fa-solid fa-language';   // 한글화 패널 「번역」 단추와 같은 아이콘
const TR_FAIL = '번역하지 못했어요. 번역 연결을 확인해 주세요.';
const TR_MEMO_MAX = 50;
const trStates = new Map();
const trMemo = new Map();   // 원문 → 번역문 (이번 접속)
let trEngine = null;        // { cached(text), translate(text) } — 처음 누를 때 한글화 패널에서 가져온다

/** 시험 · 화면 확인에서 가짜 번역으로 바꿔 끼운다 (실제 요청을 보내지 않게). 평소에는 부르지 않는다 */
export function useTranslateEngine(engine) { trEngine = engine; }

async function translateEngine() {
    if (trEngine) return trEngine;
    if (!extension_settings?.salty?.addons?.prompt) throw Object.assign(new Error('한글화 패널 애드온을 켜면 번역을 볼 수 있어요.'), { userMessage: true });
    const panel = await import('../prompt/index.js');
    await panel.ready;
    if (typeof panel.translatePlainText !== 'function') throw new Error('한글화 패널에 translatePlainText 가 없어요');
    trEngine = { cached: text => panel.cachedTextTranslation(text), translate: text => panel.translatePlainText(text) };
    return trEngine;
}

const trNorm = text => String(text ?? '').trim();
function trState(key) {
    if (!trStates.has(key)) trStates.set(key, { open: false, source: '', text: '', busy: false, error: '' });
    return trStates.get(key);
}
/** 그 칸의 지금 원문: 고치는 중이면 고치는 글 */
function trSourceOf(key) {
    if (key === 's:prompt') return settings().directionPrompt;
    const id = key.slice(2);
    if (promptEdit?.id === id) return promptEdit.content;
    return settings().promptList.find(item => item.id === id)?.content ?? '';
}
const trRoot = key => (key === 's:prompt' ? settingsRoot : popup);

function trBoxInner(redoClass) {
    return `<div class="jj-tr-head"><span class="jj-tr-label">번역</span><span class="jj-tr-stale" hidden>원문이 바뀌었어요</span><button type="button" class="${redoClass} jj-tr-redo" data-pact="translate-redo" hidden><span>다시 번역</span></button></div>`
        + '<div class="jj-tr-text" aria-live="polite"></div><div class="jj-tr-label jj-tr-orig">원문</div>';
}
function translateBox(key) {
    const box = makeEl('div', 'jj-tr');
    box.dataset.tr = key;
    box.hidden = true;
    box.innerHTML = trBoxInner('jj-pbtn');
    return box;
}
function translateButton(key) {
    const button = promptButton('translate', 'jj-pbtn jj-pbtn-icon jj-tr-btn', TR_ICON, '번역 보기');   // 같은 줄 ↑ ↓ 와 같은 모양(같은 역할 같은 크기)
    button.dataset.tr = key;
    button.setAttribute('aria-expanded', 'false');
    return button;
}

/** 상태대로 번역 단추 · 번역본 상자를 칠한다. root 를 주면 그 안(막 만든 줄)만 */
function paintTranslation(key, root = trRoot(key)) {
    if (!root?.querySelectorAll) return;
    const state = trState(key);
    for (const button of root.querySelectorAll('.jj-tr-btn')) {
        if (button.dataset.tr !== key) continue;
        const label = state.open ? '번역 접기' : '번역 보기';
        button.setAttribute('aria-label', label);
        button.title = label;
        button.setAttribute('aria-expanded', String(state.open));
        button.setAttribute('aria-busy', String(state.busy));
        button.innerHTML = `<i class="${state.busy ? 'fa-solid fa-spinner fa-spin' : TR_ICON}" aria-hidden="true"></i>`;
    }
    for (const box of root.querySelectorAll('.jj-tr')) {
        if (box.dataset.tr !== key) continue;
        box.hidden = !state.open;
        if (!state.open) continue;
        const stale = !state.busy && !state.error && !!state.source && trNorm(trSourceOf(key)) !== state.source;
        box.classList.toggle('is-stale', stale);
        box.querySelector('.jj-tr-stale').hidden = !stale;
        const redo = box.querySelector('.jj-tr-redo');
        redo.hidden = state.busy || !(stale || state.error);
        redo.querySelector('span').textContent = state.error ? '다시 시도' : '다시 번역';
        const text = box.querySelector('.jj-tr-text');
        text.classList.toggle('is-muted', state.busy || !!state.error || !state.text);
        text.textContent = state.busy ? '번역하는 중…' : state.error || state.text || '번역할 글이 없어요.';
    }
}

async function runTranslation(key) {
    const state = trState(key);
    if (state.busy) return;
    const source = trNorm(trSourceOf(key));
    Object.assign(state, { source, error: '', text: '' });
    const memo = source && trMemo.get(source);
    if (!source || memo) {
        state.text = memo || '';
        paintTranslation(key);
        return;
    }
    state.busy = true;
    paintTranslation(key);
    try {
        const engine = await translateEngine();
        const text = engine.cached?.(source) || await engine.translate(source);
        if (!trNorm(text)) throw new Error('빈 번역');
        if (trMemo.size >= TR_MEMO_MAX) trMemo.delete(trMemo.keys().next().value);
        trMemo.set(source, text);
        state.text = text;
    } catch (error) {
        console.warn('[전개 지시] 번역', error);
        state.error = error?.userMessage ? error.message : TR_FAIL;
    } finally {
        state.busy = false;
        paintTranslation(key);
    }
}

/** 번역 단추: 펼치면 그 칸의 지금 원문을 번역(캐시에 있으면 바로) · 다시 누르면 접는다 */
function toggleTranslation(key) {
    const state = trState(key);
    state.open = !state.open;
    if (state.open && !state.busy && (!state.source || trNorm(trSourceOf(key)) !== state.source || state.error)) return runTranslation(key);
    paintTranslation(key);
}

function onTranslateAct(act, key) {
    if (!key) return;
    if (act === 'translate') return toggleTranslation(key);
    if (act === 'translate-redo' && trState(key).open) return runTranslation(key);
}

function promptEditor(item) {
    const box = makeEl('div', 'jj-pedit');
    const title = makeEl('input', 'jj-ptitle-input');
    title.type = 'text';
    title.maxLength = PROMPT_TITLE_MAX;
    title.placeholder = '제목 (예: 문체 다듬기)';
    title.setAttribute('aria-label', '프롬프트 제목');
    title.setAttribute('enterkeyhint', 'next');
    title.autocomplete = 'off';
    title.spellcheck = false;
    title.dataset.field = 'title';
    title.value = promptEdit.title;
    const content = makeEl('textarea', 'jj-pcontent-input');
    content.rows = 4;
    content.placeholder = '같이 보낼 글을 적어 주세요. {{char}} · {{user}} 도 이름으로 바뀌어 들어가요.';
    content.setAttribute('aria-label', '프롬프트 내용');
    content.spellcheck = false;
    content.dataset.field = 'content';
    content.value = promptEdit.content;
    const key = `p:${item ? item.id : 'new'}`;   // 번역 보기: 고치는 칸 위에 번역본 (펼친 줄과 같은 상태)
    const actions = makeEl('div', 'jj-pitem-actions');
    actions.append(translateButton(key),
        makeEl('span', 'jj-pspacer jj-pedit-tok'),   // 1.3.2 적는 글의 토큰 수
        promptButton('cancel', 'jj-pbtn', 'fa-solid fa-xmark', '', { text: '취소' }),
        promptButton('save', 'jj-pbtn is-primary', 'fa-solid fa-check', '', { text: item ? '저장' : '추가' }));
    box.append(title, translateBox(key), content, actions);
    paintTranslation(key, box);
    return box;
}

function promptRow(item, index, total) {
    const row = makeEl('li', 'jj-pitem');
    row.dataset.id = item.id;
    row.classList.toggle('is-on', item.enabled);
    if (promptEdit?.id === item.id) {
        row.classList.add('is-editing');
        row.append(promptEditor(item));
        return row;
    }
    const open = openPromptId === item.id;
    row.classList.toggle('is-open', open);
    const head = makeEl('div', 'jj-pitem-head');
    const toggle = makeEl('button', 'jj-pitem-toggle');
    toggle.type = 'button';
    toggle.dataset.pact = 'expand';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown');   // 1.3.6 순서 옮기기
    toggle.innerHTML = '<i class="fa-solid fa-chevron-right jj-pitem-caret" aria-hidden="true"></i>';
    toggle.append(makeEl('span', 'jj-pitem-title', promptTitle(item)));
    const toggleSwitch = makeEl('button', 'jj-switch jj-pswitch');
    toggleSwitch.type = 'button';
    toggleSwitch.dataset.pact = 'switch';
    toggleSwitch.setAttribute('role', 'switch');
    toggleSwitch.setAttribute('aria-checked', String(item.enabled));
    toggleSwitch.setAttribute('aria-label', `${promptTitle(item)} 켜기/끄기`);
    toggleSwitch.innerHTML = '<span></span>';
    head.append(toggle, makeEl('span', 'jj-ptok'), toggleSwitch);   // 1.3.2 토큰 수 (제목이 먼저 줄어든다)
    row.append(head);
    if (open) {
        const body = makeEl('div', 'jj-pitem-body');
        const empty = !item.content.trim();
        const key = `p:${item.id}`;   // 번역 보기: 내용 위에 번역본, 아래에 원문
        body.append(translateBox(key), makeEl('p', `jj-pitem-content${empty ? ' is-empty' : ''}`, empty ? '내용이 비어 있어 보내지 않아요. 고치기로 적어 주세요.' : item.content));
        const actions = makeEl('div', 'jj-pitem-actions');
        actions.append(
            promptButton('up', 'jj-pbtn jj-pbtn-icon', 'fa-solid fa-arrow-up', '위로 옮기기', { disabled: index === 0 }),
            promptButton('down', 'jj-pbtn jj-pbtn-icon', 'fa-solid fa-arrow-down', '아래로 옮기기', { disabled: index === total - 1 }),
            translateButton(key),
            makeEl('span', 'jj-pspacer'),
            promptButton('edit', 'jj-pbtn', 'fa-solid fa-pen', '', { text: '고치기' }),
            promptButton('delete', 'jj-pbtn is-danger', 'fa-regular fa-trash-can', '', { text: '지우기' }));
        body.append(actions);
        row.append(body);
        paintTranslation(key, body);
    }
    return row;
}

/** 프롬프트 목록을 다시 그린다. 고치는 중인 글은 promptEdit 에 있어 다시 그려도 남는다. focus = 다시 그린 뒤 초점을 줄 칸 (선택자) */
function renderPrompts(focus = null) {
    const box = popup?.querySelector('.jj-prompts');
    if (!box) return;
    if (promptDrag) endPromptDrag(false);   // 1.3.6 끄는 중에 목록이 바뀌면(다른 기기 합치기 등) 끌기는 그만두고 새 목록을 그린다
    const list = settings().promptList;
    if (openPromptId && !list.some(item => item.id === openPromptId)) openPromptId = null;
    if (promptEdit && promptEdit.id !== 'new' && !list.some(item => item.id === promptEdit.id)) promptEdit = null;
    const rows = list.map((item, index) => promptRow(item, index, list.length));
    if (promptEdit?.id === 'new') {
        const row = makeEl('li', 'jj-pitem is-editing is-new');
        row.dataset.id = 'new';
        row.append(promptEditor(null));
        rows.push(row);
    }
    box.querySelector('.jj-pitems').replaceChildren(...rows);
    box.querySelector('.jj-pempty').hidden = rows.length > 0;
    const add = box.querySelector('[data-pact="add"]');
    add.hidden = promptEdit?.id === 'new';
    add.disabled = list.length >= PROMPT_MAX;
    void fillPromptTokens();
    if (promptEdit) scheduleEditTokens(0);
    if (!focus) return;
    const target = box.querySelector(focus);
    target?.focus({ preventScroll: true });
    target?.closest('.jj-pitem')?.scrollIntoView?.({ block: 'nearest' });
}

function savePromptEdit() {
    const edit = promptEdit;
    if (!edit) return;
    const store = settings();
    const title = edit.title.replace(/\s+/g, ' ').trim().slice(0, PROMPT_TITLE_MAX);
    const content = edit.content.trim();
    if (!content) {
        toastr.warning('같이 보낼 글을 적어 주세요.', KIND_LABEL.prompts);
        popup?.querySelector('.jj-pcontent-input')?.focus();
        return;
    }
    const now = Date.now();
    let id = edit.id;
    if (id === 'new') {
        if (store.promptList.length >= PROMPT_MAX) {
            toastr.warning(`프롬프트는 ${PROMPT_MAX}개까지예요. 안 쓰는 것을 지워 주세요.`, KIND_LABEL.prompts);
            return;
        }
        id = newId();
        store.promptList.push({ id, title, content, enabled: false, at: now, updated: now });   // 새 줄은 꺼진 채로 — 스위치로 켠다
        if (trStates.has('p:new')) { trStates.set(`p:${id}`, trStates.get('p:new')); trStates.delete('p:new'); }   // 적는 동안 펼친 번역은 새 줄로
    } else {
        const item = store.promptList.find(entry => entry.id === id);
        if (!item) { promptEdit = null; renderPrompts(); return; }
        Object.assign(item, { title, content, updated: now });
    }
    promptEdit = null;
    openPromptId = id;
    save();
    renderPrompts(`.jj-pitem[data-id="${id}"] [data-pact="expand"]`);
    refreshButton();
}

function cancelPromptEdit() {
    const was = promptEdit?.id;
    promptEdit = null;
    if (was === 'new') trStates.delete('p:new');
    renderPrompts(was && was !== 'new' ? `.jj-pitem[data-id="${was}"] [data-pact="expand"]` : '[data-pact="add"]');
}

async function onPromptsClick(event) {
    const target = event.target.closest('[data-pact]');
    if (!target || !popup?.contains(target) || target.disabled) return;
    const store = settings();
    const list = store.promptList;
    const act = target.dataset.pact;
    if (act === 'add') {
        if (list.length >= PROMPT_MAX) {
            toastr.warning(`프롬프트는 ${PROMPT_MAX}개까지예요. 안 쓰는 것을 지워 주세요.`, KIND_LABEL.prompts);
            return;
        }
        promptEdit = { id: 'new', title: '', content: '' };
        openPromptId = null;
        renderPrompts('.jj-pitem.is-new .jj-ptitle-input');
        return;
    }
    if (act === 'cancel') return cancelPromptEdit();
    if (act === 'save') return savePromptEdit();
    if (act === 'translate' || act === 'translate-redo') return onTranslateAct(act, target.closest('[data-tr]')?.dataset.tr);
    const id = target.closest('.jj-pitem')?.dataset.id;
    const index = list.findIndex(item => item.id === id);
    const item = list[index];
    if (!item) return;
    if (act === 'expand') {
        openPromptId = openPromptId === id ? null : id;   // 한 줄만 펼친다
        renderPrompts(`.jj-pitem[data-id="${id}"] [data-pact="expand"]`);
    } else if (act === 'switch') {
        item.enabled = !item.enabled;
        item.updated = Date.now();
        if (item.enabled && !store.prompts.enabled) store.prompts.enabled = true;   // 쪽 스위치가 꺼져 있으면 줄을 켤 때 같이 켠다 (켰는데 안 가는 일이 없게)
        target.setAttribute('aria-checked', String(item.enabled));
        target.closest('.jj-pitem')?.classList.toggle('is-on', item.enabled);
        save();
        refreshButton();
        void fillPromptTokens();   // 켠 것 합계
    } else if (act === 'up' || act === 'down') {
        const to = index + (act === 'up' ? -1 : 1);
        if (!movePrompt(list, index, to)) return;
        save();
        const edge = to === 0 || to === list.length - 1;   // 끝에 닿아 그 단추가 꺼지면 반대쪽 단추에 초점
        renderPrompts(`.jj-pitem[data-id="${id}"] [data-pact="${edge ? (act === 'up' ? 'down' : 'up') : act}"]`);
        refreshButton();
    } else if (act === 'edit') {
        promptEdit = { id, title: item.title, content: item.content };
        renderPrompts(`.jj-pitem[data-id="${id}"] .jj-pcontent-input`);
    } else if (act === 'delete') {
        const confirmed = await callGenericPopup(`「${escapeHtml(promptTitle(item))}」 프롬프트를 지울까요?`, POPUP_TYPE.CONFIRM);
        if (!confirmed) return;
        const at = list.indexOf(item);
        if (at >= 0) {
            list.splice(at, 1);
            if (!store.promptListGone || typeof store.promptListGone !== 'object' || Array.isArray(store.promptListGone)) store.promptListGone = {};
            store.promptListGone[item.id] = Date.now();   // 기기 간 합치기의 지운 기록 (저장 목록과 같게)
        }
        if (openPromptId === id) openPromptId = null;
        trStates.delete(`p:${id}`);
        save();
        renderPrompts('[data-pact="add"]');
        refreshButton();
    }
}

// ── 1.3.6 꾹 눌러 순서 바꾸기 (사용자 10-23 「꾹 눌러서 순서 바꿀 수 있게」) ──
// 줄 머리(제목 · 토큰 수 · 스위치 자리)를 꾹 누르면(손가락 400ms, 거의 안 움직였을 때) 줄이 살짝 떠올라 집히고, 위아래로 끌면 다른 줄이 비켜 주고,
// 놓으면 그 순서로 promptList 에 저장한다 — 이 목록 순서가 곧 보내는 순서다(injectDirection: 항상 지시 → 켠 프롬프트 목록 순서 → 전개 지시).
// 꾹 누르기 전에 손가락이 움직이면 그냥 스크롤(브라우저가 pointercancel 을 보낸다) · 짧게 누르면 지금처럼 펼치기 · 스위치.
// 마우스는 꾹 누르기 또는 끌기(6px), 키보드는 줄 안 단추에 초점을 두고 Alt+↑/↓. 펼친 줄의 ↑ ↓ 단추도 그대로 둔다.
const HOLD_MS = 400;        // 손가락 꾹 누르기
const HOLD_SLOP = 8;        // 이만큼 움직이면 꾹 누르기가 아니다 (스크롤)
const MOUSE_DRAG = 6;       // 마우스는 이만큼 끌면 바로 집는다
const EDGE_SCROLL = 40;     // 목록 위아래 끝에서 이 안으로 끌면 자동 스크롤

/** 순수: list 의 from 자리 항목을 to 자리로 옮긴다. 옮겼으면 true */
function movePrompt(list, from, to) {
    if (!Array.isArray(list) || !Number.isInteger(from) || !Number.isInteger(to) || from === to) return false;
    if (from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    return true;
}

/** 순수: 끄는 줄(from)이 dy 만큼 움직였을 때 들어갈 자리. slots = 줄마다 { top, height } (위에서부터) — 끄는 줄 가운데가 이웃 줄 가운데를 넘으면 그 자리 */
function dropSlot(slots, from, dy) {
    const me = slots?.[from];
    if (!me) return from;
    const center = me.top + me.height / 2 + dy;
    let to = from;
    for (let i = from + 1; i < slots.length && center > slots[i].top + slots[i].height / 2; i++) to = i;
    if (to === from) for (let i = from - 1; i >= 0 && center < slots[i].top + slots[i].height / 2; i--) to = i;
    return to;
}

let promptPress = null;   // 꾹 누르는 중 { pointerId, type, x, y, row, timer }
let promptDrag = null;    // 끄는 중 { pointerId, type, row, rows, slots, from, to, gap, list, startY, startScroll, y, frame }
let promptClickMute = 0;  // 끌기를 마친 손가락이 떨어질 때 따라오는 click 을 삼킬 때까지(시각)

function onPromptsPointerDown(event) {
    if (promptDrag || promptPress || !popup) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const head = event.target.closest?.('.jj-pitem-head');
    const row = head?.closest('.jj-pitem');
    if (!row || row.classList.contains('is-editing') || !popup.contains(row)) return;
    promptPress = { pointerId: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY, row,
        timer: setTimeout(() => startPromptDrag(), HOLD_MS) };
    window.addEventListener('pointermove', onPromptsPointerMove, true);
    window.addEventListener('pointerup', onPromptsPointerUp, true);
    window.addEventListener('pointercancel', onPromptsPointerCancel, true);
}

function stopPromptPointerWatch() {
    window.removeEventListener('pointermove', onPromptsPointerMove, true);
    window.removeEventListener('pointerup', onPromptsPointerUp, true);
    window.removeEventListener('pointercancel', onPromptsPointerCancel, true);
}

function cancelPromptPress() {
    if (!promptPress) return;
    clearTimeout(promptPress.timer);
    promptPress = null;
    if (!promptDrag) stopPromptPointerWatch();
}

function onPromptsPointerMove(event) {
    if (promptDrag) {
        if (event.pointerId !== promptDrag.pointerId) return;
        promptDrag.y = event.clientY;
        layoutPromptDrag();
        return;
    }
    const press = promptPress;
    if (!press || event.pointerId !== press.pointerId) return;
    const dx = event.clientX - press.x, dy = event.clientY - press.y;
    if (press.type === 'mouse') {
        if (Math.abs(dy) >= MOUSE_DRAG && Math.abs(dy) >= Math.abs(dx)) startPromptDrag(event.clientY);   // 마우스는 끌면 바로 집는다
        else if (Math.hypot(dx, dy) > HOLD_SLOP) cancelPromptPress();
    } else if (Math.hypot(dx, dy) > HOLD_SLOP) {
        cancelPromptPress();   // 꾹 누르기 전에 움직였다 — 스크롤 · 쪽 넘기기는 브라우저 몫
    }
}

function onPromptsPointerUp(event) {
    if (promptDrag && event.pointerId === promptDrag.pointerId) endPromptDrag(true);
    else if (promptPress && event.pointerId === promptPress.pointerId) cancelPromptPress();
}

function onPromptsPointerCancel(event) {
    if (promptDrag && event.pointerId === promptDrag.pointerId) endPromptDrag(false);
    else if (promptPress && event.pointerId === promptPress.pointerId) cancelPromptPress();
}

/** 끌기 시작: 줄 자리들을 재 두고 집은 줄을 띄운다 */
function startPromptDrag(y = null) {
    const press = promptPress;
    if (!press || !popup) return cancelPromptPress();
    clearTimeout(press.timer);
    promptPress = null;
    const list = popup.querySelector('.jj-pitems');
    const rows = list ? [...list.children].filter(row => row.dataset.id && row.dataset.id !== 'new') : [];
    const from = rows.indexOf(press.row);
    if (from < 0 || rows.length < 2 || !press.row.isConnected) { stopPromptPointerWatch(); return; }   // 한 줄뿐이면 옮길 곳이 없다 — 짧게 누른 것처럼 둔다
    const box = list.getBoundingClientRect();
    const slots = rows.map(row => { const rect = row.getBoundingClientRect(); return { top: rect.top - box.top + list.scrollTop, height: rect.height }; });
    const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
    promptDrag = { pointerId: press.pointerId, type: press.type, row: press.row, rows, slots, from, to: from, gap, list,
        startY: press.y, startScroll: list.scrollTop, y: y ?? press.y, frame: 0 };
    list.classList.add('is-sorting');
    press.row.classList.add('is-dragging');
    press.row.setAttribute('aria-grabbed', 'true');
    if (press.type !== 'mouse') { try { navigator.vibrate?.(15); } catch { /* 진동을 못 쓰는 기기 */ } }
    layoutPromptDrag();
    promptDrag.frame = requestAnimationFrame(promptEdgeScroll);
}

/** 집은 줄은 손가락을 따라가고(목록 안에서만), 지나친 줄은 집은 줄 높이만큼 비켜 준다 */
function layoutPromptDrag() {
    const drag = promptDrag;
    if (!drag) return;
    const { slots, from, rows, list } = drag;
    const me = slots[from], first = slots[0], last = slots[slots.length - 1];
    const raw = drag.y - drag.startY + (list.scrollTop - drag.startScroll);
    drag.to = dropSlot(slots, from, raw);   // 자리는 손가락 그대로 (목록 끝 너머로 끌면 첫 · 끝 자리)
    const dy = Math.round(Math.min(last.top + last.height - (me.top + me.height), Math.max(first.top - me.top, raw)));   // 보이는 줄은 목록 안에서만
    const shift = Math.round(me.height + drag.gap);
    rows.forEach((row, index) => {
        let offset = 0;
        if (index === from) offset = dy;
        else if (from < drag.to && index > from && index <= drag.to) offset = -shift;
        else if (drag.to < from && index >= drag.to && index < from) offset = shift;
        row.style.transform = offset ? `translate3d(0, ${offset}px, 0)` : '';
    });
}

/** 목록이 패널보다 길 때 위아래 끝 가까이로 끌면 그쪽으로 스크롤 */
function promptEdgeScroll() {
    const drag = promptDrag;
    if (!drag) return;
    const { list } = drag;
    const box = list.getBoundingClientRect();
    const zone = Math.min(EDGE_SCROLL, box.height / 3);
    let speed = 0;
    if (drag.y < box.top + zone) speed = -Math.ceil(12 * Math.min(1, (box.top + zone - drag.y) / zone));
    else if (drag.y > box.bottom - zone) speed = Math.ceil(12 * Math.min(1, (drag.y - (box.bottom - zone)) / zone));
    if (speed) {
        const before = list.scrollTop;
        list.scrollTop = Math.max(0, Math.min(list.scrollHeight - list.clientHeight, before + speed));
        if (list.scrollTop !== before) layoutPromptDrag();
    }
    drag.frame = requestAnimationFrame(promptEdgeScroll);
}

/** 끌기 끝: commit 이면 그 자리로 저장(보내는 순서도 같이 바뀐다), 아니면 제자리 */
function endPromptDrag(commit) {
    const drag = promptDrag;
    if (!drag) return;
    promptDrag = null;
    cancelAnimationFrame(drag.frame);
    stopPromptPointerWatch();
    promptClickMute = Date.now() + 600;   // 놓을 때 따라오는 click 이 펼치기 · 스위치를 누르지 않게
    const id = drag.row.dataset.id;
    const before = drag.row.getBoundingClientRect().top;
    for (const row of drag.rows) row.style.transform = '';
    drag.row.classList.remove('is-dragging');
    drag.row.removeAttribute('aria-grabbed');
    drag.list.classList.remove('is-sorting');
    if (!commit || drag.to === drag.from) return;
    const list = settings().promptList;
    const from = list.findIndex(item => item.id === id);
    const to = list.findIndex(item => item.id === drag.rows[drag.to]?.dataset.id);
    if (!movePrompt(list, from, to)) return;
    save();
    renderPrompts();
    refreshButton();
    announcePromptMove(list[to], to);
    // 놓은 줄이 손가락 자리에서 새 자리로 미끄러져 들어간다 (움직임 줄이기면 바로)
    const row = popup?.querySelector(`.jj-pitem[data-id="${CSS.escape(id)}"]`);
    if (!row || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const delta = Math.round(before - row.getBoundingClientRect().top);
    if (!delta) return;
    row.style.transition = 'none';
    row.style.transform = `translate3d(0, ${delta}px, 0)`;
    void row.offsetWidth;
    row.style.transition = '';
    row.classList.add('is-settling');
    row.style.transform = '';
    setTimeout(() => row.classList.remove('is-settling'), 200);
}

/** 화면 읽기 프로그램에 옮긴 결과를 알린다 */
function announcePromptMove(item, to) {
    const live = popup?.querySelector('.jj-plive');
    if (live && item) live.textContent = `${to + 1}번째로 옮겼어요: 「${promptTitle(item)}」`;   // 제목 끝 글자에 따라 조사가 달라 조사 없이
}

/** 키보드: 줄 안 단추에 초점이 있을 때 Alt+↑/↓ 로 한 칸씩 */
function onPromptsReorderKey(event) {
    if (!event.altKey || event.ctrlKey || event.metaKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return false;
    if (event.target.matches?.('input, textarea, [contenteditable="true"]')) return false;
    const row = event.target.closest?.('.jj-pitem');
    if (!row || row.classList.contains('is-editing')) return false;
    event.preventDefault();
    const list = settings().promptList;
    const from = list.findIndex(item => item.id === row.dataset.id);
    const to = from + (event.key === 'ArrowUp' ? -1 : 1);
    if (!movePrompt(list, from, to)) return true;
    save();
    const act = event.target.dataset?.pact;
    renderPrompts(`.jj-pitem[data-id="${CSS.escape(row.dataset.id)}"] ${act && !['up', 'down'].includes(act) ? `[data-pact="${act}"]` : '[data-pact="expand"]'}`);
    refreshButton();
    announcePromptMove(list[to], to);
    return true;
}

// ── 1.3.2 토큰 수 (실리태번 프롬프트 관리자처럼): 지금 모델의 토크나이저(getTokenCountAsync)로, 매크로를 바꾼 뒤의 글을 센다 ──
// 프롬프트 쪽을 볼 때 · 고칠 때만 센다 (시작할 때는 세지 않는다). 같은 글은 다시 세지 않게 글 그대로를 열쇠로 기억한다.
// 토크나이저를 못 쓰면 어림값(영문 4글자 ≈ 1, 그 밖 1글자 ≈ 1)에 「≈」를 붙인다.
const TOKEN_CACHE_MAX = 300;
const tokenCache = new Map();   // 매크로를 바꾼 글 → { n, approx }
function roughTokens(text) {
    let ascii = 0, other = 0;
    for (const ch of text) { if (ch.charCodeAt(0) < 128) ascii++; else other++; }
    return Math.ceil(ascii / 4 + other);
}
async function countTokens(raw) {
    const text = substituteMacros(String(raw ?? ''));
    if (!text.trim()) return { n: 0, approx: false };
    const hit = tokenCache.get(text);
    if (hit) return hit;
    let out;
    try {
        const count = getContext().getTokenCountAsync;
        if (typeof count !== 'function') throw new Error('no tokenizer');
        const n = Number(await count(text));
        if (!Number.isFinite(n) || n < 0) throw new Error('bad count');
        out = { n: Math.round(n), approx: false };
    } catch {
        out = { n: roughTokens(text), approx: true };
    }
    tokenCache.set(text, out);
    if (tokenCache.size > TOKEN_CACHE_MAX) tokenCache.delete(tokenCache.keys().next().value);
    return out;
}
const tokenNumber = ({ n, approx }) => `${approx ? '≈' : ''}${n.toLocaleString('ko-KR')}`;
const tokenLabel = value => `${tokenNumber(value)} 토큰`;
/** 매크로 결과가 이름에 따라 달라지므로 열쇠에 지금 이름들을 붙인다 (같으면 다시 세지 않음) */
function tokenKey(content) {
    const context = (() => { try { return getContext(); } catch { return null; } })();
    return `${context?.name1 ?? ''}\u0000${context?.name2 ?? ''}\u0000${content}`;
}

let promptTokenRun = 0;
/** 보이는 줄의 토큰 수 · 켠 것 합계를 채운다 (프롬프트 쪽을 볼 때만) */
async function fillPromptTokens() {
    if (!popup || page !== 'prompts') return;
    const box = popup.querySelector('.jj-prompts');
    if (!box) return;
    const run = ++promptTokenRun;
    const list = settings().promptList;
    let total = 0, approx = false, any = false;
    for (const item of list) {
        const span = box.querySelector(`.jj-pitem[data-id="${item.id}"] .jj-ptok`);
        const key = tokenKey(item.content);
        let value;
        if (span?.dataset.key === key && span.dataset.n) value = { n: Number(span.dataset.n), approx: span.dataset.approx === '1' };
        else {
            value = await countTokens(item.content);
            if (run !== promptTokenRun || !popup) return;   // 그사이 다시 그렸으면 새 차례에 맡긴다
            const now = box.querySelector(`.jj-pitem[data-id="${item.id}"] .jj-ptok`);
            if (now) { now.dataset.key = key; now.dataset.n = String(value.n); now.dataset.approx = value.approx ? '1' : ''; now.textContent = tokenNumber(value); now.title = tokenLabel(value); now.setAttribute('aria-label', tokenLabel(value)); }   // 1.3.3 줄에는 숫자만 (제목 자리를 덜 먹게)
        }
        if (item.enabled && item.content.trim()) { total += value.n; approx ||= value.approx; any = true; }
    }
    const sum = box.querySelector('.jj-ptotal');
    if (sum) { sum.hidden = !any; sum.textContent = any ? `켜진 프롬프트 ${tokenLabel({ n: total, approx })}` : ''; }
}

let editTokenTimer = 0;
/** 고치는 칸의 토큰 수 — 적는 동안은 잠깐 멈췄을 때 센다 */
function scheduleEditTokens(delay = 350) {
    clearTimeout(editTokenTimer);
    editTokenTimer = setTimeout(async () => {
        const span = popup?.querySelector('.jj-pedit .jj-pedit-tok');
        if (!span || !promptEdit) return;
        const content = promptEdit.content;
        const value = await countTokens(content);
        if (promptEdit?.content === content && span.isConnected) span.textContent = content.trim() ? tokenLabel(value) : '';
    }, delay);
}

/** 점을 누르면 그 쪽으로 (제목의 나머지를 누르면 다음 쪽). 점은 작아서 가장 가까운 점을 고른다 */
function onTitleClick(event) {
    const dots = event.target.closest?.('.jj-dots');
    if (dots && popup?.contains(dots)) {
        const centers = [...dots.querySelectorAll('b')].map(dot => { const r = dot.getBoundingClientRect(); return r.left + r.width / 2; });
        let best = 0;
        centers.forEach((x, index) => { if (Math.abs(event.clientX - x) < Math.abs(event.clientX - centers[best])) best = index; });
        if (centers.length && event.detail !== 0) return showPage(KINDS[best]);   // 키보드(Enter/Space, detail 0)는 다음 쪽
    }
    showPage(KINDS[(KINDS.indexOf(page) + 1) % KINDS.length]);
}

function onPromptsInput(event) {
    const field = event.target?.dataset?.field;
    if (promptEdit && (field === 'title' || field === 'content')) promptEdit[field] = event.target.value;
    if (field === 'content') scheduleEditTokens();
    if (field === 'content' && promptEdit) paintTranslation(`p:${promptEdit.id}`);   // 번역한 글과 달라지면 「원문이 바뀌었어요」
}

function onPromptsKeydown(event) {
    if (onPromptsReorderKey(event)) return;   // 1.3.6 Alt+↑/↓
    if (event.key === 'Enter' && !event.isComposing && event.target.matches?.('.jj-ptitle-input')) {
        event.preventDefault();
        event.target.closest('.jj-pedit')?.querySelector('.jj-pcontent-input')?.focus();
    }
}

async function onListClick(event) {
    const target = event.target.closest('[data-act]');
    if (!target || !popup?.contains(target)) return;
    const store = settings();
    const act = target.dataset.act;
    if (act === 'save-preset') {
        const result = savePreset(page, store[page].content);
        if (result === 'full') toastr.warning(`저장은 ${PRESET_MAX}개까지예요. 안 쓰는 것을 지워 주세요.`, KIND_LABEL[page]);
        renderList();
        return;
    }
    const view = listView;
    const entry = view ? listEntries(view)[Number(target.dataset.index)] : null;
    if (!entry) return;
    if (act === 'use') {
        const slot = store[page];
        // 덮어쓰기 전에 적어 둔 글이 저장에도 최근에도 없으면 최근에 남긴다 (실수로 눌러도 되찾게)
        if (slot.content.trim() && slot.content.trim() !== entry.content && !isSaved(page, slot.content)) remember(page, slot.content);
        slot.content = entry.content;
        const textarea = pageTextarea(page);
        if (textarea) textarea.value = entry.content;
        save();
        setListView(null);
        refreshButton();
    } else if (act === 'keep') {
        const result = savePreset(page, entry.content);
        if (result === 'full') toastr.warning(`저장은 ${PRESET_MAX}개까지예요. 안 쓰는 것을 지워 주세요.`, KIND_LABEL[page]);
        renderList();
    } else if (act === 'remove') {
        if (view === 'presets') {
            const confirmed = await callGenericPopup('저장한 지시를 지울까요?', POPUP_TYPE.CONFIRM);
            if (!confirmed) return;
            const index = store.presets.indexOf(entry);
            if (index >= 0) { store.presets.splice(index, 1); if (!store.presetsGone || typeof store.presetsGone !== 'object' || Array.isArray(store.presetsGone)) store.presetsGone = {}; store.presetsGone[entry.id] = Date.now(); }   // 7.0.2 지운 기록 (기기 간 합치기 — 오래된 것은 합칠 때 걷는다)
        } else {
            const list = store.history[page];
            const index = list.indexOf(entry);
            if (index >= 0) list.splice(index, 1);
        }
        save();
        renderList();
    }
}

function onOutsidePointer(event) {
    // 지우기 확인 창(실리태번 dialog)을 누를 때는 닫지 않는다.
    if (event.target.closest?.('#jj-popup, #jj-button, dialog')) return;
    closePopup();
}

function onPopupKeydown(event) {
    if (event.key !== 'Escape' || !popup || event.target.closest?.('dialog')) return; // 확인 창의 Esc 는 그 창 몫
    event.preventDefault();
    event.stopPropagation();
    if (promptDrag) endPromptDrag(false);   // 1.3.6 끄는 중이면 제자리로만
    else if (listView) setListView(null);
    else if (promptEdit && event.target.closest?.('.jj-pedit')) cancelPromptEdit();   // 1.3.0 고치는 중이면 고치기만 그만둔다
    else closePopup();
}

function openPopup() {
    const store = settings();
    const host = document.getElementById('send_form') ?? button.parentElement;
    listView = null;
    popup = document.createElement('div');
    popup.id = 'jj-popup';
    popup.innerHTML = `
        <div class="jj-popup-head">
            <button type="button" class="jj-switch" role="switch"><span></span></button>
            <button type="button" class="jj-popup-title" aria-label="전개 지시 · 항상 지시 · 프롬프트 바꾸기"><i class="fa-solid fa-feather-pointed"></i><span class="jj-title-text"></span><span class="jj-state"></span><span class="jj-dots" aria-hidden="true">${KINDS.map(() => '<b></b>').join('')}</span></button>
            <button type="button" class="jj-icon-btn" data-act="list" aria-label="저장 · 최근 지시" aria-expanded="false"><i class="fa-regular fa-bookmark"></i></button>
            <button type="button" class="jj-icon-btn" data-act="clear" aria-label="내용 지우기"><i class="fa-solid fa-eraser"></i></button>
            <button type="button" class="jj-icon-btn jj-send" data-act="send" aria-label="보내기"><i class="fa-solid fa-paper-plane"></i></button>
            <button type="button" class="jj-icon-btn" data-act="close" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="jj-popup-body">
            <div class="jj-pages">${KINDS.map(kind => kind === 'prompts' ? `
                <section class="jj-page jj-page-prompts" data-kind="prompts" aria-label="${KIND_LABEL.prompts}">
                    <div class="jj-prompts">
                        <ul class="jj-pitems" aria-label="프롬프트 목록"></ul>
                        <p class="jj-pempty" hidden><b>자주 쓰는 프롬프트를 모아 두는 곳이에요.</b><span>줄마다 켜고 끄고, 켠 것은 지시와 같이 보내요. 예: 문체 다듬기 · 짧게 답하기</span></p>
                        <p class="jj-ptotal" hidden></p>
                        <button type="button" class="jj-padd" data-pact="add"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>프롬프트 추가</span></button>
                        <p class="jj-plive" aria-live="polite"></p>
                    </div>
                </section>` : `
                <section class="jj-page" data-kind="${kind}" aria-label="${KIND_LABEL[kind]}"><textarea class="jj-textarea" rows="3" spellcheck="false" placeholder="${PLACEHOLDER[kind]}"></textarea></section>`).join('')}
            </div>
            <div class="jj-list" hidden>
                <div class="jj-seg" role="tablist"><button type="button" role="tab" data-list="presets">저장</button><button type="button" role="tab" data-list="history">최근</button></div>
                <button type="button" class="jj-save-preset" data-act="save-preset"><i class="fa-solid fa-plus"></i><span>지금 내용 저장</span></button>
                <ul class="jj-items"></ul>
                <p class="jj-empty" hidden></p>
            </div>
        </div>
        <div class="jj-popup-foot"><i class="fa-solid fa-circle-info"></i><span class="jj-foot-text"></span></div>`;
    for (const kind of TEXT_KINDS) {
        const textarea = pageTextarea(kind);
        textarea.value = store[kind].content;
        textarea.addEventListener('input', () => {
            store[kind].content = textarea.value;
            save();
            refreshButton();
        });
    }

    popup.querySelector('.jj-switch').addEventListener('click', () => {
        store[page].enabled = !store[page].enabled;
        save();
        refreshButton();
    });
    popup.querySelector('.jj-popup-title').addEventListener('click', onTitleClick); // 1.3.2 점을 누르면 그 쪽, 나머지는 다음 쪽 (끝이면 처음). 목록을 보는 중이면 그 쪽 목록으로
    const promptsBox = popup.querySelector('.jj-prompts');
    promptsResize?.disconnect();
    promptsResize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => syncPagesHeight()) : null;   // 펼치기 · 고치기 · 글이 늘 때
    promptsResize?.observe(promptsBox);
    promptsBox.addEventListener('click', onPromptsClick);
    promptsBox.addEventListener('input', onPromptsInput);
    promptsBox.addEventListener('keydown', onPromptsKeydown);
    // 1.3.6 꾹 눌러 순서 바꾸기: 누르기 · 끌기는 pointer, 끄는 동안 목록 스크롤 · 쪽 넘기기를 막는 것은 touchmove(passive 아님 — 목록 위에서만),
    //       길게 누를 때 폰 메뉴 · 놓을 때 따라오는 click 은 삼킨다
    promptsBox.addEventListener('pointerdown', onPromptsPointerDown);
    promptsBox.querySelector('.jj-pitems').addEventListener('touchmove', event => { if (promptDrag && event.cancelable) event.preventDefault(); }, { passive: false });
    promptsBox.addEventListener('contextmenu', event => { if ((promptPress && promptPress.type !== 'mouse') || promptDrag) event.preventDefault(); });
    promptsBox.addEventListener('click', event => {
        if (Date.now() > promptClickMute) return;
        promptClickMute = 0;
        event.preventDefault();
        event.stopPropagation();
    }, true);
    const pages = popup.querySelector('.jj-pages');
    pages.addEventListener('scroll', onPagesScroll, { passive: true });
    pages.addEventListener('pointerdown', () => { pageTarget = null; }, { passive: true }); // 손으로 넘기기 시작하면 코드 목표는 버린다
    popup.querySelector('[data-act="list"]').addEventListener('click', () => setListView(listView ? null : 'presets'));
    popup.querySelectorAll('.jj-seg [data-list]').forEach(tab => tab.addEventListener('click', () => setListView(tab.dataset.list)));
    popup.querySelector('.jj-list').addEventListener('click', onListClick);
    popup.querySelector('[data-act="close"]').addEventListener('click', closePopup);
    popup.querySelector('[data-act="send"]').addEventListener('click', () => sendNow());   // 1.2.3 ▶ 창을 닫고 실리태번 보내기와 같은 길로
    popup.querySelector('[data-act="clear"]').addEventListener('click', async () => {
        const kind = page;
        if (!TEXT_KINDS.includes(kind)) return;
        const slot = store[kind];
        if (!slot.content) return;
        const confirmed = await callGenericPopup(`${KIND_LABEL[kind]} 내용을 모두 지울까요?`, POPUP_TYPE.CONFIRM);
        if (!confirmed) return;
        remember(kind, slot.content); // 지운 글은 최근에서 되찾을 수 있다
        slot.content = '';
        const textarea = pageTextarea(kind);
        if (textarea) textarea.value = '';
        save();
        refreshButton();
    });

    // 실리태번은 #sheld 안에서 옆으로 미는 손짓을 메시지 스와이프(다른 답 보기 · 새 답 만들기)로 받는다 (lib/swiped-events.js).
    // 쪽을 넘기려고 민 것이 거기까지 가지 않게: 그 라이브러리의 문턱값을 이 창에서만 아주 크게 + 터치 이벤트를 창에서 멈춘다
    popup.dataset.swipeThreshold = '100000';
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) popup.addEventListener(type, event => event.stopPropagation(), { passive: true });
    host.append(popup);
    // 1.1.5: 테마 없이(확장만 · 실리태번 '빠른 UI')는 입력판이 위치 기준이 아니라서 창이 화면 위쪽 밖에 떴다 — 열려 있는 동안만 기준으로 삼는다
    if (getComputedStyle(host).position === 'static') host.classList.add('jj-popup-host');
    applyOnColor();
    renderPrompts();
    showPage(page, { smooth: false });
    button.classList.add('has-popup');
    void popup.offsetWidth; // 애니메이션 시작점을 확정한다
    popup.classList.add('is-open');
    document.addEventListener('pointerdown', onOutsidePointer, true);
    document.addEventListener('keydown', onPopupKeydown, true);
    watchSendButton();
}

function closePopup() {
    if (!popup) return;
    endPromptDrag(false);   // 1.3.6
    cancelPromptPress();
    const closing = popup;
    popup = null;
    listView = null;
    pageTarget = null;
    closing.classList.remove('is-open');
    setTimeout(() => { closing.remove(); if (!popup) document.querySelector('.jj-popup-host')?.classList.remove('jj-popup-host'); }, 180);
    button?.classList.remove('has-popup');
    document.removeEventListener('pointerdown', onOutsidePointer, true);
    document.removeEventListener('keydown', onPopupKeydown, true);
    sendWatch?.disconnect();
    sendWatch = null;
    promptsResize?.disconnect();
    promptsResize = null;
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

/** 1.3.0 상태 카드의 프롬프트 줄: 켠 것들의 제목 */
function promptsStatusText() {
    const store = settings();
    if (!store.promptList.length) return '깃털 창을 두 번 넘기면 자주 쓰는 프롬프트를 모아 둘 수 있어요';
    const on = enabledPrompts();
    if (!on.length) return `${store.promptList.length}개 모아 둠 · 깃털 창에서 줄마다 켜요`;
    return preview(on.map(promptTitle).join(' · '), 70);
}

/** 설정 맨 위 상태 카드 (전개 지시 · 항상 지시). 입력창에서 켜고 끄거나 내용을 고칠 때도 같이 바뀐다. */
function refreshSettingsStatus() {
    if (!settingsRoot) return;
    const store = settings();
    for (const kind of KINDS) {
        const card = settingsRoot.querySelector(`.jj-status[data-kind="${kind}"]`);
        if (!card) continue;
        const on = kindActive(kind);
        card.classList.toggle('is-on', on);
        card.querySelector('.jj-status-title').textContent = kind === 'direction' && !store.extensionEnabled
            ? '입력창 버튼이 꺼져 있어요'
            : `${KIND_LABEL[kind]} ${stateText(kind)}`;
        card.querySelector('.jj-status-text').textContent = !store.extensionEnabled
            ? (kind === 'direction' ? '아래 ‘입력창 버튼’을 켜면 쓸 수 있어요' : '입력창 버튼이 꺼져 있으면 보내지 않아요')
            : kind === 'prompts' ? promptsStatusText()
            : hasContent(kind) ? preview(store[kind].content, 70)
                : kind === 'always' ? '깃털 창을 옆으로 넘기거나 제목을 눌러 적어요'
                    : on ? '비어 있어요 · AI가 알아서 전개해요' : '입력창의 깃털 버튼으로 지시를 적어요';
        const toggle = card.querySelector('.jj-switch');
        toggle.setAttribute('aria-checked', String(store[kind].enabled));
        toggle.disabled = !store.extensionEnabled;
    }
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
                <div class="jj-status" data-kind="direction">
                    <span class="jj-status-dot" aria-hidden="true"></span>
                    <div class="jj-status-main">
                        <strong class="jj-status-title"></strong>
                        <span class="jj-status-text"></span>
                    </div>
                    <button type="button" class="jj-switch" id="jj_direction_switch" role="switch" aria-label="전개 지시 켜기/끄기"><span></span></button>
                </div>
                <div class="jj-status" data-kind="always">
                    <span class="jj-status-dot" aria-hidden="true"></span>
                    <div class="jj-status-main">
                        <strong class="jj-status-title"></strong>
                        <span class="jj-status-text"></span>
                    </div>
                    <button type="button" class="jj-switch" id="jj_always_switch" role="switch" aria-label="항상 지시 켜기/끄기"><span></span></button>
                </div>
                <div class="jj-status" data-kind="prompts">
                    <span class="jj-status-dot" aria-hidden="true"></span>
                    <div class="jj-status-main">
                        <strong class="jj-status-title"></strong>
                        <span class="jj-status-text"></span>
                    </div>
                    <button type="button" class="jj-switch" id="jj_prompts_switch" role="switch" aria-label="프롬프트 켜기/끄기"><span></span></button>
                </div>

                <div class="jj-card">
                    <div class="jj-card-title"><i class="fa-solid fa-sliders" aria-hidden="true"></i><span>설정</span></div><!-- ui-density-620c -->
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
                        <div class="jj-tr" data-tr="s:prompt" hidden>${trBoxInner('menu_button jj-small-btn')}</div>
                        <textarea id="jj_prompt" class="text_pole" rows="7" placeholder="전개 지시 프롬프트"></textarea>
                        <div class="jj-prompt-actions">
                            <button type="button" class="jj-tr-btn" data-pact="translate" data-tr="s:prompt" aria-label="번역 보기" title="번역 보기" aria-expanded="false"><i class="${TR_ICON}" aria-hidden="true"></i></button>
                            <button type="button" id="jj_reset" class="menu_button jj-small-btn"><i class="fa-solid fa-rotate-left"></i><span>기본값으로</span></button>
                        </div>
                    </div>
                </details>
              </div>
            </div>
        </div>`;
    container.append(wrapper);
    settingsRoot = wrapper;
    wrapper.querySelector(".jj-version").onclick = event => {if (!badgeTextHit(event)) return; event.preventDefault();event.stopPropagation();showHelp();};

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

    for (const kind of KINDS) {
        wrapper.querySelector(`.jj-status[data-kind="${kind}"] .jj-switch`).addEventListener('click', () => {
            store[kind].enabled = !store[kind].enabled;
            save();
            refreshButton();
        });
    }
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
        paintTranslation('s:prompt');
    });
    // 번역 보기: 프롬프트 칸 위에 번역본 (단추 · 「다시 번역」)
    wrapper.querySelector('.jj-prompt-body').addEventListener('click', event => {
        const target = event.target.closest?.('[data-pact^="translate"]');
        if (target) onTranslateAct(target.dataset.pact, 's:prompt');
    });
    wrapper.querySelector('#jj_reset').addEventListener('click', async () => {
        const confirmed = await callGenericPopup('전개 지시 프롬프트를 기본값으로 되돌릴까요?', POPUP_TYPE.CONFIRM);
        if (!confirmed) return;
        store.directionPrompt = DEFAULT_PROMPT;
        prompt.value = DEFAULT_PROMPT;
        showPromptState();
        save();
        paintTranslation('s:prompt');
    });

    fill();
}

// ── 시작 ────────────────────────────────────────────────────

initSettings();

export const ready = new Promise((resolve, reject) => jQuery(() => {
    try {
    afterBoot(applyOnColor);   // 7.7.4 덮개가 걷힐 때(첫 화면 전) 한 번 — 시작 중 계산 스타일 읽기로 문서 전체를 다시 계산하지 않게
    registerDirectionMacro();
    buildSettings();
    ensureButton();
    eventSource.on(event_types.GENERATION_STARTED, trackGeneration);
    for (const name of ['GENERATION_ENDED', 'GENERATION_STOPPED']) if (event_types[name]) eventSource.on(event_types[name], () => { generationType = null; });
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, injectDirection);
    // 테마를 바꾸면 테마 색을 쓰는 경우의 글자색(켜짐 배지)도 다시 계산한다.
    // 5.1.3: 저장마다 계산 스타일을 읽지 않고 값싼 서명이 바뀔 때만
    // 경량화(10-15): 부팅 중 저장(확장들이 수십 번)도 아래 감시처럼 앱 준비 뒤 한 번으로 — 시트 · <html style> 이 늘 바뀌어 서명이 매번 달라져 계산 스타일을 강제로 읽었다 (폰 리그 4배 부팅 수 초)
    eventSource.on(event_types.SETTINGS_UPDATED, () => { if (!bootQuiet) syncOnColor(); });
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

    verifyAddonCss({ folder: 'direction', name: '--jj-css-version', version: VERSION, title: '전개 지시' });
    // 7.0.2 저장한 지시 목록 기기 간 합치기 — 지시는 고치지 않고 더하거나 지우기만 해서 저장 시각(at)이 곧 고친 시각
    import('../list-sync.js').then(({ registerAddonMerge }) => registerAddonMerge('direction', { module: MODULE, store: () => extension_settings[MODULE], lists: [{ field: 'presets', gone: 'presetsGone', stamp: item => item?.updated || item?.at }, { field: 'promptList', gone: 'promptListGone', stamp: item => item?.updated || item?.at }], save: saveSettingsDebounced, onChange: () => { if (listView) renderList(); if (popup) renderPrompts(); refreshButton(); } }))
        .catch(error => console.warn('[전개 지시] 기기 간 합치기', error));

    resolve();
    } catch(error) { reject(error); }
}));

export function showHelp() {
    return callGenericPopup('<h3>전개 지시 사용방법</h3><p>깃털 버튼을 길게 누르면 전개 지시를 켜고 끌 수 있어요. 창 안의 종이비행기 단추를 누르면 창을 닫고 바로 보내요. </p><p>입력창 옆 깃털 버튼을 눌러 다음 장면이나 이야기의 방향을 적어요. 켜짐 스위치를 켜면 이후 대화 요청마다 지시가 들어가요.</p><p>깃털 창을 옆으로 넘기거나 제목을 누르면 <b>항상 지시</b> 쪽이에요. 여기 적은 글은 틀 없이 그대로 매번 들어가요 (예: &lt;OOC: 캐릭터 에셋 이미지를 2장 이상 출력하시오.&gt;).</p><p>한 번 더 넘기면 <b>프롬프트</b> 쪽이에요. 문체 다듬기처럼 가끔 쓰는 프롬프트를 제목 한 줄씩 모아 두고, 줄을 누르면 내용이 펼쳐져요. 줄 오른쪽 스위치로 켠 것만 항상 지시 다음, 전개 지시 앞에 같이 들어가요. {{char}} · {{user}} 도 이름으로 바뀌어요. 펼친 줄에서 고치기 · 지우기 · 순서 옮기기를 해요. 줄을 꾹 누른 채 위아래로 끌어도 순서가 바뀌어요(마우스는 끌기, 키보드는 Alt+↑/↓). 위에 있는 것부터 차례로 들어가요. 줄 옆 숫자는 지금 모델 기준 토큰 수예요. 제목 옆 점을 누르면 그 쪽으로 바로 가요.</p><p>깃털 모양으로 지금 보내는 것을 알 수 있어요. 아무것도 안 보내면 회색, 전개 지시 · 항상 지시 · 켠 프롬프트 중 하나면 켜짐 색 테두리, 둘이면 안까지 채움, 셋 다면 채움에 은은한 빛이에요. 전개 지시를 꺼 둬도 다른 것을 보내는 중이면 켜진 모양으로 남아요.</p><p>책갈피 단추의 <b>저장</b>에는 자주 쓰는 지시를 모아 두고, <b>최근</b>에는 실제로 보낸 지시가 쌓여요. 누르면 입력칸에 불러와요.</p><p>한 번만 보내는 기능이 아니에요. 원하는 장면이 끝나면 끄거나 내용을 고쳐 주세요. 꺼도 적어 둔 내용은 남아요.</p><p>삽입 위치 0은 프롬프트 맨 끝, 1은 마지막 메시지 앞이에요. 세 쪽 모두 같은 자리에 들어가요. 프롬프트의 {{direction}} 자리에 전개 지시가 들어가요. 이 도구는 별도 모델을 호출하지 않고 현재 대화 요청에 지시를 추가해요.</p><p>입력창 버튼을 끄면 버튼과 지시 삽입이 함께 꺼져요. 기존 단독 전개 지시 확장과 동시에 켜지 마세요.</p>', POPUP_TYPE.TEXT, '', {okButton:'닫기'});
}
let settingsDialog = null;
export async function openPanel() {
    await ready;
    if (!settingsRoot || settingsDialog?.open) return;
    refreshSettingsStatus();   // 1.3.0 다른 기기에서 합쳐진 목록 등 — 창을 열 때 상태 카드를 지금 값으로
    const previous = document.activeElement, anchor = document.createComment('direction settings');
    settingsRoot.before(anchor);
    const body = settingsRoot.querySelector('.inline-drawer-content'), display = body.style.display;
    body.style.display = 'block';
    settingsDialog = document.createElement('dialog');
    settingsDialog.className = 'bl-direction-dialog'; settingsDialog.setAttribute('aria-label','전개 지시');
    settingsDialog.innerHTML = `<header><b><i class="fa-solid fa-feather-pointed" aria-hidden="true"></i> 전개 지시 <span class="ext-version">v${VERSION}</span></b><button type="button" aria-label="전개 지시 닫기">×</button></header><div class="bl-direction-body"></div>`;
    document.body.append(settingsDialog);settingsDialog.querySelector('.bl-direction-body').append(settingsRoot);
    settingsDialog.querySelector('header button').onclick = () => settingsDialog.close();
    settingsDialog.addEventListener('close', () => {body.style.display=display;anchor.replaceWith(settingsRoot);settingsDialog.remove();settingsDialog=null;if(previous?.isConnected)previous.focus();},{once:true});
    showThemeModal(settingsDialog);
}
export function mountInline(host) {
    const button=document.createElement('button');button.type='button';button.className='salty-btn';button.textContent='전개 지시 설정 열기';button.onclick=openPanel;host.replaceChildren(button);return()=>host.replaceChildren();
}
