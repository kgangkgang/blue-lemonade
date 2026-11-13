// 실리태번 한글화 스크립트: 원본(tools/scripts-src/korean.js — 사람이 고치는 판, 사전 TRANSLATIONS 그대로)에서 두 파일을 만든다.
//   ① src/scripts/plain/korean.js — 사전 없이 코드만(약 40KB). 실행기(src/scripts/runtime.js)가 테마 창에서 돌리는 모듈이에요(9.0.7 부터 iframe 없음).
//   ② src/ko-ui-text.gen.js — 사전. 시작 때 하던 정리(열쇠 NFKC 정리 · 블록 쪼개기 · <code> 태그 벗긴 사본 · 덧붙이는 열쇠 · 패턴 앞자리)를
//      여기서 원본 코드 그대로 돌린 결과예요(폰 4배 사전 준비 약 92 → 12ms). ko-ui 쪽 표라서 ko-ui.js 의 loadTextDictionary 로 받고,
//      스크립트는 처음 필요할 때(쉬는 틈 · 처음 누를 때) 받아요. 예전 내장본(bundled/korean.js 1,031KB · 코드 글 안의 JSON 글이라 따옴표가 두 겹)보다 작아요.
//   9.0.7 다듬기: tools/scripts-src/korean-prune.json(tools/ko-dict-prune.mjs 가 실리태번 1.19 파일과 맞대어 만든 지문 목록)의 열쇠 · 패턴은 뺀다 —
//      실리태번에 없는 옛 문구 · 안 깐 확장 문구, 그리고 실리태번 언어 표나 ko-ui 표가 이미 한국어로 그리는 자리에만 있는 글.
//   만든 뒤 사전을 다시 원본 정리 결과(다듬기 목록을 똑같이 적용)와 견준다(다르면 멈춤).
// node tools/build-korean-dict.mjs [--check]   (--check: 두 파일이 원본에서 만든 것과 같은지만 — CI)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeScript, readScript } from './build-plain-scripts.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'tools/scripts-src/korean.js');
const PRUNE = path.join(root, 'tools/scripts-src/korean-prune.json');
export const DICT_FILE = 'src/ko-ui-text.gen.js';   // 1.0.0 전 한 장짜리 — 이제는 만들지 않고 있으면 지워요
// 1.0.0 극한 최적화: 색인 + 조각 여섯(ko-dict-parts.mjs 의 목록으로 나눔). 색인은 열쇠 지문(fnv32) → 조각, 패턴 머리 낱말 → 조각, 머리 없는 패턴 그대로
export const PARTS_FILE = 'tools/scripts-src/korean-parts.json';
export const INDEX_FILE = 'src/ko-ui-text.index.gen.json';
export const PART_NAMES = ['boot', 'drawers', 'templates', 'js', 'html', 'rest'];
export const partFile = name => `src/ko-ui-text.${name}.gen.json`;
// 1.3.x 전 모듈 꼴(.gen.js) — 이제는 만들지 않고 있으면 지워요
export const OLD_MODULE_FILES = ['index', ...PART_NAMES].map(name => `src/ko-ui-text.${name}.gen.js`);
export function readParts(file = path.join(root, PARTS_FILE)) {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')).parts || {};
}
/** 한글화 스크립트(tools/scripts-src/korean.js fnv)와 같은 지문 */
export function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
/** 사전 → { index, parts } — exact 열쇠는 목록대로(없으면 rest), HTML 열쇠는 html, 패턴은 전부 색인에 */
export function splitDictionary(dictionary, partsMap = {}) {
    const parts = Object.fromEntries(PART_NAMES.map(name => [name, { exact: [], htmlExact: [], PATTERNS: [] }]));
    const index = { keys: {}, html: { html: [] }, heads: { js: [] }, headless: [] };
    for (const [key, korean] of dictionary.exact) {
        const name = PART_NAMES.includes(partsMap[keyHash(key)]) ? partsMap[keyHash(key)] : 'rest';
        parts[name].exact.push([key, korean]);
        (index.keys[name] ||= []).push(fnv(key));
    }
    for (const [key, korean] of dictionary.htmlExact) { parts.html.htmlExact.push([key, korean]); index.html.html.push(fnv(key)); }
    // 패턴(287 · 약 41KB)은 전부 색인에 — 머리 낱말만 두면 이미 한국어인 제목(「API 연결」 · 「TTS 재생」)의 첫 낱말이 머리와 겹쳐 조각을 헛되이 받았어요(ledger 11-02)
    index.headless.push(...dictionary.PATTERNS);
    // 지문 목록은 정렬 → 앞 값과의 차이를 36진수로 이어 적어요(64KB → 약 30KB). 한글화 스크립트 useIndex 가 되돌려요
    const pack = list => { let last = 0; return list.sort((a, b) => a - b).map(h => { const d = (h - last).toString(36); last = h; return d; }).join(','); };
    for (const name of Object.keys(index.keys)) index.keys[name] = pack(index.keys[name]);
    index.html.html = pack(index.html.html);
    return { index, parts };
}
// 1.3.x 메모리(최적화 C · 11-14): 색인 · 조각은 JSON 파일이에요(ko-ui.js 가 fetch 로 받아 JSON.parse). 예전 모듈 꼴은 JSON 을
//   String.raw`…` 태그 템플릿에 넣었는데, V8 은 태그 템플릿마다 템플릿 객체(가공 · 원문 두 벌)를 그 스크립트가 살아 있는 동안 붙잡아
//   사전 글이 힙에 두 벌씩 계속 남았어요(힙 기록: PC 장면 뒤 약 2.3MB · NativeContext template_weakmap). 보통 문자열로 바꾸면 이스케이프로
//   dist 가 3.4KB 늘어 상한을 넘었어요. JSON 파일은 읽고 나면 받은 글을 놓아주고, 묶음(dist)에 사전 조각이 들지 않아요.
//   JSON 에는 주석을 둘 수 없어 「만든 파일 · 손으로 고치지 않아요」 설명은 여기와 ko-ui.js 에 둬요.
/** 만들 파일 전부: { 상대 경로: 글 } */
export function dictionaryModules(dictionary, stats, partsMap = {}) {
    const { index, parts } = splitDictionary(dictionary, partsMap);
    const out = {};
    out[INDEX_FILE] = JSON.stringify(index) + '\n';
    for (const name of PART_NAMES) out[partFile(name)] = JSON.stringify(parts[name]) + '\n';
    return out;
}
const check = process.argv.includes('--check');

