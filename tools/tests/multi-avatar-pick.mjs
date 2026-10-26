// 7.9.9 프로필 여러 개 — 고르기 규칙 · 세션 · 고정 · 정리 (순수 모듈 src/multi-avatar/pick.js · store.js 의 정리 계획)
//   node tools/tests/multi-avatar-pick.mjs <테마 루트>   (공개 저장소는 '.')
// 확인하는 것:
//   1) 끔 → 원본 · 랜덤 후보(원본 섞기 켬/끔) · 직전 그림 피하기 · 후보 1장
//   2) 세션: 같은 채팅 안에서는 같은 그림, CHAT_CHANGED 마다 바뀜(chat) · 목록 창이 「열릴 때」만(list) · 하루에 한 번(daily) 결정성
//   3) 그룹: 멤버마다 따로 고르고 등록 없는 멤버는 원본
//   4) 고정: 고정이 랜덤보다 우선 · 원본 고정 · 해제하면 랜덤 복귀 · 고정 파일이 지워지면 원본 · when=off 라도 고정은 적용
//   5) 정리(tidy): 깨진 값 · 상한 24 · 중복 · 고정값 검증 · 빈 항목 제거 · 설정 기본값과 보존
//   6) 폴더 해시 · src 에서 아바타 읽기 · 정리 계획(가짜 서버)
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.'), url = pathToFileURL(root + '/');
const P = await import(new URL('src/multi-avatar/pick.js', url));
const { choose, Session, tidyMultiAvatar, folderOf, isFolder, avatarFromSrc, poolOf, CARD, MAX_FILES, urlOf } = P;
globalThis.document = globalThis.document || { createElement: () => ({ toDataURL: () => '' }) };
const S = await import(new URL('src/multi-avatar/store.js', url));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); } catch (error) { fail++; console.log(`  FAIL ${name}\n       ${String(error.stack || error).split('\n').slice(0, 6).join('\n       ')}`); }
}
const F = ['user/images/bl-avatar-0123456789abcdef/a.webp', 'user/images/bl-avatar-0123456789abcdef/b.webp', 'user/images/bl-avatar-0123456789abcdef/c.webp'];
const rec = (files = F, pinned = '') => ({ files: [...files], pinned });
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };
const settings = (over = {}) => ({ on: true, when: 'chat', includeCard: true, chars: { 'Arin.png': rec(), 'Rin.png': rec([F[0]]) }, ...over });

