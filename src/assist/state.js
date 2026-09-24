import { getSettings } from '../settings.js';
export const context = () => SillyTavern.getContext();
export const enabled = id => !!getSettings().enabled && !!getSettings().addons?.[id];
