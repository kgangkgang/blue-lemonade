// 8.0.6 번역기 프리셋 호환: 데우스 2.5 · 데우스 V3 · 레모나 · 과일 6.4 · 청과 2.0 · 야한 과일 2.0 답 꼴 그대로 만든 고정물을
//   실제 translate() 에 가짜 번역 API 로 돌려 ① 보낸 본문에 뺄 것(숨는 블록 · 생각 · 태그 속성 · 코드칸 · 카드 키 · 숫자 · 단위 · 이모지)이 없는지
//   ② 결과에 뺀 것이 원문 그대로 제자리에 돌아오는지 ③ 상태창 값이 번역돼 제 칸에 들어가는지 ④ 그 프리셋의 표시 정규식이 상태창으로 그리는지 본다.
//   유료 호출 없음. 실행: node tools/tests/translator-preset-compat.mjs .
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTranslator, fakeTranslate, applyDisplayRegexes } from './translator-preset-harness.mjs';
import { FIXTURES, DISPLAY_REGEX, TRACKER, TRACKER_25 } from './translator-preset-fixtures.mjs';
const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const { compactTags } = await import(pathToFileURL(path.join(dir, 'tag-compact.js')));
const { skyTime, skyWeather, skyAttrs } = await import(pathToFileURL(path.join(dir, 'sky-attrs.js')));
const { HIDDEN_BLOCKS, isHiddenBlock } = await import(pathToFileURL(path.join(dir, 'hidden-blocks.js')));
const { prepareDisplayCards, matchesDisplayCardStructure } = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const { ruleValue } = await import(pathToFileURL(path.join(dir, 'card-values.js')));

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };
const t = await loadTranslator(root);
const ko = text => fakeTranslate(text);
const count = (text, part) => String(text).split(part).length - 1;
const sentOf = () => t.events.join('\n');

// 화면에 안 보이거나 번역할 필요 없는 것 — 어느 요청에도 없어야 한다
const NEVER_SENT = ['style=', 'class=', '<tracker', '</tracker', '```', '°C', '℃', '🌙', '🌧', '🕖', '🌅', '☀', '<ECoT', 'ECoT>', '<!--', '<disclaimer', '<scene_plan', 'Phase 1',
    'Context:', 'Knowledge:', 'Prose Length', '<script', '<style', 'DOCTYPE', 'onclick', '日期', '时间', '天气', '地点', '题记', '之间', '[Info|', '[Quote|', '[Outfit|', 'serial:', 'mermaid', 'graph TD'];
