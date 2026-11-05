// 고른 글 고치기 (1.0.3) — 순수 함수 (DOM · 실리태번 없음, tools/tests/quick-sel-edit.mjs 가 검사해요).
// 화면에서 고른 글을 원래 글(마크다운 · 태그가 든 mes)의 한 자리로 옮기고, 그 자리만 바꾼 새 글을 만들어요.
// 자리 찾기는 고른 글 지우기와 같은 도우미(delete-core.js)를 써요: 보이는 글(표시 · 태그를 건너뛴 글자)에서 찾고,
//   화면과 원래 글의 개수가 같을 때만 · 여럿이면 화면에서 몇 번째인지와 앞뒤 보이는 글이 같을 때만 그 자리예요.
// 원칙: 확실하지 않으면 고치지 않아요(이유를 돌려주고 부르는 쪽이 알려요). 엉뚱한 자리를 고치는 것보다 거절이 나아요.
import { norm, occurrences, screenOrdinal, pickSame } from '../addons/translator/selection/delete-core.js';

export const EDIT_LIMIT = 4000;   // 한 번에 고칠 고른 글 글자 수 상한 (창이 너무 길어지지 않게)

/**
 * 고른 글의 원래 글 자리 → { span: { start, end } } 또는 { reason }
 *  raw: 메시지 원래 글 · selected: 고른 글(화면 글자) · screen: 그 메시지 화면 글 전체(블록 · 줄바꿈은 \n) · at: 고른 글이 시작하는 화면 글 자리
 *  reason: 'empty' 고른 글 없음 · 'long' 너무 김 · 'missing' 원래 글에 없음(표시 정규식이 만든 글 등) · 'count' 화면과 개수가 다름 · 'ambiguous' 여럿 중 어느 것인지 모름
 */
export function locateEdit(raw, selected, screen, at) {
    const key = norm(selected);
    if (!key) return { reason: 'empty' };
    if (key.length > EDIT_LIMIT) return { reason: 'long' };
    const found = occurrences(String(raw ?? ''), selected);
    if (!found.length) return { reason: 'missing' };
    const same = screenOrdinal(String(screen ?? ''), at, selected);
    if (!same || same.total !== found.length) return { reason: 'count' };
    if (found.length === 1) return { span: { start: found[0].start, end: found[0].end } };
    const span = pickSame(String(raw ?? ''), selected, same, String(screen ?? ''));
    return span ? { span: { start: span.start, end: span.end } } : { reason: 'ambiguous' };
}

/** 자리 [start, end) 를 next 로 바꾼 새 글 (자리가 글 밖이면 null) */
export function replaceSpan(raw, span, next) {
    const text = String(raw ?? '');
    if (!span || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end > text.length || span.start >= span.end) return null;
    return text.slice(0, span.start) + String(next ?? '') + text.slice(span.end);
}

/** 창에 보여 줄 앞뒤 글 (줄 하나 안에서 최대 n 글자 — 줄바꿈 너머는 자르고 …) */
export function spanContext(raw, span, n = 40) {
    const text = String(raw ?? '');
    const lineStart = text.lastIndexOf('\n', span.start - 1) + 1;
    const lineEnd = (i => (i < 0 ? text.length : i))(text.indexOf('\n', span.end));
    const from = Math.max(lineStart, span.start - n), to = Math.min(lineEnd, span.end + n);
    return {
        before: (from > lineStart ? '…' : '') + text.slice(from, span.start),
        after: text.slice(span.end, to) + (to < lineEnd ? '…' : ''),
    };
}

/** 이유 → 알림 글 */
export const EDIT_REASONS = {
    empty: '고칠 글을 골라 주세요.',
    long: `한 번에 ${EDIT_LIMIT.toLocaleString('en-US')}자까지 고칠 수 있어요. 메시지 편집(연필)을 써 주세요.`,
    missing: '고른 글이 메시지 원래 글에 없어요(정규식 · 확장이 화면에만 보여 주는 글일 수 있어요).',
    count: '고른 글의 자리를 확실히 찾지 못했어요. 조금 더 길게 골라 주세요.',
    ambiguous: '같은 글이 여러 번 있어 어느 것인지 확실하지 않아요. 앞뒤 글까지 조금 더 길게 골라 주세요.',
    changed: '그사이 메시지가 바뀌었어요. 다시 골라 주세요.',
    translated: '번역문이 있는 메시지는 번역기의 「번역문 수정」으로 고쳐 주세요.',
};
