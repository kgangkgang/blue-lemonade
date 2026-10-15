import {themeEnabled} from './usage-mode.js';
import {getSettings,saveSettings} from './settings.js';
import {allFonts,findFont,fontStack,loadFont} from './fonts.js';
import {FRUIT_TYPES,FRUIT_UNSUPPORTED,REGION_DEFAULT,tidyFruitType,fruitTypeCss} from './fruit-type-schema.js';
import {fruitTypePreview,FRUIT_PREVIEW_BASE} from './fruit-type-preview.js';
import {syncFruitTypography} from './fruit-type-runtime.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>tidyFruitType(getSettings().fruitTypography);
const family=id=>{const f=findFont(id);if(!f||f.unusable)return '';loadFont(f);return fontStack(f);};
const option=(v,label,value)=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`;
export const fruitTypographyMarkup=()=>'<div data-fruit-type-editor class="bl-fruit-type-editor"></div>';
export function bindFruitTypography(root){
    const box=root.matches?.('[data-fruit-type-editor]')?root:root.querySelector('[data-fruit-type-editor]');if(!box)return()=>{};
    let alive=true;
    const field=(region,key,label,html)=>`<label class="bl-ft-field"><span>${label}</span>${html.replace('<input',`<input data-region="${region}" data-ft="${key}"`).replace('<select',`<select data-region="${region}" data-ft="${key}"`)}</label>`;
    const number=(key,value,min,max,step)=>`<input type="number" aria-label="${key}" min="${min}" max="${max}" step="${step}" value="${value}">`;
    function paint(){
        const s=current(),type=FRUIT_TYPES.find(t=>t.id===s.kind),config=s.types[s.kind];
        box.innerHTML=`<div class="salty-label">상태창 글자 설정</div><p class="salty-note">아래 예시는 가상 인물과 문장만 사용해요. 실제 대화·캐릭터 정보는 읽지 않아요.</p><label class="bl-ft-field"><span>상태창 종류</span><select data-ft-kind>${FRUIT_TYPES.map(t=>option(t.id,(t.owner==='deus'?'데우스 · ':'')+t.name,s.kind)).join('')}</select></label><p class="salty-note bl-ft-selected-name">${esc(type.name)}</p><iframe class="bl-ft-preview" title="가상 상태창 미리보기" sandbox="allow-same-origin"></iframe><label class="bl-ft-toggle"><input type="checkbox" data-ft-on ${s.on?'checked':''}><span>상태창 글자 설정 사용</span></label><button type="button" class="salty-btn" data-ft-all-reset>이 상태창 원복</button><p class="salty-note">끄면 원작 표시로 돌아가요. 아래 영역도 따로 켜거나 원복할 수 있어요.</p>
