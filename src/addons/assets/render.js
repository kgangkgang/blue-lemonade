// 캐릭터 에셋 — 채팅에 그림 보이기
// 1) 아직 글자로 남은 {{img::이름}}을 <img>로 바꾼다 (정규식이 없어도 그림이 나온다). '채팅에 그림 표시' 스위치가 이것을 켜고 끈다.
// 2) 정규식이 먼저 그린 <img src="/characters/폴더/이름">은 이름·확장자가 달라도 실제 파일로 맞추고,
//    번호 묶음이 켜져 있으면 묶음 안에서 하나를 고른다. 이 맞추기는 스위치와 상관없이 늘 한다.
//    같은 메시지의 같은 자리는 다시 그려도 같은 그림이 나오게 메시지 시각·스와이프·순서로 정해서,
//    스트리밍 중에 그림이 깜빡이며 바뀌지 않는다.
//
// 1.3.7: 같은 메시지의 번호 묶음은 한 바퀴 모두 쓰기 전에는 같은 파일을 다시 뽑지 않는다.
// 스트리밍으로 추가된 자리도 앞서 처리한 그림을 포함해 순서를 센다.
// 1.3.4 가볍게: 결과는 1.3.3 과 글자 하나까지 같고(같은 입력 → 같은 DOM), 하는 일만 줄였다.
// - 목록으로 풀리는 태그가 없으면(데우스 안내문의 {{img::filename.ext}} 뿐이면) 글자 마디를 훑지 않는다.
// - 태그 자리는 글자 마디 수천 개를 다 훑지 않고 textContent 의 위치에서 곧장 찾아 내려간다 (locator).
// - 바뀐 것이 없던 메시지는 .mes_text 안이 다시 바뀔 때까지 건너뛴다 (clean). 추론 시간·타이머 글자만 바뀐 감시 콜백,
//   60ms 모아 보기, 답이 끝난 뒤의 400/1200/3000ms 다시 보기가 여기서 거의 공짜가 된다.
// - 지금 캐릭터 폴더는 getContext() 대신 실리태번이 내보내는 변수를 바로 읽는다 (getContext 는 부를 때마다 큰 객체를 만든다).
import { getContext } from '../../../../../../extensions.js';
import * as stScript from '../../../../../../../script.js';
import * as stGroups from '../../../../../../group-chats.js';
import { settings, currentFolder, folderOf } from './state.js';
import { groupKeyOf, baseOf } from './assets.js';
import { findSimilar, findSimilarList } from './names.js';

const TAG_PATTERN = /\{\{img::\s*([^{}]+?)\s*\}\}/gi;
const SKIP_TAGS = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA']);
const SKIP_SELECTOR = 'code, pre, script, style, textarea';
// 문단을 가르는 데 쓴다. 한 문단 안에서 조각난 태그만 이어 붙여야 하고,
// 문단을 넘어가면 앞 문단의 '{{img::'와 뒤 문단의 '}}'가 우연히 이어진 가짜다.
const BLOCK_TAGS = new Set([
    'P', 'DIV', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'MAIN', 'NAV',
    'FIGURE', 'FIGCAPTION', 'DETAILS', 'SUMMARY', 'DL', 'DT', 'DD', 'FORM', 'FIELDSET',
]);

/** @type {ReturnType<import('./assets.js').buildIndex>|null} */
let index = null;
let generation = 0;
let observer = null;
let timer = null;
let pendingFull = false;
const pendingMessages = new Set();
/** 목록에 없던 이름 → { name, asset } (비슷한 그림, 없으면 null). 목록이 바뀌면 비운다. */
let similar = new Map();
/** 소문자 이름 → 목록으로 풀리는가(정확한 이름이나 비슷한 그림). 목록이 바뀌면 비운다. 부작용 없는 판정용 (1.3.4) */
let resolvable = new Map();
/**
 * 처리했는데 바꾼 것이 없던 메시지 → { key, text, imgs } (1.3.4).
 * 같은 key(목록 세대 · 스위치)에서 .mes_text 안이 그대로면 다시 처리해도 아무것도 안 바뀌므로 건너뛴다.
 * .mes_text 안을 건드린 감시 기록이 오면 지운다 (forgetChanged · forgetAdded).
 * imgs = 그때 .mes_text 안의 모든 <img> (안의 요소가 바뀌면 기록이 와서 지워지므로 그 동안은 이 목록이 전부다).
 * @type {WeakMap<Element, { key: string, text: Element, imgs: HTMLImageElement[] }>}
 */
let clean = new WeakMap();
/** 바꾸기 함수가 DOM 을 고친 횟수. 처리 전후가 같으면 '바꾼 것이 없던' 메시지다. */
let domEdits = 0;

export function setIndex(next) {
    index = next;
    similar = new Map();
    resolvable = new Map();
    generation++;
    schedulePass();
    document.dispatchEvent(new CustomEvent('char-assets:index')); // 5.3.7: 채팅 밖 보기(메모)가 새 목록으로 다시 그리게
}

export function clearIndex() {
    index = null;
    similar = new Map();
    resolvable = new Map();
    generation++;
    document.dispatchEvent(new CustomEvent('char-assets:index')); // 5.3.7: 채팅 밖 보기(메모)가 새 목록으로 다시 그리게
}

// 실리태번이 내보내는 변수 (살아 있는 바인딩). 이름이 없는 옛/새 버전이면 getContext() 로 돌아간다.
const liveBindings = 'this_chid' in stScript && 'characters' in stScript && 'chat' in stScript && 'selected_group' in stGroups;

let lastAvatar = Symbol('none');
let lastFolder = '';

