#!/usr/bin/env node
/* =========================================================
   미리보기 CSS 생성기 (surfaces:preview)  —  tools/gen-preview-css.js

   설정 창 안에 그린 표본(.salty-preview)에 테마의 채팅 · 에셋 규칙을 먹이는 사본을 만든다.
   테마 규칙은 거의 전부 `body.salty … #chat …` 로 스코프돼 있어서 설정 창 안에서는 하나도 안 먹는다
   → 선택자의 #chat 을 :is(#salty-nochat, .salty-preview) 로 바꾼 사본을 style.css 안에 끼워 넣는다.
   :is() 의 특이도는 인자 중 가장 높은 것을 따르므로 아이디 하나짜리 특이도가 그대로 유지되고
   (#salty-nochat 은 문서에 없는 아이디다) 실제 매칭은 .salty-preview 클래스로 된다.
   앞머리(body.salty.salty-edge-prism … )는 손대지 않으므로 지금 설정이 미리보기에 저절로 반영된다.

   3.0.0 부터 원본은 css/ 모듈이다. 사본은 css/23-preview.gen.css 에 있고, 그 앞뒤 모듈을 빌드 순서대로 이어 읽어 만든다.
   사본은 2.9.5 내용 그대로 얼려 두었다 — 그 사이 채팅 규칙에 덧붙인 손질 일부가 사본에 안 들어가 있어서
   (시간 줄 여백 · 버튼 줄 줄바꿈 · 데우스 카드 정렬 · 페이드 인 등), 다시 만들면 설정 창 미리보기 모양이 바뀐다.
   그래서 기본은 '검사'이고, 다시 만드는 것은 --write 로만 (미리보기가 달라지는 것을 확인하는 버전에서).

   돌리기 (확장 뿌리에서)
     node tools/gen-preview-css.js            검사: 지금 채팅 규칙으로 만들면 사본이 어떻게 달라지는지 보고 (다르면 종료코드 1)
     node tools/gen-preview-css.js --write    css/23-preview.gen.css 를 다시 만든다 → node tools/build-css.cjs
     node tools/gen-preview-css.js --file <경로>   모듈 대신 파일 하나(옛 style.css)를 대상으로 제자리 고침 (시험용)
     node tools/gen-preview-css.js --quiet    보고서를 줄여 찍는다

   손으로 쓴 미리보기 규칙(선택자에 #salty-nochat 이 이미 든 것)은 사본을 만들 때 건너뛴다 — 2.x 에서 채팅 규칙과 미리보기
   규칙을 한 규칙에 같이 쓴 곳이 늘어서, 예전처럼 그걸 '자기 블록을 못 도려냈다' 로 보고 멈추면 도구가 못 돌았다.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

// ───────── 표시 · 갈고리 ─────────
const HEAD_MARK = '/* ===== 미리보기 자동 생성 (surfaces:preview) =====';
const TAIL_MARK = '/* ===== /surfaces:preview ===== */';
const HOOK = ':is(#salty-nochat, .salty-preview)';
// #chat_import_button 이 8군데 있다 → 경계를 봐야 한다 (단순 치환이면 그걸 깨뜨린다)
const CHAT = /#chat(?![\w-])/g;     // 바꿀 때만 (g 라서 lastIndex 가 남는다 — 검사에는 쓰지 않는다)
const HAS_CHAT = /#chat(?![\w-])/;  // 볼 때

// 속을 아예 안 보는 at-규칙 (선택자가 아니라 이름 · 프레임이 들어 있다)
const SKIP_AT = new Set(['font-face', 'keyframes', 'position-try', 'property', 'counter-style', 'page', 'viewport', 'import', 'charset', 'namespace']);
// 포장을 그대로 물고 다니는 at-규칙 (폰 규칙 max-width: 1000px 도 살아서 미리보기에 맞는다)
const PASS_AT = new Set(['media', 'supports', 'layer', 'container', 'scope']);

// ───────── 남김 · 제외 목록 (남김이 이긴다) ─────────
// 검사는 :not( … ) 을 지운 '양성 부분'에만 한다 → :not(.smallSysMes) 처럼 부정 안의 이름은 걸리지 않는다.
// 남김 토큰이 하나라도 있으면 무조건 복사 — :is(.mes_buttons, .mes_reasoning_actions) 처럼 섞인 가지가 잘못 빠지지 않게
const KEEP = [
    '.mes_buttons', '.mes_text', '.ch_name', '.name_text', '.timestamp', '.avatar', '.mes_block',
    '.custom-cac', '.salty-asset', '.salty-cutout', 'character-asset-rendered', 'eh-img', 'imageWrapper',
    '.mesIDDisplay', '.mes_timer', '.tokenCounterDisplay',
];
// 표본에 아예 없는 노드만 뺀다 (스와이프 · 편집칸 · 생각칸 · ⋯메뉴 · 시작화면)
const DENY = [
    '.extraMesButtons', '.mes_edit_buttons', '.mes_reasoning', '.reasoning_edit_textarea', '.edit_textarea',
    '#curEditTextarea', '.swipe_left', '.swipe_right', '.swipes-counter', '.swipeRightBlock', '.last_swipe',
    '.welcomePanel', '.mes_file', '.mes_media', '.mes_bias', '.mes_ghost', '.for_checkbox', '.del_checkbox',
    'custom-dem-card', 'custom-dem-expressive', '.lastInContext', '.last_mes', '.mes.selected', '.smallSysMes', '.bl-pinned', '.bl-menu-empty',
];

