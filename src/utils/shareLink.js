import LZString from 'lz-string';

const SHARE_PREFIX = '#share=';
const MAX_URL_LENGTH = 12000;
const SHARE_QUERY_KEY = 'share';
const SHARE_API_PREFIX = '/api/share';

const encodePayload = (payload) => {
    const json = JSON.stringify(payload);
    const encoded = LZString.compressToEncodedURIComponent(json);
    if (!encoded) {
        throw new Error('分享内容压缩失败');
    }
    return encoded;
};

const decodePayload = (encoded) => {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) {
        throw new Error('分享内容解压失败');
    }
    return JSON.parse(json);
};

export const buildShareLink = (markdown, baseUrl = window.location.href) => {
    const urlObj = new URL(baseUrl);
    urlObj.searchParams.delete(SHARE_QUERY_KEY);
    urlObj.hash = '';

    const payload = {
        v: 1,
        type: 'analysis_markdown_table',
        markdown,
        ts: Date.now()
    };

    const encoded = encodePayload(payload);
    const shareUrl = `${urlObj.toString()}${SHARE_PREFIX}${encoded}`;

    if (shareUrl.length > MAX_URL_LENGTH) {
        throw new Error('内容过大，无法生成稳定分享链接，请改用导出文件分享');
    }

    return shareUrl;
};

export const parseShareLink = (hash = window.location.hash) => {
    if (!hash || !hash.startsWith(SHARE_PREFIX)) {
        return null;
    }

    const encoded = hash.slice(SHARE_PREFIX.length);
    const payload = decodePayload(encoded);
    if (!payload || payload.type !== 'analysis_markdown_table' || typeof payload.markdown !== 'string') {
        throw new Error('分享链接格式无效');
    }

    return payload.markdown;
};

export const buildRemoteShareUrl = (id, baseUrl = window.location.href) => {
    const urlObj = new URL(baseUrl);
    urlObj.hash = '';
    urlObj.searchParams.set(SHARE_QUERY_KEY, id);
    return urlObj.toString();
};

export const parseRemoteShareId = (search = window.location.search) => {
    if (!search) return null;
    const params = new URLSearchParams(search);
    const id = params.get(SHARE_QUERY_KEY);
    if (!id) return null;
    return id;
};

export const createRemoteShare = async (markdown) => {
    const response = await fetch(SHARE_API_PREFIX, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
        throw new Error(message);
    }

    if (!payload?.id) {
        throw new Error('分享服务返回无效ID');
    }

    return buildRemoteShareUrl(payload.id);
};

export const fetchRemoteShareMarkdown = async (id) => {
    const response = await fetch(`${SHARE_API_PREFIX}/${encodeURIComponent(id)}`, {
        method: 'GET'
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
        throw new Error(message);
    }

    if (typeof payload?.markdown !== 'string' || !payload.markdown.trim()) {
        throw new Error('分享内容为空');
    }

    return payload.markdown;
};
