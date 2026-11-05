// 원본 omni-next 953c439a 의 src/log-copy-motion.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(글꾸 마트 「🍽️ 시식하기」가 테마 로그 복사와 같은 모양으로 그리려고 써요)
// 로그 복사 — 1.0.1 글꾸 움직임 · 누르면 반응(이스터에그). 스크립트 없이 CSS 만이에요. DOM 없는 순수 데이터 · 함수(불러오는 모듈 없음).
//   ① 공용 키프레임 14개(bl-*) — 글꾸 장식의 인라인 style 「animation:bl-…」 이 이 이름만 써요(살균: log-copy-template.js 가 bl- 로 시작하는 이름만 받아요).
//   ② 누르면 반응 — 장식에 data-bl-egg="bounce|spin|…" · 누르는 동안(:active) · PC 올려 두기 · 폰 탭(:hover — 폰은 탭한 뒤 다른 곳을 누를 때까지 남아요) · 켜고 끄기형은 <details><summary data-bl-egg> 를 열어 두면 그대로.
//   ③ 움직임 줄이기(prefers-reduced-motion)면 글꾸 안 애니는 끄고 반응의 전환(transition)만 남겨요.
// 같은 CSS 가 세 곳에 들어가요: 테마 lazy 시트(css/86-log-copy-motion.css · 채팅에 붙여 넣은 글꾸) · 로그 복사 미리보기 칸(log-copy-sheet.js) · 마트 「HTML 복사」 맨 앞 <style>(tools/mart-build.mjs, 그 틀이 쓰는 것만).
// 시험 tools/tests/mart-geulkku-64.mjs 가 css 파일과 이 모듈이 글자까지 같은지 봐요.
export const MOTION_KEYFRAMES = {
    // 정의 = 작업자 T(시안5-컨셉) <style> 그대로 + 작업자 S(시안4-시리즈) 변수도 받게(이름이 다른 변수는 겹쳐 받기: var(--T, var(--S, 기본)))
    'bl-fall': '0%{transform:translate(0,-20px) rotate(0deg);opacity:0}10%{opacity:var(--bl-o,1)}85%{opacity:var(--bl-o,1)}100%{transform:translate(var(--bl-x2,0px),var(--bl-fall,260px)) rotate(var(--bl-r,220deg));opacity:0}',
    'bl-float': '0%,100%{transform:translateY(0)}50%{transform:translateY(calc(var(--bl-float,4px) * -2))}',
    'bl-drift': '0%,100%{transform:translateX(0)}50%{transform:translateX(var(--bl-drift,24px))}',
    'bl-twinkle': '0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}',
    'bl-pulse': '0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.08)}',
    'bl-sway': '0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}',
    'bl-spin': 'to{transform:rotate(360deg)}',
    'bl-flicker': '0%,100%{opacity:1}8%{opacity:var(--bl-lo,.35)}12%{opacity:.9}20%{opacity:.5}24%{opacity:1}60%{opacity:.85}64%{opacity:var(--bl-lo,.4)}68%{opacity:1}',
    'bl-wave': '0%,100%{transform:translate(0,0)}25%{transform:translate(calc(var(--bl-wave,-12px) / 2),3px)}50%{transform:translate(var(--bl-wave,-12px),0)}75%{transform:translate(calc(var(--bl-wave,-12px) / 2),-3px)}',
    'bl-rise': '0%{transform:translateY(var(--bl-from,10px));opacity:0}25%{opacity:var(--bl-o,1)}100%{transform:translateY(var(--bl-to,-90px));opacity:var(--bl-end,0)}',
    'bl-shimmer': '0%{background-position:-150% 0}100%{background-position:250% 0}',
    'bl-ticker': '0%{transform:translateX(var(--bl-tick-from,var(--bl-from-x,100%)))}100%{transform:translateX(var(--bl-tick-to,var(--bl-to-x,-100%)))}',
    'bl-bounce': '0%,100%{transform:translateY(0);animation-timing-function:ease-out}50%{transform:translateY(var(--bl-hop,-14px));animation-timing-function:ease-in}',
    'bl-breathe': '0%,100%{opacity:var(--bl-lo,.55);filter:brightness(1)}50%{opacity:1;filter:brightness(1.25)}',
    // 작업자 S(시안4-시리즈) 정의 그대로 — 모양(키프레임 마디 · 기본값)이 T 와 달라 이름만 bl-s-* 로 따로 둬요(변환기가 S 틀의 이름을 바꿔요 · 리그 대조에서 같은 시각 같은 자리)
    'bl-s-fall': '0%{transform:translate(0,0) rotate(0deg);opacity:0}8%{opacity:var(--bl-o,1)}50%{transform:translate(var(--bl-x,0px),calc(var(--bl-fall,140px) * .5)) rotate(calc(var(--bl-r,0deg) * .5))}92%{opacity:var(--bl-o,1)}100%{transform:translate(var(--bl-x2,0px),var(--bl-fall,140px)) rotate(var(--bl-r,0deg));opacity:0}',
    'bl-s-float': '0%,100%{transform:translateY(calc(var(--bl-float,6px) * -1))}50%{transform:translateY(var(--bl-float,6px))}',
    'bl-s-twinkle': '0%,100%{opacity:1;transform:scale(1)}50%{opacity:.2;transform:scale(.55)}',
    'bl-s-sway': '0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}',
    'bl-s-flicker': '0%,100%{opacity:1}6%{opacity:var(--bl-lo,.55)}9%{opacity:1}38%{opacity:.9}41%{opacity:var(--bl-lo,.55)}43%{opacity:1}72%{opacity:var(--bl-lo,.55)}75%{opacity:1}',
    'bl-s-wave': '0%,100%{transform:translateX(0)}50%{transform:translateX(var(--bl-wave,-14px))}',
    'bl-s-rise': '0%{transform:translateY(var(--bl-from,16px));opacity:0}30%{opacity:var(--bl-o,1)}100%{transform:translateY(var(--bl-to,0px));opacity:var(--bl-end,1)}',
    'bl-s-ticker': '0%{transform:translateX(var(--bl-from-x,100%))}100%{transform:translateX(var(--bl-to-x,-100%))}',
    'bl-s-bounce': '0%,100%{transform:translateY(0) scale(1,1)}30%{transform:translateY(var(--bl-hop,-8px)) scale(.96,1.04)}55%{transform:translateY(0) scale(1.05,.95)}70%{transform:translateY(0) scale(1,1)}',
    'bl-s-breathe': '0%,100%{opacity:var(--bl-lo,.7);filter:brightness(1)}50%{opacity:1;filter:brightness(1.15)}',
    'bl-hue': 'to{filter:hue-rotate(360deg)}',   // 반응 rainbow 전용
    // 틀 부품 움직임(1.0.1 사용자 「미라 눈이 깜박인다 이런 게 낫지」): 눈꺼풀이 접혔다 펴짐 · 뚜껑이 살짝 들썩
    'bl-blink': '0%,86%,100%{transform:scaleY(1)}90%{transform:scaleY(.08)}94%{transform:scaleY(1)}',
    'bl-wag': '0%,100%{transform:rotate(-16deg)}50%{transform:rotate(16deg)}',   // 꼬리 · 자락 크게 살랑
    'bl-lean': '0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}',   // 큰 나무 · 깃대처럼 큰 것은 느리고 작게
    'bl-lift': '0%,72%,100%{transform:translateY(0) rotate(0deg)}80%{transform:translateY(-4px) rotate(-2deg)}88%{transform:translateY(0) rotate(0deg)}',
    // 누르면 반응하는 장식의 대기 힌트(제 움직임이 없는 것만) — 2.5초마다 살짝 커졌다 돌아오며 빛이 한 번 숨 쉬어요 · 기울인 장식은 빛만(transform 을 덮지 않게)
    'bl-egg-hint': '0%,80%,100%{transform:scale(1);filter:none}88%{transform:scale(1.05);filter:drop-shadow(0 0 3px #fff3a0b0)}',
    'bl-egg-glow': '0%,80%,100%{filter:none}88%{filter:drop-shadow(0 0 3px #fff3a0b0) brightness(1.06)}',
};
export const MOTION_NAMES = Object.keys(MOTION_KEYFRAMES);
export const EGG_KINDS = ['bounce', 'spin', 'vanish', 'grow', 'shrink', 'wiggle', 'flip', 'fly', 'glow', 'rainbow', 'wink', 'drop', 'poof'];   // poof: 누른 부품이 든 몸(--bl-poof 표시) 전체가 사라졌다 돌아옴   // wink: 눈 감기 · drop: 실 타고 쑥 내려감
const EGG_LOOK = {
    bounce: 'transform:scale(1.25) translateY(-6px)', spin: 'transform:rotate(360deg)', vanish: 'opacity:0', grow: 'transform:scale(1.6)', shrink: 'transform:scale(.5)',
    wiggle: 'animation:bl-sway .3s ease-in-out infinite', flip: 'transform:rotateY(180deg)', fly: 'transform:translate(60px,-60px) rotate(20deg);opacity:0',
    glow: 'filter:drop-shadow(0 0 6px #fff6b0) drop-shadow(0 0 14px #ffd84d)', rainbow: 'animation:bl-hue 1.2s linear infinite',
    wink: 'transform:scaleY(.1)', drop: 'transform:translateY(26px)', poof: 'opacity:1',
};
const keyframes = names => names.map(name => `@keyframes ${name}{${MOTION_KEYFRAMES[name]}}`).join('');
/** 누르면 반응 규칙 — :active(폰 누르는 동안 · PC 누르는 동안) · :hover(PC 올려 두기) · details[open] > summary(켜 두기) */
function eggCss() {
    // 장식은 인라인 transform · animation 을 이미 가진 것이 많아요 — 인라인보다 세게(!important) 덮고, 손을 떼면 원래 값으로 돌아와요
    const rule = (kind, sel) => `${sel}{${EGG_LOOK[kind].split(';').map(d => `${d}!important`).join(';')}}`;
    const on = kind => [`[data-bl-egg="${kind}"]:active`, `details[open]>summary[data-bl-egg="${kind}"]`];
    return '[data-bl-egg]{cursor:pointer;transition:transform .35s cubic-bezier(.34,1.56,.64,1),opacity .35s,filter .35s;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}'
        + 'summary[data-bl-egg]{list-style:none;display:inline-block}summary[data-bl-egg]::-webkit-details-marker{display:none}'
        // 어디를 누르는지 보이게: 제 움직임이 없는 반응 장식은 대기 힌트(움직이는 것은 이미 눈에 띄어요)
        // 1.0.1 대개편: 한꺼번에 번쩍이지 않게 — 6초에 한 번 · 세 번만 · 부품 차례마다 엇갈려 · 더 은은하게
        + '[data-bl-egg]:not([style*="animation"]):not([style*="transform"]){animation:bl-egg-hint 6s ease-in-out 1s 3}[data-bl-egg][style*="transform"]:not([style*="animation"]){animation:bl-egg-glow 6s ease-in-out 1s 3}'
        + '[data-bl-egg]:nth-child(2n):not([style*="animation"]){animation-delay:3s}[data-bl-egg]:nth-child(3n):not([style*="animation"]){animation-delay:5s}'
        + EGG_KINDS.map(kind => rule(kind, on(kind).join(','))).join('')
        // poof: 떠 있는 몸 전체(인라인 --bl-poof 표시)가 사라졌다 돌아와요 — 그 안의 poof 부품을 누르는 동안 · 올려 둔 동안(폰은 탭한 뒤 다른 곳을 누를 때까지)
        + '[style*="--bl-poof"]{transition:opacity .45s}[style*="--bl-poof"]:has([data-bl-egg="poof"]:active),[style*="--bl-poof"]:has([data-bl-egg="poof"]:hover){opacity:0!important}'
        // PC 는 올려 두면 · 폰은 탭하면(:hover 가 다른 곳을 누를 때까지 남아요 — 리그 ovhQ 에서 확인) — 그래서 hover 규칙은 미디어 조건 없이 둘 다에
        + `@media (hover:hover),(hover:none){${EGG_KINDS.map(kind => rule(kind, `[data-bl-egg="${kind}"]:hover`)).join('')}}`;
}
// 움직임 줄이기: 글꾸 장식의 bl- 애니만(채팅의 다른 글은 그대로) — 반응은 transition 만 남아요
const REDUCE = '@media (prefers-reduced-motion:reduce){[style*="animation:bl-"],[style*="animation: bl-"],[style*="animation-name:bl-"],[style*="animation-name: bl-"],[data-bl-egg],[data-bl-egg]:is(:active,:hover),details[open]>summary[data-bl-egg]{animation:none!important}}';

