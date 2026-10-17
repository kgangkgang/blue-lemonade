// 프롬프트 템플릿 (내장 설치형, 원본 zonde306/ST-Prompt-Template AGPL-3.0 무수정) — 네트워크 없음 · 가짜 fetch
//   node tools/tests/prompt-template.mjs .
// 확인하는 것:
//   1) 담긴 ZIP = SOURCE.json(파일별 SHA-256 · 소스맵 뺌 · 맨 위 폴더 ST-Prompt-Template) = index.js 상수(판 · 커밋 · ZIP 해시) · LICENSE 가 원본과 같음
//   2) 한국어 표 키 = 원본 locales/zh-cn.json 키 (빠진 것 · 남는 것 없음) · 값은 한국어 · host.js 가 data-i18n 규칙대로 적고 머리글에 판을 단다
//   3) 상태 한 줄 · 단추 셋 규칙 (설치 안 됨 / 업데이트 / 같음 / 새 판 / git 설치본 / 도우미 없음 / 관리자 아님 / 새로고침 대기)
//   4) 설치: 도우미에 /inspect(ZIP 그대로) → /preview(폴더 ST-Prompt-Template) → /install(표) · 같은 확장이 다른 폴더에 있으면 멈춤 · git 설치본은 덮지 않음
//   5) 삭제: /remove-preview → 확인 → /remove · 확인 취소면 보내지 않음
//   6) 배선: 애드온 목록 · 시작 · 세부 설정 · 판 표 · 설정 기본값 · 검색 · 출처 창 · 고지 · README · CI · 공개 ZIP 목록 · 코어 index.js 한 줄 · CSS 판
//   7) 확장 순서 1.2.2: 창 구성이 바뀌면 열린 목록을 다시 그린다 (늦게 붙는 확장) · 1.2.3: 다시 그린 뒤 초점 되돌리기
//   8) 7.0.1: git 확인 실패(500)는 막음 · 전역 설치본은 안내만 · 다른 폴더 사본은 두 벌 경고 · http(subtle 없음)도 크기 · 순수 JS SHA-256 · 새 판 · 같은 판은 확인 뒤에만 · perf 판 한 쌍
// 지어낸 이름만 쓴다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/prompt-template');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + '\n' + (error.stack || error)); } }

