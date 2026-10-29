// 꺼진(또는 아직 안 도는) 애드온은 바깥에서 불러 시작시키지 않아요 (예측점검-애드온 1029).
//   한글화 패널 모듈(src/addons/prompt/index.js)은 불러오는 순간 시작해요(설정 칸을 붙이고 번역 캐시를 읽음).
//   프롬프트 목록(promptlist.js)이 켜 둔 설정 값만 보고 불러서, 사용 모드에서 확장을 꺼 둔 사용자도 「끼운 글」 이름표를 그릴 때 패널이 통째로 켜졌어요.
//   이제 addons.js 의 addonRunning(지금 이 페이지에서 실제로 도는지)을 봐요.  node tools/tests/addon-off-cost.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

// 불러오면 바로 시작하는 애드온 입구 (startOne 이 부르는 것)
const STARTERS = ['prompt/index.js', 'direction/index.js', 'assets/index.js', 'bookmarks/index.js', 'notes/index.js', 'rewrite/index.js', 'modelswitch/index.js', 'regexlink/index.js', 'zipinstall/index.js', 'mermaid/index.js', 'customstyle/index.js', 'models/index.js', 'prompt-template/index.js', 'tts/index.js', 'translator/index.js', 'translator/bridge.js', 'perf/start.js'];
// 사용자가 직접 누른 동작에서 켜짐을 확인한 뒤 부르는 곳 (알림 단추 → 번역 창)
const USER_ACTION = new Set(['src/notice-actions.js']);

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) { if (rel !== 'src/addons' && !rel.includes('/vendor')) walk(rel, out); }
        else if (entry.name.endsWith('.js')) out.push(rel);
    }
    return out;
}

check('addons.js 가 「지금 도는지」를 내보내요 (설정 값과 따로)', () => {
    const src = read('src/addons.js');
    assert.match(src, /export const addonRunning=id=>running\.has\(id\);/);
});
check('프롬프트 목록은 한글화 패널이 실제로 돌 때만 그 모듈을 불러요', () => {
    const list = read('src/promptlist.js');
    const at = list.indexOf("import('./addons/prompt/index.js')");
    assert.ok(at > 0);
    const guard = list.slice(Math.max(0, list.lastIndexOf('\n    if ', at)), at);
    assert.match(guard, /addonRunning\?\.\('prompt'\)/, guard);
    assert.doesNotMatch(guard, /extensionSettings\?\.salty\?\.addons\?\.prompt\)/, '켜 둔 값만 보면 안 돼요');
});
check('애드온 밖(src · index.js)에서 시작 입구를 부르는 곳은 addonRunning 으로 지키거나 사용자 동작 목록에 있어요', () => {
    const files = ['index.js', ...walk('src')].filter(rel => rel !== 'src/addons.js');
    const bad = [];
    let seen = 0;
    for (const rel of files) {
        const src = read(rel);
        for (const starter of STARTERS) {
            const re = new RegExp(`import[(]['"][^'"]*addons/${starter.replace(/[.]/g, '[.]')}['"][)]`, 'g');
            for (const m of src.matchAll(re)) {
                seen++;
                if (USER_ACTION.has(rel)) continue;
                const before = src.slice(Math.max(0, m.index - 400), m.index);
                if (!/addonRunning/.test(before)) bad.push(`${rel}: ${m[0]}`);
            }
        }
    }
    assert.deepEqual(bad, []);
    assert.ok(seen >= 3, `찾은 곳이 너무 적어요(${seen}) — 찾는 식이 깨졌을 수 있어요`);
});
console.log(`addon off cost: ${passed} passed`);
