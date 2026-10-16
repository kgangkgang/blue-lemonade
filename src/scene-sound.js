// 장면 소리 (6.9.8): 날씨 효과가 켜져 있으면 그 장면에 맞는 배경 소리가 끊김 없이 이어진다 — TTS 가 꺼져 있어도.
//   비 → 빗소리(+ 가끔 천둥, 설정) · 흩날림(breeze) → 바람 · 눈 · 안개 → 아주 낮은 바람 · 물결 → 물결. 그 밖의 날씨는 소리 없음.
//   날씨가 바뀌면 1.5초 크로스페이드, 끄면 1.2초 페이드아웃. 소리는 WebAudio 로 합성(scene-sound-synth.js)하거나 내 파일(설정 sceneSound.files, 실리태번 사용자 파일)을 반복한다.
//   설정: salty.sceneSound = { on, volume(%), thunder, background, files: { rain | wind | hush | water: '/user/files/…' } } — 기본 꺼짐. 켤 때만 불러온다 (features.js).
//
// TTS 효과음과 겹치지 않게 — 일반 이름 다리:
//   const ambient = globalThis[Symbol.for('blue-lemonade.ambient')];
//   ambient?.playing()        → { kind: 'rain' | 'wind' | 'hush' | 'water', since: ms } | null   (지금 들리는 배경 소리)
//   ambient?.kinds            → Set — 들리는 종류들 ('rain' 에 천둥을 켰으면 'thunder' 도)
//   ambient?.covers(sfxId)    → 그 효과음(daily_rain · thunder · wind · daily_stream)을 배경 소리가 대신하고 있나 — TTS 는 참이면 그 효과음을 건너뛴다
//   ambient?.onChange(fn)     → 구독 해제 함수. 들리는 종류가 바뀔 때 fn({ kind, kinds })
//
// 폰: 소리판(AudioContext)은 첫 터치 · 키 입력에서 깨운다. 탭이 숨으면 설정(background, 기본 켬)대로 계속 두거나 쉬게 한다.
//   계속 둘 때도 천둥 타이머는 멈춘다(숨은 탭의 타이머는 느리다 · 처리 줄이기). 백그라운드 창(background-window.js)의 무음과는 별개 소리판이라 서로 건드리지 않는다.
import { tidySceneSound, effectiveModes, soundFor, ambientKinds, coversSfx, crossfadePlan, masterGain, thunderGap, FADE, KINDS } from './scene-sound-rules.js';
import { buildVoice, strikeThunder } from './scene-sound-synth.js';

