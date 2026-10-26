import {themeEnabled,addonsEnabled} from './usage-mode.js';
import {scriptSettings,scriptEnabled} from './scripts/store.js';
import {getSettings,saveSettings} from './settings.js';
import {allFonts,findFont,fontStack,loadFont} from './fonts.js';
import {FRUIT_TYPES,FRUIT_UNSUPPORTED,REGION_DEFAULT,tidyFruitType,fruitTypeCss,typeOwner,ownerEnabled,layoutChoices,typeMatch,stSelector} from './fruit-type-schema.js';
import {findFruitPreviewSource,copyFruitPreview,fruitPreviewBackground,FRUIT_SNAPSHOT_DOCUMENT} from './fruit-type-snapshot.js';
import {buildFruitSample,sampleVars,mountFragmentHost} from './fruit-type-sample.js';
import {syncFruitTypography} from './fruit-type-runtime.js';
import {bindTouchSliders} from './touch-sliders.js';
import {bindPreviewViews} from './preview-view.js';

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
    let alive=true, previewTimer=0, previewFrame=0, previewKind='', previewSignature='', autoPreviewScale=null;
    // Folding follows this editor only; the theme previews keep their own fold state.
    const folded=()=>{try{return localStorage.getItem('bl_ft_pvfold')==='1';}catch{return false;}};
    // 파라미터는 모두 세로 2줄: 윗줄 이름(슬라이더는 오른쪽에 현재 값), 아랫줄 조절칸 가로 꽉. 한 줄에 하나만.
    const field=(region,key,label,html)=>`<label class="bl-ft-param"><span>${label}</span>${html.replace('<select',`<select data-region="${region}" data-ft="${key}"`)}</label>`;
    const choice=(attr,label,options,value)=>`<label class="bl-ft-param"><span>${label}</span><select ${attr}>${options.map(([v,t])=>option(v,t,value)).join('')}</select></label>`;
    // Same parts as the theme sliders, but values belong to this editor, not to a theme path.
    const slider=(region,key,label,value,min,max,step,unit)=>{const attrs=`data-region="${region}" data-ft="${key}" aria-label="${esc(label)}" min="${min}" max="${max}"`;return `<div class="salty-slider bl-ft-slider"><header><span>${label}</span><span class="salty-num"><input type="number" step="any" ${attrs} value="${value}" style="--num-ch:${Math.max(3,String(value).length)}"><i class="salty-unit">${unit}</i></span></header><input type="range" data-touch-range step="${step}" ${attrs} value="${value}" style="--fill:${(value-min)/(max-min)*100}%"></div>`;};
    const toggle=(attrs,label,checked)=>`<label class="salty-switch"><input type="checkbox" ${attrs} aria-label="${esc(label)}" ${checked?'checked':''}><span></span></label>`;
    // 이름 · ↺ · 스위치를 한 줄에 (상태창 전체도, 영역도 같은 모양). 8.0.6 ↺ 는 테마 설정처럼 이름 바로 옆, 바꾼 값이 있을 때만 보여요.
    const switchRow=(label,note,reset,resetLabel,on,changed)=>`<div class="salty-row bl-ft-row"><span>${label}<button type="button" class="bl-ft-reset" ${reset} title="${esc(resetLabel)}" aria-label="${esc(resetLabel)}"${changed?'':' hidden'}>↺</button>${note?`<small>${note}</small>`:''}</span><span class="bl-ft-row-ctl">${on}</span></div>`;
    const typeChanged=(s,kind)=>JSON.stringify(s.types[kind])!==JSON.stringify(tidyFruitType({}).types[kind]);
    const regionChanged=r=>Object.keys(REGION_DEFAULT).some(k=>r[k]!==REGION_DEFAULT[k]);
    // 영역은 테마 설정 묶음처럼 접는다: 이름 · 지금 상태 · +/−, 한 번에 하나만 펼침
    const fold=(key,label,summary,body)=>{const open=openGroups.get(owner)===key;return `<div class="bl-ft-group" data-ft-group-box="${key}"><button type="button" class="bl-ft-group-toggle" data-ft-group="${key}" aria-expanded="${open}"><span>${esc(label)}</span><small class="bl-ft-group-summary">${esc(summary)}</small></button><div class="bl-ft-group-body"${open?'':' hidden'}>${body}</div></div>`;};
    const regionSummary=r=>!r.on?'끔':r.font!=='original'?`켬 · ${findFont(r.font)?.label||'글꼴'}`:'켬';
    function paint(){
        const s=current(),type=FRUIT_TYPES.find(t=>t.id===s.kind),config=s.types[s.kind],ownerName=owner==='deus'?'데우스':'과일 계열';
        const regions=Object.entries(type.regions).map(([key,[label]])=>{const r=config.regions[key];return fold(key,label,regionSummary(r),`${switchRow('이 영역 조절','',`data-ft-reset="${key}"`,`${label} · 기본값으로`,toggle(`data-region="${key}" data-ft="on"`,`${label} 조절`,r.on),regionChanged(r))}
${field(key,'font','글꼴',`<select>${option('original','원작 글꼴',r.font)}${allFonts().filter(f=>!f.unusable).map(f=>option(f.id,f.label,r.font)).join('')}</select>`)}
${slider(key,'size','크기',r.size,8,64,1,'px')}${slider(key,'weight','굵기',r.weight,100,900,100,'')}
${field(key,'italic','기울임',`<select>${option('false','보통',String(r.italic))}${option('true','기울임',String(r.italic))}</select>`)}
${slider(key,'spacing','자간',r.spacing,-2,12,.1,'px')}${slider(key,'line','줄간격',r.line,.8,4,.05,'배')}
${field(key,'align','정렬',`<select>${[['original','원작 그대로'],['left','왼쪽'],['center','가운데'],['right','오른쪽'],['justify','양쪽']].map(([v,t])=>option(v,t,r.align)).join('')}</select>`)}
${field(key,'wrap','줄바꿈',`<select>${[['original','원작 그대로'],['word','낱말 단위'],['anywhere','글자 단위'],['nowrap','한 줄 · 넘치면 스크롤']].map(([v,t])=>option(v,t,r.wrap)).join('')}</select>`)}`);}).join('');
        const unsupported=owner==='fruit'?fold('support','지원 범위',`${types.length}종`,`<p class="salty-note">위 ${types.length}종만 조절해요. 구조가 정해지지 않은 상태창은 덮어쓰지 않아요.</p><ul class="bl-ft-support">${FRUIT_UNSUPPORTED.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`):'';
        const footer=type.regions.footer?`${type.id==='status'?'하단 반복 문구':type.regions.footer[0]} 숨기기`:'';
        box.innerHTML=`${choice('data-ft-kind','상태창 종류',types.map(t=>[t.id,t.name]),s.kind)}
${switchRow(`${ownerName} 글자 설정 사용`,'끄면 원작 표시로 돌아가요','data-ft-all-reset','이 상태창 글자 설정 · 기본값으로',toggle('data-ft-on',`${ownerName} 글자 설정 사용`,ownerEnabled(s,owner)),typeChanged(s,s.kind))}
<div class="salty-prevbox bl-ft-prevbox${folded()?' folded':''}" data-pv-max="120"><button type="button" class="salty-pvfold" data-ft-pvfold aria-expanded="${!folded()}" aria-label="${folded()?'미리보기 펼치기':'미리보기 접기'}"><i aria-hidden="true"></i></button><iframe class="bl-ft-preview" title="상태창 미리보기" sandbox="allow-same-origin"></iframe></div>
<p class="salty-note bl-ft-font-note" data-ft-font-status role="status"><span class="bl-ft-sample-badge" data-ft-sample-badge hidden>표본이에요</span><span data-ft-note-text></span></p>

${type.layout?choice('data-ft-layout','정보 배치',layoutChoices(type),layoutChoices(type).some(([value])=>value===config.layout)?config.layout:'original'):''}
${footer?`<div class="salty-row bl-ft-row"><span>${footer}</span>${toggle('data-ft-hide',footer,config.hideFooter)}</div>`:''}
<div class="bl-ft-groups">${regions}${unsupported}</div>`;
        const frame=box.querySelector('iframe');
        dropHost();lastCss='';previewKind='';previewSignature='';autoPreviewScale=null;docMode='';sampleKey='';sampleToken++;
        frame.addEventListener('load',()=>capturePreview());
        bindPreviewViews(box,'fruit-type');
        frame.srcdoc=FRUIT_SNAPSHOT_DOCUMENT;
    }
    // 미리보기 칸은 작게 두고, 펼치거나 고친 영역이 보이게 칸 안을 옮긴다 (확대 배율 · 사용자가 옮긴 가로 위치는 그대로)
    function reveal(key){
        const s=current(),type=FRUIT_TYPES.find(t=>t.id===s.kind),region=type?.regions[key],d=box.querySelector('iframe')?.contentDocument,view=box._previewViews?.get('fruit-type');if(!region||!d?.body||!view)return;
        const pick=sel=>{try{return d.querySelector(sel);}catch{return null;}};
        const target=region[1].split(',').map(sel=>pick(`${typeMatch(type)} ${stSelector(sel)}`)||pick(stSelector(sel))).find(Boolean);if(!target)return;
        const top=Math.max(0,target.getBoundingClientRect().top-8)*view.scale,port=box.querySelector('.bl-view-port')?.clientHeight||0,shown=top+view.y;if(shown>=0&&shown<port-24)return;// 이미 보이면 그대로 (슬라이더를 끄는 동안 흔들리지 않게)
        view.y=-top;box.dispatchEvent(new Event('bl:preview-resize'));
    }
    // 값이 바뀐 뒤 영역 머리 요약 · ↺ 만 고친다 (다시 그리지 않음)
    function summarize(s){const config=s.types[s.kind];for(const out of box.querySelectorAll('[data-ft-group-box]')){const r=config.regions[out.dataset.ftGroupBox];if(r){out.querySelector('.bl-ft-group-summary').textContent=regionSummary(r);const reset=out.querySelector('[data-ft-reset]');if(reset)reset.hidden=!regionChanged(r);}}const all=box.querySelector('[data-ft-all-reset]');if(all)all.hidden=!typeChanged(s,s.kind);}
    let lastCss='',docMode='',sampleKey='',sampleToken=0,fragHost=null,sampleBackdrop='';
    const dropHost=()=>{fragHost?.remove();fragHost=null;};
    // 미리보기 문서는 실제 복제 · 표본 중 한 가지로만 써요. 바뀌면 빈 문서로 다시 읽고(load 가 다시 부름) 남은 모양을 섞지 않아요.
    function switchMode(frame,want){if(!docMode||docMode===want)return false;dropHost();docMode='';sampleKey='';previewKind='';previewSignature='';lastCss='';frame.srcdoc=FRUIT_SNAPSHOT_DOCUMENT;return true;}
    // 숨은 자리의 표본을 실제 상태창과 같은 방법으로 미리보기에 복제해요(글자 설정은 숨은 자리에 먼저 입혀요)
    function copySampleHost(){
        const frame=box.querySelector('iframe'),d=frame?.contentDocument,root=fragHost?.root;if(!root||!d?.querySelector('[data-bl-fruit-preview]'))return;
        if(!copyFruitPreview(root,d))return;
        const style=getComputedStyle(root),rect=root.getBoundingClientRect();
        d.body.style.backgroundColor=sampleBackdrop;d.body.style.colorScheme=style.colorScheme;
        d.getElementById('custom').textContent='';lastCss='';
        placeFrame(frame,rect.width,rect.height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0));
    }
    const lastMessage=()=>[...document.querySelectorAll('#chat .mes .mes_text')].at(-1)||null;
    function placeFrame(frame,width,height){
        const scene=box.querySelector('.bl-view-scene'),port=box.querySelector('.bl-view-port'),view=box._previewViews?.get('fruit-type');
        if(scene)scene.style.width=(Math.ceil(width)+2)+'px';
        if(view&&port&&(autoPreviewScale===null||Math.abs(view.scale-autoPreviewScale)<.001)){autoPreviewScale=Math.min(1,port.clientWidth/(Math.ceil(width)+2));view.scale=autoPreviewScale;view.x=0;}
        frame.style.width=Math.ceil(width)+'px';frame.style.maxWidth='none';
        frame.style.height=Math.max(48,Math.ceil(height))+'px';
        box.dispatchEvent(new Event('bl:preview-resize'));
    }
    // 표본 높이 = 표본 아래 끝 + 본문 아래 여백 (글자 설정을 바꾸면 다시 재요)
    function fitSample(){
        const frame=box.querySelector('iframe'),d=frame?.contentDocument,host=d?.querySelector('[data-bl-fruit-preview]');if(docMode!=='sample'||!host?.firstElementChild)return;
        const style=d.defaultView.getComputedStyle(d.body),height=host.getBoundingClientRect().bottom+(parseFloat(style.paddingBottom)||0)+(parseFloat(style.marginBottom)||0)+(parseFloat(style.borderBottomWidth)||0);
        const width=parseFloat(frame.style.width)||frame.clientWidth;
        if(Math.abs((parseFloat(frame.style.height)||0)-Math.ceil(height))>1)placeFrame(frame,width,height);
    }
    // 고른 글꼴(테마 글꼴)을 표본 문서도 쓰게 — 실제 상태창 복제와 같은 방식(이미 읽은 FontFace 만)
    function shareFonts(d,css){if(!d?.fonts||!css)return;for(const face of document.fonts||[]){if(face.status!=='loaded')continue;const name=face.family.replace(/^["']|["']$/g,'');if(css.includes(name)&&!d.fonts.has(face))try{d.fonts.add(face);}catch{/* 공유 못 하는 글꼴은 대체 글꼴 */}}}
    // 대화에 이 종류의 상태창이 없을 때: 원작 정규식으로 만든 표본(없으면 기본 표본)에 지금 글자 설정을 바로 입혀요.
    async function showSample(type,frame,note){
        const message=lastMessage(),messageWidth=message?.getBoundingClientRect().width||0,width=Math.round(messageWidth>120?messageWidth:Math.min(innerWidth-32,640));
        const vars=sampleVars(),backdrop=message?fruitPreviewBackground(message.firstElementChild||message):getComputedStyle(document.body).backgroundColor;
        const key=[type.id,width,vars,backdrop,(()=>{try{return scriptEnabled(scriptSettings(),'fruit-family');}catch{return false;}})()].join('|');
        if(docMode==='sample'&&key===sampleKey&&previewKind===type.id){if(!fragHost)fitSample();return;}
        const token=++sampleToken;
        let localize=false;try{localize=typeOwner(type)==='fruit'&&addonsEnabled(getSettings())&&scriptEnabled(scriptSettings(),'fruit-family');}catch{localize=false;}
        const sample=await buildFruitSample(type,{width,vars,localize});
        if(!alive||token!==sampleToken||current().kind!==type.id||!box.isConnected||box.querySelector('iframe')!==frame)return;
        const d=frame.contentDocument,host=d?.querySelector('[data-bl-fruit-preview]');if(!host)return;
        if(docMode&&docMode!=='sample'){switchMode(frame,'sample');return;}
        const say=()=>{box.querySelector('[data-ft-sample-badge]').hidden=false;note.textContent=sample.origin==='regex'?'대화에 이 종류의 상태창이 없어 원작 정규식으로 만든 표본을 보여요. 글자 설정은 표본에 바로 반영되고 저장돼요.':'대화에 이 종류의 상태창이 없고 원작 정규식도 찾지 못해 기본 표본을 보여요. 글자 설정은 표본에 바로 반영되고 저장돼요.';};
        dropHost();
        if(sample.fragment){
            // 채팅 본문형(데우스): 테마 규칙을 받는 숨은 자리에 그리고 실제 상태창처럼 복제해요
            const m=message?getComputedStyle(message):null,textStyle=m&&{'font-family':m.fontFamily,'font-size':m.fontSize,'line-height':m.lineHeight,'color':m.color,'letter-spacing':m.letterSpacing,'font-weight':m.fontWeight,'padding-left':m.paddingLeft,'padding-right':m.paddingRight,'box-sizing':m.boxSizing};
            fragHost=mountFragmentHost(type,sample,{width,textStyle});fragHost.setTypography(fruitTypeCss(current(),family));
            docMode='sample';sampleKey=key;previewKind=type.id;previewSignature='';sampleBackdrop=backdrop;say();
            requestAnimationFrame(()=>{if(alive&&token===sampleToken)copySampleHost();});
            return;
        }
        const parsed=new DOMParser().parseFromString(`<!doctype html><body>${sample.html}</body>`,'text/html');
        host.replaceChildren(...[...parsed.body.childNodes].map(node=>d.importNode(node,true)));
        host.style.width='100%';// 원작 body 가 flex 여도 표본 자리가 줄어들지 않게(원작의 #root{width:100%} 자리)
        d.getElementById('snapshot-pseudo').textContent=sample.css;
        d.documentElement.className=sample.htmlAttrs.className;d.body.className=sample.bodyAttrs.className;
        d.documentElement.style.cssText=`${vars};${sample.htmlAttrs.style}`;d.body.style.cssText=sample.bodyAttrs.style;
        d.documentElement.style.backgroundColor=backdrop;d.documentElement.style.colorScheme=getComputedStyle(document.documentElement).colorScheme;
        if(sample.fragment&&message){const m=getComputedStyle(message);Object.assign(d.body.style,{fontFamily:m.fontFamily,fontSize:m.fontSize,lineHeight:m.lineHeight,color:m.color,letterSpacing:m.letterSpacing});}
        docMode='sample';sampleKey=key;previewKind=type.id;previewSignature='';lastCss='';say();
        placeFrame(frame,width,parseFloat(frame.style.height)||120);
        updatePreview();
        requestAnimationFrame(fitSample);d.fonts?.ready?.then(()=>{if(alive)fitSample();});
    }
    function capturePreview(){
        previewFrame=0;if(!alive||!box.isConnected)return;
        const s=current(),type=FRUIT_TYPES.find(t=>t.id===s.kind),frame=box.querySelector('iframe'),d=frame?.contentDocument;
        if(!d?.querySelector('[data-bl-fruit-preview]'))return;
        const source=findFruitPreviewSource(document,typeMatch(type)),note=box.querySelector('[data-ft-note-text]');
        if(!source){if(!switchMode(frame,'sample'))void showSample(type,frame,note);return;}
        if(switchMode(frame,'real'))return;
        sampleToken++;box.querySelector('[data-ft-sample-badge]').hidden=true;
        const sourceStyle=getComputedStyle(source),rect=source.getBoundingClientRect(),backdrop=fruitPreviewBackground(source);
        const imageState=[...source.querySelectorAll('img')].map(i=>[i.currentSrc,i.complete,i.naturalWidth,i.naturalHeight].join(':')).join('|');
        const signature=[s.kind,source.outerHTML,imageState,JSON.stringify(s),sourceStyle.color,sourceStyle.backgroundColor,backdrop,sourceStyle.fontFamily,sourceStyle.fontSize,rect.width,rect.height,[...source.ownerDocument.fonts||[]].filter(f=>f.status==='loaded').length].join('|');
        if(signature===previewSignature)return;
        if(!copyFruitPreview(source,d)){d.querySelector('[data-bl-fruit-preview]').replaceChildren();note.textContent='상태창이 너무 복잡해 미리보기를 만들 수 없어요. 설정은 저장돼요.';previewKind='';previewSignature='';return;}previewKind=s.kind;previewSignature=signature;docMode='real';
        const previewHost=d.querySelector('[data-bl-fruit-preview]'),unavailable=Number(previewHost.getAttribute('data-bl-preview-unavailable-images')||0)+Number(previewHost.getAttribute('data-bl-preview-unavailable-art')||0);
        const unavailableFonts=Number(previewHost.getAttribute('data-bl-preview-unavailable-fonts')||0);
        note.textContent='현재 대화 상태창을 너비에 맞춰 보여요.'+(unavailable?' 그림·배경 '+unavailable+'곳은 다시 요청하지 않고 같은 크기의 자리로 보여요.':'')+(unavailableFonts?' 브라우저에서 공유하지 못한 글꼴 '+unavailableFonts+'종은 대체 글꼴로 보여요.':'');
        d.body.style.backgroundColor=backdrop;
        d.body.style.colorScheme=getComputedStyle(source).colorScheme;
        // 이미 적용된 실제 결과를 복제했으므로 설정 CSS를 다시 덧씌우지 않아요.
        d.getElementById('custom').textContent='';lastCss='';
        placeFrame(frame,rect.width,rect.height+(parseFloat(sourceStyle.marginTop)||0)+(parseFloat(sourceStyle.marginBottom)||0));
    }
    function schedulePreview(force=false){
        clearTimeout(previewTimer);
        previewTimer=setTimeout(()=>{if(force)previewSignature='';cancelAnimationFrame(previewFrame);previewFrame=requestAnimationFrame(capturePreview);},80);
    }
    function updatePreview(){
        if(!alive)return;const frame=box.querySelector('iframe'),d=frame?.contentDocument;
        if(!d?.getElementById('custom')||previewKind!==current().kind)return;
        const css=fruitTypeCss(current(),family);
        if(docMode==='sample'&&fragHost){fragHost.setTypography(css);requestAnimationFrame(copySampleHost);return;}
        if(css!==lastCss){d.getElementById('custom').textContent=css;lastCss=css;}
        if(docMode==='sample'){shareFonts(d,css);requestAnimationFrame(fitSample);}
    }
    function commit(s){s.ownerKinds[owner]=s.kind;getSettings().fruitTypography=tidyFruitType(s);saveSettings();syncFruitTypography(s,themeEnabled(getSettings()));summarize(s);updatePreview();schedulePreview(true);}
    function change(e){
        const el=e.target,s=current(),type=s.types[s.kind];
        if(el.hasAttribute('data-ft-kind')){if(!types.some(t=>t.id===el.value))return;s.kind=el.value;commit(s);paint();return;}
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
    const timer=setInterval(()=>{if(box.isConnected&&box.getClientRects().length&&!folded())schedulePreview();},1500);
    return()=>{alive=false;dropHost();clearInterval(timer);clearTimeout(previewTimer);cancelAnimationFrame(previewFrame);box._previewCleanup?.();box.removeEventListener('change',change);box.removeEventListener('input',input);box.removeEventListener('click',click);};
}
export async function openFruitTypography(kind){
    const s=current();if(FRUIT_TYPES.some(t=>t.id===kind)){s.kind=kind;s.ownerKinds[typeOwner(FRUIT_TYPES.find(t=>t.id===kind))]=kind;getSettings().fruitTypography=s;saveSettings();}
    const dialog=document.createElement('dialog');dialog.className='bl-ft-dialog';dialog.setAttribute('aria-label','블루레몬에이드 상태창 글자 설정');
    // 머리 한 줄: 제목 · 닫기
    const head=document.createElement('div');head.className='bl-ft-dialog-head';head.innerHTML='<b>상태창 글자</b><button type="button" class="salty-btn">닫기</button>';const close=head.lastElementChild;close.addEventListener('click',()=>dialog.close());
    const content=document.createElement('div');content.innerHTML=fruitTypographyMarkup(typeOwner(FRUIT_TYPES.find(t=>t.id===s.kind)||{}));dialog.append(head,content);document.body.append(dialog);bindTouchSliders(dialog);const cleanup=bindFruitTypography(content);
    dialog.addEventListener('close',()=>{cleanup();dialog.remove();},{once:true});dialog.showModal();close.focus();
}
