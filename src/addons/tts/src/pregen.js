import { runtimeEnabled } from './runtime.js';
// TTS — 미리 만들기 (1.2.2): 답장이 오면 누를 줄의 소리를 번역을 기다리지 않고 미리 만들어 둔다 (누르면 바로 재생)
//
// 흐름 (답장 하나 = 기록 하나, 메시지 객체 + 글 해시에 묶임 — 번호만으로 묶지 않는다):
//   1차  생성(다시 쓰기 포함)이 끝나기를 최대 3초 → 대사 분석(auto 이고 필요할 때 — 탭·자동 읽기와 같은 요청에 붙음. 실패하면 이 답장은 그만:
//        나중에 분석이 되면 감정이 바뀌어 두 번 값을 치르니까) → clickplay.tapSegments (누를 줄) → player.lineJobs (탭과 같은 작업 ·
//        번역문을 읽을 줄은 held) → 차례로 player.ensureClip
//   2차  번역기가 있으면 번역문이 붙기를(translation.watchDisplay) 기다렸다가 다시 만든 작업 가운데 아직 없는 키만
//        (held 된 줄 · 번역 뒤 달라진 줄). 번역 안 옴이면 지금 글로 한 번 더 본다 (탭이 읽을 글). 시간 초과면 2차는 없음
//        (번역이 늦게라도 붙으면 탭은 번역문 키를 쓰니, 원문으로 만든 소리는 버려짐 — held 된 줄은 누를 때 만든다)
// 1차 전 기다림: 생성(다시 쓰기 포함)이 끝나기를 3초까지 — 분석이 필요하면 분석이 스스로 기다리고, 필요 없으면 끝날 때까지 더 기다린다
//        (곧 다시 쓸 줄에 값을 치르지 않게)
// 한도: 한 답장에 max_chars(기본 3000자)까지 새로 만든다 (대사 먼저, 속마음은 뒤). 캐시에 있거나 이미 만드는 줄은 세지 않음. 넘는 줄은 누를 때 만든다.
//       음량 고르기(WAV, 큼)는 앞 player.PREP_LINES 줄만 — 뒤 줄이 메모리에서 앞 줄을 밀어내지 않게
// 쓸 곳이 없으면 안 만든다: 대사 클릭도 자동 읽기도 꺼져 있으면 끔, 속마음은 대사 클릭이 켜져 있을 때만
// 시작: index.js 가 CHARACTER_MESSAGE_RENDERED(말한 사람 배우기 뒤) · 있는 스와이프로 넘김(400 ms 뒤)에만 부른다 — 조용한 생성 · 번역기·분석의
//       직접 요청은 RENDERED 가 없어 여기로 오지 않는다. 마지막 메시지만, 인사말 · 내 메시지 · 스트리밍으로 이미 읽은 답장 ·
//       보통 생성이 아닌 것(/sendas 등 'command')은 건너뜀.
//       1.2.4: 인사말은 메시지 자체로 판단 — 생성 기록(gen_started · extra.api · extra.model)이 없고 앞에 내 메시지도 없는 것
//       (카드 인사말 · 다른 인사말로 넘김 · 그룹 인사말). 1.2.3 은 "앞에 내 메시지가 없으면 인사말" 이라, 빈 칸으로 보내기만 하는
//       채팅(내 메시지가 하나도 없음)에선 모든 답장을 건너뛰어 누를 때까지 아무것도 안 만들었다. 건너뛴 까닭은 메시지마다 한 번 기록
// 그만두기: 채팅 바뀜(전부) · 스와이프 · 지움(메시지 객체가 바뀜 — 다시 생성 포함) · 스와이프·다시 생성 시작 · 글이 바뀜(편집 · 갱신: 새 기록으로 다시,
//          같은 줄은 캐시). 아직 안 보낸 요청만 취소 (보낸 것은 캐시에 들어감). player.stop() 은 여기를 건드리지 않는다.
// 오류: 429 · 1002 → 엔진 줄을 15초 쉬게 하고 그 줄을 다시 (두 번까지) · 키·잔액 → 그 엔진만 멈춤 (채팅을 바꾸거나, 엔진 설정·키가 바뀌거나,
//       10분 뒤 풀림) · 키가 아직 없음 → 그 줄만 건너뜀 · 그 밖 → 이 답장만 그만. 모두 기록만 (토스트 없음 — 탭하면 재생기가 같은 오류를 알린다)
// 5.6.4 유료 엔진(paid.js — MiniMax 공식 서버 등)은 미리 만들지 않는다 (설정 pregen_paid 를 켠 사람만): 등록한 목소리가 모두 유료면 답장을
//       통째로 건너뛰고(분석 · 번역 기다림도 없음, 까닭은 메시지마다 한 번 기록), 섞여 있으면 유료 엔진 줄만 건너뛴다 (rec.skipped · rec.paid,
//       답장 끝 한 줄에). 집 PC 로컬 게이트웨이처럼 공식이 아닌 MiniMax 주소는 무료라 그대로 만든다. 탭 · 자동 읽기의 작업 · 키는 그대로
// 1.4.4 듣는 언어 (player.listenPrepare): 만들 줄(유료 · 멈춘 · 캐시 없는 엔진 줄은 빼고) 가운데 안 옮긴 줄이 있으면 메시지 한 묶음으로 옮긴 뒤
//       작업을 다시 만든다 — 번역문이 올 답장은 2차(번역문을 기다린 뒤)에만 (번역을 기다리는 동안엔 옮기지 않음). 옮기지 못한 줄은 만들지 않는다
//       (누를 때 다시 옮김 — 원문 소리에 값을 치르지 않게. 얼마 전에 못 옮긴 줄이면 누를 때 원문: listen.failedRecently). 번역기를 쓸 수 없으면(꺼짐 · 키 없음) 누를 때도 원문이라 원문으로 만든다
//
// 밖으로: init() · onRendered(id, type) · onSwipedExisting(id) · pregenMessage(id, { type }) → Promise<기록>|null
//         pregenCancel(pred) · pregenChanged(id) · protectRecent() · state() (시험용)