// ───────── 닻 (이 이름이 사본에 하나도 없으면 미리보기가 조용히 빈다) ─────────
// 규칙 수만 세면 '테두리 규칙만 빠지는' 사고를 못 잡는다 → 이름으로 직접 확인한다
// 접두사만 두면 '6개 모드 중 5개가 빠져도 하나가 남아 통과' 한다 (검수 지적) → 토큰을 전부 적는다
const ANCHORS = [
    '.mes_block', '.ch_name', '.name_text', '.mes_text', 'custom-cac-img',
    'salty-user-', 'salty-header-', 'salty-img-', 'salty-dlg-',
    'salty-edge-none', 'salty-edge-line', 'salty-edge-inset', 'salty-edge-glow', 'salty-edge-prism', 'salty-edge-auto',
    'salty-shape-rect',
    'salty-fade-off', 'salty-fade-soft', 'salty-fade-medium', 'salty-fade-strong',
];
const MIN_RULES = 145; // 이보다 적으면 파서 · 목록 퇴행으로 보고 멈춘다 (2026-09-12 실측 153)

// 미리보기 뿌리 자체를 노리게 된 선언 이름 — 보정 블록이 맡고 있는 것들 (2026-09-12 실측).
// 여기 새 이름이 나타나면 보정 블록에 한 줄 더 넣으라는 신호다 (이게 어긋남을 막는 핵심 경보).
// anchor-name 이 실제로 그랬다: 미리보기가 --salty-chat 앵커를 하나 더 만들어 실제 ⋯ 메뉴 자리를 흔들 수 있었다.
// width · height 는 #chat::-webkit-scrollbar 사본에서 온 것 (뿌리의 의사요소 — 미리보기에 해가 없다)
const KNOWN_ROOT_PROPS = [
    'background', 'padding', 'border', 'anchor-name', 'scrollbar-width',
    'backdrop-filter', '-webkit-backdrop-filter', 'width', 'height',
];

// ───────── 글자 훑기 (정규식 한 방으로는 못 한다: 주석 · 문자열 · data URI 안의 괄호) ─────────
function endComment(s, i) {
    const j = s.indexOf('*/', i + 2);
    return j < 0 ? s.length : j + 2;
}
function endString(s, i) {
    const q = s[i];
    let j = i + 1;
    while (j < s.length) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === q) return j + 1;
        if (s[j] === '\n') return j; // CSS 문자열은 줄을 넘지 못한다 — 깨진 파일에서 멈추지 않게
        j++;
    }
    return s.length;
}
function endParen(s, i) {
    // 여는 '(' 자리를 받아 짝이 되는 ')' 자리를 준다. 안의 주석 · 문자열 · 괄호를 센다
    let d = 0;
    let j = i;
    while (j < s.length) {
        const c = s[j];
        if (c === '/' && s[j + 1] === '*') { j = endComment(s, j); continue; }
        if (c === '"' || c === "'") { j = endString(s, j); continue; }
        if (c === '(') { d++; j++; continue; }
        if (c === ')') { d--; if (!d) return j; j++; continue; }
        j++;
    }
    return s.length;
}
function endBracket(s, i) {
    let j = i + 1;
    while (j < s.length) {
        const c = s[j];
        if (c === '"' || c === "'") { j = endString(s, j); continue; }
        if (c === ']') return j;
        j++;
    }
    return s.length;
}
function endBlock(s, i) {
    // 여는 '{' 다음 자리를 받아 짝이 되는 '}' 자리를 준다
    let d = 1;
    let j = i;
    while (j < s.length) {
        const c = s[j];
        if (c === '/' && s[j + 1] === '*') { j = endComment(s, j); continue; }
        if (c === '"' || c === "'") { j = endString(s, j); continue; }
        if (c === '(') { j = endParen(s, j) + 1; continue; }
        if (c === '{') { d++; j++; continue; }
        if (c === '}') { d--; if (!d) return j; j++; continue; }
        j++;
    }
    return -1; // 짝이 안 맞음
}
const IDENT = /[A-Za-z0-9_-]/;
function skipIdent(s, i) {
    let j = i;
    while (j < s.length) {
        if (s[j] === '\\') { j += 2; continue; }
        if (IDENT.test(s[j]) || s.charCodeAt(j) > 127) { j++; continue; }
        break;
    }
    return j;
}

// 주석을 떼고 줄바꿈 · 잇단 공백을 한 칸으로 (문자열 안은 그대로)
function cleanSel(s) {
    let out = '';
    let i = 0;
    let space = false;
    while (i < s.length) {
        const c = s[i];
        if (c === '/' && s[i + 1] === '*') { i = endComment(s, i); space = true; continue; }
        if (c === '"' || c === "'") {
            const e = endString(s, i);
            if (space && out) out += ' ';
            space = false;
            out += s.slice(i, e);
            i = e;
            continue;
        }
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f') { space = true; i++; continue; }
        if (space && out) out += ' ';
        space = false;
        out += c;
        i++;
    }
    return out.trim();
}
function stripComments(s) {
    let out = '';
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === '/' && s[i + 1] === '*') { i = endComment(s, i); continue; }
        if (c === '"' || c === "'") { const e = endString(s, i); out += s.slice(i, e); i = e; continue; }
        out += c;
        i++;
    }
    return out;
}

