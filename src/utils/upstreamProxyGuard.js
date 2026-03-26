import net from 'node:net';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const isPrivateIpv4 = (ip) => {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((x) => Number.isNaN(x))) {
        return true;
    }

    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;

    return false;
};

const isPrivateIpv6 = (ip) => {
    const lowered = ip.toLowerCase();
    return (
        lowered === '::1' ||
        lowered === '::' ||
        lowered.startsWith('fc') ||
        lowered.startsWith('fd') ||
        lowered.startsWith('fe80')
    );
};

const isPrivateIp = (ip) => {
    const version = net.isIP(ip);
    if (version === 4) return isPrivateIpv4(ip);
    if (version === 6) return isPrivateIpv6(ip);
    return true;
};

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
    const normalized = normalizeUpstreamBaseUrl(baseUrl);
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();

    if (LOCAL_HOSTS.has(host) || host.endsWith('.local')) {
        throw new Error('不允许使用本地或内网主机作为上游地址');
    }

    if (net.isIP(host) && isPrivateIp(host)) {
        throw new Error('不允许使用私网IP作为上游地址');
    }

    return normalized;
};

export const buildUpstreamTargetUrl = (upstreamBaseUrl, endpointPath, search = '') => {
    const safeBaseUrl = normalizeUpstreamBaseUrl(upstreamBaseUrl);

    if (typeof endpointPath !== 'string' || endpointPath.includes('://')) {
        throw new Error('非法的上游路径');
    }

    const safeEndpoint = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    return `${safeBaseUrl}${safeEndpoint}${search || ''}`;
};
