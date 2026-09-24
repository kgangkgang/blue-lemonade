// 캐릭터 에셋 — 이름 풀이. 실리태번을 부르지 않아서 Node에서도 시험할 수 있다.
// 예를 들어 한 폴더에 여러 캐릭터가 있으면 'Name_smirk'의 앞머리 'Name'이 캐릭터, 뒤 'smirk'가 표정이다.

/**
 * 'Name_light_smile' → { owner: 'Name', tag: 'light_smile' }
 * strict면 앞머리가 대문자나 한글·한자 같은 글자로 시작할 때만 캐릭터로 본다 ('happy_smile'의 'happy'는 캐릭터가 아니다).
 */
export function splitName(base, { strict = true } = {}) {
    const match = /^([^_\s]+)_(.+)$/u.exec(String(base));
    if (!match) return null;
    if (strict && !/^[\p{Lu}\p{Lo}]/u.test(match[1])) return null;
    return { owner: match[1], tag: match[2] };
}

const LIST_NOTE = '(one line per character; each character only has the images on their own line)';

/**
 * AI에게 줄 그림 이름 목록. 캐릭터가 둘 이상이면 캐릭터마다 한 줄로 나눠서
 * 그 캐릭터에게 없는 표정(예: Name_smirk)이 눈에 띄게 한다. 한 캐릭터뿐이면 예전처럼 쉼표로 한 줄.
 * 파일 이름은 그대로 적는다 (규칙 글이 '목록의 이름을 그대로 베끼라'고 하므로).
 * @param {{ file: string, base: string }[]} assets
 */
export function formatKeywordList(assets) {
    const owners = new Map();
    for (const asset of assets) {
        const parts = splitName(asset.base);
        if (!parts) continue;
        const key = parts.owner.toLowerCase();
        if (!owners.has(key)) owners.set(key, { label: parts.owner, files: [] });
        owners.get(key).files.push(asset.file);
    }
    const lines = [...owners.values()].filter(owner => owner.files.length >= 2);
    if (lines.length < 2) return assets.map(asset => asset.file).join(', ');
    const listed = new Set(lines.flatMap(owner => owner.files));
    const rest = assets.map(asset => asset.file).filter(file => !listed.has(file));
    const out = [LIST_NOTE, ...lines.map(owner => `- ${owner.label}: ${owner.files.join(', ')}`)];
    if (rest.length) out.push(`- other: ${rest.join(', ')}`);
    return `\n${out.join('\n')}`;
}

// ── 없는 이름 → 비슷한 그림 ─────────────────────────────────────

// AI가 지어낸 표정 낱말 → 그 캐릭터에게 있으면 쓸 표정 (앞에 있는 것부터)
const MOODS = [
    { words: ['smirk', 'smug', 'sneer', 'cocky', 'sly', 'wry', 'teasing', 'tease', 'mischievous', 'playful', 'amused', 'arrogant', 'confident', 'proud', 'grin'], tags: ['smirk', 'smug', 'light_smile', 'smile', 'laughing'] },
    { words: ['laugh', 'chuckle', 'giggle'], tags: ['laughing', 'smile', 'light_smile'] },
    { words: ['smile', 'happy', 'joy', 'joyful', 'cheerful', 'glad', 'delighted', 'excited', 'bright'], tags: ['smile', 'light_smile', 'laughing', 'blush_smile'] },
    { words: ['soft', 'gentle', 'warm', 'kind', 'fond', 'tender', 'faint', 'small', 'slight'], tags: ['light_smile', 'smile', 'blush_smile'] },
    { words: ['blush', 'embarrassed', 'flustered', 'shy', 'bashful', 'shame', 'ashamed'], tags: ['blush_shame', 'blush_smile'] },
    { words: ['love', 'loving', 'affectionate', 'adoring', 'heart'], tags: ['blush_smile', 'finger_heart', 'light_smile'] },
    { words: ['angry', 'anger', 'mad', 'furious', 'rage', 'enraged', 'glare', 'scowl'], tags: ['angry', 'annoyed'] },
    { words: ['annoyed', 'irritated', 'frustrated', 'displeased', 'grumpy', 'pout', 'sulk', 'exasperated', 'unamused'], tags: ['annoyed', 'angry', 'expressionless'] },
    { words: ['cry', 'tears', 'tearful', 'teary', 'sob', 'sobbing', 'weep'], tags: ['sad_crying', 'crying_expressionless', 'angry_crying', 'sad'] },
    { words: ['sad', 'upset', 'unhappy', 'hurt', 'depressed', 'melancholy', 'lonely', 'gloomy', 'dejected', 'sorrow', 'sorrowful'], tags: ['sad', 'gloomy', 'sad_crying'] },
    { words: ['surprised', 'surprise', 'shocked', 'shock', 'startled', 'scared', 'afraid', 'fear', 'fearful', 'frightened', 'panic', 'panicked', 'nervous', 'anxious', 'worried'], tags: ['panick', 'panic', 'surprised'] },
    { words: ['neutral', 'calm', 'serious', 'blank', 'stoic', 'expressionless', 'indifferent', 'deadpan', 'bored', 'cold', 'emotionless'], tags: ['expressionless'] },
    { words: ['think', 'thoughtful', 'ponder', 'confused', 'curious', 'puzzled', 'wonder'], tags: ['thinking'] },
    { words: ['sleep', 'asleep'], tags: ['sleeping', 'doze'] },
    { words: ['tired', 'sleepy', 'drowsy', 'doze', 'exhausted', 'yawn'], tags: ['doze', 'sleeping'] },
    { words: ['dark', 'menacing', 'sinister', 'threatening', 'shadowed', 'shaded', 'ominous', 'murderous', 'creepy', 'yandere'], tags: ['shaded_face'] },
    { words: ['wink', 'tehepero', 'cheeky'], tags: ['tehepero', 'wink'] },
];

