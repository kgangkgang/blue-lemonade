// 「블루레몬에이드 사용」을 끄면 돌고 있던 애드온이 멈춰야 하고 화면도 쉬고 있다고 하니, 저장을 확인한 뒤 새로고침해요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const { switchNeedsReload } = await import(new URL('src/usage-mode.js', pathToFileURL(dir + '/')));
const ids = ['perf', 'tts', 'models'];
assert.equal(switchNeedsReload({ enabled: false, addons: { perf: true } }, new Set(['perf']), ids), true, '끄면 돌던 성능 보조를 멈춰야 해요');
assert.equal(switchNeedsReload({ enabled: false, addons: { perf: true } }, new Set(), ids), false, '돌던 게 없으면 새로고침이 필요 없어요');
assert.equal(switchNeedsReload({ enabled: true, addons: { perf: true } }, new Set(), ids), true, '다시 켜면 시작해야 해요');
assert.equal(switchNeedsReload({ enabled: true, addons: { perf: true } }, new Set(['perf']), ids), false, '그대로면 새로고침 없음');
assert.equal(switchNeedsReload({ enabled: true, addons: {} }, new Set(), ids), false, '애드온을 안 쓰면 새로고침 없이 켜고 꺼요');
const panel = fs.readFileSync(path.join(dir, 'src/panel.js'), 'utf8');
const save = fs.readFileSync(path.join(dir, 'src/addon-save.js'), 'utf8');
const addons = fs.readFileSync(path.join(dir, 'src/addons.js'), 'utf8') + fs.readFileSync(path.join(dir, 'src/addons-panel.js'), 'utf8');   // 1.1.5 애드온 카드는 addons-panel.js
assert.match(panel, /async function reloadForMasterSwitch\(\) \{[\s\S]{0,300}addonsNeedReload\(getSettings\(\)\)[\s\S]{0,300}await saveAddonsNow\(\);\s*location\.reload\(\)/, '저장을 확인한 뒤 새로고침해요');
assert.match(panel, /path === 'enabled' && !target\.checked && restoreState\(\)[\s\S]{0,420}if \(path === 'enabled'\) await reloadForMasterSwitch\(\);/, '실리태번 모습 되돌리기 뒤에 새로고침해요');
assert.match(panel, /changes\.some\(change => change\.path === 'enabled'\)\) await reloadForMasterSwitch\(\)/, '되돌리기로 바뀌어도 같아요');
assert.match(save, /salty\?\.enabled !== false\) !== \(getSettings\(\)\.enabled !== false\)/, '저장 확인이 「사용」 값도 봐요');
assert.match(addons, /export const addonsNeedReload = s => switchNeedsReload\(s, new Set\(\[\.\.\.running, \.\.\.\(lateStarted \? \[\] : lateIds\)\]\), RELOAD_ADDONS\);/);
console.log('PASS 「사용」을 바꾸면 저장 뒤 새로고침해요');
