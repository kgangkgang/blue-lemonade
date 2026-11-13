// 남의 확장 화면 맞춤 (1.2.x) — 확인한 확장이 깔려 있을 때만 받는 모듈이에요(index.js 가 그 확장의 설정 칸이 있을 때만 불러요 · 없으면 파일도 시트도 안 받아요).
//   ① 맞춤 시트를 확장마다 따로, 그 확장이 있을 때만 한 번 붙여요(src/ext-status.css · src/ext-elephant.css · src/ext-memoria.css) — 색 변수 → 팔레트 · 부품 값(코끼리를 생각하지마는 「색 두기」: 제 색은 두고 테마가 덮던 곳만 걷어요). style.css 에는 싣지 않아요.
//   ② 긴 설정 칸을 가로 분류 탭으로: 묶음 머리가 여럿인 설정 칸을, 그때 있는 머리를 읽어 탭 줄로 나눠 보여요.
//      · 그 확장의 요소는 옮기거나 지우거나 다시 만들지 않아요 — 묶음 번호(data-bl-tab-g)를 달고, 안 고른 묶음에 data-bl-tab-off 를 달아 CSS 로 가리기만 해요(값 저장 · 사건 처리는 그 확장 것 그대로).
//      · 묶음 머리가 둘 미만이면 아무것도 하지 않아요(원래 긴 꼴 그대로).
//   ③ 맞춘 판 안내 한 줄: 깔린 판이 확인한 판과 다르면 그 사실을 알려요(맞춤은 그대로 걸어요).
//   ④ 분류 탭 줄을 공용 가로 탭 줄 등록부(src/tab-scroll.js)에 한 번 넣어요(← → · 휠 · 넘친 쪽 흐림). 등록부는 확장 서랍을 열 때 생겨서, 없으면 다음 누름에 다시 보고 넣은 뒤로는 안 봐요.
//   ⑤ 머리줄 그림 글자가 SETS 의 icon 이면 표식(data-bl-ext-icon)만 — 시트가 그 글자를 화면에서만 감추고 테마 선 아이콘으로 그려요.
//   ⑥ 원작 표식(mark)이 있는 칸만: 같은 id · 클래스 이름을 쓰는 다른 확장이 있어도 원작의 표식이 든 설정 칸에만 시트 · 표식(data-bl-ext) · 안내 줄을 붙여요. 설정이 이미 탭으로 나뉜 확장은 분류 탭을 만들지 않아요.
//   감시자 · 타이머 없음: 불릴 때마다 한 번(index.js) + 문서 누름 받기 하나(잡는 단계 — 실리태번이 서랍을 펼치며 높이를 재기 전에 탭을 만들고, 확장 서랍 단추를 누르면 칸을 다시 봐요).
//   받는 조건(index.js): 확인한 확장의 설정 칸이 화면에 있을 때만. 있었던 칸 id 를 이 기기에 표시(localStorage 'bl-ext-compat')해 두고 다음 시작에는 바로 받아 첫 화면부터 시트가 붙어요 —
//     그 확장을 지우면 그다음 시작에 표시가 지워지고, 그 뒤로는 모듈도 시트도 받지 않아요. 일찍 붙이는 시트는 원작 표식을 안 보는 갈래(mark 없음)이면서 지난번에 그 칸이 있었던 것만이에요.
//   켬 조건 · 확인한 판은 아래 SETS 한 곳(index.js 의 선택자와 같은 값) · 시험: tools/tests/ext-settings-tabs.mjs · tools/tests/status-ext-css.mjs · tools/tests/ext-memory-css.mjs

/** 켬 조건 · 확인한 판(한 곳) — root: 그 확장의 설정 칸(index.js 가 「화면에 있음」을 보는 선택자) · css: 맞춤 시트 · head: 묶음 머리(내용 칸의 바로 아래 자식) · version: 판 번호가 찍힌 곳
 *  title: 머리줄 이름 칸 · icon: [그 이름 칸 맨 앞 그림 글자, 시트가 그릴 선 아이콘 이름]
 *  mark: 원작만 가진 요소(이것이 든 설정 칸에만 맞춰요 — 있으면 분류 탭 대신 표식 · 안내 줄만) · sheet: 판 번호를 화면에 안 적는 확장의 제 시트 첫 규칙(그 시트 옆 manifest.json 에서 판을 읽어요) */
