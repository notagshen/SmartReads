const SETTINGS_PASSWORD = (import.meta.env.VITE_SETTINGS_PASSWORD || '').trim();

export const isSettingsPasswordEnabled = () => SETTINGS_PASSWORD.length > 0;

export const verifySettingsPassword = (password) => password === SETTINGS_PASSWORD;
