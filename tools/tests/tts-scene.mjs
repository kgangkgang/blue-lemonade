// Isolated Node integration tests. No real chat, engine, file fetch or browser is used.
// Real player/store/text/voices/settings/scene modules; ST, media and cache I/O are mocks.
// Run: node tools/tests/tts-scene.mjs [theme root]
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, '../..'), 'src/addons/tts/src');
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const realCache = pathToFileURL(path.join(root, 'cache.js')).href;
const T = globalThis.__sceneTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina', characters: [], groups: [] },
    cache: new Map(), removed: [], saves: 0, requests: [], plays: [], ends: [], downloads: [], warnings: [], nodes: [], urls: new Map(), seq: 0, renders: [] };
T.ctx.saveChat = async () => { T.saves++; };
const G = 'const T = globalThis.__sceneTest;\n';
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
    P.stop(); await sleep(10); P.forgetClips(); P.forgetFrom(0);T.cache.clear();T.removed.length=T.requests.length=T.plays.length=T.ends.length=T.downloads.length=T.warnings.length=T.renders.length=0;
    const s=S.settings();Object.assign(s,{enabled:true,voices:[voice('mina','Mina'),voice('nora','Nora')],char_map:{Mina:'minimax:mina',Nora:'minimax:nora'},default_voice:'minimax:mina',narrator_voice:'',user_voice:'',prefer_provider:'',normalize:false,dethump:false,emotion_strength:'normal',pregen:'off',prefetch:0,text_source:'original',pron_dict:'',wait_translation:'off',extras:'off',listen_lang:'auto',mini_player:false,highlight:false,master_volume:1,playback_rate:1,gap_ms:0,max_chars:0,
        providers:{minimax:{key:'mock-key',model:'speech-2.8-hd'},elevenlabs:{key:'mock-key',model:'eleven_v3'}},sfx:{enabled:false,auto:false,volume:.5,mode:'overlay',custom:[]},analysis:{...s.analysis,enabled:false},routes:{dialogue:'character',narration:'skip',action:'skip',thought:'skip',user_dialogue:'skip'}});
    T.ctx.chat.length=0;T.ctx.chat.push({mes:'"Hello one." She waits. "Hello two."',name:'Mina',is_user:false,is_system:false,swipe_id:0,extra:{}});T.ctx.name2='Mina';document.body.dataset.generating='false';
    assert.equal(V.allVoices().length,2);
    return P.scriptRows(0);
}
const row=(id,kind,extra={})=>({id,kind,text:kind==='voice'?id:'',speaker:'Mina',voiceUid:'minimax:mina',emotion:'',sourceIndex:null,volume:1,gapMs:0,enabled:true,...extra});
const timelineClip=(kind,seconds,extra={})=>({kind,buffer:{duration:seconds},volume:1,gapMs:0,...extra});
function gate() { let release; const promise=new Promise(r=>release=r);return {promise,release,started:false}; }

