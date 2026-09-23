import { COLORS, COLOR_MODS, MORE_COLORS } from './colors.js';
import { USER_COLORS_RULE, USER_HAIR_RULE, USER_NAILS_RULE } from './defaults-personal.js';
import { MULTILINGUAL_WORDS, NOSTRIL_RULE } from './multilingual.js';

export { USER_COLORS_EXTRA } from './defaults-personal.js';

const NAILS = String.raw`(?:finger|toe)?(?:nails?|manicure)`;
const NAIL_ADJ = String.raw`long|short|sharp|pointed|curved|hooked|blunt|thick|thin|neat|neatly trimmed|trimmed|filed|manicured|chipped|polished|buffed|glossy|matte|lacquered|painted|jagged|wicked|cruel|slender|elegant|tapered|perfect|clean|little|tiny|bitten|broken|immaculate|pristine`;
// Grey-ish colours also cover claws and talons (the way Gemini phrased it); other colours only cover nails.
const GRAYS = String.raw`(?:(?:dark|deep|charcoal|slate|ash|smoky|smoke|steel|iron|storm|stormy|pewter|matte)[- ]?)?(?:gr[ae]y(?:ish)?|charcoal|gunmetal|graphite|pewter)`;

// 1.8.9 — eyewear colours. Black and its names are the only allowed frame colour, so the colour list is every
// other colour the hair/nail rules know plus finishes that are never black (wire, tortoiseshell, clear).
// "wine glasses" and "two glasses of red wine" are drinkware, so those colours are left out and "of" never links.
const FRAME_BLACKS = new Set(['black', 'jet', 'ebony', 'obsidian', 'onyx', 'inky', 'raven', 'charcoal']);
const FRAME_DRINKS = new Set(['wine', 'champagne', 'crystal', 'milky', 'honey', 'coffee', 'mocha', 'caramel', 'chocolate', 'cherry', 'strawberry', 'peach', 'lemon', 'mint', 'aqua', 'cream', 'espresso', 'cocoa', 'apricot', 'tangerine', 'orange', 'salmon', 'cinnamon', 'walnut', 'hazelnut']);
const FRAME_COLORS = [...COLORS.split('|'), ...MORE_COLORS.split('|')].filter(c => !FRAME_BLACKS.has(c) && !FRAME_DRINKS.has(c)).join('|');
const FRAME_FINISH = String.raw`tortoise(?:-?shell)?|wire|wiry|clear|transparent|translucent|see-through`;
const EYEWEAR = String.raw`glasses|eyeglasses|spectacles|specs|monocles?|pince-nez|bifocals|eyewear`;
const NOT_A_FRAME = String.raw`(?![- ](?:haired|eyed|skinned|hair|eyes?|skin|light|glow|wine|liquid|dawn|dusk|sun|sky|leaf|leaves))`;

