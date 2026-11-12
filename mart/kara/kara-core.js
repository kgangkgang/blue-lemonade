// 노래방 글꾸 — 가사가 흐르는 노래 카드 HTML 을 만드는 순수 모듈(브라우저 · Node 둘 다 · 외부 의존 없음).
//   바탕: 2026-11-09 깡싸 노래방 묶음 글꾸 생성기(make-kara-bundle.js) 의 테마 6종(ign 비 오는 밤 · mes 하늘 팝 · tale 어두운 동화 · meme 검은 자막 · tom 따뜻한 물방울 · snow 첫눈)을
//   누구나 쓰는 판으로 다듬었어요 — 사용자 곡 · 그림 · 가사가 아니라 mp3 주소 · 제목 · 이름 · 색 · 「[분:초] 가사」 줄만 받아요.
//   깡싸 함정(인수인계 11-09): 글자 요소마다 인라인 color · 글자 상자마다 단색 background-color(그라데이션은 background-image) · @property 없음 · id/for/name 없음(단추는 label 안 checkbox) ·
//   height 는 px + block-size · 넘침 자르기는 overflow + clip-path:inset · A 트리거(플레이어 초점 · :active → --kr-run running, 걸쇠 transition 86400s) · 진짜 <img> · 곡 사이 <p><br></p>.
//   쓰는 곳: mart/kara/kara.js(만들기 화면) · tools/geulkku-kara.mjs(마트 틀 6종 견본).
export const THEMES = {
  ign: { label: '비 오는 밤', emoji: '🌧️', desc: '비 오는 밤의 방 · 폰 알림 가사창 · 달 · 떨어지는 빗방울', bg: '#08101f', ink: '#eef3ff', accent: '#86a8f0' },
  mes: { label: '하늘 팝', emoji: '🪙', desc: '파란 하늘 팝 · 두꺼운 남색 테두리 · 흔들리는 코인 · 색종이', bg: '#36b2ee', ink: '#0b2f57', accent: '#ffd400' },
  tale: { label: '어두운 동화', emoji: '🍎', desc: '어두운 동화책 · 붉은 유리 빛 · 금테 · 세리프 가사', bg: '#0d0507', ink: '#fff1f2', accent: '#e0b25a' },
  meme: { label: '검은 자막', emoji: '📼', desc: '검은 영상 화면 · ● REC · 자막 한 줄 가사', bg: '#000000', ink: '#ffffff', accent: '#ff3b3b' },
  tom: { label: '따뜻한 물방울', emoji: '🍅', desc: '따뜻한 물방울 무늬 · 점선 머리글 · 통통 튀는 이모지', bg: '#fff0de', ink: '#4a2414', accent: '#e0402a' },
  snow: { label: '첫눈', emoji: '❄️', desc: '밝은 눈 오는 오후 · 눈 쌓인 통통 글자 · 서리 유리 플레이어', bg: '#f4f9ff', ink: '#24324a', accent: '#2fae3a' },
};
export const THEME_IDS = Object.keys(THEMES);

