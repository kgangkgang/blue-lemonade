// One reversible renderer for both dictionaries. No prompt values or chat text are written.
export function createPromptEngine(doc = document) {
    const sources = new Map(), changed = new Map(), hints = new Map();
    const normalize = value => String(value || '').normalize('NFKC').replace(/[\uFE0E\uFE0F\s]/g, '');
    let observer, timer, lastId = null, ordered = [];
    const watched='li[data-pm-identifier],#completion_prompt_manager_footer_append_prompt,.regex-script-label,div.regex_script_name,li.regex-debugger-rule,#completion_prompt_manager_popup_entry_form_name,input.regex_script_name';
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
                const partial = list.partial.find(e=>key.includes(e.key))?.entry;
                if (partial) return partial;
            }
        }
        return null;
    }
    function paint(el, kind, id) {
        let state = changed.get(el);
        if (state && el.textContent !== state.after) { changed.delete(el); state = null; }
        const original = state?.before ?? el.textContent;
        const name = el.getAttribute('title') || original;
        const entry = lookup(kind, id, name);
        // Leave another extension's translations alone.
        if (!state && el.getAttribute('title') && normalize(original) !== normalize(name)) return;
        const next = entry?.title ?? original;
        if (next !== el.textContent) el.textContent = next;
        if (entry) changed.set(el, {before:original,after:next});
        else changed.delete(el);
    }
    function hint(input, kind, id) {
        const entry = lookup(kind,id,input.value);
        let el = hints.get(input);
        if (!entry) { el?.remove(); hints.delete(input); return; }
        if (!el) { el=doc.createElement('small'); el.className='bl-script-hint'; input.insertAdjacentElement('afterend',el); hints.set(input,el); }
        const text = `→ ${entry.title}${entry.desc ? '\n'+entry.desc : ''}`;
        if (el.textContent !== text) el.textContent=text;
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
    }
    function schedule() { if (!timer) timer=setTimeout(render,60); }
    function click(event) { const row=event.target.closest?.('li[data-pm-identifier]'); if(row)lastId=row.dataset.pmIdentifier; if(event.target.closest?.(watched))schedule(); }
    function input(event) {if(event.target.matches?.('#completion_prompt_manager_popup_entry_form_name,input.regex_script_name'))schedule();}
    function start() {
        observer=new MutationObserver(records=>{
            const containsTarget=node=>node.nodeType===1&&(node.matches(watched)||!!node.querySelector(watched));
            if(records.some(record=>{
                const el=record.target.nodeType===1?record.target:record.target.parentElement;
                if(!el||el.closest('#chat,.bl-scripts,.bl-script-hint'))return false;
                if(changed.has(el)&&el.textContent===changed.get(el).after)return false;
                return !!el.closest(watched)||[...record.addedNodes,...record.removedNodes].some(containsTarget);
            }))schedule();
        });
        observer.observe(doc.body,{childList:true,subtree:true,characterData:true});
        doc.addEventListener('click',click); doc.addEventListener('input',input);
    }
    function stop() {
        observer?.disconnect(); observer=null; clearTimeout(timer);timer=null;
        doc.removeEventListener('click',click); doc.removeEventListener('input',input);
        for(const [el,state] of changed) if(el.textContent===state.after)el.textContent=state.before;
        changed.clear(); for(const el of hints.values())el.remove();hints.clear();
    }
    return {register(id,data){
        if(!sources.size)start(); sources.set(id,compile(data));order();render();
        return ()=>{sources.delete(id);order();if(sources.size)render();else stop();};
    },stop};
}
