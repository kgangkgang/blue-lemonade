#!/usr/bin/env node
// 1.0.0 극한 최적화: 실제로 브라우저가 받는 JS 를 dist/ 로 묶고 줄여요(src/ 는 사람이 고치는 원본 · 시험이 읽는 그대로).
//   - manifest.json 의 js 가 dist/index.js 예요. src 를 고쳤으면 CSS · 사전 생성처럼 이 도구를 돌려요: node tools/build-bundle.mjs (tools/ 에서 npm ci 한 번)
//   - dist/ 는 src/ 와 깊이가 같아요(실리태번 모듈 상대 경로가 그대로) · import.meta.url 은 모듈마다 원래 자리 주소로 바꿔 CSS · 그림 · 소리 · 워커 주소가 전과 같아요
//   - 묶으면 안 되는 것: vendor(웹팩 조각 · 워커용) · build-info.js(dist 해시를 담는 표라 밖에 둬요)
//   - 주소로 받는 모듈(재시도 · 내장 스크립트)은 ADAPT 표에서 묶음 조각 주소로 바꿔요. 표의 글이 src 에서 사라지면 빌드가 멈춰요(조용히 원본 두 벌이 되지 않게)
//   node tools/build-bundle.mjs            빌드(dist/ 다시 씀)
//   node tools/build-bundle.mjs --check    src 와 dist 지문이 맞나만 봐요(묶음 도구 없이도 돌아요 — 시험 bundle-fresh.mjs 가 같은 함수를 써요)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');
const posix = p => p.split(path.sep).join('/');
const rel = abs => posix(path.relative(ROOT, abs));
const STAMP = 'dist/bundle-stamp.json';

// ── 지문: 묶음에 들어가는 원본 전부(바뀌면 dist 가 낡은 것)
function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
        else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
}
export function sourceHash(root = ROOT) {
    const files = [path.join(root, 'index.js'), path.join(root, 'tools/build-bundle.mjs'), ...walk(path.join(root, 'src'))]
        .filter(f => !/[\\/]src[\\/]build-info\.js$/.test(f)).sort();
    const h = crypto.createHash('sha256');
    for (const f of files) { h.update(posix(path.relative(root, f))); h.update('\0'); h.update(fs.readFileSync(f)); h.update('\0'); }
    return h.digest('hex');
}
export function bundleFresh(root = ROOT) {
    const stampFile = path.join(root, STAMP);
    if (!fs.existsSync(stampFile)) return { ok: false, why: `${STAMP} 없음` };
    const stamp = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
    const now = sourceHash(root);
    if (stamp.source !== now) return { ok: false, why: `src 가 dist 보다 새로워요 — node tools/build-bundle.mjs (${stamp.source.slice(0, 12)} ≠ ${now.slice(0, 12)})` };
    const missing = stamp.files.filter(f => !fs.existsSync(path.join(root, f)));
    if (missing.length) return { ok: false, why: `dist 파일이 없어요: ${missing.slice(0, 3).join(' · ')}` };
    return { ok: true, why: '' };
}

