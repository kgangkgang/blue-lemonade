// 남의 확장 설정 칸 「정리한 보기」 (1.2.x) — src/ext-compat.js 가 분류 탭을 만든 바로 뒤에 한 번 불러요(그 확장이 있을 때만 받는 같은 조각).
//   사용자: 「지금 너무 세로로 길고, 가독성도 떨어지고, 뭐 하는 기능인지도 모르겠고」
//   ① 탭마다 한 줄 설명(무엇을 정하는 탭인지) ② 자주 쓰는 줄만 펼치고 나머지는 접는 갈래 — 접힌 줄에 지금 값을 보여요 ③ 숫자 줄은 둘씩 2열
//   ④ 긴 설명 문단은 한 줄 + 「자세히」 ⑤ 토큰 · AI 요청 같은 비용을 같은 꼴의 작은 표시로 ⑥ 처음 쓰는 사람 길잡이 ⑦ 서랍 머리의 「정리한 보기 ↔ 원작 그대로」 스위치
//   · 그 확장의 요소는 옮기거나 지우거나 다시 만들지 않아요 — 표식(data-bl-fold · data-bl-fold-off · data-bl-col · data-bl-cost · data-bl-clamp)만 달고,
//     테마 것(.bl-ext-intro · .bl-ext-fold · .bl-ext-more · .bl-ext-start · .bl-ext-view)만 사이에 끼워요. 값 저장 · 사건 처리는 그 확장 것 그대로예요.
//   · 열쇠는 그 확장의 설정 칸 이름(data-s · data-s-act …)이에요. 못 찾는 열쇠 · 모르는 줄은 그대로 보여요 — 판이 바뀌어 구조가 달라지면 조용히 원래 모습으로 떨어져요.
//   · 감시자 · 타이머 없음. 접힘 · 보기 · 길잡이 닫음은 이 기기에(localStorage) 기억해요. 「원작 그대로」는 표식을 둔 채 시트가 전부 펼쳐 보여요(DOM 을 되돌릴 것이 없어요).
//   시험: tools/tests/ext-settings-organize.mjs

/** 확장마다의 정리 표 — 열쇠는 설정 칸 뿌리(SETS 의 root).
 *  intro: [그 탭에 있는 칸 열쇠, 탭 한 줄 설명] · folds: [갈래 제목, [열쇠 또는 「열쇠:접힌 줄에 보일 짧은 이름」 …]] · cost: 열쇠 → 비용 표시 · start: 길잡이 [글, [단추 글, 갈 탭에 있는 칸 열쇠] …] */
