import { randomBytes } from 'node:crypto';
import { buildUpstreamTargetUrl, ensureSafeUpstreamBaseUrl } from '../utils/upstreamProxyGuard.js';
import { buildChatCompletionRequestBody } from '../utils/chatApiCompat.js';
import { parseUpstreamPayload, readUpstreamText } from './upstreamStreamReader.js';
import { publishBatchState, subscribeBatchState } from './batchSseHub.js';
import {
    createAnalysisPrompt,
    normalizeAndValidateAnalysisResult,
    prepareAnalysisInput
} from '../utils/analysisCore.js';

const ANALYSIS_PREFIX = '/api/analysis/batches';
const FINISHED_STATE_TTL_MS = 60 * 60 * 1000;
const INTER_FILE_DELAY_MS = 1000;
const MAX_RETRIES = 2;
const ACTIVE_STATUSES = new Set(['RUNNING', 'CANCELLING']);
const TERMINAL_STATUSES = new Set(['SUCCESS', 'FAILED', 'CANCELLED']);
const batches = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); const createBatchId = () => randomBytes(12).toString('base64url');

const cloneState = (state) => ({
    id: state.id,
    status: state.status,
    totalFiles: state.totalFiles,
    completedFiles: state.completedFiles,
    currentFile: state.currentFile,
    errorMessage: state.errorMessage,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    finishedAt: state.finishedAt,
    cancelledAt: state.cancelledAt,
    results: state.results
});

const evictExpiredBatches = () => {
    const threshold = Date.now() - FINISHED_STATE_TTL_MS;
    for (const [id, state] of batches.entries()) {
        if (!ACTIVE_STATUSES.has(state.status) && state.finishedAt && state.finishedAt < threshold) {
            batches.delete(id);
        }
    }
};

const parseErrorMessage = (status, fallbackStatusText, payload) => {
    if (!payload) return `${status} ${fallbackStatusText}`;
    if (typeof payload === 'string') return `${status} ${payload.slice(0, 120)}`;
    return `${status} ${payload.error?.message || payload.message || fallbackStatusText}`;
};

const isCancellationError = (error) => (
    error?.name === 'AbortError' || error?.message === '分析任务已取消'
);

const assertNotCancelled = (state) => {
    if (state.cancelRequested) {
        const error = new Error('分析任务已取消');
        error.name = 'AbortError';
        throw error;
    }
};


const callUpstreamAnalysis = async ({ settings, upstreamBaseUrl, content, expectedNumbers, signal, onText }) => {
    const requestBody = buildChatCompletionRequestBody({
        model: settings.model,
        prompt: createAnalysisPrompt(content, expectedNumbers),
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        stream: true
    });

    const targetUrl = buildUpstreamTargetUrl(upstreamBaseUrl, '/chat/completions', '');
    const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal
    });

    if (!response.ok) {
        const payload = await parseUpstreamPayload(response);
        throw new Error(`API调用失败: ${parseErrorMessage(response.status, response.statusText, payload)}`);
    }

    const text = await readUpstreamText(response, onText);
    if (!text) {
        throw new Error('API返回成功，但响应中缺少可用文本（message.content/reasoning_content）');
    }
    return text;
};

const analyzeFile = async (file, settings, upstreamBaseUrl, state, onText) => {
    const { fileName, analysisContent, expectedNumbers } = prepareAnalysisInput(file, settings);
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        assertNotCancelled(state);
        const abortController = new AbortController();
        state.abortController = abortController;
        try {
            const rawResult = await callUpstreamAnalysis({
                settings,
                upstreamBaseUrl,
                content: analysisContent,
                expectedNumbers,
                signal: abortController.signal,
                onText
            });
            assertNotCancelled(state);
            const normalized = normalizeAndValidateAnalysisResult(rawResult, expectedNumbers);
            return {
                fileName,
                content: normalized,
                meta: {
                    expectedChapterNumbers: expectedNumbers,
                    rowCount: expectedNumbers.length
                }
            };
        } catch (error) {
            if (state.cancelRequested || isCancellationError(error)) throw error;
            lastError = error;
        } finally {
            if (state.abortController === abortController) {
                state.abortController = null;
            }
        }
    }

    throw lastError || new Error('分析结果校验失败');
};

const markCancelled = (state) => {
    const now = Date.now();
    state.status = 'CANCELLED';
    state.currentFile = '';
    state.errorMessage = '分析任务已取消';
    state.cancelledAt = state.cancelledAt || now;
    state.finishedAt = state.finishedAt || now;
    state.updatedAt = now;
};

const touchAndPublish = (state) => {
    state.updatedAt = Date.now();
    publishBatchState(state, cloneState);
};

const appendPartialResult = (state, fileName, text) => {
    if (!text) return;
    const existing = state.results[fileName] || {
        content: '',
        isComplete: false,
        hasError: false,
        meta: null,
        timestamp: Date.now()
    };
    state.results[fileName] = {
        ...existing,
        content: `${existing.content || ''}${text}`,
        isComplete: false,
        hasError: false,
        timestamp: Date.now()
    };
    touchAndPublish(state);
};