// 겹치는 낱말을 셀 때 뜻이 약한 낱말은 빼고 센다 ('angry_face'가 'shaded_face'로 가지 않게)
const WEAK = new Set(['face', 'expression', 'look', 'eye', 'eyes', 'mouth', 'open', 'close', 'closed', 'light', 'slight', 'small', 'big', 'very', 'with', 'no', 'a', 'the', 'and']);

/** 아주 단순한 어간: smiling/smile → smil, dozing/doze → doz, panicked/panicking → panick */
function stem(word) {
    let w = word.toLowerCase();
    if (w.length > 4 && w.endsWith('ing')) w = w.slice(0, -3);
    else if (w.length > 3 && w.endsWith('ed')) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
    return w;
}

const MOOD_STEMS = MOODS.map(mood => ({ stems: new Set(mood.words.map(stem)), tags: mood.tags }));

const wordsOf = tag => tag.toLowerCase().split(/[_\-\s.]+/).filter(Boolean);
const strongStems = tag => [...new Set(wordsOf(tag).filter(word => !WEAK.has(word)).map(stem))];

/** 요청한 표정 낱말이 걸리는 MOODS의 표정들, 앞 낱말부터 */
function moodTags(tag) {
    const out = [];
    for (const word of wordsOf(tag)) {
        const s = stem(word);
        for (const mood of MOOD_STEMS) {
            if (!mood.stems.has(s)) continue;
            for (const t of mood.tags) if (!out.includes(t)) out.push(t);
        }
    }
    return out;
}

/**
 * 목록에 없는 이름을 같은 캐릭터의 비슷한 그림으로. 캐릭터를 모르거나 비슷한 것이 없으면 null.
 * 1) 뜻 있는 낱말이 가장 많이 겹치는 표정 (angry_face → angry, naked_shower → naked_bed)
 * 2) 하나도 안 겹치면 MOODS로 (Name_smirk → Name_light_smile)
 * @template {{ file: string, base: string, groupLabel: string }} A
 * @param {string} base 확장자를 뗀 이름
 * @param {Map<string, A[]>} groups 켜 둔 그림만 든 번호 묶음 (키는 번호 뗀 소문자 이름)
 * @returns {A|null}
 */
export function findSimilar(base, groups) {
    return findSimilarList(base, groups)[0] ?? null;
}

/**
 * findSimilar 와 같은 순서로 후보 전부 (가장 비슷한 것부터). 같은 답변에 첫 후보가 이미 나왔으면 다음 후보를 쓰려고 (1.2.4).
 * 겹치는 낱말이 있는 표정이 앞, 그 다음 MOODS 순서 — 아무 관계 없는 표정은 넣지 않는다.
 * @returns {A[]}
 */
export function findSimilarList(base, groups) {
    const want = splitName(base, { strict: false });
    if (!want) return [];
    const owner = want.owner.toLowerCase();
    const candidates = [];
    for (const [key, members] of groups) {
        if (!members?.length) continue;
        const parts = splitName(members[0].groupLabel, { strict: false });
        if (!parts || parts.owner.toLowerCase() !== owner) continue;
        candidates.push({ key, tag: parts.tag.toLowerCase(), members });
    }
    if (!candidates.length) return [];

    const wanted = strongStems(want.tag);
    const moods = moodTags(want.tag);
    const moodRank = tag => {
        const at = moods.indexOf(tag);
        return at < 0 ? Infinity : at;
    };

    const scored = [];
    for (const candidate of candidates) {
        const stems = strongStems(candidate.tag);
        const shared = stems.filter(s => wanted.includes(s)).length;
        if (!shared) continue;
        scored.push({ candidate, score: [-shared, stems.length - shared, moodRank(candidate.tag), wordsOf(candidate.tag).length] });
    }
    scored.sort((a, b) => (lessThan(a.score, b.score) ? -1 : lessThan(b.score, a.score) ? 1 : a.candidate.tag < b.candidate.tag ? -1 : a.candidate.tag > b.candidate.tag ? 1 : 0));
    const picks = scored.map(item => item.candidate);
    const byTag = new Map(candidates.map(candidate => [candidate.tag, candidate]));
    for (const tag of moods) {
        const candidate = byTag.get(tag);
        if (candidate && !picks.includes(candidate)) picks.push(candidate);
    }
    return picks.map(pick => pick.members.find(asset => asset.base.toLowerCase() === pick.key) ?? pick.members[0]);
}

function lessThan(a, b) {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
}
