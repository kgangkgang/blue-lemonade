// TTS 답장 오는 동안 읽기가 「한 번에 최대 글자」를 답장 전체로 세요 (진짜 player.js · 가짜 엔진 · 네트워크 0). 시험대는 tts-delete-playing.mjs 와 같아요
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const T = globalThis.__ttsArea = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina', characters: [], groups: [], groupId: null }, requests: [], plays: [], warnings: [], urls: new Map(), seq: 0, handlers: {}, cache: new Map(), analysisReply: null, analysisRequests: [] };
T.ctx.saveChat = async () => {};
const G = 'const T = globalThis.__ttsArea;\n';
const stubs = {
  'script.js': data(G + `export const chat=T.ctx.chat; export const event_types={CHAT_CHANGED:'chat',MESSAGE_DELETED:'deleted'};
export const eventSource={on(t,f){(T.handlers[t]||=[]).push(f)},makeLast(){},emit(){},removeListener(){}}; export const substituteParams=t=>String(t??'');
export function getRequestHeaders(){return {}} export function saveSettingsDebounced(){} export async function saveSettings(){}
export function syncMesToSwipe(){} export const main_api='openai'; export function generateRaw(){throw Error('Unexpected LLM generation')}`),
  'extensions.js': data(G + `export const extension_settings=T.ext; export const extensionNames=[];
export const getContext=()=>T.ctx; export function saveMetadataDebounced(){}`),
  'popup.js': data(`export const POPUP_TYPE={TEXT:1,CONFIRM:2,INPUT:3}; export const POPUP_RESULT={AFFIRMATIVE:1,NEGATIVE:0,CANCELLED:null};
export async function callGenericPopup(){return null} export function fixToastrForDialogs(){}`),
  'utils.js': data(`export function getStringHash(s){let h=0;for(const c of String(s??''))h=(h*31+c.charCodeAt(0))|0;return h}
export const splitRecursive=t=>[String(t??'')];`),
  'secrets.js': data('export const secret_state={};'),
};
const realCache = pathToFileURL(path.join(root, 'cache.js')).href;
const cacheStub = data(G + `export * from ${JSON.stringify(realCache)};
export async function get(k){return T.cache.get(k)||null} export async function has(k){return T.cache.has(k)}
export async function put(k,blob,meta={}){T.cache.set(k,{blob,...meta})}
export async function remove(k){T.cache.delete(k)} export async function clear(){T.cache.clear()}
export function setProtected(){} export function onClear(){} export async function prune(){}`);
register(data(`let D;export function initialize(d){D=d}export async function resolve(spec,ctx,next){
if(String(ctx.parentURL||'').includes('/addons/tts/')){
if(spec==='./cache.js'&&!String(ctx.parentURL).startsWith('data:'))return {url:D.cache,shortCircuit:true};
const base=spec.split('/').pop();if(spec.split('../').length>3&&D.st[base])return {url:D.st[base],shortCircuit:true};}
return next(spec,ctx)}`), { data: { st: stubs, cache: cacheStub } });
class Element extends EventTarget {
  constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.dataset={};this.children=[];this.attributes=new Map();this.style={setProperty(){}};this._s=new Map();const c=new Set();this.classList={add:(...x)=>x.forEach(v=>c.add(v)),remove:(...x)=>x.forEach(v=>c.delete(v)),contains:x=>c.has(x),toggle:(x,v)=>{v??=!c.has(x);v?c.add(x):c.delete(x);return v}};}
  setAttribute(k,v){this.attributes.set(k,v)} removeAttribute(k){this.attributes.delete(k)} getAttribute(k){return this.attributes.get(k)}
  appendChild(n){this.children.push(n);return n} append(...n){this.children.push(...n)} prepend(...n){this.children.unshift(...n)} replaceChildren(...n){this.children=n} remove(){} focus(){} contains(){return false}
  querySelector(s){if(!this._s.has(s))this._s.set(s,new Element());return this._s.get(s)} querySelectorAll(){return []} getBoundingClientRect(){return {left:0,top:0,width:800,height:40}}
}
class MockAudio extends Element {
  constructor(src=''){super('audio');this.src=src;this.paused=true;this.volume=1;this.playbackRate=1;this.loop=false;this.timer=0;}
  async play(){const b=T.urls.get(this.src);if(!b)throw Error('no blob');this.paused=false;T.plays.push({at:Date.now()});this.onplaying?.();clearTimeout(this.timer);this.timer=setTimeout(()=>{if(!this.paused){this.paused=true;this.onended?.();this.dispatchEvent(new Event('ended'));}},T.playMs??30);}
  pause(){this.paused=true;clearTimeout(this.timer)} load(){}
}
globalThis.Audio=MockAudio; globalThis.window=globalThis; globalThis.addEventListener=()=>{}; globalThis.removeEventListener=()=>{};
globalThis.CustomEvent ||= class extends Event { constructor(t,o={}){super(t);this.detail=o.detail;} };
Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
globalThis.document={hidden:false,body:new Element('body'),createElement:t=>t==='audio'?new MockAudio():new Element(t),querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,dispatchEvent(){},addEventListener(){},removeEventListener(){}};
globalThis.toastr=Object.fromEntries(['info','warning','error','success'].map(k=>[k,m=>T.warnings.push({k,m})]));
const local=new Map();globalThis.localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)};
const sess=new Map();globalThis.sessionStorage={getItem:k=>sess.get(k)??null,setItem:(k,v)=>sess.set(k,String(v)),removeItem:k=>sess.delete(k)};
URL.createObjectURL=b=>{const u=`blob:t/${++T.seq}`;T.urls.set(u,b);return u};URL.revokeObjectURL=u=>T.urls.delete(u);
globalThis.fetch=async(url,init={})=>{const u=String(url);
  if((u==='/api/backends/chat-completions/generate'||u.endsWith('/chat/completions'))&&T.analysisReply){const b=JSON.parse(init.body);T.analysisRequests.push(b);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(T.analysisReply(b))}}],usage:{prompt_tokens:10,completion_tokens:10}}));}
  throw Error('Blocked fetch: '+u)};
