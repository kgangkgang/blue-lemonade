// 노래 앨범 틀 3종(누구나 쓰는 판) — 다크 앨범 · 밝은 싱글 · 플레이리스트. node tools/song-templates.cjs  (견본 판 + 곡 · 그림 · mp3 수를 바꾼 판을 찍어요)
// 바탕: 깡싸 노래 묶음 글꾸(11-09 · 곡마다 메인 그림 + 제목 · 캐릭터 칩 · mp3 카드 + 가로 스크롤 그림). 곡 제목 · 캐릭터 이름은 견본으로,
//   그림은 화보 견본 SVG(mart/data/sample/hwabo), mp3 는 직접 만든 6초 합성음 견본(mart/data/sample/song/s1~s3.mp3)으로 넣었어요.
// 곡 수 · 그림 수 · mp3 수가 달라도 깨지지 않게: CSS 는 수와 상관없이 같아요(트랙 번호 · 사진 번호는 counter, mp3 칸은 auto-fit, 그림 띠 · 격자는 장 수 자유).
//   쓰는 사람은 곡 · 그림 · mp3 블록을 복사하거나 지우기만 하면 돼요. 곡 색은 곡 블록 class 의 t1~t6(<style> 맨 위 「곡 색」 줄).
// 깡싸 규칙: 진짜 <img>(첨부 목록) · <audio class="uploaded-audio"> · 사이트 번호표 숨김 · height:% 옆에 block-size(정화기가 auto 로 바꿔요) ·
//   radio name · id/for 에 기대지 않음(체크박스는 label 안) · position:fixed · contenteditable · blob: · script 없음 · 화면에 「원곡 · 커버 · AI」 없음.
// require 하면 { album, single, playlist, KINDS, forbidden, wordsBad } (글꾸 마트 tools/geulkku-song.mjs 가 견본 판을 만들어요)
const fs = require('fs');
const path = require('path');
const ROOT_URL = process.env.SG_BASE || 'https://kgangkgang.github.io/blue-lemonade/mart/data/sample/';
const IMG = ROOT_URL + 'hwabo/', AUD = ROOT_URL + 'song/';

