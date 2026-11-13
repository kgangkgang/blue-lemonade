#!/usr/bin/env node
/* =========================================================
   style.css 만들기 (3.0.0) — tools/build-css.cjs

   원본은 css/*.css (이름 순서 = 폭포 순서). 이 도구가 차례대로 이어 붙여 style.css 를 쓴다.
   설치 · zip · 깃허브는 지금처럼 style.css 한 파일만 쓴다 (css/ 는 개발용).
   설명 주석은 css/ 에만 두고 style.css 에서는 뺀다 (모듈마다 'css/이름' 표시 주석 한 줄만 남김) — 뺀 결과의 규칙 구조가
   원본과 같은지 매번 확인하고, 다르면 멈춘다. 규칙을 찾을 때는 style.css 의 모듈 표시로 css/ 파일을 연다.

     node tools/build-css.cjs            css/ → style.css
     node tools/build-css.cjs --check    다시 만들면 style.css 와 같은가만 본다 (다르면 종료 코드 1)
     node tools/build-css.cjs --force    style.css 를 손으로 고친 흔적이 있어도 덮어쓴다 (그 고친 것은 사라진다)
     node tools/build-css.cjs --one      한 장 빌드(1.0.0 부터 기본은 두 장: 첫 화면에 안 쓰는 모듈(SPLIT_LAZY)을 src/style-lazy.gen.css 둘째 장으로 — src/lite.js 가 쉴 때 · 서랍을 누를 때 붙인다)

   지키는 것
   · style.css 를 직접 고치면 다음 빌드가 그걸 지운다 → 머리 주석의 해시로 알아채고 멈춘다.
     그럴 땐 고친 규칙을 알맞은 css/ 모듈로 옮긴 뒤 --force.
   · css/99-lazy-panel.css 는 반드시 맨 뒤 (src/lite.js 가 이 칸을 통째로 작은 <style> 로 떼어
     서랍 · 팝업이 열렸을 때만 켠다 — 맨 뒤라서 떼어 내도 폭포 순서가 그대로다). 그 뒤에 모듈을 두면 멈춘다.
   · 모듈 파일 이름: 두 자리 숫자-이름.css (생성 모듈은 .gen.css), 첫 줄은 머리 주석 '/* ===== css/<이름> ====='
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'css');
const OUT = path.join(ROOT, 'style.css');
// 게으른 칸(99-lazy-panel) 만 따로 한 벌 더 — src/lite.js 가 시작할 때 이것만 받는다.
// 예전에는 1.8KB 를 얻으려고 style.css 842KB 를 다시 받아 통째로 문자열로 풀었다.
// src/ 아래여야 한다 — release_gate 의 inventory 는 최상위 4개 + src/**.{js,css} 만 담는다.
const LAZY_OUT = path.join(ROOT, 'src', 'lazy-panel.gen.css');
// 9.0.1 설정 창 미리보기 전용 규칙은 style.css 에 넣지 않고 이 파일로만 — src/lite.js 가 설정 창을 처음 열 때 <link> 로 받는다(안 열면 0KB).
// (10-28 까지는 style.css 안에 `@media not all` 로 꺼 둔 채 싣고 같은 덩어리를 src/preview-park.gen.css 로 한 벌 더 썼다.)
const PREVIEW_OUT = path.join(ROOT, 'src', 'preview.gen.css');
// 8.2.1 「확장만」 · 테마 끔에서 큰 style.css 대신 켜는 가벼운 사본(src/theme-sheet.js) — extText() 참고 (1.0.0 사용 모드와 함께 되살림)
const EXT_OUT = path.join(ROOT, 'style-ext.css');
const LAZY = '99-lazy-panel.css';
// 9.0.1 --split 두 번째 장(쉴 때 받는 시트) — 기본 빌드는 한 장 그대로이고, 4단계(9.0.3)에서 사진 비교와 함께 켠다. 고른 기준: 채팅 · 입력판 · 서랍 겉 · 메뉴가 아닌 설정 창 · 애드온 창 · 편집 화면.
// 9.0.2 부팅 3층(src/boot-layers.js · index.js IDLE_LAYER)과 맞춰 더해요: 그 화면을 그리는 JS 가 3층(유휴 · 처음 쓸 때)에 붙는 모듈의 CSS — 프롬프트 목록 줄(22) · 채팅 지도(60) ·
//   프롬프트 귀속 줄(63, 프롬프트 편집 시트) · 확장 위 스위치(64, 확장 서랍 머리) · 판 알약(75, 서랍 · 애드온 창 머리) · 도움말 ? 단추(76) · 탭 줄(98, 애드온 창) · 프롬프트 템플릿 블록(82) ·
//   설정 창 조각(49 단추 아이콘 · 51 애드온 켜기 · 53 스크립트 · 67 마크다운 · 78 카드 고르기 · 79 상태창 글자 · 81 장면 소리) · 여러 장 프로필 창(71).
//   채팅 위에 그려지는 것(69 웹 검색 지구 · 70 다른 기기 띠)과 2층에서 열리는 고르기 팝업(72) · 왼쪽 서랍 프롬프트 관리자(14 · 59)는 첫 장에 남겨요(덮개가 걷히자마자 쓸 수 있어서).
// 주의: 이 모듈의 규칙이 style.css 뒤로 옮겨 가므로, 같은 특이도로 같은 요소를 겨루는 앞 모듈 규칙과의 차례가 바뀔 수 있다 — 켜기 전에 사진 비교로 확인한다.
// 1.0.0 극한 최적화: 서랍 모듈(14 프롬프트 관리자 · 15 그 밖 서랍 · 59 프롬프트 편집)도 둘째 장으로 — 상단 서랍 아이콘을 누르는 순간(pointerdown · click 캡처) 둘째 장을 붙여요(index.js)
// 1.0.0 커버리지(cand PC · 부팅 때 쓴 규칙 0)로 더: 52 도구 창 · 51 연동 · 80 첫 실행 · 83 테마 끔 · 84 단추 묶음 · 18 밀도(70 동기화 띠는 채팅 위 띠라 첫 장에) · 24 미리보기 틀 · 66 리듬 (26-rounds 는 99-lazy-panel 과 같은 선택자 !important 충돌이라 첫 장에 남김)
const SPLIT_LAZY = new Set(['12-worldinfo.css', '13-characters.css', '14-prompt.css', '15-drawers.css', '59-prompt-ux.css', '52-tool-editor.css', '51-integrations.css', '80-first-run.css', '83-theme-off.css', '84-button-groups.css', '18-density.css', '24-previewbox.css', '66-ui-rhythm.css', '20-panel.css', '21-witidy.css', '22-promptlist.css', '31-styles-panel.css', '33-panel-columns.css', '34-color-pick.css', '44-settings-search.css', '45-preview-view.css', '46-settings-window.css', '47-settings-editor.css', '48-settings-favorites.css', '50-settings-screens.css', '49-role-icons.css', '51-integrations.css', '52-tool-editor.css', '53-script-tools.css', '58-quick-reply-editor.css', '60-chat-graph.css', '63-promptbind.css', '64-headswitch.css', '67-markdown-controls.css', '71-multi-avatar.css', '75-version-pill.css', '76-help-button.css', '78-prompt-card-picker.css', '79-fruit-type.css', '81-scene-sound.css', '82-prompt-template.css', '85-addon-unify.css', '87-addon-touch.css', '96-param-stack.css', '97-param-inline.css', '98-tab-strips.css', '74-log-copy-motion.css']);
const SPLIT_OUT = path.join(ROOT, 'src', 'style-lazy.gen.css');
// 1.0.0 크로미움 밖 · 다른 폭 규칙은 첫 시트에 싣지 않고 따로 — 조건이 맞을 때만 src/lite.js loadCompatCss 가 붙인다 (tools/css-compat.cjs)
const COMPAT_BROWSER_OUT = path.join(ROOT, 'src', 'compat-browser.gen.css');
const COMPAT_WIDTH_OUT = path.join(ROOT, 'src', 'compat-width.gen.css');
const DEM_DATA_OUT = path.join(ROOT, 'src', 'dem-style-data.gen.js');
// 1.1.1 가볍게: css/61-markdown.css 가운데 body 에 마크다운 모양 클래스(body.salty.salty-md-*)가 있어야만 맞는 규칙은 첫 시트에 싣지 않고 이 파일로 —
//   기본값(고른 모양 없음)에서는 하나도 맞지 않아요. src/lite.js syncMarkdownCss 가 고른 모양이 있을 때만 테마 시트 바로 뒤에 붙이고, 전체 시트(둘째 장)에는 제자리에 그대로 있어요
// 1.1.6: 이 분리는 tools/css-gates.cjs(켜짐 규칙 일반화 · 전체 장에서도 뗌)의 md 시트로 합쳤어요 — 파일 이름(MD_OUT)은 그대로예요. markdownSplit · markdownGated 는 옛 시험 · 비교용으로만 남겨 둬요
const MD_OUT = path.join(ROOT, 'src', 'markdown.gen.css');
const MD_MODULE = '61-markdown.css';
// 1.1.6 뗀 규칙 시트를 언제 붙일지 적은 실행 중 표(src/lite.js 가 읽어요) — 켜짐 시트 · 설정 창 시트 파일은 tools/css-gates.json 에
const GATE_TABLE = 'src/css-gates.gen.js';
const DEM_FALLBACK_OUT = path.join(ROOT, 'src', 'dem-style-data.fallback.gen.css');
const LAZY_SENTINEL = '#salty-lazy-panel-start';
const HASH_SLOT = '@@HASH@@';

function modules(dir = CSS_DIR) {
    const names = fs.readdirSync(dir).filter(n => n.endsWith('.css')).sort();
    const bad = names.filter(n => !/^\d\d-[a-z0-9.-]+\.css$/.test(n));
    if (bad.length) throw new Error(`모듈 이름 규칙(두 자리 숫자-이름.css)에 안 맞음: ${bad.join(', ')}`);
    const dup = names.map(n => n.slice(0, 2)).filter((p, i, a) => a.indexOf(p) !== i);
    if (dup.length) throw new Error(`같은 번호가 두 번: ${[...new Set(dup)].join(', ')}`);
    if (!names.includes(LAZY)) throw new Error(`${LAZY} 가 없음`);
    if (names[names.length - 1] !== LAZY) throw new Error(`${LAZY} 뒤에 모듈이 있음: ${names.slice(names.indexOf(LAZY) + 1).join(', ')} — 게으른 칸은 맨 뒤여야 한다`);
    return names;
}

/**
 * 주석 빼기 (3.0.0): 설명은 css/ 모듈에 두고 설치되는 style.css 에서는 뺀다 (730KB → 약 550KB, gzip 150KB → 75KB).
 * 주석 양옆이 둘 다 낱말 글자면(예: `.a/(주석)/.b`, `1px/(주석)/2px`) 빼면 두 토큰이 붙어 뜻이 바뀔 수 있어 그대로 둔다.
 * 문자열 · 따옴표 없는 url( … ) 안은 건드리지 않는다. 빈 줄 · 줄 끝 공백도 정리한다.
 */
