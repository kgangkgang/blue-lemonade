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
class Element {
    constructor(tag='style') { this.tagName=tag.toUpperCase();this.id='';this.dataset={};this.media='all';this.isConnected=false;this.events=new Map();this.textContent=''; }
    after(node) { node.remove();list.splice(list.indexOf(this)+1,0,node);node.isConnected=true; }
    remove() { const at=list.indexOf(this);if(at>=0)list.splice(at,1);this.isConnected=false; }
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
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const full=()=>document.getElementById('salty-lazy-css');
const ext=()=>document.getElementById('salty-ext-css');
const tail=()=>document.getElementById('salty-panel-css');
const prepared=style=>{readyCount++;style.media='all';};
const reset=()=>{for(const n of [...list])if(n!==main)n.remove();main.sheet.disabled=false;timers.clear();};
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
        let resolve;globalThis.fetch=()=>{requests++;return new Promise(done=>resolve=done);};
        const job=loadFullCss(main.sheet,prepared,()=>true);await settle();
        assert.equal(main.sheet.disabled,false);assert.equal(full().media,'not all');assert.equal(full().dataset.blFullTheme,'loading');
        resolve(response(fullText));assert.equal(await job,true);
        assert.equal(full().textContent,fullText.split('#salty-lazy-panel-start {}')[0]);
        assert.equal(tail().textContent,'\n.tail{gap:3px}');assert.equal(readyCount,1);
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
        reset();let resolve;globalThis.fetch=()=>new Promise(done=>resolve=done);
        const job=loadFullCss(main.sheet,prepared,()=>true);await settle();
        syncThemeSheet(false);const stale=ext();syncThemeSheet(true);assert.equal(ext(),null);
        resolve(response(fullText));assert.equal(await job,true);
        stale.sheet={cssRules:[1]};stale.fire('load');stale.fire('error');
        assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,false);assert.equal(themeSheetState().failed,false);
    });
    await test('확장만 모드가 먼저 준비된 경우 전체 파일이 도착해도 테마를 켜지 않아요',async()=>{
        reset();syncThemeSheet(false);const copy=ext();copy.sheet={cssRules:[1],disabled:false};copy.fire('load');
        globalThis.fetch=async()=>response(fullText);
        assert.equal(await loadFullCss(main.sheet,prepared,()=>false),true);
        assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,true);assert.equal(ext(),copy);
        syncThemeSheet(true);assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,false);
    });
    await test('잘못된 전체 파일은 첫 시트를 끄지 않고 끝나며 다음 시도에서 복구해요',async()=>{
        reset();globalThis.fetch=async()=>response('.broken{color:red}');
        assert.equal(await loadFullCss(main.sheet,prepared,()=>true),false);assert.equal(full(),null);assert.equal(main.sheet.disabled,false);
        globalThis.fetch=async()=>response(fullText);
        assert.equal(await loadFullCss(main.sheet,prepared,()=>true),true);assert.equal(main.sheet.disabled,true);assert.equal(timers.size,0);
    });
    await test('받기 오류는 대기를 끝내고 실패한 노드를 없애요',async()=>{
        reset();globalThis.fetch=async()=>{throw Error('받기 실패 시험');};
        assert.equal(await loadFullCss(main.sheet,prepared,()=>true),false);assert.equal(full(),null);assert.equal(main.sheet.disabled,false);assert.equal(timers.size,0);
    });
    await test('응답이 오지 않아도 제한 시간 뒤 끝나고 늦은 응답은 화면을 바꾸지 않아요',async()=>{
        reset();let resolve;globalThis.fetch=()=>new Promise(done=>resolve=done);
        const job=loadFullCss(main.sheet,prepared,()=>true);await settle();
        for(const fn of [...timers.values()])fn();assert.equal(await job,false);
        assert.equal(full(),null);assert.equal(main.sheet.disabled,false);
        const count=readyCount;resolve(response(fullText));await settle();assert.equal(readyCount,count);assert.equal(full(),null);
    });
    await test('별도 꼬리 받기가 실패했어도 전체 파일에 담긴 원문 꼬리로 정상 준비해요',async()=>{
        reset();globalThis.fetch=async()=>response(fullText);
        assert.equal(tail(),null);assert.equal(await loadFullCss(main.sheet,prepared,()=>true),true);
        assert.equal(tail().textContent,'\n.tail{gap:3px}');assert.equal(main.sheet.disabled,true);
    });
    await test('splitCssReady는 겹친 호출을 공유하고 모듈 받기 실패 뒤 재시도해요',async()=>{
        reset();let tries=0;globalThis.fetch=async()=>response(fullText);
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
        globalThis.fetch=async()=>response(fullText);await loadFullCss(main.sheet,prepared,()=>true);
        syncThemeSheet(false);ext().fire('error');
        assert.equal(ext(),null);assert.equal(main.sheet.disabled,true);assert.equal(full().sheet.disabled,false);assert.equal(themeSheetState().failed,true);
    });
} finally { globalThis.setTimeout=realSet;globalThis.clearTimeout=realClear; }
console.log(`전체 CSS 생명주기: ${passed}개 통과했어요.`);
