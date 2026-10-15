// 6.7.2 모델 전환: 「검열되면」 단추 = 검열되면 줄만 고르기(꺼진 줄은 확인 후 「바꾸기」 때 켬) · 등록한 확장 칸은 자동 찾기에서 통째로 빼기 · 「세부 ⌄」 단추.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };
const D = await import(pathToFileURL(path.join(root, 'src/addons/modelswitch/discover.js')).href);
await check('registered extension owns its whole settings key', () => {
    const nodes = [{ path: ['jobs', 'a', 'connection'] }, { path: ['connection'] }];
    assert.deepEqual(D.skipRegistered(nodes, 'ext_like', [{ settingsKey: 'ext_like', path: 'connection' }]), []);
    assert.equal(D.skipRegistered(nodes, 'ext_like', [{ settingsKey: 'other' }]).length, 2);
});
await check('fallback button picks only fallback rows, arms inactive ones after one confirm', () => {
    const idx = read('src/addons/modelswitch/index.js');
    assert.match(idx, /async function pickFallbacks\(\) \{/);
    assert.match(idx, /for \(const target of shownTargets\(\)\) if \(!isFallbackRow\(target\) && rowActive\(target\)\) s\.targets\[target\.id\] = false;/);
    assert.match(idx, /if \(off\.length && !await callGenericPopup\(/);
    assert.match(idx, /if \(group\.dataset\.group === 'fallback'\) \{ pickFallbacks\(\); return; \}/);
    assert.match(idx, /const ok = await withoutLock\(\(\) => target\.enable\(\{ source: d\.source, model: d\.model \}\)\);/);
    assert.match(idx, /button\.disabled = busy \|\| \(fallback \? !picks\.length : /);
});
// 6.7.5 (회귀검사 6.7.4): 일반 줄과 검열되면 줄이 같이 켜진 기본 상태에서 누르면 검열되면 줄이 꺼지고 일반 줄만 남았다 (반대로 동작)
await check('fallback button pressed only when fallback rows alone are picked', async () => {
    const R = await import(pathToFileURL(path.join(root, 'src/addons/modelswitch/rows.js')).href);
    const row = (id, on = true) => ({ id, active: () => on });
    const rows = [row('alpha'), row('alpha-fallback'), row('beta'), row('beta-fallback'), row('gamma-fallback', false)];
    const pickable = t => R.rowActive(t) || t.id === 'gamma-fallback';   // 꺼진 줄도 확인받고 고를 수 있음(armed)
    const onOf = ids => t => ids.includes(t.id);
    assert.equal(R.fallbackOnly(rows, onOf(['alpha', 'beta', 'alpha-fallback', 'beta-fallback', 'gamma-fallback']), pickable), false, 'main rows also on → not pressed (press = pick fallback only)');
    assert.equal(R.fallbackOnly(rows, onOf(['alpha-fallback', 'beta-fallback', 'gamma-fallback']), pickable), true);
    assert.equal(R.fallbackOnly(rows, onOf(['alpha-fallback', 'beta-fallback']), pickable), false, 'an armed row still missing');
    assert.equal(R.fallbackOnly(rows, onOf(['alpha-fallback', 'beta-fallback'])), true, 'default: only active rows count');
    assert.equal(R.fallbackOnly([row('alpha')], onOf([])), false, 'no fallback rows');
    const idx = read('src/addons/modelswitch/index.js');
    assert.match(idx, /if \(fallbackOnly\(shownTargets\(\), isOn, canPick\)\) \{/);
    assert.match(idx, /aria-pressed', String\(fallback \? fallbackOnly\(targets, isOn, canPick\)/);
    // 「창을 닫으면 잊는다」: 팝업 · 설정 창 안 둘 다
    assert.match(idx, /finally \{ armed\.clear\(\); \(inlineHost\?\.isConnected \? inlineHost : holder\)\.replaceChildren\(root\);/);
    assert.match(idx, /inlineHost = null; armed\.clear\(\);/);
});
await check('expand control says 세부', () => {
    assert.match(read('src/addons/modelswitch/index.js'), /aria-label="\$\{esc\(group\.name\)\} 세부 연결">세부 <i class="fa-solid fa-chevron-/);
    assert.match(read('src/addons/modelswitch/style.css'), /\.ms-expand\{display:inline-flex;[^}]*border-radius:8px/);
    assert.match(read('src/addons/modelswitch/style.css'), /\.ms-expand\{[^}]*height:32px/, '단추 높이 32~36px (6.7.5, 전엔 26px)');
});
console.log(`modelswitch-fallback-pick: ${passed} passed, 0 failed`);