// 눌러 열리는 틀(openBox): 겉면 summary 의 기본 삼각표(사파리)를 숨겨요 — 인라인 list-style:none 을 단 summary 만(채팅의 다른 접힘은 그대로)
const DETAILS_CSS = 'summary[style*="list-style:none"]::-webkit-details-marker{display:none}';
/** 전체 CSS(테마 시트 · 미리보기 칸) */
export const motionCss = () => keyframes(MOTION_NAMES) + eggCss() + DETAILS_CSS + REDUCE;

const escText = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
/**
 * 눌러 접는 상자(편지 봉투 · 선물 상자 · 커튼 · 문) — 처음엔 펼친 채(open · 붙여 넣은 로그가 바로 보여요), 겉면(summary)을 누르면 접히고 다시 누르면 메시지가 살짝 올라오며 펼쳐져요. 스크립트 없음.
 * k: 역할 색(line · panel · text) · cover: [이모지, 겉면 글]
 */
export function openBox(inner, k, [emoji, text]) {
    // 1.0.1 대개편: 「이모지 + 틀 이름」 칩 대신 글만(이모지는 줄 때만) — 검수 ①-5
    const mark = emoji ? `<span aria-hidden="true" data-bl-egg="bounce" style="display:inline-block;margin-right:6px;font-size:20px;line-height:1;vertical-align:-3px">${escText(emoji)}</span>` : '';
    return `<details open="" style="display:block;margin:0"><summary style="display:block;list-style:none;cursor:pointer;margin:0;padding:12px;border:1px dashed ${k.line};border-radius:12px;background-color:${k.panel};color:${k.text};text-align:center;font-size:13px;font-weight:650;letter-spacing:0.04em;line-height:1.5">${mark}${escText(text)}</summary><div style="margin-top:10px">${inner}</div></details>`;
}