const mod = n => import(pathToFileURL(path.join(root,n)).href);
const gv=(id,name,provider='minimax')=>({uid:`${provider}:${id}`,provider,voiceId:id,name,lang:'',group:'g',aliases:[],params:{},mix:[]});
function msg(text,{name='Mina',extra={}}={}){const m={name,is_user:false,mes:text,extra,swipe_id:0,gen_started:'x'};T.ctx.chat.length=0;T.ctx.chat.push(m);T.ctx.name2=name;return m;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const S = await mod('settings.js'), Reg = await mod('providers/index.js'), P = await mod('player.js');
for (const id of ['minimax', 'elevenlabs']) Reg.PROVIDERS[id].synth = async ({ text, voice }) => { T.requests.push({ text, uid: voice.uid }); await sleep(2); return { blob: new Blob(['x'], { type: 'audio/wav' }), usage: { chars: text.length } }; };
P.init();
const s = S.settings();
function reset(max) {
    Object.assign(s, { enabled: true, auto_play: true, stream_read: true, listen_lang: 'auto', wait_translation: 'off', pregen: 'off', voices: [gv('a', '가'), gv('b', '나')], char_map: { Mina: 'minimax:a' }, default_voice: 'minimax:a', max_chars: max, prefetch: 3 });
    s.analysis = { ...s.analysis, enabled: false, engine: 'compat', base: 'https://mock.invalid/v1', key: 'k', model: 'm' };
    s.sfx = { ...s.sfx, enabled: false };
    s.providers = { minimax: { key: 'k'.repeat(50), host: 'https://api.minimax.io', model: 'speech-2.8-hd' }, elevenlabs: { key: 'kkk', model: 'eleven_v4' } };
    T.requests.length = 0; T.warnings.length = 0; T.cache.clear();
}
async function streamReply(lines) {
    const m = msg(''); T.ctx.streamingProcessor = null;
    let text = '';
    for (let i = 0; i < lines; i++) { text += `"${String(i).repeat(40)} 문장이다." `; m.mes = text; P.onStreamProgress(0, text); await sleep(2); }
    P.onStreamEnd(0); await sleep(500);
    const total = T.requests.reduce((n, r) => n + r.text.length, 0);
    P.stop(); await sleep(10);
    return total;
}
reset(100);
const limited = await streamReply(6);
assert.ok(limited <= 100, `상한 100 인데 ${limited}자를 샀어요`);
assert.ok(limited > 0, '상한까지는 읽어요');
assert.ok(T.warnings.some(w => w.k === 'warning' && /100자를 넘는 뒷부분은 읽지 않아요/.test(w.m)), '일반 읽기와 같은 경고');
reset(0);
assert.ok(await streamReply(6) > 200, '0 = 제한 없음');
reset(3000);
const fits = await streamReply(3);
assert.equal(T.warnings.filter(w => /넘는 뒷부분/.test(w.m)).length, 0, '상한 안이면 경고 없음');
assert.ok(fits > 100);
console.log('PASS 답장 오는 동안 읽기가 최대 글자를 답장 전체로 세요');
process.exit(0);
