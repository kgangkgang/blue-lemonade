// Read-only source/translation matching. Never align arbitrary substrings by position.
const normalized=s=>String(s??'').replace(/\s+/g,' ').trim();
const unquote=s=>normalized(s).replace(/^["“「『]+|["”」』]+$/g,'').trim();
export function matchingTranslation(original,translated,excerpt) {
    const key=unquote(excerpt);if(!key||!/[가-힣]/.test(translated))return '';
    if(unquote(original)===key)return translated.trim();
    const a=String(original).split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
    const b=String(translated).split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
    if(a.length!==b.length)return '';
    const indexes=a.map((s,i)=>unquote(s)===key?i:-1).filter(i=>i>=0);
    if(indexes.length!==1)return '';
    const value=b[indexes[0]];
    return /[가-힣]/.test(value)&&!/[\u3040-\u30ff]/.test(value)?value:'';
}

export function translationFromDisplay(display,source) {
    const template=document.createElement('template');template.innerHTML=String(display||'');
    const root=template.content;root.querySelectorAll('script,style').forEach(el=>el.remove());
    for(const original of root.querySelectorAll('.original_text')) {
        if(unquote(original.textContent)!==unquote(source))continue;
        const translation=original.closest('.llm-translator-details')?.querySelector('.translated_text')
            ||(original.previousElementSibling?.tagName==='BR'?original.previousElementSibling.previousElementSibling:original.previousElementSibling);
        if(translation?.matches('.translated_text')&&/[가-힣]/.test(translation.textContent))return translation.textContent.trim();
    }
    return '';
}