export const PLANS = {
    '#ss-settings': {
        intro: [
            ['enabled', '이 채팅의 상태창을 켜고, AI 답에서 상태를 어떻게 읽을지 정해요.'],
            ['ssGenLang', '상태창 글을 어느 언어로 만들고 누가 번역할지 정해요. 롤플 본문과는 상관없어요.'],
            ['oocDetect', '어떤 때 상태창을 AI 에 보내지 않을지 정해요.'],
            ['contactReflect', '인물과 주고받는 연락을 본편에 얼마나 알리고, 먼저 연락이 오게 할지 정해요.'],
            ['aiProfile', '상태창을 만들고 고칠 때 쓰는 AI 와 한 번에 보내는 양을 정해요. 롤플 본문은 메인 연결 그대로예요.'],
            ['deltaMode', '쓰는 모델에 맞춰 보내는 양을 줄여요. 단추 하나로 아래 설정을 한꺼번에 맞출 수 있어요.'],
            ['toastMode', '날이 바뀌거나 연락이 올 때 뜨는 알림의 모양 · 자리 · 시간을 정해요.'],
            ['musicTaste', '장면에 어울리는 곡을 추천받을 때의 취향과 열 곳을 정해요.'],
            ['stageLock', '사람 사이가 가까워지는 속도와 질투 · 화면 밖 근황을 정해요.'],
            ['romBond', 'AI 가 너무 쉽게 연인처럼 구는 것을 줄여요. 전부 선택이고 처음에는 꺼져 있어요.'],
            ['updateNotice', '업데이트 알림 · 세이브 · 마스코트 · 진단과 백업이에요.'],
            ['stashTags', '요약 · 번역 확장이나 다른 프리셋과 함께 쓸 때 태그를 어떻게 다룰지 정해요.'],
        ],
        folds: [
            ['장면에 맞춰 줄이기 · 변동 칩', ['sceneFilter:장면 필터', 'sceneTurns:최근 메시지', 'pinCap:고정 메모', 'msgCard:변동 칩']],
            ['번역 모델 · 언어', ['trProfile:모델', 'trLang:언어', 'trCode:코드']],
            ['번역 지침 · 자동 번역', ['trRules:지침', 'trAuto:자동 번역', 'trsheet', 'toenglish']],
            ['먼저 연락 오게', ['autoPing:자동 선톡', 'autoPingEvery:간격', 'rushChance:급행 %']],
            ['실패했을 때 · 묶어 만들기', ['aiFallbackMain:메인으로 다시', 'genBatch:묶어서 생성']],
            ['한 번에 보내는 양', ['genParallel:동시 요청', 'aiMaxTokens:출력 토큰', 'recentForGen:최근 채팅', 'loreChars:로어북 글자', 'injectDepth:주입 깊이']],
            ['주입 · 긴 채팅 정리 · 정규식', ['injWorld:세계관 매 턴', 'injScan:로어북 켜기', 'autoBake:자동 정리', 'autoRegex:정규식']],   // injWorld 는 2.7.1 부터(앞 판에는 없어 조용히 건너뛰어요)
            ['변화만 보내기 · 다시 받기', ['deltaMode:변화 위주', 'deltaEvery:전체 간격', 'retryJSON:다시 받기']],
            ['알림 시간 · 종류', ['toastSec:시간', 'daySummary:하루 정리', 'featureTips:팁', 'tipreset']],
            ['마스코트 · 소리', ['showMascot:마스코트', 'mascotBuddy:제목 옆', 'mascotSound:소리', 'mascotVolume:크기', 'mascotsound']],
            ['진단 · 백업', ['diag', 'report', 'backup']],
            ['정규식 · 기본값 · 옛 태그 보관', ['stashall', 'defmods', 'regex', 'unregex']],
        ],
        // 비용 표시 — 그 확장이 줄마다 적어 둔 말(「토큰 0」 · 「확장 AI 1회」 · 「주입 조금」 …)을 같은 꼴로 모은 것
        cost: {
            autoPing: 'ai', retryJSON: 'ai',
            injWorld: 'tok', injScan: 'tok', offscreen: 'tok', romFacts: 'tok', romDrive: 'tok', romIntent: 'tok', romInit: 'tok',
            sceneFilter: 'save', deltaMode: 'save', genBatch: 'save', autoBake: 'save',
            romBond: 'free', romCap: 'free', romFatigue: 'free', featureTips: 'free',
        },
        start: ['처음이라면 — 아래 「만들기」로 이 채팅의 상태창을 만든 뒤, 쓸 모델과 비용을 맞춰요.', [['확장 AI', 'aiProfile'], ['토큰 절약', 'deltaMode']]],
    },
};
const KEYED = '[data-s], [data-s-act], [data-s-every], [data-s-preset]';
const CLAMP_FROM = 72;   // 이 글자 수부터 긴 설명으로 봐요(폰 폭에서 두 줄을 넘는 길이)
const own = el => /(^|\s)bl-ext-/.test(String(el.className || ''));

/** 순수 계산: 줄 정보(문서 차례) → 어느 갈래로 접을지 · 2열 숫자 줄 · 탭 설명.
 *  rows: [{ keys: [열쇠…], num: 숫자 줄, small: 설명 문단, group: 탭 번호 글자 }]
 *  돌려줌: { rows: [{ fold: 갈래 id | null, col: 2열 칸, cost }], folds: [{ id, title, group, first, names: [[열쇠, 짧은 이름]…] }], intro: [[탭 번호, 글]…] } */
