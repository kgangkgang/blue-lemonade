// 미트볼 상태창 「화면만 번역」 빈틈 메우기 (1.4.x) — 기능 다리(src/ext-bridge.js)가 그 확장이 있을 때 같이 켜요.
//   그 확장은 영어로 저장하고 화면에서만 번역 사전(채팅 메타 tr)으로 바꿔 보여 줘요(ssGenLang = enview). 그런데 두 군데가 영어로 남았어요(11-14 · 2.7.17 대조).
//   ① 답 아래 변동 칩: 그 확장 화면 번역은 글자 노드를 그 자리에서 바꿔, 짧은 낱말 짝이 먼저 있으면 반쯤 바뀐 글(「North 급행 (퀵) Lift」)이 남고 긴 이름 짝이 생겨도 다시 안 맞았어요.
//      또 본문에 상태 블록이 남은 옛 답은 칩 자리가 정규식이 넣은 <div class="ss-slot"> 인데, 실리태번이 메시지 HTML 의 클래스에 custom- 을 붙여 .custom-ss-slot 이 돼요.
//      그 확장의 화면 번역 감시는 「.ss-slot 아래에서 바뀐 것」만 봐서, 칩을 다시 그릴 때(채팅 열기 · 새 답)마다 사전에 있는 이름도 영어로 남았어요.
//      → 칩을 새로 그리면 다음 프레임(그리기 전)에 원래 칩 글을 그 확장의 trString(사전)으로 다시 적어요 — 메시지 꾸미기(src/message-decor.js)에 얹어 감시자를 늘리지 않아요. AI 0회 · 사전 그대로.
//   ② 「상태창 전체 번역」 · 「남은 글 번역하기」는 지금 상태창 칸(세계 핵심 + 켜진 칸)의 글만 모아요.
//      칩 글(지나간 장소 · 쓴 아이템 · 의뢰 · 소식 제목 같은 것) · 상단 띠의 최근 기록 · 알림함 글은 상태에 없으면 빠져서 영어로 남았어요.
//      → 그 확장이 번역을 마친 뒤(사전이 늘었거나, 남은 글이 없다고 끝났을 때) 화면에 보일 칩 · 알림 글에서 아직 영어인 부분만 모아
//        그 확장의 trJSON(번역 담당 · 번역 모델 · 지침 · 연결 프로필 · 기능 다리 모델 고르기 그대로)으로 60개씩 옮기고, 그 확장의 addPairs 로 같은 사전에 넣어요.
//        사전이 곧 캐시라 같은 글은 다시 보내지 않아요. 번역기가 영어 그대로 돌려준 글은 이번 접속에 다시 보내지 않아요.
//      자동: 그 확장의 「새로 쓴 영어 글 자동 번역」이 지금 번역 담당에 켜져 있을 때만(실리 기본 번역 · 「항상」) 답이 끝나고 잠시 뒤 같은 일을 해요 — 꺼 두면 누를 때만.
//   그 확장의 파일 · 함수는 고치지 않아요 — 그 확장이 내보낸 함수를 같은 주소로 불러 같은 모듈을 써요(그 확장이 쓰는 길 그대로). 판이 달라 함수가 없으면 아무것도 안 해요.
//   새 감시자 없음: 메시지 꾸미기 하나(칩 자리 기록만 · 화면만 번역일 때만) · 번역 단추를 누른 뒤에만 도는 짧은 확인(1.5초 · 최대 15분).
//   시험: tools/tests/ext-bridge-tr.mjs(빈틈 고르기 · 칩 감시 · 누른 뒤 메우기)

import { addMessageDecorator } from './message-decor.js';

const FOLDER = /meatball|statussim|미트볼/i;
const TRIGGER = '[data-act="trsheet"], [data-s-act="trsheet"], .ss-trf-go';
const SLOT = 'custom-ss-slot';
const SLOTS = '.ss-slot, .custom-ss-slot';
const BATCH = 60;
const WATCH_MS = 1500, WATCH_MAX = 15 * 60 * 1000, AUTO_MS = 8000;
const isObj = value => !!value && typeof value === 'object';

/**
 * 화면에 보일 글(그 확장 사전으로 바꾼 뒤)에서 아직 영어인 한 덩이 — 첫 라틴 글자부터 마지막 라틴 글자까지(붙은 숫자 · 괄호 · 따옴표까지).
 * 앞의 그림 글자 · 한국어 머리(「해제:」 · 「📍」) · 뒤의 +2 · ×3 · … 는 빼요. 옮길 것이 없으면 ''.
 */
