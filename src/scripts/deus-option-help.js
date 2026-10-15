import {installFruitOptionHelp} from './fruit-option-help.js';
import {localPromptHash} from './prompt-fingerprint.js';
import {DEUS_EFFECTS,DEUS_EFFECT_GROUPS} from './deus-option-effects.js';
export function describeDeusOption(key, preset) {
    const group=DEUS_EFFECT_GROUPS[key];
    const ids=group?group.ids:[key], rows=[];let changed=false;
    for(const id of ids){
        const data=DEUS_EFFECTS[id],prompt=preset?.prompts?.find(p=>(p.identifier||p.id)===id);
        if(!data||!prompt)continue;
        const same=localPromptHash(String(prompt.content||'').replace(/\r\n?/g,'\n').trim())===data.hash;
        changed ||= !same;
        rows.push({data,prompt,same});
    }
    if(!rows.length)return {title:'데우스 옵션 설명',text:'현재 프리셋에서 이 항목을 찾지 못했어요. 프리셋이 열린 뒤 다시 확인해 주세요.',verified:false};
    return {title:group?.label||rows[0].data.label,text:group?rows.map(r=>`${r.data.label}: ${r.data.text}${r.same?'':' (기본 설명·현재 원문 수정됨)'}`).join('\n\n'):rows[0].data.text,
        original:rows.map(r=>`${r.data.label}\n${r.prompt.content||''}`).join('\n\n'),verified:!changed,baseline:changed};
}
export function installDeusOptionHelp(doc,host,readPreset) {
    return installFruitOptionHelp(doc,host,{scope:'#bl-deus-popover',label:'데우스 옵션 설명',
        targetOf(node){
            // Native select menus belong to the OS. Hold the row's label to read all choices.
            if(node?.closest?.('select,option'))return null;
            const target=node?.closest?.('.dq-row,.dq-toggle');
            if(target?.querySelector('[data-dq-focus^="entry-"]'))return null;
            return target?.closest('#bl-deus-popover')&&target.querySelector('[data-dq-focus]')?target:null;
        },
        describe(target){return describeDeusOption(target.querySelector('[data-dq-focus]')?.dataset.dqFocus,readPreset?.());},
    });
}
