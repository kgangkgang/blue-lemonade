import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const {optionFamily,optionEffect,splitOptionHelp,helpNameKey,dictionaryHelp,helpNote,NO_HELP_TEXT}=await import(pathToFileURL(path.join(root,'src/scripts/fruit-option-help.js')));
const {FRUIT_OPTION_EFFECTS,FRUIT_OPTION_BASELINES}=await import(pathToFileURL(path.join(root,'src/scripts/fruit-option-effects.js')));
assert.equal(optionFamily({id:'a',name:'👁️ 示例｜人称单选 #MODEL @Author'}),'人称');
assert.equal(optionFamily({id:'b',name:'⌨️ 示例'}),'文风');
assert.equal(optionFamily({id:'c',name:'Custom'},{c:'Custom group'}),'Custom group');
assert.equal((await optionEffect('')).verified,true);
assert.equal((await optionEffect('Unreviewed synthetic prompt')).verified,false);
assert.equal((await optionEffect('Unreviewed synthetic prompt')).text.includes('표준 항목 목록에 없는'),false,'11-14 「모른다」 안내는 쓰지 않아요');
assert.equal((await optionEffect('Changed body',{})).verified,false);
const hash=Object.keys(FRUIT_OPTION_EFFECTS)[0];
const fake={subtle:{digest:async()=>Uint8Array.from(hash.match(/../g),x=>parseInt(x,16))}};
assert.equal((await optionEffect('Synthetic body',fake)).text,FRUIT_OPTION_EFFECTS[hash]);
assert(Object.keys(FRUIT_OPTION_EFFECTS).length>=300);
assert(Object.keys(FRUIT_OPTION_BASELINES).length>=316);
const {localPromptHash}=await import(pathToFileURL(path.join(root,'src/scripts/prompt-fingerprint.js')));
for(const text of ['', 'abc', '한글 日本語 😀', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'test'.repeat(20000)])assert.equal(localPromptHash(text),createHash('sha256').update(text).digest('hex'));
const id=Object.keys(FRUIT_OPTION_BASELINES)[0];
assert.equal((await optionEffect('Changed custom body',{},id)).baseline,true);
assert.equal((await optionEffect('Changed custom body',{},id)).text,FRUIT_OPTION_BASELINES[id]);
assert((await optionEffect('',{},'chatHistory')).text.includes('대화 기록'));
// 11-14 설정 자료(쓰는 동안 본문이 바뀜)는 지문이 달라도 「기본판과 달라요」 꼬리 없이 확인된 설명
{const d=await optionEffect('{"version":4,"synthetic":true}',{},'fruit-heart-control-config-v2');assert.equal(d.verified,true);assert(!d.baseline);}
// 11-14 설명 없는 항목: 「표준 목록에 없어요 · 추측하지 마세요」 대신 — 도움말 주석 → 이름 사전(이름이 조금 달라도) → 원문을 펼쳐 보라는 안내
{
const k=helpNameKey;
assert.equal(k('🕷️ 恶女恶男·猜忌防备与暗黑张力｜疯批/宿敌/背德选开 from蛛网@鸦唳'),k('🕷️ 恶女恶男·猜忌防备与暗黑张力｜疯批/宿敌/背德选开'));
assert.equal(k('🍏 속마음 (데우스)｜속마음 택1'),k('🍏 속마음｜속마음 택1'));
assert.equal(k('✨ 감정이 드러나는 대사 (데우스)'),k('✨ 감정이 드러나는 대사'));
assert.equal(k('🧩 防解剖与去临床腔 #GEMINI'),k('防解剖与去临床腔'));
assert.equal(k('🗣️ 한국어"한국어"｜언어 택1'),k('🗣️ 한국어「한국어」｜언어 택1'));
assert.equal(k('🎨 대사 색상 택1: 카드 따라 자동'),k('카드 따라 자동'));
assert.equal(k('[택1: ↓] 시험 항목 🎨'),k('시험 항목'));
assert.notEqual(k('시험 가'),k('시험 나'));
const dict=[{prompts:[{id:'a1',name:'🍏 시험 속마음 (데우스)｜속마음 택1',title:'t',desc:'합성 설명 가예요.'},{id:'a2',name:'갈리는 이름',title:'t',desc:'하나예요.'},{id:'a3',name:'갈리는 이름',title:'t',desc:'둘이에요.'},{id:'a4',name:'이름만 다른 항목',title:'t',desc:'아이디 설명이에요.'}]},null,{prompts:'깨진 자료'}];
assert.equal(dictionaryHelp(dict,'다른-id','✨ 시험 속마음｜속마음 택1'),'합성 설명 가예요.','이름 꼬리 · 그림 글자가 달라도 찾아요');
assert.equal(dictionaryHelp(dict,'x','갈리는 이름'),'','설명이 갈리면 쓰지 않아요');
assert.equal(dictionaryHelp(dict,'a4','완전히 새 이름'),'아이디 설명이에요.','이름이 바뀌어도 id 로');
assert.equal(dictionaryHelp(dict,'',''),'');
assert.equal(helpNote('{{// 도움말: 시험 설명이에요.}}본문'),'시험 설명이에요.');
assert.equal(helpNote('본문 {{// 도움말: 뒤}}'),'');
const named=await optionEffect('합성 본문 하나',{},'없는-id',{name:'✨ 시험 속마음｜속마음 택1',dictionaries:async()=>dict});
assert.deepEqual([named.text,named.verified,named.source],['합성 설명 가예요.',false,'name']);
const noted=await optionEffect('{{// 도움말: 손수 단 설명이에요.}}\n합성 본문',{},'없는-id',{name:'✨ 시험 속마음',dictionaries:()=>dict});
assert.deepEqual([noted.text,noted.source],['손수 단 설명이에요.','note'],'본문 도움말 주석이 이름 사전보다 먼저');
const broken=await optionEffect('합성 본문 둘',{},'',{name:'무엇',dictionaries:async()=>{throw Error('x');}});
assert.equal(broken.text,NO_HELP_TEXT);
assert(/아직 설명이 없어요/.test(NO_HELP_TEXT)&&/현재 원문 확인/.test(NO_HELP_TEXT)&&!/추측하지/.test(NO_HELP_TEXT));
}

