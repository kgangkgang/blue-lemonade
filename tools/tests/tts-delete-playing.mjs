// 8.2.7 TTS 읽는 중 메시지 지우기 — 가운데 메시지를 지우면 실리태번이 뒤 번호를 당긴다 (진짜 player.js, 가짜 엔진 · 네트워크 0)
//   ① 읽고 있는 메시지를 지우면(뒤에 메시지가 있어 같은 번호가 남아도) 멈추고 남은 줄을 만들지 않는다
//   ② 앞 메시지를 지워 번호만 당겨진 메시지는 그대로 끝까지 읽는다
//   ③ 뒤에 기다리던(줄 세우기) 다른 메시지가 지워지면 그 줄은 만들지 않고 건너뛴다
//   node tools/tests/tts-delete-playing.mjs [테마 루트]   (시험대는 fault-tts-player.mjs 와 같다 — eventSource 만 처리기를 모은다)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, '../..'), 'src/addons/tts/src');
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const realCache = pathToFileURL(path.join(root, 'cache.js')).href;
const T = globalThis.__deletePlayingTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina', characters: [], groups: [] },
    cache: new Map(), removed: [], saves: 0, requests: [], plays: [], ends: [], downloads: [], warnings: [], nodes: [], urls: new Map(), seq: 0, renders: [], handlers: {} };
T.ctx.saveChat = async () => { T.saves++; };
const G = 'const T = globalThis.__deletePlayingTest;\n';
const stubs = {
    'script.js': data(G + `export const chat=T.ctx.chat; export const event_types={CHAT_CHANGED:'chat',MESSAGE_DELETED:'deleted'};
export const eventSource={on(t,f){(T.handlers[t]||=[]).push(f)},makeLast(){},emit(){},removeListener(){}}; export const substituteParams=t=>String(t??'');
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
async function test(name,fn) { local.delete('lemon_voice.kept_analyses'); /* 7.2.4 분석 보관함(analysis.js keepAnalysis)은 같은 글을 요청 없이 다시 쓴다 — 사례마다 비운다 */ try{await fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack)}finally{P.stop();await sleep(5);} }
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

const six = '"하나." "둘." "셋." "넷." "다섯." "여섯."';
const other = (mes, name = 'Nora') => ({ mes, name, is_user: false, is_system: false, swipe_id: 0, extra: {} });
function deleteAt(i) { T.ctx.chat.splice(i, 1); for (const f of T.handlers.deleted || []) f(T.ctx.chat.length); }
await test('8.2.7 deleting the message being read (middle of chat — same index still exists) stops it; remaining lines are not synthesized', async () => {
    await reset(); const s = S.settings(); s.gap_ms = 0; T.ctx.chat[0].mes = six; T.ctx.chat.push(other('"뒤 메시지."'));
    const orig = Registry.PROVIDERS.minimax.synth;
    Registry.PROVIDERS.minimax.synth = async (args) => { await sleep(30); return orig(args); };
    try {
        assert.ok(P.speakMessage(0, { force: true }));
        await until(() => T.plays.filter(x => x.kind === 'voice').length >= 1, 3000);
        deleteAt(0);
        assert.equal(T.ctx.chat.length, 1, 'the later message now sits at #0');
        await sleep(400);
        assert.equal(P.isPlaying(), false, 'reading stopped');
        assert.ok(T.requests.length <= 3, 'remaining lines of the deleted message were not sent: ' + T.requests.length);
    } finally { Registry.PROVIDERS.minimax.synth = orig; }
});
await test('8.2.7 deleting an earlier message keeps reading the shifted one to the end', async () => {
    await reset(); const s = S.settings(); s.gap_ms = 0;
    T.ctx.chat.unshift(other('"앞 메시지."')); T.ctx.chat.push(other('"뒤 메시지."'));
    T.ctx.chat[1].mes = six;
    assert.ok(P.speakMessage(1, { force: true }));
    await until(() => T.plays.filter(x => x.kind === 'voice').length >= 1, 3000);
    deleteAt(0);
    await idle();
    assert.deepEqual(T.requests.map(r => r.text), ['하나.', '둘.', '셋.', '넷.', '다섯.', '여섯.']);
});
await test('8.2.7 a queued line of another message that got deleted is skipped (not synthesized)', async () => {
    await reset(); const s = S.settings(); s.gap_ms = 0; s.on_new = 'queue';
    T.ctx.chat[0].mes = '"첫째." "둘째." "셋째."'; T.ctx.chat.push(other('"지울 메시지."', 'Mina'), other('"남는 메시지."', 'Mina'));
    const orig = Registry.PROVIDERS.minimax.synth;
    Registry.PROVIDERS.minimax.synth = async (args) => { await sleep(20); return orig(args); };
    try {
        assert.ok(P.speakMessage(0, { force: true }));
        await until(() => T.plays.filter(x => x.kind === 'voice').length >= 1, 3000);
        P.speakMessage(1); P.speakMessage(2);
        deleteAt(1);
        await idle();
        const texts = T.requests.map(r => r.text);
        assert.ok(!texts.includes('지울 메시지.'), 'deleted message was not synthesized: ' + JSON.stringify(texts));
        assert.ok(texts.includes('셋째.') && texts.includes('남는 메시지.'), 'others still read: ' + JSON.stringify(texts));
    } finally { Registry.PROVIDERS.minimax.synth = orig; s.on_new = 'interrupt'; }
});

P.stop(); for (const node of T.nodes) node.pause();
console.log(JSON.stringify({ passed, failed, mockOnly: true, sourceRoot: root }, null, 2));
process.exitCode = failed ? 1 : 0;