// ── 견본 ──
const CAST = [['Aster', '#79A9D8'], ['Blair', '#e9b949'], ['Cyan', '#3ccfbf'], ['Dahlia', '#ff5fa2'], ['Eden', '#7fbf3c'], ['Fern', '#b799e8']];
const PIN = '맨 위 글 칸이에요. 올리면서 하고 싶은 말을 여기에 적어요.';
// 그림: 'p01'~'p12' 세로(832x1216) · 'l1' 'l2' 가로(1216x832)
// 곡: ti 제목 · en 영문 줄 · ch 캐릭터 번호(0부터) · t 곡 색 · main 메인 그림 · pics 나머지 그림 · au [[이름표, 견본 mp3]]
const SONGS = [
  { ti: '첫 번째 곡 제목', en: 'Song Title One', ch: [0], t: 1, main: 'p01', pics: ['p02', 'p03', 'l1', 'p04', 'p05'], au: [['', 's1']] },
  { ti: '두 번째 곡', en: 'Second Song', ch: [1], t: 2, main: 'l2', pics: ['p06', 'p07', 'p08'], au: [['ver. A', 's2'], ['ver. B', 's3']] },
  { ti: '세 번째 곡 — 듀엣', en: 'Duet Song', ch: [2, 3], t: 3, main: 'p09', pics: ['p10', 'p11', 'p12', 'l1', 'p02', 'p03'], au: [['', 's3']] },
  { ti: '네 번째 곡', en: 'Fourth Song', ch: [4], t: 4, main: 'p12', pics: ['p04', 'p05'], au: [['', 's1']] },
];
// 수를 바꾼 판(시험용): 곡 1개 · 그림 0장 · mp3 3개 / 곡 7개
const VARIANTS = {
  one: [{ ti: '혼자 남은 곡', en: 'Only Song', ch: [5], t: 5, main: 'l1', pics: [], au: [['ver. A', 's1'], ['ver. B', 's2'], ['ver. C', 's3']] }],
  seven: Array.from({ length: 7 }, (_, i) => ({ ...SONGS[i % 4], ti: `곡 ${i + 1}`, t: i % 6 + 1, pics: SONGS[i % 4].pics.slice(0, i) })),
};
const isLand = k => k[0] === 'l';
const two = i => String(i).padStart(2, '0');
const img = (k, eager) => `<!-- 견본 --><img src="${IMG}${k}.svg" width="${isLand(k) ? 1216 : 832}" height="${isLand(k) ? 832 : 1216}" alt="업로드 이미지" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
const audio = k => `<!-- 견본 mp3 --><audio src="${AUD}${k}.mp3" controls="" preload="metadata" class="uploaded-audio"></audio>`;
const SANS = 'Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const SERIF = '"Noto Serif KR","Apple SD Gothic Neo","Nanum Myeongjo",Georgia,serif';
const DIDOT = '"Didot","Bodoni 72","Bodoni MT","Playfair Display",Georgia,"Noto Serif KR",serif';
const MONO = 'ui-monospace,"SFMono-Regular","Cascadia Mono",Menlo,Consolas,monospace';
const colorsCss = P => `/* ▼ 캐릭터 색 — c1~c6 의 색을 바꾸거나, 줄을 복사해 c7 · c8 … 을 더해요 */\n${CAST.map(([, c], i) => `${P} .c${i + 1}{--c:${c}}`).join('\n')}\n/* ▲ 캐릭터 색 */`;
const toneCss = (P, tones, keys) => `/* ▼ 곡 색 — 곡 블록 class 의 t1~t6 을 고르거나, 이 줄의 값을 바꿔요(줄을 복사해 t7 … 도 돼요) */\n${tones.map((v, i) => `${P} .t${i + 1}{${keys.map(k => `--${k}:${v[k]}`).join(';')}${v.sch ? `;color-scheme:${v.sch}` : ''}}`).join('\n')}\n/* ▲ 곡 색 */`;
// 사이트 맞춤(4-1 · 4-2): 진짜 img · 사이트가 감싸는 wrapper · 번호표 숨김
const photoCss = (P, ph, bg, cnt) => `
${P} .${ph}{display:grid!important;grid-template-columns:100%;grid-template-rows:100%;width:100%;aspect-ratio:832/1216;overflow:hidden;background:${bg}!important;${cnt ? `counter-increment:${cnt};` : ''}line-height:0}
${P} .${ph}.land{aspect-ratio:1216/832}
${P} .${ph} > *{grid-area:1/1!important;min-width:0;min-height:0}
${P} .${ph} > img,${P} .${ph} > .image-number-wrapper,${P} .${ph} :has(> img):not(.${ph}){display:block!important;position:static!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;line-height:0!important}
${P} .${ph} img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:contain!important;object-position:50% 50%!important;margin:0!important;border:0!important;opacity:1!important}
${P} .${ph} > :not(img):not(.image-number-wrapper):not(:has(img)){display:none!important}
${P} .image-number-badge{display:none!important}`;
const audioCss = (P, sel, h = 44) => `
${P} ${sel} audio{display:block;width:100%;height:${h}px;margin:0;border-radius:999px;background:transparent;outline:none}
${P} ${sel} audio::-webkit-media-controls-enclosure{border-radius:999px;background:color-mix(in srgb,var(--ink) 12%,transparent)}
${P} ${sel} audio::-webkit-media-controls-panel{background:transparent}`;
const baseCss = (P, ink, extra, divBg = 'background-color') => `
${P}{${ink}display:block!important;box-sizing:border-box;container-type:inline-size;margin:14px auto!important;padding:0!important;border:0!important;background:transparent!important;font-family:${SANS};line-height:1.55;text-align:left;-webkit-text-size-adjust:100%;${extra}}
${P},${P} *{color:var(--ink)!important;-webkit-text-fill-color:var(--ink)!important;box-sizing:border-box}
${P} div{${divBg}:transparent!important;border:0;margin:0;padding:0}
${P} p{margin:0!important;padding:0!important;text-align:inherit}
${P} label{margin:0;padding:0}
${P} b{font-weight:700}`;
// 정화기가 height:% 를 auto 로 바꿔도 남게 — 같은 값의 block-size 를 바로 뒤에
const fixH = css => css.replace(/(^|[;{])height:([\d.]+%)(!important)?/g, (m, a, v, imp = '') => `${a}height:${v}${imp};block-size:${v}${imp}`);
const forbidden = out => ['position:fixed', 'contenteditable', 'blob:', '<script'].filter(k => out.includes(k))
  .concat(/<[a-z]+[^>]* name=/i.test(out) ? ['name='] : [])
  .concat(/(^|[;{\s])height:\s*[\d.]+%(?!(!important)?;block-size)/.test(out) ? ['height% 단독'] : []);
// 화면에 보이는 글(주석 · style · 태그 뺀 것)에 쓰면 안 되는 말
const shown = out => out.replace(/<!--[\s\S]*?-->/g, '').replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
const wordsBad = out => ['원곡', '커버', '가수'].filter(k => shown(out).includes(k)).concat(/\bAI\b/.test(shown(out)) ? ['AI'] : []);
const GUIDE = (title, extra) => `<!-- 블루레몬에이드 글꾸 마트 · 노래 앨범 「${title}」
  · 그림: 「견본」 표시가 붙은 <img src="…"> 의 주소를 내 그림 주소로 바꿔요(깡싸는 글에 올린 그림 주소 — 그래야 첨부파일 목록에도 떠요). 가로 그림 칸은 class 에 land 가 붙어 있어요.
  · mp3: 「견본 mp3」 표시가 붙은 <audio src="…"> 의 주소를 내 mp3 주소로 바꿔요(깡싸는 한 글에 mp3 10개까지). 한 곡에 mp3 를 여럿 두려면 mp3 칸을 복사해요.
  · 곡 더하기 · 빼기: 「▼ 곡 시작」~「▲ 곡 끝」을 통째로 복사 · 지워요. 트랙 번호와 그림 번호는 저절로 매겨져요.
  · 곡 색: 곡 블록 class 의 t1~t6 을 바꾸거나 <style> 맨 위 「곡 색」 줄의 값을 바꿔요. 캐릭터 색은 「캐릭터 색」 줄(c1~c6).
  · 곡 사이 코멘트 칸(memo)은 비어 있어요 — <br> 자리에 글을 적어요. 필요 없으면 지워도 돼요.
