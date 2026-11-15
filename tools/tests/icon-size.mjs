// 1.5.1 아이콘 크기 · 폰 창 여백 기준 지키기(사용자 「아이콘 너무 작아서 잘 안 보임 · 전수조사」 · 「옆에 불필요한 여백이 두 겹」) — 브라우저 없이 값만 봐요.
//   ① 아이콘만 단추의 공용 잉크 = 15px(34 칸의 45% 가까이) · 대체값도 같은 값 · 15px 에서는 0.06em 아래 옮김을 걸지 않음
//   ② 선 아이콘 모드: 메시지 이름 줄 단추 · 이름 줄로 꺼낸 단추 · ⋯ 메뉴 안 단추가 같은 20px(그림 ≈ 15 ~ 16 · 선 1.5px)
//   ③ 위 막대 선 아이콘: 폰 24px(PC 21 그대로)
//   ④ 설정 창 머리 되돌리기 · 다시 실행 · 검색 그림 19px
//   ⑤ 「소리 대본 편집」도 선 그림(⋯ 메뉴 줄에서 혼자 속찬 글리프가 아님)
//   ⑥ 폰 창 여백: 애드온 창 안쪽 · 카드 안쪽을 줄이는 규칙이 폰 폭 조건 안에만 있음(PC 는 그대로)
//   node tools/tests/icon-size.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };
const px = (text, re) => { const m = text.match(re); assert.ok(m, `규칙을 못 찾았어요: ${re}`); return Number(m[1]); };

const parts = strip(read('css/88-ui-parts.css'));
t('아이콘만 단추 공용 잉크 15px · 대체값도 15', () => {
    assert.equal(px(parts, /--bl-ui-ink-fa:\s*([\d.]+)px/), 15);
    for (const f of ['css/27-compact.css', 'css/85-addon-unify.css']) for (const m of strip(read(f)).matchAll(/var\(--bl-ui-ink-fa,\s*([\d.]+)px\)/g)) assert.equal(Number(m[1]), 15, `${f} 대체값`);
});
t('공용 목록 단추(15px): 아래로 옮기지 않고 위로 0.03em 안쪽만(면 안 가운데 0.5px)', () => {
    const rule = parts.split('\n').find(l => l.includes('font-size: var(--bl-ui-ink-fa) !important') && l.includes('.eh-icon-btn'));
    assert.ok(rule, '공용 목록 > i 규칙');
    const m = rule.match(/translate:\s*0\s+(-?[\d.]+)em/);
    assert.ok(m && Number(m[1]) < 0 && Number(m[1]) >= -0.03, '위로 0.03em 안쪽(폰 384 화소 측정 — 0.06em 아래는 +1.2 ~ 1.6px · 0.04em 위는 에셋 창 −0.73px)');
});

