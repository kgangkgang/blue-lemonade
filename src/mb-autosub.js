// 1.7.4 눈 감기 · 삭제 바로 반영 — 미트볼 「칸 통째 저장」 기록 뒤에도 감긴 · 지운 답의 변화가 빠지게(11-17 사용자 「이렇게 팝업 띄울 게 아니라 눈 감았거나 삭제했으면 바로 반영되게 안 돼?」)
//   그 확장은 「처음 상태 + 답마다 변화 + 편집 기록」을 다시 계산해요. 편집 기록 가운데 칸 통째 저장(set.data — 영어 저장 바꾸기 · 이모지 바꾸기 등)은 그때 값으로 칸을 덮어서,
//   그 앞 답을 감기거나 지워도 그 답이 준 애정 · 우정 · 돈 · 수치가 저장 값에 남아요(1.7.3 은 알림만 띄웠어요).
//   고르는 길: 통째 저장 값은 손대지 않고, 그 기록 **바로 뒤**에 그 확장의 보통 편집 기록 꼴({ ops:[['aff','이름 -6']], label })을 하나 끼워요.
//     · 빼는 양은 그 확장의 계산(engine.compute)을 그 저장 자리까지 두 번 돌려(감긴 · 지운 답을 셈 / 안 셈) 그 차이로 구해요 — 상한(-100~100) · 합친 이름(rel.alias · _merge) ·
//       한 줄에 여러 사람(「A +3, B +2」) · 배율이 전부 원작 계산 그대로예요.
//     · 끼운 기록은 그 확장 관리 탭 › 저장 · 되돌리기 › 「편집 기록 — 골라서 지우기」에 이름(「눈 감긴 답 #31~#42 빼기 (블루레몬)」)으로 보이고, 지우면 없던 일이 돼요(원작 undoAt).
//       테마는 사용자가 지운 것을 알아채고(chat_metadata.bl_mbsub.no) 그 저장에는 다시 안 끼워요.
//     · 눈을 뜨면 그 기록을 빼고 다시 구해요 → 원작이 처음부터 다시 계산하니 상한에 잘린 몫까지 정확히 돌아와요(테마가 숫자를 되돌려 더하지 않아요).
//     · 자리(at)는 그 저장과 같고 시각(t)은 그 저장과 바로 다음 기록 사이 — 원작 orderAdjust 가 다른 기록의 자리를 당기지 않아요. 기록 배열에서도 그 저장 바로 뒤에 둬서 「마지막 편집 되돌리기」 차례가 그대로예요.
//     · 조용한 기록(silent)이라 하루 정리 · AI 에게 가는 「방금 한 일」 줄에 안 들어가요. 묶지 않는 기록(keep)이라 답을 다시 생성해도 그대로예요.
//   지운 답: 실리태번이 답을 지우면 그 답의 변화 줄도 같이 사라져서 나중에는 구할 수 없어요. 그래서 채팅을 열 때 · 답이 생기거나 바뀔 때 답마다 (메시지 · 그 스와이프 글 · 변화 줄)을
//     세션 메모리에만 기억해 두고(참조만 · 복사 없음), 지움 사건(MESSAGE_DELETED · MESSAGE_SWIPE_DELETED)에 지운 답을 그 자리에 잠깐 되돌려 놓고 같은 두 번 계산으로 빼요.
//     지운 답은 되살릴 길이 없으니 이 기록은 다시 구하지 않아요(되돌리기는 원작 「골라서 지우기」).
//   원작 파일 · 원작 함수는 고치지 않아요. 그 확장의 채팅 메타(statussim.adjust)에 기록을 더하고 빼는 것만 해요(테마가 단 기록에는 bl_sub 칸이 있어요 · 그것만 지워요).
//   스위치: 미트볼 맞춤 「데이터를 고치는 것」 › 「눈 감기 · 삭제 바로 반영」(열쇠 autosub · 기본 켬). 끄면 더는 안 끼우고 1.7.3 알림만 띄워요(이미 끼운 기록은 그대로 · 되돌리기는 원작).
//   시험: tools/tests/mb-autosub.mjs
import { mbOff } from './mb-switch.js';

export const KEY = 'autosub';
export const TAG = 'bl_sub';
export const REC = 'bl_mbsub';
const META = 'statussim';
const MARK = 'bl-hidden';   // src/mb-hidden.js 의 표식(서로 부르지 않게 같은 글을 둬요)
const SUB_MODS = new Set(['rel', 'wallet', 'stats']);
const norm = x => String(x ?? '').replace(/\s+/g, '').toLowerCase();
const ctx = () => { try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; } };

