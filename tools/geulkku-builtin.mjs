#!/usr/bin/env node
// 글꾸 마트에 테마 「로그 복사」 기본 틀 19종(기본 6 · 대화 4 · 종이 5 · 갤러리 4 — 「그대로」는 꾸밈이 없어 뺐어요)을 「내장」으로 덧붙여요.
// - 실행: node tools/geulkku-builtin.mjs --theme <테마 저장소 폴더> [--check]   (node 24 · 외부 의존 없음)
//   --check: 쓰지 않고 만들 수 있는지 · 지금 자료와 같은지만 봐요(다르면 1로 끝나요).
// - 그리기는 테마 원본 그대로예요: 테마 src/log-copy-presets.js renderLog(shape) + 기본 팔레트(settings.js 기본값 palette 'salt' · lightTint .5)의 색(log-copy-sheet.js colorsOf 와 같은 셈)
//   + 테마 마트 빌드와 같은 표본 글(tools/mart/sample.mjs) · 같은 검사 · 같은 편집용 꼴(prettyLogHtml). 그래서 테마 로그 복사 창에서 그 틀을 고른 모양과 같아요.
// - 받기(담기 · 테마용 복사)는 없어요 — 블루레몬에이드에 이미 들어 있어서 「내장」(builtin) 표시 + 미리보기 · 크게 보기 · 시식하기 · HTML 복사만.
// - 순서: (테마) mart-build → split-geulkku → tools/geulkku-accent.mjs → 이것. 멱등이에요(두 번 돌려도 같아요). split 을 다시 돌리면 이 조각이 지워지니 이것도 다시 돌려요.
// - 조각 이름의 8자 해시는 내용 sha256 앞 8자예요(조각은 브라우저 캐시 · index.json 만 no-cache).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'mart', 'data', 'geulkku');
const INDEX = path.join(DIR, 'index.json');
const arg = (name, fallback = '') => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const CHECK = process.argv.includes('--check');
const THEME = path.resolve(arg('--theme', path.join(ROOT, '..', 'omni-101')));
if (!fs.existsSync(path.join(THEME, 'src', 'log-copy-presets.js'))) { console.error(`테마 저장소를 못 찾았어요: ${THEME} (--theme 로 알려 주세요)`); process.exit(2); }
const load = rel => import(pathToFileURL(path.join(THEME, rel)).href);

const { PRESETS, renderLog } = await load('src/log-copy-presets.js');
const { prettyLogHtml } = await load('src/log-copy-pretty.js');
const { motionStyleFor } = await load('src/log-copy-motion.js');
const { withoutSvgData } = await load('src/log-copy-template.js');
const { paletteColors, safeColor, onColor } = await load('src/palettes.js');
const { SAMPLE, SAMPLE_SCREEN, UI, FIELDS } = await load('tools/mart/sample.mjs');
const themeVersion = JSON.parse(fs.readFileSync(path.join(THEME, 'manifest.json'), 'utf8')).version;

// ── 기본 팔레트 색(테마 log-copy-sheet.js colorsOf 와 같은 셈 · 설정 기본값) ──
const DEFAULTS = { palette: 'salt', lightTint: 0.5, nightTint: 1 };
function colorsOf(id) {
    const p = paletteColors({ ...DEFAULTS, palette: id });
    const v = key => safeColor(p[key] ?? p.text);
    return { bg: v('bg'), surface: v('surface'), raised: v('raised'), text: v('text'), muted: v('muted'), faint: v('faint'), accent: v('accent'), pop: safeColor(p.pop || p.accent), line: v('line'), marker: v('marker'), onAccent: onColor(p.accent) };
}
const PALETTE = colorsOf(DEFAULTS.palette);

