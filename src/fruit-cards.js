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
${R} .char-wrap{font-size:1.1em!important;letter-spacing:normal!important;margin:0!important}
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
function releaseDocument(doc) {
    const state = documents.get(doc); if (!state) return;
    state.observer?.disconnect(); restoreLabels(state);
    for (const [root, previous] of state.roots) restoreRoot(root, previous);
    restoreFrameBody(state); state.style?.remove(); documents.delete(doc);
}
function currentTokens() {
    const css = getComputedStyle(document.documentElement), read = (key, fallback) => css.getPropertyValue(key).trim() || fallback;
    return {
        '--bl-fc-font': read('--salty-font-text', 'sans-serif'),
        '--bl-fc-text': read('--salty-text', '#eeeeee'), '--bl-fc-muted': read('--salty-muted', '#aaaaaa'),
        '--bl-fc-bg': read('--salty-surface', '#252629'), '--bl-fc-line': read('--salty-line', '#54565a'),
        '--bl-fc-accent': read('--salty-accent-ink', '#91cfff'),
        '--bl-fc-size': `${clamp(config.size, 12, 30, 16)}px`,
        '--bl-fc-gap': `${clamp(config.gap, 4, 24, 12)}px`, '--bl-fc-radius': `${clamp(config.radius, 0, 24, 12)}px`,
    };
}
function paintDocument(doc, scope, tokens) {
    let state = documents.get(doc);
    if (!state) {
        state = { roots: new Map(), labels: new Map(), attributes: new Map(), body: null, bodyPrevious: null, style: null, css: '', observer: null };
        documents.set(doc, state);
        if (doc !== document && doc.body) {
            state.observer = new MutationObserver(schedule);
            state.observer.observe(doc.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['title','aria-label']});
        }
    }
    const roots = [...scope.querySelectorAll(ROOTS)].filter(known), live = new Set(roots);
    for (const [root, previous] of state.roots) if (!live.has(root)) { restoreRoot(root, previous); state.roots.delete(root); }
    if (!roots.length) { state.style?.remove(); state.style = null; state.css = ''; restoreLabels(state); restoreFrameBody(state); return; }
    if (doc !== document && doc.body && state.body !== doc.body) {
        restoreFrameBody(state); state.body = doc.body; state.bodyPrevious = doc.body.getAttribute(FRAME_ATTRIBUTE);
        doc.body.setAttribute(FRAME_ATTRIBUTE, 'v1');
    }
    const mode = ['v1', config.font !== false && 'font', config.colors !== false && 'colors'].filter(Boolean).join(' ');
    for (const root of roots) {
        if (!state.roots.has(root)) state.roots.set(root, root.getAttribute(ATTRIBUTE));
        if (root.getAttribute(ATTRIBUTE) !== mode) root.setAttribute(ATTRIBUTE, mode);
    }
    if (!state.style?.isConnected) { state.style = doc.createElement('style'); state.style.dataset.blFruitCardStyle = '1'; (doc.head || doc.documentElement).append(state.style); state.css = ''; }
    const faces = doc !== document && config.font !== false ? document.getElementById('salty-fontfaces')?.textContent || '' : '';
    const css = `${R}{}\n${CSS}\n${faces}`;
    if (css !== state.css) { state.style.textContent = css; state.css = css; }
    const rule = state.style.sheet?.cssRules?.[0];
    if (rule?.style) for (const [key, value] of Object.entries(tokens)) if (rule.style.getPropertyValue(key) !== value) rule.style.setProperty(key, value);
    if (config.labels === false) restoreLabels(state);
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
        if (chat) { chatObserver = new MutationObserver(schedule); chatObserver.observe(chat, {childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label']}); }
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