export const isOurs = a => !!a && typeof a === 'object' && !!a[TAG] && typeof a[TAG] === 'object';
export const active = (doc = globalThis.document) => !mbOff(KEY, doc) && (!doc?.body?.classList?.contains || doc.body.classList.contains('salty'));

function sheet(c) {
    const meta = c?.chatMetadata?.[META];
    if (!meta || typeof meta !== 'object' || !meta.base || meta.off || !Array.isArray(meta.adjust)) return null;
    if (c?.extensionSettings?.[META]?.enabled === false) return null;
    return meta;
}
export function startOf(meta, chat) {
    let st = Math.min(Number(meta.startAt) || 0, chat.length);
    if (meta.startKey && chat[st - 1]?.send_date !== meta.startKey) { const j = chat.findIndex(m => m?.send_date === meta.startKey); if (j >= 0) st = j + 1; }
    return st;
}
/**
 * 테마 메타 칸 하나(chat_metadata.bl_mbsub)
 *   ent = 끼워 둔 테마 기록 [기록 t, 그 저장 t] · no = 사용자가 관리 탭에서 테마 기록을 하나라도 지운 저장(그 저장은 다시 안 맞춰요)
 *   pos = 저장마다 참 자리(그 저장 앞에 원래 있던 메시지 수) — 원작은 답을 지워도 저장 자리(at = 그때 메시지 수)를 안 당겨서,
 *         중간 답을 지우면 저장 뒤에 있던 답이 저장 앞으로 들어와요. 테마가 지움을 볼 때 참 자리를 당겨 적어 두고 「저장 당시」 계산에 써요(at 과 같으면 안 적어요).
 */
function rec(c) {
    const md = c?.chatMetadata, r0 = md?.[REC];
    const pos = r0?.pos && typeof r0.pos === 'object' ? { ...r0.pos } : {};
    return { ent: Array.isArray(r0?.ent) ? r0.ent.filter(x => Array.isArray(x) && x.length === 2) : [], no: Array.isArray(r0?.no) ? r0.no.slice() : [], pos };
}
function putRec(c, R) {
    const md = c?.chatMetadata; if (!md) return;
    const pos = Object.keys(R.pos).length ? R.pos : null;
    if (R.ent.length || R.no.length || pos) md[REC] = { ent: R.ent, no: R.no, ...(pos ? { pos } : {}) };
    else if (md[REC]) delete md[REC];
}
const posOf = (R, S) => { const p = Number(R.pos[String(S.t)]); return Number.isFinite(p) ? Math.min(p, S.at) : S.at; };

/** 숫자를 담은 칸 통째 저장(그 확장 기록 · 따로 보관 덩어리 · 테마 기록 빼고) — 원작 계산 차례(at → t) */
export function liveSets(meta) {
    return (meta?.adjust ?? []).filter(a => a && !a._off && !a.side && !isOurs(a) && a.set && SUB_MODS.has(a.set.mod) && a.set.data && typeof a.set.data === 'object')
        .slice().sort((a, b) => a.at - b.at || a.t - b.t);
}
const after = (a, S) => a.at > S.at || (a.at === S.at && a.t > S.t);
/** 그 저장 당시에는 없던 테마 기록(그 저장보다 나중에 만든 것) — 「저장 당시」 계산에서 빼요 */
const newer = S => a => isOurs(a) && !(Number(a[TAG].made) <= S.t);

/** 칸 하나의 숫자들 — 열쇠 → { v, key(그 확장 변화 키), name } */
export function numbers(data, mod) {
    const out = new Map(); const d = data?.[mod];
    if (!d || typeof d !== 'object') return out;
    if (mod === 'rel') for (const r of Array.isArray(d.user) ? d.user : []) {
        if (!r?.name) continue;
        for (const k of ['aff', 'trust']) if (Number.isFinite(r[k])) out.set(`${k}:${norm(r.name)}`, { v: r[k], key: k, name: r.name });
    }
    if (mod === 'wallet' && Number.isFinite(d.cash)) out.set('cash', { v: d.cash, key: 'cash', name: '' });
    if (mod === 'stats') for (const b of Array.isArray(d.bars) ? d.bars : []) if (b?.name && Number.isFinite(b.cur)) out.set(`stat:${norm(b.name)}`, { v: b.cur, key: 'stat', name: b.name });
    return out;
}
const fmt = d => (d > 0 ? `+${+d.toFixed(6)}` : `${+d.toFixed(6)}`);
/**
 * 저장 값(saved)을 「저장 당시 계산(A)」 에서 「지금 계산(B)」 으로 옮기는 몫 = B − A. 그 몫을 그 확장 변화 키로(['aff', '이름 -6']).
 *   저장 값이 이미 B 와 같고 A 와 다르면(감긴 채 · 뺀 뒤에 저장된 칸) 건너뛰어요. 손으로 고친 숫자는 A 와 달라도 몫만 옮겨서 그대로 남아요.
 */