export const DEFAULT_SETTINGS = {
    enabled: true,
    notify: true,
    // 'current' = the model you chat with, 'direct' = provider/model picked here, 'profile' = a Connection Manager profile
    connection: 'current',
    profileId: '',
    provider: 'custom',
    // Last model picked per provider; 'custom' means the typed name in customModels.
    models: {
        openai: 'gpt-5.4-mini',
        claude: 'claude-haiku-4-5',
        google: 'gemini-3.8-flash',
        vertexai: 'gemini-3.8-flash',
        openrouter: 'google/gemini-3.8-flash',
        deepseek: 'deepseek-flash',
        cohere: 'command-a-03-2025',
        custom: 'custom',
    },
    customModels: {},
    // '' = SillyTavern's own Custom endpoint, with its extra headers/body
    customUrl: '',
    // Model ids fetched per Custom endpoint address: { [url]: { models: [...], fetchedAt: ISO } }, newest 3 kept
    customModelLists: {},
    temperature: 1,
    maxTokens: 4096,
    useReverseProxy: false,
    reverseProxyUrl: '',
    reverseProxyPassword: '',
    timeoutSec: 120,
    maxAttempts: 5,
    lookback: 5,
    skipExemptOnly: false,
    // 1.9.2 반복 감지: 최근 lookback 개의 답과 거의 같은 문장(3-gram 자카드 ≥ threshold %)은 다시 쓰게 한다. minLength 는 비교할 최소 글자 수.
    repeat: { on: false, lookback: 6, threshold: 60, minLength: 14 },
    // Reply-start check: when the prompt asks for a Scene Plan and the reply doesn't start with one,
    // the same request is sent again (chat connection, no streaming) before the translator runs.
    scenePlan: {
        enabled: false,
        startPattern: '<scene_plan, <scene_reasoning',
        // Only check replies whose prompt contains this; '' = every reply.
        promptPattern: '<scene_plan_guide>',
        maxAttempts: 5,
        timeoutSec: 60,
    },
    // A rule with `onlyFor` (names, {{user}} allowed) is checked only while one of those names is in the recent
    // messages, and the LLM is told the trait is wrong for those characters only. A rule with `near` only counts
    // a match when one of those words sits within three words before it.
    rules: [
        {
            id: 'glasses',
            name: '안경',
            enabled: true,
            description: 'eyewear such as glasses, spectacles, or monocles',
            words: 'glasses, eyeglasses, spectacles, monocle, monocles, pince-nez, bifocals, wire-rimmed, horn-rimmed, gold-rimmed, silver-rimmed, metal-rimmed, thin-rimmed, thick-rimmed, black-rimmed',
        },
        {
            id: 'glasses_color',
            name: '안경 색',
            enabled: true,
            description: 'eyewear in any colour or finish other than plain black: gold-, silver-, wire- or tortoiseshell-rimmed frames, coloured or clear frames, tinted lenses, a colour on the rims or temples (금테 안경, 은테, 金縁の眼鏡, 金边眼镜). The glasses themselves are fine and must stay; make the frames black or drop the colour word.',
            words: [
                // colour or finish (+ rimmed/framed/tinted) before the eyewear: "gold-rimmed glasses", "thin silver frames", "wire spectacles"
                String.raw`/\b(?:${FRAME_COLORS}|${FRAME_FINISH})(?:[- ]?(?:rimmed|framed|tinted|edged|toned|colou?red|plated))?(?:,?\s+(?!(?:and|or|with|hair|eyes?|skin|of)\b)[\p{L}-]+){0,2},?\s+(?:${EYEWEAR}|frames|rims|lenses)\b/`,
                // eyewear was/with a colour: "his glasses were gold-rimmed", "spectacles with silver frames", "lenses tinted amber"
                String.raw`/\b(?:${EYEWEAR}|lenses)\b(?:\s+(?!(?:of|and)\b)[\p{L}-]+){0,2}\s+(?:were|was|are|is|had|with|in|glinted|gleamed|flashed|shone|tinted|framed|rimmed)\s+(?:(?:a|an|the|their|its)\s+)?(?:(?!(?:hair|eyes?|skin)\b)[\p{L}-]+\s+){0,2}(?:${FRAME_COLORS})(?:[- ](?:rimmed|framed|tinted|frames?|rims?|wire|metal|tint|finish))?\b${NOT_A_FRAME}/`,
                // "his glasses, gold-rimmed and thin"
                String.raw`/\b(?:${EYEWEAR}),\s+(?:(?:a|an|the|their|its|all)\s+)?(?:[\p{L}-]+\s+){0,2}(?:${FRAME_COLORS})(?:[- ](?:rimmed|framed|tinted|frames?|rims?))?\b${NOT_A_FRAME}/`,
                // "the gold rims of his glasses", "the silver wire of her spectacles"
                String.raw`/\b(?:${FRAME_COLORS})(?:[- ]?(?:plated|toned|colou?red))?\s+(?:rims?|frames?|temples?|arms?|wire)\s+of\s+(?:his|her|their|the|those|[\p{L}]+['’]s)\s+(?:${EYEWEAR})\b/`,
                // "glasses whose frames were gold", "spectacles, the rims a dull silver"
                String.raw`/\b(?:${EYEWEAR})\b[^.!?\n]{0,20}?\b(?:rims?|frames?|temples?|lenses|tint)\s+(?:were|was|are|is|a|an|in|of)\s+(?:[\p{L}-]+\s+){0,2}(?:${FRAME_COLORS})\b${NOT_A_FRAME}/`,
                // 금테 안경 · 은테 · 갈색 안경테 · 붉은 렌즈 (금 · 은 · 갈 · 회 need 색/빛/테 behind them — 은 is also a particle)
                String.raw`/(?:(?:금|은|백금|황금|갈|밤|녹|회|백|호박|호피|구리|청동)(?:색|빛|테)|(?:붉은|빨간|빨강|파란|파랑|푸른|초록|보라|분홍|핑크|하얀|흰|노란|노랑|투명|무지개|알록달록|금빛|은빛|금색|은색|갈색|회색|백색|녹색)(?:색|빛|테)?)\s*(?:의\s*)?(?:안경(?:테|알)?|테|프레임|렌즈)/`,
                String.raw`/(?:금|은|백금|황금|갈|호피)테(?=[\s의를가이은는로에,.!?]|$)/`,
                // 안경은 금테였다 · 안경테는 은색 · 렌즈가 붉은
                String.raw`/(?:안경(?:테|알)?|렌즈|프레임)(?:은|는|이|가)\s*(?:짙은\s*|옅은\s*|밝은\s*|어두운\s*|연한\s*|진한\s*)?(?:(?:금|은|백금|황금|갈|밤|녹|회|백|호박|호피)(?:색|빛|테)|(?:붉은|빨간|빨강|파란|파랑|푸른|초록|보라|분홍|핑크|하얀|흰|노란|노랑|투명|무지개))/`,
                // 金縁の眼鏡 · 銀ぶちメガネ · メガネは金色
                String.raw`/(?:金|銀|茶|赤|青|緑|紫|桃|白|黄|灰|透明|べっ甲|鼈甲|銅)(?:色|縁|ぶち|フレーム)?(?:の)?\s*(?:眼鏡|メガネ|めがね|フレーム|レンズ|片眼鏡|モノクル)/`,
                String.raw`/(?:眼鏡|メガネ|めがね|フレーム|レンズ)(?:の縁|の枠|のフレーム)?(?:は|が)\s*(?:金|銀|茶|赤|青|緑|紫|桃|白|黄|灰|透明|べっ甲|鼈甲|銅)(?:色|縁)?/`,
                // 金边眼镜 · 银框眼镜 · 镜框是金色的
                String.raw`/(?:金|银|銀|铜|銅|棕|褐|红|紅|蓝|藍|绿|綠|紫|粉|黄|黃|灰|透明|玳瑁)(?:色|边|邊|丝|絲|框)?(?:的)?\s*(?:眼镜|眼鏡|镜框|鏡框|镜片|鏡片|镜架|鏡架)/`,
                String.raw`/(?:眼镜|眼鏡|镜框|鏡框|镜架|鏡架|镜片|鏡片)(?:是|为|為|呈)\s*(?:金|银|銀|铜|銅|棕|褐|红|紅|蓝|藍|绿|綠|紫|粉|白|黄|黃|灰|透明|玳瑁)(?:色)?/`,
            ].join('\n'),
            // Only Belford wears glasses at all (the 안경 rule bans them on everyone else), so the colour check is his.
            onlyFor: 'Belford Beelzebub, Belford, Beelzebub, Bel, 벨포드, 벨, 벨제부브, 베엘제붑, ベルフォード・ベルゼブブ, ベルフォード, ベルゼブブ',
        },
        {
            id: 'beard',
            name: '수염',
            enabled: true,
            description: 'facial hair such as a beard, stubble, a mustache, or sideburns',
            words: "beard*, stubbl*, goatee*, mustache*, moustache*, facial hair, unshaven, five o'clock shadow, sideburns",
        },
        {
            id: 'tan',
            name: '태닝',
            enabled: true,
            description: 'tanned or sun-darkened skin',
            words: 'tanned, sun-tanned, tan skin, tan complexion, tan line*, sun-kissed skin, sun-kissed complexion',
        },
        {
            id: 'cane',
            name: '지팡이',
            enabled: true,
            description: 'a cane or walking stick',
            words: 'cane, canes, walking stick*',
        },
        {
            id: 'ears',
            name: '뾰족귀',
            enabled: true,
            description: 'pointed or elf-like ears',
            // `…` lets words sit in between: pointed celestial ears, pointy little elven ears.
            words: 'pointed … ear, pointed … ears, pointy … ear, pointy … ears, elven … ears, elfin ears, elfish ears, elf ears, elf-like ears, tapered ears, leaf-shaped ears',
        },
        {
            id: 'gray_nails',
            name: '색깔 손톱',
            enabled: true,
            description: 'colored fingernails or nail polish of any color (black nails, red nail polish, dark-gray claws); plain or manicured nails without a color are fine',
            words: [
                // colour (+ modifier) before nails: "lacquered black nails", "blood-red, pointed fingernails"
                String.raw`/\b(?:(?:${COLOR_MODS})[- ]?)?(?:${COLORS})(?:[- ](?:${COLORS}))?(?:[- ]?(?:painted|lacquered|polished|varnished|tipped|colou?red|tinted|manicured|trimmed|glossed))?(?:,?\s+(?:${NAIL_ADJ}))?,?\s+${NAILS}\b/`,
                // nails painted/lacquered … colour
                String.raw`/\b${NAILS}\b[^.!?\n]{0,30}?\b(?:painted|lacquered|polished|varnished|coated|done|tipped|stained|glossed|filed|manicured)\b[^.!?\n]{0,20}?\b(?:${COLORS})\b/`,
                // nails were (a deep) colour
                String.raw`/\b${NAILS}\s+(?:(?:were|was|are|is|gleamed|glinted|shone|looked|flashed)\s+)?(?:an?\s+)?(?:(?:${COLOR_MODS})[- ]?)?(?:${COLORS})\b/`,
                // colour nail polish / a colour polish on her nails
                String.raw`/\b(?:${COLORS})\s+(?:nail\s+(?:polish|lacquer|varnish|paint)|(?:polish|lacquer|varnish)\b[^.!?\n]{0,25}?\b${NAILS})/`,
                // grey-ish claws and talons, in either order
                String.raw`/\b${GRAYS}(?:[- ](?:black|painted|lacquered|polished|varnished|tipped|colou?red|tinted))?(?:,?\s+(?:${NAIL_ADJ}))?,?\s+(?:claws?|talons?)\b/`,
                String.raw`/\b(?:claws?|talons?)\s+(?:(?:were|was|are|is|gleamed|glinted|shone|looked)\s+)?(?:an?\s+)?${GRAYS}\b/`,
                // 1.9.1 any colour + up to two words + claws/talons: "neatly trimmed black demon claws", "red-tipped talons" — not "the black cat claws at"
                String.raw`/\b(?:(?:${COLOR_MODS})[- ]?)?(?:${COLORS})\b(?:[- ][\p{L}-]+){0,2}?[- ](?:claws?|talons?)\b(?!\s+(?:at|into|through|his way|her way|its way)\b)/`,
                String.raw`/\b(?:claws?|talons?)\b[^.!?\n]{0,25}?\b(?:were|was|are|is|painted|lacquered|gleamed|glinted|shone)\b[^.!?\n]{0,12}?\b(?:${COLORS})\b/`,
            ].join('\n'),
        },
        {
            id: 'horns',
            name: '뿔',
            enabled: true,
            description: 'horns of any kind (horns, a horn nub, antlers)',
            words: 'horn, horns, horned, horn-like, antler, antlers',
            onlyFor: 'Satan, Satanael, 사탄, 사타나엘, サタン',
        },
        ...(USER_COLORS_RULE ? [USER_COLORS_RULE] : []),
        ...(USER_HAIR_RULE ? [USER_HAIR_RULE] : []),
        ...(USER_NAILS_RULE ? [USER_NAILS_RULE] : []),
        {
            // The "fufu" laugh; a single ふ / 후 (a breath, "ふっ") is fine.
            // Regex lines because kana and hangul have no word boundaries: ふふ, ふふふ, ふふっ, うふふ, フフ, 후후, fufu.
            id: 'fufu',
            name: '후후 웃음',
            enabled: true,
            description: 'the laugh "ふふ" in any form (ふふ, ふふっ, ふふふ, うふふ, フフ, 후후, fufu) — replace it with a different laugh or reaction that fits the speaker (ふっ, くすっ, ははっ, へへ, a smile, a snort) or drop it; a single ふ or 후 is fine',
            words: [
                String.raw`/(?:う|ウ)?(?:ふふ|フフ)+(?:っ|ッ)?/`,
                String.raw`/후후+/`,
                String.raw`/\bfufu+\b/`,
            ].join('\n'),
        },
        {
            // Body hair on the chest. Head hair falling onto a chest is not this;
            // the regex only takes "hair" that sits/spreads ON the torso.
            id: 'chest_hair',
            name: '가슴털',
            enabled: true,
            description: 'chest or body hair on a character (chest hair, a hairy chest, a happy trail, hair across the torso) — keep the chest or torso itself, just without hair',
            words: [
                'chest hair, chest-hair, chest fur, hairy chest, hairy torso, hairy pecs, hairy stomach, hairy belly, hairy abdomen, body hair, happy trail, treasure trail, 가슴털, 가슴 털, 胸毛',
                String.raw`/\bhair\s+(?:on|across|over|covering|dusting|carpeting|trailing\s+down|running\s+down)\s+(?:his|her|their|its|the|my|your)\s+(?:chest|torso|pecs|pectorals|stomach|belly|abdomen|sternum)\b/`,
            ].join('\n'),
        },
    ],
    // Default rule ids already offered to this install; newer ones get added once on load (see loadSettings).
    offeredRules: ['glasses', 'glasses_color', 'beard', 'tan', 'cane', 'ears', 'gray_nails', 'horns', 'user_colors', 'fufu', 'chest_hair'],
    exceptions: [
        {
            id: 'belford',
            enabled: true,
            names: 'Belford Beelzebub, Belford, Beelzebub, Bel, 벨포드, 벨, 벨제부브, 베엘제붑, ベルフォード・ベルゼブブ, ベルフォード, ベルゼブブ',
            allow: ['glasses', 'gray_nails'],
        },
        {
            id: 'adelstein',
            enabled: true,
            names: 'Adelstein, Adel, 아델스타인, 아델, アデルシュタイン, アデル',
            allow: ['ears', 'gray_nails'],
        },
    ],
    // Default exception ids already offered; newer ones get added once on load, a deleted one stays deleted.
    offeredExceptions: ['belford', 'adelstein'],
    // One-off setting upgrades already applied (see upgrades.js); a fresh install needs none of them.
    appliedUpgrades: ['words-1.7', 'belford-nails-1.7', 'multilingual-1.7.7', 'two-colors-1.7.9'],
};

for (const rule of DEFAULT_SETTINGS.rules) {
    // The persona rule arrives complete from defaults-personal.js.
    if (rule !== USER_COLORS_RULE && rule !== USER_HAIR_RULE && rule !== USER_NAILS_RULE && MULTILINGUAL_WORDS[rule.id]) rule.words += '\n' + MULTILINGUAL_WORDS[rule.id];
}
DEFAULT_SETTINGS.rules.push(structuredClone(NOSTRIL_RULE));
DEFAULT_SETTINGS.offeredRules.push(NOSTRIL_RULE.id);
if (!USER_COLORS_RULE) DEFAULT_SETTINGS.offeredRules = DEFAULT_SETTINGS.offeredRules.filter(id => id !== 'user_colors');
if (USER_HAIR_RULE) DEFAULT_SETTINGS.offeredRules.splice(DEFAULT_SETTINGS.offeredRules.indexOf('user_colors') + 1, 0, USER_HAIR_RULE.id);
if (USER_NAILS_RULE) DEFAULT_SETTINGS.offeredRules.splice(DEFAULT_SETTINGS.offeredRules.indexOf(USER_HAIR_RULE ? USER_HAIR_RULE.id : 'user_colors') + 1, 0, USER_NAILS_RULE.id);
