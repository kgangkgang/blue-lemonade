// One reversible renderer for both dictionaries. No prompt values or chat text are written.
import { watchWith } from '../dom-watch.js';
export function createPromptEngine(doc = document) {
    const sources = new Map(), changed = new Map(), hints = new Map(), titles = new Map();
    const DETAILS = Symbol('prompt-details'), detailsInputs = new Set();
    let detailsObserver = null;
    const normalize = value => String(value || '').normalize('NFKC').replace(/[\uFE0E\uFE0F\s]/g, '');
    let observer, timer, lastId = null, ordered = [];
    const watched='li[data-pm-identifier],#completion_prompt_manager_footer_append_prompt,.regex-script-label,div.regex_script_name,li.regex-debugger-rule,#completion_prompt_manager_popup_entry_form_name,input.regex_script_name';
    // These open or clear the edit form without a mutation we watch, so re-render after them too.
    const formButtons=',.completion_prompt_manager_footer .menu_button,#completion_prompt_manager_popup_entry_form_close,#completion_prompt_manager_popup_close_button';
    function compile(data, details = null) {
        const result={priority:Number(data.priority)||0,partial:!!data.partial};
        for(const kind of ['prompts','regex']){
            const names=new Map(),ids=new Map(),partial=[];
            for(const raw of data[kind]||[]){
                const entry = details ? { ...raw, [DETAILS]: details } : raw;
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
    // 8.0.5 찾은 결과를 기억한다(사전이 바뀌면 비움): 목록을 다시 그릴 때마다 줄 수백 개 × 부분 일치 사전 수천 개를 처음부터 견줬다
    const memo=new Map();
    const order=()=>{ordered=[...sources.values()].sort((a,b)=>b.priority-a.priority);memo.clear();};
    function lookup(kind, id, name) {
        const k=kind+'\u0001'+(id??'')+'\u0001'+name;
        if(memo.has(k))return memo.get(k);
        const found=lookupFresh(kind,id,name);
        if(memo.size>4000)memo.clear();
        memo.set(k,found);
        return found;
    }
    function lookupFresh(kind, id, name) {
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
        if (!entry?.[DETAILS] && detailsInputs.delete(input)) detailsObserver?.unobserve(input);
        if (!entry) { el?.remove(); hints.delete(input); return; }
        // 제목은 시작부터 같아요. 긴 설명은 편집 힌트가 실제로 보일 때만 받고,
        // 늦게 도착하면 현재 입력값으로 다시 찾아 그려요(옛 항목의 설명을 붙이지 않아요).
        if (entry[DETAILS]) {
            if (!input.checkVisibility || input.checkVisibility({ visibilityProperty: true })) entry[DETAILS]();
            else if (typeof globalThis.IntersectionObserver === 'function' && !detailsInputs.has(input)) {
                detailsObserver ||= new IntersectionObserver(entries => { if (sources.size && entries.some(item => item.isIntersecting && detailsInputs.has(item.target))) schedule(); });
                detailsInputs.add(input); detailsObserver.observe(input);
            }
        }
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
    // 8.2.6 성능: 예전에는 그리기 한 번에 문서 전체를 querySelectorAll 로 여섯 번 훑었어요(긴 채팅이면 요소 10만 개 남짓 × 6 — 프롬프트 토글마다).
    //   여섯 묶음을 한 선택자 목록으로 한 번만 훑고, 찾은 요소를 묶음마다 나눠 예전 순서(묶음 순서 · 그 안은 문서 순서) 그대로 칠해요.
    //   앞 묶음이 글을 바꿔 문서에서 빠진 요소는 뒤 묶음에서 건너뛰어요(예전에는 뒤 묶음을 훑을 때 이미 없던 것). 결과는 같아요(tools/tests/prompt-engine-once.mjs).
    const GROUPS=[
        ['li[data-pm-identifier] .completion_prompt_manager_prompt_name > a.prompt-manager-inspect-action, li[data-pm-identifier] .completion_prompt_manager_prompt_name > span[title]:not([class])', el=>paint(el,'prompts',el.closest('li').dataset.pmIdentifier)],
        ['#completion_prompt_manager_footer_append_prompt option', el=>paint(el,'prompts',el.value)],
        ['.regex-script-label[id] > .regex_script_name, div.regex_script_name[title], li.regex-debugger-rule[data-id] .rule-name', el=>paint(el,'regex',el.closest('li.regex-debugger-rule')?.dataset.id || el.parentElement.id)],
        ['#completion_prompt_manager_popup_entry_form_name', el=>hint(el,'prompts',lastId)],
        ['input.regex_script_name', el=>hint(el,'regex',null)],
        ['#saved_preset_scripts [title],#saved_regex_scripts [title],#saved_scoped_scripts [title]', el=>translateTitle(el)],
    ];
    const ALL=GROUPS.map(([sel])=>sel).join(',');
    function render() {
        timer=null;
        for (const [el] of changed) if (!el.isConnected) changed.delete(el);
        for (const [input,el] of hints) if (!input.isConnected) {el.remove();hints.delete(input);detailsObserver?.unobserve(input);detailsInputs.delete(input);}
        const found=GROUPS.map(()=>[]);
        for (const el of doc.querySelectorAll(ALL)) for (let i=0;i<GROUPS.length;i++) if (el.matches(GROUPS[i][0])) found[i].push(el);
        GROUPS.forEach(([,run],i)=>{
            if(i===GROUPS.length-1)for(const [el] of titles)if(!el.isConnected)titles.delete(el);
            for(const el of found[i])if(i===0||el.isConnected)run(el);
        });
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
    // 1.4.x 최적화 C: 진짜 창이면 공용 감시 허브의 body 구역(#chat 밖 · 글자 · title) 구독으로 — 예전에는 허브 body 구역과 같은 꼴의 감시자를
    //   따로 걸어(body 의 #chat 밖 가지를 하나씩) 같은 변화의 기록이 두 벌 만들어지고 콜백도 따로 돌았어요. 고르는 기록 · 그리는 결과는 같아요.
    //   시험의 가짜 문서(창 없음)는 예전 감시자 그대로예요.
    let unwatch=null;
    function onRecords(records){
            const containsTarget=node=>node.nodeType===1&&(node.matches(watched)||!!node.querySelector(watched));
            if(timer)return; // render re-reads all targets; another pending record cannot add work.
            if(records.some(record=>{
                const el=record.target.nodeType===1?record.target:record.target.parentElement;
                if(!el||el.closest('#chat,.bl-scripts,.bl-script-hint'))return false;
                if(record.type==='attributes'&&titles.get(el)?.after===el.getAttribute('title'))return false;
                if(record.type!=='attributes'&&changed.has(el)&&el.textContent===changed.get(el).after)return false;
                return !!el.closest(watched+',#saved_preset_scripts,#saved_regex_scripts,#saved_scoped_scripts')||[...record.addedNodes,...record.removedNodes].some(containsTarget);
            }))schedule();
    }
    function start() {
        const win=doc.defaultView;
        if(win&&win.document===doc&&doc.body&&typeof win.MutationObserver==='function'){
            unwatch=watchWith(win,[[doc.body,{childList:true,subtree:true,characterData:true,attributes:['title'],exclude:'#chat',name:'프롬프트 이름 번역'}]],onRecords);
        }else{
            observer=new MutationObserver(records=>{
                // body · #chat 조상에 새로 붙은 가지(팝업 등)도 보기 시작한다
                for(const record of records)if(record.type==='childList'&&(record.target===doc.body||chain.has(record.target)))record.addedNodes.forEach(watch);
                onRecords(records);
            });
            watchAll();
        }
        doc.addEventListener('click',click); doc.addEventListener('input',input);
    }
    function stop() {
        observer?.disconnect(); observer=null; unwatch?.(); unwatch=null; clearTimeout(timer);timer=null;
        detailsObserver?.disconnect(); detailsObserver=null; detailsInputs.clear();
        doc.removeEventListener('click',click); doc.removeEventListener('input',input);
        for(const [el,state] of changed) if(el.textContent===state.after)el.textContent=state.before;
        for(const [el,state] of titles)if(el.getAttribute('title')===state.after)el.setAttribute('title',state.before);titles.clear();
        changed.clear(); for(const el of hints.values())el.remove();hints.clear();
    }
    // 7.0.4 읽기만: 목록에 칠하는 것과 같은 글 (없으면 null) — 프롬프트 목록 「끼운 글 · 프리셋: …」 이름표가 쓴다
    // 8.0.1 정확 일치만 — 과일의 마음 창처럼 짧은 글을 고칠 때 부분 일치로 엉뚱한 이름의 번역을 붙이지 않게
    function lookupExact(kind, id, name) { const key = normalize(name); for (const source of ordered) { const list = source[kind]; const hit = list.ids.get(id)?.find(e=>!key||e.key===key)?.entry || list.names.get(key); if (hit) return hit; } return null; }
    const titleExact = (kind, id, name) => lookupExact(kind, id, name)?.title ?? null;
    const title = (kind, id, name) => lookup(kind, id, name)?.title ?? null;
    return {title,register(id,data,loadDetails=null){
        let active=true, pending=null, source;
        const details = typeof loadDetails==='function' ? () => {
            if(pending||!active||sources.get(id)!==source)return;
            pending=Promise.resolve().then(loadDetails).then(full=>{
                if(!active||sources.get(id)!==source||!full)return;
                source=compile(full); sources.set(id,source);order();render();
            }).catch(error=>{pending=null;console.warn('[Blue Lemonade] 프롬프트 설명을 받지 못했어요',error);});
        } : null;
        if(!sources.size)start(); source=compile(data,details);sources.set(id,source);order();render();
        return ()=>{active=false;if(sources.get(id)!==source)return;sources.delete(id);order();if(sources.size)render();else stop();};
    },stop,titleExact};
}
