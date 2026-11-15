// 남의 확장 화면 맞춤 (1.2.x) — 확인한 확장이 깔려 있을 때만 받는 모듈이에요(index.js 가 그 확장의 설정 칸이 있을 때만 불러요 · 없으면 파일도 시트도 안 받아요).
//   ① 맞춤 시트를 확장마다 따로, 그 확장이 있을 때만 한 번 붙여요(src/ext-status.css · src/ext-elephant.css · src/ext-memoria.css) — 색 변수 → 팔레트 · 부품 값(코끼리를 생각하지마는 「색 두기」: 제 색은 두고 테마가 덮던 곳만 걷어요). style.css 에는 싣지 않아요.
//   ② 긴 설정 칸을 가로 분류 탭으로: 묶음 머리가 여럿인 설정 칸을, 그때 있는 머리를 읽어 탭 줄로 나눠 보여요.
//      · 그 확장의 요소는 옮기거나 지우거나 다시 만들지 않아요 — 묶음 번호(data-bl-tab-g)를 달고, 안 고른 묶음에 data-bl-tab-off 를 달아 CSS 로 가리기만 해요(값 저장 · 사건 처리는 그 확장 것 그대로).
//      · 묶음 머리가 둘 미만이면 아무것도 하지 않아요(원래 긴 꼴 그대로).
//   ③ 맞춘 판 안내 한 줄: 깔린 판이 확인한 판과 다르면 그 사실을 알려요(맞춤은 그대로 걸어요).
//   ④ 분류 탭 줄과 그 확장의 안쪽 탭 줄(SETS strips — 맞춤 시트가 한 줄 가로 스크롤로 바꾼 줄)을 공용 가로 탭 줄 등록부(src/tab-scroll.js)에 한 번 넣어요(← → · 휠 · 넘친 쪽 흐림 · 고른 탭 보이기).
//      등록부는 서랍 문이 열릴 때(쉴 때 · 확장 서랍) 생겨서, 없으면 다음 누름에 다시 보고 넣은 뒤로는 안 봐요.
//   ⑤ 정리한 보기(src/ext-organize.js): 탭을 만든 뒤 한 번 — 탭 한 줄 설명 · 접는 갈래(지금 값) · 숫자 2열 · 긴 설명 「자세히」 · 비용 표시 · 길잡이 · 서랍 머리의 「정리한 보기 ↔ 원작 그대로」.
//      모르는 구조면 조용히 원래 모습 그대로예요(표가 맞는 줄만 건드려요).
//   ⑥ 원작 표식(mark)이 있는 칸만: 같은 id · 클래스 이름을 쓰는 다른 확장이 있어도 원작의 표식이 든 설정 칸에만 시트 · 표식(data-bl-ext) · 안내 줄을 붙여요. 설정이 이미 탭으로 나뉜 확장은 분류 탭을 만들지 않아요.
//   ⑦ 미트볼 상태창 창 안(11-15 검수): 얼굴 바꾸기 창에 선 아이콘 고르개(fillAvaPicker) · 긴 상태창 「맨 위로」(armTop) · 설정 찾기(ext-organize renderFound) — 뒤 둘은 테마 설정 「미트볼 상태창 편의 기능」을 끄면 멈춰요.
//   감시자 · 타이머 없음: 불릴 때마다 한 번(index.js) + 문서 누름 받기 하나(잡는 단계 — 실리태번이 서랍을 펼치며 높이를 재기 전에 탭을 만들고, 확장 서랍 단추를 누르면 칸을 다시 봐요).
//   받는 조건(index.js): 확인한 확장의 설정 칸이 화면에 있을 때만. 있었던 칸 id 를 이 기기에 표시(localStorage 'bl-ext-compat')해 두고 다음 시작에는 바로 받아 첫 화면부터 시트가 붙어요 —
//     그 확장을 지우면 그다음 시작에 표시가 지워지고, 그 뒤로는 모듈도 시트도 받지 않아요. 일찍 붙이는 시트는 원작 표식을 안 보는 갈래(mark 없음)이면서 지난번에 그 칸이 있었던 것만이에요.
//   켬 조건 · 확인한 판은 아래 SETS 한 곳(index.js 의 선택자와 같은 값) · 시험: tools/tests/ext-settings-tabs.mjs · tools/tests/status-ext-css.mjs · tools/tests/ext-memory-css.mjs
//   시작 덮개 동안(이 기기 표시가 있으면 index.js 가 jQuery 준비 때 바로 불러요): 맞춤 시트는 덮개가 걷힐 때 다른 시트와 한 번에 켜고(boot-gate.js holdSheet — 여덟째 자리),
//     고른 탭을 탭 줄 안으로 굴리기(scrollIntoView — 스타일 · 배치를 그 자리에서 강제해요)는 걷힌 뒤로 미뤄요. 확장이 없으면 이 모듈을 안 받아 예전과 같아요.

import { booting, afterBoot, holdSheet } from './boot-gate.js';
import { armGuard } from './cheap-guards.js';
import { organize, toggleFold, toggleMore, setView, dismissStart, refreshSummaries, groupOfKey, renderFound, gotoHit, toggleFind } from './ext-organize.js';

/** 켬 조건 · 확인한 판(한 곳) — root: 그 확장의 설정 칸(index.js 가 「화면에 있음」을 보는 선택자) · css: 맞춤 시트 · head: 묶음 머리(내용 칸의 바로 아래 자식) · version: 판 번호가 찍힌 곳
 *  mark: 원작만 가진 요소(이것이 든 설정 칸에만 맞춰요 — 있으면 분류 탭 대신 표식 · 안내 줄만) · sheet: 판 번호를 화면에 안 적는 확장의 제 시트 첫 규칙(그 시트 옆 manifest.json 에서 판을 읽어요) */
