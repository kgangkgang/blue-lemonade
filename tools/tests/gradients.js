const runtime=new URL(new URLSearchParams(location.search).has('dev')?'../../salty-ext/':'../../',import.meta.url);
localStorage.setItem('salty_tab','theme');localStorage.setItem('salty_subs',JSON.stringify({theme:'palette'}));
const ctx={extensionSettings:{},powerUserSettings:{},saveSettingsDebounced(){},getRequestHeaders:()=>({})};
window.SillyTavern={getContext:()=>ctx};
const errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('style.css',runtime);document.head.append(css);await new Promise(r=>css.onload=r);
const {getSettings}=await import(new URL('src/settings.js',runtime));
const {applyAll}=await import(new URL('src/apply.js',runtime));
const {mountPanel}=await import(new URL('src/panel.js',runtime));
const {gradientCss,gradientFor,gradientStops,tidyGradients}=await import(new URL('src/gradients.js',runtime));
const {PALETTE_FAMILIES,PALETTES,paletteVariant}=await import(new URL('src/palettes.js',runtime));
const {captureStyle,applyStyleData}=await import(new URL('src/styles.js',runtime));
const {searchSettings}=await import(new URL('src/settings-search.js',runtime));
const s=getSettings();s.profile.original=s.userProfile.original=false;
document.querySelector('#chat').innerHTML=`<div class="mes" is_user="false"><div class="mes_block"><div class="ch_name"><span class="name_text">레몬</span><span class="timestamp">오늘</span></div><div class="mes_text"><p>단색 본문 <q>그라데이션 형광펜과 대사</q> <em>속마음</em> <strong>강조</strong> <code>code</code></p></div></div></div><div class="mes" is_user="true"><div class="mes_block"><div class="ch_name"><span class="name_text">나</span></div><div class="mes_text"><p>내 말풍선도 함께 바뀌어요.</p></div></div></div>`;
applyAll();const panel=mountPanel(document.querySelector('#panel'));
const pause=()=>new Promise(r=>setTimeout(r,25));
const click=selector=>{const el=panel.querySelector(selector);if(!el)throw new Error('missing '+selector);el.click();};
const route=(tab,sub)=>click(`[data-act="editor-route"][data-tab="${tab}"][data-sub="${sub}"]`);
const change=(path,value)=>{const el=panel.querySelector(`[data-num="${path}"]`);if(!el)throw new Error('missing input '+path);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
const style=selector=>getComputedStyle(document.querySelector(selector));
document.querySelector('#progress').textContent='준비 완료';
document.querySelector('#run').onclick=async()=>{
 const checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail?{detail}:{})});
 try {
  const plain=style('body').backgroundImage,text=style('#chat p').color;
  check('mix defaults off',!s.gradients.light.on);click('[data-act="mix-toggle"]');await pause();
  check('toggle activates whole-theme surface',s.gradients.light.on&&style('body').backgroundImage.includes('linear-gradient'));
  check('global blend leaves text solid',style('#chat p').color===text&&style('#chat p').webkitTextFillColor!=='rgba(0, 0, 0, 0)');
  check('two colors selected',panel.querySelectorAll('[data-act="mix-family"][aria-pressed="true"]').length===2);
  click('[data-act="mix-family"][data-family="melon"]');await pause();check('third color available',s.gradients.light.families.length===3);
  check('fourth color blocked',panel.querySelector('[data-act="mix-family"][data-family="wood"]').disabled);
  change('gradients.light.angle',275);await pause();check('angle applies',style('body').backgroundImage.includes('275deg'));
  const before=style('body').backgroundImage;change('gradients.light.weights.0',95);await pause();check('weight changes paint distribution',style('body').backgroundImage!==before);
  click('[data-act="history-undo"]');await pause();check('weight undo',s.gradients.light.weights[0]===50);click('[data-act="history-redo"]');await pause();check('weight redo',s.gradients.light.weights[0]===95);
  const lightSnapshot=JSON.stringify(s.gradients.light);
  s.palette=paletteVariant('blue','dark');applyAll();route('theme','palette');
  check('night starts solid independently',!s.gradients.dark.on&&!style('body').backgroundImage.includes('linear-gradient'));
  click('[data-act="mix-toggle"]');change('gradients.dark.angle',35);change('gradients.dark.weights.0',20);
  click('[data-act="mix-family"][data-family="wood"]');await pause();
  check('night has its own controls',s.gradients.dark.angle===35&&s.gradients.dark.weights[0]===20&&s.gradients.dark.families.includes('wood'));
  check('night edits preserve light settings',JSON.stringify(s.gradients.light)===lightSnapshot);
  click('[data-act="history-undo"]');await pause();check('night undo stays in night',!s.gradients.dark.families.includes('wood')&&JSON.stringify(s.gradients.light)===lightSnapshot);
  click('[data-act="history-redo"]');await pause();check('night redo preserves light',s.gradients.dark.families.includes('wood')&&JSON.stringify(s.gradients.light)===lightSnapshot);
  s.palette='salt';applyAll();check('switching to light restores its direction',style('body').backgroundImage.includes('275deg'));
  for(const mode of ['light','dark'])for(const f of Object.keys(PALETTE_FAMILIES).filter(k=>k!=='custom')) {
    s.palette=paletteVariant(f,mode);applyAll();check(`${f}/${mode} valid surface`,style('body').backgroundImage.includes('linear-gradient'));
  }
  s.palette='salt';applyAll();route('text','em');click('[data-act="gradient-mode"][data-key="em"][data-mode="gradient"]');await pause();
  check('thought gradient independent',style('#chat em').backgroundImage.includes('linear-gradient')&&style('#chat em').webkitTextFillColor==='rgba(0, 0, 0, 0)');
  const picker=panel.querySelector('[data-gradient-color="em"]');picker.dispatchEvent(new Event('pointerdown',{bubbles:true}));picker.dispatchEvent(new CustomEvent('change',{detail:{rgba:'rgba(240,20,160,1)'}}));await pause();check('color picker updates gradient',gradientFor(s,'em').colors[0].includes('240'));
  click('[data-act="gradient-count"][data-key="em"]');check('individual maximum three colors',gradientFor(s,'em').colors.length===3);
  route('text','dialogue');click('[data-act="gradient-mode"][data-key="dialogue"][data-mode="gradient"]');
  for(const shape of ['stroke','rectangle','pill'])for(const mode of ['marker','full','plain','bold','tint']) {
    s.dialogue.markerShape=shape;s.dialogue.style=mode;applyAll();
    check(`${shape}/${mode} text gradient valid`,style('#chat q').backgroundImage!=='none');
  }
  s.dialogue.style='marker';
  for(const key of ['text','strong','muted','faint','name','userName','code','ui'])s.gradients.overrides.salt[key]={mode:'gradient',colors:['#a62f77','#155a91','#426d21'],weights:[60,30,10],angle:45};
  s.gradients.overrides.salt.gold={mode:'gradient',colors:['#ffdb72','#ceefff'],weights:[50,50,50],angle:90};applyAll();
  check('combined text and marker keeps layers',style('#chat q').backgroundImage.includes('url(')&&style('#chat q').backgroundClip.includes('text'));
  check('strong text and marker keeps separate clips',style('#chat strong').backgroundClip.includes('text, border-box'));
  check('code gradient preserves fill',style('#chat code').backgroundImage.includes('linear-gradient'));
  check('both name gradients applied',style('#chat .mes[is_user="true"] .name_text').backgroundImage.includes('linear-gradient')&&style('#chat .mes[is_user="false"] .name_text').backgroundImage.includes('linear-gradient'));
  const captured=captureStyle(s),snapshot=JSON.stringify(s.gradients);s.gradients=tidyGradients({});applyStyleData(s,JSON.parse(JSON.stringify(captured)));check('style roundtrip keeps gradients',JSON.stringify(s.gradients)===snapshot);
  const saved=JSON.stringify(s);ctx.extensionSettings.salty=JSON.parse(saved);const reloaded=getSettings();check('settings reload keeps gradients',JSON.stringify(reloaded.gradients)===JSON.stringify(tidyGradients(s.gradients)));ctx.extensionSettings.salty=s;
  s.gradients.overrides.salt={bg:{mode:'solid',colors:['#111','#222'],weights:[50,50,50],angle:90}};applyAll();check('surface can opt out of global mix',style('body').backgroundImage===plain);
  s.gradients=tidyGradients({});applyAll();check('disable removes transparent text and fill',style('body').backgroundImage===plain&&style('#chat em').webkitTextFillColor!=='rgba(0, 0, 0, 0)');
  check('natural language search routes blend',searchSettings('에이드 섞기 방향').some(x=>x.tab==='theme'&&x.sub==='palette'));
  route('theme','palette');check('mobile controls fit',panel.scrollWidth<=panel.clientWidth+1);
  const initial=document.querySelector('#chat').innerHTML;s.gradients.light.on=true;const start=performance.now();for(let i=0;i<30;i++){s.gradients.light.angle=i*12;applyAll();}const ms=(performance.now()-start)/30;
  check('changing gradients adds no chat DOM',document.querySelector('#chat').innerHTML===initial);check('no runtime errors',errors.length===0,errors);
  document.querySelector('#results').textContent=JSON.stringify({total:checks.length,passed:checks.filter(x=>x.pass).length,width:innerWidth,applyAverageMs:ms,checks,errors},null,2);
 }catch(e){document.querySelector('#results').textContent=JSON.stringify({total:checks.length+1,passed:checks.filter(x=>x.pass).length,checks,exception:e.stack,errors},null,2);}
};
