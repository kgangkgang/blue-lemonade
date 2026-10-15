import {themeEnabled} from './usage-mode.js';
import {getSettings,saveSettings} from './settings.js';
import {allFonts,findFont,fontStack,loadFont} from './fonts.js';
import {FRUIT_TYPES,FRUIT_UNSUPPORTED,REGION_DEFAULT,tidyFruitType,fruitTypeCss,typeOwner,ownerEnabled,layoutChoices} from './fruit-type-schema.js';
import {fruitTypePreview,FRUIT_PREVIEW_BASE} from './fruit-type-preview.js';
import {syncFruitTypography} from './fruit-type-runtime.js';
import {bindTouchSliders} from './touch-sliders.js';
import {bindPreviewViews} from './preview-view.js';
import {originalPreview,originalFontFamilies,compactPreviewStyle} from './fruit-type-original.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>tidyFruitType(getSettings().fruitTypography);
const family=id=>{const f=findFont(id);if(!f||f.unusable)return '';loadFont(f);return fontStack(f);};
const option=(v,label,value)=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`;
// 펼친 영역은 창이 열린 동안만 기억한다 (저장 값 아님) — 종류를 바꾸거나 원복해 다시 그려도 그대로
const openGroups=new Map();
export const fruitTypographyMarkup=(owner="fruit")=>`<div data-fruit-type-editor="${owner==='deus'?'deus':'fruit'}" class="bl-fruit-type-editor"></div>`;
export function bindFruitTypography(root){
    const box=root.matches?.('[data-fruit-type-editor]')?root:root.querySelector('[data-fruit-type-editor]');if(!box)return()=>{};
    const owner=box.dataset.fruitTypeEditor==='deus'?'deus':'fruit',types=FRUIT_TYPES.filter(t=>typeOwner(t)===owner);
    const current=()=>{const s=tidyFruitType(getSettings().fruitTypography);s.kind=s.ownerKinds[owner];return s;};
    let alive=true;
    // Folding follows this editor only; the theme previews keep their own fold state.
    const folded=()=>{try{return localStorage.getItem('bl_ft_pvfold')==='1';}catch{return false;}};
    // 파라미터는 모두 세로 2줄: 윗줄 이름(슬라이더는 오른쪽에 현재 값), 아랫줄 조절칸 가로 꽉. 한 줄에 하나만.
    const field=(region,key,label,html)=>`<label class="bl-ft-param"><span>${label}</span>${html.replace('<select',`<select data-region="${region}" data-ft="${key}"`)}</label>`;
    const choice=(attr,label,options,value)=>`<label class="bl-ft-param"><span>${label}</span><select ${attr}>${options.map(([v,t])=>option(v,t,value)).join('')}</select></label>`;
    // Same parts as the theme sliders, but values belong to this editor, not to a theme path.
    const slider=(region,key,label,value,min,max,step,unit)=>{const attrs=`data-region="${region}" data-ft="${key}" aria-label="${esc(label)}" min="${min}" max="${max}"`;return `<div class="salty-slider bl-ft-slider"><header><span>${label}</span><span class="salty-num"><input type="number" step="any" ${attrs} value="${value}" style="--num-ch:${Math.max(3,String(value).length)}"><i class="salty-unit">${unit}</i></span></header><input type="range" data-touch-range step="${step}" ${attrs} value="${value}" style="--fill:${(value-min)/(max-min)*100}%"></div>`;};
    const toggle=(attrs,label,checked)=>`<label class="salty-switch"><input type="checkbox" ${attrs} aria-label="${esc(label)}" ${checked?'checked':''}><span></span></label>`;
    // 이름 · [원복] · 스위치를 한 줄에 (상태창 전체도, 영역도 같은 모양)
    const switchRow=(label,note,reset,resetLabel,on)=>`<div class="salty-row bl-ft-row"><span>${label}${note?`<small>${note}</small>`:''}</span><span class="bl-ft-row-ctl"><button type="button" class="salty-btn" ${reset} aria-label="${esc(resetLabel)}">원복</button>${on}</span></div>`;
    // 영역은 테마 설정 묶음처럼 접는다: 이름 · 지금 상태 · +/−, 한 번에 하나만 펼침
    const fold=(key,label,summary,body)=>{const open=openGroups.get(owner)===key;return `<div class="bl-ft-group" data-ft-group-box="${key}"><button type="button" class="bl-ft-group-toggle" data-ft-group="${key}" aria-expanded="${open}"><span>${esc(label)}</span><small class="bl-ft-group-summary">${esc(summary)}</small></button><div class="bl-ft-group-body"${open?'':' hidden'}>${body}</div></div>`;};
    const regionSummary=r=>!r.on?'끔':r.font!=='original'?`켬 · ${findFont(r.font)?.label||'글꼴'}`:'켬';
    function paint(){
        const s=current(),type=FRUIT_TYPES.find(t=>t.id===s.kind),config=s.types[s.kind],ownerName=owner==='deus'?'데우스':'과일';
        const regions=Object.entries(type.regions).map(([key,[label]])=>{const r=config.regions[key];return fold(key,label,regionSummary(r),`${switchRow('이 영역 조절','',`data-ft-reset="${key}"`,`${label} 원복`,toggle(`data-region="${key}" data-ft="on"`,`${label} 조절`,r.on))}
