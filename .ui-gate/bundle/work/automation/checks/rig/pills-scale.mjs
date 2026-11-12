// 메뉴 크기에 비례하는 판 알약을 두 글꼴·네 크기·두 팔레트에서 실제로 재요.
import {ev,call,boot,phoneAt,palette,sleep,userFonts,rpc,O,fail,emit,hidePanels} from './lib.mjs';
await boot();await userFonts();await phoneAt(320,800,2);await hidePanels();
const original=await ev('JSON.stringify({type:settingsModule.getSettings().type,fonts:settingsModule.getSettings().fonts,palette:settingsModule.getSettings().palette})');
const rows=[];
function measure(){
  const sel='#rm_extensions_block .inline-drawer-header .ext-version, #rm_extensions_block .inline-drawer-header [class*="-version"], #rm_extensions_block .inline-drawer-header .salty-ver, #rm_extensions_block .inline-drawer-header [data-bl-version]';
  const out=[];
  for(const p of document.querySelectorAll(sel)){
    if(!p.getClientRects().length)continue;const cs=getComputedStyle(p),after=getComputedStyle(p,'::after');const pseudo=p.hasAttribute('data-bl-version')&&!['none','normal',''].includes(after.content);const src=pseudo?after:cs;
    const r=p.getBoundingClientRect(),head=p.closest('.inline-drawer-header'),title=head?.querySelector('b,strong,.bl-addon-title');let tr=null;
    if(title&&!pseudo){const walker=document.createTreeWalker(title,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;if(!n.textContent.trim()||p.contains(n))continue;const range=document.createRange();range.selectNodeContents(n);tr=[...range.getClientRects()].find(x=>x.width>0&&x.height>0&&x.left<r.left);if(tr)break;}}
    const textBox=()=>{const range=document.createRange();range.selectNodeContents(p);return[...range.getClientRects()].filter(x=>x.width>0&&x.height>0).some(x=>x.left<r.left-.5||x.right>r.right+.5||x.top<r.top-.5||x.bottom>r.bottom+.5);};
    out.push({name:(head?.textContent||'').replace(/\s+/g,' ').trim().slice(0,25),cls:p.className,pseudo,fs:parseFloat(src.fontSize),h:pseudo?parseFloat(src.height):r.height,pad:parseFloat(src.paddingRight),radius:parseFloat(src.borderTopLeftRadius),border:parseFloat(src.borderTopWidth),family:src.fontFamily,parentFamily:getComputedStyle(pseudo?p:p.parentElement).fontFamily,dy:tr?(r.top+r.height/2)-(tr.top+tr.height/2):null,clipped:!pseudo&&textBox(),outside:r.left<-.5||r.right>innerWidth+.5});
  }
  return out;
}
try{
  for(const font of ['freesentation','galmurimono11'])for(const size of [14,15,18,22])for(const pal of ['salt','night']){
    await ev(`(()=>{const s=settingsModule.getSettings();s.type.uiSize=${size};s.fonts.ui={ko:${JSON.stringify(font)},en:'auto',ja:'auto',zh:'auto'};Salty.applyAll();return true})()`);
    await palette(pal);await sleep(700);await ev('document.fonts.ready.then(()=>true)');
    await ev(`(()=>{const d=document.getElementById('rm_extensions_block');if(!d.classList.contains('openDrawer'))document.querySelector('#extensions-settings-button .drawer-toggle').click();document.querySelector('#rm_extensions_block').scrollTop=0;return true})()`);await sleep(500);
    const pills=await call(measure);const expected={fs:size*12/15,h:size*20/15,pad:size*8/15,radius:size*10/15};const errors=[];
    if(!pills.length)errors.push('알약을 찾지 못했어요');
    for(const p of pills){for(const k of ['fs','h','pad','radius'])if(!Number.isFinite(p[k])||Math.abs(p[k]-expected[k])>.12)errors.push(`${p.name} ${k} ${p[k]} / ${expected[k]}`);if(p.border!==1||p.family!==p.parentFamily||p.clipped||p.outside||(p.dy!==null&&Math.abs(p.dy)>1))errors.push(`${p.name} 선/글꼴/잘림/정렬 ${JSON.stringify(p)}`);}
    const shot=`${O}/shots/pill-${font}-${size}-${pal}.png`;await rpc('shot',{path:shot});rows.push({font,size,pal,expected,pills,errors,shot});
    for(const message of errors)fail(`pillscale|${font}|${size}|${pal}|${message.split(' ')[0]}`,message,{crop:shot});
    console.log(`${font} ${size}px ${pal}: ${pills.length}개 · 오류 ${errors.length}`);
  }
}finally{await ev(`(()=>{const s=settingsModule.getSettings(),old=${original};s.type=old.type;s.fonts=old.fonts;s.palette=old.palette;Salty.applyAll();return true})()`);}
emit({check:'pills',total:rows.reduce((n,r)=>n+r.pills.length,0),info:{rows}});
