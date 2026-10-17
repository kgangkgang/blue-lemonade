// 7.0.3 프롬프트 관리자 「채팅 기록」 마커 목록: 보낸 순서 번호(대화 1 …) 대신 원래 채팅 번호(#14)와 「끼운 글」 — src/prompt-history-label.js · src/promptlist.js.
//   숨긴 메시지 · 깊이로 끼운 글 · 정규식 · 매크로 · 이름 앞머리 · 확실하지 않으면 원래 이름. 지어낸 이름 · 글만 쓴다.
//   node tools/tests/prompt-history-label.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { alignHistory, chatCandidates, labelOf, sameMessage, roleOf } = await import(pathToFileURL(path.join(root, 'src/prompt-history-label.js')).href);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };
const labels = (items, chat, opt) => alignHistory(items, chatCandidates(chat, opt)).map(r => labelOf(r) ?? '그대로');

// 지어낸 채팅 23개(#0~#22), 앞 14개는 숨김(다른 확장이 자동으로 숨긴 것처럼)
const chat = Array.from({ length: 23 }, (_, i) => ({ is_user: i % 2 === 0, is_system: i < 14, name: i % 2 ? 'Rex' : 'Mina', mes: `message number ${i} about the lighthouse and the tide` }));
const asSent = i => ({ role: chat[i].is_user ? 'user' : 'assistant', content: chat[i].mes });
const inserted = text => ({ role: 'system', content: text });

t('숨긴 메시지 + 깊이로 끼운 글: 보이는 9개는 #14~#22, 끼운 3개는 「끼운 글」 (사용자 상황)', () => {
    // 실리태번 차례: 깊이 20(보이는 수보다 깊음) → 맨 앞, 깊이 4 → 뒤에서 넷째 앞, 깊이 0 → 맨 뒤
    const items = [inserted('[Deep lore note]'), asSent(14), asSent(15), asSent(16), asSent(17), asSent(18), inserted('[Author note: keep it calm]'), asSent(19), asSent(20), asSent(21), asSent(22), inserted('[Scene: night]')];
    assert.deepEqual(labels(items, chat), ['끼운 글', '#14', '#15', '#16', '#17', '#18', '끼운 글', '#19', '#20', '#21', '#22', '끼운 글']);
});

t('정규식(프롬프트 전용) · 매크로 · 이름 앞머리 · 생각 블록이 붙은 보낸 글도 같은 메시지', () => {
    const c = [{ is_user: true, name: 'Mina', mes: 'Hello {{char}}, the <b>boat</b> is late' }, { is_user: false, name: 'Rex', mes: 'STATUS[hp 3]\nI will wait at the pier tonight' }];
    const opt = { regexed: text => text.replace(/STATUS\[[^\]]*\]\n?/, '').replace(/<\/?b>/g, ''), substitute: text => text.replace('{{char}}', 'Rex') };
    const items = [{ role: 'user', content: 'Mina: Hello Rex, the boat is late' }, { role: 'assistant', content: '<think>short</think>\nI will wait at the pier tonight' }];
    assert.deepEqual(labels(items, c, opt), ['#0', '#1']);
    assert.deepEqual(labels(items, c), ['그대로', '그대로'], '정규식 · 매크로를 모르면 확실하지 않아 원래 이름');
});

t('확실하지 않으면 원래 이름: 크게 바뀐 메시지가 낀 빈틈의 줄 · 다른 채팅 · 역할이 다름', () => {
    const items = [asSent(19), inserted('[note]'), { role: 'assistant', content: 'completely rewritten by some script' }, asSent(21), asSent(22)];
    assert.deepEqual(labels(items, chat), ['#19', '그대로', '그대로', '#21', '#22'], '#20 을 못 맞춰 그 사이 줄은 끼운 글인지 모른다');
    assert.deepEqual(labels([asSent(20)], [{ is_user: false, mes: 'other chat entirely' }]), ['그대로']);
    assert.deepEqual(labels([{ role: 'assistant', content: chat[22].mes }], chat), ['그대로'], '#22 는 사용자 메시지라 user 로 보냄');
});

t('같은 글이 되풀이돼도 새것끼리 차례대로 · 맨 앞 끼운 글은 보이는 첫 메시지까지 맞았을 때만', () => {
    const c = ['hm', 'yes indeed', 'hm', 'yes indeed'].map((mes, i) => ({ is_user: i % 2 === 0, mes }));
    const items = c.slice(1).map(m => ({ role: m.is_user ? 'user' : 'assistant', content: m.mes }));
    assert.deepEqual(labels(items, c), ['#1', '#2', '#3']);
    assert.deepEqual(labels([inserted('[deep]'), ...items], c), ['그대로', '#1', '#2', '#3'], '#0 이 예산에서 빠졌을 수 있어 맨 앞 줄은 모른다');
    const all = c.map(m => ({ role: m.is_user ? 'user' : 'assistant', content: m.mes }));
    assert.deepEqual(labels([inserted('[deep]'), ...all], c), ['끼운 글', '#0', '#1', '#2', '#3']);
});

t('맞추는 규칙 · 역할 · 긴 채팅은 뒤쪽만 정규식', () => {
    assert.equal(sameMessage('Rex: and then the tide came in', ['and then the tide came in']), true);
    assert.equal(sameMessage('ok', ['ok']), true);
    assert.equal(sameMessage('not ok at all', ['ok']), false, '짧은 글은 같을 때만');
    assert.equal(sameMessage('prefix the tide came in suffix', ['the tide came in']), true, '12자 이상은 들어 있어도');
    assert.equal(sameMessage('', ['x']), false);
    assert.equal(roleOf({ is_user: false, extra: { type: 'narrator' } }), 'system');
    let calls = 0;
    const long = Array.from({ length: 500 }, (_, i) => ({ is_user: false, mes: `line ${i} of a long story` }));
    const cand = chatCandidates(long, { regexed: text => { calls++; return text; }, tail: 3 });
    assert.equal(cand.length, 500); assert.equal(calls, 3);
    assert.deepEqual(alignHistory(long.slice(-3).map(m => ({ role: 'assistant', content: m.mes })), cand).map(labelOf), ['#497', '#498', '#499']);
});

t('배선: promptlist 가 chatHistory 줄에 표시를 달고 열릴 때 이름만 바꿈(내용 · 토큰 · 순서 안 건드림) · 모르면 「대화 N」 · CI', () => {
    const src = read('src/promptlist.js');
    assert.match(src, /import \{ alignHistory, chatCandidates, labelOf \} from '\.\/prompt-history-label\.js';/);
    assert.match(src, /name\.textContent = history \? `대화 \$\{history\[1\]\}` : parts\.name;/, '먼저 옛 이름');
    assert.match(src, /if \(history\) name\.dataset\.blHist = history\[1\];/);
    assert.match(src, /void labelHistory\(root\);/);
    assert.match(src, /if \(text && name\.isConnected\) name\.textContent = text;/);
    assert.match(src, /new URL\('\.\.\/\.\.\/\.\.\/\.\.\/extensions\/regex\/engine\.js', import\.meta\.url\)/);
    assert.match(src, /isPrompt: true, depth/);
    assert.ok(!/\.inline-drawer-content'\)\?\.(textContent|innerHTML) =/.test(src), '본문은 안 바꾼다');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/prompt-history-label\.mjs \./);
});

console.log(`prompt-history-label: ${n} passed, 0 failed`);
