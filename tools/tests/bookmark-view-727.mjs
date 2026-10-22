// 7.2.7 (북마크 1.7.0) — 그림 원본 비율 · 크게 보기(원본 해상도까지 확대) · 생각 숨김(채팅과 같은 규칙) · 보기 고르기(글만 · 글+그림 · 그림만)
//   node tools/tests/bookmark-view-727.mjs <테마 루트>   (공개 저장소는 '.')
// view-mode.js 는 그대로 불러 보고, render.js · state.js 는 실리태번 모듈을 data: 스텁으로 바꿔 진짜로 부른다. 나머지(패널 · CSS · 보기 창)는 원문으로 연결을 본다.
// 실제 화면(폰 375 터치: 두 번 톡 1:1 · 벌리기 · lazy · 개수 · 저장)은 배포 전 격리 실리태번 rig 에서 따로 잰다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const dir = pathToFileURL(path.join(root, 'src/addons/bookmarks')).href + '/';
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__bookmarkView727 = { ext: {}, settingsSaves: 0 };
const G = 'const T = globalThis.__bookmarkView727;\n';
const STUBS = {
    'extensions.js': js(G + 'export const extension_settings = T.ext; export function getContext() { return { chatId: "c" }; } export function saveMetadataDebounced() {}'),
    'script.js': js(G + 'export function getThumbnailUrl() { return ""; } export function saveSettingsDebounced() { T.settingsSaves++; } export function messageFormatting(text) { return "<p>" + String(text) + "</p>"; }'),
    'personas.js': js('export const user_avatar = "persona.png";'),
    'utils.js': js('export function timestampToMoment() { return { isValid: () => false }; } export function uuidv4() { return "id"; } export function getStringHash() { return 1; }'),
    'dem-expressive.js': js('export function dressBody() {}'),
    'settings.js': js('export function getSettings() { return { addons: {} }; }'),
    'apply.js': js('export function applyAll() {}'),
    'palettes.js': js('export const PALETTES = {}; export function paletteFamily() { return ""; } export function paletteVariant() { return ""; }'),
};
register(js(`let S = {}, DIR = '';
export async function initialize(d) { S = d.stubs; DIR = d.dir; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').startsWith(DIR)) {
        const ups = (spec.match(/\\.\\.\\//g) || []).length, base = spec.split('/').pop();
        if (ups >= 2 && S[base]) return { url: S[base], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { stubs: STUBS, dir } });

// render.js 가 그릴 때 쓰는 아주 작은 문서 (생각 칸은 innerHTML 을 쓰지 않는다)
const bodyClasses = new Set();
globalThis.document = { body: { classList: { contains: name => bodyClasses.has(name) } }, baseURI: 'http://127.0.0.1:8000/' };

const V = await import(dir + 'view-mode.js');
const R = await import(dir + 'render.js');
const S = await import(dir + 'state.js');

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}

// 시험 북마크: 글 2 (메시지 북마크+그림 · 발췌) · 그림 북마크 3 (그림 2장 · 1장 · 1장)
const IMG = name => ({ src: `/user/images/Seraphina/${name}.png`, at: 1, prompt: name });
const favs = [
    { id: 'a', messageId: '40', note: '', images: [IMG('landscape')] },                       // 손으로 단 별표 + 나중에 붙은 그림 → 글
    { id: 'c', messageId: '42', note: '', excerpts: [{ id: 'x', text: '조금만', html: '' }] },   // 발췌 → 글
    { id: 'd', messageId: '43', note: '', blImageBorn: true, images: [IMG('portrait'), IMG('square')] },
    { id: 'e', messageId: '44', note: '', blImageBorn: true, images: [IMG('tall')] },
    { id: 'f', messageId: '45', note: '', blImageBorn: true, images: [IMG('portrait2')] },
];
const items = favs.map(fav => ({ fav, index: Number(fav.messageId) }));

await test('보기 이름: 글만 · 글+그림 · 그림만, 모르는 값은 글+그림', () => {
    assert.deepEqual([...V.VIEW_MODES], ['text', 'all', 'images']);
    assert.deepEqual({ ...V.VIEW_LABELS }, { text: '글만', all: '글+그림', images: '그림만' });
    for (const bad of [undefined, null, '', 'grid', 'ALL', 3]) assert.equal(V.normalizeViewMode(bad), 'all');
    assert.equal(V.normalizeViewMode('images'), 'images');
});

await test('그림만 있는 북마크 = 다리가 그림으로 만든(blImageBorn) 것 중 메모 · 발췌가 없는 것', () => {
    assert.equal(V.isImageOnly(favs[0]), false, '손으로 단 별표는 그림이 붙어도 글 북마크');
    assert.equal(V.isImageOnly(favs[1]), false);
    assert.equal(V.isImageOnly(favs[2]), true);
    assert.equal(V.isImageOnly({ ...favs[2], note: '이 장면!' }), false, '메모를 달면 글');
    assert.equal(V.isImageOnly({ ...favs[2], excerpts: [{ id: 'y', text: '대사' }] }), false, '발췌가 있으면 글');
    assert.equal(V.isImageOnly({ blImageBorn: true, images: [] }), false, '그림이 없으면 그림 북마크가 아니다');
    assert.equal(V.isImageOnly(null), false);
});

await test('세 보기의 개수: 글만 = 글 북마크 2 · 글+그림 = 북마크 5 · 그림만 = 그림 5', () => {
    assert.equal(V.viewCount(favs, 'text'), 2);
    assert.equal(V.viewCount(favs, 'all'), 5);
    assert.equal(V.viewCount(favs, 'images'), 5);
    assert.equal(V.viewCount([null, ...favs, 'x'], 'all'), 5, '이상한 칸은 세지 않는다');
    assert.equal(V.viewCount(undefined, 'images'), 0);
    assert.equal(V.countLabel(2, 'text'), '글 북마크 2개');
    assert.equal(V.countLabel(5, 'all'), '북마크 5개');
    assert.equal(V.countLabel(5, 'images'), '그림 5개');
});

await test('보기 거르기 · 그림 칸: 순서 그대로, 그림만은 북마크마다 붙인 차례로 한 칸씩', () => {
    assert.deepEqual(V.filterForView(items, 'text').map(x => x.fav.id), ['a', 'c']);
    assert.deepEqual(V.filterForView(items, 'all').map(x => x.fav.id), ['a', 'c', 'd', 'e', 'f']);
    assert.deepEqual(V.filterForView(items, 'images').map(x => x.fav.id), ['a', 'd', 'e', 'f']);
    const tiles = V.imageTiles(V.filterForView(items, 'images'));
    assert.deepEqual(tiles.map(t => `${t.index}:${t.image.prompt}`), ['40:landscape', '43:portrait', '43:square', '44:tall', '45:portrait2']);
});

await test('생각 숨김 판정: body.salty-reasoning-off (채팅이 생각 칸을 숨길 때) 일 때만', () => {
    assert.equal(V.reasoningHidden({ classList: { contains: n => n === 'salty-reasoning-off' } }), true);
    assert.equal(V.reasoningHidden({ classList: { contains: () => false } }), false);
    assert.equal(V.reasoningHidden(null), false);
    assert.equal(V.reasoningHidden({}), false);
});

await test('renderReasoningHtml: 채팅이 숨기면 빈 글 (카드 · 앞뒤 문맥 창 모두 이 함수), 보이면 그린다', () => {
    const message = { name: '세라', is_user: false, mes: '본문', extra: { reasoning: '생각: 짧게' } };
    bodyClasses.clear();
    assert.match(R.renderReasoningHtml(message, 3), /생각: 짧게/);
    bodyClasses.add('salty-reasoning-off');
    assert.equal(R.renderReasoningHtml(message, 3), '');
    assert.equal(R.renderReasoningHtml({ ...message, extra: {} }, 3), '');
    bodyClasses.clear();
    assert.equal(R.renderReasoningHtml({ ...message, extra: {} }, 3), '', '생각이 없으면 원래대로 빈 글');
});

await test('생각 칸을 그리는 곳은 renderReasoningHtml 뿐 (패널 카드 · 앞뒤 문맥), 창을 연 채 바꿔도 CSS 가 따라간다', () => {
    const panel = read('src/addons/bookmarks/panel.js');
    const viewers = read('src/addons/bookmarks/viewers.js');
    assert.match(panel, /const reasoning = message \? renderReasoningHtml\(message, formatIndex\) : '';/);
    assert.match(viewers, /const reasoning = renderReasoningHtml\(message, formatIndex\);/);
    for (const [name, src] of [['panel.js', panel], ['viewers.js', viewers]]) {
        assert.ok(!/extra\??\.reasoning/.test(src), `${name} 가 생각 글을 직접 읽지 않는다`);
    }
    assert.match(read('src/addons/bookmarks/style.css'), /body\.salty-reasoning-off \.cg-root \.cg-reasoning \{ display: none !important; \}/);
    // 채팅 쪽 규칙(같은 클래스) — 실리태번 「모델 추론 요청」(#openai_show_thoughts) 꺼짐 + 「추론 요청을 끄면 지난 추론도 숨기기」
    const apply = read('src/apply.js');
    assert.match(apply, /getElementById\('openai_show_thoughts'\)/);
    assert.match(apply, /s\.chat\?\.reasoningFollow !== false && stReasoningOff\(\)/);
    assert.match(read('css/05-chat.css'), /body\.salty\.salty-reasoning-off #sheld > \[id="chat"\] \.mes_reasoning_details/);
});

await test('그림이 잘리지 않음: 카드 · 격자 모두 원래 비율(object-fit cover 없음), 받기 전 자리 2:3, 다 받으면 원래 크기보다 키우지 않음', () => {
    const css = read('src/addons/bookmarks/style.css');
    const block = css.slice(css.indexOf('/* ── 붙인 그림 (다른 확장의 즐겨찾기'), css.indexOf('/* ── 7.2.7 (1.7.0) 그림 크게 보기')).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/object-fit:\s*cover/.test(block), 'cover 로 잘라 내지 않는다');
    assert.ok(!/width:\s*96px|height:\s*128px|height:\s*112px/.test(block), '예전 썸네일 크기 없음');
    assert.match(block, /\.cg-root \.cg-image-open img \{[^}]*width: 100%; height: auto;[^}]*aspect-ratio: auto 2 \/ 3; object-fit: contain;/);
    assert.match(block, /\.cg-root \.cg-image\.is-loaded \.cg-image-open img \{ width: auto; max-width: 100%; aspect-ratio: auto; \}/);
    assert.match(block, /\.cg-root \.cg-tile-open img \{[^}]*width: 100%; height: auto; aspect-ratio: auto 2 \/ 3;/);
    assert.match(block, /\.cg-root \.cg-tiles \{ display: grid;/);   // 7.3.1 (1.7.1) CSS columns → 읽는 차례대로 쌓기 (bookmark-masonry-731.mjs)
    assert.match(block, /\.cg-root \.cg-tiles\.is-masonry > \.cg-tile \{ position: absolute; \}/);
});

await test('lazy: 카드 · 격자의 그림은 loading=lazy · decoding=async, 다 받은 그림만 is-loaded (캐시는 바로)', () => {
    const render = read('src/addons/bookmarks/render.js');
    const panel = read('src/addons/bookmarks/panel.js');
    assert.match(render, /data-card-act="image-open" aria-label="그림 크게 보기"><img src="\$\{escapeHtml\(src\)\}" alt="" loading="lazy" decoding="async">/);
    assert.match(panel, /data-tile-open="\$\{at\}"[^`]*<img src="\$\{escapeHtml\(src\)\}" alt="" loading="lazy" decoding="async">/);
    assert.match(panel, /root\.addEventListener\('load', event => markImage\(event\.target, 'is-loaded'\), true\);/);
    assert.match(panel, /if \(img\.complete && img\.naturalWidth > 0\) markImage\(img, 'is-loaded'\);/);
    assert.match(panel, /const perPage = Math\.max\(24, settings\(\)\.itemsPerPage \* 2\);/);
});

