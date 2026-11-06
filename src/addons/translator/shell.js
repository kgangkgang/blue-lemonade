// LLM 번역 껍데기 (1.0.0 극한 최적화) — 부팅 3층에서는 이것만 받아요: 메시지 번역 단추(같은 DOM · 보이기) · ✦ 메뉴 두 줄(buttons.html) · 스타일 · 용어집 이름 다리 ·
//   전역 다리 자리 · 슬래시 명령 이름. 본체(index.js ≈ 1.2MB: 설정 화면 · 번역 · 용어집 · 점검 · 리모컨)는 처음 쓸 때(어디든 처음 누름 = 문 press · 단추 · 보냄 · 답 그려짐 ·
//   스와이프 · 고침 · 이름 바꿈 · 명령 · 바깥 API · 설정 창)만 받고, 받는 동안 들어온 실리태번 사건은 쌓아 두었다가 본체의 제 리스너에만 넘겨요(replayEvent).
//   부팅 때 본체가 꼭 있어야 하는 조건(번역 리모컨 켬 · 실리태번 기본 번역 확장이 같이 켜져 알림 · TTS 화자 색이 분석을 봐야 함)이면 그때는 바로 본체를 받아요.
//   알려진 차이: 저장된 번역문의 옛 결함 수선(repairShownTranslations) · 겹친 용어집 항목 합치기 알림 · 자동 건너뛰기의 「이미 한국어」 판단은 처음 쓸 때 해요.
import { bootSheetOf } from '../../addon-style-bundle.js';
import { eventSource, event_types, chat } from '../../../../../../../script.js';
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { SlashCommandParser } from '../../../../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../../../../slash-commands/SlashCommand.js';
import { withReplay, onGate } from '../../boot-layers.js';
import { glossaryScopeKeyOf, glossaryScopeKeysOf, pickGlossaryEntries } from './glossary-prompt.js';
import { chatGlossaryEntries } from './chat-glossary.js';
import { publishNames } from './names-bridge.js';
import { syncTranslatorMenus } from './menu-visibility.js';
import { builtinTranslateState, builtinTranslateNotice } from './builtin-translate.js';

const SHELL = Symbol.for('blue-lemonade.translator.shell');
const API = Symbol.for('blue-lemonade.translator');
const ARCHIVE = Symbol.for('st.llm-translator.archive.v1');
const TTS_SHELL = Symbol.for('blue-lemonade.tts.shell');
const extensionName = 'llm-translator-custom';
const folder = new URL('./', import.meta.url).href.replace(/\/$/, '');
// 본체(index.js)와 같은 판단 — 단독 LLM 번역 확장이 먼저 돌면 둘 다 쉬어요
export const duplicate = Boolean(globalThis[ARCHIVE] || globalThis.__blLlmTranslatorLoaded);
let extensionSettings = extension_settings[extensionName];
if (!extensionSettings) { extensionSettings = {}; extension_settings[extensionName] = extensionSettings; }