${extra}
  · 이런 주석은 지워도 모양이 그대로예요. 스크립트 없이 체크박스 · label 로만 움직여요. -->`;
const chips = (s, cls) => s.ch.map(i => `<p class="${cls} c${i + 1}"><span class="${cls}-dot"></span>${CAST[i][0]}</p>`).join('');
const castOf = songs => [...new Set(songs.flatMap(s => s.ch))].sort((a, b) => a - b);

// ════════ 1. 다크 앨범 ════════ 곡마다 메인 그림 + 제목 · 칩 · 흐린 유리 mp3 카드 + 가로 스크롤 띠(폰 스와이프 · PC 휠 · 키보드)
function album(songs = SONGS) {
  const P = '.sgt1.sgt1.sgt1';
  const ph = (k, eager) => `<div class="a-ph${isLand(k) ? ' land' : ''}">${img(k, eager)}</div>`;
  const item = k => `<div class="a-it${isLand(k) ? ' a-il' : ''}"><label class="a-lb"><input type="checkbox" class="a-k" aria-label="그림 넘기기">${ph(k)}</label></div>`;
  const pl = ([key, a]) => `<div class="a-pl">${key ? `<p class="a-key">${key}</p>` : ''}${audio(a)}</div>`;
  const song = (s, i) => `<!-- ▼ 곡 시작 -->
<div class="a-song t${s.t}">
<div class="a-top${isLand(s.main) ? ' a-wide' : ''}"><div class="a-main">${ph(s.main, i === 0)}</div><div class="a-side"><div class="a-hd"><p class="a-no">TRACK <span class="a-tn"></span></p><p class="a-ti">${s.ti}</p><p class="a-en">${s.en}</p><div class="a-chips">${chips(s, 'a-ch')}</div></div>
<!-- 카드 뒤 흐린 그림: 메인 그림과 같은 주소로 바꿔요(style 을 지우면 곡 색 바탕만) --><div class="a-card" style="background-image:url('${IMG}${s.main}.svg')"><div class="a-glass">${s.au.map(pl).join('')}</div></div></div></div>
<div class="a-fr"><div class="a-tr">${s.pics.map(item).join('')}</div></div>
</div>
<!-- ▲ 곡 끝 -->`;
  const memo = `<!-- 곡 사이 코멘트 칸 --><p class="a-memo"><br></p>`;
  const TONES = [
    { bg: 'radial-gradient(90% 60% at 50% 0%,#2a2a33,#0b0b0f 70%)', ink: '#f3f3f5', mute: '#a3a3ad', acc: '#ff7a85', ov: '#0b0b0fc7', line: '#ffffff1f', sch: 'dark' },
    { bg: 'radial-gradient(80% 50% at 85% 0%,#7a1830,transparent 70%),linear-gradient(170deg,#3b0d19,#22070e)', ink: '#fbecef', mute: '#d9a7b3', acc: '#ff8a97', ov: '#2a0911c4', line: '#ffffff21', sch: 'dark' },
    { bg: 'radial-gradient(70% 45% at 15% 0%,#1d3fae,transparent 70%),radial-gradient(60% 40% at 100% 100%,#5b2bb0,transparent 70%),#070b26', ink: '#eaf3ff', mute: '#93a9d9', acc: '#6cc4ff', ov: '#070b26c2', line: '#6cc4ff40', sch: 'dark' },
    { bg: 'radial-gradient(80% 50% at 0% 0%,#1f5a3c,transparent 70%),linear-gradient(180deg,#0d1f17,#08130e)', ink: '#ecf7f0', mute: '#9cc4ad', acc: '#7fe0a6', ov: '#0a1a12c4', line: '#7fe0a633', sch: 'dark' },
    { bg: 'radial-gradient(80% 50% at 100% 0%,#5a2c86,transparent 70%),linear-gradient(180deg,#1c1029,#120a1b)', ink: '#f5eefc', mute: '#c3acd9', acc: '#d4a6ff', ov: '#160c22c4', line: '#d4a6ff33', sch: 'dark' },
    { bg: 'linear-gradient(180deg,#f4f3f1,#e6e5e2)', ink: '#141414', mute: '#686868', acc: '#c41e2c', ov: '#f4f3f1cf', line: '#14141426', sch: 'light' },
  ];
  const css = fixH(`${baseCss(P, '--ink:#eee;--mute:#999;--acc:#fff;--line:#ffffff22;', 'max-width:940px')}
