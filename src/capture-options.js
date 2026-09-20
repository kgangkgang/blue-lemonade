import { toolSection, bindAddonLayout } from './addon-layout.js';
import { MASK_DEFAULTS, MASK_RANGES, maskProfile } from './capture-style.js';
import { paintMasks } from './capture-privacy.js';
import { getSettings, saveSettings } from './settings.js';
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const styles=[['auto','테마에 맞춘 네모'],['white','흰 네모'],['black','검정 네모'],['mosaic','모자이크 블록'],['tape','마스킹 테이프']];
let radioGroup=0;
export function captureOptionsMarkup() {
    const s=getSettings(),cfg=s.captureTools,group=`bl-mask-style-${++radioGroup}`;
    const toggle=(key,label)=>`<label class="bl-addon-toggle"><input type="checkbox" data-capture-option="${key}" ${cfg[key]!==false?'checked':''}><span>${label}</span></label>`;
    const format=`<div class="bl-tool-grid"><label class="bl-tool-field">파일 종류<select data-capture-option="format"><option value="image" ${cfg.format!=='video'?'selected':''}>이미지 (PNG)</option><option value="video" ${cfg.format==='video'?'selected':''}>영상 (MP4 / WebM)</option></select></label><label class="bl-tool-field" data-video-option>영상 길이 · 초<input type="number" min="3" max="30" data-capture-option="duration" value="${cfg.duration||6}"><small>3~30초</small></label>${toggle('includeWeather','날씨 효과 포함')}<div data-video-option>${toggle('includeBackground','배경 이미지·영상')}</div><label class="bl-tool-field" data-video-option>배경 테마색 · %<input type="number" min="0" max="100" data-capture-option="backgroundTint" value="${cfg.backgroundTint??60}"><small>0~100%</small></label></div><p class="salty-note" data-video-option>최대 1080 × 1920 · 무음. 저장 중에는 이 탭을 열어 두세요.</p>`;
    const display=`<div class="bl-tool-grid">${toggle('showName','캐릭터 이름')}${toggle('showAvatar','프로필 사진')}${toggle('showAssets','본문 에셋')}<button type="button" class="salty-btn" data-capture-text-only>글자만 남기기</button></div><p class="salty-note">지금 보이는 본문을 담아요. 번역문을 보고 있다면 번역문으로 저장돼요.</p>`;
    const privacy=`<div class="bl-tool-grid"><label class="bl-addon-toggle"><input type="checkbox" data-capture-option="replace" ${cfg.replace?'checked':''}><span>단어 치환 적용</span></label><label class="bl-addon-toggle"><input type="checkbox" data-capture-option="redact" ${cfg.redact?'checked':''}><span>이름 숨기기</span></label></div><label class="bl-tool-field" data-replace-options>치환 프리셋<select data-capture-option="preset"><option value="">현재 치환 규칙</option>${s.wordTools.presets.map(p=>`<option value="${esc(p.id)}" ${cfg.preset===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div data-redact-options><label class="bl-tool-caption">숨길 이름</label><div data-capture-names>${cfg.names.map((name,i)=>nameRow(name,i)).join('')}</div><button type="button" class="salty-btn" data-capture-add>＋ 이름 추가</button><p class="bl-tool-caption">가리는 방법</p><div class="bl-mask-options">${styles.map(([key,label])=>`<label><input type="radio" name="${group}" data-capture-option="mask" value="${key}" ${cfg.mask===key?'checked':''}><span class="bl-mask-sample" data-mask="${key}" aria-hidden="true"></span><span>${label}</span></label>`).join('')}</div><div class="bl-mask-customize" data-mask-customize>${maskControls(cfg)}</div><p class="salty-note">이미지 속 이름은 자동으로 찾지 않아요. 저장 전 미리보기를 확인해 주세요.</p></div><p class="salty-note">이 캡처에만 적용해요. 원래 대화는 바뀌지 않아요.</p>`;
    return `<div class="bl-capture-options">${toolSection('format','저장 방식',format,true)}${toolSection('capture-display','표시할 항목',display,false,'이름·프로필·본문 에셋')}${toolSection('privacy','로그 공유·이름 가림',privacy,!!(cfg.redact||cfg.replace))}</div>`;
}
function maskControls(cfg){
    const p=maskProfile(cfg);
    const toggle=(key,label)=>`<label class="bl-addon-toggle"><input type="checkbox" data-mask-param="${key}" ${p[key]?'checked':''}><span>${label}</span></label>`;
    const color=(key,label)=>`<label class="bl-mask-color">${label}<input type="color" data-mask-param="${key}" value="${p[key]}"></label>`;
    const number=(key,label)=>`<label class="bl-mask-number"><span class="bl-mask-number-head"><span>${label}</span><input type="number" data-mask-param="${key}" min="${MASK_RANGES[key][0]}" max="${MASK_RANGES[key][1]}" step="1" value="${p[key]}" aria-label="${label} 숫자"></span><input type="range" data-mask-param="${key}" min="${MASK_RANGES[key][0]}" max="${MASK_RANGES[key][1]}" step="1" value="${p[key]}" style="--mask-fill:${(p[key]-MASK_RANGES[key][0])/(MASK_RANGES[key][1]-MASK_RANGES[key][0])*100}%" aria-label="${label}"></label>`;
    return `<div class="bl-mask-heading"><b>가림 모양 꾸미기</b><small>모양마다 따로 기억해요</small></div><canvas width="280" height="100" data-mask-preview aria-label="가림 모양 미리보기"></canvas><div class="bl-tool-grid">${toggle('customColor','직접 고른 색')}${color('color','가림 색')}${cfg.mask!=='tape'?number('radius','둥글기'):number('jaggedness','테이프 가장자리')}${number('padX','가로 여백')}${number('padY','세로 여백')}${number('tilt','기울기 (°)')}${cfg.mask==='mosaic'?number('blockSize','블록 크기'):''}</div><div class="bl-mask-detail"><div class="bl-tool-grid">${toggle('outline','외곽선')}${color('outlineColor','외곽선 색')}${number('outlineWidth','외곽선 두께')}</div></div><div class="bl-mask-detail"><div class="bl-tool-grid">${toggle('shadow','그림자')}${color('shadowColor','그림자 색')}${number('shadowOpacity','진하기 (%)')}${number('shadowBlur','흐림')}${number('shadowX','가로 위치')}${number('shadowY','세로 위치')}</div></div><button type="button" class="salty-btn" data-mask-reset>이 모양 초기화</button>`;
}

const nameRow=(name,i)=>`<div class="bl-name-row"><input type="text" data-capture-name="${i}" value="${esc(name)}" placeholder="숨길 이름" aria-label="숨길 이름 ${i+1}"><button type="button" data-capture-remove="${i}" aria-label="이름 ${i+1} 삭제">×</button></div>`;
export function bindCaptureOptions(root,changed=()=>{}) {
    const cfg=getSettings().captureTools;
    const names=root.querySelector('[data-capture-names]');if(!names)return;
    root.querySelector('[data-capture-text-only]').onclick=()=>{for(const key of ['showName','showAvatar','showAssets']){cfg[key]=false;root.querySelector(`[data-capture-option="${key}"]`).checked=false;}save();};
    const draw=()=>{const canvas=root.querySelector('[data-mask-preview]');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,280,100);paintMasks(ctx,[{x:80,y:34,w:120,h:28}],cfg.mask,document.body.classList.contains('salty-dark'),maskProfile(cfg));};
    const rebuild=()=>{root.querySelector('[data-mask-customize]').innerHTML=maskControls(cfg);draw();};
    const visibility=()=>{
        root.querySelectorAll('[data-video-option]').forEach(el=>el.hidden=cfg.format!=='video');
        root.querySelectorAll('[data-redact-options]').forEach(el=>el.hidden=!cfg.redact);
        root.querySelectorAll('[data-replace-options]').forEach(el=>el.hidden=!cfg.replace);
    };
    const save=()=>{visibility();saveSettings();changed();};
    visibility();
    root.addEventListener('input',event=>{
        const input=event.target,key=input.dataset.maskParam;if(!key||!Object.hasOwn(MASK_DEFAULTS,key))return;
        if(input.type==='number'&&(input.value===''||!input.validity.valid))return;
        const value=input.type==='checkbox'?input.checked:['range','number'].includes(input.type)?Number(input.value):input.value;
        cfg.maskStyles[cfg.mask][key]=value;
        root.querySelectorAll(`[data-mask-param="${key}"]`).forEach(other=>{if(other!==input){if(other.type==='checkbox')other.checked=value;else other.value=value;}if(other.type==='range')other.style.setProperty('--mask-fill',`${(value-Number(other.min))/(Number(other.max)-Number(other.min))*100}%`);});
        draw();save();
    });
    root.addEventListener('click',event=>{if(event.target.closest('[data-mask-reset]')){cfg.maskStyles[cfg.mask]={...MASK_DEFAULTS};rebuild();save();}});
    draw();
    root.querySelectorAll('[data-capture-option]').forEach(input=>input.addEventListener('change',()=>{
        cfg[input.dataset.captureOption]=input.type==='checkbox'?input.checked:input.value;if(input.dataset.captureOption==='mask')rebuild();save();
    }));
    names.addEventListener('input',event=>{const i=event.target.dataset.captureName;if(i!==undefined){cfg.names[Number(i)]=event.target.value;save();}});
    names.addEventListener('click',event=>{const i=event.target.closest('[data-capture-remove]')?.dataset.captureRemove;if(i!==undefined){cfg.names.splice(Number(i),1);names.innerHTML=cfg.names.map(nameRow).join('');save();}});
    root.querySelector('[data-capture-add]').addEventListener('click',()=>{
        if(cfg.names.length>=40)return;cfg.names.push('');names.insertAdjacentHTML('beforeend',nameRow('',cfg.names.length-1));names.lastElementChild.querySelector('input').focus();save();
    });
}
export function captureOptionsSnapshot() {
    const s=getSettings(),cfg=s.captureTools;
    const preset=s.wordTools.presets.find(p=>p.id===cfg.preset);
    if(cfg.replace&&cfg.preset&&!preset)throw Error('선택한 치환 프리셋이 없어요. 다시 선택해 주세요.');
    if(cfg.redact&&!cfg.names.some(n=>n.trim()))throw Error('숨길 이름을 하나 이상 입력해 주세요.');
    return structuredClone({...cfg,words:preset||s.wordTools});
}
export async function openCapturePreview(ids, mount = null, selectedIds = () => ids) {
    const {captureMessages}=await import('./chat-capture.js');
    const panel=mount?.closest('.salty-panel');panel?._captureCleanup?.();
    if(!mount)document.querySelector('.bl-capture-dialog')?.close();
    const dialog=mount||document.createElement('dialog');
    if(!mount)dialog.className='bl-capture-dialog';
    const preview=`<section class="bl-capture-preview"><p data-capture-progress role="status"></p><img alt="저장할 채팅 캡처 미리보기" hidden><video controls playsinline muted hidden aria-label="저장할 채팅 영상 미리보기"></video></section>`;
    const footer=`<footer class="bl-capture-stage-actions"><button type="button" class="salty-btn" data-capture-edit>캡처용 글 편집</button><button type="button" class="salty-btn" data-capture-render>미리보기 만들기</button><a class="salty-btn bl-tool-primary" data-capture-save download="blue-lemonade-chat.png" hidden>PNG 저장</a></footer>`;
    dialog.innerHTML=mount?preview+footer:`<header><h3>채팅 캡처 미리보기</h3><button type="button" data-capture-close aria-label="미리보기 닫기">×</button></header><div class="bl-capture-layout"><section>${captureOptionsMarkup()}</section>${preview}</div>${footer}`;
    if(!mount){document.body.append(dialog);dialog.showModal();}
    const alive=()=>mount?dialog.isConnected:dialog.open;
    let url='',revision=0,busy=false,edits=null,controller=null;
    const video=dialog.querySelector('video');
    const img=dialog.querySelector('img'),save=dialog.querySelector('[data-capture-save]'),status=dialog.querySelector('[data-capture-progress]'),render=dialog.querySelector('[data-capture-render]');
    const invalidate=()=>{revision++;controller?.abort();video.pause();video.hidden=true;save.hidden=true;save.removeAttribute('href');img.hidden=true;status.textContent='설정이 바뀌었어요. 미리보기를 다시 만들어 주세요.';};
    const settingsRoot=mount?.closest('.salty-sec');
    const cleanup=()=>{revision++;controller?.abort();video.pause();if(url){URL.revokeObjectURL(url);url='';}settingsRoot?.removeEventListener('bl:capture-options-changed',invalidate);settingsRoot?.removeEventListener('change',selectionChanged);};
    const selectionChanged=event=>{if(event.target.matches('[data-word-message]'))invalidate();};
    if(mount){panel._captureCleanup=cleanup;settingsRoot.addEventListener('bl:capture-options-changed',invalidate);settingsRoot.addEventListener('change',selectionChanged);}
    else{bindCaptureOptions(dialog,invalidate);bindAddonLayout(dialog);dialog.querySelector('[data-capture-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{cleanup();dialog.remove();},{once:true});}

    async function generate() {
        if(busy)return;busy=true;render.disabled=true;invalidate();const current=revision;controller=new AbortController();
        try {
            const captureIds=selectedIds();
            if(!captureIds.length)throw Error('메시지를 먼저 선택해 주세요.');
            const options={...captureOptionsSnapshot(),edits};
            const capture=options.format==='video'?(await import('./capture-video.js')).captureVideo:captureMessages;
            const result=await capture(captureIds,text=>{if(alive()&&revision===current)status.textContent=text;},options,controller.signal);
            if(!alive()||revision!==current)return;
            if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(result.blob);const media=result.format==='video'?video:img;media.src=url;media.hidden=false;save.href=url;save.download=`blue-lemonade-chat.${result.extension||'png'}`;save.textContent=`${(result.extension||'png').toUpperCase()} 저장`;save.hidden=false;
            status.textContent=`${result.width} × ${result.height} · 치환 ${result.replaced}곳 · 이름 ${result.hidden}곳 가림${result.weather?' · 날씨 포함':''}`;
            render.textContent='미리보기 다시 만들기';
        } catch(error){if(alive()&&revision===current)status.textContent=error.message||'미리보기를 만들지 못했어요.';}
        finally{busy=false;render.disabled=false;}
    }
    dialog.querySelector('[data-capture-edit]').onclick=async()=>{try{const result=await(await import('./capture-editor.js')).editCaptureDraft(selectedIds(),edits);if(result){edits=result.draft;invalidate();}}catch(error){status.textContent=error.message;}};
    render.onclick=generate;
    await generate();
}
