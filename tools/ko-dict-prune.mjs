// 9.0.7 한글화 글자 사전(tools/scripts-src/korean.js 의 TRANSLATIONS · PATTERNS) 다듬기 목록을 만들어요.
//   실리태번 화면에 실제로 나올 수 있는 영어만 남기려고, 실리태번 폴더의 html · js 문자열을 **읽기만** 해서 모아 사전 열쇠와 맞대 봐요.
//   - 모으는 곳: <st>/public 아래 html · js · mjs · json (locales · img · webfonts · sounds 빼고) + <st>/data/<user>/extensions/* (이 테마 자신은 빼요)
//   - 버리는 것 ① absent: 위 어디에도 없는 글 — 옛 실리태번 판에서 사라진 문구 · 안 깐 확장(다른 테마 등)의 문구.
//       단 서버 · API 가 돌려주는 오류 문구(파일에는 없고 알림으로만 뜸)와 한자 · 가나가 든 열쇠(중계 서버 · 중국어 확장 알림)는 남겨요.
//   - 버리는 것 ② i18n: 테마 ko-ui 표(src/ko-ui-data.js 의 ADD)로 이미 한국어로 그리는 자리에만 있는 글 — 실리태번 ko-kr.json · FIX 는 브라우저 언어 'ko' 에서 안 쓰여 기준에서 빼요 —
//       data-i18n 속성 값이거나, 번역되는 data-i18n 요소의 글이에요. 화면에는 한국어로 나오니 글자 사전이 볼 일이 없어요(ko-ui 로 합침).
//   결과는 tools/scripts-src/korean-prune.json — 열쇠 글 대신 지문(정리한 열쇠의 SHA-1 앞 12자리)만 적어요. tools/build-korean-dict.mjs 가 읽어 사전에서 빼요.
//   실리태번을 올리면(지금 1.19.0) 다시 돌려요. 버린 것이 화면에 보이면 korean.js 원본은 그대로 있으니 목록에서 지문을 지우면 돌아와요.
// node tools/ko-dict-prune.mjs --st <실리태번 폴더> [--user default-user] [--check] [--list]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PRUNE_FILE = 'tools/scripts-src/korean-prune.json';
export const SOURCE_FILE = 'tools/scripts-src/korean.js';
export const normalize = text => String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
export const keyHash = key => crypto.createHash('sha1').update(normalize(key)).digest('hex').slice(0, 12);
// 서버 · API · 중계가 돌려주는 글(파일에 없고 알림으로 뜸)로 보이는 것 — 남겨요
const SERVER_TEXT = /error|fail|invalid|unavailable|quota|limit|exceed|denied|unauthori|forbidden|timeout|timed out|too many|exhausted|overloaded|not found|status|bad request|try again|\b[45]\d\d\b|insufficient|balance|token|\bkey\b|model|request|response|server|rate|safety|blocked|censor|content|prompt|api\b|connect|network|abort|refused|reset|busy|capacity|credit|billing|permission/i;
const CJK = /[぀-ヿ㐀-鿿豈-﫿]/;
const BLOCK = /<\/?(?:div|p|ul|ol|li|br|pre|h[1-6]|table|tr|td|th|tbody|thead)\b[^>]*>/gi;
const TAG = /<\/?[a-z][^>]*>/gi;

/** 원본에서 사전 두 개를 꺼내요(한 줄짜리 리터럴) */
export function readSource(text) {
    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const literal = (prefix) => {
        const line = lines.find(l => l.startsWith(prefix));
        if (!line) throw Error(`원본에서 ${prefix.trim()} 줄을 못 찾았어요`);
        return JSON.parse(line.slice(prefix.length).replace(/;\s*$/, ''));
    };
    return { translations: literal('  const TRANSLATIONS = '), patterns: literal('  let PATTERNS = ') };
}