const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ptTest = { css: [] };
const STUBS = {
    '../../settings.js': js('export const getSettings = () => ({ koUi: true });'),
    '../../addon-files-check.js': js('export function verifyAddonCss(o) { globalThis.__ptTest.css.push(o); }'),
    '../../settings-dialog.js': js('export function leaveSettingsDialog() {}'),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.dir; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').startsWith(R) && S[spec]) return { url: S[spec], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: STUBS, dir: pathToFileURL(dir).href } });

const bundle = await import(pathToFileURL(path.join(root, 'tools/prompt-template-bundle.mjs')));
const source = JSON.parse(read('src/addons/prompt-template/SOURCE.json'));

await test('담긴 ZIP = SOURCE.json · 소스맵 없음 · 맨 위 폴더 하나 · LICENSE 같음 (bundle --check)', () => {
    const r = bundle.check(root);
    assert.equal(r.files, source.fileCount);
    const entries = bundle.readZip(fs.readFileSync(path.join(dir, source.zip)));
    assert.ok(entries.every(e => e.name.startsWith('ST-Prompt-Template/') && !e.name.endsWith('/')));
    assert.ok(!entries.some(e => /\.map$|(^|\/)\.git\//.test(e.name)));
    for (const need of ['manifest.json', 'dist/index.js', 'settings.html', 'locales/zh-cn.json', 'LICENSE', 'src/index.ts', 'webpack.config.js', 'package-lock.json'])
        assert.ok(entries.some(e => e.name === 'ST-Prompt-Template/' + need), '대응 소스 · 실행 파일: ' + need);
    assert.equal(source.upstream, 'https://github.com/zonde306/ST-Prompt-Template');
    assert.match(source.commit, /^[0-9a-f]{40}$/);
    assert.match(fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8'), /GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3/);
});

const KO = (await import(pathToFileURL(path.join(dir, 'ko-kr.js')))).KO;
const host = await import(pathToFileURL(path.join(dir, 'host.js')));
const mod = await import(pathToFileURL(path.join(dir, 'index.js')));

await test('index.js 상수 = SOURCE.json (판 · 커밋 · ZIP 해시) · CSS 판 = VERSION · 판 자리 10 아님', () => {
    assert.equal(mod.BUNDLED, source.version);
    assert.equal(mod.COMMIT, source.commit);
    assert.equal(mod.ZIP_SHA256, source.zipSha256);
    assert.equal(sha(fs.readFileSync(path.join(dir, source.zip))), mod.ZIP_SHA256);
    assert.equal(mod.FOLDER, 'ST-Prompt-Template');
    const css = read('src/addons/prompt-template/style.css');
    assert.deepEqual([...css.matchAll(/--blpt-css-version:\s*'([^']+)'/g)].map(m => m[1]), [mod.VERSION]);
    assert.match(mod.VERSION, /^\d+\.\d+\.[0-9]$/);
    const notice = read('src/addons/prompt-template/NOTICE.md');
    assert.ok(notice.includes(source.commit) && notice.includes('zonde306') && /AGPL/.test(notice) && notice.includes(source.version));
});

await test('한국어 표 키 = 원본 zh-cn.json 키 · 값은 한국어 (h32/h64 만 그대로)', () => {
    const entries = bundle.readZip(fs.readFileSync(path.join(dir, source.zip)));
    const zh = JSON.parse(entries.find(e => e.name === 'ST-Prompt-Template/locales/zh-cn.json').data.toString('utf8'));
    assert.deepEqual(Object.keys(KO).sort(), Object.keys(zh).sort());
    const latin = Object.entries(KO).filter(([, v]) => !/[가-힣]/.test(v)).map(([k]) => k);
    assert.deepEqual(latin.sort(), ['h32ToString', 'h64ToString']);
    assert.ok(Object.values(KO).every(v => typeof v === 'string' && v.trim() && v.length <= 120));
    // 원본 settings.html 의 data-i18n 키가 모두 표에 있다
    const html = entries.find(e => e.name === 'ST-Prompt-Template/settings.html').data.toString('utf8');
    const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].flatMap(m => m[1].split(';')).map(k => k.replace(/^\[[^\]]+\]/, ''));
    assert.deepEqual([...new Set(keys.filter(k => !(k in KO)))], []);
});

// 작은 가짜 요소
class El {
    constructor(attrs = {}, text = '') { this.attrs = { ...attrs }; this.textContent = text; this.dataset = {}; this.kids = []; }
    getAttribute(k) { return this.attrs[k] ?? null; } setAttribute(k, v) { this.attrs[k] = String(v); }
    querySelectorAll(sel) { return sel === '[data-i18n]' ? this.kids.filter(k => k.attrs['data-i18n']) : []; }
    querySelector() { return this.head ?? null; }
}
await test('host.js: data-i18n 규칙("[title]키;키")대로 적고 · 표에 없는 키는 그대로 · 머리글 판 알약 · ko-kr 일 때만 표를 더함', async () => {
    const a = new El({ 'data-i18n': 'PT Enable' }, 'Enable extension');
    const b = new El({ 'data-i18n': '[title]Global switch', title: 'Global switch' }, '');
    const c = new El({ 'data-i18n': 'Something unknown' }, 'Keep me');
    const panel = new El(); panel.kids = [a, b, c]; panel.head = new El();
    assert.equal(host.applyKorean(panel), 2);
    assert.equal(a.textContent, '확장 켜기'); assert.equal(b.attrs.title, KO['Global switch']); assert.equal(c.textContent, 'Keep me');
    assert.equal(host.applyKorean(null), -1);
    assert.equal(host.markVersion(panel, '1.17.9'), true); assert.equal(panel.head.dataset.blVersion, 'v1.17.9');
    assert.equal(host.markVersion(panel, 'x"><b>'), false);
    // 시작: 블록이 나타나면 한 번 적고 판을 단다 (가짜 문서 · 타이머 바로 실행)
    const added = []; const live = new El(); live.kids = [new El({ 'data-i18n': 'Prompt template settings' }, 'Prompt template settings')]; live.head = new El();
    const doc = { getElementById: id => id === host.PANEL ? live : null };
    const timers = [];
    const result = host.startPromptTemplateHost({ ctx: { getCurrentLocale: () => 'ko-kr', addLocaleData: (l, t) => added.push([l, Object.keys(t).length]) }, doc, fetcher: async () => ({ ok: true, json: async () => ({ version: '1.17.9' }) }), schedule: fn => timers.push(fn) });
    for (const fn of timers) fn();
    await new Promise(r => setTimeout(r, 20));
    assert.deepEqual(added, []);   // 6.9.9 검토: 전역 언어 데이터에는 넣지 않는다 (원본 편집기 label 안 칸이 지워지고 일반 낱말이 다른 화면을 바꿈) — 설정 블록만
    assert.equal(live.kids[0].textContent, '프롬프트 템플릿');
    assert.equal(live.head.dataset.blVersion, 'v1.17.9');
    assert.equal(result.done, true);
    assert.equal(host.startPromptTemplateHost({ doc }), null, '한 번만');
});

const S = mod.state;
const reset = (over = {}) => Object.assign(S, { helper: true, installed: false, scope: 'local', others: [], git: false, active: false, disabled: false, busy: false, message: '', done: '', error: '' }, over);
await test('상태 한 줄 · 단추 셋 규칙', () => {
    assert.equal(mod.compareVersions('1.17.9', '1.17.10'), -1); assert.equal(mod.compareVersions('1.18', '1.17.9'), 1); assert.equal(mod.compareVersions('1.17.9', '1.17.9'), 0);
    const acts = () => mod.actions().map(b => `${b.act}:${b.disabled ? 0 : 1}`).join(' ');
    reset(); assert.equal(mod.statusText(), '설치 안 됨 · 담긴 판 1.17.9'); assert.equal(acts(), 'install:1 open:0 remove:0'); assert.equal(mod.actions()[0].label, '설치');
    reset({ installed: { version: '1.16.2' }, active: true }); assert.equal(mod.statusText(), '1.16.2 설치됨 → 1.17.9 업데이트 가능'); assert.equal(mod.actions()[0].label, '업데이트'); assert.equal(acts(), 'install:1 open:1 remove:1');
    reset({ installed: { version: '1.17.9' }, active: true }); assert.equal(mod.statusText(), '1.17.9 설치됨 · 담긴 판과 같음'); assert.equal(mod.actions()[0].label, '다시 설치');
    reset({ installed: { version: '1.18.0' }, active: false }); assert.match(mod.statusText(), /담긴 판\(1\.17\.9\)보다 새 판 · 새로고침 대기/); assert.equal(acts(), 'install:1 open:0 remove:1');
    reset({ installed: { version: '1.17.9' }, active: true, disabled: true }); assert.match(mod.statusText(), /확장 관리에서 꺼짐/);
    reset({ installed: { version: '1.17.9' }, active: true, git: true }); assert.match(mod.statusText(), /git 설치본/); assert.equal(acts(), 'install:0 open:1 remove:0');
    reset({ helper: false }); assert.match(mod.statusText(), /서버 도우미 필요/); assert.equal(mod.actions()[0].act, 'install'); assert.equal(mod.actions()[0].disabled, false);
    reset({ helper: 'denied' }); assert.match(mod.statusText(), /서버 관리자 계정에서만/); assert.equal(acts(), 'install:0 open:0 remove:0');
    reset({ done: 'installed' }); assert.match(mod.statusText(), /설치했어요/); assert.equal(mod.actions()[0].act, 'reload');
    reset({ error: '서버 연결이 끊겼어요.' }); assert.equal(mod.statusText(), '서버 연결이 끊겼어요.');
    assert.ok(mod.actions().every(b => b.label && b.icon.startsWith('fa-')));
    assert.ok(!/\stitle=/.test(read('src/addons/prompt-template/index.js')), '툴팁 없음');
});

// 가짜 fetch: 담긴 ZIP(file:) · 실리태번 manifest · /api/extensions/version · 도우미 길
const calls = [];
let installedManifest = null, gitHash = '', otherFolder = null, versionStatus = 200, ourType = 'local', extraEntries = [], extraManifests = {};
const versionAsked = [];
globalThis.SillyTavern = { getContext: () => ({ getRequestHeaders: () => ({ 'X-CSRF-Token': 't' }), extensionSettings: { disabledExtensions: [] } }) };
globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('file:')) { const bytes = fs.readFileSync(new URL(u)); return new Response(bytes); }
    calls.push({ u, method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'Content-Type': 'application/json' } });
    if (u.endsWith('/ST-Prompt-Template/manifest.json')) return installedManifest ? json(200, installedManifest) : new Response('', { status: 404 });
    if (u === '/api/extensions/version') { versionAsked.push(JSON.parse(init.body)); return versionStatus === 200 ? json(200, { currentCommitHash: gitHash }) : new Response('Internal Server Error', { status: versionStatus }); }
    if (u === '/api/extensions/discover') return json(200, [{ type: 'system', name: 'regex' }, { type: 'local', name: 'third-party/blue-lemonade' }, ...(installedManifest ? [{ type: ourType, name: 'third-party/ST-Prompt-Template' }] : []), ...extraEntries]);
    for (const [name, m] of Object.entries(extraManifests)) if (u === `/scripts/extensions/${name}/manifest.json`) return json(200, m);
    if (u.endsWith('/status')) return json(200, { version: '1.1.0' });
    if (u.includes('/inspect?')) return json(200, { token: 'tok-1', manifest: { display_name: source.display_name, version: source.version, homePage: source.upstream }, installed: otherFolder ? [{ folder: otherFolder, display_name: source.display_name, homePage: source.upstream }] : [] });
    if (u.endsWith('/preview')) return json(200, { folder: 'ST-Prompt-Template' });
    if (u.endsWith('/install')) return json(200, { folder: 'ST-Prompt-Template', reload: true });
    if (u.endsWith('/remove-preview')) return json(200, { token: 'tok-r', folder: 'ST-Prompt-Template', manifest: { version: '1.17.9' }, files: 149 });
    if (u.endsWith('/remove')) return json(200, { folder: 'ST-Prompt-Template', removed: true });
    return new Response('', { status: 500 });
};

