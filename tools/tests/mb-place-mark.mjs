// 버그 사냥 6 장소 이름 앞 표시 기호(@ · #) — 띠 · 지도 밖 화면(src/mb-place-mark.js · src/mb-map-floors.js markPlaces · src/ext-bridge-tr.js 변동 칩)
//   node tools/tests/mb-place-mark.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   ① 글 바꾸기: 📍 · 🗺️ 새 장소 · 발견 뒤 기호만 · SNS 아이디 · 가운데 기호 · 기호뿐은 그대로
//   ② 그 확장 꼴(이 시험이 지은 흉내 HTML · 지어낸 장소 이름): 상태 칸 위치 타일 · 펼친 위치 줄 · 갈 곳 칩 · 검색 결과 · 알림함 하루 정리 · 의뢰 장소 · 상점 · 고치는 칸은 그대로
//   ③ 감시자 · 스위치 annex · 변동 칩 칠하기 자리(소스 계약)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const P = await import(pathToFileURL(path.join(root, 'src/mb-place-mark.js')).href);
const F = await import(pathToFileURL(path.join(root, 'src/mb-map-floors.js')).href);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

test('① 글: 장소 표시 뒤 기호만 떼요', () => {
    assert.equal(P.pinText('📍 @Lobby'), '📍 Lobby');
    assert.equal(P.pinText('📍@Bakery Corner'), '📍Bakery Corner');
    assert.equal(P.pinText('📍 ＃Pier 9'), '📍 Pier 9');
    assert.equal(P.pinText('🗺️ 새 장소: @Old Mill'), '🗺️ 새 장소: Old Mill');
    assert.equal(P.pinText('🗺 발견: #Quiet Garden'), '🗺 발견: Quiet Garden');
    assert.equal(P.pinText('하루 정리 · 📍 @Lobby · 💞 하나: 친구'), '하루 정리 · 📍 Lobby · 💞 하나: 친구');
    assert.equal(P.pinText('@someone_99 님의 새 게시물'), '@someone_99 님의 새 게시물', 'SNS 아이디 그대로');
    assert.equal(P.pinText('📍 Park @ noon'), '📍 Park @ noon', '가운데 기호 그대로');
    assert.equal(P.pinText('📍 @'), '📍 @', '기호뿐이면 그대로');
    assert.equal(P.leadText('@Lobby'), 'Lobby'); assert.equal(P.leadText('@'), '@');
});

const html = `<div id="ss-hud"><button class="ss-hud-t"><b>상태</b><small>11/19 09:00 · 📍 @Lobby</small></button></div>
<div class="ss-panel ss-scope">
  <div class="ss-tile t-loc"><i class="fa-solid fa-location-dot"></i><span>@Lobby</span></div>
  <div class="ss-mini-line"><i class="fa-solid fa-location-dot"></i><span><b>@Lobby</b> — 넓은 홀</span></div>
  <div class="ss-loc-row"><small>갈 곳</small><span class="ss-loc-gos"><span class="ss-loc-go"><span class="e">🏢</span><b>#Archive Hall</b></span><span class="ss-loc-go"><span class="e">🏢</span><b>Roof</b></span></span></div>
  <div class="ss-notes">
    <div class="ss-note" data-tab="map"><span class="ss-t-ico">📍</span><div class="ss-t-b"><b>@<mark>Lob</mark>by</b><small>넓은 홀</small></div></div>
    <div class="ss-note" data-tab="sns"><span class="ss-t-ico">#️⃣</span><div class="ss-t-b"><b>@someone_99</b><small>새 게시물</small></div></div>
    <div class="ss-note" data-tab="record"><span class="ss-t-ico">📅</span><div class="ss-t-b"><b>하루 정리 — 11/19</b><small>📍 @Lobby · 🗺️ 새 장소: @Old Mill</small></div></div>
  </div>
  <div class="ss-meta"><span><i class="fa-solid fa-user"></i> 하나</span><span><i class="fa-solid fa-location-dot"></i> @Old Mill</span></div>
  <div class="ss-shop-h"><div><b>가게</b><small>잡화 · 📍 @Old Mill</small></div></div>
  <textarea class="ss-edit">📍 @Lobby</textarea>
</div>
<div id="ss-settings"><small>📍 @Lobby</small></div>`;

