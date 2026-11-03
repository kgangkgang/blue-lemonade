// 9.0.6 정의 없는 이름 감사(acorn + 간단 범위 분석): 모듈 안에서 선언 · import 되지 않았고 브라우저 · 실리태번 페이지 전역도 아닌 이름을 읽는 곳.
// 실행하면 ReferenceError 로 그 경로가 멈춘다. 9.0.0 정리에서 함수를 지우고 부르는 줄이 남은 사고를 잡으려고 만들었다.
//   node tools/audit/undeclared.mjs [저장소] [--json 결과.json] [--all] [--strict]   (--all: 시험 · 작업자 파일 포함 · --strict: 하나라도 있으면 실패)
// CI(tools/tests/module-undeclared.mjs)는 node --expose-internals 로 node 안의 acorn 을 쓴다.
// typeof X 와 'X' in … 는 일부러 없는 이름을 묻는 것이라 뺀다. 작업자(worker) 파일의 self · importScripts · onmessage 도 전역으로 친다.
import { trackedFiles, parseJs, read, writeJson, argValue } from './lib.mjs';

// 다른 확장이 두는 전역(쓰기 전에 typeof 로 확인) · 기능 감지로 쓰는 최신 브라우저 전역
const OPTIONAL_GLOBALS = ['eventOn', 'eventOff', 'tavern_events', 'TavernHelper', 'getChatMessages', 'scheduler', 'ContentVisibilityAutoStateChangeEvent', 'CloseWatcher', 'addEventListener', 'removeEventListener', 'dispatchEvent'];
const ST_GLOBALS = ['SillyTavern', 'toastr', '$', 'jQuery', 'moment', 'DOMPurify', 'showdown', 'hljs', 'Popper', 'Fuse', 'localforage', 'Handlebars', 'diff_match_patch', 'SVGInject', 'droll', 'Cropper', 'Pagination', 'select2', 'Readability', 'isProbablyReaderable', 'ToolCoolColorPicker', 'Bowser', 'css'];
const DOM = `window document navigator location history localStorage sessionStorage indexedDB caches crypto screen visualViewport frames parent top opener name status
origin isSecureContext innerWidth innerHeight outerWidth outerHeight devicePixelRatio scrollX scrollY pageXOffset pageYOffset screenX screenY
alert confirm prompt open close print focus blur stop postMessage scrollTo scrollBy scroll getComputedStyle getSelection matchMedia
requestAnimationFrame cancelAnimationFrame requestIdleCallback cancelIdleCallback createImageBitmap reportError customElements speechSynthesis
importScripts onmessage onerror self clients registration skipWaiting serviceWorker external chrome webkitAudioContext webkitSpeechRecognition
Image Audio Option Worker SharedWorker Notification ServiceWorker XMLHttpRequest WebSocket EventSource MutationObserver ResizeObserver IntersectionObserver
PerformanceObserver DOMParser XMLSerializer Node NodeFilter NodeList Element Document DocumentFragment ShadowRoot Text Comment Range Selection Attr NamedNodeMap
Event CustomEvent EventTarget UIEvent KeyboardEvent MouseEvent PointerEvent TouchEvent Touch InputEvent FocusEvent WheelEvent ClipboardEvent DragEvent
CompositionEvent AnimationEvent TransitionEvent ErrorEvent PromiseRejectionEvent PageTransitionEvent PopStateEvent HashChangeEvent SubmitEvent ProgressEvent
StorageEvent MessageEvent CloseEvent BeforeUnloadEvent SecurityPolicyViolationEvent ToggleEvent MediaQueryList MediaQueryListEvent DataTransfer
FileReader FileList ImageData ImageBitmap OffscreenCanvas CanvasRenderingContext2D Path2D DOMMatrix DOMRect DOMRectReadOnly DOMPoint DOMException
FontFace FontFaceSet AudioContext OfflineAudioContext AudioBuffer AudioWorkletNode GainNode MediaSource MediaRecorder MediaStream MediaMetadata
RTCPeerConnection SpeechSynthesisUtterance SpeechRecognition VideoFrame VideoEncoder VideoDecoder AudioEncoder AudioData EncodedVideoChunk EncodedAudioChunk
CSS CSSStyleSheet CSSRule CSSStyleRule CSSMediaRule StyleSheet CSSStyleDeclaration ClipboardItem IDBKeyRange IDBDatabase IDBTransaction IDBRequest
Cache CacheStorage FileSystemFileHandle showSaveFilePicker showOpenFilePicker showDirectoryPicker launchQueue trustedTypes TrustedHTML
ViewTransition IdleDeadline Gamepad Highlight HighlightRegistry XPathResult XPathEvaluator TreeWalker HTMLDocument StaticRange AbortSignal
CompressionStream DecompressionStream ReadableStream WritableStream TransformStream TextDecoderStream TextEncoderStream WakeLock WakeLockSentinel
Animation KeyframeEffect DocumentTimeline ScrollTimeline ViewTimeline InputDeviceCapabilities NavigationPreloadManager PushManager ScreenOrientation`.split(/\s+/);
const NODE = Object.getOwnPropertyNames(globalThis);
const GLOBALS = new Set([...ST_GLOBALS, ...OPTIONAL_GLOBALS, ...DOM, ...NODE, 'undefined', 'NaN', 'Infinity', 'arguments', 'globalThis', 'eval']);
const PATTERN = /^(HTML\w*Element|SVG\w*|CSS\w*|DOM\w*|RTC\w*|WebGL\w*|GPU\w*|IDB\w*|Performance\w*|Media\w*|Audio\w*|Speech\w*|XR\w*|Intl|webkit\w*|on[a-z]+)$/;

