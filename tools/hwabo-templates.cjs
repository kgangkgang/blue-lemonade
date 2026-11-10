// 화보 갤러리 틀 3종(누구나 쓰는 판) — 책장 넘김 · 스토리 뷰어 · 라이트 테이블. node tools/hwabo-templates.cjs [사진 수…]  (기본 12 30)
// 바탕: 깡싸 화보 글꾸 3종(11-09 · 체크박스 사슬로 넘김). 글 · 캐릭터 이름은 견본 문구로, 사진은 견본 SVG(mart/data/sample/hwabo · tools/hwabo-samples.cjs)로 넣었어요.
// 사진 수가 달라도 깨지지 않게: CSS 는 사진 수 · 쪽 수와 상관없이 같아요(쪽 차례는 :nth-child, 마지막 쪽은 :last-child, 쪽 번호는 counter).
//   그래서 쓰는 사람은 사진 · 쪽 블록을 복사하거나 지우기만 하면 돼요(넘김 단추는 MAX 쪽까지 미리 깔려 있어요).
// 나오는 것: 화보틀-<k>-<이름>-<N>장.html · 검사 줄(JSON). require 하면 { book, story, table } (글꾸 마트 tools/geulkku-hwabo.mjs 가 12장 판을 만들어요)
const fs = require('fs');
const path = require('path');
const BASE = process.env.HB_BASE || 'https://kgangkgang.github.io/blue-lemonade/mart/data/sample/hwabo/';

// ── 견본 ──
const CAST = [['Aster', '#79A9D8'], ['Blair', '#e9b949'], ['Cyan', '#3ccfbf'], ['Dahlia', '#ff5fa2'], ['Eden', '#7fbf3c'], ['Fern', '#b799e8']];
const SAY = ['여기에 사진 코멘트를 적어요.', '코멘트 칸이에요. 글이 길어지면 말풍선도 같이 늘어나요.', '마음에 드는 한 장에 한마디를 붙여요.', '두 줄 세 줄이 되어도 괜찮아요. 줄바꿈은 그대로 이어져요.', '이 말풍선이 필요 없으면 블록째 지워도 돼요.'];
// 11-10 다듬기: 내 글(코멘트)은 꾸미지 않아요 — 틀 밖 맨 위에 그냥 적게 주석으로만 알려요(화면에 안내 글 없음)
const PIN_NOTE = '<!-- 내 글(코멘트)은 이 줄 위에 그냥 적어요 — 틀이 꾸미지 않아요 -->';
const { finish } = require('./geulkku-polish/post.cjs');
const two = i => String(i).padStart(2, '0');
// 사진 n(1부터): 6장마다 한 장은 가로(l1 · l2), 나머지는 세로 견본(p01~p12)을 돌려 써요
const isLand = n => n % 7 === 0;
const srcOf = n => isLand(n) ? `${BASE}l${(Math.floor(n / 7) - 1) % 2 + 1}.svg` : `${BASE}p${two((n - 1) % 12 + 1)}.svg`;
const who = n => (n - 1) % CAST.length;            // 캐릭터 번호(0부터)
const nameOf = n => CAST[who(n)][0];
const cc = n => `c${who(n) + 1}`;                  // 캐릭터 색 class
const img = (n, eager) => `<!-- 견본 --><img src="${srcOf(n)}" width="${isLand(n) ? 1216 : 832}" height="${isLand(n) ? 832 : 1216}" alt="업로드 이미지" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
const colorsCss = P => `/* ▼ 캐릭터 색 — c1~c6 의 색을 바꾸거나, 줄을 복사해 c7 · c8 … 을 더해요 */\n${CAST.map(([, c], i) => `${P} .c${i + 1}{--c:${c}}`).join('\n')}\n/* ▲ 캐릭터 색 */`;
const SANS = 'Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const SERIF = '"Didot","Bodoni 72","Bodoni MT","Playfair Display",Georgia,"Nanum Myeongjo","Noto Serif KR","AppleMyungjo",serif';
const MONO = 'ui-monospace,"SFMono-Regular","Cascadia Mono",Menlo,Consolas,monospace';
const HAND = '"Segoe Script","Brush Script MT","Snell Roundhand",cursive';
// 사이트 맞춤(4-1 · 4-2): 진짜 img · 사이트가 감싸는 wrapper · 번호표 숨김 · height auto 우회(block-size)
const photoCss = (P, ph, bg) => `
${P} .${ph}{display:grid!important;grid-template-columns:100%;grid-template-rows:100%;width:100%;aspect-ratio:832/1216;overflow:hidden;background:${bg}!important;counter-increment:hbn;line-height:0}
${P} .${ph}.land{aspect-ratio:1216/832}
${P} .${ph} > *{grid-area:1/1!important;min-width:0;min-height:0}
${P} .${ph} > img,${P} .${ph} > .image-number-wrapper,${P} .${ph} :has(> img):not(.${ph}){display:block!important;position:static!important;width:100%!important;height:100%!important;block-size:100%!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;line-height:0!important}
${P} .${ph} img{display:block!important;width:100%!important;height:100%!important;block-size:100%!important;max-width:none!important;object-fit:contain!important;object-position:50% 50%!important;margin:0!important;border:0!important;opacity:1!important}
${P} .${ph} > :not(img):not(.image-number-wrapper):not(:has(img)){display:none!important}
${P} .image-number-badge{display:none!important}`;
const baseCss = (P, ink, extra) => `
${P}{${ink}display:block!important;box-sizing:border-box;container-type:inline-size;margin:14px auto!important;padding:0!important;border:0!important;background:transparent!important;font-family:${SANS};line-height:1.55;text-align:left;-webkit-text-size-adjust:100%;${extra}}
${P},${P} *{color:var(--ink)!important;-webkit-text-fill-color:var(--ink)!important;box-sizing:border-box}
${P} div{background:transparent!important;border:0;margin:0;padding:0}
${P} p{margin:0!important;padding:0!important}
${P} b{font-weight:700}
/* 11-10: 사이트가 for 를 지우면 체크박스 없는 넘김 단추는 눌러도 안 움직여요 — 그런 단추는 숨겨요(체크박스가 든 위쪽 단추는 그대로) */
${P} label:not([for]):not(:has(input)){display:none!important}
${P} i{font-style:normal}`;
// 체크박스 사슬(radio name 이 지워져도 동작): k(n) 체크 = n번째 쪽을 넘김. n번째 쪽 표시 = k(n-1) 체크 && k(n) 미체크.
const SN = (P, k, n) => n === 1 ? `${P}:not(:has(.${k}1:checked))` : `${P}:has(.${k}${n - 1}:checked):not(:has(.${k}${n}:checked))`;
// 마지막 쪽 = 쪽 목록의 마지막 자식 — 쪽 수가 몇이든 같은 CSS
const LAST = (pg, n) => `:has(${pg}:nth-child(${n}):last-child)`;
const forbidden = out => ['position:fixed', 'contenteditable', 'blob:', '<script'].filter(k => out.includes(k)).concat(/<[a-z]+[^>]* name=/i.test(out) ? ['name='] : []);
const GUIDE = (title, extra) => `<!-- 블루레몬에이드 글꾸 마트 · 화보 갤러리 「${title}」
  · 사진: 「견본」 표시가 붙은 <img src="…"> 의 주소를 내 사진 주소로 바꿔요(깡싸는 글에 올린 그림 주소 — 그래야 첨부파일 목록에도 떠요). 가로 사진 칸은 class 에 land 가 붙어 있어요.
  · 이름 · 코멘트 · 제목: 보이는 글자는 전부 바꿔도 돼요. 캐릭터 색은 <style> 맨 위 「캐릭터 색」 줄(c1~c6)에서 바꿔요.
