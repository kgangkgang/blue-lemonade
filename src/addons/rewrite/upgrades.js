import { MULTILINGUAL_WORDS, multilingualNear } from './multilingual.js';
// One-off changes to saved settings when a default rule or exception changes shape after it was first shipped.
// Saved settings only ever get missing keys filled in (see loadSettings), so an edited default needs a step here.
// Each step runs once per install (ids kept in settings.appliedUpgrades); a fresh install lists them all as done.
import { compileRule, findSpans, parseEntries } from './core.js';
import { DEFAULT_SETTINGS, USER_COLORS_EXTRA } from './defaults.js';

const OLD_USER_COLORS_DESCRIPTION = 'hair, eye, skin, lash, or brow colors (white hair, blue eyes, pale skin, silver-haired, eyes like sapphires)';
const OLD_EARS_WORDS = 'pointed ear, pointed ears, pointy ear, pointy ears, pointed elven ears, pointed elf ears, elven ears, elfin ears, elfish ears, elf ears';
const OLD_GRAY_NAILS = {
    name: '회색 손톱',
    description: 'gray-colored fingernails, claws, or talons (dark gray, charcoal, gunmetal, or graphite nails or nail polish)',
    words: [
        String.raw`/\b(?:(?:dark|deep|charcoal|slate|ash|smoky|smoke|steel|iron|storm|stormy|pewter|matte)[- ]?)?(?:gr[ae]y(?:ish)?|charcoal|gunmetal|graphite|pewter)(?:[- ](?:black|painted|lacquered|polished|varnished|tipped|colou?red|tinted))?(?:,?\s+(?:long|short|sharp|pointed|curved|hooked|blunt|thick|thin|neat|filed|manicured|chipped|polished|glossy|matte|lacquered|painted|jagged|wicked|cruel|slender|elegant|tapered|perfect|clean|little|tiny|bitten|broken))?,?\s+(?:finger|toe)?(?:nails?|claws?|talons?|manicure)\b/`,
        String.raw`/\b(?:finger|toe)?(?:nails?|claws?|talons?)\b[^.!?\n]{0,30}?\b(?:painted|lacquered|polished|varnished|coated|done|tipped|stained|glossed|filed)\b[^.!?\n]{0,20}?\b(?:gr[ae]y|charcoal|gunmetal|graphite|pewter)\b/`,
        String.raw`/\b(?:finger|toe)?(?:nails?|claws?|talons?)\s+(?:(?:were|was|are|is|gleamed|glinted|shone|looked)\s+)?(?:an?\s+)?(?:(?:dark|deep|charcoal|slate|ash|smoky|steel|iron)[- ]?)?(?:gr[ae]y(?:ish)?|charcoal|gunmetal|graphite|pewter)\b/`,
        String.raw`/\b(?:gr[ae]y|charcoal|gunmetal|graphite|pewter)\s+(?:nail\s+(?:polish|lacquer|varnish|paint)|(?:polish|lacquer|varnish)\b[^.!?\n]{0,25}?\b(?:finger|toe)?(?:nails?|claws?))/`,
    ].join('\n'),
};

function defaultRule(id) {
    return DEFAULT_SETTINGS.rules.find(rule => rule.id === id);
}

function entryKey(entry) {
    return 'word' in entry ? `w:${entry.word.toLowerCase()}` : `r:${entry.regex}`;
}

function renderEntry(entry) {
    return 'word' in entry ? entry.word : `/${entry.regex}/`;
}

/**
 * Replaces a rule's word list with the new default, keeping the user's own additions: entries that were neither
 * in the old default nor already covered by the new one. Default entries the user had removed from the old list
 * stay removed. Name and description move along only if untouched.
 */
export function upgradeRuleWords(rule, fresh, previous) {
    const previousEntries = parseEntries(previous.words);
    const current = new Set(parseEntries(rule.words).map(entryKey));
    const removed = new Set(previousEntries.map(entryKey).filter(key => !current.has(key)));
    const freshEntries = parseEntries(fresh.words).filter(entry => !removed.has(entryKey(entry)));
    const freshWords = removed.size ? freshEntries.map(renderEntry).join('\n') : fresh.words;
    const known = new Set([...previousEntries, ...freshEntries].map(entryKey));
    const compiled = [compileRule({ ...fresh, words: freshWords })];
    const extra = parseEntries(rule.words)
        .filter(entry => !known.has(entryKey(entry)))
        .filter(entry => !('word' in entry) || findSpans(entry.word, compiled).length === 0);
    rule.words = [freshWords, ...extra.map(renderEntry)].join('\n');
    if (rule.name === previous.name) rule.name = fresh.name;
    if ((rule.description ?? '') === (previous.description ?? '')) rule.description = fresh.description;
}

