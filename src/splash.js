// 새로고침 첫 화면 (3.5.1 · 3.5.2 글꼴) — 실리태번 뇌 로고가 테마보다 먼저 뜨던 것 (사용자: "뇌 → 레몬 → 첫 화면, 뇌 안 보고 싶음").
// 확장은 실리태번이 설정을 읽은 뒤에야 불리므로 그 전의 스플래시를 JS 로는 못 바꾼다. 실리태번 index.html 이 <head> 에서
// 불러오는 /css/user.css (= data/_css/user.css) 만 그보다 먼저다. 확장은 그 파일을 쓸 수 없으니, 사용자가 한 번만 맨 위에
//   @import url("/user/files/blue-lemonade-splash.css");
// 를 넣으면 테마가 data/<사용자>/user/files/blue-lemonade-splash.css 를 지금 팔레트 색으로 써 둔다 (/api/files/upload).
// 규칙은 #preloader · 스플래시 팝업에만 걸려 로딩이 끝나면 아무것도 안 남는다 (09 의 surfaces:loader 와 같은 모양).
// 테마를 끄면 빈 파일로 → 실리태번 기본 화면. user.css 에 줄이 없으면 파일을 만들지 않는다.
export const SPLASH_FILE = 'blue-lemonade-splash.css';
export const SPLASH_IMPORT = `@import url("/user/files/${SPLASH_FILE}");`;
export const SPLASH_COMMAND = `f=~/SillyTavern/data/_css/user.css; mkdir -p "\${f%/*}" && touch "$f" && (grep -q ${SPLASH_FILE} "$f" || { printf '%s\\n' '${SPLASH_IMPORT}' | cat - "$f" > "$f.tmp" && mv "$f.tmp" "$f"; }) && echo OK`;

const LEMON_PATH = 'M448 352Q447 379 429 397Q411 415 384 416Q374 416 365 413Q348 407 330 404Q311 400 294 404Q237 418 180 399Q124 379 80 336Q37 292 17 236Q-2 179 12 122Q16 105 12 86Q9 68 3 51Q0 42 0 32Q1 5 19 -13Q37 -31 64 -32Q74 -32 83 -29Q100 -23 118 -20Q137 -16 154 -20Q211 -34 268 -15Q324 5 368 48Q411 92 431 148Q450 205 436 262Q432 279 436 298Q439 316 445 333Q448 342 448 352ZM213 321Q171 308 139 277Q108 245 95 203Q90 190 76 193Q62 198 65 212Q80 262 117 299Q154 336 204 351Q218 354 223 340Q226 326 213 321Z';

// 5.5.0: 테마를 켜면 브라우저 탭 아이콘도 레몬 (사용자: "실리태번 아이콘도 레몬으로 … 전체패치로"). 테마를 끄거나 '확장만' 모드면
// 원래 실리태번 아이콘으로 돌린다. 실리태번 index.html 의 <link rel="icon"> 하나만 바꾼다 — 홈 화면(manifest) · apple-touch-icon 은 그대로.
// 폰 크롬까지 보이게 SVG 대신 캔버스로 그린 64px PNG (못 그리면 SVG). 색은 홈페이지 레몬(#FFE23C) + 밝은 탭에서도 보이게 진한 테두리.
let faviconSaved = null, faviconUrl = '';
function lemonFavicon() {
    if (faviconUrl) return faviconUrl;
    try {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d'), p = new Path2D(LEMON_PATH);
        g.scale(64 / 472, 64 / 472); g.translate(12, -20); g.translate(0, 448); g.scale(1, -1);
        g.fillStyle = '#FFE23C'; g.fill(p, 'evenodd');
        g.lineWidth = 18; g.lineJoin = 'round'; g.strokeStyle = '#E9BE00'; g.stroke(p);
        faviconUrl = c.toDataURL('image/png');
    } catch {
        faviconUrl = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-12 20 472 472'><path fill='#FFE23C' fill-rule='evenodd' stroke='#E9BE00' stroke-width='18' stroke-linejoin='round' transform='translate(0 448) scale(1 -1)' d='${LEMON_PATH}'/></svg>`);
    }
    return faviconUrl;
}
export function syncFavicon(on) {
    const link = faviconSaved?.link || document.querySelector('link[rel~="icon"]');
    if (!link) return;
    if (on) {
        if (!faviconSaved) faviconSaved = { link, href: link.getAttribute('href'), type: link.getAttribute('type') };
        const url = lemonFavicon();
        if (link.getAttribute('href') !== url) { link.setAttribute('type', url.startsWith('data:image/png') ? 'image/png' : 'image/svg+xml'); link.setAttribute('href', url); }
    } else if (faviconSaved) {
        const { href, type } = faviconSaved; faviconSaved = null;
        if (type == null) link.removeAttribute('type'); else link.setAttribute('type', type);
        if (href == null) link.removeAttribute('href'); else link.setAttribute('href', href);
    }
}