export function deltaOps(mod, saved, A, B) {
    const ops = [];
    for (const [k, sv] of saved) {
        const a = A.get(k), b = B.get(k); if (!a || !b) continue;
        const d = b.v - a.v; if (Math.abs(d) < 1e-9) continue;
        if (sv.v === b.v && sv.v !== a.v) continue;
        ops.push(sv.key === 'cash' ? ['cash', fmt(d)] : [sv.key, `${b.name || sv.name} ${fmt(d)}`]);
    }
    return ops;
}

/**
 * 그 저장(S) 앞까지 그 확장 계산을 돌려요 — S 와 그 뒤 기록 · drop 에 걸린 기록은 잠깐 빼고, edits 로 채팅을 잠깐 바꿔요(끝나면 그대로 돌려놔요 · 동기라 사이에 그림 · 저장 없음).
 *   limit = 몇 번 메시지 앞까지(기본 S.at) · edits: { unmark: 메시지 }(감긴 표식 잠깐 지움 = 셈) · { insert: 메시지, at }(지운 답 잠깐 되돌림 — 작은 자리부터) · { replace: 자리, m }
 */
export function computeAt(eng, meta, chat, S, { drop = () => false, edits = [], limit = S.at } = {}) {
    const saved = meta.adjust, undo = [];
    meta.adjust = saved.filter(a => a !== S && !after(a, S) && !drop(a));
    // 참 자리(limit)가 저장 자리보다 앞이면: 그 저장보다 먼저 한 기록(같은 자리의 합치기 등)도 참 자리로 잠깐 당겨 계산에 넣어요
    if (limit < S.at) for (const a of meta.adjust) if (a.at > limit) { const was = a.at; a.at = limit; undo.unshift(() => { a.at = was; }); }
    try {
        for (const e of edits) {
            if (e.unmark) { const m = e.unmark; if (m?.extra?.type === MARK) { delete m.extra.type; undo.push(() => { m.extra.type = MARK; }); } }
            else if (e.insert) { const m = e.insert; chat.splice(e.at, 0, m); undo.push(() => { const i = chat.indexOf(m); if (i >= 0) chat.splice(i, 1); }); }
            else if (Number.isInteger(e.replace)) { const i = e.replace, old = chat[i]; chat[i] = e.m; undo.push(() => { chat[i] = old; }); }
        }
        return eng.compute(limit, { bake: true })?.state ?? null;
    } finally {
        for (let k = undo.length - 1; k >= 0; k--) { try { undo[k](); } catch { /* 다음 것 */ } }
        meta.adjust = saved;
    }
}

/** 메시지 번호 묶기: [31,32,33,40] → 「#31~#33 · #40」 */
export function idsText(ids) {
    const s = [...new Set(ids)].filter(Number.isInteger).sort((a, b) => a - b); const out = [];
    for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i ? `#${s[i]}~#${s[j]}` : `#${s[i]}`); i = j; }
    return out.join(' · ');
}
/** 그 저장 바로 뒤 시각 — 그 저장과 다음 기록 사이 */
function tAfter(meta, S) {
    let next = Infinity;
    for (const a of meta.adjust) if (a !== S && a.t > S.t && a.t < next) next = a.t;
    return Number.isFinite(next) ? S.t + (next - S.t) / 2 : S.t + 0.5;
}
function insertAfter(meta, S, entry) {
    const i = meta.adjust.indexOf(S);
    let j = i + 1; while (j < meta.adjust.length && isOurs(meta.adjust[j]) && meta.adjust[j][TAG].of === S.t) j++;
    if (i < 0) meta.adjust.push(entry); else meta.adjust.splice(j, 0, entry);
}
const sameOps = (a, b) => JSON.stringify(a?.ops ?? null) === JSON.stringify(b?.ops ?? null) && a?.label === b?.label;
const hiddenLabel = ids => (ids.length ? `눈 감긴 답 ${idsText(ids)} 빼기 (블루레몬)` : '지운 답 · 감긴 답 이어 맞추기 (블루레몬)');
// 1.7.7 번호는 지우기 전 번호예요(지운 뒤에는 뒤 답들이 한 칸씩 당겨져요) — 관리 탭 기록 줄에서 헷갈리지 않게 덧말을 붙여요
const goneLabel = (ids, swipe) => `지운 ${swipe ? '스와이프' : '답'} ${idsText(ids)} 빼기 (지우기 전 번호 · 블루레몬)`;
const stamp = () => Date.now();

