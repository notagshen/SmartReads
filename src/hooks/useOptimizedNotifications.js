import { useCallback } from 'react';
import { useNotification } from '../contexts/NotificationContext';

/**
 * 优化的通知Hook - 极简版
 * 仅显示成功与失败；过滤掉过程中提示
 */
export const useOptimizedNotifications = () => {
    const { addNotification } = useNotification();

    // 仅成功/失败
    const notifyError = useCallback((operation, error) => {
        let message = '';
        message = `${operation}失败: ${error}`;
        if (message.length > 100) message = message.substring(0, 97) + '...';
        addNotification(message, 'error');
    }, [addNotification]);

    const notifySuccess = useCallback((operation, details = '') => {
        const message = details ? `${operation}成功: ${details}` : `${operation}成功`;
        addNotification(message, 'success');
    }, [addNotification]);

    // 以下函数仅保留接口，不产生info提示
    const throttledNotify = () => {};
    const notifyFileSelected = () => {};
    const notifyEpubProgress = () => {};
    const notifyChapterSplit = () => {};
    const notifyAnalysisProgress = () => {};
    const notifyBatchResult = () => {};
    const notifyWarning = () => {};
    const notifyCacheOperation = () => {};

    return {
        notify: addNotification,
        throttledNotify,
        notifyFileSelected,
        notifyEpubProgress,
        notifyChapterSplit,
        notifyAnalysisProgress,
        notifyBatchResult,
        notifyError,
        notifySuccess,
        notifyWarning,
        notifyCacheOperation
    };
}; 