/** state.js currentFolder() 와 같은 값. getContext().groupId = selected_group, characterId = this_chid, characters = characters */
function folderNow() {
    if (!liveBindings) return currentFolder();
    if (stGroups.selected_group) return '';
    const id = stScript.this_chid;
    if (id === undefined || id === null || id === '') return '';
    const character = stScript.characters?.[id] ?? null;
    // folderOf 는 avatar 글자만 보므로 같은 글자면 같은 답이다
    const avatar = character?.avatar;
    if (avatar !== lastAvatar) {
        lastAvatar = avatar;
        lastFolder = folderOf(character);
    }
    return lastFolder;
}

/**
 * 지금 열린 캐릭터의 목록일 때만 돌려준다 (1.3.2).
 * 캐릭터를 바꾸면 실리태번은 새 채팅을 먼저 그리고 CHAT_CHANGED 는 그 뒤에 보낸다. 그 사이 감시가 새 채팅의 태그를
 * 아직 남아 있던 이전 캐릭터의 목록으로 바꿔서, 같은 이름(Name_smile 등)이면 다른 캐릭터의 그림이 박힌 채로 남았다
 * (fixImages 는 목록에 없는 폴더의 그림을 건드리지 않으므로 다시 그리기 전까지 그대로). 새 목록이 오면 그때 바꾼다.
 */
function liveIndex() {
    return index && index.folder === folderNow() ? index : null;
}

/**
 * 1.4.1: 그림이 한 장도 없는 캐릭터에서는 메시지를 훑을 이유가 없다 — 전에는 60ms 마다
 * mes_text 전체의 textContent 를 만들고 #chat 변경 기록을 돌았다 (그림 없는 카드가 더 많다).
 * 다만 방금 전까지 그려 둔 그림이 남아 있으면 지워야 하므로 그때는 평소대로 돈다.
 */
function nothingToRender(live) {
    return live.byName.size === 0 && !document.querySelector('#chat img.eh-img');
}

/** 처리 결과를 바꿀 수 있는 값들. 목록이 바뀌면 generation 이 오른다. */
function cleanKey() {
    const store = settings();
    return `${generation}|${store.renderEnabled ? 1 : 0}|${store.randomGroups ? 1 : 0}|${store.onceOnly ? 1 : 0}`;
}

/**
 * 이 메시지를 다시 처리해도 아무것도 안 바뀌는가.
 * 글자·요소는 감시 기록으로 따라가고(forgetChanged), 감시가 못 보는 것(속성)은 여기서 직접 본다:
 * 처리할 때 쓰는 .mes_text 가 그대로인지, src 가 있는 <img> 가 모두 이번 세대 도장(data-eh)을 받았는지.
 */
function isClean(mes, key) {
    const entry = clean.get(mes);
    if (!entry || entry.key !== key) return false;
    if (mes.querySelector('.mes_text') !== entry.text) return false;
    const stamp = String(generation);
    for (const img of entry.imgs) {
        if (img.hasAttribute('src') && img.dataset.eh !== stamp) return false;
    }
    return true;
}

/** 감시 기록 하나가 이 메시지의 .mes_text 안을 바꿨을 수 있으면 '깨끗함'을 지운다. */
function forgetChanged(mes, mutation) {
    const entry = clean.get(mes);
    if (!entry) return;
    if (entry.text.contains(mutation.target)) {
        clean.delete(mes);
        return;
    }
    // .mes_text 를 떼었다가(그 사이 고쳐서) 다시 붙인 경우 — 붙인 기록은 .mes_text 바깥에서 온다
    if (mutation.type === 'childList') {
        for (const added of mutation.addedNodes) {
            if (added === entry.text || added.contains(entry.text)) {
                clean.delete(mes);
                return;
            }
        }
    }
}

/** 메시지 바깥(#chat 자체 등)의 기록: 새로 붙은 .mes 는 떨어져 있던 동안 바뀌었을 수 있다 (그때는 감시가 못 본다). */
function forgetAdded(mutation) {
    if (mutation.type !== 'childList') return;
    for (const added of mutation.addedNodes) {
        if (added.nodeType !== Node.ELEMENT_NODE) continue;
        clean.delete(added);
        for (const inner of added.getElementsByClassName('mes')) clean.delete(inner);
    }
}

/** 채팅 전체(또는 몇 개 메시지)를 곧 다시 본다. 짧게 모아서 한 번에 처리한다. */
export function schedulePass(messages = null) {
    if (messages) messages.forEach(mes => pendingMessages.add(mes));
    else pendingFull = true;
    if (timer) return;
    timer = setTimeout(() => {
        timer = null;
        runPass();
    }, 60);
}

function runPass() {
    const full = pendingFull;
    const targets = full ? null : [...pendingMessages];
    pendingFull = false;
    pendingMessages.clear();
    const live = liveIndex();
    if (!live || nothingToRender(live)) return;
    const chat = document.getElementById('chat');
    if (!chat) return;
    const messages = full ? chat.querySelectorAll('.mes') : targets.filter(mes => mes.isConnected);
    const key = cleanKey();
    for (const mes of messages) {
        if (isClean(mes, key)) continue;
        try {
            processMessage(mes, key);
        } catch (error) {
            console.debug('[캐릭터 에셋] 메시지 처리 실패', error);
        }
    }
}