export function planRows(rows, plan) {
    const out = rows.map(() => ({ fold: null, col: false, cost: null }));
    const groupOf = key => rows.find(r => r.keys.includes(key))?.group ?? null;
    const folds = [];
    (plan.folds || []).forEach(([title, list], n) => {
        const names = list.map(item => String(item).split(':')), keys = names.map(pair => pair[0]);
        const hit = rows.map((r, i) => (r.keys.some(k => keys.includes(k)) ? i : -1)).filter(i => i >= 0);
        if (!hit.length) return;
        const group = rows[hit[0]].group, id = `f${n}`;
        for (const i of hit) if (rows[i].group === group && !out[i].fold) out[i].fold = id;
        folds.push({ id, title, group, first: hit[0], names: names.filter(pair => pair[1]) });
    });
    // 갈래에 든 줄 바로 뒤의 설명 문단은 그 줄의 설명이에요 — 같이 접어요
    rows.forEach((r, i) => { if (r.small && !r.keys.length && i > 0 && out[i - 1].fold && rows[i - 1].group === r.group) out[i].fold = out[i - 1].fold; });
    // 숫자 줄(파라미터)은 전부 2열 칸(반 폭) — 이어진 것끼리 둘씩 나란히 놓이고, 홀수면 마지막 칸은 왼쪽 열만 차지해요(11-13 사용자 「파라미터는 다 세로 2열」)
    rows.forEach((r, i) => { if (r.num) out[i].col = true; });
    rows.forEach((r, i) => { const key = r.keys.find(k => plan.cost?.[k]); if (key) out[i].cost = plan.cost[key]; });
    const intro = (plan.intro || []).map(([key, text]) => [groupOf(key), text]).filter(pair => pair[0] !== null);
    return { rows: out, folds, intro };
}