await test('설치: /inspect(ZIP 그대로 · application/zip · X-BL-Zip) → /preview(ST-Prompt-Template) → /install(표) · 상태 새로고침 대기', async () => {
    reset({ helper: null, installed: null }); calls.length = 0; installedManifest = null;
    await mod.refresh();
    assert.equal(S.installed, false); assert.equal(S.helper, true);
    calls.length = 0;
    const result = await mod.install();
    assert.ok(result, S.error);
    const route = calls.map(c => c.u.replace('/api/plugins/blue-lemonade-zip', ''));
    assert.deepEqual(route, ['/inspect?name=ST-Prompt-Template.zip', '/preview', '/install']);
    assert.equal(calls[0].headers['Content-Type'], 'application/zip'); assert.equal(calls[0].headers['X-BL-Zip'], '1'); assert.equal(calls[0].headers['X-CSRF-Token'], 't');
    assert.equal(sha(Buffer.from(await calls[0].body.arrayBuffer())), source.zipSha256, 'ZIP 바이트 그대로');
    assert.deepEqual(JSON.parse(calls[1].body), { token: 'tok-1', folder: 'ST-Prompt-Template' });
    assert.deepEqual(JSON.parse(calls[2].body), { token: 'tok-1' });
    assert.equal(S.done, 'installed'); assert.equal(S.busy, false);
});
await test('설치: 같은 확장이 다른 폴더에 있으면 /preview 전에 멈춤 · git 설치본이면 아무것도 보내지 않음', async () => {
    reset(); calls.length = 0; otherFolder = 'prompt-template-old';
    assert.equal(await mod.install(), false);
    assert.match(S.error, /다른 폴더\(prompt-template-old\)/);
    assert.ok(!calls.some(c => c.u.endsWith('/preview') || c.u.endsWith('/install')));
    otherFolder = null;
    reset({ helper: null, installed: null }); installedManifest = { version: '1.17.9', display_name: source.display_name }; gitHash = 'abc123';
    await mod.refresh();
    assert.equal(S.git, true);
    calls.length = 0;
    assert.equal(await mod.install(), false); assert.equal(await mod.remove({ confirm: async () => true }), false);
    assert.equal(calls.length, 0);
    gitHash = '';
});
await test('삭제: /remove-preview → 확인 → /remove · 취소면 /remove 를 보내지 않음', async () => {
    reset({ installed: { version: '1.17.9' }, active: true }); calls.length = 0;
    assert.equal(await mod.remove({ confirm: async () => false }), false);
    assert.deepEqual(calls.map(c => c.u.split('/').at(-1)), ['remove-preview']);
    reset({ installed: { version: '1.17.9' }, active: true }); calls.length = 0;
    const seen = [];
    assert.ok(await mod.remove({ confirm: async plan => { seen.push(plan.files); return true; } }));
    assert.deepEqual(calls.map(c => c.u.split('/').at(-1)), ['remove-preview', 'remove']);
    assert.deepEqual(JSON.parse(calls[0].body), { folder: 'ST-Prompt-Template' }); assert.deepEqual(JSON.parse(calls[1].body), { token: 'tok-r' });
    assert.deepEqual(seen, [149]); assert.equal(S.done, 'removed'); assert.equal(S.installed, false);
});

