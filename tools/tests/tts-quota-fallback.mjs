// 8.2.5 ElevenLabs 한도가 다 차면 MiniMax 로 대신 읽기 (설정 quota_fallback — src/addons/tts/src/quota-fallback.js · player.js quotaBefore · quotaAfter)
//   진짜 player.js · 진짜 ElevenLabs 엔진 코드 + 가짜 fetch (api.elevenlabs.io 오류 모양은 공식 오류 안내의 detail) · MiniMax 는 가짜 엔진. 네트워크 · 유료 호출 0
//   ① 한도 초과(옛 401 quota_exceeded · 새 402 insufficient_credits)만 대신 읽음 · 429 · 키 · 5xx · 연결은 아님 ② 켬/끔(기본 끔)
//   ③ 칸이 빈 캐릭터는 대신 안 읽고 지금처럼 오류 ④ 세션 기억(ElevenLabs 를 다시 두드리지 않음 · 초기화 시각 · 돌아가기) ⑤ 캐시 · 미리 만들기 규칙 그대로
//   node tools/tests/tts-quota-fallback.mjs [테마 루트]   (시험대는 fault-tts-player.mjs 와 같다)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, '../..'), 'src/addons/tts/src');
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const realCache = pathToFileURL(path.join(root, 'cache.js')).href;
const T = globalThis.__quotaFallbackTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina', characters: [], groups: [] },
    cache: new Map(), removed: [], saves: 0, requests: [], plays: [], ends: [], downloads: [], warnings: [], nodes: [], urls: new Map(), seq: 0, renders: [] };
