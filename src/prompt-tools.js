import {scriptSettings,persistScripts,legacyConflicts,cleanName,setScriptEnabled,scriptEnabled} from './scripts/store.js';
import {addonsEnabled,themeEnabled} from './usage-mode.js';
import {getSettings} from './settings.js';
import {leaveSettingsDialog} from './settings-dialog.js';
import {promptLinkMarkup} from './prompt-link.js';
import {fruitTypographyMarkup,bindFruitTypography} from './fruit-type-ui.js';

const GROUPS={
    deus:[['deus-qr','빠른 설정','입력창에서 데우스 2.5 옵션을 바로 골라요.'],['deus','프롬프트 이름 한글화','프롬프트와 정규식의 이름을 한글로 보여요.']],
    // 8.0.1 과일 계열(과일 · 야한과일 · 청과)의 한글화는 토글 하나 — 과일의 마음 창 · 프롬프트·정규식 이름 · 청과 문장 점검 화면이 함께 켜져요
    fruit:[['fruit-style','과일의 마음 꾸미기','글꼴·색·QR 카드와 버튼을 블루레몬에이드에 맞춰요.'],['fruit-family','과일 계열 한글화','과일 · 야한과일 · 청과의 프롬프트·정규식 이름과 과일의 마음 창을 한 번에 한글로 보여요.']],
};
const allowed=new Set(Object.values(GROUPS).flat().map(item=>item[0]));
const listeners=new Set();let busy=false;
const repaint=()=>{for(const fn of listeners)fn();};
// 입력창 옆 단추에 보일 이름. 비우면 아이콘만 보인다.
const NAMES={deus:['deus-qr','빠른 설정 이름','비우면 아이콘만 보여요']};
const escapeAttr=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nameMarkup=(id,state)=>{const entry=Object.entries(NAMES).find(([,item])=>item[0]===id);if(!entry)return '';const [key,[,title,note]]=entry;return `<label class="salty-row bl-prompt-name-row" data-prompt-name-row="${key}"${state.enabled[id]?'':' hidden'}><span>${title}</span><input type="text" class="text_pole" data-prompt-name="${key}" value="${escapeAttr(cleanName(state.names?.[key]))}" maxlength="40" placeholder="${note}" aria-label="${title}" autocomplete="off"></label><label class="salty-row bl-prompt-name-row" data-prompt-name-row="${key}"${state.enabled[id]?'':' hidden'}><span>이름 표시</span><select data-prompt-deus-icon><option value="yes" ${state.deusIconWithName!==false?'selected':''}>아이콘 + 이름</option><option value="no" ${state.deusIconWithName===false?'selected':''}>이름만</option></select></label>`;};

export function promptToolsMarkup(kind){
    const items=GROUPS[kind];if(!items)return '';
    const state=scriptSettings();
    return `<div class="bl-prompt-tools" data-prompt-tools="${kind}"><div class="salty-group">${items.map(([id,title,note])=>`<div class="salty-row bl-prompt-tool-row"><span>${title}</span><label class="salty-switch"><input type="checkbox" data-prompt-script="${id}" aria-label="${title}" ${scriptEnabled(state,id)?'checked':''}><span></span></label><small>${note}</small></div>${nameMarkup(id,state)}`).join('')}</div><div class="bl-prompt-tools-actions"><button type="button" class="salty-btn" data-prompt-open="${kind}">${kind==='deus'?'빠른 설정 열기':'과일의 마음 열기'}</button></div><p class="salty-note" data-prompt-tools-status role="status" aria-live="polite"></p></div>`;
}

// 상태창 글자 설정은 페이지 끝의 자기 접기 묶음 — 다른 설정 묶음과 같은 모양, 과일 · 데우스 같은 자리
export function fruitTypographyGroup(kind){
    return `<div class="salty-label" data-search-anchor="상태창 글자">상태창 글자</div>${fruitTypographyMarkup(kind)}`;
}

export function fruitPromptMarkup(){
    return `<div class="salty-label" data-search-anchor="과일">과일 계열 (과일 · 야한과일 · 청과)</div><p class="bl-prompt-source">호환 대상 프롬프트 · <a href="https://discord.com/channels/1384945301780955246/1395707630302789653/1554887154583212064" target="_blank" rel="noopener noreferrer">과일 원문 보기 ↗</a> · <a href="https://github.com/kongkongmie/guoshizhixin" target="_blank" rel="noopener noreferrer">코드 ↗</a></p>${promptToolsMarkup('fruit')}${promptLinkMarkup()}<p class="salty-note">과일의 마음 스크립트가 실행 중일 때 적용돼요. 꾸미기를 끄면 과일의 원래 디자인으로 돌아가요.</p><p class="bl-prompt-source">과일의 마음 원작 표기 · KKM · AQING · ACHE</p>${fruitTypographyGroup('fruit')}`;
}

