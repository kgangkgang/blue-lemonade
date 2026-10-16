// 6.9.5 번역 기기 간 공유 — 번역을 고칠 때 필요한 것(손대기 전 번역 글)을 채팅 파일에도 남긴다.
//   예전에는 그 글이 이 브라우저의 IndexedDB(LLMtranslatorDB)에만 있어, 다른 기기 · 다른 브라우저에서 만든 번역은 수정 창 · 교정 재번역 ·
//   고른 글 지우기가 「DB에서 원본을 찾을 수 없습니다」로 멈췄다 (보이는 글에 HTML 이 하나라도 있거나 원문 함께 보기면 보이는 글로 대신할 수 없다).
//   message.extra.translation_source = { v: 1, o: 원문 해시, d: 보이는 번역 해시, t?: 번역 글 } — t 는 보이는 글이 번역 글과 다를 때만(원문 함께 보기).
//   번역 그대로 보기(기본)면 해시 둘뿐이다. IndexedDB · original_text_hash · 원문(mes)은 그대로 두고, 이 칸을 모르는 판은 그냥 지나친다.
// 읽을 때는 o 가 지금 원문, d 가 지금 보이는 번역(원문 보기 중이면 치워 둔 번역)과 맞을 때만 믿는다 — 이 칸을 안 고치는 길(옛 판 · 다른 확장)이
//   표시를 바꿨으면 저절로 빠지고 예전 동작으로 간다. 순수 함수 (시험: tools/tests/translation-source.mjs)
// 6.9.6 원문 함께 보기에서도 대개 짧게: 표시(접기 · 원문 먼저 · 펼침 HTML)에서 번역 쪽만 떼어 낸 글이 번역 글과 똑같으면 t 없이 v: 2 로 적는다 —
//   6.9.5 는 t 를 늘 넣어 메시지마다 번역 한 벌이 더 저장됐고, 실리태번이 extra 를 스와이프 기록(swipe_info)에 복사해 두 벌 · 세 벌이 됐다.
//   d(표시 해시)가 맞으면 표시가 그때와 같으니 떼어 낸 글도 그때와 같다. 6.9.5 는 v: 2 를 모르는 판으로 보고 예전 길(IndexedDB)로 간다 (표시 HTML 을 번역 글로 쓰지 않게).
//   떼어 낼 수 없는 꼴(줄을 넘는 강조 · 보호 블록 · 문단 수가 달라 통째로 붙인 것 …)만 예전처럼 v: 1 + t.
//   표시를 지우는 길마다 기록도 지우고(forgetSource), 남은 기록은 pruneSource 가 뗀다 (표시가 없거나 원문 해시가 기록과 다르면 — 스와이프 · 넘겨 새로 만들기 · 이어 쓰기 뒤).
export const SOURCE_KEY = 'translation_source';

const shownOf = extra => (typeof extra?.original_translation_backup === 'string' && extra.original_translation_backup ? extra.original_translation_backup : extra?.display_text);

// processTranslationText 의 함께 보기 감싸개 (index.js createDetailsTag · renderAllInOne · renderInterleaved 의 간격 요소와 같은 글자)
const GAP_LINE = '<div class="llmt-para-gap"></div>';
const LINE_WRAPS = [
    { head: '<details class="llm-translator-details mode-folded"><summary class="llm-translator-summary"><span class="translated_text clickable-text-org">', mid: '</span></summary><span class="original_text">', tail: '</span></details>', first: true },
    { head: '<details class="llm-translator-details mode-original-first"><summary class="llm-translator-summary"><span class="original_text clickable-text-org">', mid: '</span></summary><span class="translated_text">', tail: '</span></details>', first: false },
    { head: '<span class="translated_text mode-unfolded">', mid: '</span><br><span class="original_text mode-unfolded">', tail: '</span>', first: true },
];
const WHOLE = /^<details class="llm-translator-details mode-(folded|original-first)">\n[ \t]*<summary class="llm-translator-summary">([\s\S]*)<\/summary>\n[ \t]*([\s\S]*)\n[ \t]*<\/details>$/;
/** 문단 블록(<p>…<br>…</p><p>…</p>)을 글로 — translation-segments.js paragraphBlocks 를 거꾸로 */
function unblock(html) {
    if (!/^<p>[\s\S]*<\/p>$/.test(html)) return null;
    return html.slice(3, -4).split('</p><p>').map(part => part.replace(/<br>/g, '\n')).join('\n\n');
}
/**
 * 6.9.6 원문 함께 보기 표시에서 번역 쪽 글만 → 글, 함께 보기 표시가 아니거나 모양이 다르면 null.
 * 줄마다 감싼 표시는 줄 머리 표시(제목 · 목록 · 인용)를 그대로 두고 감싸개만 벗기며, 간격 요소 줄은 빈 줄로 돌린다. 맞는지는 부르는 쪽이 견준다
 */