// ── index.js 와 같은 글(tools/tests/translator-shell.mjs 가 같은지 봐요) ──
const TRANSLATE_BUTTONS = [
    ['mes_legacy_translate fa-solid fa-brain', 'LLM 번역 (기존)', 'hide_legacy_translate_button'],
    ['mes_llm_translate fa-solid fa-right-left', 'LLM 번역/전환', 'hide_new_translate_button'],
    ['mes_toggle_original fa-solid fa-magnifying-glass', '원문/번역 전환', 'hide_toggle_button'],
    ['mes_edit_translation fa-solid fa-pen-to-square', '번역문 수정', 'hide_edit_button'],
    ['mes_paragraph_correction fa-solid fa-wrench', '문단 수 교정', 'hide_paragraph_button'],
    ['mes_delete_translation fa-solid fa-trash', '번역문 삭제', 'hide_delete_button'],
];
let translateButtonsTemplate = null, translateButtonsKey = '';
function translateButtonsFragment() {
    const key = TRANSLATE_BUTTONS.map(([, , hide]) => (extensionSettings[hide] ? '1' : '0')).join('');
    if (!translateButtonsTemplate || key !== translateButtonsKey) {
        const fragment = document.createDocumentFragment();
        for (const [classes, title, hide] of TRANSLATE_BUTTONS) {
            const button = document.createElement('div');
            button.className = `mes_button ${classes} interactable`;
            button.setAttribute('title', title);
            button.setAttribute('data-i18n', `[title]${title}`);
            button.setAttribute('tabindex', '0');
            if (extensionSettings[hide]) button.setAttribute('style', 'display: none;');   // jQuery .hide() 가 남기던 것과 같은 속성 글
            fragment.append(button);
        }
        translateButtonsTemplate = fragment; translateButtonsKey = key;
    }
    return translateButtonsTemplate.cloneNode(true);
}
const createTranslateButtons = (mesBlock) => {
    const mes = mesBlock?.jquery ? mesBlock[0] : mesBlock;
    if (!mes?.querySelector || mes.querySelector('.mes_llm_translate')) return false;
    const messageId = mes.getAttribute('mesid');
    const extraMesButtons = mes.querySelector('.extraMesButtons');
    if (extraMesButtons) extraMesButtons.prepend(translateButtonsFragment());
    return !!extraMesButtons;
};
function addButtonsToExistingMessages() {
    for (const mes of document.querySelectorAll('#chat .mes')) createTranslateButtons(mes);
}
function updateButtonVisibility(root = document) {
    const pairs = [
        ['.mes_legacy_translate', extensionSettings.hide_legacy_translate_button],
        ['.mes_llm_translate', extensionSettings.hide_new_translate_button],
        ['.mes_toggle_original', extensionSettings.hide_toggle_button],
        ['.mes_paragraph_correction', extensionSettings.hide_paragraph_button],
        ['.mes_edit_translation', extensionSettings.hide_edit_button],
        ['.mes_delete_translation', extensionSettings.hide_delete_button],
    ];
    const scope = root instanceof Element || root instanceof Document ? root : document;
    for (const [selector, hide] of pairs) {
        const want = hide ? 'none' : '';
        for (const button of scope.querySelectorAll(selector)) if (button.style.display !== want) button.style.display = want;
    }
}
function glossaryScopeKey() {
    return glossaryScopeKeyOf(getContext());
}
function glossaryEntries() {
    if (!Array.isArray(extensionSettings.glossary_entries)) extensionSettings.glossary_entries = [];
    return extensionSettings.glossary_entries;
}
function publishGlossaryNames() {
    publishNames(extensionSettings.glossary_enabled === false ? [] : activeGlossaryEntries());
}
function glossaryScopeKeys() {
    return glossaryScopeKeysOf(getContext());
}
function activeGlossaryEntries(scopes = glossaryScopeKeys()) {
    return pickGlossaryEntries(glossaryEntries(), scopes, arguments.length === 0 ? chatGlossaryEntries(getContext().chatMetadata) : []);
}
// ── 같은 글 끝 ──

let body = null, bodyPromise = null, started = false, observer = null;
const queued = [];
const QUEUE = ['MESSAGE_SENT', 'USER_MESSAGE_RENDERED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED', 'CHARACTER_RENAMED'];
const shellListeners = [];
const COMMANDS = ['LlmTranslateLast', 'LlmRetranslateCorrection', 'LlmRetranslateGuidance', 'LlmRetranslateParagraph', 'LlmTranslateID', 'llmDBUploadBackup', 'llmDBDownloadRestore',
    'llmDBmetaClearBackup', 'llmGetTranslation', 'llmDBDeleteTranslation', 'llmTranslate', 'llmTranslateInput', 'llmGetTranslations', 'LlmToggleTranslation'];
const pendingProtect = new Map();

