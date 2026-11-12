// 한글화 패널의 위·가운데·아래 줄과 실제 단추 사이를 재요. 자료 적용·번역은 누르지 않아요.
import {ev,call,boot,phoneAt,palette,sleep,rpc,O,fail,emit} from './lib.mjs';
await boot();
const rows=[];
function measure(){
  const page=document.querySelector('#pt-page-wi');
  const row=page?.querySelector('.pt-toolbar'),group=row?.querySelector('.pt-export-group');
  const elements=[row?.querySelector('.pt-combo'),document.querySelector('#pt-wi-load'),document.querySelector('#pt-wi-apply'),group?.querySelector('summary')];
  const rects=elements.map(e=>{if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,margin:[s.marginTop,s.marginRight,s.marginBottom,s.marginLeft]};});
  const gaps=rects.slice(1).map((b,i)=>{const a=rects[i];return a&&b&&Math.abs(a.y+a.h/2-b.y-b.h/2)<2?b.x-a.right:null;});
  const cssGaps=[document.querySelector('#pt-tabs'),row,group,page?.querySelector('.pt-act-row')].map(e=>e?getComputedStyle(e).columnGap:null);
  const clipped=[];
  for(const e of elements.slice(1,3).filter(Boolean)){
    const box=e.getBoundingClientRect(),walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){const n=walker.currentNode;if(!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1)clipped.push(e.id);}
  }
  return{rects,gaps,cssGaps,clipped,viewport:innerWidth};
}
for(const width of [320,384,430,1280])for(const pal of ['salt','night']){
  await phoneAt(width,width===1280?820:800,width===384?3.75:width===320?2:width===430?3:1);
  await palette(pal);
  await ev(`(async()=>{const m=await globalThis.__blLive.addon('prompt');await m.ready;m.openPanel();await new Promise(r=>setTimeout(r,800));document.querySelector('#pt-tabs [data-tab="wi"]').click();
      for(let i=0;i<60&&!document.querySelector('#pt-wi-sel option[value="fixture-world"]');i++)await new Promise(r=>setTimeout(r,100));
      const sel=document.querySelector('#pt-wi-sel'),option=[...sel.options].find(o=>o.value==='fixture-world');if(!option)throw Error('합성 월드인포가 없어요');sel.value=option.value;sel.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#pt-wi-cinput').value=option.textContent;document.querySelector('#pt-wi-load').click();
      for(let i=0;i<80&&!document.querySelector('#pt-wi-list .pt-block-header');i++)await new Promise(r=>setTimeout(r,100));if(!document.querySelector('#pt-wi-list .pt-block-header'))throw Error('합성 월드인포를 불러오지 못했어요');
      for(const e of document.querySelectorAll('#toast-container .toast:not(.toast-error)'))e.remove();return true})()`);
  await sleep(500);const result=await call(measure);rows.push({width,pal,...result});
  const bad=!result.rects.every(Boolean)||result.cssGaps.some(g=>!Number.isFinite(parseFloat(g))||Math.abs(parseFloat(g)-8)>.1)||result.gaps.some(g=>g!==null&&Math.abs(g-8)>.5)||result.rects.some(r=>r&&(r.x<-.5||r.right>result.viewport+.5))||result.clipped.length;
  const shot=`${O}/shots/pt-toolbar-${width}-${pal}.png`;await rpc('shot',{path:shot});
  if(bad)fail(`pt-toolbar-gap|${width}|${pal}`,`한글화 도구줄 간격·잘림을 확인해 주세요: ${JSON.stringify(result)}`,{crop:shot});
  console.log(`${width} ${pal}: 간격 ${result.gaps.join('/')} · CSS ${result.cssGaps.join('/')} · 잘림 ${result.clipped.length}`);
}
emit({check:'pt-toolbar-gap',total:rows.length,info:{rows}});
