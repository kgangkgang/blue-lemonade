// 1.7.8 답 본문 끝에 미트볼 변화 줄이 글처럼 보이던 것(11-18 사용자 「이건 뭐냐 왜 보이는 거지」)
//   그 답은 모델이 변화 블록을 <meatball> 대신 다른 태그(<memory>)로 감싸 썼어요 — 그 확장은 <meatball> · <status> 만 본문에서 떼어서 덩이가 본문에 남고,
//   칩은 그 확장이 따로 읽어 붙였어요. 테마는 「그 확장이 이 답의 변화를 이미 읽어 간 때」에만 본문 화면에서 「키: 값」 줄로만 된 덩이를 숨겨요(원문 · 편집 창은 그대로).
//   ① 덩이 판정 ② 화면 표식(jsdom) — 읽어 간 변화가 없거나 · 글 속 「aff:」 · 키 하나뿐이면 그대로 ③ 인라인 숨김 · 문 · CI
//   node tools/tests/mb-leftover.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   jsdom 이 없으면 종료 2(통과 아님)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM; try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); } catch { console.error(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
let n = 0; const bad = []; const ok = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (e) { bad.push(name); console.log('실패', name, '—', e.message.split('\n')[0]); } };
let M = null; try { M = await import(pathToFileURL(path.join(root, 'src/mb-leftover.js')).href); } catch (e) { console.log('모듈 없음', e.code || e.message); }
const need = () => assert.ok(M, 'src/mb-leftover.js');

// 지어낸 글(사용자 글 아님)
const BLOCK = 'loc: Harbor Office | Rear Courtyard (1F)\nnpc: +Mira (present)\naff: Oskar +2\ntrust: Oskar +2, Mira +4\nevent: Found a stray kitten in the courtyard';
const BLOCK_KO = 'loc: 항구 사무소 | 뒤뜰 (1F) npc: +미라 (현장에 있음) aff: 오스카 +2 trust: 오스카 +2, 미라 +4 event: 뒤뜰에서 길고양이를 발견함';

