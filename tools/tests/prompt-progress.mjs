// Actual body/title runners with synthetic model replies; no network or user data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/prompt/index.js'), 'utf8');
const regex = fs.readFileSync(path.join(root, 'src/addons/prompt/regex-ui.js'), 'utf8');
const helpers = await import(pathToFileURL(path.join(root, 'src/addons/prompt/translation-progress.js')));
const section = (start, end) => { const a=src.indexOf(start),b=src.indexOf(end,a); assert(a>=0&&b>a,start); return src.slice(a,b); };
class Element {
    constructor(tag='div') { this.tagName=tag; this.children=[]; this.style={}; this.dataset={}; this.className=''; this._text=''; this.classes=new Set(); this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v)}; }
    append(...nodes) { for(const node of nodes){node.parent=this;this.children.push(node);} }
    remove() { if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this); }
    set textContent(v) { this._text=String(v);this.onText?.(this._text); }
    get textContent() { return this._text; }
    querySelector(selector) { return this.querySelectorAll(selector)[0]||null; }
    querySelectorAll(selector) { return this.children.flatMap(n=>[(selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):n.tagName===selector)?n:null,...n.querySelectorAll(selector)]).filter(Boolean); }
}
const rows = n => Array.from({length:n},(_,i)=>({id:String(i),name:`Fixture-${String(i+1).padStart(2,'0')}`,content:`Source ${i}`}));
const tick = async () => { for(let i=0;i<12;i++) await Promise.resolve(); };
function setup({items=rows(3),lanes=1,reply=async()=> 'Translated body',titleReply=async names=>names.map(n=>'제목 '+n),cache=new Map(),titles=new Map()}={}) {
    const history=[],status=new Element(),dot=new Element(),wrap=new Element(),bar=new Element(),label=new Element(),list=new Element(),stop=new Element();
    status.onText=text=>history.push(text); const rendered=new Map();
    const ctx={...helpers,console:{warn(){},error(){}},clearTimeout(){},setTimeout(){throw Error('Unexpected auto-reset');},
        PDOC:{getElementById:id=>id==='pt-status-text'?status:dot,createElement:tag=>new Element(tag)},
        getCached:(_ns,id)=>cache.get(id),getTranslatedTitle:(_ns,id)=>titles.get(id),setCache:(_ns,id,value)=>cache.set(id,value),setCacheTitle:(_ns,id,value)=>titles.set(id,value),
        setBlockHTML:(_list,id,html)=>rendered.set(id,html),esc:text=>String(text).replaceAll('<','&lt;'),translateText:(...args)=>reply(...args),
        translateTitleBatch:(...args)=>titleReply(...args),concurrency:()=>lanes,requestDelayMs:()=>0,titleBatchSize:()=>4,
        updateCacheStatsUI(){},confirm:()=>true,isRetryableError:e=>!!e.timeout,EXT:'test',
    };
    vm.createContext(ctx);
    vm.runInContext(section('let isBusy=false, stopReq=false', '// Each tab registers')+
        section('const NOTE_LABEL =', '// ── Translation ─')+
        section('function splitTitleAndBody(', '// Helper used by JSON exporters')+
        section('function translationForReading(', 'function makeBlockItem(')+
        section('async function runTranslation(', '// ── Export Module')+
        section('async function runTitleTranslation(', '// ── Page factory'),ctx);
    const args={items,list,ns:'pt-preset::Synthetic',pBar:bar,pLabel:label,pWrap:wrap,btnStop:stop,forceRetranslate:false,mode:'body'};
    return {ctx,args,history,status,bar,label,wrap,stop,cache,titles,rendered,run:extra=>ctx.runTranslation({...args,...extra}),title:extra=>ctx.runTitleTranslation({...args,...extra})};
}
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}

