// 실리태번 판 호환(시작 사슬): index.js 의 jQuery 준비 콜백은 시작 함수 수십 개를 차례로 불러요.
// 실리태번이 이름 · DOM 을 바꾼 판에서 그중 하나가 던져도 ① 서랍 · 메뉴 · 나머지 기능 ② 테마 강제 감시 · 실리태번 설정 리스너
// ③ 애드온 시작이 그대로 붙어야 해요. 또 실리태번이 옛 이름으로 표시해 둔 getContext().event_types 가 빠져도(eventTypes 만) 같아야 해요.
// 테마 모듈은 전부 가짜(부른 것만 적음) — index.js 자체의 흐름만 봐요.
// 실행: node tools/tests/st-compat-ready.mjs [테마 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = path.resolve(process.argv[2] || '.');
const scenario = process.argv[3];
// 던지게 해 볼 시작 함수(앞 · 가운데 · 끝, 인수 있는 것 · 없는 것)
const THROWERS = ['installCredits', 'widenSelectorCache', 'startMenuOpenMark', 'startAnchorGate', 'startAssetWatcher', 'startPromptList', 'startIconTextMark', 'startNaturalSlash', 'startLongpressHelp', 'startStreamFollow', 'classifyAll', 'startMainChatRules'];
// 던진 것 말고 나머지는 다 불려야 하는 시작 함수
const MUST = [...new Set([...THROWERS, 'deferPreviewRules', 'deferPanelHasRules', 'syncAddonIcons', 'startCurrentMark', 'startDangerMark', 'startPopupGuard', 'installWheelX', 'startNumberWidth', 'startGroupGrid', 'startCompactLayout', 'startNameMarquee', 'startGutterWatch', 'startDraftKeep', 'installedTouchMode', 'startWorldInfoHelp', 'startWebSearchMarks', 'startWorldInfoLinkMark', 'startCardInk', 'startSwipePickerTranslation', 'startSelectPop', 'startAddonTouchSliders', 'startColorPop', 'startChatGraph', 'startInlineTone', 'startStreamFade', 'startReadingResume', 'startAddons'])];

