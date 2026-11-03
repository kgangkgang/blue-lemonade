// 8.3.0 단독 확장을 테마 안으로 들이는 틀 (src/private-addons.js · addons.js · 옛 단독 폴더 대기) — 등록 표 일관성 · conflict 판정 · 옛 절대 경로 없음 · 생성 전 훅 · 색 감시 · ZIP 포함
//   1.0.0 공개판에는 들인 단독 확장이 없어요(표가 비어 있고 틀만) — src/addons/ 의 폴더는 내장 애드온 판 표(addon-versions.js)에 있는 것뿐이에요
//   node tools/tests/private-addons.mjs <테마 루트>            — 저장소 상태(표 · 경로 · palette-lint · inventory)
//   node tools/tests/private-addons.mjs <테마 루트> --zip <zip> — 만든 ZIP 안에 내장 확장 파일이 다 있는지 (CI 의 ZIP 단계)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// 공개 금지 낱말을 글자 그대로 적지 않으려고 문자 코드로 만들어요(정적 검사가 이 시험 파일도 봐요)
const BANNED_RE = new RegExp([String.fromCharCode(0xCC10, 0xBE60), String.fromCharCode(0xAC24) + '\b', String.fromCharCode(0xBC84, 0xADF8) + ' ' + String.fromCharCode(0xC5C6, 0xC74C)].join('|'));

const argv = process.argv.slice(2);
const zipAt = argv.indexOf('--zip');
const zipPath = zipAt >= 0 ? argv[zipAt + 1] : '';
const root = path.resolve(argv.find((a, i) => !a.startsWith('--') && i !== zipAt + 1) || '.');
const url = rel => pathToFileURL(path.join(root, rel)).href;
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const PY = process.env.PYTHON || 'python';
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('ok', name); };

const { PRIVATE_ADDONS, EMBEDDED_PRIVATE, PRIVATE_DUPLICATES, PRIVATE_FLAGS, ADDON_CARRY } = await import(url('src/private-addons.js'));
const { legacyFolders, folderBase } = await import(url('src/extension-folder.js'));
const { DUPLICATES } = await import(url('src/extension-folder.js'));
const { ADDON_VERSION_FILES, versionIn } = await import(url('src/addon-versions.js'));
const { GENERATE_HOOKS, installGenerateInterceptor } = await import(url('src/private-addons.js'));

/** 확장 폴더의 배포 파일 — 저장소 전용 검사 설정(palette-allow.json)만 빼고 전부 ZIP · inventory 에 있어야 한다 */
function walk(dir, out = []) {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel, out); else out.push(rel);
    }
    return out;
}
const REPO_ONLY = /\/palette-allow\.json$|\.test\.m?js$/;   // 검사 설정 · 9.0.6 노드 시험은 저장소 전용
const shipped = id => walk(`src/addons/${id}`).filter(rel => !REPO_ONLY.test(rel));
/** 실행 때 fetch · import 되는 파일(코드 · html · json · 그림) — 설치 무결성 목록(build-info.js)에도 있어야 한다. manifest · 소개 글은 읽지 않으니 빼요 */
const runtime = id => shipped(id).filter(rel => /\.(js|mjs|css|html|json|png|webp|mp3)$/.test(rel) && !/\/manifest\.json$/.test(rel));

