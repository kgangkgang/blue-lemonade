import { localPromptHash } from './prompt-fingerprint.js';

const SCOPE = '#fruit-heart-v6';
const TARGET = '.fh-item,[data-chip],[data-pick-group],[data-pick-index],[data-master],[data-qr]';
const promptId = p => String(p?.id ?? p?.identifier ?? '');
const normalize = text => String(text ?? '').replace(/\r\n?/g, '\n').trim();
export function optionFamily(prompt, groups = {}) {
    const name = String(prompt?.name || '').replace(/\s*#\s*[A-Za-z][^#｜]*/g, '').replace(/\s*@[^\s#｜]+/g, '').trim();
    for (const part of name.split('｜').slice(1)) {
        const match = /^(.{1,10}?)(?:单选|(?:\d{1,2}|多)选1)$/.exec(part.trim());
        if (match) return match[1];
    }
    return name.startsWith('⌨') ? '文风' : groups[promptId(prompt)] || '';
}
// 11-14 이름으로 찾기: 프리셋마다 같은 항목의 이름이 조금씩 달라요(앞 그림 글자 · 「택1」 「单选」 꼬리 · 「(데우스)」 꼬리 · #모델 · @작가 · from 출처).
//   그런 것을 다 떼고 첫 칸(｜ 앞)의 글자 · 숫자만 남긴 열쇠로 이름 사전(과일 · 솔라 · 데우스)의 설명을 찾아요.
export function helpNameKey(name) {
    const head = String(name || '').normalize('NFKC').replace(/\s*#\s*[A-Za-z][^#｜]*/g, '').replace(/\s*@[^\s#｜]+/g, '').replace(/\s+from\S*$/i, '')
        .replace(/^\s*\[(?:택|PICK)\s*1[^\]]*\]\s*/i, '').split(/[｜|]/)[0].split(/\s*(?:택1|单选|(?:\d{1,2}|多)选1)\s*[:：]\s*/).pop();
    return head.replace(/[(（]\s*데우스[^)）]*[)）]/g, '').replace(/[^\p{L}\p{N}]/gu, '').replace(/(?:택1|单选|选开|(?:\d{1,2}|多)选1)$/u, '').toLowerCase();
}
/** 이름 사전들(BlueLemonade.translate 자료 {prompts:[{id,name,title,desc}]})에서 이 항목의 설명 — id + 이름이 같은 것 → 이름 열쇠가 같은 것 → id 가 같은 것 차례. 설명이 갈리면 쓰지 않아요. */
export function dictionaryHelp(dictionaries, identifier = '', name = '') {
    const rows = (Array.isArray(dictionaries) ? dictionaries : [dictionaries]).flatMap(d => Array.isArray(d?.prompts) ? d.prompts : []).filter(r => r && typeof r.desc === 'string' && r.desc.trim());
    const id = String(identifier || ''), key = helpNameKey(name);
    const one = list => { const texts = [...new Set(list.map(r => r.desc.trim()))]; return texts.length === 1 ? texts[0] : ''; };
    return (id && key && one(rows.filter(r => r.id === id && helpNameKey(r.name) === key)))
        || (key.length >= 2 && one(rows.filter(r => helpNameKey(r.name) === key)))
        || (id && one(rows.filter(r => r.id === id))) || '';
}
// 본문 맨 앞 도움말 주석({{// 도움말: …}} · 모델에는 안 가요) — 직접 만든 항목에 설명을 달아 두는 자리예요(솔라 빠른 설정과 같은 꼴).
export const helpNote = content => (String(content || '').match(/^\s*\{\{\/\/\s*도움말\s*:\s*([\s\S]*?)\}\}/u) || [])[1]?.replace(/\s+/g, ' ').trim() || '';
export const NO_HELP_TEXT = '이 항목은 아직 설명이 없어요. 아래 「현재 원문 확인」을 펼쳐 보세요. 본문 맨 앞에 {{// 도움말: 설명}} 을 적어 두면 다음부터 그 글이 여기에 떠요.';
export async function optionEffect(content, crypto = globalThis.crypto, identifier = '', {name = '', dictionaries} = {}) {
    // 효과 설명 213KB는 옵션 도움말을 실제로 열 때 받아요. 기본 탭과 일반 클릭에는 필요하지 않아요.
    const { FRUIT_OPTION_EFFECTS, FRUIT_OPTION_BASELINES, FRUIT_OPTION_DYNAMIC = [] } = await import('./fruit-option-effects.js');
    const body = normalize(content), baseline = FRUIT_OPTION_BASELINES[String(identifier)];
    if (!body) return {text:baseline || '내용이 없는 구분 항목이에요. 이 항목만 켜도 새 지시가 추가되지는 않아요.', verified:true};
    let hash;
    try { if (crypto?.subtle) hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)))].map(b=>b.toString(16).padStart(2,'0')).join(''); } catch { /* HTTP or browser restrictions: use the local implementation. */ }
    hash ||= localPromptHash(body);
    const text = FRUIT_OPTION_EFFECTS[hash];
    if (text) return {text,verified:true};
    if (baseline && FRUIT_OPTION_DYNAMIC.includes(String(identifier))) return {text:baseline,verified:true}; // 설정 자료처럼 쓰는 동안 본문이 바뀌는 항목
    if (baseline) return {text:baseline,verified:false,baseline:true};
    const note = helpNote(body);
    if (note) return {text:note,verified:false,source:'note'};
    let fromName = '';
    try { fromName = dictionaryHelp(typeof dictionaries === 'function' ? await dictionaries() : dictionaries, identifier, name); } catch { /* 사전을 못 받으면 아래 안내로 */ }
    if (fromName) return {text:fromName,verified:false,source:'name'};
    return {text:NO_HELP_TEXT,verified:false};
}

