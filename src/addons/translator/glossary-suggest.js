// 6.4.5 새 이름 용어집 제안 — 번역한 뒤에도 용어집에 없는 인물 이름을 모아 번역 설정 › 용어집에서 칩 하나로 넣게 한다.
//   유료 호출은 더하지 않는다. 쓰는 것: ① 남김 다시 보내기(가나 · 한자 · 영어)가 이미 고쳐 온 줄 — 보낸 줄과 받은 줄을 낱말로 맞대어 바뀐 이름 짝(ミナ는 → 미나는)
//   ② 번역문의 한글 줄에 영어로 그대로 남은 이름(예: 내 페르소나 이름) ③ 그 이름의 한글 표기 — 다른 범위의 용어집 · 이름 다리(names-bridge)에서.
//   흔한 영어 낱말(Now · Well · 대명사 · 느낌말)은 6.4.3 영어 남김과 같은 판정(leftoverEnglish)으로 빼고, 영어가 주된 줄(트래커 · 상태 줄) ·
//   한글 없는 괄호 · 따옴표 · 태그 · 코드 · 주소 안은 보지 않는다. 모은 것은 용어집이 아니라 따로 둔다 — 번역 캐시 서명(setupDigest)에 안 들어간다.
// 짝에 붙은 호격 · 서술격 · 호칭 · 조사 · 대명사는 버린다(미나야 · 미나다 · 미나 씨 · 그녀). 의성어 · 웃음 · 되풀이꼴 · 끝 ッ · 직함 · 감탄 외래어는 짝이 아니다.
// 바로 칩(strong) = 내 페르소나 · 지금 캐릭터 이름(낱말 하나만 맞아도) · 원문에서 호칭(さん · くん …)이 붙은 가나 이름. 그 밖은 서로 다른 메시지 둘에서 나와야 칩.
// 칩에 보이는 것이 바뀔 때만 저장(changed) · 범위는 마지막으로 손댄 시각으로 줄 세움 · 페르소나 이름은 공통 칸(GLOBAL).
// 순수 함수 (시험: tools/tests/glossary-suggest.mjs)
import { leftoverEnglish } from './leftover-fix.js';
import { isNameLike, nameFold } from './names-bridge.js';