/** 글자로 남은 태그를 그림으로 바꾼다. */
function replaceInText(text) {
    if (!index) return;
    if (!settings().renderEnabled) return;
    const whole = text.textContent;
    if (!whole.includes('{{img::')) return;
    // 목록으로 풀리는 태그가 하나도 없으면 아래 세 바꾸기는 아무것도 바꾸지 못한다 (셋 다 풀리는 이름만 바꾼다).
    // 안내문의 {{img::filename.ext}}만 있는 메시지가 여기서 끝난다.
    if (!hasResolvable(whole)) return;
    const seen = new Set(); // 이번에 그린 묶음 (같은 메시지 안의 두 번째 태그를 거르는 데 씀)
    const before = domEdits;
    const locate = replaceTags(text, seen, whole);
    // 코드·스크립트 요소는 한 번만 찾아서 태그만 든 코드 블록 바꾸기와 조각 맞추기가 같이 쓴다
    const skipped = [...text.querySelectorAll(SKIP_SELECTOR)];
    const afterTags = domEdits;
    replaceTagOnlyCode(text, seen, skipped.filter(element => element.matches('code, pre')));
    // 남은 태그 가운데 목록에 있는 이름이 하나라도 있을 때만 조각 맞추기를 한다.
    // 안내문의 {{img::filename.ext}}처럼 목록에 없는 태그만 남으면, 안 그러면 글자가 바뀔 때마다 헛돈다.
    const unchanged = domEdits === before;
    const rest = unchanged ? whole : text.textContent;
    if (!rest.includes('{{img::')) return;
    for (const match of rest.matchAll(TAG_PATTERN)) {
        if (!findAsset(match[1])) continue;
        replaceSpanning(text, seen, rest, unchanged ? locate : null, domEdits === afterTags ? skipped : null);
        return;
    }
}

/** 태그 이름 정리 — findAsset · resolveTag 와 같은 규칙 */
function cleanName(name) {
    return String(name).trim().split('?')[0].replace(/^.*[\\/]/, '');
}

/**
 * 이 이름이 그림으로 풀리는가 (resolveTag 가 null 이 아닌가). 캐시(similar)도 seen 도 건드리지 않는다.
 * 정확한 이름이 있거나, 없으면 비슷한 그림 후보가 하나라도 있을 때. findSimilarList 는 대소문자를 가리지 않는다.
 */
function canResolve(name) {
    const clean = cleanName(name);
    if (!clean) return false;
    const lower = clean.toLowerCase();
    let known = resolvable.get(lower);
    if (known === undefined) {
        known = !!(index.byName.get(lower) ?? index.byBase.get(baseOf(lower))) || findSimilarList(baseOf(clean), index.groups).length > 0;
        resolvable.set(lower, known);
    }
    return known;
}

function hasResolvable(whole) {
    for (const match of whole.matchAll(TAG_PATTERN)) {
        if (canResolve(match[1])) return true;
    }
    return false;
}

// ── 같은 그림은 한 번만 ──────────────────────────────────────────
// 놀라는 장면이 이어지면 AI가 같은 태그를 또 부른다. 번호 묶음(변형)이 없는 그림은 똑같은 그림이 두 번 나오는 것이라
// 앞 메시지나 같은 메시지 앞쪽에 이미 나왔으면 태그 글자만 지우고 그림은 그리지 않는다. 묶음이 있으면 다른 버전이
// 나올 수 있으니 그대로 둔다. 채팅 밖(북마크 카드)은 순서를 알 수 없어 거르지 않는다.

/** '같은 그림'의 기준 — 번호 묶음이 켜져 있으면 묶음, 꺼져 있으면 파일 하나하나 */
function sameKey(asset) {
    return settings().randomGroups ? asset.group : asset.file.toLowerCase();
}

/** 이 그림에 번호 묶음(변형)이 있어서 다른 버전이 나올 수 있는가 — 꺼 둔 파일은 묶음에 없으므로 변형 없음으로 본다 */
function hasVariants(asset) {
    if (!settings().randomGroups) return false;
    const members = index?.groups.get(asset.group);
    return !!members && members.length > 1;
}


/**
 * 이 자리에 그리면 같은 그림이 두 번째로 나오는가. 그릴 것이면 seen 에 적어 둔다.
 * @param {Element} text .mes_text
 * @param {Set<string>} seen 이번 바꾸기에서 이미 그린 그림
 */
function isRepeat(asset, text, seen) {
    if (wouldRepeat(asset, text, seen)) return noteRepeat(text, asset);
    seen.add(sameKey(asset));
    return false;
}

/** isRepeat 의 판정만 (적어 두지 않는다) — 비슷한 그림 후보를 고를 때 미리 본다 */
function wouldRepeat(asset, text, seen) {
    const key = sameKey(asset);
    if (!settings().onceOnly || hasVariants(asset)) return false;
    if (seen.has(key)) return true;
    // 같은 메시지에서 앞서(이전 바꾸기 때) 그린 그림
    for (const img of text.querySelectorAll('img.eh-img[data-eh-group]')) {
        if ((settings().randomGroups ? img.dataset.ehGroup : (img.dataset.ehFile || img.alt || '').toLowerCase()) === key) return true;
    }
    // 범위는 메시지 하나뿐이다. 1.1.4~1.2.2 는 앞 10개 메시지까지 봤는데, 사용자 기준의 '한 채팅'은 답변 하나(1챗)라
    // 앞 답변에 나온 그림이 다음 답변에서 사라져 "에셋이 안 뜬다"가 됐다 (1.2.3).
    return false;
}

/**
 * 태그 이름 → 이번 자리에 그릴 그림. 세 바꾸기 길이 모두 이것을 쓴다.
 * 목록에 있는 이름은 그대로 (같은 답변에 이미 나왔으면 repeat). 목록에 없는 이름은 비슷한 그림 후보를 차례로 보며
 * 같은 답변에 아직 안 나온 첫 후보를 고른다 — Name_smirk → light_smile 이 위에 이미 있으면 smile 로 (1.2.4).
 * 후보가 전부 이미 나왔으면 첫 후보를 repeat 로 돌려 태그만 지운다.
 * @returns {{ asset: object, repeat: boolean } | null}
 */
