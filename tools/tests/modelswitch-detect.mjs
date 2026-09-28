// 모델 전환 1.0.5 — 모르는 확장 자동으로 찾기 (src/addons/modelswitch/discover.js)
// 확장마다 적어 두지 않고: 소스로 설정 키의 주인을 찾고, 설정 안의 '공급자 + 모델' 자리를 찾아, 그 칸만 바꾼다.
// 실행: node tools/tests/modelswitch-detect.mjs salty-ext
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=pathToFileURL(path.resolve(process.argv[2]||'.')+'/');
const D=await import(new URL('src/addons/modelswitch/discover.js',root));
const {SOURCES}=await import(new URL('src/addons/models/sources.js',root));
const STS=SOURCES.map(s=>s.id);
const clone=v=>JSON.parse(JSON.stringify(v));
const ids=list=>list.map(n=>n.path.join('.'));
// before → after 에서 바뀐 경로만 (값이 같으면 안 바뀐 것)
function changed(a,b,prefix='',out=[]){
    const keys=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);
    for(const k of keys){
        const p=prefix?`${prefix}.${k}`:k, x=a?.[k], y=b?.[k];
        if(x&&y&&typeof x==='object'&&typeof y==='object'&&!Array.isArray(x)) changed(x,y,p,out);
        else if(JSON.stringify(x)!==JSON.stringify(y)) out.push(p);
    }
    return out.sort();
}
function targetsOf(settings,key,{texts=[],name='확장'}={}){
    return D.findNodes(settings[key],STS).map(node=>D.makeTarget({key,node,getRoot:()=>settings[key],name,texts,sources:STS}));
}

// ---------- 1) TTS (설정 키 lemon_voice, 폴더 tts) — 폴더 이름과 키가 달라도 소스로 주인을 찾는다
const ttsTexts=[
`import { settings } from './src/settings.js';
import { extension_settings } from '../../../extensions.js';
const LLM_KEY = 'llm-translator-custom';
const on = extension_settings[LLM_KEY]?.auto_mode; const st = extension_settings.translate?.auto_mode;`,
`export const KEY = 'lemon_voice';
export const ANALYSIS_DEFAULTS = Object.freeze({ enabled: true, engine: 'compat', base: 'https://api.openai.com/v1', key: '', model: 'gpt-4o-mini', provider: 'openai', provider_models: {}, custom_url: '' });
export function settings() { if (!extension_settings[KEY]) extension_settings[KEY] = {}; return extension_settings[KEY]; }`,
`const engineOf = (c) => (c && c.engine === 'st' ? 'st' : c && c.engine === 'provider' ? 'provider' : 'compat');
export const SOURCES = [{ id: 'openai' }, { id: 'custom' }, { id: 'claude' }, { id: 'makersuite', sel: 'google' }, { id: 'openrouter' }, { id: 'deepseek' }];`,
];
const ttsRefs=D.settingsRefs(ttsTexts);
assert.ok(ttsRefs.assigned.has('lemon_voice'),'const KEY + extension_settings[KEY] = … is ownership');
assert.ok(!ttsRefs.assigned.has('llm-translator-custom')&&ttsRefs.mentioned.has('llm-translator-custom'),'reading another extension key is not ownership');
assert.ok(!ttsRefs.assigned.has('translate'));
const extensions=[
    {folder:'tts',refs:ttsRefs},
    {folder:'JS-Slash-Runner',refs:D.settingsRefs(['import{extension_settings as mt,getContext as ht}from"../../../../extensions.js";const Xt="tavern_helper";mt[Xt]=mt[Xt]??{};mt.lemon_voice;'])},
];
assert.equal(D.ownerOf('lemon_voice',extensions)?.folder,'tts');
assert.equal(D.ownerOf('tavern_helper',extensions)?.folder,'JS-Slash-Runner','minified alias + const chain');
assert.equal(D.ownerOf('left_behind',extensions),null,'no enabled extension owns a removed extension leftover');
console.log('PASS ownership: TTS lemon_voice → tts, minified alias, leftover key ignored');