if (zipPath) {
    await test(`ZIP 에 내장 개인 확장 파일이 다 들어 있어요 (${path.basename(zipPath)})`, () => {
        const r = spawnSync(PY, ['-c', 'import zipfile,sys\nprint("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', zipPath], { encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } });
        assert.equal(r.status, 0, r.stderr);
        const names = new Set(r.stdout.split(/\r?\n/).filter(Boolean));
        const missing = [];
        for (const id of EMBEDDED_PRIVATE) for (const rel of shipped(id)) if (!names.has(`blue-lemonade/${rel}`)) missing.push(rel);
        assert.deepEqual(missing, [], '빠진 파일');
        const extra = [...names].filter(n => EMBEDDED_PRIVATE.some(id => n.startsWith(`blue-lemonade/src/addons/${id}/`)) && REPO_ONLY.test(n));
        assert.deepEqual(extra, [], '저장소 전용 파일(검사 설정 · 시험)이 ZIP 에 들어갔어요');
        console.log(`       ${EMBEDDED_PRIVATE.map(id => `${id} ${shipped(id).length}`).join(' · ')} 파일 확인`);
    });
    console.log(`private addons (zip): ${passed} passed`);
    process.exit(0);
}

await test('표: 1.0.0 공개판은 빈 표 — src/addons/ 의 폴더는 판 표에 있는 내장 애드온뿐', () => {
    assert.deepEqual(Object.keys(PRIVATE_ADDONS), [], '공개판에 들인 단독 확장이 없어요(따로 깔던 확장은 자기 폴더에서 단독으로)');
    assert.deepEqual([...EMBEDDED_PRIVATE], []);
    assert.deepEqual(PRIVATE_FLAGS, {});
    assert.equal(ADDON_CARRY, 4, '새 확장이 실리는 판마다 1 올려요 (지난 판들에서 4 까지 올렸어요)');
    const dirs = fs.readdirSync(path.join(root, 'src/addons'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    assert.deepEqual(dirs.filter(d => !ADDON_VERSION_FILES[d]), [], 'src/addons/ 에 판 표(addon-versions.js)에 없는 폴더가 있어요');
    for (const [id, p] of Object.entries(PRIVATE_ADDONS)) {
        assert.ok(p.label && p.icon.startsWith('fa-') && Array.isArray(p.folders) && p.folders.length, id);
        assert.deepEqual(DUPLICATES[id], [...p.folders], `DUPLICATES.${id} 가 표와 달라요`);
        assert.deepEqual(PRIVATE_DUPLICATES[id], [...p.folders]);
        // 8.3.2 css: 자기 스타일 파일 이름 — 없으면 style.css. addons.js stylesheet() 가 같은 표를 읽는다
        if (p.css !== undefined) assert.ok(/^[\w-]+\.css$/.test(p.css) && p.css !== 'style.css', `${id}: css 는 자기 폴더의 파일 이름(style.css 면 적지 않아요)`);
        if (p.embedded) assert.ok(exists(`src/addons/${id}/index.js`) && exists(`src/addons/${id}/${p.css ?? 'style.css'}`) && exists(`src/addons/${id}/bridge.js`) && exists(`src/addons/${id}/manifest.json`), `${id}: index.js · ${p.css ?? 'style.css'} · bridge.js · manifest.json`);
        else assert.ok(!exists(`src/addons/${id}`), `${id}: 아직 실리지 않은 확장 폴더가 있어요 — embedded 로 바꿔요`);
    }
    const free = new Set(read('tools/fa-free-6.5.2.txt').split('\n').map(s => s.trim()));
    for (const p of Object.values(PRIVATE_ADDONS)) assert.ok(free.has(p.icon.slice(3)), `${p.icon} 는 Font Awesome Free 에 없어요`);
});

await test('판: manifest = 코드 VERSION = 업데이트 탭 판 표(앞 4KB) — 표에 든 확장마다', () => {
    for (const id of EMBEDDED_PRIVATE) {
        const p = PRIVATE_ADDONS[id];
        assert.deepEqual(ADDON_VERSION_FILES[id], [p.label, p.version], `ADDON_VERSION_FILES.${id}`);
        const manifest = JSON.parse(read(`src/addons/${id}/manifest.json`)).version;
        assert.match(manifest, /^\d+\.\d+\.\d+$/);
        assert.doesNotMatch(manifest, /(^|\.)10(\.|$)/, '판 번호에 10 없음');
        const head = fs.readFileSync(path.join(root, 'src/addons', p.version)).subarray(0, 4096).toString('utf8');
        assert.equal(versionIn(head, p.version), manifest, `${p.version} 앞 4KB 의 VERSION 이 manifest 와 달라요`);
    }
});

await test('addons.js · settings.js · panel.js · 검색 색인 · addon-off-cost · release_gate 가 같은 id 를 알아요', async () => {
    const addons = read('src/addons.js'), settings = await import(url('src/settings.js'));
    assert.equal(settings.DEFAULTS.addonCarry, 0);
    assert.match(addons, /const \{extensionNames,extension_settings\}=await import\('\.\.\/\.\.\/\.\.\/\.\.\/extensions\.js'\);\n[^\n]*\n\s*return legacyFolders\(DUPLICATES\[id\]\?\?\[\],extensionNames,extension_settings\.disabledExtensions\)\.length>0;/, 'conflict() 가 legacyFolders 를 써요');
    assert.match(addons, /export async function disableLegacy\(ids=EMBEDDED_PRIVATE\)/);
    assert.match(addons, /data-legacy-off=/);
    assert.match(addons, /\[data-legacy-off\]/);
    assert.match(addons, /s\.addonCarry\|0\)<ADDON_CARRY/, '플래그 이어받기 한 번');
    assert.match(addons, /\['perf','order',[^\]]*'tts',\.\.\.EMBEDDED_PRIVATE\]\)\{/, '시작 순서: 성능 보조 맨 앞, 표에 든 확장은 끝(1.0.0 은 없음)');
    assert.ok(addons.includes("new URL(`./addons/${id}/${PRIVATE_ADDONS[id]?.css||'style.css'}`,import.meta.url)"), 'stylesheet() 는 표의 css 이름(없으면 style.css)');
    const panel = read('src/panel.js'), search = read('src/settings-search.js'), offCost = read('tools/tests/addon-off-cost.mjs'), gate = read('tools/release_gate.py');
    for (const id of EMBEDDED_PRIVATE) {
        assert.equal(settings.DEFAULTS.addons[id], false, `DEFAULTS.addons.${id}`);
        assert.ok(addons.includes(`import('./addons/${id}/index.js')`), `startOne 에 ${id} 분기`);
        assert.ok(addons.includes(`import('./addons/${id}/bridge.js')`), `세부 설정 · 옆 칸은 ${id}/bridge.js`);
        assert.ok(addons.includes(`id==='${id}'?import('./addons/${id}/bridge.js')`), `옆 칸(bindInlineAddon) ${id} 분기 — 없으면 북마크가 붙어요`);
        assert.ok(panel.includes(`['${id}', '${PRIVATE_ADDONS[id].label}']`), `panel.js 확장 탭 목록에 ${id}`);
        assert.ok(search.includes(`['extensions','${id}',`), `settings-search.js 에 ${id}`);
        assert.ok(offCost.includes(`'${id}/index.js'`), `addon-off-cost STARTERS 에 ${id}`);
        assert.ok(gate.includes(`'${id}': (`), `release_gate PRIVATE_ADDON_RESOURCES 에 ${id}`);
        const bridge = await import(url(`src/addons/${id}/bridge.js`));
        assert.equal(typeof bridge.openPanel, 'function'); assert.equal(typeof bridge.mountInline, 'function');
        assert.doesNotMatch(read(`src/addons/${id}/bridge.js`), /from '\.\/index\.js'|import\('\.\/index\.js'\)/, 'bridge 는 본체를 불러 시작시키지 않아요');
    }
});