function resolveTag(name, text, seen) {
    const clean = cleanName(name);
    if (!clean) return null;
    const lower = clean.toLowerCase();
    const exact = index.byName.get(lower) ?? index.byBase.get(baseOf(lower));
    if (exact) return { asset: exact, repeat: isRepeat(exact, text, seen) };
    const candidates = findSimilarList(baseOf(clean), index.groups);
    if (!candidates.length) return null;
    const pick = candidates.find(candidate => !wouldRepeat(candidate, text, seen)) ?? candidates[0];
    similar.set(lower, { name: clean, asset: pick }); // 진단 단추의 '비슷한 그림으로' 표시용 (마지막 선택)
    return { asset: pick, repeat: isRepeat(pick, text, seen) };
}

/** 같은 그림이라 태그만 지운 이름을 메시지에 적어 둔다 — 태그는 사라지므로 '왜 안 나오지'를 진단 단추가 알려 줄 수 있게. 늘 true */
function noteRepeat(text, asset) {
    const mes = text.closest('.mes') ?? text;
    const list = (mes.dataset.ehSkipped ?? '').split('|').filter(Boolean);
    if (!list.includes(asset.file)) list.push(asset.file);
    mes.dataset.ehSkipped = list.join('|');
    return true;
}

// ── 글자 위치 → 글자 마디 ─────────────────────────────────────────

/**
 * root.textContent 의 글자 위치 → 그 글자가 든 글자 마디와 마디 안의 위치 (1.3.4).
 * 예전에는 마디 전부(페이드인 스트리밍이면 낱말마다 <span> 이라 수천 개)를 훑어 이어 붙였다.
 * 이제는 자식마다 글자 수만 세서 해당 자식으로 곧장 내려간다. 빈 마디는 글자를 담지 않으므로 고를 일이 없다
 * (예전 이분 탐색도 실제 글자 위치에서는 그 글자를 담은 마디를 골랐다). DOM 을 고치기 전에만 쓴다.
 * locate.offsetOf(node) 는 반대로 그 마디(요소)의 첫 글자 위치 — 글자가 하나 이상 있는 마디에만 쓴다.
 * @param {Element} root
 */
function locator(root) {
    const layouts = new Map();
    const layoutOf = (element) => {
        let layout = layouts.get(element);
        if (layout) return layout;
        const kids = [];
        const starts = [];
        let length = 0;
        for (let child = element.firstChild; child; child = child.nextSibling) {
            const type = child.nodeType;
            const size = type === Node.ELEMENT_NODE ? child.textContent.length
                : type === Node.TEXT_NODE || type === Node.CDATA_SECTION_NODE ? child.data.length : 0;
            if (!size) continue;
            kids.push(child);
            starts.push(length);
            length += size;
        }
        layout = { kids, starts };
        layouts.set(element, layout);
        return layout;
    };
    /** @type {((offset: number) => { node: CharacterData, offset: number }) & { offsetOf: (node: Node) => number }} */
    const locate = (offset) => {
        let element = root;
        let base = 0;
        for (;;) {
            const { kids, starts } = layoutOf(element);
            const relative = offset - base;
            let low = 0;
            let high = kids.length - 1;
            let at = 0;
            while (low <= high) {
                const mid = (low + high) >> 1;
                if (starts[mid] <= relative) { at = mid; low = mid + 1; } else high = mid - 1;
            }
            const child = kids[at];
            if (child.nodeType !== Node.ELEMENT_NODE) return { node: child, offset: relative - starts[at] };
            base += starts[at];
            element = child;
        }
    };
    locate.offsetOf = (node) => {
        let offset = 0;
        for (let child = node; child !== root; child = child.parentNode) {
            const { kids, starts } = layoutOf(child.parentNode);
            offset += starts[kids.indexOf(child)];
        }
        return offset;
    };
    return locate;
}

/** 코드·스크립트 같은 건너뛸 요소 안의 글자인가 (.mes_text 위쪽은 보지 않는다) */
function insideSkip(node, text) {
    for (let parent = node.parentElement; parent && parent !== text; parent = parent.parentElement) {
        if (SKIP_TAGS.has(parent.tagName)) return true;
    }
    return false;
}

/** 이 글자가 속한 문단 상자 — 가장 가까운 블록 요소. 중간에 감싸는 칸이 있어도 문단을 제대로 가른다. */
function blockOf(node, text) {
    for (let element = node.parentElement; element && element !== text; element = element.parentElement) {
        if (BLOCK_TAGS.has(element.tagName)) return element;
    }
    return text;
}

/**
 * textContent 에서 건너뛸 요소(code·pre…) 안의 글자 구간들 [시작, 끝) — 앞에서부터, 겹치지 않게 (바깥 요소만).
 * 비어 있는 요소는 구간이 없다.
 */
function skipRanges(text, locate, skipped) {
    const ranges = [];
    let outer = null;
    for (const element of skipped ?? text.querySelectorAll(SKIP_SELECTOR)) {
        if (!SKIP_TAGS.has(element.tagName)) continue; // 선택자는 SVG <style> 같은 것도 잡는다 — 예전 판정(tagName)만 따른다
        if (outer && outer.contains(element)) continue;
        outer = element;
        const length = element.textContent.length;
        if (!length) continue;
        const start = locate.offsetOf(element);
        ranges.push([start, start + length]);
    }
    return ranges;
}

