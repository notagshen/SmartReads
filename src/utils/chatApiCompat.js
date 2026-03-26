const GPT5_MODEL_PATTERN = /^gpt-5(?:[.-]|$)/i;

const extractTextLikeValue = (value) => {
    if (typeof value === 'string') {
        return value;
    }

    if (!Array.isArray(value)) {
        return '';
    }

    const textParts = value
        .map((item) => {
            if (typeof item === 'string') {
                return item;
            }
            if (!item || typeof item !== 'object') {
                return '';
            }
            if (typeof item.text === 'string') {
                return item.text;
            }
            if (typeof item.content === 'string') {
                return item.content;
            }
            return '';
        })
        .filter(Boolean);

    return textParts.join('');
};

const extractMessageText = (message) => {
    if (!message || typeof message !== 'object') {
        return '';
    }

    const contentText = extractTextLikeValue(message.content);
    if (contentText) {
        return contentText;
    }

    const reasoningText = extractTextLikeValue(message.reasoning_content);
    if (reasoningText) {
        return reasoningText;
    }

    return '';
};

export const isGpt5Model = (model) => typeof model === 'string' && GPT5_MODEL_PATTERN.test(model.trim());

export const buildChatCompletionRequestBody = ({
    model,
    prompt,
    temperature,
    maxTokens,
    stream = true
}) => {
    const payload = {
        model,
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature,
        stream
    };

    if (isGpt5Model(model)) {
        payload.max_completion_tokens = maxTokens;
    } else {
        payload.max_tokens = maxTokens;
    }

    return payload;
};

export const extractCompletionTextFromJson = (payload) => {
    const choices = Array.isArray(payload?.choices) ? payload.choices : [];

    for (const choice of choices) {
        const messageText = extractMessageText(choice?.message);
        if (messageText) {
            return messageText;
        }

        const deltaText = extractMessageText(choice?.delta);
        if (deltaText) {
            return deltaText;
        }
    }

    return '';
};

export const extractStreamChunkText = (payload) => {
    const choices = Array.isArray(payload?.choices) ? payload.choices : [];

    for (const choice of choices) {
        const deltaText = extractMessageText(choice?.delta);
        if (deltaText) {
            return deltaText;
        }

        const messageText = extractMessageText(choice?.message);
        if (messageText) {
            return messageText;
        }
    }

    return '';
};
