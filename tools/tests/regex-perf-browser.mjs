// 실제 ST 엔진을 읽기 전용으로 제공하고 MIT 합성 자료로 결과 보존을 검사해요.
// 실행: ST_ROOT·CHROME_PATH·REGEX_BROWSER_DRIVER를 지정하고 node tools/tests/regex-perf-browser.mjs를 불러요.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createServer} from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(here,'../..');
const fixtures=path.join(here,'fixtures/regexperf-browser/harness');
assert.ok(process.env.ST_ROOT && process.env.CHROME_PATH && process.env.REGEX_BROWSER_DRIVER,'격리 검사 경로를 지정해 주세요');
const st=path.resolve(process.env.ST_ROOT,'public');
const {default:puppeteer}=await import(pathToFileURL(path.resolve(process.env.REGEX_BROWSER_DRIVER)));
const sourceFile=path.join(root,'src/addons/regexlink/regexperf.js');
const sourceHash=crypto.createHash('sha256').update(await fs.readFile(sourceFile)).digest('hex');
const real=p=>path.join(st,p), mock=p=>path.join(fixtures,'st',p);
const reads=new Map();
async function readReal(p){const data=await fs.readFile(real(p));reads.set(p,crypto.createHash('sha256').update(data).digest('hex'));return data;}
function functionCode(src,name,endMarker='\n}\n'){
 src=src.replace(/\r\n/g,'\n');
 const start=src.indexOf(`export function ${name}(`),end=src.indexOf(endMarker,start);
 assert.ok(start>=0&&end>start,`실제 함수 경계를 찾지 못했어요: ${name}`);
 return src.slice(start,end)+(endMarker==='\n}\n'?'\n}\n':'    return mes;\n}\n');
}
const exact={
 '/lib.js':mock('stubs.js'),'/scripts/power-user.js':mock('stubs.js'),'/scripts/secrets.js':mock('stubs.js'),
 '/scripts/extensions.js':mock('extensions.js'),'/scripts/preset-manager.js':mock('preset-manager.js'),
 '/':path.join(fixtures,'index.html'),
};
const allowed=new Set(['lib/jquery-3.5.1.min.js','lib/eventemitter.js','locales/lang.json','locales/ko-kr.json','scripts/events.js','scripts/i18n.js','scripts/message-formatter.js','scripts/extensions/regex/engine.js','scripts/extensions/regex/scriptTemplate.html']);
async function resolve(p){
 if(exact[p])return fs.readFile(exact[p]);
 if(p==='/script.js')return (await fs.readFile(mock('script.js'),'utf8')).replace('/* @messageFormatting */',()=>functionCode((awaitedScript),'messageFormatting','    if (power_user.auto_fix_generated_markdown) {'));
 if(p==='/scripts/utils.js')return (await fs.readFile(mock('utils.js'),'utf8')).replace('/* @regexFromString */',()=>functionCode(awaitedUtils,'regexFromString'));
 if(allowed.has(p.slice(1)))return readReal(p.slice(1));
 for(const [prefix,dir] of [['/harness/',fixtures],['/scripts/extensions/third-party/blue-lemonade/',root]]){
  if(!p.startsWith(prefix))continue;
  const target=path.resolve(dir,p.slice(prefix.length));
  if(!target.startsWith(dir+path.sep))throw Error('허용 경로 밖이에요');
  return fs.readFile(target);
 }
 throw Error(`허용하지 않은 요청이에요: ${p}`);
}
const awaitedScript=(await readReal('script.js')).toString(),awaitedUtils=(await readReal('scripts/utils.js')).toString();
const server=createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;const data=await resolve(decodeURIComponent(p));res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(p)]||'text/html','Cache-Control':'no-store'});res.end(data);}catch(e){res.writeHead(404);res.end(e.message);}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
let browser; const results=[];
async function open(variant='current',extra=''){
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.setRequestInterception(true);
 page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());
 await page.goto(`${base}/?variant=${variant}${extra}`);
 await page.waitForFunction('window.__ready===true',{timeout:15000}).catch(e=>{throw Error(errors.join('\n')||e.message)});
 assert.deepEqual(errors,[]);
 return {page,errors,run:(name,arg)=>page.evaluate((n,a)=>window.__run(n,a),name,arg),close:()=>page.close()};
}
async function test(name,fn){const start=Date.now();try{const detail=await fn();results.push({name,passed:true,ms:Date.now()-start,detail});console.log(`통과: ${name}`);}catch(e){results.push({name,passed:false,error:String(e.stack)});console.error(`실패: ${name}\n${e.stack}`);}}
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-first-run','--disable-background-networking','--lang=en-US']});
 for(const profile of ['default','allOff','allOn','tinyMemo','compromise'])await test(`실제 엔진 원문 동등성 ${profile}`,async()=>{
  const values={};for(const v of ['none','current']){const p=await open(v);try{values[v]=await p.run('equivalence',{profile});assert.deepEqual(p.errors,[]);}finally{await p.close();}}
  let count=0;assert.equal(values.none.records.length,values.current.records.length);
  for(let i=0;i<values.none.records.length;i++){const [label,value]=values.none.records[i];assert.equal(values.current.records[i][0],label);if(profile==='allOn'&&label.startsWith('live display'))continue;assert.equal(values.current.records[i][1],value,label);count++;}
  assert.ok(count>1500);return {records:count,nativePlain:values.none.nativeReplaces,nativeOptimized:values.current.nativeReplaces};
 });
 for(const name of ['caseFold','staleEdit','macroInMatch','persistNames'])await test(`실제 치환 경계 ${name}`,async()=>{const out=[];for(const v of ['none','current']){const p=await open(v);try{out.push(await p.run(name));}finally{await p.close();}}assert.deepEqual(out[1],out[0]);return out[1].length;});
 await test('빠른 치환·그룹·빈 매치·trim·macro 차등 8000개',async()=>{const p=await open();try{const r=await p.run('fastPathEquivalence',{seed:110707,scripts:1000});assert.equal(r.mismatch,null);assert.equal(r.compared,8000);return r;}finally{await p.close();}});
 await test('명령·JSON·CSV·수동 끄기 보존',async()=>{const p=await open();try{const r=await p.run('exports');assert.ok(JSON.parse(r.json).rows.length>=2);assert.equal(r.copied.length,2);assert.deepEqual(r.disabled,[false,true,true]);assert.ok(r.measureShown);return {copies:r.copied.length,disabled:r.disabled};}finally{await p.close();}});
 for(const name of ['dynamicFind','memoStatic','memoPostHoc','persistKey'])await test(`캐시·macro 경계 ${name}`,async()=>{const out=[];for(const v of ['none','current']){const p=await open(v);try{const r=await p.run(name);out.push(r.outs??r.out);}finally{await p.close();}}assert.deepEqual(out[1],out[0]);return out[1].length;});
 await test('검색어가 빈 결과 안내에서도 글자로만 보여요',async()=>{const p=await open();try{const cases=await p.page.evaluate(async()=> (await import('/harness/lifecycle.js')).filterText());for(const c of cases){assert.equal(c.children,0,'검색어로 HTML 요소를 만들면 안 돼요');assert.equal(c.injected,0);assert.ok(c.text.includes(c.value),'검색어를 글자 그대로 보여 줘요');}return cases;}finally{await p.close();}});
 await test('선행 엔진 패치에 양보해요',async()=>{const p=await open('current','&prewrap=1');try{const r=await p.page.evaluate(()=>window.__addon.regexPerfStatus());assert.equal(r.enabled,false);assert.equal(r.patched,false);return r;}finally{await p.close();}});
 await test('앱 준비 뒤 늦은 적재도 실제 준비 이벤트를 이어받아요',async()=>{const p=await open('current','&late=1');try{const r=await p.page.evaluate(()=>({status:window.__addon.regexPerfStatus(),command:!!window.__h.commands.regexperf}));assert.ok(r.status.enabled&&r.status.persistAvailable&&r.command);return r;}finally{await p.close();}});
 await test('실제 엔진 켬·끔·옛 객체·후발 패치·재연결',async()=>{const p=await open();try{const r=await p.page.evaluate(async()=> (await import('/harness/lifecycle.js')).lifecycle());assert.deepEqual([r.initial,r.off,r.late,r.final],['A','A','A','A']);assert.equal(r.oldOff,'끄기 뒤');assert.equal(r.oldOn,'다시 켠 뒤');assert.equal(r.status.enabled,false);assert.ok(r.yielded&&r.preserved&&r.resumed);return r;}finally{await p.close();}});
 await test('전역·프리셋·캐릭터 허용 조건과 전환',async()=>{const out=[];for(const v of ['none','current']){const p=await open(v);try{out.push(await p.page.evaluate(async()=> (await import('/harness/lifecycle.js')).scoped()));}finally{await p.close();}}assert.deepEqual(out[0],['C','C','D','P','G']);assert.deepEqual(out[1],out[0]);return out[1];});
 await test('측정 예외 뒤 다시 실행과 원문·설정 보존',async()=>{const p=await open();try{const r=await p.page.evaluate(async()=> (await import('/harness/lifecycle.js')).measureRecovery());assert.ok(r.rejected&&r.chatSame&&r.settingsSame);assert.equal(r.measured.messages,1);return r;}finally{await p.close();}});
 await test('스와이프·편집 뒤 영구 캐시 결과 보존',async()=>{const out=[];for(const v of ['none','current']){const p=await open(v);try{out.push(await p.page.evaluate(async()=> (await import('/harness/lifecycle.js')).swipes()));}finally{await p.close();}}assert.deepEqual(out[0],['[alpha]','[alpha]','[beta]','[alpha] [beta]','[alpha]']);assert.deepEqual(out[1],out[0]);return out[1];});
 for(const [kind,at]of [['off',1],['chat',1],['future',1],['past',4],['past',6],['reasoning',6],['author',6],['role',6],['system',6],['scripts',4],['scriptsSilent',6],['replace',6],['rename',4],['cycle',1],['stream',1]])await test(`측정 취소 ${kind} · 양보 ${at}`,async()=>{const p=await open();try{const r=await p.page.evaluate(async(k,a)=>(await import('/harness/lifecycle.js')).cancellation(k,a),kind,at);assert.equal(r.result,null,'변경 전후를 섞은 측정 결과를 남기면 안 돼요');assert.ok(r.settingsSame);assert.equal(r.savedChats,0);return r;}finally{await p.close();}});
}finally{
 if(browser)await browser.close();await new Promise(ok=>server.close(ok));
 assert.equal(crypto.createHash('sha256').update(await fs.readFile(sourceFile)).digest('hex'),sourceHash,'실행 중 엔진 소스가 바뀌었어요');
 for(const [name,sha]of reads)assert.equal(crypto.createHash('sha256').update(await fs.readFile(real(name))).digest('hex'),sha,`실제 ST 파일이 바뀌었어요: ${name}`);
 const report={passed:results.length>0&&results.every(r=>r.passed),sourceHash,browserClosed:!browser?.connected,serverClosed:!server.listening,realFiles:Object.fromEntries(reads),results};
 if(process.env.REGEX_REPORT)await fs.writeFile(process.env.REGEX_REPORT,JSON.stringify(report,null,2));
 console.log(`검사 ${results.length}개, 실패 ${results.filter(r=>!r.passed).length}개예요. 서버·브라우저를 종료했어요.`);
 if(!report.passed)process.exitCode=1;
}
