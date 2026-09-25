// One reversible renderer for both dictionaries. No prompt values or chat text are written.
export function createPromptEngine(doc = document) {
    const sources = new Map(), changed = new Map(), hints = new Map(), titles = new Map();
    const normalize = value => String(value || '').normalize('NFKC').replace(/[\uFE0E\uFE0F\s]/g, '');
    let observer, timer, lastId = null, ordered = [];
    const watched='li[data-pm-identifier],#completion_prompt_manager_footer_append_prompt,.regex-script-label,div.regex_script_name,li.regex-debugger-rule,#completion_prompt_manager_popup_entry_form_name,input.regex_script_name';
    // These open or clear the edit form without a mutation we watch, so re-render after them too.
    const formButtons=',.completion_prompt_manager_footer .menu_button,#completion_prompt_manager_popup_entry_form_close,#completion_prompt_manager_popup_close_button';
    function compile(data) {
        const result={priority:Number(data.priority)||0,partial:!!data.partial};
        for(const kind of ['prompts','regex']){
            const names=new Map(),ids=new Map(),partial=[];
            for(const entry of data[kind]||[]){
                const key=normalize(entry.name);if(!key)continue;
                if(!names.has(key))names.set(key,entry);
                if(entry.id){if(!ids.has(entry.id))ids.set(entry.id,[]);ids.get(entry.id).push({key,entry});}
                partial.push({key,entry});
            }
            partial.sort((a,b)=>b.entry.name.length-a.entry.name.length);
            result[kind]={names,ids,partial};
        }
        return result;
    }
    const order=()=>{ordered=[...sources.values()].sort((a,b)=>b.priority-a.priority);};
    function lookup(kind, id, name) {
        const key = normalize(name);
        for (const source of ordered) {
            const list = source[kind];
            const exact = list.ids.get(id)?.find(e=>!key||e.key===key)?.entry || list.names.get(key);
            if (exact) return exact;
            if (kind === 'prompts' && source.partial && key) {
                const hit = list.partial.find(e=>key.includes(e.key));
                if (hit) return partialEntry(hit, key, name);
            }
        }
        return kind === 'prompts' ? variant(name) : null;
    }
    // A partial hit keeps the preset's own markers around it (×, └) as written; a remainder with letters or digits is still dropped.
    function partialEntry(hit, key, name) {
        const at = key.indexOf(hit.key), marker = s => !/[\p{L}\p{N}]/u.test(s) && /[\p{S}\p{P}]/u.test(s);
        const pre = key.slice(0, at), post = key.slice(at + hit.key.length);
        const keepPre = marker(pre), keepPost = marker(post);
        if (!keepPre && !keepPost) return hit.entry;
        // Cut the same text out of the original name, spacing included; fall back to the normalized text.
        const chars = [...String(name || '')], part = (a, b) => chars.slice(a, b).join('');
        const head = () => { for (let i = chars.length; i > 0; i--) if (normalize(part(0, i)) === pre) return part(0, i).trimStart(); return pre + ' '; };
        const tail = () => { for (let i = 0; i < chars.length; i++) if (normalize(part(i)) === post) return part(i).trimEnd(); return ' ' + post; };
        return {...hit.entry, title: (keepPre ? head() : '') + hit.entry.title + (keepPost ? tail() : '')};
    }
    // A user's copy named "Original (memo)" shows the original's translation with the same memo.
    function variant(name) {
        const match = /^(.*\S)\s*\(([^()]+)\)\s*([^\s()]*)\s*$/.exec(String(name || ''));
        if (!match) return null;
        const base = lookup('prompts', null, `${match[1]} ${match[3]}`);
        if (!base) return null;
        const title = match[3] && base.title.endsWith(match[3])
            ? `${base.title.slice(0, -match[3].length).trimEnd()} (${match[2]}) ${match[3]}`
            : `${base.title} (${match[2]})`;
        return {...base, title};
    }
    function paint(el, kind, id) {
        let state = changed.get(el);
        if (state && el.textContent !== state.after) { changed.delete(el); state = null; }
        const original = state?.before ?? el.textContent;
        const name = titles.get(el)?.before || el.getAttribute('title') || original;
        const entry = lookup(kind, id, name);
        // Leave another extension's translations alone.
        if (!state && el.getAttribute('title') && normalize(original) !== normalize(name)) return;
        const next = entry?.title ?? original;
        if (next !== el.textContent) el.textContent = next;
        if (entry) changed.set(el, {before:original,after:next});
        else changed.delete(el);
    }
    function hint(input, kind, id) {
        // An empty name gets no hint; otherwise the last clicked row's id would label a new prompt.
        const entry = normalize(input.value) ? lookup(kind,id,input.value) : null;
        let el = hints.get(input);
        if (!entry) { el?.remove(); hints.delete(input); return; }
        if (!el) { el=doc.createElement('small'); el.className='bl-script-hint'; input.insertAdjacentElement('afterend',el); hints.set(input,el); }
        const text = `→ ${entry.title}${entry.desc ? '\n'+entry.desc : ''}`;
        if (el.textContent !== text) el.textContent=text;
    }
    function translateTitle(el) {
        let state=titles.get(el);
        if(state&&el.getAttribute('title')!==state.after){titles.delete(el);state=null;}
        const original=state?.before??el.getAttribute('title');
        const entry=lookup('regex',el.parentElement?.id,original);
        const next=entry?.title??original;
        if(next!==el.getAttribute('title'))el.setAttribute('title',next);
        if(entry)titles.set(el,{before:original,after:next});else titles.delete(el);
    }
    function render() {
        timer=null;
        for (const [el] of changed) if (!el.isConnected) changed.delete(el);
        for (const [input,el] of hints) if (!input.isConnected) {el.remove();hints.delete(input);}
        doc.querySelectorAll('li[data-pm-identifier] .completion_prompt_manager_prompt_name > a.prompt-manager-inspect-action, li[data-pm-identifier] .completion_prompt_manager_prompt_name > span[title]:not([class])').forEach(el => paint(el,'prompts',el.closest('li').dataset.pmIdentifier));
        doc.querySelectorAll('#completion_prompt_manager_footer_append_prompt option').forEach(el=>paint(el,'prompts',el.value));
        doc.querySelectorAll('.regex-script-label[id] > .regex_script_name, div.regex_script_name[title], li.regex-debugger-rule[data-id] .rule-name').forEach(el=>paint(el,'regex',el.closest('li.regex-debugger-rule')?.dataset.id || el.parentElement.id));
        doc.querySelectorAll('#completion_prompt_manager_popup_entry_form_name').forEach(el=>hint(el,'prompts',lastId));
        doc.querySelectorAll('input.regex_script_name').forEach(el=>hint(el,'regex',null));
        for(const [el] of titles)if(!el.isConnected)titles.delete(el);
        doc.querySelectorAll('#saved_preset_scripts [title],#saved_regex_scripts [title],#saved_scoped_scripts [title]').forEach(translateTitle);
    }
    function schedule() { if (!timer) timer=setTimeout(render,60); }
    function click(event) { const row=event.target.closest?.('li[data-pm-identifier]'); if(row)lastId=row.dataset.pmIdentifier; if(event.target.closest?.(watched+formButtons))schedule(); }
    function input(event) {if(event.target.matches?.('#completion_prompt_manager_popup_entry_form_name,input.regex_script_name'))schedule();}
    // #chat 은 보지 않는다: 스트리밍 답은 토큰마다 채팅을 바꿔 body 전체를 보면 그때마다 콜백이 돌았다.
    // body 에서 #chat 까지의 조상은 자식 목록만, 그 밖의 가지(설정 서랍 · 팝업 · 템플릿)는 통째로 본다.
    const FULL={childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title']};
    let chain=new Set();
    function watch(node){
        if(node.nodeType!==1||node.id==='chat')return;
        if(chain.has(node)){observer.observe(node,{childList:true});for(const child of node.children)watch(child);}
        else observer.observe(node,FULL);
    }
    function watchAll(){
        const chat=doc.getElementById('chat');
        chain=new Set();
        if(!chat||!doc.body.contains(chat)){observer.observe(doc.body,FULL);return;}
        for(let n=chat.parentElement;n&&n!==doc.body;n=n.parentElement)chain.add(n);
        observer.observe(doc.body,{childList:true});
        for(const child of doc.body.children)watch(child);
    }
    function start() {
        observer=new MutationObserver(records=>{
            const containsTarget=node=>node.nodeType===1&&(node.matches(watched)||!!node.querySelector(watched));
            // body · #chat 조상에 새로 붙은 가지(팝업 등)도 보기 시작한다
            for(const record of records)if(record.type==='childList'&&(record.target===doc.body||chain.has(record.target)))record.addedNodes.forEach(watch);
            if(records.some(record=>{
                const el=record.target.nodeType===1?record.target:record.target.parentElement;
                if(!el||el.closest('#chat,.bl-scripts,.bl-script-hint'))return false;
                if(record.type==='attributes'&&titles.get(el)?.after===el.getAttribute('title'))return false;
                if(record.type!=='attributes'&&changed.has(el)&&el.textContent===changed.get(el).after)return false;
                return !!el.closest(watched+',#saved_preset_scripts,#saved_regex_scripts,#saved_scoped_scripts')||[...record.addedNodes,...record.removedNodes].some(containsTarget);
            }))schedule();
        });
        watchAll();
        doc.addEventListener('click',click); doc.addEventListener('input',input);
    }
    function stop() {
        observer?.disconnect(); observer=null; clearTimeout(timer);timer=null;
        doc.removeEventListener('click',click); doc.removeEventListener('input',input);
        for(const [el,state] of changed) if(el.textContent===state.after)el.textContent=state.before;
        for(const [el,state] of titles)if(el.getAttribute('title')===state.after)el.setAttribute('title',state.before);titles.clear();
        changed.clear(); for(const el of hints.values())el.remove();hints.clear();
    }
    return {register(id,data){
        if(!sources.size)start(); sources.set(id,compile(data));order();render();
        return ()=>{sources.delete(id);order();if(sources.size)render();else stop();};
    },stop};
}