export function translationFromShown(shown) {
    const text = String(shown ?? '');
    const whole = WHOLE.exec(text);
    if (whole) return unblock(whole[1] === 'folded' ? whole[2] : whole[3]);
    let wrapped = 0;
    const lines = text.split('\n').map(line => {
        if (line === GAP_LINE) return '';
        for (const wrap of LINE_WRAPS) {
            const at = line.indexOf(wrap.head);
            if (at < 0 || !line.endsWith(wrap.tail)) continue;
            const inner = line.slice(at + wrap.head.length, line.length - wrap.tail.length), cut = inner.indexOf(wrap.mid);
            if (cut < 0) return null;
            wrapped++;
            return line.slice(0, at) + (wrap.first ? inner.slice(0, cut) : inner.slice(cut + wrap.mid.length));
        }
        return line;
    });
    return wrapped && !lines.includes(null) ? lines.join('\n') : null;
}

/** 번역을 붙일 때: raw = processTranslationText 에 넣은 번역 글, display = 나온 표시 (원문 보기 중이면 치워 둔 번역 자리에 들어간 글) */
export function rememberSource(extra, { original, raw, display, hash }) {
    if (!extra || typeof extra !== 'object' || typeof raw !== 'string' || typeof display !== 'string' || !raw.trim() || !display) return false;
    const record = { v: 1, o: String(hash(String(original ?? ''))), d: String(hash(display)) };
    if (raw !== display) {
        if (translationFromShown(display) === raw) record.v = 2;   // 6.9.6 표시에서 그대로 떼어 낼 수 있으면 번역 글을 따로 적지 않는다
        else record.t = raw;
    }
    extra[SOURCE_KEY] = record;
    return true;
}

/** 지금 보이는 번역의 번역 글 — 기록이 지금 원문 · 지금 표시와 맞을 때만, 아니면 null */
export function recordedSource(extra, { original, hash }) {
    const record = extra?.[SOURCE_KEY];
    if (!record || typeof record !== 'object' || (record.v !== 1 && record.v !== 2) || typeof record.o !== 'string' || typeof record.d !== 'string') return null;
    const now = String(hash(String(original ?? '')));
    if (record.o !== now || (extra.original_text_hash !== undefined && String(extra.original_text_hash) !== now)) return null;
    const shown = shownOf(extra);
    if (typeof shown !== 'string' || !shown || String(hash(shown)) !== record.d) return null;
    const raw = record.v === 2 ? translationFromShown(shown) : typeof record.t === 'string' ? record.t : shown;
    return typeof raw === 'string' && raw.trim() ? raw : null;
}

export function forgetSource(extra) {
    if (extra && typeof extra === 'object') delete extra[SOURCE_KEY];
}

/**
 * 6.9.6 쓸 일이 없어진 기록을 뗀다 → 뗐으면 true. 보이는 번역(표시 · 원문 보기 중 치워 둔 번역)이 없거나, 기록 때 원문과 지금 원문(original 을 주면) ·
 * 이 칸의 원문 해시가 다르면. 표시 해시는 보지 않는다 (채팅을 열 때 메시지마다 긴 글을 해시하지 않게 — 맞지 않는 기록은 어차피 읽을 때 빠진다).
 * 모르는 판(v)의 기록은 그대로 둔다
 */
export function pruneSource(extra, { original = null, hash = null } = {}) {
    const record = extra?.[SOURCE_KEY];
    if (!record || typeof record !== 'object' || (record.v !== 1 && record.v !== 2)) return false;
    const shown = shownOf(extra);
    const stale = typeof shown !== 'string' || !shown
        || (extra.original_text_hash !== undefined && String(extra.original_text_hash) !== record.o)
        || (original !== null && typeof hash === 'function' && String(hash(String(original))) !== record.o);
    if (stale) delete extra[SOURCE_KEY];
    return stale;
}
