// 1.6.0 눈 감긴 메시지를 미트볼 상태에서 빼기 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문 · 설정 칸이 있을 때).
// 11-16 사용자 「미트볼 내가 눈감기거나 없앤 메시지도 반영되나봐」 「장기기억처럼 알아서 빠져야지」:
//   그 확장은 상태를 따로 쌓아 두지 않고 「처음 상태 + AI 답마다 적힌 변화」 를 처음부터 다시 더해 보여 줘요. 지운 답은 그래서 저절로 빠져요.
//   눈을 감긴 답은 일부러 계속 더해요(요약 확장이 옛 답을 숨겨도 돈 · 호감이 안 날아가게 — 원작 2.7.23 · 2.8 준비 갈래 같음). 다만 「진짜 시스템 메시지」(실리태번 메시지의 extra.type 칸이 찬 것)는 안 더해요.
//   원작 파일 · 원작이 적어 둔 자료(extra.statussim · 채팅 메타)는 고치지 않아요. 사용자가 **눈 단추를 직접 눌러** 감긴 AI 답에만 실리태번 메시지의 extra.type 칸에 표식 한 낱말을 적어요 —
//   그 확장이 그 답을 건너뛰어요. 눈을 뜨면 표식을 지워요(그 답의 변화가 그대로 돌아와요 — 변화 자료는 한 글자도 안 건드렸으니까요).
//   · 표식은 감긴 동안만 뜻이 있어요: 보이는 답에 남은 표식은 그 확장이 안 봐요(테마를 지워도 눈만 뜨면 원래대로).
//   · 기본 켬(11-16 사용자 「ㅇㅇ 켬 ㄱㄱ」). 사용자가 손으로 감긴 답만 봐요: ① 눈 단추 누름 ② 테마의 「접기」(눈 길게 누르기 — src/mes-fold.js 가 접은 답에 남기는 extra.bl_folded).
//   · 이미 감겨 있던 답 가운데 「접기」 로 감긴 것(bl_folded · 접기 전부터 감겨 있던 것은 뺌)은 채팅을 열 때 같은 표식을 달고 한 줄로 알려요 — 누가 감겼는지 아는 답뿐이에요.
//   · 그 밖에 감긴 답은 안 건드려요 — 요약 · 기억 확장의 자동 숨김 · /hide 명령으로 감긴 옛 답이 빠지면 쌓인 호감 · 돈이 날아가요(누가 감겼는지 메시지에 단서가 없어요). 이미 extra.type 이 있는 답(내레이터 등)도 그대로 둬요.
//   · 그 확장을 통째로 껐거나 · 이 채팅에서 껐거나 · 상태창이 없는 채팅에서는 아무것도 안 해요.
//   · 다시 계산은 그 확장의 공개 명령(/ss-resume · 멈춰 둔 채팅이면 /ss-pause — 지금 값 그대로 다시 적고 새로 계산)으로 불러요. 실리태번 사건을 지어내 쏘지 않아요(번역 · 요약 확장이 같이 움직여요).
//   · 오래된 답(그 확장이 「굳힌 기록」 으로 합친 구간)은 빼도 숫자가 안 바뀌어요 — 한 번 알려요.
// 감시자 · 타이머 없음: 눈 단추 누름(문서 한 곳) · 채팅 바뀜 · 생성 시작 때만 봐요. 설정은 body 표식(data-bl-mb-hidden-sync = on · off — src/apply.js)으로 읽어요.
// 1.7.4 감긴 답보다 뒤에 칸 통째 저장이 있으면 그 저장 바로 뒤에 빼는 기록을 끼워 바로 반영해요(src/mb-autosub.js · 스위치 autosub · 기본 켬). 못 하면 1.7.3 알림이에요.
import * as Sub from './mb-autosub.js';
import { startEditSync } from './mb-editsync.js';   // 1.7.6 본문을 고치면 수치도 따라 바꾸기
import { ctx } from './mb-util.js';   // 1.9.2 공용 맥락 읽기
const META = 'statussim';   // 그 확장의 채팅 메타 칸 이름(읽기만)
export const MARK = 'bl-hidden';
export const ATTR = 'data-bl-mb-hidden-sync';
export const EVENT = 'bl-mb-hidden-sync';
export const FOLD_EVENT = 'bl-mes-fold';   // src/mes-fold.js 가 접기 · 펼치기를 끝낸 뒤 내는 사건(detail.id)