// ── src 글 바꾸기 표: 비정적 import 를 묶음이 알아보는 꼴로. 파일 → [찾는 글, 바꿀 글, 횟수]
//   src 를 그대로 두는 까닭: 시험 수백 개가 src 글을 읽어요. 묶음에서만 필요한 꼴이에요
const FEATURE_LOAD = /\bload\('(\w+)',\s*'(\.\/[^']+)'\)/g;
const ADAPT = {
    'src/features.js': code => {
        const n = (code.match(FEATURE_LOAD) || []).length;
        if (n < 30) throw new Error(`features.js load(이름, 주소) 꼴이 ${n}곳뿐이에요 — 표를 다시 봐요`);
        return must(code.replace(FEATURE_LOAD, "load('$1',()=>import('$2'))"), 'frameReady.then(() => import(url))', 'frameReady.then(() => url())');
    },
    'src/addons/perf/start.js': code => must(code, 'await import(`./${file}.js`);', "await ({loadtimer:()=>import('./loadtimer.js'),perfassist:()=>import('./perfassist.js'),'watchdog-main':()=>import('./watchdog-main.js'),savededupe:()=>import('./savededupe.js'),requestlog:()=>import('./requestlog.js')})[file]();"),
    // 한글화 패널은 실리태번 모듈 주소를 글자로 이어 받아요 — dist 깊이(src 와 같음)로 고정해요
    'src/addons/prompt/index.js': code => [
        ["const base = bundled ? '../../../../../../../' : tp ? '../../../../' : '../../../';", "const base = '../../../../../';"],
        ["const base2 = bundled ? '../../../../../../' : tp ? '../../../' : '../../';", "const base2 = '../../../../';"],
        ["const base=bundled?'../../../../../../../':'../../../../';", "const base='../../../../../';"],
        ["const base2=bundled?'../../../../../../':'../../../';", "const base2='../../../../';"],
    ].reduce((text, [find, to]) => must(text, find, to), code),
    'src/chat-appearance.js': code => must(code, "new URL('./chat-appearance.css', import.meta.url)", "new URL('./chat-appearance.gen.css', import.meta.url)"),
    'src/addons.js': code => must(code, "await import(id==='order'?'./addons/order/panel.js':'./addons/perf/hub.js')", "await(id==='order'?import('./addons/order/panel.js'):import('./addons/perf/hub.js'))"),
    // 1.1.8 늦게 받는 창 CSS 글(const STYLE = `…`)의 주석 · 들여쓰기 · 띄어쓰기를 묶음에서만 걷어요(원본은 읽기 쉬운 그대로 · 모양은 같아요) — dist 여유를 되찾아요(로그 복사 시트 약 5.4KB)
    'src/log-copy-sheet.js': code => minStyle(code, 'STYLE'),
    'src/mart-import-ui.js': code => minStyle(code, 'STYLE'),
    'src/log-copy-tune-ui.js': code => minStyle(code, 'FINE_STYLE'),
    'src/log-copy-handoff.js': code => minStyle(code, 'STYLE'),   // 1.2.0 붙이는 길 · 다시 받기 창
    'src/mart-retake.js': code => minStyle(code, 'STYLE'),
};
/** const <name> = `css`; 한 곳의 CSS 를 줄여요 — 글 끼우기(${…}) · 거꾸로 빗금이 든 글은 건드리지 않고 멈춰요(조용히 깨지지 않게).
 *  따옴표 글(url("data:image/svg+xml,…") 같은 것)은 떼어 두었다가 그대로 되돌려요 — 그 안의 띄어쓰기 · 쉼표 · 「>」 는 뜻이 있어요 */
export function minStyle(code, name) {
    const head = `const ${name} = \``, at = code.indexOf(head), end = at < 0 ? -1 : code.indexOf('`;', at + head.length);
    if (at < 0 || end < 0) throw new Error(`묶음 표의 CSS 글을 src 에서 못 찾았어요: ${name}`);
    const css = code.slice(at + head.length, end);
    if (css.includes('${') || css.includes('\\') || css.includes('`') || /[\uE000\uE001]/.test(css)) throw new Error(`${name} 에 글 끼우기 · 거꾸로 빗금이 있어 줄이지 않아요`);
    const kept = [];
    const masked = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"\n]*"|'[^'\n]*'/g, (s) => { kept.push(s); return `\uE000${kept.length - 1}\uE001`; });
    const small = masked.replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').trim().replace(/\uE000(\d+)\uE001/g, (all, i) => kept[i]);
    return code.slice(0, at + head.length) + small + code.slice(end);
}
// 1.2.1 dist 되줄이기: 설정 · 창 HTML 글(템플릿 · 따옴표 글)에서 「태그 > 줄바꿈 + 들여쓰기 < 태그」의 들여쓰기만 묶음에서 걷어요(원본은 읽기 쉬운 그대로).
//   줄바꿈 하나는 남겨요 — 보통 글(white-space: normal · nowrap · pre-line)은 줄바꿈 + 공백 묶음을 공백 하나로 모으니 화면이 같아요.
//   공백이 그대로 보이는 곳(pre · textarea · code · samp · white-space:pre* · 실리태번 .multiline 등) 안쪽과, 앞뒤가 HTML 태그가 아닌 곳(프롬프트 XML 같은 글)은 건드리지 않아요.
export const HTML_GAP_FILES = [
    'src/addons/rewrite/settings-html.js', 'src/addons/assets/panel.js', 'src/addons/perf/panel.js', 'src/panel.js', 'src/addons/prompt/index.js',
    'src/addons/bookmarks/panel.js', 'src/addons/bookmarks/settings-view.js', 'src/addons/direction/index.js', 'src/addons/tts/guide.js',
    'src/addons/customstyle/index.js', 'src/addons/rewrite/guide.js', 'src/addons/models/panel.js', 'src/addons/regexlink/regexperf.js',
];
const HTML_TAG = new Set(('a abbr article aside b blockquote br datalist button caption col colgroup dd del details div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr i img input '
    + 'ins kbd label legend li main mark meter nav ol optgroup option output p picture progress q s section select small source span strong sub summary sup table tbody td '
    + 'tfoot th thead time tr u ul svg path g circle rect line polyline polygon defs use symbol ellipse').split(' '));
