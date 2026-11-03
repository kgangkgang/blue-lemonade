// 9.0.9 글꼴 로컬 woff2 — 기본 목록의 글꼴 2개(프리젠테이션 · 갈무리모노11)가 jsDelivr 대신 테마 안 fonts/ 조각에서 오는지,
// 1.0.0 리디바탕은 조각을 담지 않고 8.2.5 처럼 공개 배포 주소(jsDelivr noonnu)에서 받는지(글꼴 파일에 라이선스 칸이 없어 OFL 문구를 써넣지 않아요),
// 조각이 unicode-range 로 나뉘어 필요한 것만 받는지(ko2 가 ko 앞), 첫 화면 글꼴은 미리 받는지, 출처 · 라이선스 목록이 파일과 맞는지.
//   node tools/tests/local-fonts.mjs [저장소]
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel));
let failed = 0;
const t = async (name, fn) => { try { await fn(); console.log(`ok - ${name}`); } catch (error) { failed++; console.log(`not ok - ${name}\n  ${error.stack || error}`); } };

const LOCAL = ['freesentation', 'galmurimono11'];
const RIDI_URL = 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.0/RIDIBatang.woff';   // 8.2.5 와 같은 배포 주소
const sources = JSON.parse(read('fonts/SOURCES.json'));

await t('fonts/SOURCES.json 이 fonts/ 의 woff2 와 한 벌 — 해시 · 라이선스(OFL 1.1) · 원본 해시가 적혀 있어요', () => {
    const listed = sources.fonts.flatMap(f => f.files.map(x => x.file)).sort();
    const disk = fs.readdirSync(path.join(root, 'fonts')).filter(n => n.endsWith('.woff2')).sort();
    assert.deepEqual(listed, disk, 'SOURCES.json 에 없는 woff2 · 빠진 woff2 가 없어요');
    for (const font of sources.fonts) {
        assert.equal(font.license, 'OFL-1.1', `${font.id}: 라이선스`);
        assert.match(font.sha256, /^[0-9a-f]{64}$/, `${font.id}: 원본 해시`);
        assert.ok(font.copyright && font.licenseNote, `${font.id}: 저작권 · 라이선스 근거`);
        for (const file of font.files) {
            const data = read(`fonts/${file.file}`);
            assert.equal(data.subarray(0, 4).toString('latin1'), 'wOF2', `${file.file}: woff2`);
            assert.equal(crypto.createHash('sha256').update(data).digest('hex'), file.sha256, `${file.file}: 해시`);
        }
    }
    const license = read('fonts/LICENSE-OFL.txt').toString('utf8');
    assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
    for (const name of ['Freesentation', 'GalmuriMono11']) assert.ok(license.includes(name), `LICENSE-OFL.txt 에 ${name} 저작권 줄`);
    assert.ok(!/RIDI/i.test(license), 'LICENSE-OFL.txt 에 리디바탕이 없어요(OFL 근거 없음)');
    assert.ok(!sources.fonts.some(f => f.id === 'ridibatang'), 'SOURCES.json 에 리디바탕 조각이 없어요');
});

await t('src/fonts-local.gen.js 가 SOURCES.json 과 같은 조각 · 범위 (도구로만 다시 써요)', async () => {
    const { LOCAL_FONT_FILES } = await import(pathToFileURL(path.join(root, 'src/fonts-local.gen.js')).href);
    assert.deepEqual(Object.keys(LOCAL_FONT_FILES).sort(), [...LOCAL].sort());
    for (const id of LOCAL) {
        const want = sources.fonts.filter(f => f.id === id).flatMap(f => f.files.map(x => ({ file: x.file, part: x.part, weight: f.weight, range: x.range })));
        assert.deepEqual(LOCAL_FONT_FILES[id].map(x => ({ ...x })), want, id);
        const parts = LOCAL_FONT_FILES[id].map(x => `${x.weight}:${x.part}`);
        for (const w of new Set(LOCAL_FONT_FILES[id].map(x => x.weight))) assert.ok(parts.indexOf(`${w}:ko2`) < parts.indexOf(`${w}:ko`), `${id} ${w}: ko2 가 ko 앞(겹친 범위는 뒤에 적힌 ko 부터)`);
    }
});

