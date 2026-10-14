// 모델 전환 · 모델 등록의 모델 목록 — 공용 목록 src/live-models.js 를 쓰는 길 (src/addons/modelswitch/targets.js · src/addons/models/panel.js)
//   node tools/tests/modelswitch-models.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실리태번 모듈(script.js · extensions.js · secrets.js · openai.js · popup.js)은 data: 스텁으로. 네트워크 없음 (fetch 는 가짜 — 부른 것을 기록).
// 확인하는 것:
//   1) 고를 목록: 받은 목록이 없으면 모델 등록 → 최신 이름(KNOWN) → 실리태번 화면 목록, 받은 목록이 있으면 그것(새것 먼저) + 모델 등록 — 옛 이름으로 부풀리지 않음 (MiniMax 는 실리태번의 8개뿐)
//      + 대상 확장의 지금 모델. 'OR_Website' · 직접 입력 표시 · OpenAI 의 채팅 아닌 모델은 빠짐. Custom 은 주소별 (아무도 안 쓰는 옛 주소 목록은 안 넣음)
//   2) ↻: 목록을 주는 공급자 모두 · Custom 은 실리태번 Custom 주소만 (저장된 키 보호) · Custom 요청 본문은 예전(1.0.5)과 글자까지 같음 · 받은 목록은 localStorage 에만 (settings.json 의 model_switch.lists 는 그대로, 읽기만)
//   3) 조용히 다시 받기: 하루 안이면 안 물음 · 키 없음 · 목록 없는 공급자 · 새로 친 Custom 주소는 안 물음 · 실패해도 조용히 · 불러오기만으로는 통신 없음
//   4) 모델 등록 입력칸 제안: 공용 목록 가운데 실리태번 목록 · 등록한 목록에 없는 것만
//   5) 모델 전환은 생성 요청을 보내지 않는다 — 모델별 요청 규칙(applyModelRequestRules)의 자체 사본이 없음
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = await fs.realpath(path.resolve(process.argv[2] || '.'));
const srcDir = path.join(root, 'src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__msModelsTest = { ext: {}, cs: {}, names: [], selects: {}, ctx: null };
T.ctx = { chatCompletionSettings: T.cs, onlineStatus: 'no_connection' };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const G = 'const T = globalThis.__msModelsTest;\n';
const ST = {
    'script.js': js(G + `export const chat = [];
export const event_types = { ONLINE_STATUS_CHANGED: 'online_status_changed' };
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => '{' + String(t ?? '') + '}';
export function getRequestHeaders() { return { 'Content-Type': 'application/json', 'X-CSRF-Token': 'tok' }; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = T.names;
export function getContext() { return T.ctx; }`),
    'secrets.js': js('export let secret_state = {};\nexport function setSecretState(s) { secret_state = s || {}; }'),
    'openai.js': js(G + 'export const oai_settings = T.cs;\nexport let model_list = [];'),
    'popup.js': js('export const POPUP_TYPE = {}; export const POPUP_RESULT = {}; export async function callGenericPopup() { return null; }'),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.root; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    const base = spec.split('/').pop();
    if (parent.startsWith(R) && (spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, root: pathToFileURL(srcDir).href } });

// ---------- 가짜 화면: 실리태번의 #model_<id>_select (옵션 값만) · 모델 등록 창이 만드는 숨은 칸
const element = () => ({ hidden: false, dataset: {}, style: {}, children: [], append(...n) { this.children.push(...n); }, replaceChildren(...n) { this.children = n; }, querySelector: () => null, addEventListener() {} });
globalThis.document = {
    body: element(),
    activeElement: null,
    createElement: element,
    getElementById: (id) => (T.selects[id] ? { options: T.selects[id].map(value => ({ value })) } : null),
};

let calls = [];
let fetchHits = 0;
globalThis.fetch = async (url, init) => { fetchHits++; calls.push({ url, init }); return reply(url, init); };
let reply = () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: [] }) });
const answer = (body, status = 200) => () => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });

const secrets = await import(ST['secrets.js']);
const LM = await import(pathToFileURL(path.join(srcDir, 'live-models.js')).href);
const MS = await import(pathToFileURL(path.join(srcDir, 'addons/modelswitch/targets.js')).href);