const tts={lemon_voice:{enabled:true,voices:[],providers:{openai:{key:'',model:'gpt-4o-mini-tts',voice:'alloy'},minimax:{model:'speech-02-hd'}},ui:{tab:'read',provider_tab:'minimax'},
    analysis:{enabled:true,engine:'provider',base:'https://relay.example/v1',key:'',model:'gemini-x',provider:'openai',provider_models:{openai:'gpt-4o-mini'},custom_url:'',when:'auto'}}};
assert.deepEqual(ids(D.findNodes(tts.lemon_voice,STS)),['analysis'],'only the analysis connection, not TTS voice providers');
let [t]=targetsOf(tts,'lemon_voice',{texts:ttsTexts,name:'TTS'});
assert.equal(t.id,'auto:lemon_voice.analysis');
assert.deepEqual(t.sources,['openai','claude','makersuite','openrouter','deepseek','custom'].filter(id=>STS.includes(id)).sort((a,b)=>STS.indexOf(a)-STS.indexOf(b)));
assert.deepEqual(t.read(),{source:'openai',model:'gpt-4o-mini',url:''});
let before=clone(tts);
t.apply({source:'custom',model:'relay-model',url:'https://relay.example/v1'});
assert.deepEqual(changed(before,tts),['lemon_voice.analysis.custom_url','lemon_voice.analysis.provider','lemon_voice.analysis.provider_models.custom']);
assert.equal(tts.lemon_voice.analysis.model,'gemini-x','compat engine model untouched');
assert.deepEqual(t.read(),{source:'custom',model:'relay-model',url:'https://relay.example/v1'});
// 엔진 'st'(실리태번 연결) → 'provider' 로, 엔진 'compat'(자체 주소) → 'provider' 로
tts.lemon_voice.analysis.engine='st';
assert.equal(t.read().follow,'지금 연결');
before=clone(tts);
t.apply({source:'openai',model:'gpt-5-mini'});
assert.deepEqual(changed(before,tts),['lemon_voice.analysis.engine','lemon_voice.analysis.provider','lemon_voice.analysis.provider_models.openai']);
assert.equal(tts.lemon_voice.analysis.engine,'provider');
tts.lemon_voice.analysis.engine='compat';
assert.equal(t.read().follow,'자체 연결');
t.apply({source:'claude',model:'claude-x'});
assert.deepEqual(t.read(),{source:'claude',model:'claude-x',url:''});
assert.throws(()=>t.apply({source:'groq',model:'x'}),/못 씀/,'a provider the extension never names is refused');
console.log('PASS TTS analysis: engine provider/st/compat, only provider · provider_models · custom_url · engine written');

// ---------- 2) 장기 기억 꼴 (연결 방식은 부모, 공급자별 모델 · 'custom' 표시 → customModels)
const memTexts=[`if (s.apiMode !== 'direct') return; const mode = s.apiMode === 'custom' ? 1 : s.apiMode === 'profile' ? 2 : 0; extension_settings.memo_like = extension_settings.memo_like || {};
const S = ['openai','custom','claude','makersuite'];`];
const mem={memo_like:{enabled:true,apiMode:'profile',profileId:'',direct:{source:'custom',models:{custom:'custom',openai:'gpt-4o'},customModels:{custom:'my-relay'},customUrl:'http://a/v1',temperature:0.3},
    embedApi:{source:'openai',model:'text-embedding-3-small'}}};
assert.deepEqual(ids(D.findNodes(mem.memo_like,STS)),['direct'],'embedding connection is not a chat model');
[t]=targetsOf(mem,'memo_like',{texts:memTexts});
assert.deepEqual(t.read(),{follow:'연결 프로필',source:'custom',model:'my-relay',url:'http://a/v1',stays:false});
before=clone(mem);
t.apply({source:'openai',model:'gpt-5'});
assert.deepEqual(changed(before,mem),['memo_like.apiMode','memo_like.direct.models.openai','memo_like.direct.source']);
assert.deepEqual(t.read(),{source:'openai',model:'gpt-5',url:''});
console.log('PASS memoria-like: parent apiMode → direct, custom sentinel reads customModels, embeddings skipped');

