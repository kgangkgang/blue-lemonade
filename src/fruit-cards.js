// Optional display adapter for known Fruit cards. Never edits messages, presets or card scripts.
const ATTRIBUTE = 'data-bl-fruit-card';
const FRAME_ATTRIBUTE = 'data-bl-fruit-card-frame';
const ROOTS = '.fate-status-wrapper,.dynamic-status-container,.vintage-prologue,.post-it-container,.novel-header-container,.greenhouse';
const signatures = [
    ['.fate-status-wrapper', '.fate-top-grid,.fate-raw'],
    ['.dynamic-status-container', '.status-bar-content'],
    ['.vintage-prologue', '.main-text'],
    ['.post-it-container', '.cat-kaomoji'],
    ['.novel-header-container', '.novel-title'],
    ['.greenhouse', '.doc'],
];
const labels = new Map([
    ['DATE', '날짜'], ['TIME', '시간'], ['LOC.', '장소'], ['WTHR', '날씨'],
    ['SCENE', '장면'], ['MOMENT', '순간'], ['SILENT', '고요'], ['FLOWING', '흐름'], ['WHISPER', '속삭임'], ['ECHO', '메아리'],
    ['My heart found you,before my mind understood.', '머리로 알기 전에, 마음이 먼저 당신을 찾았어요.'],
    ['Choose · Sth.', '다음 행동 고르기'], ['☽ 纯文字小剧场美化', '☽ 짧은 이야기'], ['↑ 回到顶部', '↑ 맨 위로'],
    ['CP', '관계'], ['AT', '장소'],
]);
const LABELS = '.fate-grid-label,.movie-deco-eng,.fate-bottom-en,.corner-info,.bar-label,.to-top-btn,.novel-meta-label';
const BUTTONS = '.fate-theme-toggle,.prologue-emoji,.mom-theme-toggle,.theme-toggle,.theme-toggle-btn,.theme-btn';
const buttonLabels = new Map([
    ['切换主题', '테마 바꾸기'], ['切换日夜', '낮·밤 바꾸기'], ['切换日夜模式', '낮·밤 바꾸기'], ['切换日/夜模式', '낮·밤 바꾸기'],
    ['切换夜间模式', '밤 모드로 바꾸기'], ['切换日间模式', '낮 모드로 바꾸기'],
]);
const R = `[${ATTRIBUTE}~="v1"]`;
const CSS = `
body[${FRAME_ATTRIBUTE}="v1"]{display:flow-root!important;box-sizing:border-box!important;margin:0!important;padding:8px!important}
${R}{box-sizing:border-box!important;max-width:100%!important;padding:var(--bl-fc-gap)!important;border-radius:var(--bl-fc-radius)!important;font-size:var(--bl-fc-size)!important;overflow-wrap:anywhere!important;transition:background-color .18s ease,color .18s ease,border-color .18s ease!important}
@media(prefers-reduced-motion:reduce){${R}{transition:none!important}}
${R} *{box-sizing:border-box}
${R}[${ATTRIBUTE}~="font"],${R}[${ATTRIBUTE}~="font"] :is(div,p,span,label,button,summary,em,strong,h1,h2,h3,h4,li,td,th){font-family:var(--bl-fc-font)!important}
${R}[${ATTRIBUTE}~="colors"]{--ft-text-main:var(--bl-fc-text)!important;--ft-text-light:var(--bl-fc-muted)!important;--ft-border:var(--bl-fc-line)!important;color:var(--bl-fc-text)!important;background:var(--bl-fc-bg)!important;border-color:var(--bl-fc-line)!important;box-shadow:none!important}
${R}[${ATTRIBUTE}~="colors"] :is(p,span,label,summary,h1,h2,h3,h4,.text-content,.main-text,.source-text,.novel-title,.novel-preface,.novel-meta-value,.novel-cp-name){color:inherit!important;border-color:var(--bl-fc-line)!important}
${R}[${ATTRIBUTE}~="colors"] :is(button,a){color:var(--bl-fc-accent)!important;border-color:var(--bl-fc-line)!important}
${R}[${ATTRIBUTE}~="colors"]{--text-color:var(--bl-fc-text)!important;--header-text-color:var(--bl-fc-muted)!important;--divider-color:var(--bl-fc-line)!important;--cat-color:var(--bl-fc-muted)!important;--toggle-color:var(--bl-fc-accent)!important;--toggle-bg:var(--bl-fc-bg)!important;--toggle-border:var(--bl-fc-line)!important;--inner-bg-color:var(--bl-fc-bg)!important;--novel-text:var(--bl-fc-text)!important;--novel-border:var(--bl-fc-line)!important;--novel-card-bg:var(--bl-fc-bg)!important;--novel-tag-bg:var(--bl-fc-bg)!important;--sp-ink:var(--bl-fc-text)!important;--sp-muted:var(--bl-fc-muted)!important;--sp-bg:var(--bl-fc-bg)!important;--sp-tint:var(--bl-fc-bg)!important;--sp-tint-line:var(--bl-fc-line)!important;--white:var(--bl-fc-text)!important;--light-gray:var(--bl-fc-muted)!important;--dark-gray:var(--bl-fc-bg)!important}
${R}[${ATTRIBUTE}~="colors"] .status-bar-content{background:var(--bl-fc-bg)!important;color:var(--bl-fc-text)!important;border-color:var(--bl-fc-line)!important;box-shadow:none!important}
${R}[${ATTRIBUTE}~="colors"] :is(.line-1,.line-2,.line-3,.present-tag,.scifi-icon){color:var(--bl-fc-text)!important;border-color:var(--bl-fc-line)!important;text-shadow:none!important}
${R}[${ATTRIBUTE}~="colors"] :is(.present-tag,.mom-theme-toggle){background:var(--bl-fc-bg)!important;border-color:var(--bl-fc-line)!important}
${R}.dynamic-status-container > .mom-theme-toggle{position:static!important;margin:0 0 var(--bl-fc-gap) auto!important;min-width:30px;min-height:30px}
${R}.post-it-container{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--bl-fc-gap)!important}
${R}.post-it-container .corner-info{position:static!important;transform:none!important;grid-column:1;grid-row:1;font-size:1em!important;align-self:center;min-width:0;line-height:1.4;white-space:normal}
${R}.post-it-container .theme-toggle{position:static!important;grid-column:2;grid-row:1;min-width:30px;min-height:30px}
${R}.post-it-container .post-it-collapsible{grid-column:1/-1;grid-row:2;min-width:0}
${R}.post-it-container .cat-kaomoji{position:static!important;transform:none!important;grid-column:1/-1;grid-row:3;text-align:center}
${R}.post-it-container :is(.content-wrapper,#options-container){min-width:0;max-width:100%;overflow-wrap:anywhere}
${R}.post-it-container .clickable-text:hover{transform:none!important}
${R}.vintage-prologue .source-text{position:static!important;text-align:right;margin-top:.5em}
${R}.vintage-prologue .prologue-emoji{position:static!important;margin-top:.4em}
${R}.greenhouse .doc{padding:0!important;min-width:0}
${R}.greenhouse :is(.top-bar,.bottom-bar){flex-wrap:wrap;gap:.5em}
${R}.fate-status-wrapper{gap:var(--bl-fc-gap)!important}
${R} .fate-top-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:var(--bl-fc-gap)!important;padding-bottom:var(--bl-fc-gap)!important}
@media(min-width:600px){${R} .fate-top-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
${R} :is(.fate-grid-item,.novel-meta-card){min-width:0!important}
${R} :is(.fate-grid-label,.movie-deco-eng){font-size:.8em!important;letter-spacing:.04em!important;opacity:.8!important}
${R} .fate-grid-value{font-size:1em!important;line-height:1.5!important;word-break:normal!important;overflow-wrap:anywhere!important}
${R} .fate-movie-quote-container{padding:var(--bl-fc-gap) 0!important}
${R} .movie-line-content{max-width:100%!important;gap:0 .04em;line-height:1.75!important}
${R} .movie-deco-eng{position:static!important;flex-basis:100%;white-space:normal!important;margin-bottom:.3em!important}
${R} .movie-line-content::before{display:none!important}
${R} :is(.char-wrap,.movie-huge-text){transform:none!important;vertical-align:baseline!important}
${R} .char-wrap{font-size:1.1em!important;letter-spacing:normal!important;margin:0!important;transition:color .18s ease,opacity .18s ease!important}
${R}[${ATTRIBUTE}~="colors"] :is(.char-wrap,.movie-huge-text,.fate-grid-value,.fate-between){opacity:1!important}
${R} .movie-huge-text{font-size:1.35em!important;line-height:1.4!important}
${R} .fate-bottom-en{font-size:.9em!important;line-height:1.55!important;white-space:normal!important;overflow-wrap:anywhere!important}
${R} .fate-theme-toggle{position:static!important;align-self:flex-end;min-width:30px;min-height:30px;opacity:.8!important}
${R} :is(.novel-meta-single-row,.novel-tags-wrapper,.line-1,.line-2,.line-3){flex-wrap:wrap!important;gap:.4em!important}
${R} :is(.novel-meta-card,.novel-title,.novel-preface,.text-content,.main-text,.source-text){min-width:0!important;max-width:100%!important;overflow-wrap:anywhere!important}
`;
let active = false, config = {}, frame = 0, chat = null, chatObserver = null, discovery = null, fontObserver = null;
const documents = new Map(), frames = new Map();
const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
const known = root => signatures.some(([selector, child]) => root.matches(selector) && root.querySelector(child));
const MODE_ATTRIBUTE = 'data-bl-fruit-mode';
const LAYOUT_ATTRIBUTE = 'data-bl-fruit-layout';
const META_ATTRIBUTE = 'data-bl-fruit-meta';
const layoutName = value => ['compact','card','title'].includes(value) ? value : 'compact';
function nativeMode(root) {
    const preview=root.getAttribute('data-bl-preview-theme');if(preview==='day'||preview==='night')return preview;
    if(root.matches('.fate-status-wrapper,.novel-header-container'))return root.classList.contains('night-mode')?'night':'day';
    if(root.matches('.greenhouse'))return root.classList.contains('night')?'night':'day';
    if(root.matches('.dynamic-status-container') || root.matches('.vintage-prologue') && root.querySelector('.mom-theme-toggle'))return root.classList.contains('day-mode')?'day':'night';
    if(root.matches('.post-it-container'))return root.classList.contains('light-mode')?'day':'night';
    return root.classList.contains('dark-mode')?'night':'day';
}
function metadataEligible(root) {
    if(root.matches('.fate-status-wrapper'))return root.querySelectorAll('.fate-top-grid > .fate-grid-item').length===4;
    return root.matches('.dynamic-status-container') && ['.line-1','.line-2','.line-3'].every(s=>root.querySelector('.status-bar-content > '+s));
}
function setOwned(root,item,name,value) {
    if(!item.attributes.has(name))item.attributes.set(name,{before:root.getAttribute(name),after:null});
    const record=item.attributes.get(name);record.after=value;
    if(root.getAttribute(name)!==value)root.setAttribute(name,value);
}
function restoreOwned(root,item,name) {
    const record=item.attributes.get(name);if(!record)return;
    if(root.getAttribute(name)===record.after){if(record.before===null)root.removeAttribute(name);else root.setAttribute(name,record.before);}
    item.attributes.delete(name);
}
function releaseDecoration(root,state) {
    const item=state.decorations.get(root);if(!item)return;
    item.button?.remove();for(const name of [...item.attributes.keys()])restoreOwned(root,item,name);
    state.decorations.delete(root);
}
function decorateRoot(root,state,next) {
    let item=state.decorations.get(root);
    if(!item){item={attributes:new Map(),button:null,open:false,fold:false};state.decorations.set(root,item);}
    setOwned(root,item,MODE_ATTRIBUTE,nativeMode(root));setOwned(root,item,LAYOUT_ATTRIBUTE,layoutName(next.layout));
    const fold=next.metadataFold===true && metadataEligible(root);
    if(!fold){item.button?.remove();item.button=null;item.fold=false;restoreOwned(root,item,META_ATTRIBUTE);return;}
    if(!item.fold)item.open=false;
    item.fold=true;
    const update=()=>{setOwned(root,item,META_ATTRIBUTE,item.open?'open':'closed');item.button.setAttribute('aria-expanded',String(item.open));item.button.setAttribute('aria-label',`날짜 · 시간 · 장소 · 날씨 ${item.open?'접기':'펼치기'}`);};
    if(!item.button?.isConnected){
        const button=root.ownerDocument.createElement('button');button.type='button';button.className='bl-fruit-meta-toggle';button.textContent='장면 정보';
        button.setAttribute('aria-label','날짜 · 시간 · 장소 · 날씨 펼치기');button.dataset.blFruitOwned='metadata';
        button.addEventListener('click',event=>{event.stopPropagation();item.open=!item.open;update();});
        item.button=button;root.insertBefore(button,root.firstChild);
    }
    update();
}
const CARD_LAYOUT_CSS = `
${R}[${ATTRIBUTE}~="colors"][${MODE_ATTRIBUTE}="day"]{--bl-fc-text:#27303b;--bl-fc-muted:#596879;--bl-fc-bg:color-mix(in srgb,var(--bl-fc-base-accent) 3%,#fbfcfe);--bl-fc-line:rgba(46,64,85,.18);--bl-fc-accent:color-mix(in srgb,var(--bl-fc-base-accent) 58%,#1b293a)}
${R}[${ATTRIBUTE}~="colors"][${MODE_ATTRIBUTE}="night"]{--bl-fc-text:#ecf1f8;--bl-fc-muted:#b0bed0;--bl-fc-bg:color-mix(in srgb,var(--bl-fc-base-accent) 3%,#242a33);--bl-fc-line:rgba(222,233,247,.19);--bl-fc-accent:color-mix(in srgb,var(--bl-fc-base-accent) 65%,#fff)}
${R}.fate-status-wrapper,${R}.dynamic-status-container{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:calc(var(--bl-fc-gap)*.5)!important;align-items:start!important}
${R}.fate-status-wrapper>:not(.fate-theme-toggle):not(.bl-fruit-meta-toggle),${R}.dynamic-status-container>:not(.mom-theme-toggle):not(.bl-fruit-meta-toggle){grid-column:1/-1;min-width:0}
${R} :is(.fate-theme-toggle,.mom-theme-toggle){grid-column:2;grid-row:1;justify-self:end;align-self:center;margin:0!important;top:auto!important;right:auto!important;width:28px!important;height:28px!important;min-width:28px!important;min-height:28px!important;padding:0!important;font-size:1em!important;line-height:1!important;transform:none!important}
${R} .bl-fruit-meta-toggle{grid-column:1;grid-row:1;justify-self:start;align-self:center;display:inline-flex;align-items:center;gap:.5em;min-height:28px;padding:2px 6px;border:1px solid var(--bl-fc-line);border-radius:6px;background:transparent;color:inherit;font:inherit;line-height:1.4;cursor:pointer}
${R} .bl-fruit-meta-toggle::after{content:'⌄';font-size:1em;line-height:1;transform:rotate(-90deg)}
${R} .bl-fruit-meta-toggle[aria-expanded="true"]::after{transform:none}
${R}[${META_ATTRIBUTE}="closed"] .fate-top-grid,${R}[${META_ATTRIBUTE}="closed"] .status-bar-content>.line-1,${R}[${META_ATTRIBUTE}="closed"] .status-bar-content>.line-2{display:none!important}
${R}.fate-status-wrapper .fate-top-grid{margin:0!important;padding-top:0!important}
${R}.fate-status-wrapper .fate-movie-quote-container{margin:0!important;padding:calc(var(--bl-fc-gap)*.5) 0!important;min-height:0!important}
${R}[${LAYOUT_ATTRIBUTE}="compact"] :is(.fate-bottom-section,.novel-preface){margin-top:calc(var(--bl-fc-gap)*.5)!important;padding-top:calc(var(--bl-fc-gap)*.5)!important}
${R}[${LAYOUT_ATTRIBUTE}="card"][${ATTRIBUTE}~="colors"]{box-shadow:0 2px 12px rgba(0,0,0,.08)!important;border:1px solid var(--bl-fc-line)!important}
${R}[${LAYOUT_ATTRIBUTE}="card"] .fate-grid-item{padding:.6em;border:1px solid var(--bl-fc-line);border-radius:calc(var(--bl-fc-radius)*.65)}
${R}[${LAYOUT_ATTRIBUTE}="card"][${ATTRIBUTE}~="colors"] .fate-grid-item{background:color-mix(in srgb,var(--bl-fc-accent) 5%,var(--bl-fc-bg))}
${R}[${LAYOUT_ATTRIBUTE}="title"] :is(.movie-line-content,.novel-title,.main-text){text-align:center!important;justify-content:center!important;font-size:1.2em!important;line-height:1.65!important}
${R}[${LAYOUT_ATTRIBUTE}="title"] .movie-huge-text{font-size:1.5em!important}
${R}[${LAYOUT_ATTRIBUTE}="title"] :is(.fate-grid-label,.novel-meta-label){letter-spacing:.08em!important}
${R} .bl-fruit-meta-toggle:focus-visible{outline:2px solid var(--bl-fc-accent);outline-offset:2px}
`;