const events = new EventTarget();
globalThis.window = { dispatchEvent: e => events.dispatchEvent(e), addEventListener: (...a) => events.addEventListener(...a) };
const rows = await import(pathToFileURL(path.join(srcDir, 'addons/modelswitch/rows.js')).href);
const field = await import(pathToFileURL(path.join(srcDir, 'addons/modelswitch/fallback-field.js')).href);
const fallback = await import(pathToFileURL(path.join(srcDir, 'addons/modelswitch/fallback.js')).href);
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('ok',name);};
test('inactive rows remain visible but are not active',()=>{
 const holder={fallback:{enabled:false,provider:'openai',model:'saved'}};
 const t=fallback.fallbackTarget({id:'notes-fallback',name:'Notes',holder:()=>holder});
 assert.equal(rows.rowActive(t),false);holder.fallback.enabled=true;assert.equal(rows.rowActive(t),true);
 holder.fallback.model='  ';assert.equal(rows.rowActive(t),false);
 assert.equal(rows.rowShown({id:'main',read(){throw Error();}}),true);
 assert.equal(rows.rowActive({id:'bad-fallback',active(){throw Error();}}),false);
});
test('provider Off preserves choices; reenable restores and provider change clears model',()=>{
 const h={fallback:Object.freeze({enabled:true,provider:'openai',model:'old'})};
 field.pickProvider(h,'');assert.deepEqual(h.fallback,{enabled:false,provider:'openai',model:'old'});assert.deepEqual(field.fieldState(h),{provider:'',model:''});
 field.pickProvider(h,'openai');assert.equal(h.fallback.model,'old');assert.equal(h.fallback.enabled,true);
 field.pickProvider(h,'claude');assert.equal(h.fallback.model,'');field.pickModel(h,' new ');assert.equal(h.fallback.model,'new');
});
test('group buttons only change their visible group, empty group does nothing',()=>{
 const list=[{id:'a'},{id:'b'},{id:'a-fallback'},{id:'z-fallback',active:()=>false}];const visible=rows.visibleRows(list.map(t=>({...t,read:()=>({source:'openai',model:'x'})})));
 assert.deepEqual(rows.toggleGroup(visible,'main',()=>true),{a:false,b:false});
 assert.deepEqual(rows.toggleGroup(visible,'fallback',()=>false),{'a-fallback':true});
 assert.deepEqual(rows.toggleGroup([], 'fallback',()=>true),{});assert.equal(rows.groupOn(visible,'main',()=>true),true);
});
test('registered declared settings path respects disabled legacy fallback',()=>{
 T.ext.helper={connection:{enabled:false,provider:'openai',model:'x'}};
 MS.registry.register({id:'helper-fallback',name:'Helper',settingsKey:'helper',path:'connection',read:()=>({source:'openai',model:'x'}),apply(){}});
 assert.equal(MS.shownTargets().some(t=>t.id==='ext:helper-fallback'),true);assert.equal(rows.rowActive(MS.shownTargets().find(t=>t.id==='ext:helper-fallback')),false);
 T.ext.helper.connection.enabled=true;assert.equal(MS.shownTargets().some(t=>t.id==='ext:helper-fallback'),true);
 MS.registry.unregister('helper-fallback');
});
test('external callbacks take precedence over inferred active and route',()=>{
 let opened=0;
 MS.registry.register({id:'tts-analysis-fallback',name:'Reader',active:()=>false,open:()=>++opened,read:()=>({source:'openai',model:'x'}),apply(){}});
 const t=MS.listTargets().find(t=>t.id==='ext:tts-analysis-fallback');assert.equal(rows.rowActive(t),false);t.open();assert.equal(opened,1);MS.registry.unregister('tts-analysis-fallback');
});
test('fallback target carries optional settings opener and guarded active state',()=>{
 const opener=()=>42,t=fallback.fallbackTarget({id:'x-fallback',name:'X',holder:()=>({fallback:{provider:'openai',model:'m'}}),open:opener});assert.equal(t.open,opener);assert.equal(t.active(),true);
});
test('saved provider outside choices remains visible and escaped',()=>{
 const host={ownerDocument:{querySelectorAll:()=>[],createElement:()=>({}),head:{append(){}}},dataset:{},addEventListener(){},innerHTML:''};
 const h={fallback:{provider:'legacy-<provider>',model:'saved'}};
 field.mountFallbackField(host,{id:'test',settings:()=>h,sources:['openai']});
 assert.ok(host.innerHTML.includes('value="legacy-&lt;provider&gt;" selected'));
 assert.ok(host.innerHTML.includes('legacy-&lt;provider&gt; (저장된 제공처)'));
 assert.equal(h.fallback.provider,'legacy-<provider>');
});

