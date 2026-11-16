// 버그 사냥 2차: 「에셋 그림 떼기」를 같은 글에 두 번 하면(뗀 뒤 새 {{img::}} 가 생김 — 이어 쓰기 · 일부만 되살림) 표식 번호가 img-1 부터 다시 시작해
//   같은 번호가 둘이 되고, 숨겨 둔 원문 태그 기록이 새 태그로 덮였어요(되살리면 두 자리가 같은 그림). 가상 글만.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const imp = rel => import(pathToFileURL(path.join(root, rel)));
const strip = await imp('src/addons/assets/strip-chat.js');
const slots = await imp('src/addons/assets/slots.js');

const first = strip.stripText('가 {{img::A.png}} 나');
assert.deepEqual(first.tags, [{ id: 'img-1', tag: '{{img::A.png}}' }]);
// 뗀 글 뒤에 새 태그가 붙음 → 다시 떼기
const second = strip.stripText(first.text + '\n\n{{img::B.png}}');
assert.equal(second.tags.length, 1);
assert.notEqual(second.tags[0].id, 'img-1', '이미 쓰인 번호를 다시 쓰지 않아요');
assert.equal(second.tags[0].id, 'img-2');
const ids = [...second.text.matchAll(/img-\d+/g)].map(m => m[0]);
assert.equal(new Set(ids).size, ids.length, '한 글 안의 뗀 표식 번호는 겹치지 않아요');
// 번호가 건너뛴 글(img-3 만 남음)도 그 뒤부터
const third = strip.stripText(slots.goneMarkup('img-3') + ' {{img::C.png}} {{img::D.png}}');
assert.deepEqual(third.tags.map(t => t.id), ['img-4', 'img-5']);
// 처음 떼는 글은 예전 그대로 1 부터
assert.deepEqual(strip.stripText('{{img::A.png}} {{img::B.png}}').tags.map(t => t.id), ['img-1', 'img-2']);
console.log('통과: 다시 떼도 표식 번호가 겹치지 않아요');