export function englishPart(text) {
    const s = String(text ?? '');
    let a = s.search(/[A-Za-z]/);
    if (a < 0) return '';
    let b = s.length - 1;
    while (b >= 0 && !/[A-Za-z]/.test(s[b])) b--;
    while (a > 0 && /[0-9(["'#&]/.test(s[a - 1])) a--;
    while (b + 1 < s.length && /[)\]"'.!?0-9]/.test(s[b + 1])) b++;
    return s.slice(a, b + 1).trim();
}
/** 옮기지 않을 덩이: 너무 짧음 · 대문자 줄임말(HP · SNS · NPC) · SNS 아이디 · 주소 · 너무 김 */
export function skipPart(part) {
    const p = String(part ?? '').trim();
    if (p.replace(/[^A-Za-z]/g, '').length < 2) return true;
    if (/^[A-Z0-9]{1,4}$/.test(p)) return true;
    if (/^@?[A-Za-z0-9_.]{2,30}$/.test(p) && (p.startsWith('@') || /[_.]/.test(p))) return true;
    if (/^[a-z]+:\/\//i.test(p) || p.length > 600) return true;
    return false;
}
/**
 * 화면에 보일 글 목록 → { list: 보낼 덩이(겹침 없음), owners: 덩이 → 원래 글들 }
 * shown(text): 그 확장 사전으로 바꾼 화면 글(trString) · has(part): 사전에 이미 있나 · tried: 이번 접속에 못 바꾼 덩이
 */
export function collectGaps(texts, { shown = t => t, has = () => false, tried = new Set() } = {}) {
    const owners = new Map();
    for (const raw of texts) {
        const text = String(raw ?? '').trim();
        if (!text || !/[A-Za-z]/.test(text)) continue;
        if (!/[A-Za-z]/.test(String(shown(text) ?? text))) continue;   // 그 확장 사전으로 이미 다 바뀌어 보여요
        // 덩이는 원래 글에서 — 화면 글에서 자르면 이름만 바뀐 「카이's Blue …」처럼 반쪽이 돼요. 아는 이름이 든 덩이도 통째로 보내요(번역 지시에 그 이름이 실려요)
        const part = englishPart(text);
        if (!part || skipPart(part) || has(part) || tried.has(part)) continue;
        (owners.get(part) ?? owners.set(part, []).get(part)).push(text);
    }
    return { list: [...owners.keys()], owners };
}
/** 번역 결과 → 사전 짝. 덩이 짝 하나 + (덩이가 40자를 넘으면 그 확장이 글 속에서 안 바꾸므로) 원래 글 통째 짝 */
export function pairsFor(part, ko, owners) {
    const k = String(ko ?? '').trim();
    if (!k || k === part || !/[^\x00-\x7F]/.test(k)) return [];
    const out = [[part, k]];
    if (part.length > 40) for (const text of owners.get(part) ?? []) if (text !== part) out.push([text, text.replace(part, () => k)]);
    return out;
}
/** 화면에 보일 칩 · 기록 · 알림 글: 답마다 칩(snaps) + 최근 기록(state.recent) + 알림함(meta.notes 제목 · 글 · 힌트) */
export function visibleTexts(current, meta) {
    const out = [];
    const snaps = current?.snaps;
    if (snaps && typeof snaps.values === 'function') for (const snap of snaps.values()) for (const label of snap?.labels ?? []) if (typeof label === 'string') out.push(label);
    for (const label of current?.state?.recent ?? []) if (typeof label === 'string') out.push(label);
    for (const note of Array.isArray(meta?.notes) ? meta.notes : []) if (isObj(note)) for (const key of ['title', 'text', 'hint']) if (typeof note[key] === 'string') out.push(note[key]);
    return out;
}

/** 그 확장 폴더(실리태번이 붙인 모듈 script 주소) — 이름으로 먼저, 없으면 manifest 의 이름으로 */
async function findBase(doc) {
    const bases = [];
    for (const el of doc.querySelectorAll?.('script[type="module"][src*="/scripts/extensions/third-party/"]') ?? []) {
        const m = /^(.*\/scripts\/extensions\/third-party\/([^/?#]+)\/)/.exec(el.src || '');
        if (m && !bases.some(b => b.url === m[1])) bases.push({ url: m[1], name: decodeURIComponent(m[2]) });
    }
    const named = bases.find(b => FOLDER.test(b.name));
    if (named) return named.url;
    for (const b of bases.slice(0, 40)) {
        try { const manifest = new URL('manifest.json', b.url).href; const res = await fetch(manifest, { cache: 'force-cache' }); if (res.ok && FOLDER.test(String((await res.json())?.display_name ?? ''))) return b.url; } catch { /* 다음 폴더 */ }
    }
    return '';
}
/** 그 확장이 내보낸 함수(같은 주소 = 같은 모듈) — 하나라도 없으면 null */
async function loadTarget(doc) {
    const base = await findBase(doc);
    if (!base) return null;
    const [tr, core, prompts] = await Promise.all(['src/translate.js', 'src/core.js', 'src/prompts.js'].map(file => { const url = new URL(file, base).href; return import(url); }));
    const need = [tr.translateView, tr.trJSON, tr.addPairs, tr.pairsOf, tr.trString, tr.missingTr, core.getMeta, core.viewTr, core.settings];
    if (need.some(fn => typeof fn !== 'function') || !isObj(core.app)) return null;
    return { tr, core, busy: typeof prompts.mainBusy === 'function' ? prompts.mainBusy : () => false };
}

export function createTrFill(mb, { doc = globalThis.document, toast = globalThis.toastr, now = () => Date.now(), timers = globalThis } = {}) {
    const { tr, core } = mb;
    const tried = new Set();
    let filling = false, watch = null, autoTimer = 0;
    const view = () => { try { return !!core.viewTr(); } catch { return false; } };
    const dictSize = () => { try { const d = core.getMeta()?.tr; return isObj(d) ? Object.keys(d).length : 0; } catch { return 0; } };

    /**
     * ① 메시지들의 칩을 「원래 칩 글 → 그 확장 사전」으로 다시 적어요. 그 확장 화면 번역은 글자 노드를 그 자리에서 바꿔서,
     *    사전에 짧은 낱말(Express)이 먼저 있으면 「West 급행 Lift」처럼 반쯤 바뀐 뒤로는 긴 이름 짝이 생겨도 다시 맞지 않았어요.
     *    칩 차례는 그 메시지 칩 글(snaps · 🎲 뺀 앞 14개)과 같아요 — 수가 다르면 그 확장 화면 번역만 불러요. 메시지 꾸미기가 다음 프레임 · 그리기 전에 불러요.
     */
    function paint(list) {
        if (!view()) return;
        const snaps = core.app.current?.snaps;
        for (const mes of list) {
            const slots = mes?.querySelectorAll?.(SLOTS);
            if (!slots?.length) continue;
            const labels = (snaps?.get?.(Number(mes.getAttribute('mesid')))?.labels ?? []).filter(l => typeof l === 'string' && !l.startsWith('🎲')).slice(0, 14);
            for (const slot of slots) {
                const chips = slot.querySelectorAll('span.ss-mchip');
                if (!chips.length) continue;
                if (chips.length !== labels.length) { try { tr.translateView(slot); } catch { /* 다음 그리기 때 */ } continue; }
                chips.forEach((chip, k) => { let want; try { want = tr.trString(labels[k]); } catch { return; } if (typeof want === 'string' && chip.textContent !== want) chip.textContent = want; });
            }
        }
    }
    /** 메시지 꾸미기가 볼 기록: 칩 자리 안에 칩을 새로 그린 것만(본문 · 스트리밍 글은 안 봐요) */
    const slotRecord = record => { const c = record?.target?.classList; return !!c && (c.contains(SLOT) || c.contains('ss-slot')) && record.addedNodes?.length > 0; };

    /** ② 칩 · 기록 · 알림 글에서 아직 영어인 덩이만 그 확장 번역 길로 → 같은 사전 */
    async function fill(reason = 'click') {
        if (filling || !view()) return 0;
        const current = core.app.current;
        if (!current?.state) return 0;
        const meta = core.getMeta();
        const dict = isObj(meta?.tr) ? meta.tr : {};
        const { list, owners } = collectGaps(visibleTexts(current, meta), { shown: text => tr.trString(text), has: part => Object.hasOwn(dict, part), tried });
        if (!list.length) return 0;
        filling = true;
        let done = 0;
        try {
            for (let i = 0; i < list.length; i += BATCH) {
                const src = { list: list.slice(i, i + BATCH) };
                const out = await tr.trJSON(src);
                if (out === src || !Array.isArray(out?.list) || out.list.length !== src.list.length) continue;   // 실패 · 개수 어긋남 → 다음에 다시
                const pairs = [];
                src.list.forEach((part, k) => { const got = pairsFor(part, out.list[k], owners); if (got.length) { pairs.push(...got); done++; } else tried.add(part); });
                if (pairs.length) tr.addPairs(pairs);
            }
        } finally { filling = false; }
        if (done) {
            try { paint([...(doc.querySelectorAll?.('#chat .mes') ?? [])]); tr.translateView(); } catch { /* 다음 그리기 때 */ }
            // 상단 띠: 그 확장은 같은 글이면 다시 안 그려서(반쯤 바뀐 글자가 남아요) 한 번 새로 그려요 — 그 확장의 renderHud 그대로
            try { const hud = doc.getElementById?.('ss-hud'); if (hud && '_ssHtml' in hud) { hud._ssHtml = ''; core.app.renderHud?.(); } } catch { /* 다음 갱신 때 */ }
            if (reason === 'click') try { toast?.success?.(`칩 · 알림 글 ${done}개도 번역했어요.`, 'Blue Lemonade', { timeOut: 3000 }); } catch { /* 알림 없이 */ }
        }
        return done;
    }

    /** 누른 뒤: 그 확장이 번역을 끝낼 때까지(사전 크기가 두 번 그대로 · 확인 창 닫힘 · 본편 답 안 씀) 기다렸다가 한 번 */
    function arm() {
        if (!view()) return;
        if (watch) { watch.until = now() + WATCH_MAX; return; }
        let empty = false;
        try { empty = tr.missingTr().length === 0; } catch { empty = false; }
        watch = { start: dictSize(), last: -1, same: 0, empty, cancelled: false, until: now() + WATCH_MAX };
        const tick = () => {
            if (!watch) return;
            const size = dictSize();
            const grew = size > watch.start;
            if (watch.cancelled && !grew) { watch = null; return; }   // 그 확장의 확인 창에서 취소 — 아무것도 안 해요
            const open = !!doc.querySelector?.('dialog[open] .popup-button-ok');
            watch.same = size === watch.last ? watch.same + 1 : 0;
            watch.last = size;
            const settled = watch.same >= 2 && !open && !mb.busy();
            if (settled && (grew || watch.empty)) { watch = null; fill('click').catch(e => console.warn('[Blue Lemonade] 미트볼 번역 메우기', e)); return; }
            if (now() > watch.until) { watch = null; return; }
            timers.setTimeout(tick, WATCH_MS);
        };
        timers.setTimeout(tick, WATCH_MS);
    }
    /** 그 확장의 자동 번역이 지금 번역 담당에 켜져 있나(그 확장 규칙 그대로: 끔 · 실리 기본 번역일 때만 · 항상) */
    function autoOn() {
        try {
            const set = core.settings();
            const mode = set.trAuto === true ? 'st' : set.trAuto === false ? 'off' : (set.trAuto || 'st');
            return mode === 'always' || (mode === 'st' && set.trEngine === 'st');
        } catch { return false; }
    }
    function afterReply() {
        if (!view() || !autoOn()) return;
        timers.clearTimeout(autoTimer);
        autoTimer = timers.setTimeout(() => { if (mb.busy()) return afterReply(); fill('auto').catch(e => console.warn('[Blue Lemonade] 미트볼 번역 메우기', e)); }, AUTO_MS);
    }
    function onClick(event) {
        const t = event.target;
        if (!t?.closest) return;
        if (t.closest(TRIGGER)) arm();
        // 번역을 묻는 창에서 사람이 누른 취소만(「남은 글 번역하기」는 번역 고치기 창을 스스로 닫아요 — 그 누름은 isTrusted 가 false) · 이미 번역이 늘었으면 그건 메워요
        else if (watch && event.isTrusted && t.closest('dialog[open] .popup-button-cancel')) watch.cancelled = true;
    }
    return { paint, slotRecord, view, fill, arm, afterReply, onClick, autoOn, _tried: tried, get watching() { return !!watch; } };
}

let started = null;
/** 기능 다리가 시작할 때 한 번 — 그 확장을 못 찾으면 조용히 쉬어요 */
export function startTrFill(doc = globalThis.document) {
    if (started || !doc?.addEventListener) return started;
    started = (async () => {
        let mb = null;
        try { mb = await loadTarget(doc); } catch (error) { console.warn('[Blue Lemonade] 미트볼 번역 메우기', error); }
        if (!mb) return null;
        const fill = createTrFill(mb, { doc });
        doc.addEventListener('click', fill.onClick, true);
        // 감시자를 새로 걸지 않고 메시지 꾸미기(공용 #chat 구독 하나)에 얹어요 — 칩 자리 안이 바뀐 기록만 · 답이 오는 동안에도 · 다음 프레임(그리기 전)
        addMessageDecorator('미트볼 칩 번역', list => fill.paint(list), { settle: 0, live: true, order: 90, filter: fill.slotRecord, enabled: fill.view });
        try {
            const { eventSource, event_types: types } = globalThis.SillyTavern.getContext();
            if (types?.GENERATION_ENDED) eventSource.on(types.GENERATION_ENDED, () => fill.afterReply());
        } catch { /* 누를 때만 */ }
        return fill;
    })();
    return started;
}