import { chat, eventSource, event_types } from '../../../../../../../../script.js';
import { settings, providerConfig } from './settings.js';
import * as player from './player.js';
import * as analysis from './analysis.js';
import * as translation from './translation.js';
import * as cache from './cache.js';
import { tapSegments } from './clickplay.js';
import { log } from './log.js';
import { isPaidProvider, paidOnly, pregenPaid } from './paid.js';   // 5.6.4

const IDLE_CAP_MS = 3000;    // 생성이 끝나기를 기다리는 한계
const KEEP_RECS = 5;         // 캐시 정리에서 지켜 둘 최근 답장 수
const RATE_TRIES = 2;        // 429 · 1002 뒤 다시 해 보는 횟수
const RETRY_MS = 1500;       // 분석 e.retry 뒤 한 번 더
const HALT_MS = 600000;      // 키·잔액 오류로 멈춘 엔진을 다시 해 보기까지
// 미리 만들 요청 종류 (CHARACTER_MESSAGE_RENDERED 의 type · 스와이프 · 편집). 'command'(/sendas · 스크립트) 등은 뺀다
const TYPES = new Set(['', 'normal', 'swipe', 'regenerate', 'continue', 'append', 'appendFinal', 'edit']);

const recs = new Map();      // mesId → { id, mes, hash, mode, ctrl, keys, chars, made, lines, skipped, state, t0, seq, promise }
const halted = new Map();    // 엔진 id → { until, sig } 키·잔액 오류 → 채팅 바뀜 · 엔진 설정 바뀜 · 10분 뒤 풀림
let seq = 0;
let wired = false;

