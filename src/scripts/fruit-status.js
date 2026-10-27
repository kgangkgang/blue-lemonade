// Display-only fixed labels in the known Fruit status renderer. No preset or message writes.
const LABELS = new Map([['DATE','날짜'],['TIME','시간'],['LOC.','장소'],['WTHR','날씨']]);
const FOOTER = new Map([['My heart found you,before my mind understood.','머리로 알기 전에, 마음이 먼저 너를 알아봤어.']]);
const DECOR = new Map([['SCENE','장면'],['MOMENT','순간'],['SILENT','고요'],['FLOWING','흐름'],['WHISPER','속삭임'],['ECHO','메아리']]);
const HINTS = new Map([['切换夜间模式','어두운 모드로 전환'],['切换日间模式','밝은 모드로 전환'],['切换主题','테마 전환'],['切换日夜','밝은/어두운 모드 전환'],['切换日/夜模式','밝은/어두운 모드 전환'],['切换日夜模式','밝은/어두운 모드 전환'],['切换为深色模式','어두운 모드로 전환'],['切换为浅色模式','밝은 모드로 전환'],['切换为日间','밝은 모드로 전환'],['切换为夜间','어두운 모드로 전환'],['暂停','일시정지'],['播放','재생'],['Enter name...','이름 입력…']]);
const FALLBACK = new Map([['沉默不语，时光流淌','말없이 시간이 흘러간다.']]);
const ROOT = '.fate-status-wrapper,.vintage-prologue,.novel-header-container,#meowFM-OptionCard,#post-it-card.post-it-container,#gh-ctr.greenhouse,#statusBar.dynamic-status-container,.mobile-screen #settings-panel,.swiss-island';
const NOVEL = new Map([['CP','관계'],['AT','장소']]);
const CHOICE = new Map([['Choose · Sth.','선택하기']]);
const THEATRE_HEADER = new Map(Object.entries({"☽ 纯文字小剧场美化": "☽ 순수 텍스트 소극장"}));
const THEATRE_CREDIT = new Map(Object.entries({"二改自 @电波系": "재수정 원본: @电波系"}));
const THEATRE_BUTTON = new Map(Object.entries({"↑ 回到顶部": "↑ 맨 위로"}));
const PHONE = new Map(Object.entries({"显示设置": "표시 설정", "手机背景图": "휴대폰 배경 이미지", "对方头像": "상대 프로필 이미지", "我的头像": "내 프로필 이미지", "对方气泡颜色 (渐变)": "상대 말풍선 색 (그라데이션)", "我的气泡颜色 (渐变)": "내 말풍선 색 (그라데이션)", "气泡透明度": "말풍선 불투명도", "保存并关闭": "저장하고 닫기", "恢复默认设置": "기본 설정으로 복원"}));
const ISLAND = new Map(Object.entries({"LOCATION / TIME": "위치 / 시간", "OUTFIT / POSE": "옷차림 / 자세", "CURRENT MOOD": "현재 기분", "PRIVATE SEARCH": "검색 기록", "AUDIO LOG": "음악", "SYSTEM SETTINGS": "화면 설정", "Coordinates": "위치", "Local Time": "현지 시간", "Upper": "상의", "Lower": "하의", "Pose": "자세", "QUERY": "검색어", "TIMESTAMP": "시각", "暂无搜索记录": "검색 기록이 없어요", "Display Name": "표시 이름", "Background Image": "배경 이미지", "Upload (GIF/PNG/JPG)": "이미지 올리기 (GIF/PNG/JPG)", "ACTIVE TRACKING": "현재 상태", "Image is too large. Only available this session.": "이미지가 커서 이번 접속 동안만 적용돼요.", "Image is saved locally in browser.": "이미지가 이 브라우저에 저장돼요."}));
const DIALOGS = new Map([['确定要恢复所有默认设置吗？','모든 설정을 기본값으로 복원할까요?'],['图片较大，无法永久保存。背景将在本次会话中生效，刷新页面后会恢复默认。','이미지가 커서 저장하지 못했어요. 이번 접속 동안만 배경이 적용되고, 새로고침하면 기본 배경으로 돌아가요.'],['读取文件失败，请重试。','파일을 읽지 못했어요. 다시 시도해 주세요.']]);
const SKIP = 'script,style,textarea,input,pre,code,[contenteditable="true"],.fate-raw,[data-f]';
// The renderer lifts its day/night toggle 4px above the card (top:-4px in both modes of the global-regex build; the preset
// build lowers only day mode), and its hover lift (sticky after a tap on phones) moves it 1px further, so the frame edge clips
// the top of the circle. Keep it inside in both modes, no lift on touch screens, and give it a 44px touch square (::after)
// that stays inside the frame corner (10-27 report: half-cut moon in chat and in the settings sample). The preset build's day
// mode adds 12px side padding to a width:100% card; border-box keeps that card (and the toggle) inside a frame without a global
// box-sizing rule.
// The quote block: the renderer puts the short rule (::before, 40px + 15px gap) at the start of the first flex row and the small
// title (.movie-deco-eng) absolutely at left:55px above the first glyph, so both sit left of centre. The user wants the title,
// the rule and the quote centred: the title and the rule each take a full row (order -1 / 0) and centre themselves; the rule is
// painted as a centred 40px background on a full-width row (same colour variable, no new colour); the big first glyph's
// one-sided margin-right:4px is mirrored so the first row centres too, and the title's 3px letter-spacing after its last letter
// is balanced by a 3px indent. A non-original quote alignment from the typography settings moves the rule with the text
// (fruitTypeCss sets its background-position).
const toggleMask = shape => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`)}")`;
const sunMask = toggleMask('<circle cx="12" cy="12" r="4.5" fill="black" stroke="none"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>');
const moonMask = toggleMask('<path d="M20.9 13.5A9 9 0 0 1 10.5 3.1 9 9 0 1 0 20.9 13.5Z"/>');
const FIXES = `.fate-status-wrapper{box-sizing:border-box}
.fate-status-wrapper>.fate-theme-toggle{top:3px!important;right:2px!important}
.fate-status-wrapper>.fate-theme-toggle::after{content:"";position:absolute;top:-3px;right:-2px;bottom:-15px;left:-16px;background:transparent}
.fate-status-wrapper>.fate-theme-toggle{font-size:0!important;line-height:0!important;--bl-fruit-toggle-mask:${moonMask}}
.fate-status-wrapper.night-mode>.fate-theme-toggle{--bl-fruit-toggle-mask:${sunMask}}
.fate-status-wrapper>.fate-theme-toggle::before{content:"";position:absolute;inset:0;margin:auto;display:block;width:14px;height:14px;background:currentColor;-webkit-mask:var(--bl-fruit-toggle-mask) center/contain no-repeat;mask:var(--bl-fruit-toggle-mask) center/contain no-repeat;pointer-events:none}
@media (hover:none){.fate-status-wrapper>.fate-theme-toggle:hover{transform:none!important}}
.fate-status-wrapper .movie-line-content>.movie-deco-eng{position:static;order:-1;flex:0 0 100%;width:100%;text-align:center;text-indent:3px;margin:0 0 6px}
.fate-status-wrapper .movie-line-content::before{flex:0 0 100%;width:100%;margin:0 0 10px;background-color:transparent;background-image:linear-gradient(var(--ft-text-light),var(--ft-text-light));background-size:40px 1px;background-position:center top;background-repeat:no-repeat}
.fate-status-wrapper .movie-line-content>.movie-huge-text{margin-left:4px}`;

