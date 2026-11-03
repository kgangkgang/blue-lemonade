// 1.0.0 다른 에이드 11벌(레몬 블루 · 리얼 블랙 · 멜론 · 자몽 · 피치 · 라벤더 · 딸기 · 민트 · 오렌지 · 우드 · 수박)과 커스텀 에이드.
//   8.2.5 의 palettes.js 와 같은 색 · 이름이에요(tools/tests/palettes-restored.mjs 가 8.2.5 계산값과 견줘요). 저장된 id 도 그대로라 옛 설정이 그대로 읽혀요.
//   시작 그래프 밖: palettes.js ensurePalettes 가 설정 창 · 그 팔레트를 쓸 때 받아 PALETTES · PALETTE_FAMILIES 에 채워요.
import { PALETTES, PALETTE_FAMILIES, PALETTE_NEUTRALS, parseColor } from './palettes.js';

const RAW = {
    'black-light': {
        label: '리얼 블랙에이드 · 화이트', mode: 'light', bg: '#FCFCFC', surface: '#FEFEFE', raised: '#EEEEEE', text: '#2E2E2E', dialogue: '#1F1F1F', em: '#696969', strong: '#525252', muted: '#6C6C6C', faint: '#888888', danger: '#E23B2E', accent: '#5C5C5C', pop: '#5C5C5C', brand: '#5C5C5C', marker: 'rgba(140, 140, 140, 0.22)', gold: 'rgba(189, 189, 189, 0.16)', line: 'rgba(51, 51, 51, 0.07)', shadow: 'rgba(64, 64, 64, 0.12)',
    },
    black: {
        label: '리얼 블랙에이드 · 나이트', mode: 'dark', bg: '#141414', surface: '#1F1F1F', raised: '#2E2E2E', text: '#E3E3E3', dialogue: '#F7F7F7', em: '#B3B3B3', strong: '#CCCCCC', muted: '#BDBDBD', faint: '#999999', danger: '#FF6F62', accent: '#D6D6D6', pop: '#D6D6D6', brand: '#D6D6D6', marker: 'rgba(153, 153, 153, 0.2)', gold: 'rgba(214, 214, 214, 0)', line: 'rgba(204, 204, 204, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
    melon: {
        label: '멜론 에이드 · 화이트', mode: 'light', bg: '#FCFEF9', surface: '#FEFFFD', raised: '#EDF9DE', text: '#2F3A22', dialogue: '#1F2A14', em: '#4E7631', strong: '#3B7A18', muted: '#63764F', faint: '#7E9366', danger: '#E23B2E', accent: '#4B831F', pop: '#BBEA83', brand: '#BBEA83', marker: 'rgba(168, 238, 100, 0.34)', gold: 'rgba(219, 248, 129, 0.48)', line: 'rgba(52, 71, 31, 0.07)', shadow: 'rgba(66, 92, 35, 0.12)',
    },
    'melon-night': {
        label: '멜론 에이드 · 나이트', mode: 'dark', bg: '#212919', surface: '#2B3423', raised: '#3B4431', text: '#E3EBDB', dialogue: '#F7FCF3', em: '#BDDEA3', strong: '#D3F99F', muted: '#BDCEAB', faint: '#99AD85', danger: '#FF6F62', accent: '#CAF59E', pop: '#CAF59E', brand: '#CAF59E', marker: 'rgba(185, 245, 112, 0.32)', gold: 'rgba(193, 242, 125, 0)', line: 'rgba(204, 224, 184, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
    grapefruit: {
        label: '자몽 에이드 · 화이트', mode: 'light', bg: '#FFFAF9', surface: '#FFFDFD', raised: '#FFE7E0', text: '#3A2722', dialogue: '#2A1814', em: '#AB4F50', strong: '#AE4146', muted: '#856259', faint: '#9F7D75', danger: '#E23B2E', accent: '#C34B43', pop: '#FF9C95', brand: '#FF9C95', marker: 'rgba(255, 132, 129, 0.32)', gold: 'rgba(255, 184, 148, 0.36)', line: 'rgba(71, 39, 31, 0.07)', shadow: 'rgba(92, 47, 35, 0.12)',
    },
    'grapefruit-night': {
        label: '자몽 에이드 · 나이트', mode: 'dark', bg: '#2C1A17', surface: '#37231F', raised: '#49312D', text: '#EBDDDB', dialogue: '#FCF4F3', em: '#E9B6B2', strong: '#F9B19F', muted: '#CEB1AB', faint: '#AD8B85', danger: '#FF6F62', accent: '#FFB0A8', pop: '#FFB0A8', brand: '#FFB0A8', marker: 'rgba(255, 141, 139, 0.33)', gold: 'rgba(243, 156, 134, 0)', line: 'rgba(224, 190, 184, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
    peach: {
        label: '피치 에이드 · 화이트', mode: 'light', bg: '#FFFCF9', surface: '#FFFEFD', raised: '#FFEDDE', text: '#3A2D22', dialogue: '#2A1E14', em: '#985D45', strong: '#A75031', muted: '#7F6855', faint: '#9D8672', danger: '#E23B2E', accent: '#B45B37', pop: '#FFC19C', brand: '#FFC19C', marker: 'rgba(255, 184, 143, 0.40)', gold: 'rgba(248, 197, 129, 0.42)', line: 'rgba(71, 50, 31, 0.07)', shadow: 'rgba(92, 62, 35, 0.12)',
    },
    'peach-night': {
        label: '피치 에이드 · 나이트', mode: 'dark', bg: '#2B1F17', surface: '#372920', raised: '#48382E', text: '#EBE1DB', dialogue: '#FCF6F3', em: '#EBC4AC', strong: '#FBCBA7', muted: '#CEB9AB', faint: '#AD9585', danger: '#FF6F62', accent: '#FFCEA9', pop: '#FFCEA9', brand: '#FFCEA9', marker: 'rgba(255, 182, 130, 0.32)', gold: 'rgba(244, 187, 144, 0)', line: 'rgba(224, 200, 184, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
    lemon: {
        label: '레몬 블루에이드 · 화이트', mode: 'light', bg: '#F9FCFF', surface: '#FDFEFF', raised: '#E5F1FF', text: '#222D3A', dialogue: '#141E2A', em: '#336FA6', strong: '#2264A5', muted: '#5A6F87', faint: '#75889F', danger: '#E23B2E', accent: '#2477D3', pop: '#F6E77A', marker: 'rgba(255, 232, 83, 0.43)', gold: 'rgba(20, 165, 255, 0.30)', line: 'rgba(31, 50, 71, 0.07)', shadow: 'rgba(35, 62, 92, 0.12)',
    },
    // 대사 글자는 흰색, 레몬은 반투명 띠(블루 레몬에이드의 파란 띠와 같은 세기)에만
    'lemon-night': {
        label: '레몬 블루에이드 · 나이트', mode: 'dark', bg: '#141F2E', surface: '#1C293B', raised: '#28384D', text: '#DBE2EB', dialogue: '#F3F7FC', em: '#A4C7ED', strong: '#93C9FF', muted: '#ABBACE', faint: '#8596AD', danger: '#FF6F62', accent: '#93C9FF', pop: '#FFF095', marker: 'rgba(255, 237, 112, 0.30)', gold: 'rgba(125, 184, 242, 0)', line: 'rgba(184, 201, 224, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
};
const markerNames = { 'black-light': '차콜', black: '회색', melon: '라임', 'melon-night': '라임', grapefruit: '코럴', 'grapefruit-night': '코럴', peach: '피치', 'peach-night': '피치', lemon: '노란', 'lemon-night': '노란' };
const { light: neutralLight, night: neutralNight, surfaceKeys } = PALETTE_NEUTRALS;
const added = {};
for (const [id, palette] of Object.entries(RAW)) {
    const base = palette.mode === 'dark' ? neutralNight : PALETTES.salt;
    for (const key of surfaceKeys) palette[key] = base[key];
    palette.desc = `${markerNames[id]} 형광펜`;
    added[id] = palette;
}
// 포인트색 하나로 만드는 여섯 벌 (id · 이름 · 형광펜 이름 · 화이트 포인트 · 나이트 포인트 · 형광펜 rgb)
const SIMPLE = [
    ['lavender', '라벤더', '보라', '#7B51BC', '#D0B5FF', '183, 139, 246'],
    ['strawberry', '딸기', '분홍', '#BB427B', '#FFB1D0', '250, 130, 182'],
    ['mint', '민트', '청록', '#117D73', '#9AE9DA', '89, 218, 196'],
    ['orange', '오렌지', '주황', '#B55E20', '#FFCA93', '255, 179, 103'],
    ['wood', '우드', '갈색', '#795E49', '#D4BDA6', '180, 143, 108'],
    ['watermelon', '수박', '초록', '#218044', '#9AE5AD', '69, 201, 108'],
];
for (const [id, name, markerName, light, dark, rgb] of SIMPLE) {
    for (const mode of ['light', 'dark']) {
        const base = mode === 'dark' ? PALETTES.night : PALETTES.salt;
        const accent = mode === 'dark' ? dark : light;
        added[id + (mode === 'dark' ? '-night' : '')] = { ...base,
            label: `${name} 에이드 · ${mode === 'dark' ? '나이트' : '화이트'}`, desc: `${markerName} 형광펜`,
            accent, pop: accent, brand: accent, strong: accent, em: accent,
            marker: `rgba(${rgb}, ${mode === 'dark' ? .32 : .28})`, gold: `rgba(${rgb}, ${mode === 'dark' ? .18 : .2})`,
        };
    }
}
Object.assign(added.watermelon, { em: '#1A7B40', strong: '#BC3851', pop: '#E9617C', gold: 'rgba(221, 70, 90, 0.22)' });
Object.assign(added['watermelon-night'], { strong: '#FFA3B6', pop: '#FFA3B6', gold: 'rgba(235, 99, 120, 0.20)' });
// 화이트 속마음 · 강조: 포인트색 그대로는 흰 바탕 · 내 말풍선 위에서 4.5:1 이 안 돼 한 단계 진하게 (버튼 · 선택 표시 등 포인트색은 그대로)
for (const [id, ink] of [['strawberry', '#B73E78'], ['mint', '#087970'], ['orange', '#AA5412']]) Object.assign(added[id], { em: ink, strong: ink });
// 기본 바탕 물들이기: 화이트 0.5% · 차콜 1% (palettes.js 의 밤 · 낮과 같은 계산)
for (const palette of Object.values(added)) {
    const dark = palette.mode === 'dark', amount = dark ? .01 : .005;
    const tint = parseColor(palette.accent);
    for (const key of ['bg', 'surface', 'raised']) {
        const base = parseColor((dark ? neutralNight : neutralLight)[key]);
        palette[key] = '#' + base.slice(0, 3).map((v, i) => Math.round(v * (1 - amount) + tint[i] * amount).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
}
added['custom-light'] = { ...PALETTES.salt, label: '커스텀 에이드 · 화이트' };
added['custom-night'] = { ...PALETTES.night, label: '커스텀 에이드 · 나이트' };
Object.assign(PALETTES, added);
// 고르기 카드 차례
Object.assign(PALETTE_FAMILIES, {
    lemon: { label: '레몬 블루에이드', sample: '레몬 블루', light: 'lemon', dark: 'lemon-night' },
    black: { label: '리얼 블랙에이드', sample: '리얼 블랙', light: 'black-light', dark: 'black' },
    melon: { label: '멜론 에이드', sample: '멜론', light: 'melon', dark: 'melon-night' },
    grapefruit: { label: '자몽 에이드', sample: '자몽', light: 'grapefruit', dark: 'grapefruit-night' },
    peach: { label: '피치 에이드', sample: '피치', light: 'peach', dark: 'peach-night' },
    ...Object.fromEntries(SIMPLE.map(([id, name]) => [id, { label: `${name} 에이드`, sample: name, light: id, dark: id + '-night' }])),
    custom: { label: '커스텀 에이드', sample: '나만의', light: 'custom-light', dark: 'custom-night' },
});
