// 1.5.8 로그 복사 「인물표 색」 — 다른 틀(컨셉)에서도 대사마다 말한 인물의 색(인물표: 이 채팅 TTS 대사 색 → 카드별 색 기억 → 프리셋 색)이 자동으로 입혀져요.
//   사용자 제보(11-16 · 실제 폰 1.5.7 · 묘비 틀): 「다른 컨셉으로 가면 색깔 다 빠짐 · 인물표 색도 TTS 나 프리셋 불러오게끔 해 줘 자동으로」
//   잠그는 것: ① 대사 조각의 인물 찾기 차례(1.6.8 화면 색이 같은 인물 → TTS 가 적어 둔 화자 → 「이름:」 머리 → 못 찾으면 화면 색)
//   ② 한 메시지(카드 하나가 여러 인물을 말하는 글) 안 대사마다 다른 글자 · 그 인물 색 ③ 낮 · 밤 둘 다 ④ 인물표가 비면 예전과 같은 그림. 이름 · 글은 가짜예요.
//   node tools/tests/log-copy-cast-people.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('log-copy-cast-people');
const { renderLog } = await load('src/log-copy-presets.js');
const { loadPicks } = await load('src/log-copy-picks.js');
const { toneLookup, retintModel, whoFinder, saidKey } = await load('src/log-copy-tone.js');
const { tone } = await load('src/shared/char-tone.js');
const { parseColor } = await load('src/shared/ink-paint.js');

const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': "'Salty Text', serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '-0.3px', 'line-height': '24px', 'word-break': 'normal' };
const ROSE = '#d98aa5', SKY = '#7fb2e5', MINT = '#5fc2a0', PLUM = '#9b6bd1';
const rgb = hex => { const c = parseColor(hex); return `rgb(${c.r}, ${c.g}, ${c.b})`; };
// 화면에서 떠 온 꼴(log-copy-capture): 바깥 조각 = 프리셋이 준 색 글자 · 안쪽 조각 = 테마 대사 띠(.35)
const say = (hex, text) => { const c = parseColor(hex); return { t: 'el', block: false, tag: 'span', style: { color: rgb(hex) }, children: [{ t: 'el', block: false, tag: 'q', style: { color: 'rgb(245, 245, 247)', 'background-image': `linear-gradient(transparent 5%, rgba(${c.r}, ${c.g}, ${c.b}, 0.35) 5%, rgba(${c.r}, ${c.g}, ${c.b}, 0.35) 100%, transparent 100%)` }, children: [{ t: 'text', text }] }] }; };
const plainSay = text => ({ t: 'el', block: false, tag: 'q', style: { color: 'rgb(245, 245, 247)', 'background-image': 'linear-gradient(transparent 5%, rgba(128, 128, 128, 0.3) 5%, rgba(128, 128, 128, 0.3) 100%, transparent 100%)' }, children: [{ t: 'text', text }] });
const para = (...children) => ({ t: 'el', block: true, tag: 'p', style: { ...SCREEN, 'text-indent': '15px' }, children });
const words = text => ({ t: 'text', text });
const msg = (name, nodes, more = {}) => ({ index: 0, user: false, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: null, font: { ...SCREEN }, bubble: null, nodes, ...more });
const model = messages => ({ messages, base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '' });

// 인물표: 미라(장미) · 도윤(하늘) — 화면 색과 같은 색 · 미카(민트)는 화면에 색이 없고 TTS 분석 · 「이름:」 머리로만 알 수 있어요
const BOOK = new Map([['미라', ROSE], ['도윤', SKY], ['미카', MINT]]);
const get = name => (BOOK.has(name) ? { name, color: BOOK.get(name) } : null);
const list = () => [...BOOK].map(([name, color]) => ({ name, color }));
// 카드 「이야기꾼」 하나가 세 사람을 말하는 메시지
const scene = msg('이야기꾼', [
    para(say(ROSE, '「이 화분 말인데, 잎이 좀 기운이 없더구나.」')),
    para(words('도윤가 페이지를 넘기다 말고 멈춘다.')),
    para(say(SKY, '「……미라 님. 그 용기로 물을 주시면 안 됩니다」')),
    para(plainSay('「저도 그렇게 생각해요.」')),
    para(words('미카: '), plainSay('「물뿌리개는 제가 가져올게요.」')),
], { said: [[saidKey('「저도 그렇게 생각해요.」'), '미카']] });

