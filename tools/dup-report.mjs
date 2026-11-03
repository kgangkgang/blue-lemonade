// 9.0.5 중복 전수조사 도구 — 테마 src/ · css/ 와 내장 애드온에서 같은/거의 같은 파일 · 함수 · CSS 선언 덩어리를 찾아요.
//   node tools/dup-report.mjs [테마 루트] [--json] [--min-fn=160] [--min-css=120] [--near=0.85] [--top=80]
//   1) 파일: 줄바꿈 · 끝 공백을 맞춘 뒤 해시가 같은 파일 묶음, 이름이 같고 줄 겹침(Jaccard)이 --near 이상인 파일 묶음
//   2) 함수: function 선언 · const x = (…) => {…} · const x = function 의 본문을 주석 · 공백 · 식별자 이름 그대로(값만 정규화) 비교
//   3) CSS: { … } 선언 덩어리(선언을 다듬어 순서 유지)를 비교해 같은 덩어리가 2곳 이상인 것
// 생성물(*.gen.css · style.css · bundled · plain)은 기본으로 빼요(--with-gen 으로 넣기).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(s => s.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const root = path.resolve(argv.find(a => !a.startsWith('--')) || '.');
const JSON_OUT = argv.includes('--json');
const WITH_GEN = argv.includes('--with-gen');
const MIN_FN = opt('min-fn', 160);
const MIN_CSS = opt('min-css', 120);
const NEAR = opt('near', 0.85);
const TOP = opt('top', 80);

const GEN_RE = /(\.gen\.css$|^style\.css$|^src\/scripts\/(bundled|plain)\/|\.min\.(js|css)$|^src\/vendor\/|\/vendor\/|\/lib\/[^/]*\.min\.)/;
const SKIP_DIR = new Set(['.git', 'node_modules', 'tools', 'server-plugin', '.github']);
const EXT = new Set(['.js', '.mjs', '.cjs', '.css']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}
const rel = p => path.relative(root, p).split(path.sep).join('/');
const files = walk(root).map(p => ({ abs: p, rel: rel(p) })).filter(f => WITH_GEN || !GEN_RE.test(f.rel));
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const area = r => { const m = r.match(/^src\/addons\/([^/]+)/); return m ? m[1] : (r.startsWith('css/') ? 'theme-css' : 'theme'); };

for (const f of files) {
  f.text = fs.readFileSync(f.abs, 'utf8').replace(/\r\n/g, '\n');
  f.size = Buffer.byteLength(f.text);
  f.norm = f.text.split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim();
  f.hash = sha(f.norm);
}

// ── 1. 파일 ─────────────────────────────────────────
const byHash = new Map();
for (const f of files) { if (f.size < 40) continue; (byHash.get(f.hash) || byHash.set(f.hash, []).get(f.hash)).push(f); }
const exactFiles = [...byHash.values()].filter(g => g.length > 1)
  .map(g => ({ name: path.basename(g[0].rel), size: g[0].size, copies: g.length, waste: g[0].size * (g.length - 1), paths: g.map(f => f.rel) }))
  .sort((a, b) => b.waste - a.waste);

const lineSet = f => new Set(f.norm.split('\n').map(l => l.trim()).filter(l => l.length > 3 && !/^(\/\/|\*|\/\*)/.test(l)));
const byName = new Map();
for (const f of files) (byName.get(path.basename(f.rel)) || byName.set(path.basename(f.rel), []).get(path.basename(f.rel))).push(f);
const nearFiles = [];
for (const [name, g] of byName) {
  if (g.length < 2) continue;
  const hashes = new Set(g.map(f => f.hash));
  if (hashes.size < 2) continue;                        // 전부 같으면 1)에서 이미 나옴
  const sets = g.map(lineSet);
  // 겹침이 --near 이상인 짝끼리 묶어요(union-find) — 이름만 같은 style.css 28벌 같은 것은 묶이지 않아요
  const parent = g.map((_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const sim = new Map();
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    let s = 1;
    if (g[i].hash !== g[j].hash) {
      let inter = 0; for (const l of sets[i]) if (sets[j].has(l)) inter++;
      const uni = sets[i].size + sets[j].size - inter;
      s = uni ? inter / uni : 0;
    }
    sim.set(`${i},${j}`, s);
    if (s >= NEAR) parent[find(i)] = find(j);
  }
  const clusters = new Map();
  g.forEach((_, i) => (clusters.get(find(i)) || clusters.set(find(i), []).get(find(i))).push(i));
  for (const idx of clusters.values()) {
    if (idx.length < 2 || new Set(idx.map(i => g[i].hash)).size < 2) continue;
    const ss = []; for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) ss.push(sim.get(`${Math.min(idx[a], idx[b])},${Math.max(idx[a], idx[b])}`));
    nearFiles.push({ name, copies: idx.length, variants: new Set(idx.map(i => g[i].hash)).size, best: +Math.max(...ss).toFixed(2), avg: +(ss.reduce((a, b) => a + b, 0) / ss.length).toFixed(2), sizes: idx.map(i => g[i].size), paths: idx.map(i => g[i].rel) });
  }
}
nearFiles.sort((a, b) => b.avg * b.sizes.reduce((x, y) => x + y, 0) - a.avg * a.sizes.reduce((x, y) => x + y, 0));