const modeOf = (s) => (s && (s.pregen === 'dialogue' || s.pregen === 'all') ? s.pregen : 'off');
function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
}
const textHash = (mes) => hash(String(mes?.mes ?? ''));
const isAbort = (e) => e?.name === 'AbortError';
const errMsg = (e) => String(e?.message || e || '').split(' · ')[0].slice(0, 40);
function sleep(ms, signal) {
    return new Promise((res) => {
        const t = setTimeout(done, ms);
        function done() { clearTimeout(t); signal?.removeEventListener('abort', done); res(); }
        signal?.addEventListener('abort', done, { once: true });
    });
}
/** 잦은 요청 (HTTP 429 · MiniMax 1002) */
const isRate = (e) => e?.status === 429 || e?.code === 429 || e?.code === 1002;
/** 키 · 잔액 · 권한 (재생기의 isAuthError + 402 · 1008) */
function isAuth(e) {
    if (!e) return false;
    if (e.fatal) return true;
    if ([401, 402, 403].includes(e.status) || [401, 402, 403, 1004, 1008].includes(e.code)) return true;
    return /^(invalid_api_key|unauthorized|UNAUTHENTICATED|PERMISSION_DENIED|nokey)$/i.test(String(e.code || ''));
}
function displayReady(mes) {
    if (typeof translation.displayReady === 'function') { try { return !!translation.displayReady(mes); } catch { /* 아래 */ } }
    const d = mes?.extra?.display_text;
    return typeof d === 'string' && d.trim() !== '';
}
/** 번역문이 올 것인가 (wait_translation 설정과 상관없이 번역기 설정만) */
function expectsDisplay(mes) {
    try { return !!translation.translationExpected(mes, { ignoreSetting: true }); } catch { return false; }
}
const waitMs = (s) => Math.max(1, Number(s.translation_timeout) || 90) * 1000;
/** 엔진 설정의 지문 (키가 바뀌면 달라짐 — 값은 남기지 않고 해시만) */
function cfgSig(pid) {
    try { return hash(JSON.stringify(providerConfig(pid) || {})); } catch { return ''; }
}
function isHalted(pid) {
    const h = halted.get(pid);
    if (!h) return false;
    if (Date.now() < h.until && h.sig === cfgSig(pid)) return true;
    halted.delete(pid);
    return false;
}
function halt(pid) {
    halted.set(pid, { until: Date.now() + HALT_MS, sig: cfgSig(pid) });
    log('err', `미리 만들기 멈춤 (키·잔액) · ${pid}`);
}
/** 쓸 곳이 있는 모드: 대사 클릭 · 자동 읽기 둘 다 꺼져 있으면 끔. 속마음은 대사 클릭이 켜져 있을 때만 (자동 읽기는 누를 줄을 읽지 않음) */
function effMode(s) {
    const m = modeOf(s);
    if (m === 'off') return m;
    if (s.click_play === false) return s.auto_play ? 'dialogue' : 'off';
    return m;
}

/** 기록이 아직 살아 있나 (취소 · 다른 기록 · 메시지 객체 · 글 · 설정 · 멈춤) */
function live(rec) {
    const s = settings();
    return !rec.ctrl.signal.aborted && recs.get(rec.id) === rec && chat[rec.id] === rec.mes && textHash(rec.mes) === rec.hash
        && effMode(s) !== 'off' && !!s.enabled && runtimeEnabled();
}
function fail(rec, why) {
    rec.state = 'fail';
    log('err', `미리 만들기 그만 #${rec.id} · ${why}`);
}

// ---------- 한 답장

