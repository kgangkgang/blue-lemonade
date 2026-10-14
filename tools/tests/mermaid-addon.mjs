// Mermaid 도표 (내장) — vendor 가 원작 dist 와 같은지 · vendor/index.js 를 두 곳만 고쳤는지 · 도표가 있을 때만 불러오는지 · 등록 배선.
//   node tools/tests/mermaid-addon.mjs .        (네트워크 없음 · 가짜 DOM)
//   MERMAID_UPSTREAM=<원작 저장소> 를 주면 그 dist/ 와 바이트로도 비교한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const rootUrl = pathToFileURL(root + path.sep);
const read = rel => fs.readFileSync(path.join(root, rel));
const text = rel => read(rel).toString('utf8').replace(/\r\n/g, '\n');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); } }

// 원작 SillyTavern/Extension-Mermaid 62265d550ca3 의 dist/ (파일 → sha256)
const UPSTREAM = {
 'index.js': 'eed304995ce1d95468c8b824c33cc379506a3b0fe2a90432cfade51e1d872cf8',
 '9.index.js': '14ada36d9a23a53dc7d813d5d24e1262b8fc605cd73a40aabfb82cadfdd5921b',
 '32.index.js': '2247ec25b1d30a63ccb70ba0a645cd01ab5c68d3abfd6a1bd22ab2602d1946c5',
 '127.index.js': 'aa4709ffc69c975d7bc8544a0ff30ba90e972ad471a79ac4061c7bf9a04dd295',
 '130.index.js': 'aa3d851f858e1443f0bd88317108569c3e6a7f79b0270e454185d6ebd02ee82f',
 '142.index.js': 'eeac4e6f5e2c7665e941e88b77369f20c5896ddc73f4342bc2262622e9135b8d',
 '149.index.js': '1e568064fa17733ac119ec31c0358e41e44e05e22cf35faabdf7078e516478b4',
 '164.index.js': 'f4382c579c9e893ed2a2c4b67167f48bac87b5b58f8bb4508eb960476afcd649',
 '165.index.js': 'a9f8e1d491feb474ccacb9ef601bfe81d4c2a22b0c233f86edfd90fdc6a0e3e0',
 '203.index.js': 'bf354dd16afa1db366f7c3f6f1db9dab1d23da92584f77e02dc214f8c6403c4e',
 '217.index.js': '05d6ab8c0f4ac639d8b5dcc73ff06b85f54ff8a136df9962fe62da19cccac931',
 '225.index.js': '18dab7e1abdbab8fe82f55d26054c29c228dae431f454d9326a6d2fb2b4935b8',
 '241.index.js': '9e1d319c3740d77e7abf8d11f7dc7f8bde40c075e412015512750b53ce4fc468',
 '249.index.js': '730ab7ac2c0b63e7d187d80063a6fba135f11002d8b56b8285921aaafd376787',
 '291.index.js': '0208be48f470cbac64f6e5a4b6e1aee3210b0a156a55b3832ba8eb3c1a56e31b',
 '312.index.js': '3fe4f229b6fbfdf77ffbc8546909c21f8f39950824932764a6220fea18f48fda',
 '356.index.js': '3af16a09f53748c2230f55f1c017cb767cea0e2816dad88c9b2e1d68d77e51b4',
 '412.index.js': '1bad1ecfd1c167290e5fb64241a5d65d2d01625439b3e59a55ffd2857d60fff7',
 '480.index.js': '746155ba6f220cedb669a0016f865134aa0d495febe4079046382d3f3c326456',
 '492.index.js': 'b4a5a7291d227261113a1766a24a1aeb83dca4a5b1ab7ea88b89e2e6078df8a8',
 '510.index.js': 'bcd98903503b9a45e106a5c75161506358ab1dac804308859c858a569153536e',
 '567.index.js': '71ecfb1ee439c056cc0caa19bde31e08df8124d510cef28a1c8cc5fbb9e9122f',
 '592.index.js': 'c47bf84b3e65d7decfec17b139544d7a35da8ddd063fca9181b103cd4ddca445',
 '616.index.js': 'ebbe9fe444e1c37237cd5a0dced59a3dde92a9d0d709137226424c444291b94f',
 '620.index.js': '11b454402bbdac18d4116de8bd60c9ce337e93b63ac938f62b63f67d0f1c120c',
 '672.index.js': '197d92fbc86a4234c1965b7f21295a34710ceed4a036bd54ac985754470cd1d8',
 '731.index.js': 'e77ef3bfa038cf4f8b591351634ac5662d8e1b4e1d485452fd6439f20eaf6945',
 '732.index.js': 'ef0eb1b2e89e9135860f91e2d91ec7b1f9754b41c3f96c04e91f461b49f5a944',
 '746.index.js': 'c7d623a00751d242edbceec8cf5a4653f34d11b73f063e3134e7fb957fd32c61',
 '756.index.js': '9cf47c6976b9b3154f899790e6b05dbe095f7e348299eac23dfc6ada1028247a',
 '795.index.js': '3264f93f7aed2ad03972a4578727381789287a99ffae9be8b55160dd063186bc',
 '802.index.js': '1cc13c01846c67a953e5fadfe22ef40f557370fdea2aa51ea7a1c0b6e8372c98',
 '815.index.js': '482ba5cb1b1ccb66a4758deed57f03866316f7429990e13022fea739f18682d2',
 '821.index.js': '71ae1faa7ac10dddfd87ce1fa6e990dfc7b15615b52ebc44396b4f5fe122e69a',
 '822.index.js': '3f84a923b9d3e3a91804ebdc9f3cac4c3343323fe754758eb7d895a7d6ab993a',
 '903.index.js': '3cae277aa41d261fd6f65bb2a596e0157ed4db0f0e62ab1cbeb002e890f4cc00',
 '928.index.js': '221df43e0fb59217014e092c3048638b9f1f173c336451d927a67a779d96b682',
 '948.index.js': 'd82c7c10f788c36ba487bf334120e02df9da9bf00aad2f0b0d351192b33d8728',
 '955.index.js': 'd660bc919d040991af25a98f23640b7619a1624c42a2a60a074affe2317c818f',
 '981.index.js': '6879a2e34d59cbd4b4b0d29f079614b4066f4d080b5ef6427a455e6810032afa',
 '992.index.js': '406ff3590aaa4a6f9da7bd735e2a172a7975306022d2e265996d92097ee07c62',
 '996.index.js': '5423820e1bc366b093434c1a07f0aa8e5c40c158aa1037e248d56ae5f2c7866d',
};
// The shipped vendor may differ only by the documented engine-bridge transforms.
await test('42 pinned upstream files, isolated namespace and exact integration bridge', () => {
 const manifest=JSON.parse(text('src/addons/mermaid/source/upstream-sha256.json'));
 assert.deepEqual(manifest,UPSTREAM);
 const actual=JSON.parse(text('src/addons/mermaid/source/vendor-sha256.json'));
 assert.deepEqual(fs.readdirSync(path.join(root,'src/addons/mermaid/vendor')).sort(),Object.keys(UPSTREAM).sort());
 for(const [name,hash] of Object.entries(actual))assert.equal(sha(read('src/addons/mermaid/vendor/'+name)),hash,name);
 for(const name of Object.keys(UPSTREAM)){
  const bundle=text('src/addons/mermaid/vendor/'+name);
  assert.ok(bundle.includes('webpackChunkblue_lemonade_mermaid'));
  assert.ok(!bundle.includes('webpackChunkextension_mermaid'));
  if(name!=='index.js')assert.equal(sha(Buffer.from(bundle.replaceAll('webpackChunkblue_lemonade_mermaid','webpackChunkextension_mermaid'))),UPSTREAM[name]);
 }
 const entry=text('src/addons/mermaid/vendor/index.js');
 assert.ok(entry.includes('globalThis.__blMermaidEngine=Ue'));
 assert.ok(!entry.includes('SillyTavern.getContext()'));
 assert.ok(!entry.includes('securityLevel:"loose"'));
 assert.ok(entry.includes('e="blue_lemonade_mermaid:"'));
});
await test('AGPL source, MIT/dependency notices and public source UI links',()=>{
 assert.ok(read('src/addons/mermaid/LICENSE').equals(read('LICENSE')));
 const notice=text('src/addons/mermaid/NOTICE.md');
 for(const word of ['62265d550ca3dc46737c09bddf0bf328fd1f3469','source/README.md','source/rebuild.py','| mermaid | 11.12.3 | MIT |','| dompurify | 3.2.6 |','| katex | 0.16.22 | MIT |','| d3 | 7.9.0 | ISC |','| chevrotain | 11.1.2 | Apache-2.0 |','Copyright (c) 2014 - 2022 Knut Sveidqvist'])assert.ok(notice.includes(word),word);
 for(const rel of ['src/index.js','src/style.css','webpack.config.js','package.json','package-lock.json']){
  assert.ok(read('src/addons/mermaid/source/'+rel).length);
  assert.ok(read('src/addons/mermaid/source/upstream/'+rel).length);
 }
 const credits=text('src/credits.js');assert.ok(credits.includes('https://github.com/SillyTavern/Extension-Mermaid'));assert.ok(credits.includes('./addons/mermaid/source/README.md'));
 assert.ok(text('THIRD-PARTY-NOTICES.md').includes('src/addons/mermaid/NOTICE.md'));
 for(const file of ['source/rebuild.py','source/package-lock.json','source/vendor-sha256.json','NOTICE.md','LICENSE'])assert.ok(text('tools/release_gate.py').includes("'"+file+"'"),file);
});

