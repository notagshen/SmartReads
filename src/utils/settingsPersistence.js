import { loadJSON, saveJSON } from './storage.js';
import { DEFAULT_UPSTREAM_BASE_URL } from './apiBaseUrl.js';

export const SETTINGS_STORAGE_KEY = 'settings';
export const SETTINGS_STORAGE_VERSION = 'v1';
export const LEGACY_SETTINGS_STORAGE_KEY = 'smartreads-settings';

export const DEFAULT_SETTINGS = {
    apiKey: '',
    baseUrl: DEFAULT_UPSTREAM_BASE_URL,
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 4000,
    truncationThresholdChars: 120000
};

const toPlainObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value;
};

export const normalizePersistedSettings = (persisted) => {
    const source = toPlainObject(persisted);
    if (!source) {
        return { settings: DEFAULT_SETTINGS, theme: undefined };
    }

    const { theme, version, lastModified, exportedAt, ...storedSettings } = source;
    void version;
    void lastModified;
    void exportedAt;

    return {
        settings: {
            ...DEFAULT_SETTINGS,
            ...storedSettings
        },
        theme
    };
};

export const loadPersistedSettings = () => {
    const current = loadJSON(SETTINGS_STORAGE_KEY, null, { version: SETTINGS_STORAGE_VERSION });
    if (current) {
        return normalizePersistedSettings(current);
    }

    try {
        const legacyRaw = localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
        if (legacyRaw) {
            return normalizePersistedSettings(JSON.parse(legacyRaw));
        }
    } catch (error) {
        console.warn('settingsPersistence.load legacy error:', error);
    }

    return { settings: DEFAULT_SETTINGS, theme: undefined };
};

export const savePersistedSettings = (settings, theme) => {
    const payload = {
        ...DEFAULT_SETTINGS,
        ...settings,
        theme,
        lastModified: new Date().toISOString()
    };

    return saveJSON(SETTINGS_STORAGE_KEY, payload, { version: SETTINGS_STORAGE_VERSION });
};