// ── 2. 함수 ─────────────────────────────────────────
// 문자열 · 주석 · 정규식 · 템플릿을 건너뛰며 짝 맞는 } 를 찾는 간단한 훑개
function matchBrace(s, open) {
  let depth = 0, i = open;
  const tpl = [];
  while (i < s.length) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { i = s.indexOf('\n', i); if (i < 0) return -1; continue; }
    if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2); if (i < 0) return -1; i += 2; continue; }
    if (c === '"' || c === "'") { i++; while (i < s.length && s[i] !== c) { if (s[i] === '\\') i++; if (s[i] === '\n') break; i++; } i++; continue; }
    if (c === '`') { i++; while (i < s.length && s[i] !== '`') { if (s[i] === '\\') i++; else if (s[i] === '$' && s[i + 1] === '{') { tpl.push(depth); depth++; i += 2; continue; } i++; } i++; continue; }
    if (c === '/') { // 정규식 추정: 앞 글자가 연산자 · 여는 괄호면
      let k = i - 1; while (k >= 0 && /\s/.test(s[k])) k--;
      if (k < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(s[k]) || /\b(return|typeof|case|in|of)$/.test(s.slice(Math.max(0, k - 6), k + 1))) {
        i++; let cls = false;
        while (i < s.length && s[i] !== '\n') { if (s[i] === '\\') { i += 2; continue; } if (s[i] === '[') cls = true; else if (s[i] === ']') cls = false; else if (s[i] === '/' && !cls) break; i++; }
        i++; continue;
      }
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (tpl.length && tpl[tpl.length - 1] === depth) { tpl.pop(); i++; while (i < s.length && s[i] !== '`') { if (s[i] === '\\') i++; else if (s[i] === '$' && s[i + 1] === '{') { tpl.push(depth); depth++; i += 2; break; } i++; } if (s[i] === '`') i++; continue; } if (depth === 0) return i; }
    i++;
  }
  return -1;
}
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
const normBody = s => stripComments(s).replace(/\s+/g, ' ').replace(/ ?([{}();,:=<>+\-*/&|?!\[\]]) ?/g, '$1').trim();
const FN_RE = /(?:^|\n)[ \t]*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(|(?:^|\n)[ \t]*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b[^(]*\(|\([^)]*\)\s*=>\s*\{|[A-Za-z_$][\w$]*\s*=>\s*\{)/g;
const fns = [];
for (const f of files) {
  if (!/\.(m|c)?js$/.test(f.rel)) continue;
  const s = f.text;
  FN_RE.lastIndex = 0;
  let m;
  while ((m = FN_RE.exec(s))) {
    const name = m[1] || m[2];
    const open = s.indexOf('{', m.index + m[0].length - 1 - (m[0].endsWith('{') ? 0 : 0));
    if (open < 0) continue;
    // 매개변수 괄호를 지나 본문 { 를 찾아요
    let b = open;
    if (!m[0].endsWith('{')) { let p = 1, k = m.index + m[0].length; while (k < s.length && p) { if (s[k] === '(') p++; else if (s[k] === ')') p--; k++; } b = s.indexOf('{', k); }
    if (b < 0) continue;
    const end = matchBrace(s, b);
    if (end < 0) continue;
    const body = s.slice(b, end + 1);
    const nb = normBody(s.slice(m.index, b) .replace(/^[\s\S]*?(function|const|let|var)/, '$1') + body);
    if (nb.length < MIN_FN) continue;
    fns.push({ name, file: f.rel, line: s.slice(0, m.index).split('\n').length + (s[m.index] === '\n' ? 1 : 0), len: body.length, hash: sha(normBody(body)) });
  }
}
const fnGroups = new Map();
for (const fn of fns) (fnGroups.get(fn.hash) || fnGroups.set(fn.hash, []).get(fn.hash)).push(fn);
const exactFileSet = new Set(exactFiles.flatMap(g => g.paths.slice(1)));
const dupFns = [...fnGroups.values()]
  .filter(g => new Set(g.map(x => x.file)).size > 1)
  .map(g => ({ names: [...new Set(g.map(x => x.name))], len: g[0].len, copies: g.length, waste: g[0].len * (g.length - 1),
    inExactFileCopies: g.every(x => exactFileSet.has(x.file) || g.some(y => y !== x && exactFiles.some(e => e.paths.includes(x.file) && e.paths.includes(y.file)))),
    at: g.map(x => `${x.file}:${x.line}`) }))
  .sort((a, b) => b.waste - a.waste);
// 이름이 같고 본문이 다른 함수(같은 일을 조금씩 다르게) — 3곳 이상 · 애드온 2곳 이상
const byFnName = new Map();
for (const fn of fns) (byFnName.get(fn.name) || byFnName.set(fn.name, []).get(fn.name)).push(fn);
const sameNameFns = [...byFnName.entries()]
  .filter(([name, g]) => name.length >= 6 && new Set(g.map(x => area(x.file))).size >= 3 && new Set(g.map(x => x.hash)).size > 1)
  .map(([name, g]) => ({ name, copies: g.length, variants: new Set(g.map(x => x.hash)).size, areas: [...new Set(g.map(x => area(x.file)))], at: g.map(x => `${x.file}:${x.line}`) }))
  .sort((a, b) => b.areas.length - a.areas.length || b.copies - a.copies);

// 흔한 도우미의 정의 수(같은 일을 곳곳에서 따로) — 이름 · 짧은 화살표 정의 모두
const HELPERS = ['escapeHtml', 'escHtml', 'esc', 'escapeAttr', 'sleep', 'wait', 'delay', 'debounce', 'throttle', 'clamp', 'uid', 'makeId', 'copyText', 'toast', 'showToast', 'notify', 'saveSettings', 'save', 'getContext', 'ctx', 'isMobile', 'isPhone', 'nextFrame', 'raf', 'idle', 'onIdle', 'hash', 'formatBytes', 'fmtBytes', 'comma', 'plural'];
const helperDefs = [];
for (const f of files) {
  if (!/\.(m|c)?js$/.test(f.rel)) continue;
  for (const h of HELPERS) {
    const re = new RegExp(String.raw`(?:^|[\s;,{(])(?:function\s+${h}\s*\(|(?:const|let|var)\s+${h}\s*=\s*(?:async\s*)?(?:\(|[A-Za-z_$][\w$]*\s*=>|function))`, 'g');
    const n = (f.text.match(re) || []).length;
    if (n) helperDefs.push({ name: h, file: f.rel, n });
  }
}
const helperCensus = HELPERS.map(h => { const d = helperDefs.filter(x => x.name === h); return { name: h, defs: d.reduce((a, x) => a + x.n, 0), files: d.length, areas: [...new Set(d.map(x => area(x.file)))] }; })
  .filter(x => x.files >= 3).sort((a, b) => b.defs - a.defs);

// ── 3. CSS 선언 덩어리 ─────────────────────────────────
const cssBlocks = [];
for (const f of files) {
  if (!f.rel.endsWith('.css')) continue;
  const s = f.text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const re = /([^{}@;][^{}]*?)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(s))) {
    const decls = m[2].split(';').map(d => d.trim().replace(/\s+/g, ' ').replace(/\s*:\s*/, ':')).filter(Boolean);
    const body = decls.join(';');
    if (body.length < MIN_CSS || decls.length < 2) continue;
    cssBlocks.push({ file: f.rel, sel: m[1].trim().replace(/\s+/g, ' ').slice(0, 90), line: s.slice(0, m.index).split('\n').length, len: body.length, hash: sha(body) });
  }
}
const cssGroups = new Map();
for (const b of cssBlocks) (cssGroups.get(b.hash) || cssGroups.set(b.hash, []).get(b.hash)).push(b);
const dupCss = [...cssGroups.values()]
  .filter(g => g.length > 1)
  .map(g => ({ len: g[0].len, copies: g.length, files: new Set(g.map(b => b.file)).size, waste: g[0].len * (g.length - 1),
    inExactFileCopies: new Set(g.map(b => exactFiles.find(e => e.paths.includes(b.file))?.paths[0] || b.file)).size === 1 && g.length > 1 && exactFiles.some(e => e.paths.includes(g[0].file)),
    at: g.map(b => `${b.file}:${b.line} ${b.sel}`) }))
  .sort((a, b) => b.waste - a.waste);

// ── 출력 ───────────────────────────────────────────
const totals = {
  files: files.length,
  jsKB: +(files.filter(f => /\.(m|c)?js$/.test(f.rel)).reduce((a, f) => a + f.size, 0) / 1024).toFixed(1),
  cssKB: +(files.filter(f => f.rel.endsWith('.css')).reduce((a, f) => a + f.size, 0) / 1024).toFixed(1),
  exactFileGroups: exactFiles.length,
  exactFileWasteKB: +(exactFiles.reduce((a, g) => a + g.waste, 0) / 1024).toFixed(1),
  nearFileGroups: nearFiles.length,
  dupFunctionGroups: dupFns.length,
  dupFunctionWasteKB: +(dupFns.filter(g => !g.inExactFileCopies).reduce((a, g) => a + g.waste, 0) / 1024).toFixed(1),
  dupCssGroups: dupCss.length,
  dupCssWasteKB: +(dupCss.filter(g => !g.inExactFileCopies).reduce((a, g) => a + g.waste, 0) / 1024).toFixed(1),
};
if (JSON_OUT) {
  console.log(JSON.stringify({ totals, exactFiles, nearFiles, dupFns, sameNameFns, helperCensus, dupCss }, null, 1));
} else {
  const kb = n => (n / 1024).toFixed(1);
  const out = [];
  out.push(`# 중복 보고 (${path.basename(root)})`, '', '```', JSON.stringify(totals, null, 1), '```', '');
  out.push('## 1. 내용이 같은 파일', '', '| 이름 | 크기 KB | 벌 | 남는 KB | 경로 |', '|---|---:|---:|---:|---|');
  for (const g of exactFiles.slice(0, TOP)) out.push(`| ${g.name} | ${kb(g.size)} | ${g.copies} | ${kb(g.waste)} | ${g.paths.join('<br>')} |`);
  out.push('', '## 2. 이름이 같고 거의 같은 파일', '', '| 이름 | 벌 | 변형 | 최고 겹침 | 평균 겹침 | 크기(B) | 경로 |', '|---|---:|---:|---:|---:|---|---|');
  for (const g of nearFiles.slice(0, TOP)) out.push(`| ${g.name} | ${g.copies} | ${g.variants} | ${g.best} | ${g.avg} | ${g.sizes.join(' / ')} | ${g.paths.join('<br>')} |`);
  out.push('', '## 3. 본문이 같은 함수 (같은 파일 사본 안의 것은 뺌)', '', '| 이름 | 본문 B | 벌 | 위치 |', '|---|---:|---:|---|');
  for (const g of dupFns.filter(g => !g.inExactFileCopies).slice(0, TOP)) out.push(`| ${g.names.join(', ')} | ${g.len} | ${g.copies} | ${g.at.join('<br>')} |`);
  out.push('', '## 4. 이름이 같고 본문이 다른 함수 (세 영역 이상)', '', '| 이름 | 벌 | 변형 | 영역 | 위치 |', '|---|---:|---:|---|---|');
  for (const g of sameNameFns.slice(0, TOP)) out.push(`| ${g.name} | ${g.copies} | ${g.variants} | ${g.areas.join(', ')} | ${g.at.slice(0, 8).join('<br>')}${g.at.length > 8 ? '<br>…' : ''} |`);
  out.push('', '## 4-1. 흔한 도우미를 따로 정의한 수 (세 파일 이상)', '', '| 이름 | 정의 수 | 파일 수 | 영역 |', '|---|---:|---:|---|');
  for (const g of helperCensus) out.push(`| ${g.name} | ${g.defs} | ${g.files} | ${g.areas.join(', ')} |`);
  out.push('', '## 5. 같은 CSS 선언 덩어리 (같은 파일 사본 안의 것은 뺌)', '', '| 길이 | 벌 | 파일 수 | 위치 |', '|---:|---:|---:|---|');
  for (const g of dupCss.filter(g => !g.inExactFileCopies).slice(0, TOP)) out.push(`| ${g.len} | ${g.copies} | ${g.files} | ${g.at.slice(0, 6).join('<br>')}${g.at.length > 6 ? '<br>…' : ''} |`);
  console.log(out.join('\n'));
}
