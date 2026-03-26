export const DEFAULT_UPSTREAM_BASE_URL = 'https://api.openai.com/v1';
export const PROXY_API_BASE_URL = '/api/proxy';

export const normalizeApiBaseUrl = (baseUrl) => {
    if (typeof baseUrl !== 'string') {
        return DEFAULT_UPSTREAM_BASE_URL;
    }

    const trimmed = baseUrl.trim();
    if (!trimmed) {
        return DEFAULT_UPSTREAM_BASE_URL;
    }

    return trimmed.replace(/\/+$/, '');
};

export const buildApiUrl = (baseUrl, endpoint) => {
    const safeBaseUrl = normalizeApiBaseUrl(baseUrl);
    const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${safeBaseUrl}${safeEndpoint}`;
};
