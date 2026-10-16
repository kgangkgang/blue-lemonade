// 6.9.5 번역 기기 간 공유 — 번역을 고칠 때 필요한 것(손대기 전 번역 글)을 채팅 파일에도 남긴다.
//   예전에는 그 글이 이 브라우저의 IndexedDB(LLMtranslatorDB)에만 있어, 다른 기기 · 다른 브라우저에서 만든 번역은 수정 창 · 교정 재번역 ·
//   고른 글 지우기가 「DB에서 원본을 찾을 수 없습니다」로 멈췄다 (보이는 글에 HTML 이 하나라도 있거나 원문 함께 보기면 보이는 글로 대신할 수 없다).
//   message.extra.translation_source = { v: 1, o: 원문 해시, d: 보이는 번역 해시, t?: 번역 글 } — t 는 보이는 글이 번역 글과 다를 때만(원문 함께 보기).
//   번역 그대로 보기(기본)면 해시 둘뿐이다. IndexedDB · original_text_hash · 원문(mes)은 그대로 두고, 이 칸을 모르는 판은 그냥 지나친다.
// 읽을 때는 o 가 지금 원문, d 가 지금 보이는 번역(원문 보기 중이면 치워 둔 번역)과 맞을 때만 믿는다 — 이 칸을 안 고치는 길(옛 판 · 다른 확장)이
//   표시를 바꿨으면 저절로 빠지고 예전 동작으로 간다. 순수 함수 (시험: tools/tests/translation-source.mjs)
export const SOURCE_KEY = 'translation_source';

const shownOf = extra => (typeof extra?.original_translation_backup === 'string' && extra.original_translation_backup ? extra.original_translation_backup : extra?.display_text);

/** 번역을 붙일 때: raw = processTranslationText 에 넣은 번역 글, display = 나온 표시 (원문 보기 중이면 치워 둔 번역 자리에 들어간 글) */
export function rememberSource(extra, { original, raw, display, hash }) {
    if (!extra || typeof extra !== 'object' || typeof raw !== 'string' || typeof display !== 'string' || !raw.trim() || !display) return false;
    const record = { v: 1, o: String(hash(String(original ?? ''))), d: String(hash(display)) };
    if (raw !== display) record.t = raw;
    extra[SOURCE_KEY] = record;
    return true;
}

/** 지금 보이는 번역의 번역 글 — 기록이 지금 원문 · 지금 표시와 맞을 때만, 아니면 null */
export function recordedSource(extra, { original, hash }) {
    const record = extra?.[SOURCE_KEY];
    if (!record || typeof record !== 'object' || record.v !== 1 || typeof record.o !== 'string' || typeof record.d !== 'string') return null;
    const now = String(hash(String(original ?? '')));
    if (record.o !== now || (extra.original_text_hash !== undefined && String(extra.original_text_hash) !== now)) return null;
    const shown = shownOf(extra);
    if (typeof shown !== 'string' || !shown || String(hash(shown)) !== record.d) return null;
    const raw = typeof record.t === 'string' ? record.t : shown;
    return raw.trim() ? raw : null;
}

export function forgetSource(extra) {
    if (extra && typeof extra === 'object') delete extra[SOURCE_KEY];
}
