// 심플 액자 움직임 — 「액자 움직임」을 켠 액자가 있을 때만 받아요(src/decor-view.js 가 동적으로 불러요 · 끄면 이 파일도 규칙도 0).
// 가볍게가 첫째 조건이에요:
//   · 액자 그림(PNG)은 그대로 두고 그 위에 가상 요소(액자 ::before · 사진 칸 ::before / ::after)만 얹어요 — DOM 을 더하지 않아 감시자(변화 감시 허브)가 불리지 않아요
//   · 움직이는 값은 transform · opacity 뿐(레이아웃 · 필터 · 그림자 값은 안 바뀌어요) — 합성 단계에서만 돌아요
//   · 화면에 보이는 액자만, 한 번에 LIVE_MAX 개까지 돌아요(교차 관찰 하나 · data-bl-live 표식). 그 밖의 액자에는 움직임 조각 자체가 없어요
//   · 답을 받는 동안(body[data-generating])은 쉬고, 움직임 줄이기(prefers-reduced-motion)면 돌지 않아요
//   · 이 파일은 아무것도 import 하지 않아요(미리보기 · 측정 페이지가 그대로 써요)

// 세기 · 빠르기는 여기 한곳 — 나중에 약(.6) · 중(1) · 강(1.4) 을 붙일 때 이 값만 바꿔요
export const FRAME_MOTION_TUNE = { amount: 1, speed: 1 };
export const LIVE_MAX = 6;   // 한 화면에서 같이 도는 액자 수 상한
const LIVE = 'data-bl-live', MOTION = 'data-bl-motion';
const sec = n => `${Math.round(n / FRAME_MOTION_TUNE.speed * 100) / 100}s`;
const amt = (n, max = 1) => Math.round(Math.min(max, n * FRAME_MOTION_TUNE.amount) * 1000) / 1000;
const mix = (hex, percent) => `color-mix(in srgb, ${hex} ${percent}%, transparent)`;