export const AMBIENT = Symbol.for('blue-lemonade.ambient');
export const VERSION = 1;
const TRACKER_EVENTS = ['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'CHAT_CHANGED', 'MESSAGE_EDITED'];
const TRACKER_DELAY_MS = 700;   // 날씨 모듈이 트래커 글을 400ms 뒤에 다시 읽는다 — 그 뒤에 본다

// 바깥 세상 (시험에서 바꿔 끼운다)
let host = {
    AudioContext: () => globalThis.AudioContext || globalThis.webkitAudioContext || null,
    doc: () => globalThis.document,
    now: () => Date.now(),
    random: () => Math.random(),
    fetch: (...args) => globalThis.fetch(...args),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: id => clearTimeout(id),
    weather: () => import('./weather.js'),   // 트래커 따라일 때만 — 날씨 모듈이 실제로 그리는 효과를 읽는다
    context: () => globalThis.SillyTavern?.getContext?.(),
};

let ctx = null, master = null, unsupported = false;
let cfg = tidySceneSound(null);
let wanted = { on: false, weatherOn: false, weatherChat: null };
let active = null;                 // { voice, kind, url, since }
let outgoing = new Set();          // 페이드아웃 중인 목소리들
let loading = 0;                   // 내 파일 읽기 경주 토큰
let resting = false;               // 숨은 탭에서 쉬는 중 (background 끔)
let thunderTimer = 0, thunderDue = 0, thunderCount = 0;
let bound = false, trackerBound = false, trackerTimer = 0, gestureBound = false;
const buffers = new Map();         // url → Promise<AudioBuffer>
const listeners = new Set();
let lastSignal = '';

// ───────── 다리 ─────────
function kindsNow() { return new Set(active && !resting ? ambientKinds(active.kind, cfg) : []); }
const bridge = Object.freeze({
    version: VERSION,
    playing: () => active && !resting ? { kind: active.kind, since: active.since } : null,
    get kinds() { return kindsNow(); },
    covers: sfxId => coversSfx(kindsNow(), sfxId),
    onChange(fn) { if (typeof fn === 'function') listeners.add(fn); return () => listeners.delete(fn); },
});
export function installAmbientBridge(globalObject = globalThis) {
    const found = globalObject[AMBIENT];
    if (found && typeof found.playing === 'function' && typeof found.covers === 'function' && found !== bridge) return found;   // 다른 확장이 먼저 세웠으면 그대로
    return (globalObject[AMBIENT] = bridge);
}
installAmbientBridge();
function signal() {
    const kinds = [...kindsNow()].sort();
    const key = `${active && !resting ? active.kind : ''}|${kinds.join(',')}`;
    if (key === lastSignal) return;
    lastSignal = key;
    for (const fn of listeners) { try { fn({ kind: active && !resting ? active.kind : null, kinds: new Set(kinds) }); } catch (error) { console.warn('[Blue Lemonade] 장면 소리 알림', error); } }
}

// ───────── 소리판 ─────────
function ensureContext() {
    if (ctx) return ctx;
    if (unsupported) return null;
    const Ctor = host.AudioContext();
    if (typeof Ctor !== 'function') { unsupported = true; return null; }
    try {
        ctx = new Ctor({ latencyHint: 'playback' });   // 배경 소리라 지연은 상관없다 — 큰 버퍼로 덜 깨운다 (전력)
        master = ctx.createGain();
        master.gain.value = masterGain(cfg.volume);
        master.connect(ctx.destination);
    } catch (error) { unsupported = true; ctx = master = null; console.info('[Blue Lemonade] 장면 소리를 켜지 못했어요', error?.message || error); return null; }
    return ctx;
}
/** 폰 자동재생 정책: 사용자 동작이 있기 전에는 소리판이 멈춰 있다 — 첫 터치 · 키 입력에서 깨운다 */
function wakeOnGesture() {
    const doc = host.doc();
    if (gestureBound || !doc?.addEventListener) return;
    gestureBound = true;
    const wake = () => { if (ctx && ctx.state === 'suspended' && !resting && (active || wanted.on)) ctx.resume?.().catch?.(() => {}); };
    for (const type of ['pointerdown', 'keydown', 'touchend']) doc.addEventListener(type, wake, { capture: true, passive: true });
}
function resumeContext() {
    if (!ctx || resting) return;
    if (ctx.state === 'suspended') { try { const p = ctx.resume?.(); p?.catch?.(() => {}); } catch { /* 사용자 동작 뒤에 */ } }
    wakeOnGesture();
}
/** 아무 소리도 안 남았으면 소리판을 재운다 (전력) — 나가는 소리가 다 걷힌 뒤에 부른다 */
function maybeSuspend() {
    if (active || outgoing.size || !ctx || ctx.state !== 'running') return;
    try { ctx.suspend?.()?.catch?.(() => {}); } catch { /* 그대로 */ }
}
/** 페이드아웃이 끝난 뒤 멈추고 걷는다 — 걷힌 뒤 소리판을 재울지 본다 */
function retire(entry, stopAt) {
    outgoing.add(entry);
    entry.voice.stop(stopAt);
    host.setTimeout(() => { outgoing.delete(entry); maybeSuspend(); }, Math.ceil((stopAt - ctx.currentTime) * 1000) + 60);
}

// ───────── 페이드 ─────────
function ramp(param, from, to, at, until) {
    try {
        param.cancelScheduledValues(at);
        param.setValueAtTime(from, at);
        param.linearRampToValueAtTime(to, until);
    } catch { param.value = to; }
}
function fadeOut(entry, seconds) {
    const now = ctx.currentTime;
    const [step] = crossfadePlan({ now, outFrom: entry.voice.gain.gain.value, out: seconds });
    ramp(entry.voice.gain.gain, step.from, step.to, step.at, step.until);
    retire(entry, step.stopAt);
}
function fadeIn(entry, seconds) {
    const now = ctx.currentTime;
    const [step] = crossfadePlan({ now, inTo: entry.voice.trim, fadeIn: seconds });
    ramp(entry.voice.gain.gain, step.from, step.to, step.at, step.until);
}

// ───────── 천둥 ─────────
function stopThunder() { if (thunderTimer) host.clearTimeout(thunderTimer); thunderTimer = 0; thunderDue = 0; }
function scheduleThunder(first) {
    stopThunder();
    if (!active || active.kind !== 'rain' || !cfg.thunder || resting || host.doc()?.hidden) return;
    const gap = thunderGap(first, host.random());
    thunderDue = host.now() + gap * 1000;
    thunderTimer = host.setTimeout(() => {
        thunderTimer = 0;
        if (!active || active.kind !== 'rain' || !cfg.thunder || !ctx) return;
        try { strikeThunder(ctx, active.voice.gain, { rand: host.random() }); thunderCount++; } catch (error) { console.info('[Blue Lemonade] 천둥', error?.message || error); }
        scheduleThunder(false);
    }, gap * 1000);
}

// ───────── 내 파일 ─────────
function loadBuffer(url) {
    if (!buffers.has(url)) {
        buffers.set(url, (async () => {
            const res = await host.fetch(url, { cache: 'force-cache' });
            if (!res.ok) throw new Error(`${res.status}`);
            const bytes = await res.arrayBuffer();
            return await ctx.decodeAudioData(bytes);
        })().catch(error => { buffers.delete(url); throw error; }));
        if (buffers.size > 4) buffers.delete(buffers.keys().next().value);
    }
    return buffers.get(url);
}

// ───────── 고르기 · 틀기 ─────────
async function play(kind) {
    const url = kind ? cfg.files[kind] || '' : '';
    if (active && active.kind === kind && active.url === url) { resumeContext(); return; }
    if (!kind) {
        const token = ++loading;
        if (active) { fadeOut(active, FADE.out); active = null; stopThunder(); signal(); }
        return token;
    }
    if (!ensureContext()) return;
    const token = ++loading;
    let buffer = null;
    if (url) {
        try { buffer = await loadBuffer(url); } catch (error) { console.info('[Blue Lemonade] 장면 소리 파일을 못 읽어 합성 소리로 대신해요', url, error?.message || error); }
        if (token !== loading) return;   // 그 사이 다른 소리로 바뀜
    }
    let voice;
    try { voice = buildVoice(ctx, kind, { buffer }); } catch (error) { console.warn('[Blue Lemonade] 장면 소리', error); return; }
    voice.gain.connect(master);
    const entry = { voice, kind, url: buffer ? url : '', since: host.now() };
    const swap = !!active;
    if (active) fadeOut(active, FADE.swap);
    active = entry;
    resumeContext();
    voice.start(ctx.currentTime);
    fadeIn(entry, swap ? FADE.swap : FADE.in);
    scheduleThunder(true);
    signal();
    return token;
}

async function trackerCurrent() {
    try { const m = await host.weather(); return m?.weatherState?.()?.current ?? null; } catch { return null; }
}
let deciding = null;
/** 지금 날씨 → 소리 종류를 정하고 튼다 (겹쳐 불리면 마지막 것만) */
function decide() {
    if (deciding) return deciding;
    deciding = (async () => {
        await Promise.resolve();
        deciding = null;
        if (!wanted.on || !wanted.weatherOn || resting) return play(null);
        const chat = wanted.weatherChat;
        const current = chat?.weather === 'tracker' ? await trackerCurrent() : null;
        if (!wanted.on || !wanted.weatherOn || resting) return play(null);
        const now = wanted.weatherChat;
        if (now?.weather !== chat?.weather || now?.weather2 !== chat?.weather2) return decide();   // 트래커를 읽는 사이 날씨 설정이 바뀜 — 새 값으로 다시 (옛 날씨로 끄거나 틀지 않게)
        return play(soundFor(effectiveModes(chat, current)));
    })();
    return deciding;
}

// ───────── 바깥 신호 ─────────
function onVisibility() {
    const hidden = !!host.doc()?.hidden;
    if (hidden) {
        if (!cfg.background && active) { resting = true; fadeOut(active, FADE.hide); active = null; signal(); }
        stopThunder();   // 계속 둘 때도 천둥 타이머는 쉰다 — 숨은 탭의 처리 줄이기
        return;
    }
    if (resting) { resting = false; if (ctx) resumeContext(); }
    if (active) scheduleThunder(false); else decide();
}
function bindDocument() {
    const doc = host.doc();
    if (bound || !doc?.addEventListener) return;
    bound = true;
    doc.addEventListener('visibilitychange', onVisibility);
}
function bindTracker() {
    if (trackerBound) return;
    try {
        const { eventSource, event_types } = host.context() || {};
        if (!eventSource?.on || !event_types) return;
        trackerBound = true;
        const later = () => { if (wanted.weatherChat?.weather !== 'tracker') return; host.clearTimeout(trackerTimer); trackerTimer = host.setTimeout(() => { trackerTimer = 0; decide(); }, TRACKER_DELAY_MS); };
        for (const name of TRACKER_EVENTS) if (event_types[name]) eventSource.on(event_types[name], later);
    } catch { /* 이벤트가 없으면 설정이 바뀔 때만 다시 본다 */ }
}

/** features.js 가 설정이 바뀔 때마다 부른다: on = 테마 켬 + sceneSound.on, raw = 설정 sceneSound, weatherChat · weatherOn = 날씨 모듈에 준 것과 같은 값 */
export function syncSceneSound(on, raw, weatherChat = null, weatherOn = false) {
    const next = tidySceneSound(raw);
    const volumeChanged = next.volume !== cfg.volume, thunderChanged = next.thunder !== cfg.thunder;
    cfg = next;
    wanted = { on: !!on, weatherOn: !!weatherOn, weatherChat: weatherChat ? { weather: weatherChat.weather, weather2: weatherChat.weather2 } : null };
    if (master && volumeChanged) ramp(master.gain, master.gain.value, masterGain(cfg.volume), ctx.currentTime, ctx.currentTime + 0.12);
    if (!wanted.on) { resting = false; stopThunder(); return play(null); }
    bindDocument();
    if (wanted.weatherChat?.weather === 'tracker') bindTracker();
    if (resting && !cfg.background) return;   // 숨은 탭에서 쉬는 중 — 돌아오면 이어진다
    if (resting && cfg.background) { resting = false; resumeContext(); }
    if (thunderChanged && active) scheduleThunder(false);
    return decide();
}

/** 설정 창 「들어 보기」: 그 종류(내 파일이 있으면 그 파일)를 ms 동안 — 누르는 순간이라 소리판을 깨울 수 있다 */
export async function previewSceneSound(kind, ms = 4000) {
    if (!KINDS.includes(kind) || !ensureContext()) return false;
    resumeContext();
    let buffer = null;
    const url = cfg.files[kind] || '';
    if (url) { try { buffer = await loadBuffer(url); } catch { buffer = null; } }
    const voice = buildVoice(ctx, kind, { buffer });
    voice.gain.connect(master);
    const now = ctx.currentTime;
    voice.start(now);
    ramp(voice.gain.gain, 0, voice.trim, now, now + 0.3);
    await new Promise(resolve => host.setTimeout(resolve, ms));
    const end = ctx.currentTime;
    ramp(voice.gain.gain, voice.gain.gain.value, 0, end, end + 0.6);
    retire({ voice, kind, url, since: 0 }, end + 0.65);
    return true;
}

/** 시험 · 측정용 상태 */
export function sceneSoundState() {
    return {
        supported: !unsupported, context: ctx?.state ?? null, currentTime: ctx?.currentTime ?? null, master: master?.gain.value ?? null,
        kind: active?.kind ?? null, file: active?.url || '', since: active?.since ?? 0, nodes: active?.voice.nodes ?? 0, gain: active?.voice.gain.gain.value ?? null,
        outgoing: [...outgoing].map(e => ({ kind: e.kind, gain: e.voice.gain.gain.value })),
        resting, thunderDue, thunderCount, wanted: { ...wanted }, cfg: { ...cfg, files: { ...cfg.files } },
        bridge: { playing: bridge.playing(), kinds: [...bridge.kinds] },
    };
}
export const _forTest = {
    bridge,
    setHost(partial) { host = { ...host, ...partial }; },
    masterNode: () => master,
    context: () => ctx,
    reset() {
        stopThunder(); host.clearTimeout(trackerTimer); trackerTimer = 0;
        for (const e of outgoing) { try { e.voice.stop(); } catch { /* */ } }
        outgoing = new Set(); if (active) { try { active.voice.stop(); } catch { /* */ } } active = null;
        try { ctx?.close?.(); } catch { /* */ }
        ctx = master = null; unsupported = false; resting = false; buffers.clear(); lastSignal = ''; listeners.clear(); bound = trackerBound = gestureBound = false; thunderCount = 0;
        cfg = tidySceneSound(null); wanted = { on: false, weatherOn: false, weatherChat: null };
    },
};
