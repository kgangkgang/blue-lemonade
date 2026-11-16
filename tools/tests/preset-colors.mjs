// 1.5.5 프리셋 인물 색 — src/preset-colors-core.js(순수 파서) · src/preset-colors.js(실리태번 연결 · 기억) · 인물표 차례 · 얼굴 색 차례
//   node tools/tests/preset-colors.mjs <테마 루트>
// 고정 자료는 11-15 표본(솔라 · 데우스 3 · 청과 4.0 · 과일 6.4)의 꼴을 그대로 본뜨되 이름 · 색은 모두 지어낸 것이에요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const url = rel => pathToFileURL(path.join(themeRoot, rel)).href;
const read = rel => fs.readFileSync(path.join(themeRoot, rel), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
globalThis.document = new EventTarget();
const C = await import(url('src/preset-colors-core.js'));
const P = await import(url('src/people.js'));
const G = await import(url('src/preset-colors.js'));
const X = await import(url('src/ext-compat.js'));
const pick = out => out.map(p => [p.names[0], p.color]);

// ① 카드별 표(솔라 · 데우스 · 청과 · 과일의 「카드 따라 자동」 꼴): 영어 머리줄 · 중국어 머리줄 · {{user}} 줄 · 표 여러 장 + getvar
const AUTO = [
    '{{setvar::bl_cast_별빛여관::- Fixed colors for this cast — always use exactly these, recognizing the listed aliases and language variants as the same character:',
    '  - Orin / Orrin / 오린 / オリン: "#d04a5a"',
    '  - Pella / 펠라 / ペラ: "#4a7fd0"',
    '  - Quill Hart / Quill / 퀼 하트 / 퀼 / クィル・ハート: "#8f9c65"',
    '  - {{user}}: "#424C59"}}{{setvar::bl_cast_구름학교::- Fixed colors for this cast:',
    '  - Orin / 오린: "#d04a5a"',
    '  - Tamsin / 탐신: "#33aa77"',
    '  - {{user}}: "#424C59"}}{{setvar::bl_cast_안개마을::  - 角色色表（只用这些）：',
    '  - Vesna / 베스나 / ヴェスナ：“#aa55cc”',
    '  - Yuki / 유키 / ユキ：「#55aacc」',
    '  - {{user}}: "#424C59"}}',
    '- Dialogue color rule: wrap spoken lines in <span style="color:#hex">…</span>.',
    '{{getvar::bl_cast_{{char}}}}',
].join('\n');

await test('① 카드별 표: 지금 카드 표만 · 별칭 · 「Quill Hart」 처럼 띄어 쓴 이름 · {{user}} 줄은 버림', () => {
    const out = C.parsePresetColors({ prompts: [AUTO], charNames: ['별빛여관'] });
    assert.deepEqual(pick(out), [['Orin', '#d04a5a'], ['Pella', '#4a7fd0'], ['Quill Hart', '#8f9c65']]);
    assert.deepEqual([...out[2].names], ['Quill Hart', 'Quill', '퀼 하트', '퀼', 'クィル・ハート']);
    assert.ok(Object.isFrozen(out[0]) && Object.isFrozen(out[0].names));
});
await test('① 다른 카드 · 카드 없음 · 그룹(구성원 카드 둘)', () => {
    assert.deepEqual(pick(C.parsePresetColors({ prompts: [AUTO], charNames: ['구름학교'] })), [['Orin', '#d04a5a'], ['Tamsin', '#33aa77']]);
    assert.deepEqual(C.parsePresetColors({ prompts: [AUTO], charNames: ['모르는 카드'] }), [], '표 없는 카드는 비어요');
    assert.deepEqual(C.parsePresetColors({ prompts: [AUTO], charNames: [] }), []);
    const g = C.parsePresetColors({ prompts: [AUTO], charNames: ['별빛여관', '구름학교'] });
    assert.deepEqual(pick(g), [['Orin', '#d04a5a'], ['Pella', '#4a7fd0'], ['Quill Hart', '#8f9c65'], ['Tamsin', '#33aa77']], '같은 사람(Orin)은 한 번 · 표기는 합쳐요');
    assert.deepEqual([...g[0].names], ['Orin', 'Orrin', '오린', 'オリン']);
});
await test('① 중국어 머리줄 · 전각 콜론 · “” 「」 따옴표', () => {
    assert.deepEqual(pick(C.parsePresetColors({ prompts: [AUTO], charNames: ['안개마을'] })), [['Vesna', '#aa55cc'], ['Yuki', '#55aacc']]);
});
await test('① getvar 가 없으면 setvar 표는 어느 카드 것인지 몰라 버려요', () => {
    const noGet = AUTO.replace('{{getvar::bl_cast_{{char}}}}', '');
    assert.deepEqual(C.parsePresetColors({ prompts: [noGet], charNames: ['별빛여관'] }), []);
    const other = AUTO.replace('{{getvar::bl_cast_{{char}}}}', '{{getvar::bl_cast_별빛여관}}');
    assert.deepEqual(C.parsePresetColors({ prompts: [other], charNames: ['별빛여관'] }), [], '{{char}} 로 고르는 꼴만');
});

// ② 그냥 표(과일의 「대사 색상 (세계관 이름)」 고정 항목 꼴)
const FIXED = ['🎨 고정 대사 색:', '- Orin / 오린: "#d04a5a"', '- Pella / 펠라: #4a7fd0', '', '- Rook: \'#aa8800\';'].join('\n');
await test('② 그냥 표: 두 줄 이상 이어진 표 · 빈 줄 하나는 건너요 · 따옴표 없어도 · 끝 세미콜론', () => {
    assert.deepEqual(pick(C.parsePresetColors({ prompts: [FIXED] })), [['Orin', '#d04a5a'], ['Pella', '#4a7fd0'], ['Rook', '#aa8800']]);
});
await test('② 버리는 줄: 혼자 떨어진 한 줄 · CSS · 변수 · 매크로 · 기호 · 긴 글', () => {
    const noise = [
        'Narration: "#cccccc"',
        '',
        '',
        '.dem-expressive--shout{--dem-mood:#fab387;font-weight:700}',
        '--dem-mood: #fab387;',
        'color: #e0e0e0;',
        'background: #101010;',
        '- {{char}}: "#123456"',
        '- <b>Orin</b>: "#d04a5a"',
        '- Use this when the scene is very long and the speaker changes several times in a row: "#d04a5a"',
    ].join('\n');
    assert.deepEqual(C.parsePresetColors({ prompts: [noise] }), [], '이름답지 않은 줄 · 혼자 떨어진 줄 · CSS 줄은 안 나와요');
});
await test('② 낱말 하나짜리 CSS 줄 둘이 붙어 있어도 표로 치지 않게 — 「color」 「background」 꼴 확인', () => {
    const css = ['color: #e0e0e0;', 'background: #101010;'].join('\n');
    const out = C.parsePresetColors({ prompts: [css] });
    assert.deepEqual(out, [], '따옴표 없는 색은 글머리가 있을 때만 표로 읽어요');
});

// ③ 정규식(이름 갈래 → 색)
const S = (find, rep, disabled = false) => ({ id: find, findRegex: find, replaceString: rep, disabled });
await test('③ 정규식: 이름 갈래 찾기 + 바꿀 글에 색 하나 → 표 · 꺼진 것 · 색 둘 · 복잡한 찾기는 버림', () => {
    const out = C.parsePresetColors({ scripts: [
        S('/\\b(Orin|오린)\\b/g', '<font color="#d04a5a">$1</font>'),
        S('/(?:Pella|펠라)/g', '<span style="color:#4A7FD0">$&</span>'),
        S('/Rook/g', '<span style="color:#aa8800">$&</span>', true),
        S('/(Tamsin)/g', '<span style="color:#33aa77;border-color:#000000">$1</span>'),
        S('/<(?:color:)?amber(?::([a-z0-9_.:-]+))?>/gi', '<font color="#F3B74B">'),
        S('/"([^"]+)"/g', '<span style="color:#ffffff">"$1"</span>'),
    ] });
    assert.deepEqual(pick(out), [['Orin', '#d04a5a'], ['Pella', '#4a7fd0']]);
});

// 맞부딪힘
await test('한 이름에 색이 둘이면 그 사람은 통째로 버려요(다른 사람은 그대로)', () => {
    const a = ['- Orin / 오린: "#d04a5a"', '- Pella: "#4a7fd0"'].join('\n');
    const b = ['- 오린: "#111111"', '- Tamsin: "#33aa77"'].join('\n');
    assert.deepEqual(pick(C.parsePresetColors({ prompts: [a, b] })), [['Pella', '#4a7fd0'], ['Tamsin', '#33aa77']]);
    assert.deepEqual(pick(C.parsePresetColors({ prompts: [a], scripts: [S('/\\b(Orin)\\b/g', '<font color="#d04a5a">$1</font>')] })), [['Orin', '#d04a5a'], ['Pella', '#4a7fd0']], '같은 색이면 그대로');
});

// 실리태번 연결 · 기억 · 인물표 차례
function fakeST() {
    const prompts = new Map([['auto', { identifier: 'auto', content: AUTO }], ['fixed', { identifier: 'fixed', content: FIXED }]]);
    const order = [{ identifier: 'auto', enabled: true }, { identifier: 'fixed', enabled: false }];
    const presetRegex = [S('/\\b(Zed|제드)\\b/g', '<font color="#7766ee">$1</font>')];
    const handlers = new Map();
    const st = {
        presetName: 'P1', presetRegex, order, prompts,
        ctx: {
            characterId: 0, characters: [{ name: '별빛여관', avatar: 'inn.png', data: { extensions: { regex_scripts: [] } } }], groups: [],
            extensionSettings: { regex: [], preset_allowed_regex: { openai: ['P1', 'P2'] }, character_allowed_regex: [] },
            getPresetManager: () => ({ getSelectedPresetName: () => st.presetName, readPresetExtensionField: () => st.presetRegex }),
            eventSource: { on: (e, f) => handlers.set(e, f), removeListener: e => handlers.delete(e) },
            eventTypes: { OAI_PRESET_CHANGED_AFTER: 'preset', SETTINGS_UPDATED: 'settings', CHAT_CHANGED: 'chat' },
        },
        api: { promptManager: { activeCharacter: {}, getPromptOrderForCharacter: () => order, getPromptById: id => prompts.get(id) } },
        fire: e => handlers.get(e)?.(),
        handlers,
    };
    return st;
}
const st = fakeST();
globalThis.SillyTavern = { getContext: () => st.ctx };
await test('연결: 켜진 프롬프트 · 허용된 프리셋 정규식에서 읽어 인물표 공급자(preset)로 · 꺼진 항목은 안 읽음', async () => {
    G._forTest.setApi(st.api);
    G._forTest.reset();
    assert.equal(G.refreshPresetColors(), true);
    const unregister = P.registerPeopleSource('preset', G._forTest.source, { rank: 100 });
    const orin = P.people.get('오린');
    assert.equal(orin.color, '#d04a5a'); assert.equal(orin.colorFrom, 'preset');
    assert.deepEqual(Object.keys(orin), ['name', 'names', 'color', 'voice'], 'colorFrom 은 셀 수 없는 칸 — 예전 모양 그대로');
    assert.equal(P.people.get('Zed').color, '#7766ee', '프리셋 정규식');
    assert.equal(P.people.get('Rook'), null, '꺼진 항목(고정 표)은 안 읽어요');
    unregister();
});
await test('기억: 지문이 같으면 다시 뽑지 않고 · 프리셋 바꿈 · 프롬프트 켬끔 · 정규식 켬끔 · 카드 바꿈이면 다시', () => {
    G._forTest.reset();
    G.refreshPresetColors(); const g0 = G._forTest.gen;
    assert.equal(G.refreshPresetColors(), false); assert.equal(G._forTest.gen, g0, '같은 지문');
    st.order[1].enabled = true;                         // 고정 표 켬
    assert.equal(G.refreshPresetColors(), true); assert.equal(G._forTest.source.person(['Rook']).color, '#aa8800');
    st.presetRegex[0].disabled = true;                  // 프리셋 정규식 끔
    assert.equal(G.refreshPresetColors(), true); assert.equal(G._forTest.source.person(['Zed']), null);
    st.presetRegex[0].disabled = false;
    st.presetName = 'P3';                               // 정규식 허용 안 된 프리셋으로
    assert.equal(G.refreshPresetColors(), true); assert.equal(G._forTest.source.person(['Zed']), null, '허용 안 된 프리셋의 정규식은 실리태번도 안 돌려요');
    st.presetName = 'P1'; st.order[1].enabled = false;
    st.ctx.characters[0].name = '구름학교';               // 다른 카드
    assert.equal(G.refreshPresetColors(), true); assert.equal(G._forTest.source.person(['Pella']), null); assert.equal(G._forTest.source.person(['Tamsin']).color, '#33aa77');
    st.ctx.characters[0].name = '별빛여관';
    G.refreshPresetColors();
});
await test('이벤트 · 늦은 확인: 이벤트가 오면 바로 · 이벤트 없는 바꿈도 인물표가 물을 때(1.5초에 한 번까지) 다시 재요', async () => {
    G._forTest.reset();
    await G.syncPresetColors(true);
    assert.ok(st.handlers.has('preset') && st.handlers.has('settings') && st.handlers.has('chat'));
    st.prompts.get('auto').content = AUTO.replace('#4a7fd0', '#4a7fd1');
    st.fire('settings');
    assert.equal(P.people.get('Pella').color, '#4a7fd1');
    st.prompts.get('auto').content = AUTO;              // 이벤트 없이 되돌림
    G._forTest.clearLook();
    assert.equal(P.people.get('Pella').color, '#4a7fd0', '물을 때 지문을 다시 재요');
    await G.syncPresetColors(false);
    assert.equal(P.people.get('Pella'), null, '끄면 공급자에서 빠져요');
    assert.equal(st.handlers.size, 0, '이벤트도 떼요');
});
await test('인물표 차례: TTS(차례 0)가 먼저 · 프리셋(100)은 뒤 · colorFrom · 얼굴 색 차례(TTS 대사 → TTS 카드별 기억 → 프리셋)', async () => {
    await G.syncPresetColors(true);
    const tts = { person: names => names.some(n => n === 'Orin' || n === '오린') ? { color: '#010203' } : null, names: () => ['Orin'], stamp: () => 1 };
    const off = P.registerPeopleSource('tts', tts);
    const o = P.people.get('Orin');
    assert.equal(o.color, '#010203'); assert.equal(o.colorFrom, 'tts');
    assert.equal(P.people.get('Pella').colorFrom, 'preset');
    assert.equal(X.personColor(P.people, { from: 'other' }, 'Pella'), null, 'TTS 차례에서는 프리셋 색을 안 써요');
    assert.equal(X.personColor(P.people, { from: 'preset' }, 'Pella'), '#4a7fd0');
    assert.equal(X.personColor(P.people, { from: 'preset' }, 'Orin'), null, 'TTS 가 준 색은 프리셋 차례에서 안 써요');
    assert.equal(X.personColor(P.people, 'Pella'), '#4a7fd0', '거르기 없이 부르면 예전처럼 아무 공급자나');
    off();
    await G.syncPresetColors(false);
});
await test('코드: 이름 · 색을 박지 않아요(파서 · 연결 모듈에 #색 글자 없음) · features 가 테마와 함께 켬 · 얼굴 색 차례 줄', () => {
    for (const f of ['src/preset-colors-core.js', 'src/preset-colors.js']) assert.doesNotMatch(read(f).replace(/^\s*\/\/.*$/gm, ''), /#[0-9a-fA-F]{6}\b/, f);
    assert.match(read('src/features.js'), /load\('presetcolors', '\.\/preset-colors\.js'\)\.then\(m => m\?\.syncPresetColors\(on\)\)/);
    assert.match(read('src/ext-compat.js'), /personColor\(people, \{ from: 'other' \}, names\[k\], shown\[k\]\) \|\| tableColor\(cardsOf\(\), names\[k\], shown\[k\]\) \|\| personColor\(people, \{ from: 'preset' \}/);
});

// 1.5.9 유저 줄({{user}})
await test('유저 줄: 페르소나 이름을 주면 그 이름의 색으로(맨 끝에 한 사람) · 안 주면 예전처럼 버려요', () => {
    const out = C.parsePresetColors({ prompts: [AUTO], charNames: ['별빛여관'], userName: '하나' });
    assert.deepEqual(pick(out), [['Orin', '#d04a5a'], ['Pella', '#4a7fd0'], ['Quill Hart', '#8f9c65'], ['하나', '#424c59']]);
    assert.deepEqual(pick(C.parsePresetColors({ prompts: [AUTO], charNames: ['별빛여관'], userName: '' })).length, 3);
    assert.deepEqual(pick(C.parsePresetColors({ prompts: [AUTO], charNames: ['별빛여관'], userName: '<b>{{x}}' })).length, 3, '이름답지 않은 페르소나 이름은 버려요');
});
await test('유저 줄: 「인물 한 줄 + {{user}}」 표도 표로 세요(한 사람 카드) · 혼자 떨어진 유저 줄은 여전히 버려요', () => {
    const solo = ['- Colors:', '  - Vess / 베스: "#c05070"', '  - {{user}}: "#424C59"'].join('\n');
    assert.deepEqual(pick(C.parsePresetColors({ prompts: [solo], userName: '하나' })), [['Vess', '#c05070'], ['하나', '#424c59']]);
    assert.deepEqual(pick(C.parsePresetColors({ prompts: [solo] })), [['Vess', '#c05070']], '페르소나 이름이 없어도 인물 색은 받아요');
    assert.deepEqual(C.parsePresetColors({ prompts: ['글 사이에\n- {{user}}: "#424C59"\n혼자 있는 줄'], userName: '하나' }), []);
});
await test('유저 줄: 페르소나 이름이 표의 인물과 겹치면 유저 줄만 버려요(인물 색이 먼저) · 표마다 유저 색이 다르면 버려요', () => {
    const out = C.parsePresetColors({ prompts: [AUTO], charNames: ['별빛여관'], userName: '펠라' });
    assert.deepEqual(pick(out), [['Orin', '#d04a5a'], ['Pella', '#4a7fd0'], ['Quill Hart', '#8f9c65']]);
    const two = ['- A One: "#111111"', '- {{user}}: "#222222"', '', '', '', '- B Two: "#333333"', '- {{user}}: "#444444"'].join('\n');
    assert.deepEqual(pick(C.parsePresetColors({ prompts: [two], userName: '하나' })), [['A One', '#111111'], ['B Two', '#333333']]);
});
await test('유저 줄 연결: 지금 페르소나 이름(name1)으로 인물표에 · 페르소나를 바꾸면 다시 뽑아요', async () => {
    G._forTest.reset();
    st.ctx.name1 = '하나';
    await G.syncPresetColors(true);
    assert.equal(P.people.get('하나').color, '#424c59'); assert.equal(P.people.get('하나').colorFrom, 'preset');
    st.ctx.name1 = '두리'; st.fire('settings');
    assert.equal(P.people.get('하나'), null); assert.equal(P.people.get('두리').color, '#424c59');
    delete st.ctx.name1;
    await G.syncPresetColors(false);
});

console.log(`preset-colors: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
