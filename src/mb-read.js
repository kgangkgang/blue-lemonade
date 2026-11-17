// 1.6.1 미트볼 「상태창 만들기」 화면의 「채팅 읽기」 고르기 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
// 11-16 사용자(1.6.0 을 깐 뒤 만들기 화면을 보고) 「엥 근데 상태창만들기화면에 최근 대화고르는그게없는데?」:
//   「미트볼 문구: 블루레몬 추천」 · 「이번 한 번만 채팅 전체로」 가 테마 설정 깊숙이(채팅 › 화면)만 있어서 정작 만드는 자리에서 못 찾았어요.
//   → 만들기 창 맨 위 요약 칸(캐릭터 · 유저 · 로어북 · 채팅 N개)의 「채팅 N개」 줄 오른쪽에 작은 고르기를 놓아요: 기본(앞 700자씩) · 마지막 답 전체 · 최근 답 여러 개 · 채팅 전체.
//     1.6.2(사용자 다시 물음 「여전히 상태창 만들기에 최근 채팅 다 넣기 없는데?」): 맨 위라 바로 보여요. 고르기는 그 줄에 겹쳐 놓아(시트 · 줄 높이 그대로) 만들기 화면 높이가 바뀌지 않아요
//     — 1.6.1 관문에서 줄 하나만큼 내용이 밀려 화면 맨 아래 ✕ 밑에 걸리는 카드 글이 1 → 2 로 늘어 뺐던 것. 고르기 글은 짧게(기본 · 마지막 답 · 최근 답 · 채팅 전체) · 긴 이름은 풀이(title)와 aria-label.
//     요약 칸을 못 찾는 꼴이면 「추가 지시」 머리줄 오른쪽(「작가 노트 넣기」 앞)에 놓아요(그 자리도 높이 그대로).
//   · 처음 보이는 값 = 사용자의 평소 단계(테마 설정). 다른 것을 고르면 **이번 만들기에만** 적용해요 — 「이번 한 번만」(src/mb-prompt.js armOnce)을 단계별로 넓혀 그대로 써요:
//     요청이 불릴 때마다 끝을 미루고, 마지막 요청 뒤 한동안 조용하거나 · 만들기 창을 닫으면 평소 단계로 돌려놔요. 평소 값으로 다시 고르면 바로 거둬요.
//   · 「기본」 이 아닌 것을 골랐을 때만 요약 칸 바로 아래(머리줄 자리면 입력칸 위)에 이번 만들기의 어림 한 줄: 「채팅 N개 · 요청 1회 약 X · 이번 만들기 약 Y(AI k회)」 — k 는 그 확장이 그 화면에 적는 「AI k회」 를 읽어요(못 읽으면 요청 1회 값만).
//     채팅 전체가 상한에 걸리면 「상한 …으로 줄임 — 오래된 답 N개는 앞부분만」 을 같은 줄에.
//   알아채기는 작가 노트 넣기(src/mb-note.js · mb-note.css)의 0.001초 애니메이션 신호를 같이 들어요(감시자를 새로 만들지 않아요). 창이 닫힌 것은 공용 감시 허브의 body 직속 구독 하나로 알아요.
//   그 확장의 파일 · 자료 · 함수는 안 건드려요(고르기 한 줄을 덧붙이고, 사용자가 고칠 수 있는 문구 설정은 mb-prompt.js 가 지금까지와 같은 방식으로 다뤄요).
//   「원작 그대로 보기」 · 테마 꺼짐이면 신호가 안 나서 줄이 없고, 이미 놓인 줄은 시트(src/ext-status.css)가 숨겨요. 시험: tools/tests/mb-read.mjs
import { watchDom } from './dom-watch.js';
export const ANIM = 'bl-mb-note-seen';   // 작가 노트 넣기(src/mb-note.js · mb-note.css)가 지시칸에 거는 신호 이름 — 시험이 같은 이름인지 봐요
// 문구 모듈(src/mb-prompt.js)은 만들기 창이 처음 뜰 때 받아요 — 미트볼만 깔고 이 기능을 안 쓰는 동안에는 안 받아요
let promptMod = null;
const loadPrompt = () => (promptMod ||= import('./mb-prompt.js'));

