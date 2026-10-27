// 실리태번 원본 제목 · 라벨 옆 ? 를 테마 선 원으로 그리는 56-control-consistency 의 원본 ? 블록이 빠지거나 줄지 않게 지켜요.
// 8.0.2 는 월드인포 제목 하나만 :where 로 공용 목록에 넣어 페르소나 관리 쪽이 옛 모양으로 남았어요(사용자 제보 10-27) → 8.0.8 전수조사 뒤 원본 전용 목록으로.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const css = fs.readFileSync(path.join(root, 'css/56-control-consistency.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].replace(/\s+/g, ' ').trim(), body: m[2].replace(/\s+/g, ' ') }));
// 원본 전수조사 목록(제목 옆 T · 라벨 옆 L · 월드인포 항목 W) — 하나라도 빠지면 그 자리는 회색 면 원으로 돌아가요
const NATIVE = [
    '#WorldInfo h3 > a.notes-link', '#PersonaManagement h3 > a', '#user-settings-block h3 > a.notes-link', '#AdvancedFormatting h3 > a.notes-link',
    '#rm_api_block a.notes-link[href*="connection-profiles"]', '#groupControlsToggle a.notes-link', '#selectChatPopupHeaderText > a',
    '#rm_ch_create_block :is(#description_div, #first_message_div) a.notes-link', '#character_popup :is(h4, h5) > a.notes-link', '#left-nav-panel a.topRightInset',
    '#novel_api-presets strong > a.notes-link', '#left-nav-panel a.note-link-span[href]', '#left-nav-panel h4 > a:has(> small > .note-link-span)', 'label[for="openai_reasoning_effort"] > a.fa-circle-question',
    '#rm_api_block a:has(> .note-link-span, > i.fa-circle-question)', '#AdvancedFormatting a.notes-link', '#AdvancedFormatting :is(label, summary, small) > :is(.fa-circle-question, .fa-question-circle):not(.note-link-span)',
    '#user-settings-block a.notes-link', '.regex_editor :is(small, span) > .note-link-span', '#WorldInfo .world_entry a.notes-link[href*="inclusion-group"]',
];
const base = rules.find(r => r.selector.startsWith('html body.salty :is(') && !r.selector.includes('::') && !r.selector.includes(':focus-visible') && r.selector.includes('#PersonaManagement h3 > a') && r.body.includes('width:1.25em'));
assert.ok(base, '원본 ? 공통 규칙(1.25em 상자)이 있어야 해요');
for (const sel of NATIVE) assert.ok(base.selector.includes(sel), `원본 ? 목록에 ${sel} 가 있어야 해요`);
assert.ok(base.selector.includes(':where(') === false, '원본 ? 목록은 :where 없이(ID 특이도 그대로) 둬야 옛 ID 규칙에 지지 않아요');
assert.ok(base.body.includes('background:transparent') && base.body.includes('color:transparent'), '투명 바탕 · 투명 글리프여야 해요');
const after = rules.find(r => r.selector.includes('#PersonaManagement h3 > a') && r.selector.endsWith('::after'));
assert.ok(after && after.body.includes('var(--salty-mi-help)') && after.body.includes('var(--salty-accent'), '선 원 마스크 · 포인트 색 ::after 가 있어야 해요');
const touch = rules.find(r => r.selector.includes('#PersonaManagement h3 > a') && r.selector.endsWith('::before') && r.body.includes('44px'));
assert.ok(touch, '링크 ? 의 폰 누르는 칸 44 가 있어야 해요');
for (const tip of ['#AdvancedFormatting :is(label, summary, small) > :is(.fa-circle-question, .fa-question-circle):not(.note-link-span)', '.regex_editor :is(small, span) > .note-link-span'])
    assert.ok(!touch.selector.includes(tip), `툴팁만 있는 ? (${tip})에는 누르는 칸 44 를 주지 않아요 — 옆 체크 줄 탭을 가로채요`);
const hide = rules.find(r => r.selector.includes('#PersonaManagement h3 > a') && r.selector.includes(') > *') && r.body.includes('opacity:0'));
assert.ok(hide && !hide.selector.includes(':has('), '글리프 숨김 규칙(… > *)에는 :has 를 쓰지 않아요 — has-guard 의 「주어 아닌 :has」로 세어져요');
assert.ok(hide, '품은 회색 글리프를 숨기는 규칙이 있어야 해요');
assert.ok(rules.some(r => r.selector.includes(':focus-visible') && r.selector.includes('#PersonaManagement h3 > a')), '키보드 초점 표시가 있어야 해요');
const T = rules.find(r => r.selector.includes('#PersonaManagement h3 > a') && r.body.includes('font-size:var(--bl-fs-body)'));
const L = rules.find(r => r.selector.includes('#user-settings-block a.notes-link') && r.body.includes('font-size:var(--bl-fs-sub)'));
assert.ok(T && L, '제목 등급(본문 글자) · 라벨 등급(보조 글자) 규칙이 있어야 해요');
assert.ok(rules.some(r => r.selector.includes('#PersonaManagement h3') && r.body.includes('gap:6px')), '페르소나 · 월드인포 제목 줄 6px 간격이 있어야 해요');
// 마스크 변수는 선 아이콘 설정과 무관하게 body.salty 에 있어야 해요(아이콘 「기본」에서 파란 네모로 깨졌던 것)
const chrome = fs.readFileSync(path.join(root, 'css/11-chrome.css'), 'utf8');
const vars = [...chrome.matchAll(/^(body\.salty[^{]*)\{([^}]*--salty-mi-help:[^}]*)\}/gms)].map(m => m[1].trim());
assert.ok(vars.includes('body.salty'), '--salty-mi-help 는 body.salty(선 아이콘 끔에서도) 에 정의돼야 해요');
// 옛 ID 규칙이 되살아나면 페르소나 쪽이 다시 진다
const wi = fs.readFileSync(path.join(root, 'css/12-worldinfo.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
assert.ok(!/#PersonaManagement h3 > a\s*\{[^}]*margin:\s*-8px/.test(wi), '12-worldinfo 의 페르소나 32px 상자(margin -8px) 규칙이 되살아나면 안 돼요');
assert.ok(!/h3 \.note-link-span\s*\{[^}]*font-size:\s*16px/.test(wi), '12-worldinfo 의 제목 16px 회색 글리프 규칙이 되살아나면 안 돼요');
console.log(`원본 제목 · 라벨 옆 ? 누락 방지 검사를 통과했어요(목록 ${NATIVE.length}).`);
