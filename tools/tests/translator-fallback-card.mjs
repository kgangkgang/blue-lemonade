// 번역 3.1.3 「검열되면 대신 쓸 모델」 카드 — 연결 방식 카드 안에 있던 「검열당했을 때」 칸이 주 번역 모델처럼 보여 헷갈린다는 제보.
//   node tools/tests/translator-fallback-card.mjs <테마 루트>
// 확인하는 것:
//   1) 모델 탭 순서: 연결 방식 → 공급자 · 모델 → 검열되면 대신 쓸 모델(설명 한 줄) → 생성 파라미터. 예비 칸은 연결 방식 카드 밖 · 직접 선택 묶음 밖(어느 연결 방식에서도 보임)
//   2) 「실리태번 API 중 선택」이면 연결 방식 카드에 「아래 공급자 · 모델로 번역해요」 한 줄, 현재 연결이면 숨김. 공급자 · 생성 파라미터 묶음은 예전처럼 직접 선택에서만
//   3) 저장 키 그대로: 칸은 extensionSettings.fallback { enabled, provider, model } 을 읽고 쓰고, 모델 전환 「번역 (검열되면)」 줄과 같은 값을 공유
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('src/addons/translator/index.html');
const source = read('src/addons/translator/index.js');
let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log(`  PASS  ${name}`); } catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}

const modelPanel = (() => {
    const start = html.indexOf('data-llmt-panel="model"');
    return html.slice(start, html.indexOf('data-llmt-panel="prompt"', start));
})();
// 카드 하나 = <section class="llmt-card" …> … </section>
const cards = [...modelPanel.matchAll(/<section class="llmt-card"[^>]*>[\s\S]*?<\/section>/g)].map(m => ({ text: m[0], at: m.index, title: /<header[^>]*>[\s\S]*?<span>([^<]+)<\/span>/.exec(m[0])?.[1] }));
const card = title => cards.find(c => c.title === title);
// 여는 div 와 짝인 닫는 div 까지
function block(text, open) {
    const start = text.indexOf(open);
    if (start < 0) return null;
    const re = /<div\b|<\/div>/g; re.lastIndex = start; let depth = 0, m;
    while ((m = re.exec(text))) { depth += m[0] === '</div>' ? -1 : 1; if (!depth) return { start, end: m.index + 6, text: text.slice(start, m.index + 6) }; }
    return null;
}

await check('model tab order: connection → provider/model → fallback card → parameters', () => {
    const titles = cards.map(c => c.title);
    assert.deepEqual(titles.slice(0, 4), ['연결 방식', '공급자 · 모델', '검열되면 대신 쓸 모델', '생성 파라미터']);
});

await check('fallback field left the connection card and sits in its own card with the one-line explanation', () => {
    assert.ok(!card('연결 방식').text.includes('llm_fallback_field'), 'not in the connection card');
    const fb = card('검열되면 대신 쓸 모델');
    assert.ok(fb, 'own card');
    assert.equal((html.match(/id="llm_fallback_field"/g) || []).length, 1, 'one host, same id (model switch jump · re-render keep working)');
    assert.match(fb.text, /<small class="llmt-desc">원래 번역이 검열로 막혔을 때만 이 모델로 한 번 더 보내요\. 평소엔 안 써요\.<\/small>\s*<div id="llm_fallback_field" class="llmt-fallback"><\/div>/);
    assert.ok(!/검열당했을 때/.test(modelPanel.replace(/<!--[\s\S]*?-->/g, '')), 'no visible old wording in the tab markup');
});

await check('fallback card is outside the direct-only groups, so it shows in either connection mode', () => {
    const direct = block(modelPanel, '<div id="llm_direct_settings">');
    const params = block(modelPanel, '<div id="llm_direct_params">');
    assert.ok(direct && params, 'both direct-only groups');
    const fb = card('검열되면 대신 쓸 모델');
    assert.ok(direct.text.includes('공급자 · 모델') && !direct.text.includes('llm_fallback_field'));
    assert.ok(params.text.includes('생성 파라미터') && params.text.includes('리버스 프록시') && !params.text.includes('llm_fallback_field'));
    assert.ok(direct.end < fb.at && fb.at < params.start, 'between the two groups');
    // 직접 선택 쪽 id 는 예전 그대로 (다른 애드온 · 검사가 찾는 칸)
    for (const id of ['llm_provider', 'llm_model', 'llm_custom_model', 'llm_custom_url', 'llm_custom_fetch_models']) assert.ok(direct.text.includes(`id="${id}"`), id);
    for (const id of ['llm_use_reverse_proxy', 'llm_reverse_proxy_url']) assert.ok(params.text.includes(`id="${id}"`), id);
    assert.ok(params.text.includes('<div class="parameter-settings">'), 'parameters (model switch jump target)');
});

