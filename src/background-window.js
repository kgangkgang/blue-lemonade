// 백그라운드 창 (4.3.2, 실험): 답을 기다리는 동안 다른 앱을 봐도 생성 · 번역이 멈추지 않게 한다.
//
// 폰 브라우저는 화면에서 사라진 탭을 곧 얼린다(타이머 · 네트워크 읽기가 멈춤). 그래서 실리태번을 띄워 둔 채 다른 앱으로 가면 답이 오다 말고, 끝난 뒤 돌던 자동 번역도 안 돈다.
// 브라우저가 얼리지 않는 예외 가운데 소리를 쓰지 않는 것이 'PIP(화면 속 작은 창)로 재생 중인 영상'이다 — 소리 없는 영상이라 유튜브 소리를 끊지 않는다.
// 보내기 · 스와이프 · 다시 생성을 누르는 그 순간(사용자 동작이 있어야 PIP 를 열 수 있다) 진행 상황을 그린 작은 영상을 PIP 로 띄운다.
// 작은 창에는 '생성 중 · 글자 수 · 끝남'이 보이고, 실리태번으로 돌아오면 저절로 닫힌다. 켜 두었을 때만 불러온다 (features.js).
const TRIGGERS = '#send_but, #option_regenerate, #option_continue, #mes_continue, .swipe_right, .swipe_left, .bl-onehand button, #mes_impersonate, #option_impersonate, .qr--button';
let mode = 'audio';
// 소리 방식: 창 없이 버틴다. 브라우저는 '소리를 내고 있는 탭'을 얼리지 않는다 — 귀에 안 들리는 아주 낮고 작은 소리(30Hz · 0.1% 크기)를 WebAudio 로 낸다.
// <audio> 재생과 달리 WebAudio 는 다른 앱의 재생을 멈추게 하지 않는 편이지만(유튜브가 계속 나옴), 폰 · 브라우저마다 다를 수 있어 실험 기능이다
let audio = null, hum = null;
function startHum() {
    try {
        audio ??= new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' }); // 안 들리는 소리라 지연은 상관없다 — 큰 버퍼로 덜 깨운다
        audio.resume?.();
        if (hum) return;
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.frequency.value = 30; gain.gain.value = 0.001; osc.connect(gain).connect(audio.destination); osc.start();
        hum = { osc, gain };
    } catch (error) { console.info('[Blue Lemonade] 백그라운드 유지 소리를 켜지 못했어요', error?.message || error); }
}
function stopHum() { try { hum?.osc.stop(); hum?.osc.disconnect(); hum?.gain.disconnect(); } catch { /* 이미 멈춤 */ } hum = null; audio?.suspend?.(); }
let humTimer = 0;
let on = false, bound = false, canvas = null, video = null, ctx = null, timer = 0, offs = [];
const state = { phase: 'idle', chars: 0, since: 0, doneAt: 0, preview: '' };
// 멈춘 '생성 중' 걸러내기: 눌렀는데 생성이 안 시작되거나(스와이프만 넘김 · 빠른 답장 · / 명령) 끝 이벤트 없이 멈추면 'working' 이 남아 소리가 안 꺼졌다.
// 실리태번이 생성 중(body[data-generating])이 아니고 누름 · 시작 · 글자 신호도 90초 동안 없으면 내려놓는다. 끝난 뒤('done') 90초는 그대로
let lastSign = 0;
function dropStale() {
    if (state.phase !== 'working') return false;
    if (document.body?.dataset?.generating === 'true') { lastSign = Date.now(); return false; }
    if (Date.now() - lastSign <= 90000) return false;
    state.phase = 'idle';
    return true;
}

function draw() {
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement), pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const W = canvas.width, H = canvas.height, now = Date.now();
    ctx.fillStyle = pick('--salty-bg', '#1c1e21'); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = pick('--salty-accent', '#6ab3ff'); ctx.fillRect(0, 0, W * (state.phase === 'working' ? ((now / 1600) % 1) : 1), 6); // 돌고 있다는 표시 (멈춰 보이면 얼린 것)
    ctx.textBaseline = 'top'; ctx.fillStyle = pick('--salty-text', '#fff'); ctx.font = '600 30px system-ui, sans-serif';
    const seconds = Math.max(0, Math.round(((state.phase === 'done' ? state.doneAt : now) - state.since) / 1000));
    ctx.fillText(state.phase === 'working' ? `생성 중… ${state.chars}자` : state.phase === 'done' ? `끝났어요 · ${state.chars}자` : '기다리는 중', 22, 28);
    ctx.fillStyle = pick('--salty-muted', '#9aa3ad'); ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(`${seconds}초${state.phase === 'done' ? ' · 번역 등 뒷일을 기다리는 중' : ''}`, 22, 72);
    ctx.fillStyle = pick('--salty-text', '#fff'); ctx.font = '22px system-ui, sans-serif';
    const text = state.preview.replace(/\s+/g, ' ').slice(-64);
    ctx.fillText(text.slice(0, 32), 22, 118); ctx.fillText(text.slice(32), 22, 148);
}

