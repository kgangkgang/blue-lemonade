// 사이트용 얇은 어댑터예요 — 원본 omni-next 953c439a 의 src/addons/translator/glossary-match.js 에서 log-copy-words.js 가 쓰는 particleFor 하나만 옮겼어요(테마 번역기 쪽 나머지 의존은 떼어냈어요).
// 조사 짝 표 · 함수 본문은 원본 그대로예요. 시식하기는 단어 바꾸기(transformLog)를 쓰지 않아 실제로 불리지는 않지만, 불러오기(import)가 깨지지 않게 둬요.
const PARTICLE_PAIRS = [
    ['이에요', '예요', ['']], ['이었', '였', ['다', '어', '어요', '고', '는데', '던', '지', '을', '습니다']], ['이랑', '랑', ['', '은', '도', '의', '만']],
    ['으로', '로', ['', '서', '써', '부터', '도', '는', '만', '서는', '서도', '의']], ['이라', '라', ['', '고', '는', '서', '도', '면']], ['이나', '나', ['']],
    ['이든', '든', ['', '지']], ['이며', '며', ['']], ['이야', '야', ['']],
    ['은', '는', ['']], ['을', '를', ['']], ['과', '와', ['', '의', '는', '도', '만']], ['이', '가', ['']],
];

/** 받침에 맞는 조사 (조사가 아니거나 짝이 없는 말은 그대로): particleFor('코르빈', '가') → '이', particleFor('미나', '으로서') → '로서' */
export function particleFor(word, tail) {
    const code = String(word ?? '').slice(-1).charCodeAt(0) - 0xac00;
    if (!(code >= 0 && code < 11172) || !tail) return tail;
    const final = code % 28;
    for (const [withFinal, withoutFinal, follows] of PARTICLE_PAIRS) {
        const head = tail.startsWith(withFinal) ? withFinal : tail.startsWith(withoutFinal) ? withoutFinal : '';
        if (!head) continue;
        const rest = tail.slice(head.length);
        if (!follows.includes(rest)) return tail;
        if (withFinal === '으로') return (final && final !== 8 ? '으로' : '로') + rest;   // ㄹ 받침은 「로」
        return (final ? withFinal : withoutFinal) + rest;
    }
    return tail;
}
