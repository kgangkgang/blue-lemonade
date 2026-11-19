import {installFruitOptionHelp} from './fruit-option-help.js';
import {localPromptHash} from './prompt-fingerprint.js';
import {DEUS_EFFECTS,DEUS_EFFECT_GROUPS} from './deus-option-effects.js';
import {deusPromptsVersion} from '../deus-version.js';
// 판 표지(V3 · V4 프롬프트 id)는 src/deus-version.js 한 곳 — 상태창 글자 미리보기도 같은 표지로 판을 골라요
/** 'v4' · 'v3' · '2.5' — 빠른 설정의 판 판별과 같은 규칙(구조로) */
export const deusPresetVersion=preset=>deusPromptsVersion(Array.isArray(preset?.prompts)?preset.prompts:null)||'2.5';
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
