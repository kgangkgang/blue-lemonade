import { syncTypography } from './typography.js';
// 켜야 쓰는 기능 (3.1.0): 몰입 읽기 · 한 손 버튼 줄 · 데우스 카드 스킨 · 캐릭터별 스타일 · (3.2.0) 화이트/나이트 자동의 코드는 켤 때 처음 불러온다.
// 꺼 두면 파일도 받지 않고 이벤트도 걸지 않는다 — 테마가 무거워지지 않게. 한 번 불러온 뒤 끄면 그 모듈이 스스로 정리한다.
import { syncSplash } from './splash.js';
// 칵테일 · 바이바이가 켜져 있으면 같은 일을 하는 성능 기능은 쉰다 (ext-presence.js — 토글 값은 그대로, 그 확장을 지우면 바로 다시 켜진다)
import { startPresence, onPresenceChange, restingFor } from './ext-presence.js';
let presenceBound = false;

const modules = {};
let hooks = { applyAll: null, refreshPanels: null };

/** index.js 가 채움 (apply.js · panel.js 를 여기서 불러오면 서로 물림) */
export function setFeatureHooks(next) {
    hooks = next;
}
const load = (name, url) => (modules[name] ??= import(url).catch((error) => {
    delete modules[name];
    console.warn(`[Blue Lemonade] ${name} 기능을 불러오지 못했어요`, error);
    return null;
}));

// 스크립트 런타임: 시작할 때 파일을 못 받으면(폰에서 가끔) 예전에는 다음 설정 변경 때까지 다섯 개가 전부 '꺼짐'으로 남았다 — 몇 번 다시 받는다
const ignoredHan=new Set(); let pendingHan=null;
let scriptsWanted=false,scriptRetry=0,scriptHeal=[],scriptWatch=false,scriptsKey='';
function startScripts(tries=4){
    clearTimeout(scriptRetry);
    load('scripts','./scripts/runtime.js').then((m)=>{
        if(m){
            // 시작 직후에는 설정 적용이 여러 번 겹친다 — 끝난 뒤에도 켜 둔 스크립트가 멈춰 있으면 다시 시작한다 (5초 · 15초 · 40초 뒤 확인)
            for(const timer of scriptHeal)clearTimeout(timer);
            // 4.3.4: 폰에서 테마를 다시 깐 뒤 한동안 파일이 빈 채로 읽히는 일이 있다 — 5분까지 간격을 벌려 가며 다시 시도한다
            scriptHeal=[5000,15000,40000,90000,150000,220000,300000].map(ms=>setTimeout(()=>m.healScripts(scriptsWanted),ms));
            // ✦ 메뉴를 열 때와 화면으로 돌아올 때도 본다 — 밖에서 닫힌 스크립트(상태는 '사용 중', 메뉴는 중국어)를 그 자리에서 되살린다
            if(!scriptWatch){scriptWatch=true;
                document.addEventListener('click',(event)=>{
                    if(!event.target?.closest?.('#extensionsMenuButton'))return;
                    m.healScripts(scriptsWanted);
                    // 그래도 헬퍼 항목이 중국어로 남아 있으면(스크립트는 '사용 중') 헬퍼 한글화를 새로 시작한다 — 새로 시작하면 메뉴 전체를 처음부터 다시 훑는다
                    for(const ms of [700,2500])setTimeout(()=>{
                        if(!scriptsWanted||m.scriptStatus('helper')!=='사용 중')return;
                        const labels=[...document.querySelectorAll('#extensionsMenu .list-group-item, #extensionsMenu .extension_container span')].map(node=>node.textContent.trim()).filter(text=>/[一-鿿]/.test(text));
                        if(pendingHan){for(const text of labels)if(pendingHan.has(text))ignoredHan.add(text);pendingHan=null;}
                        const left=labels.filter(text=>!ignoredHan.has(text));
                        if(left.length&&m.reviveScript('helper','메뉴에 한자가 남음'))pendingHan=new Set(left);
                    },ms);
                },true);
                document.addEventListener('visibilitychange',()=>{if(!document.hidden)m.healScripts(scriptsWanted);});}
            return m.syncScripts(scriptsWanted);
        }
        if(tries>0)scriptRetry=setTimeout(()=>startScripts(tries-1),2500);
        else scriptsKey=''; // 끝내 못 받았으면 다음 설정 적용 때 다시 시도
    }).catch(error=>console.error('[Blue Lemonade] 스크립트를 시작하지 못했어요',error));
}

