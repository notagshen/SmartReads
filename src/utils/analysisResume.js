export const partitionQueueByResults = (analysisQueue = [], analysisResults = {}) => {
    const cachedResults = {};
    const filesToAnalyze = [];

    for (const file of analysisQueue || []) {
        const existing = analysisResults?.[file.name];
        const canReuse = Boolean(
            existing &&
            existing.isComplete &&
            !existing.hasError &&
            typeof existing.content === 'string' &&
            existing.content.length > 0
        );

        if (canReuse) {
            cachedResults[file.name] = existing.content;
        } else {
            filesToAnalyze.push(file);
        }
    }

    return { cachedResults, filesToAnalyze };
};

export const shouldAutoResume = (resumeFlag, analysisQueue = []) =>
    Boolean(resumeFlag && Array.isArray(analysisQueue) && analysisQueue.length > 0);

export const createResumeLogEntry = (type, message) => ({
    id: `resume_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    timestamp: Date.now()
});
