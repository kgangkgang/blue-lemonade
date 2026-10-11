// 6.0.4 단어 치환 › 잠시 가리기 (wordmask.js)
// 적어 둔 낱말을 채팅 화면(.mes_text · .name_text)에서만 ■ 로 잠깐 가린다 — 로그를 나눌 때 이름이 부끄러우면.
// 채팅 데이터(chat[i].mes)는 손대지 않는다. 화면의 글자 노드만 <span class="bl-wmask" data-orig="…">■■</span> 로 감싸고, 끄면 글자 노드로 되돌린다.
// 스위치는 세션 안에서만 켜진다(설정에 저장 안 함 → 새로고침하면 꺼짐). 낱말 목록만 설정 wordTools.maskWords 에 남는다.
// 메시지가 다시 그려지면(스트리밍 · 편집 · 스와이프 · 번역) #chat MutationObserver 가 바뀐 .mes 만 150ms 뒤 다시 가린다.
const BLOCK = '■';
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'NOSCRIPT']);
const MAX_WORDS = 200, MAX_TEXT = 2000, MAX_BLOCKS = 4, DEBOUNCE = 150;

// 대소문자 무시 비교용. 소문자화로 글자 수가 바뀌는 글자(İ 등)는 그대로 둬 원문과 자리 번호가 어긋나지 않게 한다.
const fold = s => Array.from(String(s)).map(c => { const l = c.toLowerCase(); return l.length === c.length ? l : c; }).join('');

/** 목록 글 → 낱말 배열: 줄 · 쉼표로 나누고 빈 것 · 중복(대소문자 무시)을 빼고 긴 것부터 (긴 낱말이 짧은 낱말을 품으면 긴 쪽이 먼저 잡히게) */
export function parseMaskWords(text) {
    const seen = new Set(), words = [];
    for (const raw of String(text ?? '').slice(0, MAX_TEXT).split(/[\n\r,，]+/)) {
        const w = raw.trim(), key = fold(w);
        if (!w || seen.has(key)) continue;
        seen.add(key); words.push(w);
        if (words.length >= MAX_WORDS) break;
    }
    return words.sort((a, b) => b.length - a.length);
}

/** 글 하나를 조각으로 나눈다: [{ text, masked, orig? }] — 가린 조각의 text 는 ■ (낱말 글자 수만큼, 최대 4개), 원문은 orig. DOM 없이 검사할 수 있다. */
export function maskPlan(text, words) {
    const src = String(text ?? '');
    const list = (Array.isArray(words) ? words.map(w => String(w ?? '').trim()).filter(Boolean) : parseMaskWords(words))
        .map(w => ({ w, f: fold(w) })).filter(x => x.f).sort((a, b) => b.f.length - a.f.length);
    if (!src || !list.length) return [{ text: src, masked: false }];
    const byFirst = new Map();
    for (const x of list) { const k = x.f[0]; if (!byFirst.has(k)) byFirst.set(k, []); byFirst.get(k).push(x); }
    const hay = fold(src), out = [];
    let plain = '';
    for (let i = 0; i < hay.length;) {
        const hit = byFirst.get(hay[i])?.find(x => hay.startsWith(x.f, i));
        if (!hit) { plain += src[i]; i++; continue; }
        if (plain) { out.push({ text: plain, masked: false }); plain = ''; }
        const orig = src.slice(i, i + hit.f.length);
        out.push({ text: BLOCK.repeat(Math.min(MAX_BLOCKS, Math.max(1, Array.from(orig).length))), masked: true, orig });
        i += hit.f.length;
    }
    if (plain) out.push({ text: plain, masked: false });
    return out;
}

let words = [], active = false, observer = null, timer = null;
const pending = new Set();
const doc = () => (typeof document === 'undefined' ? null : document);
const chatRoot = () => doc()?.getElementById('chat') ?? null;

function textNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => {
        const parent = node.parentElement;
        if (!parent || !node.nodeValue || SKIP.has(parent.tagName) || parent.closest('.bl-wmask')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
    } });
    const list = []; let node;
    while ((node = walker.nextNode())) list.push(node);
    return list;
}
function maskTextNode(node) {
    const plan = maskPlan(node.nodeValue, words);
    if (!plan.some(p => p.masked)) return 0;
    const frag = document.createDocumentFragment(); let n = 0;
    for (const p of plan) {
        if (!p.masked) { frag.append(document.createTextNode(p.text)); continue; }
        const span = document.createElement('span'); span.className = 'bl-wmask'; span.dataset.orig = p.orig; span.textContent = p.text; frag.append(span); n++;
    }
    node.replaceWith(frag);
    return n;
}
/** 메시지 하나의 본문 · 이름 줄을 가린다. 이미 가린 조각(.bl-wmask) 안은 건너뛰므로 여러 번 불러도 같다. */
function maskMessage(mes) {
    let n = 0;
    for (const part of mes.querySelectorAll('.mes_text, .name_text')) for (const node of textNodes(part)) n += maskTextNode(node);
    return n;
}
function unmaskIn(root) {
    const spans = [...root.querySelectorAll('.bl-wmask')], parents = new Set();
    for (const span of spans) { parents.add(span.parentNode); span.replaceWith(document.createTextNode(span.dataset.orig ?? '')); }
    for (const parent of parents) parent?.normalize?.();   // 쪼갠 글자 노드를 다시 하나로
    return spans.length;
}
function onMutations(records) {
    if (!active) return;
    const chat = chatRoot();
    for (const record of records) {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (!target || target.closest('.bl-wmask')) continue;        // 내 조각 안의 변화는 무시
        const mes = target.closest('.mes');
        pending.add(mes || chat);                                      // 메시지 밖(새 메시지 · 채팅 교체)이면 전체를 다시 본다
    }
    if (pending.size) { clearTimeout(timer); timer = setTimeout(flush, DEBOUNCE); }
}
function flush() {
    timer = null;
    const chat = chatRoot();
    if (!active || !chat) { pending.clear(); return; }
    const targets = pending.has(chat) ? [...chat.querySelectorAll('.mes')] : [...pending].filter(el => el.isConnected);
    pending.clear();
    for (const mes of targets) maskMessage(mes);
    observer?.takeRecords();                                           // 방금 내가 바꾼 기록은 버린다
}

/** 가리기 시작(또는 새 목록으로 다시). 돌려주는 값 = 지금 가린 조각 수. 목록이 비면 끄고 0. */
export function startMask(list) {
    const next = parseMaskWords(Array.isArray(list) ? list.join('\n') : list);
    const chat = chatRoot();
    if (!next.length || !chat) { stopMask(); return 0; }
    if (active) unmaskIn(chat);                                        // 목록이 바뀌었을 수 있으니 먼저 되돌리고
    words = next; active = true;
    let n = 0;
    for (const mes of chat.querySelectorAll('.mes')) n += maskMessage(mes);
    observer ??= new MutationObserver(onMutations);
    observer.observe(chat, { childList: true, subtree: true, characterData: true });
    observer.takeRecords();
    document.body.classList.add('bl-wmask-on');
    return n;
}
/** 가리기 끝: 관찰을 멈추고 가린 조각을 모두 글자 노드로 되돌린다. 돌려주는 값 = 되돌린 조각 수. */
export function stopMask() {
    active = false; words = []; pending.clear();
    clearTimeout(timer); timer = null;
    observer?.disconnect(); observer = null;
    doc()?.body?.classList.remove('bl-wmask-on');
    const chat = chatRoot();
    return chat ? unmaskIn(chat) : 0;
}
export const isMasking = () => active;
export const maskWordsNow = () => words.slice();
/** features.js syncFeatures: 테마를 끄면(enabled false) 가리기도 전부 뗀다 */
export function syncWordMask(on) { if (!on && active) stopMask(); }
