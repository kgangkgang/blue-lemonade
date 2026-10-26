// 6.9.5 파라미터 2열 격자 지키기 — 설정값 칸을 두 칸씩 놓는 격자(실리태번 생성 설정 · 사용자 설정 · 월드 인포 · API · 서식 서랍 ·
// 정규식 편집기 · BL 설정 창 · 내장 애드온)를 한 열로 내리는 규칙이 style.css 에 다시 들어오면 멈춘다.
// 한 열은 큰 글씨로 칸이 좁을 때만 — 위 끝이 있는 @container (max-width / width <) 안에서만 허용한다.
// 칸 안 배치(윗줄 이름 | 숫자칸 · 아랫줄 슬라이더)와 큰 글씨 한 열 내림(em 기준)도 확인한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../..',import.meta.url)));
const file=process.argv[3]||path.join(root,'style.css');
const css=fs.readFileSync(file,'utf8');

// ---- 작은 CSS 읽개: 스타일 규칙마다 { selectors, decls, at:[at-rule 머리말…] }
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
      // 스타일 규칙: 짝 맞는 } 까지가 선언
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
// 맨 바깥 :is(…) 를 갈래로 펼침 (:has · :not 안은 그대로)
function expandIs(sel){
  let d=0,q=null;
  for(let i=0;i<sel.length;i++){const c=sel[i];if(q){if(c==='\\')i++;else if(c===q)q=null;continue}if(c==='"'||c==="'"){q=c;continue}
    if(c==='('||c==='['){d++;continue}if(c===')'||c===']'){d--;continue}
    if(!d&&sel.startsWith(':is(',i)){let j=i+4,e=1;for(;j<sel.length&&e;j++){if(sel[j]==='(')e++;else if(sel[j]===')')e--}
      return splitTop(sel.slice(i+4,j-1),',').flatMap(alt=>expandIs(sel.slice(0,i)+alt+sel.slice(j)))}}
  return [sel];
}
const NOT_TAIL=/:not\((?:[^()]|\([^()]*\))*\)$/;
const norm=sel=>{let s=sel.replace(/\s+/g,' ').replace(/\s*>\s*/g,' > ').replace(/\s*\+\s*/g,' + ').replace(/\(\s+/g,'(').replace(/\s+\)/g,')').trim();while(NOT_TAIL.test(s))s=s.replace(NOT_TAIL,'');return s};
const decl=(d,prop)=>{const m=[...d.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`,'g'))];return m.length?m[m.length-1][1].trim():null};
const tracks=v=>{v=v.replace(/!important/,'').trim();let n=0;for(const t of splitTop(v,' ')){const m=/^repeat\(\s*([^,]+),/.exec(t);if(m)n+=/auto-(fit|fill)/.test(m[1])?2:(+m[1]||1);else n++}return n};
// 큰 글씨 한 열 내림만 허용: 위 끝(max-width · width <)이 있는 @container 안 / 꺼 둔 미리보기 덩어리(@media not all)
const narrow=r=>r.at.some(a=>/^@container\b/.test(a)&&/(max-width|width\s*<)/.test(a));
const parked=r=>r.at.some(a=>/^@media\s+not all\b/.test(a));
const narrowMedia=r=>r.at.some(a=>/^@media\b/.test(a)&&/(max-width|width\s*<)/.test(a));
const widening=r=>r.at.some(a=>/^@(container|media)\b/.test(a)&&/(min-width|width\s*>)/.test(a));
// 원래부터(6.7.9) 한 칸인 하위 격자 — 마크다운 다듬기 슬라이더는 반 폭 카드 안이라 한 칸
const KEEP_ONE=new Set(['.salty-panel .bl-md-tuning > .bl-control-grid']);

const rules=parse(css).filter(r=>!parked(r));
assert.ok(rules.length>3000,'style.css 를 읽었다: '+rules.length);
const items=rules.flatMap(r=>r.selectors.flatMap(expandIs).map(s=>({sel:norm(s),raw:s,r})));

// 두 칸씩 놓는 격자(원래 모듈) — 이 자리를 한 열로 만드는 규칙은 안 됨
const GRIDS=[
  /#range_block_openai$/,
  /\[name="(AvatarAndChatDisplay|FontBlurChatWidthBlock|themeToggles|CharacterHandlingToggles|MiscellaneousToggles|ChatMessageHandlingToggles)"\]$/,
  /#wiSliders$/,/#wiCheckboxes$/,/\[name="perEntryOverridesBlock"\]$/,
  /#openai_api$/,/#openai_api (form|div)(:where\(\[data-bl-row~="h4"\]\)(?:bl-s|\*))?$/,/#vertexai_form > div$/,/#prompt_post_processing_form$/,
  /\.salty-group\[data-bl-row~="sl2"\](?:\.bl-s|\*)$/,/\.salty-group:has\(> :is\(\.salty-row, ?\.salty-slider\) \+ :is\(\.salty-row, ?\.salty-slider\)\)$/,
  /\.bl-control-grid$/,/\.salty-sizes$/,/\.bl-md-groups$/,/\.bl-prompt-name-row$/,/\.bl-capture-filter$/,/\.bl-tool-grid(:has\(.*\))?$/,/\.bl-addon-layout$/,
  /\.bl-etc-grid$/,/\.bl-setting-locks$/,/\.bl-word-presets$/,/\.regex_editor > \.flexFlowColumn$/,
  /\.lv-grid$/,/\.lv-tools$/,/\.rl-modules$/,/\.llmt-checks--grid$/,/\.lvs-fields$/,/#lv_pane_(read|voices|data)$/,/#pt-params-wrap$/,/\.bl-look-grid$/,/\.bwr_grid$/,
  /\.rl-numbers$/,/\.rl-budget-nums$/,
];
// 두 칸이 가로로 나란한 flex 줄 — 세로(column)로 바꾸는 규칙은 안 됨
const ROWS=[
  /#AdvancedFormatting > \.spaceEvenly$/,/\.flex-container:has\(> \.flex1 #context_example_separator.*\)$/,/#InstructSequencesColumn details > \.flex-container$/,
  /\.flex-container:has\(> \.flex1 > input\[name="min_depth"\].*\)$/,/\.flex-container:has\(> \.wi-enter-footer-text \+ \.wi-enter-footer-text\)$/,
  /\.WIEnteryHeaderControls$/,/\.world_entry_edit > \.flexGap10$/,/#bg-header-fixed$/,/\.claude_params \.parameter-row$/,
  /\.rl-numbers$/,/\.rl-budget-nums$/,
];
const bad=[];
for(const {sel,r} of items){
  if(narrow(r))continue;
  const gtc=decl(r.decls,'grid-template-columns'),dir=decl(r.decls,'flex-direction'),flow=decl(r.decls,'flex-flow');
  // !important 가 없는 한 칸은 원래 모듈의 좁은 화면 규칙(@media max-width) · 좁은 기본값 + 넓으면 두 칸(min-width) · KEEP_ONE 만 허용
  const g0=GRIDS.find(g=>g.test(sel));
  const oneOk=v=>!/!important/.test(v)&&(narrowMedia(r)||KEEP_ONE.has(sel)||items.some(o=>g0.test(o.sel)&&widening(o.r)&&tracks(decl(o.r.decls,'grid-template-columns')||'none')>=2));
  if(gtc&&tracks(gtc)<2&&g0&&!oneOk(gtc))bad.push(`한 열 격자: ${sel} { grid-template-columns: ${gtc} }`);
  if(((dir&&/column/.test(dir))||(flow&&/column/.test(flow)))&&ROWS.some(g=>g.test(sel)))bad.push(`세로로 쌓음: ${sel} { flex-direction: ${dir||flow} }`);
  // 칸을 모두 격자 전체 폭으로 펴는 규칙 (6.8.0: #range_block_openai > * { grid-column: 1 / -1 !important })
  const gc=decl(r.decls,'grid-column'),w=decl(r.decls,'width');
  const kid=/^(.*) > \*$/.exec(sel);
  if(kid&&gc&&/^1\s*\/\s*-1\s*!important/.test(gc)&&GRIDS.some(g=>g.test(kid[1])))bad.push(`칸 전체 폭: ${sel} { grid-column: ${gc} }`);
  if(kid&&w&&/^100%\s*!important/.test(w)&&ROWS.some(g=>g.test(kid[1])))bad.push(`칸 전체 폭: ${sel} { width: ${w} }`);
}
assert.deepEqual(bad,[],'2열 파라미터 격자를 한 열로 내리는 규칙:\n'+bad.join('\n'));

// 원래 2열 격자가 살아 있는지 (지우면 멈춤)
const twoCols=re=>items.some(({sel,r})=>!narrow(r)&&re.test(sel)&&tracks(decl(r.decls,'grid-template-columns')||'none')>=2);
for(const re of [/#range_block_openai$/,/#wiSliders$/,/#wiCheckboxes$/,/\[name="themeToggles"\]$/,/\.salty-group\[data-bl-row~="sl2"\](?:\.bl-s|\*)$/,/#openai_api$/])
  assert.ok(twoCols(re),'두 칸 격자가 있어야 함: '+re);

// 생성 설정 칸 안: 윗줄 이름 | 숫자칸, 아랫줄 슬라이더 칸 너비 꽉
const cell=(tail,want)=>items.some(({sel,r})=>sel.startsWith('body.salty #left-nav-panel #range_block_openai > .range-block[data-bl-row~="range"]')&&sel.endsWith(tail)&&Object.entries(want).every(([k,v])=>(decl(r.decls,k)||'').replace(/\s+/g,' ').startsWith(v)));
assert.ok(cell('> .range-block-title',{'grid-column':'1 !important','grid-row':'1 !important'}),'이름은 윗줄 왼쪽');
assert.ok(cell('.range-block-counter',{'grid-column':'2 !important','grid-row':'1 !important'}),'숫자칸은 윗줄 오른쪽');
assert.ok(cell('.range-block-range',{'grid-column':'1 / -1 !important','grid-row':'2 !important','width':'100% !important'}),'슬라이더는 아랫줄 칸 너비 꽉');

// 두 칸 이름 기준선 맞춤은 이름 줄이 있는 칸만 — 격자 전체에 걸면 스위치 칸(줄 높이 채움 · 가운데)이 어긋난다
assert.ok(!items.some(({sel,r})=>sel==='body.salty #left-nav-panel #range_block_openai'&&/baseline/.test(decl(r.decls,'align-items')||'')),'생성 설정 격자 전체에 align-items: baseline 금지');
assert.ok(items.some(({sel,r})=>sel==='body.salty #left-nav-panel #range_block_openai > .range-block[data-bl-row~="title"]'&&decl(r.decls,'align-self')==='baseline'),'이름 줄이 있는 칸은 기준선 맞춤');

// 큰 글씨 한 열 내림은 em 기준으로만: 생성 설정의 마지막(이기는) 열 규칙은 칸 최소 em · 열 최소 40%(최대 두 칸) 자동 맞춤
const gen=items.filter(({sel,r})=>!narrow(r)&&!narrowMedia(r)&&sel==='body.salty #left-nav-panel #range_block_openai'&&decl(r.decls,'grid-template-columns'));
const last=decl(gen[gen.length-1].r.decls,'grid-template-columns').replace(/\s+/g,' ');
assert.match(last,/^repeat\(auto-fit, ?minmax\(min\(100%, ?max\((\d+(\.\d+)?)em, ?4\d%\)\), ?1fr\)\)$/,'생성 설정 열: '+last);
assert.ok(+/max\(([\d.]+)em/.exec(last)[1]<=9,'칸 최소가 9em 을 넘으면 PC 왼쪽 패널(약 330px)에서 한 열이 된다: '+last);
// 월드 인포 활성화의 한 열 내림도 em 기준 · 18em 이하
const wi=rules.filter(r=>narrow(r)&&r.selectors.some(s=>/#wiSliders/.test(s))&&/grid-template-columns/.test(r.decls));
assert.ok(wi.length&&wi.every(r=>{const m=/max-width:\s*([\d.]+)em/.exec(r.at.join(' '));return m&&+m[1]<=18}),'월드 인포 한 열 내림은 18em 이하 em 기준');

console.log(`PASS param two columns: ${GRIDS.length} grids · ${ROWS.length} rows kept side by side, in-cell rows, em fallback (${path.basename(file)})`);
