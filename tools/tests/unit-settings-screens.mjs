// 설정창 화면 합치기 (src/settings-screens.js) — 합친 화면 이름 · 바꾼 설정 수 · 목록과 칩 마크업
//   node tools/tests/unit-settings-screens.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-settings-screens');
const { MERGED, mergedOf, screenTitle, changedByScreen, catalogMarkup, chipsMarkup, SCREEN_ICONS } = await load('src/settings-screens.js');

await test('합친 화면 표: 한 화면 id 가 두 묶음에 들지 않아요', () => {
    for (const [tab, list] of Object.entries(MERGED)) {
        const all = list.flatMap(m => m.subs);
        assert.equal(new Set(all).size, all.length, tab);
        for (const m of list) {
            assert.ok(m.label && m.subs.length > 1);
            for (const id of Object.keys(m.chips || {})) assert.ok(m.subs.includes(id), `칩 ${id} 는 subs 안에 있어야 해요`);
        }
    }
});

await test('mergedOf · screenTitle', () => {
    assert.equal(mergedOf('text', 'em').label, '글자 모양');
    assert.equal(mergedOf('text', 'para'), null);
    assert.equal(mergedOf('없는탭', 'em'), null);
    assert.equal(screenTitle('chat', 'user-name', {}), '이름 · 시간');
    assert.equal(screenTitle('text', 'para', { text: [['para', '문단']] }), '문단');
    assert.equal(screenTitle('x', 'y', {}), '');
});

await test('바꾼 설정 수는 합친 화면의 첫 화면으로 모아요', () => {
    const route = p => ({ a: { tab: 'text', sub: 'em' }, b: { tab: 'text', sub: 'code' }, c: { tab: 'text', sub: 'para' } }[p]);
    assert.deepEqual(changedByScreen([{ path: 'a' }, { path: 'b' }, { path: 'c' }, { path: '모르는경로' }], route), { 'text/text': 2, 'text/para': 1 });
    assert.deepEqual(changedByScreen([], route), {});
});

await test('칩 줄: 합친 화면에서만 나오고 지금 화면이 눌린 상태예요', () => {
    const html = chipsMarkup('chat', 'user-profile', { chat: [['profile', '프로필'], ['user-profile', '내 프로필']] });
    assert.equal((html.match(/<button /g) || []).length, 2);
    assert.match(html, /data-sub="user-profile"[^>]*aria-pressed="true"[^>]*>나</);
    assert.match(html, /data-sub="profile"[^>]*aria-pressed="false"[^>]*>캐릭터</);
    assert.equal(chipsMarkup('text', 'para', {}), '');
    const text = chipsMarkup('text', 'em', { text: [['text', '본문'], ['em', '기울임']] });
    assert.match(text, />기울임</, '칩 이름이 따로 없으면 화면 이름을 써요');
    assert.match(text, />strike</, '화면 이름도 없으면 id 를 써요');
});

await test('목록: 합친 화면은 한 줄만 보이고 나머지는 숨긴 단추로 남아요', () => {
    const html = catalogMarkup([['chat', '채팅']], { chat: [['profile', '프로필'], ['user-profile', '내 프로필'], ['message', '메시지 <b>']] }, { tab: 'chat', sub: 'user-profile' }, { 'chat/profile': 2 });
    assert.match(html, /<h4>채팅<\/h4>/);
    assert.match(html, /data-sub="profile" aria-current="page" data-count="2" aria-label="프로필, 바꾼 설정 2개">/, '합친 화면 안의 화면에 있으면 그 줄이 지금 화면이에요');
    assert.match(html, /<button type="button" hidden [^>]*data-sub="user-profile" data-merged>/);
    assert.match(html, /메시지 &lt;b&gt;</, '화면 이름은 이스케이프해요');
    assert.ok(!/data-sub="message"[^>]*data-count/.test(html), '바꾼 것이 없으면 수를 붙이지 않아요');
    assert.match(html, /fa-id-badge/);
});

await test('목록에서만 줄여 부르는 이름', () => {
    const html = catalogMarkup([['prompt', '프롬프트']], { prompt: [['deus', '데우스 엑스 마키나']] }, { tab: 'theme', sub: 'palette' });
    assert.match(html, />데우스<\/button>/);
    assert.equal(screenTitle('prompt', 'deus', { prompt: [['deus', '데우스 엑스 마키나']] }), '데우스 엑스 마키나');
});

await test('아이콘 표는 탭/화면 꼴 열쇠와 fa- 이름이에요', () => {
    for (const [key, icon] of Object.entries(SCREEN_ICONS)) {
        assert.match(key, /^[a-z]+\/[a-z-]+$/);
        assert.match(icon, /^fa-[a-z-]+$/);
    }
});

done();
