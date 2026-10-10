// Real analysis/text/library/store with only SillyTavern and network I/O mocked.
// No account, voice generation or user data is used.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'), 'src/addons/tts/src');
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const T = globalThis.__sfxTimingTest = { ext: {}, saves: 0, calls: 0, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Test', characters: [], groups: [] } };
T.ctx.saveChat = async () => { T.saves++; };
const G = 'const T=globalThis.__sfxTimingTest;';
const stubs = {
    'script.js': data(G + `export const chat=T.ctx.chat; export const event_types={}; export const eventSource={on(){},makeLast(){},emit(){}};
export const substituteParams=t=>String(t??''); export const getRequestHeaders=()=>({}); export function saveSettingsDebounced(){} export async function saveSettings(){}
export function syncMesToSwipe(){} export const main_api='openai'; export function generateRaw(){throw Error('Unexpected LLM')}`),
    'extensions.js': data(G + 'export const extension_settings=T.ext; export const extensionNames=[]; export const getContext=()=>T.ctx; export function saveMetadataDebounced(){}'),
    'utils.js': data('export const getStringHash=s=>String(s).length; export const splitRecursive=t=>[String(t??"")];'),
    'secrets.js': data('export const secret_state={};'),
};
register(data(`let D;export function initialize(d){D=d}export async function resolve(spec,ctx,next){const base=spec.split('/').pop();if(String(ctx.parentURL||'').includes('/addons/tts/')&&spec.split('../').length>3&&D[base])return {url:D[base],shortCircuit:true};return next(spec,ctx)}`), { data: stubs });
globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://mock.invalid/v1/chat/completions'); T.calls++;
    const body = JSON.parse(init.body); assert.match(JSON.stringify(body), /durationMs/);
    return { ok:true,status:200,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({choices:[{message:{content:JSON.stringify(T.reply)}}],usage:{prompt_tokens:10,completion_tokens:10}}) };
};
const mod = name => import(pathToFileURL(path.join(root,name)).href);
const A=await mod('analysis.js'), S=await mod('settings.js'), Store=await mod('script-store.js');
Object.assign(S.settings(), { extras:'off', voices:[], sfx:{enabled:true,auto:true,custom:[]} });
Object.assign(S.settings().analysis,{enabled:true,engine:'compat',base:'https://mock.invalid/v1',key:'mock-key',model:'mock',emotion:false,translate:false,speaker:false,context_chars:1200});
const bot = text => ({mes:text,name:'Test',is_user:false,extra:{},swipe_id:0});
const build = text => A.buildPrompt(bot(text),{emotion:false,translate:false,speaker:false});
const timing = (text,id,values={},after=0) => A.normalizeSfx([{after,id,...values}],build(text))[0];
const L=await import(pathToFileURL(path.join(root,'sfx-library.js')).href);
const plain = cue => ({repeats:cue.repeats,durationMs:cue.durationMs});
let passed=0,failed=0;
async function test(name, fn) { try { await fn();passed++;console.log('PASS '+name); } catch(error) {failed++;console.error('FAIL '+name+'\n'+error.stack);} }

