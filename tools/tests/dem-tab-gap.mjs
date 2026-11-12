// 데우스 V3 묶음(DEM Active Modules)의 탭 줄 ↔ 아래 카드 간격 잠금 — css/30-dem-skin.css 를 정적으로 확인해요.
//   node tools/tests/dem-tab-gap.mjs .
// 제보: 폰 · 밤 판에서 탭 줄(All · Characters · Phi …) 아랫변이 바로 아래 카드 상자의 윗변에 붙고(간격 0), 탭 칩은 안쪽 16 인데 상자는 판 끝까지 가서 좌우도 어긋났어요.
// ① 탭 줄 아래 간격 12 = 탭 줄 아래 여백 11 + 본문 칸이 잘라 내는 맨 윗줄 1(본문 칸 위 여백은 0 그대로)
// ② 본문 칸 맨 윗줄 1px 자르기 — 탭 줄 바로 아래 오는 카드(탭마다 다른 카드)의 윗선이 그 줄이라 어느 탭에서도 탭 아래에 판 끝까지 가는 선이 없어요(:has 를 늘리지 않음)
// ③ 탭 줄 · 본문 칸 좌우 여백이 같음(16)
// ④ 묶음 안 카드는 평평하게(위 나눔 선 하나) — 88-ui-parts 의 「묶음 안 카드 네 변 1px 선」(아이디 둘)이 이겨 판 끝에 붙은 네모 상자로 그려지던 것
// ⑤ 인물 칩 줄: 탭 바로 아래 오는 판(인물 쪽 아님)만 위 1(잘리는 줄 몫) · 붙는 자리 top 0, 인물 쪽(머리 다음 칩 줄)은 위 12 · 원작 붙는 자리 그대로
// ⑥ 인물 칩 줄 다음 첫 카드도 윗선 없음 ⑦ 새 규칙은 모두 묶음(.custom-dem-modules) 안으로만(묶음 없는 옛 데우스 2.5 에는 닿지 않음) ⑧ 미리보기 사본 · 빌드 결과에도 같은 값
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const css = read('css/30-dem-skin.css');
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  PASS  ' + name); };
const HEAD = 'body.salty.salty-dem-skin :is(#chat, .cg-root, .salty-preview) .mes_text ';
/** 선택자가 정확히 sel 인 규칙의 본문 */
const rule = (sel, src = css, head = HEAD) => { const key = head + sel + ' {'; const i = src.indexOf(key); assert.ok(i >= 0, `${sel} 규칙이 없어요`); return src.slice(i + key.length, src.indexOf('}', i)); };
/** padding 값을 위 · 오른쪽 · 아래 · 왼쪽 px 로 */
const pad = body => { const m = /padding:\s*([^;!]+?)\s*!important/.exec(body); assert.ok(m, 'padding 선언이 없어요'); const v = m[1].split(/\s+/).map(x => { assert.match(x, /^(0|\d+px)$/, `px 값이 아니에요: ${x}`); return parseFloat(x); });
    return v.length === 1 ? [v[0], v[0], v[0], v[0]] : v.length === 2 ? [v[0], v[1], v[0], v[1]] : v.length === 3 ? [v[0], v[1], v[2], v[1]] : v; };
/** 본문 칸이 잘라 내는 맨 윗줄 px — clip-path: inset(<위> 0 0) */
const clipTop = body => { const m = /clip-path:\s*inset\((\d+)px 0 0\)/.exec(body); assert.ok(m, '본문 칸 맨 윗줄 자르기(clip-path: inset(1px 0 0))가 없어요'); return Number(m[1]); };

