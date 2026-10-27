import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'../..'));
const codeOf=name=>JSON.parse(fs.readFileSync(path.join(root,`src/scripts/bundled/${name}.js`),'utf8').slice(15).trim().replace(/;$/,''));
let passed=0;function check(name,fn){fn();passed++;console.log('ok',name)}
class Element {
  constructor(tag='div',attrs={},text=''){this.nodeType=1;this.tagName=tag.toUpperCase();this.attrs=new Map(Object.entries(attrs));this.children=[];this.dataset={};this.value='';if(text)this.append({nodeType:3,nodeValue:text});}
  get id(){return this.getAttribute('id')||''}get className(){return this.getAttribute('class')||''}
  get isConnected(){return this.tagName==='HTML'||!!this.parentElement?.isConnected}
  getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null}setAttribute(k,v){this.attrs.set(k,String(v))}
  append(node){node.parentElement=this;Object.defineProperty(node,'isConnected',{configurable:true,get:()=>this.isConnected});this.children.push(node)}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null}
  matches(selector){return selector.split(',').some(part=>{
    part=part.trim();const child=part.split(/\s*>\s*/);if(child.length>1){const last=child.pop();return this.matches(last)&&!!this.parentElement?.matches(child.join(' > '))}
    if(part.includes(':first-child')){if(this.parentElement?.children.find(x=>x.nodeType===1)!==this)return false;part=part.replace(':first-child','')}
    part=part.trim();const ancestry=part.split(/\s+(?![^\[]*\])/);if(ancestry.length>1){const last=ancestry.pop();return this.matches(last)&&!!this.parentElement?.closest(ancestry.join(' '))}
    const no=part.match(/:not\((.*?)\)/);if(no){if(this.matches(no[1]))return false;part=part.replace(no[0],'')}
    for(const a of part.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g))if(!this.attrs.has(a[1])||a[2]!==undefined&&this.getAttribute(a[1])!==a[2])return false;
    part=part.replace(/\[[^\]]*\]/g,'');const id=part.match(/#([\w-]+)/);if(id&&this.id!==id[1])return false;
    for(const c of part.matchAll(/\.([\w-]+)/g))if(!this.className.split(/\s+/).includes(c[1]))return false;
    const tag=part.match(/^[\w-]+/);return !tag||tag[0].toUpperCase()===this.tagName;
  })}
  closest(s){for(let n=this;n;n=n.parentElement)if(n.matches(s))return n;return null}
  querySelectorAll(s){const out=[];for(const c of this.children)if(c.nodeType===1){if(c.matches(s))out.push(c);out.push(...c.querySelectorAll(s))}return out}
  get text(){return this.children.filter(x=>x.nodeType===3).map(x=>x.nodeValue).join('')}
}
function environment(){
  const html=new Element('html'),head=new Element('head'),body=new Element('body');html.append(head);html.append(body);
  const listeners=new Map(),frames=new Map(),intervals=new Map(),observers=[],calls=[];let next=1;
  const doc={documentElement:html,head,body,activeElement:null,querySelectorAll:s=>html.querySelectorAll(s),getElementById:id=>html.querySelectorAll('#'+id)[0],createElement:tag=>new Element(tag),addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:(n,f)=>{if(listeners.get(n)===f)listeners.delete(n)},createTreeWalker(root){const nodes=[];const walk=n=>{for(const c of n.children){if(c.nodeType===3)nodes.push(c);else walk(c)}};walk(root);let i=0;return{currentNode:null,nextNode(){this.currentNode=nodes[i++];return!!this.currentNode}}}};
  class Observer{constructor(fn){this.fn=fn;this.targets=[];observers.push(this)}observe(n,options){this.targets.push([n,options])}disconnect(){this.targets=[]}}
  const host={document:doc,MutationObserver:Observer,requestAnimationFrame:fn=>{const id=next++;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),setInterval:fn=>{const id=next++;intervals.set(id,fn);return id},clearInterval:id=>intervals.delete(id),confirm:message=>{calls.push(['confirm',message]);return false},prompt:(message,value)=>{calls.push(['prompt',message,value]);return '首页'}};host.parent=host;
  const cleanups=[];const run=()=>vm.runInNewContext(codeOf('fruit-heart'),{window:host,BlueLemonade:{onCleanup:f=>cleanups.push(f)},console},{timeout:2000});
  const settle=()=>{for(let i=0;frames.size&&i<10;i++){const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f())}assert.equal(frames.size,0)};
  return{html,head,body,doc,host,observers,calls,cleanups,intervals,listeners,run,settle,mutate(){observers.filter(o=>o.targets.length).forEach(o=>o.fn());settle()},click(target){listeners.get('click')?.({target});settle()}};
}
const add=(parent,tag,attrs,text)=>{const x=new Element(tag,attrs,text);parent.append(x);return x};
let dictionary;vm.runInNewContext(codeOf('fruit'),{BlueLemonade:{translate:data=>dictionary=data}},{timeout:1000});
{const src=path.join(root,'tools/scripts-src/fruit-family'),read=n=>JSON.parse(fs.readFileSync(path.join(src,n),'utf8'));
 const parts=['common','fruit','qingguo','sese'].map(n=>read(`prompts-${n}.json`)),norm=v=>String(v||'').normalize('NFKC').replace(/[︎️\s]/g,'');
 check('family dictionary: priority 20, partial, at least 460 prompt and 48 regex titles',()=>{assert.equal(dictionary.priority,20);assert.equal(dictionary.partial,true);assert.ok(dictionary.prompts.length>=460);assert.ok(dictionary.regex.length>=48)});
 check('every entry has a name and a title and only the known fields',()=>{for(const item of [...dictionary.prompts,...dictionary.regex]){assert.ok(item.name&&item.title);for(const k of Object.keys(item))assert.ok(['id','name','title','desc'].includes(k),k)}});
 check('every source-file name is in the bundle (common and each preset file)',()=>{const names=new Set(dictionary.prompts.map(e=>norm(e.name))),regex=new Set(dictionary.regex.map(e=>norm(e.name)));for(const part of parts){for(const e of part.prompts)assert.ok(names.has(norm(e.name)),e.name);for(const e of part.regex)assert.ok(regex.has(norm(e.name)),e.name)}});
 check('per-preset files do not repeat a common name',()=>{const common=new Set(parts[0].prompts.map(e=>norm(e.name)+'|'+(e.id||'')));for(const part of parts.slice(1))for(const e of part.prompts)assert.ok(!common.has(norm(e.name)+'|'+(e.id||'')),e.name)});}
