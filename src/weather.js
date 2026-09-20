// 날씨 효과 (3.3.0) — 채팅 글 뒤에 비 · 눈이 내린다. 채팅 › 화면 › 날씨 (chat.weather: off | rain | snow | custom | tracker, chat.weatherLevel 1~3).
// 3.3.1: 투명도 · 크기 · 속도 · 각도 (chat.weatherOpacity · Size · Speed · Angle) · 내 그림(chat.weatherImage — 투명 PNG data URL, 목록은 weatherImages).
//
// 그리기는 워커 안의 OffscreenCanvas 에서 (weather-worker.js) — 메인 스레드는 크기 · 설정만 알려 준다. 워커를 못 쓰는 브라우저는 같은 엔진을 메인에서 돌린다.
// 캔버스는 #sheld 맨 앞 자식(z-index -1)이라 채팅 글 뒤 · 채팅 바탕 앞에 그려진다 — 켜 두는 동안 채팅 칸 바탕을 투명하게 하고 같은 바탕색을 #sheld 에 옮긴다
// (css/32-weather.css). 화면이 꺼지면 멈추고, 동작 줄이기면 멈춘 한 장만.
// 트래커 따라: 마지막 AI 답의 데우스 트래커 날씨 칸 글자를 보고 비 · 눈 · 없음을 고른다 (번역된 한국어 · 영어 둘 다).
// 켜 두었을 때만 불러온다 (features.js). 설정 창 채팅 표본에도 같은 효과를 작게 (previewWeather).
import { parseColor } from './palettes.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const WEATHER_VALUE = '.custom-dem-track__item--weather .custom-dem-track__value, .custom-dem-track-recovery__item--context .custom-dem-track-recovery__value';

