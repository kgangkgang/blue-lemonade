// 캐릭터 에셋 — 채팅에 나온 그림을 꾹 누르면 그 그림의 크게 보기 창(끄기 · 태그 복사 · 이름 바꾸기 · 지우기)을 연다.
// 채팅 밖에서 같은 그림을 그리는 자리(북마크 카드 · 앞뒤 문맥 창 · 메모 목록 칸 · 메모 쪽지)도 모두 .mes_text 안이라 같은 규칙으로 된다.
// 폰은 0.5초 꾹 누르기(또는 그보다 먼저 오는 길게 누르기 메뉴 신호), PC 는 오른쪽 클릭이나 왼쪽 버튼 꾹 누르기.
//
// 누르기 · 움직이기에는 preventDefault · stopPropagation 을 하지 않는다 — 스크롤, 짧게 누르기(톡), 글자 고르기, 다른 확장이 그대로 받는다.
// 창을 연 뒤에만 그 누르기의 끝을 먹는다: 손을 뗄 때 따라오는 click 하나(메모 보기 → 편집, 몰입 읽기 막대, 북마크 카드 이동, 창 닫기로
// 새지 않게)와 폰의 길게 누르기 메뉴. 목록에 있는 그림(지금 캐릭터의 폴더 · 프리셋 · 불러온 폴더)일 때만 움직이고,
// 그 밖의 그림(다른 캐릭터 · 바깥 주소 · 그룹 채팅 · 목록을 아직 못 읽음)은 브라우저가 하던 대로 둔다.
import { runtime, groupsOf } from './store.js';
import { parseCharacterUrl } from './render.js';
import { toast } from './ui.js';
import { TITLE } from './state.js';

const HOLD_MS = 500;          // 실리태번 기본 · 메모의 주인 단추와 같은 길이
const SLOP = 8;               // 이만큼(px) 움직이면 스크롤이나 끌기로 본다
const CLICK_AFTER_UP = 400;   // 손을 뗀 뒤 이 안에 오는 click 은 꾹 누르기의 끝이다
const GONE_WAIT = 150;        // 지운 뒤 채팅 다시 맞추기(render.js, 60ms 모아 보기)가 끝나기를 기다리는 시간
// 테마의 장식 테두리가 그림을 감싼 것 (decor-view.js) — 테두리 가장자리를 눌러도 그 그림으로 친다
const FRAME = '.bl-art-frame[data-bl-frame="image"]';

/** 누르는 중: { id, x, y, src, img, top, left, timer } */
let press = null;
/**
 * 꾹 눌러 창을 연 뒤: { id, up, menu } — up = 손을 뗀 시각 (아직 누르고 있으면 0), menu = 이 누르기의 길게 누르기 메뉴를 이미 막았다.
 * 새로 누르거나, 뗀 지 CLICK_AFTER_UP 이 지나면 지운다 (holding).
 */
let held = null;
/** 마지막 pointerdown 의 pointerType — contextmenu 가 폰의 길게 누르기에서 왔는지 볼 때 (그 이벤트에 pointerType 이 없는 브라우저용) */
let lastType = '';
/** 지금 눌려 있는 첫 손가락 · 버튼의 pointerId (떼면 null) — 누르기 없이 온 폰의 길게 누르기 메뉴도 그 손가락의 끝을 알게 */
let downId = null;
let viewerModule = null;

/** 크게 보기 창(viewer.js)은 설정 칸과 함께 늦게 읽힌다. 누르기 시작할 때 미리 읽어 둔다. */
function loadViewer() {
    viewerModule ??= import('./viewer.js').catch((error) => {
        viewerModule = null; // 다음에 다시 시도한다
        throw error;
    });
    return viewerModule;
}

/** 누른 자리 → 채팅 글(.mes_text) 안의 <img>. 확장 자신의 화면(.eh-root)은 빼고, 장식 테두리는 안의 그림으로 */
function imageAt(target) {
    if (!(target instanceof Element)) return null;
    let img = null;
    if (target.tagName === 'IMG') img = target;
    else if (target.tagName === 'SPAN') img = target.closest(FRAME)?.querySelector('img') ?? null;
    if (!img || !img.closest('.mes_text') || img.closest('.eh-root')) return null;
    return img;
}