export function bindPromptTools(root){
    const box=root.querySelector('[data-prompt-tools]');if(!box)return()=>{};
    const stopTypography=bindFruitTypography(root);
    let alive=true,runtime=null,unsubscribe=()=>{};
    const status=box.querySelector('[data-prompt-tools-status]');
    const say=text=>{if(alive&&box.isConnected)status.textContent=text;};
    const paint=()=>{
        if(!alive||!box.isConnected)return;
        const state=scriptSettings(),settings=getSettings(),available=addonsEnabled(settings);
        for(const input of box.querySelectorAll('[data-prompt-script]')){input.checked=scriptEnabled(state,input.dataset.promptScript);input.disabled=busy||!available;}
        for(const row of box.querySelectorAll('[data-prompt-name-row]')){const key=row.dataset?.promptNameRow;if(!NAMES[key])continue;row.hidden=state.enabled[NAMES[key][0]]!==true;const input=row.querySelector('input');if(!input)continue;input.disabled=busy||!available;if(document.activeElement!==input)input.value=cleanName(state.names?.[key]);}
        const choice=box.querySelector('[data-prompt-deus-icon]');if(choice){choice.disabled=busy||!available||state.enabled['deus-qr']!==true;choice.value=state.deusIconWithName!==false?'yes':'no';}
        const button=box.querySelector('[data-prompt-open]');button.disabled=busy||!available||(button.dataset.promptOpen==='deus'&&!state.enabled['deus-qr']);
        if(!available)say('테마 → 기타 설정 → 사용 모드에서 내장 확장을 함께 사용하면 켤 수 있어요.');
        else if(state.enabled['fruit-style']&&box.dataset.promptTools==='fruit'&&!themeEnabled(settings))say('꾸미기는 블루레몬에이드 테마를 켜면 적용돼요.');
    };
    listeners.add(paint);paint();
    const ready=import('./scripts/runtime.js').then(mod=>{runtime=mod;if(alive){unsubscribe=mod.subscribeScripts(paint);paint();}return mod;});
    ready.catch(error=>say(error.message||'설정을 불러오지 못했어요.'));
    async function rename(input){
        const key=input.dataset.promptName;if(!NAMES[key]||busy||!addonsEnabled(getSettings())){paint();return;}
        const state=scriptSettings(),before=cleanName(state.names?.[key]),next=cleanName(input.value);
        if(next===before){input.value=before;return;}
        busy=true;repaint();say('저장하고 있어요…');
        try{(state.names??={})[key]=next;await persistScripts();if(!alive||!box.isConnected)return;input.value=next;say(next?'이름을 저장했어요.':'이름을 비웠어요. 아이콘만 보여요.');}
        catch(error){(state.names??={})[key]=before;say(error.message||'이름을 저장하지 못했어요.');}
        finally{busy=false;repaint();globalThis.__blueLemonadeDeusQuick_v1?.refreshName?.();}
    }
    async function change(event){
        if(event.target?.hasAttribute?.('data-prompt-deus-icon')){
            const state=scriptSettings(),before=state.deusIconWithName,next=event.target.value!=='no';
            if(busy||!addonsEnabled(getSettings())||state.enabled['deus-qr']!==true){paint();return;}
            if(next===(before!==false)){paint();return;}
            busy=true;state.deusIconWithName=next;repaint();say('저장하고 있어요…');
            try{await persistScripts();globalThis.__blueLemonadeDeusQuick_v1?.refreshName?.();say('버튼 표시를 저장했어요.');}
            catch(error){state.deusIconWithName=before;say(error.message||'버튼 표시를 저장하지 못했어요.');}
            finally{busy=false;repaint();}
            return;
        }
        const input=event.target;
        if(input?.dataset?.promptName!==undefined){await rename(input);return;}
        const id=input?.dataset?.promptScript;
        if(!allowed.has(id)||busy||!addonsEnabled(getSettings())){paint();return;}
        const before=scriptEnabled(scriptSettings(),id),next=input.checked;
        if(next&&legacyConflicts(id).length){paint();say('헬퍼에서 같은 스크립트를 끈 뒤 켜 주세요.');return;}
        busy=true;let changed=false,saved=false;repaint();say('저장하고 있어요…');
        try{const mod=await ready;if(!alive||!box.isConnected)return;setScriptEnabled(scriptSettings(),id,next);changed=true;await persistScripts();saved=true;await mod.syncScripts(true);const unit=id==='fruit-family'?'fruit':id;say(next&&mod.scriptStatus(unit)!=='사용 중'?mod.scriptStatus(unit):next?'켰어요.':'껐어요.');}
        catch(error){if(changed&&!saved&&scriptEnabled(scriptSettings(),id)===next)setScriptEnabled(scriptSettings(),id,before);if(changed&&!saved)try{await runtime?.syncScripts(true);}catch{}say(error.message||'설정을 저장하지 못했어요.');}
        finally{busy=false;repaint();}
    }
    async function open(event){
        const button=event.target.closest?.('[data-prompt-open]');if(!button||button.disabled)return;
        if(button.dataset.promptOpen==='deus'){
            try{await ready;if(!alive||!box.isConnected)return;const panel=globalThis.__blueLemonadeDeusQuick_v1;if(typeof panel?.open!=='function'){say('빠른 설정을 준비 중이에요. 잠시 뒤 다시 눌러 주세요.');return;}if(await leaveSettingsDialog(button)===false)return;await panel.open();say('빠른 설정을 열었어요.');}catch(error){say(error.message||'빠른 설정을 열지 못했어요.');}
        }else{
            const panel=globalThis.__FRUIT_HEART_MAIN__,entry=document.getElementById('fruit-heart-v6-wand-entry');
            if(typeof panel?.open!=='function'&&!entry){say('먼저 실리태번 헬퍼에서 과일의 마음 스크립트를 켜 주세요.');return;}
            try{if(await leaveSettingsDialog(button)===false)return;if(!document.getElementById('fruit-heart-v6')?.classList.contains('open')){if(typeof panel?.open==='function')await panel.open();else entry.click();}say('과일의 마음을 열었어요.');}catch(error){say(error.message||'과일의 마음을 열지 못했어요.');}
        }
    }
    box.addEventListener('change',change);box.addEventListener('click',open);
    return()=>{stopTypography();alive=false;unsubscribe();listeners.delete(paint);box.removeEventListener('change',change);box.removeEventListener('click',open);};
}
