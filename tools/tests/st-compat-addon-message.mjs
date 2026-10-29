// 실리태번 판 호환(애드온 시작 실패 안내): 애드온이 그 실리태번 판에 없는 이름을 가져오다 실패하면(ESM 연결 오류 — 예: 1.14 의
// createGenerationParameters) 「새로고침 후 다시」가 아니라 그 이름과 판 · 설치 안내를 보여야 해요. 다른 실패는 전과 같은 문구.
// 실행: node tools/tests/st-compat-addon-message.mjs [테마 뿌리]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = path.resolve(process.argv[2] || '.');
const scenario = process.argv[3];
if (!scenario) {
    let failed = 0;
    for (const name of ['missing-export', 'other-error', 'messages']) {
        const result = spawnSync(process.execPath, [import.meta.filename, root, name], { encoding: 'utf8' });
        if (result.status !== 0) { failed++; console.log(`FAIL ${name}\n${result.stdout}${result.stderr}`.slice(0, 1500)); }
        else console.log(`PASS ${name}`);
    }
    process.exitCode = failed ? 1 : 0;
} else {
    const src = pathToFileURL(path.join(root, 'src/')).href;
    const js = code => `data:text/javascript,${encodeURIComponent(code)}`;
    const stubs = {
        'usage-mode.js': 'export const addonsEnabled = () => true;',
        'settings.js': 'export function getSettings(){ return { addons: {} }; } export function saveSettings(){}',
        'addon-layout.js': 'export function toolSection(){}',
        'settings-dialog.js': 'export function leaveSettingsDialog(){}',
        'addons/notes/version.js': 'export const NOTES_VERSION="1.0.0";',
        'addons/tts/version.js': 'export const TTS_VERSION="1.0.0";',
        'addons/tts/credits.js': 'export function ttsCreditsSummaryHtml(){}',
        'addon-save.js': 'export async function restorePendingAddons(){return false;} export async function saveAddonsNow(){}',
        'assist/core.js': 'export const IDS=[],LABELS={},DUPLICATES={};',
        'addons/perf/start-error.js': 'export function perfErrorText(){ return "PERF-X"; }',
        // 실리태번 모듈에 없는 이름을 가져오는 애드온(크롬 · 노드와 같은 연결 오류) / 그냥 던지는 애드온
        'addons/regexlink/index.js': scenario === 'missing-export'
            ? `import { createGenerationParameters } from ${JSON.stringify(js('export const oai_settings = {};'))}; createGenerationParameters;`
            : 'throw new TypeError("synthetic private detail");',
    };
    register(js(`import fs from 'node:fs';
let root, stubs;
export function initialize(d) { ({ root, stubs } = d); }
export async function load(url, ctx, next) {
    if (url.startsWith(root)) {
        const rel = url.slice(root.length);
        if (stubs[rel] != null) return { format: 'module', source: stubs[rel], shortCircuit: true };
        if (rel === 'addons.js') return { format: 'module', source: fs.readFileSync(new URL(url), 'utf8') + '\\nexport { startOne as testStart, failed as testFailed };', shortCircuit: true };
    }
    return next(url, ctx);
}`), { data: { root: src, stubs } });
    globalThis.window = { dispatchEvent() {} };
    console.error = () => {};
    const addons = await import(src + 'addons.js');
    if (scenario === 'messages') {
        // 브라우저마다 다른 연결 오류 문구 → 이름 / 연결 오류가 아니면 null
        assert.equal(addons.missingExportName(new SyntaxError("The requested module '../../../../openai.js' does not provide an export named 'createGenerationParameters'")), 'createGenerationParameters');
        assert.equal(addons.missingExportName(new SyntaxError("The requested module '../x.js' doesn't provide an export named: 'isGenerating'")), 'isGenerating');
        assert.equal(addons.missingExportName(new SyntaxError('import not found: syncMesToSwipe')), 'syncMesToSwipe');
        assert.equal(addons.missingExportName(new SyntaxError("Importing binding name 'callPopup' is not found.")), 'callPopup');
        assert.equal(addons.missingExportName(new TypeError("does not provide an export named 'x'")), null);
        assert.equal(addons.missingExportName(new SyntaxError('Unexpected token')), null);
        assert.equal(addons.missingExportName(undefined), null);
    } else {
        await addons.testStart('regexlink');
        const message = addons.testFailed.get('regexlink');
        if (scenario === 'missing-export') {
            assert.match(message, /createGenerationParameters/, '없는 이름을 알려야 해요');
            assert.match(message, /실리태번을 최신 판/, '새로고침이 아니라 판 · 설치 안내');
            assert.doesNotMatch(message, /새로고침 후 다시/);
        } else {
            assert.equal(message, '시작하지 못했어요. 새로고침 후 다시 확인해 주세요.', '다른 실패는 전과 같은 문구');
        }
    }
}