// tools/ko-dict-prune.mjs 와 같은 지문 (원본 정리 normalize 뒤 SHA-1 앞 12자리)
const normalizeKey = text => String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
export const keyHash = key => crypto.createHash('sha1').update(normalizeKey(key)).digest('hex').slice(0, 12);
export function readPrune(file = PRUNE) {
    if (!fs.existsSync(file)) return new Set();
    return new Set(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).dropped || {}));
}

export function buildKorean(source, dropped = new Set()) {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const from = lines.findIndex(l => l.startsWith('  const TRANSLATIONS = {'));
    const to = lines.findIndex(l => l.startsWith('  const HTML_INLINE = new Set('));
    if (from < 0 || to < from) throw new Error('dictionary section not found');
    const seg = lines.slice(from, to);
    const idx = re => { const i = seg.findIndex(l => re.test(l)); if (i < 0) throw new Error('anchor ' + re); return i; };
    const iTr = idx(/^  const TRANSLATIONS = \{/), iPat = idx(/^  let PATTERNS = \[/);
    if (!/^  const TRANSLATIONS = \{.*\};$/.test(seg[iTr]) || !/^  let PATTERNS = \[.*\];$/.test(seg[iPat])) throw new Error('TRANSLATIONS · PATTERNS must stay one line');
    // 다듬기: 두 리터럴 줄만 거른 판으로 바꿔 원본 정리 코드를 그대로 돌린다
    const keep = (value, kind) => kind === 'tr'
        ? Object.fromEntries(Object.entries(value).filter(([key]) => !dropped.has(keyHash(key))))
        : value.filter(item => !dropped.has(keyHash(item.re)));
    const pruned = seg.map((l, i) => i === iTr ? `  const TRANSLATIONS = __keep(${l.slice(23, -1)}, 'tr');` : i === iPat ? `  let PATTERNS = __keep(${l.slice(17, -1)}, 'pat');` : l);
    const built = new Function('__keep', pruned.join('\n') + '\nreturn { exact: [...exact], htmlExact: [...htmlExact], PATTERNS };')(keep);
    const iAdd1 = idx(/^  TRANSLATIONS\['Requests ending/), iAdd2 = idx(/^  TRANSLATIONS\['read ECONNABORTED'\]/), iUnshift = idx(/^  PATTERNS\.unshift\(/);
    const iExact = idx(/^  let exact = new Map\(\);$/), iExactEnd = iExact + 4;
    const iBlockLoop = idx(/^  for \(const \[key, korean\] of \[\.\.\.exact\]\) \{$/);
    const iBlockEnd = seg.findIndex((l, i) => i > iBlockLoop && l === '  }');
    const iHtml = idx(/^  let htmlExact = new Map\(\);$/);
    const iTagLoop = seg.findIndex((l, i) => i > iHtml && /^  for \(const \[key, korean\] of \[\.\.\.exact\]\) \{$/.test(l));
    const iTagEnd = seg.findIndex((l, i) => i > iTagLoop && l === '  }');
    if (seg[iExactEnd] !== '  }' || iBlockEnd < 0 || iTagLoop < 0 || iTagEnd < 0 || !/^  for \(const \[key, korean\] of exact\) if/.test(seg[iHtml + 1])) throw new Error('dictionary section shape changed — update tools/build-korean-dict.mjs');
    const replaced = new Map([
        [iTr, '  // 사전은 src/ko-ui-text.gen.js — tools/build-korean-dict.mjs 가 원본(tools/scripts-src/korean.js)의 TRANSLATIONS 를 미리 정리해 둔 표예요(normalize · 블록 쪼개기 · 태그 벗긴 사본까지 원본과 같은 결과). 처음 필요할 때 받아 useDictionary 로 끼워요'],
        [iPat, '  let PATTERNS = [];'],
        [iExact, '  let exact = new Map();'],
        [iHtml, '  let htmlExact = new Map();'],
    ]);
    const drop = new Set();
    const range = (a, b) => { for (let i = a; i <= b; i++) drop.add(i); };
    range(iAdd1, iAdd2); drop.add(iUnshift); range(iExact + 1, iExactEnd); range(iBlockLoop, iBlockEnd); drop.add(iHtml + 1); range(iTagLoop, iTagEnd);
    const next = seg.flatMap((l, i) => replaced.has(i) ? [replaced.get(i)] : drop.has(i) ? [] : [l]);
    // 사전 칸 사이의 다른 선언(normalize · SKIP · 상태)이 남았는지 · 빈 표로 시작하는지
    const tail = '\nreturn { n: normalize(" A  b "), s: typeof stopped, d: typeof dirty, sk: SKIP.length, e: exact.size, h: htmlExact.size, p: PATTERNS.length };';
    const got = new Function(next.join('\n') + tail)();
    const want = new Function(seg.join('\n') + tail)();
    for (const key of ['n', 's', 'd', 'sk']) if (JSON.stringify(got[key]) !== JSON.stringify(want[key])) throw new Error(`code section differs from the source: ${key}`);
    if (got.e || got.h || got.p) throw new Error('built script must start with an empty dictionary');
    const rest = lines.slice(to);
    const iIndex = rest.findIndex(l => l === '  indexPatterns();');
    if (iIndex < 0 || !rest.some(l => l.startsWith('  function useDictionary(data) {'))) throw new Error('indexPatterns() call / useDictionary not found — update tools/build-korean-dict.mjs');
    const code = [...lines.slice(0, from), ...next, ...rest.filter((_, i) => i !== iIndex)].join('\n').replace(/\n+$/, '');
    const dictionary = { exact: built.exact, htmlExact: built.htmlExact, PATTERNS: built.PATTERNS };
    return { code, dictionary, stats: { exact: built.exact.length, htmlExact: built.htmlExact.length, patterns: built.PATTERNS.length, dropped: dropped.size } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { code, dictionary, stats } = buildKorean(fs.readFileSync(SRC, 'utf8'), readPrune());
    const modules = dictionaryModules(dictionary, stats, readParts());
    const stale = Object.entries(modules).filter(([rel, text]) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : '') !== text).map(([rel]) => rel);
    const oldFile = path.join(root, DICT_FILE);
    const scriptStale = writeScript(root, 'korean', code, { check });
    const oldModules = OLD_MODULE_FILES.filter(rel => fs.existsSync(path.join(root, rel)));
    const dictStale = stale.length > 0 || fs.existsSync(oldFile) || oldModules.length > 0;
    if (check) {
        let same = !scriptStale && !dictStale;
        if (same) {   // 색인 · 조각 모듈을 실제로 읽어 합치면 같은 표가 나오는지
            const { index, parts } = splitDictionary(dictionary, readParts());
            const read = async rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
            same = JSON.stringify(await read(INDEX_FILE)) === JSON.stringify(index) && readScript(root, 'korean') === code;
            for (const name of PART_NAMES) if (same) same = JSON.stringify(await read(partFile(name))) === JSON.stringify(parts[name]);
        }
        if (!same) { console.log(`[다름] src/scripts/plain/korean.js · ${DICT_FILE} 가 tools/scripts-src/korean.js 에서 만든 것과 달라요 — node tools/build-korean-dict.mjs`); process.exitCode = 1; }
        else console.log(`[같음] 한글화 모듈 · 사전 = 원본에서 만든 것 (열쇠 ${stats.exact} · HTML 열쇠 ${stats.htmlExact} · 패턴 ${stats.patterns}, 다듬기 지문 ${stats.dropped})`);
    } else {
        for (const rel of stale) fs.writeFileSync(path.join(root, rel), modules[rel]);
        if (fs.existsSync(oldFile)) fs.rmSync(oldFile);
        for (const rel of oldModules) fs.rmSync(path.join(root, rel));   // 모듈 꼴(.gen.js) → JSON 으로 옮긴 뒤 남은 옛 생성물(git 이 기억해요)
        console.log(`한글화 모듈 · 사전을 만들었어요 (열쇠 ${stats.exact} · HTML 열쇠 ${stats.htmlExact} · 패턴 ${stats.patterns}, 다듬기 지문 ${stats.dropped}, ${scriptStale || dictStale ? '바뀜' : '그대로'})`);
    }
}
