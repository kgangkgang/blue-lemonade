// 에이드 팔레트. 화이트/나이트 바탕을 공유하고 형광펜과 포인트색으로 구분한다.
export const PALETTES = {
    salt: {
        label: '블루 레몬에이드 · 화이트', desc: '하늘빛 흰 종이 · 파란 형광펜', mode: 'light', bg: '#F9FCFF', surface: '#FDFEFF', raised: '#E5F1FF', text: '#222D3A', dialogue: '#141E2A', em: '#476990', strong: '#1F4E84', muted: '#5A6F87', faint: '#75889F', danger: '#E23B2E', accent: '#2775CE', pop: '#2775CE', marker: 'rgba(20, 165, 255, 0.24)', gold: 'rgba(255, 226, 60, 0.62)', line: 'rgba(31, 50, 71, 0.07)', shadow: 'rgba(35, 62, 92, 0.12)',
    },
    night: {
        label: '블루 아워', desc: '푸른 밤 · 파란 형광펜 · 레몬 강조', mode: 'dark', bg: '#141F2E', surface: '#1C293B', raised: '#28384D', text: '#DBE2EB', dialogue: '#F3F7FC', em: '#97AFCE', strong: '#FFE873', muted: '#ABBACE', faint: '#8596AD', danger: '#FF6F62', accent: '#7DB8F2', pop: '#FFE873', marker: 'rgba(66, 141, 240, 0.4)', gold: 'rgba(255, 232, 115, 0)', line: 'rgba(184, 201, 224, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
    'black-light': {
        label: '리얼 블랙에이드 · 화이트', desc: '흰 종이 · 차콜', mode: 'light', bg: '#FCFCFC', surface: '#FEFEFE', raised: '#EEEEEE', text: '#2E2E2E', dialogue: '#1F1F1F', em: '#6B6B6B', strong: '#525252', muted: '#6C6C6C', faint: '#888888', danger: '#E23B2E', accent: '#5C5C5C', pop: '#5C5C5C', brand: '#5C5C5C', marker: 'rgba(140, 140, 140, 0.22)', gold: 'rgba(189, 189, 189, 0.16)', line: 'rgba(51, 51, 51, 0.07)', shadow: 'rgba(64, 64, 64, 0.12)',
    },
    black: {
        label: '리얼 블랙에이드 · 나이트', desc: '검정 · 분필', mode: 'dark', bg: '#141414', surface: '#1F1F1F', raised: '#2E2E2E', text: '#E3E3E3', dialogue: '#F7F7F7', em: '#B3B3B3', strong: '#CCCCCC', muted: '#BDBDBD', faint: '#999999', danger: '#FF6F62', accent: '#D6D6D6', pop: '#D6D6D6', brand: '#D6D6D6', marker: 'rgba(153, 153, 153, 0.2)', gold: 'rgba(214, 214, 214, 0)', line: 'rgba(204, 204, 204, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
    melon: {
        label: '멜론 에이드 · 화이트', desc: '허니듀 흰 종이 · 라임 형광펜', mode: 'light', bg: '#FCFEF9', surface: '#FEFFFD', raised: '#EDF9DE', text: '#2F3A22', dialogue: '#1F2A14', em: '#5D793C', strong: '#54821F', muted: '#63764F', faint: '#7E9366', danger: '#E23B2E', accent: '#508118', pop: '#AEE363', brand: '#AEE363', marker: 'rgba(172, 243, 73, 0.32)', gold: 'rgba(219, 248, 129, 0.48)', line: 'rgba(52, 71, 31, 0.07)', shadow: 'rgba(66, 92, 35, 0.12)',
    },
    'melon-night': {
        label: '멜론 에이드 · 나이트', desc: '초록 밤 · 파스텔 라임', mode: 'dark', bg: '#212919', surface: '#2B3423', raised: '#3B4431', text: '#E3EBDB', dialogue: '#F7FCF3', em: '#B3CE97', strong: '#D3F99F', muted: '#BDCEAB', faint: '#99AD85', danger: '#FF6F62', accent: '#C1F27D', pop: '#C1F27D', brand: '#C1F27D', marker: 'rgba(167, 240, 66, 0.32)', gold: 'rgba(193, 242, 125, 0)', line: 'rgba(204, 224, 184, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
    grapefruit: {
        label: '자몽 에이드 · 화이트', desc: '자몽빛 흰 종이 · 코럴 형광펜', mode: 'light', bg: '#FFFAF9', surface: '#FFFDFD', raised: '#FFE7E0', text: '#3A2722', dialogue: '#2A1814', em: '#905547', strong: '#84301F', muted: '#856259', faint: '#9F7D75', danger: '#E23B2E', accent: '#CA3D21', pop: '#EE7E68', brand: '#EE7E68', marker: 'rgba(245, 117, 92, 0.3)', gold: 'rgba(248, 169, 129, 0.38)', line: 'rgba(71, 39, 31, 0.07)', shadow: 'rgba(92, 47, 35, 0.12)',
    },
    'grapefruit-night': {
        label: '자몽 에이드 · 나이트', desc: '코럴 밤 · 파스텔 자몽', mode: 'dark', bg: '#2C1A17', surface: '#37231F', raised: '#49312D', text: '#EBDDDB', dialogue: '#FCF4F3', em: '#CEA097', strong: '#F9B19F', muted: '#CEB1AB', faint: '#AD8B85', danger: '#FF6F62', accent: '#F39C86', pop: '#F39C86', brand: '#F39C86', marker: 'rgba(240, 95, 66, 0.32)', gold: 'rgba(243, 156, 134, 0)', line: 'rgba(224, 190, 184, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
    peach: {
        label: '피치 에이드 · 화이트', desc: '복숭아빛 흰 종이 · 피치 형광펜', mode: 'light', bg: '#FFFCF9', surface: '#FFFEFD', raised: '#FFEDDE', text: '#3A2D22', dialogue: '#2A1E14', em: '#8A6544', strong: '#84471F', muted: '#7F6855', faint: '#9D8672', danger: '#E23B2E', accent: '#BA5A19', pop: '#F7B27E', brand: '#F7B27E', marker: 'rgba(246, 170, 111, 0.36)', gold: 'rgba(248, 197, 129, 0.42)', line: 'rgba(71, 50, 31, 0.07)', shadow: 'rgba(92, 62, 35, 0.12)',
    },
    'peach-night': {
        label: '피치 에이드 · 나이트', desc: '복숭아 밤 · 파스텔 피치', mode: 'dark', bg: '#2B1F17', surface: '#372920', raised: '#48382E', text: '#EBE1DB', dialogue: '#FCF6F3', em: '#CEAD97', strong: '#FBCBA7', muted: '#CEB9AB', faint: '#AD9585', danger: '#FF6F62', accent: '#F4BB90', pop: '#F4BB90', brand: '#F4BB90', marker: 'rgba(240, 141, 66, 0.3)', gold: 'rgba(244, 187, 144, 0)', line: 'rgba(224, 200, 184, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
    lemon: {
        label: '레몬 블루에이드 · 화이트', desc: '흰 종이 · 노란 형광펜 · 파란 강조', mode: 'light', bg: '#F9FCFF', surface: '#FDFEFF', raised: '#E5F1FF', text: '#222D3A', dialogue: '#141E2A', em: '#476990', strong: '#1F4E84', muted: '#5A6F87', faint: '#75889F', danger: '#E23B2E', accent: '#2775CE', pop: '#F2DE5F', marker: 'rgba(242, 223, 54, 0.48)', gold: 'rgba(20, 165, 255, 0.30)', line: 'rgba(31, 50, 71, 0.07)', shadow: 'rgba(35, 62, 92, 0.12)',
    },
    'lemon-night': {
        label: '레몬 블루에이드 · 나이트', desc: '푸른 밤 · 레몬 형광펜 · 파란 강조', mode: 'dark', /* 대사 글자는 흰색(사용자: "글자가 노란색이라니까 흰색으로"), 레몬은 반투명 띠(블루 레몬에이드의 파란 띠와 같은 세기)에만 */ bg: '#141F2E', surface: '#1C293B', raised: '#28384D', text: '#DBE2EB', dialogue: '#F3F7FC', em: '#97AFCE', strong: '#7DB8F2', muted: '#ABBACE', faint: '#8596AD', danger: '#FF6F62', accent: '#7DB8F2', pop: '#FFE873', marker: 'rgba(255, 226, 60, 0.3)', gold: 'rgba(125, 184, 242, 0)', line: 'rgba(184, 201, 224, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)',
    },
};
// Keep old stock surfaces identifiable when migrating saved default overrides.
const previousSurfaces = {};
const surfaceKeys = ['bg', 'surface', 'raised', 'line', 'shadow', 'text', 'dialogue', 'muted', 'faint'];
const neutralNight = {bg:'#1B1C1F', surface:'#242529', raised:'#303136', line:'rgba(224, 224, 228, 0.09)', shadow:'rgba(0, 0, 0, 0.6)', text:'#E1E1E5', dialogue:'#F5F5F7', muted:'#B8B8C0', faint:'#95959F'};
const markerNames = {salt:'파란',night:'파란','black-light':'차콜',black:'회색',melon:'라임','melon-night':'라임',grapefruit:'코럴','grapefruit-night':'코럴',peach:'피치','peach-night':'피치',lemon:'노란','lemon-night':'노란'};
for (const [id, palette] of Object.entries(PALETTES)) {
    previousSurfaces[id] = Object.fromEntries(surfaceKeys.map(key => [key, palette[key]]));
    const base = palette.mode === 'dark' ? neutralNight : PALETTES.salt;
    for (const key of surfaceKeys) palette[key] = base[key];
    palette.desc = `${markerNames[id]} 형광펜`;
}
const newAdes = [
    ['lavender','라벤더','보라','#7552B3','#BCA4ED','163, 127, 219'],
    ['strawberry','딸기','분홍','#B63C72','#F19BBC','230, 112, 157'],
    ['mint','민트','청록','#137B73','#76D6C7','72, 196, 177'],
    ['orange','오렌지','주황','#B25B19','#F3B06F','244, 161, 81'],
    ['wood','우드','갈색','#765D4C','#C6AD98','151, 119, 93'],
    ['watermelon','수박','초록','#247345','#78C995','49, 171, 93'],
];
for (const [id, name, markerName, light, dark, rgb] of newAdes) {
    for (const mode of ['light', 'dark']) {
        const base = mode === 'dark' ? PALETTES.night : PALETTES.salt;
        const accent = mode === 'dark' ? dark : light;
        PALETTES[id + (mode === 'dark' ? '-night' : '')] = { ...base,
            label: `${name} 에이드 · ${mode === 'dark' ? '나이트' : '화이트'}`, desc: `${markerName} 형광펜`,
            accent, pop: accent, brand: accent, strong: accent, em: accent,
            marker: `rgba(${rgb}, ${mode === 'dark' ? .32 : .28})`, gold: `rgba(${rgb}, ${mode === 'dark' ? .18 : .2})`,
        };
    }
}
Object.assign(PALETTES.watermelon, {strong:'#B83747', pop:'#CE4758', gold:'rgba(221, 70, 90, 0.22)'});
Object.assign(PALETTES['watermelon-night'], {strong:'#F28B99', pop:'#F28B99', gold:'rgba(235, 99, 120, 0.20)'});
PALETTES.night.label = '블루 레몬에이드 · 나이트';
// Charcoal remains dominant: only 1% of the accent tints night surfaces.
for (const palette of Object.values(PALETTES)) {
    if (palette.mode !== 'dark') continue;
    const tint = parseColor(palette.accent);
    for (const key of ['bg', 'surface', 'raised']) {
        const base = parseColor(neutralNight[key]);
        palette[key] = '#' + base.slice(0,3).map((v,i) => Math.round(v * .99 + tint[i] * .01).toString(16).padStart(2,'0')).join('').toUpperCase();
    }
}
PALETTES['custom-light'] = { ...PALETTES.salt, label: '커스텀 에이드 · 화이트' };
PALETTES['custom-night'] = { ...PALETTES.night, label: '커스텀 에이드 · 나이트' };

// 저장된 salt/night 키와 직접 고친 색은 그대로 둔다. 화면에서만 색상과 밝기를 나누어 고른다.
// pastelLight/pastelDark: 파스텔 스위치를 켰을 때 (커스텀은 파스텔판이 없어 그대로)
export const PALETTE_FAMILIES = {
    blue: { label: '블루 레몬에이드', sample: '블루 레몬', light: 'salt', dark: 'night' },
    lemon: { label: '레몬 블루에이드', sample: '레몬 블루', light: 'lemon', dark: 'lemon-night' },
    black: { label: '리얼 블랙에이드', sample: '리얼 블랙', light: 'black-light', dark: 'black' },
    melon: { label: '멜론 에이드', sample: '멜론', light: 'melon', dark: 'melon-night' },
    grapefruit: { label: '자몽 에이드', sample: '자몽', light: 'grapefruit', dark: 'grapefruit-night' },
    peach: { label: '피치 에이드', sample: '피치', light: 'peach', dark: 'peach-night' },
    ...Object.fromEntries(newAdes.map(([id,name]) => [id,{label:`${name} 에이드`,sample:name,light:id,dark:id+'-night'}])),
    custom: { label: '커스텀 에이드', sample: '나만의', light: 'custom-light', dark: 'custom-night' },
};

export function paletteFamily(id) {
    return Object.keys(PALETTE_FAMILIES).find(key => {
        const family = PALETTE_FAMILIES[key];
        return family.light === id || family.dark === id;
    }) || 'blue';
}

export function paletteVariant(family, mode) {
    return (PALETTE_FAMILIES[family] || PALETTE_FAMILIES.blue)[mode === 'dark' ? 'dark' : 'light'];
}

// 없어진 테마 → 남은 테마 (1.8.2~1.9.1 의 파스텔 스위치 id 도 원래 id 로)
export const PALETTE_ALIASES = { sea: 'salt', rock: 'salt', ink: 'night', ...Object.fromEntries(['salt', 'night', 'black-light', 'black', 'melon', 'melon-night', 'grapefruit', 'grapefruit-night', 'peach', 'peach-night', 'lemon', 'lemon-night'].map(id => [id + '-pastel', id])) };

// 예전 기본값들. 1.0.0 은 색 고르기 칸이 열리기만 해도 전부 "직접 고친 색"으로 저장되는 버그가 있어서,
// 예전 기본값과 같은 값은 지워야 새 기본 색이 보임 (apply.js dropStaleOverrides). 파스텔 정착 전 색과 1.8.2~1.9.1 의 -pastel 판도 여기에.
export const LEGACY = {
    salt: [
        { bg: '#F4F2EE', surface: '#FFFFFF', raised: '#ECE9E3', text: '#2A2B2E', dialogue: '#1B1C1F', em: '#86888E', muted: '#6D6F75', faint: '#A6A7AC', accent: '#6A8CA8', marker: 'rgba(122, 162, 204, 0.28)', line: 'rgba(28, 30, 36, 0.09)', shadow: 'rgba(30, 32, 40, 0.12)' },
        { bg: '#F5F4F0', surface: '#FFFFFF', raised: '#EEECE7', text: '#202225', dialogue: '#121316', em: '#7B7E86', strong: '#121316', muted: '#6A6D74', faint: '#A4A7AD', accent: '#4A7FA6', marker: 'rgba(96, 156, 206, 0.24)', line: 'rgba(28, 30, 36, 0.08)', shadow: 'rgba(24, 28, 36, 0.14)' },
        { bg: '#F1F8FD', surface: '#FFFFFF', raised: '#DFEEF9', text: '#1C252E', dialogue: '#0F2238', em: '#50708C', strong: '#141B22', muted: '#56697A', faint: '#778EA2', danger: '#D0231A', accent: '#0E6BCB', marker: 'rgba(20, 165, 255, 0.24)', gold: 'rgba(255, 226, 60, 0.62)', line: 'rgba(15, 34, 56, 0.08)', shadow: 'rgba(15, 34, 56, 0.14)' },
        { bg: '#F6FAFF', surface: '#FBFDFF', raised: '#E0EFFF', text: '#222D3A', dialogue: '#141E2A', em: '#476990', strong: '#1F4E84', muted: '#596D85', faint: '#75889F', danger: '#E23B2E', accent: '#2774CB', pop: '#2774CB', brand: '#2774CB', marker: 'rgba(20, 165, 255, 0.24)', gold: 'rgba(255, 226, 60, 0.62)', line: 'rgba(31, 50, 71, 0.07)', shadow: 'rgba(35, 62, 92, 0.12)' },
        { bg: '#F6FAFF', surface: '#FBFDFF', raised: '#E0EFFF', text: '#222D3A', dialogue: '#141E2A', em: '#476990', strong: '#1F4E84', muted: '#596D85', faint: '#75889F', danger: '#E23B2E', accent: '#2774CB', pop: '#2774CB', marker: 'rgba(20, 165, 255, 0.24)', gold: 'rgba(255, 226, 60, 0.62)', line: 'rgba(31, 50, 71, 0.07)', shadow: 'rgba(35, 62, 92, 0.12)' },
    ],
    night: [
        { bg: '#0C1117', surface: '#121922', raised: '#1A2430', text: '#CFD9E0', dialogue: '#ECF8FA', em: '#7F939F', muted: '#84959F', faint: '#566874', accent: '#5CD3E6', marker: 'rgba(72, 212, 232, 0.20)', line: 'rgba(160, 230, 245, 0.08)', shadow: 'rgba(0, 0, 0, 0.55)' },
        { bg: '#0B1117', surface: '#121A22', raised: '#1B2530', text: '#D6DFE6', dialogue: '#F2FBFD', em: '#8B9EAB', strong: '#F2FBFD', muted: '#8A9BA7', faint: '#586973', accent: '#52D2E4', marker: 'rgba(72, 212, 232, 0.20)', line: 'rgba(160, 230, 245, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)' },
        { bg: '#071C2E', surface: '#0F2A43', raised: '#173A5C', text: '#DAE9F4', dialogue: '#F0F9FF', em: '#90B0C8', strong: '#FFE973', muted: '#8CA9C4', faint: '#6886A4', accent: '#3DBBFF', marker: 'rgba(40, 190, 255, 0.24)', gold: 'rgba(255, 233, 115, 0.18)', line: 'rgba(150, 205, 255, 0.08)', shadow: 'rgba(0, 10, 22, 0.6)' },
        { bg: '#071C2E', surface: '#0E2538', raised: '#152F45', text: '#D6DFE8', dialogue: '#F8FBFF', em: '#809CB6', strong: '#FFE973', muted: '#90A4B7', faint: '#6D8397', danger: '#FF5247', accent: '#3DBBFF', pop: '#FFE973', marker: 'rgba(14, 132, 255, 0.42)', gold: 'rgba(255, 226, 60, 0)', line: 'rgba(150, 190, 230, 0.07)', shadow: 'rgba(1, 8, 16, 0.72)' },
        { bg: '#141F2E', surface: '#1C293B', raised: '#28384D', text: '#DBE2EB', dialogue: '#F3F7FC', em: '#97AFCE', strong: '#FFE873', muted: '#ABBACE', faint: '#8596AD', danger: '#FF6F62', accent: '#7DB8F2', pop: '#FFE873', brand: '#7DB8F2', marker: 'rgba(66, 141, 240, 0.4)', gold: 'rgba(255, 232, 115, 0)', line: 'rgba(184, 201, 224, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)' },
    ],
    'black-light': [
        { bg: '#F5F5F5', surface: '#FFFFFF', raised: '#E8E8E8', text: '#242424', dialogue: '#151515', em: '#646464', strong: '#161616', muted: '#686868', faint: '#808080', danger: '#D0231A', accent: '#444444', pop: '#444444', brand: '#444444', marker: 'rgba(80, 80, 80, 0.18)', gold: 'rgba(80, 80, 80, 0.12)', line: 'rgba(20, 20, 20, 0.08)', shadow: 'rgba(20, 20, 20, 0.14)' },
        { bg: '#FBFBFA', surface: '#FDFDFD', raised: '#ECEBE9', text: '#2F2E2D', dialogue: '#201F1E', em: '#6C6A65', strong: '#56534E', muted: '#6B6966', faint: '#878685', danger: '#E23B2E', accent: '#6E695E', pop: '#6E695E', brand: '#6E695E', marker: 'rgba(148, 143, 132, 0.22)', gold: 'rgba(193, 190, 184, 0.16)', line: 'rgba(53, 52, 49, 0.07)', shadow: 'rgba(66, 65, 61, 0.12)' },
        { bg: '#FAFAFA', surface: '#FDFDFD', raised: '#EBEBEB', text: '#2E2E2E', dialogue: '#1F1F1F', em: '#6A6A6A', strong: '#525252', muted: '#6A6A6A', faint: '#878787', danger: '#E23B2E', accent: '#5C5C5C', pop: '#5C5C5C', brand: '#5C5C5C', marker: 'rgba(140, 140, 140, 0.22)', gold: 'rgba(189, 189, 189, 0.16)', line: 'rgba(51, 51, 51, 0.07)', shadow: 'rgba(64, 64, 64, 0.12)' },
    ],
    black: [
        { bg: '#000000', surface: '#080808', raised: '#171717', text: '#DADADA', dialogue: '#FAFAFA', em: '#A0A0A0', strong: '#FFFFFF', muted: '#A4A4A4', faint: '#818181', danger: '#FF5247', accent: '#D6D6D6', pop: '#EAEAEA', brand: '#EAEAEA', marker: 'rgba(180, 180, 180, 0.22)', gold: 'rgba(255, 255, 255, 0)', line: 'rgba(220, 220, 220, 0.09)', shadow: 'rgba(0, 0, 0, 0.72)' },
        { bg: '#1E1D1A', surface: '#292724', raised: '#393732', text: '#E4E3E2', dialogue: '#F8F7F7', em: '#B4B3B1', strong: '#CFCDC9', muted: '#BEBDBB', faint: '#9A9998', danger: '#FF6F62', accent: '#D9D7D4', pop: '#D9D7D4', brand: '#D9D7D4', marker: 'rgba(158, 155, 148, 0.2)', gold: 'rgba(217, 215, 212, 0)', line: 'rgba(205, 204, 203, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)' },
    ],
    melon: [
        { bg: '#F3F9EE', surface: '#FDFFFA', raised: '#E3EED8', text: '#263222', dialogue: '#1B2E19', em: '#5C7253', strong: '#2C5526', muted: '#607157', faint: '#798A6F', danger: '#D0231A', accent: '#397B32', pop: '#397B32', brand: '#397B32', marker: 'rgba(126, 189, 84, 0.27)', gold: 'rgba(158, 202, 110, 0.30)', line: 'rgba(35, 58, 25, 0.08)', shadow: 'rgba(35, 58, 25, 0.14)' },
        { bg: '#FAFEF6', surface: '#FDFFFB', raised: '#E9F8D8', text: '#2F3A22', dialogue: '#1F2A14', em: '#5B783B', strong: '#52801E', muted: '#62744E', faint: '#7E9366', danger: '#E23B2E', accent: '#508118', pop: '#AEE363', brand: '#AEE363', marker: 'rgba(172, 243, 73, 0.32)', gold: 'rgba(219, 248, 129, 0.48)', line: 'rgba(52, 71, 31, 0.07)', shadow: 'rgba(66, 92, 35, 0.12)' },
        { bg: '#FAFEF6', surface: '#FDFFFB', raised: '#E9F8D8', text: '#2F3A22', dialogue: '#1F2A14', em: '#5B783B', strong: '#52801E', muted: '#62744E', faint: '#7E9366', danger: '#E23B2E', accent: '#508118', pop: '#AEE363', brand: '#AEE363', marker: 'rgba(172, 243, 73, 0.32)', gold: 'rgba(219, 248, 129, 0.48)', line: 'rgba(52, 71, 31, 0.07)', shadow: 'rgba(66, 92, 35, 0.12)' },
    ],
    'melon-night': [
        { bg: '#10180F', surface: '#182217', raised: '#243122', text: '#D9E2D3', dialogue: '#F4F9EF', em: '#97AD88', strong: '#BFDE99', muted: '#A1B398', faint: '#7D9073', danger: '#FF5247', accent: '#ACD782', pop: '#ACD782', brand: '#ACD782', marker: 'rgba(110, 169, 67, 0.29)', gold: 'rgba(172, 215, 130, 0)', line: 'rgba(172, 200, 150, 0.08)', shadow: 'rgba(0, 0, 0, 0.72)' },
        { bg: '#212919', surface: '#2B3423', raised: '#3B4431', text: '#E3EBDB', dialogue: '#F7FCF3', em: '#B3CE97', strong: '#D3F99F', muted: '#BDCEAB', faint: '#99AD85', danger: '#FF6F62', accent: '#C1F27D', pop: '#C1F27D', brand: '#C1F27D', marker: 'rgba(167, 240, 66, 0.32)', gold: 'rgba(193, 242, 125, 0)', line: 'rgba(204, 224, 184, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)' },
    ],
    grapefruit: [
        { bg: '#FFF4EF', surface: '#FFFDFA', raised: '#F9E5DA', text: '#3B2923', dialogue: '#362018', em: '#895E4E', strong: '#963E24', muted: '#865E50', faint: '#A07868', danger: '#D0231A', accent: '#B54322', pop: '#B54322', brand: '#B54322', marker: 'rgba(244, 133, 87, 0.26)', gold: 'rgba(246, 168, 115, 0.30)', line: 'rgba(75, 35, 20, 0.08)', shadow: 'rgba(75, 35, 20, 0.14)' },
        { bg: '#FFF8F6', surface: '#FFFCFB', raised: '#FFE2DB', text: '#3A2722', dialogue: '#2A1814', em: '#905547', strong: '#84301F', muted: '#846058', faint: '#9F7D75', danger: '#E23B2E', accent: '#CA3D21', pop: '#EE7E68', brand: '#EE7E68', marker: 'rgba(245, 117, 92, 0.3)', gold: 'rgba(248, 169, 129, 0.38)', line: 'rgba(71, 39, 31, 0.07)', shadow: 'rgba(92, 47, 35, 0.12)' },
        { bg: '#FFF8F6', surface: '#FFFCFB', raised: '#FFE2DB', text: '#3A2722', dialogue: '#2A1814', em: '#905547', strong: '#84301F', muted: '#846058', faint: '#9F7D75', danger: '#E23B2E', accent: '#CA3D21', pop: '#EE7E68', brand: '#EE7E68', marker: 'rgba(245, 117, 92, 0.3)', gold: 'rgba(248, 169, 129, 0.38)', line: 'rgba(71, 39, 31, 0.07)', shadow: 'rgba(92, 47, 35, 0.12)' },
    ],
    'grapefruit-night': [
        { bg: '#1C110E', surface: '#291B16', raised: '#39271F', text: '#EADBD4', dialogue: '#FFF6F0', em: '#BE9582', strong: '#FFB48C', muted: '#C4A091', faint: '#9C7A6B', danger: '#FF5247', accent: '#FF9B75', pop: '#FF9B75', brand: '#FF9B75', marker: 'rgba(210, 103, 58, 0.30)', gold: 'rgba(255, 155, 117, 0)', line: 'rgba(220, 170, 140, 0.08)', shadow: 'rgba(0, 0, 0, 0.72)' },
        { bg: '#2C1A17', surface: '#37231F', raised: '#49312D', text: '#EBDDDB', dialogue: '#FCF4F3', em: '#CEA097', strong: '#F9B19F', muted: '#CEB1AB', faint: '#AD8B85', danger: '#FF6F62', accent: '#F39C86', pop: '#F39C86', brand: '#F39C86', marker: 'rgba(240, 95, 66, 0.32)', gold: 'rgba(243, 156, 134, 0)', line: 'rgba(224, 190, 184, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)' },
    ],
    peach: [
        { bg: '#FFF8EF', surface: '#FFFEFA', raised: '#F6E9D6', text: '#382D23', dialogue: '#302318', em: '#82664B', strong: '#875120', muted: '#80664D', faint: '#9B8065', danger: '#D0231A', accent: '#995B27', pop: '#995B27', brand: '#995B27', marker: 'rgba(238, 174, 103, 0.28)', gold: 'rgba(245, 198, 137, 0.36)', line: 'rgba(65, 43, 20, 0.08)', shadow: 'rgba(65, 43, 20, 0.14)' },
        { bg: '#FFFAF6', surface: '#FFFDFB', raised: '#FFE9D6', text: '#3A2D22', dialogue: '#2A1E14', em: '#896443', strong: '#84471F', muted: '#7D6754', faint: '#9C8470', danger: '#E23B2E', accent: '#B85919', pop: '#F7B27E', brand: '#F7B27E', marker: 'rgba(246, 170, 111, 0.36)', gold: 'rgba(248, 197, 129, 0.42)', line: 'rgba(71, 50, 31, 0.07)', shadow: 'rgba(92, 62, 35, 0.12)' },
        { bg: '#FFFAF6', surface: '#FFFDFB', raised: '#FFE9D6', text: '#3A2D22', dialogue: '#2A1E14', em: '#896443', strong: '#84471F', muted: '#7D6754', faint: '#9C8470', danger: '#E23B2E', accent: '#B85919', pop: '#F7B27E', brand: '#F7B27E', marker: 'rgba(246, 170, 111, 0.36)', gold: 'rgba(248, 197, 129, 0.42)', line: 'rgba(71, 50, 31, 0.07)', shadow: 'rgba(92, 62, 35, 0.12)' },
    ],
    'peach-night': [
        { bg: '#1B1611', surface: '#272019', raised: '#362C22', text: '#E8DFD4', dialogue: '#FFF8EE', em: '#B5A087', strong: '#F4CAA2', muted: '#BEA88F', faint: '#97816A', danger: '#FF5247', accent: '#EDB783', pop: '#EDB783', brand: '#EDB783', marker: 'rgba(201, 144, 86, 0.28)', gold: 'rgba(237, 183, 131, 0)', line: 'rgba(214, 187, 153, 0.08)', shadow: 'rgba(0, 0, 0, 0.72)' },
        { bg: '#2B1F17', surface: '#372920', raised: '#48382E', text: '#EBE1DB', dialogue: '#FCF6F3', em: '#CEAD97', strong: '#FBCBA7', muted: '#CEB9AB', faint: '#AD9585', danger: '#FF6F62', accent: '#F4BB90', pop: '#F4BB90', brand: '#F4BB90', marker: 'rgba(240, 141, 66, 0.3)', gold: 'rgba(244, 187, 144, 0)', line: 'rgba(224, 200, 184, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)' },
    ],
    lemon: [
        { bg: '#FFFAE6', surface: '#FFFEF8', raised: '#F6EDC8', text: '#2D2A1F', dialogue: '#221E12', em: '#7A6B45', strong: '#6E5200', muted: '#736A52', faint: '#8F8568', danger: '#D0231A', accent: '#8C6400', pop: '#8C6400', brand: '#8C6400', marker: 'rgba(255, 212, 0, 0.34)', gold: 'rgba(255, 222, 50, 0.50)', line: 'rgba(60, 50, 10, 0.08)', shadow: 'rgba(60, 50, 10, 0.14)' },
        { bg: '#FFFEF2', surface: '#FFFFFB', raised: '#FFF9C7', text: '#3A3722', dialogue: '#2A2714', em: '#79733C', strong: '#846B1F', muted: '#777350', faint: '#959068', danger: '#E23B2E', accent: '#936F04', pop: '#F2DE5F', brand: '#F2DE5F', marker: 'rgba(242, 223, 54, 0.48)', gold: 'rgba(248, 236, 129, 0.6)', line: 'rgba(71, 67, 31, 0.07)', shadow: 'rgba(92, 87, 35, 0.12)' },
        { bg: '#FFFEF2', surface: '#FFFFFB', raised: '#FFF9C7', text: '#3A3722', dialogue: '#2A2714', em: '#79733C', strong: '#846B1F', muted: '#777350', faint: '#959068', danger: '#E23B2E', accent: '#936F04', pop: '#F2DE5F', brand: '#F2DE5F', marker: 'rgba(242, 223, 54, 0.48)', gold: 'rgba(248, 236, 129, 0.6)', line: 'rgba(71, 67, 31, 0.07)', shadow: 'rgba(92, 87, 35, 0.12)' },
        { bg: '#FFFEF2', surface: '#FFFFFB', raised: '#FFF9C7', text: '#3A3722', dialogue: '#2A2714', em: '#79733C', strong: '#1F4E84', muted: '#777350', faint: '#959068', danger: '#E23B2E', accent: '#2774CB', pop: '#2774CB', marker: 'rgba(242, 223, 54, 0.48)', gold: 'rgba(20, 165, 255, 0.30)', line: 'rgba(71, 67, 31, 0.07)', shadow: 'rgba(92, 87, 35, 0.12)' },
        { bg: '#FFFEF7', surface: '#FDFEFF', raised: '#FFFAD1', text: '#222D3A', dialogue: '#141E2A', em: '#476990', strong: '#1F4E84', muted: '#5A6F87', faint: '#75889F', danger: '#E23B2E', accent: '#2775CE', pop: '#2775CE', marker: 'rgba(242, 223, 54, 0.48)', gold: 'rgba(20, 165, 255, 0.30)', line: 'rgba(31, 50, 71, 0.07)', shadow: 'rgba(35, 62, 92, 0.12)' },
        { bg: '#FFFEF7', surface: '#FDFEFF', raised: '#FFFAD1', text: '#222D3A', dialogue: '#141E2A', em: '#476990', strong: '#1F4E84', muted: '#5A6F87', faint: '#75889F', danger: '#E23B2E', accent: '#2775CE', pop: '#F2DE5F', marker: 'rgba(242, 223, 54, 0.48)', gold: 'rgba(20, 165, 255, 0.30)', line: 'rgba(31, 50, 71, 0.07)', shadow: 'rgba(35, 62, 92, 0.12)' },
    ],
    'lemon-night': [
        { bg: '#16130B', surface: '#211C12', raised: '#2F281A', text: '#ECE5D2', dialogue: '#FFE98A', em: '#B7A782', strong: '#FFC93D', muted: '#BDB091', faint: '#948869', danger: '#FF5247', accent: '#FFD447', pop: '#FFD447', brand: '#FFD447', marker: 'rgba(255, 236, 170, 0.12)', gold: 'rgba(255, 212, 71, 0)', line: 'rgba(230, 210, 150, 0.08)', shadow: 'rgba(0, 0, 0, 0.72)' },
        { bg: '#272317', surface: '#322E20', raised: '#423E2E', text: '#EBE8DB', dialogue: '#FDF6C3', em: '#CEC397', strong: '#FBDA56', muted: '#CEC7AB', faint: '#ADA585', danger: '#FF6F62', accent: '#F3E186', pop: '#F3E186', brand: '#F3E186', marker: 'rgba(240, 217, 66, 0.18)', gold: 'rgba(243, 225, 134, 0)', line: 'rgba(224, 216, 184, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)' },
        { bg: '#272317', surface: '#322E20', raised: '#423E2E', text: '#EBE8DB', dialogue: '#FDF6C3', em: '#CEC397', strong: '#FBDA56', muted: '#CEC7AB', faint: '#ADA585', danger: '#FF6F62', accent: '#F3E186', pop: '#F3E186', brand: '#F3E186', marker: 'rgba(240, 217, 66, 0.18)', gold: 'rgba(243, 225, 134, 0)', line: 'rgba(224, 216, 184, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)' },
        { bg: '#141F2E', surface: '#1C293B', raised: '#28384D', text: '#DBE2EB', dialogue: '#FFF1A8', em: '#97AFCE', strong: '#7DB8F2', muted: '#ABBACE', faint: '#8596AD', danger: '#FF6F62', accent: '#7DB8F2', pop: '#7DB8F2', marker: 'rgba(255, 235, 150, 0.16)', gold: 'rgba(125, 184, 242, 0)', line: 'rgba(184, 201, 224, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)' },
        { bg: '#141F2E', surface: '#1C293B', raised: '#28384D', text: '#DBE2EB', dialogue: '#F3F7FC', em: '#97AFCE', strong: '#7DB8F2', muted: '#ABBACE', faint: '#8596AD', danger: '#FF6F62', accent: '#7DB8F2', pop: '#FFE873', marker: 'rgba(255, 226, 60, 0.9)', markerInk: '#1B1A0B', gold: 'rgba(125, 184, 242, 0)', line: 'rgba(184, 201, 224, 0.08)', shadow: 'rgba(0, 0, 0, 0.6)' },
    ],
};

for (const [id, colors] of Object.entries(previousSurfaces)) (LEGACY[id] ??= []).push(colors);

export const TOKEN_KEYS = ['bg', 'surface', 'raised', 'text', 'dialogue', 'em', 'strong', 'muted', 'faint', 'accent', 'marker', 'gold', 'line', 'shadow'];

// 색 직접 고치기 목록 (표시 순서, 묶음별)
export const TOKEN_GROUPS = [
    ['바탕', [['bg', '바탕'], ['surface', '메뉴·패널'], ['raised', '입력칸·말풍선']]],
    ['글자', [['text', '본문'], ['dialogue', '대사'], ['em', '속마음 *기울임*'], ['strong', '강조 **굵게**'], ['muted', '보조'], ['faint', '흐림']]],
    ['포인트', [['accent', '포인트'], ['marker', '대사 형광펜'], ['gold', '강조 형광펜 **굵게**'], ['shadow', '그림자']]],
];
export const TOKENS = TOKEN_GROUPS.flatMap(([, list]) => list);

export function paletteColors(settings) {
    const base = PALETTES[settings.palette] || PALETTES.salt;
    return { ...base, ...(settings.colorOverrides?.[settings.palette] || {}) };
}

/** '#rrggbb' | '#rgb' | 'rgb(a)(...)' → [r, g, b, a] */
export function parseColor(value) {
    const s = String(value ?? '').trim();
    let m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) {
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    m = s.match(/^#([0-9a-f]{3})$/i);
    if (m) return [...m[1]].map(c => parseInt(c + c, 16)).concat(1);
    m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
    if (m) {
        const a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]));
        return [Number(m[1]), Number(m[2]), Number(m[3]), a];
    }
    return [128, 128, 128, 1];
}

export function sameColor(a, b) {
    const x = parseColor(a);
    const y = parseColor(b);
    return x.every((v, i) => Math.abs(v - y[i]) <= (i === 3 ? 0.011 : 1));
}

export function toRgba([r, g, b, a]) {
    return a >= 1 ? `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}` : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})`;
}

/** 아무 문자열 → 안전한 CSS 색 문자열 (style 속성에 그대로 넣어도 됨) */
export function safeColor(value) {
    return toRgba(parseColor(value));
}

/** 포인트색 위에 놓일 글자색: 밝은 포인트면 어두운 글자 */
export function onColor(value) {
    const [r, g, b] = parseColor(value);
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.36 ? '#0B1216' : '#FFFFFF';
}
