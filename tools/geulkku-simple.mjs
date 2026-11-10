#!/usr/bin/env node
// 글꾸 마트 「심플 새 틀」 자료 만들기 — 클래스 + 틀 안 <style> 하나로 된 새 틀(시안 → 이식판)을 마트 조각 · 목록 꼴로 써요.
// - 실행: node tools/geulkku-simple.mjs [--check]   (node 24 · 외부 의존 없음 · 멱등)
//         node tools/geulkku-simple.mjs --pull <이식판.html> [<이식판.html> …]   이식판에서 틀마다 원래 판 한 벌을 tools/simple-frames/<틀>.html 로 꺼낸 뒤 자료를 다시 만들어요
//   --check: 쓰지 않고 지금 자료와 같은지만 봐요(다르면 1로 끝나요).
// - 쓰는 것: mart/data/geulkku/simple-index.json(index.json 과 같은 꼴 — items · categories · chunks) + 조각 sp-simple.<해시8>.json({ items: { <id>: { preview } } }).
//   index.json 은 건드리지 않아요. 마트는 mart/simple-frames.js 의 깃발 SIMPLE_FRAMES_ENABLED 가 켜져 있을 때 simple-index.json 을 받아 첫 화면에 써요.
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
const OUT = path.join(DIR, sf.SIMPLE_INDEX);
const KEY = 'sp-simple';
// 분류(새 틀이 스물일곱 개뿐이라 동작으로 셋만) — 소리 카드가 있으면 「소리 카드」, details 누름이 있으면 「누르면 바뀌어요」, 둘 다 없으면 「가만히 보기」
export const CATS = [
  { id: 'simple-tap', label: '누르면 바뀌어요', group: 'concept' },
  { id: 'simple-sound', label: '소리 카드', group: 'concept' },
  { id: 'simple-still', label: '가만히 보기', group: 'concept' },
];
const catOf = html => (/<audio\b/.test(html) ? 'simple-sound' : /<details\b/.test(html) ? 'simple-tap' : 'simple-still');