function ensureVideo() {
    if (video) return;
    canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 200; ctx = canvas.getContext('2d');
    video = document.createElement('video'); video.muted = true; video.playsInline = true; video.setAttribute('aria-hidden', 'true');
    video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;bottom:0';
    video.srcObject = canvas.captureStream(4);
    document.body.append(video);
    video.addEventListener('leavepictureinpicture', () => { clearInterval(timer); timer = 0; });
}

async function openWindow() {
    if (on && mode === 'audio') { startHum(); clearInterval(humTimer); humTimer = setInterval(() => { if (dropStale() || (state.phase === 'done' && Date.now() - state.doneAt > 90000)) closeWindow(); }, 5000); return; }
    if (!on || !document.pictureInPictureEnabled || document.pictureInPictureElement) return;
    try {
        ensureVideo(); draw();
        await video.play();
        await video.requestPictureInPicture();
        clearInterval(timer); timer = setInterval(() => { draw(); if (dropStale() || (state.phase === 'done' && Date.now() - state.doneAt > 90000)) closeWindow(); }, 250); // 끝난 뒤 1분 반은 번역 등을 위해 열어 둔다
    } catch (error) { console.info('[Blue Lemonade] 백그라운드 창을 열지 못했어요', error?.message || error); }
}
function closeWindow() {
    clearInterval(humTimer); humTimer = 0; stopHum();
    clearInterval(timer); timer = 0;
    if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {});
    video?.pause();
}

function arm() { Object.assign(state, { phase: 'working', chars: 0, since: Date.now(), preview: '' }); lastSign = Date.now(); openWindow(); }
function onTap(event) { if (on && event.target?.closest?.(TRIGGERS)) arm(); }
// Enter 는 실리태번이 실제로 생성할 때만 (RossAscends-mods.js processHotkeys 와 같은 조건 — 폰은 기본값이 줄바꿈).
// Alt+Enter(이어쓰기) · Ctrl+Enter(다시 생성)는 <a> 를 jQuery 로 눌러 클릭 이벤트가 안 오므로 여기서 켠다. 생성이 안 되면 위 걸러내기가 내려놓는다
function onKey(event) {
    if (!on || event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    let c = null;
    try { c = SillyTavern.getContext(); } catch { /* 모르면 예전처럼 켠다 */ }
    if (c?.Popup?.util?.isPopupOpen?.()) return;
    const sendOnEnter = () => !c?.shouldSendOnEnter || c.shouldSendOnEnter();
    if (event.altKey) return arm();
    if (event.ctrlKey) {
        if (jQuery('.mes_edit_done:visible, .mes_reasoning_edit_done:visible').length) return; // 편집 확정
        if (jQuery('#send_textarea').val() !== '' && !sendOnEnter()) return;
        return arm();
    }
    if (event.target?.id === 'send_textarea' && sendOnEnter()) arm();
}
// 돌아와서 화면을 보고 있고 일이 끝났으면 닫는다 (생성 중에 잠깐 돌아온 것이면 그대로 둔다)
function onVisible() { if (!document.hidden && state.phase !== 'working') closeWindow(); }

export function syncBackgroundWindow(enabled, how = 'audio') {
    if (how !== mode) { closeWindow(); mode = how === 'pip' ? 'pip' : 'audio'; }
    on = !!enabled;
    if (!on) { closeWindow(); return; }
    if (bound) return;
    bound = true;
    document.addEventListener('click', onTap, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVisible);
    try {
        const { eventSource, event_types } = SillyTavern.getContext();
        const listen = (name, fn) => { if (event_types[name]) { eventSource.on(event_types[name], fn); offs.push(() => eventSource.removeListener?.(event_types[name], fn)); } };
        // 프롬프트 관리자의 토큰 세기(dryRun)는 생성이 아니다 — 끝 이벤트가 없어 'working' 이 남았다
        listen('GENERATION_STARTED', (_type, _params, dryRun) => { if (dryRun) return; lastSign = Date.now(); if (state.phase !== 'working') Object.assign(state, { phase: 'working', chars: 0, since: Date.now(), preview: '' }); });
        listen('STREAM_TOKEN_RECEIVED', (text) => { lastSign = Date.now(); if (typeof text === 'string') { state.chars = text.length; state.preview = text; } });
        const finish = () => { if (state.phase !== 'working') return; const last = SillyTavern.getContext().chat?.at?.(-1)?.mes; if (typeof last === 'string' && last.length > state.chars) { state.chars = last.length; state.preview = last; } state.phase = 'done'; state.doneAt = Date.now(); if (!document.hidden) setTimeout(onVisible, 1500); };
        listen('GENERATION_ENDED', finish); listen('GENERATION_STOPPED', finish);
    } catch { /* 이벤트를 못 걸면 창은 열리되 글자 수는 안 나온다 */ }
}

/** 설정 창: 이 브라우저에서 되는지 */
export const backgroundWindowSupported = () => !!document.pictureInPictureEnabled;
