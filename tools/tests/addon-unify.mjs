// 7.0.3 확장 창 모양 통일 지키기 (css/85-addon-unify.css) — 창 19개를 가장 많이 쓰는 모양으로 맞춘 규칙이 빠지거나 어긋나면 멈춘다.
// 머리(아이콘 + 제목 + 판 알약 + × 하나) · 아래 「닫기」 줄 숨김 · 탭(머리 바로 아래 · 아이콘 위 글자 아래) · 고른 칸 · 카드 · 창 폭.
// 브라우저 없이 style.css 글과 애드온 머리 마크업만 본다. 화면 확인은 ../blue-lemonade-audit/ui-unify-audit-20261017 (격리 실리태번 사진).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const glyphCss = read('css/10-foundation.css');
const resolveGlyphs = text => text.replace(/var\((--bl-deco-glyph-[\w]+)\)/g, (_, name) => {
  const value = glyphCss.match(new RegExp(name + ':\\s*([^;]+);'));
  assert.ok(value, `아이콘 크기 토큰 ${name}이 없어요`);
  return value[1];
});
const css = resolveGlyphs(read('css/85-addon-unify.css')).replace(/\/\*[\s\S]*?\*\//g, '');
const built = read('style.css');
let passed = 0;
const test = (name, fn) => { fn(); passed++; };

// 실리태번 팝업에 뜨는 창 8 · 애드온이 직접 만든 창 7
const POP = ['#lv_settings', '.bwr_settings', '#model_register_settings', '#model-switch-settings', '.po-dialog', '.pa-hub', '.rl-root', '#regex-link-settings'];
const OWN = ['.bl-translator-dialog', '.bl-assets-dialog', '.bl-ctsi-dialog', '.bl-direction-dialog', '.blzi-dialog', '.bl-mermaid-dialog', '.blpt-dialog'];
// 규칙 하나 찾기: 선택자에 모든 낱말이 들어 있고 선언에 모든 값이 있는 규칙
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].replace(/\s+/g, ' ').trim(), decl: m[2].replace(/\s+/g, ' ') }));
const find = (selParts, declParts) => rules.find(r => selParts.every(p => r.sel.includes(p)) && declParts.every(d => r.decl.includes(d)));