// 날씨 글자 → 비 · 눈. 한국어는 낱말 앞(띄어쓰기 · 쉼표 뒤)에서만 — "준비", "비밀", "눈부신" 같은 말에 걸리지 않게
const SNOW = /(?:^|[\s,·/(~→-])(?:눈(?!부)|함박눈|진눈깨비|싸락눈|눈보라|폭설|첫눈|눈발)|snow|sleet|blizzard|flurr/i;
const RAIN = /(?:^|[\s,·/(~→-])(?:비(?![밀행슷교록용])|이슬비|가랑비|보슬비|안개비|장대비|소나기|폭우|호우|장마|빗|폭풍우|뇌우)|rain|drizzl|shower|storm|thunder|downpour|monsoon/i;

export function detectWeather(text) {
    const value = String(text || '');
    if (SNOW.test(value)) return 'snow';
    if (RAIN.test(value)) return 'rain';
    return 'off';
}

function rgbText(value, fallback) {
    try {
        const [r, g, b] = parseColor(String(value || '').trim());
        if ([r, g, b].every(Number.isFinite)) return `${Math.round(r)},${Math.round(g)},${Math.round(b)}`;
    } catch { /* 아래로 */ }
    return fallback;
}

/** 팔레트에 맞춘 입자 색: 나이트는 밝은 빗줄기 · 흰 눈, 화이트는 글자색 빗줄기 · 포인트색 눈 (흰 바탕에 흰 눈은 안 보임) */
function colorsNow() {
    const dark = document.body.classList.contains('salty-dark');
    const root = getComputedStyle(document.documentElement);
    if (dark) return { rain: '200,215,240', rainAlpha: 0.34, snow: '255,255,255', snowAlpha: 0.82 };
    return { rain: rgbText(root.getPropertyValue('--salty-text'), '40,50,60'), rainAlpha: 0.22, snow: rgbText(root.getPropertyValue('--salty-accent'), '90,130,170'), snowAlpha: 0.5 };
}

/** 캔버스 하나 + 그리는 쪽(워커 또는 메인) */
async function createRenderer(canvas, init, replaceCanvas) {
    if (typeof canvas.transferControlToOffscreen === 'function' && typeof Worker === 'function') {
        let worker, transferred=false;
        try {
            worker = new Worker(new URL('./weather-worker.js', import.meta.url), { type: 'module' });
            const offscreen = canvas.transferControlToOffscreen();
            transferred=true;
            await new Promise((resolve,reject)=>{
                const finish=error=>{clearTimeout(timeout);worker.onmessage=worker.onerror=null;error?reject(error):resolve();};
                const timeout=setTimeout(()=>finish(Error('날씨 워커 준비 시간 초과')),3000);
                worker.onmessage=event=>{if(event.data?.type==='ready')finish();};
                worker.onerror=event=>{event.preventDefault();finish(Error('날씨 워커를 불러오지 못했어요.'));};
                try{worker.postMessage({ type: 'init', canvas: offscreen, ...init }, [offscreen]);}catch(error){finish(error);}
            });
            return { post: (message, transfer = []) => worker.postMessage(message, transfer), stop: () => worker.terminate(), kind: 'worker' };
        } catch (error) {
            worker?.terminate();
            // A transferred canvas cannot provide a main-thread 2D context again.
            if(transferred){const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;replaceCanvas(replacement);}
            console.info('[Blue Lemonade] 날씨 효과를 워커로 못 돌려 메인에서 그려요', error);
        }
    }
    const { createEngine, createLoop } = await import('./weather-engine.js');
    const engine = createEngine(canvas.getContext('2d'));
    const loop = createLoop(engine, fn => requestAnimationFrame(fn), id => cancelAnimationFrame(id));
    let reduce = !!init.reduce, paused = false;
    const apply = () => {
        if (engine.idle() || reduce || paused) { loop.stop(); if(!paused)engine.draw(); } else loop.start();
    };
    engine.resize(init.w, init.h, init.dpr);
    engine.config(init);
    apply();
    return {
        post(message) {
            if (message.type === 'resize') { engine.resize(message.w, message.h, message.dpr); if (!loop.running()) engine.draw(); }
            else if (message.type === 'config') { engine.config(message); apply(); }
            else if (message.type === 'pause') {paused=true;loop.stop();}
            else if (message.type === 'resume') {paused=false;apply();}
        },
        stop: () => {loop.stop();engine.dispose();},
        kind: 'main',
    };
}

const ratio = () => Math.min(1.5, window.devicePixelRatio || 1);

/** 설정의 날씨 값 → 엔진 값 (범위는 settings.js 가 이미 잡음) */
function paramsFrom(chat = {}) {
    return { tint:chat.weatherColorMode==='custom'?chat.weatherColor:null, curvature:Number(chat.weatherCurvature??65),orbitSize:Number(chat.weatherOrbitSize??100),orbitDirection:chat.weatherOrbitDirection||'right', opacity: Number(chat.weatherOpacity) || 100, size: Number(chat.weatherSize) || 100, speed: Number(chat.weatherSpeed) || 100, motion: chat.weatherMotion || 'natural', sway: Number(chat.weatherSway ?? 100), spin: Number(chat.weatherSpin ?? 100), angle: Number.isFinite(Number(chat.weatherAngle)) ? Number(chat.weatherAngle) : -9 };
}

// 내 그림: data URL → ImageBitmap. 워커로 넘기면 원본이 비워지므로 보낼 때마다 새로 만든다 (Blob 만 들고 있음)
const spriteBlobs = new Map();
async function spriteBitmap(dataUrl) {
    if (!dataUrl) return null;
    let blob = spriteBlobs.get(dataUrl);
    if (!blob) {
        blob = await (await fetch(dataUrl)).blob();
        spriteBlobs.clear();
        spriteBlobs.set(dataUrl, blob);
    }
    return createImageBitmap(blob);
}

/** 한 자리(#sheld 또는 설정 표본)에 붙는 효과 */
function createLayer(host, className) {
    let canvas = document.createElement('canvas');
    canvas.className = className;
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    let renderer = null;
    let pending = null;
    let current = { mode: 'off', level: 2 };
    let spriteKey = '';
    let spriteGen = 0, destroyed = false, paused = document.hidden;
    const cleanup = new Set();
    const size = () => {
        const rect = host.getBoundingClientRect();
        return { w: Math.round(rect.width), h: Math.round(rect.height) };
    };
    const ready = createRenderer(canvas, { ...size(), dpr: ratio(), mode: 'off', level: 2, colors: colorsNow(), reduce: reduceMotion.matches }, replacement=>{canvas=replacement;}).then((r) => {
        renderer = r;
        if(destroyed){r.stop();return r;}
        if(paused)r.post({type:'pause'});
        if (pending) r.post(pending);
        pending = null;
        return r;
    });
    const observer = new ResizeObserver(() => renderer?.post({ type: 'resize', ...size(), dpr: ratio() }));
    observer.observe(host);
    return {
        get canvas(){return canvas;},
        ready,
        set(mode, level, params = {}, spriteData = '') {
            if(destroyed)return;
            current = { mode, level, ...params };
            const message = { type: 'config', mode, level, colors: colorsNow(), ...params };
            const wantKey = mode === 'custom' ? spriteData : '';
            if (wantKey !== spriteKey) {
                // 그림이 바뀌면 비트맵을 만든 뒤 한 번 더 보낸다 (그 사이 설정은 먼저 보냄)
                spriteKey = wantKey;
                const gen = ++spriteGen;
                const send = (bitmap) => {
                    if (destroyed || gen !== spriteGen) { bitmap?.close?.(); return; }
                    ready.then(r => {if(destroyed||gen!==spriteGen){bitmap?.close?.();return;}r.post({...current,type:'config',colors:colorsNow(),sprite:bitmap},bitmap?[bitmap]:[]);});
                };
                if (wantKey) spriteBitmap(wantKey).then(send, () => send(null));
                else send(null);
            }
            if (renderer) renderer.post(message);
            else pending = message;
        },
        current: () => current,
        pause: () => {paused=true;renderer?.post({ type: 'pause' });},
        resume: () => {paused=false;renderer?.post({ type: 'resume' });},
        onDestroy(fn) {cleanup.add(fn);},
        destroy() {
            if(destroyed)return;destroyed=true;spriteGen++;pending=null;
            for(const fn of cleanup)fn();cleanup.clear();
            observer.disconnect();
            ready.then(r => r.stop());
            canvas.remove();
        },
    };
}

// ───────── 채팅 뒤 ─────────
let layer = null;
let wanted = { on: false, mode: 'off', level: 2 };
let listening = false;
let trackerTimer = 0;

function trackerMode() {
    const values = document.querySelectorAll(`#chat .mes:not([is_user="true"]) :is(${WEATHER_VALUE})`);
    const last = values[values.length - 1];
    return last ? detectWeather(last.textContent) : 'off';
}

function refresh() {
    if (!layer) return;
    const mode = wanted.mode === 'tracker' ? trackerMode() : wanted.mode;
    layer.set(mode, wanted.level, wanted.params, wanted.sprite);
}

function scheduleTracker() {
    if (wanted.mode !== 'tracker') return;
    clearTimeout(trackerTimer);
    trackerTimer = setTimeout(refresh, 400);
}

function onVisibility() {
    if (!layer) return;
    if (document.visibilityState === 'hidden') layer.pause();
    else layer.resume();
}

function listen() {
    if (listening) return;
    listening = true;
    const { eventSource, event_types } = SillyTavern.getContext();
    for (const name of ['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'CHAT_CHANGED', 'MESSAGE_EDITED']) {
        if (event_types[name]) eventSource.on(event_types[name], scheduleTracker);
    }
    document.addEventListener('visibilitychange', onVisibility);
}

/** features.js 가 설정이 바뀔 때마다 부른다 */
export function syncWeather(on, chat = {}) {
    const mode = ['rain', 'snow', 'lemon', 'petal', 'meteor', 'custom', 'tracker'].includes(chat.weather) ? chat.weather : 'off';
    const level = [1, 2, 3].includes(Number(chat.weatherLevel)) ? Number(chat.weatherLevel) : 2;
    wanted = { on: !!on && mode !== 'off', mode, level, params: paramsFrom(chat), sprite: chat.weatherImage || '' };
    if (!wanted.on) {
        layer?.destroy();
        layer = null;
        document.body.classList.remove('bl-weather-on');
        return;
    }
    const host = document.getElementById('sheld');
    if (!host) return;
    if (!layer || !layer.canvas.isConnected) {
        layer?.destroy();
        layer = createLayer(host, 'bl-weather');
    }
    document.body.classList.add('bl-weather-on');
    listen();
    refresh();
}

// ───────── 설정 창 채팅 표본 ─────────
/** 채팅 표본(.salty-preview[data-prev="chat"])에 작은 효과. 트래커 따라면 지금 채팅의 날씨, 없으면 비를 보여 준다 */
export function previewWeather(stage, chat = {}) {
    const mode = ['rain', 'snow', 'lemon', 'petal', 'meteor', 'custom', 'tracker'].includes(chat.weather) ? chat.weather : 'off';
    const level = [1, 2, 3].includes(Number(chat.weatherLevel)) ? Number(chat.weatherLevel) : 2;
    let preview = stage._blWeather;
    if (mode === 'off') {
        preview?.destroy();
        stage._blWeather = null;
        stage.classList.remove('bl-weather-pv-on');
        return;
    }
    if (!preview) {
        preview = stage._blWeather = createLayer(stage, 'bl-weather-pv');
        // 창을 닫아 표본이 문서에서 떨어지면 워커를 끝낸다
        const watch = setInterval(() => {
            if (stage.isConnected) return;
            clearInterval(watch);
            preview.destroy();
            if (stage._blWeather === preview) stage._blWeather = null;
        }, 2000);
        preview.onDestroy(()=>clearInterval(watch));
    }
    stage.classList.add('bl-weather-pv-on');
    const shown = mode === 'tracker' ? (trackerMode() === 'off' ? 'rain' : trackerMode()) : mode;
    preview.set(shown, level, paramsFrom(chat), chat.weatherImage || '');
}

/** 시험용 */
export function weatherState() {
    return { wanted, layer: !!layer, current: layer?.current() ?? null, tracker: trackerMode() };
}

/** A still of the current effect, rendered at export resolution for long captures. */
export async function captureWeather(width, height, scale) {
    if (!wanted.on || !layer) return '';
    const current = { ...layer.current() }, spriteData = wanted.sprite;
    if (current.mode === 'off') return '';
    const { createEngine } = await import('./weather-engine.js');
    const canvas = document.createElement('canvas');
    const engine = createEngine(canvas.getContext('2d'));
    const bitmap = current.mode === 'custom' ? await spriteBitmap(spriteData) : null;
    try {
        engine.resize(width, height, scale);
        engine.config({ ...current, colors: colorsNow(), sprite: bitmap });
        engine.draw();
        return canvas.toDataURL('image/png');
    } finally { engine.dispose(); canvas.width = canvas.height = 1; }
}
/** Independent animation used only during capture; the live weather is untouched. */
export async function captureWeatherAnimation(width,height,scale=1) {
    if(!wanted.on||!layer)return null;
    const current={...layer.current()},spriteData=wanted.sprite;if(current.mode==='off')return null;
    const {createEngine}=await import('./weather-engine.js');
    const canvas=document.createElement('canvas'),engine=createEngine(canvas.getContext('2d'));
    const bitmap=current.mode==='custom'?await spriteBitmap(spriteData):null;
    engine.resize(width,height,scale);engine.config({...current,colors:colorsNow(),sprite:bitmap});
    return {canvas,draw(dt,now){engine.step(dt,now);engine.draw();},close(){engine.dispose();canvas.width=canvas.height=1;}};
}
