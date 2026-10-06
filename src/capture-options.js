import { showThemeModal } from './modal.js';
import { CAPTURE_INFO_KEYS } from './capture-layout.js';
import { createCaptureResources } from './capture-resources.js';
import { toolSection, bindAddonLayout } from './addon-layout.js';
import { MASK_DEFAULTS, MASK_RANGES, maskProfile, FILTER_KEYS, FILTER_RANGES, FILTER_PRESETS, filterValue } from './capture-style.js';
import { paintMasks } from './capture-privacy.js';
import { getSettings, saveSettings } from './settings.js';
// 5.6.4: 움직이는 캡처 동안 화면 밖 감정 대사 멈춤을 푼다 (dem-expressive.js — 효과를 켰을 때만 불러오는 모듈이라 신호로)
const holdFx = on => document.dispatchEvent(new CustomEvent('bl:fx-hold', { detail: on }));
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const styles=[['auto','테마에 맞춘 네모'],['white','흰 네모'],['black','검정 네모'],['mosaic','모자이크 블록'],['tape','마스킹 테이프']];
// 5.5.3 캡처 필터: 프리셋 하나 + 슬라이더 여섯 (값은 captureTools 에 숫자로 · 슬라이더를 만지면 프리셋은 '직접')
const FILTER_PRESET_NAMES=[['none','없음'],['mono','흑백'],['film','필름'],['vintage','빈티지'],['cool','차갑게'],['warm','따뜻하게'],['custom','직접']];
const FILTER_LABELS={grain:'필름 그레인',brightness:'밝기',contrast:'대비',saturation:'채도',temperature:'색온도',vignette:'비네트'};
// 채움은 0(중립) 자리에서 값까지 — 양방향(밝기 · 대비 · 채도 · 색온도)은 가운데에서, 그레인 · 비네트는 왼쪽 끝에서. 0 이면 트랙이 비어 보인다
const filterFill=(key,value)=>{const [min,max]=FILTER_RANGES[key],at=v=>(Math.min(max,Math.max(min,v))-min)/(max-min)*100,zero=at(0),here=at(value);return {a:`${Math.min(zero,here)}%`,b:`${Math.max(zero,here)}%`};};
const fillStyle=(key,value)=>{const f=filterFill(key,value);return `--fill-a:${f.a};--fill-b:${f.b}`;};
const filterActive=cfg=>FILTER_KEYS.some(key=>filterValue(cfg,key)!==0);
const NEUTRAL_FILTER=Object.fromEntries([...FILTER_KEYS.map(key=>[key,0]),['filterPreset','none']]);
let radioGroup=0;
export function captureOptionsMarkup() {
    const s=getSettings(),cfg=s.captureTools,group=`bl-mask-style-${++radioGroup}`;
    const toggle=(key,label)=>`<label class="bl-addon-toggle"><input type="checkbox" data-capture-option="${key}" ${cfg[key]!==false?'checked':''}><span>${label}</span></label>`;
    const PRESET_NAMES=(cfg.capturePresets||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    const presetBar=`<div class="bl-capture-presets"><label class="bl-tool-field">캡처 프리셋<select data-capture-preset><option value="">고르면 바로 적용돼요</option><optgroup label="기본"><option value="builtin:gall">움짤 · WebP 8MB 6초 · 날씨 켬</option><option value="builtin:sharp">선명한 움짤 · APNG 6초</option><option value="builtin:video">고화질 영상 · 1440px</option><option value="builtin:image">이미지 · PNG</option></optgroup>${PRESET_NAMES?`<optgroup label="내 프리셋">${PRESET_NAMES}</optgroup>`:''}</select></label><div class="bl-word-actions"><button type="button" class="salty-btn" data-capture-preset-save>지금 설정 저장</button><button type="button" class="salty-btn" data-capture-preset-delete>고른 프리셋 삭제</button></div></div>`;
    const format=presetBar+`<div class="bl-tool-grid"><label class="bl-tool-field">파일 종류<select data-capture-option="format"><option value="image" ${cfg.format==='image'?'selected':''}>이미지 (PNG)</option><option value="video" ${cfg.format==='video'?'selected':''}>영상 (MP4 / WebM)</option><option value="gif" ${cfg.format==='gif'?'selected':''}>움짤 (GIF)</option><option value="apng" ${cfg.format==='apng'?'selected':''}>움짤 (APNG · 색 그대로)</option><option value="webp" ${cfg.format==='webp'?'selected':''}>움짤 (WebP · 가볍게)</option></select></label><label class="bl-tool-field" data-video-option>재생 시간 · 초<input type="number" min="3" max="30" data-capture-option="duration" value="${cfg.duration||6}"><small>3~30초</small></label><label class="bl-tool-field" data-resolution-option>영상 해상도<select data-capture-option="resolution"><option value="1080" ${Number(cfg.resolution)!==1440?'selected':''}>고화질 · 1080px</option><option value="1440" ${Number(cfg.resolution)===1440?'selected':''}>더 선명하게 · 1440px</option></select></label><label class="bl-tool-field" data-limit-option>최대 용량 · MB<input type="number" min="0" max="200" step="0.5" data-capture-option="maxMB" value="${cfg.maxMB??8}"><small>올릴 곳의 한도 · 0 = 제한 없음. 넘으면 화질 → 크기 → 초당 장수를 낮춰 맞춰요</small></label><label class="bl-tool-field" data-video-option>파일당 최대 문단 수<input type="number" min="1" max="20" data-capture-option="maxParagraphs" value="${cfg.maxParagraphs||4}"><small>1~20 · 화면 높이를 넘으면 더 나눠요</small></label>${toggle('includeWeather','날씨 효과 포함')}<div data-video-option>${toggle('includeBackground','배경 이미지·영상')}</div><label class="bl-tool-field" data-video-option>배경 테마색 · %<input type="number" min="0" max="100" data-capture-option="backgroundTint" value="${cfg.backgroundTint??60}"><small>0~100%</small></label></div><p class="salty-note" data-video-option>화면은 넘어가지 않지만, 채팅에서 움직이던 글자(감정 대사 등)는 영상·움짤에서도 움직여요. 긴 글은 문단·줄 경계에서 여러 파일로 나누고, 이미지가 크면 한 화면 안에 맞춰요. 전체 파일은 ZIP으로 한 번에 저장해요. 영상 30fps · GIF 720px/10fps/256색 · APNG 는 색을 줄이지 않고 · WebP 는 가볍게 (둘 다 720px/10fps, 달라진 곳만 담아요) · 무음. 저장 중에는 이 탭을 열어 두세요.</p>`;
    const display=`<label class="bl-tool-field">정보 표시<select data-capture-info><option value="custom">직접 선택</option><option value="body">본문만</option><option value="all">전체 정보</option></select></label><div class="bl-tool-grid">${toggle('showName','봇·사용자 이름')}${toggle('showAvatar','프로필 사진')}${toggle('showTimestamp','날짜·시간')}${toggle('showModel','모델 표시')}${toggle('showMessageId','채팅 번호')}${toggle('showTokens','토큰 수')}${toggle('showGenerationTime','생성 소요 시간')}${toggle('showAssets','본문 에셋')}<button type="button" class="salty-btn" data-capture-text-only>에셋도 빼고 글자만</button></div><p class="salty-note">본문만은 이름·사진·날짜·모델·번호·토큰·생성 시간을 숨겨요. 에셋은 따로 고를 수 있어요. 현재 보는 번역문 또는 원문을 담아요.</p>`;
    const privacy=`<div class="bl-tool-grid"><label class="bl-addon-toggle"><input type="checkbox" data-capture-option="replace" ${cfg.replace?'checked':''}><span>단어 치환 적용</span></label><label class="bl-addon-toggle"><input type="checkbox" data-capture-option="redact" ${cfg.redact?'checked':''}><span>이름 숨기기</span></label></div><label class="bl-tool-field" data-replace-options>치환 프리셋<select data-capture-option="preset"><option value="">현재 치환 규칙</option>${s.wordTools.presets.map(p=>`<option value="${esc(p.id)}" ${cfg.preset===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div data-redact-options><label class="bl-tool-caption">숨길 이름</label><div data-capture-names>${cfg.names.map((name,i)=>nameRow(name,i)).join('')}</div><button type="button" class="salty-btn" data-capture-add>＋ 이름 추가</button><p class="bl-tool-caption">가리는 방법</p><div class="bl-mask-options">${styles.map(([key,label])=>`<label><input type="radio" name="${group}" data-capture-option="mask" value="${key}" ${cfg.mask===key?'checked':''}><span class="bl-mask-sample" data-mask="${key}" aria-hidden="true"></span><span>${label}</span></label>`).join('')}</div><div class="bl-mask-customize" data-mask-customize>${maskControls(cfg)}</div><p class="salty-note">이미지 속 이름은 자동으로 찾지 않아요. 저장 전 미리보기를 확인해 주세요.</p></div><p class="salty-note">이 캡처에만 적용해요. 원래 대화는 바뀌지 않아요.</p>`;
    return `<div class="bl-capture-options">${toolSection('format','저장 방식',format,true)}${toolSection('filter','필터',filterControls(cfg),filterActive(cfg),'그레인 · 흑백 · 색감')}${toolSection('capture-display','표시할 항목',display,false,'본문만·전체 정보·직접 선택')}${toolSection('privacy','로그 공유·이름 가림',privacy,!!(cfg.redact||cfg.replace))}</div>`;
}
function filterControls(cfg){
    const preset=FILTER_PRESET_NAMES.map(([key,label])=>`<option value="${key}" ${(cfg.filterPreset||'none')===key?'selected':''}>${label}</option>`).join('');
    const slider=key=>{const value=filterValue(cfg,key),[min,max]=FILTER_RANGES[key],label=FILTER_LABELS[key];return `<label class="bl-capture-filter-range"><span class="bl-capture-filter-head"><span>${label}</span><output data-filter-value="${key}">${value}</output></span><input type="range" data-capture-option="${key}" min="${min}" max="${max}" step="1" value="${value}" style="${fillStyle(key,value)}" aria-label="${label}"></label>`;};
    // 5.5.4 필터 미리보기: 한 열 화면(폰)에서는 미리보기가 슬라이더보다 한참 위라 끌면서 못 본다 → 이 칸 맨 위에 붙어 다니는 작은 미리보기 (빠른 미리보기가 있을 때만 · 두 열 화면은 CSS 로 숨김)
    return `<div class="bl-capture-filter-live" data-capture-filter-live hidden><canvas width="0" height="0" role="img" aria-label="필터 미리보기"></canvas></div><label class="bl-tool-field">프리셋<select data-capture-option="filterPreset">${preset}</select></label><div class="bl-tool-grid bl-capture-filter">${FILTER_KEYS.map(slider).join('')}</div><button type="button" class="salty-btn" data-capture-filter-reset>초기화</button>`;
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
    // 필터: 프리셋 select · 슬라이더 · 숫자 표시를 cfg 에 맞춘다 (프리셋을 고르면 여섯 값을 채우고, 슬라이더를 만지면 '직접')
    const syncFilter=()=>{
        const select=root.querySelector('[data-capture-option="filterPreset"]');if(select)select.value=cfg.filterPreset||'none';
        for(const key of FILTER_KEYS){const input=root.querySelector(`[data-capture-option="${key}"]`);if(!input)continue;const value=filterValue(cfg,key);if(input.value!==String(value))input.value=String(value);{const f=filterFill(key,value);input.style.setProperty('--fill-a',f.a);input.style.setProperty('--fill-b',f.b);}const out=root.querySelector(`[data-filter-value="${key}"]`);if(out)out.textContent=String(value);}
    };
    const visibility=()=>{
        root.querySelectorAll('[data-video-option]').forEach(el=>el.hidden=!['video','gif','apng','webp'].includes(cfg.format));
        root.querySelectorAll('[data-resolution-option]').forEach(el=>el.hidden=cfg.format!=='video');
        root.querySelectorAll('[data-limit-option]').forEach(el=>el.hidden=!['apng','webp'].includes(cfg.format));
        root.querySelectorAll('[data-redact-options]').forEach(el=>el.hidden=!cfg.redact);
        root.querySelectorAll('[data-replace-options]').forEach(el=>el.hidden=!cfg.replace);
    };
    // 캡처 창이 닫혀 있어도 만든 파일은 '바꾸기 전' 으로. kind 'filter': 필터만 바뀜 → 빠른 미리보기를 다시 굽지 않고 필터만 새로 입힌다 (필터 없는 바탕 그림은 그대로 쓸 수 있다)
    const save=kind=>{syncInfo();visibility();saveSettings();if(kept.files)kept.stale=true;if(kind!=='filter')kept.base=null;changed(kind);};
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
    root.addEventListener('click',event=>{
        if(event.target.closest('[data-mask-reset]')){cfg.maskStyles[cfg.mask]={...MASK_DEFAULTS};rebuild();save();}
        else if(event.target.closest('[data-capture-filter-reset]')){Object.assign(cfg,FILTER_PRESETS.none,{filterPreset:'none'});syncFilter();save('filter');}
    });
    draw();
    root.querySelectorAll('[data-capture-option]').forEach(input=>{
        const commit=()=>{
            if(input.type==='number'&&(!input.value||!input.validity.valid))return;
            const key=input.dataset.captureOption,value=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;
            if(String(cfg[key])===String(value))return;
            cfg[key]=value;
            if(key==='mask')rebuild();
            else if(key==='filterPreset'){if(value!=='custom')Object.assign(cfg,FILTER_PRESETS[value]||FILTER_PRESETS.none);syncFilter();} // 프리셋 → 여섯 값 채움 ('직접'은 값 유지)
            else if(FILTER_KEYS.includes(key)){cfg.filterPreset='custom';syncFilter();} // 슬라이더 → '직접'
            save(key==='filterPreset'||FILTER_KEYS.includes(key)?'filter':'');
        };
        input.addEventListener('change',commit);
        // Invalidate generated files while typing · dragging too, before focus leaves the field.
        if(input.type==='number'||input.type==='range')input.addEventListener('input',commit);
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
    'builtin:gall':{format:'webp',duration:6,maxMB:8,maxParagraphs:4,includeWeather:true,includeBackground:true},
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
// ids · stale: 만든 파일이 어느 선택으로 만들어졌고, 그 뒤 설정 · 편집이 바뀌었는지 (창을 다시 열어도 '바꾸기 전 파일' 표시가 남게)
// base: 필터 없이 구운 빠른 미리보기 한 장 {blob, ids, key, scale, motion, result} — 필터 슬라이더를 끄는 동안 이 위에 필터만 다시 입힌다 (필터 말고 다른 설정 · 선택 · 편집이 바뀌면 버린다)
const kept={chat:null,edits:null,files:null,archive:null,ids:'',stale:false,base:null};
const keptFor=()=>{const chat=SillyTavern.getContext().chatId;if(kept.chat!==chat){kept.chat=chat;kept.edits=null;kept.files=null;kept.archive=null;kept.ids='';kept.stale=false;kept.base=null;}return kept;};
// 바탕 그림을 다시 열 때 이어 써도 되는지: 선택 · 메시지 내용(스와이프 · 번역) · 테마 바탕이 그대로인지 (FNV-1a 한 줄)
const baseKey=ids=>{const text=[ids.join(','),document.body.classList.contains('salty-dark')?'d':'l',getComputedStyle(document.documentElement).getPropertyValue('--salty-bg').trim(),...ids.map(id=>document.querySelector(`#chat .mes[mesid="${Number(id)}"]`)?.innerHTML.replaceAll(' data-bl-fx-off=""','')||'')].join('\u0001');let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return `${ids.join(',')}#${h.toString(36)}`;};
const LIVE_BAND=512; // 큰 미리보기는 이 높이(캔버스 픽셀)의 띠로 나눠 화면에 보이는 띠만 칠한다
const LIVE_PIXELS=8e6; // 큰 미리보기 캔버스 상한 (약 32MB)
export async function openCapturePreview(ids, mount = null, selectedIds = () => ids) {
    const {captureMessages}=await import('./chat-capture.js');
    const panel=mount?.closest('.salty-panel');panel?._captureCleanup?.();
    if(!mount)document.querySelector('.bl-capture-dialog')?.close();
    const dialog=mount||document.createElement('dialog');
    if(!mount)dialog.className='bl-capture-dialog';
    const preview=`<section class="bl-capture-preview"><p data-capture-progress role="status"></p><label class="bl-tool-field" data-capture-parts hidden>파일 미리보기<select data-capture-part></select></label><img alt="저장할 채팅 캡처 미리보기" hidden><canvas data-capture-live role="img" aria-label="저장할 채팅 캡처 미리보기" hidden></canvas><video controls playsinline muted hidden aria-label="저장할 채팅 영상 미리보기"></video></section>`;
    const footer=`<footer class="bl-capture-stage-actions"><button type="button" class="salty-btn" data-capture-edit>캡처용 글 편집</button><button type="button" class="salty-btn" data-capture-quick>빠른 미리보기</button><button type="button" class="salty-btn" data-capture-render>파일 만들기</button><button type="button" class="salty-btn" data-capture-clear hidden>지우기</button><a class="salty-btn bl-tool-primary" data-capture-save download hidden>이 파일 저장</a><a class="salty-btn bl-tool-primary" data-capture-zip download="blue-lemonade-chat.zip" hidden>전체 파일 ZIP 저장</a></footer>`;
    dialog.innerHTML=mount?preview+footer:`<header><h3>채팅 캡처 미리보기</h3><button type="button" data-capture-close aria-label="미리보기 닫기">×</button></header><div class="bl-capture-layout"><section>${captureOptionsMarkup()}</section>${preview}</div>${footer}`;
    if(!mount){document.body.append(dialog);showThemeModal(dialog);}
    const alive=()=>mount?dialog.isConnected:dialog.open;
    const memory=keptFor();
    // busy: false | 'quick'(빠른 미리보기 — 필터와 무관하게 굽는다) | 'files'(파일 만들기)
    // bake: 뒤에서 바탕 그림만 굽는 중(필터 칸을 열었거나 필터를 만졌는데 바탕이 없을 때) — 버튼은 막지 않고, 다른 작업이 시작되면 멈춘다
    let revision=0,busy=false,edits=memory.edits,controller=null,outputs=[],zipURL='',stale=false,base=null,baseInfo=null,liveFrame=0,liveDraft=false,liveTimer=0,filterApi=null;
    let bake=null,bakeTimer=0,bakePresent=true,bakeAfterFiles=false,bakeFailed=-1,bands=null,bandCanvas=null,thumbDirty=false,liveError=false;
    const canLive=typeof createImageBitmap==='function';
    const video=dialog.querySelector('video'),img=dialog.querySelector('img'),save=dialog.querySelector('[data-capture-save]'),zip=dialog.querySelector('[data-capture-zip]'),status=dialog.querySelector('[data-capture-progress]'),render=dialog.querySelector('[data-capture-render]'),part=dialog.querySelector('[data-capture-part]');
    const release=()=>{video.pause();video.removeAttribute('src');video.load();img.src='';for(const item of outputs)URL.revokeObjectURL(item.url);outputs=[];if(zipURL)URL.revokeObjectURL(zipURL);zipURL='';};
    const clearButton=dialog.querySelector('[data-capture-clear]'),quick=dialog.querySelector('[data-capture-quick]');
    const live=dialog.querySelector('[data-capture-live]');
    const freeBig=()=>{live.width=live.height=0;bands=null;};
    // data-files: 큰 미리보기가 만든 파일을 보여 주는 중 — 두 열 화면(PC · 가로 폰)에서도 필터 칸의 작은 미리보기를 켠다 (큰 미리보기로는 필터가 안 보이니까)
    const filesShown=on=>{const box=thumbBox();if(!box||box.hasAttribute('data-files')===on)return;box.toggleAttribute('data-files',on);if(on&&base){thumbDirty=true;scheduleLive();}}; // 두 열 화면에서 새로 보이게 됐으면 칠한다 (칸 너비는 그대로라 ResizeObserver 가 안 알려 준다)
    const wipe=()=>{release();filesShown(false);video.hidden=img.hidden=live.hidden=save.hidden=zip.hidden=true;freeBig();save.removeAttribute('href');zip.removeAttribute('href');dialog.querySelector('[data-capture-parts]').hidden=true;};
    const stopBake=()=>{clearTimeout(bakeTimer);bake?.abort();bake=null;};
    const settingsRoot=mount?.closest('.salty-sec');
    // 필터 칸 맨 위의 작은 미리보기 (한 열 화면 — 큰 미리보기가 슬라이더보다 한참 위일 때). 설정 창이 다시 그려질 수 있어 매번 찾고, 새 칸이면 다시 지켜본다
    const thumbBox=()=>(settingsRoot||dialog).querySelector('[data-capture-filter-live]');
    let watched=null,watchedWidth=-1; // 필터 칸 본문의 너비가 바뀔 때만 (펼침 0 → 너비 · 화면 회전). 끄는 동안 높이가 흔들려도 다시 그리지 않게
    const watch=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{const width=Math.round(entries.at(-1).contentRect.width);if(width===watchedWidth)return;watchedWidth=width;if(!width)return;if(base){thumbDirty=true;scheduleLive();}else if(wantsThumb())scheduleBake(0);}):null;
    const watchBox=()=>{const box=thumbBox(),body=box?.parentElement||null;if(body!==watched){watch?.disconnect();watched=body;watchedWidth=-1;if(body)watch?.observe(body);}return box;};
    // 작은 미리보기를 쓸 자리인지: 필터 칸이 펼쳐져 있고, 두 열 화면이 아닐 때 (CSS 가 숨기는 곳은 --bl-live-thumb:0)
    const wantsThumb=()=>{const box=watchBox();return !!box&&(box.parentElement?.clientWidth||0)>0&&getComputedStyle(box).getPropertyValue('--bl-live-thumb').trim()!=='0';};
    watchBox();
    // 설정 · 선택이 바뀌어도 만들어 둔 파일은 지우지 않는다 — '바꾸기 전 파일'이라고만 알리고, 다시 만들면 그때 바뀐다
    // 5.5.4 필터만 바뀌면(kind 'filter') 빠른 미리보기를 지우지 않고 필터 없는 바탕 그림(base)에 새 값을 입힌다 — 끄는 동안 바로 보인다. 굽는 중인 파일은 옛 필터라 멈춘다
    const invalidate=arg=>{
        const kind=typeof arg==='string'?arg:arg?.detail?.kind;
        if(kind==='filter'){
            if(memory.files?.length)memory.stale=true;
            if(busy==='files'){revision++;controller?.abort();wipe();if(baseInfo?.result)presentQuick(baseInfo.result,baseInfo.motion);else{status.textContent='설정이 바뀌었어요. 빠른 미리보기나 파일 만들기를 눌러 주세요.';bakeAfterFiles=canLive;}}
            else if(outputs[0]?.kept&&!stale){stale=true;show();}
            if(base){thumbDirty=true;bands?.fill(false);scheduleLive(true);}
            else if(busy!=='quick'&&(wantsThumb()||!outputs.length))scheduleBake(0); // 파일 만들기 뒤 · 다른 설정을 바꾼 뒤에도 바로 보이게 바탕을 뒤에서 굽는다
            return;
        }
        // 필터 칸이 펼쳐져 있으면 작은 미리보기 자리는 그대로(흐리게) 두고 새 바탕을 뒤에서 굽는다 — 칸이 사라졌다 생기며 슬라이더가 밀리지 않게
        const box=thumbBox(),keepThumb=!!box&&!box.hidden&&wantsThumb();
        stopBake();dropBase({keepThumb});
        revision++;controller?.abort();if(memory.files?.length)memory.stale=true;if(outputs.length&&outputs[0].kept){stale=true;show();}else{wipe();status.textContent='설정이 바뀌었어요. 빠른 미리보기나 파일 만들기를 눌러 주세요.';}
        if(keepThumb)scheduleBake(500);
    };
    // keep: 창을 닫을 때는 저장해 둔 바탕(memory.base)을 남긴다 — 다시 열면 그대로 이어 쓴다. keepThumb: 작은 미리보기의 마지막 그림을 흐리게 남긴다
    function dropBase({keep=false,keepThumb=false}={}){
        if(liveFrame){cancelAnimationFrame(liveFrame);liveFrame=0;}clearTimeout(liveTimer);base?.close();base=null;baseInfo=null;if(!keep)memory.base=null;
        if(!live.hidden&&outputs[Number(part.value)||0]?.quick){live.hidden=true;img.hidden=false;} // 큰 미리보기가 캔버스였으면 필터 없는 그림으로 (곧 wipe · show 가 정리)
        freeBig();if(bandCanvas){bandCanvas.width=bandCanvas.height=0;bandCanvas=null;}
        const box=thumbBox();
        if(box){if(keepThumb)box.dataset.stale='';else{box.hidden=true;delete box.dataset.stale;const thumb=box.querySelector('canvas');if(thumb)thumb.width=thumb.height=0;}}
        filterApi?.releaseCaptureFilter(); // 필터 사본 · 그레인 타일도 놓는다 (다음에 칠할 때 다시 만든다)
    }
    // 바탕 그림(필터 없이 구운 빠른 미리보기)을 풀어 둔다 — 실패하면 false
    async function setBase(blob,info,current){
        let bitmap=null;
        try{filterApi??=await import('./capture-filter.js');bitmap=await createImageBitmap(blob);}catch(error){console.warn('[Blue Lemonade] 필터 미리보기',error);}
        if(!bitmap)return false;
        if(!alive()||revision!==current){bitmap.close();return false;}
        base?.close();base=bitmap;
        baseInfo={...info,bg:getComputedStyle(document.documentElement).getPropertyValue('--salty-bg').trim()||(document.body.classList.contains('salty-dark')?'#202226':'#f6f8ff')};
        memory.base={blob,...info};
        bands=null;thumbDirty=true;liveError=false;
        const box=watchBox();if(box){box.hidden=false;delete box.dataset.stale;}
        return true;
    }
    // 바탕 그림을 뒤에서 굽는다 (빠른 미리보기와 같은 조건 · 필터 없이). 만든 파일 화면은 그대로 두고, 큰 미리보기가 비어 있을 때만 빠른 미리보기로 채운다
    // present: 큰 미리보기가 비어 있으면 빠른 미리보기로 채울지 (파일 만들기가 오류로 끝난 뒤에는 오류 문구를 덮지 않게 false)
    function scheduleBake(delay,present=true){clearTimeout(bakeTimer);bakePresent=present;if(canLive)bakeTimer=setTimeout(bakeBase,delay);}
    async function bakeBase(){
        if(base||busy||bake||!alive()||bakeFailed===revision)return;
        const captureIds=selectedIds();if(!captureIds.length)return;
        const current=revision,job=new AbortController(),resources=createCaptureResources();bake=job;
        try{
            const options={...captureOptionsSnapshot(),edits,resources},motion=['video','gif','apng','webp'].includes(options.format);
            const result=await captureMessages(captureIds,()=>{},{...options,...NEUTRAL_FILTER,includeWeather:false,videoLayer:motion,pageIndex:0,animateText:false,maxScale:1.5},job.signal);
            if(job.signal.aborted||!alive()||revision!==current||base||busy)return;
            if(!await setBase(result.blob,{ids:captureIds.join(','),key:baseKey(captureIds),scale:result.scale||1,motion,result},current)){bakeFailed=revision;return;}
            if(!outputs.length&&bakePresent)presentQuick(result,motion);else scheduleLive();
        }catch(error){if(!job.signal.aborted){bakeFailed=revision;console.warn('[Blue Lemonade] 필터 미리보기',error);}}
        finally{resources.close();if(bake===job)bake=null;}
    }
    let padCache=null;const thumbPad=box=>{if(padCache===null){const s=getComputedStyle(box);padCache=(parseFloat(s.paddingLeft)||0)+(parseFloat(s.paddingRight)||0);}return padCache;}; // 캔버스 너비 = 칸 너비 - 좌우 여백 (캔버스를 읽으면 크기를 바꾼 뒤 레이아웃을 다시 한다)
    const grainFor=k=>(baseInfo.scale||1)*k; // 그레인 알갱이 = 캡처 CSS 1px (파일과 같은 굵기로 보이게 · 끄는 중 낮은 해상도에서도)
    // 작은 미리보기: 캡처 윗부분만 칸 높이만큼 (안에서 스크롤하지 않는다 — 그 위에서 쓸어도 설정 창이 굴러간다). 비네트 · 그레인은 전체 그림 기준
    function paintThumb(f,draft){
        const box=watchBox(),thumb=box?.querySelector('canvas');
        if(!thumb||box.hidden||!box.clientWidth)return false;
        const cssW=box.clientWidth-thumbPad(box),dpr=draft?1:Math.min(2,globalThis.devicePixelRatio||1);
        const tw=Math.max(1,Math.min(base.width,Math.ceil(cssW*dpr))),k=tw/base.width,fullH=base.height*k;
        const maxCss=Math.max(88,Math.min(280,Math.round((globalThis.innerHeight||600)*.3))); // CSS 의 clamp(88px,30dvh,280px) 와 같게
        const th=Math.max(1,Math.min(Math.round(fullH),Math.ceil(maxCss*tw/cssW)));
        if(thumb.width!==tw)thumb.width=tw;if(thumb.height!==th)thumb.height=th;
        const t=thumb.getContext('2d');if(!t)return false;
        t.clearRect(0,0,tw,th);
        if(baseInfo.motion){t.fillStyle=baseInfo.bg;t.fillRect(0,0,tw,th);} // 영상 · 움짤 바탕 그림은 투명 — 저장 때처럼 테마 바탕 위에 입힌다
        t.drawImage(base,0,0,base.width,Math.min(base.height,th/k),0,0,tw,th);
        filterApi.applyCaptureFilter(thumb,f,{seed:1,grainScale:grainFor(k),region:{width:tw,height:fullH,x:0,y:0}});
        delete box.dataset.stale;
        return true;
    }
    // 큰 미리보기: 캔버스는 보이는 너비 × 화면 배율(최대 2배, 상한 LIVE_PIXELS), 띠마다 칠했는지 기억하고 화면에 보이는 띠만 칠한다 (화면 밖이면 아무것도 안 한다 → 스크롤해 들어오면 그때)
    function sizeBig(){
        const dpr=Math.min(2,globalThis.devicePixelRatio||1),room=dialog.querySelector('.bl-capture-preview')?.clientWidth||0;
        let w=Math.max(1,Math.min(base.width,room?Math.ceil(room*dpr):base.width));
        if(w*base.height*w/base.width>LIVE_PIXELS)w=Math.max(1,Math.floor(Math.sqrt(LIVE_PIXELS*base.width/base.height)));
        const h=Math.max(1,Math.round(base.height*w/base.width));
        const cssWidth=`${Math.min(room||base.width,base.width)}px`;if(live.style.width!==cssWidth)live.style.width=cssWidth; // 그림(img)과 같은 크기로 보이게 (상한으로 캔버스를 줄여도) · 같으면 안 건드린다(레이아웃을 다시 하지 않게)
        if(live.width!==w||live.height!==h||!bands){live.width=w;live.height=h;bands=new Array(Math.ceil(h/LIVE_BAND)).fill(false);}
    }
    function paintBand(i,f,low){
        const k=live.width/base.width,y=i*LIVE_BAND,bh=Math.min(LIVE_BAND,live.height-y),bw=Math.max(1,Math.round(live.width*low)),bhh=Math.max(1,Math.round(bh*low));
        bandCanvas??=document.createElement('canvas');if(bandCanvas.width!==bw)bandCanvas.width=bw;if(bandCanvas.height!==bhh)bandCanvas.height=bhh;
        const b=bandCanvas.getContext('2d');if(!b)return;
        b.clearRect(0,0,bw,bhh);
        if(baseInfo.motion){b.fillStyle=baseInfo.bg;b.fillRect(0,0,bw,bhh);}
        b.drawImage(base,0,y/k,base.width,Math.min(base.height-y/k,bh/k),0,0,bw,bhh);
        filterApi.applyCaptureFilter(bandCanvas,f,{seed:1,grainScale:grainFor(k*low),region:{width:bw,height:base.height*k*low,x:0,y:y*low}});
        const ctx=live.getContext('2d');if(!ctx)return;
        ctx.clearRect(0,y,live.width,bh);ctx.drawImage(bandCanvas,0,0,bw,bhh,0,y,live.width,bh);
    }
    // 큰 미리보기에서 실제로 보이는 세로 구간: 화면과, 넘치는 부분을 자르는 조상(폰의 44dvh 미리보기 칸 · 설정 창 스크롤 칸)으로 자른다. 안 보이면 null
    function bigView(){
        const r=live.getBoundingClientRect();if(!r.height||!r.width)return null;
        let top=0,bottom=globalThis.innerHeight||document.documentElement.clientHeight;
        for(let el=live.parentElement;el&&el!==document.body;el=el.parentElement)if(getComputedStyle(el).overflowY!=='visible'){const c=el.getBoundingClientRect();top=Math.max(top,c.top);bottom=Math.min(bottom,c.bottom);}
        top=Math.max(0,top-r.top);bottom=Math.min(r.height,bottom-r.top);
        return bottom>top?{top,bottom,width:r.width,height:r.height}:null;
    }
    function paintBig(f,draft,view){
        if(!view)return;
        const px=live.height/view.height,first=Math.max(0,Math.floor(view.top*px/LIVE_BAND)),last=Math.min(bands.length-1,Math.floor((view.bottom*px-1)/LIVE_BAND));
        const low=draft?Math.min(1,view.width/live.width):1; // 끄는 중: CSS 픽셀 해상도(화면 배율 1) — 손을 멈추면 선명하게
        for(let i=first;i<=last;i++){if(!draft&&bands[i])continue;paintBand(i,f,low);bands[i]=low===1;}
    }
    // 끄는 동안은 한 프레임에 한 번. draft: 끄는 중(낮은 해상도) → 160ms 뒤 선명하게 다시
    function paintLive(){
        const draft=liveDraft;liveFrame=0;liveDraft=false;
        if(!base||!filterApi||!alive())return;
        const f=filterApi.filterSettings(getSettings().captureTools);
        try{
            // 읽기(레이아웃) 먼저 · 쓰기(캔버스 크기 · 그리기)는 뒤에 — 한 프레임에 레이아웃을 두 번 하지 않게
            const item=outputs[Number(part.value)||0],big=!!item?.quick&&!filterApi.isNeutral(f);
            if(item?.quick&&!big){if(!live.hidden){live.hidden=true;img.hidden=false;}freeBig();} // 필터 없음: 예전처럼 그림(img) 한 장 — 캔버스 메모리를 놓는다
            if(big&&live.hidden){live.hidden=false;img.hidden=true;bands=null;}
            let view=null;if(big){sizeBig();view=bigView();}
            if(thumbDirty&&paintThumb(f,draft))thumbDirty=draft;
            if(big)paintBig(f,draft,view);
        }catch(error){
            console.warn('[Blue Lemonade] 필터 미리보기',error);
            if(!liveError){liveError=true;status.textContent+=' · 필터 미리보기를 그리지 못했어요';}
        }
    }
    // 선명하게 다시 칠하는 때: 손을 멈춘 뒤 160ms — 느린 폰에서 값이 띄엄띄엄 오면(끄는 중인데 간격이 길면) 그 간격의 1.5배까지 기다린다 (끄는 도중에 무거운 선명한 그림을 굽지 않게)
    let lastDraftAt=0;
    function scheduleLive(draft=false){
        if(!base)return;
        liveDraft=liveFrame?liveDraft&&draft:draft;if(!liveFrame)liveFrame=requestAnimationFrame(paintLive);
        if(draft){const now=performance.now(),gap=now-lastDraftAt;lastDraftAt=now;clearTimeout(liveTimer);liveTimer=setTimeout(()=>{thumbDirty=true;scheduleLive();},gap<1000?Math.min(800,Math.max(160,gap*1.5)):160);}
    }
    // 큰 미리보기를 스크롤하면 아직 안 칠한 띠를 칠한다
    const onScroll=()=>{if(!alive()){cleanup();return;}if(base&&!live.hidden&&!liveFrame&&bands?.includes(false))scheduleLive();};
    document.addEventListener('scroll',onScroll,{capture:true,passive:true});
    const cleanup=()=>{revision++;controller?.abort();stopBake();release();watch?.disconnect();document.removeEventListener('scroll',onScroll,{capture:true});dropBase({keep:true});/* kept 는 남긴다 */settingsRoot?.removeEventListener('bl:capture-options-changed',invalidate);settingsRoot?.removeEventListener('change',selectionChanged);};
    const selectionChanged=event=>{if(event.target.matches('[data-word-message]'))invalidate();};
    if(mount){panel._captureCleanup=cleanup;settingsRoot.addEventListener('bl:capture-options-changed',invalidate);settingsRoot.addEventListener('change',selectionChanged);}
    else{bindCaptureOptions(dialog,invalidate);bindAddonLayout(dialog);dialog.querySelector('[data-capture-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{cleanup();dialog.remove();},{once:true});}
    const show=()=>{
        const item=outputs[Number(part.value)||0];if(!item)return;video.pause();video.hidden=img.hidden=live.hidden=true;filesShown(!item.quick);
        if(item.quick&&base){img.src=item.url;img.hidden=false;bands=null;thumbDirty=true;if(liveFrame){cancelAnimationFrame(liveFrame);liveFrame=0;}liveDraft=false;paintLive();} // 빠른 미리보기: 필터가 있으면 바탕 그림 + 지금 필터 (캔버스)
        else{freeBig();const media=item.result.format==='video'?video:img;media.src=item.url;media.hidden=false;}save.href=item.url;save.download=item.name;save.textContent=`${(item.result.extension||'png').toUpperCase()} ${outputs.length>1?'이 파일 ':''}저장`;save.hidden=!!item.quick;
        clearButton.hidden=!(memory.files?.length||memory.edits);
        const r=item.result,mb=n=>n>=1048576?`${(n/1048576).toFixed(n>=10485760?1:2)}MB`:`${Math.max(1,Math.round(n/1024))}KB`,total=outputs.reduce((sum,o)=>sum+o.blob.size,0),limit=['apng','webp'].includes(r.format)?(Number(getSettings().captureTools.maxMB)||0)*1048576:0;
        const fit=r.fitted?(r.fitted.overLimit?' · 한도를 못 맞췄어요 — 재생 시간이나 문단 수를 줄여 주세요':r.fitted.step?` · 용량에 맞춰 ${r.fitted.scale<1?'크기 '+Math.round(r.fitted.scale*100)+'% · ':''}${r.fitted.quality<1?'화질 '+Math.round(r.fitted.quality*100)+' · ':''}초당 ${r.fitted.fps}장`:''):'';
        status.textContent=`${item.quick?'빠른 미리보기(저장용 아님) · ':stale?'설정을 바꾸기 전에 만든 파일 · ':''}${outputs.length>1?`${Number(part.value)+1} / ${outputs.length} 파일 · `:''}${mb(item.blob.size)}${outputs.length>1?` (전체 ${mb(total)})`:''}${limit&&item.blob.size>limit?' ⚠ 한도 초과':''}${fit} · ${r.width} × ${r.height} · 치환 ${r.replaced}곳 · 이름 ${r.hidden}곳 가림${r.weather?' · 날씨 포함':''}${r.duration?' · '+r.duration+'초 · 고정 화면':''}${r.skippedImages?` · 그림 ${r.skippedImages}개 못 읽음`:''}`;
        if(item.quick&&item.firstOnly)status.textContent+=item.firstOnly;
    };
    part.onchange=show;
    // 빠른 미리보기 한 장을 큰 미리보기에 (바탕 그림에서 · 빠른 미리보기에서)
    function presentQuick(result,motion){
        wipe();stale=false;
        outputs=[{result:{...result,format:'image',extension:'png'},name:'preview.png',blob:result.blob,quick:true,url:URL.createObjectURL(result.blob),firstOnly:motion||(result.pageCount||1)>1?` · 첫 화면만${motion?' · 움직임 · 날씨는 파일 만들기에서':''}`:''}];
        show();
    }
    async function generate(){
        if(busy)return;busy='files';render.disabled=quick.disabled=true;revision++;controller?.abort();stopBake();wipe();stale=false;const current=revision;controller=new AbortController();const signal=controller.signal;
        const resources=createCaptureResources();
        holdFx(true); // 5.6.4: 화면 밖에서 멈춘 감정 대사를 다시 움직인 채로 — 움직임으로 잡히고, 저장 중 표시가 바뀌어 '메시지가 바뀌었어요'가 나지 않게 (dem-expressive.js)
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
            memory.files=pending.map(item=>({...item,kept:true}));memory.archive=archive;memory.ids=captureIds.join(',');memory.stale=false;
            part.innerHTML=outputs.map((item,i)=>`<option value="${i}">${i+1} / ${outputs.length} · ${item.result.width} × ${item.result.height}</option>`).join('');part.value='0';dialog.querySelector('[data-capture-parts]').hidden=outputs.length<2;
            if(archive){zipURL=URL.createObjectURL(archive);zip.href=zipURL;zip.hidden=false;}
            show();render.textContent='파일 다시 만들기';
        }catch(error){if(alive()&&revision===current)status.textContent=error.message||'미리보기를 만들지 못했어요.';}
        finally{holdFx(false);resources.close();busy=false;render.disabled=quick.disabled=false;if(bakeAfterFiles){bakeAfterFiles=false;scheduleBake(0);}else if(!base&&alive()&&wantsThumb())scheduleBake(0,false);}
    }
    // 빠른 미리보기: 굽지 않고 첫 화면만 멈춘 그림으로 (움직임 · 날씨 · 나머지 파일은 '파일 만들기'에서). 저장용이 아니다
    async function quickLook(){
        if(busy)return;busy='quick';render.disabled=quick.disabled=true;revision++;controller?.abort();stopBake();const current=revision;controller=new AbortController();const signal=controller.signal;
        const resources=createCaptureResources();
        try{
            const captureIds=selectedIds();if(!captureIds.length)throw Error('메시지를 먼저 선택해 주세요.');
            const options={...captureOptionsSnapshot(),edits,resources},motion=['video','gif','apng','webp'].includes(options.format);
            status.textContent='빠른 미리보기 만드는 중…';
            // 5.5.4 필터는 빼고 굽는다 → 그 위에 지금 필터를 입혀 보여 주고, 슬라이더를 끄는 동안 다시 굽지 않고 필터만 새로 입힌다 (createImageBitmap 이 없으면 예전처럼 필터까지 구운 그림)
            const look={...options,includeWeather:false,videoLayer:motion,pageIndex:0,animateText:false,maxScale:1.5};
            let result=await captureMessages(captureIds,()=>{},{...look,...(canLive?NEUTRAL_FILTER:null)},signal);
            signal.throwIfAborted();if(!alive()||revision!==current)return;
            if(canLive&&!await setBase(result.blob,{ids:captureIds.join(','),key:baseKey(captureIds),scale:result.scale||1,motion,result},current)){
                if(!alive()||revision!==current)return;
                dropBase();
                // 바탕 그림을 못 풀었다(메모리가 모자란 폰 등) → 필터 없는 그림을 필터 켠 채로 보여 주지 않게 필터까지 넣어 한 번 더 굽는다
                if(filterActive(getSettings().captureTools))result=await captureMessages(captureIds,()=>{},look,signal);
            }
            signal.throwIfAborted();if(!alive()||revision!==current)return;
            presentQuick(result,motion);
        }catch(error){if(alive()&&revision===current){status.textContent=error.message||'미리보기를 만들지 못했어요.';bakeFailed=revision;}} // 같은 선택 · 설정으로는 뒤에서 바탕을 다시 굽지 않는다 (너무 긴 선택이면 또 몇 초씩 멈춘다)
        finally{resources.close();busy=false;render.disabled=quick.disabled=false;}
    }
    quick.onclick=quickLook;
    clearButton.onclick=()=>{revision++;controller?.abort();stopBake();memory.files=null;memory.archive=null;memory.edits=null;memory.ids='';memory.stale=false;edits=null;stale=false;dropBase();wipe();clearButton.hidden=true;status.textContent='만든 파일과 캡처용 글 편집을 지웠어요.';};
    dialog.querySelector('[data-capture-edit]').onclick=async()=>{try{const ids=selectedIds(),result=await(await import('./capture-editor.js')).editCaptureDraft(ids,edits);if(result){const next=[...(edits||[]).filter(m=>!ids.includes(m.id)),...(result.draft||[])];edits=next.length?next:null;memory.edits=edits;clearButton.hidden=!(memory.files?.length||memory.edits);invalidate();}}catch(error){status.textContent=error.message;}};
    render.onclick=generate;
    // 열 때: 만들어 둔 파일이 있으면 그대로 보여 주고, 없으면 굽지 않고 빠른 미리보기만
    if(memory.files?.length){
        outputs=memory.files.map(item=>({...item,url:URL.createObjectURL(item.blob)}));
        part.innerHTML=outputs.map((item,i)=>`<option value="${i}">${i+1} / ${outputs.length} · ${item.result.width} × ${item.result.height}</option>`).join('');part.value='0';dialog.querySelector('[data-capture-parts]').hidden=outputs.length<2;
        if(memory.archive){zipURL=URL.createObjectURL(memory.archive);zip.href=zipURL;zip.hidden=false;}
        stale=memory.stale||memory.ids!==selectedIds().join(',');
        show();render.textContent='파일 다시 만들기';
        // 필터 칸의 작은 미리보기: 같은 선택 · 같은 메시지 내용 · 같은 테마로 구워 둔 바탕 그림이 있으면 이어 쓰고, 아니면 필터 칸이 펼쳐져 있을 때 뒤에서 굽는다
        const saved=memory.base,current=revision;
        if(saved&&saved.key===baseKey(selectedIds()))setBase(saved.blob,saved,current).then(ok=>{if(ok)scheduleLive();else if(wantsThumb())scheduleBake(0);});
        else{memory.base=null;if(wantsThumb())scheduleBake(0);}
    }else{clearButton.hidden=!memory.edits;await quickLook();}
}
