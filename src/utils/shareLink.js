import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

const SHARE_PREFIX = '#share=';
const MAX_URL_LENGTH = 12000;

const encodePayload = (payload) => {
    const json = JSON.stringify(payload);
    const encoded = compressToEncodedURIComponent(json);
    if (!encoded) {
        throw new Error('分享内容压缩失败');
    }
    return encoded;
};

const decodePayload = (encoded) => {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) {
        throw new Error('分享内容解压失败');
    }
    return JSON.parse(json);
};

export const buildShareLink = (markdown, baseUrl = window.location.href) => {
    const urlObj = new URL(baseUrl);
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

