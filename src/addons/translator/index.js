// Modified 2026-09-24: Blue Lemonade bundled adapter; original settings and translation DB retained.
import { createGuards, watchGuard } from './translation-guard.js';
import { checkpointKey, translateChunks, clearCheckpoints } from './translation-resume.js';
import { segmentParagraphs, translateSegments, clearSegmentCache, forgetSegments, batchPayload, parseBatchResult, batchGroups, restoreParagraphBreaks, stripReplyWrapping, BATCH_HEADER, hasSourceEcho } from './translation-segments.js';
import { syncSelectionRetranslate } from './selection/index.js';
import { syncTranslatorMenus, bindTranslatorMenus } from './menu-visibility.js';
import { makePersonaBridge } from './persona-bridge.js';
import { requestCurrentConnection } from './current-connection.js';
import { createGenerationParameters, getChatCompletionModel } from '../../../../../../openai.js';
import { createTextGenGenerationData, getTextGenModel } from '../../../../../../textgen-settings.js';
import { matchingTranslation, translationFromDisplay } from './archive-bridge.js';
import {
    eventSource,
    event_types,
    getRequestHeaders,
    reloadCurrentChat,
    saveSettingsDebounced,
    substituteParams,
    updateMessageBlock,
    syncMesToSwipe,
    callPopup,
    createRawPrompt,
} from '../../../../../../../script.js';

import { extension_settings, getContext, saveMetadataDebounced } from '../../../../../../extensions.js';
import { getStringHash } from '../../../../../../utils.js';               // [1.7.1] 원문 해시 (원문 사본 대신)
import { power_user } from '../../../../../../power-user.js';           // [1.6.0] 보내기 번역 참고: 페르소나 설명
import { getWorldInfoPrompt, getSortedEntries } from '../../../../../../world-info.js';   // [1.6.0] 보내기 번역 참고: 월드인포 (건조 실행) · [1.8.4] 용어집: 키워드 뽑기
import { SECRET_KEYS, secret_state } from '../../../../../../secrets.js';
import { oai_settings } from '../../../../../../openai.js';
import { POPUP_TYPE, callGenericPopup } from '../../../../../../popup.js';
import { SlashCommandParser } from '../../../../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../../../../slash-commands/SlashCommandArgument.js';

const DB_NAME = 'LLMtranslatorDB';
const STORE_NAME = 'translations';
const METADATA_BACKUP_KEY = 'llmTranslationCacheBackup'; // 메타데이터 백업 키
const RULE_PROMPT_KEY = 'llmRulePrompt'; // 규칙 프롬프트 메타데이터 키
const extensionName = "llm-translator-custom";
const extensionFolderPath = new URL('./', import.meta.url).href.replace(/\/$/, '');
const DEBUG_MODE = false; // 디버그 로그 활성화 플래그

// [변경] 마스킹 패턴 상수 (단일 고정)
// LLM이 '코드 변수'로 인식하여 번역하지 않을 확률이 가장 높은 패턴
const MASK_PATTERN = '[[__VAR_{index}__]]';

let extensionSettings = extension_settings[extensionName];
if (!extensionSettings) {
    extensionSettings = {};
    extension_settings[extensionName] = extensionSettings;
}

// 단독 LLM 번역 확장(또는 이름을 바꾼 사본)이 먼저 올라와 있으면 이 내장판은 이벤트 · 단추 · 슬래시 명령을 달지 않는다 (두 벌이 겹쳐 돌았다).
// 로더(src/addons.js)는 duplicate 를 보고 "대기 중" 으로 표시한다.
export const duplicate = Boolean(globalThis[Symbol.for('st.llm-translator.archive.v1')] || globalThis.__blLlmTranslatorLoaded);
if (duplicate) console.warn('[LLM Translator] 단독 LLM 번역 확장이 이미 실행 중이라 테마 내장판은 대기해요.');
else globalThis.__blLlmTranslatorLoaded = true;
const registerCommand = command => { if (!duplicate) SlashCommandParser.addCommandObject(command); };

// 번역 진행 상태 추적 (단순화)
const translationInProgress = {};
const guards = createGuards(getContext);
let inputTranslationRunning = false;
let batchRun = null;

// 디버그용 함수: 현재 번역 진행 상태 출력
function logTranslationStatus() {
    const activeTranslations = Object.entries(translationInProgress).filter(([id, status]) => status);
    console.log(`[DEBUG] Active translations:`, activeTranslations.length > 0 ? activeTranslations : 'None');
}

// 전역 디버그 함수 (콘솔에서 수동 호출 가능)
window.debugLLMTranslator = function () {
    console.log('=== LLM Translator Debug Info ===');
    console.log('Auto translate mode:', extensionSettings.auto_mode);
    console.log('Translation progress:', translationInProgress);
    console.log('Chat translation in progress:', isChatTranslationInProgress);
    logTranslationStatus();
    console.log('===================================');
};

// 전체 채팅 번역 상태 (기존 복잡한 플래그들 제거)
let isChatTranslationInProgress = false;

// 상태 플래그들이 단순화됨
// [추가] 자동 번역 모드 상수 정의
const autoModeOptions = {
    NONE: 'none',
    ALL: 'all',
    AI: 'ai',
    USER: 'user',
};

// [추가] 모드별 허용 그룹 정의
const incomingTypes = [autoModeOptions.ALL, autoModeOptions.AI];   // AI 메시지 처리 그룹
const outgoingTypes = [autoModeOptions.ALL, autoModeOptions.USER]; // 유저 메시지 처리 그룹

// [수정] defaultSettings 상수 (auto_translate_new_messages 제거, auto_mode 추가)
const defaultSettings = {
    selection_retranslate: false,
    show_chat_translate_menu: true,
    show_input_translate_menu: true,
    translation_display_mode: 'disabled',
    connection_mode: 'current',
    connection_profile: '',
    profile_max_tokens: 0,
    llm_provider: 'openai',
    llm_model: 'gpt-5.4-mini',
    provider_model_history: {
        openai: 'gpt-5.4-mini',
        claude: 'claude-sonnet-5',
        google: 'gemini-3.7-flash',
        cohere: 'command-a-03-2025',
        vertexai: 'gemini-3.7-flash',
        openrouter: 'google/gemini-3.5-flash-lite',
        deepseek: 'deepseek-flash',
        custom: 'custom'
    },
    custom_model: '',       // [구버전 호환] 공급자 구분 없는 단일 커스텀 모델명
    custom_models: {},      // [추가] 공급자별 커스텀 모델명 (예: { custom: 'gemini-3.8-flash' })
    custom_url: '',
    custom_model_lists: {}, // [추가] 커스텀 엔드포인트 주소별로 받아 둔 모델 목록 { 주소: { models: [...], fetched_at: ISO } }
    // [1.8.0] 용어집: 이름·호칭·고유명사의 번역을 고정한다. scope 는 'global' 또는 캐릭터 아바타 파일명(그룹은 'group:<id>').
    glossary_enabled: true,
    glossary_apply_send: true,   // 보내기·입력 번역(한→외국어)에는 방향을 뒤집어서 넣는다
    glossary_sort: 'dst',        // [1.8.2] 목록 정렬: 'dst' 번역 가나다 / 'src' 원문 ABC
    glossary_entries: [],        // [{ id, scope, src, dst }]
    throttle_delay: '0',
    show_input_translate_button: false,
    auto_mode: autoModeOptions.NONE, // [변경] 기본값: 사용 안 함
    force_sequential_matching: false,
    hide_legacy_translate_button: false,
    hide_toggle_button: false,
    hide_new_translate_button: true,
    hide_paragraph_button: true,
    hide_edit_button: false,
    hide_delete_button: true,
    use_reverse_proxy: false,
    reverse_proxy_url: '',
    reverse_proxy_password: '',
    llm_prompt_chat: 'Please translate the following text to korean:',
    llm_prompt_retranslate_correction: `# 역할
당신은 '최소 수정 원칙(Principle of Minimal Intervention)'을 따르는 번역 교정 전문가입니다. 당신의 임무는 원문의 스타일과 표현을 보존하면서, 명백한 오류만 외과수술처럼 정밀하게 수정하는 것입니다.

# 핵심 지침
* **절대 재창작 금지:** 텍스트에 있는 온전한 문장들을 더 나은 표현으로 재구성하려 하지 마세요.
* **오류만 수정:** 아래 '수정 규칙'에 위배되는 부분만 찾아 수정하고, 그 외의 모든 부분은 그대로 유지해야 합니다.

# 수정 규칙
1.  **뜬금없는 외국어:** 번역문에 한국어와 필수 외래어를 제외한 뜬금없는 외국어 단어(러시아어, 키릴 문자 등)가 있다면 자연스러운 한국어로 다시 번역합니다.
3.  **추가 규칙:** 추가 규칙 프롬프트가 존재한다면 번역문은 이를 따라야합니다.

# 출력 형식
* 다른 설명이나 인사 없이, 오직 최종적으로 완성된 번역문 전체만 제공해야 합니다.`,
    llm_prompt_retranslate_guidance: `# 역할
당신은 한국어 번역 교정 전문가입니다. 당신의 임무는 불안정한 초안 번역을 아래의 지침에 따라 정밀하게 교정하는 것입니다.

# 핵심 지침
* **재창작 금지:** 텍스트에 있는 모든 문장들을 더 나은 표현으로 재구성하려 하지 마세요.
* **지침 따르기:** 아래의 '추가 지침'에 해당되는 문장들만 수정하고, 그 외의 모든 부분은 그대로 유지해야 합니다.

# 출력 형식
* 다른 설명이나 인사 없이, 오직 최종적으로 완성된 번역문 전체만 제공해야 합니다.`,
    llm_prompt_retranslate_paragraph: `# 역할
당신은 텍스트 구조 교정가입니다. 현재 초안 번역문에는 줄 바꿈, 문단 개수가 원문과 일치하지않는 문제가 있습니다. 원문의 형식과 정확히 일치하도록 번역문을 교정해주세요.

# 주의사항
* **불필요한 번역 교정 금지:** 텍스트에 있는 문장들을 더 나은 표현으로 재구성하려 하지 마세요. 당신은 번역 교정가가 아닌 구조 교정가입니다.
* **지침 따르기:** 아래의 문제가 발생한 사례만 파악하여 구조를 교정해주세요.

# 지침:
1. 줄바꿈 규칙
   - 원문의 모든 줄바꿈을 번역문에 동일하게 유지
   - 한 줄 띄움과 두 줄 띄움을 구분하여 정확히 반영
   - 임의로 줄바꿈을 추가하거나 제거하지 않음

2. 구조적 일치
   - 원문과 번역문의 문단 수 일치
   - 각 문단의 위치와 순서 유지

3. 내용 점검
   - 원문에 없는 추가 문단 제거
   - 원문에서 누락된 문단이 있다면 추가

# 출력 형식
* 다른 설명이나 인사 없이, 오직 최종적으로 완성된 번역문 전체만 제공해야 합니다.`,
    llm_prompt_input: 'Please translate the following text to english:',
    // [1.6.0] 보내기 번역 — 입력창 옆 💬 버튼(또는 설정)으로 켜면, 내가 보내는 메시지를 send_target_language 로 번역해 AI 에게 보낸다.
    // 내 화면에는 입력한 글(원문)이 그대로 보인다(send_show_original). 참고 정보(send_ctx_*)는 이름 · 용어 · 말투를 맞추라고 같이 넣는 것
    send_translate: false,
    send_target_language: 'English',
    send_dialogue_language: '',      // [1.6.1] 대사(따옴표 · 「」 안) 언어 — 비우면 서술과 같은 언어. 예: 서술 English + 대사 Japanese
    send_display: 'original',      // [1.6.2] 내 화면에 보일 글: original 입력한 글 | sent 보낸 글(번역문) 그대로 | back 보낸 글을 다시 한국어(채팅 번역 프롬프트)로 번역한 번역체
    send_ctx_persona: false,
    send_ctx_char: true,
    send_ctx_note: false,
    send_ctx_wi: false,
    send_ctx_history: false,
    llm_prompt_send: `Translate the user's message below.
{{languageRules}}
- Keep the meaning, tone and register. Keep the formatting exactly: quotes, *asterisks*, markdown, line breaks, emoji.
- If a [Reference] block is given, use it only to keep names, terms and speech style consistent. Never translate or repeat the reference.
- Output only the translated message, nothing else.`,
    llm_prefill_toggle: false,
    llm_prefill_content: 'Understood. Executing the translation as instructed. Here is the translation:',
    user_defined_regexes: [],
    user_no_fold_regexes: [],
    selected_translation_prompt_id: null,
    selected_translation_prompt: null,
    context_message_count: 5,
    context_include_user: false,
    context_exclude_last: true,
    customPrompts: [],
    presets: [],
    temperature: 0.7,
    max_tokens: 1000,
    parameters: {
        openai: {
            max_length: 1000,
            temperature: 0.7,
            frequency_penalty: 0.2,
            presence_penalty: 0.5,
            top_p: 0.99
        },
        claude: {
            max_length: 1000,
            temperature: 0.7,
            top_k: 0,
            top_p: 0.99
        },
        cohere: {
            max_length: 1000,
            temperature: 0.7,
            frequency_penalty: 0,
            presence_penalty: 0,
            top_k: 0,
            top_p: 0.99
        },
        google: {
            max_length: 1000,
            temperature: 0.7,
            top_k: 0,
            top_p: 0.99
        },
        vertexai: {
            max_length: 1000,
            temperature: 0.7,
            top_k: 0,
            top_p: 0.99
        },
        openrouter: {
            max_length: 1000,
            temperature: 0.7,
            frequency_penalty: 0.2,
            presence_penalty: 0.5,
            top_p: 0.99
        },
        deepseek: {
            max_length: 4000, 
            temperature: 0.5,  
            frequency_penalty: 0,
            presence_penalty: 0,
            top_p: 1
        },
        custom: {
            max_length: 1000,
            temperature: 0.7,
            frequency_penalty: 0.2,
            presence_penalty: 0.5,
            top_p: 0.99
        }
    }
};

// 기본 설정 로드, UI 초기화
// 기본 설정 로드, UI 초기화
function updateConnectionVisibility() {
    const current = extensionSettings.connection_mode !== 'direct';
    $('#llm_connection_mode').val(current ? 'current' : 'direct');
    $('#llm_current_settings').toggle(current);
    $('#llm_direct_settings').toggle(!current);
    $('#llm_profile_max_tokens').val(extensionSettings.profile_max_tokens || 0);
}

function loadSettings() {
    if (typeof extensionSettings.selection_retranslate !== 'boolean') extensionSettings.selection_retranslate = extension_settings.salty?.addons?.retranslate === true;
    // [2.1.1] 예전 버전이 따로 쌓아 둔 겹치는 용어집 항목을 한 번 정리한다
    if (Array.isArray(extensionSettings.glossary_entries)) {
        const merged = mergeGlossaryDuplicates(extensionSettings.glossary_entries);
        if (merged) { saveSettingsDebounced(); setTimeout(() => toastr.info(`겹치는 용어집 항목 ${merged}개를 하나로 합쳤어요.`, '용어집', { timeOut: 6000 }), 1500); }
    }
    if (!extensionSettings.current_connection_v1) {
        extensionSettings.connection_mode = 'current';
        extensionSettings.current_connection_v1 = true;
        saveSettingsDebounced();
    }
    // 1. 기본 설정(Top-level) 불러오기
    for (const key in defaultSettings) {
        if (!extensionSettings.hasOwnProperty(key)) {
            extensionSettings[key] = defaultSettings[key];
        }
    }

    // [마이그레이션] auto_translate_on_swipe / auto_translate_new_messages -> auto_mode
    // 기존 불리언 설정을 새로운 모드 문자열로 변환
    if (extensionSettings.hasOwnProperty('auto_translate_new_messages')) {
        if (extensionSettings.auto_translate_new_messages === true) {
            extensionSettings.auto_mode = autoModeOptions.ALL;
        } else {
            extensionSettings.auto_mode = autoModeOptions.NONE;
        }
        delete extensionSettings.auto_translate_new_messages;
        delete extensionSettings.auto_translate_on_swipe; // 구버전 잔재가 있다면 함께 삭제
        saveSettingsDebounced();
    }

    // [마이그레이션] Custom 공급자 키 정규화: 'Custom (OpenAI-compatible)' -> 'custom'
    // 예전 버전에서는 드롭다운 표시 이름이 그대로 값으로 저장되어 API 호출 시 공급자를 인식하지 못했다.
    const LEGACY_CUSTOM_PROVIDER = 'Custom (OpenAI-compatible)';
    if (extensionSettings.llm_provider === LEGACY_CUSTOM_PROVIDER) {
        extensionSettings.llm_provider = 'custom';
        saveSettingsDebounced();
    }
    if (extensionSettings.provider_model_history?.hasOwnProperty(LEGACY_CUSTOM_PROVIDER)) {
        extensionSettings.provider_model_history.custom =
            extensionSettings.provider_model_history.custom || extensionSettings.provider_model_history[LEGACY_CUSTOM_PROVIDER];
        delete extensionSettings.provider_model_history[LEGACY_CUSTOM_PROVIDER];
        saveSettingsDebounced();
    }
    if (extensionSettings.parameters?.hasOwnProperty(LEGACY_CUSTOM_PROVIDER)) {
        extensionSettings.parameters.custom =
            extensionSettings.parameters.custom || extensionSettings.parameters[LEGACY_CUSTOM_PROVIDER];
        delete extensionSettings.parameters[LEGACY_CUSTOM_PROVIDER];
        saveSettingsDebounced();
    }

    // [마이그레이션] 공유되던 커스텀 모델명을 현재 공급자 전용으로 이전
    if (!extensionSettings.custom_models) {
        extensionSettings.custom_models = {};
    }
    // 자유 모델명이 정상인 공급자는 Custom 뿐이므로 그쪽으로만 옮긴다.
    // (엉뚱한 공급자에 남의 모델명이 붙어 404가 나는 것을 막기 위함)
    if (extensionSettings.custom_model) {
        if (!extensionSettings.custom_models.custom) {
            extensionSettings.custom_models.custom = extensionSettings.custom_model;
        }
        extensionSettings.custom_model = '';
        saveSettingsDebounced();
    }

    // 2. 파라미터 객체 초기화 (없으면 통째로 생성)
    if (!extensionSettings.parameters) {
        extensionSettings.parameters = defaultSettings.parameters;
    }
    
    // 3. OpenRouter 파라미터가 없으면 기본값에서 복사
    if (!extensionSettings.parameters.openrouter) {
        extensionSettings.parameters.openrouter = defaultSettings.parameters.openrouter;
    }

    if (!extensionSettings.parameters.deepseek) {
        extensionSettings.parameters.deepseek = defaultSettings.parameters.deepseek;
    }

    // [추가] Custom (OpenAI-compatible) 파라미터 초기화
    if (!extensionSettings.parameters.custom) {
        extensionSettings.parameters.custom = { ...defaultSettings.parameters.custom };
    }
	
    // 4. 공급자 사용 이력 초기화
    if (!extensionSettings.provider_model_history) {
        extensionSettings.provider_model_history = defaultSettings.provider_model_history;
    }
    if (!extensionSettings.provider_model_history.openrouter) {
        extensionSettings.provider_model_history.openrouter = defaultSettings.provider_model_history.openrouter;
    }
    if (!extensionSettings.provider_model_history.custom) {
        extensionSettings.provider_model_history.custom = defaultSettings.provider_model_history.custom;
    }

    // [추가] 커스텀 엔드포인트 모델 목록 캐시 초기화
    if (!extensionSettings.custom_model_lists || typeof extensionSettings.custom_model_lists !== 'object' || Array.isArray(extensionSettings.custom_model_lists)) {
        extensionSettings.custom_model_lists = {};
    }

    // 현재 선택된 공급자와 프롬프트를 UI에 설정
    const currentProvider = extensionSettings.llm_provider;
    $('#llm_provider').val(currentProvider);

    // 숨겨진 텍스트 영역들에 각 프롬프트 값 설정
    $('#llm_prompt_chat').val(extensionSettings.llm_prompt_chat);
    $('#llm_prompt_retranslate_correction').val(extensionSettings.llm_prompt_retranslate_correction);
    $('#llm_prompt_retranslate_guidance').val(extensionSettings.llm_prompt_retranslate_guidance);
    $('#llm_prompt_retranslate_paragraph').val(extensionSettings.llm_prompt_retranslate_paragraph);
    $('#llm_prompt_input').val(extensionSettings.llm_prompt_input);
    $('#llm_prompt_send').val(extensionSettings.llm_prompt_send);
    $('#llm_prefill_content').val(extensionSettings.llm_prefill_content);

    // [1.6.0] 보내기 번역 설정
    // 1.6.0 의 기본 프롬프트("into {{targetLang}}")를 그대로 쓰고 있으면 두 언어를 아는 1.6.1 기본으로 바꿈 (직접 고친 건 그대로)
    if (extensionSettings.llm_prompt_send === SEND_PROMPT_1_6_0) {
        extensionSettings.llm_prompt_send = defaultSettings.llm_prompt_send;
        $('#llm_prompt_send').val(extensionSettings.llm_prompt_send);
    }
    $('#llm_send_translate').prop('checked', !!extensionSettings.send_translate);
    $('#llm_send_target_language').val(extensionSettings.send_target_language || 'English');
    $('#llm_send_dialogue_language').val(extensionSettings.send_dialogue_language || '');
    // 1.6.0~1.6.1 의 send_show_original(불리언) → send_display
    if (!extensionSettings.send_display) {
        extensionSettings.send_display = extensionSettings.send_show_original === false ? 'sent' : 'original';
        delete extensionSettings.send_show_original;
    }
    $('#llm_send_display').val(extensionSettings.send_display);
    for (const key of SEND_CTX_KEYS) $(`#llm_${key}`).prop('checked', !!extensionSettings[key]);

    updateConnectionVisibility();

    // 현재 공급자의 파라미터 불러오기
    updateParameterVisibility(currentProvider);
    loadParameterValues(currentProvider);

    // 현재 공급자의 마지막 사용 모델 불러오기
    updateModelList();

    // 프리필 사용 여부 로드
    $('#llm_prefill_toggle').prop('checked', extensionSettings.llm_prefill_toggle);

    // 스로틀링 딜레이 값
    $('#throttle_delay').val(extensionSettings.throttle_delay || '0');

    // 체크박스 상태 설정 및 버튼 업데이트
    syncTranslatorMenus(extensionSettings);
    $('#llm_selection_retranslate').prop('checked', extensionSettings.selection_retranslate);
    syncSelectionRetranslate({settings:extensionSettings, translate, render:processTranslationText, capture: message => guards.capture(message)});
    $('#llm_translation_button_toggle').prop('checked', extensionSettings.show_input_translate_button);
    updateInputTranslateButton();

    // [변경] 새 메시지 자동 번역 모드 설정 (드롭다운)
    $('#llm_auto_mode').val(extensionSettings.auto_mode);
    
    $('#force_sequential_matching').prop('checked', extensionSettings.force_sequential_matching);

    // llmContext 설정 로드
    $('#llm_context_message_count').val(extensionSettings.context_message_count || 5);
    $('#llm_context_message_count_value').val(extensionSettings.context_message_count || 5);
    $('#llm_context_include_user').prop('checked', extensionSettings.context_include_user);
    $('#llm_context_exclude_last').prop('checked', extensionSettings.context_exclude_last !== false);

    // [추가] 커스텀 엔드포인트 설정 로드
    $('#llm_custom_url').val(extensionSettings.custom_url || '');
    updateCustomEndpointVisibility(currentProvider);

    // 리버스 프록시 설정 로드
    $('#llm_use_reverse_proxy').prop('checked', extensionSettings.use_reverse_proxy);
    $('#llm_reverse_proxy_url').val(extensionSettings.reverse_proxy_url);
    $('#llm_reverse_proxy_password').val(extensionSettings.reverse_proxy_password);

    // 아이콘 표시/숨김 설정 로드
    $('#hide_legacy_translate_button').prop('checked', extensionSettings.hide_legacy_translate_button);
    $('#hide_toggle_button').prop('checked', extensionSettings.hide_toggle_button);
    $('#hide_new_translate_button').prop('checked', extensionSettings.hide_new_translate_button);
    $('#hide_paragraph_button').prop('checked', extensionSettings.hide_paragraph_button);
    $('#hide_edit_button').prop('checked', extensionSettings.hide_edit_button);
    $('#hide_delete_button').prop('checked', extensionSettings.hide_delete_button);

    const displayMode = extensionSettings.translation_display_mode || defaultSettings.translation_display_mode;
    $('#translation_display_mode').val(displayMode);

    // 규칙 프롬프트 로드
    loadRulePrompt();

    // 사용자 정의 정규식 로드
    const userRegexes = extensionSettings.user_defined_regexes || [];
    $('#llm_user_regexes').val(userRegexes.join('\n'));
	
	// 접기 금지 정규식 로드
    const userNoFoldRegexes = extensionSettings.user_no_fold_regexes || [];
    $('#llm_user_no_fold_regexes').val(userNoFoldRegexes.join('\n'));
	
    // 프롬프트 선택 상태 복원
    if (promptManager) {
        const savedPromptId = extensionSettings.selected_translation_prompt_id;
        const promptSelect = document.getElementById('prompt_select');

        if (savedPromptId && promptSelect) {
            promptSelect.value = savedPromptId;
            const selectedPrompt = promptManager.getSelectedPrompt();
            if (selectedPrompt) {
                extensionSettings.selected_translation_prompt = selectedPrompt.content;
                logDebug('Restored translation prompt:', selectedPrompt.title);
            }
        }

        // 텍스트 필드에 프롬프트 로드 (항상 실행)
        promptManager.loadPromptToEditor();
    }

    // [추가] 커스텀 공급자인데 저장된 주소의 모델 목록이 없으면 (업데이트 직후 등) 조용히 받아온다.
    autoFetchCustomModelsIfEmpty();
}

// 규칙 프롬프트 관리 함수
function loadRulePrompt() {
    const context = getContext();
    if (context && context.chatMetadata) {
        const rulePrompt = context.chatMetadata[RULE_PROMPT_KEY] || '';
        $('#llm_rule_prompt').val(rulePrompt);
    }
}

function saveRulePrompt() {
    const context = getContext();
    if (context) {
        if (!context.chatMetadata) {
            context.chatMetadata = {};
        }
        const rulePrompt = $('#llm_rule_prompt').val();
        context.chatMetadata[RULE_PROMPT_KEY] = rulePrompt;
        saveMetadataDebounced();
    }
}

// 프롬프트 관리는 이제 PromptManager 클래스에서 처리됩니다



// 리버스 프록시 설정 저장
function saveReverseProxySettings() {
    extensionSettings.use_reverse_proxy = $('#llm_use_reverse_proxy').is(':checked');
    extensionSettings.reverse_proxy_url = $('#llm_reverse_proxy_url').val();
    extensionSettings.reverse_proxy_password = $('#llm_reverse_proxy_password').val();
    saveSettingsDebounced();
}

// [추가] 공급자별 커스텀 모델명 읽기/쓰기
// 하나의 필드를 모든 공급자가 공유하면, 예를 들어 Custom 엔드포인트용으로 입력한
// 'gemini-3.8-flash'가 Vertex AI로 전환했을 때 그대로 전송되어 404가 난다.
function getCustomModelName(provider) {
    const perProvider = extensionSettings.custom_models?.[provider];
    if (typeof perProvider === 'string') {
        return perProvider;
    }
    return '';
}

function setCustomModelName(provider, name) {
    if (!extensionSettings.custom_models) {
        extensionSettings.custom_models = {};
    }
    extensionSettings.custom_models[provider] = name;
}

// [추가] Custom (OpenAI-compatible) 엔드포인트 입력란 표시/숨김
function updateCustomEndpointVisibility(provider) {
    $('#custom_endpoint_container').toggle(provider === 'custom');
}

/**
 * [추가] Custom (OpenAI-compatible) 접속 정보 확정
 * 확장 설정에 주소가 있으면 그것을 쓰고,
 * 비어있으면 SillyTavern 본체의 Custom 접속 설정을 그대로 사용한다.
 */
function getCustomEndpointConfig() {
    // 끝의 슬래시를 떼어 둔다: 서버는 주소 뒤에 '/chat/completions'를 그대로 붙이므로 '/v1/'이면 '//'가 생겨 404가 난다.
    const ownUrl = normalizeCustomUrl(extensionSettings.custom_url);
    if (ownUrl) {
        return { url: ownUrl, inheritExtras: false };
    }
    return { url: normalizeCustomUrl(oai_settings?.custom_url), inheritExtras: true };
}

// [추가] 커스텀 엔드포인트 모델 목록 ----------------------------------------------
// 주소를 캐시 키로 쓸 때 끝의 슬래시·공백 차이로 다른 항목이 되지 않게 정규화한다.
function normalizeCustomUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
}

function isValidHttpUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

// 지금 유효한 커스텀 주소로 받아 둔 모델 목록 (없으면 빈 배열)
function getCachedCustomModels() {
    const url = normalizeCustomUrl(getCustomEndpointConfig().url);
    if (!url) {
        return [];
    }
    const entry = extensionSettings.custom_model_lists?.[url];
    return Array.isArray(entry?.models) ? entry.models : [];
}

// 모델 목록 상태 문구 갱신 (message를 주면 그 문구를, 없으면 캐시 상태를 보여준다)
function updateCustomModelsStatus(message) {
    const status = $('#llm_custom_models_status');
    if (message) {
        status.text(message);
        return;
    }
    const config = getCustomEndpointConfig();
    const url = normalizeCustomUrl(config.url);
    if (!url) {
        status.text('주소를 입력하면 그 서버가 제공하는 모델을 아래 목록에 채웁니다.');
        return;
    }
    const entry = extensionSettings.custom_model_lists?.[url];
    const source = config.inheritExtras ? '본체 설정 주소' : '위 주소';
    if (!Array.isArray(entry?.models)) {
        status.text(`아직 불러오지 않았습니다. '모델 목록 불러오기'를 누르세요. (${source}: ${url})`);
        return;
    }
    const when = entry.fetched_at ? new Date(entry.fetched_at).toLocaleString() : '';
    status.text(`모델 ${entry.models.length}개 (${when} 기준, ${source})`);
}

// 커스텀 엔드포인트의 /models 목록을 SillyTavern 서버를 통해 받아온다.
// 본체 API 연결 화면과 같은 경로(/api/backends/chat-completions/status)라서
// 저장된 Custom API 키는 서버가 알아서 붙이고, 브라우저에서 외부 주소를 직접 부르지 않는다.
// 새로 입력한 주소로는 자동으로 요청하지 않는다(오타 난 주소로 키가 나가지 않게) — 버튼을 눌러야 한다.
// 이미 저장돼 있는 주소(번역 요청에 쓰이는 주소)는 목록이 비어 있을 때 조용히 한 번 받아온다.
const CUSTOM_MODEL_FETCH_TIMEOUT_MS = 30000;
const CUSTOM_MODEL_LIST_CACHE_LIMIT = 3; // 주소별 목록은 최근 3개만 보관 (settings.json 비대화·옛 주소 잔존 방지)
const customModelFetches = new Map(); // 정규화된 주소 -> 진행 중인 요청 Promise<{ ok, ids, error }>

// 버튼은 '지금 입력된 주소'로 요청 중일 때만 잠근다 (다른 주소의 요청이 남아 있어도 새 주소는 바로 받아올 수 있게).
function syncCustomFetchButton() {
    const busy = customModelFetches.has(getCustomEndpointConfig().url);
    $('#llm_custom_fetch_models').prop('disabled', busy).toggleClass('llmt-loading', busy);
}

function pruneCustomModelLists(keepUrl) {
    const lists = extensionSettings.custom_model_lists || {};
    const entries = Object.entries(lists)
        .sort((a, b) => String(b[1]?.fetched_at || '').localeCompare(String(a[1]?.fetched_at || '')));
    const keep = new Set([keepUrl, ...entries.slice(0, CUSTOM_MODEL_LIST_CACHE_LIMIT).map(([url]) => url)]);
    for (const [url] of entries) {
        if (!keep.has(url)) {
            delete lists[url];
        }
    }
}

// 실제 요청: 성공하면 정렬·중복 제거된 모델 id 배열, 실패하면 throw
async function requestCustomModelIds(url, includeHeaders) {
    const body = {
        chat_completion_source: 'custom',
        custom_url: url,
        custom_include_headers: includeHeaders,
    };
    const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(CUSTOM_MODEL_FETCH_TIMEOUT_MS) : undefined;
    let response;
    try {
        response = await fetch('/api/backends/chat-completions/status', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
            cache: 'no-cache',
            signal,
        });
    } catch (error) {
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
            throw new Error(`응답 시간이 초과되었습니다. (${CUSTOM_MODEL_FETCH_TIMEOUT_MS / 1000}초)`);
        }
        throw error;
    }
    if (!response.ok) {
        throw new Error(`서버 응답 ${response.status} ${response.statusText}`.trim());
    }
    const data = await response.json();
    // 표준은 { data: [...] }지만 배열만 주거나 { models: [...] }로 주는 서버도 있다.
    const rawList = Array.isArray(data) ? data
        : Array.isArray(data?.data) ? data.data
            : Array.isArray(data?.models) ? data.models
                : [];
    if (rawList.length === 0 && data?.error) {
        throw new Error('엔드포인트가 모델 목록을 돌려주지 않았습니다. (서버 연결 실패, 주소 끝의 /v1, API 키를 확인해주세요)');
    }
    return [...new Set(rawList
        .map(item => (item && typeof item === 'object') ? (item.id ?? item.name ?? '') : item)
        .map(id => String(id ?? '').trim())
        .filter(id => id && id !== 'custom'))] // 'custom'은 자유 입력 항목의 예약값이라 제외
        .sort((a, b) => a.localeCompare(b));
}

async function fetchCustomModelList({ silent = false } = {}) {
    const config = getCustomEndpointConfig();
    const url = config.url;
    if (!url || !isValidHttpUrl(url)) {
        updateCustomModelsStatus(url ? `올바른 주소가 아닙니다: ${url}` : '커스텀 엔드포인트 주소가 비어 있습니다.');
        if (!silent) {
            toastr.warning('커스텀 엔드포인트 주소를 먼저 입력해주세요. (예: http://127.0.0.1:5001/v1)');
        }
        return [];
    }

    const isCurrentUrl = () => getCustomEndpointConfig().url === url;
    const syncButton = syncCustomFetchButton;

    // 같은 주소로 이미 요청 중이면 그 결과를 같이 기다린다 (주소가 다르면 별도 요청).
    let job = customModelFetches.get(url);
    if (!job) {
        const includeHeaders = config.inheritExtras ? substituteParams(oai_settings?.custom_include_headers || '') : '';
        job = (async () => {
            try {
                const ids = await requestCustomModelIds(url, includeHeaders);
                extensionSettings.custom_model_lists[url] = { models: ids, fetched_at: new Date().toISOString() };
                pruneCustomModelLists(url);
                // 자유 입력란에 적어 둔 모델명이 목록에 있으면 그 항목을 골라 준다 (보내는 모델명은 동일).
                const typedName = getCustomModelName('custom');
                if (isCurrentUrl() && extensionSettings.provider_model_history.custom === 'custom' && typedName && ids.includes(typedName)) {
                    extensionSettings.provider_model_history.custom = typedName;
                }
                saveSettingsDebounced();
                return { ok: true, ids };
            } catch (error) {
                console.error('[LLM Translator] 커스텀 모델 목록 불러오기 실패:', url, error);
                return { ok: false, ids: [], error };
            } finally {
                customModelFetches.delete(url);
            }
        })();
        customModelFetches.set(url, job);
    }

    syncButton();
    if (isCurrentUrl()) {
        updateCustomModelsStatus(`모델 목록을 불러오는 중… (${url})`);
    }

    const result = await job;
    const message = result.ok ? '' : String(result.error?.message || result.error || '알 수 없는 오류');

    // 응답이 오기 전에 주소를 바꿨으면 화면은 건드리지 않는다 (새 주소의 상태는 새 주소의 요청이 처리).
    if (isCurrentUrl()) {
        if ($('#llm_provider').val() === 'custom') {
            updateModelList();
        }
        if (!result.ok) {
            updateCustomModelsStatus(`불러오기 실패: ${message}`);
        }
    }
    syncButton();

    if (!silent) {
        if (!result.ok) {
            toastr.error(`모델 목록을 불러오지 못했습니다: ${message}`);
        } else if (result.ids.length === 0) {
            toastr.warning('엔드포인트가 빈 모델 목록을 돌려줬습니다.');
        } else {
            toastr.success(`모델 ${result.ids.length}개를 불러왔습니다.`);
            const selected = extensionSettings.provider_model_history.custom;
            if (isCurrentUrl() && selected && selected !== 'custom' && !result.ids.includes(selected)) {
                toastr.warning(`지금 선택된 모델 '${selected}'은(는) 이 주소의 목록에 없습니다. 목록에서 다시 골라주세요.`);
            }
        }
    }
    return result.ids;
}

// 파라미터 섹션 표시/숨김
function updateParameterVisibility(provider) {
    // 모든 파라미터 그룹 숨기기
    $('.parameter-group').hide();
    
    // 선택된 공급자의 파라미터 그룹만 표시
    if (provider === 'openrouter' || provider === 'deepseek' || provider === 'custom') {
        // [추가] OpenRouter는 OpenAI 파라미터 UI를 공유함
        $('.openai_params').show();
    } else {
        $(`.${provider}_params`).show();
    }
}

// 선택된 공급자의 파라미터 값을 입력 필드에 로드
// 선택된 공급자의 파라미터 값을 입력 필드에 로드
function loadParameterValues(provider) {
    // 1. [데이터 소스] 현재 선택된 공급자(OpenRouter 등)의 설정값을 가져옴 (독립적 관리)
    const params = extensionSettings.parameters[provider];
    if (!params) return;

    // 2. [UI 타겟] 화면에서 조작할 요소의 클래스/ID 접미사 결정
    // OpenRouter는 화면에 자신만의 UI가 없고 OpenAI UI를 빌려 씀
    let targetUiSuffix = provider;
    if (provider === 'openrouter' || provider === 'deepseek' || provider === 'custom') {
        targetUiSuffix = 'openai';
    }

    // 3. UI 요소 순회하며 값 적용
    // 주의: 찾을 때는 targetUiSuffix(openai)를 쓰지만, 값은 params(openrouter)에서 가져옴
    $(`.${targetUiSuffix}_params input`).each(function () {
        const input = $(this);
        // ID에서 접미사를 떼어내어 순수 파라미터 키(key)를 추출 (예: frequency_penalty_openai -> frequency_penalty)
        const paramName = input.attr('data-param') || input.attr('id').replace(`_${targetUiSuffix}`, ''); // [1.9.5] 실리태번 id 와 겹치던 칸(top_p)은 data-param 으로

        if (params.hasOwnProperty(paramName)) {
            const value = params[paramName];

            // 슬라이더, 입력 필드 모두 업데이트
            if (input.hasClass('neo-range-slider')) {
                input.val(value);
                input.next('.neo-range-input').val(value);
            } else if (input.hasClass('neo-range-input')) {
                input.val(value);
                input.prev('.neo-range-slider').val(value);
            }
        }
    });

    // 공통 파라미터(Temperature, Max Length) 업데이트
    ['max_length', 'temperature'].forEach(param => {
        if (params.hasOwnProperty(param)) {
            const value = params[param];
            const input = $(`#${param}`);
            if (input.length) {
                input.val(value);
                input.prev('.neo-range-slider').val(value);
            }
        }
    });
}

// 선택된 공급자의 파라미터 값을 저장
function saveParameterValues(provider) {
    // 1. [데이터 타겟] 저장할 대상 객체 복사 (OpenRouter 등)
    const params = { ...extensionSettings.parameters[provider] };

    // 공통 파라미터 저장
    params.max_length = parseInt($('#max_length').val());
    params.temperature = parseFloat($('#temperature').val());

    // 2. [UI 소스] 값을 읽어올 화면 요소 결정
    let targetUiSuffix = provider;
    if (provider === 'openrouter' || provider === 'deepseek' || provider === 'custom') {
        targetUiSuffix = 'openai';
    }

    // 3. UI에서 값을 읽어서 params 객체에 저장
    // 화면의 OpenAI 슬라이더 값을 읽지만, 저장은 provider(OpenRouter) 객체에 함
    $(`.${targetUiSuffix}_params input.neo-range-input`).each(function () {
        // ID에서 파라미터 이름 추출
        const paramName = $(this).attr('data-param') || $(this).attr('id').replace(`_${targetUiSuffix}`, ''); // [1.9.5] data-param 먼저
        
        // 값 읽기 및 저장
        params[paramName] = parseFloat($(this).val());
    });

    // 최종적으로 해당 공급자의 설정에 저장
    extensionSettings.parameters[provider] = params;
    saveSettingsDebounced();
}

// 공급자별 특정 파라미터 추출
function getProviderSpecificParams(provider, params) {
    switch (provider) {
        case 'profile': {
            const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ??
                data.results?.[0]?.text ?? data.candidates?.[0]?.content ?? data.message?.content ??
                data.content ?? data.generations?.[0]?.text ?? data.text;
            result = (typeof content === 'string' ? content :
                Array.isArray(content) ? content.filter(p => !p.type || p.type === 'text').map(p => p.text || '').join('') :
                content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '').trim();
            break;
        }
        case 'openai':
        case 'openrouter':
        case 'custom':
            return {
                frequency_penalty: params.frequency_penalty,
                presence_penalty: params.presence_penalty,
                top_p: params.top_p
            };
        case 'claude':
            return {
                top_k: params.top_k,
                top_p: params.top_p
            };
        case 'cohere':
            return {
                frequency_penalty: params.frequency_penalty,
                presence_penalty: params.presence_penalty,
                top_k: params.top_k,
                top_p: params.top_p
            };
        case 'google':
            return {
                top_k: params.top_k,
                top_p: params.top_p
            };
        case 'vertexai':
            return {
                top_k: params.top_k,
                top_p: params.top_p
            };
        default:
            return {};
    }
}

// [추가] 마지막으로 모델 목록을 그린 커스텀 주소 (본체 설정 주소를 물려받는 경우 변경 감지용)
let lastRenderedCustomUrl = null;

// [추가] 저장된 커스텀 주소의 목록이 비어 있으면 조용히 한 번 받아온다 (첫 로드·공급자 전환·본체 주소 변경 시)
function autoFetchCustomModelsIfEmpty() {
    if (extensionSettings.connection_mode !== 'direct') return;
    if ($('#llm_provider').val() !== 'custom') {
        return;
    }
    if (getCachedCustomModels().length === 0 && isValidHttpUrl(getCustomEndpointConfig().url)) {
        fetchCustomModelList({ silent: true });
    }
}

// 선택된 공급자의 모델 목록 업데이트
function updateModelList() {
    // [2.1.3] 설정 화면이 없으면(HTML 을 못 받음) 손대지 않는다 — 공급자를 undefined 로 읽어 llm_model 을 비웠다
    if (!$('#llm_provider').length) return;
    const provider = $('#llm_provider').val();
    const modelSelect = $('#llm_model');
    modelSelect.empty();

    // [갱신 2026-09] 각 공급자 공식 문서 · OpenRouter 모델 API 기준 최신 목록 (최신/주력 모델 우선)
    const geminiModels = [
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-pro-preview',
        'gemini-3.1-flash-lite',
        'gemini-3-flash-preview',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite'
    ];
    const models = {
        'openai': [
            'gpt-6-astra',
            'gpt-5.6-sol',
            'gpt-5.6-terra',
            'gpt-5.6-luna',
            'gpt-5.6',
            'gpt-5.5',
            'gpt-5.4',
            'gpt-5.4-mini',
            'gpt-5.4-nano',
            'gpt-5.3-chat-latest',
            'gpt-5.2',
            'gpt-5.1',
            'gpt-5',
            'gpt-5-mini',
            'gpt-5-nano',
            'gpt-4.1',
            'gpt-4.1-mini',
            'gpt-4.1-nano',
            'o4-mini',
            'o3',
            'gpt-4o',
            'gpt-4o-mini'
        ],
        'claude': [
            'claude-fable-5-1',
            'claude-opus-5',
            'claude-sonnet-5',
            'claude-haiku-4-5',
            'claude-fable-5',
            'claude-opus-4-8',
            'claude-opus-4-7',
            'claude-opus-4-6',
            'claude-sonnet-4-6',
            'claude-opus-4-5',
            'claude-sonnet-4-5'
        ],
        'google': geminiModels,
        'cohere': [
            'command-a-plus-05-2026',
            'command-a-03-2025',
            'command-r7b-12-2024',
            'command-r-plus-08-2024',
            'command-r-08-2024',
            'c4ai-aya-expanse-32b',
            'c4ai-aya-expanse-8b'
        ],
        'vertexai': geminiModels,
        'openrouter': [
            'google/gemini-3.8-flash',
            'google/gemini-3.7-flash',
            'google/gemini-3.5-flash-lite',
            'google/gemini-3.1-pro-preview',
            'google/gemini-2.5-pro',
            'anthropic/claude-fable-5.1',
            'anthropic/claude-opus-5',
            'anthropic/claude-sonnet-5',
            'anthropic/claude-haiku-4.5',
            'openai/gpt-6-astra',
            'openai/gpt-5.6-terra',
            'openai/gpt-5.6-luna',
            'deepseek/deepseek-v4.1-flash',
            'deepseek/deepseek-v4-pro',
            'x-ai/grok-4.6',
            'qwen/qwen3.8-max-0902',
            'moonshotai/kimi-k3',
            'z-ai/glm-5.3',
            'mistralai/mistral-medium-3-5'
        ],
        'deepseek': [
            'deepseek-flash',    // V4.1 Flash
            'deepseek-v4-pro',
            'deepseek-v4-flash'  // 구 이름 (V4.1 Flash로 연결됨)
        ],
        // Custom (OpenAI-compatible)은 고정 목록 대신 엔드포인트에서 받아 둔 목록을 쓴다 (없으면 커스텀 모델 입력만)
        'custom': getCachedCustomModels()
    };

    const providerModels = models[provider] || [];
    const savedModel = extensionSettings.provider_model_history[provider];
    for (const model of providerModels) {
        // 서버가 돌려준 모델명에 따옴표 등이 섞여 있어도 깨지지 않게 속성으로 넣는다.
        modelSelect.append($('<option>').attr('value', model).text(model));
    }
    // 목록에서 빠진 예전 모델을 쓰던 경우 선택이 비지 않도록 그대로 남겨 둔다.
    if (savedModel && savedModel !== 'custom' && !providerModels.includes(savedModel)) {
        // 커스텀 엔드포인트에서 받은 목록에 없는 모델은 다른 주소에서 고른 것일 수 있으니 따로 표시한다.
        const suffix = (provider === 'custom' && providerModels.length > 0) ? '(이 주소 목록에 없음)' : '(이전 목록)';
        modelSelect.append($('<option>').attr('value', savedModel).text(`${savedModel} ${suffix}`));
    }
    // [추가] 커스텀 모델 입력란 자동완성: 커스텀 공급자에서 받아 둔 목록만 제안한다.
    const datalist = $('#llm_custom_model_datalist');
    datalist.empty();
    if (provider === 'custom') {
        for (const model of providerModels) {
            datalist.append($('<option>').attr('value', model));
        }
        updateCustomModelsStatus();
        syncCustomFetchButton();
        lastRenderedCustomUrl = getCustomEndpointConfig().url;
    }
    // 맨 아래에 custom 옵션 추가
    modelSelect.append(`<option value="custom">⚙️ 커스텀 모델 입력</option>`);

    // 해당 공급자의 마지막 사용 모델을 선택
    const lastUsedModel = savedModel || providerModels[0];
    modelSelect.val(lastUsedModel);

    // custom 선택시 커스텀 입력에 기존 값 표시 (공급자별로 따로 보관)
    if (lastUsedModel === 'custom') {
        $('#custom_model_container').show();
        $('#llm_custom_model').val(getCustomModelName(provider));
    } else {
        $('#custom_model_container').hide();
    }

    // 모델과 공급자 이력 업데이트
    extensionSettings.llm_model = lastUsedModel;
    extensionSettings.provider_model_history[provider] = lastUsedModel;
}

// 커스텀 플레이스홀더 치환 함수
function substituteCustomPlaceholders(prompt, isInputTranslation = false) {
    if (!prompt.includes('{{llmContext}}')) {
        return prompt;
    }

    const count = extensionSettings.context_message_count || 5;
    const includeUser = extensionSettings.context_include_user || false;
    const excludeLast = extensionSettings.context_exclude_last && !isInputTranslation;
    const context = getContext();

    if (!context?.chat?.length) {
        return prompt.replace(/\{\{llmContext\}\}/g, '');
    }

    let messages;
    if (excludeLast) {
        // 채팅 번역시 마지막 메시지 제외 (번역 대상과 중복 방지)
        messages = context.chat
            .slice(-count - 1, -1)
            .filter(m => includeUser || !m.is_user)
            .map(m => m.mes)
            .join('\n\n');
    } else {
        messages = context.chat
            .slice(-count)
            .filter(m => includeUser || !m.is_user)
            .map(m => m.mes)
            .join('\n\n');
    }

    // [1.9.2] 함수로 넣는다: 채팅 글에 $' · $$ 가 있으면 문자열 치환 기호로 읽혀 프롬프트가 깨졌다
    return prompt.replace(/\{\{llmContext\}\}/g, () => messages);
}


// [추가] 모델별 요청 규칙. SillyTavern 본체(public/scripts/openai.js)가 자기 요청에 적용하는 규칙과 같다.
// 이 확장은 본체 프론트엔드를 거치지 않고 백엔드로 바로 보내므로, 여기서 맞추지 않으면 최신 모델이 400 오류를 낸다.
function applyModelRequestRules(provider, model, parameters) {
    const dropSampling = (...keys) => keys.forEach(key => delete parameters[key]);
    const useMaxCompletionTokens = () => {
        // OpenRouter는 max_tokens를 알아서 변환하므로 OpenAI 직접 연결에서만 바꾼다.
        if (provider === 'openai' && parameters.max_tokens !== undefined) {
            parameters.max_completion_tokens = parameters.max_tokens;
            delete parameters.max_tokens;
        }
    };

    if ((provider === 'openai' && /^(o1|o3|o4)/.test(model)) || (provider === 'openrouter' && /^openai\/(o1|o3|o4)/.test(model))) {
        useMaxCompletionTokens();
        dropSampling('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
    }

    // GPT-5 이후(GPT-6 포함): 추론 모드에서는 샘플링 값을 거부한다. GPT-5.1~5.4는 페널티만 거부한다.
    if ((provider === 'openai' || provider === 'openrouter') && /gpt-(5|6)/.test(model)) {
        useMaxCompletionTokens();
        if (/gpt-5-chat-latest/.test(model)) {
            // 채팅 전용 모델은 샘플링 값을 그대로 받는다.
        } else if (/gpt-5\.(1|2|3|4)/.test(model) && !/chat-latest/.test(model)) {
            dropSampling('frequency_penalty', 'presence_penalty');
        } else {
            dropSampling('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
        }
    }

    // Claude Fable / Claude 5: 샘플링 값을 모두 거부한다 (OpenRouter 등 프록시 경유 포함).
    if (/claude-(fable|opus-5|sonnet-5)/.test(model)) {
        dropSampling('temperature', 'top_p', 'top_k', 'frequency_penalty', 'presence_penalty');
    }
}

// API 호출 로직 (수정됨 - API 키 검증 추가)
/**
 * @param {string} fullPrompt
 * @param {{ maxTokens?: number, temperature?: number, timeoutMs?: number }} [overrides] [1.8.7] 용어집 뽑기처럼 짧고 결정적인 답이 필요한 호출용
 */
// [1.9.0] 거절 · 차단 알아채기
// 채팅은 프리셋의 시스템 프롬프트 · 카드 · 앞 대화 안에서 쓰지만, 번역 요청은 "번역해" + 본문 한 덩어리뿐이라
// 같은 모델도 수위 높은 장면을 거절하곤 한다. 예전에는 그 거절문이 번역문으로 붙고 IndexedDB 캐시에도 들어가서,
// 다시 번역해도 캐시의 거절문이 돌아왔다. 안전 필터에 막혀 빈 답이 오면 이유 없이 "응답이 비어있습니다"만 떴다.
const REFUSAL_PATTERN = new RegExp([
    '(죄송|유감|안타깝)[^\\n]{0,60}(수 없|어렵|불가|못 ?합|못 ?하|드리지 않|하지 않)',
    '(번역|도와|제공|응할|진행|처리|작성)(해 ?드릴|해 ?줄|할|하는 것은|하기는?) ?(수 없|어렵|곤란)',
    "\\bI(?:'m| am) (?:sorry|unable|not able)\\b",
    "\\bI (?:can(?:not|'t)|won't|will not|must decline)\\b",
    "\\b(?:can(?:not|'t)|unable to|not able to) (?:help|assist|translate|provide|comply|fulfill|continue)\\b",
    '\\b(?:against|violates?) (?:my|the|our) (?:guidelines|polic(?:y|ies))\\b',
].join('|'), 'i');

/**
 * 번역문이 사실은 거절문인가. 대사 속 "I'm sorry" · "죄송합니다" 를 거절로 오해하지 않도록,
 * 원문이 어느 정도 길고(80자+) 결과가 원문의 40% · 700자 이하로 짧을 때만 앞부분에서 거절 말투를 찾는다.
 * (영→한 정상 번역은 원문 글자 수의 55~70% 쯤이다)
 */
// 5.3.6: 원문 길이와 상관없이 쓰는 '모델 목소리' 거절 — 거절 말투에 더해 요청 · 내용 · 번역 · 정책 얘기가 있어야 하고,
//        원문에 거절 · 사과 · 못 함 말이 없어야 한다 (대사 "I can't." → "못 해." · "미안, 도와줄 수 없어" 같은 정상 번역은 원문에도 그 말이 있다)
const REFUSAL_TOPIC = /translat|request|content|text\b|passage|material|guideline|polic(?:y|ies)|explicit|sexual|appropriate|\bassist|번역|요청|내용|콘텐츠|텍스트|가이드라인|정책|지침|규정|선정적|성적|부적절/i;
// 원문 쪽은 넓게 본다 (부정 · 사과 · 거절 말이 하나라도 있으면 이 규칙을 쓰지 않는다 — 놓치면 예전과 같고, 잘못 잡으면 정상 번역이 버려진다)
// 5.3.9: 평범한 글에도 흔한 낱말(hard day · 늑대 무리 · 难过 · 判断)은 '못 한다'는 말투일 때만 본다 — 그냥 두면 진짜 거절이 번역문으로 붙었다
const SOURCE_DECLINES = new RegExp([
    REFUSAL_PATTERN.source,
    "\\b(?:not|no|never|nothing|cannot|can ?not|won't|wont|can't|cant|unfortunately|regret\\w*|sorry|apolog\\w*|unable|impossible|den(?:y|ied|ies)|reject\\w*|refus\\w*|declin\\w*|forbid\\w*|prohibit\\w*)\\b|n't\\b|n’t\\b",
    "(?:'m|’m|\\bam) afraid\\b|\\b(?:hard|difficult|tough|too much)(?=\\s*(?:[.!?,…~\"'”’)]|for me\\b|$))",
    '않|없|못|안 |아니|죄송|미안|유감|안타깝|거절|싫|불가|어렵|곤란|힘들|힘드|무리(?:야|예요|에요|입니다|이다|다|지|네|라|인|일|하|해|겠)|버거|벅차(?!오|올)|난감|곤혹',
    'ない|ません|ず[、。]|無理|断(?:る|り|ら|れ|っ|わ)|申し訳|すみません|ごめん|残念|難し|厳し|できな|出来な',
    '不|没|沒|無|无|抱歉|对不起|對不起|遗憾|遺憾|拒|[难難](?=\\s*(?:[。！？!?，,…~」』"”]|$|了|啊|吧|以|办|辦|做))',
    // 5.3.7: 원문이 '번역' 자체를 말하면 (대사 "그건 번역하기 힘들어.") 번역문에 translate 가 나오는 게 당연하다 — 거절로 보지 않는다
    // 5.3.9: 단, 부탁 · 되묻기 대사일 때만 ("통역 좀 해 줄래?"). 서술문 "She translated the letter." 의 거절은 거절이다
    "^(?=[\\s\\S]*(?:translat|번역|통역|翻訳|翻译|翻譯|通訳|通译))(?=[\\s\\S]*(?:[?？]|\\b(?:please|can you|could you|would you|will you)\\b|해 ?(?:줘|줄래|주세요|주실|달라)|して|てくれ|ください|お願い|帮|幫|请|請|一下))",
].join('|'), 'i');
function looksLikeRefusal(original, translation) {
    const source = String(original ?? '').trim();
    const output = String(translation ?? '').trim();
    // [2.0.4] 예전 버전이 번역문으로 붙였거나 캐시에 넣은 입력 차단 문구도 거절로 본다 (캐시 조회 · 자동 번역 재확인이 이 함수를 쓴다)
    if (looksLikeInputBlock(output)) return true;
    if (!output) return false;
    if (source.length >= 80 && output.length <= Math.min(700, source.length * 0.4) && REFUSAL_PATTERN.test(output.slice(0, 400))) return true;
    // 5.3.6: 짧은 대사 문단의 거절문도 캐시에 들어갔다 (80자 미만은 아예 안 봤다) — 짧은 답이 통째로 모델 목소리의 거절일 때만
    return output.length <= 300 && REFUSAL_PATTERN.test(output) && REFUSAL_TOPIC.test(output) && !SOURCE_DECLINES.test(source);
}

// [2.0.4] 중계 서버가 입력 차단을 오류가 아니라 HTTP 200 · finish=stop 의 "답"으로 돌려준다
// ("The prompt could not be submitted. The prompt contains sensitive words that violate Google's … Prohibited Use policy").
// 거절 말투 정규식에 안 걸려서 그 문장이 번역문으로 붙었다. 실제로 재 보니 이 필터는 글 내용이 아니라 요청 전체의 미세한 차이에
// 반응한다 — 같은 본문이 용어집 한 줄을 빼거나, 용어집을 프롬프트 뒤로 옮기거나, 머리말 한 줄만 붙여도 통과했다.
// 그래서 막히면 배치만 바꿔 다시 보낸다 (translate 의 PROMPT_LAYOUTS).
const INPUT_BLOCK_PATTERN = /prompt could not be submitted|contains sensitive words|Prohibited Use policy/i;

function looksLikeInputBlock(translation) {
    const output = String(translation ?? '').trim();
    return output.length > 0 && output.length <= 600 && INPUT_BLOCK_PATTERN.test(output);
}

function inputBlockError() {
    const error = new Error('Gemini 입력 필터에 막혔어요. 배치를 바꿔 다시 보내도 막혀서 번역문으로 붙이지 않았어요. 잠시 뒤 다시 번역하거나 다른 모델로 바꿔 보세요.');
    error.refused = true;
    return error;
}

// [2.1.0] 문단 나눠 보내기 · 남은 가나 정리 (순수 함수 — 테스트: backups/… /tests/chunks.test.mjs)
const BLOCKED_CHUNK_MARK = '[차단된 문단 — 원문 그대로]';
const MARK_TAIL = ' — 원문 그대로]'; // 5.2.9: 모든 실패 표시의 공통 꼬리 (재번역 판단은 이걸로)
/** 5.2.9: 실패 원인별 표시 — 예전엔 중계 오류 · 빈 답 · 형식 오류도 전부 '차단된 문단' 이라 검열로 오해했다 */
function failMarkOf(error) {
    if (!error) return BLOCKED_CHUNK_MARK;
    if (error.refused) return BLOCKED_CHUNK_MARK;
    if (error.format) return '[번역 답 형식 오류' + MARK_TAIL;
    const why = String(error.message ?? error).replace(/\s+/g, ' ').trim().slice(0, 50);
    return `[번역 실패${why ? ': ' + why : ''}${MARK_TAIL}`;
}
// 5.3.4: 429 · 5xx · 네트워크 오류만 (요청 쪽에서 transient 를 단다). 시간 초과 · 401/403 · 잘못된 키는 다시 보내지 않는다 —
//        시간 초과는 서버가 이미 처리 중이라 두 번 청구될 수 있고, 키 오류는 다시 보내도 같다.
const isTransientError = error => Boolean(error?.transient) && !error?.refused && !error?.format && !error?.cancelled && !error?.timeout;
const CHUNK_TARGET = 1800; // 한 덩이 글자 수 목표. 너무 작으면 문맥 · 말투가 흔들리고 요청이 많아진다.
const KANA_RE = /[ぁ-ゖァ-ヺ]/;
const KANA_FIX_NOTE = '[The numbered lines below are from a Korean translation but still contain Japanese. Translate each fully into Korean, keep the numbering and everything else unchanged, one line per number.]\n';

/** 빈 줄로 나눈 문단을 CHUNK_TARGET 근처로 묶는다. 자리표시자만 있는 줄은 앞 덩이에 붙인다. */
function splitForChunks(text) {
    const paragraphs = String(text ?? '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    const chunks = [];
    let current = '';
    for (const paragraph of paragraphs) {
        const onlyMask = /^(\[\[__VAR_\d+__\]\]\s*)+$/.test(paragraph);
        // 5.3.4: 열린 <p> 가 닫히기 전에는 자르지 않는다 (여는 태그와 닫는 태그가 다른 요청으로 가지 않게 · 안 닫힌 <p> 는 목표의 2배까지만)
        const openP = current.length < CHUNK_TARGET * 2 && (current.match(/<p\b[^>]*>/gi) || []).length > (current.match(/<\/p\s*>/gi) || []).length;
        if (current && !onlyMask && !openP && current.length + paragraph.length > CHUNK_TARGET) { chunks.push(current); current = ''; }
        current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
    if (current) chunks.push(current);
    return chunks;
}

/**
 * 한글이 주된 글에서 っ/ッ(끊김 표기)와 한글 사이의 ー(장음)만 지운다. 일본어가 주된 글(일본어로 번역한 경우)은 건드리지 않는다.
 * 남은 가나 낱말은 여기서 안 건드린다 — linesWithKana 가 골라 다시 번역한다.
 */
function tidyKana(text) {
    const s = String(text ?? '');
    const hangul = (s.match(/[가-힣]/g) || []).length, kana = (s.match(/[ぁ-ゖァ-ヺー]/g) || []).length; // 장음 ー 도 센다
    if (!kana || hangul <= kana) return s; // 한글이 더 많을 때만 (일본어로 번역한 글은 그대로)
    return s
        .replace(/([가-힣…!?.,」』"'”’)])[っッ]+/g, '$1')
        .replace(/(^|[\s「『"'“‘(])[っッ]+(?=[가-힣])/gm, '$1')
        .replace(/([가-힣])ー+(?=[가-힣\s…!?.,」』"'”’)]|$)/gm, '$1');
}

/** 한글이 주된 글에서 가나가 남은 줄 [index, line]. 자리표시자 · 태그만 있는 줄은 뺀다. 최대 20줄. */
function linesWithKana(text) {
    const s = String(text ?? '');
    const hangul = (s.match(/[가-힣]/g) || []).length, kana = (s.match(/[ぁ-ゖァ-ヺ]/g) || []).length;
    if (!kana || hangul <= kana) return [];
    const out = [];
    s.split('\n').forEach((line, index) => {
        if (KANA_RE.test(line) && line.trim().length <= 1200 && out.length < 20) out.push([index, line]);
    });
    return out;
}

/** 다시 번역해 온 "N. …" 줄을 제자리에 넣는다. 번호가 안 맞거나 여전히 가나가 남은 줄은 그대로 둔다. */
function applyKanaFix(text, kanaLines, fixed) {
    const lines = String(text ?? '').split('\n');
    const map = new Map();
    for (const raw of String(fixed ?? '').split('\n')) {
        const m = raw.match(/^\s*(\d+)[.)]\s?(.*)$/);
        if (m) map.set(Number(m[1]), m[2]);
    }
    // 5.3.4: 번호가 1..N 으로 딱 맞을 때만 — 두 줄을 합치고 번호를 다시 매긴 답은 한 칸씩 엉뚱한 줄에 들어갔다
    if (map.size !== kanaLines.length || kanaLines.some((_, i) => !map.has(i + 1))) return String(text ?? '');
    kanaLines.forEach(([index, line], i) => {
        const candidate = map.get(i + 1);
        if (candidate === undefined || !candidate.trim() || KANA_RE.test(candidate)) return;
        // 자리표시자 · 태그 개수가 달라지면 넣지 않는다
        const marks = v => (v.match(/\[\[__VAR_\d+__\]\]|<[^>]+>/g) || []).join('|');
        if (marks(candidate) !== marks(line)) return;
        lines[index] = line.match(/^\s*/)[0] + candidate.trim();
    });
    return lines.join('\n');
}

function refusalError(output) {
    const quote = String(output).replace(/\s+/g, ' ').trim().slice(0, 60);
    const error = new Error(`모델이 번역을 거절했어요 (「${quote}…」). 번역문으로 붙이지 않았어요.`);
    error.refused = true;
    return error;
}

/** 안전 필터에 막힌 응답이면 그 사유, 아니면 '' */
function blockedReasonOf(data) {
    const finish = String(data?.choices?.[0]?.finish_reason ?? data?.candidates?.[0]?.finishReason ?? '');
    if (/content_filter|safety|prohibited|blocklist|spii|recitation/i.test(finish)) return finish; // 5.3.0: RECITATION(원문 재현 차단)도 거절로 — 통짜 · 나누기 재시도 대상
    if (data?.promptFeedback?.blockReason) return String(data.promptFeedback.blockReason);
    const message = String(data?.error?.message ?? '');
    const blocked = /blocked due to\s*:?\s*([A-Z_]+)/i.exec(message);
    if (blocked) return blocked[1];
    if (/PROHIBITED_CONTENT|content[_ ]filter|\bSAFETY\b/i.test(message)) return message.split('\n').pop().trim().slice(0, 80);
    return '';
}

async function callLLMAPI(fullPrompt, overrides = {}) {
    const provider = extensionSettings.llm_provider;
    const messages = [{ role: 'user', content: fullPrompt }];

    if (extensionSettings.llm_prefill_toggle && overrides.prefill !== false) {
        // 프리필도 텍스트필드 값 실시간 반영
        let prefillContent = extensionSettings.llm_prefill_content || 'Understood. Here is my response:';
        const editorElement = document.getElementById('llm_prompt_editor');
        const selectElement = document.getElementById('prompt_select');
        if (editorElement && selectElement && selectElement.value === 'llm_prefill_content') {
            const currentEditorValue = editorElement.value;
            if (currentEditorValue && currentEditorValue.trim() !== '') {
                prefillContent = currentEditorValue;
            }
        }

        const role = extensionSettings.connection_mode === 'direct' && (provider === 'google' || provider === 'vertexai') ? 'model' : 'assistant';
        messages.push({ role, content: prefillContent });
    }

    if (extensionSettings.connection_mode !== 'direct') {
        const data = await requestCurrentConnection({
            context: getContext, messages, overrides, maxTokens: extensionSettings.profile_max_tokens,
            buildChat: async (settings, input) => (await createGenerationParameters(settings, getChatCompletionModel(settings), 'quiet', input)).generate_data,
            buildText: (settings, input, limit) => createTextGenGenerationData(settings, getTextGenModel(settings), createRawPrompt(input, 'textgenerationwebui', false, false, '', ''), limit || settings.max_new_tokens || 2048, false, false, null, 'quiet'),
            log: globalThis[Symbol.for('st.request-log.v1')],
        });
        return extractTranslationResult(data, 'profile');
    }
    // custom 선택 시 해당 공급자에 저장된 커스텀 모델명 사용
    const model = extensionSettings.llm_model === 'custom'
        ? getCustomModelName(provider)
        : extensionSettings.llm_model;
    const params = extensionSettings.parameters[provider];

    // API 키 검증
    let apiKey;
    let chatCompletionSource;

    switch (provider) {
        case 'openai':
            apiKey = secret_state[SECRET_KEYS.OPENAI];
            chatCompletionSource = 'openai';
            break;
        case 'claude':
            apiKey = secret_state[SECRET_KEYS.CLAUDE];
            chatCompletionSource = 'claude';
            break;
        case 'google':
            apiKey = secret_state[SECRET_KEYS.MAKERSUITE];
            chatCompletionSource = 'makersuite';
            break;
        case 'cohere':
            apiKey = secret_state[SECRET_KEYS.COHERE];
            chatCompletionSource = 'cohere';
            break;
        case 'vertexai':
            apiKey = secret_state[SECRET_KEYS.VERTEXAI] || secret_state[SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT];
            chatCompletionSource = 'vertexai';
            break;
        case 'openrouter':
            apiKey = secret_state[SECRET_KEYS.OPENROUTER];
            chatCompletionSource = 'openrouter';
            break;
        case 'deepseek': // [추가] OpenRouter 분기
            apiKey = secret_state[SECRET_KEYS.DEEPSEEK];
            chatCompletionSource = 'deepseek';
            break;
        case 'custom': // [추가] Custom (OpenAI-compatible) 분기
            apiKey = secret_state[SECRET_KEYS.CUSTOM];
            chatCompletionSource = 'custom';
            break;
        default:
            throw new Error('지원되지 않는 공급자입니다.');
    }

    // [추가] 커스텀 모델 입력을 골라놓고 모델명이 비어 있으면 API가 엉뚱한 오류를 뱉으므로 먼저 막는다.
    if (extensionSettings.llm_model === 'custom' && !model) {
        throw new Error(`커스텀 모델명이 비어 있습니다. ${provider} 공급자에 사용할 모델명을 입력해주세요.`);
    }

    // [추가] Custom은 API 키 없이 동작하는 서버(로컬 등)가 많으므로 키 대신 주소를 검증한다.
    if (provider === 'custom') {
        if (!getCustomEndpointConfig().url) {
            throw new Error('커스텀 엔드포인트 주소가 설정되어 있지 않습니다. (예: http://127.0.0.1:5001/v1)');
        }
    } else if (!apiKey && !extensionSettings.use_reverse_proxy) {
        throw new Error(`${provider.toUpperCase()} API 키가 설정되어 있지 않습니다.`);
    }

    const parameters = {
        model,
        messages,
        temperature: params.temperature,
        stream: false,
        chat_completion_source: chatCompletionSource,
        ...getProviderSpecificParams(provider, params)
    };

    if (params.max_length > 0) {
        parameters.max_tokens = params.max_length;
    }
    // [1.8.7] 호출별 덮어쓰기 (용어집 뽑기: 짧은 출력·낮은 온도)
    if (Number.isFinite(overrides.maxTokens) && overrides.maxTokens > 0) parameters.max_tokens = overrides.maxTokens;
    if (Number.isFinite(overrides.temperature)) parameters.temperature = overrides.temperature;

    applyModelRequestRules(provider, model, parameters);

    if (provider === 'vertexai') {
        // [수정] 본체의 Vertex AI 접속 설정(인증 방식/리전/Express 프로젝트)을 그대로 따라간다.
        // 리전을 보내지 않으면 서버가 us-central1로 고정하므로, global 리전에만 배포된
        // 모델을 쓰면 "Publisher model ... was not found" 404가 난다.
        parameters.vertexai_auth_mode = oai_settings?.vertexai_auth_mode || 'full';
        parameters.vertexai_region = oai_settings?.vertexai_region || 'us-central1';
        parameters.vertexai_express_project_id = oai_settings?.vertexai_express_project_id || '';
    }

    // [추가] Custom (OpenAI-compatible): 서버는 custom_url을 기준으로 요청을 보낸다.
    if (provider === 'custom') {
        const customConfig = getCustomEndpointConfig();
        parameters.custom_url = customConfig.url;

        // 확장에 별도 주소를 넣지 않았다면 본체의 추가 헤더/Body 설정도 함께 사용
        if (customConfig.inheritExtras) {
            parameters.custom_include_body = substituteParams(oai_settings?.custom_include_body || '');
            parameters.custom_exclude_body = substituteParams(oai_settings?.custom_exclude_body || '');
            parameters.custom_include_headers = substituteParams(oai_settings?.custom_include_headers || '');
        }
    }

    if (extensionSettings.use_reverse_proxy) {
        parameters.reverse_proxy = extensionSettings.reverse_proxy_url;
        parameters.proxy_password = extensionSettings.reverse_proxy_password;
    }

    let response;
    // [1.8.7] 호출별 제한 시간 (중계 서버 앞의 Cloudflare 는 100초에 524로 끊는다)
    const controller = new AbortController();
    const timeoutMs = overrides.timeoutMs > 0 ? overrides.timeoutMs : 90000;
    const abort = () => controller.abort(overrides.signal?.reason);
    overrides.signal?.addEventListener('abort', abort, { once: true });
    if (overrides.signal?.aborted) abort();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    let responseBody;
    try {
        response = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST',
            headers: { ...getRequestHeaders(), 'Content-Type': 'application/json' },
            requestLog:{caller:'llm-translator-custom',purpose:overrides.requestPurpose||'translation.chat'},
            body: JSON.stringify(parameters),
            signal: controller?.signal,
        });
        responseBody = await response.text();
    } catch (fetchError) {
        if (overrides.signal?.aborted) throw overrides.signal.reason;
        if (fetchError?.name === 'AbortError') { // 5.3.4: 시간 초과는 다시 보내지 않는다 (timeout — isTransientError)
            throw Object.assign(new Error(`${Math.round(timeoutMs / 1000)}초 안에 답이 없어 끊었어요. 요청을 더 작게 나누거나 잠시 뒤 다시 해 주세요.`), { timeout: true });
        }
        // 네트워크 에러 처리
        if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
            throw Object.assign(new Error('네트워크 연결에 실패했습니다. 인터넷 연결을 확인해주세요.'), { transient: true });
        }
        throw Object.assign(new Error(`요청 실패: ${fetchError.message}`), { transient: fetchError?.name === 'TypeError' });
    } finally {
        clearTimeout(timeoutHandle);
        overrides.signal?.removeEventListener('abort', abort);
    }

    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;

        try {
            const errorData = JSON.parse(responseBody);
            if (errorData.error && errorData.error.message) {
                errorMessage = errorData.error.message;
            } else if (errorData.message) {
                errorMessage = errorData.message;
            } else {
                errorMessage = response.statusText || errorMessage;
            }
        } catch (e) {
            errorMessage = response.statusText || errorMessage;
        }

        // 상태 코드별 구체적인 메시지 — 5.3.4: 429 · 5xx 만 transient (한 번 더 보냄). 524 는 서버가 아직 처리 중일 수 있어 시간 초과로 본다
        const flags = response.status === 524 ? { timeout: true } : { transient: response.status === 429 || response.status >= 500 };
        switch (response.status) {
            case 401:
                throw new Error('API 키가 잘못되었거나 권한이 없습니다.');
            case 403:
                throw new Error('API 접근이 거부되었습니다. API 키 권한을 확인해주세요.');
            case 429:
                throw Object.assign(new Error('API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'), flags);
            case 500:
                throw Object.assign(new Error('서버 내부 오류가 발생했습니다.'), flags);
            case 503:
                throw Object.assign(new Error('서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.'), flags);
            default:
                throw Object.assign(new Error(errorMessage), flags);
        }
    }

    // [1.8.7] 중계 서버가 늦으면 Cloudflare 가 JSON 대신 HTML 오류 페이지(524)를 준다 — 그걸 "빈 응답"으로 뭉개지 않고 알려 준다
    const rawText = responseBody;
    let data;
    try {
        data = JSON.parse(rawText);
    } catch {
        if (/cloudflare|<!doctype html|<html/i.test(rawText)) {
            const code = /error code:?\s*(\d{3})|errorcode_(\d{3})/i.exec(rawText);
            const status = code ? (code[1] || code[2]) : '';
            // 5.3.6: 상태 코드 없는 HTML 은 다시 보내지 않는다 — 시간 초과 페이지일 수 있고, 그러면 서버가 아직 처리 중이라 두 번 청구된다
            throw Object.assign(new Error(`중계 서버가 제때 답하지 않아 Cloudflare 가 끊었어요${status ? ` (${status})` : ''}. 잠시 뒤 다시 하거나 요청을 줄여 주세요.`), status === '524' ? { timeout: true } : { transient: /^(?:429|50[0-3]|529)$/.test(status) });
        }
        throw new Error(`서버 응답을 읽을 수 없어요: ${rawText.slice(0, 80)}`);
    }
    return extractTranslationResult(data, provider);
}

// 결과 추출 로직 분리  
function extractTranslationResult(data, provider) {
    // [1.9.0] 막힌 응답: 중간에 끊긴 번역도 붙이지 않는다
    const blocked = blockedReasonOf(data);
    if (blocked) {
        const error = new Error(`안전 필터에 막혀 번역이 오지 않았어요 (${blocked}). 모델 쪽에서 이 내용을 거절한 거예요.`);
        error.refused = true;
        throw error;
    }
    let result;
    switch (provider) {
        case 'profile': {
            const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ??
                data.results?.[0]?.text ?? data.candidates?.[0]?.content ?? data.message?.content ??
                data.content ?? data.generations?.[0]?.text ?? data.text;
            result = (typeof content === 'string' ? content :
                Array.isArray(content) ? content.filter(p => !p.type || p.type === 'text').map(p => p.text || '').join('') :
                content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '').trim();
            break;
        }
        case 'openai':
        case 'openrouter':
        case 'deepseek':
        case 'custom':
            result = data.choices?.[0]?.message?.content?.trim();
            break;
        case 'claude':
            // 최신 Claude는 thinking 블록이 앞에 올 수 있으므로 text 블록만 모은다.
            result = (Array.isArray(data.content)
                ? data.content.filter(part => part?.type === 'text').map(part => part.text).join('')
                : '').trim() || data.content?.[0]?.text?.trim();
            break;
        case 'google':
            result = data.candidates?.[0]?.content?.trim() ||
                data.choices?.[0]?.message?.content?.trim() ||
                data.text?.trim();
            break;
        case 'cohere':
            result = data.message?.content?.[0]?.text?.trim() ||
                data.generations?.[0]?.text?.trim() ||
                data.text?.trim() ||
                data.choices?.[0]?.message?.content?.trim() ||
                data.content?.[0]?.text?.trim();
            break;
        case 'vertexai':
            result = data.candidates?.[0]?.content?.trim() ||
                data.choices?.[0]?.message?.content?.trim() ||
                data.text?.trim();
            break;
    }

    if (!result) {
        // [1.9.0] 실리태번이 200 과 함께 넘겨준 오류 문구가 있으면 그걸 보여 준다
        // [1.9.1] 실리태번은 사용자 지정(OpenAI 호환) 서버의 오류 본문을 버리고 상태 문구만 넘긴다. 중계 서버 는 Gemini 입력 차단을
        //         400 {"message":"request blocked by Gemini API: PROHIBITED_CONTENT"} 로 주는데 여기엔 "Bad Request" 만 온다 (2026-09-16 확인).
        if (/^bad request$/i.test(String(data?.error?.message ?? '').trim())) {
            const error = new Error('요청이 거절됐어요 (400 Bad Request). 보통 Gemini 가 이 메시지 내용을 차단한 경우예요 (PROHIBITED_CONTENT) — 같은 내용은 다시 해도 막혀요.');
            error.refused = true;
            throw error;
        }
        if (data?.error?.message) throw new Error(`API 오류: ${String(data.error.message).slice(0, 200)}`);
        throw new Error(`번역 응답이 비어있습니다. ${provider.toUpperCase()} API에서 올바른 응답을 받지 못했습니다.`);
    }
    return result;
}

/**
 * [추가됨] 스마트 보정 함수 (Smart Fix)
 * LLM이 마스킹 패턴을 번역하거나 변형했을 경우, 원본 패턴으로 복구합니다.
 */
function fixMalformedPlaceholders(text) {
    if (!text) return '';

    let fixedText = text;

    // 1. 공백 허용 복구 ([[  __VAR_0__  ]] -> [[__VAR_0__]])
    // LLM이 괄호 사이에 공백을 넣는 경우가 가장 흔함
    fixedText = fixedText.replace(/\[\[\s*__VAR_(\d+)__\s*\]\]/g, '[[__VAR_$1__]]');

    // 2. 'VAR'가 '변수'로 번역된 경우 복구 ([[__변수_0__]])
    fixedText = fixedText.replace(/\[\[\s*__변수_(\d+)__\s*\]\]/g, '[[__VAR_$1__]]');

    // 3. 'VAR'가 'VARIABLE'로 확장된 경우 복구
    fixedText = fixedText.replace(/\[\[\s*__VARIABLE_(\d+)__\s*\]\]/g, '[[__VAR_$1__]]');

    // 4. 소문자 'var'로 바뀐 경우 복구
    fixedText = fixedText.replace(/\[\[\s*__var_(\d+)__\s*\]\]/g, '[[__VAR_$1__]]');

    return fixedText;
}

function connectionSignature() {
    const c = getContext(), s = extensionSettings;
    return JSON.stringify({ mode: s.connection_mode, provider: s.llm_provider, model: s.llm_model,
        custom: s.custom_models, parameters: s.parameters, url: s.custom_url,
        proxy: [s.use_reverse_proxy, s.reverse_proxy_url, s.reverse_proxy_password],
        prefill: [s.llm_prefill_toggle, s.llm_prefill_content, document.querySelector('#prompt_select')?.value === 'llm_prefill_content' ? document.querySelector('#llm_prompt_editor')?.value : null],
        inherited: s.connection_mode === 'direct' ? {
            custom: s.llm_provider === 'custom' && getCustomEndpointConfig().inheritExtras ?
                [oai_settings.custom_url, oai_settings.custom_include_body, oai_settings.custom_exclude_body, oai_settings.custom_include_headers] : null,
            vertex: s.llm_provider === 'vertexai' ? [oai_settings.vertexai_auth_mode, oai_settings.vertexai_region, oai_settings.vertexai_express_project_id] : null,
        } : null,
        limit: s.profile_max_tokens, api: c.mainApi,
        connection: s.connection_mode === 'direct' ? null : activeConnectionFields(c) });
}

// 현재 연결 모드에서 번역 결과에 닿는 값만 (예전엔 oai_settings 전체 — 프롬프트 본문까지 — 가 들어가 프롬프트 하나만 껐다 켜도
// 문단 캐시가 전부 무효였고, 100ms 감시가 프리셋 전체를 문자열화했고, 응답 설정 창만 건드려도 번역이 멈췄다). 비밀번호는 값이 아니라 유무만.
function activeConnectionFields(c) {
    try {
        if (c.mainApi === 'openai') {
            const o = c.chatCompletionSettings || {};
            let model = ''; try { model = getChatCompletionModel(o); } catch { model = o[`${o.chat_completion_source}_model`] ?? ''; }
            return [o.chat_completion_source, model, o.custom_url, o.reverse_proxy, Boolean(o.proxy_password), o.temperature, o.top_p, o.top_k,
                o.frequency_penalty, o.presence_penalty, o.openai_max_tokens, o.openai_max_context];
        }
        if (c.mainApi === 'textgenerationwebui') {
            const t = c.textCompletionSettings || {};
            let model = ''; try { model = getTextGenModel(t); } catch { model = t.model ?? ''; }
            return [t.type, model, t.server_urls?.[t.type] ?? t.api_server ?? null, t.max_length];
        }
    } catch { /* 아래 */ }
    return [c.mainApi];
}

// 통합된 번역 함수 (고정 패턴 + 스마트 보정 적용 + 프롬프트/매크로 로직 복구)
async function translate(text, options = {}) {
    const chatGuard = guards.capture();
    const connection = connectionSignature();
    const watcher = watchGuard(() => {
        chatGuard.assert(); options.assertValid?.();
        if (connectionSignature() !== connection) throw Object.assign(new Error('번역 연결이나 모델 설정이 바뀌어 멈췄어요. 같은 설정으로 다시 번역하면 저장한 문단부터 이어가요.'), { cancelled: true });
    }, 500); // 5.3.4: 100ms → 500ms (매번 연결 설정을 문자열화한다. 단계마다 check() 도 따로 부른다)
    const request = async prompt => {
        watcher.check();
        const result = await callLLMAPI(prompt, { signal: watcher.signal });
        watcher.check(); return result;
    };
    try {
        if (!text || text.trim() === '') {
            return '';
        }

        // ==================================================================================
        // [신규 기능 유지] 1. 번역 전 보호할 텍스트 마스킹 (Masking)
        // ==================================================================================
        const regexes = getCombinedRegexes();
        const protectedBlocks = [];
        let maskedText = text;

        // 고정된 상수 패턴 사용
        const createPlaceholder = (index) => {
            return MASK_PATTERN.replace('{index}', index);
        };

        regexes.forEach(regex => {
            maskedText = maskedText.replace(regex, (match) => {
                // 현재 보호되는 블록의 인덱스를 사용하여 플레이스홀더 생성
                const placeholder = createPlaceholder(protectedBlocks.length);
                protectedBlocks.push(match);
                return placeholder;
            });
        });

        // [디버그: 마스킹 추적] 원문에서 기대하는 마스킹 개수 저장
        const expectedMaskCount = protectedBlocks.length;

        // ==================================================================================
        // [기존 로직 복구] 2. 옵션 및 프롬프트 선택 로직 (UI 실시간 반영)
        // ==================================================================================
        const {
            prompt = extensionSettings.llm_prompt_chat,
            additionalGuidance = '',
            isInputTranslation = false,
            isRetranslation = false
        } = options;

        // 커스텀 프롬프트 적용 (실시간 텍스트필드 값 사용)
        let finalPrompt = prompt;

        // 채팅 번역 프롬프트인 경우, 텍스트필드의 현재 값을 실시간 반영
        if (prompt === extensionSettings.llm_prompt_chat) {
            const editorElement = document.getElementById('llm_prompt_editor');
            const selectElement = document.getElementById('prompt_select');

            // 텍스트필드의 현재 값을 사용 (저장하지 않아도 번역에 반영됨)
            if (editorElement && selectElement) {
                const selectedValue = selectElement.value;
                const currentEditorValue = editorElement.value;

                // 1. 채팅 번역 프롬프트가 선택되어 있는 경우
                if (selectedValue === 'llm_prompt_chat') {
                    if (currentEditorValue && currentEditorValue.trim() !== '') {
                        finalPrompt = currentEditorValue;
                    }
                }
                // 2. 커스텀 프롬프트가 선택되어 있는 경우
                else if (extensionSettings.selected_translation_prompt_id === selectedValue) {
                    if (currentEditorValue && currentEditorValue.trim() !== '') {
                        finalPrompt = currentEditorValue;
                    }
                }
            }
        }

        // ==================================================================================
        // [기존 로직 복구] 3. 플레이스홀더 치환 및 프롬프트 조립
        // ==================================================================================
        
        // 커스텀 플레이스홀더 치환 ({{llmContext}} 등)
        finalPrompt = substituteCustomPlaceholders(finalPrompt, isInputTranslation);

        // 규칙 프롬프트 로드 (채팅별 메타데이터)
        let rulePrompt = '';
        if (!isInputTranslation) {
            const context = getContext();
            if (context && context.chatMetadata) {
                rulePrompt = context.chatMetadata[RULE_PROMPT_KEY] || '';
            }
        }

        // [1.8.0] 용어집: 원문에 실제로 나오는 항목만 골라 프롬프트 앞에 붙인다 (보내기·입력 번역은 방향을 뒤집어서)
        const glossaryBlock = buildGlossaryBlock(text, { reverse: isInputTranslation });
        const paragraphParts = options.segmentCache && !isInputTranslation && !isRetranslation && !options.noChunks ? segmentParagraphs(maskedText) : null;

        // [2.0.4] 배치 0 = 예전 그대로. 1 · 2 는 입력 필터에 막혔을 때만 쓰는 다시 보내기용 (내용은 같고 순서 · 머리말만 다르다)
        const buildFullPrompt = (layout, body = maskedText) => {
            let built = finalPrompt;

            // 규칙 프롬프트 추가
            if (rulePrompt && rulePrompt.trim()) {
                built = `[Additional Rules]:\n${rulePrompt}\n\n${finalPrompt}`;
            }

            const terms = paragraphParts ? buildGlossaryBlock(body, { reverse: false }) : glossaryBlock;
            if (terms) {
                built = layout === 1 ? `${built}\n\n${terms}` : `${terms}\n\n${built}`;
            }
            if (layout === 2) built = `[Fiction translation request]\n\n${built}`;

            // 추가 지침(가이던스) 추가
            if (additionalGuidance && additionalGuidance.trim()) {
                built += `\n\n[Additional Guidance]:\n${additionalGuidance}`;
            }

            // 마스킹된 텍스트를 AI에게 전달
            built += `\n\n${body}`;

            // 플레이스홀더 치환 (커스텀 먼저, 기본 매크로 다음)
            built = substituteCustomPlaceholders(built, isInputTranslation);
            return substituteParams(built);
        };
        const PROMPT_LAYOUTS = (paragraphParts || glossaryBlock) ? [0, 1, 2] : [0, 2];
        const chunks = !isInputTranslation && !isRetranslation && !options.noChunks ? splitForChunks(maskedText) : [];
        // 프롬프트는 처음 쓸 때 한 번만 만든다 (예전엔 모든 문단 × 3 배치를 캐시 조회 전에 미리 만들어 용어집 검색 · 매크로 치환이 수백 번 돌았다).
        // 채팅이 바뀐 뒤에는 만들지 않는다 (다른 채팅의 매크로가 들어가지 않게 watcher 가 먼저 멈춘다).
        const built = new Map();
        const prepared = { get(body) { if (!built.has(body)) { watcher.check(); built.set(body, PROMPT_LAYOUTS.map(layout => buildFullPrompt(layout, body))); } return built.get(body); } };
        // 문단 캐시 · 이어하기 키의 서명: 준비된 프롬프트 전체 대신 연결 · 프롬프트 · 지침 · 용어집(범위 + 항목) 요약 하나 (paragraph-v2)
        const chatCtx = getContext();
        const setupDigest = await checkpointKey(JSON.stringify([connection, finalPrompt, rulePrompt, additionalGuidance, extensionSettings.glossary_enabled === false ? null
            : [chatCtx?.groupId ?? null, chatCtx?.characters?.[chatCtx?.characterId]?.avatar ?? null, extensionSettings.glossary_entries ?? null]]));
        const key = chunks.length > 1 ? await checkpointKey(JSON.stringify([setupDigest, text])) : '';
        watcher.check();
        // 5.4.2: 번역문 삭제 — 이 글의 문단 캐시 · 이어하기 줄만 지우고 요청은 하지 않는다 (키는 번역할 때와 같은 재료로)
        if (options.forget) {
            if (paragraphParts) await forgetSegments(paragraphParts, () => setupDigest);
            if (key) await clearCheckpoints(key);
            return '';
        }

        // ==================================================================================
        // 4. API 호출 및 결과 처리 (신규 기능 포함)
        // ==================================================================================

        // API 호출 — 차단이면 배치를 바꿔 가며, 그래도 막히면 문단을 나눠서
        const { onProgress = null, report = null } = options;
        const progress = (info) => { try { onProgress?.(info); } catch { /* 표시용 */ } };
        /** 한 덩어리를 배치 순서대로 보낸다. 끝까지 막히면 refused 오류를 던진다. */
        const callWithLayouts = async (body, layouts) => {
            let out = '';
            for (const layout of layouts) {
                const last = layout === layouts.at(-1);
                // [2.0.6] 중계가 400 prompt_blocked / PROHIBITED_CONTENT 로 끊어도(refused 오류) 같은 이유로 배치를 바꿔 본다 —
                //         2.0.4 는 200 으로 오는 차단 문구만 다시 보냈고, 400 은 곧장 오류로 냈다. 실제로 같은 글이 배치 1 로는 통과했다.
                try {
                    out = await request(prepared.get(body)?.[PROMPT_LAYOUTS.indexOf(layout)] ?? buildFullPrompt(layout, body));
                } catch (error) {
                    if (!error?.refused || last) throw error;
                    console.warn(`[LLM Translator] 요청이 차단됨 (배치 ${layout}) — 배치를 바꿔 다시 보내요:`, error.message);
                    continue;
                }
                if (!looksLikeInputBlock(out)) break;
                console.warn(`[LLM Translator] 입력 필터에 막힘 (배치 ${layout})${last ? '' : ' — 배치를 바꿔 다시 보내요'}`);
            }
            if (looksLikeInputBlock(out)) throw inputBlockError();
            // [1.9.0] 거절문은 번역문이 아니다 — 여기서 던지면 붙이지도 캐시에 넣지도 않는다 (마스킹된 원문끼리 길이를 견준다)
            // 5.2.9: 묶음 머리말은 원문이 아니다 — 머리말을 뺀 길이로 견준다 (머리말 탓에 짧은 묶음의 정상 번역이 거절로 오인됐다)
            if (looksLikeRefusal(body.startsWith(BATCH_HEADER) ? body.slice(BATCH_HEADER.length) : body, out)) throw refusalError(out);
            return out;
        };

        let checkpointComplete = false;
        const runChunks = async () => {
            const result = await translateChunks({ key, chunks, check: watcher.check, progress,
                request: async body => restoreParagraphBreaks(body, await callWithLayouts(body, PROMPT_LAYOUTS.slice(0, 2))), blockedMarker: BLOCKED_CHUNK_MARK });
            if (report) { report.partial = result.blocked > 0; report.blockedChunks = result.blocked; report.chunks = result.total; }
            checkpointComplete = result.blocked === 0;
            return result.text;
        };
        let translatedText = '';
        if (paragraphParts) {
            // 묶음의 원문 글자 수는 출력 한도도 따른다 — 직접 연결 기본 max_length 1000 토큰에 3600자를 보내면 JSON 답이 잘렸다.
            // 답 글자 수 ≈ 원문 글자 수, 토큰당 ≈1.2자로 잡아 한도의 1.2배까지만 묶는다 (max_tokens 를 키우면 모델 한도 400 이 날 수 있어 묶음을 줄이는 쪽).
            const s = extensionSettings, live = getContext();
            const outputTokens = s.connection_mode === 'direct' ? Number(s.parameters?.[s.llm_provider]?.max_length) || 0
                : Number(s.profile_max_tokens) || (live?.mainApi === 'openai' ? Number(live.chatCompletionSettings?.openai_max_tokens) : Number(live?.textCompletionSettings?.max_length)) || 0;
            const groupLimit = outputTokens > 0 ? Math.min(CHUNK_TARGET * 2, Math.max(400, Math.round(outputTokens * 1.2))) : CHUNK_TARGET * 2;
            const failReasons = new Map(); // 5.2.9: 문단 본문 → 실패 원인
            const noCache = new Set(); // 5.3.4: 붙이긴 하되 캐시에 넣지 않을 문단 (1부터 다시 매긴 답 — 한 칸 밀린 답과 구별이 안 된다)
            const result = await translateSegments({ parts: paragraphParts,
                signature: () => setupDigest, check: watcher.check, progress, blockedMarker: (body, error) => failMarkOf(failReasons.get(body) ?? error), // 5.4.1: 원문 되풀이 = 형식 오류
                cacheable: (body, out) => {
                    const marks = value => JSON.stringify(value.match(/\[\[__VAR_\d+__\]\]/g) || []);
                    // 5.3.4: 묶음 중 한 문단만 거절문으로 온 경우도 30일 캐시에 넣지 않는다
                    return marks(body) === marks(out) && !linesWithKana(out).length && !looksLikeRefusal(body, out) && !noCache.has(body);
                },
                request: async bodies => {
                    const translated = [];
                    let failed = null, succeeded = 0, splits = 0;
                    failReasons.clear(); noCache.clear();
                    // 5.1.5: 묶음이 거절되면 그 자리에서 반으로 나눠 다시 보낸다 — 사용자가 화살표로 다시 번역하면
                    // 통과하던 것과 같은 작은 요청이다. 문단 하나까지 막히면 그 문단만 null(차단 표시). 나누기는 메시지당 SPLIT_CAP 번까지.
                    const SPLIT_CAP = 6;
                    const translateGroup = async (group, layouts = PROMPT_LAYOUTS, retried = false) => {
                        watcher.check();
                        try {
                            const meta = {};
                            const out = parseBatchResult(await callWithLayouts(batchPayload(group), layouts), group.length, meta, group).map(tidyKana); // 5.3.7: 원문 문단과 견줘 꼬리 메모를 걷는다
                            if (meta.renumbered) for (const body of group) noCache.add(body);
                            succeeded++;
                            return out;
                        } catch (caught) {
                            let error = caught;
                            if (error?.cancelled) throw error;
                            // 5.2.9: 중계 429 · 5xx · 네트워크 같은 일시 오류는 1.5초 뒤 한 번 더 — 예전엔 곧장 '차단된 문단' 으로 남았다
                            if (!retried && isTransientError(error)) {
                                console.warn('[LLM Translator] 묶음 요청 오류 — 잠시 뒤 한 번 더 보내요:', error.message);
                                await new Promise(resolve => setTimeout(resolve, 1500)); watcher.check();
                                return translateGroup(group, layouts, true);
                            }
                            // 5.2.6: 답 형식이 안 맞으면(번호 표시를 빼먹음 · 문단을 합침) 거절이 아니다 — 번호 없이 통짜로 한 번 더 보낸다 (화살표 재번역과 같은 요청).
                            //        문단 수가 같으면 자리별로 붙이고 캐시에 넣는다. 전엔 '차단된 문단' 으로 남아 SFW 글이 검열된 것처럼 보였다.
                            // 5.3.0: 거절도 마찬가지로 통짜를 먼저 — 사용자가 화살표로 다시 번역하면 통과하던 것은 번호 표시 · 머리말이 없는 이 요청이다.
                            //        (Gemini 입력 필터는 글 내용보다 요청 모양에 반응한다 — looksLikeInputBlock 주석) 통짜도 막히면 그때 반으로 나눈다.
                            if (error?.format || (error?.refused && group.length > 0)) {
                                console.warn(`[LLM Translator] 묶음이 ${error.format ? '형식 오류' : '거절'}라 번호 없이 통짜로 다시 보내요:`, error.message);
                                try {
                                    // 5.3.4: 머리말 · 꼬리 메모를 걷고, 줄 단위로 온 답은 빈 줄을 되살린 뒤 문단을 센다 (전엔 한 문단으로 보고 괜히 반으로 나눴다)
                                    const joinedGroup = group.join('\n\n');
                                    const plain = restoreParagraphBreaks(joinedGroup, stripReplyWrapping(await callWithLayouts(joinedGroup, error.format ? PROMPT_LAYOUTS.slice(0, 1) : layouts), joinedGroup)); // 5.3.6: 원문과 견줘 걷는다
                                    const paras = plain.split(/\n[\t ]*\n(?:[\t ]*\n)*/).map(p => p.trim()).filter(Boolean);
                                    if (paras.length === group.length) { succeeded++; return paras.map(tidyKana); }
                                    if (group.length === 1 && plain.trim()) { succeeded++; return [tidyKana(plain.trim())]; }
                                    console.warn(`[LLM Translator] 통짜 답의 문단 수(${paras.length})가 원문(${group.length})과 달라 ${group.length > 1 ? '나눠서 보내요' : '원문으로 남겨요'}`);
                                    if (error.format) error = Object.assign(Error(`통짜 답의 문단 수(${paras.length})가 원문(${group.length})과 달라요`), { format: true });
                                } catch (again) { if (again?.cancelled) throw again; error = again; }
                            }
                            if (group.length > 1 && error?.refused && splits < SPLIT_CAP) { // 형식 오류는 나눠도 안 낫고 요청만 는다 — 거절만
                                splits++;
                                console.warn(`[LLM Translator] 묶음(${group.length}문단)이 막혀 반으로 나눠 다시 보내요:`, error.message);
                                const mid = Math.ceil(group.length / 2);
                                // 나눈 조각은 배치 하나로만 — 조각마다 배치 3개를 돌리면 요청이 최대 39회까지 불어난다 (배치 1개면 15회)
                                const half = PROMPT_LAYOUTS.slice(0, 1);
                                return [...await translateGroup(group.slice(0, mid), half), ...await translateGroup(group.slice(mid), half)];
                            }
                            // 문단 하나까지 막힘 · 나누기 상한 · 그 밖의 오류: 그 문단들 자리만 null. 전부 실패하면 예전처럼 오류
                            failed ??= error;
                            for (const body of group) failReasons.set(body, error); // 5.2.9: 자리마다 원인 (표시 문구용)
                            return group.map(() => null);
                        }
                    };
                    for (const group of batchGroups(bodies, groupLimit)) translated.push(...await translateGroup(group));
                    if (failed && !succeeded) throw failed;
                    if (failed) {
                        const count = translated.filter(text => text === null).length;
                        console.warn('[LLM Translator] 일부 묶음 실패 — 그 문단만 원문으로 남겨요:', failed.message);
                        // 5.2.9: 폰에서는 콘솔을 못 보니 원인을 알림으로 (거절 · 형식 · 오류 구분)
                        if (globalThis.toastr) toastr.warning(`${failed.refused ? '모델이 거절해서' : failed.format ? '답 형식이 맞지 않아' : '요청 오류로'} 문단 ${count}개를 원문으로 남겼어요 — ${String(failed.message).slice(0, 120)}`, 'LLM 번역', { timeOut: 9000 });
                    }
                    // Any remaining Japanese is repaired in one additional request for the whole batch.
                    const joined = translated.map(text => text ?? '').join('\n\n'), lines = linesWithKana(joined);
                    if (lines.length) {
                        try {
                            const fixed = await request(buildFullPrompt(0, KANA_FIX_NOTE + lines.map(([, line], i) => `${i + 1}. ${line}`).join('\n')));
                            const corrected = applyKanaFix(joined, lines, fixed).split('\n');
                            let offset = 0;
                            for (let i = 0; i < translated.length; i++) {
                                const length = (translated[i] ?? '').split('\n').length;
                                if (translated[i] !== null) translated[i] = corrected.slice(offset, offset + length).join('\n');
                                offset += length + 1;
                            }
                        } catch (error) { if (error?.cancelled) throw error; }
                    }
                    return translated;
                },
            });
            translatedText = result.text;
            if (report) { report.reusedParagraphs = result.reused; report.translatedParagraphs = result.translated; report.partial = result.blocked > 0; report.blockedChunks = result.blocked; report.chunks = result.total; }
        } else if (maskedText.length > CHUNK_TARGET * 2 && chunks.length > 1) {
            translatedText = await runChunks();
        } else {
            progress({ stage: 'whole' });
            try { translatedText = restoreParagraphBreaks(maskedText, await callWithLayouts(maskedText, PROMPT_LAYOUTS)); } // 5.2.4 빠진 문단 빈 줄 되살리기
            catch (error) {
                if (!error?.refused || chunks.length < 2) throw error;
                translatedText = await runChunks();
            }
        }

        // [2.1.0] 한국어 번역문에 남은 가나 정리: っ · ー 는 지우고, 일본어가 통째로 남은 줄만 한 번 더 보낸다 (프롬프트로는 100% 안 막힌다)
        translatedText = tidyKana(translatedText);
        const kanaLines = paragraphParts ? [] : linesWithKana(translatedText);
        if (kanaLines.length) {
            progress({ stage: 'kana' });
            try {
                const fixed = await request(buildFullPrompt(0, KANA_FIX_NOTE + kanaLines.map(([, line], i) => `${i + 1}. ${line}`).join('\n')));
                translatedText = applyKanaFix(translatedText, kanaLines, fixed);
            } catch (kanaError) {
                if (kanaError?.cancelled) throw kanaError;
                console.warn('[LLM Translator] 남은 일본어 다시 번역 실패 — 그대로 둬요:', kanaError?.message);
            }
        }

        // [디버그: 마스킹 추적] 1. 순수 번역문(Raw) 상태에서의 마스킹 개수 확인
        let rawMaskCount = 0;
        if (DEBUG_MODE && expectedMaskCount > 0) {
            try {
                // [[__VAR_숫자__]] 패턴 카운트
                const rawMatches = translatedText.match(/\[\[__VAR_\d+__\]\]/g);
                rawMaskCount = rawMatches ? rawMatches.length : 0;
            } catch (e) { console.error('[Debug] Raw mask counting error', e); }
        }

        // [신규 기능 유지] 1차 수리: LLM이 망가뜨린 패턴 복구 (Smart Fix)
        translatedText = fixMalformedPlaceholders(translatedText);

        // [디버그: 마스킹 추적] 2. 보정 후(Fixed) 상태에서의 마스킹 개수 확인 및 로그 출력
        if (DEBUG_MODE && expectedMaskCount > 0) {
            try {
                const fixedMatches = translatedText.match(/\[\[__VAR_\d+__\]\]/g);
                const fixedMaskCount = fixedMatches ? fixedMatches.length : 0;
                
                const statusIcon = expectedMaskCount === fixedMaskCount ? '✅' : '⚠️';
                const recoverIcon = rawMaskCount !== fixedMaskCount ? '🛠️Fixed' : '-';

                console.groupCollapsed(`[LLM Translator Mask Debug] ${statusIcon} Match: ${fixedMaskCount}/${expectedMaskCount}`);
                console.log(`Original(Expected): ${expectedMaskCount}`);
                console.log(`LLM Raw Output  : ${rawMaskCount}`);
                console.log(`After SmartFix  : ${fixedMaskCount} (${recoverIcon})`);
                
                if (expectedMaskCount !== fixedMaskCount) {
                    console.warn('Mask count mismatch! Some protected blocks might be lost or duplicated.');
                    console.log('Raw Text:', translatedText);
                }
                console.groupEnd();
            } catch (e) { console.error('[Debug] Fixed mask counting error', e); }
        }

        // [신규 기능 유지] 2차 수리: 번역 후 보호된 텍스트 복구 (Unmasking)
        // [1.9.2] 뒤 번호부터 되돌린다: 나중 정규식이 앞서 가린 자리표시자를 품은 블록을 가리면(예: 사용자 <status>…</status> 안의 <think>)
        //         앞 번호부터 되돌릴 때 안쪽 [[__VAR_0__]] 이 그대로 남았다.
        //         블록은 함수로 넣는다: 문자열로 넣으면 블록 안의 $& · $' · $$ 가 치환 기호로 읽혀 글이 깨졌다.
        for (let index = protectedBlocks.length - 1; index >= 0; index--) {
            const block = protectedBlocks[index];
            const placeholderStr = createPlaceholder(index);
            const escapedPlaceholder = placeholderStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const placeholderRegex = new RegExp(escapedPlaceholder, 'g');
            translatedText = translatedText.replace(placeholderRegex, () => block);
        }

        watcher.check();
        if (checkpointComplete) await clearCheckpoints(key);
        watcher.check();
        return translatedText;

    } catch (error) {
        if (error?.cancelled || error?.resumable) throw error;
        // [1.9.0] 모델의 거절 · 차단은 코드 오류가 아니라 경고로 남긴다
        (error.refused ? console.warn : console.error)('Translation error:', error);
        // API 키 관련 오류인 경우 더 명확한 메시지 제공
        if (error.message.includes('API 키') || error.message.includes('설정되어 있지 않습니다')) {
            throw new Error(`API 키 설정 오류: ${error.message}`);
        }
        // 네트워크 오류
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            throw new Error('네트워크 연결 오류: 인터넷 연결을 확인해주세요.');
        }
        // 일반적인 에러
        const wrapped = new Error(`번역 실패: ${error.message}`);
        if (error.refused) wrapped.refused = true;
        throw wrapped;
    } finally { watcher.close(); }
}

// [1.9.2] 번역 진행 표시는 실행마다 표(token)를 둔다. 스와이프 처리기가 표를 비우고 새 번역이 시작된 뒤
//         먼저 끝난 옛 번역이 finally 에서 새 번역의 표까지 지워 같은 메시지를 또 번역하게 두던 것을 막는다.
/**
 * [2.1.0] 번역 중인 메시지 위의 작은 진행 표시 ("번역 중 · 12초", 문단을 나눌 땐 "문단 2/6"). 끝나면 지운다.
 * 실리태번이 mes_text 를 다시 그리면 사라지므로 매 초 없으면 다시 붙인다.
 */
function progressBadge(messageId, message = null, sourceMes = message?.mes, chatId = getContext().chatId) {
    const started = Date.now();
    const swipeId = message?.swipe_id ?? 0;
    let stage = { stage: 'whole' }, el = null;
    const text = () => {
        const sec = Math.round((Date.now() - started) / 1000);
        if (stage.stage === 'chunks') return `${stage.resumed ? '이어 번역' : '번역 중'} · 문단 ${stage.done + 1}/${stage.total} · ${sec}초`;
        if (stage.stage === 'segments') return `캐시 ${stage.reused}개 · ${stage.pending ? `수정 문단 ${stage.pending}개 묶음 번역 중` : `새 번역 ${stage.translated}개`} · ${sec}초`;
        if (stage.stage === 'kana') return `번역 중 · 마무리 · ${sec}초`;
        return `번역 중 · ${sec}초`;
    };
    const paint = () => {
        // [2.1.3] 번호가 아니라 그 메시지 · 그 스와이프 · 그 글에 붙인다. 번호로만 찾아 스와이프 뒤 새 '...' 에 다시 붙었고,
        //         그러면 isGeneratingSwipe 가 생성 중인 줄 몰라 옛 글을 한 번 더 번역했다. 대상이 바뀌면 떼고, 돌아오면 다시 붙인다.
        const index = message ? resolveTranslationTarget(message, messageId, sourceMes, chatId) : messageId;
        if (index === -1 || (message && (getContext().chat?.[index]?.swipe_id ?? 0) !== swipeId)) { el?.remove(); el = null; return; }
        const host = document.querySelector(`#chat .mes[mesid="${index}"] .mes_text`);
        if (!host) return;
        if (!el || !el.isConnected) { el = document.createElement('div'); el.className = 'llmt-progress'; host.prepend(el); }
        el.textContent = text();
    };
    const timer = setInterval(paint, 1000);
    paint();
    return {
        update(info) { if (info && typeof info === 'object') stage = info; paint(); },
        remove() { clearInterval(timer); el?.remove(); el = null; },
    };
}

function beginTranslation(messageId, message) {
    const token = { guard: guards.capture(message), chatGuard: guards.capture(), source: message.mes, swipe: message.swipe_id };
    let done;
    Object.defineProperties(token,{finished:{value:new Promise(r=>done=r)},resolve:{value:error=>done(error)}});
    // [1.9.5] 표에 메시지를 달아 둔다 (디버그 출력에 메시지 전체가 찍히지 않게 열거되지 않는 속성으로)
    Object.defineProperty(token, 'message', { value: message });
    translationInProgress[messageId] = token;
    return token;
}
function endTranslation(messageId, token) {
    token?.resolve?.(token.error);
    if (translationInProgress[messageId] === token) translationInProgress[messageId] = false;
}
/**
 * [1.9.5] 그 번호의 '지금' 메시지를 번역하는 중인지. 번호만 보면 재생성(마지막 답을 지우고 같은 번호에 새 답) · 앞 메시지 삭제 ·
 * 채팅 전환 뒤 같은 번호에 온 다른 메시지가 옛 번역이 끝날 때까지 '이미 번역 중'으로 막혀, 새 답의 자동 번역이 끝내 안 됐다
 * (옛 번역은 대상이 사라져 버려지고, 새 답은 다시 부르는 곳이 없다).
 */
function isTranslationInProgress(messageId) {
    const message = getContext().chat?.[messageId];
    if (!message) return false;
    return Object.values(translationInProgress).some(token => token && token.message === message && token.guard.valid());
}

/**
 * [1.9.2] 번역이 끝났을 때 그 번역을 붙여도 되는 메시지 번호 (없으면 -1).
 * 번역하는 동안 채팅을 바꾸거나 · 스와이프하거나 · 글을 고치거나 · 앞 메시지를 지우면 처음 번호에 다른 글이 있다.
 * 예전에는 그 번호에 그대로 붙여서 다른 채팅의 같은 번호 메시지에 엉뚱한 번역이 그려지고, 넘긴 스와이프에는 이전 스와이프의 번역이 저장됐다.
 * 같은 메시지 객체가 (지워진 앞 메시지 때문에) 다른 번호로 옮겼으면 그 번호, 채팅을 다시 불러와 객체가 바뀌었으면 같은 채팅 · 같은 번호 · 같은 글일 때만.
 */
function resolveTranslationTarget(message, messageId, sourceMes, chatId) {
    const context = getContext();
    const chat = context.chat || [];
    if (context.chatId !== chatId) return -1;
    const index = chat.indexOf(message);
    return index !== -1 && message.mes === sourceMes ? index : -1;
}

/**
 * [1.9.4] 생성 잠금(body[data-generating])이 풀리고 quietMs 동안 그대로 풀려 있을 때 callback 을 한 번 부른다.
 * 스트리밍이 끝나면 실리태번이 잠금을 풀었다가 MESSAGE_RECEIVED 에서 다시 쓰기가 곧바로 다시 잠그므로, 풀린 순간에 부르면 고치기 전 글을 번역하게 된다.
 */
function afterGeneration(callback, quietMs = 300) {
    let timer = null;
    const observer = new MutationObserver(() => check());
    function check() {
        clearTimeout(timer);
        if (document.body.dataset.generating) return;
        timer = setTimeout(() => {
            if (document.body.dataset.generating) return;
            observer.disconnect();
            callback();
        }, quietMs);
    }
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-generating'] });
    check();
}

// [1.9.2] 화면에 없는 메시지(오래돼서 안 그려진 메시지 · 다른 채팅)에 updateMessageBlock 을 부르면 실리태번이 getAttribute 오류를 던진다.
//         그래서 전체 번역 · /LlmTranslateID 에서 번역은 붙었는데 '번역 실패' 가 뜨고, 뒤따르는 완료 알림 · 저장을 건너뛰었다.
// [1.9.5] 편집 창이 열린 메시지도 다시 그리지 않는다. 다시 그리면 편집 창(textarea)이 지워지고, 그 뒤 ✓ 를 누르면 실리태번이
//         화면 글자(번역문, 서식 · 그림 태그가 빠진 것)를 원문으로 저장했다 — 번역이 늦게 오는 폰에서 답을 고치려고 편집을 열면 원문이 날아갔다.
//         데이터(display_text)는 그대로 붙고, 편집을 끝내거나 취소하면 실리태번의 MESSAGE_UPDATED 로 handleMessageEdit 이 다시 그린다.
function refreshMessageBlock(messageId, message) {
    const element = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
    if (!element || element.querySelector('.edit_textarea')) return;
    return updateMessageBlock(messageId, message);
}

// 재번역 함수 (교정 또는 문단 맞추기)
async function retranslateMessage(messageId, promptType, forceRetranslate = false) {
    const context = getContext();
    const message = context.chat[messageId];

    if (!message) return;

    if (typeof message.extra !== 'object') {
        message.extra = {};
    }

    // 이미 번역 중인 경우
    if (isTranslationInProgress(messageId)) { // [1.9.5] 번호가 아니라 그 메시지
        toastr.info('번역이 이미 진행 중입니다.');
        return;
    }

    const pendingGuard = guards.capture(message);

    // promptType 검증
    const validPromptTypes = ['correction', 'guidance', 'paragraph'];
    if (!validPromptTypes.includes(promptType)) {
        toastr.error('유효하지 않은 재번역 타입입니다.');
        return;
    }

    const promptTypeKorean = promptType === 'correction' ? '교정' : promptType === 'guidance' ? '지침교정' : '문단 수 맞추기';

    // guidance 타입의 경우 추가 지침 입력받기
    let additionalGuidance = '';
    if (promptType === 'guidance') {
        additionalGuidance = await callGenericPopup(
            '추가 지침을 입력하세요:',
            POPUP_TYPE.INPUT,
            '',
            { wide: false, large: false }
        );

        if (additionalGuidance === false || additionalGuidance === null) {
            toastr.info('지침교정이 취소되었습니다.');
            return;
        }

        if (!additionalGuidance.trim()) {
            toastr.warning('추가 지침이 입력되지 않았습니다. 일반 교정으로 진행합니다.');
            promptType = 'correction';
        }
    }

    if (!pendingGuard.valid()) { toastr.info('메시지가 바뀌어 지침교정을 취소했어요.'); return; }
    toastr.info(`재번역(${promptTypeKorean})을 시작합니다 #${messageId}`);
    const runToken = beginTranslation(messageId, message); // [1.9.2] · [1.9.5] 메시지를 단다

    try {
        const sourceMes = message.mes;          // [1.9.2] 끝났을 때 같은 글인지 보려고
        const chatId = context.chatId;
        const originalText = substituteParams(message.mes, context.name1, message.name);
        const existingTranslation = await readCachedTranslation(originalText);

        let textToRetranslate, prompt;

        if (existingTranslation) {
            // 기존 번역이 있는 경우 - 재번역 수행
            textToRetranslate = `[Original Text]:\n${originalText}\n\n[Translated Text]:\n${existingTranslation}`;
            const promptMap = {
                'correction': 'llm_prompt_retranslate_correction',
                'guidance': 'llm_prompt_retranslate_guidance',
                'paragraph': 'llm_prompt_retranslate_paragraph'
            };
            const promptKey = promptMap[promptType];

            // 텍스트필드의 현재 값을 실시간 반영
            const editorElement = document.getElementById('llm_prompt_editor');
            const selectElement = document.getElementById('prompt_select');
            if (editorElement && selectElement && selectElement.value === promptKey) {
                const currentEditorValue = editorElement.value;
                prompt = (currentEditorValue && currentEditorValue.trim() !== '')
                    ? currentEditorValue
                    : extensionSettings[promptKey];
            } else {
                prompt = extensionSettings[promptKey];
            }
        } else {
            // 기존 번역이 없는 경우 - 새 번역 수행
            toastr.warning(`기존 번역문이 없습니다. 새로 번역합니다.`);
            textToRetranslate = originalText;

            // 채팅 번역 프롬프트도 텍스트필드 값 실시간 반영
            const editorElement = document.getElementById('llm_prompt_editor');
            const selectElement = document.getElementById('prompt_select');
            if (editorElement && selectElement && selectElement.value === 'llm_prompt_chat') {
                const currentEditorValue = editorElement.value;
                prompt = (currentEditorValue && currentEditorValue.trim() !== '')
                    ? currentEditorValue
                    : extensionSettings.llm_prompt_chat;
            } else {
                prompt = extensionSettings.llm_prompt_chat;
            }
        }

        const options = {
            prompt,
            additionalGuidance: promptType === 'guidance' ? additionalGuidance : '',
            // [2.1.3] 원문+번역문 묶음을 보낼 때만 — 묶음을 문단으로 나누면 영어만 · 한국어만 덩이가 섞여 번역이 두 번 붙었다.
            //         기존 번역이 없으면 그냥 새 번역이라 문단 나누기를 그대로 쓴다
            isRetranslation: Boolean(existingTranslation)
        };

        const report = {};
        const badge = progressBadge(messageId, message, sourceMes, chatId);
        let retranslation;
        try {
            retranslation = await translate(textToRetranslate, { ...options, assertValid: () => runToken.guard.assert(), onProgress: badge.update, report });
        } finally {
            badge.remove();
        }

        runToken.guard.assert();
        // 결과 저장 및 UI 업데이트
        // [1.9.2] 지우고 넣지 않는다: 캐시에 없던 원문이면 지우기가 'no matching data' 로 실패해서 방금 받은 재번역을 버렸다.
        //         addTranslationToDB 가 이제 같은 원문의 줄을 고쳐 쓴다.
        // [2.1.3] 일부 문단이 차단돼 원문으로 남았으면 캐시에 넣지 않는다 (translateMessage 와 같게)
        if (report.partial) toastr.warning(`문단 ${report.blockedChunks}/${report.chunks}덩이는 차단돼 원문으로 남겼어요. 다시 번역하면 다시 시도해요.`, '번역', { timeOut: 8000 });
        else await storeTranslationQuietly(originalText, retranslation);

        // [1.9.2] 재번역하는 동안 채팅 · 스와이프 · 글이 바뀌었으면 붙이지 않는다 (캐시에는 남음)
        const targetIndex = runToken.guard.index();
        if (targetIndex === -1) {
            toastr.warning(`재번역하는 동안 메시지가 바뀌어서 번역문을 붙이지 않았어요 #${messageId}`);
            return;
        }
        const targetId = targetIndex === Number(messageId) ? messageId : targetIndex; // 앞 메시지가 지워져 번호가 옮겼으면 새 번호
        const target = getContext().chat[targetIndex];
        if (!target.extra || typeof target.extra !== 'object') target.extra = {};

        target.extra.display_text = processTranslationText(originalText, retranslation);
        runToken.guard.acceptDisplay();
        // 현재 원문의 해시를 저장 (메시지 수정 감지용, 1.7.1)
        markTranslatedOriginal(target, originalText);

        // 원문 표시 백업 초기화 (재번역했으므로)
        delete target.extra.original_translation_backup;

        refreshMessageBlock(targetId, target);

        // [추가됨] 재번역 완료 이벤트 발생
        eventSource.emit('EXTENSION_LLM_TRANSLATE_DONE', {
            messageId: targetId,
            message: target, sourceText: sourceMes, chatId: getContext().chatId,
            originalText: originalText,
            translatedText: target.extra.display_text,
            type: 'retranslation' // 구분을 위해 type 추가
        });

		// 업데이트 이벤트 발송
       emitTranslationUIUpdate(targetId, 'retranslation');

        // 번역문 표시 플래그 설정 (Font Manager 등 다른 확장과의 호환성을 위해)
        // ... (기존 코드 계속)
        // 번역문 표시 플래그 설정 (Font Manager 등 다른 확장과의 호환성을 위해)
        // updateMessageBlock 후 DOM이 완전히 업데이트된 후 플래그 설정
        setTimeout(() => {
            if (!runToken.guard.valid() || getContext().chat[targetId] !== target) return;
            const messageBlock = $(`#chat .mes[mesid="${targetId}"]`);
            const textBlock = messageBlock.find('.mes_text');
            textBlock.data('showing-original', false);
        }, 100);

        runToken.guard.assert();
        syncMesToSwipe(targetId);
        await context.saveChat();
        publishArchiveReady(target, sourceMes, chatId, 'retranslation');

        toastr.success(`재번역(${promptTypeKorean}) 완료 #${targetId}`);

    } catch (error) {
        runToken.error = error;
        if (error?.cancelled) { toastr.info(error.message); return; }
        console.error('Retranslation error:', error);

        // 구체적인 에러 메시지 표시
        let errorMessage = '재번역에 실패했습니다.';
        if (error.message) {
            errorMessage = error.message;
        }

        toastr.error(`메시지 #${messageId} ${errorMessage}`, `재번역(${promptTypeKorean}) 실패`, { timeOut: 10000 });
    } finally {
        endTranslation(messageId, runToken);
    }
}

// Publish after the translation has been saved. Optional listeners never hold the translation job open.
function publishArchiveReady(message, sourceText, chatId, type) {
    const ctx=getContext(),id=ctx.chat.indexOf(message);
    if(id<0 || String(ctx.chatId)!==String(chatId) || message.mes!==sourceText || !message.extra?.display_text)return;
    document.dispatchEvent(new CustomEvent('llm-translator:ready',{detail:{
        messageId:id,message,sourceText,chatId,translatedText:message.extra.display_text,type
    }}));
}

// 단순화된 메시지 번역 함수
async function translateMessage(messageId, forceTranslate = false, source = 'manual') {
    const context = getContext();
    const message = context.chat[messageId];

    if (!message) {
        return;
    }

    if (typeof message.extra !== 'object') {
        message.extra = {};
    }

    // 번역 진행 중 확인
    if (isTranslationInProgress(messageId)) { // [1.9.5] 번호가 아니라 그 메시지
        if (source === 'manual') {
            toastr.info('번역이 이미 진행 중입니다.');
        }
        const pending = Object.values(translationInProgress).find(token=>token&&token.message===message&&token.guard.valid());
        const error = await pending?.finished;
        if (source === 'batch' && error) throw error;
        return;
    }

    const runToken = beginTranslation(messageId, message); // [1.9.2] · [1.9.5] 메시지를 단다

    try {
        const sourceMes = message.mes;          // [1.9.2] 끝났을 때 같은 글인지 보려고
        const chatId = context.chatId;
        const originalText = substituteParams(message.mes, context.name1, message.name);

        // [추가할 코드] 원문이 없거나 공백뿐이면 즉시 종료 (무한 루프 방지)
        if (!originalText || !originalText.trim()) return;

        // 번역 시작 알림 (조건부)
        // 1. 모든 수동 번역시 표시
        // 2. 자동 번역시: DB에 번역문이 없는 새로운 메시지만 표시 (스와이프 기존 번역 제외)
        let showStartToast = false;
        if (source === 'manual' ||
            source === 'handleTranslateButtonClick' ||
            source === 'handleTranslateButtonClick_retranslate') {
            showStartToast = true;
        } else if (source === 'auto' && !message.extra.display_text) {
            // 자동 번역시: DB에서 번역문을 가져올 수 있는지 먼저 확인
            const existingTranslation = await readCachedTranslation(originalText);

            // DB에 번역문이 없는 경우만 토스트 표시 (새로운 메시지)
            if (!existingTranslation) {
                showStartToast = true;
            }
        }

        if (showStartToast) {
            toastr.info(`번역을 시작합니다 #${messageId}`);
        }

        // 강제 번역이거나 번역문이 없는 경우, 또는 자동 번역시 원문이 바뀐 경우
        // 5.3.4: 전체 번역은 실패 표시가 남은 메시지도 다시 보낸다 (된 문단은 문단 캐시에서, 실패한 문단만 요청)
        let shouldTranslate = forceTranslate || !message.extra.display_text || (source === 'batch' && String(message.extra.display_text).includes(MARK_TAIL));

        // 자동 번역시 원문이 바뀌었는지 확인
        if (!shouldTranslate && source === 'auto' && message.extra.display_text) {
            // [1.9.2] 붙은 번역문이 지금 글의 것인지는 해시(1.7.1)로 안다. 해시가 맞으면 DB 에 없어도 다시 번역하지 않는다
            //         (다른 기기에서 번역한 메시지 · 보내기 번역의 '입력한 글' 표시를 자동 번역이 덮어쓰고 API 를 한 번 더 불렀다).
            //         해시가 있는데 다르면 옛 글의 번역이니 캐시에 있어도 새로 붙인다. 해시가 없는 예전 메시지만 예전처럼 DB 로 본다.
            const hash = message.extra.original_text_hash;
            if (hash) {
                shouldTranslate = hash !== originalHashOf(originalText) || looksLikeRefusal(originalText, message.extra.display_text);
            } else {
                // DB에서 현재 원문에 대한 번역이 있는지 확인
                const cachedForCurrentText = await readCachedTranslation(originalText);
                if (!cachedForCurrentText) {
                    shouldTranslate = true;
                }
            }
        }

        if (shouldTranslate) {
            // 캐시된 번역 확인
            const cachedTranslation = await readCachedTranslation(originalText);
            let translation = cachedTranslation;

            runToken.guard.assert();
            if (!cachedTranslation) {
                // 새로 번역
                // [2.1.0] 메시지 위에 진행 표시 · 문단을 나눠 일부가 차단되면 캐시에 넣지 않는다 (다시 번역하면 다시 시도)
                const report = {};
                const badge = progressBadge(messageId, message, sourceMes, chatId);
                // 화살표 다시 번역이라도 차단 표시가 남은 글이면 문단 캐시를 쓴다 — 이미 된 문단은 다시 보내지 않고 차단된 문단만 다시 시도
                const segmentCache = source !== 'handleTranslateButtonClick_retranslate' || String(message.extra.display_text || '').includes(MARK_TAIL);
                try {
                    translation = await translate(originalText, { segmentCache, assertValid: () => runToken.guard.assert(), onProgress: badge.update, report });
                } finally {
                    badge.remove();
                }
                if (report.partial) toastr.warning(`문단 ${report.blockedChunks}/${report.chunks}덩이는 차단돼 원문으로 남겼어요. 다시 번역하면 다시 시도해요.`, '번역', { timeOut: 8000 });
                else await storeTranslationQuietly(originalText, translation);
                // 5.4.2: 문단이 모두 캐시에서 왔으면(요청 0) 알린다 — 전엔 '번역을 시작합니다' 뒤 같은 글만 조용히 다시 붙었다
                if (source !== 'auto' && source !== 'batch' && !report.partial && report.reusedParagraphs > 0 && !report.translatedParagraphs) toastr.info('IndexedDB에서 번역문을 가져왔습니다.');
            }

            // [1.9.2] 번역하는 동안 채팅을 바꾸거나 · 스와이프 · 수정 · 앞 메시지 삭제로 그 자리 글이 바뀌었으면 붙이지 않는다 (캐시에는 남음)
            runToken.guard.assert();
            const targetIndex = runToken.guard.index();
            const targetId = targetIndex === Number(messageId) ? messageId : targetIndex; // 앞 메시지가 지워져 번호가 옮겼으면 새 번호
            const target = getContext().chat[targetIndex];
            if (!target.extra || typeof target.extra !== 'object') target.extra = {};

            target.extra.display_text = processTranslationText(originalText, translation);
            runToken.guard.acceptDisplay();
            if (cachedTranslation && source !== 'auto') {
                toastr.info('IndexedDB에서 번역문을 가져왔습니다.');
            }

            // 현재 원문의 해시를 저장 (메시지 수정 감지용, 1.7.1)
            markTranslatedOriginal(target, originalText);

            // 원문 표시 백업 초기화 (새로 번역했으므로)
            delete target.extra.original_translation_backup;

            refreshMessageBlock(targetId, target);

            // 번역 완료 이벤트 발생
            eventSource.emit('EXTENSION_LLM_TRANSLATE_DONE', {
                messageId: targetId,
            message: target, sourceText: sourceMes, chatId: getContext().chatId,
                originalText: originalText,
                translatedText: target.extra.display_text,
                type: 'translation'
            });

			// [추가] 재렌더링 트리거
			emitTranslationUIUpdate(targetId, 'translation');

            // 번역문 표시 플래그 설정 (Font Manager 등 다른 확장과의 호환성을 위해)
            // updateMessageBlock 후 DOM이 완전히 업데이트된 후 플래그 설정
            setTimeout(() => {
                if (!runToken.guard.valid() || getContext().chat[targetId] !== target) return;
                const messageBlock = $(`#chat .mes[mesid="${targetId}"]`);
                const textBlock = messageBlock.find('.mes_text');
                textBlock.data('showing-original', false);
            }, 100);

            runToken.guard.assert();
            syncMesToSwipe(targetId);
            await context.saveChat();
        }
        if (message.extra?.original_text_hash === originalHashOf(originalText)) publishArchiveReady(message, sourceMes, chatId, 'translation');
    } catch (error) {
        runToken.error = error;
        if (source === 'batch') throw error;
        if (error?.cancelled) {
            if (source === 'auto' && runToken.chatGuard.valid() &&
                (message.mes !== runToken.source || message.swipe_id !== runToken.swipe)) {
                afterGeneration(() => {
                    const id = getContext().chat.indexOf(message);
                    if (runToken.chatGuard.valid() && id >= 0 && !skipCutAutoTranslate(message, id))
                        translateMessage(id, false, 'auto').catch(() => {});
                });
            } else if (source !== 'auto') toastr.info(error.message);
            return;
        }
        (error?.refused ? console.warn : console.error)('Translation error:', error);

        // 구체적인 에러 메시지 표시
        let errorMessage = '번역에 실패했습니다.';
        if (error.message) {
            errorMessage = error.message;
        }

        toastr.error(`메시지 #${messageId} ${errorMessage}`, '번역 실패', { timeOut: 10000 });
    } finally {
        endTranslation(messageId, runToken);
    }
}

// 원문과 번역문 토글
async function toggleOriginalText(messageId) {
    const context = getContext();
    const message = context.chat[messageId];
    if (!message?.extra?.display_text) return;

    const messageBlock = $(`#chat .mes[mesid="${messageId}"]`);
    const textBlock = messageBlock.find('.mes_text');
    // [1.9.2] 이 표시는 화면에만 있어 채팅을 다시 열면 사라진다. 그땐 원문 보기 상태를 백업(번역문을 치워 둔 것) 유무로 본다
    //         — 예전에는 다시 연 뒤 첫 번째 누름이 아무 일도 안 했다.
    const shownFlag = textBlock.data('showing-original');
    const isCurrentlyShowingOriginal = shownFlag === undefined ? !!message.extra.original_translation_backup : shownFlag;

    if (isCurrentlyShowingOriginal) {
        // 원문 표시 중 → 번역문으로 전환
        if (message.extra.original_translation_backup) {
            message.extra.display_text = message.extra.original_translation_backup;
            delete message.extra.original_translation_backup;
        }
    } else {
        // 번역문 표시 중 → 원문으로 전환
        if (!message.extra.original_translation_backup) {
            message.extra.original_translation_backup = message.extra.display_text;
        }
        const originalText = substituteParams(message.mes, context.name1, message.name);
        message.extra.display_text = originalText;
    }

    await refreshMessageBlock(messageId, message);

    // UI 업데이트 이벤트 발송
    emitTranslationUIUpdate(messageId, 'toggle');
	
    // updateMessageBlock 후 DOM이 완전히 업데이트된 후 플래그 설정
    setTimeout(() => {
        const messageBlock = $(`#chat .mes[mesid="${messageId}"]`);
        const textBlock = messageBlock.find('.mes_text');
        textBlock.data('showing-original', !isCurrentlyShowingOriginal);
    }, 100);
}

// 현재 화면에 번역문이 표시되고 있는지 확인하는 함수
function isTranslationCurrentlyDisplayed(messageId) {
    const context = getContext();
    const message = context.chat[messageId];

    // 번역문이 없으면 false
    if (!message?.extra?.display_text) {
        return false;
    }

    const messageBlock = $(`#chat .mes[mesid="${messageId}"]`);
    const textBlock = messageBlock.find('.mes_text');
    const showingOriginalFlag = textBlock.data('showing-original');

    // showing-original 플래그가 명시적으로 true이면 원문 표시 중
    if (showingOriginalFlag === true) {
        return false;
    }

    // showing-original 플래그가 명시적으로 false이면 번역문 표시 중  
    if (showingOriginalFlag === false) {
        return true;
    }

    // showing-original 플래그가 설정되지 않은 경우 (초기 번역 후 상태)
    // 현재 화면에 표시된 텍스트와 원본 메시지 텍스트를 비교
    const originalText = substituteParams(message.mes, context.name1, message.name);
    const currentDisplayedHtml = textBlock.html();

    // HTML에서 텍스트만 추출하여 비교
    // Font Manager 등 다른 확장이 추가한 태그를 제거하여 정확한 비교
    const tempDiv = $('<div>').html(currentDisplayedHtml);

    // Font Manager가 추가한 커스텀 태그 폰트 span 제거
    tempDiv.find('[data-custom-tag-font]').each(function () {
        $(this).replaceWith($(this).html());
    });

    const currentDisplayedText = tempDiv.text().trim();
    const originalTextTrimmed = originalText.trim();

    // 현재 표시된 텍스트가 원본과 같으면 원문 표시 중, 다르면 번역문 표시 중
    return currentDisplayedText !== originalTextTrimmed;
}

// messageId 유효성 검사 및 기본값 처리 함수
function validateAndNormalizeMessageId(messageIdStr) {
    // 기본값 처리
    if (!messageIdStr) {
        return 'last';
    }

    // 'last'는 유효한 값으로 처리
    if (messageIdStr === 'last') {
        return 'last';
    }

    // 숫자로 변환 시도
    const messageId = parseInt(messageIdStr, 10);

    // 숫자가 아니거나 음수면 기본값 사용
    if (isNaN(messageId) || messageId < 0) {
        return 'last';
    }

    // 채팅 범위 확인
    const context = getContext();
    if (!context || !context.chat || context.chat.length === 0) {
        return 'last';
    }

    // 범위를 벗어나면 기본값 사용
    if (messageId >= context.chat.length) {
        return 'last';
    }

    // 유효한 숫자면 문자열로 반환
    return String(messageId);
}

// 아이콘 표시/숨김 업데이트 함수
function updateButtonVisibility(root = document) {
    // 2.0.4: jQuery 의 .toggle(참/거짓)은 단추마다 계산된 스타일을 읽는다 — 메시지가 많으면 시작 · 채팅 전환 때마다 문서 전체의
    // 스타일 계산을 강제로 돌렸다 (폰 흉내 4배 CPU 에서 시작 한 번 0.17초). 인라인 display 만 직접 쓴다 (숨김 = none, 보임 = 비움).
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

// 번역문이 표시되고 있을 때 원문으로 전환하는 함수
async function showOriginalText(messageId) {
    const context = getContext();
    const message = context.chat[messageId];
    if (!message?.extra?.display_text) return;

    // 번역문을 백업 (나중에 복원하기 위해)
    if (!message.extra.original_translation_backup) {
        message.extra.original_translation_backup = message.extra.display_text;
    }

    // 원문으로 전환
    const originalText = substituteParams(message.mes, context.name1, message.name);
    message.extra.display_text = originalText;

    await refreshMessageBlock(messageId, message);

    // UI 업데이트 이벤트 발송
    emitTranslationUIUpdate(messageId, 'show_original');
	
    // updateMessageBlock 후 DOM이 완전히 업데이트된 후 플래그 설정
    setTimeout(() => {
        const messageBlock = $(`#chat .mes[mesid="${messageId}"]`);
        const textBlock = messageBlock.find('.mes_text');
        textBlock.data('showing-original', true);
    }, 100);
}

// 번역 버튼 클릭 시 상태에 따른 동작 처리
async function handleTranslateButtonClick(messageId) {
    const context = getContext();
    const message = context.chat[messageId];

    // 번역 진행 중 확인
    if (isTranslationInProgress(messageId)) { // [1.9.5] 번호가 아니라 그 메시지
        toastr.info('번역이 이미 진행 중입니다.');
        return;
    }

    // 번역문이 없는 경우 → 번역 실행
    if (!message?.extra?.display_text) {
        await translateMessage(messageId, true, 'handleTranslateButtonClick');
        return;
    }

    // 현재 번역문이 표시되고 있는지 확인
    const isShowingTranslation = isTranslationCurrentlyDisplayed(messageId);

    if (isShowingTranslation) {
        // 번역문이 표시되고 있는 경우 → 원문 표시
        await showOriginalText(messageId);
        toastr.info(`원문으로 전환했습니다 #${messageId}`);
    } else {
        // 원문이 표시되고 있는 경우 → 백업된 번역문 복원

        // 백업된 번역문이 있으면 복원
        if (message.extra.original_translation_backup) {
            message.extra.display_text = message.extra.original_translation_backup;
            delete message.extra.original_translation_backup;

            await refreshMessageBlock(messageId, message);

            // 번역문 표시 플래그 설정
            setTimeout(() => {
                const messageBlock = $(`#chat .mes[mesid="${messageId}"]`);
                const textBlock = messageBlock.find('.mes_text');
                textBlock.data('showing-original', false);
            }, 100);

            toastr.info(`번역문으로 전환했습니다 #${messageId}`);
        } else {
            // 백업이 없으면 재번역
            const messageBlock = $(`#chat .mes[mesid="${messageId}"]`);
            const textBlock = messageBlock.find('.mes_text');
            textBlock.data('showing-original', false);

            await translateMessage(messageId, true, 'handleTranslateButtonClick_retranslate');
        }
    }
}

// Batch owns its stop state; a stopped run cannot reset a newer run's button.
async function onTranslateChatClick() {
    if (batchRun) { batchRun.stopped = true; toastr.info('현재 메시지 뒤에 전체 번역을 멈춰요.'); return; }
    const guard = guards.capture(), messages = [...(getContext().chat || [])];
    if (!messages.length) { toastr.warning('번역할 채팅이 없습니다.'); return; }
    // Reserve while the confirmation is open as well.
    const run = { stopped: false }; batchRun = run;
    const button = $('#llm_translate_chat');
    try {
        if (!await callGenericPopup('전체 채팅을 번역하시겠습니까?', POPUP_TYPE.CONFIRM)) return;
        guard.assert();
        if (run.stopped) return;
        isChatTranslationInProgress = true;
        button.find('.fa-right-left').removeClass('fa-right-left').addClass('fa-stop-circle');
        button.find('span').text('번역 중단'); button.addClass('translating');
        for (const message of messages) {
            guard.assert();
            if (run.stopped) break;
            const id = getContext().chat.indexOf(message);
            if (id < 0) continue;
            await translateMessage(id, false, 'batch');
            guard.assert();
            const delay = Math.max(0, Number(extensionSettings.throttle_delay) || 0);
            if (delay && !run.stopped) await new Promise(resolve => setTimeout(resolve, delay));
        }
        guard.assert();
        if (!run.stopped) toastr.success('채팅 번역이 완료되었습니다.');
    } catch (error) {
        if (error?.cancelled) toastr.info(error.message);
        else toastr.error(error?.message || '다시 전체 번역을 누르면 완료한 메시지는 건너뛰어요.', '전체 번역 중단', { timeOut: 10000 });
    } finally {
        if (batchRun === run) {
            batchRun = null; isChatTranslationInProgress = false;
            button.find('.fa-stop-circle').removeClass('fa-stop-circle').addClass('fa-right-left');
            button.find('span').text('LLM으로 전체 번역'); button.removeClass('translating');
        }
    }
}

// 입력창 번역 (단순화)
async function onTranslateInputMessageClick() {
    const textarea = document.getElementById('send_textarea');

    if (!(textarea instanceof HTMLTextAreaElement) || !textarea.value) {
        toastr.warning('먼저 메시지를 입력하세요.');
        return;
    }

    if (inputTranslationRunning) { toastr.info('입력 번역이 진행 중이에요.'); return; }
    inputTranslationRunning = true;
    const inputGuard = guards.capture(), originalInput = textarea.value;
    let inputChanged = false;
    const changed = () => { inputChanged = true; };
    textarea.addEventListener('input', changed);
    const assertInput = () => {
        inputGuard.assert();
        if (inputChanged || !textarea.isConnected || textarea.value !== originalInput) throw guards.cancelled();
    };
    try {
        // 입력 번역 프롬프트도 텍스트필드 값 실시간 반영
        let inputPrompt = extensionSettings.llm_prompt_input;
        const editorElement = document.getElementById('llm_prompt_editor');
        const selectElement = document.getElementById('prompt_select');
        if (editorElement && selectElement && selectElement.value === 'llm_prompt_input') {
            const currentEditorValue = editorElement.value;
            if (currentEditorValue && currentEditorValue.trim() !== '') {
                inputPrompt = currentEditorValue;
            }
        }

        const options = {
            prompt: inputPrompt,
            isInputTranslation: true
        };
        // [1.6.3] 길게 눌러 번역할 때 시작 · 끝을 알림 (사용자: "꾹 누르기만 하니까 잘 모르겠네") — 버튼도 깜빡임
        const startToast = toastr.info('입력창의 글을 번역하는 중…', '입력 번역 시작', { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });
        setSendButtonBusy(true);
        let translatedText;
        try {
            translatedText = await translate(originalInput, { ...options, assertValid: assertInput });
        } finally {
            toastr.clear(startToast);
            setSendButtonBusy(false);
        }
        assertInput();
        textarea.value = translatedText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        toastr.success('입력창의 글을 번역했어요. 확인하고 보내세요.', '입력 번역 완료', { timeOut: 2500 });
    } catch (error) {
        if (error?.cancelled) { toastr.info(error.message); return; }
        console.error('Input translation error:', error);

        // 구체적인 에러 메시지 표시
        let errorMessage = '입력 번역에 실패했습니다.';
        if (error.message) {
            errorMessage = error.message;
        }

        toastr.error(errorMessage, '입력 번역 실패', { timeOut: 10000 });
    } finally {
        textarea.removeEventListener('input', changed);
        inputTranslationRunning = false;
    }
}

// 모든 번역문 삭제
async function onTranslationsClearClick() {
    const confirm = await callGenericPopup(
        '번역된 내용을 모두 삭제하시겠습니까?',
        POPUP_TYPE.CONFIRM
    );

    if (!confirm) {
        return;
    }

    const context = getContext();
    const chat = context.chat;

    for (const mes of chat) {
        if (mes.extra) {
            delete mes.extra.display_text;
        }
    }

    await context.saveChat();
    await reloadCurrentChat();
    toastr.success('번역된 내용이 삭제되었습니다.');
}

// 메세지 블록에 번역 버튼 생성
const createTranslateButtons = (mesBlock) => {
    const messageId = mesBlock.attr('mesid');
    const extraMesButtons = mesBlock.find('.extraMesButtons');

    // 아이콘이 이미 추가되어 있는지 확인
    if (mesBlock.find('.mes_llm_translate').length > 0) {
        return;
    }

    // 1. 기존 번역 아이콘 (뇌) - 순수 번역 기능
    const legacyTranslateButton = $('<div>')
        .addClass('mes_button mes_legacy_translate fa-solid fa-brain interactable')
        .attr({
            'title': 'LLM 번역 (기존)',
            'data-i18n': '[title]LLM 번역 (기존)',
            'tabindex': '0'
        });

    // 2. 새로운 번역/전환 아이콘 (좌우 화살표) - 토글 기능
    const newTranslateButton = $('<div>')
        .addClass('mes_button mes_llm_translate fa-solid fa-right-left interactable')
        .attr({
            'title': 'LLM 번역/전환',
            'data-i18n': '[title]LLM 번역/전환',
            'tabindex': '0'
        });

    // 3. 번역 전환 아이콘 (돋보기)
    const toggleButton = $('<div>')
        .addClass('mes_button mes_toggle_original fa-solid fa-magnifying-glass interactable')
        .attr({
            'title': '원문/번역 전환',
            'data-i18n': '[title]원문/번역 전환',
            'tabindex': '0'
        });

    // 4. 편집 아이콘
    const editButton = $('<div>')
        .addClass('mes_button mes_edit_translation fa-solid fa-pen-to-square interactable')
        .attr({
            'title': '번역문 수정',
            'data-i18n': '[title]번역문 수정',
            'tabindex': '0'
        });

    // 5. 문단 수 교정 아이콘 (렌치)
    const paragraphButton = $('<div>')
        .addClass('mes_button mes_paragraph_correction fa-solid fa-wrench interactable')
        .attr({
            'title': '문단 수 교정',
            'data-i18n': '[title]문단 수 교정',
            'tabindex': '0'
        });

    // 6. 번역 삭제 아이콘 (쓰레기통)
    const deleteButton = $('<div>')
        .addClass('mes_button mes_delete_translation fa-solid fa-trash interactable')
        .attr({
            'title': '번역문 삭제',
            'data-i18n': '[title]번역문 삭제',
            'tabindex': '0'
        });

    // 설정에 따라 아이콘 표시/숨김
    if (extensionSettings.hide_legacy_translate_button) {
        legacyTranslateButton.hide();
    }
    if (extensionSettings.hide_new_translate_button) {
        newTranslateButton.hide();
    }
    if (extensionSettings.hide_toggle_button) {
        toggleButton.hide();
    }
    if (extensionSettings.hide_paragraph_button) {
        paragraphButton.hide();
    }
    if (extensionSettings.hide_edit_button) {
        editButton.hide();
    }
    if (extensionSettings.hide_delete_button) {
        deleteButton.hide();
    }

    // 버튼들을 메시지에 추가
    extraMesButtons.prepend(deleteButton);
    extraMesButtons.prepend(paragraphButton);
    extraMesButtons.prepend(editButton);
    extraMesButtons.prepend(toggleButton);
    extraMesButtons.prepend(newTranslateButton);
    extraMesButtons.prepend(legacyTranslateButton);
};

// 기존 메시지에 아이콘 추가
function addButtonsToExistingMessages() {
    $('#chat .mes').each(function () {
        const $this = $(this);
        if (!$this.find('.mes_llm_translate').length) {
            createTranslateButtons($this);
        }
    });
}

// 번역문 수정
// 번역문 수정 함수 (원복 및 플래그 갱신 수정)
async function editTranslation(messageId) {
    const context = getContext();
    const message = context.chat[messageId];

    // 0. 메시지 객체 및 display_text 유효성 검사
    if (!message?.extra?.display_text) {
        toastr.warning('수정할 번역문이 없습니다.');
        return;
    }

    const mesBlock = $(`.mes[mesid="${messageId}"]`);
    const mesText = mesBlock.find('.mes_text');
    const mesButtons = mesBlock.find('.mes_buttons'); // 버튼 영역 참조 추가

    // 1. DB에서 원본 번역문 가져오기
    const originalMessageText = substituteParams(message.mes, context.name1, message.name);
    let originalDbTranslation;
    try {
        originalDbTranslation = await getTranslationFromDB(originalMessageText);
        if (originalDbTranslation === null) {
            toastr.error('오류: 화면에는 번역문이 있으나 DB에서 원본을 찾을 수 없습니다.');
            return;
        }
    } catch (error) {
        console.error("편집용 원본 번역문 DB 조회 실패:", error);
        toastr.error("편집을 위해 원본 번역문을 가져오는 데 실패했습니다.");
        return;
    }

    // 편집 모드 전환
    mesBlock.addClass('translation-editing');
    mesButtons.hide(); 

    // Textarea 초기화
    const editTextarea = $('<textarea>')
        .addClass('edit_textarea translation_edit_textarea')
        .val(originalDbTranslation);

    // 버튼 생성
    const editButtons = $('<div>').addClass('translation_edit_buttons');
    const saveButton = $('<div>')
        .addClass('translation_edit_done interactable fa-solid fa-check-circle')
        .attr('title', '저장');
    const cancelButton = $('<div>')
        .addClass('translation_edit_cancel interactable fa-solid fa-times-circle')
        .attr('title', '취소');
    editButtons.append(saveButton, cancelButton);

    // UI 배치
    mesText.hide();
    mesText.after(editTextarea);
    editTextarea.before(editButtons);

    // 취소 버튼
    cancelButton.on('click', function () {
        // 기존 정리 로직 수행
        editTextarea.remove();
        editButtons.remove();
        mesText.show();
        mesBlock.removeClass('translation-editing');
        mesButtons.show();
    });

    // 저장 버튼
    saveButton.on('click', async function () {
        const newText = editTextarea.val();
        // [2.1.3] 수정창부터 닫는다 (성공/실패 여부 상관없이) — 열린 채면 refreshMessageBlock 이 이 textarea 를
        //         실리태번 편집 창으로 보고 다시 그리지 않아, 저장 · 삭제해도 화면에 옛 번역문이 남았다
        editTextarea.remove();
        editButtons.remove();
        mesText.show();
        mesBlock.removeClass('translation-editing');
        mesButtons.show();
        const originalTextForDbKey = substituteParams(message.mes, context.name1, message.name);

        // 삭제 로직
        if (newText.trim() === "") {
            try {
                await forgetParagraphCache(originalTextForDbKey); // 5.4.2
                // 5.4.2: 이 기기 DB 에 줄이 없어도(캐시에 안 넣은 번역 · 다른 기기) 붙은 번역문은 지운다 — 휴지통과 같게
                await deleteTranslationByOriginalText(originalTextForDbKey).catch(error => { if (!String(error?.message).includes('no matching data')) throw error; });
                delete message.extra.display_text; // 명시적 삭제
                delete message.extra.original_translation_backup; // [1.9.2] 치워 둔 번역문도 함께
                await refreshMessageBlock(messageId, message);
                await context.saveChat();
                toastr.success('번역문이 삭제되었습니다.');
            } catch (e) {
                toastr.error('번역문 삭제(DB)에 실패했습니다.');
                console.error(e);
            }
        }
        // 수정 로직
        else if (newText !== originalDbTranslation) {
            try {
                // DB 업데이트
                await updateTranslationByOriginalText(originalTextForDbKey, newText);

                // 화면 표시 업데이트
                const processedNewText = processTranslationText(originalTextForDbKey, newText);
                message.extra.display_text = processedNewText;
                // [1.9.2] 원문 보기 중에 고쳤으면 치워 둔 옛 번역문(백업)을 버린다 — 남아 있으면 돋보기로 돌아갈 때 고치기 전 번역이 다시 붙었다
                delete message.extra.original_translation_backup;

                await refreshMessageBlock(messageId, message);
                await context.saveChat();
                
                // UI 이벤트 발송
                emitTranslationUIUpdate(messageId, 'edit_save');
                toastr.success('번역문이 수정되었습니다.');

                // [요청하신 핵심 수정 사항] 
                // updateMessageBlock으로 DOM이 재생성되었으므로, 다시 요소를 찾아 플래그 설정
                setTimeout(() => {
                    const newMessageBlock = $(`#chat .mes[mesid="${messageId}"]`);
                    const newTextBlock = newMessageBlock.find('.mes_text');
                    if (newTextBlock.length) {
                        newTextBlock.data('showing-original', false);
                    }
                }, 100);

            } catch (e) {
                toastr.error('번역문 수정 중 오류가 발생했습니다.');
                console.error('번역문 수정 오류:', e);
            }
        } else {
            toastr.info('번역 내용이 변경되지 않았습니다.');
        }
    });

    editTextarea.focus();
}

// 입력 번역 버튼
function updateInputTranslateButton() {
    if (extensionSettings.show_input_translate_button) {
        if ($('#llm_translate_input_button').length === 0) {
            // sendform.html 로드
            $.get(`${extensionFolderPath}/sendform.html`, function (data) {
                $('#rightSendForm').append(data);
                bindSendButton(document.getElementById('llm_translate_input_button'));
                refreshSendButton();
            });
        } else {
            refreshSendButton();
        }
    } else {
        $('#llm_translate_input_button').remove();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// [1.6.0] 보내기 번역 — 전개 지시 버튼처럼 켜고 끄는 💬 버튼
//   톡: 켜기/끄기 (켜지면 테마 색으로 칠해짐)  ·  길게 누르기: 입력창의 글을 지금 바로 번역 (예전 기능)
//   켜져 있으면 MESSAGE_SENT(실리태번이 메시지를 채팅에 넣은 직후, 프롬프트를 만들기 전)에서 message.mes 를 번역문으로 바꾼다.
//   emit 은 핸들러를 기다리므로 번역이 끝난 뒤에야 생성이 이어진다. 원문은 extra.llmt_sent_original 에, 화면용은 display_text 에
// ═══════════════════════════════════════════════════════════════════════════════
const SEND_CTX_KEYS = ['send_ctx_persona', 'send_ctx_char', 'send_ctx_note', 'send_ctx_wi', 'send_ctx_history'];
const sendLang = () => (extensionSettings.send_target_language || 'English').trim() || 'English';
const sendDialogueLang = () => {
    const d = String(extensionSettings.send_dialogue_language || '').trim();
    return d && d.toLowerCase() !== sendLang().toLowerCase() ? d : '';
};
// 1.6.0 기본 프롬프트 — loadSettings 가 이것과 같으면 1.6.1 기본(두 언어)으로 바꾼다
const SEND_PROMPT_1_6_0 = `Translate the user's message below into {{targetLang}}.
- Keep the meaning, tone and register. Keep the formatting exactly: quotes, *asterisks*, markdown, line breaks, emoji.
- If a [Reference] block is given, use it only to keep names, terms and speech style consistent. Never translate or repeat the reference.
- Output only the translated message, nothing else.`;

/** 프롬프트의 {{languageRules}}: 언어 하나면 한 줄, 대사 언어를 따로 정했으면 서술 · 대사 규칙 (사용자의 이중 언어 프리셋과 같은 꼴) */
function sendLanguageRules() {
    const narration = sendLang();
    const dialogue = sendDialogueLang();
    if (!dialogue) return `- Write everything in ${narration}.`;
    return [
        `- Narration and action lines (outside quotation marks): write SOLELY in ${narration}.`,
        `- Dialogue (inside quotation marks or 「」): write SOLELY in ${dialogue}.`,
        '- Never mix the two languages within the same line. Keep 「」 / quotation marks as they are.',
    ].join('\n');
}
const sendLangLabel = () => (sendDialogueLang() ? `${sendLang()} + 대사 ${sendDialogueLang()}` : sendLang());

function refreshSendButton() {
    const btn = document.getElementById('llm_translate_input_button');
    const on = !!extensionSettings.send_translate;
    $('#llm_send_translate').prop('checked', on);
    if (!btn) return;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on
        ? `보내기 번역 켜짐 · 보내는 글을 ${sendLangLabel()}로 번역해서 보내요 · 길게 누르면 입력창 글을 지금 번역`
        : '보내기 번역 꺼짐 · 눌러서 켜기 · 길게 누르면 입력창 글을 지금 번역';
}

function setSendButtonBusy(busy) {
    document.getElementById('llm_translate_input_button')?.classList.toggle('is-busy', busy);
}

function toggleSendTranslate(force) {
    extensionSettings.send_translate = typeof force === 'boolean' ? force : !extensionSettings.send_translate;
    saveSettingsDebounced();
    refreshSendButton();
    toastr.info(extensionSettings.send_translate ? `켜짐 — 보내는 글을 ${sendLangLabel()}로 번역해서 보내요` : '꺼짐 — 입력한 대로 보내요', '보내기 번역', { timeOut: 2000 });
}

function bindSendButton(btn) {
    if (!btn || btn.dataset.llmtBound) return;
    btn.dataset.llmtBound = '1';
    btn.setAttribute('role', 'button');
    let timer = null;
    let longPressed = false;
    const cancel = () => { clearTimeout(timer); timer = null; };
    btn.addEventListener('pointerdown', () => {
        longPressed = false;
        cancel();
        timer = setTimeout(() => {
            longPressed = true;
            navigator.vibrate?.(20);
            onTranslateInputMessageClick();
        }, 550);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => btn.addEventListener(type, cancel));
    btn.addEventListener('contextmenu', (e) => e.preventDefault()); // 길게 누를 때 폰 메뉴가 뜨지 않게
    btn.addEventListener('click', () => {
        if (longPressed) { longPressed = false; return; }
        toggleSendTranslate();
    });
    btn.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        toggleSendTranslate();
    });
}

/** 보내기 번역에 붙이는 참고 정보 — 이름 · 용어 · 말투를 맞추라고 주는 것 (번역 대상 아님). 켠 항목만 */
async function buildSendReference(text) {
    const s = extensionSettings;
    const ctx = getContext();
    const parts = [];
    const clip = (value, max = 1500) => { const t = String(value || '').trim(); return t.length > max ? `${t.slice(0, max)}…` : t; };
    if (s.send_ctx_persona) {
        const desc = power_user?.persona_description || '';
        if (desc.trim()) parts.push(`<persona name="${ctx.name1}">\n${clip(desc)}\n</persona>`);
    }
    if (s.send_ctx_char) {
        const ch = ctx.characters?.[ctx.characterId];
        if (ch) {
            const body = [
                ch.description && `Description: ${clip(ch.description, 2500)}`,
                ch.personality && `Personality: ${clip(ch.personality, 800)}`,
                ch.scenario && `Scenario: ${clip(ch.scenario, 800)}`,
            ].filter(Boolean).join('\n');
            if (body) parts.push(`<character name="${ch.name}">\n${body}\n</character>`);
        }
    }
    if (s.send_ctx_note) {
        const note = ctx.chatMetadata?.note_prompt || '';
        if (note.trim()) parts.push(`<authors_note>\n${clip(note)}\n</authors_note>`);
    }
    const count = Math.max(1, Number(s.context_message_count) || 5);
    const recent = (ctx.chat || []).slice(-count - 1, -1).filter(m => m && !m.is_system); // 방금 보낸 것은 뺌
    if (s.send_ctx_wi) {
        try {
            // 실리태번이 프롬프트를 만들 때와 같은 식으로 최근 글(새 글 포함)을 훑어 걸리는 월드인포만 (건조 실행: 부작용 없음)
            const scan = [...recent.map(m => m.mes), text].reverse();
            const { worldInfoString } = await getWorldInfoPrompt(scan, 8192, true);
            if (worldInfoString && worldInfoString.trim()) parts.push(`<world_info>\n${clip(worldInfoString, 4000)}\n</world_info>`);
        } catch (error) {
            console.warn('[LLM Translator] 월드인포 참고 정보를 못 만들었어요:', error);
        }
    }
    if (s.send_ctx_history && recent.length) {
        parts.push(`<recent_chat>\n${recent.map(m => `${m.name}: ${clip(m.mes, 600)}`).join('\n\n')}\n</recent_chat>`);
    }
    if (!parts.length) return '';
    return `[Reference — use only to keep names, terms and speech style consistent. Do NOT translate or repeat it in the output]\n${parts.join('\n')}`;
}

function onUserRenderedBackTranslate(messageId) {
    const s = extensionSettings;
    if (!s.send_translate || s.send_display !== 'back') return;
    const message = getContext().chat?.[messageId];
    if (!message?.is_user || message.extra?.llmt_sent_original === undefined || message.extra?.display_text) return;
    translateMessage(messageId, false, 'auto').catch(error => console.warn('[LLM Translator] 보낸 글 다시 번역 실패:', error));
}

async function onMessageSentTranslate(messageId) {
    const s = extensionSettings;
    if (!s.send_translate) return;
    const ctx = getContext();
    const message = ctx.chat?.[messageId];
    if (!message || !message.is_user || message.is_system) return;
    if (!message.extra || typeof message.extra !== 'object') message.extra = {};
    if (message.extra.llmt_sent_original !== undefined) return; // 이미 번역해서 보낸 메시지
    const sendGuard = guards.capture(message);
    const text = String(message.mes || '');
    if (!text.trim()) return;

    const toast = toastr.info(`${sendLangLabel()}로 번역해서 보내는 중…`, '보내기 번역', { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });
    setSendButtonBusy(true);
    try {
        let prompt = (s.llm_prompt_send || defaultSettings.llm_prompt_send)
            .replace(/\{\{languageRules\}\}/g, sendLanguageRules())
            .replace(/\{\{targetLang\}\}/g, sendLang())
            .replace(/\{\{dialogueLang\}\}/g, sendDialogueLang() || sendLang());
        const reference = await buildSendReference(text);
        sendGuard.assert();
        if (reference) prompt += `\n\n${reference}`;
        prompt += '\n\n[Message to translate]';
        const translated = String(await translate(text, { prompt, isInputTranslation: true, assertValid: () => sendGuard.assert() }) || '').trim();
        if (!translated) throw new Error('번역 결과가 비어 있어요');
        sendGuard.assert();
        message.extra.llmt_sent_original = text;
        message.mes = translated;                                   // AI 에게 가는 글 (저장되는 원문도 이것)
        if ((s.send_display || 'original') === 'original') {
            message.extra.display_text = text; // 내 화면에는 입력한 글 그대로 ('sent' 는 번역문 그대로, 'back' 은 그려진 뒤 다시 번역)
            // [1.9.2] 이 표시가 지금 보낸 글의 것이라는 표식 — 없으면 자동 번역(내 메시지 포함 모드)이 입력한 글을 번역체로 덮어쓰고,
            //         편집을 열었다 닫기만 해도 입력한 글 표시가 지워졌다
            markTranslatedOriginal(message, substituteParams(message.mes, ctx.name1, message.name));
        }
        await ctx.saveChat();
    } catch (error) {
        if (error?.cancelled) { toastr.info(error.message); return; }
        console.error('[LLM Translator] 보내기 번역 실패 — 원문 그대로 보냅니다:', error);
        toastr.error(error?.message || String(error), '보내기 번역 실패 — 원문 그대로 보냄', { timeOut: 8000 });
    } finally {
        toastr.clear(toast);
        setSendButtonBusy(false);
    }
}



// [추가] 설정 화면 탭 전환. 마지막으로 연 탭을 이 브라우저에 기억한다.
function initSettingsTabs() {
    const root = $('.llmt-settings');
    const select = (name) => {
        root.find('.llmt-tab').each(function () {
            const active = $(this).data('llmt-tab') === name;
            $(this).toggleClass('active', active).attr('aria-selected', String(active));
        });
        root.find('.llmt-panel').each(function () {
            $(this).toggleClass('active', $(this).data('llmt-panel') === name);
        });
    };

    let saved = null;
    try { saved = localStorage.getItem('llmt_settings_tab'); } catch { /* 저장소가 막혀 있으면 첫 탭 */ }
    select(root.find(`.llmt-tab[data-llmt-tab="${saved}"]`).length ? saved : 'translate');

    root.on('click', '.llmt-tab', function () {
        const name = $(this).data('llmt-tab');
        select(name);
        try { localStorage.setItem('llmt_settings_tab', name); } catch { /* 무시 */ }
    });
}

// jQuery 초기화 블록
export const ready = new Promise((resolve, reject) => {
jQuery(async () => {
    if (duplicate) { resolve(); return; } // 단독 확장이 이미 돌고 있다 — UI · 이벤트를 달지 않는다
    try {
        // 필요한 HTML과 CSS 로드
        // [2.1.2] ?v=Date.now() 를 뺐다 — 실리태번은 확장 파일을 max-age 0 + ETag 로 주므로
        //         주소를 고정해도 새로고침마다 재검증되고, 안 바뀌었으면 304(본문 없음)로 온다.
        // [2.1.3] 못 받거나 빈 채로 와도 멈추지 않는다 — 예전엔 여기서 끝나 자동 번역 · 메시지 단추까지 한 세션 내내 꺼졌다. 바로 다시 받지는 않는다
        const getPart = name => $.get(`${extensionFolderPath}/${name}`).then(
            (text) => { if (!text) console.warn(`[LLM Translator] ${name} 가 비어 있음`); return String(text ?? ''); },
            (error) => { console.warn(`[LLM Translator] ${name} 불러오기 실패`, error?.status); return ''; });
        const html = await getPart('index.html');
        const buttonHtml = await getPart('buttons.html');

        $('#translate_wand_container').append(buttonHtml);
        $('#translation_container').append(html);
        initSettingsTabs();

        const cssLink = $('<link>', {
            rel: 'stylesheet',
            type: 'text/css',
            href: `${extensionFolderPath}/style.css`
        });
        $('head').append(cssLink);

        // html 완전 로드 후 설정 불러오기
        await new Promise(resolve => setTimeout(resolve, 100));

        // 프롬프트 매니저 초기화
        promptManager = new PromptManager();
        presetManager = new PresetManager();

        // 설정 로드 (프롬프트 매니저 초기화 후)
        loadSettings();
        initializeEventHandlers();
        bindTranslatorMenus(extensionSettings, saveSettingsDebounced);
        $('#llm_selection_retranslate').off('change').on('change', function () {
            extensionSettings.selection_retranslate = this.checked;
            saveSettingsDebounced();
            syncSelectionRetranslate({settings:extensionSettings, translate, render:processTranslationText, capture: message => guards.capture(message)});
        });

        // 프리셋 드롭다운 업데이트
        if (presetManager) {
            presetManager.updatePresetDropdown();
        }

        logDebug('LLM Translator extension initialized successfully');
        globalThis[Symbol.for('blue-lemonade.translator')] = { processTranslationText };
        resolve();
    } catch (error) {
        console.error('Error initializing LLM Translator extension:', error);
        reject(error);
    }
});
});

// ===== SillyTavern 기본 번역 로직 채택 =====

/**
 * 스와이프 생성 중인지 확인하는 함수 (SillyTavern 기본 번역과 동일)
 * @param {string|number} messageId Message ID
 * @returns {boolean} Whether the swipe is being generated
 */
function isGeneratingSwipe(messageId) {
    // [1.9.5] 응답이 시작되면 실리태번(saveReply)이 자리 표시 '...' 을 마크다운으로 다시 그려 화면 글자가 '…'(한 글자)이 된다.
    //         스와이프 뒤 0.3초 안에 응답이 시작되면 그 '...' 을 번역해 붙이고(API 한 번 + 스트리밍 중 저장), 스와이프가 끊기면 그 번역이 남았다.
    // [2.1.3] 번역 진행 표시(.llmt-progress)는 빼고 본다 — 옛 번역의 표시가 '...' 에 붙으면 '번역 중 · 7초...' 가 되어
    //         이 확인을 지나쳐 옛 스와이프를 또 번역했다. 주석 노드도 뺀다 (jQuery .text() 와 같게)
    const shown = [...document.querySelectorAll(`#chat .mes[mesid="${messageId}"] .mes_text`)]
        .flatMap(host => [...host.childNodes])
        .filter(node => node.nodeType !== Node.COMMENT_NODE && !node.classList?.contains('llmt-progress'))
        .map(node => node.textContent).join('').trim();
    if (shown === '...' || shown === '…') return true;
    //         스트리밍이 시작된 뒤에 타이머가 늦게 돌면(폰) 반쯤 받은 글을 번역했다 — 그 메시지가 아직 스트리밍 중이면 건너뛴다.
    //         끝나면 CHARACTER_MESSAGE_RENDERED 가 다시 온다 (끊긴 스트림은 isStopped, 멈춤 · 정상 끝은 isFinished 라 그때는 막지 않는다).
    const context = getContext();
    const processor = context.streamingProcessor;
    if (processor && Number(processor.messageId) === Number(messageId) && !processor.isFinished && !processor.isStopped) return true;
    return context.chat?.[messageId]?.mes === '...' && !!document.body.dataset.generating;
}
/**
 * 자동 번역 모드가 허용된 타입인지 확인하는 함수
 * @param {string[]} allowedTypes 허용된 모드 배열
 * @returns {boolean} 번역 수행 여부
 */
function shouldTranslate(allowedTypes) {
    return allowedTypes.includes(extensionSettings.auto_mode);
}

// [전역 변수] 모든 핸들러가 공유하는 대기열과 타이머
const SHARED_SAFETY = {
    queue: [],          // 번역 요청 대기열 (AI/User 통합)
    timer: null,        // 디바운싱 타이머
    isPopupOpen: false, // 팝업 중복 방지 플래그
    THRESHOLD: 5,       // 임계값 (이 숫자 이상이면 팝업)
    DELAY: 300          // 대기 시간 (ms) - 0.3초로 약간 늘림
};

/**
 * [1.9.6] 대기열에 넣을 때의 메시지 · 채팅. 0.3초 뒤에 번호만 다시 쓰면, 그 사이 채팅을 바꿨을 때 다른 채팅의 같은 번호 메시지를
 * 번역해 붙이고 저장했다 (재현: 지난 채팅을 바로 열면 그 채팅 #3 에 번역이 붙음, 원래 답은 번역 안 됨).
 */
function queuedTargetOf(messageId) {
    const context = getContext();
    const message = context.chat?.[messageId];
    return { message: message ?? null, guard: guards.capture(message), mes: message?.mes, chatId: context.chatId };
}

/**
 * [1.9.6] 대기열 작업을 부를 때의 번호. 같은 메시지 객체가 지금 채팅에 있으면 그 번호(앞 메시지가 지워져 번호가 밀려도 따라간다),
 * 채팅을 다시 불러와 객체가 바뀌었으면 같은 채팅 · 같은 번호 · 같은 글일 때만, 아니면 null (건너뜀).
 */
function resolveQueuedTarget(messageId, ref) {
    if (!ref) return messageId;
    if (!ref.message || !ref.guard?.valid()) return null;
    const id = ref.guard.index();
    return id < 0 ? null : id;
}

/**
 * 이벤트 핸들러 생성 함수 (공유 대기열 버전)
 */
function createEventHandler(translateFunction, shouldTranslateFunction) {
    return (data) => {
        // 1. 번역 대상이 아니면 즉시 종료
        if (!shouldTranslateFunction()) {
            return;
        }

        // 2. [공유 대기열]에 작업 추가
        // 나중에 실행할 함수(func)와 데이터(args)를 객체로 저장 — [1.9.6] 번호만이 아니라 그때의 메시지 · 채팅도 (ref)
        SHARED_SAFETY.queue.push({ func: translateFunction, args: data, ref: queuedTargetOf(data) });

        // 3. 기존 타이머가 있으면 초기화 (디바운싱)
        if (SHARED_SAFETY.timer) {
            clearTimeout(SHARED_SAFETY.timer);
        }

        // 4. 새 타이머 설정
        const fire = async () => {
            // 실행 시점에 큐 복사 및 초기화 — [1.9.6] 그 사이 채팅을 바꿨거나 지워진 메시지는 빼고, 번호는 지금 채팅 기준으로
            const currentBatch = SHARED_SAFETY.queue.filter(task => resolveQueuedTarget(task.args, task.ref) !== null);
            SHARED_SAFETY.queue = [];
            SHARED_SAFETY.timer = null;
            // 한 번 부를 때마다 다시 확인한다 (앞 번역 · 확인 창을 기다리는 사이에도 채팅이 바뀔 수 있다)
            // 5.3.4: 번역 함수가 promise 를 돌려주므로 한 건씩 끝난 뒤 다음을 보낸다 (전엔 N건이 한꺼번에 나갔다). 사이에 전체 번역 딜레이 · 일괄은 최소 0.5초
            let started = 0;
            const gap = Math.max(currentBatch.length >= SHARED_SAFETY.THRESHOLD ? 500 : 0, Number(extensionSettings.throttle_delay) || 0);
            const runTask = async (task) => {
                const id = resolveQueuedTarget(task.args, task.ref);
                if (id === null) {
                    console.debug('[LLM Translator] 대기 중에 채팅이 바뀌어 번역을 건너뜀', task.args);
                    return;
                }
                if (started++ && gap) await new Promise(resolve => setTimeout(resolve, gap));
                await task.func(id);
            };

            if (currentBatch.length === 0) return;

            // 5. 팝업이 이미 열려있다면? — 5.3.4: 버리지 않고 대기열에 되돌려 팝업이 닫힌 뒤 다시 본다
            if (SHARED_SAFETY.isPopupOpen) {
                SHARED_SAFETY.queue.unshift(...currentBatch);
                if (!SHARED_SAFETY.timer) SHARED_SAFETY.timer = setTimeout(fire, 1000);
                return;
            }

            // 6. 안전장치 발동 조건 확인
            if (currentBatch.length >= SHARED_SAFETY.THRESHOLD) {
                SHARED_SAFETY.isPopupOpen = true; // 팝업 열림 플래그

                try {
                    const confirm = await callGenericPopup(
                        `<b>${currentBatch.length}개</b>의 메시지 번역 요청이 감지되었습니다.<br><br>` +
                        `채팅방 입장 직후라면 과거 대화일 수 있습니다.<br>` +
                        `<b>모두 번역하시겠습니까?</b>`,
                        POPUP_TYPE.CONFIRM
                    );

                    if (confirm) {
                        toastr.info(`${currentBatch.length}개의 메시지 번역을 시작합니다.`);
                        // 일괄 처리
                        for (const task of currentBatch) {
                            // 큐에 저장된 함수와 인자를 꺼내서 실행
                            await runTask(task);
                        }
                    } else {
                        toastr.info('대량 번역 요청이 취소되었습니다.');
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    SHARED_SAFETY.isPopupOpen = false; // 팝업 닫힘 플래그 해제
                }

            } else {
                // 7. 임계값 미만(평소 대화) -> 즉시 실행
                for (const task of currentBatch) {
                    await runTask(task);
                }
            }
        };
        SHARED_SAFETY.timer = setTimeout(fire, SHARED_SAFETY.DELAY);
    };
}

// 자동 번역 함수들 (공식 스크립트 스타일)
const WATCHDOG_CUT = Symbol.for('st.stream-watchdog.cut');
/** 끊김 감시가 방금 답을 끊었다는 표시가 살아 있나 (첫 글자 전 끊김 · 1분 지난 것은 아님) */
function pendingWatchdogCut() {
    const cut = globalThis[WATCHDOG_CUT];
    return !!cut && !cut.first && Date.now() - cut.at < 60000;
}
function cutByWatchdog(message) {
    const length = String(message.mes || '').length;
    if (pendingWatchdogCut()) {
        delete globalThis[WATCHDOG_CUT];
        message.extra.stream_cut = length;
    }
    return Number.isFinite(message.extra.stream_cut) && message.extra.stream_cut === length;
}
/**
 * [2.1.3] 장기 기억 브리지(wait) · afterGeneration 재시도가 자동 번역을 시작하기 전에 보는 끊김 확인. 표시를 지우지 않는다 —
 * 지우고 stream_cut 을 적고 알림을 띄우는 건 translateIncomingMessage(cutByWatchdog) 몫. 예전엔 이 둘이 확인 없이 번역을 시작해
 * 끊긴 반쪽 답을 번역하고 '건너뛰었어요' 알림이 뒤따랐다. 방금 끊긴 표시는 마지막 AI 메시지에만 믿는다 (색인 중 옛 메시지는 stream_cut 으로만).
 */
function skipCutAutoTranslate(message, index) {
    if (Number.isFinite(message?.extra?.stream_cut) && message.extra.stream_cut === String(message.mes || '').length) return true;
    return !message?.is_user && !message?.is_system && index === getContext().chat.length - 1 && pendingWatchdogCut();
}
function translateIncomingMessage(messageId) {
    const context = getContext();
    const message = context.chat[messageId];

    if (!message || isGeneratingSwipe(messageId)) {
        return;
    }

    if (typeof message.extra !== 'object') {
        message.extra = {};
    }

    // [2.0.5] 끊김 감시(블루 레몬에이드 성능 보조)가 끊은 답은 자동 번역하지 않는다 — 반쪽짜리 글에 번역 요청을 쓰지 않게.
    //         끊김 감시가 남긴 표시를 받아 그때의 글 길이를 메시지에 적어 두고, 글이 그대로인 동안만 건너뛴다(이어쓰기 · 편집으로 글이 바뀌면 다시 번역).
    //         번역 버튼으로 직접 번역하는 것은 막지 않는다.
    if (cutByWatchdog(message)) {
        console.info('[LLM Translator] 끊긴 답이라 자동 번역을 건너뜀', messageId);
        if (typeof toastr !== 'undefined') toastr.info('끊긴 답이라 자동 번역을 건너뛰었어요. 번역하려면 메시지의 번역 버튼을 누르세요.', 'LLM 번역', { timeOut: 4000 });
        return;
    }

    // 백그라운드에서 번역 실행
    return translateMessage(messageId, false, 'auto').catch(error => {
        console.warn('Auto translation failed:', error);
    });
}

function translateOutgoingMessage(messageId) {
    const context = getContext();
    const message = context.chat[messageId];

    if (!message) {
        return;
    }

    if (typeof message.extra !== 'object') {
        message.extra = {};
    }

    // 백그라운드에서 번역 실행
    return translateMessage(messageId, false, 'auto').catch(error => {
        console.warn('Auto translation failed:', error);
    });
}

// [변경] 이벤트 핸들러들 - 모드에 따라 incoming/outgoing 그룹 적용
const handleIncomingMessage = createEventHandler(translateIncomingMessage, () => shouldTranslate(incomingTypes));
const handleOutgoingMessage = createEventHandler(translateOutgoingMessage, () => shouldTranslate(outgoingTypes));

// [1.7.1] 번역한 원문의 표식: 예전에는 원문 전체를 extra.original_text_for_translation 에 복사해 두어
// (수정 감지용) 채팅 파일이 메시지마다 두 배로 커졌다 — 사용자의 7MB 채팅에서 1.4MB 가 이 사본이었다.
// 이제는 해시만 둔다. 예전 사본이 남은 메시지는 채팅을 열 때 해시로 바꾼다 (migrateOriginalCopies).
function originalHashOf(text) {
    return String(getStringHash(String(text ?? '')));
}
function markTranslatedOriginal(message, originalText) {
    message.extra.original_text_hash = originalHashOf(originalText);
    delete message.extra.original_text_for_translation;
}
function migrateOriginalCopies(chat) {
    let n = 0;
    for (const message of chat || []) {
        const copy = message?.extra?.original_text_for_translation;
        if (typeof copy !== 'string') continue;
        message.extra.original_text_hash = originalHashOf(copy);
        delete message.extra.original_text_for_translation;
        n++;
    }
    if (n) logDebug(`[1.7.1] ${n} messages: original text copy → hash (saved with the next chat save)`);
    return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// [1.8.0] 용어집 — 이름·호칭·고유명사의 번역을 고정한다
// 항목은 설정(extension_settings)에 남고, scope 가 'global' 이면 어디서나, 아바타 파일명이면 그 캐릭터에서만 쓴다.
// 프롬프트에는 원문에 실제로 나오는 항목만 넣어서 용어집이 커져도 토큰이 늘지 않는다.
// ═══════════════════════════════════════════════════════════════════════════

const GLOSSARY_MAX_LINES = 60;
/**
 * [1.8.9] 월드인포 뽑기 요청 설정.
 * 실제로 재 보고 정한 값이다 (gemini-3.8-flash + 중계 서버):
 *  - 항목을 여러 개 담으면 "생각"이 폭증한다 (1개 8초 · 5개 77초 · 10개 100초 초과 = Cloudflare 524). 그래서 한 요청에 한 항목만.
 *  - 동시에 보내면 중계 서버에서 줄을 서서 3개만 같이 보내도 30~80초로 늘고 끊긴다. 그래서 하나씩 차례로.
 *  - 위 두 가지를 지키면 항목당 3~19초, 10개에 90초쯤 걸린다.
 *  - max_tokens 에는 생각 토큰도 들어간다. 4,000이면 가끔 답이 잘리니, 실패하면 12,000으로 한 번 더 묻는다.
 */
const GLOSSARY_CALL_OPTIONS = Object.freeze({ maxTokens: 4000, temperature: 0.2, timeoutMs: 90_000 });
/** [1.8.10] 키워드가 없는 항목은 본문을 이만큼만 읽는다 (4,000자면 7~36초) */
const GLOSSARY_CONTENT_CHARS = 4000;
const GLOSSARY_CALL_RETRY = Object.freeze({ maxTokens: 12_000, temperature: 0.2, timeoutMs: 90_000 });
/** 한국어인지 (자모·완성형) */
const isKoreanText = text => /[가-힯㄰-㆏]/.test(String(text ?? ''));
let glossaryScopeView = 'char';   // 설정 화면에서 보고 있는 범위 ('char' | 'global')
let glossaryEditingId = null;     // 고치는 중인 항목 id
let glossaryEditingKey = null;    // [2.1.3] 고치기를 시작한 캐릭터 키 (채팅을 바꾸면 견준다)

/** 지금 열려 있는 캐릭터(또는 그룹)의 용어집 키. 아무것도 안 열려 있으면 null */
function glossaryScopeKey() {
    const ctx = getContext();
    if (ctx?.groupId) return `group:${ctx.groupId}`;
    const avatar = ctx?.characters?.[ctx.characterId]?.avatar;
    return avatar ? String(avatar) : null;
}

function glossaryEntries() {
    if (!Array.isArray(extensionSettings.glossary_entries)) extensionSettings.glossary_entries = [];
    return extensionSettings.glossary_entries;
}

/**
 * 지금 캐릭터에서 쓰이는 항목 (이 캐릭터 + 전체). 표기가 하나라도 겹치면 캐릭터 것이 이긴다.
 * [1.8.12] 예전에는 `src.toLowerCase()` 로만 견줘서 "Low-world" 와 "Low world" 가 서로 다른 것으로 남아
 * 두 줄이 함께 프롬프트에 들어갔다. 이제 찾기와 같은 정규화(glossaryFold)로 표기마다 견준다.
 */
function activeGlossaryEntries(scopeKey = glossaryScopeKey()) {
    const chosen = [];
    const claimed = new Set();
    for (const pass of ['char', 'global']) {
        for (const entry of glossaryEntries()) {
            if (!entry?.src || !entry?.dst) continue;
            const isGlobal = entry.scope === 'global';
            if (pass === 'char' ? isGlobal : !isGlobal) continue;
            if (!isGlobal && entry.scope !== scopeKey) continue;
            const forms = glossaryAlternatives(entry.src).map(glossaryFold).filter(Boolean);
            if (!forms.length || forms.some(form => claimed.has(form))) continue;
            for (const form of forms) claimed.add(form);
            chosen.push(entry);
        }
    }
    return chosen;
}

/**
 * [1.8.1] 찾기용 정규화: 소문자로, 하이픈·밑줄·가운뎃점·연속 공백은 한 칸으로.
 * "Heaven And Low-world Office" 와 "Heaven And Low world Office" 를 같은 말로 본다. 프롬프트에는 사용자가 적은 형태가 들어간다.
 */
function glossaryFold(text) {
    return String(text ?? '').toLowerCase().replace(/[\s\-‐‑–—_·・]+/g, ' ').trim();
}

/**
 * 원문에 나오는 항목만 골라 프롬프트 블록을 만든다.
 * reverse: 한국어 → 외국어(보내기·입력 번역)라 dst 로 찾고 "dst → src" 로 적는다.
 */
function buildGlossaryBlock(text, { reverse = false } = {}) {
    const s = extensionSettings;
    if (s.glossary_enabled === false) return '';
    if (reverse && s.glossary_apply_send === false) return '';
    const haystack = glossaryFold(text);
    if (!haystack) return '';
    // [1.8.2] 번역 칸에 쉼표로 여러 개를 적으면 (길드, 조합, 상인회) 모델이 맥락에 맞게 하나를 고른다
    // [1.8.3] 원문 칸도 쉼표로 여러 표기를 받는다 (Guild, Merchant Guild). 원문에 실제로 나온 표기만 줄에 적는다.
    const hits = [];
    for (const entry of activeGlossaryEntries()) {
        const sources = glossaryAlternatives(entry.src);
        const targets = glossaryAlternatives(entry.dst);
        const probes = reverse ? targets : sources;
        const matched = probes.filter(probe => glossaryOccursIn(haystack, probe));
        if (matched.length) hits.push({ entry, sources, targets, matched });
    }
    // [1.8.12] 더 긴 말 안에 든 짧은 말은 뺀다. 예전에는 "Adelstein" 한 줄과 "Adel" 한 줄이 함께 들어가
    // 같은 자리를 두 가지로 옮기라고 지시했다. 한글처럼 띄어쓰기로 자를 수 없는 말도 이걸로 걸러진다.
    // [2.1.3] 긴 말 밖에서도 따로 나오면 남긴다 — "庁長室 … 庁長" 에서 庁長 줄이 빠져 짧은 말을 제멋대로 옮겼다.
    const longest = hits.flatMap(hit => hit.matched.map(glossaryFold)).sort((a, b) => b.length - a.length);
    const lines = [];
    let hasChoice = false;
    for (const hit of hits) {
        if (lines.length >= GLOSSARY_MAX_LINES) break;
        const covered = hit.matched.every((form) => {
            const folded = glossaryFold(form);
            const containing = longest.filter(other => other.length > folded.length && other.includes(folded)); // 긴 것부터
            if (!containing.length) return false;
            let rest = haystack;
            for (const other of containing) rest = rest.split(other).join('\u0000');
            return !glossaryOccursIn(rest, form);
        });
        if (covered) continue;
        const from = hit.matched.join(' / ');
        const to = (reverse ? hit.sources : hit.targets);
        if (to.length > 1) hasChoice = true;
        lines.push(`${from} → ${to.join(' / ')}`);
    }
    if (!lines.length) return '';
    const rule = hasChoice
        ? 'Render these terms exactly as given below (keep the given spelling; Korean particles may attach naturally). Where several options are separated by " / ", pick the one that fits the context and use only options from the list:'
        : 'Render these terms exactly as given below (keep the given spelling; Korean particles may attach naturally):';
    return `[Glossary]\n${rule}\n` + lines.join('\n');
}

/**
 * [1.8.12] 정규화한 원문 안에 이 말이 "낱말로" 들어 있나.
 * 알파벳·숫자로 시작하거나 끝나는 말은 앞뒤가 알파벳·숫자가 아니어야 한다 ("Adel" 이 "Adelstein" 에 걸리지 않게).
 * 한자·가나·한글에는 낱말 경계가 없으니 예전처럼 그냥 들어 있으면 맞는 것으로 본다.
 */
function glossaryOccursIn(haystack, probe) {
    const folded = glossaryFold(probe);
    if (!folded) return false;
    const isWordChar = ch => !!ch && /[a-z0-9]/.test(ch);
    const needsLeft = isWordChar(folded[0]);
    const needsRight = isWordChar(folded[folded.length - 1]);
    if (!needsLeft && !needsRight) return haystack.includes(folded);
    let from = 0;
    for (;;) {
        const at = haystack.indexOf(folded, from);
        if (at < 0) return false;
        const before = at > 0 ? haystack[at - 1] : '';
        const after = haystack[at + folded.length] ?? '';
        if ((!needsLeft || !isWordChar(before)) && (!needsRight || !isWordChar(after))) return true;
        from = at + 1;
    }
}

/** "길드, 조합, 상인회" → ['길드', '조합', '상인회'] (쉼표·전각 쉼표 기준) */
function glossaryAlternatives(dst) {
    const options = String(dst ?? '').split(/[,，]/).map(part => part.trim()).filter(Boolean);
    return options.length ? options : [String(dst ?? '').trim()];
}

function glossaryNewId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * [2.1.1] 같은 범위에서 겹치는 항목을 하나로 합친다 — 번역이 똑같거나(대전쟁 · 행정전 · 천국군처럼 원문 표기만 다른 것),
 * 원문 표기를 하나라도 나눠 쓰면(공유 캐릭터 두 줄이 H.A.L.O 를 같이 가진 것). 예전에는 원문 문자열이 글자까지 같아야만 같은 항목으로 봐서
 * "A, B" 와 "B, A" · "天国軍" 과 "天国軍, Heavenly Army" 가 따로 쌓였고, 뒤의 것은 activeGlossaryEntries 가 조용히 버렸다.
 * 합칠 때 원문 · 번역 표기는 나온 순서대로 합집합(정규화해서 중복 제거), id 는 앞 항목 것. 순수 함수 — 목록을 고쳐 쓰고 합친 수를 돌려준다.
 */
function mergeGlossaryDuplicates(entries) {
    if (!Array.isArray(entries) || entries.length < 2) return 0;
    const forms = value => glossaryAlternatives(value).map(glossaryFold).filter(Boolean);
    const setKey = value => [...new Set(forms(value))].sort().join('');
    const union = (a, b) => {
        const seen = new Set(), out = [];
        for (const part of [...glossaryAlternatives(a), ...glossaryAlternatives(b)]) {
            const key = glossaryFold(part);
            if (!key || seen.has(key)) continue;
            seen.add(key); out.push(part.trim());
        }
        return out.join(', ');
    };
    let merged = 0;
    // [2.1.3] 짝마다 같은 글자를 다시 쪼개고 정규화했다 (72개면 부팅마다 폰에서 30ms 쯤). 한 번 부르는 동안만 기억한다
    const formCache = new Map(), keyCache = new Map();
    const formsOf = value => {
        const key = String(value ?? '');
        let found = formCache.get(key);
        if (!found) { found = forms(value); formCache.set(key, found); }
        return found;
    };
    const setKeyOf = value => {
        const key = String(value ?? '');
        let found = keyCache.get(key);
        if (found === undefined) { found = setKey(value); keyCache.set(key, found); }
        return found;
    };
    for (let i = 0; i < entries.length; i++) {
        const base = entries[i];
        if (!base?.src || !base?.dst) continue;
        for (let j = i + 1; j < entries.length; j++) {
            const other = entries[j];
            if (!other?.src || !other?.dst || other.scope !== base.scope) continue;
            const sameDst = setKeyOf(other.dst) === setKeyOf(base.dst);
            const baseForms = formsOf(base.src);
            const shareSrc = formsOf(other.src).some(form => baseForms.includes(form));
            if (!sameDst && !shareSrc) continue;
            base.src = union(base.src, other.src);
            base.dst = union(base.dst, other.dst);
            entries.splice(j, 1);
            j--; merged++;
        }
    }
    return merged;
}

/**
 * 항목 추가·수정. 같은 범위에 같은 원문이 있으면 번역만 바꾸고, 겹치는 항목이 생기면 바로 합친다 (2.1.1)
 * [2.1.3] quiet 가 매개변수에 없어 부를 때마다 ReferenceError 로 멈췄다 (+ 추가 · ✓ · 뽑기 넣기). quiet = 합치기는 부른 쪽이 끝에 한 번.
 */
function upsertGlossaryEntry(scope, src, dst, id = null, quiet = false) {
    src = String(src ?? '').trim();
    dst = String(dst ?? '').trim();
    if (!src || !dst) return false;
    const entries = glossaryEntries();
    const existing = id
        ? entries.find(entry => entry.id === id)
        : entries.find(entry => entry.scope === scope && entry.src.toLowerCase() === src.toLowerCase());
    if (existing) {
        existing.src = src;
        existing.dst = dst;
        existing.scope = scope;
    } else {
        entries.push({ id: glossaryNewId(), scope, src, dst });
    }
    const merged = quiet ? 0 : mergeGlossaryDuplicates(entries);
    if (merged) toastr.info(`겹치는 항목 ${merged}개를 하나로 합쳤어요.`, '용어집');
    saveSettingsDebounced();
    return true;
}

function removeGlossaryEntry(id) {
    const entries = glossaryEntries();
    const index = entries.findIndex(entry => entry.id === id);
    if (index >= 0) entries.splice(index, 1);
    saveSettingsDebounced();
}

function escapeHtmlText(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]));
}

/** [1.8.5] 용어집 UI가 붙어 있는 곳: 보통은 설정 카드, "크게 보기" 중에는 팝업 */
let glossaryHost = null;

/** [1.8.5] 잘린 이름을 누르면 전광판처럼 왼쪽으로 흘러가서 끝을 보여 주고 되돌아온다 */
function runGlossaryMarquee(holder) {
    const text = holder.querySelector('.llmt-gl-text');
    if (!text || holder.classList.contains('is-marquee')) return;
    const distance = text.scrollWidth - holder.clientWidth;
    if (distance <= 2) return;
    const duration = Math.min(12, Math.max(2.5, distance / 40 + 1.5));
    holder.style.setProperty('--llmt-marquee', `-${distance}px`);
    holder.style.setProperty('--llmt-marquee-time', `${duration}s`);
    holder.classList.add('is-marquee');
    const done = () => {
        holder.classList.remove('is-marquee');
        text.removeEventListener('animationend', done);
    };
    text.addEventListener('animationend', done);
    setTimeout(done, duration * 1000 + 500);
}

function glossaryCard() {
    return glossaryHost ?? document.getElementById('llmt_glossary_card');
}

/** [2.1.3] 고치던 항목을 놓는다 — 다른 캐릭터로 넘어간 뒤 ✓ 를 누르면 그 항목이 새 캐릭터 용어집으로 옮겨 갔다 */
function resetGlossaryEditor() {
    glossaryEditingId = null;
    glossaryEditingKey = null;
    const card = glossaryCard();
    if (!card) return;
    card.querySelector('#llm_glossary_add')?.classList.remove('is-editing');
    for (const input of card.querySelectorAll('#llm_glossary_src, #llm_glossary_dst')) input.value = '';
}

/** 설정 화면의 용어집 카드를 다시 그린다 (범위 탭·목록·입력 가능 여부) */
function renderGlossary() {
    const card = glossaryCard();
    if (!card) return;
    const key = glossaryScopeKey();
    const scope = glossaryScopeView === 'global' ? 'global' : key;
    // [1.8.2] 정렬: 번역 가나다(기본) 또는 원문 ABC
    const sortKey = extensionSettings.glossary_sort === 'src' ? 'src' : 'dst';
    const entries = glossaryEntries().filter(entry => entry.scope === scope)
        .sort((a, b) => String(a[sortKey]).localeCompare(String(b[sortKey]), 'ko') || a.src.localeCompare(b.src, 'ko'));
    const sortButton = card.querySelector('#llm_glossary_sort');
    if (sortButton) {
        sortButton.textContent = sortKey === 'dst' ? '가' : 'A';
        sortButton.setAttribute('aria-label', sortKey === 'dst' ? '번역 가나다순 (누르면 원문순)' : '원문 ABC순 (누르면 번역순)');
    }
    for (const button of card.querySelectorAll('.llmt-gl-scope')) button.classList.toggle('active', button.dataset.scope === glossaryScopeView);

    const list = card.querySelector('.llmt-gl-list');
    if (glossaryScopeView === 'char' && !key) {
        list.innerHTML = '<small class="llmt-desc">캐릭터를 열면 그 캐릭터의 용어집이 여기 나와요.</small>';
    } else if (!entries.length) {
        list.innerHTML = `<small class="llmt-desc">${glossaryScopeView === 'global' ? '모든 캐릭터에 쓰는 항목이 아직 없어요.' : '이 캐릭터의 항목이 아직 없어요. 아래에 적거나 번역문에서 뽑아 보세요.'}</small>`;
    } else {
        list.innerHTML = entries.map(entry => `
            <div class="llmt-gl-row" data-id="${escapeHtmlText(entry.id)}">
                <span class="llmt-gl-src" data-act="marquee"><span class="llmt-gl-text">${escapeHtmlText(entry.src)}</span></span>
                <i class="fa-solid fa-arrow-right llmt-gl-arrow"></i>
                <span class="llmt-gl-dst" data-act="marquee"><span class="llmt-gl-text">${escapeHtmlText(entry.dst)}</span></span>
                <button type="button" class="llmt-gl-icon" data-act="edit" aria-label="고치기"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="llmt-gl-icon" data-act="delete" aria-label="지우기"><i class="fa-solid fa-xmark"></i></button>
            </div>`).join('');
    }
    const count = card.querySelector('.llmt-gl-count');
    const total = glossaryEntries().length;
    count.textContent = total ? `${entries.length} / ${total}` : '';
    const canAdd = glossaryScopeView === 'global' || !!key;
    for (const element of card.querySelectorAll('#llm_glossary_src, #llm_glossary_dst, #llm_glossary_add')) element.disabled = !canAdd;
    card.querySelector('#llm_glossary_extract').disabled = !key;
    const wiButton = card.querySelector('#llm_glossary_from_wi');
    if (wiButton) wiButton.disabled = !key;
}

function initGlossaryUI() {
    const card = document.getElementById('llmt_glossary_card');
    if (!card) return;
    const s = extensionSettings;
    $('#llm_glossary_enabled').prop('checked', s.glossary_enabled !== false).on('change', function () {
        s.glossary_enabled = $(this).is(':checked');
        saveSettingsDebounced();
    });
    $('#llm_glossary_apply_send').prop('checked', s.glossary_apply_send !== false).on('change', function () {
        s.glossary_apply_send = $(this).is(':checked');
        saveSettingsDebounced();
    });

    const srcInput = card.querySelector('#llm_glossary_src');
    const dstInput = card.querySelector('#llm_glossary_dst');
    const addButton = card.querySelector('#llm_glossary_add');
    const submit = () => {
        const scope = glossaryScopeView === 'global' ? 'global' : glossaryScopeKey();
        if (!scope) return toastr.warning('캐릭터를 먼저 열어 주세요.', '용어집');
        if (!srcInput.value.trim() || !dstInput.value.trim()) return toastr.warning('원문과 번역을 둘 다 적어 주세요.', '용어집');
        upsertGlossaryEntry(scope, srcInput.value, dstInput.value, glossaryEditingId);
        glossaryEditingId = null;
        addButton.classList.remove('is-editing');
        srcInput.value = '';
        dstInput.value = '';
        renderGlossary();
        srcInput.focus();
    };
    addButton.addEventListener('click', submit);
    for (const input of [srcInput, dstInput]) {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); submit(); }
        });
    }
    card.querySelector('.llmt-gl-scopes').addEventListener('click', (event) => {
        if (event.target.closest('#llm_glossary_sort')) {
            extensionSettings.glossary_sort = extensionSettings.glossary_sort === 'src' ? 'dst' : 'src';
            saveSettingsDebounced();
            renderGlossary();
            return;
        }
        const button = event.target.closest('.llmt-gl-scope');
        if (!button) return;
        glossaryScopeView = button.dataset.scope;
        glossaryEditingId = null;
        addButton.classList.remove('is-editing');
        renderGlossary();
    });
    // [1.8.5] 크게 보기: 카드 본문을 넓은 팝업으로 옮겼다가 닫으면 되돌린다 (이벤트는 요소에 붙어 있어 그대로 산다)
    card.querySelector('#llm_glossary_expand')?.addEventListener('click', async () => {
        const body = card.querySelector('.llmt-card-body');
        if (!body || glossaryHost) return;
        const root = document.createElement('div');
        root.className = 'llmt-gl-expanded';
        root.innerHTML = '<div class="llmt-gl-expanded-head"><i class="fa-solid fa-book"></i><b>용어집</b></div>';
        root.append(body);
        glossaryHost = root;
        renderGlossary();
        try {
            await callGenericPopup(root, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, large: true, allowVerticalScrolling: true });
        } finally {
            card.append(body);
            glossaryHost = null;
            renderGlossary();
        }
    });
    card.querySelector('.llmt-gl-list').addEventListener('click', (event) => {
        const button = event.target.closest('[data-act]');
        if (!button) return;
        if (button.dataset.act === 'marquee') return runGlossaryMarquee(button);
        const id = button.closest('[data-id]')?.dataset.id;
        const entry = glossaryEntries().find(item => item.id === id);
        if (!entry) return;
        if (button.dataset.act === 'delete') {
            removeGlossaryEntry(id);
            if (glossaryEditingId === id) { glossaryEditingId = null; addButton.classList.remove('is-editing'); }
            renderGlossary();
        } else if (button.dataset.act === 'edit') {
            glossaryEditingId = id;
            glossaryEditingKey = glossaryScopeKey();
            addButton.classList.add('is-editing');
            srcInput.value = entry.src;
            dstInput.value = entry.dst;
            dstInput.focus();
        }
    });
    card.querySelector('#llm_glossary_extract').addEventListener('click', () => {
        extractGlossaryWithLLM().catch((error) => {
            console.error('[LLM Translator] 용어집 뽑기 실패', error);
            toastr.error(error?.message || String(error), '용어집 뽑기 실패', { timeOut: 8000 });
        });
    });
    card.querySelector('#llm_glossary_from_wi')?.addEventListener('click', () => {
        extractGlossaryFromWorldInfo().catch((error) => {
            console.error('[LLM Translator] 월드인포 용어집 뽑기 실패', error);
            toastr.error(error?.message || String(error), '용어집 뽑기 실패', { timeOut: 8000 });
        });
    });
    renderGlossary();
}

/**
 * 지금 캐릭터의 카드와, 이미 번역된 최근 메시지(원문 ↔ 번역문)에서 이름·호칭을 뽑아 제안한다.
 * 번역 모델을 한 번 부르고, 고른 항목만 이 캐릭터 범위에 넣는다.
 */
async function extractGlossaryWithLLM() {
    const ctx = getContext();
    const key = glossaryScopeKey();
    if (!key) throw new Error('캐릭터를 먼저 열어 주세요.');
    const clip = (text, max) => {
        const value = String(text ?? '').replace(/\s+/g, ' ').trim();
        return value.length > max ? value.slice(0, max) + '…' : value;
    };
    const parts = [];
    const character = ctx.characters?.[ctx.characterId];
    if (character) {
        parts.push(`<character_card name="${character.name}">\n${clip(character.description, 1500)}\n${clip(character.personality, 500)}\n</character_card>`);
    }
    const pairs = (ctx.chat || [])
        .filter(message => !message.is_user && !message.is_system && message.extra?.display_text && message.mes)
        .slice(-8)
        .map((message, index) => `<pair n="${index + 1}">\n<original>\n${clip(message.mes, 1500)}\n</original>\n<korean>\n${clip(message.extra.display_text.replace(/<[^>]+>/g, ' '), 1500)}\n</korean>\n</pair>`);
    if (!pairs.length && !character) throw new Error('뽑을 재료가 없어요. 번역된 메시지가 몇 개 있어야 해요.');
    parts.push(...pairs);

    const existing = glossaryExistingForms(key);
    const prompt = [
        'You are building a translation glossary for a roleplay chat that is translated into Korean.',
        'From the character card and the ORIGINAL texts with their existing KOREAN translations below, list proper nouns and recurring terms: character names, nicknames, forms of address, place names, organizations, titles, special terms.',
        'For each term give the Korean rendering actually used in the translations; if the translations are inconsistent, choose the most frequent; if a name only appears in the character card, propose a natural Korean transliteration.',
        'Skip common words. 5 to 40 items.',
        'Output ONLY a JSON array like [{"src":"Nagi","dst":"나기"}] with no commentary.',
        '',
        ...parts,
    ].join('\n');

    const items = await runGlossaryExtraction(prompt, '번역문에서 이름·호칭을 뽑는 중…');
    const proposals = buildGlossaryProposals(items, existing);
    await pickAndAddGlossaryProposals(proposals, key);
}

/**
 * [1.8.4] 월드인포 키워드에서 뽑기. 활성 로어북(전체·캐릭터·채팅·페르소나)의 항목마다 키워드에 한국어·일본어·영어 표기가
 * 섞여 있으니, 같은 뜻끼리 묶는 것과 고유 용어/일상 단어 구분을 번역 모델에 한 번 맡긴다. 결과는 전부 보여 주고 고유 용어만 켜 둔다.
 */
async function extractGlossaryFromWorldInfo() {
    const key = glossaryScopeKey();
    if (!key) throw new Error('캐릭터를 먼저 열어 주세요.');
    // 항목마다 둘 중 하나로 묻는다.
    //  keys    — 키워드에 한국어와 다른 언어가 함께 있으면, 언어를 우리가 갈라서 주고 모델은 짝만 맞춘다 (빠르고 사용자의 표기 그대로).
    //  content — 키워드가 없거나 한 언어뿐이면 본문을 읽고 고유명사를 뽑아 한국어 표기를 제안한다
    //            ([1.8.10] 설정 항목은 키워드 없이 본문만 있는 경우가 많다: "天地合同庁 H.A.L.O (Heaven And Low-world Office)" → 공유 캐릭터).
    const jobs = [];
    for (const entry of (await getSortedEntries()).filter(entry => !entry.disable)) {
        const title = String(entry.comment || '').slice(0, 60);
        const keys = [...(entry.key || []), ...(entry.keysecondary || [])].map(k => String(k).trim()).filter(Boolean);
        const korean = keys.filter(isKoreanText);
        const other = keys.filter(key => !isKoreanText(key));
        if (korean.length && other.length) {
            jobs.push({ type: 'keys', title, korean, other });
        } else {
            const content = String(entry.content || '').trim();
            if (content.length >= 200) jobs.push({ type: 'content', title, content: content.slice(0, GLOSSARY_CONTENT_CHARS) });
        }
        if (jobs.length >= 80) break;
    }
    if (!jobs.length) throw new Error('쓸 만한 월드인포 항목이 없어요.');

    const KEY_INSTRUCTIONS = [
        'Below are Korean terms and non-Korean terms from ONE lorebook entry of a roleplay chat that is translated into Korean.',
        'Match each Korean term with the non-Korean terms (Japanese, English, Chinese) that mean the same thing.',
        'Output ONLY a compact JSON array of {"dst": "<the Korean term>", "src": "<matching non-Korean terms, comma-separated>", "kind": "name" | "common"}, no commentary, no code fence.',
        '"name" = proper nouns and setting-specific terms (people, places, organizations, factions, ranks, events, unique items). "common" = everyday vocabulary (food, hobbies, generic jobs, generic objects).',
        'Skip Korean terms that have no match. Do not invent terms that are not listed.',
        '',
    ];
    const CONTENT_INSTRUCTIONS = [
        'Below is ONE lorebook entry from a roleplay chat that is translated into Korean.',
        'List the terms a translator must render the same way every time: organizations, places, factions, ranks, titles, events, unique items, character names, and setting-specific vocabulary.',
        'Output ONLY a compact JSON array of {"src": "<all non-Korean forms that appear in the text, comma-separated>", "dst": "<the Korean rendering, comma-separated if the text shows more than one>", "kind": "name" | "common"}, no commentary, no code fence.',
        'If the text already shows a Korean form, use it. Otherwise give the natural Korean rendering a translator would use.',
        '"name" = proper nouns and setting-specific terms. "common" = generic words (Heaven, Hell, food, everyday objects).',
        'At most 25 terms. Do not list a term that has no non-Korean form in the text.',
        '',
    ];
    // [1.8.12] 뽑는 데 몇 분이 걸린다. 그 사이에 캐릭터를 바꿔도 "있음" 표시가 흔들리지 않게 지금 캐릭터 기준으로 먼저 모아 둔다.
    const existing = glossaryExistingForms(key);
    const items = [];
    const failures = [];
    let streak = 0; // 연달아 실패한 항목 수 — 3개면 (키 · 모델 · 중계가 죽은 것) 남은 항목을 보내지 않고 멈춘다
    const progress = startGlossaryProgress('월드인포에서 용어를 뽑는 중…', jobs.length);
    try {
        for (const job of jobs) {
            const prompt = job.type === 'content'
                ? [...CONTENT_INSTRUCTIONS, `Entry: ${job.title}`, job.content].join('\n')
                : [...KEY_INSTRUCTIONS, `Entry: ${job.title}`, `Korean: ${job.korean.join(', ')}`, `Other: ${job.other.join(', ')}`].join('\n');
            try {
                items.push(...await askGlossaryItems(prompt));
                streak = 0;
            } catch (error) {
                console.warn(`[LLM Translator] 월드인포 용어집 "${job.title}" 실패`, error);
                failures.push(`${job.title}: ${error?.message || String(error)}`);
                if (++streak >= 3) { toastr.error(`항목 3개가 연달아 실패해 멈췄어요: ${error?.message || String(error)}`, '용어집', { timeOut: 8000 }); break; }
            }
            progress.done();
        }
    } finally {
        progress.stop();
    }
    if (!items.length) throw new Error(failures[0] || '새로 뽑힌 항목이 없어요.');
    if (failures.length) toastr.warning(`${failures.length}개 항목은 실패했어요: ${failures[0]}`, '용어집', { timeOut: 8000 });

    const proposals = buildGlossaryProposals(items, existing);
    await pickAndAddGlossaryProposals(proposals, key, { note: '고유 용어만 켜져 있어요. 일상 단어는 꺼져 있으니 필요한 것만 켜세요.' });
}

/** [1.8.8] 진행 토스트: "N/M 항목 · 12초" 를 1초마다 고쳐 쓴다 */
function startGlossaryProgress(message, total) {
    const toast = toastr.info(message, '용어집', { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });
    const started = Date.now();
    let finished = 0;
    const paint = () => {
        const elapsed = Math.round((Date.now() - started) / 1000);
        const count = total > 1 ? ` ${finished}/${total} 항목 ·` : '';
        toast?.find?.('.toast-message')?.text(`${message}${count} ${elapsed}초`);
    };
    const timer = setInterval(paint, 1000);
    return {
        done: () => { finished++; paint(); },
        stop: () => { clearInterval(timer); toastr.clear(toast); },
    };
}

/**
 * [1.8.12] 뽑기 요청 한 번. 답이 잘리거나 한 번 튕기면 출력 한도를 키워 한 번 더 묻는다.
 * (max_tokens 에는 생각 토큰도 들어가서, 프롬프트가 크면 4,000으로는 답이 잘린다.)
 */
async function askGlossaryItems(prompt) {
    try {
        return parseGlossaryItems(await callLLMAPI(prompt, {...GLOSSARY_CALL_OPTIONS,requestPurpose:'translation.glossary'}));
    } catch (error) {
        // 답이 잘린(JSON 깨짐) 경우에만 한도를 키워 다시 묻는다 — 거절 · 429 · 시간 초과는 다시 보내도 같아서 그대로 올린다
        if (!error?.truncated) throw error;
        console.warn('[LLM Translator] 용어집 뽑기 재시도 (답이 잘림)', error);
        return parseGlossaryItems(await callLLMAPI(prompt, {...GLOSSARY_CALL_RETRY,requestPurpose:'translation.glossary'}));
    }
}

async function runGlossaryExtraction(prompt, message) {
    // [1.8.5] 오래 걸릴 수 있으니 경과 시간을 1초마다 붙여 준다
    const progress = startGlossaryProgress(message, 1);
    try {
        return await askGlossaryItems(prompt);
    } finally {
        progress.stop();
    }
}

/** 모델 응답에서 JSON 배열만 꺼낸다 (코드 펜스·설명이 붙어 있어도) */
function parseGlossaryItems(raw) {
    const text = String(raw ?? '');
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start < 0 || end <= start) throw new Error(`모델이 목록을 주지 않았어요: ${text.slice(0, 80)}`);
    try {
        const items = JSON.parse(text.slice(start, end + 1));
        return Array.isArray(items) ? items : [];
    } catch {
        throw Object.assign(new Error('모델의 목록을 읽을 수 없어요 (JSON이 잘렸거나 형식이 달라요).'), { truncated: true });
    }
}

/** [1.8.12] 그 범위(캐릭터+전체)에 이미 있는 원문 표기들 — "있음" 표시에 쓴다 */
function glossaryExistingForms(scopeKey) {
    return new Set(activeGlossaryEntries(scopeKey).flatMap(entry => glossaryAlternatives(entry.src).map(glossaryFold)));
}

/**
 * [1.8.10] 여러 항목에서 같은 용어가 표기 순서만 다르게 나오므로 (예: "H.A.L.O, 天地合同庁" 과 "天地合同庁, H.A.L.O"),
 * 표기가 하나라도 겹치면 한 줄로 합친다. 합칠 때 표기는 합집합, 종류는 고유명사가 이긴다.
 */
function buildGlossaryProposals(items, existing) {
    const proposals = [];
    /** 정규화된 표기 → 이미 만든 제안 */
    const byForm = new Map();
    const addForms = (proposal) => {
        for (const form of [...glossaryAlternatives(proposal.src), ...glossaryAlternatives(proposal.dst)]) {
            const folded = glossaryFold(form);
            if (folded) byForm.set(folded, proposal);
        }
    };
    const mergeInto = (proposal, sources, targets, common) => {
        const union = (text, extra) => {
            const list = glossaryAlternatives(text);
            const seen = new Set(list.map(glossaryFold));
            for (const form of extra) {
                const folded = glossaryFold(form);
                if (folded && !seen.has(folded)) { seen.add(folded); list.push(form); }
            }
            return list.slice(0, 8).join(', ');
        };
        proposal.src = union(proposal.src, sources);
        proposal.dst = union(proposal.dst, targets);
        proposal.common = proposal.common && common;
    };

    for (const item of Array.isArray(items) ? items : []) {
        const sources = glossaryAlternatives(item?.src);
        const targets = glossaryAlternatives(item?.dst);
        const src = sources.join(', ');
        const dst = targets.join(', ');
        if (!src || !dst || glossaryFold(dst) === glossaryFold(src)) continue;
        const common = String(item?.kind ?? '').toLowerCase() === 'common';
        // 원문 표기가 하나라도 겹치는 제안이 있으면 거기에 합친다 (번역만 같은 것은 다른 말일 수 있어 합치지 않는다)
        const hit = sources.map(form => byForm.get(glossaryFold(form))).find(Boolean);
        if (hit) {
            mergeInto(hit, sources, targets, common);
            addForms(hit);
            continue;
        }
        const proposal = {
            src,
            dst,
            common,
            duplicate: sources.some(form => existing.has(glossaryFold(form))),
        };
        proposals.push(proposal);
        addForms(proposal);
    }
    if (!proposals.length) throw new Error('새로 뽑힌 항목이 없어요.');
    return proposals;
}

/** 제안 목록을 체크박스 팝업으로 보여 주고 고른 것만 넣는다. 이미 있는 항목과 일상 단어는 꺼진 채로 나온다 */
async function pickAndAddGlossaryProposals(proposals, scope, { note = '이미 있는 항목은 꺼져 있어요.' } = {}) {
    // [1.8.11] 원문·번역을 이 자리에서 고칠 수 있다. 칸을 고치면 그 줄이 저절로 켜진다.
    const root = document.createElement('div');
    root.className = 'llmt-gl-pick';
    root.innerHTML = `
        <div class="llmt-gl-pick-head">
            <b>이 캐릭터 용어집에 넣을 항목을 고르세요</b>
            <small>${proposals.length}개 · ${escapeHtmlText(note)} 칸을 눌러 고칠 수 있어요.</small>
            <div class="llmt-gl-pick-tools">
                <button type="button" class="llmt-gl-icon" data-pick="all" aria-label="모두 켜기 (있음은 빼고)" title="모두 켜기 — 이미 있는 항목은 빼요"><i class="fa-solid fa-check-double"></i></button>
                <button type="button" class="llmt-gl-icon" data-pick="none" aria-label="모두 끄기" title="모두 끄기"><i class="fa-regular fa-square"></i></button>
                <span class="llmt-gl-pick-count"></span>
            </div>
        </div>
        ${proposals.map((item, index) => `
            <div class="llmt-gl-pick-row${item.common ? ' is-common' : ''}" data-index="${index}">
                <input type="checkbox" data-index="${index}" ${item.duplicate || item.common ? '' : 'checked'}>
                <input type="text" class="text_pole llmt-gl-pick-src" data-index="${index}" value="${escapeHtmlText(item.src)}" autocomplete="off" spellcheck="false">
                <i class="fa-solid fa-arrow-right llmt-gl-arrow"></i>
                <input type="text" class="text_pole llmt-gl-pick-dst" data-index="${index}" value="${escapeHtmlText(item.dst)}" autocomplete="off" spellcheck="false">
                <small>${item.duplicate ? '있음' : (item.common ? '일상' : '')}</small>
            </div>`).join('')}`;

    const checkboxes = [...root.querySelectorAll('input[type="checkbox"]')];
    const countLabel = root.querySelector('.llmt-gl-pick-count');
    const updateCount = () => { countLabel.textContent = `${checkboxes.filter(box => box.checked).length}개 선택`; };
    updateCount();
    root.addEventListener('click', (event) => {
        const tool = event.target.closest('[data-pick]');
        if (tool) {
            // [1.8.12] "모두 켜기" 는 이미 있는 항목(있음)을 건너뛴다.
            // 그러지 않으면 손으로 고쳐 둔 번역이 모델 제안으로 덮어써진다 — 되돌릴 방법이 없다.
            const all = tool.dataset.pick === 'all';
            for (const box of checkboxes) {
                box.checked = all && !proposals[Number(box.dataset.index)]?.duplicate;
            }
            return updateCount();
        }
        if (event.target.matches('input[type="checkbox"]')) return updateCount();
        // 글자 칸이 아닌 곳을 누르면 그 줄을 켜고 끈다
        const row = event.target.closest('.llmt-gl-pick-row');
        if (!row || event.target.matches('input')) return;
        const box = row.querySelector('input[type="checkbox"]');
        box.checked = !box.checked;
        updateCount();
    });
    root.addEventListener('input', (event) => {
        if (!event.target.matches('.llmt-gl-pick-src, .llmt-gl-pick-dst')) return;
        const box = event.target.closest('.llmt-gl-pick-row')?.querySelector('input[type="checkbox"]');
        if (box && !box.checked) { box.checked = true; updateCount(); }
    });

    const result = await callGenericPopup(root, POPUP_TYPE.CONFIRM, '', { okButton: '넣기', cancelButton: '취소', wide: true, large: true, allowVerticalScrolling: true });
    if (!result) return;
    let added = 0;
    for (const checkbox of checkboxes.filter(box => box.checked)) {
        const index = checkbox.dataset.index;
        const src = root.querySelector(`.llmt-gl-pick-src[data-index="${index}"]`)?.value;
        const dst = root.querySelector(`.llmt-gl-pick-dst[data-index="${index}"]`)?.value;
        if (upsertGlossaryEntry(scope, src, dst, null, true)) added++;
    }
    const merged = mergeGlossaryDuplicates(glossaryEntries()); // [2.1.1] 한 번에 합치고 한 번만 알린다
    // [1.8.12] 뽑는 동안 다른 캐릭터를 열었을 수 있다. 그때 목록을 그 캐릭터로 바꿔 버리면 아무것도 안 들어간 것처럼 보인다.
    const sameCharacter = glossaryScopeKey() === scope;
    if (sameCharacter) glossaryScopeView = 'char';
    renderGlossary();
    const mergedNote = merged ? ` 겹치는 ${merged}개는 하나로 합쳤어요.` : '';
    toastr.success((sameCharacter ? `${added}개를 넣었어요.` : `${added}개를 넣었어요. 뽑기를 시작한 캐릭터에 저장했어요.`) + mergedNote, '용어집', { timeOut: sameCharacter && !merged ? 3000 : 8000 });
}

// [수정] 메시지 수정 시 번역문 정리 및 재번역 로직
async function handleMessageEdit(messageId) {
    const context = getContext();
    const message = context.chat[messageId];

    if (!message) return;

    // 메시지 수정시 기존 번역문 초기화
    if (message.extra?.display_text) {
        // 현재 메시지의 원문 가져오기 (수정 후 원문)
        const currentOriginalText = substituteParams(message.mes, context.name1, message.name);

        // 저장된 이전 원문(사본 또는 해시)과 비교하여 실제로 수정되었는지 확인
        const previousOriginalText = message.extra.original_text_for_translation;
        const previousHash = typeof previousOriginalText === 'string' ? originalHashOf(previousOriginalText) : message.extra.original_text_hash;
        const changed = previousHash ? previousHash !== originalHashOf(currentOriginalText) : false;

        if (changed) {
            // 실제로 원문이 변경된 경우에만 이전 원문의 번역 삭제 (예전 사본이 남아 있을 때만 지울 수 있다 — 해시만 있으면 캐시 항목은 그대로 둔다)
            if (typeof previousOriginalText === 'string') {
                try {
                    await deleteTranslationByOriginalText(previousOriginalText);
                    logDebug(`Message ${messageId} was actually edited. Deleted translation for previous original text: "${previousOriginalText.substring(0, 50)}..."`);
                } catch (error) {
                    // DB에 해당 번역이 없을 수도 있음
                    if (error.message !== 'no matching data') {
                        console.warn(`Failed to delete translation for previous original text:`, error);
                    }
                }
            }

            // display_text 삭제 (실제로 수정된 경우에만)
            delete message.extra.display_text;

            // 현재 원문의 해시를 저장 (나중에 또 수정될 수 있으므로)
            markTranslatedOriginal(message, currentOriginalText);

            // UI도 즉시 업데이트
            refreshMessageBlock(messageId, message);

            // [변경] 자동 번역 모드 확인 및 재번역 실행
            const isUser = message.is_user;
            const currentMode = extensionSettings.auto_mode;
            
            // 유저 메시지이면서 outgoingTypes에 포함되거나, AI 메시지이면서 incomingTypes에 포함되면 번역
            const shouldRetranslate = (isUser && outgoingTypes.includes(currentMode)) ||
                                      (!isUser && incomingTypes.includes(currentMode));

            if (shouldRetranslate) {
                setTimeout(() => {
                    translateMessage(messageId, false, 'auto').catch(e => console.warn('Edit auto-translation failed', e));
                }, 100); // 약간의 지연을 두어 UI 업데이트 후 번역
            }
        } else if (previousHash) {
            // 수정 버튼을 눌렀지만 실제로는 수정하지 않은 경우 유지 (해시가 같음)
            logDebug(`Message ${messageId} edit button was clicked but no actual changes were made. Keeping translation data.`);
            // [1.9.2] 실리태번은 편집을 끝내거나 취소하면 원문(mes)을 그려 놓는다. 번역문을 남겨 두기만 하면 화면엔 원문이 보이고
            //         돋보기 상태와도 어긋났다 — 남긴 번역문으로 다시 그린다
            refreshMessageBlock(messageId, message);
        } else {
            // 기존 동작 유지
            delete message.extra.display_text;
            refreshMessageBlock(messageId, message);

            // [변경] 자동 번역 모드 확인 (위와 동일 로직)
            const isUser = message.is_user;
            const currentMode = extensionSettings.auto_mode;
            const shouldRetranslate = (isUser && outgoingTypes.includes(currentMode)) ||
                                      (!isUser && incomingTypes.includes(currentMode));

            if (shouldRetranslate) {
                setTimeout(() => {
                    translateMessage(messageId, false, 'auto').catch(e => console.warn('Edit auto-translation failed', e));
                }, 100);
            }
        }
    }
}

// 이벤트 핸들러 등록 함수
function initializeEventHandlers() {
    eventSource.makeFirst(event_types.CHAT_CHANGED, () => guards.chatChanged());
    for (const type of [event_types.MESSAGE_SWIPED, event_types.MESSAGE_EDITED].filter(Boolean)) {
        eventSource.makeFirst(type, id => guards.messageChanged(id));
    }




    // 새로운 클릭 리스너 추가 (SillyTavern 방식 적용)
    $(document).off('click', '.prompt-editor-button').on('click', '.prompt-editor-button', async function () {
        // 1. data-for 속성에서 원본 textarea ID 가져오기
        const originalTextareaId = $(this).data('for'); // 'llm_prompt_chat', 'llm_prompt_input' 등
        const originalTextarea = $(`#${originalTextareaId}`); // jQuery 객체

        // 원본 textarea를 찾았는지 확인
        if (!originalTextarea.length) {
            console.error(`[LLM Translator] Could not find original textarea with id: ${originalTextareaId}`);
            toastr.error('편집할 원본 텍스트 영역을 찾을 수 없습니다.');
            return;
        }

        // 2. callGenericPopup에 전달할 요소들 동적 생성
        const wrapper = document.createElement('div');
        // SillyTavern과 유사한 스타일링 적용 (필요시 클래스 추가)
        wrapper.classList.add('height100p', 'wide100p', 'flex-container', 'flexFlowColumn');

        const popupTextarea = document.createElement('textarea');
        popupTextarea.dataset.for = originalTextareaId; // 참조용으로 추가 (선택 사항)
        popupTextarea.value = originalTextarea.val(); // 원본 내용 복사
        // SillyTavern과 유사한 스타일링 적용 + LLM Translator 필요 스타일
        popupTextarea.classList.add('height100p', 'wide100p'); // 기본 크기
        // popupTextarea.classList.add('maximized_textarea'); // ST 클래스 (필요 여부 확인)
        // 원본에 monospace 클래스가 있다면 복사 (LLM Translator에 해당 클래스가 있다면)
        // if (originalTextarea.hasClass('monospace')) { popupTextarea.classList.add('monospace'); }

        // 3. 새 textarea 변경 시 원본 textarea 실시간 업데이트
        popupTextarea.addEventListener('input', function () {
            // 원본 textarea 값 변경 및 input 이벤트 트리거 (SillyTavern 방식)
            originalTextarea.val(popupTextarea.value).trigger('input');
            // LLM Translator의 설정 저장 로직도 트리거해야 할 수 있음 (확인 필요)
            // 예: saveSettingsDebounced(); 또는 해당 설정 값 직접 업데이트
            if (originalTextareaId === 'llm_prompt_editor') {
                // 통합 프롬프트 편집기의 경우 현재 선택된 프롬프트에 저장
                const selectorElement = $('#prompt_select');
                if (selectorElement.length > 0) {
                    const selectedPromptKey = selectorElement.val();
                    if (selectedPromptKey) {
                        // 커스텀 프롬프트 확인
                        const customPrompt = promptManager.customPrompts.find(p => p.id === selectedPromptKey);
                        if (customPrompt) {
                            customPrompt.content = popupTextarea.value;
                            promptManager.saveToLocalStorage();
                        } else {
                            // 기본 프롬프트
                            extensionSettings[selectedPromptKey] = popupTextarea.value;
                            $(`#${selectedPromptKey}`).val(popupTextarea.value);
                        }
                    }
                }
            }
            saveSettingsDebounced(); // 디바운스 저장 호출
        });

        wrapper.appendChild(popupTextarea);

        // 4. SillyTavern의 callGenericPopup 호출!
        try {
            // POPUP_TYPE.TEXT 는 SillyTavern 전역 스코프에 정의되어 있어야 함
            if (typeof callGenericPopup === 'function' && typeof POPUP_TYPE !== 'undefined' && POPUP_TYPE.TEXT) {
                // 제목 가져오기 (선택 사항, 버튼의 title 속성 등 활용)
                const popupTitle = $(this).attr('title') || '프롬프트 편집'; // 버튼의 title 사용
                await callGenericPopup(wrapper, POPUP_TYPE.TEXT, popupTitle, { wide: true, large: true });
                // 팝업이 닫힌 후 포커스를 원래 버튼이나 다른 곳으로 이동시킬 수 있음 (선택적)
                $(this).focus();
            } else {
                console.error('[LLM Translator] callGenericPopup or POPUP_TYPE.TEXT is not available.');
                toastr.error('SillyTavern의 팝업 기능을 사용할 수 없습니다.');
            }
        } catch (error) {
            console.error('[LLM Translator] Error calling callGenericPopup:', error);
            toastr.error('팝업을 여는 중 오류가 발생했습니다.');
        }
    });


    // 번역 표시 모드 변경 이벤트 핸들러 추가
    $('#translation_display_mode').off('change').on('change', function () {
        const selectedMode = $(this).val(); // 선택된 값 가져오기
        extensionSettings.translation_display_mode = selectedMode; // 설정 객체 업데이트
        saveSettingsDebounced(); // 변경 사항 저장
        // console.log(`[LLM Translator] Saved translation_display_mode: ${selectedMode}`); // 디버깅용 로그 (선택 사항)
    });

    // DB 삭제 버튼에 이벤트 리스너 추가
    // [2.1.3] 설정 HTML 이 없으면 셋 다 건너뛴다 — 예전엔 여기서 오류로 멈춰 아래의 자동 번역 · 메시지 단추 등록이 다 빠졌다
    const deleteButton = document.getElementById("llm_translation_delete");
    deleteButton?.addEventListener("click", deleteDB);

    // 다운로드 버튼에 이벤트 리스너 추가
    const downloadButton = document.getElementById("llm_translation_download");
    downloadButton?.addEventListener("click", downloadDB);

    // 복원 버튼에 이벤트 리스너 추가
    const restoreButton = document.getElementById("llm_translation_restore");
    restoreButton?.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (file) {
            restoreDB(file);
        }
    });

    // db tool setup 버튼
    $('#llm_translator_db_tool_setup_button').off('click').on('click', async function () {
        await prepareQrAndCharacterForDbManagement();
    });

    // 핵심 버튼 이벤트 핸들러 (공식 스크립트 스타일)
    $('#llm_translate_chat').on('click', onTranslateChatClick);
    $('#llm_translate_input_message').on('click', onTranslateInputMessageClick);
    $('#llm_translation_clear').on('click', onTranslationsClearClick);

    $('#llm_connection_mode').on('change', function () {
        extensionSettings.connection_mode = this.value === 'direct' ? 'direct' : 'current';
        updateConnectionVisibility();
        saveSettingsDebounced();
        autoFetchCustomModelsIfEmpty();
    });
    $('#llm_profile_max_tokens').on('change', function () {
        extensionSettings.profile_max_tokens = Math.max(0, Math.min(160000, Math.floor(Number(this.value) || 0)));
        this.value = extensionSettings.profile_max_tokens;
        saveSettingsDebounced();
    });
    // 설정 변경 이벤트 핸들러
    $('#llm_provider').on('change', function () {
        const provider = $(this).val();
        extensionSettings.llm_provider = provider;
        updateModelList();
        updateParameterVisibility(provider);
        loadParameterValues(provider);
        updateCustomEndpointVisibility(provider);
        saveSettingsDebounced();
        // [추가] 커스텀 공급자로 바꿨는데 저장된 주소의 모델 목록이 아직 없으면 조용히 한 번 받아온다.
        autoFetchCustomModelsIfEmpty();
    });

    // llmContext 슬라이더/체크박스 이벤트 핸들러
    $('#llm_context_message_count').on('input', function () {
        const value = $(this).val();
        $('#llm_context_message_count_value').val(value);
        extensionSettings.context_message_count = parseInt(value);
        saveSettingsDebounced();
    });

    $('#llm_context_message_count_value').on('change', function () {
        const value = Math.min(20, Math.max(1, parseInt($(this).val()) || 5));
        $(this).val(value);
        $('#llm_context_message_count').val(value);
        extensionSettings.context_message_count = value;
        saveSettingsDebounced();
    });

    $('#llm_context_include_user').on('change', function () {
        extensionSettings.context_include_user = $(this).is(':checked');
        saveSettingsDebounced();
    });

    $('#llm_context_exclude_last').on('change', function () {
        extensionSettings.context_exclude_last = $(this).is(':checked');
        saveSettingsDebounced();
    });

    $('#llm_model').on('change', function () {
        const provider = $('#llm_provider').val();
        const selectedModel = $(this).val();
        extensionSettings.llm_model = selectedModel;
        extensionSettings.provider_model_history[provider] = selectedModel;

        // custom 선택 시 커스텀 입력 필드 표시 (공급자별 값)
        if (selectedModel === 'custom') {
            $('#custom_model_container').show();
            $('#llm_custom_model').val(getCustomModelName(provider));
        } else {
            $('#custom_model_container').hide();
        }

        saveSettingsDebounced();
    });

    // 커스텀 모델명 입력 이벤트 (현재 선택된 공급자에만 저장)
    $('#llm_custom_model').on('input', function () {
        setCustomModelName($('#llm_provider').val(), $(this).val().trim());
        saveSettingsDebounced();
    });

    // [추가] 커스텀 엔드포인트 주소 입력 이벤트
    $('#llm_custom_url').on('input', function () {
        extensionSettings.custom_url = $(this).val().trim();
        saveSettingsDebounced();
        updateCustomModelsStatus();
    });

    // [추가] 주소 입력을 마치면(다른 곳 클릭·Enter) 그 주소로 받아 둔 목록이 있으면 바로 보여준다.
    // 새 주소로 자동 요청은 하지 않는다: 오타 난 주소로 저장된 API 키가 나가지 않도록 버튼을 눌러야 한다.
    $('#llm_custom_url').on('change', function () {
        if ($('#llm_provider').val() !== 'custom') {
            return;
        }
        updateModelList();
    });

    // [추가] 모델 목록 불러오기 버튼
    $('#llm_custom_fetch_models').on('click', function () {
        fetchCustomModelList({ silent: false });
    });

    // 프롬프트 관리는 이제 PromptManager 클래스에서 처리됩니다

    // 파라미터 슬라이더 동기화
    $('.parameter-settings input').on('input change', function () {
        const provider = $('#llm_provider').val();

        if ($(this).hasClass('neo-range-slider')) {
            $(this).next('.neo-range-input').val($(this).val());
        } else if ($(this).hasClass('neo-range-input')) {
            $(this).prev('.neo-range-slider').val($(this).val());
        }

        saveParameterValues(provider);
    });

    // 체크박스 이벤트 핸들러들 (단순화)
    $('#llm_translation_button_toggle').on('change', function () {
        extensionSettings.show_input_translate_button = $(this).is(':checked');
        saveSettingsDebounced();
        updateInputTranslateButton();
    });

    // [1.6.0] 보내기 번역 설정
    $('#llm_send_translate').off('change').on('change', function () {
        toggleSendTranslate($(this).is(':checked'));
    });
    $('#llm_send_target_language').off('change').on('change', function () {
        extensionSettings.send_target_language = String($(this).val() || '').trim() || 'English';
        $(this).val(extensionSettings.send_target_language);
        saveSettingsDebounced();
        refreshSendButton();
    });
    $('#llm_send_dialogue_language').off('change').on('change', function () {
        extensionSettings.send_dialogue_language = String($(this).val() || '').trim();
        $(this).val(extensionSettings.send_dialogue_language);
        saveSettingsDebounced();
        refreshSendButton();
    });
    $('#llm_send_display').off('change').on('change', function () {
        extensionSettings.send_display = $(this).val();
        saveSettingsDebounced();
    });
    // [1.6.2] 번역해서 보낸 내 메시지가 화면에 그려진 뒤, '다시 번역' 이면 보낸 글(번역문)을 채팅 번역 프롬프트로 한국어로 되돌려 보여 준다
    // — AI 답변과 같은 번역체라 나중에 읽어도 말투가 이어진다. translateMessage 의 진행 중 가드가 자동 번역 모드와의 중복을 막는다
    eventSource.on(event_types.USER_MESSAGE_RENDERED, onUserRenderedBackTranslate);
    for (const key of SEND_CTX_KEYS) {
        $(`#llm_${key}`).off('change').on('change', function () {
            extensionSettings[key] = $(this).is(':checked');
            saveSettingsDebounced();
        });
    }
    // 보내는 메시지를 채팅에 넣은 직후(프롬프트 만들기 전)에 번역 — emit 이 기다려 주므로 번역이 끝난 뒤 생성이 이어진다
    eventSource.on(event_types.MESSAGE_SENT, onMessageSentTranslate);
	
	// [변경] 자동 번역 모드 드롭다운 변경 이벤트
    $('#llm_auto_mode').off('change').on('change', function () {
        extensionSettings.auto_mode = $(this).val();
        saveSettingsDebounced();
    });

    $('#force_sequential_matching').on('change', function () {
        extensionSettings.force_sequential_matching = $(this).is(':checked');
        saveSettingsDebounced();
    });

    $('#llm_prefill_toggle').on('change', function () {
        extensionSettings.llm_prefill_toggle = $(this).is(':checked');
        saveSettingsDebounced();
    });

    // 버튼 가시성 설정 (통합)
    $('#hide_legacy_translate_button, #hide_toggle_button, #hide_new_translate_button, #hide_paragraph_button, #hide_edit_button, #hide_delete_button').on('change', function () {
        const setting = $(this).attr('id');
        extensionSettings[setting] = $(this).is(':checked');
        saveSettingsDebounced();
        updateButtonVisibility();
    });

    // ===== SillyTavern 기본 번역 로직 채택 =====

    // 이벤트 핸들러 등록 (SillyTavern 스타일)
    eventSource.makeFirst(event_types.CHARACTER_MESSAGE_RENDERED, handleIncomingMessage);
    eventSource.makeFirst(event_types.USER_MESSAGE_RENDERED, handleOutgoingMessage);
    eventSource.on(event_types.MESSAGE_SWIPED, (messageId) => {
        // 스와이프시 이전 번역 진행 상태 정리
        if (translationInProgress[messageId]) {
            translationInProgress[messageId] = false;
        }

        // 스와이프시 이전 번역문도 정리 (새 원문에 대한 번역을 위해)
        const context = getContext();
        const message = context.chat[messageId];
        if (message?.extra?.display_text) {
            // [1.9.2] 이미 번역한 스와이프로 돌아오면 실리태번이 그 스와이프의 번역문(과 해시)을 되살린다. 지금 글의 것이면 그대로 둔다.
            //         예전에는 지워서 자동 번역을 끈 채팅에선 번역이 사라지고(화면엔 남아 저장본과 달랐다), 켠 채팅에선 이 기기 DB 에 없으면 API 를 다시 불렀다.
            const current = substituteParams(message.mes, context.name1, message.name);
            if (message.extra.original_text_hash === originalHashOf(current) && !looksLikeRefusal(current, message.extra.display_text)) {
                $(`#chat .mes[mesid="${messageId}"] .mes_text`).removeData('showing-original'); // 원문 보기 여부는 그 스와이프의 백업으로 판단
                return;
            }
            delete message.extra.display_text;

            // UI에서도 showing-original 플래그 초기화
            const messageBlock = $(`#chat .mes[mesid="${messageId}"]`);
            const textBlock = messageBlock.find('.mes_text');
            textBlock.removeData('showing-original');
        }

        handleIncomingMessage(messageId);
    });
    eventSource.on(event_types.MESSAGE_UPDATED, handleMessageEdit);

    // 메세지에 자동 번역버튼 추가
    if (!window.llmTranslatorObserver) {
        window.llmTranslatorObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.classList?.contains('mes')) {
                        const $node = $(node);
                        if (!$node.find('.mes_llm_translate').length) {
                            createTranslateButtons($node);
                            // 새로 생성된 버튼들의 가시성 업데이트
                            updateButtonVisibility(node);
                        }
                    }
                });
            });
        });

        // [2.1.2] subtree 를 껐다 — 실리태번은 .mes 를 늘 #chat 의 직계 자식으로 넣는다
        // (append · prepend · showMore.after · insertBefore 모두 형제로 들어감).
        // 켜 두면 답이 오는 동안 글자 조각마다 콜백이 돌아 헛일이었다.
        window.llmTranslatorObserver.observe(document.getElementById('chat'), {
            childList: true,
            subtree: false
        });
    }

    // 기존 메시지에 아이콘 추가
    addButtonsToExistingMessages();

    // 설정에 따라 버튼 가시성 업데이트
    updateButtonVisibility();

    // 메시지 버튼 클릭 이벤트 (통합된 위임 방식)
    $(document).on('click', '.mes .mes_legacy_translate', function () {
        const messageId = $(this).closest('.mes').attr('mesid');
        translateMessage(messageId, true, 'manual');
    })
        .on('click', '.mes .mes_llm_translate', function () {
            const messageId = $(this).closest('.mes').attr('mesid');
            handleTranslateButtonClick(messageId);
        })
        .on('click', '.mes .mes_toggle_original', function () {
            const messageId = $(this).closest('.mes').attr('mesid');
            toggleOriginalText(messageId);
        })
        .on('click', '.mes .mes_edit_translation', function () {
            const messageId = $(this).closest('.mes').attr('mesid');
            editTranslation(messageId);
        })
        .on('click', '.mes .mes_paragraph_correction', function () {
            const messageId = $(this).closest('.mes').attr('mesid');
            retranslateMessage(messageId, 'paragraph', true);
        })
        .on('click', '.mes .mes_delete_translation', function () {
            const messageId = $(this).closest('.mes').attr('mesid');
            deleteTranslationById(messageId).catch(error => {
                console.error('Delete translation error:', error);
                toastr.error('번역문 삭제 중 오류가 발생했습니다.');
            });
        });

    // 채팅 변경 시 아이콘 추가 및 규칙 프롬프트 로딩을 위해 이벤트 핸들러 등록
    // [추가] 본체 설정 주소를 물려받는 중에 본체의 Custom 주소가 바뀌면 그 주소의 목록으로 다시 그린다.
    eventSource.on(event_types.SETTINGS_UPDATED, function () {
        if ($('#llm_provider').val() !== 'custom') {
            return;
        }
        const config = getCustomEndpointConfig();
        if (!config.inheritExtras || config.url === lastRenderedCustomUrl) {
            return;
        }
        updateModelList();
        autoFetchCustomModelsIfEmpty();
    });

    eventSource.on(event_types.CHAT_CHANGED, function () {
        migrateOriginalCopies(getContext().chat); // [1.7.1] 원문 사본 → 해시 (파일 크기)
        setTimeout(() => {
            addButtonsToExistingMessages();
            updateButtonVisibility(); // 설정에 따라 버튼 가시성 업데이트
            loadRulePrompt(); // 채팅이 바뀔 때마다 해당 채팅의 규칙 프롬프트 로드
            // [2.1.3] 캐릭터가 바뀌었으면 고치던 항목을 놓는다 (같은 캐릭터의 다른 채팅이면 그대로)
            if (glossaryEditingId && glossaryScopeView === 'char' && glossaryScopeKey() !== glossaryEditingKey) resetGlossaryEditor();
            renderGlossary(); // [1.8.0] 캐릭터가 바뀌면 그 캐릭터의 용어집으로
        }, 100);
    });

    // 추가 설정 이벤트 핸들러들 (통합)
    $('#throttle_delay').on('input change', function () {
        extensionSettings.throttle_delay = $(this).val();
        saveSettingsDebounced();
    });

    // 리버스 프록시 설정들 (통합)
    $('#llm_use_reverse_proxy, #llm_reverse_proxy_url, #llm_reverse_proxy_password').on('change input', function () {
        saveReverseProxySettings();
    });

    $('#llm_reverse_proxy_password_show').on('click', function () {
        const passwordInput = $('#llm_reverse_proxy_password');
        const type = passwordInput.attr('type') === 'password' ? 'text' : 'password';
        passwordInput.attr('type', type);
        $(this).toggleClass('fa-eye-slash fa-eye');
    });

    // 규칙 프롬프트 이벤트 핸들러
    $('#llm_rule_prompt').on('input change', saveRulePrompt);
    initGlossaryUI(); // [1.8.0] 용어집 카드


    // 사용자 정의 정규식 입력 이벤트 핸들러
    $('#llm_user_regexes').off('input change').on('input change', function () {
        const text = $(this).val();
        // 줄바꿈으로 분리하고 빈 줄은 제거하여 배열로 저장
        extensionSettings.user_defined_regexes = text.split('\n').filter(line => line.trim() !== '');
        saveSettingsDebounced();
    });
	
	//접기 금지 정규식 입력 이벤트 핸들러
    $('#llm_user_no_fold_regexes').off('input change').on('input change', function () {
        const text = $(this).val();
        extensionSettings.user_no_fold_regexes = text.split('\n').filter(line => line.trim() !== '');
        saveSettingsDebounced();
    });
	
    // 규칙 프롬프트 편집 버튼 클릭 리스너 추가
    $(document).off('click', '.rule-prompt-editor-button').on('click', '.rule-prompt-editor-button', async function () {
        // 규칙 프롬프트 textarea 가져오기
        const rulePromptTextarea = $('#llm_rule_prompt');

        // textarea를 찾았는지 확인
        if (!rulePromptTextarea.length) {
            console.error('[LLM Translator] Could not find rule prompt textarea');
            toastr.error('규칙 프롬프트 텍스트 영역을 찾을 수 없습니다.');
            return;
        }

        // 팝업에 표시할 요소들 생성
        const wrapper = document.createElement('div');
        wrapper.classList.add('height100p', 'wide100p', 'flex-container', 'flexFlowColumn');

        const popupTextarea = document.createElement('textarea');
        popupTextarea.value = rulePromptTextarea.val(); // 현재 규칙 프롬프트 내용 복사
        popupTextarea.classList.add('height100p', 'wide100p');

        // 팝업 textarea 변경 시 원본 textarea 및 메타데이터 실시간 업데이트
        popupTextarea.addEventListener('input', function () {
            // 원본 textarea 값 변경
            rulePromptTextarea.val(popupTextarea.value).trigger('input');

            // 규칙 프롬프트를 채팅 메타데이터에 저장
            const context = getContext();
            if (context) {
                if (!context.chatMetadata) {
                    context.chatMetadata = {};
                }
                context.chatMetadata[RULE_PROMPT_KEY] = popupTextarea.value;
                saveMetadataDebounced();
            }
        });

        wrapper.appendChild(popupTextarea);

        // SillyTavern의 callGenericPopup 호출
        try {
            if (typeof callGenericPopup === 'function' && typeof POPUP_TYPE !== 'undefined' && POPUP_TYPE.TEXT) {
                const popupTitle = '규칙 프롬프트 편집';
                await callGenericPopup(wrapper, POPUP_TYPE.TEXT, popupTitle, { wide: true, large: true });
                $(this).focus();
            } else {
                console.error('[LLM Translator] callGenericPopup or POPUP_TYPE.TEXT is not available.');
                toastr.error('SillyTavern의 팝업 기능을 사용할 수 없습니다.');
            }
        } catch (error) {
            console.error('[LLM Translator] Error calling callGenericPopup:', error);
            toastr.error('팝업을 여는 중 오류가 발생했습니다.');
        }
    });


}



















// IndexedDB 연결 함수
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = (event) => {
            reject(new Error("indexedDB open error"));
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            objectStore.createIndex('originalText', 'originalText', { unique: false });
            objectStore.createIndex('provider', 'provider', { unique: false }); // 프로바이더 인덱스 추가
            objectStore.createIndex('model', 'model', { unique: false }); // 모델 인덱스 추가
            objectStore.createIndex('date', 'date', { unique: false }); // 날짜 인덱스 추가
        };
    })
}

// 데이터 추가 함수 수정
async function addTranslationToDB(originalText, translation) {
    const db = await openDB();
    const provider = extensionSettings.llm_provider;
    const model = extensionSettings.llm_model;

    // UTC 시간을 ISO 문자열로 가져오기
    const utcDate = new Date();

    // 한국 시간으로 변환 (UTC+9)
    const koreanDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 시간

    // ISO 문자열로 저장
    const date = koreanDate.toISOString();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const record = { originalText: originalText, translation: translation, provider: provider, model: model, date: date };

        // [1.9.2] 같은 원문의 줄이 있으면 더하지 않고 그 줄을 고쳐 쓴다 (남은 중복 줄은 지움).
        //         예전에는 늘 더하기만 했는데 찾기는 가장 오래된 줄을 읽어서, 예전 버전이 넣어 둔 거절문 줄이 있으면
        //         새 번역을 넣어도 계속 '없음' 으로 보여 번역할 때마다 API 를 다시 부르고 줄만 늘었다.
        const lookup = store.index('originalText').getAllKeys(originalText);
        lookup.onsuccess = () => {
            const [first, ...rest] = lookup.result || [];
            rest.forEach(key => store.delete(key));
            const request = first === undefined ? store.add(record) : store.put({ ...record, id: first });
            request.onsuccess = (event) => {
                resolve("add success");
            };
            request.onerror = (event) => {
                reject(new Error("add error"));
            };
        };
        lookup.onerror = () => {
            reject(new Error("add error"));
        };
        transaction.oncomplete = function () {
            db.close();
        };

    });
}

// 모든 데이터 가져오기
async function getAllTranslationsFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        request.onerror = (event) => {
            reject(new Error("get all error"));
        };

        transaction.oncomplete = function () {
            db.close();
        };
    })
}

// 다운로드
async function downloadDB() {
    const data = await getAllTranslationsFromDB();
    if (data && data.length > 0) {
        const jsonData = JSON.stringify(data);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // 브라우저 이름 가져오기
        const browserName = getBrowserName();

        // 현재 날짜와 시간을 DD_HH 형식으로 파일명에 추가
        const now = new Date();
        const formattedDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

        a.download = `${browserName}_SillyLLMtranslations_${formattedDate}.json`;

        a.click();
        URL.revokeObjectURL(url);
    } else {
        toastr.error('저장된 데이터가 없습니다.');
    }
}


// 브라우저 이름 가져오는 함수
function getBrowserName() {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';

    if (userAgent.indexOf('Chrome') > -1) {
        browserName = 'Chrome';
    } else if (userAgent.indexOf('Firefox') > -1) {
        browserName = 'Firefox';
    } else if (userAgent.indexOf('Safari') > -1) {
        browserName = 'Safari';
    } else if (userAgent.indexOf('Edge') > -1) {
        browserName = 'Edge';
    } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
        browserName = 'Opera';
    }

    return browserName;
}

//DB 복원
async function restoreDB(file) {
    const db = await openDB();
    const reader = new FileReader();
    reader.onload = async function (event) {
        try {
            const backupData = JSON.parse(event.target.result);
            return new Promise(async (resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);

                for (const item of backupData) {
                    const index = store.index('originalText');
                    const request = index.get(item.originalText);

                    await new Promise((resolveGet) => {
                        request.onsuccess = async (event) => {
                            const record = event.target.result;
                            if (record) {
                                // 기존에 데이터가 있으면 갱신
                                await new Promise((resolvePut) => {
                                    const updateRequest = store.put({ ...record, translation: item.translation, provider: item.provider, model: item.model, date: item.date });
                                    updateRequest.onsuccess = () => {
                                        resolvePut();
                                    }
                                    updateRequest.onerror = (e) => {
                                        reject(new Error("restore put error"));
                                        resolvePut();
                                    }
                                })
                            } else {
                                // 없으면 추가
                                await new Promise((resolveAdd) => {
                                    const addRequest = store.add(item);
                                    addRequest.onsuccess = () => {
                                        resolveAdd();
                                    }
                                    addRequest.onerror = (e) => {
                                        reject(new Error("restore add error"));
                                        resolveAdd();
                                    }
                                })
                            }
                            resolveGet();
                        }
                        request.onerror = (e) => {
                            reject(new Error("restore get error"));
                            resolveGet();
                        }
                    })
                }

                transaction.oncomplete = function () {
                    db.close();
                    toastr.success('데이터를 복원했습니다.');
                    globalThis[Symbol.for('blue-lemonade.translator')] = { processTranslationText };
        resolve();
                }

                transaction.onerror = function (event) {
                    db.close();
                    reject(new Error("restore transaction error"));
                }
            });
        } catch (e) {
            toastr.error("올바르지 않은 파일형식입니다.");
        }
    }
    reader.readAsText(file);
}


// 데이터 업데이트 함수 수정
async function updateTranslationByOriginalText(originalText, newTranslation) {
    const db = await openDB();
    const provider = extensionSettings.llm_provider;
    const model = extensionSettings.llm_model;

    // UTC 시간을 ISO 문자열로 가져오기
    const utcDate = new Date();

    // 한국 시간으로 변환 (UTC+9)
    const koreanDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 시간

    // ISO 문자열로 저장
    const date = koreanDate.toISOString();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('originalText');
        const request = index.getAll(originalText); // [1.9.2] 같은 원문 줄이 여럿이면 하나로 (addTranslationToDB 참고)

        request.onsuccess = async (event) => {
            const [record, ...rest] = event.target.result || [];

            if (record) {
                rest.forEach(extra => store.delete(extra.id));
                const updateRequest = store.put({ ...record, translation: newTranslation, provider: provider, model: model, date: date });
                updateRequest.onsuccess = () => {
                    globalThis[Symbol.for('blue-lemonade.translator')] = { processTranslationText };
        resolve();
                };
                updateRequest.onerror = (e) => {
                    reject(new Error('put error'));
                };
            } else {
                reject(new Error('no matching data'));
            }
        };
        request.onerror = (e) => {
            reject(new Error('get error'));
        };
        transaction.oncomplete = function () {
            db.close();
        };
    });
}

// IndexedDB에서 번역 데이터 가져오는 함수
// 메시지 번역 경로용: 사생활 모드 · 용량 초과 · 깨진 DB 로 IndexedDB 가 실패해도 번역은 새로 하고, 받은 번역문은 붙인다 (예전엔 저장 실패가 유료 번역을 버렸다)
async function readCachedTranslation(originalText) {
    try { return await getTranslationFromDB(originalText); }
    catch (error) { console.warn('[LLM Translator] 번역 캐시 읽기 실패 — 새로 번역해요:', error?.message || error); return null; }
}
// 5.4.2: 사용자가 번역문을 지우면(휴지통 · 수정 창에서 비우기 · 삭제 명령) 그 글의 문단 캐시도 지운다 — 메시지 캐시만 지워서
//        다시 번역하면 요청 없이 문단 캐시가 옛 번역을 그대로 돌려줬다 ('번역을 시작합니다' 만 뜨고 같은 글)
async function forgetParagraphCache(originalText) {
    try { await translate(originalText, { segmentCache: true, forget: true }); }
    catch (error) { console.warn('[LLM Translator] 문단 캐시 지우기 실패:', error?.message || error); }
}
async function storeTranslationQuietly(originalText, translation) {
    // 5.4.1: 원문을 베껴 품은 번역(원문+화살표+번역 · ⟦n] 표시)은 캐시에 넣지 않는다 — 다시 번역해도 캐시에서 같은 글이 나왔다
    if (hasSourceEcho(originalText, translation)) { console.warn('[LLM Translator] 번역문에 원문이 섞여 있어 캐시에 넣지 않았어요'); return; }
    try { await addTranslationToDB(originalText, translation); }
    catch (error) { console.warn('[LLM Translator] 번역 캐시 저장 실패 — 번역문은 붙였어요:', error?.message || error); }
}

async function getTranslationFromDB(originalText) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('originalText');
        const request = index.getAll(originalText);

        request.onsuccess = (event) => {
            // [1.9.0] 예전 버전이 캐시에 넣어 둔 거절문은 없는 셈 친다 (다시 번역하게)
            // [1.9.2] 같은 원문 줄이 여럿이면(예전 버전의 중복) 가장 새 줄부터 거절문이 아닌 것을 쓴다 — 가장 오래된 줄이 거절문이면
            //         뒤에 넣은 좋은 번역이 있어도 '없음' 이었다
            const records = event.target.result || [];
            // 5.4.1: 원문 되풀이가 섞인 번역(원문+화살표+번역 · ⟦n] 표시)도 없는 셈 친다 — 다시 번역하면 새로 받는다
            const record = records.reverse().find(item => !looksLikeRefusal(originalText, item.translation) && !hasSourceEcho(originalText, item.translation));
            resolve(record ? record.translation : null);
        };
        request.onerror = (e) => {
            reject(new Error("get error"));
        };
        transaction.oncomplete = function () {
            db.close();
        };
    });
}


// IndexedDB 삭제 함수
async function deleteDB() {
    const confirm = await callGenericPopup(
        '모든 번역 데이터를 삭제하시겠습니까?',
        POPUP_TYPE.CONFIRM
    );

    if (!confirm) {
        return;
    }

    guards.chatChanged();
    await clearCheckpoints();
    await clearSegmentCache();
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => {
            toastr.success('모든 번역 데이터가 삭제되었습니다.');
            globalThis[Symbol.for('blue-lemonade.translator')] = { processTranslationText };
        resolve();
        };
        request.onerror = (event) => {
            toastr.error('데이터 삭제에 실패했습니다.');
            reject(new Error("db delete error"));
        };
    });
}


// IndexedDB 데이터 삭제 함수 (originalText 기반)
async function deleteTranslationByOriginalText(originalText) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('originalText');
        const request = index.getAll(originalText);

        request.onsuccess = async (event) => {
            const [record, ...rest] = event.target.result || [];
            if (record) {
                // [1.9.2] 같은 원문 줄을 모두 지운다 — 하나만 지우면 남은 중복 줄이 '삭제한' 번역을 캐시에서 다시 돌려줬다
                rest.forEach(extra => store.delete(extra.id));
                const deleteRequest = store.delete(record.id);
                deleteRequest.onsuccess = () => {
                    globalThis[Symbol.for('blue-lemonade.translator')] = { processTranslationText };
        resolve();
                }
                deleteRequest.onerror = (e) => {
                    reject(new Error('delete error'));
                }
            } else {
                reject(new Error('no matching data'));
            }
        }
        request.onerror = (e) => {
            reject(new Error('get error'));
        };
        transaction.oncomplete = function () {
            db.close();
        };
    })
}

//----------v3


// --- 로깅 헬퍼 ---
function logDebug(...args) {
    if (DEBUG_MODE) {
        console.log(`[${extensionName} Debug]`, ...args);
    }
}


// --- 메타데이터 기반 백업/복원/정리 함수 ---

/**
 * 현재 브라우저의 번역 캐시(IndexedDB)를 현재 로드된 채팅의 메타데이터에 백업합니다.
 * @returns {Promise<void>}
 */
async function backupTranslationsToMetadata() {
    const DEBUG_PREFIX = `[${extensionName} - Backup]`;
    if (isChatTranslationInProgress) {
        toastr.warning('이미 백업 작업이 진행 중입니다.');
        logDebug('Backup already in progress. Exiting.');
        return;
    }

    // 백업용 챗봇 확인 로직 (선택적이지만 권장)
    // const context = getContext();
    // if (context.characterId !== 'YOUR_BACKUP_BOT_ID') {
    //     toastr.error('이 작업은 백업용으로 지정된 캐릭터/채팅에서만 실행해야 합니다.');
    //     logDebug('Backup attempt on non-backup chat cancelled.');
    //     return;
    // }

    try {
        isChatTranslationInProgress = true;
        toastr.info('번역 캐시 백업 시작... (데이터 양에 따라 시간이 걸릴 수 있습니다)');
        logDebug('Starting backup to metadata...');

        const context = getContext(); // 이미 import 되어 있음
        if (!context || !context.chatMetadata) {
            throw new Error('컨텍스트 또는 메타데이터를 찾을 수 없습니다.');
        }

        logDebug('Context and metadata found.');

        // 1. IndexedDB에서 모든 데이터 가져오기
        const allTranslations = await getAllTranslationsFromDB();

        if (!allTranslations || allTranslations.length === 0) {
            toastr.info('백업할 번역 데이터가 없습니다.');
            logDebug('No translation data found in IndexedDB to back up.');
            return; // 작업 종료
        }
        logDebug(`Retrieved ${allTranslations.length} translation items from IndexedDB.`);

        // 2. 데이터 직렬화 (JSON 문자열로 변환)
        // **대용량 처리:** 필요 시 여기서 pako.js 압축 로직 추가
        const backupDataString = JSON.stringify(allTranslations);
        logDebug(`Data stringified. Length: ${backupDataString.length} bytes.`);

        // 3. 메타데이터에 저장
        if (typeof context.chatMetadata !== 'object' || context.chatMetadata === null) {
            logDebug('chatMetadata is not an object, initializing.');
            context.chatMetadata = {};
        }
        context.chatMetadata[METADATA_BACKUP_KEY] = backupDataString;
        logDebug(`Stored backup string in chatMetadata under key: ${METADATA_BACKUP_KEY}`);

        // 4. 서버에 메타데이터 저장 요청
        saveMetadataDebounced();
        logDebug('saveMetadataDebounced() called to trigger server save.');

        toastr.success(`번역 캐시 백업 완료! (${allTranslations.length}개 항목)`);
        logDebug('Backup completed successfully.');

    } catch (error) {
        console.error(`${DEBUG_PREFIX} Error during backup:`, error);
        toastr.error(`백업 중 오류 발생: ${error.message || '알 수 없는 오류'}`);
    } finally {
        isChatTranslationInProgress = false;
        logDebug('Backup process finished.');
    }
}

/**
 * 현재 로드된 채팅의 메타데이터에서 번역 캐시 백업을 복원하여
 * 현재 브라우저의 IndexedDB에 **존재하지 않는 데이터만 추가**합니다.
 * 진행 상황을 **직접 생성한 프로그레스 바로** 표시합니다.
 * @returns {Promise<void>}
 */
async function restoreTranslationsFromMetadata() {
    const DEBUG_PREFIX = `[${extensionName} - Restore AddOnly Progress]`;
    if (isChatTranslationInProgress) {
        toastr.warning('이미 복원 작업이 진행 중입니다.');
        logDebug('Restore already in progress. Exiting.');
        return;
    }

    // 복원용 챗봇 확인 로직 (선택적)

    // --- 프로그레스 바 UI 요소 참조를 위한 변수 ---
    let progressContainer = null;
    let progressBarInner = null;
    let progressLabel = null;
    // ---

    try {
        isChatTranslationInProgress = true;
        logDebug('Starting restore from metadata (Add-Only mode)...');
        // Toastr 시작 메시지 제거 (프로그레스 바가 대신함)

        const context = getContext();
        if (!context || !context.chatMetadata) {
            throw new Error('컨텍스트 또는 메타데이터를 찾을 수 없습니다.');
        }
        logDebug('Context and metadata found.');

        // 1. 메타데이터에서 백업 데이터 가져오기
        const backupDataString = context.chatMetadata[METADATA_BACKUP_KEY];
        if (!backupDataString || typeof backupDataString !== 'string') {
            toastr.warning('현재 채팅에 저장된 번역 백업 데이터가 없습니다.');
            logDebug(`No backup data found in metadata for key: ${METADATA_BACKUP_KEY}`);
            return; // 복원할 데이터 없으면 종료
        }
        logDebug(`Retrieved backup string from metadata. Length: ${backupDataString.length} bytes.`);

        // 2. 데이터 역직렬화 (JSON 파싱)
        // **대용량 처리:** 필요 시 여기서 pako.js 압축 해제 로직 추가
        let backupData;
        try {
            backupData = JSON.parse(backupDataString);
            if (!Array.isArray(backupData)) throw new Error('백업 데이터 형식이 올바르지 않습니다 (배열이 아님).');
            logDebug(`Backup data parsed successfully. Items: ${backupData.length}`);
        } catch (parseError) {
            console.error(`${DEBUG_PREFIX} Error parsing backup data:`, parseError);
            throw new Error('백업 데이터를 파싱하는 중 오류가 발생했습니다.');
        }

        const totalItems = backupData.length;
        if (totalItems === 0) {
            toastr.info('백업 데이터에 복원할 항목이 없습니다.');
            logDebug('Backup data array is empty. Nothing to restore.');
            return; // 복원할 항목 없으면 종료
        }
        logDebug(`Starting restore process for ${totalItems} items.`);

        // --- 프로그레스 바 UI 동적 생성 ---
        logDebug('Creating progress bar UI...');
        progressContainer = document.createElement('div');
        progressContainer.id = 'llm-translator-progress-blocker';
        progressContainer.style.position = 'fixed';
        progressContainer.style.top = '0';
        progressContainer.style.left = '0';
        progressContainer.style.width = '100%';
        progressContainer.style.height = '100%';
        progressContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        progressContainer.style.zIndex = '10000';
        progressContainer.style.display = 'flex';
        progressContainer.style.justifyContent = 'center';
        progressContainer.style.alignItems = 'center';

        // 색은 실리태번 테마(블루 레몬에이드면 그 에이드) 색을 쓴다. 테마 변수가 없을 때만 예전 회색 · 초록.
        const progressContent = document.createElement('div');
        progressContent.style.backgroundColor = 'var(--SmartThemeBlurTintColor, #333)';
        progressContent.style.padding = '20px';
        progressContent.style.borderRadius = '8px';
        progressContent.style.color = 'var(--SmartThemeBodyColor, white)';
        progressContent.style.textAlign = 'center';
        progressContent.style.minWidth = '300px';

        const progressTitle = document.createElement('div');
        progressTitle.textContent = '번역 캐시 복원 중...';
        progressTitle.style.marginBottom = '15px';
        progressTitle.style.fontSize = '1.2em';

        const progressBarOuter = document.createElement('div');
        // 막대 바닥: 글자색을 옅게 (블루 레몬에이드는 테두리 색을 투명으로 두어 테두리 색을 쓰면 바닥이 안 보인다)
        // color-mix를 모르는 예전 브라우저는 두 번째 값을 버리므로 첫 값(#555)이 남는다.
        progressBarOuter.style.backgroundColor = '#555';
        progressBarOuter.style.backgroundColor = 'color-mix(in srgb, var(--SmartThemeBodyColor, #fff) 16%, transparent)';
        progressBarOuter.style.borderRadius = '5px';
        progressBarOuter.style.overflow = 'hidden';
        progressBarOuter.style.height = '20px';
        progressBarOuter.style.marginBottom = '10px';
        progressBarOuter.style.position = 'relative';

        progressBarInner = document.createElement('div');
        progressBarInner.style.backgroundColor = 'var(--SmartThemeQuoteColor, #4CAF50)';
        progressBarInner.style.height = '100%';
        progressBarInner.style.width = '0%';
        progressBarInner.style.transition = 'width 0.1s linear';

        progressLabel = document.createElement('div');
        progressLabel.textContent = `0 / ${totalItems} (0%)`;
        progressLabel.style.fontSize = '0.9em';

        progressBarOuter.appendChild(progressBarInner);
        progressContent.appendChild(progressTitle);
        progressContent.appendChild(progressBarOuter);
        progressContent.appendChild(progressLabel);
        progressContainer.appendChild(progressContent);
        document.body.appendChild(progressContainer);
        logDebug('Progress bar UI created and appended to body.');
        // --- 프로그레스 바 UI 생성 끝 ---


        // 3. IndexedDB에 데이터 병합 (Add-Only 로직 적용)
        let addedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < totalItems; i++) {
            const item = backupData[i];
            const currentProgress = i + 1;

            // --- 프로그레스 바 업데이트 ---
            const progressPercentage = (currentProgress / totalItems) * 100;
            progressBarInner.style.width = `${progressPercentage}%`;
            progressLabel.textContent = `${currentProgress} / ${totalItems} (${Math.round(progressPercentage)}%)`;
            // ---

            // UI 멈춤 방지 및 진행률 로그 (예: 100개 마다)
            if (i > 0 && i % 100 === 0) {
                logDebug(`Restore progress: ${currentProgress}/${totalItems} (${Math.round(progressPercentage)}%)`);
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            // 필수 필드 확인
            if (!item || typeof item.originalText !== 'string' || typeof item.translation !== 'string') {
                logDebug(`Skipping invalid item at index ${i}:`, item);
                errorCount++; // 유효하지 않은 항목은 오류로 간주
                continue;
            }

            // 데이터 병합 로직 (Add-Only)
            try {
                // logDebug(`Checking local DB for item ${i}: "${item.originalText.substring(0,30)}..."`); // 개별 확인 로그 (너무 많을 수 있음)
                const localTranslationExists = await getTranslationFromDB(item.originalText) !== null;

                if (!localTranslationExists) {
                    // logDebug(`Item ${i} not found locally. Adding...`); // 개별 추가 로그
                    await addTranslationToDB(item.originalText, item.translation /*, item.provider, item.model, item.date */);
                    addedCount++;
                } else {
                    // logDebug(`Item ${i} already exists locally. Skipping.`); // 개별 스킵 로그
                    skippedCount++;
                }
            } catch (dbError) {
                console.error(`${DEBUG_PREFIX} Error processing item at index ${i} (original: ${item.originalText.substring(0, 50)}...):`, dbError);
                errorCount++;
            }
        }

        // 최종 결과 로그 및 알림 (기존과 동일)
        logDebug(`Restore (Add-Only) completed. Added: ${addedCount}, Skipped (Existing): ${skippedCount}, Errors: ${errorCount}`);
        if (errorCount > 0) {
            toastr.warning(`복원 완료. ${addedCount}개 추가, ${skippedCount}개 건너뜀. ${errorCount}개 오류 발생.`);
        } else {
            toastr.success(`번역 캐시 복원 완료! (${addedCount}개 추가, ${skippedCount}개 건너뜀)`);
        }

        // 복원 후 메타데이터 자동 삭제 안 함
        // 필요 시 /llmClearBackup 커맨드를 사용
        logDebug('Metadata backup was NOT automatically cleared after restore (as requested).');

        // UI 갱신 필요 시 추가

    } catch (error) {
        console.error(`${DEBUG_PREFIX} Error during restore:`, error);
        toastr.error(`복원 중 오류 발생: ${error.message || '알 수 없는 오류'}`);
    } finally {
        // --- 프로그레스 바 UI 제거 ---
        if (progressContainer && document.body.contains(progressContainer)) {
            logDebug('Removing progress bar UI.');
            document.body.removeChild(progressContainer);
        } else {
            logDebug('Progress bar UI was not found or already removed.');
        }
        // ---
        isChatTranslationInProgress = false;
        logDebug('Restore process finished.');
    }
}

/**
 * 현재 로드된 채팅의 메타데이터에서 번역 캐시 백업을 삭제합니다.
 * @returns {Promise<void>}
 */
async function clearBackupFromMetadata() {
    const DEBUG_PREFIX = `[${extensionName} - Cleanup]`;
    if (isChatTranslationInProgress) {
        toastr.warning('이미 정리 작업이 진행 중입니다.');
        logDebug('Cleanup already in progress. Exiting.');
        return;
    }

    // 정리용 챗봇 확인 로직 (선택적)

    logDebug('Requesting metadata backup cleanup...');
    const confirm = await callGenericPopup(
        '현재 채팅에 저장된 번역 캐시 백업을 삭제하시겠습니까?\n(주의: 복구할 수 없습니다!)',
        POPUP_TYPE.CONFIRM
    );

    if (!confirm) {
        logDebug('Metadata cleanup cancelled by user.');
        toastr.info('백업 데이터 삭제가 취소되었습니다.');
        return;
    }
    logDebug('User confirmed metadata cleanup.');

    try {
        isChatTranslationInProgress = true;
        toastr.info('백업 데이터 삭제 시작...');
        logDebug('Starting cleanup of metadata backup...');

        const context = getContext();
        if (!context || !context.chatMetadata) {
            throw new Error('컨텍스트 또는 메타데이터를 찾을 수 없습니다.');
        }
        logDebug('Context and metadata found.');

        if (context.chatMetadata.hasOwnProperty(METADATA_BACKUP_KEY)) {
            logDebug(`Found backup data under key: ${METADATA_BACKUP_KEY}. Deleting...`);
            delete context.chatMetadata[METADATA_BACKUP_KEY]; // 메타데이터에서 키 삭제
            saveMetadataDebounced(); // 변경사항 저장 요청
            logDebug('saveMetadataDebounced() called to trigger server save.');
            toastr.success('채팅에 저장된 번역 캐시 백업이 삭제되었습니다.');
        } else {
            logDebug(`No backup data found under key: ${METADATA_BACKUP_KEY}. Nothing to delete.`);
            toastr.info('현재 채팅에 삭제할 번역 캐시 백업이 없습니다.');
        }
        logDebug('Cleanup completed successfully.');

    } catch (error) {
        console.error(`${DEBUG_PREFIX} Error during cleanup:`, error);
        toastr.error(`백업 데이터 삭제 중 오류 발생: ${error.message || '알 수 없는 오류'}`);
    } finally {
        isChatTranslationInProgress = false;
        logDebug('Cleanup process finished.');
    }
}

/**
 * 지정된 메시지 ID에 해당하는 번역문을 IndexedDB에서 가져옵니다.
 * @param {string} messageIdStr - 번역문을 가져올 메시지의 ID (문자열 형태)
 * @returns {Promise<string>} 번역문 또는 오류 메시지
 */
async function getTranslationById(messageIdStr) {
    const DEBUG_PREFIX = `[${extensionName} - GetByID]`;
    logDebug(`Attempting to get translation for message ID: ${messageIdStr}`);

    // 1. 메시지 ID 파싱 및 유효성 검사
    const messageId = parseInt(messageIdStr, 10);
    if (isNaN(messageId) || messageId < 0) {
        const errorMsg = `유효하지 않은 메시지 ID: "${messageIdStr}". 숫자를 입력하세요.`;
        logDebug(errorMsg);
        return errorMsg;
    }

    // 2. 컨텍스트 및 대상 메시지 가져오기
    const context = getContext();
    if (!context || !context.chat) {
        const errorMsg = '컨텍스트 또는 채팅 데이터를 찾을 수 없습니다.';
        logDebug(errorMsg);
        return `오류: ${errorMsg}`;
    }
    if (messageId >= context.chat.length) {
        const errorMsg = `메시지 ID ${messageId}를 찾을 수 없습니다. (채팅 길이: ${context.chat.length})`;
        logDebug(errorMsg);
        return errorMsg;
    }
    const message = context.chat[messageId];
    if (!message) {
        const errorMsg = `메시지 ID ${messageId}에 대한 데이터를 가져올 수 없습니다.`;
        logDebug(errorMsg);
        return `오류: ${errorMsg}`;
    }

    // 3. 원본 텍스트 가져오기 (DB 검색 키)
    const originalText = substituteParams(message.mes, context.name1, message.name);
    if (!originalText) {
        const errorMsg = `메시지 ID ${messageId}의 원본 텍스트를 가져올 수 없습니다.`;
        logDebug(errorMsg);
        return errorMsg;
    }
    logDebug(`Original text for message ID ${messageId} (used as DB key): "${originalText.substring(0, 50)}..."`);

    // 4. DB에서 해당 번역문 조회
    try {
        const translation = await getTranslationFromDB(originalText);

        if (translation) {
            logDebug(`Translation found for message ID ${messageId}`);
            return translation; // 번역문 반환
        } else {
            const noTranslationMsg = `메시지 ID ${messageId}에 대한 번역문이 DB에 없습니다.`;
            logDebug(noTranslationMsg);
            return noTranslationMsg;
        }

    } catch (error) {
        const errorMsg = `메시지 ID ${messageId}의 번역문 조회 중 오류가 발생했습니다.`;
        console.error(`${DEBUG_PREFIX} Error getting translation for message ID ${messageId}:`, error);
        return `오류: ${errorMsg}`;
    }
}

/**
 * 메시지가 숨겨져 있는지 확인합니다 (SillyTavern 방식)
 * @param {Object} message - 확인할 메시지 객체
 * @returns {boolean} 숨겨진 메시지 여부
 */
function isMessageHidden(message) {
    if (!message) return false;

    // SillyTavern에서 실제로 사용하는 숨김 메시지 체크
    // 숨겨진 메시지는 is_system 속성이 true인 메시지들입니다
    return message.is_system === true;
}

/**
 * 지정된 범위의 메시지들의 번역문을 가져옵니다.
 * @param {string} startIdStr - 시작 메시지 ID (문자열 형태)
 * @param {string} endIdStr - 종료 메시지 ID (문자열 형태)
 * @param {boolean} includeOriginal - 번역문이 없을 때 원문 포함 여부
 * @param {boolean} includeMessageId - 메시지 ID 출력 여부
 * @param {boolean} excludeHidden - 숨겨진 메시지 제외 여부
 * @returns {Promise<string>} 범위 내 번역문들을 연결한 결과
 */
async function getTranslationsInRange(startIdStr, endIdStr, includeOriginal = false, includeMessageId = false, excludeHidden = true) {
    const DEBUG_PREFIX = `[${extensionName} - GetTranslationsInRange]`;
    logDebug(`${DEBUG_PREFIX} Getting translations from ${startIdStr} to ${endIdStr}`);

    // 1. 메시지 ID 파싱 및 유효성 검사
    let startId = parseInt(startIdStr, 10);
    let endId = parseInt(endIdStr, 10);

    if (isNaN(startId) || isNaN(endId) || startId < 0 || endId < 0) {
        const errorMsg = `유효하지 않은 메시지 ID 범위: "${startIdStr}" ~ "${endIdStr}". 숫자를 입력하세요.`;
        logDebug(errorMsg);
        return errorMsg;
    }

    // 범위 순서 확인 및 수정
    if (startId > endId) {
        [startId, endId] = [endId, startId];
        logDebug(`${DEBUG_PREFIX} Swapped range order: ${startId} to ${endId}`);
    }

    // 2. 컨텍스트 및 채팅 데이터 확인
    const context = getContext();
    if (!context || !context.chat) {
        const errorMsg = '컨텍스트 또는 채팅 데이터를 찾을 수 없습니다.';
        logDebug(errorMsg);
        return `오류: ${errorMsg}`;
    }

    const chatLength = context.chat.length;
    if (startId >= chatLength) {
        const errorMsg = `시작 메시지 ID ${startId}를 찾을 수 없습니다. (채팅 길이: ${chatLength})`;
        logDebug(errorMsg);
        return errorMsg;
    }

    // 종료 ID가 범위를 벗어나면 마지막 메시지로 조정
    if (endId >= chatLength) {
        endId = chatLength - 1;
        logDebug(`${DEBUG_PREFIX} Adjusted end ID to ${endId} (chat length: ${chatLength})`);
    }

    // 3. 범위 내 메시지들의 번역문 수집
    const results = [];
    let translationCount = 0;
    let originalCount = 0;
    let hiddenCount = 0;

    for (let messageId = startId; messageId <= endId; messageId++) {
        const message = context.chat[messageId];
        if (!message) {
            logDebug(`${DEBUG_PREFIX} Message ${messageId} not found, skipping`);
            continue;
        }

        // 숨겨진 메시지 체크 (SillyTavern 방식)
        if (excludeHidden && isMessageHidden(message)) {
            logDebug(`${DEBUG_PREFIX} Message ${messageId} is hidden, skipping`);
            hiddenCount++;
            continue;
        }

        // 원본 텍스트 가져오기
        const originalText = substituteParams(message.mes, context.name1, message.name);
        if (!originalText || originalText.trim() === '') {
            logDebug(`${DEBUG_PREFIX} Message ${messageId} has empty content, skipping`);
            continue;
        }

        try {
            // DB에서 번역문 조회
            const translation = await getTranslationFromDB(originalText);

            if (translation && translation.trim() !== '') {
                // 번역문이 있는 경우
                if (includeMessageId) {
                    results.push(`[메시지 ${messageId}]`);
                }
                results.push(translation);
                results.push(''); // 번역문 간 구분을 위해 빈 줄 추가
                translationCount++;
                logDebug(`${DEBUG_PREFIX} Found translation for message ${messageId}`);
            } else if (includeOriginal) {
                // 번역문이 없고 원문 포함 옵션이 켜진 경우
                if (includeMessageId) {
                    results.push(`[메시지 ${messageId} - 원문]`);
                }
                results.push(originalText);
                results.push(''); // 텍스트 간 구분을 위해 빈 줄 추가
                originalCount++;
                logDebug(`${DEBUG_PREFIX} Using original text for message ${messageId}`);
            }
            // includeOriginal이 false이고 번역문이 없으면 해당 메시지는 건너뜀
        } catch (error) {
            logDebug(`${DEBUG_PREFIX} Error getting translation for message ${messageId}:`, error);
            if (includeOriginal) {
                if (includeMessageId) {
                    results.push(`[메시지 ${messageId} - 원문 (오류로 인한 대체)]`);
                }
                results.push(originalText);
                results.push(''); // 텍스트 간 구분을 위해 빈 줄 추가
                originalCount++;
            }
        }
    }

    // 4. 결과 반환
    if (results.length === 0) {
        const noResultMsg = `메시지 ID ${startId}~${endId} 범위에서 ${includeOriginal ? '텍스트' : '번역문'}를 찾을 수 없습니다.`;
        logDebug(`${DEBUG_PREFIX} ${noResultMsg}`);
        return noResultMsg;
    }

    const resultText = results.join('\n');
    let summaryMsg = `메시지 ID ${startId}~${endId} 범위: 번역문 ${translationCount}개${includeOriginal ? `, 원문 ${originalCount}개` : ''}`;
    if (excludeHidden && hiddenCount > 0) {
        summaryMsg += `, 숨김 메시지 ${hiddenCount}개 제외`;
    }
    summaryMsg += ' 추출 완료';
    logDebug(`${DEBUG_PREFIX} ${summaryMsg}`);

    return resultText;
}

/**
 * 지정된 메시지 ID에 해당하는 번역 데이터를 IndexedDB에서 삭제합니다.
 * @param {string} messageIdStr - 삭제할 메시지의 ID (문자열 형태)
 * @param {string} swipeNumberStr - 선택적 스와이프 번호 (문자열 형태)
 * @returns {Promise<string>} 작업 결과 메시지
 */
async function deleteTranslationById(messageIdStr, swipeNumberStr) {
    const DEBUG_PREFIX = `[${extensionName} - DeleteByID]`;
    logDebug(`Attempting to delete translation for message ID: ${messageIdStr}`);

    // 0. 'last' 처리
    let actualMessageIdStr = messageIdStr;
    if (messageIdStr === 'last') {
        const context = getContext();
        if (!context || !context.chat || context.chat.length === 0) {
            const errorMsg = '채팅 메시지가 없습니다.';
            logDebug(errorMsg);
            toastr.error(errorMsg);
            return errorMsg;
        }
        actualMessageIdStr = String(context.chat.length - 1);
        logDebug(`'last' converted to messageId: ${actualMessageIdStr}`);
    }

    // 1. 메시지 ID 파싱 및 유효성 검사
    const messageId = parseInt(actualMessageIdStr, 10);
    if (isNaN(messageId) || messageId < 0) {
        const errorMsg = `유효하지 않은 메시지 ID: "${actualMessageIdStr}". 숫자를 입력하세요.`;
        logDebug(errorMsg);
        toastr.error(errorMsg);
        return errorMsg;
    }

    // 2. 컨텍스트 및 대상 메시지 가져오기
    const context = getContext();
    if (!context || !context.chat) {
        const errorMsg = '컨텍스트 또는 채팅 데이터를 찾을 수 없습니다.';
        logDebug(errorMsg);
        toastr.error(errorMsg);
        return `오류: ${errorMsg}`;
    }
    if (messageId >= context.chat.length) {
        const errorMsg = `메시지 ID ${messageId}를 찾을 수 없습니다. (채팅 길이: ${context.chat.length})`;
        logDebug(errorMsg);
        toastr.error(errorMsg);
        return errorMsg;
    }
    const message = context.chat[messageId];
    if (!message) {
        const errorMsg = `메시지 ID ${messageId}에 대한 데이터를 가져올 수 없습니다.`;
        logDebug(errorMsg);
        toastr.error(errorMsg);
        return `오류: ${errorMsg}`;
    }

    // 3. 원본 텍스트 가져오기 (DB 검색 키)
    // substituteParams를 사용하여 변수 치환된 최종 원본 텍스트를 얻음
    const originalText = substituteParams(message.mes, context.name1, message.name);
    if (!originalText) {
        const errorMsg = `메시지 ID ${messageId}의 원본 텍스트를 가져올 수 없습니다.`;
        logDebug(errorMsg);
        toastr.warning(errorMsg); // 원본이 비어있을 수도 있으니 경고로 처리
        return errorMsg;
    }
    logDebug(`Original text for message ID ${messageId} (used as DB key): "${originalText.substring(0, 50)}..."`);

    // 3.5. 스와이프 번호 처리 (현재는 경고만 표시)
    if (swipeNumberStr && swipeNumberStr.trim() !== '') {
        const swipeNumber = parseInt(swipeNumberStr, 10);
        if (!isNaN(swipeNumber) && swipeNumber > 0) {
            logDebug(`Swipe number ${swipeNumber} was provided, but swipe-specific deletion is not implemented yet.`);
            toastr.warning(`스와이프 번호 ${swipeNumber}가 지정되었지만, 현재는 해당 메시지의 모든 번역 데이터를 삭제합니다.`);
        } else {
            logDebug(`Invalid swipe number: "${swipeNumberStr}". Ignoring and proceeding with full message deletion.`);
        }
    }

    // 4. DB에서 해당 번역 데이터 삭제 시도
    try {
        await forgetParagraphCache(originalText); // 5.4.2
        try {
            await deleteTranslationByOriginalText(originalText); // 기존에 만든 DB 삭제 함수 사용
        } catch (error) {
            // [1.9.2] 이 브라우저 DB 에 줄이 없어도(다른 기기에서 번역 · DB 삭제 뒤) 메시지에 붙은 번역문은 지운다.
            //         예전에는 'DB에 없습니다' 만 띄우고 휴지통을 눌러도 번역문이 그대로였다.
            if (!message.extra?.display_text || !String(error?.message).includes('no matching data')) throw error;
        }

        // 5. 화면(UI)에서도 번역문 제거 (선택적이지만 권장)
        // [2.1.3] 치워 둔 번역문(원문 보기 백업)도 함께 지운다 — 남으면 장기 기억 브리지가 지운 번역을 다시 읽었다 (편집 창 삭제와 같게)
        const hadDisplay = !!message.extra?.display_text;
        if (hadDisplay || message.extra?.original_translation_backup) {
            logDebug(`Removing display_text from message ${messageId} extra data.`);
            delete message.extra.display_text; // 또는 null로 설정: message.extra.display_text = null;
            delete message.extra.original_translation_backup;
            if (hadDisplay) await refreshMessageBlock(messageId, message); // UI 업데이트
            await context.saveChat(); // 변경된 메시지 저장
            logDebug('UI display_text removed and chat saved.');
        } else {
            logDebug(`No display_text found in message ${messageId} extra data to remove from UI.`);
        }

        const successMsg = `메시지 ID ${messageId}의 번역 데이터가 삭제되었습니다.`;
        logDebug(successMsg);
        toastr.success(successMsg);
        return successMsg; // 슬래시 커맨드 결과

    } catch (error) {
        // deleteTranslationByOriginalText 함수에서 reject('no matching data') 할 경우 포함
        let userErrorMessage = `메시지 ID ${messageId}의 번역 데이터 삭제 중 오류가 발생했습니다.`;
        if (error && error.message && error.message.includes('no matching data')) {
            userErrorMessage = `메시지 ID ${messageId}에 해당하는 번역 데이터가 DB에 없습니다.`;
            logDebug(userErrorMessage);
            toastr.info(userErrorMessage); // 정보성으로 변경
        } else {
            console.error(`${DEBUG_PREFIX} Error deleting translation for message ID ${messageId}:`, error);
            toastr.error(userErrorMessage);
        }
        return `오류: ${userErrorMessage}`; // 슬래시 커맨드 결과
    }
}





/**
 * 지정된 이름의 캐릭터가 SillyTavern에 존재하는지 확인합니다.
 * @param {string} characterName - 확인할 캐릭터의 이름
 * @returns {boolean} 캐릭터 존재 여부
 */
function doesCharacterExist(characterName) {
    const context = getContext(); // 이렇게 직접 호출
    if (!context || !context.characters || !Array.isArray(context.characters)) {
        // console.error(`DB_TOOL_SETUP 캐릭터 목록을 가져올 수 없습니다.`);
        // getSillyTavernContext 내부에서 이미 오류를 알렸을 수 있으므로, 중복 알림 자제
        return false;
    }
    const nameLower = characterName.toLowerCase();
    return context.characters.some(char => char && typeof char.name === 'string' && char.name.toLowerCase() === nameLower);
}

/**
 * 지정된 정보로 SillyTavern에 새 캐릭터를 생성합니다.
 * @param {string} characterName - 생성할 캐릭터의 이름
 * @param {string} firstMessage - 캐릭터의 첫 번째 메시지 (소개말)
 * @returns {Promise<boolean>} 캐릭터 생성 성공 여부
 */
async function createSillyTavernCharacter(characterName, firstMessage) {
    const context = getContext(); // 이렇게 직접 호출
    if (!context) return false;

    const characterData = {
        name: characterName,
        description: `LLM 번역 DB 작업을 위해 자동으로 생성된 캐릭터입니다.`,
        personality: "",
        scenario: "",
        first_mes: firstMessage,
        mes_example: "",
        data: {
            name: characterName,
            description: `LLM 번역 DB 작업을 위해 자동으로 생성된 캐릭터입니다.`,
            personality: "",
            scenario: "",
            first_mes: firstMessage,
            mes_example: "",
            tags: ["llm_translation_db_char", "auto-created"],
            avatar: 'none',
            alternate_greetings: [],
        },
        avatar: 'none',
        tags: ["llm_translation_db_char", "auto-created"],
        spec: 'chara_card_v2',
        spec_version: '2.0',
    };

    const formData = new FormData();
    formData.append('avatar', new Blob([JSON.stringify(characterData)], { type: 'application/json' }), `${characterName}.json`);
    formData.append('file_type', 'json');

    const headers = context.getRequestHeaders ? context.getRequestHeaders() : {};
    if (headers['Content-Type']) {
        delete headers['Content-Type'];
    }

    try {
        const response = await fetch('/api/characters/import', {
            method: 'POST',
            headers: headers,
            body: formData,
            cache: 'no-cache',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`DB_TOOL_SETUP 캐릭터 '${characterName}' 가져오기 실패. 상태: ${response.status} - ${response.statusText}. 본문: ${errorText}`);
            if (window.toastr) toastr.error(`캐릭터 '${characterName}' 생성 실패: ${response.statusText}`);
            return false;
        }

        if (typeof context.getCharacters === 'function') {
            await context.getCharacters();
        }

        if (window.toastr) toastr.success(`캐릭터 "${characterName}"이(가) 성공적으로 생성되었습니다!`);
        return true;

    } catch (error) {
        console.error(`DB_TOOL_SETUP 캐릭터 "${characterName}" 생성 중 API 오류 발생:`, error);
        if (window.toastr) toastr.error(`캐릭터 '${characterName}' 생성 중 오류: ${error.message || error}`);
        return false;
    }
}

/**
 * QuickReply API를 안전하게 가져옵니다.
 * @returns {object|null} QuickReply API 객체 또는 실패 시 null
 */
function getQuickReplyApi() {
    if (!window.quickReplyApi) {
        console.error(`DB_TOOL_SETUP QuickReply API를 찾을 수 없습니다. QuickReply 확장이 설치 및 활성화되어 있는지 확인해주세요.`);
        if (window.toastr) toastr.error('QuickReply API를 사용할 수 없습니다. 관련 확장을 확인해주세요.');
        return null;
    }
    return window.quickReplyApi;
}

/**
 * 활성화된 첫 번째 전역 Quick Reply 세트의 이름을 가져옵니다.
 * @returns {string|null} 세트 이름 또는 찾지 못한 경우 null
 */
function getFirstActiveGlobalQuickReplySetName() {
    const quickReplyApi = getQuickReplyApi();
    if (!quickReplyApi || !quickReplyApi.settings || !quickReplyApi.settings.config || !Array.isArray(quickReplyApi.settings.config.setList)) {
        return null;
    }

    const setList = quickReplyApi.settings.config.setList;
    const firstActiveSetItem = setList.find(item => item && item.isVisible === true);

    if (firstActiveSetItem && firstActiveSetItem.set && typeof firstActiveSetItem.set.name === 'string' && firstActiveSetItem.set.name.trim() !== '') {
        return firstActiveSetItem.set.name;
    } else {
        if (window.toastr && !firstActiveSetItem) toastr.info("활성화된 전역 Quick Reply 세트가 없습니다. QR 생성을 위해 먼저 세트를 활성화해주세요.");
        else if (window.toastr) toastr.warning("활성 QR 세트는 찾았으나, 유효한 이름이 없습니다.");
        return null;
    }
}

/**
 * 지정된 Quick Reply 세트에 특정 레이블의 QR이 존재하는지 확인하고, 없으면 생성합니다.
 * @param {string} setName - QR 세트의 이름
 * @param {string} qrLabel - 생성하거나 확인할 QR의 레이블
 * @param {string} qrCommandString - QR에 설정할 명령어 문자열
 * @param {string} qrTitle - QR에 설정할 제목 (툴팁 등)
 * @returns {Promise<boolean>} QR이 준비되었는지 (존재하거나 성공적으로 생성되었는지) 여부
 */
async function ensureQuickReplyExists(setName, qrLabel, qrCommandString, qrTitle) {
    const quickReplyApi = getQuickReplyApi();
    if (!quickReplyApi) return false;

    let qrExists = !!quickReplyApi.getQrByLabel(setName, qrLabel);

    if (qrExists) {
        return true;
    }

    const qrProperties = {
        message: qrCommandString,
        icon: '',
        showLabel: false,
        title: qrTitle,
        isHidden: false,
        executeOnStartup: false,
        executeOnUser: false,
        executeOnAi: false,
        executeOnChatChange: false,
        executeOnGroupMemberDraft: false,
        executeOnNewChat: false,
        automationId: '',
    };

    try {
        quickReplyApi.createQuickReply(setName, qrLabel, qrProperties);
        if (window.toastr) toastr.info(`QR '${qrLabel}'이(가) 세트 '${setName}'에 생성되었습니다.`);
        return true;
    } catch (error) {
        console.error(`DB_TOOL_SETUP QR '${qrLabel}' 생성 중 오류:`, error);
        if (window.toastr) toastr.error(`QR '${qrLabel}' 생성 중 오류가 발생했습니다: ${error.message}`);
        return false;
    }
}

/**
 * 지정된 이름의 캐릭터가 존재하는지 확인하고, 없으면 생성합니다.
 * @param {string} characterName - 확인할 캐릭터의 이름
 * @param {string} firstMessage - 캐릭터 생성 시 사용할 첫 번째 메시지
 * @returns {Promise<boolean>} 캐릭터가 준비되었는지 (존재하거나 성공적으로 생성되었는지) 여부
 */
async function ensureCharacterExists(characterName, firstMessage) {
    let charExists = doesCharacterExist(characterName);

    if (charExists) {
        return true;
    }

    if (window.toastr) toastr.info(`필요한 캐릭터 '${characterName}'을(를) 찾을 수 없습니다. 생성을 시도합니다...`);

    const creationSuccess = await createSillyTavernCharacter(characterName, firstMessage);
    if (creationSuccess) {
        return true;
    } else {
        return false;
    }
}

/**
 * LLM 번역 DB 관리를 위한 QR과 캐릭터를 준비(확인 및 생성)합니다.
 * 이 함수는 사용자가 버튼을 클릭했을 때 호출됩니다.
 */
async function prepareQrAndCharacterForDbManagement() {
    const targetCharName = "llm번역DB백업용";
    const targetCharFirstMessage = `LLM 번역 DB 관리 캐릭터입니다. 다음 명령어를 사용할 수 있습니다:\n\n채팅 백업(업로드)\n/llmDBUploadBackup\n\n채팅 복원(다운로드+등록된 DB삭제)\n/llmDBDownloadRestore | /llmDBmetaClearBackup`;

    const qrLabel = 'llm번역DB관리';
    const qrTitle = 'LLM 번역 DB 관리';
    const qrCommandString = `
/let mainMenu {:
    /buttons labels=["(업로드)백업", "(다운로드)복원"] -LLM 번역 DB 관리-<br><br>어떤 작업을 하시겠습니까? |
    /let choice {{pipe}} |

    /if left={{var::choice}} right="(업로드)백업" rule=eq /:llmDBUpload |
    /if left={{var::choice}} right="(다운로드)복원" rule=eq /:llmDBDownload |
    /if left={{var::choice}} right="" rule=eq {: /abort :} |
    /:mainMenu | 
:} |

/let llmDBUpload {:
    /go ${targetCharName} | /delay 1000 | /llmDBUploadBackup |
    /abort |
:} |

/let llmDBDownload {:
    /go ${targetCharName} | /llmDBDownloadRestore | /llmDBmetaClearBackup |
    /abort |
:} |

/:mainMenu |
    `.trim();

    try {
        const activeQrSetName = getFirstActiveGlobalQuickReplySetName();
        if (!activeQrSetName) {
            if (window.toastr) toastr.error("활성화된 전역 QR 세트를 찾을 수 없습니다. QR 관련 작업을 진행할 수 없습니다.");
            return;
        }

        const quickReplyApi = getQuickReplyApi(); // API 한번만 호출
        const initialQrExists = quickReplyApi ? !!quickReplyApi.getQrByLabel(activeQrSetName, qrLabel) : false;
        const initialCharExists = doesCharacterExist(targetCharName);

        let qrReady = await ensureQuickReplyExists(activeQrSetName, qrLabel, qrCommandString, qrTitle);
        let charReady = await ensureCharacterExists(targetCharName, targetCharFirstMessage);

        let qrCreatedThisTime = qrReady && !initialQrExists;
        let charCreatedThisTime = charReady && !initialCharExists;
        let actionTakenThisTime = qrCreatedThisTime || charCreatedThisTime;

        if (qrReady && charReady) {
            if (actionTakenThisTime) {
                let message = "DB 관리 기능 설정 진행: ";
                if (qrCreatedThisTime && charCreatedThisTime) message += `QR '${qrLabel}' 및 캐릭터 '${targetCharName}'이(가) 준비되었습니다.`;
                else if (qrCreatedThisTime) message += `QR '${qrLabel}'이(가) 준비되었습니다.`;
                else if (charCreatedThisTime) message += `캐릭터 '${targetCharName}'이(가) 준비되었습니다.`;
                message += " 버튼을 다시 클릭하여 작업을 시작하세요.";
                if (window.toastr) toastr.success(message);
            } else {
                const readyMessage = `DB 관리 기능('${qrLabel}' QR, '${targetCharName}' 캐릭터) 사용 준비가 완료되었습니다. 버튼을 다시 클릭하여 작업을 시작하세요.`;
                if (window.toastr) toastr.info(readyMessage);
            }
        } else {
            let failMessage = "DB 관리 기능 설정 실패: ";
            if (!qrReady) failMessage += `QR '${qrLabel}' 준비에 실패했습니다. `;
            if (!charReady) failMessage += `캐릭터 '${targetCharName}' 준비에 실패했습니다.`;
            if (window.toastr) toastr.error(failMessage);
            console.error(`DB_TOOL_SETUP ${failMessage}`);
        }

    } catch (ex) {
        console.error(`DB 관리 기능 준비 중 예외 발생 ('${qrLabel}'):`, ex);
        if (window.toastr) toastr.error(`작업 중 오류가 발생했습니다: ${ex.message}`);
    }
}

//----------v3 end
/**
 * 연속된 백틱을 하나로 줄이고, 홀수 개의 백틱이 있을 경우 마지막에 백틱을 추가합니다.
 * (코드 블록 깨짐 방지 목적)
 * @param {string} input - 처리할 문자열
 * @returns {string} 처리된 문자열
 */
function correctBackticks(input) {
	return input;
    // 입력값이 문자열이 아니거나 비어있으면 그대로 반환
    if (typeof input !== 'string' || input === null) {
        return input;
    }

    // 연속된 백틱을 하나로 줄이는 처리
    let correctedInput = input.replace(/`{2,}/g, '`');

    // 백틱(`)의 개수를 셈
    const backtickCount = (correctedInput.match(/`/g) || []).length;

    // 백틱이 홀수개일 경우
    if (backtickCount % 2 !== 0) {
        // 문자열의 끝에 백틱 추가 (단, 이미 백틱으로 끝나면 짝수를 위해 하나 더 붙임)
        correctedInput += '`';
    }

    // 백틱이 짝수개일 경우 원본(연속 백틱 처리된) 그대로 반환
    return correctedInput;
}
// [추가] 정규식 목록을 통합하여 가져오는 헬퍼 함수
function getCombinedRegexes() {
    const specialBlockRegexes = [
        /<think>[\s\S]*?<\/think>/gi,
        /<thinking>[\s\S]*?<\/thinking>/gi,
        /<tableEdit>[\s\S]*?<\/tableEdit>/gi,
        ///<details[^>]*>[\s\S]*?<\/details>/gi,
        ///`{3,}[^`]*[\s\S]*?`{3,}/g,
		/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,
        /<StatusPlaceHolderImpl\s*\/?>/gi
    ];


    // 사용자 정의 정규식 추가
    if (extensionSettings.user_defined_regexes && Array.isArray(extensionSettings.user_defined_regexes)) {
        extensionSettings.user_defined_regexes.forEach(regexStr => {
            const regex = compileUserPattern(regexStr, 'user regex');
            if (regex) specialBlockRegexes.push(regex);
        });
    }
    return specialBlockRegexes;
}

/**
 * [1.9.2] '보호할 텍스트' · '접기 금지 텍스트' 한 줄을 정규식으로.
 * 설명대로 글자 그대로(예: **Scene Plan**)도 받는다 — 예전에는 정규식으로만 읽어서 '*' 로 시작하는 줄은 오류만 찍고 아무것도 보호하지 않았다.
 * 정규식으로 읽히면 예전처럼 정규식, 안 읽히면 글자 그대로. /…/ 에 g 가 없으면 붙인다 (없으면 첫 번째 것만 가려졌다).
 */
function compileUserPattern(line, label) {
    const trimmedStr = String(line ?? '').trim();
    if (!trimmedStr) return null;
    const match = trimmedStr.match(/^\/(.*?)\/([a-z]*)$/);
    try {
        if (match) {
            const flags = match[2] || 'gi';
            return new RegExp(match[1], flags.includes('g') ? flags : `${flags}g`);
        }
        return new RegExp(trimmedStr, 'gi');
    } catch (e) {
        if (match) {
            console.error(`[LLM Translator] Invalid ${label}:`, line, e);
            return null;
        }
        return new RegExp(trimmedStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    }
}

// 접기 금지 정규식 목록 가져오기
function getNoFoldRegexes() {
    // 기본 접기 금지 정규식 추가	
    const regexes = [
        /\{\{img::.*?\}\}/gi,
        /<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,
        /<StatusPlaceHolderImpl\s*\/?>/gi,
        
        // 코드 블록
        ///^```[\s\S]*?```$/gm,
        
        // HTML (두 가지 케이스)
        /^<!DOCTYPE[\s\S]*?<\/html>/gi,  // DOCTYPE 포함
        /<html[\s\S]*?<\/html>/gi         // html 태그만
    ];
    // ... 사용자 정의 추가
	
    if (extensionSettings.user_no_fold_regexes && Array.isArray(extensionSettings.user_no_fold_regexes)) {
        extensionSettings.user_no_fold_regexes.forEach(regexStr => {
            // /pattern/flags 형태 처리 ([1.9.2] 글자 그대로 · g 없는 정규식도 — compileUserPattern)
            const regex = compileUserPattern(regexStr, 'no-fold regex');
            if (regex) regexes.push(regex);
        });
    }
    return regexes;
}


// [추가] UI 업데이트 이벤트 발송 헬퍼 함수
function emitTranslationUIUpdate(messageId, type) {
    const context = getContext();
    if (!context || !context.chat) return;

    // 메시지 ID를 문자열로 변환하여 호환성 확보
    const msgIdString = String(messageId);

    //console.log(`[LLM Translator] Emitting UI Update Event: ${type} (ID: ${msgIdString})`);

    eventSource.emit('EXTENSION_LLM_TRANSLATE_UI_UPDATED', {
        messageId: msgIdString,
        type: type // 'translation', 'retranslation', 'toggle', 'show_original', 'edit_save'
    });
}


/**
 * [리팩토링 2] 분석기 (Aligner) - 이중 마스킹 구조
 * 원문과 번역문을 분석하여 짝을 맞추고, 각 블록의 속성(접기 여부 등)을 결정합니다.
 * 
 * 주요 개선사항:
 * - getCombinedRegexes: 번역 보호 (번역 API 통과 불가)
 * - getNoFoldRegexes: UI 접기 금지 (렌더링 보호)
 * - 이중 마스킹으로 블록 단위 정규식 처리 가능
 */

// ============================================================================
// 메인 함수: analyzeAndAlignSegments
// ============================================================================
/**
 * [리팩토링 V3] 메인 프로세서 - 수정 완료본
 * 기존의 복잡한 세그먼트/라인 매칭 로직을 폐기하고,
 * '선결 마스킹 -> 스켈레톤 추출 -> 주입 -> 교차 복원'의 5단계 파이프라인으로 처리합니다.
 * [1.8.13] 북마크 확장이 패널에서 번역한 글도 채팅과 같은 모양(원문 병기)으로 적도록 내보낸다.
 *          북마크는 실리태번이 이미 불러온 이 모듈을 같은 주소로 import 하므로 모듈이 다시 실행되지 않는다.
 */
export function processTranslationText(originalText, translatedText) {
    const displayMode = extensionSettings.translation_display_mode || 'disabled';

    // 0. 기본 모드 체크 (빠른 반환)
    if (displayMode === 'disabled') {
        return correctBackticks(translatedText || ''); // ✅ 수정 3: correctBackticks 추가
    }

    try {
        // 1. 선결 마스킹 (Phase 1: Isolation)
        // 원문과 번역문에서 특수 블록(태그, 코드 등)을 미리 격리합니다.
        const origData = applyIsolation(originalText, 'ORIG');
        const transData = applyIsolation(translatedText, 'TRANS');

        // 2. 구조 분석 (Phase 2: Structure Analysis)
        // 번역문의 줄바꿈과 마스킹 위치를 기준으로 '골격(Skeleton)'을 만듭니다.
        // 동시에 '순수 텍스트(Queue)'를 추출합니다.
        const { skeleton, textQueue: transQueue } = analyzeStructure(transData.maskedText);
        const origQueue = extractPureText(origData.maskedText);

        // 3. 매칭 및 렌더링 (Phase 3 & 4: Matching & Rendering)
        // 설정과 큐의 상태에 따라 '통짜 모드' 또는 '인터리브 모드'로 HTML을 생성합니다.
        // ✅ 수정 2: origData, transData 전체 객체 전달
        let finalHtml = renderTranslation(
            skeleton,
            transQueue,
            origQueue,
            displayMode,
            origData,  // 전체 객체 전달
            transData  // 전체 객체 전달
        );

        // 4. 최종 복원 (Phase 5: Restoration)
        // 격리해둔 마스킹 내용을 원래 자리로 되돌립니다. (교차 복원 포함)
        finalHtml = restoreContent(finalHtml, transData.map, origData.map);

        return correctBackticks(finalHtml);

    } catch (error) {
        console.error('[LLM Translator] Error in processTranslationText:', error);
        // ✅ 수정 4: toastr.error 추가
        if (window.toastr) {
            toastr.error('번역문 처리 중 오류가 발생했습니다.');
        }
        // 치명적 오류 발생 시 최소한 번역문이라도 보여줌 (안전장치)
        return correctBackticks(translatedText || '');
    }
}

// ============================================================================
// Phase 1: Isolation (마스킹 격리)
// ============================================================================

function applyIsolation(text, source) {
    if (!text) return { maskedText: '', map: {}, hasMask: false };

    let currentText = text;
    const map = {};
    let maskCounter = 0;

    // 0. 선제 마스킹: 원본 텍스트에 토큰 패턴이 이미 존재하는 경우 보호
    // (사용자가 입력했거나 LLM이 생성한 __MASK_...__ 패턴을 먼저 마스킹)
    const tokenPattern = /__MASK_[A-Z]+_(ORIG|TRANS)_\d+__/g;
    currentText = currentText.replace(tokenPattern, (match) => {
        const token = `__MASK_PREEXIST_${source}_${maskCounter}__`;
        map[token] = match; // 토큰 자체를 원본으로 저장
        maskCounter++;
        return token;
    });

    // 1. Combined(번역보호) -> 2. NoFold(접기보호) 순서로 처리
    const regexGroups = [
        { regexes: getCombinedRegexes(), type: 'COMBINED' },
        { regexes: getNoFoldRegexes(), type: 'NOFOLD' }
    ];

    regexGroups.forEach(group => {
        group.regexes.forEach(regex => {
            currentText = currentText.replace(regex, (match) => {
                // 토큰 형식: __MASK_타입_출처_ID__
                // 예: __MASK_COMBINED_ORIG_0__
                const token = `__MASK_${group.type}_${source}_${maskCounter}__`;
                map[token] = match;
                maskCounter++;
                return token;
            });
        });
    });

    return {
        maskedText: currentText,
        map: map,
        hasMask: maskCounter > 0
    };
}

// ============================================================================
// Phase 2: Structure Analysis (골격 및 큐 추출)
// ============================================================================
function analyzeStructure(text) {
    const skeleton = [];
    const textQueue = [];
    
    // 줄 단위 분해
    const lines = text.split('\n');
    let inCodeBlock = false;

    lines.forEach(line => {
        const trimmedLine = line.trim();
        
        // 코드 블록 펜스 감지 (백틱 3개 이상)
        const isCodeFence = /^\s*`{3,}/.test(line);

        if (isCodeFence) {
            inCodeBlock = !inCodeBlock;
            // 펜스 라인은 구조 유지(SKELETON)
            skeleton.push({ type: 'SKELETON', content: line });
            return;
        }

        if (inCodeBlock) {
            // 코드 블록 내부 내용은 무조건 SKELETON (접기 태그 침투 방지)
            skeleton.push({ type: 'SKELETON', content: line });
            return;
        }

        // --- 코드 블록 밖의 일반 로직 ---

        // 1. 마스킹 토큰
        if (/^__MASK_[A-Z]+_[A-Z]+_\d+__$/.test(trimmedLine)) {
            skeleton.push({ type: 'MASK', content: trimmedLine });
        }
        // 2. 빈 줄
        else if (trimmedLine === '') {
            skeleton.push({ type: 'EMPTY', content: line });
        }
        // 3. 접기 대상 텍스트
        else {
            skeleton.push({ type: 'TEXT', content: line });
            textQueue.push(line);
        }
    });

    return { skeleton, textQueue };
}

function extractPureText(text) {
    const queue = [];
    const lines = text.split('\n');
    let inCodeBlock = false;

    lines.forEach(line => {
        const trimmedLine = line.trim();
        const isCodeFence = /^\s*`{3,}/.test(line);

        if (isCodeFence) {
            inCodeBlock = !inCodeBlock;
            return; // 펜스는 큐에 넣지 않음
        }

        if (inCodeBlock) {
            return; // 코드 블록 내부도 큐에 넣지 않음
        }

        // 마스킹 아니고, 빈 줄 아니면 큐에 추가
        if (!/^__MASK_[A-Z]+_[A-Z]+_\d+__$/.test(trimmedLine) && trimmedLine !== '') {
            queue.push(line);
        }
    });

    return queue;
}

// ============================================================================
// Phase 3 & 4: Matching & Rendering (렌더링 전략 결정 및 조립)
// ============================================================================

// ✅ 수정 2: 함수 시그니처 변경 (origData, transData 전체 객체 받음)
function renderTranslation(skeleton, transQueue, origQueue, displayMode, origData, transData) {
    const forceSequential = extensionSettings.force_sequential_matching;
    const isLengthMismatch = transQueue.length !== origQueue.length;
    const hasMask = origData.hasMask || transData.hasMask;

    // [전략 결정]
    // 강제 맞추기 옵션이 꺼져 있고, 문단 수가 다르면 -> '통짜 모드'로 안전하게 표시
    if (!forceSequential && isLengthMismatch) {
        if (window.toastr) toastr.warning('문단 불일치: 전체를 하나로 표시합니다.');
        // ✅ 수정 1: maskedText 전달
        return renderAllInOne(
            transQueue, 
            origQueue, 
            displayMode, 
            hasMask, 
            skeleton,
            origData.maskedText,
            transData.maskedText
        );
    }

    // 그 외(옵션 켜짐 OR 개수 일치) -> '인터리브 모드' (1:1 접기)
    return renderInterleaved(skeleton, transQueue, origQueue, displayMode);
}

// ✅ 수정 1: 함수 시그니처 변경 및 로직 수정
function renderAllInOne(transQueue, origQueue, displayMode, hasMask, skeleton,
                        origMaskedText, transMaskedText) {
    // 원문/번역문 전체 재구성 (구조 보존)
    const fullTransText = transMaskedText; // 번역문 전체 (마스킹 포함)
    const fullOrigText = origMaskedText;   // 원문 전체 (마스킹 포함)
    
    const separator = '\n\n';

    // 1. 마스킹이 포함된 경우 -> 태그 없이 순수 텍스트 연결 (안전성 최우선)
    if (hasMask) {
        if (displayMode === 'original_first') {
            return fullOrigText + separator + fullTransText;
        }
        return fullTransText + separator + fullOrigText;
    }

    // 2. 텍스트만 있는 경우 -> <details> 사용 가능 (5.2.5: 요약/본문 안은 마크다운 문단이 안 되므로 빈 줄 · 줄바꿈을 <br> 로)
    const br = text => String(text ?? '').replace(/\n[\t ]*\n(?:[\t ]*\n)*/g, '<br><br>').replace(/\n/g, '<br>');
    if (displayMode === 'original_first') {
        return `<details class="llm-translator-details mode-original-first">
            <summary class="llm-translator-summary">${br(fullOrigText)}</summary>
            ${br(fullTransText)}
        </details>`;
    }
    
    // 기본 (folded, unfolded 등)
    return `<details class="llm-translator-details mode-folded">
        <summary class="llm-translator-summary">${br(fullTransText)}</summary>
        ${br(fullOrigText)}
    </details>`;
}

function renderInterleaved(skeleton, transQueue, origQueue, displayMode) {
    let htmlParts = [];
    let origIndex = 0;

    skeleton.forEach(node => {
        // SKELETON 타입 추가 (그대로 출력)
        if (node.type === 'EMPTY' && displayMode !== 'unfolded') {
            // 5.2.5: 접기 · 원문 먼저 보기는 문단마다 <details> 블록이라 빈 줄이 마크다운 문단 간격을 못 만든다 → 간격 요소로 (CSS: --salty-para)
            htmlParts.push('<div class="llmt-para-gap"></div>');
        } else if (node.type === 'MASK' || node.type === 'EMPTY' || node.type === 'SKELETON') {
            htmlParts.push(node.content);
        } 
        else if (node.type === 'TEXT') {
            // 접기 대상: 큐에서 하나씩 꺼냄
            const transText = node.content; // === transQueue.shift() 와 논리적으로 같음
            
            // 짝지을 원문이 있으면 가져오고, 없으면 빈 문자열
            const origText = (origIndex < origQueue.length) ? origQueue[origIndex] : '';
            origIndex++;
            htmlParts.push(createDetailsTag(transText, origText, displayMode));
        }
    });

    return htmlParts.join('\n');
}

function createDetailsTag(transText, origText, displayMode) {
    // Unfolded 모드
    if (displayMode === 'unfolded') {
        return `<span class="translated_text mode-unfolded">${transText}</span><br>` +
               `<span class="original_text mode-unfolded">${origText}</span>`;
    }
    // Original First 모드
    if (displayMode === 'original_first') {
        return `<details class="llm-translator-details mode-original-first">` +
               `<summary class="llm-translator-summary"><span class="original_text clickable-text-org">${origText}</span></summary>` +
               `<span class="translated_text">${transText}</span>` +
               `</details>`;
    }
    // Default (Folded)
    return `<details class="llm-translator-details mode-folded">` +
           `<summary class="llm-translator-summary"><span class="translated_text clickable-text-org">${transText}</span></summary>` +
           `<span class="original_text">${origText}</span>` +
           `</details>`;
}

// ============================================================================
// Phase 5: Restoration (교차 복원)
// ============================================================================
function restoreContent(html, transMap, origMap) {
    let currentHtml = html;
    let loopCount = 0;
    const MAX_LOOP = 10; // 무한 루프 방지

    while (loopCount < MAX_LOOP) {
        let hasChanged = false;

        currentHtml = currentHtml.replace(/__MASK_([A-Z]+)_([A-Z]+)_(\d+)__/g, (match, type, source, id) => {
            let replacement = null;

            // 1. 제 짝(Map)에서 찾기
            if (source === 'TRANS' && transMap[match]) replacement = transMap[match];
            else if (source === 'ORIG' && origMap[match]) replacement = origMap[match];

            // 2. 교차 복원
            else if (source === 'TRANS') {
                const crossKey = match.replace('_TRANS_', '_ORIG_');
                if (origMap[crossKey]) replacement = origMap[crossKey];
            }
            else if (source === 'ORIG') {
                const crossKey = match.replace('_ORIG_', '_TRANS_');
                if (transMap[crossKey]) replacement = transMap[crossKey];
            }

            if (replacement !== null) {
                hasChanged = true;
                return replacement;
            }
            return match;
        });

        if (!hasChanged) break; // 더 이상 바뀐 게 없으면 탈출
        loopCount++;
    }

    return currentHtml;
}










registerCommand(SlashCommand.fromProps({
    name: 'LlmTranslateLast',
    callback: async () => {
        const lastMessage = document.querySelector('#chat .mes:last-child');
        let targetButton;
        if (lastMessage) {
            targetButton = lastMessage.querySelector('.mes_llm_translate');
            if (targetButton) {
                targetButton.click();
                return '마지막 메시지를 LLM으로 번역합니다.';
            } else {
                return '마지막 메시지 LLM 번역 버튼을 찾을 수 없습니다.';
            }
        } else {
            return '채팅 메시지가 없습니다.';
        }
    },
    helpString: '마지막 메시지를 LLM 번역기로 번역합니다.',
}));

registerCommand(SlashCommand.fromProps({
    name: 'LlmRetranslateCorrection',
    callback: async (parsedArgs) => {
        const messageIdStr = validateAndNormalizeMessageId(parsedArgs.messageId);

        let actualMessageId = messageIdStr;
        if (messageIdStr === 'last') {
            const context = getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                return '채팅 메시지가 없습니다.';
            }
            actualMessageId = context.chat.length - 1;
        }

        // 백그라운드에서 재번역 실행 (UI 블로킹 방지)
        retranslateMessage(actualMessageId, 'correction', true).catch(error => {
            console.error('Retranslation error:', error);
            toastr.error(`메시지 ID ${actualMessageId} 교정 재번역 중 오류가 발생했습니다.`);
        });

        return `메시지 ID ${actualMessageId} 교정 재번역을 시작했습니다.`;
    },
    helpString: '지정한 ID의 메시지를 교정 재번역합니다 (기존 번역문을 개선). messageId를 생략하면 마지막 메시지를 대상으로 합니다.\n사용법: /LlmRetranslateCorrection [messageId=<메시지ID>]',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'messageId',
            description: '교정 재번역할 메시지의 ID 또는 "last" (마지막 메시지)',
            isRequired: false,
            defaultValue: '{{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
}));

registerCommand(SlashCommand.fromProps({
    name: 'LlmRetranslateGuidance',
    callback: async (parsedArgs) => {
        const messageIdStr = validateAndNormalizeMessageId(parsedArgs.messageId);

        let actualMessageId = messageIdStr;
        if (messageIdStr === 'last') {
            const context = getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                return '채팅 메시지가 없습니다.';
            }
            actualMessageId = context.chat.length - 1;
        }

        // 백그라운드에서 재번역 실행 (UI 블로킹 방지)
        retranslateMessage(actualMessageId, 'guidance', true).catch(error => {
            console.error('Retranslation error:', error);
            toastr.error(`메시지 ID ${actualMessageId} 지침교정 재번역 중 오류가 발생했습니다.`);
        });

        return `메시지 ID ${actualMessageId} 지침교정 재번역을 시작했습니다.`;
    },
    helpString: '지정한 ID의 메시지를 지침교정 재번역합니다 (추가 지침을 입력받아 번역문을 개선). messageId를 생략하면 마지막 메시지를 대상으로 합니다.\n사용법: /LlmRetranslateGuidance [messageId=<메시지ID>]',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'messageId',
            description: '지침교정 재번역할 메시지의 ID 또는 "last" (마지막 메시지)',
            isRequired: false,
            defaultValue: '{{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
}));

registerCommand(SlashCommand.fromProps({
    name: 'LlmRetranslateParagraph',
    callback: async (parsedArgs) => {
        const messageIdStr = validateAndNormalizeMessageId(parsedArgs.messageId);

        let actualMessageId = messageIdStr;
        if (messageIdStr === 'last') {
            const context = getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                return '채팅 메시지가 없습니다.';
            }
            actualMessageId = context.chat.length - 1;
        }

        // 백그라운드에서 재번역 실행 (UI 블로킹 방지)
        retranslateMessage(actualMessageId, 'paragraph', true).catch(error => {
            console.error('Retranslation error:', error);
            toastr.error(`메시지 ID ${actualMessageId} 문단 구조 맞추기 재번역 중 오류가 발생했습니다.`);
        });

        return `메시지 ID ${actualMessageId} 문단 구조 맞추기 재번역을 시작했습니다.`;
    },
    helpString: '지정한 ID의 메시지를 문단 구조 맞추기 재번역합니다 (원문 구조에 맞춰 재번역). messageId를 생략하면 마지막 메시지를 대상으로 합니다.\n사용법: /LlmRetranslateParagraph [messageId=<메시지ID>]',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'messageId',
            description: '문단 맞추기 재번역할 메시지의 ID 또는 "last" (마지막 메시지)',
            isRequired: false,
            defaultValue: '{{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
}));

registerCommand(SlashCommand.fromProps({
    name: 'LlmTranslateID',
    callback: async (parsedArgs) => {
        const messageIdStr = validateAndNormalizeMessageId(parsedArgs.messageId);

        let actualMessageId = messageIdStr;
        if (messageIdStr === 'last') {
            const context = getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                return '채팅 메시지가 없습니다.';
            }
            actualMessageId = context.chat.length - 1;
        }

        const messageId = parseInt(actualMessageId, 10);
        if (isNaN(messageId) || messageId < 0) {
            return `유효하지 않은 메시지 ID: "${actualMessageId}". 숫자를 입력하세요.`;
        }

        const context = getContext();
        if (!context || !context.chat) {
            return '컨텍스트 또는 채팅 데이터를 찾을 수 없습니다.';
        }
        if (messageId >= context.chat.length) {
            return `메시지 ID ${messageId}를 찾을 수 없습니다. (채팅 길이: ${context.chat.length})`;
        }

        // 백그라운드에서 번역 실행 (UI 블로킹 방지)
        translateMessage(messageId, true, 'LlmTranslateID_command').catch(error => {
            console.error('Translation error:', error);
            toastr.error(`메시지 ID ${messageId} 번역 중 오류가 발생했습니다.`);
        });

        // 즉시 성공 메시지 반환 (UI 블로킹 없음)
        return `메시지 ID ${messageId} 번역을 시작했습니다.`;
    },
    helpString: '지정한 ID의 메시지를 LLM 번역기로 번역합니다. messageId를 생략하면 마지막 메시지를 대상으로 합니다.\n사용법: /LlmTranslateID [messageId=<메시지ID>]',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'messageId',
            description: '번역할 메시지의 ID 또는 "last" (마지막 메시지)',
            isRequired: false,
            defaultValue: '{{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
}));




registerCommand(SlashCommand.fromProps({
    name: 'llmDBUploadBackup',
    callback: backupTranslationsToMetadata,
    helpString: 'LLM 번역 캐시를 현재 채팅 메타데이터에 백업합니다. (백업용 채팅에서 실행 권장)',
    returns: '백업 진행 및 결과 알림 (toastr)',
}));

registerCommand(SlashCommand.fromProps({
    name: 'llmDBDownloadRestore',
    callback: restoreTranslationsFromMetadata, // Add-Only + Progress Bar 버전
    helpString: '현재 채팅 메타데이터의 백업에서 번역 캐시를 복원/병합합니다 (없는 데이터만 추가).',
    returns: '복원 진행(프로그레스 바) 및 결과 알림 (toastr)',
}));

registerCommand(SlashCommand.fromProps({
    name: 'llmDBmetaClearBackup',
    callback: clearBackupFromMetadata,
    helpString: '현재 채팅 메타데이터에서 LLM 번역 캐시 백업을 삭제합니다 (영구 삭제).',
    returns: '삭제 확인 팝업 및 결과 알림 (toastr)',
}));

//	/llmGetTranslation messageId={{lastMessageId}}
registerCommand(SlashCommand.fromProps({
    /**
     * 슬래시 커맨드 이름: /llmGetTranslation
     * 기능: 지정된 메시지 ID에 해당하는 번역문을 DB에서 가져옵니다.
     * 사용법: /llmGetTranslation messageId=<ID> 또는 /llmGetTranslation messageId=last
     */
    name: 'llmGetTranslation',
    /**
     * 호출될 콜백 함수: 객체(parsedArgs)를 인수로 받습니다.
     */
    callback: async (parsedArgs) => {
        const DEBUG_PREFIX_CMD = `[${extensionName} - Cmd /llmGetTranslation]`;
        logDebug(`${DEBUG_PREFIX_CMD} Executing with args:`, parsedArgs);

        let messageIdStr = validateAndNormalizeMessageId(parsedArgs.messageId);

        // 'last' 처리
        if (messageIdStr === 'last') {
            const context = getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                return '오류: 채팅 메시지가 없습니다.';
            }
            messageIdStr = String(context.chat.length - 1); // 마지막 메시지 ID로 변환
            logDebug(`${DEBUG_PREFIX_CMD} 'last' converted to messageId: ${messageIdStr}`);
        }

        // getTranslationById 함수 호출
        return await getTranslationById(messageIdStr);
    },
    /**
     * 도움말: 사용자가 /help llmGetTranslation 을 입력했을 때 표시될 설명입니다.
     */
    helpString: '지정한 메시지 ID의 LLM 번역문을 DB에서 가져옵니다. messageId를 생략하면 마지막 메시지를 대상으로 합니다.\n사용법: /llmGetTranslation [messageId=<메시지ID>]',
    /**
     * 이름 기반 인수 정의: namedArgumentList 사용
     */
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'messageId',
            description: '번역문을 가져올 메시지의 숫자 ID 또는 "last" (마지막 메시지)',
            isRequired: false,
            defaultValue: '{{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.STRING], // 'last'도 받을 수 있도록 STRING 타입
        }),
    ],
    /**
     * 반환값 설명: 콜백 함수의 반환값 유형에 대한 설명 (참고용).
     */
    returns: '번역문 또는 오류/정보 메시지',
}));

//	/llmDBDeleteTranslation messageId={{lastMessageId}}
registerCommand(SlashCommand.fromProps({
    /**
     * 슬래시 커맨드 이름: /llmDBDeleteTranslation
     * 기능: 지정된 메시지 ID (및 선택적 스와이프 번호)에 해당하는 번역 데이터를 DB에서 삭제합니다.
     * 사용법: /llmDBDeleteTranslation messageId=<ID> [swipeNumber=<번호>]
     */
    name: 'llmDBDeleteTranslation', // 이름은 그대로 유지하거나 원하는 대로 변경 (예: llmDeleteTranslation)
    /**
     * 호출될 콜백 함수: 이제 객체(parsedArgs)를 인수로 받습니다.
     */
    callback: async (parsedArgs) => {
        const DEBUG_PREFIX_CMD = `[${extensionName} - Cmd /llmDBDeleteTranslation]`;
        logDebug(`${DEBUG_PREFIX_CMD} Executing with args:`, parsedArgs);

        // 객체에서 messageId와 swipeNumber 추출 (값이 문자열일 수 있음에 유의)
        const messageIdStr = validateAndNormalizeMessageId(parsedArgs.messageId);
        const swipeNumberStr = parsedArgs.swipeNumber; // optional이므로 undefined일 수 있음

        // deleteTranslationById 함수 호출 (이 함수는 내부적으로 문자열 ID를 숫자로 변환함)
        // swipeNumberStr가 undefined여도 deleteTranslationById 함수에서 처리 가능
        return await deleteTranslationById(messageIdStr, swipeNumberStr);
    },
    /**
     * 도움말: 사용자가 /help llmDBDeleteTranslation 을 입력했을 때 표시될 설명입니다.
     * 사용법 예시를 named argument 방식으로 수정합니다.
     */
    helpString: '지정한 메시지 ID (및 선택적 스와이프 번호)의 LLM 번역 기록(DB) 및 화면 표시를 삭제합니다. messageId를 생략하면 마지막 메시지를 대상으로 합니다.\n사용법: /llmDBDeleteTranslation [messageId=<메시지ID>] [swipeNumber=<스와이프번호>]',
    /**
     * 이름 기반 인수 정의: namedArgumentList 사용
     */
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'messageId', // 인수 이름 (예: messageId=123)
            description: '삭제할 번역이 있는 메시지의 숫자 ID',
            isRequired: false, // 필수 인수
            defaultValue: '{{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.STRING], // 'last'도 받을 수 있도록 STRING 타입으로 변경
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'swipeNumber', // 인수 이름 (예: swipeNumber=2)
            description: '삭제할 스와이프 번호 (1부터 시작). 생략 시 현재 활성화된 스와이프/메시지 기준.',
            isRequired: false, // 선택적 인수
            typeList: [ARGUMENT_TYPE.INTEGER], // 예상 타입
            // defaultValue: undefined, // 기본값은 설정 안 함 (콜백에서 undefined 체크)
        }),
    ],
    /**
     * 반환값 설명: 콜백 함수의 반환값 유형에 대한 설명 (참고용).
     */
    returns: '삭제 작업 성공/실패/정보 메시지',
}));
// 기존 llmTranslate 수정: prompt 인수 추가
registerCommand(SlashCommand.fromProps({
    name: 'llmTranslate',
    helpString: 'LLM을 사용하여 텍스트를 번역합니다. 기본적으로 채팅 번역 설정을 따르며, prompt 인수로 프롬프트를 직접 지정할 수 있습니다.\n사용법: /llmTranslate "텍스트" [prompt="프롬프트 내용"]',
    unnamedArgumentList: [
        new SlashCommandArgument('번역할 텍스트', ARGUMENT_TYPE.STRING, true, false, ''),
    ],
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'prompt',
            description: '사용할 커스텀 프롬프트 (생략 시 기본 채팅 번역 프롬프트 사용)',
            isRequired: false,
            typeList: [ARGUMENT_TYPE.STRING],
        })
    ],
    callback: async (args, value) => {
        // args.prompt가 있으면 그것을 사용, 없으면 함수 내부 기본값(llm_prompt_chat) 사용을 위해 undefined 전달
        const customPrompt = args.prompt || undefined;
        const textToTranslate = String(value);

        if (!textToTranslate.trim()) {
            return '번역할 텍스트를 입력해주세요.';
        }

        try {
            // translate 함수는 prompt 옵션이 없으면 기본적으로 llm_prompt_chat을 사용함
            const translatedText = await translate(textToTranslate, { prompt: customPrompt });
            return translatedText;
        } catch (error) {
            (error?.refused ? console.warn : console.error)('LLMTranslate Slash Command Error:', error);
            return `LLM 번역 중 오류 발생: ${error.message}`;
        }
    },
    returns: ARGUMENT_TYPE.STRING,
}));

// 신규 llmTranslateInput 추가: 입력 번역용
registerCommand(SlashCommand.fromProps({
    name: 'llmTranslateInput',
    helpString: 'LLM을 사용하여 텍스트를 입력용(주로 영어)으로 번역합니다. 기본적으로 입력 번역 설정을 따르며, prompt 인수로 프롬프트를 직접 지정할 수 있습니다.\n사용법: /llmTranslateInput "텍스트" [prompt="프롬프트 내용"]',
    unnamedArgumentList: [
        new SlashCommandArgument('번역할 텍스트', ARGUMENT_TYPE.STRING, true, false, ''),
    ],
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'prompt',
            description: '사용할 커스텀 프롬프트 (생략 시 기본 입력 번역 프롬프트 사용)',
            isRequired: false,
            typeList: [ARGUMENT_TYPE.STRING],
        })
    ],
    callback: async (args, value) => {
        // args.prompt가 있으면 사용, 없으면 설정의 입력 번역 프롬프트 사용
        const inputPrompt = args.prompt || extensionSettings.llm_prompt_input || 'Please translate the following text to english:';
        const textToTranslate = String(value);

        if (!textToTranslate.trim()) {
            return '번역할 텍스트를 입력해주세요.';
        }

        try {
            // isInputTranslation: true를 전달하여 컨텍스트 처리(마지막 메시지 제외 등)가 입력 번역에 맞게 동작하도록 함
            const translatedText = await translate(textToTranslate, { 
                prompt: inputPrompt,
                isInputTranslation: true 
            });
            return translatedText;
        } catch (error) {
            console.error('LLMTranslateInput Slash Command Error:', error);
            return `LLM 입력 번역 중 오류 발생: ${error.message}`;
        }
    },
    returns: ARGUMENT_TYPE.STRING,
}));

// 범위 지정 번역문 가져오기 커맨드
registerCommand(SlashCommand.fromProps({
    name: 'llmGetTranslations',
    callback: async (parsedArgs) => {
        const DEBUG_PREFIX_CMD = `[${extensionName} - Cmd /llmGetTranslations]`;
        logDebug(`${DEBUG_PREFIX_CMD} Executing with args:`, parsedArgs);

        let startIdStr = parsedArgs.startId || '0';
        let endIdStr = parsedArgs.endId || '{{lastMessageId}}';
        const includeOriginal = parsedArgs.includeOriginal === 'true'; // 기본값은 false
        const includeMessageId = parsedArgs.includeMessageId === 'true'; // 기본값은 false
        const excludeHidden = parsedArgs.excludeHidden !== 'false'; // 기본값은 true

        // 'last' 및 매크로 처리
        if (endIdStr === '{{lastMessageId}}' || endIdStr === 'last') {
            const context = getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                return '오류: 채팅 메시지가 없습니다.';
            }
            endIdStr = String(context.chat.length - 1);
            logDebug(`${DEBUG_PREFIX_CMD} 'last' converted to endId: ${endIdStr}`);
        }

        if (startIdStr === 'last') {
            const context = getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                return '오류: 채팅 메시지가 없습니다.';
            }
            startIdStr = String(context.chat.length - 1);
            logDebug(`${DEBUG_PREFIX_CMD} 'last' converted to startId: ${startIdStr}`);
        }

        // getTranslationsInRange 함수 호출
        return await getTranslationsInRange(startIdStr, endIdStr, includeOriginal, includeMessageId, excludeHidden);
    },
    helpString: '지정한 범위의 메시지들의 번역문을 가져옵니다. 기본적으로 번역문만 ID 없이 출력하고 숨겨진 메시지는 제외합니다.\n사용법: /llmGetTranslations [startId=<시작ID>] [endId=<종료ID>] [includeOriginal=true/false] [includeMessageId=true/false] [excludeHidden=true/false]',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'startId',
            description: '시작 메시지 ID (기본값: 0)',
            isRequired: false,
            defaultValue: '0',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'endId',
            description: '종료 메시지 ID (기본값: 마지막 메시지)',
            isRequired: false,
            defaultValue: '{{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'includeOriginal',
            description: '번역문이 없을 때 원문 포함 여부 (기본값: false)',
            isRequired: false,
            defaultValue: 'false',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'includeMessageId',
            description: '메시지 ID 출력 여부 (기본값: false)',
            isRequired: false,
            defaultValue: 'false',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'excludeHidden',
            description: '숨겨진 메시지 제외 여부 (기본값: true)',
            isRequired: false,
            defaultValue: 'true',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    returns: '범위 내 번역문들을 연결한 텍스트',
}));


logDebug('Slash Commands registered successfully.');

// 프롬프트 관리를 위한 클래스 정의
class PromptManager {
    constructor() {
        this.customPrompts = [];
        this.loadFromSettings();
        this.initializeEventListeners();
    }

    loadFromSettings() {
        this.customPrompts = extensionSettings.customPrompts || [];
        this.updatePromptDropdown();

        // 저장된 선택 프롬프트 복원
        const savedPromptId = extensionSettings.selected_translation_prompt_id;
        if (savedPromptId) {
            const selectedPrompt = this.customPrompts.find(p => p.id === savedPromptId);
            if (selectedPrompt) {
                extensionSettings.selected_translation_prompt = selectedPrompt.content;
                logDebug('Loaded saved prompt:', selectedPrompt.title);
            }
        }
    }

    initializeEventListeners() {
        // 프롬프트 추가/삭제 버튼 이벤트 리스너
        $(document).off('click', '#addPromptBtn').on('click', '#addPromptBtn', () => {
            this.showAddPromptDialog();
        });

        $(document).off('click', '#deletePromptBtn').on('click', '#deletePromptBtn', () => {
            this.deleteSelectedPrompt();
        });

        // 프롬프트 선택 이벤트 리스너 (번역용 + 편집기 로드)
        $(document).off('change', '#prompt_select').on('change', '#prompt_select', () => {
            const promptSelect = document.getElementById('prompt_select');
            const selectedId = promptSelect.value;

            // 편집기에 선택된 프롬프트 로드
            this.loadPromptToEditor();

            // 번역용 프롬프트 설정 (커스텀 프롬프트인 경우)
            const customPrompt = this.customPrompts.find(p => p.id === selectedId);
            if (customPrompt) {
                extensionSettings.selected_translation_prompt_id = selectedId;
                extensionSettings.selected_translation_prompt = customPrompt.content;
                logDebug('Selected translation prompt:', customPrompt.title, customPrompt.content);
            } else if (selectedId === 'llm_prompt_chat') {
                // 기본 프롬프트 선택 시 초기화
                extensionSettings.selected_translation_prompt_id = null;
                extensionSettings.selected_translation_prompt = null;
                logDebug('Using default translation prompt:', selectedId);
            }
            // [2.1.3] ⚙️ 보조 프롬프트(재번역 · 입력 · 보내기 · 프리필)는 보기 · 고치기용 — 골라 둔 채팅 번역 프롬프트를 지우지 않는다
            //         (예전엔 한 번 열어 보기만 해도 다음 부팅부터 기본 프롬프트로 번역했다)
            saveSettingsDebounced();
        });



        // 프롬프트 저장 버튼 이벤트 리스너
        $(document).off('click', '#prompt_save_button').on('click', '#prompt_save_button', () => {
            this.saveCurrentPrompt();
        });
    }

    updatePromptDropdown() {
        // 통합 프롬프트 선택 드롭다운 업데이트
        const promptSelect = document.getElementById('prompt_select');
        if (!promptSelect) return;

        // 현재 선택된 값 저장
        const currentValue = promptSelect.value;

        // 기존 옵션들 제거
        promptSelect.innerHTML = '';

        // 1. 채팅 번역 프롬프트 (메인 프롬프트)
        const mainOption = document.createElement('option');
        mainOption.value = 'llm_prompt_chat';
        mainOption.textContent = '채팅 번역 프롬프트';
        promptSelect.appendChild(mainOption);

        // 2. 커스텀 프롬프트들 추가
        this.customPrompts.forEach(prompt => {
            const option = document.createElement('option');
            option.value = prompt.id;
            option.textContent = prompt.title;
            promptSelect.appendChild(option);
        });

        // 3. 구분선 (disabled option)
        if (this.customPrompts.length > 0) {
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '─────────────────';
            promptSelect.appendChild(separator);
        }

        // 4. 유틸리티 프롬프트들 (맨 아래)
        const utilityPrompts = [
            { value: 'llm_prompt_retranslate_correction', text: '⚙️ 재번역 (교정) 프롬프트' },
            { value: 'llm_prompt_retranslate_guidance', text: '⚙️ 재번역 (지침교정) 프롬프트' },
            { value: 'llm_prompt_retranslate_paragraph', text: '⚙️ 재번역 (문단 수 맞추기) 프롬프트' },
            { value: 'llm_prompt_input', text: '⚙️ 입력 번역 프롬프트' },
            { value: 'llm_prompt_send', text: '⚙️ 보내기 번역 프롬프트' },
            { value: 'llm_prefill_content', text: '⚙️ 프리필' }
        ];

        utilityPrompts.forEach(prompt => {
            const option = document.createElement('option');
            option.value = prompt.value;
            option.textContent = prompt.text;
            promptSelect.appendChild(option);
        });

        // 이전 선택값 복원 또는 기본값 설정
        const valueExists = Array.from(promptSelect.options).some(opt => opt.value === currentValue && !opt.disabled);
        if (valueExists && currentValue) {
            promptSelect.value = currentValue;
        } else {
            promptSelect.value = 'llm_prompt_chat';
        }

        // 편집기에 현재 선택된 프롬프트 로드
        this.loadPromptToEditor();
    }

    loadPromptToEditor() {
        const promptSelect = document.getElementById('prompt_select');
        const promptEditor = document.getElementById('llm_prompt_editor');

        if (!promptSelect || !promptEditor) return;

        const selectedValue = promptSelect.value;

        // 커스텀 프롬프트인 경우
        const customPrompt = this.customPrompts.find(p => p.id === selectedValue);
        if (customPrompt) {
            promptEditor.value = customPrompt.content;
        } else {
            // 기본 프롬프트인 경우
            if (selectedValue && selectedValue in extensionSettings) {
                promptEditor.value = extensionSettings[selectedValue] || '';
            } else {
                promptEditor.value = '';
            }
        }
    }

    async showAddPromptDialog() {
        // 다이얼로그 컨텐츠 생성
        const wrapper = document.createElement('div');
        wrapper.classList.add('prompt-add-dialog');
        wrapper.innerHTML = `
            <div class="prompt-form">
                <div class="prompt-title">프롬프트 추가</div>
                <div class="prompt-form-group">
                    <input type="text" id="promptTitle" class="text_pole wide" placeholder="프롬프트 이름을 입력하세요" required>
                </div>
            </div>
        `;

        // SillyTavern의 팝업 시스템 사용
        const result = await callPopup(wrapper, 'confirm', '프롬프트 추가');

        if (!result) {
            return; // 취소 버튼 클릭 또는 팝업 닫힘
        }

        // 입력값 가져오기
        const title = document.getElementById('promptTitle').value.trim();

        if (!title) {
            toastr.warning('프롬프트 이름을 입력해주세요.');
            return;
        }

        // 새 프롬프트 추가
        const newPrompt = {
            id: Date.now().toString(),
            title: title,
            content: defaultSettings.llm_prompt_chat, // 기본 채팅 번역 프롬프트로 초기화
            isCustom: true
        };

        this.customPrompts.push(newPrompt);
        this.saveToSettings();
        this.updatePromptDropdown();
        toastr.success('새 프롬프트가 추가되었습니다.');
    }



    deleteSelectedPrompt() {
        const promptSelect = document.getElementById('prompt_select');
        const selectedPrompt = this.customPrompts.find(p => p.id === promptSelect.value);

        if (!selectedPrompt || !selectedPrompt.isCustom) {
            alert('삭제할 수 없는 프롬프트입니다.');
            return;
        }

        if (confirm('선택한 프롬프트를 삭제하시겠습니까?')) {
            const deletedPromptId = selectedPrompt.id;
            this.customPrompts = this.customPrompts.filter(p => p.id !== deletedPromptId);
            this.saveToSettings();

            // 현재 선택된 번역 프롬프트였다면 초기화
            if (extensionSettings.selected_translation_prompt_id === deletedPromptId) {
                extensionSettings.selected_translation_prompt_id = null;
                extensionSettings.selected_translation_prompt = null;
                saveSettingsDebounced();
            }

            // 프롬프트 선택 드롭다운 업데이트 (기본 프롬프트로 변경)
            this.updatePromptDropdown();

            toastr.success('프롬프트가 삭제되었습니다.');
        }
    }

    getSelectedPrompt() {
        // 저장된 선택 프롬프트 ID 확인
        const savedPromptId = extensionSettings.selected_translation_prompt_id;
        if (!savedPromptId) return null;

        // 저장된 ID로 프롬프트 찾기
        return this.customPrompts.find(p => p.id === savedPromptId);
    }

    saveToSettings() {
        extensionSettings.customPrompts = this.customPrompts;
        saveSettingsDebounced();
    }

    saveCurrentPrompt() {
        const promptSelector = document.getElementById('prompt_select');
        const promptEditor = document.getElementById('llm_prompt_editor');
        const selectedValue = promptSelector.value;
        const newContent = promptEditor.value.trim();

        if (!newContent) {
            toastr.error('프롬프트 내용을 입력해주세요.');
            return;
        }

        // 커스텀 프롬프트인 경우
        const customPrompt = this.customPrompts.find(p => p.id === selectedValue);
        if (customPrompt) {
            customPrompt.content = newContent;
            this.saveToSettings();

            // 현재 선택된 번역 프롬프트인 경우 업데이트
            if (extensionSettings.selected_translation_prompt_id === customPrompt.id) {
                extensionSettings.selected_translation_prompt = newContent;
                saveSettingsDebounced();
            }

            toastr.success(`프롬프트 "${customPrompt.title}"가 저장되었습니다.`);
        } else {
            // 기본 프롬프트인 경우
            const promptKey = selectedValue;
            if (promptKey && promptKey in extensionSettings) {
                extensionSettings[promptKey] = newContent;
                saveSettingsDebounced();
                toastr.success('프롬프트가 저장되었습니다.');
            }
        }
    }
}

// 번역문/원문 토글 슬래시 커맨드
registerCommand(SlashCommand.fromProps({
    name: 'LlmToggleTranslation',
    callback: async (parsedArgs) => {
        const messageIdStr = validateAndNormalizeMessageId(parsedArgs.messageId);

        let actualMessageId = messageIdStr;
        if (messageIdStr === 'last') {
            const context = getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                return '채팅 메시지가 없습니다.';
            }
            actualMessageId = context.chat.length - 1;
        }

        const messageId = parseInt(actualMessageId, 10);
        if (isNaN(messageId) || messageId < 0) {
            return `유효하지 않은 메시지 ID: "${actualMessageId}". 숫자를 입력하세요.`;
        }

        const context = getContext();
        if (!context || !context.chat) {
            return '컨텍스트 또는 채팅 데이터를 찾을 수 없습니다.';
        }
        if (messageId >= context.chat.length) {
            return `메시지 ID ${messageId}를 찾을 수 없습니다. (채팅 길이: ${context.chat.length})`;
        }

        // 번역 진행 중 확인
        if (isTranslationInProgress(messageId)) { // [1.9.5] 번호가 아니라 그 메시지
            toastr.info('번역이 이미 진행 중입니다.');
            return `메시지 ID ${messageId}는 이미 번역이 진행 중입니다.`;
        }

        // 백그라운드에서 토글 실행 (UI 블로킹 방지)
        handleTranslateButtonClick(messageId).catch(error => {
            console.error('Translation toggle error:', error);
            toastr.error(`메시지 ID ${messageId} 번역/원문 전환 중 오류가 발생했습니다.`);
        });

        return `메시지 ID ${messageId} 번역/원문 전환을 시작했습니다.`;
    },
    helpString: '지정한 ID의 메시지에서 번역문과 원문을 전환합니다. 번역문이 없으면 번역을 실행하고, 번역문이 표시되어 있으면 원문을 표시하며, 원문이 표시되어 있으면 번역을 실행합니다. messageId를 생략하면 마지막 메시지를 대상으로 합니다.\n사용법: /LlmToggleTranslation [messageId=<메시지ID>]',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'messageId',
            description: '번역/원문을 전환할 메시지의 ID 또는 "last" (마지막 메시지)',
            isRequired: false,
            defaultValue: '{{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
}));

// 전역 인스턴스 생성
let promptManager = null;
let presetManager = null;

// 설정을 깊은 복사(deep clone)하기 위한 헬퍼 함수
function simpleDeepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Date 객체 복사
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    // Array 복사
    if (Array.isArray(obj)) {
        return obj.map(simpleDeepClone);
    }

    // 일반 Object 복사
    const clone = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            clone[key] = simpleDeepClone(obj[key]);
        }
    }
    return clone;
}

// 프리셋 관리를 위한 클래스 정의
class PresetManager {
    constructor() {
        this.presets = [];
        this.loadFromSettings();
        this.initializeEventListeners();
    }

    loadFromSettings() {
        this.presets = extensionSettings.presets || [];
    }

    saveToSettings() {
        extensionSettings.presets = this.presets;
        saveSettingsDebounced();
    }

    initializeEventListeners() {
        // 드롭다운에서 프리셋 선택 시 바로 적용
        $(document).off('change', '#llm_preset_select').on('change', '#llm_preset_select', () => {
            const selectedId = $('#llm_preset_select').val();
            if (selectedId) {
                this.applyPreset(selectedId);
            }
        });

        $(document).off('click', '#llm_preset_save').on('click', '#llm_preset_save', () => {
            this.saveCurrentPreset();
        });

        // 업데이트 버튼: 선택된 프리셋을 현재 설정으로 덮어쓰기
        $(document).off('click', '#llm_preset_update').on('click', '#llm_preset_update', () => {
            this.updateSelectedPreset();
        });

        $(document).off('click', '#llm_preset_delete').on('click', '#llm_preset_delete', () => {
            this.deleteSelectedPreset();
        });

        $(document).off('click', '#llm_preset_export').on('click', '#llm_preset_export', () => {
            this.exportToJson();
        });

        $(document).off('change', '#llm_preset_import_file').on('change', '#llm_preset_import_file', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importFromJson(file);
                e.target.value = ''; // 같은 파일 다시 선택 가능하도록 초기화
            }
        });
    }

    updatePresetDropdown() {
        const select = $('#llm_preset_select');
        if (!select.length) return;

        select.html('<option value="">-- 프리셋 선택 --</option>');

        this.presets.forEach(preset => {
            const option = $('<option></option>')
                .val(preset.id)
                .text(preset.name);
            select.append(option);
        });
    }

    async saveCurrentPreset() {
    /*
		// --- [디버깅 로그 시작] ---
        console.group('🛑 [LLM Translator] 프리셋 저장/갱신 데이터 검증');
        
        // 1. extensionSettings 상태 확인
        const extPrompts = extensionSettings.customPrompts || [];
        console.log('1. extensionSettings.customPrompts (설정 변수):');
        console.log('   - 참조(Reference):', extPrompts);
        console.log('   - 개수:', extPrompts.length);
        if (extPrompts.length > 0) {
            console.log('   - 마지막 아이템:', extPrompts[extPrompts.length - 1].title);
        }

        // 2. promptManager 상태 확인
        const pmPrompts = (typeof promptManager !== 'undefined' && promptManager) ? promptManager.customPrompts : 'promptManager 없음';
        console.log('2. promptManager.customPrompts (매니저 원본):');
        console.log('   - 참조(Reference):', pmPrompts);
        console.log('   - 개수:', Array.isArray(pmPrompts) ? pmPrompts.length : 'N/A');
        if (Array.isArray(pmPrompts) && pmPrompts.length > 0) {
            console.log('   - 마지막 아이템:', pmPrompts[pmPrompts.length - 1].title);
        }

        // 3. 비교 분석
        if (Array.isArray(pmPrompts)) {
            const isRefSame = extPrompts === pmPrompts;
            const isContentSame = JSON.stringify(extPrompts) === JSON.stringify(pmPrompts);
            
            console.log(`3. 진단 결과:`);
            console.log(`   - 메모리 주소 일치 여부 (===): ${isRefSame ? '✅ 일치 (같은 객체)' : '❌ 불일치 (다른 객체)'}`);
            console.log(`   - 데이터 내용 일치 여부: ${isContentSame ? '✅ 일치' : '❌ 불일치 (데이터가 다름!)'}`);

            if (!isRefSame && !isContentSame) {
                console.error('🚨 [치명적] extensionSettings가 promptManager의 최신 데이터를 반영하지 못하고 있습니다!');
                console.error('   -> 지금 저장하면 extensionSettings의 구버전 데이터가 저장됩니다.');
            } else if (!isRefSame && isContentSame) {
                console.warn('⚠️ [주의] 데이터 내용은 같지만 참조가 끊어져 있습니다. 추후 동기화 문제가 발생할 수 있습니다.');
            }
        }
        console.groupEnd();
        // --- [디버깅 로그 끝] ---
		*/
		
		// 팝업 띄우기 BEFORE 스냅샷
		let presetName = await callGenericPopup(
			'저장할 프리셋의 이름을 입력하세요:',
			POPUP_TYPE.INPUT,
			'',
			{ wide: false, large: false }
		);

		if (!presetName || presetName.trim() === '') {
			toastr.info('프리셋 저장이 취소되었습니다.');
			return;
		}

		// 강제 동기화: promptManager → extensionSettings
		if (promptManager && promptManager.customPrompts) {
			extensionSettings.customPrompts = promptManager.customPrompts;
		}

		// 즉시 스냅샷
		const settingsSnapshot = simpleDeepClone(extensionSettings);
		const customPromptsSnapshot = simpleDeepClone(
			promptManager?.customPrompts || extensionSettings.customPrompts || []
		);

		// 재귀 방지
		if (settingsSnapshot.presets) delete settingsSnapshot.presets;
		if (settingsSnapshot.customPrompts) delete settingsSnapshot.customPrompts;
		// [추가] 주소별 모델 목록 캐시는 기기 상태라 프리셋에 담지 않는다.
		if (settingsSnapshot.custom_model_lists) delete settingsSnapshot.custom_model_lists;
		delete settingsSnapshot.show_chat_translate_menu;
        delete settingsSnapshot.show_input_translate_menu;
        if ('send_translate' in settingsSnapshot) delete settingsSnapshot.send_translate; // [1.6.0] 켜고 끄는 상태는 프리셋에 안 담음
		if ('glossary_entries' in settingsSnapshot) delete settingsSnapshot.glossary_entries; // [1.8.0] 용어집은 캐릭터별 데이터라 프리셋에 안 담음

		const newPreset = {
			id: `preset_${Date.now()}`,
			name: presetName.trim(),
			version: 2,
			settings: settingsSnapshot,
			customPrompts: customPromptsSnapshot // 별도 스냅샷 사용
		};

		this.presets.push(newPreset);
		this.saveToSettings();
		this.updatePresetDropdown();
		$('#llm_preset_select').val(newPreset.id);
		toastr.success(`프리셋 "${presetName}"이(가) 저장되었습니다.`);
		
		// 저장/갱신 직전 확인
		console.assert(
			extensionSettings.customPrompts === promptManager.customPrompts,
			'참조 불일치 감지!'
		);
    }

    // 드롭다운 선택 시 바로 적용 (확인 없이)
    applyPreset(selectedId) {
        const preset = this.presets.find(p => p.id === selectedId);
        if (!preset) {
            toastr.error('선택한 프리셋을 찾을 수 없습니다.');
            return;
        }

        // 1. 프리셋에서 데이터 추출
        const loadedSettings = simpleDeepClone(preset.settings);
        const loadedCustomPrompts = simpleDeepClone(preset.customPrompts || []);

        // 2. 현재 내 프리셋 목록 백업 (설정 초기화 시 날아가지 않도록)
        const myCurrentPresets = this.presets;
        // [추가] 주소별 모델 목록 캐시도 프리셋과 무관한 기기 상태이므로 유지한다.
        const myModelLists = extensionSettings.custom_model_lists || {};
        // [1.9.2] 프리셋에 안 담는 용어집(1.8.0) · 보내기 번역 켜짐(1.6.0)도 지키기. 예전에는 아래에서 설정을 싹 지운 뒤 되살리지 않아
        //         프리셋을 고르기만 해도 용어집 항목이 전부 사라지고 보내기 번역이 꺼졌다.
        const myGlossary = Array.isArray(extensionSettings.glossary_entries) ? extensionSettings.glossary_entries : [];
        const mySendTranslate = !!extensionSettings.send_translate;

        // 3. 기존 설정 싹 지우기 (여기서 customPrompts도 같이 지워짐)
        Object.keys(extensionSettings).forEach(key => {
            delete extensionSettings[key];
        });

        // 4. 설정 덮어쓰기 (이 시점에는 loadedSettings 안에 customPrompts가 없음)
        Object.assign(extensionSettings, loadedSettings);

        // 5. [중요 수정] 백업해둔 데이터 복구 (순서 중요: Object.assign 이후에 실행)
        extensionSettings.presets = myCurrentPresets;
        extensionSettings.customPrompts = loadedCustomPrompts;
        extensionSettings.custom_model_lists = myModelLists;
        extensionSettings.glossary_entries = myGlossary;       // [1.9.2]
        extensionSettings.send_translate = mySendTranslate;    // [1.9.2]

        // 6. 클래스 변수 동기화 및 매니저 리로드
        this.presets = myCurrentPresets; 
        
        if (promptManager) {
            promptManager.loadFromSettings(); 
        }

        // 7. UI 및 설정 저장
        loadSettings();

        if (promptManager && typeof promptManager.loadPromptToEditor === 'function') {
            promptManager.loadPromptToEditor();
        }

        this.updatePresetDropdown();
        $('#llm_preset_select').val(selectedId);

        saveSettingsDebounced();
        //toastr.success(`프리셋 "${preset.name}"을(를) 적용했습니다.`);
    }

    // 선택된 프리셋을 현재 설정으로 업데이트 (확인창 있음)
    async updateSelectedPreset() {
		/*
		// --- [디버깅 로그 시작] ---
        console.group('🛑 [LLM Translator] 프리셋 저장/갱신 데이터 검증');
        
        // 1. extensionSettings 상태 확인
        const extPrompts = extensionSettings.customPrompts || [];
        console.log('1. extensionSettings.customPrompts (설정 변수):');
        console.log('   - 참조(Reference):', extPrompts);
        console.log('   - 개수:', extPrompts.length);
        if (extPrompts.length > 0) {
            console.log('   - 마지막 아이템:', extPrompts[extPrompts.length - 1].title);
        }

        // 2. promptManager 상태 확인
        const pmPrompts = (typeof promptManager !== 'undefined' && promptManager) ? promptManager.customPrompts : 'promptManager 없음';
        console.log('2. promptManager.customPrompts (매니저 원본):');
        console.log('   - 참조(Reference):', pmPrompts);
        console.log('   - 개수:', Array.isArray(pmPrompts) ? pmPrompts.length : 'N/A');
        if (Array.isArray(pmPrompts) && pmPrompts.length > 0) {
            console.log('   - 마지막 아이템:', pmPrompts[pmPrompts.length - 1].title);
        }

        // 3. 비교 분석
        if (Array.isArray(pmPrompts)) {
            const isRefSame = extPrompts === pmPrompts;
            const isContentSame = JSON.stringify(extPrompts) === JSON.stringify(pmPrompts);
            
            console.log(`3. 진단 결과:`);
            console.log(`   - 메모리 주소 일치 여부 (===): ${isRefSame ? '✅ 일치 (같은 객체)' : '❌ 불일치 (다른 객체)'}`);
            console.log(`   - 데이터 내용 일치 여부: ${isContentSame ? '✅ 일치' : '❌ 불일치 (데이터가 다름!)'}`);

            if (!isRefSame && !isContentSame) {
                console.error('🚨 [치명적] extensionSettings가 promptManager의 최신 데이터를 반영하지 못하고 있습니다!');
                console.error('   -> 지금 저장하면 extensionSettings의 구버전 데이터가 저장됩니다.');
            } else if (!isRefSame && isContentSame) {
                console.warn('⚠️ [주의] 데이터 내용은 같지만 참조가 끊어져 있습니다. 추후 동기화 문제가 발생할 수 있습니다.');
            }
        }
        console.groupEnd();
        // --- [디버깅 로그 끝] ---
		
		*/
		
		const selectedId = $('#llm_preset_select').val();
		if (!selectedId) {
			toastr.warning('업데이트할 프리셋을 선택하세요.');
			return;
		}

		const preset = this.presets.find(p => p.id === selectedId);
		if (!preset) {
			toastr.error('선택한 프리셋을 찾을 수 없습니다.');
			return;
		}

		// 팝업 뜨기 BEFORE 스냅샷 찍기
		// 강제 동기화
		if (promptManager && promptManager.customPrompts) {
			extensionSettings.customPrompts = promptManager.customPrompts;
		}

		// 즉시 스냅샷
		const settingsSnapshot = simpleDeepClone(extensionSettings);
		const customPromptsSnapshot = simpleDeepClone(
			promptManager?.customPrompts || extensionSettings.customPrompts || []
		);

		// 팝업 띄우기
		const confirm = await callGenericPopup(
			`"${preset.name}" 프리셋을 현재 설정으로 업데이트하시겠습니까?\n(기존 프리셋 내용이 덮어쓰기됩니다.)`,
			POPUP_TYPE.CONFIRM
		);

		if (!confirm) {
			toastr.info('프리셋 업데이트가 취소되었습니다.');
			return;
		}

		// 재귀 방지
		if (settingsSnapshot.presets) delete settingsSnapshot.presets;
		if (settingsSnapshot.customPrompts) delete settingsSnapshot.customPrompts;
		// [추가] 주소별 모델 목록 캐시는 프리셋에 담지 않는다.
		if (settingsSnapshot.custom_model_lists) delete settingsSnapshot.custom_model_lists;
		delete settingsSnapshot.show_chat_translate_menu;
        delete settingsSnapshot.show_input_translate_menu;
        if ('send_translate' in settingsSnapshot) delete settingsSnapshot.send_translate; // [1.6.0] 켜고 끄는 상태는 프리셋에 안 담음
		if ('glossary_entries' in settingsSnapshot) delete settingsSnapshot.glossary_entries; // [1.8.0] 용어집은 캐릭터별 데이터라 프리셋에 안 담음

		// 미리 찍어둔 스냅샷 사용
		preset.version = 2;
		preset.settings = settingsSnapshot;
		preset.customPrompts = customPromptsSnapshot;

		this.saveToSettings();
		toastr.success(`프리셋 "${preset.name}"을(를) 업데이트했습니다.`);
		// 저장/갱신 직전 확인
		console.assert(
			extensionSettings.customPrompts === promptManager.customPrompts,
			'참조 불일치 감지!'
		);
    }

    async deleteSelectedPreset() {
        const selectedId = $('#llm_preset_select').val();
        if (!selectedId) {
            toastr.warning('삭제할 프리셋을 선택하세요.');
            return;
        }

        const preset = this.presets.find(p => p.id === selectedId);
        if (!preset) {
            toastr.error('선택한 프리셋을 찾을 수 없습니다.');
            return;
        }

        const confirm = await callGenericPopup(
            `"${preset.name}" 프리셋을 삭제하시겠습니까?`,
            POPUP_TYPE.CONFIRM
        );

        if (!confirm) {
            toastr.info('프리셋 삭제가 취소되었습니다.');
            return;
        }

        this.presets = this.presets.filter(p => p.id !== selectedId);
        this.saveToSettings();
        this.updatePresetDropdown();

        toastr.success(`프리셋 "${preset.name}"이(가) 삭제되었습니다.`);
		
    }

    exportToJson() {
        const exportData = {
            version: 1,
            exportDate: new Date().toISOString(),
            customPrompts: extensionSettings.customPrompts || [],
            presets: this.presets
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `llm-translator-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toastr.success('프롬프트 및 프리셋을 JSON으로 내보냈습니다.');
    }

    async importFromJson(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // 버전 및 데이터 유효성 검사
            if (!data.customPrompts && !data.presets) {
                toastr.error('유효하지 않은 JSON 파일입니다.');
                return;
            }

            const confirm = await callGenericPopup(
                `JSON 파일을 가져오시겠습니까?\n\n` +
                `• 커스텀 프롬프트: ${data.customPrompts?.length || 0}개\n` +
                `• 프리셋: ${data.presets?.length || 0}개\n\n` +
                `(기존 데이터는 덮어쓰기됩니다.)`,
                POPUP_TYPE.CONFIRM
            );

            if (!confirm) {
                toastr.info('가져오기가 취소되었습니다.');
                return;
            }

            // 커스텀 프롬프트 복원
            if (data.customPrompts) {
                extensionSettings.customPrompts = data.customPrompts;
                if (promptManager) {
                    promptManager.loadFromSettings();
                }
            }

            // 프리셋 복원
            if (data.presets) {
                this.presets = data.presets;
                extensionSettings.presets = this.presets;
                this.updatePresetDropdown();
            }

            saveSettingsDebounced();
            toastr.success('프롬프트 및 프리셋을 가져왔습니다.');

        } catch (error) {
            console.error('Import error:', error);
            toastr.error('JSON 파일을 읽는 중 오류가 발생했습니다.');
        }
    }
}


// Archive integration is local and optional. Concurrent callers share the existing job.
if (!duplicate) globalThis[Symbol.for('st.llm-translator.archive.v1')] = {
    automatic:()=>shouldTranslate(incomingTypes),
    async wait(message,isAlive) {
        if(!shouldTranslate(incomingTypes)||!isAlive())return;
        const id=getContext().chat.indexOf(message);
        if(id<0||message.is_user||message.is_system)return;
        // [2.1.3] 끊긴 답은 번역을 시작하지 않고 원문으로 기록하게 둔다 (직접 누른 번역이 돌고 있으면 그것만 기다린다)
        if(skipCutAutoTranslate(message,id)&&!isTranslationInProgress(id))return;
        let cancel;
        const stopped=new Promise(resolve=>cancel=resolve);
        const check=()=>{if(!isAlive())cancel();};
        const events=[event_types.CHAT_CHANGED,event_types.MESSAGE_DELETED,event_types.MESSAGE_EDITED,event_types.MESSAGE_SWIPED].filter(Boolean);
        for(const type of events)eventSource.on?.(type,check);
        try { await Promise.race([translateMessage(id,false,'auto'),stopped]); }
        finally { for(const type of events)eventSource.removeListener?.(type,check); }
    },
    async lookup(record,source) {
        const context=getContext();
        const id=Number(record.mesId);
        const messages=Number.isInteger(id)&&id>=0&&context.chat[id]?[context.chat[id]]:context.chat;
        for(const message of messages) {
            if(message?.is_user||typeof message?.mes!=='string')continue;
            const original=substituteParams(message.mes,context.name1,message.name);
            if(!original.includes(String(source).replace(/^[“"「『]+|[”"」』]+$/g,'')))continue;
            // Exact-source IndexedDB lookup cannot return another swipe's translation.
            const translated=await getTranslationFromDB(original).catch(()=>null);
            if(!translated&&message.extra?.original_text_hash===originalHashOf(original)) {
                // [2.1.3] 번역문 없이 백업만 남은 건 지운 번역이다 (예전 휴지통이 남긴 것) — 읽지 않는다
                const display=message.extra.display_text?(message.extra.original_translation_backup||message.extra.display_text):'';
                const paired=translationFromDisplay(display,source);
                if(paired)return paired;
                if(display&&!/<[a-z][\s\S]*>/i.test(display)) { const plain=matchingTranslation(original,display,source);if(plain)return plain; }
            }
            if(!translated)continue;
            const found=matchingTranslation(original,translated,source);
            if(found)return found;
        }
        return '';
    }
};

// Optional persona editor bridge; reuses direct/profile credentials without changing them.
if (!duplicate) globalThis[Symbol.for('st.llm-translator.persona.v1')] = makePersonaBridge(callLLMAPI, text => buildGlossaryBlock(text, { reverse: true }));

// Module API: callers receive the same guarded jobs as the UI.
export { translate, translateMessage, retranslateMessage, onTranslateInputMessageClick, onTranslateChatClick, onMessageSentTranslate };
