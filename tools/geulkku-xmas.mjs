#!/usr/bin/env node
// 글꾸 마트에 「연말 · 크리스마스」 9종을 덧붙여요(11-09).
//   - 로그 복사 틀 6종(눈 오는 창가 · 성탄 카드 · 오너먼트 대화 · 겨울 기차표 · 연말 시상식 · 소원 부적): 테마 tools/mart/xmas-geulkku.mjs(XMAS_FRAMES) 하나 — 테마 1.1.1 로그 복사 「연말」 칩과 같은 틀.
//     받기 항목 · 미리보기는 tools/geulkku-scene.mjs 와 같은 길이에요(같은 검사 · 표본 글 · 편집용 꼴 · 상세 · 시식 · HTML 복사 · 테마용 복사 · 담기).
//   - 커뮤니티 글 틀 3종(크리스마스 화보 · 연말 결산 앨범 · 캐롤 플레이리스트): tools/xmas-templates.cjs — 화보 · 노래 앨범과 같이 copyOnly + photo(HTML 복사만).
// - 실행: node tools/geulkku-xmas.mjs --theme <테마 저장소 폴더> [--check]   (node 24 · 외부 의존 없음 · 멱등)
// - 카드는 이미 있는 「크리스마스 · 연말」(christmas) 칩에 들어가요(새 칩 없음). geulkku-scene.mjs 뒤에 돌려요. split 을 다시 돌리면 이것도 다시 돌려요.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { polishHtml } = (await import('node:module')).createRequire(import.meta.url)('./geulkku-polish/polish.cjs');   // 11-10 공통 다듬기(정화기 맞춤)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'mart', 'data', 'geulkku');
const INDEX = path.join(DIR, 'index.json');
const arg = (name, fallback = '') => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const CHECK = process.argv.includes('--check');
const THEME = path.resolve(arg('--theme', ''));
if (!fs.existsSync(path.join(THEME, 'tools', 'mart', 'xmas-geulkku.mjs'))) { console.error(`테마 저장소(tools/mart/xmas-geulkku.mjs)를 못 찾았어요: ${THEME} (--theme 로 알려 주세요)`); process.exit(2); }
const load = rel => import(pathToFileURL(path.join(THEME, rel)).href);

const { XMAS_FRAMES, XMAS_CATEGORY } = await load('tools/mart/xmas-geulkku.mjs');
const { gallery, recap, carol, forbidden, wordsBad } = createRequire(import.meta.url)('./xmas-templates.cjs');
const { renderLog } = await load('src/log-copy-presets.js');
const { checkTemplate, withoutSvgData } = await load('src/log-copy-template.js');
const { checkItem } = await load('src/mart-import.js');
const { prettyLogHtml } = await load('src/log-copy-pretty.js');
const { motionStyleFor } = await load('src/log-copy-motion.js');
const { SAMPLE, SAMPLE_SCREEN, UI, FIELDS } = await load('tools/mart/sample.mjs');

