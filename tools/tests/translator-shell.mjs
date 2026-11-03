// 1.0.0 극한 최적화 — LLM 번역 껍데기(src/addons/translator/shell.js): 부팅 때는 껍데기만 받고 본체(index.js)는 처음 쓸 때 받아요.
//   껍데기가 베껴 쓰는 단추 표 · 단추 만들기 · 보이기 · 용어집 범위 함수는 본체와 글자까지 같아야 하고(한쪽만 고치면 화면이 달라져요),
//   본체는 껍데기가 쌓아 둔 사건을 제 리스너(listen)에만 넘기고, 다리(bridge.js)는 껍데기를 거쳐요. 글은 모두 지어낸 것.
//   node tools/tests/translator-shell.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); } };
const shell = read('src/addons/translator/shell.js'), index = read('src/addons/translator/index.js'), bridge = read('src/addons/translator/bridge.js');

/** 이름이 name 인 최상위 함수 · const 선언 글(중괄호 짝까지) */
function block(src, head) {
    const at = src.indexOf(head);
    assert.ok(at >= 0, `${head} 가 없어요`);
    let depth = 0, i = src.indexOf('{', at);
    for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; }
    return src.slice(at, i + 1).replace(/^[ 	]*\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();   // 설명 주석은 빼고 견줘요
}

test('베껴 쓴 글이 본체와 같아요: 단추 표 · 조각 · 붙이기 · 보이기 · 용어집 범위 · 이름 다리', () => {
    for (const head of ['const TRANSLATE_BUTTONS = [', 'function translateButtonsFragment()', 'const createTranslateButtons = (mesBlock) =>', 'function addButtonsToExistingMessages()',
        'function updateButtonVisibility(root = document)', 'function glossaryScopeKey()', 'function glossaryEntries()', 'function publishGlossaryNames()', 'function glossaryScopeKeys()', 'function activeGlossaryEntries(scopes = glossaryScopeKeys())']) {
        const a = block(shell, head);
        // 껍데기의 createTranslateButtons 는 번역 점검 표시(checkView.paintFromCache — 부팅 때는 아직 없는 모듈) 한 줄만 빼요
        const b = block(head.startsWith('const createTranslateButtons') ? index.replace(/\n\s*if \(typeof checkView !== 'undefined'\) checkView\.paintFromCache\(messageId\);[^\n]*/, '') : index, head);
        assert.equal(a, b, head);
    }
});
test('본체: 껍데기가 쌓아 둔 사건을 제 리스너에만 넘겨요(listen · renderCapture · replayEvent · clickButton) · 껍데기가 먼저 붙인 스타일 · ✦ 줄은 두 번 붙이지 않아요', () => {
    for (const type of ['USER_MESSAGE_RENDERED', 'MESSAGE_SENT', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED', 'CHARACTER_RENAMED']) assert.ok(index.includes(`listen(event_types.${type},`), type);
    assert.ok(index.includes('renderCapture = (type, messageId) => {') && index.includes('observeEventCompletion(eventSource, renderCapture,'));
    assert.ok(index.includes('export async function replayEvent(type, args = [])') && index.includes('export function clickButton(kind, messageId)'));
    assert.ok(index.includes("if (!document.getElementById('llm_translate_chat')) $('#translate_wand_container').append(buttonHtml);"));
    assert.ok(index.includes('if (!document.querySelector(\'link[href$="/addons/translator/style.css"]\')) $(\'head\').append(cssLink);'));
});
test('껍데기: 본체를 받기 전에 다리 자리(archive.v1)와 명령 자리를 지워요(본체의 단독 확장 판단) · press 문 · 부팅 때 본체가 필요한 조건', () => {
    assert.ok(shell.includes("if (globalThis[ARCHIVE]?.blShell) delete globalThis[ARCHIVE];"));
    assert.ok(shell.includes("SlashCommandParser.commands?.[name]?.blShell) delete SlashCommandParser.commands[name]"));
    assert.ok(shell.includes("onGate('press', () => ensureBody('처음 누름'))"));
    assert.ok(shell.includes('function needsBodyAtBoot()') && shell.includes("'번역 리모컨'") && shell.includes("'기본 번역 확장 알림'") && shell.includes("'TTS 화자 색 분석'"));
    assert.ok(!/globalThis\.__blLlmTranslatorLoaded\s*=/.test(shell), '단독 확장 표식을 껍데기가 세우지 않아요');
    const commands = [...index.matchAll(/^\s*name: '((?:Llm|llm)[A-Za-z]+)',/gm)].map(m => m[1]);
    for (const name of commands) assert.ok(shell.includes(`'${name}'`), `명령 자리 ${name}`);
});
test('다리(bridge.js)는 껍데기를 거쳐요 · 로더는 다리를 그대로 · TTS 껍데기가 부팅 때 본체를 받으면 번역기 본체도', () => {
    assert.ok(bridge.includes("from './shell.js'") && !bridge.includes("from './index.js'"));
    assert.ok(bridge.includes("await ensureBody('설정 열기');") && bridge.includes('if (bodyLoaded()) {'));
    assert.ok(read('src/addons.js').includes("import('./addons/translator/bridge.js');await module.ready;"));
    assert.ok(read('src/addons/tts/shell.js').includes("globalThis[Symbol.for('blue-lemonade.translator.shell')]?.ensureBody?.('TTS 화자 색 분석')"));
});

console.log(`translator-shell: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
