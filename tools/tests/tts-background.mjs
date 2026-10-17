// TTS 1.9.9 (7.0.2) 백그라운드 재생 — 폰에서 다른 앱으로 가면 읽기가 멈추던 것 (keep-alive.js).
//   숨었을 때만: 줄 사이 · 다음 줄 합성을 기다리는 동안 같은 <audio> 에 무음을 이어 틀고, 쉼은 타이머 대신 무음의 'ended' 로. 큐가 끝나면 3초 뒤 끔.
//   뒷일 다리 'tts' begin/end (4분마다 꼬리표를 새로). 보일 때는 예전과 같다. 실제 브라우저 · 폰은 아니다 (가짜 audio · 숨은 탭 타이머 묶임 흉내).
//   tts-scene.mjs 의 가짜 실리태번 · 엔진 · <audio> 를 그대로 쓴다. 네트워크 없음.  node tools/tests/tts-background.mjs <테마 루트>
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, '../..'), 'src/addons/tts/src');
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const realCache = pathToFileURL(path.join(root, 'cache.js')).href;
const T = globalThis.__bgTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina', characters: [], groups: [] },
    cache: new Map(), removed: [], saves: 0, requests: [], plays: [], ends: [], downloads: [], warnings: [], nodes: [], urls: new Map(), seq: 0, renders: [] };
T.ctx.saveChat = async () => { T.saves++; };
const G = 'const T = globalThis.__bgTest;\n';
const stubs = {
    'script.js': data(G + `export const chat=T.ctx.chat; export const event_types={CHAT_CHANGED:'chat',MESSAGE_DELETED:'deleted'};
export const eventSource={on(){},makeLast(){},emit(){},removeListener(){}}; export const substituteParams=t=>String(t??'');
export function getRequestHeaders(){return {}} export function saveSettingsDebounced(){} export async function saveSettings(){}
export function syncMesToSwipe(){} export const main_api='openai'; export function generateRaw(){throw Error('Unexpected LLM generation')}`),
    'extensions.js': data(G + `export const extension_settings=T.ext; export const extensionNames=[];
export const getContext=()=>T.ctx; export function saveMetadataDebounced(){}`),
    'popup.js': data(`export const POPUP_TYPE={TEXT:1,CONFIRM:2,INPUT:3}; export const POPUP_RESULT={AFFIRMATIVE:1,NEGATIVE:0,CANCELLED:null};
export async function callGenericPopup(){throw Error('Unexpected popup')} export function fixToastrForDialogs(){}`),
    'utils.js': data(`export function getStringHash(s){let h=0;for(const c of String(s??''))h=(h*31+c.charCodeAt(0))|0;return h}
export const splitRecursive=t=>[String(t??'')];`),
    'secrets.js': data('export const secret_state={};'),
};
const cacheStub = data(G + `export * from ${JSON.stringify(realCache)};
export async function get(k){return T.cache.get(k)||null} export async function has(k){return T.cache.has(k)}
export async function put(k,blob,meta={}){T.cache.set(k,{blob,...meta})}
export async function remove(k){T.removed.push(k);T.cache.delete(k)} export async function clear(){T.cache.clear()}
export function setProtected(){} export function onClear(){} export async function prune(){}`);
register(data(`let D;export function initialize(d){D=d}export async function resolve(spec,ctx,next){
if(String(ctx.parentURL||'').includes('/addons/tts/')){
if(spec==='./cache.js')return {url:D.cache,shortCircuit:true};
const base=spec.split('/').pop();if(spec.split('../').length>3&&D.st[base])return {url:D.st[base],shortCircuit:true};}
return next(spec,ctx)}`), { data: { st: stubs, cache: cacheStub } });

