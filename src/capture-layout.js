export const CAPTURE_INFO_KEYS=['showName','showAvatar','showTimestamp','showModel','showMessageId','showTokens','showGenerationTime'];
const INFO_SELECTORS={showName:'.name_text,.mes_name',showTimestamp:'.timestamp',showModel:'.timestamp-icon,.mes_model,.model_name,[data-capture-model]',showMessageId:'.mesIDDisplay',showTokens:'.tokenCounterDisplay',showGenerationTime:'.mes_timer'};
export function applyCaptureDisplay(clone,options={},model=''){
    for(const [key,selector] of Object.entries(INFO_SELECTORS))if(options[key]===false)clone.querySelectorAll(selector).forEach(el=>el.remove());
    if(options.showAvatar===false)clone.querySelectorAll('.avatar').forEach(el=>el.remove());
    if(options.showAssets===false)clone.querySelectorAll('.mes_text img,.mes_text picture,.mes_text svg,.mes_text canvas').forEach(el=>el.remove());
    const header=clone.querySelector('.ch_name,.mes_header');
    if(options.showName===false&&header)for(const node of [...header.childNodes])if(node.nodeType===3)node.remove();
    if(options.showModel!==false&&model&&header&&!header.querySelector('.mes_model,.model_name')){
        const label=document.createElement('small');label.dataset.captureModel='';label.textContent=model;
        label.style.cssText='display:block;flex-basis:100%;font:12px/1.5 sans-serif;opacity:.75;overflow-wrap:anywhere';header.append(label);
    }
    if(header&&((options.showName===false&&options.showTimestamp===false&&options.showModel===false)||(!header.textContent.trim()&&!header.querySelector('img,svg'))))header.remove();
    const side=clone.querySelector('.mesAvatarWrapper');
    if(side&&!side.textContent.trim()&&!side.querySelector('.avatar'))side.remove();
    if(!clone.querySelector('.mesAvatarWrapper,.avatar')){
        clone.style.gap='0';const block=clone.querySelector('.mes_block');
        if(block)for(const [key,value] of Object.entries({'margin-left':'0',width:'100%','inline-size':'100%','max-width':'100%','max-inline-size':'100%'}))block.style.setProperty(key,value);
    }
}
/** Copied computed sizes are used values, not authored layout constraints. Text must reflow in SVG. */
export function reflowCaptureText(clone){
    for(const el of [clone,...clone.querySelectorAll('.mes_block,.mes_text,.mes_text p,.mes_text li,.mes_text h1,.mes_text h2,.mes_text h3,.mes_text blockquote,.mes_text .bl-quote-lead')]){
        for(const key of ['height','block-size'])el.style.setProperty(key,'auto','important');
        for(const key of ['min-height','min-block-size'])el.style.setProperty(key,'0','important');
        for(const key of ['max-height','max-block-size'])el.style.setProperty(key,'none','important');
    }
    for(const el of clone.querySelectorAll('.mes_text span,.mes_text q,.mes_text em,.mes_text strong,.mes_text b,.mes_text i,.mes_text a')){
        if(!['inline','inline-block'].includes(el.style.display)||el.querySelector('img,svg,canvas'))continue;
        for(const key of ['width','inline-size','height','block-size'])el.style.setProperty(key,'auto','important');
        for(const key of ['min-width','min-inline-size'])el.style.setProperty(key,'0','important');
        for(const key of ['max-width','max-inline-size'])el.style.setProperty(key,'none','important');
    }
    // Keep the opening quote attached to its first letter without a copied pixel width.
    for(const el of clone.querySelectorAll('.bl-quote-lead')){el.style.whiteSpace='nowrap';el.style.textIndent='0';}
}
/** Fixed pages: prefer paragraph gaps, then line gaps; never cut through a glyph. */
export function capturePagePlan(root,width,maxParagraphs=4){
    const height=Math.ceil(root.getBoundingClientRect().height),origin=root.getBoundingClientRect().top;
    const limit=width*16/9,count=Math.min(20,Math.max(1,Math.floor(Number(maxParagraphs)||4)));
    const occupied=[];
    const add=rect=>{if(rect.width&&rect.height)occupied.push([Math.max(0,rect.top-origin),Math.min(height,rect.bottom-origin)]);};
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
        const node=walker.currentNode;if(!node.textContent.trim()||node.parentElement.closest('style,script'))continue;
        const range=document.createRange();range.selectNodeContents(node);for(const rect of range.getClientRects())add(rect);
    }
    root.querySelectorAll('img,svg,canvas').forEach(el=>add(el.getBoundingClientRect()));
    occupied.sort((a,b)=>a[0]-b[0]);const merged=[];
    for(const interval of occupied){const last=merged.at(-1);if(last&&interval[0]<=last[1]+1)last[1]=Math.max(last[1],interval[1]);else merged.push([...interval]);}
    const gaps=merged.slice(0,-1).map((item,i)=>(item[1]+merged[i+1][0])/2);
    const blocks=[...root.querySelectorAll('.mes_text')].flatMap(el=>[...el.childNodes]).filter(node=>node.nodeType!==1||!node.matches('style,script'));
    const ends=blocks.flatMap(node=>{const range=document.createRange();range.selectNode(node);const rect=range.getBoundingClientRect();return rect.height&&rect.width?[rect.bottom-origin]:[];}).sort((a,b)=>a-b);
    const pages=[];let top=0;
    while(top<height-.5){
        const remaining=ends.filter(end=>end>top+1),paragraphEnd=remaining[count-1];
        const paragraphGap=paragraphEnd==null?height:(gaps.find(y=>y>=paragraphEnd-1)||height);
        let target=Math.min(height,top+limit,paragraphGap);
        // A complete final block may use its trailing margin without creating an empty page.
        if((merged.at(-1)?.[1]||0)<=target+1)target=height;
        let bottom=target>=height?height:gaps.filter(y=>y>top+8&&y<=target).at(-1);
        if(!bottom){
            const next=merged.find(([start,end])=>end>top+1);
            if(next&&next[1]-top>limit+1)throw Error('한 줄 또는 이미지가 영상 한 화면보다 커요. 글자·이미지 크기를 줄인 뒤 다시 만들어 주세요.');
            bottom=Math.min(height,next?.[1]+2||target);
        }
        bottom=Math.ceil(bottom);if(bottom<=top)throw Error('영상 페이지를 나누지 못했어요. 문단을 줄여 주세요.');
        pages.push({top,height:bottom-top});top=bottom;
        if(pages.length>40)throw Error('나뉜 영상이 40개를 넘어요. 선택한 메시지를 줄여 주세요.');
    }
    return pages;
}