function restoreLabels(state) {
    for (const [node, value] of state.labels) if (node.nodeValue === value.after) node.nodeValue = value.before;
    state.labels.clear();
    for (const [element, entries] of state.attributes) for (const [name, value] of entries) if (element.getAttribute(name) === value.after) element.setAttribute(name, value.before);
    state.attributes.clear();
}
function restoreRoot(root, previous) {
    if (!root.getAttribute(ATTRIBUTE)?.split(' ').includes('v1')) return;
    if (previous === null) root.removeAttribute(ATTRIBUTE); else root.setAttribute(ATTRIBUTE, previous);
}
function restoreFrameBody(state) {
    if (state.body?.getAttribute(FRAME_ATTRIBUTE) === 'v1') {
        if (state.bodyPrevious === null) state.body.removeAttribute(FRAME_ATTRIBUTE); else state.body.setAttribute(FRAME_ATTRIBUTE, state.bodyPrevious);
    }
    state.body = null;
}
function releaseDocument(doc, states = documents) {
    const state = states.get(doc); if (!state) return;
    state.observer?.disconnect(); restoreLabels(state);
    for (const [root, previous] of state.roots) { releaseDecoration(root,state); restoreRoot(root, previous); }
    restoreFrameBody(state); state.style?.remove(); states.delete(doc);
}
function currentTokens(nextConfig = config) {
    const css = getComputedStyle(document.documentElement), read = (key, fallback) => css.getPropertyValue(key).trim() || fallback;
    return {
        '--bl-fc-font': read('--salty-font-text', 'sans-serif'),
        '--bl-fc-text': read('--salty-text', '#eeeeee'), '--bl-fc-muted': read('--salty-muted', '#aaaaaa'),
        '--bl-fc-bg': read('--salty-surface', '#252629'), '--bl-fc-line': read('--salty-line', '#54565a'),
        '--bl-fc-accent': read('--salty-accent-ink', '#91cfff'),
        '--bl-fc-base-accent': read('--salty-accent', '#91cfff'),
        '--bl-fc-size': `${clamp(nextConfig.size, 12, 30, 16)}px`,
        '--bl-fc-gap': `${clamp(nextConfig.gap, 4, 24, 12)}px`, '--bl-fc-radius': `${clamp(nextConfig.radius, 0, 24, 12)}px`,
    };
}
function paintDocument(doc, scope, tokens, nextConfig = config, states = documents, onChange = schedule) {
    let state = states.get(doc);
    if (!state) {
        state = { roots: new Map(), decorations:new Map(), labels: new Map(), attributes: new Map(), body: null, bodyPrevious: null, style: null, css: '', observer: null };
        states.set(doc, state);
        if (doc !== document && doc.body) {
            state.observer = new MutationObserver(records => { if (records.some(relevantMutation)) onChange(); });
            state.observer.observe(doc.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['title','aria-label','class','data-theme','data-bl-preview-theme']});
        }
    }
    const roots = [...scope.querySelectorAll(ROOTS)].filter(known), live = new Set(roots);
    for (const [root, previous] of state.roots) if (!live.has(root)) { releaseDecoration(root,state); restoreRoot(root, previous); state.roots.delete(root); }
    if (!roots.length) { state.style?.remove(); state.style = null; state.css = ''; restoreLabels(state); restoreFrameBody(state); return; }
    if (doc !== document && doc.body && state.body !== doc.body) {
        restoreFrameBody(state); state.body = doc.body; state.bodyPrevious = doc.body.getAttribute(FRAME_ATTRIBUTE);
        doc.body.setAttribute(FRAME_ATTRIBUTE, 'v1');
    }
    const mode = ['v1', nextConfig.font !== false && 'font', nextConfig.colors !== false && 'colors'].filter(Boolean).join(' ');
    for (const root of roots) {
        if (!state.roots.has(root)) state.roots.set(root, root.getAttribute(ATTRIBUTE));
        if (root.getAttribute(ATTRIBUTE) !== mode) root.setAttribute(ATTRIBUTE, mode);
        decorateRoot(root,state,nextConfig);
    }
    if (!state.style?.isConnected) { state.style = doc.createElement('style'); state.style.dataset.blFruitCardStyle = '1'; (doc.head || doc.documentElement).append(state.style); state.css = ''; }
    const faces = doc !== document && nextConfig.font !== false ? document.getElementById('salty-fontfaces')?.textContent || '' : '';
    const css = `${R}{}\n${CSS}\n${CARD_LAYOUT_CSS}\n${faces}`;
    if (css !== state.css) { state.style.textContent = css; state.css = css; }
    const rule = state.style.sheet?.cssRules?.[0];
    if (rule?.style) for (const [key, value] of Object.entries(tokens)) if (rule.style.getPropertyValue(key) !== value) rule.style.setProperty(key, value);
    if (nextConfig.labels === false) restoreLabels(state);
    else {
        for (const [node, value] of state.labels) {
            if (!node.isConnected || !roots.some(root => root.contains(node))) { if (node.nodeValue === value.after) node.nodeValue = value.before; state.labels.delete(node); }
            else if (node.nodeValue !== value.after) state.labels.delete(node);
        }
        for (const [element, entries] of state.attributes) {
            for (const [name, value] of entries) {
                if (!element.isConnected || !roots.some(root => root.contains(element))) { if (element.getAttribute(name) === value.after) element.setAttribute(name, value.before); entries.delete(name); }
                else if (element.getAttribute(name) !== value.after) entries.delete(name);
            }
            if (!entries.size) state.attributes.delete(element);
        }
        for (const root of roots) for (const element of root.querySelectorAll(LABELS)) {
            for (const node of element.childNodes) {
                if (node.nodeType !== 3 || state.labels.has(node)) continue;
                const before = node.nodeValue, text = before.trim(), translated = labels.get(text);
                if (!translated) continue;
                const after = before.replace(text, translated); state.labels.set(node, {before, after}); node.nodeValue = after;
            }
        }
        for (const root of roots) for (const element of root.querySelectorAll(BUTTONS)) {
            for (const name of ['title', 'aria-label']) {
                if (state.attributes.get(element)?.has(name)) continue;
                const before = element.getAttribute(name), after = buttonLabels.get(before);
                if (!after) continue;
                let entries = state.attributes.get(element);
                if (!entries) { entries = new Map(); state.attributes.set(element, entries); }
                entries.set(name, {before, after}); element.setAttribute(name, after);
            }
        }
    }
}
function relevantMutation(record) { return record.type !== 'attributes' || ['title','aria-label'].includes(record.attributeName) || record.target.matches?.(ROOTS); }
function accessible(frameElement) {
    if (frameElement.hasAttribute('srcdoc')) return true;
    const src = frameElement.getAttribute('src'); if (!src || src === 'about:blank') return true;
    try { return new URL(src, document.baseURI).origin === location.origin; } catch { return false; }
}
function scan() {
    frame = 0; if (!active) return;
    const nextChat = document.getElementById('chat');
    if (nextChat !== chat) {
        chatObserver?.disconnect(); chat = nextChat;
        if (chat) { chatObserver = new MutationObserver(records => { if (records.some(relevantMutation)) schedule(); }); chatObserver.observe(chat, {childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','class','data-theme','data-bl-preview-theme']}); }
    }
    const tokens = currentTokens();
    const messages = chat?.querySelectorAll('.mes_text') || [];
    // The host style is scoped to recognized card roots; ordinary chat text is untouched.
    paintDocument(document, {querySelectorAll: selector => [...messages].flatMap(message => [...message.querySelectorAll(selector)])}, tokens);
    const live = new Set(chat?.querySelectorAll('.mes_text iframe') || []);
    for (const [element, state] of frames) if (!live.has(element)) { if (state.doc) releaseDocument(state.doc); frames.delete(element); }
    for (const element of live) {
        let state = frames.get(element);
        if (!state) { state = {doc:null, checked:false}; frames.set(element,state); }
        if (!state.checked) {
            state.checked = true;
            if (accessible(element)) try { state.doc = element.contentDocument; } catch { /* opaque or cross-origin */ }
        }
        if (state.doc?.body) paintDocument(state.doc, state.doc.body, tokens);
    }
}
function schedule() { if (active && !frame) frame = requestAnimationFrame(scan); }
function onLoad(event) {
    const element = event.target;
    if (element?.tagName !== 'IFRAME' || !element.closest('#chat .mes_text')) return;
    const state = frames.get(element); if (state?.doc) releaseDocument(state.doc);
    frames.delete(element); schedule();
}
function stop() {
    active = false; cancelAnimationFrame(frame); frame = 0;
    chatObserver?.disconnect(); discovery?.disconnect(); fontObserver?.disconnect();
    chatObserver = discovery = fontObserver = null; chat = null;
    document.removeEventListener('load', onLoad, true);
    for (const doc of [...documents.keys()]) releaseDocument(doc);
    frames.clear();
}
export function syncFruitCards(on, next = {}) {
    config = next;
    if (!on) { if (active) stop(); return; }
    if (!active) {
        active = true;
        document.addEventListener('load', onLoad, true);
        // Only direct body changes are needed to notice a replaced/late #chat.
        discovery = new MutationObserver(schedule); discovery.observe(document.body, {childList:true});
        fontObserver = new MutationObserver(records => { if (records.some(record => record.target.id === 'salty-fontfaces' || [...record.addedNodes].some(node => node.id === 'salty-fontfaces'))) schedule(); });
        fontObserver.observe(document.head, {childList:true,subtree:true,characterData:true});
    }
    schedule();
}

/** A separate synthetic document can use the same card paint engine without scanning chats. */
export function mountFruitCardPreview(doc, initial = {}) {
    if (!doc?.body || doc === document) throw new TypeError("A separate preview document is required");
    const states = new Map();let next = initial, pending = 0, disposed = false;
    const paint = () => { pending = 0; if (!disposed) paintDocument(doc, doc.body, currentTokens(next), next, states, queue); };
    const queue = () => { if (!disposed && !pending) pending = requestAnimationFrame(paint); };
    paint();
    return { update(value = {}) { next = value; queue(); }, dispose() { if (disposed) return; disposed = true; cancelAnimationFrame(pending); releaseDocument(doc, states); } };
}