await test('baseline scriptRows has voice text and stable source identities',async()=>{const rows=await reset();assert.deepEqual(rows.map(r=>r.text),['Hello one.','Hello two.']);assert.deepEqual(rows.map(r=>r.sourceIndex),[0,2]);assert.equal(new Set(rows.map(r=>r.id)).size,2);});
await test('saving an edited performance never changes the original chat',async()=>{const rows=await reset(),mes=T.ctx.chat[0],before=mes.mes;rows[0].text='Edited one.';rows[0].speaker='Nora';rows[0].voiceUid='minimax:nora';rows[0].emotion='sad';await Store.saveScript(0,rows,Store.scriptIdentity(0));assert.equal(mes.mes,before);assert.equal(P.scriptRows(0)[0].text,'Edited one.');assert.equal(P.scriptRows(0)[0].emotion,'sad');});
await test('ordinary message play uses the saved script in explicit order',async()=>{await reset();const rows=[row('second','voice',{text:'Second first.'}),row('first','voice',{text:'First second.'})];await Store.saveScript(0,rows);assert.equal(P.speakMessage(0,{force:true}),true);await idle();assert.deepEqual(T.plays.filter(x=>x.kind==='voice').map(x=>x.text),['Second first.','First second.']);});
await test('saved empty performance stays silent',async()=>{await reset();await Store.saveScript(0,[]);P.speakMessage(0,{force:true});await idle();assert.equal(T.requests.length,0);assert.equal(T.plays.length,0);});
await test('disabled rows are skipped but explicit single-row preview can audition them',async()=>{await reset();const rows=[row('off','voice',{text:'Disabled line.',enabled:false}),row('on','voice',{text:'Enabled line.'})];await P.speakScript(0,rows);await idle();assert.deepEqual(T.plays.map(x=>x.text),['Enabled line.']);T.plays.length=0;await P.speakScript(0,rows,{rowId:'off'});await idle();assert.deepEqual(T.plays.map(x=>x.text),['Disabled line.']);});
await test('changing the speaker with automatic voice remaps only that row',async()=>{await reset();await P.speakScript(0,[row('n','voice',{text:'Nora speaks.',speaker:'Nora',voiceUid:''})]);await idle();assert.equal(T.requests[0].voiceUid,'minimax:nora');});
await test('explicit voice and emotion reach the engine',async()=>{await reset();await P.speakScript(0,[row('n','voice',{text:'Explicit.',speaker:'Mina',voiceUid:'minimax:nora',emotion:'sad'})]);await idle();assert.equal(T.requests[0].voiceUid,'minimax:nora');assert.equal(T.requests[0].emotion,'sad');});
await test('repeated preview reuses cached audio and regeneration invalidates only the chosen row',async()=>{await reset();const rows=[row('a','voice',{text:'Cache A.'}),row('b','voice',{text:'Cache B.'})];await P.speakScript(0,rows);await idle();assert.equal(T.requests.length,2);await P.speakScript(0,rows);await idle();assert.equal(T.requests.length,2);await P.speakScript(0,rows,{rowId:'a',regenerate:true});await idle();assert.equal(T.requests.length,3);assert.equal(T.requests.at(-1).text,'Cache A.');assert.equal(T.removed.length,1);await P.speakScript(0,rows,{rowId:'b'});await idle();assert.equal(T.requests.length,3);});
await test('gain and playback rate do not spend another synthesis request',async()=>{await reset();const rows=[row('a','voice',{text:'Same audio.'})];await P.speakScript(0,rows);await idle();S.settings().master_volume=.8;S.settings().playback_rate=1.5;rows[0].volume=.5;await P.speakScript(0,rows);await idle();assert.equal(T.requests.length,1);assert.equal(T.plays.at(-1).volume,.4);assert.equal(T.plays.at(-1).rate,1.5);});
await test('manual effects play while automatic effects are off, with no synthesis call',async()=>{await reset();await P.speakScript(0,[row('fx','sfx',{sfxId:'door_slam',mode:'sequence'})]);await idle();assert.equal(T.requests.length,0);assert.equal(T.plays[0].sfxId,'door_slam');assert.equal(T.plays[0].volume,.5);});
await test('automatic message reading obeys the effects toggle for stored scripts',async()=>{await reset();await Store.saveScript(0,[row('fx','sfx',{sfxId:'door_slam',mode:'sequence'}),row('a','voice')]);P.speakMessage(0,{force:true});await idle();assert.deepEqual(T.plays.map(x=>x.kind),['voice']);T.plays.length=0;S.settings().sfx.enabled=true;P.speakMessage(0,{force:true});await idle();assert.deepEqual(T.plays.map(x=>x.kind),['sfx','voice']);});
await test('sequence waits for the sound; overlay lets the next voice begin before its end',async()=>{await reset();await P.speakScript(0,[row('fx','sfx',{sfxId:'knock',mode:'sequence'}),row('v','voice')]);await idle();assert.ok(T.plays.find(x=>x.kind==='voice').at>=T.ends.find(x=>x.kind==='sfx').at);await reset();await P.speakScript(0,[row('fx','sfx',{sfxId:'knock',mode:'overlay'}),row('v','voice')]);await idle();assert.ok(T.plays.find(x=>x.kind==='voice').at<T.ends.find(x=>x.kind==='sfx').at);});
await test('explicit silence is honored between voice rows',async()=>{await reset();await P.speakScript(0,[row('a','voice'),row('pause','pause',{gapMs:70}),row('b','voice')]);await idle();assert.ok(T.plays[1].at-T.ends[0].at>=60);});
await test('stopping a looping row releases media URLs and prevents following speech',async()=>{await reset();await P.speakScript(0,[row('fx','sfx',{sfxId:'wind',mode:'loop'}),row('pause','pause',{gapMs:300}),row('no','voice')]);await until(()=>T.plays.some(p=>p.loop));P.stop();await sleep(40);assert.equal(T.requests.length,0);assert.equal(T.urls.size,0);assert.ok(T.nodes.every(n=>n.paused));});
await test('translation/swipe/source changes reject saved performance reuse',async()=>{const rows=await reset();await Store.saveScript(0,[{...rows[0],text:'Saved edit.'}]);assert.equal(P.scriptRows(0)[0].text,'Saved edit.');T.ctx.chat[0].extra.display_text='번역 새로';assert.notEqual(P.scriptRows(0)[0].text,'Saved edit.');delete T.ctx.chat[0].extra.display_text;T.ctx.chat[0].swipe_id=1;assert.notEqual(P.scriptRows(0)[0].text,'Saved edit.');T.ctx.chat[0].swipe_id=0;T.ctx.chat[0].mes='"Different source."';assert.equal(P.scriptRows(0)[0].text,'Different source.');});
await test('WAV save uses row order/gains, fixed original speed and a proper stereo header',async()=>{await reset();S.settings().master_volume=.8;S.settings().playback_rate=2;const rows=[row('fx','sfx',{sfxId:'bell',mode:'overlay',volume:.5}),row('v','voice',{volume:.25,text:'WAV voice.'})];assert.equal(await P.downloadScript(0,rows),true);assert.equal(T.downloads.length,1);const output=T.downloads[0].blob;assert.equal(output.type,'audio/wav');const bytes=await output.arrayBuffer(),dv=new DataView(bytes);assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.equal(dv.getUint16(22,true),2);assert.equal(dv.getUint32(24,true),44100);const sources=T.renders.at(-1).sources;assert.deepEqual(sources.map(s=>s.buffer.payload.kind),['sfx','voice']);assert.equal(sources[0].playbackRate.value,1);assert.equal(sources[0].gain.gain.values[0][0],.2);assert.equal(sources[1].gain.gain.values[0][0],.2);assert.ok(T.downloads[0].filename.endsWith('.wav'));});