${extra}
  · 이런 주석은 지워도 모양이 그대로예요. 스크립트 없이 체크박스 · label 로만 움직여요. -->`;

// ════════ 1. 책장 넘김(잡지) ════════
function book(N) {
  const P = '.hbt1.hbt1.hbt1', MAX = 30, K = 'hb-k';
  const ph = (n, x = '', eager = false) => `<div class="hb-ph${isLand(n) ? ' land' : ''}${x}">${img(n, eager)}</div>`;
  const tag = n => `<p class="hb-tag ${cc(n)}"><span class="hb-dot"></span><b>${nameOf(n)}</b></p>`;
  const heart = `<span class="hb-act"><span class="hb-ic hb-hrt">♥&#xFE0E;</span><span class="hb-ic hb-cm"></span><span class="hb-ic hb-sh">↗</span><span class="hb-sv"></span></span>`;
  let si = 0;
  const bubble = (dir) => `<div class="hb-bub hb-bub-${dir}">${dir === 'up' ? '' : '<span class="hb-tail"></span>'}<p class="hb-say"><span class="hb-txt">${SAY[si++ % SAY.length]}</span></p>${dir === 'up' ? '<span class="hb-tail"></span>' : ''}</div>`;
  const fig = n => `<div class="hb-fig">${ph(n)}${tag(n)}</div>`;
  const G = {
    post: ([n], dir) => `<div class="hb-post ${cc(n)}"><div class="hb-ph-head"><span class="hb-av">${nameOf(n)[0]}</span><span class="hb-who"><b>${nameOf(n).toLowerCase()}</b></span><span class="hb-more">···</span></div>${dir === 'up' ? bubble('up') : ''}${ph(n)}<div class="hb-bar">${heart}</div>${dir === 'down' ? bubble('down') : ''}</div>`,
    duo: ns => `<div class="hb-duo">${ns.map(fig).join('')}</div>`,
    trio: ns => `<div class="hb-trio">${ns.map(fig).join('')}</div>`,
    quad: ns => `<div class="hb-quad">${ns.map(fig).join('')}</div>`,
    wide: ns => `<div class="hb-wide">${ns.map(fig).join('')}</div>`,
    pola: ns => `<div class="hb-pola">${ns.map(n => `<div class="hb-pc ${cc(n)}">${ph(n)}<p class="hb-pn">${nameOf(n)}</p></div>`).join('')}</div>`,
    film: ns => `<div class="hb-film"><div class="hb-fr">${ns.map(n => `<div class="hb-fig">${ph(n)}<p class="hb-fc">${nameOf(n).toUpperCase()}</p></div>`).join('')}</div></div>`,
    feed: ns => `<div class="hb-feed">${ns.map(n => ph(n)).join('')}</div><p class="hb-list">${ns.map(nameOf).join(' · ')}</p>`,
    single: ([n]) => `<div class="hb-single ${cc(n)}"><div class="hb-type"><p class="hb-big-name">${nameOf(n)}</p></div>${ph(n)}</div>`,
  };
  // 쪽 차례(사진을 다 쓸 때까지 돌려요) — 묶음: [종류, 사진 수, 덧]
  const R = [[['duo', 2], ['post', 1, 'down']], [['film', 2], ['single', 1]], [['post', 1, 'up'], ['pola', 4]], [['trio', 3], ['wide', 1]], [['feed', 6], ['post', 1, 'down']], [['single', 1], ['quad', 4]]];
  let n = 2; const pages = []; let r = 0;
  while (n <= N) {
    const left = N - n + 1, rec = R[r++ % R.length], need = rec.reduce((a, g) => a + g[1], 0);
    const g = left >= need ? rec : [[left >= 6 ? 'feed' : left >= 3 ? 'trio' : left === 2 ? 'duo' : 'single', left]];
    pages.push(g.map(([k, c, x]) => { const ns = Array.from({ length: c }, (_, j) => n + j); n += c; return { k, ns, x }; }));
  }
  if (pages.length + 1 > MAX) throw new Error('쪽이 너무 많아요');
  const pagesHtml = pages.map((g, i) => {
    const names = [...new Set(g.flatMap(x => x.ns).map(nameOf))];
    return `<!-- ▼ 쪽 시작 — 쪽을 늘리려면 이 「쪽 시작」부터 「쪽 끝」까지 통째로 복사해 바로 뒤에 붙여요(${MAX}쪽까지) -->
<div class="hb-pg"><div class="hb-in">
<div class="hb-mast"><span>LOOKBOOK</span><span>No.01</span><span><span class="hb-pno"></span> / <span class="hb-tot"></span></span></div>
<div class="hb-head"><p class="hb-pnum"></p><p class="hb-cast">${names.join(' · ')}</p></div>
${g.map(x => (x.k === 'post' ? G.post(x.ns, x.x) : G[x.k](x.ns))).join('\n')}
</div></div>
<!-- ▲ 쪽 끝 -->`;
  }).join('\n');
  const cover = `<!-- ▼ 표지(첫 쪽) -->
<div class="hb-pg hb-cover"><div class="hb-in">
<div class="hb-mast"><span>LOOKBOOK</span><span>No.01</span></div>
<p class="hb-logo">LOOK<br>BOOK</p>
<div class="hb-cv ${cc(1)}">${ph(1, ' hb-cvph', true)}</div>
<div class="hb-cvline ${cc(1)}"><p class="hb-cvno">No.01</p><p class="hb-cvname">${nameOf(1)}</p></div>
<div class="hb-post hb-cvpost ${cc(1)}"><div class="hb-bar">${heart}</div>${bubble('down')}</div>
</div></div>
<!-- ▲ 표지 -->`;
  const btn = (n, inner) => `<label class="hb-t hb-t${n}"><input type="checkbox" class="hb-k ${K}${n}" aria-label="${n}쪽 넘기기"><span class="hb-pv">‹ 이전</span><span class="hb-nx">다음 ›</span></label>`;
  const bar = inner => `${Array.from({ length: MAX - 1 }, (_, k) => btn(k + 1, inner)).join('')}<span class="hb-btn hb-off hb-o0">‹ 이전</span><span class="hb-btn hb-off hb-oN">다음 ›</span><span class="hb-ct hb-ctt"><b class="hb-cur"></b> / <span class="hb-tot"></span></span>`;
  const PG = '.hb-book > .hb-pg';
  const state = Array.from({ length: MAX }, (_, k) => {
    const i = k + 1, s = SN(P, K, i), r = [`${s} ${PG}:nth-child(${i}){visibility:visible;max-height:none;overflow:visible;animation:hb1flip .7s cubic-bezier(.3,.1,.2,1) both}`, `${s} .hb-cur::before{content:"${two(i)}"}`];
    if (i < MAX) r.push(`${s}:not(${LAST(PG, i)}) .hb-t${i}{display:inline-flex;grid-column:3;grid-row:1;justify-self:end;background:#1b1a1f!important;--ink:#f3efe7}`, `${s} .hb-t${i} .hb-pv{display:none}`);
    r.push(`${s}${LAST(PG, i)} .hb-oN{display:inline-flex;grid-column:3;grid-row:1;justify-self:end}`);
    r.push(i > 1 ? `${s} .hb-t${i - 1}{display:inline-flex;grid-column:1;grid-row:1;justify-self:start;box-shadow:inset 0 0 0 1px currentColor}\n${s} .hb-t${i - 1} .hb-nx{display:none}` : `${s} .hb-o0{display:inline-flex;grid-column:1;grid-row:1;justify-self:start}`);
    r.push(`${P}${LAST(PG, i)} .hb-tot::before{content:"${two(i)}"}`);
    return r.join('\n');
  }).join('\n');
  const css = `${baseCss(P, '--ink:#1b1a1f;--mute:#6a655e;--paper:#f3efe7;--red:#b3242c;', 'max-width:880px')}
${colorsCss(P)}
${P} .hb-book{counter-reset:hbn hbp;display:grid!important;grid-template-columns:100%;border-radius:6px;box-shadow:3px 3px 0 -1px #f3efe7,3px 3px 0 0 #cfc7b5,6px 6px 0 -1px #f3efe7,6px 6px 0 0 #c4bba7,12px 16px 30px #0000004d}
${P} .hb-pg{grid-area:1/1!important;min-width:0;display:block!important;visibility:hidden;max-height:0;padding:0!important;border-radius:6px;overflow:clip;background:var(--paper)!important;box-shadow:inset 10px 0 18px -14px #00000040;counter-increment:hbp}
${P} .hb-in{display:flex!important;flex-direction:column;gap:22px;padding:18px 16px 18px!important}
${P} .hb-mast{display:flex!important;justify-content:space-between;gap:10px;padding-bottom:8px!important;border-bottom:1px solid #1b1a1f!important;font:600 10px/1 ${MONO};letter-spacing:.16em;text-transform:uppercase}
${P} .hb-pno::before{content:counter(hbp,decimal-leading-zero)}
${P} .hb-head{display:flex!important;align-items:baseline;gap:14px;margin-top:-8px!important}
${P} .hb-pnum{font:italic 400 54px/1 ${SERIF};letter-spacing:-.02em;--ink:var(--red)}
${P} .hb-pnum::before{content:counter(hbp,decimal-leading-zero)}
${P} .hb-cast{font:500 12px/1.5 ${MONO};letter-spacing:.06em;--ink:var(--mute)}
${photoCss(P, 'hb-ph', '#e4dfd5')}
${P} .hb-ph::after{content:counter(hbn,decimal-leading-zero);grid-area:1/1;justify-self:end;align-self:start;z-index:2;margin:8px 8px 0 0;padding:4px 7px 3px;border-radius:999px;background:#16151a8c;font:600 10px/1 ${MONO};letter-spacing:.08em;color:#f6f2ea;-webkit-text-fill-color:#f6f2ea;box-shadow:0 0 0 1px #ffffff26;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);pointer-events:none}
${P} .hb-tag{display:flex!important;align-items:baseline;gap:6px;margin-top:7px!important;font:12px/1.3 ${SANS};min-width:0}
${P} .hb-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--c)!important;transform:translateY(-1px)}
${P} .hb-tag b{font:italic 600 14px/1.2 ${SERIF};letter-spacing:.01em}
${P} .hb-list{margin-top:-12px!important;font:500 11px/1.5 ${MONO};letter-spacing:.06em;text-align:right;--ink:var(--mute)}
${P} .hb-post{display:block!important;width:100%;max-width:520px;margin:0 auto!important;padding:0 0 14px!important;border-radius:14px;overflow:hidden;background:#fffefb!important;box-shadow:0 1px 0 #0000000f,0 10px 30px #3a2f2224}
${P} .hb-ph-head{display:flex!important;align-items:center;gap:10px;padding:11px 12px!important}
${P} .hb-av{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#1b1a1f!important;box-shadow:0 0 0 2px #fffefb,0 0 0 4px var(--c);font:italic 600 15px/1 ${SERIF};--ink:#fffefb}
${P} .hb-who{display:flex!important;flex-direction:column;min-width:0;line-height:1.25}
${P} .hb-who b{font:700 13.5px/1.25 ${SANS}}
${P} .hb-more{margin-left:auto;font:700 14px/1 ${SANS};letter-spacing:1px;--ink:var(--mute)}
${P} .hb-post .hb-ph{background:#ece8e0!important}
${P} .hb-bar{display:block!important;padding:10px 14px 0!important}
${P} .hb-act{display:flex!important;align-items:center;gap:14px;height:24px}
${P} .hb-ic{display:inline-grid;place-items:center;font:400 22px/1 ${SANS}}
${P} .hb-hrt{--ink:#c81e2c;font-size:23px}
${P} .hb-cover .hb-hrt{--ink:#ff5a66}
${P} .hb-cm{width:20px;height:20px;border:2px solid #1b1a1f;border-radius:50% 50% 50% 4px}
${P} .hb-sh{font:600 19px/1 ${SANS}}
${P} .hb-sv{margin-left:auto;width:15px;height:19px;border:2px solid #1b1a1f;border-bottom:0;clip-path:polygon(0 0,100% 0,100% 100%,50% 72%,0 100%)}
${P} .hb-bub{display:flex!important;flex-direction:column;padding:0 12px!important}
${P} .hb-bub-up{padding:2px 12px 10px!important}
${P} .hb-bub-down{padding:6px 12px 0!important}
${P} .hb-tail{display:block;width:16px;height:9px;margin-left:22px;background:#efeae1!important}
${P} .hb-bub-up .hb-tail{clip-path:polygon(0 0,100% 0,30% 100%)}
${P} .hb-bub-down .hb-tail{clip-path:polygon(30% 0,100% 100%,0 100%)}
${P} .hb-say{display:block!important;padding:10px 14px 11px!important;border-radius:18px;background:#efeae1!important;word-break:keep-all;overflow-wrap:anywhere}
${P} .hb-txt{font:500 15.5px/1.6 ${SANS}}
${P} .hb-duo{display:grid!important;grid-template-columns:1fr 1fr;gap:12px;padding-top:12px!important;border-top:1px solid #1b1a1f33!important}
${P} .hb-wide{display:grid!important;grid-template-columns:100%;gap:14px}
${P} .hb-quad{display:grid!important;grid-template-columns:1fr 1fr;gap:12px 10px}
${P} .hb-trio{display:grid!important;grid-template-columns:repeat(3,1fr);gap:8px}
${P} .hb-pola{display:flex!important;flex-wrap:wrap;justify-content:center;gap:18px 14px;padding:10px 4px!important}
${P} .hb-pc{display:block!important;flex:0 0 calc(50% - 8px);max-width:230px;padding:8px 8px 0!important;background:#fffefb!important;box-shadow:0 1px 2px #0000002b,0 10px 22px #3a2f2229;transform:rotate(-2deg)}
${P} .hb-pc:nth-child(2n){transform:rotate(1.6deg) translateY(6px)}
${P} .hb-pc:nth-child(3n){transform:rotate(-.8deg)}
${P} .hb-pn{padding:8px 2px 10px!important;font:400 17px/1.2 ${HAND};text-align:center;--ink:#3b3530}
${P} .hb-pn::before{content:"";display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:var(--c);vertical-align:middle}
${P} .hb-film{display:block!important;padding:14px 12px 12px!important;background:#151417!important;border-radius:2px;box-shadow:8px 8px 0 -2px #b3242c}
${P} .hb-fr{display:grid!important;grid-template-columns:repeat(2,1fr);gap:8px}
${P} .hb-film .hb-ph{background:#0c0b0d!important}
${P} .hb-fc{padding-top:5px!important;font:600 9.5px/1 ${MONO};letter-spacing:.14em;--ink:#e2a55a}
${P} .hb-feed{display:grid!important;grid-template-columns:repeat(3,1fr);gap:3px}
${P} .hb-feed .hb-ph{background:#ddd7cc!important}
${P} .hb-single{display:grid!important;grid-template-columns:100%;gap:10px}
${P} .hb-type{display:flex!important;align-items:baseline;justify-content:space-between;gap:10px;border-bottom:3px solid var(--c)!important;padding-bottom:6px!important}
${P} .hb-big-name{font:italic 400 clamp(42px,13cqw,96px)/.95 ${SERIF};letter-spacing:-.03em}
${P} .hb-cover{--ink:#efe8dc;--mute:#9b948a;background-color:#0e0d10!important;background-image:radial-gradient(120% 60% at 50% 0%,#2a1215 0%,#0e0d10 60%)!important}
${P} .hb-cover .hb-in{gap:16px}
${P} .hb-cover .hb-mast{border-bottom-color:#efe8dc55!important}
${P} .hb-logo{font:400 clamp(46px,17cqw,128px)/.86 ${SERIF};letter-spacing:.02em;text-align:center;margin:4px 0 -2px!important}
${P} .hb-cv{display:block!important;width:100%;margin:0 auto!important;padding:6px!important;border:1px solid #e6394666!important}
${P} .hb-cv .hb-ph{background:#0a090b!important}
${P} .hb-cvline{display:flex!important;justify-content:space-between;align-items:baseline;width:100%;margin:-4px auto 0!important}
${P} .hb-cvno{font:italic 400 30px/1 ${SERIF};--ink:#ff6672}
${P} .hb-cvname{font:italic 400 22px/1 ${SERIF}}
${P} .hb-cvpost{background:#1a181c!important;box-shadow:0 0 0 1px #ffffff14;--ink:#efe8dc}
${P} .hb-cvpost .hb-cm,${P} .hb-cvpost .hb-sv{border-color:#efe8dc}
${P} .hb-cvpost .hb-say,${P} .hb-cvpost .hb-tail{background:#2a272d!important}
/* 쪽 단추(위 · 아래 같은 모양 — 위는 체크박스를 품은 label, 아래는 for= 로 같은 체크박스) */
${P} .hb-ctl{display:grid!important;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin:0 0 10px!important;padding:8px 10px!important;border-radius:999px;background:#f3efe7!important;box-shadow:0 6px 18px #0000003d}
${P} .hb-ctl-b{margin:14px 0 0!important}
${P} .hb-t,${P} .hb-btn{display:none;align-items:center;justify-content:center;height:38px;padding:0 16px;border-radius:999px;font:600 13.5px/1 ${SANS};white-space:nowrap;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
${P} .hb-btn{box-shadow:inset 0 0 0 1px currentColor}
${P} .hb-off{opacity:.3;cursor:default}
${P} .hb-k{-webkit-appearance:none;appearance:none;display:block;width:0;height:0;margin:0!important;padding:0!important;border:0!important;outline:0;background:transparent!important}
${P} .hb-t:has(.hb-k:focus-visible){outline:2px solid #b3242c;outline-offset:3px}
${P} .hb-ct{grid-column:2;grid-row:1;justify-self:center;white-space:nowrap;font:500 13px/1 ${MONO};letter-spacing:.08em;font-variant-numeric:tabular-nums;--ink:var(--mute)}
${P} .hb-ct b{--ink:#b3242c}
${P} .hb-tot::before{content:"--"}
/* 쪽 넘김 상태 */
${state}
@keyframes hb1flip{from{transform:perspective(2200px) rotateY(-24deg);transform-origin:0 50%;opacity:.25;filter:brightness(.7)}to{transform:none;transform-origin:0 50%;opacity:1;filter:none}}
@supports not selector(:has(a)){${P} .hb-book{gap:18px}${P} .hb-pg{grid-area:auto!important;visibility:visible!important;max-height:none!important}${P} .hb-ctl{display:none!important}}
@media (prefers-reduced-motion:reduce){${P} .hb-pg{animation:none!important}}
@container (min-width:640px){
${P} .hb-in{padding:30px 44px 24px!important;gap:30px}
${P} .hb-pnum{font-size:72px}
${P} .hb-duo{gap:22px;max-width:680px;margin:0 auto!important;width:100%}
${P} .hb-trio{gap:14px}
${P} .hb-pc{flex-basis:calc(33.333% - 12px)}
${P} .hb-fr{grid-template-columns:repeat(4,1fr)}
${P} .hb-quad{grid-template-columns:repeat(4,1fr);gap:14px}
${P} .hb-film{padding:18px 18px 16px!important}
${P} .hb-feed{max-width:600px;margin:0 auto!important;width:100%}
${P} .hb-single{grid-template-columns:1fr 1fr;align-items:end;gap:24px}
${P} .hb-type{flex-direction:column;align-items:flex-start;border-bottom:0!important;border-left:3px solid var(--c)!important;padding:0 0 4px 16px!important;order:2}
${P} .hb-txt{font-size:16px}
${P} .hb-cvpost{max-width:560px}
}`.trim();
  const html = `${GUIDE('책장 넘김', `  · 사진 더하기: 한 쪽 안의 사진 칸(<div class="hb-fig">…</div> 같은 덩어리)을 복사해 옆에 붙여요. 쪽을 더하거나 빼려면 「▼ 쪽 시작」~「▲ 쪽 끝」을 통째로 복사 · 지워요(${MAX}쪽까지). 쪽 번호 · 「01 / 05」는 저절로 맞춰져요.`)}
${PIN_NOTE}
<div class="hbt1"><style>
${css}
</style>
<div class="hb-ctl">${bar(true)}</div>
<div class="hb-book">
${cover}
${pagesHtml}
</div>
</div>
`;
  return { html: finish(html, '#1b1a1f'), css, pages: pages.length + 1 };
}

