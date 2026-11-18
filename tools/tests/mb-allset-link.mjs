// 1.7.9 미트볼 「관리 › 전체 설정」(그 확장 2.9.0 개발 판 4c7df674 — 설정 서랍 칸을 상태창 안에 한 벌 더)에 블루레몬 맞춤으로 가는 바로가기 한 줄
//   그 확장 「전체 설정」은 그 확장 설정만 담아요 — 블루레몬 맞춤(레몬 탭)은 확장 서랍에만 있어 상태창 안에서는 찾을 길이 없었어요(11-18 조정자 결정 1).
//   ① 안내 글 바로 아래 한 줄(설명 + 단추) · 두 번 그려도 하나 · 원작 그대로 보기면 안 넣음 ② 단추 → 그 창을 닫고 레몬 탭으로 ③ 시트 꼴 · 미트볼 문 · CI
//   node tools/tests/mb-allset-link.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   jsdom 이 없으면 종료 2(통과 아님)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM; try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); } catch { console.error(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
let n = 0; const bad = []; const ok = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (e) { bad.push(name); console.log('실패', name, '—', e.message.split('\n')[0]); } };
let M = null; try { M = await import(pathToFileURL(path.join(root, 'src/mb-allset-link.js')).href); } catch (e) { console.log('모듈 없음', e.code || e.message); }
const need = () => assert.ok(M, 'src/mb-allset-link.js');
const page = () => new JSDOM(`<!doctype html><body class="salty"><dialog open class="popup ss-dlg"><div class="ss-root ss-scope"><div class="ss-settings ss-set-sheet"><div class="ss-set-find"><input class="ss-set-q"></div><small class="ss-hint">확장 설정 서랍과 같은 칸이에요.</small><div class="ss-set-body"><label class="checkbox_label"><input type="checkbox"> 사용</label></div></div></div><div class="popup-controls"><button class="popup-button-ok">닫기</button></div></dialog></body>`).window.document;

await ok('① 안내 글 바로 아래 한 줄(설명 + 단추) · 두 번 불러도 하나 · 레몬 탭 이름 · 원작 그대로 보기면 안 넣음', () => {
    need();
    const doc = page(); const sheet = doc.querySelector('.ss-set-sheet');
    assert.equal(M.addLink(sheet), true);
    const row = sheet.querySelector(`.${M.ROW}`); assert.ok(row);
    assert.equal(row.previousElementSibling.matches('.ss-hint'), true, '안내 글 바로 아래');
    assert.equal(row.nextElementSibling.matches('.ss-set-body'), true, '설정 칸보다 위');
    assert.match(row.textContent, /블루레몬/); assert.match(row.textContent, /확장 › 미트볼 상태창 › 블루레몬/);
    const btn = row.querySelector('button'); assert.ok(btn); assert.equal(btn.type, 'button'); assert.ok(btn.getAttribute('aria-label') || btn.textContent.trim());
    assert.equal(M.addLink(sheet), false, '두 번째는 안 넣어요'); assert.equal(sheet.querySelectorAll(`.${M.ROW}`).length, 1);
    const raw = page(); raw.body.setAttribute('data-bl-ext-raw', '');
    assert.equal(M.addLink(raw.querySelector('.ss-set-sheet')), false, '원작 그대로 보기');
    const noHint = page(); noHint.querySelector('.ss-hint').remove(); assert.equal(M.addLink(noHint.querySelector('.ss-set-sheet')), true, '안내 글이 없으면 찾기 칸 다음');
    assert.equal(noHint.querySelector(`.${M.ROW}`).previousElementSibling.matches('.ss-set-find'), true);
});
await ok('② 단추: 그 창을 닫고 레몬 탭으로(블루레몬 설정 길 gotoMbLemon)', async () => {
    need();
    const doc = page(); const sheet = doc.querySelector('.ss-set-sheet'); const calls = [];
    doc.querySelector('.popup-button-ok').addEventListener('click', () => calls.push('닫기'));
    M.addLink(sheet, { go: async () => { calls.push('레몬 탭'); return true; }, wait: () => Promise.resolve() });
    sheet.querySelector(`.${M.ROW} button`).click(); await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
    assert.deepEqual(calls, ['닫기', '레몬 탭']);
});
await ok('③ 시트: 블루레몬 부품 꼴(옅은 면 · 1px 선 · 간격 토큰 · 단추 높이 36) · 새 색 0 · 「설정 칸 줄 맞춤」 문 · 미트볼 문에서 받음 · CI', () => {
    need();
    const src = read('src/ext-status.css'); const at = src.indexOf(`.ss-set-sheet > .${M.ROW} {`); assert.ok(at > 0, '줄 규칙');
    const marks = [...src.matchAll(/\/\*\s*@mb\s+([a-z|]+)\s*\*\//g)].filter(m => m.index < at); assert.equal(marks.at(-1)[1], 'drawer');
    const body = src.slice(at, src.indexOf('}', at));
    for (const want of ['border: 1px solid var(--salty-line)', 'background: var(--bl-hover)', 'gap: var(--bl-s2', 'padding: var(--bl-s3']) assert.ok(body.includes(want), want);
    const rules = src.slice(at, src.indexOf('\n\n', at) > 0 ? src.indexOf('\n\n', at) : at + 2000);
    assert.doesNotMatch(rules, /#[0-9a-f]{3,8}\b|rgba?\(/i, '박힌 색 없음');
    assert.match(rules, /min-height: var\(--bl-ui-ctl, 36px\)/, '단추 높이 36(손가락 화면 누를 자리 44 는 공용 규칙)');
    assert.ok(read('src/ext-status.gen.css').includes(`.${M.ROW}`), '생성 시트');
    assert.ok(read('index.js').includes("import('./src/mb-allset-link.js').then(m => m.startAllsetLink())"), '미트볼 문');
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/mb-allset-link.mjs . tools'), 'CI 목록');
    assert.doesNotMatch(read('src/mb-allset-link.js'), /watchDom\(|new MutationObserver/, '새 감시 구독 없이(화살표 모듈 구독을 나눠 써요)');
});

if (bad.length) { console.error(`mb-allset-link: ${bad.length}개 실패`); process.exit(1); }
console.log(`mb-allset-link: ${n}개 통과`);
