// 7.9.9 실리태번 기본 「번역」 확장(public/scripts/extensions/translate)과 같이 켜져 있을 때 — 사용자 설정은 꺼져 있지만 다른 사용자(제보자)는 켜 둘 수 있다.
// 그 확장은 MESSAGE_UPDATED 마다 translateMessageEdit 을 돈다 (실리태번 1.16 · 1.19 같음):
//   · auto_mode 'none': 번역문(extra.display_text)이 있으면 지우고 다시 그린다 → 메시지를 고치거나(편집 끝 · 취소) 다른 확장이 MESSAGE_UPDATED 를 내면 테마 LLM 번역이 사라진다
//   · auto_mode 'responses' · 'both'(답) / 'inputs' · 'both'(내 글): 제 공급자(Google · DeepL …)로 번역해 display_text 를 덮어쓴다 → LLM 번역이 기계 번역으로 바뀐다
//   또 CHARACTER_MESSAGE_RENDERED 를 makeFirst 로 먼저 받아 자동 모드면 제 번역을 먼저 붙인다 (그건 테마 자동 번역이 해시가 없는 번역문으로 보고 다시 번역한다).
// 테마 번역기는 ① 켜져 있음을 알린다 — 한 세션 한 번, 알림을 누르면 그 확장을 끄고 새로 고친다(사용자가 누를 때만) ② MESSAGE_UPDATED 뒤 지워지거나 덮인 번역문을
//   알고 있는 번역(이 세션에 붙인 것 · 번역 캐시)으로 되살린다 — 원문이 그대로일 때만(해시 같음) · 원문 보기 중(original_translation_backup)이면 손대지 않는다.
// 실리태번 모듈을 불러오지 않는다 — node 로 시험한다 (tools/tests/translator-builtin-translate.mjs).

const INCOMING = ['responses', 'both'], OUTGOING = ['inputs', 'both'];

/** 기본 번역 확장의 상태: 켜져 있나 · 자동 모드 · 이 메시지를 자동으로 번역하나 */
export function builtinTranslateState(settings) {
    const disabled = settings?.disabledExtensions;
    const enabled = !(Array.isArray(disabled) && disabled.includes('translate'));
    const autoMode = typeof settings?.translate?.auto_mode === 'string' ? settings.translate.auto_mode : 'none';
    return {
        enabled, autoMode,
        autoFor: message => enabled && !!message && (message.is_user ? OUTGOING : INCOMING).includes(autoMode),
    };
}

/** 안내 문구 (해요체) — 켜져 있지 않으면 null. rescued: 방금 지워진 번역문을 되살렸다 */
export function builtinTranslateNotice(state, { rescued = false } = {}) {
    if (!state?.enabled) return null;
    const how = state.autoMode && state.autoMode !== 'none'
        ? '그 확장이 메시지를 고칠 때마다 번역문을 제 기계 번역으로 덮어써서'
        : '그 확장이 메시지를 고치거나 다시 그릴 때마다 번역문을 지워서';
    return `실리태번 기본 「번역」 확장이 켜져 있어요. ${how} 테마 LLM 번역과 부딪혀요.${rescued ? ' 지워진 번역문은 되살렸어요.' : ''} 확장 메뉴에서 기본 「번역」을 꺼 주세요 — 이 알림을 누르면 바로 끄고 새로 고쳐요.`;
}

/**
 * MESSAGE_UPDATED 뒤 되살릴지 — 기본 확장이 먼저 돌아(청취 순서) 번역문을 지웠거나 덮어썼을 때.
 *   state: builtinTranslateState · message: 채팅 메시지 · currentHash: 지금 원문의 해시 · known: 이 원문에 알고 있는 번역문(표시용, 없으면 null)
 * → { display } (되살릴 번역문) 또는 null (손대지 않음)
 */
export function rescuePlan({ state, message, currentHash, known }) {
    if (!state?.enabled || !message || message.is_system || !known) return null;
    const extra = message.extra;
    if (!extra || !extra.original_text_hash || extra.original_text_hash !== currentHash) return null;   // 원문이 바뀌었으면 보통의 편집 처리로
    if (extra.original_translation_backup !== undefined) return null;   // 원문 보기 중 — 사용자가 고른 상태
    if (!extra.display_text) return { display: known, why: 'deleted' };   // 지웠다
    if (state.autoFor(message) && extra.display_text !== known && extra.translation_edited !== currentHash) return { display: known, why: 'overwritten' };   // 제 번역으로 덮었다
    return null;
}
