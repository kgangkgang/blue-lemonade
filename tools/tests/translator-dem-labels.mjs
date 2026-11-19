// 11-19 데우스 카드 위 영어 표지를 화면에서만 한국어로 (src/addons/translator/dem-labels.js)
//   원작 V4 표시 정규식(시험 고정물 · 찾기 그대로)으로 그린 HTML 에 훅을 입혀, 표지만 바뀌고 이름 · 값 · class · data-* 는 그대로인지 봐요.
//   실행: node tools/tests/translator-dem-labels.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyDisplayRegexes } from './translator-preset-harness.mjs';
import { V4_REPLY, V4_MODULE_REGEX } from './translator-v4-module-fixtures.mjs';
const root = path.resolve(process.argv[2] || '.');
const { demLabelsKo, DEM_LABEL_WORDS } = await import(pathToFileURL(path.join(root, 'src/addons/translator/dem-labels.js')).href);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
const attrs = html => [...html.matchAll(/\s(class|data-[\w-]+)="([^"]*)"/g)].map(m => m[0]).join('');

test('V4 카드: 꼬리표 · 일기 빈 칸 · 주사위 막대는 한국어, 새 얼굴 제목(보이는 이름) · 값은 그대로', () => {
    const shown = applyDisplayRegexes(V4_REPLY, V4_MODULE_REGEX), ko = demLabelsKo(shown);
    assert.ok(shown.includes('<span class="dem-card__tag">Recurring</span>') && shown.includes('rolled 72 · need under 45'), '고정물 그림이 예상과 달라요');
    assert.ok(ko.includes('<span class="dem-card__tag">다시 나올 인물</span>') && ko.includes('<span class="dem-card__tag">스쳐 가는 인물</span>'));
    assert.ok(ko.includes('<span class="dem-card__title">the dockhand</span>') && ko.includes('the old woman by the nets'), '새 얼굴 제목은 인물 이름이라 그대로');
    assert.ok(ko.includes('· 굴림 72 · 45 미만이면 성공') && />\s*실패\s*</.test(ko) && ko.includes('운명의 주사위') && !/>\s*failed\s*</.test(ko));
    assert.ok(ko.includes('아직 일기가 없어요') && !ko.includes('No entries yet'));
    assert.ok(ko.includes('이 인물 남겨 두기:') || !shown.includes('Keep this character:'));
    assert.equal(attrs(ko), attrs(shown), 'class · data-* 속성은 하나도 안 바뀌어요');
    for (const keep of ['Tomas Reyes', 'Night two, the dock', 'He reached for the rope without thinking.', 'The rope slides through your palm'])
        assert.ok(ko.includes(keep), `값 「${keep}」는 그대로`);
    assert.equal(demLabelsKo(ko), ko, '두 번 입혀도 같아요');
});
test('V3 묶음 · 모듈 표지: 제목 · 탭 · 칸 이름 · 꼬리표만, 영어 값은 그대로', () => {
    const html = '<details class="dem-modules"><summary><span class="dem-modules__icon"></span><span class="dem-modules__title">DEM Active Modules</span></summary>'
        + '<div class="dem-tabs"><label class="dem-tab dem-tab--all"><span class="dem-tab__label">All</span></label><label class="dem-tab dem-tab--diary"><span class="dem-tab__label">Diaries</span></label></div>'
        + '<details class="dem-card dem-status"><summary><span class="dem-card__title">Status</span></summary><div class="dem-status-row"><strong class="dem-status-row__name">Status</strong>'
        + '<span class="dem-status-row__label dem-status-row__label--physical">Physical</span><span class="dem-status-row__value">Physical exhaustion</span></div></details>'
        + '<details class="dem-card dem-threads"><summary><span class="dem-card__title">Story Threads</span><span class="dem-card__tag">Active</span></summary><span class="dem-thread-tag" data-tag="Current">Current</span> Find the key</details>'
        + '<details class="dem-card dem-hidden-truths"><summary><span class="dem-card__title">Hidden Truths</span></summary><details open class="dem-hidden-truths__spoilers"><summary><span class="dem-card__caret">▸</span>Spoilers</summary>'
        + '<span class="dem-truth-tag" data-kind="Secret">Secret</span><span class="dem-truth-field" data-field="Knows"><span class="dem-truth-field__label">Knows</span><span class="dem-truth-field__v">Mira</span></span></details></details></details>';
    const ko = demLabelsKo(html);
    for (const word of ['데우스 모듈', '>전체<', '>일기장<', '>상태<', '>몸<', '>떡밥<', '>진행 중<', '>지금<', '>숨은 진실<', '스포일러', '>비밀<', '>아는 사람<']) assert.ok(ko.includes(word), word);
    assert.ok(ko.includes('<strong class="dem-status-row__name">Status</strong>'), '인물 이름 칸은 사전에 있는 낱말이어도 그대로');
    assert.ok(ko.includes('Physical exhaustion') && ko.includes('Find the key') && ko.includes('>Mira<'), '값은 그대로');
    assert.equal(attrs(ko), attrs(html), 'data-tag · data-kind · data-field · 판 class 는 그대로(원작 CSS 가 읽어요)');
});
test('실리태번이 붙인 custom- class 도 · dem- 가 없으면 같은 문자열 · 사전에 없는 글자는 그대로', () => {
    assert.equal(demLabelsKo('<span class="custom-dem-card__tag">Passing</span>'), '<span class="custom-dem-card__tag">스쳐 가는 인물</span>');
    const plain = '<p>Recurring Status Fate passed</p>';assert.equal(demLabelsKo(plain), plain);
    assert.equal(demLabelsKo('<span class="dem-card__tag">Recovered</span>'), '<span class="dem-card__tag">되살린 카드</span>', '형식이 깨져 되살린 카드 꼬리표');
    const odd = '<span class="dem-card__tag">Recurring villain</span><span class="dem-card__title">Status report</span>';assert.equal(demLabelsKo(odd), odd, '똑같은 낱말일 때만');
    assert.equal(demLabelsKo('<span class="dem-other">Status</span>'), '<span class="dem-other">Status</span>', '모르는 class 는 그대로');
});
test('굴리는 중 막대 · 성공 막대', () => {
    const rolling = '<div class="dem-fate-rolling" data-no-island style="x"><span style="y"><svg viewBox="0 0 1 1"><path d="M0 0"/></svg>Fate</span> <span>· need under 50</span> <span><span aria-hidden="true"></span><b style="z">rolling…</b></span><span data-no-island></span></div>';
    const ko = demLabelsKo(rolling);
    assert.ok(ko.includes('</svg>운명의 주사위</span>') && ko.includes('· 50 미만이면 성공') && ko.includes('>굴리는 중…</b>'), ko);
    const pass = '<div class="dem-fate"><span>Fate</span> <span>· rolled 12 · need under 60</span> <span><b>passed</b></span></div><p>Fate passed</p>';
    const kp = demLabelsKo(pass);
    assert.ok(kp.includes('<b>성공</b>') && kp.includes('· 굴림 12 · 60 미만이면 성공') && kp.endsWith('<p>Fate passed</p>'), '막대 밖 본문은 그대로');
});
test('사전은 짧은 표지 낱말만(긴 원작 안내 문장 없음) · 한국어 쪽은 영어 없음 · 훅은 스위치로 끄고 켜요', () => {
    for (const dict of Object.values(DEM_LABEL_WORDS)) for (const [en, ko] of Object.entries(dict)) {
        assert.ok(en.length <= 24 && en.split(' ').length <= 3, `긴 원문 「${en}」`); assert.ok(/[가-힣]/.test(ko) && !/[A-Za-z]/.test(ko), `「${ko}」`);
    }
    const index = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8'), html = fs.readFileSync(path.join(root, 'src/addons/translator/index.html'), 'utf8');
    assert.ok(index.includes("extensionSettings.dem_labels_ko !== false && mes.includes('dem-') ? demLabelsKo(mes) : mes") && index.includes('dem_labels_ko: true,'), '기본 켬 · 끄면 원작 그대로');
    assert.ok(index.includes('labels(stageAttrs('), '정규식 뒤 서식 훅(하늘 장면 훅과 같은 자리)');
    assert.ok(html.includes('id="llm_dem_labels_ko"') && index.includes("$('#llm_dem_labels_ko').on('change'"), '번역기 설정의 스위치');
    const src = fs.readFileSync(path.join(root, 'src/addons/translator/dem-labels.js'), 'utf8');
    assert.ok(src.includes('lsennn') && src.includes('CC BY-NC-SA 4.0'), '원작자 표시');
});
console.log(`translator-dem-labels: ${passed} passed`);
