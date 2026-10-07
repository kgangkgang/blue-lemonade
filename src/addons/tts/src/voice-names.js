// TTS 1.3.7 엔진 기본 목소리 이름 한국어로 (MiniMax 시스템 목소리 'Gentle Butler' → '다정한 집사' 같은 것).
// 낱말 표라서 목록에 새 목소리가 생겨도 아는 낱말은 한국어로 나온다. 모르는 낱말은 그대로 둔다. 값(voiceId)은 바꾸지 않는다.
const W = {
    // 사람
    girl: '소녀', boy: '소년', man: '남성', men: '남성', woman: '여성', women: '여성', lady: '숙녀', gentleman: '신사', guy: '남자', male: '남성', female: '여성',
    youth: '청년', teen: '십대', student: '학생', schoolgirl: '여학생', junior: '후배', senior: '선배', elder: '어르신', adult: '어른', person: '사람',
    sister: '언니', bestie: '단짝', friend: '친구', partner: '동료', neighbor: '이웃', boyfriend: '남자친구', girlfriend: '여자친구', husband: '남편',
    aunt: '이모', antie: '이모', auntie: '이모', boss: '보스', leader: '리더', manager: '매니저', executive: '임원', captain: '선장', commander: '지휘관',
    queen: '여왕', king: '왕', princess: '공주', prince: '왕자', knight: '기사', butler: '집사', maiden: '아가씨', heroine: '여주인공', hero: '주인공',
    warrior: '전사', soldier: '병사', veteran: '베테랑', scholar: '학자', teacher: '선생님', instructor: '강사', mentor: '멘토', doctor: '의사',
    narrator: '내레이터', storyteller: '이야기꾼', announcer: '아나운서', anchor: '앵커', host: '진행자', comedian: '코미디언', actor: '배우', dramatist: '극작가',
    debator: '토론가', adventurer: '모험가', sorcerer: '마법사', elf: '엘프', ghost: '유령', robot: '로봇', spirit: '정령', santa: '산타', claus: '클로스',
    rudolph: '루돌프', grinch: '그린치', godfather: '대부', playboy: '바람둥이', charmer: '매력남', owner: '주인', attendant: '승무원', reaper: '사신',
    bloke: '사내', character: '캐릭터', voice: '목소리', speech: '연설', news: '뉴스', radio: '라디오', movie: '영화', lead: '주연', anime: '애니',
    // 성격 · 느낌
    calm: '차분한', gentle: '다정한', young: '젊은', wise: '지혜로운', kind: '친절한', mature: '성숙한', reliable: '믿음직한', charming: '매력적인',
    playful: '장난스러운', friendly: '친근한', serene: '평온한', confident: '자신감 있는', sweet: '상냥한', thoughtful: '사려 깊은', reserved: '조용한',
    deep: '굵은', bossy: '대장 같은', warm: '따뜻한', intellectual: '지적인', brave: '용감한', caring: '배려하는', powerful: '힘찬', captivating: '매혹적인',
    passionate: '열정적인', strong: '강한', assertive: '단호한', whimsical: '엉뚱한', humorous: '유머러스한', cold: '차가운', cheerful: '명랑한',
    strict: '엄격한', determined: '굳센', upset: '속상한', diligent: '성실한', graceful: '우아한', lovely: '사랑스러운', sentimental: '감성적인', sad: '슬픈',
    soft: '부드러운', stressed: '지친', cute: '귀여운', sincere: '진실한', decisive: '결단력 있는', dominant: '위압적인', optimistic: '낙천적인',
    innocent: '순진한', professional: '전문적인', athletic: '운동하는', elegant: '우아한', rational: '이성적인', frank: '솔직한', tough: '거친',
    energetic: '활기찬', angry: '화난', chatty: '수다스러운', romantic: '로맨틱한', compelling: '설득력 있는', sensible: '분별 있는', attractive: '매력적인',
    expressive: '표현력 있는', radiant: '빛나는', magnetic: '매력적인', upbeat: '경쾌한', trustworthy: '믿음직한', trustworth: '믿음직한', whispering: '속삭이는',
    decent: '점잖은', imposing: '위엄 있는', patient: '참을성 있는', unrestrained: '거침없는', arrogant: '거만한', stubborn: '고집 센', lyrical: '서정적인',
    straightforward: '솔직한', crisp: '또렷한', pure: '맑은', explorative: '호기심 많은', bashful: '수줍은', loyal: '충직한', serious: '진지한',
    dependable: '듬직한', generous: '너그러운', sporty: '활발한', airheaded: '덜렁대는', cool: '쿨한', little: '어린', cocky: '건방진', considerate: '사려 깊은',
    enchanting: '매혹적인', enthusiastic: '열성적인', big: '큰', haughty: '도도한', lonely: '외로운', mysterious: '신비로운', possessive: '집착하는',
    quirky: '별난', sassy: '당돌한', shy: '수줍은', soothing: '포근한', sophisticated: '세련된', smart: '똑똑한', gorgeous: '화려한', naughty: '짓궂은',
    grim: '음산한', fascinating: '흥미로운', inspiring: '영감을 주는', theatrical: '연극적인', fragile: '여린', casual: '편안한', handsome: '잘생긴',
    bright: '밝은', ambitious: '야심찬', crazy: '미친', pessimistic: '비관적인', bad: '못된', tempered: '성질', wandering: '떠도는', jovial: '쾌활한',
    steady: '침착한', fussy: '까다로운', pompous: '거드름 피우는', conscientious: '성실한', kindhearted: '마음씨 착한', hearted: '마음씨', willed: '의지',
    voiced: '목소리', toned: '음색', laid: '느긋한', back: '', new: '새', southern: '남부', aussie: '호주', hk: '홍콩', flight: '비행', armor: '갑옷',
    childhood: '어린 시절', spoken: '말투', manner: '태도', with: '', the: '', a: '', and: '', of: '',
    hostess: '안주인', presenter: '진행자', debater: '토론가', miss: '아가씨', izakaya: '이자카야', intonate: '억양', assured: '확신에 찬',
    steadfast: '굳건한', assetive: '단호한', advisor: '조언자', tranquil: '고요한', arnold: '아널드',
};
// 두 낱말이 한 뜻 (먼저 바꿈)
const PHRASES = [[/\belder sister\b/gi, '언니'], [/\blittle sister\b/gi, '여동생'], [/\belder brother\b/gi, '형'], [/\blittle brother\b/gi, '남동생'],
    [/\blevel[- ]headed\b/gi, '침착한'], [/\bnext[- ]door\b/gi, '옆집'], [/\bgrim reaper\b/gi, '저승사자'], [/\bflight attendant\b/gi, '승무원'], [/\bsanta claus\b/gi, '산타클로스'], [/\bkind[- ]?hearted\b/gi, '마음씨 착한'], [/\bwarm[- ]hearted\b/gi, '마음 따뜻한'], [/\bstrong[- ]willed\b/gi, '의지가 강한'], [/\bbad[- ]tempered\b/gi, '성질 나쁜'], [/\blaid[- ]back\b/gi, '느긋한'], [/\bsoft[- ]spoken\b/gi, '말씨 고운']];
