const variants = {blue:['salt','night'], black:['black-light','black']};
const paletteId = (family,mode) => variants[family]?.[mode === 'dark' ? 1 : 0] || family + (mode === 'dark' ? '-night' : '');
const flatten = (value, prefix, out) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k,v] of Object.entries(value)) flatten(v,`${prefix}.${k}`,out);
  } else out[prefix] = structuredClone(value);
};
export function websitePreset(reading, palette) {
  if (!reading || !palette?.families?.length) throw new Error('미리보기를 불러온 뒤 다시 눌러 주세요.');
  const text = {}, marker = {}, colors = {palette:paletteId(palette.selected,palette.mode)};
  for (const role of ['text','dialogue','em','strong','code']) {
    const r = reading[role]; flatten(r.font,`fonts.${role}`,text);
    const sizePath = {text:'type.size',dialogue:'type.dialogueSize',code:'type.codeSize'}[role] || `${role}.size`;
    text[sizePath] = r.size;
    text[role === 'text' ? 'type.weight' : `${role}.weight`] = r.weight;
    text[role === 'text' ? 'type.letterSpacing' : `${role}.letterSpacing`] = r.spacing;
  }
  text['fonts.hanja'] = reading.hanja; text['em.italic'] = reading.em.italic;
  for (const [from,to] of Object.entries({line:'lineHeight',gap:'para',gutter:'gutter',align:'align',indent:'indent'})) text[`type.${to}`] = reading.para[from];
  flatten(reading.shadow,'shadow',text); flatten(reading.outline,'outline',text);
  for (const [from,to] of Object.entries({style:'style',shape:'markerShape',tilt:'tilt',pos:'markerPos',thick:'markerThick'})) marker[`dialogue.${to}`] = reading.dialogue[from];
  for (const mode of ['light','dark']) {
    const mix = palette.mixes[mode], id = paletteId(palette.selected,mode);
    flatten(mix,`gradients.${mode}`,colors);
    const base = palette.families.find(f => f.id === palette.selected)[mode];
    for (const [key,value] of Object.entries(base)) {
      if (['label','desc','mode'].includes(key)) continue;
      (key === 'marker' ? marker : colors)[`colorOverrides.${id}.${key}`] = value;
    }
    // Explicit bands also replace a previously customized gradient on import.
    for (const key of ['bg','surface','raised','accent','marker','gold','text','dialogue','em','strong','muted','faint','name','userName','ui','code']) {
      const group = key === 'marker' ? marker : colors;
      // inherit restores the shared mix, including blend, on import.
      group[`gradients.overrides.${id}.${key}.mode`] = 'inherit';
    }
  }
  return {blueLemonadePreset:true,version:1,groups:{colors,text,marker}};
}
if (typeof document !== 'undefined') {
  document.querySelector('#export-preview')?.addEventListener('click', () => {
    const state = {}, status = document.querySelector('#export-preview-status');
    document.dispatchEvent(new CustomEvent('bl-export-state',{detail:state}));
    try {
      const data = websitePreset(state.reading,state.palette);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const a = document.createElement('a'); a.href=url; a.download='blue-lemonade-my-theme.json'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      status.textContent='저장한 파일을 실리태번 테마 설정 → 백업 → 프리셋 공유 → 불러오기에서 열어 주세요. 원하는 항목만 골라 적용할 수 있어요.';
    } catch (error) { status.textContent=error.message; }
  });
}
