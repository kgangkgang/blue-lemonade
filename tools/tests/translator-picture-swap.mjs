// 7.9.5 그림 확장이 그림 표시만 바꾼 답 · 실리태번 1.16 호환 — DOM · 모델 요청 · 실제 채팅 없이 합성 글만
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/translator');
const { splitPictures, picturesOnlyChanged, swapPictures, PIC_REQUEST, AUTOPIC_REQUEST } = await import(pathToFileURL(path.join(dir, 'picture-swap.js')));
const { createGuards } = await import(pathToFileURL(path.join(dir, 'translation-guard.js')));
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

const pic = '<pic prompt="1girl, smiling, cafe > window seat">';
const img = '<img src="/user/images/a.png" data-autopic-id="tag-0-x" title="AutoPic">';
const before = `Rin looked up.\n\n${pic}\n\n"Hello," she said.`;
const tr = `린이 고개를 들었다.\n\n${pic}\n\n"안녕," 그녀가 말했다.`;

check('그림 요청 → 그림: 같은 자리만 바꾼다', () => {
    const after = before.replace(pic, img);
    assert.equal(picturesOnlyChanged(before, after), true);
    assert.equal(swapPictures(tr, before, after), tr.replace(pic, img));
});
check('그림 요청을 지운 답(글 사이 그림 모드): 번역문에서도 지운다', () => {
    const after = before.replace(pic, '').trim();
    assert.equal(swapPictures(tr, before, after), tr.replace(pic, ''));
});
check('글 끝에 덧붙인 그림: 같은 줄바꿈으로 끝에 붙인다', () => {
    const plain = 'Rin looked up.', plainTr = '린이 고개를 들었다.';
    assert.equal(swapPictures(plainTr, plain, `${plain}\n\n${img}`), `${plainTr}\n\n${img}`);
    assert.equal(swapPictures(plainTr, plain, `${img}\n${plain}`), `${img}\n${plainTr}`);
});
// 7.9.6 원본 그림 생성 확장의 기본 요청 블록 (여러 줄 · 안에 장면 · 인물 태그 · 속성에 > 가 든 ref)
const block = '<autopic>\n<scene>cafe, window seat, afternoon light</scene>\n<apchar ref="Rin">smiling, holding cup</apchar>\n<uc>blurry</uc>\n</autopic>';
const blockSrc = `Rin looked up.\n\n"Hello," she said.\n\n${block}`;
const blockTr = `린이 고개를 들었다.\n\n"안녕," 그녀가 말했다.\n\n${block}`;
check('<autopic> 블록 → 그림(REPLACE): 블록 자리만 바꾼다', () => {
    const after = blockSrc.replace(block, img);
    assert.equal(picturesOnlyChanged(blockSrc, after), true);
    assert.equal(swapPictures(blockTr, blockSrc, after), blockTr.replace(block, img));
});
check('<autopic> 블록 지움(INLINE, 그림은 메시지 아래): 번역문에서도 지운다', () => {
    const after = blockSrc.replace(block, '').trim();
    assert.equal(swapPictures(blockTr, blockSrc, after), blockTr.replace(block, ''));
});
check('<autopic> 블록은 번역 요청에서 통째로 가린다 (번역기 내장 규칙 = AUTOPIC_REQUEST)', () => {
    assert.deepEqual([...blockSrc.matchAll(new RegExp(AUTOPIC_REQUEST))].map(m => m[0]), [block]);
    const builtIn = source.split('\n').find(line => line.includes('picture-swap.js AUTOPIC_REQUEST 와 같은 꼴'));
    assert.ok(builtIn, '내장 보호 규칙에 그림 요청 블록');
    assert.equal(builtIn.trim().split(/\s+\/\/ /)[0].replace(/,$/, ''), `/${AUTOPIC_REQUEST.source}/gi`);
    // 블록 안 글이 바뀌면(번역됨) 그림 변경이 아니다 → 예전처럼 다시 번역
    assert.equal(swapPictures(blockTr.replace('cafe', '카페'), blockSrc, blockSrc.replace(block, img)), null);
});
check('그림 자리 span · {{img::}} 도 그림 표시', () => {
    const slot = '<span class="autopic-image-slot" data-autopic-slot="s1">[AutoPic 이미지]</span>';
    const a = `A.\n\n${slot}\n\nB.`, b = `A.\n\n{{img::x.png}}\n\nB.`;
    assert.equal(swapPictures(`가.\n\n${slot}\n\n나.`, a, b), '가.\n\n{{img::x.png}}\n\n나.');
});
check('여러 장: 순서대로 제자리', () => {
    const pic2 = '<pic prompt="2">', img2 = '<img src="b.png">';
    const a = `One.\n${pic}\nTwo.\n${pic2}\nThree.`, b = a.replace(pic, img).replace(pic2, img2);
    assert.equal(swapPictures(`하나.\n${pic}\n둘.\n${pic2}\n셋.`, a, b), `하나.\n${img}\n둘.\n${img2}\n셋.`);
});
check('글 가운데 새 그림 · 번역문에 없는 그림 표시 · 같은 표시 두 번 → null (전처럼 다시 번역)', () => {
    assert.equal(swapPictures('가. 나.', 'A. B.', `A. ${img} B.`), null);
    assert.equal(swapPictures('린이 고개를 들었다. "안녕."', before, before.replace(pic, img)), null);
    assert.equal(swapPictures(`${tr}\n${pic}`, before, before.replace(pic, img)), null);
});
check('글이 바뀌었거나 빈칸만 바뀐 것은 그림 변경이 아니다', () => {
    assert.equal(picturesOnlyChanged(before, before.replace('Rin', 'Mei').replace(pic, img)), false);
    assert.equal(picturesOnlyChanged('A.\n\nB.', 'A.\nB.'), false);
    assert.equal(picturesOnlyChanged(before, before), false);
    assert.equal(swapPictures(tr, before, before.replace('Rin', 'Mei')), null);
});
check('그림 요청 태그 가리기: 따옴표 안 > 까지 한 덩이', () => {
    const found = [...before.matchAll(new RegExp(PIC_REQUEST))].map(m => m[0]);
    assert.deepEqual(found, [pic]);
    assert.equal(splitPictures(before).marks.length, 1);
    const builtIn = source.split('\n').find(line => line.includes('picture-swap.js PIC_REQUEST 와 같은 꼴'));
    assert.ok(builtIn, '내장 보호 규칙에 그림 요청 태그');
    assert.equal(builtIn.trim().split(/\s+\/\/ /)[0].replace(/,$/, ''), `/${PIC_REQUEST.source}/gi`);
});