const whoList = (m) => { const out = []; const walk = nodes => { for (const n of nodes ?? []) if (n.t === 'el') { if (n.who) out.push(n.who); else walk(n.children); } }; walk(m.nodes); return out; };

await test('whoFinder: 화면 색이 같은 인물 → TTS 가 적어 둔 화자 → 「이름:」 머리 → 모르면 null', () => {
    const who = whoFinder({ get, list });
    assert.equal(who('「저도 그렇게 생각해요.」', null, scene), MINT, 'TTS 분석의 화자(따옴표 · 빈칸은 같은 열쇠)');
    assert.equal(who('저도   그렇게 생각해요.', ROSE, scene), ROSE, '1.6.8 화면 색이 인물표의 한 사람이면 그 사람(TTS 가 다른 화자를 적어 뒀어도)');
    assert.equal(who('저도   그렇게 생각해요.', PLUM, scene), MINT, '화면 색이 인물표에 없으면 TTS 가 적어 둔 화자');
    assert.equal(who('「다른 대사」', '#d88ba6', scene), ROSE, '화면 색과 거의 같은 색의 인물');
    assert.equal(who('「다른 대사」', PLUM, scene), null, '인물표에 없는 색은 모름(화면 색 그대로 쓰게)');
    assert.equal(who('「다른 대사」', null, scene, '미카: '), MINT, '「이름:」 머리');
    assert.equal(who('「다른 대사」', null, scene, '그때 [도윤] : '), SKY);
    assert.equal(who('「다른 대사」', null, scene, '누군가가 말했다. '), null, '이름 머리가 아니면 모름');
    assert.equal(who('「다른 대사」', null, scene, '아무개: '), null, '인물표에 없는 이름');
    assert.equal(whoFinder({})('글', ROSE, scene), null, '인물표가 없으면 늘 모름');
    assert.equal(whoFinder({ get: () => { throw new Error('x'); }, list: () => { throw new Error('y'); } })('글', ROSE, scene), null, '인물표가 던져도 안 죽어요');
});

await test('toneLookup: people.list 를 주면 lookup.who 가 달려요 · 안 주면 예전 꼴', () => {
    assert.equal(typeof toneLookup([scene], [scene], get, list).who, 'function');
    assert.equal(toneLookup([scene], [scene], get).who, undefined);
    assert.equal(toneLookup([scene], [scene], get, list)('미라'), ROSE, '이름 → 색은 그대로');
});

await test('다시 칠하기: 한 메시지 안 대사마다 그 인물 색(낮 · 밤) · 인물표가 비면 예전과 같은 결과', () => {
    for (const mode of ['light', 'dark']) {
        const t = tone(ROSE, { mode, plan: 'B' });
        const lookup = toneLookup([scene], [scene], get, list);
        assert.deepEqual(whoList(retintModel(model([scene]), t, { font: false, whoOf: lookup.who }).messages[0]), [ROSE, SKY, MINT, MINT], mode);
        const empty = toneLookup([scene], [scene], () => null, () => []);
        assert.deepEqual(retintModel(model([scene]), t, { font: false, whoOf: empty.who }), retintModel(model([scene]), t, { font: false }), `${mode} 인물표가 비면 그대로`);
    }
});