class Element extends EventTarget {
    constructor(tag = 'div') { super(); this.tagName = tag.toUpperCase(); this.dataset = {}; this.children = []; this.attributes = new Map(); this.style = { setProperty() {} }; this._selectors = new Map(); this.hidden = true;
        const cls = new Set(); this.classList = { add: (...x) => x.forEach(v => cls.add(v)), remove: (...x) => x.forEach(v => cls.delete(v)), contains: x => cls.has(x), toggle: (x,v) => { v ??= !cls.has(x); if (v) cls.add(x); else cls.delete(x); return v; } }; }
    setAttribute(k,v) { this.attributes.set(k,v); } removeAttribute(k) { this.attributes.delete(k); } getAttribute(k) { return this.attributes.get(k); }
    appendChild(n) { this.children.push(n); return n; } append(...n) { this.children.push(...n); } replaceChildren(...n) { this.children = n; } remove() {} focus() {} contains() { return false; }
    querySelector(s) { if (!this._selectors.has(s)) this._selectors.set(s, new Element()); return this._selectors.get(s); } querySelectorAll() { return []; }
    click() { if (this.tagName === 'A') T.downloads.push({ filename: this.download, blob: T.urls.get(this.href) }); this.dispatchEvent(new Event('click')); }
    getBoundingClientRect() { return { left:0,top:0,width:800,height:40 }; }
}
class MockAudio extends Element {
    constructor(src = '') { super('audio'); this.src = src; this.paused = true; this.volume = 1; this.playbackRate = 1; this.loop = false; this.timer = 0; T.nodes.push(this); }
    async play() {
        const blob = T.urls.get(this.src); if (!blob) throw Error('Missing test blob');
        const payload = JSON.parse(await blob.text()); this.paused = false; this.payload = payload;
        T.plays.push({ ...payload, volume: this.volume, rate: this.playbackRate, loop: this.loop, at: performance.now(), node: this });
        this.onplaying?.(); if (this.paused) return;
        clearTimeout(this.timer); if (!this.loop) this.timer = setTimeout(() => { if (!this.paused) { this.paused = true; T.ends.push({ ...payload, at: performance.now() }); this.onended?.(); this.dispatchEvent(new Event('ended')); } }, payload.ms || 25);
    }
    pause() { this.paused = true; clearTimeout(this.timer); if (this.payload) { const p = T.plays.find(x => x.node === this); if (p && p.pausedAt == null) p.pausedAt = performance.now(); } }
    removeAttribute(k) { super.removeAttribute(k); if (k === 'src') this.src = ''; }
    load() {};
}
globalThis.Audio = MockAudio;
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.CustomEvent ||= class extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
globalThis.document = { body: new Element('body'), createElement: t => t === 'audio' ? new MockAudio() : new Element(t),
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
globalThis.toastr = Object.fromEntries(['info','warning','error','success'].map(kind => [kind, msg => T.warnings.push({kind,msg})]));
const local = new Map(); globalThis.localStorage = { getItem:k => local.get(k) ?? null, setItem:(k,v) => local.set(k,String(v)), removeItem:k => local.delete(k) };
URL.createObjectURL = blob => { const url=`blob:scene-test/${++T.seq}`; T.urls.set(url,blob); return url; };
URL.revokeObjectURL = url => T.urls.delete(url);
const blob = payload => new Blob([JSON.stringify(payload)], { type:'audio/wav' });
globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if ((u === 'https://mock.invalid/v1/chat/completions' || u === '/api/backends/chat-completions/generate') && T.analysisReply) {
        const input=JSON.parse(init.body); T.analysisRequests.push(input);
        if (T.analysisGate) { T.analysisGate.started=true; await T.analysisGate.promise; }
        return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(T.analysisReply(input))}}],usage:{prompt_tokens:10,completion_tokens:10}}));
    }
    if (u === 'https://mock.invalid/voice') { const input=JSON.parse(init.body); T.requests.push(input); return { ok:true, blob:async()=>blob({kind:'voice',...input,seconds:.06,ms:25}) }; }
    const sfx = u.match(/\/sfx(?:-extra)?\/([a-z0-9_]+)\.mp3$/);
    if (sfx) { if (T.sfxGate) { T.sfxGate.started = true; await T.sfxGate.promise; } return { ok:true, blob:async()=>blob({kind:'sfx',sfxId:sfx[1],seconds:.08,ms:35}) }; }
    throw Error('Blocked non-mock fetch: '+u);
};
// Offline media mock records the actual render graph. PCM encoding is checked separately;
// this does not claim browser decoding or perceptual audio quality verification.
class OfflineMock {
    constructor(channels, frames, rate) { this.channels=channels;this.frames=frames;this.sampleRate=rate;this.destination={};this.sources=[]; }
    async decodeAudioData(bytes) { const payload=JSON.parse(new TextDecoder().decode(bytes));return {duration:payload.seconds,payload,numberOfChannels:2,length:Math.ceil(payload.seconds*44100),sampleRate:44100,getChannelData:()=>new Float32Array(Math.ceil(payload.seconds*44100))}; }
    createBufferSource() { const n={playbackRate:{value:1},connect(g){this.gain=g},start(v){this.startAt=v},stop(v){this.stopAt=v}};this.sources.push(n);return n; }
    createGain() { return {gain:{values:[],setValueAtTime(v,t){this.values.push([v,t])},linearRampToValueAtTime(v,t){this.values.push([v,t])}},connect(){}}; }
    async startRendering() { T.renders.push(this); if (T.renderGate) { T.renderGate.started = true; await T.renderGate.promise; } return {numberOfChannels:this.channels,length:this.frames,sampleRate:this.sampleRate,getChannelData:()=>new Float32Array(this.frames)}; }
}
globalThis.OfflineAudioContext = OfflineMock;
const mod = name => import(pathToFileURL(path.join(root,name)).href);
const S=await mod('settings.js'), V=await mod('voices.js'), P=await mod('player.js'), Store=await mod('script-store.js'), Mix=await mod('scene-mix.js'), Registry=await mod('providers/index.js'), Sfx=await mod('sfx-audio.js');
const Library=await mod('sfx-library.js'), Details=await mod('playback-details.js'), A=await mod('analysis.js');
const Origin=await import(pathToFileURL(path.join(root,'../../../edit-origin.js')).href);   // 6.1.7 다시 쓰기 출처 표시
for (const id of ['minimax','elevenlabs']) Registry.PROVIDERS[id].synth = async ({text,voice,emotion,lang,signal}) => {
    const response=await fetch('https://mock.invalid/voice',{method:'POST',body:JSON.stringify({text,voiceUid:voice.uid,emotion,lang}),signal});return {blob:await response.blob(),usage:{chars:text.length}};
};
P.init();
let passed=0, failed=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=1500) { const at=Date.now();while(!fn()){if(Date.now()-at>ms)throw Error('Timed out; warnings='+JSON.stringify(T.warnings));await sleep(5);} }
async function idle() { await until(()=>!P.isPlaying());await sleep(8); }
async function test(name,fn) { try{await fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack)}finally{P.stop();await sleep(5);} }
const voice = (id,name)=>({uid:'minimax:'+id,provider:'minimax',voiceId:id,name,aliases:[],params:{},mix:[],lang:''});
async function reset() {
    T.sfxGate = T.renderGate = null;
    T.analysisGate=null;T.analysisReply=null;T.analysisRequests=[];
    P.stop(); await sleep(10); P.forgetClips(); P.forgetFrom(0);T.cache.clear();T.removed.length=T.requests.length=T.plays.length=T.ends.length=T.downloads.length=T.warnings.length=T.renders.length=0;
    // 1.9.1 한 문단 이어 읽기는 끈다 — 이 파일은 줄마다 읽기(6.4.2) · 효과음 자리를 본다 (이어 읽기는 tts-join.mjs)
    const s=S.settings();Object.assign(s,{join_paragraph:false,enabled:true,voices:[voice('mina','Mina'),voice('nora','Nora')],char_map:{Mina:'minimax:mina',Nora:'minimax:nora'},default_voice:'minimax:mina',narrator_voice:'',user_voice:'',prefer_provider:'',normalize:false,dethump:false,emotion_strength:'normal',pregen:'off',prefetch:0,text_source:'original',pron_dict:'',wait_translation:'off',extras:'off',listen_lang:'auto',mini_player:false,highlight:false,master_volume:1,playback_rate:1,gap_ms:0,max_chars:0,
        providers:{minimax:{key:'mock-key',model:'speech-2.8-hd'},elevenlabs:{key:'mock-key',model:'eleven_v3'}},sfx:{enabled:false,auto:false,volume:.5,mode:'overlay',custom:[]},analysis:{...s.analysis,enabled:false},routes:{dialogue:'character',narration:'skip',action:'skip',thought:'skip',user_dialogue:'skip'}});
    T.ctx.chat.length=0;T.ctx.chat.push({mes:'"Hello one." She waits. "Hello two."',name:'Mina',is_user:false,is_system:false,swipe_id:0,extra:{}});T.ctx.name2='Mina';document.body.dataset.generating='false';
    assert.equal(V.allVoices().length,2);
    return P.scriptRows(0);
}
const row=(id,kind,extra={})=>({id,kind,text:kind==='voice'?id:'',speaker:'Mina',voiceUid:'minimax:mina',emotion:'',sourceIndex:null,volume:1,gapMs:0,enabled:true,...extra});
const timelineClip=(kind,seconds,extra={})=>({kind,buffer:{duration:seconds},volume:1,gapMs:0,...extra});
function gate() { let release; const promise=new Promise(r=>release=r);return {promise,release,started:false}; }


