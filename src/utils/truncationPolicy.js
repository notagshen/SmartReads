const DEFAULT_TRUNCATION_THRESHOLD_CHARS = 120000;
const MAX_TOKENS_TO_CHARS_MULTIPLIER = 6;

const resolveBaseThreshold = (customThresholdChars) => {
    const parsed = Number.parseInt(customThresholdChars, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    return DEFAULT_TRUNCATION_THRESHOLD_CHARS;
};

export const getBalancedTruncationThreshold = (maxTokens, customThresholdChars) => {
    const parsed = Number.parseInt(maxTokens, 10);
    const dynamicThreshold = Number.isFinite(parsed) && parsed > 0
        ? parsed * MAX_TOKENS_TO_CHARS_MULTIPLIER
        : 0;
    return Math.max(resolveBaseThreshold(customThresholdChars), dynamicThreshold);
};

export const shouldApplyBalancedTruncation = (contentLength, maxTokens, customThresholdChars) => {
    if (!Number.isFinite(contentLength) || contentLength <= 0) {
        return false;
    }
    return contentLength > getBalancedTruncationThreshold(maxTokens, customThresholdChars);
};

export const getBalancedTruncationTargetLength = (contentLength, maxTokens, customThresholdChars) => {
    if (!Number.isFinite(contentLength) || contentLength <= 0) {
        return 0;
    }
    const threshold = getBalancedTruncationThreshold(maxTokens, customThresholdChars);
    return Math.min(contentLength, threshold);
};
