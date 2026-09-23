import { PALETTE_FAMILIES, paletteColors, paletteVariant, PALETTES, safeColor } from './palettes.js';
import { GRADIENT_KEYS, TEXT_GRADIENT_KEYS, gradientFor, mixFor, mixPath } from './gradients.js';

export function gradientControls(s,key,label,{slider,esc}) {
    if(!GRADIENT_KEYS.includes(key))return '';
    const config=s.gradients.overrides[s.palette]?.[key],mode=config?.mode||'inherit';
    const path=`gradients.overrides.${s.palette}.${key}`;
    const inherited=TEXT_GRADIENT_KEYS.includes(key)?'기본 단색':'테마 따르기';
    return `<div class="bl-gradient-control" data-gradient-key="${key}"><div class="salty-seg" role="group" aria-label="${esc(label)} 색 방식">${[['inherit',inherited],['solid','단색'],['gradient','그라데이션']].filter(([v])=>v!=='solid'||!TEXT_GRADIENT_KEYS.includes(key)).map(([v,l])=>`<button type="button" data-act="gradient-mode" data-key="${key}" data-mode="${v}" aria-pressed="${mode===v}" class="${mode===v?'on':''}">${l}</button>`).join('')}</div>${mode==='gradient'?`<div class="bl-gradient-colors">${config.colors.map((c,i)=>`<label><span>${i+1}번 색</span><toolcool-color-picker data-gradient-color="${key}" data-index="${i}" color="${esc(c)}" button-width="2.5rem" button-height="1.5rem"></toolcool-color-picker></label>`).join('')}<button type="button" class="salty-btn" data-act="gradient-count" data-key="${key}">${config.colors.length===2?'+ 3번째 색':'3번째 색 빼기'}</button></div>${slider(path+'.angle',label+' · 방향 (°)',0,360,1,90)}${config.colors.map((_,i)=>slider(path+`.weights.${i}`,`${label} · ${i+1}번 색 비중`,1,100,1,50)).join('')}<p class="salty-note">비중을 높인 색이 더 넓게 보여요. 0° 위 · 90° 오른쪽 · 180° 아래 · 270° 왼쪽.</p>`:''}</div>`;
}
export function mixControls(s,{slider,esc}) {
    const m=mixFor(s),path=mixPath(s),mode=PALETTES[s.palette]?.mode||'light';
    return `<div class="salty-group bl-mix"><div class="salty-row"><span>에이드 혼합하기<small>${mode==='light'?'라이트':'나이트'} 전용 · 누른 순서대로 최대 3색. 1색만 남겨도 돼요.</small></span><button type="button" class="salty-btn" data-act="mix-toggle" aria-pressed="${m.on}">${m.on?'혼합 끄기':'에이드 혼합하기'}</button></div>${m.on?`<div class="bl-mix-swatches" role="group" aria-label="섞을 에이드">${Object.entries(PALETTE_FAMILIES).filter(([k])=>k!=='custom').map(([key,f])=>`<button type="button" data-act="mix-family" data-family="${key}" aria-pressed="${m.families.includes(key)}" ${!m.families.includes(key)&&m.families.length===3?'disabled':''}><i aria-hidden="true" style="background:linear-gradient(135deg, ${safeColor(PALETTES[paletteVariant(key,'light')].bg)} 50%, ${safeColor(PALETTES[paletteVariant(key,'light')].pop)} 50%)"></i>${esc(f.label)}${m.families.includes(key)?` <b>${m.families.indexOf(key)+1}</b>`:''}</button>`).join('')}</div>${slider(path+'.angle','혼합 방향 (°)',0,360,1,90)}${slider(path+'.blend','번짐',0,100,1,50)}${m.families.map((f,i)=>slider(`${path}.weights.${i}`,`${PALETTE_FAMILIES[f].label} 비중`,1,100,1,50)).join('')}<p class="salty-note">번짐 0은 경계가 딱 나뉘고, 100은 끝에서 끝까지 천천히 번져요. 최대 3색 · 색 비중은 서로의 상대적인 넓이예요. 180° 돌리면 색 순서가 반대가 돼요. 색 고치기에서 항목별로 단색도 고를 수 있어요.</p>`:''}</div>`;
}
export function gradientAction(action,el,s) {
    if(action==='mix-toggle'){mixFor(s).on=!mixFor(s).on;return;}
    if(action==='mix-family') {
        const m=mixFor(s),key=el.dataset.family,i=m.families.indexOf(key);
        if(!Object.hasOwn(PALETTE_FAMILIES,key)||key==='custom')return;
        if(i>=0&&m.families.length>1){m.families.splice(i,1);m.weights.splice(i,1);m.weights.push(50);}
        else if(i<0&&m.families.length<3){m.families.push(key);}
        return;
    }
    const key=el.dataset.key;if(!GRADIENT_KEYS.includes(key))return;
    const entries=s.gradients.overrides[s.palette]||={};
    if(action==='gradient-mode') {
        if(el.dataset.mode==='inherit'){delete entries[key];return;}
        const current=gradientFor(s,key),pal=paletteColors(s);
        entries[key]={mode:el.dataset.mode,colors:current?.colors||[pal[key]||pal.text,pal.accent],angle:current?.angle??mixFor(s).angle,weights:current?.weights?.slice()||[50,50,50]};
    } else if(action==='gradient-count'&&entries[key]) {
        const colors=entries[key].colors;if(colors.length===3)colors.pop();else colors.push(paletteColors(s).strong);
    }
}
export function bindGradientColors(root,getSettings,update) {
    root.querySelectorAll('toolcool-color-picker[data-gradient-color]').forEach(picker=>{
        let armed=false;
        picker.addEventListener('pointerdown',()=>{armed=true});picker.addEventListener('keydown',()=>{armed=true});
        picker.addEventListener('change',event=>{
            if(!armed)return;const color=safeColor(event.detail?.rgba||picker.color),key=picker.dataset.gradientColor,index=Number(picker.dataset.index);
            update(s=>{const g=s.gradients.overrides[s.palette]?.[key];if(g&&index>=0&&index<g.colors.length)g.colors[index]=color;},false,`gradient-${key}-${index}`);
        });
    });
}
