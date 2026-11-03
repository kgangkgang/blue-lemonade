// 1.0.0 설정창 간단화(10-31 사용자 「테마 설정창 내부 설정들도 다 좀 간단화시켜 줘」) — 화면만 바꾸고 저장은 그대로인지 지켜요.
//   ① 설정 키 목록이 고정 목록(settings-keys-1000.json)과 같음 — 옛 설정이 그대로 이어져요
//   ② 「고급」으로 옮기는 줄(src/settings-advanced.js ADVANCED)의 설정 키는 모두 있는 키이고 설정 창이 그리는 키
//   ③ 합친 고르기(segMulti — 켬/끔 + 고르기 두 줄을 하나로)가 쓰는 키 · 값은 옛 스위치 · 고르기와 같은 키
//   ④ 자주 쓰는 10개 설정은 「고급」에 넣지 않아요(누르는 횟수가 늘지 않게)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const imp = f => import(pathToFileURL(path.join(root, f)).href);
const { DEFAULTS } = await imp('src/settings.js');
const { ADVANCED } = await imp('src/settings-advanced.js');
const panel = fs.readFileSync(path.join(root, 'src/panel.js'), 'utf8');
const markup = panel + fs.readFileSync(path.join(root, 'src/scene-sound-ui.js'), 'utf8');

const keys = []; const walk = (o, p) => { for (const [k, v] of Object.entries(o)) { const q = p ? `${p}.${k}` : k; if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) walk(v, q); else keys.push(q); } };
walk(DEFAULTS, '');
const snap = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/settings-keys-1000.json'), 'utf8')).keys;
const added = keys.filter(k => !snap.includes(k)), removed = snap.filter(k => !keys.includes(k));
assert.deepEqual({ added, removed }, { added: [], removed: [] }, '① 설정 키가 바뀌었어요 — 옛 설정이 이어지게 옮기기를 넣고 고정 목록을 같이 고쳐요');

const { SETTING_LABELS } = await imp('src/settings-labels.js');
// 있는 키: 기본값 표에 있거나(정리 함수가 채우는 선택 키는) 되돌리기 · 변경한 설정 이름표(SETTING_LABELS)에 있는 키
const has = p => { if (SETTING_LABELS[p]) return true; let o = DEFAULTS; for (const k of p.split('.')) { if (o == null || !(k in o)) return false; o = o[k]; } return true; };
let advKeys = 0;
for (const [route, list] of Object.entries(ADVANCED)) for (const spec of list) {
    if (/^(group|sel|color):/.test(spec)) continue;
    advKeys++;
    assert.ok(has(spec) || spec.startsWith('st.') || /^(chat\.(qr|weather)|sceneSound\.)/.test(spec), `② ${route}: 고급 키 ${spec} 가 설정에 없어요`);
    assert.ok(markup.includes(`'${spec}'`) || markup.includes(`\`\${prefix}.${spec.split('.').pop()}\``) || (/^(profile|userProfile|image)\./.test(spec) && /frameControls\('image'|nameControls\(s, 'userProfile'\)/.test(markup)) || markup.includes(`'${spec.split('.').slice(1).join('.')}'`), `② ${route}: 설정 창이 ${spec} 를 그려야 해요`);
}
let merged = 0;
for (const m of panel.matchAll(/segMulti\('([\w.]+)', (\[[\s\S]*?\]\]), /g)) {
    merged++;
    assert.ok(has(m[1]), `③ 합친 고르기 대표 키 ${m[1]}`);
    for (const k of m[2].matchAll(/'([\w]+\.[\w.]+)': /g)) assert.ok(has(k[1]), `③ 합친 고르기가 쓰는 ${k[1]} 는 있는 키여야 해요`);
}
assert.ok(merged >= 5, '③ 합친 고르기 5곳(취소선 선 · 백그라운드 · 프롬프트 색 · 적힌 글자색 · 감정 대사 효과)');
assert.match(panel, /case 'seg-multi': \{[\s\S]*?update\(st => \{ for \(const \[path, value\] of Object\.entries\(sets\)\) setPath\(st, path, value\); \}\);/, '③ 누르면 그 키들을 한 번에(되돌리기 한 단계)');
const FREQUENT = ['palette', 'nightTint', 'lightTint', 'fonts.text', 'type.size', 'type.lineHeight', 'type.measure', 'chat.userSize', 'addons.translator', 'addons.tts', 'addons.bookmarks'];
for (const k of FREQUENT) for (const [route, list] of Object.entries(ADVANCED)) assert.ok(!list.includes(k) && !list.some(s => s.startsWith(k + '.')), `④ 자주 쓰는 ${k} 가 ${route} 고급에 들어가면 안 돼요`);
// ⑤ 중복 정리(10-31 사용자 「중복인 건 다 지워」): 걷은 줄은 다시 그리지 않고, 그 키 · 옛 화면 id 는 남은 쪽으로 데려가요(키 · 값은 그대로 — ① 이 지켜요)
const { settingRoute, TEXT_TOKEN_ROUTE } = await imp('src/settings-differences.js');
for (const gone of ["toggle('deus.weather'", "['fade', '흐림']", "toggle('chat.helpMarks'"]) assert.ok(!panel.includes(gone), `⑤ 걷은 줄이 다시 생겼어요: ${gone}`);
assert.match(panel, /const GONE_SUBS = \{ image: \{ fade: 'shape' \} \};/, '⑤ 옛 화면 id image/fade → 모양');
assert.match(panel, /if \(GONE_SUBS\[entry\.tab\]\?\.\[entry\.sub\]\) entry = /, '⑤ 검색 · 즐겨찾기로 옛 화면에 오면 남은 화면으로');
assert.match(panel, /\$\{row\('흰 배경 지우기', toggle\('image\.blendWhite'/, '⑤ 흰 배경 지우기는 「모양」 화면에');
assert.deepEqual(settingRoute('image.blendWhite'), { tab: 'image', sub: 'shape' });
assert.deepEqual(settingRoute('chat.emptyGuard'), { tab: 'chat', sub: 'etc' }, '⑤ 빈 채팅 막기는 성능 보조를 꺼도 쓰여 채팅 › 기타에 남겨요');
for (const [t, r] of Object.entries(TEXT_TOKEN_ROUTE)) assert.deepEqual(settingRoute(`colorOverrides.night.${t}`), r, `⑤ ${t} 색은 글자 모양 화면으로`);
assert.deepEqual(settingRoute('colorOverrides.night.bg'), { tab: 'theme', sub: 'colors' }, '⑤ 바탕색은 색 고치기 그대로');
assert.match(panel, /list\.filter\(\(\[key\]\) => !TEXT_SCREEN_TOKENS\.has\(key\)\)/, '⑤ 색 고치기에서 글자 모양 색을 빼요');
const bm = fs.readFileSync(path.join(root, 'src/addons/bookmarks/settings-view.js'), 'utf8'), as = fs.readFileSync(path.join(root, 'src/addons/assets/panel.js'), 'utf8');
assert.ok(!bm.includes('cg-section-fold') && /data-act="guide"/.test(bm) && /openHelpSheet\(\{ title: '북마크 사용법', html \}\)/.test(bm), '⑤ 북마크 「사용법」 펼침 → 설정 머리 ? (같은 글, 공용 도움말 창)');
assert.match(as, /<section class="eh-card" hidden data-guide-source>/, '⑤ 에셋 「사용법」 펼침은 숨기고 판 알약 사용방법 창의 글 원본으로만');
console.log(`설정창 간단화 검사를 통과했어요(설정 키 ${keys.length}개 그대로 · 고급 키 ${advKeys} · 합친 고르기 ${merged}).`);