// 마트에는 이미 「크리스마스 · 연말」 분류(christmas · 그림체 넷 96종)가 있어요 — 새 칩을 만들지 않고 그 칩에 9종을 더해요(이름이 거의 같은 칩 둘이 생기지 않게).
const STYLE = '심플', KEY = `sp-${XMAS_CATEGORY.id}`, CAT = 'christmas';
const MINE = /^(c-xmas-sp-\d+|xmas-[a-z]+)$/;
// 테마 tools/mart-build.mjs previewOf 와 같은 셈(「HTML 복사」 글)
function previewOf(html, id, label) {
    const body = html.replace(/ data-f="[a-z]+"/g, '').replace(/ data-bl-(?!egg=|peek=)[a-z]+(?:="[^"]*")?/g, '');   // 11-09 data-bl-peek: 미리보기로만 펼친 상자(복사할 때 마트 shutPeek 가 닫아요)
    const plain = withoutSvgData(body);
    if (plain === null) throw new Error(`${id}: 그림(svg) 부품에 쓸 수 없는 것이 있어요`);
    if (/<script|<style|\sclass=|\son[a-z]+=|javascript:|url\(|var\(--/i.test(plain.replace(/curl/g, ''))) throw new Error(`${id}: 미리보기(HTML 복사)에 실행 · 주소 · class 가 있어요`);
    const style = motionStyleFor(body);
    if (/url\(|@import|<\/style[\s\S]*<style/i.test(style)) throw new Error(`${id}: 움직임 <style> 이 이상해요`);
    const preview = prettyLogHtml(html, { label, head: style, fields: false });
    if (!preview.startsWith('<!-- ') || (preview.match(/<!-- ▼ 메시지 \d+ 시작/g) ?? []).length !== SAMPLE.messages.length) throw new Error(`${id}: 미리보기를 편집용 꼴로 못 만들었어요`);
    return preview;
}

// split-geulkku · geulkku-accent 와 같은 index.json 꼴(머리는 들여쓰기 1 · 항목은 한 줄에 하나)
const serial = ({ items, ...head }) => `${JSON.stringify(head, null, 1).replace(/\n}$/, '')},\n "items": [\n${items.map(x => `  ${JSON.stringify(x)}`).join(',\n')}\n ]\n}\n`;
const rows = [], heavy = {};
for (const f of XMAS_FRAMES) {
    const checked = checkTemplate(f.template);
    if (!checked.ok) throw new Error(`${f.id}: 템플릿이 테마 검사를 못 통과해요 — ${checked.reason}`);
    const entry = { kind: 'geulkku', id: f.id, label: f.label, emoji: f.emoji, template: f.template, colors: f.colors, messages: f.messages || 'box', tail: f.tail || '', ...(f.type ? { type: f.type } : {}) };
    const { item, reason } = checkItem(entry);
    if (!item) throw new Error(`${f.id}: ${reason}`);
    const preview = previewOf(renderLog(SAMPLE, { template: item, ui: UI, fields: FIELDS, size: 'm', screen: SAMPLE_SCREEN }), f.id, f.label);
    heavy[f.id] = { preview: polishHtml(preview), template: polishHtml(entry.template, { preview: false }), colors: entry.colors, messages: entry.messages, tail: entry.tail, ...(entry.type ? { type: entry.type } : {}) };
    const body = preview.replace(/<style>[\s\S]*?<\/style>/g, '');
    const fx = `${/style="[^"]*animation\s*:/.test(body) ? 'm' : ''}${/ data-bl-egg="/.test(preview) ? 'e' : ''}`;
    rows.push({ id: f.id, name: f.label, emoji: f.emoji, category: CAT, style: STYLE, desc: `${f.desc}${/<details/.test(f.template) ? ' · 붙이면 닫힌 채 시작해요(미리보기만 펼쳐 보여요)' : ''}`, c: KEY, bytes: Buffer.byteLength(JSON.stringify({ 'bl-mart': 1, items: [entry] })), ...(fx ? { fx } : {}), bg: f.colors.bg, ink: f.colors.text });
}

const raw = fs.readFileSync(INDEX, 'utf8');
const data = JSON.parse(raw);
const ids = new Set(rows.map(r => r.id));
const keep = data.items.filter(x => !ids.has(x.id) && !MINE.test(x.id));
if (!data.categories.some(c => c.id === CAT)) throw new Error(`마트에 「${CAT}」 분류가 없어요`);
// accent · icon: tools/geulkku-accent.mjs 와 같은 셈을 이 8종에만 — 임시 사본에서 돌려 그 결과(목록 accent · icon, 조각 accent · icon, 아이콘 svg)만 옮겨요(다른 틀 자료는 건드리지 않아요)
{
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-xmas-'));
    const tdir = path.join(tmp, 'mart', 'data', 'geulkku');
    fs.mkdirSync(path.join(tmp, 'tools'), { recursive: true });
    fs.mkdirSync(tdir, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'tools', 'geulkku-accent.mjs'), path.join(tmp, 'tools', 'geulkku-accent.mjs'));
    const t = `${JSON.stringify({ items: heavy })}\n`;
    fs.writeFileSync(path.join(tdir, 'x.json'), t);
    const { items: _x, ...h } = data;
    fs.writeFileSync(path.join(tdir, 'index.json'), serial({ ...h, count: rows.length, chunks: { [KEY]: { file: 'x.json', n: rows.length, bytes: Buffer.byteLength(t) } }, items: rows }));
    const run = spawnSync(process.execPath, [path.join(tmp, 'tools', 'geulkku-accent.mjs')], { encoding: 'utf8' });
    if (run.status !== 0) throw new Error(`geulkku-accent 를 못 돌렸어요: ${run.stderr || run.stdout}`);
    const out = JSON.parse(fs.readFileSync(path.join(tdir, 'index.json'), 'utf8'));
    const outChunk = JSON.parse(fs.readFileSync(path.join(tdir, out.chunks[KEY].file), 'utf8')).items;
    for (const r of rows) {
        const o = out.items.find(x => x.id === r.id);
        if (o && 'accent' in o) r.accent = o.accent;
        if (o && 'icon' in o) r.icon = o.icon;
        for (const k of ['accent', 'icon']) if (outChunk[r.id] && k in outChunk[r.id]) heavy[r.id][k] = outChunk[r.id][k];
        if (r.icon && !CHECK) { const src = path.join(tdir, r.icon), to = path.join(DIR, r.icon); if (fs.existsSync(src) && !fs.existsSync(to)) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(src, to); } }
    }
    fs.rmSync(tmp, { recursive: true, force: true });
}
// 커뮤니티 글 틀 3종(copyOnly · photo) — 화보 · 노래 앨범과 같은 줄 꼴
const COMMON = '사진 · mp3 주소와 글을 바꿔 깡싸 글 HTML 칸에 붙여요 · 수가 달라도 블록을 복사 · 지우기만 하면 돼요 · 번호는 저절로';
const PHOTO = [
  { id: 'xmas-gallery', name: '크리스마스 화보', emoji: '🎄', fn: gallery, bg: '#0e1a33', ink: '#f4f1ea', accent: '#c8323a', desc: `밤하늘에 눈이 흐르고 꼬마전구가 깜박이는 화보 — 금빛 액자에 한 장씩(두 장 · 가로 장), 위 「이전 · 다음」과 「03 / 12」 · 사진 번호 · 코멘트 칸 · ${COMMON}` },
  { id: 'xmas-recap', name: '연말 결산 앨범', emoji: '📔', fn: recap, bg: '#efe9dd', ink: '#24201b', accent: '#a8272d', desc: `종이 앨범 — 큰 연도 · 올해의 한 장 · 달마다 사진 묶음(01 JAN …)과 메모 · 맨 아래 「사진 NN장 · 달 NN개」 합계가 저절로 · ${COMMON}` },
  { id: 'xmas-carol', name: '캐롤 플레이리스트', emoji: '🎶', fn: carol, bg: '#0f2a1f', ink: '#f4efe2', accent: '#e8c766', audio: true, desc: `전나무 밤 · 사탕 줄무늬 띠 · 도는 레코드 — 한 줄에 한 곡(동그란 그림 · ♪ 번호 · 제목 · 캐릭터 칩 · mp3), 「그림 ▾」를 누르면 그 곡 그림이 펼쳐져요 · 곡마다 색 · ${COMMON}` },
];
for (const d of PHOTO) {
  const { html } = d.fn();
  const bad = forbidden(html).concat(wordsBad(html));
  if (bad.length) throw new Error(`${d.id}: 깡싸에서 지워지거나 쓰면 안 되는 것이 있어요 — ${bad.join(', ')}`);
  for (const m of html.matchAll(/src="https:\/\/kgangkgang\.github\.io\/blue-lemonade\/mart\/data\/sample\/(hwabo|song)\/([^"]+)"/g)) if (!fs.existsSync(path.join(ROOT, 'mart', 'data', 'sample', m[1], m[2]))) throw new Error(`${d.id}: 견본 ${m[1]}/${m[2]} 이 없어요`);
  heavy[d.id] = { preview: html };
  rows.push({ id: d.id, name: d.name, emoji: d.emoji, category: CAT, style: STYLE, desc: d.desc, c: KEY, copyOnly: true, photo: true, ...(d.audio ? { audio: true } : {}), bytes: Buffer.byteLength(html), fx: 'e', bg: d.bg, ink: d.ink, accent: d.accent });
}
const text = `${JSON.stringify({ items: heavy })}\n`;
const file = `${KEY}.${crypto.createHash('sha256').update(text).digest('hex').slice(0, 8)}.json`;
// 카드 차례: 「크리스마스 · 연말」 심플 그림체 카드 바로 뒤(없으면 심플 그림체 끝) · 분류 목록은 그대로
let at = keep.findLastIndex(x => x.category === CAT && (x.style || '일러스트') === STYLE) + 1;
if (at <= 0) { at = keep.findIndex(x => (x.style || '일러스트') !== STYLE); if (at < 0) at = keep.length; }
const items = [...keep.slice(0, at), ...rows, ...keep.slice(at)];
const categories = data.categories;
const chunks = { ...data.chunks, [KEY]: { file, n: rows.length, bytes: Buffer.byteLength(text) } };
const { items: _i, categories: _c, chunks: _k, count: _n, ...head } = data;
const next = { ...head, count: items.length, categories, chunks };
const keys = Object.keys(data);   // 머리 칸 차례 그대로(_ · built · count · categories · styles · chunks · items)
const ordered = Object.fromEntries(keys.filter(k => k !== 'items').map(k => [k, next[k]]));
const indexText = serial({ ...ordered, items });
const oldFile = data.chunks?.[KEY]?.file;
if (CHECK) {
    const same = raw === indexText && fs.existsSync(path.join(DIR, file));
    console.log(same ? `확인: 연말 · 크리스마스 ${rows.length}종 그대로예요` : '연말 · 크리스마스 자료가 달라요 — node tools/geulkku-xmas.mjs --theme <테마> 로 다시 만들어요');
    process.exit(same ? 0 : 1);
}
fs.writeFileSync(path.join(DIR, file), text);
if (oldFile && oldFile !== file && fs.existsSync(path.join(DIR, oldFile))) fs.rmSync(path.join(DIR, oldFile));
fs.writeFileSync(INDEX, indexText);
console.log(`연말 · 크리스마스 ${rows.length}종 → ${file}(${Buffer.byteLength(text)}B) · 글꾸 모두 ${items.length}종 · 분류 「크리스마스 · 연말」(christmas)에 더함`);
