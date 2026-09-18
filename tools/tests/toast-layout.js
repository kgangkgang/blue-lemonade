const runtime=new URL(new URLSearchParams(location.search).has('dev')?'../../salty-ext/':'../../',import.meta.url);
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('style.css',runtime);document.head.append(css);await new Promise(r=>css.onload=r);
const ctx={extensionSettings:{},powerUserSettings:{},saveSettingsDebounced(){},getRequestHeaders:()=>({})};window.SillyTavern={getContext:()=>ctx};
const {getSettings}=await import(new URL('src/settings.js',runtime));const {applyAll}=await import(new URL('src/apply.js',runtime));const s=getSettings();s.profile.original=false;applyAll();
const options={closeButton:false,timeOut:0,extendedTimeOut:0,showDuration:0,hideDuration:0,tapToDismiss:true,positionClass:'toast-top-center',escapeHtml:false};
const {mountPanel,refreshPanels}=await import(new URL('src/panel.js',runtime));
const holder=document.createElement('div');document.body.append(holder);const panel=mountPanel(holder);
toastr.options.showDuration=0;toastr.options.hideDuration=0;
const text='테마 색: <b>블루 레몬에이드 · 나이트 → 블루 레몬에이드 · 화이트</b>';
const show=()=>toastr.info(text,'되돌렸어요',options)[0];
document.querySelector('#show').onclick=()=>{toastr.remove();show()};document.querySelector('#results').textContent='준비 완료';
document.querySelector('#run').onclick=async()=>{
 const checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail}),pause=ms=>new Promise(r=>setTimeout(r,ms));
 for(const palette of ['salt','night']){
  s.palette=palette;applyAll();refreshPanels();toastr.remove();
  const tint=palette==='night'?'nightTint':'lightTint';
  const field=panel.querySelector('[data-num="'+tint+'"]');field.value=String(s[tint]+1);field.dispatchEvent(new Event('change',{bubbles:true}));
  panel.querySelector('[data-act="history-undo"]').click();await pause(60);
  const first=document.querySelector('#toast-container>.toast');
  panel.querySelector('[data-act="history-redo"]').click();await pause(60);
  check(palette+' real undo and redo notices',document.querySelectorAll('#toast-container>.toast').length===2&&first.querySelector('.toast-title').textContent==='되돌렸어요');
  for(const [i,toast]of [...document.querySelectorAll('#toast-container>.toast')].entries()){
   const box=toast.getBoundingClientRect(),title=toast.querySelector('.toast-title').getBoundingClientRect();
   check(palette+'/'+i+' no close icon',!toast.querySelector('.toast-close-button'));
   check(palette+'/'+i+' title has no empty row',title.top-box.top<20);
   check(palette+'/'+i+' toast fits viewport',box.left>=0&&box.right<=innerWidth+1);

  }
  first.querySelector('.toast-message').click();await pause(60);check(palette+' tapping text removes only its own toast',!first.isConnected&&document.querySelectorAll('#toast-container>.toast').length===1);
  toastr.remove();toastr.info('자동으로 닫는 알림','알림',{...options,timeOut:100});await pause(300);check(palette+' timed notification still closes',!document.querySelector('#toast-container>.toast'));
 }
 document.querySelector('#results').textContent=JSON.stringify({total:checks.length,passed:checks.filter(x=>x.pass).length,width:innerWidth,checks},null,2);
};