await test('등록 배선 — 이름 · 아이콘 · 시작 · 목록 · 새로고침 · 세부 설정 · 출처', async () => {
    const src = text('src/addons.js');
    for (const part of ["mermaid:'Mermaid 도표'", "mermaid:'fa-diagram-project'", "}else if(id==='mermaid'){\n            module=await import('./addons/mermaid/index.js');",
        "'customstyle','mermaid','tts','words']){", "'customstyle','mermaid','tts'].includes(id)", "addonOpen==='mermaid'){(await import('./addons/mermaid/index.js')).openPanel();return;}",
        "id==='mermaid'?import('./addons/mermaid/index.js'):", 'instructions.mermaid=', "credits.mermaid=['Cohee1207 · Extension-Mermaid','https://github.com/SillyTavern/Extension-Mermaid']"]) assert.ok(src.includes(part), part);
    const saved = { enabled: true, addons: { mermaid: true } };
    globalThis.SillyTavern = { getContext: () => ({ extensionSettings: { salty: saved } }) };
    const { getSettings, DEFAULTS } = await import(new URL('src/settings.js', rootUrl));
    assert.equal(DEFAULTS.addons.mermaid, false, '기본은 꺼짐');
    const s = getSettings();
    assert.equal(s.addons.mermaid, true);
    const { addonMarkup } = await import(new URL('src/addons.js', rootUrl));
    const html = addonMarkup(s, 'mermaid');
    for (const part of ['fa-diagram-project', 'Mermaid 도표', 'data-addon-toggle="mermaid" checked', '도표가 있을 때만', '기존 단독 확장과는 둘 중 하나만 켜 주세요.', 'href="https://github.com/SillyTavern/Extension-Mermaid"', 'data-addon-inline="mermaid"', 'data-addon-open="mermaid"']) assert.ok(html.includes(part), part);
    s.addons.mermaid = false;
    assert.ok(!addonMarkup(s, 'mermaid').includes('data-addon-toggle="mermaid" checked'));
    const { DUPLICATES, knownConflicts } = await import(new URL('src/assist/core.js', rootUrl));
    assert.deepEqual(DUPLICATES.mermaid, ['Extension-Mermaid', 'mermaid']);
    assert.deepEqual(knownConflicts(['third-party/Extension-Mermaid'], [], { mermaid: true }).map(x => x.code), ['duplicate-mermaid']);
    assert.deepEqual(knownConflicts(['third-party/Extension-Mermaid'], ['third-party/Extension-Mermaid'], { mermaid: true }), []);
    const { SETTING_LABELS } = await import(new URL('src/settings-labels.js', rootUrl));
    assert.equal(SETTING_LABELS['addons.mermaid'], '확장: Mermaid 도표');
    const { settingRoute } = await import(new URL('src/settings-differences.js', rootUrl));
    assert.deepEqual(settingRoute('addons.mermaid'), { tab: 'extensions', sub: 'mermaid' });
    assert.ok(text('src/settings-search.js').includes("['extensions','mermaid','Mermaid 도표',"));
    assert.ok(text('src/settings-search.js').includes("mermaid:'Mermaid 도표'"));
    assert.ok(text('src/panel.js').includes("['mermaid','Mermaid 도표']"));
    assert.ok(text('.github/workflows/release-check.yml').includes('node tools/tests/mermaid-addon.mjs .'));
    delete globalThis.SillyTavern;
});