/** apply.js applyAll 끝에서 부른다 */
export function syncFeatures(s, addonsOn = !!s.enabled) {
    const on = !!s.enabled;
    if (!presenceBound) { presenceBound = true; onPresenceChange(() => { hooks.applyAll?.(); hooks.refreshPanels?.(); }); startPresence(); }
    if (['conflicts'].some(id=>s.addons?.[id]) || modules.assist) load('assist','./assist/index.js').then(m=>m?.syncAssist());
    syncTypography(on);
    if (on || modules.promptchoices) load('promptchoices', './prompt-choice.js').then(m => m?.syncPromptChoices(on));
    // 7.0.4 글꼴 설정과 상관없이 테마가 켜져 있으면 — 채팅 iframe 과일 상태창의 낱말 꺾임 막기 (fruit-type-runtime wrapCss)
    if((on&&s.usageMode!=='extensions')||modules.fruittype)load('fruittype','./fruit-type-runtime.js').then(m=>m?.syncFruitTypography(s.fruitTypography,on && s.usageMode!=='extensions'));
    // 6.6.5 다른 확장 · 실리태번의 두꺼운 알약 · 동그라미 글자 버튼을 얇은 둥근 네모로 (사용자: "큰 알약 싫어")
    const squared=on&&s.usageMode!=='extensions'&&s.squareButtons!==false;
    if(squared||modules.squared)load('squared','./squared-buttons.js').then(m=>m?.syncSquaredButtons(squared));
    // 6.6.9 다른 기기(Syncthing · 다른 탭)에서 지금 채팅이 바뀌면 띠 + 덮어쓰기 전에 묻기 (chat-sync.js, 기본 켬)
    const chatWatch=(on||addonsOn)&&s.syncWatch!==false;
    if(chatWatch||modules.chatsync)load('chatsync','./chat-sync.js').then(m=>m?.syncChatWatch(chatWatch));
    // 6.0.4 단어 치환 › 잠시 가리기: 테마를 끄면 가린 글을 모두 되돌린다 — 모듈을 이미 불러온 뒤에만 (안 썼으면 파일도 안 받는다)
    if (modules.wordmask) load('wordmask', './wordmask.js').then(m => m?.syncWordMask(on));
    const fold=on&&!!(s.chat?.triangleFold??SillyTavern.getContext().extensionSettings?.blue_lemonade_scripts?.enabled?.fold);
    if(fold||modules.fold)load('fold','./fold.js').then(m=>m?.syncFold(fold));
    const scriptsEnabled=SillyTavern.getContext().extensionSettings?.blue_lemonade_scripts?.enabled||{};
    const scriptsRequested=Object.entries(scriptsEnabled).some(([id,v])=>id!=='fold'&&v===true);
    // The editor can start the runtime before this module has imported it.
    scriptsWanted=addonsOn&&scriptsRequested;
    // 5.3.4: applyAll 마다(슬라이더를 끌면 프레임마다) 되살림 타이머 일곱 개를 지우고 다시 걸었다 — 처음 · 스크립트 켜고 끔이 바뀔 때만
    const key=`${scriptsWanted}|${JSON.stringify(scriptsEnabled)}`;
    if((scriptsRequested||modules.scripts)&&key!==scriptsKey){scriptsKey=key;startScripts();}
    const reader = on && !!s.reader?.autoHide;
    if (reader || modules.reader) load('reader', './reader.js').then(m => m?.syncReader(reader));
    const bgWindow = on && !!s.bgWindow?.on;
    if (bgWindow || modules.bgwindow) load('bgwindow', './background-window.js').then(m => m?.syncBackgroundWindow(bgWindow, s.bgWindow?.mode));
    // 6.9.8 「이전 메시지 더 보기」 저절로 (show-more-auto.js, 기본 켬) · 새 답 첫 줄로 가는 ↑ (reply-top.js, 켤 때만)
    const showMore = on && s.chat?.showMoreAuto !== false;
    if (showMore || modules.showmore) load('showmore', './show-more-auto.js').then(m => m?.syncShowMoreAuto(showMore));
    // 7.9.9 단추를 손으로 누르면 불러온 메시지를 보여 준다 (show-more-tap.js, 자동 더 보기와 상관없이 · 테마가 켜져 있을 때)
    if (on || modules.showmoretap) load('showmoretap', './show-more-tap.js').then(m => (on ? m?.installShowMoreTap() : m?.uninstallShowMoreTap()));
    // 아바타는 가까워질 때 받기 (lazy-avatars.js, 기본 켬) — 캐릭터 · 페르소나 목록의 화면 밖 썸네일을 미룬다
    const lazyAvatars = on && s.chat?.lazyAvatars !== false && !restingFor('lazyAvatars');
    if (lazyAvatars || modules.lazyavatars) load('lazyavatars', './lazy-avatars.js').then(m => m?.syncLazyAvatars(lazyAvatars));
    const replyTop = on && !!s.chat?.replyTop;
    if (replyTop || modules.replytop) load('replytop', './reply-top.js').then(m => m?.syncReplyTop(replyTop));
    // 7.0.3 메시지 토큰 — 7.0.4 부터 토큰 수를 누르면 내역 (sent-tokens.js, 기본 켬)
    const sentTokens = on && s.chat?.sentTokens !== false;
    if (sentTokens || modules.senttokens) load('senttokens', './sent-tokens.js').then(m => m?.syncSentTokens(sentTokens));
    const replyNotify = on && !!s.replyNotify?.on;
    if (replyNotify || modules.replynotify) load('replynotify', './reply-notify.js').then(m => m?.syncReplyNotify(replyNotify));
    const onehand = on && !!s.onehand?.on;
    if (onehand || modules.onehand) load('onehand', './onehand.js').then(m => m?.syncOneHand(onehand, s.onehand));
    const auto = on && !!s.auto?.on;
    if (auto || modules.auto) load('auto', './automode.js').then(m => m?.syncAutoMode(auto, hooks));
    // 3.3.0 날씨 효과 (weather.js — 그리기는 워커)
    // 트래커 따라는 데우스 호환이 켜졌을 때만 (3.4.0)
    const weatherChat = s.chat?.weather === 'tracker' && !s.deus?.on ? { ...s.chat, weather: 'off' } : s.chat;
    const weather = on && !!weatherChat?.weather && weatherChat.weather !== 'off';
    if (weather || modules.weather) load('weather', './weather.js').then(m => m?.syncWeather(weather, weatherChat));
    // 6.9.8 장면 소리: 날씨 효과에 맞춘 배경 소리 (scene-sound.js — 켤 때만 불러온다 · 다리 Symbol.for('blue-lemonade.ambient') 로 TTS 효과음과 겹치지 않게)
    const sceneSound = on && !!s.sceneSound?.on;
    if (sceneSound || modules.scenesound) load('scenesound', './scene-sound.js').then(m => m?.syncSceneSound(sceneSound, s.sceneSound, weatherChat, weather));
    // 5.3.7 큰 숫자는 쉼표로: 숫자 칸의 30000 을 포커스 밖에서만 30,000 으로 (numcomma.js — 끄면 듣기 · 덧씌운 값까지 전부 뗀다)
    const numComma = on && s.chat?.numComma !== false;
    if (numComma || modules.numcomma) load('numcomma', './numcomma.js').then(m => m?.syncNumComma(numComma));
    // 6.6.9 글자색 대비 맞추기: 메시지에 적힌 글자색이 바탕에 묻히면 밝기만 옮겨 보여 준다 (ink-contrast.js — 끄면 덧씌운 표시를 모두 뗀다)
    const ink = on && s.usageMode !== 'extensions' && s.chat?.inkContrast !== false;
    if (ink || modules.inkcontrast) load('inkcontrast', './ink-contrast.js').then(m => m?.syncInkContrast(ink));
    // 4.1.3 ··· 메뉴 버튼 고정 (mes-pins.js)
    const pins = on && (s.chat?.mesPins?.length || 0) > 0;
    // 4.7.1: 고정한 버튼이 없어도 길게 눌러 꺼내는 손짓은 있어야 하므로 테마가 켜져 있으면 늘 부른다
    if (on || modules.mespins) load('mespins', './mes-pins.js').then(m => m?.syncMesPins(pins, s.chat.mesPins, on));
    // 6.6.9 대사만 보기: ··· 메뉴에 단추 하나 — 화면은 처음 누를 때 불러온다 (dialogue-only.js · 끄기는 chat.dialogueOnly=false)
    const dialogueOnly = (on || addonsOn) && s.chat?.dialogueOnly !== false;
    if (dialogueOnly || modules.dialogueonly) load('dialogueonly', './dialogue-only.js').then(m => m?.syncDialogueOnly(dialogueOnly));
    // 데우스 감정 대사: 프리셋 정규식이 못 받는 「…」 대사를 화면에서 감싼다 (dem-expressive.js)
    const demfx = on && !!s.deus?.on && !!s.deus?.fx?.on;
    if (demfx || modules.demfx) load('demfx', './dem-expressive.js').then(m => m?.syncDemExpressive(demfx));
    const dem = on && !!s.deus?.on && !!s.chat?.demSkin;
    if (dem || modules.dem) load('dem', './demskin.js').then(m => m?.syncDemSkin(dem, s.chat));
    // 8.0.9 데우스 V3 하늘: 트래커 시각으로 해 · 달 자리, 날짜로 달 위상 (dem-sky.js — 카드 스킨을 끄면 덧씌운 값을 모두 뗀다)
    if (dem || modules.demsky) load('demsky', './dem-sky.js').then(m => m?.syncDemSky(dem));
    // 3.5.1 새로고침 첫 화면 파일 (user.css 에 줄이 있을 때만 씀 — splash.js)
    syncSplash(s, () => hooks.refreshPanels?.());
    // 캐릭터별 스타일: 이어 둔 캐릭터가 있을 때만. 입혀 둔 동안 바꾼 모습은 그 스타일에 적음
    const chars = Object.keys(s.charStyles || {}).length > 0 || !!s.activeStyle;
    if (on && (chars || modules.charstyle)) {
        load('charstyle', './charstyle.js').then((m) => {
            if (!m) return;
            m.startCharStyles(hooks.applyAll, hooks.refreshPanels);
            if (s.activeStyle) m.noteChange();
        });
    }
    // 6.0.4 프롬프트 귀속: 프롬프트 편집 창에 「자동 켜기」 줄을 붙이고 채팅이 바뀌면 묶인 항목을 켜고 끈다 (테마가 켜져 있으면 늘)
    if (on || modules.promptbind) load('promptbind', './promptbind.js').then(m => m?.startPromptBinds());
    // 6.0.4 확장 위 스위치: 확장 창 안의 켜기·끄기를 제목 줄에도 (창 안 「확장 탭에 보이기」로 고른 창만 · 테마를 끄면 뗀다)
    // 6.8.8 「확장 탭에 보이기」 줄을 끄고(설정) 꺼내 둔 스위치도 없으면 모듈을 아예 쉬게 한다 (확장 칸 관찰 · 2초 맞추기 없음)
    const headSwitchWanted = on && (s.headSwitchRows !== false || Object.keys(s.headSwitches || {}).length > 0);
    if (headSwitchWanted || modules.headswitch) load('headswitch', './headswitch.js').then(m => m?.syncHeadSwitch(headSwitchWanted));
    // 7.9.9 프로필 여러 개: 켜져 있고 등록한 캐릭터가 있을 때만 모듈을 받는다 (이벤트 · 훑기 없음). 캐릭터 편집 화면의 단추는 등록이 없어도 보여야 하니 여기서 바로 붙인다
    const multi = on && s.multiAvatar?.on !== false && Object.keys(s.multiAvatar?.chars || {}).length > 0;
    if (multi || modules.multiavatar) load('multiavatar', './multi-avatar/index.js').then(m => m?.syncMultiAvatar(multi, s.multiAvatar));
    syncMultiAvatarButton(on && s.multiAvatar?.on !== false);
}
function syncMultiAvatarButton(show) {
    const existing = document.getElementById('bl-mav-button');
    if (!show) { existing?.remove(); return; }
    if (existing) return;
    const row = document.querySelector('#avatar_controls .form_create_bottom_buttons_block');
    const anchor = row?.querySelector('#advanced_div');
    if (!row || !anchor) return;
    const button = document.createElement('div');
    button.id = 'bl-mav-button'; button.className = 'menu_button fa-solid fa-images'; button.title = '프로필 여러 개 — 아바타 사진을 여러 장 등록하고 채팅방을 열 때마다 바꿔요'; button.setAttribute('role', 'button'); button.tabIndex = 0; button.setAttribute('aria-label', '프로필 여러 개');
    const open = () => load('multiavatarDialog', './multi-avatar/dialog.js').then(m => m?.openForCurrent());
    button.addEventListener('click', open);
    button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    anchor.after(button);
}

/** 설정 창이 캐릭터 연결을 바꾼 뒤: 모듈을 불러와 지금 채팅에 맞춤 */
export async function charStyleModule() {
    const m = await load('charstyle', './charstyle.js');
    m?.startCharStyles(hooks.applyAll, hooks.refreshPanels);
    return m;
}

/** 6.0.4 단어 치환 › 잠시 가리기 모듈 — 설정 창이 스위치를 켤 때 처음 불러온다 (wordmask.js) */
export function wordMaskModule() {
    return load('wordmask', './wordmask.js');
}

/** 시험용: 불러온 모듈 */
export function featureModule(name) {
    return modules[name] ?? null;
}