${field(key,'font','글꼴',`<select>${option('original','원작 글꼴',r.font)}${allFonts().filter(f=>!f.unusable).map(f=>option(f.id,f.label,r.font)).join('')}</select>`)}
${slider(key,'size','크기',r.size,8,64,1,'px')}${slider(key,'weight','굵기',r.weight,100,900,100,'')}
${field(key,'italic','기울임',`<select>${option('false','보통',String(r.italic))}${option('true','기울임',String(r.italic))}</select>`)}
${slider(key,'spacing','자간',r.spacing,-2,12,.1,'px')}${slider(key,'line','줄간격',r.line,.8,4,.05,'배')}
${field(key,'align','정렬',`<select>${[['original','원작 그대로'],['left','왼쪽'],['center','가운데'],['right','오른쪽'],['justify','양쪽']].map(([v,t])=>option(v,t,r.align)).join('')}</select>`)}
${field(key,'wrap','줄바꿈',`<select>${[['original','원작 그대로'],['word','낱말 단위'],['anywhere','글자 단위'],['nowrap','한 줄 · 넘치면 스크롤']].map(([v,t])=>option(v,t,r.wrap)).join('')}</select>`)}`);}).join('');
        const unsupported=owner==='fruit'?fold('support','지원 범위',`${types.length}종`,`<p class="salty-note">위 ${types.length}종만 조절해요. 구조가 정해지지 않은 상태창은 덮어쓰지 않아요.</p><ul class="bl-ft-support">${FRUIT_UNSUPPORTED.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`):'';
        const footer=type.regions.footer?`${type.id==='status'?'하단 반복 문구':type.regions.footer[0]} 숨기기`:'';
        box.innerHTML=`${choice('data-ft-kind','상태창 종류',types.map(t=>[t.id,t.name]),s.kind)}
${switchRow(`${ownerName} 글자 설정 사용`,'끄면 원작 표시로 돌아가요','data-ft-all-reset','이 상태창 전체 원복',toggle('data-ft-on',`${ownerName} 글자 설정 사용`,ownerEnabled(s,owner)))}
<div class="salty-prevbox bl-ft-prevbox${folded()?' folded':''}" data-pv-max="120"><button type="button" class="salty-pvfold" data-ft-pvfold aria-expanded="${!folded()}" aria-label="${folded()?'미리보기 펼치기':'미리보기 접기'}"><i aria-hidden="true"></i></button><iframe class="bl-ft-preview" title="가상 상태창 미리보기" sandbox="allow-same-origin"></iframe></div>
<p class="salty-note bl-ft-font-note" data-ft-font-status role="status"></p>
${type.id==='compact'?choice('data-ft-preview-style','미리보기 예시',[['present','현대'],['olden','고전'],['scifi','SF']],compactPreviewStyle(config.previewStyle)):''}
${type.layout?choice('data-ft-layout','정보 배치',layoutChoices(type),layoutChoices(type).some(([value])=>value===config.layout)?config.layout:'original'):''}
${footer?`<div class="salty-row bl-ft-row"><span>${footer}</span>${toggle('data-ft-hide',footer,config.hideFooter)}</div>`:''}
<div class="bl-ft-groups">${regions}${unsupported}</div>`;
        const frame=box.querySelector('iframe'),original=originalPreview(s.kind,config.previewStyle),fontNote=box.querySelector('[data-ft-font-status]');
        // 짧게: 가상 예시라는 것과 글꼴 상태만
        const say=text=>{fontNote.textContent=`가상 예시 · ${text}`;};
        say(original.links.length?'원작 글꼴을 불러오는 중이에요':'대화 기본 글꼴로 보여요');
        lastCss=lastLook='';
        frame.addEventListener('load',()=>{updatePreview();const d=frame.contentDocument;if(!d?.getElementById('custom'))return;d.fonts.ready.then(()=>{if(!alive||!frame.isConnected)return;const families=new Set([...d.fonts].map(f=>f.family.replace(/^['"]|['"]$/g,'')));const missing=originalFontFamilies(s.kind,config.previewStyle).some(f=>!families.has(f))||[...d.querySelectorAll('link')].some(l=>!l.sheet)||[...d.fonts].some(f=>f.status==='error');say(missing?'일부 원작 글꼴 대신 대체 글꼴로 보여요':original.links.length?'원작 글꼴로 보여요':'대화 기본 글꼴로 보여요');updatePreview();});});
        bindPreviewViews(box,'fruit-type');
        frame.srcdoc=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${original.links.map(url=>`<link rel="stylesheet" href="${esc(url)}">`).join('')}<style>${FRUIT_PREVIEW_BASE}\n${original.css}</style><style id="custom"></style><body>${fruitTypePreview(s.kind)}</body></html>`;
    }
    // 미리보기 칸은 작게 두고, 펼치거나 고친 영역이 보이게 칸 안을 옮긴다 (확대 배율 · 사용자가 옮긴 가로 위치는 그대로)
    function reveal(key){
        const s=current(),type=FRUIT_TYPES.find(t=>t.id===s.kind),region=type?.regions[key],d=box.querySelector('iframe')?.contentDocument,view=box._previewViews?.get('fruit-type');if(!region||!d?.body||!view)return;
        const target=region[1].split(',').map(sel=>d.querySelector(`${type.root} ${sel}`)||d.querySelector(sel)).find(Boolean);if(!target)return;
        const top=Math.max(0,target.getBoundingClientRect().top-8)*view.scale,port=box.querySelector('.bl-view-port')?.clientHeight||0,shown=top+view.y;if(shown>=0&&shown<port-24)return;// 이미 보이면 그대로 (슬라이더를 끄는 동안 흔들리지 않게)
        view.y=-top;box.dispatchEvent(new Event('bl:preview-resize'));
    }
    // 값이 바뀐 뒤 영역 머리 요약만 고친다 (다시 그리지 않음)
    function summarize(s){const config=s.types[s.kind];for(const out of box.querySelectorAll('[data-ft-group-box]')){const r=config.regions[out.dataset.ftGroupBox];if(r)out.querySelector('.bl-ft-group-summary').textContent=regionSummary(r);}}
    // 1.5초마다 불리므로 바뀐 것만 쓴다 (같은 값이면 iframe 다시 계산 없음)
    let lastCss='',lastLook='';
    function updatePreview(){
        if(!alive)return;const frame=box.querySelector('iframe'),d=frame?.contentDocument;if(!d?.getElementById('custom'))return;
        const css=fruitTypeCss(current(),family);if(css!==lastCss){d.getElementById('custom').textContent=css;lastCss=css;}
        const host=getComputedStyle(box),chatStyle=getComputedStyle(document.querySelector('#chat .mes_text')||document.querySelector('#chat')||document.body);
        const look=[host.getPropertyValue('--salty-bg').trim()||'#faf8f3',host.getPropertyValue('--salty-text').trim()||'#333',chatStyle.fontFamily,chatStyle.fontSize];
        if(look.join('|')!==lastLook){d.body.style.setProperty('--preview-bg',look[0]);d.body.style.setProperty('--preview-text',look[1]);d.body.style.setProperty('--mainFontFamily',look[2]);d.body.style.fontSize=look[3];lastLook=look.join('|');}
        document.fonts?.forEach(f=>{if(!d.fonts.has(f))d.fonts.add(f);});
        // Share only font resources already loaded by actual same-origin renderers.
        // No message text, character data or preset bodies enter the preview.
        const families=new Set(originalFontFamilies(current().kind,current().types[current().kind].previewStyle));
        for(const native of document.querySelectorAll('#chat iframe'))try{native.contentDocument?.fonts?.forEach(f=>{if(families.has(f.family.replace(/^['"]|['"]$/g,''))&&!d.fonts.has(f))d.fonts.add(f);});}catch{/* Cross-origin renderers remain isolated. */}
        // 내용 높이에 맞춘다 — 빈 바닥을 남기지 않게. 문서 높이는 iframe 높이 밑으로 줄지 않아 body 를 잰다 (보이는 높이는 미리보기 칸이 정한다)
        const px=Math.min(520,Math.max(48,Math.ceil(d.body.getBoundingClientRect().height)))+'px';if(frame.style.height!==px)frame.style.height=px;
    }
    function commit(s){s.ownerKinds[owner]=s.kind;getSettings().fruitTypography=tidyFruitType(s);saveSettings();syncFruitTypography(s,themeEnabled(getSettings()));summarize(s);updatePreview();}
    function change(e){
        const el=e.target,s=current(),type=s.types[s.kind];
        if(el.hasAttribute('data-ft-kind')){if(!types.some(t=>t.id===el.value))return;s.kind=el.value;commit(s);paint();return;}
        if(el.hasAttribute('data-ft-preview-style')){type.previewStyle=compactPreviewStyle(el.value);commit(s);paint();return;}
        if(el.hasAttribute('data-ft-on'))s.ownerOn[owner]=el.checked;
        else if(el.hasAttribute('data-ft-layout'))type.layout=el.value;
        else if(el.hasAttribute('data-ft-hide'))type.hideFooter=el.checked;
        else if(el.dataset.ft&&el.dataset.region){const r=type.regions[el.dataset.region];if(!r)return;const key=el.dataset.ft;r[key]=key==='on'?el.checked:key==='italic'?el.value==='true':['size','weight','spacing','line'].includes(key)?Number(el.value):el.value;
            // Choosing a value is the intent to use it: switch on this region and the owner's typography.
            if(key!=='on'&&!r.on){r.on=true;const toggle=box.querySelector(`[data-region="${el.dataset.region}"][data-ft="on"]`);if(toggle)toggle.checked=true;}}
        else return;
        if(el.dataset.region)reveal(el.dataset.region);
        if(!el.hasAttribute('data-ft-on')&&!ownerEnabled(s,owner)){s.ownerOn[owner]=true;const toggle=box.querySelector('[data-ft-on]');if(toggle)toggle.checked=true;}
        commit(s);
    }
    function input(e){
        const el=e.target;if(!['number','range'].includes(el.type)||!el.dataset.ft)return;
        if(el.type==='number'&&(el.value===''||!el.validity.valid))return;
        const value=Math.min(Number(el.max),Math.max(Number(el.min),Number(el.value)));
        for(const other of el.closest('.bl-ft-slider')?.querySelectorAll('input')||[]){if(other!==el)other.value=String(value);if(other.type==='range')other.style.setProperty('--fill',`${(value-Number(other.min))/(Number(other.max)-Number(other.min))*100}%`);else other.style.setProperty('--num-ch',Math.max(3,String(other.value).length));}
        change(e);
    }
    function click(e){
        const group=e.target.closest('[data-ft-group]');
        if(group){const open=group.getAttribute('aria-expanded')!=='true';openGroups.set(owner,open?group.dataset.ftGroup:null);for(const other of box.querySelectorAll('[data-ft-group]')){const on=open&&other===group;other.setAttribute('aria-expanded',String(on));other.nextElementSibling.hidden=!on;}if(open)reveal(group.dataset.ftGroup);return;}
        const fold=e.target.closest('[data-ft-pvfold]');
        if(fold){const shut=!fold.parentElement.classList.contains('folded');fold.parentElement.classList.toggle('folded',shut);fold.setAttribute('aria-expanded',String(!shut));fold.setAttribute('aria-label',shut?'미리보기 펼치기':'미리보기 접기');try{localStorage.setItem('bl_ft_pvfold',shut?'1':'0');}catch{}box.dispatchEvent(new Event('bl:preview-resize'));return;}if(e.target.closest('[data-ft-all-reset]')){const s=current();s.types[s.kind]=tidyFruitType({}).types[s.kind];commit(s);paint();return;}const el=e.target.closest('[data-ft-reset]');if(!el)return;const s=current();s.types[s.kind].regions[el.dataset.ftReset]={...REGION_DEFAULT};commit(s);paint();}
    box.addEventListener('change',change);box.addEventListener('input',input);box.addEventListener('click',click);paint();
    const timer=setInterval(updatePreview,1500);
    return()=>{alive=false;clearInterval(timer);box._previewCleanup?.();box.removeEventListener('change',change);box.removeEventListener('input',input);box.removeEventListener('click',click);};
}
export async function openFruitTypography(kind){
    const s=current();if(FRUIT_TYPES.some(t=>t.id===kind)){s.kind=kind;s.ownerKinds[typeOwner(FRUIT_TYPES.find(t=>t.id===kind))]=kind;getSettings().fruitTypography=s;saveSettings();}
    const dialog=document.createElement('dialog');dialog.className='bl-ft-dialog';dialog.setAttribute('aria-label','블루레몬에이드 상태창 글자 설정');
    // 머리 한 줄: 제목 · 닫기
    const head=document.createElement('div');head.className='bl-ft-dialog-head';head.innerHTML='<b>상태창 글자</b><button type="button" class="salty-btn">닫기</button>';const close=head.lastElementChild;close.addEventListener('click',()=>dialog.close());
    const content=document.createElement('div');content.innerHTML=fruitTypographyMarkup(typeOwner(FRUIT_TYPES.find(t=>t.id===s.kind)||{}));dialog.append(head,content);document.body.append(dialog);bindTouchSliders(dialog);const cleanup=bindFruitTypography(content);
    dialog.addEventListener('close',()=>{cleanup();dialog.remove();},{once:true});dialog.showModal();close.focus();
}