/** 대사 분석 (필요할 때만). true = 계속 */
async function analyse(rec, awaitDisplay) {
    const s = settings();
    if (!player.analysisWanted(rec.id, rec.mes, s, { quiet: true, awaitDisplay })) return true;
    const need = player.analysisNeeds(rec.id, rec.mes, s, { awaitDisplay });
    for (let attempt = 0; ; attempt++) {
        try {
            const r = await analysis.analyzeMessage(rec.id, { langs: need.langs, signal: rec.ctrl.signal });
            if (!live(rec)) return false;
            if (r && Array.isArray(r.segs)) return true;
            fail(rec, '분석 없음');
            return false;
        } catch (e) {
            if (isAbort(e) || !live(rec)) return false;
            if (e?.retry && attempt < 1) { await sleep(RETRY_MS, rec.ctrl.signal); if (!live(rec)) return false; continue; }
            fail(rec, `분석 실패 · ${errMsg(e)}`);
            return false;
        }
    }
}
/**
 * 1.4.4 듣는 언어: 만들 줄 가운데 안 옮긴 줄이 있으면 메시지 한 묶음으로 옮기고 작업을 다시 만든다 → 새 작업 묶음 (그만뒀으면 null).
 * 유료 엔진(설정이 꺼져 있으면) · 멈춘 엔진 · 캐시 없는 엔진 줄은 만들지 않으니 세지 않는다 — 그런 줄뿐이면 번역도 하지 않는다 (누를 때)
 */