// 표식 값: on · off — 없으면 테마가 아직 설정을 안 입힌 것(모름)이라 아무것도 안 해요(켜 둔 사람의 표식을 시작 틈에 지우지 않게)
export const enabled = (doc = globalThis.document) => doc?.body?.getAttribute?.(ATTR) === 'on';
export const known = (doc = globalThis.document) => !!doc?.body?.hasAttribute?.(ATTR);

/** 이 채팅에 그 확장의 상태창이 있나 — 있으면 메타(읽기만), 없으면 null */
export function sheetOf(c = ctx()) {
    const meta = c?.chatMetadata?.[META];
    if (!meta || typeof meta !== 'object' || !meta.base || meta.off) return null;
    if (c?.extensionSettings?.[META]?.enabled === false) return null;   // 그 확장을 통째로 꺼 둠
    return meta;
}

/** 감긴 AI 답에 표식 — 이미 다른 종류가 적혀 있으면 그대로 둬요. 적었으면 true */
export function mark(m) {
    if (!m || m.is_user || m.is_system !== true) return false;
    if (m.extra != null && typeof m.extra !== 'object') return false;
    if (m.extra?.type) return false;
    (m.extra ??= {}).type = MARK;
    return true;
}
/** 내 표식만 지워요. 지웠으면 true */
export function unmark(m) {
    if (m?.extra?.type !== MARK) return false;
    delete m.extra.type;
    return true;
}

/** 눈 단추를 누른 뒤 그 답 하나: 'out'(뺐어요) · 'in'(돌려놨어요) · 'none' */
export function settle(id, c = ctx(), on = enabled()) {
    const m = c?.chat?.[id];
    if (!m) return 'none';
    if (m.is_system) return on && sheetOf(c) && mark(m) ? 'out' : 'none';
    return unmark(m) ? 'in' : 'none';
}

/** 남은 표식 치우기: 보이는 답의 표식 · 기능을 껐거나 상태창이 없는 채팅의 표식. back = 감긴 채로 돌려놓은 수(다시 계산이 필요해요) */
export function reconcile(c = ctx(), on = enabled()) {
    const out = { removed: 0, back: 0 };
    const chat = c?.chat;
    if (!Array.isArray(chat)) return out;
    const keep = on && !!sheetOf(c);
    for (const m of chat) {
        if (m?.extra?.type !== MARK) continue;
        if (keep && m.is_system) continue;
        delete m.extra.type; out.removed++;
        if (m.is_system) out.back++;
    }
    return out;
}

/** 그 확장에게 다시 계산을 시켜요(공개 명령 · 지금 멈춤 값 그대로). 불렀으면 true */
export async function nudge(c = ctx()) {
    const meta = sheetOf(c);
    if (!meta || typeof c?.executeSlashCommandsWithOptions !== 'function') return false;
    const name = meta.paused ? 'ss-pause' : 'ss-resume';
    if (!c.SlashCommandParser?.commands?.[name]) return false;
    try { await c.executeSlashCommandsWithOptions(`/${name}`, { handleParserErrors: false, handleExecutionErrors: false }); return true; }
    catch { return false; }
}

/** 굳힌 기록 안의 답인가(빼도 숫자가 안 바뀌어요) */
export function baked(id, c = ctx()) {
    const start = Number(sheetOf(c)?.startAt);
    return Number.isFinite(start) && id < start;
}

/**
 * 1.7.4 감긴 답보다 뒤에 그 확장의 「칸 통째 저장」 편집 기록(set.data — 영어 저장 바꾸기 · 직접 편집 · AI 로 수정 · 이모지 바꾸기 등이 남겨요)이 있으면
 *   그 칸은 그때 값으로 통째로 덮여서, 감긴 답이 그 칸에 준 변화(애정 · 우정 등)가 거기 이미 들어가 있으면 빠지지 않아요(11-17 사용자 「눈 감겼는데 호감도 안 내려가는데??」).
 *   원작 동작 · 기록은 그대로 두고(읽기만) 알리기만 해요 — 빼는 길은 그 확장 관리 탭 › 저장 · 되돌리기 › 「편집 기록 — 골라서 지우기」(undoAt)예요.
 *   바뀐 부분만 적은 기록(set.patch) · 지금 안 보이는 기록(_off) · 굳힌 기록 안의 답(baked — 따로 알려요)은 빼요.
 */