// 깊이 0 의 쉼표로만 자른다 (:is( … , … ) 안의 쉼표는 건드리지 않음)
function topSplit(s) {
    const parts = [];
    let start = 0;
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === '/' && s[i + 1] === '*') { i = endComment(s, i); continue; }
        if (c === '"' || c === "'") { i = endString(s, i); continue; }
        if (c === '(') { i = endParen(s, i) + 1; continue; }
        if (c === '[') { i = endBracket(s, i) + 1; continue; }
        if (c === ',') { parts.push(s.slice(start, i)); start = i + 1; i++; continue; }
        i++;
    }
    parts.push(s.slice(start));
    return parts.map(p => p.trim()).filter(p => p);
}

// :not( … ) 구간을 통째로 지운 사본. #chat 이 부정 안에만 있으면 복사하면 뜻이 뒤집힌다
// (body.salty .avatar:not(#chat .avatar) img → 미리보기 아바타를 '채팅 밖' 으로 몰아 실채팅 아바타를 네모로 만든다)
function dropNots(sel) {
    let s = sel;
    for (;;) {
        const m = /:not\(/i.exec(s);
        if (!m) return s;
        const open = m.index + m[0].length - 1;
        const close = endParen(s, open);
        s = s.slice(0, m.index) + ' ' + s.slice(close + 1);
    }
}

// 이 가지가 노리는 것이 미리보기 뿌리 자체인가 (자손이 아니라).
// 마지막 조각만 보는 것으로는 안 된다 — `:is(…, #chat .translation_edit_textarea)` 처럼
// :is() 인자 안에서 다시 자손으로 내려가는 경우가 있어 인자마다 그 인자의 마지막 조각을 봐야 한다.
// :not() · :has() 인자는 조건일 뿐 노리는 노드가 아니므로 세지 않는다
function subjectHasHook(sel) {
    const comp = lastCompound(sel);
    let found = false;
    let i = 0;
    while (i < comp.length) {
        const c = comp[i];
        if (c === '"' || c === "'") { i = endString(comp, i); continue; }
        if (c === '[') { i = endBracket(comp, i) + 1; continue; }
        if (c === ':') {
            let j = i + 1;
            if (comp[j] === ':') j++;
            const s0 = j;
            j = skipIdent(comp, j);
            const name = comp.slice(s0, j).toLowerCase();
            if (comp[j] === '(') {
                const close = endParen(comp, j);
                if (name === 'is' || name === 'where' || name === 'matches') {
                    for (const p of topSplit(comp.slice(j + 1, close))) if (subjectHasHook(p)) found = true;
                }
                i = close + 1;
                continue;
            }
            i = j;
            continue;
        }
        if (c === '.') {
            const e = skipIdent(comp, i + 1);
            if (comp.slice(i, e) === '.salty-preview') found = true;
            i = e;
            continue;
        }
        if (c === '#') { i = skipIdent(comp, i + 1); continue; }
        i++;
    }
    return found;
}

// 갈고리가 :is() · :where() 안에서 다른 대안과 나란히 앉은 가지는 미리보기 밖도 잡는다
// (`:is(#top-bar, #sheld, #chat, …)` 처럼 원래부터 여러 곳을 노리던 규칙). 선언을 원문 그대로 옮기고
// 특이도도 같으므로 값이 달라지지는 않지만, '사본은 미리보기 밖과 절대 안 만난다' 는 말은 못 한다 → 보고서에 찍는다
function escapes(sel) {
    let found = false;
    let i = 0;
    while (i < sel.length) {
        const c = sel[i];
        if (c === '"' || c === "'") { i = endString(sel, i); continue; }
        if (c === '[') { i = endBracket(sel, i) + 1; continue; }
        if (c === ':') {
            let j = i + 1;
            if (sel[j] === ':') j++;
            const s0 = j;
            j = skipIdent(sel, j);
            const name = sel.slice(s0, j).toLowerCase();
            if (sel[j] === '(') {
                const close = endParen(sel, j);
                const args = topSplit(sel.slice(j + 1, close));
                const self = sel.slice(i, close + 1) === HOOK; // 갈고리 그 자체는 건너뛴다
                if (!self && (name === 'is' || name === 'where' || name === 'matches')) {
                    const hooked = args.filter(a => a.indexOf('.salty-preview') >= 0).length;
                    if (hooked && args.length > hooked) found = true;
                }
                if (!self) for (const a of args) if (escapes(a)) found = true;
                i = close + 1;
                continue;
            }
            i = j;
            continue;
        }
        i++;
    }
    return found;
}

// 깊이 0 의 결합자(공백 > + ~)로 자른 마지막 조각 = 이 가지가 실제로 노리는 노드
function lastCompound(sel) {
    let last = 0;
    let i = 0;
    while (i < sel.length) {
        const c = sel[i];
        if (c === '"' || c === "'") { i = endString(sel, i); continue; }
        if (c === '(') { i = endParen(sel, i) + 1; continue; }
        if (c === '[') { i = endBracket(sel, i) + 1; continue; }
        if (c === ' ' || c === '>' || c === '+' || c === '~' || c === '\t') { i++; last = i; continue; }
        i++;
    }
    return sel.slice(last);
}

// ───────── 특이도 (가지마다 원본과 사본이 같아야 한다) ─────────
// :is() · :has() · :not() = 인자 중 최대, :where() = 0, 속성 · 의사클래스 = class, 의사요소 = type
const MAX_FN = new Set(['is', 'not', 'has', 'matches', '-webkit-any', '-moz-any']);
const LEGACY_PE = new Set(['before', 'after', 'first-line', 'first-letter']);
function cmpSpec(x, y) {
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}
function spec(sel) {
    let a = 0, b = 0, c = 0;
    let i = 0;
    while (i < sel.length) {
        const ch = sel[i];
        if (ch === '/' && sel[i + 1] === '*') { i = endComment(sel, i); continue; }
        if (ch === '"' || ch === "'") { i = endString(sel, i); continue; }
        if (ch === '#') { i = skipIdent(sel, i + 1); a++; continue; }
        if (ch === '.') { i = skipIdent(sel, i + 1); b++; continue; }
        if (ch === '[') { i = endBracket(sel, i) + 1; b++; continue; }
        if (ch === ':') {
            let j = i + 1;
            let isEl = false;
            if (sel[j] === ':') { j++; isEl = true; }
            const s0 = j;
            j = skipIdent(sel, j);
            const name = sel.slice(s0, j).toLowerCase();
            if (sel[j] === '(') {
                const close = endParen(sel, j);
                const args = sel.slice(j + 1, close);
                if (name === 'where') {
                    // 0
                } else if (MAX_FN.has(name)) {
                    let best = [0, 0, 0];
                    for (const p of topSplit(args)) {
                        const t = spec(p);
                        if (cmpSpec(t, best) > 0) best = t;
                    }
                    a += best[0]; b += best[1]; c += best[2];
                } else if (name === 'nth-child' || name === 'nth-last-child') {
                    b++;
                    const of = /(^|\s)of\s([\s\S]+)$/i.exec(args);
                    if (of) {
                        let best = [0, 0, 0];
                        for (const p of topSplit(of[2])) {
                            const t = spec(p);
                            if (cmpSpec(t, best) > 0) best = t;
                        }
                        a += best[0]; b += best[1]; c += best[2];
                    }
                } else {
                    b++;
                }
                i = close + 1;
                continue;
            }
            if (isEl || LEGACY_PE.has(name)) c++;
            else b++;
            i = j;
            continue;
        }
        if (IDENT.test(ch) || ch === '\\' || sel.charCodeAt(i) > 127) { i = skipIdent(sel, i); c++; continue; }
        i++; // * > + ~ 공백 | 등
    }
    return [a, b, c];
}

// ───────── 규칙 떠 내기 ─────────
// 선언 본문은 원문 그대로 옮긴다 (스크래치 결의 거대한 data URI 를 다시 조립하면 깨질 위험이 있다)
function collect(css, problems) {
    const out = [];
    const chain = [];
    let i = 0;

    function block(top) {
        let start = i;
        while (i < css.length) {
            const c = css[i];
            if (c === '/' && css[i + 1] === '*') { i = endComment(css, i); continue; }
            if (c === '"' || c === "'") { i = endString(css, i); continue; }
            if (c === '(') { i = endParen(css, i) + 1; continue; }
            if (c === ';') { i++; start = i; continue; } // ; 로 끝나는 at-규칙 · 빈 선언
            if (c === '}') { i++; if (!top) return; start = i; continue; }
            if (c === '{') {
                const prelude = cleanSel(css.slice(start, i));
                const open = i;
                i++;
                if (prelude.startsWith('@')) {
                    const m = /^@([\w-]+)/.exec(prelude);
                    const name = m ? m[1].toLowerCase() : '';
                    if (SKIP_AT.has(name) || !PASS_AT.has(name)) {
                        const e = endBlock(css, i);
                        if (e < 0) { problems.push(`중괄호 짝이 안 맞음 (at-규칙 ${prelude.slice(0, 40)})`); i = css.length; return; }
                        if (!SKIP_AT.has(name)) problems.push(`모르는 at-규칙을 건너뜀: ${prelude.slice(0, 60)}`);
                        i = e + 1;
                    } else {
                        chain.push(prelude);
                        block(false);
                        chain.pop();
                    }
                } else {
                    const e = endBlock(css, i);
                    if (e < 0) { problems.push(`중괄호 짝이 안 맞음 (선택자 ${prelude.slice(0, 40)})`); i = css.length; return; }
                    out.push({ chain: chain.slice(), sel: prelude, body: css.slice(i, e), at: open });
                    i = e + 1;
                }
                start = i;
                continue;
            }
            i++;
        }
    }
    block(true);
    if (chain.length) problems.push(`at-규칙 포장이 닫히지 않음: ${chain.join(' / ')}`);
    return out;
}

function hasAny(s, list) {
    for (const t of list) if (s.indexOf(t) >= 0) return t;
    return '';
}

// 본문을 두 칸 들여쓴 줄 목록으로 (주석은 뺀다)
function bodyLines(body) {
    const lines = [];
    for (const raw of stripComments(body).split(/\r?\n/)) {
        const t = raw.trim();
        if (t) lines.push(t);
    }
    return lines;
}

// 본문에서 선언 이름만 모은다 (깊이 0 의 `이름:` 만)
function propNames(body) {
    const s = stripComments(body);
    const names = [];
    let i = 0;
    let start = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === '"' || c === "'") { i = endString(s, i); continue; }
        if (c === '(') { i = endParen(s, i) + 1; continue; }
        if (c === '[') { i = endBracket(s, i) + 1; continue; }
        if (c === '{') { const e = endBlock(s, i + 1); i = (e < 0 ? s.length : e + 1); start = i; continue; }
        if (c === ';') { i++; start = i; continue; }
        if (c === ':') {
            const name = s.slice(start, i).trim();
            if (/^-{0,2}[A-Za-z][\w-]*$/.test(name)) names.push(name);
            // 값은 문자열 · 괄호를 세며 건너뛴다 — data:image/webp;base64 처럼 값 안에 든 ; 에 속으면
            // 그 뒤 선언 이름이 통째로 안 잡혀 '뿌리 선언 알람' 이 조용히 새 이름을 놓친다
            i++;
            while (i < s.length) {
                const d = s[i];
                if (d === '"' || d === "'") { i = endString(s, i); continue; }
                if (d === '(') { i = endParen(s, i) + 1; continue; }
                if (d === ';' || d === '}') break;
                i++;
            }
            if (s[i] === ';') i++;
            start = i;
            continue;
        }
        i++;
    }
    return names;
}

