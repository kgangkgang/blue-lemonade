// 11-12 글꾸 마트 크게 보기 — 미리보기에서 글을 끌어 고르면 바로 옆에 뜨는 막대(사용자 「드래그하면 복사 · 붙여넣기 · 자르기처럼 뜨게」)
//   막대 자체는 테마 로그 복사와 같은 것(lib/log-copy/log-copy-select-bar.js 사본). 여기서는 단추가 할 일만 정해요.
//   「눌러야 보이게」: 고른 글이 한 칸(지문 · 대사 줄) 안이면 그 글만(글줄 안 숨긴 글 — 테마 미리보기 「숨기기」와 같은 꼴),
//     칸 글 전체를 골랐거나 여러 줄에 걸치면 그 줄들을 통째로(예전 「줄 숨기기」와 같은 값 { i }) · 꾸밈(굵게 등)을 가로지르면 줄째로.
//   「숨김 풀기」: 고른 자리가 숨긴 글 안(알약 · 펼친 글)이면. 「굵게 · 기울임」: 「글 고치기」를 켠 동안 한 칸 안을 골랐을 때만(Ctrl+B · I 와 같은 명령).
//   값은 tune.js(spoilers · mineSpoilers)에 들어가 카드 · 「HTML 복사」 · 내 글꾸 · 설정 파일에 같은 길로 가요. 「글 고치기」를 안 켜도 숨기기 · 풀기는 돼요.
import { createSelectBar } from './lib/log-copy/log-copy-select-bar.js?v=20261112e';
import { tuneOf, setTune, spanIn } from './tune.js?v=20261112e';
import { mineOn } from './mine-text.js?v=20261112a';

const HIDE_CELLS = ['gk-nr', 'gk-d'];
const FMT = 'b, i, strong, em, s';
const clone = t => JSON.parse(JSON.stringify(t || {}));
const elOf = n => (n?.nodeType === 1 ? n : n?.parentElement) ?? null;

/** 칸 처음부터 (node, offset) 까지 글자 수 — 숨긴 글의 알약 · 흐린 사본(summary)은 빼요(= tune.js cellText 의 글과 같은 자리) */
export function textUpTo(cell, node, offset) {
    const doc = cell.ownerDocument, r = doc.createRange();
    r.setStart(cell, 0);
    if (node) r.setEnd(node, offset); else r.setEnd(cell, cell.childNodes.length);
    const frag = r.cloneContents();
    for (const s of frag.querySelectorAll('summary')) s.remove();
    return frag.textContent.length;
}
const cellTextDom = (cell) => {
    const copy = cell.cloneNode(true);
    for (const s of copy.querySelectorAll('summary')) s.remove();
    return copy.textContent;
};

/** 고른 자리 → 숨길 값 목록. { add: [{ i } | { i, a, b, t }], whole: 줄째로 바꾼 까닭 | '' } 또는 { why } */
export function hidePlan(range, preview) {
    const cells = [...preview.querySelectorAll('[data-bl-ed]')].filter(c => HIDE_CELLS.some(k => c.classList.contains(k)) && !c.closest('summary') && range.intersectsNode(c));
    if (!cells.length) return { why: '지문 · 대사 줄을 골라 주세요' };
    if (cells.length > 1) return { add: cells.map(c => ({ i: Number(c.dataset.blEd) })), whole: '' };
    const cell = cells[0], i = Number(cell.dataset.blEd), text = cellTextDom(cell);
    const startIn = cell.contains(range.startContainer), endIn = cell.contains(range.endContainer);
    let a = startIn ? textUpTo(cell, range.startContainer, range.startOffset) : 0;
    let b = endIn ? textUpTo(cell, range.endContainer, range.endOffset) : text.length;
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /\s/.test(text[b - 1])) b--;
    if (b <= a) return { why: '숨길 글을 골라 주세요' };
    if (!text.slice(0, a).trim() && !text.slice(b).trim()) return { add: [{ i }], whole: '' };
    // 꾸밈 태그를 가로지르면 글만 떼어 감쌀 수 없어요 → 줄째로
    const texts = [], walk = cell.ownerDocument.createTreeWalker(cell, 4);   // 4 = 글 마디
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (!n.parentElement.closest('summary')) texts.push(n);
    const fmtOf = n => { const f = elOf(n)?.closest(FMT); return f && cell.contains(f) ? f : null; };
    const s0 = startIn ? range.startContainer : texts[0], e0 = endIn ? range.endContainer : texts[texts.length - 1];
    if (fmtOf(s0) !== fmtOf(e0)) return { add: [{ i }], whole: '꾸밈(굵게 등)에 걸쳐 있어 그 줄을 통째로' };
    if ([...cell.querySelectorAll('[data-bl-spoiler]')].some(d => range.intersectsNode(d))) return { why: '이미 숨긴 글과 겹쳐요 — 그 글을 먼저 풀어 주세요' };
    return { add: [{ i, a, b, t: text.slice(a, b) }], whole: '' };
}