/**
 * 태그가 글자 마디 여러 개에 걸쳐 있을 때도 바꾼다.
 *
 * 코드 색칠이나 다른 확장·테마가 글자를 <span>으로 감싸면 `{{img::이름.png}}` 한 덩어리가
 * 여러 마디로 쪼개진다. 그러면 마디 하나만 들여다보는 replaceTags는 온전한 태그를 찾지 못한다.
 * 화면에는 태그가 멀쩡히 한 줄로 보이는데 그림으로는 안 바뀌는 것이 이 경우다.
 * 그래서 마디를 전부 이어 붙여 찾고, 찾은 구간을 Range로 통째로 들어낸 뒤 그 자리에 그림을 넣는다.
 * 코드·스크립트 안의 글자는 이어 붙이지 않는다 (섞인 코드 블록에 넣은 그림은 코드 색칠이 다시 돌면 지워진다).
 *
 * 1.3.4: 마디를 훑어 이어 붙이지 않는다. '건너뛰지 않은 마디를 이어 붙인 글'은 textContent 에서 건너뛸 요소의 구간을
 * 뺀 것과 같으므로 그 글(visible)에서 태그를 찾고, 태그 두 끝 글자의 textContent 위치를 locator 로 마디에 맞춘다.
 * @param {string} whole 지금의 text.textContent
 * @param {ReturnType<typeof locator>|null} locate 같은 DOM 으로 만든 locator (없으면 새로)
 * @param {Element[]|null} skipped 같은 DOM 에서 찾은 text.querySelectorAll(SKIP_SELECTOR) (없으면 새로)
 */
function replaceSpanning(text, seen, whole, locate, skipped) {
    locate ??= locator(text);
    const ranges = skipRanges(text, locate, skipped);
    // visible 의 조각마다 [visible 에서의 시작, textContent 에서의 시작]
    const pieces = [];
    let visible = whole;
    if (ranges.length) {
        const parts = [];
        let from = 0;
        let length = 0;
        for (const [start, end] of [...ranges, [whole.length, whole.length]]) {
            if (start > from) {
                pieces.push([length, from]);
                parts.push(whole.slice(from, start));
                length += start - from;
            }
            from = end;
        }
        visible = parts.join('');
    }
    if (!visible.includes('{{img::')) return;
    /** visible 의 글자 위치 → textContent 의 글자 위치 */
    const toWhole = (offset) => {
        if (!pieces.length) return offset;
        let low = 0;
        let high = pieces.length - 1;
        let at = 0;
        while (low <= high) {
            const mid = (low + high) >> 1;
            if (pieces[mid][0] <= offset) { at = mid; low = mid + 1; } else high = mid - 1;
        }
        return pieces[at][1] + (offset - pieces[at][0]);
    };

    const hits = [];
    for (const match of visible.matchAll(TAG_PATTERN)) {
        // 풀리지 않는 이름은 resolveTag 가 null 이라 어차피 건너뛴다 (문단 판정에는 부작용이 없다)
        if (!canResolve(match[1])) continue;
        const from = locate(toWhole(match.index));
        // 끝은 마지막 '}'가 든 마디에 붙인다. 끝 위치로 그냥 찾으면 다음 마디의 0번으로 넘어가서,
        // 그 사이에 있던 <br>이나 방금 그려 넣은 그림까지 통째로 지워 버린다.
        const to = locate(toWhole(match.index + match[0].length - 1));
        to.offset += 1;
        // 문단을 넘어가는 것은 진짜 태그가 아니다. 앞 문단의 '{{img::'와 뒤 문단의 '}}'가
        // 우연히 이어져 만들어진 가짜이고, 그대로 지우면 사이의 글이 통째로 날아간다.
        // 1.3.2: 이름 풀이(resolveTag)보다 먼저 거른다. 풀이가 '이번 답변에 그렸다'고 적어 두기 때문에, 가짜가 먼저 나오면
        //        뒤의 진짜 태그가 '같은 그림'으로 몰려 그림 없이 지워졌다.
        if (blockOf(from.node, text) !== blockOf(to.node, text)) continue;
        const found = resolveTag(match[1], text, seen);
        if (!found) continue;
        // 앞에서부터 판정해야 같은 메시지 안에서 먼저 나온 태그가 남는다 (바꾸기 자체는 뒤에서부터)
        hits.push({ from, to, asset: found.asset, repeat: found.repeat });
    }
    applyHits(hits);
}

/** 찾은 구간들을 그림으로 바꾼다. 뒤에서부터 바꾼다 — 앞에서부터 바꾸면 뒤쪽 자리 번호가 밀린다. */
function applyHits(hits) {
    for (let i = hits.length - 1; i >= 0; i--) {
        const hit = hits[i];
        domEdits++;
        try {
            // 지우기 전에 그림을 먼저 만든다. 지운 뒤에 실패하면 글자만 사라진다.
            const img = hit.repeat ? null : makeImage(hit.asset);
            const range = document.createRange();
            range.setStart(hit.from.node, hit.from.offset);
            range.setEnd(hit.to.node, hit.to.offset);
            range.deleteContents();
            if (img) range.insertNode(img);
        } catch (error) {
            console.debug('[캐릭터 에셋] 조각난 태그 바꾸기 실패', error);
        }
    }
}

/**
 * 메시지 하나를 처리한다. 바꾼 것이 없으면 '깨끗함'으로 적어 둔다.
 * @param {Element} mes
 * @param {string} key cleanKey()
 */
function processMessage(mes, key) {
    clean.delete(mes);
    const text = mes.querySelector('.mes_text');
    if (!text) return;
    const before = domEdits;
    replaceInText(text);
    const imgs = [...text.getElementsByTagName('img')];
    fixImages(text, mes, imgs);
    if (domEdits === before) clean.set(mes, { key, text, imgs });
}