// ── 분류(테마 로그 복사 칩 분류와 같은 묶음 · 마트의 「종이」 시리즈와 id 가 겹치지 않게 lc- 를 붙여요) ──
const CATS = { basic: { id: 'lc-basic', label: '기본 틀' }, talk: { id: 'lc-talk', label: '대화 틀' }, paper: { id: 'lc-paper', label: '종이 틀' }, gallery: { id: 'lc-gallery', label: '갤러리 틀' } };
// 테마 칩은 Font Awesome 아이콘이라 마트에선 비슷한 이모지로 보여요
const EMOJI = { card: '🪪', tab: '📁', window: '🪟', status: '📊', mini: '➖', lemon: '🍋', messenger: '💬', notify: '🔔', script: '🎬', record: '📋', note: '📓', letter: '✉️', diary: '📅', article: '📰', book: '📖', 'gallery-strip': '🖼️', 'gallery-strip-polaroid': '📸', 'gallery-grid': '🔲', 'gallery-grid-polaroid': '📷' };
const DESC = {
    card: '둥근 카드 한 장 · 제목과 알약 아래 로그', tab: '폴더 탭 머리 · 탭 아래 로그', window: '창 제목줄 · 단추 셋', status: '칸을 나눈 상태창 머리', mini: '얇은 머리 한 줄 · 가장 가벼운 틀', lemon: '레몬 머리 장식',
    messenger: '메신저 말풍선 · 양쪽으로 나뉜 대화', notify: '알림 카드처럼 쌓이는 메시지', script: '대본처럼 이름 · 대사', record: '시간이 붙은 기록 목록',
    note: '줄 노트', letter: '편지지 · 받는 사람 · 보내는 사람', diary: '날짜 머리 일기장', article: '신문 기사 · 큰 제목', book: '책 한 쪽',
    'gallery-strip': '사진 가로 넘김 + 아래 로그', 'gallery-strip-polaroid': '폴라로이드 가로 넘김 + 아래 로그', 'gallery-grid': '사진 격자 + 아래 로그', 'gallery-grid-polaroid': '폴라로이드 격자 + 아래 로그',
};
// 갤러리 틀 표본 사진(액자 마트 표본과 같은 그림 · 지어낸 표본) — 경로는 mart/ 기준, 미리보기에는 글꾸 페이지(mart/geulkku/ · mart/genie/) 기준 ../ 로 넣고 마트가 받을 때 절대 주소로 바꿔요
const SAMPLE_IMAGES = [
    { src: 'data/sample/sample-tavern.webp', alt: '선술집' },
    { src: 'data/sample/sample-blossom.webp', alt: '벚꽃길' },
    { src: 'data/sample/sample-night.webp', alt: '밤거리' },
];