test('explicit activation validates first and preserves disabled values until committed',()=>{
 const h={fallback:{enabled:false,provider:'openai',model:'old',extra:1}},before=JSON.stringify(h);
 const t=fallback.fallbackTarget({id:'sample-fallback',name:'Sample',holder:()=>h,main:()=>({source:'claude',model:'main'})});
 assert.equal(t.enable({source:'claude',model:''}),false);assert.equal(t.enable({source:'claude',model:'main'}),false);assert.equal(JSON.stringify(h),before);
 assert.equal(t.enable({source:'claude',model:'other'}),true);assert.deepEqual(h.fallback,{enabled:true,provider:'claude',model:'other',extra:1});
 const x={feature:{fallback:Object.freeze({enabled:false,provider:'openai',model:'old'})}};
 assert.equal(fallback.enableFallbackPath(x,'feature.fallback',{source:'claude',model:'new'}),true);assert.equal(x.feature.fallback.enabled,true);
 assert.equal(fallback.enableFallbackPath(x,'__proto__.fallback',{source:'claude',model:'new'}),false);
});
test('custom registry enable callback wins and declared standard paths enable explicitly',()=>{
 T.ext.sample={fallback:{enabled:false,provider:'openai',model:'old'}};
 MS.registry.register({id:'sample-fallback',name:'Sample',settingsKey:'sample',path:'fallback',read:()=>({source:T.ext.sample.fallback.provider,model:T.ext.sample.fallback.model}),apply(){}});
 const t=MS.listTargets().find(t=>t.id==='ext:sample-fallback');assert.equal(t.enable({source:'claude',model:'new'}),true);assert.equal(rows.rowActive(t),true);
 let called=0;MS.registry.register({id:'sample-fallback',name:'Sample',settingsKey:'sample',path:'fallback',enable:()=>++called,read:()=>({}),apply(){}});
 MS.listTargets().find(t=>t.id==='ext:sample-fallback').enable({});assert.equal(called,1);MS.registry.unregister('sample-fallback');
});
test('model search is case-insensitive, keeps custom input, and opens the saved model with all options',()=>{
 const ids=['claude-opus','claude-sonnet','gemini-flash','claude-opus'];
 assert.deepEqual(field.matchingModels(ids,'OPU','old'),['claude-opus']);assert.deepEqual(field.matchingModels(ids,'private-custom-id','old'),[]);
 assert.deepEqual(field.matchingModels(ids,'claude-opus','claude-opus'),ids.slice(0,3));
});
test('display names sort in Korean and grouped children retain identity, primary and fallback pairing',()=>{
 const g={id:'reader',name:'읽기'};
 const list=[{id:'last',name:'하늘'},{id:'sub2',name:'세부 10',group:{...g,order:2}},{id:'first',name:'가나다'},{id:'main',name:'기본 연결',group:{...g,primary:true,order:0}},{id:'main-fallback',name:'기본 연결 (검열되면)'},{id:'sub1',name:'세부 2',group:{...g,order:1}}];
 const before=JSON.stringify(list),groups=rows.displayGroups(list);assert.deepEqual(groups.map(g=>g.name),['가나다','읽기','하늘']);
 assert.deepEqual(groups[1].main.map(t=>t.id),['main','main-fallback']);assert.deepEqual(groups[1].children.map(t=>t.id),['sub1','sub2']);assert.equal(groups[1].main[0],list[3]);assert.equal(JSON.stringify(list),before);
 assert.deepEqual(rows.orderedRows(list).map(t=>t.id),['first','main','main-fallback','sub1','sub2','last']);
});

console.log(`${passed}/${passed} modelswitch links groups passed`);
