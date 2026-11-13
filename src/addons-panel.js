// 1.1.5 시작 묶음 다이어트 — 설정 창 › 확장 탭의 애드온 카드(그리기 · 단추 잇기 · 세부 설정 칸)만 addons.js 에서 떼어 냈어요.
//   설정 창(panel.js)을 열 때만 받아요. 애드온 시작 · 상태(running · failed …)는 addons.js 한 곳이고, 여기서는 그 상태를 그대로 읽고 고쳐요(ES 모듈 내보내기는 살아 있는 이름이라 값이 늘 같아요).
import { addonsEnabled, switchNeedsReload } from './usage-mode.js';
import { toolSection } from './addon-layout.js';
import { leaveSettingsDialog } from './settings-dialog.js';
import { getSettings, saveSettings } from './settings.js';
import { TTS_VERSION } from './addons/tts/version.js';
import { PRIVATE_ADDONS, EMBEDDED_PRIVATE } from './private-addons.js';
import { running, failed, loading, waiting, names, folders, saving, saveError, lateStarted, lateIds, changed, persist, conflict, disableLegacy, syncAddonIcons } from './addons.js';
const icons={mermaid:'fa-diagram-project',zipinstall:'fa-file-zipper',tts:'fa-volume-high',direction:'fa-feather-pointed',assets:'fa-images',prompt:'fa-table-list',customstyle:'fa-sliders',translator:'fa-language',words:'fa-arrow-right-arrow-left',capture:'fa-camera',order:'fa-arrow-down-short-wide',perf:'fa-gauge-high',models:'fa-circle-plus',modelswitch:'fa-shuffle',regexlink:'fa-link',bookmarks:'fa-bookmark',notes:'fa-note-sticky','prompt-template':'fa-code',rewrite:'fa-glasses',...Object.fromEntries(EMBEDDED_PRIVATE.map(id=>[id,PRIVATE_ADDONS[id].icon]))};
const tabs=[['watchdog','끊김 감시','heart-pulse'],['timer','로딩 시간','stopwatch'],['perf','성능 보조','gauge-high'],['log','요청 로그','receipt'],['dedupe','저장 정리','floppy-disk'],['storage','저장 공간','hard-drive']];
let regexlinkStopped=false;   // 정규식 연동을 설정 창에서 멈췄나(다시 켜면 이어 감)
// 1.0.0 바탕: 애드온 카드 꼬리 출처 줄(전개 지시 · 캐릭터 에셋의 「출처 명시」 조건). 표와 TTS 출처 요약은 설정 창(panel.js)이 받는 src/addon-credits.js 에 있어요.
let creditOf = () => '';
// 1.0.0 되살림: 메모 카드 머리 판 알약(누르면 사용방법)의 판 글자 — 시작 그래프에 모듈을 늘리지 않게 설정 창(panel.js)이 notes/version.js 를 받아 넘겨요
let NOTES_VERSION = '';
export function setNotesVersion(v) { NOTES_VERSION = String(v || ''); }
export function setAddonCredits(fn) { creditOf = typeof fn === 'function' ? fn : () => ''; }
const RELOAD_ADDONS=['order','perf','models','modelswitch','regexlink','rewrite','direction','bookmarks','notes','zipinstall','assets','translator','prompt','prompt-template','customstyle','mermaid','tts',...EMBEDDED_PRIVATE];
// 처음 쓸 때 시작하는 애드온(LATE_ADDONS)은 아직 안 돌아도 켜진 애드온이에요 — 첫 사용 전에 「새로고침 필요」로 세지 않아요
export const addonsNeedReload = s => switchNeedsReload(s, new Set([...running, ...(lateStarted ? [] : lateIds)]), RELOAD_ADDONS);
let perfTail='';   // 1.0.3 성능 보조 맨 아래 칸 — 설정 창(panel.js)이 넘겨요
export function setPerfTail(html){perfTail=String(html||'');}
export function addonMarkup(s,id,nested=false){
    if(!nested && id==='models') return `<div class="bl-addon-group"><h3>모델 관리</h3>${addonMarkup(s,'models',true)}${addonMarkup(s,'modelswitch',true)}</div>`;
    if(!nested && id==='perf') return `<div class="bl-addon-group">${addonMarkup(s,'perf',true)}${addonMarkup(s,'regexlink',true)}${perfTail}</div>`;
    const on=!!s.addons[id],needsReload=RELOAD_ADDONS.includes(id)&&on!==(running.has(id)||!lateStarted&&lateIds.includes(id));
    // 7.0.5 프롬프트 템플릿: 켜 두기만 하고 확장을 설치하지 않았으면 「사용 중」 대신 설치 상태 · 한 줄 안내 · 「설치」 — 머리 바로 뒤 칸을 그 애드온이 채운다(mountCard)
    const ptCard=id==='prompt-template'&&on&&running.has(id)&&!needsReload&&addonsEnabled(s)?'<div class="blpt-card" data-pt-card></div>':'';
    const status=!addonsEnabled(s)?(s.enabled===false?'「블루레몬에이드 사용」이 꺼져 있어요':s.usageMode==='zero'?'제로 모드에서 꺼짐':'사용 모드에서 확장 기능이 꺼져 있어요'):saving?'설정 저장 확인 중…':saveError||(loading.has(id)?'기능을 불러오는 중…':failed.get(id))||(needsReload?'새로고침 대기':on?'사용 중':'꺼짐');
    const guideBadge=id==='notes'?`<button type="button" class="bl-addon-ver" data-notes-guide title="메모 사용방법" aria-label="메모 사용방법">${NOTES_VERSION?'v'+NOTES_VERSION:'?'}</button>`:id==='tts'?`<button type="button" class="bl-addon-ver" data-tts-guide title="TTS 사용방법" aria-label="TTS 사용방법">v${TTS_VERSION}</button>`:'';   // 1.0.0 후보: 8.2.5 처럼 판 알약(누르면 사용방법)
    const header=`<header class="bl-addon-header"><div><h3><i class="fa-solid ${icons[id]}" aria-hidden="true"></i> ${names[id]}${guideBadge}</h3><p role="status" class="bl-addon-status ${on?'is-on':''}">${status}</p></div><label class="bl-addon-power"><span>기능 켜기</span><input type="checkbox" data-addon-toggle="${id}" ${on?'checked':''} ${saving?'disabled':''}></label></header>${ptCard}`;
    if(['words','capture'].includes(id))return header+(on?'':`<div class="bl-capture-empty"><b>${names[id]}을 켜서 시작하세요</b><p>필요할 때만 사용하고, 설정은 그대로 보관해요.</p></div>`);
    const instructions={notes:'입력창 위 메모 줄의 ☰ 로 열어 쓰는 쪽지예요. 채팅 안에서 만든 메모는 그 채팅에만 보여요. #태그 · [[메모 연결]] · 폴더도 돼요. 자세한 쓰는 법은 제목 옆 버전 버튼을 눌러 보세요.',zipinstall:'ZIP 파일로 확장을 설치하고 업데이트해요. 처음 한 번 서버 도우미를 준비하면 PC·모바일에서 사용할 수 있어요. 요술봉 메뉴의 ZIP 설치로도 열려요.',tts:'채팅 대사를 캐릭터별 목소리로 읽어요. 음성 제공자를 연결하고 음성을 등록한 뒤 캐릭터에 지정하세요. 클라우드 음성 합성과 감정 분석은 연결한 서비스의 요금이 적용될 수 있어요.',direction:'입력창의 깃털 버튼에서 다음 전개를 적고 켜면 대화 요청에 지시가 들어가요. 기존 전개 지시 개조본의 설정과 내용을 이어 써요.',assets:'캐릭터별 그림을 관리하고 AI 답변에 표시해요. 기존 그림 폴더와 개조본 설정을 이어 써요. 단독 캐릭터 에셋은 끈 뒤 새로고침해 주세요.',customstyle:'커스텀 CSS의 변수 정의를 슬라이더·색상·입력칸으로 조절해요. IceFog72의 MIT 확장을 통합했어요.',prompt:'프리셋·월드인포·봇카드를 읽고 번역해요. 기존 단독 Prompt Panel은 끈 뒤 사용하세요. 버전 버튼에서 사용방법을 볼 수 있어요.',translator:'기존 LLM 번역의 설정·용어집·번역 기록을 그대로 이어 써요. 기능을 켜려면 기존 단독 LLM 번역을 끈 뒤 새로고침해 주세요.',bookmarks:'메시지에 북마크를 남기고, 모아 보고, 메모하고, 그 자리로 돌아가요. ✦ 메뉴의 북마크로도 열려요.',order:'확장 설정 패널의 순서를 정리해요.',perf:'응답·로딩·저장을 살피고, 아래에서 정규식 연동도 관리해요.',models:'공급자 목록에 없는 모델 이름을 직접 등록해요.',modelswitch:'번역 · 다시 쓰기처럼 모델을 따로 고르는 확장들을 한 번에 바꿔요.',regexlink:'프롬프트 관리자에서 끈 모듈(모멘텀 엔진 · 상태창 · 선택지 …)의 정규식을 자동으로 끄고, 켜면 돌려놓아요. 꺼진 정규식은 답이 오는 동안 돌지 않아 스트리밍이 가벼워져요.',rewrite:'AI 답변에서 보기 싫은 묘사가 나온 문장만 골라 다시 쓰게 해요. 쓰는 법은 세부 설정의 버전 표시를 눌러 보세요.'};
    // 8.3.0 단독 확장을 테마 안으로 들인 것(private-addons.js)은 그 확장이 그리던 서랍 카드 · 요술봉 · 독 항목은 그대로, 이 카드는 켜고 끄기 · 세부 설정 · 옛 단독 폴더 끄기만
    // 6.9.9 프롬프트 템플릿: 원본(zonde306 · AGPL-3.0)을 수정 없이 ZIP 으로 담아 실리태번 확장 폴더에 설치하는 도구 — 테마 안에서 실행하지 않는다 (addons/prompt-template/NOTICE.md)
    instructions['prompt-template']='프롬프트 · 카드 · 월드 인포 안에 &lt;% %&gt; 템플릿(EJS)을 쓰는 확장 ST-Prompt-Template 을 담긴 원본 그대로 실리태번에 설치 · 업데이트 · 삭제해요. 설치에는 ZIP 설치의 서버 도우미가 필요하고, 설치 뒤 새로고침하면 실리태번 확장으로 켜져요.';
    instructions.mermaid='채팅에 도표가 있을 때만 그림 도구를 불러와요. AI 답변의 mermaid 코드 블록을 그림으로 표시하며, 실패하면 원문과 다시 그리기 버튼을 남겨요. 단독 Mermaid 확장이 켜져 있으면 내장 기능은 대기해요.';
    // 8.3.0 개인 확장: 옛 단독 폴더가 켜져 있으면 「옛 단독 확장 끄기」(내장된 개인 확장 전부의 옛 폴더를 한 번에 끈다 · 새로고침은 따로)
    const legacyNote=PRIVATE_ADDONS[id]?' 옛 단독 폴더가 켜져 있으면 테마 쪽은 대기해요 — 「옛 단독 확장 끄기」를 누르고 새로고침하면 설정 · 자료 그대로 이어져요.':folders[id]&&!['assets','prompt','translator'].includes(id)?' 기존 단독 확장과는 둘 중 하나만 켜 주세요.':'';
    const legacyOff=waiting.has(id)?`<button type="button" class="salty-btn bl-apply-pending" data-legacy-off="${id}" ${saving?'disabled':''}>옛 단독 확장 끄기</button>`:'';
    const credit=creditOf(id);   // 5.1.2 원작자 있는 내장 확장의 세부 설정 맨 아래 출처 줄 — 표는 src/addon-credits.js(설정 창이 받아 넘겨요, 시작 그래프 밖)
    const actions=`<p class="salty-note">${instructions[id]}${legacyNote}</p><div class="bl-addon-actions"><button type="button" class="salty-btn bl-tool-primary bl-addon-mobile-open" data-addon-open="${id}" ${running.has(id)?'':'disabled'}>세부 설정</button>${legacyOff}<button type="button" class="salty-btn ${needsReload||saveError?'bl-apply-pending':''}" data-addon-reload ${saving||loading.has(id)?'disabled':''}>새로고침해서 적용</button></div>`;
    const position=id==='translator'?`<label class="bl-addon-toggle"><input type="checkbox" data-translator-drawer ${s.addonUI.translatorDrawer!==false?'checked':''}><span>실리태번 확장 탭에 번역 설정 표시</span></label><p class="salty-note">숨겨도 번역은 계속 동작해요. 블루레몬에이드 → 확장 → LLM 번역에서 설정할 수 있어요.</p>`:id==='tts'?`<label class="bl-addon-toggle"><input type="checkbox" data-tts-drawer ${s.addonUI.ttsDrawer!==false?'checked':''}><span>확장 탭에 TTS 설정 표시</span></label><p class="salty-note">실리태번 확장 탭에서 바로 설정해요. 숨겨도 이 화면과 켜 둔 요술봉 메뉴에서 열 수 있어요.</p>`:['order','perf'].includes(id)?`<div class="bl-tool-grid"><label class="bl-addon-toggle"><input type="checkbox" data-addon-icon="${id}" ${s.addonUI[id+'Icon']?'checked':''}><span>확장 관리 아이콘</span></label></div><p class="salty-note">숨겨도 이 화면의 세부 설정으로 열 수 있어요.</p>`:'';
    const perf=id==='perf'?`<div class="bl-tool-label"><b>별 두 개 메뉴<button type="button" class="bl-word-help bl-help-btn" data-perf-help aria-label="성능 보조 도움말"><i class="fa-solid fa-question" aria-hidden="true"></i></button></b></div><div class="bl-tool-grid">${tabs.map(([key,title])=>`<label class="bl-addon-toggle"><input type="checkbox" data-perf-menu="${key}" ${s.addonUI.perfMenu[key]?'checked':''}><span>${title}</span></label>`).join('')}</div><p class="salty-note">메뉴만 숨겨도 기능은 계속 동작해요. 끊김 감시는 스트리밍 응답에만 적용돼요.</p>`:'';
    const where=['order','perf'].includes(id)?`<div class="bl-addon-position-preview" aria-label="아이콘 위치 미리보기"><small>확장 관리 탭 상단</small><div><span>확장 프로그램 설치</span>${s.addonUI[id+'Icon']?`<span class="bl-preview-location"><i class="fa-solid ${id==='order'?'fa-arrow-down-short-wide':'fa-gear'}"></i> ${names[id]}</span>`:'<span>아이콘 숨김</span>'}</div></div>`:'';  // 4.7.3: 아이콘 위치가 있는 애드온만 미리보기 — '사용 흐름' 칸은 모델 등록 흐름이 다른 애드온에도 붙어 뺐다
    const notesMenu=id==='notes'?`<label class="bl-addon-toggle"><input type="checkbox" data-addon-menu="notes" ${s.addonUI.notesMenu!==false?'checked':''}><span>요술봉에 메모 표시</span></label><label class="bl-addon-toggle"><input type="checkbox" data-addon-menu="notesBar" ${s.addonUI.notesBarMenu!==false?'checked':''}><span>입력창 위에 메모 줄 표시 (빠른 답장처럼 · 제목을 누르면 내용)</span></label>`:'';
    const modelMenu=id==='modelswitch'?`<label class="bl-addon-toggle"><input type="checkbox" data-addon-menu="modelswitch" ${s.addonUI.modelswitchMenu!==false?'checked':''}><span>요술봉에 모델 전환 표시</span></label><div class="bl-wand-preview" aria-label="모델 전환 메뉴 미리보기"><div class="bl-wand-preview-menu">${s.addonUI.modelswitchMenu!==false?'<p><i class="fa-solid fa-shuffle"></i> 모델 전환</p>':'<p>모델 전환 숨김</p>'}</div></div>`:'';
    const wand=id==='perf'?`<div class="bl-wand-preview" aria-label="요술봉 메뉴 미리보기"><small>입력창 왼쪽 ✦ 메뉴</small><div class="bl-wand-preview-menu">${tabs.filter(([key])=>s.addonUI.perfMenu[key]).map(([,title,icon])=>`<p><i class="fa-solid fa-${icon}"></i> ${title}</p>`).join('')||'<p>표시 항목 없음</p>'}</div></div>`:'';
    const zipMenu=id==='zipinstall'?`<label class="bl-addon-toggle"><input type="checkbox" data-addon-menu="zipinstall" ${s.addonUI.zipinstallMenu!==false?'checked':''}><span>요술봉에 ZIP 설치 표시</span></label><div class="bl-wand-preview" aria-label="ZIP 설치 메뉴 미리보기"><div class="bl-wand-preview-menu">${s.addonUI.zipinstallMenu!==false?'<p><i class="fa-solid fa-file-zipper"></i> ZIP 설치</p>':'<p>ZIP 설치 숨김</p>'}</div></div><p class="salty-note">숨겨도 이 화면의 세부 설정에서 열 수 있어요.</p>`:'';
    const location=position+where+perf+wand+modelMenu+notesMenu+zipMenu;   // 1.0.0 간단화: 「표시할 위치」는 거의 안 바꾸는 것이라 처음엔 접어 둬요(누르면 펼침)
    return `<div class="bl-addon-layout bl-addon-embedded-layout"><div class="bl-addon-main">${header}${toolSection(id+'-activation','실행·설정',actions,true)}${location?toolSection(id+'-menus','표시할 위치',location,false):''}</div><div class="bl-addon-config bl-addon-inline" data-addon-inline="${id}"><h3 class="bl-inline-title">세부 설정</h3><div class="bl-addon-inline-content" role="region" aria-label="${names[id]} 세부 설정"><p class="salty-note">${running.has(id)?'설정을 불러오는 중…':'기능을 켜고 새로고침하면 여기에서 설정할 수 있어요.'}</p></div></div>${credit}</div>`;
}

