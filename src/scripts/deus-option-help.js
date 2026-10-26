import {installFruitOptionHelp} from './fruit-option-help.js';
import {localPromptHash} from './prompt-fingerprint.js';
import {DEUS_EFFECTS,DEUS_EFFECT_GROUPS} from './deus-option-effects.js';
// V3 표지(빠른 설정 deus-qr 와 같은 id): 관계 택1 · 상태창 범위 택1 · 대사 소리 · 친구들 택1 중 둘 이상.
const DEUS_V3_SIGNS=['cb1fa811-516f-4a61-aa93-092bb94d5ba3','0f47d870-2bb8-4c25-b6fe-c3d4c9b4e626','279618e4-d961-489f-9d2b-56503e0d6067','8b648af7-db80-4402-9536-58a5d82a6fe2'];
export const isDeusV3Preset=preset=>DEUS_V3_SIGNS.filter(id=>preset?.prompts?.some?.(p=>(p.identifier||p.id)===id)).length>=2;
export function describeDeusOption(key, preset) {
    const group=DEUS_EFFECT_GROUPS[key];
    const ids=group?group.ids:[key], rows=[];let changed=false;const v3=isDeusV3Preset(preset);
    for(const id of ids){
        const base=DEUS_EFFECTS[id],prompt=preset?.prompts?.find(p=>(p.identifier||p.id)===id);
        if(!base||!prompt)continue;
        // 같은 id 라도 V3 원문이면 V3 설명(v3 덧칠)을, 2.5 원문이면 2.5 설명을 보여요. 원문이 둘 다 아니면 프리셋 판을 따라요.
        const hash=localPromptHash(String(prompt.content||'').replace(/\r\n?/g,'\n').trim());
        const data=base.v3&&(hash===base.v3.hash||(hash!==base.hash&&v3))?{...base,...base.v3}:base;
        const same=hash===data.hash;
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