// ── 1.9.9 (7.0.2) 백그라운드 재생 ─────────────────────────────
const K = await mod('keep-alive.js');
const AW = await import(pathToFileURL(path.join(root, '../../../after-work.js')).href);
T.silence = [];
// 무음 WAV(진짜 RIFF)는 길이만큼(시험은 10배 빠르게) 재생한 뒤 'ended' — 반복(loop)이면 끝나지 않는다
const jsonPlay = MockAudio.prototype.play;
MockAudio.prototype.play = async function () {
    const b = T.urls.get(this.src);
    if (b && (await b.slice(0, 4).text()) === 'RIFF') {
        const dv = new DataView(await b.arrayBuffer());
        const ms = dv.getUint32(40, true) / 2 / dv.getUint32(24, true) * 1000;
        this.paused = false;
        T.silence.push({ ms, loop: this.loop, at: performance.now(), node: this });
        clearTimeout(this.timer);
        if (!this.loop) this.timer = realSetTimeout(() => { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('ended')); } }, Math.max(3, ms / 10));
        return;
    }
    return jsonPlay.call(this);
};
// 숨은 탭 흉내: 재생기(player.js)가 건 타이머만 1초 이상으로 묶는다 (가짜 audio · 시험 도구 타이머는 그대로)
const realSetTimeout = globalThis.setTimeout;
let throttle = false;
globalThis.setTimeout = (fn, ms, ...rest) => {
    if (throttle && /[\\/]tts[\\/]src[\\/]player\.js/.test((new Error().stack || '').split('\n')[2] || '')) ms = Math.max(1000, Number(ms) || 0);   // 타이머를 직접 건 곳이 재생기일 때만
    return realSetTimeout(fn, ms, ...rest);
};
const audioEl = () => T.nodes.find(n => n.className === 'lv-audio') || T.nodes[0];
const three = (gapMs) => [row('a', 'voice', { text: 'Line one.', gapMs }), row('b', 'voice', { text: 'Line two.', gapMs }), row('c', 'voice', { text: 'Line three.', gapMs })];