async function listenStep(rec, built, awaitDisplay) {
    if (typeof player.listenPrepare !== 'function' || typeof player.listenOn !== 'function' || !player.listenOn()) return built;
    const s = settings();
    const want = (built.jobs || []).filter(j => j?.listenPending && j.provider?.caps?.blob !== false
        && !(!pregenPaid(s) && isPaidProvider(j.provider?.id)) && !isHalted(j.provider?.id));
    if (!want.length) return built;
    let r = { ok: false, fallback: false };
    try { r = await player.listenPrepare(rec.id, rec.mes, want, { signal: rec.ctrl.signal }); }
    catch { r = { ok: false, fallback: false }; }
    if (!live(rec)) return null;
    if (r.fallback) rec.listenFallback = true;   // 번역기를 못 씀 → 누를 때도 원문이니 원문으로 만든다
    return build(rec, awaitDisplay);
}
/** 누를 줄 → 탭과 같은 작업 */
function build(rec, awaitDisplay) {
    const segs = tapSegments(rec.mes, { thoughts: rec.mode === 'all' && settings().click_play !== false });
    return player.lineJobs(rec.id, rec.mes, segs, { awaitDisplay });
}
/** 작업을 차례로 만든다 (한도 안에서). true = 계속 */
async function make(rec, jobs) {
    const s = settings();
    const cap = Math.max(0, Number(s.max_chars) || 0) || Infinity;
    for (const j of jobs) {
        if (!live(rec)) return false;
        if (!j?.key || rec.keys.has(j.key) || j.provider?.caps?.blob === false) continue;
        if (!pregenPaid(s) && isPaidProvider(j.provider?.id)) { rec.skipped++; rec.paid++; continue; }   // 5.6.4 유료 엔진 줄은 누를 때
        if (isHalted(j.provider?.id)) { rec.skipped++; continue; }
        if (j.listenPending && !rec.listenFallback) { rec.listen++; continue; }   // 1.4.4 듣는 언어로 못 옮긴 줄은 누를 때 (원문 소리를 사지 않게)
        const known = player.isInflight(j.key) || await Promise.resolve(cache.has(j.key)).catch(() => false);
        if (!live(rec)) return false;
        if (!known && rec.chars + j.text.length > cap) { rec.skipped++; continue; }   // 넘는 줄은 누를 때
        for (let tries = 0; ; tries++) {
            try {
                const r = await player.ensureClip(j, { signal: rec.ctrl.signal, prepare: rec.lines < (player.PREP_LINES ?? Infinity) });
                rec.keys.add(j.key);
                rec.lines++;
                if (r.made && !known) { rec.chars += j.text.length; rec.made++; }
                break;
            } catch (e) {
                if (isAbort(e) || !live(rec)) return false;
                if (e?.fatal && e.status === undefined && e.code === undefined) { rec.skipped++; break; }   // 키가 아직 없음 (보내지 않음): 이 줄만
                if (isAuth(e)) { halt(j.provider.id); rec.skipped++; break; }                                  // 그 엔진만 멈춤, 다른 엔진 줄은 계속
                if (isRate(e) && tries < RATE_TRIES) { player.coolDown(j.provider.id); log('info', `미리 만들기 쉼 #${rec.id} (요청이 잦음)`); continue; }
                fail(rec, errMsg(e) || '합성 실패');
                return false;
            }
        }
    }
    return true;
}
async function run(rec) {
    const { id, mes } = rec;
    const signal = rec.ctrl.signal;
    if (typeof analysis.untilIdle === 'function') {
        const cap = new AbortController();                      // 3초 한계 타이머 · 생성 확인(폴링)은 끝나면 치움
        const onStop = () => cap.abort();
        signal.addEventListener('abort', onStop, { once: true });
        try {
            let idle = false;
            const until = Promise.resolve().then(() => analysis.untilIdle(cap.signal)).then(() => { idle = true; }, () => { idle = true; });
            await Promise.race([until, sleep(IDLE_CAP_MS, cap.signal)]);
            // 3초가 지났는데 아직 생성 중 (다시 쓰기 등): 분석이 필요 없으면(분석은 스스로 기다림) 끝날 때까지 더 — 곧 바뀔 줄에 값을 치르지 않게
            if (!idle && live(rec)) {
                const ad = !displayReady(mes) && expectsDisplay(mes);
                if (!player.analysisWanted(id, mes, settings(), { quiet: true, awaitDisplay: ad })) await until;
            }
        } finally { cap.abort(); signal.removeEventListener('abort', onStop); }
    }
    if (!live(rec)) return;
    const awaitDisplay = !displayReady(mes) && expectsDisplay(mes);
    if (!(await analyse(rec, awaitDisplay))) return;
    let a = build(rec, awaitDisplay);
    if (!awaitDisplay && !(a = await listenStep(rec, a, false))) return;   // 1.4.4 번역문을 기다릴 답장은 2차에서
    if (!(await make(rec, a.jobs))) return;
    if (awaitDisplay) {
        let r = 'none';
        if (typeof translation.watchDisplay === 'function') {
            try { r = await translation.watchDisplay(id, mes, { signal, timeoutMs: waitMs(settings()) }); } catch { r = 'none'; }
        }
        if (!live(rec)) return;
        if (r === 'timeout') {
            if (a.held) log('info', `번역 안 옴 · 미룬 ${a.held}줄은 누를 때 #${id}`);
        } else {
            if (!(await analyse(rec, false))) return;
            let b = build(rec, false);
            if (!(b = await listenStep(rec, b, false))) return;   // 1.4.4
            const fresh = b.jobs.filter(j => j?.key && !rec.keys.has(j.key));
            if (r === 'done' && fresh.length > a.held) log('info', `번역 뒤 새로 ${fresh.length - a.held}줄 #${id}`);
            if (!(await make(rec, fresh))) return;
        }
    }
    rec.state = 'done';
    const sec = Math.round((Date.now() - rec.t0) / 100) / 10;
    const over = rec.skipped - rec.paid;
    log('info', `미리 만들기 #${id} · ${rec.lines}줄 · ${rec.chars}자 · ${sec}s${over ? ` · 한도 넘은 ${over}줄` : ''}${rec.paid ? ` · 유료 엔진 ${rec.paid}줄은 누를 때` : ''}${rec.listen ? ` · 못 옮긴 ${rec.listen}줄은 누를 때` : ''}`);
}

