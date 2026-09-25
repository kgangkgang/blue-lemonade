// Bounded, sentence-local patterns. Keep body parts alone and unrelated senses usable.
const koColor = '검(?:은|정|게)|까만|까맣게|흰|하얀|하얗게|백발|은빛|은색|금빛|금색|금발|갈색|밤색|붉(?:은|게|었|다|고)|빨간|빨갛|빨갰|적색|분홍(?:색|빛)?|핑크(?:색|빛)?|푸른|푸르(?:다|게|렀)|파랬|파란|파랗게|청색|초록(?:색|빛)?|녹색|보라(?:색|빛)?|자주(?:색|빛)?|회색|잿빛|노란|노랗게|황금(?:색|빛)?|주황(?:색|빛)?|구릿빛|황갈색|호박색|청록(?:색|빛)?|남색|살구색|복숭아빛|상아색|우윳빛|창백한|창백하게|희고|희게|희었|희다|검고|검게|검었다|하얬|새하얀|새까만|짙은|옅은';
const jaColor = '黒(?:い|く|色)?|白(?:い|く|色)?|漆黒|純白|銀(?:色)?|金(?:色)?|茶色(?:い)?|栗色|赤(?:い|く|色)?|紅(?:い|く|色)?|青(?:い|く|色)?|蒼(?:い|く)?|緑(?:色)?|碧|翠|紫(?:色)?|灰色|黄色(?:い)?|桃色|桜色|橙色|褐色|小麦色|琥珀色|藍色|乳白色|色白|色黒|白銀|白金|亜麻色|薔薇色|ピンク|ブルー|グリーン|ブラウン|ブロンド|プラチナ|シルバー|ゴールド|オレンジ|アッシュ|カラフル|青白(?:い|く)|浅黒(?:い|く)';
const zhColor = '黑|乌黑|烏黑|漆黑|白|雪白|苍白|蒼白|白皙|白晳|白净|白淨|银|銀|金|棕|棕褐|褐|栗|红|紅|赤|绯红|緋紅|粉红|粉紅|粉|蓝|藍|蔚蓝|蔚藍|碧蓝|碧藍|绿|綠|翠绿|翠綠|碧绿|碧綠|紫|灰|银灰|銀灰|黄|黃|橙|青|深|浅|淺|琥珀|古铜|古銅|小麦|小麥|象牙|奶白|亚麻|亞麻|铂金|鉑金|酒红|酒紅|五颜六色|五顏六色';
const koFeature = '머리(?:카락|칼)?|모발|머리채|눈동자|홍채|눈빛|눈|피부|살결|안색|속눈썹|눈썹';
const jaFeature = '髪(?:の毛)?|頭髪|毛髪|瞳|目|眼|虹彩|肌|皮膚|睫毛|まつげ|眉毛|眉';
const zhFeature = '头发|頭髮|头髮|頭发|发丝|髮絲|髪|秀发|秀髮|眼睛|眼眸|瞳孔|虹膜|瞳色|眼珠|皮肤|皮膚|肌肤|肌膚|肤色|膚色|睫毛|眉毛';
const koLink = '(?:색|빛|빛깔)?(?:의|으로|로)?[ \\t]*(?:(?:칠한|물든|빛나는|염색한|윤기나는|긴|짧은|날카로운|반짝이는|매끈한|뾰족한|고운|부드러운)[ \\t]*){0,2}';
const jaLink = '(?:色|色の|の|く染まった|く塗った)?[ \\t]*(?:(?:長い|短い|鋭い|艶やかな|滑らかな|美しい)[ \\t]*){0,2}';
const zhLink = '(?:色)?(?:的)?[ \\t]*(?:(?:修长|修長|尖锐|尖銳|细长|細長|光滑|柔顺|柔順|柔软|柔軟|浓密|濃密|漂亮|长长|長長|短短)(?:的)?){0,2}';
function colored(featureKo, featureJa, featureZh) {
    return [
        `/(?:${koColor})${koLink}(?:${featureKo})/`,
        `/(?:${featureKo})(?:은|는|이|가|을|를|에|의|도)?[ \\t]*(?:${koColor})/`,
        `/(?:${jaColor})${jaLink}(?:${featureJa})/`,
        `/(?:${featureJa})(?:は|が|を|に|の|も)?[ \\t]*(?:${jaColor})/`,
        `/(?:${zhColor})${zhLink}(?:${featureZh})/`,
        `/(?:${featureZh})(?:呈现|呈現|是|呈|泛着|泛著|带着|帶著|有着|有著|染成|涂成|塗成|变成|變成|变得|變得)?[ \\t]*(?:深|浅|淺|淡|亮|暗)?(?:${zhColor})(?:色)?/`,
    ].join('\n');
}