// 브라우저 흉내: fetch 는 부르면 실패(로컬 글꼴은 CSS 를 받으러 가지 않아요)
const saved = { SillyTavern: globalThis.SillyTavern, fetch: globalThis.fetch, localStorage: globalThis.localStorage, document: globalThis.document, FontFace: globalThis.FontFace };
const fetched = [];
const head = [];
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: { salty: {} }, saveSettingsDebounced() {}, getRequestHeaders: () => ({}) }) };
globalThis.fetch = async (url) => { fetched.push(String(url)); throw new Error('네트워크 없음'); };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.document = { fonts: { add() {}, delete() {}, [Symbol.iterator]: function* () {} }, head: { appendChild: el => head.push(el) }, createElement: tag => (tag === 'canvas' ? { getContext: () => null } : { tag }), getElementById: () => null };
globalThis.FontFace = class { constructor() { throw new Error('부팅 검사로 글꼴을 받으면 안 돼요'); } };
try {
    const fonts = await import(pathToFileURL(path.join(root, 'src/fonts.js')).href);
    await t('기본 목록 글꼴 2개는 jsDelivr 가 아니라 테마 fonts/ 조각 (있는 파일 · 같은 서버 절대 경로), 리디바탕은 배포 주소', () => {
        for (const id of LOCAL) {
            const font = fonts.findFont(id);
            assert.ok(font && Array.isArray(font.files) && font.files.length >= 3, id);
            assert.equal(font.probe, false, `${id}: 빈 글리프 검사는 빌드 때`);
            for (const f of font.files) {
                assert.match(f.url, /^\/.*\/fonts\/[\w-]+\.woff2$/, `${id}: ${f.url}`);
                assert.ok(fs.existsSync(path.join(root, 'fonts', path.basename(f.url))), f.url);
                assert.ok(f.range && fonts.parseRange(f.range).length, `${id}: 조각 범위`);
            }
        }
        const ridi = fonts.findFont('ridibatang');
        assert.deepEqual(ridi.files.map(f => f.url), [RIDI_URL], '리디바탕은 8.2.5 와 같은 배포 주소 한 파일');
        assert.ok(!fs.readdirSync(path.join(root, 'fonts')).some(n => /ridi/i.test(n)), 'fonts/ 에 리디바탕 사본이 없어요');
        const code = read('src/catalog.js').toString('utf8').replace(/^\s*\/\/.*$/gm, '').replace(/^.*id: '(pretendard|ridibatang|neodgm)'.*$/gm, '').replace(/import\('\.\/catalog-full\.js'\)/, '');
        assert.ok(!/https?:/.test(code), 'Pretendard · 리디바탕 · Neo둥근모(기본 코드 글꼴) 말고는 시작 목록에 바깥 주소가 없어요');
    });
    await t('사용자 설정(본문 리디바탕 · 메뉴 프리젠테이션 · 코드 갈무리모노11)의 합친 @font-face: 조각마다 한 줄, 범위 겹침 순서 ko2 → ko, 바깥 요청 0', async () => {
        const set = id => ({ ko: id, en: 'auto', ja: 'auto', zh: 'auto' });
        const text = await fonts.buildComposite('text', set('ridibatang'), 'auto');
        const ui = await fonts.buildComposite('ui', set('freesentation'), 'auto');
        const code = await fonts.buildComposite('code', set('galmurimono11'), 'auto');
        assert.deepEqual([text.failed, ui.failed, code.failed], [[], [], []]);
        const faces = css => css.split('\n').filter(Boolean);
        assert.equal(faces(text.css).length, 1, '리디바탕은 배포 주소 한 파일');
        assert.equal(faces(ui.css).length, 8, '프리젠테이션 2굵기 × 4조각');
        assert.equal(faces(code.css).length, 4, '갈무리모노11 4조각');
        assert.ok(text.css.includes(`url("${RIDI_URL}")`), text.css);
        for (const css of [ui.css, code.css]) {
            for (const line of faces(css)) assert.match(line, /^@font-face\{font-family:'Salty (Text|UI|Code)';font-weight:\d+;font-display:swap;src:url\("\/[^"]+\/fonts\/[\w-]+\.woff2"\);unicode-range:U\+[0-9A-F]/, line.slice(0, 160));
            const order = faces(css).map(l => /-(\d+)-(\w+)\.woff2/.exec(l).slice(1).join(':'));
            for (const w of new Set(order.map(o => o.split(':')[0]))) assert.ok(order.indexOf(`${w}:ko2`) < order.indexOf(`${w}:ko`), order.join(' '));
        }
        assert.match(text.stack, /^'Salty Text', 'RIDIBatang', 'Noto Serif KR', serif$/);
        assert.deepEqual(fetched, [], '글꼴 CSS · 검사용 파일을 받으러 가지 않아요');
    });
    await t('영어 칸을 따로 고르면 한국어 가족의 조각 범위에서 영문이 빠지고(구두점만 남음) 영어 가족은 그 글꼴의 latin 조각', async () => {
        const r = await fonts.buildComposite('text', { ko: 'freesentation', en: 'galmurimono11', ja: 'auto', zh: 'auto' }, 'auto');
        const lines = r.css.split('\n');
        const koLatin = lines.find(l => l.includes("'Salty Text';") && l.includes('freesentation-400-latin'));
        assert.ok(koLatin && !/U\+20-7E|U\+41[,;-]/.test(koLatin), `프리젠테이션 latin 조각은 영문 빼고: ${koLatin}`);
        assert.ok(lines.some(l => l.includes("'Salty Text EN';") && l.includes('galmurimono11-400-latin')), '영어 가족은 갈무리 latin 조각');
        assert.ok(!lines.some(l => l.includes("'Salty Text EN';") && /-ko2?\.woff2/.test(l)), '영어 가족에 한글 조각은 없어요');
    });
    await t('첫 화면 미리 받기: 본문 · 메뉴 글꼴의 latin · ko 조각(기본 굵기)만 <link rel=preload crossorigin>', () => {
        head.length = 0;
        fonts.preloadFonts(['ridibatang', 'freesentation', 'galmurimono11', 'freesentation', 'pretendard', undefined]);
        const got = head.map(l => `${l.rel}|${l.as}|${l.type}|${l.crossOrigin}|${path.basename(l.href)}`).sort();
        assert.deepEqual(got, ['freesentation-400-ko.woff2', 'freesentation-400-latin.woff2', 'galmurimono11-400-ko.woff2', 'galmurimono11-400-latin.woff2'].map(n => `preload|font|font/woff2|anonymous|${n}`), '리디바탕(배포 주소)은 미리 받기 없음');
        fonts.preloadFonts(['freesentation']);
        assert.equal(head.length, 4, '같은 파일은 한 번만');
    });
} finally { Object.assign(globalThis, saved); }

await t('ZIP 목록: release_gate 가 fonts/ 의 woff2 · SOURCES.json · LICENSE-OFL.txt 를 싣고 고정 목록과 맞춰요', () => {
    const gate = read('tools/release_gate.py').toString('utf8');
    assert.ok(!/ridibatang-400/.test(gate), 'release_gate 고정 목록에 리디바탕 조각이 없어요');
    const tool = read('tools/build-fonts.py').toString('utf8');
    assert.ok(!/ridibatang/i.test(tool), 'build-fonts.py 원본 목록에 리디바탕이 없어요');
    assert.ok(!/setName\([^)]*,\s*1[34],/.test(tool), 'build-fonts.py 는 라이선스 칸(name 13 · 14)을 써넣지 않아요');
    assert.match(gate, /FONT_RESOURCES = \('SOURCES\.json', 'LICENSE-OFL\.txt'\)/);
    for (const name of sources.fonts.flatMap(f => f.files.map(x => x.file))) assert.ok(gate.includes(name.replace(/-(latin|ko2|ko|rest)\.woff2$/, '')), `release_gate 고정 목록에 ${name}`);
});

if (failed) { console.log(`${failed}개 실패`); process.exit(1); }
console.log('PASS 글꼴 로컬 woff2');
