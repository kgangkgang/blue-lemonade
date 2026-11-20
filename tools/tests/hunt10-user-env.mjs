// 버그 사냥 10 사용자 환경 리그 한 바퀴에서 나온 고침의 계약
//   ① 월드인포 항목 목록의 쪽수 고르기(「25 / page」): 실리태번이 이 목록만 번역 없이 그리고 월드를 고를 때마다 다시 그려요
//      → 그 쪽수 줄 하나만 보는 감시자(page-size-watch.js)가 다시 그려질 때마다 한국어로 고쳐요(페르소나 목록은 실리태번이 스스로 한국어)
//   ② 캐릭터 편집 「설명」 · 「첫 메시지」 줄: 번역 단추 바로 옆 도움말 ? 의 누를 자리(44px)가 번역 단추를 덮어 번역을 누르면 도움말 문서가 열리던 것
//   ③ 환영 화면 최근 채팅 미리보기: 태그 안 빈칸이 점자 빈칸(U+2800)이면 태그가 안 떼어져 `<span⠀style=…>` 이 글자로 보이던 것
//   ④ 애드온 창 안내 글의 낮은 대비: 옅은 글자색 위에 실리태번 small{opacity:.7} 이 겹쳐 낮 2.7 ~ 2.9:1 · 밤 3.2 ~ 4.0:1 이던 것
//   node tools/tests/hunt10-user-env.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0, bad = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log('  PASS ', name); } catch (e) { bad++; console.log('  FAIL ', name, '\n       ', String(e.message).split('\n')[0]); } };

await test('① 월드인포 쪽수 고르기: 지금 한 번 고치고, 다시 그려질 때마다 또 고쳐요(고친 글은 다시 안 맞아 되풀이 없음)', async () => {
    const watch = await import(pathToFileURL(path.join(root, 'src/page-size-watch.js')).href);
    const ui = await import(pathToFileURL(path.join(root, 'src/ko-ui.js')).href);
    assert.deepEqual(watch.BUILTIN_PAGE_SIZE_HOSTS, ['world_info_pagination']);
    let options = ['10 / page', '25 / page'].map(textContent => ({ textContent }));
    const host = { querySelectorAll: sel => (sel === ui.PAGE_SIZE_OPTIONS ? options : []) };
    const translate = key => (key === '/ page' ? '/ 쪽' : key);
    const seen = [];
    class FakeObserver { constructor(cb) { this.cb = cb; seen.push(this); } observe(target, opts) { this.target = target; this.opts = opts; } disconnect() { this.off = true; } }
    let calls = 0;
    const stop = watch.watchPageSize(host, h => { calls++; return ui.relabelPageSize(h, translate); }, FakeObserver);
    assert.deepEqual(options.map(o => o.textContent), ['10 / 쪽', '25 / 쪽'], '처음 한 번');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].target, host, '쪽수 줄만 봐요');
    assert.deepEqual(seen[0].opts, { childList: true, subtree: true });
    options = ['50 / page', '100 / page'].map(textContent => ({ textContent }));   // 실리태번이 목록을 다시 그림
    seen[0].cb([]);
    assert.deepEqual(options.map(o => o.textContent), ['50 / 쪽', '100 / 쪽'], '다시 그려진 뒤');
    seen[0].cb([]);   // 고친 글 때문에 한 번 더 불려도 바꿀 것이 없어요
    assert.deepEqual(options.map(o => o.textContent), ['50 / 쪽', '100 / 쪽']);
    assert.equal(calls, 3);
    stop(); assert.equal(seen[0].off, true);
    assert.equal(watch.watchPageSize(null, () => 0, FakeObserver), null, '쪽수 줄이 없으면 아무것도 안 해요');
    const src = read('src/ko-ui.js');
    assert.match(src, /for \(const id of BUILTIN_PAGE_SIZE_HOSTS\) watchPageSize\(document\.getElementById\(id\), host => relabelPageSize\(host, translate\)\);/);
    const code = read('src/page-size-watch.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(!/setInterval|setTimeout|document\.body|getElementById\('chat'\)/.test(code), '타이머 · 넓은 감시 없음');
});

