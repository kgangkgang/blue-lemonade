// 번역기 7.0.7 Google · Vertex 직접 연결 기본 응답 길이: 1000 이면 묶음이 1200자라 긴 메시지가 요청 열 몇 개로 나뉘고
// 요청마다 프롬프트 · 문맥(13k 토큰 넘게)이 다시 들어갔다. 기본값 4000, 저장된 옛 기본값 1000 은 한 번만 4000 으로 올린다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || '.';
const source = readFileSync(join(root, 'src/addons/translator/index.js'), 'utf8');
const html = readFileSync(join(root, 'src/addons/translator/index.html'), 'utf8');
let passed = 0, failed = 0;
function check(name, fn) {
    try { fn(); passed++; console.log(`  PASS  ${name}`); } catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}

const defaultLength = provider => Number(new RegExp(`\\n        ${provider}: \\{\\n            max_length: (\\d+)`).exec(source)?.[1]);
const groupLimit = tokens => tokens > 0 ? Math.min(3600, Math.max(400, Math.round(tokens * 1.2))) : 3600;   // index.js groupLimit 와 같은 셈

check('Google and Vertex default to 4000, which fills a whole 3600-character bundle', () => {
    for (const provider of ['google', 'vertexai']) {
        assert.equal(defaultLength(provider), 4000, provider);
        assert.equal(groupLimit(defaultLength(provider)), 3600, provider);
    }
    assert.match(source, /const groupLimit = outputTokens > 0 \? Math\.min\(CHUNK_TARGET \* 2, Math\.max\(400, Math\.round\(outputTokens \* 1\.2\)\)\) : CHUNK_TARGET \* 2;/);
});

const start = source.indexOf('if (!extensionSettings.gemini_length_707) {');
const block = source.slice(start, source.indexOf('\n    }\n', start) + 6);
const migrate = new Function('extensionSettings', 'saveSettingsDebounced', block);

check('a saved old default of 1000 is raised once; other values stay', () => {
    assert.ok(start > 0, 'migration block');
    let saves = 0;
    const s = { parameters: { google: { max_length: 1000 }, vertexai: { max_length: '1000' }, openai: { max_length: 1000 } } };
    migrate(s, () => saves++);
    assert.equal(s.parameters.google.max_length, 4000);
    assert.equal(s.parameters.vertexai.max_length, 4000);
    assert.equal(s.parameters.openai.max_length, 1000, 'other providers untouched');
    assert.equal(s.gemini_length_707, true);
    assert.equal(saves, 1);
    s.parameters.vertexai.max_length = 1000;   // 그 뒤 사용자가 다시 1000 으로 두면 그대로
    migrate(s, () => saves++);
    assert.equal(s.parameters.vertexai.max_length, 1000);
    assert.equal(saves, 1);
    const custom = { parameters: { google: { max_length: 2500 } } };
    migrate(custom, () => {});
    assert.equal(custom.parameters.google.max_length, 2500, 'a chosen value is kept');
    migrate({ parameters: {} }, () => {});   // 공급자 칸이 없어도 멈추지 않는다
});

check('the migration runs after parameters exist in the settings load', () => {
    assert.ok(source.indexOf('extensionSettings.parameters = defaultSettings.parameters;') < start);
});

check('every Max Response Length field explains the split', () => {
    const labels = html.match(/<small[^>]*>Max Response Length<\/small>/g) || [];
    assert.ok(labels.length >= 5);
    for (const label of labels) assert.match(label, /title="작으면 긴 메시지를 여러 요청으로 나눠 보내요/);
});

const helper = new Function(`${/function isParamNumber\(value\) \{[^\n]*\}/.exec(source)?.[0]}; return isParamNumber;`)();
const defaultParams = (() => {   // defaultSettings.parameters 객체를 괄호 짝으로 잘라 그대로 읽는다
    const open = source.indexOf('{', source.indexOf('\n    parameters: {', source.indexOf('const defaultSettings = {')));
    let depth = 0, end = open;
    for (; end < source.length; end++) { if (source[end] === '{') depth++; else if (source[end] === '}' && --depth === 0) break; }
    return new Function(`return ${source.slice(open, end + 1)};`)();
})();
const repairStart = source.indexOf('    for (const [provider, defaults] of Object.entries(defaultSettings.parameters)) {');
const repairBlock = source.slice(repairStart, source.indexOf('\n    }\n', repairStart) + 6);
const repair = new Function('extensionSettings', 'defaultSettings', 'isParamNumber', repairBlock);

check('settings load refills missing providers and null / blank values (the empty Vertex fields)', () => {
    assert.ok(repairStart > 0 && repairStart < start, 'repair runs before the 1000 → 4000 step');
    assert.equal(defaultParams.vertexai.max_length, 4000);
    const s = { parameters: { vertexai: { temperature: 1.06, max_length: null, top_k: null, top_p: '' }, openai: { max_length: 2000, temperature: 0.7 } } };
    repair(s, { parameters: defaultParams }, helper);
    assert.deepEqual(s.parameters.vertexai, { temperature: 1.06, max_length: 4000, top_k: 0, top_p: 0.99 });
    assert.equal(s.parameters.openai.max_length, 2000, 'a real value stays');
    assert.equal(s.parameters.google.max_length, 4000, 'a missing provider is created');
    assert.notEqual(s.parameters.google, defaultParams.google, 'a copy, not the shared default object');
});

check('saving an empty field keeps the old number or the default instead of NaN', () => {
    const line = source.split('\n').find(l => l.includes('params[paramName] = Number.isFinite(value) ? value'));
    assert.ok(line, 'save line');
    const save = new Function('value', 'params', 'paramName', 'provider', 'defaultSettings', 'isParamNumber', `${line.trim()} return params[paramName];`);
    const d = { parameters: defaultParams };
    assert.equal(save(NaN, { max_length: 3000 }, 'max_length', 'vertexai', d, helper), 3000);
    assert.equal(save(NaN, { max_length: null }, 'max_length', 'vertexai', d, helper), 4000);
    assert.equal(save(2500, { max_length: null }, 'max_length', 'vertexai', d, helper), 2500);
    assert.ok(!/params\[paramName\] = parseFloat\(\$\(this\)\.val\(\)\);/.test(source), 'the old NaN-saving line is gone');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