// 표본마다 보내야 하는 사람이 읽는 글 · 원문 그대로 돌아와야 하는 숨는 조각 · 화면에 있어야 할 것
const CASES = {
    deus25: { send: ['Old Town', 'Reading Room', 'Rain needled the window.', '「まだ起きてたのか。」'], keep: ['<scene_plan>\nPhase 1 — Inputs: Rex is late. Phase 2 — Plan: keep tension.\n</scene_plan>'],
        tracker: `<tracker> 🌅 아침 | 2030년 4월 2일 화요일 | ${ko('Old Town')} → ${ko('Library')} → ${ko('Reading Room')} | ☀️ 맑음, 19°C </tracker>`,
        shown: ['dem-track__item--time"><span class="dem-track__icon">🌅</span><span class="dem-track__value">아침</span>', `dem-track__item--location"><span class="dem-track__icon">📍</span><span class="dem-track__value">${ko('Old Town')} → ${ko('Library')} → ${ko('Reading Room')}</span>`, 'dem-track__value">맑음</span><span class="dem-track__temp">19°C'] },
    deusV3: { send: ['Seoul', 'Hannam Apartment', 'Bedroom', 'Rain needled the window.'], keep: [],
        tracker: `<tracker> 🌙 오후 11:42 | 2026년 10월 27일 화요일 | ${ko('Seoul')} → ${ko('Hannam Apartment')} → ${ko('Bedroom')} | 🌧️ 약한 비, 12°C </tracker>`,
        shown: ['dem-track__clock">오후 11:42</span>', 'dem-track__date">2026년 10월 27일 화요일</div>', `<span class="dem-track__crumb">${ko('Seoul')}</span><span class="dem-track__sep" aria-hidden="true">›</span><span class="dem-track__crumb">${ko('Hannam Apartment')}</span><span class="dem-track__sep" aria-hidden="true">›</span><span class="dem-track__crumb">${ko('Bedroom')}</span>`, '<span class="dem-track__glyph">🌧️</span>약한 비</span><span class="dem-track__temp">12°C'] },
    lemona: { send: ['Seoul', 'Rain needled the window.'], keep: [],
        tracker: `<tracker> 🕖 오후 7:40 | 2026년 3월 14일 토요일 | ${ko('Seoul')} → ${ko('Hannam Apartment')} → ${ko('Bedroom')} | 🌧️ 약한 비, 12°C </tracker>`,
        shown: ['dem-track__clock">오후 7:40</span>', 'dem-track__date">2026년 3월 14일 토요일</div>'] },
    fruit64: { send: ['Hannam apartment', 'The rain remembers what we choose to forget.', 'Half a step', 'Rain needled the window.'],
        keep: ['<ECoT>\nStep 1: confirm the task. Step 2: plan the scene.\n</ECoT>', '<!-- 自检：节奏正常\n\n输出结果 -->', '<disclaimer>This is fiction.</disclaimer>'],
        shown: ['日期：10월 27일 월요일', '时间：오후 11:42', '天气：약한 비, 12℃', `地点：${ko('Hannam apartment')} · ${ko('bedroom')}`, `题记：${ko('The rain remembers what we choose to forget.')}`] },
    qingguo: { send: ['港城半山别墅-玄关', '雨记得我们选择遗忘的一切。', '雨点敲打着窗户', '雷克斯回家很晚', 'A.米娜合上书'], keep: ['<ECoT>\n确认任务。规划剧情。\n</ECoT>', '<!--果农草稿:关系-->', '```mermaid\ngraph TD\nA[米娜]-->|同居|B[雷克斯]\n```'],
        shown: [`data-date="10월 27일 화요일" data-time="오후 14:30"><p>맑음 산들바람 26℃</p><p>${ko('港城半山别墅-玄关')}</p><p>${ko('雨记得我们选择遗忘的一切。')}</p>`, '<span>🍎No.012</span>'] },
    yahan: { send: ['公寓-卧室', 'Tonight the radio only plays rain.', 'Next song', 'Rex came home late'], keep: ['<style>body{height:auto;background:#123;color:#eee;font-family:serif}', 'onclick="next()"', '<script>const songs=["Quiet Rain","Neon Puddles"];'],
        shown: ['data-date="10월 27일 화요일" data-time="저녁 23:42"><p>약한 비 12℃</p>', `<p style="text-align: center;font-size: 0.65em;font-style: italic">${ko('Tonight the radio only plays rain.')}</p>`] },
};
CASES.deusV3Fenced = { ...CASES.deusV3, keep: ['```\n<tracker>', '</tracker>\n```'] };
CASES.deusV3Fallback = { ...CASES.deusV3, keep: [FIXTURES.deusV3Fallback.slice(0, FIXTURES.deusV3Fallback.indexOf('\n\n<tracker>'))] };

