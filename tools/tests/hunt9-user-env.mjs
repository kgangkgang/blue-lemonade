// 버그 사냥 9 사용자 환경 리그 · 남은 오류 목록 고침의 소스 계약
//   ① 번역 창 생성 파라미터 이름표가 한국어(최대 응답 길이 · 온도 · 빈도 페널티 · 존재 페널티 — Top P · Top K 는 테마 한국어 사전과 같은 고유 이름 그대로)
//   ② 번역 저장소(IndexedDB) 오류 글이 한국어 — 「백업 중 오류 발생: indexedDB open error」 처럼 알림에 영어가 섞이지 않게
//      (내부 표식 'no matching data' 는 여러 곳이 견주니 그대로)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0, bad = 0;
const test = (name, fn) => { try { fn(); n++; console.log('  PASS ', name); } catch (e) { bad++; console.log('  FAIL ', name, '\n       ', String(e.message).split('\n')[0]); } };

test('① 번역 창 이름표에 영어 파라미터 이름이 없어요', () => {
    const html = read('src/addons/translator/index.html');
    for (const en of ['Max Response Length', 'Temperature', 'Frequency Penalty', 'Presence Penalty']) assert.ok(!html.includes(`>${en}<`) && !html.includes(`>${en} `), en);
    assert.equal((html.match(/>최대 응답 길이<\/small>/g) || []).length, 5);
    assert.equal((html.match(/<small>온도<\/small>/g) || []).length, 5);
});
test('② 번역 저장소 오류 글에 영어 문장이 없어요(내부 표식 하나만 남음)', () => {
    const js = read('src/addons/translator/index.js');
    const msgs = [...js.matchAll(/reject\(new Error\((['"])(.*?)\1\)\)/g)].map(m => m[2]);
    assert.ok(msgs.length >= 10);
    const en = msgs.filter(m => !/[가-힣]/.test(m) && m !== 'no matching data');
    assert.deepEqual(en, []);
});

test('③ 한글화 패널 알림(toastr)과 설정 창 안내가 해요체', () => {
    const js = read('src/addons/prompt/index.js');
    const bad = js.split('\n').filter(l => /toastr\.\w+\(/.test(l) && /(습니다|입니다|됩니다)/.test(l));
    assert.deepEqual(bad.map(l => l.trim().slice(0, 60)), []);
    assert.ok(!/니다/.test(read('src/addons/prompt/settings-ui.js')));
});

test('④ 기억한 말투가 없을 때도 「적용 순서」 안내 문단이 남아요(빈 안내는 덧붙임)', () => {
    const js = read('src/addons/translator/selection/style-profile-ui.js');
    const at = js.indexOf('list.append(priority)'), empty = js.indexOf('기억한 말투 지침이 없어요');
    assert.ok(at > 0 && empty > at);
    assert.ok(!/list\.textContent\s*=\s*'기억한 말투/.test(js), '목록 글을 통째로 바꾸면 안내 문단이 지워져요');
});

const coarse = css => { const at = css.indexOf('@media (pointer: coarse)'); return at < 0 ? '' : css.slice(at); };
test('⑤ 전개 지시 깊이 − · + : 손가락 화면에서 묶음이 44 상자를 자르지 않아요(소스 · 생성 CSS)', () => {
    const RULE = /\.jj-stepper\s*\{\s*overflow:\s*visible;\s*\}/;
    assert.match(coarse(read('css/87-addon-touch.css')), RULE);
    assert.match(read('src/style-lazy.gen.css') + read('style.css'), RULE);
});
test('⑥ 미트볼 도구 줄 오른쪽 끝(「더보기」) 상자는 제 오른쪽 끝에 맞춰요(소스 · 생성 CSS)', () => {
    const RULE = /\.ss-tools > \.ss-tool-more:last-child > summary::after\s*\{\s*left:\s*auto;\s*right:\s*0;\s*transform:\s*translateY\(-50%\);\s*\}/;
    assert.match(coarse(read('src/ext-status.css')), RULE);
    assert.match(read('src/ext-status.gen.css'), RULE);
});

console.log(`hunt9-user-env: ${n} passed, ${bad} failed`);
if (bad) process.exit(1);