${type.layout?`<label class="bl-ft-field"><span>정보 배치</span><select data-ft-layout>${[['original','원작 그대로'],['horizontal','가로 나란히'],['vertical','세로 한 줄씩']].map(([v,t])=>option(v,t,config.layout)).join('')}</select></label>`:''}
${type.regions.footer?`<label class="bl-ft-toggle"><input type="checkbox" data-ft-hide ${config.hideFooter?'checked':''}><span>${type.id==='status'?'하단 반복 문구':type.regions.footer[0]} 숨기기</span></label>`:''}
${Object.entries(type.regions).map(([key,[label]])=>{const r=config.regions[key];return `<details class="bl-ft-region" open><summary>${esc(label)}</summary><div class="bl-ft-region-actions"><label class="bl-ft-toggle"><input type="checkbox" data-region="${key}" data-ft="on" ${r.on?'checked':''}><span>이 영역 조절</span></label><button type="button" class="salty-btn" data-ft-reset="${key}">원복</button></div><div class="bl-ft-fields">
${field(key,'font','글꼴',`<select>${option('original','원작 글꼴',r.font)}${allFonts().filter(f=>!f.unusable).map(f=>option(f.id,f.label,r.font)).join('')}</select>`)}
${field(key,'size','크기 (px)',number('글자 크기',r.size,8,64,1))}${field(key,'weight','굵기',number('글자 굵기',r.weight,100,900,50))}
${field(key,'italic','기울임',`<select>${option('false','보통',String(r.italic))}${option('true','기울임',String(r.italic))}</select>`)}
${field(key,'spacing','자간 (px)',number('자간',r.spacing,-2,12,.1))}${field(key,'line','줄간격 (배)',number('줄간격',r.line,.8,4,.1))}
${field(key,'align','정렬',`<select>${[['original','원작 그대로'],['left','왼쪽'],['center','가운데'],['right','오른쪽'],['justify','양쪽']].map(([v,t])=>option(v,t,r.align)).join('')}</select>`)}
${field(key,'wrap','줄바꿈',`<select>${[['original','원작 그대로'],['word','낱말 단위'],['anywhere','글자 단위'],['nowrap','한 줄 · 넘치면 스크롤']].map(([v,t])=>option(v,t,r.wrap)).join('')}</select>`)}</div></details>`;}).join('')}
<details class="bl-ft-region"><summary>지원 범위 확인</summary><p class="salty-note">위 ${FRUIT_TYPES.length}종의 알려진 렌더러만 조절해요. 카드마다 구조가 다른 항목은 자동으로 덮어쓰지 않아요.</p><ul>${FRUIT_UNSUPPORTED.map(n=>`<li>${esc(n)} — 고정된 표시 구조가 없어 미지원</li>`).join('')}</ul></details>`;
        const frame=box.querySelector('iframe');frame.addEventListener('load',updatePreview);frame.srcdoc=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${FRUIT_PREVIEW_BASE}</style><style id="custom"></style><body>${fruitTypePreview(s.kind)}</body></html>`;
    }
    function updatePreview(){
        if(!alive)return;const frame=box.querySelector('iframe'),d=frame?.contentDocument;if(!d?.getElementById('custom'))return;
        d.getElementById('custom').textContent=fruitTypeCss(current(),family);
        const host=getComputedStyle(box);d.body.style.setProperty('--preview-bg',host.getPropertyValue('--salty-bg').trim()||'#faf8f3');d.body.style.setProperty('--preview-text',host.getPropertyValue('--salty-text').trim()||'#333');
        document.fonts?.forEach(f=>{if(!d.fonts.has(f))d.fonts.add(f);});
        frame.style.height=Math.min(520,Math.max(180,d.documentElement.scrollHeight+4))+'px';
    }
    function commit(s){getSettings().fruitTypography=tidyFruitType(s);saveSettings();syncFruitTypography(s,themeEnabled(getSettings()));updatePreview();}
    function change(e){
        const el=e.target,s=current(),type=s.types[s.kind];
        if(el.hasAttribute('data-ft-kind')){s.kind=el.value;commit(s);paint();return;}
        if(el.hasAttribute('data-ft-on'))s.on=el.checked;
        else if(el.hasAttribute('data-ft-layout'))type.layout=el.value;
        else if(el.hasAttribute('data-ft-hide'))type.hideFooter=el.checked;
        else if(el.dataset.ft&&el.dataset.region){const r=type.regions[el.dataset.region];if(!r)return;const key=el.dataset.ft;r[key]=key==='on'?el.checked:key==='italic'?el.value==='true':['size','weight','spacing','line'].includes(key)?Number(el.value):el.value;}
        else return;commit(s);
    }
    function input(e){if(e.target.type==='number'&&e.target.value!==''&&e.target.validity.valid)change(e);}
    function click(e){if(e.target.closest('[data-ft-all-reset]')){const s=current();s.types[s.kind]=tidyFruitType({}).types[s.kind];commit(s);paint();return;}const el=e.target.closest('[data-ft-reset]');if(!el)return;const s=current();s.types[s.kind].regions[el.dataset.ftReset]={...REGION_DEFAULT};commit(s);paint();}
    box.addEventListener('change',change);box.addEventListener('input',input);box.addEventListener('click',click);paint();
    const timer=setInterval(updatePreview,1500);
    return()=>{alive=false;clearInterval(timer);box.removeEventListener('change',change);box.removeEventListener('input',input);box.removeEventListener('click',click);};
}
export async function openFruitTypography(kind){
    const s=current();if(FRUIT_TYPES.some(t=>t.id===kind)){s.kind=kind;getSettings().fruitTypography=s;saveSettings();}
    const dialog=document.createElement('dialog');dialog.className='bl-ft-dialog';dialog.setAttribute('aria-label','블루레몬에이드 상태창 글자 설정');
    const close=document.createElement('button');close.type='button';close.className='salty-btn';close.textContent='닫기';close.addEventListener('click',()=>dialog.close());
    const content=document.createElement('div');content.innerHTML=fruitTypographyMarkup();dialog.append(close,content);document.body.append(dialog);const cleanup=bindFruitTypography(content);
    dialog.addEventListener('close',()=>{cleanup();dialog.remove();},{once:true});dialog.showModal();close.focus();
}