// 틀마다의 움직임: [이름(설정 · 문서에 보이는 말), g => CSS]. 표에 없는 틀은 「없음」이에요.
// g: S(이 액자) · L(지금 도는 액자 = S[data-bl-live]) · P(L 의 사진 칸) · X · Y(액자 그림 좌표 px → %) · w · h · c1(바탕색) · c2(포인트색)
const pseudo = `content:'';position:absolute;pointer-events:none;`;
// 레코드 판 SVG(data 주소): r = 판 반지름(액자 그림 px) · accent = 포인트색. 보기 상자는 200 × 200(반지름 100)
function discSvg(r, accent) {
    const u = 100 / r, n = v => Math.round(v * 100) / 100, at = (deg, d) => `${n(100 + Math.sin(deg * Math.PI / 180) * d)},${n(100 - Math.cos(deg * Math.PI / 180) * d)}`;
    const wedge = (from, wide, opacity) => `<path d="M100,100L${at(from, 99)}A99,99 0 0 1 ${at(from + wide, 99)}Z" fill="#fff" fill-opacity="${opacity}"/>`;
    const grooves = [5, 9, 17, 21, 27, 33, 41].map(d => `<circle cx="100" cy="100" r="${n(100 - d * u)}"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">`
        + `<circle cx="100" cy="100" r="99.4" fill="#1b1d23" stroke="#fff" stroke-opacity=".25" stroke-width="${n(u)}"/>`
        + `<g fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="${n(u)}">${grooves}</g>`
        + wedge(0, 13, .3) + wedge(90, 9, .15) + wedge(180, 13, .3) + wedge(270, 9, .15)   // 빛 쐐기 넷 — 도는 것이 보여요
        + `<circle cx="100" cy="100" r="${n(100 - 13 * u)}" fill="none" stroke="${accent}" stroke-width="${n(2 * u)}"/>`
        + `<circle cx="100" cy="100" r="${n(Math.min(38, 100 - 50 * u))}" fill="${accent}"/><circle cx="100" cy="${n(100 - Math.min(38, 100 - 50 * u) * .6)}" r="3" fill="#fff" fill-opacity=".85"/><circle cx="100" cy="100" r="3.4" fill="#0b0c0f"/>`
        // 가장자리 구슬 넷: 포인트색 둘 · 흰 점 둘
        + `<circle cx="${at(0, 100 - 5 * u).split(',')[0]}" cy="${at(0, 100 - 5 * u).split(',')[1]}" r="${n(3.4 * u)}" fill="${accent}"/><circle cx="${at(180, 100 - 5 * u).split(',')[0]}" cy="${at(180, 100 - 5 * u).split(',')[1]}" r="${n(3.4 * u)}" fill="${accent}"/>`
        + `<circle cx="${at(90, 100 - 5 * u).split(',')[0]}" cy="${at(90, 100 - 5 * u).split(',')[1]}" r="${n(2.2 * u)}" fill="#fff" fill-opacity=".8"/><circle cx="${at(270, 100 - 5 * u).split(',')[0]}" cy="${at(270, 100 - 5 * u).split(',')[1]}" r="${n(2.2 * u)}" fill="#fff" fill-opacity=".8"/></svg>`;
    return 'data:image/svg+xml,' + svg.replace(/#/g, '%23').replace(/"/g, "'").replace(/</g, '%3C').replace(/>/g, '%3E');
}
export const FRAME_MOTIONS = {
    window: ['유리에 비친 빛이 천천히 지나가요', g => `${g.P}::after{${pseudo}top:-20%;bottom:-20%;left:0;width:22%;background:linear-gradient(90deg,transparent,${mix(g.c1, 26)} 50%,transparent);transform:translateX(-150%) skewX(-18deg);animation:bl-fm-sweep ${sec(9)} ease-in-out infinite}`],
    film: ['필름 빛샘이 은은하게 번져요', g => `${g.P}::after{${pseudo}inset:0;background:radial-gradient(60% 45% at 100% 30%,#ffb45a73,transparent 70%);opacity:0;animation:bl-fm-leak ${sec(8)} ease-in-out infinite}`],
    sf: ['주사선 한 줄이 위에서 아래로 훑어요', g => `${g.P}::after{${pseudo}inset:0;border-top:2px solid ${g.c2};background:linear-gradient(${mix(g.c2, 22)},transparent 12%);opacity:0;animation:bl-fm-scan ${sec(6)} linear infinite}`],
    rec: ['빨간 녹화 점이 느리게 깜빡여요', g => `${g.L}::before{${pseudo}z-index:2;left:${g.X(52)};top:${g.Y(26)};width:${g.X(12)};height:${g.Y(12)};border-radius:50%;background:${g.c1};opacity:0;animation:bl-fm-blink ${sec(2.6)} ease-in-out infinite}`],
    neon: ['네온 빛이 숨 쉬듯 밝아졌다 잦아들어요', g => `${g.L}::before{${pseudo}z-index:2;inset:${g.Y(12)} ${g.X(12)};border-radius:${g.X(14)}/${g.Y(14)};border:1.5px solid ${g.c2};box-shadow:0 0 12px ${g.c2},inset 0 0 10px ${g.c2};opacity:0;animation:bl-fm-glow ${sec(3.6)} ease-in-out infinite alternate}`],
    gallery: ['위에서 비추는 조명이 은은하게 밝아져요', g => `${g.P}::after{${pseudo}inset:0;background:radial-gradient(90% 62% at 50% 0,#fff3cf8c,transparent 70%);opacity:0;animation:bl-fm-glow ${sec(5)} ease-in-out infinite alternate}`],
    peg: ['줄에 걸린 사진이 살짝 흔들려요', g => `${g.L}{transform-origin:50% ${g.Y(20)};animation:bl-fm-sway ${sec(5)} ease-in-out infinite alternate}`],
    phone: ['위쪽 섬의 초록 불이 깜빡여요', g => { const island = Math.min(70, g.w * .2); return `${g.L}::before{${pseudo}z-index:2;left:${g.X((g.w + island) / 2 - 13)};top:${g.Y(34)};width:${g.X(5)};height:${g.Y(5)};border-radius:50%;background:#46e07a;animation:bl-fm-pulse ${sec(2.8)} ease-in-out infinite alternate}`; }],
    petal: ['꽃잎 두 장이 사진 위로 떨어져요', g => `${g.P}::before,${g.P}::after{${pseudo}inset:0;opacity:0;background:radial-gradient(ellipse at center,${g.c1} 0 50%,transparent 64%) no-repeat 72% 0/${g.X(15)} ${g.Y(10)};animation:bl-fm-fall ${sec(7.5)} linear infinite}`
        + `${g.P}::after{background:radial-gradient(ellipse at center,${g.c2} 0 50%,transparent 64%) no-repeat 38% 0/${g.X(11)} ${g.Y(8)};animation-duration:${sec(10)};animation-delay:-${sec(4)}}`],
    tarot: ['위쪽 별이 반짝여요', g => `${g.L}::before{${pseudo}z-index:2;left:calc(50% - ${g.X(14)});top:${g.Y(7)};width:${g.X(28)};height:${g.Y(28)};border-radius:50%;background:radial-gradient(circle,${g.c2} 0,${mix(g.c2, 35)} 30%,transparent 66%);opacity:0;animation:bl-fm-twinkle ${sec(3.2)} ease-in-out infinite}`],
    // 레코드 판은 액자 그림에서 떼어(frame-presets.js LIFTED) 여기서 그려요 — 안 도는 액자에도 판은 그대로 보이고, 도는 액자만 한 바퀴 3.6초로 돌아요.
    // 판은 SVG 한 장(벡터)이에요: 색 멈춤이 딱 끊기는 그라데이션으로 그리면 둘레 · 홈 줄이 계단져 보여서, 원 · 선은 전부 SVG 가 매끈하게 그려요
    vinyl: ['재킷 뒤 레코드 판이 돌아요', g => {
        const r = Math.max(30, Math.min((g.h - 44) / 2, (g.w - 60) / 2)), x = g.w - 14 - r, y = g.h / 2;
        return `${g.S}::before{${pseudo}left:${g.X(x - r)};top:${g.Y(y - r)};width:${g.X(r * 2)};height:${g.Y(r * 2)};border-radius:50%;background:url("${discSvg(r, g.c2)}") center/100% 100% no-repeat}`
            + `${g.L}::before{animation:bl-fm-spin ${sec(3.6)} linear infinite}`;
    }],
};
export const motionLabel = id => FRAME_MOTIONS[id]?.[0] || '';

const A = n => amt(n);
const keyframes = () => `@keyframes bl-fm-sweep{0%,55%{transform:translateX(-150%) skewX(-18deg)}100%{transform:translateX(600%) skewX(-18deg)}}`
    + `@keyframes bl-fm-leak{0%,100%{opacity:0;transform:translateY(-10%)}50%{opacity:${A(.85)};transform:translateY(10%)}}`
    + `@keyframes bl-fm-scan{0%{transform:translateY(0);opacity:0}8%,90%{opacity:${A(.55)}}100%{transform:translateY(100%);opacity:0}}`
    + `@keyframes bl-fm-blink{0%,40%{opacity:0}58%,86%{opacity:${A(.8)}}100%{opacity:0}}`
    + `@keyframes bl-fm-glow{from{opacity:0}to{opacity:${A(.6)}}}`
    + `@keyframes bl-fm-pulse{from{opacity:.2}to{opacity:1}}`
    + `@keyframes bl-fm-sway{from{transform:rotate(${amt(-.7, 2)}deg)}to{transform:rotate(${amt(.7, 2)}deg)}}`
    + `@keyframes bl-fm-fall{0%{transform:translate(4%,-6%);opacity:0}10%,86%{opacity:${A(.9)}}50%{transform:translate(-9%,48%)}100%{transform:translate(-4%,104%);opacity:0}}`
    + `@keyframes bl-fm-twinkle{0%,100%{opacity:0;transform:scale(.6)}50%{opacity:${A(.75)};transform:scale(1.15)}}`
    + `@keyframes bl-fm-spin{to{transform:rotate(360deg)}}`;
const PARTS = sel => `${sel},${sel}::before,${sel}>.bl-art-photo::before,${sel}>.bl-art-photo::after`;
const guards = () => `body[data-generating] ${PARTS(`.bl-art-frame[${LIVE}]`).split(',').join(`,body[data-generating] `)}{animation-play-state:paused!important}`
    + `@media (prefers-reduced-motion:reduce){${PARTS(`.bl-art-frame[${LIVE}]`)}{animation:none!important}}`;

/** 한 주인(image · profile · userProfile)의 움직임 CSS. decor: 그 주인의 액자 값 · id: 움직임 이름('' 이면 빈 글) */
export function motionCss(kind, id, decor) {
    const draw = FRAME_MOTIONS[id]?.[1];
    if (!draw) return '';
    const w = Math.round(360 * (decor.frameWidth || 100) / 100), h = Math.round(480 * (decor.frameHeight || 100) / 100);
    const pct = v => `${Math.round(v * 100000) / 1000}%`;
    const S = `.bl-art-frame[data-bl-frame="${kind}"][${MOTION}="${id}"]`, L = `${S}[${LIVE}]`;
    const hex = (value, fallback) => /^#[a-f\d]{6}$/i.test(value) ? value : fallback;
    return draw({ S, L, P: `${L}>.bl-art-photo`, w, h, X: v => pct(v / w), Y: v => pct(v / h), c1: hex(decor.presetColor, '#888888'), c2: hex(decor.presetAccent, '#cccccc') });
}

/** 움직임 시트 한 장: list = [[주인, 움직임 이름, 액자 값], …] — 비면 빈 글(규칙 0) */
export function motionSheet(list) {
    const css = list.map(([kind, id, decor]) => motionCss(kind, id, decor)).join('');
    return css ? keyframes() + guards() + css : '';
}

let style = null, io = null, written = '';
const ids = { image: '', profile: '', userProfile: '' };
const hosts = new Map();   // 액자 요소 → 주인
const seen = new Set(), live = new Set();
function rebalance() {
    for (const host of live) if (!seen.has(host) || !host.isConnected) { live.delete(host); host.removeAttribute(LIVE); }
    for (const host of seen) {
        if (live.size >= LIVE_MAX) break;
        if (!live.has(host) && host.isConnected) { live.add(host); host.setAttribute(LIVE, ''); }
    }
}
function onSight(entries, observer) {
    if (observer !== io) return;
    for (const entry of entries) { if (entry.isIntersecting && entry.target.isConnected) seen.add(entry.target); else seen.delete(entry.target); }
    rebalance();
}
function mark(host, kind) {
    const id = ids[kind];
    if (id) {
        if (host.getAttribute(MOTION) !== id) host.setAttribute(MOTION, id);
        io?.observe(host);
    } else {
        host.removeAttribute(MOTION); host.removeAttribute(LIVE); io?.unobserve(host); seen.delete(host); live.delete(host);
    }
}
/** 새로 감싼 액자를 알려요(decor-view.js wrap) */
export function noteFrame(host, kind) { hosts.set(host, kind); mark(host, kind); }
/** 액자를 풀 때(decor-view.js undo) */
export function dropFrame(host) {
    hosts.delete(host); io?.unobserve(host); seen.delete(host);
    if (live.delete(host)) rebalance();
    host.removeAttribute(MOTION); host.removeAttribute(LIVE);
}
/** 설정이 바뀔 때마다: next = { image, profile, userProfile } 움직임 이름('' = 없음) · decors = 같은 열쇠의 액자 값 */
export function syncFrameMotion(next, decors) {
    for (const kind of Object.keys(ids)) ids[kind] = FRAME_MOTIONS[next?.[kind]] ? next[kind] : '';
    const css = motionSheet(Object.keys(ids).filter(kind => ids[kind]).map(kind => [kind, ids[kind], decors[kind]]));
    if (css !== written) {
        if (css && !style) { style = document.createElement('style'); style.id = 'bl-frame-motion'; document.head.append(style); }
        if (style) style.textContent = css;
        written = css;
    }
    if (css && !io && typeof IntersectionObserver === 'function') io = new IntersectionObserver(onSight);
    for (const [host, kind] of hosts) { if (host.isConnected) mark(host, kind); else dropFrame(host); }
    // 교차 관찰을 못 쓰는 곳에서는 앞에서부터 상한까지만 돌려요
    if (css && !io) { for (const [host, kind] of hosts) if (ids[kind]) seen.add(host); rebalance(); }
    if (!css && io) { io.disconnect(); io = null; seen.clear(); live.clear(); }
}
