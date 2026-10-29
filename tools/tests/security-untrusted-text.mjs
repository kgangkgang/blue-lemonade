// 불러온 파일 · 모델 출력 · 이름에서 온 글이 화면에서 코드로 실행되거나, 남의 파일을 지우게 되지 않는지 (8.2.7 예측 점검 · 보안)
// 실행: node tools/tests/security-untrusted-text.mjs [사본 경로]
// 표준 무해 검사 글(<img src=x onerror=…>)만 써요. 「실행」되면 시험 안의 표식(hits)만 바뀌어요.
// 가짜 DOM: innerHTML 에 들어간 글을 브라우저처럼 태그 · 속성으로 나눠, on… 속성이 생기면 그 값을 시험 상자 안에서 돌려요(깨진 그림의 onerror 와 같은 뜻).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('PASS', name); };

const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|quot|apos|amp|lt|gt);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' }[e.toLowerCase()]);
/** 브라우저의 HTML 나누기를 흉내: 글자 자리의 < + 영문자만 태그, 따옴표 속성 안의 < 는 글자. 태그마다 { name, attrs } */
export function parseTags(html) {
    const tags = [], s = String(html);
    let i = 0;
    while ((i = s.indexOf('<', i)) >= 0) {
        const m = /^<([a-zA-Z][\w-]*)/.exec(s.slice(i, i + 64));
        if (!m) { i++; continue; }
        let j = i + m[0].length; const attrs = {};
        while (j < s.length) {
            while (/\s/.test(s[j])) j++;
            if (s[j] === '>') { j++; break; }
            if (s.startsWith('/>', j)) { j += 2; break; }
            if (s[j] === '/') { j++; continue; }
            let k = j; while (k < s.length && !/[\s=>/]/.test(s[k])) k++;
            const name = s.slice(j, k).toLowerCase(); j = k;
            while (/\s/.test(s[j])) j++;
            let value = '';
            if (s[j] === '=') {
                j++; while (/\s/.test(s[j])) j++;
                if (s[j] === '"' || s[j] === "'") { const q = s[j], end = s.indexOf(q, j + 1); value = s.slice(j + 1, end < 0 ? s.length : end); j = end < 0 ? s.length : end + 1; }
                else { let e = j; while (e < s.length && !/[\s>]/.test(s[e])) e++; value = s.slice(j, e); j = e; }
            }
            if (name && !(name in attrs)) attrs[name] = decode(value);
        }
        tags.push({ name: m[1].toLowerCase(), attrs });
        i = j;
    }
    return tags;
}
/** 가짜 innerHTML: 태그를 만들고, on… 속성은 상자 안에서 돌린다. 만든 태그 목록을 돌려준다 */
function fakeInnerHTML(html, box) {
    const tags = parseTags(html);
    for (const tag of tags) for (const [name, code] of Object.entries(tag.attrs)) if (name.startsWith('on')) vm.runInContext(code, box);
    return tags;
}
const PROBE = '<img src=x onerror="mark()">';
const ATTR_PROBE = 'x" onfocus="mark()" autofocus="';

/** 원본에서 이름으로 함수 · 상수 한 덩어리를 잘라 온다 (중괄호 짝) */
function slice(source, startText) {
    const start = source.indexOf(startText);
    assert.ok(start >= 0, `원본에서 못 찾음: ${startText}`);
    const first = source.slice(start, source.indexOf('\n', start)).trimEnd();
    if (!first.endsWith('{')) return first;   // 한 줄짜리 (const esc = … ;)
    let depth = 0, i = start + first.length - 1;   // 첫 줄 끝의 { 부터 (매개변수의 { } 는 건너뛰게)
    for (; i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}' && --depth === 0) break; }
    return source.slice(start, i + 1);
}

// ───────── 1. TTS 확인 창 (실리태번 callGenericPopup 은 글을 정화 없이 innerHTML 로 넣어요) ─────────
await t('TTS 확인 창: 캐릭터 · 목소리 이름 글이 태그로 실행되지 않고 글자로 보여요', async () => {
    const src = read('src/addons/tts/src/ui.js');
    const box = vm.createContext({ hits: 0, shown: [] });
    box.mark = () => { box.hits++; };
    box.callGenericPopup = async (content) => { box.shown.push(content); fakeInnerHTML(content, box); return 1; };
    box.POPUP_TYPE = { CONFIRM: 2 }; box.POPUP_RESULT = { AFFIRMATIVE: 1 };
    vm.runInContext(`${slice(src, 'const esc = (v)')}\n${slice(src, 'async function confirm(msg)')}\nthis.confirm = confirm;`, box);
    // 목소리 이름(외부 목록 · 붙여넣은 JSON)과 캐릭터 이름(모델 출력에서 배운 화자)이 들어가는 두 문장 모양 그대로
    assert.equal(await box.confirm(`「${PROBE}」 목소리를 목록에서 뺄까요?`), true, '확인 결과는 그대로');
    assert.equal(await box.confirm(`OpenAI 목소리 중 캐릭터와 이름이 맞는 게 1명 있어요 (${PROBE}, 하늘).`), true);
    assert.equal(box.hits, 0, '검사 글의 onerror 가 실행됐어요');
    for (const shown of box.shown) assert.ok(!parseTags(shown).some(tag => tag.name === 'img'), `그림 태그가 생겼어요: ${shown}`);
    assert.match(box.shown[0], /「&lt;img src=x onerror=&quot;mark\(\)&quot;&gt;」 목소리를 목록에서 뺄까요\?/, '보이는 글은 원래 글자 그대로');
    // 보통 문장은 모양이 같아요 (이스케이프할 글자가 없으면 그대로)
    await box.confirm('이 채팅의 대화 색을 모두 지울까요?');
    assert.equal(box.shown.at(-1), '이 채팅의 대화 색을 모두 지울까요?');
});
await t('TTS 내 목소리 묻기: 페르소나 이름이 태그로 실행되지 않아요 (실리태번은 페르소나 이름을 거르지 않아요)', async () => {
    const src = read('src/addons/tts/src/player.js');
    const box = vm.createContext({ hits: 0, shown: [], name1: PROBE });
    box.mark = () => { box.hits++; };
    box.callGenericPopup = async (content) => { box.shown.push(content); fakeInnerHTML(content, box); return 0; };
    Object.assign(box, {
        POPUP_TYPE: { TEXT: 1 }, POPUP_RESULT: { AFFIRMATIVE: 1 }, USER_AUTO: '@auto',
        settings: () => ({ user_voice: '', extras: 'on' }), getContext: () => ({ name1: box.name1 }),
        toastOnce() {}, personaKnown: () => false, ensureStock: async () => {}, extraEngine: () => 'x', setPersonaAuto() {},
    });
    vm.runInContext(`${slice(src, 'const escHtml = (v)')}\nlet askingPersona = null;\n${slice(src, 'export function askPersonaVoice').replace(/^export /, '')}\nthis.ask = askPersonaVoice;`, box);
    assert.equal(await box.ask(), false, '취소면 false 그대로');
    assert.equal(box.hits, 0, '페르소나 이름의 onerror 가 실행됐어요');
    assert.ok(!parseTags(box.shown[0]).some(tag => tag.name === 'img'), `그림 태그가 생겼어요: ${box.shown[0]}`);
    box.name1 = '레몬';
    await box.ask();
    assert.equal(box.shown.at(-1), '레몬(나) 대사도 자동 목소리로 읽을까요?', '보통 이름은 모양이 같아요');
});

console.log(`security-untrusted-text: ${n} passed`);
