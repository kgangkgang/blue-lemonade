#!/usr/bin/env node
// 글꾸 마트 「심플 새 틀」 자료 만들기 — 클래스 + 틀 안 <style> 하나로 된 새 틀(시안 → 이식판)을 마트 조각 · 목록 꼴로 써요.
// - 실행: node tools/geulkku-simple.mjs [--check]   (node 24 · 외부 의존 없음 · 멱등)
//         node tools/geulkku-simple.mjs --pull <이식판.html> [<이식판.html> …]   이식판에서 틀마다 원래 판 한 벌을 tools/simple-frames/<틀>.html 로 꺼낸 뒤 자료를 다시 만들어요
//   --check: 쓰지 않고 지금 자료와 같은지만 봐요(다르면 1로 끝나요).
// - 쓰는 것: mart/data/geulkku/index.json(글꾸 마트 목록 — items · categories · chunks) + 조각 sp-simple.<해시8>.json({ items: { <id>: { preview } } }).
//   11-11 옛 글꾸를 마트에서 뺀 뒤로 목록은 심플 새 틀만이에요(마트 · 지니가 이 목록 하나를 읽어요).
// - 틀 하나 = DEFS 한 줄 + 틀 HTML 파일(tools/simple-frames/<틀>.html — 이식판.html 의 틀 한 벌 <div class="gk …"> ~ 닫는 </div> 그대로 · --pull 이 꺼내요).
//   DEFS 에 있어도 파일이 아직 없으면(이식판이 안 나온 틀) 건너뛰고 알려요 — 이식판이 나오면 --pull 한 번이면 들어가요.
//   뽑기.mjs 의 .틀.html 은 그 판에 걸리는 규칙만 추려(반대 판 낮 · 밤 규칙이 빠져요) 색 블록 사이 빈 줄도 없어서 입력으로 못 써요.
//   ① 뿌리의 뽑기용 별칭 클래스(접두 없는 k8 · cv-bl …)를 떼고 ② 견본 글 자리표({{제목}} · {{이름:X}} · {{대사:n/X}} · {{지문:n}} · {{소리이름:X}} · {{소리:n}} …)를 values 로 채우고
//   ③ 소리 카드는 마트 꼴(class="uploaded-audio" · preload="metadata" · 견본 mp3)로 ④ 미리보기는 처음엔 닫힌 틀만 열린 판(peekSimple — 복사 글은 mart.js shutPeek 가 닫아요).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'mart', 'data', 'geulkku');
const SRC = path.join(ROOT, 'tools', 'simple-frames');
const CHECK = process.argv.includes('--check');
const { AUD } = createRequire(import.meta.url)('./song-templates.cjs');
const sf = await import(pathToFileURL(path.join(ROOT, 'mart', 'simple-frames.js')).href);
const { themeTakeable } = await import(pathToFileURL(path.join(ROOT, 'mart', 'theme-take.js')).href);   // 11-12 테마가 못 받는 틀 → 목록 nt(짧은 까닭)
const OUT = path.join(DIR, 'index.json');   // 11-11 옛 글꾸를 뺀 뒤로 글꾸 마트 목록은 이 도구가 써요
const KEY = 'sp-simple';
// 분류(새 틀이 스물여덟 개뿐이라 동작으로 넷만):
//   「눌러서 열어요」 = 닫힌 채 시작해 눌러야 글이 나오는 틀(DEFS 의 open) · 「소리 카드」 = 소리 카드가 든 틀 · 「누르면 바뀌어요」 = 그 밖에 누름이 있는 틀 · 「가만히 보기」 = 누름이 없는 틀
export const CATS = [
  { id: 'simple-open', label: '눌러서 열어요', group: 'concept' },
  { id: 'simple-tap', label: '누르면 바뀌어요', group: 'concept' },
  { id: 'simple-sound', label: '소리 카드', group: 'concept' },
  { id: 'simple-still', label: '가만히 보기', group: 'concept' },
];
const catOf = (d, html) => (d.open ? 'simple-open' : /<audio\b/.test(html) ? 'simple-sound' : /<details\b/.test(html) ? 'simple-tap' : 'simple-still');

