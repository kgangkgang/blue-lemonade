// 1.7.6 본문을 고치면 미트볼 수치도 따라 바꾸기 — 사용자(11-18): 「15문단이 있을 때 아래 5문단을 지워버려도 5문단에 나왔던 캐릭터들 호감도 올라간 게 안 내려가네」
//   그 확장은 AI 답 끝의 변화 블록을 읽은 뒤 본문에서 떼어 메시지 숨은 칸(extra.statussim.bySwipe[스와이프] — 「서랍」)에 둬요. 그래서 편집 창에는 변화 줄이 안 보이고,
//   본문 문단을 지워도 서랍은 그대로라 숫자가 안 바뀌어요(원작 2.8.0 · 2.9.0 같음 — 변화 줄 자체는 칩 줄 끝의 연필 단추로 고쳐요 · 그건 원작이 바로 다시 계산해요).
//   여기서 하는 일(AI 호출 0 · 원작 파일 · 서랍은 안 고쳐요):
//     · 사용자가 편집 창으로 AI 답 본문을 고쳐 저장하면, 그 답의 변화 줄 가운데 **고치기 전 본문에는 나왔는데 고친 뒤 본문에는 더는 안 나오는 인물**의 애정 · 우정 몫을 빼요.
//       빼는 길: 그 답 · 그 스와이프에 묶인(an) 그 확장 편집 기록 하나(인물마다) — 「본문 고침 #12: <이름> 뺌 (블루레몬)」. 답을 지우거나 다른 스와이프로 넘기면 그 확장이 기록을 쉬게 하고,
//       관리 탭 › 저장 · 되돌리기 › 「편집 기록 — 골라서 지우기」로 되돌려요(되돌린 인물은 그 답에서 다시 저절로 빼지 않아요).
//       빼는 양은 그 확장 계산을 두 번 돌려(그 인물 몫을 넣고 / 빼고) 구해요 — 상한 · 배율 · 합친 이름이 원작 계산 그대로예요.
//     · 다시 고쳐 그 인물이 본문에 돌아오면 그 기록을 지워 원래대로 돌려요(서랍의 원래 값은 한 번도 안 건드렸으니 그대로 살아나요).
//     · 그 답 뒤에 칸 통째 저장이 있으면 눈 감기 · 삭제 바로 반영(src/mb-autosub.js)의 「이어 맞추기」가 그 저장 뒤 값도 맞춰요.
//   한계(설명에도 적어요): 아직 본문에 이름이 남아 있는 인물의 몫은 그대로예요 — 어느 문단이 몇 점이었는지는 변화 줄에 없어요. 이름 말고 직함 · 대명사로만 나온 인물은
//     「나왔다」고 못 봐서 빼지도 않아요. 굳힌 옛 답(그 확장이 합쳐 둔 구간)은 안 바뀌어요. 애정 · 우정만 봐요(돈 · 물건 · 장소는 인물에 안 묶여요).
//   스위치: 미트볼 맞춤 「데이터를 고치는 것」 › 「본문을 고치면 수치도 따라 바꾸기」(열쇠 editsync · 기본 켬). 끄면 더는 안 하고 이미 넣은 기록은 그대로예요.
//   시험: tools/tests/mb-editsync.mjs
import { mbOff } from './mb-switch.js';
import * as Sub from './mb-autosub.js';

export const KEY = 'editsync';
export const STATE = 'bl_mbedit';     // 메시지 extra 칸: { [스와이프]: { off: { 이름열쇠: { name, t } }, keep: { 이름열쇠: true } } }
export const CUT_ATTR = 'data-bl-cut';
const META = 'statussim';
const norm = x => String(x ?? '').replace(/\s+/g, '').toLowerCase();
const ctx = () => { try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; } };
export const active = (doc = globalThis.document) => !mbOff(KEY, doc) && (!doc?.body?.classList?.contains || doc.body.classList.contains('salty'));

const sidOf = m => m?.swipe_id ?? 0;
const drawer = m => { const d = m?.extra?.[META]?.bySwipe?.[sidOf(m)]; return Array.isArray(d) ? d : null; };
const sheet = c => { const meta = c?.chatMetadata?.[META]; return meta && typeof meta === 'object' && meta.base && !meta.off && Array.isArray(meta.adjust) && c?.extensionSettings?.[META]?.enabled !== false ? meta : null; };