test('② 그 확장 꼴: 위치 타일 · 펼친 줄 · 갈 곳 · 검색 · 하루 정리 · 의뢰 · 상점 · 띠에서 떼고, SNS · 고치는 칸 · 설정 칸은 그대로', () => {
    const dom = new JSDOM(`<!doctype html><body>${html}</body>`), doc = dom.window.document;
    const panel = doc.querySelector('.ss-panel'), hud = doc.getElementById('ss-hud');
    const got = F.markPlaces(panel) + F.markPlaces(hud) + F.markPlaces(doc.querySelector('#ss-settings small'));
    assert.equal(got, 8, '뗀 수');
    assert.equal(doc.querySelector('.t-loc span').textContent, 'Lobby', '위치 타일');
    assert.equal(doc.querySelector('.ss-mini-line b').textContent, 'Lobby', '펼친 위치 줄');
    assert.deepEqual([...doc.querySelectorAll('.ss-loc-go b')].map(b => b.textContent), ['Archive Hall', 'Roof'], '갈 곳 칩');
    assert.equal(doc.querySelector('[data-tab="map"] b').textContent, 'Lobby', '검색 결과(칠하기로 나뉜 글)');
    assert.ok(doc.querySelector('[data-tab="map"] b mark'), '칠하기 그대로');
    assert.equal(doc.querySelector('[data-tab="sns"] b').textContent, '@someone_99', 'SNS 아이디 그대로');
    assert.equal(doc.querySelector('[data-tab="record"] small').textContent, '📍 Lobby · 🗺️ 새 장소: Old Mill', '하루 정리');
    assert.equal(doc.querySelector('.ss-meta span:last-child').textContent, ' Old Mill', '의뢰 장소');
    assert.equal(doc.querySelector('.ss-shop-h small').textContent, '잡화 · 📍 Old Mill', '상점');
    assert.equal(hud.querySelector('small').textContent, '11/19 09:00 · 📍 Lobby', '띠');
    assert.equal(doc.querySelector('textarea').value, '📍 @Lobby', '고치는 칸 그대로');
    assert.equal(doc.querySelector('#ss-settings small').textContent, '📍 @Lobby', '그 확장 설정 칸은 안 봐요');
    assert.equal(F.markPlaces(panel) + F.markPlaces(hud), 0, '두 번 해도 같아요');
});

test('② 변동 칩: 칩 자리 글만(pinNodes) · 「📍」 없는 칩은 훑지 않아요', () => {
    const dom = new JSDOM('<!doctype html><body><div class="mes"><div class="custom-ss-slot"><div class="ss-msgcard ss-scope"><span class="ss-mchip">📍 @Lobby</span><span class="ss-mchip pos">♥ 하나 +2</span><span class="ss-mchip">@someone_99 팔로우</span></div></div></div></body>');
    const slot = dom.window.document.querySelector('.custom-ss-slot');
    assert.equal(P.pinNodes(slot), 1);
    assert.deepEqual([...slot.querySelectorAll('.ss-mchip')].map(c => c.textContent), ['📍 Lobby', '♥ 하나 +2', '@someone_99 팔로우']);
    const plain = new JSDOM('<!doctype html><body><p>@someone 안녕</p></body>').window.document.body;
    assert.equal(P.pinNodes(plain), 0);
});