// 틀 한 줄: frame(뿌리의 gk-<틀> 이름) · name(소품 이름 그대로 / 대표 10 은 컨셉 이름) · emoji · desc
//   peek: 카드 미리보기에서 열어 둘지(없으면 SIMPLE_CONTRACT.peek — 첫 묶음 01 · 05 · 07 · 08) · open: 닫힌 채 시작해 눌러야 글이 나오는 틀(분류) · values: 자리표 값
//   id 는 simple-<틀>(15자 이하 — 테마로 받을 때 대사색 꼬리 9자가 붙어도 24자 안) · 색 칸(bg · ink · accent)은 틀에서 계산해요
//   열어 보일지 · 설명은 각 이식판 설명서(시안 설명.md 1절 · 9-1 / 시안-2 설명.md 1 · 8-1절 / 시안-3 이식판-설명.md 2절 / 기존틀-새방식 이식판-설명.md 1절)의 표를 따랐어요
const SOUND = { 소리: ['s1.mp3', 's2.mp3', 's3.mp3'] };
export const DEFS = [
  // 첫 묶음 8(심플-새틀-시안/이식판.html · 11-10 23:56 판)
  { frame: 'k1', name: '낫표', emoji: '💬', open: true, desc: '제목 줄을 누르면 가운데 붙어 있던 「 」가 모서리로 벌어지며 글이 드러나요 · 다시 누르면 닫혀요' },
  { frame: 'k2', name: '견출지', emoji: '🏷️', desc: '제목이 견출지 한 장 — 누르면 오른쪽 아래부터 스티커처럼 뜯기고, 점선 자리를 누르면 다시 붙어요 · 소리 카드 한 줄' },
  { frame: 'k3', name: '바인더', emoji: '🗂️', desc: '바인더 등 · 금속 고리 셋 · 여백 줄 — 오른쪽 아래 「1 / 2」를 누르면 종이가 옆으로 밀리며 다음 장' },
  { frame: 'k4', name: '줄자', emoji: '📏', desc: '위에 0~30cm 자 · 제목 끝 커서 — 자 위에서 휠(폰은 옆으로 밀기) · 세모 줄을 누르면 첫 줄 들여쓰기 켬/끔' },
  { frame: 'k5', name: '티백', emoji: '🍵', desc: '옆에서 본 찻잔 · 흔들리는 꼬리표 · 김 — 찻잔을 누르면 캐릭터 색 찻물이 차오르고 숨은 한 줄이 나와요' },
  { frame: 'k6', name: '음성 메모', emoji: '🎙️', desc: '말소리처럼 오르내리는 음파 막대 · 흐르는 녹음 시간 · 소리 카드 한 줄' },
  { frame: 'k7', name: '성냥', emoji: '🔥', desc: '성냥 한 개비 — 누르면 불씨가 「탁」 붙고 테두리 · 가로줄이 캐릭터 색으로, 지문 글자가 또렷해져요 · 다시 누르면 연기 한 줄' },
  { frame: 'k8', name: '블라인드', emoji: '🪟', open: true, desc: '제목 · 블라인드 · 당김줄을 누르면 살이 위로 모이고 대화가 펼쳐져요 · 소리 카드 한 줄' },
  // 둘째 묶음 5(심플-새틀-시안-2/이식판.html · 뿌리 gk-k09 꼴)
  { frame: 'k09', name: '지퍼', emoji: '🤐', open: true, peek: true, desc: '지퍼 띠를 누르면 슬라이더가 걸렸다 주르륵 내려가며 이가 V 로 벌어지고 아래 글이 따라 드러나요 · 소리 카드 한 줄' },
  { frame: 'k10', name: '모래시계', emoji: '⏳', open: true, peek: true, desc: '모래시계를 누르면 휙 뒤집혀 모래가 떨어지고, 본문 칸이 열리며 글자가 천천히 또렷해져요 · 소리 카드 한 줄' },
  { frame: 'k11', name: '실 전화', emoji: '📞', peek: true, desc: '종이컵 둘을 잇는 늘어진 실 — 누르면 실이 팽팽해지며 떨리고 흐리던 글이 또렷해져요 · 소리 카드 한 줄' },
  { frame: 'k12', name: '돋보기', emoji: '🔍', desc: '돋보기를 누르면 글 쪽으로 기울며 글자가 크게 보여요' },
  { frame: 'k13', name: '형광펜', emoji: '🖍️', peek: true, desc: '형광펜을 누르면 뚜껑이 톡 빠지고 대사 띠가 첫 줄부터 차례로 그어져요' },
  // 셋째 묶음 5(심플-새틀-시안-3/이식판.html) — 14 쥘부채는 E안(깊은 주름)
  { frame: 'k14', name: '쥘부채', emoji: '🪭', open: true, peek: true, desc: '제목 줄을 누르면 부채살이 촤락 벌어지고, 지그재그로 접힌 종이가 고르게 펴져 글 칸이 돼요 · 소리 카드 한 줄' },
  { frame: 'k15', name: '뉴턴의 요람', emoji: '⚪', desc: '요람을 누르면 공이 탁탁 주고받고, 공이 칠 때마다 그 화자의 대사 띠가 톡 짙어져요 · 소리 카드 한 줄' },
  { frame: 'k16', name: '지우개', emoji: '🧽', desc: '지우개를 누르면 내려와 쓱쓱 문지르고, 지문이 차례로 옅어져 대사만 남아요' },
  { frame: 'k17', name: '바람개비', emoji: '🎐', desc: '늘 천천히 도는 바람개비 — 누르면 후 불어 빠르게 돌다 잦아들어요 · 소리 카드 한 줄' },
  { frame: 'k18', name: '토스터', emoji: '🍞', open: true, peek: true, desc: '레버를 누르면 눈금이 틱틱 돌고 빵이 탁 튀어 오르며 글이 같이 튀어나와요' },
  // 대표 10(심플-기존틀-새방식/이식판.html · 뿌리 gk-q01~gk-q10) — 기존 컨셉을 새 방식으로 다시 그린 것 · 옛날 버전의 같은 이름 틀은 그대로 둬요
  { frame: 'q01', name: '여름 바다', emoji: '🏖️', desc: '물결 위에 떠 있는 비치볼 — 누르고 있는 동안 볼이 살짝 눌려요' },
  { frame: 'q02', name: '흐림', emoji: '☁️', desc: '구름을 누르면 구름이 밀려나고 해와 햇살이 드러나요 · 소리 카드 한 줄' },
  { frame: 'q03', name: '새해 첫날', emoji: '🌅', peek: true, desc: '해돋이를 누르면 해가 떠오르고 햇살 일곱 줄이 퍼져요' },
  { frame: 'q04', name: '새벽', emoji: '🌌', peek: true, desc: '가로등을 누르면 깜빡이다 켜지며 빛기둥이 내려와요' },
  { frame: 'q05', name: '메신저', emoji: '💭', desc: '입력 중 점 셋이 뛰는 말풍선 — 누르면 보낸 말풍선과 안 읽음 「1」이 떠요 · 소리 카드 한 줄' },
  { frame: 'q06', name: '편지 봉투', emoji: '✉️', open: true, peek: true, desc: '봉투를 누르면 하트 스티커가 떨어지고 뚜껑이 젖혀지며 편지지가 올라와 글이 펼쳐져요' },
  { frame: 'q07', name: '호박', emoji: '🎃', peek: true, desc: '호박을 누르면 별 창과 골 틈으로 불빛이 켜지고 일렁여요' },
  { frame: 'q08', name: '라면', emoji: '🍜', desc: '김이 오르는 냄비 — 누르면 젓가락이 면발을 들어 올려요' },
  { frame: 'q09', name: '카페 영수증', emoji: '🧾', peek: true, desc: '출력기를 누르면 흰 영수증이 다 밀려 나와요 — 가게 이름 · 품목 · 합계 줄을 바꿔 써요(종이는 캐릭터 색을 안 따라요)' },
  { frame: 'q10', name: 'RPG 스탯', emoji: '🎮', desc: 'HP · MP · EXP 게이지 — 누르면 EXP 가 가득 차 레벨이 오르고 HP · MP 가 회복돼요 · 소리 카드 한 줄' },
].map(d => ({ id: `simple-${d.frame}`, values: SOUND, ...d }));
// 11-11 전수조사 합격 틀(묶음 생성기 01 ~ 46 · 사용자가 깡통에서 본 판) — 목록 줄은 tools/simple-frames/pass-defs.json(허브 지시-1111/출시-1111 의 변환기가 써요)
//   틀 파일은 tools/simple-frames/k1001.html ~ (뿌리 gk-k<1000 + 통번호> — 첫 묶음 k1 ~ k18 과 안 겹쳐요) · 조각은 PASS_STEP 틀씩 나눠 sp-pass-<n> 으로(한 번에 다 받지 않게)
export const PASS_STEP = 40;
const PASS_FILE = path.join(SRC, 'pass-defs.json');
export const PASS_DEFS = (fs.existsSync(PASS_FILE) ? JSON.parse(fs.readFileSync(PASS_FILE, 'utf8')) : [])
  .map((d, i) => ({ id: `simple-${d.frame}`, values: SOUND, name: d.name, emoji: d.emoji, desc: d.desc, frame: d.frame, open: !!d.open, peek: !!d.peek, chunk: `sp-pass-${Math.floor(i / PASS_STEP)}` }));