export const ROW = 'bl-mb-read';
// 1.6.3 (11-17 사용자 「첫 채팅부터 쫙으로 만들었는데 … 반영 안 된 것 같다」 · 「기억 요약 확장에서 매 챗마다 요약된 거라도」):
//   · 「채팅 전체」 어림 줄에 실을 양(메시지 수 · 글자 · 토큰 어림)과 상한에 맞춘 방식(오래된 것은 기억 요약으로 · 앞 1,000자만 · 숨긴 메시지)을 늘 보여요 — 다 들어가면 「다 실어요」.
//     상한을 넘으면 고르는 순간 알림으로 미리 알려요. 보내고 나면 그 줄이 「보냈어요 N번 — 요청마다 …」 로 바뀌고, 끝 알림에도 같은 숫자가 나와요(src/mb-prompt.js).
//   · 「기억 요약」(memo): 기억 확장이 남긴 매 턴 요약을 차례대로 + 마지막 요약 뒤 메시지는 원문. 요약이 없는 채팅이면 알리고 고르기를 되돌려요.
//     「채팅 전체」 와 겹쳐 고르지 않아요 — 다 들어가는 채팅이면 원문이 요약보다 더 많이 담고(같은 이야기를 두 번 실을 까닭이 없어요),
//     안 들어가는 채팅이면 「채팅 전체」 가 넘치는 오래된 메시지를 그 요약으로 바꿔 실어요(= 둘을 합친 것). 긴 채팅을 싸게 읽히고 싶을 때 「기억 요약」 하나만 골라요.
export const PICKS = [['base', '기본(앞 700자씩)'], ['last', '마지막 답 전체'], ['recent', '최근 답 여러 개'], ['all', '채팅 전체'], ['memo', '기억 요약(매 턴 요약 + 그 뒤 원문)']];
/** 머리줄 고르기에 보이는 짧은 글(값 차례는 PICKS 와 같아요) */
export const SHORT = { base: '기본', last: '마지막 답', recent: '최근 답', all: '채팅 전체', memo: '기억 요약' };
/** 테마 설정 단계 → 고르기 값(적용 안 함 · 가볍게는 둘 다 「기본」) */
export const pickOf = lv => (lv === 'last' || lv === 'recent' || lv === 'all' || lv === 'memo' ? lv : 'base');
/** 고르기 값 → 이번 한 번에 쓸 단계(「기본」 은 평소가 기본 쪽이면 평소 그대로, 아니면 적용 안 함) */
export const levelFor = (pick, usual) => (pick === 'base' ? (pickOf(usual) === 'base' ? (usual === 'light' ? 'light' : 'off') : 'off') : pick);
const num = n => Math.round(Number(n) || 0).toLocaleString('ko-KR');
const big = n => { const v = Math.round(Number(n) || 0); return v >= 10000 ? `${(v / 10000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '')}만` : num(v); };
/** 그 확장이 만들기 화면에 적는 「AI k회」 → k (못 읽으면 0) */
export function aiCalls(text) {
    const m = /AI\s*(\d+)\s*회/.exec(String(text ?? ''));
    return m ? Number(m[1]) : 0;
}
/** 어림 한 줄. chat = 테마 설정의 chat 칸(평소 단계 · 수 · 글자 · 상한) · P = 문구 모듈(estimate · allText) */
export function costLine(pick, chat = {}, c = undefined, costText = '', P = null) {
    if (!P) return '';
    const usual = chat.mbPrompt || 'off', lv = levelFor(pick, usual);
    const count = chat.mbPromptCount ?? P.DEFAULT_COUNT, chars = chat.mbPromptChars ?? P.DEFAULT_CHARS, cap = chat.mbPromptCap ?? P.DEFAULT_CAP;
    let all = null, one = 0, memo = null;
    try { all = P.allText(c, cap); one = P.estimate(lv, c, count, chars, cap); if (lv === 'memo') memo = P.memoText(c, cap); } catch { return ''; }
    if (lv === 'memo' && !memo?.count) return P.fillLine('memo', memo || { count: 0 });
    const k = aiCalls(costText);
    const over = lv === 'all' && (all.summarized || all.cut || all.dropped);
    const parts = [lv === 'all' ? `${P.fillLine('all', all)}${over ? ` — 상한 ${big(cap)}에 맞춤` : ' — 다 실어요'}` : lv === 'memo' ? P.fillLine('memo', memo) : `채팅 ${num(all.total)}개`, one ? `요청 1회 약 ${big(one)} 토큰 더` : '더 드는 토큰 없음'];
    if (one && k) parts.push(`이번 만들기 약 ${big(one * k)} 토큰 더(AI ${k}회)`);
    const lim = lv === 'all' ? (P.overModel?.(all.text, c) || 0) : lv === 'memo' ? (P.overModel?.(memo.text, c) || 0) : 0;   // 1.6.5 모델 한도를 넘을 게 확실할 때만(모르면 말 안 함)
    if (lim) parts.push(`모델 한도(약 ${big(lim)} 토큰)를 넘을 수 있어요`);
    return parts.join(' · ');
}
/** 보낸 뒤 줄: 「보냈어요 N번 — 요청마다 …」(이번 한 번만이 고른 단계로 걸려 있고 요청이 보였을 때만 · 아니면 '') */
export function sentLine(pick, chat = {}, P = null) {
    const info = P?.onceInfo?.();
    if (!info?.seen || pick === 'base' || info.level !== levelFor(pick, chat.mbPrompt || 'off')) return '';
    return `보냈어요 ${num(info.seen)}번${info.fill && (info.level === 'all' || info.level === 'memo') ? ` — 요청마다 ${P.fillLine(info.level, info.fill)}` : ''}`;
}
/** 머리줄에 놓을 고르기(이름 「읽기」 + 고르기)를 만들어요 */
export function makeRow(doc, pick) {
    const row = doc.createElement('label'); row.className = ROW; row.hidden = true;   // 맞춤 시트 규칙이 걸릴 때만 보여요(원작 그대로 보기 · 테마 꺼짐이면 숨김)
    row.title = '채팅 읽기 — 이번 만들기에서 채팅을 얼마나 읽을지';
    const name = doc.createElement('span'); name.textContent = '읽기';
    const sel = doc.createElement('select'); sel.className = `${ROW}-sel`; sel.setAttribute('aria-label', '채팅 읽기 — 이번 만들기에서 채팅을 얼마나 읽을지');
    for (const [v, t] of PICKS) { const o = doc.createElement('option'); o.value = v; o.textContent = SHORT[v]; o.title = t; sel.append(o); }
    sel.value = pick;
    row.append(name, sel);
    return row;
}
/** 입력칸 위 어림 한 줄(비면 시트가 숨겨요 — 「기본」 이면 높이 0) */
export function makeCost(doc) {
    const cost = doc.createElement('small'); cost.className = `${ROW}-cost`; cost.hidden = true;
    return cost;
}
/** 만들기 창의 추가 지시 칸(textarea.ss-w-ins)에서 줄을 놓을 자리 — 모르는 구조면 null */
export function slotOf(el) {
    if (el?.tagName !== 'TEXTAREA' || !el.classList?.contains('ss-w-ins')) return null;
    const sec = el.closest?.('.ss-sec'), root = el.closest?.('.ss-wizard') || el.closest?.('dialog');
    const head = sec?.querySelector?.('.ss-sec-h');
    if (!sec || !root || !head) return null;
    const found = root.querySelector?.('.ss-found');
    const chatRow = found ? [...(found.children || [])].find(d => d.querySelector?.('span')?.textContent?.trim() === '채팅') || null : null;
    return { sec, head, input: el, root, found: chatRow ? found : null, chatRow };
}
const defaultSettings = async () => (await import('./settings.js')).getSettings();
let started = false;
export function startMbRead(doc = globalThis.document, { watch = watchDom, settings = defaultSettings, load = loadPrompt, toast = () => globalThis.toastr, ctx = () => globalThis.SillyTavern?.getContext?.() } = {}) {
    if (started || !doc?.addEventListener) return false;
    started = true;
    let chat = {}, host = null, hostQuiet = false, P = null, lastRow = null, heard = false, armedBase = null, armedChat = undefined;   // armedChat: 고르기를 건 채팅(버그 사냥 9 — 채팅을 바꿔 창이 치워지면 새 채팅을 고치지 않게)      // host = 이번 한 번을 건 만들기 창 · P = 문구 모듈(창이 처음 뜰 때) · lastRow = 마지막으로 놓은 고르기
    const prev = new WeakMap();   // 고르기 → 바로 앞 값(기억 요약이 없을 때 되돌려요)
    const refresh = row => {
        try {
            const root = row.closest('.ss-wizard') || row.closest('dialog') || doc;
            const sel = row.querySelector(`.${ROW}-sel`), cost = root.querySelector?.(`.${ROW}-cost`);
            if (!cost) return;
            cost.textContent = sel.value === 'base' ? '' : (sentLine(sel.value, chat, P) || costLine(sel.value, chat, undefined, root.querySelector?.('.ss-w-cost')?.textContent || '', P));   // 「기본」 이면 고르기 한 줄만 — 어림 줄은 다른 것을 골랐을 때만(빈 줄은 시트가 숨겨요 · 만들기 화면이 길어지지 않게) · 보낸 뒤에는 보낸 양
        } catch { /* 줄 없이 */ }
    };
    const warn = (text, ms = 12000) => { try { toast()?.warning?.(text, '', { timeOut: ms }); } catch { /* 알림 없이 */ } };
    const place = async el => {
        const slot = slotOf(el); if (!slot) return null;
        let row = slot.root.querySelector(`.${ROW}`);
        try { chat = (await settings())?.chat || {}; } catch { chat = {}; }
        try { P = await load(); } catch { return null; }   // 문구 모듈을 못 받으면 줄을 놓지 않아요
        try { P.cleanupDupes?.().catch?.(() => { /* 그대로 */ }); } catch { /* 그대로 */ }   // 1.6.8 이미 생긴 중복 프로필(블루레몬이 더한 것만) 정리 — 채팅마다 한 번
        if (!heard && P.onFill) { heard = true; P.onFill(() => { if (lastRow) refresh(lastRow); }); }   // 요청이 실릴 때마다 어림 줄을 「보냈어요」 로
        row = slot.root.querySelector(`.${ROW}`);
        if (!row) {
            const once = P.onceLevel();
            row = makeRow(doc, pickOf(once || chat.mbPrompt));
            const cost = makeCost(doc);
            if (slot.chatRow) {                                               // 맨 위 요약 칸 「채팅 N개」 줄 오른쪽 · 어림 줄은 요약 칸 바로 아래
                row.classList.add(`${ROW}-at`); slot.chatRow.classList.add(`${ROW}-host`); slot.chatRow.append(row);
                cost.classList.add(`${ROW}-cost-top`); slot.found.after(cost);
            } else {
                const note = slot.head.querySelector('.bl-mb-note-r');      // 작가 노트 넣기가 먼저 놓였으면 그 앞 · 아니면 끝(노트 단추는 뒤에 끝으로 붙어요)
                if (note) slot.head.insertBefore(row, note); else slot.head.append(row);
                slot.sec.insertBefore(cost, slot.input);
            }
        }
        const sel0 = row.querySelector(`.${ROW}-sel`); if (sel0 && !prev.has(sel0)) prev.set(sel0, sel0.value);
        lastRow = row;
        refresh(row);
        return row;
    };
    doc.addEventListener('animationstart', event => { if (event.animationName === ANIM) place(event.target).catch(() => { /* 원래 화면 그대로 */ }); }, true);
    doc.addEventListener('change', event => {
        const sel = event.target; if (!sel?.classList?.contains(`${ROW}-sel`)) return;
        const row = sel.closest(`.${ROW}`);
        const cap = chat.mbPromptCap ?? P?.DEFAULT_CAP;
        if (P && sel.value === 'memo') {                                     // 기억 요약이 없는 채팅 — 알리고 되돌려요
            let m = null; try { m = P.memoText(undefined, cap); } catch { m = null; }
            if (!m?.count) { sel.value = prev.get(sel) ?? pickOf(chat.mbPrompt); refresh(row); warn('이 채팅에는 매 턴 기억 요약이 없어요(메모리아 · 코끼리 꼴 요약을 찾아요) — 고르기를 되돌렸어요.', 9000); return; }
        }
        prev.set(sel, sel.value);
        refresh(row);
        if (!P) return;
        const usual = chat.mbPrompt || 'off', want = levelFor(sel.value, usual);
        if (want === 'all') {                                                  // 상한을 넘으면 고르는 순간 미리 알려요
            let a = null; try { a = P.allText(undefined, cap); } catch { a = null; }
            const lim = a ? (P.overModel?.(a.text) || 0) : 0;
            if (lim) warn(`채팅 전체가 지금 연결의 모델 한도(약 ${big(lim)} 토큰)를 넘을 수 있어요 — ${P.fillLine('all', a)}. 막지는 않아요. 넘치면 모델이 앞부분을 못 볼 수 있으니 「기억 요약」 이나 상한을 써 보세요.`, 15000);
            if (a && (a.summarized || a.cut || a.dropped)) warn(`미리 알려요: 채팅 전체가 요청 1회 상한(약 ${big(cap)} 토큰)을 넘어요 — ${P.fillLine('all', a)}. 원문을 다 넣으려면 블루레몬 설정 › 채팅 › 미트볼 문구의 「채팅 전체: 요청 1회 상한」 을 올려요(0 = 없음).`, 15000);
        }
        (async () => {
            if (pickOf(usual) === sel.value) { if (P.onceLevel()) await P.endOnce({ force: true, quiet: true }); host = null; return; }   // 평소 값으로 다시 고름 — 거둬요
            if (await P.armOnce({ level: want, quiet: true })) { host = row.closest('dialog') || row.closest('.ss-wizard'); hostQuiet = want === 'off' || want === 'light'; armedBase = P.baseRef?.() ?? null; armedChat = P.chatKey?.(); }   // 기본 쪽은 요청을 셀 수 없어 닫을 때 조용히 돌려놔요
        })().catch(() => { /* 평소 단계 그대로 */ });
    }, true);
    // 1.6.9 채팅을 열 때 정리(중복 프로필 · 직함 줄 합치기) — 11-17 사용자 폰(1.6.8): 「미트볼 문구」 가 「적용 안 함」 이면 문구 모듈(mb-prompt.js)을 아예 안 받아서
    //   1.6.8 의 채팅 열 때 정리(watchDupes)가 한 번도 안 돌았어요(만들기 창을 열 때만 돌았어요). 이 모듈은 미트볼이 깔려 있으면 늘 받으니 여기서 채팅마다 걸어요.
    //   미트볼 상태창이 있는 채팅을 처음 열 때 문구 모듈을 받아 그 모듈의 채팅 감시(watchChats — 지금 채팅 바로 · 다음부터 채팅이 바뀔 때마다)를 한 번 걸어요.
    //   상태창이 있는 채팅이 없으면 받지 않아요(미트볼 없음 · 상태창 없는 채팅은 그대로 0). 타이머 · 감시자는 이 모듈에 두지 않아요(문구 모듈이 1.6.8 부터 가진 것 하나).
    let tidyOn = false;
    const tidy = () => { if (tidyOn) return; try { const c = ctx(); if (!c?.chatMetadata?.statussim?.base) return; tidyOn = true; load().then(m => m.watchChats?.()).catch(() => { tidyOn = false; }); } catch { /* 다음 채팅에 */ } };
    try { const c = ctx(); const ev = c?.eventTypes?.CHAT_CHANGED ?? c?.event_types?.CHAT_CHANGED; if (ev && c?.eventSource?.on) c.eventSource.on(ev, tidy); } catch { /* 만들기 창을 열 때만 */ }
    tidy();
    // 기능을 켜고 끄면 그 확장이 「AI k회」 를 다시 적어요 — 그 창 안을 누른 뒤 한 박자 뒤에 어림을 다시 적어요
    doc.addEventListener('click', event => {
        const row = event.target?.closest?.('.ss-wizard, dialog')?.querySelector?.(`.${ROW}`);
        if (row && !event.target.closest?.(`.${ROW}`)) queueMicrotask(() => refresh(row));
    });
    // 만들기 창이 닫히면(문서에서 빠지면) 이번 한 번을 거두고 평소 단계로
    try {
        watch(doc.body, { childList: true, name: '미트볼 만들기 채팅 읽기' }, records => {
            if (!host) return;
            for (const r of records) for (const n of r.removedNodes || []) {
                if (n === host || (n.nodeType === 1 && n.contains?.(host))) { host = null; const info = P?.onceInfo?.(); if (info?.seen && P.afterWizard) P.afterWizard({ before: armedBase, level: info.level, chat: armedChat }).catch(() => { /* 그대로 */ }); if (P?.onceLevel()) P.endOnce({ force: true, quiet: hostQuiet }).catch(() => { /* 다음 맞추기에 */ }); return; }   // 1.6.5 적용했으면 관계 숫자를 채팅 기록에 맞춰요(src/mb-prompt.js afterWizard)
            }
        });
    } catch { /* 창을 닫아도 시간이 지나면 돌아가요 */ }
    return true;
}
