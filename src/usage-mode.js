export const themeEnabled = s => s.enabled !== false && s.usageMode !== 'extensions';
export const addonsEnabled = s => s.enabled !== false && s.usageMode !== 'theme';
export const usageMode = s => ['both','theme','extensions'].includes(s.usageMode) ? s.usageMode : 'both';
// 7.7.4 볼록 단추(css/90-puffy.css, 기본 모양 · 스위치 없음): 테마가 켜져 있으면(확장만 모드 포함) <html data-bl-puffy> 의 값 light | dark — 두께 색을 고르는 데만 쓴다.
//   테마를 끄면 null(속성 없음 = 규칙 0). 되돌리기는 css/90-puffy.css 를 지우고 build-css (tools/tests/puffy-rollback.mjs). 예전에 저장된 puffyButtons 값은 읽지 않는다
export const puffyMode = (s, mode) => s.enabled !== false ? (mode === 'dark' ? 'dark' : 'light') : null;

// 7.2.4 바깥 확장(window.Salty.getSettings)이 읽는 설정 보기 — enabled 는 「테마가 화면에 켜져 있나」(사용 모드까지).
// quiet-notes(일코 모드)는 enabled 만 보고 일코를 끌 때 body.salty 를 되돌리는데, 확장만 모드는 enabled=true 라
// 테마 변수 없이 테마 규칙만 걸려 채팅 · 서랍 배경이 사라졌다. 다른 칸은 원본 그대로(고치면 원본에 적힌다).
export function publicSettings(s) {
    if (themeEnabled(s) || s.enabled === false) return s;
    return new Proxy(s, { get: (target, key, receiver) => key === 'enabled' ? false : Reflect.get(target, key, receiver) });
}

// 7.2.4 테마가 빠진 모드(확장만 · 테마 끔)에서 바깥이 body.salty 를 붙이면 뗀다 — 떼기만 한다 (일코 ON 처럼 테마를 잠시 끄려고 떼는 건 그대로).
// 서로 붙였다 뗐다 하면(2초 안 6번) 멈추고 한 번 알린다 — 끝없이 싸우며 화면을 다시 그리지 않게. classList 만 받아 시험할 수 있다.
export function forcedThemeGuard({ themeOn, now = () => Date.now(), warn = () => {} }) {
    const hits = [];
    let stopped = false;
    return classList => {
        if (stopped || themeOn() || !classList.contains('salty')) return false;
        const t = now();
        while (hits.length && t - hits[0] > 2000) hits.shift();
        hits.push(t);
        if (hits.length > 6) { stopped = true; warn('다른 확장이 테마 클래스(body.salty)를 계속 붙여요. 이번 세션은 그대로 둡니다.'); return false; }
        classList.remove('salty');
        return true;
    };
}

// Only owned checkbox colors are exposed outside the theme; host controls never use these names.
export function checkboxTokens(vars, enabled) {
    if (!enabled) return {};
    // 7.7.9 체크박스 A3 는 선(line) · 포인트 면(accent) · 꺽쇠(ink) 세 색만 쓴다 (면 · 그림자 · 비활성 면 없음)
    return Object.fromEntries([
        ['line', 'line'], ['accent', 'accent'], ['ink', 'on-accent'],
    ].map(([name, source]) => [`--bl-checkbox-${name}`, vars[`--salty-${source}`]]));
}