const files = trackedFiles().filter(f => (f === 'index.js' || f.startsWith('src/')) && /\.m?js$/.test(f)
    && (process.argv.includes('--all') || !/\.test\.m?js$|\/tests?\/|\/source\/|\/vendor\/|^src\/scripts\/(bundled|plain)\//.test(f)));

// 범위: { vars:Set, parent }
function scopeOf(parent) { return { vars: new Set(), parent }; }
function declarePattern(p, scope) {
    if (!p) return;
    if (p.type === 'Identifier') scope.vars.add(p.name);
    else if (p.type === 'ObjectPattern') for (const q of p.properties) declarePattern(q.type === 'RestElement' ? q.argument : q.value, scope);
    else if (p.type === 'ArrayPattern') for (const e of p.elements) declarePattern(e, scope);
    else if (p.type === 'AssignmentPattern') declarePattern(p.left, scope);
    else if (p.type === 'RestElement') declarePattern(p.argument, scope);
}
const isFn = n => n && /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type);
// var · function 선언을 함수 범위로 끌어올림(중첩 함수 안은 안 들어감)
function hoistVars(body, scope) {
    const visit = n => {
        if (!n || typeof n.type !== 'string') return;
        if (isFn(n) || n.type === 'ClassExpression' || n.type === 'ClassDeclaration') return;
        if (n.type === 'VariableDeclaration' && n.kind === 'var') for (const d of n.declarations) declarePattern(d.id, scope);
        for (const k of Object.keys(n)) {
            if (k === 'loc') continue;
            const v = n[k];
            if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === 'string') visit(v);
        }
    };
    visit(body);
}
// 블록 바로 안의 let · const · class · function 선언
function blockDecls(stmts, scope) {
    for (const s of stmts) {
        const d = s.type === 'ExportNamedDeclaration' || s.type === 'ExportDefaultDeclaration' ? s.declaration : s;
        if (!d) continue;
        if (d.type === 'VariableDeclaration' && d.kind !== 'var') for (const v of d.declarations) declarePattern(v.id, scope);
        if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) scope.vars.add(d.id.name);
        if (s.type === 'ImportDeclaration') for (const sp of s.specifiers) scope.vars.add(sp.local.name);
    }
}
const resolves = (name, scope) => { for (let s = scope; s; s = s.parent) if (s.vars.has(name)) return true; return false; };

