// 1.1.5 설정 창 미리보기 ↔ 실제 설정 맞대기 — 「업데이트된 것 중에 미리보기가 같이 업데이트 안 된 게 많은 듯」(사용자) 뒤에 생긴 지킴이예요.
//   ① 설정 창(src/panel.js)의 조절 칸이 가리키는 설정 경로를 모두 뽑아, 아래 표(COVERAGE)의 한 줄에 걸리는지 봐요.
//      새 옵션이 생겼는데 표가 모르면 실패해요 — 그 옵션을 보여 주는 미리보기 이름을 적거나, 없으면 「미리보기 없음」과 까닭을 적어요.
//      표에만 있고 설정 창에서 사라진 줄도 실패해요(낡은 표가 남지 않게).
//   ② 표에 적은 미리보기는 그 그리기 코드가 아직 있는지 봐요.
//   ③ 1.1.5 에 맞춘 어긋남(퀵 리플라이 « · 책장 · 돋보기 · 고정 단추 · 휴지통 · 넓은 표본 · 톤 · 대사 견본 …)이 다시 벌어지지 않게 실제 쪽 이름과 함께 지켜요.
//   node tools/tests/preview-coverage.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log(`  PASS  ${name}`); } catch (e) { failed++; console.error(`  FAIL  ${name}\n${e.message}`); } };

const panel = read('src/panel.js');

// 미리보기 이름 → 그 미리보기를 그리는 코드(있는지 확인할 글)
const PREVIEWS = {
    '채팅 무대': ['src/panel.js', 'function chatStage('],
    '날씨 미리보기': ['src/weather.js', 'export function previewWeather('],
    '글꼴 견본': ['src/panel.js', 'function sample()'],
    '메뉴 글꼴 견본': ['src/panel.js', 'function uiSample()'],
    '퀵 리플라이 미리보기': ['src/panel.js', 'function qrSample('],
    '폰 모형': ['src/panel.js', 'function phoneMock('],
    '데우스 상태창 무대': ['src/panel.js', 'function regexStage('],
    '그림 무대': ['src/panel.js', 'function imgStage('],
    '마크다운 무대': ['src/panel.js', 'function markdownStage('],
};
const NONE = null;   // 미리보기 없음(까닭을 셋째 칸에)