// ---------- 3) 다시 쓰기 꼴 (connection · models · customModels · customUrl)
const rwTexts=[`if (s.connection !== 'direct') {} if (s.connection === 'profile') {} extension_settings['rw_like'] ??= {}; const p=['openai','custom','claude'];`];
const rw={rw_like:{enabled:true,connection:'current',provider:'openai',models:{openai:'gpt-4o',custom:''},customModels:{},customUrl:'',rules:[{from:'a'}]}};
[t]=targetsOf(rw,'rw_like',{texts:rwTexts});
assert.equal(t.read().follow,'지금 연결');
before=clone(rw);
t.apply({source:'custom',model:'relay',url:'http://relay/v1'});
assert.deepEqual(changed(before,rw),['rw_like.connection','rw_like.customUrl','rw_like.models.custom','rw_like.provider']);
assert.equal(rw.rw_like.connection,'direct');
console.log('PASS rewrite-like: connection current → direct, custom URL written only for custom');

// ---------- 4) 평평한 { provider, model } — 연결 방식 칸 없음
const flatTexts=[`extension_settings.flat_ext = { provider: 'claude', model: '' }; const list = ['claude', 'openai'];`];
const flat={flat_ext:{provider:'claude',model:'claude-sonnet',temperature:1}};
[t]=targetsOf(flat,'flat_ext',{texts:flatTexts});
assert.equal(t.id,'auto:flat_ext');
assert.deepEqual(t.read(),{source:'claude',model:'claude-sonnet',url:''});
before=clone(flat);
t.apply({source:'openai',model:'gpt-5'});
assert.deepEqual(changed(before,flat),['flat_ext.model','flat_ext.provider']);
console.log('PASS flat provider + model');

// ---------- 5) 깊이 3 안쪽 자리 · 깊이 5 는 안 봄 · 기록용 표(history)는 모델 한 칸과 함께 쓴다
const deep={deep_ext:{a:{b:{c:{llm_provider:'openrouter',llm_model:'x/y',provider_model_history:{openrouter:'x/y'}}}},v:{w:{x:{y:{z:{provider:'openai',model:'too-deep'}}}}}}};
assert.deepEqual(ids(D.findNodes(deep.deep_ext,STS)),['a.b.c']);
[t]=targetsOf(deep,'deep_ext',{texts:[`const x = ['openrouter','openai'];`]});
assert.equal(t.id,'auto:deep_ext.a.b.c');
before=clone(deep);
t.apply({source:'openai',model:'gpt-5'});
assert.deepEqual(changed(before,deep),['deep_ext.a.b.c.llm_model','deep_ext.a.b.c.llm_provider','deep_ext.a.b.c.provider_model_history.openai']);
console.log('PASS nested depth-3 node found, depth-5 ignored, history map + single model both written');

// ---------- 6) 공급자가 아닌 글자는 무시
const noise={noise_ext:{provider:'elevenlabs',model:'eleven_v2',img:{source:'openai',model:'dall-e-3'},loc:{source:'extras',model:'x'},speech:{provider:'openai',model:'gpt-4o'},
    tr:{provider:'google',target_language:'ko'},listy:{provider:'openai',models:['a','b']}}};
assert.deepEqual(ids(D.findNodes(noise.noise_ext,STS)),[],'non-source values, image/speech paths, no model, array models');
console.log('PASS non-source strings and non-chat connections ignored');

// ---------- 7) google ↔ makersuite
const gTexts=[`const L = ['google','openai','custom'];`];
const g={g_ext:{provider:'google',models:{google:'gemini-2.5-pro',openai:'gpt-4o'}}};
[t]=targetsOf(g,'g_ext',{texts:gTexts});
assert.deepEqual(t.read(),{source:'makersuite',model:'gemini-2.5-pro',url:''});
assert.ok(t.sources.includes('makersuite')&&!t.sources.includes('google'));
t.apply({source:'openai',model:'gpt-5'}); assert.equal(g.g_ext.provider,'openai');
t.apply({source:'makersuite',model:'gemini-3-pro'});
assert.deepEqual(g.g_ext,{provider:'google',models:{google:'gemini-3-pro',openai:'gpt-5'}});
const m={m_ext:{source:'makersuite',models:{makersuite:'gemini-2.5-pro'}}};
[t]=targetsOf(m,'m_ext',{texts:[`['makersuite','openai']`]});
t.apply({source:'makersuite',model:'gemini-3-pro'});
assert.deepEqual(m.m_ext,{source:'makersuite',models:{makersuite:'gemini-3-pro'}});
console.log('PASS google/makersuite mapping both ways');