/**
 * 태그 바꾸기만 지금 당장 한다. 모아서 하지 않는다.
 *
 * 예전에는 'character-assets' 정규식이 실리태번의 글자 만들기 안에서 태그를 바로 그림으로 바꿔 줬다.
 * 그래서 스트리밍 중에도, 원문에서도 태그가 보이는 순간이 아예 없었다.
 * 그 정규식을 지운 뒤로는 이 확장이 유일한 길인데, 60ms 모았다가 처리하다 보니
 * 메시지가 다시 그려질 때마다 그 틈에 태그가 글자 그대로 보인다.
 * 그래서 글자가 바뀌는 바로 그 자리에서 바꾼다. 무거운 일(이미 그려진 그림 맞추기)은 그대로 모아서 한다.
 *
 * 바꾼 결과가 또 감시에 걸리지만, 바뀐 뒤에는 태그가 없어 아무 일도 하지 않으므로 저절로 멎는다.
 *
 * 1.3.2: 번호 묶음 고르기(fixImages)도 여기서 바로 한다. 스트리밍은 글자가 올 때마다 메시지를 새로 그려서 그림도 매번
 * 새로 만들어지는데, 고르기가 60ms 뒤에 따로 돌면 화면이 '번호 없는 그림 → 고른 그림 → 번호 없는 그림…'으로 계속 바뀌었다.
 * 고르기는 메시지 시각·순서로 정해지므로 같은 자리에 같은 그림이 나오고, src 만 바꿔서 감시에 다시 걸리지 않는다.
 */
function replaceNow(messages) {
    const live = liveIndex();
    if (!live || nothingToRender(live)) return;
    const key = cleanKey();
    for (const mes of messages) {
        if (!mes.isConnected) continue;
        if (isClean(mes, key)) continue;
        try {
            processMessage(mes, key);
        } catch (error) {
            console.debug('[캐릭터 에셋] 즉시 바꾸기 실패', error);
        }
    }
}

// ── {{img::이름}} → <img> ──────────────────────────────────────

function findAsset(name) {
    const clean = cleanName(name);
    if (!clean) return null;
    return lookup(clean);
}

/** 파일 이름 → 그림. 대소문자·확장자가 달라도 맞추고, 목록에 없는 이름은 같은 캐릭터의 비슷한 표정으로 바꾼다. */
function lookup(file) {
    const lower = file.toLowerCase();
    const found = index.byName.get(lower) ?? index.byBase.get(baseOf(lower));
    if (found) return found;
    // AI는 다른 캐릭터에게 있는 표정을 따라 없는 이름(Name_smirk)을 지어낸다. 캐릭터 앞머리가 없는
    // 안내문의 {{img::filename.ext}} 같은 이름은 findSimilar가 null을 돌려주므로 글자 그대로 남는다.
    if (!similar.has(lower)) similar.set(lower, { name: file, asset: findSimilar(baseOf(file), index.groups) });
    return similar.get(lower).asset;
}

function makeImage(asset) {
    const img = document.createElement('img');
    img.className = 'eh-img';
    img.alt = asset.file;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.dataset.ehSrc = asset.url;
    img.dataset.ehGroup = asset.group;
    img.src = asset.url;
    return img;
}

/**
 * 한 글자 마디 안에 온전히 들어 있는 태그를 바꾼다.
 * 1.3.4: 마디를 전부 훑지 않는다. 한 마디 안의 태그는 textContent 에서 찾은 태그 가운데 그 마디 안에 다 들어가는 것과 같다
 * (태그 이름에는 { } 가 없어서 태그끼리 겹치지 않는다). 그런 태그가 있는 마디만 locator 로 찾아 예전과 같은 순서로 바꾼다.
 * 풀리지 않는 태그만 있는 마디는 예전에도 바뀌지 않았다. 소문자 '{{img::'가 없는 마디({{IMG::…}}만)는 예전에도 건너뛰었다.
 * @param {string} whole 지금의 text.textContent
 * @returns {ReturnType<typeof locator>} 바꾸기 전 DOM 으로 만든 locator
 */
function replaceTags(text, seen, whole) {
    const locate = locator(text);
    const nodes = [];
    for (const match of whole.matchAll(TAG_PATTERN)) {
        if (!canResolve(match[1])) continue;
        const { node, offset } = locate(match.index);
        if (offset + match[0].length > node.data.length) continue; // 여러 마디에 걸친 태그 (replaceSpanning 몫)
        if (nodes[nodes.length - 1] === node) continue;
        // 예전처럼 소문자 '{{img::'가 든 마디만 본다 — 태그 찾기는 대소문자를 안 가리지만({{IMG::…}}) 마디 고르기는 가렸다
        if (!node.data.includes('{{img::') || insideSkip(node, text)) continue;
        nodes.push(node);
    }

    for (const node of nodes) {
        const fragment = document.createDocumentFragment();
        let last = 0;
        let changed = false;
        const data = node.data;
        for (const match of data.matchAll(TAG_PATTERN)) {
            const found = resolveTag(match[1], text, seen);
            if (!found) continue;
            fragment.append(data.slice(last, match.index));
            if (!found.repeat) fragment.append(makeImage(found.asset)); // 두 번째 같은 그림은 태그만 지운다
            last = match.index + match[0].length;
            changed = true;
        }
        if (!changed) continue;
        fragment.append(data.slice(last));
        domEdits++;
        node.replaceWith(fragment);
    }
    return locate;
}

// 칸 4개나 탭으로 들여쓴 줄은 마크다운이 코드 블록으로 만든다(AI가 문단을 들여쓰면 태그 줄도 그렇게 된다).
// 태그만 들어 있는 코드 블록은 코드가 아니라 그림 자리이므로 바꿔 준다. 코드 색칠이 태그를 여러 조각으로 쪼개
// 놓기 때문에 글자 마디가 아니라 블록을 통째로 바꾼다. 다른 글과 섞인 코드 블록은 건드리지 않는다.
// '태그만' 인지는 태그를 모두 지운 뒤 남는 글이 없는지로 본다 — 앞뒤로 되짚는 정규식은 스트리밍 중 덜 끝난 `{{img::이름` 이
// 태그 여럿과 함께 오면 시간이 지수로 늘었다 (태그 18개 = 32초).