await test('끔 → 원본 · 등록 없음 → 원본', () => {
    assert.equal(choose(rec(), { on: false }), CARD);
    assert.equal(choose(null, {}), CARD);
    assert.equal(choose({ files: [] }, {}), CARD);
});
await test('랜덤 후보: 원본 섞기 켬이면 카드 + 파일, 끄면 파일만 · 직전 그림은 피함', () => {
    assert.deepEqual(poolOf(rec(), true), [CARD, ...F]);
    assert.deepEqual(poolOf(rec(), false), F);
    assert.equal(choose(rec(), { random: () => 0 }), CARD, 'random 0 → 첫 후보(카드)');
    assert.equal(choose(rec(), { random: () => 0, includeCard: false }), F[0]);
    assert.equal(choose(rec(), { random: () => 0.999 }), F[2]);
    for (let i = 0; i < 40; i++) assert.notEqual(choose(rec(), { prev: F[1], random: Math.random }), F[1], '직전 그림 피함');
    assert.equal(choose(rec([F[0]]), { prev: F[0], includeCard: false }), F[0], '후보가 1장이면 그대로');
});
await test('세션(chat): 같은 채팅 안에서는 같은 그림, CHAT_CHANGED 마다 바뀜', () => {
    const s = settings(), session = new Session({ random: seq(0.3, 0.6, 0.9, 0.1) });
    const first = session.get(s, 'Arin.png');
    for (let i = 0; i < 5; i++) assert.equal(session.get(s, 'Arin.png'), first, '메시지마다 불러도 같은 그림');
    const [[, second]] = session.chatChanged(s, ['Arin.png']);
    assert.notEqual(second, first, '채팅을 바꾸면 다른 그림');
    assert.equal(session.get(s, 'Arin.png'), second);
    assert.deepEqual(session.chatChanged({ ...s, when: 'list' }, ['Arin.png']), [], 'list 모드는 CHAT_CHANGED 에서 안 바꿈');
});
await test('세션(list): 목록 창이 숨었다가 보일 때만 다시 고름 · 검색으로 다시 그려지는 동안은 유지', () => {
    const s = settings({ when: 'list' }), session = new Session({ random: seq(0.1, 0.5, 0.9) });
    assert.deepEqual(session.listLoaded(s, ['Arin.png'], false), [], '숨어 있을 때 그려짐(부팅) → 안 고름');
    const opened = session.listLoaded(s, ['Arin.png'], true);
    assert.equal(opened.length, 1, '열림 → 고름');
    const pick = session.get(s, 'Arin.png');
    assert.deepEqual(session.listLoaded(s, ['Arin.png'], true), [], '보이는 중 다시 그려짐(검색) → 안 바꿈');
    assert.equal(session.get(s, 'Arin.png'), pick);
    session.listLoaded(s, ['Arin.png'], false);
    const [[, next]] = session.listLoaded(s, ['Arin.png'], true);
    assert.notEqual(next, pick, '닫고 다시 열면 바뀜');
    assert.deepEqual(session.chatChanged(s, ['Arin.png']), [], 'list 모드: 채팅 바꿔도 세션 그대로');
    assert.equal(session.get(s, 'Arin.png'), next);
});
await test('하루에 한 번(daily): 같은 날 같은 그림, 날이 바뀌면 바뀔 수 있고 랜덤과 무관', () => {
    const a = choose(rec(), { when: 'daily', avatar: 'Arin.png', today: '2026-10-26', random: () => 0 });
    const b = choose(rec(), { when: 'daily', avatar: 'Arin.png', today: '2026-10-26', random: () => 0.99 });
    assert.equal(a, b);
    const days = new Set(Array.from({ length: 30 }, (_, i) => choose(rec(), { when: 'daily', avatar: 'Arin.png', today: `2026-11-${String(i + 1).padStart(2, '0')}` })));
    assert.ok(days.size > 1, '한 달이면 다른 그림도 나옴');
    const session = new Session({ today: () => '2026-10-26' });
    session.set('Arin.png', F[2]);
    assert.equal(session.get(settings({ when: 'daily' }), 'Arin.png'), a, 'daily 는 세션 기억보다 날짜 규칙');
});
await test('그룹: 멤버마다 따로 · 등록 없는 멤버는 원본', () => {
    const s = settings(), session = new Session({ random: seq(0.5, 0.5) });
    const picks = Object.fromEntries(session.chatChanged(s, ['Arin.png', 'Rin.png', 'Nobody.png']));
    assert.ok([CARD, ...F].includes(picks['Arin.png']));
    assert.ok([CARD, F[0]].includes(picks['Rin.png']));
    assert.equal(picks['Nobody.png'], CARD);
    assert.equal(session.get(s, 'Nobody.png'), CARD);
});
await test('고정: 랜덤보다 우선 · 원본 고정 · when=off 라도 고정은 적용 · 세션 기억보다 우선', () => {
    assert.equal(choose(rec(F, F[1]), { random: () => 0.99 }), F[1]);
    assert.equal(choose(rec(F, CARD), { random: () => 0.99 }), CARD);
    assert.equal(choose(rec(F, F[1]), { when: 'off' }), F[1], 'off 는 랜덤만 멈춤');
    assert.equal(choose(rec(F, ''), { when: 'off', random: () => 0.99 }), CARD, 'off + 고정 없음 → 원본');
    const s = settings({ chars: { 'Arin.png': rec(F, F[2]) } }), session = new Session({ random: () => 0 });
    session.set('Arin.png', F[0]);
    assert.equal(session.get(s, 'Arin.png'), F[2], '고정은 세션 기억을 덮는다 (바로 반영)');
    assert.deepEqual(session.chatChanged(s, ['Arin.png']), [['Arin.png', F[2]]], '채팅을 바꿔도 고정 그림');
});
await test('고정 해제 → 랜덤 복귀 · 고정 파일이 지워지면 원본으로', () => {
    const s = settings({ chars: { 'Arin.png': rec(F, F[1]) } }), session = new Session({ random: seq(0.9, 0.3) });
    assert.equal(session.get(s, 'Arin.png'), F[1]);
    s.chars['Arin.png'].pinned = '';
    const after = session.get(s, 'Arin.png');
    assert.ok([CARD, ...F].includes(after), '해제하면 다시 후보에서 고름');
    const seen = new Set(); for (let i = 0; i < 20; i++) seen.add(session.repick(s, 'Arin.png'));
    assert.ok(seen.size > 1, '해제 뒤에는 바뀐다');
    // 고정 파일이 서버에서 지워짐(목록에서 빠짐)
    const gone = settings({ chars: { 'Arin.png': { files: [F[0], F[2]], pinned: F[1] } } });
    assert.equal(choose(gone.chars['Arin.png'], { random: () => 0.99 }), CARD, '사라진 고정 파일 → 원본');
    assert.equal(new Session().get(gone, 'Arin.png'), CARD);
    const tidied = tidyMultiAvatar(gone);
    assert.equal(tidied.chars['Arin.png'].pinned, '', '정리하면 고정값도 비워져 랜덤으로 돌아감');
    assert.deepEqual(tidied.chars['Arin.png'].files, [F[0], F[2]]);
});
await test('세션: 기억한 그림이 목록에서 빠지면 다시 고름 · 전체 끔이면 원본', () => {
    const s = settings(), session = new Session({ random: () => 0.99 });
    session.set('Arin.png', 'user/images/bl-avatar-0123456789abcdef/zzz.webp');
    assert.equal(session.get(s, 'Arin.png'), F[2]);
    assert.equal(session.get({ ...s, on: false }, 'Arin.png'), CARD);
});
await test('정리(tidy): 깨진 값 · 상한 · 중복 · 경로 모양 · 빈 항목 · 기본값', () => {
    const d = tidyMultiAvatar(undefined);
    assert.deepEqual(d, { on: true, when: 'chat', includeCard: true, chars: {} });
    assert.deepEqual(tidyMultiAvatar('bad'), d);
    assert.equal(tidyMultiAvatar({ when: 'never' }).when, 'chat');
    assert.equal(tidyMultiAvatar({ when: 'daily', on: 'false' }).when, 'daily');
    assert.equal(tidyMultiAvatar({ on: false }).on, false);
    assert.equal(tidyMultiAvatar({ includeCard: false }).includeCard, false);
    const many = Array.from({ length: 30 }, (_, i) => `user/images/bl-avatar-0123456789abcdef/f${i}.webp`);
    const t = tidyMultiAvatar({ chars: {
        'Arin.png': { files: [...many, many[0], 'http://evil/x.png', '../../etc', 'user/images/other/x.png', 42], pinned: many[3] },
        'Bad/Slash.png': { files: [F[0]] }, 'Empty.png': { files: [], pinned: '' }, 'CardOnly.png': { files: [], pinned: 'card' }, 'Str.png': 'nope', 'Weird.png': { files: 'x', pinned: F[0] },
    } });
    assert.equal(t.chars['Arin.png'].files.length, MAX_FILES, '상한 24');
    assert.ok(t.chars['Arin.png'].files.every(p => p.startsWith('user/images/bl-avatar-')), '우리 폴더 경로만');
    assert.equal(new Set(t.chars['Arin.png'].files).size, MAX_FILES, '중복 없음');
    assert.equal(t.chars['Arin.png'].pinned, many[3]);
    assert.equal(t.chars['Bad/Slash.png'], undefined, '아바타 이름에 경로 구분자 → 버림');
    assert.equal(t.chars['Empty.png'], undefined, '빈 항목 → 버림');
    assert.deepEqual(t.chars['CardOnly.png'], { files: [], pinned: 'card' }, '카드만 고정(랜덤 끈 캐릭터)은 남김');
    assert.equal(t.chars['Str.png'], undefined);
    assert.equal(t.chars['Weird.png'], undefined, '파일 목록이 깨지고 고정 파일도 없으면 → 버림');
    const keep = { on: true, when: 'list', includeCard: false, chars: { 'Arin.png': rec(F, F[1]) } };
    assert.deepEqual(tidyMultiAvatar(structuredClone(keep)), keep, '멀쩡한 값은 그대로');
});
await test('폴더 해시 · 주소 · src 읽기', () => {
    assert.match(folderOf('Arin.png'), /^bl-avatar-[0-9a-f]{16}$/);
    assert.equal(folderOf('Arin.png'), folderOf('Arin.png'));
    assert.notEqual(folderOf('Arin.png'), folderOf('arin.png'));
    assert.notEqual(folderOf('아린.png'), folderOf('아 린.png'));
    assert.ok(isFolder(folderOf('x')) && !isFolder('bl-avatar-xyz') && !isFolder('characters'));
    assert.equal(urlOf('user/images/bl-avatar-0123456789abcdef/a b.webp'), '/user/images/bl-avatar-0123456789abcdef/a%20b.webp');
    assert.equal(avatarFromSrc('/thumbnail?type=avatar&file=%EC%95%84%EB%A6%B0.png'), '아린.png');
    assert.equal(avatarFromSrc('/thumbnail?type=persona&file=me.png'), null, '페르소나는 아님');
    assert.equal(avatarFromSrc('http://localhost:8000/characters/Arin.png?x=1'), 'Arin.png', '프로필 원본 화질이 바꾼 주소');
    assert.equal(avatarFromSrc('/user/images/bl-avatar-0123456789abcdef/a.webp'), null, '우리가 바꾼 주소는 모른다');
    assert.equal(avatarFromSrc('img/ai4.png'), null);
    assert.equal(avatarFromSrc(''), null);
});
await test('정리 계획(가짜 서버): 지운 캐릭터 항목 · 어디에도 안 적힌 폴더 · 쓰는 폴더 안의 떠돌이 파일', async () => {
    const folderA = folderOf('Arin.png'), folderGone = folderOf('Gone.png'), folderOrphan = 'bl-avatar-ffffffffffffffff';
    const chars = { 'Arin.png': { files: [`user/images/${folderA}/a.webp`], pinned: '' }, 'Gone.png': { files: [`user/images/${folderGone}/g.webp`], pinned: '' } };
    const server = { [folderA]: ['a.webp', 'stray.webp'], [folderGone]: ['g.webp'], [folderOrphan]: ['o1.webp', 'o2.webp'], 'not-ours': ['x.png'] };
    const fetcher = async (u, { body }) => {
        const payload = JSON.parse(body);
        const json = u.endsWith('/folders') ? Object.keys(server) : u.endsWith('/list') ? (server[payload.folder] || []).map(name => ({ name })) : null;
        return { ok: true, status: 200, json: async () => json };
    };
    const plan = await S.cleanupPlan(chars, ['Arin.png'], { fetcher, ctx: { getRequestHeaders: () => ({}) } });
    assert.deepEqual(plan.gone, ['Gone.png']);
    assert.deepEqual(plan.goneFiles, [`user/images/${folderGone}/g.webp`]);
    assert.deepEqual(plan.orphanFiles.sort(), [`user/images/${folderA}/stray.webp`, `user/images/${folderOrphan}/o1.webp`, `user/images/${folderOrphan}/o2.webp`].sort(), 'not-ours 폴더는 건드리지 않음');
    assert.equal(plan.total, 4);
});
await test('올리기: 서버 경로를 돌려주고 폴더는 아바타 해시', async () => {
    let sent = null;
    const fetcher = async (u, init) => { sent = { u, body: JSON.parse(init.body) }; return { ok: true, status: 200, json: async () => ({ path: `user/images/${sent.body.ch_name}/${sent.body.filename}.webp` }) }; };
    const prepare = async () => ({ base64: 'AAAA', format: 'webp' });
    const p = await S.uploadAvatarImage('Arin.png', { name: 'x.png' }, { fetcher, prepare, ctx: { getRequestHeaders: () => ({}) } });
    assert.equal(sent.u, '/api/images/upload');
    assert.equal(sent.body.ch_name, folderOf('Arin.png'));
    assert.ok(P.isFilePath(p), p);
    await assert.rejects(S.uploadAvatarImage('Arin.png', { name: 'x.png' }, { fetcher: async () => ({ ok: false, status: 413 }), prepare, ctx: { getRequestHeaders: () => ({}) } }), /너무 커요/);
    assert.equal(await S.deleteImage('user/images/x/y.webp', { fetcher: async () => ({ ok: false, status: 404 }), ctx: { getRequestHeaders: () => ({}) } }), false, '이미 없는 파일은 지운 것으로');
});
await test('화면 · CSS · CI 배선', async () => {
    const fs = await import('node:fs/promises');
    const read = rel => fs.readFile(path.join(root, rel), 'utf8');
    const settings = await read('src/settings.js'); assert.match(settings, /multiAvatar: \{ on: true, when: 'chat', includeCard: true, chars: \{\} \}/); assert.match(settings, /tidyMultiAvatar\(s\.multiAvatar/);
    const features = await read('src/features.js'); assert.match(features, /multi-avatar\/index\.js/); assert.match(features, /bl-mav-button/);
    const panel = await read('src/panel.js'); for (const key of ['multiAvatar.on', 'multiAvatar.when', 'multiAvatar.includeCard', 'mav-open', 'mav-current', 'mav-cleanup']) assert.ok(panel.includes(key), key);
    const css = await read('style.css'); for (const cls of ['.bl-mav-grid', '.bl-mav-tile.is-pinned', 'dialog.bl-mav-viewer', '.bl-mav-list']) assert.ok(css.includes(cls), `style.css 에 ${cls}`);
    assert.match(await read('.github/workflows/release-check.yml'), /multi-avatar-pick\.mjs/);
    assert.match(await read('src/settings-labels.js'), /multiAvatar\.when:daily/);
    assert.match(await read('src/settings-search.js'), /프로필 여러 개/);
    assert.match(await read('src/settings-differences.js'), /'multiAvatar'/);
    const dialog = await read('src/multi-avatar/dialog.js'); assert.ok(!/new MutationObserver/.test(dialog + await read('src/multi-avatar/index.js')), 'MutationObserver 를 만들지 않음');
});
console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
