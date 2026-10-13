// 다시 쓰기 「이 캐릭터의 특징인가」(near 규칙) 소유 판단 — 일본어 · 한국어 · 가장 가까운 주인 · 알려진 다른 인물의 의 / の · 예전 창 · 비유 · 호칭 · 닿는 거리 상한
// 실제 src/addons/rewrite/core.js 의 compileRule · activateRules · findSpans 로. 이름은 중립: Mina 미나 ミナ = 그 사람, Rex 렉스 レックス = 남
//   node tools/tests/rewrite-owner.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const C = await import(pathToFileURL(path.join(root, 'src/addons/rewrite/core.js')).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const NEAR = ['Mina', '미나', 'ミナ', 'she', 'her', 'hers', 'herself', 'you', 'your', 'yours', '그녀', '그녀의', '彼女', 'あなた', '당신'];
const WORDS = ['red eyes', 'white hair', '/붉은\\s*눈/', '/하얀\\s*(?:머리|피부)/', '/검은\\s*(?:머리카락|눈동자)/', '/赤い瞳/', '/白い(?:髪|肌)/', '/黒い(?:髪|瞳)/'].join('\n');
const PEOPLE = [['Rex', '렉스', 'レックス'], ['Mina', '미나', 'ミナ']];
const RULE = { id: 'colour', name: 'colour', words: WORDS, near: NEAR.join(', ') };
const active = (rule, people = PEOPLE) => C.activateRules([C.compileRule(rule)], 'Mina 미나 ミナ', names => C.splitNames(names), people);
const compiled = active(RULE);
const hit = (text, set = compiled) => C.findSpans(text, set).length > 0;

const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.stack || e.message }); } }
const all = (list, want, set) => { for (const text of list) assert.equal(hit(text, set), want, text); };

test('그 사람 것 (예전 그대로)', () => all([
    'Mina tilted her head, her white hair spilling over her shoulders.',
    "Mina's red eyes narrowed.",
    'She turned, red eyes bright.',
    '미나의 붉은 눈이 가늘어졌다.',
    '미나가 고개를 들자 하얀 머리가 어깨로 흘렀다.',
    'ミナの赤い瞳が細くなった。',
    'ミナが顔を上げると白い髪が肩に落ちた。',
    'ミナは長くて白い髪を揺らした。',
], true));

test('알려진 다른 인물 + 의 / の (+호칭)는 남의 소유', () => all([
    '미나 옆에서 렉스의 붉은 눈이 빛났다.',
    'ミナの隣でレックスの赤い瞳が光った。',
    'ミナの前で、レックスの白い髪が揺れた。',
    '미나는 렉스 씨의 붉은 눈을 바라보았다.',
    '미나는 렉스님의 붉은 눈을 바라보았다.',
    'ミナはレックスさんの赤い瞳を見つめた。',
    'ミナはレックス様の白い髪に触れた。',
], false));

test('가장 가까운 주인이 이긴다: 그 사람 이름 뒤 · 고칠 말 앞의 남의 소유', () => all([
    'Mina watched his red eyes.',
    "Mina met Rex's red eyes.",
    '미나는 렉스의 붉은 눈을 보았다.',
    'ミナが部屋に入ってきたとき、彼の白い髪が揺れた。',
], false));

test('독립 검증의 회귀: 아무 낱말+의 / の 는 남의 소유가 아니다 (자신의 · 특유의 · 장소 · 의로 끝나는 낱말 · 그 사람+호칭+의)', () => all([
    '미나는 자신의 검은 머리카락을 귀 뒤로 넘겼다.',
    '그녀는 자신의 하얀 피부를 내려다보았다.',
    '미나 특유의 검은 눈동자가 반짝였다.',
    '미나는 거울 속의 붉은 눈을 바라보았다.',
    '미나는 회의 내내 붉은 눈을 비볐다.',
    '미나는 주의 깊게 검은 머리카락을 빗었다.',
    '미나님의 검은 눈동자가 반짝였다.',
    '미나 씨의 하얀 피부가 붉게 물들었다.',
    '미나 양의 검은 머리카락이 흘러내렸다.',
    'ミナは自分の黒い髪を耳にかけた。',
    'ミナはその黒い瞳を細めた。',
    'ミナは目の前で黒い髪を揺らした。',
    'ミナさんの黒い髪が揺れた。',
    'ミナ様の白い肌が赤く染まった。',
    '彼女は自分の白い肌を見下ろした。',
], true));

