// 6.9.7 스와이프 고르기 창(실리태번 swipe-picker.js)의 미리보기 글을 번역문으로.
// 실리태번은 각 스와이프 칸(.swipe_picker_block[data-swipe-id] .select_chat_block_mes)에 원문(영어 · 태그 그대로)을 넣는다.
// 그 스와이프에 번역문이 있으면 그 칸의 글만 번역문(글로 바꾼 것)으로 바꾼다 — 실리태번 코드 · 저장된 글은 그대로.
//   번역문 자리: 지금 스와이프는 message.extra, 다른 스와이프는 message.swipe_info[i].extra (실리태번이 넘길 때 extra 를 복사해 둔다).
//   번역 애드온과 같은 기준: display_text 가 있을 때만(원문 보기 중이면 번역은 original_translation_backup), 원문 해시(original_text_hash)가
//   그 스와이프 원문과 맞을 때만. 번역 애드온이 남긴 기록(translation_source, 원문 · 표시 해시가 맞을 때)이 있으면 그 번역 글을 먼저 쓴다 —
//   보호 블록이 있어 문단 수가 다르면 표시가 「번역 + 빈 줄 + 원문」(원문 먼저 보기는 거꾸로)이라 표시만으로는 번역 쪽을 못 가른다.
//   기록이 없으면 표시에서: 접기 · 원문 먼저 · 펼침 · 글 전체 접기 표시는 번역 쪽만, 끝(앞)에 원문 통째가 붙어 있으면 떼고, HTML 은 글로.
// 펼치기(⌄) · 복사(원문을 복사 — 실리태번 그대로) · 분기 · 지우기 · 번호 이동은 실리태번 것 그대로. 글자 수 · 토큰 수도 원문 기준 그대로.
// 상주 감시 없음: 이 창을 여는 단추(스와이프 수 · 기록 단추)를 누르는 순간부터 body 의 바로 아래 자식만 잠깐 본다(실리태번은 창을 다 그린 뒤
//   body 에 붙인다 — 감시 콜백은 그리기 전에 돌아 원문이 비치지 않는다). 창을 찾거나 15초가 지나면 뗀다. 찾은 창에는 목록 칸에만 childList 감시
//   (지우기 뒤 실리태번이 목록을 다시 그림) — 창이 닫히면 뗀다. 번역문은 스와이프 기록(extra)마다 한 번만 만든다.
import { getSettings } from './settings.js';
import { themeEnabled } from './usage-mode.js';
import { recordedSource } from './addons/translator/translation-source.js';

const OPENERS = '.swipes-counter.swipe-picker-enabled, .mes_swipe_picker';
const WATCH_MS = 15000;
const MARK = 'blSwipeTranslated';   // data-bl-swipe-translated="1" = 번역문으로 바꿔 넣은 칸 (다시 그려지면 사라져서 다시 바꾼다). 글은 painted(WeakMap)에 — 6.9.8: 속성에 글 전체를 복사하지 않는다
const painted = new WeakMap();       // 칸 → 넣은 번역문
const FOLD_MARKUP = /llm-translator-details|class="(?:translated|original)_text|llmt-para-gap/;
const BLOCK_TAGS = 'p|div|li|ul|ol|details|summary|h[1-6]|blockquote|tr|table|section|article|header|footer|pre|hr';
const VOID = /^(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)$/;

// ---------- 글 다루기 (순수 · 글 길이에 비례) ----------
// 태그 하나 읽기: <tag ...> · </tag> · <tag/> — 따옴표 안의 > 는 넘김
const TAG_SOURCE = String.raw`<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>`;
function* tags(html) {
    const re = new RegExp(TAG_SOURCE, 'g');
    for (let m; (m = re.exec(html));) yield { start: m.index, end: re.lastIndex, close: !!m[1], name: m[2].toLowerCase(), attrs: m[3], self: /\/\s*$/.test(m[3]) };
}
const hasClass = (t, name) => new RegExp(`\\bclass\\s*=\\s*["'][^"']*\\b${name}\\b`).test(t.attrs);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', middot: '·', bull: '•', copy: '©', reg: '®', trade: '™', times: '×', divide: '÷', deg: '°', ensp: ' ', emsp: ' ', thinsp: ' ', zwj: '\u200d', zwnj: '\u200c', shy: '' };
// 6.9.8: 브라우저에서는 이름 참조를 전부 아는 textarea 로 푼다(태그는 이미 걷은 글이라 RCDATA 로 안전), 시험(node)은 위 표
let decoder = null;
const decode = text => {
    if (!text.includes('&')) return text;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        try { decoder ??= document.createElement('textarea'); if (decoder && 'value' in decoder) { decoder.innerHTML = text; const out = decoder.value; decoder.innerHTML = ''; return out; } } catch { /* 표로 */ }
    }
    return decodeTable(text);
};
const decodeTable = text => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (all, name) => {
    if (name[0] === '#') { const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10); return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all; }
    return ENTITIES[name.toLowerCase()] ?? all;
});

