import {installFruitOptionHelp} from './fruit-option-help.js';
import {localPromptHash} from './prompt-fingerprint.js';
import {DEUS_EFFECTS,DEUS_EFFECT_GROUPS} from './deus-option-effects.js';
// V3 표지(빠른 설정 deus-qr 와 같은 id): 관계 택1 · 상태창 범위 택1 · 대사 소리 · 친구들 택1 중 둘 이상.
const DEUS_V3_SIGNS=['cb1fa811-516f-4a61-aa93-092bb94d5ba3','0f47d870-2bb8-4c25-b6fe-c3d4c9b4e626','279618e4-d961-489f-9d2b-56503e0d6067','8b648af7-db80-4402-9536-58a5d82a6fe2'];
// 11-19 V4 표지(deus-qr 와 같은 id): 운명의 주사위 · 주사위 결과 · 폭력 묘사 택1 · 새 얼굴 · 일기장 중 둘 이상. V4 에는 V3 표지도 다 있어요.
const DEUS_V4_SIGNS=['ecfff91e-43e0-4a5d-8cfe-4d15e56dd55d','a19b9951-7214-4f4e-a1b8-42047882c71c','fa2248a0-d567-4a0a-884d-1cfa390e8716','4f5509db-7cd8-4b7d-bff1-bd4063a8559f','de251b02-fb80-4a4a-b312-d83a349826aa'];
const hasSigns=(preset,signs)=>signs.filter(id=>preset?.prompts?.some?.(p=>(p.identifier||p.id)===id)).length>=2;
/** 'v4' · 'v3' · '2.5' — 빠른 설정의 판 판별과 같은 규칙(구조로) */
export const deusPresetVersion=preset=>hasSigns(preset,DEUS_V4_SIGNS)?'v4':hasSigns(preset,DEUS_V3_SIGNS)?'v3':'2.5';
/** V3 이상(V4 포함) */
export const isDeusV3Preset=preset=>deusPresetVersion(preset)!=='2.5';
export function describeDeusOption(key, preset) {
    const group=DEUS_EFFECT_GROUPS[key];
    const ids=group?group.ids:[key], rows=[];let changed=false;const version=deusPresetVersion(preset),v3=version!=='2.5';
    for(const id of ids){
        const base=DEUS_EFFECTS[id],prompt=preset?.prompts?.find(p=>(p.identifier||p.id)===id);
        if(!base||!prompt)continue;
        // 같은 id 라도 V3 원문이면 V3 설명(v3 덧칠)을, 2.5 원문이면 2.5 설명을 보여요. 원문이 둘 다 아니면 프리셋 판을 따라요.
        const hash=localPromptHash(String(prompt.content||'').replace(/\r\n?/g,'\n').trim());
        // V4 원문이면 V4 설명(v4 덧칠은 V3 덧칠 위에)을 보여요. 원문이 어느 판과도 다르면 프리셋 판을 따라요.
        const v4=base.v4&&(hash===base.v4.hash||(hash!==base.hash&&hash!==base.v3?.hash&&version==='v4'));
        const data=v4?{...base,...base.v3,...base.v4}:base.v3&&(hash===base.v3.hash||(hash!==base.hash&&v3))?{...base,...base.v3}:base;
        const same=hash===data.hash||!!data.standing?.includes(hash);
        changed ||= !same;
        rows.push({data,prompt,same});
    }
    if(!rows.length)return {title:'데우스 옵션 설명',text:'현재 프리셋에서 이 항목을 찾지 못했어요. 프리셋이 열린 뒤 다시 확인해 주세요.',verified:false};
    return {title:group?.label||rows[0].data.label,text:group?rows.map(r=>`${r.data.label}: ${r.data.text}${r.same?'':' (기본 설명·현재 원문 수정됨)'}`).join('\n\n'):rows[0].data.text,
        // 11-05 설명 창이 선택지마다 줄을 나누고 이름을 굵게 써요(같은 문장은 맨 위 한 번) — 글은 그대로, 나눔만 items 로 넘겨요
        items:group?rows.map(r=>({label:r.data.label,text:`${r.data.text}${r.same?'':' (기본 설명·현재 원문 수정됨)'}`})):undefined,
        original:rows.map(r=>`${r.data.label}\n${r.prompt.content||''}`).join('\n\n'),verified:!changed,baseline:changed};
}
// describeOther(key): 데우스가 아닌 프리셋(솔라)의 설명 — 없으면 null 을 돌려 데우스 설명으로 넘어가요.
export function installDeusOptionHelp(doc,host,readPreset,describeOther) {
    return installFruitOptionHelp(doc,host,{scope:'#bl-deus-popover',label:'데우스 옵션 설명',
        targetOf(node){
            // Native select menus belong to the OS. Hold the row's label to read all choices.
            if(node?.closest?.('select,option'))return null;
            const target=node?.closest?.('.dq-row,.dq-toggle');
            if(target?.querySelector('[data-dq-focus^="entry-"]'))return null;
            return target?.closest('#bl-deus-popover')&&target.querySelector('[data-dq-focus]')?target:null;
        },
        describe(target){const key=target.querySelector('[data-dq-focus]')?.dataset.dqFocus;return describeOther?.(key)||describeDeusOption(key,readPreset?.());},
    });
}