// ---------- 8) 연결 방식 값이 둘 이상('direct' · 'provider')이면 방식은 그대로, 공급자 · 모델만
const amb={amb_ext:{mode:'st',provider:'openai',model:'gpt-4o'}};
[t]=targetsOf(amb,'amb_ext',{texts:[`if (s.mode === 'direct') {} else if (s.mode === 'provider') {} ['openai','claude']`]});
before=clone(amb);
t.apply({source:'claude',model:'claude-x'});
assert.deepEqual(changed(before,amb),['amb_ext.model','amb_ext.provider'],'ambiguous mode left alone');
assert.deepEqual(t.read(),{follow:'지금 연결',source:'claude',model:'claude-x',url:'',stays:true});
console.log('PASS ambiguous mode: provider + model only, still follows the current connection');

// ---------- 9) 얼어 있는 기본값 객체도 쓸 수 있게 이 설정의 객체로 바꿔 쓴다 · 스스로 등록한 자리는 뺀다
const frozen={fz_ext:{direct:Object.freeze({provider:'openai',models:Object.freeze({openai:'a'})})}};
[t]=targetsOf(frozen,'fz_ext',{texts:[`['openai','claude']`]});
t.apply({source:'claude',model:'b'});
assert.deepEqual(frozen.fz_ext.direct,{provider:'claude',models:{openai:'a',claude:'b'}});
const nodes=D.findNodes(mem.memo_like,STS);
assert.equal(D.skipRegistered(nodes,'memo_like',[{settingsKey:'memo_like'}]).length,0);
assert.equal(D.skipRegistered(nodes,'memo_like',[{settingsKey:'memo_like',path:'direct'}]).length,0);
assert.equal(D.skipRegistered(nodes,'memo_like',[{settingsKey:'memo_like',path:'other'}]).length,1);
assert.equal(D.skipRegistered(nodes,'memo_like',[{settingsKey:'x'}]).length,1);
console.log('PASS frozen defaults copied before writing; registry settingsKey/path dedupe');

// ---------- 10) 소스 모으기: manifest 의 js → 같은 폴더 안 모듈만 (밖의 실리태번 모듈은 안 받음)
const files={
    'http://h/scripts/extensions/third-party/tts/manifest.json':JSON.stringify({display_name:'TTS',js:'index.js'}),
    'http://h/scripts/extensions/third-party/tts/index.js':`import { a } from './src/settings.js'; import x from '../../../extensions.js'; const lazy = () => import('./src/ui.js');`,
    'http://h/scripts/extensions/third-party/tts/src/settings.js':`export const KEY='lemon_voice'; import './../index.js';`,
    'http://h/scripts/extensions/third-party/tts/src/ui.js':`export {};`,
};
const asked=[];
const got=await D.crawl('http://h/scripts/extensions/third-party/tts/',async url=>{asked.push(url);return files[url]??null;});
assert.equal(got.manifest.display_name,'TTS');
assert.equal(got.texts.length,3);
assert.ok(!asked.some(url=>url.includes('/scripts/extensions.js')),'never leaves the extension folder');
console.log('PASS crawl: entry + relative imports inside the extension folder only');

// ---------- 11) 리뷰 반영 (5.5.3): 압축 import · 지역 extensionSettings · 실리태번 상수 · 겸용 공급자 · 낱말 경로 · 별칭 · 공급자별 칸
// 압축된 import/export 도 따라간다
const mini={
    'http://h/scripts/extensions/third-party/mini/manifest.json':JSON.stringify({js:'i.js'}),
    'http://h/scripts/extensions/third-party/mini/i.js':'import{a}from"./a.js";export*from"./b.js";export{c}from\'./c.js\';const d=()=>import(`./d.js`);import"./e.js";',
    'http://h/scripts/extensions/third-party/mini/a.js':'1','http://h/scripts/extensions/third-party/mini/b.js':'2','http://h/scripts/extensions/third-party/mini/c.js':'3',
    'http://h/scripts/extensions/third-party/mini/d.js':'4','http://h/scripts/extensions/third-party/mini/e.js':'5',
};
const mg=await D.crawl('http://h/scripts/extensions/third-party/mini/',async url=>mini[url]??null);
assert.equal(mg.texts.length,6,'minified import chain followed (a · b · c · d · e)');
// 크기 한도: 받는 쪽에 남은 한도를 넘기고, 넘는 파일에서 멈춘다
const budgets=[];
const big=await D.crawl('http://h/scripts/extensions/third-party/mini/',async(url,left)=>{budgets.push(left);return url.endsWith('i.js')||url.endsWith('manifest.json')?mini[url]:'x'.repeat(60);},{maxBytes:200});
assert.ok(big.texts.reduce((n,t)=>n+t.length,0)<=200,'byte budget respected');
assert.ok(budgets.every(b=>b<=200)&&budgets.at(-1)<200,'remaining budget handed to fetchText');
console.log('PASS crawl: minified import/export/template import followed, byte budget respected');

