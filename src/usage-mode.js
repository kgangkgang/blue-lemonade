export const themeEnabled = s => s.enabled !== false && s.usageMode !== 'extensions';
// 1.0.2 블루레몬에이드 제로(usageMode 'zero'): 테마 모양(CSS · 색 · 글꼴 · 말풍선)만 — 내장 도구 · 애드온 · 감시자 모듈은 받지도 않아요(시험 tools/tests/zero-mode.mjs)
export const addonsEnabled = s => s.enabled !== false && s.usageMode !== 'theme' && s.usageMode !== 'zero';
export const zeroMode = s => !!s && s.enabled !== false && s.usageMode === 'zero';
// 제로에서도 받는 모양 모듈 — features.js load 이름 · apply.js lateSync 이름. 여기 없는 이름은 제로에서 받지 않아요
export const ZERO_LOOK = new Set(['appearance', 'auto', 'charstyle', 'splash', 'splashFonts', 'themeSheet', 'favicon', 'roleIcons', 'picks', 'extensionColors', 'tagInk']);
export const zeroSkips = (s, name) => zeroMode(s) && !ZERO_LOOK.has(name);
// 제로 화면: 저장값은 그대로 두고 그리는 값에서만 JS 가 그리는 기능(데우스 카드 · 날씨 · 접기 · 페이드 …)을 끈 것으로 봐요
export function zeroView(s) {
    if (!zeroMode(s)) return s;
    const off = (o, key = 'on') => ({ ...(o || {}), [key]: false });
    return { ...s, deus: off(s.deus), reader: off(s.reader, 'autoHide'), onehand: off(s.onehand), sceneSound: off(s.sceneSound), replyNotify: off(s.replyNotify), bgWindow: off(s.bgWindow), multiAvatar: off(s.multiAvatar), logCopy: off(s.logCopy), searchAi: off(s.searchAi), fruitTypography: off(s.fruitTypography),
        chat: { ...(s.chat || {}), weather: 'off', demSkin: false, triangleFold: false, streamFade: false, toneInline: false, mesPins: [] } };
}
// 처리기마다 저장값을 읽어요(끄면 새로고침 전에도 멈춤)
export const addonRunning = (s, id) => !s || (addonsEnabled(s) && s.addons?.[id] !== false);
export const switchNeedsReload = (s, running, ids) => ids.some(id => running.has(id) !== (addonsEnabled(s) && !!s.addons?.[id]));
export const USAGE_MODES = ['both', 'theme', 'extensions', 'zero'];
export const usageMode = s => USAGE_MODES.includes(s.usageMode) ? s.usageMode : 'both';
// 7.7.4 볼록 단추 표식(7.8.6 볼록 두께는 걷어냄 — 지금은 css/90-press.css · 91-switch-knob · 전개 지시 끌기 그림자가 이 표식을 씀): 테마가 켜져 있으면(확장만 모드 포함) <html data-bl-puffy> 의 값 light | dark — 두께 색을 고르는 데만 쓴다.
//   테마를 끄면 null(속성 없음 = 규칙 0). 시험 tools/tests/press-flat.mjs. 예전에 저장된 puffyButtons 값은 읽지 않는다
export const puffyMode = (s, mode) => s.enabled !== false ? (mode === 'dark' ? 'dark' : 'light') : null;

// 7.2.4 바깥 확장(window.Salty.getSettings)이 읽는 설정 보기 — enabled 는 「테마가 화면에 켜져 있나」(사용 모드까지).
// quiet-notes(일코 모드)는 enabled 만 보고 일코를 끌 때 body.salty 를 되돌리는데, 확장만 모드는 enabled=true 라
// 테마 변수 없이 테마 규칙만 걸려 채팅 · 서랍 배경이 사라졌다. 다른 칸은 원본 그대로(고치면 원본에 적힌다).
export function publicSettings(s) {
    if (themeEnabled(s) || s.enabled === false) return s;
    return new Proxy(s, { get: (target, key, receiver) => key === 'enabled' ? false : Reflect.get(target, key, receiver) });
}

// Only owned checkbox colors are exposed outside the theme; host controls never use these names.
export function checkboxTokens(vars, enabled) {
    if (!enabled) return {};
    // 7.7.9 체크박스 A3 는 선(line) · 포인트 면(accent) · 꺽쇠(ink) 세 색만 쓴다 (면 · 그림자 · 비활성 면 없음)
    return Object.fromEntries([
        ['line', 'line'], ['accent', 'accent'], ['ink', 'on-accent'],
    ].map(([name, source]) => [`--bl-checkbox-${name}`, vars[`--salty-${source}`]]));
}