T.ctx.saveChat = async () => { T.saves++; };
const G = 'const T = globalThis.__quotaFallbackTest;\n';
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
const S=await mod('settings.js'), V=await mod('voices.js'), P=await mod('player.js'), Registry=await mod('providers/index.js'), Q=await mod('quota-fallback.js'), EL=await mod('providers/elevenlabs.js');
// MiniMax 는 가짜 엔진 (요청 기록) · ElevenLabs 는 진짜 엔진 코드 + 가짜 fetch (api.elevenlabs.io 응답 모양 — 공식 오류 안내의 detail)
Registry.PROVIDERS.minimax.synth = async ({text,voice,emotion,lang,signal}) => {
    const response=await fetch('https://mock.invalid/voice',{method:'POST',body:JSON.stringify({text,voiceUid:voice.uid,emotion,lang}),signal});return {blob:await response.blob(),usage:{chars:text.length}};
};
P.init();
let passed=0, failed=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=3000) { const at=Date.now();while(!fn()){if(Date.now()-at>ms)throw Error('Timed out; warnings='+JSON.stringify(T.warnings));await sleep(5);} }
async function idle() { await until(()=>!P.isPlaying(), 30000);await sleep(15); }   // 서버 오류 · 연결 실패는 재시도(1.5초 · 4초)까지
async function test(name,fn) { local.delete('lemon_voice.kept_analyses'); try{await fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack)}finally{P.stop();await sleep(5);} }
const mm = (id,name)=>({uid:'minimax:'+id,provider:'minimax',voiceId:id,name,aliases:[],params:{},mix:[],lang:''});
const el = (id,name)=>({uid:'elevenlabs:'+id,provider:'elevenlabs',voiceId:id,name,aliases:[],params:{},mix:[],lang:''});
const RESET_UNIX = Math.floor(Date.now()/1000) + 5*24*3600;
// ElevenLabs 응답: T.elMode = 'ok' | 'quota-legacy'(401 detail.status quota_exceeded) | 'quota-new'(402 insufficient_credits) | 'rate'(429) | 'key'(401 invalid_api_key) | 'server'(500) | 'network'
function elResponse(u) {
    const j = (status, detail) => new Response(JSON.stringify({ detail }), { status, headers: { 'content-type': 'application/json' } });
    if (/\/v1\/user\/subscription$/.test(u)) { T.subs++; return new Response(JSON.stringify({ character_count: 100000, character_limit: 100000, next_character_count_reset_unix: RESET_UNIX, tier: 'creator' }), { status: 200 }); }
    switch (T.elMode) {
        case 'quota-legacy': return j(401, { status: 'quota_exceeded', message: 'This request exceeds your quota of 100000. You have 12 credits remaining, while 40 credits are required for this request.' });
        case 'quota-new': return j(402, { type: 'payment_required', code: 'insufficient_credits', message: 'Insufficient credits.', status: 'insufficient_credits', request_id: 'r1' });
        case 'rate': return j(429, { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'Too many requests. Wait before retrying.' });
        case 'key': return j(401, { type: 'authentication_error', code: 'invalid_api_key', status: 'invalid_api_key', message: 'Invalid API key' });
        case 'server': return j(500, { type: 'internal_error', code: 'internal_error', message: 'Internal error' });
        case 'network': throw new TypeError('Failed to fetch');
        default: {
            const audio = Buffer.from(JSON.stringify({ kind: 'voice', engine: 'elevenlabs', seconds: .06, ms: 25 })).toString('base64');
            return new Response(JSON.stringify({ audio_base64: audio, alignment: null }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
    }
}
const baseFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.elevenlabs.io/')) {
        if (/text-to-speech/.test(u)) { const b = JSON.parse(init.body); T.el.push({ url: u, text: b.text }); }
        return elResponse(u);
    }
    return baseFetch(url, init);
};
const ss = new Map(); globalThis.sessionStorage = { getItem:k => ss.get(k) ?? null, setItem:(k,v) => ss.set(k,String(v)), removeItem:k => ss.delete(k) };
async function reset({ enabled = true, map = { 'elevenlabs:mina': 'minimax:mina-mm' }, mes = '"Hello one." She waits. "Hello two."' } = {}) {
    P.stop(); await sleep(10); P.quotaReturn(); Q._resetForTest(); ss.clear();
    P.forgetClips(); P.forgetFrom(0); T.cache.clear();
    T.requests.length=T.plays.length=T.ends.length=T.warnings.length=0; T.el=[]; T.subs=0; T.elMode='ok';
    const s=S.settings();
    Object.assign(s,{join_paragraph:false,enabled:true,voices:[el('mina','Mina'),el('nora','Nora'),mm('mina-mm','Mina'),mm('nora-mm','Nora')],char_map:{Mina:'elevenlabs:mina',Nora:'elevenlabs:nora'},default_voice:'elevenlabs:mina',narrator_voice:'',user_voice:'',prefer_provider:'',prefer_keep:{},normalize:false,dethump:false,emotion_strength:'normal',pregen:'off',pregen_paid:false,prefetch:0,text_source:'original',pron_dict:'',wait_translation:'off',extras:'off',listen_lang:'auto',mini_player:false,highlight:false,master_volume:1,playback_rate:1,gap_ms:0,max_chars:0,
        providers:{minimax:{key:'mock-key',model:'speech-2.8-hd'},elevenlabs:{key:'mock-key',model:'eleven_v3'}},sfx:{enabled:false,auto:false,volume:.5,mode:'overlay',custom:[]},analysis:{...s.analysis,enabled:false},routes:{dialogue:'character',narration:'skip',action:'skip',thought:'skip',user_dialogue:'skip'},
        quota_fallback:{enabled,map:{...map}}});
    T.ctx.chat.length=0;T.ctx.chat.push({mes,name:'Mina',is_user:false,is_system:false,swipe_id:0,extra:{}});T.ctx.name2='Mina';document.body.dataset.generating='false';
}
const read = async (id = 0) => { assert.ok(P.speakMessage(id, { force: true })); await sleep(30); await idle(); };
const mmPlays = () => T.plays.filter(x => x.kind === 'voice' && !x.engine);
const elPlays = () => T.plays.filter(x => x.engine === 'elevenlabs');
const notice = () => T.warnings.filter(w => w.msg === Q.QUOTA_NOTICE);

// ---------- 판정 (순수)
await test('한도 초과 판정: 옛 401 quota_exceeded · 새 402 insufficient_credits 만, 429 · 키 · 5xx · 연결은 아니에요', () => {
    assert.equal(Q.quotaResponse(401, JSON.stringify({ detail: { status: 'quota_exceeded', message: 'This request exceeds your quota of 10000.' } })), true);
    assert.equal(Q.quotaResponse(402, JSON.stringify({ detail: { type: 'payment_required', code: 'insufficient_credits', message: 'x' } })), true);
    assert.equal(Q.quotaResponse(402, ''), true, '402 는 본문이 없어도 크레딧 부족');
    assert.equal(Q.quotaResponse(429, JSON.stringify({ detail: { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'Too many requests.' } })), false);
    assert.equal(Q.quotaResponse(429, JSON.stringify({ detail: { status: 'too_many_concurrent_requests', message: 'Too many concurrent requests' } })), false);
    assert.equal(Q.quotaResponse(401, JSON.stringify({ detail: { status: 'invalid_api_key', message: 'Invalid API key' } })), false);
    assert.equal(Q.quotaResponse(500, JSON.stringify({ detail: { code: 'internal_error', message: 'quota' } })), false);
    assert.equal(Q.isQuotaError(Object.assign(new Error('연결 실패'), { status: 0, code: 'network', retry: true })), false);
    assert.equal(Q.isQuotaError(Object.assign(new Error('x'), { status: 429, code: 'quota_exceeded' })), false, '429 는 몰림');
});
await test('8.2.5 고침: 옛 401 quota_exceeded 가 「API 키가 맞지 않아요」가 아니라 한도 안내로 (e.quota)', () => {
    const e = EL.elError(401, JSON.stringify({ detail: { status: 'quota_exceeded', message: 'This request exceeds your quota of 100.' } }));
    assert.equal(e.message, '이번 달 글자 한도를 다 썼어요');
    assert.equal(e.quota, true); assert.equal(e.fatal, true);
    const k = EL.elError(401, JSON.stringify({ detail: { type: 'authentication_error', code: 'invalid_api_key', message: 'Invalid API key' } }));
    assert.equal(k.message, 'API 키가 맞지 않아요'); assert.notEqual(k.quota, true);
    const r = EL.elError(429, JSON.stringify({ detail: { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'Too many requests.' } }));
    assert.notEqual(r.quota, true); assert.equal(r.retry, true);
});
await test('설정: 기본 끔 · 모르는 값은 끔 · 표는 글자만', () => {
    assert.deepEqual(Q.normQuotaFallback(undefined), { enabled: false, map: {} });
    assert.deepEqual(Q.normQuotaFallback({ enabled: 'true', map: { a: 'b', c: 3, __proto__: { x: 'y' } } }), { enabled: false, map: { a: 'b' } });
    assert.equal(S.DEFAULTS.quota_fallback.enabled, false);
});
await test('세션 기억: 같은 탭(sessionStorage)은 새로 고쳐도 남고 · 초기화 시각이 지나면 저절로 풀려요', () => {
    Q._resetForTest(); ss.clear();
    const t0 = 1_000_000;
    assert.equal(Q.tripQuota(t0), true); assert.equal(Q.tripQuota(t0 + 1), false, '이미 막힘');
    assert.equal(Q.setQuotaUntil(t0 + 5000, t0), true);
    Q._resetForTest();   // 새로 고침 (메모리만 비움)
    assert.equal(Q.quotaOut(t0 + 10), true, 'sessionStorage 에서 다시 읽음');
    assert.equal(Q.takeNotice(t0 + 10), true); assert.equal(Q.takeNotice(t0 + 11), false, '안내는 한 번');
    assert.equal(Q.quotaOut(t0 + 5000), false, '초기화 시각이 지나면 풂');
    assert.equal(ss.size, 0);
    assert.match(Q.quotaNoteText({ out: true, until: new Date(2026, 10, 3).getTime() }), /MiniMax 로 읽고 있어요 · 11월 3일 초기화 뒤 돌아가요/);
});

// ---------- 재생기 (진짜 player.js · ElevenLabs 엔진 코드, 가짜 fetch)
await test('켬 + 한도 초과(옛 401): 첫 줄에서 한 번만 ElevenLabs, 그 줄부터 MiniMax 로 다 읽고 안내는 한 번', async () => {
    await reset(); T.elMode = 'quota-legacy';
    await read();
    assert.equal(T.el.length, 1, 'ElevenLabs 는 한 번만 (두 번째 줄은 바로 MiniMax): ' + JSON.stringify(T.el));
    assert.deepEqual(T.requests.map(r => [r.text, r.voiceUid]), [['Hello one.', 'minimax:mina-mm'], ['Hello two.', 'minimax:mina-mm']]);
    assert.equal(mmPlays().length, 2);
    assert.equal(notice().length, 1, JSON.stringify(T.warnings));
    assert.equal(T.warnings.filter(w => /한도를 다 썼어요|API 키/.test(w.msg)).length, 0, '대신 읽었으니 오류 안내 없음');
    await until(() => Q.quotaState().until === RESET_UNIX * 1000);
    assert.equal(T.subs, 1, '초기화 시각은 구독 조회 한 번 (글자 안 씀)');
});
await test('세션 기억: 다음 메시지도 ElevenLabs 를 다시 두드리지 않고 바로 MiniMax · 안내는 다시 안 띄워요', async () => {
    await reset(); T.elMode = 'quota-new';
    await read();
    assert.equal(T.el.length, 1);
    T.el = []; T.requests.length = 0; T.warnings.length = 0; T.elMode = 'ok';
    T.ctx.chat.push({ mes: '"Third line."', name: 'Mina', is_user: false, is_system: false, swipe_id: 0, extra: {} });
    await read(1);
    assert.equal(T.el.length, 0, 'ElevenLabs 에 안 보냄 (한도 풀려도 이 탭에선 초기화 시각까지)');
    assert.deepEqual(T.requests.map(r => r.voiceUid), ['minimax:mina-mm']);
    assert.equal(notice().length, 0);
});
await test('「ElevenLabs 로 돌아가기」: 다시 ElevenLabs 로 읽어요', async () => {
    await reset(); T.elMode = 'quota-legacy';
    await read();
    assert.equal(Q.quotaOut(), true);
    assert.equal(P.quotaReturn(), true); assert.equal(Q.quotaOut(), false);
    T.el = []; T.requests.length = 0; T.plays.length = 0; T.elMode = 'ok';
    T.ctx.chat.push({ mes: '"Back again."', name: 'Mina', is_user: false, is_system: false, swipe_id: 0, extra: {} });
    await read(1);
    assert.equal(T.el.length, 1); assert.equal(T.requests.length, 0); assert.equal(elPlays().length, 1);
});
await test('끔(기본): 한도 초과는 지금처럼 오류 안내 · MiniMax 로 안 읽고 · 기억도 안 해요', async () => {
    await reset({ enabled: false }); T.elMode = 'quota-legacy';
    await read();
    assert.equal(T.requests.length, 0);
    assert.ok(T.warnings.some(w => w.msg === '이번 달 글자 한도를 다 썼어요'), JSON.stringify(T.warnings));
    assert.equal(notice().length, 0); assert.equal(Q.quotaOut(), false); assert.equal(T.subs, 0);
});
for (const [mode, why] of [['rate', '429 몰림'], ['key', '키 오류'], ['server', '서버 오류'], ['network', '연결 실패']]) {
    await test(`켬이어도 ${why}는 대신 읽지 않아요 (지금처럼)`, async () => {
        await reset(); T.elMode = mode;
        await read();
        assert.equal(T.requests.length, 0, 'MiniMax 요청 없음');
        assert.equal(Q.quotaOut(), false, '기억 안 함');
        assert.equal(notice().length, 0);
        assert.ok(T.el.length >= 1);
    });
}
await test('칸이 빈 캐릭터는 대신 읽지 않고 지금처럼 오류 · 그 뒤로는 ElevenLabs 에 다시 안 보내요 (다른 캐릭터는 대신 읽음)', async () => {
    await reset({ map: { 'elevenlabs:mina': 'minimax:mina-mm' } }); T.elMode = 'quota-legacy';
    T.ctx.chat[0] = { mes: '"Nora line one." "Nora line two."', name: 'Nora', is_user: false, is_system: false, swipe_id: 0, extra: {} };
    await read();
    assert.equal(T.el.length, 1, 'Nora 첫 줄만 ElevenLabs');
    assert.equal(T.requests.length, 0, 'Nora 는 칸이 비어 MiniMax 안 씀');
    assert.ok(T.warnings.some(w => w.msg === '이번 달 글자 한도를 다 썼어요'));
    assert.equal(Q.quotaOut(), true, '한도는 기억 (Mina 줄을 바로 MiniMax 로)');
    T.el = []; T.warnings.length = 0;
    T.ctx.chat.push({ mes: '"Mina speaks."', name: 'Mina', is_user: false, is_system: false, swipe_id: 0, extra: {} });
    await read(1);
    assert.equal(T.el.length, 0); assert.deepEqual(T.requests.map(r => r.voiceUid), ['minimax:mina-mm']);
    T.el = []; T.requests.length = 0;
    await read(0);
    assert.equal(T.el.length, 0, '칸이 빈 Nora 도 ElevenLabs 에 다시 안 보냄 (실패 요청으로 시간 · 글자 낭비 없음)');
});
await test('이미 만든 ElevenLabs 소리(캐시)는 막힌 뒤에도 그대로 나요 — 새 줄만 MiniMax', async () => {
    await reset(); T.elMode = 'ok';
    await read();
    assert.equal(T.el.length, 2); assert.equal(elPlays().length, 2);
    T.ctx.chat.push({ mes: '"New line."', name: 'Mina', is_user: false, is_system: false, swipe_id: 0, extra: {} });
    T.elMode = 'quota-legacy'; T.el = []; T.plays.length = 0; P.forgetClips();   // 메모리는 비우고 캐시(IndexedDB 자리)만
    await read(1);
    assert.equal(Q.quotaOut(), true);
    T.el = []; T.plays.length = 0; T.requests.length = 0;
    await read(0);
    assert.equal(T.el.length, 0); assert.equal(T.requests.length, 0, '캐시에 있는 줄은 새로 안 만듦');
    assert.equal(elPlays().length, 2, '캐시의 ElevenLabs 소리 그대로');
});
await test('미리 만들기: 막힌 뒤 MiniMax 로 바뀐 줄도 유료 엔진 규칙(pregen_paid 끔이면 안 만듦)', async () => {
    await reset(); Q.tripQuota();
    const s = S.settings();
    const mk = (text) => P._forTest.finishJobs([{ mesId: -1, seg: { kind: 'dialogue', text }, segIndex: 0, parts: [{ seg: { kind: 'dialogue', text }, alt: null, text }], voice: V.findVoice('elevenlabs:mina'), speaker: 'Mina', emotion: '', text, lang: 'en', params: null, provider: null, key: '', audio: null, ctrl: null }], s, { merge: false, quiet: true })[0];
    const j = mk('Pre one.');
    assert.equal(j.provider.id, 'elevenlabs');
    const r = await P.ensureClip(j);
    assert.equal(r.skipped, true); assert.equal(T.el.length, 0); assert.equal(T.requests.length, 0);
    s.pregen_paid = true;
    const j2 = mk('Pre two.');
    const r2 = await P.ensureClip(j2);
    assert.equal(r2.made, true); assert.equal(j2.provider.id, 'minimax'); assert.equal(T.el.length, 0);
    assert.deepEqual(T.requests.map(x => x.voiceUid), ['minimax:mina-mm']);
});

// ---------- 설정 화면 (ui.js — 캐릭터별 목소리 카드)
const UI = (await mod('ui.js'))._forTest;
await test('설정: 끔이면 켬 칸 하나만 · 켜면 ElevenLabs 로 읽는 캐릭터마다 「대신 쓸 MiniMax 목소리」 칸 (MiniMax 목소리만 고르기)', async () => {
    await reset({ enabled: false, map: {} });
    const s = S.settings();
    let html = UI.quotaHtml(s, ['Mina', 'Nora']);
    assert.match(html, /id="lv_qf_on"(?! checked)/); assert.match(html, /ElevenLabs 한도가 다 차면 MiniMax 로 대신 읽기/);
    assert.doesNotMatch(html, /data-lv-qf=/);
    assert.match(UI.mapCardHtml(), /id="lv_qf_on"/, '캐릭터별 목소리 카드 안');
    UI.setQuotaOn(true);
    assert.equal(s.quota_fallback.enabled, true);
    html = UI.quotaHtml(s, ['Mina', 'Nora']);
    assert.match(html, /id="lv_qf_on" checked/);
    assert.match(html, /data-lv-qf="elevenlabs:mina"/); assert.match(html, /data-lv-qf="elevenlabs:nora"/);
    const sel = html.split('data-lv-qf="elevenlabs:mina"')[1].split('</select>')[0];
    assert.match(sel, /\(대신 안 읽음\)/); assert.match(sel, /value="minimax:mina-mm"/); assert.doesNotMatch(sel, /value="elevenlabs:/, 'ElevenLabs 목소리는 고르기에 없음');
    assert.match(html, /data-lv-act="qf-fill"/, '빈 칸이 있으면 채우기 단추');
    // 기본(Mina 목소리)은 Mina 줄과 같은 목소리라 한 줄
    assert.deepEqual(UI.quotaTargets(s, ['Mina', 'Nora']).map(r => [r.voice.uid, r.labels]), [['elevenlabs:mina', ['Mina', '기본']], ['elevenlabs:nora', ['Nora']]]);
});
await test('설정: 「같은 이름 MiniMax 목소리로 채우기」 · 고르기 · 비우기', async () => {
    await reset({ enabled: true, map: {} });
    const s = S.settings();
    UI.fillQuotaVoices();
    assert.deepEqual(s.quota_fallback.map, { 'elevenlabs:mina': 'minimax:mina-mm', 'elevenlabs:nora': 'minimax:nora-mm' });
    UI.setQuotaVoice('elevenlabs:nora', '');
    assert.deepEqual(s.quota_fallback.map, { 'elevenlabs:mina': 'minimax:mina-mm' });
    UI.setQuotaVoice('elevenlabs:nora', 'elevenlabs:mina');
    assert.equal(s.quota_fallback.map['elevenlabs:nora'], undefined, 'MiniMax 목소리만 받음');
    s.voices = s.voices.filter(v => v.provider !== 'elevenlabs');
    assert.equal(UI.quotaHtml(s, ['Mina']), '', 'ElevenLabs 목소리가 없으면 안 보임');
});
await test('설정: 가져온 파일의 quota_fallback 도 정리해서 받아요', async () => {
    await reset({ enabled: false, map: {} });
    UI.importSettings({ quota_fallback: { enabled: 'yes', map: { 'elevenlabs:mina': 'minimax:mina-mm', bad: 1 } } });
    assert.deepEqual(S.settings().quota_fallback, { enabled: false, map: { 'elevenlabs:mina': 'minimax:mina-mm' } });
});

P.stop(); for (const node of T.nodes) node.pause();
console.log(JSON.stringify({ passed, failed, mockOnly: true, sourceRoot: root }, null, 2));
process.exitCode = failed ? 1 : 0;