// ════════ 2. 스토리 뷰어 ════════
function story(N) {
  const P = '.hbt2.hbt2.hbt2', MAX = 40, K = 's-k';
  const ph = (n, x = '') => `<div class="s-ph${isLand(n) ? ' land' : ''}${x}">${img(n, n === 1)}</div>`;
  const stk = (n, k) => `<span class="s-stk ${cc(n)}${k ? ' s-stk' + k : ''}">@${nameOf(n).toLowerCase()}</span>`;
  let si = 0;
  const bubble = () => `<div class="s-bub"><p class="s-say"><span class="s-txt">${SAY[si++ % SAY.length]}</span></p></div>`;
  const heart = `<span class="s-ic s-hrt">♥&#xFE0E;</span><span class="s-ic s-snd">➤&#xFE0E;</span>`;
  const body = (k, ns) => {
    if (k === 'one') return `<div class="s-b s-one">${ph(ns[0])}${stk(ns[0], 1)}</div>`;
    if (k === 'two') return `<div class="s-b s-two">${ns.map((n, j) => `<div class="s-cell">${ph(n)}${stk(n, j + 1)}</div>`).join('')}</div>`;
    if (k === 'three') return `<div class="s-b s-three">${ns.map(n => `<div class="s-cell">${ph(n)}${stk(n)}</div>`).join('')}</div>`;
    if (k === 'four') return `<div class="s-b s-four">${ns.map(n => `<div class="s-cell">${ph(n)}</div>`).join('')}<p class="s-dump">${ns.map(n => '@' + nameOf(n).toLowerCase()).join('  ')}</p></div>`;
    if (k === 'c') return `<div class="s-b s-c">${ph(ns[0])}</div>`;
  };
  // 장 차례: 표지(사진 1 + 코멘트) 다음 [두 장 · 코멘트 한 장 · 세 장 · 한 장 · 네 장] 을 돌려요. 가로 사진은 한 장짜리(c · one)에만.
  const R = [['two', 2], ['c', 1], ['three', 3], ['one', 1], ['four', 4]];
  const S = [['cover', [1]]]; let n = 2, r = 0;
  while (n <= N) {
    if (isLand(n)) { S.push(['c', [n]]); n++; continue; }
    let [k, c] = R[r++ % R.length];
    const ns = []; for (let j = n; j <= N && ns.length < c && !isLand(j); j++) ns.push(j);
    if (ns.length < c) k = ['', 'one', 'two', 'three'][ns.length];
    S.push([k, ns]); n += ns.length;
  }
  if (S.length > MAX) throw new Error('장이 너무 많아요');
  const slides = S.map(([k, ns]) => {
    const n0 = ns[0], names = [...new Set(ns.map(nameOf))];
    const head = `<div class="s-hd"><span class="s-av ${cc(n0)}">${nameOf(n0)[0]}</span><span class="s-who"><b>${names.map(x => x.toLowerCase()).join(' · ')}</b></span><span class="s-ct"><span class="hb-cur"></span>/<span class="hb-tot"></span></span></div>`;
    const prog = `<span class="s-pb"><span class="s-pf"></span><span class="s-pg"></span></span>`;
    let main, foot;
    if (k === 'cover') { main = `<div class="s-b s-cv"><p class="s-logo">LOOK<br>BOOK</p><p class="s-iss"><span>No.02</span></p>${ph(n0, ' s-cvph')}<p class="s-cvname ${cc(n0)}">${nameOf(n0)}</p></div>`; foot = `<div class="s-ft">${bubble()}<div class="s-bar"><span class="s-hint"></span>${heart}</div></div>`; }
    else if (k === 'c') { main = body(k, ns); foot = `<div class="s-ft">${bubble()}<div class="s-bar"><span class="s-hint"></span>${heart}</div></div>`; }
    else { main = body(k, ns); foot = `<div class="s-ft"><div class="s-bar"><span class="s-hint"></span>${heart}</div></div>`; }
    return `<!-- ▼ 장 시작 — 장을 늘리려면 이 「장 시작」부터 「장 끝」까지 통째로 복사해 바로 뒤에 붙여요(${MAX}장까지) -->
<div class="s-stage"><div class="s-sl ${cc(n0)}${k === 'cover' ? ' s-cover' : ''}${k === 'c' ? ' s-com' : ''}">${prog}${head}${main}${foot}</div></div>
<!-- ▲ 장 끝 -->`;
  }).join('\n');
  const ST = '.s-stages > .s-stage';
  const W = 'var(--w)';
  // 좌우 탭 칸(장 위 왼쪽 · 오른쪽 22%) — 모든 장이 같이 써요. 칸 i = 체크박스 k(i): i번째 장에선 「다음」(오른쪽), i+1번째 장에선 「이전」(왼쪽)
  const zones = `<div class="s-zones">${Array.from({ length: MAX - 1 }, (_, k) => `<label for="hbt2-k${k + 1}" class="s-z s-zt${k + 1}" aria-label="넘기기"><span class="s-arw"></span></label>`).join('')}</div>`;
  const ctl = `<div class="s-ctl">${Array.from({ length: MAX - 1 }, (_, k) => `<label class="s-t s-t${k + 1}"><input type="checkbox" class="s-k ${K}${k + 1}" aria-label="${k + 1}번째 장 넘기기"><span class="s-pv">‹ 이전</span><span class="s-nx">다음 ›</span></label>`).join('')}<span class="s-t s-dis s-o0">‹ 이전</span><span class="s-t s-dis s-oN">다음 ›</span><span class="s-cct"><b class="hb-cur"></b> / <span class="hb-tot"></span></span></div>`;
  const state = Array.from({ length: MAX }, (_, k) => {
    const i = k + 1, s = SN(P, K, i), r = [`${s} ${ST}:nth-child(${i}){visibility:visible;animation:hb2in .45s cubic-bezier(.3,.1,.2,1) both}`, `${s} .hb-cur::before{content:"${two(i)}"}`, `${s} .s-pf{width:calc(100% * ${i} / var(--n))}`];
    if (i < MAX) r.push(`${s}:not(${LAST(ST, i)}) .s-t${i}{display:inline-flex;grid-column:3;grid-row:1;justify-self:end;background:#eef1f8!important;--ink:#0a0d16}`, `${s} .s-t${i} .s-pv{display:none}`, `${s}:not(${LAST(ST, i)}) .s-zt${i}{display:grid;grid-column:3;justify-items:end}`, `${s} .s-zt${i} .s-arw{transform:rotate(180deg)}`);
    r.push(`${s}${LAST(ST, i)} .s-oN{display:inline-flex;grid-column:3;grid-row:1;justify-self:end}`);
    r.push(i > 1 ? `${s} .s-t${i - 1}{display:inline-flex;grid-column:1;grid-row:1;justify-self:start}\n${s} .s-t${i - 1} .s-nx{display:none}\n${s} .s-zt${i - 1}{display:grid;grid-column:1;justify-items:start}` : `${s} .s-o0{display:inline-flex;grid-column:1;grid-row:1;justify-self:start}`);
    r.push(`${P}${LAST(ST, i)}{--n:${i}}`, `${P}${LAST(ST, i)} .hb-tot::before{content:"${two(i)}"}`);
    return r.join('\n');
  }).join('\n');
  const hl = CAST.map(([c], i) => `<span class="s-hl c${i + 1}"><span class="s-hlr"><span>${c[0]}</span></span><small>${c}</small></span>`).join('');
  const css = `${baseCss(P, '--ink:#eef1f8;--mute:#8d96ab;--w:min(100cqw,404px);--n:1;', 'max-width:900px;line-height:1.5')}
${colorsCss(P)}
${P} .s-prof{display:block!important;padding:18px 16px 14px!important;border-radius:22px 22px 0 0;background:linear-gradient(180deg,#141a2b,#0a0d16)!important}
${P} .s-top{display:flex!important;align-items:center;gap:14px}
${P} .s-me{flex:none;display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:conic-gradient(from 200deg,#5b7fd1,#b799e8,#e9eef8,#7fd4ea,#5b7fd1)!important;padding:3px}
${P} .s-me span{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:#0a0d16!important;box-shadow:inset 0 0 0 2px #0a0d16;font:400 26px/1 ${SERIF}}
${P} .s-nm{display:flex!important;flex-direction:column;gap:3px;min-width:0}
${P} .s-nm b{font:700 17px/1.2 ${SANS};letter-spacing:.01em}
${P} .s-nm small{font:500 11px/1.3 ${MONO};letter-spacing:.12em;--ink:var(--mute)}
${P} .s-hls{display:flex!important;gap:12px;margin-top:16px!important;min-width:0;max-width:100%;padding:2px 2px 4px!important;scrollbar-width:none;-ms-overflow-style:none}
@media (hover:none),(pointer:coarse),(max-width:559.98px){${P} .s-hls{overflow-x:auto}}
@media (hover:hover) and (pointer:fine) and (min-width:560px){${P} .s-hls{flex-wrap:wrap}}
${P} .s-hls::-webkit-scrollbar{display:none;width:0;height:0}
${P} .s-hl{flex:none;display:flex;flex-direction:column;align-items:center;gap:5px;width:58px}
${P} .s-hlr{display:grid;place-items:center;width:54px;height:54px;border-radius:50%;padding:2.5px;background:conic-gradient(var(--c),#ffffff,var(--c))!important}
${P} .s-hlr span{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:#10141f!important;box-shadow:inset 0 0 0 2px #0a0d16;font:italic 400 21px/1 ${SERIF}}
${P} .s-hl small{font:500 10.5px/1.2 ${SANS};--ink:#c4cbda;white-space:nowrap}
${P} .s-track{counter-reset:hbn;display:grid!important;grid-template-columns:100%;padding:12px 0 14px!important;background:#0a0d16!important}
${P} .s-track > *{grid-area:1/1!important;min-width:0}
${P} .s-stages{display:grid!important;grid-template-columns:100%;overflow-x:clip}
${P} .s-stage{grid-area:1/1!important;min-width:0;display:grid!important;grid-template-columns:100%;justify-items:center;visibility:hidden}
${P} .s-sl{width:${W};aspect-ratio:9/16;display:grid!important;grid-template-columns:100%;grid-template-rows:auto auto minmax(0,1fr) auto;border-radius:16px;overflow:hidden;font-size:calc(${W} * .036);background:#121624!important;background:radial-gradient(130% 70% at 15% 0%,color-mix(in srgb,var(--c) 34%,#121624) 0%,#0d1019 62%)!important;box-shadow:0 0 0 1px #ffffff12}
${P} .s-sl > *{grid-column:1;min-width:0;min-height:0}
/* 좌우 탭 칸 */
${P} .s-zones{justify-self:center;width:${W};aspect-ratio:9/16;display:grid!important;grid-template-columns:22% 1fr 22%;grid-template-rows:100%;z-index:3;pointer-events:none;font-size:calc(${W} * .036)}
${P} .s-z{display:none;grid-row:1;align-items:center;padding:0 .55em;pointer-events:auto;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
${P} .s-arw{display:grid;place-items:center;width:2em;height:2em;border-radius:50%;background:#0a0d1666!important;box-shadow:0 0 0 1px #ffffff2e;opacity:.85}
${P} .s-arw::before{content:"";display:block;width:.55em;height:.55em;border:solid #eef1f8;border-width:0 0 .15em .15em;box-sizing:border-box;transform:translateX(.1em) rotate(45deg)}
${P} .s-z:hover .s-arw{opacity:1;background:#0a0d16a6!important}
${P} .s-k{-webkit-appearance:none;appearance:none;display:block;width:0;height:0;margin:0!important;padding:0!important;border:0!important;outline:0;background:transparent!important}
${P} .s-ctl{display:grid!important;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:0 16px 18px!important;border-radius:0 0 22px 22px;background:#0a0d16!important}
${P} .s-t{display:none;align-items:center;height:38px;padding:0 16px;border-radius:999px;font:700 13.5px/1 ${SANS};white-space:nowrap;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;box-shadow:inset 0 0 0 1px #ffffff40}
${P} .s-dis{opacity:.3;cursor:default}
${P} .s-t:has(.s-k:focus-visible){outline:2px solid #9fb6ef;outline-offset:3px}
${P} .s-cct{grid-column:2;grid-row:1;white-space:nowrap;font:600 13px/1 ${MONO};letter-spacing:.06em;--ink:#8d96ab}
${P} .s-cct b{--ink:#eef1f8}
${P} .hb-tot::before{content:"--"}
${state}
@keyframes hb2in{from{transform:translateX(7%) scale(.96);opacity:0}to{transform:none;opacity:1}}
@supports not selector(:has(a)){${P} .s-track,${P} .s-stages{gap:14px}${P} .s-stage{grid-area:auto!important;visibility:visible}${P} .s-ctl,${P} .s-zones{display:none!important}}
${P} .s-pb{grid-row:1;display:grid!important;grid-template:100%/100%;height:3px;margin:10px 10px 0;border-radius:2px;background:#ffffff38;overflow:hidden}
${P} .s-pb > *{grid-area:1/1}
${P} .s-pf{display:block;width:0;height:100%;background:#fff}
${P} .s-pg{display:block;width:100%;height:100%;background:repeating-linear-gradient(90deg,transparent 0 calc(100% / var(--n) - 2px),#0d1019 calc(100% / var(--n) - 2px) calc(100% / var(--n)))!important}
${P} .s-hd{grid-row:2;display:flex!important;align-items:center;gap:.55em;padding:.6em .75em .5em!important;z-index:2}
${P} .s-av{flex:none;display:grid;place-items:center;width:2.2em;height:2.2em;border-radius:50%;background:#0d1019!important;box-shadow:0 0 0 2px var(--c);font:italic 400 1.05em/1 ${SERIF}}
${P} .s-who{display:flex!important;flex-direction:column;min-width:0;line-height:1.2;margin-right:auto}
${P} .s-who b{font-weight:700;font-size:.92em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${P} .s-ct{font:600 .72em/1 ${MONO};letter-spacing:.04em;--ink:#c9d1e3;font-variant-numeric:tabular-nums}
${P} .s-b{grid-row:3;display:grid!important;align-content:center;padding:0 .75em!important;min-height:0}
${P} .s-ft{grid-row:4;display:flex!important;flex-direction:column;gap:.5em;padding:.4em .75em .8em!important;z-index:2}
${photoCss(P, 's-ph', '#0b0d14')}
${P} .s-ph{border-radius:.5em}
${P} .s-ph::after{content:counter(hbn,decimal-leading-zero);grid-area:1/1;justify-self:end;align-self:start;z-index:2;margin:.55em .55em 0 0;padding:.28em .5em;border-radius:.45em;background:linear-gradient(135deg,#5b7fd1d9,#b799e8d9);font:700 .62em/1 ${MONO};letter-spacing:.06em;color:#fff;-webkit-text-fill-color:#fff;box-shadow:0 2px 8px #0006;pointer-events:none}
${P} .s-stk{display:inline-block;justify-self:center;align-self:start;margin-top:-.7em;padding:.28em .7em .3em;border-radius:.4em;background:#fff!important;font:800 .78em/1.1 ${SANS};letter-spacing:.01em;--ink:#121624;box-shadow:0 3px 10px #0007;transform:rotate(-3deg);z-index:2;border-bottom:2px solid var(--c)}
${P} .s-stk2{transform:rotate(2.5deg)}
${P} .s-cell{display:grid!important;grid-template-columns:100%;justify-items:center;min-width:0}
${P} .s-one{justify-items:center;gap:.2em}
${P} .s-one .s-ph{width:88%}
${P} .s-one .s-ph.land{width:100%}
${P} .s-two{grid-template-columns:1fr 1fr;gap:.6em;align-items:start}
${P} .s-two .s-cell:nth-child(2){margin-top:3.2em!important}
${P} .s-two .s-cell:nth-child(1){margin-bottom:3.2em!important}
${P} .s-three{grid-template-columns:1fr 1fr;gap:.9em .6em}
${P} .s-three .s-cell:first-child{grid-column:1/-1;width:62%;justify-self:center}
${P} .s-four{grid-template-columns:1fr 1fr;gap:.45em;padding:0 1.6em!important}
${P} .s-four .s-ph{border-radius:.2em;box-shadow:0 0 0 .22em #f4f6fb}
${P} .s-dump{grid-column:1/-1;text-align:center;margin-top:.5em!important;font:700 .72em/1.3 ${SANS};--ink:#d5dbea}
${P} .s-c{padding:0 .5em!important;justify-items:center}
${P} .s-com .s-c .s-ph:not(.land){width:84%}
${P} .s-cv{align-content:center;justify-items:center;gap:.6em}
${P} .s-logo{font:400 4em/.86 ${SERIF};text-align:center;letter-spacing:.02em}
${P} .s-iss{display:flex!important;gap:.8em;font:600 .66em/1 ${MONO};letter-spacing:.16em;--ink:#9fb6ef}
${P} .s-cvph{margin-top:.6em;width:70%!important;box-shadow:0 0 0 1px #9fb6ef66,0 14px 40px #000a}
${P} .s-cvname{font:italic 400 1.35em/1 ${SERIF};margin-top:.3em!important}
${P} .s-bub{display:flex!important;flex-direction:column;align-items:flex-end}
${P} .s-say{display:block!important;max-width:88%;padding:.6em .9em .65em!important;border-radius:1.2em 1.2em .35em 1.2em;background-color:#4a58b3!important;background-image:linear-gradient(135deg,#3f5fae,#6a4fb8)!important;box-shadow:0 3px 8px #0007;word-break:keep-all;overflow-wrap:anywhere}
${P} .s-txt{font:600 1em/1.45 ${SANS}}
${P} .s-bar{display:flex!important;align-items:center;gap:.7em}
${P} .s-hint{flex:1}
${P} .s-ic{font:400 1.35em/1 ${SANS}}
${P} .s-hrt{--ink:#ff4d6d}
${P} .s-snd{font-size:1.15em;transform:rotate(-20deg)}
@container (min-width:640px){
${P} .s-prof{padding:24px 28px 16px!important}
}
@media (prefers-reduced-motion:reduce){${P} .s-stage{animation:none!important}}`.trim();
  const html = `${GUIDE('스토리 뷰어', `  · 사진 더하기: 한 장 안의 사진 칸(<div class="s-cell">…</div>)을 복사하거나, 「▼ 장 시작」~「▲ 장 끝」을 통째로 복사 · 지워요(${MAX}장까지). 위 진행 막대 · 「03/12」는 장 수에 맞춰 저절로 바뀌어요.\n  · 장 왼쪽 · 오른쪽을 누르거나 아래 단추로 넘겨요.`)}
${PIN_NOTE}
<div class="hbt2"><style>
${css}
</style>
<div class="s-prof"><div class="s-top"><span class="s-me"><span>L</span></span><span class="s-nm"><b>lookbook</b><small>No.02</small></span></div>
<div class="s-hls">${hl}</div></div>
<div class="s-track">
<div class="s-stages">
${slides}
</div>
</div>
${ctl}
</div>
`;
  return { html: finish(html, '#eef1f8'), css, pages: S.length };
}

