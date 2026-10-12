// 캐릭터 에셋 규칙을 생성 전에 준비한다. 자동/수동은 한 자리만 사용하고, 끄면 둘 다 비운다.
import { eventSource, event_types, setExtensionPrompt, extension_prompt_types, extension_prompt_roles, isGenerating, setSendButtonState } from '../../../../../../../script.js';
import { getContext } from '../../../../../../extensions.js';
import { addonsEnabled } from '../../usage-mode.js';
import { settings, currentFolder } from './state.js';
import { runtime, reload, ensureLoaded, expandedPrompt, onStoreChange } from './store.js';
import { pickActive } from './pick.js';

const PROMPT_KEY = 'blue_lemonade_character_assets';
const PREPARE_TIMEOUT = 8000;
let generationType = null;
let generationEpoch = 0;
let started = false;
let pendingPreparation = null;
let sendLock = null;

function cancelPreparation(stop = false) {
    const pending = pendingPreparation;
    pendingPreparation = null;
    if (!pending) return;
    pending.cancel();
    if (stop) getContext().stopGeneration?.();
}

function holdSendState() {
    if (!sendLock) sendLock = { wasGenerating: isGenerating(), holders: 0 };
    const lock = sendLock;
    ++lock.holders;
    if (!lock.wasGenerating) setSendButtonState(true);
    return () => {
        if (--lock.holders) return;
        if (sendLock === lock) sendLock = null;
        if (!lock.wasGenerating && isGenerating()) setSendButtonState(false);
    };
}

function addonActive() {
    const theme = getContext().extensionSettings?.salty;
    return !!theme?.addons?.assets && addonsEnabled(theme);
}

/** 패널용 상태. 목록 매크로와 그림 표시는 이 스위치와 독립적이다. */
export function promptStatus() {
    const context = getContext();
    const store = settings();
    const enabled = store?.promptEnabled !== false && addonActive();
    const placement = store?.promptPlacement === 'manual' ? 'manual' : 'auto';
    const folder = currentFolder();
    const loading = !!folder && (runtime.folder !== folder || runtime.loading);
    const hasImages = !!folder && !loading && !!runtime.keywords;
    const available = hasImages && !!expandedPrompt().trim();
    // 1.6.0 다른 모델이 고르기가 돌면 본문 모델에는 규칙 · 목록을 보내지 않는다 (답을 받은 뒤 연결한 모델이 고른다)
    const pick = enabled && pickActive(store);
    const reason = !enabled ? 'off' : context.groupId ? 'group' : !folder ? 'no-character'
        : loading ? 'loading' : !hasImages ? 'empty' : !available ? 'empty-rules' : pick ? 'pick' : placement === 'manual' ? 'manual' : 'ready';
    return { enabled, placement, loading, available, reason, pick };
}

function excludedGeneration() {
    return generationType === 'quiet' || generationType === 'impersonate';
}

/** 오래된 프리셋에 매크로가 남아 있어도 자동 주입과 중복되지 않는다. */
export function manualPrompt() {
    const status = promptStatus();
    return status.enabled && !status.pick && status.placement === 'manual' && status.available && !excludedGeneration() ? expandedPrompt() : '';
}

/** 설정을 바꿀 때 즉시 호출한다. 여기서는 네트워크 요청을 시작하지 않는다. */
export function syncPrompt() {
    const status = promptStatus();
    if (!status.enabled || !currentFolder()) cancelPreparation();
    const text = status.enabled && !status.pick && status.placement === 'auto' && status.available && !excludedGeneration() ? expandedPrompt() : '';
    setExtensionPrompt(PROMPT_KEY, text, extension_prompt_types.IN_CHAT, 1, false, extension_prompt_roles.SYSTEM);
    return status;
}

function identity() {
    const context = getContext();
    return { folder: currentFolder(), group: context.groupId, chat: context.chat, chatId: context.chatId };
}

function sameIdentity(before) {
    const after = identity();
    return before.folder === after.folder && before.group === after.group && before.chat === after.chat && before.chatId === after.chatId;
}

/** ST는 이 이벤트를 await한 뒤 카드·프리셋의 매크로와 확장 프롬프트를 조합한다. */
export async function preparePrompt(type, _options, dryRun) {
    // 토큰 미리보기는 현재 준비된 슬롯을 읽는다. 실제 생성 중인 타입/대기를 덮어쓰지 않는다.
    if (dryRun) return;
    cancelPreparation();
    const epoch = ++generationEpoch;
    generationType = type;
    const before = identity();
    const status = syncPrompt();
    if (!status.enabled || excludedGeneration() || !before.folder) return;
    if (_options?.signal?.aborted) { getContext().stopGeneration?.(); return; }
    if (!status.loading) return;
    const waiting = {};
    const cancelled = new Promise(resolve => { waiting.cancel = () => resolve(false); });
    pendingPreparation = waiting;
    const signal = _options?.signal;
    const aborted = () => { if (pendingPreparation === waiting) cancelPreparation(true); };
    signal?.addEventListener('abort', aborted, { once: true });
    // ST는 이 이벤트 뒤에 생성 중 표시를 세운다. 목록 대기 중 일반 채팅 전환·중복 전송을 막는다.
    const release = holdSendState();
    const timeout = setTimeout(waiting.cancel, PREPARE_TIMEOUT);
    let ready = false;
    try {
        ready = await Promise.race([ensureLoaded(), cancelled]);
    } finally {
        clearTimeout(timeout);
        release();
        signal?.removeEventListener('abort', aborted);
        if (pendingPreparation === waiting) pendingPreparation = null;
    }
    if (epoch !== generationEpoch) return;
    if (!sameIdentity(before)) { getContext().stopGeneration?.(); syncPrompt(); return; }
    if (!ready) return;
    syncPrompt();
}

export function setupPrompt() {
    if (started) return;
    started = true;
    onStoreChange(syncPrompt);
    eventSource.on(event_types.GENERATION_AFTER_COMMANDS, preparePrompt);
    eventSource.on(event_types.CHAT_CHANGED, () => {
        cancelPreparation(true);
        ++generationEpoch;
        generationType = null;
        syncPrompt();
        return reload();
    });
    for (const event of [event_types.GENERATION_ENDED, event_types.GENERATION_STOPPED]) {
        if (event) eventSource.on(event, () => {
            cancelPreparation();
            ++generationEpoch;
            generationType = null;
            syncPrompt();
        });
    }
    if (event_types.SETTINGS_UPDATED) eventSource.on(event_types.SETTINGS_UPDATED, syncPrompt);
    for (const event of ['bl:addons-state', 'bl:settings-replaced']) globalThis.window?.addEventListener(event, syncPrompt);
    syncPrompt();
}
