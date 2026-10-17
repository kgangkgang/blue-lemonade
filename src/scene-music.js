// 분위기 음악 (7.0.1, 장면 소리 안): 최근 답 1~2개에서 분위기(일상 · 긴장 · 전투 · 로맨스 · 슬픔 · 신비 · 축제)를 골라 그 분위기 곡을 끊김 없이 반복한다.
//   판정 · 유지 시간 · 덕킹 · 상한 규칙은 scene-music-rules.js(순수), 곡은 src/scene-music/*.mp3 (OpenGameArt CC0, 출처 src/scene-music/SOURCES.json).
//   소리판(AudioContext)은 장면 소리(scene-sound.js)의 것을 같이 쓴다 — scene-sound.js 가 켤 때만 이 모듈을 불러 attachMusic 으로 이어 준다.
//   그래프: 곡(BufferSource, loop) → 곡 게인(크로스페이드) → 덕킹 게인(TTS 가 말할 때 0.3) → 음악 버스(음악 크기 · 합 상한) → 출력
//   설정: salty.sceneSound.music = { on, volume(%), mood: 'auto' | 분위기, files: { 분위기: '/user/files/…' } } — 기본 꺼짐.
//   숨은 탭 · 화면 꺼짐: 장면 소리의 「화면 밖에서도」(background)를 따른다 — 끄면 날씨 소리와 같이 쉬고, 돌아오면 같은 분위기로 이어진다.
import { missingFile } from './scene-sound.js';   // 7.0.1 내 곡을 못 읽으면 한 번 알림
import { tidyMusic, detectMood, nextMood, pickTrack, duckLevel, anySpeaking, loopBounds, FADE, DUCK, MOOD_LABELS, MOODS } from './scene-music-rules.js';

const EVENTS = ['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'CHAT_CHANGED'];
const EVALUATE_DELAY_MS = 900;   // 답이 그려지고 번역 · 다시 쓰기가 끝날 틈
const MEDIA_EVENTS = ['play', 'playing', 'pause', 'ended', 'emptied', 'abort', 'volumechange'];
const BUFFER_KEEP = 2;           // 디코드된 곡은 지금 곡 + 들어오는 곡만 (80초 모노 ≈ 15MB)

let env = null;                  // scene-sound.js 가 준다: { ensureContext, ctx, host, resume, maybeSuspend, level }
let bus = null, duck = null;
let cfg = tidyMusic(null), enabled = false, resting = false;
let state = { mood: null, since: 0, pending: null };
let lastDetect = null, chatKey = null;
const turns = {};                // 분위기마다 들어간 횟수 → 다음 곡
let active = null;               // { mood, track, voice, since }
let outgoing = new Set();
let loading = 0;
const buffers = new Map();       // url → Promise<{ buffer, bounds }>
let speaking = false, ducked = false, releaseTimer = 0, evalTimer = 0;
let bound = false, mediaBound = false;
const marks = new Set();

const ctx = () => env?.ctx?.() || null;
const host = () => env?.host?.() || {};

// ───────── 그래프 ─────────
function ensureBus() {
    const c = env?.ensureContext?.();
    if (!c) return null;
    if (bus && bus.context === c) return c;
    bus = c.createGain(); duck = c.createGain();
    bus.gain.value = env.level?.() ?? 0;
    duck.gain.value = duckLevel(speaking);
    ducked = speaking;
    duck.connect(bus); bus.connect(c.destination);
    return c;
}
function ramp(param, to, seconds) {
    const c = ctx();
    if (!c || !param) return;
    const now = c.currentTime;
    try { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); param.linearRampToValueAtTime(to, now + seconds); }
    catch { param.value = to; }
}
/** scene-sound.js 가 음악 크기 · 합 상한을 바꿀 때 */
export function setMusicLevel(gain) { if (bus) ramp(bus.gain, Math.max(0, Number(gain) || 0), 0.4); }

function buildVoice(c, buffer, bounds) {
    const src = c.createBufferSource();
    src.buffer = buffer; src.loop = true;
    src.loopStart = bounds.start; src.loopEnd = bounds.end;
    const gain = c.createGain();
    gain.gain.value = 0;
    src.connect(gain); gain.connect(duck);
    let started = false, stopped = false;
    return {
        gain, nodes: 2,
        start(at) { if (started) return; started = true; src.start(at, bounds.start); },
        stop(at) {
            if (stopped) return; stopped = true;
            try { if (started) src.stop(Math.max(at, c.currentTime)); } catch { /* 이미 멈춤 */ }
            const wait = Math.max(0, (at - c.currentTime) * 1000) + 40;
            (host().setTimeout || setTimeout)(() => { try { src.disconnect(); gain.disconnect(); } catch { /* 이미 뗌 */ } }, wait);
        },
    };
}
function retire(entry, seconds) {
    const c = ctx();
    ramp(entry.voice.gain.gain, 0, seconds);
    const stopAt = c.currentTime + seconds + 0.05;
    entry.voice.stop(stopAt);
    outgoing.add(entry);
    (host().setTimeout || setTimeout)(() => { outgoing.delete(entry); env?.maybeSuspend?.(); }, Math.ceil(seconds * 1000) + 120);
}

