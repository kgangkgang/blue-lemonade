// 복원한 선택 상태를 화면 검사·사진 비교·행렬에서 같은 식으로 열어요.
// 11-03 재정비 A(살아 있는 입구): settings · frame-library · palettes · settings-editor 는 src/ 직접 import(묶음 판에서 두 번째 인스턴스) 대신 globalThis.__blLive(lib/live-entry.mjs — boot · matrix ensureExpr 가 심어요)로 받아요.
//   1.0.0 묶음(Salty.module 없음)에서도 설정은 Salty.getSettings 위 facade, frame-library · palettes 는 상태 없는 자료 모듈이라 허용, 묶음 고르기는 칩 단추 실제 클릭이라 34화면이 다 열려요.
//   여는 식은 맨 앞에 프렐류드 사본을 품어 boot · matrix 를 안 거치는 쪽(사이트 촬영)이 그대로 평가해도 돼요.
import { LIVE_PRELUDE } from './live-entry.mjs';
export const FRAME_STYLE_CASES=[['vintage','빈티지'],['lovely','러블리'],['playful','플레이풀'],['graphic','그래픽']];
export const FRAME_CONCEPT_CASES=[['watercolor','물든 수채화'],['browser','작은 작업창'],['scrapbook','기억 스크랩'],['ribbon','리본 레터'],['pop','겹친 메모지'],['notebook','낙서 노트']];
export const APPEARANCE_STATES=[
 {id:'appearance-message-bubbles',name:'설정 · 메시지 · 문단 말풍선',tab:'chat',sub:'message',values:{'chat.user':'bubble','chat.char':'bubble','chat.bubbleSplit':'para'},selector:'[data-path="chat.bubbleSplit"]'},
 {id:'appearance-profile-banner',name:'설정 · 프로필 · 캐릭터 큰 사진',tab:'chat',sub:'profile',values:{'profile.mode':'banner','profile.sizing':'pixels','profile.height':180},selector:'[data-range="profile.height"]'},
 {id:'appearance-user-banner',name:'설정 · 프로필 · 내 큰 사진',tab:'chat',sub:'user-profile',values:{'userProfile.mode':'banner','userProfile.sizing':'pixels','userProfile.height':180},selector:'[data-range="userProfile.height"]'},
 {id:'appearance-custom-mask',name:'설정 · 이미지 · 커스텀 모양',tab:'image',sub:'shape',values:{'image.shape':'custom'},sample:'mask',selector:'[data-act="mask-upload"],input[type="file"][data-mask-file],.salty-mask-thumb'},
 {id:'appearance-image-fade',name:'설정 · 이미지 · 가장자리 흐림',tab:'image',sub:'shape',values:{'image.fade':'medium','image.fadeY':14,'image.fadeX':12},selector:'[data-range="image.fadeX"]'},
 {id:'appearance-palette-mix',name:'설정 · 색 · 에이드 혼합',tab:'theme',sub:'palette',values:{},sample:'mix',selector:'.bl-mix-swatches button'},
 {id:'appearance-text-gradient',name:'설정 · 글자 · 그라데이션',tab:'text',sub:'ui',values:{},sample:'gradient',selector:'[data-gradient-color="ui"]'},
 {id:'appearance-phone-controls',name:'설정 · 화면 · 몰입 읽기와 한 손 줄',tab:'chat',sub:'screen',values:{'reader.autoHide':true,'onehand.on':true},selector:'[data-path="onehand.swipe"]'},
 ...FRAME_STYLE_CASES.flatMap(([style,label])=>FRAME_CONCEPT_CASES.map(([id,name])=>({id:'appearance-frame-'+style+'-'+id,name:'설정 · 장식 액자 · '+label+' · '+name,tab:'image',sub:'frame',values:{},sample:'decor',frame:{id,style},selector:'[data-range="image.decor.opacity"]'}))),
 {id:'appearance-device-layout',name:'설정 · 문단 · 기기별 배치',tab:'text',sub:'para',values:{'deviceLayouts.on':true},selector:'[data-toggle="deviceLayouts.on"]'},
];
export const APPEARANCE_CLOSE=`(async()=>{await globalThis.__blAppearanceUndo?.();document.querySelector('dialog[open] [data-act="panel-close"]')?.click();return true})()`;
export function appearancePaletteMode(module, palette) {
 const mode=typeof module.paletteMode==='function'?module.paletteMode(palette):module.PALETTES?.[palette]?.mode;
 if(mode!=='dark'&&mode!=='light')throw Error('팔레트의 밤·낮 구분을 확인하지 못했어요');
 return mode;
}
export function appearanceRoute(state, routes) {
 if(state.id==='appearance-image-fade'&&routes.includes('image/fade'))return {tab:'image',sub:'fade'};
 return {tab:state.tab,sub:state.sub};
}
export function appearanceOpen(state){
 return `(async()=>{${LIVE_PRELUDE}
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 await globalThis.__blAppearanceUndo?.();
 const m=await globalThis.__blLive.settings(),ctx=SillyTavern.getContext(),s=m.getSettings(),before=structuredClone(s);
 let done=false,dialog=null,supportsFrameStyles=false;const cleanups=[];
 const undo=async()=>{if(done)return;done=true;for(const cleanup of cleanups)cleanup();delete globalThis.__blAppearanceFrameProbe;dialog?.removeEventListener('close',undo);ctx.extensionSettings.salty=before;m.invalidateSettings();Salty.applyAll();Salty.refreshPanels();globalThis.__blFixtureUndo=(globalThis.__blFixtureUndo||[]).filter(f=>f!==undo);if(globalThis.__blAppearanceUndo===undo)delete globalThis.__blAppearanceUndo;};
 globalThis.__blAppearanceUndo=undo;(globalThis.__blFixtureUndo||=[]).push(undo);
 try{
 const values=${JSON.stringify(state.values)};
 for(const [key,value]of Object.entries(values)){const parts=key.split('.'),last=parts.pop();let at=s;for(const part of parts)at=at[part]??={};at[last]=structuredClone(value);}
 ${state.sample==='mask'?`const c=document.createElement('canvas');c.width=c.height=48;const g=c.getContext('2d');g.fillStyle='#fff';g.beginPath();g.arc(24,24,22,0,Math.PI*2);g.fill();s.image.mask=c.toDataURL('image/png');s.image.maskFit='contain';`:''}
 ${state.sample==='decor'?`const f=await globalThis.__blLive.module('frame-library');supportsFrameStyles=Array.isArray(f.FRAME_STYLES);if(!supportsFrameStyles&&${JSON.stringify(state.frame?.style||'vintage')}!=='vintage'){await undo();return '없는 화면: 이 판에는 액자 스타일 분류가 없어요';}const want=${JSON.stringify(state.frame||{id:'ribbon',style:'vintage'})};if(!f.FRAME_PRESETS.some(x=>x[0]===want.id)){await undo();return '없는 화면: 이 판에는 이 액자 콘셉트가 없어요';}s.image.decor=f.presetFrame(want.id,supportsFrameStyles?{presetStyle:want.style}:{});s.image.decor.on=true;`:''}
 ${state.sample==='mix'?`const p=await globalThis.__blLive.module('palettes'),key=(${appearancePaletteMode.toString()})(p,s.palette)==='dark'?'dark':'light';s.gradients[key].on=true;s.gradients[key].families=['blue','melon'];`:''}
 ${state.sample==='gradient'?`(s.gradients.overrides[s.palette]||={}).ui={mode:'gradient',colors:['#91cfff','#d9f99d'],angle:90,weights:[50,50,50]};`:''}
 m.invalidateSettings();Salty.applyAll();Salty.refreshPanels();
 let panel=document.querySelector('dialog[open] .salty-panel');
 if(!panel){Salty.openPopup();for(let i=0;i<60&&!panel;i++){await wait(100);panel=document.querySelector('dialog[open] .salty-panel');}}
 if(!panel)throw Error('테마 설정 창을 열지 못했어요');
 dialog=panel.closest('dialog');dialog.addEventListener('close',undo,{once:true});
 const route=(${appearanceRoute.toString()})(${JSON.stringify({id:state.id,tab:state.tab,sub:state.sub})},[...panel.querySelectorAll('[data-act="editor-route"]')].map(e=>e.dataset.tab+'/'+e.dataset.sub));
 const b=document.createElement('button');b.hidden=true;Object.assign(b.dataset,{act:'editor-route',...route});panel.append(b);b.click();b.remove();
 await wait(650);for(const d of panel.querySelectorAll('details.bl-advanced'))d.open=true;
 const control=panel.querySelector(${JSON.stringify(state.selector)});if(control){await globalThis.__blLive.selectGroup(panel,control.closest('.bl-editor-group'));for(const d of panel.querySelectorAll('details.bl-advanced'))d.open=true;}if(!control||!control.getClientRects().length)throw Error('복원된 조절부가 보이지 않아요: ${state.id}');
 ${state.frame?frameProbe(state):''}
 const scroll=panel.querySelector('.salty-sec');if(scroll)scroll.scrollTop=0;return true;
 }catch(error){await undo();throw error;}
 })()`;
}
export const APPEARANCE_SCREENS=Object.fromEntries(APPEARANCE_STATES.map(s=>[s.id,{name:s.name,group:'settings',root:'dialog[open] .salty-panel .salty-sec',open:appearanceOpen(s),pages:2}]));