// 장갑 줄 (upgrades.js 가 1.9.3 에 저장된 줄을 이것으로 바꾼다)
export const GLOVES_KO_1_9_3 = String.raw`/장갑(?!차|판|병|부대|을\s*두른)/`;
const GLOVES_KO = String.raw`/(?<![중경])장갑(?!차|판|병|부대|사단|열차|을\s*두른|\s+(?:차량|부대|사단|열차))/`;

export const MULTILINGUAL_WORDS = {
    glasses: ['eyeglass*, spectacle*, monocle*, rimless glasses, 안경, 외알안경, 뿔테, 금테안경, 은테안경, 테 없는 안경, 眼鏡, 眼镜, メガネ, めがね, モノクル, 片眼鏡, 单片眼镜, 單片眼鏡, ', String.raw`/(?:금|은|검은|검정|얇은|두꺼운)\s*테\s*안경/`].join('\n'),
    beard: ['whisker*, mutton-chops, soul patch*, chin beard*, chin stubble, unshaved', '수염, 턱수염, 콧수염, 구레나룻, 髭, 鬚, ひげ, ヒゲ, 無精髭, 顎髭, あごひげ, 口ひげ, もみあげ, 胡须, 鬍鬚, 胡子, 鬍子, 胡茬, 鬍茬, 络腮胡, 絡腮鬍, 山羊胡, 山羊鬍, 八字胡, 八字鬍, 鬓须, 鬢鬚', String.raw`/(?:턱|콧|입가|입술\s*위|얼굴|거뭇한|까슬한|덥수룩한)\s*(?:수염|털)/`, String.raw`/면도(?:를)?\s*(?:안\s*한|하지\s*않은)\s*(?:턱|얼굴)/`].join('\n'),
    tan: ['suntanned, sun-tan*, bronzed skin, bronzed complexion, sun-browned skin, 태닝, 썬탠, 선탠, 햇볕에 탄 피부, 햇빛에 탄 피부, 日焼け, 日やけ, 日に焼けた肌, 小麦色の肌, 褐色の肌, 晒黑, 曬黑, 晒成古铜色, 曬成古銅色, 日晒肌, 日曬肌, 小麦色皮肤, 小麥色皮膚', String.raw`/(?:그을린|그을은|구릿빛|구리빛|갈색으로\s*탄|검게\s*탄)\s*(?:피부|살결|얼굴)/`, String.raw`/(?:피부|살결|얼굴)(?:이|은|는|을|가)?[^.!?\n]{0,12}(?:그을|구릿빛|구리빛|햇볕에\s*탄)/`].join('\n'),
    cane: 'walking cane*, walking-stick*, 지팡이, 杖, つえ, ツエ, ステッキ, 杖をつ, 拐杖, 手杖, 文明棍',
    ears: ['pointy-eared, pointed-eared, elf-eared, elven ear*, pointed ear*, tapered ear*, 뾰족귀, 엘프귀, 요정귀, 尖り耳, 尖った耳, とがった耳, 尖ったエルフ耳, エルフ耳, エルフの耳, 尖耳, 精灵耳, 精靈耳, 妖精耳', String.raw`/(?:뾰족|뾰죽|날카롭|끝이\s*뾰족)[^.!?\n]{0,12}?귀/`, String.raw`/(?:귀|귓바퀴|귓끝)(?:의\s*끝)?(?:이|가|은|는)?\s*(?:뾰족|뾰죽|날카롭)/`, String.raw`/(?:尖った|尖り|とがった|エルフの)[^。！？\n]{0,8}?耳/`, String.raw`/耳(?:の先)?(?:が|は)?(?:尖|とが)/`, String.raw`/(?:尖尖|尖细|尖細|尖长|尖長|尖锐|尖銳)(?:的)?耳(?:朵)?|耳(?:朵|尖)(?:是|很|变得|變得)?尖/`].join('\n'),
    gray_nails: [colored('손톱|발톱|매니큐어|네일', '爪|マニキュア|ネイル', '指甲|趾甲|指甲油|甲油'), '색칠한 손톱, 칠한 손톱, 塗った爪, 塗られた爪, 涂色的指甲, 塗色的指甲', String.raw`/(?:회색|잿빛)\s*(?:발톱|손톱)|(?:灰色|银灰色|銀灰色)(?:的)?爪/`,
        // 1.9.1 색과 손톱 사이에 '악마의' 같은 낱말이 끼어도: 검은 악마의 손톱 · 붉은 짐승의 발톱 · 黒い悪魔の爪 · 黑色恶魔的爪
        String.raw`/(?:검은|검정|까만|새까만|흑색|검붉은|붉은|빨간|빨강|핏빛|푸른|파란|보라|자주|금색|은색|금빛|은빛|회색|잿빛|하얀|흰|백색|녹색|초록|분홍|핑크|노란|노랑)(?:색|빛)?\s*(?:[가-힣]{1,4}의\s*){1,2}(?:손톱|발톱)/`,
        String.raw`/(?:黒い|黒|赤い|赤|白い|白|青い|青|紫|金|銀|灰色|灰)(?:色)?(?:の)?(?:[^。！？\n]{1,6}の)(?:爪)/`,
        String.raw`/(?:黑|红|紅|白|紫|金|银|銀|灰|蓝|藍|绿|綠)(?:色)?(?:的)?(?:[^。！？\n]{1,6}的)(?:指甲|趾甲|爪)/`].join('\n'),
    // 1.9.3 — 장갑차 · 장갑판 (armour) are not gloves. 중장갑 · 경장갑 · 장갑 차량 (띄어 써도) 도 갑옷이다.
    gloves: ['fingerless glove*, leather-gloved, white-gloved, black-gloved, 手袋, てぶくろ, テブクロ, グローブ, 手套, 白手套, 黑手套, 皮手套', GLOVES_KO].join('\n'),
    horns: ['horn nub*,horn bud*, hornlet*, 뿔, 角が生え, 角の生え, 角を生や, 角を持, 角付き, つの, ツノ, 悪魔の角, 鬼の角, 鹿の角, 犄角, 鹿角, 牛角, 羊角, 魔角, 恶魔角, 惡魔角', String.raw`/(?:头上|頭上|额头|額頭|头顶|頭頂)[^。！？\n]{0,12}角/`, String.raw`/(?:二本|一本|2本|1本|一対|鋭い|尖った|曲がった|ねじれた)(?:の)?角/`].join('\n'),
    user_colors: [colored(koFeature,jaFeature,zhFeature), '금발, 은발, 흑발, 백발, 적발, 청안, 벽안, 녹안, 적안, 자안, 金髪, 銀髪, 黒髪, 白髪, 赤髪, 茶髪, 碧眼, 青眼, 紅眼, 金发, 金髮, 银发, 銀髮, 黑发, 黑髮, 白发, 白髮, 红发, 紅髮, 碧眼, 蓝眸, 藍眸'].join('\n'),
    fufu: [String.raw`/(?:う|ウ)?(?:ふ[ー〜～\s・]?ふ|フ[ー〜～\s・]?フ)+(?:っ|ッ)?/`, String.raw`/후[우\s~～-]*후(?:후|훗)?/`, String.raw`/\b(?:u?fu[ -]?fu(?:fu)*|hoo[ -]?hoo|hu[ -]?hu)\b/`, '呼呼, 呼呼呼, 呋呋, 呵呵, 呵呵呵'].join('\n'),
    chest_hair: ['chest-hair*, body-hair*, hirsute chest, furred chest, 가슴털, 가슴 털, 흉모, 체모, 몸털, 몸의 털, 배털, 배렛나루, 배레나룻, 배레나루, 복모, 胸毛, むな毛, むなげ, ムナゲ, 体毛, 體毛, 腹毛, 胸の毛, 胸の体毛, 胸部的毛, 胸前的毛, 肚毛, 腹部的毛', String.raw`/(?:가슴|흉부|복부|배)(?:에|의|를)?\s*(?:난|자란|덮은|뒤덮은|빽빽한|수북한|거뭇한)?\s*털/`, String.raw`/毛深い(?:胸|腹|胴)|(?:胸|腹|胴)の毛/`, String.raw`/(?:胸膛|胸口|胸部|腹部)(?:上|前)?(?:的)?(?:浓密|濃密|茂密|稠密)?(?:的)?(?:毛发|毛髮|汗毛)/`].join('\n'),
};