export const bodyLoaded = () => !!body;
/** 본체를 받아요(한 번) — 늦게 붙은 리스너에 지금 채팅을 알리고(withReplay), 받는 동안 쌓인 사건을 본체의 제 리스너에만 넘겨요 */
export function ensureBody(reason = '?') {
    if (bodyPromise) return bodyPromise;
    if (globalThis[SHELL]) globalThis[SHELL].bodyReason = reason;   // 진단: 왜 받았나
    bodyPromise = withReplay(`LLM 번역 본체(${reason})`, async () => {
        for (const name of COMMANDS) { try { if (SlashCommandParser.commands?.[name]?.blShell) delete SlashCommandParser.commands[name]; } catch { /* 흉내 */ } }
        if (globalThis[ARCHIVE]?.blShell) delete globalThis[ARCHIVE];   // 본체는 이 자리가 있으면 「단독 확장이 먼저」로 보고 쉬어요
        const m = await import('./index.js');
        await m.ready;
        return m;
    }).then(async m => {
        body = m;
        observer?.disconnect(); observer = null;   // 단추는 본체의 감시자가
        for (const [type, fn] of shellListeners.splice(0)) { try { eventSource.removeListener(type, fn); } catch { /* 흉내 */ } }
        for (const [id, args] of [...pendingProtect]) { try { globalThis[API]?.protect?.(id, ...args); } catch { /* 본체가 알림 */ } }
        pendingProtect.clear();
        for (const [type, args] of queued.splice(0)) { try { await m.replayEvent(type, args); } catch (error) { console.warn('[LLM Translator] 쌓아 둔 사건 넘기기', error); } }
        return m;
    }).catch(error => { bodyPromise = null; throw error; });
    bodyPromise.catch(error => console.error('[LLM Translator] 본체를 불러오지 못했어요', error));
    return bodyPromise;
}
const withBody = (reason, fn) => ensureBody(reason).then(fn).catch(() => {});

// ── 메시지 단추 누름: 본체를 받은 뒤 같은 일을 (index.js clickButton)
const BUTTON_KINDS = [['mes_legacy_translate', 'legacy'], ['mes_llm_translate', 'translate'], ['mes_toggle_original', 'toggle'], ['mes_edit_translation', 'edit'], ['mes_paragraph_correction', 'paragraph'], ['mes_delete_translation', 'delete']];
function onButton(e) {
    if (body) return;
    const el = e.target?.closest?.('.mes .mes_legacy_translate, .mes .mes_llm_translate, .mes .mes_toggle_original, .mes .mes_edit_translation, .mes .mes_paragraph_correction, .mes .mes_delete_translation');
    if (!el) return;
    const kind = BUTTON_KINDS.find(([cls]) => el.classList.contains(cls))?.[1];
    const messageId = el.closest('.mes')?.getAttribute('mesid');
    if (!kind || messageId == null) return;
    withBody('단추', m => m.clickButton(kind, messageId));
}