export function installFruitStatusKorean(doc = document, host = window) {
    const texts = new Map(), attributes = new Map(), cards = new Map(), documents = new Map(), frames = new Map(), dialogChanges = new Map(), fixes = new Map();
    let stopped = false, scheduled = 0, lastSig = '';
    // 7.0.3 long chats: the 1.5 s timer only rescans when the chat root or an iframe document changed (observers and iframe load report the rest)
    const ids=new WeakMap();let nextId=1;const idOf=o=>{if(!o)return 0;let i=ids.get(o);if(!i)ids.set(o,i=nextId++);return i;};
    const frameSig=(withCounts=false)=>{const out=[];const walk=(scope,depth)=>{out.push(idOf(scope));if(!scope||depth>3)return;for(const f of scope.querySelectorAll('iframe')){let d=null;try{d=f.contentDocument;}catch{}out.push(idOf(d));if(withCounts)out.push(d?.querySelectorAll?.('*').length||0);if(d?.body)walk(d.body,depth+1);}};walk(doc.querySelector('#chat'),0);return out.join(',');};
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
            for (const [selector, words, exclude] of [['.fate-grid-label',LABELS],['.fate-bottom-en',FOOTER],['.movie-deco-eng',DECOR],['.novel-meta-label,.novel-cp-row-label',NOVEL],['.corner-info.corner-text',CHOICE],['.bar-label',THEATRE_HEADER,'.bar-credit'],['.bar-credit',THEATRE_CREDIT],['.to-top-btn',THEATRE_BUTTON],['.settings-title,.settings-group label,#save-settings-btn,#reset-settings-btn',PHONE,'#opacity-value'],['.detail-header-title,.detail-label,.search-header span,.search-list > .text-desc,.info-stack > .text-desc,.file-upload-label span,.status-text',ISLAND]]) {
                for (const el of card.querySelectorAll(selector)) translate(el, words, used, exclude);
            }
            for (const el of card.querySelectorAll('.movie-line-content')) translate(el, FALLBACK, used, '.movie-deco-eng');
            for (const el of card.querySelectorAll('.fate-theme-toggle,.mom-theme-toggle,.theme-toggle-btn,#prologue-theme-btn,.theme-toggle,#gh-theme-btn,.play-btn,input.setting-input')) {
                if (el.closest(SKIP) && !el.matches('input.setting-input')) continue;
                const names = new Set(); attrUsed.set(el, names);
                for (const name of ['title','aria-label','placeholder']) {
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
    function attachDialogs(current) {
        if (current === doc || dialogChanges.has(current) || !current.defaultView) return;
        const win = current.defaultView, records = [];
        for (const name of ['alert','confirm']) {
            const original = win[name];
            if (typeof original !== 'function') continue;
            const entry = {win,name,original,active:true};
            entry.wrapped = function(...args) { if (entry.active && !stopped && DIALOGS.has(args[0])) args[0] = DIALOGS.get(args[0]); return original.apply(this,args); };
            win[name] = entry.wrapped; records.push(entry);
        }
        dialogChanges.set(current,records);
    }
    function restoreDialogs(current) {
        for (const entry of dialogChanges.get(current) || []) {
            entry.active = false;
            if (entry.win[entry.name] === entry.wrapped) entry.win[entry.name] = entry.original;
        }
        dialogChanges.delete(current);
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
                attachDialogs(current);
                if (card.matches('.fate-status-wrapper') && typeof current.createElement === 'function' && !fixes.get(current)?.isConnected) { const style = current.createElement('style'); style.dataset.blFruitStatusFix = ''; style.textContent = FIXES; (current.head || current.documentElement).append(style); fixes.set(current, style); }
                if (!cards.has(card)) {
                    const observer = new host.MutationObserver(schedule);
                    observer.observe(card, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title','aria-label','placeholder','class','contenteditable','data-f']});
                    cards.set(card, observer);
                }
            }
            for (const frame of scope.querySelectorAll('iframe')) {
                liveFrames.add(frame);
                if (!frames.has(frame)) { frame.addEventListener('load', schedule); frames.set(frame, schedule); }
                try { const inner = frame.contentDocument; if (inner?.body) visit(inner, inner.body); } catch { /* foreign origin */ }
            }
        }
        visit(doc, doc.querySelector('#chat')); lastSig = frameSig();
        for (const [current, entry] of documents) if (!liveDocs.has(current)) { entry.observer.disconnect(); documents.delete(current); }
        for (const [card, observer] of cards) if (!liveCards.has(card)) { observer.disconnect(); cards.delete(card); }
        for (const [frame, listener] of frames) if (!liveFrames.has(frame)) { frame.removeEventListener('load', listener); frames.delete(frame); }
        for (const current of dialogChanges.keys()) if (![...liveCards].some(card=>card.ownerDocument===current)) restoreDialogs(current);
        for (const [current, style] of fixes) if (![...liveCards].some(card=>card.ownerDocument===current&&card.matches('.fate-status-wrapper'))) { style.remove(); fixes.delete(current); }
        paint();
    }
    const timer = host.setInterval(() => { if (frameSig() !== lastSig) schedule(); }, 1500); // discovers a replaced chat root without observing the whole page
    flush();
    return () => {
        if (stopped) return;
        stopped = true; host.clearInterval(timer); host.cancelAnimationFrame(scheduled);
        for (const entry of documents.values()) entry.observer.disconnect();
        for (const observer of cards.values()) observer.disconnect();
        for (const [frame, listener] of frames) frame.removeEventListener('load', listener);
        for (const node of texts.keys()) restoreText(node);
        for (const [el, names] of attributes) for (const [name, old] of names) restoreAttribute(el, name, old);
        for (const current of dialogChanges.keys()) restoreDialogs(current);
        for (const style of fixes.values()) style.remove();
        fixes.clear(); documents.clear(); cards.clear(); frames.clear(); attributes.clear();
    };
}
