export const sanitizeTemperature = (value, fallback = 0.7) => {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) {
        return fallback;
    }
    return parsed;
};

export const sanitizeMaxTokens = (value, fallback = 4000) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
};

export const sanitizeTruncationThreshold = (value, fallback = 120000) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
};