// 틀 한 줄: frame(뿌리의 gk-<틀> 이름) · name(소품 이름 그대로 / 대표 10 은 컨셉 이름) · emoji · desc · peek(카드 미리보기에서 열어 둘지 — 없으면 SIMPLE_CONTRACT.peek) · values(자리표 값)
//   id 는 simple-<틀>(15자 이하 — 테마로 받을 때 대사색 꼬리 9자가 붙어도 24자 안) · 색 칸(bg · ink · accent)은 틀에서 계산해요
const SOUND = { 소리: ['s1.mp3', 's2.mp3', 's3.mp3'] };
export const DEFS = [
  // 첫 묶음 8(심플-새틀-시안/이식판.html · 11-10 23:56 판) — 설명은 설명.md 1절 표 · 미리보기 열린 판은 9-1(D4: 01 · 05 · 07 · 08)
  { frame: 'k1', name: '낫표', emoji: '💬', desc: '제목 줄을 누르면 가운데 붙어 있던 「 」가 모서리로 벌어지며 글이 드러나요 · 다시 누르면 닫혀요' },
  { frame: 'k2', name: '견출지', emoji: '🏷️', desc: '제목이 견출지 한 장 — 누르면 오른쪽 아래부터 스티커처럼 뜯기고, 점선 자리를 누르면 다시 붙어요 · 소리 카드 한 줄', values: SOUND },
  { frame: 'k3', name: '바인더', emoji: '🗂️', desc: '바인더 등 · 금속 고리 셋 · 여백 줄 — 오른쪽 아래 「1 / 2」를 누르면 종이가 옆으로 밀리며 다음 장' },
  { frame: 'k4', name: '줄자', emoji: '📏', desc: '위에 0~30cm 자 · 제목 끝 커서 — 자 위에서 휠(폰은 옆으로 밀기) · 세모 줄을 누르면 첫 줄 들여쓰기 켬/끔' },
  { frame: 'k5', name: '티백', emoji: '🍵', desc: '옆에서 본 찻잔 · 흔들리는 꼬리표 · 김 — 찻잔을 누르면 캐릭터 색 찻물이 차오르고 숨은 한 줄이 나와요' },
  { frame: 'k6', name: '음성 메모', emoji: '🎙️', desc: '말소리처럼 오르내리는 음파 막대 · 흐르는 녹음 시간 · 소리 카드 한 줄', values: SOUND },
  { frame: 'k7', name: '성냥', emoji: '🔥', desc: '성냥 한 개비 — 누르면 불씨가 「탁」 붙고 테두리 · 가로줄이 캐릭터 색으로, 지문 글자가 또렷해져요 · 다시 누르면 연기 한 줄' },
  { frame: 'k8', name: '블라인드', emoji: '🪟', desc: '제목 · 블라인드 · 당김줄을 누르면 살이 위로 모이고 대화가 펼쳐져요 · 소리 카드 한 줄', values: SOUND },
  // 둘째 묶음 5(심플-새틀-시안-2/이식판.html — 만드는 중) · 셋째 묶음 4(심플-새틀-시안-3/이식판.html — 만드는 중) · 설명 · 열린 판은 이식판 설명서가 나오면 맞춰요
  { frame: 'k9', name: '지퍼', emoji: '🤐' },
  { frame: 'k10', name: '모래시계', emoji: '⏳' },
  { frame: 'k11', name: '실 전화', emoji: '📞' },
  { frame: 'k12', name: '돋보기', emoji: '🔍' },
  { frame: 'k13', name: '형광펜', emoji: '🖍️' },
  { frame: 'k15', name: '뉴턴의 요람', emoji: '⚪' },
  { frame: 'k16', name: '지우개', emoji: '🧽' },
  { frame: 'k17', name: '바람개비', emoji: '🎐' },
  { frame: 'k18', name: '토스터', emoji: '🍞' },
  // 대표 10(심플-기존틀-새방식/이식판.html · 뿌리 gk-q01~gk-q10 — 만드는 중) · 차례는 조정자 전달 차례(이식판이 나오면 번호 ↔ 컨셉을 맞춰 봐요)
  { frame: 'q01', name: '여름 바다', emoji: '🌊' },
  { frame: 'q02', name: '흐림', emoji: '☁️' },
  { frame: 'q03', name: '새해 첫날', emoji: '🌅' },
  { frame: 'q04', name: '새벽', emoji: '🌌' },
  { frame: 'q05', name: '메신저', emoji: '💭' },
  { frame: 'q06', name: '편지 봉투', emoji: '✉️' },
  { frame: 'q07', name: '호박', emoji: '🎃' },
  { frame: 'q08', name: '라면', emoji: '🍜' },
  { frame: 'q09', name: '카페 영수증', emoji: '🧾' },
  { frame: 'q10', name: 'RPG 스탯', emoji: '🎮' },
].map(d => ({ id: `simple-${d.frame}`, values: SOUND, desc: `${d.name} — 심플 새 틀`, ...d }));

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
  const html = fillSlots(martAudio(stripAlias(raw.trim())), d.values);
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
  for (const d of DEFS) {
    if (!fileOf(d)) { missing.push(`${d.frame} ${d.name}`); continue; }
    const { html, preview, info } = frameHtml(d);
    heavy[d.id] = { preview };
    const card = sf.facesOf(info, info.base).orig[0];
    rows.push({ id: d.id, name: d.name, emoji: d.emoji, category: catOf(html), style: '심플', desc: d.desc, c: KEY, copyOnly: true, photo: true, ...(/<audio\b/.test(html) ? { audio: true } : {}), simple: true, bytes: Buffer.byteLength(html), fx: 'e', bg: card, ink: sf.SIMPLE_CONTRACT.ink[info.base], accent: sf.sianFit(info.K0 || '#8b8e96', '#ffffff', 4.5) });
  }
  const used = new Set(rows.map(x => x.category));
  const text = `${JSON.stringify({ items: heavy })}\n`;
  const file = `${KEY}.${crypto.createHash('sha256').update(text).digest('hex').slice(0, 8)}.json`;
  const index = { count: rows.length, categories: CATS.filter(c => used.has(c.id)), chunks: { [KEY]: { file, n: rows.length, bytes: Buffer.byteLength(text) } } };
  const indexText = `${JSON.stringify(index, null, 1).replace(/\n}$/, '')},\n "items": [\n${rows.map(x => `  ${JSON.stringify(x)}`).join(',\n')}\n ]\n}\n`;
  return { rows, heavy, text, file, indexText, missing };
}

const MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (MAIN && process.argv.includes('--pull')) {
  const files = process.argv.slice(process.argv.indexOf('--pull') + 1).filter(a => !a.startsWith('--'));
  for (const f of files) { const got = pull(f); console.log(`${path.basename(path.dirname(f))}/${path.basename(f)} → 원래 판 ${got.length}틀 꺼냄: ${got.join(' · ')}`); }
}
if (MAIN) {
  const { rows, text, file, indexText, missing } = build();
  if (missing.length) console.log(`아직 이식판이 없어 건너뛴 틀 ${missing.length}: ${missing.join(' · ')}`);
  if (CHECK) {
    const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === indexText && fs.existsSync(path.join(DIR, file)) && fs.readFileSync(path.join(DIR, file), 'utf8') === text;
    console.log(same ? `확인: 심플 새 틀 ${rows.length}종 그대로예요 · 깃발 ${sf.SIMPLE_FRAMES_ENABLED ? '켜짐' : '꺼짐'}` : '심플 새 틀 자료가 달라요 — node tools/geulkku-simple.mjs 로 다시 만들어요');
    process.exit(same ? 0 : 1);
  }
  const oldFile = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).chunks?.[KEY]?.file : null;
  fs.writeFileSync(path.join(DIR, file), text);
  if (oldFile && oldFile !== file && fs.existsSync(path.join(DIR, oldFile))) console.log(`옛 조각 ${oldFile} 은 이제 안 써요(지우지 않았어요)`);
  fs.writeFileSync(OUT, indexText);
  console.log(`심플 새 틀 ${rows.length}종 → ${file}(${Buffer.byteLength(text)}B) · ${sf.SIMPLE_INDEX} · 분류 ${[...new Set(rows.map(x => x.category))].join(' · ')} · 깃발 ${sf.SIMPLE_FRAMES_ENABLED ? '켜짐' : '꺼짐'}`);
}
