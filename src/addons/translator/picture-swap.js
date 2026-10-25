// 7.9.5 그림 생성 확장이 답의 그림 표시만 바꾼 경우 (그림 요청 <pic …> → <img …> · 요청 지움 · 그림 자리 · 끝에 그림 덧붙임).
//   예전에는 글이 바뀐 것으로 쳐서 번역 중이면 요청을 끊고 처음부터, 번역이 끝났으면 통째로 다시 번역했다 (제보: 답 → 번역 → 그림 완료 → 다시 번역).
//   그림 표시를 뺀 글이 같으면 번역은 그대로 두고 번역문 속 그림 표시만 지금 글의 것으로 바꾼다. 자리를 확실히 모르면 null — 부르는 쪽이 예전처럼 다시 번역한다.
const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`;
const MARK_SOURCES = [
    `<pic\\b${ATTRS}>(?:\\s*<\\/pic>)?`,
    `<img\\b${ATTRS}>`,
    `<span\\b[^>]*\\b(?:data-autopic-slot="[^"]*"|class="[^"]*\\bautopic-image-slot\\b[^"]*")[^>]*>[^<]*<\\/span>`,
    `\\{\\{img::[^{}]*\\}\\}`,
];
const markRe = () => new RegExp(MARK_SOURCES.join('|'), 'gi');
/** 번역 요청에서 가릴 그림 요청 태그 — 프롬프트(영어 그림 설명)를 모델에 보내지 않는다 */
export const PIC_REQUEST = new RegExp(`<pic\\b${ATTRS}>(?:\\s*<\\/pic>)?`, 'gi');

const squash = text => text.replace(/\s+/g, ' ').trim();

/** 그림 표시를 뺀 글(빈칸을 하나로) · 그림 표시 목록 (anchor = 그 앞 글의 길이, 같은 자리 차례 nth) */
export function splitPictures(text) {
    const value = String(text ?? ''), marks = [];
    let rest = '', last = 0;
    for (const match of value.matchAll(markRe())) {
        rest += value.slice(last, match.index);
        last = match.index + match[0].length;
        const anchor = squash(rest).length;
        const nth = marks.filter(mark => mark.anchor === anchor).length;
        marks.push({ mark: match[0], anchor, nth, start: match.index, end: last });
    }
    rest += value.slice(last);
    return { text: squash(rest), marks };
}

/** 두 글이 그림 표시만 다른가 (같은 글 · 빈칸만 다른 글은 아니다) */
export function picturesOnlyChanged(before, after) {
    if (before === after || typeof before !== 'string' || typeof after !== 'string') return false;
    const a = splitPictures(before), b = splitPictures(after);
    return (a.marks.length > 0 || b.marks.length > 0) && a.text === b.text;
}

/**
 * before 의 번역문(translation)을 after 의 그림 표시로 고친 번역문. 고칠 수 없으면 null.
 * - 같은 자리(anchor · nth)의 표시는 바꾸고, after 에 없는 표시는 지운다 — 번역문에 before 의 표시가 한 번씩 그대로 있어야 한다
 * - after 에만 있는 새 표시는 글 맨 앞 · 맨 뒤에 붙은 것만 (그 사이 줄바꿈도 after 와 같게)
 */
export function swapPictures(translation, before, after) {
    const text = String(translation ?? '');
    if (!picturesOnlyChanged(before, after)) return null;
    const old = splitPictures(before).marks, now = splitPictures(after);
    const slot = mark => `${mark.anchor}:${mark.nth}`;
    const next = new Map(now.marks.map(mark => [slot(mark), mark]));
    let out = text;
    const tokens = [];
    for (const mark of old) {
        const at = out.indexOf(mark.mark);
        if (at < 0 || out.indexOf(mark.mark, at + mark.mark.length) >= 0) return null;   // 없거나 두 번 — 어느 것인지 모른다
        const token = `\u0000${tokens.length}\u0000`;
        tokens.push(next.get(slot(mark))?.mark ?? '');
        out = out.slice(0, at) + token + out.slice(at + mark.mark.length);
    }
    out = out.replace(/\u0000(\d+)\u0000/g, (m, n) => tokens[Number(n)]);
    const kept = new Set(old.map(slot));
    const end = now.text.length;
    let head = '', tail = '';
    for (const mark of now.marks) {
        if (kept.has(slot(mark))) continue;
        if (mark.anchor === 0) head += mark.mark + gapAfter(after, mark);
        else if (mark.anchor === end) tail += gapBefore(after, mark) + mark.mark;
        else return null;
    }
    if (head) out = head + out.replace(/^\s+/, '');
    if (tail) out = out.replace(/\s+$/, '') + tail;
    return out;
}
const gapBefore = (text, mark) => /\s*$/.exec(text.slice(0, mark.start))[0];
const gapAfter = (text, mark) => /^\s*/.exec(text.slice(mark.end))[0];
