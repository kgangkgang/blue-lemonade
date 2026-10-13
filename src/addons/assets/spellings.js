// 6.3.x 캐릭터 에셋 — 그림 주인(파일 이름 앞머리)의 영 · 한 · 일 표기 줄. 고르는 모델이 일본어 · 한국어 이름도 같은 주인으로 보게.
// 이름 다리가 모르면 줄이 없다(빈 글 → 예전과 같은 프롬프트). 순수 함수 (시험: tools/tests/names-jp.mjs)
import { splitName } from './names.js';
import { nameAliases } from '../../name-aliases.js';

// 파일 이름은 글 처음 · ': ' · ', ' 다음에서만 (formatKeywordList 모양) — 빈칸 든 파일 이름('A B_smile.png')의 뒷조각을 주인으로 읽지 않게
const FILE = /(?<=^|[,:]\s*)[^\s,:]+\.(?:png|jpe?g|webp|gif|avif|bmp)/giu;

/** 그림 이름 목록 글 → 'Owner = 다른 표기 = …' 줄들 (다른 표기가 있는 주인만, 목록 순서) */
export function ownerSpellings(list) {
    const owners = [], seen = new Set();
    for (const m of String(list ?? '').matchAll(FILE)) {
        const parts = splitName(m[0].replace(/\.[^.]+$/u, ''), { strict: false });
        const owner = parts?.owner;
        if (!owner || seen.has(owner.toLowerCase())) continue;
        seen.add(owner.toLowerCase()); owners.push(owner);
    }
    // 다른 표기가 목록의 다른 주인과 같으면(한 가나를 두 사람이 나눠 씀 — Rina · Lina → リナ) 그 주인 줄은 뺀다 — 모델이 두 사람 그림을 바꿔 쓰지 않게
    const other = (owner, a) => a.toLowerCase() !== owner.toLowerCase() && seen.has(a.toLowerCase());
    return owners.map(owner => { const more = nameAliases(owner); return more.length && !more.some(a => other(owner, a)) ? [owner, ...more].join(' = ') : ''; }).filter(Boolean).join('\n');
}