export const SETS = [
    // 미트볼 상태창 — 2.6.1 화면에서 확인(2026-11-13) · 2.7.0 은 원작 사본과 코드로 맞대 확인(2026-11-13 · 화면은 리그 대기). 판이 달라도 맞춤 CSS 는 그대로 걸고, 안내 한 줄만 바뀌어요.
    //   2.7.0 머리줄의 고양이 얼굴(U+1F63C)만 테마 선 아이콘으로 — 2.6.1 의 그림 글자는 그대로 둬요.
    { root: '#ss-settings', css: './ext-status.css', head: 'b.ss-set-h', version: '.inline-drawer-header small', title: '.inline-drawer-header b', icon: ['\u{1F63C}', 'cat'], name: '미트볼 상태창', verified: ['2.6.1', '2.7.0'] },
    // 코끼리를 생각하지마 — 1.9.60 화면에서 확인(2026-11-13). 설정은 원작이 이미 탭 일곱 칸으로 나눠요.
    //   「색 두기」 안: 그 확장의 제 색 · 글꼴은 그대로 — 설정 내용 칸(native)에 「원래 색 유지」 표식을 붙여 테마 색 규칙이 비켜 가게 하고, 낮밤 표식(mode)을 테마 밝기에 다시 맞춰요.
    { root: '#lm_settings', mark: '.lm-switch-track', css: './ext-elephant.css', sheet: '.lm-root', native: '.inline-drawer-content', mode: true, name: '코끼리를 생각하지마', verified: ['1.9.60'] },
    // Memoria — 2.0.4 화면에서 확인(2026-11-13). 원작이 실리태번 색 변수를 따라가서 선 · 머리줄만 맞춰요.
    { root: '#memoria_settings', mark: '.memoria__version', css: './ext-memoria.css', version: '.memoria__version', name: 'Memoria', verified: ['2.0.4'] },
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

/** 고른 묶음만 보이게 (index: 0 = 머리 없는 앞머리) */
export function showGroup(root, index) {
    const nav = root.querySelector(`.${NAV}`);
    if (!nav) return;
    const want = String(index);
    for (const tab of nav.children) {
        const on = tab.dataset.blTabTo === want;
        tab.classList.toggle('active', on);
        tab.setAttribute('aria-selected', String(on));
        if (on) tab.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
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

/** 머리줄 이름 칸 맨 앞 그림 글자가 SETS 의 icon 과 같으면 그 칸에 표식 — 다르면(다른 판) 표식을 떼어 원작 글자가 그대로 보여요. 단 표식 이름을 돌려줘요 */
export function markIcon(root, set) {
    if (!set.icon || !set.title) return '';
    const first = root.querySelector(set.title)?.childNodes?.[0];
    const text = first?.nodeType === 3 ? String(first.nodeValue || '').trimStart() : '';
    const want = text.startsWith(set.icon[0]) ? set.icon[1] : '';
    if (want) { if (root.dataset.blExtIcon !== want) root.dataset.blExtIcon = want; }
    else if ('blExtIcon' in root.dataset) delete root.dataset.blExtIcon;
    return want;
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
    return true;
}

let strip = false;
/** 분류 탭 줄을 공용 가로 탭 줄 등록부에 한 번만 넣어요 — 등록부가 아직 없으면 false(다음 누름에 다시), 넣었으면 true(그 뒤로는 등록부를 보지 않아요) */
export function ensureStrip(doc) {
    if (strip) return true;
    try {
        const api = doc[STRIP];
        if (typeof api?.add !== 'function') return false;
        api.add([`.${NAV}`]);   // 이미 있는 탭 줄은 바로 묶고, 그 뒤에 생기는 탭 줄(그 확장이 설정 칸을 다시 그린 때)은 등록부가 스스로 묶어요
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
    for (const part of root.querySelectorAll(set.native)) if (!(NATIVE in part.dataset)) { part.dataset[NATIVE] = ''; n++; }
    return n;
}

export function buildAll(doc) {
    for (const set of SETS) {
        const root = doc.querySelector(set.root);
        if (!root) continue;
        if (!set.mark) { attachSheet(doc, set); markIcon(root, set); buildTabs(root, set); continue; }
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
/** 여러 번 불러도 돼요 — 누름 감시자 · 시트는 한 번, 칸 찾기(탭 · 표식)와 등록부 넣기는 부를 때마다 */
export function startExtCompat(doc = globalThis.document) {
    if (!doc?.addEventListener) return;
    if (!started) {
        started = true;
        let mark = ''; try { mark = localStorage.getItem('bl-ext-compat') || ''; } catch { /* 저장소가 막혀 있으면 칸을 찾은 뒤에 붙여요 */ }
        for (const set of SETS) if (!set.mark && seenBefore(set, mark)) attachSheet(doc, set);   // 지난번에 있었던 확장의 시트는 설정 칸이 그려지기 전에 먼저(첫 화면에 원작 흰 띠가 비치지 않게) — 원작 표식을 봐야 하는 갈래는 칸을 찾은 뒤에만
        // 탭 누름 + 머리줄 · 확장 서랍 단추를 누를 때 칸 다시 찾기 — 문서 단위 누름 하나(잡는 단계 · 막거나 멈추지 않아요)
        doc.addEventListener('click', event => {
            const target = event.target;
            if (!target?.closest) return;
            const tab = target.closest(`.${TAB}`);
            if (tab) {
                const root = SETS.map(set => tab.closest(set.root)).find(Boolean);
                if (root) { showGroup(root, Number(tab.dataset.blTabTo) || 0); remember(root, tab.dataset.blTabName || tab.textContent); }
                ensureStrip(doc);
                return;
            }
            if (target.closest('.inline-drawer-header') || target.closest('.drawer-toggle')?.parentElement?.id === 'extensions-settings-button') { buildAll(doc); ensureStrip(doc); }
        }, true);
    }
    buildAll(doc);
    ensureStrip(doc);
}
