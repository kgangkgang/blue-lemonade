// 실리태번 판 호환(시작 묶음): 실리태번이 내부 이름을 바꾸거나 빼도 테마 전체가 안 뜨는 일이 없어야 해요.
// ① index.js 에서 정적 import 로 이어지는 모듈(시작 묶음)은 실리태번 모듈에서 이름(named · default)으로 가져오지 않아요 —
//    ESM 은 이름 하나가 없으면 연결 단계에서 묶음 전체(index.js 포함)를 버려요. 모듈 묶음(import * as)은 이름이 없어도 연결돼요.
// ② modal.js 는 popup.js 에 fixToastrForDialogs 가 없어도 뜨고, 창을 열고 닫을 수 있고, 콘솔에 한 줄만 남겨요.
// 실행: node tools/tests/st-compat-boot.mjs [테마 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = path.resolve(process.argv[2] || '.');
const scenario = process.argv[3];

if (!scenario) {
    // ① 시작 묶음 정적 검사 ------------------------------------------------------------
    const INSTALL = '/public/scripts/extensions/third-party/theme';
    const stripComments = code => code.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    const IMPORT = /(?:^|[;\n}])\s*(import|export)\s*([\w$*\s{},]*?)\s*from\s*['"]([^'"\n]+)['"]|(?:^|[;\n}])\s*import\s*['"]([^'"\n]+)['"]/g;
    const seen = new Set(), problems = [];
    const visit = rel => {
        if (seen.has(rel)) return;
        seen.add(rel);
        const file = path.join(root, rel);
        if (!fs.existsSync(file)) return;
        const code = stripComments(fs.readFileSync(file, 'utf8'));
        for (const m of code.matchAll(IMPORT)) {
            const spec = m[3] ?? m[4];
            const clause = (m[2] || '').trim();
            if (!spec.startsWith('.')) continue;
            const abs = path.posix.normalize(path.posix.join(INSTALL, path.posix.dirname(rel), spec));
            if (abs.startsWith(INSTALL + '/')) { visit(abs.slice(INSTALL.length + 1)); continue; }
            // 실리태번 모듈: 모듈 묶음(* as x) · 부작용 import 만 괜찮아요
            if (m[4] != null) continue;
            if (/^\*\s+as\s+[\w$]+$/.test(clause)) continue;
            const line = code.slice(0, m.index).split('\n').length + (code[m.index] === '\n' ? 1 : 0);
            problems.push(`${rel}:${line} ${m[1]} ${clause} from '${spec}'`);
        }
    };
    visit('index.js');
    assert.ok(seen.size > 50, `시작 묶음을 찾지 못했어요(${seen.size}개)`);
    assert.deepEqual(problems, [], '시작 묶음이 실리태번 모듈에서 이름으로 가져와요 — 그 이름이 없는 판에서 테마 전체가 안 떠요:\n' + problems.join('\n'));
    console.log(`PASS 시작 묶음 ${seen.size}개 모듈에 실리태번 이름 import 없음`);

    // ② modal.js 를 이름이 있는 판 · 없는 판으로 ------------------------------------------
    let failed = 0;
    for (const name of ['popup-missing-fix', 'popup-has-fix']) {
        const result = spawnSync(process.execPath, [import.meta.filename, root, name], { encoding: 'utf8' });
        if (result.status !== 0) { failed++; console.log(`FAIL ${name}\n${result.stdout}${result.stderr}`); }
        else console.log(`PASS ${name}`);
    }
    process.exitCode = failed ? 1 : 0;
} else {
    const src = pathToFileURL(path.join(root, 'src/')).href;
    const js = code => `data:text/javascript,${encodeURIComponent(code)}`;
    const T = globalThis.__stCompatBoot = { fixCalls: 0 };
    const popup = scenario === 'popup-has-fix'
        ? js('const T=globalThis.__stCompatBoot; export const POPUP_TYPE={TEXT:1}; export function fixToastrForDialogs(){T.fixCalls++;}')
        : js('export const POPUP_TYPE={TEXT:1}; export function callGenericPopup(){}');
    register(js(`
let root, popup;
export function initialize(d) { ({ root, popup } = d); }
export async function resolve(spec, ctx, next) {
    if (spec.endsWith('/popup.js') && ctx.parentURL?.startsWith(root)) return { url: popup, shortCircuit: true };
    return next(spec, ctx);
}`), { data: { root: src, popup } });
    const warns = [];
    console.warn = (...args) => warns.push(args.join(' '));
    const listeners = {};
    const dialog = {
        querySelector: () => null,
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        removeEventListener() {},
        toggleAttribute() {},
        showModal() { this.open = true; },
    };
    globalThis.document = { body: { append() {} } };
    const { showThemeModal } = await import(src + 'modal.js');
    showThemeModal(dialog);
    assert.equal(dialog.open, true, '창이 열려야 해요');
    for (const fn of listeners.close || []) fn();
    showThemeModal({ ...dialog, _blDrawerGuard: true, addEventListener() {}, showModal() {} });
    if (scenario === 'popup-has-fix') {
        assert.equal(T.fixCalls, 3, '실리태번 함수가 있으면 전처럼 열 때 · 닫을 때 불러요');
        assert.equal(warns.length, 0);
    } else {
        assert.equal(warns.length, 1, '이름이 없으면 콘솔에 한 줄만');
        assert.match(warns[0], /fixToastrForDialogs/);
    }
}
