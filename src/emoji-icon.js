// 1.5.0 그림 글자(이모지) 대신 선 아이콘 — 글꾸 틀 · 마트에서 받은 글꾸가 가진 `emoji` 칸을 화면에서는 Font Awesome 무료 아이콘으로 보여요.
//   자료(저장된 설정 · 마트 주고받기)는 그대로 두고 그리는 자리만 바꿔요. 표에 없는 그림 글자는 fallback 아이콘으로 보여요.
//   글꾸 본문 안의 장식 · 사용자가 쓴 글 · 캐릭터 대사는 건드리지 않아요.
const TABLE = `
📜scroll 🧾receipt 🌙moon 🧪flask 🍜bowl-food 🌅sun 💬comment 🗺map 📺tv 📖book-open 💌envelope-open-text 🪪id-card 📱mobile-screen 💿compact-disc
💐spa 👻ghost 🐶dog 🏫school 🏊person-swimming 🎤microphone-lines 🎒bag-shopping 🍃leaf 🌲tree 🌑circle ⚡bolt 🪭fan 🗂folder-open 🔍magnifying-glass
📦box 💢burst 🏷tag 🎸guitar 🎮gamepad 🎃ghost 🎂cake-candles 🌧cloud-rain 🌌star 🦩feather 🗓calendar-days 📼film 📷camera 📔book 🎼music 🍬candy-cane
❄snowflake ✨wand-magic-sparkles ✉envelope ☕mug-saucer ☁cloud 🪟table-columns 🚂train 🖌paintbrush 📮inbox 📠fax 📋clipboard-list 💻laptop 🏜mountain-sun
🎫ticket 🌤cloud-sun ✈plane 🫧soap 🫖mug-hot 🪽feather-pointed 🪦cross 🪞clone 🩺stethoscope 🧺basket-shopping 🧶ring 🧤mitten 🧢hat-cowboy 🧟person-walking
🧛user-secret 🧙hat-wizard 🧋glass-water 🦇crow 🦆kiwi-bird 🥾shoe-prints 🥐bread-slice 🛎bell-concierge 🛋couch 🚲bicycle 🚪door-open 🚗car-side 🚕taxi
🚒truck 🚌bus 🚆train-subway 🚀rocket 🖍highlighter 🕸spider 🕷spider 🕯fire-flame-simple 🔭binoculars 🔧wrench 🔥fire 📸camera-retro 📢bullhorn
📡satellite-dish 📟pager 📞phone 📐ruler-combined 📊chart-column 📈chart-line 📇address-card 💞heart 💘heart 💗heart 💎gem 💍ring 💀skull 👮user-shield
👑crown 🐻paw 🐺paw 🐹paw 🐱cat 🐰paw 🐧kiwi-bird 🐠fish 🐈cat 🏮lightbulb 🏪shop 🏞mountain-sun 🏚house-chimney-crack 🏖umbrella-beach 🏕campground
🏀basketball 🎾baseball 🎻guitar 🎵music 🎲dice 🎭masks-theater 🎨palette 🎣fish-fins 🎡dharmachakra 🎓graduation-cap 🎋seedling 🎈location-pin
🍺beer-mug-empty 🍸martini-glass 🍶wine-bottle 🍵mug-hot 🍲bowl-rice 🍰cake-candles 🍩cookie 🍦ice-cream 🍣fish 🍕pizza-slice 🍂leaf 🍁leaf 🌾wheat-awn
🌳tree 🌱seedling 🌫smog 🌘moon 🌋volcano 🌊water 🌈rainbow 🌇city ⭐star ❗circle-exclamation ⛴ferry ⛈cloud-bolt ⚾baseball ⚽futbol ⚰cross ♨hot-tub-person
⏳hourglass-half 🧽eraser 🥢utensils 🤐comment-slash 🖋pen-nib 🕶glasses 🕊dove 📏ruler 💭cloud 🐦crow 🏔mountain 🎞film 🎙microphone 🎐wind 🎁gift
🍞bread-slice 🌿leaf ⛸person-skating ⚪circle ⚙gear ⚖scale-balanced ⚔shield-halved ☑square-check ⌨keyboard 🧧envelope 🛰satellite 🛂passport 🚇train-subway
🕹gamepad 📻radio 📰newspaper 📚book 📌thumbtack 💝gift 💊pills 🎬clapperboard 🎄tree 🍫cookie-bite 🌸spa 🌕circle ⛅cloud-sun 😈mask 🔮hat-wizard 📓book
👁eye 🏴flag 🎅sleigh 🍳egg 🃏diamond 🍋lemon 🛒cart-shopping 🎶music 🏠house 💡lightbulb 🔔bell 🔑key 🔒lock 🎀ribbon 🌹spa 🌻sun 🍀clover ☀sun 🌟star
🍎apple-whole 🍏apple-whole 🍓lemon 🍒lemon 🐾paw 🦋feather 🐟fish 🦊paw 🐉dragon 🕰clock 🕒clock ⏱stopwatch ⏰clock 📍location-dot 🧭compass 🧩puzzle-piece
🎯bullseye 🏆trophy 🥇medal 💰coins 💵money-bill 🧸paw 🪄wand-magic-sparkles 🧷paperclip 📎paperclip ✂scissors 🖼image 🎹music 🥁drum 🎧headphones 📀compact-disc
❤heart ♥heart 💙heart 💜heart 💛heart 🖤heart 🤍heart 💔heart-crack 🩹bandage 🧠brain 🤖robot 👤user 👥user-group 💤bed 🚫ban ✅circle-check ❌circle-xmark
⚠triangle-exclamation ✔check 📝pen-to-square ✏pencil 🗑trash-can 💾floppy-disk 🔗link 🌐globe 🌍earth-asia 🌏earth-asia 🌎earth-americas
`;
let map = null;
const build = () => {
    map = new Map();
    for (const cell of TABLE.split(/\s+/)) {
        if (!cell) continue;
        const ch = String.fromCodePoint(cell.codePointAt(0));
        map.set(ch, 'fa-' + cell.slice(ch.length));
    }
    return map;
};

/** 그림 글자 → Font Awesome 이름(fa-…). 변형 선택자 · 이어 붙인 그림(검은 고양이 등)은 첫 그림으로 찾아요. 모르면 fallback */
export function emojiIcon(emoji, fallback = 'fa-shapes') {
    const text = String(emoji ?? '');
    if (!text) return fallback;
    return (map || build()).get(String.fromCodePoint(text.codePointAt(0))) || fallback;
}

/** 칩 · 목록 앞에 놓는 아이콘 한 칸 */
export const emojiMark = (emoji, fallback) => `<i class="fa-solid ${emojiIcon(emoji, fallback)}" aria-hidden="true"></i>`;
