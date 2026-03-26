import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useCache } from './CacheContext';
import { saveJSON, loadJSON, clearNamespace } from '../utils/storage';
import { DEFAULT_UPSTREAM_BASE_URL } from '../utils/apiBaseUrl';

const AppContext = createContext();
const ANALYSIS_RUNTIME_KEY = 'analysis-runtime';
const DEFAULT_ANALYSIS_PROGRESS = {
    isAnalyzing: false,
    currentFile: '',
    progress: 0,
    totalFiles: 0,
    completedFiles: 0
};

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
    const [theme, setTheme] = useState('light');
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [chapterFiles, setChapterFiles] = useState([]);
    const [analysisQueue, setAnalysisQueue] = useState([]);
    const [settings, setSettings] = useState({
        apiKey: '',
        baseUrl: DEFAULT_UPSTREAM_BASE_URL,
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 4000
    });

    // API连接状态管理
    const [apiConnectionStatus, setApiConnectionStatus] = useState({
        isConnected: false,
        lastTested: null,
        message: ''
    });

    // 全局分析结果状态 - 支持实时流式显示
    const [analysisResults, setAnalysisResults] = useState({});
    const [analysisProgress, setAnalysisProgress] = useState(DEFAULT_ANALYSIS_PROGRESS);
    const [shouldResumeAnalysis, setShouldResumeAnalysis] = useState(false);

    const { cache, cacheChapterFiles, cacheAnalysisQueue, clearCache: clearCacheContext } = useCache();

    // 标记：是否已完成从缓存的首次回填
    const hydratedRef = useRef(false);
    const analysisHydratedRef = useRef(false);

    // 初始化：从本地存储加载settings与theme
    useEffect(() => {
        const persisted = loadJSON('settings', null, { version: 'v1' });
        if (persisted && typeof persisted === 'object') {
            setSettings(prev => ({ ...prev, ...persisted }));
            if (persisted.theme) {
                setTheme(persisted.theme);
                document.body.setAttribute('data-theme', persisted.theme);
            }
        } else {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                setTheme(savedTheme);
                document.body.setAttribute('data-theme', savedTheme);
            }
        }
    }, []);

    // 恢复分析运行时快照（用于刷新后续跑）
    useEffect(() => {
        const runtime = loadJSON(ANALYSIS_RUNTIME_KEY, null, { version: 'v1' });
        if (runtime && typeof runtime === 'object') {
            if (runtime.analysisResults && typeof runtime.analysisResults === 'object') {
                setAnalysisResults(runtime.analysisResults);
            }
            if (runtime.analysisProgress && typeof runtime.analysisProgress === 'object') {
                const restored = { ...DEFAULT_ANALYSIS_PROGRESS, ...runtime.analysisProgress };
                if (restored.isAnalyzing) {
                    // 浏览器刷新后网络连接已断，标记为待续跑
                    setShouldResumeAnalysis(true);
                    restored.isAnalyzing = false;
                }
                setAnalysisProgress(restored);
            }
        }
        analysisHydratedRef.current = true;
    }, []);

    // 去抖保存settings
    const saveTimer = useRef(null);
    useEffect(() => {
        if (!hydratedRef.current) return; // 避免首帧写入
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            const payload = { ...settings, theme };
            saveJSON('settings', payload, { version: 'v1' });
        }, 250);
        return () => saveTimer.current && clearTimeout(saveTimer.current);
    }, [settings, theme]);

    // 持久化分析运行时快照
    useEffect(() => {
        if (!analysisHydratedRef.current) return;
        saveJSON(
            ANALYSIS_RUNTIME_KEY,
            {
                analysisResults,
                analysisProgress,
                savedAt: Date.now()
            },
            { version: 'v1' }
        );
    }, [analysisResults, analysisProgress]);

    // 仅在首帧从缓存回填一次，避免与写回缓存互相触发
    useEffect(() => {
        if (hydratedRef.current) return;

        let didHydrate = false;
        if (chapterFiles.length === 0 && cache.chapterFiles && cache.chapterFiles.length > 0) {
            setChapterFiles(cache.chapterFiles);
            didHydrate = true;
        }
        if (analysisQueue.length === 0 && cache.analysisQueue && cache.analysisQueue.length > 0) {
            setAnalysisQueue(cache.analysisQueue);
            didHydrate = true;
        }
        // 即使缓存为空，也标记已完成首帧
        hydratedRef.current = true;
    }, [cache.chapterFiles, cache.analysisQueue, chapterFiles.length, analysisQueue.length]);

    // 将章节文件变动异步写入缓存（跳过首帧，且避免与缓存相同引用时写回）
    useEffect(() => {
        if (!hydratedRef.current) return;
        if (cache.chapterFiles !== chapterFiles) {
            cacheChapterFiles(chapterFiles);
        }
    }, [chapterFiles, cacheChapterFiles, cache.chapterFiles]);

    // 将分析队列变动异步写入缓存（跳过首帧，且避免与缓存相同引用时写回）
    useEffect(() => {
        if (!hydratedRef.current) return;
        if (cache.analysisQueue !== analysisQueue) {
            cacheAnalysisQueue(analysisQueue);
        }
    }, [analysisQueue, cacheAnalysisQueue, cache.analysisQueue]);

    // 设置主题
    const handleSetTheme = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.body.setAttribute('data-theme', newTheme);
    };

    // 切换主题
    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        handleSetTheme(newTheme);
    };

    // 清除客户端缓存（不动当前settings）
    const clearClientCache = () => {
        try {
            // 清除命名空间键
            clearNamespace('smartreads');
            // 清除旧版键
            localStorage.removeItem('smartreads-cache');
            // 清空上下文缓存
            clearCacheContext();
            setChapterFiles([]);
            setAnalysisQueue([]);
        } catch (e) {
            // 忽略错误，尽量清理
            console.warn('clearClientCache error:', e);
        }
    };

    // 打开设置模态框
    const openSettingsModal = () => {
        setIsSettingsModalOpen(true);
    };

    // 关闭设置模态框
    const closeSettingsModal = () => {
        setIsSettingsModalOpen(false);
    };

    // 更新设置
    const updateSettings = (newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    // 保存设置（立即保存并关闭）
    const saveSettings = () => {
        saveJSON('settings', { ...settings, theme }, { version: 'v1' });
        closeSettingsModal();
        return true;
    };

    // 切换章节文件选择状态
    const toggleChapterSelection = (fileId) => {
        setChapterFiles(prev => prev.map(file =>
            file.id === fileId ? { ...file, selected: !file.selected } : file
        ));
    };

    // 队列选择：切换/全选/全不选
    const toggleQueueSelection = (fileId) => {
        setAnalysisQueue(prev => prev.map(item =>
            item.id === fileId ? { ...item, selected: !item.selected } : item
        ));
    };
    const selectAllQueue = () => {
        setAnalysisQueue(prev => prev.map(item => ({ ...item, selected: true })));
    };
    const deselectAllQueue = () => {
        setAnalysisQueue(prev => prev.map(item => ({ ...item, selected: false })));
    };

    // 添加选中文件到分析队列（入队后默认不选中，便于用户手动批量选择）
    const addToQueue = () => {
        const selectedFiles = chapterFiles.filter(file => file.selected);
        setAnalysisQueue(prev => {
            const existingIds = new Set(prev.map(item => item.id));
            const newItems = selectedFiles
                .filter(file => !existingIds.has(file.id))
                .map(file => ({ ...file, selected: false }));
            return [...prev, ...newItems];
        });

        setChapterFiles(prev => prev.map(file => ({ ...file, selected: false })));
    };

    const removeFromQueue = (fileId) => {
        setAnalysisQueue(prev => prev.filter(item => item.id !== fileId));
    };

    const clearQueue = () => {
        setAnalysisQueue([]);
    };

    const loadChapterFiles = (files, autoSelect = false) => {
        const formattedFiles = files.map((file, index) => ({
            id: file.id || `manual_${index}_${Date.now()}`,
            name: file.name || `文件${index + 1}`,
            content: file.content || '',
            selected: autoSelect ? index < 3 : (file.selected !== undefined ? file.selected : false),
            source: file.source || 'manual_upload',
            size: (file.content || '').length,
            chapters: (file.content || '').split('\n\n').filter(line => line.trim()).length
        }));
        setChapterFiles(formattedFiles);
    };

    const selectAllFiles = () => {
        setChapterFiles(prev => prev.map(file => ({ ...file, selected: true })));
    };

    const deselectAllFiles = () => {
        setChapterFiles(prev => prev.map(file => ({ ...file, selected: false })));
    };

    // 分析结果管理
    const updateAnalysisResult = (fileName, content, isComplete = false, hasError = false) => {
        setAnalysisResults(prev => ({
            ...prev,
            [fileName]: {
                content: content,
                isComplete,
                hasError,
                timestamp: Date.now()
            }
        }));
    };

    const clearAnalysisResults = () => {
        setAnalysisResults({});
        setAnalysisProgress(DEFAULT_ANALYSIS_PROGRESS);
        setShouldResumeAnalysis(false);
    };

    const updateAnalysisProgress = (progressData) => {
        setAnalysisProgress(prev => ({
            ...prev,
            ...progressData
        }));
    };

    const startAnalysis = (totalFiles) => {
        setAnalysisProgress({
            isAnalyzing: true,
            currentFile: '',
            progress: 0,
            totalFiles,
            completedFiles: 0
        });
    };

    const completeAnalysis = () => {
        setAnalysisProgress(prev => ({
            ...prev,
            isAnalyzing: false,
            progress: 100,
            currentFile: ''
        }));
    };

    const markResumeHandled = () => {
        setShouldResumeAnalysis(false);
    };

    const value = {
        theme,
        setTheme: handleSetTheme,
        toggleTheme,

        isSettingsModalOpen,
        openSettingsModal,
        closeSettingsModal,

        settings,
        updateSettings,
        saveSettings,
        clearClientCache,

        // API连接状态
        apiConnectionStatus,
        setApiConnectionStatus,

        chapterFiles,
        analysisQueue,
        toggleChapterSelection,
        toggleQueueSelection,
        selectAllQueue,
        deselectAllQueue,
        addToQueue,
        removeFromQueue,
        clearQueue,
        loadChapterFiles,
        selectAllFiles,
        deselectAllFiles,

        // 分析结果管理
        analysisResults,
        analysisProgress,
        shouldResumeAnalysis,
        updateAnalysisResult,
        clearAnalysisResults,
        updateAnalysisProgress,
        startAnalysis,
        completeAnalysis,
        markResumeHandled
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
}; 