/** 변화 줄 값 「A +3, B -2」 → [{ name, raw }] (이름을 못 읽은 조각은 name = '') */
export function partsOf(value) {
    return String(value ?? '').split(/\s*[,，]\s*(?=[^\d\s,，])/u).map(raw => {
        const m = /^(.+?)\s*[=+\-−]\s*\d[\d.]*\s*%?$/u.exec(raw.trim());
        return { name: m ? m[1].replace(/^[^:：]{1,12}[:：]\s*/u, '').trim() : '', raw: raw.trim() };   // 「A +2, trust: A +1」 처럼 한 줄에 다른 키를 섞은 조각은 키를 떼고 이름만
    }).filter(p => p.raw);
}
const PERSON_KEYS = new Set(['aff', 'trust']);
/** 이 답의 변화 줄에서 인물에 묶인 조각: [{ op(줄 번호), name, key }] — 줄 종류는 그 확장의 opInfo 로 알아봐요(키 표를 베끼지 않아요) */
export function personParts(ops, eng, state = null) {
    const out = [];
    (ops || []).forEach(([k, v], op) => {
        let key = null; try { key = eng?.opInfo?.(state, k)?.key ?? null; } catch { key = null; }
        if (!PERSON_KEYS.has(key)) return;
        for (const p of partsOf(v)) if (p.name) out.push({ op, name: p.name, key });
    });
    return out;
}
/** 그 인물들(이름열쇠 모음) 몫을 뺀 변화 줄 — 원본은 그대로 두고 새 배열을 돌려줘요 */
export function withoutPeople(ops, eng, offKeys, state = null) {
    const out = [];
    for (const [k, v] of ops || []) {
        let key = null; try { key = eng?.opInfo?.(state, k)?.key ?? null; } catch { key = null; }
        if (!PERSON_KEYS.has(key)) { out.push([k, v]); continue; }
        const kept = partsOf(v).filter(p => !p.name || !offKeys.has(norm(p.name)));
        if (kept.length) out.push([k, kept.map(p => p.raw).join(', ')]);
    }
    return out;
}