// 5.5.1: 탭 아이콘 파일 자체도 레몬으로 (사용자: "새로고침 화면처럼 바로 할 수 있게"). 위의 링크 교체는 실리태번이 확장을 부를 때까지
// (PC 약 3.7초 · 폰 10초 남짓) ST 로고가 먼저 보인다. 확장은 public/ 에 쓸 수 없으니 새로고침 화면처럼 사용자 파일에 레몬 아이콘을
// 올려 두고, 한 번 실행하는 명령으로 public/favicon.ico 를 그 파일로 바꾼다. 되돌리기: git -C ~/SillyTavern checkout -- public/favicon.ico
export const FAVICON_FILE = 'blue-lemonade-favicon.ico';
const FAVICON_MARK = 'BLLEMON';   // 파일 끝 표식 — 기기마다 PNG 바이트가 달라도 '이미 레몬' 을 알아본다
let faviconFileNow = null, faviconChecking = null;
export function faviconFileState() { return faviconFileNow; }
const endsWithMark = (buf) => {
    const b = new Uint8Array(buf), m = new TextEncoder().encode(FAVICON_MARK);
    return b.length > m.length && m.every((x, i) => b[b.length - m.length + i] === x);
};
/** 실리태번 public/favicon.ico 가 이미 우리 레몬인지 (페이지마다 한 번) */
export function checkFaviconFile(onChange) {
    faviconChecking ??= fetch('/favicon.ico', { cache: 'no-store' })
        .then(res => (res.ok ? res.arrayBuffer() : null))
        .catch(() => null)
        .then((buf) => {
            const next = buf && endsWithMark(buf) ? 'on' : 'off';
            const changed = next !== faviconFileNow;
            faviconFileNow = next;
            if (changed) onChange?.();
            return faviconFileNow;
        });
    return faviconChecking;
}
// PNG 한 장을 담은 ICO (브라우저는 ICO 안의 PNG 를 읽는다) + 끝 표식
function lemonIcoBytes() {
    const url = lemonFavicon();
    if (!url.startsWith('data:image/png')) return null;
    const png = Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0));
    const mark = new TextEncoder().encode(FAVICON_MARK);
    const out = new Uint8Array(22 + png.length + mark.length), v = new DataView(out.buffer);
    v.setUint16(2, 1, true); v.setUint16(4, 1, true);                       // ICONDIR: 종류 1(아이콘) · 1개
    out[6] = 64; out[7] = 64; v.setUint16(10, 1, true); v.setUint16(12, 32, true);
    v.setUint32(14, png.length, true); v.setUint32(18, 22, true);           // 크기 · 자리
    out.set(png, 22); out.set(mark, 22 + png.length);
    return out;
}
/** 명령 복사 전에: 사용자 파일에 레몬 아이콘을 올리고, 한 번 실행할 명령을 돌려준다 */
export async function prepareFaviconCommand() {
    const bytes = lemonIcoBytes();
    if (!bytes) throw new Error('레몬 아이콘을 못 그림');
    let bin = '';
    for (const x of bytes) bin += String.fromCharCode(x);
    const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: SillyTavern.getContext().getRequestHeaders(),
        body: JSON.stringify({ name: FAVICON_FILE, data: btoa(bin) }),
    });
    if (!res.ok) throw new Error(`아이콘 파일을 못 올림 (${res.status})`);
    let handle = 'default-user';
    try { handle = (await import('/scripts/user.js')).getCurrentUserHandle() || handle; } catch { /* 옛 실리태번 */ }
    handle = String(handle).replace(/[^\w.-]/g, '');
    return {
        handle,
        command: `f=~/SillyTavern/data/${handle}/user/files/${FAVICON_FILE}; [ -f "$f" ] && cp "$f" ~/SillyTavern/public/favicon.ico && echo OK`,
    };
}