const picks = await loadPicks();
const dlg = html => [...html.matchAll(/class="gk-d (gk-d[A-Z])"/g)].map(m => m[1]);
const ruleOf = (html, letter, mode) => (html.match(new RegExp(`\\.gk-t${mode === 'light' ? 'l' : 'd'} \\.gk-d${letter}\\{background-color:(rgba\\([^)]*\\))`)) || [])[1];
const hue = v => { const c = parseColor(v); const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b); if (max - min < 12) return null; const d = max - min; const h = max === c.r ? ((c.g - c.b) / d) % 6 : max === c.g ? (c.b - c.r) / d + 2 : (c.r - c.g) / d + 4; return Math.round(((h * 60) + 360) % 360); };
const near = (a, b, gap = 28) => a != null && b != null && Math.min(Math.abs(a - b), 360 - Math.abs(a - b)) <= gap;

await test('받은 심플 글꾸(묘비 · 모래시계) 낮 · 밤: 「인물표 색」이면 대사마다 인물 글자 · 그 인물 색상의 띠', () => {
    for (const id of ['simple-k1180', 'simple-k10']) {
        const p = picks.find(x => x.id === id);
        assert.ok(p, id);
        for (const mode of ['light', 'dark']) {
            const html = renderLog(model([scene]), { simple: p, mode, lookup: toneLookup([scene], [scene], get, list) });
            const letters = dlg(html);
            assert.equal(letters.length, 4, `${id} ${mode} 대사 넷`);
            assert.equal(new Set(letters).size, 3, `${id} ${mode} 인물 셋 = 글자 셋 (${letters})`);
            assert.equal(letters[2], letters[3], `${id} ${mode} 미카 두 대사는 같은 글자`);
            // 인물표가 없을 때: 색 없는 두 대사는 주인공 글자로 떨어져요(예전 그림) — 인물표가 있으면 따로
            assert.equal(new Set(dlg(renderLog(model([scene]), { simple: p, mode }))).size, 2, `${id} ${mode} 인물표 없이`);
            // 띠 색상: 규칙이 있는 틀만(틀마다 대사 꾸밈이 달라요) 그 인물 색상과 가까운지
            const want = [ROSE, SKY, MINT, MINT];
            letters.forEach((cls, i) => { const rule = ruleOf(html, cls.slice(-1), mode); if (rule && hue(rule) != null) assert.ok(near(hue(rule), hue(want[i])), `${id} ${mode} ${cls} 띠 ${rule} ≈ ${want[i]}`); });
        }
    }
});

await test('깡통 로그 · 기본 글꾸 새 틀: 인물표 색이 대사 띠에 가요(낮 · 밤) · 고른 화자 색(깡통 · 깡캐 · 원래 색)은 그 뒤에 얹혀 그대로', () => {
    for (const mode of ['light', 'dark']) {
        const lookup = toneLookup([scene], [scene], get, list);
        const log = renderLog(model([scene]), { shape: 'kkangtong', mode, lookup });
        const bands = [...log.matchAll(/linear-gradient\(transparent 5%, (rgba?\([^)]*\))/g)].map(m => hue(m[1]));
        assert.equal(bands.length, 4, `깡통 로그 ${mode} 띠 넷`);
        assert.ok(near(bands[0], hue(ROSE)) && near(bands[1], hue(SKY)) && near(bands[2], hue(MINT)) && near(bands[3], hue(MINT)), `깡통 로그 ${mode} 띠 색상 ${bands}`);
        for (const shape of ['card', 'note', 'letter']) { const html = renderLog(model([scene]), { shape, mode, lookup }); const got = [...html.matchAll(/class="d (d[A-Z])"/g)].map(m => m[1]); assert.equal(got.length, 4, `기본 글꾸 ${shape} ${mode} 대사 넷`); assert.equal(new Set(got).size, 3, `기본 글꾸 ${shape} ${mode} 인물 셋 (${got})`); }
    }
    const p = picks.find(x => x.id === 'simple-k1180');
    const base = renderLog(model([scene]), { simple: p, mode: 'dark', lookup: toneLookup([scene], [scene], get, list) });
    const picked = renderLog(model([scene]), { simple: { ...p, set: { ...(p.set || {}), themeCast: { main: PLUM } } }, mode: 'dark', lookup: toneLookup([scene], [scene], get, list) });
    assert.deepEqual(dlg(picked), dlg(base), '고른 색은 글자 배정을 안 바꿔요');
});