const MOD_NAME = { rel: '관계', calendar: '달력', wallet: '재산', stats: '수치', profile: '프로필', map: '지도', memo: '메모', quest: '퀘스트', contact: '연락', home: '집', custom: '맞춤' };
export const hiddenIds = (c = ctx()) => (Array.isArray(c?.chat) ? c.chat : []).flatMap((m, i) => (m?.is_system === true && m.extra?.type === MARK ? [i] : []));
export function frozenBy(ids, c = ctx()) {
    const meta = sheetOf(c); if (!meta || !Array.isArray(meta.adjust)) return [];
    const start = Number(meta.startAt) || 0;
    const live = (Array.isArray(ids) ? ids : []).filter(i => Number.isInteger(i) && i >= start);
    if (!live.length) return [];
    const first = Math.min(...live);
    return meta.adjust.filter(a => a && !a._off && a.set && typeof a.set.mod === 'string' && a.set.data && typeof a.set.data === 'object' && Number(a.at) > first)
        .map(a => ({ mod: a.set.mod, at: Number(a.at), t: a.t, name: String(a.label || '').trim() || `${MOD_NAME[a.set.mod] || a.set.mod} 칸 바뀜` }));
}
export function frozenLine(list, why = '') {
    const rows = list.map(x => `「${x.name}」(${x.at}번 뒤)`).join(' · ');
    return `${why ? `${why} ` : ''}눈 감긴 답보다 뒤에 미트볼이 칸을 통째로 저장한 기록이 있어요: ${rows}. 그 칸은 그때 값으로 덮여서 감긴 답의 변화(애정 · 우정 등)가 거기 들어가 있으면 안 빠져요 — 빼려면 미트볼 관리 탭 › 저장 · 되돌리기 › 「편집 기록 — 골라서 지우기」에서 그 기록을 지워요(그 기록이 한 영어 저장 바꾸기 · 직접 고친 글도 같이 없던 일이 돼요).`;
}
const told = new Set();   // 같은 채팅 · 같은 기록 묶음은 한 번만
async function warnFrozen(c, toast) {
    const list = frozenBy(hiddenIds(c), c); if (!list.length) return false;
    let chat = ''; try { chat = String(c?.getCurrentChatId?.() ?? c?.chatId ?? ''); } catch { /* 이름 없이 */ }
    const key = `${chat}|${list.map(x => x.t).join(',')}`;
    if (told.has(key)) return false;
    told.add(key);
    let why = ''; try { why = Sub.WHY_TEXT[await Sub.whyNot()] || ''; } catch { why = ''; }   // 1.7.7 바로 반영을 못 한 까닭(스위치 끔 · 계산 부분 못 받음)을 앞에 한마디
    try { toast?.info?.(frozenLine(list, why), '', { timeOut: 15000, extendedTimeOut: 5000 }); } catch { /* 알림 없이 */ }
    return true;
}

/** 1.7.7 지운 답을 바로 못 뺀 때: 까닭과 손으로 고치는 길을 채팅마다 한 번 알려요(전에는 조용히 넘어가 숫자가 왜 남았는지 알 길이 없었어요) */
const toldGone = new Set();
export function tellGone(id, toast = globalThis.toastr) {
    if (toldGone.has(id)) return false;
    toldGone.add(id);
    try { toast?.info?.(`지운 답보다 뒤에 미트볼이 칸을 통째로 저장한 기록이 있어서 그 답의 변화(애정 · 우정 등)가 저장 값에 남아 있어요. ${Sub.WHY_TEXT.module} 숫자는 미트볼 상태창에서 직접 고쳐 주세요.`, '', { timeOut: 15000, extendedTimeOut: 5000 }); } catch { /* 알림 없이 */ }
    return true;
}