function cancelRec(rec) {
    if (!rec.ctrl.signal.aborted) rec.ctrl.abort();
    if (rec.state === 'run') rec.state = 'cancel';
    if (recs.get(rec.id) === rec) recs.delete(rec.id);
}
/** 오래된 끝난 기록은 버림 (최근 KEEP_RECS 개 + 도는 것) */
function trimRecs() {
    const done = [...recs.values()].filter(r => r.state !== 'run').sort((a, b) => b.seq - a.seq);
    for (const r of done.slice(KEEP_RECS)) recs.delete(r.id);
}
/** 최근 답장 몇 개의 키는 캐시 정리에서 뺀다 */
export function protectRecent() {
    const list = [...recs.values()].sort((a, b) => b.seq - a.seq).slice(0, KEEP_RECS);
    const keys = [];
    for (const r of list) keys.push(...r.keys);
    try { if (typeof cache.setProtected === 'function') cache.setProtected(keys); } catch { /* 캐시 없음 */ }
}
function start(id, mes, type) {
    if (!runtimeEnabled()) return null;
    const h = textHash(mes);
    const old = recs.get(id);
    if (old && old.mes === mes && old.hash === h && !old.ctrl.signal.aborted && (old.state === 'run' || old.state === 'done')) return old.promise;
    if (old) cancelRec(old);
    const rec = { id, mes, hash: h, type, mode: effMode(settings()), ctrl: new AbortController(), keys: new Set(), chars: 0, made: 0, lines: 0, skipped: 0, paid: 0, listen: 0, listenFallback: false, state: 'run', t0: Date.now(), seq: ++seq, promise: null };
    recs.set(id, rec);
    rec.promise = run(rec)
        .catch(e => { if (!isAbort(e)) fail(rec, errMsg(e) || '오류'); })
        .then(() => {
            if (rec.state === 'run') rec.state = 'cancel';   // 끝까지 돈 것만 run() 이 'done' 으로 — 중간에 그만둔 것은 다음 start() 가 다시 한다
            trimRecs();
            protectRecent();
            return rec;
        });
    return rec.promise;
}

// ---------- 밖으로

