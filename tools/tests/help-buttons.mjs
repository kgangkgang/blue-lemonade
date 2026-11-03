// 도움말 ? · 정보 ⓘ 는 한 모양(철칙 6 H3)이어야 해요 — 1.0.0 「도움말 하나로」(사용자 「여전히 곳곳에 ? 랑 i 토글 약간 디자인 다른 애들」 · 「실리태번 원래 ? · ⓘ 도 H3 하나로」).
//   ① 테마 ? 단추 클래스는 모두 css/76 의 H3 공용 목록에 ② 선 원 마스크(--salty-mi-help) · 포인트 색 ? 는 다시 쓰지 않음 ③ 글자 「?」 단추 금지(<i class="fa-solid fa-question"> 로)
//   ④ 테마가 그리는 ⓘ 는 .bl-info 마크업 하나 ⑤ ? 를 누르면 공용 도움말 창(help-sheet.js) ⑥ 설정창 간단화: 「고급」 접힘 · 긴 설명 ? 연결
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// ① H3 공용 목록
const c76 = strip(read('css/76-help-button.css'));
const h3 = c76.match(/:not\(#bl-h2\) :is\(([^)]*\)[^)]*|[^)]*)\) \{/)?.[1] || '';
for (const cls of ['.bl-help-btn', '.lv-help-btn', '.bwr_help', '.bl-word-help', '.blzi-help', '.bl-wi-help', '#bl-deus-popover .dq-help-button']) ok(h3.includes(cls), `76 H3 공용 목록에 ${cls}`);
ok(/\.bl-info \{[^}]*width: var\(--bl-help-d\)[^}]*background: var\(--bl-control\)/.test(c76), '정보 ⓘ(.bl-info)도 같은 지름 면 원');
ok(/width: var\(--bl-help-d\) !important;\n  height: var\(--bl-help-d\) !important;/.test(c76) && /margin: 0 0 0 var\(--bl-help-gap\) !important;/.test(c76) && /transform: translateY\(var\(--bl-help-y\)\)/.test(c76), '테마 ? 는 공용 지름 · 간격 · 세로 값 하나');
ok(/> i \{\n  font-size: 0 !important;[^}]*mask: var\(--bl-help-mask\) center\/contain no-repeat !important;/.test(c76), '원 안 ? 는 글꼴이 아니라 마스크(가운데)');
// 과일 패널(body 밖에도 붙어 76 이 못 닿음)은 같은 값을 따로 적어요
const c85 = strip(read('css/85-addon-unify.css'));
ok(/\.bl-fruit-help-button \{[^}]*width: var\(--bl-help-d\); height: var\(--bl-help-d\);[^}]*border-radius: 50%; background: var\(--fill\)/.test(c85) && /\.bl-fruit-help-button > i \{[^}]*mask: var\(--bl-help-mask\)/.test(c85), '과일 ? 도 같은 지름 · 마스크');
ok(!/dq-help-button \{[^}]*24px/.test(c85) && !/bl-fruit-help-button \{[^}]*24px/.test(c85), '24px 고정 ? 흉내는 걷었어요');

