// Word lists shared by several rules. A colour before hair/eyes/skin or nails is the banned detail; the nouns
// themselves are never banned, so "her nails" or "his eyes" alone never triggers a request.
export const COLORS = String.raw`black|white|gr[ae]y(?:ish)?|silver(?:y)?|platinum|blonde?|golden|gold|brown|brunette|chestnut|auburn|red|ginger|copper(?:y)?|crimson|scarlet|pink|rose|rosy|blue|azure|sapphire|cobalt|navy|green|emerald|jade|hazel|amber|honey|violet|purple|lavender|lilac|amethyst|ruby|ivory|cream|olive|raven|jet|ebony|ash|ashen|snow|snowy|ice|icy|milky|pearl|pearly|whitish|dusky|caramel|chocolate|coffee|mocha|inky|obsidian|onyx|teal|turquoise|cyan|indigo|magenta|peach|coral|strawberry|cherry|wine|burgundy|maroon|rust|bronze|brass|sandy|wheat|flaxen|tawny|mousy|alabaster|porcelain|charcoal|gunmetal|graphite|pewter|slate|midnight|multicolou?red|colou?rful|pastel|neon|ombre|rainbow|iridescent|opalescent|two-toned?|bleached|dyed`;
export const COLOR_MODS = String.raw`dark|deep|light|pale|bright|soft|vivid|pastel|dusty|muted|rich|warm|cool|glossy|matte|faded|ashy|smoky|milky|icy|golden|silvery|snowy|inky|jet|midnight|blood|wine|sky|ice|sea|forest|moss|rose|cherry|honey|amber|ash|steel|slate|storm|stormy|charcoal|platinum|strawberry|dirty|sandy|mousy|sun-bleached`;
// One-word colours on their own (dark hair, pale skin, fair hair).
export const SHADES = String.raw`dark|pale|fair`;
export const HAIR = String.raw`hair|locks|tresses|strands?|curls|bangs|fringe|braids?|ponytail|mane|updo|pigtails?|twintails?`;
export const EYES = String.raw`eyes?|irises|iris|orbs|gaze|pupils?|lashes|eyelashes|brows|eyebrows`;
export const SKIN = String.raw`skin|complexion`;
export const FEATURE = `(?:${HAIR}|${EYES}|${SKIN})`;
export const FEATURE_ADJ = String.raw`long|short|straight|wavy|curly|messy|silky|soft|thick|thin|fine|glossy|shiny|damp|wet|tangled|loose|tousled|windswept|bright|wide|narrow|sharp|large|big|small|round|almond|almond-shaped|clear|smooth|flawless|delicate|luminous|slitted|cat-like|upturned|droopy|doe|sleepy|tired|half-lidded|heavy-lidded|glittering|sparkling|shining|gleaming|glowing|piercing|unblinking|watery|teary|tear-filled|wide-eyed|lidded|hooded|thick-lashed|long-lashed`;
export const COLOR_NOUNS = String.raw`snow|silver|gold|ink|midnight|coal|obsidian|onyx|sapphires?|emeralds?|rubies|ruby|amethysts?|amber|honey|milk|cream|ivory|pearls?|storm ?clouds?|the (?:sea|sky|ocean|night)|fire|flames?|blood|wine|chocolate|caramel|copper|bronze|brass|rust|moonlight|starlight|sunlight|jade|ice|frost|ashes?|smoke|soot|tar|chestnuts?|hazelnuts?|wheat|straw|flax|sand|fresh cream|spun (?:gold|silver)|molten (?:gold|silver)`;

// 1.7.9 — more colours, and several colours chained ("golden-silver-white", "gold and silver").
export const MORE_COLORS = String.raw`champagne|mint|aqua|aquamarine|seafoam|periwinkle|mauve|plum|orchid|fuchsia|salmon|apricot|tangerine|orange|yellow|lemon|mustard|ochre|sepia|umber|russet|sienna|beige|taupe|khaki|sable|mahogany|cinnamon|hazelnut|walnut|cocoa|espresso|opal|moonstone|topaz|garnet|citrine|quartz|mercury|chrome|steel|iron|titanium|moonlit|sunlit|starlit|ginger-?blonde?|strawberry-?blonde?|dirty-?blonde?`;
export const ANY_COLOR = `(?:${COLORS}|${MORE_COLORS})`;
export const COLOR_JOIN = String.raw`(?:[- ]|-and-|-to-|\s+and\s+|\s+to\s+|\s*[\/&]\s*|,\s+(?:and\s+)?)`;
export const COLOR_CHAIN = `(?:(?:${COLOR_MODS})[- ])?${ANY_COLOR}(?:${COLOR_JOIN}(?:(?:${COLOR_MODS})[- ])?${ANY_COLOR}){0,3}`;