// ───────── 고르기 · 치환 ─────────
function pick(rules, rep) {
    const kept = [];
    for (const r of rules) {
        // 손으로 쓴 미리보기 규칙: 이미 #chat · 갈고리를 같이 들고 있어 복사하면 두 번이 된다
        if (r.sel.indexOf('#salty-nochat') >= 0) { rep.handPreview = (rep.handPreview || 0) + 1; continue; }
        const branches = topSplit(r.sel);
        const out = [];
        const srcs = [];
        for (const br of branches) {
            const pos = dropNots(br);          // 양성 부분 — 남김 · 제외 · #chat 검사는 전부 여기에
            if (!HAS_CHAT.test(pos)) {
                if (HAS_CHAT.test(br)) rep.notOnly.push(br);
                continue;                       // #chat 이 없는 가지는 사본에 넣지 않는다
            }
            const keep = hasAny(pos, KEEP);
            if (!keep) {
                const deny = hasAny(pos, DENY);
                if (deny) { rep.dropped.push(`${deny.padEnd(24)} ${br}`); continue; }
            }
            const sel = br.replace(CHAT, HOOK);
            const s0 = spec(br);
            const s1 = spec(sel);
            if (cmpSpec(s0, s1) !== 0) {
                rep.badSpec.push(`(${s0}) → (${s1})  ${br}`);
                continue;
            }
            out.push(sel);
            srcs.push(br);
        }
        if (!out.length) continue;
        kept.push({ chain: r.chain, branches: out, srcs, lines: bodyLines(r.body), body: r.body, src: r.sel });
    }
    return kept;
}

