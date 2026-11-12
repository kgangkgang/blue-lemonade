// 사본(11-11) — 원본 outputs/지시-1110/심플-기존틀-새방식/커스텀.cjs · CommonJS → ESM · slots 의 「마트가 바꾸는 글」 빼기를 조상까지로 넓힌 것만 바꿨어요( 설명서 지시-1111/커스텀/마트-연결.md)
// 11-11 커스텀 고리(지시-1111 커스텀 · Opus 5.5) — 틀마다 사용자가 바꿀 만한 값(숫자 · 개수 · 고르기 · 소품 글자)을 여는 공용 모듈이에요.
//   생성기 끝 한 줄: buildFrame(no, { cust: { … } }) 일 때만 바꿔요. cust 가 없거나 비어 있으면 받은 HTML 을 한 글자도 안 바꾸고 그대로 돌려줘요.
//   마트: applyCust(html, '묶음:k', cust, { cls }) — 정적 HTML 에 같은 결과를 걸어요(cls = 틀 class 를 마트가 바꿨을 때 그 이름).
//   바꾸는 방법은 셋뿐이에요(깡통 정화에서 사는 것만): ① 소품 글자 자리의 글자 ② 뿌리 div 에 class `gk-…` 하나 ③ ① 기본 덩이 끝에 그 class 에만 걸리는 규칙.
//   설명서: outputs/지시-1111/커스텀/마트-연결.md
import { px as PX } from './edge-px.js';
const svgUrl = (svg) => "url('data:image/svg+xml," + PX(String(svg).replace(/\s*\n\s*/g, ' ').replace(/>\s+</g, '><').trim()).replace(/[%#<>"'()&;{}\\]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')) + "')";
const mask = (sel, w, h, inner) => { const u = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="geometricPrecision">' + inner + '</svg>'); return sel + '{-webkit-mask-image:' + u + ';mask-image:' + u + '}'; };
const ci = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
const st = (d, w) => '<path d="' + d + '" fill="none" stroke="#000" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
// 글자 폭(한글 · 한자 · 전각 = 2, 그 밖 = 1) — 글자 자리 상한은 「기본 글자 폭」(4 보다 작으면 4)이에요
const wid = (s) => [...unesc(s)].reduce((a, ch) => a + (/[ᄀ-ᇿ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦Ⅰ-ⅿ]/.test(ch) ? 2 : 1), 0);

/* ---------- 소품 글자 자리 ----------
   틀 HTML 의 글자 마디 가운데, 마트가 이미 바꾸는 글(제목 .tt · 지문 p.nr · 이름 p.nm · 대사 span.d · 소리 이름표 .sn)과 <style> · 주석 · 「&#8288;」을 뺀 것이 자리예요.
   차례대로 t1, t2 … — 마트가 글을 바꿔도 자리 차례는 그대로예요(그 글들은 자리에서 빠져 있어서). */
const SKIP = new Set(['tt', 'nr', 'nm', 'd', 'sn']);
const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'source', 'wbr']);
function slots(html, pre = '') {
  const out = [], stack = [], re = /<!--[\s\S]*?-->|<style>[\s\S]*?<\/style>|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)([^>]*)>|[^<]+/g;
  let m;
  while ((m = re.exec(html))) {
    const s = m[0];
    if (s.startsWith('<!--') || s.startsWith('<style>')) continue;
    if (m[1]) { stack.pop(); continue; }
    if (m[2]) { const tag = m[2].toLowerCase(); if (!VOID.has(tag) && !/\/$/.test(m[3])) { const c = (m[3].match(/\sclass="([^"]*)"/) || [, ''])[1].split(/\s+/); stack.push(c); } continue; }
    const t = s.trim();
    if (!t || t === '&#8288;') continue;
    // 마트 사본만 바꾼 곳(11-11): 지문 · 대사 안이면 조상이어도 빼요 — 마트 견본 지문에는 em · strong · s 가 들어 있어서 자리 번호가 밀렸어요
    const bare = (c) => (pre && c.startsWith(pre) ? c.slice(pre.length) : c);
    if ((stack[stack.length - 1] || []).some((c) => SKIP.has(bare(c)))) continue;
    if (stack.some((cs) => cs.some((c) => bare(c) === 'nr' || bare(c) === 'd'))) continue;   // 지문 · 대사 안 em · strong · s (이름표 안 시각 gk-ts 는 원본처럼 자리예요)
    const lead = s.length - s.trimStart().length;
    out.push({ n: out.length + 1, at: m.index + lead, len: t.length, text: t });
  }
  return out;
}

/* ---------- 틀별 이름 붙은 고리(상위 스물) ----------
   kind: text = 글자 자리(slot = 기본 글자 또는 자리 번호 · nth = 같은 글자 중 몇 번째) · num / pick = 뿌리 class + 덧 규칙
   각 고리 apply(v, k) → { cls, css, text: { 자리번호: 글자 } } — k = 틀 class(예 'k290'), 규칙 선택자는 '.' + k + '.' + cls 로 시작해요 */
const ON = (k, cls) => '.' + k + '.' + cls + ':has(.kx[open])';
const R = (k, cls) => '.' + k + '.' + cls;
const cssStr = v => String(v).replace(/[\\"\n\r<>]/g, '');   // CSS 글자 안에 못 들어갈 것(역슬래시 · 따옴표 · 줄바꿈 · 꺾쇠)은 빼요
const comma = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const num = (s) => +String(s).replace(/[^\d]/g, '') || 0;
// 손 계수기 숫자(칸 6×14 · 굵기 3 — 원래 0 · 1 · 9 와 같은 꼴, 나머지는 같은 획으로 새로 그림)
const DIG = {
  0: (x, y) => '<rect x="' + (x - 3) + '" y="' + (y - 6) + '" width="6" height="12" rx="3" fill="none" stroke="#000" stroke-width="3"/>',
  1: (x, y) => st('M' + (x - 2) + ' ' + (y - 4) + 'L' + (x + 1) + ' ' + (y - 7) + 'V' + (y + 7), 3),
  2: (x, y) => st('M' + (x - 3) + ' ' + (y - 4) + 'Q' + (x - 3) + ' ' + (y - 7) + ' ' + x + ' ' + (y - 7) + 'Q' + (x + 3) + ' ' + (y - 7) + ' ' + (x + 3) + ' ' + (y - 4) + 'Q' + (x + 3) + ' ' + (y - 1) + ' ' + (x - 3) + ' ' + (y + 7) + 'H' + (x + 3), 3),
  3: (x, y) => st('M' + (x - 3) + ' ' + (y - 6) + 'Q' + (x + 3) + ' ' + (y - 9) + ' ' + (x + 3) + ' ' + (y - 3) + 'Q' + (x + 3) + ' ' + y + ' ' + (x - 1) + ' ' + y + 'Q' + (x + 4) + ' ' + y + ' ' + (x + 3) + ' ' + (y + 4) + 'Q' + (x + 2) + ' ' + (y + 8) + ' ' + (x - 3) + ' ' + (y + 6), 3),
  4: (x, y) => st('M' + (x + 2) + ' ' + (y + 7) + 'V' + (y - 7) + 'L' + (x - 3) + ' ' + (y + 2) + 'H' + (x + 4), 3),
  5: (x, y) => st('M' + (x + 3) + ' ' + (y - 7) + 'H' + (x - 2) + 'L' + (x - 3) + ' ' + (y - 1) + 'Q' + (x + 4) + ' ' + (y - 3) + ' ' + (x + 3) + ' ' + (y + 3) + 'Q' + (x + 2) + ' ' + (y + 8) + ' ' + (x - 3) + ' ' + (y + 6), 3),
  6: (x, y) => '<circle cx="' + x + '" cy="' + (y + 3) + '" r="3" fill="none" stroke="#000" stroke-width="3"/>' + st('M' + (x - 3) + ' ' + (y + 3) + 'V' + (y - 3) + 'Q' + (x - 3) + ' ' + (y - 7) + ' ' + (x + 2) + ' ' + (y - 7), 3),
  7: (x, y) => st('M' + (x - 3) + ' ' + (y - 7) + 'H' + (x + 3) + 'L' + (x - 1) + ' ' + (y + 7), 3),
  8: (x, y) => '<circle cx="' + x + '" cy="' + (y - 4) + '" r="2.5" fill="none" stroke="#000" stroke-width="3"/><circle cx="' + x + '" cy="' + (y + 3.5) + '" r="3" fill="none" stroke="#000" stroke-width="3"/>',
  9: (x, y) => '<circle cx="' + x + '" cy="' + (y - 3) + '" r="3" fill="none" stroke="#000" stroke-width="3"/>' + st('M' + (x + 3) + ' ' + (y - 3) + 'V' + (y + 3) + 'Q' + (x + 3) + ' ' + (y + 7) + ' ' + (x - 2) + ' ' + (y + 7), 3),
};
// 주사위 눈(주사위 x8~36 y28~58 · 가운데 (22,42))
const PIPS = { 1: [[22, 42, 4]], 2: [[16, 34, 2], [28, 50, 2]], 3: [[16, 34, 2], [22, 42, 2], [28, 50, 2]], 4: [[16, 34, 2], [28, 34, 2], [16, 50, 2], [28, 50, 2]], 5: [[16, 34, 2], [28, 34, 2], [22, 42, 2], [16, 50, 2], [28, 50, 2]], 6: [[16, 34, 2], [28, 34, 2], [16, 42, 2], [28, 42, 2], [16, 50, 2], [28, 50, 2]] };
const MD = (m, d) => { const t = new Date(2001, m - 1, d + 1); return [t.getMonth() + 1, t.getDate()]; };   // 하루 뒤(2001 = 윤년 아님)

const HOOKS = {
  // 1 호감도 게이지 — 누르면 차오르는 끝 높이(%). 100 = 지금(끝까지) · 쉬는 수위는 그대로(약 46%) — 그보다 낮으면 누를 때 내려가요
  '17:k290': { 호감도: { kind: 'num', min: 0, max: 100, step: 5, def: 100, label: '호감도(%)', apply: (v, k) => {
    if (v === 100) return {};
    const cls = 'gk-lv-' + v, E = Math.round((46 - 48 * v / 100) * 10) / 10, T = (y, a) => 'transform:translateY(' + (Math.round(y * 10) / 10) + 'px) rotate(' + a + 'deg)', kf = k + '-lq' + v;
    return { cls, css: `@keyframes ${kf}{0%{${T(24, 0)};animation-timing-function:cubic-bezier(.4,0,.3,1)}36%{${T(E + 2, -4)};animation-timing-function:ease-in-out}56%{${T(E + 8, 3)};animation-timing-function:ease-in-out}74%{${T(E + 4, -2)};animation-timing-function:ease-in-out}90%{${T(E + 2, 1)};animation-timing-function:ease-in-out}100%{${T(E, 0)}}}\n${ON(k, cls)} .lq{${T(E, 0)};animation-name:${kf}}` };
  } } },
  // 2 궁합표 — 두 이름(한 글자씩 넷) · 가운데 숫자 줄(획수 · 더한 줄)은 글자 자리 t5~t11 · 결과 %
  '18:k309': {
    이름1: { kind: 'chars', slots: [1, 2], def: '하윤', max: 2, label: '첫 이름(2글자)' },
    이름2: { kind: 'chars', slots: [3, 4], def: '나슬', max: 2, label: '둘째 이름(2글자)' },
    결과: { kind: 'num', min: 0, max: 100, step: 1, def: 87, label: '궁합(%)', apply: (v) => ({ text: { 13: v + '%' } }) },
  },
  // 3 100일 계수기 — 누른 뒤 숫자(누르기 전 = 하나 아래)
  '31:k16': { 숫자: { kind: 'num', min: 1, max: 999, step: 1, def: 100, label: '센 날(일)', apply: (v, k) => {
    if (v === 100) return {};
    const cls = 'gk-n-' + v, a = String(v - 1).padStart(3, '0'), b = String(v).padStart(3, '0'), X = [24, 38, 52];
    return { cls, css: [0, 1, 2].map((i) => mask(R(k, cls) + ' .a' + (i + 1), 88, 88, DIG[a[i]](X[i], 54) + DIG[b[i]](X[i], 30))).join('\n') };
  } } },
  // 4 일력 — 맨 윗장(뜯기는 장) 월 · 일 → 다음 장은 하루 뒤로 저절로
  '12:k264': { 날짜: { kind: 'date', def: '12-31', label: '뜯는 장 날짜(월-일)', apply: (v) => {
    const [m, d] = String(v).split('-').map(Number); if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) throw new Error('날짜는 월-일(예 12-31)');
    const [m2, d2] = MD(m, d); return { text: { 1: m2 + '월', 2: String(d2), 3: m + '월', 4: String(d) } };
  } } },
  // 11-12 익명 게시판 — 펼치면 이름 줄마다 CSS(::after)로 붙는 「익명1 · 익명2」(이름 줄 수가 글마다 달라 글 칸으로 못 박아요 → 이 고리로 바꿔요)
  'bl:k1102': {
    익명1: { kind: 'text', def: '익명1', label: '익명 이름 1(첫째 화자)', apply: (v, k) => ({ cls: 'gk-an1', css: R(k, 'gk-an1') + ' p.gk-nA::after{content:"' + cssStr(v) + '"}' }) },
    익명2: { kind: 'text', def: '익명2', label: '익명 이름 2(둘째 화자)', apply: (v, k) => ({ cls: 'gk-an2', css: R(k, 'gk-an2') + ' p.gk-nB::after{content:"' + cssStr(v) + '"}' }) },
  },
  '10:k292': { 업적: { kind: 'text', slot: '옥상 문을 열었다', label: '업적 이름' } },
  '10:k289': { 선택지1: { kind: 'text', slot: '옥상 문을 연다', label: '첫째 선택지' }, 선택지2: { kind: 'text', slot: '전화를 한 번 더 건다', label: '둘째 선택지' } },
  // 7 펀치 점수 — 숫자 띠 셋의 마지막 줄(000 → 점수)
  '36:k342': { 점수: { kind: 'num', min: 0, max: 999, step: 1, def: 999, label: '펀치 점수', apply: (v) => { const s = String(v).padStart(3, '0'); return { text: { 4: s[0], 8: s[1], 12: s[2] } }; } } },
  '10:k406': { 자막: { kind: 'text', slot: '비 그친 옥상에서 두 사람 만나 · 캔 커피는 두 개', label: '속보 자막' } },
  '07:g323': {
    과목1: { kind: 'text', slot: '국어', label: '과목 1' }, 점수1: { kind: 'text', slot: '92', label: '점수 1' },
    과목2: { kind: 'text', slot: '수학', label: '과목 2' }, 점수2: { kind: 'text', slot: '88', label: '점수 2' },
    과목3: { kind: 'text', slot: '영어', label: '과목 3' }, 점수3: { kind: 'text', slot: '95', label: '점수 3' },
    과목4: { kind: 'text', slot: '체육', label: '과목 4' }, 점수4: { kind: 'text', slot: 'A', label: '점수 4' },
    의견1: { kind: 'text', slot: '성실하고', label: '담임 의견 1' }, 의견2: { kind: 'text', slot: '다정한 학생', label: '담임 의견 2' },
    반: { kind: 'text', slot: '2학년 3반', label: '학년 반' },
  },
  // 10 간이 영수증 — 품목 둘 · 값 둘 → 합계 저절로
  '05:k32': {
    품목1: { kind: 'text', slot: '허브차', label: '품목 1' }, 값1: { kind: 'num', min: 0, max: 99999, step: 100, def: 3000, label: '값 1(원)', apply: () => ({}) },
    품목2: { kind: 'text', slot: '군밤', label: '품목 2' }, 값2: { kind: 'num', min: 0, max: 99999, step: 100, def: 4000, label: '값 2(원)', apply: () => ({}) },
    _calc: (c, S) => { if (c.값1 == null && c.값2 == null) return {}; const a = c.값1 == null ? 3000 : +c.값1, b = c.값2 == null ? 4000 : +c.값2; const at = (t, nth = 1) => S.filter((x) => x.text === t)[nth - 1].n; return { text: { [at('3,000')]: comma(a), [at('4,000')]: comma(b), [at('7,000')]: comma(a + b) }, lim: { [at('3,000')]: 6, [at('4,000')]: 6, [at('7,000')]: 7 } }; },
  },
  '04:k271': { 행선지: { kind: 'text', slot: '오늘 → 눈의 나라', label: '행선지' }, 칸: { kind: 'text', slot: '7호차', label: '칸' }, 좌석: { kind: 'text', slot: '12A', label: '좌석' } },
  '27:k109': { 처음: { kind: 'text', slot: '8282', label: '처음 숫자' }, 호출: { kind: 'text', slot: '1004', label: '새 호출 숫자' } },
  // 13 촛불 개수 — 왼쪽부터 N 개를 남기고 가운데로 옮겨요(제단 돌은 그대로)
  '19:k77': { 촛불: { kind: 'num', min: 1, max: 5, step: 1, def: 5, label: '촛불 개수', apply: (v, k) => {
    if (v === 5) return {};
    const cls = 'gk-n-' + v, cut = 96 - (16 * v + 8), dx = (5 - v) * 8, p = R(k, cls);
    const hide = [...Array(5 - v)].map((_, i) => p + ' .p' + (v + i)).join(',');
    return { cls, css: `${p} .ca,${p} .cb,${p} .wk{clip-path:inset(0 ${cut}px 0 0);translate:${dx}px 0}\n${[...Array(v)].map((_, i) => p + ' .p' + i).join(',')}{translate:${dx}px 0}\n${hide}{display:none}` };
  } } },
  // 14 주사위 멎는 눈
  '31:k100': { 눈: { kind: 'pick', options: [1, 2, 3, 4, 5, 6], def: 6, label: '주사위 눈', apply: (v, k) => {
    v = +v; if (v === 6) return {};
    const cls = 'gk-d-' + v; return { cls, css: mask(R(k, cls) + ' .q6', 104, 72, PIPS[v].map(([x, y, r]) => ci(x, y, r)).join('')) };
  } } },
  // 15 체크리스트 — 줄 글 셋 · 줄마다 ✓(v) / ✗(x)
  '14:k209': {
    줄1: { kind: 'text', slot: '기상 06:00', label: '첫 줄' }, 줄2: { kind: 'text', slot: '아침 먹기', label: '둘째 줄' }, 줄3: { kind: 'text', slot: '옆머리 땋기', label: '셋째 줄' },
    표시: { kind: 'pick', options: ['vxv', 'vvv', 'vvx', 'vxx', 'xvv', 'xxv', 'xvx', 'xxx'], def: 'vxv', label: '줄마다 ✓/✗(v = ✓ · x = ✗)', apply: (v) => ({ swap: [...String(v)].map((c, i) => ({ row: 'r' + (i + 1), cls: c === 'v' ? 'tv' : 'tn' })) }) },
  },
  '13:k159': { 메모1: { kind: 'text', slot: '우산 챙기기', label: '첫 장' }, 메모2: { kind: 'text', slot: '옥상 5시', label: '둘째 장' }, 메모3: { kind: 'text', slot: '캔 커피 둘', label: '셋째 장' } },
  // 17 블로그 공감 · 댓글(누른 뒤 = +1 저절로)
  '09:k288': {
    공감: { kind: 'num', min: 0, max: 9998, step: 1, def: 12, label: '공감 수(누르기 전)', apply: (v) => ({ text: { 6: String(v), 7: String(+v + 1) } }) },
    댓글: { kind: 'num', min: 0, max: 9998, step: 1, def: 0, label: '댓글 수(누르기 전)', apply: (v) => ({ text: { 9: String(v), 10: String(+v + 1) } }) },
  },
  // 18 달 — 누른 뒤 차오른 끝 모양
  '19:k21': { 달: { kind: 'pick', options: ['보름', '거의 보름', '반달 쯤'], def: '보름', label: '달 끝 모양', apply: (v, k) => {
    const at = { '거의 보름': [36, -14], '반달 쯤': [26, -8] }[v]; if (!at) return {};
    const cls = 'gk-m-' + (v === '거의 보름' ? 2 : 3); return { cls, css: `${ON(k, cls)} .mc{transform:translate(${at[0]}px,${at[1]}px)}` };
  } } },
  '07:g355': {
    배치: { kind: 'text', slot: '전투 1팀 · 전담 가이드', label: '배치' }, 숙소: { kind: 'text', slot: '엘리시움 · 1팀 층', label: '숙소' },
    시행: { kind: 'text', slot: '2050. 03. 17', label: '시행일' }, 문서: { kind: 'text', slot: '문서 KSA-인사-0317', label: '문서 번호' },
  },
  '08:k277': { 안읽음: { kind: 'num', min: 1, max: 99, step: 1, def: 2, label: '안 읽음(처음)', apply: (v) => ({ text: { 1: String(v), 2: String(Math.max(1, v - 1)) } }) } },
};

/* ---------- 적용 ---------- */
// 마트 판(class 마다 「gk-」가 붙은 판)이면 덧 규칙의 class 선택자에도 같은 머리를 붙여요 — 틀 class · gk- 로 시작하는 이름 · url(…) 안은 그대로
const preCss = (css, pre, k) => (!pre ? css : css.split(/(url\('[^']*'\))/).map((seg, i) => (i % 2 ? seg : seg.replace(/\.([a-zA-Z][\w-]*)/g, (m0, n) => (n === k || n.startsWith('gk-') ? m0 : '.' + pre + n)))).join(''));
function frameClass(html) { const m = html.match(/<div class="gk ([^"]*)"/); if (!m) throw new Error('뿌리 div(class="gk …")를 못 찾았어요'); const k = m[1].split(/\s+/).find((c) => /^(gk-)?(m|k|g|kt|kb)\d+[a-z]*$/.test(c)); if (!k) throw new Error('틀 class 를 못 찾았어요'); return k; }
function applyCust(html, key, cust, o = {}) {
  if (!cust || !Object.keys(cust).length) return html;
  const k = o.cls || frameClass(html), pre = o.pre != null ? o.pre : (k.startsWith('gk-') ? 'gk-' : ''), H = HOOKS[key] || {}, S = slots(html, pre), byN = new Map(S.map((x) => [x.n, x]));
  const text = {}, cls = [], css = [], swap = [];
  const slotOf = (spec) => { if (typeof spec === 'number') return spec; const hit = S.filter((x) => unesc(x.text) === spec); if (!hit.length) throw new Error(key + ' 자리 「' + spec + '」 를 못 찾았어요'); return hit[0].n; };
  for (const [name, v] of Object.entries(cust)) {
    if (v == null || v === '') continue;
    const tm = name.match(/^t(\d+)$/);
    if (tm) { text[+tm[1]] = String(v); continue; }
    const h = H[name]; if (!h || name[0] === '_') throw new Error(key + ' 에 없는 고리: ' + name);
    if (h.kind === 'text' && !h.apply) { text[slotOf(h.slot)] = String(v); continue; }   // 11-12 apply 가 있는 글자 고리는 아래에서(CSS 로 그린 글자 — 익명 게시판)
    if (h.kind === 'chars') { const cs = [...String(v)]; if (cs.length !== h.slots.length) throw new Error(key + ' ' + name + ' 는 ' + h.slots.length + '글자'); h.slots.forEach((n, i) => { text[n] = cs[i]; }); continue; }
    if (h.kind === 'num') { const n = +v; if (!Number.isFinite(n) || n < h.min || n > h.max || Math.round(n) !== n) throw new Error(key + ' ' + name + ' 범위 ' + h.min + '~' + h.max + ': ' + v); }
    if (h.kind === 'pick' && !h.options.map(String).includes(String(v))) throw new Error(key + ' ' + name + ' 고르기: ' + h.options.join(' · '));
    const r = h.apply(h.kind === 'num' ? +v : v, k) || {};
    if (r.cls) { cls.push(r.cls); css.push(r.css); }
    if (r.text) Object.assign(text, r.text);
    if (r.swap) swap.push(...r.swap);
  }
  const lim = {};
  if (H._calc) { const r = H._calc(cust, S); Object.assign(text, r.text || {}); Object.assign(lim, r.lim || {}); }
  let out = html;
  // ① 글자(뒤에서부터 바꿔 자리 위치가 안 밀려요)
  for (const n of Object.keys(text).map(Number).sort((a, b) => b - a)) {
    const s = byN.get(n); if (!s) throw new Error(key + ' 에 없는 글자 자리: t' + n + '(자리 ' + S.length + '개)');
    const nv = String(text[n]); const mx = lim[n] || Math.max(4, wid(s.text));
    if (!o.force && wid(nv) > mx) throw new Error(key + ' t' + n + ' 글자가 길어요: 「' + nv + '」 폭 ' + wid(nv) + ' > ' + mx);
    out = out.slice(0, s.at) + esc(nv) + out.slice(s.at + s.len);
  }
  // ② 줄마다 class 바꿔 끼우기(209 체크 ✓/✗)
  for (const { row, cls: c } of swap) out = out.replace(new RegExp('(<span class="' + pre + 'rw ' + pre + row + '"><span class="' + pre + 'bx">[\\s\\S]*?<span class="(?:' + pre + 'ly )?' + pre + 'tk ' + pre + ')(tv|tn)"'), (m0, a) => a + c + '"');
  // ③ 뿌리 class + 덧 규칙(① 기본 덩이 끝 = <style> 안 첫 빈 줄 앞)
  if (cls.length) {
    out = out.replace(/<div class="gk ([^"]*)"/, (m0, c) => '<div class="gk ' + c + ' ' + cls.join(' ') + '"');
    const s0 = out.indexOf('<style>') + 7, gap = out.indexOf('\n\n', s0), end = out.indexOf('</style>', s0), at = gap > 0 && gap < end ? gap : end;
    out = out.slice(0, at) + '\n' + preCss(css.join('\n'), pre, k) + out.slice(at);
  }
  return out;
}
// 생성기 끝 한 줄이 부르는 감싸기 — opt.cust 가 없으면 h 그대로
const wrap = (bundle) => { const B = String(bundle).padStart(2, '0'); return (no, h, opt) => (opt && opt.cust && Object.keys(opt.cust).length ? applyCust(h, B + ':' + frameClass(h), opt.cust) : h); };
// 마트 설명서용: 틀 하나의 고리 목록(이름 고리 + 글자 자리)
function describe(html, key) {
  const S = slots(html), H = HOOKS[key] || {};
  const named = Object.entries(H).filter(([n]) => n[0] !== '_').map(([n, h]) => Object.assign({ name: n }, h, { apply: undefined, slot: h.kind === 'text' ? S.find((x) => unesc(x.text) === h.slot)?.n : h.slots }));
  return { key, k: frameClass(html), named, slots: S.map((x) => ({ n: x.n, def: unesc(x.text), max: Math.max(4, wid(x.text)) })) };
}
export { applyCust, wrap, slots, describe, HOOKS, wid, frameClass };