// ───────── 곡 ─────────
function resolveUrl(track) {
    if (track.file) return track.url;
    try { return new URL(`./${track.url}`, import.meta.url).href; } catch { return track.url; }
}
function loadTrack(url) {
    if (!buffers.has(url)) {
        buffers.set(url, (async () => {
            const res = await host().fetch(url, { cache: 'force-cache' });
            if (!res.ok) throw new Error(`${res.status}`);
            const buffer = await ctx().decodeAudioData(await res.arrayBuffer());
            return { buffer, bounds: loopBounds(buffer.getChannelData(0), buffer.sampleRate) };
        })().catch(error => { buffers.delete(url); throw error; }));
        while (buffers.size > BUFFER_KEEP) {
            const oldest = [...buffers.keys()].find(key => key !== url && key !== active?.url);
            if (!oldest) break;
            buffers.delete(oldest);
        }
    }
    return buffers.get(url);
}

async function switchTo(mood) {
    if (!enabled || resting || !MOODS.includes(mood)) return;
    const c = ensureBus();
    if (!c) return;
    let track = pickTrack(mood, cfg.files, turns[mood] || 0);
    if (active && active.mood === mood && active.track.file === track.file && (track.file ? active.track.url === track.url : true)) { env?.resume?.(); return; }
    turns[mood] = (turns[mood] || 0) + 1;
    const token = ++loading;
    let loaded = null;
    for (const candidate of track.file ? [track, pickTrack(mood, {}, turns[mood] - 1)] : [track]) {
        try { loaded = await loadTrack(resolveUrl(candidate)); track = candidate; break; }
        catch (error) { console.info('[Blue Lemonade] 분위기 음악 곡을 못 읽었어요', candidate.url, error?.message || error); if (candidate.file) missingFile(candidate.url, '내 곡을 찾지 못해 담긴 곡으로 들려요'); }
    }
    if (token !== loading || !enabled || resting) return;
    if (!loaded) return;
    const voice = buildVoice(c, loaded.buffer, loaded.bounds);
    const swap = !!active;
    if (active) retire(active, FADE.swap);
    active = { mood, track, url: resolveUrl(track), voice, since: host().now?.() ?? Date.now(), seconds: loaded.bounds.end - loaded.bounds.start };
    env?.resume?.();
    voice.start(c.currentTime);
    ramp(voice.gain.gain, 1, swap ? FADE.swap : FADE.in);
    paintMarks();
}
function stopAll(seconds) {
    loading++;
    if (active) { retire(active, seconds); active = null; }
    paintMarks();
}

// ───────── 판정 ─────────
function recentReplies(chat) {
    const out = [];
    for (let i = (chat?.length || 0) - 1; i >= 0 && out.length < 2; i--) {
        const m = chat[i];
        if (!m || m.is_user || m.is_system) continue;
        if (typeof m.mes === 'string' && m.mes.trim()) out.push(m.mes);
    }
    return out;
}
function evaluate({ force = false, fresh = false } = {}) {
    if (!enabled || resting) return;
    const context = host().context?.();
    const key = String(context?.getCurrentChatId?.() ?? context?.chatId ?? '');
    const reset = chatKey !== null && key !== chatKey;
    const first = chatKey === null;
    chatKey = key;
    lastDetect = detectMood(recentReplies(context?.chat));
    const next = nextMood(state, lastDetect, { now: host().now?.() ?? Date.now(), fixed: cfg.mood, reset: reset || first || fresh });
    state = { mood: next.mood, since: next.since, pending: next.pending };
    if (next.changed || !active || force) return switchTo(state.mood);
    paintMarks();
}
function later() {
    const h = host();
    if (evalTimer) h.clearTimeout(evalTimer);
    evalTimer = h.setTimeout(() => { evalTimer = 0; evaluate(); }, EVALUATE_DELAY_MS);
}
function bindEvents() {
    if (bound) return;
    try {
        const { eventSource, event_types } = host().context?.() || {};
        if (!eventSource?.on || !event_types) return;
        bound = true;
        for (const name of EVENTS) if (event_types[name]) eventSource.on(event_types[name], later);
    } catch { /* 이벤트가 없으면 설정이 바뀔 때만 다시 본다 */ }
}

