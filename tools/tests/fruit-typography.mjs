import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const {FRUIT_TYPES,tidyFruitType,fruitTypeCss}=await import(pathToFileURL(path.join(root,'src/fruit-type-schema.js')));
const {fruitTypePreview}=await import(pathToFileURL(path.join(root,'src/fruit-type-preview.js')));
assert.equal(fruitTypeCss({on:false}), '');
const bad=tidyFruitType({on:true,kind:'invalid',types:{status:{regions:{info:{on:true,size:900,line:0,font:'bad;css'}}}}});
assert.equal(bad.kind,'status');assert.equal(bad.types.status.regions.info.size,64);assert.equal(bad.types.status.regions.info.line,.8);assert.equal(bad.types.status.regions.info.font,'original');
assert.deepEqual(tidyFruitType(bad),bad);
const s=tidyFruitType({on:true});assert.equal(fruitTypeCss(s),'');
s.types.status.regions.quote.on=true;s.types.status.regions.quote.size=22;s.types.status.regions.quote.spacing=0;
const css=fruitTypeCss(s);assert(css.includes('font-size:22px'));assert(css.includes('transform:none'));assert(!css.includes('.fate-top-grid'));
// 8.1.0 제보: 인용문은 원작 flex 배치 그대로(display:block 이면 짧은 선만 첫 줄에 남고 작은 제목이 왼쪽에 홀로 떠요) · 폭 90% 그대로 · 작은 제목(.movie-deco-eng)은 본문 크기를 안 물려받아요
assert(!css.includes('display:block'),'Quote keeps the original flex layout');assert(!/movie-line-content\)\{[^}]*max-width:100%/.test(css),'Quote keeps the original 90% width');
assert(/movie-line-content\) :is\(span,p,b,i,em,strong\):not\(:is\(\.movie-deco-eng,\.custom-movie-deco-eng\)\)\{/.test(css),'Deco title is excluded from inherited size');
// 10-27 제보: 짧은 선은 한글화가 가운데 한 줄로 그려요 — 원작 정렬이면 손대지 않고, 정렬을 고르면 선도 글과 같은 쪽
assert(!/::before\{background-position/.test(css),'Original alignment leaves the centred rule alone');
for(const [align,pos] of [['left','left'],['center','center'],['right','right'],['justify','left']]){const a=tidyFruitType({on:true});a.types.status.regions.quote.on=true;a.types.status.regions.quote.align=align;assert(fruitTypeCss(a).includes(`movie-line-content)::before{background-position:${pos} top!important}`),`Rule follows ${align} quote alignment`);}
// 8.1.0 제보: 이름 줄 아래 긴 문구(.fate-between · 옛 대화의 옷차림 두 칸)도 영역이에요
assert.deepEqual(Object.keys(FRUIT_TYPES.find(t=>t.id==='status').regions),['info','quote','names','between','footer']);
{const b=tidyFruitType({on:true});b.types.status.regions.between.on=true;b.types.status.regions.between.size=18;const c=fruitTypeCss(b);assert(c.includes(':is(.fate-between,.custom-fate-between)')&&c.includes('.fate-outfit-char')&&c.includes('font-size:18px'));assert(!/fate-outfit-user\)\{[^}]*max-width:100%/.test(c),'Between keeps the original 88% width');}
s.types.status.hideFooter=true;assert(fruitTypeCss(s).includes(':is(.fate-bottom-en,.custom-fate-bottom-en){display:none'));
s.types.status.layout='vertical';assert(fruitTypeCss(s).includes('grid-template-columns:minmax(0,1fr)'));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');let dictionary;
const bundle=read('src/scripts/bundled/fruit.js');vm.runInNewContext(JSON.parse(bundle.slice(bundle.indexOf('export default ')+15).trim().replace(/;$/,'')),{BlueLemonade:{translate:d=>dictionary=d}});
for(const type of FRUIT_TYPES){if(!['deus','qingguo'].includes(type.owner))assert(dictionary.prompts.some(x=>x.title===type.name),type.name);if(type.owner!=='qingguo')assert(fruitTypePreview(type.id).length>100);}
const preview=read('src/fruit-type-preview.js');assert(!/getContext\(|\.characters|\.persona|chat_metadata|fetch\(/.test(preview));
const {DEUS_EFFECTS,DEUS_EFFECT_GROUPS}=await import(pathToFileURL(path.join(root,'src/scripts/deus-option-effects.js')));
const {describeDeusOption}=await import(pathToFileURL(path.join(root,'src/scripts/deus-option-help.js')));
assert.equal(Object.keys(DEUS_EFFECTS).length,105); // 2.5 73 + V3 · 테마가 더한 길이 · 공포 32
for(const group of Object.values(DEUS_EFFECT_GROUPS))for(const id of group.ids)assert(DEUS_EFFECTS[id]);
const id=Object.keys(DEUS_EFFECTS)[0];const d=describeDeusOption(id,{prompts:[{identifier:id,content:'changed'}]});assert(d.baseline);assert(d.text.length>10);
const group=Object.keys(DEUS_EFFECT_GROUPS)[0];const desc=describeDeusOption(group,{prompts:DEUS_EFFECT_GROUPS[group].ids.map(identifier=>({identifier,content:'modified'}))});assert(desc.text.includes('\n\n'));assert(desc.baseline);
assert(read('src/scripts/plain/deus-qr.js').includes('stopOptionHelp?.()'));
const {entryMode}=await import(pathToFileURL(path.join(root,'src/scripts/fruit-entry.js')));
for(const mode of ['wand','qr','cat'])assert.equal(entryMode(mode),mode);assert.equal(entryMode(false),'wand');
assert(read('src/scripts/plain/deus-qr.js').includes('dq-name-only'));assert(read('src/scripts/plain/deus-qr.js').includes('data.names.deus=deusQuickName(nameInput.value)'));
const {entryDisplay,entryIcon}=await import(pathToFileURL(path.join(root,'src/scripts/fruit-entry-icons.js')));
assert.equal(entryDisplay(undefined),'both');for(const x of ['icon','text','both'])assert.equal(entryDisplay(x),x);
assert.equal(entryIcon('fa-cat'),'fa-cat');assert.equal(entryIcon('fa-cat" onclick="bad'),'fa-apple-whole');
const {typeOwner,ownerEnabled,layoutChoices}=await import(pathToFileURL(path.join(root,'src/fruit-type-schema.js')));
const separated=tidyFruitType({on:true,kind:'deus-status',ownerOn:{fruit:false}});
assert.equal(separated.ownerKinds.fruit,'status');assert.equal(separated.ownerKinds.deus,'deus-status');
assert(!ownerEnabled(separated,'fruit'));assert(ownerEnabled(separated,'deus'));
separated.types.status.regions.quote.on=true;separated.types['deus-status'].regions.info.on=true;
assert(!fruitTypeCss(separated).includes('.fate-status-wrapper'));assert(fruitTypeCss(separated).includes('.dem-status'));
assert.equal(FRUIT_TYPES.filter(t=>typeOwner(t)==='fruit').length,8);assert.equal(FRUIT_TYPES.filter(t=>typeOwner(t)==='deus').length,7);
for(const t of FRUIT_TYPES.filter(t=>t.layout))assert.equal(layoutChoices(t).length,2,'Only distinct layouts');
const {originalPreview}=await import(pathToFileURL(path.join(root,'src/fruit-type-original.js')));
assert(originalPreview('status').css.includes('LXGW WenKai'));assert(originalPreview('status').css.includes('SiyinSong'));
assert.notEqual(originalPreview('compact','present').css,originalPreview('compact','olden').css);
assert(!fruitTypeCss({on:true,types:{status:{regions:{info:{on:true,font:'original'}}}}}).includes('font-family:'),'Original region fonts are not flattened');
// 상태창 글자 화면 모양: 영역 파라미터는 2열 격자(8.1.0, 사용자 10-27 「파라미터는 웬만하면 다 세로 2열」) · 테마 스위치만 · 알약 없음 · 과일/데우스 같은 묶음 자리
const editorCss=read('css/79-fruit-type.css'),editorJs=read('src/fruit-type-ui.js');
assert(/@container bl-ft-body \(width >= 19em\)\{\.bl-ft-params\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/.test(editorCss),'Region parameters form a two-column grid from 19em (same threshold as the theme editor)');
assert(/\.bl-ft-group-body\{container:bl-ft-body \/ inline-size\}/.test(editorCss),'The grid measures its own region body, so the shortcut dialog gets the same columns');
assert(/\.bl-ft-params>\.bl-ft-wide\{grid-column:1 \/ -1\}/.test(editorCss),'Long choices span the full row');
const regionBody=/<div class="bl-ft-params">([\s\S]*?)<\/div>`\);\}\)\.join\(''\)/.exec(editorJs)?.[1]||'';
const order=[...regionBody.matchAll(/\$\{(field|slider)\(key,'(\w+)'/g)].map(m=>m[2]);
assert.deepEqual(order,['font','size','weight','spacing','line','italic','align','wrap'],'Pairs are same-kind: size|weight · spacing|line · italic|align, long choices (font · wrap) alone');
assert.equal((regionBody.match(/,true\)\}/g)||[]).length,2,'Only font and wrap are full-width');
assert(!/border-radius\s*:\s*(9999|99)px/.test(editorCss),'No pill buttons');
assert.equal((editorJs.match(/type="checkbox"/g)||[]).length,1,'Switches come from one theme switch helper (글자 설정 사용 · 이 영역 조절 — 하단 문구는 8.1.2 부터 고르기)');
// 8.1.2 맨 위 「정보 배치 · 하단 반복 문구」 2열(사용자 10-28 시안 B): 하단 문구는 스위치 대신 테마 두 칸 고르기 「보임 | 숨김」 — 저장 값은 예전 그대로 hideFooter
assert(!editorJs.includes("toggle('data-ft-hide'"),'Footer is no longer a switch');
assert(/<div class="bl-ft-top">/.test(editorJs)&&/\.bl-ft-top\{display:grid/.test(editorCss),'Top pair sits in its own grid');
assert(/@container bl-ft-editor \(width >= 19em\)\{\.bl-ft-top\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/.test(editorCss),'Top pair is two columns from 19em, like the region parameters');
assert(/\.bl-ft-top>\.bl-ft-param\{display:grid;grid-row:span 2;grid-template-rows:subgrid/.test(editorCss),'Both top cells share one control row, so the show/hide choice is exactly as tall as the layout select (PC 36 · phone 44)');
assert(/\.bl-ft-top>:only-child\{grid-column:1 \/ -1\}/.test(editorCss),'A lone top item (Deus) spans the row');
assert(/\.bl-fruit-type-editor \.bl-ft-seg\{[^}]*min-height:36px[^}]*padding:2px/.test(editorCss)&&/\.bl-ft-seg>button\{[^}]*min-height:0/.test(editorCss),'Footer choice is at least 36 alone and its own height stays under the select so the shared row decides');
assert(!/ 숨기기`/.test(editorJs),'The label names the region; the choice says show/hide');
{const m=/const footerSeg=(hidden=>`[\s\S]*?`);\n/.exec(editorJs);assert(m,'footerSeg helper');const seg=vm.runInNewContext(m[1]);
 // 옛 설정 호환: 예전 스위치 켬(hideFooter true) = 「숨김」 눌림, 끔 = 「보임」 눌림
 const on=seg(true),off=seg(false);
 assert(/data-ft-hide="true" aria-pressed="true" class="on">숨김/.test(on)&&/data-ft-hide="false" aria-pressed="false" class="">보임/.test(on),'Saved hideFooter:true shows 숨김 pressed');
 assert(/data-ft-hide="false" aria-pressed="true" class="on">보임/.test(off)&&/data-ft-hide="true" aria-pressed="false" class="">숨김/.test(off),'Saved hideFooter:false shows 보임 pressed');
 assert.equal((on.match(/<button /g)||[]).length,2,'Two choices');}
for(const [saved,want] of [[true,true],[false,false],[undefined,false],['yes',false],[1,false]]){const t=tidyFruitType({types:{status:{hideFooter:saved}}});assert.equal(t.types.status.hideFooter,want,'Old hideFooter value '+String(saved));}
{const t=tidyFruitType({on:true,types:{status:{hideFooter:true}}});assert(fruitTypeCss(t).includes(':is(.fate-bottom-en,.custom-fate-bottom-en){display:none'),'Old saved 켬 still hides the footer');t.types.status.hideFooter=false;assert(!fruitTypeCss(t).includes('fate-bottom-en,.custom-fate-bottom-en){display:none'),'보임 shows it');}
assert(/const hide=e\.target\.closest\('\[data-ft-hide\]'\)/.test(editorJs)&&!/hasAttribute\('data-ft-hide'\)/.test(editorJs),'The choice is handled on click, not as a checkbox change');assert(editorJs.includes('class="salty-switch"'));
assert(!/<label class="bl-ft-param"><span>[^<]*<\/span><(?:input|select)[^>]*>[^<]*<(?:input|select)/.test(editorJs),'One control per parameter');
// 과일 창 바로가기 대화상자(.bl-ft-dialog)는 설정 창(.salty-panel) 밖 — 미리보기 도구 단추가 테마 모양을 따로 받아야 한다 (없으면 브라우저 기본 흰 네모, 나이트 대비 1.14)
assert(editorJs.includes("dialog.className='bl-ft-dialog'")&&!editorJs.includes('salty-panel'),'Shortcut dialog lives outside .salty-panel');
assert(/\.bl-ft-dialog \.bl-view-tools button\{[^}]*border-radius:8px[^}]*background:var\(--salty-fill-shade/.test(editorCss),'Dialog zoom tool buttons use the theme shade, 8px');
assert(/\.bl-ft-dialog \.bl-view-resize>button\{[^}]*border-radius:8px[^}]*background:transparent[^}]*color:var\(--salty-muted/.test(editorCss),'Dialog magnifier and reset buttons are transparent theme buttons');
assert.equal((read('css/56-control-consistency.css').match(/:is\(\.salty-panel, \.bl-ft-dialog\) \.bl-view-resize > button:not\(\.bl-view-toggle\)/g)||[]).length,4,'Reset glyph (line icon) also in the dialog');
assert(/\.bl-ft-dialog small\{opacity:1\}/.test(editorCss),'Dialog small text is not dimmed by SillyTavern small{opacity:.7} (light contrast 2.9)');
assert(read('src/prompt-tools.js').includes('export function fruitTypographyGroup'));assert.equal((read('src/panel.js').match(/fruitTypographyGroup\('deus'\)/g)||[]).length,2,'Deus page places the editor group in both states');
console.log('Fruit typography: five known names, independent regions, limits, OFF/reset, synthetic previews; Deus 105 effects (2.5 · V3)/group descriptions passed');
