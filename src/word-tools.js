import { showThemeModal } from './modal.js';
import { toolSection } from './addon-layout.js';
import { getSettings, saveSettings } from './settings.js';
import { replaceText, importRuleSets } from './word-tools-core.js';
import { captureOptionsMarkup, bindCaptureOptions, openCapturePreview } from './capture-options.js';
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selected = new Set();
let chatKey, draft='', undoDraft=null, proposal=null, undoChat=null;
let previewGen=0; // 2026-10-06: 전후 보기가 번역 캐시를 읽는 사이 규칙·선택·채팅이 바뀌면 그 미리보기는 버린다
const context = () => SillyTavern.getContext();
const userError = message => Object.assign(Error(message), { user: true });
function syncChat() {
    const key=context().chatId;
    if(key!==chatKey){chatKey=key;selected.clear();proposal=null;previewGen++;undoChat=null;}
}
function previewText(raw) {
    let text=String(raw??'');
    const prose=[...text.matchAll(/<prose\b[^>]*>([\s\S]*?)<\/prose\s*>/gi)];
    if(prose.length)text=prose.map(x=>x[1]).join('\n');
    text=text.replace(/<(scene_plan|think|thinking|reasoning|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
        .replace(/\{\{img::[^{}]*\}\}/gi,' ');
    const template=document.createElement('template');template.innerHTML=text;
    return template.content.textContent.replace(/\s+/g,' ').trim().slice(0,240);
}
export function messagePreview(message, view='translation') {
    const translated=typeof message.extra?.display_text==='string'&&message.extra.display_text.trim();
    const useTranslation=view==='translation'&&!!translated;
    // 2026-10-06: 원문 보기 상태면 display_text 는 원문 사본이고 번역문은 original_translation_backup 에 있다 (번역기 · 북마크와 같은 순서로 읽음)
    return {text:previewText(useTranslation?(message.extra.original_translation_backup||message.extra.display_text):message.mes),label:useTranslation?'번역본':view==='translation'?'번역 없음 · 원문':'원문'};
}
function updateMessageView(section){
    const view=getSettings().wordTools.messageView;
    for(const button of section.querySelectorAll('[data-message-view]'))button.setAttribute('aria-pressed',String(button.dataset.messageView===view));
    for(const row of section.querySelectorAll('[data-message-row]')){
        const message=context().chat?.[Number(row.dataset.messageRow)];if(!message)continue;
        const preview=messagePreview(message,view);
        row.querySelector('[data-message-excerpt]').textContent=preview.text;
        row.querySelector('[data-message-language]').textContent=preview.label;
    }
}
function choices() {
    syncChat();
    const ctx=context();
    return [...document.querySelectorAll('#chat .mes[mesid]')].map(el=>{
        const id=Number(el.getAttribute('mesid')),m=ctx.chat?.[id]; if(!m)return '';
        const preview=messagePreview(m,getSettings().wordTools.messageView);
        return `<label class="bl-message-choice" data-message-row="${id}"><input type="checkbox" data-word-message="${id}" ${selected.has(id)?'checked':''}><span><b>#${id} ${esc(m.name|| (m.is_user?'나':'AI'))}</b><em class="bl-message-language" data-message-language>${preview.label}</em><small data-message-excerpt>${esc(preview.text)}</small></span></label>`;
    }).join('') || '<p class="salty-note">열린 채팅이 없어요.</p>';
}
// 2026-10-06: 전후 보기가 원문만 보여 줘서 번역문만 바뀌는 메시지가 '0곳 변경'에 같은 글로 보였다 — 번역문이 바뀌면 그 전후도 보여 준다
//             (원문 보기 상태면 번역문은 original_translation_backup 칸에 있다). 원문이 그대로면 같은 글 두 칸은 뺀다
const translationSlot=s=>s.backup!==undefined?s.backup:s.display;
function comparisonMarkup(r) {
    const before=translationSlot(r.before),after=translationSlot(r.after),changed=before!==after;
    return `<div class="bl-word-comparison"><b>#${r.id} · ${r.count}곳 변경</b>${r.before.mes!==r.after.mes||!changed?`<label>원문<pre>${esc(r.before.mes)}</pre></label><label>변경 후<pre>${esc(r.after.mes)}</pre></label>`:''}${changed?`<label>번역문<pre>${esc(before)}</pre></label><label>번역문 변경 후<pre>${esc(after)}</pre></label>`:''}</div>`;
}
export function wordToolsMarkup(s, mode) {
    const cfg=s.wordTools, sets=importRuleSets(context().extensionSettings);
    const picker=`<p class="salty-note">이전 메시지를 더 불러오고, 필요한 대화만 골라요.</p><div class="bl-message-actions" role="group" aria-label="메시지 선택 도구"><button type="button" class="salty-btn" data-word-action="load-older">이전 채팅 불러오기</button><button type="button" class="salty-btn" data-word-action="all">모두 선택</button><button type="button" class="salty-btn" data-word-action="none">선택 해제</button>${mode==='words'?'<button type="button" class="salty-btn" data-word-action="pull-original">원문 가져오기</button><button type="button" class="salty-btn" data-word-action="pull-translation">번역문 가져오기</button>':''}</div><div class="bl-message-view" role="group" aria-label="메시지 목록 언어">${[['translation','번역본 보기'],['original','원문 보기']].map(([key,title])=>`<button type="button" class="salty-btn" data-message-view="${key}" aria-pressed="${cfg.messageView===key}">${title}</button>`).join('')}</div><p class="salty-note">목록에 표시할 글만 바꿔요. 번역이 없는 메시지는 원문으로 표시해요.</p><div class="bl-message-choices">${choices()}</div>`;
    const capture=`<div data-capture-stage><div class="bl-capture-empty"><span aria-hidden="true">▧</span><b>저장할 장면을 먼저 확인해요</b><p>메시지를 고른 뒤 미리보기를 만들어요.<br>원문과 번역문은 바뀌지 않아요.</p></div></div><button type="button" class="salty-btn bl-tool-primary" data-word-action="capture">캡처 미리보기 만들기</button>`;
    const menu=toolSection('display','바로가기',`<label class="bl-addon-toggle"><input type="checkbox" data-addon-menu="${mode}" ${s.addonUI[mode+'Menu']?'checked':''}>별 두 개 메뉴에 표시</label><div class="bl-wand-preview"><div class="bl-wand-preview-input"><strong>✦₊</strong><span>메시지를 입력하세요</span></div><p>${mode==='words'?'단어 치환':'채팅 캡처'}</p></div>`,false,'입력창 옆 메뉴 위치');
    const main=mode==='capture'
        ? toolSection('selection','메시지 선택',picker,true)+toolSection('capture-preview','미리보기',capture,true)
        : toolSection('workspace','글 작업대',`<textarea class="text_pole" data-word-draft rows="7" placeholder="글을 붙여 넣거나 아래에서 원문·번역문을 가져오세요">${esc(draft)}</textarea><div class="bl-word-actions">${[['replace','치환'],['undo-draft','되돌리기'],['copy','복사']].map(([id,label])=>`<button type="button" class="salty-btn" data-word-action="${id}">${label}</button>`).join('')}</div>`,true)
        +toolSection('selection','메시지 선택',picker,false,'원문·번역문 가져오기')
        +toolSection('apply','채팅에 적용',`<p class="salty-note">선택한 원문과 표시 번역문을 함께 바꿔요. 먼저 전후를 확인해 주세요.</p><div class="bl-word-actions"><button type="button" class="salty-btn" data-word-action="preview">치환 전후 보기</button><button type="button" class="salty-btn" data-word-action="apply" ${proposal?'':'disabled'}>채팅에 적용</button><button type="button" class="salty-btn" data-word-action="undo-chat" ${undoChat?'':'disabled'}>되돌리기</button></div><div data-word-preview>${proposal?.rows.map(comparisonMarkup).join('')||''}</div>`,!!proposal)
        +toolSection('capture-preview','캡처 미리보기',capture,false,'이름을 가려 이미지·영상으로 저장');
    const rules=`<p class="salty-note">찾을 말은 쉼표로 묶어요. 레몬, lemon → 귤</p><div class="bl-rule-caption"><span>찾을 말</span><span>바꿀 말</span></div><div class="bl-word-rules">${cfg.rules.map((rule,i)=>`<div class="bl-word-rule" data-rule-index="${i}"><input type="checkbox" data-rule-field="enabled" aria-label="규칙 ${i+1} 사용" ${rule.enabled!==false?'checked':''}><input type="text" data-rule-field="from" aria-label="찾을 말 ${i+1}" placeholder="레몬, lemon" value="${esc(rule.from)}"><button type="button" class="bl-rule-swap" data-rule-swap="${i}" aria-label="찾을 말과 바꿀 말 바꾸기">→</button><input type="text" data-rule-field="to" aria-label="바꿀 말 ${i+1}" placeholder="귤" value="${esc(rule.to)}"><button type="button" data-rule-delete="${i}" aria-label="규칙 ${i+1} 삭제">×</button></div>`).join('')}</div><div class="bl-word-actions"><button type="button" class="salty-btn" data-word-action="add">＋ 규칙 추가</button><button type="button" class="bl-word-help" data-word-action="help" aria-label="치환 규칙 도움말">?</button></div><div class="bl-tool-grid bl-word-options">${[['caseSensitive','대소문자 구분'],['wholeWords','낱말 단위'],['particles','조사 자동 보정']].map(([key,label])=>`<label><input type="checkbox" data-word-option="${key}" ${cfg[key]?'checked':''}>${label}</label>`).join('')}</div>`;
    const presets=`<div class="bl-word-presets"><label>치환 프리셋<select data-word-preset><option value="">프리셋 선택</option>${cfg.presets.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><input type="text" data-word-preset-name placeholder="저장할 프리셋 이름" aria-label="저장할 프리셋 이름"><div class="bl-word-actions"><button type="button" class="salty-btn" data-word-action="save-preset">현재 규칙 저장</button><button type="button" class="salty-btn" data-word-action="load-preset">불러오기</button><button type="button" class="salty-btn" data-word-action="delete-preset">삭제</button></div></div>${sets.length?`<label class="bl-tool-field">기존 규칙 가져오기<select data-word-import><option value="">묶음 선택</option>${sets.map((set,i)=>`<option value="${i}">${esc(set.name)}</option>`).join('')}</select></label>`:''}`;
    const options=mode==='capture'?captureOptionsMarkup():toolSection('rules','치환 규칙',rules,true)+toolSection('presets','프리셋',presets,false,'저장·불러오기·기존 규칙')+toolSection('capture-settings','캡처 설정',captureOptionsMarkup(),false,'저장 방식·이름 가림');
    return `<div class="bl-addon-layout"><div class="bl-addon-main">${main}<p class="bl-tool-status" data-word-status role="status"></p></div><div class="bl-addon-config">${options}${menu}</div></div>`;
}

// 2026-10-06: 원문 보기 상태면 번역문이 original_translation_backup 에 치워져 있다 — 이 칸도 함께 바꾸고 되돌린다 (안 그러면 번역문 보기로 돌아올 때 옛 낱말이 살아나고, 표식은 새 원문으로 옮겨져 다시 번역도 안 됨). mes-fold rewriteFold 와 같은 두 칸
function snapshot(m) { return {mes:m.mes, display:m.extra?.display_text, backup:m.extra?.original_translation_backup, hash:m.extra?.original_text_hash, swipe:m.swipe_id, swipeText:m.swipes?.[m.swipe_id]}; }
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// 번역기의 원문 표식 (llm-translator originalHashOf 와 같은 식) — 원문과 번역문을 함께 바꿀 때 새 원문으로 옮겨야 번역문을 지우고 다시 번역하지 않는다
// 실리태번 utils.js 는 전후 보기를 누를 때 불러온다 — 정적 import 로 두면 설정 창 모듈 묶음이 실리태번 경로에 묶인다. 못 불러오면 표식을 안 옮긴다(예전처럼 다시 번역)
let hashFn=null;
const loadHash=async()=>{try{hashFn??=(await import('../../../../utils.js')).getStringHash;}catch(error){console.warn('[Blue Lemonade]',error);}};
const sourceHash=(m,mes)=>{if(!hashFn)return null;const ctx=context();return String(hashFn(String(ctx.substituteParams(mes??'',ctx.name1,m.name)??'')));};
function write(m,data) {
    m.mes=data.mes;
    if(data.display!==undefined){m.extra??={};m.extra.display_text=data.display;}
    if(data.backup!==undefined){m.extra??={};m.extra.original_translation_backup=data.backup;}
    if(data.hash!==undefined){m.extra??={};m.extra.original_text_hash=data.hash;}
    if(m.swipes && data.swipe!==undefined)m.swipes[data.swipe]=data.swipeText;
}
async function applyTransaction(transaction, reverse=false) {
    const ctx=context();
    if(document.body.classList.contains('cg-previewing'))throw userError('다른 채팅 미리보기를 닫은 뒤 적용해 주세요.');
    if(ctx.chatId!==transaction.key || document.body.dataset.generating==='true')throw userError('채팅이 바뀌었거나 응답 생성 중이에요. 다시 확인해 주세요.');
    // 2026-10-06: 편집 중인 메시지를 다시 그리면 편집 칸이 사라지고, 그 뒤 ✓ 가 화면 글(.text())을 본문으로 저장한다 — 쓰기 전에 막는다 (북마크 · 다시 쓰기와 같은 검사)
    for(const row of transaction.rows)if(document.querySelector(`#chat .mes[mesid="${row.id}"] .edit_textarea`))throw userError('편집 중인 메시지가 있어요. 편집을 마친 뒤 적용해 주세요.');
    for(const row of transaction.rows)if(ctx.chat[row.id]!==row.message || !same(snapshot(row.message),reverse?row.after:row.before))throw userError('미리보기 이후 메시지가 바뀌었어요. 다시 전후 보기를 눌러 주세요.');
    for(const row of transaction.rows)write(row.message,reverse?row.before:row.after);
    try { await ctx.saveChat(); }
    catch(error){for(const row of transaction.rows)write(row.message,reverse?row.after:row.before);throw error;}
    // 2026-10-06: 번역기 DB 의 번역도 같이 바꾼다(되돌리기는 예전 글로) — 안 그러면 연필 수정 · 교정 · 선택 재번역 · 북마크 고치기가 DB 의 옛 번역을 읽어 치환이 되돌아간다
    const translator=globalThis[Symbol.for('blue-lemonade.translator')];
    for(const row of transaction.rows){
        if(!row.cache||typeof translator?.storeTranslationQuietly!=='function')continue;
        try { await (reverse?translator.storeTranslationQuietly(row.cache.oldSrc,row.cache.rawBefore):translator.storeTranslationQuietly(row.cache.newSrc,row.cache.rawAfter)); }
        catch(error) { console.warn('[Blue Lemonade] 번역 캐시 갱신',error); }
    }
    if(context().chatId!==transaction.key)return;
    for(const row of transaction.rows){
        // The text is already saved. A different extension's event handler must
        // not turn a successful edit into a failure and discard its undo record.
        try { ctx.updateMessageBlock(row.id,row.message);if((reverse?row.before:row.after).display===undefined)await ctx.eventSource.emit(ctx.eventTypes.MESSAGE_UPDATED,row.id); }
        catch(error) { console.warn('[Blue Lemonade] 저장 후 화면 갱신',error); }
    }
}
export function bindWordTools(root, refresh) {
    const section=root.querySelector('[data-tab="extensions"]');if(!section)return;
    bindCaptureOptions(section,kind=>section.dispatchEvent(new CustomEvent('bl:capture-options-changed',{detail:{kind}}))); // kind 'filter': 필터만 바뀜 (미리보기를 다시 굽지 않는다)
    section.querySelectorAll('[data-message-view]').forEach(button=>button.addEventListener('click',()=>{
        getSettings().wordTools.messageView=button.dataset.messageView;saveSettings();updateMessageView(section);
    }));
    const invalidate=()=>{proposal=null;previewGen++;};
    section.querySelectorAll('[data-rule-field]').forEach(input=>input.addEventListener('input',()=>{
        const rule=getSettings().wordTools.rules[Number(input.closest('[data-rule-index]').dataset.ruleIndex)];
        rule[input.dataset.ruleField]=input.type==='checkbox'?input.checked:input.value;invalidate();saveSettings();
        section.querySelector('[data-word-action="apply"]')?.setAttribute('disabled','');
    }));
    // 5.3.9: 가운데 → 를 누르면 찾을 말 ↔ 바꿀 말 (반대로 적었을 때 지우고 다시 쓰지 않게)
    section.querySelectorAll('[data-rule-swap]').forEach(button=>button.addEventListener('click',()=>{
        const rule=getSettings().wordTools.rules[Number(button.dataset.ruleSwap)];if(!rule)return;
        [rule.from,rule.to]=[rule.to??'',rule.from??''];invalidate();saveSettings();
        const row=button.closest('[data-rule-index]');row.querySelector('[data-rule-field="from"]').value=rule.from;row.querySelector('[data-rule-field="to"]').value=rule.to;
        section.querySelector('[data-word-action="apply"]')?.setAttribute('disabled','');
    }));
    section.querySelectorAll('[data-rule-delete]').forEach(button=>button.addEventListener('click',()=>{getSettings().wordTools.rules.splice(Number(button.dataset.ruleDelete),1);invalidate();saveSettings();refresh();}));
    section.querySelectorAll('[data-word-option]').forEach(input=>input.addEventListener('change',()=>{getSettings().wordTools[input.dataset.wordOption]=input.checked;invalidate();saveSettings();refresh();}));
    section.querySelectorAll('[data-word-message]').forEach(input=>input.addEventListener('change',()=>{input.checked?selected.add(Number(input.dataset.wordMessage)):selected.delete(Number(input.dataset.wordMessage));invalidate();section.querySelector('[data-word-action="apply"]')?.setAttribute('disabled','');}));
    section.querySelector('[data-word-import]')?.addEventListener('change',event=>{if(event.target.value==='')return;getSettings().wordTools.rules.push(...structuredClone(importRuleSets(context().extensionSettings)[Number(event.target.value)].rules));invalidate();saveSettings();refresh();});
    section.querySelector('[data-word-draft]')?.addEventListener('input',event=>{draft=event.target.value;});
    section.querySelectorAll('[data-word-action]').forEach(button=>button.addEventListener('click',async()=>{
        try {
            const action=button.dataset.wordAction,ctx=context(),cfg=getSettings().wordTools;
            if(document.body.classList.contains('cg-previewing')&&['load-older','all','pull-original','pull-translation','preview','apply','undo-chat','capture'].includes(action))throw userError('다른 채팅 미리보기를 닫은 뒤 메시지를 선택해 주세요.');
            const oldKey=chatKey;syncChat();if(oldKey!==chatKey) {refresh();return;}
            const ids=[...selected].sort((a,b)=>a-b);
            if(action==='help'){showHelp();return;}
            if(action==='load-older') {
                const count=await askCount();if(count===null)return;
                if(context().chatId!==oldKey)throw userError('채팅이 바뀌었어요. 다시 선택해 주세요.');
                const first=Number(document.querySelector('#chat .mes[mesid]')?.getAttribute('mesid'));
                if(first===0){globalThis.toastr?.info('이전 메시지를 모두 불러왔어요.','Blue Lemonade');return;}
                const host=await import('../../../../../script.js');
                if(context().chatId!==oldKey)throw userError('채팅이 바뀌었어요. 다시 선택해 주세요.');
                await host.showMoreMessages(count);syncChat();
            }
            if(action==='save-preset') {
                const name=section.querySelector('[data-word-preset-name]').value.trim();
                if(!name)throw userError('저장할 프리셋 이름을 입력해 주세요.');
                if(cfg.presets.length>=24)throw userError('프리셋은 최대 24개까지 저장할 수 있어요.');
                const preset={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,name,rules:structuredClone(cfg.rules),caseSensitive:cfg.caseSensitive,wholeWords:cfg.wholeWords,particles:cfg.particles};
                cfg.presets.push(preset);saveSettings();
            }
            if(['load-preset','delete-preset'].includes(action)) {
                const id=section.querySelector('[data-word-preset]').value,preset=cfg.presets.find(p=>p.id===id);
                if(!preset)throw userError('프리셋을 먼저 선택해 주세요.');
                if(action==='delete-preset'){cfg.presets=cfg.presets.filter(p=>p.id!==id);if(getSettings().captureTools.preset===id)getSettings().captureTools.preset='';}
                else{for(const key of ['rules','caseSensitive','wholeWords','particles'])cfg[key]=structuredClone(preset[key]);invalidate();}
                saveSettings();
            }
            if(action==='add'){cfg.rules.push({from:'',to:'',enabled:true});saveSettings();}
            if(action==='none')selected.clear();
            if(action==='all')section.querySelectorAll('[data-word-message]').forEach(input=>selected.add(Number(input.dataset.wordMessage)));
            if(action==='pull-original'||action==='pull-translation') {
                if(!ids.length)throw userError('가져올 메시지를 먼저 선택해 주세요.');
                const translated=action==='pull-translation';
                const missing=ids.filter(id=>!ctx.chat[id]||(translated&&!(typeof ctx.chat[id].extra?.display_text==='string'&&ctx.chat[id].extra.display_text.trim())));
                if(missing.length)throw userError(translated?`#${missing.join(', #')}에 번역문이 없어요. 번역된 메시지만 선택해 주세요.`:'선택한 메시지가 바뀌었어요. 다시 선택해 주세요.');
                undoDraft=draft;
                draft=ids.map(id=>translated?(ctx.chat[id].extra.original_translation_backup||ctx.chat[id].extra.display_text):ctx.chat[id].mes).join('\n\n'); // 2026-10-06: 원문 보기 상태면 번역문은 backup 칸
            }
            if(action==='replace'){undoDraft=draft;draft=replaceText(draft,cfg.rules,cfg).text;}
            if(action==='undo-draft'&&undoDraft!==null){[draft,undoDraft]=[undoDraft,draft];}
            if(action==='copy'){await copyText(draft,section);globalThis.toastr?.success('복사했어요.','Blue Lemonade');}
            if(action==='preview') {
                if(!ids.length)throw userError('메시지를 먼저 선택해 주세요.');
                const gen=++previewGen; // 나중에 누른 전후 보기가 이긴다
                await loadHash();
                const next={key:ctx.chatId,rows:ids.map(id=>{
                    const message=ctx.chat[id],before=snapshot(message),after={...before};
                    const result=replaceText(before.mes,cfg.rules,cfg);after.mes=result.text;
                    if(before.display!==undefined)after.display=replaceText(before.display,cfg.rules,cfg).text;
                    // 2026-10-06: 원문 보기 상태의 치워 둔 번역문도 같은 규칙으로
                    if(before.backup!==undefined)after.backup=replaceText(before.backup,cfg.rules,cfg).text;
                    // 번역이 지금 원문 것이었을 때만 표식을 새 원문으로 (오래된 번역은 그대로 → 번역기가 다시 번역)
                    const fresh=before.display!==undefined&&before.hash!==undefined&&before.hash===sourceHash(message,before.mes);
                    if(after.mes!==before.mes&&fresh)after.hash=sourceHash(message,after.mes);
                    if(before.swipeText!==undefined)after.swipeText=after.mes;
                    // 2026-10-06: 원문은 그대로고 번역문만 바뀌면 번역문에서 바뀐 곳 수를 센다 (예전엔 '0곳 변경')
                    const slot=translationSlot(before);
                    return {id,message,before,after,fresh,count:result.count||(slot!==undefined?replaceText(slot,cfg.rules,cfg).count:0)};
                }).filter(row=>!same(row.before,row.after))};
                if(!next.rows.length){proposal=null;throw userError('선택한 메시지에서 바뀔 내용이 없어요.');}
                // 2026-10-06: 번역기 DB 의 번역(가공 전 글)도 같은 규칙으로 바꿀 몫을 미리 읽어 둔다 — 적용 · 되돌리기 때 씀. 번역문이 지금 원문 것일 때만
                //             (오래된 번역은 그대로 두어 번역기가 다시 번역). 번역기가 없거나 DB 줄이 없으면 예전처럼 화면 글만 바꾼다
                const translator=globalThis[Symbol.for('blue-lemonade.translator')];
                if(typeof translator?.readCachedTranslation==='function'&&typeof translator?.storeTranslationQuietly==='function')for(const row of next.rows){
                    if(!row.fresh)continue;
                    const oldSrc=String(ctx.substituteParams(row.before.mes??'',ctx.name1,row.message.name)??''),newSrc=String(ctx.substituteParams(row.after.mes??'',ctx.name1,row.message.name)??'');
                    let raw=null;try{raw=await translator.readCachedTranslation(oldSrc);}catch(error){console.warn('[Blue Lemonade] 번역 캐시 읽기',error);}
                    if(typeof raw!=='string'||!raw)continue;
                    const rawAfter=replaceText(raw,cfg.rules,cfg).text;
                    if(rawAfter!==raw||oldSrc!==newSrc)row.cache={oldSrc,newSrc,rawBefore:raw,rawAfter};
                }
                // 2026-10-06: 캐시를 읽는 사이 선택 해제·규칙 수정이 있었으면 옛 미리보기를 되살리지 않는다 (해제한 메시지에 적용되던 문제)
                if(gen!==previewGen)throw userError('규칙이나 선택이 바뀌었어요. 다시 전후 보기를 눌러 주세요.');
                proposal=next;
            }
            if(action==='apply'&&proposal){await applyTransaction(proposal);undoChat=proposal;proposal=null;}
            if(action==='undo-chat'&&undoChat){await applyTransaction(undoChat,true);undoChat=null;}
            if(action==='capture') {
                if(!ids.length)throw userError('메시지를 먼저 선택해 주세요.');
                button.disabled=true;await openCapturePreview(ids,section.querySelector('[data-capture-stage]'),()=>[...selected].sort((a,b)=>a-b));button.disabled=false;button.hidden=true;return;
            }
            if(action==='pull-original'||action==='pull-translation')root._addonFolds?.set(`${root._editorRoute}/workspace`,true);
            if(action==='preview')root._addonFolds?.set(`${root._editorRoute}/apply`,true);
            refresh();
            if(action==='pull-original'||action==='pull-translation'){const area=root.querySelector('[data-word-draft]');area?.scrollIntoView({block:'center',behavior:'smooth'});area?.focus({preventScroll:true});}
        } catch(error){if(!error.user)console.error('[Blue Lemonade] 글 도구',error);const status=section.querySelector('[data-word-status]');if(status)status.textContent=error.message||'작업에 실패했어요.';globalThis.toastr?.warning(error.message||'작업을 마치지 못했어요.','Blue Lemonade');button.disabled=false;if(button.dataset.wordAction==='capture')button.textContent='캡처 미리보기 만들기';}
    }));
}

// http:// 로 연 폰(LAN 접속)에는 clipboard API 가 없다 — 옛 복사 명령으로 대신한다. 설정 창이 실리태번 팝업(showModal)이면 창 밖(body)은 inert 라
// 거기 붙인 글 칸은 골라지지 않아 복사가 안 된다 → 누른 단추가 든 창(dialog) 안에 붙인다
async function copyText(text,near) {
    try{await navigator.clipboard.writeText(text);return;}catch{/* 아래 옛 방식 */}
    const back=document.activeElement,area=document.createElement('textarea');
    area.value=text;area.readOnly=true;area.style.cssText='position:fixed;top:0;left:0;opacity:0';
    (near?.closest('dialog[open]')||document.body).append(area);area.select();area.setSelectionRange(0,area.value.length); // iOS 는 readOnly 칸에서 select() 만으로 안 골라질 때가 있다
    let ok=false;try{ok=document.execCommand('copy');}catch{ok=false;}
    area.remove();back?.focus?.({preventScroll:true});
    if(!ok)throw userError('복사하지 못했어요.');
}
function popup(html) {
    const dialog=document.createElement('dialog');dialog.className='bl-tool-dialog';dialog.innerHTML=html;
    document.body.append(dialog);showThemeModal(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});return dialog;
}
function showHelp() {
    const dialog=popup(`<h3>치환 규칙 도움말</h3><p><b>여러 찾을 말</b><br>같은 단어의 다른 표기나 같은 결과로 바꿀 표현을 쉼표로 적어요. <code>레몬, lemon</code> → <code>귤</code>이면 ‘레몬’도 ‘lemon’도 ‘귤’로 바뀌어요. 한 단어로 합치는 뜻은 아니에요.</p><p><b>대소문자 구분</b><br>ON: <code>lemon</code>만 바뀌고 <code>Lemon</code>은 남아요.<br>OFF: <code>lemon</code>, <code>Lemon</code>, <code>LEMON</code>을 모두 찾아요.</p><p><b>낱말 단위</b><br>ON: ‘사과’는 찾지만 ‘사과나무’ 속 ‘사과’는 바꾸지 않아요. 조사 자동 보정을 함께 켜면 ‘사과는’처럼 조사가 붙은 말도 찾아요.<br>OFF: 다른 단어 안에 들어 있는 글자도 찾아요.</p><p><b>조사 자동 보정</b><br><code>사과 → 귤</code>이면 ‘사과는’ → ‘귤은’, ‘사과를’ → ‘귤을’로 맞춰요. OFF면 ‘귤는’, ‘귤를’처럼 원래 조사가 남아요.</p><button type="button" class="salty-btn">닫기</button>`);
    dialog.querySelector('button').onclick=()=>dialog.close();
}
function askCount() {
    return new Promise(resolve=>{
        const dialog=popup(`<form method="dialog"><h3>얼마나 채팅을 불러올까요?</h3><p>현재 목록에 입력한 개수만큼 이전 메시지를 더해요.</p><label>추가할 메시지 수<input type="number" name="count" min="1" max="1000" step="1" value="10" required></label><div class="bl-word-actions"><button type="submit" class="salty-btn">불러오기</button><button type="button" class="salty-btn" data-cancel>취소</button></div></form>`);
        let count=null;dialog.querySelector('form').onsubmit=event=>{event.preventDefault();count=Number(dialog.querySelector('input').value);if(Number.isInteger(count)&&count>=1&&count<=1000)dialog.close();};
        dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>resolve(count),{once:true});
    });
}