test('독립 검증의 회귀: 한자 · 긴 가타카나 · 가운뎃점 이름도 쪼개지 않는다 (분절 없이 원문 자리로)', () => {
    const names = { id: 'colour-cjk', name: 'colour-cjk', words: WORDS, near: '沢城千夏, 天野雪, アレクサンドラ, アレク・サンドラ' };
    const set = active(names, [['Rex', '렉스', 'レックス']]);
    all([
        '沢城千夏の黒い髪が揺れた。',
        '天野雪の白い肌が赤く染まった。',
        'アレクサンドラの赤い瞳が細くなった。',
        'アレク・サンドラの赤い瞳が細くなった。',
    ], true, set);
    all(['沢城千夏の隣でレックスの黒い髪が揺れた。'], false, set);
});

test('「이름의」는 고칠 말 바로 앞일 때만 남의 소유 (다른 것을 꾸미면 그 사람 것)', () => all([
    '미나는 렉스의 방 앞에서 하얀 머리를 풀었다.',
    'ミナはレックスの部屋の前で白い髪をほどいた。',
], true));

test('일본어 창: 그 사람 이름이 멀어도 남의 소유가 없으면 그 사람 것 · 남의 소유가 고칠 말 바로 앞이면 남의 것', () => {
    all(['ミナは窓辺に立ってゆっくりと振り返り、白い髪を揺らした。'], true);
    all(['ミナは窓辺に立ってゆっくりと振り返り、レックスの白い髪を見た。'], false);
});

test('그녀 · 당신 · 彼女 · あなた 의 / の 는 남이 아니다 (her · your 처럼)', () => all([
    '미나가 웃자 그녀의 붉은 눈이 반짝였다.',
    '미나가 다가와 당신의 하얀 머리를 쓸었다.',
    'ミナが笑うと彼女の赤い瞳がきらめいた。',
    'ミナが来て、あなたの白い髪を撫でた。',
], true));

test('그 사람이 문장에 없으면 안 센다 · 예전 남의 소유(his · 그의 · 彼)도 그대로', () => all([
    'Rex narrowed his red eyes.',
    '렉스가 그의 붉은 눈을 가늘게 떴다.',
    'レックスは彼の赤い瞳を細めた。',
    'His red eyes settled on Mina.',
], false));

test('othersOf: 그 사람이 든 묶음은 통째로 빠지고 · 다른 사람 표기는 모두 · 중복 · 빈 것 뺌', () => {
    assert.deepEqual(C.othersOf([['Rex', '렉스'], ['Mina', 'ミナ', 'Mia'], ['rex', 'レックス'], [''], 'Sol'], ['mina', 'she']), ['Rex', '렉스', 'レックス', 'Sol']);
    assert.deepEqual(C.othersOf(undefined, ['Mina']), []);
    const rule = compiled.find(entry => entry.rule.id === 'colour').rule;
    assert.deepEqual(rule.otherNames, ['Rex', '렉스', 'レックス'], 'activateRules 가 near 규칙에 붙인다');
    const plain = C.activateRules([C.compileRule({ id: 'p', name: 'p', words: 'red eyes', near: '' })], '', names => C.splitNames(names), PEOPLE);
    assert.equal(plain[0].rule.otherNames, undefined, 'near 없는 규칙은 그대로');
    // 다른 인물을 모르면(이름 다리 · 예외 · 채팅 캐릭터 없음) 「렉스의」는 보통 낱말 — 예전처럼 그 사람 것
    assert.equal(hit('미나 옆에서 렉스의 붉은 눈이 빛났다.', active(RULE, [])), true);
});

test('mentions 는 예전과 같다 (경계 · 꼬리)', () => {
    assert.equal(C.mentions('키보드가 왔다', '보드'), false);
    assert.equal(C.mentions('보드가 왔다', '보드'), true);
    assert.equal(C.mentions('보드락 길', '보드'), false);
    assert.equal(C.mentions('キーボードが', 'ボード'), false);
    assert.equal(C.mentions('ボードが', 'ボード'), true);
    assert.equal(C.mentions('Mina, come', 'mina'), true);
    assert.equal(C.mentions('Minami', 'Mina'), false);
});

test('긴 일본어 문단(줄바꿈 없음)도 빠르다 — 문장마다 한 번만 찾는다', () => {
    const unit = 'ミナは窓辺で白い髪を揺らし、レックスの赤い瞳を見つめた。';
    const text = unit.repeat(260);   // 약 7,000자 · 매치 500여 개
    const t0 = performance.now();
    const spans = C.findSpans(text, compiled);
    const ms = performance.now() - t0;
    assert.ok(spans.length > 0);
    assert.ok(ms < 2000, `${Math.round(ms)} ms`);
});