// ════════ 3. 라이트 테이블(밀착 인화지) ════════
function table(N) {
  const P = '.hbt3.hbt3.hbt3';
  const ph = (n, x = '') => `<div class="l-ph${isLand(n) ? ' land' : ''}${x}">${img(n, n === 1)}</div>`;
  let si = 0;
  const bubble = () => `<div class="l-bub"><span class="l-tail"></span><p class="l-say"><span class="l-txt">${SAY[si++ % SAY.length]}</span></p></div>`;
  // 프레임: 체크박스가 사진 위에 깔려 있어 누르면 크게 · 다시 누르면 작게(id 없이 동작)
  const frame = n => `<div class="l-fr${isLand(n) ? ' l-frl' : ''} ${cc(n)}">${ph(n)}<input type="checkbox" class="l-k" aria-label="크게 보기"><p class="l-cap"><span class="l-dot"></span><b>${nameOf(n)}</b><i></i><span class="l-x">✕ 작게</span></p></div>`;
  const print = n => `<div class="l-print${isLand(n) ? ' l-printl' : ''} ${cc(n)}"><div class="l-pw"><span class="l-tape"></span>${ph(n, ' l-pph')}<p class="l-pcap"><b>${nameOf(n)}</b></p></div>${bubble()}</div>`;
  const rolls = [];
  for (let a = 2; a <= N; a += 11) {
    const ns = []; for (let n = a; n <= Math.min(N, a + 10); n++) ns.push(n);
    const names = [...new Set(ns.map(nameOf))];
    rolls.push(`<!-- ▼ 롤 시작 — 롤을 늘리려면 「롤 시작」부터 「롤 끝」까지 통째로 복사해요. 롤 번호는 저절로 붙어요 -->
<div class="l-roll"><label class="l-rh"><input type="checkbox" class="l-fold" aria-label="롤 접기"><span class="l-rn">ROLL </span><span class="l-rc">${names.join(' · ')}</span><span class="l-rb"><span class="l-o">접기 ▴</span><span class="l-c">펼치기 ▾</span></span></label>
<div class="l-sheet"><p class="l-edge"><span class="l-en">▸ ROLL </span><span>No.03</span></p><div class="l-grid">
${ns.map((n, j) => ((j % 6 === 4) ? print(n) : frame(n))).join('\n')}
</div></div></div>
<!-- ▲ 롤 끝 -->`);
  }
  const cover = `<div class="l-cover ${cc(1)}"><div class="l-mast"><p class="l-logo">LOOKBOOK</p><p class="l-iss"><span>No.03</span></p></div>
<div class="l-cvwrap"><div class="l-pw l-cvpw"><span class="l-tape"></span>${ph(1, ' l-pph')}<p class="l-pcap"><b>${nameOf(1)}</b></p></div>${bubble()}</div></div>`;
  const css = `${baseCss(P, '--ink:#24201b;--mute:#6f675c;--amber:#e8a34a;--grease:#d7262e;', 'max-width:940px')}
${colorsCss(P)}
${P} .l-in{counter-reset:hbn hbr;display:flex!important;flex-direction:column;gap:26px;padding:22px 14px 28px!important;border-radius:10px;background-color:#f8f6f0!important;background-image:linear-gradient(#e9e4d955 1px,transparent 1px),linear-gradient(90deg,#e9e4d955 1px,transparent 1px),radial-gradient(120% 80% at 50% 0%,#fffef9,#efebe2)!important;background-size:24px 24px,24px 24px,100% 100%!important;box-shadow:0 0 0 1px #00000010,0 16px 40px #0000003d}
${P} .l-cover{display:flex!important;flex-direction:column;align-items:center;gap:18px}
${P} .l-mast{display:flex!important;flex-direction:column;align-items:center;gap:6px;width:100%;padding-bottom:12px!important;border-bottom:2px solid #24201b!important}
${P} .l-logo{font:400 clamp(30px,9.4cqw,74px)/1 ${SERIF};letter-spacing:.04em}
${P} .l-iss{display:flex!important;gap:14px;font:700 11px/1 ${MONO};letter-spacing:.18em;--ink:var(--grease)}
${P} .l-cvwrap{display:grid!important;grid-template-columns:100%;justify-items:center;gap:6px;width:100%}
${P} .l-cvpw{width:min(86%,440px);transform:rotate(-1.6deg)}
${P} .l-pw{display:flex!important;flex-direction:column;align-items:center;padding:12px 12px 0!important;background:#fffefb!important;box-shadow:0 1px 2px #0000002e,0 14px 30px #3a2f2230}
${P} .l-tape{display:block;width:96px;height:24px;margin:-24px 0 -2px;background:#efe2ad!important;opacity:.85;transform:rotate(-3deg);box-shadow:0 1px 2px #0000001f;z-index:2}
${P} .l-pcap{display:flex!important;justify-content:space-between;align-items:baseline;width:100%;padding:9px 2px 11px!important;font:400 17px/1.2 ${HAND}}
${P} .l-roll{display:flex!important;flex-direction:column;gap:8px;counter-increment:hbr}
${P} .l-rh{display:flex;align-items:baseline;gap:10px;padding:0 2px 4px;border-bottom:1px solid #24201b40;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
${P} .l-fold{-webkit-appearance:none;appearance:none;width:0;height:0;margin:0!important;padding:0!important;border:0!important;outline:0}
${P} .l-rh:has(.l-fold:focus-visible){outline:2px solid var(--amber);outline-offset:3px}
${P} .l-rn{font:800 13px/1 ${MONO};letter-spacing:.14em;--ink:var(--grease);white-space:nowrap}
${P} .l-rn::after,${P} .l-en::after{content:counter(hbr,decimal-leading-zero)}
${P} .l-rc{flex:1;min-width:0;font:500 11.5px/1.3 ${MONO};letter-spacing:.04em;--ink:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${P} .l-rb{font:700 11px/1 ${SANS};padding:5px 9px;border-radius:999px;box-shadow:inset 0 0 0 1px #24201b55;white-space:nowrap}
${P} .l-c{display:none}
${P} .l-roll:has(.l-fold:checked) .l-o{display:none}
${P} .l-roll:has(.l-fold:checked) .l-c{display:inline}
${P} .l-sheet{display:block!important;padding:8px 8px 20px!important;border-radius:3px;background-color:#1a1511!important;background-image:repeating-linear-gradient(90deg,#f8f6f0 0 8px,transparent 8px 18px)!important;background-size:100% 7px!important;background-position:0 calc(100% - 7px)!important;background-repeat:no-repeat!important;box-shadow:0 8px 22px #2a20162e}
${P} .l-edge{display:flex!important;justify-content:space-between;gap:8px;padding:2px 2px 8px!important;background-color:#1a1511!important;font:700 9.5px/1 ${MONO};letter-spacing:.16em;--ink:var(--amber);white-space:nowrap;overflow:hidden}
${P} .l-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-flow:row dense;gap:8px 6px;align-items:start}
${P} .l-fr{display:grid!important;grid-template-columns:100%;grid-template-rows:auto auto;min-width:0;transition:transform .25s}
${P} .l-fr > .l-ph,${P} .l-fr > .l-k{grid-area:1/1}
${P} .l-fr > .l-cap{grid-area:2/1}
${P} .l-frl{grid-column:span 2}
${P} .l-k{-webkit-appearance:none;appearance:none;display:block;width:100%;height:100%;margin:0!important;padding:0!important;border:0!important;outline:0;background:transparent!important;cursor:zoom-in;z-index:3;border-radius:0}
${P} .l-fr:has(.l-k:focus-visible) .l-ph{box-shadow:0 0 0 2px var(--amber)}
${P} .l-cap{display:none!important}
${P} .l-fr:has(.l-k:checked){grid-column:1/-1;justify-self:center;width:min(100%,520px);padding:12px 12px 0!important;margin:10px 0 14px!important;background:#fffefb!important;box-shadow:0 0 0 1px #00000014,0 18px 40px #000a}
${P} .l-frl:has(.l-k:checked){width:min(100%,700px)}
${P} .l-fr:has(.l-k:checked) > .l-k{grid-area:1/1/3/2;cursor:zoom-out}
${P} .l-fr:has(.l-k:checked) .l-cap{display:flex!important;align-items:baseline;gap:7px;padding:9px 2px 11px!important}
${P} .l-cap{background-color:#fffefb!important}
${P} .l-cap b{font:400 17px/1.2 ${HAND}}
${P} .l-cap i{flex:1}
${P} .l-dot{width:8px;height:8px;border-radius:50%;background:var(--c)!important}
${P} .l-x{font:700 11.5px/1 ${SANS};padding:6px 10px;border-radius:999px;box-shadow:inset 0 0 0 1px #24201b66;white-space:nowrap}
${photoCss(P, 'l-ph', '#0d0a08')}
${P} .l-ph::after{content:counter(hbn,decimal-leading-zero) "A";grid-area:1/1;justify-self:end;align-self:start;z-index:2;margin:5px 5px 0 0;padding:2px 4px;border-radius:2px;background:#1a1511b3;font:700 9.5px/1 ${MONO};letter-spacing:.06em;color:#e8a34a;-webkit-text-fill-color:#e8a34a;pointer-events:none}
${P} .l-pph::after,${P} .l-fr:has(.l-k:checked) .l-ph::after{margin:9px 9px 0 0;padding:4px 7px;font-size:11px;background:#1a1511cc}
${P} .l-print{grid-column:1/-1;display:grid!important;grid-template-columns:100%;justify-items:center;gap:4px;margin:16px 0 18px!important;padding:22px 12px 16px!important;border-radius:4px;background:#f8f6f0!important;background-image:linear-gradient(#e9e4d955 1px,transparent 1px),linear-gradient(90deg,#e9e4d955 1px,transparent 1px)!important;background-size:24px 24px!important}
${P} .l-print .l-pw{width:min(92%,430px);transform:rotate(1.2deg);outline:3px solid var(--grease);outline-offset:9px;border-radius:2px}
${P} .l-print:nth-child(even) .l-pw{transform:rotate(-1.3deg)}
${P} .l-printl .l-pw{width:min(96%,620px)}
${P} .l-bub{display:flex!important;flex-direction:column;align-items:flex-start;width:min(100%,440px);margin-top:14px!important}
${P} .l-tail{display:block;width:16px;height:9px;margin-left:26px;background:#fffefb!important;clip-path:polygon(30% 0,100% 100%,0 100%)}
${P} .l-say{display:block!important;width:100%;padding:11px 15px 12px!important;border-radius:18px;background:#fffefb!important;box-shadow:0 1px 0 #0000000f,0 8px 22px #3a2f2224;word-break:keep-all;overflow-wrap:anywhere}
${P} .l-txt{font:500 15.5px/1.6 ${SANS}}
${P} .l-roll:has(.l-fold:checked) .l-grid{display:flex!important;gap:6px;scrollbar-width:none;-ms-overflow-style:none}
@media (hover:none),(pointer:coarse),(max-width:559.98px){${P} .l-roll:has(.l-fold:checked) .l-grid{overflow-x:auto}}
@media (hover:hover) and (pointer:fine) and (min-width:560px){${P} .l-roll:has(.l-fold:checked) .l-grid{flex-wrap:wrap}}
${P} .l-grid::-webkit-scrollbar{display:none;width:0;height:0}
${P} .l-roll:has(.l-fold:checked) .l-print{display:block!important}
${P} .l-roll:has(.l-fold:checked) .l-fr,${P} .l-roll:has(.l-fold:checked) .l-print{flex:0 0 74px;width:74px;margin:0!important;padding:0!important;background:transparent!important;box-shadow:none!important;transform:none}
${P} .l-roll:has(.l-fold:checked) .l-frl,${P} .l-roll:has(.l-fold:checked) .l-printl{flex-basis:108px;width:108px}
${P} .l-roll:has(.l-fold:checked) .l-print .l-pw{width:100%;padding:0!important;transform:none;outline-width:2px;outline-offset:1px;background:transparent!important;box-shadow:none}
${P} .l-roll:has(.l-fold:checked) .l-tape,${P} .l-roll:has(.l-fold:checked) .l-pcap,${P} .l-roll:has(.l-fold:checked) .l-bub,${P} .l-roll:has(.l-fold:checked) .l-cap{display:none!important}
${P} .l-roll:has(.l-fold:checked) .l-fr:has(.l-k:checked) > .l-k{grid-area:1/1}
${P} .l-roll:has(.l-fold:checked) .l-ph::after{font-size:8px;margin:2px 2px 0 0}
@container (min-width:640px){
${P} .l-in{padding:34px 34px 40px!important;gap:34px}
${P} .l-grid{grid-template-columns:repeat(6,minmax(0,1fr));gap:10px 8px}
${P} .l-sheet{padding:10px 12px 24px!important}
${P} .l-print{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);align-items:center;justify-items:center;gap:28px;padding:30px 28px 24px!important}
${P} .l-printl{grid-template-columns:100%}
${P} .l-print .l-bub{margin-top:0!important}
${P} .l-printl .l-bub{margin-top:12px!important}
${P} .l-print:not(.l-printl) .l-tail{width:10px;height:16px;margin:0 0 0 -9px;align-self:flex-start;clip-path:polygon(100% 0,100% 100%,0 50%);order:-1}
${P} .l-print:not(.l-printl) .l-bub{flex-direction:row;align-items:center}
${P} .l-cvwrap{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);align-items:center;gap:30px}
${P} .l-cover .l-bub{flex-direction:row;align-items:center}
${P} .l-cover .l-tail{width:10px;height:16px;margin:0 0 0 -9px;clip-path:polygon(100% 0,100% 100%,0 50%);order:-1}
${P} .l-cover .l-txt{font-size:20px}
}`.trim();
  const html = `${GUIDE('라이트 테이블', `  · 사진 더하기: 롤 안의 프레임(<div class="l-fr …">…</div>)을 복사해 붙여요. 코멘트를 붙일 사진은 인화 칸(<div class="l-print …">…</div>)으로 써요. 롤은 「▼ 롤 시작」~「▲ 롤 끝」을 통째로 복사 · 지워요.\n  · 프레임을 누르면 크게, 다시 누르면 작게 · 롤 머리를 누르면 한 줄 필름 띠로 접혀요.`)}
${PIN_NOTE}
<div class="hbt3"><style>
${css}
</style>
<div class="l-in">
${cover}
${rolls.join('\n')}
</div>
</div>
`;
  return { html: finish(html, '#24201b'), css, pages: rolls.length };
}