// 11-05 설명 창 본문 나누기: 고르기 칸 설명은 선택지마다 한 문단(「이름: 설명」)이에요. 선택지마다 같은 문장(「마음은 하나만 켭니다.」 같은 것)은
// 맨 위에 한 번만 두고, 각 선택지는 이름(콜론까지)을 굵게 · 설명은 보통 굵기로 이어 써요. items 를 주면 그대로, 없으면 빈 줄로 나뉜 「이름: 설명」 문단을 읽어요.
const helpSentences = text => String(text || '').split(/(?<=[.!?。])\s+/u).map(s => s.trim()).filter(Boolean);
export function splitOptionHelp(text, items) {
    let list = Array.isArray(items) && items.length
        ? items.map(x => ({label:String(x?.label || '').trim(), text:String(x?.text || '').trim()}))
        : String(text || '').split(/\n\s*\n/).map(part => {
            const m = /^([^:\n]{1,40}?):\s+([\s\S]+)$/u.exec(part.trim());
            return m && !/[.!?。]/u.test(m[1]) ? {label:m[1].trim(), text:m[2].trim()} : {label:'', text:part.trim()};
        });
    list = list.filter(x => x.label || x.text);
    const named = list.filter(x => x.label);
    let common = '';
    if (named.length >= 2) {
        const shared = helpSentences(named[0].text).filter(s => named.every(x => helpSentences(x.text).includes(s)));
        if (shared.length) {
            common = shared.join(' ');
            list = list.map(x => x.label ? {...x, text:helpSentences(x.text).filter(s => !shared.includes(s)).join(' ')} : x);
        }
    }
    return {common, items:list};
}
function renderOptionHelp(doc, text, items) {
    const {common, items:list} = splitOptionHelp(text, items);
    const box = doc.createElement('div');box.className = 'bl-fruit-option-desc';
    const para = (value, className) => { const p = doc.createElement('p'); if (className) p.className = className; if (value) p.textContent = value; return p; };
    if (common) box.append(para(common, 'bl-fruit-option-common'));
    for (const item of list) {
        const p = para('', item.label ? 'bl-fruit-option-item' : '');
        if (item.label) { const name = doc.createElement('strong'); name.textContent = `${item.label}:`; p.append(name); if (item.text) p.append(` ${item.text}`); }
        else p.textContent = item.text;
        box.append(p);
    }
    if (!box.childElementCount) box.append(para(String(text || '')));
    return box;
}

