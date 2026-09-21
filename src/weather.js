// 날씨 효과 (3.3.0) — 채팅 글 뒤에 비 · 눈이 내린다. 채팅 › 화면 › 날씨 (chat.weather: off | rain | snow | custom | tracker, chat.weatherLevel 1~3).
// 3.3.1: 투명도 · 크기 · 속도 · 각도 (chat.weatherOpacity · Size · Speed · Angle) · 내 그림(chat.weatherImage — 투명 PNG data URL, 목록은 weatherImages).
//
// 그리기는 워커 안의 OffscreenCanvas 에서 (weather-worker.js) — 메인 스레드는 크기 · 설정만 알려 준다. 워커를 못 쓰는 브라우저는 같은 엔진을 메인에서 돌린다.
// 캔버스는 #sheld 맨 앞 자식(z-index -1)이라 채팅 글 뒤 · 채팅 바탕 앞에 그려진다 — 켜 두는 동안 채팅 칸 바탕을 투명하게 하고 같은 바탕색을 #sheld 에 옮긴다
// (css/32-weather.css). 화면이 꺼지면 멈추고, 동작 줄이기면 멈춘 한 장만.
// 트래커 따라: 마지막 AI 답의 데우스 트래커 날씨 칸 글자를 보고 비 · 눈 · 없음을 고른다 (번역된 한국어 · 영어 둘 다).
// 켜 두었을 때만 불러온다 (features.js). 설정 창 채팅 표본에도 같은 효과를 작게 (previewWeather).
import { parseColor } from './palettes.js';
import { getSettings, saveSettings } from './settings.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const WEATHER_VALUE = '.custom-dem-track__item--weather .custom-dem-track__value, .custom-dem-track-recovery__item--context .custom-dem-track-recovery__value';