await test('keep-alive: 무음 WAV 머리 (8 kHz 16비트 모노, 길이대로)', async () => {
    const w = K.silentWav(250);
    const dv = new DataView(w.buffer);
    assert.equal(new TextDecoder().decode(w.slice(0, 4)), 'RIFF');
    assert.equal(dv.getUint32(24, true), 8000);
    assert.equal(dv.getUint16(34, true), 16);
    assert.equal(dv.getUint32(40, true), 2000 * 2);
    assert.equal(w.length, 44 + 4000);
});

await test('keep-alive: 보일 때는 아무것도 안 함(hold false · wait null) · 숨으면 반복 무음 · wait 는 ended 로 · 끊기면 false · linger 뒤 끔 · prepare 가 linger 를 무름', async () => {
    let hidden = false;
    const el = new MockAudio();
    const k = K.createKeepAlive({ audio: el, hidden: () => hidden });
    assert.equal(k.hold(), false); assert.equal(k.wait(300, null), null);
    hidden = true;
    assert.equal(k.hold(), true); assert.equal(el.loop, true); assert.equal(k.holding, true);
    await sleep(5);
    assert.ok(T.silence.at(-1).loop, '반복 무음');
    const ok = await k.wait(400, { promise: new Promise(() => {}), fired: false });
    assert.equal(ok, true); assert.equal(el.loop, true, '쉼이 끝나면 다시 반복 무음으로 잡는다');
    let fire; const ir = { fired: false, promise: new Promise(r => { fire = () => { ir.fired = true; r(); }; }) };
    const cut = k.wait(5000, ir); fire();
    assert.equal(await cut, false);
    assert.equal(k.linger(300), true);
    await until(() => !k.holding, 800);
    assert.equal(el.src, '', 'linger 가 끝나면 요소를 비움');
    k.hold(); k.linger(300); k.prepare(); await sleep(60);
    assert.equal(k.holding, false); assert.notEqual(el.src, '', 'prepare 뒤 늦게 끝난 linger 는 무시 (새 줄 src 를 지우지 않음)');
});