export const SETS = [
    // 미트볼 상태창 — 2.6.1 · 2.7.0 · 2.7.1 · 2.7.2 화면에서 확인(2026-11-13 · 리그 — 2.6.1 은 재설계 앞 판에서) · 2.7.9 는 2026-11-14 리그(새 묶음 「기능 켜고 끄기」 탭 · 칩 점검 창) · 2.7.11 · 2.7.15 · 2.7.17 은 같은 날 점검 대본 대조(설정 칸 · 선택자 · 시트 그대로 · 2.7.15 는 새 묶음 「설렘 · 사건 한 스푼」 탭 · 2.7.17 은 그 묶음이 「설렘 한 스푼」으로 줄고 연락 간단하게 칸) — 리그 사진은 아직. 판이 달라도 맞춤 CSS 는 그대로 걸고, 안내 한 줄만 바뀌어요.
    //   2.7.21(11-14 · 원작이 저장소 역사를 새로 정리한 판): 점검 대본 대조 + 리그 사진(폰 384 · PC 1280 × 낮 · 밤) — 띠 · 옆 미니창이 타일 판으로 바뀜(이름이 겹친 알림 닫기 규칙을 좁힘) · 새 설정 줄 두 꼴 · 그림 글자 일곱.
    //   머리줄의 그림 글자(2.7.0 · 2.7.1 고양이 · 2.6.1 그릇)는 맞춤 시트의 선 아이콘 글꼴이 그려요(표식 없음).
    { root: '#ss-settings', css: './ext-status.css', head: 'b.ss-set-h', version: '.inline-drawer-header small', name: '미트볼 상태창', verified: ['2.6.1', '2.7.0', '2.7.1', '2.7.2', '2.7.9', '2.7.11', '2.7.15', '2.7.17', '2.7.21'],
        strips: ['.ss-scope .ss-tabs'] },   // 맞춤 시트가 「한 줄 · 스크롤바 없음」으로 바꾼 그 확장의 탭 줄 — 등록부에 넣어야 휠로 넘친 탭에 닿고, 그 확장이 판을 다시 그린 뒤에도 고른 탭이 보여요
    // 코끼리를 생각하지마 — 1.9.60 화면에서 확인(2026-11-13). 설정은 원작이 이미 탭 일곱 칸으로 나눠요.
    //   1.9.61(2026-11-14 점검 대본 대조): 바뀐 것은 백그라운드 답장의 반쪽 답을 건너뛰는 사건 처리뿐 — 화면 · CSS · 선택자 39개 · 구조 표식 8개 그대로라 맞춤도 그대로예요.
    //   1.9.64(2026-11-14 저녁 점검 대본 대조): 주요 단추 색이 갈색(제 색 변수) · 설정 숫자 칸 셋 · 움직임 줄이기 규칙 — 깨진 선택자 0 · 새 AI 요청 길 0 이라 맞춤 그대로예요.
    //   1.9.66(2026-11-15 점검 대본 대조 · 1.9.65 를 덮는 판): 요약 언어를 요청 끝에 다시 알림 · 기억을 요약 언어로 맞추기(더보기 메뉴 한 줄) · 되감은 요약은 회상에서 뺌(보관함 칩 하나) — 원작 CSS 안 바뀜 · 선택자 39 · 구조 표식 8/8 그대로예요.
    //   「색 두기」 안: 그 확장의 제 색 · 글꼴은 그대로 — 설정 내용 칸(native)에 「원래 색 유지」 표식을 붙여 테마 색 규칙이 비켜 가게 하고, 낮밤 표식(mode)을 테마 밝기에 다시 맞춰요.
    { root: '#lm_settings', mark: '.lm-switch-track', css: './ext-elephant.css', sheet: '.lm-root', native: '.inline-drawer-content', mode: true, name: '코끼리를 생각하지마', verified: ['1.9.60', '1.9.61', '1.9.64', '1.9.66'] },
    // Memoria — 2.0.4 화면에서 확인(2026-11-13). 원작이 실리태번 색 변수를 따라가서 선 · 머리줄만 맞춰요.
    //   2.1.0(2026-11-14 점검 대본 대조): 설정 「기본」에 같은 꼴의 숫자 칸 하나(묶어 기록 · .memoria__field) — 선택자 9개 · 구조 표식 3개 · CSS 그대로라 맞춤도 그대로예요. 리그 사진은 아직.
    { root: '#memoria_settings', mark: '.memoria__version', css: './ext-memoria.css', version: '.memoria__version', name: 'Memoria', verified: ['2.0.4', '2.1.0'] },
];
export const FIRST_TAB = '기본';
const NAV = 'bl-ext-tabs', TAB = 'bl-ext-tab', NOTE = 'bl-ext-compat';
const STRIP = Symbol.for('blue-lemonade.tab-scroll.v1');   // 공용 가로 탭 줄 등록부(src/tab-scroll.js 의 KEY 와 같은 값)