await check('direct mode shows "아래 공급자 · 모델로 번역해요" in the connection card; current mode hides it', () => {
    assert.match(card('연결 방식').text, /<small id="llm_direct_hint" class="llmt-desc" style="display:none">아래 공급자 · 모델로 번역해요\.<\/small>/);
    const start = source.indexOf('function updateConnectionVisibility() {');
    const body = source.slice(start, source.indexOf('\n}\n', start) + 3);
    const shown = {};
    const $ = sel => ({ val() { return this; }, toggle(on) { for (const s of sel.split(',')) shown[s.trim()] = on; return this; } });
    const run = mode => { const fn = new Function('$', 'extensionSettings', `${body}\nupdateConnectionVisibility();`); fn($, { connection_mode: mode, profile_max_tokens: 0 }); return { ...shown }; };
    assert.deepEqual(run('direct'), { '#llm_current_settings': false, '#llm_direct_settings': true, '#llm_direct_params': true, '#llm_direct_hint': true });
    assert.deepEqual(run('current'), { '#llm_current_settings': true, '#llm_direct_settings': false, '#llm_direct_params': false, '#llm_direct_hint': false });
    assert.ok(!/llmt_fallback_card|llm_fallback_field/.test(body), 'fallback card is never toggled');
});

await check('settings keys unchanged: the field reads/writes extensionSettings.fallback and the model switch row shares it', async () => {
    assert.match(source, /mountFallbackField\(host, \{ id: 'translator', settings: \(\) => extensionSettings, sources: FALLBACK_SOURCES, save: saveSettingsDebounced, main: translatorMainTarget,/);
    assert.match(source, /window\.addEventListener\('st:model-switch-applied', \(\) => document\.getElementById\('llm_fallback_field'\)\?\.blFallbackRender\?\.\(\)\);/);
    const labels = /const FALLBACK_LABELS = (\{[^}]*\});/.exec(source);
    assert.ok(labels, 'label map');
    const FALLBACK_LABELS = new Function(`return ${labels[1]}`)();
    const rowSrc = /row: (\(label, control\) => `[^`]*`)/.exec(source)?.[1];
    assert.ok(rowSrc, 'row');
    const row = new Function('FALLBACK_LABELS', `return ${rowSrc}`)(FALLBACK_LABELS);

    globalThis.window ??= { dispatchEvent() {}, addEventListener() {} };
    globalThis.Event ??= class { constructor(type) { this.type = type; } };
    const field = await import(pathToFileURL(path.join(root, 'src/addons/modelswitch/fallback-field.js')).href);
    const fallback = await import(pathToFileURL(path.join(root, 'src/addons/modelswitch/fallback.js')).href);
    const handlers = {};
    const host = { ownerDocument: { querySelectorAll: () => [], createElement: () => ({}), head: { append() {} } }, dataset: {}, addEventListener(type, fn) { handlers[type] = fn; }, querySelector: () => null, innerHTML: '' };
    const settings = { connection_mode: 'direct', llm_provider: 'claude', llm_model: 'claude-opus-5-5', fallback: { enabled: true, provider: 'deepseek', model: 'deepseek-v4-pro' } };
    const keys = JSON.stringify(Object.keys(settings));
    let saves = 0;
    field.mountFallbackField(host, { id: 'translator', settings: () => settings, sources: ['openai', 'custom', 'claude', 'cohere', 'makersuite', 'vertexai', 'openrouter', 'deepseek'], save: () => saves++, row });
    assert.match(host.innerHTML, /<span class="llmt-label">대신 쓸 공급자<\/span><select[^>]*data-bl-fb="provider"/, 'short label inside the card');
    assert.ok(!host.innerHTML.includes('<span class="llmt-label">검열당했을 때</span>'));
    assert.match(host.innerHTML, /<option value="deepseek" selected>/);
    assert.match(host.innerHTML, /data-bl-fb="model" value="deepseek-v4-pro"/);

    // 모델 전환 「번역 (검열되면)」 줄 = 같은 holder → 거기서 바꾼 값이 칸에 그대로 (다시 그림)
    const target = fallback.fallbackTarget({ id: 'translator-fallback', name: '번역', holder: () => settings, main: () => ({ source: settings.llm_provider, model: settings.llm_model }) });
    assert.deepEqual(target.read(), { source: 'deepseek', model: 'deepseek-v4-pro', url: '' });
    assert.notEqual(target.apply({ source: 'openrouter', model: 'some/model' }), false);
    host.blFallbackRender();
    assert.match(host.innerHTML, /<option value="openrouter" selected>/);
    assert.match(host.innerHTML, /data-bl-fb="model" value="some\/model"/);

    // 칸에서 고르면 같은 자리에 써서 모델 전환 줄이 읽는다
    handlers.change({ target: { dataset: { blFb: 'provider' }, value: 'openai' } });
    handlers.change({ target: { dataset: { blFb: 'model' }, value: 'gpt-x' } });
    assert.deepEqual(settings.fallback, { enabled: true, provider: 'openai', model: 'gpt-x' });
    assert.deepEqual(target.read(), { source: 'openai', model: 'gpt-x', url: '' });
    assert.ok(saves >= 2, 'saved');
    handlers.change({ target: { dataset: { blFb: 'provider' }, value: '' } });
    assert.deepEqual(settings.fallback, { enabled: false, provider: 'openai', model: 'gpt-x' }, '「안 함」 keeps provider · model, only enabled:false');
    assert.equal(JSON.stringify(Object.keys(settings)), keys, 'no new top-level setting keys');
    assert.deepEqual([settings.connection_mode, settings.llm_provider, settings.llm_model], ['direct', 'claude', 'claude-opus-5-5'], 'main model untouched');
});

await check('translator version 3.1.3 in manifest and drawer', () => {
    assert.equal(JSON.parse(read('src/addons/translator/manifest.json')).version, '3.1.3');
    assert.match(html, /<span class="llmt-version ext-version">v3\.1\.3<\/span>/);
});

console.log(`\ntranslator-fallback-card: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