await test('옛 단독 폴더 판정(legacyFolders): 켜짐 · 꺼짐 · 판 번호 붙은 폴더 · 남의 폴더', () => {
    // 지어낸 폴더 이름(sample-ext · sample-plan)으로 판정만 봐요 — 1.0.0 표는 비어 있어요
    const names = ['third-party/sample-ext', 'third-party/sample-plan-1.3.3', 'third-party/blue-lemonade', 'third-party/voice', 'tts', 'third-party/sample-extras'];
    assert.deepEqual(legacyFolders(['sample-ext'], names, []), ['third-party/sample-ext']);
    assert.deepEqual(legacyFolders(['sample-ext'], names, ['third-party/sample-ext']), []);
    assert.deepEqual(legacyFolders(['sample-plan'], names, []), ['third-party/sample-plan-1.3.3'], '판 번호 붙은 폴더도 같은 확장');
    assert.deepEqual(Object.keys(DUPLICATES).filter(id => (DUPLICATES[id] || []).includes('voice')), [], '단독으로 남은 확장 폴더는 겹침으로 보지 않아요');
    assert.deepEqual(legacyFolders(['tts'], names, []), [], '실리태번 내장 tts 는 third-party 가 아니에요');
    assert.deepEqual(legacyFolders(['sample-ext'], undefined, null), []);
    assert.equal(folderBase('sample-ext-1.4.1'), 'sample-ext');
});