/**
 * 맞추기(bl_sub.k = 'hid'): 저장마다 「저장 당시 계산(A)」 → 「지금 계산(B)」 몫을 그 저장 바로 뒤에 끼워요. 지금 감긴 표식 · 앞 저장의 테마 기록 · 참 자리에 맞게 매번 다시 구해요.
 *   A = 참 자리까지 · 감긴 답도 셈 · 그 저장보다 나중에 만든 테마 기록 빼고 / B = 원작이 실제로 쓰는 자리(at)까지 · 지금 그대로(앞 저장에 새로 끼운 기록 포함)
 *   돌려주는 것: { changed, made:[{of, ids, ops}], dropped, declined } — 기록 배열은 그 자리에서 고쳐요(저장 · 새로고침은 부르는 쪽)
 */
export function syncHidden(c, eng) {
    const out = { changed: false, made: [], dropped: 0, declined: [] };
    const meta = sheet(c), chat = c?.chat;
    if (!meta || !Array.isArray(chat) || typeof eng?.compute !== 'function') return out;
    const R = rec(c);
    const sets = liveSets(meta), setT = new Set(sets.map(a => a.t));
    // 테마 기록 가운데 그 저장이 사라진 것(원작 되돌리기 · 굳히기)은 같이 지워요(지운 답 기록도)
    //   1.7.6 본문 고침 기록(k = 'edit' — src/mb-editsync.js)은 저장이 아니라 답에 묶인 것이라 여기서 안 지워요(그 뒤 저장의 「이어 맞추기」 만 여기서 구해요)
    const orphan = meta.adjust.filter(a => isOurs(a) && a[TAG].k !== 'edit' && !setT.has(a[TAG].of));
    if (orphan.length) { meta.adjust = meta.adjust.filter(a => !orphan.includes(a)); out.changed = true; out.dropped += orphan.length; }
    for (const t of Object.keys(R.pos)) if (!setT.has(Number(t))) delete R.pos[t];
    const old = meta.adjust.filter(a => isOurs(a) && a[TAG].k === 'hid');
    // 사용자가 관리 탭에서 지운 기록(원작 골라서 지우기 · 마지막 편집 되돌리기): 끼웠는데 없고 그 저장은 남아 있으면 「그 저장은 그대로 둬요」 — 감긴 답 · 지운 답 기록 모두
    const present = new Set(meta.adjust.filter(isOurs).map(a => a.t));
    for (const [t, of] of R.ent) if (!present.has(t) && setT.has(of) && !R.no.includes(of)) { R.no.push(of); out.declined.push(of); }
    R.no = R.no.filter(t => setT.has(t));
    meta.adjust = meta.adjust.filter(a => !(isOurs(a) && a[TAG].k === 'hid'));
    const start = startOf(meta, chat);
    const marks = chat.flatMap((m, i) => (i >= start && m?.is_system === true && m.extra?.type === MARK ? [i] : []));
    const made = [];
    for (const S of sets) {
        if (R.no.includes(S.t)) continue;
        const p = posOf(R, S);
        const ids = marks.filter(i => i < p);
        // 할 일: 저장 앞 감긴 답 · 참 자리가 밀린 저장 · 앞에 테마 기록이 있는 저장(앞 저장 몫을 잇기)
        const ahead = meta.adjust.some(a => isOurs(a) && !after(a, S));
        if (!ids.length && p === S.at && !ahead && !marks.some(i => i < S.at)) continue;
        const saved = numbers({ [S.set.mod]: S.set.data }, S.set.mod); if (!saved.size) continue;
        const A = computeAt(eng, meta, chat, S, { limit: p, drop: newer(S), edits: ids.map(i => ({ unmark: chat[i] })) });
        const B = computeAt(eng, meta, chat, S);
        if (!A || !B) continue;
        const ops = deltaOps(S.set.mod, saved, numbers(A.data, S.set.mod), numbers(B.data, S.set.mod));
        if (!ops.length) continue;
        const label = hiddenLabel(ids);
        const was = old.find(a => a[TAG].of === S.t);
        const entry = was && sameOps(was, { ops, label }) ? was
            : { at: S.at, t: tAfter(meta, S), ops, label, silent: true, keep: true, [TAG]: { k: 'hid', of: S.t, ids, made: stamp() } };
        entry.at = S.at;
        insertAfter(meta, S, entry);
        made.push({ of: S.t, at: S.at, ids, ops });
    }
    const now = meta.adjust.filter(a => isOurs(a) && a[TAG].k === 'hid');
    R.ent = meta.adjust.filter(isOurs).map(a => [a.t, a[TAG].of]);   // 지금 끼워 둔 것만(테마가 바꾼 것은 「사용자가 지움」 으로 안 봐요)
    if (now.length !== old.length || now.some(a => !old.includes(a))) out.changed = true;
    out.dropped += old.filter(a => !now.includes(a)).length;
    out.made = made;
    const before = JSON.stringify(c.chatMetadata?.[REC] ?? null);
    putRec(c, R);
    if (JSON.stringify(c.chatMetadata?.[REC] ?? null) !== before) out.changed = true;
    return out;
}