await test('keep-alive: 뒷일 다리 — 읽는 동안 하나(busy) · 끝나면 놓음 · 4분마다 꼬리표를 새로 잡아도 busy 가 끊기지 않음', async () => {
    let t = 0;
    const bridge = AW.createAfterWork({ now: () => t });
    const flips = []; bridge.onChange(e => flips.push(e.busy));
    const k = K.createKeepAlive({ audio: new MockAudio(), hidden: () => true, bridge: () => bridge, now: () => t });
    k.begin(); k.begin();
    assert.deepEqual(bridge.tags, ['tts']); assert.equal(bridge.busy, true);
    t = K.RENEW_MS + 1; k.begin();
    assert.deepEqual(bridge.tags, ['tts:renew']); assert.equal(bridge.busy, true);
    t += 6 * 60 * 1000 - K.RENEW_MS; assert.equal(bridge.busy, true, '다리 상한 5분을 넘어도');
    k.end(); assert.equal(bridge.busy, false);
    assert.deepEqual(flips, [true, false], '바쁨 ↔ 멈춤은 처음 · 끝 한 번씩');
});

await test('숨었을 때: 줄 사이 쉼은 무음 ended 로(재생기 타이머가 1초로 묶여도 빠름) · 줄 사이에 요소를 비우지 않음 · 큐가 끝나면 잠깐 뒤 끔 · 다리 begin/end', async () => {
    await reset(); T.silence.length = 0;
    const bridge = AW.installAfterWork(globalThis);
    const seen = []; const off = bridge.onChange(e => seen.push(e.busy));
    document.hidden = true; throttle = true;
    try {
        const t0 = performance.now();
        await P.speakScript(0, three(300));
        await idle();
        const took = performance.now() - t0;
        assert.deepEqual(T.plays.filter(p => p.kind === 'voice').map(p => p.text), ['Line one.', 'Line two.', 'Line three.']);
        const gaps = T.silence.filter(s => !s.loop && Math.abs(s.ms - 300) < 30);
        assert.equal(gaps.length, 2, '줄 사이 쉼 두 번은 300ms 무음으로 ' + JSON.stringify(T.silence.map(s => [Math.round(s.ms), s.loop])));
        assert.ok(took < 900, `타이머 묶임(1초)을 안 탐: ${Math.round(took)}ms`);
        assert.deepEqual(seen, [true, false], '읽는 동안 다리 busy, 끝나면 놓음');
        assert.ok(T.silence.some(s => !s.loop && Math.abs(s.ms - 3000) < 60), '큐 끝: 3초 linger');
        await until(() => !P._forTest.keepAlive.holding, 1500);
        assert.equal(audioEl().src, '', 'linger 뒤 요소를 비움');
    } finally { document.hidden = false; throttle = false; off(); }
});

