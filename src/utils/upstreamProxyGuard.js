export const normalizeUpstreamBaseUrl = (baseUrl) => {
    if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
        throw new Error('缺少上游API基础URL');
    }

    const trimmed = baseUrl.trim().replace(/\/+$/, '');
    const parsed = new URL(trimmed);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('上游API基础URL仅支持 http/https');
    }

    return parsed.toString().replace(/\/+$/, '');
};

export const ensureSafeUpstreamBaseUrl = (baseUrl) => {
    // 兼容旧调用方：当前策略仅做格式与协议校验，允许本地/私网上游
    return normalizeUpstreamBaseUrl(baseUrl);
};

export const buildUpstreamTargetUrl = (upstreamBaseUrl, endpointPath, search = '') => {
    const safeBaseUrl = normalizeUpstreamBaseUrl(upstreamBaseUrl);

    if (typeof endpointPath !== 'string' || endpointPath.includes('://')) {
        throw new Error('非法的上游路径');
    }

    const safeEndpoint = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    return `${safeBaseUrl}${safeEndpoint}${search || ''}`;
};
