#!/usr/bin/env node
// 글꾸 마트에 「장면 글꾸」 8종(사랑 재판 · 속보 방송 · 탑승권 · 레시피 카드 · 타로 리딩 · 터미널 · 학적부 · 전보 — 서류 · 화면 한 장면을 흉내 낸 틈 템플릿)을 덧붙여요(11-09). tools/geulkku-react.mjs 와 같은 길이에요.
// - 실행: node tools/geulkku-scene.mjs --theme <테마 저장소 폴더> [--check]   (node 24 · 외부 의존 없음)
//   --check: 쓰지 않고 만들 수 있는지 · 지금 자료와 같은지만 봐요(다르면 1로 끝나요).
// - 틀 자료는 테마 tools/mart/scene-geulkku.mjs(SCENE_FRAMES) 하나예요 — 테마 내장(분류 「장면」)과 같은 틀이에요.
// - 받기 항목 · 미리보기는 테마 마트 빌드(tools/mart-build.mjs sianItems · previewOf)와 같은 길이에요: 같은 검사(checkTemplate · checkItem) · 같은 표본 글 · 같은 편집용 꼴(prettyLogHtml) · 그 틀이 쓰는 움직임만 맨 앞 <style>.
//   그래서 상세 창 · 시식 창 · HTML 복사 · 테마용 복사 · 담기가 다른 심플 틀과 똑같이 돼요.
// - 테마 1.1.0 부터는 테마에도 들어 있지만 마트에서는 「내장」 표시를 하지 않아요(1.0.8 이하 사용자도 담아 갈 수 있게).
// - 순서: (테마) mart-build → split-geulkku → geulkku-accent → geulkku-builtin → 이것 → geulkku-accent(아이콘 · 강조색). 멱등이에요. split 을 다시 돌리면 이 조각이 지워지니 이것도 다시 돌려요.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'mart', 'data', 'geulkku');
const INDEX = path.join(DIR, 'index.json');
const arg = (name, fallback = '') => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const CHECK = process.argv.includes('--check');
const THEME = path.resolve(arg('--theme', ''));
if (!fs.existsSync(path.join(THEME, 'tools', 'mart', 'scene-geulkku.mjs'))) { console.error(`테마 저장소(tools/mart/scene-geulkku.mjs)를 못 찾았어요: ${THEME} (--theme 로 알려 주세요)`); process.exit(2); }
const load = rel => import(pathToFileURL(path.join(THEME, rel)).href);

const { SCENE_FRAMES, SCENE_CATEGORY } = await load('tools/mart/scene-geulkku.mjs');
const { renderLog } = await load('src/log-copy-presets.js');
const { checkTemplate, withoutSvgData } = await load('src/log-copy-template.js');
const { checkItem } = await load('src/mart-import.js');
const { prettyLogHtml } = await load('src/log-copy-pretty.js');
const { motionStyleFor } = await load('src/log-copy-motion.js');
const { SAMPLE, SAMPLE_SCREEN, UI, FIELDS } = await load('tools/mart/sample.mjs');

