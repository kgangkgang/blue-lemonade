export const themeEnabled = s => s.enabled !== false && s.usageMode !== 'extensions';
export const addonsEnabled = s => s.enabled !== false && s.usageMode !== 'theme';
export const usageMode = s => ['both','theme','extensions'].includes(s.usageMode) ? s.usageMode : 'both';
