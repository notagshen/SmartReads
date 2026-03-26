import React, { useState, useEffect } from 'react';
import styles from './PreprocessPanel.module.css';
import FileInput from '../../common/FileInput/FileInput';
import Select from '../../common/Select/Select';
import Button from '../../common/Button/Button';
import ProgressBar from '../../common/ProgressBar/ProgressBar';
import { useFileHandler } from '../../../hooks/useFileHandler';
import { useOptimizedNotifications } from '../../../hooks/useOptimizedNotifications';
import { useCache } from '../../../contexts/CacheContext';
import { FaBook, FaCut, FaPlay, FaFolderOpen, FaDownload, FaDatabase, FaFileUpload } from 'react-icons/fa';

const PreprocessPanel = () => {
    const [activeTab, setActiveTab] = useState('epub');
    const [epubFile, setEpubFile] = useState(null);
    const [novelFile, setNovelFile] = useState(null);
    const [chapterGroupSize, setChapterGroupSize] = useState('5');
    
    // 章节拆分数据源选择
    const [splitDataSource, setSplitDataSource] = useState('file'); // 'file' 或 'cache'
    
    // 分别管理EPUB转换和章节拆分的状态
    const [epubState, setEpubState] = useState({
        progress: 0,
        status: '准备就绪',
        result: null
    });
    
    const [splitState, setSplitState] = useState({
        progress: 0,
        status: '准备就绪',
        result: []
    });
    
    const { 
        notifyFileSelected,
        notifyEpubProgress,
        notifyChapterSplit,
        notifySuccess,
        notifyError,
        notifyCacheOperation
    } = useOptimizedNotifications();
    
    const {
        cache,
        cacheEpubConversion,
        cacheChapterSplit,
        getCachedEpubConversion,
        getCachedChapterSplit
    } = useCache();
    
    const { 
        isProcessing, 
        selectFile, 
        readTextFile, 
        parseEpubFile, 
        splitTextToChapters, 
        downloadFile,
        downloadMultipleFiles 
    } = useFileHandler();

    const chapterGroupOptions = [
        { value: '5', label: '5章/组' },
        { value: '10', label: '10章/组' },
        { value: '20', label: '20章/组' },
        { value: '50', label: '50章/组' },
        { value: '100', label: '100章/组' },
        { value: '200', label: '200章/组' }
    ];

    // 检查是否有可用的EPUB转换缓存
    const hasEpubCache = cache.epubConversion?.result;
    
    // 组件加载时检查缓存状态
    useEffect(() => {
        if (hasEpubCache && splitDataSource === 'file') {
            // 如果有缓存数据，默认选择使用缓存
            setSplitDataSource('cache');
        }
    }, [hasEpubCache]);

    const handleEpubSelect = async () => {
        try {
            const file = await selectFile('.epub');
            setEpubFile(file);
            notifyFileSelected(file.name);
            
            // 检查缓存
            const cached = getCachedEpubConversion(file);
            if (cached) {
                setEpubState({
                    progress: 100,
                    status: '转换完成',
                    result: cached
                });
                notifyCacheOperation('hit');
            } else {
                // 清空之前的转换结果
                setEpubState({
                    progress: 0,
                    status: '准备就绪',
                    result: null
                });
            }
        } catch (error) {
            if (error.message !== '用户取消选择') {
                notifyError('文件选择', error.message);
            }
        }
    };

    const handleNovelSelect = async () => {
        try {
            const file = await selectFile('.txt,text/plain');
            setNovelFile(file);
            notifyFileSelected(file.name);
            
            // 检查缓存
            const settings = { groupSize: chapterGroupSize, source: 'file' };
            const cached = getCachedChapterSplit(file, settings);
            if (cached) {
                setSplitState({
                    progress: 100,
                    status: '拆分完成',
                    result: cached
                });
                notifyCacheOperation('hit');
            } else {
                // 清空之前的处理结果
                setSplitState({
                    progress: 0,
                    status: '准备就绪',
                    result: []
                });
            }
        } catch (error) {
            if (error.message !== '用户取消选择') {
                notifyError('文件选择', error.message);
            }
        }
    };

    const handleEpubConvert = async () => {
        if (!epubFile) {
            notifyError('转换', '请先选择EPUB文件');
            return;
        }

        try {
            // 检查缓存
            const cached = getCachedEpubConversion(epubFile);
            if (cached) {
                setEpubState({
                    progress: 100,
                    status: '转换完成',
                    result: cached
                });
                notifyCacheOperation('hit');
                return;
            }

            notifyEpubProgress('start');
            setEpubState(prev => ({
                ...prev,
                status: '转换中...',
                progress: 20
            }));
            
            const result = await parseEpubFile(epubFile);
            
            if (result && result.length > 0) {
                const txtFile = result[0];
                setEpubState({
                    progress: 100,
                    status: '转换完成',
                    result: txtFile
                });
                
                // 缓存结果
                cacheEpubConversion(epubFile, txtFile);
                notifyEpubProgress('complete', `${txtFile.chapterCount}章`);
            } else {
                throw new Error('转换结果为空');
            }
            
        } catch (error) {
            setEpubState(prev => ({
                ...prev,
                status: '转换失败',
                progress: 0,
                result: null
            }));
            notifyError('EPUB转换', error.message);
        }
    };

    const handleChapterSplit = async () => {
        try {
            let textContent = '';
            let sourceIdentifier = '';
            
            if (splitDataSource === 'cache') {
                // 使用缓存的EPUB转换结果
                if (!hasEpubCache) {
                    notifyError('拆分', '没有可用的转换缓存');
                    return;
                }
                
                textContent = cache.epubConversion.result.content;
                sourceIdentifier = `cache_${cache.epubConversion.result.name}`;
                
                // 检查该缓存数据的拆分结果
                const settings = { groupSize: chapterGroupSize, source: 'cache', cacheId: sourceIdentifier };
                const cached = getCachedChapterSplit({ name: sourceIdentifier }, settings);
                if (cached) {
                    setSplitState({
                        progress: 100,
                        status: '拆分完成',
                        result: cached
                    });
                    notifyCacheOperation('hit');
                    return;
                }
            } else {
                // 使用上传的文件
                if (!novelFile) {
                    notifyError('拆分', '请先选择小说文件');
                    return;
                }
                
                textContent = await readTextFile(novelFile);
                sourceIdentifier = novelFile.name;
                
                // 检查该文件的拆分结果
                const settings = { groupSize: chapterGroupSize, source: 'file' };
                const cached = getCachedChapterSplit(novelFile, settings);
                if (cached) {
                    setSplitState({
                        progress: 100,
                        status: '拆分完成',
                        result: cached
                    });
                    notifyCacheOperation('hit');
                    return;
                }
            }

            // 开始拆分 - 简化的3个提示
            notifyChapterSplit('start'); // "开始拆分章节"
            setSplitState(prev => ({
                ...prev,
                status: '拆分中...',
                progress: 30
            }));
            
            const groups = await splitTextToChapters(textContent, parseInt(chapterGroupSize));
            setSplitState(prev => ({ ...prev, progress: 80 }));
            
            const files = groups.map(group => ({
                name: group.name,
                content: group.content,
                chapterNumbers: group.chapterNumbers || [],
                chapterStart: group.chapterStart,
                chapterEnd: group.chapterEnd
            }));
            
            setSplitState({
                progress: 100,
                status: '拆分完成',
                result: files
            });
            
            // 缓存结果
            const cacheKey = splitDataSource === 'cache' 
                ? { name: sourceIdentifier }
                : novelFile;
            const settings = { 
                groupSize: chapterGroupSize, 
                source: splitDataSource,
                ...(splitDataSource === 'cache' && { cacheId: sourceIdentifier })
            };
            cacheChapterSplit(cacheKey, files, settings);
            
            // 简化提示：只显示文件数量
            notifyChapterSplit('complete', `${files.length}个文件组`);
            
        } catch (error) {
            setSplitState(prev => ({
                ...prev,
                status: '拆分失败',
                progress: 0,
                result: []
            }));
            notifyError('章节拆分', error.message);
        }
    };

    const handleDownloadTxt = () => {
        if (!epubState.result) {
            notifyError('下载', '没有可下载的TXT文件');
            return;
        }

        try {
            downloadFile(epubState.result.content, epubState.result.name);
            notifySuccess('下载', epubState.result.name);
        } catch (error) {
            notifyError('下载', error.message);
        }
    };

    const handleDownloadAll = async () => {
        if (splitState.result.length === 0) {
            notifyError('下载', '没有可下载的文件');
            return;
        }

        try {
            await downloadMultipleFiles(splitState.result);
            notifySuccess('批量下载', `${splitState.result.length}个文件已打包为ZIP`);
            
            // ✅ 移除清空结果的逻辑，保持拆分结果显示
            // 不再清空 splitState.result，让用户可以重复下载
        } catch (error) {
            notifyError('批量下载', error.message);
        }
    };

    return (
        <div className={styles.panelContainer}>
            <div className={styles.subTabs}>
                <button
                    className={`${styles.subTab} ${activeTab === 'epub' ? styles.active : ''}`}
                    onClick={() => setActiveTab('epub')}
                    disabled={isProcessing}
                >
                    <FaBook />
                    <span>Epub转Txt</span>
                </button>
                <button
                    className={`${styles.subTab} ${activeTab === 'split' ? styles.active : ''}`}
                    onClick={() => setActiveTab('split')}
                    disabled={isProcessing}
                >
                    <FaCut />
                    <span>章节拆分</span>
                </button>
            </div>

            {activeTab === 'epub' && (
                <div className={styles.subContent}>
                    <FileInput
                        label="Epub文件:"
                        placeholder="选择Epub文件..."
                        value={epubFile}
                        onBrowse={handleEpubSelect}
                        icon={<FaFolderOpen />}
                        buttonText="浏览"
                        showFileInfo={true}
                        disabled={isProcessing}
                        readOnly
                    />

                    <Button
                        icon={<FaPlay />}
                        label={isProcessing ? "转换中..." : "开始转换"}
                        onClick={handleEpubConvert}
                        fullWidth
                        disabled={isProcessing || !epubFile}
                    />

                    {/* EPUB转换的进度条 */}
                    <div className={`${styles.progressSection} ${
                        epubState.status === '转换中...' ? styles.processing :
                        epubState.status === '转换完成' ? styles.completed :
                        epubState.status === '转换失败' ? styles.error :
                        ''
                    }`}>
                        <div className={`${styles.progressText} ${
                            epubState.status === '转换中...' ? styles.processing :
                            epubState.status === '转换完成' ? styles.completed :
                            epubState.status === '转换失败' ? styles.error :
                            ''
                        }`}>{epubState.status}</div>
                        <div className={styles.progressContainer}>
                            <ProgressBar percentage={epubState.progress} />
                        </div>
                    </div>

                    {epubState.result && (
                        <div className={styles.convertResult}>
                            <div className={styles.resultInfo}>
                                <h4>转换结果</h4>
                                <p><strong>文件名:</strong> {epubState.result.name}</p>
                                <p><strong>章节数:</strong> {epubState.result.chapterCount} 章</p>
                                <p><strong>文件大小:</strong> 约 {Math.round(epubState.result.wordCount / 1024)} KB</p>
                            </div>
                            <Button
                                icon={<FaDownload />}
                                label="下载TXT文件"
                                onClick={handleDownloadTxt}
                                variant="success"
                                fullWidth
                            />
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'split' && (
                <div className={styles.subContent}>
                    {/* 数据源选择 */}
                    <div className={styles.sourceSelector}>
                        <h4>选择数据源</h4>
                        <div className={styles.sourceOptions}>
                            <div 
                                className={`${styles.sourceOption} ${splitDataSource === 'file' ? styles.active : ''}`}
                                onClick={() => setSplitDataSource('file')}
                            >
                                <FaFileUpload className={styles.icon} />
                                <div className={styles.label}>上传文件</div>
                                <div className={styles.description}>选择本地TXT文件</div>
                            </div>
                            <div 
                                className={`${styles.sourceOption} ${splitDataSource === 'cache' ? styles.active : ''} ${!hasEpubCache ? styles.disabled : ''}`}
                                onClick={() => hasEpubCache && setSplitDataSource('cache')}
                            >
                                <FaDatabase className={styles.icon} />
                                <div className={styles.label}>使用转换结果</div>
                                <div className={styles.description}>
                                    {hasEpubCache ? '使用已转换的文本' : '无可用转换结果'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {splitDataSource === 'file' && (
                        <FileInput
                            label="选择小说文件:"
                            placeholder="选择.txt小说文件..."
                            value={novelFile}
                            onBrowse={handleNovelSelect}
                            icon={<FaFolderOpen />}
                            buttonText="浏览"
                            showFileInfo={true}
                            disabled={isProcessing}
                            readOnly
                        />
                    )}

                    {splitDataSource === 'cache' && hasEpubCache && (
                        <div className={styles.cacheInfo}>
                            <div className={styles.resultInfo}>
                                <h4>将使用的转换结果</h4>
                                <p><strong>文件名:</strong> {cache.epubConversion.result.name}</p>
                                <p><strong>章节数:</strong> {cache.epubConversion.result.chapterCount} 章</p>
                                <p><strong>文件大小:</strong> 约 {Math.round(cache.epubConversion.result.wordCount / 1024)} KB</p>
                            </div>
                        </div>
                    )}

                    <Select
                        label="章节分组大小:"
                        value={chapterGroupSize}
                        onChange={(e) => setChapterGroupSize(e.target.value)}
                        options={chapterGroupOptions}
                        disabled={isProcessing}
                        size="md"
                        placeholder="选择分组大小"
                    />

                    <div className={styles.buttonRow}>
                        <Button
                            icon={<FaCut />}
                            label={isProcessing ? "拆分中..." : "执行拆分"}
                            onClick={handleChapterSplit}
                            variant="success"
                            fullWidth
                            disabled={isProcessing || (splitDataSource === 'file' && !novelFile) || (splitDataSource === 'cache' && !hasEpubCache)}
                        />
                    </div>

                    {/* 章节拆分的进度条 */}
                    <div className={`${styles.progressSection} ${
                        splitState.status === '拆分中...' ? styles.processing :
                        splitState.status === '拆分完成' ? styles.completed :
                        splitState.status === '拆分失败' ? styles.error :
                        ''
                    }`}>
                        <div className={`${styles.progressText} ${
                            splitState.status === '拆分中...' ? styles.processing :
                            splitState.status === '拆分完成' ? styles.completed :
                            splitState.status === '拆分失败' ? styles.error :
                            ''
                        }`}>{splitState.status}</div>
                        <div className={styles.progressContainer}>
                            <ProgressBar percentage={splitState.progress} />
                        </div>
                    </div>

                    {splitState.result.length > 0 && (
                        <div className={styles.splitResult}>
                            <div className={styles.resultInfo}>
                                <h4>拆分结果</h4>
                                <p>已生成 {splitState.result.length} 个文件组，总大小约 {
                                    Math.round(splitState.result.reduce((sum, file) => 
                                        sum + (file.content.length / 1024), 0)
                                    )
                                } KB</p>
                            </div>
                            <Button
                                icon={<FaDownload />}
                                label="下载所有文件"
                                onClick={handleDownloadAll}
                                variant="success"
                                fullWidth
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PreprocessPanel; 
