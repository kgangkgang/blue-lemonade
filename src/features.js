import { syncTypography } from './typography.js';
// 켜야 쓰는 기능 (3.1.0): 몰입 읽기 · 한 손 버튼 줄 · 데우스 카드 스킨 · 캐릭터별 스타일 · (3.2.0) 화이트/나이트 자동의 코드는 켤 때 처음 불러온다.
// 꺼 두면 파일도 받지 않고 이벤트도 걸지 않는다 — 테마가 무거워지지 않게. 한 번 불러온 뒤 끄면 그 모듈이 스스로 정리한다.
import { syncSplash } from './splash.js';

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
let scriptsWanted=false,scriptRetry=0,scriptHeal=[];
function startScripts(tries=4){
    clearTimeout(scriptRetry);
    load('scripts','./scripts/runtime.js').then((m)=>{
        if(m){
            // 시작 직후에는 설정 적용이 여러 번 겹친다 — 끝난 뒤에도 켜 둔 스크립트가 멈춰 있으면 다시 시작한다 (5초 · 15초 · 40초 뒤 확인)
            clearTimeout(scriptHeal[0]);clearTimeout(scriptHeal[1]);clearTimeout(scriptHeal[2]);
            scriptHeal=[5000,15000,40000].map(ms=>setTimeout(()=>m.healScripts(scriptsWanted),ms));
            return m.syncScripts(scriptsWanted);
        }
        if(tries>0)scriptRetry=setTimeout(()=>startScripts(tries-1),2500);
    }).catch(error=>console.error('[Blue Lemonade] 스크립트를 시작하지 못했어요',error));
}

/** apply.js applyAll 끝에서 부른다 */
export function syncFeatures(s) {
    const on = !!s.enabled;
    syncTypography(on);
    const scriptsRequested=Object.values(SillyTavern.getContext().extensionSettings?.blue_lemonade_scripts?.enabled||{}).some(v=>v===true);
    // The editor can start the runtime before this module has imported it.
    scriptsWanted=on&&scriptsRequested;
    if(scriptsRequested||modules.scripts)startScripts();
    const reader = on && !!s.reader?.autoHide;
    if (reader || modules.reader) load('reader', './reader.js').then(m => m?.syncReader(reader));
    const onehand = on && !!s.onehand?.on;
    if (onehand || modules.onehand) load('onehand', './onehand.js').then(m => m?.syncOneHand(onehand, s.onehand));
    const auto = on && !!s.auto?.on;
    if (auto || modules.auto) load('auto', './automode.js').then(m => m?.syncAutoMode(auto, hooks));
    // 3.3.0 날씨 효과 (weather.js — 그리기는 워커)
    // 트래커 따라는 데우스 호환이 켜졌을 때만 (3.4.0)
    const weatherChat = s.chat?.weather === 'tracker' && !s.deus?.on ? { ...s.chat, weather: 'off' } : s.chat;
    const weather = on && !!weatherChat?.weather && weatherChat.weather !== 'off';
    if (weather || modules.weather) load('weather', './weather.js').then(m => m?.syncWeather(weather, weatherChat));
    // 4.1.3 ··· 메뉴 버튼 고정 (mes-pins.js)
    const pins = on && (s.chat?.mesPins?.length || 0) > 0;
    if (pins || modules.mespins) load('mespins', './mes-pins.js').then(m => m?.syncMesPins(pins, s.chat.mesPins));
    // 데우스 감정 대사: 프리셋 정규식이 못 받는 「…」 대사를 화면에서 감싼다 (dem-expressive.js)
    const demfx = on && !!s.deus?.on && !!s.deus?.fx?.on;
    if (demfx || modules.demfx) load('demfx', './dem-expressive.js').then(m => m?.syncDemExpressive(demfx));
    const dem = on && !!s.deus?.on && !!s.chat?.demSkin;
    if (dem || modules.dem) load('dem', './demskin.js').then(m => m?.syncDemSkin(dem, s.chat));
    // 3.5.1 새로고침 첫 화면 파일 (user.css 에 줄이 있을 때만 씀 — splash.js)
    syncSplash(s, () => hooks.refreshPanels?.());
    // 캐릭터별 스타일: 이어 둔 캐릭터가 있을 때만. 입혀 둔 동안 바꾼 모습은 그 스타일에 적음
    const chars = Object.keys(s.charStyles || {}).length > 0 || !!s.activeStyle;
    if (chars || modules.charstyle) {
        load('charstyle', './charstyle.js').then((m) => {
            if (!m) return;
            m.startCharStyles(hooks.applyAll, hooks.refreshPanels);
            if (s.activeStyle) m.noteChange();
        });
    }
}

/** 설정 창이 캐릭터 연결을 바꾼 뒤: 모듈을 불러와 지금 채팅에 맞춤 */
export async function charStyleModule() {
    const m = await load('charstyle', './charstyle.js');
    m?.startCharStyles(hooks.applyAll, hooks.refreshPanels);
    return m;
}

/** 시험용: 불러온 모듈 */
export function featureModule(name) {
    return modules[name] ?? null;
}
