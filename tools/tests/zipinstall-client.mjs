// ZIP 설치 화면 — 서버 도우미에 보내는 요청 모양 (src/addons/zipinstall/index.js)
//   node tools/tests/zipinstall-client.mjs <테마 루트>
// 테마의 settings.js · addon-files-check.js 는 data: 스텁 (usage-mode.js 는 진짜). 문서는 data-* 속성만 읽어 단추를 만드는 작은 가짜,
// fetch 는 부른 것을 적고 정해 둔 답을 주는 가짜. 네트워크 없음.
// 확인하는 것:
//   1) 연결 확인: GET /status · X-BL-Zip 머리 + 실리태번 요청 머리(CSRF) · 404/403/판 다름/정상일 때 상태
//   2) ZIP 고르기: .zip 아니거나 64MB 넘으면 서버로 안 보냄 · 보낼 때는 POST /inspect?name=<인코딩> · Content-Type application/zip · 본문은 파일 그대로
//   3) 추천 폴더가 하나면 바로 preview, 없으면 새 폴더(추천 이름), 여럿이면 고를 때까지 기다림 · 새 폴더 이름은 앞뒤 공백 뗌
//   4) 설치 · 삭제 · 복원 요청 본문은 표(token)/폴더/백업 id 만 · 일하는 동안 다시 눌러도 한 번만 보냄
//   5) 오류 문구 · 화면이 기대하는 도우미 판 = 서버 판 · JS/CSS 판 · 요술봉 메뉴 켜고 끄기(addonUI.zipinstallMenu)
// 지어낸 확장 이름만 쓴다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/zipinstall');
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__zipClientTest = { settings: { enabled: true, usageMode: 'both', addons: { zipinstall: true }, addonUI: {} }, css: [] };
const ST = {
    '../../settings.js': js('export const getSettings = () => globalThis.__zipClientTest.settings;'),
    '../../addon-files-check.js': js('export function verifyAddonCss(o) { globalThis.__zipClientTest.css.push(o); }'),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.dir; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').startsWith(R) && S[spec]) return { url: S[spec], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, dir: pathToFileURL(dir).href } });

// ── 작은 가짜 문서: innerHTML 의 data-* 붙은 태그만 자식으로 만든다
class El {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.attrs = {}; this.dataset = {}; this.parent = null; this.isConnected = true; this.html = ''; }
    set innerHTML(html) {
        this.html = html;
        for (const c of this.children) c.isConnected = false;
        this.children = [];
        for (const [, tag, attrText] of html.matchAll(/<([a-zA-Z][\w-]*)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*\/?>/g)) {
            if (!/\sdata-/.test(attrText)) continue;
            const el = new El(tag);
            for (const [, name, value] of attrText.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
                el.attrs[name] = value ?? '';
                if (name.startsWith('data-')) el.dataset[name.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = value ?? '';
            }
            el.parent = this;
            this.children.push(el);
        }
    }
    get innerHTML() { return this.html; }
    append(...nodes) { for (const n of nodes) { n.parent = this; n.isConnected = true; this.children.push(n); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.isConnected = false; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    fire(type, extra = {}) { for (const fn of this.listeners[type] || []) fn({ target: this, preventDefault() {}, stopPropagation() {}, ...extra }); }
    querySelectorAll(sel) {
        const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
        if (!m) return [];
        return this.children.filter(c => c.attrs[m[1]] !== undefined && (m[2] === undefined || c.attrs[m[1]] === m[2]));
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
    closest() { return null; }
    focus() {}
    click() { this.fire('click'); }
}
const wand = new El('div');
globalThis.document = {
    activeElement: null, body: new El('body'),
    createElement: tag => new El(tag),
    getElementById: id => (id === 'data_bank_wand_container' ? wand : wand.children.find(c => c.id === id) ?? null),
};
let reloads = 0;
globalThis.location = { reload: () => { reloads++; } };
globalThis.SillyTavern = { getContext: () => ({ getRequestHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-test' }), callGenericPopup: async () => null, POPUP_TYPE: { TEXT: 1 } }) };

// ── 가짜 fetch: 부른 것을 적고 serve(경로) 의 답을 준다 (Promise 를 주면 그동안 기다린다)
const API = '/api/plugins/blue-lemonade-zip';
let calls = [], serve = () => ({ status: 500, body: {} });
globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method, headers: { ...init.headers }, body: init.body });
    const answer = await serve(url.slice(API.length).split('?')[0], init);
    if (answer === 'offline') throw new TypeError('Failed to fetch');
    return new Response(answer.raw ?? JSON.stringify(answer.body ?? null), { status: answer.status ?? 200, headers: { 'Content-Type': answer.raw ? 'text/html' : 'application/json' } });
};
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setImmediate(r)); };
const status = el => /class="blzi-status"[^>]*>([^<]*)</.exec(el.innerHTML)?.[1] ?? '';
const button = (el, action) => el.querySelector(`[data-action="${action}"]`);
const json = call => JSON.parse(call.body);

const Z = await import(pathToFileURL(path.join(dir, 'index.js')).href);
const server = await import(pathToFileURL(path.join(root, 'server-plugin/blue-lemonade-zip/index.mjs')).href);
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

const host = new El('section');
let view = null;
const PLAN = (extra = {}) => ({ token: 'plan-1', manifest: { display_name: 'Pebble Notes', version: '1.1.0' }, count: 3, bytes: 2048, suggested: 'pebble-notes', matches: [], installed: [{ folder: 'pebble', display_name: 'Pebble Notes' }, { folder: 'quill', display_name: 'Quill Pad' }], ...extra });
const PREVIEW = { folder: 'pebble', current: { display_name: 'Pebble Notes', version: '1.0.0' }, incoming: { display_name: 'Pebble Notes', version: '1.1.0' }, files: 3, replaced: 2, kept: 4, backupBytes: 4096 };
const pick = async file => { view.querySelector('[data-file]').fire('change', { target: { files: [file] } }); await flush(); };

await test('연결 확인: GET /status · X-BL-Zip + 실리태번 요청 머리 · 404 → 준비 안내 · 403 → 막힘 · 판 다름 → 업데이트 안내 · 맞으면 준비됨', async () => {
    serve = () => ({ status: 404, body: null });
    Z.mountInline(host); view = host.children[0];
    await flush();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { url: API + '/status', method: 'GET', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-test', 'X-BL-Zip': '1' }, body: undefined });
    assert.equal(status(view), '서버 도우미를 먼저 준비해 주세요.');
    assert.ok(view.innerHTML.includes('setup-windows.cmd'), 'setup guide shown when the helper is missing');
    serve = () => ({ status: 403, body: { error: '서버 관리자 계정에서 사용할 수 있어요.' } });
    button(view, 'check').click(); await flush();
    assert.equal(status(view), '서버 관리자 계정에서 사용할 수 있어요.');
    assert.ok(!view.innerHTML.includes('setup-windows.cmd'), 'no setup guide for a non-admin account');
    serve = () => ({ body: { version: '0.9.0' } });
    button(view, 'check').click(); await flush();
    assert.match(status(view), /서버 도우미 업데이트가 필요해요/);
    assert.equal(button(view, 'pick'), null);
    serve = () => ({ body: { version: server.VERSION } });
    button(view, 'check').click(); await flush();
    assert.match(status(view), /준비됐어요/);
    assert.ok(button(view, 'pick') && view.querySelector('[data-file]'), 'file picker shown once connected');
    assert.equal(button(view, 'check'), null);
});

await test('ZIP 고르기: .zip 이 아니거나 64MB 를 넘으면 서버로 보내지 않는다', async () => {
    calls = [];
    await pick({ name: 'pebble-notes.rar', size: 10 });
    assert.equal(status(view), '.zip 파일을 골라 주세요.');
    await pick({ name: 'huge.zip', size: 64 * 1024 ** 2 + 1 });
    assert.equal(status(view), 'ZIP은 64MB까지 넣을 수 있어요.');
    assert.equal(calls.length, 0);
});

await test('ZIP 확인: POST /inspect?name=<인코딩> · application/zip · 파일 그대로 · 추천 폴더가 하나면 바로 preview(token, folder JSON)', async () => {
    calls = [];
    const file = new File(['zip-bytes'], 'Pebble Notes & Co #2.ZIP', { type: 'application/zip' });
    serve = route => (route === '/inspect' ? { body: PLAN({ matches: [{ folder: 'pebble', display_name: 'Pebble Notes' }] }) } : { body: PREVIEW });
    await pick(file);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, API + '/inspect?name=Pebble%20Notes%20%26%20Co%20%232.ZIP');
    assert.equal(calls[0].method, 'POST'); assert.equal(calls[0].body, file);
    assert.equal(calls[0].headers['Content-Type'], 'application/zip'); assert.equal(calls[0].headers['X-BL-Zip'], '1'); assert.equal(calls[0].headers['X-CSRF-Token'], 'csrf-test');
    assert.equal(calls[1].url, API + '/preview'); assert.equal(calls[1].method, 'POST');
    assert.equal(calls[1].headers['Content-Type'], 'application/json');
    assert.deepEqual(json(calls[1]), { token: 'plan-1', folder: 'pebble' });
    assert.ok(button(view, 'install'), 'install button after preview');
    assert.match(view.innerHTML, /v1\.0\.0 → v1\.1\.0/);
});

await test('추천이 없으면 새 폴더(추천 이름)로 preview · 여럿이면 고를 때까지 안 보냄 · 새 폴더 이름은 앞뒤 공백을 뗀다', async () => {
    calls = [];
    serve = route => (route === '/inspect' ? { body: PLAN() } : { body: { ...PREVIEW, folder: 'pebble-notes', current: null } });
    await pick(new File(['z'], 'pebble-notes.zip'));
    assert.deepEqual(calls.map(c => c.url.split('?')[0]), [API + '/inspect', API + '/preview']);
    assert.deepEqual(json(calls[1]), { token: 'plan-1', folder: 'pebble-notes' });
    calls = [];
    serve = route => (route === '/inspect' ? { body: PLAN({ token: 'plan-2', matches: [{ folder: 'pebble' }, { folder: 'quill' }] }) } : { body: { ...PREVIEW, folder: 'my pebble', current: null } });
    await pick(new File(['z'], 'pebble-notes.zip'));
    assert.equal(calls.length, 1, 'several matches: wait for the user to choose');
    assert.equal(button(view, 'install'), null);
    assert.ok(view.querySelector('[data-action="preview"]').attrs.disabled !== undefined, 'preview disabled until a folder is chosen');
    view.querySelector('[data-choice]').fire('change', { target: { value: '@new' } });
    view.querySelector('[data-folder]').fire('input', { target: { value: '  my pebble  ' } });
    button(view, 'preview').click(); await flush();
    assert.equal(calls.length, 2);
    assert.deepEqual(json(calls[1]), { token: 'plan-2', folder: 'my pebble' });
    calls = [];
    view.querySelector('[data-choice]').fire('change', { target: { value: 'quill' } });
    assert.equal(button(view, 'install'), null, 'changing the folder drops the old preview');
    button(view, 'preview').click(); await flush();
    assert.deepEqual(json(calls[0]), { token: 'plan-2', folder: 'quill' });
});

await test('설치: install 은 표(token)만 보낸다 · 일하는 동안 다시 눌러도 한 번만 · 끝나면 새로고침 단추', async () => {
    calls = [];
    let release;
    serve = route => (route === '/install' ? new Promise(r => { release = () => r({ body: { folder: 'quill', backup: 'b-1', reload: true } }); }) : { body: {} });
    const first = button(view, 'install');
    first.click(); first.click();
    const again = button(view, 'install');
    assert.ok(again.attrs.disabled !== undefined, 'buttons are disabled while busy');
    again.click();
    await flush();
    assert.equal(calls.length, 1, 'one install request');
    assert.deepEqual({ url: calls[0].url, body: json(calls[0]) }, { url: API + '/install', body: { token: 'plan-2' } });
    release(); await flush();
    assert.equal(status(view), '설치했어요. 새로고침하면 적용돼요.');
    assert.equal(button(view, 'install'), null);
    assert.match(view.innerHTML, /quill · 이전 파일을 백업했어요/);
    button(view, 'reload').click();
    assert.equal(reloads, 1);
});

await test('삭제와 복원: GET /installed → remove-preview {folder} → remove {token} · GET /backups → restore {id} · 보호된 확장은 고를 수 없음', async () => {
    calls = [];
    const backupId = '0b6c2d1e-3f4a-4b5c-8d9e-0f1a2b3c4d5e';
    serve = (route) => ({
        '/installed': { body: [{ folder: 'pebble', display_name: 'Pebble Notes', protected: false }, { folder: 'blue-lemonade', display_name: 'Blue Lemonade', protected: true }] },
        '/remove-preview': { body: { token: 'remove-1', folder: 'pebble', manifest: { display_name: 'Pebble Notes', version: '1.0.0' }, files: 4, bytes: 4096 } },
        '/remove': { body: { folder: 'pebble', backup: backupId, removed: true, reload: true } },
        '/backups': { body: [{ id: backupId, folder: 'pebble', manifest: { display_name: 'Pebble Notes', version: '1.0.0' }, date: '2026-01-02T03:04:05.000Z', bytes: 4096, action: 'remove' }] },
        '/restore': { body: { folder: 'pebble', backup: null, reload: true } },
    }[route]);
    button(view, 'installed').click(); await flush();
    assert.match(view.innerHTML, /<option value="blue-lemonade" disabled/);
    assert.ok(button(view, 'remove-preview').attrs.disabled !== undefined, 'nothing chosen yet');
    view.querySelector('[data-remove-choice]').fire('change', { target: { value: 'pebble' } });
    button(view, 'remove-preview').click(); await flush();
    button(view, 'remove').click(); await flush();
    assert.match(status(view), /백업하고 삭제했어요/);
    button(view, 'backups').click(); await flush();
    view.querySelector(`[data-restore="${backupId}"]`).click();
    button(view, 'restore').click(); await flush();
    assert.match(status(view), /복원했어요/);
    assert.deepEqual(calls.map(c => [c.url, c.method, c.body === undefined ? undefined : json(c)]), [
        [API + '/installed', 'GET', undefined],
        [API + '/remove-preview', 'POST', { folder: 'pebble' }],
        [API + '/remove', 'POST', { token: 'remove-1' }],
        [API + '/backups', 'GET', undefined],
        [API + '/restore', 'POST', { id: backupId }],
    ]);
    for (const c of calls) assert.equal(c.headers['X-BL-Zip'], '1');
});

await test('오류 문구: 서버가 준 error 를 그대로 · 연결이 끊기면 안내 · JSON 이 아니면 상태 코드', async () => {
    serve = () => ({ status: 409, body: { error: '확인 시간이 지났어요. ZIP이나 관리할 확장을 다시 골라 주세요.' } });
    button(view, 'backups').click(); await flush();
    assert.equal(status(view), '확인 시간이 지났어요. ZIP이나 관리할 확장을 다시 골라 주세요.');
    serve = () => 'offline';
    button(view, 'backups').click(); await flush();
    assert.match(status(view), /서버 연결이 끊겼어요/);
    serve = () => ({ status: 502, raw: '<html>bad gateway</html>' });
    button(view, 'backups').click(); await flush();
    assert.equal(status(view), '서버 요청을 마치지 못했어요 (502).');
    assert.ok(button(view, 'backups').attrs.disabled === undefined, 'not stuck busy after an error');
});

await test('판 맞춤: 화면의 HELPER_VERSION = 서버 도우미 VERSION · JS VERSION = style.css 의 --blzi-css-version', () => {
    assert.equal(/const HELPER_VERSION = '([^']+)'/.exec(source)?.[1], server.VERSION);
    const version = /const VERSION = '([^']+)'/.exec(source)?.[1];
    assert.deepEqual(T.css.map(o => [o.folder, o.name, o.version]), [['zipinstall', '--blzi-css-version', version]]);
    const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');
    assert.equal(/--blzi-css-version:\s*'([^']+)'/.exec(css)?.[1], version);
});

await test('요술봉 메뉴: 켜면 하나만 붙고 · addonUI.zipinstallMenu=false · 확장 끔 · 테마만 모드면 뗀다', () => {
    const items = () => wand.children.filter(c => c.id === 'bl-zip-install-menu');
    assert.equal(items().length, 1, 'added at load');
    Z.syncMenu(); assert.equal(items().length, 1, 'no duplicate');
    T.settings.addonUI.zipinstallMenu = false; Z.syncMenu(); assert.equal(items().length, 0);
    T.settings.addonUI.zipinstallMenu = true; Z.syncMenu(); assert.equal(items().length, 1);
    T.settings.addons.zipinstall = false; Z.syncMenu(); assert.equal(items().length, 0);
    T.settings.addons.zipinstall = true; T.settings.usageMode = 'theme'; Z.syncMenu(); assert.equal(items().length, 0);
    T.settings.usageMode = 'both'; Z.syncMenu(); assert.equal(items().length, 1);
});

console.log(`zipinstall-client: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
