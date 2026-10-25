// 표시된 상태창만 메모리에서 복제해요. 채팅·프리셋을 저장하거나 밖으로 보내지 않아요.
const OMIT = new Set(['SCRIPT','STYLE','LINK','META','BASE','IFRAME','OBJECT','EMBED','FORM','INPUT','TEXTAREA','SELECT','AUDIO','VIDEO','SOURCE']);
const ATTRS = new Set(['id','class','title','alt','role','dir','lang','hidden','colspan','rowspan','viewBox','d','fill','stroke','stroke-width','width','height','open','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','points','preserveAspectRatio']);
export function safePreviewStyleValue(value) {
    if(/expression\s*\(|-moz-binding|@import/i.test(value))return false;
    const urls=[...value.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)];
    if(/url\s*\(/i.test(value)&&!urls.length)return false;
    return urls.every(([, ,url])=>{
        if(/^#[\w:.-]+$/.test(url))return true;
        if(/^data:image\/(png|gif|jpeg|webp);base64,[a-z\d+/=]+$/i.test(url))return true;
        if(!/^data:image\/svg\+xml(?:;charset=[\w-]+)?,/i.test(url))return false;
        try{
            const svg=decodeURIComponent(url.slice(url.indexOf(',')+1));
            return /^<svg\b/i.test(svg)&&!/<(?:script|foreignObject|image|iframe)|\bon\w+\s*=|\b(?:href|src)\s*=|url\s*\(|@import/i.test(svg);
        }catch{return false;}
    });
}
export function findFruitPreviewSource(doc, selector) {
    const found=[],seen=new Set();
    function visit(d, scope, depth) {
        if(!scope||seen.has(d)||depth>3)return;seen.add(d);
        for(const el of scope.querySelectorAll(selector)) {
            if(!el.closest('[data-bl-fruit-preview]')&&el.getClientRects().length&&(!el.checkVisibility||el.checkVisibility({checkVisibilityCSS:true})))found.push(el);
        }
        for(const frame of scope.querySelectorAll('iframe'))try{
            if(frame.classList.contains('bl-ft-preview')||!frame.getClientRects().length)continue;
            const inner=frame.contentDocument;
            if(inner?.body)visit(inner,inner.body,depth+1);
        }catch{/* 다른 출처 문서는 읽지 않아요. */}
    }
    visit(doc,doc.querySelector('#chat'),0);return found.at(-1)||null;
}
export function copyFruitPreview(source, target) {
    const view=source.ownerDocument.defaultView, rules=[];let count=0,unavailableImages=0,unavailableArt=0;
    function imageSource(node) {
        const src=node.currentSrc||node.getAttribute('src')||'';
        if(src.startsWith('data:image/')&&safePreviewStyleValue(`url("${src}")`))return src;
        try{
            if(!node.complete||!node.naturalWidth||!node.naturalHeight)throw Error('그림을 아직 읽지 못했어요');
            const canvas=source.ownerDocument.createElement('canvas'),ratio=Math.min(1,2048/Math.max(node.naturalWidth,node.naturalHeight));
            canvas.width=Math.max(1,Math.round(node.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(node.naturalHeight*ratio));
            canvas.getContext('2d').drawImage(node,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png');
        }catch{
            unavailableImages++;
            return 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%3E%3Cpath%20d%3D%22M0%200L16%2016M16%200L0%2016%22%20stroke%3D%22%23888%22%20stroke-width%3D%221%22%2F%3E%3C%2Fsvg%3E';
        }
    }
    function declarations(el,pseudo) {
        const style=view.getComputedStyle(el,pseudo),out=[];
        for(const key of style) {
            const value=style.getPropertyValue(key);
            if(key==='background-image'&&/url\s*\(/i.test(value)&&!safePreviewStyleValue(value))unavailableArt++;
            if(key.startsWith('--')||!safePreviewStyleValue(value)||/^(animation|transition|cursor|pointer-events|content-visibility)/.test(key))continue;
            out.push(`${key}:${value}`);
        }
        return {style,text:out.join(';')};
    }
    function clone(node) {
        if(node.nodeType===3)return target.createTextNode(node.textContent);
        if(node.nodeType!==1||OMIT.has(node.tagName)||++count>2500)return null;
        // 외부 주소와 실행 속성은 옮기지 않고 이미 읽은 그림 픽셀만 복제해요.
        const el=node.namespaceURI==='http://www.w3.org/2000/svg'?target.createElementNS(node.namespaceURI,node.localName):target.createElement(node.localName);
        for(const attr of node.attributes)if(ATTRS.has(attr.name)||attr.name.startsWith('aria-'))el.setAttribute(attr.name,attr.value);
        const key=String(count);el.setAttribute('data-bl-preview-node',key);
        el.style.cssText=declarations(node).text;el.style.pointerEvents='none';
        if(node.tagName==='IMG')el.setAttribute('src',imageSource(node));
        for(const pseudo of ['::before','::after']) {
            const data=declarations(node,pseudo);
            if(!['none','normal',''].includes(data.style.content))rules.push(`[data-bl-preview-node="${key}"]${pseudo}{${data.text}}`);
        }
        for(const child of node.childNodes){const copy=clone(child);if(copy)el.append(copy);}
        return el;
    }
    const result=clone(source),host=target.querySelector('[data-bl-fruit-preview]');
    if(!host||!result||count>2500)return false;
    host.replaceChildren(result);
    host.setAttribute('data-bl-preview-unavailable-images',String(unavailableImages));
    host.setAttribute('data-bl-preview-unavailable-art',String(unavailableArt));
    const style=target.getElementById('snapshot-pseudo');if(style)style.textContent=rules.join('\n');
    for(const face of source.ownerDocument.fonts||[])if(!target.fonts.has(face))target.fonts.add(face);
    return true;
}
export function fruitPreviewBackground(source) {
    let node=source.parentElement;
    for(let depth=0;node&&depth<30;depth++){
        const color=node.ownerDocument.defaultView.getComputedStyle(node).backgroundColor;
        if(color&&color!=='transparent'&&color!=='rgba(0, 0, 0, 0)')return color;
        try{node=node.parentElement||node.ownerDocument.defaultView.frameElement;}catch{node=null;}
    }
    return 'transparent';
}
export const FRUIT_SNAPSHOT_DOCUMENT='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; font-src data: blob:; img-src data:; form-action \'none\'; base-uri \'none\'"><style>html,body{margin:0;padding:0;background:transparent}body{overflow:hidden}[data-bl-fruit-preview]{display:flow-root;pointer-events:none}*{animation:none!important;transition:none!important}</style><style id="snapshot-pseudo"></style><style id="custom"></style></head><body><div data-bl-fruit-preview></div></body></html>';