if (!scenario) {
    let failed = 0;
    const cases = ['normal', 'no-legacy-event-types', ...THROWERS.map(name => 'throw:' + name)];
    for (const name of cases) {
        const result = spawnSync(process.execPath, [import.meta.filename, root, name], { encoding: 'utf8' });
        if (result.status !== 0) { failed++; console.log(`FAIL ${name}\n${result.stdout}${result.stderr}`.slice(0, 2000)); }
        else console.log(`PASS ${name}`);
    }
    console.log(`st-compat-ready: ${cases.length - failed} passed, ${failed} failed`);
    process.exitCode = failed ? 1 : 0;
} else {
    const indexUrl = pathToFileURL(path.join(root, 'index.js')).href;
    const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
    // index.js 의 정적 import 마다 같은 이름을 내는 가짜 모듈
    const CONSTS = { FRESH_SETTINGS: 'false', COPYRIGHT_ICON: "''", DEVICE_QUERY: "'(max-width: 1px)'" };
    const stubs = {};
    for (const m of source.matchAll(/^import\s*(?:\{([^}]*)\}\s*from\s*)?'(\.\/[^']+)'/gm)) {
        const names = (m[1] || '').split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        stubs[m[2]] = names.map(n => CONSTS[n] ? `export const ${n} = ${CONSTS[n]};` : `export function ${n}(...a) { return globalThis.__stReady.call(${JSON.stringify(n)}, a); }`).join('\n');
    }
    const js = code => `data:text/javascript,${encodeURIComponent(code)}`;
    register(js(`
let index, stubs;
export function initialize(d) { ({ index, stubs } = d); }
export async function resolve(spec, ctx, next) {
    if (ctx.parentURL === index && spec.startsWith('./')) return { url: 'data:text/javascript,' + encodeURIComponent(stubs[spec] ?? ''), shortCircuit: true };
    return next(spec, ctx);
}`), { data: { index: indexUrl, stubs } });

    const throwOn = scenario.startsWith('throw:') ? scenario.slice(6) : null;
    const T = globalThis.__stReady = {
        calls: [], ids: [], jqOn: [], on: [], observed: 0, errors: [],
        call(name, args) {
            T.calls.push(name);
            if (name === throwOn) throw new TypeError(`합성 오류: ${name} 가 실리태번 이름을 못 찾음`);
            const ret = RET[name];
            return ret ? ret(...args) : undefined;
        },
    };
    const RET = {
        getSettings: () => ({ enabled: true }), themeEnabled: () => true, publicSettings: s => s, forcedThemeGuard: () => () => {},
        dropStaleOverrides: () => false, hasUnseenNotice: () => false, loadVersion: async () => '', startAddons: async () => {},
        startPullToRefresh: async () => {}, startWorldInfoLinkMark: async () => {}, syncAddonIcons: async () => {}, startReadingResume: async () => {},
        baibaiPresence: async () => ({ baibai: () => false, onChange() {} }), installScrollFade: () => null,
    };
    const classList = () => { const s = new Set(); return { add: x => s.add(x), remove: x => s.delete(x), contains: x => s.has(x), toggle: (x, on = !s.has(x)) => (on ? s.add(x) : s.delete(x), on) }; };
    globalThis.document = {
        documentElement: { classList: classList() }, body: { classList: classList(), dataset: {} },
        getElementById: id => { T.ids.push(id); return null; }, querySelectorAll: () => [], addEventListener() {},
    };
    globalThis.window = globalThis;
    globalThis.addEventListener = () => {};
    globalThis.matchMedia = () => ({ addEventListener() {} });
    globalThis.MutationObserver = class { observe() { T.observed++; } disconnect() {} };
    globalThis.toastr = { warning() {}, info() {}, error() {} };
    const ready = [];
    globalThis.jQuery = globalThis.$ = arg => typeof arg === 'function' ? void ready.push(arg) : { on: (types, selector) => { T.jqOn.push(selector); } };
    const TYPES = { CHAT_CHANGED: 'chat_id_changed', APP_READY: 'app_ready', SETTINGS_LOADED: 'settings_loaded' };
    const ctx = {
        eventSource: { on: name => T.on.push(name), once: name => T.on.push(name), makeFirst: name => T.on.push(name) },
        eventTypes: TYPES, event_types: TYPES, extensionSettings: { salty: {} }, getCurrentLocale: () => 'en', powerUserSettings: {},
    };
    if (scenario === 'no-legacy-event-types') delete ctx.event_types;
    const originalGetContext = () => (scenario === 'no-legacy-event-types' ? { ...ctx } : ctx);
    globalThis.SillyTavern = { getContext: originalGetContext };
    console.error = (...args) => T.errors.push(args.map(String).join(' '));
    console.warn = () => {};

    let importError = null, readyError = null;
    try { await import(indexUrl); } catch (error) { importError = error; }
    for (const fn of ready) { try { fn(); } catch (error) { readyError = error; } }
    // 10-30: 시작 그래프 상한 때문에 몇몇 시작 함수는 startSafe 안에서 동적 import 로 불러요 — 그 import 가 끝날 때까지 한 박자 기다려 세요
    await new Promise(resolve => setTimeout(resolve, 200));

    assert.equal(importError, null, `index.js 가 끝까지 실행돼야 해요: ${importError?.message}`);
    assert.equal(readyError, null, `준비 콜백이 중간에 끊기면 안 돼요: ${readyError?.message}`);
    for (const name of MUST) if (name !== throwOn) assert.ok(T.calls.includes(name), `${name} 가 시작돼야 해요${throwOn ? `(${throwOn} 가 던진 뒤에도)` : ''}`);
    assert.ok(T.ids.includes('extensions_settings2'), '테마 서랍을 붙이러 가야 해요(mountDrawer)');
    assert.ok(T.ids.includes('extensionsMenu'), '요술봉 메뉴 줄을 붙이러 가야 해요(addMenuItem)');
    assert.ok(T.observed >= 1, '테마 강제 감시(body class)가 붙어야 해요');
    assert.ok(T.jqOn.some(s => String(s).includes('#openai_show_thoughts')), '추론 숨김 리스너가 붙어야 해요');
    assert.ok(T.jqOn.some(s => String(s).includes('#chat_display')), '실리태번 설정 바뀜 리스너가 붙어야 해요');
    assert.ok(T.on.includes(TYPES.CHAT_CHANGED), '채팅 바뀜 → 그림 분류 리스너가 붙어야 해요');
    // 옛 이름이 빠진 판: 테마 모듈 · 옛 확장이 getContext().event_types 로 읽어도 새 이름과 같은 표 / 둘 다 있는 판: getContext 를 건드리지 않음
    if (scenario === 'no-legacy-event-types') assert.equal(SillyTavern.getContext().event_types, TYPES, 'event_types 가 eventTypes 로 이어 붙어야 해요');
    else assert.equal(SillyTavern.getContext, originalGetContext, '두 이름이 다 있으면 getContext 를 감싸지 않아요');
    if (throwOn) assert.ok(T.errors.some(line => line.includes(throwOn) || line.includes('본채팅 규칙')), '던진 함수는 콘솔에 남겨요');
    process.exit(0);
}
