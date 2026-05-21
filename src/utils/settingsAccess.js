const runtimeConfig = typeof window === 'undefined' ? {} : (window.__SMARTREADS_CONFIG__ || {});
const SETTINGS_PASSWORD = (
    runtimeConfig.VITE_SETTINGS_PASSWORD ||
    import.meta.env.VITE_SETTINGS_PASSWORD ||
    ''
).trim();

export const isSettingsPasswordEnabled = () => SETTINGS_PASSWORD.length > 0;

export const verifySettingsPassword = (password) => password === SETTINGS_PASSWORD;
