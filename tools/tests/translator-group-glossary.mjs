// 번역 2.7.4 그룹 채팅 용어집 — 그룹 채팅을 번역할 때 그룹 용어집 · 전체 용어집에 더해 멤버 캐릭터마다 만든 용어집도 쓴다.
//   이기는 차례: 그룹 > 멤버(group.members 차례) > 전체 — 표기가 하나라도 겹치면 먼저 온 쪽(claimed). 같은 목록이 이름 다리(publishGlossaryNames)에도 들어간다.
//   용어집 창(그룹 · 캐릭터 범위)은 「멤버 것 N개도 쓰는 중」 한 줄. 캐릭터 채팅 · 범위 문자열 하나(옛 호출)는 예전과 같다.
//   index.js 의 glossaryScopeKey · glossaryScopeKeys · activeGlossaryEntries · glossaryMemberCount 를 잘라 내 가짜 env 위에서 돌린다 (지어낸 항목만).
//   node tools/tests/translator-group-glossary.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const src = read('src/addons/translator/index.js');
const { glossaryFold, glossaryAlternatives } = await import(pathToFileURL(path.join(root, 'src/addons/translator/glossary-match.js')).href);

function cut(name) {
    const at = src.search(new RegExp(`\\n(?:async )?function ${name}\\(`));
    assert.ok(at >= 0, 'missing ' + name);
    return src.slice(at + 1, src.indexOf('\n}', at + 1) + 2);
}
const env = { getContext: () => CTX.current, extensionSettings: { glossary_entries: [] }, glossaryFold, glossaryAlternatives };
const api = new Function('env', `with (env) {
    ${cut('glossaryScopeKey')}
    ${cut('glossaryEntries')}
    ${cut('glossaryScopeKeys')}
    ${cut('activeGlossaryEntries')}
    ${cut('glossaryMemberCount')}
    return { glossaryScopeKey, glossaryScopeKeys, activeGlossaryEntries, glossaryMemberCount };
}`)(env);

const CHARS = [{ name: '미나', avatar: 'a.png' }, { name: '렉스', avatar: 'b.png' }, { name: '하람', avatar: 'c.png' }];
const GROUP = { groupId: 'g1', groups: [{ id: 'g1', name: '세 사람', members: ['a.png', 'b.png', 'a.png'] }], characters: CHARS, characterId: undefined };
const SOLO = { groupId: null, groups: GROUP.groups, characters: CHARS, characterId: 0 };
const CTX = { current: GROUP };
const E = (scope, src, dst) => ({ id: `${scope}:${src}`, scope, src, dst });
env.extensionSettings.glossary_entries = [
    E('group:g1', 'Rex', '렉스(그룹)'),
    E('a.png', 'Rex', '렉스(A)'), E('a.png', 'Mina', '미나(A)'),
    E('b.png', 'Mina, ミナ', '미나(B)'), E('b.png', 'Tower', '탑(B)'),
    E('global', 'Tower', '탑(전체)'), E('global', 'Guild', '길드(전체)'),
    E('c.png', 'Guild', '길드(C)'),
    { id: 'broken', scope: 'a.png', src: '', dst: '빈 것' },
];
const dsts = list => list.map(entry => entry.dst);

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('그룹 채팅: 범위 차례 = 그룹 → 멤버(group.members 차례 · 겹침 없이) · 전체는 맨 뒤', () => {
    CTX.current = GROUP;
    assert.equal(api.glossaryScopeKey(), 'group:g1');
    assert.deepEqual(api.glossaryScopeKeys(), ['group:g1', 'a.png', 'b.png']);
    assert.deepEqual(dsts(api.activeGlossaryEntries()), ['렉스(그룹)', '미나(A)', '탑(B)', '길드(전체)']);
});

t('표기가 겹치면 먼저 온 범위가 이긴다: 그룹 Rex > 멤버 A Rex · 멤버 A Mina > 멤버 B Mina(ミナ 표기까지 묶음) · 멤버 B Tower > 전체 Tower', () => {
    CTX.current = GROUP;
    const chosen = api.activeGlossaryEntries();
    assert.ok(!chosen.some(entry => entry.dst === '렉스(A)' || entry.dst === '미나(B)' || entry.dst === '탑(전체)'));
    assert.ok(!chosen.some(entry => entry.dst === '길드(C)'), '멤버가 아닌 캐릭터 것은 안 쓴다');
    assert.ok(!chosen.some(entry => entry.dst === '빈 것'), 'src 가 빈 항목은 안 쓴다');
});