await test('timeline: voice / sequence / overlay / silence use the same cursor model',()=>{const result=Mix.sceneTimeline([timelineClip('voice',2,{gapMs:200}),timelineClip('sfx',1,{mode:'overlay'}),timelineClip('sfx',.5,{mode:'sequence',gapMs:100}),{kind:'pause',gapMs:500},timelineClip('voice',1)]);assert.deepEqual(result.events.map(e=>Math.round(e.start*100)/100),[0,2.2,2.2,3.3]);assert.equal(Math.round(result.duration*100)/100,4.3);});
await test('timeline: master / row / effects gain and loop attenuation are independent',()=>{const r=Mix.sceneTimeline([timelineClip('sfx',1,{mode:'loop',volume:.5}),timelineClip('voice',2,{volume:.5}),timelineClip('sfx',1,{mode:'sequence',volume:.5})],{master:.8,sfxVolume:.5,rate:2});assert.deepEqual(r.events.map(e=>e.gain),[.06,.4,.2]);assert.deepEqual(r.events.map(e=>e.rate),[2,2,2]);assert.equal(r.duration,1.5);assert.equal(r.events[0].duration,1.5);});
await test('timeline: pause duration is wall time, not divided by playback rate',()=>{const r=Mix.sceneTimeline([{kind:'pause',gapMs:1000},timelineClip('voice',2)],{rate:2});assert.equal(r.events[0].start,1);assert.equal(r.duration,2);});
await test('timeline: trailing voice gap is omitted and lone loops are bounded to five seconds',()=>{assert.equal(Mix.sceneTimeline([timelineClip('voice',1,{gapMs:1000})]).duration,1);const r=Mix.sceneTimeline([timelineClip('sfx',1,{mode:'loop',sfxId:'wind'})]);assert.equal(r.duration,5);assert.equal(r.events[0].duration,5);});
await test('timeline: duplicate loop ids reuse one sound',()=>{const r=Mix.sceneTimeline([timelineClip('sfx',1,{mode:'loop',sfxId:'wind'}),timelineClip('voice',1),timelineClip('sfx',1,{mode:'loop',sfxId:'wind'}),timelineClip('voice',1)]);assert.equal(r.events.filter(e=>e.loop&&e.sfxId==='wind').length,1);});
await test('timeline: fourth unique loop replaces the oldest to match live playback',()=>{const clips=[];for(const id of ['wind','thunder','footsteps','bell']){clips.push(timelineClip('sfx',1,{mode:'loop',sfxId:id}),timelineClip('voice',1));}const r=Mix.sceneTimeline(clips),loops=r.events.filter(e=>e.loop);assert.equal(loops.length,4);assert.equal(loops[0].start,0);assert.equal(loops[0].duration,3);assert.equal(loops.at(-1).sfxId,'bell');assert.equal(loops.at(-1).start,3);});
await test('timeline: clamps unsafe values and rejects exports longer than ten minutes',()=>{const r=Mix.sceneTimeline([timelineClip('voice',1,{volume:50})],{rate:100,master:100});assert.equal(r.events[0].gain,1);assert.equal(r.events[0].rate,2);assert.throws(()=>Mix.sceneTimeline([timelineClip('voice',601)]),/10분/);});
await test('live effects controller deduplicates loops and replaces the oldest fourth loop',async()=>{await reset();const existingUrls=T.urls.size,c=Sfx.createSfxController();const one=await c.play('wind',{loop:true}),same=await c.play('wind',{loop:true});assert.equal(one,same);await c.play('thunder',{loop:true});await c.play('footsteps',{loop:true});await c.play('bell',{loop:true});assert.equal(await one.done,'stopped');assert.equal(T.plays.filter(p=>p.loop).length,4);c.stopAll();assert.equal(T.urls.size,existingUrls);});
await test('stop during pending effect fetch allows a new voice immediately and drops the late sound',async()=>{await reset();const g=gate();T.sfxGate=g;await P.speakScript(0,[row('slow','sfx',{sfxId:'wind',mode:'sequence'})]);await until(()=>g.started);P.stop();await P.speakScript(0,[row('fresh','voice',{text:'Fresh voice.'})]);await until(()=>T.plays.some(p=>p.text==='Fresh voice.'));g.release();T.sfxGate=null;await idle();assert.ok(T.plays.every(p=>p.kind!=='sfx'));});
await test('stop during WAV rendering cancels the eventual download',async()=>{await reset();const g=gate();T.renderGate=g;const pending=P.downloadScript(0,[row('a','voice',{text:'Cancel render.'})]);await until(()=>g.started);P.stop();g.release();await assert.rejects(pending,/멈췄/);T.renderGate=null;assert.equal(T.downloads.length,0);});
await test('message replacement during WAV rendering cancels the eventual download',async()=>{await reset();const g=gate();T.renderGate=g;const pending=P.downloadScript(0,[row('a','voice',{text:'Changing chat.'})]);await until(()=>g.started);T.ctx.chat[0]={mes:'"Replacement."',name:'Mina',extra:{}};g.release();await assert.rejects(pending,/채팅이 바뀌어/);T.renderGate=null;assert.equal(T.downloads.length,0);});
await test('browser voice honors row volume and cannot be exported as WAV',async()=>{await reset();const spoken=[];globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};globalThis.speechSynthesis={paused:false,speaking:false,getVoices:()=>[{voiceURI:'unit-browser',name:'Unit browser',lang:'en-US'}],speak(u){spoken.push(u);setTimeout(()=>u.onend?.(),15)},cancel(){},pause(){},resume(){},addEventListener(){},removeEventListener(){}};
    S.settings().voices.push({uid:'browser:unit-browser',provider:'browser',voiceId:'unit-browser',name:'Unit browser',aliases:[],params:{rate:1,pitch:1},mix:[]});S.settings().master_volume=.8;S.settings().playback_rate=1.5;const rows=[row('browser','voice',{voiceUid:'browser:unit-browser',text:'Browser row.',volume:.25})];await P.speakScript(0,rows);await idle();assert.equal(spoken.length,1);assert.equal(spoken[0].volume,.2);assert.equal(spoken[0].rate,1.5);assert.equal(T.requests.length,0);await assert.rejects(P.downloadScript(0,rows),/브라우저 내장 목소리/);});
await test('splitting a long row applies its trailing silence only once after the last chunk',async()=>{await reset();const provider=Registry.PROVIDERS.minimax,prior=provider.maxChars;provider.maxChars=8;try{await P.downloadScript(0,[row('long','voice',{text:'First. Second. Third.',gapMs:250}),row('next','voice',{text:'Next.'})]);const sources=T.renders.at(-1).sources;assert.deepEqual(sources.map(s=>s.buffer.payload.text),['First.','Second.','Third.','Next.']);assert.equal(Math.round(sources.at(-1).startAt*100)/100,.43);}finally{provider.maxChars=prior;}});
await test('translation replacement during WAV rendering cancels the eventual download',async()=>{await reset();const g=gate();T.renderGate=g;const pending=P.downloadScript(0,[row('a','voice',{text:'Translation changes.'})]);await until(()=>g.started);T.ctx.chat[0].extra.display_text='새 번역문';g.release();await assert.rejects(pending,/채팅|바뀌|번역/);T.renderGate=null;assert.equal(T.downloads.length,0);});
await test('same-text swipe change during WAV rendering cancels the eventual download',async()=>{await reset();const g=gate();T.renderGate=g;const pending=P.downloadScript(0,[row('a','voice',{text:'Swipe changes.'})]);await until(()=>g.started);T.ctx.chat[0].swipe_id=1;g.release();await assert.rejects(pending,/채팅|바뀌|스와이프/);T.renderGate=null;assert.equal(T.downloads.length,0);});
await test('store save failures restore only the attempted record and leave original text intact',async()=>{await reset();const mes=T.ctx.chat[0],before=mes.mes,save=T.ctx.saveChat;await Store.saveScript(0,[row('first','voice')]);const stored=mes.extra.lemon_voice_script;T.ctx.saveChat=async()=>{throw Error('Synthetic disk failure')};try{await assert.rejects(Store.saveScript(0,[row('later','voice')]),/저장에 실패/);assert.equal(mes.extra.lemon_voice_script,stored);assert.equal(mes.mes,before);}finally{T.ctx.saveChat=save;}});
await test('store rejects stale message identity and ignores unsafe unrecognized row fields',async()=>{await reset();const identity=Store.scriptIdentity(0),clean=Store.normalizeRows([row('safe','voice',{text:'<img onerror=alert(1)>',untrustedHtml:'<script>bad()</script>'})]);assert.equal(clean[0].text,'<img onerror=alert(1)>');assert.ok(!Object.hasOwn(clean[0],'untrustedHtml'));T.ctx.chat[0]={mes:identity.message.mes,name:'Mina',extra:{}};await assert.rejects(Store.saveScript(0,clean,identity),/채팅이나 원문/);assert.equal(T.ctx.chat[0].extra.lemon_voice_script,undefined);});