const KEEP_TAG = /^(pre|textarea|code|samp|script|style)$/i;   // 안쪽 공백이 그대로 보이거나 HTML 이 아닌 곳
const KEEP_ATTR = /white-space\s*:\s*(?:pre|break-spaces)|\bclass\s*=\s*\\?["'][^"']*\b(?:multiline|pt-original-text|pt-translated-text|bl-note-body|info-block)\b/i;
const GAP = /(>)(\r?\n|\\n)([ \t]+)(<)/g;
/** 위 표의 파일 하나: 걷은 글과 걷은 바이트 · 남긴 자리 수를 돌려줘요 */
export function htmlGapStats(code) {
    let saved = 0, kept = 0;
    const out = code.replace(GAP, (all, gt, nl, pad, lt, at) => {
        if (!htmlGapOk(code, at, at + all.length - 1)) { kept++; return all; }
        saved += pad.length;
        return gt + nl + lt;
    });
    return { code: out, saved, kept };
}
export function minHtmlGaps(code, name = '') {
    const r = htmlGapStats(code);
    if (!r.saved) throw new Error(`HTML 들여쓰기 걷기 표의 파일에 걷을 곳이 없어요 — 표를 다시 봐요: ${name}`);
    return r.code;
}
export function htmlGapOk(code, gt, lt) {
    // 앞 태그(… >)와 뒤 태그(< …) 둘 다 HTML 태그(또는 주석)여야 해요
    const open = code.lastIndexOf('<', gt);
    const prev = open < 0 ? '' : code.slice(open, gt + 1);
    const prevName = prev.startsWith('<!--') && prev.endsWith('-->') ? '!' : (/^<\/?([a-zA-Z][\w-]*)(?:\s[^<>`]*)?\/?>$/.exec(prev) || [])[1];
    const nextName = code.startsWith('<!--', lt) ? '!' : (/^<\/?([a-zA-Z][\w-]*)[\s>/]/.exec(code.slice(lt, lt + 40)) || [])[1];
    if (!prevName || !nextName || ![prevName, nextName].every(n => n === '!' || HTML_TAG.has(n.toLowerCase()))) return false;
    // 공백이 보이는 요소 안쪽이면 그대로 — 가장 가까운 여는 태그부터 이 자리까지 같은 이름의 열고 닫기를 세요
    const before = code.slice(Math.max(0, gt - 20000), gt + 1);
    for (const m of before.matchAll(/<([a-zA-Z][\w-]*)\b[^<>]*>/g)) {
        if (!KEEP_TAG.test(m[1]) && !KEEP_ATTR.test(m[0])) continue;
        const rest = before.slice(m.index + m[0].length), name = m[1].toLowerCase();
        const opens = (rest.match(new RegExp(`<${name}\\b`, 'gi')) || []).length, closes = (rest.match(new RegExp(`</${name}\\s*>`, 'gi')) || []).length;
        if (1 + opens - closes > 0) return false;
    }
    return true;
}
function must(code, find, to) {
    if (!code.includes(find)) throw new Error(`묶음 표의 글을 src 에서 못 찾았어요: ${find}`);
    return code.split(find).join(to);
}
// 주소로 받는 모듈: 재시도 때 주소 뒤에 글을 붙여야 해서(실패한 모듈은 브라우저가 기억) 묶음 조각의 주소로 바꿔요
const CHUNK_URL = {
    'src/weather.js': [["new URL('./weather-engine.js', import.meta.url)", 'src/weather-engine.js'], ["new URL('./weather-worker.js', import.meta.url)", 'src/weather-worker.js']],
    'src/weather-engine.js': [["new URL('./weather-scenes.js', import.meta.url)", 'src/weather-scenes.js']],
};
// 다시 받기: 못 받은 모듈 주소는 브라우저가 기억해요 — 다시 받을 땐 묶음 조각 주소 뒤에 ?retry=<횟수> 를 붙여요. 파일 → [받을 모듈, src 의 글, 횟수 변수 이름]
//   src 의 글은 「(횟수 ? import(`./모듈.js?retry=${횟수}`) : import('./모듈.js'))」 꼴 그대로여야 해요(바뀌면 빌드가 멈춰요)
const RETRY_IMPORT = {
    'src/addons/tts/shell.js': ['src/addons/tts/index.js', "(attempt ? import(`./index.js?retry=${attempt}`) : import('./index.js'))", 'attempt'],
    'src/lite.js': ['src/gate-css.js', "(gateTry ? import(`./gate-css.js?retry=${gateTry}`) : import('./gate-css.js'))", 'gateTry'],   // 뗀 규칙 시트 몸통(켠 꾸밈이 있을 때만 받아요)
    'src/notice.js': ['src/notice-old.gen.js', "(oldTry ? import(`./notice-old.gen.js?retry=${oldTry}`) : import('./notice-old.gen.js'))", 'oldTry'],   // 1.0.0 앞 판 공지(공지 창을 열 때만 받아요)
};
// 내장 스크립트 · 제목 사전: 설정의 파일 이름으로 받아요 — dist/plain · dist/titles 에 이름 그대로
const REAL_META = {
    'src/scripts/runtime.js': ['new URL(`./plain/${item.file}.js${bust?`?r=${Date.now().toString(36)}`:\'\'}`,import.meta.url)', 'new URL(`./titles/${item.file}.gen.js${bust?`?r=${Date.now().toString(36)}`:\'\'}`,import.meta.url)'],
};

// 실리태번 사이트 절대 주소(/script.js · /scripts/extensions.js …)인가 — 묶지 않고 그대로 둬요.
//   리눅스(GitHub Actions)에서는 저장소 자신의 파일 경로도 / 로 시작해요(/home/runner/work/…/index.js).
//   「/ 로 시작 = 사이트 주소」로만 보면 입구 index.js 까지 바깥으로 빠져 rollup 이
//   「Entry module cannot be external」로 멈춰요 — Actions 「생성물이 소스와 같은지」가 1.2.2 까지 늘 실패한 까닭.
//   그래서 저장소 안 파일 경로면 사이트 주소가 아니에요(윈도 경로는 C:\… 라 원래 안 걸렸어요).
export function isSiteUrl(source, root = ROOT, P = path) {
    if (typeof source !== 'string' || !source.startsWith('/')) return false;
    const inside = P.relative(root, source);
    return inside === '' ? false : inside.startsWith('..') || P.isAbsolute(inside);
}

// ── 워커 그래프(날씨 워커 고침): 워커 전역(창 · 문서 없음)에서 도는 모듈은 시작 묶음과 따로 묶어요
//   1.2.1 에서 시작 그래프를 수동 조각 하나(dist/index.js)로 묶은 뒤로, 날씨 엔진 · 장면 조각이 weather-options 를 받으려고 ./index.js 를 import 했어요.
//   워커는 index.js(시작 그래프 전체)를 평가하다 document 가 없어 멈추고(src/lite.js), weather.js 는 날씨를 메인 스레드 2D 캔버스(폰 1152×2271)로 바꿔 그렸어요
//   — 1.2.1 ~ 1.2.4 폰 프레임마다 Commit 이 는 유력한 원인이에요. 1.2.0 까지는 rollup 이 weather-options 를 우연히 DOM 없는 작은 조각에 두어 돌았을 뿐이에요.
//   그래서 워커 그래프는 rollup 을 따로 돌려 자기 조각만 갖게 해요(시작 묶음 · 다른 늦은 조각과 모듈을 나누지 않아요 — weather-options · weather-load 는 두 벌).
//   메인 묶음은 그 조각을 그대로 dist 에 쓰고 src/weather.js 의 엔진 · 워커 주소(CHUNK_URL)만 그 파일로 이어요. 메인 스레드 대체 길도 같은 엔진 조각을 받아요(두 길이 같은 코드).
//   entries: 메인 그래프가 주소로 받는 그 그래프의 입구. 다른 워커(번역 span · 움짤 · 저장 · 알림)는 dist 조각이 아니라 src 원본이나 blob 을 읽어서 여기 없어요.
export const WORKER_GRAPHS = [
    { name: '날씨 워커', entries: ['src/weather-worker.js', 'src/weather-engine.js'] },
];
// 워커 전역(DedicatedWorkerGlobalScope)에는 없는 창 · 문서 전역 — 워커 그래프 모듈이 쓰면 워커 안에서 ReferenceError 로 멈추거나 오류를 내요.
//   typeof 로 먼저 확인하는 이름(weather-art.js 의 typeof Image === 'function')은 「없으면 다른 길」을 둔 것이라 봐 줘요.
export const WINDOW_ONLY = new Set(['window', 'document', 'localStorage', 'sessionStorage', 'getComputedStyle', 'matchMedia', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
    'requestIdleCallback', 'customElements', 'HTMLElement', 'Element', 'Node', 'Image', 'Audio', 'DOMParser', 'devicePixelRatio', 'innerWidth', 'innerHeight', 'visualViewport',
    'getSelection', 'alert', 'confirm', 'jQuery', '$', 'toastr', 'SillyTavern']);
/** 모듈 AST(ESTree)에서 창 · 문서 전역을 풀린 이름으로 쓰는 것 — 모듈 안에서 선언한 이름 · 속성 이름 · typeof 로 확인한 이름은 빼요 */
export function windowGlobalsIn(ast, names = WINDOW_ONLY) {
    const declared = new Set(), guarded = new Set(), used = new Set();
    const bind = p => {
        if (!p) return;
        if (p.type === 'Identifier') declared.add(p.name);
        else if (p.type === 'ObjectPattern') for (const q of p.properties) bind(q.type === 'RestElement' ? q.argument : q.value);
        else if (p.type === 'ArrayPattern') for (const q of p.elements) bind(q);
        else if (p.type === 'RestElement') bind(p.argument);
        else if (p.type === 'AssignmentPattern') bind(p.left);
    };
    const NAME_ONLY = { MemberExpression: 'property', Property: 'key', MethodDefinition: 'key', PropertyDefinition: 'key', LabeledStatement: 'label', BreakStatement: 'label', ContinueStatement: 'label', ExportSpecifier: 'exported', ImportSpecifier: 'imported' };
    const walk = (node, parent, key) => {
        if (Array.isArray(node)) { for (const n of node) walk(n, parent, key); return; }
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'Identifier') {
            if (!(parent && NAME_ONLY[parent.type] === key && !parent.computed) && names.has(node.name)) used.add(node.name);
            return;
        }
        if (node.type === 'UnaryExpression' && node.operator === 'typeof' && node.argument?.type === 'Identifier') { guarded.add(node.argument.name); return; }
        if (node.type === 'VariableDeclarator') bind(node.id);
        else if (/^(?:Function(?:Declaration|Expression)|ArrowFunctionExpression)$/.test(node.type)) { bind(node.id); node.params.forEach(bind); }
        else if (/^Class(?:Declaration|Expression)$/.test(node.type)) bind(node.id);
        else if (node.type === 'CatchClause') bind(node.param);
        else if (/^Import(?:Default|Namespace)?Specifier$/.test(node.type)) bind(node.local);
        for (const k of Object.keys(node)) if (node[k] && typeof node[k] === 'object') walk(node[k], node, k);
    };
    walk(ast, null, null);
    return [...used].filter(n => !declared.has(n) && !guarded.has(n)).sort();
}
/** 워커 그래프 검사(빌드를 멈출 까닭 목록) — 시작 그래프 입구 index.js · 바깥 모듈(실리태번 주소 · vendor · 무결성 표) · 창 · 문서 전역을 쓰는 모듈 */
function workerGraphProblems(ctx, root) {
    const relOf = id => posix(path.relative(root, id));
    const ids = [...ctx.getModuleIds()];
    const from = new Map(ids.filter(id => ctx.getModuleInfo(id)?.isEntry).map(id => [id, null]));
    for (const id of from.keys()) for (const next of [...(ctx.getModuleInfo(id)?.importedIds || []), ...(ctx.getModuleInfo(id)?.dynamicallyImportedIds || [])]) if (!from.has(next)) from.set(next, id);
    const way = id => { const out = []; for (let at = id; at; at = from.get(at)) out.unshift(ctx.getModuleInfo(at)?.isExternal ? at : relOf(at)); return out.join(' → '); };
    const problems = [], dom = [];
    for (const id of ids) {
        const info = ctx.getModuleInfo(id);
        if (!info) continue;
        if (info.isExternal) problems.push(`바깥 모듈을 불러요(워커가 받을 수 있는지 못 봐요): ${way(id)}`);
        else if (relOf(id) === 'index.js') problems.unshift(`시작 그래프 입구 index.js 를 불러요: ${way(id)}`);
        else { const names = windowGlobalsIn(info.ast); if (names.length) dom.push(`${relOf(id)} 가 창 · 문서 전역(${names.join(' · ')})을 써요: ${way(id)}`); }
    }
    return [...problems, ...dom.slice(0, 8), ...(dom.length > 8 ? [`그 밖에 창 · 문서 전역을 쓰는 모듈 ${dom.length - 8}개`] : [])];
}

function plugin(bootModules = new Set(), { root = ROOT, workers = [], worker = null } = {}) {
    const refs = new Map();   // 원본 경로 → 참조 id
    const relOf = abs => posix(path.relative(root, abs));
    const workerModules = new Set(workers.flatMap(w => w.chunks.flatMap(c => Object.keys(c.modules).map(relOf))));
    const external = id => /[\\/]vendor[\\/]/.test(id) || /[\\/]src[\\/]build-info\.js$/.test(id);
    const fromDist = abs => {
        const r = posix(path.relative(path.join(root, 'dist'), abs));
        return r.startsWith('.') ? r : `./${r}`;
    };
    return {
        name: 'blue-lemonade',
        buildStart() {
            if (worker) return;   // 워커 그래프 묶음은 자기 입구만 — 내장 스크립트 · 워커 조각은 메인 묶음이 dist 에 써요
            const emit = (file, fileName) => this.emitFile({ type: 'chunk', id: path.join(root, file), fileName, preserveSignature: 'strict' });
            for (const dir of ['plain', 'titles']) for (const f of fs.readdirSync(path.join(root, 'src/scripts', dir))) if (f.endsWith('.js')) emit(`src/scripts/${dir}/${f}`, `${dir}/${f}`);
            // 따로 묶은 워커 그래프 조각은 다시 묶지 않고 그대로 써요 — 입구(엔진 · 워커) 주소는 아래 transform 의 CHUNK_URL 이 그 파일로 이어요
            for (const w of workers) {
                const asset = new Map(w.chunks.map(c => [c.fileName, this.emitFile({ type: 'asset', fileName: c.fileName, source: c.code })]));
                for (const [entry, file] of w.entryFiles) refs.set(entry, asset.get(file));
            }
        },
        resolveId(source, importer) {
            if (isSiteUrl(source, root)) return { id: source, external: true };
            if (!importer || !source.startsWith('.')) return null;
            const abs = path.resolve(path.dirname(importer), source.split('?')[0]);
            if (path.relative(root, abs).startsWith('..') || external(abs)) return { id: fromDist(abs), external: true };
            return null;
        },
        transform(code, id) {
            const name = relOf(id);
            if (ADAPT[name]) code = ADAPT[name](code);
            if (HTML_GAP_FILES.includes(name)) code = minHtmlGaps(code, name);
            for (const [find, target] of CHUNK_URL[name] || []) {
                if (!refs.has(target) && workerModules.has(target)) throw new Error(`메인 묶음이 워커 그래프 모듈 ${target} 를 주소로 받아요 — WORKER_GRAPHS 입구에 넣어 따로 묶은 조각을 가리키게 해요`);
                if (!refs.has(target)) refs.set(target, this.emitFile({ type: 'chunk', id: path.join(root, target), preserveSignature: 'strict' }));
                code = must(code, find, `new URL(import.meta.ROLLUP_FILE_URL_${refs.get(target)})`);
            }
            if (RETRY_IMPORT[name]) {
                const [target, find, count] = RETRY_IMPORT[name];
                if (!refs.has(target)) refs.set(target, this.emitFile({ type: 'chunk', id: path.join(root, target), preserveSignature: 'strict' }));
                code = must(code, find, `import(import.meta.ROLLUP_FILE_URL_${refs.get(target)}+(${count}?\`?retry=\${${count}}\`:''))`);
            }
            const keep = REAL_META[name] || [];
            const held = keep.map((text, i) => { code = must(code, text, `__BL_REAL_META_${i}__`); return text; });
            // split-css.js 처럼 URL 을 가린 모듈이 있어 globalThis.URL 로 써요
            if (code.includes('import.meta.url')) code = code.split('import.meta.url').join(`new globalThis.URL(${JSON.stringify(`../${name}`)},import.meta.url).href`);
            held.forEach((text, i) => { code = code.split(`__BL_REAL_META_${i}__`).join(text); });
            return { code, map: null };
        },
        // 시작 그래프(index.js 에서 정적 import 로만 닿는 모듈) — 아래 「작은 조각 합치기」가 늦게 받는 모듈을 시작 조각에 끼우지 못하게 쓰는 표
        //   워커 그래프 묶음에서는 대신 워커 그래프 검사를 해요(index.js · 바깥 모듈 · 창 · 문서 전역)
        buildEnd(error) {
            if (worker) { if (!error) worker.problems = workerGraphProblems(this, root); return; }
            const walkStatic = id => {
                if (bootModules.has(id)) return;
                const info = this.getModuleInfo(id);
                if (!info || info.isExternal) return;
                bootModules.add(id);
                for (const next of info.importedIds) walkStatic(next);
            };
            walkStatic(path.join(root, 'index.js'));
        },
        async renderChunk(code) {
            const esbuild = need('esbuild');
            const out = await esbuild.transform(code, { minify: true, format: 'esm', target: 'es2022', charset: 'utf8', legalComments: 'none' });
            return { code: out.code, map: null };
        },
    };
}

// 묶음 도구는 tools/package.json 에 판을 고정해요(저장소에는 안 실어요) — 없으면 한 번 받아요
function need(name) {
    const load = () => createRequire(path.join(HERE, 'package.json'))(name);
    try { return load(); } catch { /* 아래에서 받아요 */ }
    const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund', '--ignore-scripts=false'], { cwd: HERE, stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) throw new Error('묶음 도구를 받지 못했어요 — tools/ 에서 npm ci 를 돌려 주세요');
    return load();
}

/** 워커 그래프 하나를 따로 묶어요(위 WORKER_GRAPHS) — 검사에 걸리면 멈춰요. 쓰지는 않고 조각만 돌려줘요(메인 묶음이 dist 에 써요).
 *  돌려주는 것: { graph, chunks, entryFiles: Map(입구 원본 → dist 파일 이름), warnings }. root 를 바꿔 견본 저장소로도 돌려요(tools/tests/weather-worker-graph.mjs) */
export async function buildWorkerGraph(graph, { root = ROOT } = {}) {
    const { rollup } = need('rollup');
    const warnings = [], scan = { problems: [] };
    const bundle = await rollup({
        input: graph.entries.map(f => path.join(root, f)), plugins: [plugin(undefined, { root, worker: scan })], treeshake: 'safest', preserveEntrySignatures: 'strict', makeAbsoluteExternalsRelative: false,
        onwarn: w => warnings.push(w),
    });
    try {
        if (scan.problems.length) throw new Error(`${graph.name} 그래프가 워커 전역(창 · 문서 없음)에서 못 돌아요 — 빌드를 멈춰요\n  - ${scan.problems.join('\n  - ')}`);
        const { output } = await bundle.generate({ format: 'es', entryFileNames: 'c-[hash].js', chunkFileNames: 'c-[hash].js', generatedCode: 'es2015', hoistTransitiveImports: false });
        const chunks = output.filter(o => o.type === 'chunk');
        const files = new Set(chunks.map(c => c.fileName));
        const stray = chunks.flatMap(c => [...c.imports, ...c.dynamicImports].filter(f => !files.has(f)).map(f => `${c.fileName} → ${f}`));
        if (stray.length) throw new Error(`${graph.name} 조각이 자기 그래프 밖 파일을 불러요 — 빌드를 멈춰요: ${stray.join(' · ')}`);
        const entryFiles = new Map(graph.entries.map(f => [f, chunks.find(c => c.isEntry && c.facadeModuleId && posix(path.relative(root, c.facadeModuleId)) === f)?.fileName]));
        const lost = [...entryFiles].filter(([, file]) => !file).map(([f]) => f);
        if (lost.length) throw new Error(`${graph.name} 입구 조각을 못 찾았어요: ${lost.join(' · ')}`);
        return { graph, chunks, entryFiles, warnings };
    } finally { await bundle.close(); }
}

export async function buildBundle() {
    const { rollup } = need('rollup');
    // 워커 그래프부터 따로 묶어요(검사에 걸리면 여기서 멈춰요)
    const workers = [];
    for (const graph of WORKER_GRAPHS) workers.push(await buildWorkerGraph(graph));
    const warnings = workers.flatMap(w => w.warnings);
    const bootModules = new Set();
    const bundle = await rollup({
        input: { index: path.join(ROOT, 'index.js') }, plugins: [plugin(bootModules, { workers })], treeshake: 'safest', preserveEntrySignatures: false, makeAbsoluteExternalsRelative: false,
        onwarn: w => warnings.push(w),
    });
    // 1.1.5 시작 묶음 다이어트: experimentalMinChunkSize 는 작은 조각을 「늘 받아 둔 조각」에 합쳐요 — 시작 조각은 모든 길이 받아 두니
    //   늦게 받는(import()) 작은 모듈이 시작 조각으로 끌려 들어와 첫 화면 전에 받는 글이 늘었어요(1.1.4 에서 18개 · 약 15KB).
    //   시작 그래프(index.js 까지)를 수동 조각 하나로 묶으면 합치기 대상에서 빠져요(수동 조각은 합치지 않아요) — 늦게 받는 작은 조각은 늦게 받는 조각끼리만 합쳐져요.
    //   그래서 시작 때 받는 것은 dist/index.js 한 조각이에요(전에는 13조각 — 받는 길도 한 번에 끝나요).
    fs.rmSync(DIST, { recursive: true, force: true });
    const { output } = await bundle.write({ dir: DIST, format: 'es', entryFileNames: '[name].js', chunkFileNames: 'c-[hash].js', generatedCode: 'es2015', hoistTransitiveImports: false, experimentalMinChunkSize: 2500,
        manualChunks: id => (bootModules.has(id) ? 'boot' : undefined), onlyExplicitManualChunks: true });
    await bundle.close();
    // 워커 그래프 입구가 메인 묶음 조각에 들면(정적 import) 워커와 메인 대체 길이 다른 코드를 받게 돼요 — 주소(new URL)로만 받아요
    const inMain = output.filter(o => o.type === 'chunk').flatMap(c => Object.keys(c.modules).map(rel).filter(m => workers.some(w => w.graph.entries.includes(m))).map(m => `${m} → dist/${c.fileName}`));
    if (inMain.length) throw new Error(`워커 그래프 입구가 메인 묶음 조각에 들었어요: ${inMain.join(' · ')}`);
    const chunks = [...output.filter(o => o.type === 'chunk'), ...workers.flatMap(w => w.chunks)];
    const bad = warnings.filter(w => !['EMPTY_BUNDLE'].includes(w.code));
    for (const w of bad.slice(0, 20)) console.log(`[경고] ${w.code}: ${String(w.message).slice(0, 200)}`);
    // 맨 위 await 모듈이 다른 모듈과 한 조각에 들면 그 모듈들까지 기다려요 — 혼자 있어야 해요
    const strays = chunks.filter(c => c.fileName === 'index.js').flatMap(c => Object.entries(c.modules)).filter(([id, m]) => m.renderedLength > 0 && !bootModules.has(id.replace(/^ /, ''))).map(([id]) => rel(id));
    if (strays.length) throw new Error(`늦게 받는 모듈이 시작 조각(dist/index.js)에 들었어요: ${strays.slice(0, 5).join(' · ')}`);
    for (const name of ['src/live-models.js']) {   // word-tools.js 는 설정 창 정적 그래프 안이라 예전에도 창이 기다렸어요
        const c = chunks.find(x => Object.keys(x.modules).some(k => rel(k) === name));
        const others = c ? Object.entries(c.modules).filter(([k, v]) => rel(k) !== name && v.renderedLength > 0).map(([k]) => rel(k)) : [];
        if (others.length) throw new Error(`맨 위 await 모듈 ${name} 이 다른 모듈과 묶였어요: ${others.slice(0, 5).join(' · ')}`);
    }
    if (process.env.BL_BUNDLE_META) fs.writeFileSync(process.env.BL_BUNDLE_META, JSON.stringify(chunks.map(c => ({ file: `dist/${c.fileName}`, bytes: Buffer.byteLength(c.code), entry: c.facadeModuleId ? rel(c.facadeModuleId) : null, modules: Object.fromEntries(Object.entries(c.modules).map(([k, v]) => [rel(k.replace(/^ /, '')), v.renderedLength])), imports: c.imports, dynamicImports: c.dynamicImports }))));
    const sorted = chunks.map(c => `dist/${c.fileName}`).sort();
    const stamp = { source: sourceHash(), files: sorted };
    fs.writeFileSync(path.join(ROOT, STAMP), `${JSON.stringify(stamp)}\n`);
    const bytes = chunks.reduce((s, c) => s + Buffer.byteLength(c.code), 0);
    console.log(`[씀] dist/ 조각 ${chunks.length}개 · ${(bytes / 1024).toFixed(0)}KB`);
    for (const w of workers) console.log(`[씀] ${w.graph.name} 그래프(따로 묶음): ${w.chunks.length}조각 · ${w.chunks.reduce((s, c) => s + Buffer.byteLength(c.code), 0).toLocaleString('en-US')}B — 시작 묶음 · 다른 조각을 부르지 않아요`);
    return { chunks, warnings: bad, workers };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.includes('--check')) {
        const r = bundleFresh();
        console.log(r.ok ? 'dist 는 src 와 맞아요' : `[다름] ${r.why}`);
        process.exitCode = r.ok ? 0 : 1;
    } else await buildBundle();
}