// 정규식 연동은 끄는 순간 원래 켜짐 상태로 되돌린다 (새로고침 뒤에 안 실려도 꺼 둔 정규식이 남지 않게)
// 멈춘 뒤엔 돌지 않는 것으로 친다: 세부 설정 · 옆 칸이 다시 붙어 정규식을 또 끄지 않게 (다시 켜면 새로고침)
async function stopRegexlink(){
    try{await (await import('./addons/regexlink/index.js')).stop();}catch(error){console.warn('[Blue Lemonade]',error);}
    running.delete('regexlink');
    regexlinkStopped=true;
}
// 설정 초기화 · 가져오기 뒤: 돌고 있는 정규식 연동을 새 켜짐 값에 맞춘다 (안 돌던 것은 불러오지 않는다)
export async function syncRegexlinkFlag({resume=false}={}){
    if(!running.has('regexlink')&&!(resume&&regexlinkStopped))return;
    try{
        const s=getSettings();
        if(addonsEnabled(s)&&s.addons?.regexlink){
            const module=await import('./addons/regexlink/index.js');
            if(resume&&regexlinkStopped){await module.resume();running.add('regexlink');regexlinkStopped=false;changed();}
            else module.sync();
        }
        else{await stopRegexlink();changed();}
    }catch(error){console.warn('[Blue Lemonade]',error);}
}

