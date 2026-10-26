// 6.9.8 파라미터 칸 치수 맞추기 — 2열 격자의 칸(윗줄 이름 | 숫자칸 · 아랫줄 슬라이더)이 화면마다 다른 숫자(60px · 72px · 46px · 4.6ch · 11px …)로
// 돌아가면 멈춘다. 모든 화면은 10-foundation 의 토큰(--bl-num-w · --bl-param-* · --bl-knob-size · --bl-track-h)과 --bl-h-ctl · --bl-fs-ctl · --bl-fs-body 만 쓴다.
// 같은 줄 두 칸의 줄 공유(subgrid) · 확인 창 단추 아래 여유 · API 열쇠 단추가 줄 안에 있는지도 본다. 6.9.6 style.css 에 돌리면 멈춘다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../..',import.meta.url)));
const file=process.argv[3]||path.join(root,'style.css');
const css=fs.readFileSync(file,'utf8');

// ---- 작은 CSS 읽개 (tools/tests/param-two-columns.mjs 와 같음): 규칙마다 { selectors, decls, at }
function parse(text){
  text=text.replace(/\/\*[\s\S]*?\*\//g,'');
  const rules=[],stack=[];let buf='',i=0,quote=null,depth=0;
  for(;i<text.length;i++){
    const c=text[i];
    if(quote){buf+=c;if(c==='\\'){buf+=text[++i];continue}if(c===quote)quote=null;continue}
    if(c==='"'||c==="'"){quote=c;buf+=c;continue}
    if(c==='('){depth++;buf+=c;continue}
    if(c===')'){depth--;buf+=c;continue}
    if(depth>0){buf+=c;continue}
    if(c==='{'){
      const head=buf.trim();buf='';
      if(head.startsWith('@')){stack.push(head);continue}
      let j=i+1,d=1,q=null;for(;j<text.length&&d;j++){const x=text[j];if(q){if(x==='\\')j++;else if(x===q)q=null;continue}if(x==='"'||x==="'")q=x;else if(x==='{')d++;else if(x==='}')d--}
      rules.push({selectors:splitTop(head,','),decls:text.slice(i+1,j-1),at:[...stack]});i=j-1;continue;
    }
    if(c==='}'){stack.pop();buf='';continue}
    if(c===';'){buf='';continue}
    buf+=c;
  }
  return rules;
}
function splitTop(s,sep){const out=[];let d=0,start=0,q=null;for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==='\\')i++;else if(c===q)q=null;continue}if(c==='"'||c==="'")q=c;else if(c==='('||c==='[')d++;else if(c===')'||c===']')d--;else if(c===sep&&!d){out.push(s.slice(start,i));start=i+1}}out.push(s.slice(start));return out.map(x=>x.trim()).filter(Boolean)}
const NOT_TAIL=/:not\((?:[^()]|\([^()]*\))*\)$/; // 끝의 :not([style*=…]) 갈래는 떼고 본다
const norm=sel=>{let s=sel.replace(/\s+/g,' ').replace(/\s*>\s*/g,' > ').replace(/\s*\+\s*/g,' + ').replace(/\s*~\s*/g,' ~ ').replace(/\(\s+/g,'(').replace(/\s+\)/g,')').trim();while(NOT_TAIL.test(s))s=s.replace(NOT_TAIL,'');return s};
const decl=(d,prop)=>{const m=[...d.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`,'g'))];return m.length?m[m.length-1][1].replace(/\s+/g,' ').trim():null};
const parked=r=>r.at.some(a=>/^@media\s+not all\b/.test(a));

const rules=parse(css).filter(r=>!parked(r));
assert.ok(rules.length>3000,'style.css 를 읽었다: '+rules.length);
const items=rules.flatMap(r=>r.selectors.map(s=>({sel:norm(s),r})));
const find=(re,prop)=>items.filter(({sel,r})=>re.test(sel)&&decl(r.decls,prop)!=null).map(({sel,r})=>({sel,v:decl(r.decls,prop),r}));

// 1. 토큰이 body.salty 에 있다
const tokens=items.filter(({sel})=>sel==='body.salty').map(({r})=>r.decls).join(';');
for(const t of ['--bl-num-w','--bl-param-gap','--bl-param-pad','--bl-param-row-gap','--bl-param-col-gap','--bl-knob-size','--bl-track-h'])
  assert.ok(new RegExp(`(^|;)\\s*${t}\\s*:`).test(tokens),'토큰이 있어야 함: '+t);
assert.match(decl(tokens,'--bl-num-w')||'',/5\.5ch/,'숫자칸 폭 토큰은 5.5ch 기준');

// 2. 숫자칸 폭: 슬라이더 옆 숫자칸에 px · ch 숫자를 직접 적은 규칙이 없다 (토큰 · 100% · auto 만)
const NUM=/(\.range-block-counter input|> \.neo-range-input|\.neo-range-input|tokenPaddingBlock"\] > input, #reasoning_max_additions\)|:where\(\[data-bl-row ~ ="resp"\]\):is\(#bl-s, \*\) > \.wide100p)$/;
const badW=find(NUM,'width').filter(({v})=>!/^(var\(--bl-num-w\)|100%|auto)\s*(!important)?$/.test(v)).map(({sel,v})=>`${sel} { width: ${v} }`);
assert.deepEqual(badW,[],'숫자칸 폭은 --bl-num-w 토큰으로만:\n'+badW.join('\n'));
assert.ok(find(NUM,'width').some(({v})=>/var\(--bl-num-w\)/.test(v)),'숫자칸 폭 토큰을 쓰는 규칙이 있어야 함');
// 숫자칸 높이: 고정 숫자칸 높이(--bl-h-num)로 묶지 않고 입력칸 높이(--bl-h-ctl) 이상
const badH=find(NUM,'height').filter(({v})=>!/^auto\s*(!important)?$/.test(v)).map(({sel,v})=>`${sel} { height: ${v} }`);
assert.deepEqual(badH,[],'숫자칸 높이는 auto + min-height(--bl-h-ctl):\n'+badH.join('\n'));
const minH=find(NUM,'min-height');
assert.ok(minH.length>=3&&minH.every(({v})=>/--bl-h-ctl/.test(v)||/^max\(var\(--bl-h-ctl\)/.test(v)),'숫자칸 min-height 는 --bl-h-ctl: '+minH.map(({sel,v})=>sel.slice(-40)+'='+v).join(' | '));
// 숫자칸 글자: 생성 설정에 11px 고정이 없다
const badFs=find(/#range_block_openai .*input$/,'font-size').filter(({v})=>!/var\(--bl-fs-ctl\)/.test(v)).map(({sel,v})=>`${sel} { font-size: ${v} }`);
assert.deepEqual(badFs,[],'생성 설정 숫자칸 글자는 --bl-fs-ctl:\n'+badFs.join('\n'));

// 3. 이름 글자: 생성 설정 칸 이름(슬라이더 칸 · 숫자 칸 · 스위치 칸)은 월드 인포 · 사용자 설정과 같은 --bl-fs-body
const badLabel=find(/#range_block_openai > \.range-block(?::has\(.*\)|\[data-bl-row ~ ="[\w-]+"\]|:is\(\[data-bl-row ~ ="num"\], \[data-bl-row ~ ="numd"\]\))(?::is\((?:\.|#)?bl-s, \*\))* > (\.range-block-title|label\.checkbox_label > span)$/,'font-size').filter(({v})=>!/var\(--bl-fs-body\)/.test(v)).map(({sel,v})=>`${sel} { font-size: ${v} }`);
assert.deepEqual(badLabel,[],'생성 설정 이름 글자는 --bl-fs-body:\n'+badLabel.join('\n'));
assert.ok(find(/#range_block_openai > \.range-block(?::has\(.*\)|\[data-bl-row ~ ="[\w-]+"\]|:is\(\[data-bl-row ~ ="num"\], \[data-bl-row ~ ="numd"\]\))(?::is\((?:\.|#)?bl-s, \*\))* > \.range-block-title$/,'font-size').length>=2,'생성 설정 이름 규칙이 있어야 함');

// 4. 칸 사이 · 칸 안 간격은 토큰
const cellGap=find(/#range_block_openai > \.range-block\[data-bl-row ~ ="range"\]:is\(\.bl-s, \*\)$/,'gap');
assert.ok(cellGap.length&&cellGap.every(({v})=>/var\(--bl-param-row-gap\) var\(--bl-param-col-gap\)/.test(v)),'생성 설정 칸 안 간격 토큰: '+cellGap.map(x=>x.v).join(' | '));
for(const re of [/#range_block_openai$/,/#wiSliders$/,/#user-settings-block \[name="(AvatarAndChatDisplay|FontBlurChatWidthBlock|themeToggles|CharacterHandlingToggles|MiscellaneousToggles|ChatMessageHandlingToggles)"\]$/]){
  const g=find(re,'gap'); assert.ok(g.some(({v})=>/var\(--bl-param-gap\)/.test(v))&&!g.some(({v})=>/[1-9]\d*px/.test(v)),'칸 사이 간격은 토큰(px 숫자 금지): '+re+' → '+g.map(x=>x.v).join(' | '));
}
const pads=find(/(#range_block_openai > \.range-block(?::has\(.*\)|\[data-bl-row ~ ="[\w-]+"\]|:is\(\[data-bl-row ~ ="num"\], \[data-bl-row ~ ="numd"\]\))(?::is\((?:\.|#)?bl-s, \*\))*|#wiSliders > \.flex-container(?::has\(.*\)|\[data-bl-row ~ ="[\w-]+"\])(?::is\((?:\.|#)?bl-s, \*\))*|#user-settings-block-content \.flex-container(?::has\(.*\)|\[data-bl-row ~ ="[\w-]+"\])(?::is\((?:\.|#)?bl-s, \*\))*)$/,'padding').filter(({v})=>!/var\(--bl-param-pad\)/.test(v)).map(({sel,v})=>`${sel} { padding: ${v} }`);
assert.deepEqual(pads,[],'칸 안 위아래 여백은 --bl-param-pad:\n'+pads.join('\n'));

// 5. 같은 줄 두 칸은 줄을 공유 (subgrid) — 생성 설정 · 월드 인포 · 사용자 설정, 옛 브라우저는 기준선 맞춤
const sub=re=>items.some(({sel,r})=>re.test(sel)&&!r.at.length&&decl(r.decls,'grid-template-rows')==='subgrid'&&/span 2/.test(decl(r.decls,'grid-row')||'')&&/--bl-param-row-gap/.test(decl(r.decls,'row-gap')||''));
assert.ok(sub(/^body\.salty #left-nav-panel #range_block_openai > \.range-block\[data-bl-row ~ ="title"\]$/),'생성 설정 이름 줄 칸: subgrid 두 줄');
assert.ok(sub(/^body\.salty #WorldInfo #wiSliders > \.flex-container\[data-bl-row ~ ="neo"\]:is\(\.bl-s, \*\):is\(\.bl-s, \*\):is\(bl-s, \*\)$/),'월드 인포 칸: subgrid 두 줄');
assert.ok(sub(/^body\.salty #user-settings-block \[name="FontBlurChatWidthBlock"\] > \.flex-container\[data-bl-row ~ ="neo"\]:is\(\.bl-s, \*\):is\(\.bl-s, \*\):is\(bl-s, \*\)$/),'사용자 설정 칸: subgrid 두 줄');
assert.ok(items.some(({sel,r})=>sel==='body.salty #left-nav-panel #range_block_openai > .range-block[data-bl-row ~ ="title"]'&&r.at.some(a=>/^@supports not \(grid-template-rows: ?subgrid\)/.test(a))&&decl(r.decls,'align-self')==='baseline'),'subgrid 없는 브라우저는 기준선 맞춤');
assert.ok(!items.some(({sel,r})=>sel==='body.salty #left-nav-panel #range_block_openai > .range-block[data-bl-row ~ ="title"]'&&!r.at.length&&decl(r.decls,'align-self')==='baseline'),'subgrid 와 기준선 맞춤을 같이 걸지 않는다');

// 6. 슬라이더 손잡이 · 막대: 모든 손잡이 규칙이 한 토큰
const thumbs=find(/::-webkit-slider-thumb$/,'width');
assert.ok(thumbs.length>=3,'손잡이 규칙 수: '+thumbs.length);
const badThumb=thumbs.filter(({v})=>!/var\(--bl-knob-size/.test(v)).map(({sel,v})=>`${sel} { width: ${v} }`);
assert.deepEqual(badThumb,[],'손잡이 지름은 --bl-knob-size:\n'+badThumb.join('\n'));
const tracks=find(/::-webkit-slider-runnable-track$/,'height');
assert.ok(tracks.length>=2&&tracks.every(({v})=>/var\(--bl-track-h/.test(v)),'막대 두께는 --bl-track-h: '+tracks.map(x=>x.v).join(' | '));
assert.ok(find(/^body\.salty input\[type="range"\]:where\(:not\(\.salty-panel \*\)\)$/,'height').some(({v})=>/var\(--bl-track-h\)/.test(v)),'실리태번 슬라이더 막대 두께 토큰');

// 7. 확인 창 단추 아래 여유 (초점 테두리 3px · 포인트 그림자) — 바닥 6px 이상 · 옆 3px 이상
const pc=find(/^body\.salty \.popup \.popup-controls$/,'padding');
assert.ok(pc.length,'팝업 단추 줄 padding 규칙');
const parts=pc[pc.length-1].v.replace(/!important/,'').trim().split(' ');
const bottom=parseFloat(parts[2]??parts[0]),side=parseFloat(parts[1]??parts[0]);
assert.ok(bottom>=6&&side>=3,'팝업 단추 줄 여유 아래 6 · 옆 3 이상: '+pc[pc.length-1].v);

// 8. API 열쇠 단추 · 월드 인포 핀: 상자가 줄 밖으로 나가는 음수 여백이 없다
const key=find(/\.text_pole \+ \.manage-api-keys:last-child$/,'margin');
assert.ok(key.length&&key.every(({v})=>!/-\d/.test(v)),'열쇠 단추 음수 여백 없음: '+key.map(x=>x.v).join(' | '));
assert.ok(find(/\.text_pole \+ \.manage-api-keys:last-child$/,'justify-content').some(({v})=>/flex-end/.test(v)),'열쇠 글자는 상자 오른쪽 끝');
const pin=find(/^body\.salty #WorldInfo #WI_panel_pin_div$/,'margin-left');
assert.ok(pin.length&&pin.every(({v})=>parseFloat(v)>=-4),'핀 상자 왼쪽 여백 -4px 이상: '+pin.map(x=>x.v).join(' | '));

console.log(`PASS param dimensions: tokens, ${find(NUM,'width').length} numeric widths, ${thumbs.length} thumbs, subgrid rows, popup room, key/pin inside (${path.basename(file)})`);
