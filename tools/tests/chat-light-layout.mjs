// 긴 채팅 가볍게(src/chat-light.js) — 미리 그리기(warm) · 서랍 덮개(show) 길에 「DOM 에 쓴 뒤 같은 작업 안에서 자리 · 크기 · 계산된 스타일을 읽는 일」
//   (강제 배치)이 없는지 정적으로 본다. node tools/tests/chat-light-layout.mjs <테마 루트>
// 왜(9.0.3): 성능 관문 폰 4배 프로파일에서 이 모듈이 테마 몫 1위(1,172ms)였고, 그중 stepWarm 673+143ms 는 표식을 단 뒤 `void el.offsetHeight`,
//   show 157+184ms 는 덮개 class 를 뺀 뒤 scrollHeight · scrollTop 읽기 — 둘 다 쓰기 뒤 동기 읽기라 그 자리에서 스타일 · 배치를 끝냈어요(타이핑 · 토글 장면에 끼어듦).
// 규칙:
//   ① 배치 읽기는 정해 둔 함수(READERS)에만 — 그 밖의 모든 코드(함수 · 콜백 · 맨 위)에는 배치 읽기가 하나도 없다.
//   ② READERS 안에서는 읽기가 모두 첫 쓰기보다 앞선다(읽기 → 쓰기).
//   ③ READERS 는 배치가 끝난 뒤에만 불린다 — restoreScroll · evaluate 는 afterLayout( … ) 콜백 안에서만, hide · drawerCoversChat 은 evaluate 안에서만,
//      chatViewRect 는 drawerCoversChat 안에서만. afterLayout 은 ResizeObserver 첫 알림(배치 뒤 · 칠하기 전)을 쓴다.
//   ④ 검사기 자신이 옛 꼴(8.2.4 show · 아무 데서나 하는 강제 배치)을 잡아내는지 먼저 본다(헛통과 막기).
//   ⑤ (1.0.0 scroll-919) 예외 하나: 미리 그리기 묶음(stepWarm)은 표식을 단 뒤 `void el.offsetHeight;` 한 번으로 그 낮은 우선순위 작업 안에서 배치를 끝낸다(WARM_FLUSH).
//      9.0.3 은 이것을 빼고 표식을 rAF 에 달았는데, 이 테마는 표식이 바뀐 프레임마다 칠하기(폰 4배 Paint 30~160ms)가 붙어 묶음마다 따로 칠했고,
//      리그 폰 4배 쉬는 동안 4초에 35개(긴 작업 34개)만 풀려 관문 스크롤 50ms 넘는 프레임이 0 → 22 가 됐어요. 그래서 그 한 줄만 허용하고 —
//      stepWarm 안 다른 읽기 · 두 번째 읽기, stepWarm 을 rAF · 리스너 · 타이머에서 부르기(bgTask 로만)는 여전히 잡아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/chat-light.js'), 'utf8').replace(/\r\n/g, '\n');