export const NOSTRIL_RULE = {
    id: 'nostril_flare', name: '코 벌렁거림', enabled: true,
    description: 'flaring, widening, or twitching the nostrils (코를 벌렁거리다, 鼻をひくひくさせる, 鼻翼翕动) — replace with another small reaction, keeping the rest of the scene and its language',
    words: [
        String.raw`/\bnostrils?\s+(?:(?:had|have|has|was|were|are|is|began\s+to|start(?:ed)?\s+to|slightly|briefly|visibly|involuntarily|suddenly)\s+){0,3}(?:flar\w*|dilat\w*|widen\w*|twitch\w*)\b/`,
        String.raw`/\b(?:flar\w*|dilat\w*|widen\w*|twitch\w*)\s+(?:(?:his|her|their|its|my|your|the|a|an|slightly)\s+){0,2}nostrils?\b/`,
        String.raw`/(?:콧구멍|콧방울|코)(?:이|가|은|는|을|를|도)?\s*(?:살짝|조금|크게|작게|한번|한\s*번|미세하게|연신|신경질적으로)?\s*(?:벌름|벌렁|벌룽|씰룩|실룩|들썩)/`,
        String.raw`/(?:벌름|벌렁|벌룽|씰룩|실룩)[^.!?\n]{0,10}?(?:콧구멍|콧방울|코)/`,
        String.raw`/(?:小鼻|鼻孔|鼻の穴|鼻)(?:が|を|は|も)?(?:少し|微かに|かすかに)?(?:ひくひく|ヒクヒク|ぴくぴく|ピクピク|ふくら|膨ら|広が|広げ|拡が|拡げ)/`,
        String.raw`/(?:ひくひく|ヒクヒク|ぴくぴく|ピクピク)(?:する|した|動く|動いた)?(?:小鼻|鼻孔|鼻)/`,
        String.raw`/(?:鼻翼|鼻孔|鼻子)(?:微微|轻轻|輕輕|轻微|輕微|不由|不禁|突然|在|正|一)?(?:地)?(?:翕动|翕動|翕张|翕張|张合|張合|张开|張開|扩张|擴張|扩张|煽动|煽動|扇动|扇動|抽动|抽動|颤动|顫動|一张一翕|一張一翕)/`,
        String.raw`/(?:翕动|翕動|扩张|擴張|抽动|抽動)(?:的)?(?:鼻翼|鼻孔)/`,
    ].join('\n'),
};

// Extend only pronouns already present in this rule's ownership restriction.
// A custom list restricted to a name stays restricted to that name.
export function multilingualNear(near) {
    const names = String(near || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    const lower = names.map(s => s.toLowerCase());
    if (lower.some(s => ['she', 'her', 'hers', 'herself'].includes(s))) names.push('그녀', '그녀의', '彼女', '她');
    if (lower.some(s => ['you', 'your', 'yours'].includes(s))) names.push('당신', '너의', '네', 'あなた', '君', '你', '您');
    return [...new Set(names)].join(', ');
}