const CHAR = ':is(.custom-dem-status, .custom-dem-relationships, .custom-dem-psychological-states, .custom-dem-undercurrents)';
const TABS = '.custom-dem-modules .custom-dem-tabs', BODY = '.custom-dem-modules .custom-dem-modules__body', CAST = '.custom-dem-modules .custom-dem-cast';
const CAST_FIRST = '.custom-dem-modules > .custom-dem-modules__body:not(.custom-dem-charpage) > .custom-dem-cast';
const FLAT = `.custom-dem-modules__body > details.custom-dem-card:not(.custom-dem-charpage > ${CHAR}):not(#salty-none)`;
const FIRST = '.custom-dem-modules > .custom-dem-modules__body > details.custom-dem-card:first-of-type:not(#salty-none)';
const tabs = pad(rule(TABS)), bodyPad = pad(rule(BODY)), cast = pad(rule(CAST)), cut = clipTop(rule(BODY));

t('탭 줄 아래 간격 12: 탭 줄 아래 11 + 잘리는 줄 1, 본문 칸 위 여백 0', () => {
    assert.equal(bodyPad[0], 0, '본문 칸 위 여백');
    assert.equal(tabs[2] + cut, 12, '탭 칩 아랫변 ↔ 아래 첫 요소');
    assert.ok(tabs[2] >= 8, '탭 줄 아래 여백이 8 보다 좁아요(0 이면 탭이 아래 카드에 붙어요)');
});
t('본문 칸 맨 윗줄 1px 자르기: 카드 윗선 두께(1px)만큼만 — 탭마다 다른 첫 카드의 윗선이 안 보여요', () => {
    assert.equal(cut, 1);
    // 잘리는 줄에 오는 것은 카드 윗선뿐이어야 해요: 본문 칸 위 여백 0 · 카드 위 바깥 여백 0 · 윗선 1px
    const flat = rule(FLAT);
    assert.match(flat, /margin: 0 -16px !important/); assert.match(flat, /border-top: 1px solid var\(--salty-line\) !important/);
});
t('좌우 선: 탭 줄과 본문 칸의 좌우 여백이 같아요(16)', () => {
    assert.equal(tabs[1], 16); assert.equal(tabs[3], 16);
    assert.equal(bodyPad[1], tabs[1], '오른쪽'); assert.equal(bodyPad[3], tabs[3], '왼쪽');
});
t('묶음 안 카드는 평평하게: 네 변 선 0 · 위 나눔 선 하나 — 88-ui-parts 의 네 변 1px 선(아이디 둘)보다 무거운 선택자', () => {
    assert.match(rule(FLAT), /border: 0 !important;\s*border-top: 1px solid var\(--salty-line\) !important;\s*border-radius: 0 !important/);
    // 88 의 규칙: html:not(#bl-ui-parts-off) … :is(#chat, …) … = 아이디 둘 · 클래스 넷. 이쪽은 #chat + #salty-none = 아이디 둘 · 클래스 일곱이라 이겨요
    assert.match(read('css/88-ui-parts.css'), /html:not\(#bl-ui-parts-off\) body\.salty :is\(#chat, \.cg-root, \.salty-preview\) \.mes_text \.custom-dem-modules details:is\(\.custom-dem-card,[^{]*\{\s*border: 1px solid/);
    assert.ok(HEAD.includes('#chat') && FLAT.endsWith(':not(#salty-none)'));
});
t('인물 칩 줄: 바탕은 위아래 12 · 탭 바로 아래 오는 판(인물 쪽 아님)만 위 = 잘리는 줄 몫 1(탭 간격과 겹쳐 24 가 되지 않게) · 붙는 자리 top 0', () => {
    assert.deepEqual(cast, [12, 0, 12, 0]);
    const first = rule(CAST_FIRST);
    assert.match(first, /top: 0 !important/);
    const m = /padding-top: (\d+)px !important/.exec(first); assert.ok(m, 'padding-top'); assert.equal(Number(m[1]), cut);
    assert.doesNotMatch(rule(CAST), /(^|\s)top:/, '인물 쪽 칩 줄의 붙는 자리(원작 -12)는 그대로 둬요');
});
t('인물 칩 줄 다음 첫 카드: 윗선 없음 · 나눔 선 규칙 뒤에 와요(같은 무게면 뒤가 이겨요)', () => {
    assert.match(rule(FIRST), /^\s*border-top: 0 !important;\s*$/);
    assert.ok(css.indexOf(HEAD + FIRST + ' {') > css.indexOf(HEAD + FLAT + ' {'), '첫 카드 규칙이 나눔 선 규칙보다 앞에 있어요');
});
t('탭을 보는 :has 를 새로 쓰지 않아요(주어 아닌 :has 상한 — has-guard)', () => {
    assert.doesNotMatch(bare, /:has\(\.custom-dem-tabs__rail input:checked/);
    assert.doesNotMatch(bare, /:has\(\.custom-dem-tab--[a-z]+ input:checked/);
});
t('새 규칙은 묶음 안으로만 — 묶음 없는 옛 데우스(2.5) 카드 · 다른 프리셋 상태창에는 닿지 않아요', () => {
    for (const sel of [FIRST, TABS, BODY, CAST, CAST_FIRST, FLAT]) assert.match(sel, /^\.custom-dem-modules(__body)?[ >]/, sel);
    assert.equal((bare.match(/clip-path:/g) || []).length, 1, 'clip-path 는 묶음 본문 칸 한 곳만');
    const outer = css.slice(css.indexOf('.mes_text details.custom-dem-card:where(:not(.custom-dem-modules *)),'));
    assert.match(outer.slice(0, outer.indexOf('}')), /border: 1px solid var\(--salty-line\) !important/);
});
t('설정 창 미리보기 사본(css/23-preview.gen.css)도 같은 값', () => {
    const pv = read('css/23-preview.gen.css'), PH = 'body.salty.salty-dem-skin :is(:is(#salty-nochat, .salty-preview)) .mes_text ';
    assert.deepEqual(pad(rule(TABS, pv, PH)), tabs); assert.deepEqual(pad(rule(CAST, pv, PH)), cast); assert.deepEqual(pad(rule(BODY, pv, PH)), bodyPad);
    assert.equal(clipTop(rule(BODY, pv, PH)), cut);
    assert.match(rule(CAST_FIRST, pv, PH), /top: 0 !important;\s*padding-top: 1px !important/);
    assert.ok(pv.includes(PH + FLAT + ' {'), '미리보기 사본에 나눔 선 규칙이 없어요 — node tools/gen-preview-css.js --write');
    assert.ok(pv.includes(PH + FIRST + ' {'), '미리보기 사본에 첫 카드 규칙이 없어요');
});
t('빌드 결과(데우스 스킨 조각 · 대체 파일)에 실렸어요', () => {
    for (const f of ['src/dem-style-data.gen.js', 'src/dem-style-data.fallback.gen.css']) {
        const s = read(f).replace(/\\n/g, '\n').replace(/\\"/g, '"');
        assert.match(s, /\.custom-dem-modules \.custom-dem-tabs \{\s*margin: 0 !important;\s*padding: 12px 16px 11px !important/, `${f}: 탭 줄 — node tools/build-css.cjs`);
        assert.match(s, /:not\(\.custom-dem-charpage\) > \.custom-dem-cast \{\s*top: 0 !important;\s*padding-top: 1px !important/, `${f}: 인물 칩 줄`);
        assert.match(s, /\.custom-dem-modules \.custom-dem-modules__body \{\s*clip-path: inset\(1px 0 0\);/, `${f}: 본문 칸`);
        assert.ok(s.includes('.custom-dem-undercurrents)):not(#salty-none) {'), `${f}: 나눔 선 규칙`);
        assert.ok(s.includes('details.custom-dem-card:first-of-type:not(#salty-none)'), `${f}: 첫 카드 규칙`);
    }
});
t('CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/dem-tab-gap\.mjs \./));
console.log(`dem-tab-gap: ${passed} passed`);
