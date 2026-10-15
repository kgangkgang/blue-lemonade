// 과일 계열 프리셋의 본문 감싸기 태그(<content>) 바로 뒤 줄바꿈이 <br><br> 로 바뀌어 첫 문단 앞에 빈 두 줄이 생기던 것을
// 테마 CSS 가 숨기는지 (css 모듈과 빌드된 style.css 양쪽) 확인한다. 사용법: node tools/tests/fruit-content-gap.mjs <theme root>
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const SELECTOR = 'body.salty #chat .mes .mes_text content > br:first-child';
const SIBLING = 'body.salty #chat .mes .mes_text content > br:first-child + br';
let failures = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok' : 'FAIL'} - ${name}`); if (!ok) failures++; };

const module06 = read('css/06-chat-text.css');
check('css/06-chat-text.css hides the first <br> inside <content>', module06.includes(SELECTOR));
check('css/06-chat-text.css hides the second <br> inside <content>', module06.includes(SIBLING));
const rule = module06.slice(module06.indexOf(SELECTOR));
check('the rule only hides (display: none), nothing else', /^[^{]*\{\s*display:\s*none;?\s*\}/.test(rule));

const built = read('style.css');
const compact = built.replace(/\s+/g, ' ');
check('style.css carries the rule after build-css', compact.includes('content > br:first-child') && compact.includes('content > br:first-child + br'));

// 흉내: showdown 이 만드는 첫 문단 (<p><content><br><br>본문</content></p>) 에서 선택자가 br 두 개만 고르는지 (간단한 트리 모형)
const tree = { tag: 'p', children: [{ tag: 'content', children: [{ tag: 'br' }, { tag: 'br' }, { text: '본문' }, { tag: 'br' }] }] };
const content = tree.children[0];
const elements = content.children.filter(n => n.tag);
const hidden = elements.filter((n, i) => n.tag === 'br' && (i === 0 || (i === 1 && elements[0].tag === 'br')));
check('model: exactly the two leading <br> are hidden, the later one stays', hidden.length === 2 && elements[2].tag === 'br');

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('fruit-content-gap: all checks passed');
