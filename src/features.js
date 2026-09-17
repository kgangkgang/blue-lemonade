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

/** apply.js applyAll 끝에서 부른다 */
export function syncFeatures(s) {
    const on = !!s.enabled;
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
