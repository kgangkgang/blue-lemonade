// Display-only fixed labels in the known Fruit status renderer. No preset or message writes.
const LABELS = new Map([['DATE','날짜'],['TIME','시간'],['LOC.','장소'],['WTHR','날씨']]);
const FOOTER = new Map([['My heart found you,before my mind understood.','머리로 알기 전에, 마음이 먼저 너를 알아봤어.']]);
const DECOR = new Map([['SCENE','장면'],['MOMENT','순간'],['SILENT','고요'],['FLOWING','흐름'],['WHISPER','속삭임'],['ECHO','메아리']]);
const HINTS = new Map([['切换夜间模式','어두운 모드로 전환'],['切换日间模式','밝은 모드로 전환'],['切换主题','테마 전환'],['切换日夜','밝은/어두운 모드 전환'],['切换日/夜模式','밝은/어두운 모드 전환'],['切换日夜模式','밝은/어두운 모드 전환'],['切换为深色模式','어두운 모드로 전환'],['切换为浅色模式','밝은 모드로 전환'],['切换为日间','밝은 모드로 전환'],['切换为夜间','어두운 모드로 전환']]);
const FALLBACK = new Map([['沉默不语，时光流淌','말없이 시간이 흘러간다.']]);
const ROOT = '.fate-status-wrapper,.vintage-prologue,.novel-header-container,#meowFM-OptionCard,#post-it-card.post-it-container';
const NOVEL = new Map([['CP','관계'],['AT','장소']]);
const CHOICE = new Map([['Choose · Sth.','선택하기']]);
const SKIP = 'script,style,textarea,input,pre,code,[contenteditable="true"],.fate-raw,[data-f]';