/** Hold to inspect; normal taps retain their original behavior. No writes or requests. */
export function installFruitOptionHelp(doc = document, host = window, config = {}) {
    const scope = config.scope || SCOPE;
    let gesture = null, suppress = null, modal = null, sequence = 0, stopped = false, pickerGroup = '';
    const resolve = name => {
        for (const source of [host, host.TavernHelper]) if (typeof source?.[name] === 'function') return source[name].bind(source);
        return null;
    };
    const getPreset = () => resolve('getPreset')?.('in_use');
    const getName = () => resolve('getLoadedPresetName')?.() || '';
    const targetOf = node => {
        if (config.targetOf) return config.targetOf(node);
        const el = node?.closest?.(TARGET);
        if (!el?.closest(scope) || node.closest?.('textarea,[contenteditable="true"],.fh-input:not(.fh-hidden-check)')) return null;
        if (el.matches('[data-pick-index]') && !pickerGroup) return null; // font/model pickers are not prompt options
        return el;
    };
    function findPrompt(target, preset) {
        const prompts = Array.isArray(preset?.prompts) ? preset.prompts : [];
        const id = target.dataset.chip || target.querySelector('[data-prompt-id]')?.dataset.promptId;
        if (id) return prompts.find(p => promptId(p) === id) || null;
        if (target.matches('[data-pick-index]')) {
            const index = Number(target.dataset.pickIndex);
            if (!Number.isInteger(index) || index < 1) return null;
            let groups = {};
            try { groups = JSON.parse(prompts.find(p=>promptId(p)==='fruit-heart-control-config-v2')?.content || '{}').controlGroups || {}; } catch {}
            return prompts.filter(p=>promptId(p)!=='fruit-heart-control-config-v2' && optionFamily(p,groups)===pickerGroup)[index-1] || null;
        }
        return null;
    }
    function close() { const old=modal;modal=null;if(old){old.close?.();old.remove();} }
    function show(target, title, text, original, verified, baseline = false, items, source = '') {
        if (stopped || !target.isConnected) return;
        close();
        const dialog = doc.createElement('dialog');dialog.className='bl-fruit-option-help';dialog.setAttribute('aria-label',config.label || '과일 옵션 설명');
        const head=doc.createElement('header'),heading=doc.createElement('h3'),button=doc.createElement('button');
        heading.textContent=title || '옵션 설명';button.type='button';button.textContent='닫기';button.setAttribute('aria-label','옵션 설명 닫기');
        button.addEventListener('click',close);head.append(heading,button);
        const description=renderOptionHelp(doc,text,items);
        const note=doc.createElement('p');note.className='bl-fruit-option-note';note.textContent=source==='name'?'프리셋 이름 사전의 설명이에요. 이름이 같은 항목의 설명을 가져왔어요 — 원문이 조금 달라 실제 효과가 다를 수 있으니 아래 원문도 함께 보세요.':source==='note'?'이 항목 본문 맨 앞의 도움말 주석이에요(모델에는 보내지 않아요).':baseline?'기본 옵션의 효과 설명이에요. 현재 내용이 확인한 기본판과 달라 실제 효과가 다를 수 있어요. 아래에서 수정된 원문을 확인할 수 있어요.':verified?'이 옵션이 더하는 지시의 뜻이에요. 끈다고 반대 행동을 강제하지는 않으며, 다른 옵션과 모델에 따라 실제 응답은 달라질 수 있어요.':'원문은 이 기기에서만 읽어요. 자동 번역 API를 호출하지 않아요.';
        dialog.append(head,description,note);
        if (original !== undefined) {
            const details=doc.createElement('details'),summary=doc.createElement('summary'),pre=doc.createElement('pre');
            summary.textContent='현재 원문 확인';pre.textContent=String(original);details.append(summary,pre);dialog.append(details);
        }
        const hint=doc.createElement('small');hint.textContent='길게 누르기 · Alt+Enter 또는 Shift+F10 · 닫기 Esc';dialog.append(hint);
        dialog.addEventListener('close',()=>{if(modal===dialog)modal=null;dialog.remove();if(target.isConnected)target.focus?.({preventScroll:true});},{once:true});
        doc.body.append(dialog);modal=dialog;dialog.showModal();button.focus({preventScroll:true});
    }
    async function explain(target) {
        const ticket=++sequence, presetName=getName();
        try {
            if (config.describe) {
                const detail = await config.describe(target);
                if (stopped || ticket !== sequence || !target.isConnected || !detail) return;
                show(target,detail.title,detail.text,detail.original,detail.verified,detail.baseline,detail.items);return;
            }
            const preset=getPreset(), prompt=findPrompt(target,preset);
            const title=target.querySelector('span')?.textContent?.trim() || target.getAttribute('aria-label') || target.textContent.trim();
            if (prompt) {
                const content=String(prompt.content || ''), id=promptId(prompt), effect=await optionEffect(content,host.crypto,id,{name:prompt.name,dictionaries:config.dictionaries});
                if(stopped||ticket!==sequence||!target.isConnected||getName()!==presetName)return;
                const current=getPreset()?.prompts?.find(p=>promptId(p)===id);
                if(!current||String(current.content||'')!==content)return;
                show(target,title||prompt.name,effect.text,content,effect.verified,effect.baseline,undefined,effect.source);return;
            }
            if(target.matches('[data-pick-index]')&&target.dataset.pickIndex==='0') {
                show(target,'이 묶음 모두 끄기','이 선택 묶음의 옵션들을 모두 꺼요. 다른 묶음이나 기본 프롬프트는 그대로예요.',undefined,true);return;
            }
            if(target.dataset.master==='stream') {
                show(target,'스트리밍','켜면 생성되는 글을 조금씩 받아 보여 주고, 끄면 완성된 답을 한꺼번에 보여 줘요. 답변 언어·내용을 바꾸는 옵션은 아니에요.',undefined,true);return;
            }
            if(target.matches('[data-pick-group]')) {
                show(target,title,'한 묶음에서 사용할 옵션을 고르는 버튼이에요. 짧게 눌러 목록을 연 뒤, 개별 옵션을 길게 누르면 그 옵션의 효과를 확인할 수 있어요.',undefined,true);return;
            }
            if(target.dataset.master==='theatre') {
                show(target,title||'짧은 극장','짧은 극장 출력의 전체 스위치예요. 켜진 주제와 극장 형식에 따라 별도의 짧은 이야기가 붙어요.',undefined,true);return;
            }
            show(target,title,'이 제어는 현재 프롬프트 항목과 안전하게 연결하지 못했어요. 짧게 누르면 원래 동작을 실행하므로, 설정 화면에서 내용을 먼저 확인해 주세요.',undefined,false);
        } catch { if(ticket===sequence&&!stopped)show(target,'옵션 설명','현재 프리셋을 읽지 못했어요. 프리셋이 완전히 열린 뒤 다시 길게 눌러 주세요.',undefined,false); }
    }
    const cancel=()=>{if(gesture)host.clearTimeout(gesture.timer);gesture=null;};
    const block=e=>{e.preventDefault();e.stopImmediatePropagation();};
    function down(e) {
        if(e.isPrimary===false){cancel();return;}
        if(e.button!==0)return;
        cancel();suppress=null;
        const target=targetOf(e.target);if(!target)return;
        gesture={target,x:e.clientX,y:e.clientY,id:e.pointerId,fired:false};
        const current=gesture;
        current.timer=host.setTimeout(()=>{if(gesture!==current||!target.isConnected)return;current.fired=true;suppress={target,until:Date.now()+1500};void explain(target);},550);
    }
    function move(e) {if(gesture&&e.pointerId===gesture.id&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>10)cancel();}
    function up(e) {if(!gesture||e.pointerId!==gesture.id)return;if(gesture.fired)block(e);cancel();}
    function click(e) {
        if(suppress&&Date.now()<suppress.until&&(suppress.target===e.target||suppress.target.contains(e.target))){block(e);suppress=null;return;}
        if(!e.target.closest?.(scope))return;
        const group=e.target.closest('[data-pick-group]');
        if(group)pickerGroup=group.dataset.pickGroup;
        else if(e.target.closest('[data-pick-font],[data-pick-model],[data-sheet-close],[data-qr]'))pickerGroup='';
    }
    function key(e) {
        const target=targetOf(e.target);
        if(target&&((e.altKey&&e.key==='Enter')||(e.shiftKey&&e.key==='F10'))){block(e);cancel();void explain(target);}
    }
    function menu(e) {const target=targetOf(e.target);if(!target)return;block(e);cancel();suppress={target,until:Date.now()+1500};void explain(target);}
    const listeners=[['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',cancel],['scroll',cancel],['click',click],['keydown',key],['contextmenu',menu]];
    for(const [name,fn] of listeners)doc.addEventListener(name,fn,true);
    host.addEventListener('blur',cancel);
    const style=doc.createElement('style');style.textContent=`:root{--bl-fruit-help-fallback-0008:#0008;--bl-fruit-help-fallback-222:#222;--bl-fruit-help-fallback-777:#777;--bl-fruit-help-fallback-7773:#7773;--bl-fruit-help-fallback-ddd:#ddd;}

.bl-fruit-option-help{box-sizing:border-box;width:min(520px,calc(100vw - 24px));max-height:calc(100dvh - 32px);margin:auto;padding:18px;border:1px solid var(--SmartThemeBorderColor,var(--bl-fruit-help-fallback-777));border-radius:12px;background:var(--salty-bg,var(--SmartThemeBlurTintColor,var(--bl-fruit-help-fallback-222)));color:var(--salty-text,var(--SmartThemeBodyColor,var(--bl-fruit-help-fallback-ddd)));font:inherit;line-height:1.55;overflow:auto;text-align:left}
.bl-fruit-option-help::backdrop{background:var(--bl-fruit-help-fallback-0008)}.bl-fruit-option-help header{display:flex;align-items:flex-start;gap:12px}.bl-fruit-option-help h3{flex:1;min-width:0;margin:0;font-size:1em;word-break:keep-all;overflow-wrap:anywhere}.bl-fruit-option-help button{flex:none;min-height:36px;padding:6px 12px;font:inherit;color:inherit;background:var(--bl-fill-control,var(--bl-fruit-help-fallback-7773));border:0;border-radius:8px}.bl-fruit-option-help .bl-fruit-option-desc{margin:14px 0}.bl-fruit-option-help .bl-fruit-option-desc>p{margin:0;white-space:pre-line}.bl-fruit-option-help .bl-fruit-option-desc>p+p{margin-top:10px}.bl-fruit-option-help .bl-fruit-option-desc strong{font-weight:700}.bl-fruit-option-help p{margin:14px 0;word-break:keep-all;overflow-wrap:anywhere}.bl-fruit-option-help .bl-fruit-option-note,.bl-fruit-option-help small{font-size:.88em;opacity:.8}.bl-fruit-option-help summary{cursor:pointer;min-height:36px;padding-block:6px}.bl-fruit-option-help pre{font:inherit;font-size:.88em;white-space:pre-wrap;overflow-wrap:anywhere;max-height:35dvh;overflow:auto}.bl-fruit-option-help small{display:block;margin-top:14px}`;
    doc.head.append(style);
    return()=>{if(stopped)return;stopped=true;sequence++;cancel();suppress=null;for(const [name,fn] of listeners)doc.removeEventListener(name,fn,true);host.removeEventListener('blur',cancel);close();style.remove();};
}