check('감시: sameText 를 준 것만 그림 변경을 같은 글로 본다', () => {
    const message = { mes: before, swipe_id: 0, extra: {} };
    const context = { chat: [message], chatId: 'c', characterId: 1, groupId: null };
    const guards = createGuards(() => context);
    const strict = guards.capture(message), loose = guards.capture(message, { sameText: picturesOnlyChanged });
    message.mes = before.replace(pic, img);
    assert.equal(strict.valid(), false);
    assert.equal(loose.valid(), true);
    assert.equal(loose.index(), 0);
    message.mes = before.replace('Rin', 'Mei');
    assert.equal(loose.valid(), false);
    assert.equal(loose.why().what, 'text');
});

function cut(name, prefix = 'function') {
    const start = source.indexOf(`\n${prefix} ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i + 1);
    }
    throw Error('unbalanced ' + name);
}

check('실리태번 1.16: getMax* 를 이름으로 가져오지 않고, 없으면 getMaxContextSize 로 같은 값', () => {
    const block = source.slice(0, source.indexOf("} from '../../../../../../../script.js';"));
    const named = block.slice(block.lastIndexOf('import {'));
    assert.doesNotMatch(named, /\bgetMax(?:Prompt|Context)Tokens\b/);
    const make = stHost => new Function('stHost', `${cut('getMaxPromptTokens')}\n${cut('getMaxContextTokens')}\nreturn { getMaxPromptTokens, getMaxContextTokens };`)(stHost);
    // 1.16 의 getMaxContextSize: openai = 문맥 − (덮어쓴 응답 길이 || 응답 길이)
    const v116 = make({ getMaxContextSize: (override = null) => 32000 - (typeof override === 'number' && override > 0 ? override : 800) });
    assert.equal(v116.getMaxContextTokens(), 32000);
    assert.equal(v116.getMaxPromptTokens(), 31200);
    assert.equal(v116.getMaxPromptTokens(1000), 31000);
    const v117 = make({ getMaxContextTokens: () => 64000, getMaxPromptTokens: (o = null) => 64000 - (o || 1000) });
    assert.equal(v117.getMaxContextTokens(), 64000);
    assert.equal(v117.getMaxPromptTokens(), 63000);
});

// 번역이 끝난 뒤 그림만 바뀐 MESSAGE_UPDATED: 다시 번역하지 않고 번역문 그림만
{
    const calls = { refresh: 0, save: 0, ui: 0, sync: 0 };
    const hash = text => `h${[...String(text)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)}`;
    const message = { mes: before, extra: {} };
    const env = {
        swapPictures, getContext: () => ({ saveChat: async () => { calls.save++; } }),
        processTranslationText: (original, text) => `[${text}]`, originalHashOf: hash,
        markTranslatedOriginal: (m, original) => { m.extra.original_text_hash = hash(original); },
        rememberTranslation: () => {}, isTranslationInProgress: () => false,
        refreshMessageBlock: () => { calls.refresh++; }, emitTranslationUIUpdate: () => { calls.ui++; }, syncMesToSwipe: () => { calls.sync++; },
    };
    const swap = new Function(...Object.keys(env), `const shownTranslations = new WeakMap();\n${cut('swapShownPictures', 'async function')}\nreturn { swapShownPictures, shownTranslations };`)(...Object.values(env));
    message.extra.display_text = `[${tr}]`; message.extra.original_text_hash = hash(before);
    swap.shownTranslations.set(message, { original: before, translation: tr, display: message.extra.display_text });
    const after = before.replace(pic, img);
    assert.equal(await swap.swapShownPictures(0, message, after), true);
    assert.equal(message.extra.display_text, `[${tr.replace(pic, img)}]`);
    assert.equal(message.extra.original_text_hash, hash(after));
    assert.deepEqual(calls, { refresh: 1, save: 1, ui: 1, sync: 1 });
    // 손으로 고친 번역문 · 원문 보기 중 · 글이 바뀐 수정은 손대지 않는다 (예전 길: 다시 번역)
    message.extra.display_text = '[고친 번역]';
    assert.equal(await swap.swapShownPictures(0, message, after.replace(img, '')), false);
    swap.shownTranslations.set(message, { original: after, translation: tr.replace(pic, img), display: message.extra.display_text });
    message.extra.original_translation_backup = 'x';
    assert.equal(await swap.swapShownPictures(0, message, after.replace(img, '')), false);
    delete message.extra.original_translation_backup;
    assert.equal(await swap.swapShownPictures(0, message, after.replace('Rin', 'Mei')), false);
    // handleMessageEdit 이 바뀐 글에서 이 길을 먼저 본다
    assert.match(cut('handleMessageEdit', 'async function'), /if \(changed && await swapShownPictures\(messageId, message, currentOriginalText\)\) return;/);
    passed++; console.log('ok 번역 뒤 그림 교체 (swapShownPictures)');
}
check('번역 중 그림 변경: 감시 완화 · 끝날 때 바꾸고 못 바꾸면 멈춤', () => {
    const body = cut('translateMessage', 'async function');
    assert.match(body, /beginTranslation\(messageId, message, \{ sameText: picturesOnlyChanged \}\)/);
    assert.match(body, /const swapped = swapPictures\(translation, originalText, nowOriginal\);\s+if \(swapped === null\) throw/);
    assert.match(body, /processTranslationText\(shownOriginal, translation\)/);
    assert.match(body, /markTranslatedOriginal\(target, shownOriginal\)/);
});
console.log(`translator-picture-swap: ${passed} 통과`);