/**
 * 번역 애드온의 접기 · 원문 함께 보기 표시를 걷어 번역 쪽만 남김 (표시가 없으면 그대로). 태그를 한 번만 훑는다.
 *   접기: <details mode-folded><summary>번역</summary>원문</details> → 번역 · 원문 먼저: <details mode-original-first><summary>원문</summary>번역</details> → 번역
 *   펼침: <span translated_text>번역</span><br><span original_text>원문</span> → 번역 · 어디서든 .original_text 는 통째로 뺌 (안에 같은 이름 태그가 겹쳐도)
 */
export function translationOnly(html) {
    const text = String(html ?? '');
    if (!FOLD_MARKUP.test(text)) return text;
    let out = '', pos = 0;
    const stack = [];   // { name, kind: 'details' | 'summary' | 'skip' | 'plain', inner: 안쪽 글을 내보내나, keep: 닫는 태그를 내보내나, outer, folded }
    const inner = () => (stack.length ? stack[stack.length - 1].inner : true);
    for (const t of tags(text)) {
        if (inner()) out += text.slice(pos, t.start);
        pos = t.end;
        const tag = text.slice(t.start, t.end);
        if (t.close) {
            let i = stack.length - 1;
            while (i >= 0 && stack[i].name !== t.name) i--;
            if (i < 0) { if (inner()) out += tag; continue; }   // 짝 없는 닫는 태그
            stack.length = i + 1;                               // 안 닫힌 안쪽 요소는 여기서 함께 닫힘
            const frame = stack.pop();
            if (frame.keep) out += tag;
            continue;
        }
        const here = inner();
        if (t.self || VOID.test(t.name)) { if (here) out += tag; continue; }
        const top = stack[stack.length - 1];
        if (t.name === 'details' && hasClass(t, 'llm-translator-details')) {
            const folded = !/\bmode-original-first\b/.test(t.attrs);
            stack.push({ name: t.name, kind: 'details', folded, outer: here, inner: here && !folded, keep: false });
            continue;
        }
        if (t.name === 'summary' && top?.kind === 'details') {
            stack.push({ name: t.name, kind: 'summary', inner: top.outer && top.folded, keep: false });
            continue;
        }
        if (hasClass(t, 'original_text')) {
            if (/\bmode-unfolded\b/.test(t.attrs)) out = out.replace(/<br\s*\/?>\s*$/i, '');   // 펼침: 번역 줄 뒤의 줄바꿈도
            stack.push({ name: t.name, kind: 'skip', inner: false, keep: false });
            continue;
        }
        stack.push({ name: t.name, kind: 'plain', inner: here, keep: here });
        if (here) out += tag;
    }
    if (inner()) out += text.slice(pos);
    return out;
}