// 지역 변수 extensionSettings 는 extension_settings 가 아니다 · getContext() 의 것만
const local=D.settingsRefs([`const KEY='my_ext'; const extensionSettings = extension_settings[KEY] ??= {}; extensionSettings.imagegen = {}; extensionSettings.presets = [];`]);
assert.ok(local.assigned.has('my_ext')&&!local.assigned.has('imagegen')&&!local.mentioned.has('presets'),'local extensionSettings alias ignored');
const ctx=D.settingsRefs([`const { extensionSettings, saveSettingsDebounced } = SillyTavern.getContext(); extensionSettings.foo_ext = {};`,
    `const es = getContext().extensionSettings; es['bar_ext'] ??= {};`,`getContext().extensionSettings.baz_ext ||= {}; const { extensionSettings: xs } = getContext(); xs.qux_ext = {};`]);
for(const k of ['foo_ext','bar_ext','baz_ext','qux_ext'])assert.ok(ctx.assigned.has(k),`getContext().extensionSettings → ${k}`);
assert.equal(D.ownerOf('imagegen',[{folder:'my-ext',refs:local},{folder:'img',refs:D.settingsRefs([`extension_settings.imagegen = {}`])}])?.folder,'img','the real owner, not a local alias');
console.log('PASS ownership: local extensionSettings variables ignored, getContext().extensionSettings aliases followed');

// 주인 고르기: 여럿이 만들면 이름이 닮은 쪽 · 못 가르면 없음 · 언급만 하면 이름도 닮아야
const mk=(folder,code,name)=>({folder,name,refs:D.settingsRefs([code])});
assert.equal(D.ownerOf('story_helper',[mk('importer','extension_settings.story_helper = migrate(x)'),mk('StoryHelper-ST','extension_settings.story_helper ??= {}')])?.folder,'StoryHelper-ST');
assert.equal(D.ownerOf('orphan',[mk('a','extension_settings.orphan = {}'),mk('b','extension_settings.orphan = {}')]),null,'two assigners, no name match → nobody');
assert.equal(D.ownerOf('left_over',[mk('reader','const x = extension_settings.left_over?.model')]),null,'mention only, unrelated name → nobody');
assert.equal(D.ownerOf('recap_helper',[mk('recap','const x = extension_settings.recap_helper?.model')])?.folder,'recap','mention only, alike name → owner');
console.log('PASS ownership: several assigners resolved by name, mention-only needs a matching name');

// 실리태번 상수를 쓰는 확장은 공급자 전부 (Custom 은 주소 칸 · CUSTOM 상수가 있을 때)
const stc={stc_ext:{source:'openai',model:'gpt-4o'}};
[t]=targetsOf(stc,'stc_ext',{texts:[`import { chat_completion_sources } from '../../../openai.js'; const s = chat_completion_sources.OPENAI;`]});
assert.deepEqual(t.sources,STS.filter(id=>id!=='custom'),'chat_completion_sources → every source except custom (no URL field)');
[t]=targetsOf({stc2:{source:'openai',model:'gpt-4o',custom_url:''}},'stc2',{texts:[`chat_completion_sources.CUSTOM`]});
assert.deepEqual(t.sources,STS);
console.log('PASS ST constants: all sources allowed, custom only with a URL field');

