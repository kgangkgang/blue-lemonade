import { FRUIT_OPTION_EFFECTS } from './fruit-option-effects.js';

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
export async function optionEffect(content, crypto = globalThis.crypto) {
    if (!normalize(content)) return {text:'내용이 없는 구분 항목이에요. 이 항목만 켜도 새 지시가 추가되지는 않아요.', verified:true};
    if (!crypto?.subtle) return {text:'이 환경에서는 원문과 설명의 일치 여부를 확인할 수 없어요.', verified:false};
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalize(content))))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const text = FRUIT_OPTION_EFFECTS[hash];
    return {text:text || '직접 수정했거나 아직 설명을 확인하지 않은 항목이에요. 효과를 추측하지 않도록 아래에서 현재 원문을 확인해 주세요.', verified:!!text};
}

/** Hold to inspect; normal taps retain their original behavior. No writes or requests. */
export function installFruitOptionHelp(doc = document, host = window) {
    let gesture = null, suppress = null, modal = null, sequence = 0, stopped = false, pickerGroup = '';
    const resolve = name => {
        for (const source of [host, host.TavernHelper]) if (typeof source?.[name] === 'function') return source[name].bind(source);
        return null;
    };
    const getPreset = () => resolve('getPreset')?.('in_use');
    const getName = () => resolve('getLoadedPresetName')?.() || '';
    const targetOf = node => {
        const el = node?.closest?.(TARGET);
        if (!el?.closest(SCOPE) || node.closest?.('textarea,[contenteditable="true"],.fh-input:not(.fh-hidden-check)')) return null;
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
    function show(target, title, text, original, verified) {
        if (stopped || !target.isConnected) return;
        close();
        const dialog = doc.createElement('dialog');dialog.className='bl-fruit-option-help';dialog.setAttribute('aria-label','과일 옵션 설명');
        const head=doc.createElement('header'),heading=doc.createElement('h3'),button=doc.createElement('button');
        heading.textContent=title || '옵션 설명';button.type='button';button.textContent='닫기';button.setAttribute('aria-label','옵션 설명 닫기');
        button.addEventListener('click',close);head.append(heading,button);
        const description=doc.createElement('p');description.textContent=text;
        const note=doc.createElement('p');note.className='bl-fruit-option-note';note.textContent=verified?'이 옵션이 더하는 지시의 뜻이에요. 끈다고 반대 행동을 강제하지는 않으며, 다른 옵션과 모델에 따라 실제 응답은 달라질 수 있어요.':'원문은 이 기기에서만 읽어요. 자동 번역 API를 호출하지 않아요.';
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
            const preset=getPreset(), prompt=findPrompt(target,preset);
            const title=target.querySelector('span')?.textContent?.trim() || target.getAttribute('aria-label') || target.textContent.trim();
            if (prompt) {
                const content=String(prompt.content || ''), id=promptId(prompt), effect=await optionEffect(content,host.crypto);
                if(stopped||ticket!==sequence||!target.isConnected||getName()!==presetName)return;
                const current=getPreset()?.prompts?.find(p=>promptId(p)===id);
                if(!current||String(current.content||'')!==content)return;
                show(target,title||prompt.name,effect.text,content,effect.verified);return;
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
        if(!e.target.closest?.(SCOPE))return;
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
    const style=doc.createElement('style');style.textContent=`
.bl-fruit-option-help{box-sizing:border-box;width:min(520px,calc(100vw - 24px));max-height:calc(100dvh - 32px);margin:auto;padding:18px;border:1px solid var(--SmartThemeBorderColor,#777);border-radius:12px;background:var(--salty-bg,var(--SmartThemeBlurTintColor,#222));color:var(--salty-text,var(--SmartThemeBodyColor,#ddd));font:inherit;line-height:1.55;overflow:auto;text-align:left}
.bl-fruit-option-help::backdrop{background:#0008}.bl-fruit-option-help header{display:flex;align-items:flex-start;gap:12px}.bl-fruit-option-help h3{flex:1;min-width:0;margin:0;font-size:1em;word-break:keep-all;overflow-wrap:anywhere}.bl-fruit-option-help button{flex:none;min-height:36px;padding:6px 12px;font:inherit;color:inherit;background:var(--bl-fill-control,#7773);border:0;border-radius:8px}.bl-fruit-option-help p{margin:14px 0;word-break:keep-all;overflow-wrap:anywhere}.bl-fruit-option-help .bl-fruit-option-note,.bl-fruit-option-help small{font-size:.88em;opacity:.8}.bl-fruit-option-help summary{cursor:pointer;min-height:36px;padding-block:6px}.bl-fruit-option-help pre{font:inherit;font-size:.88em;white-space:pre-wrap;overflow-wrap:anywhere;max-height:35dvh;overflow:auto}.bl-fruit-option-help small{display:block;margin-top:14px}`;
    doc.head.append(style);
    return()=>{if(stopped)return;stopped=true;sequence++;cancel();suppress=null;for(const [name,fn] of listeners)doc.removeEventListener(name,fn,true);host.removeEventListener('blur',cancel);close();style.remove();};
}