await test('보일 때는 예전 그대로: 무음 없음 · 쉼은 타이머 (흉내 묶임을 켜면 그만큼 느림 — 숨김 길과 비교용)', async () => {
    await reset(); T.silence.length = 0;
    document.hidden = false; throttle = true;
    try {
        const t0 = performance.now();
        await P.speakScript(0, three(300));
        await until(() => !P.isPlaying(), 6000);
        assert.equal(T.silence.length, 0);
        assert.deepEqual(T.plays.filter(p => p.kind === 'voice').map(p => p.text), ['Line one.', 'Line two.', 'Line three.']);
        assert.ok(performance.now() - t0 > 1500, '보일 때는 타이머 길');
    } finally { throttle = false; }
});

await test('숨는 순간 줄 사이면(다음 줄 합성을 기다리는 중) 바로 무음으로 잡고 다음 두 줄을 미리 받음 · 멈춤/다시는 무음 요소도 · 사용자가 멈추면 바로 끔', async () => {
    await reset(); T.silence.length = 0;
    const g = gate();
    const synth = Registry.PROVIDERS.minimax.synth;
    Registry.PROVIDERS.minimax.synth = async (opts) => { if (opts.text === 'Second.') { g.started = true; await g.promise; } return synth(opts); };
    const rows = [row('a', 'voice', { text: 'First.' }), row('b', 'voice', { text: 'Second.' }), row('c', 'voice', { text: 'Third.' }), row('d', 'voice', { text: 'Fourth.' })];
    try {
        await P.speakScript(0, rows);
        await until(() => T.ends.some(e => e.text === 'First.') && g.started);
        await sleep(10);
        const el = audioEl();
        assert.equal(el.src, '', '보일 때는 줄이 끝나면 비움 (예전 그대로)');
        document.hidden = true;
        P._forTest.onHidden();
        assert.equal(P._forTest.keepAlive.holding, true, '줄 사이에 숨으면 바로 무음으로 잡음');
        await until(() => ['Third.', 'Fourth.'].every(x => T.requests.some(r => r.text === x)), 1500);
        P.pause(); assert.equal(el.paused, true, '멈춤이면 무음도 멈춤');
        P.resume(); await sleep(5); assert.equal(el.paused, false, '다시 들으면 무음도 다시');
        P.stop(); await sleep(5);
        assert.equal(P._forTest.keepAlive.holding, false, '사용자 멈춤은 바로 끔');
        assert.equal(el.src, '');
    } finally { document.hidden = false; g.release(); Registry.PROVIDERS.minimax.synth = synth; }
});

await test('배선: playAudio 는 숨었을 때 비우지 않고 hold · waitScene 숨김 길 · finishAll linger · run 에서 다리 begin · visibilitychange', async () => {
    const src = await fsp.readFile(path.join(root, 'player.js'), 'utf8');
    assert.match(src, /if \(ir\.fired \|\| !keepAlive\.hold\(\)\) \{\n\s+if \(!audio\.paused\) audio\.pause\(\);\n\s+audio\.removeAttribute\('src'\);/);
    assert.match(src, /if \(keepAlive\.hidden\(\)\) \{ const r = keepAlive\.wait\(left, ir\); if \(r\) return await r; \}/);
    assert.match(src, /if \(!keepAlive\.linger\(3000\)\) keepAlive\.release\(\);/);
    assert.match(src, /current = job;\n\s+keepAlive\.begin\(\);/);
    assert.match(src, /document\.addEventListener\('visibilitychange', onHidden\);/);
    assert.ok(!/visibilitychange[^\n]*pause\(/.test(src), '숨을 때 멈추는 처리 없음');
    const v = (await fsp.readFile(path.join(root, '../version.js'), 'utf8')).match(/TTS_VERSION = '(\d+)\.(\d+)\.(\d+)'/).slice(1).map(Number);
    assert.ok(v[0] * 1e6 + v[1] * 1e3 + v[2] >= 1009009);
    assert.match(await fsp.readFile(path.join(root, '../../../../.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/tts-background\.mjs \./);
});

P.stop(); for (const node of T.nodes) node.pause();
console.log(JSON.stringify({ passed, failed, file: 'tts-background' }, null, 2));
process.exitCode = failed ? 1 : 0;