test('style.css 에 통일 모듈이 실림 (미리보기 전용으로 꺼지지 않음)', () => {
  assert.ok(built.includes('/* css/85-addon-unify.css */'), 'style.css 에 85 모듈 없음 — node tools/build-css.cjs');
  const at = built.indexOf('/* css/85-addon-unify.css */'), next = built.indexOf('/* css/', at + 10);
  assert.ok(!built.slice(at, next).includes('@media not all'), '85 모듈 규칙이 @media not all 안에 있음 (선택자에 .salty-sample 등을 쓰지 말 것)');
});
test('창 폭: 팝업 8 · 직접 만든 창 7 모두 같은 식 (폰 화면 − 12px, PC 채팅 폭)', () => {
  const r = find(['dialog.popup:has(', 'dialog:is('], ['width: max(min(var(--sheldWidth, 720px), 100vw - 12px), min(100vw - 12px, 720px))']);
  assert.ok(r, '창 폭 규칙 없음');
  for (const s of [...POP, ...OWN]) assert.ok(r.sel.includes(s), `창 폭 규칙에 ${s} 빠짐`);
});
test('팝업형 창: 아래 「닫기」 줄 숨기고 실리태번 닫기(×)를 머리 오른쪽에', () => {
  const hide = find(['> .popup-body > .popup-controls'], ['display: none !important']);
  const show = find(['> .popup-button-close'], ['display: block !important', 'width: 34px', 'height: 34px', 'font: 400 22px/34px']);
  assert.ok(hide && show, '닫기 줄 숨김 · × 보이기 규칙 없음');
  for (const s of POP) { assert.ok(hide.sel.includes(s), `닫기 줄 숨김에 ${s} 빠짐`); assert.ok(show.sel.includes(s), `× 보이기에 ${s} 빠짐`); }
  assert.ok(find(['> .popup-button-close::before'], ['content: "×"']), '× 글자 규칙 없음');
});
test('직접 만든 창 · 한글화 · 메모 · 북마크의 × 도 같은 크기 · 글자', () => {
  const r = find(['> header > button', '#pt-panel-close', '.bl-note-btn:has(> i.fa-xmark)', '.cg-icon-btn[data-act="close"]'], ['width: 34px', 'height: 34px', 'font: 400 22px/34px sans-serif']);
  assert.ok(r, '× 규칙 없음');
  for (const s of OWN) assert.ok(r.sel.includes(s), `× 규칙에 ${s} 빠짐`);
});
test('제목: 메뉴 글자 크기 · 650, 판 알약은 확장 서랍 .ext-version 과 같은 값', () => {
  const t = find(['.po-title', '.pa-hub-title', '> header > b', '#pt-panel-header > h3'], ['font-size: var(--bl-ts-ui, 14.5px)', 'font-weight: 650']);
  assert.ok(t, '제목 규칙 없음');
  const v = find([':is(.ext-version, .pt-version, .bl-notes-ver)'], ['border-radius: var(--bl-r-pill, 999px)', 'font-size: var(--bl-fs-micro)', 'padding: 2px 8px 0', 'color: var(--salty-muted)']);
  assert.ok(v, '판 알약 규칙 없음');
  const drawer = read('css/09-st-align-brand-loader-greys.css');
  for (const d of ['padding: 2px 8px 0', 'border-radius: var(--bl-r-pill)', 'font-size: var(--bl-fs-micro) !important', 'color: var(--salty-muted)']) assert.ok(drawer.includes(d), `확장 서랍 판 알약 값이 바뀜(${d}) — 85 와 같이 고칠 것`);
});
test('직접 만든 창 머리 마크업: 아이콘 + 이름 + 판(.ext-version) + ×', () => {
  const files = { 'src/addons/translator/bridge.js': 'fa-language', 'src/addons/assets/index.js': 'fa-images', 'src/addons/customstyle/index.js': 'fa-sliders', 'src/addons/direction/index.js': 'fa-feather-pointed', 'src/addons/zipinstall/index.js': 'fa-file-zipper', 'src/addons/mermaid/index.js': 'fa-diagram-project', 'src/addons/prompt-template/index.js': 'fa-code' };
  for (const [f, icon] of Object.entries(files)) {
    const head = (read(f).match(/<header><b>[\s\S]*?<\/header>/) || [''])[0];
    assert.ok(head, `${f}: 머리 마크업 <header><b>… 없음`);
    assert.ok(head.includes(icon), `${f}: 아이콘 ${icon} 없음`);
    assert.ok(head.includes('class="ext-version"'), `${f}: 판 알약 없음`);
    assert.ok(/<button[^>]*>×<\/button><\/header>/.test(head), `${f}: × 단추 없음(✕ 말고 ×)`);
  }
});
test('탭: 기본 한 줄과 확대 배치 설정 · 아이콘 + 글자 가로 한 줄(7.7.8, 글자 탭 높이 --bl-h-ctl) · 고른 탭 포인트 13%', () => {
  const box = find(['.lv-tabs', '.llmt-tabs', '.po-menu-tabs', '.bwr_tabs', '.pa-hub-tabs', '.rl-tabs', '#pt-tabs'], ['grid-auto-flow: var(--bl-tab-flow,column)', 'grid-auto-columns: minmax(0, 1fr)', 'grid-template-columns: var(--bl-tab-columns,none)']);
  const tab = find(['.lv-tab', '.llmt-tab', '.po-menu-tabs > button', '.bwr_tab', '.pa-hub-tab', '.rl-tab', '.pt-tab'], ['flex-direction: row', 'min-height: var(--bl-h-ctl, 36px)', 'border-radius: 8px']);
  const on = find(['.lv-tab', '.pt-tab', ':is(.active, [aria-pressed="true"], [aria-selected="true"])'], ['color-mix(in srgb, var(--salty-accent) 13%, transparent)', 'color: var(--salty-accent)']);
  assert.ok(box && tab && on, '탭 규칙 없음');
  assert.ok(find(['.lv-tabs', '.llmt-tabs'], ['order: -2']), 'TTS · 번역 탭이 맨 위로 안 감');
  assert.ok(find(['.bwr_body > .bwr_tabs'], ['order: -1']), '다시 쓰기 탭이 맨 위로 안 감');
  for (const n of [1, 2, 3]) assert.ok(find([`.po-menu-tabs > button:nth-child(${n})::before`], ['content:']), `확장 순서 탭 ${n} 아이콘 없음`);
});
test('고른 칸 = 꽉 찬 포인트, 카드 = 모서리 12 · 1px 테 (원래 색 있는 테는 그대로)', () => {
  assert.ok(find(['.bwr_seg.active', '.bl-look-segbtn.on'], ['background: var(--salty-accent)', 'color: var(--salty-on-accent, var(--bl-fb-fff))', 'font-weight: 650']), '고른 칸 규칙 없음');
  assert.ok(find(['.lv-card', '.llmt-card', '.mr-item', '.rl-module', '.po-item', '.jj-card', '.blzi-card', '.eh-card'], ['border-radius: 12px', 'border-width: 1px']), '카드 규칙 없음');
  const color = find(['.mr-item:not(.is-picked)', '.rl-module', '.po-item'], ['border-color: var(--salty-line)']);
  assert.ok(color && !color.sel.includes('.llmt-card') && !color.sel.includes('.jj-'), '테 색은 테 없던 카드에만');
});
test('색 · 글꼴 · 자간은 안 바꿈 (font-family · letter-spacing · 새 색 값 없음)', () => {
  assert.ok(!/font-family:(?!\s*"Font Awesome)/.test(css), '글꼴을 바꾸는 규칙이 있음 (아이콘 글꼴만 허용)');
  assert.ok(!/letter-spacing/.test(css), '자간을 바꾸는 규칙이 있음');
  assert.ok(!/#[0-9a-f]{3,8}\b(?![^{]*\{)/i.test(css.replace(/content:\s*"[^"]*"/g, '').replace(/#[\w-]+(?=[\s,>:.{)\]])/g, '')), '새 색 값(#…)이 있음 — 테마 색 변수만');
});
test('7.2.9 붙어 다니는(sticky) 머리: 통일 규칙의 투명 머리 판을 창 판(불투명)으로 되돌림 · 내용 위', () => {
  // 통일 머리 규칙은 「background: none」 — 애드온 style.css 가 머리를 sticky 로 두는 창은 굴릴 때 내용이 머리 글자와 겹쳐 보인다(ZIP 설치 창, 폰 · 어두움)
  const none = rules.findIndex(r => r.sel.includes('dialog.blzi-dialog') && r.sel.endsWith('> header') && r.decl.includes('background: none !important'));
  assert.ok(none >= 0, '통일 머리 규칙(background: none) 없음');
  const addonDirs = fs.readdirSync(path.join(root, 'src/addons'));
  const stickyHeads = [];
  for (const dir of addonDirs) {
    const file = path.join(root, 'src/addons', dir, 'style.css'); if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/position\s*:\s*sticky/.test(m[2])) continue;
      for (const sel of m[1].split(',').map(s => s.replace(/\s+/g, ' ').trim())) {
        const own = OWN.find(c => sel === `${c} > header`); if (own) stickyHeads.push(own);
      }
    }
  }
  assert.ok(stickyHeads.includes('.blzi-dialog'), 'ZIP 설치 창 머리가 sticky 가 아님 — 이 시험을 다시 볼 것');
  for (const own of stickyHeads) {
    const at = rules.findIndex(r => r.sel === `html body.salty dialog${own} > header` && r.decl.includes('background: inherit !important') && r.decl.includes('z-index: 2 !important'));
    assert.ok(at > none, `${own}: sticky 머리인데 불투명 판 규칙(background: inherit · z-index 2)이 통일 규칙 뒤에 없음`);
    assert.ok(!/(height|padding|margin|min-height|position)\s*:/.test(rules[at].decl), `${own}: 머리 판 규칙이 크기 · 자리를 바꿈 (굴릴 때 튐)`);
  }
  assert.ok(built.includes('html body.salty dialog.blzi-dialog > header { background: inherit !important; z-index: 2 !important; }'), 'style.css 다시 만들기 — node tools/build-css.cjs');
});
console.log(`PASS addon unify: ${passed} checks (15 windows' frame · header · tabs · picked · cards · width)`);
