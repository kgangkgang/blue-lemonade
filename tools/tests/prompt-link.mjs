// 캐릭터 이름 연동 설정 (6.5.2 · 6.7.5 여러 줄, src/prompt-link.js) — 가짜 설정 · 작은 가짜 문서로 표시 · 저장 · 줄 추가/지우기 · 카드 고르기 · 맞추기 호출을 검사. 네트워크 · DOM 없음.
//   node tools/tests/prompt-link.mjs [테마 루트]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'../..'));
const source=fs.readFileSync(path.join(root,'src/prompt-link.js'),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replaceAll('export function ','function ')
  .replace("import('./promptbind.js')",'promptbindReady').replace("import('./prompt-card-picker.js')",'pickerReady');
const tick=()=>new Promise(r=>setTimeout(r,0));
const plain=v=>JSON.parse(JSON.stringify(v));   // vm 안에서 만든 객체는 원형이 달라 JSON 으로 견준다
function environment(){
  const settings={promptLink:{on:false,rows:[]}},calls=[],listeners=new Map();
  let report=rows=>({prompts:2,twins:1,regex:2,rows:rows.map(r=>r.word?{prompts:2,twins:1,regex:2}:{prompts:0,twins:0,regex:0})}),changed=3,fail=false,pickerFail=false,picked=null,focused=null;
  const promptbind={syncPromptBinds:async reason=>{calls.push('sync:'+reason);if(fail)throw Error('no manager');return changed;},linkReport:async rows=>{calls.push('report:'+rows.length);return report(rows);}};
  const picker={openPromptCardPicker:options=>{calls.push('picker');picked=options;}};
  const el=(extra={})=>({textContent:'',hidden:false,value:'',disabled:false,isConnected:true,focus(){focused=this;},...extra});
  const status=el();
  const rows=[];
  const box={isConnected:true,querySelector:sel=>{
    if(sel==='[data-prompt-link-status]')return status;
    if(sel==='[data-link-rows]')return list;
    if(sel==='[data-link-add]')return add;
    const m=/^\[data-link-row="(\d+)"\]$/.exec(sel);return m?rows[+m[1]]??null:null;}};
  const button=(attr,row)=>el({hasAttribute:n=>n===attr,closest:sel=>sel.includes(`[${attr}]`)?button.self:sel==='[data-prompt-link]'?box:sel==='[data-link-row]'?row:null});
  const add=(()=>{const b=button('data-link-add',null);button.self=b;return b;})();
  add.closest=sel=>sel.includes('[data-link-add]')?add:sel==='[data-prompt-link]'?box:null;
  function makeRow(i,html){
    const text=re=>(re.exec(html)?.[1]??'').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    const row={getAttribute:n=>n==='data-link-row'?String(i):null};
    const parts={'[data-link-hint]':el({textContent:text(/data-link-hint>([^<]*)</)}),'[data-link-cards]':el({textContent:text(/data-link-cards>([^<]*)</)}),'[data-link-found]':el({hidden:true})};
    const ctl=attr=>{const b=el({hasAttribute:n=>n===attr});b.closest=sel=>sel.split(',').some(s=>s.trim()===`[${attr}]`)?b:sel==='[data-prompt-link]'?box:sel==='[data-link-row]'?row:null;return b;};
    parts['[data-link-word]']=Object.assign(ctl('data-link-word'),{value:text(/value="([^"]*)"/)});parts['[data-link-remove]']=ctl('data-link-remove');parts.pick=ctl('data-link-pick');
    row.querySelector=sel=>parts[sel]??null;row.parts=parts;return row;
  }
  const list={set innerHTML(html){rows.length=0;html.split('<div class="bl-link-row"').slice(1).forEach((chunk,i)=>rows.push(makeRow(i,chunk)));list.html=html;}};
  const characters=[{avatar:'mina1.png',name:'Mina One'},{avatar:'rex.png',name:'Rex'}];
  const context={getSettings:()=>settings,saveSettings:()=>calls.push('save'),document:{addEventListener:(type,fn)=>listeners.set(type,fn)},
    promptbindReady:Promise.resolve(promptbind),get pickerReady(){return pickerFail?Promise.reject(Error('no picker')):Promise.resolve(picker);},
    SillyTavern:{getContext:()=>({characters})}};
  vm.runInNewContext(source+'\nglobalThis.api={promptLinkMarkup,installPromptLink};',context);
  const paint=()=>{list.innerHTML=/<div class="bl-link-rows" data-link-rows>([\s\S]*)<\/div><div class="bl-link-actions">/.exec(context.api.promptLinkMarkup())[1];};
  paint();
  const change=target=>listeners.get('change')({target});
  return{settings,calls,status,rows,list,context,listeners,paint,add,
    get focused(){return focused},get picked(){return picked},
    setReport:fn=>{report=fn},setChanged:n=>{changed=n},setFail:()=>{fail=true},setPickerFail:()=>{pickerFail=true},
    toggle:checked=>change({checked,hasAttribute:n=>n==='data-prompt-link-on',closest:sel=>sel==='[data-prompt-link]'?box:null}),
    word:(i,value)=>{const input=rows[i].parts['[data-link-word]'];input.value=value;return change(input).then(()=>input);},
    click:target=>listeners.get('click')({target}),
    other:()=>Promise.all([change({closest:()=>null}),listeners.get('click')({target:{closest:()=>null}})])};
}
let passed=0;
async function check(label,fn){await fn();console.log('ok',label);passed++}
await check('markup: switch, search anchor, escaped words, card trigger and a blank first row when none are saved',async()=>{
  const e=environment();e.settings.promptLink={on:true,rows:[{word:'Mi "A" <b>',cards:['mina1.png','gone.png']}]};
  const html=e.context.api.promptLinkMarkup();
  assert.ok(html.includes('data-prompt-link-on') && html.includes('checked'));assert.ok(html.includes('data-search-anchor="캐릭터 이름 연동"'));
  assert.ok(html.includes('value="Mi &quot;A&quot; &lt;b&gt;"'));assert.ok(!html.includes('<b>Mi'),'words are escaped');
  assert.ok(html.includes('Mina One · gone'),'card names from the context, missing cards by file name');
  assert.ok(html.includes('data-link-pick')&&html.includes('aria-haspopup="dialog"')&&html.includes('bl-prompt-card-trigger'),'reuses the card picker trigger');
  assert.equal((html.match(/class="salty-stack bl-link-field"/g)||[]).length,2,'word and cards are two-line fields');
  assert.ok(html.includes('data-link-add')&&html.includes('data-link-remove'),'add and remove buttons');
  assert.ok(!html.includes('data-prompt-link-name'),'the old single name field is gone');
  e.settings.promptLink={on:false,rows:[]};
  const empty=e.context.api.promptLinkMarkup();
  assert.equal((empty.match(/data-link-row="/g)||[]).length,1,'one blank row to fill in');assert.ok(empty.includes('이름에 든 말을 적어 주세요'));
});
await check('a missing settings block is created without crashing',async()=>{
  const e=environment();delete e.settings.promptLink;const html=e.context.api.promptLinkMarkup();assert.ok(html.includes('value=""'));assert.equal(JSON.stringify(e.settings.promptLink),'{"on":false,"rows":[]}');
});
await check('turning the switch on saves, resyncs through promptbind and reports per row',async()=>{
  const e=environment();e.settings.promptLink.rows=[{word:'Mina',cards:[]},{word:'',cards:['rex.png']}];e.paint();await e.toggle(true);
  assert.equal(e.settings.promptLink.on,true);assert.deepEqual(e.calls,['save','sync:ui','report:2']);assert.match(e.status.textContent,/3개를 지금 채팅에 맞췄어요/);
  const found=e.rows[0].parts['[data-link-found]'];assert.equal(found.hidden,false);assert.match(found.textContent,/프롬프트 2개 · 짝 1개 · 정규식 2개/);
  assert.equal(e.rows[1].parts['[data-link-found]'].hidden,true,'rows without a word show no count');
});
await check('already matching chats, empty presets and rows without words are reported',async()=>{
  const e=environment();e.settings.promptLink.rows=[{word:'Mina',cards:[]}];e.paint();e.setChanged(0);await e.toggle(true);assert.match(e.status.textContent,/이미 지금 채팅에 맞아요/);
  e.setReport(rows=>({prompts:0,twins:0,regex:0,rows:rows.map(()=>({prompts:0,twins:0,regex:0}))}));await e.toggle(true);
  assert.match(e.status.textContent,/그 말이 든 프롬프트·정규식이 없어요/);assert.match(e.rows[0].parts['[data-link-found]'].textContent,/이 말이 든 프롬프트·정규식이 없어요/);
  e.settings.promptLink.rows=[{word:'',cards:['rex.png']}];await e.toggle(true);assert.match(e.status.textContent,/연동할 말을 적어 주세요/);
  assert.deepEqual(e.calls,['save','sync:ui','report:1','save','sync:ui','report:1','save']);
});
await check('turning it off saves without resyncing and leaves prompts alone',async()=>{
  const e=environment();e.settings.promptLink={on:true,rows:[{word:'Mina',cards:[]}]};await e.toggle(false);
  assert.equal(e.settings.promptLink.on,false);assert.deepEqual(e.calls,['save']);assert.match(e.status.textContent,/지금 상태 그대로/);
});
await check('a word is trimmed to 80 characters, saved on change into the blank first row, and its hint follows',async()=>{
  const e=environment();e.settings.promptLink.on=true;
  const input=await e.word(0,'  '+'가'.repeat(90)+'  ');
  assert.deepEqual(plain(e.settings.promptLink.rows),[{word:'가'.repeat(80),cards:[]}],'the blank on-screen row becomes the first saved row');assert.equal(input.value,'가'.repeat(80));
  assert.deepEqual(e.calls,['save','sync:ui','report:1']);assert.match(e.rows[0].parts['[data-link-hint]'].textContent,/카드를 안 고르면 이름이 「가+」인 카드/);
  await e.word(0,'   ');assert.equal(e.settings.promptLink.rows[0].word,'');assert.match(e.status.textContent,/연동할 말을 적어 주세요/);assert.match(e.rows[0].parts['[data-link-hint]'].textContent,/이름에 든 말을 적어 주세요/);
});
await check('an unchanged word does nothing',async()=>{
  const e=environment();e.settings.promptLink={on:true,rows:[{word:'Mina',cards:[]}]};e.paint();await e.word(0,'Mina');assert.deepEqual(e.calls,[]);
});
await check('adding rows saves them (with the blank first row), focuses the new word field and stops at 20',async()=>{
  const e=environment();await e.click(e.add);
  assert.deepEqual(plain(e.settings.promptLink.rows),[{word:'',cards:[]},{word:'',cards:[]}]);assert.deepEqual(e.calls,['save']);assert.equal(e.rows.length,2);
  assert.equal(e.focused,e.rows[1].parts['[data-link-word]'],'focus moves to the new row');
  e.settings.promptLink.rows=Array.from({length:20},()=>({word:'',cards:[]}));await e.click(e.add);assert.equal(e.settings.promptLink.rows.length,20);assert.match(e.status.textContent,/20개까지/);
});
await check('removing a row resyncs only when it had a word or cards',async()=>{
  const e=environment();e.settings.promptLink={on:true,rows:[{word:'Mina',cards:['mina1.png']},{word:'',cards:[]},{word:'Rex',cards:[]}]};e.paint();
  await e.click(e.rows[1].parts['[data-link-remove]']);assert.deepEqual(e.settings.promptLink.rows.map(r=>r.word),['Mina','Rex']);assert.deepEqual(e.calls,['save'],'a blank row is just saved');
  assert.equal(e.rows.length,2);assert.equal(e.focused,e.rows[1].parts['[data-link-remove]'],'focus stays on the list');
  await e.click(e.rows[0].parts['[data-link-remove]']);assert.deepEqual(plain(e.settings.promptLink.rows),[{word:'Rex',cards:[]}]);assert.deepEqual(e.calls,['save','save','sync:ui','report:1']);
  await e.click(e.rows[0].parts['[data-link-remove]']);assert.deepEqual(plain(e.settings.promptLink.rows),[]);assert.equal(e.rows.length,1,'a blank row stays on screen');
});
await check('picking cards opens the multi picker with the row cards and saves the new list',async()=>{
  const e=environment();e.settings.promptLink={on:true,rows:[{word:'Mina',cards:['mina1.png']}]};e.paint();
  const pick=e.rows[0].parts.pick;await e.click(pick);await tick();
  assert.deepEqual([...e.picked.selected],['mina1.png']);assert.equal(e.picked.opener,pick);assert.equal(pick.disabled,false,'button is enabled again');
  e.picked.onPick(['mina1.png']);await tick();assert.deepEqual(e.calls,['picker'],'same cards → nothing');
  e.picked.onPick(['mina1.png','rex.png']);await tick();
  assert.deepEqual(e.settings.promptLink.rows[0].cards,['mina1.png','rex.png']);assert.equal(e.rows[0].parts['[data-link-cards]'].textContent,'Mina One · Rex');
  assert.match(e.rows[0].parts['[data-link-hint]'].textContent,/고른 카드 2장의 채팅/);assert.deepEqual(e.calls,['picker','save','sync:ui','report:1']);
  e.picked.onPick([]);await tick();assert.equal(e.rows[0].parts['[data-link-cards]'].textContent,'카드 고르기');
  const fresh=environment();await fresh.click(fresh.rows[0].parts.pick);await tick();fresh.picked.onPick(['rex.png']);await tick();
  assert.deepEqual(plain(fresh.settings.promptLink.rows),[{word:'',cards:['rex.png']}],'cards on the blank first row create it');
});
await check('a failed picker or promptbind import is reported, not thrown',async()=>{
  const e=environment();e.setPickerFail();const pick=e.rows[0].parts.pick;await e.click(pick);assert.match(e.status.textContent,/카드 목록을 열지 못했어요/);assert.equal(pick.disabled,false);
  const f=environment();f.settings.promptLink.rows=[{word:'Mina',cards:[]}];f.setFail();await f.toggle(true);assert.match(f.status.textContent,/프롬프트 관리자를 읽지 못했어요/);
});
await check('events outside the block and repeated installs are ignored',async()=>{
  const e=environment();await e.other();assert.deepEqual(e.calls,[]);
  const seen=[];e.context.api.installPromptLink({addEventListener:()=>seen.push(1)});assert.equal(seen.length,0,'installed once at import');
});
console.log(`prompt-link: ${passed} passed`);