/** HTML(또는 마크다운 글)을 미리보기 글로: 주석 · 스크립트 · 스타일 빼고, 줄 바꾸는 태그는 줄바꿈, 나머지 태그는 걷고, 글자 참조 풀기 */
export function plainText(html) {
    let text = String(html ?? '').replace(/\r\n?/g, '\n');
    text = text.replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style|template|noscript)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, 'gi'), '\n')
        .replace(new RegExp(TAG_SOURCE, 'g'), '');
    text = decode(text);
    return text.split('\n').map(line => line.replace(/[ \t ]+$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const squash = text => String(text ?? '').replace(/\s+/g, ' ').trim();

/**
 * 보호 블록 때문에 통째로 붙인 표시(번역 + 빈 줄 + 원문, 원문 먼저 보기는 원문 + 빈 줄 + 번역)에서 원문 쪽을 뗀다. 글로 바꾼 뒤에 견준다.
 * @param {string} text plainText 한 번역 표시
 * @param {string[]} originals 그 스와이프 원문(그대로 · 매크로를 푼 것)을 plainText 한 글
 */
export function withoutOriginalHalf(text, originals) {
    const whole = squash(text);
    for (const original of originals) {
        const o = squash(original);
        if (!o || whole.length <= o.length || (!whole.endsWith(o) && !whole.startsWith(o))) continue;
        const blocks = text.split(/\n{2,}/);
        for (let k = 1; k < blocks.length; k++) {
            if (squash(blocks.slice(k).join('\n\n')) === o) return blocks.slice(0, k).join('\n\n');   // 번역 + 원문
            if (squash(blocks.slice(0, k).join('\n\n')) === o) return blocks.slice(k).join('\n\n');   // 원문 + 번역
        }
    }
    return text;
}

/**
 * 스와이프 index 의 번역문(미리보기 글) — 없으면 null.
 * @param {object} message 실리태번 메시지 (swipes · swipe_id · extra · swipe_info)
 * @param {number} index 스와이프 번호 (0부터)
 * @param {{ substitute?: (text: string) => string, hash?: (text: string) => (string|number) }} [options]
 *   substitute: 매크로 풀기(번역 애드온은 매크로를 푼 원문을 번역 · 해시한다) · hash: 실리태번 getStringHash (없으면 해시 견주기 · 기록은 건너뜀)
 */
export function swipeTranslation(message, index, { substitute = text => text, hash = null } = {}) {
    if (!message || !Array.isArray(message.swipes) || !(index >= 0 && index < message.swipes.length)) return null;
    const current = Number(message.swipe_id ?? 0) === index;
    const extra = current ? message.extra : message.swipe_info?.[index]?.extra;
    const display = extra?.display_text;
    if (typeof display !== 'string' || !display.trim()) return null;   // 백업만 남은 것은 다른 스와이프의 번역 (번역 애드온도 버린다)
    const backup = extra.original_translation_backup;
    const shown = typeof backup === 'string' && backup.trim() ? backup : display;
    const source = String(message.swipes[index] ?? '');
    let original = source;
    if (source.includes('{{')) { try { original = String(substitute(source)); } catch { /* 못 풀면 그대로 */ } }
    let raw = null;
    if (hash) {
        if (extra.original_text_hash !== undefined && String(extra.original_text_hash) !== String(hash(original))) return null;   // 다른 글의 번역
        try { raw = recordedSource(extra, { original, hash }); } catch { raw = null; }
    }
    const originals = [plainText(source), original === source ? null : plainText(original)].filter(Boolean);
    let text = plainText(translationOnly(raw ?? shown));
    if (!raw) text = withoutOriginalHalf(text, originals);
    if (!text) return null;
    if (originals.some(o => squash(o) === squash(text)) || squash(shown) === squash(source) || squash(shown) === squash(original)) return null;   // 번역문 자리에 원문(원문 보기 · 실패)
    return text;
}

// ---------- 창 ----------
let hashFn = null, hashLoading = null;
// 해시 모듈(실리태번 utils.js)은 여는 단추를 누를 때 비로소 불러온다 — 첫 창은 그보다 먼저 그려질 수 있어 실리면 열린 창을 한 번 다시 번역한다(캐시 도장에 !!hashFn 이 들어 있어 다시 계산). 6.9.8
const loadHash = () => (hashLoading ??= import('../../../../utils.js').then(m => { hashFn = typeof m.getStringHash === 'function' ? m.getStringHash : null; }).catch(() => { hashFn = null; }).then(() => { if (hashFn) retranslateOpen(); }));
function retranslateOpen() {
    if (typeof document === 'undefined') return 0;
    let n = 0;
    for (const dialog of document.querySelectorAll('body > dialog.popup.swipe_picker_popup')) if (watched.has(dialog)) n += translateDialog(dialog);
    return n;
}

/** 창의 메시지 번호: 실리태번이 만든 번호 칸 id(swipe_picker_id_<번호>) · 펼치기 칸 id(swipe_picker_expand_<번호>_<스와이프>) */
function messageIdOf(dialog) {
    const input = dialog.querySelector('input[id^="swipe_picker_id_"]');
    let match = input && /^swipe_picker_id_(\d+)$/.exec(input.id);
    if (!match) { const toggle = dialog.querySelector('input[id^="swipe_picker_expand_"]'); match = toggle && /^swipe_picker_expand_(\d+)_\d+$/.exec(toggle.id); }
    return match ? Number(match[1]) : NaN;
}

// 스와이프 기록(extra)마다 한 번: 같은 표시 · 원문이면 다시 만들지 않는다 (지우기 뒤 다시 그릴 때도)
const cache = new WeakMap();
function cachedTranslation(message, index, substitute) {
    const current = Number(message.swipe_id ?? 0) === index;
    const extra = current ? message.extra : message.swipe_info?.[index]?.extra;
    const key = extra && typeof extra === 'object' ? extra : null;
    const stamp = `${index === Number(message.swipe_id ?? 0)}\u0000${message.swipes?.[index]}\u0000${extra?.display_text}\u0000${extra?.original_translation_backup}\u0000${extra?.original_text_hash}\u0000${!!hashFn}`;
    const hit = key && cache.get(key);
    if (hit && hit.stamp === stamp) return hit.text;
    const text = swipeTranslation(message, index, { substitute, hash: hashFn });
    if (key) cache.set(key, { stamp, text });
    return text;
}

function translateDialog(dialog) {
    const context = globalThis.SillyTavern?.getContext?.();
    const id = messageIdOf(dialog);
    const message = Number.isInteger(id) ? context?.chat?.[id] : null;
    if (!message) return 0;
    const substitute = text => context.substituteParams ? context.substituteParams(text, context.name1, message.name) : text;
    let changed = 0;
    for (const block of dialog.querySelectorAll('.swipe_picker_block[data-swipe-id]')) {
        const box = block.querySelector('.select_chat_block_mes');
        if (!box) continue;
        let text = null;
        try { text = cachedTranslation(message, Number(block.getAttribute('data-swipe-id')), substitute); } catch (error) { console.warn('[Blue Lemonade] 스와이프 고르기 번역문', error); }
        if (!text || painted.get(box) === text) continue;
        box.textContent = text;
        painted.set(box, text);
        box.dataset[MARK] = '1';
        changed++;
    }
    return changed;
}

const watched = new WeakSet();
function watchDialog(dialog) {
    if (watched.has(dialog)) return true;
    const list = dialog.querySelector('.swipe_picker_div');
    if (!list) return false;
    watched.add(dialog);
    translateDialog(dialog);
    const observer = new MutationObserver(() => translateDialog(dialog));
    observer.observe(list, { childList: true });
    dialog.addEventListener('close', () => observer.disconnect(), { once: true });
    return true;
}

let bodyWatch = null, stopTimer = 0;
function stopLooking() {
    bodyWatch?.disconnect(); bodyWatch = null;
    clearTimeout(stopTimer); stopTimer = 0;
}
function lookForPicker() {
    const scan = () => {
        let found = false;
        for (const dialog of document.querySelectorAll('body > dialog.popup.swipe_picker_popup')) found = watchDialog(dialog) || found;
        if (found) stopLooking();
        return found;
    };
    if (!hashFn) loadHash();
    if (scan()) return;
    if (!bodyWatch) {
        bodyWatch = new MutationObserver(records => { if (records.some(r => [...r.addedNodes].some(n => n instanceof HTMLDialogElement))) scan(); });
        bodyWatch.observe(document.body, { childList: true });
    }
    clearTimeout(stopTimer);
    stopTimer = setTimeout(stopLooking, WATCH_MS);
}

/** 시험용 — 창 흉내로 translateDialog · watchDialog · 해시 늦게 실림 */
export const _forTest = { translateDialog, watchDialog, retranslateOpen, setHash(fn) { hashFn = typeof fn === 'function' ? fn : null; }, painted, MARK };

let started = false;
export function startSwipePickerTranslation() {
    if (started) return;
    started = true;
    const kick = event => {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest(OPENERS)) return;
        if (event.type === 'keydown' && event.key !== ' ') return;
        try { if (!themeEnabled(getSettings())) return; } catch { return; }
        lookForPicker();
    };
    // 폰은 스와이프 수를 길게 누르면 열린다(실리태번 addLongPressEvent) — 누르기 시작부터 본다
    for (const type of ['pointerdown', 'click', 'keydown']) document.addEventListener(type, kick, { capture: true, passive: true });
}