/** 생성으로 만든 메시지인가 (실리태번이 생성·스와이프·이어쓰기 때 gen_started 를, 보낸 답장에 extra.api · model 을 적는다 — 인사말엔 없음) */
const generated = (mes) => !!(mes?.gen_started || mes?.extra?.api || mes?.extra?.model);
/** 인사말: 생성 기록이 없고 앞에 내 메시지도 없음 (카드 인사말 · 다른 인사말로 넘김 · 그룹의 여러 인사말) */
const isGreeting = (id, mes) => !generated(mes) && !chat.slice(0, id).some(m => m?.is_user);
/** 이 메시지를 미리 만들까: 이유(건너뜀) 또는 ''. 'off' 는 기록하지 않음 */
function skipReason(id, type) {
    const s = settings();
    if (effMode(s) === 'off' || !s.enabled) return 'off';
    const mes = Number.isInteger(id) && id >= 0 ? chat[id] : null;
    if (!mes || mes.is_user || mes.is_system) return 'off';
    const text = String(mes.mes || '');
    if (!text.trim() || text === '...') return '빈 답장';
    if (type === 'first_message' || isGreeting(id, mes)) return '인사말';
    if (!TYPES.has(String(type ?? ''))) return `생성 종류 ${type}`;
    if (id !== chat.length - 1) return '마지막 메시지가 아님';
    if (player.wasStreamRead(id)) return '스트리밍으로 읽음';
    if (!pregenPaid(s) && paidOnly(s)) return '유료 엔진';   // 5.6.4 목소리가 모두 유료 엔진: 분석 · 번역 기다림 없이 통째로 (누를 때 만든다)
    return '';
}
const skipSeen = new Set();
/** 건너뛴 까닭은 메시지(번호 + 글)마다 한 번만 기록 */
function noteSkip(id, why) {
    const k = `${id}|${textHash(chat[id])}|${why}`;
    if (skipSeen.has(k)) return;
    if (skipSeen.size > 200) skipSeen.clear();
    skipSeen.add(k);
    log('info', `미리 만들기 건너뜀 #${id} · ${why}`);
}
/** 답장 하나 미리 만들기 → 기록의 약속 (건너뛰면 null) */
export function pregenMessage(mesId, { type = '' } = {}) {
    if (!runtimeEnabled()) return null;
    const id = Number(mesId);
    const why = skipReason(id, type);
    if (why) {
        if (why !== 'off') noteSkip(id, why);
        return null;
    }
    return start(id, chat[id], type);
}
/** 답장이 그려짐 (index.js: 말한 사람 배우기 뒤) — 실리태번의 그리기 사슬을 늦추지 않게 다음 틱에 */
export function onRendered(mesId, type) {
    if (type === 'first_message') return;
    const id = Number(mesId);
    setTimeout(() => {
        try { pregenMessage(id, { type }); }
        catch (e) { log('err', `미리 만들기 시작 실패: ${errMsg(e)}`); }
    }, 0);
}
/** 있는 스와이프로 넘김 (index.js 의 400 ms 확인 뒤, 생성이 시작되지 않았을 때) — 대개 캐시에 있음 */
export function onSwipedExisting(mesId) {
    const id = Number(mesId);
    if (id !== chat.length - 1) return null;
    return pregenMessage(id, { type: 'swipe' });
}
/** 조건에 맞는 기록 그만두기 (아직 안 보낸 요청만 취소) */
export function pregenCancel(pred = () => true) {
    for (const rec of [...recs.values()]) if (pred(rec)) cancelRec(rec);
    protectRecent();
}
/** 글이 바뀜 (편집 · 갱신): 기록이 있을 때만 — 같은 메시지면 새 기록으로 다시 (바뀐 줄만 새로 만듦), 메시지가 바뀌었으면 그만 */
export function pregenChanged(mesId) {
    const id = Number(mesId);
    const rec = recs.get(id);
    if (!rec) return null;
    const mes = chat[id];
    if (!mes || mes !== rec.mes) { cancelRec(rec); return null; }
    if (textHash(mes) === rec.hash) return null;
    if (id !== chat.length - 1) { cancelRec(rec); return null; }       // 마지막 메시지만 (옛 답장의 편집은 누를 때 만든다)
    const s = settings();
    if (effMode(s) === 'off' || !s.enabled || mes.is_system) { cancelRec(rec); return null; }
    return start(id, mes, 'edit');
}
/** 시험 · 기록용 */
export function state() {
    return { halted: [...halted.keys()].filter(isHalted), recs: [...recs.values()].map(r => ({ id: r.id, state: r.state, lines: r.lines, chars: r.chars, made: r.made, skipped: r.skipped, paid: r.paid, keys: [...r.keys] })) };
}
/** 이벤트 (그만두기 · 다시). 시작은 index.js 가 onRendered · onSwipedExisting 으로 */
export function init() {
    if (wired) return;
    wired = true;
    const on = (name, fn) => { if (name && typeof eventSource?.on === 'function') eventSource.on(name, fn); };
    on(event_types.CHAT_CHANGED, () => { pregenCancel(); halted.clear(); try { cache.setProtected?.([]); } catch { /* 없음 */ } });
    on(event_types.MESSAGE_SWIPED, (id) => pregenCancel(r => r.id === Number(id)));
    on(event_types.MESSAGE_DELETED, () => pregenCancel(r => chat[r.id] !== r.mes));
    on(event_types.GENERATION_STARTED, (type, _params, dryRun) => {
        if (dryRun || (type !== 'swipe' && type !== 'regenerate')) return;
        const id = chat.length - 1;
        pregenCancel(r => r.id === id);
    });
    // 약속을 돌려주지 않는다: 실리태번 eventSource.emit 은 리스너가 돌려준 약속을 기다린다(lib/eventemitter.js) — 미리 만들기는
    // 번역을 최대 translation_timeout(90초) 기다리므로, 돌려주면 MESSAGE_UPDATED 를 낸 쪽(다시 쓰기 · 번역기 · 생성 마무리)이 그동안 멈춰
    // 끊긴 스트림 뒤 입력창이 잠긴 채로 남았다 (2026-10-06, 스모크 --stream --tts 로 재현)
    const changed = (id) => { try { pregenChanged(id); } catch (e) { log('err', `미리 만들기 갱신 실패: ${errMsg(e)}`); } };
    on(event_types.MESSAGE_EDITED, changed);
    on(event_types.MESSAGE_UPDATED, changed);
}
