import {scriptSettings,persistScripts,legacyConflicts} from './scripts/store.js';
import {addonsEnabled,themeEnabled} from './usage-mode.js';
import {getSettings} from './settings.js';
import {leaveSettingsDialog} from './settings-dialog.js';
import {promptLinkMarkup} from './prompt-link.js';

const GROUPS={
    deus:[['deus-qr','빠른 설정','입력창에서 데우스 2.5 옵션을 바로 골라요.'],['deus','프롬프트 이름 한글화','프롬프트와 정규식의 이름을 한글로 보여요.']],
    fruit:[['fruit-style','과일의 마음 꾸미기','글꼴·색·QR 카드와 버튼을 블루레몬에이드에 맞춰요.'],['fruit-heart','과일의 마음 한글화','과일 창과 스크립트 목록을 한글로 보여요.'],['fruit','프롬프트 이름 한글화','프롬프트와 정규식의 이름을 한글로 보여요.']],
};
const allowed=new Set(Object.values(GROUPS).flat().map(item=>item[0]));
const listeners=new Set();let busy=false;
const repaint=()=>{for(const fn of listeners)fn();};

export function promptToolsMarkup(kind){
    const items=GROUPS[kind];if(!items)return '';
    const state=scriptSettings();
    return `<div class="bl-prompt-tools" data-prompt-tools="${kind}"><div class="salty-group">${items.map(([id,title,note])=>`<div class="salty-row bl-prompt-tool-row"><span>${title}</span><label class="salty-switch"><input type="checkbox" data-prompt-script="${id}" aria-label="${title}" ${state.enabled[id]?'checked':''}><span></span></label><small>${note}</small></div>`).join('')}</div><div class="bl-prompt-tools-actions"><button type="button" class="salty-btn" data-prompt-open="${kind}">${kind==='deus'?'빠른 설정 열기':'과일의 마음 열기'}</button></div><p class="salty-note" data-prompt-tools-status role="status" aria-live="polite"></p></div>`;
}

export function fruitPromptMarkup(){
    return `<div class="salty-label" data-search-anchor="과일">과일</div><p class="bl-prompt-source">호환 대상 프롬프트 · <a href="https://discord.com/channels/1384945301780955246/1395707630302789653/1554887154583212064" target="_blank" rel="noopener noreferrer">과일 원문 보기 ↗</a> · <a href="https://github.com/kongkongmie/guoshizhixin" target="_blank" rel="noopener noreferrer">코드 ↗</a></p>${promptToolsMarkup('fruit')}${promptLinkMarkup()}<p class="salty-note">과일의 마음 스크립트가 실행 중일 때 적용돼요. 꾸미기를 끄면 과일의 원래 디자인으로 돌아가요.</p><p class="bl-prompt-source">과일의 마음 원작 표기 · KKM · AQING · ACHE</p>`;
}

export function bindPromptTools(root){
    const box=root.querySelector('[data-prompt-tools]');if(!box)return()=>{};
    let alive=true,runtime=null,unsubscribe=()=>{};
    const status=box.querySelector('[data-prompt-tools-status]');
    const say=text=>{if(alive&&box.isConnected)status.textContent=text;};
    const paint=()=>{
        if(!alive||!box.isConnected)return;
        const state=scriptSettings(),settings=getSettings(),available=addonsEnabled(settings);
        for(const input of box.querySelectorAll('[data-prompt-script]')){input.checked=state.enabled[input.dataset.promptScript]===true;input.disabled=busy||!available;}
        const button=box.querySelector('[data-prompt-open]');button.disabled=busy||!available||(button.dataset.promptOpen==='deus'&&!state.enabled['deus-qr']);
        if(!available)say('테마 → 기타 설정 → 사용 모드에서 내장 확장을 함께 사용하면 켤 수 있어요.');
        else if(state.enabled['fruit-style']&&box.dataset.promptTools==='fruit'&&!themeEnabled(settings))say('꾸미기는 블루레몬에이드 테마를 켜면 적용돼요.');
    };
    listeners.add(paint);paint();
    const ready=import('./scripts/runtime.js').then(mod=>{runtime=mod;if(alive){unsubscribe=mod.subscribeScripts(paint);paint();}return mod;});
    ready.catch(error=>say(error.message||'설정을 불러오지 못했어요.'));
    async function change(event){
        const input=event.target,id=input?.dataset?.promptScript;
        if(!allowed.has(id)||busy||!addonsEnabled(getSettings())){paint();return;}
        const before=scriptSettings().enabled[id],next=input.checked;
        if(next&&legacyConflicts(id).length){paint();say('헬퍼에서 같은 스크립트를 끈 뒤 켜 주세요.');return;}
        busy=true;let changed=false,saved=false;repaint();say('저장하고 있어요…');
        try{const mod=await ready;if(!alive||!box.isConnected)return;scriptSettings().enabled[id]=next;changed=true;await persistScripts();saved=true;await mod.syncScripts(true);say(next&&mod.scriptStatus(id)!=='사용 중'?mod.scriptStatus(id):next?'켰어요.':'껐어요.');}
        catch(error){if(changed&&!saved&&scriptSettings().enabled[id]===next)scriptSettings().enabled[id]=before;if(changed&&!saved)try{await runtime?.syncScripts(true);}catch{}say(error.message||'설정을 저장하지 못했어요.');}
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
    return()=>{alive=false;unsubscribe();listeners.delete(paint);box.removeEventListener('change',change);box.removeEventListener('click',open);};
}
