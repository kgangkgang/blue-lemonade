// 선택 시험 (로컬 전용): 원작 프리셋 사본이 있을 때만, 공개 고정물의 대체 표시 정규식이 원작 찾기 식과 같은 자리를 잡는지 견줘요.
//   왜: 과일 · 청과 · 야한 과일의 원작 정규식은 저장소에 담지 않아요(THIRD-PARTY-NOTICES.md). 공개 시험은 Blue Lemonade 가 지어낸
//   같은 꼴의 식(translator-preset-fixtures.mjs)으로 같은 코드 길을 지키고, 원작과 어긋나지 않는지는 사본을 가진 기기에서만 봐요.
//   쓰기: BL_PRESET_ORIGINALS=<원작 프리셋 JSON 이 든 폴더(하위 폴더 포함)> node tools/tests/translator-preset-local.mjs .
//   폴더를 주지 않았거나 없으면 건너뛰어요(공개 CI 에서는 늘 건너뜀).
import fs from 'node:fs';
import path from 'node:path';
import { assert, suite } from './_t.mjs';
import { FIXTURES, DISPLAY_REGEX } from './translator-preset-fixtures.mjs';

const dir = process.env.BL_PRESET_ORIGINALS;
if (!dir || !fs.existsSync(dir)) {
    console.log('SKIP translator-preset-local: 원작 프리셋 사본 폴더가 없어요 (BL_PRESET_ORIGINALS)');
    process.exit(0);
}
const { test, done } = suite('translator-preset-local');

const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(folder, entry.name)) : /\.json$/i.test(entry.name) ? [path.join(folder, entry.name)] : []);
const collect = (value, out = []) => { if (value && typeof value === 'object') { if (typeof value.findRegex === 'string') out.push(value.findRegex); for (const child of Object.values(value)) collect(child, out); } return out; };
const originals = new Set();
for (const file of walk(dir)) { try { for (const find of collect(JSON.parse(fs.readFileSync(file, 'utf8')))) originals.add(find); } catch { /* 프리셋이 아닌 JSON */ } }

/** '/식/깃발' 글 → RegExp (g 를 더해 모든 자리를 봐요) */
function compile(text) {
    const m = /^\/([\s\S]*)\/([a-z]*)$/.exec(text);
    if (!m) return null;
    try { return new RegExp(m[1], m[2].includes('g') ? m[2] : m[2] + 'g'); } catch { return null; }
}
const spans = (re, text) => [...text.matchAll(re)].map(m => `${m.index}+${m[0].length}`);
// 대체 식이 지키는 자리: 표본에서 이 꼬리표를 잡는 원작 식과 견줘요
const KINDS = [
    { name: '상태창 통째', own: 'fruit64', index: 1, needle: /status_bar/, samples: ['fruit64'] },
    { name: '상태창 [Info|…] 꼴', own: 'qingguo', index: 2, needle: /status_bar[\s\S]*Info/, samples: ['qingguo', 'yahan'] },
    { name: '요약 meow_FM', own: 'qingguo', index: 1, needle: /meow_FM/, samples: ['qingguo', 'yahan'] },
    { name: '숨기는 칸', own: 'fruit64', index: 0, needle: /disclaimer/, samples: ['fruit64', 'qingguo', 'yahan'] },
];

await test('원작 프리셋 사본에서 표시 정규식을 읽었어요', () => {
    assert.ok(originals.size > 0, `${dir} 아래 프리셋 JSON 에서 findRegex 를 찾지 못했어요`);
});

for (const kind of KINDS) {
    await test(`${kind.name}: 대체 식이 원작 식과 같은 자리를 잡아요`, () => {
        const mine = compile(DISPLAY_REGEX[kind.own][kind.index].find);
        const candidates = [...originals].filter(find => kind.needle.test(find)).map(compile).filter(Boolean);
        if (!candidates.length) { console.log('  SKIP ' + kind.name + ': 이 종류의 원작 식이 사본에 없어요'); return; }
        for (const sample of kind.samples) {
            const text = FIXTURES[sample], want = spans(mine, text).join(' ');
            // 표본에서 무엇이든 잡는 원작 식 가운데 하나는 대체 식과 같은 자리를 잡아야 해요
            const live = candidates.map(re => spans(re, text).join(' ')).filter(Boolean);
            if (!live.length) { console.log(`  SKIP ${kind.name} · ${sample}: 이 표본을 잡는 원작 식이 사본에 없어요(그 프리셋 사본이 없을 수 있어요)`); continue; }
            assert.ok(live.includes(want), `${sample}: 대체 식 [${want}] ≠ 원작 식 [${[...new Set(live)].join(' / ')}]`);
        }
    });
}

done();