// ───────── 써 내기 ─────────
function emit(rules, eol) {
    const L = [];
    let cur = [];
    const openChain = (chain) => {
        for (let d = 0; d < chain.length; d++) L.push('  '.repeat(d) + chain[d] + ' {');
    };
    const closeChain = (chain) => {
        for (let d = chain.length - 1; d >= 0; d--) L.push('  '.repeat(d) + '}');
    };
    for (const r of rules) {
        if (r.chain.join('\u0000') !== cur.join('\u0000')) {
            closeChain(cur);
            cur = r.chain;
            openChain(cur);
        }
        const ind = '  '.repeat(cur.length);
        const sel = r.branches.join(',' + eol + ind);
        L.push(ind + sel + ' {');
        for (const line of r.lines) L.push(ind + '  ' + line);
        L.push(ind + '}');
    }
    closeChain(cur);
    return L.join(eol);
}

function header(count, bytes, eol) {
    return [
        HEAD_MARK,
        '   tools/gen-preview-css.js 가 #chat 규칙을 여기 복사한다 — 손으로 고치지 말 것.',
        `   선택자의 #chat 을 ${HOOK} 로 바꾼 사본 ${count}개 (${(bytes / 1024).toFixed(1)}KB).`,
        '   style.css 의 채팅 · 에셋 규칙을 고치면 `node tools/gen-preview-css.js` 를 다시 돌린다.',
        '   이 칸을 다른 자리로 옮기지 말 것: 사본이 손으로 쓴 채팅 규칙보다 뒤에 있어야 같은 무게에서 이기고,',
        '   바로 뒤의 보정 칸이 사본을 눌러 줄 수 있다. 앞으로 옮기면 아바타 모서리처럼 순서로만 갈리는 것이 뒤집힌다 */',
    ].join(eol);
}

// ───────── 한 판 (읽은 글 → 새 글) ─────────
function build(file, rep) {
    const eol = (file.match(/\r\n/g) || []).length >= (file.match(/(^|[^\r])\n/g) || []).length ? '\r\n' : '\n';
    rep.eol = eol === '\r\n' ? 'CRLF' : 'LF';

    let head = file.indexOf(HEAD_MARK);
    let pre;
    let post;
    if (head < 0) {
        // 표시가 없으면 파일 맨 끝에 만든다 (그 뒤에 손으로 쓰는 보정 칸이 온다)
        rep.madeMarks = true;
        pre = file.endsWith(eol) ? file : file + eol;
        post = '';
    } else {
        const tail = file.indexOf(TAIL_MARK, head);
        if (tail < 0) throw new Error(`${HEAD_MARK} 는 있는데 ${TAIL_MARK} 가 없다 — 표시를 고친 뒤 다시 돌릴 것`);
        if (file.indexOf(HEAD_MARK, head + 1) >= 0) throw new Error('시작 표시가 두 번 나온다');
        pre = file.slice(0, head);
        post = file.slice(tail + TAIL_MARK.length);
    }
    const scan = pre + post; // 자기 블록을 뺀 것 — 안 빼면 돌릴 때마다 두 배로 늘어난다

    const problems = [];
    const all = collect(scan, problems);
    rep.problems = problems;
    rep.scanned = all.length;
    rep.withChat = all.filter(r => HAS_CHAT.test(r.sel)).length;

    // 자기 블록 격리: 스캔 원본에 생성 블록 모양 그대로의 사본(갈고리만 있고 #chat 은 없음)이 머리 표시와 함께 또 있으면 도려내기가 실패한 것
    if (scan.indexOf(HEAD_MARK) >= 0) throw new Error('자기 블록을 못 도려냈다 (시작 표시가 두 번)');

    const kept = pick(all, rep);
    rep.kept = kept.length;

    const bodyText = emit(kept, eol);
    const bytes = Buffer.byteLength(bodyText, 'utf8');
    rep.blockBytes = bytes;
    rep.blockLines = bodyText ? bodyText.split(eol).length : 0;

    const region = header(kept.length, bytes, eol) + eol + bodyText + eol + TAIL_MARK;
    const out = pre + region + (post || eol);
    rep.region = region;
    rep.kepts = kept;
    return out;
}