// 아무 데나 나오는 'custom' · 'openai' 는 공급자로 치지 않는다
const loose={loose_ext:{provider:'openai',models:{openai:'gpt-4o'}}};
[t]=targetsOf(loose,'loose_ext',{texts:[`if (theme === 'custom') {} const L = ['openai', 'claude']; log('openai'); const kind = 'custom';`]});
assert.deepEqual(t.sources,['openai','claude']);
assert.ok([...D.providerLiterals([`switch (cfg.provider) { case 'claude': break; case 'custom': break; }`],STS)].includes('custom'),'case label in a provider switch counts');
assert.ok(![...D.providerLiterals([`switch (theme) { case 'custom': break; }`],STS)].includes('custom'),'case label in another switch does not');
assert.ok([...D.providerLiterals([`if (s.llm_provider === 'deepseek') {}`],STS)].includes('deepseek'));
console.log('PASS provider literals only from provider-like arrays, comparisons and switches');

// 겸용 공급자 이름: 그림 · 음성 모델 이름 · 모델이 빈 자리는 채팅 호출이 있을 때만
const dual={dual_ext:{img:{source:'pollinations',model:'flux'},art:{provider:'openai',model:'sdxl-turbo'},say:{provider:'custom',model:'kokoro'},mm:{provider:'minimax',model:''},lastTurn:{provider:'openai',model:'gpt-4o'},invoice:{provider:'claude',model:'claude-x'}}};
assert.deepEqual(ids(D.findNodes(dual.dual_ext,STS)).sort(),['invoice','lastTurn','mm'],'image/voice model names dropped; lastTurn · invoice kept (whole-word path check)');
const spots=(texts)=>D.autoSpots({root:dual.dual_ext,nodes:D.findNodes(dual.dual_ext,STS),owner:{name:'X',texts},sources:STS}).map(s=>s.node.path.join('.')).sort();
assert.deepEqual(spots([`const a = 1;`]),['invoice','lastTurn'],'empty model needs a chat call in the source');
assert.deepEqual(spots([`fetch('/api/backends/chat-completions/generate')`]),['invoice','lastTurn','mm']);
assert.deepEqual(ids(D.findNodes({s:{lastTurn:{provider:'openai',model:'x'}},t:{embedApi:{source:'openai',model:'x'}},u:{stt:{provider:'openai',model:'x'}}},STS)).sort(),['s.lastTurn']);
console.log('PASS dual-use providers: flux/sdxl/kokoro dropped, empty model needs a chat call, path words matched whole');

// 자리 이름 · 개수: 여러 곳이면 확장 이름 · 아는 낱말 또는 번호, 저장해 둔 여러 벌(presets.*)은 빼고, 4곳까지
const many={provider:'openai',model:'a',analysis:{provider:'openai',model:'b'},summary:{provider:'openai',model:'c'},presets:{p1:{provider:'openai',model:'d'},p2:{provider:'openai',model:'e'}},x1:{provider:'openai',model:'f'},x2:{provider:'openai',model:'g'}};
const named=D.autoSpots({root:many,nodes:D.findNodes(many,STS),owner:{name:'TTS',texts:[]},sources:STS});
assert.equal(named.length,4,'at most 4 spots');
assert.ok(!named.some(s=>s.node.path[0]==='presets'),'saved presets skipped');
assert.deepEqual(named.map(s=>s.name),['TTS 1','TTS · 분석','TTS · 요약','TTS 4']);
assert.deepEqual(D.autoSpots({root:tts.lemon_voice,nodes:D.findNodes(tts.lemon_voice,STS),owner:{name:'TTS',texts:ttsTexts},sources:STS}).map(s=>s.name),['TTS'],'one spot → extension name only');
console.log('PASS spot names: Korean words or numbers, presets skipped, capped at 4');

// 확장 표기(anthropic · gemini · OpenAI · mistral) — 실리태번 공급자로 읽고, 그 확장의 표기로 돌려 쓴다
const al={al_ext:{provider:'anthropic',models:{anthropic:'claude-x',OpenAI:'gpt-4o'}}};
[t]=targetsOf(al,'al_ext',{texts:[`const P = ['anthropic','OpenAI','gemini','mistral'];`]});
assert.deepEqual(t.read(),{source:'claude',model:'claude-x',url:''});
assert.deepEqual(t.sources,['openai','claude','makersuite','mistralai']);
t.apply({source:'openai',model:'gpt-5'});
assert.deepEqual(al.al_ext,{provider:'OpenAI',models:{anthropic:'claude-x',OpenAI:'gpt-5'}},'written back as OpenAI (its own spelling, same map key)');
t.apply({source:'makersuite',model:'gemini-3'});
assert.equal(al.al_ext.provider,'gemini');assert.equal(al.al_ext.models.gemini,'gemini-3');
t.apply({source:'claude',model:'claude-y'});
assert.deepEqual(t.read(),{source:'claude',model:'claude-y',url:''});assert.equal(al.al_ext.provider,'anthropic');
console.log('PASS provider aliases: anthropic/OpenAI/gemini/mistral read as ST sources and written back in the extension spelling');