// ── 테마 마트 빌드(tools/mart-build.mjs previewOf)와 같은 검사 · 같은 꼴 ──
function previewOf(html, id, label) {
    const body = html.replace(/ data-f="[a-z]+"/g, '').replace(/ data-bl-(?!egg=)[a-z]+(?:="[^"]*")?/g, '');
    const plain = withoutSvgData(body);
    if (plain === null) throw new Error(`${id}: 그림(svg) 부품에 쓸 수 없는 것이 있어요`);
    if (/<script|<style|\sclass=|\son[a-z]+=|javascript:|url\(|var\(--/i.test(plain.replace(/curl/g, ''))) throw new Error(`${id}: 미리보기(HTML 복사)에 실행 · 주소 · class 가 있어요`);
    const style = motionStyleFor(body);
    if (/url\(|@import|<\/style[\s\S]*<style/i.test(style)) throw new Error(`${id}: 움직임 <style> 이 이상해요`);
    const preview = prettyLogHtml(html, { label, head: style, fields: false });
    if (!preview.startsWith('<!-- ') || (preview.match(/<!-- ▼ 메시지 \d+ 시작/g) ?? []).length !== SAMPLE.messages.length) throw new Error(`${id}: 미리보기를 편집용 꼴로 못 만들었어요`);
    return preview;
}

// ── 대비(담기 단추 자리의 강조색 · tools/geulkku-accent.mjs 와 같은 기준 4.5) ──
const lum = hex => { const n = parseInt(hex.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const accentOf = c => [c.accent, c.text].find(v => /^#[0-9a-f]{6}$/i.test(v) && contrast(v, '#fdfeff') >= 4.5) || '#2264a5';

// ── 만들기 ──
const list = PRESETS.filter(p => p.render && !p.template && CATS[p.category]);
if (list.length !== 19) throw new Error(`기본 틀이 19종이 아니에요(${list.length}) — 테마 PRESETS 가 바뀌었는지 봐요`);
const rows = {}, items = [];
for (const p of list) {
    const id = `lc-${p.id}`, cat = CATS[p.category];
    const images = p.images ? SAMPLE_IMAGES : [];
    const html = renderLog(SAMPLE, { shape: p.id, colors: PALETTE, ui: UI, fields: FIELDS, size: 'm', screen: SAMPLE_SCREEN, images: images.map(x => ({ ...x, src: `../${x.src}` })) });
    if (!html) throw new Error(`${id}: 그려지지 않았어요`);
    const preview = previewOf(html, id, p.label);
    rows[id] = { preview, shape: p.id, palette: PALETTE, ...(images.length ? { images } : {}) };
    const body = preview.replace(/<style>[\s\S]*?<\/style>/g, '');
    const fx = `${/style="[^"]*animation\s*:/.test(body) ? 'm' : ''}${/ data-bl-egg="/.test(preview) ? 'e' : ''}`;
    items.push({ id, name: p.label, emoji: EMOJI[p.id] || '📝', category: cat.id, style: '심플', desc: `테마에 들어 있어요 · ${DESC[p.id] || p.label}${images.length ? ' · 사진은 표본(내 사진 주소로 바꿔요)' : ''} · 에이드 색을 따라가요`, c: 'lc-builtin', builtin: true, ...(fx ? { fx } : {}), bg: PALETTE.bg, ink: PALETTE.text, accent: accentOf(PALETTE) });
}
const text = `${JSON.stringify({ items: rows })}\n`;
const file = `lc-builtin.${crypto.createHash('sha256').update(text).digest('hex').slice(0, 8)}.json`;

// ── index.json 에 덧붙이기(전에 붙인 lc- 것은 걷고 다시) ──
const raw = fs.readFileSync(INDEX, 'utf8');
const data = JSON.parse(raw);
const ids = new Set(items.map(x => x.id));
const before = data.items.filter(x => !ids.has(x.id) && x.c !== 'lc-builtin');
for (const x of items) if (before.some(y => y.id === x.id)) throw new Error(`${x.id}: id 가 겹쳐요`);
const catIds = new Set(Object.values(CATS).map(c => c.id));
data.categories = [...data.categories.filter(c => !catIds.has(c.id)), ...Object.values(CATS).map(c => ({ id: c.id, label: c.label, builtin: true }))];
const oldChunk = data.chunks['lc-builtin']?.file;
data.chunks = { ...Object.fromEntries(Object.entries(data.chunks).filter(([k]) => k !== 'lc-builtin')), 'lc-builtin': { file, n: items.length, bytes: Buffer.byteLength(text) } };
data.items = [...before, ...items];
data.count = data.items.length;
const NOTE = ` · tools/geulkku-builtin.mjs 가 테마 ${themeVersion} 로그 복사 기본 틀 ${items.length}종(내장)을 덧붙여요`;
data._ = String(data._).replace(/ · tools\/geulkku-builtin\.mjs 가 [^·]*?덧붙여요$/, '') + NOTE;
// 꼴은 split-geulkku · geulkku-accent 와 같게(머리는 들여쓰기 1 · 항목은 한 줄에 하나)
const { items: all, ...head } = data;
const indexText = `${JSON.stringify(head, null, 1).replace(/\n}$/, '')},\n "items": [\n${all.map(x => `  ${JSON.stringify(x)}`).join(',\n')}\n ]\n}\n`;

const same = indexText === raw && oldChunk === file && fs.existsSync(path.join(DIR, file));
console.log(`기본 틀 ${items.length}종(${Object.values(CATS).map(c => `${c.label} ${items.filter(x => x.category === c.id).length}`).join(' · ')}) · 조각 ${file} ${Buffer.byteLength(text)}B · 글꾸 모두 ${data.count}종 · 내장 ${data.items.filter(x => x.builtin).length} · 테마 ${themeVersion} · 기본 팔레트 ${DEFAULTS.palette}(바탕 ${PALETTE.bg} · 강조 ${PALETTE.accent})`);
if (CHECK) {
    if (!same) { console.log('지금 자료와 달라요 — --check 없이 다시 돌려요'); process.exit(1); }
    console.log('지금 자료와 같아요');
    process.exit(0);
}
if (oldChunk && oldChunk !== file) fs.rmSync(path.join(DIR, oldChunk), { force: true });
fs.writeFileSync(path.join(DIR, file), text);
fs.writeFileSync(INDEX, indexText);
console.log(same ? '바뀐 것 없어요' : '썼어요');