// 1.5.9 「원래 색」 = 채팅에서 보이던 색(전엔 「틀을 만든 색」) — 인물표가 다른 색을 정해 둬도 화면에서 읽은 대사 색으로 그려요
await test('「원래 색」 칩: 인물표를 안 묻고 채팅에서 보이던 색 — 주인공 · 대사 조각 · 셋째 화자까지 · 화면에 색이 없으면 틀을 만든 색(예전 길)', async () => {
    const { drawSimple, castLetters, castWho, screenColors, castIsScreen, speakerLetters } = await load('src/log-copy-simple.js');
    const p = picks.find(x => x.id === 'simple-k1180');
    // 인물표는 화면과 다른 색(미라 = 자두 · 도윤 = 민트)을 정해 뒀어요
    const OTHER = new Map([['미라', PLUM], ['도윤', MINT]]);
    const get2 = name => (OTHER.has(name) ? { name, color: OTHER.get(name) } : null), list2 = () => [...OTHER].map(([name, color]) => ({ name, color }));
    const talk = [msg('미라', [para(say(ROSE, '「잎이 좀 기운이 없더구나. 물을 줘야겠어.」'))]), msg('도윤', [para(say(SKY, '「그 용기로는 안 됩니다」'))], { index: 1 })];
    const ORIG = { main: 'orig', other: 'orig' };
    assert.equal(castIsScreen(ORIG), true); assert.equal(castIsScreen({ main: 'orig' }), false); assert.equal(castIsScreen(null), false);
    for (const mode of ['light', 'dark']) {
        const lookup = toneLookup(talk, talk, get2, list2);
        const book = drawSimple(p.frame, model(talk), { mode, lookup, marks: false });
        const orig = drawSimple(p.frame, model(talk), { mode, lookup, cast: ORIG, marks: false });
        const bare = drawSimple(p.frame, model(talk), { mode, marks: false });
        assert.equal(book.main, PLUM, `${mode} 인물표 색`);
        assert.equal(orig.main, ROSE, `${mode} 원래 색 = 화면 색`);
        assert.equal(orig.colors.get(p.frame.second ?? 'B'), SKY, `${mode} 상대도 화면 색`);
        assert.equal(orig.html, bare.html, `${mode} 인물표가 없을 때의 그림과 같아요`);
        assert.notEqual(orig.html, book.html, mode);
        // renderLog 길(조절 값에 실린 themeCast)도 같아요
        const viaSet = renderLog(model(talk), { simple: { ...p, set: { ...(p.set || {}), themeCast: ORIG } }, mode, lookup });
        assert.equal(viaSet, renderLog(model(talk), { simple: p, mode }), `${mode} renderLog`);
        // 한 메시지 안 대사 조각 · 화면에 색 없는 대사: 인물표(TTS 화자)를 안 물어서 글자 둘(인물표 색이면 셋)
        const sceneOrig = renderLog(model([scene]), { simple: { ...p, set: { ...(p.set || {}), themeCast: ORIG } }, mode, lookup: toneLookup([scene], [scene], get, list) });
        assert.equal(new Set(dlg(sceneOrig)).size, 2, `${mode} 대사 조각도 화면 색`);
    }
    // 「캐릭터 색을 아는지」 판정도 같은 셈: 화면에 색이 있으면 앎 · 없으면 모름(틀을 만든 색)
    assert.equal(castWho(model(talk), p.frame, toneLookup(talk, talk, get2, list2), ORIG).main, ROSE);
    const mute = [msg('미라', [para(words('색 없는 글'))])];
    assert.equal(castWho(model(mute), p.frame, toneLookup(mute, mute, get2, list2), ORIG).main, null, '화면에 색이 없으면 틀을 만든 색');
    assert.equal(castWho(model(mute), p.frame, toneLookup(mute, mute, get2, list2), null).main, PLUM, '안 고르면 인물표 색');
    // 한쪽만 원래 색: 그 글자만 화면 색 · 다른 쪽은 인물표 색 그대로
    const named = speakerLetters(model(talk), { main: p.frame.main, second: p.frame.second, lookup: toneLookup(talk, talk, get2, list2) });
    const half = castLetters(named, p.frame, { main: 'orig' }, screenColors(model(talk), named));
    assert.equal(half.main, ROSE); assert.equal(half.colors.get(named.letterOf.get('도윤')), MINT);
    assert.equal(castLetters(named, p.frame, { main: 'orig' }).main, null, 'screen 을 안 주면 예전처럼 색 모름');
    // 칩 설명
    const fs = await import('node:fs'); const path = await import('node:path');
    assert.match(fs.readFileSync(path.join(path.resolve(process.argv[2] || '.'), 'src/log-copy-tune-ui.js'), 'utf8'), /'원래 색', orig, \{ tip: '채팅에서 보이던 색' \}/);
});