// Exercise the actual QR visibility function with only an inert DOM facade.
const layout=fs.readFileSync(path.join(root,'src/layout.js'),'utf8');
const a=layout.indexOf('    function syncQrFind('),b=layout.indexOf('\n    }',a)+6;
assert(a>=0&&b>a);
let existing=null,closed=0,buttons=true;
const context={globalThis:{quickReplyApi:{settings:{isEnabled:false}}},qrFinderModule:{closeQrFind(){closed++;}},
 document:{body:{classList:{contains:()=>false}},createElement(){return {setAttribute(){},addEventListener(){},remove(){existing=null;}};}}};
// 6.6.7 hidden native Fruit buttons ([data-bl-fruit-native-entry]) do not count as QR buttons.
let hiddenFruitOnly=false;
const bar={querySelector:s=>s.includes('bl-qr-find')?existing:s==='.qr--button:not([data-bl-fruit-native-entry])'&&buttons&&!hiddenFruitOnly?{}:null,prepend(el){existing=el;},querySelectorAll(){return[];}};
vm.createContext(context);vm.runInContext(layout.slice(a,b)+';this.sync=syncQrFind;',context);
context.sync(bar,true);assert.equal(existing,null,'helper buttons do not enable search when native QR is OFF');
context.globalThis.quickReplyApi.settings.isEnabled=true;context.sync(bar,true);assert(existing,'native QR ON permits search');
hiddenFruitOnly=true;context.sync(bar,true);assert.equal(existing,null,'only the hidden native Fruit button does not show search');hiddenFruitOnly=false;context.sync(bar,true);assert(existing,'visible QR buttons show search again');
context.globalThis.quickReplyApi.settings.isEnabled=false;context.sync(bar,true);assert.equal(existing,null);assert(closed>=2);
context.globalThis.quickReplyApi.settings.isEnabled=true;context.document.body.classList.contains=()=>true;context.sync(bar,true);assert.equal(existing,null,'theme search OFF remains respected');
context.document.body.classList.contains=()=>false;buttons=false;context.sync(bar,true);assert.equal(existing,null);
const help=fs.readFileSync(path.join(root,'src/scripts/fruit-option-help.js'),'utf8');
assert(!/fetch\(|updatePreset|saveSettings|triggerSlash|executeSlash/.test(help));
assert(help.includes("['pointercancel',cancel]")&&help.includes("['scroll',cancel]")&&help.includes('e.isPrimary===false'));
// 11-05 설명 창 나누기: 선택지마다 「이름:」 굵게 + 설명, 선택지마다 같은 문장은 맨 위 한 번만(합성 글)
{const s=splitOptionHelp('',[{label:'시험 가',text:'가 설명이에요. 하나만 켜요.'},{label:'시험 나',text:'나 설명 1.5배예요. 하나만 켜요.'}]);
assert.equal(s.common,'하나만 켜요.');assert.deepEqual(s.items,[{label:'시험 가',text:'가 설명이에요.'},{label:'시험 나',text:'나 설명 1.5배예요.'}]);}
{const s=splitOptionHelp('시험 가: 가 설명이에요. 같이 붙는 말.\n\n시험 나: 나 설명이에요. 같이 붙는 말.');
assert.equal(s.common,'같이 붙는 말.');assert.deepEqual(s.items.map(x=>x.label),['시험 가','시험 나']);}
{const s=splitOptionHelp('콜론 없는 한 문단 설명이에요. 끝.');assert.equal(s.common,'');assert.deepEqual(s.items,[{label:'',text:'콜론 없는 한 문단 설명이에요. 끝.'}]);}
{const s=splitOptionHelp('',[{label:'시험 가',text:'다른 말이에요.'},{label:'시험 나',text:'또 다른 말이에요.'}]);assert.equal(s.common,'');assert.equal(s.items[1].text,'또 다른 말이에요.');}
assert(help.includes("name.textContent = `${item.label}:`"),'이름은 콜론까지 굵게(strong)');
console.log('Fruit option help: exact-content descriptions, unknown/changed fallback, group matching, QR visibility gates and read-only wiring passed');
