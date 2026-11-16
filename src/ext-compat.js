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
import { cardColorTable, tableColor } from './card-colors.js';   // 1.5.9 카드별 색 기억(인물표 공급자와 같은 표)
import { organize, toggleFold, toggleMore, setView, dismissStart, refreshSummaries, groupOfKey, renderFound, gotoHit, toggleFind } from './ext-organize.js';

/** 켬 조건 · 확인한 판(한 곳) — root: 그 확장의 설정 칸(index.js 가 「화면에 있음」을 보는 선택자) · css: 맞춤 시트 · head: 묶음 머리(내용 칸의 바로 아래 자식) · version: 판 번호가 찍힌 곳
 *  mark: 원작만 가진 요소(이것이 든 설정 칸에만 맞춰요 — 있으면 분류 탭 대신 표식 · 안내 줄만) · sheet: 판 번호를 화면에 안 적는 확장의 제 시트 첫 규칙(그 시트 옆 manifest.json 에서 판을 읽어요) */
export const SETS = [
    // 미트볼 상태창 — 2.6.1 · 2.7.0 · 2.7.1 · 2.7.2 화면에서 확인(2026-11-13 · 리그 — 2.6.1 은 재설계 앞 판에서) · 2.7.9 는 2026-11-14 리그(새 묶음 「기능 켜고 끄기」 탭 · 칩 점검 창) · 2.7.11 · 2.7.15 · 2.7.17 은 같은 날 점검 대본 대조(설정 칸 · 선택자 · 시트 그대로 · 2.7.15 는 새 묶음 「설렘 · 사건 한 스푼」 탭 · 2.7.17 은 그 묶음이 「설렘 한 스푼」으로 줄고 연락 간단하게 칸) — 리그 사진은 아직. 판이 달라도 맞춤 CSS 는 그대로 걸고, 안내 한 줄만 바뀌어요.
    //   2.7.21(11-14 · 원작이 저장소 역사를 새로 정리한 판): 점검 대본 대조 + 리그 사진(폰 384 · PC 1280 × 낮 · 밤) — 띠 · 옆 미니창이 타일 판으로 바뀜(이름이 겹친 알림 닫기 규칙을 좁힘) · 새 설정 줄 두 꼴 · 그림 글자 일곱.
    //   2.7.22(11-15 리그 — 만들기 창 빠른 세트 · 번역 고치기 창 맞춤) · 2.7.23(11-15 대조 · 11-16 리그: 폰 384 낮 · 밤 · PC 1280 — 창 여섯 · 상태창 탭 전부 · 변화 그래프 · 최면 어플 · 새 설정 탭) — 맞춤이 기대는 이름 그대로.
    //   2.8.0(11-16 리그 — 폰 384 낮 · 밤 · 기본 모양과 「같은 모양」 켬 둘 다: 창 여섯 · 상태창 탭 전부 · 전체화면 미니홈피 · 띠): 관계 카드 이름 단추 줄 · 일곱 칸 묶음 줄 · 루트 비교 두 열 · 띠 펼친 칸 · 창 안 알림 자리를 맞춤.
    //   머리줄의 그림 글자(2.7.0 · 2.7.1 고양이 · 2.6.1 그릇)는 맞춤 시트의 선 아이콘 글꼴이 그려요(표식 없음).
    { root: '#ss-settings', css: './ext-status.css', head: 'b.ss-set-h', version: '.inline-drawer-header small', name: '미트볼 상태창', verified: ['2.6.1', '2.7.0', '2.7.1', '2.7.2', '2.7.9', '2.7.11', '2.7.15', '2.7.17', '2.7.21', '2.7.22', '2.7.23', '2.8.0'],
        strips: ['.ss-scope .ss-tabs'] },   // 맞춤 시트가 「한 줄 · 스크롤바 없음」으로 바꾼 그 확장의 탭 줄 — 등록부에 넣어야 휠로 넘친 탭에 닿고, 그 확장이 판을 다시 그린 뒤에도 고른 탭이 보여요
    // 코끼리를 생각하지마 — 1.9.60 화면에서 확인(2026-11-13). 설정은 원작이 이미 탭 일곱 칸으로 나눠요.
    //   1.9.61(2026-11-14 점검 대본 대조): 바뀐 것은 백그라운드 답장의 반쪽 답을 건너뛰는 사건 처리뿐 — 화면 · CSS · 선택자 39개 · 구조 표식 8개 그대로라 맞춤도 그대로예요.
    //   1.9.64(2026-11-14 저녁 점검 대본 대조): 주요 단추 색이 갈색(제 색 변수) · 설정 숫자 칸 셋 · 움직임 줄이기 규칙 — 깨진 선택자 0 · 새 AI 요청 길 0 이라 맞춤 그대로예요.
    //   1.9.66(2026-11-15 점검 대본 대조 · 1.9.65 를 덮는 판): 요약 언어를 요청 끝에 다시 알림 · 기억을 요약 언어로 맞추기(더보기 메뉴 한 줄) · 되감은 요약은 회상에서 뺌(보관함 칩 하나) — 원작 CSS 안 바뀜 · 선택자 39 · 구조 표식 8/8 그대로예요.
    //   「색 두기」 안: 그 확장의 제 색 · 글꼴은 그대로 — 설정 내용 칸(native)에 「원래 색 유지」 표식을 붙여 테마 색 규칙이 비켜 가게 하고, 낮밤 표식(mode)을 테마 밝기에 다시 맞춰요.
    //   1.9.67(2026-11-16 점검 대본 대조 + 리그 사진 — 폰 384 낮 · 밤 · PC 1280): 새 묶음 「작업마다 다른 모델 쓰기」(줄 여섯 · 고르기 칸) — 제 색 변수만 써서 맞춤 그대로예요 · 선택자 39 · 구조 표식 8/8.
    { root: '#lm_settings', mark: '.lm-switch-track', css: './ext-elephant.css', sheet: '.lm-root', native: '.inline-drawer-content', mode: true, name: '코끼리를 생각하지마', verified: ['1.9.60', '1.9.61', '1.9.64', '1.9.66', '1.9.67'] },
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
/** 1.5.4 사용자 「이름 왜 두 글자씩 나오는 애들 뭐냐」: 첫 글자가 겹치는 사람만 두 글자로 구분했더니 한 목록에 한 글자 · 두 글자가 섞였어요 → 늘 한 글자.
 *  같은 첫 글자인 사람은 바탕색(인물 색 · 톤)과 옆의 이름으로 가려요. */
export function initialsFor(names) {
    return new Map([...new Set(names.map(String))].map(name => [name, initialOf(name)]));
}
export const FACE_TONES = 4;
export const toneOf = name => { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 9973; return h % FACE_TONES; };
export const FACES = ':is(.ss-ava.emo, .ss-tf)[title]';
/** 1.5.2 보이는 이름으로: 그 확장의 「화면만 번역」은 글자 마디만 바꾸고 얼굴 title 은 영어 원문이에요 — 번역 메우기(ext-bridge-tr.js)가 그 확장의 사전 바꾸기를 여기 걸어
 *  첫 글자가 화면의 한국어 이름을 따라가요. 톤은 원문 이름으로(번역이 바뀌어도 사람 색이 그대로). 걸린 게 없으면 원문 그대로. */
let faceName = name => name;
export function setFaceName(fn) { faceName = typeof fn === 'function' ? fn : (name => name); }
const shownName = name => { try { const out = faceName(name); return typeof out === 'string' && out.trim() ? out : name; } catch { return name; } };
/** 1.5.4 얼굴 바탕 = 그 인물의 정해진 색(사용자 「프리셋 색깔 있으면 따라가게 · TTS 나 하여튼 지정색 어디든 정해져 있는 거」):
 *  테마 인물표(src/people.js · 이름 다리 people.get — 이 채팅의 대사 색: 프리셋 정규식 · AI 가 쓴 색 대사 · TTS 목소리 칸에서 정한 색)를 실행 때 이름으로 물어요.
 *  이름은 원문(title) · 화면 이름(번역) 둘 다. 모르면 예전처럼 톤(사람마다 색 톤 설정) 또는 기본 면. 이름 · 색을 코드에 적지 않아요. */
const PEOPLE_KEY = Symbol.for('blue-lemonade.names');
const peopleOf = doc => { try { const p = (doc?.defaultView ?? globalThis)[PEOPLE_KEY]?.people; return p?.version === 1 ? p : null; } catch { return null; } };
/** 1.5.5 from = 'preset' 이면 프리셋 색만, 'other' 면 프리셋이 준 색은 빼고(TTS 등), 없으면 아무 공급자나 (people.get 의 colorFrom · 셀 수 없는 칸) */
export function personColor(people, ...args) {
    if (!people) return null;
    const from = args[0] && typeof args[0] === 'object' && !Array.isArray(args[0]) ? args.shift().from : null;
    for (const n of args) {
        if (!n) continue;
        let p = null; try { p = people.get(String(n)); } catch { p = null; }
        const c = p?.color;
        if (!/^#[0-9a-f]{6}$/i.test(String(c || ''))) continue;
        const isPreset = p.colorFrom === 'preset';
        if (from === 'preset' ? !isPreset : from === 'other' ? isPreset : false) continue;
        return String(c).toLowerCase();
    }
    return null;
}
/** 1.5.4 사용자 「대사 없어도 TTS 랑 프리셋에 정해 둔 색」: 인물표의 색은 이 채팅 대사에서 이름이 붙은 색이라 대사가 나오기 전엔 비어요.
 *  TTS 설정의 카드별 색 기억(extension_settings.lemon_voice.card_colors[카드 그림] 은 「색 → 이름」 표 — TTS 색 표에서 사용자가 이름을 정해 둔 것 · 새 채팅의 씨앗)을
 *  지금 채팅의 카드(그룹이면 구성원 카드 전부)에서 읽어 이름 → 색 표로 — 대사와 상관없이 바로 써요. 이름은 전체 · 첫 낱말로 맞춰요(대소문자 · 공백 무시). */
// 1.5.9 이 표는 이제 인물표의 공급자 'card'(src/card-colors.js)가 같이 써요 — 여기서는 그 함수를 그대로 내보내기만 해요(두 벌 아님 · 인물표가 없을 때의 안전망)
export { cardColorTable, tableColor };
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lumOf = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
export const contrastOf = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** 1.5.5 사용자 「프로필 색깔 안 바뀌는데」: 1.5.4 는 인물 색을 면 바닥과 섞어 그 위 글자(테마 글자색)가 4.5 : 1 이 되게 했더니, 밤 화면에서 빨강 · 주황 · 분홍이
 *  모두 어두운 적갈색이 돼 예전 톤과 구분이 안 됐어요. → 바탕은 인물 색 그대로, 글자를 흰색 · 짙은 색 가운데 더 또렷한 쪽으로.
 *  둘 다 4.5 : 1 이 안 되는 가운데 밝기 색만 그 쪽으로 조금씩(5% 씩) 밀어 맞춰요. 돌려주는 값: { bg, ink } */
const WHITE = [255, 255, 255], INK_DARK = [20, 22, 26];
const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
export function faceColors(color) {
    let c = hexRgb(color);
    const pick = col => (contrastOf(col, WHITE) >= contrastOf(col, INK_DARK) ? WHITE : INK_DARK);
    let ink = pick(c);
    const to = ink === WHITE ? 0 : 255; // 흰 글자면 바탕을 조금 어둡게, 짙은 글자면 조금 밝게
    for (let i = 0; i < 12 && contrastOf(c, ink) < 4.5; i++) c = c.map(v => v + (to - v) * 0.05);
    return { bg: toHex(c), ink: toHex(ink) };
}
/** 옛 이름(1.5.4 시험 · 다른 곳이 부를 수 있어요): 바탕만 */
export const faceFill = color => faceColors(color).bg;
let peopleHooked = false;
/** 화면의 얼굴 요소 전부에 첫 글자 · 톤 · 인물 색 표식 — 설정이 「아이콘」이면 아무것도 안 해요(표식이 남아 있어도 시트가 안 봐요) */
export function paintFaces(doc) {
    if (!doc?.body?.hasAttribute?.('data-bl-mb-face')) return 0;
    const els = [...doc.querySelectorAll(FACES)];
    const names = els.map(el => el.getAttribute('title')), shown = names.map(shownName);
    const map = initialsFor(shown), people = peopleOf(doc);
    let cards = null; const cardsOf = () => (cards ??= cardColorTable((() => { try { return doc.defaultView?.SillyTavern?.getContext?.(); } catch { return null; } })()));
    if (people && !peopleHooked) { peopleHooked = true; try { people.onChange(() => { try { paintFaces(doc); } catch { /* 다음 그리기 때 */ } }); } catch { peopleHooked = false; } }
    els.forEach((el, k) => {
        const ini = map.get(String(shown[k])); if (el.getAttribute('data-bl-ini') !== ini) el.setAttribute('data-bl-ini', ini);
        // 1.5.6 얼굴 그림 글자 · 첫 글자를 숨기면(색만) 화면 읽기에 남는 게 없어요 — 이름을 그림 이름으로(role=img · aria-label · 화면 이름)
        const label = String(shown[k] || names[k] || ''); if (label && el.getAttribute('aria-label') !== label) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', label); }
        const tone = String(toneOf(names[k])); if (el.getAttribute('data-bl-tone') !== tone) el.setAttribute('data-bl-tone', tone);
        // 차례(1.5.6): 이 채팅 대사 색(TTS 색 표) → TTS 카드별 색 기억 → 프리셋에 정해 둔 색(프리셋 인물 색 공급자)
        const color = personColor(people, { from: 'other' }, names[k], shown[k]) || tableColor(cardsOf(), names[k], shown[k]) || personColor(people, { from: 'preset' }, names[k], shown[k]);
        const fc = color ? faceColors(color) : null;
        if (fc) { if (el.getAttribute('data-bl-pc') !== fc.bg) { el.setAttribute('data-bl-pc', fc.bg); el.style?.setProperty?.('--bl-face', fc.bg); el.style?.setProperty?.('--bl-face-ink', fc.ink); } }
        else if (el.hasAttribute?.('data-bl-pc')) { el.removeAttribute('data-bl-pc'); el.style?.removeProperty?.('--bl-face'); el.style?.removeProperty?.('--bl-face-ink'); }
    });
    return els.length;
}
/** 미트볼 「꾸미기」 창에 테마 칸 끼우기(1.5.2 사용자 「블루레몬에 넣지 말고 미트볼 꾸미기 쪽에」): 「크기 · 모양」 묶음 바로 아래에 「블루레몬 꾸미기」 묶음 하나 —
 *  글꼴(누르면 테마 글꼴 고르개가 열려요) · 얼굴 표시(아이콘 / 이름 첫 글자) · 사람마다 색 톤. 그 확장의 묶음 · 줄 · 고르기 · 스위치 class 를 그대로 써요.
 *  값은 테마 설정에만 저장해요(그 확장 설정에는 안 써요). 그 확장이 창을 다시 그릴 때마다 다시 끼워요(같은 0.001초 신호 · 감시자 없음). 지금 값은 테마가 body · 문서에 걸어 둔 표식에서 읽어요. */
export function decoState(doc) {
    const face = doc.body?.getAttribute?.('data-bl-mb-face');
    let font = ''; try { font = String(doc.defaultView.getComputedStyle(doc.documentElement).getPropertyValue('--salty-font-mb') || '').trim(); } catch { /* 따라가기로 */ }
    const own = !!font && font !== 'initial';
    return { face: face ? 'initial' : 'icon', tone: face === 'tone', look: doc.body?.hasAttribute?.('data-bl-mb-color-only') ? 'color' : 'letter', font: own ? (font.split(',')[1] || font).replace(/['"]/g, '').trim() : '' };
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
    let tone = null, look = null;
    if (st.face === 'initial') look = kids(h('div', 'ss-f wide'), h('span', '', '프로필 얼굴'), kids(h('div', 'ss-seg'), h('button', st.look === 'color' ? 'bl-ext-deco-act on' : 'bl-ext-deco-act', '색만', { type: 'button', 'data-bl-deco': 'look:color' }), h('button', st.look === 'letter' ? 'bl-ext-deco-act on' : 'bl-ext-deco-act', '글자', { type: 'button', 'data-bl-deco': 'look:letter' })));
    if (st.face === 'initial') { const input = h('input', 'ss-switch bl-ext-deco-act', '', { type: 'checkbox', 'data-bl-deco': 'tone' }); input.checked = st.tone; tone = kids(h('div', 'ss-pills'), kids(h('label', 'ss-tog'), input, h('span', '', '사람마다 색 톤'))); }
    box.textContent = ''; box.append(head, font, face, ...(look ? [look] : []), ...(tone ? [tone] : []));   // 테마가 끼운 묶음 안만 비우고 다시 채워요
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
    else if (act.startsWith('look:')) panel.updateSettings(st => { st.chat.mbFaceLook = act.slice(5) === 'letter' ? 'letter' : 'color'; });
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
/** 1.5.4 띠 한 줄(사용자 「한 줄일 때는 칸 맞춰서 넓어지고 · 눌렀을 때 2줄 되면 안 됨」): 칸이 모두 첫 줄 한 칸 높이이고 칸이 셋 이하(폰 네 열 판)면 단추 줄을 칸 옆에 두고
 *  칸 판의 열 수를 쓰인 열 수로 줄여 칸이 남는 폭을 고르게 나눠 가져요(표식 data-bl-acts="row" · 변수 --bl-tcols). 칸을 눌러 「자세히」 칸이 펼쳐져도
 *  칸 자리는 그대로라 같은 판단 — 예전엔 펼친 칸이 있으면 한 줄을 풀어 단추가 둘째 줄로 떨어졌어요. tiles: [{ c, r, w, h }](1 부터) */
export function rowCols(tiles, cols = 4) {
    if (!tiles.length || !tiles.every(t => t.r === 1 && t.h === 1)) return 0;
    // 칸 수로 봐요(칸 하나가 두 열을 쓰는 기본 배치 — 날짜 · 장소가 각 두 열 — 도 칸 둘이면 단추와 한 줄) · 열 수는 쓰인 끝 열까지(넓은 칸은 넓은 대로 나눠 가져요)
    const n = Math.max(...tiles.map(t => t.c + t.w - 1));
    return cols > 4 || tiles.length <= 3 ? n : 0;
}
export function fitActs(tb) {
    // 1.5.5 「지글지글」: 판단은 띠 바깥 틀(#ss-hud — 그 확장이 띠를 새로 그려도 그대로 있는 요소)에 달아요. 새 띠는 처음 그려질 때부터 앞 판단으로 배치되고,
    //   여기서는 칸 자리(그 확장이 적은 인라인 값) · 열 수 · 단추 수만 봐요 — 펼친 「자세히」 · 띠 높이 · 칩 폭은 안 봐서 판단이 제 입력을 바꾸지 않아요(되먹임 없음)
    const host = tb.closest?.('#ss-hud') || tb;
    const tg = tb.querySelector?.('.ss-tg'), acts = tb.querySelector?.('.ss-tb-acts');
    let fit = false;
    if (tg && acts && !tb.classList.contains('editing') && Number(tg.style.getPropertyValue('--cols')) >= 4) {
        const tiles = [];
        for (const t of tg.querySelectorAll(':scope > .ss-t')) { const c = SPAN.exec(t.style.gridColumn || t.style.gridColumnStart + ' / ' + t.style.gridColumnEnd), r = SPAN.exec(t.style.gridRow || t.style.gridRowStart + ' / ' + t.style.gridRowEnd); if (!c || !r) { tiles.length = 0; break; } tiles.push({ c: +c[1], w: +c[2], r: +r[1], h: +r[2] }); }
        const cols = Number(tg.style.getPropertyValue('--cols'));
        const n = rowCols(tiles, cols);
        if (n) { fit = 'row'; if (host.style.getPropertyValue('--bl-tcols') !== String(n)) host.style.setProperty('--bl-tcols', String(n)); }
        else if (cols === 4 && actsFit(tiles, 4, acts.children.length > 5 ? 3 : 2)) fit = 'in';
    }
    if (fit) { if (host.getAttribute('data-bl-acts') !== fit) host.setAttribute('data-bl-acts', fit); } else if (host.hasAttribute?.('data-bl-acts') ?? true) host.removeAttribute('data-bl-acts');
    return fit;
}
/** 1.5.5 사용자 「아침 4/1 뒤에 (화)(월) 이런 식으로 요일」: 그 확장의 날짜 칸은 칩에 「때 + 월/일」만 적고, 칸 설명(title)엔 「월/일(요일) 때 …」 를 적어요.
 *  설명 맨 앞의 「월/일(요일)」 을 읽어, 칩의 작은 글이 같은 「월/일」 로 끝나면 바깥 틀에 표식(data-bl-wd · 변수 --bl-wd)만 달아요 — 시트가 그 뒤에 「(요일)」 을 그려요(글 · 저장 자료는 안 바꿔요).
 *  요일이 없거나(빈 괄호) 세 글자 넘는 이름(판타지 달력 등) · 이미 요일이 붙은 칩(넓은 칸)은 아무것도 안 붙여요. 띠가 다시 그려질 때마다 다시 달아요(번역은 글만 바꿔 표식이 남아요). */
const WEEKDAY = /^\s*(\d{1,2})\/(\d{1,2})\(([^()]{1,12})\)/;
/** 1.5.8 사용자 「왜 날짜 Mon 으로 뜸 · 월이라고 떠야지」: 그 확장의 달력 요일 이름은 채팅마다 달라요(달력을 만들 때 적힌 대로 — 영어 「Mon」 · 일본어 「月」 …).
 *  테마 화면은 한국어라 칩의 요일은 늘 한국어 한 글자로 — 한국어 · 영어(짧은 · 긴 꼴 · 대소문자) · 일본어 · 중국어 꼴을 바꾸고, 못 알아보는 꼴(판타지 달력 등)은 붙이지 않아요.
 *  날짜 숫자로 요일을 셈하지는 않아요(그 확장 달력이 현실 달력이 아닐 수 있어요 — 자료에 적힌 요일이 먼저). */
const KO_DAYS = '일월화수목금토';
const EN_DAYS = [/^sun(day)?$/i, /^mon(day)?$/i, /^tue(s|sday)?$/i, /^wed(nesday)?$/i, /^thu(r|rs|rsday)?$/i, /^fri(day)?$/i, /^sat(urday)?$/i];
export function koWeekday(raw) {
    const w = String(raw ?? '').normalize('NFKC').trim().replace(/[.\s]+$/, '');
    let m = /^([일월화수목금토])(요일)?$/.exec(w); if (m) return m[1];
    m = /^([日月火水木金土])(曜日?)?$/.exec(w); if (m) return KO_DAYS['日月火水木金土'.indexOf(m[1])];
    m = /^(?:星期|礼拜|禮拜|周|週)([日天一二三四五六])$/.exec(w); if (m) return KO_DAYS['日一二三四五六'.indexOf(m[1] === '天' ? '日' : m[1])];
    const i = EN_DAYS.findIndex(re => re.test(w));
    return i >= 0 ? KO_DAYS[i] : '';
}
export function markWeekday(tb) {
    // 표식은 띠 바깥 틀(#ss-hud)에 — 그 확장이 칩을 누를 때마다 띠를 새로 그려도 첫 화면부터 요일이 그대로예요(칩마다 달면 한 화면씩 깜빡여요 · 1.5.5 「지글지글」)
    const host = tb.closest?.('#ss-hud') || tb;
    const t = tb.querySelector?.('.ss-tg > .ss-t.t-date'), sm = t && !t.classList?.contains?.('L') ? t.querySelector?.('small') : null;
    const m = sm ? WEEKDAY.exec(t.getAttribute?.('title') || '') : null, md = m ? `${+m[1]}/${+m[2]}` : '';
    const text = String(sm?.textContent || '').trim();
    const wd = md && text.endsWith(md) && /(^|[^\d/])$/.test(text.slice(0, -md.length)) ? koWeekday(m[3]) : '';
    if (wd) { if (host.getAttribute('data-bl-wd') !== wd) { host.setAttribute('data-bl-wd', wd); host.style?.setProperty?.('--bl-wd', `"(${wd})"`); } }
    else if (host.hasAttribute?.('data-bl-wd')) { host.removeAttribute('data-bl-wd'); host.style?.removeProperty?.('--bl-wd'); }
    return wd;
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
/** 1.5.4 사용자 「프로필 설명 왜 세로 2열 아니지」: 13자 넘는 값을 두 단 통째로 돌렸더니 문장 값뿐인 프로필은 전부 한 열이 됐어요(여러 단 흐름이라 칸 사이 간격도 들쭉날쭉).
 *  → 두 열 격자에 칸(이름표 위 · 값 아래)을 차례로 놓고, 값이 아주 길 때(마흔 자 넘거나 줄바꿈)만 그 칸이 두 열을 차지해요. 칸 자리는 변수(--bl-c · --bl-rt · --bl-rd)로 — 배치를 재지 않아요. */
/** 칸 모서리의 빨간 점(.ss-t-dot · 그 확장의 「방금 AI 답에서 바뀐 칸」 표시 · 1.5.9 사용자 「눌러 봤는데도 남아요」): 그 확장은 다음 AI 답까지 점을 남겨요.
 *  눌러서 펼쳐 본 칸의 점만 테마가 화면에서 숨겨요 — 본 칸 이름을 적은 작은 시트 하나(#bl-mb-dot-seen)로요. 그 확장의 파일 · 자료 · 요소는 안 건드려요(띠를 새로 그려도 시트는 그대로).
 *  새 AI 답 · 채팅 바꾸기 신호에 비우고, 띠가 다시 그려졌을 때 그 칸에 점이 없으면(그 확장이 스스로 끔) 그 칸을 잊어요 — 다음에 켜지는 점은 다시 보여요. 「원작 그대로 보기」 에서는 안 숨겨요. */
export const DOT_SHEET = 'bl-mb-dot-seen';
const dotSeen = new Set();
const dotKey = key => (/^[\w-]{1,40}$/.test(String(key ?? '')) ? String(key) : '');
export const dotCss = keys => { const list = [...keys].map(dotKey).filter(Boolean); return list.length ? `body.salty:not([data-bl-ext-raw]) .ss-tb .ss-t:is(${list.map(k => `[data-k="${k}"]`).join(',')}) > .ss-t-dot { display: none !important; }` : ''; };
function writeDots(doc) {
    const css = dotCss(dotSeen); let sheet = doc.getElementById?.(DOT_SHEET);
    if (!sheet) { if (!css || !doc.createElement || !doc.head?.appendChild) return css; sheet = doc.createElement('style'); sheet.id = DOT_SHEET; doc.head.appendChild(sheet); }
    if (sheet.textContent !== css) sheet.textContent = css;
    return css;
}
/** 누른 요소가 점이 켜진 칸이면 그 칸을 「봤음」 으로 적어요(편집 중인 칸 · 점 없는 칸은 아님). 적었으면 칸 이름. */
export function seeDot(doc, target) {
    const tile = target?.closest?.('.ss-tb .ss-t[data-k]'); if (!tile || tile.classList?.contains?.('edit')) return '';
    const key = dotKey(tile.getAttribute?.('data-k')); if (!key || dotSeen.has(key) || !tile.querySelector?.(':scope > .ss-t-dot')) return '';
    dotSeen.add(key); writeDots(doc); return key;
}
/** 다시 그려진 띠: 봤다고 적은 칸에 점이 더는 없으면 잊어요. 남은 칸 수. */
export function syncDots(doc, tb) {
    let changed = false;
    for (const key of [...dotSeen]) { const tile = tb?.querySelector?.(`.ss-t[data-k="${key}"]`); if (tile && !tile.querySelector?.(':scope > .ss-t-dot')) { dotSeen.delete(key); changed = true; } }
    if (changed) writeDots(doc);
    return dotSeen.size;
}
/** 새 AI 답 · 채팅 바꾸기: 모두 잊어요(새로 켜진 점은 다시 보여요). */
export function clearDots(doc) { if (!dotSeen.size) return 0; const n = dotSeen.size; dotSeen.clear(); writeDots(doc); return n; }
let dotsHooked = false;
function hookDots(doc) {
    if (dotsHooked) return true;
    let c = null; try { c = (doc.defaultView || globalThis).SillyTavern?.getContext?.() ?? null; } catch { c = null; }
    const on = c?.eventSource?.on?.bind(c.eventSource), types = c?.event_types; if (!on || !types) return false;
    dotsHooked = true;
    for (const name of ['MESSAGE_RECEIVED', 'CHAT_CHANGED']) if (types[name]) try { on(types[name], () => { try { clearDots(doc); } catch { /* 점 그대로 */ } }); } catch { /* 신호를 못 걸면 띠 다시 그리기로만 */ }
    return true;
}
export const LONG_VALUE = 40;
export function markLong(dl) {
    let n = 0, row = 1, col = 1;
    for (const dd of dl.querySelectorAll?.(':scope > dd') || []) {
        const text = (dd.textContent || '').trim(), long = text.length > LONG_VALUE || /[\r\n]/.test(text);
        const dt = dd.previousElementSibling?.tagName === 'DT' ? dd.previousElementSibling : null;
        if (long && col === 2) { row++; col = 1; }
        const c = long ? '1 / -1' : String(col);
        for (const el of [dd, dt]) if (el) {
            if (long) el.setAttribute('data-bl-long', ''); else el.removeAttribute('data-bl-long');
            el.style?.setProperty?.('--bl-c', c); el.style?.setProperty?.('--bl-rt', String(row * 2 - 1)); el.style?.setProperty?.('--bl-rd', String(row * 2));
        }
        if (long || col === 2) { row++; col = 1; } else col = 2;
        if (long) n++;
    }
    dl.setAttribute?.('data-bl-grid', '');
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
            try { if (seeDot(doc, target)) hookDots(doc); } catch { /* 점 그대로 */ }   // 1.5.9 눌러 본 칸의 빨간 점 숨기기(누름은 막지 않아요)
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
                if (el?.classList?.contains('ss-tb')) { syncDots(doc, el); fitActs(el); markBadge(el); markWeekday(el); } else if (el?.tagName === 'DL') markLong(el);
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