const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** 견본 글 자리표를 값으로 채워요(글 자리는 HTML 이스케이프 · 소리는 견본 mp3 주소) */
export function fillSlots(html, values = {}) {
  return String(html).replace(/\{\{([^{}:]+)(?::([^{}]+))?\}\}/g, (all, kind, key) => {
    if (kind === '소리') { const f = (values.소리 || [])[Number(key) - 1]; return f ? (/^https?:/.test(f) ? f : AUD + f) : all; }
    const v = values[kind];
    if (v == null) return all;
    if (key == null) return esc(v);
    if (kind === '대사') { const [n] = key.split('/'); const t = (v || [])[Number(n) - 1]; return t == null ? all : esc(t); }
    if (kind === '지문') { const t = (v || [])[Number(key) - 1]; return t == null ? all : esc(t); }
    const t = v[key]; return t == null ? all : esc(t);
  });
}
/** 뽑기용 별칭(접두 없는 k8 · cv-bl …)을 뿌리에서 떼요 */
const stripAlias = html => html.replace(/^(\s*<div\b[^>]*\sclass=")([^"]*)"/, (all, a, v) => `${a}${v.split(/\s+/).filter(c => c === 'gk' || c.startsWith('gk-')).join(' ')}"`);
/** 소리 카드를 마트 꼴로: class="uploaded-audio" · preload="metadata"(마트 노래 틀과 같아요 · 이식-설계 1-6) */
//   이식판은 src 없이 와요 → n 번째 소리 카드에 {{소리:n}} 자리표를 달고 values.소리 로 채워요
const martAudio = (html) => {
  let n = 0;
  return html.replace(/<audio\b([^>]*)>/g, (all, attrs) => {
    n++;
    let a = /\ssrc="/.test(attrs) ? attrs : ` src="{{소리:${n}}}"${attrs}`;
    a = a.replace(/\spreload="[^"]*"/, ' preload="metadata"');
    if (!/\spreload=/.test(a)) a += ' preload="metadata"';
    if (!/\sclass="/.test(a)) a = ' class="uploaded-audio"' + a;
    return `<audio${a}>`;
  });
};
/** 마우스로 누를 때 summary 둘레 파란 네모 테를 숨겨요(키보드 :focus-visible 테는 그대로) — 첫 묶음 이식판에 빠진 한 줄(둘째 · 셋째 · 대표 10 이식판과 같은 꼴) · 이미 있으면 그대로 */
export const FOCUS_RULE = key => `.gk-${key} summary:focus:not(:focus-visible){outline:none}`;
const focusRing = (html) => {
  const key = (html.match(/^\s*<div\b[^>]*\sclass="gk [^"]*\bgk-((?:k|q)\d+)\b/) || [])[1];
  if (!key || !/<summary\b/.test(html) || html.includes(FOCUS_RULE(key))) return html;
  const at = html.indexOf(`.gk-${key} summary:focus-visible{`);
  if (at < 0) return html;
  const end = html.indexOf('\n', at);
  return `${html.slice(0, end)}\n${FOCUS_RULE(key)}${html.slice(end)}`;
};
/** 11-11 견본 글의 화자 이름: 「이름」 → 「깡통」 · 「친구」 → 「깡캐」(사용자 지시 — 이름표 · 소리 이름표 · 지문 속 같은 낱말까지 · 받침이 같아 조사는 그대로) */
export const sampleNames = html => String(html)
  .replace(/(<(?:p|span) class="gk-(?:nm gk-n|sn gk-s)[A-Z]">)이름(?=<\/)/g, '$1깡통')
  .replace(/(<(?:p|span) class="gk-(?:nm gk-n|sn gk-s)[A-Z]">)친구(?=<\/)/g, '$1깡캐')
  .replace(/이름은 난간에 기대어/g, '깡통은 난간에 기대어')
  .replace(/(<p class="gk-nr">)친구는 대답 대신/g, '$1깡캐는 대답 대신')
  .replace(/(하나는 아직 따뜻했다\.<\/p>)(?!\s*<p class="gk-nr"><em>)(\s*)/g, (all, a, gap) => `${a}${gap || '\n'}${SAMPLE_INNER}${gap || '\n'}`);
/** 11-11 견본 글에 속마음 · 강조 · 취소 한 줄(조절 칸의 속마음 · 강조 · 취소선 칸이 보이게 — 조정자 결정) · 둘째 지문 바로 뒤 */
export const SAMPLE_INNER = '<p class="gk-nr"><em>또 기다렸구나.</em> 깡통은 <strong>따뜻한 쪽</strong>을 받아 들고 <s>화난 척</s>을 그만두었다.</p>';
/** 11-11 틀 넘침 손봄(조절 전 처음 값부터 넘치던 둘 — 모양은 그대로) · 기본 규칙 덩이 끝에 더해요
 *   k14 쥘부채: 접힌 살을 돌린 상자의 바깥 테두리가 틀 안쪽을 0.8px 넘어 재는 값만 넘침(보이는 잉크는 소품 칸 116×76 안) → 소품 칸에서 잘라요
 *   q10 RPG 스탯: 게이지 줄(아이콘 · 이름 · 막대 178 · 숫자 76)이 폰 320 글 칸보다 넓어요 → 막대만 줄어요(칸 열 개가 같이 · 칠한 칸은 px 라 줄어든 만큼만 덜 보여요) */
export const FIT_RULES = Object.freeze({
  k14: ['.gk-k14 .gk-fn{overflow:clip}'],
  q10: ['.gk-q10 .gk-gb{flex:0 1 178px;min-width:0;width:auto;grid-template-columns:minmax(0,178px)}', '.gk-q10 .gk-g0,.gk-q10 .gk-g1{min-width:0}', '.gk-q10 .gk-gb i{flex:0 1 16px;min-width:0;width:auto}'],
});
const fitFix = (html) => {
  const key = (html.match(/^\s*<div\b[^>]*\sclass="gk [^"]*\bgk-((?:k|q)\d+)\b/) || [])[1], add = (FIT_RULES[key] || []).filter(r => !html.includes(r));
  if (!add.length) return html;
  const at = html.indexOf('<style>') + 7, end = html.indexOf('\n\n', at);   // 기본 규칙 덩이 끝(빈 줄 앞)
  return end < 0 ? html : `${html.slice(0, end)}\n${add.join('\n')}${html.slice(end)}`;
};
/** 붙이면 지워지거나 쓰면 안 되는 것 */
function problems(html) {
  const bad = [];
  if (/\{\{[^}]*\}\}/.test(html)) bad.push('채우지 않은 자리표');
  if (/<script\b/i.test(html)) bad.push('<script>');
  if (/<svg\b/i.test(html)) bad.push('inline <svg>');
  if (/\s(?:id|for|name)="/i.test(html)) bad.push('id · for · name 속성');
  if (/\sstyle="[^"]*url\(/i.test(html)) bad.push('인라인 style 의 url(');
  if (/position\s*:\s*fixed/i.test(html)) bad.push('position:fixed');
  if ((html.match(/<style>/g) || []).length !== 1) bad.push('<style> 이 하나가 아님');
  const info = sf.simpleFrameInfo(html);
  if (!info) bad.push('뿌리 div 첫 자식 <style> 꼴이 아님');
  else {
    if (!info.key) bad.push('뿌리에 gk-k<번호> · gk-q<번호> 없음');
    if (!info.base) bad.push('뿌리에 gk-tl · gk-td · gk-tx 없음');
    if (info.K0 === undefined) bad.push(`캐릭터 색 클래스(${info.cvClass || '없음'})를 모름 — SIMPLE_CONTRACT.cv 에 더해요`);
    if (!info.color_css) bad.push('색 블록이 없음(빈 줄로 나뉜 둘째 덩이)');
  }
  return bad;
}
/** 틀 이름 → 파일(k9 · k09 · q1 · q01 어느 꼴로 꺼냈어도) */
const numVariants = f => { const m = f.match(/^([a-z]+)0*(\d+)$/); return m ? [...new Set([f, `${m[1]}${m[2]}`, `${m[1]}${m[2].padStart(2, '0')}`])] : [f]; };
export const fileOf = d => (d.file ? path.join(SRC, d.file) : numVariants(d.frame).map(f => path.join(SRC, `${f}.html`)).find(f => fs.existsSync(f)) || null);

/** 틀 한 줄 → { html(복사 글의 처음 상태), preview(카드 미리보기 — 닫힘 틀은 열린 판), info } · 지켜야 할 것이 어긋나면 던져요 */
export function frameHtml(d) {
  if (!/^[a-z0-9-]{1,15}$/.test(d.id)) throw new Error(`${d.id}: id 는 소문자 · 숫자 · - 로 15자 이하`);
  const file = fileOf(d);
  if (!file) throw new Error(`${d.id}: 틀 파일이 없어요`);
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const html = fitFix(sampleNames(focusRing(fillSlots(martAudio(stripAlias(raw.trim())), d.values))));
  const bad = problems(html);
  if (bad.length) throw new Error(`${d.id}: ${bad.join(' · ')}`);
  const info = sf.simpleFrameInfo(html);
  if (d.frame && numVariants(d.frame).every(f => f !== info.key)) throw new Error(`${d.id}: 파일 뿌리가 gk-${info.key} 예요(DEFS 는 ${d.frame})`);
  return { html, preview: sf.peekSimple(html, d.peek), info };
}
/** 시험용 견본 한 줄(tools/simple-frames/sample-08-blind.html — 첫 길 닦기 때 넣은 이식판 08 밤 · 자료에는 안 들어가요) */
export const SAMPLE_DEF = { id: 'simple-sample', file: 'sample-08-blind.html', sample: true, name: '블라인드(시험 견본)', emoji: '🪟', desc: '', values: SOUND };

/** --pull: 이식판에서 틀마다 원래 판(gk-tn-* · gk-noaud 없는 판) 한 벌을 tools/simple-frames/<틀>.html 로 꺼내요(있으면 덮어써요) */
export function pull(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const out = [];
  for (const m of text.matchAll(/<div class="gk ([^"]*)">/g)) {
    const cls = m[1].split(/\s+/);
    if (cls.some(c => /^gk-tn-|^gk-noaud$/.test(c))) continue;
    const key = (cls.find(c => /^gk-(?:k|q)\d+$/.test(c)) || '').slice(3);
    if (!key) continue;
    let depth = 0, end = -1;
    const re = /<div\b[^>]*>|<\/div>/g; re.lastIndex = m.index;
    for (let t; (t = re.exec(text));) { depth += t[0][1] === '/' ? -1 : 1; if (!depth) { end = re.lastIndex; break; } }
    if (end < 0) throw new Error(`${key}: 닫는 </div> 를 못 찾았어요`);
    const name = `${key}.html`;
    fs.writeFileSync(path.join(SRC, name), `${text.slice(m.index, end)}\n`);
    out.push(name);
  }
  return out;
}

export function build() {
  const heavy = {}, rows = [], missing = [];
  for (const d of [...DEFS, ...PASS_DEFS]) {
    if (!fileOf(d)) { missing.push(`${d.frame} ${d.name}`); continue; }
    const { html, preview, info } = frameHtml(d);
    const ck = d.chunk || KEY; (heavy[ck] = heavy[ck] || {})[d.id] = { preview };
    const card = sf.facesOf(info, info.base).orig[0];
    const take = themeTakeable(preview, { id: d.id, key: sf.simpleFrameInfo(preview)?.key || '' });   // mart.js themePack 과 같은 html · 열쇠
    rows.push({ id: d.id, name: d.name, emoji: d.emoji, category: catOf(d, html), style: '심플', desc: d.desc, c: d.chunk || KEY, copyOnly: true, photo: true, ...(/<audio\b/.test(html) ? { audio: true } : {}), simple: true, bytes: Buffer.byteLength(html), fx: 'e', bg: card, ink: sf.SIMPLE_CONTRACT.ink[info.base], accent: sf.sianFit(info.K0 || '#8b8e96', '#ffffff', 4.5), ...(take.ok ? {} : { nt: take.why }) });
  }
  const used = new Set(rows.map(x => x.category));
  const files = {}, chunks = {};
  for (const [ck, items] of Object.entries(heavy)) {
    const t = `${JSON.stringify({ items })}\n`, f = `${ck}.${crypto.createHash('sha256').update(t).digest('hex').slice(0, 8)}.json`;
    files[f] = t; chunks[ck] = { file: f, n: Object.keys(items).length, bytes: Buffer.byteLength(t) };
  }
  const file = chunks[KEY].file, text = files[file];
  const index = { _: '글꾸 마트 목록 — tools/geulkku-simple.mjs 산출물(심플 새 틀 · 고치지 말고 다시 만들어요) · 옛 글꾸는 11-11 에 마트에서 뺐어요(되살리는 법은 W/outputs/지시-1110/심플-새틀-이식/마트-길닦기.md 12절)', count: rows.length, categories: CATS.filter(c => used.has(c.id)), chunks };
  const indexText = `${JSON.stringify(index, null, 1).replace(/\n}$/, '')},\n "items": [\n${rows.map(x => `  ${JSON.stringify(x)}`).join(',\n')}\n ]\n}\n`;
  return { rows, heavy, text, file, files, chunks, indexText, missing };
}

const MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (MAIN && process.argv.includes('--pull')) {
  const files = process.argv.slice(process.argv.indexOf('--pull') + 1).filter(a => !a.startsWith('--'));
  for (const f of files) { const got = pull(f); console.log(`${path.basename(path.dirname(f))}/${path.basename(f)} → 원래 판 ${got.length}틀 꺼냄: ${got.join(' · ')}`); }
}
if (MAIN) {
  const { rows, text, file, files, indexText, missing } = build();
  if (missing.length) console.log(`아직 이식판이 없어 건너뛴 틀 ${missing.length}: ${missing.join(' · ')}`);
  if (CHECK) {
    const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === indexText && Object.entries(files).every(([f, t]) => fs.existsSync(path.join(DIR, f)) && fs.readFileSync(path.join(DIR, f), 'utf8') === t);
    console.log(same ? `확인: 심플 새 틀 ${rows.length}종 그대로예요` : '심플 새 틀 자료가 달라요 — node tools/geulkku-simple.mjs 로 다시 만들어요');
    process.exit(same ? 0 : 1);
  }
  const oldFiles = fs.existsSync(OUT) ? Object.values(JSON.parse(fs.readFileSync(OUT, 'utf8')).chunks || {}).map(c => c.file) : [];
  for (const [f, t] of Object.entries(files)) fs.writeFileSync(path.join(DIR, f), t);
  for (const f of oldFiles) if (!files[f] && fs.existsSync(path.join(DIR, f))) console.log(`옛 조각 ${f} 은 이제 안 써요(지우지 않았어요)`);
  fs.writeFileSync(OUT, indexText);
  console.log(`심플 새 틀 ${rows.length}종 → 조각 ${Object.keys(files).length}개(첫 조각 ${file} ${Buffer.byteLength(text)}B) · index.json · 분류 ${[...new Set(rows.map(x => x.category))].join(' · ')}`);
}