/** @param {Element[]} blocks 지금 DOM 의 text.querySelectorAll('code, pre') 와 같은 목록 (문서 순서) */
function replaceTagOnlyCode(text, seen, blocks) {
    for (const block of blocks) {
        if (!block.isConnected) continue;
        if (block.tagName === 'PRE' && block.querySelector('code')) continue; // 안쪽 code에서 처리한다
        const content = block.textContent ?? '';
        if (!content.includes('{{img::')) continue;
        const names = [...content.matchAll(TAG_PATTERN)].map(match => match[1]);
        if (!names.length || content.replace(TAG_PATTERN, '').trim() !== '') continue;
        if (names.some(name => !findAsset(name))) continue;
        const fragment = document.createDocumentFragment();
        for (const name of names) {
            const found = resolveTag(name, text, seen);
            if (found && !found.repeat) fragment.append(makeImage(found.asset));
        }
        const parent = block.parentElement;
        const target = block.tagName === 'CODE' && parent?.tagName === 'PRE' && parent.childElementCount === 1 ? parent : block;
        domEdits++;
        target.replaceWith(fragment);
    }
}

// ── 이미 그려진 <img> 맞추기 ─────────────────────────────────────

/** '/characters/폴더/파일' 주소면 { folder, file } — 꾹 누르기(hold.js)도 이것으로 화면의 그림을 목록의 파일에 맞춘다 */
export function parseCharacterUrl(src) {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(src, location.href).pathname);
    } catch {
        return null;
    }
    // 폴더는 '캐릭터' 또는 '캐릭터/프리셋' (1.2.0 하위 폴더)
    const match = /\/characters\/(.+)\/([^/]+)$/.exec(pathname);
    if (!match) return null;
    return { folder: match[1], file: match[2] };
}

/** 한 에셋의 명시적인 장식 레이어만 묶는다. 번역문 전체 DIV/문단은 이미지 슬롯이 아니다. */
function topBlockOf(element, text) {
    const layer = element.closest('.custom-cac-wrap, [class*="custom-imageWrapper"]');
    return layer && layer !== text && text.contains(layer) ? layer : element;
}

