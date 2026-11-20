// 1.9.1 점자 빈칸(U+2800) 다시 못 생기게 — 채팅 글을 다루는 소스에 「맨 `\s` · `trim()` · `split(/\s+/)`」 줄이 새로 생기면 알려요.
//   자바스크립트 `\s` · `trim()` 은 U+2800 을 빈칸으로 안 봐요. 솔라 프리셋 답은 띄어쓰기를 전부 이 글자로 써서, 글 견줌 · 열쇠 · 판정에
//   맨 `\s` 를 쓰면 같은 버그가 또 나요(1.8.6 칩 간격 · 속마음 두 칸 두 번 · 1.8.7 금지어 · 지난 속마음 번역 · 번역 점검 · 1.9.1 전수 2).
//   있는 줄은 기준(blank-lint-baseline.json — 줄 글의 지문)으로 두고 **새 줄만** 막아요(오탐이 많은 검사라 래칫 꼴).
//   새 줄이 걸리면: ① 공용 src/blank-fold.js(foldBlank · trimBlank · squashBlank · trimEdge · SP · HSP · blankKey)를 쓰거나
//   ② 채팅 글이 닿지 않는 줄(설정 입력 · CSS · 내 코드가 만든 글)이면 줄 끝에 `// blank-ok` 를 달아요.
//   node tools/tests/blank-lint.mjs <테마 루트>            검사(새 줄이 있으면 종료 1)
//   node tools/tests/blank-lint.mjs <테마 루트> --update   기준 다시 쓰기(사람이 새 줄을 본 뒤에만)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(process.argv[2] || '.');
const update = process.argv.includes('--update');
const BASE = path.join(root, 'tools/tests/blank-lint-baseline.json');

// 채팅 글이 흘러드는 파일: 원문 · 확장 자료를 읽거나, 채팅 글을 다루는 갈래
const CHAT_READ = /\.mes\b|\bswipes\b|display_text|chatMetadata|chat_metadata|statussim|getContext\(\)\.chat|\.chat\[/;
const CHAT_DIRS = ['src/addons/translator/', 'src/addons/tts/', 'src/addons/rewrite/', 'src/addons/bookmarks/', 'src/addons/assets/'];
const CHAT_FILES = /^src\/(?:mb-[\w-]+|ext-bridge[\w-]*|dialogue-[\w-]+|people|name-[\w-]+|weather[\w-]*|scene-music[\w-]*|dem-expressive|natural-slash|word-tools[\w-]*|gloss-fold|wordmask)\.js$/;
const SKIP = /(?:\.gen\.js|\/build-info\.js|\/scripts\/plain\/|\/vendor\/|\.min\.js)$/;
// 걸리는 줄: 맨 \s (정규식 · 문자열 안) · trim 들 · split(' ')
const RISK = /\\s|\.trim(?:Start|End)?\(\)|\.split\(' '\)/;
// 이미 점자 빈칸을 보는 줄 · 손으로 풀어 준 줄
const OK = /\\u2800|⠀|foldBlank|trimBlank|squashBlank|trimEdge|isSpace|blankKey|matchBlankStyle|\$\{SP\}|\$\{HSP\}|\bBLANK\b|blank-ok/;

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : d.name.endsWith('.js') ? [p] : [];
});
const rel = p => path.relative(root, p).split(path.sep).join('/');
const finger = line => crypto.createHash('sha1').update(line.trim()).digest('hex').slice(0, 10);

const found = {};
for (const file of walk(path.join(root, 'src'))) {
    const r = rel(file);
    if (SKIP.test(r)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (!CHAT_DIRS.some(d => r.startsWith(d)) && !CHAT_FILES.test(r) && !CHAT_READ.test(text)) continue;
    const rows = [];
    text.split('\n').forEach((line, i) => {
        const t = line.trim();
        if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        if (t.length > 2000) return;   // 한 줄로 묶인 큰 자료 줄
        if (RISK.test(t) && !OK.test(t)) rows.push({ line: i + 1, f: finger(t), t });
    });
    if (rows.length) found[r] = rows;
}

if (update) {
    const out = Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)).map(([f, rows]) => [f, [...new Set(rows.map(x => x.f))].sort()]));
    fs.writeFileSync(BASE, JSON.stringify({ note: '점자 빈칸 래칫 기준 — tools/tests/blank-lint.mjs 맨 위 설명. 손으로 늘리지 말고 --update 로(새 줄을 본 뒤)', files: out }, null, 1) + '\n');
    console.log(`blank-lint: 기준을 다시 썼어요 — 파일 ${Object.keys(out).length} · 줄 ${Object.values(out).reduce((s, x) => s + x.length, 0)}`);
    process.exit(0);
}
let base = {};
try { base = JSON.parse(fs.readFileSync(BASE, 'utf8')).files || {}; } catch { console.log('blank-lint: 기준 파일이 없어요 — --update 로 먼저 만들어요'); process.exit(2); }
const fresh = [];
for (const [f, rows] of Object.entries(found)) {
    const known = new Set(base[f] || []);
    for (const x of rows) if (!known.has(x.f)) fresh.push(`${f}:${x.line}  ${x.t.slice(0, 160)}`);
}
const total = Object.values(found).reduce((s, x) => s + x.length, 0);
if (fresh.length) {
    console.log(`blank-lint: 채팅 글을 다루는 소스에 맨 \\s · trim() 줄이 새로 ${fresh.length}개 — 점자 빈칸(U+2800)을 빈칸으로 안 봐요`);
    for (const l of fresh.slice(0, 60)) console.log('  ' + l);
    console.log('  → src/blank-fold.js 공용 함수(foldBlank · trimBlank · squashBlank · trimEdge · SP · HSP · blankKey)를 쓰거나, 채팅 글이 안 닿는 줄이면 줄 끝에 // blank-ok');
    process.exit(1);
}
console.log(`blank-lint: 새 줄 0 (기준 안 줄 ${total} · 파일 ${Object.keys(found).length})`);
