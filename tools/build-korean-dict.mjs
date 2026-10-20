// 7.3.0 실리태번 한글화 스크립트: 원본(tools/scripts-src/korean.js — 사람이 고치는 판, 사전 TRANSLATIONS 그대로)에서
//   내장본(src/scripts/bundled/korean.js)을 만든다. 시작 때 하던 사전 정리(열쇠 NFKC 정리 · 블록 쪼개기 · <code> 태그 벗긴 사본 ·
//   덧붙이는 열쇠 · 패턴 앞자리)를 여기서 원본 코드 그대로 돌려 결과 Map 을 JSON 으로 싣는다 → 폰 4배에서 사전 준비 약 92 → 12ms.
//   만든 뒤 내장본의 사전 조각을 다시 돌려 원본이 만든 exact · htmlExact · PATTERNS 와 한 글자도 다르지 않은지 견준다(다르면 멈춤).
//   그다음 tools/build-plain-scripts.mjs 가 plain 사본을 만든다.
// node tools/build-korean-dict.mjs [--check]   (--check: 내장본이 원본에서 만든 것과 같은지만 — CI)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'tools/scripts-src/korean.js');
const OUT = path.join(root, 'src/scripts/bundled/korean.js');
const HEAD = '// Bundled default; edited copies are stored separately.\nexport default ';
const check = process.argv.includes('--check');

export function buildKorean(source) {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const from = lines.findIndex(l => l.startsWith('  const TRANSLATIONS = {'));
    const to = lines.findIndex(l => l.startsWith('  const HTML_INLINE = new Set('));
    if (from < 0 || to < from) throw new Error('dictionary section not found');
    const seg = lines.slice(from, to);
    // 원본 조각을 그대로 돌린 결과 (기준)
    const built = new Function(seg.join('\n') + '\nreturn { exact: [...exact], htmlExact: [...htmlExact], PATTERNS };')();
    const lit = v => `JSON.parse(${JSON.stringify(JSON.stringify(v))})`;
    const idx = re => { const i = seg.findIndex(l => re.test(l)); if (i < 0) throw new Error('anchor ' + re); return i; };
    const drop = new Set();
    const range = (a, b) => { for (let i = a; i <= b; i++) drop.add(i); };
    const iTr = idx(/^  const TRANSLATIONS = \{/), iPat = idx(/^  const PATTERNS = \[/);
    const iAdd1 = idx(/^  TRANSLATIONS\['Requests ending/), iAdd2 = idx(/^  TRANSLATIONS\['read ECONNABORTED'\]/), iUnshift = idx(/^  PATTERNS\.unshift\(/);
    const iExact = idx(/^  const exact = new Map\(\);$/), iExactEnd = iExact + 4;
    const iBlockLoop = idx(/^  for \(const \[key, korean\] of \[\.\.\.exact\]\) \{$/);
    const iBlockEnd = seg.findIndex((l, i) => i > iBlockLoop && l === '  }');
    const iHtml = idx(/^  const htmlExact = new Map\(\);$/);
    const iTagLoop = seg.findIndex((l, i) => i > iHtml && /^  for \(const \[key, korean\] of \[\.\.\.exact\]\) \{$/.test(l));
    const iTagEnd = seg.findIndex((l, i) => i > iTagLoop && l === '  }');
    if (seg[iExactEnd] !== '  }' || iBlockEnd < 0 || iTagLoop < 0 || iTagEnd < 0 || !/^  for \(const \[key, korean\] of exact\) if/.test(seg[iHtml + 1])) throw new Error('dictionary section shape changed — update tools/build-korean-dict.mjs');
    const replaced = new Map([
        [iTr, '  // 사전은 tools/build-korean-dict.mjs 가 원본(tools/scripts-src/korean.js)의 TRANSLATIONS 로 미리 정리해 둔 Map (normalize · 블록 쪼개기 · 태그 벗긴 사본까지 원본과 같은 결과)'],
        [iPat, `  const PATTERNS = ${lit(built.PATTERNS)};`],
        [iExact, `  const exact = new Map(${lit(built.exact)});`],
        [iHtml, `  const htmlExact = new Map(${lit(built.htmlExact)});`],
    ]);
    if (!/^  const TRANSLATIONS = \{.*\};$/.test(seg[iTr])) throw new Error('TRANSLATIONS must stay one line');   // 한 줄 — 그 줄을 설명 한 줄로 바꾼다 (시작 때 안 씀)
    range(iAdd1, iAdd2); drop.add(iUnshift); range(iExact + 1, iExactEnd); range(iBlockLoop, iBlockEnd); drop.add(iHtml + 1); range(iTagLoop, iTagEnd);
    const next = seg.flatMap((l, i) => replaced.has(i) ? [replaced.get(i)] : drop.has(i) ? [] : [l]);
    // 같은지: 새 조각을 돌려 원본 결과와 · 그 사이 다른 선언(normalize · SKIP · 상태)이 남았는지
    const tail = '\nreturn { exact: [...exact], htmlExact: [...htmlExact], PATTERNS, n: normalize(" A  b "), s: typeof stopped, d: typeof dirty, sk: SKIP.length };';
    const got = new Function(next.join('\n') + tail)();
    const want = new Function(seg.join('\n') + tail)();
    for (const key of ['exact', 'htmlExact', 'PATTERNS', 'n', 's', 'd', 'sk']) {
        if (JSON.stringify(got[key]) !== JSON.stringify(want[key])) throw new Error(`precomputed dictionary differs from the source: ${key}`);
    }
    const code = [...lines.slice(0, from), ...next, ...lines.slice(to)].join('\r\n');   // 내장본은 예전처럼 CRLF
    new Function('BlueLemonade', code);
    return { code, stats: { exact: built.exact.length, htmlExact: built.htmlExact.length, patterns: built.PATTERNS.length } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { code, stats } = buildKorean(fs.readFileSync(SRC, 'utf8'));
    const text = HEAD + JSON.stringify(code) + ';\n';
    const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (check) {
        const bundled = old ? String((await import(pathToFileURL(OUT).href + '?t=' + Date.now())).default) : '';
        if (old !== text || bundled !== code) { console.log('[다름] src/scripts/bundled/korean.js 가 tools/scripts-src/korean.js 에서 만든 것과 달라요 — node tools/build-korean-dict.mjs'); process.exitCode = 1; }
        else console.log(`[같음] 한글화 내장본 = 원본에서 만든 사전 (열쇠 ${stats.exact} · HTML 열쇠 ${stats.htmlExact} · 패턴 ${stats.patterns}, 원본 정리 결과와 같음)`);
    } else {
        fs.writeFileSync(OUT, text);
        console.log(`한글화 내장본을 만들었어요 (열쇠 ${stats.exact} · HTML 열쇠 ${stats.htmlExact} · 패턴 ${stats.patterns}, ${old === text ? '그대로' : '바뀜'})`);
    }
}
