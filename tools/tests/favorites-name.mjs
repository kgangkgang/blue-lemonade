// 즐겨찾기 줄 이름표 (src/layout.js refreshFavorites, hunt-world 10-30) — 실리태번 buildAvatarList 는 그룹 칸의 그림을 콜라주(#group_avatars_template, alt 「img1」…)나
// alt 없는 그림(그룹 사진 avatar_url)으로 바꿔 끼우고 title 만 「[Group] 이름」으로 둔다. 그림 alt 를 먼저 읽던 이름표가 「img1」 · 「[Group] 이름」으로 보였다(리그 실측 「img1」).
// 이 시험은 layout.js 의 이름 읽는 줄을 그대로 떼어 실리태번이 만드는 네 가지 칸에 돌린다.
//   node tools/tests/favorites-name.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

const js = fs.readFileSync(path.join(root, 'src/layout.js'), 'utf8');
const body = js.match(/for \(const avatar of avatars\) \{\n([\s\S]*?)\n\s*let label = avatar\.querySelector\('\.bl-fav-name'\);/);
assert.ok(body, 'refreshFavorites 의 이름 읽는 부분');
const nameOf = new Function('avatar', `${body[1]}\nreturn name;`);
// 실리태번 1.19 buildAvatarList 가 만드는 칸 (script.js) — title · data-type · 안의 그림 alt
const tile = (type, title, imgs) => ({ title, dataset: { type }, querySelector: sel => (sel === 'img' ? (imgs[0] ? { alt: imgs[0] } : null) : null) });

t('캐릭터: 그림 alt(캐릭터 이름) 그대로', () => assert.equal(nameOf(tile('character', '[Character] 하늘 🌙 아주아주 긴 이름\nFile: a.png', ['하늘 🌙 아주아주 긴 이름'])), '하늘 🌙 아주아주 긴 이름'));
t('페르소나: 그림 alt', () => assert.equal(nameOf(tile('persona', '[Persona] 나\nFile: p.png', ['나'])), '나'));
t('그룹(멤버 콜라주 — alt img1): 그룹 이름', () => assert.equal(nameOf(tile('group', '[Group] 시험 모임', ['img1', 'img2'])), '시험 모임'));
t('그룹(그룹 사진 — alt 없음): 앞머리 [Group] 없이 그룹 이름', () => assert.equal(nameOf(tile('group', '[Group] 시험 모임', [''])), '시험 모임'));
t('그룹(멤버가 다 지워져 그림 없음): 그룹 이름', () => assert.equal(nameOf(tile('group', '[Group] 빈 모임', [])), '빈 모임'));
t('이름에 대괄호가 있어도 앞머리만 뗀다', () => assert.equal(nameOf(tile('group', '[Group] [AU] 모임', ['img1'])), '[AU] 모임'));
console.log(`PASS favorites-name: ${n} checks`);