/** 접힌 줄에 보일 「지금 값」 — read(열쇠) 가 글을 주면 「짧은 이름 값」으로 이어요 */
export function summaryOf(names, read) {
    return names.map(([key, name]) => { const v = read(key); return v === null || v === undefined || v === '' ? '' : `${name} ${v}`; }).filter(Boolean).join(' · ');
}
/** 칸 하나의 지금 값을 짧은 글로 */
export function valueOf(control) {
    if (!control) return null;
    if (control.type === 'checkbox') return control.checked ? '켬' : '끔';
    if (control.localName === 'select') return String(control.selectedOptions?.[0]?.textContent ?? control.value ?? '').replace(/\s*[—(].*$/, '').trim().slice(0, 12);
    if (control.localName === 'textarea') return String(control.value || '').trim() ? '적음' : '비어 있음';
    return String(control.value ?? '').trim().slice(0, 12) || null;
}

const keyOf = (root, kind) => `bl-ext-${kind}:${root.id || 'x'}`;
function recall(root, kind) { try { return localStorage.getItem(keyOf(root, kind)) || ''; } catch { return ''; } }
function remember(root, kind, value) { try { localStorage.setItem(keyOf(root, kind), value); } catch { /* 저장소가 막혀 있으면 기억 없이 */ } }
const keysOf = row => { const out = []; const add = e => { const d = e.dataset || {}; for (const k of ['s', 'sAct', 'sEvery', 'sPreset']) if (d[k]) out.push(d[k]); }; add(row); for (const e of row.querySelectorAll(KEYED)) add(e); return out; };
function make(doc, tag, cls, text, group) {
    const node = doc.createElement(tag);
    node.className = cls;
    if (tag === 'button') node.type = 'button';
    if (text) node.textContent = text;
    if (group !== undefined && group !== null) node.dataset.blTabG = String(group);   // 분류 탭이 이 번호로 함께 보이고 숨겨요
    return node;
}
/** 사이에 끼우는 테마 것은 제 스타일로 숨겨 둬요 — 테마가 켜져 있을 때만 맞춤 시트가 보여요(테마를 끄면 그 확장의 원래 모습 그대로) */
const hidden = node => { node.style.display = 'none'; return node; };

/** 갈래 줄들의 지금 값 요약을 다시 적어요(값이 바뀔 때 · 처음 만들 때) */
export function refreshSummaries(root) {
    for (const button of root.querySelectorAll('.bl-ext-fold')) {
        const names = String(button.dataset.blNames || '').split('|').filter(Boolean).map(pair => pair.split(':'));
        const text = summaryOf(names, key => valueOf(root.querySelector(`[data-s="${key}"]`)));
        const slot = button.querySelector('small');
        if (slot && slot.textContent !== text) slot.textContent = text;
    }
}
/** 갈래 하나를 펼치거나 접어요 */
export function toggleFold(root, button) {
    const id = button.dataset.blFoldFor, open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    for (const row of root.querySelectorAll(`[data-bl-fold="${id}"]`)) { if (open) delete row.dataset.blFoldOff; else row.dataset.blFoldOff = ''; }
    const list = new Set(recall(root, 'fold').split(',').filter(Boolean));
    if (open) list.add(id); else list.delete(id);
    remember(root, 'fold', [...list].join(','));
}
/** 긴 설명 문단의 「자세히」 — 단추의 data-bl-more-for 와 같은 표식(data-bl-clamp-id)의 문단을 펼치거나 다시 줄여요 */
export function toggleMore(root, button) {
    const target = root.querySelector(`[data-bl-clamp-id="${button.dataset.blMoreFor}"]`);
    if (!target) return;
    const open = target.dataset.blClamp !== 'open';
    target.dataset.blClamp = open ? 'open' : (button.dataset.blMoreHide ? 'hide' : '');
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? '접기' : '자세히';
}
/** 정리한 보기 ↔ 원작 그대로 */
export function setView(root, raw) {
    const was = root.dataset.blView, now = raw ? 'raw' : 'org';
    root.dataset.blView = now;
    const button = root.querySelector('.bl-ext-view');
    // 글 없이 레몬 아이콘 하나(시트가 그려요) — 켜짐 = 블루레몬 맞춤 화면 · 꺼짐 = 원작 화면 그대로. 이름은 title · aria-label 로
    if (button) { const label = `블루레몬 맞춤 화면 ${raw ? '끔' : '켬'} — 끄면 원작 화면 그대로`; button.setAttribute('aria-pressed', String(!raw)); button.setAttribute('aria-label', label); button.title = label; if (button.textContent) button.textContent = ''; }
    remember(root, 'view', now);
    root.ownerDocument?.body?.toggleAttribute?.('data-bl-ext-raw', !!raw);   // 채팅방의 고양이 아이콘(띠 카드 · 뜬 단추 · 가장자리 손잡이)도 같은 스위치를 따라가요 — 표식 하나뿐이에요
    // 처음 바꿀 때 한 번만 알려요(글이 없는 단추라 무엇이 바뀌었는지 한 줄로)
    if (was && was !== now && recall(root, 'viewtip') !== '1') { remember(root, 'viewtip', '1'); try { globalThis.toastr?.info?.(raw ? '원작 화면으로 바꿨어요. 레몬 단추를 다시 누르면 블루레몬 맞춤 화면으로 돌아와요.' : '블루레몬 맞춤 화면으로 바꿨어요.', '미트볼 상태창'); } catch { /* 알림 없이 */ } }
}
export function dismissStart(root) { root.querySelector('.bl-ext-start')?.setAttribute('hidden', ''); remember(root, 'start', '0'); }

/** 한 칸을 정리해요 — 이미 했으면(표식) 그대로, 표가 없거나 맞는 줄이 하나도 없으면 아무것도 안 해요. 했으면 true */
export function organize(root, set) {
    const plan = PLANS[set.root], content = root.querySelector('.inline-drawer-content');
    if (!plan || !content || root.dataset.blOrg) return false;
    const rows = [...content.children].filter(e => !own(e));
    const info = rows.map(e => ({ keys: keysOf(e), num: e.localName === 'label' && !!e.querySelector(':scope > input[type="number"]'), small: e.localName === 'small', group: e.dataset.blTabG ?? '0' }));
    const p = planRows(info, plan);
    if (!p.folds.length && !p.intro.length) return false;
    const doc = root.ownerDocument, open = new Set(recall(root, 'fold').split(',').filter(Boolean));
    // 긴 설명 문단 → 한 줄 + 「자세히」. 탭 맨 위 문단(묶음 머리 바로 아래)은 탭 한 줄 설명이 요약을 맡으니 통째로 접고 「자세히」를 그 설명 줄 끝에 달아요
    const more = new Map(), introMore = new Map(), introGroups = new Set(p.intro.map(pair => pair[0]));
    rows.forEach((row, i) => {
        if (!info[i].small || String(row.textContent || '').trim().length < CLAMP_FROM) return;
        const group = info[i].group, top = introGroups.has(group) && !introMore.has(group) && (i === 0 || info[i - 1].group !== group || rows[i - 1].matches(set.head));
        const button = make(doc, 'button', 'bl-ext-more', '자세히', top ? null : group);
        button.setAttribute('aria-expanded', 'false'); button.dataset.blMoreFor = `c${i}`;
        row.dataset.blClampId = `c${i}`; row.dataset.blClamp = top ? 'hide' : '';
        if (top) { button.dataset.blMoreHide = '1'; introMore.set(group, button); } else { row.after(hidden(button)); more.set(i, button); }
    });
    rows.forEach((row, i) => {
        const mark = p.rows[i];
        if (mark.fold) { row.dataset.blFold = mark.fold; if (!open.has(mark.fold)) row.dataset.blFoldOff = ''; const b = more.get(i); if (b) { b.dataset.blFold = mark.fold; if (!open.has(mark.fold)) b.dataset.blFoldOff = ''; } }
        if (mark.col) row.dataset.blCol = '';
        if (mark.cost) row.dataset.blCost = mark.cost;
    });
    for (const fold of p.folds) {
        const button = hidden(make(doc, 'button', 'bl-ext-fold', '', fold.group));
        button.dataset.blFoldFor = fold.id; button.dataset.blNames = fold.names.map(pair => pair.join(':')).join('|');
        button.setAttribute('aria-expanded', String(open.has(fold.id)));
        button.append(make(doc, 'span', 'bl-ext-fold-t', fold.title), make(doc, 'small', 'bl-ext-fold-v', ''));
        rows[fold.first].before(button);
    }
    // 탭 한 줄 설명: 그 탭의 묶음 머리 바로 아래(머리 없는 첫 탭은 탭 줄 아래)
    for (const [group, text] of p.intro) {
        const at = rows.find((e, i) => info[i].group === group && e.matches(set.head)) || (group === '0' ? content.querySelector(':scope > .bl-ext-tabs') : null);
        if (!at) continue;
        const line = hidden(make(doc, 'small', 'bl-ext-intro', text, group));
        if (introMore.has(group)) line.append(' ', introMore.get(group));
        at.after(line);
    }
    // 처음 쓰는 사람 길잡이(첫 탭 · 닫으면 다시 안 떠요)
    const tabs = content.querySelector(':scope > .bl-ext-tabs');
    if (plan.start && tabs && recall(root, 'start') !== '0') {
        const box = hidden(make(doc, 'div', 'bl-ext-start', '', '0'));
        box.append(make(doc, 'span', 'bl-ext-start-t', plan.start[0]));
        for (const [label, key] of plan.start[1]) { if (!rows.some((e, i) => info[i].keys.includes(key))) continue; const jump = make(doc, 'button', 'bl-ext-jump', label); jump.dataset.blJump = key; box.append(jump); }
        const close = make(doc, 'button', 'bl-ext-start-x', '×'); close.setAttribute('aria-label', '길잡이 닫기'); close.title = '닫기';
        box.append(close);
        (content.querySelector(':scope > .bl-ext-intro') || tabs).after(box);
    }
    // 서랍 머리의 보기 스위치
    const header = root.querySelector('.inline-drawer-header');
    if (header && !header.querySelector('.bl-ext-view')) { const button = hidden(make(doc, 'button', 'bl-ext-view', '')); const icon = header.querySelector('.inline-drawer-icon'); if (icon) icon.before(button); else header.append(button); }
    root.dataset.blOrg = '1';
    setView(root, recall(root, 'view') === 'raw');
    refreshSummaries(root);
    return true;
}
/** 길잡이 단추: 그 칸이 있는 탭 번호 */
export function groupOfKey(root, key) {
    const row = root.querySelector(`[data-s="${key}"]`)?.closest('.inline-drawer-content > *');
    return row && 'blTabG' in row.dataset ? Number(row.dataset.blTabG) : -1;
}
