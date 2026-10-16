// 6.9.7 스와이프 고르기 창 미리보기 번역문 (src/swipe-picker-translation.js) + 팝업 닫기 × 가운데 · 스와이프 줄 머리 · 아래 번호 줄 (css/03-menus · 11-chrome)
// 번역 애드온의 표시 방식(기본 · 접기 · 원문 먼저 · 펼침 · 글 전체 접기 · 보호 블록 통째 붙임)마다 번역 쪽만 글로, 기록(translation_source) · 원문 해시 · 백업 칸 규칙
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../..',import.meta.url)));
globalThis.SillyTavern={getContext:()=>({extensionSettings:{},saveSettingsDebounced(){}})};
const {translationOnly,plainText,withoutOriginalHalf,swipeTranslation}=await import(pathToFileURL(path.join(root,'src/swipe-picker-translation.js')));
let n=0;const t=(name,fn)=>{fn();n++};

const fold=(tr,or)=>`<details class="llm-translator-details mode-folded"><summary class="llm-translator-summary"><span class="translated_text clickable-text-org">${tr}</span></summary><span class="original_text">${or}</span></details>`;
const first=(tr,or)=>`<details class="llm-translator-details mode-original-first"><summary class="llm-translator-summary"><span class="original_text clickable-text-org">${or}</span></summary><span class="translated_text">${tr}</span></details>`;
const open=(tr,or)=>`<span class="translated_text mode-unfolded">${tr}</span><br><span class="original_text mode-unfolded">${or}</span>`;
const gap='<div class="llmt-para-gap"></div>';
const only=html=>plainText(translationOnly(html));

t('folded paragraphs keep only the translation, paragraph gap becomes a blank line',()=>{
  assert.equal(only([fold('미나가 <b>웃었다</b>.','Mina <b>smiled</b>.'),gap,fold('&quot;안녕&quot;','"Hi"')].join('\n')),'미나가 웃었다.\n\n"안녕"');
});
t('original-first keeps the body, drops the summary',()=>assert.equal(only(first('렉스가 달렸다.','Rex ran.')),'렉스가 달렸다.'));
t('unfolded: every original line and its break go, consecutive lines stay one break apart',()=>{
  assert.equal(only(open('렉스가 달렸다.','Rex ran.')),'렉스가 달렸다.');
  assert.equal(only([open('A1','a1'),open('A2','a2')].join('\n')),'A1\nA2');
  assert.equal(only([open('A1','a1'),gap,open('A2','a2')].join('\n')),'A1\n\nA2');
});
t('nested same-name spans inside the original never leak (unfolded · original-first · folded)',()=>{
  const tr='<span style="color:red">빨강</span> 글',or='<span class="x"><span>Red</span></span> text';
  assert.equal(only(open(tr,or)),'빨강 글');
  assert.equal(only(first(tr,or)),'빨강 글');
  assert.equal(only(fold(tr,or)),'빨강 글');
  assert.equal(only([open(tr,or),open('둘째','<span><span>x</span></span>')].join('\n')),'빨강 글\n둘째');
  assert.equal(only([open('A1','Rex <b>ran'),open('A2','x')].join('\n')),'A1\nA2','an unclosed tag inside the original closes with it');
});
t('whole-text fold (one details, paragraphs inside) in both orders',()=>{
  assert.equal(only('<details class="llm-translator-details mode-folded">\n<summary class="llm-translator-summary"><p>첫 문단.</p><p>둘째 문단.</p></summary>\n<p>First.</p><p>Second.</p>\n</details>'),'첫 문단.\n\n둘째 문단.');
  assert.equal(only('<details class="llm-translator-details mode-original-first">\n<summary class="llm-translator-summary"><p>First.</p></summary>\n<p>첫 문단.</p>\n</details>'),'첫 문단.');
});
t('plain (disabled mode) text: tags stripped, lines kept, entities decoded, scripts, styles and comments dropped',()=>{
  assert.equal(plainText('<status_bar>HP 3</status_bar>\n미나가 왔다. a &lt; b &amp; c<br>둘째 줄<style>.x{}</style><script>alert(1)</script><!-- 메모 -->'),'HP 3\n미나가 왔다. a < b & c\n둘째 줄');
  assert.equal(plainText('a < b 와 c > d'),'a < b 와 c > d','a bare < is not a tag');
  assert.equal(plainText('<a title="x > y">링크</a>'),'링크','> inside a quoted attribute');
  assert.equal(translationOnly('그대로 둠'),'그대로 둠');
});
t('long folded text is handled in one pass',()=>{
  const html=Array.from({length:600},(_,i)=>fold(`번역 ${i} <span>강조</span>`,`Original ${i} <span><span>x</span></span>`)).join(`\n${gap}\n`);
  const t0=process.hrtime.bigint();const out=only(html);const ms=Number(process.hrtime.bigint()-t0)/1e6;
  assert.ok(out.startsWith('번역 0 강조')&&out.endsWith('번역 599 강조')&&!/Original/.test(out));
  assert.ok(ms<1500,`600 paragraphs took ${ms.toFixed(0)}ms`);
});