await ok('① 덩이 판정: 줄 머리가 그 확장 키인 「키: 값」 이 둘 이상 · 처음부터 끝까지 · 한 줄로 붙은 번역본도', () => {
    need();
    assert.equal(M.statusRun(BLOCK), true);
    assert.equal(M.statusRun(BLOCK_KO), true, '줄바꿈이 사라진 한 줄(번역본 화면)');
    assert.equal(M.statusRun('위치: 뒤뜰\n호감: 미라 +2'), true, '한국어 키');
    assert.equal(M.statusRun('loc: 뒤뜰'), false, '키 하나뿐');
    assert.equal(M.statusRun('그녀가 말했다. loc: 뒤뜰 aff: 미라 +2'), false, '글 속에 섞인 것');
    assert.equal(M.statusRun('Time: late. Mood: tense.'), false, '모르는 키');
    assert.equal(M.statusRun(''), false);
});
const dom = (html) => new JSDOM(`<!doctype html><body class="salty"><div id="chat"><div class="mes" mesid="3"><div class="mes_text">${html}</div></div></div></body>`).window.document;
const msg = (ops = [['loc', 'Rear Courtyard'], ['aff', 'Oskar +2']]) => ({ is_user: false, mes: 'x', swipe_id: 0, extra: { statussim: { bySwipe: { 0: ops } } } });
await ok('② 화면 표식: 그 확장이 이 답의 변화를 읽어 간 때만 · 덩이를 감싼 가장 바깥 칸 하나 · 다른 문단은 그대로', () => {
    need();
    const doc = dom(`<p>She smiled.</p><p><memory>${BLOCK.replace(/\n/g, ' ')}</memory></p><p>The end.</p>`);
    const mes = doc.querySelector('.mes');
    assert.equal(M.markLeftovers(mes, msg()), 1);
    const ps = [...doc.querySelectorAll('.mes_text > p')];
    assert.deepEqual(ps.map(p => p.hasAttribute(M.ATTR)), [false, true, false]);
    assert.equal(doc.querySelector('memory').hasAttribute(M.ATTR), false, '바깥 칸 하나만');
    assert.equal(M.markLeftovers(mes, msg()), 1, '두 번 해도 같음');
});
await ok('② 실리태번이 줄마다 <br> 로 그린 덩이 · 뒤에 그 확장 칩 자리가 붙은 본문(리그 11-18 — 글자 노드만 이으면 「(1F)npc:」 처럼 붙어 한 덩이로 못 봤어요)', () => {
    need();
    const doc = dom('<p>She smiled.</p><p>loc: Harbor Office | Rear Courtyard (1F)<br>npc: +Mira (present)<br>aff: Oskar +2<br>trust: Oskar +2, Mira +4</p><div class="ss-slot"><div class="ss-msgcard"><span class="ss-mchip">♥ Oskar +2</span></div></div>');
    assert.equal(M.markLeftovers(doc.querySelector('.mes'), msg()), 1);
    assert.equal(doc.querySelectorAll('.mes_text > p')[1].hasAttribute(M.ATTR), true);
    assert.equal(doc.querySelector('.ss-slot').hasAttribute(M.ATTR), false, '칩 자리는 안 건드려요');
    const only = dom('<p>loc: Harbor Office<br>aff: Oskar +2</p><div class="ss-slot"><span class="ss-mchip">♥ Oskar +2</span></div>');
    assert.equal(M.markLeftovers(only.querySelector('.mes'), msg()), 0, '본문이 그 덩이뿐이면(칩 자리는 빼고 셈) 안 숨겨요');
});
await ok('② 그대로 두는 것: 읽어 간 변화 없음 · 내 메시지 · 키 하나 · 글 속 · 본문 전체가 덩이(숨기면 빈 답)', () => {
    need();
    const html = `<p>She smiled.</p><p>${BLOCK_KO}</p>`;
    let doc = dom(html); assert.equal(M.markLeftovers(doc.querySelector('.mes'), msg([])), 0, '그 확장이 아무것도 안 읽음 — 그대로 보여 알 수 있게');
    doc = dom(html); assert.equal(M.markLeftovers(doc.querySelector('.mes'), { ...msg(), is_user: true }), 0);
    doc = dom('<p>She smiled.</p><p>loc: 뒤뜰</p>'); assert.equal(M.markLeftovers(doc.querySelector('.mes'), msg()), 0);
    doc = dom('<p>She smiled. aff: 미라 +2 trust: 미라 +1</p>'); assert.equal(M.markLeftovers(doc.querySelector('.mes'), msg()), 0);
    doc = dom(`<p>${BLOCK_KO}</p>`); assert.equal(M.markLeftovers(doc.querySelector('.mes'), msg()), 0, '본문이 덩이뿐이면 안 숨겨요');
    doc = dom(`<p>She smiled.</p><p>${BLOCK_KO}</p>`); M.markLeftovers(doc.querySelector('.mes'), msg());
    doc.querySelector('.mes_text').innerHTML = '<p>She smiled.</p>';
    assert.equal(M.markLeftovers(doc.querySelector('.mes'), msg()), 0, '다시 그리면 표식도 새로');
});
await ok('③ 숨김은 그 칸 인라인 display 만 · 표식이 없어지면 되돌림 · 「원작 그대로 보기」 · chips 끔이면 안 숨김 · 미트볼 문 · CI', () => {
    need();
    let doc = dom('<p>She smiled.</p><p style="color: red">' + BLOCK_KO + '</p>'); const p = doc.querySelectorAll('.mes_text > p')[1];
    M.markLeftovers(doc.querySelector('.mes'), msg()); assert.equal(p.style.getPropertyValue('display'), 'none'); assert.equal(p.style.getPropertyPriority('display'), 'important');
    M.markLeftovers(doc.querySelector('.mes'), msg([])); assert.equal(p.style.getPropertyValue('display'), ''); assert.equal(p.style.color, 'red', '원래 style 은 그대로'); assert.equal(p.hasAttribute(M.ATTR), false);
    doc = dom('<p>She smiled.</p><p>' + BLOCK_KO + '</p>'); doc.body.setAttribute('data-bl-ext-raw', ''); assert.equal(M.markLeftovers(doc.querySelector('.mes'), msg()), 0, '원작 그대로 보기');
    doc = dom('<p>She smiled.</p><p>' + BLOCK_KO + '</p>'); doc.documentElement.setAttribute('data-bl-mb-off', 'chips'); assert.equal(M.markLeftovers(doc.querySelector('.mes'), msg()), 0, 'chips 끔');
    assert.ok(!read('src/ext-status.css').includes(M.ATTR), '맞춤 시트에는 안 넣어요(그 확장 이름 밖)');
    assert.ok(read('index.js').includes("import('./src/mb-leftover.js').then(m => m.startMbLeftover())"), '미트볼 문');
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/mb-leftover.mjs . tools'), 'CI 목록');
});

if (bad.length) { console.error(`mb-leftover: ${bad.length}개 실패`); process.exit(1); }
console.log(`mb-leftover: ${n}개 통과`);