test('② 점자 빈칸(U+2800): 칩 · 창 글은 보통 띄어쓰기로(blank) · 끄면 그대로 · 「📍⠀@로비」 도 기호를 떼요 · 고치는 칸 그대로', () => {
    const B2 = '⠀';
    const dom = new JSDOM(`<!doctype html><body><div class="custom-ss-slot"><div class="ss-msgcard ss-scope"><span class="ss-mchip">+${B2}+꿀${B2}버터${B2}튀김빵${B2}(1박스${B2}2)</span><span class="ss-mchip">📍${B2}@로비</span></div></div><div class="ss-panel"><div class="ss-mini-line"><i class="fa-solid fa-location-dot"></i><span>${B2}@남쪽${B2}정류장${B2}앞</span></div><textarea>남쪽${B2}정류장</textarea></div></body>`);
    const doc = dom.window.document, slot = doc.querySelector('.custom-ss-slot'), panel = doc.querySelector('.ss-panel');
    assert.equal(P.pinNodes(slot, { pin: false, blank: false }), 0, '둘 다 끄면 손 안 대요');
    assert.equal(P.pinNodes(slot, { pin: true, blank: false }), 1, '기호만(점자 빈칸 뒤 @ 도 봐요)');
    assert.equal(slot.querySelectorAll('.ss-mchip')[1].textContent, `📍${B2}로비`);
    assert.equal(P.pinNodes(slot, { pin: true, blank: true }), 2);
    assert.deepEqual([...slot.querySelectorAll('.ss-mchip')].map(c => c.textContent), ['+ +꿀 버터 튀김빵 (1박스 2)', '📍 로비']);
    assert.ok(F.markPlaces(panel, { pin: true, blank: true }) >= 2);
    assert.equal(doc.querySelector('.ss-mini-line span').textContent, ' 남쪽 정류장 앞', '위치 타일 · 앞 기호도');
    assert.equal(doc.querySelector('textarea').value, `남쪽${B2}정류장`, '고치는 칸 그대로');
    assert.equal(P.blankText(`a${B2}b`), 'a b');
});

const B = await import(pathToFileURL(path.join(root, 'src/ext-bridge-tr.js')).href);
test('② 번역 열쇠: 「📍 #Lobby」 · 「🗺️ 새 장소: #Old Mill」 의 덩이는 기호 없이 · 끄면 예전 그대로 · 해시태그 · 아이디는 그대로', () => {
    const texts = ['📍 #Lobby', '🗺️ 새 장소: #Old Mill', '📍 @Lobby', '#Weekend Vibes 올림'];
    const on = B.collectGaps(texts, { pin: true }), off = B.collectGaps(texts, { pin: false });
    assert.deepEqual(on.list.sort(), ['#Weekend Vibes', 'Lobby', 'Old Mill'].sort());
    assert.deepEqual(on.owners.get('Lobby'), ['📍 #Lobby', '📍 @Lobby'], '원래 글은 그대로');
    assert.deepEqual(off.list.sort(), ['#Lobby', '#Old Mill', '#Weekend Vibes', 'Lobby'].sort(), '끄면 예전(1.8.5) 그대로');
});

test('③ 소스 계약: 지도 모듈 감시자가 그 확장 창 · 띠 · 알림에서 · 스위치 annex 로 · 변동 칩은 칩 칠하기에서 · 맞춤 모듈(ext-compat)은 글자를 안 고쳐요', () => {
    const fl = read('src/mb-map-floors.js'), br = read('src/ext-bridge-tr.js');
    assert.match(fl, /const opt = tidyOpts\(doc\), pin = opt\.pin \|\| opt\.blank;/);
    assert.match(fl, /export const tidyOpts = doc => \(\{ pin: mbFit\('annex', doc\), blank: mbFit\('blank', doc\) \}\);/);
    assert.match(fl, /if \(pin && n\.closest\?\.\(PLACE_SCOPE\)\) markPlaces\(n, opt\);/);
    assert.match(fl, /if \(n\.id === 'ss-hud' \|\| n\.closest\?\.\('#ss-hud'\)\) \{ if \(pin\) markPlaces\(n, opt\); continue; \}/);
    assert.match(fl, /onMbOff\(doc, \['annex', 'blank'\], \(\) => \{ try \{ core\?\.app\?\.rerenderPanels\?\.\(true\);/, '끄고 켜면 다시 그림');
    assert.ok(!F.PLACE_SCOPE.includes('#chat') && !F.PLACE_SCOPE.includes('#ss-settings'));
    assert.match(br, /const opt = \{ pin: mbFit\('annex', doc\), blank: mbFit\('blank', doc\) \}/);
    assert.match(br, /if \(typeof want === 'string' && opt\.blank\) want = blankText\(want\); if \(typeof want === 'string' && opt\.pin\) want = pinText\(want\);/);
    assert.ok(!read('src/ext-compat.js').includes('mb-place-mark'));
});

console.log(`mb-place-mark: ${n} 통과`);