// 보호 블록이 있어 문단 수가 다르면 번역 애드온이 표시 없이 통째로 붙인다 (translator/index.js renderAllInOne hasMask)
const masked='<!-- c -->\n안녕. 세상.',src='<!-- c -->\nHello.\nWorld.';
t('masked whole-text layout: the original half is cut in both orders',()=>{
  assert.equal(withoutOriginalHalf(plainText(masked+'\n\n'+src),[plainText(src)]),'안녕. 세상.');
  assert.equal(withoutOriginalHalf(plainText(src+'\n\n'+masked),[plainText(src)]),'안녕. 세상.');
  assert.equal(withoutOriginalHalf('번역만',[plainText(src)]),'번역만');
});

const hash=text=>{let h=0;for(const c of String(text))h=(h*31+c.codePointAt(0))|0;return h};
const sub=text=>text.replace('{{user}}','Tester');
const msg=()=>({swipes:['<status_bar>HP 3</status_bar>\nMina waved.','Rex sighed.','Nothing yet.','{{user}} smiled.','Same text.'],swipe_id:0,
  extra:{display_text:'<status_bar>HP 3</status_bar>\n미나가 손을 흔들었다.'},
  swipe_info:[{extra:{display_text:'예전 번역'}},{extra:{display_text:fold('렉스가 한숨 쉬었다.','Rex sighed.')}},{extra:{}},
    {extra:{display_text:'Tester smiled.',original_translation_backup:'테스터가 웃었다.'}},{extra:{display_text:'Same text.'}}]});
const opt={substitute:sub};
t('current swipe reads message.extra (not the stale swipe_info copy)',()=>assert.equal(swipeTranslation(msg(),0,opt),'HP 3\n미나가 손을 흔들었다.'));
t('other swipes read swipe_info[i].extra, fold markup removed',()=>assert.equal(swipeTranslation(msg(),1,opt),'렉스가 한숨 쉬었다.'));
t('no translation → null (the original stays)',()=>assert.equal(swipeTranslation(msg(),2,opt),null));
t('original view: the backup holds the translation',()=>assert.equal(swipeTranslation(msg(),3,opt),'테스터가 웃었다.'));
t('a backup left without display_text belongs to another swipe → null',()=>{
  const m=msg();m.extra={original_translation_backup:'옛 번역'};assert.equal(swipeTranslation(m,0,opt),null);
});
t('display text equal to the original (macros resolved) → null',()=>{
  assert.equal(swipeTranslation(msg(),4,opt),null);
  const m=msg();m.swipe_info[3].extra={display_text:'Tester smiled.'};assert.equal(swipeTranslation(m,3,opt),null);
});
t('original_text_hash of another text → null (with the host hash); same text → kept',()=>{
  const m=msg();m.swipe_info[1].extra.original_text_hash=String(hash('Different swipe.'));assert.equal(swipeTranslation(m,1,{...opt,hash}),null);
  m.swipe_info[1].extra.original_text_hash=String(hash('Rex sighed.'));assert.equal(swipeTranslation(m,1,{...opt,hash}),'렉스가 한숨 쉬었다.');
  const u=msg();u.swipe_info[3].extra.original_text_hash=String(hash('Tester smiled.'));assert.equal(swipeTranslation(u,3,{...opt,hash}),'테스터가 웃었다.','macros are resolved before hashing, as the translator does');
});
t('the translator record (translation_source t) wins over a masked whole-text display',()=>{
  const m={swipes:[src],swipe_id:0,extra:{display_text:masked+'\n\n'+src}};
  m.extra.original_text_hash=String(hash(src));
  m.extra.translation_source={v:1,o:String(hash(src)),d:String(hash(m.extra.display_text)),t:'<!-- c -->\n기록된 번역.'};
  assert.equal(swipeTranslation(m,0,{hash}),'기록된 번역.','the recorded raw translation is used when it matches this original and display');
  m.extra.translation_source.d='0';assert.equal(swipeTranslation(m,0,{hash}),'안녕. 세상.','stale record → display path, original half still cut');
  const r={swipes:[src],swipe_id:0,extra:{display_text:src+'\n\n'+masked}};assert.equal(swipeTranslation(r,0,{}),'안녕. 세상.','original-first masked layout without a record');
});
t('bad input',()=>{assert.equal(swipeTranslation(null,0),null);assert.equal(swipeTranslation(msg(),9),null);assert.equal(swipeTranslation(msg(),-1),null);assert.equal(swipeTranslation({swipes:'x'},0),null)});
t('current swipe follows swipe_id',()=>{const m=msg();m.swipe_id=1;m.extra={display_text:'지금 고른 번역'};assert.equal(swipeTranslation(m,1,opt),'지금 고른 번역');assert.equal(swipeTranslation(m,0,opt),'예전 번역')});

