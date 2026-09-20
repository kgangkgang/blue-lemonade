import {SCRIPT_CATALOG,loadBundledScript,scriptDefinition} from './catalog.js';
import {scriptSettings,replaceScriptSettings,persistScripts,legacyConflicts} from './store.js';
import {getSettings} from '../settings.js';
let selected='korean',busy=false;
const drafts=new Map();
export function scriptsMarkup(){
    const s=scriptSettings();
    return `<div class="bl-scripts"><div class="bl-script-layout"><div class="bl-script-list"><h3>스크립트</h3><p class="salty-note">필요한 것만 켜세요. 켜고 끄면 바로 적용돼요.</p>${SCRIPT_CATALOG.map(item=>`<article class="bl-script-card"><div class="bl-script-heading"><button type="button" class="salty-btn" data-script-select="${item.id}" aria-pressed="${selected===item.id}"><i class="fa-solid ${item.icon}" aria-hidden="true"></i> ${item.name}</button><label class="bl-script-switch"><input type="checkbox" data-script-enable="${item.id}" ${s.enabled[item.id]?'checked':''}> 켜기</label></div><p>${item.description}</p><small data-script-status="${item.id}"></small></article>`).join('')}<p class="salty-note">기존 헬퍼에서 같은 스크립트를 켜 둔 경우 먼저 그 항목을 꺼 주세요. 데이터는 그대로 두고 중복 실행만 막아요.</p></div><div class="bl-script-editor"><h3 data-script-title></h3><p class="salty-note">코드를 수정해 저장할 수 있어요. 수정본은 테마 업데이트와 색 프리셋 가져오기로 덮어쓰지 않아요.</p><label>스크립트 코드<textarea data-script-code spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="스크립트 코드"></textarea></label><div class="bl-script-actions"><button type="button" class="salty-btn" data-script-save>수정 저장·적용</button><button type="button" class="salty-btn" data-script-reset>기본 코드로 복원</button><button type="button" class="salty-btn" data-script-export>코드 파일 저장</button></div><details><summary>편집 도움말</summary><p>자바스크립트 코드예요. 문법 오류는 저장 전에 알려드려요. 추가한 이벤트·타이머는 <code>BlueLemonade.onCleanup(() =&gt; { ... })</code>에서 해제해 주세요. 번역 사전은 이름·번역·설명 값을 편집할 수 있어요.</p></details><p data-script-feedback role="status" aria-live="polite"></p></div></div></div>`;
}
export async function bindScripts(root){
    const box=root.querySelector('.bl-scripts');if(!box)return;
    let alive=true,sequence=0,selection=selected;
    const runtime=await import('./runtime.js');if(!box.isConnected)return;
    const feedback=box.querySelector('[data-script-feedback]'),code=box.querySelector('[data-script-code]');
    const paint=()=>{if(!alive)return;for(const item of SCRIPT_CATALOG){box.querySelector(`[data-script-status="${item.id}"]`).textContent=runtime.scriptStatus(item.id);const toggle=box.querySelector(`[data-script-enable="${item.id}"]`);toggle.checked=scriptSettings().enabled[item.id];toggle.disabled=busy;}};
    const unsubscribe=runtime.subscribeScripts(paint);
    root._scriptsCleanup=()=>{alive=false;unsubscribe();};
    async function choose(id){
        selected=id;selection=id;const seq=++sequence,item=scriptDefinition(id);code.disabled=true;
        try{const value=drafts.get(id)??scriptSettings().overrides[id]?.code??await loadBundledScript(id);if(!alive||seq!==sequence)return;code.value=value;box.querySelector('[data-script-title]').textContent=`${item.name} · 코드 편집`;for(const button of box.querySelectorAll('[data-script-select]'))button.setAttribute('aria-pressed',String(button.dataset.scriptSelect===id));}
        catch(error){feedback.textContent=error.message;}finally{if(seq===sequence)code.disabled=false;}
    }
    code.addEventListener('input',()=>drafts.set(selection,code.value));
    for(const button of box.querySelectorAll('[data-script-select]'))button.onclick=()=>choose(button.dataset.scriptSelect);
    async function change(edit){
        if(busy)return;busy=true;paint();const before=JSON.parse(JSON.stringify(scriptSettings()));
        try{edit(scriptSettings());await persistScripts();await runtime.syncScripts(!!getSettings().enabled);feedback.textContent='저장했어요.';}
        catch(error){replaceScriptSettings(before);feedback.textContent=error.message;}
        finally{busy=false;paint();}
    }
    for(const toggle of box.querySelectorAll('[data-script-enable]'))toggle.onchange=async()=>{
        const id=toggle.dataset.scriptEnable,on=toggle.checked;
        if(on&&legacyConflicts(id).length){toggle.checked=false;feedback.textContent='헬퍼의 스크립트 관리에서 같은 스크립트를 끈 뒤 다시 켜 주세요.';return;}
        await change(s=>{s.enabled[id]=on;});
    };
    box.querySelector('[data-script-save]').onclick=async()=>{
        const id=selection,value=code.value;try{runtime.validateScript(value);}catch(error){feedback.textContent=`문법 오류: ${error.message}`;return;}
        await change(s=>{s.overrides[id]={code:value,baseVersion:scriptDefinition(id).version,at:Date.now()};});
    };
    box.querySelector('[data-script-reset]').onclick=async()=>{
        // Keep the previous edit as an in-session draft, so reset itself is reversible.
        const id=selection;drafts.set(id,code.value);await change(s=>{delete s.overrides[id];});if(alive&&selection===id){code.value=scriptSettings().overrides[id]?.code??await loadBundledScript(id);feedback.textContent='기본 코드를 불러왔어요. 이전 편집은 다른 항목을 선택했다 돌아오면 다시 볼 수 있어요.';}
    };
    box.querySelector('[data-script-export]').onclick=()=>{const url=URL.createObjectURL(new Blob([code.value],{type:'text/javascript;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`blue-lemonade-${selection}.js`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);};
    paint();await choose(selection);
}
