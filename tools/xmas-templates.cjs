// 연말 · 크리스마스 커뮤니티 글 틀 3종(누구나 쓰는 판) — 크리스마스 화보 · 연말 결산 앨범 · 캐롤 플레이리스트. node tools/xmas-templates.cjs  (견본 판 + 사진 · 곡 수를 바꾼 판을 찍어요)
// 바탕: 화보 갤러리(tools/hwabo-templates.cjs) · 노래 앨범(tools/song-templates.cjs)과 같은 방식이에요. 견본 사진은 mart/data/sample/hwabo, 견본 mp3 는 mart/data/sample/song.
// 사진 · 곡 · 달 수가 달라도 깨지지 않게: CSS 는 수와 상관없이 같아요(장 차례 :nth-child · 마지막 장 :last-child · 번호 · 합계는 counter).
//   쓰는 사람은 장 · 달 · 곡 · 사진 블록을 복사하거나 지우기만 하면 돼요.
// 깡싸 규칙(인수인계 4-1 · 4-2 · 11-09 추가): 진짜 <img>(첨부 목록) · <audio class="uploaded-audio"> · 사이트 번호표 숨김 · height:% 옆에 block-size ·
//   넘김은 name 없는 체크박스 사슬(체크박스는 label 안 — id/for 없음) · 넘침 자르기는 overflow 에 clip-path:inset(0) 를 같이 ·
//   position:fixed · contenteditable · blob: · script 없음 · 화면에 「원곡 · 커버 · 가수 · AI」 없음 · 떠 있는 판(absolute + z-index) 없음.
// require 하면 { gallery, recap, carol, KINDS, forbidden, wordsBad }
const fs = require('fs');
const path = require('path');
const ROOT_URL = process.env.XM_BASE || 'https://kgangkgang.github.io/blue-lemonade/mart/data/sample/';
const IMG = ROOT_URL + 'hwabo/', AUD = ROOT_URL + 'song/';

// ── 견본 ──
const CAST = [['Aster', '#79A9D8'], ['Blair', '#e9b949'], ['Cyan', '#3ccfbf'], ['Dahlia', '#ff5fa2'], ['Eden', '#7fbf3c'], ['Fern', '#b799e8']];
const SAY = ['여기에 사진 코멘트를 적어요.', '코멘트 칸이에요. 글이 길어지면 칸도 같이 늘어나요.', '마음에 드는 한 장에 한마디를 붙여요.', '필요 없으면 이 줄은 지워도 돼요.'];
// 11-10 다듬기: 내 글(코멘트)은 꾸미지 않아요 — 틀 밖 맨 위에 그냥 적게 주석으로만 알려요(화면에 안내 글 없음)
const PIN_NOTE = '<!-- 내 글(코멘트)은 이 줄 위에 그냥 적어요 — 틀이 꾸미지 않아요 -->';
const { finish } = require('./geulkku-polish/post.cjs');
const two = i => String(i).padStart(2, '0');
const isLand = n => n % 7 === 0;
const srcOf = n => isLand(n) ? `${IMG}l${(Math.floor(n / 7) - 1) % 2 + 1}.svg` : `${IMG}p${two((n - 1) % 12 + 1)}.svg`;
const who = n => (n - 1) % CAST.length;
const nameOf = n => CAST[who(n)][0];
const cc = n => `c${who(n) + 1}`;
const img = (n, eager) => `<!-- 견본 --><img src="${srcOf(n)}" width="${isLand(n) ? 1216 : 832}" height="${isLand(n) ? 832 : 1216}" alt="업로드 이미지" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
const imgK = (k, eager) => `<!-- 견본 --><img src="${IMG}${k}.svg" width="${k[0] === 'l' ? 1216 : 832}" height="${k[0] === 'l' ? 832 : 1216}" alt="업로드 이미지" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;