// Minimal DOM tests exercise scheduling and preservation; actual SVG is tested in the isolated browser QA.
const TYPES={CHARACTER_MESSAGE_RENDERED:'cmr',USER_MESSAGE_RENDERED:'umr',CHAT_CHANGED:'cc',MESSAGE_SWIPED:'ms',MESSAGE_UPDATED:'mu',MORE_MESSAGES_LOADED:'mml'};
let generation=0;
function world({initial=[],camel=false}={}){
 const scripts=[],handlers={},codes=[],renders=[];
 for(const k of ['webpackChunkextension_mermaid','webpackChunkblue_lemonade_mermaid','__blMermaidEngine','__blMermaidBase'])delete globalThis[k];
 class El{
  constructor(tag){this.tag=tag;this.children=[];this.isConnected=false;this.textContent='';this.className='';this.hidden=false;this.attrs={};this.classList={add:(...ns)=>{this.className=[...new Set([...this.className.split(' '),...ns])].join(' ')},remove:(...ns)=>{this.className=this.className.split(' ').filter(x=>!ns.includes(x)).join(' ')}};}
  append(...els){for(const e of els){e.parentElement=this;e.isConnected=this.isConnected;this.children.push(e)}}
  remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this)}
  setAttribute(k,v){this.attrs[k]=v}
  closest(s){return s==='#chat'&&this.isConnected?chat:null}
  set innerHTML(v){this._html=v;if(v.startsWith('<p ')){this.children=[];this.append(new El('p'),new El('button'))}}
  querySelector(s){return this.children.find(e=>e.tag===s)}
  replaceChildren(...els){this.children=[];this.append(...els)}
 }
 const chat=new El('chat');chat.isConnected=true;chat.scrollTop=20;chat.scrollHeight=1000;chat.clientHeight=300;
 const body=new El('body');body.isConnected=true;
 const add=source=>{const pre=new El('pre'),code=new El('code');pre.isConnected=true;code.textContent=source;code.className='language-mermaid';pre.append(code);codes.push(code);return code};
 initial.forEach(add);
 globalThis.document={scripts,body,head:{append(e){e.isConnected=true;scripts.push(e)}},createElement:tag=>new El(tag),querySelectorAll:()=>codes.filter(x=>x.isConnected),getElementById:id=>id==='chat'?chat:scripts.find(x=>x.id===id&&x.isConnected)};
 globalThis.SillyTavern={getContext:()=>({[camel?'eventTypes':'event_types']:TYPES,eventSource:{on(type,fn){(handlers[type]??=[]).push(fn)}}})};
 let fail=false,delay=null,config;
 const execute=script=>{globalThis.webpackChunkblue_lemonade_mermaid=[];globalThis.__blMermaidEngine={initialize(c){config=c},async render(id,source){renders.push(source);if(delay)await delay;if(fail)throw Error('test parse/chunk failure');return {svg:'<svg aria-roledescription="flowchart"></svg>'}}};script.onload()};
 const fire=async(...ns)=>{for(const n of ns)for(const f of handlers[n]||[])f();await sleep(0)};
 return {scripts,handlers,add,codes,chat,execute,fire,renders,El,get config(){return config},set fail(v){fail=v},set delay(v){delay=v}};
}
const loadAddon=()=>import(new URL('src/addons/mermaid/index.js',rootUrl).href+'?case='+(++generation));
const settle=()=>sleep(110);
await test('No blocks: six events never request vendor; camelCase eventTypes supported',async()=>{
 const w=world({camel:true});await loadAddon();await w.fire(...Object.values(TYPES));await settle();assert.equal(w.scripts.length,0);assert.equal(Object.keys(w.handlers).length,6);
});
await test('Single lazy load; one render despite simultaneous events; later blocks render on MORE_MESSAGES_LOADED',async()=>{
 const w=world();const m=await loadAddon();assert.equal(m.VERSION,'1.0.0');const code=w.add('flowchart TD; A-->B');await w.fire('cmr','cc','mu');assert.equal(w.scripts.length,1);
 w.execute(w.scripts[0]);await settle();assert.equal(w.renders.length,1);assert.equal(code.hidden,true);assert.equal(code.textContent,'flowchart TD; A-->B');assert.equal(w.config.securityLevel,'strict');assert.equal(w.config.startOnLoad,false);
 await w.fire('cmr','umr','ms','mu','cc');await settle();assert.equal(w.renders.length,1);w.add('sequenceDiagram\n A->>B: ok');await w.fire('mml');await settle();assert.equal(w.renders.length,2);assert.equal(w.scripts.length,1);assert.equal(w.chat.scrollTop,20,'reader scroll does not jump');
});
await test('Main script failure is retryable without duplicate scripts/listeners',async()=>{
 const w=world({initial:['flowchart TD; A-->B']});await loadAddon();w.scripts[0].onerror();await sleep(10);assert.equal(w.scripts[0].isConnected,false);await w.fire('mu');assert.equal(w.scripts.length,2);w.execute(w.scripts[1]);await settle();assert.equal(w.renders.length,1);assert.equal(w.handlers.mu.length,1);
});
await test('Syntax/chunk failure retains source; failed block retries only explicitly or after edit',async()=>{
 const w=world({initial:['bad input']});await loadAddon();w.fail=true;w.execute(w.scripts[0]);await settle();const code=w.codes[0];assert.equal(code.hidden,false);assert.equal(code.textContent,'bad input');assert.equal(code.parentElement.children.length,2);
 await w.fire('cmr','mu');await settle();assert.equal(w.renders.length,1);
 w.fail=false;code.parentElement.children[1].children[1].onclick();await settle();assert.equal(w.renders.length,2);assert.equal(code.hidden,true);assert.equal(code.parentElement.children.filter(x=>x.className==='bl-mermaid-error').length,0);
 code.textContent='flowchart LR; X-->Y';await w.fire('mu');await settle();assert.equal(w.renders.length,3);assert.equal(code.parentElement.children.filter(x=>x.className==='bl-mermaid-output').length,1);
});
await test('Official Mermaid first or before lazy load yields without vendor load',async()=>{
 let w=world({initial:['flowchart TD; A-->B']});globalThis.webpackChunkextension_mermaid=[];const m=await loadAddon();assert.equal(m.duplicate,true);assert.equal(w.scripts.length,0);assert.equal(Object.keys(w.handlers).length,0);
 w=world();await loadAddon();globalThis.webpackChunkextension_mermaid=[];w.add('flowchart TD; A-->B');await w.fire('cmr');await settle();assert.equal(w.scripts.length,0);
});
await test('Official script pending is detected before its webpack global exists',async()=>{
 const w=world({initial:['flowchart TD; A-->B']});w.scripts.push({src:'http://localhost/scripts/extensions/third-party/Extension-Mermaid/dist/index.js'});const m=await loadAddon();assert.equal(m.duplicate,true);assert.equal(Object.keys(w.handlers).length,0);
});
await test('Detached messages cannot receive stale render output',async()=>{
 const w=world({initial:['flowchart TD; A-->B']});await loadAddon();let release;w.delay=new Promise(r=>release=r);w.execute(w.scripts[0]);await sleep(10);w.codes[0].isConnected=false;release();await settle();assert.equal(w.codes[0].parentElement.children.length,1);
});
for(const key of ['document','SillyTavern','webpackChunkextension_mermaid','webpackChunkblue_lemonade_mermaid','__blMermaidEngine','__blMermaidBase'])delete globalThis[key];
console.log(`${failed?'FAIL':'PASS'} mermaid add-on: ${passed} passed, ${failed} failed`);if(failed)process.exit(1);