/** 머리 글자(안의 작은 덧글 · 아이콘은 뺌) */
export function headLabel(head) {
    let text = '';
    for (const node of head.childNodes) if (node.nodeType === 3) text += node.nodeValue;
    return (text.replace(/\s+/g, ' ').trim() || String(head.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 24);
}
/** 판 글자에서 번호만 */
export const versionOf = text => (String(text || '').match(/\d+(?:\.\d+){1,3}/) || [''])[0];
/** 안내 한 줄 — 깔린 판을 못 읽으면 맞는 판처럼 적지 않아요 */
export function compatText(set, installed) {
    const known = set.verified.join(' · ');
    if (!installed) return `${set.name} ${known} 화면에 맞춘 모습이에요(지금 판은 읽지 못했어요).`;
    if (set.verified.includes(installed)) return `블루레몬에이드가 ${set.name} ${installed} 화면에 맞춰 뒀어요.`;
    return `${set.name} ${known} 화면에 맞춘 모습이에요 · 지금 판은 ${installed} — 일부가 어긋나 보일 수 있어요.`;
}

const keyOf = root => `bl-ext-tab:${root.id || 'x'}`;
function remember(root, label) { try { localStorage.setItem(keyOf(root), label); } catch { /* 저장소가 막혀 있으면 첫 탭 */ } }
function recall(root) { try { return localStorage.getItem(keyOf(root)) || ''; } catch { return ''; } }

/** 고른 탭을 탭 줄 안으로 — 시작 덮개 동안이면 걷힌 뒤 한 번(그때도 고른 탭이면) */
const revealWaiting = new Set();
const SCROLL = { block: 'nearest', inline: 'nearest' };
const CENTER = { block: 'center', inline: 'nearest' };
function revealLater() {
    const list = [...revealWaiting];
    revealWaiting.clear();
    for (const tab of list) if (tab.isConnected !== false && tab.classList.contains('active')) tab.scrollIntoView?.(SCROLL);
}
function revealTab(tab) {
    if (booting(tab.ownerDocument)) { revealWaiting.add(tab); afterBoot(revealLater); return; }
    tab.scrollIntoView?.('blHit' in (tab.dataset || {}) ? CENTER : SCROLL);   // 설정 찾기가 찾은 줄(data-bl-hit)은 화면 가운데로 — 굴리기는 이 한 곳
}

/** 고른 묶음만 보이게 (index: 0 = 머리 없는 앞머리) */
export function showGroup(root, index) {
    const nav = root.querySelector(`.${NAV}`);
    if (!nav) return;
    const want = String(index);
    for (const tab of nav.children) {
        const on = tab.dataset.blTabTo === want;
        tab.classList.toggle('active', on);
        tab.setAttribute('aria-selected', String(on));
        if (on) revealTab(tab);
    }
    for (const child of nav.parentElement.children) {
        if (!('blTabG' in child.dataset)) continue;
        if (child.dataset.blTabG === want) delete child.dataset.blTabOff; else child.dataset.blTabOff = '';
    }
    root.dataset.blTabs = want;
}

/** 한 칸에 탭 줄을 만들어요 — 이미 있으면 그대로, 머리가 모자라면 아무것도 안 해요. 만들었으면 true */
export function buildTabs(root, set) {
    const content = root.querySelector('.inline-drawer-content');
    if (!content || content.querySelector(`:scope > .${NAV}`)) return false;
    const heads = [...content.querySelectorAll(`:scope > ${set.head}`)];
    if (heads.length < 2) return false;
    const doc = root.ownerDocument;
    const labels = [FIRST_TAB];
    let group = 0;
    for (const child of content.children) {
        if (heads.includes(child)) { group += 1; labels.push(headLabel(child)); }
        child.dataset.blTabG = String(group);
    }
    const nav = doc.createElement('nav');
    nav.className = NAV;
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', `${set.name} 설정 분류`);
    nav.style.display = 'none';   // 테마가 켜져 있을 때만 CSS 가 보여요(src/ext-status.css) — 테마를 끄면 탭 줄 없이 원래 긴 꼴
    labels.forEach((label, i) => {
        const tab = doc.createElement('button');
        tab.type = 'button'; tab.className = TAB; tab.setAttribute('role', 'tab');
        tab.dataset.blTabTo = String(i); tab.dataset.blTabName = label; tab.textContent = label;   // 이름은 표식에도 — 그 확장의 화면 번역이 탭 글자를 바꿔도 기억은 원래 이름으로
        nav.append(tab);
    });
    content.prepend(nav);
    const note = doc.createElement('small');
    note.className = NOTE;
    note.style.display = 'none';
    note.textContent = compatText(set, versionOf(root.querySelector(set.version)?.textContent));
    content.append(note);
    const saved = labels.indexOf(recall(root));
    showGroup(root, saved > 0 ? saved : 0);
    return true;
}

/** 얼굴 고르개(11-15 검수 · 미트볼 상태창 2.7.21): 그 확장의 「얼굴 바꾸기」 창은 고르개 자리에 글자(「[object …]」)만 나와요 — 그 자리에 테마 선 아이콘 고르개를 놓아요.
 *  고른 값은 그 확장의 입력칸에 그 그림 글자를 적을 뿐이에요(저장 · 그리기는 그 확장 것 그대로 · 얼굴 동그라미는 맞춤 시트의 선 아이콘 글꼴이 그려요).
 *  표: [코드 포인트, 읽어 주는 이름] — 전부 선 아이콘 글꼴 표(src/ext-status-icons.json)에 있는 그림이에요. 동물 열여섯은 그 확장이 이름으로 정해 주는 얼굴과 같은 글자예요. */
export const AVA_PICKS = [
    [0x1F431, '고양이'], [0x1F436, '강아지'], [0x1F98A, '여우'], [0x1F43B, '곰'], [0x1F430, '토끼'], [0x1F43C, '판다'], [0x1F438, '개구리'], [0x1F427, '펭귄'],
    [0x1F981, '사자'], [0x1F42F, '호랑이'], [0x1F428, '코알라'], [0x1F439, '햄스터'], [0x1F989, '부엉이'], [0x1F43A, '늑대'], [0x1F99D, '너구리'], [0x1F42E, '소'],
    [0x1F432, '용'], [0x1F988, '상어'], [0x1F419, '문어'], [0x1F98B, '나비'], [0x1F338, '꽃'], [0x1F340, '네잎클로버'], [0x2B50, '별'], [0x1F319, '달'],
    [0x1F525, '불꽃'], [0x2744, '눈꽃'], [0x2615, '찻잔'], [0x2693, '닻'], [0x1F451, '왕관'], [0x1F3A9, '모자'], [0x1F5E1, '단검'], [0x1F380, '리본'],
];
/** 얼굴 바꾸기 창에 고르개를 놓아요 — input: 그 창의 입력칸(.popup-input). 놓았으면(또는 원작 고르개가 있어 표식만 달았으면) true */
export function fillAvaPicker(input, who = '') {
    const dlg = input?.closest?.('dialog.popup'), box = dlg?.querySelector('.popup-content');
    if (!dlg || !box || dlg.classList.contains('ss-dlg') || box.querySelector('.bl-ext-avapick')) return false;
    dlg.classList.add('bl-ext-avadlg');
    if (box.querySelector('.ss-emopick')) return true;   // 원작이 제 고르개를 그리는 판 — 시트가 같은 꼴로 맞춰요
    const doc = dlg.ownerDocument, hint = doc.createElement('p'), grid = doc.createElement('div');
    hint.className = 'bl-ext-avahint'; hint.textContent = `${who ? `${who}의 ` : ''}얼굴로 쓸 그림을 골라요. 칸을 비우고 저장하면 이름에 따라 정해져요.`;
    grid.className = 'bl-ext-avapick'; grid.setAttribute('role', 'listbox'); grid.setAttribute('aria-label', '얼굴 그림');
    const now = String(input.value || '').replace(/\uFE0F/g, '');
    for (const [cp, name] of AVA_PICKS) {
        const ch = String.fromCodePoint(cp), b = doc.createElement('button');
        b.type = 'button'; b.dataset.blAva = ch; b.textContent = ch; b.title = name; b.setAttribute('aria-label', name); b.setAttribute('role', 'option');
        if (now === ch) b.classList.add('on');
        grid.append(b);
    }
    // 창에 글자로 찍힌 「[object …]」 줄(그 확장의 요소가 아니라 글자 덩이)이 있으면 그 자리에, 없으면 내용 칸 끝에
    const junk = [...box.childNodes].find(node => node.nodeType === 3 && /\[object \w+\]/.test(node.nodeValue));
    if (junk) { junk.before(hint, grid); junk.data = ''; } else box.append(hint, grid);
    return true;
}
/** 긴 상태창 「맨 위로」(편의 기능): 그 창의 내용 칸에 스크롤 받기 하나 — 한 화면 넘게 내렸을 때만 표식(data-bl-top)을 달고, 단추는 그때 한 번 만들어요 */
export function armTop(dlg) {
    const pane = dlg.querySelector('.popup-content');
    if (!pane || dlg.dataset.blTopArmed) return false;
    dlg.dataset.blTopArmed = '1';
    pane.addEventListener('scroll', () => {
        const on = pane.scrollTop > pane.clientHeight;
        if (on === dlg.hasAttribute('data-bl-top')) return;
        dlg.toggleAttribute('data-bl-top', on);
        if (on && !dlg.querySelector(':scope > .bl-ext-top')) { const b = dlg.ownerDocument.createElement('button'); b.type = 'button'; b.className = 'bl-ext-top'; b.title = '맨 위로'; b.setAttribute('aria-label', '맨 위로'); dlg.append(b); }
    }, { passive: true });
    return true;
}
/** 얼굴을 이름 첫 글자로(1.5.1 사용자 「아이콘으로 뜨니까 누가 누군지 알 수가 없다」 · 테마 설정 「미트볼 얼굴 표시」): 그 확장은 얼굴 요소의 title 에 이름을 적어요.
 *  첫 글자 = 괄호 안 별칭을 떼고, 맨 앞의 글자 아닌 것(그림 글자 · 기호 · 공백)을 건너뛴 첫 글자(영문은 대문자). 첫 글자가 같은 사람이 둘 이상이면 그 사람들만 둘째 글자까지. */
const LETTERS = name => [...String(name || '').replace(/^\s*[(（\[【][^)）\]】]*[)）\]】]\s*/u, '').replace(/\s*[(（\[【].*$/u, '')].filter(ch => /[\p{L}\p{N}]/u.test(ch));
export function initialOf(name, n = 1) {
    const ls = LETTERS(name).length ? LETTERS(name) : [...String(name || '')].filter(ch => /[\p{L}\p{N}]/u.test(ch));
    return ls.slice(0, n).map(ch => /[a-z]/i.test(ch) ? ch.toUpperCase() : ch).join('') || '?';
}
export function initialsFor(names) {
    const uniq = [...new Set(names.map(String))], count = new Map();
    for (const name of uniq) { const k = initialOf(name); count.set(k, (count.get(k) || 0) + 1); }
    return new Map(uniq.map(name => [name, count.get(initialOf(name)) > 1 ? initialOf(name, 2) : initialOf(name)]));
}
export const FACE_TONES = 4;
export const toneOf = name => { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 9973; return h % FACE_TONES; };
const FACES = ':is(.ss-ava.emo, .ss-tf)[title]';
/** 1.5.2 보이는 이름으로: 그 확장의 「화면만 번역」은 글자 마디만 바꾸고 얼굴 title 은 영어 원문이에요 — 번역 메우기(ext-bridge-tr.js)가 그 확장의 사전 바꾸기를 여기 걸어
 *  첫 글자가 화면의 한국어 이름을 따라가요. 톤은 원문 이름으로(번역이 바뀌어도 사람 색이 그대로). 걸린 게 없으면 원문 그대로. */
let faceName = name => name;
export function setFaceName(fn) { faceName = typeof fn === 'function' ? fn : (name => name); }
const shownName = name => { try { const out = faceName(name); return typeof out === 'string' && out.trim() ? out : name; } catch { return name; } };
/** 화면의 얼굴 요소 전부에 첫 글자 · 톤 표식 — 설정이 「아이콘」이면 아무것도 안 해요(표식이 남아 있어도 시트가 안 봐요) */
export function paintFaces(doc) {
    if (!doc?.body?.hasAttribute?.('data-bl-mb-face')) return 0;
    const els = [...doc.querySelectorAll(FACES)];
    const names = els.map(el => el.getAttribute('title')), shown = names.map(shownName);
    const map = initialsFor(shown);
    els.forEach((el, k) => { const ini = map.get(String(shown[k])); if (el.getAttribute('data-bl-ini') !== ini) el.setAttribute('data-bl-ini', ini); const tone = String(toneOf(names[k])); if (el.getAttribute('data-bl-tone') !== tone) el.setAttribute('data-bl-tone', tone); });
    return els.length;
}
/** 미트볼 「꾸미기」 창에 테마 칸 끼우기(1.5.2 사용자 「블루레몬에 넣지 말고 미트볼 꾸미기 쪽에」): 「크기 · 모양」 묶음 바로 아래에 「블루레몬 꾸미기」 묶음 하나 —
 *  글꼴(누르면 테마 글꼴 고르개가 열려요) · 얼굴 표시(아이콘 / 이름 첫 글자) · 사람마다 색 톤. 그 확장의 묶음 · 줄 · 고르기 · 스위치 class 를 그대로 써요.
 *  값은 테마 설정에만 저장해요(그 확장 설정에는 안 써요). 그 확장이 창을 다시 그릴 때마다 다시 끼워요(같은 0.001초 신호 · 감시자 없음). 지금 값은 테마가 body · 문서에 걸어 둔 표식에서 읽어요. */
export function decoState(doc) {
    const face = doc.body?.getAttribute?.('data-bl-mb-face');
    let font = ''; try { font = String(doc.defaultView.getComputedStyle(doc.documentElement).getPropertyValue('--salty-font-mb') || '').trim(); } catch { /* 따라가기로 */ }
    const own = !!font && font !== 'initial';
    return { face: face ? 'initial' : 'icon', tone: face === 'tone', font: own ? (font.split(',')[1] || font).replace(/['"]/g, '').trim() : '' };
}
export function decoTheme(tw) {
    const doc = tw?.ownerDocument; if (!doc || doc.body?.hasAttribute?.('data-bl-ext-raw')) return false;
    let box = tw.querySelector(':scope > .bl-ext-deco');
    if (!box) {
        const after = [...tw.querySelectorAll(':scope > .ss-sec')].find(sec => /^크기/.test(sec.querySelector('h4')?.textContent || '')) || [...tw.querySelectorAll(':scope > .ss-sec')].at(-1);
        if (!after) return false;
        box = doc.createElement('section'); box.className = 'ss-sec bl-ext-deco';
        after.after(box);
    }
    const st = decoState(doc);
    // 테마가 끼운 묶음 안만 새로 그려요(그 확장의 요소는 그대로) — 글자열로 끼우지 않고 요소를 하나씩 만들어요
    const h = (tag, cls, text, attrs) => { const el = doc.createElement(tag); if (cls) el.className = cls; if (text) el.textContent = text; for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); return el; };
    const kids = (el, ...list) => { for (const k of list) if (k) el.append(k); return el; };
    const head = kids(h('div', 'ss-sec-h'), kids(h('h4'), h('i', 'bl-ext-lemon', '', { 'aria-hidden': 'true' }), doc.createTextNode('블루레몬 꾸미기 '), h('small', '', '테마가 더한 칸 · 미트볼 상태창에만 걸려요')));
    const font = kids(h('div', 'ss-f wide'), h('span', '', '글꼴'), h('button', 'ss-btn sm bl-ext-deco-act', `${st.font ? '따로 고른 글꼴' : '테마 글꼴 따라가기'} · 고르기`, { type: 'button', 'data-bl-deco': 'font' }));
    const face = kids(h('div', 'ss-f wide'), h('span', '', '얼굴 표시'), kids(h('div', 'ss-seg'), h('button', st.face === 'icon' ? 'bl-ext-deco-act on' : 'bl-ext-deco-act', '아이콘', { type: 'button', 'data-bl-deco': 'face:icon' }), h('button', st.face === 'initial' ? 'bl-ext-deco-act on' : 'bl-ext-deco-act', '이름 첫 글자', { type: 'button', 'data-bl-deco': 'face:initial' })));
    let tone = null;
    if (st.face === 'initial') { const input = h('input', 'ss-switch bl-ext-deco-act', '', { type: 'checkbox', 'data-bl-deco': 'tone' }); input.checked = st.tone; tone = kids(h('div', 'ss-pills'), kids(h('label', 'ss-tog'), input, h('span', '', '사람마다 색 톤'))); }
    box.textContent = ''; box.append(head, font, face, ...(tone ? [tone] : []));   // 테마가 끼운 묶음 안만 비우고 다시 채워요
    if (st.font) fontLabel().then(name => { const b = box.querySelector('[data-bl-deco="font"]'); if (b && name) b.textContent = `${name} · 바꾸기`; }).catch(() => { /* 「따로 고른 글꼴」 그대로 */ });
    return true;
}
/** 고른 미트볼 글꼴의 이름(테마 설정 · 글꼴 목록에서 — 꾸미기 창을 그릴 때만 받아요) */
export async function fontLabel(load = () => Promise.all([import('./settings.js'), import('./fonts.js')])) {
    const [settings, fonts] = await load();
    const set = settings.getSettings()?.fonts?.mb;
    if (!set || set === 'same') return '';
    const id = typeof set === 'string' ? set : set.ko;
    return fonts.findFont(id)?.label || String(id || '');
}
/** 끼운 칸 누름: 테마 설정을 바꿔요(설정 창 모듈의 updateSettings — 누를 때만 받아요) · 글꼴은 테마 설정 창을 그 칸만 보이게 열어요 */
export async function decoAct(el, load = () => import('./panel.js')) {
    const act = el?.getAttribute?.('data-bl-deco'); const doc = el?.ownerDocument; if (!act || !doc) return false;
    if (act === 'font') { doc.defaultView?.Salty?.openPopup?.(false, 'mb-deco'); return true; }
    const panel = await load();
    if (act === 'tone') panel.updateSettings(st => { st.chat.mbFaceTone = !!el.checked; });
    else if (act.startsWith('face:')) panel.updateSettings(st => { st.chat.mbFace = act.slice(5) === 'initial' ? 'initial' : 'icon'; });
    const tw = el.closest('.ss-tw'); if (tw) decoTheme(tw);
    return true;
}
let facesQueued = false;
/** 띠 한 줄(1.5.1 사용자 「줄이면 알아서 한 줄」): 폰 타일 판(네 칸)에서 마지막 줄의 오른쪽 need 칸이 비어 있는지 — 타일 자리는 그 확장이 인라인 style 에 적어요(배치를 재지 않아요).
 *  tiles: [{ c, r, w, h }](1 부터) */
export function actsFit(tiles, cols = 4, need = 2) {
    if (!tiles.length || need > cols) return false;
    const last = Math.max(...tiles.map(t => t.r + t.h - 1));
    return !tiles.some(t => t.r <= last && t.r + t.h - 1 >= last && t.c + t.w - 1 > cols - need);
}
const SPAN = /^\s*(\d+)\s*\/\s*span\s+(\d+)/;
export function fitActs(tb) {
    const tg = tb.querySelector?.('.ss-tg'), acts = tb.querySelector?.('.ss-tb-acts');
    let fit = false;
    if (tg && acts && !tb.classList.contains('editing') && Number(tg.style.getPropertyValue('--cols')) === 4 && !tb.querySelector('.ss-t-det')) {
        const tiles = [];
        for (const t of tg.querySelectorAll(':scope > .ss-t')) { const c = SPAN.exec(t.style.gridColumn || t.style.gridColumnStart + ' / ' + t.style.gridColumnEnd), r = SPAN.exec(t.style.gridRow || t.style.gridRowStart + ' / ' + t.style.gridRowEnd); if (!c || !r) { tiles.length = 0; break; } tiles.push({ c: +c[1], w: +c[2], r: +r[1], h: +r[2] }); }
        fit = actsFit(tiles, 4, acts.children.length > 5 ? 3 : 2);
    }
    if (fit) tb.setAttribute('data-bl-acts', 'in'); else tb.removeAttribute('data-bl-acts');
    return fit;
}
/** 띠 종(알림함)의 숫자 배지(1.5.2 사용자 결정): 10 이상은 화면에서만 「9+」 — 배지가 늘 한 자리 크기라 종을 덜 가려요. 그 확장이 적은 글자(실제 숫자)는 그대로 두고
 *  표시용 글자를 표식(data-bl-n)에 적어 시트가 그려요(한 자리 숫자도 — 시트가 글자 잉크를 배지 가운데에 놓으려면 제 상자가 있는 글자여야 해요). 정확한 숫자는 배지의 설명(title)에 남겨요. 띠가 다시 그려질 때마다 다시 맞춰요. */
export const badgeLabel = text => { const s = String(text || '').trim(); const n = parseInt(s, 10); return !Number.isFinite(n) || n < 1 ? '' : (n >= 10 || /\+$/.test(s)) ? '9+' : String(n); };   // 1 ~ 9 는 그 숫자 · 10 이상과 「99+」는 「9+」 · 숫자가 아니면 표식 없음
export function markBadge(tb) {
    let n = 0;
    for (const b of tb.querySelectorAll?.('.ss-tb-acts .ss-t.ic > b.al') || []) {
        const label = badgeLabel(b.textContent);
        if (label) { b.setAttribute('data-bl-n', label); if (label === '9+') { b.setAttribute('title', `알림 ${String(b.textContent).trim()}개`); n++; } else if (b.hasAttribute?.('title')) b.removeAttribute('title'); } else if (b.hasAttribute?.('data-bl-n')) { b.removeAttribute('data-bl-n'); b.removeAttribute('title'); }
    }
    return n;
}
/** 이름표 → 값 목록(프로필 · 관계 · 장소): 값이 긴 칸(열세 자 넘거나 줄바꿈 — 폰 반 폭에 한 줄로 안 들어가는 길이)에 표식 — 두 단을 가로질러 통째 한 줄(src/ext-status.css). 글자 수만 봐요(배치를 재지 않아요) */
export const LONG_VALUE = 13;
export function markLong(dl) {
    let n = 0;
    for (const dd of dl.querySelectorAll?.(':scope > dd') || []) {
        const text = (dd.textContent || '').trim(), long = text.length > LONG_VALUE || /[\r\n]/.test(text);
        const dt = dd.previousElementSibling?.tagName === 'DT' ? dd.previousElementSibling : null;
        for (const el of [dd, dt]) if (el) { if (long) el.setAttribute('data-bl-long', ''); else el.removeAttribute('data-bl-long'); }
        if (long) n++;
    }
    return n;
}
const plain = doc => !!doc.body?.hasAttribute?.('data-bl-mb-plain');   // 테마 설정 「미트볼 상태창 편의 기능」을 끈 때(src/apply.js 가 달아요)

/** 탭을 만든 뒤에 끼어든 줄은 첫 탭 것으로(11-15 검수): 테마의 「확장 탭에 보이기」 줄(src/headswitch.js)은 내용 칸 맨 앞에 끼워져요 — 탭보다 먼저 끼워지면 첫 탭 번호를 받지만,
 *  탭보다 늦게 끼워지면 번호가 없어 모든 탭 위에 보였어요(탭마다 세로로 35 · 리그 사진 — 시작 차례에 따라 달라지던 것). 번호 없는 줄에 첫 탭 번호를 달고, 지금 다른 탭이면 가려요.
 *  분류 탭 줄 · 정리한 보기가 끼운 것(bl-ext-*)은 그대로 둬요(늘 보이거나 제 번호가 있어요). 돌려줌: 번호를 단 줄 수 */
export function adoptStray(root) {
    const nav = root.querySelector(`.${NAV}`);
    if (!nav) return 0;
    let n = 0;
    for (const child of nav.parentElement.children) {
        if ('blTabG' in child.dataset || /(^|\s)bl-ext-/.test(String(child.className || ''))) continue;
        child.dataset.blTabG = '0';
        if ((root.dataset.blTabs || '0') !== '0') child.dataset.blTabOff = '';
        n++;
    }
    return n;
}

const installed = new Map();   // 판을 화면에 안 적는 확장: manifest.json 에서 읽은 판(한 번)
/** 안내 한 줄을 내용 칸 끝에(있으면 글만 다시) — 원작이 판 번호를 늦게 채우는 칸이 있어 부를 때마다 글을 맞춰요 */
export function addNote(root, set) {
    const content = root.querySelector('.inline-drawer-content');
    if (!content) return null;
    let note = content.querySelector(`:scope > .${NOTE}`);
    if (!note) {
        note = root.ownerDocument.createElement('small');
        note.className = NOTE;
        note.style.display = 'none';   // 테마가 켜져 있을 때만 CSS 가 보여요
        content.append(note);
    }
    const text = compatText(set, installed.get(set) || versionOf(set.version && root.querySelector(set.version)?.textContent));
    if (note.textContent !== text) note.textContent = text;
    return note;
}
/** 판을 화면에 안 적는 확장: 그 확장의 시트(첫 규칙으로 알아봐요) 옆 manifest.json 을 한 번 읽어 안내 줄을 맞춰요 */
export async function readVersion(doc, set, root) {
    if (!set.sheet || installed.has(set)) return;
    installed.set(set, '');
    try {
        const sheet = [...doc.styleSheets].find(s => { try { return /\/third-party\//.test(s.href || '') && s.cssRules[0]?.selectorText === set.sheet; } catch { return false; } });
        if (!sheet) return;
        const manifest = await (await fetch(new URL('manifest.json', sheet.href))).json();
        installed.set(set, versionOf(manifest?.version));
        addNote(root, set);
    } catch { /* 못 읽으면 확인한 판만 적어요 */ }
}

/** 맞춤 시트를 한 번만 붙여요 */
export function attachSheet(doc, set, base = import.meta.url) {
    const id = `bl-ext-css-${set.root.replace(/[^\w-]/g, '')}`;
    if (!set.css || doc.getElementById(id)) return false;
    const link = doc.createElement('link');
    link.id = id; link.rel = 'stylesheet'; link.href = new URL(set.css, base).href;
    (doc.head || doc.documentElement).append(link);
    holdSheet(link);   // 시작 덮개(불투명) 동안이면 꺼 둔 채로 — 걷힐 때 다른 시트와 한 번에 켜요(덮개가 없거나 비치거나 다른 문서면 아무 일도 없어요)
    return true;
}

let strip = false;
/** 분류 탭 줄을 공용 가로 탭 줄 등록부에 한 번만 넣어요 — 등록부가 아직 없으면 false(다음 누름에 다시), 넣었으면 true(그 뒤로는 등록부를 보지 않아요) */
export function ensureStrip(doc) {
    if (strip) return true;
    try {
        const api = doc[STRIP];
        if (typeof api?.add !== 'function') return false;
        api.add([`.${NAV}`, ...SETS.flatMap(set => set.strips || [])]);   // 이미 있는 탭 줄은 바로 묶고, 그 뒤에 생기는 탭 줄(그 확장이 설정 칸 · 판을 다시 그린 때)은 등록부가 스스로 묶어요
        strip = true;
    } catch { /* 등록부가 깨져 있으면 가로 스크롤만 */ }
    return strip;
}

const NATIVE = 'blNativeExtColors';   // data-bl-native-ext-colors — 테마 색 규칙이 비켜 가는 표식(src/extension-colors.js 와 같은 이름 · 그 모듈은 제가 붙인 것만 떼요)
/** 그 확장이 본문 글자 밝기로 고르는 낮밤 표식(data-lm-mode)을 지금 테마 밝기에 다시 맞춰요 — 원작은 채팅을 열기 전에는 표식을 안 붙이고, 팔레트를 바꿔도 상태를 갱신할 때까지 옛 값이에요.
 *  원작과 같은 잣대(본문 글자 밝기 > 0.5 이면 밤)라 원작이 다시 매겨도 같은 값이에요. 테마가 꺼져 있으면 손대지 않아요. */
export function syncMode(doc, root) {
    try {
        const body = doc.body;
        if (!body?.classList?.contains('salty')) return '';
        const m = String((doc.defaultView || globalThis).getComputedStyle(body).color || '').match(/\d+(\.\d+)?/g);
        if (!m) return '';
        const [r, g, b] = m.map(Number);
        const mode = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5 ? 'night' : 'day';
        if (root.dataset.lmMode !== mode) root.dataset.lmMode = mode;
        return mode;
    } catch { return ''; }
}
/** 「색 두기」: 그 확장의 설정 내용 칸에 「원래 색 유지」 표식(이미 있으면 그대로) */
export function keepNative(root, set) {
    if (!set.native) return 0;
    let n = 0;
    for (const part of root.querySelectorAll(set.native)) if (!(NATIVE in part.dataset)) { if (!n) armGuard('ext'); part.dataset[NATIVE] = ''; n++; }   // 1.4.x 최적화 3차: 표식 전에 지킴 갈래를 원래 꼴로(src/cheap-guards.js)
    return n;
}

export function buildAll(doc) {
    for (const set of SETS) {
        const root = doc.querySelector(set.root);
        if (!root) continue;
        if (!set.mark) {
            attachSheet(doc, set); buildTabs(root, set); adoptStray(root);
            // 정리한 보기: 탭이 있을 때만 · 한 번만. 구조를 모르면(다른 판 · 시험 DOM) 아무것도 안 하고 원래 모습 그대로
            try { if ('blTabs' in root.dataset && organize(root, set)) showGroup(root, Number(root.dataset.blTabs) || 0); } catch { /* 원래 모습 그대로 */ }
            continue;
        }
        if (!root.querySelector(set.mark)) continue;   // 이름만 같은 다른 확장의 칸
        attachSheet(doc, set);
        root.dataset.blExt = '';
        keepNative(root, set);
        if (set.mode) syncMode(doc, root);
        addNote(root, set);
        readVersion(doc, set, root);
    }
}
/** 지난번에 설정 칸이 있었던 확장(index.js 가 남긴 이 기기 표시 — 칸 id 를 띄어 적어요 · 옛 판의 '1' 은 미트볼 상태창 하나였어요) */
export function seenBefore(set, mark) {
    const id = set.root.replace(/^#/, ''), list = String(mark || '').split(' ');
    return list.includes(id) || (mark === '1' && id === 'ss-settings');
}

let started = false;
/** 여러 번 불러도 돼요 — 누름 감시자 · 시트는 한 번, 칸 찾기(탭)와 등록부 넣기는 부를 때마다 */
export function startExtCompat(doc = globalThis.document) {
    if (!doc?.addEventListener) return;
    if (!started) {
        started = true;
        let mark = ''; try { mark = localStorage.getItem('bl-ext-compat') || ''; } catch { /* 저장소가 막혀 있으면 칸을 찾은 뒤에 붙여요 */ }
        for (const set of SETS) if (!set.mark && seenBefore(set, mark)) attachSheet(doc, set);   // 지난번에 있었던 확장의 시트는 설정 칸이 그려지기 전에 먼저(첫 화면에 원작 흰 띠가 비치지 않게) — 원작 표식을 봐야 하는 갈래는 칸을 찾은 뒤에만
        // 탭 누름 + 머리줄 · 확장 서랍 단추를 누를 때 칸 다시 찾기 — 문서 단위 누름 하나(잡는 단계 · 막거나 멈추지 않아요)
        doc.addEventListener('click', event => {
            const target = event.target;
            if (!strip) ensureStrip(doc);   // 그 확장의 판(안쪽 탭 줄)은 설정 서랍을 거치지 않고도 열려요 — 등록부가 생긴 뒤 첫 누름에 넣어요(넣은 뒤로는 안 봐요)
            if (!target?.closest) return;
            { const deco = target.closest('.bl-ext-deco-act'); if (deco && deco.tagName !== 'INPUT') decoAct(deco).catch(() => { /* 설정 창 모듈을 못 받으면 그대로 */ }); }   // 미트볼 꾸미기 창에 끼운 테마 칸
            const tab = target.closest(`.${TAB}`);
            if (tab) {
                const root = SETS.map(set => tab.closest(set.root)).find(Boolean);
                if (root) { showGroup(root, Number(tab.dataset.blTabTo) || 0); remember(root, tab.dataset.blTabName || tab.textContent); }
                ensureStrip(doc);
                return;
            }
            // 미트볼 상태창 창 안: 얼굴 고르개 · 「맨 위로」 — 창(dialog)에서 난 누름일 때만 봐요
            const dlg = target.closest('dialog');
            if (dlg) {
                const pick = target.closest('.bl-ext-avapick > button');
                if (pick) {   // 고른 그림 글자를 그 창의 입력칸에 적어요(저장은 그 확장의 「저장」 단추가 해요)
                    const input = dlg.querySelector('.popup-input');
                    if (input) { input.value = pick.dataset.blAva || ''; for (const other of pick.parentElement.children) other.classList.toggle('on', other === pick); }
                    return;
                }
                if (target.closest('.bl-ext-top')) { const pane = dlg.querySelector('.popup-content'); if (pane) pane.scrollTop = 0; return; }
                if (dlg.classList.contains('ss-dlg')) {
                    if (!plain(doc)) armTop(dlg);
                    const ava = target.closest('.ss-ava-btn');
                    if (ava && !doc.body.hasAttribute('data-bl-ext-raw')) {   // 얼굴 바꾸기 창은 입력칸에 초점이 올 때 열린 것을 알아요(타이머 없이) — 그때 한 번 고르개를 놓고 받기를 떼요
                        const who = ava.dataset.arg || '', since = Date.now();
                        const onFocus = e => {
                            const input = e.target;
                            if (Date.now() - since > 4000) { doc.removeEventListener('focusin', onFocus, true); return; }
                            if (!input?.classList?.contains('popup-input')) return;
                            doc.removeEventListener('focusin', onFocus, true);
                            try { fillAvaPicker(input, who); } catch { /* 원래 창 그대로 */ }
                        };
                        doc.addEventListener('focusin', onFocus, true);
                    }
                }
            }
            // 정리한 보기의 단추들: 갈래 펼침 · 자세히 · 보기 스위치 · 길잡이
            const own = target.closest('.bl-ext-fold') || target.closest('.bl-ext-more') || target.closest('.bl-ext-view') || target.closest('.bl-ext-jump') || target.closest('.bl-ext-start-x') || target.closest('.bl-ext-hit') || target.closest('.bl-ext-findbtn');
            if (own) {
                const root = SETS.map(set => own.closest(set.root)).find(Boolean);
                const has = name => own.classList.contains(name);
                if (!root) return;
                if (has('bl-ext-fold')) toggleFold(root, own);
                else if (has('bl-ext-more')) toggleMore(root, own);
                else if (has('bl-ext-start-x')) dismissStart(root);
                else if (has('bl-ext-jump')) { const group = groupOfKey(root, own.dataset.blJump); if (group >= 0) showGroup(root, group); }
                else if (has('bl-ext-hit')) { const group = gotoHit(root, own); if (group >= 0) { showGroup(root, group); const row = root.querySelector('[data-bl-hit]'); if (row) revealTab(row); } }   // 설정 찾기: 그 탭으로 가서 그 줄을 보여요
                else {   // 머리줄 안의 단추(보기 스위치 · 설정 찾기) — 서랍이 같이 접히지 않게 이 누름만 멈춰요. 설정 찾기는 서랍이 접혀 있으면 그대로 흘려 서랍이 펼쳐지게 해요
                    let stay = true;
                    if (has('bl-ext-findbtn')) {
                        const box = root.querySelector('.bl-ext-find'), open = toggleFind(root, own);
                        stay = !!root.querySelector('.inline-drawer-content')?.getClientRects?.().length;
                        if (box) { if (open) box.focus?.(); else { box.value = ''; renderFound(root, ''); } }
                    } else setView(root, root.dataset.blView !== 'raw');
                    if (stay) { event.stopPropagation?.(); event.preventDefault?.(); }
                }
                return;
            }
            if (target.closest('.inline-drawer-header') || target.closest('.drawer-toggle')?.parentElement?.id === 'extensions-settings-button') { buildAll(doc); ensureStrip(doc); }
        }, true);
        // 값이 바뀌면 접힌 줄의 「지금 값」을 다시 적어요(그 확장 칸 안의 바뀜만)
        // 설정 찾기 칸에 적을 때만 목록을 다시 그려요(다른 칸의 입력은 첫 줄에서 돌아가요)
        // 1.5.1 다시 그려진 띠 · 이름표 목록: 맞춤 시트가 새 요소에 거는 애니메이션의 시작 하나로 알아채요 — 감시자 · 타이머 없음
        doc.addEventListener('animationstart', event => {
            if (event.animationName !== 'ss-pulse') return;   // 맞춤 시트가 띠 · 이름표 목록에 0.001초로 거는 그 확장의 키프레임 — 지도의 깜빡이는 고리도 같은 이름이라 아래에서 요소로 가려요
            const el = event.target;
            try {
                if (el?.classList?.contains('ss-tb')) { fitActs(el); markBadge(el); } else if (el?.tagName === 'DL') markLong(el);
                else if (el?.classList?.contains('ss-wz-head') && el.parentElement?.classList?.contains('ss-tw')) decoTheme(el.parentElement);
                else if (el?.matches?.(FACES) && !facesQueued) { facesQueued = true; queueMicrotask(() => { facesQueued = false; try { paintFaces(doc); } catch { /* 아이콘 그대로 */ } }); }   // 얼굴 여럿이 한꺼번에 그려져도 한 번만 훑어요
            } catch { /* 원래 배치 그대로 */ }
        }, true);
        doc.addEventListener('input', event => { const box = event.target; if (!box?.classList?.contains('bl-ext-find')) return; const root = SETS.map(set => box.closest(set.root)).find(Boolean); if (root) renderFound(root, box.value); }, true);
        doc.addEventListener('change', event => { if (event.target?.tagName === 'INPUT' && event.target.classList?.contains('bl-ext-deco-act')) { decoAct(event.target).catch(() => { }); return; } const root = SETS.map(set => event.target?.closest?.(set.root)).find(Boolean); if (root?.dataset?.blOrg) refreshSummaries(root); }, true);
    }
    buildAll(doc);
    ensureStrip(doc);
}