await test('옛 경로가 남지 않았어요: 테마 절대 주소 · third-party/<자기 폴더> · 세 단계 호스트 import, 호스트 import 는 scripts/ 에 닿아요', () => {
    const bad = [], host = [];
    const banned = ['/scripts/extensions/third-party/', ...EMBEDDED_PRIVATE.map(id => `third-party/${id}'`), '"third-party/blue-lemonade"', '"../../blue-lemonade/src/', "'../../../extensions.js'", "'../../../../script.js'", "'../../../../sse-stream.js'", "'../../../../openai.js'", "'../../../../instruct-mode.js'", "'../../../../world-info.js'", "'../../../constants.js'", "'../../../utils.js'", "'../../../popup.js'", "'../../shared.js'", "'../../regex/engine.js'", "BASE + 'fonts.js'", "'../blue-lemonade/src/addons/", "'../blue-lemonade/src/"];
    for (const id of EMBEDDED_PRIVATE) for (const rel of walk(`src/addons/${id}`).filter(r => /\.(js|mjs)$/.test(r))) {
        const text = read(rel);
        for (const b of banned) if (text.includes(b)) bad.push(`${rel}: ${b}`);
        for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.\.\/[^'"]+)['"]/g)) {
            const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
            if (!target.startsWith('../')) { if (!exists(target)) bad.push(`${rel}: ${m[1]} → ${target} 없음`); continue; }
            // 테마 루트(third-party/blue-lemonade) 밖 = 실리태번 scripts/ 아래(세 단계 위 ../../../<이름>.js 또는 한 폴더 아래 slash-commands/·macros/) · scripts/extensions/ 바로 아래(두 단계 위 — shared.js) · 공개 루트의 script.js(네 단계 위)
            if (!/^\.\.\/\.\.\/(?:\.\.\/)?[\w-]+(?:\/[\w-]+)?\.js$/.test(target) && target !== '../../../../script.js') bad.push(`${rel}: ${m[1]} → ${target} (실리태번 scripts/ 아래가 아니에요)`);
            else host.push(`${rel} → ${target === '../../../../script.js' ? 'script.js(루트)' : target.startsWith('../../../') ? target.slice(9) : 'extensions/' + target.slice(6)}`);
        }
    }
    assert.deepEqual(bad, []);
    if (EMBEDDED_PRIVATE.length) assert.ok(host.length >= 1, `호스트 import 가 없어요: ${host.length}`);
    console.log(`       호스트 import ${host.length}줄: ${[...new Set(host.map(h => h.split(' → ')[1]))].join(' · ')}`);
});