for (const [key, c] of Object.entries(CASES)) {
    const text = FIXTURES[key];
    await test(`${key}: 뺄 것은 안 보내고 보이는 글만 보내요 · 뺀 것은 원문 그대로 제자리 · 상태창 값은 번역돼 제 칸에`, async () => {
        await t.reset();
        const out = await t.translate(text), sent = sentOf();
        for (const bad of NEVER_SENT) assert.ok(!sent.includes(bad), `${key}: 보내면 안 되는 「${bad}」를 보냈어요\n${sent}`);
        for (const good of c.send) assert.ok(sent.includes(good), `${key}: 「${good}」를 보내지 않았어요`);
        for (const piece of c.keep) assert.ok(out.includes(piece), `${key}: 「${piece.slice(0, 40)}」가 원문 그대로 돌아오지 않았어요\n${out}`);
        if (c.tracker) assert.ok(out.includes(c.tracker), `${key}: 상태창\n${out}`);
        assert.ok(!/\[\[__|\sa\d+>|⟦\d/.test(out), `${key}: 자리표시 · 짧은 태그가 남았어요`);
        for (const color of text.match(/style="color:#[0-9a-f]{6}"/g) || []) assert.equal(count(out, color), count(text, color), `${key}: 대사색 ${color}`);
        assert.equal(count(out, '<span'), count(text, '<span'), `${key}: span 수`); assert.equal(count(out, '</span>'), count(text, '</span>'));
        for (const tag of ['<prose>', '</prose>', '<content>', '</content>', '<shout>', '<whispering>', '<true_thoughts character="Rex">', '<status_bar>', '<meow_FM>', '<snow>', '<profile>', '<branches>'])
            assert.equal(count(out, tag), count(text, tag), `${key}: ${tag}`);
        const shown = applyDisplayRegexes(t.display(text, out), DISPLAY_REGEX[key]);
        for (const piece of c.shown || []) assert.ok(shown.includes(piece), `${key}: 화면에 「${piece}」가 없어요\n${shown}`);
        assert.ok(!/Recovered|&lt;|&gt;|\[\[__/.test(shown), `${key}: 화면에 대비 카드 · 글자로 보이는 태그 · 자리표시\n${shown}`);
        // 같은 글을 다시 번역: 데우스 계열은 요청 없이 캐시. 과일 계열은 상태창이 첫 문단과 한 덩이라 그 덩이 하나만 다시 가요 (8.0.4 와 같음 —
        //   처음 번역에서 배운 카드 값을 이번엔 이 기기에서 채워 덩이 글이 달라져요). 다시 갈 때도 카드 값은 보내지 않아요
        const before = t.events.length; assert.equal(await t.translate(text), out);
        const again = t.events.slice(before).join('\n');
        assert.ok(t.events.length - before <= (/^deus|^lemona/.test(key) ? 0 : 1), `${key}: 다시 번역 요청 ${t.events.length - before}개`);
        for (const value of ['Hannam apartment', '港城半山别墅', '公寓-卧室', 'The rain remembers']) assert.ok(!again.includes(value), `${key}: 다시 번역에 카드 값 「${value}」`);
    });
}

await test('다음 답(같은 장소 · 시각만 지남): 시간 상태창은 이 기기에서 다 채워 아무것도 보내지 않고, 바뀐 문단만 보내요', async () => {
    await t.reset();
    await t.translate(FIXTURES.deusV3);
    const mark = t.events.length, next = FIXTURES.deusV3.replace('11:42 PM', '11:58 PM').replace('Rain needled the window.', 'Thunder rolled somewhere far off.');
    const out = await t.translate(next), sent = t.events.slice(mark).join('\n');
    assert.ok(!/Seoul|Hannam|Bedroom|\[\[__VAR/.test(sent), sent);
    assert.ok(sent.includes('Thunder rolled') && !sent.includes('Mina did not look up'), sent);
    assert.ok(out.includes(`<tracker> 🌙 오후 11:58 | 2026년 10월 27일 화요일 | ${ko('Seoul')} → ${ko('Hannam Apartment')} → ${ko('Bedroom')} | 🌧️ 약한 비, 12°C </tracker>`), out);
});

await test('모델이 다 채운 상태창 자리표시를 빠뜨려도 상태창은 제자리에 돌아와요', async () => {
    await t.reset();
    await t.translate(FIXTURES.deusV3);
    const next = FIXTURES.deusV3.replace('11:42 PM', '11:50 PM').replace('Rain needled the window.', 'Wind pressed at the glass.');
    t.setReply(body => fakeTranslate(body).replace(/\[\[__VAR_\d+__\]\]\n?/, ''));
    try {
        const out = await t.translate(next);
        assert.ok(out.startsWith('<tracker> 🌙 오후 11:50 |'), out.slice(0, 200));
        assert.equal(count(out, '<tracker'), 1);
    } finally { t.setReply(); }
});

await test('데우스 2.5 · V3 · 코드칸 · 생각 줄 표본 모두 문단 캐시를 써요 (코드칸 때문에 메시지 통째 한 요청이 되지 않아요)', async () => {
    for (const key of ['deus25', 'deusV3Fenced', 'deusV3Fallback']) {
        await t.reset(); await t.translate(FIXTURES[key]);
        assert.ok(t.events[0].includes('⟦1⟧'), `${key}: 문단 묶음(⟦n⟧)으로 보냈어요`);
    }
});

await test('흘려받는 중간 글 · 미리 보기에도 짧은 태그(a1)가 아니라 원래 태그가 보여요', async () => {
    await t.reset();
    const previews = [], saved = t.env.callLLMAPI;
    t.env.callLLMAPI = async (full, extra = {}) => { const answer = await saved(full, extra); if (typeof extra.onStream === 'function') { const wait = () => new Promise(r => setTimeout(r, 40)); extra.onStream(answer.slice(0, Math.floor(answer.length / 2))); await wait(); extra.onStream(answer); await wait(); } return answer; };
    try {
        const out = await t.translate(FIXTURES.deusV3, { onPreview: html => previews.push(html), onProgress: () => {} });
        assert.ok(t.events.some(body => /<span a\d>/.test(body)), '본문은 짧은 태그로 보냈어요');
        assert.ok(previews.length > 0, '미리 보기가 왔어요');
        for (const html of previews) assert.ok(!/<span a\d>/.test(html), html);
        assert.ok(out.includes('<span style="color:#e06c75">'));
    } finally { t.env.callLLMAPI = saved; }
});

await test('다시 번역(교정) · 보낼 글 번역 · 설정 끔은 태그를 줄이지 않아요 (예전 그대로)', async () => {
    await t.reset();
    await t.translate(FIXTURES.lemona, { isInputTranslation: true, prompt: t.S.llm_prompt_chat });
    assert.ok(sentOf().includes('style="color:#e06c75"'));
    await t.reset(); t.S.compact_tags = false;
    try { await t.translate(FIXTURES.lemona); assert.ok(sentOf().includes('style="color:#e06c75"')); } finally { delete t.S.compact_tags; }
});

await test('태그 속성 줄이기: 같은 속성은 같은 이름 · 번역에 쓰는 속성(character · title …)은 그대로 · 되돌리기', () => {
    const src = '<span style="color:#e06c75">「あ」</span> <font color="#61afef">「い」</font> <span style="color:#e06c75">「う」</span> <true_thoughts character="Rex">x</true_thoughts> <abbr title="Hello">H</abbr> <b>b</b>';
    const c = compactTags(src);
    assert.equal(c.text, '<span a1>「あ」</span> <font a2>「い」</font> <span a1>「う」</span> <true_thoughts character="Rex">x</true_thoughts> <abbr title="Hello">H</abbr> <b>b</b>');
    assert.equal(c.restore(c.text), src);
    assert.equal(c.restore(c.text.replace('「あ」', '「아」')), src.replace('「あ」', '「아」'));
});
await test('태그 속성 줄이기: 모델이 a1 을 빠뜨린 맨 태그는 원문 차례대로 채우고, 원문에 맨 태그가 있으면 손대지 않아요', () => {
    const src = '<span style="color:#111111">「あ」</span> and <span style="color:#222222">「い」</span>';
    const c = compactTags(src);
    assert.equal(c.restore('<span>「아」</span> 그리고 <span a2>「이」</span>'), '<span style="color:#111111">「아」</span> 그리고 <span style="color:#222222">「이」</span>');
    assert.equal(c.restore('<span>「아」</span> 그리고 <span>「이」</span>'), '<span style="color:#111111">「아」</span> 그리고 <span style="color:#222222">「이」</span>');
    const mixed = compactTags('<span>plain</span> <span style="color:#111111">「あ」</span>');
    assert.equal(mixed.restore('<span>평범</span> <span>「아」</span>'), '<span>평범</span> <span>「아」</span>', '어느 것이 빠졌는지 모르면 그대로');
    assert.equal(compactTags('<span a1>이미 있음</span> <span style="color:#111111">x</span>').changed, false);
    assert.equal(compactTags('no tags').changed, false);
});

await test('하늘 장면 속성: 번역한 시각 · 날씨에 영어 꼴을 넣어 V3 하늘이 그대로 나와요', () => {
    assert.equal(skyTime('오후 11:42'), '11:42 PM'); assert.equal(skyTime('오전 7:05'), '7:05 AM'); assert.equal(skyTime('11:42 오후'), '11:42 PM');
    assert.equal(skyTime('밤 9:30'), '9:30 PM'); assert.equal(skyTime('새벽 4:10'), '4:10 AM'); assert.equal(skyTime('늦은 밤'), 'late night'); assert.equal(skyTime('아침'), 'morning');
    assert.equal(skyTime('11:42 PM'), null); assert.equal(skyTime('오후 23:10'), '23:10'); assert.equal(skyTime('알 수 없음'), null);
    assert.equal(skyWeather('약한 비'), 'rain'); assert.equal(skyWeather('맑음 산들바람'), 'breeze clear');
    const html = '<div class="dem-track" data-t="오후 11:42" data-w="🌧️ 약한 비 🌙"><div class="dem-track__grid">x</div></div><div class="other" data-t="오후 1:00"></div>';
    assert.equal(skyAttrs(html), '<div class="dem-track" data-t="11:42 PM" data-w="🌧️ 약한 비 🌙 rain"><div class="dem-track__grid">x</div></div><div class="other" data-t="오후 1:00"></div>');
    const english = '<div class="dem-track" data-t="11:42 PM" data-w="🌧️ Light rain 🌙">';
    assert.equal(skyAttrs(english), english, '영어 그대로면 손대지 않아요');
    // V3 하늘 CSS 가 실제로 고르는 꼴: [data-t^="11:"][data-t*="pm" i] → 밤
    assert.ok(/data-t="11:\d\d PM"/.test(skyAttrs(html)));
});

await test('숨는 블록 규칙: 데우스 생각 줄은 답 맨 앞일 때만 · <think> 가 있으면 아니에요 · 과일 disclaimer · finire', () => {
    const rows = HIDDEN_BLOCKS[0];
    const head = '- Context: a\n- Knowledge: none\n- Story progression: next\n- @Prose Length: 300 words';
    assert.equal(new RegExp(rows.source, rows.flags).exec(`${head}\n\n${TRACKER}\n\n<prose>x</prose>`)?.[0], head);
    assert.equal(new RegExp(rows.source, rows.flags).exec(`${head}\n\n\`\`\`\n${TRACKER}\n\`\`\``)?.[0], head);
    assert.equal(new RegExp(rows.source, rows.flags).exec(`<prose>\n${head}\n</prose>`), null, '본문 안의 Context 줄은 아니에요');
    assert.equal(new RegExp(rows.source, rows.flags).exec(`<think>${head}</think>\n${head}\n<prose>x</prose>`), null, '<think> 답은 원작도 감싸지 않아요');
    assert.equal(new RegExp(rows.source, rows.flags).exec(`- Context: a\n- Knowledge: b\n\n<prose>x</prose>`), null, '계획 줄(Prose Plan · Story progression · Prose Length)이 없으면 아니에요');
    assert.ok(isHiddenBlock('<disclaimer>x</disclaimer>') && isHiddenBlock('<style>.a{}</style>') && isHiddenBlock(head) && !isHiddenBlock('Rain fell.'));
    const finire = HIDDEN_BLOCKS.find(r => r.source.includes('finire'));
    assert.equal('think think [finire]\n<content>x</content>'.replace(finire, ''), '\n<content>x</content>');
});

await test('코드칸에 싼 상태창은 카드 하나 · 코드 예시(칸 없음) · 백틱 넷은 코드 그대로', () => {
    const reserved = [], reserve = v => `[[__VAR_${reserved.push(v) - 1}__]]`;
    const fenced = prepareDisplayCards('```\n' + TRACKER + '\n```\n\nText.', { reserve });
    assert.equal(fenced.count, 1); assert.ok(!fenced.text.includes('```') && !fenced.text.includes('tracker'), fenced.text);
    const translated = '```\n' + TRACKER.replace('Seoul', '서울') + '\n```\n\nText.';
    assert.ok(matchesDisplayCardStructure('```\n' + TRACKER + '\n```\n\nText.', translated));
    const inline = prepareDisplayCards('`' + TRACKER + '`\n\nText.', { reserve });
    assert.equal(inline.count, 1); assert.ok(!inline.text.includes('`'), inline.text);
    for (const code of ['```xml\n<tracker>sample</tracker>\n```', '````\n' + TRACKER + '\n````', '```\n' + TRACKER + '\nmore code\n```'])
        assert.equal(prepareDisplayCards(code, { reserve }).count, 0, code);
});

await test('카드 값 사전: 영어 시각 · 연대 · Time Window 낱말', () => {
    assert.equal(ruleValue('11:42 PM'), '오후 11:42'); assert.equal(ruleValue('07:40 a.m.'), '오전 07:40'); assert.equal(ruleValue('13:40 PM'), null);
    assert.equal(ruleValue('Pre-Dawn'), '이른 새벽'); assert.equal(ruleValue('Late Night'), '늦은 밤');
    assert.equal(ruleValue('April 2, Tuesday, 2030, AD'), '서기 2030년 4월 2일 화요일');
    assert.equal(ruleValue('October 27, Tuesday, 2026'), '2026년 10월 27일 화요일');
});

await test('데우스 2.5 시간 상태창(옛 판 사용자)도 같은 번역 · 같은 화면 꼴', async () => {
    await t.reset();
    const out = await t.translate(`${TRACKER_25}\n\nShe smiled.`);
    assert.ok(out.startsWith(CASES.deus25.tracker), out);
    const shown = applyDisplayRegexes(out, DISPLAY_REGEX.deus25);
    assert.ok(shown.startsWith('<div class="dem-track"><div class="dem-track__item dem-track__item--time">'), shown);
});

console.log(`translator-preset-compat: ${passed} passed`);
