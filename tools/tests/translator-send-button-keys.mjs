// 1.0.2 입력줄 번역 단추(💬) · 번역 수정 창 「원문 같이 보기」 단추의 키보드 누르기.
//   실리태번은 문서 전체에서 Enter 를 받아, 초점 둔 .interactable 을 한 번 더 눌러요(public/scripts/keyboard.js handleGlobalKeyDown).
//   단추가 Enter 를 스스로 처리하고 위로 올려보내면 한 번에 두 번 눌려(켜졌다 꺼짐 · 펴졌다 접힘) 아무 일도 안 일어난 것처럼 보였어요.
//   여기서는 그 전역 처리를 흉내 낸 작은 가짜 문서로 「Enter · Space · 누르기가 각각 한 번씩만」을 봐요. 화면 · 리그 없이 돌아요.
//   node tools/tests/translator-send-button-keys.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
const sendform = fs.readFileSync(path.join(root, 'src/addons/translator/sendform.html'), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

/** 소스에서 `function 이름(` 부터 맨 앞 칸의 닫는 중괄호까지 */
function fnSource(name) {
    const start = src.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} 를 찾지 못했어요`);
    const end = src.indexOf('\n}\n', start);
    assert.ok(end > start, `${name} 끝을 찾지 못했어요`);
    return src.slice(start, end + 2);
}

// ── 아주 작은 가짜 문서: 요소 → 문서 차례로 올라가는 사건 전파 · 실리태번 전역 Enter 처리
function makeDoc() {
    const docListeners = [];
    const doc = { addEventListener: (type, fn) => docListeners.push([type, fn]) };
    function element(classes = []) {
        const listeners = [];
        const attrs = new Map();
        const classSet = new Set(classes);
        const el = {
            dataset: {},
            title: '',
            classList: { contains: c => classSet.has(c), toggle: (c, on) => { (on ?? !classSet.has(c)) ? classSet.add(c) : classSet.delete(c); } },
            setAttribute: (k, v) => attrs.set(k, String(v)),
            getAttribute: k => (attrs.has(k) ? attrs.get(k) : null),
            removeAttribute: k => attrs.delete(k),
            addEventListener: (type, fn) => listeners.push([type, fn]),
            dispatch(type, init = {}) {
                let stopped = false;
                const event = { type, target: el, defaultPrevented: false, ...init, preventDefault() { event.defaultPrevented = true; }, stopPropagation() { stopped = true; } };
                for (const [t, fn] of listeners) if (t === type) fn(event);
                if (!stopped) for (const [t, fn] of docListeners) if (t === type) fn(event);
                return event;
            },
            click() { el.dispatch('click'); },
        };
        return el;
    }
    // keyboard.js 와 같은 판단: 꾸밈 키 없는 Enter 면 초점 둔 .interactable 을 누름
    doc.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.altKey || event.ctrlKey || event.shiftKey) return;
        if (event.target?.classList?.contains('interactable')) event.target.click();
    });
    return { doc, element };
}

function bindWith(source) {
    const calls = { toggle: 0, now: 0 };
    // eslint-disable-next-line no-new-func
    const bind = new Function('toggleSendTranslate', 'onTranslateInputMessageClick', 'navigator', 'setTimeout', 'clearTimeout',
        `${source}\nreturn bindSendButton;`)(() => { calls.toggle++; }, () => { calls.now++; }, {}, () => 0, () => {});
    const { element } = makeDoc();
    const btn = element(['interactable']);
    bind(btn);
    return { btn, calls };
}

const bindSource = fnSource('bindSendButton');

check('가짜 문서가 예전 버그를 실제로 재현해요(전파를 멈추지 않으면 Enter 한 번에 두 번)', () => {
    const old = bindSource.replace(/\n\s*e\.stopPropagation\(\);/, '');
    assert.notEqual(old, bindSource, '시험 대상에 stopPropagation 이 없어요');
    const { btn, calls } = bindWith(old);
    btn.dispatch('keydown', { key: 'Enter' });
    assert.equal(calls.toggle, 2);
});

check('입력줄 💬 단추: Enter 한 번 = 켜고 끄기 한 번', () => {
    const { btn, calls } = bindWith(bindSource);
    const event = btn.dispatch('keydown', { key: 'Enter' });
    assert.equal(calls.toggle, 1);
    assert.equal(event.defaultPrevented, true);
});

check('입력줄 💬 단추: Space 한 번 = 한 번 · 다른 키는 그대로 지나가요', () => {
    const { btn, calls } = bindWith(bindSource);
    btn.dispatch('keydown', { key: ' ' });
    assert.equal(calls.toggle, 1);
    const other = btn.dispatch('keydown', { key: 'a' });
    assert.equal(calls.toggle, 1);
    assert.equal(other.defaultPrevented, false);
});

check('입력줄 💬 단추: 마우스 · 손가락 누르기는 예전처럼 한 번', () => {
    const { btn, calls } = bindWith(bindSource);
    btn.click();
    assert.equal(calls.toggle, 1);
    assert.equal(calls.now, 0);
    assert.equal(btn.getAttribute('role'), 'button');
});

check('번역 중 표시: is-busy 와 aria-busy 가 같이 붙고 같이 떨어져요', () => {
    const { element } = makeDoc();
    const btn = element(['interactable']);
    // eslint-disable-next-line no-new-func
    const setBusy = new Function('document', `${fnSource('setSendButtonBusy')}\nreturn setSendButtonBusy;`)({ getElementById: id => (id === 'llm_translate_input_button' ? btn : null) });
    setBusy(true);
    assert.equal(btn.classList.contains('is-busy'), true);
    assert.equal(btn.getAttribute('aria-busy'), 'true');
    setBusy(false);
    assert.equal(btn.classList.contains('is-busy'), false);
    assert.equal(btn.getAttribute('aria-busy'), null);
    // 단추가 없을 때(설정에서 숨김)도 오류 없이 지나가요
    new Function('document', `${fnSource('setSendButtonBusy')}\nreturn setSendButtonBusy;`)({ getElementById: () => null })(true);
});

check('번역 수정 창 「원문 같이 보기」: 처리한 Enter · Space 는 전역으로 올려보내지 않아요', () => {
    const line = src.split('\n').find(l => l.includes("sourceButton.on('click', flipSource)"));
    assert.ok(line, '원문 같이 보기 단추 묶기를 찾지 못했어요');
    assert.match(line, /\.on\('keydown'[^]*event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*flipSource\(\)/);
});

check('입력줄 💬 아이콘은 화면 읽기에서 숨겨요(이름은 단추 title 이 맡아요)', () => {
    assert.match(sendform, /<i class="fa-solid fa-comment-dots" aria-hidden="true"><\/i>/);
});

console.log(`translator-send-button-keys: ${passed}개 통과`);