/**
 * 지운 답(들): 지우기 전 기억(snap)과 지금 채팅을 견줘 사라진 AI 답 · 바뀐 스와이프를 찾아, 그 뒤 칸 통째 저장마다 「저장 당시 계산」 이 바뀐 몫을 끼워요(bl_sub.k = 'del').
 *   몫 = (지운 뒤 · 참 자리 · 감긴 답 셈) − (지우기 전 · 참 자리 · 감긴 답 셈) — 둘 다 그 저장보다 나중에 만든 테마 기록은 빼요. 지운 답은 되살릴 수 없어 이 기록은 다시 구하지 않아요.
 *   그다음 맞추기(syncHidden)가 「저장 당시」 → 「지금」 을 이어요(감긴 답 · 앞 저장 몫).
 *   snap = [{ m, sid, mes, ops }] (지우기 전 채팅 차례 · snap.ats = 통째 저장의 지우기 전 자리) · 돌려주는 것: { changed, made }
 */
export function syncGone(c, eng, snap) {
    const out = { changed: false, made: [] };
    const meta = sheet(c), chat = c?.chat;
    if (!meta || !Array.isArray(chat) || !Array.isArray(snap) || typeof eng?.compute !== 'function') return out;
    const R = rec(c);
    const alive = new Set(chat);
    const story = m => !!m && !m.is_user && (!m.is_system || !m.extra?.type || m.extra.type === MARK);
    const hasOps = x => (typeof x.mes === 'string' && /\[|\{|:/.test(x.mes)) || (Array.isArray(x.ops) && x.ops.length);
    const start = Math.min(Number(meta.startAt) || 0, snap.length);
    const lost = snap.map((x, i) => ({ ...x, i })).filter(x => x.m && !alive.has(x.m));   // 사라진 메시지 전부(지우기 전 자리)
    // 바뀐 스와이프(지운 스와이프): 같은 메시지인데 그 스와이프 글 · 변화 줄이 달라졌어요
    const swiped = snap.map((x, i) => ({ ...x, i })).filter(x => x.i >= start && x.m && alive.has(x.m) && story(x.m) && hasOps(x) && x.swDel && (x.m.mes !== x.mes || (x.m.swipe_id ?? 0) !== x.sid));
    const goneIds = lost.filter(x => x.i >= start && story(x.m) && hasOps(x)).map(x => x.i);
    const restore = lost.map(x => ({ insert: x.m, at: x.i }));   // 지우기 전 채팅 꼴(작은 자리부터)
    const ghostOf = x => ({ is_user: false, is_system: false, name: x.m.name, mes: x.mes, swipe_id: 0, swipes: [x.mes], extra: { [META]: { bySwipe: { 0: Array.isArray(x.ops) ? x.ops : [] } } } });
    const pre = chat.slice(); for (const r of restore) pre.splice(r.at, 0, r.insert);
    const fresh = new Set();
    for (const S of liveSets(meta)) {
        // 1.7.6 지우기 전 참 자리: 그 확장은 지움 사건마다 끝을 넘은 저장 자리(at)를 남은 메시지 수로 당겨요(clampAdjust) — 맨 끝에 있던 저장은 여기 올 때 이미 당겨져 있어서
        //   지금 at 을 지우기 전 자리로 믿으면 참 자리를 한 칸 더 당기고 끝 답 몫을 한 번 더 더했어요. 기억해 둔 지우기 전 at(snap.ats)이 있으면 그것으로 봐요
        //   기억한 뒤에 생긴 저장(그 확장 화면에서 한 편집은 실리태번 사건이 없어요)은 그때 메시지 수(= 기억한 채팅 길이)에 적혔어요
        const at0 = snap.ats ? Number(snap.ats.get(S.t) ?? snap.length) : NaN, p = Number(R.pos[String(S.t)]);
        const p0 = Number.isFinite(at0) ? Math.min(Number.isFinite(p) ? p : Infinity, Math.max(at0, S.at)) : posOf(R, S);
        const p1 = p0 - lost.filter(x => x.i < p0).length;        // 지운 뒤 참 자리
        if (p1 !== p0) { if (p1 === S.at) delete R.pos[String(S.t)]; else R.pos[String(S.t)] = p1; }
        if (R.no.includes(S.t)) continue;
        const swHere = swiped.filter(x => x.i < p0);
        const inS = [...goneIds.filter(i => i < p0), ...swHere.map(x => x.i)];
        if (!inS.length) continue;
        const saved = numbers({ [S.set.mod]: S.set.data }, S.set.mod); if (!saved.size) continue;
        const drop = a => newer(S)(a) || fresh.has(a);
        // 지우기 전: 지운 답 · 옛 스와이프를 그 자리에 · 감긴 답도 셈
        const Apre = computeAt(eng, meta, chat, S, { limit: p0, drop, edits: [...restore, ...pre.flatMap((m, i) => (i < p0 && m?.extra?.type === MARK ? [{ unmark: m }] : [])), ...swHere.map(x => ({ replace: x.i, m: ghostOf(x) }))] });
        // 지운 뒤: 지금 채팅 · 감긴 답도 셈
        const Apost = computeAt(eng, meta, chat, S, { limit: p1, drop, edits: chat.flatMap((m, i) => (i < p1 && m?.extra?.type === MARK ? [{ unmark: m }] : [])) });
        if (!Apre || !Apost) continue;
        const ops = deltaOps(S.set.mod, saved, numbers(Apre.data, S.set.mod), numbers(Apost.data, S.set.mod));
        if (!ops.length) continue;
        const entry = { at: S.at, t: tAfter(meta, S), ops, label: goneLabel(inS, !goneIds.some(i => i < p0)), silent: true, keep: true, [TAG]: { k: 'del', of: S.t, ids: inS, made: stamp() } };
        insertAfter(meta, S, entry); fresh.add(entry);
        out.made.push({ of: S.t, at: S.at, ids: inS, ops });
    }
    for (const e of fresh) R.ent.push([e.t, e[TAG].of]);
    const before = JSON.stringify(c.chatMetadata?.[REC] ?? null);
    putRec(c, R);
    out.changed = out.made.length > 0 || JSON.stringify(c.chatMetadata?.[REC] ?? null) !== before;
    return out;
}

/** 지우기 전 기억: 메시지 참조 · 그 스와이프 번호 · 글 · 변화 줄(참조만) */
export function remember(chat, meta = null) {
    const out = (Array.isArray(chat) ? chat : []).map(m => ({ m, sid: m?.swipe_id ?? 0, mes: m?.mes, ops: m?.extra?.[META]?.bySwipe?.[m?.swipe_id ?? 0] }));
    if (Array.isArray(meta?.adjust)) out.ats = new Map(liveSets(meta).map(a => [a.t, a.at]));   // 1.7.6 통째 저장의 지우기 전 자리(그 확장이 지움 뒤 당기기 전)
    return out;
}

// ── 실리태번 · 그 확장과 잇기 ─────────────────────────
async function mbMod(file, doc = globalThis.document) {
    try {
        const tag = [...(doc?.querySelectorAll?.('script[src]') ?? [])].find(s => /\/meatballstats\/index\.js(?:$|\?)/.test(String(s.src || s.getAttribute?.('src') || '')));
        const src = tag ? String(tag.src || tag.getAttribute('src')) : '';
        if (!src || src.includes('?')) return null;
        return await import(new URL(file, src).href);
    } catch { return null; }
}
let engP = null;
export const engine = () => (engP ??= mbMod('./src/engine.js').then(m => (typeof m?.compute === 'function' ? m : (engP = null))));
/** 1.7.7 바로 반영을 못 하는 까닭 한마디(알림에 덧붙여요) — 할 수 있으면 '' · 스위치를 껐으면 'off' · 그 확장의 계산 부분을 못 받았으면 'module' */
export async function whyNot(doc = globalThis.document) {
    if (!active(doc)) return 'off';
    try { return (await engine()) ? '' : 'module'; } catch { return 'module'; }
}
export const WHY_TEXT = {
    off: '「눈 감기 · 삭제 바로 반영」을 꺼 둬서 바로 빼지 않았어요.',
    module: '미트볼의 계산 부분을 불러오지 못해서 바로 빼지 못했어요(미트볼 판이 다르거나 주소에 꼬리표가 붙은 설치예요).',
};
/** 시험용: 그 확장 계산 대신 넣기(null 이면 다시 그 확장 것) */
export const useEngine = e => { engP = e ? Promise.resolve(e) : null; };
async function refresh() { try { const core = await mbMod('./src/core.js'); core?.app?.refreshNow?.(); } catch { /* 다음 새로고침 때 */ } }
async function fit(meta, eng) { if (meta?.adjust?.length > 80 && typeof eng?.squash === 'function') { try { eng.squash(meta); } catch { /* 그 확장 다음 기록 때 */ } } }

let queue = Promise.resolve();
const serial = fn => (queue = queue.then(fn, fn));

const chatId = c => { try { return String(c?.getCurrentChatId?.() ?? c?.chatId ?? ''); } catch { return ''; } };

/** 할 일이 있나(감긴 표식 뒤 숫자 칸 통째 저장 · 테마 기록 · 테마 메타 칸) — 없으면 계산을 한 번도 안 돌려요 · 같은 꼴이면 다시 안 돌려요(sig) */
let lastSig = '';
export function signature(c) {
    const meta = sheet(c), chat = c?.chat; if (!meta || !Array.isArray(chat)) return '';
    const start = startOf(meta, chat);
    const marks = chat.flatMap((m, i) => (i >= start && m?.is_system === true && m.extra?.type === MARK ? [i] : []));
    const ours = meta.adjust.filter(isOurs);
    const pos = c.chatMetadata?.[REC]?.pos ?? {};
    const sets = liveSets(meta).filter(a => (marks.length && a.at > marks[0]) || ours.length || pos[String(a.t)] !== undefined);
    if (!sets.length && !ours.length && !c.chatMetadata?.[REC]) return '';
    return JSON.stringify([chatId(c), chat.length, marks, sets.map(a => [a.t, a.at]), ours.map(a => [a.t, a.at, a[TAG].k, a.ops]), c.chatMetadata?.[REC] ?? null]);
}

/**
 * 눈 감기 · 뜨기 · 채팅 열기 뒤: 감긴 답 기록을 맞추고(바뀌었으면) 저장 · 새로고침. 돌려주는 것: 바뀌었나(null = 못 함 → 1.7.3 알림으로)
 *   알림은 안 띄워요(11-17 사용자 「팝업 띄울 게 아니라 바로 반영되게」) — 남는 것은 관리 탭 편집 기록 줄(번호만 · 인물 이름 없음)뿐이에요.
 *   kind = 'hid'(감김) · 'open'(뜸) · 'tidy'(채팅 열기 · 정리)
 */
export function applyHidden(c = ctx(), { kind = 'tidy', eng = undefined, save = true } = {}) {
    return serial(async () => {
        const e = eng ?? await engine(); if (!e) return null;
        const meta = sheet(c); if (!meta) return false;
        const sig = signature(c);
        if (!sig || (kind === 'tidy' && sig === lastSig)) return false;   // 할 일 없음 · 지난번과 같은 꼴
        let r; try { r = syncHidden(c, e); } catch { return null; }
        lastSig = signature(c);
        if (!r.changed && !r.declined.length) return false;
        await fit(meta, e);
        if (save) { try { await c?.saveMetadata?.(); } catch { /* 다음 저장 때 */ } }
        await refresh();
        return r.changed;
    });
}
/** 지운 답: 지우기 전 기억으로 빼는 기록을 끼우고 저장 · 새로고침(알림 없이) */
export function applyGone(c = ctx(), snap, { eng = undefined } = {}) {
    return serial(async () => {
        const meta = sheet(c); if (!meta || !liveSets(meta).length) return false;   // 숫자 칸 통째 저장이 없으면 지움은 원작이 알아서 빼요
        const e = eng ?? await engine(); if (!e) return null;   // 1.7.7 할 일이 있는데 계산을 못 받은 때만 「못 함」(null) — 까닭을 한 번 알려요
        let r, h; try { r = syncGone(c, e, snap); h = syncHidden(c, e); } catch { return null; }   // 지운 뒤 번호가 당겨지니 감긴 답 기록도 다시 맞춰요
        lastSig = signature(c);
        if (!r.changed && !h.changed) return false;
        await fit(meta, e);
        try { await c?.saveMetadata?.(); } catch { /* 다음 저장 때 */ }
        await refresh();
        return r.changed || h.changed;
    });
}

// ── 지움 사건 걸기(미트볼 문에서 한 번) ─────────────────────
let snap = [], started = false;
export const _snap = () => snap;
export function startAutoSub(doc = globalThis.document, { onFail = null } = {}) {   // onFail(채팅 id): 1.7.7 할 일이 있는데 계산을 못 받아 못 뺀 때(알림은 부르는 쪽 — 이 모듈은 알림을 안 띄워요)
    if (started) return false;
    const c = ctx(), on = c?.eventSource?.on?.bind(c.eventSource), T = c?.event_types ?? c?.eventTypes ?? {};
    if (!on) return false;
    started = true;
    const keep = () => { try { const c = ctx(); snap = remember(c?.chat, c?.chatMetadata?.[META]); } catch { snap = []; } };
    // 1.7.6 같은 차례에 겹쳐 온 사건(답 하나에 받음 · 그림 · 끝)은 기억하기를 한 번만 — 걸린 뒤 올 사건은 다시 걸어요(찍는 채팅 상태는 같아요)
    let keepQueued = false;
    const keepSoon = () => { if (keepQueued) return; keepQueued = true; setTimeout(() => { keepQueued = false; keep(); }, 0); };
    for (const ev of ['CHAT_CHANGED', 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'GENERATION_ENDED', 'MORE_MESSAGES_LOADED', 'CHARACTER_MESSAGE_RENDERED'])
        if (T[ev]) on(T[ev], keepSoon);
    // 버그 사냥 4: 이름 앞 · 줄인 키 고치기(src/mb-namekey.js)는 답 끝 뒤 0.6초에 서랍을 새 배열로 바꿔요 — 그 뒤엔 실리태번 사건이 없어 기억이 옛 변화 줄(그 확장이 못 읽은 줄)을 들고 있었고,
    //   그 스와이프를 지우면 고친 몫(「aff: 이름 +3」)을 못 뺐어요 → 고쳤다는 문서 사건에 다시 기억해요
    try { doc?.addEventListener?.('bl-mb-namekey', keepSoon); } catch { /* 다음 사건 때 */ }
    // 1.7.6 지움 사건이 잇달아 오면(답 여러 개 지우기 · /cut 범위 · 지운 직후 또 지움) 한 묶음으로 — 예전엔 사건마다 같은 「지우기 전 기억」 으로 따로 돌아
    //   첫 사건이 다 뺀 것을 둘째 사건이 또 빼고 참 자리(pos)도 두 번 당겼어요. 첫 사건의 기억 하나를 들고 마지막 사건 뒤에 한 번만 돌아요.
    //   돌기 직전에 지금 채팅을 다시 기억해서(keep) 도는 사이에 온 다음 지움은 「지운 뒤」 기억에서 시작해요. 그 사이 채팅이 바뀌었으면 안 돌아요(옛 채팅 기억으로 새 채팅을 고치지 않게).
    let pend = null;   // { was, id, timer }
    const gone = (ms, mark = null) => {
        if (!pend) pend = { was: snap, id: chatId(ctx()), timer: 0 };
        if (mark) { const ats = pend.was.ats; pend.was = mark(pend.was); pend.was.ats = ats; }
        clearTimeout(pend.timer);
        pend.timer = setTimeout(() => {
            const { was, id } = pend; pend = null;
            const cx = ctx();
            keep();
            if (chatId(cx) !== id || !active(doc) || !sheet(cx)) return;
            applyGone(cx, was).then(r => { if (r === null) onFail?.(id); }).catch(() => { /* 원래 동작 그대로 */ }).finally(keep);
        }, ms);
    };
    if (T.MESSAGE_DELETED) on(T.MESSAGE_DELETED, () => gone(300));   // 그 확장의 지움 처리(clampAdjust)가 먼저
    if (T.MESSAGE_SWIPE_DELETED) on(T.MESSAGE_SWIPE_DELETED, e => {
        const id = Number(e?.messageId);
        gone(400, was => was.map((x, i) => (i === id && Number(e?.swipeId) === x.sid ? { ...x, swDel: true } : x)));   // 실리태번이 새 스와이프 글을 옮겨 적은 뒤
    });
    keep();
    return true;
}