// ───────── 덕킹 ─────────
function mediaNow() {
    const doc = host().doc?.();
    try { return [...(doc?.querySelectorAll?.('audio, video') || [])]; } catch { return []; }
}
function recheckSpeaking() {
    speaking = anySpeaking(mediaNow());
    const h = host();
    if (speaking) {
        if (releaseTimer) { h.clearTimeout(releaseTimer); releaseTimer = 0; }
        if (!ducked && duck) { ducked = true; ramp(duck.gain, DUCK.level, DUCK.attack); paintMarks(); }
        return;
    }
    if (!ducked || releaseTimer) return;
    releaseTimer = h.setTimeout(() => {
        releaseTimer = 0;
        if (speaking || !duck) return;
        ducked = false; ramp(duck.gain, 1, DUCK.release); paintMarks();
    }, DUCK.hold * 1000);
}
function bindMedia() {
    const doc = host().doc?.();
    if (mediaBound || !doc?.addEventListener) return;
    mediaBound = true;
    // 미디어 이벤트는 거품이 안 올라온다 — 잡기(capture)로 문서 안 모든 audio · video 를 본다 (TTS 대사 · 실리태번 TTS)
    for (const type of MEDIA_EVENTS) doc.addEventListener(type, recheckSpeaking, true);
    doc.addEventListener('lemon-voice:state', recheckSpeaking);
}

// ───────── 화면 표시 ─────────
/** 지금 분위기 (다리 · 설정 화면) */
export function musicNow() {
    if (!enabled || !active) return null;
    return { mood: active.mood, label: MOOD_LABELS[active.mood], since: active.since, track: active.track.id, file: !!active.track.file, ducked, fixed: cfg.mood !== 'auto' };
}
function paintMarks() {
    const now = musicNow();
    const text = now ? `${now.label}${now.fixed ? ' · 고정' : ''}` : enabled ? '…' : '';
    const doc = host().doc?.();
    try { for (const el of doc?.querySelectorAll?.('[data-bl-music-now]') || []) { if (el.textContent !== text) el.textContent = text; el.dataset.mood = now?.mood || ''; } } catch { /* 화면 없음 */ }
    for (const fn of marks) { try { fn(now); } catch { /* 무시 */ } }
}
export function onMusicChange(fn) { if (typeof fn === 'function') marks.add(fn); return () => marks.delete(fn); }

// ───────── scene-sound.js 와 잇기 ─────────
export function attachMusic(e) { env = e; }
/** scene-sound.js 가 설정이 바뀔 때마다: raw = sceneSound.music, on = 장면 소리 켬 + 음악 켬, rest = 숨은 탭에서 쉬는 중 */
export function syncMusic(raw, { on = false, rest = false } = {}) {
    const next = tidyMusic(raw);
    const fixedChanged = next.mood !== cfg.mood;
    const filesChanged = JSON.stringify(next.files) !== JSON.stringify(cfg.files);
    cfg = next;
    enabled = !!on && next.on;
    if (!enabled) { stopAll(FADE.out); return; }
    bindEvents(); bindMedia();
    if (rest) { restMusic(true); return; }
    if (resting) { restMusic(false); return; }
    // 고정을 풀면(자동) 유지 시간 없이 지금 답으로 다시 고른다
    if (!active || fixedChanged || filesChanged) return evaluate({ force: filesChanged, fresh: fixedChanged && next.mood === 'auto' });
}
/** 숨은 탭: 「화면 밖에서도」를 끈 경우만 scene-sound.js 가 부른다 */
export function restMusic(hide) {
    if (hide) { if (resting) return; resting = true; stopAll(FADE.hide); return; }
    if (!resting) return;
    resting = false;
    if (enabled && state.mood) return switchTo(state.mood);
    return evaluate();
}
export function musicBusy() { return !!active || outgoing.size > 0; }

/** 시험 · 측정용 */
export function musicState() {
    return {
        enabled, resting, mood: state.mood, since: state.since, pending: state.pending, detect: lastDetect,
        track: active?.track.id ?? null, url: active?.url ?? '', loop: active ? Math.round(active.seconds * 1000) / 1000 : 0,
        gain: active?.voice.gain.gain.value ?? null, duck: duck?.gain.value ?? null, bus: bus?.gain.value ?? null,
        speaking, ducked, outgoing: [...outgoing].map(e => ({ mood: e.mood, gain: e.voice.gain.gain.value })), cfg: { ...cfg, files: { ...cfg.files } },
    };
}
export const _forTest = {
    evaluate, recheckSpeaking,
    nodes: () => ({ bus, duck }),
    reset() {
        const h = host();
        if (releaseTimer) h.clearTimeout?.(releaseTimer);
        if (evalTimer) h.clearTimeout?.(evalTimer);
        releaseTimer = evalTimer = 0;
        for (const e of outgoing) { try { e.voice.stop(0); } catch { /* */ } }
        if (active) { try { active.voice.stop(0); } catch { /* */ } }
        active = null; outgoing = new Set(); buffers.clear(); bus = duck = null;
        cfg = tidyMusic(null); enabled = resting = speaking = ducked = false; bound = mediaBound = false;
        state = { mood: null, since: 0, pending: null }; lastDetect = null; chatKey = null; loading = 0;
        for (const k of Object.keys(turns)) delete turns[k];
        marks.clear();
    },
};
