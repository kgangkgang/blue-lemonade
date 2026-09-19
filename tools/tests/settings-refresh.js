// Synthetic UI test; compare ?dev against the installed release before synchronizing it.
const runtime=new URL(new URLSearchParams(location.search).has('dev')?'../../salty-ext/':'../../',import.meta.url);
localStorage.setItem('salty_pvfold','0');localStorage.setItem('salty_tab','text');localStorage.setItem('salty_subs',JSON.stringify({text:'text'}));
const ctx={extensionSettings:{},powerUserSettings:{},saveSettingsDebounced(){},getRequestHeaders:()=>({})};
window.SillyTavern={getContext:()=>ctx};
const errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>{errors.push(String(e.reason));document.querySelector('#results').textContent=String(e.reason?.stack||e.reason)});
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('style.css',runtime);document.head.append(css);await new Promise(r=>css.onload=r);
const {getSettings}=await import(new URL('src/settings.js',runtime));
const {applyAll}=await import(new URL('src/apply.js',runtime));
const {mountPanel,unmountPanel}=await import(new URL('src/panel.js',runtime));
const s=getSettings();s.profile.original=s.userProfile.original=false;applyAll();
const host=document.querySelector('#panel'),second=document.createElement('div');document.body.append(second);
const panel=mountPanel(host),other=mountPanel(second);
const pause=()=>new Promise(r=>setTimeout(r,30));
const field=(root,path)=>root.querySelector(`[data-num="${path}"]`);
const change=(path,value)=>{const el=field(panel,path);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
const click=action=>panel.querySelector(`[data-act="${action}"]`).click();
const route=(tab,sub)=>panel.querySelector(`[data-act="editor-route"][data-tab="${tab}"][data-sub="${sub}"]`).click();
document.querySelector('#progress').textContent='준비 완료';
document.querySelector('#run').onclick=async()=>{
 route('text','text');
 const checks=[],times=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
 for(const [path,value] of [['type.size',19],['type.lineHeight',1.9],['type.letterSpacing',.025],['type.weight',500]]){
  const before=s.type[path.split('.')[1]],input=field(panel,path),peer=field(other,path),viewport=panel.querySelector('.bl-view-port');
  change(path,value);await pause();const changed=s.type[path.split('.')[1]];click('history-undo');await pause();
  check(path+' undo restores value',s.type[path.split('.')[1]]===before);
  check(path+' retains input and preview',input.isConnected&&!!viewport&&viewport.isConnected);
  check(path+' syncs both panels',field(panel,path).value===field(other,path).value&&peer.isConnected);
  click('history-redo');await pause();check(path+' redo restores value',s.type[path.split('.')[1]]===changed);
  check(path+' slider tracks number',Math.abs(Number(panel.querySelector(`[data-range="${path}"]`).value)-changed)<=Number(panel.querySelector(`[data-range="${path}"]`).step));
 }
 route('text','dialogue');const previous=panel.querySelector('.salty-sec');
 panel.querySelector('[data-act="size"][data-path="type.dialogueSize"][data-value="own"]').click();await pause();
 check('nullable mode creates numeric control',!!field(panel,'type.dialogueSize'));
 click('history-undo');await pause();check('undo nullable mode removes control',!field(panel,'type.dialogueSize')&&!previous.isConnected);
 route('theme','palette');const tint='lightTint',oldTint=s[tint],card=panel.querySelector('.salty-pal[data-family]');
 change(tint,12);await pause();const color=card.style.getPropertyValue('--pal-bg');click('history-undo');await pause();
 check('tint undo updates retained palette cards',card.isConnected&&card.style.getPropertyValue('--pal-bg')!==color&&s[tint]===oldTint);
 panel.querySelector('[data-act="palette-mode"][data-mode="dark"]').click();await pause();
 check('structural palette change rebuilds controls',!!field(panel,'nightTint')&&!field(panel,'lightTint'));
 click('history-undo');await pause();check('structural undo restores light control',!!field(panel,'lightTint'));
 route('text','text');change('type.size',20);await pause();route('theme','changes');
 click('history-undo');await pause();check('differences page refreshes',!panel.querySelector('[data-setting="type.size"]')||panel.textContent.includes(String(s.type.size)));
 route('text','text');unmountPanel(other);second.remove();
 const chat=document.querySelector('#chat');chat.innerHTML=Array.from({length:1000},(_,i)=>`<div class="mes" is_user="false"><div class="mes_block"><div class="mes_text"><p>검사 ${i} — ${'대화 내용과 글자 크기를 확인하는 합성 문장입니다. '.repeat(12)}</p></div></div></div>`).join('');
 for(let i=0;i<8;i++){
  change('type.size',16+i%2);await pause();void chat.offsetHeight;
  const t=performance.now();click('history-undo');const handler=performance.now()-t;void chat.offsetHeight;
  times.push({handlerMs:+handler.toFixed(2),withLayoutMs:+(performance.now()-t).toFixed(2)});await pause();
 }
 const {classifyAll}=await import(new URL('src/assets.js',runtime));
 const image=new Image(),box=document.createElement('div'),callbacks=new Set();image.className='eh-img';box.className='mes_text';box.append(image);document.body.append(box);
 const nativeAdd=image.addEventListener;image.addEventListener=function(type,fn,opts){if(type==='load')callbacks.add(fn);return nativeAdd.call(this,type,fn,opts)};
 Object.defineProperty(image,'complete',{configurable:true,value:false});
 image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#5ac"/></svg>');
 for(let i=0;i<100;i++)classifyAll(box);
 check('100 scans share one pending image load callback',callbacks.size===1,{callbacks:callbacks.size});
 delete image.complete;await image.decode();await pause();check('pending image still classified after load',image.classList.contains('salty-asset'));box.remove();
 check('no runtime errors',errors.length===0,errors);
 document.querySelector('#results').textContent=JSON.stringify({total:checks.length,passed:checks.filter(c=>c.pass).length,width:innerWidth,times,checks},null,2);
 document.querySelector('#progress').textContent='완료';
};