const rows = [];
for (const f of files) {
    let ast;
    try { ast = parseJs(read(f), f); } catch (error) { rows.push({ file: f, line: 0, name: '(구문 오류)', note: error.message }); continue; }
    const top = scopeOf(null);
    hoistVars(ast, top);
    blockDecls(ast.body, top);
    const misses = new Map();
    const ref = (id, scope) => { if (!resolves(id.name, scope) && !GLOBALS.has(id.name) && !PATTERN.test(id.name)) { if (!misses.has(id.name)) misses.set(id.name, id.loc.start.line); } };
    function visit(n, scope, parent, key) {
        if (!n || typeof n.type !== 'string') return;
        switch (n.type) {
            case 'Identifier':
                // 참조 자리만
                if (parent && ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed)
                    || (parent.type === 'Property' && key === 'key' && !parent.computed && !parent.shorthand)
                    || ((parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && key === 'key' && !parent.computed)
                    || (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement')
                    || parent.type === 'MetaProperty'
                    || ((parent.type === 'ExportSpecifier') && key === 'exported')
                    || parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier' || parent.type === 'ImportNamespaceSpecifier'
                    || (parent.type === 'ExportSpecifier' && parent._fromSource))) return;
                ref(n, scope); return;
            case 'UnaryExpression':
                if (n.operator === 'typeof' && n.argument.type === 'Identifier') return;
                break;
            case 'BinaryExpression':
                if (n.operator === 'in') { visit(n.right, scope, n, 'right'); return; }
                break;
            case 'ExportNamedDeclaration':
                if (n.source) { for (const s of n.specifiers) s._fromSource = true; return; }
                break;
            case 'ImportDeclaration': case 'ExportAllDeclaration': return;
            case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': {
                const fs = scopeOf(scope);
                if (n.type === 'FunctionExpression' && n.id) fs.vars.add(n.id.name);
                for (const p of n.params) declarePattern(p, fs);
                if (n.body.type === 'BlockStatement') { hoistVars(n.body, fs); blockDecls(n.body.body, fs); }
                for (const p of n.params) visitPatternDefaults(p, fs);
                if (n.body.type === 'BlockStatement') for (const s of n.body.body) visit(s, fs, n.body, 'body');
                else visit(n.body, fs, n, 'body');
                return;
            }
            case 'ClassDeclaration': case 'ClassExpression': {
                const cs = scopeOf(scope);
                if (n.id) cs.vars.add(n.id.name);
                if (n.superClass) visit(n.superClass, scope, n, 'superClass');
                visit(n.body, cs, n, 'body');
                return;
            }
            case 'BlockStatement': case 'StaticBlock': {
                const bs = scopeOf(scope);
                blockDecls(n.body, bs);
                for (const s of n.body) visit(s, bs, n, 'body');
                return;
            }
            case 'SwitchStatement': {
                visit(n.discriminant, scope, n, 'discriminant');
                const bs = scopeOf(scope);
                for (const c of n.cases) blockDecls(c.consequent, bs);
                for (const c of n.cases) { if (c.test) visit(c.test, bs, c, 'test'); for (const s of c.consequent) visit(s, bs, c, 'consequent'); }
                return;
            }
            case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': {
                const ls = scopeOf(scope);
                const init = n.init || n.left;
                if (init && init.type === 'VariableDeclaration' && init.kind !== 'var') for (const d of init.declarations) declarePattern(d.id, ls);
                for (const k of ['init', 'left', 'test', 'update', 'right', 'body']) if (n[k]) visit(n[k], ls, n, k);
                return;
            }
            case 'CatchClause': {
                const cs = scopeOf(scope);
                if (n.param) declarePattern(n.param, cs);
                visit(n.body, cs, n, 'body');
                return;
            }
            case 'VariableDeclarator':
                visitPatternDefaults(n.id, scope);
                if (n.init) visit(n.init, scope, n, 'init');
                return;
        }
        for (const k of Object.keys(n)) {
            if (k === 'loc' || k === 'start' || k === 'end') continue;
            const v = n[k];
            if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') visit(c, scope, n, k); }
            else if (v && typeof v.type === 'string') visit(v, scope, n, k);
        }
    }
    // 구조 분해 기본값 · 계산된 키만 참조로 본다
    function visitPatternDefaults(p, scope) {
        if (!p) return;
        if (p.type === 'AssignmentPattern') { visitPatternDefaults(p.left, scope); visit(p.right, scope, p, 'right'); }
        else if (p.type === 'ObjectPattern') for (const q of p.properties) { if (q.type === 'RestElement') visitPatternDefaults(q.argument, scope); else { if (q.computed) visit(q.key, scope, q, 'key'); visitPatternDefaults(q.value, scope); } }
        else if (p.type === 'ArrayPattern') for (const e of p.elements) visitPatternDefaults(e, scope);
        else if (p.type === 'RestElement') visitPatternDefaults(p.argument, scope);
        else if (p.type === 'MemberExpression') visit(p, scope, null, null);
    }
    for (const s of ast.body) visit(s, top, ast, 'body');
    for (const [name, line] of misses) rows.push({ file: f, line, name });
}
console.log(`[정의 없는 이름] JS ${files.length}개 · 후보 ${rows.length}`);
for (const r of rows) console.log(`  ${r.file}:${r.line} ${r.name}${r.note ? ' — ' + r.note : ''}`);
const out = argValue('--json');
if (out) writeJson(out, rows);
if (process.argv.includes('--strict') && rows.length) process.exitCode = 1;