const runBatch = async (state, files, settings, upstreamBaseUrl) => {
    try {
        for (let i = 0; i < files.length; i += 1) {
            assertNotCancelled(state);
            const file = files[i];
            const fileName = file?.name || `文件${i + 1}`;
            state.currentFile = fileName;
            touchAndPublish(state);

            try {
                const analyzed = await analyzeFile(
                    file,
                    settings,
                    upstreamBaseUrl,
                    state,
                    (text) => appendPartialResult(state, fileName, text)
                );
                state.results[analyzed.fileName] = {
                    content: analyzed.content,
                    isComplete: true,
                    hasError: false,
                    meta: analyzed.meta,
                    timestamp: Date.now()
                };
            } catch (error) {
                if (state.cancelRequested || isCancellationError(error)) {
                    markCancelled(state);
                    publishBatchState(state, cloneState);
                    return;
                }
                state.results[fileName] = {
                    content: `分析失败: ${error.message}`,
                    isComplete: true,
                    hasError: true,
                    meta: null,
                    timestamp: Date.now()
                };
            }

            state.completedFiles = i + 1;
            touchAndPublish(state);
            if (i < files.length - 1) await delay(INTER_FILE_DELAY_MS);
        }
        state.status = 'SUCCESS';
        state.currentFile = '';
        publishBatchState(state, cloneState);
    } catch (error) {
        if (state.cancelRequested || isCancellationError(error)) {
            markCancelled(state);
            publishBatchState(state, cloneState);
            return;
        }
        state.status = 'FAILED';
        state.errorMessage = error.message;
    } finally {
        if (TERMINAL_STATUSES.has(state.status) && !state.finishedAt) {
            state.finishedAt = Date.now();
        }
        state.updatedAt = Date.now();
        publishBatchState(state, cloneState);
    }
};

const validateStartPayload = (body) => {
    const files = Array.isArray(body?.files) ? body.files : [];
    const settings = body?.settings && typeof body.settings === 'object' ? body.settings : {};

    if (files.length === 0) throw new Error('没有文件需要分析');
    if (!settings.apiKey) throw new Error('请先在设置中配置API密钥');

    const upstreamBaseUrl = ensureSafeUpstreamBaseUrl(settings.baseUrl);
    return { files, settings, upstreamBaseUrl };
};

const startBatch = (body) => {
    evictExpiredBatches();
    const { files, settings, upstreamBaseUrl } = validateStartPayload(body);
    const now = Date.now();
    const state = {
        id: createBatchId(),
        status: 'RUNNING',
        totalFiles: files.length,
        completedFiles: 0,
        currentFile: '',
        errorMessage: '',
        cancelRequested: false,
        cancelledAt: null,
        abortController: null,
        startedAt: now,
        updatedAt: now,
        finishedAt: null,
        results: {}
    };

    batches.set(state.id, state);
    setTimeout(() => runBatch(state, files, settings, upstreamBaseUrl), 0);
    return cloneState(state);
};

const getBatchState = (id) => batches.get(id);

const cancelBatch = (id) => {
    const state = getBatchState(id);
    if (!state) {
        return { statusCode: 404, payload: { error: { message: '分析任务不存在或已过期' } } };
    }

    if (!ACTIVE_STATUSES.has(state.status)) {
        return { statusCode: 200, payload: cloneState(state) };
    }

    state.cancelRequested = true;
    state.status = 'CANCELLING';
    state.errorMessage = '正在取消分析任务';
    state.cancelledAt = state.cancelledAt || Date.now();
    state.updatedAt = Date.now();
    state.abortController?.abort();
    publishBatchState(state, cloneState);
    return { statusCode: 202, payload: cloneState(state) };
};

export const isAnalysisBatchEventsPath = (pathname = '') => (
    pathname.startsWith(`${ANALYSIS_PREFIX}/`) && pathname.endsWith('/events')
);

export const handleAnalysisBatchEventStream = ({ req, res, pathname }) => {
    evictExpiredBatches();
    const subPath = parseBatchSubPath(pathname);
    const id = subPath ? decodeURIComponent(subPath.slice(0, -'/events'.length)) : '';
    const state = getBatchState(id);
    if (!state) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: { message: '分析任务不存在或已过期' } }));
        return;
    }
    subscribeBatchState({ req, res, state, getSnapshot: cloneState });
};

const parseBatchSubPath = (pathname) => {
    if (!pathname.startsWith(`${ANALYSIS_PREFIX}/`)) return null;
    return pathname.slice(`${ANALYSIS_PREFIX}/`.length);
};

export const handleAnalysisBatchRequest = async ({ method, pathname, body }) => {
    evictExpiredBatches();

    if (method === 'POST' && pathname === ANALYSIS_PREFIX) {
        return { statusCode: 202, payload: startBatch(body) };
    }

    const subPath = parseBatchSubPath(pathname);
    if (method === 'POST' && subPath?.endsWith('/cancel')) {
        const id = decodeURIComponent(subPath.slice(0, -'/cancel'.length));
        return cancelBatch(id);
    }

    if (method === 'GET' && subPath) {
        const id = decodeURIComponent(subPath);
        const state = getBatchState(id);
        if (!state) {
            return { statusCode: 404, payload: { error: { message: '分析任务不存在或已过期' } } };
        }
        return { statusCode: 200, payload: cloneState(state) };
    }

    return { statusCode: 404, payload: { error: { message: '分析任务接口不存在' } } };
};

export const isAnalysisBatchPath = (pathname = '') => pathname.startsWith(ANALYSIS_PREFIX);
