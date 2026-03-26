export const buildShareDisplayResults = (analysisResults = {}, shareView = null) => {
    if (!shareView || typeof shareView.content !== 'string' || shareView.content.trim().length === 0) {
        return analysisResults || {};
    }

    const fileName = typeof shareView.fileName === 'string' && shareView.fileName.trim()
        ? shareView.fileName.trim()
        : '分享链接导入.md';

    return {
        [fileName]: {
            content: shareView.content,
            isComplete: true,
            hasError: false,
            meta: shareView.meta || null,
            timestamp: Number.isFinite(shareView.timestamp) ? shareView.timestamp : 0
        }
    };
};
