import { CAPTURE_INFO_KEYS } from './capture-layout.js';
import { createCaptureResources } from './capture-resources.js';
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
    const PRESET_NAMES=(cfg.capturePresets||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    const presetBar=`<div class="bl-capture-presets"><label class="bl-tool-field">캡처 프리셋<select data-capture-preset><option value="">고르면 바로 적용돼요</option><optgroup label="기본"><option value="builtin:gall">갤용 움짤 · WebP 8MB 6초 · 날씨 끔</option><option value="builtin:sharp">선명한 움짤 · APNG 6초</option><option value="builtin:video">고화질 영상 · 1440px</option><option value="builtin:image">이미지 · PNG</option></optgroup>${PRESET_NAMES?`<optgroup label="내 프리셋">${PRESET_NAMES}</optgroup>`:''}</select></label><div class="bl-word-actions"><button type="button" class="salty-btn" data-capture-preset-save>지금 설정 저장</button><button type="button" class="salty-btn" data-capture-preset-delete>고른 프리셋 삭제</button></div></div>`;
    const format=presetBar+`<div class="bl-tool-grid"><label class="bl-tool-field">파일 종류<select data-capture-option="format"><option value="image" ${cfg.format==='image'?'selected':''}>이미지 (PNG)</option><option value="video" ${cfg.format==='video'?'selected':''}>영상 (MP4 / WebM)</option><option value="gif" ${cfg.format==='gif'?'selected':''}>움짤 (GIF)</option><option value="apng" ${cfg.format==='apng'?'selected':''}>움짤 (APNG · 색 그대로)</option><option value="webp" ${cfg.format==='webp'?'selected':''}>움짤 (WebP · 가볍게)</option></select></label><label class="bl-tool-field" data-video-option>재생 시간 · 초<input type="number" min="3" max="30" data-capture-option="duration" value="${cfg.duration||6}"><small>3~30초</small></label><label class="bl-tool-field" data-resolution-option>영상 해상도<select data-capture-option="resolution"><option value="1080" ${Number(cfg.resolution)!==1440?'selected':''}>고화질 · 1080px</option><option value="1440" ${Number(cfg.resolution)===1440?'selected':''}>더 선명하게 · 1440px</option></select></label><label class="bl-tool-field" data-limit-option>최대 용량 · MB<input type="number" min="0" max="200" step="0.5" data-capture-option="maxMB" value="${cfg.maxMB??8}"><small>올릴 곳의 한도 · 0 = 제한 없음. 넘으면 화질 → 크기 → 초당 장수를 낮춰 맞춰요</small></label><label class="bl-tool-field" data-video-option>파일당 최대 문단 수<input type="number" min="1" max="20" data-capture-option="maxParagraphs" value="${cfg.maxParagraphs||4}"><small>1~20 · 화면 높이를 넘으면 더 나눠요</small></label>${toggle('includeWeather','날씨 효과 포함')}<div data-video-option>${toggle('includeBackground','배경 이미지·영상')}</div><label class="bl-tool-field" data-video-option>배경 테마색 · %<input type="number" min="0" max="100" data-capture-option="backgroundTint" value="${cfg.backgroundTint??60}"><small>0~100%</small></label></div><p class="salty-note" data-video-option>화면은 넘어가지 않지만, 채팅에서 움직이던 글자(감정 대사 등)는 영상·움짤에서도 움직여요. 긴 글은 문단·줄 경계에서 여러 파일로 나누고, 이미지가 크면 한 화면 안에 맞춰요. 전체 파일은 ZIP으로 한 번에 저장해요. 영상 30fps · GIF 720px/10fps/256색 · APNG 는 색을 줄이지 않고 · WebP 는 가볍게 (둘 다 720px/10fps, 달라진 곳만 담아요) · 무음. 저장 중에는 이 탭을 열어 두세요.</p>`;
    const display=`<label class="bl-tool-field">정보 표시<select data-capture-info><option value="custom">직접 선택</option><option value="body">본문만</option><option value="all">전체 정보</option></select></label><div class="bl-tool-grid">${toggle('showName','봇·사용자 이름')}${toggle('showAvatar','프로필 사진')}${toggle('showTimestamp','날짜·시간')}${toggle('showModel','모델 표시')}${toggle('showMessageId','채팅 번호')}${toggle('showTokens','토큰 수')}${toggle('showGenerationTime','생성 소요 시간')}${toggle('showAssets','본문 에셋')}<button type="button" class="salty-btn" data-capture-text-only>에셋도 빼고 글자만</button></div><p class="salty-note">본문만은 이름·사진·날짜·모델·번호·토큰·생성 시간을 숨겨요. 에셋은 따로 고를 수 있어요. 현재 보는 번역문 또는 원문을 담아요.</p>`;
    const privacy=`<div class="bl-tool-grid"><label class="bl-addon-toggle"><input type="checkbox" data-capture-option="replace" ${cfg.replace?'checked':''}><span>단어 치환 적용</span></label><label class="bl-addon-toggle"><input type="checkbox" data-capture-option="redact" ${cfg.redact?'checked':''}><span>이름 숨기기</span></label></div><label class="bl-tool-field" data-replace-options>치환 프리셋<select data-capture-option="preset"><option value="">현재 치환 규칙</option>${s.wordTools.presets.map(p=>`<option value="${esc(p.id)}" ${cfg.preset===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div data-redact-options><label class="bl-tool-caption">숨길 이름</label><div data-capture-names>${cfg.names.map((name,i)=>nameRow(name,i)).join('')}</div><button type="button" class="salty-btn" data-capture-add>＋ 이름 추가</button><p class="bl-tool-caption">가리는 방법</p><div class="bl-mask-options">${styles.map(([key,label])=>`<label><input type="radio" name="${group}" data-capture-option="mask" value="${key}" ${cfg.mask===key?'checked':''}><span class="bl-mask-sample" data-mask="${key}" aria-hidden="true"></span><span>${label}</span></label>`).join('')}</div><div class="bl-mask-customize" data-mask-customize>${maskControls(cfg)}</div><p class="salty-note">이미지 속 이름은 자동으로 찾지 않아요. 저장 전 미리보기를 확인해 주세요.</p></div><p class="salty-note">이 캡처에만 적용해요. 원래 대화는 바뀌지 않아요.</p>`;
    return `<div class="bl-capture-options">${toolSection('format','저장 방식',format,true)}${toolSection('capture-display','표시할 항목',display,false,'본문만·전체 정보·직접 선택')}${toolSection('privacy','로그 공유·이름 가림',privacy,!!(cfg.redact||cfg.replace))}</div>`;
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
    const setInfo=on=>{for(const key of CAPTURE_INFO_KEYS){cfg[key]=on;root.querySelector(`[data-capture-option="${key}"]`).checked=on;}};
    const info=root.querySelector('[data-capture-info]');
    const syncInfo=()=>{info.value=CAPTURE_INFO_KEYS.every(key=>cfg[key]===false)?'body':CAPTURE_INFO_KEYS.every(key=>cfg[key]!==false)?'all':'custom';};
    info.onchange=()=>{if(info.value==='custom')return;setInfo(info.value==='all');save();};
    root.querySelector('[data-capture-text-only]').onclick=()=>{setInfo(false);cfg.showAssets=false;root.querySelector('[data-capture-option="showAssets"]').checked=false;save();};
    const draw=()=>{const canvas=root.querySelector('[data-mask-preview]');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,280,100);paintMasks(ctx,[{x:80,y:34,w:120,h:28}],cfg.mask,document.body.classList.contains('salty-dark'),maskProfile(cfg));};
    const rebuild=()=>{root.querySelector('[data-mask-customize]').innerHTML=maskControls(cfg);draw();};
    const visibility=()=>{
        root.querySelectorAll('[data-video-option]').forEach(el=>el.hidden=!['video','gif','apng','webp'].includes(cfg.format));
        root.querySelectorAll('[data-resolution-option]').forEach(el=>el.hidden=cfg.format!=='video');
        root.querySelectorAll('[data-limit-option]').forEach(el=>el.hidden=!['apng','webp'].includes(cfg.format));
        root.querySelectorAll('[data-redact-options]').forEach(el=>el.hidden=!cfg.redact);
        root.querySelectorAll('[data-replace-options]').forEach(el=>el.hidden=!cfg.replace);
    };
    const save=()=>{syncInfo();visibility();saveSettings();changed();};
    bindCapturePresets(root,cfg,values=>{
        for(const [key,value] of Object.entries(values)){if(!PRESET_KEYS.includes(key))continue;cfg[key]=value;const input=root.querySelector(`[data-capture-option="${key}"]`);if(input){if(input.type==='checkbox')input.checked=value!==false;else input.value=String(value);}}
        save();
    });
    syncInfo();
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
    root.querySelectorAll('[data-capture-option]').forEach(input=>{
        const commit=()=>{
            if(input.type==='number'&&(!input.value||!input.validity.valid))return;
            const key=input.dataset.captureOption,value=input.type==='checkbox'?input.checked:input.value;
            if(String(cfg[key])===String(value))return;
            cfg[key]=value;if(key==='mask')rebuild();save();
        };
        input.addEventListener('change',commit);
        // Invalidate generated files while typing too, before focus leaves the field.
        if(input.type==='number')input.addEventListener('input',commit);
    });
    names.addEventListener('input',event=>{const i=event.target.dataset.captureName;if(i!==undefined){cfg.names[Number(i)]=event.target.value;save();}});
    names.addEventListener('click',event=>{const i=event.target.closest('[data-capture-remove]')?.dataset.captureRemove;if(i!==undefined){cfg.names.splice(Number(i),1);names.innerHTML=cfg.names.map(nameRow).join('');save();}});
    root.querySelector('[data-capture-add]').addEventListener('click',()=>{
        if(cfg.names.length>=40)return;cfg.names.push('');names.insertAdjacentHTML('beforeend',nameRow('',cfg.names.length-1));names.lastElementChild.querySelector('input').focus();save();
    });
}
// 캡처 프리셋: 저장 방식 · 표시할 항목 값만 담는다 (이름 가림 · 치환은 채팅마다 달라 안 담음)
const PRESET_KEYS=['format','duration','maxMB','maxParagraphs','resolution','backgroundTint','includeWeather','includeBackground',...CAPTURE_INFO_KEYS,'showAssets'];
const BUILTIN_PRESETS={
    'builtin:gall':{format:'webp',duration:6,maxMB:8,maxParagraphs:4,includeWeather:false,includeBackground:true},
    'builtin:sharp':{format:'apng',duration:6,maxMB:0,maxParagraphs:4,includeWeather:false,includeBackground:true},
    'builtin:video':{format:'video',duration:8,resolution:1440,maxParagraphs:4},
    'builtin:image':{format:'image'},
};
function bindCapturePresets(root,cfg,apply){
    const select=root.querySelector('[data-capture-preset]');if(!select)return;
    const list=()=>(Array.isArray(cfg.capturePresets)?cfg.capturePresets:(cfg.capturePresets=[]));
    const redraw=()=>{const mine=select.querySelector('optgroup[label="내 프리셋"]');const html=list().map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');if(mine)mine.innerHTML=html;else if(html)select.insertAdjacentHTML('beforeend',`<optgroup label="내 프리셋">${html}</optgroup>`);};
    select.onchange=()=>{const values=BUILTIN_PRESETS[select.value]||list().find(p=>p.id===select.value)?.values;if(values)apply(values);};
    root.querySelector('[data-capture-preset-save]').onclick=()=>{
        if(list().length>=12){globalThis.toastr?.info('프리셋은 12개까지 저장돼요.','Blue Lemonade');return;}
        const name=(globalThis.prompt?.('프리셋 이름',`내 프리셋 ${list().length+1}`)||'').trim().slice(0,30);if(!name)return;
        const id=`p${Date.now().toString(36)}`;list().push({id,name,values:Object.fromEntries(PRESET_KEYS.filter(k=>cfg[k]!==undefined).map(k=>[k,cfg[k]]))});
        saveSettings();redraw();select.value=id;
    };
    root.querySelector('[data-capture-preset-delete]').onclick=()=>{const i=list().findIndex(p=>p.id===select.value);if(i<0){globalThis.toastr?.info('내 프리셋을 먼저 골라 주세요. 기본 프리셋은 지울 수 없어요.','Blue Lemonade');return;}list().splice(i,1);saveSettings();redraw();select.value='';};
}
export function captureOptionsSnapshot() {
    const s=getSettings(),cfg=s.captureTools;
    const preset=s.wordTools.presets.find(p=>p.id===cfg.preset);
    if(cfg.replace&&cfg.preset&&!preset)throw Error('선택한 치환 프리셋이 없어요. 다시 선택해 주세요.');
    if(cfg.redact&&!cfg.names.some(n=>n.trim()))throw Error('숨길 이름을 하나 이상 입력해 주세요.');
    return structuredClone({...cfg,words:preset||s.wordTools});
}
// 캡처 창을 닫았다 다시 열어도(배경을 바꾸러 다녀와도) 만든 파일과 캡처용 글 편집이 남는다 — 같은 채팅인 동안, '지우기'를 누르기 전까지.
const kept={chat:null,edits:null,files:null,archive:null};
const keptFor=()=>{const chat=SillyTavern.getContext().chatId;if(kept.chat!==chat){kept.chat=chat;kept.edits=null;kept.files=null;kept.archive=null;}return kept;};
export async function openCapturePreview(ids, mount = null, selectedIds = () => ids) {
    const {captureMessages}=await import('./chat-capture.js');
    const panel=mount?.closest('.salty-panel');panel?._captureCleanup?.();
    if(!mount)document.querySelector('.bl-capture-dialog')?.close();
    const dialog=mount||document.createElement('dialog');
    if(!mount)dialog.className='bl-capture-dialog';
    const preview=`<section class="bl-capture-preview"><p data-capture-progress role="status"></p><label class="bl-tool-field" data-capture-parts hidden>파일 미리보기<select data-capture-part></select></label><img alt="저장할 채팅 캡처 미리보기" hidden><video controls playsinline muted hidden aria-label="저장할 채팅 영상 미리보기"></video></section>`;
    const footer=`<footer class="bl-capture-stage-actions"><button type="button" class="salty-btn" data-capture-edit>캡처용 글 편집</button><button type="button" class="salty-btn" data-capture-quick>빠른 미리보기</button><button type="button" class="salty-btn" data-capture-render>파일 만들기</button><button type="button" class="salty-btn" data-capture-clear hidden>지우기</button><a class="salty-btn bl-tool-primary" data-capture-save download hidden>이 파일 저장</a><a class="salty-btn bl-tool-primary" data-capture-zip download="blue-lemonade-chat.zip" hidden>전체 파일 ZIP 저장</a></footer>`;
    dialog.innerHTML=mount?preview+footer:`<header><h3>채팅 캡처 미리보기</h3><button type="button" data-capture-close aria-label="미리보기 닫기">×</button></header><div class="bl-capture-layout"><section>${captureOptionsMarkup()}</section>${preview}</div>${footer}`;
    if(!mount){document.body.append(dialog);dialog.showModal();}
    const alive=()=>mount?dialog.isConnected:dialog.open;
    const memory=keptFor();
    let revision=0,busy=false,edits=memory.edits,controller=null,outputs=[],zipURL='',stale=false;
    const video=dialog.querySelector('video'),img=dialog.querySelector('img'),save=dialog.querySelector('[data-capture-save]'),zip=dialog.querySelector('[data-capture-zip]'),status=dialog.querySelector('[data-capture-progress]'),render=dialog.querySelector('[data-capture-render]'),part=dialog.querySelector('[data-capture-part]');
    const release=()=>{video.pause();video.removeAttribute('src');video.load();img.removeAttribute('src');for(const item of outputs)URL.revokeObjectURL(item.url);outputs=[];if(zipURL)URL.revokeObjectURL(zipURL);zipURL='';};
    const clearButton=dialog.querySelector('[data-capture-clear]'),quick=dialog.querySelector('[data-capture-quick]');
    const wipe=()=>{release();video.hidden=img.hidden=save.hidden=zip.hidden=true;save.removeAttribute('href');zip.removeAttribute('href');dialog.querySelector('[data-capture-parts]').hidden=true;};
    // 설정 · 선택이 바뀌어도 만들어 둔 파일은 지우지 않는다 — '바꾸기 전 파일'이라고만 알리고, 다시 만들면 그때 바뀐다
    const invalidate=()=>{revision++;controller?.abort();if(outputs.length&&outputs[0].kept){stale=true;show();}else{wipe();status.textContent='설정이 바뀌었어요. 빠른 미리보기나 파일 만들기를 눌러 주세요.';}};
    const settingsRoot=mount?.closest('.salty-sec');
    const cleanup=()=>{revision++;controller?.abort();release();/* kept 는 남긴다 */settingsRoot?.removeEventListener('bl:capture-options-changed',invalidate);settingsRoot?.removeEventListener('change',selectionChanged);};
    const selectionChanged=event=>{if(event.target.matches('[data-word-message]'))invalidate();};
    if(mount){panel._captureCleanup=cleanup;settingsRoot.addEventListener('bl:capture-options-changed',invalidate);settingsRoot.addEventListener('change',selectionChanged);}
    else{bindCaptureOptions(dialog,invalidate);bindAddonLayout(dialog);dialog.querySelector('[data-capture-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{cleanup();dialog.remove();},{once:true});}
    const show=()=>{
        const item=outputs[Number(part.value)||0];if(!item)return;video.pause();video.hidden=img.hidden=true;
        const media=item.result.format==='video'?video:img;media.src=item.url;media.hidden=false;save.href=item.url;save.download=item.name;save.textContent=`${(item.result.extension||'png').toUpperCase()} ${outputs.length>1?'이 파일 ':''}저장`;save.hidden=!!item.quick;
        clearButton.hidden=!(memory.files?.length||memory.edits);
        const r=item.result,mb=n=>n>=1048576?`${(n/1048576).toFixed(n>=10485760?1:2)}MB`:`${Math.max(1,Math.round(n/1024))}KB`,total=outputs.reduce((sum,o)=>sum+o.blob.size,0),limit=['apng','webp'].includes(r.format)?(Number(getSettings().captureTools.maxMB)||0)*1048576:0;
        const fit=r.fitted?(r.fitted.overLimit?' · 한도를 못 맞췄어요 — 재생 시간이나 문단 수를 줄여 주세요':r.fitted.step?` · 용량에 맞춰 ${r.fitted.scale<1?'크기 '+Math.round(r.fitted.scale*100)+'% · ':''}${r.fitted.quality<1?'화질 '+Math.round(r.fitted.quality*100)+' · ':''}초당 ${r.fitted.fps}장`:''):'';
        status.textContent=`${item.quick?'빠른 미리보기(저장용 아님) · ':stale?'설정을 바꾸기 전에 만든 파일 · ':''}${outputs.length>1?`${Number(part.value)+1} / ${outputs.length} 파일 · `:''}${mb(item.blob.size)}${outputs.length>1?` (전체 ${mb(total)})`:''}${limit&&item.blob.size>limit?' ⚠ 한도 초과':''}${fit} · ${r.width} × ${r.height} · 치환 ${r.replaced}곳 · 이름 ${r.hidden}곳 가림${r.weather?' · 날씨 포함':''}${r.duration?' · '+r.duration+'초 · 고정 화면':''}`;
    };
    part.onchange=show;
    async function generate(){
        if(busy)return;busy=true;render.disabled=quick.disabled=true;revision++;controller?.abort();wipe();stale=false;const current=revision;controller=new AbortController();const signal=controller.signal;
        const resources=createCaptureResources();
        try{
            const captureIds=selectedIds();if(!captureIds.length)throw Error('메시지를 먼저 선택해 주세요.');
            const options={...captureOptionsSnapshot(),edits,resources},motion=['video','gif','apng','webp'].includes(options.format);
            const sources=captureIds.map(id=>document.querySelector(`#chat .mes[mesid="${Number(id)}"]`));
            const markup=sources.map(el=>el?.innerHTML);
            const stable=()=>{if(sources.some((el,i)=>!el?.isConnected||el.innerHTML!==markup[i]))throw Error('저장 중 메시지가 바뀌었어요. 답변·번역이 끝난 뒤 다시 만들어 주세요.');};
            const progress=text=>{if(alive()&&revision===current)status.textContent=text;};
            const plan=motion?await captureMessages(captureIds,progress,{...options,videoLayer:true,planOnly:true},signal):{pages:[{}]};
            const capture=options.format==='video'?(await import('./capture-video.js')).captureVideo:options.format==='gif'?(await import('./capture-gif.js')).captureGif:['apng','webp'].includes(options.format)?(await import('./capture-anim.js')).captureAnimated:captureMessages;
            const pending=[];let bytes=0;
            for(let i=0;i<plan.pages.length;i++){
                stable();
                const result=await capture(captureIds,text=>progress(`${i+1} / ${plan.pages.length} 파일 · ${text}`),{...options,pageIndex:i},signal);
                stable();
                signal.throwIfAborted();if(!alive()||revision!==current)return;
                bytes+=result.blob.size;if(bytes>200*1024*1024)throw Error('전체 파일이 200MB를 넘어요. 선택한 메시지나 재생 시간을 줄여 주세요.');
                const name=`blue-lemonade-chat${plan.pages.length>1?'-'+String(i+1).padStart(2,'0'):''}.${result.extension||'png'}`;pending.push({result,name,blob:result.blob});
            }
            let archive=null;if(pending.length>1){progress('전체 파일 ZIP 묶는 중…');archive=await(await import('./capture-archive.js')).captureArchive(pending,signal);}
            signal.throwIfAborted();if(!alive()||revision!==current)return;
            outputs=pending.map(item=>({...item,kept:true,url:URL.createObjectURL(item.blob)}));
            memory.files=pending.map(item=>({...item,kept:true}));memory.archive=archive;
            part.innerHTML=outputs.map((item,i)=>`<option value="${i}">${i+1} / ${outputs.length} · ${item.result.width} × ${item.result.height}</option>`).join('');part.value='0';dialog.querySelector('[data-capture-parts]').hidden=outputs.length<2;
            if(archive){zipURL=URL.createObjectURL(archive);zip.href=zipURL;zip.hidden=false;}
            show();render.textContent='파일 다시 만들기';
        }catch(error){if(alive()&&revision===current)status.textContent=error.message||'미리보기를 만들지 못했어요.';}
        finally{resources.close();busy=false;render.disabled=quick.disabled=false;}
    }
    // 빠른 미리보기: 굽지 않고 첫 화면만 멈춘 그림으로 (움직임 · 날씨 · 나머지 파일은 '파일 만들기'에서). 저장용이 아니다
    async function quickLook(){
        if(busy)return;busy=true;render.disabled=quick.disabled=true;revision++;controller?.abort();const current=revision;controller=new AbortController();const signal=controller.signal;
        const resources=createCaptureResources();
        try{
            const captureIds=selectedIds();if(!captureIds.length)throw Error('메시지를 먼저 선택해 주세요.');
            const options={...captureOptionsSnapshot(),edits,resources},motion=['video','gif','apng','webp'].includes(options.format);
            status.textContent='빠른 미리보기 만드는 중…';
            const result=await captureMessages(captureIds,()=>{},{...options,includeWeather:false,videoLayer:motion,pageIndex:0,animateText:false,maxScale:1.5},signal);
            signal.throwIfAborted();if(!alive()||revision!==current)return;
            wipe();stale=false;
            outputs=[{result:{...result,format:'image',extension:'png'},name:'preview.png',blob:result.blob,quick:true,url:URL.createObjectURL(result.blob)}];
            show();
            if(motion||(result.pageCount||1)>1)status.textContent+=` · 첫 화면만${motion?' · 움직임 · 날씨는 파일 만들기에서':''}`;
        }catch(error){if(alive()&&revision===current)status.textContent=error.message||'미리보기를 만들지 못했어요.';}
        finally{resources.close();busy=false;render.disabled=quick.disabled=false;}
    }
    quick.onclick=quickLook;
    clearButton.onclick=()=>{revision++;controller?.abort();memory.files=null;memory.archive=null;memory.edits=null;edits=null;stale=false;wipe();clearButton.hidden=true;status.textContent='만든 파일과 캡처용 글 편집을 지웠어요.';};
    dialog.querySelector('[data-capture-edit]').onclick=async()=>{try{const result=await(await import('./capture-editor.js')).editCaptureDraft(selectedIds(),edits);if(result){edits=result.draft;memory.edits=edits;clearButton.hidden=!(memory.files?.length||memory.edits);invalidate();}}catch(error){status.textContent=error.message;}};
    render.onclick=generate;
    // 열 때: 만들어 둔 파일이 있으면 그대로 보여 주고, 없으면 굽지 않고 빠른 미리보기만
    if(memory.files?.length){
        outputs=memory.files.map(item=>({...item,url:URL.createObjectURL(item.blob)}));
        part.innerHTML=outputs.map((item,i)=>`<option value="${i}">${i+1} / ${outputs.length} · ${item.result.width} × ${item.result.height}</option>`).join('');part.value='0';dialog.querySelector('[data-capture-parts]').hidden=outputs.length<2;
        if(memory.archive){zipURL=URL.createObjectURL(memory.archive);zip.href=zipURL;zip.hidden=false;}
        show();render.textContent='파일 다시 만들기';
    }else{clearButton.hidden=!memory.edits;await quickLook();}
}