// [경로 틀(* = 아무 글자), 미리보기 이름 | NONE, 까닭(NONE 이면 꼭)]
const COVERAGE = [
    // 채팅 무대 — 실제 #chat 규칙을 베낀 사본(css/23-preview.gen.css)과 같은 body 클래스 · 변수로 따라와요
    ['chat.user', '채팅 무대'], ['chat.char', '채팅 무대'], ['chat.bubbleSplit', '채팅 무대'], ['chat.header', '채팅 무대'],
    ['chat.userSize', '채팅 무대'], ['chat.userInk', '채팅 무대'], ['chat.icons', '채팅 무대'], ['chat.sentTokens', '채팅 무대'],
    ['st.hideAvatars', '채팅 무대'], ['chat.bgImage', '채팅 무대'], ['chat.bgAlpha', '채팅 무대'],
    ['quick.mesDelete', '채팅 무대'],   // 1.1.5 prevMarks — 연필 앞 휴지통
    ['multiAvatar.*', '채팅 무대'],
    ['*.decor.*', '채팅 무대'], ['*.nameRowAlign', '채팅 무대'], ['*.nameAlign', '채팅 무대'], ['*.nameAuto', '채팅 무대'], ['*.nameItalic', '채팅 무대'],
    ['*.nameUnderline', '채팅 무대'], ['*.nameShadow', '채팅 무대'], ['*.headerLayout', '채팅 무대'], ['*.edge', '채팅 무대'], ['*.edgeAuto', '채팅 무대'],
    ['*.edgeStyle', '채팅 무대'], ['*.edgeShadow', '채팅 무대'], ['*.mode', '채팅 무대'], ['*.side', '채팅 무대'], ['*.metaSide', '채팅 무대'],
    ['*.layout', '그림 무대'], ['*.sizing', '그림 무대'], ['*.fit', '그림 무대'], ['*.original', '채팅 무대'], ['*.*', '채팅 무대'],
    ['chat.inkContrast', NONE, '색 글자 표본(colorStage)이 어디에도 붙어 있지 않아요 — 붙일지 지울지 결정 대기(1.1.5 미리보기 점검 보고)'],
    ['chat.hidden*', NONE, '숨긴 메시지 표본이 없어요 — 표본 메시지를 더하면 미리보기 모양이 바뀌어 결정 대기'],
    ['chat.webSearchMarks', NONE, '웹 검색 표시 표본 없음(작음)'], ['chat.reasoningFollow', NONE, '추론 칸 표본 없음(작음)'], ['chat.codePlain', NONE, '코드블록 표본 없음 · 성능 옵션'],
    // 날씨
    ['chat.weather*', '날씨 미리보기'], ['chat.weather2*', '날씨 미리보기'],
    ['chat.weatherAutoRest', NONE, '생성 · 편집 중 쉬기는 움직임 시점만 바꿔요'],
    // 글자 — 글꼴 견본(.salty-sample) + 채팅 무대가 같은 변수로
    ['fonts.*', '글꼴 견본'], ['type.*', '글꼴 견본'], ['dialogue.*', '글꼴 견본'], ['em.*', '글꼴 견본'], ['strong.*', '글꼴 견본'],
    ['strike.*', '글꼴 견본'], ['code.*', '글꼴 견본'], ['shadow.*', '글꼴 견본'], ['outline.*', '글꼴 견본'],
    ['type.uiSize', '메뉴 글꼴 견본'], ['ui.*', '메뉴 글꼴 견본'],
    // 퀵 리플라이 — 1.1.5 접기 « · 책장 · 요술봉 뒤 접기(쉼)는 실제 줄과 같은 body 클래스로
    ['chat.qr*', '퀵 리플라이 미리보기'], ['qrShelf.on', '퀵 리플라이 미리보기'], ['quick.qrFold', '퀵 리플라이 미리보기'],
    ['chat.hideSendTextarea', '퀵 리플라이 미리보기'],
    // 폰
    ['reader.autoHide', '폰 모형'], ['onehand.*', '폰 모형'],
    ['bgWindow.on', NONE, '보여 줄 모양 없음(백그라운드 동작)'], ['replyNotify.on', NONE, '보여 줄 모양 없음(알림)'],
    // 데우스 · 정규식 카드
    ['deus.*', '데우스 상태창 무대'], ['chat.dem*', '데우스 상태창 무대'], ['chat.unify*', '데우스 상태창 무대'], ['chat.tone.*', '데우스 상태창 무대'],
    ['chat.markerTone.*', '데우스 상태창 무대'], ['chat.regexIcons', '데우스 상태창 무대'], ['chat.triangleFold', NONE, '▲ 접기 단추는 표본 안에서 숨겨요(css/31-styles-panel.css)'],
    // 그림
    ['image.*', '그림 무대'],
    // 미리보기가 없는 동작 · 성능 · 도구 옵션
    ['enabled', NONE, '테마 켜기'], ['apiStatus.on', NONE, '서랍 안 점'], ['auto.by', NONE, '자동 밝기 기준'], ['chat.chatLight', NONE, '성능'],
    ['chat.colorPop', NONE, '도구 팝업'], ['chat.selectPop', NONE, '도구 팝업'], ['chat.emptyGuard', NONE, '저장 동작'], ['chat.homeIcon', NONE, '홈 화면 아이콘(설명 글만)'],
    ['chat.lazyAvatars', NONE, '성능'], ['chat.numComma', NONE, '숫자 칸'], ['chat.persona*', NONE, '페르소나 목록'], ['chat.replyTop', NONE, '스크롤 동작'],
    ['chat.searchIme', NONE, '검색 칸'], ['chat.showMoreAuto', NONE, '불러오기 동작'], ['chat.streamFade', NONE, '스트리밍 동작'], ['st.streamFadeIn', NONE, '스트리밍 동작'],
    ['chat.worldInfoLight', NONE, '성능'], ['chatOrganizer.on', NONE, '서랍 도구'], ['compat.*', NONE, '다른 확장 호환'], ['deviceLayouts.on', NONE, '기기별 설정'],
    ['inputBox.*', NONE, '입력칸 동작'], ['logCopy.on', NONE, '로그 복사 시트가 제 미리보기를 가져요(1.1.5 쪽)'], ['presetFolders.on', NONE, '서랍 도구'], ['promptFolders.on', NONE, '서랍 도구'],
    ['promptSaves.on', NONE, '서랍 도구'], ['quick.*', NONE, '편의 동작(고른 글 고치기 · 범위 지우기 · 에이드 · 로어북 등)'], ['searchAi.on', NONE, '설정 검색'],
];