// ───────── 검증 ─────────
function verify(file, out, rep) {
    const bad = [];
    const region = rep.region;
    // 머리 주석에는 설명하려고 #chat · #salty-nochat 이 적혀 있다 → 검사는 주석을 뺀 글로 한다
    const code = stripComments(region);

    // 1. 중괄호 균형 · 다시 읽기
    const problems = [];
    const again = collect(region, problems);
    for (const p of problems) bad.push(`다시 읽기: ${p}`);
    if (again.length !== rep.kept) bad.push(`다시 읽은 규칙 수가 다름: ${again.length} ≠ ${rep.kept}`);
    for (const r of rep.kepts) {
        if (r.lines.join('\n').indexOf('{') >= 0) bad.push(`본문에 { 가 있다 (CSS 중첩?): ${r.src.slice(0, 60)}`);
    }

    // 2. 잔류 검사
    const left = code.match(CHAT);
    if (left) bad.push(`사본에 #chat 이 ${left.length}개 남았다`);
    if (code.indexOf('#chat_import_button') >= 0) bad.push('사본에 #chat_import_button 이 들어갔다 (경계 정규식이 깨졌다)');

    // 3. 특이도 · 되돌리기 (갈고리를 #chat 으로 되돌리면 원본 가지와 글자까지 같아야 한다
    //    — 선택자를 다듬다가 다른 것까지 건드리는 사고를 잡는다)
    for (const s of rep.badSpec) bad.push(`특이도가 달라짐: ${s}`);
    for (const r of rep.kepts) {
        for (let k = 0; k < r.branches.length; k++) {
            const back = r.branches[k].split(HOOK).join('#chat');
            if (back !== r.srcs[k]) bad.push(`되돌린 가지가 원본과 다름:\n      원본 ${r.srcs[k]}\n      사본 ${back}`);
        }
    }

    // 4. 닻 — 선택자만 본다. 선언 본문까지 보면 --salty-edge-thick 같은 변수 이름이
    //    '테두리 선택자가 통째로 빠진' 사고를 가려 버린다 (실제로 그렇게 새는 것을 확인했다)
    const sels = rep.kepts.map(r => r.chain.join(' ') + ' ' + r.branches.join(' ')).join('\n');
    rep.missing = ANCHORS.filter(a => sels.indexOf(a) < 0);
    if (rep.missing.length) bad.push(`사본에 없는 닻: ${rep.missing.join(' ')}`);

    // 5. 규칙 수 바닥
    if (rep.kept < MIN_RULES) bad.push(`복사한 규칙이 ${rep.kept}개뿐 — 바닥값 ${MIN_RULES} 미만 (파서 · 목록 퇴행?)`);

    // 6. 줄 끝
    if (rep.eol === 'CRLF' && /(^|[^\r])\n/.test(region)) bad.push('사본에 CRLF 아닌 줄 끝이 섞였다');

    // 7. 바깥 불변
    const at = out.indexOf(HEAD_MARK);
    const bt = out.indexOf(TAIL_MARK, at);
    const outPre = out.slice(0, at);
    const outPost = out.slice(bt + TAIL_MARK.length);
    const srcAt = file.indexOf(HEAD_MARK);
    if (srcAt >= 0) {
        const srcBt = file.indexOf(TAIL_MARK, srcAt);
        if (file.slice(0, srcAt) !== outPre) bad.push('생성 칸 앞의 글이 바뀌었다');
        if (file.slice(srcBt + TAIL_MARK.length) !== outPost) bad.push('생성 칸 뒤의 글이 바뀌었다');
    } else if (!file.startsWith(outPre.slice(0, file.length))) {
        bad.push('원본이 사본 앞머리에 그대로 들어가지 않았다');
    }

    // 8. 멱등 — 한 번 더 돌려 바이트가 같아야 한다
    const rep2 = { dropped: [], notOnly: [], badSpec: [] };
    const twice = build(out, rep2);
    if (twice !== out) bad.push('멱등하지 않다 (두 번 돌리면 결과가 달라진다)');
    rep.twice = twice === out;

    return bad;
}

