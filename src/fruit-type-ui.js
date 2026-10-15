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
export const fruitTypographyMarkup=(owner="fruit")=>`<div data-fruit-type-editor="${owner==='deus'?'deus':'fruit'}" class="bl-fruit-type-editor"></div>`;
export function bindFruitTypography(root){
    const box=root.matches?.('[data-fruit-type-editor]')?root:root.querySelector('[data-fruit-type-editor]');if(!box)return()=>{};
    const owner=box.dataset.fruitTypeEditor==='deus'?'deus':'fruit',types=FRUIT_TYPES.filter(t=>typeOwner(t)===owner);
    const current=()=>{const s=tidyFruitType(getSettings().fruitTypography);s.kind=s.ownerKinds[owner];return s;};
    let alive=true;
    // Folding follows this editor only; the theme previews keep their own fold state.
    const folded=()=>{try{return localStorage.getItem('bl_ft_pvfold')==='1';}catch{return false;}};
    const field=(region,key,label,html)=>`<label class="bl-ft-field"><span>${label}</span>${html.replace('<input',`<input data-region="${region}" data-ft="${key}"`).replace('<select',`<select data-region="${region}" data-ft="${key}"`)}</label>`;
    // Same parts as the theme sliders, but values belong to this editor, not to a theme path.
    const slider=(region,key,label,value,min,max,step,unit)=>{const attrs=`data-region="${region}" data-ft="${key}" aria-label="${esc(label)}" min="${min}" max="${max}"`;return `<div class="salty-slider bl-ft-slider"><header><span>${label}</span><span class="salty-num"><input type="number" step="any" ${attrs} value="${value}" style="--num-ch:${Math.max(3,String(value).length)}"><i class="salty-unit">${unit}</i></span></header><input type="range" data-touch-range step="${step}" ${attrs} value="${value}" style="--fill:${(value-min)/(max-min)*100}%"></div>`;};
    function paint(){
        const s=current(),type=FRUIT_TYPES.find(t=>t.id===s.kind),config=s.types[s.kind];
        box.innerHTML=`<div class="salty-label">${owner==='deus'?'데우스':'과일'} 상태창 글자 설정</div><p class="salty-note">아래 예시는 가상 인물과 문장만 사용해요. 실제 대화·캐릭터 정보는 읽지 않아요.</p><label class="bl-ft-field"><span>상태창 종류</span><select data-ft-kind>${types.map(t=>option(t.id,t.name,s.kind)).join('')}</select></label><p class="salty-note bl-ft-selected-name">${esc(type.name)}</p><div class="salty-prevbox bl-ft-prevbox${folded()?' folded':''}"><button type="button" class="salty-pvfold" data-ft-pvfold aria-expanded="${!folded()}" aria-label="${folded()?'미리보기 펼치기':'미리보기 접기'}"><i aria-hidden="true"></i></button><iframe class="bl-ft-preview" title="가상 상태창 미리보기" sandbox="allow-same-origin"></iframe></div><label class="bl-ft-toggle"><input type="checkbox" data-ft-on ${ownerEnabled(s,owner)?'checked':''}><span>${owner==='deus'?'데우스':'과일'} 글자 설정 사용</span></label><button type="button" class="salty-btn" data-ft-all-reset>이 상태창 원복</button><p class="salty-note">끄면 원작 표시로 돌아가요. 아래 영역도 따로 켜거나 원복할 수 있어요.</p>
${type.layout?`<label class="bl-ft-field"><span>정보 배치</span><select data-ft-layout>${layoutChoices(type).map(([v,t])=>option(v,t,layoutChoices(type).some(([value])=>value===config.layout)?config.layout:'original')).join('')}</select></label>`:''}
${type.regions.footer?`<label class="bl-ft-toggle"><input type="checkbox" data-ft-hide ${config.hideFooter?'checked':''}><span>${type.id==='status'?'하단 반복 문구':type.regions.footer[0]} 숨기기</span></label>`:''}
${Object.entries(type.regions).map(([key,[label]])=>{const r=config.regions[key];return `<details class="bl-ft-region" open><summary>${esc(label)}</summary><div class="bl-ft-region-actions"><label class="bl-ft-toggle"><input type="checkbox" data-region="${key}" data-ft="on" ${r.on?'checked':''}><span>이 영역 조절</span></label><button type="button" class="salty-btn" data-ft-reset="${key}">원복</button></div><div class="bl-ft-fields">
${field(key,'font','글꼴',`<select>${option('original','원작 글꼴',r.font)}${allFonts().filter(f=>!f.unusable).map(f=>option(f.id,f.label,r.font)).join('')}</select>`)}
${slider(key,'size','크기',r.size,8,64,1,'px')}${slider(key,'weight','굵기',r.weight,100,900,100,'')}
${field(key,'italic','기울임',`<select>${option('false','보통',String(r.italic))}${option('true','기울임',String(r.italic))}</select>`)}
${slider(key,'spacing','자간',r.spacing,-2,12,.1,'px')}${slider(key,'line','줄간격',r.line,.8,4,.05,'배')}
${field(key,'align','정렬',`<select>${[['original','원작 그대로'],['left','왼쪽'],['center','가운데'],['right','오른쪽'],['justify','양쪽']].map(([v,t])=>option(v,t,r.align)).join('')}</select>`)}
${field(key,'wrap','줄바꿈',`<select>${[['original','원작 그대로'],['word','낱말 단위'],['anywhere','글자 단위'],['nowrap','한 줄 · 넘치면 스크롤']].map(([v,t])=>option(v,t,r.wrap)).join('')}</select>`)}</div></details>`;}).join('')}
<details class="bl-ft-region"><summary>지원 범위 확인</summary><p class="salty-note">위 ${types.length}종의 알려진 렌더러만 조절해요. 카드마다 구조가 다른 항목은 자동으로 덮어쓰지 않아요.</p><ul>${(owner==='fruit'?FRUIT_UNSUPPORTED:[]).map(n=>`<li>${esc(n)} — 고정된 표시 구조가 없어 미지원</li>`).join('')}</ul></details>`;
        const frame=box.querySelector('iframe'),original=originalPreview(s.kind,config.previewStyle),fontNote=document.createElement('p');fontNote.className='salty-note';fontNote.dataset.ftFontStatus='';fontNote.setAttribute('role','status');fontNote.textContent=original.links.length?'원작 글꼴을 불러오고 있어요.':'실제 대화 영역의 기본 글꼴을 사용해요.';frame.closest('.bl-ft-prevbox').after(fontNote);
        if(type.id==='compact'){const label=document.createElement('label');label.className='bl-ft-field';label.innerHTML='<span>미리보기 예시 스타일</span><select data-ft-preview-style>'+[['present','현대'],['olden','고전'],['scifi','SF']].map(([v,t])=>option(v,t,compactPreviewStyle(config.previewStyle))).join('')+'</select>';frame.closest('.bl-ft-prevbox').before(label);}
        frame.addEventListener('load',()=>{updatePreview();const d=frame.contentDocument;if(!d?.getElementById('custom'))return;d.fonts.ready.then(()=>{if(!alive||!frame.isConnected)return;const families=new Set([...d.fonts].map(f=>f.family.replace(/^['"]|['"]$/g,'')));const missing=originalFontFamilies(s.kind,config.previewStyle).some(f=>!families.has(f))||[...d.querySelectorAll('link')].some(l=>!l.sheet)||[...d.fonts].some(f=>f.status==='error');fontNote.textContent=missing?'일부 원작 웹 글꼴을 불러오지 못해 대체 글꼴로 보여요. 연결 후 다시 열어 주세요.':original.links.length?'원작과 같은 글꼴 목록을 사용해요. 해당 글꼴에 없는 문자는 원작처럼 대체 글꼴로 보여요.':'실제 대화 영역의 기본 글꼴을 사용해요.';updatePreview();});});
        bindPreviewViews(box,'fruit-type');
        frame.srcdoc=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${original.links.map(url=>`<link rel="stylesheet" href="${esc(url)}">`).join('')}<style>${FRUIT_PREVIEW_BASE}\n${original.css}</style><style id="custom"></style><body>${fruitTypePreview(s.kind)}</body></html>`;
    }
    function updatePreview(){
        if(!alive)return;const frame=box.querySelector('iframe'),d=frame?.contentDocument;if(!d?.getElementById('custom'))return;
        d.getElementById('custom').textContent=fruitTypeCss(current(),family);
        const host=getComputedStyle(box);d.body.style.setProperty('--preview-bg',host.getPropertyValue('--salty-bg').trim()||'#faf8f3');d.body.style.setProperty('--preview-text',host.getPropertyValue('--salty-text').trim()||'#333');
        const chatStyle=getComputedStyle(document.querySelector('#chat .mes_text')||document.querySelector('#chat')||document.body);d.body.style.setProperty('--mainFontFamily',chatStyle.fontFamily);d.body.style.fontSize=chatStyle.fontSize;
        document.fonts?.forEach(f=>{if(!d.fonts.has(f))d.fonts.add(f);});
        // Share only font resources already loaded by actual same-origin renderers.
        // No message text, character data or preset bodies enter the preview.
        const families=new Set(originalFontFamilies(current().kind,current().types[current().kind].previewStyle));
        for(const native of document.querySelectorAll('#chat iframe'))try{native.contentDocument?.fonts?.forEach(f=>{if(families.has(f.family.replace(/^['"]|['"]$/g,''))&&!d.fonts.has(f))d.fonts.add(f);});}catch{/* Cross-origin renderers remain isolated. */}
        frame.style.height=Math.min(520,Math.max(180,d.documentElement.scrollHeight+4))+'px';
    }
    function commit(s){s.ownerKinds[owner]=s.kind;getSettings().fruitTypography=tidyFruitType(s);saveSettings();syncFruitTypography(s,themeEnabled(getSettings()));updatePreview();}
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
        const fold=e.target.closest('[data-ft-pvfold]');
        if(fold){const shut=!fold.parentElement.classList.contains('folded');fold.parentElement.classList.toggle('folded',shut);fold.setAttribute('aria-expanded',String(!shut));fold.setAttribute('aria-label',shut?'미리보기 펼치기':'미리보기 접기');try{localStorage.setItem('bl_ft_pvfold',shut?'1':'0');}catch{}box.dispatchEvent(new Event('bl:preview-resize'));return;}if(e.target.closest('[data-ft-all-reset]')){const s=current();s.types[s.kind]=tidyFruitType({}).types[s.kind];commit(s);paint();return;}const el=e.target.closest('[data-ft-reset]');if(!el)return;const s=current();s.types[s.kind].regions[el.dataset.ftReset]={...REGION_DEFAULT};commit(s);paint();}
    box.addEventListener('change',change);box.addEventListener('input',input);box.addEventListener('click',click);paint();
    const timer=setInterval(updatePreview,1500);
    return()=>{alive=false;clearInterval(timer);box._previewCleanup?.();box.removeEventListener('change',change);box.removeEventListener('input',input);box.removeEventListener('click',click);};
}
export async function openFruitTypography(kind){
    const s=current();if(FRUIT_TYPES.some(t=>t.id===kind)){s.kind=kind;s.ownerKinds[typeOwner(FRUIT_TYPES.find(t=>t.id===kind))]=kind;getSettings().fruitTypography=s;saveSettings();}
    const dialog=document.createElement('dialog');dialog.className='bl-ft-dialog';dialog.setAttribute('aria-label','블루레몬에이드 상태창 글자 설정');
    const close=document.createElement('button');close.type='button';close.className='salty-btn';close.textContent='닫기';close.addEventListener('click',()=>dialog.close());
    const content=document.createElement('div');content.innerHTML=fruitTypographyMarkup(typeOwner(FRUIT_TYPES.find(t=>t.id===s.kind)||{}));dialog.append(close,content);document.body.append(dialog);bindTouchSliders(dialog);const cleanup=bindFruitTypography(content);
    dialog.addEventListener('close',()=>{cleanup();dialog.remove();},{once:true});dialog.showModal();close.focus();
}
