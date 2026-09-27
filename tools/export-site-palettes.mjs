import { PALETTES, PALETTE_FAMILIES } from '../src/palettes.js';
import { existsSync, writeFileSync } from 'node:fs';

const families = Object.entries(PALETTE_FAMILIES)
    .filter(([id]) => id !== 'custom')
    .map(([id, family]) => ({
        id, label: family.label,
        light: PALETTES[family.light], dark: PALETTES[family.dark],
    }));
const siteRoot = existsSync(new URL('../docs/', import.meta.url)) ? '../docs/' : '../../docs/';
writeFileSync(process.argv[2] || new URL(siteRoot + 'theme-palettes.json', import.meta.url), JSON.stringify(families, null, 2) + '\n');
console.log(`Exported ${families.length} theme families / ${families.length * 2} palettes`);