await test('single actions cannot be multiplied by model timing',()=>{
    for (const [text,id] of [['물건을 떨어뜨렸다.','drop'],['동전이 바닥으로 떨어졌다.','daily_coins'],['He dropped a box.','drop']])
        assert.deepEqual(plain(timing(text,id,{repeats:4,durationMs:8000})),{repeats:1,durationMs:0});
});
await test('explicit Korean and English counts are bounded to the stated event',()=>{
    for (const text of ['물건을 두 번 떨어뜨렸다.','물건을 2회 떨어뜨렸다.','He dropped a box twice.','He dropped a box two times.'])
        assert.equal(timing(text,'drop',{repeats:4}).repeats,2);
    assert.equal(timing('동전을 세 번 떨어뜨렸다.','daily_coins',{repeats:3}).repeats,3);
    assert.equal(timing('He dropped a box ten times.','drop',{repeats:100}).repeats,4);
});
await test('unrelated numbers, ordinal, dialogue, negation and other anchors do not multiply',()=>{
    for(const text of ['두 사람이 물건을 떨어뜨렸다.','두 번째 물건을 떨어뜨렸다.','두 번 웃고, 물건을 떨어뜨렸다.','두 번 웃고 물건을 떨어뜨렸다.','He waved twice and dropped a box.','He waved twice while dropping a box.','He did not drop the box twice.','물건을 두 번 떨어뜨릴 뻔했다.','"물건을 두 번 떨어뜨렸어." 물건을 떨어뜨렸다.'])
        assert.equal(timing(text,'drop',{repeats:4},text.startsWith('"')?1:0).repeats,1,text);
    assert.equal(timing('He dropped it twice. "Hello." He dropped it.', 'drop',{repeats:4},1).repeats,1);
});
await test('typing for a while gets one bounded sustained cue',()=>{
    for(const text of ['한동안 키보드로 타이핑했다.','She typed for a while.'])
        assert.deepEqual(plain(timing(text,'daily_keyboard',{repeats:4,durationMs:20000})),{repeats:1,durationMs:8000});
    assert.equal(timing('잠깐 키보드로 타이핑했다.','daily_keyboard',{durationMs:6000}).durationMs,2500);
});
await test('explicit sustain seconds use source duration including fractional seconds',()=>{
    assert.equal(timing('키보드로 3초 동안 타이핑했다.','daily_keyboard',{durationMs:8000}).durationMs,3000);
    assert.equal(timing('She typed for 2.5 seconds.','daily_keyboard',{durationMs:8000}).durationMs,2500);
    assert.equal(timing('고양이가 20초 동안 골골거렸다.','daily_cat_purr',{durationMs:8000}).durationMs,8000);
});
await test('continuous sound classes support bounded duration, impacts do not',()=>{
    for(const [text,id] of [['고양이가 한동안 골골거렸다.','daily_cat_purr'],['한동안 수돗물이 흘렀다.','daily_faucet'],['한동안 시냇물이 흘렀다.','daily_stream'],['비가 한동안 쏟아졌다.','daily_rain']])
        assert.equal(timing(text,id,{durationMs:5000}).durationMs,5000);
    assert.equal(timing('한동안 동전이 떨어졌다.','daily_coins',{durationMs:8000}).durationMs,0);
    assert.equal(timing('한동안 물건을 떨어뜨렸다.','drop',{durationMs:8000}).durationMs,0);
});
await test('1.5.3 kettle and toothbrush sustain, phone and fridge count, single actions stay single',()=>{
    assert.equal(timing('전기주전자가 5초 동안 끓었다.','daily_electric_kettle',{durationMs:8000}).durationMs,5000);
    assert.equal(timing('한동안 양치질을 했다.','daily_toothbrush',{durationMs:6000}).durationMs,6000);
    assert.equal(timing('잠깐 이를 닦았다.','daily_toothbrush',{durationMs:6000}).durationMs,2500);
    assert.deepEqual(plain(timing('전기주전자가 끓었다.','daily_electric_kettle',{repeats:3,durationMs:8000})),{repeats:1,durationMs:0});
    assert.equal(timing('휴대폰이 두 번 진동했다.','daily_phone_vibration',{repeats:2}).repeats,2);
    assert.equal(timing('냉장고 문을 세 번 여닫았다.','daily_fridge_door',{repeats:3}).repeats,3);
    assert.equal(timing('한동안 냉장고 문을 열어 두었다.','daily_fridge_door',{durationMs:8000}).durationMs,0);
    for(const [text,id] of [['펜 뚜껑을 닫았다.','daily_pen_cap'],['의자를 끌었다.','daily_chair_slide'],['휴대폰이 진동했다.','daily_phone_vibration']])
        assert.deepEqual(plain(timing(text,id,{repeats:4,durationMs:8000})),{repeats:1,durationMs:0},text);
});
await test('1.5.6 long narration keeps the sound sentences for the model instead of only the head and tail',()=>{
    const filler='Lorem ipsum dolor amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';
    assert.equal(L.matchSfx(filler),null);
    const parts=[];for(let i=0;i<24;i++)parts.push(`${filler} "Line ${i}."`);
    parts.push(`${filler} He slapped the table twice. ${filler}`,'"Last line."',`${filler} The door creaked open.`);
    const text=parts.join('\n\n');
    const p=A.buildPrompt(bot(text),{emotion:false,translate:false,speaker:false,context_chars:1200});
    const scene=p.sfxScene.map(g=>g.text).join('\n');
    assert.ok(text.length>8000&&p.sfx,'long message with sfx');
    assert.ok(/slapped the table twice/.test(scene)&&/door creaked open/.test(scene),'sound sentences kept');
    assert.ok(scene.length<=4600,`budget ${scene.length}`);
    assert.ok(p.sfxAfters.includes(24)&&p.sfxAfters.includes(25),p.sfxAfters.join(','));
    assert.equal(timing(text,'punch',{repeats:2},24).repeats,2);   // 남긴 문장으로 횟수도 읽는다
});
await test('1.5.8 sfx.scene_chars sets the narration budget and is clamped to 1,000~40,000',()=>{
    const filler='Lorem ipsum dolor amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';
    const parts=[];for(let i=0;i<24;i++)parts.push(`${filler} "Line ${i}."`);
    parts.push(`${filler} He slapped the table twice. ${filler}`,'"Last line."',`${filler} The door creaked open.`);
    const text=parts.join('\n\n');
    const sceneOf=()=>A.buildPrompt(bot(text),{emotion:false,translate:false,speaker:false,context_chars:1200}).sfxScene.map(g=>g.text).join('\n');
    const narration=text.replace(/"[^"]*"/g,'').replace(/\s+/g,' ').trim().length;
    assert.equal(S.DEFAULTS.sfx.scene_chars,4000);
    assert.equal(S.sceneCharsOf(S.settings().sfx.scene_chars),4000,'missing or default value = 4,000');   // 이 검사의 가짜 설정은 sfx 를 통째로 바꿔 scene_chars 가 없다 → 기본값
    const base=sceneOf();
    S.settings().sfx.scene_chars=1500; const small=sceneOf();
    assert.ok(small.length<base.length&&small.length<=2100,`smaller budget ${small.length}`);
    assert.ok(/slapped the table twice/.test(small)&&/door creaked open/.test(small),'sound sentences still kept first');
    S.settings().sfx.scene_chars=12000; const big=sceneOf();
    assert.ok(big.length>base.length&&big.length>=narration*0.95,`budget above the message keeps everything ${big.length}/${narration}`);
    assert.ok(/"Line 3\."|Line 3/.test(text)&&!/Line 3\./.test(big),'dialogue is still not part of the narration excerpt');
    for(const [v,want] of [[undefined,4000],['abc',4000],[12,1000],[99999,40000],[6000.7,6000],['2500',2500]]) assert.equal(S.sceneCharsOf(v),want,String(v));
    S.settings().sfx.scene_chars='oops'; assert.equal(sceneOf().length,base.length,'bad stored value falls back to the default budget');
    S.settings().sfx.scene_chars=4000;
});
await test('absence or negation of duration cannot create an ambient loop',()=>{
    for(const text of ['키보드를 눌렀다.','키보드로 한동안 타이핑하지 않았다.','She did not type for a while.','She typed. Her friend waited for 8 seconds.'])
        assert.equal(timing(text,'daily_keyboard',{durationMs:8000}).durationMs,0,text);
});
await test('legacy and malformed model timing use safe defaults',()=>{
    for (const values of [{},{repeats:'2',durationMs:'5000'},{repeats:NaN,durationMs:Infinity},{repeats:-7,durationMs:-1},{repeats:2.5,durationMs:null}])
        assert.deepEqual(plain(timing('He dropped it twice.','drop',values)),{repeats:1,durationMs:0});
});
await test('prompt requests timing in the existing analysis and inactive prompt stays unchanged',()=>{
    const b=build('한동안 타이핑했다.'); assert.match(b.user,/"repeats":1,"durationMs":0/);assert.match(b.user,/sustain:true/);assert.match(b.user,/capped at 4/);assert.match(b.user,/never exceed 8000/);
    S.settings().sfx.enabled=false; const off=build('한동안 타이핑했다.'); assert.doesNotMatch(off.user,/durationMs|"sfx"/);
    assert.equal(off.user,A.buildPrompt(bot('한동안 타이핑했다.'),{emotion:false,translate:false,speaker:false,sfx:false}).user);S.settings().sfx.enabled=true;
});
await test('scene excerpt anchors and duplicate limits remain valid',()=>{
    const b=build('물건을 두 번 떨어뜨렸다. "Hello." 한동안 타이핑했다.');
    assert.deepEqual(A.normalizeSfx([{after:0,id:'drop',repeats:2},{after:0,id:'drop',repeats:4},{after:1,id:'daily_keyboard',durationMs:6000,strength:2},{after:2,id:'drop',repeats:4},{after:0,id:'bad-id'}],b),[
        {after:0,id:'drop',repeats:2,durationMs:0,strength:2},{after:1,id:'daily_keyboard',repeats:1,durationMs:6000,strength:2}]);
});
await test('one mocked analysis request preserves timing and reuses its cache',async()=>{
    T.ctx.chat.push(bot('물건을 두 번 떨어뜨렸다.'));
    T.reply={segs:[],sfx:[{after:0,id:'drop',repeats:2,durationMs:0}]};
    const a=await A.analyzeMessage(0); assert.equal(T.calls,1);assert.equal(a.sfx[0].repeats,2);
    assert.equal(await A.analyzeMessage(0),a);assert.equal(T.calls,1);
    S.settings().sfx.enabled=false;assert.equal(await A.analyzeMessage(0),a);assert.equal(T.calls,1);S.settings().sfx.enabled=true;
});
await test('new sound row timing round-trips while old VERSION=1 saves remain readable',async()=>{
    const mes=T.ctx.chat[0], identity=Store.scriptIdentity(0);
    const rows=await Store.saveScript(0,[{id:'fx',kind:'sfx',sfxId:'daily_keyboard',repeats:3,durationMs:4500}],identity);
    assert.equal(mes.extra.lemon_voice_script.version,1);assert.deepEqual(Store.resolveScript(mes),rows);assert.equal(rows[0].repeats,3);assert.equal(rows[0].durationMs,4500);
    delete mes.extra.lemon_voice_script.rows[0].repeats;delete mes.extra.lemon_voice_script.rows[0].durationMs;
    assert.deepEqual(plain(Store.resolveScript(mes)[0]),{repeats:1,durationMs:0});
});
await test('manual timing is bounded and cannot leak into voice or pause rows',()=>{
    const out=Store.normalizeRows([{kind:'sfx',repeats:99,durationMs:999999},{kind:'sfx',repeats:0,durationMs:-4},{kind:'sfx',repeats:'2',durationMs:'3500'},{kind:'voice',repeats:4,durationMs:8000},{kind:'pause',repeats:4,durationMs:8000}]);
    assert.deepEqual(out.map(plain),[{repeats:4,durationMs:8000},{repeats:1,durationMs:0},{repeats:2,durationMs:3500},{repeats:1,durationMs:0},{repeats:1,durationMs:0}]);
    assert.throws(()=>Store.normalizeRows([{kind:'sfx',durationMs:Infinity}]),/숫자/);
});
console.log(`\n${passed} passed; ${failed} failed`);if(failed)process.exitCode=1;
