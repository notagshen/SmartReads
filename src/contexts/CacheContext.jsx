import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const CacheContext = createContext();

export const useCache = () => useContext(CacheContext);

/**
 * 缓存管理器 v2.0
 * 支持多参数组合的智能缓存系统
 */
export const CacheProvider = ({ children }) => {
    const [cache, setCache] = useState({
        // EPUB转换结果缓存
        epubConversion: {
            file: null,
            result: null,
            timestamp: null
        },
        // 章节拆分结果缓存 - 新的多槽位设计
        chapterSplitResults: new Map(), // key: cacheKey, value: {result, settings, timestamp}
        // 分析队列缓存
        analysisQueue: [],
        // 分析结果缓存
        analysisResults: {},
        // 文件列表缓存
        chapterFiles: []
    });

    // 从localStorage加载缓存
    useEffect(() => {
        try {
            const savedCache = localStorage.getItem('smartreads-cache');
            if (savedCache) {
                const parsedCache = JSON.parse(savedCache);
                
                // 特殊处理Map类型的数据
                if (parsedCache.chapterSplitResults) {
                    const mapData = Array.isArray(parsedCache.chapterSplitResults) 
                        ? parsedCache.chapterSplitResults
                        : Object.entries(parsedCache.chapterSplitResults || {});
                    parsedCache.chapterSplitResults = new Map(mapData);
                }
                
                setCache(prev => ({ 
                    ...prev, 
                    ...parsedCache,
                    chapterSplitResults: parsedCache.chapterSplitResults || new Map()
                }));
            }
        } catch (error) {
            console.warn('加载缓存失败:', error);
        }
    }, []);

    // 保存缓存到localStorage（稳定引用）
    const saveCache = useCallback((newCache) => {
        try {
            const cacheToSave = {
                ...newCache,
                chapterSplitResults: Array.from(newCache.chapterSplitResults.entries())
            };
            localStorage.setItem('smartreads-cache', JSON.stringify(cacheToSave));
        } catch (error) {
            console.warn('保存缓存失败:', error);
        }
    }, []);

    // 生成缓存键
    const generateCacheKey = (file, settings) => {
        const fileInfo = typeof file === 'object' && file.name 
            ? `${file.name}_${file.size}_${file.lastModified}`
            : String(file);
        const settingsKey = JSON.stringify(settings);
        return `${fileInfo}__${settingsKey}`;
    };

    // 缓存EPUB转换结果（函数式更新，避免覆盖） - 稳定引用
    const cacheEpubConversion = useCallback((file, result) => {
        setCache(prev => {
            const next = {
                ...prev,
                epubConversion: {
                    file: {
                        name: file.name,
                        size: file.size,
                        lastModified: file.lastModified
                    },
                    result,
                    timestamp: Date.now()
                }
            };
            saveCache(next);
            return next;
        });
    }, [saveCache]);

    // 缓存章节拆分结果 - 新的多槽位实现（函数式更新） - 稳定引用
    const cacheChapterSplit = useCallback((file, result, settings) => {
        setCache(prev => {
            const cacheKey = generateCacheKey(file, settings);
            const newSplitResults = new Map(prev.chapterSplitResults);
            newSplitResults.set(cacheKey, {
                file: typeof file === 'object' ? {
                    name: file.name,
                    size: file.size,
                    lastModified: file.lastModified
                } : { name: String(file) },
                result,
                settings,
                timestamp: Date.now()
            });
            const next = { ...prev, chapterSplitResults: newSplitResults };
            saveCache(next);
            return next;
        });
    }, [saveCache]);

    // 获取章节拆分缓存 - 新的查找逻辑（可不稳定，不在依赖中使用）
    const getCachedChapterSplit = (file, settings) => {
        const cacheKey = generateCacheKey(file, settings);
        const cached = cache.chapterSplitResults.get(cacheKey);
        
        if (!cached) return null;
        
        // 检查缓存是否过期（1小时）
        const isExpired = Date.now() - cached.timestamp > 60 * 60 * 1000;
        if (isExpired) {
            // 清理过期缓存
            setCache(prev => {
                const newSplitResults = new Map(prev.chapterSplitResults);
                newSplitResults.delete(cacheKey);
                const next = { ...prev, chapterSplitResults: newSplitResults };
                saveCache(next);
                return next;
            });
            return null;
        }
        
        return cached.result;
    };

    // 获取所有可用的拆分结果（用于数据源选择）
    const getAllCachedSplitResults = () => {
        const results = [];
        const now = Date.now();
        
        for (const [key, value] of cache.chapterSplitResults.entries()) {
            const isExpired = now - value.timestamp > 60 * 60 * 1000;
            if (!isExpired) {
                results.push({
                    key,
                    file: value.file,
                    settings: value.settings,
                    result: value.result,
                    timestamp: value.timestamp
                });
            }
        }
        
        return results.sort((a, b) => b.timestamp - a.timestamp); // 最新的在前
    };

    // 缓存分析队列（函数式更新） - 稳定引用
    const cacheAnalysisQueue = useCallback((queue) => {
        setCache(prev => {
            const next = { ...prev, analysisQueue: queue };
            saveCache(next);
            return next;
        });
    }, [saveCache]);

    // 缓存分析结果（函数式更新） - 稳定引用
    const cacheAnalysisResult = useCallback((fileName, result) => {
        setCache(prev => {
            const next = {
                ...prev,
                analysisResults: {
                    ...prev.analysisResults,
                    [fileName]: { result, timestamp: Date.now() }
                }
            };
            saveCache(next);
            return next;
        });
    }, [saveCache]);

    // 缓存文件列表（函数式更新） - 稳定引用
    const cacheChapterFiles = useCallback((files) => {
        setCache(prev => {
            const next = { ...prev, chapterFiles: files };
            saveCache(next);
            return next;
        });
    }, [saveCache]);

    // 获取缓存的EPUB转换结果
    const getCachedEpubConversion = (file) => {
        const cached = cache.epubConversion;
        if (!cached.file || !cached.result) return null;
        
        // 检查文件是否匹配
        if (cached.file.name === file.name && 
            cached.file.size === file.size && 
            cached.file.lastModified === file.lastModified) {
            
            // 检查缓存是否过期（1小时）
            const isExpired = Date.now() - cached.timestamp > 60 * 60 * 1000;
            if (!isExpired) {
                return cached.result;
            }
        }
        
        return null;
    };

    // 获取缓存的分析结果
    const getCachedAnalysisResult = (fileName) => {
        const cached = cache.analysisResults[fileName];
        if (!cached) return null;
        
        // 检查缓存是否过期（24小时）
        const isExpired = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000;
        if (!isExpired) {
            return cached.result;
        }
        
        return null;
    };

    // 清除缓存（函数式更新） - 稳定引用
    const clearCache = useCallback(() => {
        setCache(() => {
            const emptyCache = {
                epubConversion: { file: null, result: null, timestamp: null },
                chapterSplitResults: new Map(),
                analysisQueue: [],
                analysisResults: {},
                chapterFiles: []
            };
            saveCache(emptyCache);
            return emptyCache;
        });
    }, [saveCache]);

    // 清除特定类型的缓存（函数式更新） - 稳定引用
    const clearSpecificCache = useCallback((type) => {
        setCache(prev => {
            const next = { ...prev };
            switch (type) {
                case 'epub':
                    next.epubConversion = { file: null, result: null, timestamp: null };
                    break;
                case 'split':
                    next.chapterSplitResults = new Map();
                    break;
                case 'analysis':
                    next.analysisResults = {};
                    break;
                case 'queue':
                    next.analysisQueue = [];
                    break;
                case 'files':
                    next.chapterFiles = [];
                    break;
            }
            saveCache(next);
            return next;
        });
    }, [saveCache]);

    const value = {
        cache,
        cacheEpubConversion,
        cacheChapterSplit,
        cacheAnalysisQueue,
        cacheAnalysisResult,
        cacheChapterFiles,
        getCachedEpubConversion,
        getCachedChapterSplit,
        getCachedAnalysisResult,
        getAllCachedSplitResults,
        clearCache,
        clearSpecificCache
    };

    return (
        <CacheContext.Provider value={value}>
            {children}
        </CacheContext.Provider>
    );
}; 