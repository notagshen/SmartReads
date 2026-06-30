import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useOptimizedNotifications } from './useOptimizedNotifications';
import { loadJSON, saveJSON, removeKey } from '../utils/storage';

const BATCH_RUNTIME_KEY = 'backend-analysis-batch';
const ACTIVE_STATUSES = new Set(['RUNNING', 'CANCELLING']);
const TERMINAL_STATUSES = new Set(['SUCCESS', 'FAILED', 'CANCELLED']);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readBatchRuntime = () => loadJSON(BATCH_RUNTIME_KEY, null, { version: 'v1' });

const writeBatchRuntime = (batchId) => {
    if (!batchId) return removeKey(BATCH_RUNTIME_KEY, { version: 'v1' });
    saveJSON(BATCH_RUNTIME_KEY, { batchId, savedAt: Date.now() }, { version: 'v1' });
};

const parseApiError = async (response) => {
    const payload = await response.json().catch(() => null);
    return payload?.error?.message || payload?.message || response.statusText;
};

export const useBackendAnalysisBatch = () => {
    const {
        settings,
        updateAnalysisResult,
        clearAnalysisResults,
        updateAnalysisProgress,
        startAnalysis,
        completeAnalysis,
        markResumeHandled
    } = useAppContext();
    const { notifySuccess, notifyError, notifyWarning } = useOptimizedNotifications();
    const [isPolling, setIsPolling] = useState(false);
    const [hasSavedBatch, setHasSavedBatch] = useState(Boolean(readBatchRuntime()?.batchId));
    const stopRef = useRef(false);
    const pollingBatchRef = useRef('');

    const applyBatchState = useCallback((state) => {
        const totalFiles = Number(state.totalFiles) || 0;
        const completedFiles = Number(state.completedFiles) || 0;
        const progress = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

        Object.entries(state.results || {}).forEach(([fileName, result]) => {
            updateAnalysisResult(
                fileName,
                result.content || '',
                Boolean(result.isComplete),
                Boolean(result.hasError),
                result.meta || null
            );
        });

        updateAnalysisProgress({
            isAnalyzing: ACTIVE_STATUSES.has(state.status),
            currentFile: state.currentFile || '',
            totalFiles,
            completedFiles,
            progress: state.status === 'SUCCESS' ? 100 : progress
        });
    }, [updateAnalysisProgress, updateAnalysisResult]);

    const finishTerminalState = useCallback((state) => {
        writeBatchRuntime('');
        setHasSavedBatch(false);
        markResumeHandled();

        if (state.status === 'SUCCESS') {
            completeAnalysis();
            notifySuccess('分析完成', `后端已处理 ${state.completedFiles}/${state.totalFiles} 个文件`);
            return;
        }

        updateAnalysisProgress({ isAnalyzing: false, currentFile: '' });
        if (state.status === 'CANCELLED') {
            notifyWarning('分析已取消', `已完成 ${state.completedFiles}/${state.totalFiles} 个文件，后端任务已终止`);
            return;
        }

        notifyError('分析失败', state.errorMessage || '后端任务失败');
    }, [completeAnalysis, markResumeHandled, notifyError, notifySuccess, notifyWarning, updateAnalysisProgress]);

    const fetchBatchState = useCallback(async (batchId) => {
        const response = await fetch(`/api/analysis/batches/${encodeURIComponent(batchId)}`);
        if (!response.ok) throw new Error(await parseApiError(response));
        return response.json();
    }, []);

    const pollBatch = useCallback(async (batchId) => {
        stopRef.current = false;
        pollingBatchRef.current = batchId;
        setIsPolling(true);
        setHasSavedBatch(true);
        writeBatchRuntime(batchId);

        try {
            while (!stopRef.current) {
                const state = await fetchBatchState(batchId);
                applyBatchState(state);

                if (TERMINAL_STATUSES.has(state.status)) {
                    finishTerminalState(state);
                    return state;
                }

                await delay(1500);
            }
            notifyWarning('分析轮询已停止', '后端任务仍在运行，可刷新页面后恢复查看进度');
            return null;
        } catch (error) {
            updateAnalysisProgress({ isAnalyzing: false });
            notifyError('分析状态同步失败', error.message);
            throw error;
        } finally {
            if (pollingBatchRef.current === batchId) {
                pollingBatchRef.current = '';
                setIsPolling(false);
            }
        }
    }, [applyBatchState, fetchBatchState, finishTerminalState, notifyError, notifyWarning, updateAnalysisProgress]);

    const startBackendAnalysis = useCallback(async (analysisQueue = []) => {
        if (!Array.isArray(analysisQueue) || analysisQueue.length === 0) {
            notifyWarning('分析队列为空，请先添加文件到分析队列');
            return;
        }
        if (!settings.apiKey) {
            notifyError('分析', '请先在设置中配置API密钥');
            return;
        }

        stopRef.current = true;
        clearAnalysisResults();
        startAnalysis(analysisQueue.length);

        try {
            const response = await fetch('/api/analysis/batches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: analysisQueue, settings })
            });
            if (!response.ok) throw new Error(await parseApiError(response));

            const state = await response.json();
            applyBatchState(state);
            notifySuccess('分析已提交', `已一次性提交 ${analysisQueue.length} 个文件给后端处理`);
            await pollBatch(state.id);
        } catch (error) {
            updateAnalysisProgress({ isAnalyzing: false, currentFile: '', progress: 0 });
            throw error;
        }
    }, [applyBatchState, clearAnalysisResults, notifyError, notifySuccess, notifyWarning, pollBatch, settings, startAnalysis, updateAnalysisProgress]);

    const resumeBackendAnalysis = useCallback(async () => {
        const runtime = readBatchRuntime();
        if (!runtime?.batchId) {
            notifyWarning('续跑', '没有可恢复的后端分析任务');
            return;
        }
        await pollBatch(runtime.batchId);
    }, [notifyWarning, pollBatch]);

    const cancelBackendAnalysis = useCallback(async () => {
        const batchId = pollingBatchRef.current || readBatchRuntime()?.batchId;
        if (!batchId) {
            updateAnalysisProgress({ isAnalyzing: false, currentFile: '' });
            notifyWarning('取消分析', '没有找到可取消的后端任务');
            return;
        }

        const response = await fetch(`/api/analysis/batches/${encodeURIComponent(batchId)}/cancel`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error(await parseApiError(response));

        const state = await response.json();
        applyBatchState(state);
        notifyWarning('正在取消分析', '已向后端发送取消请求，当前请求会尽快中止');

        if (TERMINAL_STATUSES.has(state.status)) {
            finishTerminalState(state);
            return;
        }
        if (!isPolling) await pollBatch(batchId);
    }, [applyBatchState, finishTerminalState, isPolling, notifyWarning, pollBatch, updateAnalysisProgress]);

    useEffect(() => {
        setHasSavedBatch(Boolean(readBatchRuntime()?.batchId));
    }, []);

    return {
        isPolling,
        hasSavedBatch,
        startBackendAnalysis,
        resumeBackendAnalysis,
        cancelBackendAnalysis
    };
};