check('both plain copies execute the exact bundled code',()=>{for(const name of ['fruit','fruit-heart']){const s=fs.readFileSync(path.join(root,`src/scripts/plain/${name}.js`),'utf8');assert.equal(s.slice(s.indexOf('/*BL-SCRIPT-START*/')+19,s.lastIndexOf('/*BL-SCRIPT-END*/')).trim(),codeOf(name).trim())}});
const e=environment(),panel=add(e.html,'div',{id:'fruit-heart-v6',class:'open'}),home=add(panel,'button',{'data-nav':'overview'},'首页'),close=add(panel,'button',{title:'关闭'},'×');
const prompt=add(panel,'input',{placeholder:'搜索全部条目…'});prompt.value='首页';prompt.checked=true;
const area=add(panel,'textarea',{},'首页'),code=add(panel,'code',{},'{{输入}}'),chat=add(e.body,'div',{id:'chat'},'首页');
const profile=add(panel,'button',{'data-profile':'首页'},'首页'),word=add(panel,'button',{'data-nsfw-drop':'start:0',title:'点一下删掉「首页」'},'首页'),preview=add(panel,'pre',{class:'fh-exp-preview'},'首页');
const builtInProfile=add(panel,'button',{'data-profile':'果实默认'},' 果实默认 ');
const userLabel=add(panel,'button',{'data-bl-fruit-user-label':'1',title:'首页','aria-label':'首页'},'首页');
const edit=add(panel,'div',{contenteditable:'true'},'首页'),svg=add(panel,'svg',{},'首页'),author=add(panel,'span',{},'@喵喵电波MoM');
const version=add(panel,'small',{},'脚本 v20261003.1 · 本地测试 · 果实 V6+');
const reasoning=add(e.body,'select',{id:'reasoning_select'}),option=add(reasoning,'option',{value:'果实之心'},'果实之心'),foreign=add(reasoning,'option',{value:'custom'},'首页');
const qr=add(panel,'button',{'data-qr':'synthetic','data-qr-label':'推进剧情'},'推进剧情');
e.run();
check('home text and close hint use their correct contexts',()=>{assert.equal(home.text,'홈');assert.equal(close.getAttribute('title'),'닫기')});
check('inputs keep original values and toggle state',()=>{assert.equal(prompt.value,'首页');assert.equal(prompt.checked,true);assert.equal(prompt.getAttribute('placeholder'),'전체 항목 검색…');assert.equal(area.text,'首页')});
check('chat, code, editable content, keywords, profiles and preview stay original',()=>{for(const node of [chat,profile,word,preview,edit,svg])assert.equal(node.text,'首页');assert.equal(code.text,'{{输入}}');assert.equal(author.text,'@喵喵电波MoM')});
check('the built-in combination name translates only its display, preserving its selection key',()=>{assert.equal(builtInProfile.text,' 과일 기본 ');assert.equal(builtInProfile.getAttribute('data-profile'),'果实默认')});
check('user-chosen quick-reply names and font labels keep their exact text and accessible labels',()=>{assert.equal(userLabel.text,'首页');assert.equal(userLabel.getAttribute('title'),'首页');assert.equal(userLabel.getAttribute('aria-label'),'首页')});
check('a keyword tooltip keeps the actual stored keyword',()=>{assert.ok(word.getAttribute('title').includes('首页'));assert.ok(!word.getAttribute('title').includes('홈'))});
check('adjacent version captures preserve the version and translate the suffix',()=>{assert.ok(version.text.includes('20261003.1'));assert.ok(version.text.includes('로컬 테스트'));assert.ok(!version.text.includes('本地测试'))});
check('reasoning display changes only the owned option; its value stays original',()=>{assert.equal(option.text,'과일의 마음');assert.equal(option.getAttribute('value'),'果实之心');assert.equal(foreign.text,'首页')});
check('QR branch keys stay original while labels translate',()=>{assert.ok(!qr.text.includes('剧情'));assert.equal(qr.getAttribute('data-qr-label'),'推进剧情');assert.equal(qr.getAttribute('data-qr'),'synthetic')});
check('the observer never watches the chat or body subtree',()=>{for(const o of e.observers)for(const [n,opts] of o.targets){assert.notEqual(n,chat);if(n===e.body||n===e.html)assert.notEqual(opts.subtree,true)}});
const save=add(panel,'button',{},'保存');e.mutate();
check('newly rendered controls translate after mutation',()=>assert.equal(save.text,'저장'));
e.click(home);e.host.confirm('操作失败');e.host.prompt('方案名称','首页');e.host.confirm('删除方案「首页」？开关状态不变。');
check('native dialogs translate only known prompts and preserve names/defaults/return values',()=>{assert.equal(e.calls[0][1],'操作失败');assert.notEqual(e.calls[1][1],'方案名称');assert.equal(e.calls[1][2],'首页');assert.ok(e.calls[2][1].includes('首页'));assert.equal(e.host.prompt('方案名称','原始值'),'首页')});
home.children[0].nodeValue='사용자가 바꾼 표시';close.setAttribute('title','사용자가 바꾼 설명');
e.cleanups.at(-1)();
check('turning off restores only text and attributes still owned by the adapter',()=>{assert.equal(home.text,'사용자가 바꾼 표시');assert.equal(close.getAttribute('title'),'사용자가 바꾼 설명');assert.equal(save.text,'保存');assert.equal(option.text,'果实之心');assert.equal(prompt.getAttribute('placeholder'),'搜索全部条目…')});
check('the combination display restores on OFF and a changed selection key releases the owned label',()=>{assert.equal(builtInProfile.text,' 果实默认 ');e.run();assert.equal(builtInProfile.text,' 과일 기본 ');builtInProfile.setAttribute('data-profile','Custom name');e.mutate();assert.equal(builtInProfile.text,' 果实默认 ');builtInProfile.children[0].nodeValue='用户自己的名称';e.mutate();assert.equal(builtInProfile.text,'用户自己的名称');e.cleanups.at(-1)()});
check('settings action labels fit a half-width button on one line',()=>{const data=JSON.parse('{'+codeOf('fruit-heart').split('installFruitHeartKorean(BlueLemonade,{')[1].trim().replace(/\);\s*$/,''));const ko=zh=>data.entries.find(x=>x.zh===zh&&x.kind==='text')?.ko;assert.equal(ko('重新配置酒馆解析'),'분석 설정 다시 적용');assert.equal(ko('保存当前为方案'),'현재 조합 저장');assert.equal(ko('删除当前方案'),'이 조합 삭제')});
check('cleanup removes timers, observers, styles and handlers',()=>{assert.equal(e.intervals.size,0);assert.equal(e.listeners.size,0);assert.ok(e.observers.every(x=>x.targets.length===0));assert.equal(e.head.children.length,0);assert.equal(e.host.__blueLemonadeFruitHeartKorean_v1,undefined)});
check('turning on twice replaces its own instance without duplicate work',()=>{e.run();e.run();assert.equal(e.intervals.size,1);assert.equal(e.head.children.length,1);e.cleanups.at(-1)();assert.equal(e.intervals.size,0)});
check('a later external wrapper stays installed and cannot revive a stopped translation',()=>{e.run();e.click(home);const previous=e.host.prompt;const external=(...args)=>previous(...args);e.host.prompt=external;e.cleanups.at(-1)();e.host.prompt('方案名称','首页');assert.equal(e.host.prompt,external);assert.equal(e.calls.at(-1)[1],'方案名称');assert.equal(e.calls.at(-1)[2],'首页')});
const unowned=environment(),otherSelect=add(unowned.body,'select',{id:'reasoning_select'}),otherOption=add(otherSelect,'option',{value:'果实之心'},'果实之心');unowned.run();
check('an unrelated reasoning menu remains unchanged without the owned panel',()=>assert.equal(otherOption.text,'果实之心'));unowned.cleanups.at(-1)();
const h=environment(),helper=add(h.body,'div',{id:'tavern_helper'}),container=add(helper,'div',{'data-container-type':'preset'});
const textOf=node=>{const w=h.doc.createTreeWalker(node,4);let s='';while(w.nextNode())s+=w.currentNode.nodeValue;return s};
const model={folder:{id:'qa-folder',name:'果实之心'},scripts:[{id:'qa-ecot',name:'果实之心-ECoT自动注入与解析 @Author'},{id:'qa-git',name:'果实之心丨Git正式版'},{id:'qa-local',name:'果实之心丨本地版'}]};
const modelBefore=JSON.stringify(model),folder=add(container,'div',{'data-type':'folder','data-folder':'','data-folder-id':model.folder.id}),header=add(folder,'div',{}),apple=add(header,'i',{class:'fa-solid fa-apple-whole'}),folderLabel=add(header,'span',{class:'grow overflow-hidden'},model.folder.name);
const scriptRows=model.scripts.map(item=>{const row=add(folder,'div',{'data-type':'script','data-script-id':item.id});return{row,label:add(row,'div',{class:'grow overflow-hidden'},item.name)}});
const rawInput=add(helper,'input',{});rawInput.value=model.scripts[0].name;const rawCode=add(helper,'textarea',{},'果实之心');
const outsider=add(h.body,'div',{'data-container-type':'preset'}),outsideRow=add(outsider,'div',{'data-type':'script','data-script-id':'outside'}),outsideLabel=add(outsideRow,'div',{class:'grow overflow-hidden'},'果实之心');
const unrelated=add(container,'div',{'data-type':'script','data-script-id':'qa-other'}),unrelatedLabel=add(unrelated,'div',{class:'grow overflow-hidden'},'我的果实之心备份');
h.run();
check('Helper folder and the three known script names translate without touching the icon or author',()=>{assert.equal(textOf(folderLabel),'과일의 마음');assert.deepEqual(scriptRows.map(x=>textOf(x.label)),['과일의 마음-ECoT 자동 삽입·해석 @Author','과일의 마음丨Git 정식판','과일의 마음丨로컬판']);assert.equal(apple.className,'fa-solid fa-apple-whole')});
check('Helper model names, ids, edit values and code stay original; matching is scoped and complete',()=>{assert.equal(JSON.stringify(model),modelBefore);assert.equal(rawInput.value,model.scripts[0].name);assert.equal(rawCode.text,'果实之心');assert.equal(outsideLabel.text,'果实之心');assert.equal(unrelatedLabel.text,'我的果实之心备份');assert.equal(folder.getAttribute('data-folder-id'),'qa-folder')});
folderLabel.children=[];add(folderLabel,'span',{},'果');const marked=add(folderLabel,'mark',{class:'TH-Highlighter--mark'},'实之');add(folderLabel,'span',{},'心');const markText=marked.children[0];h.mutate();
check('Helper search highlights keep their elements/text nodes while the whole label translates',()=>{assert.equal(textOf(folderLabel),'과일의 마음');assert.equal(marked.children[0],markText);assert.equal(marked.className,'TH-Highlighter--mark');assert.ok(marked.text.length);assert.equal(new RegExp('实之').test(model.folder.name),true)});
folderLabel.children=[];folderLabel.append({nodeType:3,nodeValue:model.folder.name});h.mutate();
check('Vue name rerenders and cleared search highlights are translated again',()=>assert.equal(textOf(folderLabel),'과일의 마음'));
const groupGlobal=add(helper,'div',{'data-container-type':'global'}),rowGlobal=add(groupGlobal,'div',{'data-type':'script','data-script-id':'qa-global'}),labelGlobal=add(rowGlobal,'div',{class:'grow overflow-hidden'},' 🍏 果实之心 @Author ');h.mutate();
check('Late Helper containers translate and preserve a literal apple and surrounding whitespace',()=>assert.equal(textOf(labelGlobal),' 🍏 과일의 마음 @Author '));
const oldNode=scriptRows[1].label.children[0];model.scripts[1].name='果实之心丨本地版';oldNode.nodeValue=model.scripts[1].name;h.mutate();
check('A reused name node tracks its new original name before cleanup',()=>assert.equal(textOf(scriptRows[1].label),'과일의 마음丨로컬판'));
scriptRows[2].label.children[0].nodeValue='사용자가 바꾼 표시';h.cleanups.at(-1)();
check('Helper OFF restores the latest originals and preserves an externally changed display',()=>{assert.equal(textOf(folderLabel),'果实之心');assert.equal(textOf(scriptRows[0].label),model.scripts[0].name);assert.equal(textOf(scriptRows[1].label),model.scripts[1].name);assert.equal(textOf(scriptRows[2].label),'사용자가 바꾼 표시');assert.equal(textOf(labelGlobal),' 🍏 果实之心 @Author ');assert.ok(h.observers.every(x=>x.targets.length===0));assert.equal(h.intervals.size,0)});
const u=environment(),uHelper=add(u.body,'div',{id:'tavern_helper'}),uContainer=add(uHelper,'div',{'data-container-type':'preset'}),uRow=add(uContainer,'div',{'data-type':'script','data-script-id':'qa-rename'}),uLabel=add(uRow,'div',{class:'grow overflow-hidden'});
const uMark=add(uLabel,'mark',{class:'TH-Highlighter--mark'},'果实'),uSuffix=add(uLabel,'span',{},'之心丨Git正式版');u.run();
uSuffix.children[0].nodeValue='之心丨사용자 이름';u.mutate();
check('Unknown renamed Helper names restore unchanged owned search fragments immediately',()=>{assert.equal(uMark.text,'果实');assert.equal(uSuffix.text,'之心丨사용자 이름');assert.equal(uLabel.children[0],uMark)});
uMark.children[0].nodeValue='외부 표시';u.cleanups.at(-1)();
check('Cleanup releases an out-of-scope name and preserves later external edits',()=>{assert.equal(uMark.text,'외부 표시');assert.equal(uSuffix.text,'之心丨사용자 이름')});
// 7.0.4 model-tag notice: Fruit shows it when ST's own API / model selector changes (outside the Fruit panel), so it is
// translated without the 15 s click window; other Fruit toasts still need a recent click in the panel.
const tz=environment();tz.run();
const toasts=add(tz.body,'div',{id:'toast-container'});
const toastOf=text=>add(add(toasts,'div',{class:'toast toast-success'}),'div',{class:'toast-message'},text);
const halfWidth=toastOf('已切换模型标签:#DS'),fullWidth=toastOf('已切换模型标签：#GEMINI'),localBuild=toastOf('已切换模型标签：# CLAUDE'),otherToast=toastOf('预设已切换，请重新打开面板');
tz.mutate();
check('model-tag toasts translate without a click in either colon width, keeping the #tag',()=>{assert.equal(halfWidth.text,'모델 태그를 바꿨어요: #DS');assert.equal(fullWidth.text,'모델 태그를 바꿨어요: #GEMINI');assert.equal(localBuild.text,'모델 태그를 바꿨어요: #CLAUDE')});
check('other Fruit toasts still wait for a recent click in the panel',()=>{assert.equal(otherToast.text,'预设已切换，请重新打开面板')});
check('the always-on toast list holds only the model-tag notices, each a toast pattern or entry',()=>{const data=JSON.parse('{'+codeOf('fruit-heart').split('installFruitHeartKorean(BlueLemonade,{')[1].trim().replace(/\);\s*$/,''));assert.deepEqual(data.toastAnytime,['已切换模型标签：# {0}','已切换模型标签:#{0}','已切换模型标签：#{0}']);for(const zh of data.toastAnytime)assert.ok(data.entries.some(e=>e.zh===zh&&e.kind==='pattern'&&e.ko==='모델 태그를 바꿨어요: #{0}'),zh)});
check('catalog version moved with the dictionary change',()=>{assert.match(fs.readFileSync(path.join(root,'src/scripts/catalog.js'),'utf8'),/\{id:'fruit-heart',family:'fruit-family',name:'과일의 마음 한글화',version:'1\.0\.9'/)});
// 8.0.7 후보(10-27 제보 「야한 과일 · 청과 한글화 안 됨」): 과일의 마음 창은 프롬프트 이름을 줄여 보여요(果实之心 창 스크립트의 규칙 그대로 옮김).
//   선택 단추 · 목록 · 칩 · 항목 이름 = 「｜」 앞 제목에서 앞 이모지를 뗀 것, 항목 꼬리표 = 「｜」 뒤 칸들, 목록 풀이 = 택1·필수 칸을 뺀 칸을 「 · 」로, 분류 = 구분선 제목 · 풀이.
//   과일 6.4 · 야한 과일 2.0 · 청과 2.0 의 모든 이름(사전 원본 = 공통 + 프리셋별)을 그 꼴로 창에 그려 한자가 남지 않는지 봐요.
//   남겨도 되는 것: @만든 사람 · #모델 꼬리표 · 모델이 실제로 쓰는 표식 [语言检定].
{
  const src=path.join(root,'tools/scripts-src/fruit-family'),read=n=>JSON.parse(fs.readFileSync(path.join(src,n),'utf8'));
  const stripSource=n=>String(n||'').replace(/\s*#\s*[^#]+?(?=#|$)/g,'').trimEnd();
  const nameParts=n=>{const plain=stripSource(n).replace(/\s*@[^\s@#]+/g,'').trim();const bits=plain.split('｜').map(p=>p.trim()).filter(Boolean);const title=bits.shift()||plain;const group=bits.find(p=>/(?:\d{1,2}|多)选1$/.test(p))||'';return{title,group,hints:bits.filter(p=>p!==group)}};
  const LEAD=/^(?:\p{Extended_Pictographic}️?|📌)\s*/u,plainName=n=>nameParts(n).title.replace(LEAD,'');
  const hintText=n=>nameParts(n).hints.filter(x=>!/单选|多选|必开|别动位置|勿动/.test(x)).join(' · ');
  const DIV=/^\s*(?:━+|—{2,}|-{2,})\s*\S/,BAR=/\s*(?:━+|—{2,}|-{2,})\s*/;
  const divParts=n=>{const b=String(n).replace(new RegExp('^'+BAR.source),'').replace(new RegExp(BAR.source+'$'),'');const c=b.search(BAR);return c<0?[b.trim()]:[b.slice(0,c).trim(),b.slice(c).replace(new RegExp('^'+BAR.source),'').trim()]};
  const HAN=/\p{Script=Han}/u,left=t=>HAN.test(String(t).replace(/@[^\s@]+/gu,'').replace(/#\S+/gu,'').replace(/[[【［]语言检定[\]】］]/gu,''));
  const presets={'과일 6.4':['common','fruit'],'야한 과일 2.0':['common','sese'],'청과 2.0':['common','qingguo']};
  const results={};
  for(const [label,files] of Object.entries(presets)){
    const names=[...new Set(files.flatMap(f=>read(`prompts-${f}.json`).prompts.map(p=>p.name)))];
    const env=environment(),panel=add(env.html,'div',{id:'fruit-heart-v6',class:'open'}),home=add(panel,'div',{class:'fh-main'}),sheet=add(panel,'div',{class:'fh-sheet'}),list=add(panel,'div',{class:'fh-items'}),shown=[];
    const put=(parent,tag,attrs,text,kind)=>{if(text&&HAN.test(text))shown.push([add(parent,tag,attrs,text),text,kind])};
    for(const name of names){
      if(DIV.test(name)){const [t,h]=divParts(name);const head=add(panel,'button',{class:'fh-sec-head'});put(head,'b',{},t,'분류');if(h)put(head,'b',{},h,'분류 풀이');continue;}
      const sel=add(home,'button',{class:'fh-sel','data-pick-group':'g'});put(sel,'span',{class:'fh-sel-t'},plainName(name),'선택 단추');
      put(home,'button',{'data-chip':'x'},plainName(name),'칩');
      const item=add(sheet,'button',{class:'fh-sheet-item'});put(item,'span',{},plainName(name),'목록');put(item,'em',{},hintText(name),'목록 풀이');
      const row=add(list,'label',{class:'fh-item'});put(row,'span',{class:'fh-item-name'},nameParts(name).title.replace(LEAD,''),'항목 이름');
      const meta=add(row,'span',{class:'fh-item-meta'});const p=nameParts(name);if(p.group)put(meta,'i',{class:'fh-g'},p.group,'택1 꼬리표');for(const h of p.hints)put(meta,'i',{},h,'항목 꼬리표');
    }
    env.run();
    results[label]={total:shown.length,left:shown.filter(([el])=>left(el.text)).map(([el,text,kind])=>`${kind}: ${text} → ${el.text}`)};
    env.cleanups.at(-1)();
  }
  for(const [label,r] of Object.entries(results))check(`${label}: every option, chip, list note, entry name and tag in the Fruit Heart panel shows Korean (${r.total} labels)`,()=>{assert.ok(r.total>150,'labels collected');assert.deepEqual(r.left,[],'labels with Han left')});
  check('the reported labels read as short Korean (특별 조정 · 일반 사고 과정 · 미니 웹 극장)',()=>{const data=JSON.parse('{'+codeOf('fruit-heart').split('installFruitHeartKorean(BlueLemonade,{')[1].trim().replace(/\);\s*$/,''));const t=new Map(data.titles);assert.equal(t.get('特调版推剧情 含扩写'),'특별 조정 밀기+확장');assert.equal(t.get('常规 COT改'),'일반 사고 과정 · 수정판');assert.equal(t.get('汐见剧场'),'미니 웹 극장');assert.equal(t.get('小回剧场'),'번외 꾸밈 극장')});
}
console.log(`fruit-localization: ${passed} passed`);