// 날씨 글자 → 비 · 눈. 한국어는 낱말 앞(띄어쓰기 · 쉼표 뒤)에서만 — "준비", "비밀", "눈부신" 같은 말에 걸리지 않게
const SNOW = /(?:^|[\s,·/(~→-])(?:눈(?!부)|함박눈|진눈깨비|싸락눈|눈보라|폭설|첫눈|눈발)|snow|sleet|blizzard|flurr/i;
const RAIN = /(?:^|[\s,·/(~→-])(?:비(?![밀행슷교록용])|이슬비|가랑비|보슬비|안개비|장대비|여우비|소나기|폭우|호우|장마|빗|폭풍우|뇌우)|rain|drizzl|shower|storm|thunder|downpour|monsoon|sun\s*shower/i;

const FOG = /안개|연무|박무|물안개|fog|mist|haze/i; // '안개비'는 위의 비에서 먼저 걸린다

// 햇살: 맑음 · 햇빛 · 노을. 실내 · 밤이면 끈다 ("warm interior", "clear night"). 해 질 녘은 따뜻한 색으로
const SUN = /맑[음은고]|쾌청|화창|햇[살빛볕]|볕|양지|clear|sunn?y|sunlight|sunshine|sunlit|bright|fair/i;
const DUSK = /노을|석양|일몰|황혼|해\s*질|땅거미|일출|새벽|여명|sunset|sunrise|dusk|dawn|twilight|golden/i;
const NIGHT = /(?:^|[\s,·/(~→-])밤|야간|한밤|자정|심야|night|midnight|moon|starry/i;
const INDOOR = /실내|내부|지하|indoor|interior|inside|underground/i;
const HAZE = /스모그|황사|미세\s*먼지|smog|dust/i;
const GLOOM = /흐[림린]|구름\s*많|overcast|gloomy/i;

/** 트래커 날씨 글 → 겹칠 효과들 (앞이 주 효과). 예: "안개비" → 비 + 안개, "여우비" → 비 + 햇살, "눈안개" → 눈 + 안개 */
export function detectWeatherAll(text) {
    const value = String(text || '');
    const found = [];
    if (SNOW.test(value)) found.push('snow');
    if (RAIN.test(value)) found.push(INDOOR.test(value) ? 'glass' : 'rain'); // 실내에서 보는 비 → 유리의 빗방울
    if (/무지개|rainbow/i.test(value)) found.push('rainbow');
    if (FOG.test(value) || HAZE.test(value)) found.push('fog');
    const outdoors = !INDOOR.test(value) || /햇[살빛볕]|sunlight|sunshine|sunlit/i.test(value); // "창으로 드는 햇살"은 실내라도 켠다
    const dusk = DUSK.test(value);
    if (outdoors && !NIGHT.test(value) && !GLOOM.test(value) && (dusk || SUN.test(value) || /여우비|sun\s*shower/i.test(value))) found.push('sun');
    if (outdoors && NIGHT.test(value) && !GLOOM.test(value)) found.push('star'); // 맑은 밤 · 밤 → 별
    if (/바람|산들|breez|wind|gust/i.test(value)) found.push('breeze');
    return { modes: found.slice(0, 2), warm: dusk };
}
export function detectWeather(text) {
    return detectWeatherAll(text).modes[0] || 'off';
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
    engine.onWake = () => apply();
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
    return { tint:['custom','gradient'].includes(chat.weatherColorMode)?chat.weatherColor:null, tint2:chat.weatherColorMode==='gradient'?chat.weatherColor2:null,
        scene:{shadowStyle:chat.weatherShadowStyle,shadowBlur:chat.weatherShadowBlur??35,waterStyle:chat.weatherWaterStyle,waterArea:chat.weatherWaterArea},
        spots:chat.weatherSpots||null,
        sun:{style:chat.weatherSunStyle}, star:{style:chat.weatherStarStyle},
        fog:{style:chat.weatherFogStyle,area:chat.weatherFogArea,stretch:chat.weatherFogStretch,edge:chat.weatherFogEdge,swell:chat.weatherFogSwell,depth:chat.weatherFogDepth}, curvature:Number(chat.weatherCurvature??65),orbitSize:Number(chat.weatherOrbitSize??100),orbitDirection:chat.weatherOrbitDirection||'right', opacity: Number(chat.weatherOpacity) || 100, size: Number(chat.weatherSize) || 100, speed: Number(chat.weatherSpeed) || 100, motion: chat.weatherMotion || 'natural', sway: Number(chat.weatherSway ?? 100), spin: Number(chat.weatherSpin ?? 100), angle: Number.isFinite(Number(chat.weatherAngle)) ? Number(chat.weatherAngle) : -9 };
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
function createLayer(host, className, virtual = false) {
    let canvas = document.createElement('canvas');
    canvas.className = className;
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    let renderer = null;
    let pending = null;
    let current = { mode: 'off', level: 2 };
    let spriteKey = '';
    let spriteGen = 0, destroyed = false, paused = document.hidden;
    let inView = true;
    const cleanup = new Set();
    // Hidden/folded previews must not keep a second animation running.
    // Observe the host, not the canvas that can be replaced during fallback.
    const syncPaused = () => {
        const next=document.hidden || !inView;
        if(next===paused)return;
        paused=next;
        renderer?.post({type:paused?'pause':'resume'});
    };
    document.addEventListener('visibilitychange',syncPaused);
    cleanup.add(()=>document.removeEventListener('visibilitychange',syncPaused));
    if(typeof IntersectionObserver==='function') {
        const visible=new IntersectionObserver(entries=>{
            if(!host.isConnected){api.destroy();return;}
            inView=entries[entries.length-1]?.isIntersecting??true;
            syncPaused();
        });
        visible.observe(host);
        cleanup.add(()=>visible.disconnect());
    }
    // 설정 창 표본(virtual): 표본 칸은 낮아서 그 크기로 그리면 무지개 · 햇살 · 그림자가 실제 채팅보다 훨씬 작게 나왔다.
    // 캔버스를 '표본 너비 × 실제 채팅 화면 비율'의 키로 잡고 표본 칸에는 그 위쪽(아래에 깔리는 효과는 아래쪽)만 보이게 한다 — 크기가 실제와 같다
    let anchorBottom = false;
    const size = () => {
        // 표본은 돋보기 배율(transform: scale)이 걸려 있을 수 있다. getBoundingClientRect 는 배율이 곱해진 값이라 그것으로 캔버스 키를 잡으면
        // 배율만큼 세로로 눌려 보였다(레몬이 납작해짐) → 배율과 무관한 배치 크기(clientWidth/Height)로 잰다
        const rect = virtual ? { width: host.clientWidth, height: host.clientHeight } : host.getBoundingClientRect();
        if (!virtual) return { w: Math.round(rect.width), h: Math.round(rect.height) };
        const sheld = document.getElementById('sheld');
        const ratio = sheld?.clientWidth > 0 && sheld.clientHeight > 0 ? sheld.clientHeight / sheld.clientWidth : 1.9;
        const h = Math.max(Math.round(rect.height), Math.round(rect.width * Math.min(2.4, Math.max(.5, ratio))));
        canvas.style.height = `${h}px`; canvas.style.top = anchorBottom ? 'auto' : '0'; canvas.style.bottom = anchorBottom ? '0' : 'auto';
        return { w: Math.round(rect.width), h };
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
    const api = {
        get canvas(){return canvas;},
        ready,
        set(mode, level, params = {}, spriteData = '') {
            if(destroyed)return;
            const low = (mode === 'water' && (params.scene?.waterArea ?? 'bottom') === 'bottom') || (mode === 'fog' && params.fog?.area === 'bottom');
            if (virtual && low !== anchorBottom) { anchorBottom = low; renderer?.post({ type: 'resize', ...size(), dpr: ratio() }); }
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
    return api;
}

// ───────── 채팅 뒤 ─────────
let layer = null;
let wanted = { on: false, mode: 'off', level: 2 };
let listening = false;
let trackerTimer = 0;

function trackerWeather() {
    const values = document.querySelectorAll(`#chat .mes:not([is_user="true"]) :is(${WEATHER_VALUE})`);
    const last = values[values.length - 1];
    return last ? detectWeatherAll(last.textContent) : { modes: [], warm: false };
}
const trackerMode = () => trackerWeather().modes[0] || 'off';
// 그 날씨를 골랐을 때 맞춰 둔 값(날씨마다 따로 기억)을 쓴다 — 트래커 · 둘째 효과가 안개를 부르면 안개 탭에서 다듬은 모양 그대로 나온다
// 한 번도 고른 적 없는 날씨는 기본값으로 (지금 칸의 값을 물려받지 않는다)
const profileOf = (chat, mode) => (mode === chat.weather ? chat : chat.weatherProfiles?.[mode] ? { ...chat, weatherColorMode: 'auto', ...chat.weatherProfiles[mode] } : { weatherSpots: chat.weatherSpots });
function plan(chat, level) {
    if (chat.weather === 'tracker') {
        const found = trackerWeather(), warm = found.warm, skip = Array.isArray(chat.weatherTrackerSkip) ? chat.weatherTrackerSkip : [];
        const modes = found.modes.filter(mode => !skip.includes(mode)); // 제외해 둔 날씨는 트래커에 나와도 그리지 않는다
        if (!modes.length) return { mode: 'off', level, params: {} };
        // 트래커 따라에는 제 조절 값이 없다: 세기까지 그 날씨를 골랐을 때 맞춰 둔 값을 쓴다 (예전에는 비 · 눈을 다르게 맞춰 놔도 트래커 쪽 값 하나로 똑같이 나왔다)
        const levelOf = mode => { const n = Number(profileOf(chat, mode).weatherLevel); return [1, 2, 3].includes(n) && chat.weatherProfiles?.[mode] ? n : 2; };
        return { mode: modes[0], level: levelOf(modes[0]), params: { ...paramsFrom(profileOf(chat, modes[0])), warm, second: modes[1] ? { mode: modes[1], level: levelOf(modes[1]), warm, ...paramsFrom(profileOf(chat, modes[1])) } : null } };
    }
    const second = chat.weather2 && chat.weather2 !== 'off' && chat.weather2 !== chat.weather ? { mode: chat.weather2, level: [1, 2, 3].includes(Number(chat.weather2Level)) ? Number(chat.weather2Level) : 2, warm: false, ...paramsFrom(profileOf(chat, chat.weather2)) } : null;
    return { mode: chat.weather, level, params: { ...paramsFrom(chat), warm: false, second } };
}

function refresh() {
    if (!layer) return;
    const next = plan(wanted.chat, wanted.level);
    layer.set(next.mode, next.level, next.params, wanted.sprite);
}

function scheduleTracker() {
    if (wanted.mode !== 'tracker') return;
    clearTimeout(trackerTimer);
    trackerTimer = setTimeout(refresh, 400);
}

function listen() {
    if (listening) return;
    listening = true;
    const { eventSource, event_types } = SillyTavern.getContext();
    for (const name of ['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'CHAT_CHANGED', 'MESSAGE_EDITED']) {
        if (event_types[name]) eventSource.on(event_types[name], scheduleTracker);
    }
}

/** features.js 가 설정이 바뀔 때마다 부른다 */
export function syncWeather(on, chat = {}) {
    const mode = ['rain', 'snow', 'fog', 'sun', 'star', 'firefly', 'rainbow', 'shadow', 'breeze', 'glass', 'water', 'lemon', 'petal', 'meteor', 'custom', 'tracker'].includes(chat.weather) ? chat.weather : 'off';
    const level = [1, 2, 3].includes(Number(chat.weatherLevel)) ? Number(chat.weatherLevel) : 2;
    wanted = { on: !!on && mode !== 'off', mode, level, chat: { ...chat, weather: mode }, params: paramsFrom(chat), sprite: chat.weatherImage || '' };
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
// 표본의 내 메시지(말풍선 · 카드 · 테이블 띠)와 카드 바탕은 불투명이라 그 뒤의 날씨를 가린다. 바탕 변수를 표본 칸에서만 72% 로 낮춰 덮어쓴다.
// (변수가 제 값을 가리키면 순환이라, 뿌리의 계산값을 읽어 적는다. 팔레트가 바뀌면 설정 창이 다시 불러 주니 그때 새 값으로 바뀐다)
// 날씨를 켜 두면 표본의 첫 메시지를 두 문단 더 길게 — 효과가 위쪽에만 걸려 감이 안 잡혔다
function moreLines(stage, on) {
    const have = stage.querySelectorAll('.bl-weather-more');
    if (!on) { for (const p of have) p.remove(); return; }
    const text = stage.querySelector('.mes:not([is_user="true"]) .mes_text');
    if (have.length || !text) return;
    text.insertAdjacentHTML('beforeend', '<p class="bl-weather-more">창밖으로 오후의 빛이 길게 기울었다. 그는 말없이 잔을 한 번 돌리고, 식어 버린 차 위로 떠오른 레몬 조각을 가만히 바라보았다.</p><p class="bl-weather-more"><q>「오늘은 하늘이 좋네.」</q> 낮은 목소리가 조용한 방 안에 천천히 번졌다.</p>');
}
const SEE_THROUGH = ['--salty-user-bg', '--salty-raised', '--salty-card', '--salty-shade'];
function seeThrough(stage, on) {
    const root = getComputedStyle(document.documentElement);
    for (const name of SEE_THROUGH) {
        const value = root.getPropertyValue(name).trim();
        const faint = /rgba\([^)]*,\s*(0?\.\d+|0)\s*\)/.test(value); // 이미 비치는 색(날씨 중 내 메시지 농도)은 한 번 더 낮추지 않는다
        if (on && value && !faint) stage.style.setProperty(name, `color-mix(in srgb, ${value} 72%, transparent)`);
        else stage.style.removeProperty(name);
    }
}
/** 채팅 표본(.salty-preview[data-prev="chat"])에 작은 효과. 트래커 따라면 지금 채팅의 날씨, 없으면 비를 보여 준다 */
export function previewWeather(stage, chat = {}) {
    const mode = ['rain', 'snow', 'fog', 'sun', 'star', 'firefly', 'rainbow', 'shadow', 'breeze', 'glass', 'water', 'lemon', 'petal', 'meteor', 'custom', 'tracker'].includes(chat.weather) ? chat.weather : 'off';
    const level = [1, 2, 3].includes(Number(chat.weatherLevel)) ? Number(chat.weatherLevel) : 2;
    let preview = stage._blWeather;
    if (mode === 'off' || !stage.isConnected) {
        preview?.destroy();
        stage._blWeather = null;
        stage.classList.remove('bl-weather-pv-on');
        seeThrough(stage, false);
        moreLines(stage, false);
        return;
    }
    if (!preview) {
        preview = stage._blWeather = createLayer(stage, 'bl-weather-pv', true);
        // 창을 닫아 표본이 문서에서 떨어지면 워커를 끝낸다
        // A host removed while already outside the viewport need not produce
        // another intersection event. Retain the fallback for external removal.
        const watch=setInterval(()=>{if(!stage.isConnected)preview.destroy();},2000);
        preview.onDestroy(()=>clearInterval(watch));
        preview.onDestroy(()=>{if(stage._blWeather===preview)stage._blWeather=null;});
    }
    stage.classList.add('bl-weather-pv-on');
    seeThrough(stage, true);
    moreLines(stage, true);
    const next = plan({ ...chat, weather: mode }, level);
    preview.set(next.mode === 'off' ? 'rain' : next.mode, next.mode === 'off' ? level : next.level, next.mode === 'off' ? paramsFrom(chat) : next.params, chat.weatherImage || '');
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
        await engine.ready();
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
    engine.resize(width,height,scale);engine.config({...current,colors:colorsNow(),sprite:bitmap});await engine.ready();
    return {canvas,draw(dt,now){engine.step(dt,now);engine.draw();},close(){engine.dispose();canvas.width=canvas.height=1;}};
}

// ───────── 채팅 화면에서 자리 정하기 ─────────
/**
 * 실제 채팅 화면(#sheld) 위에 점을 띄워 끌어 옮기게 한다. 끄는 동안 바로 그 자리에 그려지고, '완료'를 누르면 저장한다.
 * 자리는 화면 비율(0~1)이라 스크롤해도 · 화면 크기가 달라져도 같은 자리에 있다 (날씨 캔버스가 채팅 칸이 아니라 #sheld 에 붙어 있다).
 */
export function placeWeatherSpots(mode, defaults, onDone) {
    const host = document.getElementById('sheld');
    if (!host || document.getElementById('bl-weather-place')) return;
    const s = getSettings(), before = JSON.stringify(s.chat.weatherSpots || {});
    const list = defaults.map(([x, y], i) => ({ ...(s.chat.weatherSpots?.[mode]?.[i] || { x, y }) }));
    const box = document.createElement('div');
    box.id = 'bl-weather-place';
    box.innerHTML = `<div class="bl-weather-place-bar"><span>점을 끌어 자리를 정해요</span><button type="button" data-place="auto">자동 배치</button><button type="button" data-place="cancel">취소</button><button type="button" data-place="done">완료</button></div>${list.map((_, i) => `<button type="button" class="bl-weather-place-dot" data-index="${i}">${list.length > 1 ? i + 1 : ''}</button>`).join('')}`;
    host.append(box);
    const dots = [...box.querySelectorAll('.bl-weather-place-dot')];
    const paint = () => dots.forEach((dot, i) => { dot.style.left = `${list[i].x * 100}%`; dot.style.top = `${list[i].y * 100}%`; });
    let queued = 0;
    const apply = (spots) => { // 설정 · 지금 도는 효과에 바로 반영
        s.chat.weatherSpots = spots;
        if (wanted.chat) wanted.chat.weatherSpots = spots;
        cancelAnimationFrame(queued); queued = requestAnimationFrame(refresh);
    };
    const live = () => apply({ ...(s.chat.weatherSpots || {}), [mode]: list.map(p => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 })) });
    const close = (reopen) => { box.remove(); if (reopen) onDone?.(); };
    paint();
    box.addEventListener('pointerdown', (event) => {
        const dot = event.target.closest('.bl-weather-place-dot');
        if (!dot) return;
        event.preventDefault();
        try { dot.setPointerCapture(event.pointerId); } catch { /* 없어도 끌린다 */ }
        const index = Number(dot.dataset.index);
        const move = (e) => { const rect = box.getBoundingClientRect(); list[index] = { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) }; paint(); live(); };
        const end = () => { dot.removeEventListener('pointermove', move); dot.removeEventListener('pointerup', end); dot.removeEventListener('pointercancel', end); };
        dot.addEventListener('pointermove', move); dot.addEventListener('pointerup', end); dot.addEventListener('pointercancel', end);
    });
    box.addEventListener('click', (event) => {
        const act = event.target.closest('[data-place]')?.dataset.place;
        if (act === 'done') { live(); saveSettings(); close(true); }
        else if (act === 'cancel') { apply(JSON.parse(before)); close(true); }
        else if (act === 'auto') { const spots = { ...(s.chat.weatherSpots || {}) }; delete spots[mode]; apply(spots); saveSettings(); close(true); }
    });
}