function stripCss(text) {
    let out = '';
    let kept = 0;
    let i = 0;
    const SAFE = /[\s{};,]/;
    while (i < text.length) {
        const c = text[i];
        if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < text.length && text[j] !== c && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
            out += text.slice(i, j + 1);
            i = j + 1;
            continue;
        }
        if ((c === 'u' || c === 'U') && /^url\(\s*[^"'\s)]/i.test(text.slice(i, i + 6)) && !/[\w-]/.test(text[i - 1] || '')) {
            const j = text.indexOf(')', i);
            out += text.slice(i, j + 1);
            i = j + 1;
            continue;
        }
        if (c === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            const j = end < 0 ? text.length : end + 2;
            const prev = out[out.length - 1];
            const next = text[j];
            if (prev === undefined || next === undefined || SAFE.test(prev) || SAFE.test(next)) { i = j; continue; }
            kept++;
            out += text.slice(i, j);
            i = j;
            continue;
        }
        out += c;
        i++;
    }
    const tidy = out.split('\n').map(l => l.replace(/[ \t]+$/, '')).filter(l => l.trim()).join('\n');
    return { text: tidy, kept };
}

/** 두 CSS 의 규칙 구조(조건 · 선택자 · 선언)가 같은가 — 주석 빼기가 뜻을 바꾸지 않았는지 */
function sameStructure(a, b) {
    const L = require('./css-lib.cjs');
    const sig = (t) => {
        const out = [];
        const walk = (nodes, ctx) => {
            for (const n of nodes) {
                if (n.type === 'rule') out.push(`${ctx} || ${n.selector} { ${n.decls.map(d => `${d.lname}:${L.stripComments(d.value).replace(/\s+/g, ' ')}${d.important ? '!' : ''}`).join(';')} }`);
                else if (n.type === 'at') { if (n.children) walk(n.children, `${ctx} / ${n.prelude}`); else out.push(`${ctx} @ ${L.stripComments(t.slice(n.start, n.end)).replace(/\s+/g, ' ')}`); }
            }
        };
        const tree = L.parse(t);
        if (tree.problems.length) throw new Error(`읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
        walk(tree.children, '');
        return out;
    };
    const x = sig(a), y = sig(b);
    if (x.length !== y.length) return `규칙 수 ${x.length} ≠ ${y.length}`;
    for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return `${k}번째 규칙이 다름:\n  원본 ${x[k].slice(0, 200)}\n  빌드 ${y[k].slice(0, 200)}`;
    return null;
}

// 5.9.5: 다른 확장이 채팅 메시지와 같은 모양으로 글을 보여 주는 틀 — 선택자의 #chat 을 :is(#chat,.bl-chat-like) 로.
// :is() 의 특이도는 인자 중 가장 높은 것(아이디)이라 폭포가 그대로이고, 문서에 .bl-chat-like 가 없으면 전과 똑같이 맞는다.
// (#chat_import_button 처럼 이어지는 이름은 경계로 거른다. 주석을 뺀 본문에만 — css/ 원본은 손대지 않는다)
const CHAT_ALIAS = ':is(#chat,.bl-chat-like)';
// 8.0.8: `:not(#chat)` 은 `:not(:is(#chat,.bl-chat-like))` 대신 같은 뜻 · 같은 특이도(아이디 1)의 `:where(:not(.bl-chat-like)):not(#chat)` 로 —
// 크롬이 `:not(:is(A,B))` 를 요소마다 두 번 견줘 스크롤바 숨김 규칙(77-scrollbars, 모든 요소 대상)이 문서 전체 다시 계산에서 16.6 → 4.1ms 였다
const NOT_CHAT = '\u0000NOTCHAT\u0000';
function aliasChat(text) { return text.replace(/:not\(#chat\)/g, NOT_CHAT).replace(/#chat(?![\w-])/g, CHAT_ALIAS).split(NOT_CHAT).join(':where(:not(.bl-chat-like)):not(#chat)'); }

function build(dir = CSS_DIR, { bucket = true, key = true, split = true, fan = key } = {}) {   // 1.0.0: 두 장이 기본(--one 이면 split:false)
    const names = modules(dir);
    const raw = [];
    const parts = [];
    const guardedParts = [];
    const extensionColors = { rules: 0, declarations: 0, borderGeometry: 0, focusShadowKept: 0 };
    let kept = 0;
    for (const name of names) {
        let text = fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n');
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        { // control-char guard (7.8.0): CSS 문자열 안 폼피드(0x0C) 하나가 뒤 모듈(77 스크롤바)을 통째로 지우던 사고(10-23). 탭·줄바꿈 말고는 금지
            const bad = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.exec(text);
            if (bad) { const line = text.slice(0, bad.index).split('\n').length; throw new Error(`[build-css] ${name}:${line} control char 0x${bad[0].charCodeAt(0).toString(16).padStart(2, '0')} - CSS string breaks here and later rules vanish; write the escape instead.`); }
        }
        if (name === LAZY && !text.includes(`${LAZY_SENTINEL} {}`)) throw new Error(`${LAZY} 에 시작 표시 규칙 '${LAZY_SENTINEL} {}' 가 없음`);
        // 모듈마다 머리 주석이 있어야 한다 (모듈의 설명 · 넣을 규칙)
        if (!text.startsWith(`/* ===== css/${name} =====`)) throw new Error(`${name} 이 머리 주석 '/* ===== css/${name} =====' 으로 시작하지 않음`);
        raw.push(text);
        const s = stripCss(text);
        kept += s.kept;
        // style.css 에서 어느 모듈인지 보이게 한 줄만
        parts.push(`/* css/${name} */\n${s.text}\n`);
        const guarded = require('./extension-color-guard.cjs').guard(s.text, { moduleName: name });
        for (const key of Object.keys(extensionColors)) extensionColors[key] += guarded.stats[key];
        guardedParts.push({ name, text: `/* css/${name} */\n${guarded.text}\n` });
    }
    const stripped = parts.join('');
    const bad = sameStructure(raw.join('\n'), stripped);
    if (bad) throw new Error(`주석을 뺀 결과가 원본과 구조가 다름 — ${bad}`);
    // 9.0.1 --split: 첫 화면에 안 쓰는 모듈(SPLIT_LAZY — 설정 창 · 애드온 창 · 월드인포 · 캐릭터 편집 …)은 두 번째 장(src/style-lazy.gen.css)으로
    const isLazy = n => split && SPLIT_LAZY.has(n);
    const pipe = (guardedText) => {
        // 3.6.0: 맨 오른쪽 칸이 여러 갈래 :is( … ) 인 선택자를 펼쳐 크롬 규칙 묶음에 넣는다 (tools/css-bucket.cjs — 스스로 뜻 · 특이도를 확인)
        const expanded = bucket ? require('./css-bucket.cjs').bucketize(guardedText).text : guardedText;
        // 9.0.1: 미리보기 전용 규칙은 통째로 떼어 src/preview.gen.css 로 (tools/css-park.cjs — src/lite.js 가 설정 창을 처음 열 때 받는다)
        const previewParked = require('./css-park.cjs').extract(expanded);
        // 1.0.0: 크로미움 최신 · 폰 384 · PC 1280 에서 절대 안 맞는 규칙(되살린 브라우저 대체 · 다른 폭)은 따로 받는 시트 둘로 (tools/css-compat.cjs)
        const compat = require('./css-compat.cjs').extract(previewParked.text);
        const parked = { ...previewParked, text: compat.text };
        // 8.0.8: 맨 오른쪽 칸에 이름이 드러나지 않은 갈래(`:is(#chat,.bl-chat-like)` 여러 갈래 · `:is(.a .b)` 한 갈래 결합자 등)에 `:where(키)` 를 달아
        // 크롬 규칙 바구니에 넣는다 (tools/css-key.cjs — 특이도 · 뜻 · 규칙 순서 · 선언이 같은지 스스로 확인). #chat 바꿔 쓰기 뒤에 — 그 바꿔 쓰기가 전체 바구니 갈래를 만들므로
        const keyed = key ? require('./css-key.cjs').keyize(aliasChat(parked.text)) : { text: aliasChat(parked.text), stats: null };
        const previewKeyed = key ? require('./css-key.cjs').keyize(aliasChat(parked.preview)) : { text: aliasChat(parked.preview), stats: null };
        const compatKey = t => (key ? require('./css-key.cjs').keyize(aliasChat(t)).text : aliasChat(t));
        // 1.0.0: :has() 앞 지킴(tools/css-has-guard.cjs) — 앞 칸이 안 맞는 요소는 :has() 를 견주지 않아요
        keyed.text = require('./css-has-guard.cjs').guardHas(keyed.text).text;
        // 1.4.x(작업자 D): 조상 칸이 여러 갈래 :is 뿐이라 빠른 거절이 안 되는 갈래를 펼쳐요 (tools/css-fanout.cjs — 특이도 · 규칙 수 · 선언이 같은지 스스로 확인)
        //   펼친 갈래에도 바구니 열쇠를 다시 달아요(:where 로 감싼 갈래 · 미리보기 더미 아이디 꼴) — 열쇠 달기는 두 번 돌려도 같아요
        if (fan) keyed.text = require('./css-key.cjs').keyize(require('./css-fanout.cjs').fanout(keyed.text).text).text;
        // 1.1.6 css-gates 가 차례를 따질 때 쓰는 글: 미리보기 · 호환을 떼기 전(expanded) · 미리보기만 뗀 글 · 둘 다 뗀 글
        return { parked, keyed, previewText: previewKeyed.text, compat: { ...compat, browser: compat.browser && compatKey(compat.browser), width: compat.width && compatKey(compat.width) }, order: { expanded, parkText: previewParked.text, compatText: compat.text } };
    };
    // 1.0.0: 둘째 장 모듈에 든 문서 뿌리 변수 규칙(body.salty · :root · html 에 --변수만)은 첫 장에도 같은 자리(모듈 차례)에 둬요 —
    //   빼 두면 서랍을 열기 전까지 폰의 --bl-gutter · --bl-inset 같은 값이 전체 시트와 달랐어요(21-witidy 의 폰 여백 · 사진 비교 「새 판 확인 창」 1px)
    const core = pipe(guardedParts.map(x => (isLazy(x.name) ? rootVarRules(x.text) : x.text)).join(''));
    const lazyNames = names.filter(isLazy);
    const rest = lazyNames.length ? pipe(guardedParts.filter(x => isLazy(x.name)).map(x => x.text).join('')) : null;
    // 1.0.0 두 장 빌드: 미리보기 시트 · 호환 시트는 한 장일 때와 똑같은 차례여야 해요(모듈을 둘로 나눠 돌리면 둘째 장 모듈의 미리보기 규칙이 뒤로 몰려요) — 전체를 한 번 더 돌려 그쪽에서 가져와요
    const whole = rest ? pipe(guardedParts.map(x => x.text).join('')) : core;
    const parked = whole.parked;
    const keyed = core.keyed;
    // 나눈 빌드 표시: 맨 앞 변수 하나 — src/lite.js loadSplitCss 가 쉴 때 이 값을 보고 두 번째 장을 붙인다
    // 떼어 낸 크로미움 밖 · 다른 폭 규칙(전체 차례 그대로)
    const compat = { browser: whole.compat.browser, width: whole.compat.width, rules: { browser: whole.compat.rules.browser, width: whole.compat.rules.width },
        supports: [...new Set(whole.compat.supports)].sort(), media: [...new Set(whole.compat.media)].sort() };   // 정렬 — 한 장 · 두 장 빌드가 같은 표식을 쓰게
    for (const v of [...compat.supports, ...compat.media]) if (/["\\|]/.test(v)) throw new Error(`떼어 낸 조건에 따옴표 · 역사선 · | 가 있어 표식에 못 적음: ${v}`);
    // 맨 앞 :root 표식 — src/lite.js 가 테마 시트의 첫 규칙에서 읽는다: --bl-css-split(나눈 빌드면 쉴 때 두 번째 장) ·
    //   --bl-compat-supports(이 중 하나라도 CSS.supports 가 참이면 브라우저 시트) · --bl-compat-media(이 중 하나라도 맞으면 폭 시트, | 로 나누고 & 는 그리고)
    const marks = [rest ? '--bl-css-split:1' : '', compat.supports.length ? `--bl-compat-supports:"${compat.supports.join('|')}"` : '', compat.media.length ? `--bl-compat-media:"${compat.media.join('|')}"` : ''].filter(Boolean);
    // 1.0.0 극한 최적화: 두 장 빌드면 첫 장에서 닫힌 서랍 · 테마 창 안에서만 맞는 규칙을 빼요(tools/css-scope-defer.cjs) — 전체 시트(둘째 장)는 그대로
    //   99 꼬리(#salty-lazy-panel-start 뒤 · src/lite.js 가 따로 떼어 켜고 끄는 서랍 전용 칸)는 그대로 둬요
    const scoped = (() => {
        if (!rest) return { text: keyed.text, stats: null };
        const at = keyed.text.lastIndexOf(`${LAZY_SENTINEL} {}`);
        const head = at >= 0 ? keyed.text.slice(0, at) : keyed.text, tail = at >= 0 ? keyed.text.slice(at) : '';
        const out = require('./css-scope-defer.cjs').deferScoped(head, require('./css-scope-defer.cjs').scopeTokens(ROOT));
        return { text: out.text + tail, stats: out.stats };
    })();
    // 1.1.6 CSS 줄이기 첫 걸음(tools/css-gates.cjs · 기준 tools/css-gates.json): 기본값에서 하나도 안 맞는 규칙(글자 외곽선 · 고른 마크다운 모양 …)과
    //   테마 설정 창(.salty-panel) 안에서만 맞는 규칙을 첫 장 · 전체 장 둘 다에서 떼어 작은 시트로 — src/lite.js 가 그 설정을 켤 때 · 설정 창을 만들기 전에 붙여요.
    //   덮어쓰기 차례가 바뀔 수 있는 규칙은 도구가 제자리에 남겨요(tools/tests/css-gates-order.mjs). 두 장 빌드만 — 한 장이면 그대로예요(1.1.1 마크다운 분리도 이리로 합쳤어요)
    const gates = rest ? gatePlan(whole) : null;
    const firstText = gates ? require('./css-gates.cjs').strip(scoped.text, gates.moved).text : scoped.text;
    const fullText = gates ? require('./css-gates.cjs').strip(whole.keyed.text, gates.moved).text : whole.keyed.text;
    const dem = require('./css-dem-slots.cjs').compileDemSheets(firstText, rest ? fullText.replace(/^[ \t]+$/gm, '') : null);
    if (dem.count) marks.push(`--bl-dem-style-key:"${dem.key}"`);
    const body = (marks.length ? `:root{${marks.join(';')}}\n` : '') + dem.boot;
    const head = `/* Blue Lemonade style.css — tools/build-css.cjs 가 css/ 의 모듈 ${names.length - lazyNames.length}개를 이어 붙여 만든 파일(설명 주석은 css/ 에만${rest ? ` · --split: 나머지 ${lazyNames.length}개는 src/style-lazy.gen.css` : ''}). 여기서 고치지 말고 css/ 를 고친 뒤 node tools/build-css.cjs (build ${HASH_SLOT}) */\n`;
    const draft = head + body;
    const digest = hashOf(draft);
    const preview = `/* src/preview.gen.css — tools/build-css.cjs 가 설정 창 미리보기 전용 규칙 ${parked.rules}개(덩어리 ${parked.blocks}개)를 style.css 에서 떼어 적은 것(고치지 말 것). src/lite.js 가 설정 창을 처음 열 때 <link> 로 받는다 (build ${digest}) */\n${whole.previewText}\n`;
    // 둘째 파일은 빠진 모듈만 뒤에 덧붙이지 않고 원래 모듈 순서 전체를 담아요.
    // 처음 사용할 때 lite.js가 원문에서99꼬리를 나눈 뒤 이 전체 시트로 첫 시트를 교체해요.
    const lazyText = rest ? `/* src/style-lazy.gen.css — 원래 모듈 순서 전체예요. 처음 사용하면 첫 시트를 끄고 이 시트를 켜요. 99꼬리는 원문 그대로 별도 제어해요 (build ${digest}) */\n${marks.length ? `:root{${marks.join(';')}}\n` : ''}${dem.full}` : null;
    if (lazyText) assertInlineSafe(lazyText);
    const gateFiles = gateOutputs(gates, digest);
    const compatHead = (file, what) => `/* ${file} — tools/build-css.cjs 가 css/ 에서 ${what}만 떼어 적은 것(고치지 말 것 · tools/css-compat.cjs). src/lite.js loadCompatCss 가 조건이 맞을 때만 테마 시트 뒤에 붙인다 (build ${digest}) */\n`;
    const compatBrowser = compatHead('src/compat-browser.gen.css', `크로미움 밖 브라우저 · 강제 색 · 옛 크로미움용 규칙 ${compat.rules.browser}개`) + (compat.browser ? `${compat.browser}\n` : '');
    const compatWidth = compatHead('src/compat-width.gen.css', `폰 384 · PC 1280 밖 화면 폭 규칙 ${compat.rules.width}개`) + (compat.width ? `${compat.width}\n` : '');
    return { text: draft.replace(HASH_SLOT, digest), preview, gateFiles, gates, gateInput: rest ? { order: whole.order, full: whole.keyed.text, first: scoped.text } : null, lazyText, compatBrowser, compatWidth, compat, dem, names, digest, kept, parked, extensionColors, keyed: keyed.stats, scoped: scoped.stats };
}
/** 1.1.6 뗄 규칙 정하기 — 차례는 미리보기 · 호환을 떼기 전 글로(tools/css-gates.cjs plan) */
function gatePlan(whole) {
    const G = require('./css-gates.cjs'), lib = require('./css-lib.cjs');
    const keys = text => { const cut = text.lastIndexOf(`${LAZY_SENTINEL} {}`); const head = cut >= 0 ? text.slice(0, cut) : text; return lib.flatRules(lib.parse(head)).map(r => G.keyOf(head, r)); };
    const left = new Map();
    for (const k of keys(whole.order.compatText)) left.set(k, (left.get(k) || 0) + 1);
    const compatKeys = [];
    for (const k of keys(whole.order.parkText)) { if (left.get(k)) left.set(k, left.get(k) - 1); else compatKeys.push(k); }
    return G.plan({ order: whole.order.expanded, previewOnly: require('./css-park.cjs').previewOnly, compatKeys, final: whole.keyed.text });
}
/** 켜짐 시트 · 설정 창 시트 글과 실행 중 표(src/css-gates.gen.js) — { 파일 경로: 글 | null(지움) } */
function gateOutputs(gates, digest) {
    const G = require('./css-gates.cjs');
    const cfg = G.loadConfig();
    const out = {};
    const all = [...cfg.sheets.map(s => s.out), cfg.panel.out];
    for (const file of all) out[file] = null;
    if (gates) for (const g of gates.groups) {
        if (!g.rules.length) continue;
        assertInlineSafe(g.text);   // 전체 장(상대 URL 없음)에서 온 규칙이라 src/ 에 두어도 주소 뜻이 같아요
        const when = g.kind === 'panel' ? '테마 설정 창을 만들기 전에(index.js loadPanel · first-run.js)' : `body 에 ${[...g.trig].sort().slice(0, 6).join(' · ')}${g.trig.size > 6 ? ` 외 ${g.trig.size - 6}개` : ''} 가 붙기 전에`;
        out[g.out] = `/* ${g.out} — tools/build-css.cjs 가 tools/css-gates.cjs 기준으로 첫 장 · 전체 장에서 뗀 규칙 ${g.rules.length}개(${g.what || g.id}) — 고치지 말 것. src/lite.js 가 ${when} 테마 시트 뒤에 붙여요 (build ${digest}) */\n${g.text}\n`;
    }
    const table = gates ? G.runtimeTable(gates.groups, cfg) : { gates: [], panel: null };
    out[GATE_TABLE] = `// 생성 파일 — tools/build-css.cjs (tools/css-gates.cjs · tools/css-gates.json). 고치지 말 것.\n// 켜짐 시트: body 에 클래스(classes) 나 접두사(prefixes) 로 시작하는 클래스가 하나라도 붙을 때 필요해요(src/lite.js syncGateCss). 차례 = 붙는 차례.\nexport const GATE_SHEETS = ${JSON.stringify(table.gates)};\n// 테마 설정 창(.salty-panel) 안에서만 맞는 규칙 시트(src/lite.js panelCssReady) — 없으면 null\nexport const PANEL_SHEET = ${JSON.stringify(table.panel)};\n`;
    return out;
}
/**
 * 1.1.1 가볍게: 첫 시트 글에서 css/61-markdown.css 칸의 맨 위 규칙 가운데 모든 갈래가 body.salty.salty-md-* 를 요구하는 것만 떼어요(차례 그대로).
 * 그 밖(설정 창 표본 .bl-markdown-stage · 요소 클래스 .salty-md-mark 같은 것)은 제자리에 둬요. 떼어 낸 규칙은 기본값에서 맞지 않고,
 * 뒤 모듈 규칙과 같은 요소를 같은 특이도로 겨루지 않아요(tools/tests/markdown-css-split.mjs 가 매번 확인).
 */
function markdownSplit(text) {
    const lib = require('./css-lib.cjs');
    const mark = `/* css/${MD_MODULE} */\n`;
    const a = text.indexOf(mark);
    if (a < 0) return { text, md: '', rules: 0 };
    const end = text.indexOf('\n/* css/', a + mark.length);
    const b = end < 0 ? text.length : end + 1;
    const section = text.slice(a, b);
    const tree = lib.parse(section);
    if (tree.problems.length) throw new Error(`마크다운 칸 읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
    const moved = [];
    let kept = '', at = 0;
    for (const node of tree.children) {
        if (node.type !== 'rule' || !lib.topSplit(node.selector).every(markdownGated)) continue;
        let stop = node.end;
        if (section[stop] === '\n') stop++;
        kept += section.slice(at, node.start);
        moved.push(section.slice(node.start, node.end));
        at = stop;
    }
    kept += section.slice(at);
    return { text: text.slice(0, a) + kept + text.slice(b), md: moved.join('\n'), rules: moved.length };
}
/** 선택자 한 갈래가 body.salty.salty-md-* 를 꼭 요구하나 — 괄호 밖 첫 칸이 body 이고 그 칸에 .salty 와 .salty-md-* 가 함께 */
function markdownGated(sel) {
    let depth = 0, outside = '';
    for (const c of sel) { if (c === '(') depth++; else if (c === ')') depth--; else if (!depth) outside += c; }
    const lead = outside.trim().split(/[\s>+~]+/)[0];
    return /^body(?:[.:][\w-]+)*$/.test(lead) && /\.salty(?![\w-])/.test(lead) && /\.salty-md-[\w-]+/.test(lead);
}
function hashOf(textWithSlot) {
    return crypto.createHash('sha1').update(textWithSlot, 'utf8').digest('hex').slice(0, 12);
}
/** style.css 가 마지막 빌드 그대로인가 (머리 주석의 해시로) */
function untouched(text) {
    const m = /\(build ([0-9a-f]{12})\) \*\/\n/.exec(text.slice(0, 400));
    if (!m) return false;
    return hashOf(text.replace(`(build ${m[1]})`, `(build ${HASH_SLOT})`)) === m[1];
}

// 1.0.0 극한 최적화: 채팅 모양 시트(src/chat-appearance.css · 손으로 고치는 원본)는 브라우저에 주석 없이 · 바구니 열쇠 · :has 지킴을 단 사본(.gen.css)으로 줘요(dist 가 이 사본을 가리켜요)
const APPEARANCE_IN = path.join(ROOT, 'src', 'chat-appearance.css');
const APPEARANCE_OUT = path.join(ROOT, 'src', 'chat-appearance.gen.css');
function appearanceText() {
    const raw = fs.readFileSync(APPEARANCE_IN, 'utf8').replace(/\r\n/g, '\n');
    const plain = stripCss(raw).text.replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n');
    const expanded = require('./css-bucket.cjs').bucketize(plain).text;
    const keyed = require('./css-key.cjs').keyize(expanded).text;
    return `/* 생성 파일 — tools/build-css.cjs (원본 src/chat-appearance.css) */\n${require('./css-has-guard.cjs').guardHas(keyed).text}`;
}

/** 문서 뿌리(body.salty · body · :root · html …)에 사용자 정의 속성(--x)만 적은 규칙과 그 @media/@supports 겉만 남겨요 */
function rootVarRules(text) {
    const ROOT = /^(?:html|:root|body)(?:[.#][\w-]+|:not\([^()]*\)|\[[^\]]*\])*$/;
    const walk = src => {
        let out = '', i = 0;
        while (i < src.length) {
            const open = src.indexOf('{', i); if (open < 0) break;
            let depth = 1, k = open + 1, quote = null;
            while (k < src.length && depth) { const c = src[k]; if (quote) { if (c === quote && src[k - 1] !== '\\') quote = null; } else if (c === '"' || c === "'") quote = c; else if (c === '{') depth++; else if (c === '}') depth--; k++; }
            const head = src.slice(i, open); const cut = Math.max(head.lastIndexOf(';'), head.lastIndexOf('}'));
            const prelude = (cut >= 0 ? head.slice(cut + 1) : head).replace(/\/\*[\s\S]*?\*\//g, '').trim();
            const body = src.slice(open + 1, k - 1);
            if (/^@(media|supports)\b/.test(prelude)) { const inner = walk(body); if (inner.trim()) out += `${prelude} {\n${inner}}\n`; }
            else if (!prelude.startsWith('@') && prelude.split(',').every(part => ROOT.test(part.trim()))) {
                const decls = body.split(';').map(d => d.trim()).filter(Boolean);
                if (decls.length && decls.every(d => d.startsWith('--'))) out += `${prelude} {${body}}\n`;
            }
            i = k;
        }
        return out;
    };
    const head = /^\/\* css\/[\w.-]+ \*\/\n/.exec(text);
    const rules = walk(text);
    return rules ? `${head ? head[0] : ''}${rules}` : '';
}

function firstDiff(a, b) {
    const la = a.split('\n'), lb = b.split('\n');
    for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) return { line: i + 1, was: la[i], now: lb[i] };
    return null;
}

function main(argv) {
    const check = argv.includes('--check');
    const force = argv.includes('--force');
    // 1.0.0: 두 장이 기본(첫 화면에 안 쓰는 모듈은 src/style-lazy.gen.css — src/lite.js 가 쉴 때 · 서랍을 누를 때 붙여요). --one 이면 예전처럼 한 장
    const split = !argv.includes('--one');
    // 9.0.9 애드온 CSS 한 장(src/addons/style-addons.css · tools/build-addon-css.mjs)도 같이 만들거나(--check 면 확인만) — 생성물 한 번에 다시 쓰기 · 게이트 확인이 같이 잡게
    const addon = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'build-addon-css.mjs'), ...(check ? ['--check'] : [])], { cwd: ROOT, encoding: 'utf8' });
    if (addon.stdout) process.stdout.write(addon.stdout);
    if (addon.stderr) process.stderr.write(addon.stderr);
    if (addon.status !== 0) return 1;
    {
        const want = appearanceText(), had = fs.existsSync(APPEARANCE_OUT) ? fs.readFileSync(APPEARANCE_OUT, 'utf8') : null;
        if (want !== had) {
            if (check) { console.error('[다름] src/chat-appearance.gen.css 가 원본과 어긋났다 — node tools/build-css.cjs 로 다시 만들 것'); return 1; }
            fs.writeFileSync(APPEARANCE_OUT, want, 'utf8'); console.log(`[씀] src/chat-appearance.gen.css (${(Buffer.byteLength(want) / 1024).toFixed(1)}KB)`);
        }
    }
    const { text, preview, gateFiles, gates, lazyText, compatBrowser, compatWidth, compat, dem, names, parked, keyed } = build(CSS_DIR, { split });
    const readOr = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
    const demOk = () => readOr(DEM_DATA_OUT) === dem.data && readOr(DEM_FALLBACK_OUT) === dem.fallback;
    const writeDem = () => { fs.writeFileSync(DEM_DATA_OUT, dem.data, 'utf8'); fs.writeFileSync(DEM_FALLBACK_OUT, dem.fallback, 'utf8'); console.log(`[씀] 데우스 분리 규칙 ${dem.count}칸과 대체 파일을 만들었어요`); };
    const compatOk = () => readOr(COMPAT_BROWSER_OUT) === compatBrowser && readOr(COMPAT_WIDTH_OUT) === compatWidth;
    const writeCompat = () => { fs.writeFileSync(COMPAT_BROWSER_OUT, compatBrowser, 'utf8'); fs.writeFileSync(COMPAT_WIDTH_OUT, compatWidth, 'utf8'); console.log(`[씀] src/compat-browser.gen.css ${(Buffer.byteLength(compatBrowser) / 1024).toFixed(1)}KB(규칙 ${compat.rules.browser}) · src/compat-width.gen.css ${(Buffer.byteLength(compatWidth) / 1024).toFixed(1)}KB(규칙 ${compat.rules.width})`); };
    // 1.1.6 뗀 규칙 시트들(1.1.1 마크다운 시트 포함) · 실행 중 표 — 내용이 없으면(한 장 빌드 · 뗀 규칙 없음) 파일을 지워요
    const mdOk = () => Object.entries(gateFiles).every(([file, want]) => readOr(path.join(ROOT, file)) === want);
    const writeMd = () => {
        for (const [file, want] of Object.entries(gateFiles)) {
            const abs = path.join(ROOT, file);
            if (want != null) { if (readOr(abs) !== want) { fs.writeFileSync(abs, want, 'utf8'); console.log(`[씀] ${file} (${(Buffer.byteLength(want) / 1024).toFixed(1)}KB)`); } }
            else if (fs.existsSync(abs)) { fs.unlinkSync(abs); console.log(`[지움] ${file}`); }
        }
        if (gates) console.log(`[css-gates] ${gates.groups.filter(g => g.rules.length).map(g => `${g.id} ${g.rules.length}`).join(' · ')} · 차례 때문에 제자리에 남긴 규칙 ${gates.kept.length}개`);
    };
    const splitOk = () => (fs.existsSync(SPLIT_OUT) ? fs.readFileSync(SPLIT_OUT, 'utf8') : null) === lazyText;
    const writeSplit = () => { if (lazyText != null) { fs.writeFileSync(SPLIT_OUT, lazyText, 'utf8'); console.log(`[씀] src/style-lazy.gen.css (${(Buffer.byteLength(lazyText) / 1024).toFixed(1)}KB, --split)`); } else if (fs.existsSync(SPLIT_OUT)) { fs.unlinkSync(SPLIT_OUT); console.log('[지움] src/style-lazy.gen.css (한 장 빌드)'); } };
    const ext = extText(text, lazyText);
    const extOk = () => (fs.existsSync(EXT_OUT) ? fs.readFileSync(EXT_OUT, 'utf8') : null) === ext;
    const writeExt = () => { fs.writeFileSync(EXT_OUT, ext, 'utf8'); console.log(`[씀] style-ext.css (${(Buffer.byteLength(ext) / 1024).toFixed(1)}KB)`); };
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
    if (check) {
        if (current === text) {
            if (!demOk()) { console.error('[다름] 데우스 분리 내용이 테마 시트와 어긋났어요'); return 1; }
            // 9.0.1: 미리보기 시트도 같은가 — 다르면 다시 만들게
            const hadPreview = fs.existsSync(PREVIEW_OUT) ? fs.readFileSync(PREVIEW_OUT, 'utf8') : null;
            if (hadPreview !== preview) { console.error('[다름] src/preview.gen.css 가 css/ 의 미리보기 전용 규칙과 어긋났다 — node tools/build-css.cjs 로 다시 만들 것'); return 1; }
            if (!compatOk()) { console.error('[다름] src/compat-browser.gen.css · src/compat-width.gen.css 가 css/ 의 크로미움 밖 · 다른 폭 규칙과 어긋났다 — node tools/build-css.cjs 로 다시 만들 것'); return 1; }
            if (!mdOk()) { console.error('[다름] 뗀 규칙 시트(src/markdown.gen.css · src/gate-*.gen.css · src/panel.gen.css) · src/css-gates.gen.js 가 css/ 와 어긋났다 — node tools/build-css.cjs 로 다시 만들 것'); return 1; }
            if (!splitOk()) { console.error(`[다름] src/style-lazy.gen.css 가 ${split ? '--split 빌드와 어긋났다' : '한 장 빌드인데 남아 있다'} — node tools/build-css.cjs${split ? ' --split' : ''} 로 다시 만들 것`); return 1; }
            if (!extOk()) { console.error('[다름] style-ext.css 가 style.css 와 어긋났다 — node tools/build-css.cjs 로 다시 만들 것'); return 1; }
            console.log(`[같음] style.css = css/ 모듈 ${names.length}개`); return 0;
        }
        const d = current == null ? null : firstDiff(current, text);
        console.error(`[다름] style.css 가 css/ 와 어긋났다${d ? ` — ${d.line}번째 줄\n  지금: ${String(d.was).slice(0, 160)}\n  빌드: ${String(d.now).slice(0, 160)}` : ''}`);
        console.error(current && !untouched(current) ? '  style.css 를 손으로 고친 흔적이 있다 → 고친 규칙을 css/ 로 옮기고 node tools/build-css.cjs --force' : '  node tools/build-css.cjs 로 다시 만들 것');
        return 1;
    }
    if (current === text) {
        if (!demOk()) writeDem();
        // style.css 가 이미 최신이어도 꼬리 파일은 없거나 어긋날 수 있다 (처음 도입 · 손으로 지움)
        const tail = lazyTail(text);
        const had = fs.existsSync(LAZY_OUT) ? fs.readFileSync(LAZY_OUT, 'utf8') : null;
        if (had !== tail) { fs.writeFileSync(LAZY_OUT, tail, 'utf8'); console.log(`[씀] src/lazy-panel.gen.css (${(Buffer.byteLength(tail) / 1024).toFixed(1)}KB)`); }
        const hadPreview = fs.existsSync(PREVIEW_OUT) ? fs.readFileSync(PREVIEW_OUT, 'utf8') : null;
        if (hadPreview !== preview) { fs.writeFileSync(PREVIEW_OUT, preview, 'utf8'); console.log(`[씀] src/preview.gen.css (${(Buffer.byteLength(preview) / 1024).toFixed(1)}KB)`); }
        if (!splitOk()) writeSplit();
        if (!mdOk()) writeMd();
        if (!compatOk()) writeCompat();
        if (!extOk()) writeExt();
        console.log(`[그대로] style.css 가 이미 최신 (모듈 ${names.length}개)`);
        return 0;
    }
    if (current != null && !untouched(current) && !force) {
        const d = firstDiff(current, text);
        console.error('[멈춤] style.css 가 마지막 빌드 뒤에 손으로 고쳐졌다 — 덮어쓰면 그 고친 것이 사라진다.');
        if (d) console.error(`  처음 다른 곳 ${d.line}번째 줄\n  지금: ${String(d.was).slice(0, 160)}\n  빌드: ${String(d.now).slice(0, 160)}`);
        console.error('  고친 규칙을 알맞은 css/ 모듈로 옮긴 뒤 node tools/build-css.cjs --force');
        return 1;
    }
    fs.writeFileSync(OUT, text, 'utf8');
    fs.writeFileSync(LAZY_OUT, lazyTail(text), 'utf8');
    fs.writeFileSync(PREVIEW_OUT, preview, 'utf8');
    writeDem();
    writeSplit();
    writeMd();
    writeCompat();
    writeExt();
    console.log(`[씀] style.css ← css/ 모듈 ${names.length}개 (${(Buffer.byteLength(text) / 1024).toFixed(1)}KB) · src/lazy-panel.gen.css ${(Buffer.byteLength(lazyTail(text)) / 1024).toFixed(1)}KB · 미리보기 전용 규칙 ${parked.rules}개(덩어리 ${parked.blocks}개)를 src/preview.gen.css ${(Buffer.byteLength(preview) / 1024).toFixed(1)}KB 로 떼어 둠${keyed ? ` · 바구니 열쇠 ${keyed.keyed}갈래(전체 바구니 ${keyed.universal} 중, 남음 ${keyed.universal - keyed.keyed})` : ''}`);
    return 0;
}

if (require.main === module) {
    try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(`[오류] ${e.message}`); process.exitCode = 1; }
}

/** style.css 에서 게으른 칸 시작 표시 뒤를 그대로 잘라 낸다 (src/lite.js 가 비교하는 글과 같아야 한다) */
function lazyTail(text) {
    const mark = `${LAZY_SENTINEL} {}`;
    const at = text.lastIndexOf(mark);
    if (at < 0) throw new Error(`style.css 에 게으른 칸 표시 '${mark}' 가 없음`);
    return text.slice(at + mark.length);
}

/**
 * 8.2.1 「확장만」 · 테마 끔용 가벼운 사본(style-ext.css). 확장만 모드에서는 body 에서 salty 를 떼서(src/usage-mode.js) style.css 규칙의 9할이
 * 하나도 맞지 않는데도, 브라우저는 다시 계산할 때마다 그 규칙들을 견줬다(폰 4배: 부팅 스타일 재계산 순정 0.5초 → 1.5초 · 10-29 커뮤니티 제보).
 * 그래서 테마가 꺼진 동안은 큰 시트를 끄고 이 사본을 켠다(src/theme-sheet.js). 빼는 것은 셋 — 그 모드에서 원래 하나도 맞지 않던 것만:
 *   ① body.salty 가 꼭 있어야 맞는 선택자(괄호 밖에 body.salty 가 있는 갈래 — :not(.salty) · :is( … ) 안은 남김)
 *   ② 미리보기 전용 덩어리(@media not all — src/lite.js 가 preview-park.gen.css 로 따로 켬)  ③ 게으른 칸 꼬리(lite.js 가 lazy-panel.gen.css 로 따로 켬)
 * 남는 규칙은 원문 그대로 · 같은 차례예요(갈래 일부만 빠진 규칙은 남은 갈래만 다시 적음).
 */
function extText(text, lazyText = null) {
    const lib = require('./css-lib.cjs');
    const full = lazyText || text;
    const cut = full.lastIndexOf(`${LAZY_SENTINEL} {}`);
    if (cut < 0) throw new Error(`style.css 에 게으른 칸 표시가 없음`);
    let body = full.slice(0, cut);
    const tree = lib.parse(body);
    if (tree.problems.length) throw new Error(`가벼운 사본 읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
    const splitTop = sel => { const out = []; let depth = 0, from = 0; for (let i = 0; i < sel.length; i++) { const c = sel[i]; if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; else if (c === ',' && depth === 0) { out.push(sel.slice(from, i).trim()); from = i + 1; } } out.push(sel.slice(from).trim()); return out.filter(Boolean); };
    const outside = sel => { let depth = 0, s = ''; for (const c of sel) { if (c === '(') depth++; else if (c === ')') depth--; else if (depth === 0) s += c; } return s; };
    const needsTheme = sel => /(^|[\s>+~])body\.salty(?![\w-])/.test(outside(sel));
    const GROUP = new Set(['media', 'supports', 'container', 'layer', 'scope', 'document']);
    let kept = 0, dropped = 0;
    const emit = nodes => {
        const out = [];
        for (const n of nodes) {
            if (n.type === 'rule') {
                const parts = splitTop(n.selector), keep = parts.filter(p => !needsTheme(p));
                if (!keep.length) { dropped++; continue; }
                kept++;
                out.push(keep.length === parts.length ? body.slice(n.start, n.end) : `${keep.join(',\n')} {${body.slice(n.bodyStart, n.bodyEnd)}}`);
            } else if (n.type === 'at' && n.block && GROUP.has(n.name) && n.children) {
                if (n.name === 'media' && /^@media\s+not\s+all$/i.test(n.prelude)) { dropped++; continue; }   // ② 미리보기 덩어리
                const inner = emit(n.children);
                if (inner.length) out.push(`${n.prelude} {\n${inner.join('\n')}\n}`);
            } else out.push(body.slice(n.start, n.end));   // @font-face · @keyframes · @property · 문장형 @ 은 그대로
        }
        return out;
    };
    const rules = emit(tree.children);
    const digest = crypto.createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 12);
    return `/* Blue Lemonade style-ext.css — 「확장만」 · 테마 끔에서 style.css 대신 켜는 가벼운 사본(tools/build-css.cjs extText · src/theme-sheet.js). 고치지 말 것. 남은 규칙 ${kept} · 뺀 규칙 ${dropped} (style.css ${digest}) */\n${rules.join('\n')}\n`;
}

// 원문을 <style>로 넣는 교체 시트에는 주소 기준이 바뀌는 상대 URL과 @import가 없어야 해요.
function assertInlineSafe(text) {
    const lib = require('./css-lib.cjs');
    if (/@import\b/i.test(lib.stripComments(text))) throw new Error('전체 교체 시트에 @import를 넣을 수 없어요');
    const urls = /url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*))\s*\)/gi;
    for (const match of text.matchAll(urls)) {
        const url = (match[1] ?? match[2] ?? match[3]).trim();
        if (!/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(url)) throw new Error(`전체 교체 시트에 상대 URL을 넣을 수 없어요: ${url}`);
    }
}

module.exports = { build, modules, untouched, LAZY, LAZY_SENTINEL, CSS_DIR, lazyTail, LAZY_OUT, PREVIEW_OUT, MD_OUT, markdownSplit, markdownGated, SPLIT_LAZY, SPLIT_OUT, COMPAT_BROWSER_OUT, COMPAT_WIDTH_OUT, extText, EXT_OUT, assertInlineSafe, GATE_TABLE };
