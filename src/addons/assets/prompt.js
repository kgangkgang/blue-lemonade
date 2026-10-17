// 캐릭터 에셋 규칙을 생성 전에 준비한다. 자동/수동은 한 자리만 사용하고, 끄면 둘 다 비운다.
// 1.6.9 그룹 채팅: 실리태번이 멤버 차례마다 this_chid 를 그 멤버로 바꾼 뒤 Generate 를 부르므로(GENERATION_AFTER_COMMANDS 가 차례마다),
// 그 차례에 말하는 멤버의 목록 · 규칙만 넣는다. 멤버 전부를 넣지 않는다. 생성 밖(this_chid 없음)이면 비운다.
import { eventSource, event_types, setExtensionPrompt, extension_prompt_types, extension_prompt_roles, isGenerating, setSendButtonState } from '../../../../../../../script.js';
import { getContext } from '../../../../../../extensions.js';
// 6.5.3 생성 상태 (본채팅 생성만 · 테마의 붙잡음 등록) — import 줄 끝에 주석을 달지 않는다 (character-assets-prompt 시험이 import 줄을 통째로 뗀다)
import { isMainChatGenerating, holdGenerationState } from '../../main-chat-rules.js';
import { addonsEnabled } from '../../usage-mode.js';
import { settings, currentFolder, speakerFolder } from './state.js';
import { runtime, reload, ensureLoaded, expandedPrompt, onStoreChange, loadMember, memberEntry, clearMembers } from './store.js';
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
    const releaseState = holdGenerationState('assets');   // 6.5.3 테마의 붙잡음 (생성 중은 아니다 — 번역 · 다시 쓰기 단추가 끝나길 기다리게)
    if (!lock.wasGenerating) setSendButtonState(true);
    return () => {
        releaseState();
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
    const group = !!context.groupId;
    // 1.6.9 그룹은 지금 말하는 멤버(생성 중에만 있다)의 목록 — 1:1 은 지금 캐릭터
    const folder = group ? speakerFolder(context) : currentFolder();
    const entry = group ? memberEntry(folder) : runtime;
    const loading = !!folder && (group ? !entry : runtime.folder !== folder || runtime.loading);
    const hasImages = !!folder && !loading && !!entry?.keywords;
    const available = hasImages && !!expandedPrompt(entry).trim();
    // 1.6.0 다른 모델이 고르기가 돌면 본문 모델에는 규칙 · 목록을 보내지 않는다 (답을 받은 뒤 연결한 모델이 고른다)
    const pick = enabled && pickActive(store);
    const reason = !enabled ? 'off' : group && !folder ? 'group' : !folder ? 'no-character'
        : loading ? 'loading' : !hasImages ? 'empty' : !available ? 'empty-rules' : pick ? 'pick' : placement === 'manual' ? 'manual' : 'ready';
    return { enabled, placement, loading, available, reason, pick, group, folder, entry };
}

function excludedGeneration() {
    return generationType === 'quiet' || generationType === 'impersonate';
}

/** 오래된 프리셋에 매크로가 남아 있어도 자동 주입과 중복되지 않는다. */
export function manualPrompt() {
    const status = promptStatus();
    return status.enabled && !status.pick && status.placement === 'manual' && status.available && !excludedGeneration() ? expandedPrompt(status.entry) : '';
}

/** 설정을 바꿀 때 즉시 호출한다. 여기서는 네트워크 요청을 시작하지 않는다. */
export function syncPrompt() {
    const status = promptStatus();
    if (!status.enabled || !status.folder) cancelPreparation();
    const text = status.enabled && !status.pick && status.placement === 'auto' && status.available && !excludedGeneration() ? expandedPrompt(status.entry) : '';
    setExtensionPrompt(PROMPT_KEY, text, extension_prompt_types.IN_CHAT, 1, false, extension_prompt_roles.SYSTEM);
    return status;
}

function identity() {
    const context = getContext();
    return { folder: context.groupId ? speakerFolder(context) : currentFolder(), group: context.groupId, chat: context.chat, chatId: context.chatId };
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
        ready = await Promise.race([before.group ? loadMember(before.folder).then(Boolean) : ensureLoaded(), cancelled]);
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
        clearMembers();   // 1.6.9 그룹 멤버 목록은 채팅마다 새로 (그 멤버 메시지가 보일 때 · 차례가 올 때 읽는다)
        syncPrompt();
        return reload();
    });
    for (const event of [event_types.GENERATION_ENDED, event_types.GENERATION_STOPPED]) {
        if (event) eventSource.on(event, (arg) => {
            // 6.5.3 이 생성의 끝만: 실리태번 헬퍼가 제 generate 를 멈출 때 내는 GENERATION_STOPPED(생성 id) · 조용한 생성이 끝나며 본채팅 도중에 내는 GENERATION_ENDED 는 아니다
            //   (그때 준비를 취소하면 이 답의 그림 규칙이 빠진다 — main-chat-rules isMainChatGenerating 은 살아 있는 스트림을 본다)
            if ((typeof arg === 'string' && arg) || isMainChatGenerating()) return;
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