export function installFruitStatusKorean(doc = document, host = window) {
    const texts = new Map(), attributes = new Map(), cards = new Map(), documents = new Map(), frames = new Map();
    let stopped = false, scheduled = 0;
    const schedule = () => { if (!stopped && !scheduled) scheduled = host.requestAnimationFrame(flush); };
    function restoreText(node) {
        const old = texts.get(node);
        if (old && node.nodeValue === old.shown) node.nodeValue = old.original;
        texts.delete(node);
    }
    function restoreAttribute(node, name, old) {
        if (node.getAttribute(name) === old.shown) node.setAttribute(name, old.original);
    }
    function swap(node, shown) {
        if (node.nodeValue === shown) return;
        const old = texts.get(node);
        texts.set(node, {original: old && node.nodeValue === old.shown ? old.original : node.nodeValue, shown});
        node.nodeValue = shown;
    }
    // Keep every existing element and text node: the renderer splits its quote into styled characters.
    function translate(element, dictionary, used, exclude = '') {
        if (element.closest(SKIP)) return;
        const walker = element.ownerDocument.createTreeWalker(element, 4), nodes = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.parentElement?.closest(SKIP) && !(exclude && node.parentElement?.closest(exclude))) nodes.push(node);
        }
        const raw = nodes.map(n => { const old = texts.get(n); return old && n.nodeValue === old.shown ? old.original : n.nodeValue; }).join('');
        const value = dictionary.get(raw.trim());
        if (!value) return;
        const output = raw.match(/^\s*/)[0] + value + raw.match(/\s*$/)[0];
        let offset = 0;
        nodes.forEach((node, i) => {
            const old = texts.get(node), size = old && node.nodeValue === old.shown ? old.original.length : node.nodeValue.length;
            const next = i === nodes.length - 1 ? output.slice(offset) : output.slice(offset, offset + size);
            offset += size; used.add(node); swap(node, next);
        });
    }
    function paint() {
        const used = new Set(), attrUsed = new Map();
        for (const card of cards.keys()) {
            if (!card.isConnected) continue;
            for (const [selector, words] of [['.fate-grid-label',LABELS],['.fate-bottom-en',FOOTER],['.movie-deco-eng',DECOR],['.novel-meta-label,.novel-cp-row-label',NOVEL],['.corner-info.corner-text',CHOICE]]) {
                for (const el of card.querySelectorAll(selector)) translate(el, words, used);
            }
            for (const el of card.querySelectorAll('.movie-line-content')) translate(el, FALLBACK, used, '.movie-deco-eng');
            for (const el of card.querySelectorAll('.fate-theme-toggle,.mom-theme-toggle,.theme-toggle-btn,#prologue-theme-btn,.theme-toggle')) {
                if (el.closest(SKIP)) continue;
                const names = new Set(); attrUsed.set(el, names);
                for (const name of ['title','aria-label']) {
                    const current = el.getAttribute(name), old = attributes.get(el)?.get(name);
                    const source = old && current === old.shown ? old.original : current;
                    const shown = HINTS.get(source);
                    if (!shown) continue;
                    names.add(name);
                    if (!attributes.has(el)) attributes.set(el, new Map());
                    attributes.get(el).set(name, {original: source, shown});
                    if (current !== shown) el.setAttribute(name, shown);
                }
            }
        }
        for (const node of texts.keys()) if (!used.has(node)) restoreText(node);
        for (const [el, names] of attributes) {
            for (const [name, old] of names) if (!attrUsed.get(el)?.has(name)) { restoreAttribute(el, name, old); names.delete(name); }
            if (!names.size) attributes.delete(el);
        }
    }
    function flush() {
        scheduled = 0;
        if (stopped) return;
        const liveDocs = new Set(), liveCards = new Set(), liveFrames = new Set();
        function visit(current, scope) {
            if (!scope || liveDocs.has(current)) return;
            liveDocs.add(current);
            let entry = documents.get(current);
            if (!entry || entry.scope !== scope) {
                entry?.observer.disconnect();
                const observer = new host.MutationObserver(records => {
                    if (records.some(r => [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1))) schedule();
                });
                observer.observe(scope, {childList: true, subtree: true});
                documents.set(current, {scope, observer});
            }
            for (const card of scope.querySelectorAll(ROOT)) {
                if (card.closest(SKIP)) continue;
                liveCards.add(card);
                if (!cards.has(card)) {
                    const observer = new host.MutationObserver(schedule);
                    observer.observe(card, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title','aria-label','class','contenteditable','data-f']});
                    cards.set(card, observer);
                }
            }
            for (const frame of scope.querySelectorAll('iframe')) {
                liveFrames.add(frame);
                if (!frames.has(frame)) { frame.addEventListener('load', schedule); frames.set(frame, schedule); }
                try { const inner = frame.contentDocument; if (inner?.body) visit(inner, inner.body); } catch { /* foreign origin */ }
            }
        }
        visit(doc, doc.querySelector('#chat'));
        for (const [current, entry] of documents) if (!liveDocs.has(current)) { entry.observer.disconnect(); documents.delete(current); }
        for (const [card, observer] of cards) if (!liveCards.has(card)) { observer.disconnect(); cards.delete(card); }
        for (const [frame, listener] of frames) if (!liveFrames.has(frame)) { frame.removeEventListener('load', listener); frames.delete(frame); }
        paint();
    }
    const timer = host.setInterval(schedule, 1500); // discovers a replaced chat root without observing the whole page
    flush();
    return () => {
        if (stopped) return;
        stopped = true; host.clearInterval(timer); host.cancelAnimationFrame(scheduled);
        for (const entry of documents.values()) entry.observer.disconnect();
        for (const observer of cards.values()) observer.disconnect();
        for (const [frame, listener] of frames) frame.removeEventListener('load', listener);
        for (const node of texts.keys()) restoreText(node);
        for (const [el, names] of attributes) for (const [name, old] of names) restoreAttribute(el, name, old);
        documents.clear(); cards.clear(); frames.clear(); attributes.clear();
    };
}