await test('크게 보기: 시트 + 캐릭터 에셋과 같은 확대 손짓, 두 번 톡 = 원본 1:1, 최대 = 원본의 2배, 넘기기 · Esc', () => {
    const viewer = read('src/addons/bookmarks/image-viewer.js');
    const zoom = read('src/image-zoom.js');
    const assets = read('src/addons/assets/viewer.js');
    assert.match(viewer, /import \{ attachZoom \} from '\.\.\/\.\.\/image-zoom\.js';/);
    assert.match(viewer, /maxScale: \(\) => nativeRatio\(\) \* 2,/);
    assert.match(viewer, /doubleScale: \(\) => \(nativeRatio\(\) >= 1\.25 \? nativeRatio\(\) : 2\),/);
    assert.match(viewer, /const nativeRatio = \(\) => \(img\.naturalWidth && img\.clientWidth \? img\.naturalWidth \/ img\.clientWidth : 1\);/);
    assert.match(viewer, /openSheet\(\{[\s\S]*className: 'cg-image-sheet cg-viewer-sheet'/);
    assert.match(viewer, /data-viewer="raw" target="_blank" rel="noopener noreferrer"/);
    assert.match(zoom, /export function attachZoom\(\{ element, stage, img, onSwipe = \(\) => \{\}, maxScale = null, doubleScale = null \}\)/);
    assert.match(zoom, /zoomAround\(doubleZoom\(\), x, y, box\(\)\);/);
    assert.match(zoom, /ZOOM_PINCH_MIN, maxZoom\(\)\)/);
    assert.match(zoom, /clamp\(scale \* factor, 1, maxZoom\(\)\)/);
    assert.ok(!/ZOOM_MAX|ZOOM_DOUBLE/.test(zoom.replace(/const ZOOM_(MAX|DOUBLE) = [^\n]*\n/g, '').replace(/Math\.max\(ZOOM_MAX,|\|\| ZOOM_DOUBLE,/g, '')), '고정 배율이 남지 않았다');
    assert.match(assets, /import \{ attachZoom \} from '\.\.\/\.\.\/image-zoom\.js';/);
    assert.ok(!/function attachZoom/.test(assets), '캐릭터 에셋은 옮긴 것을 쓴다');
    const panel = read('src/addons/bookmarks/panel.js');
    assert.match(panel, /if \(at >= 0\) openImageViewer\(images\.map\(image => \(\{ src: image\.src, prompt: image\.prompt, label \}\)\), at\);/);
    assert.match(panel, /openImageViewer\(view\.tiles\.map\(tile => \(\{ src: tile\.image\.src, prompt: tile\.image\.prompt, label: tileLabel\(record, tile\) \}\)\), at\);/);
    assert.ok(!/function openImageSheet/.test(panel), '예전 작은 보기 창은 없앴다');
});

await test('보기 고르기: 칩 세 개 · 고르면 애드온 설정(전체)에 저장 · 개수와 옆 목록도 그 보기 기준 · 글만은 카드에서 그림을 뺀다', () => {
    const panel = read('src/addons/bookmarks/panel.js');
    for (const [view, label] of [['text', '글만'], ['all', '글\\+그림'], ['images', '그림만']]) {
        assert.match(panel, new RegExp(`class="cg-view" data-view="${view}" aria-pressed="false">[^\\n]*<span>${label}</span></button>`));
    }
    assert.match(panel, /settings\(\)\.viewMode = next;\n    saveSettings\(\);/);
    assert.match(panel, /<span class="cg-chat-count">\$\{viewCount\(record\.favorites, mode\)\}<\/span>/);
    assert.match(panel, /countLabel\(counts\.total, viewMode\(\)\)/);
    assert.match(panel, /const images = viewMode\(\) === 'text' \? '' : renderImagesHtml\(fav, \{ removable: !fav\.virtual \}\);/);
    assert.match(panel, /return view\.allMessages \? 'all' : normalizeViewMode\(settings\(\)\.viewMode\);/);
    const css = read('src/addons/bookmarks/style.css');
    assert.match(css, /@media \(pointer: coarse\) \{\n    \.cg-root \.cg-view \{ height: var\(--bl-h-ctl, 36px\); /);   // 7.7.6 보통 단추 높이(누르는 칸 44 는 87-addon-touch)
    assert.match(css, /\.cg-root \.cg-view \{[^}]*flex: 1 1 0;[^}]*white-space: nowrap;/);
});

await test('설정 저장: viewMode 기본 all, 모르는 값은 all 로, 고른 값은 그대로 (state.js initSettings)', () => {
    T.ext.chaekgalpi = { viewMode: 'images', itemsPerPage: 10, starIconApplied: true };
    assert.equal(S.initSettings().viewMode, 'images');
    T.ext.chaekgalpi = { viewMode: 'mosaic', starIconApplied: true };
    assert.equal(S.initSettings().viewMode, 'all');
    delete T.ext.chaekgalpi;
    assert.equal(S.initSettings().viewMode, 'all');
});

await test('판 · CI: 북마크 1.7.1 (JS = CSS) · 이 시험이 release-check.yml 에', () => {
    assert.match(read('src/addons/bookmarks/state.js'), /export const VERSION = '1\.7\.5';/);
    assert.match(read('src/addons/bookmarks/style.css'), /--cg-css-version: "1\.7\.5";/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/bookmark-view-727\.mjs \./);
});

console.log(`bookmark-view-727: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