await test('배선: 애드온 목록 · 시작 · 세부 설정 · 판 표 · 기본값 · 검색 · 출처 · 고지 · README · CI · 공개 ZIP 목록 · 코어 한 줄', () => {
    const addons = read('src/addons.js');
    assert.match(addons, /'prompt-template':'프롬프트 템플릿'/);
    assert.match(addons, /'prompt-template':'fa-code'/);
    assert.match(addons, /id==='prompt-template'\)\{\n\s+module=await import\('\.\/addons\/prompt-template\/index\.js'\);/);
    assert.equal((addons.match(/'prompt','prompt-template','customstyle'/g) || []).length, 2, '시작 목록 · 새로고침 대기 목록');
    assert.match(addons, /addonOpen==='prompt-template'\)\{\(await import\('\.\/addons\/prompt-template\/index\.js'\)\)\.openPanel\(\)/);
    assert.match(addons, /id==='prompt-template'\?import\('\.\/addons\/prompt-template\/index\.js'\)/);
    assert.match(addons, /instructions\['prompt-template'\]=/);
    assert.match(addons, /credits\['prompt-template'\]=\['zonde306 · ST-Prompt-Template \(AGPL-3\.0\)','https:\/\/github\.com\/zonde306\/ST-Prompt-Template'\]/);
    assert.match(read('src/settings.js'), /mermaid: false, 'prompt-template': false, conflicts: false/);
    assert.match(read('src/addon-versions.js'), /'prompt-template': \['프롬프트 템플릿', 'prompt-template\/index\.js'\]/);
    assert.match(read('src/panel.js'), /\['prompt-template','프롬프트 템플릿'\]/);
    assert.match(read('src/settings-search.js'), /\['extensions','prompt-template','프롬프트 템플릿','EJS 템플릿/);
    assert.match(read('src/settings-labels.js'), /'addons\.prompt-template':'확장: 프롬프트 템플릿'/);
    assert.match(read('src/credits.js'), /프롬프트 템플릿 · ST-Prompt-Template/);
    assert.match(read('index.js'), /import\('\.\/src\/addons\/prompt-template\/host\.js'\)\.then\(m => m\.startPromptTemplateHost\(\{ koUi: settings\.koUi \}\)\)/);
    const notices = read('THIRD-PARTY-NOTICES.md');
    assert.ok(notices.includes('## 프롬프트 템플릿 (ST-Prompt-Template)') && notices.includes(source.commit) && notices.includes('src/addons/prompt-template/LICENSE'));
    assert.match(read('README.md'), /zonde306 \/ ST-Prompt-Template\]\(https:\/\/github\.com\/zonde306\/ST-Prompt-Template\) \(AGPL-3\.0/);
    assert.match(read('.github/workflows/release-check.yml'), /\n\s+node tools\/tests\/prompt-template\.mjs \.\n/);
    const gate = read('tools/release_gate.py');
    assert.match(gate, /for name in \('ST-Prompt-Template\.zip', 'SOURCE\.json', 'LICENSE', 'NOTICE\.md'\):/);
    assert.match(gate, /names\.append\('tools\/prompt-template-bundle\.mjs'\)/);
});
await test('머리글 CSS: 아이콘 · 판 알약(data-bl-version) · 되돌리기 아이콘은 뒤 — css/82 와 style.css', () => {
    const css = read('css/82-prompt-template.css');
    assert.match(css, /#prompt_template_settings > \.inline-drawer > \.inline-drawer-header > b::before \{\n\s+content: "\\f121";/);
    assert.match(css, /b\[data-bl-version\]::after \{\n\s+content: attr\(data-bl-version\);/);
    assert.match(css, /> #pt_reset \{\n\s+order: 3;/);
    assert.ok(read('style.css').includes('attr(data-bl-version)'), 'style.css 를 다시 만들었다 (node tools/build-css.cjs)');
});
await test('확장 순서 1.2.2: 창 구성이 바뀌면(늦게 붙는 확장) 열린 목록을 다시 그린다', () => {
    const order = read('src/addons/order/order.js'), panel = read('src/addons/order/panel.js');
    assert.match(order, /export function onPanelsChange\(fn\)/);
    assert.match(order, /const panels = scan\(\);\n\s+if \(!panels\.length\) return;\n\s+notifyPanels\(panels\);/);
    assert.match(panel, /\nonPanelsChange\(renderList\);\n/);
    assert.match(read('src/addons/order/state.js'), /export const VERSION = '1\.2\.3';/);
    assert.match(read('src/addons/order/style.css'), /--po-css-version: "1\.2\.3";/);
});

await test('7.0.1 git 확인 실패: /version 이 500(오프라인 git fetch)이면 「모름」 → 설치 · 삭제 막고 한 줄 안내 · 도우미에 아무것도 안 보냄', async () => {
    reset({ helper: null, installed: null }); installedManifest = { version: '1.16.2', display_name: source.display_name }; versionStatus = 500; versionAsked.length = 0;
    await mod.refresh();
    assert.equal(S.git, 'unknown'); assert.equal(S.scope, 'local');
    assert.match(mod.statusText(), /git 설치본인지 확인하지 못했어요/);
    assert.deepEqual(mod.actions().map(b => b.disabled), [true, true, true].map((v, i) => i === 1 ? !S.active : v));
    calls.length = 0;
    assert.equal(await mod.install({ confirm: async () => true }), false); assert.equal(await mod.remove({ confirm: async () => true }), false);
    assert.ok(!calls.some(c => c.u.includes('blue-lemonade-zip')), JSON.stringify(calls.map(c => c.u)));
    versionStatus = 404; assert.equal(await mod.isGit(false), false, '그 자리에 폴더 없음 = git 아님');
    versionStatus = 200; gitHash = ''; assert.equal(await mod.isGit(false), false); gitHash = 'abc'; assert.equal(await mod.isGit(false), true); gitHash = '';
});
await test('7.0.1 전역 설치본: discover 가 global 이면 「전역 설치본 — 서버 관리자에게」 · git 확인도 global:true · 단추 막음', async () => {
    reset({ helper: null, installed: null }); installedManifest = { version: '1.17.9', display_name: source.display_name }; ourType = 'global'; versionAsked.length = 0;
    await mod.refresh();
    assert.equal(S.scope, 'global'); assert.deepEqual(versionAsked.at(-1), { extensionName: 'ST-Prompt-Template', global: true });
    assert.match(mod.statusText(), /1\.17\.9 전역 설치본 — 업데이트 · 삭제는 서버 관리자에게/);
    assert.equal(mod.actions()[0].disabled, true); assert.equal(mod.actions()[2].disabled, true);
    calls.length = 0; assert.equal(await mod.install({ confirm: async () => true }), false); assert.ok(!calls.some(c => c.u.includes('blue-lemonade-zip')));
    ourType = 'local';
});
await test('7.0.1 다른 이름 폴더에 같은 확장(전역 · 내 계정): 두 벌 실림 경고 · 설치 막음 (설치 안 됐어도)', async () => {
    reset({ helper: null, installed: null }); installedManifest = null;
    extraEntries = [{ type: 'global', name: 'third-party/st-prompt-template-main' }, { type: 'local', name: 'third-party/word-tool' }];
    extraManifests = { 'third-party/st-prompt-template-main': { display_name: 'Prompt Template/提示词模板', version: '1.17.0', homePage: 'https://github.com/zonde306/ST-Prompt-Template' }, 'third-party/word-tool': { display_name: 'Word Tool', version: '1.0.0', homePage: 'https://github.com/someone/word-tool' } };
    await mod.refresh();
    assert.deepEqual(S.others, [{ name: 'third-party/st-prompt-template-main', type: 'global' }]);
    assert.match(mod.statusText(), /다른 폴더에도 있어요\(st-prompt-template-main · 전역\) — 두 벌 실려요/);
    assert.equal(mod.actions()[0].disabled, true);
    calls.length = 0; assert.equal(await mod.install(), false); assert.ok(!calls.some(c => c.u.includes('blue-lemonade-zip')));
    extraEntries = []; extraManifests = {};
    await mod.refresh(); assert.deepEqual(S.others, []); assert.equal(mod.actions()[0].disabled, false);
});
await test('7.0.1 http(crypto.subtle 없음): 순수 JS SHA-256 이 node 와 같고 · 담긴 ZIP 크기 · 해시를 본다 · 한 바이트 다르면 거절', async () => {
    const { sha256Hex } = await import(pathToFileURL(path.join(dir, 'sha256.js')));
    for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 1000, (1 << 20) + 37]) {
        const bytes = new Uint8Array(n).map((_, i) => (i * 131 + n) & 255);
        assert.equal(await sha256Hex(bytes), sha(bytes), 'n=' + n);
    }
    assert.equal(await sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const zip = fs.readFileSync(path.join(dir, source.zip));
    assert.equal(mod.ZIP_BYTES, source.zipBytes);
    // http 흉내: 원형의 subtle 을 자기 속성 undefined 로 가린다 (끝나면 걷어 낸다)
    Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: undefined });
    assert.equal(globalThis.crypto.subtle, undefined);
    try {
        assert.equal(await mod.verifyZip(new Blob([zip])), true);
        const bad = Buffer.from(zip); bad[1000] ^= 1;
        assert.equal(await mod.verifyZip(new Blob([bad])), false);
        assert.equal(await mod.verifyZip(new Blob([zip.subarray(0, zip.length - 1)])), false, '덜 받힌 파일');
        // 설치 흐름도 subtle 없이 끝까지
        reset({ installed: false, scope: null }); installedManifest = null; calls.length = 0;
        assert.ok(await mod.install(), S.error);
        assert.deepEqual(calls.map(c => c.u.split('/').at(-1).split('?')[0]), ['inspect', 'preview', 'install']);
    } finally { delete globalThis.crypto.subtle; assert.ok(globalThis.crypto.subtle); }
});
await test('7.0.1 새 판 · 같은 판 재설치는 확인 창 뒤에만 · 옛 판 업데이트는 바로 · 취소면 아무것도 안 보냄', async () => {
    const asked = [];
    const run = async (version, answer) => { reset({ installed: { version }, active: true, done: '' }); calls.length = 0; asked.length = 0; const r = await mod.install({ confirm: async i => { asked.push(i.version); return answer; } }); return { r, sent: calls.filter(c => c.u.includes('blue-lemonade-zip')).length }; };
    let x = await run('1.18.0', false); assert.deepEqual(asked, ['1.18.0']); assert.equal(x.r, false); assert.equal(x.sent, 0);
    x = await run('1.18.0', true); assert.deepEqual(asked, ['1.18.0']); assert.ok(x.r); assert.equal(x.sent, 3);
    x = await run('1.17.9', false); assert.deepEqual(asked, ['1.17.9']); assert.equal(x.sent, 0);
    x = await run('1.16.2', false); assert.deepEqual(asked, [], '업데이트는 묻지 않음'); assert.ok(x.r); assert.equal(x.sent, 3);
    const code = read('src/addons/prompt-template/index.js');
    assert.match(code, /async function confirmReplace\(installed\)[\s\S]*?ZIP 설치 창의 백업 목록[\s\S]*?callGenericPopup\(/);
});
await test('7.0.1 판: 애드온 1.0.1(JS = CSS) · perf 2.2.7(hub.js SUITE_VERSION = --pa-hub-css-version)', () => {
    assert.equal(mod.VERSION, '1.0.1');
    assert.match(read('src/addons/perf/hub.js'), /export const SUITE_VERSION = '2\.2\.7';/);
    assert.deepEqual([...read('src/addons/perf/style.css').matchAll(/--pa-hub-css-version:\s*"([^"]+)"/g)].map(m => m[1]), ['2.2.7']);
});
await test('확장 순서 1.2.3: 다시 그리기 전 초점(줄 key · 동작) 기억 → 그린 뒤 같은 칸 · 꺼졌으면 같은 줄 첫 칸', () => {
    const panel = read('src/addons/order/panel.js');
    assert.match(panel, /const focus=focusedControl\(list\);\n\s+list\.innerHTML = [^\n]+\n\s+list\.scrollTop=previousScroll;\n\s+restoreFocus\(list,focus\);/);
    assert.match(panel, /export function focusedControl\(list, active = globalThis\.document\?\.activeElement\)/);
    assert.match(panel, /const target=want&&!want\.disabled\?want:\[\.\.\.row\.querySelectorAll\('button,input'\)\]\.find\(el=>!el\.disabled\);/);
});

console.log(`\n${passed} PASS · ${failed} FAIL`);
if (failed) process.exitCode = 1;