const KINDS = [['1', '책장넘김', book], ['2', '스토리', story], ['3', '라이트테이블', table]];
module.exports = { book, story, table, KINDS, BASE, forbidden };
if (require.main === module) {
const OUT = process.env.HB_OUT || path.join(require('os').tmpdir(), 'hwabo-templates');
fs.mkdirSync(OUT, { recursive: true });
const COUNTS = process.argv.slice(2).map(Number).filter(Boolean);
const NS = COUNTS.length ? COUNTS : [12, 30];
for (const [k, name, fn] of KINDS) {
  const outs = NS.map(N => ({ N, ...fn(N) }));
  for (const o of outs) {
    const file = path.join(OUT, `화보틀-${k}-${name}-${o.N}장.html`);
    fs.writeFileSync(file, o.html, 'utf8');
    const imgs = (o.html.replace(/<!--[\s\S]*?-->/g, '').match(/<img /g) || []).length;
    const ids = [...o.html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
    console.log(JSON.stringify({ k, name, N: o.N, imgs, okImgs: imgs === o.N, pages: o.pages, sameCss: o.css === outs[0].css, dupIds: ids.length - new Set(ids).size, forbidden: forbidden(o.html), personal: /Lucifer|Michael|Seraph|천지|CHEONJI|Uriel|Levi/.test(o.html), bytes: Buffer.byteLength(o.html) }));
  }
}
}