function notesDragging() {
    return document.documentElement.classList.contains('bl-notes-dragging');
}

/**
 * 그림 주소 → 목록의 그 파일. 화면의 src 를 본다 (alt · data-eh-src 는 태그에 적힌 처음 이름이라, 번호 묶음이나 비슷한 그림으로
 * 바뀐 뒤에는 지금 보이는 파일과 다르다). runtime.assets 가 아니라 sources 를 본다 — 꺼 둔 프리셋의 그림도 찾게.
 */
function findAsset(src) {
    const parsed = parseCharacterUrl(src);
    if (!parsed) return null;
    // 폴더 · 파일 이름은 글자 그대로 맞춘다 (render.js 와 같이 — 화면의 그림 주소는 render.js 가 목록의 파일 주소로 맞춰 둔다)
    const source = runtime.sources.find(item => item.key === parsed.folder);
    const asset = source?.assets.find(item => item.file === parsed.file);
    return asset ? { source, asset } : null;
}

/**
 * 크게 보기 창에 넘길 목록. 창에는 runtime.sources 안의 그 객체를 그대로 넘긴다 — 사본이면 '같은 이름 파일'에 자기 자신이 끼어
 * 지우기 · 이름 바꾸기가 엉뚱한 것을 묻는다. 번호 묶음이 켜져 있으면 그 묶음의 파일들을 넘겨 옆으로 넘겨 볼 수 있게 한다
 * (설정 칸에서 그 묶음 칸을 누른 것과 같은 순서). 묶음이 꺼져 있으면 그 파일 하나.
 */
function viewerItems(src) {
    const found = findAsset(src);
    if (!found) return null;
    const items = groupsOf(found.source.key).find(group => group.members.includes(found.asset))?.members ?? [found.asset];
    return { items, start: Math.max(0, items.indexOf(found.asset)) };
}

async function open(src) {
    try {
        const { openViewer } = await loadViewer();
        // 읽는 사이 목록을 다시 읽었을 수 있다 — 지금 목록의 객체로 다시 찾는다
        const options = viewerItems(src);
        if (options) openViewer(options);
    } catch (error) {
        console.error(`[${TITLE}] 크게 보기 창을 열지 못했어요`, error);
        toast('error', '그림 창을 열지 못했어요.');
    }
}

// ── 누르는 동안만 붙이는 감시 ───────────────────────────────────

function onMove(event) {
    if (press && event.pointerId === press.id && Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP) cancel();
}

/** 스크롤 — 누른 그림이 손가락 밑에서 움직였으면 그만. (터치 스크롤이 pointercancel 을 안 보내는 경우가 있다) */
function onScroll() {
    if (!press?.img.isConnected) return; // 스트리밍으로 그림이 새로 그려졌다 — 주소로 찾으니 계속 본다
    const rect = press.img.getBoundingClientRect();
    if (Math.abs(rect.top - press.top) > SLOP || Math.abs(rect.left - press.left) > SLOP) cancel();
}

const WATCH = [['pointermove', onMove], ['scroll', onScroll]];

function cancel() {
    if (!press) return;
    clearTimeout(press.timer);
    press = null;
    for (const [type, handler] of WATCH) window.removeEventListener(type, handler, true);
    document.removeEventListener('visibilitychange', cancel);
}

function fire() {
    const { id, src } = press;
    cancel();
    if (notesDragging() || !findAsset(src)) return;
    held = { id, up: 0 };
    if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(12);
    open(src);
}

// ── 늘 붙어 있는 받기 (누르는 중이 아니면 바로 돌아간다) ──────────────

