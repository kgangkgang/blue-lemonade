// 7.0.5 프롬프트 템플릿 카드 — 애드온을 켜 두기만 하고 확장을 설치하지 않았는데 「사용 중」으로 보이던 것 (네트워크 없음 · 가짜 fetch)
//   node tools/tests/prompt-template-card.mjs .
// 확인: ① 카드 머리 상태 글(설치 안 됨 · 도우미 없음 · 관리자 아님 · 꺼짐 · 사용 중 · 새로고침 대기 · git · 막 설치함) ② 카드 안 한 줄 · 「설치」 단추는 안쪽 단추와 같은
// install 길 ③ addons.js 배선(머리 바로 뒤 칸 · mountCard) ④ 채팅에 <% %> 가 글자로 보이면 세션에 한 번만 알림(설치됨 · 켜짐이면 안 알림)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/prompt-template');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + '\n' + (error.stack || error)); } }

const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const STUBS = {
    '../../settings.js': js("export const getSettings = () => ({ koUi: true, addons: { 'prompt-template': globalThis.__ptCardOn !== false } });"),
    '../../addon-files-check.js': js('export function verifyAddonCss() {}'),
    '../../settings-dialog.js': js('export function leaveSettingsDialog() {}'),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.dir; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').startsWith(R) && S[spec]) return { url: S[spec], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: STUBS, dir: pathToFileURL(dir).href } });
const M = await import(pathToFileURL(path.join(dir, 'index.js')).href);
const base = { helper: true, installed: false, scope: null, others: [], git: false, active: false, disabled: false, busy: false, message: '', done: '', error: '' };
const S = over => ({ ...base, ...over });
const V = { version: M.BUNDLED, display_name: 'Prompt Template' };

await test('켜 두고 설치 안 됨 → 「아직 설치 안 됨」 · <% %> 한 줄 · 설치 단추 (「사용 중」 아님)', () => {
    const c = M.cardStatus(S({}));
    assert.equal(c.title, '아직 설치 안 됨'); assert.equal(c.on, false); assert.equal(c.install, true);
    assert.match(c.hint, /카드의 <% %> 코드가 글자로 보이면 설치가 필요해요/);
});
await test('도우미 없음 → ZIP 설치 도우미가 필요하다고 · 단추는 같은 install 길(도우미 준비 창)', () => {
    const c = M.cardStatus(S({ helper: false }));
    assert.equal(c.title, '아직 설치 안 됨'); assert.equal(c.install, true); assert.match(c.hint, /ZIP 설치 도우미가 필요해요/);
});
await test('관리자 아님 → 설치 단추 없음 · 관리자 안내', () => {
    const c = M.cardStatus(S({ helper: 'denied' }));
    assert.equal(c.install, false); assert.match(c.hint, /서버 관리자 계정에서만/);
});
await test('설치됨 · 확장 관리에서 꺼짐 / 설치됨 · 켜짐 = 사용 중 / 새로고침 대기 / 막 설치함', () => {
    const off = M.cardStatus(S({ installed: V, scope: 'local', disabled: true }));
    assert.equal(off.title, '설치됨 · 확장 관리에서 꺼짐'); assert.equal(off.on, false); assert.match(off.hint, /확장 관리에서 켜 주세요/);
    const on = M.cardStatus(S({ installed: V, scope: 'local', active: true }));
    assert.equal(on.title, '사용 중'); assert.equal(on.on, true); assert.equal(on.hint, ''); assert.equal(on.install, false);
    assert.equal(M.cardStatus(S({ installed: V, scope: 'local' })).title, '설치됨 · 새로고침하면 켜져요');
    assert.equal(M.cardStatus(S({ installed: V, done: 'installed' })).title, '설치했어요 · 새로고침하면 켜져요');
    assert.equal(M.cardStatus(S({ installed: null })).title, '설치 상태 확인 중…');
});
await test('git 설치본 → 기존 안내 그대로 (상태 한 줄과 같은 글)', () => {
    const s = S({ installed: V, scope: 'local', git: true, active: true });
    const c = M.cardStatus(s);
    assert.equal(c.title, '사용 중'); assert.equal(c.hint, M.statusText(s)); assert.match(c.hint, /git 설치본/);
});
await test('카드 「설치」 단추는 안쪽 단추와 같은 act(\'install\') · addons.js 는 머리 바로 뒤 칸 + mountCard', () => {
    const src = read('src/addons/prompt-template/index.js');
    assert.match(src, /\[data-pt-card-install\]'\)\?\.addEventListener\('click', \(\) => act\('install'\)\)/);
    assert.match(src, /export function mountCard\(host\)/);
    const addons = read('src/addons.js');
    assert.match(addons, /<\/header>\$\{ptCard\}`/);
    assert.match(addons, /const ptCard=id==='prompt-template'&&on&&running\.has\(id\)&&!needsReload&&addonsEnabled\(s\)\?'<div class="blpt-card" data-pt-card><\/div>':''/);
    assert.match(addons, /\[data-pt-card\]'\)\.forEach\(async host=>\{try\{\(await import\('\.\/addons\/prompt-template\/index\.js'\)\)\.mountCard\(host\)/);
});
await test('채팅에 <% %> 가 글자로 보이면 세션에 한 번만 알림 · 누르면 창 · 설치 · 켜짐이면 안 알림', async () => {
    assert.ok(M.RAW_TEMPLATE.test('앞 <% if (x) { %> 뒤')); assert.ok(!M.RAW_TEMPLATE.test('그냥 100% 맞아요'));
    globalThis.fetch = async () => ({ status: 404, ok: false, json: async () => null });   // 확장 없음 · 도우미 없음
    const shown = []; const toast = { info: (text, title, opts) => shown.push({ text, title, opts }) };
    assert.equal(await M.noticeRawTemplate('평범한 답', { toast }), false);
    assert.equal(await M.noticeRawTemplate('<% setvar("a", 1) %>', { toast }), true);
    assert.equal(shown.length, 1); assert.match(shown[0].text, /설치해 주세요/); assert.equal(typeof shown[0].opts.onclick, 'function');
    assert.equal(await M.noticeRawTemplate('<% 또 %>', { toast }), false, '세션에 한 번만');
    assert.equal(shown.length, 1);
    assert.match(read('src/addons/prompt-template/index.js'), /if \(state\.installed && !state\.disabled\) return false;/);
});
await test('CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/prompt-template-card\.mjs \./));

console.log(`\n${passed} PASS · ${failed} FAIL`);
if (failed) process.exit(1);