await test('20 handled is 2 successes + 18 named failures, not 20 translations; retry only failures',async()=>{
    const items=rows(20);let retryIds,retryMode,retryForce;
    const h=setup({items,lanes:3,reply:async name=>{
        const i=Number(name.slice(-2));if(i<=2)return 'Translated '+i;if(i<=8)return '';
        if(i<=14)throw Object.assign(Error('요청 시간 초과'),{timeout:true});throw Object.assign(Error('HTTP 500'),{status:500});
    }});
    const result=await h.run({onRetry:(ids,mode,force)=>{retryIds=ids;retryMode=mode;retryForce=force;}});
    assert.equal(result.success,2);assert.equal(result.failed,18);assert.equal(h.cache.size,2);
    assert.equal(h.bar.style.width,'100%');assert.match(h.label.textContent,/처리 20\/20.*성공 2.*실패 18/);
    assert.match(h.status.textContent,/일부 실패/);assert.doesNotMatch(h.status.textContent,/Fixture-/);
    assert.equal(h.wrap.querySelectorAll('li').length,18);assert.match(h.wrap.querySelectorAll('li')[0].textContent,/Fixture-03.*빈 응답/);
    h.wrap.querySelector('button').onclick();assert.equal(retryIds.length,18);assert.equal(retryMode,'body');assert.equal(retryForce,false);
    const old=h.cache.get('0'),called=[];h.ctx.translateText=async name=>{called.push(name);return 'Recovered';};
    // Existing selection must not redirect the failed-only retry.
    h.args.list.querySelectorAll=()=>[{dataset:{id:'0'}}];
    const retry=await h.run({targetIds:retryIds});assert.equal(retry.success,18);assert.equal(h.cache.get('0'),old);assert.equal(called.length,18);assert(!called.includes('Fixture-01'));
    assert.equal(h.wrap.querySelector('.pt-run-result'),null);assert.match(h.status.textContent,/완료/);assert.doesNotMatch(h.status.textContent,/Fixture-/);
});
await test('empty source is skipped without a paid call; heading-only and empty annotation replies fail',async()=>{
    const empty=setup({items:[{id:'e',name:'',content:''}],reply:()=>{throw Error('Must not call');}});
    assert.equal((await empty.run()).skipped,1);
    const body=setup({items:rows(1),reply:async()=> '### Only a title'});assert.equal((await body.run()).failed,1);assert.equal(body.cache.size,0);
    const note=setup({items:rows(1),reply:async()=> '{{// ========\n[내용 번역]\n========}}'});
    assert.equal((await note.run({mode:'note'})).failed,1);assert.equal(note.cache.size,0);assert.match(note.status.textContent,/주석/);
});
await test('cache reuse is never active; stopping discards late reply and counts all unfinished items',async()=>{
    let resolve;const h=setup({items:rows(4),cache:new Map([['0','Existing result']]),reply:()=>new Promise(r=>{resolve=r;})});
    const pending=h.run();await tick();assert(h.history.some(t=>t.includes('Fixture-02 번역 중')));assert(!h.history.some(t=>t.includes('Fixture-01')));
    h.ctx.requestStop();assert.match(h.status.textContent,/중단 중/);assert.doesNotMatch(h.status.textContent,/Fixture-/);
    resolve('late result');const result=await pending;assert.equal(result.cached,1);assert.equal(result.success,0);assert.equal(result.stopped,3);assert.equal(result.failed,0);assert.equal(h.cache.size,1);assert.equal(h.bar.style.width,'25%');assert.equal(h.stop.disabled,true);
});
await test('parallel active names follow completion order and show at most two + remaining count',async()=>{
    const deferred=new Map();const h=setup({items:rows(4),lanes:3,reply:name=>new Promise(r=>deferred.set(name,r))});
    const pending=h.run();await tick();assert.match(h.status.textContent,/Fixture-01, Fixture-02 외 1개 번역 중/);
    deferred.get('Fixture-02')('Second');await tick();assert.match(h.status.textContent,/Fixture-01, Fixture-03 외 1개/);assert.doesNotMatch(h.status.textContent,/Fixture-02/);
    deferred.get('Fixture-04')('Fourth');deferred.get('Fixture-01')('First');deferred.get('Fixture-03')('Third');
    const result=await pending;assert.equal(result.success,4);assert.equal(result.failed,0);assert.equal(h.cache.size,4);
});
await test('retry of failed retranslation preserves the previous body and annotation until success',async()=>{
    const initial='Old translated body\n{{// ========\n[내용 번역]\n\nOld note\n\n========}}';
    const h=setup({items:rows(1),cache:new Map([['0',initial]]),reply:async()=>{throw Error('HTTP 429');}});
    let retried;const failed=await h.run({forceRetranslate:true,mode:'note',onRetry:(ids,mode,force)=>{retried={targetIds:ids,mode,forceRetranslate:force};}});
    assert.equal(failed.failed,1);assert.equal(h.cache.get('0'),initial);h.wrap.querySelector('button').onclick();assert.equal(retried.forceRetranslate,true);
    h.ctx.translateText=async()=> 'Fresh note';const success=await h.run(retried);assert.equal(success.success,1);assert.match(h.cache.get('0'),/^Old translated body/);assert.match(h.cache.get('0'),/Fresh note/);assert.doesNotMatch(h.cache.get('0'),/Old note/);
});
await test('fresh run clears old names/counters; selected title-only body entries never request translation',async()=>{
    const h=setup({items:[{...rows(1)[0],titleOnly:true}]});assert.equal(await h.run(),undefined);assert.equal(h.history.length,0);
    h.args.items=rows(1);await h.run();h.args.items=[{id:'new',name:'Brand-new',content:'New'}];h.ctx.translateText=()=>new Promise(()=>{});
    h.run();await tick();assert.match(h.status.textContent,/0\/1.*Brand-new/);assert.doesNotMatch(h.status.textContent,/Fixture-/);
});
await test('title split retries display the actual child batch and count reused titles separately',async()=>{
    const items=rows(5),calls=[];let h;
    h=setup({items,titles:new Map([['4','Existing title']]),titleReply:async names=>{calls.push({names:[...names],status:h.status.textContent});return names.length>2?null:names.map(n=>'제목 '+n);}});
    const result=await h.title({ns:'pt-wi::Synthetic'});assert.equal(result.success,4);assert.equal(result.cached,1);assert.equal(result.failed,0);
    assert.equal(calls.length,3);assert.match(calls[0].status,/월드인포 · 제목.*Fixture-01, Fixture-02 외 2개/);
    assert.match(calls[2].status,/Fixture-03, Fixture-04 번역 중/);assert.doesNotMatch(calls[2].status,/Fixture-01|Fixture-05/);assert.doesNotMatch(h.status.textContent,/Fixture-/);
});
await test('empty title batch fails with names/reasons; cancellation has no false success toast',async()=>{
    const h=setup({items:rows(4),titleReply:async()=>{throw Object.assign(Error('empty reply'),{__empty:true});}});
    const result=await h.title({ns:'pt-char::Synthetic'});assert.equal(result.failed,4);assert.equal(result.success,0);assert.equal(h.titles.size,0);assert.match(h.status.textContent,/봇카드.*일부 실패/);assert.match(h.wrap.querySelector('li').textContent,/빈 응답/);
    let resolve;const stopped=setup({items:rows(4),titleReply:()=>new Promise(r=>{resolve=r;})});const pending=stopped.title();await tick();stopped.ctx.requestStop();resolve(['a','b','c','d']);const end=await pending;assert.equal(end.stopped,4);assert.equal(end.success,0);assert.equal(stopped.titles.size,0);
});
await test('title parsing failures and exhausted split budget cannot inflate success count',async()=>{
    const h=setup({items:rows(4),titleReply:async()=>null});const result=await h.title();assert.equal(result.failed,4);assert.equal(result.success,0);assert(result.failures.every(x=>x.reason));assert.equal(h.titles.size,0);
});
await test('names are bounded, Unicode-safe and text-only; reporter keeps full failure name safely',async()=>{
    const name='😀'.repeat(80)+'<img src=x onerror=alert(1)>';
    const text=helpers.activeTranslationText({ns:'regex',part:'제목',rows:[{name},{name:'Second'},{name:'Third'}],done:1,total:3});
    assert.match(text,/외 1개/);assert.doesNotMatch(text,/�|<img/);assert(Array.from(text).length<100);
    const wrap=new Element();helpers.renderTranslationResult({createElement:t=>new Element(t)},wrap,{failed:1,failures:[{id:'1',name,reason:'<script>bad</script>'}]});assert.equal(wrap.querySelector('li').textContent,`${name} — <script>bad</script>`);assert.equal(wrap.querySelector('li').children.length,0);
});
await test('reading note first leaves canonical cache, editing and export text unchanged',async()=>{
    const h=setup();const source='Original source';
    const value='### Translated title\n\n'+source+'\n{{// ========\n[내용 번역]\n\nTranslated note\n\n========}}';
    const reading=h.ctx.translationForReading(value,source);assert.match(reading,/Translated note/);assert.doesNotMatch(reading,/Original source/);assert.match(reading,/^### Translated title/);
    assert.match(value,/Original source[\s\S]*Translated note/);
    const fullyTranslated=value.replace(source,'Translated body');assert.equal(h.ctx.translationForReading(fullyTranslated,source),fullyTranslated);
    assert.equal(h.ctx.translationForReading('Ordinary translation',source),'Ordinary translation');assert.equal(h.ctx.translationForReading(null,source),null);
    const headingSource='### Original heading\n\nOriginal body';
    const noteOnly=headingSource+'\n{{// ========\n[내용 번역]\n\nTranslated note\n\n========}}';
    assert.doesNotMatch(h.ctx.translationForReading(noteOnly,headingSource),/Original/);
});
await test('regex names show active batch, preserve previous successful batch, and report malformed remainder',async()=>{
    const buttons=new Map(),status=new Element(),page=new Element(),selected=rows(12),history=[];status.onText=t=>history.push(t);let calls=0;
    page.querySelector=selector=>selector==='.pt-run-result'?page.children.find(x=>x.className==='pt-run-result')||null:(buttons.get(selector)||buttons.set(selector,{}).get(selector));
    const ctx={...helpers,rows:selected.map(r=>({...r,selected:true})),status,page,doc:{createElement:t=>new Element(t)},busy:false,stopped:false,progress:null,controls(){},paint(){},cancel(){},translate:async()=>{calls++;if(calls===2)return '[]';return JSON.stringify(Array.from({length:10},(_,i)=>({index:i,title:'번역 '+i})));}};
    vm.createContext(ctx);vm.runInContext(regex.slice(regex.indexOf('export function parseNameTranslations'),regex.indexOf('export function installRegexPage')).replace('export ',''),ctx);
    vm.runInContext(regex.slice(regex.indexOf(" page.querySelector('[data-regex-translate]').onclick="),regex.indexOf(" page.querySelector('[data-regex-apply]')")),ctx);
    await buttons.get('[data-regex-translate]').onclick();assert(history.some(t=>/Fixture-01, Fixture-02 외 8개/.test(t)));assert(history.some(t=>/Fixture-11, Fixture-12 번역 중/.test(t)));assert.match(status.textContent,/성공 10.*실패 2/);assert.doesNotMatch(status.textContent,/Fixture-/);assert.equal(ctx.rows.filter(r=>r.title).length,10);assert.equal(page.querySelectorAll('li').length,2);
});
console.log(`PASS ${passed} translation progress/result scenarios (API 0)`);