t('「멤버 것 N개도 쓰는 중」: 그룹과 겹쳐 밀린 것은 빼고 센다 (미나(A) · 탑(B) = 2)', () => {
    CTX.current = GROUP;
    assert.equal(api.glossaryMemberCount(), 2);
});

t('캐릭터 채팅은 예전과 같다: 그 캐릭터 → 전체, 멤버 수 0', () => {
    CTX.current = SOLO;
    assert.equal(api.glossaryScopeKey(), 'a.png');
    assert.deepEqual(api.glossaryScopeKeys(), ['a.png']);
    assert.deepEqual(dsts(api.activeGlossaryEntries()), ['렉스(A)', '미나(A)', '탑(전체)', '길드(전체)']);
    assert.equal(api.glossaryMemberCount(), 0);
});

t('범위 문자열 하나로 부르는 옛 호출(뽑기 · 중복 검사)은 그 범위 + 전체', () => {
    CTX.current = SOLO;
    assert.deepEqual(dsts(api.activeGlossaryEntries('c.png')), ['길드(C)', '탑(전체)']);
    assert.deepEqual(dsts(api.activeGlossaryEntries('global')), ['탑(전체)', '길드(전체)'], 'global 문자열은 전체만');
});

t('채팅이 안 열려 있으면 전체만 · 그룹 기록이 없으면(members 모름) 그룹 것만', () => {
    CTX.current = { groupId: null, characters: CHARS, characterId: undefined, groups: [] };
    assert.deepEqual(api.glossaryScopeKeys(), []);
    assert.deepEqual(dsts(api.activeGlossaryEntries()), ['탑(전체)', '길드(전체)']);
    CTX.current = { groupId: 'g1', groups: [], characters: CHARS };
    assert.deepEqual(api.glossaryScopeKeys(), ['group:g1']);
    assert.deepEqual(dsts(api.activeGlossaryEntries()), ['렉스(그룹)', '탑(전체)', '길드(전체)']);
    assert.equal(api.glossaryMemberCount(), 0);
});

t('배선: 용어집 창 한 줄(그룹 · 캐릭터 범위에서만) · 이름 다리 · 문단 캐시 서명(용어집 항목 전체 — 멤버 것이 바뀌면 그룹 캐시도 새로) · 판 · CI', () => {
    assert.match(src, /const memberCount = glossaryScopeView === 'char' && key \? glossaryMemberCount\(\) : 0;\s*if \(memberCount\) list\.insertAdjacentHTML\('beforeend', `<small class="llmt-desc llmt-gl-members">멤버 것 \$\{memberCount\}개도 쓰는 중<\/small>`\);/);
    assert.match(src, /function publishGlossaryNames\(\) \{\s*publishNames\(extensionSettings\.glossary_enabled === false \? \[\] : activeGlossaryEntries\(\)\);\s*\}/);
    assert.match(src, /\[chatCtx\?\.groupId \?\? null, chatCtx\?\.characters\?\.\[chatCtx\?\.characterId\]\?\.avatar \?\? null, glossarySignature\(extensionSettings\.glossary_entries\)\]/);   // 2.7.5 서명 재료는 updated 를 뺀 항목 (glossary-sync.js — 옛 서명과 같은 JSON)
    assert.match(src, /const \{ lines, hasChoice \} = glossaryLines\(activeGlossaryEntries\(\), text, \{ reverse, maxLines: GLOSSARY_MAX_LINES \}\);/, '프롬프트 블록도 같은 목록');
    assert.match(read('src/addons/translator/manifest.json'), /"version": "2\.(?:7\.(?:[4-9]|\d{2})|(?:[89]|\d{2})\.\d+)"/, '2.7.4 이상');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/translator-group-glossary\.mjs \./);
});

console.log(`translator-group-glossary: ${n} passed, 0 failed`);