await test('turning automatic effects off stops a running loop, preserves speech and skips later effects',async()=>{
    await reset();S.settings().sfx.enabled=true;
    await Store.saveScript(0,[row('wind','sfx',{sfxId:'wind',mode:'loop'}),row('voice','voice',{text:'Keep speaking.'}),row('wait','pause',{gapMs:70}),row('later','sfx',{sfxId:'bell',mode:'sequence'}),row('after','voice',{text:'Still speaking.'})]);
    P.speakMessage(0,{force:true});await until(()=>T.plays.some(p=>p.text==='Keep speaking.'));
    const firstVoice=T.plays.find(p=>p.text==='Keep speaking.').node,loop=T.plays.find(p=>p.loop).node;
    S.settings().sfx.enabled=false;P.applyPlayback();assert.equal(loop.paused,true);assert.equal(firstVoice.paused,false);
    await idle();assert.deepEqual(T.plays.filter(p=>p.kind==='sfx').map(p=>p.sfxId),['wind']);assert.deepEqual(T.plays.filter(p=>p.kind==='voice').map(p=>p.text),['Keep speaking.','Still speaking.']);
});
await test('turning automatic effects off stops overlay tails without stopping the voice',async()=>{
    await reset();S.settings().sfx.enabled=true;await Store.saveScript(0,[row('knock','sfx',{sfxId:'knock',mode:'overlay'}),row('voice','voice',{text:'Overlay speech.'})]);
    P.speakMessage(0,{force:true});await until(()=>T.plays.some(p=>p.kind==='voice'));const effect=T.plays.find(p=>p.kind==='sfx').node,voice=T.plays.find(p=>p.kind==='voice').node;
    S.settings().sfx.enabled=false;P.applyPlayback();assert.equal(effect.paused,true);assert.equal(voice.paused,false);await idle();
});
await test('turning automatic effects off releases pending loading and never plays the late sound',async()=>{
    await reset();S.settings().sfx.enabled=true;const g=gate();T.sfxGate=g;
    await Store.saveScript(0,[row('slow','sfx',{sfxId:'wind',mode:'sequence'}),row('voice','voice',{text:'Continue without the effect.'})]);
    P.speakMessage(0,{force:true});await until(()=>g.started);S.settings().sfx.enabled=false;P.applyPlayback();
    await until(()=>T.plays.some(p=>p.kind==='voice'));g.release();T.sfxGate=null;await idle();assert.ok(T.plays.every(p=>p.kind!=='sfx'));
});
await test('manual editor effects continue while automatic effects are off, including gain changes',async()=>{
    await reset();await P.speakScript(0,[row('wind','sfx',{sfxId:'wind',mode:'loop'}),row('pause','pause',{gapMs:100}),row('voice','voice')]);
    await until(()=>T.plays.some(p=>p.loop));const loop=T.plays.find(p=>p.loop).node;S.settings().master_volume=.8;P.applyPlayback();assert.equal(loop.paused,false);assert.equal(loop.volume,.12);await idle();
});
await test('ordinary WAV excludes effects when automatic effects are off; explicit editor WAV retains them',async()=>{
    await reset();const rows=[row('bell','sfx',{sfxId:'bell',mode:'overlay'}),row('voice','voice',{text:'Export respects its entry point.'})];await Store.saveScript(0,rows);
    assert.equal(await P.downloadMessage(0),true);assert.deepEqual(T.renders.at(-1).sources.map(s=>s.buffer.payload.kind),['voice']);
    assert.equal(await P.downloadScript(0,rows),true);assert.deepEqual(T.renders.at(-1).sources.map(s=>s.buffer.payload.kind),['sfx','voice']);
    S.settings().sfx.enabled=true;assert.equal(await P.downloadMessage(0),true);assert.deepEqual(T.renders.at(-1).sources.map(s=>s.buffer.payload.kind),['sfx','voice']);
});

