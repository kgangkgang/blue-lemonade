// One reversible renderer for both dictionaries. No prompt values or chat text are written.
export function createPromptEngine(doc = document) {
    const sources = new Map(), changed = new Map(), hints = new Map();
    const normalize = value => String(value || '').normalize('NFKC').replace(/[\uFE0E\uFE0F\s]/g, '');
    let observer, timer, lastId = null;
    function lookup(kind, id, name) {
        const key = normalize(name);
        for (const source of [...sources.values()].sort((a,b) => b.priority-a.priority)) {
            const list = source[kind] || [];
            const exact = list.find(e => id && e.id === id && (!key || normalize(e.name) === key))
                || list.find(e => normalize(e.name) === key);
            if (exact) return exact;
            if (kind === 'prompts' && source.partial && key) {
                const partial = list.filter(e => key.includes(normalize(e.name))).sort((a,b) => b.name.length-a.name.length)[0];
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
    function click(event) { const row=event.target.closest?.('li[data-pm-identifier]'); if(row)lastId=row.dataset.pmIdentifier; schedule(); }
    function input(event) {if(event.target.matches?.('#completion_prompt_manager_popup_entry_form_name,input.regex_script_name'))schedule();}
    function start() {
        observer=new MutationObserver(records=>{
            if (records.some(r=>{const el=r.target.nodeType===1?r.target:r.target.parentElement; return !el?.closest('#chat, .bl-scripts, .bl-script-hint');})) schedule();
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
        if(!sources.size)start(); sources.set(id,data);render();
        return ()=>{sources.delete(id);if(sources.size)render();else stop();};
    },stop};
}