// ── 본문에 그 인물이 나오나 ─────────────────────────────
const plain = text => String(text ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').toLowerCase();
const CJK = /[぀-ヿ㐀-鿿]/u;   // 띄어 쓰지 않는 글(가나 · 한자)은 낱말 머리를 못 가려요
/** 글에 이름 꼴 하나가 낱말 머리에서(앞이 글자 · 숫자가 아님) 나오나 — 「수아」 가 「지수아」 에 걸리지 않게. 가나 · 한자 이름은 어디든 */
export function mentions(text, form) {
    const t = plain(text), f = String(form ?? '').trim().toLowerCase();
    if ([...f].length < 2) return false;
    for (let i = t.indexOf(f); i >= 0; i = t.indexOf(f, i + 1)) if (i === 0 || CJK.test(f) || !/[\p{L}\p{N}]/u.test(t[i - 1])) return true;
    return false;
}
/**
 * 1.7.8 로어북 인물 항목의 이름 줄로 같은 사람의 여러 꼴을 묶어요 → Map(이름 열쇠 → 꼴 목록)
 *   사용자 폰(1.7.7 · 영어 저장 채팅): 변화 줄은 영어 이름(「Mira +2」)인데 본문은 일본어 대사(「ミラ」) · 본명(「Rafe」)으로 불러서,
 *   「고치기 전에도 안 나온 사람」 으로 보고 아무도 안 뺐어요. 항목 머리표(「[…]미라」) · Name 줄(「Mira (ミラ)」 · 「Oskar Vale (オスカー・ヴェイル)」)
 *   · Real / Original / Former Name 줄의 꼴을 한 사람으로 묶어요. 이름 줄만 봐요(역할 · 설명 줄은 안 봐요).
 */
const NAME_LINE = /^\s*(?:[-*•·]\s*)?(?:\*\*|__)?\s*(?:full\s+|real\s+|original\s+|former\s+|true\s+)?(?:name|이름|본명|성명|名前|本名|氏名)\s*(?:\*\*|__)?\s*[:：]\s*(.+)$/iu;
const NAME_TAIL = /\s*(?:\*\*|__)?\s*(?:full\s+|real\s+|original\s+|former\s+|true\s+)?(?:name|이름|본명|名前|本名)\s*(?:\*\*|__)?\s*[:：]\s*/giu;
const namePieces = v => String(v ?? '').replace(/\*\*|__|`/g, '').replace(NAME_TAIL, ' / ').replace(/\((?![^)]*[ぁ-ヿ㐀-鿿가-힯])[^)]*\)/gu, ' ')
    .split(/\s*(?:[/／(（)）,，|]|\s[-–—]\s)\s*/u).map(s => s.trim()).filter(s => s && [...s].length >= 2 && [...s].length <= 30);
const ADDRESS = /^\s*[-*•·]\s*(?:\*\*|__)?\s*([^:：*"「“]{2,40}?)\s*(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*["「“]([^"」”]{1,24})["」”]/u;
const HONOR = /(?:さん|さま|様|君|くん|ちゃん|殿|どの|先輩|室長|部長|課長|局長|長官|님|씨)+$/u;
const OTHER_SCRIPT = /[぀-ヿ㐀-鿿가-힯]/u;
export function loreAliases(entries) {
    const out = new Map();
    for (const e of Array.isArray(entries) ? entries : []) {
        const lines = String(e?.content ?? '').split(/\r?\n/);
        const forms = new Set();
        for (const line of lines.slice(0, 40)) { const m = NAME_LINE.exec(line); if (m) for (const p of namePieces(m[1])) { forms.add(p); for (const w of p.split(/[\s·・]+/u)) if ([...w].length >= 2) forms.add(w); } }
        // 부르는 말 목록(「- **Mira:** "ミラさん"」 · 「- Mira: "ミラ"」): 한 사람을 다른 글자(가나 · 한자 · 한글)로 부르는 꼴 — 높임 꼬리를 떼고 그 사람 꼴에 더해요
        for (const line of lines) {
            const m = ADDRESS.exec(line); if (!m) continue;
            const who = m[1].replace(/\([^)]*\)|（[^）]*）/g, ' ').trim(), call = m[2].replace(HONOR, '').replace(/[.。!！?？]+$/u, '').trim();
            if (!who || [...who].length > 30 || !OTHER_SCRIPT.test(call) || [...call].length < 2 || [...call].length > 12 || /[ぁ-ゖ]/u.test(call)) continue;   // 히라가나가 든 값은 이름이 아니라 말(노래 제목 · 대사)이에요
            const k = norm(who), had = out.get(k) || [who];
            out.set(k, [...new Set([...had, call])]);
        }
        if (!forms.size) continue;
        const tag = String(e?.comment ?? '').replace(/^(?:\s*[[【(（][^\]】)）]{0,12}[\]】)）]\s*)+/u, '').trim();
        if (tag && [...tag].length >= 2 && [...tag].length <= 16 && !/[:：]/.test(tag)) forms.add(tag);
        const group = [...forms];
        const all = new Set(group); for (const f of group) for (const g of out.get(norm(f)) || []) all.add(g);
        const merged = [...all];
        for (const f of merged) out.set(norm(f), merged);
    }
    return out;
}
/** 이름 하나의 여러 꼴: 그대로 · 괄호 뗀 것 · 띄어 쓴 조각(성 · 이름) · 관계 칸의 그 사람 이름 · 합친 이름(rel.alias) · 화면 번역 이름(tr) */
export function formsOf(name, { rel = null, tr = null, find = null, lore = null } = {}) {
    const out = new Set(), add = s => { const v = String(s ?? '').trim(); if ([...v].length >= 2) out.add(v); };
    const one = s => { const v = String(s ?? ''); add(v); const bare = v.replace(/\([^)]*\)|（[^）]*）/g, ' ').trim(); add(bare); for (const w of bare.split(/[\s·・,，/]+/u)) add(w); for (const m of v.matchAll(/[(（]([^)）]+)[)）]/g)) add(m[1]); };
    const names = [name];
    let who = null; try { who = find ? find(rel?.user ?? [], name) : (rel?.user ?? []).find(r => norm(r?.name) === norm(name)); } catch { who = null; }
    if (who?.name) names.push(who.name);
    const target = norm(who?.name ?? name);
    for (const [k, v] of Object.entries(rel?.alias && typeof rel.alias === 'object' ? rel.alias : {})) if (norm(v) === target) names.push(k);
    for (const n of names) { one(n); if (tr) { let t = null; try { t = tr(n); } catch { t = null; } if (t && t !== n) one(t); } }
    if (lore?.size) for (const f of [...out]) for (const g of lore.get(norm(f)) || []) add(g);   // 1.7.8 로어북 이름 줄(다른 언어 · 본명)
    return [...out];
}
export const mentionsAny = (text, forms) => forms.some(f => mentions(text, f));

/** 이 답 · 이 스와이프의 상태(없으면 빈 것 — make 면 만들어 달아요) */
export function stateOf(m, make = false) {
    const sid = String(sidOf(m));
    let all = m?.extra?.[STATE];
    if (!all || typeof all !== 'object') { if (!make) return { off: {}, keep: {} }; all = (m.extra ??= {})[STATE] = {}; }
    let st = all[sid];
    if (!st || typeof st !== 'object') { if (!make) return { off: {}, keep: {} }; st = all[sid] = {}; }
    if (!st.off || typeof st.off !== 'object') st.off = {};
    if (!st.keep || typeof st.keep !== 'object') st.keep = {};
    return st;
}
function tidyState(m) {
    const all = m?.extra?.[STATE]; if (!all || typeof all !== 'object') return;
    for (const [sid, st] of Object.entries(all)) if (!st || (!Object.keys(st.off || {}).length && !Object.keys(st.keep || {}).length)) delete all[sid];
    if (!Object.keys(all).length) delete m.extra[STATE];
    // 실리태번은 스와이프를 넘길 때 그 스와이프의 extra 를 따로 둬요 — 같은 것을 거기에도(그 확장 syncSwipe 와 같은 자리)
    const info = m.swipe_info?.[sidOf(m)];
    if (info && typeof info === 'object' && info.extra && typeof info.extra === 'object') { if (m.extra[STATE]) info.extra[STATE] = JSON.parse(JSON.stringify(m.extra[STATE])); else delete info.extra[STATE]; }
}

/**
 * 고치기 전 · 뒤 본문으로 뺄 인물 · 되살릴 인물을 정해요(상태만 바꿔요 · 기록은 syncEdit). 돌려주는 것: { cut: [이름], back: [이름] }
 *   빼기: 지금 안 뺀 인물 가운데 고치기 전에는 나왔고 고친 뒤에는 안 나오는 사람(되돌린 적 있는 사람 keep 은 빼요)
 *   되살리기: 뺀 인물 가운데 고친 뒤 본문에 다시 나오는 사람
 */
export function decide(m, before, after, eng, { rel = null, tr = null, find = null, state = null, lore = null } = {}) {
    const out = { cut: [], back: [] };
    const ops = drawer(m); if (!ops) return out;
    const st = stateOf(m, true), seen = new Set();
    for (const p of personParts(ops, eng, state)) {
        const k = norm(p.name); if (seen.has(k)) continue; seen.add(k);
        const forms = formsOf(p.name, { rel, tr, find, lore });
        const now = mentionsAny(after, forms);
        if (st.off[k]) { if (now) { delete st.off[k]; out.back.push(p.name); } continue; }
        if (now || st.keep[k] || typeof before !== 'string' || !mentionsAny(before, forms)) continue;
        st.off[k] = { name: p.name, t: 0 }; out.cut.push(p.name);
    }
    // 변화 줄에서 사라진 인물(연필 단추로 고친 때)의 상태는 치워요
    for (const k of Object.keys(st.off)) if (!seen.has(k)) delete st.off[k];
    tidyState(m);
    return out;
}

const isEdit = a => Sub.isOurs(a) && a[Sub.TAG].k === 'edit';
/** 그 확장 차례(시간 순으로 보되 뒤 기록보다 자리가 뒤면 당김)에서 뒤 자리 기록을 끌어내리지 않는 시각 — 이 자리(at)보다 뒤에 있는 안 묶인 기록들보다 앞 */
export function pickT(meta, at) {
    let t = Date.now();
    for (const a of meta.adjust) if (a.t >= t) t = a.t + 0.001;
    const later = meta.adjust.filter(a => a && !a.an && a.at > at && Number.isFinite(a.t));
    if (later.length) t = Math.min(t, Math.min(...later.map(a => a.t)) - 0.5);
    while (meta.adjust.some(a => a.t === t)) t -= 0.001;
    return t;
}
const label = (i, name) => `본문 고침 #${i}: ${String(name).slice(0, 24)} 뺌 (블루레몬)`;

/**
 * 답 하나(번호 i)의 상태에 맞게 묶인 기록을 맞춰요 — 인물마다 기록 하나(bl_sub.k = 'edit' · who = 이름열쇠 · an = 그 답 · 그 스와이프).
 *   끼운 기록이 없어졌으면(관리 탭에서 지움) 그 인물은 되돌린 것으로 적고(keep) 다시 안 빼요. 돌려주는 것: { changed, made: [{ who, ops }], gone, undone }
 */
export function syncEdit(c, eng, i, { tr = null } = {}) {
    const out = { changed: false, made: [], gone: 0, undone: [] };
    const meta = sheet(c), chat = c?.chat, m = chat?.[i];
    if (!meta || !m || m.is_user || typeof eng?.compute !== 'function' || typeof eng?.anchorOf !== 'function') return out;
    const an = eng.anchorOf(m), ops = drawer(m), st = stateOf(m, !!m.extra?.[STATE]);
    const mine = meta.adjust.filter(a => isEdit(a) && a.an === an);
    // 사용자가 지운 기록
    for (const [k, o] of Object.entries(st.off)) if (o.t && !mine.some(a => a.t === o.t)) { delete st.off[k]; st.keep[k] = true; out.undone.push(o.name); out.changed = true; }
    const want = new Set(ops ? Object.keys(st.off) : []);
    const drop = mine.filter(a => !want.has(a[Sub.TAG].who));
    if (drop.length) { meta.adjust = meta.adjust.filter(a => !drop.includes(a)); out.gone = drop.length; out.changed = true; }
    const start = Math.min(Number(meta.startAt) || 0, chat.length);
    if (ops && i >= start) {
        const S = { at: i + 1, t: Infinity }, bag = m.extra[META].bySwipe, sid = sidOf(m);
        const at = extra => Sub.computeAt(eng, meta, chat, S, { limit: i + 1, drop: a => isEdit(a) && a.an === an, ...extra });
        let full = null;
        for (const k of want) {
            const had = mine.find(a => a[Sub.TAG].who === k);
            full ??= at({});
            let less = null;
            bag[sid] = withoutPeople(ops, eng, new Set([k]), full);
            try { less = at({}); } finally { bag[sid] = ops; }
            if (!full || !less) continue;
            const A = Sub.numbers(full.data, 'rel'), B = Sub.numbers(less.data, 'rel');
            const delta = Sub.deltaOps('rel', A, A, B);
            if (!delta.length) { if (had) { meta.adjust = meta.adjust.filter(a => a !== had); out.gone++; out.changed = true; } delete st.off[k]; continue; }   // 뺄 몫이 없는 줄(그 확장이 못 읽은 이름 등)은 뺐다고 적지 않아요
            if (had && JSON.stringify(had.ops) === JSON.stringify(delta)) { had.at = i + 1; continue; }
            if (had) meta.adjust = meta.adjust.filter(a => a !== had);
            const name = tr?.(st.off[k].name) || st.off[k].name;
            const entry = { at: i + 1, t: pickT(meta, i + 1), an, ops: delta, label: label(i, name), silent: true, keep: true, [Sub.TAG]: { k: 'edit', who: k, ids: [i], made: had?.[Sub.TAG].made ?? Date.now() } };
            meta.adjust.push(entry); st.off[k].t = entry.t;
            out.made.push({ who: k, ops: delta }); out.changed = true;
        }
    }
    tidyState(m);
    return out;
}

/** 이 답에서 뺀 인물의 화면 이름 꼴들(칩 흐리게 · 시험) */
export function cutForms(m, { rel = null, tr = null, find = null, lore = null } = {}) {
    const st = stateOf(m); const out = [];
    for (const o of Object.values(st.off)) out.push(...formsOf(o.name, { rel, tr, find, lore }));
    return out;
}
/** 답 아래 칩 가운데 뺀 인물의 애정 · 우정 칩에 표식(data-bl-cut — 시트가 흐리게 · 줄 그어요). 표식을 단 수 */
export function markChips(mesEl, forms) {
    let n = 0;
    for (const chip of mesEl?.querySelectorAll?.('.ss-msgcard .ss-mchip') || []) {
        if (chip.classList?.contains('edit') || chip.classList?.contains('pip')) continue;
        const text = String(chip.textContent || '').trim();
        const hit = forms.length > 0 && /[+\-−]\s*\d/.test(text) && forms.some(f => mentions(text, f));
        if (hit) { if (!chip.hasAttribute(CUT_ATTR)) { chip.setAttribute(CUT_ATTR, ''); chip.setAttribute('title', '본문을 고쳐 이 인물이 더는 안 나와서 뺀 변화예요(블루레몬) · 이름이 본문에 돌아오면 되살아나요'); } n++; }
        else if (chip.hasAttribute?.(CUT_ATTR)) { chip.removeAttribute(CUT_ATTR); chip.removeAttribute('title'); }
    }
    return n;
}

// ── 실리태번 · 그 확장과 잇기 ─────────────────────────
async function mbCore(doc = globalThis.document) {
    try {
        const tag = [...(doc?.querySelectorAll?.('script[src]') ?? [])].find(s => /\/meatballstats\/index\.js(?:$|\?)/.test(String(s.src || s.getAttribute?.('src') || '')));
        const src = tag ? String(tag.src || tag.getAttribute('src')) : '';
        if (!src || src.includes('?')) return null;
        return await import(new URL('./src/core.js', src).href);
    } catch { return null; }
}
let coreP = null;
const core = () => (coreP ??= mbCore().then(m => m || (coreP = null)));
// 1.7.8 이 채팅에 걸린 로어북(카드 안 책 · 카드에 건 책 · 채팅 로어북 · 모임 멤버) 항목 — 채팅 · 캐릭터 · 로어북이 바뀔 때만 다시 읽어요
let loreMemo = { key: null, p: null }, testLore = undefined;
/** 시험용: 로어북 항목 대신 넣기(undefined 로 되돌림 · null 이면 없음) */
export const useLore = entries => { testLore = entries; };
async function loreOf(c) {
    if (testLore !== undefined) return loreAliases(testLore || []);
    let key = ''; try { key = `${c.groupId ?? ''}|${c.characterId ?? ''}|${c.getCurrentChatId?.() ?? ''}|${c.chatMetadata?.world_info ?? ''}`; } catch { return new Map(); }
    if (loreMemo.key !== key) loreMemo = { key, p: (async () => {
        const entries = [], names = new Set();
        const cards = c.groupId ? (c.groups?.find?.(g => g.id === c.groupId)?.members || []).map(a => c.characters?.find?.(x => x.avatar === a)) : [c.characters?.[c.characterId]];
        for (const ch of cards) { const w = ch?.data?.extensions?.world; if (w) names.add(String(w)); for (const e of ch?.data?.character_book?.entries || []) if (e?.enabled !== false) entries.push({ content: e?.content, comment: e?.comment ?? e?.name }); }
        if (c.chatMetadata?.world_info) names.add(String(c.chatMetadata.world_info));
        for (const n of names) { try { const b = await c.loadWorldInfo?.(n); for (const e of Object.values(b?.entries || {})) if (!e?.disable) entries.push({ content: e?.content, comment: e?.comment }); } catch { /* 그 책은 빼요 */ } }
        return loreAliases(entries);
    })().catch(() => new Map()) };
    return loreMemo.p;
}
let testCore = undefined;
/** 시험용: 그 확장 core 대신 넣기 */
export const useCore = c => { testCore = c; };
const helpers = async () => {
    const k = testCore !== undefined ? testCore : await core();
    const tr = (() => { try { return k?.viewTr?.() ? (s => k.trLook?.(s) ?? s) : null; } catch { return null; } })();
    return { core: k, tr, find: typeof k?.findBy === 'function' ? (list, name) => k.findBy(list, name) : null };
};

let queue = Promise.resolve();
const serial = fn => (queue = queue.then(fn, fn));
/**
 * 편집 저장 뒤 한 답: 정하고 → 기록 맞추고 → 뒤 저장 이어 맞추고 → 저장 · 새로고침(알림 없이). before = 고치기 전 본문(없으면 되살리기 · 기록 맞추기만)
 *   돌려주는 것: { cut, back, changed } 또는 null(못 함)
 */
export function applyEdit(c = ctx(), i, before, { eng = undefined } = {}) {
    return serial(async () => {
        const e = eng ?? await Sub.engine(); if (!e) return null;
        const meta = sheet(c), m = c?.chat?.[i]; if (!meta || !m || m.is_user) return null;
        // 1.7.8 상태창 시작점 앞(그 확장이 굳힌 답 · 「지금」 부터 다시 만든 상태창): 그 확장이 그 답의 변화를 다시 안 더해서 뺄 수도 없어요 — 칩만 흐려지거나,
        //   굳기로 사라진 뺀 기록을 「사용자가 되돌림」 으로 읽지 않게 손대지 않아요
        if (i < Sub.startOf(meta, c.chat)) return null;
        // 변화 블록이 본문에 그대로 있는 답(그 확장 「본문에서 떼어 보관」 을 끈 때)은 그 확장이 본문에서 바로 읽어요 — 거기서 고치면 되니 여기서는 안 건드려요(두 번 빼지 않게)
        try { if (typeof e.hasStatus === 'function' && e.hasStatus(m.mes)) return null; } catch { /* 서랍으로 봐요 */ }
        const h = await helpers();
        let state = null; try { state = e.compute(i + 1, { bake: true })?.state ?? null; } catch { state = null; }
        const rel = state?.data?.rel ?? meta.base?.data?.rel ?? null;
        let d, r;
        const lore = await loreOf(c);
        try { d = decide(m, before, m.mes, e, { rel, tr: h.tr, find: h.find, state, lore }); r = syncEdit(c, e, i, { tr: h.tr }); } catch { return null; }
        if (!r.changed && !d.cut.length && !d.back.length) return { ...d, changed: false };
        try { await Sub.applyHidden(c, { kind: 'edit', eng: e, save: false }); } catch { /* 뒤 저장은 다음 맞추기 때 */ }
        // 1.7.9 저장은 한 번 — 실리태번 saveMetadata 는 saveChatConditional 그대로라(메타 칸도 채팅 파일 머리에 같이 적혀요) 둘 다 부르면 채팅 전체를 두 번 썼어요
        try { await (typeof c?.saveChat === 'function' ? c.saveChat() : c?.saveMetadata?.()); } catch { /* 다음 저장 때 */ }
        try { (h.core ?? await core())?.app?.refreshNow?.(); } catch { /* 다음 새로고침 때 */ }
        return { ...d, changed: true };
    });
}
const marked = new WeakSet();   // 표식을 단 칩이 있는 메시지 요소(뗄 것이 있는 답)
/** 화면의 칩 표식을 이 답들에 다시(그 확장이 칩을 새로 그린 뒤) */
export async function paint(list, doc = globalThis.document) {
    const c = ctx(); if (!c?.chat) return 0;
    const off = !active(doc) || !!doc?.body?.hasAttribute?.('data-bl-ext-raw');
    let h = null, rel = null, n = 0;
    for (const mes of list || []) {
        const m = c.chat[Number(mes?.getAttribute?.('mesid'))];
        const has = !off && m && Object.keys(stateOf(m).off).length > 0;
        if (has && !h) { h = await helpers(); rel = c.chatMetadata?.[META]?.base?.data?.rel ?? null; try { rel = h.core?.app?.current?.state?.data?.rel ?? rel; } catch { /* 처음 상태로 */ } }
        // 1.7.7 뺀 인물이 없고 표식을 단 적도 없는 답은 칩을 찾지 않아요 — 예전에는 꾸미기가 돌 때마다(채팅 열기 · 답 그리기) 메시지마다 칩을 찾았어요(거의 모든 답이 뗄 표식도 없는데)
        if (!has && !marked.has(mes)) continue;
        const k = markChips(mes, has ? cutForms(m, { rel, tr: h.tr, find: h.find, lore: await loreOf(c) }) : []);
        if (k) marked.add(mes); else marked.delete(mes);
        n += k;
    }
    return n;
}

let started = false;
/** 편집 단추 · 편집 끝 사건 걸기(미트볼 문에서 한 번) — decorate = 메시지 꾸미기 등록(없으면 칩 표식은 편집 직후에만) */
export function startEditSync(doc = globalThis.document, { decorate = null, filter = null } = {}) {
    if (started || !doc?.addEventListener) return false;
    const c = ctx(), on = c?.eventSource?.on?.bind(c.eventSource), T = c?.event_types ?? c?.eventTypes ?? {};
    if (!on || !T.MESSAGE_EDITED) return false;
    started = true;
    const before = new Map();   // 메시지 → 편집을 연 때의 본문(사용자가 편집 단추를 누른 답만 — 번역 · 다른 확장이 바꾼 글에는 안 움직여요)
    const mesAt = id => ctx()?.chat?.[id];
    doc.addEventListener('click', event => {
        const t = event.target; if (!t?.closest) return;
        const pen = t.closest('.mes_edit');
        if (pen) { const id = Number(pen.closest('.mes')?.getAttribute('mesid')); const m = mesAt(id); if (m && !m.is_user && typeof m.mes === 'string') before.set(m, m.mes); return; }
        // 그 확장의 연필 단추(변화 줄 직접 고치기): 고친 뒤 뺀 기록을 새 변화 줄에 맞게 다시 구해요(확인 창 「예」 뒤)
        const chip = t.closest('.ss-mchip.edit[data-ss-edit]');
        if (chip) {
            const id = Number(chip.getAttribute('data-ss-edit'));
            const once = e => { if (!e.target?.closest?.('.popup-button-ok, .popup-button-cancel')) return; doc.removeEventListener('click', once, true); if (e.target.closest('.popup-button-ok')) setTimeout(() => { if (active(doc) && mesAt(id)?.extra?.[STATE]) applyEdit(ctx(), id, null).then(() => repaint(id)).catch(() => { /* 다음 편집 때 */ }); }, 700); };
            doc.addEventListener('click', once, true);
        }
    }, true);
    const repaint = id => { try { const el = doc.querySelector?.(`#chat .mes[mesid="${id}"]`); if (el) setTimeout(() => { paint([el], doc).catch(() => { /* 다음에 그릴 때 */ }); }, 150); } catch { /* 다음에 그릴 때 */ } };
    on(T.MESSAGE_EDITED, id => {
        const i = Number(id), m = mesAt(i); if (!m || m.is_user) return;
        const was = before.get(m); before.delete(m);
        if (!active(doc) || !sheet(ctx())) return;
        if (was === undefined && !m.extra?.[STATE]) return;   // 사용자가 편집 창으로 고친 것이 아니고 뺀 것도 없는 답
        setTimeout(() => { applyEdit(ctx(), i, was ?? null).then(() => repaint(i)).catch(() => { /* 원래 동작 그대로 */ }); }, 350);   // 그 확장의 편집 처리(서랍 다시 읽기 · 다시 계산)가 먼저
    });
    if (T.CHAT_CHANGED) on(T.CHAT_CHANGED, () => before.clear());
    try { decorate?.('미트볼 본문 고침 칩', list => { paint(list, doc).catch(() => { /* 다음에 그릴 때 */ }); }, { settle: 0, live: true, order: 96, filter }); } catch { /* 편집 직후에만 */ }
    return true;
}