await test('muted specific everyday sound never falls back to a generic water sound',async()=>{
    await reset();assert.equal(Library.listSfx().length,81);assert.equal(Library.matchSfx('pour water').id,'daily_water_pour');
    Library.setSfxEnabled('daily_water_pour',false);assert.equal(Library.matchSfx('pour water'),null);assert.ok(Library.getSfx('daily_water_pour'));assert.ok(await Library.sfxBlob('daily_water_pour'));
    assert.equal(Library.matchSfx('비가 내린다').id,'daily_rain');assert.equal(Library.matchSfx('키보드를 타이핑한다').id,'daily_keyboard');
});
await test('1.5.3 everyday sounds match concrete actions only and carry CC0 credits',async()=>{
    await reset();
    for(const [text,id] of [['휴대폰 진동이 울렸다.','daily_phone_vibration'],['핸드폰이 떨렸다.','daily_phone_vibration'],['의자를 끌어 앉았다.','daily_chair_slide'],['펜 뚜껑을 닫았다.','daily_pen_cap'],['냉장고 문을 열었다.','daily_fridge_door'],['전기주전자가 끓기 시작했다.','daily_electric_kettle'],['양치질을 했다.','daily_toothbrush'],['이를 닦았다.','daily_toothbrush'],['The electric kettle boiled.','daily_electric_kettle'],['She brushed her teeth.','daily_toothbrush']])
        assert.equal(Library.matchSfx(text)?.id,id,text);
    assert.equal(Library.matchSfx('휴대폰이 울렸다.'),null);assert.equal(Library.matchSfx('전기주전자를 샀다.'),null);assert.equal(Library.matchSfx('주전자를 꺼냈다.')?.id,'pot');
    for(const id of ['daily_phone_vibration','daily_chair_slide','daily_pen_cap','daily_fridge_door','daily_electric_kettle','daily_toothbrush']){
        const sound=Library.getSfx(id);assert.ok(sound&&!sound.custom&&sound.loop===false&&sound.credit.author==='Joseph SARDIN'&&sound.credit.license==='CC0-1.0'&&sound.assetPath===`../sfx-extra/${id}.mp3`,id);
        assert.ok((await Library.sfxBlob(id)).size>0,id);assert.ok(Library.sfxAttribution([id]).includes('bigsoundbank.com'),id);
    }
});
await test('1.5.4 tapping a dialogue plays the cues of the narration right before it even when narration is skipped',async()=>{
    await reset();const s=S.settings();Object.assign(s.sfx,{enabled:true,auto:true});s.routes={dialogue:'character',narration:'skip',action:'skip',thought:'skip',user_dialogue:'user'};
    s.analysis={...s.analysis,enabled:true,engine:'compat',base:'https://mock.invalid/v1',key:'k',model:'m',emotion:true,translate:false,speaker:true,when:'auto',context_chars:1200,temperature:0.2};
    const mes={mes:'문이 열렸다. "안녕." 그가 의자를 끌고 앉았다. "앉아." 휴대폰이 두 번 진동했다.',name:'Mina',is_user:false,is_system:false,swipe_id:0,extra:{}};
    T.ctx.chat.length=0;T.ctx.chat.push(mes);
    const p=A.buildPrompt(mes,{langs:[],emotion:true,translate:false,context_chars:1200,speaker:true,extras:s.extras!=='off',sfx:true});
    mes.extra.lemon_voice={analysis:{hash:A.hash(mes.mes),profile:A.hash(JSON.stringify([1,'compat','','m',true,false,0.2,p.system,p.user])),langs:[],model:'m',at:1,
        segs:p.lines.map(l=>({i:l.i,h:l.h,emotion:'calm',text:{}})),sfx:[{after:0,id:'door_open',repeats:1,durationMs:0},{after:1,id:'daily_chair_slide',repeats:1,durationMs:0},{after:2,id:'daily_phone_vibration',repeats:2,durationMs:0}]}};
    assert.ok(A.getAnalysis(0));
    const tap=(text,dialogueIndex)=>({kind:'dialogue',text,raw:text,color:null,tags:[],speakerHint:null,line:0,dialogueIndex});
    assert.ok(P.speakSegments(0,[tap('앉아.',1)]));await until(()=>T.plays.some(x=>x.kind==='voice'));await idle();
    assert.deepEqual(T.plays.map(x=>x.kind==='sfx'?x.sfxId:'voice'),['daily_chair_slide','voice','daily_phone_vibration','daily_phone_vibration']);   // 앞 지문의 의자 소리, 마지막 대사라 뒤 지문의 진동(2회)도 이어서 (문 소리는 첫 대사 앞)
    await reset();T.ctx.chat.length=0;T.ctx.chat.push(mes);Object.assign(S.settings().sfx,{enabled:true,auto:true,tap:false});S.settings().routes.narration='skip';S.settings().analysis={...S.settings().analysis,enabled:true,engine:'compat',base:'https://mock.invalid/v1',key:'k',model:'m',emotion:true,translate:false,speaker:true,when:'auto',context_chars:1200,temperature:0.2};
    assert.ok(P.speakSegments(0,[tap('앉아.',1)]));await until(()=>T.plays.some(x=>x.kind==='voice'));await idle();
    assert.deepEqual(T.plays.map(x=>x.kind),['voice']);   // 토글을 끄면 전처럼 대사만
});
await test('1.5.4 readText reads another extension\'s text like a message: dialogue only by default, mapped voices, no network beyond synthesis',async()=>{
    await reset();S.settings().routes={dialogue:'character',narration:'skip',action:'skip',thought:'skip',user_dialogue:'user'};
    assert.equal(P.speakExternal({text:'Nora walked in. "Hello there." She smiled. "Bye."',name:'Nora'}),true);
    await until(()=>T.plays.length>=1);await idle();
    const spoken=T.requests.map(r=>r.text).join(' ');   // 같은 목소리의 이어진 대사는 한 덩이로 합쳐질 수 있다
    assert.ok(spoken.includes('Hello there.')&&spoken.includes('Bye.')&&!/walked|smiled/.test(spoken),spoken);assert.ok(T.requests.length&&T.requests.every(r=>r.voiceUid==='minimax:nora'));
    assert.equal(P.speakExternal({text:'   '}),false);
});
await test('1.6.0 a translation that lands after or during the analysis keeps the stored analysis; keys saved with the translation still match',async()=>{
    await reset();const s=S.settings();Object.assign(s.sfx,{enabled:true,auto:true,level:'normal'});s.routes={dialogue:'character',narration:'skip',action:'skip',thought:'skip',user_dialogue:'user'};
    s.analysis={...s.analysis,enabled:true,engine:'compat',base:'https://mock.invalid/v1',key:'k',model:'m',emotion:true,translate:false,speaker:true,when:'auto',context_chars:1200,temperature:0.2};
    const mes={mes:'The door slammed. "Hello." He raised his glass. "Sit down."',name:'Mina',is_user:false,is_system:false,swipe_id:0,extra:{}};T.ctx.chat.length=0;T.ctx.chat.push(mes);
    const opts={langs:[],emotion:true,translate:false,context_chars:1200,speaker:true,extras:s.extras!=='off',sfx:true};
    const p0=A.buildPrompt(mes,opts);const key=p=>A.hash(JSON.stringify([1,'compat','','m',true,false,0.2,p.system,p.user]));
    const seed=profile=>{mes.extra.lemon_voice={analysis:{hash:A.hash(mes.mes),profile,langs:[],model:'m',at:1,segs:p0.lines.map(l=>({i:l.i,h:l.h,emotion:'calm',text:{}})),sfx:[{after:0,id:'door_slam',repeats:1,durationMs:0,strength:1}]}};};
    seed(key(p0));assert.ok(A.getAnalysis(0)&&P.analysisWanted(0,mes)===false,'valid before the translation');
    mes.extra.display_text='문이 쾅 닫혔다. "안녕." 그가 잔을 들었다. "앉아."';
    const p1=A.buildPrompt(mes,opts);assert.ok(p1.user!==p0.user&&p1.user.includes('안녕'),'the request still carries the on-screen translation');
    assert.equal(A.buildPrompt(mes,{...opts,display:false}).user,p0.user,'display:false builds the cache-key prompt without the translation');
    assert.ok(A.getAnalysis(0)&&P.analysisWanted(0,mes)===false,'the translation landing does not invalidate the analysis');
    seed(key(p1));assert.ok(A.getAnalysis(0)&&P.analysisWanted(0,mes)===false,'a key saved with the translation (before 1.6.0) still matches');
    seed('x'.repeat(64));assert.ok(!A.getAnalysis(0)&&P.analysisWanted(0,mes)===true,'other keys still miss');
});
await test('1.5.9 sustained cues loop under the tapped line; ongoing cues cover later lines and stop at stopAfter; export cuts the loop there',async()=>{
    const routes={dialogue:'character',narration:'skip',action:'skip',thought:'skip',user_dialogue:'user'};
    const seed=async(text,sfx)=>{await reset();const s=S.settings();Object.assign(s.sfx,{enabled:true,auto:true,mode:'overlay',level:'normal'});s.routes=routes;
        s.analysis={...s.analysis,enabled:true,engine:'compat',base:'https://mock.invalid/v1',key:'k',model:'m',emotion:true,translate:false,speaker:true,when:'auto',context_chars:1200,temperature:0.2};
        const mes={mes:text,name:'Mina',is_user:false,is_system:false,swipe_id:0,extra:{}};T.ctx.chat.length=0;T.ctx.chat.push(mes);
        const p=A.buildPrompt(mes,{langs:[],emotion:true,translate:false,context_chars:1200,speaker:true,extras:s.extras!=='off',sfx:true});
        mes.extra.lemon_voice={analysis:{hash:A.hash(mes.mes),profile:A.hash(JSON.stringify([1,'compat','','m',true,false,0.2,p.system,p.user])),langs:[],model:'m',at:1,segs:p.lines.map(l=>({i:l.i,h:l.h,emotion:'calm',text:{}})),sfx}};
        assert.ok(A.getAnalysis(0));return mes;};
    const tap=(text,i)=>({kind:'dialogue',text,raw:text,color:null,tags:[],speakerHint:null,line:0,dialogueIndex:i});
    // 지속 가능한 소리(길이 없음)는 누른 대사 동안 반복
    await seed('"안녕." 그가 한동안 키보드를 두드렸다. "앉아."',[{after:1,id:'daily_keyboard',repeats:1,durationMs:0,strength:2}]);
    assert.ok(P.speakSegments(0,[tap('앉아.',1)]));await until(()=>T.plays.some(x=>x.kind==='voice'));await idle();
    const kb=T.plays.find(x=>x.kind==='sfx');assert.ok(kb&&kb.loop===true&&kb.node.paused,'keyboard looped under the line and stopped at its end');
    // 이어지는 동작: 범위 안의 어느 대사를 눌러도, 멈추는 자리부터는 안 깔린다
    const text='"하나." 그가 그녀를 찰싹찰싹 때리기 시작했다. "둘." "셋." 그는 멈췄다. "넷."';
    await seed(text,[{after:1,id:'daily_spanking',repeats:1,durationMs:0,strength:2,ongoing:true,stopAfter:3}]);
    assert.ok(P.speakSegments(0,[tap('셋.',2)]));await until(()=>T.plays.some(x=>x.kind==='voice'));await idle();
    assert.deepEqual(T.plays.map(x=>x.kind==='sfx'?x.sfxId+(x.loop?':loop':''):'voice'),['daily_spanking:loop','voice']);
    await seed(text,[{after:1,id:'daily_spanking',repeats:1,durationMs:0,strength:2,ongoing:true,stopAfter:3}]);
    assert.ok(P.speakSegments(0,[tap('넷.',3)]));await until(()=>T.plays.some(x=>x.kind==='voice'));await idle();
    assert.deepEqual(T.plays.map(x=>x.kind),['voice']);
    // 메시지 전체 읽기: 반복 줄 + 멈추는 대사 앞에서 끔 (대본 줄 stopBefore · 저장도 같은 자리)
    const mes=await seed(text,[{after:1,id:'daily_spanking',repeats:1,durationMs:0,strength:2,ongoing:true,stopAfter:3}]);
    const rows=P.scriptRows(0);const fx=rows.find(r=>r.kind==='sfx');
    assert.equal(fx.mode,'loop');assert.ok(Number.isInteger(fx.stopBefore)&&fx.stopBefore===rows.find(r=>r.kind==='voice'&&r.text==='넷.').sourceIndex,'stopBefore points at the fourth line');
    P.speakMessage(0,{force:true});await until(()=>T.plays.filter(x=>x.kind==='voice').length>=4);await idle();
    const loop=T.plays.find(x=>x.kind==='sfx');const fourth=T.plays.find(x=>x.kind==='voice'&&x.text==='넷.');
    assert.ok(loop&&loop.loop===true&&loop.pausedAt!=null&&fourth&&loop.pausedAt<=fourth.at+1,'loop stopped before the fourth line started');
    await P.downloadScript(0,rows);const tl=T.renders.at(-1).sources;assert.ok(tl.length>=5,'export rendered voices and the loop');
});
await test('1.5.7 effects level filters stored cues at playback without touching the analysis; export keeps at least normal',async()=>{
    await reset();const s=S.settings();Object.assign(s.sfx,{enabled:true,auto:true,level:'normal'});s.routes={dialogue:'character',narration:'skip',action:'skip',thought:'skip',user_dialogue:'user'};
    s.analysis={...s.analysis,enabled:true,engine:'compat',base:'https://mock.invalid/v1',key:'k',model:'m',emotion:true,translate:false,speaker:true,when:'auto',context_chars:1200,temperature:0.2};
    const mes={mes:'문이 쾅 닫혔다. "안녕." 그가 잔을 들었다. "앉아." 옷자락이 스쳤다.',name:'Mina',is_user:false,is_system:false,swipe_id:0,extra:{}};
    T.ctx.chat.length=0;T.ctx.chat.push(mes);
    const p=A.buildPrompt(mes,{langs:[],emotion:true,translate:false,context_chars:1200,speaker:true,extras:s.extras!=='off',sfx:true});
    const analysis={hash:A.hash(mes.mes),profile:A.hash(JSON.stringify([1,'compat','','m',true,false,0.2,p.system,p.user])),langs:[],model:'m',at:1,segs:p.lines.map(l=>({i:l.i,h:l.h,emotion:'calm',text:{}})),
        sfx:[{after:0,id:'door_slam',repeats:1,durationMs:0,strength:1},{after:1,id:'glass_clink',repeats:1,durationMs:0,strength:2},{after:2,id:'daily_zipper',repeats:1,durationMs:0,strength:3}]};
    mes.extra.lemon_voice={analysis};
    const ids=()=>P.scriptRows(0).filter(r=>r.kind==='sfx').map(r=>r.sfxId);
    assert.deepEqual(ids(),['door_slam','glass_clink']);
    s.sfx.level='few';assert.deepEqual(ids(),['door_slam']);assert.ok(A.getAnalysis(0)&&P.analysisWanted(0,mes)===false,'level change keeps the analysis');
    assert.deepEqual(P.scriptRows(0,{forExport:true}).filter(r=>r.kind==='sfx').map(r=>r.sfxId),['door_slam','glass_clink']);
    s.sfx.level='many';assert.deepEqual(ids(),['door_slam','glass_clink','daily_zipper']);
    s.sfx.level='normal';
    assert.deepEqual(A.normalizeSfx([{after:0,id:'door_slam',strength:9},{after:0,id:'knock',strength:3},{after:1,id:'paper'}],p).map(c=>c.strength),[2,3,2]);
    assert.ok(Library.matchSfx('그가 뺨을 찰싹 때렸다').id==='daily_slap'&&Library.matchSfx('엉덩이를 찰싹 때렸다').id==='daily_spanking'&&Library.matchSfx('He slapped her.').id==='daily_slap'&&Library.matchSfx('주먹으로 때렸다').id==='punch');
    assert.deepEqual(['그가 그녀의 목을 핥았다','그는 그녀를 핥아대기 시작했다','그녀가 그에게 키스했다','깊은 키스를 나눴다','찔꺽 소리가 났다','찔꺽찔꺽 젖은 소리가 이어졌다','침대가 삐걱했다','침대가 삐걱거렸다','그는 꿀꺽 침을 삼켰다','꿀꺽꿀꺽 들이켰다','She licked her lips.','He kept licking her.','He kissed her.','They were making out.','The bed creaked.','The bed was creaking rhythmically.','He gulped.','She was gulping it down.'].map(t=>Library.matchSfx(t)?.id),['daily_lick','daily_licking','daily_kiss','daily_kissing','daily_squelch','daily_squelching','daily_bed_creak','daily_bed_creaking','daily_gulp','daily_gulping','daily_lick','daily_licking','daily_kiss','daily_kissing','daily_bed_creak','daily_bed_creaking','daily_gulp','daily_gulping'],'1.6.0 intimate sounds match by keyword (sustained rows win ties)');
});
await test('1.5.6 tapping the last dialogue also plays the cues of the narration after it',async()=>{
    await reset();const s=S.settings();Object.assign(s.sfx,{enabled:true,auto:true,mode:'overlay'});s.routes={dialogue:'character',narration:'skip',action:'skip',thought:'skip',user_dialogue:'user'};
    s.analysis={...s.analysis,enabled:true,engine:'compat',base:'https://mock.invalid/v1',key:'k',model:'m',emotion:true,translate:false,speaker:true,when:'auto',context_chars:1200,temperature:0.2};
    const mes={mes:'"안녕." 그가 나가며 문을 닫았다.',name:'Mina',is_user:false,is_system:false,swipe_id:0,extra:{}};
    T.ctx.chat.length=0;T.ctx.chat.push(mes);
    const p=A.buildPrompt(mes,{langs:[],emotion:true,translate:false,context_chars:1200,speaker:true,extras:s.extras!=='off',sfx:true});
    mes.extra.lemon_voice={analysis:{hash:A.hash(mes.mes),profile:A.hash(JSON.stringify([1,'compat','','m',true,false,0.2,p.system,p.user])),langs:[],model:'m',at:1,segs:p.lines.map(l=>({i:l.i,h:l.h,emotion:'calm',text:{}})),sfx:[{after:1,id:'door_close',repeats:1,durationMs:0}]}};
    assert.ok(A.getAnalysis(0));
    assert.ok(P.speakSegments(0,[{kind:'dialogue',text:'안녕.',raw:'안녕.',color:null,tags:[],speakerHint:null,line:0,dialogueIndex:0}]));
    await until(()=>T.plays.length>=2);await idle();
    assert.deepEqual(T.plays.map(x=>x.kind==='sfx'?x.sfxId:'voice'),['voice','door_close']);
});
await test('1.5.5 readText with only reads just the tapped dialogue, by text or by dialogue index, through the message pipeline',async()=>{
    const routes={dialogue:'character',narration:'skip',action:'skip',thought:'skip',user_dialogue:'user'};
    const text='Nora walked in. "Hello there." She smiled. "Bye now."';
    await reset();S.settings().routes=routes;
    assert.equal(P.speakExternal({text,name:'Nora',only:{text:'She smiled. "Bye now."',index:1}}),true);
    await until(()=>T.plays.length>=1);await idle();
    assert.deepEqual(T.requests.map(r=>r.text),['Bye now.']);
    await reset();S.settings().routes=routes;
    assert.equal(P.speakExternal({text,name:'Nora',only:{text:'번역된 글 (원문과 다름)',index:0}}),true);   // 글이 안 맞으면 차례로
    await until(()=>T.plays.length>=1);await idle();
    assert.deepEqual(T.requests.map(r=>r.text),['Hello there.']);
    assert.equal(P.speakExternal({text,name:'Nora',only:{text:'nothing',index:9}}),false);
    const a=A.registerExternal({text,name:'Nora'}),b=A.registerExternal({text,name:'Nora'}),c=A.registerExternal({text,name:'Other'});
    assert.ok(a.id<-1&&a.id===b.id&&a.mes===b.mes&&c.id!==a.id&&A.externalMessage(a.id)===a.mes);
});
await test('disabled preference is serializable and excludes manual playback and WAV while preserving speech',async()=>{
    await reset();Library.setSfxEnabled('knock',false);assert.ok(JSON.parse(JSON.stringify(S.settings())).sfx.disabled.includes('knock'));
    const rows=[row('fx','sfx',{sfxId:'knock'}),row('voice','voice')];await P.speakScript(0,rows);await idle();assert.deepEqual(T.plays.map(x=>x.kind),['voice']);
    await P.downloadScript(0,rows);assert.deepEqual(T.renders.at(-1).sources.map(x=>x.buffer.payload.kind),['voice']);
});
await test('muting a playing effect stops it immediately while speech continues',async()=>{
    await reset();await P.speakScript(0,[row('wind','sfx',{sfxId:'wind',mode:'loop'}),row('voice','voice'),row('pause','pause',{gapMs:80})]);await until(()=>T.plays.some(p=>p.kind==='voice'));
    const effect=T.plays.find(p=>p.kind==='sfx').node,voice=T.plays.find(p=>p.kind==='voice').node;Library.setSfxEnabled('wind',false);assert.equal(effect.paused,true);assert.equal(voice.paused,false);await idle();
});
await test('mute then unmute during a pending fetch cancels that old request',async()=>{
    await reset();const g=gate();T.sfxGate=g;await P.speakScript(0,[row('slow','sfx',{sfxId:'wind'}),row('voice','voice')]);await until(()=>g.started);
    Library.setSfxEnabled('wind',false);Library.setSfxEnabled('wind',true);g.release();T.sfxGate=null;await idle();assert.ok(T.plays.every(p=>p.kind!=='sfx'));
});
await test('changing a sound preference while rendering cancels the stale WAV',async()=>{
    await reset();const g=gate();T.renderGate=g;const pending=P.downloadScript(0,[row('fx','sfx',{sfxId:'bell'})]);await until(()=>g.started);Library.setSfxEnabled('bell',false);g.release();await assert.rejects(pending,/효과음 사용 설정/);T.renderGate=null;assert.equal(T.downloads.length,0);
});
await test('twice means exactly two live sound starts and two exported events',async()=>{
    await reset();const rows=[row('twice','sfx',{sfxId:'daily_coins',mode:'sequence',repeats:2})];await P.speakScript(0,rows);await idle();assert.equal(T.plays.length,2);assert.equal(T.ends.length,2);
    await P.downloadScript(0,rows);const sources=T.renders.at(-1).sources;assert.equal(sources.length,2);assert.equal(sources[0].startAt,0);assert.equal(sources[1].startAt,.08);assert.equal(sources[1].stopAt,.16);
});
await test('bounded typing duration pauses its countdown and stops without an infinite tail',async()=>{
    await reset();const beforeUrls=new Set(T.urls.keys());const c=Sfx.createSfxController();const h=await c.play('daily_keyboard',{durationMs:150});await sleep(30);c.pause();await sleep(180);assert.ok(T.urls.size>0);const start=Date.now();await c.resume();assert.equal(await h.done,'ended');assert.ok(Date.now()-start>=70);assert.ok([...T.urls.keys()].every(url=>beforeUrls.has(url)));
});
await test('bounded context duration is identical in the export timeline',async()=>{
    const out=Mix.sceneTimeline([timelineClip('sfx',2.5,{sfxId:'daily_keyboard',mode:'overlay',durationMs:6000}),timelineClip('voice',3)]);
    assert.equal(out.events[0].duration,6);assert.equal(out.events[0].loop,true);assert.equal(out.duration,6);
});
await test('stopping during an individual effect download prevents a late file',async()=>{
    await reset();await P.speakScript(0,[row('fx','sfx',{sfxId:'wind',mode:'loop'})]);await until(()=>T.plays.length);P.pause();
    const g=gate();T.sfxGate=g;const pending=P.downloadCurrent();await until(()=>g.started);P.stop();g.release();assert.equal(await pending,false);T.sfxGate=null;assert.equal(T.downloads.length,0);
});
await test('WAV contains attribution and its RIFF length includes the metadata chunk',async()=>{
    await reset();await P.downloadScript(0,[row('fx','sfx',{sfxId:'daily_scissors'})]);const bytes=await T.downloads[0].blob.arrayBuffer(),view=new DataView(bytes),text=new TextDecoder().decode(bytes);
    assert.equal(view.getUint32(4,true),bytes.byteLength-8);assert.ok(text.includes('ICMT'));assert.ok(text.includes('한국저작권위원회'));assert.ok(text.includes('CC-BY-4.0'));assert.ok(text.includes('wrtSn=13263912'));assert.ok(text.includes('변경:'));
});
await test('identical original text is omitted; translation and edits keep the original plain text',async()=>{
    assert.equal(Details.playbackOriginal({text:'Same words.',parts:[{original:{text:'Same  words.'}}]}),'');
    assert.equal(Details.playbackOriginal({text:'안녕하세요.',parts:[{original:{text:'Hello.'}}]}),'Hello.');
    assert.equal(Details.playbackOriginal({text:'changed',parts:[{original:{text:'<img src=x onerror=bad>'}}]}),'<img src=x onerror=bad>');
    assert.equal(Details.playbackOriginal({sceneKind:'sfx',text:'bell'}),'');
    assert.equal(Details.playbackOriginal({text:'First.',parts:[{original:{text:'First. Second.'},text:'First. Second.'}]}),'');
    assert.equal(Details.playbackOriginal({text:'First.',parts:[{original:{text:'First. Second.'},text:'First.'}]}),'First. Second.');
});
await test('compact bar lists only effects that started and resets when another message starts',async()=>{
    await reset();S.settings().mini_player=true;await P.speakScript(0,[row('fx','sfx',{sfxId:'daily_keyboard',durationMs:120,mode:'overlay'}),row('voice','voice'),row('wait','pause',{gapMs:180}),row('later','sfx',{sfxId:'bell'})]);await until(()=>T.plays.some(x=>x.kind==='voice'));
    const bar=document.body.children.find(n=>n.className==='lv-bar'),button=bar.querySelector('.lv-bar-details-btn'),list=bar.querySelector('.lv-bar-sfx-list');
    assert.equal(button.textContent,'효과음 1개');assert.equal(list.children.length,1);assert.equal(list.children[0].textContent,'키보드 타이핑');
    P.stop();await P.speakScript(0,[row('new','voice',{text:'New one.'}),row('wait','pause',{gapMs:50})]);await until(()=>T.plays.some(x=>x.text==='New one.'));assert.equal(list.children.length,0);await idle();
});
P.stop(); for(const node of T.nodes)node.pause();
console.log(JSON.stringify({passed,failed,mockOnly:true,network:'blocked except synthetic responses',sourceRoot:root},null,2));
process.exitCode=failed?1:0;