// 1.6.8 사용자(11-17 · 형광펜 틀 · 인물표 색): 「아니 도대체 왜 글자색이 바뀌는거임」 — 채팅에서 분홍 띠던 사람 대사가 로그 복사에서 상대(청록) 색으로.
//   원인: 그 사람 색이 틀을 만든 둘째 화자 색과 똑같았어요(#ff5fa2). 띠 그림 색 바꾸기(toneSimple swapRgb)가 글자마다 차례로 바꿔서
//   주인공 띠가 「틀 색 → 분홍」 으로 바뀐 뒤 둘째 글자 차례에 「분홍 → 청록」 으로 한 번 더 바뀌었어요. 이제 한 번에(한 자리는 한 번만) 바꿔요.
const FRAME_PINK = '#ff5fa2', TEAL = '#3ccfbf', LIME = '#7fe03c';
const duo = (a, b) => msg('모임', [
    para(say(a, '「룰루♪ 수달짱~, 아까 그 영상 나한테도 보내 줘~♡」')),
    para(say(b, '「아니, 보낼 리가 없잖아요 나비 씨!!」')),
    para(words('나비가 수달 뒤를 졸졸 따라온다.')),
]);
const bookOf = pairs => { const m = new Map(pairs); return [n => (m.has(n) ? { name: n, color: m.get(n) } : null), () => [...m].map(([name, color]) => ({ name, color }))]; };
const rgbIn = (html, letter) => (html.match(new RegExp(`\\.gk-d${letter}\\{background-image:url\\('data:image/svg\\+xml,[^']*?rgb%28(\\d+,\\d+,\\d+)%29`)) || [])[1];
const triple = hex => { const c = parseColor(hex); return `${c.r},${c.g},${c.b}`; };

await test('형광펜 틀: 그 사람 색이 틀의 둘째 화자 색과 같아도 대사마다 채팅 화면 색 그대로(낮 · 밤 · 인물표 색 · 원래 색)', () => {
    const p = picks.find(x => x.id === 'simple-k13');
    assert.ok(p, 'simple-k13');
    const scene2 = duo(FRAME_PINK, TEAL);
    const [get2, list2] = bookOf([['나비', FRAME_PINK], ['수달', TEAL]]);
    for (const mode of ['light', 'dark']) {
        for (const [label, simple] of [['인물표 색', p], ['원래 색', { ...p, set: { ...(p.set || {}), themeCast: { main: 'orig', other: 'orig' } } }]]) {
            const html = renderLog(model([scene2]), { simple, mode, lookup: toneLookup([scene2], [scene2], get2, list2) });
            const letters = dlg(html);
            assert.equal(letters.length, 2, `${mode} ${label} 대사 둘`);
            assert.notEqual(letters[0], letters[1], `${mode} ${label} 두 사람 = 글자 둘`);
            assert.equal(rgbIn(html, letters[0].slice(-1)), triple(FRAME_PINK), `${mode} ${label} 첫 대사(분홍 사람) 띠`);
            assert.equal(rgbIn(html, letters[1].slice(-1)), triple(TEAL), `${mode} ${label} 둘째 대사(청록 사람) 띠`);
        }
    }
});

