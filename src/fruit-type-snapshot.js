// 표시된 상태창만 메모리에서 복제해요. 채팅·프리셋을 저장하거나 밖으로 보내지 않아요.
const OMIT = new Set(['SCRIPT','STYLE','LINK','META','BASE','IFRAME','OBJECT','EMBED','FORM','INPUT','TEXTAREA','SELECT','AUDIO','VIDEO','SOURCE']);
const ATTRS = new Set(['id','class','title','role','dir','lang','hidden','colspan','rowspan','viewBox','d','fill','stroke','stroke-width','width','height']);
const safeValue = value => !/url\s*\(|expression\s*\(|-moz-binding/i.test(value);
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
    const view=source.ownerDocument.defaultView, rules=[];let count=0;
    function declarations(el,pseudo) {
        const style=view.getComputedStyle(el,pseudo),out=[];
        for(const key of style) {
            const value=style.getPropertyValue(key);
            if(key.startsWith('--')||!safeValue(value)||/^(animation|transition|cursor|pointer-events|content-visibility)/.test(key))continue;
            out.push(`${key}:${value}`);
        }
        return {style,text:out.join(';')};
    }
    function clone(node) {
        if(node.nodeType===3)return target.createTextNode(node.textContent);
        if(node.nodeType!==1||OMIT.has(node.tagName)||++count>2500)return null;
        // 외부 그림·주소·실행 속성을 복제하지 않아요. 보이는 텍스트와 모양만 옮겨요.
        if(node.tagName==='IMG')return null;
        const el=node.namespaceURI==='http://www.w3.org/2000/svg'?target.createElementNS(node.namespaceURI,node.localName):target.createElement(node.localName);
        for(const attr of node.attributes)if(ATTRS.has(attr.name)||attr.name.startsWith('aria-'))el.setAttribute(attr.name,attr.value);
        const key=String(count);el.setAttribute('data-bl-preview-node',key);
        el.style.cssText=declarations(node).text;el.style.pointerEvents='none';
        for(const pseudo of ['::before','::after']) {
            const data=declarations(node,pseudo);
            if(!['none','normal',''].includes(data.style.content))rules.push(`[data-bl-preview-node="${key}"]${pseudo}{${data.text}}`);
        }
        for(const child of node.childNodes){const copy=clone(child);if(copy)el.append(copy);}
        return el;
    }
    const result=clone(source),host=target.querySelector('[data-bl-fruit-preview]');
    if(!host||!result)return false;
    host.replaceChildren(result);
    const style=target.getElementById('snapshot-pseudo');if(style)style.textContent=rules.join('\n');
    for(const face of source.ownerDocument.fonts||[])if(!target.fonts.has(face))target.fonts.add(face);
    return true;
}
export const FRUIT_SNAPSHOT_DOCUMENT='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; font-src data: blob:; img-src data:; form-action \'none\'; base-uri \'none\'"><style>html,body{margin:0;padding:0;background:transparent}body{overflow:hidden}[data-bl-fruit-preview]{display:flow-root;pointer-events:none}*{animation:none!important;transition:none!important}</style><style id="snapshot-pseudo"></style><style id="custom"></style></head><body><div data-bl-fruit-preview></div></body></html>';