export function bindAddons(root,refresh){
    const cleanups=[];
    for(const slot of root.querySelectorAll('[data-addon-inline]')) cleanups.push(bindInlineAddon(root,slot));
    root._addonCleanup=()=>cleanups.forEach(cleanup=>cleanup?.());
    root.querySelectorAll('[data-pt-card]').forEach(async host=>{try{(await import('./addons/prompt-template/index.js')).mountCard(host);}catch(error){console.warn('[Blue Lemonade] 프롬프트 템플릿',error);}});

    root.querySelectorAll('[data-addon-toggle]').forEach(input=>input.addEventListener('change',async()=>{
        const id=input.dataset.addonToggle,on=input.checked;
        if(on&&folders[id]&&await conflict(id)){
            // 8.3.0 개인 확장은 켜 두고 「대기」로 — 카드에 「옛 단독 확장 끄기」가 뜬다 (옛 폴더를 끄고 새로고침하면 이어서 돈다)
            if(PRIVATE_ADDONS[id]){waiting.add(id);failed.set(id,'기존 단독 확장이 켜져 있어 테마 쪽은 대기 중이에요. 「옛 단독 확장 끄기」를 누르고 새로고침해 주세요.');}
            else{input.checked=false;globalThis.toastr?.warning(`${names[id]} 단독 확장이 켜져 있어요. 확장 관리에서 둘 중 하나를 꺼 주세요.`,'Blue Lemonade');return;}
        }
        getSettings().addons[id]=on;
        if(!on)failed.delete(id);
        if(id==='regexlink'&&!on&&running.has(id))await stopRegexlink();
        if(id==='tts'&&running.has(id))(await import('./addons/tts/shell.js')).syncEnabled();
        try{await persist();}catch(error){globalThis.toastr?.warning(error.message,'Blue Lemonade');}await syncAddonIcons();refresh();
    }));
    root.querySelectorAll('[data-addon-open]').forEach(button=>button.addEventListener('click',async()=>{
        if(['bookmarks','prompt'].includes(button.dataset.addonOpen))leaveSettingsDialog(button); // 5.3.7 body 창은 dialog 아래에 깔린다 — 나머지는 dialog · 팝업이라 위에 뜬다
        if(button.dataset.addonOpen==='tts'){(await import('./addons/tts/shell.js')).openPanel();return;}
        if(button.dataset.addonOpen==='direction'){(await import('./addons/direction/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='assets'){(await import('./addons/assets/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='prompt'){(await import('./addons/prompt/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='mermaid'){(await import('./addons/mermaid/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='prompt-template'){(await import('./addons/prompt-template/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='customstyle'){(await import('./addons/customstyle/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='translator'){(await import('./addons/translator/bridge.js')).openPanel();return;}
        if(button.dataset.addonOpen==='modelswitch'){(await import('./addons/modelswitch/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='regexlink'){(await import('./addons/regexlink/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='rewrite'){(await import('./addons/rewrite/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='bookmarks'){(await import('./addons/bookmarks/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='zipinstall'){(await import('./addons/zipinstall/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='notes'){(await import('./addons/notes/index.js')).openPanel();return;}
        if(button.dataset.addonOpen==='models'){(await import('./addons/models/panel.js')).openPanel();return;}
        if(button.dataset.addonOpen==='order')(await import('./addons/order/panel.js')).openDialog();else(await import('./addons/perf/hub.js')).openHub();
    }));
    root.querySelector('[data-translator-drawer]')?.addEventListener('change',async(event)=>{getSettings().addonUI.translatorDrawer=event.target.checked;try{await persist();}catch(error){globalThis.toastr?.warning(error.message);}await syncAddonIcons();});
    root.querySelector('[data-tts-drawer]')?.addEventListener('change',async(event)=>{getSettings().addonUI.ttsDrawer=event.target.checked;if(running.has('tts'))(await import('./addons/tts/index.js')).syncVisibility();try{await persist();}catch(error){globalThis.toastr?.warning(error.message);}await syncAddonIcons();});
    root.querySelectorAll('[data-addon-menu]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI[input.dataset.addonMenu+'Menu']=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    root.querySelectorAll('[data-addon-icon]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI[input.dataset.addonIcon+'Icon']=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    root.querySelectorAll('[data-perf-menu]').forEach(input=>input.addEventListener('change',async()=>{getSettings().addonUI.perfMenu[input.dataset.perfMenu]=input.checked;saveSettings();await syncAddonIcons();refresh();}));
    // 8.3.0 「옛 단독 확장 끄기」 — 내장된 개인 확장 전부의 켜진 옛 폴더를 끄고 저장 (새로고침은 옆 단추로)
    root.querySelectorAll('[data-legacy-off]').forEach(button=>button.addEventListener('click',async()=>{
        button.disabled=true;
        try{const off=await disableLegacy(EMBEDDED_PRIVATE);globalThis.toastr?.success(off.length?`옛 단독 확장 ${off.length}개를 꺼 두었어요. 새로고침하면 테마 쪽이 이어서 돌아요.`:'켜져 있는 옛 단독 확장이 없어요.','Blue Lemonade');}
        catch(error){globalThis.toastr?.warning(error?.message||String(error),'Blue Lemonade');}
        refresh();
    }));
    root.querySelectorAll('[data-addon-reload]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await persist();location.reload();}catch(error){globalThis.toastr?.warning(error.message,'Blue Lemonade');refresh();}}));
    root.querySelector('[data-perf-help]')?.addEventListener('click',async()=>{(await import('./addons/perf/help.js')).showPerfHelp();});
    root.querySelectorAll('[data-notes-guide]').forEach(button=>button.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();const open=running.has('notes')?async()=>(await import('./addons/notes/index.js')).openPanel():null;(await import('./addons/notes/guide.js')).showNotesGuide({onOpen:open});}));
    root.querySelectorAll('[data-tts-guide]').forEach(button=>button.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();(await import('./addons/tts/guide.js')).showTtsGuide();}));
}

// Only the visible editor owns an embedded settings view. Resize and route changes
// return persistent controls to their holders; no duplicate listeners or panels.
function bindInlineAddon(editor,slot) {
    if(!slot)return;
    const id=slot.dataset.addonInline,host=slot.querySelector('.bl-addon-inline-content');
    let disposed=false,epoch=0,cleanup=null,mounting=false;
    const update=async()=>{
        const wide=getComputedStyle(slot).display!=='none';
        if(!wide){epoch++;mounting=false;cleanup?.();cleanup=null;return;}
        if(disposed||cleanup||mounting||!running.has(id))return;
        mounting=true;const token=++epoch;
        try{
            const api=await (id==='zipinstall'?import('./addons/zipinstall/index.js'):id==='tts'?import('./addons/tts/shell.js'):id==='notes'?import('./addons/notes/index.js'):id==='direction'?import('./addons/direction/index.js'):id==='assets'?import('./addons/assets/index.js'):id==='prompt'?import('./addons/prompt/index.js'):id==='mermaid'?import('./addons/mermaid/index.js'):id==='prompt-template'?import('./addons/prompt-template/index.js'):id==='customstyle'?import('./addons/customstyle/index.js'):id==='translator'?import('./addons/translator/bridge.js'):id==='order'?import('./addons/order/panel.js'):id==='perf'?import('./addons/perf/hub.js'):id==='models'?import('./addons/models/panel.js'):id==='modelswitch'?import('./addons/modelswitch/index.js'):id==='regexlink'?import('./addons/regexlink/index.js'):id==='rewrite'?import('./addons/rewrite/index.js'):import('./addons/bookmarks/index.js'));
            if(disposed||token!==epoch||!slot.isConnected)return;
            host.replaceChildren();cleanup=api.mountInline(host);
        }catch(error){if(!disposed&&token===epoch){host.textContent='설정을 불러오지 못했어요. 화면을 다시 열어 주세요.';console.error('[Blue Lemonade]',error);}}
        finally{if(token===epoch)mounting=false;}
    };
    // 칸을 숨기는 CSS 가 늦게 붙는 느린 기기: 크기가 안 변해 ResizeObserver 가 안 울릴 수 있어 몇 번 더 확인한다
    const observer=new ResizeObserver(update);observer.observe(editor);
    for(const delay of [400,1500,4000])setTimeout(()=>{if(!disposed)update();},delay);
    update();
    return ()=>{disposed=true;epoch++;observer.disconnect();cleanup?.();};
}