let state = null;   // null 모름 · 'on' 줄 있음 · 'late' 줄은 있는데 다른 규칙 뒤라 무시됨 · 'off' 없음
let checking = null;
let served = null;  // 서버에 있는 스플래시 파일 내용 (한 번 읽음)
let timer = 0, lateTimer = 0;

export function splashState() {
    return state;
}

/** user.css 에 @import 줄이 있는지 (페이지마다 한 번) */
export function checkSplash(onChange) {
    checking ??= fetch('/css/user.css', { cache: 'no-store' })
        .then(res => (res.ok ? res.text() : ''))
        .catch(() => '')
        .then((text) => {
            const plain = text.replace(/\/\*[\s\S]*?\*\//g, '');
            const at = plain.indexOf(`/user/files/${SPLASH_FILE}`);
            let next = 'off';
            if (at >= 0) {
                // @import 는 다른 규칙보다 앞에 있어야 먹힘 — 앞에 @charset · @import 말고 다른 것이 있으면 'late'
                const before = plain.slice(0, at).replace(/@(?:charset|import)[^;]*;/g, '').replace(/@import\s+url\(\s*["']?\s*$/, '').trim();
                next = before ? 'late' : 'on';
            }
            const changed = next !== state;
            state = next;
            if (changed) onChange?.();
            return state;
        });
    return checking;
}

const safeValue = (value, fallback) => (/^[#\w\s(),.%-]+$/.test(value) ? value : fallback);
const safeFont = value => value.replace(/[{}<>;\\]/g, '').trim() || 'sans-serif';
// 3.5.2 글꼴: 첫 화면 글(SillyTavern · 불러오는 중)이 대체 글꼴로 먼저 그려졌다가 테마가 글꼴을 걸면 바뀌었다 (사용자: "글꼴 바뀌는 게
// 조금 아쉬움"). 메뉴 글꼴(--salty-font-ui) 가족의 @font-face 중 그 글자들에 닿는 것만 (굵기는 브라우저가 쓰는 것만 받음) 파일에 같이 적고
// font-display: block — 첫 그림부터 글꼴 파일을 받기 시작하고, 한 번 받아 두면 캐시에서 바로 읽혀 바뀌는 순간이 없다
const SPLASH_TEXT = 'SillyTavern불러오는중';

function rangeCovers(range, codes) {
    const spans = range.split(',').map((part) => {
        const m = part.trim().match(/^U\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i);
        if (!m) return null;
        const lo = parseInt(m[1].replace(/\?/g, '0'), 16);
        const hi = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, 'f'), 16);
        return [lo, hi];
    }).filter(Boolean);
    return codes.some(c => spans.some(([lo, hi]) => c >= lo && c <= hi));
}

function splashFaces(stack) {
    const css = document.getElementById('salty-fontfaces')?.textContent || '';
    if (!css) return '';
    const families = new Set(stack.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, '').toLowerCase()).filter(Boolean));
    const codes = [...new Set([...SPLASH_TEXT])].map(c => c.codePointAt(0));
    const out = [];
    for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
        const body = m[1].trim();
        const family = /font-family:\s*([^;]+)/i.exec(body)?.[1].trim().replace(/^['"]|['"]$/g, '').toLowerCase();
        if (!family || !families.has(family)) continue;
        const range = /unicode-range:\s*([^;]+)/i.exec(body)?.[1];
        if (range && !rangeCovers(range, codes)) continue;
        out.push(`@font-face { ${body.replace(/font-display:\s*[\w-]+;?/i, '').replace(/;?\s*$/, ';')} font-display: block; }`);
    }
    return out.join('\n');
}

// 파일은 ASCII 로 (글자 인코딩 머리가 없어도 깨지지 않게) — CSS 이스케이프
const ascii = text => text.replace(/[^\x20-\x7e\n]/g, c => `\\${c.codePointAt(0).toString(16)} `);

function buildCss(s) {
    if (!s.enabled || !document.body.classList.contains('salty')) {
        return '/* blue-lemonade-splash: theme is off - SillyTavern default splash */\n';
    }
    const cs = getComputedStyle(document.body);
    const read = (name, fallback) => safeValue(cs.getPropertyValue(name).trim(), fallback);
    const dark = document.body.classList.contains('salty-dark');
    const bg = read('--salty-bg', dark ? '#071C2E' : '#F1F8FD');
    const text = read('--salty-text', dark ? '#E6EEF5' : '#222D3A');
    const muted = read('--salty-muted', dark ? '#9FB0C0' : '#5B6B7B');
    const pop = read('--bl-pop-ink', read('--bl-pop', dark ? '#FFE973' : '#428DF0')); // 톱니는 글자용 잉크 (밝은 테마에서 파스텔 pop 이 흰 바탕에 묻히지 않게)
    const font = safeFont(cs.getPropertyValue('--salty-font-ui'));
    const faces = splashFaces(font);
    // 로딩 칸의 글자 크기 · 줄 간격도 (톱니가 1.7em 이라 테마가 팝업 글자를 --bl-fs-body · 1.55 로 바꾸는 순간 커져 레몬 · 글이 3px 밀렸음)
    // 3.5.3 글자 크기는 px 로 박는다: 첫 화면 때는 실리태번 설정 전이라 --mainFontSize 가 기본값이라, 테마가 붙어 사용자 글자 크기로
    // 다시 재면 "SillyTavern" 이 커지고 레몬이 몇 px 밀려 한 번 깜빡였다 (사용자: "새로고침하면 글꼴 바뀜" — 녹화로 보니 크기 차이)
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;font-size:var(--mainFontSize, 15px)';
    document.body.append(probe);
    const main = parseFloat(getComputedStyle(probe).fontSize) || 15;
    probe.remove();
    const px = k => `${Math.round(main * k * 100) / 100}px`;
    const lemon = dark ? '#FFE973' : '#E9BE00';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'><path fill='${lemon}' transform='translate(0 448) scale(1 -1)' d='${LEMON_PATH}'/></svg>`;
    const logo = `data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23')}`;
    return ascii(`/* blue-lemonade-splash: Blue Lemonade rewrites this file when the palette changes - do not edit */
${faces}
/* 실리태번 코어 style.css:140 의 전체 선택자가 text-shadow: 0 0 calc(var(--shadowWidth)*1px) var(--SmartThemeShadowColor) 를
   :root 기본값(2px · rgba(0,0,0,0.5))으로 첫 프레임부터 .splash-message 에 걸리고, text-shadow 는 상속이라
   ::before · ::after 글자에도 검은 안개가 얹힌다 (실측: 0~1517ms 동안 rgba(0,0,0,0.5) 0 0 2px, 그 뒤 none).
   테마의 body.salty 쪽 끄기 규칙은 그때 body 에 salty 가 아직 없어서 못 막는다 — 여기서 꺼야 한다.
   #loader.splash-screen 은 부팅 스플래시에만 붙는 클래스라 일반 팝업 · 액션 로더에는 닿지 않는다. */
#loader.splash-screen, #loader.splash-screen *, #loader.splash-screen *::before, #loader.splash-screen *::after { text-shadow: none !important; }
#preloader { background-color: ${bg} !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
.popup:has(#loader.splash-screen) { padding: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; }
.popup:has(#loader.splash-screen)::backdrop { background: ${bg} !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
#loader.splash-screen { --bl-sp-title: ${px(1.467)}; --bl-sp-sub: ${px(0.867)}; --bl-sp-font: ${font}; --bl-sp-gap: 20px; --bl-sp-gap2: 4px; font-size: ${px(1)}; line-height: 1.55; gap: var(--bl-sp-gap) !important; filter: none !important; }
@media screen and (max-width: 1000px) { #loader.splash-screen { --bl-sp-title: ${px(1.333)}; --bl-sp-sub: ${px(0.833)}; font-size: ${px(0.933)}; } }
#loader.splash-screen .splash-logo { order: 1; width: min(150px, 50%) !important; height: auto !important; filter: none !important; content: url("${logo}"); }
#loader.splash-screen .splash-message { order: 2; display: block !important; margin: 0 !important; font-size: 0 !important; line-height: 0 !important; letter-spacing: 0 !important; opacity: 1 !important; text-align: center; }
#loader.splash-screen .splash-message::before { content: "SillyTavern"; display: block; color: ${text}; font-family: ${font}; font-size: var(--bl-sp-title); font-weight: 700; line-height: 1.25; letter-spacing: 0.01em; }
#loader.splash-screen .splash-message::after { content: "불러오는 중"; display: block; margin-top: 4px; color: ${muted}; font-family: ${font}; font-size: var(--bl-sp-sub); font-weight: 500; line-height: 1.4; }
#loader.splash-screen #load-spinner { order: 3; margin-top: 8px; color: ${pop} !important; font-size: 1.7em !important; opacity: 1 !important; }
`);
}

async function write(s, late = false) {
    if ((await checkSplash()) === 'off') return;
    // 시작 직후 글꼴 CSS(#salty-fontfaces)가 아직 없으면 기다린다 — 글꼴 없이 한 번, 글꼴 붙여 또 한 번 올리던 것 (applyFonts 가 끝나면 syncSplash 로 다시 부름).
    // 그 부름이 없는 경우(꺼 둔 채 시작했다가 켰는데 글꼴 CSS 가 비어 있음)에도 안 빠지게 15초 뒤 한 번은 쓴다
    if (s.enabled && !late && !document.getElementById('salty-fontfaces')) {
        clearTimeout(lateTimer);
        lateTimer = setTimeout(() => write(s, true).catch(error => console.warn('[Blue Lemonade] 새로고침 화면', error)), 15000);
        return;
    }
    clearTimeout(lateTimer);
    const css = buildCss(s);
    if (served === null) {
        const res = await fetch(`/user/files/${SPLASH_FILE}`, { cache: 'no-store' }).catch(() => null);
        served = res?.ok ? await res.text() : '';
    }
    if (served === css) return;
    const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: SillyTavern.getContext().getRequestHeaders(),
        body: JSON.stringify({ name: SPLASH_FILE, data: btoa(css) }),
    });
    if (res.ok) served = css;
    else console.warn('[Blue Lemonade] 새로고침 화면 파일을 못 씀', res.status);
}

/** apply.js applyAll 끝 (features.js) — 색 · 글꼴이 자리 잡은 뒤 한 번만 쓰게 늦춤 */
export function syncSplash(s, onChange) {
    checkSplash(onChange);
    clearTimeout(timer);
    timer = setTimeout(() => write(s).catch(error => console.warn('[Blue Lemonade] 새로고침 화면', error)), 1500);
}