// 실리태번 설정 꼴: chat_completion_source + claude_model · openai_model · google_model …
const mir={mir_ext:{chat_completion_source:'claude',claude_model:'c1',openai_model:'o1',google_model:'g1',custom_model:'',custom_url:'',temp:1}};
assert.deepEqual(D.findNodes(mir.mir_ext,STS).map(n=>[n.path.join('.'),n.perModel,n.urlKey]),[['',true,'custom_url']]);
[t]=targetsOf(mir,'mir_ext',{texts:[`chat_completion_sources.CUSTOM`]});
assert.deepEqual(t.read(),{source:'claude',model:'c1',url:''});
before=clone(mir);
t.apply({source:'makersuite',model:'g2'});
assert.deepEqual(changed(before,mir),['mir_ext.chat_completion_source','mir_ext.google_model']);
t.apply({source:'custom',model:'relay',url:'http://r/v1'});
assert.deepEqual(t.read(),{source:'custom',model:'relay',url:'http://r/v1'});
console.log('PASS ST-mirror layout: per-source *_model keys (google_model for makersuite)');

// 표(이름이 history 가 아님) + 모델 한 칸, 연결 방식 칸 없음 → 둘 다 쓴다
const both={both_ext:{provider:'openai',model:'gpt-4o',default_models:{openai:'gpt-4o'}}};
[t]=targetsOf(both,'both_ext',{texts:[`['openai','claude']`]});
t.apply({source:'claude',model:'c1'});
assert.deepEqual(both.both_ext,{provider:'claude',model:'c1',default_models:{openai:'gpt-4o',claude:'c1'}},'map and single model both written when there is no mode field');
// 지금 값 makersuite 가 소스의 'google' 글자보다 먼저
const mk2={mk_ext:{provider:'makersuite',models:{makersuite:'g'}}};
[t]=targetsOf(mk2,'mk_ext',{texts:[`const engine = 'google'; translate(engine); const L = ['openai','google'];`]});
t.apply({source:'makersuite',model:'g2'});
assert.deepEqual(mk2.mk_ext,{provider:'makersuite',models:{makersuite:'g2'}},'current spelling wins over a google literal');
// 주소 칸 이름이 url 인데 지금이 custom 이 아니면 주소를 모른다 → 읽은 주소가 달라 모델 전환이 '주소는 그대로'로 알린다
const u={u_ext:{provider:'openai',model:'x',url:'https://api.openai.com/v1'}};
[t]=targetsOf(u,'u_ext',{texts:[`const L = ['openai','custom'];`]});
t.apply({source:'custom',model:'relay',url:'http://relay/v1'});
assert.notEqual(t.read().url,'http://relay/v1');assert.equal(u.u_ext.url,'https://api.openai.com/v1','url field untouched');
// 얼린 바깥 + 얼지 않은 안쪽 표: 기본값의 표에 쓰지 않는다
const DEF=Object.freeze({provider:'openai',models:{openai:'a'}});
const fz2={fz2:{direct:DEF}};
[t]=targetsOf(fz2,'fz2',{texts:[`['openai','claude']`]});
t.apply({source:'claude',model:'zz'});
assert.deepEqual(DEF.models,{openai:'a'},'shared default map untouched');assert.equal(fz2.fz2.direct.models.claude,'zz');
// 등록 path 가 배열이어도 겹침을 뺀다
assert.equal(D.skipRegistered(D.findNodes(deep.deep_ext,STS),'deep_ext',[{settingsKey:'deep_ext',path:['a','b','c']}]).length,0);
console.log('PASS review fixes: map + model written together, current spelling first, url-less custom reported, shared default map copied, array registry path');