function hashText(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function messageSeed(mes) {
    // 1.4.2: 다른 채팅의 메시지를 그린 자리(북마크 미리 보기)는 그 메시지의 씨앗을 data-eh-seed 로 적어 준다
    if (mes.dataset?.ehSeed) return mes.dataset.ehSeed;
    const mesid = mes.getAttribute('mesid') ?? '';
    const chat = liveBindings ? stScript.chat : getContext().chat;
    const item = chat?.[Number(mesid)];
    // 1.4.2: 이어서 쓰기 전의 시각(extra.eh_seed, index.js)이 있으면 그것 — 이어 쓸 때 send_date 가 새로 찍힌다
    return `${item?.extra?.eh_seed ?? item?.send_date ?? mesid}|${item?.swipe_id ?? 0}`;
}

/** @param {HTMLImageElement[]} imgs 지금 text 안의 모든 <img> (문서 순서) — src 가 있는 것만 본다 (예전 querySelectorAll('img[src]')) */
function fixImages(text, mes, imgs) {
    const images = imgs.filter(img => img.hasAttribute('src'));
    if (!images.length) return;
    const stamp = String(generation);
    const random = settings().randomGroups;
    let seed = null;
    const picks = new Map();
    const usedByGroup = new Map();
    let lastBlock = null;
    let blockIndex = -1;

    for (const img of images) {
        // Count already processed images too: streaming appends must not reuse slot zero.
        // 정규식이 처음 준 주소를 기억해 두고, 목록이 바뀌어 다시 볼 때도 그 이름으로 찾는다.
        const original = img.dataset.ehSrc || img.getAttribute('src') || '';
        img.dataset.eh = stamp;
        img.dataset.ehSrc = original;

        const parsed = parseCharacterUrl(original);
        // 이 캐릭터(또는 불러온 캐릭터) 폴더의 그림만 건드린다 — 바깥 주소의 <img>는 그대로
        if (!parsed || !index.folders.has(parsed.folder.split('/')[0])) continue;

        const block = topBlockOf(img, text);
        if (block !== lastBlock) {
            lastBlock = block;
            blockIndex++;
        }

        let target = null;
        if (random) {
            const members = index.groups.get(groupKeyOf(parsed.file));
            if (members && members.length > 1) {
                const key = `${blockIndex}|${original}`;
                if (!picks.has(key)) {
                    if (seed === null) seed = messageSeed(mes);
                    let used=usedByGroup.get(groupKeyOf(parsed.file));
                    if(!used){used=new Set();usedByGroup.set(groupKeyOf(parsed.file),used);}
                    let candidates=members.filter(item=>!used.has(item.url));
                    if(!candidates.length){used.clear();candidates=members;}
                    const pick=candidates[hashText(`${seed}|${key}`) % candidates.length];
                    used.add(pick.url);picks.set(key,pick);
                }
                target = picks.get(key);
            }
        }
        if (!target) target = lookup(parsed.file);
        // 지금 화면에 있는 파일(예전에 바꿔 둔 것 포함)과 다를 때만 바꾼다. 주소 문자열 비교는 인코딩 차이 때문에 쓰지 않는다.
        // 같은 이름이 여러 폴더(원본·프리셋·불러온 폴더)에 있을 수 있으니 폴더까지 같이 본다.
        const shown = img.dataset.ehFile || parsed.file;
        const shownFolder = img.dataset.ehFolder || parsed.folder;
        if (target && (target.file !== shown || target.folder !== shownFolder)) {
            img.src = target.url;
            img.dataset.ehFile = target.file;
            img.dataset.ehFolder = target.folder;
        }
    }
}

/**
 * 지금 화면의 채팅을 통째로 다시 본다. 무슨 일이 있었는지 세어서 돌려준다.
 * 그림이 안 나올 때 어디서 막혔는지 바로 알려고 설정 화면의 '채팅 다시 그리기'가 쓴다.
 * 이 단추는 '깨끗함'을 믿지 않고 모든 메시지를 다시 처리한다.
 */
export function redrawNow() {
    const report = {
        hasIndex: !!liveIndex(), // 캐릭터를 막 바꿔 이전 캐릭터 목록만 남았으면 '아직 못 읽음'으로 (1.3.2)
        assets: index ? index.byName.size : 0,
        folder: index?.folder ?? '',
        renderEnabled: !!settings().renderEnabled,
        watching: !!observer,
        messages: 0,
        tagsBefore: 0,
        tagsAfter: 0,
        images: 0,
        unresolved: [],
        stuck: [],
        substituted: [],
        repeated: [], // 같은 그림이라 태그만 지운 이름 (최근 메시지부터 3개)
    };
    const chat = document.getElementById('chat');
    if (!chat || !report.hasIndex) return report;

    const all = [...chat.querySelectorAll('.mes')];
    report.messages = all.length;
    const countTags = () => all.reduce((sum, mes) => {
        const text = mes.querySelector('.mes_text');
        return sum + ((text?.textContent ?? '').match(TAG_PATTERN) ?? []).length;
    }, 0);

    report.tagsBefore = countTags();
    const key = cleanKey();
    for (const mes of all) {
        try {
            processMessage(mes, key);
        } catch (error) {
            console.debug('[캐릭터 에셋] 다시 그리기 실패', error);
        }
    }
    report.tagsAfter = countTags();
    report.images = chat.querySelectorAll('img.eh-img').length;

    // 남은 태그를 두 갈래로 나눠 몇 개만 보여 준다: 목록에 없는 이름과, 목록에 있는데도 안 바뀐 이름.
    if (index) {
        for (const mes of all) {
            const text = mes.querySelector('.mes_text');
            if (!text) continue;
            for (const match of (text.textContent ?? '').matchAll(TAG_PATTERN)) {
                const name = match[1].trim();
                // 목록에 있는데도 남아 있으면 바꾸기가 막힌 것이고, 목록에 없으면 이름 문제다.
                const list = findAsset(name) ? report.stuck : report.unresolved;
                if (list.length < 3 && !list.includes(name)) list.push(name);
            }
        }
    }
    for (const mes of [...all].reverse()) {
        for (const name of (mes.dataset.ehSkipped ?? '').split('|').filter(Boolean)) {
            if (report.repeated.length < 3 && !report.repeated.includes(name)) report.repeated.push(name);
        }
    }
    // 목록에 없어서 비슷한 그림으로 대신 보여 준 이름 (최근 3개)
    report.substituted = [...similar.values()]
        .filter(entry => entry.asset)
        .slice(-3)
        .map(entry => `${entry.name} → ${entry.asset.file}`);
    return report;
}

// ── 채팅 지켜보기 ───────────────────────────────────────────────

/**
 * 채팅 밖에서 메시지를 따로 그리는 확장(북마크 카드 · 앞뒤 문맥 창 등)이 그린 칸의 태그를 그림으로 바꾼다.
 * 그 확장이 `document.dispatchEvent(new CustomEvent('char-assets:render', { detail: { root } }))`를 보내면 된다.
 * 서로 import 하지 않으므로 둘 중 하나만 깔려 있어도 아무 일도 없다.
 * 이미 그려진 <img> 맞추기(fixImages)는 메시지 시각으로 그림을 고르는 채팅 전용이라 여기서는 하지 않는다.
 */
function renderOutside(root) {
    if (!(root instanceof Element) || !liveIndex()) return;
    const targets = root.matches('.mes_text') ? [root] : [...root.querySelectorAll('.mes_text')];
    if (!targets.length) targets.push(root);
    for (const text of targets) {
        try {
            replaceInText(text);
        } catch (error) {
            console.debug('[캐릭터 에셋] 채팅 밖 그리기 실패', error);
        }
    }
}

let outsideListening = false;

export function setupRenderer() {
    if (!outsideListening) {
        outsideListening = true;
        document.addEventListener('char-assets:render', event => renderOutside(event.detail?.root));
    }
    const chat = document.getElementById('chat');
    if (!chat || observer) return;
    observer = new MutationObserver((mutations) => {
        const touched = new Set();
        let full = false;
        // 스트리밍 한 번에 기록이 수백 개 오고 대부분 같은 요소 안이라, 바로 앞 기록과 같은 요소면 closest 를 다시 부르지 않는다
        let lastElement;
        let lastMes = null;
        for (const mutation of mutations) {
            const node = mutation.target;
            const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
            if (element !== lastElement) {
                lastElement = element;
                lastMes = element?.closest?.('.mes');
            }
            const mes = lastMes;
            if (mes) {
                touched.add(mes);
                forgetChanged(mes, mutation);
            } else {
                full = true;
                forgetAdded(mutation);
            }
        }
        // 글자가 바뀐 그 자리에서 태그를 바로 그림으로 바꾼다. 나머지 일은 아래에서 모아서 한다.
        if (touched.size) replaceNow(touched);
        else if (full) replaceNow(chat.querySelectorAll('.mes'));
        if (full) schedulePass();
        else if (touched.size) schedulePass(touched);
    });
    observer.observe(chat, { childList: true, subtree: true, characterData: true });
}