const STYLE = '심플', KEY = `sp-${SCENE_CATEGORY.id}`;
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
for (const f of SCENE_FRAMES) {
    const checked = checkTemplate(f.template);
    if (!checked.ok) throw new Error(`${f.id}: 템플릿이 테마 검사를 못 통과해요 — ${checked.reason}`);
    const entry = { kind: 'geulkku', id: f.id, label: f.label, emoji: f.emoji, template: f.template, colors: f.colors, messages: f.messages || 'box', tail: f.tail || '', ...(f.type ? { type: f.type } : {}) };
    const { item, reason } = checkItem(entry);
    if (!item) throw new Error(`${f.id}: ${reason}`);
    const preview = previewOf(renderLog(SAMPLE, { template: item, ui: UI, fields: FIELDS, size: 'm', screen: SAMPLE_SCREEN }), f.id, f.label);
    heavy[f.id] = { preview, template: entry.template, colors: entry.colors, messages: entry.messages, tail: entry.tail, ...(entry.type ? { type: entry.type } : {}) };
    const body = preview.replace(/<style>[\s\S]*?<\/style>/g, '');
    const fx = `${/style="[^"]*animation\s*:/.test(body) ? 'm' : ''}${/ data-bl-egg="/.test(preview) ? 'e' : ''}`;
    rows.push({ id: f.id, name: f.label, emoji: f.emoji, category: SCENE_CATEGORY.id, style: STYLE, desc: `${f.desc}${/<details/.test(f.template) ? ' · 붙이면 닫힌 채 시작해요(미리보기만 펼쳐 보여요)' : ''}`, c: KEY, bytes: Buffer.byteLength(JSON.stringify({ 'bl-mart': 1, items: [entry] })), ...(fx ? { fx } : {}), bg: f.colors.bg, ink: f.colors.text });
}

const raw = fs.readFileSync(INDEX, 'utf8');
const data = JSON.parse(raw);
const ids = new Set(rows.map(r => r.id));
const keep = data.items.filter(x => !ids.has(x.id) && x.category !== SCENE_CATEGORY.id);
// accent · icon: tools/geulkku-accent.mjs 와 같은 셈을 이 8종에만 — 임시 사본에서 돌려 그 결과(목록 accent · icon, 조각 accent · icon, 아이콘 svg)만 옮겨요(다른 틀 자료는 건드리지 않아요)
{
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-scene-'));
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
const text = `${JSON.stringify({ items: heavy })}\n`;
const file = `${KEY}.${crypto.createHash('sha256').update(text).digest('hex').slice(0, 8)}.json`;
// 카드 차례: 심플 그림체 끝(일러스트 앞)에 — split-geulkku 와 같은 그림체 차례
const at = keep.findIndex(x => (x.style || '일러스트') !== '심플');
const items = at < 0 ? [...keep, ...rows] : [...keep.slice(0, at), ...rows, ...keep.slice(at)];
const categories = [...data.categories.filter(c => c.id !== SCENE_CATEGORY.id)];
const builtinAt = categories.findIndex(c => c.builtin);
const cat = { id: SCENE_CATEGORY.id, label: SCENE_CATEGORY.label, group: 'concept' };
if (builtinAt < 0) categories.push(cat); else categories.splice(builtinAt, 0, cat);
const chunks = { ...data.chunks, [KEY]: { file, n: rows.length, bytes: Buffer.byteLength(text) } };
const { items: _i, categories: _c, chunks: _k, count: _n, ...head } = data;
const next = { ...head, count: items.length, categories, chunks };
const keys = Object.keys(data);   // 머리 칸 차례 그대로(_ · built · count · categories · styles · chunks · items)
const ordered = Object.fromEntries(keys.filter(k => k !== 'items').map(k => [k, next[k]]));
const indexText = serial({ ...ordered, items });
const oldFile = data.chunks?.[KEY]?.file;
if (CHECK) {
    const same = raw === indexText && fs.existsSync(path.join(DIR, file));
    console.log(same ? `확인: 장면 글꾸 ${rows.length}종 그대로예요` : '장면 글꾸 자료가 달라요 — node tools/geulkku-scene.mjs --theme <테마> 로 다시 만들어요');
    process.exit(same ? 0 : 1);
}
fs.writeFileSync(path.join(DIR, file), text);
if (oldFile && oldFile !== file && fs.existsSync(path.join(DIR, oldFile))) fs.rmSync(path.join(DIR, oldFile));
fs.writeFileSync(INDEX, indexText);
console.log(`장면 글꾸 ${rows.length}종 → ${file}(${Buffer.byteLength(text)}B) · 글꾸 모두 ${items.length}종 · 분류 「${SCENE_CATEGORY.label}」(컨셉 묶음)`);