const chat = strip(read('css/05-chat.css')); const pins = strip(read('css/54-mes-pins.css'));
t('선 아이콘: 이름 줄 · 꺼낸 단추 · ⋯ 메뉴 안이 같은 20px', () => {
    const row = px(chat, /body\.salty\.salty-icons-line #chat \.mes \.mes_buttons\s*\{\s*font-size:\s*([\d.]+)px !important/);
    const menu = px(chat, /body\.salty:not\(\.expandMessageActions\)\.salty-icons-line #chat \.mes \.extraMesButtons > \*\s*\{\s*font-size:\s*([\d.]+)px !important/);
    const pin = px(pins, /body\.salty\.salty-icons-line #chat \.mes \.bl-pinned\s*\{\s*font-size:\s*([\d.]+)px !important/);
    assert.deepEqual([row, menu, pin], [20, 20, 20]);
    assert.ok(row * 1.8 / 24 >= 1.4, '선 굵기 1.4px 이상(24칸 · 굵기 1.8)');
});

const top = strip(read('css/01-smear-topbar-drawers.css'));
t('위 막대 선 아이콘: PC 21 · 폰 24', () => {
    const all = [...top.matchAll(/body\.salty\.salty-icons-line #top-settings-holder \.drawer-icon\s*\{\s*font-size:\s*([\d.]+)px !important/g)].map(m => Number(m[1]));
    assert.deepEqual(all, [21, 24]);
    const at = top.indexOf('font-size: 24px'); const media = top.lastIndexOf('@media', at);
    assert.ok(media > 0 && /max-width:\s*1000px/.test(top.slice(media, at)), '24px 는 폰 폭 조건 안');
});

t('설정 창 머리 그림 20px(칸 32 안에서 짝수 — PC 에서 반 화소가 남지 않게)', () => {
    const c = strip(read('css/56-control-consistency.css'));
    assert.match(c, /\.bl-editor \.bl-editor-actions svg\s*\{[^}]*width:20px;\s*height:20px;\s*margin:-2px/);
});

t('「소리 대본 편집」도 선 그림(메뉴 안 · 꺼낸 단추)', () => {
    const tts = strip(read('src/addons/tts/style.css'));
    const mask = tts.match(/([^{}]+)\{[^{}]*mask:\s*var\(--salty-mi\)[^{}]*\}/);
    assert.ok(mask && ['.extraMesButtons > .lv_play', '.extraMesButtons > .lv_script', '.bl-pinned.lv_play', '.bl-pinned.lv_script'].every(s => mask[1].includes(s)), '네 자리 모두 마스크 그림');
    assert.match(tts, /\.lv_script[^{}]*\{\s*--salty-mi:\s*url\("data:image\/svg\+xml,/);
});

t('폰 창 여백 규칙은 폰 폭 조건 안에만', () => {
    const u = strip(read('css/85-addon-unify.css'));
    const at = u.indexOf('.bl-translator-dialog > .bl-translator-dialog-body'); assert.ok(at > 0, '창 안쪽 여백 규칙');
    const media = u.lastIndexOf('@media', at); assert.ok(/@media \(max-width: 600px\)/.test(u.slice(media, media + 40)), '폰 폭 조건');
    const block = u.slice(media, u.indexOf('\n}', at) + 2);
    assert.ok(!block.slice(30).includes('@media'), '조건 한 겹');
    for (const s of ['.llmt-card-body', '.blzi-card', '.eh-card', '.bls-card', '.lv-card', '.bwr_card']) assert.ok(block.includes(s), `카드 ${s}`);
    const e = strip(read('css/47-settings-editor.css'));
    const g = e.indexOf('--bl-editor-gutter:6px'); assert.ok(g > 0 && /@container bl-editor \(max-width:480px\)/.test(e.slice(e.lastIndexOf('@container', g), g)), '설정 창 가장자리 6 은 폰 폭 조건 안');
});

// 1.5.2 면 안 가운데(잉크 가운데 = 단추 가운데 · 0.5px 안)의 보정 값 — 그림 자체의 잉크 가운데는 캔버스로 읽는 tools/tests/icon-center-browser.mjs 가 봐요
t('면 안 가운데: 선 그림을 단추 한가운데에 직접 놓음 · 치우친 그림은 따로', () => {
    assert.match(chat, /body\.salty\.salty-icons-line #chat \.mes :is\(\.mes_buttons, \.extraMesButtons\) > \.mes_button::before\s*\{\s*position: absolute;\s*inset: 0;\s*margin: auto;/);
    assert.match(parts, /\.po-move > i\.fa-chevron-up \{ translate: 0 [\d.]+px; \}/);
    assert.match(parts, /\.po-move > i\.fa-chevron-down \{ translate: 0 -[\d.]+px; \}/);
    assert.match(strip(read('css/25-palette-maker.css')), /\.salty-mode-switch button > i \{ translate: 0 -[\d.]+px; \}/);
    assert.match(strip(read('css/04-send-form.css')), /#jj-button\[data-jj-level\] > i \{ translate: -?[\d.]+px 1px; \}/);
    // 번역 단추의 뇌 그림: 다른 그림과 같은 눈 크기(0.88배) · 선 굵기는 그대로(1.8 ÷ 0.88)
    const brain = decodeURIComponent(read('css/11-chrome.css').match(/--salty-mi-brain:\s*url\("data:image\/svg\+xml,([^"]+)"\)/)[1]);
    assert.match(brain, /scale\(\.88\)[^>]*stroke-width="2\.05"/);
});

// 1.5.2 일렬: 확장 서랍 줄 머리의 아이콘은 고정 폭 칸 한가운데 · 이름은 모든 줄에서 같은 자리(칸 24 + 사이 8)
t('일렬: 확장 줄 머리 아이콘 칸 24px 고정 · 가운데 · 사이 8 · 넓은 글리프는 줄임', () => {
    const r = strip(read('css/66-ui-rhythm.css'));
    const cell = r.match(/#rm_extensions_block \.inline-drawer-header > :is\(b,strong\) > i \{([^}]*)\}/);
    assert.ok(cell, '아이콘 칸 규칙');
    for (const d of ['flex:0 0 24px', 'width:24px', 'justify-content:center', 'align-items:center', 'margin:0']) assert.ok(cell[1].replace(/\s+/g, ' ').includes(d), `칸 ${d}`);
    assert.match(r, /\.inline-drawer-header > :is\(b,strong\) > i:is\(\.fa-language,[^)]*\) \{ font-size:\.88em; \}/);
    // 줄 머리 구조로 잡아요(확장 이름 · 확장 id 로 덧칠하지 않아요)
    assert.ok(!/#[a-z_-]*(translat|llm|jj-|lv_|bwr)[a-z_-]* [^{]*inline-drawer-header > :is\(b,strong\) > i/.test(r), '확장별 덧칠 없음');
    assert.match(strip(read('css/75-version-pill.css')), /\.inline-drawer-header > :is\(b, strong\) \{ gap: 8px !important; \}/);
});

console.log(`\n${n}개 통과`);