// ---------------------------------------------------------------- 검사기
/** 주석을 빈칸으로, 따옴표 글의 속을 빈칸으로(길이는 그대로 — 자리 번호가 맞게). 정규식 글자 안에는 따옴표 · // 가 없다고 본다(아래 ④에서 함수를 찾는지로 확인) */
function strip(src) {
    let out = '', i = 0;
    while (i < src.length) {
        const c = src[i], d = src[i + 1];
        if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
        if (c === '/' && d === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; continue; }
        if (c === '"' || c === "'" || c === '`') {
            out += c; i++;
            while (i < src.length && src[i] !== c) { if (src[i] === '\\') { out += '  '; i += 2; continue; } out += src[i] === '\n' ? '\n' : ' '; i++; }
            out += c; i++; continue;
        }
        out += c; i++;
    }
    return out;
}
const READ_RES = [
    /\.(?:offset(?:Top|Left|Width|Height|Parent)|client(?:Top|Left|Width|Height)|scroll(?:Width|Height)|innerText)\b/g,
    /\.scroll(?:Top|Left)\b(?!\s*=(?!=))/g,
    /\b(?:getBoundingClientRect|getClientRects|getComputedStyle|scrollIntoView|elementFromPoint|checkVisibility)\s*\(/g,
    /\.focus\s*\(/g,
    /\binner(?:Width|Height)\b/g,
];
const WRITE_RES = [
    /\.(?:setAttribute|removeAttribute|toggleAttribute|dispatchEvent|appendChild|insertBefore|removeChild|replaceChildren|replaceWith|prepend|append)\s*\(/g,
    /\.classList\.(?:add|remove|toggle|replace)\s*\(/g,
    /\.scroll(?:Top|Left)\s*=(?!=)/g,
    /\.style\.[\w$]+\s*=(?!=)|\.style\.setProperty\s*\(/g,
    /\.(?:innerHTML|textContent|className)\s*=(?!=)|\.dataset\.[\w$]+\s*=(?!=)/g,
];
const hits = (code, res, base = 0) => res.flatMap(re => [...code.matchAll(re)].map(m => ({ at: base + m.index, text: m[0] })));
function matchClose(code, open) {   // open 자리의 ( 또는 { 와 짝인 닫는 자리
    const pair = { '(': ')', '{': '}' }[code[open]]; let depth = 0;
    for (let i = open; i < code.length; i++) { if (code[i] === code[open]) depth++; else if (code[i] === pair && --depth === 0) return i; }
    return -1;
}
/** function NAME( … ) { … } 의 몸통 [시작, 끝] */
function functionBody(code, name) {
    const m = new RegExp('\\bfunction\\s+' + name + '\\s*\\(').exec(code);
    if (!m) return null;
    const paramsOpen = m.index + m[0].length - 1;
    const open = code.indexOf('{', matchClose(code, paramsOpen));
    return { start: open, end: matchClose(code, open), def: m.index };
}
/** pos 가 이름이 callee 인 호출의 괄호 안에 있나 */
function insideCall(code, pos, callee) {
    for (const m of code.matchAll(new RegExp('\\b' + callee + '\\s*\\(', 'g'))) {
        if (/function\s+$/.test(code.slice(Math.max(0, m.index - 12), m.index))) continue;
        const open = m.index + m[0].length - 1, close = matchClose(code, open);
        if (open < pos && pos < close) return true;
    }
    return false;
}
const lineOf = (code, at) => code.slice(0, at).split('\n').length;

const READERS = ['restoreScroll', 'hide', 'evaluate', 'drawerCoversChat', 'chatViewRect'];
// ⑤ 미리 그리기 묶음의 배치 끝내기 — 이 함수 안의 이 한 줄만, 한 번만. 그 함수는 scheduler( 로만 넘긴다
const WARM_FLUSH = { fn: 'stepWarm', statement: /\bvoid el\.offsetHeight;/g, scheduler: 'bgTask' };
const CALLED_ONLY_IN = { restoreScroll: { call: 'afterLayout' }, evaluate: { call: 'afterLayout' }, hide: { fn: 'evaluate' }, drawerCoversChat: { fn: 'evaluate' }, chatViewRect: { fn: 'drawerCoversChat' } };
/** 규칙 ①~③ 위반 목록 */
function check(src, { readers = READERS, calledOnlyIn = CALLED_ONLY_IN, flush = WARM_FLUSH } = {}) {
    let code = strip(src.replace(/\r\n/g, '\n'));
    const problems = [];
    // ⑤ 허용한 한 줄은 빈칸으로(①이 세지 않게, 자리 번호는 그대로) — 두 번째부터는 남겨 ①이 잡게 · 그 함수는 scheduler( 로만
    const fb = flush && functionBody(code, flush.fn);
    if (fb) {
        const found = [...code.slice(fb.start, fb.end + 1).matchAll(flush.statement)];
        if (found.length > 1) problems.push(`⑤ ${flush.fn} 에 배치 끝내기가 ${found.length}번 — 한 묶음에 한 번만`);
        if (found.length) { const at = fb.start + found[0].index; code = code.slice(0, at) + ' '.repeat(found[0][0].length) + code.slice(at + found[0][0].length); }
        for (const m of code.matchAll(new RegExp('\\b' + flush.fn + '\\b', 'g'))) {
            if (/function\s+$/.test(code.slice(Math.max(0, m.index - 12), m.index))) continue;
            const lineStart = code.lastIndexOf('\n', m.index) + 1, before = code.slice(lineStart, m.index);
            if (/^export const _\w+ = /.test(before) || /^\s+stop: \w+, step: $/.test(before)) continue;   // 시험용 내보내기
            if (code.slice(Math.max(0, m.index - flush.scheduler.length - 1), m.index) === flush.scheduler + '(' && code[m.index + flush.fn.length] === ')') continue;
            problems.push(`⑤ ${lineOf(code, m.index)}행: ${flush.fn} 를 ${flush.scheduler}( 밖에서 넘기거나 불러요 — 배치를 끝내는 묶음은 낮은 우선순위 작업에서만`);
        }
    }
    const bodies = new Map();
    for (const name of readers) { const b = functionBody(code, name); if (b) bodies.set(name, b); }
    // ① READERS 몸통을 지운 나머지에는 배치 읽기가 없다
    let rest = code;
    for (const b of bodies.values()) rest = rest.slice(0, b.start) + ' '.repeat(b.end - b.start + 1) + rest.slice(b.end + 1);
    for (const h of hits(rest, READ_RES)) problems.push(`① ${lineOf(code, h.at)}행: 배치를 읽어요(${h.text.trim()}) — 정해 둔 읽기 함수(${readers.join(' · ')}) 밖`);
    // ② READERS 안: 읽기가 모두 첫 쓰기 앞
    for (const [name, b] of bodies) {
        const body = code.slice(b.start, b.end + 1);
        const reads = hits(body, READ_RES, b.start), writes = hits(body, WRITE_RES, b.start);
        if (!writes.length) continue;
        const firstWrite = Math.min(...writes.map(w => w.at));
        for (const r of reads) if (r.at > firstWrite) problems.push(`② ${name} ${lineOf(code, r.at)}행: 쓰기(${lineOf(code, firstWrite)}행) 뒤에 읽어요(${r.text.trim()})`);
    }
    // ③ READERS 는 배치 뒤에서만
    for (const [name, where] of Object.entries(calledOnlyIn)) {
        for (const m of code.matchAll(new RegExp('\\b' + name + '\\s*\\(', 'g'))) {
            if (/function\s+$/.test(code.slice(Math.max(0, m.index - 12), m.index))) continue;
            const ok = where.call ? insideCall(code, m.index, where.call)
                : (() => { const b = bodies.get(where.fn) || functionBody(code, where.fn); return !!b && b.start < m.index && m.index < b.end; })();
            if (!ok) problems.push(`③ ${lineOf(code, m.index)}행: ${name}( 를 ${where.call ? where.call + '( 콜백' : where.fn} 밖에서 불러요`);
        }
        // 이름만 넘기기(setTimeout(evaluate, 0) 같은 콜백)도 안 돼요 — 시험용 내보내기(export const _이름 = { … }) 줄만 빼고
        for (const m of code.matchAll(new RegExp('\\b' + name + '\\b(?!\\s*\\()', 'g'))) {
            const lineStart = code.lastIndexOf('\n', m.index) + 1;
            if (/^export const _\w+ = /.test(code.slice(lineStart, m.index))) continue;
            problems.push(`③ ${lineOf(code, m.index)}행: ${name} 를 콜백으로 넘겨요 — ${where.call ? where.call + '( 콜백' : where.fn} 안에서 불러야 해요`);
        }
    }
    return { problems, bodies, code };
}

// ---------------------------------------------------------------- 시험
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log(`ok ${n + failed} - ${name}`); } catch (e) { failed++; console.log(`not ok ${n + failed} - ${name}\n  ${e.message}`); } };

test('검사기가 옛 꼴을 잡아요 — 묶음 밖의 void el.offsetHeight · class 를 뺀 뒤 scrollHeight 읽기(8.2.4 show) · 쓰기 뒤 읽기 · 아무 데서나 부른 읽기 함수', () => {
    const elsewhere = `function paintBatch() {\n    for (const mes of picked) mes.setAttribute(WARM_ATTR, '');\n    void el.offsetHeight;   // 'x'\n}`;
    assert.ok(check(elsewhere).problems.some(p => p.startsWith('①') && p.includes('offsetHeight')), check(elsewhere).problems.join('\n'));
    const oldShow = `function show(el) {\n    el.classList.remove(COVER_CLASS);\n    const want = saved.bottom ? el.scrollHeight - el.clientHeight : saved.top;\n    if (Math.abs(el.scrollTop - want) > 1) el.scrollTop = want;\n}`;
    const p2 = check(oldShow).problems;
    assert.ok(p2.some(p => p.includes('scrollHeight')) && p2.some(p => p.includes('clientHeight')), p2.join('\n'));
    const badReader = `function restoreScroll(el, s) {\n    el.scrollTop = 1;\n    const h = el.scrollHeight;\n}\nfunction afterLayout(el, fn) { fn(); }\nafterLayout(el, () => restoreScroll(el, s));`;
    assert.deepEqual(check(badReader).problems.map(p => p.slice(0, 1)), ['②']);
    const badCall = `function evaluate() { }\nfunction afterLayout(el, fn) { }\nsetTimeout(evaluate, 0);\nsetTimeout(() => evaluate(), 0);\nafterLayout(el, () => evaluate());`;
    assert.deepEqual(check(badCall).problems.map(p => p.slice(0, 1)), ['③', '③'], check(badCall).problems.join('\n'));
    const comments = `// el.offsetHeight 는 주석\nconst s = 'getBoundingClientRect(';\n/* el.scrollTop */`;
    assert.deepEqual(check(comments).problems, [], '주석 · 글자 속은 세지 않아요');
});
test('(1.0.0 scroll-919) ⑤ 묶음의 배치 끝내기는 stepWarm 안 한 줄 · 한 번만 — 다른 읽기 · 두 번째 읽기 · rAF · 타이머 · 리스너에서 부르기는 잡아요', () => {
    const ok = `const bgTask = fn => fn;\nfunction stepWarm() {\n    for (const mes of picked) mes.setAttribute(WARM_ATTR, '');\n    void el.offsetHeight;\n}\nwarm.job = bgTask(stepWarm);\nexport const _warm = { step: stepWarm };`;
    assert.deepEqual(check(ok).problems, [], check(ok).problems.join('\n'));
    const twice = ok.replace('void el.offsetHeight;\n', 'void el.offsetHeight;\n    void el.offsetHeight;\n');
    assert.ok(check(twice).problems.some(p => p.startsWith('⑤')) && check(twice).problems.some(p => p.startsWith('①')), check(twice).problems.join('\n'));
    const other = ok.replace('void el.offsetHeight;', 'void el.offsetHeight;\n    const r = mes.getBoundingClientRect();');
    assert.ok(check(other).problems.some(p => p.startsWith('①') && p.includes('getBoundingClientRect')), check(other).problems.join('\n'));
    for (const call of ['requestAnimationFrame(stepWarm);', 'raf(() => stepWarm());', 'setTimeout(stepWarm, 0);', "document.addEventListener('scroll', stepWarm);"]) {
        const bad = ok + '\n' + call;
        assert.ok(check(bad).problems.some(p => p.startsWith('⑤')), call + ' → ' + check(bad).problems.join('\n'));
    }
});
test('src/chat-light.js 에 미리 그리기 · 덮개 함수가 있어요(검사가 빈 파일을 통과시키지 않게)', () => {
    const { code } = check(source);
    for (const name of ['kickWarm', 'startWarm', 'stepWarm', 'warmCandidates', 'findAnchor', 'coolOffscreen', 'show', 'hide', 'restoreScroll', 'evaluate', 'checkSoon', 'afterLayout'])
        assert.ok(functionBody(code, name), name + ' 함수가 없다');
});
test('① 정해 둔 읽기 함수 밖(미리 그리기 · 떼기 · 감시 콜백 · 맨 위)에는 자리 · 크기 · 계산된 스타일 읽기가 없어요', () => {
    const { problems } = check(source);
    const p = problems.filter(x => x.startsWith('①'));
    assert.deepEqual(p, [], p.join('\n'));
});
test('② 읽기 함수 안에서는 읽기를 먼저 모두 끝내고 쓴다(scrollTop · class 쓰기는 마지막)', () => {
    const { problems } = check(source);
    const p = problems.filter(x => x.startsWith('②'));
    assert.deepEqual(p, [], p.join('\n'));
});
test('③ 읽기 함수는 배치가 끝난 뒤(afterLayout 콜백 → evaluate → hide · drawerCoversChat)에서만 불러요', () => {
    const { problems } = check(source);
    const p = problems.filter(x => x.startsWith('③'));
    assert.deepEqual(p, [], p.join('\n'));
});
test('afterLayout 은 ResizeObserver 첫 알림(배치 뒤 · 칠하기 전)을 쓰고, 미리 그리기 표식은 stepWarm(낮은 우선순위 작업) · onReveal 에서만 · void 읽기는 stepWarm 의 한 줄뿐 · 쉬는 시간 콜백 없음', () => {
    const { code, problems } = check(source);
    assert.deepEqual(problems.filter(x => x.startsWith('⑤')), [], problems.join('\n'));
    const al = functionBody(code, 'afterLayout');
    assert.match(code.slice(al.start, al.end), /new ResizeObserver\(/);
    const raw = strip(source);
    const sw = functionBody(raw, 'stepWarm');
    const body = raw.slice(sw.start, sw.end);
    assert.match(body, /setAttribute\(WARM_ATTR/);
    assert.ok(body.indexOf('setAttribute(WARM_ATTR') < body.indexOf('void el.offsetHeight;'), '표식을 단 뒤에 배치를 끝낸다');
    assert.ok(body.indexOf('inputPending()') >= 0 && body.indexOf('inputPending()') < body.indexOf('setAttribute(WARM_ATTR'), '입력이 기다리면 달기 전에 미룬다');
    assert.match(raw, /warm\.job = bgTask\(stepWarm\)/, 'stepWarm 은 낮은 우선순위 작업으로');
    const setters = [...raw.matchAll(/setAttribute\(WARM_ATTR/g)].map(m => m.index);
    const reveal = functionBody(raw, 'onReveal');
    assert.ok(setters.every(at => (sw.start < at && at < sw.end) || (reveal.start < at && at < reveal.end)), '표식은 stepWarm · onReveal(크롬이 이미 그린 메시지) 에서만');
    assert.equal([...raw.matchAll(/\bvoid\s+[\w$.?]+\.(?:offset|client|scroll)/g)].length, 1, 'void 로 배치를 끝내는 곳은 stepWarm 한 줄뿐');
    assert.ok(!/requestIdleCallback\(/.test(code));
});
test('CI 에 등록돼 있어요', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/chat-light-layout\.mjs \./);
});
console.log(`chat-light-layout: ${n}/${n + failed} 통과`);
process.exit(failed ? 1 : 0);