// ───────── 알림 (막지는 않지만 사람이 봐야 하는 것) ─────────
function notices(rep) {
    const rootRules = [];
    const rootProps = new Set();
    const displayImp = [];
    const forbidden = [];
    for (const r of rep.kepts) {
        const roots = r.branches.filter(subjectHasHook);
        if (roots.length) {
            const props = propNames(r.body);
            props.forEach(p => rootProps.add(p));
            rootRules.push({ sel: roots.join(', '), props, pe: roots.some(b => lastCompound(b).indexOf('::') >= 0) });
        }
        const text = r.lines.join('\n');
        if (/display\s*:[^;]*!important/.test(text)) displayImp.push(r.src);
        // 폰 번짐 규칙: 값이 none 인 것(번짐을 끄는 쪽)은 문제가 아니다.
        // 되묶음(\s*)을 콜론 밖에 두면 lookahead 가 빈 자리에서 참이 돼 늘 걸린다 → 콜론 바로 뒤에서 본다
        if (/filter\s*:[^;]*drop-shadow\(/.test(text)) forbidden.push(`drop-shadow  ${r.src}`);
        if (/(^|[^-\w])text-shadow\s*:(?!\s*none\b)/.test(text)) forbidden.push(`text-shadow  ${r.src}`);
        if (/backdrop-filter\s*:(?!\s*none\b)/.test(text)) forbidden.push(`backdrop-filter  ${r.src}`);
        if (/color-mix\(/.test(text)) forbidden.push(`color-mix()  ${r.src}`);
    }
    rep.escapes = [];
    for (const r of rep.kepts) {
        const outside = r.branches.filter(escapes);
        if (outside.length) rep.escapes.push(outside.join(', '));
    }
    rep.rootRules = rootRules;
    rep.rootProps = [...rootProps];
    rep.newRootProps = rep.rootProps.filter(p => !KNOWN_ROOT_PROPS.includes(p));
    rep.displayImp = displayImp;
    rep.forbidden = forbidden;
}

// ───────── 보고서 ─────────
function kb(n) { return `${(n / 1024).toFixed(1)}KB`; }

function report(file, out, rep, quiet) {
    const grow = Buffer.byteLength(out, 'utf8') - Buffer.byteLength(file, 'utf8');
    console.log('[미리보기 CSS 생성]');
    console.log(`  줄 끝          : ${rep.eol}`);
    console.log(`  스캔한 규칙    : ${rep.scanned}개 (자기 블록 제외) · 선택자에 #chat: ${rep.withChat}개`);
    console.log(`  복사           : ${rep.kept}개 · 뺀 가지 ${rep.dropped.length}개 · :not() 안에만 있어 안 옮긴 규칙 ${rep.notOnly.length}개`);
    console.log(`  생성 블록      : ${kb(rep.blockBytes)} · ${rep.blockLines}줄`);
    console.log(`  파일           : ${kb(Buffer.byteLength(file, 'utf8'))} → ${kb(Buffer.byteLength(out, 'utf8'))} (+${kb(grow)}, +${(grow / Buffer.byteLength(file, 'utf8') * 100).toFixed(1)}%)`);
    console.log(`  멱등           : ${rep.twice ? '같음' : '다름!'}`);
    console.log(`  닻             : ${rep.missing && rep.missing.length ? '빠짐 ' + rep.missing.join(' ') : `${ANCHORS.length}개 모두 있음`}`);

    if (rep.problems && rep.problems.length) {
        console.log('\n  [파서 알림]');
        for (const p of rep.problems) console.log(`   · ${p}`);
    }

    console.log('\n  [미리보기 뿌리 자체를 노리는 규칙] — 보정 블록이 맡아야 하는 것들');
    for (const r of rep.rootRules) {
        console.log(`   · ${r.props.join(' · ')}${r.pe ? '  (의사요소)' : ''}`);
        if (!quiet) console.log(`     ${r.sel.length > 150 ? r.sel.slice(0, 150) + '…' : r.sel}`);
    }
    console.log(`   선언 이름: ${rep.rootProps.join(' · ')}`);
    if (rep.newRootProps.length) {
        console.log(`   ※ 새 이름이 나타났다: ${rep.newRootProps.join(' · ')} → 보정 블록에 한 줄 더 넣을 것`);
    }

    if (rep.escapes.length) {
        console.log(`\n  [미리보기 밖에도 걸리는 사본 가지 ${rep.escapes.length}개] — 원래부터 여러 곳을 노리던 :is() 규칙`);
        console.log('   선언을 원문 그대로 옮기고 특이도도 같아서 값은 달라지지 않는다 (사본이 뒤에서 같은 값을 한 번 더 쓴다).');
        if (!quiet) for (const s of rep.escapes) console.log(`   · ${s.length > 150 ? s.slice(0, 150) + '…' : s}`);
    }
    if (rep.displayImp.length) {
        console.log(`\n  [display: … !important 를 물고 온 규칙 ${rep.displayImp.length}개]`);
        console.log('   원본에 있던 것이고 사본은 .salty-preview 밑으로만 가므로 toastr · [hidden] 에 닿지 않는다.');
        if (!quiet) for (const s of rep.displayImp) console.log(`   · ${s.length > 140 ? s.slice(0, 140) + '…' : s}`);
    }
    if (rep.forbidden.length) {
        console.log(`\n  [폰 번짐 · 색 계산 금지 패턴 ${rep.forbidden.length}개] — 원본을 고쳐야 한다`);
        for (const s of rep.forbidden) console.log(`   · ${s.length > 140 ? s.slice(0, 140) + '…' : s}`);
    }
    if (rep.notOnly.length) {
        console.log(`\n  [:not() 안에만 #chat 이 있어 안 옮긴 규칙 ${rep.notOnly.length}개] — 옮기면 뜻이 뒤집힌다`);
        for (const s of rep.notOnly) console.log(`   · ${s.length > 160 ? s.slice(0, 160) + '…' : s}`);
    }
    if (!quiet && rep.dropped.length) {
        console.log(`\n  [제외 목록으로 뺀 가지 ${rep.dropped.length}개] — 표본에 없는 노드인지 눈으로 볼 것`);
        for (const s of rep.dropped) console.log(`   · ${s.length > 160 ? s.slice(0, 160) + '…' : s}`);
    }
}

// ───────── 들머리 ─────────
// 3.0.0 모듈 모드: css/ 를 빌드 순서로 이어 읽고, 사본 칸은 css/23-preview.gen.css 에서만 바꾼다
const GEN_MODULE = '23-preview.gen.css';
function ruleKeys(text) {
    const problems = [];
    return collect(text, problems).map(r => `${r.chain.join(' / ')}${r.chain.length ? ' / ' : ''}${cleanSel(r.sel)} { ${bodyLines(r.body).join(' ')} }`);
}
function mainModules(argv) {
    const write = argv.includes('--write');
    const quiet = argv.includes('--quiet');
    const { modules, CSS_DIR } = require('./build-css.cjs');
    const names = modules();
    if (!names.includes(GEN_MODULE)) throw new Error(`css/${GEN_MODULE} 가 없음`);
    const texts = names.map(n => fs.readFileSync(path.join(CSS_DIR, n), 'utf8'));
    const file = texts.join('\n');
    const rep = { dropped: [], notOnly: [], badSpec: [], madeMarks: false };
    const out = build(file, rep);
    notices(rep);
    const bad = verify(file, out, rep);
    report(file, out, rep, quiet);
    if (bad.length) {
        console.error('\n[실패] 사본을 만들 수 없다:');
        for (const b of bad) console.error(`  · ${b}`);
        return 1;
    }
    const genPath = path.join(CSS_DIR, GEN_MODULE);
    const gen = fs.readFileSync(genPath, 'utf8');
    const h = gen.indexOf(HEAD_MARK), t = gen.indexOf(TAIL_MARK);
    if (h < 0 || t < 0) throw new Error(`css/${GEN_MODULE} 에 사본 표시가 없음`);
    const current = gen.slice(h, t + TAIL_MARK.length);
    if (current === rep.region) {
        console.log(`\n[같음] css/${GEN_MODULE} 사본이 지금 채팅 규칙과 같다. (손으로 쓴 미리보기 규칙 ${rep.handPreview || 0}개는 건너뜀)`);
        return 0;
    }
    const was = ruleKeys(current), now = ruleKeys(rep.region);
    const left = [...now];
    const gone = [];
    for (const k of was) { const i = left.indexOf(k); if (i >= 0) left.splice(i, 1); else gone.push(k); }
    console.log(`\n[어긋남] 다시 만들면 사본 규칙이 ${gone.length}개 빠지고 ${left.length}개 새로 생긴다 (순서만 바뀐 것은 세지 않음) — 설정 창 미리보기 모양이 달라진다.`);
    if (!quiet) {
        for (const k of gone) console.log(`   - ${k.length > 220 ? k.slice(0, 220) + '…' : k}`);
        for (const k of left) console.log(`   + ${k.length > 220 ? k.slice(0, 220) + '…' : k}`);
    }
    if (!write) {
        console.log('  다시 만들려면: node tools/gen-preview-css.js --write → node tools/build-css.cjs (미리보기 모양 변화를 확인하는 버전에서)');
        return 1;
    }
    fs.writeFileSync(genPath, gen.slice(0, h) + rep.region + gen.slice(t + TAIL_MARK.length), 'utf8');
    console.log(`\n[씀] css/${GEN_MODULE} — 이어서 node tools/build-css.cjs`);
    return 0;
}

function main(argv) {
    const check = argv.includes('--check');
    const quiet = argv.includes('--quiet');
    const fi = argv.indexOf('--file');
    if (fi < 0) { process.exitCode = mainModules(argv); return; }
    const target = path.resolve(argv[fi + 1]);

    const file = fs.readFileSync(target, 'utf8');
    const rep = { dropped: [], notOnly: [], badSpec: [], madeMarks: false };
    const out = build(file, rep);
    notices(rep);
    const bad = verify(file, out, rep);

    report(file, out, rep, quiet);

    if (bad.length) {
        console.error('\n[실패] 파일을 쓰지 않았다:');
        for (const b of bad) console.error(`  · ${b}`);
        process.exit(1);
    }
    if (check) {
        if (out === file) {
            console.log('\n[검사] 사본이 최신이다.');
            return;
        }
        console.error('\n[검사] 사본이 원본과 어긋났다 — `node tools/gen-preview-css.js` 를 돌릴 것.');
        process.exit(1);
    }
    if (out === file) {
        console.log('\n[그대로] 바뀐 것이 없어 파일을 건드리지 않았다.');
        return;
    }
    fs.writeFileSync(target, out, 'utf8');
    console.log(`\n[씀] ${target}${rep.madeMarks ? ' (표시가 없어 파일 맨 끝에 새로 만들었다 — 그 뒤에 손으로 쓴 보정 칸을 둘 것)' : ''}`);
}

// 직접 실행할 때만 돈다 — 가드가 없으면 누가 이 파일을 require 하기만 해도
// 기본 대상(../style.css = 실제 테마)을 그 자리에서 덮어쓴다
if (require.main === module) {
    try {
        main(process.argv.slice(2));
    } catch (e) {
        console.error(`[오류] ${e.message}`);
        process.exit(1);
    }
}

module.exports = { build, verify, main };
