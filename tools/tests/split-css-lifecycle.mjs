// 원래 모듈을 가짜 문서/받기로 실행해 전체 시트의 교체·실패·재시도를 확인해요.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(process.argv[2] || '.');
const list = [], timers = new Map(); let nextTimer = 0, requests = 0, readyCount = 0;
const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
globalThis.setTimeout = fn => { const id=++nextTimer;timers.set(id,fn);return id; };
globalThis.clearTimeout = id => timers.delete(id);
const sheetOf=text=>{const cssRules=text.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>({selectorText:l.slice(0,l.indexOf('{')).trim(),cssText:l}));return {disabled:false,cssRules,deleteRule(i){cssRules.splice(i,1);}};};
// 전체 시트는 <link> — 붙으면 「받기」(globalThis.fetch 흉내)를 거쳐 load · error 를 쏴요(꺼진 media 여도 받아요)
// 미리 받기(rel=preload)로 붙으면 받은 글만 쥐고 load → 코드가 rel 을 stylesheet 로 바꾸면 그 글로 시트를 만들고 load 를 한 번 더(실제 브라우저처럼)
const linkLoad=node=>Promise.resolve().then(()=>globalThis.fetch(node.href)).then(async r=>{if(!r.ok)throw Error('HTTP');return r.text();}).then(text=>{node.fetched=text;if(node.rel==='stylesheet')node.sheet=sheetOf(text);node.fire('load');},()=>node.fire('error'));
let preloads=0;
class Element {
    constructor(tag='style') { this.tagName=tag.toUpperCase();this.id='';this.dataset={};this.media='all';this.isConnected=false;this.events=new Map();this.textContent='';this.relValue='';this.relList={supports:v=>v==='preload'}; }
    get rel() { return this.relValue; }
    set rel(v) { const was=this.relValue;this.relValue=v;if(v==='preload')preloads++;if(was==='preload'&&v==='stylesheet'&&this.isConnected&&this.fetched!=null)Promise.resolve().then(()=>{this.sheet=sheetOf(this.fetched);this.fire('load');}); }
    after(node) { node.remove();list.splice(list.indexOf(this)+1,0,node);node.isConnected=true;if(node.tagName==='LINK'&&node.id==='salty-lazy-css'&&!node.loading){node.loading=true;linkLoad(node);} }
    remove() { const at=list.indexOf(this);if(at>=0)list.splice(at,1);this.isConnected=false; }
    get nextElementSibling() { const at=list.indexOf(this);return at>=0?list[at+1]||null:null; }
    addEventListener(name,fn) { this.events.set(name,fn); }
    fire(name) { this.events.get(name)?.(); }
    set textContent(text) { this.text=String(text);if(this.tagName==='STYLE')this.sheet={disabled:false,cssRules:text.trim()?[1]:[]}; }
    get textContent() { return this.text; }
}
const main=new Element('link');main.href=pathToFileURL(path.join(root,'style.css')).href;main.sheet={disabled:false,cssRules:[1]};main.sheet.ownerNode=main;main.isConnected=true;list.push(main);
globalThis.document={
    getElementById:id=>list.find(n=>n.isConnected&&n.id===id)||null,
    querySelectorAll:()=>list.filter(n=>n.tagName==='LINK'),
    createElement:tag=>new Element(tag),
};
const { loadFullCss }=await import(pathToFileURL(path.join(root,'src/split-css.js')));
const { syncThemeSheet, themeSheetState }=await import(pathToFileURL(path.join(root,'src/theme-sheet.js')));
const fullText=':root{--a:1}\n.card{padding:1px}\n.card{padding:2px}\n#salty-lazy-panel-start {}\n.tail{gap:3px}';
const response=text=>({ok:true,text:async()=>text});
const TAIL='\n.tail{gap:3px}';
// 서랍 꼬리 파일(lazy-panel.gen.css)은 따로 — 시험마다 바꾸지 않으면 바로 줘요
let tailServe=async()=>response(TAIL);
const route=fn=>(url,...rest)=>String(url).includes('lazy-panel.gen.css')?tailServe(url):fn(url,...rest);
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const full=()=>document.getElementById('salty-lazy-css');
const ext=()=>document.getElementById('salty-ext-css');
const tail=()=>document.getElementById('salty-panel-css');
const prepared=style=>{readyCount++;style.media='all';};
const reset=()=>{for(const n of [...list])if(n!==main)n.remove();main.sheet.disabled=false;timers.clear();tailServe=async()=>response(TAIL);};
function liteLoader(loadModule) {
    const text=fs.readFileSync(path.join(root,'src/lite.js'),'utf8');
    const code=text.slice(text.indexOf('let splitRequest = null;'),text.indexOf('// 1.0.0 크로미움 밖',text.indexOf('let splitRequest = null;')))
        .replace(/export /g,'').replace("import('./split-css.js')",'loadModule()');
    const env={document,splitBuild:()=>main.sheet,loadModule,themeEnabled:x=>x,getSettings:()=>true,panelStyle:null,panelCount:0,panelObserving:true,syncPanelCss(){},watchPanelOpen(){}};
    return new Function('env',`with(env){${code};return {loadSplitCss,splitCssReady};}`)(env);
}
let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
try {
    await test('전체 시트를 받기 전에는 첫 시트를 유지하고 성공 뒤 중복 없이 교체해요',async()=>{
        let resolve;globalThis.fetch=route(()=>{requests++;return new Promise(done=>resolve=done);});
        const job=loadFullCss(main.sheet,prepared,()=>true);await settle();
        assert.equal(main.sheet.disabled,false);assert.equal(full().rel,'preload','받는 동안은 미리 받기 — 시트가 아니에요');assert.equal(full().dataset.blFullTheme,'loading');
        resolve(response(fullText));assert.equal(await job,true);
        // <link> 로 받아요(글을 담지 않아요) · 꼬리(경계 포함)는 떼고 서랍 전용 칸은 따로 써 둔 꼬리 파일 원문
        assert.equal(full().tagName,'LINK');assert.equal(full().rel,'stylesheet');assert.ok(preloads>=1,'미리 받기로 붙여요(실리태번 dynamic-styles 가 붙는 시트만 훑어요)');assert.match(full().href,/style-lazy\.gen\.css$/);assert.equal(full().text,'');
        assert.deepEqual(full().sheet.cssRules.map(r=>r.selectorText),[':root','.card','.card']);
        assert.equal(tail().textContent,TAIL);assert.equal(readyCount,1);
        assert.ok(list.indexOf(main)<list.indexOf(full())&&list.indexOf(full())<list.indexOf(tail()),'차례: 첫 장 → 전체 장 → 서랍 전용');
        assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,false);assert.equal(full().dataset.blFullTheme,'ready');
        assert.deepEqual(themeSheetState(),{main:true,boot:false,full:true,ext:false,failed:false});assert.equal(timers.size,0);
    });
    await test('확장만 모드와 다시 켜기 모두 준비된 전체 시트와 경량 시트 한 벌만 켜요',async()=>{
        syncThemeSheet(false);assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,false);
        const copy=ext();copy.sheet={disabled:false,cssRules:[1]};copy.fire('load');
        assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,true);
        syncThemeSheet(true);assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,false);assert.equal(ext(),null);
    });
    await test('전체 시트를 받는 동안 껐다가 다시 켜도 늦은 경량 시트가 화면을 끄지 않아요',async()=>{
        reset();let resolve;globalThis.fetch=route(()=>new Promise(done=>resolve=done));
        const job=loadFullCss(main.sheet,prepared,()=>true);await settle();
        syncThemeSheet(false);const stale=ext();syncThemeSheet(true);assert.equal(ext(),null);
        resolve(response(fullText));assert.equal(await job,true);
        stale.sheet={cssRules:[1]};stale.fire('load');stale.fire('error');
        assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,false);assert.equal(themeSheetState().failed,false);
    });
    await test('확장만 모드가 먼저 준비된 경우 전체 파일이 도착해도 테마를 켜지 않아요',async()=>{
        reset();syncThemeSheet(false);const copy=ext();copy.sheet={cssRules:[1],disabled:false};copy.fire('load');
        globalThis.fetch=route(async()=>response(fullText));
        assert.equal(await loadFullCss(main.sheet,prepared,()=>false),true);
        assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,true);assert.equal(ext(),copy);
        syncThemeSheet(true);assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,false);
    });
    await test('잘못된 전체 파일은 첫 시트를 끄지 않고 끝나며 다음 시도에서 복구해요',async()=>{
        reset();globalThis.fetch=route(async()=>response('.broken{color:red}'));
        assert.equal(await loadFullCss(main.sheet,prepared,()=>true),false);assert.equal(full(),null);assert.equal(main.sheet.disabled,false);
        globalThis.fetch=route(async()=>response(fullText));
        assert.equal(await loadFullCss(main.sheet,prepared,()=>true),true);assert.equal(main.sheet.disabled,true);assert.equal(timers.size,0);
    });
    await test('받기 오류는 대기를 끝내고 실패한 노드를 없애요',async()=>{
        reset();globalThis.fetch=route(async()=>{throw Error('받기 실패 시험');});
        assert.equal(await loadFullCss(main.sheet,prepared,()=>true),false);assert.equal(full(),null);assert.equal(main.sheet.disabled,false);assert.equal(timers.size,0);
    });
    await test('응답이 오지 않아도 제한 시간 뒤 끝나고 늦은 응답은 화면을 바꾸지 않아요',async()=>{
        reset();let resolve;globalThis.fetch=route(()=>new Promise(done=>resolve=done));
        const job=loadFullCss(main.sheet,prepared,()=>true);await settle();
        for(const fn of [...timers.values()])fn();assert.equal(await job,false);
        assert.equal(full(),null);assert.equal(main.sheet.disabled,false);
        const count=readyCount;resolve(response(fullText));await settle();assert.equal(readyCount,count);assert.equal(full(),null);
    });
    await test('별도 꼬리 받기가 실패했어도 전체 파일에 담긴 꼬리 규칙으로 정상 준비해요',async()=>{
        reset();globalThis.fetch=route(async()=>response(fullText));tailServe=async()=>{throw Error('꼬리 받기 실패 시험');};
        assert.equal(tail(),null);assert.equal(await loadFullCss(main.sheet,prepared,()=>true),true);
        assert.equal(tail().textContent,'.tail{gap:3px}');assert.equal(main.sheet.disabled,true);
        assert.deepEqual(full().sheet.cssRules.map(r=>r.selectorText),[':root','.card','.card']);
    });
    await test('서랍 전용 칸이 이미 있으면(시작 때 첫 장에서 옮김) 꼬리 파일을 다시 받지 않고 그 칸을 그대로 써요',async()=>{
        reset();let tails=0;tailServe=async()=>{tails++;return response(TAIL);};globalThis.fetch=route(async()=>response(fullText));
        const own=document.createElement('style');own.id='salty-panel-css';own.media='not all';own.textContent=TAIL;main.after(own);
        let got=null;assert.equal(await loadFullCss(main.sheet,style=>{got=style;},()=>true),true);
        assert.equal(tails,0);assert.equal(got,own);assert.equal(tail(),own);assert.equal(own.textContent,TAIL);
        assert.deepEqual(full().sheet.cssRules.map(r=>r.selectorText),[':root','.card','.card']);
        assert.equal(main.sheet.disabled,true);assert.equal(full().media,'all');
    });
    await test('교체는 한 작업 — 서랍 칸 연결 · 전체 장 켜기 · 첫 장 끄기 사이에 기다림이 없어요(소스 차례)',async()=>{
        const src=fs.readFileSync(path.join(root,'src/split-css.js'),'utf8');
        const on=src.slice(src.indexOf('// 여기부터 한 작업'),src.indexOf('finish(true);'));
        assert.ok(on.length>20&&!/await|then\(|setTimeout|requestAnimationFrame/.test(on),'켜는 구간에 기다림 없음');
        assert.match(on,/readyPanel\(panel\);\s*link\.dataset\.blFullTheme = 'ready'; link\.media = 'all';\s*syncThemeSheet\(themeOn\(\)\);/);
        assert.ok(!/createElement\('style'\)[^;]*;[^\n]*salty-lazy-css/.test(src)&&/link\.rel = 'stylesheet'/.test(src),'전체 장은 <link>');
    });
    await test('splitCssReady는 겹친 호출을 공유하고 모듈 받기 실패 뒤 재시도해요',async()=>{
        reset();let tries=0;globalThis.fetch=route(async()=>response(fullText));
        const loader=liteLoader(()=>++tries===1?Promise.reject(Error('모듈 받기 실패')):Promise.resolve({loadFullCss}));
        const one=loader.splitCssReady(),same=loader.splitCssReady();assert.equal(one,same);assert.equal(await one,false);
        assert.equal(full(),null);assert.equal(await loader.splitCssReady(),true);assert.equal(tries,2);
        assert.equal(full().dataset.blFullTheme,'ready');assert.equal(main.sheet.disabled,true);assert.equal(timers.size,0);
    });
    await test('splitCssReady는 로더 모듈 무응답도 끝내고 늦은 모듈로 CSS를 되살리지 않아요',async()=>{
        reset();let resolve;const loader=liteLoader(()=>new Promise(done=>resolve=done));
        const job=loader.splitCssReady();for(const fn of [...timers.values()])fn();assert.equal(await job,false);
        resolve({loadFullCss});await settle();assert.equal(full(),null);assert.equal(main.sheet.disabled,false);assert.equal(timers.size,0);
    });
    await test('경량 사본 받기 실패는 준비된 전체 시트로 돌아가고 첫 시트를 중복으로 켜지 않아요',async()=>{
        globalThis.fetch=route(async()=>response(fullText));await loadFullCss(main.sheet,prepared,()=>true);
        syncThemeSheet(false);ext().fire('error');
        assert.equal(ext(),null);assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,false);assert.equal(themeSheetState().failed,true);
    });
} finally { globalThis.setTimeout=realSet;globalThis.clearTimeout=realClear; }
console.log(`전체 CSS 생명주기: ${passed}개 통과했어요.`);