function onDown(event) {
    lastType = event.pointerType;
    if (event.isPrimary) downId = event.pointerId;
    // 창을 연 뒤 새로 누르면 더는 click 을 먹지 않는다. 새 첫 손가락(isPrimary)이면 앞 손가락은 이미 떨어진 것이다.
    if (held && (held.up || event.isPrimary)) held = null;
    if (press) {
        cancel(); // 둘째 손가락 — 확대나 두 손가락 스크롤
        return;
    }
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const img = imageAt(event.target);
    if (!img || notesDragging()) return;
    const src = img.getAttribute('src') || '';
    if (!findAsset(src)) return;
    const rect = img.getBoundingClientRect();
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, src, img, top: rect.top, left: rect.left, timer: setTimeout(fire, HOLD_MS) };
    for (const [type, handler] of WATCH) window.addEventListener(type, handler, { capture: true, passive: true });
    document.addEventListener('visibilitychange', cancel);
    loadViewer().catch(() => {}); // 실패는 열 때 알린다
}

function onUp(event) {
    if (event.pointerId === downId) downId = null;
    if (press && event.pointerId === press.id) cancel();
    if (held && !held.up && event.pointerId === held.id) held.up = Date.now();
}

/** 창을 연 누르기가 아직 이어지는지 — 누르고 있거나 뗀 지 CLICK_AFTER_UP 안. 지났으면 지운다 (뒤의 키보드 메뉴 · click 을 붙잡지 않게) */
function holding() {
    if (held?.up && Date.now() - held.up > CLICK_AFTER_UP) held = null;
    return !!held;
}

/** 창을 연 누르기의 끝에 오는 click 하나 — 누른 자리(메모 보기 · 채팅 · 북마크 카드)나 방금 뜬 창(어두운 곳 = 닫기)에 닿지 않게 */
function onClick(event) {
    if (!event.isTrusted || !holding()) return; // 스크립트가 부른 click 은 손을 뗀 끝이 아니다
    held = null;
    event.preventDefault();
    event.stopImmediatePropagation();
}

/**
 * 폰은 길게 누르면 그림 메뉴(저장 · 공유 · 렌즈)를 띄우려고 contextmenu 를 보낸다 — 대개 0.5초 타이머보다 먼저.
 * 그러면 이 신호로 바로 연다. PC 의 오른쪽 클릭도 이 길로 온다. Shift · Ctrl · Alt 를 누르고 있거나 그림이 든 글을 골라 둔 때는
 * 브라우저 메뉴를 그대로 둔다 (그림 저장 · 복사가 필요할 때).
 */
function onContextMenu(event) {
    // 타이머로 이미 열었다 — 그 누르기에 뒤늦게 오는 길게 누르기 메뉴를 한 번 막는다.
    // 누르기가 끝난 뒤(뗀 지 CLICK_AFTER_UP 넘음)의 메뉴 — 키보드 메뉴 키 · Shift+F10 등 — 는 건드리지 않는다.
    if (holding() && !held.menu) {
        held.menu = true;
        event.preventDefault();
        return;
    }
    const img = imageAt(event.target);
    if (!img) return;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || selectionHas(img)) {
        cancel(); // 브라우저 메뉴에 맡긴다 — 누르던 것이 메뉴 위로 창을 또 열지 않게
        return;
    }
    if (notesDragging()) return; // 메모 칸을 끄는 중 (메모 쪽이 메뉴를 막는다)
    const src = img.getAttribute('src') || '';
    if (!findAsset(src)) return;
    event.preventDefault();
    // 폰은 아직 누르고 있다 — 손을 뗄 때의 click 까지 먹는다. PC 오른쪽 클릭은 버튼을 뗀 뒤에 오고 click 이 따르지 않으니 남기지 않는다.
    const id = press ? press.id : (event.pointerType || lastType) !== 'mouse' ? downId : null;
    held = id === null ? null : { id, up: 0, menu: true };
    cancel();
    open(src);
}

/** 창을 연 뒤 같은 손가락으로 그림을 끌어 버리지 않게. 누르는 중에 끌기가 시작되면 꾹 누르기가 아니다. */
function onDragStart(event) {
    if (press) cancel();
    else if (holding() && !held.up) event.preventDefault();
}