await test('생성 전 훅 창구: manifest generate_interceptor → blueLemonadeGenerate → Set 의 훅을 차례로, 하나가 던져도 나머지는 돌아요', async () => {
    assert.equal(JSON.parse(read('manifest.json')).generate_interceptor, 'blueLemonadeGenerate');
    assert.match(read('index.js'), /installGenerateInterceptor\(globalThis, \{ before: /);   // 9.0.2 애드온이 3층에 붙기 전 첫 생성이면 기다려요
    const target = {}, calls = [];
    const hooks = installGenerateInterceptor(target);
    assert.equal(target[GENERATE_HOOKS], hooks);
    assert.equal(installGenerateInterceptor(target), hooks, '두 번 깔아도 같은 Set');
    hooks.add(async (chat, size, abort, type) => { calls.push(['a', chat, size, type]); });
    hooks.add(() => { throw new Error('synthetic'); });
    hooks.add((chat, size, abort) => { calls.push(['c']); abort(false); });
    const errors = []; const orig = console.error; console.error = (...a) => errors.push(a);
    try { let aborted = false; await target.blueLemonadeGenerate([{ mes: 'x' }], 4096, () => { aborted = true; }, 'normal'); assert.ok(aborted); } finally { console.error = orig; }
    assert.deepEqual(calls, [['a', [{ mes: 'x' }], 4096, 'normal'], ['c']]);
    assert.equal(errors.length, 1);
});

await test('색 감시(palette-lint): 내장 확장 폴더에 palette.css 밖의 색 글자가 없어요', () => {
    for (const id of EMBEDDED_PRIVATE) {
        const allow = `src/addons/${id}/palette-allow.json`;
        const r = spawnSync(process.execPath, [path.join(root, 'tools/palette-lint.mjs'), path.join(root, 'src/addons', id), ...(exists(allow) ? ['--allow', path.join(root, allow)] : [])], { encoding: 'utf8' });
        assert.equal(r.status, 0, `${id}: ${r.stdout.trim().split('\n').slice(-6).join('\n')}`);
    }
});

await test('9.0.5 공용 한 벌(src/shared/): 확장 폴더에 같은 사본이 다시 생기지 않아요', () => {
    const SHARED = ['size.css', 'palette.css', 'theme-look.js'];   // 1.0.0: 따로 깔던 확장만 쓰던 공용 모듈은 걷고 성능 보조 저장 공간 창 · 애드온이 쓰는 셋만
    for (const name of SHARED) assert.ok(exists(`src/shared/${name}`), `src/shared/${name} 이 있어요`);
    const norm = rel => read(rel).replace(/\r\n/g, '\n').trim();
    const copies = [];
    for (const id of EMBEDDED_PRIVATE) for (const rel of walk(`src/addons/${id}`)) {
        const name = path.posix.basename(rel);
        if (SHARED.includes(name) && norm(rel) === norm(`src/shared/${name}`)) copies.push(rel);
        if (['tab-scroll.js', 'tab-scroll.css', 'recent-context.js'].includes(name)) copies.push(rel);   // 테마 src/ 것 한 벌
    }
    assert.deepEqual(copies, []);
});

await test('release_gate inventory 가 내장 확장의 코드 · manifest · 소개 글 · 실행 자원(html · json · png · webp)을 담고, 검사 설정(palette-allow.json)은 빼요', () => {
    const r = spawnSync(PY, ['-c', "import sys\nsys.path.insert(0,'tools')\nimport release_gate as g\nprint('\\n'.join(g.inventory('.', 'theme')))"], { cwd: root, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } });
    assert.equal(r.status, 0, r.stderr);
    const names = new Set(r.stdout.split(/\r?\n/));
    const missing = [];
    for (const id of EMBEDDED_PRIVATE) for (const rel of shipped(id)) if (!names.has(rel)) missing.push(rel);
    assert.deepEqual(missing, []);
    for (const id of EMBEDDED_PRIVATE) assert.ok(!names.has(`src/addons/${id}/palette-allow.json`), `${id}/palette-allow.json 은 ZIP 에 안 들어가요`);
});

console.log(`private addons: ${passed} passed`);