// ── 전역 다리 자리 (본체가 오면 같은 이름의 진짜 객체로 바뀌어요)
function installApi() {
    const real = () => { const api = globalThis[API]; return api && !api.blShell ? api : null; };
    const later = (name, fallback) => (...args) => ensureBody(`API ${name}`).then(() => { const api = real(); return api ? api[name](...args) : fallback; });
    const soon = (name, value) => (...args) => { const api = real(); if (api) return api[name](...args); ensureBody(`API ${name}`); return typeof value === 'function' ? value(...args) : value; };
    globalThis[API] = {
        blShell: true,
        processTranslationText: soon('processTranslationText', (_o, t) => t), readCachedTranslation: later('readCachedTranslation', null),
        storeTranslationQuietly: later('storeTranslationQuietly'), deleteCachedTranslation: later('deleteCachedTranslation'),
        dropStrayWords: soon('dropStrayWords', text => text),
        translateForSpeech: later('translateForSpeech', null), speechReady: soon('speechReady', () => ({ ok: false, why: 'LLM 번역을 받는 중이에요' })), speechModelTag: soon('speechModelTag', ''),
        translateText: later('translateText', null), translateProgressText: soon('translateProgressText', ''),
        protect: (id, ...args) => { const api = real(); if (api) return api.protect(id, ...args); pendingProtect.set(id, args); return true; },   // 등록만(캐릭터 에셋이 부팅 때 걸어요) — 본체가 오면 그대로 걸어 줘요
        unprotect: id => { const api = real(); if (api) return api.unprotect(id); pendingProtect.delete(id); return true; },
        stripForModel: soon('stripForModel', text => String(text ?? '')), exclusionRegexes: soon('exclusionRegexes', () => []),
        autoSkipReason: message => { const api = real(); if (api) return api.autoSkipReason(message); return message?.is_system === true ? 'system' : null; },   // 「이미 한국어」 판단은 본체(번역 프롬프트)가
        previewText: message => { const api = real(); return api ? api.previewText(message) : null; },   // 화자 색 · TTS 가 부팅 때도 읽어요 — 본체를 당기지 않아요(미리 보기는 번역 중에만 있어요)
    };
    globalThis[ARCHIVE] = {
        blShell: true,
        automatic: () => { const a = globalThis[ARCHIVE]; if (a && !a.blShell) return a.automatic(); ensureBody('API automatic'); return ['all', 'ai'].includes(extensionSettings.auto_mode); },
        wait: (...args) => ensureBody('API wait').then(() => { const a = globalThis[ARCHIVE]; return a && !a.blShell ? a.wait(...args) : undefined; }),
        lookup: (...args) => ensureBody('API lookup').then(() => { const a = globalThis[ARCHIVE]; return a && !a.blShell ? a.lookup(...args) : null; }),
    };
}
function addSlashCommands() {
    for (const name of COMMANDS) {
        try {
            const command = SlashCommand.fromProps({ name, helpString: 'LLM 번역 — 처음 쓸 때 본체를 받아요', callback: (args, value) => ensureBody(`/${name}`).then(() => SlashCommandParser.commands?.[name]?.callback?.(args, value)) });
            command.blShell = true;
            SlashCommandParser.addCommandObject(command);
        } catch (error) { console.warn('[LLM Translator] 명령 자리', name, error); }
    }
}
async function addWandButtons() {
    if (document.getElementById('llm_translate_chat')) return;
    const host = document.getElementById('translate_wand_container');
    if (!host) return;
    const html = await fetch(`${folder}/buttons.html`).then(r => (r.ok ? r.text() : '')).catch(() => '');
    if (html && !document.getElementById('llm_translate_chat')) host.insertAdjacentHTML('beforeend', html);
    for (const id of ['llm_translate_chat', 'llm_translate_input_message']) document.getElementById(id)?.addEventListener('click', () => ensureBody('✦ 메뉴'), { once: true, capture: true });
    syncTranslatorMenus(extensionSettings);
}
function listen() {
    for (const key of QUEUE) {
        const type = event_types[key];
        if (!type) continue;
        const fn = (...args) => { if (body) return; queued.push([type, args]); ensureBody(key); };
        eventSource.on(type, fn); shellListeners.push([type, fn]);
    }
    eventSource.on(event_types.CHAT_CHANGED, () => {
        if (body) return;
        publishGlossaryNames();
        setTimeout(() => { if (body) return; addButtonsToExistingMessages(); updateButtonVisibility(); }, 100);
    });
}
/** 부팅 때 본체가 꼭 있어야 하는 조건 */
function needsBodyAtBoot() {
    if (extensionSettings.remote && typeof extensionSettings.remote === 'object' && extensionSettings.remote.enabled === true) return '번역 리모컨';
    try { if (builtinTranslateNotice(builtinTranslateState(extension_settings))) return '기본 번역 확장 알림'; } catch { /* 없음 */ }
    if (globalThis[TTS_SHELL]?.bodyAtBoot) return 'TTS 화자 색 분석';
    return null;
}

export const ready = new Promise((resolve, reject) => jQuery(async () => { try {
    if (duplicate) { resolve(); return; }
    started = true;
    globalThis[SHELL] = { ensureBody, bodyLoaded };
    if (!document.querySelector('link[href$="/addons/translator/style.css"]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.type = 'text/css'; link.href = `${folder}/${bootSheetOf('translator').split('/').pop()}`; document.head.append(link); }
    installApi();
    addSlashCommands();
    publishGlossaryNames();
    const chatEl = document.getElementById('chat');
    if (chatEl) { observer = new MutationObserver(mutations => { if (body) return; for (const mutation of mutations) for (const node of mutation.addedNodes) if (node.classList?.contains('mes')) createTranslateButtons(node); }); observer.observe(chatEl, { childList: true, subtree: false }); }
    addButtonsToExistingMessages();
    updateButtonVisibility();
    document.addEventListener('click', onButton);
    listen();
    onGate('press', () => ensureBody('처음 누름'));
    await addWandButtons();
    const why = needsBodyAtBoot();
    if (why) ensureBody(why);
    resolve();
} catch (error) { reject(error); } }));