const HANGUL = /[가-힣]/;
const KATA_NAME = /^[ァ-ヺー]+(?:[・ ][ァ-ヺー]+)*$/;
const HANGUL_NAME = /^[가-힣]+(?: [가-힣]+){0,2}$/;   // 한 음절 이름도 (ジョン → 존 · ジャック → 잭 · Sam → 샘)
const LATIN_NAME = /^\p{Lu}[\p{Ll}\p{M}]+(?:\p{Lu}[\p{Ll}\p{M}]+)*(?:[ '’-]\p{Lu}[\p{Ll}\p{M}]+)?$/u;   // Rex · José · McKenna · Jean-Luc · Mina Park
// 대문자로 시작하는 낱말 하나 (José · Zoë · McKenna · Jean-Luc · O'Neil 꼴의 이어진 대문자 마디까지) — 앞뒤에 라틴 글자 · 따옴표 · 붙임표가 붙어 있으면 아니다 (한글 조사는 붙어도 된다: Mina는)
const WORD_RE = /(?<![\p{Script=Latin}\p{M}'’-])\p{Lu}[\p{Ll}\p{M}]*(?:\p{Lu}[\p{Ll}\p{M}]+)*(?:[-'’]\p{Lu}[\p{Ll}\p{M}]+)*(?![\p{Script=Latin}\p{M}'’-])/gu;
const count = (s, re) => (String(s).match(new RegExp(re.source, 'g' + re.flags.replace('g', ''))) || []).length;
export const MAX_ITEMS = 20, MAX_SKIP = 200, MAX_SCOPES = 60, SHOW = 8, MAX_KEYS = 6, MAX_VOTES = 4;
export const GLOBAL = 'global';   // 페르소나 이름 칸 — 모든 캐릭터에서 보이고 × 도 모두에 먹는다
const list = text => text.split(/\s+/).filter(Boolean);

// 이름이 아닌 대문자 낱말 — 범주 전체: 호칭 · 직함 · 칭호 · 외국어 존칭 · 로마자 호칭(다른 철자까지) · 애칭 · 욕 · 느낌말 · 외국어 인사 · 감탄 · 상표 · 요일 · 달
//   (흔한 낱말은 아래 commonWord 가 6.4.3 판정으로 뺀다. 사람 이름으로도 흔한 말 — Hope · Joy · Rose · Bella · Mia · Don · Dean · Earl · Mercedes · Honda 같은 것 — 은 넣지 않는다)
const NOT_NAMES = new Set(list(`Mr Mrs Ms Mx Miss Mister Missus Sir Madam Ma'am Madame Mademoiselle Monsieur Mme Mlle Lady Lord Dame King Queen Prince Princess Duke Duchess
Baron Baroness Count Countess Marquis Viscount Emperor Empress Majesty Highness Excellency Holiness Grace Lordship Ladyship Sire Milady Milord Saint Master Mistress
Captain Commander General Major Colonel Lieutenant Sergeant Corporal Private Admiral Marshal Officer Detective Inspector Constable Sheriff Deputy Agent Ranger Soldier Knight Squire
Doctor Dr Doc Nurse Professor Teacher Principal Student Coach Trainer Judge Mayor President Minister Senator Governor Chancellor Secretary Director Manager Chairman Chief Boss
Reverend Pastor Priest Priestess Bishop Cardinal Pope Nun Monk Chef Cook Maid Servant Guard Bodyguard Leader Partner Assistant Owner Hero Heroine Villain Champion Guardian Elder
Herr Frau Fraulein Fräulein Senor Señor Senora Señora Senorita Señorita Signor Signore Signora Signorina Sra Sr
Sensei Senpai Sempai Kouhai Kohai Shishou Shisho Sama San Kun Chan Dono Chama Hime Ojou Ojousama Bocchan Goshujinsama Shujin Danna Dannasama Heika Denka Tono Ouji Oujisama
Onii Onee Nii Nee Niisan Neesan Oniisan Oneesan Oniichan Oneechan Oniisama Oneesama Aniki Aneki Aniue Aneue Okaasan Otousan Kaasan Tousan Obaasan Ojiisan Baachan Jiichan
Oppa Oraboni Hyung Hyeong Unnie Unni Onni Eonni Noona Nuna Nuuna Sunbae Sunbe Seonbae Sunbaenim Hoobae Hubae Ahjussi Ajusshi Ajeossi Ajussi Ahjumma Ajumma Ajumeoni
Seonsaengnim Sonsaengnim Sajangnim Agassi Agasshi Doryeonnim Juinnim Abeoji Eomma Appa Halmeoni Harabeoji Imo Samchon
Father Mother Mom Mum Dad Papa Mama Daddy Mommy Brother Sister Uncle Aunt Auntie Grandpa Grandma Grandmother Grandfather Granny
Baby Babe Darling Honey Dear Sweetie Sweetheart Dude Bro Sis Buddy Pal Mate Kid Idiot Fool Moron Bastard Jerk Baka Aho Boke
Damn Shit Fuck Fucking Geez Jeez Gosh Oops Yay Bye Hmph Pfft Psst Ahem Whatever Seriously Really Hehe Lol Lmao Omg Ok Okay Kyaa Kya Nya Nyaa Ehh Ehe
Fufu Ufufu Ara Ahaha Haha Hahaha Wahh Waa Hah Hoh Phew Tsk Meh Yo Yup Welp Duh Ew Eww Yikes Wow Whoa Hmm Huh Ugh Argh Gah Bah Ow Ouch Oof Eek Shh Boo
Hooray Hurray Huzzah Yippee Amen Hallelujah Bingo Bravo Brava Cheers Goodbye Welcome Thank Thanks Hello Hey Hi Howdy Greetings Farewell Sorry Please Congrats Congratulations
Kawaii Sugoi Sugee Nani Naze Hai Iie Arigato Arigatou Sayonara Sayounara Ohayo Ohayou Konnichiwa Konbanwa Oyasumi Itadakimasu Tadaima Okaeri Gomen Gomenasai Sumimasen
Daijoubu Yatta Yamete Yamero Uso Maji Yabai Mou Etto Hora Naruhodo Ganbatte Ganbare Kanpai Kampai Desu
Aigoo Aigo Daebak Hwaiting Fighting Jinjja Jinja Omo Omona Heol Annyeong Annyeonghaseyo Gamsahamnida Kamsahamnida Saranghae Mianhae Mianhaeyo Aniyo Gwaenchana
Merci Gracias Bonjour Bonsoir Salut Hola Adios Adiós Ciao Grazie Prego Danke Bitte Nein Oui Voila Voilà Amigo Amiga Chérie Dios Madre Pardon Scusi Prost Salud
Shalom Namaste Aloha Nihao Xiexie Zaijian Spasibo Privet Nyet Mamma
Netflix Starbucks Discord Instagram Pokemon Pokémon Google Youtube YouTube Twitter Facebook Tiktok TikTok Samsung Kakao KakaoTalk Naver Amazon Uber Spotify Nintendo
Playstation PlayStation Xbox Steam Twitch Reddit Snapchat Whatsapp WhatsApp Telegram Skype Tinder Coca Pepsi McDonald McDonalds Disney Marvel Pixar Lego Nike Adidas
Gucci Prada Chanel Vuitton Rolex Hyundai Lamborghini Porsche Sony Microsoft Windows Android Chrome Firefox Gmail Wikipedia
ChatGPT OpenAI Paypal PayPal Ikea Costco Walmart Coupang Minecraft Fortnite Roblox Genshin
Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December
God Heaven Hell Christmas Halloween English Japanese Korean Chinese French German Status Location Time Date Weather Mood Note Notes Info Chapter Scene`));

// 가나로 쓴 직함 · 역할 · 호칭어 · 애칭 · 가족 호칭 · 감탄 · 인사 외래어 — 이름이 아니다 (「ボス、」「マスター！」 처럼 부르는 자리에 와도)
const KANA_NOT_NAMES = new Set(list(`マスター ボス ダーリン ハニー ベイビー ベイベー ベビー ベイブ リーダー シスター ブラザー プリンセス プリンス マダム ムッシュ ムッシュー マドモアゼル
コーチ キャプテン ドクター ナース シェフ コック メイド バトラー マネージャー マネージャ パートナー ミストレス レディ レディー ロード サー ミスター ミス ミセス キング クイーン
エンペラー ジェネラル コマンダー オフィサー ティーチャー センセイ プロフェッサー オーナー チーフ ディレクター プレジデント シェリフ エージェント ガード ボディガード ボディーガード
パイロット ポリス ドライバー ウェイター ウェイトレス バーテンダー バーテン スタッフ ディーラー プロデューサー アイドル スター モデル ダンサー シンガー パティシエ ファーザー マザー
ママ パパ ダディ ダディー マミー マム ダッド ブロ シス バディ ボーイ ガール ヒーロー ヒロイン ヴィラン ジーザス
ナイス ラッキー アンラッキー ストップ ビンゴ ブラボー アウト セーフ オーケー オッケー オーケイ オーライ グッド グッジョブ サンキュー サンクス センキュー ソーリー ハロー ハーイ
バイバイ バイ グッバイ ウェルカム チャンス ゴー ファイト ドンマイ オーマイガー オーマイゴッド ガッデム シット ファック ワオ ワーオ ヘイ ハイ イエス ノー ヒャッハー
ジャジャーン ジャーン タダー オッス ウッス チース チッス ハッピー サプライズ スタート ゴール ラスト ネクスト`));

// 짝의 한글 쪽이 사람 이름이 아닌 말 — 대명사 · 사람을 가리키는 흔한 말 · 호칭 · 직함 · 감탄 외래어
const NOT_NAME_KO = new Set(list(`그 그녀 그들 그녀들 그것 그건 그게 저 저것 이것 나 너 너희 당신 우리 자기 그분 이분 저분 그애 얘 쟤 걔 소녀 소년 남자 여자 녀석
언니 오빠 누나 형 동생 선배 후배 아가씨 도련님 주인 주인님 아저씨 아줌마 할머니 할아버지 어머니 아버지 엄마 아빠 선생님 사장님 아가 공주 왕자 폐하 전하
보스 마스터 달링 허니 베이비 리더 시스터 브라더 프린세스 프린스 마담 코치 캡틴 닥터 셰프 쉐프 메이드 너스 버틀러 매니저 파트너 레이디 미스터 미세스 퀸 히어로 히로인
오너 치프 마마 파파 대디 마미 나이스 럭키 스톱 빙고 브라보 아웃 세이프 오케이 땡큐 쏘리 헬로 바이바이 굿바이 웰컴 찬스 파이팅 화이팅 짜잔 자잔 와우 헤이 예스 오마이갓 지저스`));
// 받은 쪽 이름 끝에 붙어 남은 꼬리 — 호격 · 서술격 · 호칭 · 조사 (보낸 쪽 낱말이 「이름 + 문장부호 · 끝」 이었는데 받은 쪽에만 생긴 것)
const KO_TAILS = list('이여 이야 이다 에게 한테 야 여 다 씨 님 군 양 가 이 는 은 를 을 의 도 와 과 랑 께');

/** 6.4.3 영어 남김과 같은 판정으로 흔한 낱말인가 (Now · Well · The · Oh …) — 영어 원문 줄 · 한글 번역 줄 하나로 물어본다 (판정이 바뀌어도 따라간다) */
const commonMemo = new Map();
export function commonWord(word) {
    const w = String(word ?? '');
    if (!commonMemo.has(w)) {
        if (commonMemo.size > 4000) commonMemo.clear();
        commonMemo.set(w, leftoverEnglish(`${w}, 가나다라마`, `${w}, the end.`).includes(w));
    }
    return commonMemo.get(w);
}

/** Comments can contain repeated openers; advance once through each closed or unfinished block. */
function withoutComments(text) {
    const s = String(text ?? ''), out = [];
    let from = 0;
    for (;;) {
        const open = s.indexOf('<!--', from);
        if (open < 0) { out.push(s.slice(from)); break; }
        out.push(s.slice(from, open), ' ');
        const close = s.indexOf('-->', open + 4);
        if (close < 0) break;
        from = close + 3;
    }
    return out.join('');
}

/** Keep prose outside fenced and raw code, including unfinished blocks. Each line/tag is visited once. */
function withoutCodeBlocks(text) {
    const s = String(text ?? ''), raw = [], out = [];
    let fence = '', width = 0, from = 0;
    const tokens = /^ {0,3}(`{3,}|~{3,})([^\n]*)|<\/?(pre|code)\b[^<>]*>/gim;
    for (const match of s.matchAll(tokens)) {
        if (!fence && !raw.length) out.push(s.slice(from, match.index));
        if (match[1]) {
            if (!raw.length) {
                if (!fence) { fence = match[1][0]; width = match[1].length; }
                else if (match[1][0] === fence && match[1].length >= width && /^[ \t\r]*$/.test(match[2])) fence = '';
            }
        } else if (!fence) {
            const tag = match[3].toLowerCase();
            if (match[0].startsWith('</')) { if (raw.at(-1) === tag) raw.pop(); }
            else if (!/\/\s*>$/.test(match[0])) raw.push(tag);
        }
        from = match.index + match[0].length;
        if (!fence && !raw.length) out.push(' ');
    }
    if (!fence && !raw.length) out.push(s.slice(from));
    return out.join('');
}

/** 이름이 아닌 글자를 지운 줄 — 태그 · 자리표시자 · 인라인 코드 · 주소 · 한글 없는 괄호 · 따옴표 안 (영어 남김 · 한자 남김의 지킴 자리와 같은 뜻) */
export function nameScanText(line) {
    let s = withoutComments(line).replace(/<[^<>\n]*>/g, ' ').replace(/\[\[\/?__VAR_\d+__\]\]/g, ' ').replace(/`[^`\n]*`/g, ' ')
        .replace(/https?:\/\/\S+/g, ' ');
    for (const re of [/[(（]([^()（）\n]*)[)）]/g, /「([^「」\n]*)」/g, /『([^『』\n]*)』/g, /"([^"\n]*)"/g, /“([^“”\n]*)”/g, /‘([^‘’\n]*)’/g, /\[([^\[\]\n]*)\]/g, /【([^【】\n]*)】/g, /《([^《》\n]*)》/g, /〈([^〈〉\n]*)〉/g]) {
        s = s.replace(re, (all, inner) => (HANGUL.test(inner) ? all : ' '));
    }
    return s;
}

/** 한글이 주된 줄인가 (영어가 주된 트래커 · 상태 줄은 아니다) */
const koreanLine = s => count(s, /[가-힣]/) > count(s, /\p{Script=Latin}/u) + count(s, /[ぁ-ゖァ-ヺ]/) + count(s, /\p{Script=Han}/u);
const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');   // 붙임표는 묶음 밖이라 그대로 (u 정규식에서 \- 는 틀린 글)
/** 글 속에 그 꼴이 낱말로 있나 (앞뒤에 라틴 글자가 붙지 않은 자리 — 한글 조사는 붙어도 된다) */
const wordRe = (word, flags = 'u') => new RegExp(`(?<![\\p{Script=Latin}\\p{M}])${escapeRe(word)}(?![\\p{Script=Latin}\\p{M}])`, flags);
const wordIn = (word, text) => wordRe(word).test(String(text ?? ''));
/** 이름의 낱말들 (접은 꼴) — 'Mina Park' → { mina park, mina, park } · 'Jean-Luc' → { jean luc, jean, luc } */
function nameKeys(name) {
    const whole = nameFold(name);
    return new Set(whole ? [whole, ...whole.split(' ')].filter(Boolean) : []);
}

/**
 * 번역문의 한글 줄에 영어로 그대로 남은 이름 — 원문에도 그 꼴로 있고, 흔한 낱말 · 호칭 · 칭호 · 느낌말 · 상표 · 대문자 약어가 아닌 것.
 * strong 은 내 페르소나 · 지금 캐릭터 이름(이름의 낱말 하나만 맞아도) — 그 밖은 서로 다른 메시지 둘에서 나와야 칩. 페르소나 이름은 persona 표시(공통 칸으로).
 * 두 낱말 이상인 페르소나 · 캐릭터 이름이 줄에 통째로 있으면 그 이름 하나로 묶는다. 페르소나 · 캐릭터 이름은 이름 아님 목록보다 먼저다.
 * 돌려줌: [{ src, strong, persona }]
 */
export function leftoverNameWords(text, source, { persona = '', character = '' } = {}) {
    const src = withoutCodeBlocks(source);
    if (!src) return [];
    const me = nameKeys(persona), them = nameKeys(character);
    const out = new Map();
    const add = word => {
        if (out.has(word)) return;
        const k = nameFold(word);
        const mine = me.has(k), theirs = them.has(k);
        if (!mine && !theirs && (word.length > 12 || NOT_NAMES.has(word) || commonWord(word))) return;
        if (!wordIn(word, src)) return;   // 원문에 그 꼴로 있던 말만
        out.set(word, { src: word, strong: mine || theirs, persona: mine });
    };
    const wholes = [persona, character].map(n => String(n ?? '').trim()).filter(n => /\s/.test(n) && /^\p{Lu}/u.test(n) && n.length <= 24);
    for (const raw of withoutCodeBlocks(text).split('\n')) {
        let line = nameScanText(raw);
        if (!HANGUL.test(line) || !koreanLine(line)) continue;
        for (const whole of wholes) {
            if (!wordIn(whole, line) || !wordIn(whole, src)) continue;
            add(whole);
            line = line.replace(wordRe(whole, 'gu'), ' ');
        }
        for (const m of line.matchAll(WORD_RE)) if (/\p{Ll}/u.test(m[0])) add(m[0]);   // 대문자 약어(HP · OK)는 아니다
    }
    return [...out.values()];
}

/** 낱말 나누기 (빈칸) */
const words = s => String(s ?? '').trim().split(/\s+/).filter(Boolean);

/** 두 낱말 줄의 맞대기 — 같지 않은 덩이 [[옛 낱말들], [새 낱말들]] (가장 긴 같은 낱말 차례를 빼고) */
function hunks(a, b) {
    const n = a.length, m = b.length;
    if (!n || !m || n * m > 90000) return [];
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = [];
    let i = 0, j = 0, oa = [], ob = [];
    const flush = () => { if (oa.length || ob.length) out.push([oa, ob]); oa = []; ob = []; };
    while (i < n || j < m) {
        if (i < n && j < m && a[i] === b[j]) { flush(); i++; j++; }
        else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) ob.push(b[j++]);
        else oa.push(a[i++]);
    }
    flush();
    return out;
}

/** 앞뒤 같은 글자를 걷어낸 가운데 + 걷어낸 앞 · 뒤 (조사 · 따옴표 · 문장부호가 붙어 있어도) */
function core(x, y) {
    let a = 0;
    while (a < x.length && a < y.length && x[a] === y[a]) a++;
    let b = 0;
    while (b < x.length - a && b < y.length - a && x[x.length - 1 - b] === y[y.length - 1 - b]) b++;
    return { src: x.slice(a, x.length - b), dst: y.slice(a, y.length - b), tail: x.slice(x.length - b) };
}

// 소리 견주기 — 가나 한 박마다 그럴 법한 한글 첫 자음 · 모음 (첫 자음 ㄱ0 ㄲ1 ㄴ2 ㄷ3 ㄸ4 ㄹ5 ㅁ6 ㅂ7 ㅃ8 ㅅ9 ㅆ10 ㅇ11 ㅈ12 ㅉ13 ㅊ14 ㅋ15 ㅌ16 ㅍ17 ㅎ18 ·
//   모음 ㅏ0 ㅐ1 ㅑ2 ㅒ3 ㅓ4 ㅔ5 ㅕ6 ㅖ7 ㅗ8 ㅘ9 ㅙ10 ㅚ11 ㅛ12 ㅜ13 ㅝ14 ㅞ15 ㅟ16 ㅠ17 ㅡ18 ㅢ19 ㅣ20). 이름 둘의 차례가 바뀐 짝(ミナ → 마리)을 거른다.
const KANA_CONS = { ア: [11], カ: [15, 0, 1], ガ: [0], サ: [9, 10], ザ: [12, 13, 9], タ: [3, 16, 4], ダ: [3], ナ: [2], ハ: [18], バ: [7], パ: [17, 8], マ: [6], ヤ: [11], ラ: [5], ワ: [11] };
const KANA_GRID = { ア: 'アイウエオ', カ: 'カキクケコ', ガ: 'ガギグゲゴ', サ: 'サシスセソ', ザ: 'ザジズゼゾ', タ: 'タチツテト', ダ: 'ダヂヅデド', ナ: 'ナニヌネノ', ハ: 'ハヒフヘホ',
    バ: 'バビブベボ', パ: 'パピプペポ', マ: 'マミムメモ', ヤ: 'ヤ_ユ_ヨ', ラ: 'ラリルレロ', ワ: 'ワ___ヲ' };
const KANA_SPECIAL = { チ: [14, 12], ツ: [14, 10, 13], ヂ: [12], ヅ: [12], フ: [18, 17], ヴ: [7] };
// 모음 — ア 줄은 ㅐ 도(アリス → 앨리스 · ハリー → 해리), オ 줄은 ㅡ 도(ト → 트), ワ 는 ㅝ 도(エドワード → 에드워드)
const VOWELS = { a: [0, 1, 2, 4, 9], i: [20, 16, 19], u: [13, 18, 17], e: [5, 1, 7, 3, 15], o: [8, 12, 14, 4, 18] };
const VOWEL_EXTRA = { ワ: [14] };
const SMALL = { ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o', ャ: 'a', ュ: 'u', ョ: 'o', ヮ: 'a' };
const Y_VOWELS = new Set([2, 3, 6, 7, 12, 17]);   // ㅑ ㅒ ㅕ ㅖ ㅛ ㅠ — ヤ 줄 · 작은 ャュョ 박에서만 나는 소리
const KANA_INFO = (() => {
    const info = new Map();
    for (const [head, row] of Object.entries(KANA_GRID)) [...row].forEach((ch, i) => { if (ch !== '_') info.set(ch, { cons: KANA_SPECIAL[ch] ?? KANA_CONS[head], vowel: 'aiueo'[i], extra: VOWEL_EXTRA[ch] ?? [], yv: head === 'ヤ' }); });
    info.set('ヴ', { cons: [7], vowel: 'u', extra: [], yv: false });
    return info;
})();
/** 가나 → 박 [{ cons, vowel, extra, yv }] — 작은 가나는 앞 박의 모음을 바꾸고, ン · ッ · ー · ・ 는 박이 아니다 (한글에서는 받침이거나 없다) */
function kanaBeatsOf(s) {
    const beats = [];
    for (const ch of String(s)) {
        if (SMALL[ch]) { if (beats.length) beats[beats.length - 1] = { ...beats[beats.length - 1], vowel: SMALL[ch], extra: [], yv: 'ャュョ'.includes(ch) }; continue; }
        const info = KANA_INFO.get(ch);
        if (info) beats.push(info);
    }
    return beats;
}
const syllable = ko => { const c = String(ko).charCodeAt(0) - 0xAC00; return c >= 0 && c < 11172 ? { cons: Math.floor(c / 588), vowel: Math.floor((c % 588) / 28), jong: c % 28 } : null; };
const LATIN_HEADS = [['ch', [14, 15, 9]], ['sh', [9]], ['th', [9, 3, 16]], ['ph', [17]], ['kh', [15]], ['a', [11]], ['e', [11]], ['i', [11]], ['o', [11]], ['u', [11]], ['y', [11]],
    ['w', [11]], ['h', [18, 11]], ['b', [7]], ['c', [15, 9, 14]], ['d', [3]], ['f', [17]], ['g', [0, 12]], ['j', [12, 18]], ['k', [15, 0]], ['l', [5]], ['m', [6]], ['n', [2]],
    ['p', [17]], ['q', [15]], ['r', [5]], ['s', [9, 10]], ['t', [16, 3]], ['v', [7]], ['x', [12, 9]], ['z', [12]]];
const latinBare = s => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/**
 * 소리가 맞나 — 가나: 첫 박의 자음 · 모음이 한글 첫 음절과 맞고(첫 ラ 줄은 ㄴ · ㅇ 도 · 두음), 박 수와 음절 수가 같으면 끝 박의 자음도 맞아야 한다
 *   (가운데 박 · 끝 모음은 보지 않는다 — ジェームズ → 제임스 · クロエ → 클로이). 영어: 첫 글자(ch · sh · th · ph 는 두 글자)로 첫 자음만.
 */
function soundMatch(src, dst) {
    const syl = [...String(dst).replace(/ /g, '')].map(syllable);
    if (!syl.length || syl.some(x => !x)) return false;
    if (KATA_NAME.test(src)) {
        const beats = kanaBeatsOf(src);
        if (!beats.length) return false;
        const first = beats[0], s0 = syl[0];
        const consOk = first.cons.includes(s0.cons) || (first.cons[0] === 5 && (s0.cons === 2 || s0.cons === 11));
        if (!consOk || !(VOWELS[first.vowel].includes(s0.vowel) || first.extra.includes(s0.vowel))) return false;
        if (beats.length !== syl.length || beats.length < 2) return true;
        return beats[beats.length - 1].cons.includes(syl[syl.length - 1].cons);
    }
    const low = latinBare(src), head = LATIN_HEADS.find(([h]) => low.startsWith(h));
    return Boolean(head) && head[1].includes(syl[0].cons);
}
/** 박 수 · 모라 수(ン · ッ · ー 도 하나) · 한글 음절이 박보다 늘 수 있는 자리 수(ー · イ · ィ · ン · ッ — グレース → 그레이스 · ジェーン → 제인 · デヴィッド → 데이비드) */
const kanaBeats = s => kanaBeatsOf(s).length;
const kanaMora = s => kanaBeats(s) + count(s, /[ンッー]/);
const kanaStretch = s => count(s, /[ーイィンッ]/);
/** 의성어 · 웃음 — 두 글자 넘는 덩이의 되풀이(ドキドキ · ジャジャーン) · 같은 글자 셋(ククク) · 끝 ッ(フフッ) · ハ 줄 웃음(ハハ · アハハ · ギャハハ · デュフフ).
 *  한 글자 되풀이 이름(ナナ · モモ · ココ)은 이름이다 */
const onomatopoeia = s => /^(.{2,})\1/u.test(s) || /^(.)\1{2,}/u.test(s) || /ッ$/.test(s) || /^(?:.{1,2})?[ハヒフヘホ]{2,}[ッー]?$/u.test(s);
/** 받은 쪽 되풀이 — 두 글자 넘는 덩이(두근두근) · 웃음 소리 끝(하하 · 갸하하 · 무후후 · 니히히 · 킥킥) */
const koRepeat = s => /^(.{2,})\1+$/u.test(s) || /([하후히헤호흐크킥쿡낄깔껄킬큭])\1+$/u.test(s);

/** 받은 쪽 끝의 꼬리 후보 — 짧은 것부터 [{ tail, head }] */
const tailsOf = dst => KO_TAILS.filter(t => dst.endsWith(t) && dst.length > t.length).sort((a, b) => a.length - b.length).map(tail => ({ tail, head: dst.slice(0, -tail.length) }));
/** 한글 음절이 가나 끝 박의 소리 그대로인가 — 자음 · 모음 (エ → 이 는 맞음: クロエ → 클로이 · ㅑ ㅕ ㅛ ㅠ 는 ヤ 줄 · 작은 ャュョ 박만: ア → 야 는 아님) */
const beatSound = (s, beat) => Boolean(s && beat) && beat.cons.includes(s.cons) && (beat.yv || !Y_VOWELS.has(s.vowel))
    && (VOWELS[beat.vowel].includes(s.vowel) || beat.extra.includes(s.vowel) || (beat.vowel === 'e' && s.vowel === 20));
/**
 * 가나 짝의 꼬리 — 꼬리를 뗀 앞이 이름 소리 · 길이를 갖추고, ① 한글 음절이 박보다 많거나(ミナ → 미나야) ② 끝 음절이 가나 끝 박의 소리가 아닐 때
 * (レックス → 렉스씨 · ジャック → 잭가 · ユウキ → 유키가 · ヴィクトリア → 빅토리아야). ユイ → 유이 · タクヤ → 타쿠야 · ハウン → 하은 은 끝 박 소리라 이름.
 */
function kanaTail(kana, flat, beats, room) {
    const cut = tailsOf(flat).some(({ head }) => head.length <= room && soundMatch(kana, head));
    if (!cut) return false;
    return flat.length > beats || !beatSound(syllable(flat[flat.length - 1]), kanaBeatsOf(kana).at(-1));
}
// 영어 이름 끝소리 — 끝 모음 글자와 그 앞 자음 글자 (모음 사이 y 는 자음: Maya · Freya · Takuya). 끝이 「자음 + e」 면 소리 없는 e 로 보고 자음 끝 (Kate · Jade)
const LATIN_V = { a: [0, 1, 2, 4, 9, 14], e: [5, 1, 20, 18], i: [20, 16], o: [8, 12, 14], u: [13, 17, 18], y: [20] };
const LATIN_C = { '': [11], b: [7], c: [15, 9, 14], d: [3], f: [17], g: [0, 12], h: [18, 11], j: [12], k: [15, 0], l: [5], m: [6], n: [2], p: [17], q: [15], r: [5], s: [9, 10],
    t: [16, 3], v: [7], w: [11], x: [9], Y: [11], z: [12] };
function latinEnd(name) {
    const w = latinBare(String(name).split(/[ '’-]/).pop()).replace(/([aeiou])y(?=[aeiou])/g, '$1Y');
    const m = w.match(/([^aeiouy]?)([aeiouy]+)$/);
    if (!m || (m[2] === 'e' && m[1] && w.length > 3)) return null;
    const vowel = m[2].slice(-1), before = m[2].length > 1 ? '' : m[1];
    return { vowel, cons: before };
}
/**
 * 영어 짝의 꼬리 — 꼬리를 뗀 앞이 이름 소리일 때, 이름이 자음으로 끝나거나(Rex → 렉스야) 앞이 이미 이름 끝소리를 가졌거나(Mina → 미나야 · Freya → 프레야이야)
 * 한 음절 꼬리가 이름 끝소리가 아니면(Mina → 미나다) 꼬리. Linda → 린다 · Kai → 카이 · Freya → 프레야 · Ida → 아이다 는 끝소리라 이름.
 */
function latinTail(src, dst) {
    const end = latinEnd(src);
    const fits = s => Boolean(s && end) && LATIN_V[end.vowel].includes(s.vowel) && (LATIN_C[end.cons] ?? []).includes(s.cons);
    return tailsOf(dst.replace(/ /g, '')).some(({ tail, head }) => {
        if (!soundMatch(src, head)) return false;
        if (!end) return true;
        const last = syllable(head[head.length - 1]);
        const carried = Boolean(last) && last.jong === 0 && fits(last);   // 앞 음절이 이미 이름 끝소리를 가졌다 (미나 + 야)
        return carried || (tail.length === 1 && !fits(syllable(tail)));
    });
}

/** 낱말 하나 짝(보낸 낱말 o · 받은 낱말 n) — 이름 짝이면 { src, dst }, 아니면 null */
function pieceRow(o, n) {
    const edge = s => s.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '').trim();   // 앞뒤 문장부호 · 따옴표는 이름이 아니다 (「ミナ、 → 「미나,)
    const c = core(o, n);
    const src = edge(c.src), dst = edge(c.dst);
    if (!src || !dst || !HANGUL_NAME.test(dst) || dst.length > 12) return null;
    if (NOT_NAME_KO.has(dst) || koRepeat(dst.replace(/ /g, ''))) return null;   // 대명사 · 사람을 가리키는 말 · 직함 · 되풀이 한글 · 웃음
    if (src.split(/[・ ]/).length !== dst.split(' ').length) return null;   // 미나 씨 · 미나 언니 (낱말 수가 늘었다)
    const bare = !HANGUL.test(c.tail);   // 걷은 뒤쪽에 한글 조사가 없었다 — 받은 쪽에만 붙은 꼬리가 있을 수 있다
    const flat = dst.replace(/ /g, '');
    if (KATA_NAME.test(src)) {
        const kana = src.replace(/[・ ]/g, '');
        if (KANA_NOT_NAMES.has(kana) || onomatopoeia(kana) || kanaMora(kana) < 2) return null;
        const beats = kanaBeats(kana), room = beats + kanaStretch(kana);
        if (bare && kanaTail(kana, flat, beats, room)) return null;   // 받은 쪽에만 붙은 꼬리 (소리 길이 · 끝 박 소리로)
        if (flat.length > room) return null;   // 소리 길이
    } else {
        const first = src.split(/[ '’-]/)[0];
        if (!LATIN_NAME.test(src) || NOT_NAMES.has(first) || commonWord(first)) return null;
        if (bare && latinTail(src, dst)) return null;
    }
    if (!isNameLike(src.replace(/['’-]/g, ' ')) || !soundMatch(src, dst)) return null;   // 소리 (ミナ → 미나 · レ → ㄹ · R → ㄹ)
    return { src, dst };
}

/**
 * 남김 다시 보내기로 고쳐 온 줄에서 이름 짝 — 보낸 줄(line)과 받은 줄(fixed)을 낱말로 맞대어, 바뀐 덩이가 「가타카나 이름 → 한글」 또는
 * 「영어 이름 → 한글」 인 자리만 (ミナ는 → 미나는 · Rex가 → 렉스가). 같은 수의 낱말이 바뀐 덩이에 이름이 둘 넘게 있으면, 자리대로 맞댄 짝 말고
 * 엇갈린 짝도 맞을 수 있으면(이름 차례를 바꾼 답) 그 덩이는 버린다. 돌려줌: [{ src, dst }]
 */
export function fixPairs(line, fixed) {
    const out = [];
    const push = row => { if (row && !out.some(p => p.src === row.src)) out.push(row); };
    for (const [oa, ob] of hunks(words(line), words(fixed))) {
        if (!oa.length || !ob.length || oa.length > 3 || ob.length > 3) continue;
        if (oa.length === ob.length && oa.length > 1) {
            const rows = oa.map((w, i) => pieceRow(w, ob[i]));
            const named = rows.map((r, i) => (r ? i : -1)).filter(i => i >= 0);
            const crossed = named.some(i => oa.some((w, j) => j !== i && pieceRow(oa[i], ob[j])));
            if (named.length > 1 && crossed) continue;   // 이름 둘의 차례가 바뀌었을 수 있다 — 버린다 (놓침 쪽)
            rows.forEach(push);
        } else push(pieceRow(oa.join(' '), ob.join(' ')));
    }
    return out;
}

/**
 * 원문에서 그 가나 표기 뒤에 호칭(さん · くん · 君 · ちゃん · 様 · さま · 殿 · 先輩 · 先生 · 氏 · 嬢 · たん · ちゃま)이 붙었나 — 이때만 바로 칩.
 * 부르는 자리(「X！」 · X、)는 직함 · 감탄 외래어(ボス、 · ナイス！)도 흔해서 서로 다른 메시지 둘 규칙으로 돌린다.
 */
export function namePlace(source, src) {
    const x = escapeRe(src);
    return Boolean(x) && new RegExp(`(?<![\\p{Script=Katakana}\\p{M}ー・ｰ･])${x}(?:さん|くん|君|ちゃん|様|さま|殿|先輩|先生|氏|嬢|たん|ちゃま)`, 'u').test(withoutCodeBlocks(source));
}

/** 짝에 표시를 단다 — 가나 짝은 원문에서 호칭이 붙었을 때 · 어느 짝이든 내 페르소나 · 지금 캐릭터 이름(낱말 하나만 맞아도)이면 strong, 페르소나 이름은 persona (공통 칸으로) */
export function markPairs(pairs, source, { persona = '', character = '' } = {}) {
    const me = nameKeys(persona), them = nameKeys(character);
    return (Array.isArray(pairs) ? pairs : []).map(p => {
        const k = nameFold(p.src);
        const named = Boolean(k) && (me.has(k) || them.has(k));
        return { ...p, strong: named || (KATA_NAME.test(p.src) && namePlace(source, p.src)), persona: Boolean(k) && me.has(k) };
    });
}

/** 같은 원문인지 셀 열쇠 (짧은 해시) — 같은 메시지를 다시 번역 · 스와이프해도 센 수가 오르지 않게 (번역 · 다시 번역 모두 같은 원문으로 만든다) */
export function textKey(text) {
    let h = 0x811c9dc5;
    for (const ch of String(text ?? '')) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
}

/** 범위 하나의 저장 꼴 { items: [{ src, dst, n, at, strong, keys, votes }], skip: [접은 표기], seen: 마지막으로 손댄 시각 } */
export function suggestBox(box) {
    const items = Array.isArray(box?.items) ? box.items.filter(it => it && typeof it.src === 'string' && it.src.trim()).map(it => ({
        src: it.src.trim(), dst: typeof it.dst === 'string' ? it.dst.trim() : '', n: Math.max(1, Number(it.n) || 1), at: Number(it.at) || 0, strong: it.strong === true,
        keys: Array.isArray(it.keys) ? it.keys.filter(k => typeof k === 'string').slice(-MAX_KEYS) : [],
        votes: it.votes && typeof it.votes === 'object' && !Array.isArray(it.votes) ? Object.fromEntries(Object.entries(it.votes).filter(([k, v]) => k && Number(v) > 0).slice(0, MAX_VOTES)) : {} })) : [];
    const skip = Array.isArray(box?.skip) ? box.skip.filter(s => typeof s === 'string' && s) : [];
    return { items, skip, seen: Number(box?.seen) || 0 };
}

const visible = it => it.strong || it.n >= 2;
const topVote = votes => Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
/** 칩에 보일 것의 모양 — 보이는 항목(최근 순 SHOW 개)의 표기와 한글 표기. 차례는 보지 않는다 (같은 이름이 다시 나와 앞으로 와도 저장하지 않게) */
const shownShape = items => items.filter(visible).sort((a, b) => b.at - a.at).slice(0, SHOW).map(it => `${nameFold(it.src)}\u0001${it.dst}`).sort().join('\u0002');

/**
 * 찾은 것 [{ src, dst?, strong? }] 을 범위 저장에 더한다 — 같은 표기(nameFold)는 하나로, 센 수는 서로 다른 원문(key)마다 한 번,
 * 한글 표기는 나온 표기 가운데 가장 많은 것. 접어 둔 표기 · 이미 용어집에 있는 표기(have)는 넣지 않는다.
 * MAX_ITEMS 를 넘으면 안 보이는 것부터, 오래된 것부터 버린다 (보이는 칩이 안 보이는 새 항목에 밀려나지 않게).
 * 돌려줌 { box, changed } — changed 는 칩에 보이는 것(표기 · 한글 표기)이 달라질 때만 → 그때만 저장 · 다시 그리기.
 *   안 보이는 새 항목 · 센 수만 오른 것은 메모리에만 두고 다음 설정 저장 때 함께 나간다.
 */
export function mergeSuggestions(box, found, { now = Date.now(), have = new Set(), key = '' } = {}) {
    const { items, skip, seen } = suggestBox(box);
    const before = shownShape(items);
    const skipped = new Set(skip);
    for (const f of Array.isArray(found) ? found : []) {
        const src = String(f?.src ?? '').trim(), k = nameFold(src);
        if (!src || !k || skipped.has(k) || have.has(k)) continue;
        const dst = String(f?.dst ?? '').trim();
        let it = items.find(x => nameFold(x.src) === k);
        if (!it) {
            it = { src, dst: '', n: 0, at: now, strong: false, keys: [], votes: {} };
            items.push(it);
        }
        const fresh = !key || !it.keys.includes(key);   // 같은 원문이 다시 오면(다시 번역 · 스와이프 · 캐시) 세지도 표를 더하지도 않는다
        if (fresh) { it.n += 1; it.at = now; if (key) it.keys = [...it.keys, key].slice(-MAX_KEYS); }
        if (dst && fresh) {
            if (!(dst in it.votes) && Object.keys(it.votes).length >= MAX_VOTES) delete it.votes[Object.entries(it.votes).sort((a, b) => a[1] - b[1])[0][0]];
            it.votes[dst] = (it.votes[dst] || 0) + 1;
            it.dst = topVote(it.votes);
        }
        if (f?.strong === true) it.strong = true;
    }
    items.sort((a, b) => b.at - a.at);
    let kept = items;
    if (items.length > MAX_ITEMS) {
        const shown = items.filter(visible).slice(0, MAX_ITEMS);
        const keep = new Set([...shown, ...items.filter(it => !visible(it)).slice(0, MAX_ITEMS - shown.length)]);
        kept = items.filter(it => keep.has(it));
    }
    const changed = shownShape(kept) !== before;
    return { box: { items: kept, skip: skip.slice(-MAX_SKIP), seen: changed ? now : seen }, changed };
}

/** 칩으로 보일 것 — 용어집에 이미 있으면 빼고, 확실한 것이나 서로 다른 메시지 둘에서 나온 것만, 최근 순 SHOW 개 */
export function shownSuggestions(box, { have = new Set(), dstOf = () => '' } = {}) {
    const { items, skip } = suggestBox(box);
    const skipped = new Set(skip);
    return items.filter(it => !have.has(nameFold(it.src)) && !skipped.has(nameFold(it.src)) && visible(it))
        .slice(0, SHOW).map(it => ({ src: it.src, dst: it.dst || String(dstOf(it.src) ?? '').trim() }));
}

/** 접기 — 그 표기를 다시 제안하지 않는다 */
export function skipSuggestion(box, src, now = Date.now()) {
    const { items, skip } = suggestBox(box), k = nameFold(src);
    return { items: items.filter(it => nameFold(it.src) !== k), skip: skip.includes(k) ? skip : [...skip, k].slice(-MAX_SKIP), seen: now };
}

/** 넣은 뒤 — 목록에서만 뺀다 (용어집에 있으니 다시 모이지 않는다) */
export function dropSuggestion(box, src, now = Date.now()) {
    const { items, skip } = suggestBox(box), k = nameFold(src);
    return { items: items.filter(it => nameFold(it.src) !== k), skip, seen: now };
}

/** 범위가 너무 많으면 마지막으로 손댄 시각(seen · 항목 at)이 오래된 범위부터 버린다 — 칩을 다 접어 비운 범위도 접은 기록과 함께 남는다 */
export function trimScopes(all) {
    const entries = Object.entries(all && typeof all === 'object' && !Array.isArray(all) ? all : {});
    if (entries.length <= MAX_SCOPES) return Object.fromEntries(entries);
    const last = raw => { const box = suggestBox(raw); return Math.max(box.seen, 0, ...box.items.map(it => it.at)); };
    return Object.fromEntries(entries.sort((a, b) => (a[0] === GLOBAL ? -1 : b[0] === GLOBAL ? 1 : last(b[1]) - last(a[1]))).slice(0, MAX_SCOPES));
}