const toRe = glob => new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
const rules = COVERAGE.map(([glob, preview, why]) => ({ glob, preview, why, re: toRe(glob), hits: 0 }));

/** 설정 창의 조절 칸이 가리키는 경로 — 이름이 박힌 것과 `${prefix}.…` 틀(→ *.…) */
function controlPaths() {
    const out = new Set();
    for (const m of panel.matchAll(/\b(?:toggle|seg|slider|segMulti|color|sizeOpt)\(\s*'([a-zA-Z][\w.]*)'/g)) out.add(m[1]);
    for (const m of panel.matchAll(/\b(?:toggle|seg|slider|segMulti|color|sizeOpt)\(\s*`([^`]*)`/g)) out.add(m[1].replace(/\$\{[^}]*\}/g, '*'));
    for (const m of panel.matchAll(/data-(?:color-path|toggle)="([a-zA-Z][\w.]*)"/g)) out.add(m[1]);
    for (const m of panel.matchAll(/\[\s*'([a-z]\w*\.[\w.]+)'\s*,\s*'[^']*'\s*\]/g)) out.add(m[1]);   // chips([['onehand.swipe', '스와이프'] …
    return [...out].filter(p => p && !p.endsWith('.') && (p.includes('.') || p === 'enabled')).sort();
}
const paths = controlPaths();

test(`설정 창 조절 칸 ${paths.length}개가 모두 미리보기 표에 있어요(새 옵션은 미리보기 이름이나 「미리보기 없음」 까닭을 적어야 통과)`, () => {
    assert.ok(paths.length > 150, `뽑은 경로가 너무 적어요(${paths.length}) — 뽑기 규칙이 깨졌어요`);
    const missing = [];
    for (const p of paths) {
        // 틀(`${prefix}.…` → *.…)로 뽑은 경로는 표의 같은 틀 줄과만, 이름이 박힌 경로는 * 로 시작하지 않는 줄과만 맞대요.
        // 여러 줄에 걸리면 가장 구체적인 줄(같은 글 → 긴 틀) 하나만 셉니다 — 넓은 줄이 좁은 「미리보기 없음」 줄을 삼키지 않게
        //   「*.*」처럼 별과 점뿐인 줄은 같은 글일 때만(새 틀 경로를 통째로 삼키지 않게)
        const exactOnly = r => /^[*.]+$/.test(r.glob);
        const pool = p.includes('*') ? rules.filter(r => exactOnly(r) ? r.glob === p : r.re.test(p)) : rules.filter(r => !r.glob.startsWith('*') && r.re.test(p));
        const rule = pool.find(r => r.glob === p) || pool.sort((a, b) => b.glob.replace(/\*/g, '').length - a.glob.replace(/\*/g, '').length)[0];
        if (rule) rule.hits++; else missing.push(p);
    }
    assert.deepEqual(missing, [], `표에 없는 설정: ${missing.join(', ')}\n  → tools/tests/preview-coverage.mjs COVERAGE 에 [경로, '미리보기 이름'] 또는 [경로, NONE, '까닭'] 을 더하고, 미리보기가 있으면 그 미리보기도 맞춰 주세요`);
});
test('표의 줄은 모두 지금 설정 창에 있는 옵션을 가리켜요(낡은 줄 없음)', () => {
    const stale = rules.filter(r => !r.hits).map(r => r.glob);
    assert.deepEqual(stale, [], `설정 창에 없는 줄: ${stale.join(', ')}`);
});
test('「미리보기 없음」 줄은 까닭이 있고, 적은 미리보기 이름은 모두 아는 이름이에요', () => {
    for (const r of rules) {
        if (r.preview === NONE) assert.ok(r.why && r.why.length >= 2, `${r.glob}: 까닭 없음`);
        else assert.ok(Object.hasOwn(PREVIEWS, r.preview), `${r.glob}: 모르는 미리보기 ${r.preview}`);
    }
});
test('표에 적은 미리보기의 그리기 코드가 아직 있어요', () => {
    for (const [name, [file, needle]] of Object.entries(PREVIEWS)) assert.ok(read(file).includes(needle), `${name}: ${file} 에 ${needle} 없음`);
});

// ───────── ③ 1.1.5 에 맞춘 어긋남 지킴 ─────────
const css45 = read('css/45-preview-view.css'), previewCss = read('src/preview.gen.css'), apply = read('src/apply.js');
test('돋보기: 폰(pointer: coarse)의 기준점 규칙이 떠 있는 돋보기를 상자 밖으로 밀지 않아요', () => {
    assert.match(read('css/86-touch-targets.css'), /\.salty-panel \.bl-view-toggle,/, '기준점 목록에 돋보기가 있어요(그래서 아래 덮개가 필요해요)');
    const rule = 'html body .salty-panel .bl-inline-preview.bl-view-float > .bl-view-toggle:is(#bl-s, *) { position:absolute; }';
    assert.ok(css45.includes(rule), 'css/45-preview-view.css 의 덮개 규칙');
    assert.ok(previewCss.includes('.bl-inline-preview.bl-view-float > .bl-view-toggle'), '빌드한 src/preview.gen.css 에 들어감');
    assert.match(read('src/preview-view.js'), /box\.classList\.add\('bl-view-float'\); box\.append\(toolsToggle\)/, '줄 안 미리보기는 돋보기를 상자 안에 붙여요');
});
test('줄 안 미리보기 규칙은 설정 창을 열 때만 받는 시트로 떼어 둬요(첫 장 · 둘째 장에 없음)', () => {
    assert.match(read('tools/css-park.cjs'), /const PREVIEW = \/[^\n]*\\\.bl-inline-preview/);
    for (const name of ['bl-qr-fold-sample', 'salty-phonemock']) {
        assert.ok(previewCss.includes(name), `src/preview.gen.css 에 ${name}`);
        assert.ok(!read('src/style-lazy.gen.css').includes(name), `둘째 장에 ${name} 이 남았어요`);
        assert.ok(!read('style.css').includes(name), `첫 장에 ${name} 이 남았어요`);
    }
});
test('퀵 리플라이: 접기 « · 책장 견본이 실제 줄과 같은 body 클래스를 따라요', () => {
    assert.match(panel, /bl-qr-fold-sample[^\n]*bl-qr-shelf-sample/, 'qrSample 이 « · 책 견본을 그려요');
    for (const cls of ['salty-qr-fold-off', 'salty-qr-folded', 'salty-qr-shelf']) assert.ok(apply.includes(`'${cls}'`), `apply.js 가 ${cls} 를 붙여요`);
    assert.ok(css45.includes('body.salty-qr-fold-off .bl-inline-preview .bl-qr-sample > .bl-qr-fold-sample'));
    assert.ok(css45.includes('body:not(.salty-qr-shelf) .bl-inline-preview .bl-qr-sample > .bl-qr-shelf-sample'));
    assert.ok(css45.includes('body.salty.salty-qr-folded .salty-panel .bl-inline-preview .bl-qr-sample > :not(.bl-qr-fold-sample, .bl-qr-shelf-sample)'));
    assert.match(read('css/35-qr-bar.css'), /body\.salty\.salty-qr-folded #send_form #qr--bar > :not\(#bl-qr-fold, #bl-qr-shelf\)/, '실제 줄의 접힘 규칙');
    assert.match(panel, /qrSample\([^)]*, s\)\}<\/div>/, '설정을 넘겨 접힘 방향을 그려요');
    assert.match(panel, /q\.label \|\| q\.icon/, '아이콘만 있는 QR 도 그려요');
});
test('폰 모형: 제로 모드는 zeroView 값으로 그려요', () => {
    assert.match(panel, /function phoneMock\(saved\) \{\n\s*const s = zeroView\(saved\);/);
});
test('채팅 무대: 고정한 메시지 버튼 · 연필 앞 휴지통을 실제와 같은 class 로 그리고 사본 규칙도 있어요', () => {
    assert.match(panel, /function prevMarks\(stage\)/);
    assert.match(panel, /prevFaces\(stage\);\n\s*prevMarks\(stage\);/);
    assert.match(read('src/quick/mes-delete.js'), /const CLS = 'bl_mes_del';/, '실제 휴지통 class');
    assert.match(read('src/quick/mes-delete.js'), /mes_button \$\{CLS\} fa-solid fa-trash-can/);
    assert.match(read('tools/gen-preview-css.js'), /const KEEP = \[[\s\S]*?'\.bl-pinned',[\s\S]*?\];/, '사본 남김 목록에 .bl-pinned');
    assert.ok(read('css/23-preview.gen.css').includes('.bl-pinned'), '사본에 고정 버튼 규칙');
    assert.match(panel, /'quick\.mesDelete', 'chat\.weatherArtOutline'\]\.includes\(path\)/, '스위치를 바꾸면 바로 다시 그려요');
});
test('채팅 무대: 글자 탭 PC 넓은 표본에도 아바타 · 고정 단추 · 액자를 붙여요 · 날씨 켬 바탕', () => {
    assert.match(panel, /\.salty-preview\.bl-preview-wide\[data-prev="chat"\][\s\S]{0,200}prevFaces\(st\); prevMarks\(st\);[\s\S]{0,80}syncDecor\(ap\); syncProfileClip\(ap\);/);
    assert.match(read('css/24-previewbox.css'), /:where\(html\.bl-weather-on\) body\.salty\.salty :is\(#salty-nochat, \.salty-preview\):not\([^)]*\) \{ background: var\(--salty-fill-bg, var\(--salty-bg\)\) !important; \}/);
    assert.match(read('css/32-weather.css'), /:where\(html\.bl-weather-on\) body\.salty\.salty #sheld \{\s*background: var\(--salty-fill-bg, var\(--salty-bg\)\) !important;/, '실제 #sheld 바탕이 바뀌면 표본도 같이 고쳐요');
});
test('데우스 무대: 톤 맞추기를 켜 두면 표본 색 글자도 다시 재요', () => {
    assert.match(panel, /kind === 'regex' && document\.body\.classList\.contains\('salty-tone'\)\) import\('\.\/tone\.js'\)\.then\(m => m\.retoneAll\(\)\)/);
    assert.match(read('src/tone.js'), /querySelectorAll\('#chat, \.cg-root, \.salty-preview'\)/, 'tone.js 가 표본(.salty-preview)도 봐요');
});
test('메뉴 글꼴 견본: 메뉴 그라데이션 범위가 견본 class 와 같아요', () => {
    assert.ok(read('src/gradients.js').includes("ui:'.salty-uisample :is(label,span)"));
    assert.ok(panel.includes('<div class="salty-uisample"'));
});
test('대사 견본(스타일 카드 · 처음 안내)이 실제 대사 규칙과 같은 변수를 써요', () => {
    const real = read('css/06-chat-text.css');
    for (const v of ['--salty-marker-bg', '--salty-marker-ink', '--salty-accent-dlg']) assert.ok(real.includes(v), `실제 규칙에 ${v}`);
    const styles = read('css/31-styles-panel.css'), first = read('css/80-first-run.css');
    assert.match(styles, /\.salty-preset-sample q\.m-marker \{\s*background: var\(--salty-marker-bg,/);
    assert.match(styles, /\.salty-preset-sample q\.m-tint \{\s*color: var\(--salty-accent-dlg,/);
    assert.match(first, /q\.is-marker \{ background: var\(--salty-marker-bg,/);
    assert.match(first, /q\.is-tint \{ color: var\(--salty-accent-dlg,/);
});
test('그 밖의 견본: 혼합 견본 밝기 · 보관함 액자 색감 · 가림 칩 밤 색 · 요술봉 메뉴 견본 · 영어 칸 견본 줄', () => {
    assert.match(read('src/gradient-ui.js'), /PALETTES\[paletteVariant\(key,mode\)\]\|\|PALETTES\[paletteVariant\(key,'light'\)\]/);
    assert.match(panel, /thumb\(item\.decor\.art, [^\n]*frameFilter\(item\.decor\)\)/);
    assert.match(read('css/51-integrations.css'), /body\.salty-dark \.bl-mask-sample\[data-mask=tape\] \{ background:#b5cfe5; \}/);
    assert.match(read('src/capture-privacy.js'), /style==='tape'\?\(dark\?'#b5cfe5':'#f7dc84'\)/, '실제 테이프 밤 색이 바뀌면 칩도 같이');
    assert.match(read('src/word-tools.js'), /const wandLine=/);
    assert.match(panel, /SAMPLES\[lang === 'en' \? 'en' : f\.lang \|\| lang\]/);
});
test('CI 등록', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/preview-coverage\.mjs \./);
});

console.log(`\npreview-coverage: ${passed} passed, ${failed} failed (설정 경로 ${paths.length}개 · 표 ${rules.length}줄 · 미리보기 없음 ${rules.filter(r => r.preview === NONE).length}줄)`);
if (failed) process.exit(1);