const decode = s => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\[nrt]/g, ' ').replace(/\\(["'`\\])/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
function listFiles(dir, skip, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { if (!skip.has(entry.name)) listFiles(full, skip, out); }
        else if (/\.(?:html|js|mjs|json)$/.test(entry.name)) out.push(full);
    }
    return out;
}
/** 실리태번 폴더에서 글 모음(읽기만) */
export function readCorpus(st, user = 'default-user') {
    const self = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).display_name;
    const files = listFiles(path.join(st, 'public'), new Set(['locales', 'img', 'webfonts', 'sounds', 'node_modules']));
    let extensions = 0;
    const extRoot = path.join(st, 'data', user, 'extensions');
    for (const name of fs.existsSync(extRoot) ? fs.readdirSync(extRoot) : []) {
        const dir = path.join(extRoot, name);
        if (!fs.statSync(dir).isDirectory()) continue;
        try { if (JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).display_name === self) continue; } catch { /* manifest 없는 폴더도 모아요 */ }
        extensions++;
        listFiles(dir, new Set(['node_modules', '.git']), files);
    }
    const raw = files.map(file => fs.readFileSync(file, 'utf8'));
    const text = raw.map(t => normalize(decode(t))).join('\n');
    const bare = text.replace(TAG, ' ').replace(/\s+/g, ' ');
    // data-i18n 속성 값 · 번역 키가 붙은 요소의 글
    const attrs = [], elements = [];
    for (const t of raw) {
        for (const m of t.matchAll(/data-i18n=(["'])(.*?)\1/g)) attrs.push(normalize(m[2]));
        for (const m of t.matchAll(/data-i18n=(["'])([^"'[]+?)\1[^>]*>([^<]*)</g)) elements.push([normalize(m[2]), normalize(decode(m[3]))]);
    }
    let version = '';
    try { version = JSON.parse(fs.readFileSync(path.join(st, 'package.json'), 'utf8')).version || ''; } catch { /* 판을 몰라도 돼요 */ }
    let locale = {};
    try { locale = JSON.parse(fs.readFileSync(path.join(st, 'public/locales/ko-kr.json'), 'utf8')); } catch { /* 표가 없으면 ② 는 건너뛰어요 */ }
    return { files: files.length, extensions, text, bare, attrs: attrs.join('\n'), elements, version, locale };
}
const count = (hay, needle) => { let n = 0; for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) n++; return n; };

/** 다듬기: 돌려주는 값 { dropped: {지문: 까닭}, counts } */
export function prune({ translations, patterns }, corpus, koUi) {
    // 10-31 UI 점검: 실리태번 언어 표(ko-kr.json)와 FIX 는 빼요 — 브라우저 언어가 'ko' 인 기기는 실리태번이 ko-kr.json 을 받지 않아 표가 비고,
    //   ko-ui 도 그때는 ADD 만 넣어요(FIX 는 고칠 표가 없어 건너뜀). 그 둘에만 기대던 글을 빼면 'ko' 화면에 영어가 남았어요(AI 응답 설정 「Unlocked Context Size」 등).
    const translatedKeys = new Set(Object.keys(koUi.ADD || {}).map(normalize));
    const dropped = {}, counts = { keys: 0, kept: 0, absent: 0, i18n: 0, patterns: patterns.length, patternsDropped: 0 };
    for (const source of Object.keys(translations)) {
        counts.keys++;
        const key = normalize(source);
        let seen = corpus.text.includes(key) || corpus.bare.includes(normalize(key.replace(TAG, ' ')));
        if (!seen && BLOCK.test(key)) seen = key.split(BLOCK).map(normalize).filter(Boolean).some(part => corpus.text.includes(part));
        BLOCK.lastIndex = 0;
        if (!seen) {
            if (CJK.test(key) || SERVER_TEXT.test(key)) { counts.kept++; continue; }
            dropped[keyHash(key)] = 'absent'; counts.absent++; continue;
        }
        if (translatedKeys.has(key)) {
            const total = count(corpus.text, key);
            const covered = count(corpus.attrs, key) + corpus.elements.filter(([id, text]) => text === key && translatedKeys.has(id)).length;
            if (total > 0 && covered >= total) { dropped[keyHash(key)] = 'i18n'; counts.i18n++; continue; }
        }
        counts.kept++;
    }
    for (const item of patterns) {
        const parts = item.re.replace(/^\^|\$$/g, '').split(/\(\?:[^)]*\)|\([^)]*\)/).map(part => normalize(part.replace(/\\(.)/g, '$1'))).filter(part => part.length > 2);
        if (!parts.length || parts.every(part => corpus.text.includes(part))) continue;
        if (CJK.test(item.re) || SERVER_TEXT.test(item.re)) continue;
        dropped[keyHash(item.re)] = 'pattern'; counts.patternsDropped++;
    }
    return { dropped, counts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const arg = name => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : undefined; };
    const st = arg('--st') || process.env.BL_ST_ROOT;
    if (!st) { console.error('실리태번 폴더를 --st 로 알려 주세요 (읽기만 해요)'); process.exit(2); }
    const corpus = readCorpus(path.resolve(st), arg('--user') || 'default-user');
    const koUi = await import(pathToFileURL(path.join(root, 'src/ko-ui-data.js')).href);
    const source = readSource(fs.readFileSync(path.join(root, SOURCE_FILE), 'utf8'));
    const { dropped, counts } = prune(source, corpus, koUi);
    const sorted = Object.fromEntries(Object.entries(dropped).sort(([a], [b]) => a.localeCompare(b)));
    const out = JSON.stringify({ about: '한글화 글자 사전에서 뺄 열쇠의 지문(tools/ko-dict-prune.mjs 가 만들어요 — 손으로 지우면 그 열쇠가 돌아와요)', st: corpus.version, counts, dropped: sorted }, null, 1) + '\n';
    const file = path.join(root, PRUNE_FILE), old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    console.log(`실리태번 ${corpus.version || '?'} 파일 ${corpus.files}개(확장 ${corpus.extensions}개) · 열쇠 ${counts.keys} 중 남김 ${counts.kept} · 없음 ${counts.absent} · i18n 이 그림 ${counts.i18n} · 패턴 ${counts.patterns} 중 뺌 ${counts.patternsDropped}`);
    if (process.argv.includes('--list')) for (const key of Object.keys(source.translations)) { const why = dropped[keyHash(key)]; if (why) console.log(`${why}\t${normalize(key).slice(0, 120)}`); }
    if (process.argv.includes('--check')) { if (old !== out) { console.log(`[다름] ${PRUNE_FILE} 를 다시 만들어야 해요`); process.exitCode = 1; } else console.log('[같음] 다듬기 목록이 지금 실리태번과 맞아요'); }
    else { fs.writeFileSync(file, out); console.log(`${PRUNE_FILE} ${old === out ? '그대로' : '바뀜'}`); }
}