// ② 선 원 마스크 · 포인트 색 ? 금지(변수 정의 · 시작 화면 「설명서」 글자 단추의 아이콘만 예외)
for (const f of fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && !f.includes('.gen.'))) {
    const s = strip(read('css/' + f));
    for (const m of s.matchAll(/([^{}]+)\{([^{}]*var\(--salty-mi-help\)[^{}]*)\}/g)) {
        const sel = m[1].trim();
        ok(/welcomeShortcuts|^body\.salty$|--salty-mi-help:/.test(sel + m[2]), `${f}: 선 원 ? 마스크를 다시 쓰면 안 돼요 — ${sel.slice(0, 80)}`);
    }
}
const c56 = strip(read('css/56-control-consistency.css'));
ok(/::after \{[^}]*background:var\(--salty-muted\); -webkit-mask:var\(--bl-help-mask\)/.test(c56), '실리태번 원본 링크 ? 도 같은 마스크 · 보조 글자색');
ok(/^html \{ --bl-help-d: 1\.1em; --bl-help-gap: clamp\(5px, 0\.35em, 6\.8px\);[^}]*--bl-help-mask: url\(/m.test(c56), '공용 값 하나(html): 지름 1.1em · 간격 · 마스크');
ok(/:is\(\.fa-circle-question, \.fa-question-circle, \.fa-circle-info, \.fa-info-circle\):not\(:is\(a, button, \.menu_button, \.menu_button_icon, \.bl-wi-help\) \*\):not\(\.menu_button\) \{[^}]*background:var\(--bl-control\)/.test(c56), '실리태번 맨 아이콘 ? · ⓘ 도 H3 면 원');
ok(/\.bl-wi-dup\.bl-wi-dup \{ display:none!important; \}/.test(c56), '같은 자리 원본 ? · ⓘ 는 숨겨 하나만');

// ③ · ④ 소스 마크업
const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
const ALLOW_ICON = { 'src/addons/bookmarks/ui-kit.js': '확인 시트 제목 그림(질문 뜻 · 도움말 아님)', 'src/wi-help.js': '원본 ? · ⓘ 를 찾아 숨기는 선택자' };
for (const f of walk('src').map(f => f.replace(/\\/g, '/')).filter(f => !/\.gen\.|ko-ui-data|catalog-full|notice-data|\/vendor\//.test(f))) {
    const s = read(f);
    if (!ALLOW_ICON[f]) ok(!/fa-(circle-question|question-circle|circle-info|info-circle)\b/.test(s), `${f}: ? · ⓘ 는 <i class="fa-solid fa-question"> (H3 단추) · <span class="bl-info"><i class="fa-solid fa-info">로 — 원 그림 아이콘 금지`);
    ok(!/class="[^"]*help[^"]*"[^>]*>\s*\?\s*</.test(s) && !/(?:help|Help|btn|button|Button)\w*\.textContent = '\?'/.test(s) && !/button\('\?'/.test(s), `${f}: 글자 「?」 도움말 단추 금지`);
}

// ⑤ 누르면 공용 도움말 창
for (const [f, re] of [['src/addons/zipinstall/index.js', /openHelpSheet\(\{ title, body: \[text\] \}\)/], ['src/addons/perf/help.js', /openHelpSheet\(\{title:/], ['src/addons/rewrite/index.js', /openHelpSheet\(\{ title, html:/], ['src/addons/tts/src/ui.js', /m\.openHelpSheet\(h\)/], ['src/addons/tts/src/script-editor.js', /m\.openHelpSheet\(\{ title, body: \[text\] \}\)/], ['src/wi-help.js', /openHelpSheet\(WI_HELP\[id\]\)/], ['src/settings-editor.js', /m\.openHelpSheet\(h\)/]])
    ok(re.test(read(f)), `${f}: ? 를 누르면 공용 도움말 창(help-sheet.js)`);
ok(/help\.html \? `<div class="bl-help-html">\$\{help\.html\}<\/div>`/.test(read('src/help-sheet.js')), '도움말 창이 테마가 만든 마크업(html)도 받아요');

// ⑥ 설정창 간단화 연결
const adv = read('src/settings-advanced.js'), ed = read('src/settings-editor.js'), panel = read('src/panel.js');
ok(/import \{ applyAdvanced, moveLongNotes \} from '\.\/settings-advanced\.js'/.test(ed) && /applyAdvanced\(section, groups, route, chipped\)/.test(ed) && /moveLongNotes\(root, section, route, title/.test(ed), '편집기가 고급 접힘 · 긴 설명 ? 를 써요');
ok(/fold\.className = 'bl-md-group bl-advanced';/.test(adv) && /fold\.dataset\.mdFold = `adv:/.test(adv), '고급은 data-md-fold 접힘(다시 그려도 상태 유지 · 검색이 펼침)');
ok(/button\.className = 'bl-help-btn'; button\.dataset\.act = 'group-help'/.test(adv), '긴 설명은 묶음 제목 옆 H3 ? 하나');
ok(/openFoldsFor\(root, entry\.words\)/.test(panel), '키 없는 검색 항목도 고급 안 줄이면 펼쳐요');
console.log(`도움말 ? · ⓘ 한 모양 검사를 통과했어요(${n}건).`);