/** 숨긴 글 마디 → 그 값을 지울 판정(값 하나를 받아 true 면 지워요) */
export function unhideMatch(det) {
    if (det.classList.contains('blsp-k')) {   // 줄째 숨김
        const cell = det.querySelector('.blsp-c [data-bl-ed]') ?? det.closest('[data-bl-ed]');
        if (!cell) return null;
        const i = Number(cell.dataset.blEd);
        return x => x.i === i && x.t == null;
    }
    const cell = det.parentElement?.closest('[data-bl-ed]');
    if (!cell) return null;
    const i = Number(cell.dataset.blEd), text = cellTextDom(cell), a = textUpTo(cell, det.parentNode, [...det.parentNode.childNodes].indexOf(det));
    return x => x.i === i && x.t != null && spanIn(text, x)?.a === a;
}

/** 11-12 막대 단추 규칙(테마 · 마트 · 폰 · PC 모두 같아요 — 사용자 「굵게랑 기울임은 왜 있는 거임?」): 평소엔 「눌러야 보이게 / 숨김 풀기」만,
 *  굵게 · 기울임은 「글 고치기」 모드에서 한 칸 안을 골랐을 때만. spoiler = 숨긴 글 안 · hide = 숨길 수 있는 글 · editing = 글 고치기 켬 + 한 칸 안 */
export const barKinds = ({ spoiler = false, hide = false, editing = false } = {}) => (spoiler ? ['unhide'] : [...(hide ? ['hide'] : []), ...(editing ? ['bold', 'italic'] : [])]);

export function wireSelectHide(sheet, { current, say = () => {} }) {
    const preview = () => sheet.querySelector('.mart-sheet-preview');
    const bar = createSelectBar({ host: sheet });
    const keyNow = () => (mineOn() ? 'mineSpoilers' : 'spoilers');
    const save = (item, fn) => { const cur = clone(tuneOf(item.id)), list = cur[keyNow()] ??= []; const msg = fn(cur, list); setTune(item.id, cur); getSelection()?.removeAllRanges(); if (msg) say(msg, 2200); };
    const reselect = (range) => { const s = getSelection(); s.removeAllRanges(); s.addRange(range); };
    bar.watch(document, {
        within: n => !!elOf(n)?.closest('.mart-sheet-preview .gk') && sheet.open,
        caret: r => !!elOf(r.startContainer)?.closest('.mart-sheet-preview [data-bl-spoiler]'),   // 숨긴 글을 누르기만 해도 「숨김 풀기」
        buttons: (range) => {
            const item = current()?.item, box = preview();
            if (!item?.simple || !box || box.classList.contains('is-site')) return [];
            const det = elOf(range.startContainer)?.closest('[data-bl-spoiler]') ?? elOf(range.endContainer)?.closest('[data-bl-spoiler]');
            if (det && box.contains(det)) {
                const match = unhideMatch(det);
                return match && barKinds({ spoiler: true }).includes('unhide') ? [{ id: 'unhide', label: '숨김 풀기', main: true, title: '숨김 풀기 — 다시 바로 보이는 글로', run: () => save(item, (cur) => { const key = keyNow(); cur[key] = (cur[key] || []).filter(x => !match(x)); return '숨긴 글을 풀었어요'; }) }] : [];
            }
            const out = [];
            const plan = hidePlan(range, box), ed = elOf(range.startContainer)?.closest('[contenteditable="true"]');
            const kinds = barKinds({ hide: !!plan.add, editing: box.classList.contains('is-editing') && !!ed && ed.contains(range.endContainer) });
            if (kinds.includes('hide')) out.push({ id: 'hide', label: '눌러야 보이게', main: true, title: '숨기기 — 고른 글을 눌러야 보이는 글로', run: (r) => {
                const now = hidePlan(r, box); if (!now.add) { say(now.why, 2400); return; }
                save(item, (cur, list) => {
                    for (const x of now.add) {
                        if (list.some(y => y.i === x.i && y.t == null)) continue;   // 이미 줄째 숨긴 줄
                        if (x.t == null) for (let k = list.length - 1; k >= 0; k--) if (list[k].i === x.i) list.splice(k, 1);   // 줄째로 숨기면 그 줄 안 고른 글 숨김은 걷어요
                        list.push(x);
                    }
                    return now.whole ? `${now.whole} 숨겼어요` : '눌러야 보이는 글로 숨겼어요';
                });
            } });
            if (kinds.includes('bold')) {
                const fmt = cmd => (r) => { reselect(r); document.execCommand(cmd); ed.dispatchEvent(new InputEvent('input', { bubbles: true })); };
                out.push({ id: 'bold', label: '굵게', title: '굵게(Ctrl+B)', run: fmt('bold') }, { id: 'italic', label: '기울임', title: '기울임(Ctrl+I)', run: fmt('italic') });
            }
            return out;
        },
    });
    sheet.addEventListener('close', () => bar.hide());
    return bar;
}
