import { extractCompletionTextFromJson, extractStreamChunkText } from '../utils/chatApiCompat.js';

export const parseUpstreamPayload = async (response) => {
    const rawText = await response.text().catch(() => '');
    if (!rawText) return null;
    try {
        return JSON.parse(rawText);
    } catch (_error) {
        return rawText;
    }
};

const readEventStreamText = async (response, onText) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('流式响应不可读');

    const decoder = new TextDecoder();
    let result = '';
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const data = trimmed.slice(5).trim();
            if (!data || data === '[DONE]') continue;

            try {
                const parsed = JSON.parse(data);
                const text = extractStreamChunkText(parsed);
                if (text) {
                    result += text;
                    onText?.(text);
                }
            } catch (_error) {
                // 忽略单个分片解析错误，继续读后续事件
            }
        }
    }

    return result;
};

export const readUpstreamText = async (response, onText) => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
        return readEventStreamText(response, onText);
    }

    const payload = await parseUpstreamPayload(response);
    const text = extractCompletionTextFromJson(payload);
    if (text) onText?.(text);
    return text;
};
