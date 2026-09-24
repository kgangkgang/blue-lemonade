import { getSettings } from '../settings.js';
export const context = () => SillyTavern.getContext();
export const enabled = id => getSettings().usageMode !== 'theme' && !!getSettings().enabled && !!getSettings().addons?.[id];
