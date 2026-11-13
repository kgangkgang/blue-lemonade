// 1.0.0 극한 최적화: 한글화 글자 사전을 조각으로 나누는 목록(tools/scripts-src/korean-parts.json)을 만들어요.
//   실리태번 폴더를 **읽기만** 해서 사전 열쇠가 어디에 나오는지 봐요 — index.html 의 위 막대 서랍(#top-settings-holder) 안이면 drawers,
//   index.html 의 그 밖(첫 화면 · 입력줄 · 메뉴 · 떠 있는 창)이면 boot, scripts/templates/*.html 이면 templates, js 문자열이면 js. 어디에도 없으면 목록에 없음(= rest).
//   이김 차례: boot > drawers > templates > js. 부팅 첫 화면에서 바로 찾은 열쇠(tools/scripts-src/korean-boot-census.json · 리그에서 모음)는 자리와 상관없이 boot. 결과는 열쇠 글 대신 지문(정리한 열쇠의 SHA-1 앞 12자리 — korean-prune.json 과 같은 규칙)만 적어요.
//   tools/build-korean-dict.mjs 가 읽어 색인(ko-ui-text.index.gen.json)과 조각(ko-ui-text.<조각>.gen.json)을 만들어요. 잘못 나뉘어도 번역은 같아요 —
//   색인이 모든 열쇠를 알아 그 조각을 받으니, 나누기는 「처음에 얼마나 받나」만 바꿔요. 실리태번을 올리면(지금 1.19.0) 다시 돌려요.
// node tools/ko-dict-parts.mjs --st <실리태번 폴더> [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKorean, readPrune, keyHash } from './build-korean-dict.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PARTS_FILE = 'tools/scripts-src/korean-parts.json';
export const PART_NAMES = ['boot', 'drawers', 'templates', 'js', 'html', 'rest'];
const normalize = text => String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'template']);
const decode = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** html 글에서 (글 · title · placeholder · aria-label) 과 그 글이 든 body 바로 아래 칸의 id 를 뽑아요 — 작은 토크나이저(실리태번 index.html 용) */
export function htmlTexts(html) {
    const out = [];   // { text, top }
    const stack = [];   // { tag, id }
    const topOf = () => { const b = stack.findIndex(x => x.tag === 'body'); if (b < 0) return ''; const top = stack[b + 1]; return top ? (top.id ? '#' + top.id : top.tag) : 'body'; };
    const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
    let m;
    while ((m = re.exec(html))) {
        if (m[0].startsWith('<!--')) continue;
        if (m[1]) { const tag = m[1].toLowerCase(); for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) { stack.length = i; break; } continue; }
        if (m[2]) {
            const tag = m[2].toLowerCase(), attrs = m[3] || '';
            const id = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/.exec(attrs);
            const entry = { tag, id: id ? (id[1] ?? id[2] ?? id[3]) : '' };
            if (RAW.has(tag)) {   // 안의 글은 건너뛰어요
                const close = html.indexOf(`</${m[2]}`, re.lastIndex);
                if (close > 0) re.lastIndex = close;
                continue;
            }
            stack.push(entry);
            for (const name of ['title', 'placeholder', 'aria-label']) {
                const a = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
                if (a) out.push({ text: decode(a[1] ?? a[2] ?? ''), top: topOf() });
            }
            if (VOID.has(tag) || m[4]) stack.pop();
            continue;
        }
        if (m[5] && /[A-Za-z]/.test(m[5])) out.push({ text: decode(m[5]), top: topOf() });
    }
    return out;
}
function listFiles(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { if (!['locales', 'img', 'webfonts', 'sounds', 'node_modules', 'lib'].includes(entry.name)) listFiles(full, out); }
        else out.push(full);
    }
    return out;
}
/** 조각 목록: { 지문: 조각 } — 어디에도 없는 열쇠는 안 적어요(rest) */
export const CENSUS_FILE = 'tools/scripts-src/korean-boot-census.json';
/** 부팅 첫 화면에서 바로 찾은 열쇠 목록(리그에서 모음) — 이 열쇠는 자리와 상관없이 boot 조각 */
export function readCensus(file = path.join(root, CENSUS_FILE)) {
    if (!fs.existsSync(file)) return new Set();
    return new Set(JSON.parse(fs.readFileSync(file, 'utf8')).keys || []);
}
export function classify(exactKeys, st, census = readCensus()) {
    const pub = path.join(st, 'public');
    const keys = new Set(exactKeys);
    const found = new Map();   // key → part
    for (const key of census) if (keys.has(key)) found.set(key, 'boot');
    const put = (key, part) => { const cur = found.get(key); const rank = name => PART_NAMES.indexOf(name); if (!cur || rank(part) < rank(cur)) found.set(key, part); };
    for (const { text, top } of htmlTexts(fs.readFileSync(path.join(pub, 'index.html'), 'utf8'))) {
        const key = normalize(text);
        if (keys.has(key)) put(key, top === '#top-settings-holder' ? 'drawers' : 'boot');
    }
    const templates = path.join(pub, 'scripts', 'templates');
    for (const file of fs.existsSync(templates) ? fs.readdirSync(templates) : []) {
        if (!file.endsWith('.html')) continue;
        for (const { text } of htmlTexts(fs.readFileSync(path.join(templates, file), 'utf8'))) { const key = normalize(text); if (keys.has(key)) put(key, 'templates'); }
    }
    const js = listFiles(path.join(pub, 'scripts')).filter(f => /\.m?js$/.test(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n') + fs.readFileSync(path.join(pub, 'script.js'), 'utf8');
    for (const key of keys) if (!found.has(key) && key.length >= 6 && js.includes(key)) put(key, 'js');
    const parts = {};
    for (const key of [...found.keys()].sort()) parts[keyHash(key)] = found.get(key);
    return parts;
}
export function readParts(file = path.join(root, PARTS_FILE)) {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')).parts || {};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const st = args.includes('--st') ? args[args.indexOf('--st') + 1] : '';
    const check = args.includes('--check');
    if (!st || !fs.existsSync(path.join(st, 'public', 'index.html'))) { console.error('--st <실리태번 폴더> 가 필요해요 (public/index.html 이 있는 곳)'); process.exit(2); }
    const { dictionary } = buildKorean(fs.readFileSync(path.join(root, 'tools/scripts-src/korean.js'), 'utf8'), readPrune());
    const parts = classify(dictionary.exact.map(([key]) => key), st);
    const counts = {}; for (const part of Object.values(parts)) counts[part] = (counts[part] || 0) + 1;
    counts.rest = dictionary.exact.length - Object.keys(parts).length;
    const text = JSON.stringify({ note: '한글화 글자 사전 조각 목록 — tools/ko-dict-parts.mjs 가 실리태번 1.19.0 파일을 읽어 만들어요(지문 → 조각). 없는 지문은 rest', st: path.basename(st), counts, parts }, null, 0).replace(/,"/g, ',\n"').replace(/\{"/g, '{\n"') + '\n';
    const file = path.join(root, PARTS_FILE);
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (check) { console.log(old === text ? '[같음] 조각 목록 = 실리태번 파일에서 만든 것' : '[다름] 조각 목록이 실리태번 파일과 달라요 — node tools/ko-dict-parts.mjs --st <폴더>'); process.exit(old === text ? 0 : 1); }
    fs.writeFileSync(file, text);
    console.log(`조각 목록을 만들었어요: ${JSON.stringify(counts)} → ${PARTS_FILE}`);
}
