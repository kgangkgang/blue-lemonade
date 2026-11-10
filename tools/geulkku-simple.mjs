#!/usr/bin/env node
// 글꾸 마트 「심플 새 틀」 자료 만들기(11-11 길 닦기) — 클래스 + 틀 안 <style> 하나로 된 새 틀(시안 → 이식판)을 마트 조각 · 목록 꼴로 써요.
// - 실행: node tools/geulkku-simple.mjs [--check]   (node 24 · 외부 의존 없음 · 멱등)
//   --check: 쓰지 않고 지금 자료와 같은지만 봐요(다르면 1로 끝나요).
// - 쓰는 것: mart/data/geulkku/simple-index.json(index.json 과 같은 꼴 — items · categories · chunks) + 조각 sp-simple.<해시8>.json({ items: { <id>: { preview } } }).
//   index.json 은 건드리지 않아요. 마트는 mart/simple-frames.js 의 깃발 SIMPLE_FRAMES_ENABLED 가 켜져 있을 때만 simple-index.json 을 받아 목록에 붙여요.
// - 틀 하나 = DEFS 한 줄 + 틀 HTML 파일(tools/simple-frames/*.html — 이식판.html 의 틀 한 벌 <div class="gk …"> ~ 닫는 </div> 그대로).
//   뽑기.mjs 의 .틀.html 은 그 판에 걸리는 규칙만 추려(반대 판 낮 · 밤 규칙이 빠져요) 색 블록 사이 빈 줄도 없어서, 낮/밤 바꾸기 · 색 갈아 끼우기 입력으로는 못 써요.
//   ① 뿌리의 뽑기용 별칭 클래스(k8 · cv-bl 같은 접두 없는 이름)를 떼고 ② 견본 글 자리표({{제목}} · {{이름:X}} · {{대사:n/X}} · {{지문:n}} · {{소리이름:X}} · {{소리:n}} …)를 values 로 채우고
//   ③ 소리 카드는 마트 꼴(class="uploaded-audio" · preload="metadata" · 견본 mp3)로 ④ 미리보기는 처음엔 닫힌 틀만 열린 판(peekSimple — 복사 글은 mart.js shutPeek 가 닫아요).
// - 지금 DEFS 는 길 시험용 견본 하나(08 블라인드 · sample:true)뿐이에요. 실제 틀을 넣는 차례는 W/outputs/지시-1110/심플-새틀-이식/마트-길닦기.md.
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
const CAT = { id: 'simple-new', label: '심플 새 틀', group: 'concept' };
const KEY = 'sp-simple';

// 틀 한 줄: id(15자 이하 — 테마로 받을 때 대사색 꼬리 9자가 붙어도 24자 안) · 파일 · 카드 칸 · 자리표 값
export const DEFS = [
  {
    // 견본 출처: W/outputs/지시-1110/심플-새틀-시안/이식판.html(11-10 23:56 판 · sha256 8fe594131271…) 1341~1438줄 「08 · 블라인드 · 밤」(원래 판)
    id: 'simple-sample', file: 'sample-08-blind.html', sample: true,
    name: '블라인드(길 시험 견본)', emoji: '🪟', bg: '#13233b', ink: '#e4e9f0', accent: '#3aa7ff',
    desc: '심플 새 틀 길 시험용 견본(08 블라인드 이식판) — 제목 줄을 누르면 블라인드가 걷히고 로그가 내려와요 · 소리 카드 한 줄',
    values: { 소리: ['s1.mp3'] },
  },
];

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
    if (!info.no) bad.push('뿌리에 gk-k<번호> 없음');
    if (!info.base) bad.push('뿌리에 gk-tl · gk-td · gk-tx 없음');
    if (info.K0 === undefined) bad.push(`캐릭터 색 클래스(${info.cvClass || '없음'})를 모름 — SIMPLE_CONTRACT.cv 에 더해요`);
    if (!info.color_css) bad.push('색 블록이 없음(빈 줄로 나뉜 둘째 덩이)');
  }
  return bad;
}

export function build() {
  const heavy = {}, rows = [];
  for (const d of DEFS) {
    if (!/^[a-z0-9-]{1,15}$/.test(d.id)) throw new Error(`${d.id}: id 는 소문자 · 숫자 · - 로 15자 이하`);
    const raw = fs.readFileSync(path.join(SRC, d.file), 'utf8').replace(/\r\n/g, '\n');
    const html = fillSlots(martAudio(stripAlias(raw.trim())), d.values);
    const bad = problems(html);
    if (bad.length) throw new Error(`${d.id}: ${bad.join(' · ')}`);
    const preview = sf.peekSimple(html);
    heavy[d.id] = { preview };
    rows.push({ id: d.id, name: d.name, emoji: d.emoji, category: CAT.id, style: '심플', desc: d.desc, c: KEY, copyOnly: true, photo: true, ...(/<audio\b/.test(html) ? { audio: true } : {}), simple: true, ...(d.sample ? { sample: true } : {}), bytes: Buffer.byteLength(html), fx: 'e', bg: d.bg, ink: d.ink, accent: d.accent });
  }
  const text = `${JSON.stringify({ items: heavy })}\n`;
  const file = `${KEY}.${crypto.createHash('sha256').update(text).digest('hex').slice(0, 8)}.json`;
  const index = { count: rows.length, categories: [CAT], chunks: { [KEY]: { file, n: rows.length, bytes: Buffer.byteLength(text) } } };
  const indexText = `${JSON.stringify(index, null, 1).replace(/\n}$/, '')},\n "items": [\n${rows.map(x => `  ${JSON.stringify(x)}`).join(',\n')}\n ]\n}\n`;
  return { rows, heavy, text, file, indexText };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { rows, text, file, indexText } = build();
  const base = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
  if (CHECK) {
    const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === indexText && fs.existsSync(path.join(DIR, file)) && fs.readFileSync(path.join(DIR, file), 'utf8') === text;
    console.log(same ? `확인: 심플 새 틀 ${rows.length}종(견본 ${rows.filter(x => x.sample).length}) 그대로예요 · 깃발 ${sf.SIMPLE_FRAMES_ENABLED ? '켜짐' : '꺼짐'}` : '심플 새 틀 자료가 달라요 — node tools/geulkku-simple.mjs 로 다시 만들어요');
    process.exit(same ? 0 : 1);
  }
  const oldFile = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).chunks?.[KEY]?.file : null;
  fs.writeFileSync(path.join(DIR, file), text);
  if (oldFile && oldFile !== file && fs.existsSync(path.join(DIR, oldFile))) fs.renameSync(path.join(DIR, oldFile), path.join(DIR, `${oldFile}.old`));   // 지우지 않고 이름만 바꿔 둬요
  fs.writeFileSync(OUT, indexText);
  const real = rows.filter(x => !x.sample).length;
  console.log(`심플 새 틀 ${rows.length}종(견본 ${rows.length - real}) → ${file}(${Buffer.byteLength(text)}B) · ${sf.SIMPLE_INDEX} · 깃발 ${sf.SIMPLE_FRAMES_ENABLED ? '켜짐' : '꺼짐'}`);
  console.log(`깃발을 켜면 목록 ${base.count} + ${rows.length} = ${base.count + rows.length}틀 — 공개 때 top-mart.js COUNTS.geulkku 를 견본을 뺀 ${base.count + real} 로(견본은 그 전에 DEFS 에서 빼요)`);
}