/** 이 HTML 이 쓰는 이름(인라인 animation 의 bl-* · data-bl-egg 종류) */
export function motionUsed(html) {
    const text = String(html ?? '');
    const names = new Set();
    for (const [, value] of text.matchAll(/animation(?:-name)?\s*:\s*([^;"]+)/gi)) for (const name of value.match(/\bbl-[a-z]+(?:-[a-z]+)*\b/gi) ?? []) if (MOTION_KEYFRAMES[name]) names.add(name);
    const eggs = new Set([...text.matchAll(/data-bl-egg="([a-z]+)"/g)].map(m => m[1]).filter(kind => EGG_KINDS.includes(kind)));
    return { names: [...names], eggs: [...eggs] };
}
// ── 틀이 가진 부품에 움직임 · 반응 달기 (내장 컨셉 30 · 세계관 · 인물 64 공용 · 할로윈은 모양 조각에서 직접) ──
// 1.0.1 사용자 「덧붙인 이모지보다 틀 그림의 부품이 움직이고, 만질 수 있을 것 같은 부분을 누르면 반응」.
// 부품 = aria-hidden="true" 조각 가운데 절대 위치 조각 · 작은 그림 조각 · 짧은 글(이모지 · 도장 글자). 글 칸 · 바탕 전체 · 옅은 물자국은 안 건드려요.
// 생김새로 부품을 알아보고(날개 · 헤일로 · 구름 · 불꽃 · 번개 · 박쥐 · 별 · 음표 · 릴 · 도장 · 이모지 그림 …) 어울리는 움직임과 반응을 골라요. 틀마다 plan 으로 바꿀 수 있어요.
const STAR_CHARS = /^[★☆✦✧⭐✨✩✶✷✸⋆*·]+$/u, NOTE_CHARS = /[♪♫♩♬🎵🎶𝄞]/u, PETAL_CHARS = /[🌸❄🍂🍁🌼💮❅❆]/u, FIRE_CHARS = /[🕯🔥🏮]/u, BAT_CHARS = /[🦇]/u, GHOST_CHARS = /[👻]/u, SWEET_CHARS = /[🍬🍭🍩🍰🧁🍪🍫🍮🍡]/u;
function looks(style, text) {
    const s = style.replace(/\s+/g, ''), t = text.trim();
    if (/clip-path:polygon\(100%0,70%18%/.test(s)) return 'wingL';
    if (/clip-path:polygon\(0 ?0,30%18%/.test(s)) return 'wingR';
    if (/polygon\(50%0,6[01]%(35|40)%/.test(s) || (t && STAR_CHARS.test(t))) return 'star';
    if (NOTE_CHARS.test(t)) return 'note';
    if (PETAL_CHARS.test(t)) return 'petal';
    if (BAT_CHARS.test(t) || /polygon\((100%10%,60%0|0 ?10%,40%0|50%34%,54%14%)/.test(s)) return 'bat';
    if (GHOST_CHARS.test(t)) return 'ghost';
    if (FIRE_CHARS.test(t) || /#ffd166,#ff6b35/.test(s)) return 'fire';
    if (/clip-path:polygon\(50%0,100%12%,20%30%/.test(s)) return 'bolt';
    if (SWEET_CHARS.test(t)) return 'sweet';
    if (/border-radius:999px/.test(s) && /background(-color)?:#fff(fff)?(;|$)/.test(s) && /box-shadow/.test(s)) return 'cloud';
    if (/border-radius:50%/.test(s) && (/repeating-(radial|conic)-gradient|conic-gradient/.test(s) || /inset00(0)?\d+px/.test(s))) return 'reel';
    if (/border-radius:50%/.test(s) && /border:\d+px(solid|dotted|dashed)/.test(s) && !t) return 'halo';
    if (t && t.length <= 4 && /\p{Extended_Pictographic}/u.test(t)) return 'emoji';
    if (t && t.length <= 8 && /border:[\d.]+px(double|solid)/.test(s)) return 'stamp';
    if (!t && /width:([4-9]|[1-9]\d|1[01]\d)px/.test(s) && /height:([4-9]|[1-9]\d|1[01]\d)px/.test(s) && /background/.test(s)) return 'shape';
    return '';
}
// [움직임, 길이(초), 반응, 변수, 축(transform-origin)] — 날개는 몸 쪽을 축으로 퍼덕, 구름 · 박쥐는 옆으로 흐름, 릴 · 레코드는 돌고, 도장은 눌러야 쾅
const LOOK_MOTION = {
    wingL: ['bl-sway', 2.6, 'wiggle', '', '100% 25%'], wingR: ['bl-sway', 2.6, 'wiggle', '', '0 25%'],
    emoji: ['bl-float', 2.6, 'bounce', '--bl-float:8px'], bat: ['bl-drift', 3.6, 'fly', '--bl-drift:30px'], cloud: ['bl-drift', 5, 'fly', '--bl-drift:22px'],
    fire: ['bl-flicker', 1.5, 'grow'], bolt: ['bl-flicker', 1.8, 'glow'], halo: ['bl-breathe', 3, 'glow'], star: ['bl-twinkle', 2.4, 'glow'], note: ['bl-float', 2.6, 'bounce', '--bl-float:8px'],
    reel: ['bl-spin', 5, 'spin'], petal: ['bl-sway', 3.2, 'spin'], ghost: ['bl-float', 2.8, 'vanish', '--bl-float:8px'], sweet: ['bl-float', 2.8, 'rainbow', '--bl-float:8px'],
    stamp: [null, 0, 'bounce'], shape: ['bl-float', 2.6, 'bounce', '--bl-float:7px'],
};
// 누를 곳을 고르는 차례(만질 수 있을 것 같은 것부터)
const EGG_RANK = ['emoji', 'wingL', 'wingR', 'bat', 'cloud', 'fire', 'halo', 'stamp', 'reel', 'note', 'star', 'ghost', 'sweet', 'bolt', 'petal', 'shape'];
/** 움직임 · 반응을 달 수 있는 부품 목록(차례 = plan.pick 의 n) */
export function motionTargets(html) {
    const src = String(html ?? '');
    const found = [];
    const re = /<([a-z]+)((?:\s+[a-z-]+="[^"]*")*)\s*>/gi;
    for (let m; (m = re.exec(src));) {
        const attrs = m[2];
        if (!/\saria-hidden="true"/.test(attrs) || /\sdata-bl-egg=/.test(attrs)) continue;
        const style = attrs.match(/\sstyle="([^"]*)"/)?.[1] ?? '';
        const text = src.slice(re.lastIndex, src.indexOf('<', re.lastIndex) >>> 0).replace(/&[a-z#0-9]+;/gi, '');
        const s = style.replace(/\s+/g, '');
        if (/pointer-events:none/.test(s)) continue;
        const absolute = /position:absolute/.test(s) && !/inset:0|left:0(px)?;right:0|right:0(px)?;left:0|top:0(px)?;bottom:0/.test(s);
        const sized = /width:\d+px/.test(s) && /height:\d+px/.test(s) && !/width:(1[2-9]\d|[2-9]\d\d)px/.test(s);
        const shortText = text.trim() && text.trim().length <= 8;
        if (!absolute && !sized && !shortText) continue;
        const fade = Number(s.match(/(?:^|;)opacity:([\d.]+)/)?.[1] ?? 1);
        if (fade < 0.35) continue;   // 옅은 바탕 무늬(물자국 · 큰 고리)는 그대로 — 키프레임 opacity 가 진하게 덮어써요
        found.push({ at: m.index, end: m.index + m[0].length, tag: m[0], style, text: text.trim().slice(0, 12), look: looks(style, text), moving: /animation/.test(s), tilted: /transform:/.test(s), faded: fade < 1 });
    }
    return found;
}
/**
 * 부품에 animation · data-bl-egg 를 더해요(이미 있는 움직임은 그대로).
 * plan: { anim: 더할 움직임 최대(3) · egg: 반응 부품 최대(3) · skip · pick: [[n번째 부품, 'bl-… 길이 …' | null, 반응 | null, 변수?, 축?], …] · decor(부품이 정말 없을 때만 그린 조각 하나) }
 * 기울인(transform) 부품에는 transform 키프레임을 안 달아요(기울기를 덮어요) — 반응은 눌렀을 때만이라 달아요(대기 힌트는 빛만).
 */
export function addMotion(html, plan = {}) {
    if (plan.skip) return html;
    const src = String(html ?? '');
    // 부품 고르기 도구(tools/mart/parts-plan.mjs)용: 부품마다 차례 표시만 달아 돌려줘요(브라우저에서 글자와 겹치는 부품을 재요) — 테마 · 마트 산출물에는 안 나가요
    if (plan.probe || globalThis.__blPartsProbe) { let out = src; motionTargets(src).map((f, i) => [f, i]).reverse().forEach(([f, i]) => { out = out.slice(0, f.at) + f.tag.replace(/\saria-hidden="true"/, ` aria-hidden="true" data-bl-t="${i}"`) + out.slice(f.end); }); return out; }
    // exclude: 글자와 겹치는 부품(도구가 잰 차례) — 움직임도 반응도 안 달아요
    const skip = new Set(plan.exclude ?? []);
    const found = motionTargets(src).filter((f, i) => !skip.has(i));
    const jobs = new Map();   // at → { anim, egg, vars, origin }
    if (plan.pick) for (const [n, anim, egg, vars, origin] of plan.pick) { const f = found[n]; if (f) jobs.set(f.at, { anim, egg, vars, origin }); }
    else {
        const maxA = plan.anim ?? 3, maxE = plan.egg ?? 3;
        const canMove = (f, name) => name && !f.moving && !(f.tilted && name !== 'bl-flicker' && name !== 'bl-breathe') && !(f.faded && ['bl-twinkle', 'bl-pulse', 'bl-breathe', 'bl-flicker'].includes(name));
        // ① 반응 부품: 만질 수 있을 것 같은 차례로, 같은 생김새는 둘까지
        const byRank = found.filter(f => f.look).sort((a, b) => EGG_RANK.indexOf(a.look) - EGG_RANK.indexOf(b.look));
        const lookCount = {};
        for (const f of byRank) {
            if ([...jobs.values()].filter(j => j.egg).length >= maxE) break;
            if ((lookCount[f.look] = (lookCount[f.look] ?? 0) + 1) > 2) continue;
            jobs.set(f.at, { egg: LOOK_MOTION[f.look][2] });
        }
        // ② 움직임: 반응 부품부터, 다음은 나머지 부품 — 틀마다 한눈에 보이는 움직임 하나는 꼭
        let anims = 0;
        for (const f of [...byRank.filter(x => jobs.has(x.at)), ...byRank.filter(x => !jobs.has(x.at))]) {
            if (anims >= maxA) break;
            const [name, sec, , vars, origin] = LOOK_MOTION[f.look];
            if (!canMove(f, name)) continue;
            jobs.set(f.at, { ...(jobs.get(f.at) ?? {}), anim: `${name} ${(sec + anims * 0.6).toFixed(1)}s ${name === 'bl-spin' ? 'linear' : 'ease-in-out'} ${(anims * -0.7).toFixed(1)}s infinite`, vars, origin });
            anims++;
        }
        // ③ 생김새로 못 고른 틀: 움직이는 부품이 하나도 없으면 작은 부품 하나를 둥실 · 반응
        if (maxA && !anims && !found.some(f => f.moving)) { const f = found.find(x => !x.tilted); if (f) jobs.set(f.at, { ...(jobs.get(f.at) ?? {}), anim: 'bl-float 2.6s ease-in-out infinite', vars: '--bl-float:8px', egg: jobs.get(f.at)?.egg ?? 'bounce' }); }
    }
    if (!jobs.size) return decor(mascot(sprinkle(src, plan.sprinkle), plan.mascot), plan.decor);
    let out = '', last = 0;
    for (const f of found) {
        const job = jobs.get(f.at);
        if (!job) continue;
        let tag = f.tag;
        const anim = job.anim && (job.anim.includes(' ') ? job.anim : `${job.anim} 3s ease-in-out infinite`);
        const extra = `${job.origin ? `transform-origin:${job.origin};` : ''}${job.vars ? `${job.vars};` : ''}${anim ? `animation:${anim}` : ''}`.replace(/;$/, '');
        if (extra) tag = /\sstyle="/.test(tag) ? tag.replace(/\sstyle="([^"]*)"/, (_, st) => ` style="${st.replace(/;?\s*$/, '')};${extra}"`) : tag.replace(/>$/, ` style="${extra}">`);
        if (job.egg) tag = tag.replace(/\saria-hidden="true"/, ` aria-hidden="true" data-bl-egg="${job.egg}"`);
        out += src.slice(last, f.at) + tag; last = f.end;
    }
    return decor(mascot(sprinkle(out + src.slice(last), plan.sprinkle), plan.mascot), plan.decor);
}
/**
 * 바탕 그림으로만 꾸민 틀에 떠다니는 작은 조각을 더해요 — sprinkle: ['fall' | 'twinkle' | 'float' | 'rise', [글자, …], 첫 조각 반응?]
 * 조각은 맨 바깥 상자 안 왼쪽 · 오른쪽 가장자리(여백 줄)로만 다니고(글 칸 위로 안 지나가요) 누르기는 막아 둬요(pointer-events:none).
 */
function sprinkle(html, spec) {
    if (!spec) return html;
    const [kind, chars, egg] = spec;   // egg: 첫 조각은 누르면 반응(그 조각만 누를 수 있어요)
    const spans = chars.map((ch, i) => {
        const side = i % 2 ? `right:${3 + (i >> 1) * 3}px` : `left:${3 + (i >> 1) * 3}px`;
        const place = kind === 'fall' ? 'top:-16px' : kind === 'rise' ? 'bottom:6px' : `top:${10 + ((i * 29) % 70)}%`;
        const anim = { fall: `bl-fall ${(7 + i * 1.3).toFixed(1)}s linear ${(i * 1.7).toFixed(1)}s infinite`, twinkle: `bl-twinkle ${(2.2 + i * 0.5).toFixed(1)}s ease-in-out ${(i * 0.4).toFixed(1)}s infinite`, float: `bl-float ${(3 + i * 0.6).toFixed(1)}s ease-in-out infinite;--bl-float:6px`, rise: `bl-rise ${(5 + i).toFixed(1)}s ease-out ${(i * 1.5).toFixed(1)}s infinite` }[kind];
        const press = egg && !i && EGG_KINDS.includes(egg);
        return `<span aria-hidden="true"${press ? ` data-bl-egg="${egg}"` : ''} style="position:absolute;${side};${place};z-index:0;font-size:${kind === 'twinkle' ? 13 : 17}px;line-height:1;${press ? '' : 'pointer-events:none;'}animation:${anim}">${escText(ch)}</span>`;
    }).join('');
    return String(html).replace(/^(\s*<[a-z]+(?:\s+[a-z-]+="[^"]*")*\s*>)/i, `$1${spans}`);
}
const MASCOT_EGG = { '🎃': 'bounce', '👻': 'vanish', '🦇': 'fly', '🕸': 'wiggle', '🕷': 'wiggle', '🍬': 'rainbow', '🍭': 'rainbow', '🧟': 'wiggle', '⚰️': 'flip', '🧙': 'spin', '🪞': 'glow', '🌲': 'wiggle', '🏚': 'shrink', '🪦': 'vanish', '💿': 'spin', '🎂': 'bounce', '🎄': 'glow', '💝': 'grow', '❄': 'spin', '🌸': 'spin' };
const MASCOT_ROTATE = ['bounce', 'spin', 'grow', 'flip', 'wiggle'];
const px = v => { const m = String(v ?? '').trim().match(/^(-?[\d.]+)px$/); return m ? Number(m[1]) : String(v ?? '').trim() === '0' ? 0 : null; };
/**
 * 틀마다 한눈에 보이는 움직임 + 누를 곳 하나: 틀 이모지(라벨 이모지)를 맨 바깥 상자 오른쪽 위 여백에 띄워 둥실 · 누르면 반응(이모지마다 · 없으면 돌려 가며)
 * 바깥 상자의 위 · 오른쪽 안쪽 여백이 12px 이상일 때만(글 칸 위로 안 올라가요). mascot: 이모지 글 | [이모지, 반응]
 */
function mascot(html, spec) {
    if (!spec) return html;
    const [emoji, given] = Array.isArray(spec) ? spec : [spec];
    const head = String(html).match(/^\s*<[a-z]+(?:\s+[a-z-]+="[^"]*")*\s*>/i)?.[0];
    if (!head || !emoji) return html;
    const style = head.match(/\sstyle="([^"]*)"/)?.[1] ?? '';
    const decl = key => style.split(';').map(d => d.split(':')).filter(([k]) => k?.trim() === key).map(([, ...v]) => v.join(':').trim()).at(-1);
    const pad = (decl('padding') ?? '').split(/\s+/).filter(Boolean);
    const top = px(decl('padding-top') ?? pad[0] ?? '0'), right = px(decl('padding-right') ?? pad[1] ?? pad[0] ?? '0');
    if (top === null || right === null || top < 12 || right < 12) return html;
    const egg = given ?? MASCOT_EGG[emoji] ?? MASCOT_ROTATE[[...emoji].reduce((n, ch) => n + ch.codePointAt(0), 0) % MASCOT_ROTATE.length];
    // 통통 뛰어요(bl-bounce) — 꼭대기가 바깥 상자 위 끝(1px)에 닿게 놓아 잘리지 않고, 내려와도 글 칸 모서리(둥근 귀퉁이)까지만
    const size = Math.min(22, Math.max(16, top + 4)), hop = Math.min(10, Math.max(5, top - 6));
    const span = `<span aria-hidden="true" data-bl-egg="${egg}" style="position:absolute;top:${hop + 1}px;right:${Math.max(3, Math.round((right - size) / 2) + 2)}px;z-index:2;font-size:${size}px;line-height:1;--bl-hop:-${hop}px;animation:bl-bounce 2.4s ease-in-out infinite">${escText(emoji)}</span>`;
    return String(html).replace(head, head + span);
}
/**
 * 틀마다 손으로 고른 이모지 장식(자리 · 크기 · 움직임이 틀마다 달라요 — 같은 자리 복사 금지) — decor: [[이모지, 자리 · 크기 · 움직임 style, 누르면 반응], …]
 * 장식 줄 · 바깥 여백처럼 글이 없는 곳에만 둬요(시험 · 리그가 글자와 겹치는지 재요). 맨 바깥 상자 맨 앞에 넣어요(position:absolute).
 */
function decor(html, list) {
    if (!list?.length) return html;
    const spans = list.map(([emoji, style, egg]) => `<span aria-hidden="true"${egg && EGG_KINDS.includes(egg) ? ` data-bl-egg="${egg}"` : ''} style="position:absolute;z-index:2;line-height:1;${style}">${escText(emoji)}</span>`).join('');
    return String(html).replace(/^(\s*<[a-z]+(?:\s+[a-z-]+="[^"]*")*\s*>)/i, `$1${spans}`);
}
/** 붙여 넣는 곳(테마 CSS 없음)에 맨 앞에 붙일 <style> — 그 HTML 이 쓰는 키프레임 · 반응만, 없으면 빈 글 */
export function motionStyleFor(html) {
    const { names, eggs } = motionUsed(html);
    if (!names.length && !eggs.length && !/<summary/i.test(String(html))) return '';
    const need = new Set(names);
    if (eggs.includes('wiggle')) need.add('bl-sway');
    if (eggs.includes('rainbow')) need.add('bl-hue');
    if (eggs.length) { need.add('bl-egg-hint'); need.add('bl-egg-glow'); }
    return `<style>${keyframes(MOTION_NAMES.filter(name => need.has(name)))}${eggs.length ? eggCss() : ''}${/<summary/i.test(String(html)) ? DETAILS_CSS : ''}${names.length || eggs.length ? REDUCE : ''}</style>`;   // 움직임 · 반응이 없으면(숨긴 글 summary 만) 줄이기 규칙도 안 붙여요
}