/** 1.7.4 바로 반영을 해 봐요 — 'changed'(기록을 바꿈) · 'same'(맞춰 봤는데 그대로) · ''(못 함: 스위치 끔 · 그 확장 모듈 못 받음 → 1.7.3 알림) */
async function autoSub(c, opts) {
    if (!Sub.active() || !sheetOf(c)) return '';
    try { const r = await Sub.applyHidden(c, { save: false, ...opts }); return r === null ? '' : (r ? 'changed' : 'same'); } catch { return ''; }
}

/** 표식을 바꾼 뒤: 저장하고 그 확장에게 다시 계산을 시켜요 */
async function after(c) {
    try { await c?.saveChat?.(); } catch { /* 다음 저장 때 같이 가요 */ }
    await nudge(c);
}

/** 눈 단추 누름 처리(실리태번이 숨김 값을 바꾼 뒤) — 결과 낱말을 돌려줘요 */
export async function onEye(id, wantHidden, { c = ctx(), on = enabled(), toast = globalThis.toastr, wait = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
    for (let n = 0; n < 6 && !!c?.chat?.[id]?.is_system !== wantHidden; n++) await wait(120);   // 실리태번의 누름 처리가 먼저 끝나길
    if (!!c?.chat?.[id]?.is_system !== wantHidden) return 'none';
    const how = settle(id, c, on);
    if (how === 'none') return how;
    const subbed = baked(id, c) ? '' : await autoSub(c, { kind: how === 'out' ? 'hid' : 'open' });   // 1.7.4 조용히 반영(알림 없음)
    await after(c);
    if (how === 'out' && baked(id, c)) { try { toast?.info?.('오래된 답이라 미트볼이 이미 합쳐 둔 기록이에요 — 눈을 감겨도 숫자는 그대로예요.', '', { timeOut: 6000 }); } catch { /* 알림 없이 */ } }
    else if (how === 'out' && !subbed) await warnFrozen(c, toast);   // 1.7.3 뒤에 칸 통째 저장이 있으면 알려요(바로 반영을 껐거나 못 할 때만)
    return how;
}

/** 테마의 「접기」 로 사용자가 감긴 답인가(접기 전부터 감겨 있던 답은 아님) */
export const foldedByHand = m => !!m && m.is_system === true && m.extra?.bl_folded === true && m.extra?.bl_fold_was_hidden !== true;

/** 「접기」 로 감겨 있는 AI 답 가운데 아직 표식이 없는 것에 표식 — 단 수를 돌려줘요 */
export async function adopt(c = ctx(), on = enabled(), toast = globalThis.toastr) {
    if (!on || !sheetOf(c) || !Array.isArray(c?.chat)) return 0;
    let n = 0;
    for (const m of c.chat) if (foldedByHand(m) && mark(m)) n++;
    if (!n) return 0;
    await after(c);
    try { toast?.info?.(`접어 둔 답 ${n}개를 미트볼 상태에서 뺐어요. 펼치면 돌아오고, 전부 되돌리려면 테마 설정 「눈 감긴 답은 미트볼 상태에서 빼기」를 꺼요.`, '', { timeOut: 12000, extendedTimeOut: 4000 }); } catch { /* 알림 없이 */ }
    return n;
}

/** 채팅 바뀜 · 생성 시작 · 설정 바뀜: 남은 표식을 치우고, 켜져 있으면 처음 한 번 훑어요 */
export async function tidy(c = ctx(), on = enabled(), sure = known(), toast = globalThis.toastr) {
    if (!sure) return { removed: 0, back: 0, adopted: 0 };
    const r = reconcile(c, on);
    if (r.removed) {
        try { await c?.saveChat?.(); } catch { /* 다음 저장 때 */ }
        if (r.back) await nudge(c);
    }
    r.adopted = await adopt(c, on);
    // 1.7.4 감긴 답 기록 맞추기(표식이 없어졌으면 끼운 기록도 빼요) — 못 하면 1.7.3 알림을 채팅을 열 때 한 번
    const subbed = await autoSub(c, { kind: 'tidy' });
    if (subbed === 'changed') { try { await c?.saveChat?.(); } catch { /* 다음 저장 때 */ } }
    else if (!subbed && on && sheetOf(c)) await warnFrozen(c, toast);
    return r;
}

let started = false;
let undoAt = 0;   // 1.7.4 그 확장 되돌리기 단추를 누른 때
/** 여러 번 불러도 한 번만 걸어요 */
export function startMbHidden(doc = globalThis.document) {
    if (started || !doc?.addEventListener) return false;
    started = true;
    doc.addEventListener('click', event => {
        // 1.7.4 그 확장 관리 탭 되돌리기(골라서 지우기 · 마지막 편집 · 싹 지우기 · 되살리기)를 누르면 끼운 기록을 다시 맞춰요(그 저장이 사라졌으면 같이 빼요)
        //   원작은 「지울까요?」 확인 창을 띄우니, 그 단추를 누른 뒤 1분 안에 확인 창 「예」(.popup-button-ok)를 눌러도 다시 맞춰요
        const undoBtn = event.target?.closest?.('[data-act="undoat"], [data-act="undo"], [data-act="undoall"], [data-act="undoallback"]');
        if (undoBtn || (Date.now() - undoAt < 60000 && event.target?.closest?.('.popup-button-ok'))) { if (undoBtn) undoAt = Date.now(); setTimeout(() => { autoSub(ctx(), { kind: 'tidy' }).catch(() => { /* 다음 기회에 */ }); }, 700); return; }
        const eye = event.target?.closest?.('.mes_hide, .mes_unhide');
        if (!eye) return;
        const id = Number(eye.closest('.mes')?.getAttribute('mesid'));
        if (!Number.isInteger(id) || id < 0) return;
        const wantHidden = eye.classList.contains('mes_hide');
        if (wantHidden && !enabled(doc)) return;   // 꺼 뒀으면 감길 때는 아무것도 안 해요(뜰 때는 남은 표식을 지워요)
        setTimeout(() => { onEye(id, wantHidden).catch(() => { /* 원래 동작 그대로 */ }); }, 60);
    }, true);
    doc.addEventListener(EVENT, () => { tidy().catch(() => { /* 다음 기회에 */ }); });
    doc.addEventListener(FOLD_EVENT, event => {   // 테마의 접기 · 펼치기(눈 길게 누르기)도 손으로 감긴 것
        const id = Number(event?.detail?.id); const c = ctx();
        if (!Number.isInteger(id) || !c?.chat?.[id]) return;
        const hidden = !!c.chat[id].is_system;
        if (hidden && (!enabled(doc) || !foldedByHand(c.chat[id]))) return;
        onEye(id, hidden).catch(() => { /* 원래 동작 그대로 */ });
    });
    try {
        const c = ctx(), on = c?.eventSource?.on?.bind(c.eventSource), types = c?.event_types ?? {};
        const run = () => { tidy().catch(() => { /* 다음 기회에 */ }); };
        if (on && types.CHAT_CHANGED) on(types.CHAT_CHANGED, () => setTimeout(run, 1200));   // 그 확장이 제 메타를 읽은 뒤에
        if (on && types.GENERATION_STARTED) on(types.GENERATION_STARTED, (_type, _opts, dry) => { if (!dry) run(); });
        setTimeout(run, 1200);
        Sub.startAutoSub(doc, { onFail: id => tellGone(id) });   // 1.7.4 지운 답 · 지운 스와이프(실리태번 지움 사건)
        // 1.7.6 편집 창으로 본문을 고친 답 — 칩 표식은 메시지 꾸미기(공용 #chat 구독)에 얹어요: 칩 자리 · 칩 카드 안이 새로 그려진 기록만(본문 · 스트리밍 글은 안 봐요)
        Promise.all([import('./message-decor.js'), import('./mb-arrow.js')]).then(([d, a]) => startEditSync(doc, { decorate: d.addMessageDecorator, filter: a.arrowRecord })).catch(() => startEditSync(doc));
        import('./mb-namekey.js').then(m => m.startNameKey(doc)).catch(() => { /* 원래 동작 그대로 */ });   // 1.7.9 이름이 앞에 온 변화 줄도 읽기
    } catch { /* 눈 단추만 */ }
    return true;
}