function selectionHas(img) {
    const selection = window.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false;
    try {
        return selection.getRangeAt(0).intersectsNode(img);
    } catch {
        return false;
    }
}

// ── 지운 그림은 화면에서도 바로 숨긴다 ─────────────────────────
// 크게 보기 창에서 지우면(viewer.js 가 'char-assets:deleted' 를 보낸다) 채팅 · 북마크 카드 · 메모에 이미 떠 있는 그 파일의 그림을 숨긴다.
// 채팅은 목록이 바뀌면 다시 맞추기(render.js fixImages)가 번호 묶음의 다른 파일이나 비슷한 그림으로 바꿔 주지만, 바꿀 것이 없으면
// 지운 파일의 그림이 (브라우저가 받아 둔 채로) 그대로 남았다. 맞추기가 끝난 뒤에 보고, 그때도 지운 파일을 가리키는 그림만 숨긴다.
// 장식 테두리에 싸여 있으면 테두리째. 숨김은 지금 화면에서만이고, 같은 이름을 다시 올리는 등 다시 목록에 있게 되면 되살린다.
// display 는 인라인 !important 로 — hidden 속성은 그림 규칙(display:block, 테두리 안 그림은 !important)에 진다.
const shownBefore = new WeakMap();

function hideGone(folder, files) {
    const gone = new Set(files.map(file => String(file).toLowerCase()));
    const source = runtime.sources.find(item => item.key === folder);
    for (const img of document.querySelectorAll('.mes_text img')) {
        if (img.closest('.eh-root')) continue;
        const parsed = parseCharacterUrl(img.getAttribute('src') || '');
        if (!parsed || parsed.folder !== folder || !gone.has(parsed.file.toLowerCase())) continue;
        if (source?.assets.some(asset => asset.file === parsed.file)) continue; // 그 사이 같은 이름이 다시 생겼다
        for (const element of [img, img.closest(FRAME)]) {
            if (!element || element.hasAttribute('data-eh-gone')) continue;
            shownBefore.set(element, [element.style.getPropertyValue('display'), element.style.getPropertyPriority('display')]);
            element.style.setProperty('display', 'none', 'important');
            element.setAttribute('data-eh-gone', '');
        }
    }
}

function reviveGone() {
    for (const element of document.querySelectorAll('[data-eh-gone]')) {
        const img = element.tagName === 'IMG' ? element : element.querySelector('img');
        if (img && !findAsset(img.getAttribute('src') || '')) continue;
        const [value, priority] = shownBefore.get(element) ?? ['', ''];
        if (value) element.style.setProperty('display', value, priority);
        else element.style.removeProperty('display');
        element.removeAttribute('data-eh-gone');
    }
}

let installed = false;

export function setupHold() {
    if (installed) return;
    installed = true;
    const passive = { capture: true, passive: true };
    window.addEventListener('pointerdown', onDown, passive);
    window.addEventListener('pointerup', onUp, passive);
    window.addEventListener('pointercancel', onUp, passive);
    window.addEventListener('click', onClick, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('dragstart', onDragStart, true);
    // 메모 목록의 칸은 꾹 누르면(0.38초) 칸 끌기가 시작된다. 메모가 누른 자리를 물으면(notes/index.js) 목록에 있는 에셋 그림일 때
    // '여기서 맡는다'고 답해, 그 그림에서는 칸 끌기 대신 이 창이 열리게 한다. 칸의 다른 곳은 그대로 끈다.
    document.addEventListener('char-assets:hold-check', (event) => {
        const ask = event.detail;
        const img = imageAt(ask?.target);
        if (img && findAsset(img.getAttribute('src') || '')) ask.hold = true;
    });
    document.addEventListener('char-assets:deleted', (event) => {
        const { folder, files } = event.detail ?? {};
        if (folder && Array.isArray(files) && files.length) setTimeout(() => hideGone(folder, files), GONE_WAIT);
    });
    document.addEventListener('char-assets:index', () => {
        if (document.querySelector('[data-eh-gone]')) setTimeout(reviveGone, GONE_WAIT);
    });
}