function frameProbe(state){return `if(supportsFrameStyles){
 const f=await globalThis.__blLive.module('frame-library');
 let image=panel.querySelector('.salty-preview img.custom-cac-img');
 if(!image)throw Error('액자 자동 비율 검사 사진이 없어요');
 const original=image.src,design=structuredClone(s.image.decor),sample=new Image();cleanups.push(()=>{if(image.isConnected)image.src=original;});sample.src=original;await sample.decode();
 const cases=[[180,240,'#ff0000','#00ff00'],[240,180,'#ffffff','#000000'],[220,220,'#000000','#ffffff']],measure=[];
 for(const [w,h,color,accent]of cases){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');const scale=Math.max(w/sample.naturalWidth,h/sample.naturalHeight);g.drawImage(sample,(w-sample.naturalWidth*scale)/2,(h-sample.naturalHeight*scale)/2,sample.naturalWidth*scale,sample.naturalHeight*scale);
  s.image.decor.presetColor=color;s.image.decor.presetAccent=accent;f.refreshPreset(s.image.decor);m.invalidateSettings();Salty.applyAll();
  image.src=c.toDataURL('image/png');await image.decode();const ratio=(w/h).toFixed(4),colors=color+'/'+accent;
  let host;for(let i=0;i<40;i++){host=image.closest('.bl-art-frame');if(host?.dataset.blFrameImageRatio===ratio&&host?.dataset.blFrameColors===colors)break;await wait(50);}
  if(!host||host.dataset.blFrameImageRatio!==ratio||host.dataset.blFrameColors!==colors)throw Error('사진 비율 또는 색이 액자에 자동 적용되지 않았어요');
  const r=host.getBoundingClientRect();if(!(r.width>0&&r.height>0))throw Error('자동 비율 액자 크기가 비었어요');
  measure.push({naturalRatio:w/h,frameRatio:parseFloat(getComputedStyle(host).getPropertyValue('--bl-decor-ratio')),colors});
 }
 if(new Set(measure.map(x=>x.frameRatio.toFixed(3))).size!==3)throw Error('액자가 세 가지 자연 비율을 구분하지 못해요');
 s.image.decor=design;image.src=original;m.invalidateSettings();Salty.applyAll();Salty.refreshPanels();await wait(250);
 globalThis.__blAppearanceFrameProbe=measure;
 }`;}
