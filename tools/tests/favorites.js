// Synthetic data only. Seed the removed routes to exercise an existing 3.9.4 installation.
const runtime=new URL(new URLSearchParams(location.search).has('dev')?'../../salty-ext/':'../../',import.meta.url);
const previous=new URLSearchParams(location.search).get('previous')==='regex'?'regex':'problems';
localStorage.setItem('salty_tab',previous==='regex'?'prompt':'theme');
localStorage.setItem('salty_subs',JSON.stringify({theme:'problems',prompt:'regex'}));
localStorage.setItem('salty_favorites',JSON.stringify([{tab:'theme',sub:'problems',title:'문제 기록'},{tab:'prompt',sub:'regex',title:'정규식 비교'},{tab:'chat',sub:'screen',title:'퀵 리플라이 · QR',anchor:'퀵 리플라이'}]));
const ctx={extensionSettings:{},powerUserSettings:{},saveSettingsDebounced(){},getRequestHeaders:()=>({})};window.SillyTavern={getContext:()=>ctx};
const errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('style.css',runtime);document.head.append(css);await new Promise(r=>css.onload=r);
const {getSettings}=await import(new URL('src/settings.js',runtime));const {applyAll}=await import(new URL('src/apply.js',runtime));
const {mountPanel,unmountPanel}=await import(new URL('src/panel.js',runtime));const {readFavorites,toggleFavorite}=await import(new URL('src/settings-favorites.js',runtime));
const {SEARCH_ENTRIES,searchSettings}=await import(new URL('src/settings-search.js',runtime));
getSettings().profile.original=false;getSettings().userProfile.original=false;applyAll();let panel=mountPanel(document.querySelector('#panel'));
const pause=()=>new Promise(r=>setTimeout(r,40));document.querySelector('#progress').textContent='준비 완료';
document.querySelector('#run').onclick=async()=>{
 const checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
 try{
 check('old last-view route falls back to a theme section',panel.querySelector('.salty-sec').dataset.sub===(previous==='regex'?'deus':'palette'));
 check('removed tools absent from catalogue',!panel.querySelector('[data-sub="problems"],[data-sub="regex"]'));
 check('removed tools absent from search index',!SEARCH_ENTRIES.some(e=>e.sub==='problems'||e.sub==='regex'));
 check('removed favorites filtered without losing QR anchor',readFavorites().length===1&&readFavorites()[0].anchor==='퀵 리플라이');
 check('removed tool cannot be pinned again',toggleFavorite({tab:'theme',sub:'problems',title:'문제 기록'})===false&&readFavorites().length===1);
 panel.querySelector('[data-act="editor-catalog"]').click();await pause();
 const pin=panel.querySelector('.bl-favorites header [data-favorite]');
 check('star uses exact native character-favorite icon',pin.querySelector('i')?.className===document.querySelector('#native-star').className&&!pin.querySelector('svg')&&!/[★☆]/.test(pin.textContent));
 const actual=getComputedStyle(pin.querySelector('i'),'::before'),native=getComputedStyle(document.querySelector('#native-star'),'::before');
 check('same rendered glyph and font as native star',actual.content===native.content&&actual.fontFamily===native.fontFamily&&actual.content!=='none');
 check('compact icon retains touch target',parseFloat(getComputedStyle(pin.querySelector('i')).fontSize)===17&&pin.getBoundingClientRect().height>=40);
 pin.click();check('pin still stores setting',readFavorites().length===2);
 const input=panel.querySelector('[data-settings-search]');input.value='QR 편집';input.dispatchEvent(new Event('input',{bubbles:true}));await pause();
 check('QR search still routes correctly',searchSettings('QR 편집')[0]?.anchor==='퀵 리플라이');
 check('search star fits the result',panel.querySelector('.bl-search-results').scrollWidth<=panel.querySelector('.bl-search-results').clientWidth+1);
 panel.querySelector('[data-settings-clear]').click();panel.querySelector('[data-favorite-jump]').click();await pause();
 check('favorite opens exact QR group',panel.querySelector('.salty-sec').dataset.sub==='screen'&&panel.querySelector('.bl-search-target')?.textContent.includes('퀵 리플라이'));
 unmountPanel(panel);panel=mountPanel(document.querySelector('#panel'));check('favorites persist after reopening',panel.querySelectorAll('[data-favorite-jump]').length===2);
 check('no remaining diagnostic roots',!panel.querySelector('[data-settings-tool]')&&!('_toolIO' in panel));
 check('no diagnostic modules requested',!performance.getEntriesByType('resource').some(e=>/\/src\/(settings-tools|diagnostics-host|regex-compare)/.test(e.name)));
 check('no runtime errors',errors.length===0,errors);
 }catch(error){check('unexpected test error',false,error.stack);}
 document.querySelector('#results').textContent=JSON.stringify({total:checks.length,passed:checks.filter(c=>c.pass).length,width:innerWidth,previous,checks},null,2);document.querySelector('#progress').textContent='완료';
};