// 테마 색(글자는 전부 인라인으로 씀) · H = 가사 줄 높이 · WIN = 가사창 높이
const TH = {
  ign: { H: 40, WIN: 104, sub: '#8ea3c9', meta: '#8195bd', title: '#eef3ff', orig: '#9fb3d9', no: '#86a8f0', btn: '#c9d6f2', nph: '💬 메시지', nphC: '#a9bde3' },
  mes: { H: 40, WIN: 104, sub: '#41709e', meta: '#0b2f57', title: '#ffffff', orig: '#eaf8ff', no: '#ffe14d', btn: '#0b2f57', nph: '◉ HYPNO KARAOKE', nphC: '#ff2f8f' },
  tale: { H: 40, WIN: 104, sub: '#c48b95', meta: '#c49aa2', title: '#fff1f2', orig: '#e0aab3', no: '#e0b25a', btn: '#f3cfd5', nph: '✦ 옛날 옛적에 ✦', nphC: '#d1a654' },
  meme: { H: 46, WIN: 46, sub: '#d0d0d0', meta: '#9a9a9a', title: '#ffffff', orig: '#b5b5b5', no: '#ff3b3b', btn: '#e6e6e6', nph: '▶ 자막 켜짐', nphC: '#9a9a9a' },
  tom: { H: 40, WIN: 104, sub: '#a46a50', meta: '#9a5a40', title: '#e0402a', orig: '#b5674c', no: '#3f9b3a', btn: '#c23a24', nph: '🍅 데굴데굴 노래방', nphC: '#d93a26' },
  snow: { H: 40, WIN: 104, sub: '#6a7f9f', meta: '#5d7090', title: '#2fae3a', orig: '#5d7090', no: '#d6391c', btn: '#2b4a7a', nph: '❄ 첫눈 오는 오후', nphC: '#2f8f3a' },
};
// 지금 줄 바탕색(가사 색은 캐릭터 색을 이 바탕과 대비 4.5 이상이 되게 명도만 조절)
const HL = { snow: '#eef5ff', ign: '#1a2a4b', mes: '#fff27a', tale: '#1a0a0e', meme: '#000000', tom: '#ffe2d4' };
// 플레이어: 바탕 · 재생 단추(null = 캐릭터 색) · 단추 안 기호 · 글자 · 막대 바탕
const TR = {
  ign: { bg: '#16223b', play: null, ico: '#0b1426', txt: '#a9bde3', rail: '#22345a' },
  mes: { bg: '#0b2f57', play: '#ffd400', ico: '#0b2f57', txt: '#e6f5ff', rail: '#1d4f86' },
  tale: { bg: '#2a0d13', play: '#9a1428', ico: '#f6d58a', txt: '#e0b9c0', rail: '#4a1620' },
  meme: { bg: '#141414', play: '#ffffff', ico: '#000000', txt: '#cfcfcf', rail: '#2e2e2e' },
  snow: { bg: '#e9f2fc', play: null, ico: '#ffffff', txt: '#2b4a7a', rail: '#cddcf0' },
  tom: { bg: '#ffe3d3', play: '#e0402a', ico: '#ffffff', txt: '#9a4a30', rail: '#ffc9b4' },
};
const EQ_BG = { mes: '#ffffff', tom: '#ffffff', snow: '#ffffff' };
const XMAS = ['#2fb83a', '#8fbf25', '#f0a51c', '#ff6a1c', '#f0331c'];

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** 색 hex 를 바탕 bg 위에서 대비 min 이상이 되게 흰/검정 쪽으로 명도만 당겨요 */
export const fit = (h, bg, min = 4.5) => { const B = rgb(bg), to = lum(B) > 0.35 ? [0, 0, 0] : [255, 255, 255]; let c = rgb(h); for (let t = 0; t <= 1 && ratio(c, B) < min; t += 0.03) c = rgb(h).map((v, i) => v + (to[i] - v) * t); return hex(c); };
// 11-10: 커뮤니티 사이트는 바탕 대비 4.5 미만인 글자색을 덮어써요(실제 글에서 4.41 은 덮이고 4.79 는 남음). 그래서 테마 글자색을 놓이는 자리의 바탕색에 맞춰 4.6 이상으로 당겨 둬요.
//   머리(곡 번호 · 제목 · 부제) = HEAD_BG · 가사 카드(이름표 · 단추 · 안내 · 흐린 가사 줄) = NP_BG · 캐릭터 칩 = CHIP_BG · 플레이어 글자 = TR.bg
const SAFE = 4.6;
const HEAD_BG = { ign: '#0c1529', mes: '#1672bd', tale: '#150709', meme: '#000000', tom: '#fffaf2', snow: '#ffffff' };
const NP_BG = { ign: '#0b1426', mes: '#ffffff', tale: '#1a0a0e', meme: '#000000', tom: '#fffaf2', snow: '#ffffff' };
const PS_BG = { ign: '#16223b', mes: '#e6f5ff', tale: '#2a0d13', meme: '#1a1a1a', tom: '#ffe3d3', snow: '#e9f2fc' };
const CHIP_BG = { ign: '#121d33', mes: '#0b2f57', tale: '#2a0d13', meme: '#151515', tom: '#ffffff', snow: '#ffffff' };
for (const th of Object.keys(TH)) {
  for (const k of ['title', 'orig', 'no']) TH[th][k] = fit(TH[th][k], HEAD_BG[th], SAFE);
  for (const k of ['sub', 'meta', 'btn', 'nphC']) TH[th][k] = fit(TH[th][k], NP_BG[th], SAFE);
  TH[th].btn = fit(TH[th].btn, PS_BG[th], SAFE);   // 일시정지 단추는 자기 동그란 바탕 위에 놓여요
  TR[th].txt = fit(TR[th].txt, TR[th].bg, SAFE);
}
const xmasAt = t => { const k = Math.min(XMAS.length - 2, Math.floor(t * (XMAS.length - 1))), f = t * (XMAS.length - 1) - k, a = rgb(XMAS[k]), b = rgb(XMAS[k + 1]); return hex(a.map((v, i) => v + (b[i] - v) * f)); };
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sec = t => (Math.round(t * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '') + 's';
const P = (x, base) => (x / base * 100).toFixed(4).replace(/\.?0+$/, '') + '%';
export const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export const isHex = s => /^#[0-9a-f]{6}$/i.test(String(s || ''));
const seeded = (seed = 11) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ── 가사 읽기: LRC([mm:ss.xx]글) · [m:ss] 글 · m:ss 글. 시각 없는 줄은 바로 위 줄의 작은 글(번역 · 원문). [ti:] [ar:] [length:] 머리도 읽어요. ──
export function parseLyrics(text) {
  const lines = [], meta = {}, warn = [];
  const TIME = /^\s*(?:\[(\d{1,2}):(\d{1,2}(?:[.:]\d{1,3})?)\]\s*)+/;
  const ONE = /\[(\d{1,2}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
  const BARE = /^\s*(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\s+(.*)$/;
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const t = raw.trim();
    if (!t) continue;
    const mt = /^\[(ti|ar|al|length|by|offset)\s*:\s*([^\]]*)\]\s*$/i.exec(t);
    if (mt) { meta[mt[1].toLowerCase()] = mt[2].trim(); continue; }
    let stamps = [], body = '';
    if (TIME.test(t)) { const head = TIME.exec(t)[0]; body = t.slice(head.length).trim(); for (const m of head.matchAll(ONE)) stamps.push(Number(m[1]) * 60 + Number(m[2].replace(':', '.'))); }
    else if (BARE.test(t)) { const m = BARE.exec(t); stamps = [Number(m[1]) * 60 + Number(m[2])]; body = m[3].trim(); }
    if (!stamps.length) { const p = lines[lines.length - 1]; if (p) p.sub = p.sub ? `${p.sub} ${t}` : t; else warn.push(`시각 없는 첫 줄은 뺐어요: ${t.slice(0, 20)}`); continue; }
    if (!body) continue;
    for (const s of stamps) lines.push({ s, main: body, sub: '' });
  }
  lines.sort((a, b) => a.s - b.s);
  const out = [];
  for (const l of lines) { const p = out[out.length - 1]; if (p && Math.abs(p.s - l.s) < 0.001) { p.sub = p.sub ? `${p.sub} ${l.main}` : l.main; } else out.push(l); }
  return { lines: out, meta, warn };
}

// ── 효과 층 ──
// 빗줄기 타일(SVG data 주소 · <style> 규칙 안의 url(data:) 는 깡싸에서 살아요). W×H 타일에 n 줄기 — deg 만큼 기울고 위는 투명 · 아래로 갈수록 진해요(조각 6개로 계단). 가장자리에 걸친 줄기는 맞은편에도 그려 이음매가 없어요.
const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const f1 = v => String(Math.round(v * 10) / 10);
function rainTile({ W, H, n, seed, rgb, h: [h0, h1], a: [a0, a1], deg }) {
  const R = mulberry(seed), sin = Math.sin(deg * Math.PI / 180), cos = Math.cos(deg * Math.PI / 180), SEG = 6;
  let p = '';
  for (let i = 0; i < n; i++) {
    const x = (i + 0.15 + R() * 0.7) * W / n, y = (((i * 0.618 + R() * 0.35) % 1)) * H, h = h0 + R() * (h1 - h0), a = a0 + R() * (a1 - a0);
    for (const [ox, oy] of [[0, 0], [W, 0], [0, -H], [W, -H]]) {
      if (ox && x - h * sin >= 0) continue; if (oy && y + h * cos <= H) continue;
      for (let s = 0; s < SEG; s++) {
        const t0 = s / SEG, t1 = (s + 1) / SEG;
        p += `%3Cpath d='M${f1(x + ox - h * sin * t0)} ${f1(y + oy + h * cos * t0)}L${f1(x + ox - h * sin * t1)} ${f1(y + oy + h * cos * t1)}' stroke-opacity='${(a * (s + 0.5) / SEG).toFixed(3).replace(/^0/, '')}'/%3E`;
      }
    }
  }
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'%3E%3Cg fill='none' stroke='rgb(${rgb})' stroke-width='1'%3E${p}%3C/g%3E%3C/svg%3E")`;
}
/** 비 두 겹: 타일을 한 장만큼 transform 으로 흘려요(다시 그리지 않아요). 넓은 화면(640px 이상)은 한 겹만 — 낱개 줄기 때도 넓으면 성겼어요. slope = 가로/세로 흐름 비 */
function rainCss({ box, kf, slope, rgb, h, a, deg, durA, durB, seed = 7 }) {
  const A = { H: 750, n: 5 }, B = { H: 600, n: 3 }; A.W = Math.round(A.H * slope); B.W = Math.round(B.H * slope);
  const one = (pseudo, T, nm, dur, delay, sd) => `${box}::${pseudo}{content:'';position:absolute;left:0;right:-${T.W}px;top:-${T.H}px;bottom:0;pointer-events:none;background-image:${rainTile({ W: T.W, H: T.H, n: T.n, seed: sd, rgb, h, a, deg })};background-size:${T.W}px ${T.H}px;background-repeat:repeat;animation:${nm} ${dur}s linear ${delay}s infinite}`;
  return `@keyframes ${kf}a{to{transform:translate3d(-${A.W}px,${A.H}px,0)}}
@keyframes ${kf}b{to{transform:translate3d(-${B.W}px,${B.H}px,0)}}
${one('before', A, kf + 'a', durA, 0, seed)}
${one('after', B, kf + 'b', durB, -0.31, seed + 11)}
@media (min-width:640px){
${box}::after{display:none}
}`;
}
// 11-13 가볍게: 비 줄기는 낱개 요소(곡마다 42개 · 각자 infinite 움직임)를 만들지 않고 타일 무늬 두 겹(.kb-rain::before · ::after)으로 흘려요. RAIN_N 은 난수 차례를 지키려고만 남겨요(물방울 · 색종이 · 파편 · 눈 자리가 예전과 같게).
const RAIN_N = 42, DROP_N = 7, CF_N = 30, SH_N = 12, FLK_N = 34;
const many = (tag, cls, n) => Array.from({ length: n }, (_, k) => `<${tag} class="${cls}${k}"></${tag}>`).join('');
const FX = {
  ign: `<div class="kb-fx kb-rain" aria-hidden="true">${many('b', 'd', DROP_N)}<em></em></div>`,
  mes: `<div class="kb-fx kb-cf" aria-hidden="true">${many('i', 'p', CF_N)}</div>`,
  tale: `<div class="kb-fx kb-shard" aria-hidden="true">${many('b', 'l', 5)}${many('i', 's', SH_N)}</div>`,
  snow: `<div class="kb-fx kb-flk" aria-hidden="true">${many('i', 'f', FLK_N)}</div>`,
  meme: '', tom: '',
};
const MOTIF = {
  snow: '<span class="kb-wnd" aria-hidden="true"></span>',
  ign: '<span class="kb-moon" aria-hidden="true"></span>',
  mes: '<span class="kb-coin" aria-hidden="true"><i></i></span>',
  tale: '<span class="kb-apple" aria-hidden="true" style="color:#ff6b7d">🍎</span>',
  meme: '<span class="kb-rec" style="color:#ff3b3b">● REC</span>',
  tom: '<span class="kb-emo" aria-hidden="true" style="color:#b83220">🍅</span><span class="kb-emo kb-emo2" aria-hidden="true" style="color:#2f7a2b">🦎</span>',
};
const fxCss = (() => {
  const rnd = seeded(11), out = {};
  for (let k = 0; k < RAIN_N * 5; k++) rnd();   // 예전 줄기 42개가 쓰던 난수 5개씩을 그대로 흘려보내요
  out.ign = rainCss({ box: '.kr .kb-rain', kf: 'kb-rn', slope: 330 / 1500, rgb: '190,215,255', h: [34, 72], a: [0.25, 0.5], deg: 16, durA: 0.55, durB: 0.62 })
    + '\n' + Array.from({ length: DROP_N }, (_, k) => { const z = 5 + Math.round(rnd() * 5), dur = 9 + rnd() * 8; return `.kr .kb-rain .d${k}{left:${(6 + rnd() * 88).toFixed(1)}%;top:${(4 + rnd() * 40).toFixed(1)}%;width:${z}px;height:${z + 2}px;block-size:${z + 2}px;animation:kb-drop ${dur.toFixed(1)}s ease-in ${(-rnd() * dur).toFixed(1)}s infinite}`; }).join('\n');
  out.snow = Array.from({ length: FLK_N }, (_, k) => { const z = 3 + Math.round(rnd() * 6), dur = 7 + rnd() * 8; return `.kr .kb-flk .f${k}{left:${(k / FLK_N * 100 + rnd() * 3).toFixed(1)}%;width:${z}px;height:${z}px;block-size:${z}px;opacity:${(0.55 + rnd() * 0.4).toFixed(2)};animation:kb-flake${k % 2} ${dur.toFixed(1)}s linear ${(-rnd() * dur).toFixed(1)}s infinite}`; }).join('\n');
  const CF_COL = ['#ff3b3b', '#ffd400', '#2ed158', '#2f6bff', '#ff2fb4', '#19d9ff'];
  out.mes = Array.from({ length: CF_N }, (_, k) => { const w = 6 + Math.round(rnd() * 4), h = 9 + Math.round(rnd() * 7), dur = 6 + rnd() * 6; return `.kr .kb-cf .p${k}{left:${(k / CF_N * 100 + rnd() * 3).toFixed(1)}%;width:${w}px;height:${h}px;block-size:${h}px;background-color:${CF_COL[k % 6]};animation:kb-fall${k % 3} ${dur.toFixed(2)}s linear ${(-rnd() * dur).toFixed(2)}s infinite}`; }).join('\n');
  out.tale = Array.from({ length: 5 }, (_, k) => `.kr .kb-shard .l${k}{left:${[-10, 18, 46, 70, 92][k]}%;top:${[-6, 14, -10, 30, 4][k]}%;animation:kb-glint ${(5 + k * 1.3).toFixed(1)}s ease-in-out ${(-k * 1.7).toFixed(1)}s infinite}`).join('\n')
    + '\n' + Array.from({ length: SH_N }, (_, k) => { const z = 7 + Math.round(rnd() * 9), dur = 11 + rnd() * 9; return `.kr .kb-shard .s${k}{left:${(k / SH_N * 100 + rnd() * 5).toFixed(1)}%;width:${z}px;height:${z}px;block-size:${z}px;background-color:${['#ff2b4a', '#ff8095', '#c4122e', '#ffd0d7'][k % 4]};animation:kb-shardf ${dur.toFixed(1)}s linear ${(-rnd() * dur).toFixed(1)}s infinite}`; }).join('\n');
  return out;
})();

const SANS = "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
const SERIF = "'Noto Serif KR','Nanum Myeongjo','Apple SD Gothic Neo',Georgia,serif";
const MONO = "ui-monospace,'SFMono-Regular','Cascadia Mono',Menlo,Consolas,monospace";
const MIN_SPAN = 600;   // 시계 「분」 키프레임 길이(10분 — 곡마다 iteration-count = 길이/600 ≤ 1 이라 4분 넘는 곡도 되감기지 않아요)
const minK = Array.from({ length: 10 }, (_, m) => `${P(m * 60, MIN_SPAN)}{--kr-m:${m}}${P((m + 1) * 60 - 0.02, MIN_SPAN)}{--kr-m:${m}}`).join('') + '100%{--kr-m:10}';
const secK = Array.from({ length: 60 }, (_, n) => `${P(n, 60)}{--kr-ss:${n}}${P(n + 0.98, 60)}{--kr-ss:${n}}`).join('') + '100%{--kr-ss:0}';
const winCss = th => `.kr.kt-${th} .kr-win{height:${TH[th].WIN}px;block-size:${TH[th].WIN}px}
.kr.kt-${th} .kr-strip{transform:translateY(${(TH[th].WIN - TH[th].H) / 2 - TH[th].H}px)}
.kr.kt-${th} .kr-l{height:${TH[th].H}px;block-size:${TH[th].H}px}`;
const SNOWCAP = 'background-image:radial-gradient(24% 90% at 12% 100%,#ffffff 97%,rgba(255,255,255,0) 100%),radial-gradient(30% 112% at 40% 100%,#ffffff 97%,rgba(255,255,255,0) 100%),radial-gradient(26% 100% at 68% 100%,#ffffff 97%,rgba(255,255,255,0) 100%),radial-gradient(22% 86% at 90% 100%,#ffffff 97%,rgba(255,255,255,0) 100%),linear-gradient(180deg,rgba(214,228,246,0) 60%,#d6e4f6 100%),linear-gradient(#ffffff,#ffffff);background-size:100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 55%;background-position:0 0,0 0,0 0,0 0,0 0,0 100%;background-repeat:no-repeat;filter:drop-shadow(0 1px 1.5px rgba(60,95,140,.55))';

const COMMON_CSS = `
@keyframes kr-on{0%,100%{--kr-o:1}}
@keyframes kr-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes kr-min{${minK}}
@keyframes kr-sec{${secK}}
@keyframes kb-spin{to{transform:rotate(360deg)}}
@keyframes kb-eqk{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
.kr{max-width:620px;margin:0 auto;padding:0;font-family:${SANS};line-height:1.45;color:#e8ecf5}
.kr *{box-sizing:border-box}
.kr div,.kr span,.kr p,.kr li,.kr td{color:inherit}
.kr .kr-card{position:relative;padding:16px 14px 18px;border-radius:24px;clip-path:inset(0 round 24px);color:#e8ecf5}
.kr .kb-fx{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden!important;overflow-x:clip!important;clip-path:inset(0)!important}
.kr .kb-fx *{position:absolute;display:block;pointer-events:none}
/* 가볍게(11-13): 화면 밖 효과 칸 · 춤추는 막대 칸은 쉬어요(크기가 정해진 칸만이라 글 높이는 안 바뀌어요). 가사 줄은 opacity 를 직접 움직이지 않고 --kr-o 를 움직여요(줄마다 겹이 생기지 않게 — kr-on). 카드의 overflow-x:clip 은 도는 레코드판 모서리가 문서 폭을 늘리지 않게. */
.kr .kb-fx,.kr .kb-play{content-visibility:auto}
.kr .kb-eq{content-visibility:auto;contain-intrinsic-size:18px 14px}
.kr .kr-card{overflow-x:clip}
.kr .kb-hero{position:relative;z-index:0;margin:2px 0 14px}
.kr .kb-head,.kr .kb-np{position:relative;z-index:2}
.kr .kb-cv{position:relative;z-index:1;width:76%;line-height:0}
.kr .kb-port .kb-cv{width:54%;margin-left:5%}
.kr .kb-sq .kb-cv{width:64%;margin-left:2%}
.kr .kb-cv img{display:block;width:100%;height:auto;max-width:100%;margin:0;border-radius:inherit}
.kr .kb-cv .image-number-wrapper{display:contents!important}
.kr .image-number-badge{display:none!important}
.kr .kb-dk{position:absolute;z-index:0;top:50%;left:50%;width:48%;transform:translateY(-50%)}
.kr .kb-port .kb-dk{left:39%;width:58%}
.kr .kb-sq .kb-dk{left:42%;width:56%}
.kr .kb-nocv .kb-dk{position:relative;left:auto;top:auto;transform:none;width:46%;margin:6px auto 4px}
.kr .kb-disc{width:100%;aspect-ratio:1/1;border-radius:50%;background-color:#0c0c0e;box-shadow:0 10px 26px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.06);animation:kb-spin 2.4s linear infinite}
.kr .kb-head{border-radius:18px;padding:13px 15px 13px;margin:0 0 12px}
.kr .kb-no{display:block;font:700 11px/1 ${MONO};letter-spacing:.22em}
.kr .kb-ti{display:block;font-size:27px;line-height:1.15;font-weight:800;letter-spacing:-.01em;margin-top:7px;word-break:keep-all}
.kr .kb-or{display:block;font-size:12.5px;line-height:1.3;margin-top:3px;letter-spacing:.06em}
.kr .kb-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.kr .kb-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 11px 3px 8px;border-radius:99px;font-size:12px;font-weight:700;letter-spacing:.04em;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}
.kr .kb-chip i{display:inline-block;width:8px;height:8px;block-size:8px;border-radius:50%}
.kr .kb-np{border-radius:20px;padding:9px 10px 7px}
.kr audio::-webkit-media-controls-enclosure{background-color:transparent;border-radius:99px}
.kr audio::-webkit-media-controls-panel{background-color:transparent}
.kr .kr-win{position:relative;border-radius:14px;overflow:hidden!important;overflow-x:clip!important;clip-path:inset(0 round 14px)!important}
.kr .kr-win::before{content:'';position:absolute;left:4px;right:4px;top:32px;height:40px;block-size:40px;border-radius:13px;z-index:0}
.kr .kr-win::after{content:'';position:absolute;inset:0;z-index:2;pointer-events:none}
.kr .kr-strip{position:relative;z-index:1}
.kr .kr-l{display:flex;align-items:center;justify-content:center;text-align:center;padding:0 14px;opacity:var(--kr-o,.38)}
.kr .kr-tx{display:block;max-width:100%;line-height:1.22;word-break:keep-all;overflow-wrap:anywhere}
.kr .kr-ko{font-size:13.5px;font-weight:700}
.kr .kr-jp{font-size:10.5px;font-weight:500;margin-left:4px;letter-spacing:.02em}
.kr .kr-intro .kr-jp{margin-left:0;letter-spacing:.08em}
.kr .kr-bar{overflow:hidden!important;overflow-x:clip!important;clip-path:inset(0 round 9px)!important}
.kr .kr-bar i{display:block;transform:scaleX(0);transform-origin:0 50%}
.kr .kr-clock{counter-reset:krm var(--kr-m) krs var(--kr-ss)}
.kr .kr-clock::before{content:counter(krm) ':' counter(krs,decimal-leading-zero)}
.kr .kr-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;user-select:none}
.kr .kr-btn input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
.kr .kr-btn .kr-on{display:none}
.kr .kr-btn:has(input:checked) .kr-on{display:inline}
.kr .kr-btn:has(input:checked) .kr-off{display:none}
.kr .kr-btn:has(input:focus-visible){outline:2px solid currentColor;outline-offset:2px}
.kr .kr-ps{width:22px;height:22px;block-size:22px;border-radius:50%;font-size:8px;letter-spacing:-.05em;flex:none}
.kr .kr-fb{display:flex;justify-content:flex-end;margin-top:3px}
.kr .kr-go{font-size:10px;font-weight:500;padding:1px 2px}
.kr .kr-go:has(input:checked){font-weight:800}
.kr .kr-pl{position:relative;display:block;height:40px;block-size:40px;border-radius:99px;margin:0 0 7px;outline:none}
.kr .kr-pl audio{position:absolute;left:0;top:0;z-index:3;display:block;width:100%;height:40px;block-size:40px;margin:0;opacity:.01;cursor:pointer;color-scheme:dark}
.kr .kr-pl:has(audio:focus-visible){box-shadow:0 0 0 2px currentColor}
.kr .kb-tr{position:absolute;inset:0;z-index:1;border-radius:99px;pointer-events:none}
.kr .kb-play{position:absolute;left:9px;top:3px;width:34px;height:34px;block-size:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px rgba(255,255,255,.08),0 4px 12px rgba(0,0,0,.35)}
.kr .kb-tri{display:block;width:0;height:0;margin-left:3px;border-style:solid;border-width:7px 0 7px 11px;border-color:transparent}
.kr .kb-bars{display:none;align-items:flex-end;gap:2px;height:14px;block-size:14px}
.kr .kb-bars i,.kr .kb-eq i{display:block;width:3px;height:14px;block-size:14px;border-radius:2px;transform-origin:50% 100%;transform:scaleY(.35);animation:kb-eqk .9s ease-in-out infinite alternate}
.kr .kb-bars i:nth-child(2),.kr .kb-eq i:nth-child(2){animation-duration:.7s;animation-delay:-.3s}
.kr .kb-bars i:nth-child(3),.kr .kb-eq i:nth-child(3){animation-duration:1.1s;animation-delay:-.6s}
.kr .kb-eq i:nth-child(4){animation-duration:.8s;animation-delay:-.2s}
.kr .kb-time{position:absolute;left:48px;top:0;height:40px;block-size:40px;display:flex;align-items:center;font:600 10.5px/1 ${MONO};font-variant-numeric:tabular-nums;white-space:nowrap}
.kr .kb-tr .kr-bar{position:absolute;left:132px;right:92px;top:18px;height:4px;block-size:4px;border-radius:9px}
.kr .kb-tr .kr-bar i{height:4px;block-size:4px}
.kr .kb-ic{position:absolute;top:0;height:40px;block-size:40px;width:24px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
.kr .kb-vol{right:46px}
.kr .kb-more{right:14px;letter-spacing:-.05em}
.kr .kb-nph{display:flex;align-items:center;gap:8px;padding:0 2px 7px;font-size:10.5px;font-weight:700;letter-spacing:.08em}
.kr .kb-lab{flex:1;min-width:0;font-size:10.5px;font-weight:800;letter-spacing:.1em;white-space:nowrap;overflow:hidden!important;overflow-x:clip!important;clip-path:inset(0)!important;text-overflow:ellipsis}
.kr .kb-eq{display:flex;align-items:flex-end;gap:2px;height:14px;block-size:14px}
.kr .kb-eq i{opacity:.35}
@container style(--kr-run: running){
.kr .kb-tri{display:none}
.kr .kb-bars{display:flex}
.kr .kb-eq i{opacity:1}
}
.kr .kr-card:has(.kr-go input:checked) .kb-tri{display:none}
.kr .kr-card:has(.kr-go input:checked) .kb-bars{display:flex}
.kr .kr-card:has(.kr-ps input:checked) .kb-tri{display:block}
.kr .kr-card:has(.kr-ps input:checked) .kb-bars{display:none}
.kr .kr-strip.kr-an,.kr .kr-bar i.kr-an,.kr .kr-clock.kr-an{animation-play-state:paused}
.kr .kr-l.kr-an{animation-name:kr-on;animation-timing-function:linear;animation-iteration-count:1;animation-fill-mode:none;animation-play-state:paused}
.kr .kr-card{--kr-run:paused;transition:--kr-run 0s 86400s;transition-behavior:allow-discrete}
.kr .kr-card:has(.kr-pl:focus-within),.kr .kr-card:has(.kr-pl:active),.kr .kr-card:has(audio:active),.kr .kr-card:has(audio:focus){--kr-run:running;transition:none}
.kr .kr-card .kr-an{animation-play-state:var(--kr-run,paused)}
.kr .kr-card:has(.kr-go input:checked) .kr-an{animation-play-state:running}
.kr .kr-card:has(.kr-ps input:checked) .kr-an{animation-play-state:paused!important}
`;

const THEME_CSS = {
  ign: `/* ── 비 오는 밤의 방 · 폰 알림 ── */
@keyframes kb-drop{0%{transform:translate3d(0,0,0);opacity:0}8%{opacity:.9}70%{opacity:.8}100%{transform:translate3d(0,420px,0);opacity:0}}
@keyframes kb-shim{0%,62%{transform:translate3d(-120%,0,0)}100%{transform:translate3d(120%,0,0)}}
.kr .kb-ign{background-color:#08101f;background-image:radial-gradient(38% 22% at 86% 4%,rgba(205,222,255,.30),rgba(205,222,255,0) 70%),radial-gradient(55% 28% at 6% 98%,rgba(255,170,90,.16),rgba(255,170,90,0) 70%),linear-gradient(180deg,#0d1834 0%,#070c19 100%)}
.kr .kb-ign .kb-cv{border-radius:16px;padding:7px;background-color:#16223e;box-shadow:0 0 0 1px rgba(170,195,255,.22),0 0 46px -8px var(--glow),0 18px 30px rgba(0,0,0,.5)}
.kr .kb-ign .kb-cv img{border-radius:10px}
.kr .kb-ign .kb-cv::after{content:'';position:absolute;inset:7px;border-radius:10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.10),inset 0 -40px 50px -30px rgba(5,10,25,.7);pointer-events:none}
.kr .kb-ign .kb-head{background-color:#0c1529;box-shadow:inset 0 0 0 1px rgba(150,180,240,.12)}
.kr .kb-ign .kb-ti{text-shadow:0 0 18px rgba(170,200,255,.35)}
.kr .kb-ign .kb-chip{background-color:#121d33}
.kr .kb-moon{position:absolute;right:16px;top:14px;width:22px;height:22px;block-size:22px;border-radius:50%;box-shadow:inset -6px -3px 0 0 #dfe8ff;transform:rotate(-20deg);filter:drop-shadow(0 0 8px rgba(210,225,255,.7))}
.kr .kb-ign .kb-np{background-color:#0b1426;border-radius:24px;box-shadow:inset 0 0 0 1px #24355a,0 14px 26px rgba(0,0,0,.45)}
.kr .kb-ign .kr-pl{background-color:${TR.ign.bg}}
.kr .kb-ign .kb-tri{border-left-color:${TR.ign.ico}}
.kr .kb-ign .kb-bars i{background-color:${TR.ign.ico}}
.kr .kb-ign .kr-bar{background-color:${TR.ign.rail}}
.kr .kb-ign .kr-win{background-color:#0b1426}
.kr .kb-ign .kr-win::before{background-color:#1a2a4b;box-shadow:inset 0 0 0 1px rgba(140,170,240,.18)}
.kr .kb-ign .kr-win::after{background-image:linear-gradient(#0b1426,rgba(11,20,38,0) 26%,rgba(11,20,38,0) 74%,#0b1426)}
.kr .kb-ign .kr-ps{background-color:#16223b}
.kr .kb-rain b{border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;background-color:rgba(190,215,255,.08);background-image:radial-gradient(circle at 35% 30%,rgba(255,255,255,.75) 0 12%,rgba(200,220,255,.18) 30%,rgba(200,220,255,0) 70%);box-shadow:0 1px 2px rgba(0,0,0,.35)}
.kr .kb-rain em{top:0;left:0;right:0;bottom:0;background-image:linear-gradient(110deg,rgba(170,200,255,0) 40%,rgba(170,200,255,.08) 50%,rgba(170,200,255,0) 60%);animation:kb-shim 11s ease-in-out infinite}
${fxCss.ign}`,
  mes: `/* ── 하늘 팝 · 최면 코인 · 색종이 ── */
@keyframes kb-fall0{0%{transform:translate3d(0,-40px,0) rotateX(0) rotateZ(0)}25%{transform:translate3d(16px,360px,0) rotateX(200deg) rotateZ(80deg)}50%{transform:translate3d(-12px,760px,0) rotateX(380deg) rotateZ(170deg)}75%{transform:translate3d(14px,1160px,0) rotateX(560deg) rotateZ(260deg)}100%{transform:translate3d(0,1600px,0) rotateX(720deg) rotateZ(360deg)}}
@keyframes kb-fall1{0%{transform:translate3d(0,-40px,0) rotateX(0) rotateZ(20deg)}25%{transform:translate3d(-18px,360px,0) rotateX(-170deg) rotateZ(-60deg)}50%{transform:translate3d(10px,760px,0) rotateX(-360deg) rotateZ(-150deg)}75%{transform:translate3d(-14px,1160px,0) rotateX(-530deg) rotateZ(-240deg)}100%{transform:translate3d(0,1600px,0) rotateX(-720deg) rotateZ(-340deg)}}
@keyframes kb-fall2{0%{transform:translate3d(0,-40px,0) rotateX(40deg) rotateZ(0)}33%{transform:translate3d(22px,520px,0) rotateX(300deg) rotateZ(120deg)}66%{transform:translate3d(-20px,1060px,0) rotateX(560deg) rotateZ(240deg)}100%{transform:translate3d(0,1600px,0) rotateX(760deg) rotateZ(360deg)}}
@keyframes kb-swing{from{transform:rotate(-20deg)}to{transform:rotate(20deg)}}
.kr .kb-mes{background-color:#36b2ee;background-image:radial-gradient(30% 9% at 18% 12%,#ffffff 0 60%,rgba(255,255,255,0) 61%),radial-gradient(22% 7% at 30% 10%,#ffffff 0 60%,rgba(255,255,255,0) 61%),radial-gradient(34% 10% at 84% 30%,rgba(255,255,255,.9) 0 60%,rgba(255,255,255,0) 61%),radial-gradient(40% 12% at 12% 72%,rgba(255,255,255,.85) 0 60%,rgba(255,255,255,0) 61%),linear-gradient(180deg,#76d4fb 0%,#2a9ee0 100%)}
.kr .kb-mes .kb-cv{border-radius:16px;padding:7px;background-color:#ffffff;transform:rotate(-2deg);box-shadow:0 0 0 3px #0b2f57,6px 8px 0 3px #0b2f57}
.kr .kb-mes .kb-cv img{border-radius:10px}
.kr .kb-mes .kb-head{background-color:#1672bd;border:3px solid #0b2f57;box-shadow:5px 5px 0 #0b2f57}
.kr .kb-mes .kb-ti{font-size:31px;font-weight:900;font-style:italic;letter-spacing:.01em;text-shadow:3px 3px 0 #0b2f57,-1px -1px 0 #0b2f57,1px -1px 0 #0b2f57,-1px 1px 0 #0b2f57}
.kr .kb-mes .kb-no{text-shadow:1px 1px 0 #0b2f57}
.kr .kb-mes .kb-chip{background-color:#0b2f57;box-shadow:none}
.kr .kb-coin{position:absolute;right:20px;top:-3px;width:34px;height:70px;block-size:70px;transform-origin:50% 0;animation:kb-swing 1.4s ease-in-out infinite alternate}
.kr .kb-coin::before{content:'';position:absolute;left:16px;top:0;width:2px;height:40px;block-size:40px;background-color:#0b2f57}
.kr .kb-coin i{position:absolute;left:0;bottom:0;width:34px;height:34px;block-size:34px;border-radius:50%;background-color:#ffd400;background-image:repeating-radial-gradient(circle,#ffd400 0 2px,#e8a400 2px 4px);box-shadow:0 0 0 2px #0b2f57,0 0 14px rgba(255,230,80,.9)}
.kr .kb-mes .kb-np{background-color:#ffffff;border:3px solid #0b2f57;box-shadow:6px 6px 0 #0b2f57}
.kr .kb-mes .kr-pl{background-color:${TR.mes.bg}}
.kr .kb-mes .kb-tri{border-left-color:${TR.mes.ico}}
.kr .kb-mes .kb-bars i{background-color:${TR.mes.ico}}
.kr .kb-mes .kr-bar{background-color:${TR.mes.rail}}
.kr .kb-mes .kr-win{background-color:#ffffff}
.kr .kb-mes .kr-win::before{background-color:#fff27a;box-shadow:inset 0 0 0 2px #0b2f57}
.kr .kb-mes .kr-win::after{background-image:linear-gradient(#ffffff,rgba(255,255,255,0) 26%,rgba(255,255,255,0) 74%,#ffffff)}
.kr .kb-mes .kr-ko{font-weight:900}
.kr .kb-mes .kr-ps{background-color:#e6f5ff;box-shadow:inset 0 0 0 2px #0b2f57}
.kr .kb-cf i{top:-24px;border-radius:1px}
${fxCss.mes}`,
  tale: `/* ── 어두운 동화 · 붉은 유리 빛 · 사과 ── */
@keyframes kb-glint{0%,100%{opacity:.25}50%{opacity:.85}}
@keyframes kb-shardf{from{transform:translate3d(0,-30px,0) rotate(0)}to{transform:translate3d(-40px,1500px,0) rotate(540deg)}}
.kr .kb-tale{background-color:#0d0507;background-image:linear-gradient(118deg,rgba(255,30,60,0) 38%,rgba(255,30,60,.16) 42%,rgba(255,30,60,0) 47%),linear-gradient(62deg,rgba(255,90,110,0) 58%,rgba(255,90,110,.10) 61%,rgba(255,90,110,0) 64%),radial-gradient(80% 40% at 50% 0%,#3a0a15,rgba(58,10,21,0) 70%),radial-gradient(60% 30% at 50% 100%,#2a0710,rgba(42,7,16,0) 70%)}
.kr .kb-tale .kb-cv{border-radius:6px;padding:6px;background-color:#1a0a0e;border:1px solid #9a7432;box-shadow:0 0 0 4px #1a0a0e,0 0 0 5px #5e1a26,0 0 50px -6px rgba(255,40,70,.5)}
.kr .kb-tale .kb-cv img{border-radius:2px}
.kr .kb-tale .kb-head{background-color:#150709;border:1px solid #4a1520;text-align:center}
.kr .kb-tale .kb-ti{font-family:${SERIF};font-size:25px;font-weight:700;text-shadow:0 0 16px rgba(255,40,70,.55)}
.kr .kb-tale .kb-or{font-family:${SERIF}}
.kr .kb-tale .kb-chips{justify-content:center}
.kr .kb-tale .kb-chip{background-color:#2a0d13}
.kr .kb-apple{position:absolute;right:14px;bottom:10px;font-size:22px;line-height:1;transform:rotate(-24deg);filter:drop-shadow(0 0 8px rgba(255,30,60,.6))}
.kr .kb-tale .kb-np{background-color:#1a0a0e;border:1px solid #6a2a34;box-shadow:inset 0 0 0 3px #1a0a0e,inset 0 0 0 4px #3e1219}
.kr .kb-tale .kb-lab{font-family:${SERIF};letter-spacing:.16em}
.kr .kb-tale .kr-pl{background-color:${TR.tale.bg}}
.kr .kb-tale .kb-tri{border-left-color:${TR.tale.ico}}
.kr .kb-tale .kb-bars i{background-color:${TR.tale.ico}}
.kr .kb-tale .kr-bar{background-color:${TR.tale.rail}}
.kr .kb-tale .kr-win{background-color:#1a0a0e}
.kr .kb-tale .kr-win::before{background-color:#1a0a0e;border-radius:0;border-top:1px solid #7a5a26;border-bottom:1px solid #7a5a26}
.kr .kb-tale .kr-win::after{background-image:linear-gradient(#1a0a0e,rgba(26,10,14,0) 26%,rgba(26,10,14,0) 74%,#1a0a0e)}
.kr .kb-tale .kr-tx{font-family:${SERIF}}
.kr .kb-tale .kr-ps{background-color:#2a0d13}
.kr .kb-shard b{width:3px;height:520px;block-size:520px;background-image:linear-gradient(rgba(255,40,70,0),rgba(255,60,90,.55),rgba(255,40,70,0));transform:rotate(28deg);filter:blur(1px)}
.kr .kb-shard i{top:-30px;clip-path:polygon(50% 0,100% 80%,10% 100%);opacity:.55}
${fxCss.tale}`,
  meme: `/* ── 검은 영상 화면 · 자막 ── */
@keyframes kb-blink{0%,49%{opacity:1}50%,100%{opacity:.15}}
.kr .kb-meme{background-color:#000000;box-shadow:inset 0 0 0 1px #1d1d1d}
.kr .kb-meme .kb-cv{padding:14px 0;background-color:#000000;border:1px solid #2a2a2a;border-radius:4px;margin-left:0}
.kr .kb-meme .kb-cv img{border-radius:0}
.kr .kb-meme .kb-head{background-color:#000000;border-top:1px solid #222;border-bottom:1px solid #222;border-radius:0;padding:12px 4px}
.kr .kb-meme .kb-ti{font-weight:900;font-size:25px;text-shadow:2px 2px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,0 0 14px rgba(255,255,255,.25)}
.kr .kb-meme .kb-chip{background-color:#151515}
.kr .kb-rec{position:absolute;right:6px;top:12px;font:800 10px/1 ${MONO};letter-spacing:.12em;animation:kb-blink 1.6s steps(1) infinite}
.kr .kb-meme .kb-np{background-color:#000000;border-radius:6px;box-shadow:inset 0 0 0 1px #262626;padding:8px 8px 6px}
.kr .kb-meme .kr-pl{background-color:${TR.meme.bg}}
.kr .kb-meme .kb-tri{border-left-color:${TR.meme.ico}}
.kr .kb-meme .kb-bars i{background-color:${TR.meme.ico}}
.kr .kb-meme .kr-bar{background-color:${TR.meme.rail}}
.kr .kb-meme .kr-win{background-color:#000000;border-radius:0}
.kr .kb-meme .kr-win::before{display:none}
.kr .kb-meme .kr-l{opacity:var(--kr-o,0)}
.kr .kb-meme .kr-ko{font-size:15px;font-weight:800;text-shadow:1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000}
.kr .kb-meme .kr-ps{background-color:#1a1a1a}`,
  snow: `/* ── 첫눈: 밝은 눈 오후 · 눈 쌓인 통통 글자 · 서리 유리 플레이어 ── */
@keyframes kb-flake0{0%{transform:translate3d(0,-20px,0)}25%{transform:translate3d(12px,320px,0)}50%{transform:translate3d(-8px,660px,0)}75%{transform:translate3d(10px,1000px,0)}100%{transform:translate3d(0,1350px,0)}}
@keyframes kb-flake1{0%{transform:translate3d(0,-20px,0)}25%{transform:translate3d(-10px,320px,0)}50%{transform:translate3d(9px,660px,0)}75%{transform:translate3d(-12px,1000px,0)}100%{transform:translate3d(0,1350px,0)}}
.kr .kb-snow{background-color:#f4f9ff;background-image:radial-gradient(60% 24% at 50% 0%,#dcecff,rgba(220,236,255,0) 75%),linear-gradient(180deg,#eaf3fe 0%,#ffffff 46%,#f2f8ff 100%);box-shadow:inset 0 0 0 1px #dbe8f7;padding-bottom:64px}
.kr .kb-snow::after{content:'';position:absolute;left:0;right:0;bottom:0;height:58px;block-size:58px;z-index:1;pointer-events:none;background-image:radial-gradient(58% 72% at 14% 100%,#ffffff 0 62%,rgba(255,255,255,0) 63%),radial-gradient(52% 84% at 56% 100%,#ffffff 0 62%,rgba(255,255,255,0) 63%),radial-gradient(46% 66% at 94% 100%,#ffffff 0 62%,rgba(255,255,255,0) 63%);filter:drop-shadow(0 -3px 4px rgba(120,160,210,.35))}
.kr .kb-flk i{top:-20px;border-radius:50%;background-image:radial-gradient(circle,#ffffff 0 30%,#c7dcf3 46%,rgba(199,220,243,0) 72%)}
${fxCss.snow}
.kr .kb-snow .kb-cv{border-radius:16px;padding:8px 8px 16px;background-color:#ffffff;background-image:linear-gradient(90deg,${XMAS.join(',')});background-size:100% 6px;background-position:0 calc(100% - 5px);background-repeat:no-repeat;box-shadow:0 0 0 1px #dbe8f7,0 14px 26px rgba(70,110,160,.22)}
.kr .kb-snow .kb-cv img{border-radius:10px}
.kr .kb-snow .kb-cv::before{content:'';position:absolute;z-index:2;left:-4px;right:-4px;top:-11px;height:22px;block-size:22px;${SNOWCAP}}
.kr .kb-snow .kb-cv::after{content:'';position:absolute;z-index:2;left:0;right:0;top:8px;height:14px;block-size:14px;background-image:radial-gradient(4px 8px at 16% 0,#ffffff 96%,rgba(255,255,255,0)),radial-gradient(3px 6px at 41% 0,#ffffff 96%,rgba(255,255,255,0)),radial-gradient(5px 10px at 72% 0,#ffffff 96%,rgba(255,255,255,0)),radial-gradient(3px 5px at 90% 0,#ffffff 96%,rgba(255,255,255,0));filter:drop-shadow(0 1px 1px rgba(60,95,140,.4));pointer-events:none}
.kr .kb-snow .kb-head{background-color:#ffffff;box-shadow:inset 0 0 0 2px #e3eefb,0 8px 18px rgba(70,110,160,.12);padding-top:20px;text-align:center}
.kr .kb-snow .kb-chips{justify-content:center}
.kr .kb-snow .kb-ti{font-size:44px;line-height:1.1;font-weight:900;letter-spacing:.1em;margin-top:16px}
.kr .kb-sc{position:relative;display:inline-block;margin-right:.02em;text-shadow:2px 2px 0 #ffffff,-2px -2px 0 #ffffff,2px -2px 0 #ffffff,-2px 2px 0 #ffffff,0 0 14px currentColor,0 4px 0 rgba(40,70,110,.12)}
.kr .kb-sc::before{content:'';position:absolute;left:-.04em;right:-.04em;top:-.12em;height:.24em;block-size:.24em;background-color:#ffffff;background-image:linear-gradient(180deg,#ffffff 50%,#d9e6f6);border-radius:50% 50% 38% 38% / 100% 100% 34% 34%;filter:drop-shadow(0 1px 1px rgba(60,95,140,.6))}
.kr .kb-sc::after{content:'';position:absolute;left:22%;top:.07em;width:.1em;height:.15em;block-size:.15em;border-radius:0 0 99px 99px;background-color:#ffffff;box-shadow:.36em -.02em 0 -.01em #ffffff;filter:drop-shadow(0 1px 0 rgba(60,95,140,.45))}
.kr .kb-snow .kb-chip{background-color:#ffffff}
.kr .kb-snow .kb-or{letter-spacing:.3em;font-size:11px;font-weight:700}
.kr .kb-wnd{position:absolute;right:16px;top:16px;width:26px;height:30px;block-size:30px;border-radius:5px 5px 3px 3px;background-color:#ffcf7a;background-image:linear-gradient(90deg,rgba(0,0,0,0) 45%,#b8452a 45% 55%,rgba(0,0,0,0) 55%),linear-gradient(180deg,rgba(0,0,0,0) 45%,#b8452a 45% 55%,rgba(0,0,0,0) 55%),radial-gradient(circle at 50% 70%,#fff2c4,#ffb74a);box-shadow:0 0 0 3px #b8452a,0 0 16px rgba(255,170,80,.6)}
.kr .kb-wnd::before{content:'';position:absolute;left:-6px;right:-6px;top:-9px;height:9px;block-size:9px;${SNOWCAP}}
.kr .kb-snow .kb-np{background-color:#ffffff;border-radius:22px;box-shadow:inset 0 0 0 2px #e3eefb,0 12px 24px rgba(70,110,160,.16)}
.kr .kb-snow .kr-pl{background-color:#e9f2fc;background-image:linear-gradient(180deg,rgba(255,255,255,.9),rgba(255,255,255,0) 60%);box-shadow:inset 0 0 0 1px #cfdff2,inset 0 1px 0 #ffffff,0 4px 12px rgba(70,110,160,.15)}
.kr .kb-snow .kb-play{box-shadow:0 0 0 3px #ffffff,0 3px 8px rgba(40,70,110,.3)}
.kr .kb-snow .kb-tri{border-left-color:#ffffff}
.kr .kb-snow .kb-bars i{background-color:#ffffff}
.kr .kb-snow .kr-bar{background-color:#cddcf0}
.kr .kb-snow .kr-bar i{background-image:linear-gradient(90deg,${XMAS.join(',')})}
.kr .kb-snow .kr-win{background-color:#ffffff}
.kr .kb-snow .kr-win::before{background-color:#eef5ff;box-shadow:inset 0 0 0 1px #d6e5f7}
.kr .kb-snow .kr-win::after{inset:auto;left:9px;right:9px;top:26px;height:11px;block-size:11px;${SNOWCAP}}
.kr .kb-snow .kr-l{opacity:var(--kr-o,.5)}
.kr .kb-snow .kr-ko{font-weight:800}
.kr .kb-snow .kr-ps{background-color:#e9f2fc}`,
  tom: `/* ── 따뜻한 물방울 무늬 · 스티커 ── */
@keyframes kb-bob{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-5px) rotate(6deg)}}
.kr .kb-tom{background-color:#fff0de;background-image:radial-gradient(rgba(255,140,110,.22) 18%,rgba(255,140,110,0) 20%),radial-gradient(rgba(120,190,90,.18) 18%,rgba(120,190,90,0) 20%);background-size:26px 26px,26px 26px;background-position:0 0,13px 13px}
.kr .kb-tom .kb-cv{border-radius:26px;padding:8px;background-color:#ffffff;transform:rotate(2deg);box-shadow:0 0 0 3px #e0402a,0 10px 0 3px #f2a08f,0 16px 26px rgba(150,60,30,.25)}
.kr .kb-tom .kb-cv img{border-radius:19px}
.kr .kb-tom .kb-head{background-color:#fffaf2;border:2px dashed #e0402a}
.kr .kb-tom .kb-ti{font-size:30px;font-weight:900;text-shadow:2px 2px 0 #ffd2c4}
.kr .kb-tom .kb-chip{background-color:#ffffff;box-shadow:inset 0 0 0 2px #cfe3ff}
.kr .kb-emo{position:absolute;right:16px;top:12px;font-size:24px;line-height:1;animation:kb-bob 2.2s ease-in-out infinite}
.kr .kb-emo2{right:48px;top:30px;font-size:20px;animation-delay:-1.1s}
.kr .kb-tom .kb-np{background-color:#fffaf2;border:2px solid #e0402a;box-shadow:0 5px 0 #f2a08f}
.kr .kb-tom .kr-pl{background-color:${TR.tom.bg}}
.kr .kb-tom .kb-tri{border-left-color:${TR.tom.ico}}
.kr .kb-tom .kb-bars i{background-color:${TR.tom.ico}}
.kr .kb-tom .kr-bar{background-color:${TR.tom.rail}}
.kr .kb-tom .kr-win{background-color:#fffaf2}
.kr .kb-tom .kr-win::before{background-color:#ffe2d4}
.kr .kb-tom .kr-win::after{background-image:linear-gradient(#fffaf2,rgba(255,250,242,0) 26%,rgba(255,250,242,0) 74%,#fffaf2)}
.kr .kb-tom .kr-l{opacity:var(--kr-o,.45)}
.kr .kb-tom .kr-ps{background-color:#ffe3d3}`,
};
const TAIL_CSS = `
@media (min-width:640px){
.kr .kr-card{padding:24px 26px 26px}
.kr .kb-ti{font-size:34px}
.kr .kb-mes .kb-ti{font-size:38px}
.kr .kb-tom .kb-ti{font-size:36px}
.kr .kr-ko{font-size:15px}
.kr .kb-meme .kr-ko{font-size:17px}
.kr .kr-jp{font-size:11.5px}
}
@media (prefers-reduced-motion: reduce){
.kr .kb-wnd{box-shadow:0 0 0 3px #b8452a}
.kr .kb-fx{display:none}
.kr .kb-coin,.kr .kb-emo,.kr .kb-rec{animation:none}
.kr .kb-disc{animation-duration:12s}
}`;

/** 곡 하나의 모양 · 시간을 정리해요(합치기 · 길이 · 경고). 돌려주는 것: { th, s(클래스 꼬리), L(줄), DUR, who, warn } */
function prepare(song, idx) {
  const warn = [];
  const th = THEMES[song.th] ? song.th : 'ign';
  const who = (song.who || []).filter(w => w && String(w.name || '').trim()).slice(0, 2).map(w => ({ name: String(w.name).trim().slice(0, 24), color: isHex(w.color) ? w.color.toLowerCase() : THEMES[th].accent }));
  if (!who.length) who.push({ name: '', color: isHex(song.color) ? song.color.toLowerCase() : THEMES[th].accent });
  const L0 = (song.lines || []).map(l => ({ s: Math.max(0, Number(l.s) || 0), main: String(l.main || '').trim(), sub: String(l.sub || '').trim() })).filter(l => l.main).sort((a, b) => a.s - b.s);
  let DUR = Number(song.dur) > 0 ? Number(song.dur) : 0;
  if (!DUR) { DUR = (L0.length ? L0[L0.length - 1].s : 0) + 5; warn.push(`곡 길이를 몰라 마지막 가사 + 5초(${mmss(DUR)})로 잡았어요 — 길이 칸에 적으면 정확해져요`); }
  const dropped = L0.filter(l => l.s > DUR - 0.5).length;
  if (dropped) warn.push(`곡 길이(${mmss(DUR)}) 뒤의 가사 ${dropped}줄은 뺐어요`);
  // 다음 줄까지 1초가 안 되는 줄은 다음 줄과 합쳐요(가운데에 머물 시간이 없는 줄은 보이지 않아요)
  const L = [];
  for (const l of L0.filter(l => l.s <= DUR - 0.5)) { const p = L[L.length - 1]; if (p && l.s - p.s < 1.0) { p.main += ' ' + l.main; p.sub = [p.sub, l.sub].filter(Boolean).join(' '); p.merged = true; } else L.push({ ...l }); }
  if (L.some(l => l.merged)) warn.push(`1초 안에 이어지는 가사 ${L.filter(l => l.merged).length}곳을 한 줄로 합쳤어요`);
  if (!L.length) { L.push({ s: 0, main: '♪', sub: '' }); warn.push('가사가 없어 「♪」 한 줄만 넣었어요'); }
  if (L[0].s > 2.5) warn.push(`전주가 ${L[0].s.toFixed(1)}초예요 — 첫 줄은 그때까지 흐리게 있어요`);
  return { th, s: `k${idx}`, L, DUR, who, warn, title: String(song.title || '').trim(), sub: String(song.sub || '').trim(), tag: String(song.tag || '').trim().slice(0, 12), mp3: String(song.mp3 || '').trim(), cover: song.cover && song.cover.src ? { src: String(song.cover.src).trim(), w: Number(song.cover.w) || 0, h: Number(song.cover.h) || 0 } : null };
}

function cardOf(S, i, no) {
  const T = TH[S.th], R = TR[S.th], { L, DUR, s } = S, N = L.length;
  const c = (T.WIN - T.H) / 2, ty = k => `translateY(${c - (k + 1) * T.H}px)`;   // 맨 위 「♪ 곡 이름」 줄 하나 + 1
  const strip = [`0%{transform:${ty(0)}}`];
  L.forEach((l, k) => { if (!k) return; const a = l.s - Math.min(0.3, 0.2 * (l.s - L[k - 1].s)); strip.push(`${P(a, DUR)}{transform:${ty(k - 1)}}`, `${P(l.s, DUR)}{transform:${ty(k)}}`); });
  strip.push(`100%{transform:${ty(N - 1)}}`);
  const a0 = S.who[0].color, a1 = (S.who[1] || S.who[0]).color;
  const css = `@keyframes kb-st-${s}{${strip.join('')}}
.kr.${s} .kr-strip.kr-an{animation-name:kb-st-${s};animation-duration:${sec(DUR)};animation-timing-function:ease-in-out;animation-iteration-count:1;animation-fill-mode:both}
.kr.${s} .kr-bar i.kr-an{animation-name:kr-bar;animation-duration:${sec(DUR)};animation-timing-function:linear;animation-iteration-count:1;animation-fill-mode:both}
.kr.${s} .kr-clock.kr-an{animation-name:kr-min,kr-sec;animation-duration:${MIN_SPAN}s,60s;animation-timing-function:linear;animation-iteration-count:${(DUR / MIN_SPAN).toFixed(5)},${(DUR / 60).toFixed(5)};animation-fill-mode:both}
.kr.${s} .kb-disc{background-image:radial-gradient(circle,#0c0c0e 0 3.5%,${a0} 4% 12%,${a1} 12% 18%,#0c0c0e 18.5% 19.5%,transparent 20%),conic-gradient(from 20deg,rgba(255,255,255,0) 0 10%,rgba(255,255,255,.13) 14%,rgba(255,255,255,0) 20% 60%,rgba(255,255,255,.09) 64%,rgba(255,255,255,0) 70%),repeating-radial-gradient(circle,#141416 0 1.5px,#212126 1.5px 3px)}
.kr.${s} .kb-cv{--glow:${a0}}
.kr.${s} .kb-play{background-color:${R.play || a0}}
.kr.${s} .kr-bar i{background-image:linear-gradient(90deg,${a0},${a1})}
.kr.${s} .kb-eq i{background-color:${fit(a0, EQ_BG[S.th] || '#101010', 3)}}
`;
  const cA = fit(fit(a0, HL[S.th], SAFE), NP_BG[S.th], SAFE), cB = fit(fit(a1, HL[S.th], SAFE), NP_BG[S.th], SAFE);
  const lineStyle = S.who.length > 1 ? `color:${cA};background-image:linear-gradient(90deg,${cA},${cB});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent` : `color:${cA}`;
  const rows = L.map((l, k) => {
    const st = k ? l.s : (L[0].s > 2.5 ? L[0].s : 0), end = k + 1 < N ? L[k + 1].s : DUR;   // 전주가 2.5초 넘으면 첫 줄은 그때까지 흐리게(짧으면 처음부터 밝게)
    return `<div class="kr-l kr-an${k ? '' : ' n0'}" style="animation-delay:${sec(st)};animation-duration:${sec(Math.max(0.2, end - st))}"><div class="kr-tx"><span class="kr-ko" style="${lineStyle}">${esc(l.main)}</span>${l.sub ? ` <span class="kr-jp" style="${lineStyle}">${esc(l.sub)}</span>` : ''}</div></div>`;
  }).join('');
  const names = S.who.map(w => w.name).filter(Boolean).join(' & ');
  const intro = `<div class="kr-l kr-intro"><div class="kr-tx"><span class="kr-jp" style="color:${T.sub}">♪ ${esc(S.title || '제목')}${names ? ` — ${esc(names)}` : ''}</span></div></div>`;
  const chips = S.who.filter(w => w.name).map(w => S.th === 'snow' ? `<span class="kb-chip" style="color:${fit(w.color, '#ffffff', SAFE)};box-shadow:inset 0 -3px 0 ${w.color},inset 0 0 0 1px #dfe9f6"><i style="background-color:${w.color}"></i>${esc(w.name)}</span>` : `<span class="kb-chip" style="color:${fit(w.color, CHIP_BG[S.th], SAFE)}"><i style="background-color:${w.color}"></i>${esc(w.name)}</span>`).join('');
  const ps = `<label class="kr-btn kr-ps" title="가사 일시정지" style="color:${T.btn}"><input type="checkbox" aria-label="가사 일시정지"><span class="kr-off" style="color:${T.btn}">❚❚</span><span class="kr-on" style="color:${T.btn}">▶</span></label>`;
  const top = `<div class="kb-nph"><span class="kb-lab" style="color:${T.nphC}">${T.nph}</span><span class="kb-eq" aria-hidden="true"><i class="kr-an"></i><i class="kr-an"></i><i class="kr-an"></i><i class="kr-an"></i></span>${ps}</div>`;
  const go = `<label class="kr-btn kr-go" style="color:${T.meta}"><input type="checkbox"><span class="kr-off" style="color:${T.meta}">가사가 안 움직이면 ▸</span><span class="kr-on" style="color:${T.meta}">가사 진행 중</span></label>`;
  const title = S.th === 'snow' ? (() => { const cs = [...(S.title || '제목')].filter(ch => ch !== ' '); let n = 0; return [...(S.title || '제목')].map(ch => ch === ' ' ? ' ' : `<span class="kb-sc" style="color:${fit(xmasAt(cs.length > 1 ? n++ / (cs.length - 1) : 0), HEAD_BG.snow, SAFE)}">${esc(ch)}</span>`).join(''); })() : esc(S.title || '제목');
  const orient = S.cover ? (S.cover.w && S.cover.h ? (S.cover.w > S.cover.h ? 'land' : S.cover.w < S.cover.h ? 'port' : 'sq') : 'sq') : 'nocv';
  const cover = S.cover ? `<div class="kb-cv"><img src="${esc(S.cover.src)}"${S.cover.w && S.cover.h ? ` width="${S.cover.w}" height="${S.cover.h}"` : ''} alt="업로드 이미지" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async"></div>` : '';
  const html = `<div class="kr kt-${S.th} ${s}">__STYLE__
<div class="kr-card kb-${S.th}">${FX[S.th]}
<div class="kb-hero kb-${orient}"><div class="kb-dk"><div class="kb-disc kr-an"></div></div>${cover}</div>
<div class="kb-head">${MOTIF[S.th]}<span class="kb-no" style="color:${T.no}">TRACK ${String(no).padStart(2, '0')}${S.tag ? ` · ${esc(S.tag)}` : ''}</span><b class="kb-ti" style="color:${T.title}">${title}</b>${S.sub ? `<span class="kb-or" style="color:${T.orig}">${esc(S.sub)}</span>` : ''}${chips ? `<span class="kb-chips">${chips}</span>` : ''}</div>
<div class="kb-np">${top}
<div class="kr-pl" tabindex="0"><div class="kb-tr" aria-hidden="true"><span class="kb-play"><i class="kb-tri"></i><b class="kb-bars"><i class="kr-an"></i><i class="kr-an"></i><i class="kr-an"></i></b></span><span class="kb-time"><span class="kr-clock kr-an" style="color:${R.txt}"></span><span class="kr-tot" style="color:${R.txt}">&nbsp;/&nbsp;${mmss(DUR)}</span></span><div class="kr-bar"><i class="kr-an"></i></div><span class="kb-ic kb-vol" style="color:${R.txt}">♪</span><span class="kb-ic kb-more" style="color:${R.txt}">⋯</span></div><audio src="${esc(S.mp3 || '__MP3__')}" controls="" preload="metadata" class="uploaded-audio"></audio></div>
<div class="kr-win"><div class="kr-strip kr-an">${intro}${rows}</div></div>
<div class="kr-fb">${go}</div>
</div>
</div>
</div>`;
  return { html, css };
}

/** 가장 바깥: 곡 목록 → 글 HTML. opts: { gaps(곡 사이 빈 코멘트 칸 · 기본 켬), start(첫 트랙 번호 · 기본 1), key(클래스 꼬리 시작 번호 · 기본 start) } */
export function buildPost(songs, opts = {}) {
  const list = (Array.isArray(songs) ? songs : [songs]).filter(Boolean);
  if (!list.length) return { html: '', warn: ['곡이 없어요'], songs: [] };
  const start = Number(opts.start) || 1, key0 = Number(opts.key) || start;
  const S = list.map((song, i) => prepare(song, key0 + i));
  const parts = S.map((x, i) => cardOf(x, i, start + i));
  const used = [...new Set(S.map(x => x.th))];
  const css = `${COMMON_CSS}${used.map(winCss).join('\n')}\n${parts.map(p => p.css).join('')}${used.map(th => THEME_CSS[th]).join('\n')}${TAIL_CSS}\n`;
  const gap = opts.gaps === false ? '\n' : '\n<p><br></p>\n';
  // 11-10: 사이트는 대비 낮은 글자의 color 만 인라인으로 덮어요. -webkit-text-fill-color 를 같은 색으로 같이 적어 두면 덮여도 화면에는 디자인 색이 그대로 그려져요(실제 글에서 확인).
  const keepInk = h => h.replace(/style="color:(#[0-9a-fA-F]{6})("|;)(?![^"]*-webkit-text-fill-color)/g, (m, c, end) => `style="color:${c};-webkit-text-fill-color:${c}${end}`);
  const html = keepInk(parts.map((p, i) => p.html.replace('__STYLE__', i === 0 ? `<style>${css}</style>` : '')).join(gap)) + '\n';
  const warn = S.flatMap((x, i) => x.warn.map(w => `${start + i}번 곡: ${w}`));
  if (S.some(x => !x.mp3)) warn.push('mp3 주소가 빈 곡이 있어요 — 자리표 __MP3__ 를 올린 mp3 주소로 바꿔요');
  return { html, warn, songs: S.map(x => ({ th: x.th, lines: x.L.length, dur: x.DUR })) };
}

/** 깡싸 정화기 · 사이트 규칙 자가 검사 — 문제가 없으면 [] */
export function checkPost(html) {
  const bad = [];
  const shown = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  for (const k of ['position:fixed', 'contenteditable', 'blob:', '<script', '@property']) if (html.includes(k)) bad.push(`${k} 가 있어요`);
  if (/<[a-z]+[^>]*\s(id|for|name)=/i.test(html)) bad.push('id · for · name 속성이 있어요(깡싸가 지워요)');
  if (/(^|[;{\s])height:\s*[\d.]+%(?!(!important)?;block-size)/.test(html)) bad.push('height:% 옆에 block-size 가 없어요');
  if (/overflow\s*:\s*hidden(?![^;}]*;[^}]*clip-path)/.test(html.replace(/\s/g, ''))) bad.push('overflow:hidden 옆에 clip-path 가 없어요');
  for (const w of ['원곡', '커버', '가수']) if (shown.includes(w)) bad.push(`화면 글에 「${w}」가 있어요`);
  if (/\bAI\b/.test(shown)) bad.push('화면 글에 「AI」가 있어요');
  // 글자를 담은 span · b 에 인라인 color 가 있는지(깡싸 「글씨색 자동 보정」 · :where 회색 규칙 대비)
  const noColor = [...html.replace(/<style>[\s\S]*?<\/style>/g, '').matchAll(/<(span|b)\b([^>]*)>([^<]*)</g)].filter(m => m[3].trim() && !/style="[^"]*color:/.test(m[2]));
  if (noColor.length) bad.push(`인라인 색이 없는 글자 ${noColor.length}곳: ${noColor.slice(0, 2).map(m => m[3].trim().slice(0, 12)).join(' · ')}`);
  return bad;
}
