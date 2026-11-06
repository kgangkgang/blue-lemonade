// 테마의 폰 접기가 가린 본문만 복원해요. 작성자가 숨긴 요소와 판별 못 한 규칙은 유지해요.
export function createPhoneFoldDisplayReader(doc) {
    const view=doc?.defaultView;let collected=null;
    const collect=()=>{
        const rows=[];let unreadable=false;
        const visit=(rules,unsupported=false)=>{
            for(const rule of rules){
                if(rule.media&&!view.matchMedia(rule.media.mediaText).matches)continue;
                if(rule.constructor?.name==='CSSSupportsRule'&&!view.CSS.supports(rule.conditionText))continue;
                const nested=unsupported||rule.constructor?.name==='CSSContainerRule'||rule.constructor?.name==='CSSLayerBlockRule';
                if(rule.style?.display&&rule.selectorText)rows.push({selector:rule.selectorText,value:rule.style.display,unsupported});
                if(rule.cssRules)visit(rule.cssRules,nested);
                if(rule.styleSheet)try{visit(rule.styleSheet.cssRules,nested);}catch{unreadable=true;}
            }
        };
        for(const sheet of doc.styleSheets||[])if(!sheet.disabled&&(!sheet.media?.mediaText||view.matchMedia(sheet.media.mediaText).matches))try{visit(sheet.cssRules);}catch{unreadable=true;}
        return {rows,unreadable};
    };
    return node=>{
        const card=node?.parentElement,body=doc?.body;
        if(node?.tagName==='SUMMARY'||node?.hidden||node?.style?.display==='none'||!card?.matches?.('details.custom-dem-card[open]:not(.bl-dem-shown)')||card.closest('.custom-dem-modules'))return null;
        if(!view?.matchMedia?.('(max-width: 1000px)').matches||!body?.classList?.contains('salty-dem-skin')||!body.hasAttribute('data-bl-dem-fold'))return null;
        // 한 번의 복제에서 display 규칙 목록은 한 번만 읽어요.
        const {rows,unreadable}=collected||=collect();if(unreadable)return null;
        const values=new Set();let folded=false,unknown=false;
        for(const {selector,value,unsupported} of rows)try{
            if(!node.matches(selector))continue;
            if(unsupported)unknown=true;
            else if(value==='none'&&selector.includes('[data-bl-dem-fold]')&&selector.includes('details.custom-dem-card[open]:not(.bl-dem-shown)')&&selector.includes('> :not(summary)'))folded=true;
            else values.add(value);
        }catch{unknown=true;}
        if(!folded||unknown||values.has('none')||values.size>1)return null;
        return values.size?[...values][0]:'revert';
    };
}