${toneCss(P, TONES, ['bg', 'ink', 'mute', 'acc', 'ov', 'line'])}
${colorsCss(P)}
${P} .a-in{display:flex!important;flex-direction:column;gap:18px;counter-reset:trk}
/* 앨범 머리 */
${P} .a-head{display:flex!important;flex-direction:column;align-items:center;gap:6px;padding:26px 16px 22px!important;border-radius:16px;background:radial-gradient(70% 90% at 50% 0%,#2b2b36,#0c0c10 75%)!important;text-align:center;--ink:#f4f4f6}
${P} .a-kick{font:700 11px/1 ${MONO};letter-spacing:.32em;--ink:#9a9aa6}
${P} .a-at{font:900 clamp(30px,9cqw,54px)/1.08 ${SERIF};letter-spacing:-.02em;word-break:keep-all}
${P} .a-by{font:500 13px/1.3 ${SANS};letter-spacing:.08em;--ink:#b4b4bf}
${P} .a-head .a-chips{justify-content:center;margin-top:8px!important}
${P} .a-pin{display:block!important;padding:14px 16px!important;border-radius:14px;background:#15151b!important;box-shadow:inset 0 0 0 1px #ffffff14;--ink:#e9e9ee;font:400 15px/1.7 ${SANS};white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}
${P} .a-memo{display:block!important;min-height:2.4em;margin:2px 4px!important;padding:6px 4px!important;font:400 15px/1.7 ${SANS};white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}
/* 곡 블록 */
${P} .a-song{display:flex!important;flex-direction:column;gap:16px;padding:16px 14px 18px!important;border-radius:16px;counter-reset:sgn;counter-increment:trk;overflow:hidden;background:var(--bg)!important}
${P} .a-top{display:flex!important;flex-direction:column;gap:14px}
${P} .a-main{display:block!important;width:min(100%,460px);margin:0 auto!important}
${P} .a-wide .a-main{width:100%}
${P} .a-side{display:flex!important;flex-direction:column;gap:12px;min-width:0}
${P} .a-hd{display:flex!important;flex-direction:column;gap:3px}
${P} .a-no{--ink:var(--acc);font:700 11px/1 ${MONO};letter-spacing:.2em}
${P} .a-tn::after{content:counter(trk,decimal-leading-zero)}
${P} .a-ti{font:800 clamp(23px,6.4cqw,34px)/1.2 ${SANS};letter-spacing:-.02em;word-break:keep-all}
${P} .a-en{--ink:var(--mute);font:500 13px/1.3 ${SANS};letter-spacing:.04em}
${P} .a-chips{display:flex!important;flex-wrap:wrap;gap:6px;margin-top:6px!important}
${P} .a-ch{display:inline-flex!important;align-items:center;gap:7px;padding:4px 11px 4px 9px!important;border-radius:999px;box-shadow:inset 0 0 0 1px var(--line);font:700 13px/1.2 ${SANS};letter-spacing:.06em}
${P} .a-ch-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--c)!important;box-shadow:0 0 8px var(--c)}
/* mp3 카드(그림을 흐리게 깐 유리 카드 — 떠 있는 판 없이 흐름 안에서) */
${P} .a-card{display:block!important;border-radius:16px;overflow:hidden;background-size:cover!important;background-position:50% 28%!important;background-repeat:no-repeat!important;box-shadow:0 14px 30px -18px #000c,inset 0 0 0 1px var(--line)}
${P} .a-glass{border-radius:16px;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;padding:14px!important;background-color:var(--ov)!important;-webkit-backdrop-filter:blur(22px) saturate(1.4);backdrop-filter:blur(22px) saturate(1.4)}
${P} .a-pl{display:flex!important;flex-direction:column;gap:6px;min-width:0}
${P} .a-key{--ink:var(--acc);font:800 12px/1 ${MONO};letter-spacing:.08em}
${audioCss(P, '.a-pl')}
/* 그림 칸 · 번호 꾸밈(counter · 사이트 번호표는 숨김) */
${photoCss(P, 'a-ph', '#0006', 'sgn')}
${P} .a-ph{border-radius:10px}
${P} .a-ph::after{content:counter(sgn,decimal-leading-zero);grid-area:1/1;justify-self:end;align-self:start;margin:7px 7px 0 0;padding:3px 6px 2px;border-radius:5px;background:#0009;font:700 10px/1 ${MONO};letter-spacing:.08em;color:var(--acc);-webkit-text-fill-color:var(--acc);pointer-events:none}
${P} .a-main .a-ph{box-shadow:0 18px 40px -20px #000d}
${P} .a-main .a-ph::after{margin:10px 10px 0 0;padding:4px 8px 3px;font-size:11px}
/* 가로 스크롤 띠(폰 = 스와이프 · 그림이 없으면 띠도 숨김) */
${P} .a-fr{display:block!important;container-type:size;height:230px;overflow:hidden}
${P} .a-fr:not(:has(img)){display:none!important}
${P} .a-tr{display:flex!important;gap:8px;width:100cqw;height:100cqh;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;scroll-behavior:smooth;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;outline:0;counter-reset:sgn 1}
${P} .a-tr::-webkit-scrollbar{display:none;width:0;height:0;background:transparent}
${P} .a-it{--w:calc(100cqh * .6842);flex:0 0 auto;display:block!important;width:var(--w);height:100cqh;scroll-snap-align:start;counter-increment:sgn}
${P} .a-it .a-ph{counter-increment:none;width:var(--w);height:100cqh;aspect-ratio:auto}
${P} .a-il{--w:calc(100cqh * 1.4615)}
${P} .a-lb{display:grid!important;grid-template-columns:100%;grid-template-rows:100%;width:var(--w);height:100cqh;cursor:pointer;-webkit-tap-highlight-color:transparent}
${P} .a-lb > *{grid-area:1/1}
${P} .a-k{-webkit-appearance:none;appearance:none;display:block;width:1px;height:1px;margin:0!important;padding:0!important;border:0!important;outline:0;background:transparent!important;align-self:start;justify-self:start}
${P} .a-lb:has(.a-k:focus-visible) .a-ph{box-shadow:0 0 0 2px var(--acc)}
/* 곡마다 꾸밈(t 색과 함께 바뀌어요) */
${P} .t3 .a-ti{text-shadow:0 0 6px #3aa7ffcc,0 0 22px #3aa7ff88;letter-spacing:.04em}
${P} .t2 .a-ti,${P} .t5 .a-ti,${P} .t6 .a-ti{font-family:${SERIF}}
${P} .t6 .a-ph{background:#fff!important}
${P} .t6 .a-ph::after{background:#ffffffd9}
@container (min-width:640px){
${P} .a-head{padding:40px 24px 34px!important}
${P} .a-song{padding:26px!important;gap:20px}
${P} .a-top{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:26px}
${P} .a-main{width:100%}
${P} .a-wide{grid-template-columns:100%}
${P} .a-wide .a-main{width:min(100%,760px)}
${P} .a-fr{height:340px}
${P} .a-tr{gap:10px}
}
/* PC(마우스): 띠를 -90도 돌려 휠로 옆으로 넘김 */
@media (min-width:701px) and (hover:hover) and (pointer:fine){
${P} .a-tr{display:block!important;width:100cqh;height:100cqw;overflow-x:hidden;overflow-y:auto;scroll-snap-type:y mandatory;overscroll-behavior-x:auto;overscroll-behavior-y:auto;transform-origin:0 0;transform:translateY(100cqh) rotate(-90deg)}
${P} .a-it{width:100cqh;height:var(--w);margin:0 0 10px!important}
${P} .a-it:last-child{margin-bottom:0!important}
${P} .a-lb{transform-origin:0 0;transform:translateX(100cqh) rotate(90deg)}
}`.trim());
  const head = `<div class="a-head"><p class="a-kick">ALBUM</p><p class="a-at">앨범 제목</p><p class="a-by">Album Title · 2026</p><div class="a-chips">${castOf(songs).map(i => `<p class="a-ch c${i + 1}"><span class="a-ch-dot"></span>${CAST[i][0]}</p>`).join('')}</div></div>
<p class="a-pin">${PIN}</p>`;
  const html = `${GUIDE('다크 앨범', '  · 그림 더하기: 띠 안의 그림 칸(<div class="a-it …">…</div>)을 복사해요. 띠의 그림을 다 지우면 띠도 숨어요. 메인 그림이 가로면 칸 class 에 a-wide · land 가 붙어요.\n  · 띠는 폰은 손가락으로, PC 는 마우스 휠로 넘겨요. 그림을 한 번 누르면 방향키로도 넘어가요.')}
<div class="sgt1"><style>
${css}
</style>
<div class="a-in">
${head}
${songs.map(song).join(`\n${memo}\n`)}
${memo}
</div>
</div>
`;
  return { html, css };
}

// ════════ 2. 밝은 싱글 ════════ 종이빛 싱글 재킷: 액자 낀 메인 그림 · 세리프 제목 · 트랙 줄(mp3) · 아래 그림 격자
function single(songs = SONGS) {
  const P = '.sgt2.sgt2.sgt2';
  const ph = (k, x = '', eager = false) => `<div class="b-ph${isLand(k) ? ' land' : ''}${x}">${img(k, eager)}</div>`;
  const row = ([key, a], j) => `<div class="b-tk"><p class="b-tkn">${two(j + 1)}</p><p class="b-tkt">${key || 'Play'}</p>${audio(a)}</div>`;
  const song = (s, i) => `<!-- ▼ 곡 시작 -->
<div class="b-song t${s.t}">
<div class="b-top${isLand(s.main) ? ' b-wide' : ''}"><div class="b-jk">${ph(s.main, ' b-cv', i === 0)}</div>
<div class="b-side"><p class="b-kick">SINGLE <span class="b-tn"></span></p><p class="b-ti">${s.ti}</p><p class="b-en">${s.en}</p><div class="b-chips">${chips(s, 'b-ch')}</div>
<div class="b-list">${s.au.map(row).join('')}</div></div></div>
<div class="b-grid">${s.pics.map(k => ph(k)).join('')}</div>
</div>
<!-- ▲ 곡 끝 -->`;
  const memo = `<!-- 곡 사이 코멘트 칸 --><p class="b-memo"><br></p>`;
  const TONES = [
    { paper: '#f7f2ea', ink: '#1d1a17', mute: '#7a7068', acc: '#b3242c', line: '#1d1a1724' },
    { paper: '#eef6f3', ink: '#14302b', mute: '#5b746f', acc: '#0f8a7d', line: '#14302b24' },
    { paper: '#eef3fb', ink: '#15233d', mute: '#5d6d8a', acc: '#2f62c9', line: '#15233d24' },
    { paper: '#f4effa', ink: '#251a35', mute: '#74688a', acc: '#7a4fc0', line: '#251a3524' },
    { paper: '#fbf0e8', ink: '#33200f', mute: '#86705d', acc: '#c8611c', line: '#33200f24' },
    { paper: '#1b1c20', ink: '#f2f1ee', mute: '#a5a39d', acc: '#e9b949', line: '#ffffff24', sch: 'dark' },
  ];
  const css = fixH(`${baseCss(P, '--ink:#1d1a17;--mute:#7a7068;--acc:#b3242c;--paper:#f7f2ea;--line:#1d1a1724;', 'max-width:900px;color-scheme:light')}
${toneCss(P, TONES, ['paper', 'ink', 'mute', 'acc', 'line'])}
${colorsCss(P)}
${P} .b-in{display:flex!important;flex-direction:column;gap:16px;counter-reset:trk}
${P} .b-pin{display:block!important;padding:14px 16px!important;border-radius:14px;background:#fffdf9!important;box-shadow:0 1px 0 #0000000f,0 8px 22px #3a2f2222;font:400 15px/1.65 ${SANS};word-break:keep-all;overflow-wrap:anywhere;--ink:#1d1a17}
${P} .b-memo{display:block!important;min-height:2.4em;margin:2px 4px!important;padding:6px 4px!important;font:400 15px/1.7 ${SANS};white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}
/* 곡 블록(종이 재킷) */
${P} .b-song{display:flex!important;flex-direction:column;gap:20px;padding:20px 16px 18px!important;border-radius:6px;background:var(--paper)!important;background-image:radial-gradient(#0000000a 1px,transparent 1.2px)!important;background-size:5px 5px!important;box-shadow:0 1px 0 #0000000d,0 16px 34px -20px #3a2f2299;counter-reset:sbn;counter-increment:trk;color-scheme:light}
${P} .b-song.t6{color-scheme:dark;background-image:radial-gradient(#ffffff0a 1px,transparent 1.2px)!important}
${P} .b-top{display:flex!important;flex-direction:column;gap:18px}
${P} .b-jk{display:block!important;width:min(100%,400px);margin:0 auto!important;padding:10px 10px 30px!important;background:#fffefb!important;box-shadow:0 1px 0 #0000001a,0 14px 30px -14px #00000066;transform:rotate(-1.2deg)}
${P} .b-wide .b-jk{width:min(100%,620px);transform:rotate(.8deg)}
${P} .b-side{display:flex!important;flex-direction:column;gap:4px;min-width:0}
${P} .b-kick{font:700 11px/1 ${MONO};letter-spacing:.28em;--ink:var(--acc)}
${P} .b-tn::after{content:"No." counter(trk,decimal-leading-zero)}
${P} .b-ti{margin-top:6px!important;font:700 clamp(26px,7.4cqw,40px)/1.18 ${SERIF};letter-spacing:-.01em;word-break:keep-all}
${P} .b-en{font:italic 400 17px/1.3 ${DIDOT};--ink:var(--mute)}
${P} .b-chips{display:flex!important;flex-wrap:wrap;gap:6px;margin:8px 0 4px!important}
${P} .b-ch{display:inline-flex!important;align-items:center;gap:6px;padding:4px 11px 4px 4px!important;border-radius:999px;background:color-mix(in srgb,var(--c) 16%,transparent)!important;font:700 12.5px/1.2 ${SANS};letter-spacing:.04em}
${P} .b-ch-dot{display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--c)!important;box-shadow:inset 0 0 0 3px #ffffff80}
/* 트랙 줄(mp3 가 몇 개든 한 줄씩) */
${P} .b-list{display:flex!important;flex-direction:column;margin-top:10px!important;border-top:1.5px solid var(--ink)!important}
${P} .b-tk{display:grid!important;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:6px 12px;padding:10px 0!important;border-bottom:1px solid var(--line)!important}
${P} .b-tkn{font:700 12px/1 ${MONO};letter-spacing:.06em;--ink:var(--acc)}
${P} .b-tkt{font:600 14px/1.3 ${SANS};min-width:0}
${P} .b-tk audio{grid-column:1/-1}
${audioCss(P, '.b-tk', 40)}
/* 그림 칸 · 번호 꾸밈 */
${photoCss(P, 'b-ph', '#e6e0d6', 'sbn')}
${P} .t6 .b-ph{background:#2a2b30!important}
${P} .b-ph::after{content:counter(sbn,decimal-leading-zero);grid-area:1/1;justify-self:end;align-self:start;margin:6px 6px 0 0;padding:3px 6px 2px;border-radius:999px;background:#fffefbd9;font:700 10px/1 ${MONO};letter-spacing:.06em;color:var(--acc);-webkit-text-fill-color:var(--acc);pointer-events:none}
${P} .b-cv::after{margin:8px 8px 0 0;padding:4px 8px 3px;font-size:11px}
/* 그림 격자(장 수 자유 · 가로 그림은 두 칸 · 그림이 없으면 숨김) */
${P} .b-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:start}
${P} .b-grid:not(:has(img)){display:none!important}
${P} .b-grid .b-ph{border-radius:3px;box-shadow:0 0 0 1px var(--line)}
${P} .b-grid .land{grid-column:span 2}
@container (min-width:640px){
${P} .b-song{padding:30px 30px 28px!important;gap:26px}
${P} .b-top{display:grid!important;grid-template-columns:minmax(0,.95fr) minmax(0,1fr);align-items:center;gap:34px}
${P} .b-jk{width:100%}
${P} .b-wide{grid-template-columns:100%}
${P} .b-wide .b-jk{width:min(100%,680px)}
${P} .b-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
}`.trim());
  const html = `${GUIDE('밝은 싱글', '  · 그림 더하기: 아래 격자의 그림 칸(<div class="b-ph …">…</div>)을 복사해요. 가로 그림은 두 칸을 써요. 격자의 그림을 다 지우면 격자도 숨어요.\n  · 트랙 줄 이름(Play · ver. A …)은 바꿔도 돼요. 줄 번호 01 · 02 는 글자예요.')}
<div class="sgt2"><style>
${css}
</style>
<div class="b-in">
<p class="b-pin">${PIN}</p>
${songs.map(song).join(`\n${memo}\n`)}
${memo}
</div>
</div>
`;
  return { html, css };
}

// ════════ 3. 플레이리스트 ════════ 목록형: 줄마다 작은 그림 · 번호 · 제목 · 칩 · mp3, 「그림 보기」를 누르면 그 곡 그림이 펼쳐져요
function playlist(songs = SONGS) {
  const P = '.sgt3.sgt3.sgt3';
  const ph = (k, eager) => `<div class="c-ph${isLand(k) ? ' land' : ''}">${img(k, eager)}</div>`;
  const song = (s, i) => `<!-- ▼ 곡 시작 -->
<div class="c-song t${s.t}">
<div class="c-row"><div class="c-th">${ph(s.main, i < 3)}</div><div class="c-meta"><p class="c-no"></p><p class="c-ti">${s.ti}</p><p class="c-sub">${s.ch.map(j => `<span class="c-who c${j + 1}">${CAST[j][0]}</span>`).join('')}<span class="c-en">${s.en}</span></p></div>
<label class="c-open"><input type="checkbox" class="c-k" aria-label="그림 펼치기"><span class="c-o1">그림 ▾</span><span class="c-o2">접기 ▴</span></label></div>
<div class="c-aus">${s.au.map(([key, a]) => `<div class="c-pl">${key ? `<p class="c-key">${key}</p>` : ''}${audio(a)}</div>`).join('')}</div>
<div class="c-more">${s.pics.map(k => ph(k)).join('')}</div>
</div>
<!-- ▲ 곡 끝 -->`;
  const memo = `<!-- 곡 사이 코멘트 칸 --><p class="c-memo"><br></p>`;
  const TONES = ['#ff7a85', '#e9b949', '#3ccfbf', '#ff5fa2', '#7fbf3c', '#b799e8'].map(acc => ({ acc }));
  const css = fixH(`${baseCss(P, '--ink:#f1f2f5;--mute:#9a9ca8;--acc:#7aa7ff;--line:#ffffff17;', 'max-width:760px;color-scheme:dark')}
${toneCss(P, TONES, ['acc'])}
${colorsCss(P)}
${P} .c-box{display:block!important;border-radius:18px;padding:18px 12px 10px!important;background:linear-gradient(180deg,#24262e,#121318 260px)!important;box-shadow:0 18px 40px -24px #000}
${P} .c-head{display:flex!important;flex-direction:column;gap:4px;padding:6px 6px 14px!important}
${P} .c-kick{font:700 11px/1 ${MONO};letter-spacing:.26em;--ink:var(--mute)}
${P} .c-pt{font:800 clamp(26px,7.6cqw,40px)/1.15 ${SANS};letter-spacing:-.02em;word-break:keep-all}
${P} .c-pin{display:block!important;margin-top:6px!important;font:400 14.5px/1.65 ${SANS};word-break:keep-all;overflow-wrap:anywhere;--ink:#d6d8de}
${P} .c-list{display:flex!important;flex-direction:column;counter-reset:trk;border-top:1px solid var(--line)!important}
${P} .c-memo{display:block!important;min-height:2.2em;margin:0 6px!important;padding:6px 4px!important;font:400 14.5px/1.7 ${SANS};white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;--ink:#d6d8de}
/* 곡 줄 */
${P} .c-song{display:flex!important;flex-direction:column;gap:10px;padding:12px 6px 14px!important;border-bottom:1px solid var(--line)!important;counter-increment:trk;counter-reset:scn}
${P} .c-row{display:grid!important;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:12px}
${P} .c-th{display:block!important;width:64px;border-radius:8px;overflow:hidden;box-shadow:0 0 0 1px var(--line),0 6px 14px -6px #000}
${P} .c-th .c-ph{width:64px;height:64px;aspect-ratio:auto;counter-increment:none}
${P} .c-th .c-ph::after{display:none}
${P} .c-meta{display:flex!important;flex-direction:column;gap:2px;min-width:0}
${P} .c-no{font:700 11px/1 ${MONO};letter-spacing:.14em;--ink:var(--acc)}
${P} .c-no::before{content:counter(trk,decimal-leading-zero)}
${P} .c-ti{font:700 16.5px/1.3 ${SANS};word-break:keep-all;overflow-wrap:anywhere}
${P} .c-sub{display:flex!important;flex-wrap:wrap;align-items:baseline;gap:4px 8px;font:500 12.5px/1.3 ${SANS};--ink:var(--mute)}
${P} .c-who{display:inline-flex;align-items:center;gap:5px;font-weight:700;--ink:#e6e7ec}
${P} .c-who::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--c)}
${P} .c-en{--ink:var(--mute)}
${P} .c-open{display:grid!important;place-items:center;padding:7px 11px!important;border-radius:999px;box-shadow:inset 0 0 0 1px var(--line);font:700 12px/1 ${SANS};cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}
${P} .c-open > *{grid-area:1/1}
${P} .c-k{-webkit-appearance:none;appearance:none;display:block;width:1px;height:1px;margin:0!important;padding:0!important;border:0!important;outline:0;background:transparent!important}
${P} .c-open:has(.c-k:focus-visible){box-shadow:inset 0 0 0 2px var(--acc)}
${P} .c-o2{visibility:hidden}
${P} .c-song:has(.c-k:checked) .c-o1{visibility:hidden}
${P} .c-song:has(.c-k:checked) .c-o2{visibility:visible}
${P} .c-song:has(.c-k:checked) .c-open{background:var(--acc)!important;--ink:#121318;box-shadow:none}
${P} .c-song:not(:has(.c-more img)) .c-open{display:none!important}
/* mp3 칸(몇 개든 auto-fit) */
${P} .c-aus{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;padding-left:76px!important}
${P} .c-pl{display:flex!important;flex-direction:column;gap:5px;min-width:0}
${P} .c-key{font:800 11.5px/1 ${MONO};letter-spacing:.08em;--ink:var(--acc)}
${audioCss(P, '.c-pl', 40)}
${P} .c-song .c-pl audio::-webkit-media-controls-enclosure{background:#ffffff14}
/* 펼친 그림(누르기 전엔 접힘) */
${P} .c-more{display:none!important}
${P} .c-song:has(.c-k:checked) .c-more{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;align-items:start;margin-top:4px!important}
${P} .c-more .land{grid-column:span 2}
${photoCss(P, 'c-ph', '#0a0b0e', 'scn')}
${P} .c-more .c-ph{border-radius:8px}
${P} .c-ph::after{content:counter(scn,decimal-leading-zero);grid-area:1/1;justify-self:end;align-self:start;margin:6px 6px 0 0;padding:3px 6px 2px;border-radius:5px;background:#000a;font:700 10px/1 ${MONO};letter-spacing:.08em;color:var(--acc);-webkit-text-fill-color:var(--acc);pointer-events:none}
@container (max-width:420px){
${P} .c-aus{padding-left:0!important}
}
@container (min-width:640px){
${P} .c-box{padding:26px 22px 14px!important}
${P} .c-row{grid-template-columns:76px minmax(0,1fr) auto;gap:16px}
${P} .c-th,${P} .c-th .c-ph{width:76px}
${P} .c-th .c-ph{height:76px}
${P} .c-aus{padding-left:92px!important}
${P} .c-song:has(.c-k:checked) .c-more{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding-left:92px!important}
${P} .c-ti{font-size:18px}
}`.trim());
  const html = `${GUIDE('플레이리스트', '  · 줄 왼쪽 작은 그림이 그 곡 메인 그림이에요. 「그림 ▾」를 누르면 그 곡 그림(<div class="c-more">)이 펼쳐져요 — 그림 칸(<div class="c-ph …">…</div>)을 복사해 더해요. 그림이 없으면 단추도 숨어요.')}
<div class="sgt3"><style>
${css}
</style>
<div class="c-box">
<div class="c-head"><p class="c-kick">PLAYLIST</p><p class="c-pt">플레이리스트 제목</p><p class="c-pin">${PIN}</p></div>
<div class="c-list">
${songs.map(song).join(`\n${memo}\n`)}
</div>
</div>
</div>
`;
  return { html, css };
}

const KINDS = [['1', '다크앨범', album], ['2', '밝은싱글', single], ['3', '플레이리스트', playlist]];
module.exports = { album, single, playlist, KINDS, SONGS, forbidden, wordsBad, IMG, AUD };
if (require.main === module) {
  const OUT = process.env.SG_OUT || path.join(require('os').tmpdir(), 'song-templates');
  fs.mkdirSync(OUT, { recursive: true });
  for (const [k, name, fn] of KINDS) {
    const outs = [['견본', SONGS], ['한곡', VARIANTS.one], ['일곱곡', VARIANTS.seven]].map(([tag, ss]) => ({ tag, ss, ...fn(ss) }));
    for (const o of outs) {
      const file = path.join(OUT, `노래틀-${k}-${name}-${o.tag}.html`);
      fs.writeFileSync(file, o.html, 'utf8');
      const bare = o.html.replace(/<!--[\s\S]*?-->/g, '');
      const imgs = (bare.match(/<img /g) || []).length, aus = (bare.match(/<audio /g) || []).length;
      const wantImg = o.ss.reduce((a, s) => a + 1 + s.pics.length, 0), wantAu = o.ss.reduce((a, s) => a + s.au.length, 0);
      console.log(JSON.stringify({ k, name, tag: o.tag, songs: o.ss.length, imgs, okImgs: imgs === wantImg, aus, okAus: aus === wantAu, sameCss: o.css === outs[0].css, ids: (o.html.match(/ (id|for|name)="/g) || []).length, forbidden: forbidden(o.html), words: wordsBad(o.html), personal: /Lucifer|Michael|Satan|Gabriel|Zadkiel|Uriel|Asmodeus|천지/.test(o.html), bytes: Buffer.byteLength(o.html) }));
    }
  }
}