test('배선: index.js 가 이름 다리 · 예외 인물 · 채팅 캐릭터 · 페르소나로 people 을 만들어 activateRules 에 넘긴다 · 분절기 없음 · CI', () => {
    const ix = read('src/addons/rewrite/index.js');
    assert.match(ix, /globalThis\[Symbol\.for\('blue-lemonade\.names'\)\]/);
    assert.match(ix, /for \(const exception of Array\.isArray\(settings\.exceptions\) \? settings\.exceptions : \[\]\)/);
    assert.match(ix, /add\(context\.name1\);\n\s+add\(context\.name2\);/);
    assert.match(ix, /return activateRules\(compiled, recent, resolveNames, peopleNames\(\)\);/);
    const core = read('src/addons/rewrite/core.js');
    assert.ok(!/Intl\.Segmenter/.test(core), '분절기를 쓰지 않는다');
    assert.match(core, /rule\.nearNames, rule\.otherNames, memo, `\$\{start\}:\$\{end\}`\)/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/rewrite-owner\.mjs \./);
    assert.ok(!new RegExp(String.fromCharCode(0xAC24)).test(core + ix + read('tools/tests/rewrite-owner.mjs')), 'no forbidden syllable');
});

// ---------- 6.4.x 검토 덧붙임: 소유가 아닌 대명사 · 조사로 끝나는 사이 · 쉼표 — 6.3.9 처럼 그 사람 것
test('검토: 그 사람과 고칠 말 사이의 목적어 · 주어 대명사는 남의 소유가 아니다 (그를 · 그에게 · him · 彼を · 彼に · 他)', () => all([
    '미나는 그를 붉은 눈으로 바라보았다.',
    '미나는 그에게 붉은 눈을 깜빡였다.',
    '미나는 그가 웃자 붉은 눈을 가늘게 떴다.',
    'Mina kissed him, red eyes closing.',
    'ミナは彼を赤い瞳で見つめた。',
    'ミナは彼に赤い瞳を向けた。',
    'ミナは他の誰よりも白い肌をしていた。',
], true));
test('검토: 다른 인물+의/の 뒤가 조사로 끝나는 낱말 · 동사구 · 쉼표면 고칠 말에 닿지 않는다', () => all([
    '미나는 렉스의 품에서 붉은 눈을 감았다.',
    '미나는 렉스의 어깨에 하얀 머리를 기댔다.',
    '미나는 렉스의 말에 붉은 눈을 크게 떴다.',
    'ミナはレックスの手を握り、赤い瞳を潤ませた。',
    'ミナはレックスの胸で赤い瞳を閉じた。',
], true));
test('검토: 닿는 소유는 그대로 남의 것 (꾸밈말 하나 · 소유 바로 뒤 쉼표 · his)', () => all([
    '미나는 렉스의 붉은 눈을 마주 보았다.',
    '렉스의 차가운 붉은 눈이 미나를 향했다.',
    'ミナはレックスの赤い瞳を見つめ返した。',
    'レックスの冷たく赤い瞳がミナを捉えた。',
    'ミナはレックスの、赤い瞳を見つめた。',
    'Mina watched his red eyes.',
    'ミナが部屋に入ってきたとき、彼の白い髪が揺れた。',
], false));