const SPLIT = /[\s_\-/]+/;
/** 'Gentle Butler' · 'Magnetic-voiced Male' · 'kind-hearted Girl' → 한국어. 모르는 낱말은 그대로, 바꾼 것이 하나도 없으면 원래 이름 */
export function koVoiceName(name) {
    const raw = String(name || '').trim();
    if (!raw || /[가-힣]/.test(raw)) return raw;
    let text = raw.replace(/([a-z])([A-Z])/g, '$1 $2');
    let hit = 0;
    for (const [re, ko] of PHRASES) text = text.replace(re, () => { hit++; return ` ${ko} `; });
    const words = text.replace(/\((.*?)\)/g, ' $1 ').replace(/（.*?）/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').split(SPLIT).filter(Boolean);
    const out = [];
    for (const w of words) {
        const k = w.toLowerCase();
        if (/[가-힣]/.test(w)) { out.push(w); continue; }
        if (Object.prototype.hasOwnProperty.call(W, k)) { hit++; if (W[k]) out.push(W[k]); continue; }
        // 붙여 쓴 낱말 (Wiselady · Jovialman · Steadymentor · Fussyhostess)
        const two = Object.keys(W).find(a => a.length > 2 && k.startsWith(a) && Object.prototype.hasOwnProperty.call(W, k.slice(a.length)) && W[k.slice(a.length)]);
        if (two) { hit++; out.push(W[two], W[k.slice(two.length)]); continue; }
        out.push(w);
    }
    if (!hit) return raw;
    return out.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || raw;
}