await test('② 캐릭터 편집 「설명」 · 「첫 메시지」 · 고급 정의 제목 줄: 번역 단추 뒤 도움말 ? 의 누를 자리가 번역 단추를 덮지 않아요(손가락 화면 · 소스와 생성 CSS)', () => {
    const rule = /@media \(pointer: coarse\) \{\s*html body\.salty #rm_ch_create_block :is\(#description_div, #first_message_div\) \.jj-tr-btn\.bl-kt-btn ~ a\.notes-link::before,\s*html body\.salty #character_popup :is\(h4, h5\) > \.jj-tr-btn\.bl-kt-btn ~ a\.notes-link::before \{ left: -3px; transform: translate\(0, -50%\); \}\s*\}/;
    assert.match(read('src/addons/prompt/style.css'), rule, '소스');
    assert.ok(read('src/addons/style-addons.gated.gen.css').replace(/\s+/g, ' ').includes('.jj-tr-btn.bl-kt-btn ~ a.notes-link::before'), '생성 CSS');
    // 바탕 규칙(가운데 맞춘 44px)이 그대로 있어야 이 보정이 뜻이 있어요 — 크기는 안 줄여요
    const base = read('css/56-control-consistency.css');
    assert.match(base, /#rm_ch_create_block :is\(#description_div, #first_message_div\) a\.notes-link, #character_popup :is\(h4, h5\) > a\.notes-link,/);
    assert.match(base, /width:max\(100%,44px\); height:max\(100%,44px\); transform:translate\(-50%,-50%\);/);
    // 번역 단추는 ? 보다 앞(왼쪽)에 붙어요 — 크게 보기 아이콘 바로 뒤
    assert.match(read('src/addons/prompt/inline-targets.js'), /anchor\.after\(button\);/);
});

await test('③ 환영 화면 최근 채팅 미리보기: 태그 안 빈칸이 점자 빈칸(U+2800)이어도 태그를 떼요(태그 밖 점자 빈칸 · 보통 글은 그대로)', async () => {
    const W = await import(pathToFileURL(path.join(root, 'src/welcome-tidy.js')).href);
    const B = '⠀';
    assert.equal(W.plainPreview(`<span${B}style="color:#424C59">「……잠깐만」</span>${B}She${B}doesn’t${B}move`), `「……잠깐만」 ${B}She${B}doesn’t${B}move`);
    assert.equal(W.plainPreview(`앞${B}글 <font${B}color="#abc">대사</font> 뒤`), `앞${B}글 대사 뒤`);
    assert.equal(W.plainPreview(`<sola_hud${B}mood="calm">x</sola_hud> 끝`), 'x 끝');
    // 보통 빈칸 태그 · 태그 없는 글 · 부등호가 든 글은 1.9.4 그대로
    assert.equal(W.plainPreview('<span style="color:#424C59">「……잠깐만」</span> She doesn’t move'), '「……잠깐만」 She doesn’t move');
    const prose = `3 < 5${B}그리고 7 > 2 — 화살표 -> 그대로`; assert.equal(W.plainPreview(prose), prose);
    const braille = `등불이${B}흔들렸다`; assert.equal(W.plainPreview(braille), braille);
});

await test('④ 애드온 창 안내 글(전개 지시 · 캐릭터 에셋 · 로그 복사 머리 · 커스텀 CSS · 번역 창 출처 줄): 옅은 글자색에 실리태번 small 의 opacity .7 을 겹치지 않아요(소스와 생성 CSS)', () => {
    const rule = 'html body.salty :is(.jj-row-label small, small.jj-prompt-state, .eh-setting-text small, small.eh-hero-meta, #bl-lc-title > small, dialog.bl-ctsi-dialog > small, small.llmt-remote-credit) { opacity:1; }';
    assert.ok(read('css/19-extwindows.css').includes(rule), '소스');
    // 생성기는 목록을 선택자마다 한 줄로 풀어 적어요 — 일곱 선택자 모두 opacity:1 줄이 있어야 해요
    for (const file of ['style.css', 'src/style-lazy.gen.css']) {
        const css = read(file), end = css.search(/small\.llmt-remote-credit\)[^\n{]*\{ opacity:1; \}/);
        assert.ok(end > 0, `생성 CSS(${file}): 규칙 끝`);
        const block = css.slice(css.lastIndexOf('}', end), end + 120);
        for (const part of ['.jj-row-label small', 'small.jj-prompt-state', '.eh-setting-text small', 'small.eh-hero-meta', '#bl-lc-title > small', 'dialog.bl-ctsi-dialog > small', 'small.llmt-remote-credit']) assert.ok(block.includes(part), `생성 CSS(${file}): ${part}`);
    }
    // 5.3.7 테마 설정 창의 같은 고침이 그대로 있어요(같은 까닭 · 같은 길)
    assert.ok(read('css/19-extwindows.css').includes('.salty-panel small:where(:not(.mes_text small)) { opacity:1; }'));
    // 이 글들은 이미 옅은 글자색을 써요 — 글자색을 바꾸지 않고 겹친 흐림만 걷어요
    assert.ok(read('src/addons/direction/style.css').includes('.jj-row-label small { font-size: .76em; color: var(--jj-muted); }'));
    assert.ok(read('src/addons/translator/style.css').includes('.llmt-remote-credit { display: block; margin-top: 4px; color: var(--salty-faint'));
});

console.log(`\n버그 사냥 10 사용자 환경: ${n} 통과 · ${bad} 실패`);
process.exit(bad ? 1 : 0);