// ---------- 6.4.x 소유 판단 v3: 예전 창(띄어쓰기 없는 덩이 통째) · 비유 · 남의 표시 속 호칭 · 창 자리
test('v3: 띄어쓰기 없는 일본어 · 중국어에서 이름이 고칠 말보다 멀어도 사이에 닿는 소유가 없으면 그 사람 것 (6.4.0 그대로)', () => {
    all([
        'ミナは彼の胸に顔をうずめて、赤い瞳を閉じた。',
        'ミナはその他大勢の中でも、ひときわ白い肌をしていた。',
        'ミナはゆっくりと立ち上がり、白い髪を揺らしながら彼の方へ歩いた。',
        'ミナは窓の外を眺めていた。白い髪が風に揺れる。彼が部屋に入ってきた。',
        'ミナは他愛もない話をしながら、白い髪を指に巻きつけた。',
        'ミナは彼をじっと見つめながら、赤い瞳を細めた。',
    ], true);
    const long = active({ id: 'colour-long', name: 'colour-long', words: WORDS, near: 'アレクサンドラ' }, [['Rex', '렉스', 'レックス']]);
    all([
        'アレクサンドラは彼の胸で赤い瞳を閉じた。',
        'アレクサンドラは彼をじっと見つめながら、赤い瞳を細めた。',
        'アレクサンドラはゆっくりと立ち上がり、白い髪を揺らしながら彼の方へ歩いた。',
    ], true, long);
    all(['アレクサンドラはゆっくり振り返って、彼の赤い瞳を見つめた。', 'アレクサンドラはゆっくり振り返って、レックスの赤い瞳を見つめた。'], false, long);
    const zh = active({ id: 'colour-zh', name: 'colour-zh', words: '/白色的头发/', near: '米娜' }, []);
    all(['米娜慢慢地从椅子上站起来，白色的头发随风飘动，她走向了他。'], true, zh);
});
test('v3: 「다른 인물+のような · の様な · の如き」 비유는 소유가 아니다', () => {
    all([
        'ミナはレックスのような赤い瞳をしていた。',
        '彼女はレックスのような白い肌をしていた。',
        'ミナはレックスの様な白い肌をしていた。',
        'ミナはレックスの如き赤い瞳で睨んだ。',
        'ミナは彼のような赤い瞳をしていた。',
    ], true);
    const doll = active(RULE, [...PEOPLE, ['Doll', '인형', '人形']]);
    all(['彼女は人形のような白い肌をしていた。'], true, doll);
    all(['미나는 인형의 하얀 피부를 만졌다.'], false, doll);   // 비유가 아닌 「인형의」는 그대로 남의 것
    all(['ミナはレックスの赤い瞳を見た。', 'ミナはレックスの様子が気になって、レックスの赤い瞳を見つめた。'], false);
});
test('v3: near 목록의 호칭 낱말(君)은 남의 표시 「다른 인물+君の」 속에서 그 사람이 아니다 · 표시 첫머리의 그 사람 이름만 그 사람 것', () => {
    const kun = active({ ...RULE, id: 'colour-kun', near: [...NEAR, '君'].join(', ') });
    all(['ミナはレックス君の赤い瞳を見つめた。', 'ミナはレックスくんの赤い瞳を見つめた。', 'レックス君の黒い髪が揺れた。'], false, kun);
    all(['君の赤い瞳が揺れた。', 'ミナは君の白い髪に触れた。', "Mina's red eyes narrowed.", 'ミナさんの黒い髪が揺れた。'], true, kun);
});
test('v3: 창 자리는 예전 split 창과 같다 (띄어쓰기 · 줄바꿈 · 낱말 가운데 · 끝 · 빈 글)', () => {
    const isSpace = ch => /\s/.test(ch);
    // 6.4.0 · v2 의 창 (글자를 하나씩 걷던 판)
    const oldStart = (text, at, n) => { let pos = at, left = n; while (pos > 0 && isSpace(text[pos - 1])) pos--; while (left > 0 && pos > 0) { while (pos > 0 && !isSpace(text[pos - 1])) pos--; left--; if (left > 0) while (pos > 0 && isSpace(text[pos - 1])) pos--; } return pos; };
    const oldEnd = (text, at, n) => { let pos = at, left = n; while (pos < text.length && isSpace(text[pos])) pos++; while (left > 0 && pos < text.length) { while (pos < text.length && !isSpace(text[pos])) pos++; left--; if (left > 0) while (pos < text.length && isSpace(text[pos])) pos++; } return pos; };
    const pieces = ['ミナは', '赤い瞳', ' ', '  ', '\n', 'Mina', "Rex's", '미나는', '붉은', '눈을', '。', 'a', '\t'];
    let seed = 7;
    const rand = n => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) % n; };   // mulberry32
    let checked = 0;
    for (let round = 0; round < 400; round++) {
        const text = Array.from({ length: rand(12) }, () => pieces[rand(pieces.length)]).join('');
        for (let at = 0; at <= text.length; at++) for (const n of [1, 3, 4]) {
            const got = C.wordWindow(text, at, n, n);
            const start = oldStart(text, at, n), end = oldEnd(text, at, n);
            // 같은 낱말들 — 두 자리 사이는 공백뿐 (예전 창은 낱말이 다하면 앞뒤 공백까지 걸었다. 표시는 공백에서 시작하지 않아 판단이 같다)
            const same = (a, b) => /^\s*$/.test(text.slice(Math.min(a, b), Math.max(a, b)));
            assert.ok(same(got.start, start), JSON.stringify({ text, at, n, side: 'start', got: got.start, old: start }));
            assert.ok(same(got.end, end), JSON.stringify({ text, at, n, side: 'end', got: got.end, old: end }));
            checked++;
        }
    }
    assert.ok(checked > 1000);
});
test('v3: 띄어쓰기 없는 긴 일본어 문단 (매치 많음)도 빠르다', () => {
    const unit = 'ミナは窓辺で白い髪を揺らし、彼の胸で赤い瞳を閉じた。レックスのような黒い瞳が光った。';
    const text = unit.repeat(500);   // 약 22,000자 · 띄어쓰기 · 줄바꿈 없음
    const t0 = performance.now();
    const spans = C.findSpans(text, compiled);
    const ms = performance.now() - t0;
    assert.ok(spans.length > 0);
    assert.ok(ms < 2000, `${Math.round(ms)} ms`);
});