// 11-10 밤 소리 카드 확정 조합(사용자 「오 5번 좋다」 · 「딱 저 검은 선에만」 · 「오 점 세개 잘라내기 되는구나」 — 인수인계-커뮤니티-글꾸 0-4절 「재생 막대는 거의 다 꾸밀 수 있어요」):
//   이름표 + 막대 한 줄 · 막대 26px · 알약 바탕 투명 · 선에만 곡 색(단색 필터) · 선 굵기는 PC · 폰 모두 1배(11-10 밤 사용자 「PC 그대로 1배가 나을듯 나머진 다 너무 이상해진다 재생했을때」 — PC 전용 scaleY 규칙 뺌) · 스피커 가운데 정렬 지정 · 점 세 개(⋮)는 브라우저 기본 그대로 보여요(사용자 「그냥 점 세개 보이게해」 — 잘라 내던 overflow:clip 칸 · 오른쪽 -30px 뺌) · 단추 색은 그대로.
//   깡통은 기본이 어두운 판이라 밝은 틀은 인라인 color-scheme:light 를 꼭 적어요 · 어두운 틀은 dark. zoom · 색 입히기 filter · mix-blend-mode 는 audio 에 쓰지 않아요.
const AUDIO_INLINE = dark => `height:26px;block-size:26px;flex:1 1 auto;min-width:0;width:auto;max-width:100%;margin:0!important;color-scheme:${dark ? 'dark' : 'light'}`;
const audio = (k, dark = false) => `<!-- 견본 mp3 --><audio src="${AUD}${k}.mp3" controls="" preload="metadata" class="uploaded-audio" style="${AUDIO_INLINE(dark)}"></audio>`;
/** 진행 선 색 필터 — 실측 두 점(민트 #3ccfbf → hue-rotate 118 · brightness .92 / 분홍 #ff5fa2 → 285 · 1.05)에 맞춘 계산: 세피아 바탕 색상(약 53°)에서 그 색의 색상까지 돌리고, 밝기는 색의 명도(HSL L)에 비례. 무채에 가까운 색은 필터 없이 */
const lineFilter = (hex) => {
  const m = /^#?([0-9a-f]{6})/i.exec(String(hex || '')); if (!m) return '';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, L = (mx + mn) / 2;
  if (d < 0.08) return '';
  const H = (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  const rot = Math.round(((H - 53) % 360 + 360) % 360), br = Math.min(1.15, Math.max(0.8, 0.52 + 0.765 * L));
  return `invert(${L >= 0.6 ? '.5' : '.55'}) sepia(1) saturate(9) hue-rotate(${rot}deg) brightness(${Number(br.toFixed(2))})`;
};
/** 곡 색(t1~t6)마다 진행 선 색 — accs: 곡 색 목록 */
const timelineCss = (P, accs) => accs.map((c, i) => { const f = lineFilter(c); return f ? `${P} .t${i + 1} audio::-webkit-media-controls-timeline{filter:${f}!important}` : ''; }).filter(Boolean).join('\n');
const SANS = 'Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const SERIF = '"Noto Serif KR","Apple SD Gothic Neo","Nanum Myeongjo",Georgia,serif';
const DIDOT = '"Didot","Bodoni 72","Bodoni MT","Playfair Display",Georgia,"Noto Serif KR",serif';
const MONO = 'ui-monospace,"SFMono-Regular","Cascadia Mono",Menlo,Consolas,monospace';
const HAND = '"Segoe Script","Brush Script MT","Snell Roundhand",cursive';
const colorsCss = P => `/* ▼ 캐릭터 색 — c1~c6 의 색을 바꾸거나, 줄을 복사해 c7 · c8 … 을 더해요 */\n${CAST.map(([, c], i) => `${P} .c${i + 1}{--c:${c}}`).join('\n')}\n/* ▲ 캐릭터 색 */`;
const toneCss = (P, tones) => `/* ▼ 곡 색 — 곡 블록 class 의 t1~t6 을 고르거나, 이 줄의 값을 바꿔요(줄을 복사해 t7 … 도 돼요) */\n${tones.map((v, i) => `${P} .t${i + 1}{--acc:${v}}`).join('\n')}\n/* ▲ 곡 색 */`;
// 사이트 맞춤(4-1 · 4-2): 진짜 img · 사이트가 감싸는 wrapper · 번호표 숨김 · 넘침은 clip-path 로도
const photoCss = (P, ph, bg, cnt) => `
${P} .${ph}{display:grid!important;grid-template-columns:100%;grid-template-rows:100%;width:100%;aspect-ratio:832/1216;overflow:hidden;clip-path:inset(0);background:${bg}!important;${cnt ? `counter-increment:${cnt};` : ''}line-height:0}
${P} .${ph}.land{aspect-ratio:1216/832}
${P} .${ph} > *{grid-area:1/1!important;min-width:0;min-height:0}
${P} .${ph} > img,${P} .${ph} > .image-number-wrapper,${P} .${ph} :has(> img):not(.${ph}){display:block!important;position:static!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;line-height:0!important}
${P} .${ph} img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:contain!important;object-position:50% 50%!important;margin:0!important;border:0!important;opacity:1!important}
${P} .${ph} > :not(img):not(.image-number-wrapper):not(:has(img)){display:none!important}
${P} .image-number-badge{display:none!important}`;
const audioCss = (P, sel) => `
${P} ${sel}{display:flex!important;align-items:center;gap:6px;min-width:0}
${P} ${sel} > audio{display:block;flex:1 1 auto;min-width:0;max-width:100%;background:transparent;outline:none}
${P} audio::-webkit-media-controls-panel,${P} audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
${P} audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
${P} audio::-webkit-media-controls-play-button,${P} audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
${P} audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
${P} audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
${P} audio::-webkit-media-controls-current-time-display,${P} audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}`;
const baseCss = (P, ink, extra) => `
${P}{${ink}display:block!important;box-sizing:border-box;container-type:inline-size;margin:14px auto!important;padding:0!important;border:0!important;background:transparent!important;font-family:${SANS};line-height:1.55;text-align:left;-webkit-text-size-adjust:100%;${extra}}
${P},${P} *{color:var(--ink)!important;-webkit-text-fill-color:var(--ink)!important;box-sizing:border-box}
${P} div{background-color:transparent!important;border:0;margin:0;padding:0}
${P} p{margin:0!important;padding:0!important;text-align:inherit}
${P} label{margin:0;padding:0}
${P} b{font-weight:700}`;
// 정화기가 height:% 를 auto 로 바꿔도 남게 — 같은 값의 block-size 를 바로 뒤에
const fixH = css => css.replace(/(^|[;{])height:([\d.]+%)(!important)?/g, (m, a, v, imp = '') => `${a}height:${v}${imp};block-size:${v}${imp}`);
const forbidden = out => ['position:fixed', 'contenteditable', 'blob:', '<script'].filter(k => out.includes(k))
  .concat(/<[a-z]+[^>]* name=/i.test(out) ? ['name='] : [])
  .concat(/ (id|for)="/.test(out) ? ['id/for'] : [])
  .concat(/(^|[;{\s])height:\s*[\d.]+%(?!(!important)?;block-size)/.test(out) ? ['height% 단독'] : [])
  .concat((out.match(/\{[^{}]*\}/g) || []).some(b => /overflow(-x|-y)?:(hidden|auto|scroll)/.test(b) && !/clip-path:/.test(b)) ? ['overflow 만(clip-path 없음)'] : []);
const shown = out => out.replace(/<!--[\s\S]*?-->/g, '').replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
const wordsBad = out => ['원곡', '커버', '가수', '생활' + '기록부'].filter(k => shown(out).includes(k)).concat(/\bAI\b/.test(shown(out)) ? ['AI'] : []);
const GUIDE = (title, extra) => `<!-- 블루레몬에이드 글꾸 마트 · 연말 · 크리스마스 「${title}」
  · 사진: 「견본」 표시가 붙은 <img src="…"> 의 주소를 내 사진 주소로 바꿔요(깡싸는 글에 올린 그림 주소 — 그래야 첨부파일 목록에도 떠요). 가로 사진 칸은 class 에 land 가 붙어 있어요.
  · 이름 · 코멘트 · 제목: 보이는 글자는 전부 바꿔도 돼요. 캐릭터 색은 <style> 맨 위 「캐릭터 색」 줄(c1~c6)에서 바꿔요.
${extra}
  · 이런 주석은 지워도 모양이 그대로예요. 스크립트 없이 체크박스 · label 로만 움직여요. -->`;
// 체크박스 사슬(radio name · id/for 없이): k(n) 체크 = n번째 장을 넘김. n번째 장 표시 = k(n-1) 체크 && k(n) 미체크.
const SN = (P, k, n) => n === 1 ? `${P}:not(:has(.${k}1:checked))` : `${P}:has(.${k}${n - 1}:checked):not(:has(.${k}${n}:checked))`;
const LAST = (sel, n) => `:has(${sel}:nth-child(${n}):last-child)`;

// ════════ 1. 크리스마스 화보 ════════ 밤하늘 눈 · 꼬마전구 줄 · 금빛 액자 한 장씩(두 장 · 가로 장) · 위 단추와 「03 / 12」
function gallery(N = 12) {
  const P = '.xmt1.xmt1.xmt1', MAX = 40, K = 'xk';
  const ph = (n, eager) => `<div class="x-ph${isLand(n) ? ' land' : ''}">${img(n, eager)}</div>`;
  let si = 0;
  const cap = ns => `<p class="x-cap">${[...new Set(ns.map(nameOf))].map(nm => `<span class="x-who ${cc(ns.find(n => nameOf(n) === nm))}"><span class="x-dot"></span>${nm}</span>`).join('')}</p>`;
  const say = () => `<p class="x-say">${SAY[si++ % SAY.length]}</p>`;
  // 장 차례: 한 장 · 두 장 · 한 장(코멘트) … 가로 사진은 혼자 한 장
  const S = []; let n = 1, r = 0;
  while (n <= N) {
    if (isLand(n) || r % 3 !== 1 || n === N || isLand(n + 1)) { S.push([n]); n++; } else { S.push([n, n + 1]); n += 2; }
    r++;
  }
  if (S.length > MAX) throw new Error('장이 너무 많아요');
  const slides = S.map((ns, i) => `<!-- ▼ 장 시작 — 장을 늘리려면 「장 시작」부터 「장 끝」까지 통째로 복사해 바로 뒤에 붙여요(${MAX}장까지) · 한 장에 사진 두 장은 x-duo -->
<div class="x-sl"><div class="x-fr${ns.length > 1 ? ' x-duo' : ''}">${ns.map(k => ph(k, i === 0)).join('')}</div>${cap(ns)}${i % 2 === 0 ? say() : ''}</div>
<!-- ▲ 장 끝 -->`).join('\n');
  const SL = '.x-book > .x-sl';
  const state = Array.from({ length: MAX }, (_, k) => {
    const i = k + 1, s = SN(P, K, i), out = [`${s} ${SL}:nth-child(${i}){visibility:visible;max-height:none;overflow:visible;clip-path:none;animation:xm1in .55s cubic-bezier(.3,.1,.2,1) both}`, `${s} .x-cur::before{content:"${two(i)}"}`];
    if (i < MAX) out.push(`${s}:not(${LAST(SL, i)}) .x-t${i}{display:inline-flex;grid-column:3;justify-self:end;background:#c8323a!important;--ink:#fff7ea;box-shadow:none}`, `${s} .x-t${i} .x-pv{display:none}`);
    out.push(`${s}${LAST(SL, i)} .x-oN{display:inline-flex;grid-column:3;justify-self:end}`);
    out.push(i > 1 ? `${s} .x-t${i - 1}{display:inline-flex;grid-column:1;justify-self:start}\n${s} .x-t${i - 1} .x-nx{display:none}` : `${s} .x-o0{display:inline-flex;grid-column:1;justify-self:start}`);
    out.push(`${P}${LAST(SL, i)} .x-tot::before{content:"${two(i)}"}`);
    return out.join('\n');
  }).join('\n');
  const bulbs = Array.from({ length: 11 }, () => '<span class="x-b"></span>').join('');
  const css = fixH(`${baseCss(P, '--ink:#f4f1ea;--mute:#b9c3d8;--gold:#e9c46a;--red:#c8323a;', 'max-width:820px;color-scheme:dark')}
${colorsCss(P)}
${P} .x-box{display:block!important;border-radius:22px;overflow:hidden;clip-path:inset(0 round 22px);background:#0e1a33!important;background-image:radial-gradient(circle,#ffffffd9 0 1.2px,transparent 1.8px),radial-gradient(circle,#ffffff8c 0 1px,transparent 1.6px),linear-gradient(180deg,#0b1430,#15284d 60%,#1d3560)!important;background-size:46px 46px,29px 29px,100% 100%!important;background-position:0 0,13px 17px,0 0!important;animation:xm1snow 26s linear infinite}
${P} .x-lights{display:flex!important;justify-content:space-around;align-items:flex-start;height:30px;padding:0 6px!important;border-top:2px solid #2f4a35!important;margin:22px 10px 0!important}
${P} .x-b{display:block;width:10px;height:15px;margin-top:2px;border-radius:50% 50% 46% 46%/40% 40% 60% 60%;background:#ff5a5f;box-shadow:0 0 8px 1px #ff5a5f99;animation:xm1tw 1.8s ease-in-out infinite alternate}
${P} .x-b:nth-child(4n+2){background:#ffd166;box-shadow:0 0 8px 1px #ffd16699;animation-delay:.45s}
${P} .x-b:nth-child(4n+3){background:#4cc9f0;box-shadow:0 0 8px 1px #4cc9f099;animation-delay:.9s}
${P} .x-b:nth-child(4n){background:#7ae582;box-shadow:0 0 8px 1px #7ae58299;animation-delay:1.35s}
${P} .x-head{display:flex!important;flex-direction:column;align-items:center;gap:4px;padding:6px 18px 14px!important;text-align:center}
${P} .x-ti{font:400 clamp(30px,9cqw,52px)/1.1 ${DIDOT};letter-spacing:.01em}
/* 넘김 단추(체크박스를 품은 label) */
${P} .x-ctl{display:grid!important;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin:0 12px!important;padding:8px 10px!important;border-radius:999px;background:#0b1430cc!important;box-shadow:inset 0 0 0 1px #e9c46a40}
${P} .x-t,${P} .x-btn{display:none;grid-row:1;align-items:center;justify-content:center;height:38px;padding:0 16px;border-radius:999px;font:700 13.5px/1 ${SANS};white-space:nowrap;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;box-shadow:inset 0 0 0 1px #ffffff47}
${P} .x-off{opacity:.3;cursor:default}
${P} .x-k{-webkit-appearance:none;appearance:none;display:block;width:0;height:0;margin:0!important;padding:0!important;border:0!important;outline:0;background:transparent!important}
${P} .x-t:has(.x-k:focus-visible){outline:2px solid var(--gold);outline-offset:3px}
${P} .x-ct{grid-column:2;grid-row:1;white-space:nowrap;font:600 13px/1 ${MONO};letter-spacing:.08em;font-variant-numeric:tabular-nums;--ink:var(--mute)}
${P} .x-ct b{--ink:var(--gold)}
${P} .x-tot::before{content:"--"}
/* 장 */
${P} .x-book{counter-reset:xn;display:grid!important;grid-template-columns:100%;padding:14px 12px 18px!important}
${P} .x-sl{grid-area:1/1!important;min-width:0;display:flex!important;flex-direction:column;align-items:center;gap:10px;visibility:hidden;max-height:0;overflow:hidden;clip-path:inset(0)}
${P} .x-fr{display:grid!important;grid-template-columns:100%;width:min(100%,420px);padding:10px!important;border-radius:6px;background:#f7f1e3!important;box-shadow:0 0 0 2px var(--gold),0 0 0 6px #f7f1e3,0 0 0 7px #b8913c,0 10px 14px -8px #000}
${P} .x-fr:has(.land){width:min(100%,640px)}
${P} .x-duo{grid-template-columns:1fr 1fr;gap:8px;width:min(100%,640px)}
${photoCss(P, 'x-ph', '#e9e2d2', 'xn')}
${P} .x-ph::after{content:counter(xn,decimal-leading-zero);grid-area:1/1;justify-self:end;align-self:start;margin:7px 7px 0 0;padding:4px 8px 3px;border-radius:999px;background:#c8323a;font:800 10px/1 ${MONO};letter-spacing:.06em;color:#fff7ea;-webkit-text-fill-color:#fff7ea;box-shadow:0 0 0 2px #fff7ea,0 0 0 3px #c8323a,0 2px 6px #0006;pointer-events:none}
${P} .x-cap{display:flex!important;flex-wrap:wrap;justify-content:center;gap:6px 14px;font:italic 400 17px/1.3 ${DIDOT}}
${P} .x-who{display:inline-flex;align-items:center;gap:7px}
${P} .x-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--c);box-shadow:0 0 0 2px #0b1430,0 0 0 3px var(--c)}
${P} .x-say{display:block!important;max-width:min(100%,520px);padding:10px 14px!important;border-radius:14px 14px 14px 4px;background:#f7f1e3!important;font:500 15px/1.6 ${SANS};word-break:keep-all;overflow-wrap:anywhere;--ink:#2a2420}
${P} .x-foot{display:block!important;padding:0 16px 16px!important;text-align:center;font:400 13px/1.5 ${HAND};--ink:var(--gold)}
/* 장 넘김 상태 */
${state}
@keyframes xm1in{from{transform:translateY(10px) scale(.98);opacity:0}to{transform:none;opacity:1}}
@keyframes xm1tw{from{filter:brightness(.6)}to{filter:brightness(1.25)}}
@keyframes xm1snow{to{background-position:0 460px,13px 307px,0 0}}
@supports not selector(:has(a)){${P} .x-book{gap:18px}${P} .x-sl{grid-area:auto!important;visibility:visible!important;max-height:none!important}${P} .x-ctl{display:none!important}}
@media (prefers-reduced-motion:reduce){${P} .x-box,${P} .x-b,${P} .x-sl{animation:none!important}}
@container (min-width:640px){
${P} .x-book{padding:20px 24px 24px!important}
${P} .x-cap{font-size:19px}
}`.trim());
  const ctl = `<div class="x-ctl">${Array.from({ length: MAX - 1 }, (_, k) => `<label class="x-t x-t${k + 1}"><input type="checkbox" class="x-k ${K}${k + 1}" aria-label="${k + 1}번째 장 넘기기"><span class="x-pv">‹ 이전</span><span class="x-nx">다음 ›</span></label>`).join('')}<span class="x-btn x-off x-o0">‹ 이전</span><span class="x-btn x-off x-oN">다음 ›</span><span class="x-ct"><b class="x-cur"></b> / <span class="x-tot"></span></span></div>`;
  const html = `${GUIDE('크리스마스 화보', `  · 장 더하기: 「▼ 장 시작」~「▲ 장 끝」을 통째로 복사 · 지워요(${MAX}장까지). 한 장에 사진 두 장을 나란히 두려면 x-fr 에 x-duo 를 붙이고 사진 칸(<div class="x-ph">…</div>)을 하나 더 넣어요. 「03 / 12」와 사진 번호는 저절로 맞춰져요.\n  · 위 단추로 넘겨요(폰 · PC 같음).`)}
${PIN_NOTE}
<div class="xmt1"><style>
${css}
</style>
<div class="x-box">
<p class="x-lights">${bulbs}</p>
<div class="x-head"><p class="x-ti">크리스마스 밤</p></div>
${ctl}
<div class="x-book">
${slides}
</div>
</div>
</div>
`;
  return { html: finish(html, '#f4f1ea'), css, pages: S.length };
}

// ════════ 2. 연말 결산 앨범 ════════ 종이 앨범: 올해의 한 장 · 달마다 사진 묶음(달 블록 복사 · 지우기) · 끝에 「사진 NN장 · 달 NN개」 합계가 저절로
const MONTHS = [['01', 'JAN', '새해 첫 장', [2, 3]], ['03', 'MAR', '봄이 오던 날', [4, 5, 6]], ['05', 'MAY', '', [7, 8]], ['08', 'AUG', '여름 끝자락', [9, 10]], ['10', 'OCT', '', [11, 12, 13]], ['12', 'DEC', '올해 마지막 달', [14, 15, 16]]];
function recap(months = MONTHS) {
  const P = '.xmt2.xmt2.xmt2';
  const ph = (n, eager) => `<div class="r-ph${isLand(n) ? ' land' : ''}">${img(n, eager)}</div>`;
  const mo = ([m, en, ti, ns]) => `<!-- ▼ 달 시작 — 달을 더하려면 「달 시작」~「달 끝」을 통째로 복사해요(빈 달은 지워도 돼요) -->
<div class="r-mo"><div class="r-mh"><p class="r-mn">${m}</p><p class="r-me">${en}</p><p class="r-mt">${ti || '한 줄 제목'}</p></div>
<div class="r-grid">${ns.map(n => ph(n)).join('')}</div>
<p class="r-memo">${ti ? '이 달의 메모를 적어요.' : '<br>'}</p></div>
<!-- ▲ 달 끝 -->`;
  const css = fixH(`${baseCss(P, '--ink:#24201b;--mute:#6b6358;--red:#a8272d;--gold:#a4781f;--paper:#fbf8f1;', 'max-width:820px')}
${colorsCss(P)}
${P} .r-box{counter-reset:rph rmo;display:block!important;padding:18px 14px 20px!important;border-radius:18px;background:#efe9dd!important;background-image:radial-gradient(#d9cfbd 1px,transparent 1.4px)!important;background-size:16px 16px!important;box-shadow:inset 0 0 0 1px #e1d8c6}
${P} .r-head{display:flex!important;flex-direction:column;align-items:center;gap:2px;padding:6px 6px 18px!important;text-align:center}
${P} .r-year{font:400 clamp(64px,20cqw,128px)/.9 ${DIDOT};letter-spacing:-.02em;--ink:#24201b}
${P} .r-ti{font:700 18px/1.4 ${SERIF};letter-spacing:.2em;margin-top:2px!important}
/* 올해의 한 장 */
${P} .r-best{display:flex!important;flex-direction:column;align-items:center;gap:10px;margin:0 auto 22px!important;padding:14px 14px 16px!important;max-width:460px;background:var(--paper)!important;border-radius:4px;box-shadow:0 2px 0 #0000000d,0 16px 30px -14px #0000005c;transform:rotate(-1deg)}
${P} .r-lb{display:inline-flex!important;align-items:center;gap:6px;padding:5px 12px 4px!important;border-radius:999px;background:var(--red)!important;font:800 12px/1 ${SANS};letter-spacing:.18em;--ink:#fff7ea}
${P} .r-best .r-ph{width:100%}
${P} .r-cap{font:400 18px/1.35 ${HAND};text-align:center;--ink:#3b3530}
/* 달 */
${P} .r-months{display:flex!important;flex-direction:column;gap:18px}
${P} .r-mo{display:flex!important;flex-direction:column;gap:10px;padding:14px 12px 12px!important;border-radius:12px;background:var(--paper)!important;box-shadow:0 1px 0 #0000000d,0 10px 22px -14px #00000052;counter-increment:rmo}
${P} .r-mh{display:flex!important;align-items:baseline;gap:10px;padding-bottom:8px!important;border-bottom:1px solid #24201b26!important;min-width:0}
${P} .r-mn{font:400 40px/1 ${DIDOT};--ink:var(--red)}
${P} .r-me{font:700 11px/1 ${MONO};letter-spacing:.24em;--ink:var(--mute)}
${P} .r-mt{margin-left:auto!important;min-width:0;font:700 14.5px/1.35 ${SANS};text-align:right;word-break:keep-all;overflow-wrap:anywhere}
${P} .r-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:start}
${P} .r-grid .land{grid-column:span 2}
${P} .r-memo{display:block!important;min-height:1.6em;font:400 14.5px/1.65 ${SANS};word-break:keep-all;overflow-wrap:anywhere;--ink:#4a4239}
${photoCss(P, 'r-ph', '#e6dfd1', 'rph')}
${P} .r-ph{border-radius:4px}
${P} .r-ph::after{content:counter(rph,decimal-leading-zero);grid-area:1/1;justify-self:end;align-self:start;margin:6px 6px 0 0;padding:3px 7px 2px;border-radius:4px;background:#fbf8f1e6;font:700 10px/1 ${MONO};letter-spacing:.08em;color:#a8272d;-webkit-text-fill-color:#a8272d;box-shadow:0 1px 4px #0003;pointer-events:none}
/* 끝 — 합계(달 · 사진 수를 세어 저절로) */
${P} .r-end{display:flex!important;flex-direction:column;align-items:center;gap:8px;margin-top:22px!important;padding:18px 14px!important;border-radius:12px;background:#24201b!important;text-align:center;--ink:#f6efe2}
${P} .r-sum{display:flex!important;flex-wrap:wrap;justify-content:center;gap:8px 18px;font:600 13px/1.4 ${MONO};letter-spacing:.1em;--ink:#e9c46a}
${P} .r-sum b{font:400 30px/1 ${DIDOT};letter-spacing:0;margin-right:4px;--ink:#fff7ea}
${P} .r-np::before{content:counter(rph)}
${P} .r-nm::before{content:counter(rmo)}
${P} .r-bye{font:700 16px/1.5 ${SERIF};letter-spacing:.08em}
@container (min-width:640px){
${P} .r-box{padding:26px 26px 28px!important}
${P} .r-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
${P} .r-grid .land{grid-column:span 2}
${P} .r-mo{padding:18px 18px 14px!important}
}`.trim());
  const html = `${GUIDE('연말 결산 앨범', '  · 달 더하기 · 빼기: 「▼ 달 시작」~「▲ 달 끝」을 통째로 복사 · 지워요. 달 숫자 · 영문 · 한 줄 제목은 글자만 바꿔요. 사진 칸(<div class="r-ph">…</div>)을 복사하면 사진이 늘어요.\n  · 맨 아래 「사진 NN장 · 달 NN개」와 사진 번호는 저절로 세어져요. 맨 위 「올해의 한 장」 사진도 함께 세어요.')}
${PIN_NOTE}
<div class="xmt2"><style>
${css}
</style>
<div class="r-box">
<div class="r-head"><p class="r-year">2026</p><p class="r-ti">올해의 앨범</p></div>
<div class="r-best"><p class="r-lb">★ 올해의 한 장</p>${ph(1, true)}<p class="r-cap">한 줄 소감을 적어요</p></div>
<div class="r-months">
${months.map(mo).join('\n')}
</div>
<div class="r-end"><p class="r-sum"><span><b class="r-np"></b>장의 사진</span><span><b class="r-nm"></b>달의 기록</span></p><p class="r-bye">올해도 고마웠어요 · 내년에도 잘 부탁해요</p></div>
</div>
</div>
`;
  return { html: finish(html, '#24201b'), css };
}

// ════════ 3. 캐롤 플레이리스트 ════════ 전나무 밤 · 사탕 줄무늬 띠 · 도는 레코드 · 곡 줄(작은 그림 · 번호 · 제목 · 칩 · mp3) · 「그림 ▾」를 누르면 그 곡 그림이 펼쳐져요
const SONGS = [
  { ti: '첫 번째 캐롤', en: 'Carol One', ch: [0], t: 1, main: 'p01', pics: ['p02', 'p03', 'l1'], au: [['', 's1']] },
  { ti: '두 번째 캐롤', en: 'Carol Two', ch: [1], t: 2, main: 'p06', pics: ['p07', 'p08'], au: [['ver. A', 's2'], ['ver. B', 's3']] },
  { ti: '세 번째 캐롤 — 듀엣', en: 'Duet Carol', ch: [2, 3], t: 3, main: 'p09', pics: ['p10', 'p11', 'p12'], au: [['', 's3']] },
  { ti: '네 번째 캐롤', en: 'Carol Four', ch: [4], t: 4, main: 'p05', pics: [], au: [['', 's1']] },
];
const VARIANTS = {
  one: [{ ti: '혼자 남은 캐롤', en: 'Only Carol', ch: [5], t: 5, main: 'l2', pics: ['p04'], au: [['ver. A', 's1'], ['ver. B', 's2'], ['ver. C', 's3']] }],
  seven: Array.from({ length: 7 }, (_, i) => ({ ...SONGS[i % 4], ti: `캐롤 ${i + 1}`, t: i % 6 + 1, pics: SONGS[i % 4].pics.slice(0, i) })),
};
function carol(songs = SONGS) {
  const P = '.xmt3.xmt3.xmt3';
  const ph = (k, eager) => `<div class="k-ph${k[0] === 'l' ? ' land' : ''}">${imgK(k, eager)}</div>`;
  const song = (s, i) => `<!-- ▼ 곡 시작 -->
<div class="k-song t${s.t}">
<div class="k-row"><div class="k-th">${ph(s.main, i < 3)}</div><div class="k-meta"><p class="k-no"></p><p class="k-ti">${s.ti}</p><p class="k-sub">${s.ch.map(j => `<span class="k-who c${j + 1}">${CAST[j][0]}</span>`).join('')}<span class="k-en">${s.en}</span></p></div>
<label class="k-open"><input type="checkbox" class="k-k" aria-label="그림 펼치기"><span class="k-o1">그림 ▾</span><span class="k-o2">접기 ▴</span></label></div>
<div class="k-aus">${s.au.map(([key, a]) => `<div class="k-pl">${key ? `<p class="k-key">${key}</p>` : ''}${audio(a, true)}</div>`).join('')}</div>
<div class="k-more">${s.pics.map(k => ph(k)).join('')}</div>
</div>
<!-- ▲ 곡 끝 -->`;
  const memo = '<!-- 곡 사이 코멘트 칸 --><p class="k-memo"><br></p>';
  const css = fixH(`${baseCss(P, '--ink:#f4efe2;--mute:#b5c7ba;--acc:#e8c766;--line:#ffffff1c;', 'max-width:760px;color-scheme:dark')}
${toneCss(P, ['#ff8a8a', '#e8c766', '#7fe0c8', '#ff9ccf', '#a8e07a', '#c9b0ff'])}
${colorsCss(P)}
${P} .k-box{display:block!important;border-radius:20px;overflow:hidden;clip-path:inset(0 round 20px);background:#0f2a1f!important;background-image:radial-gradient(circle,#ffffff2e 0 1px,transparent 1.6px),linear-gradient(180deg,#14382a,#0f2a1f 280px)!important;background-size:22px 22px,100% 100%!important}
${P} .k-stripe{display:block!important;height:12px;background:repeating-linear-gradient(-45deg,#c8323a 0 10px,#fbf4e6 10px 20px,#2f7d4f 20px 30px,#fbf4e6 30px 40px)!important}
${P} .k-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 14px;padding:18px 16px 14px!important}
${P} .k-ht{display:flex!important;flex-direction:column;gap:4px;min-width:0}
${P} .k-pt{font:800 clamp(24px,7cqw,38px)/1.15 ${SANS};letter-spacing:-.01em;word-break:keep-all}
${P} .k-vinyl{display:block;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle,#c8323a 0 9px,#fbf4e6 9.5px 11px,#c8323a 11.5px 17px,transparent 17.5px),repeating-radial-gradient(circle,#111 0 2px,#262626 2px 3px)!important;box-shadow:0 0 0 2px #e8c76699;animation:xm3spin 6s linear infinite}
${P} .k-list{display:flex!important;flex-direction:column;counter-reset:ktrk;margin:0 10px!important;border-top:1px solid var(--line)!important}
${P} .k-memo{display:block!important;min-height:2.2em;margin:0 6px!important;padding:6px 4px!important;font:400 14.5px/1.7 ${SANS};white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;--ink:#dfe7df}
/* 곡 줄 */
${P} .k-song{display:flex!important;flex-direction:column;gap:10px;padding:12px 6px 14px!important;border-bottom:1px dashed #e8c76640!important;counter-increment:ktrk;counter-reset:kscn}
${P} .k-row{display:grid!important;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:12px}
${P} .k-th{display:block!important;width:64px;border-radius:50%;box-shadow:0 0 0 2px var(--acc),0 6px 14px -6px #000}
${P} .k-th .k-ph{width:64px;height:64px;aspect-ratio:auto;counter-increment:none}
${P} .k-th .k-ph::after{display:none}
${P} .k-th .k-ph{border-radius:50%;clip-path:circle(50%)}
${P} .k-th .k-ph img{object-fit:cover!important;border-radius:50%!important}
${P} .k-meta{display:flex!important;flex-direction:column;gap:2px;min-width:0}
${P} .k-no{font:700 11px/1 ${MONO};letter-spacing:.14em;--ink:var(--acc)}
${P} .k-no::before{content:"♪ " counter(ktrk,decimal-leading-zero)}
${P} .k-ti{font:700 16.5px/1.3 ${SANS};word-break:keep-all;overflow-wrap:anywhere}
${P} .k-sub{display:flex!important;flex-wrap:wrap;align-items:baseline;gap:4px 8px;font:500 12.5px/1.3 ${SANS};--ink:var(--mute)}
${P} .k-who{display:inline-flex;align-items:center;gap:5px;font-weight:700;--ink:#eef3ea}
${P} .k-who::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--c)}
${P} .k-en{--ink:var(--mute)}
${P} .k-open{display:grid!important;place-items:center;padding:7px 11px!important;border-radius:999px;box-shadow:inset 0 0 0 1px #e8c76666;font:700 12px/1 ${SANS};cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}
${P} .k-open > *{grid-area:1/1}
${P} .k-k{-webkit-appearance:none;appearance:none;display:block;width:1px;height:1px;margin:0!important;padding:0!important;border:0!important;outline:0;background:transparent!important}
${P} .k-open:has(.k-k:focus-visible){box-shadow:inset 0 0 0 2px var(--acc)}
${P} .k-o2{visibility:hidden}
${P} .k-song:has(.k-k:checked) .k-o1{visibility:hidden}
${P} .k-song:has(.k-k:checked) .k-o2{visibility:visible}
${P} .k-song:has(.k-k:checked) .k-open{background:var(--acc)!important;--ink:#0f2a1f;box-shadow:none}
${P} .k-song:not(:has(.k-more img)) .k-open{display:none!important}
/* mp3 칸(몇 개든 auto-fit) */
${P} .k-aus{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;padding-left:76px!important}
${P} .k-key{flex:0 0 auto}
${P} .k-key{font:800 10.5px/1 ${MONO};letter-spacing:.08em;--ink:var(--acc)}
${audioCss(P, '.k-pl')}
${timelineCss(P, ['#ff8a8a', '#e8c766', '#7fe0c8', '#ff9ccf', '#a8e07a', '#c9b0ff'])}
/* 펼친 그림 */
${P} .k-more{display:none!important}
${P} .k-song:has(.k-k:checked) .k-more{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;align-items:start;margin-top:4px!important}
${P} .k-more .land{grid-column:span 2}
${photoCss(P, 'k-ph', '#0a1c14', 'kscn')}
${P} .k-more .k-ph{border-radius:8px}
${P} .k-ph::after{content:counter(kscn,decimal-leading-zero);grid-area:1/1;justify-self:end;align-self:start;margin:6px 6px 0 0;padding:3px 6px 2px;border-radius:5px;background:#000a;font:700 10px/1 ${MONO};letter-spacing:.08em;color:var(--acc);-webkit-text-fill-color:var(--acc);pointer-events:none}
${P} .k-foot{display:block!important;padding:14px 16px 18px!important;text-align:center;font:700 12px/1.4 ${MONO};letter-spacing:.24em;--ink:var(--acc)}
@keyframes xm3spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){${P} .k-vinyl{animation:none!important}}
@container (max-width:420px){
${P} .k-aus{padding-left:0!important}
}
@container (min-width:640px){
${P} .k-head{padding:24px 24px 16px!important}
${P} .k-list{margin:0 16px!important}
${P} .k-row{grid-template-columns:76px minmax(0,1fr) auto;gap:16px}
${P} .k-th,${P} .k-th .k-ph{width:76px}
${P} .k-th .k-ph{height:76px}
${P} .k-aus{padding-left:92px!important}
${P} .k-song:has(.k-k:checked) .k-more{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding-left:92px!important}
${P} .k-ti{font-size:18px}
}`.trim());
  const html = `${GUIDE('캐롤 플레이리스트', `  · mp3: 「견본 mp3」 표시가 붙은 <audio src="…"> 의 주소를 내 mp3 주소로 바꿔요(깡싸는 한 글에 mp3 10개까지). 한 곡에 mp3 를 여럿 두려면 mp3 칸을 복사해요.
  · 곡 더하기 · 빼기: 「▼ 곡 시작」~「▲ 곡 끝」을 통째로 복사 · 지워요. 트랙 번호와 그림 번호는 저절로 매겨져요. 곡 색은 곡 블록 class 의 t1~t6.
  · 줄 왼쪽 동그란 그림이 그 곡 메인 그림이에요. 「그림 ▾」를 누르면 그 곡 그림(<div class="k-more">)이 펼쳐져요. 그림이 없으면 단추도 숨어요. 곡 사이 코멘트 칸은 <br> 자리에 적어요.`)}
${PIN_NOTE}
<div class="xmt3"><style>
${css}
</style>
<div class="k-box">
<p class="k-stripe"></p>
<div class="k-head"><div class="k-ht"><p class="k-pt">캐롤 플레이리스트</p></div><span class="k-vinyl"></span></div>
<div class="k-list">
${songs.map(song).join(`\n${memo}\n`)}
</div>
<p class="k-foot">♪</p>
</div>
</div>
`;
  return { html: finish(html, '#f4efe2'), css };
}

const KINDS = [['1', '크리스마스화보', gallery], ['2', '연말결산앨범', recap], ['3', '캐롤플레이리스트', carol]];
module.exports = { gallery, recap, carol, KINDS, SONGS, MONTHS, VARIANTS, forbidden, wordsBad, IMG, AUD };
if (require.main === module) {
  const OUT = process.env.XM_OUT || path.join(require('os').tmpdir(), 'xmas-templates');
  fs.mkdirSync(OUT, { recursive: true });
  const runs = [['1', '크리스마스화보', [['견본', () => gallery()], ['세장', () => gallery(3)], ['서른장', () => gallery(30)]]],
    ['2', '연말결산앨범', [['견본', () => recap()], ['한달', () => recap([MONTHS[0]])], ['열두달', () => recap(Array.from({ length: 12 }, (_, i) => [two(i + 1), 'MON', '', [i + 2, i + 3]]))]]],
    ['3', '캐롤플레이리스트', [['견본', () => carol()], ['한곡', () => carol(VARIANTS.one)], ['일곱곡', () => carol(VARIANTS.seven)]]]];
  for (const [k, name, vs] of runs) {
    const outs = vs.map(([tag, fn]) => ({ tag, ...fn() }));
    for (const o of outs) {
      const file = path.join(OUT, `연말틀-${k}-${name}-${o.tag}.html`);
      fs.writeFileSync(file, o.html, 'utf8');
      const bare = o.html.replace(/<!--[\s\S]*?-->/g, '');
      console.log(JSON.stringify({ k, name, tag: o.tag, imgs: (bare.match(/<img /g) || []).length, aus: (bare.match(/<audio /g) || []).length, sameCss: o.css === outs[0].css, forbidden: forbidden(o.html), words: wordsBad(o.html), bytes: Buffer.byteLength(o.html) }));
    }
  }
}
