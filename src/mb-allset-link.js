// 1.7.9 미트볼 「관리 › 전체 설정」 안에 블루레몬 맞춤으로 가는 바로가기 한 줄 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
//   그 확장 2.9.0 개발 판(4c7df674)은 확장 서랍 설정 칸을 상태창 안 「전체 설정」에 한 벌 더 그려요. 그 칸에는 그 확장 설정만 있어
//   블루레몬 맞춤(그림 · 간격 · 데이터 스위치 — 서랍 칸의 「블루레몬」 레몬 탭)은 상태창 안에서 찾을 길이 없었어요(11-18 조정자 결정 1 · 추천대로).
//   하는 일: 그 칸 맨 위 안내 글 바로 아래에 테마 한 줄(설명 + 「블루레몬 맞춤 열기」 단추)을 끼워요. 단추는 그 창을 닫고 레몬 탭으로(테마 설정 찾기와 같은 길 gotoMbLemon).
//   그 확장의 요소 · 자료 · 파일은 안 건드려요(제 줄 하나만 더해요). 「원작 그대로 보기」면 안 넣어요. 꼴은 맞춤 시트(@mb drawer).
//   감시자를 새로 걸지 않아요: 화살표 모듈(src/mb-arrow.js)의 채팅 밖 구독을 나눠 받아요(감시 허브 구독 자리를 늘리지 않게). 시험: tools/tests/mb-allset-link.mjs
import { onMbAdded } from './mb-arrow.js';
import { gotoMbLemon } from './mb-lemon.js';

export const ROW = 'bl-mb-link';
const raw = doc => !!doc?.body?.hasAttribute?.('data-bl-ext-raw');
const CLOSE = '.popup-button-cancel, .popup-button-close, [data-act="close"], .popup-button-ok';

/** 그 칸(.ss-set-sheet)에 바로가기 한 줄을 끼워요 → 끼웠으면 true. go · wait 는 시험용 */
export function addLink(sheet, { go = path => gotoMbLemon(path, sheet?.ownerDocument), wait = () => new Promise(r => setTimeout(r, 250)) } = {}) {
    const doc = sheet?.ownerDocument;
    if (!doc || raw(doc) || sheet.querySelector(`:scope > .${ROW}`)) return false;
    const row = doc.createElement('div'); row.className = ROW;
    const text = doc.createElement('small'); text.className = 'ss-hint';
    text.textContent = '그림 · 간격 · 칩 · 데이터를 고치는 블루레몬 맞춤은 확장 › 미트볼 상태창 › 블루레몬 탭에 있어요.';
    const btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'ss-btn sm';
    const ico = doc.createElement('i'); ico.className = 'fa-solid fa-lemon'; ico.setAttribute('aria-hidden', 'true');
    btn.append(ico, doc.createTextNode(' 블루레몬 맞춤 열기'));
    btn.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        try { btn.closest('dialog')?.querySelector(CLOSE)?.click(); } catch { /* 창은 그대로 */ }
        try { await wait(); await go(''); } catch { /* 길을 못 찾으면 그대로 */ }
    });
    row.append(text, btn);
    const anchor = sheet.querySelector(':scope > .ss-hint') || sheet.querySelector(':scope > .ss-set-find');
    if (anchor) anchor.after(row); else sheet.prepend(row);
    return true;
}
let on = false;
export function startAllsetLink(doc = globalThis.document, { added = onMbAdded } = {}) {
    if (on || !doc?.body) return false;
    on = true;
    const sweep = () => { for (const s of doc.querySelectorAll('.ss-set-sheet')) try { addLink(s); } catch { /* 그 칸 그대로 */ } };
    sweep();
    try {
        added(records => {
            let hit = false;
            for (const r of records) for (const n of r.addedNodes || []) if (n.nodeType === 1 && (n.matches?.('.ss-set-sheet') || n.querySelector?.('.ss-set-sheet'))) hit = true;
            if (hit) sweep();
        });
    } catch { /* 처음 훑은 것만 */ }
    return true;
}
