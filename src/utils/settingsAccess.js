const runtimeConfig = typeof window === 'undefined' ? {} : (window.__SMARTREADS_CONFIG__ || {});
const hasRuntimePasswordFlag = Object.prototype.hasOwnProperty.call(
    runtimeConfig,
    'SETTINGS_PASSWORD_REQUIRED'
);

export const isSettingsPasswordEnabled = async () => {
    if (hasRuntimePasswordFlag) {
        return Boolean(runtimeConfig.SETTINGS_PASSWORD_REQUIRED);
    }

    try {
        const response = await fetch('/api/settings-auth', {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) return false;

        const payload = await response.json();
        return Boolean(payload.passwordRequired);
    } catch (_error) {
        return false;
    }
};

export const verifySettingsPassword = async (password) => {
    const response = await fetch('/api/settings-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });

    return response.ok;
};
