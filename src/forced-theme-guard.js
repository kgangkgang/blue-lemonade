// 1.0.0 사용 모드 되살림: usage-mode.js 에서 떼어 냈어요 — 테마 끔 보정(theme-off.js)만 쓰니 시작 그래프 밖이에요.
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
