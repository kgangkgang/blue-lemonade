// 한글화(src/addons/prompt/index.js) — 원작 Prompt Panel 1.2.0 검토에서 우리 판에도 있던 두 가지(우리 길로 새로 씀) · 실제 소스 줄을 떼어 돌려요.
//   ① 공유용 프리셋 JSON 내보내기: 빼는 연결 칸을 실리태번이 「연결 설정」으로 표시한 칸(settingsToUpdate 넷째 값 true)까지 넓혀요
//      (1.8.1 까지: 손으로 적은 목록만 빼서 siliconflow_endpoint · openrouter_quantizations · nanogpt_provider 같은 새 연결 칸이 파일에 남았어요)
//   ② 번역이 도는 동안 설정의 언어 칸을 바꾸면 되돌려요
//      (1.8.1 까지: 결과는 저장하는 그때의 언어 열쇠로 들어가서, 옛 언어로 받은 번역이 새 언어 칸에 저장됐어요)
//   node tools/tests/prompt-upstream-120.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const source = fs.readFileSync(path.join(root, 'src/addons/prompt/index.js'), 'utf8');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
/** `function 이름(` 부터 맨 앞 칸의 `}` 까지 떼요 */
const fnSource = name => {
    const at = source.indexOf(`function ${name}(`);
    assert.ok(at >= 0, `${name} 을 찾아요`);
    const end = source.indexOf('\n}\n', at);
    return source.slice(at, end + 2);
};

// ① 연결 칸
const listAt = source.indexOf('const PRESET_CONNECTION_KEYS');
assert.ok(listAt >= 0, '연결 칸 목록(PRESET_CONNECTION_KEYS)을 모듈 칸으로 꺼냈어요');
const listSrc = source.slice(listAt, source.indexOf('];', listAt) + 2);
const connectionKeys = new Function('stSettingsToUpdate', `${listSrc}\n${fnSource('presetConnectionKeys')}\nreturn presetConnectionKeys();`);
const stu = {
    temperature: ['#temp_openai', 'temp_openai', false, false],
    chat_completion_source: ['#chat_completion_source', 'chat_completion_source', false, true],
    siliconflow_endpoint: ['#siliconflow_endpoint', 'siliconflow_endpoint', false, true],
    openrouter_quantizations: ['#x', 'openrouter_quantizations', false, true],
    reverse_proxy: ['#openai_reverse_proxy', 'reverse_proxy', false, true],
    weird: 'not an array',
};
test('연결 칸: 실리태번이 연결로 표시한 칸을 더 빼요', () => {
    const keys = connectionKeys(stu);
    for (const k of ['siliconflow_endpoint', 'openrouter_quantizations', 'reverse_proxy', 'proxy_password', 'chat_completion_source']) assert.ok(keys.has(k), k);
});
test('연결 칸: 샘플러 같은 프리셋 칸은 그대로 둬요', () => {
    const keys = connectionKeys(stu);
    assert.ok(!keys.has('temperature') && !keys.has('temp_openai'));
});
test('연결 칸: 실리태번 목록을 못 읽으면 손으로 적은 목록만(예전과 같음)', () => {
    for (const bad of [undefined, null, 'x', []]) {
        const keys = connectionKeys(bad);
        assert.ok(keys.has('custom_url') && keys.has('proxy_password'));
        assert.ok(!keys.has('siliconflow_endpoint'));
    }
});
test('연결 칸: 내보내기가 이 목록으로 지워요', () => {
    const body = fnSource('exportPresetJSON');
    assert.match(body, /for \(const k of presetConnectionKeys\(\)\) delete cloned\[k\];/);
    assert.ok(!/const STRIP_KEYS/.test(body), '함수 안 옛 목록은 없어요');
});
test('연결 칸: 시작할 때 실리태번 목록을 받아 둬요', () => {
    assert.match(source, /stSettingsToUpdate\s*=\s*om\.settingsToUpdate/);
});

// ② 언어 칸 잠금
const guard = new Function('state', 'toastr', `let isBusy = state.busy; let langWarnAt = 0;\n${fnSource('langChangeBlocked')}\nreturn langChangeBlocked;`);
test('언어 칸: 번역이 안 돌면 바꿀 수 있어요', () => {
    const el = { value: 'Japanese' };
    assert.equal(guard({ busy: false }, undefined)(el, 'Korean'), false);
    assert.equal(el.value, 'Japanese');
});
test('언어 칸: 번역이 도는 동안엔 되돌리고 한 번 알려요', () => {
    const said = [];
    const blocked = guard({ busy: true }, { warning: m => said.push(m) });
    const el = { value: 'Japanese' };
    assert.equal(blocked(el, 'Korean'), true);
    assert.equal(el.value, 'Korean');
    el.value = 'Japanes';
    assert.equal(blocked(el, 'Korean'), true);
    assert.equal(said.length, 1, '타자마다 알림이 쌓이지 않아요');
});
test('언어 칸: 언어 칸 여섯(고르기 셋 · 직접 입력 셋)이 모두 막혀요', () => {
    for (const [id, key] of [['pt-target-lang', 'targetLang'], ['pt-custom-lang', 'customLang'], ['pt-title-lang', 'titleLang'], ['pt-custom-title-lang', 'titleCustomLang'], ['pt-note-lang', 'noteLang'], ['pt-custom-note-lang', 'noteCustomLang']]) {
        const at = source.indexOf(`$('#${id}').on(`);
        assert.ok(at >= 0, id);
        const head = source.slice(at, source.indexOf('\n', at) + 120);
        assert.ok(head.includes(`langChangeBlocked(this, cfg().${key})`), `${id} → ${key}`);
    }
});
console.log(`prompt-upstream-120: ${passed} 통과`);