export const UPGRADES = [
    {
        id: 'fufu-ehehe-5.0.7',
        apply(stored) {
            const rule = stored.rules.find(item => item.id === 'fufu');
            if (!rule) return;
            const fresh = defaultRule('fufu');
            const addition = parseEntries(fresh.words)[0];
            const known = new Set(parseEntries(rule.words).map(entryKey));
            if (!known.has(entryKey(addition))) rule.words = [rule.words || '', renderEntry(addition)].join('\n');
            if (rule.name === '후후 웃음') rule.name = fresh.name;
            if (rule.description === "the laugh \"ふふ\" in any form (ふふ, ふふっ, ふふふ, うふふ, フフ, 후후, fufu) — replace it with a different laugh or reaction that fits the speaker (ふっ, くすっ, ははっ, へへ, a smile, a snort) or drop it; a single ふ or 후 is fine") rule.description = fresh.description;
        },
    },

    {
        // v1.7.0: 뾰족귀 gained the `…` gap entries; 회색 손톱 became 색깔 손톱 (any colour on nails).
        id: 'words-1.7',
        apply(stored) {
            const ears = stored.rules.find(rule => rule.id === 'ears');
            if (ears) upgradeRuleWords(ears, defaultRule('ears'), { name: '뾰족귀', description: 'pointed or elf-like ears', words: OLD_EARS_WORDS });
            const nails = stored.rules.find(rule => rule.id === 'gray_nails');
            if (nails) upgradeRuleWords(nails, defaultRule('gray_nails'), OLD_GRAY_NAILS);
        },
    },
    {
        // v1.7.0: Belford's black nails are canon, so his exception also allows the (now colour-wide) nails rule.
        id: 'belford-nails-1.7',
        apply(stored) {
            const belford = stored.exceptions.find(exception => exception.id === 'belford');
            if (belford && !(belford.allow ?? []).includes('gray_nails')) belford.allow = [...(belford.allow ?? []), 'gray_nails'];
        },
    },
    {
        id: 'multilingual-1.7.7',
        apply(stored) {
            for (const rule of stored.rules) {
                const addition = MULTILINGUAL_WORDS[rule.id];
                if (!addition) continue;
                const known = new Set(parseEntries(rule.words).map(entryKey));
                const extra = parseEntries(addition).filter(entry => !known.has(entryKey(entry)));
                if (extra.length) rule.words = [rule.words || '', ...extra.map(renderEntry)].join('\n');
                if (rule.id === 'user_colors' && rule.near) rule.near = multilingualNear(rule.near);
            }
        },
    },
    {
        // v1.7.9: 유저 외모 색깔 gained the several-colours-at-once lines ("golden-silver hair"); the user's list stays.
        id: 'two-colors-1.7.9',
        apply(stored) {
            const rule = stored.rules.find(item => item.id === 'user_colors');
            if (!rule) return;
            const known = new Set(parseEntries(rule.words).map(entryKey));
            const extra = parseEntries(USER_COLORS_EXTRA).filter(entry => !known.has(entryKey(entry)));
            if (extra.length) rule.words = [rule.words || '', ...extra.map(renderEntry)].join('\n');
            if ((rule.description ?? '') === OLD_USER_COLORS_DESCRIPTION) rule.description = defaultRule('user_colors').description;
        },
    },
];

/**
 * Runs the steps this install hasn't seen. Expects `rules` and `exceptions` arrays to exist.
 * @param {object} stored
 * @returns {string[]} ids of the steps applied now
 */
export function applyUpgrades(stored) {
    if (!Array.isArray(stored.appliedUpgrades)) stored.appliedUpgrades = [];
    const applied = [];
    for (const upgrade of UPGRADES) {
        if (stored.appliedUpgrades.includes(upgrade.id)) continue;
        upgrade.apply(stored);
        stored.appliedUpgrades.push(upgrade.id);
        applied.push(upgrade.id);
    }
    return applied;
}