// ---------- 6.4.x 소유 판단 v4 · v5: 닿는 거리 상한(속도) · 첫째 판단의 their · 다른 인물 뒤 호칭
test('v5: 첫째 판단은 영어 their · theirs 만 보지 않는다 — 그 사람의 눈 · 속눈썹 (his · its · X\'s · 彼の · 彼らの 는 그대로 남의 것)', () => {
    const lashes = active({ id: 'lashes', name: 'lashes', words: 'black lashes\nred eyes', near: NEAR.join(', ') });
    all(['She closed her eyes, their black lashes trembling.', 'Mina lowered her head, their red eyes half closed.'], true, lashes);
    all(['Mina watched his red eyes.', "Mina met Rex's red eyes.", "Mina's doll, its red eyes glinting, sat on the shelf."], false, lashes);
    all(['ミナが部屋に入ってきたとき、彼の白い髪が揺れた。', 'ミナは彼らの赤い瞳をじっと見つめた。', 'ミナは振り向き、彼らの白い髪が風に揺れるのを見た。'], false);   // 赤い瞳 · 白い髪 규칙
    assert.equal(hit('ミナは彼らを見つめ、赤い瞳を細めた。'), true, '彼らを 는 소유가 아니다');
});
test('v4: near 목록의 호칭 낱말은 다른 인물 이름 바로 뒤(の 없이)에서도 그 사람이 아니다', () => {
    const kun = active({ ...RULE, id: 'colour-kun2', near: [...NEAR, '君', '씨'].join(', ') });
    all(['レックス君が赤い瞳を細めた。', 'レックス君は白い髪をかき上げた。', '렉스 씨가 붉은 눈을 떴다.'], false, kun);
    all(['ミナはレックス君が笑うのを見て、赤い瞳を細めた。', '君が赤い瞳を細めた。', '미나는 렉스 씨가 웃자 붉은 눈을 떴다.'], true, kun);
});
test('v4: near 이름이 맨 앞에 한 번 · 남의 소유가 많은 긴 글도 빠르다 (일본어 줄바꿈 없음 · 한국어 한 문장)', () => {
    const unitJa = 'レックスの赤い瞳が揺れ、レックスの白い髪がなびき、黒い瞳が光った。';
    const ja = 'ミナは窓辺に立った。' + unitJa.repeat(700);   // 약 23,000자 · 남의 の 1,400개 · 매치 2,100개
    let t0 = performance.now();
    const jaSpans = C.findSpans(ja, compiled);
    const jaMs = performance.now() - t0;
    assert.ok(jaSpans.length > 0, '띄어쓰기 없는 덩이라 그 사람 이름이 창 안 — 닿지 않는 곳은 그 사람 것');
    assert.ok(jaMs < 2000, `ja ${Math.round(jaMs)} ms`);
    const ko = '미나는 ' + '렉스의 붉은 눈이 빛나고 렉스의 하얀 머리가 흩날리고 검은 눈동자가 반짝이고 '.repeat(500) + '웃었다.';   // 약 24,000자 한 문장
    t0 = performance.now();
    C.findSpans(ko, compiled);
    const koMs = performance.now() - t0;
    assert.ok(koMs < 2000, `ko ${Math.round(koMs)} ms`);
});

const failed = results.filter(r => !r.pass);
for (const r of failed) console.log('FAIL', r.name, '\n', r.error);
console.log(`rewrite-owner: ${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exitCode = 1;