// 연결: 테마가 켜졌을 때 시작 · 상주 감시 없음(여는 단추를 누른 뒤 body 바로 아래만 잠깐, 찾으면 · 15초면 뗌) · 목록 칸만 감시 · 닫히면 뗌
const srcText=fs.readFileSync(path.join(root,'src/swipe-picker-translation.js'),'utf8');
t('light hook',()=>{
  assert.doesNotMatch(srcText,/subtree\s*:\s*true/,'no subtree observer');
  assert.match(srcText,/bodyWatch\.observe\(document\.body, \{ childList: true \}\)/,'body children only, while looking');
  assert.match(srcText,/stopTimer = setTimeout\(stopLooking, WATCH_MS\)/);
  assert.match(srcText,/if \(found\) stopLooking\(\)/);
  assert.match(srcText,/\.swipes-counter\.swipe-picker-enabled, \.mes_swipe_picker/);
  assert.match(srcText,/observer\.observe\(list, \{ childList: true \}\)/,'only the open list is watched');
  assert.match(srcText,/addEventListener\('close', \(\) => observer\.disconnect\(\)/,'and released when the dialog closes');
  assert.match(srcText,/themeEnabled\(getSettings\(\)\)/);
  assert.doesNotMatch(srcText,/setInterval/);
  const index=fs.readFileSync(path.join(root,'index.js'),'utf8');
  const runtime=index.slice(index.indexOf('const startThemeRuntime'),index.indexOf('startThemeRuntime();'));
  assert.match(runtime,/startSwipePickerTranslation\(\)/,'started with the theme runtime');
});

// 닫기 × : 실리태번이 보일 때 인라인 display:block 을 박으니 flex 가운데가 안 먹는다 → 줄 높이 = 단추 높이 (display 는 건드리지 않음 — 숨기는 창 규칙과 안 다툼)
const css=fs.readFileSync(path.join(root,'style.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const rule=sel=>{const out=[];for(let i=css.indexOf(sel+' {');i>=0;i=css.indexOf(sel+' {',i+1))if(i===0||/[}\n]\s*$/.test(css.slice(Math.max(0,i-2),i)))out.push(css.slice(i,css.indexOf('}',i)));assert.ok(out.length,'rule '+sel);return out.join('\n')};
t('close glyph centered by line height',()=>{
  assert.match(rule('body.salty .popup .popup-button-close'),/line-height:\s*30px !important[\s\S]*text-align:\s*center !important|text-align:\s*center !important[\s\S]*line-height:\s*30px !important/);
  assert.match(rule('body.salty .popup.swipe_picker_popup .swipe_picker_header .popup-button-close'),/line-height:\s*var\(--bl-h-icon\) !important/);
  assert.doesNotMatch(css,/\.popup-button-close[^{]*\{[^}]*display:\s*(flex|inline-flex|grid)\s*!important/,'never force display on the close button (theme settings dialog hides it)');
  assert.match(css,/dialog\.popup\.bl-settings-dialog > \.popup-button-close[^{]*\{\s*display:\s*none !important/);
});
// 스와이프 줄 머리: 날짜 · 글자 수 · 토큰 수는 자르지 않고 줄바꿈, 날짜는 칸 안에서 꺾임 (넘침 숨김은 남겨 단추 밑으로 안 나감)
// 아래 번호 줄: .popup-body(넘침 숨김 · 1px)에 단추 그림자 · 초점 테두리가 잘리지 않게
t('swipe header wraps instead of clipping; bottom row is not clipped',()=>{
  const info=rule('body.salty .swipe_picker_block .select_chat_info');
  assert.match(info,/flex-wrap:\s*wrap !important/);
  assert.doesNotMatch(info,/overflow:\s*visible/,'keep the shared overflow: hidden so a long date cannot paint under the buttons');
  assert.match(rule('body.salty .swipe_picker_block .select_chat_info .chat_file_size'),/flex:\s*none/);
  assert.match(rule('body.salty .swipe_picker_block .select_chat_info .chat_messages_date'),/min-width:\s*0[\s\S]*white-space:\s*normal/);
  assert.match(rule('body.salty dialog.popup.swipe_picker_popup .popup-body'),/overflow:\s*visible !important/,'the shadow of the Go button reaches 14px below it');
  const pad=/padding:\s*0 (\d+)px (\d+)px !important/.exec(rule('body.salty .popup.swipe_picker_popup .popup-controls'));
  assert.ok(pad&&+pad[1]>=4&&+pad[2]>=4,'controls padding leaves room for a 3px ring');
  assert.match(rule('body.salty .popup.swipe_picker_popup .popup-controls input'),/height:\s*var\(--bl-h-lg\)/,'number box uses the same height token as the button row');
});
console.log(`PASS swipe picker translation: ${n} checks (fold · original-first · unfolded · whole fold · masked whole · plain · record · hash · backup · close glyph · header · bottom row)`);
