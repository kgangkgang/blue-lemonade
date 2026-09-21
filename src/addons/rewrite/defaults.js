import { COLORS, COLOR_MODS } from './colors.js';
import { USER_COLORS_RULE } from './defaults-personal.js';
import { MULTILINGUAL_WORDS, NOSTRIL_RULE } from './multilingual.js';

export { USER_COLORS_EXTRA } from './defaults-personal.js';

const NAILS = String.raw`(?:finger|toe)?(?:nails?|manicure)`;
const NAIL_ADJ = String.raw`long|short|sharp|pointed|curved|hooked|blunt|thick|thin|neat|neatly trimmed|trimmed|filed|manicured|chipped|polished|buffed|glossy|matte|lacquered|painted|jagged|wicked|cruel|slender|elegant|tapered|perfect|clean|little|tiny|bitten|broken|immaculate|pristine`;
// Grey-ish colours also cover claws and talons (the way Gemini phrased it); other colours only cover nails.
const GRAYS = String.raw`(?:(?:dark|deep|charcoal|slate|ash|smoky|smoke|steel|iron|storm|stormy|pewter|matte)[- ]?)?(?:gr[ae]y(?:ish)?|charcoal|gunmetal|graphite|pewter)`;

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
    offeredRules: ['glasses', 'beard', 'tan', 'cane', 'ears', 'gray_nails', 'horns', 'user_colors', 'fufu', 'chest_hair'],
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
    if (rule !== USER_COLORS_RULE && MULTILINGUAL_WORDS[rule.id]) rule.words += '\n' + MULTILINGUAL_WORDS[rule.id];
}
DEFAULT_SETTINGS.rules.push(structuredClone(NOSTRIL_RULE));
DEFAULT_SETTINGS.offeredRules.push(NOSTRIL_RULE.id);
if (!USER_COLORS_RULE) DEFAULT_SETTINGS.offeredRules = DEFAULT_SETTINGS.offeredRules.filter(id => id !== 'user_colors');