await test('받은 심플 글꾸 전부: 새 화자 색이 다른 글자의 틀 색과 같아도 한 번만 바뀌어요(이어 바뀜 없음)', async () => {
    const { simpleFrameInfo, speakerColorsOf } = await load('src/log-copy-simple-tone.js');
    const count = (html, hex) => html.split(triple(hex)).length - 1;
    let checked = 0;
    const bad = [];
    for (const p of picks.filter(x => x.frame)) {
        const f = p.frame, second = f.second ?? (f.main === 'A' ? 'B' : 'A');
        const c0 = f.colors0 ?? speakerColorsOf(simpleFrameInfo(f.html)?.color_css ?? '');
        if (!c0[f.main] || !c0[second]) continue;
        for (const mode of ['light', 'dark']) {
            // ① 주인공 새 색 = 상대의 틀 색 · ② 상대 새 색 = 주인공의 틀 색 — 견줌: 같은 자리에 겹치지 않는 색(라임)
            for (const [mainNew, otherNew, victim] of [[c0[second], TEAL, TEAL], [LIME, c0[f.main], LIME]]) {
                const ref = mainNew === LIME ? [TEAL, otherNew] : [LIME, otherNew];
                const draw = (a, b) => { const s = duo(a, b); const [g, l] = bookOf([['나비', a], ['수달', b]]); return renderLog(model([s]), { simple: p, mode, lookup: toneLookup([s], [s], g, l) }); };
                const got = count(draw(mainNew, otherNew), victim), want = count(draw(...(victim === TEAL ? [ref[0], otherNew] : [mainNew, ref[0]])), victim);
                if (got !== want) bad.push(`${p.id} ${mode} ${victim === TEAL ? '주인공 = 상대 틀 색' : '상대 = 주인공 틀 색'} (${victim} ${got} ≠ ${want})`);
                checked++;
            }
        }
    }
    assert.ok(checked >= 20, `본 틀 ${checked}`);
    assert.deepEqual(bad, [], `이어 바뀐 틀 ${bad.length}`);
});

await test('떠 오기: TTS 대사 분석이 적어 둔 화자를 메시지에 실어요(읽기만) · CI 등록', async () => {
    const fs = await import('node:fs'); const path = await import('node:path');
    const root = path.resolve(process.argv[2] || '.');
    const cap = fs.readFileSync(path.join(root, 'src/log-copy-capture.js'), 'utf8');
    assert.match(cap, /data\?\.extra\?\.lemon_voice\?\.analysis\?\.segs/);
    assert.match(cap, /\.\.\.\(said\.length \? \{ said \} : \{\}\),/);
    const tts = fs.readFileSync(path.join(root, 'src/addons/tts/src/analysis.js'), 'utf8');
    assert.match(tts, /let h = 2166136261;\s*for \(let i = 0; i < s\.length; i\+\+\) \{ h \^= s\.charCodeAt\(i\); h = Math\.imul\(h, 16777619\); \}\s*return \(h >>> 0\)\.toString\(36\);/, 'TTS 줄 열쇠 셈이 바뀌면 saidKey 도 같이');
    assert.match(tts, /replace\(\/\[“”"「」『』«»‘’＂\]\/g, ''\)\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)\.toLowerCase\(\)/, 'TTS 대사 정규화가 바뀌면 saidKey 도 같이');
    assert.match(fs.readFileSync(path.join(root, 'src/log-copy-sheet.js'), 'utf8'), /name => people\.get\(name\), \(\) => people\.list\(\)\)/);
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/log-copy-cast-people\.mjs \./);
});

done();
