import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import styles from './ContentPanel.module.css';
import { useOptimizedNotifications } from '../../hooks/useOptimizedNotifications';
import { useAppContext } from '../../contexts/AppContext';
import { FaCopy, FaDownload, FaTable, FaSpinner, FaUpload, FaShareAlt } from 'react-icons/fa';
import { parseMarkdownTable, validateChapterContinuity, buildMarkdownTable, extractChapterNumbersFromRows } from '../../utils/chapterTable';
import { extractChapterNumbersFromFileName, uniqueNumbersInOrder } from '../../utils/chapterNumber';
import { buildShareLink, parseShareLink } from '../../utils/shareLink';

const ContentPanel = () => {
    const { notifySuccess, notifyError } = useOptimizedNotifications();
    const { analysisResults, analysisProgress, clearAnalysisResults, updateAnalysisResult } = useAppContext();
    const importInputRef = useRef(null);
    const shareImportedRef = useRef(false);

    // JSON数组解析函数
    const parseJSONArray = useCallback((str) => {
        if (!str) return [];
        
        try {
            const cleaned = str.replace(/`/g, '').trim();
            if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
                return JSON.parse(cleaned);
            }
        } catch (e) {
            const cleaned = str.replace(/[\[\]"`]/g, '').trim();
            return cleaned.split(',').map(item => item.trim()).filter(item => item);
        }
        return [str];
    }, []);

    // 合并所有已完成的分析结果为统一表格
    const combinedTableData = useMemo(() => {
        let allHeaders = [];
        let allRows = [];
        let expectedChapterNumbers = [];
        
        // 只处理已完成且无错误的文件
        const completedEntries = Object.entries(analysisResults)
            .filter(([, data]) => data.isComplete && !data.hasError && data.content)
            .sort(([fileA, a], [fileB, b]) => {
                const aNums = Array.isArray(a?.meta?.expectedChapterNumbers) && a.meta.expectedChapterNumbers.length > 0
                    ? a.meta.expectedChapterNumbers
                    : extractChapterNumbersFromFileName(fileA);
                const bNums = Array.isArray(b?.meta?.expectedChapterNumbers) && b.meta.expectedChapterNumbers.length > 0
                    ? b.meta.expectedChapterNumbers
                    : extractChapterNumbersFromFileName(fileB);

                if (aNums.length > 0 && bNums.length > 0) {
                    return aNums[0] - bNums[0];
                }

                return (a.timestamp || 0) - (b.timestamp || 0);
            });
        
        for (const [fileName, data] of completedEntries) {
            const { headers, rows } = parseMarkdownTable(data.content);
            
            if (headers.length > 0) {
                if (allHeaders.length === 0) {
                    allHeaders = headers;
                }
                allRows.push(...rows);
                const nums = Array.isArray(data?.meta?.expectedChapterNumbers) && data.meta.expectedChapterNumbers.length > 0
                    ? data.meta.expectedChapterNumbers
                    : extractChapterNumbersFromFileName(fileName);
                expectedChapterNumbers.push(...nums);
            }
        }

        expectedChapterNumbers = uniqueNumbersInOrder(expectedChapterNumbers);
        const continuity = validateChapterContinuity(allRows, expectedChapterNumbers);

        return {
            headers: allHeaders,
            rows: allRows,
            continuity,
            expectedChapterNumbers
        };
    }, [analysisResults]);

    // 获取表格数据用于复制和导出
    const getTableContent = useCallback(() => {
        const { headers, rows } = combinedTableData;
        
        if (headers.length === 0 || rows.length === 0) {
            return '';
        }
        
        // 生成Markdown表格格式
        return buildMarkdownTable(headers, rows);
    }, [combinedTableData]);

    const handleCopy = async () => {
        const content = getTableContent();
        if (!content) {
            notifyError('复制', '没有可复制的表格数据');
            return;
        }
        if (!combinedTableData.continuity?.isValid) {
            notifyError('复制', '章节存在缺失/重复/错位，请先重新分析不连续分段');
            return;
        }

        try {
            await navigator.clipboard.writeText(content);
            notifySuccess('复制', '表格数据已复制到剪贴板');
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = content;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            notifySuccess('复制', '表格数据已复制到剪贴板');
        }
    };

    const handleExport = () => {
        const content = getTableContent();
        if (!content) {
            notifyError('导出', '没有可导出的表格数据');
            return;
        }
        if (!combinedTableData.continuity?.isValid) {
            notifyError('导出', '章节存在缺失/重复/错位，请先重新分析不连续分段');
            return;
        }

        try {
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `分析结果_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            notifySuccess('导出', '表格数据已保存为Markdown文件');
        } catch (error) {
            notifyError('导出', '导出失败: ' + error.message);
        }
    };

    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleImportFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const { headers, rows } = parseMarkdownTable(text);
            if (headers.length === 0 || rows.length === 0) {
                throw new Error('文件中未检测到有效的 Markdown 表格');
            }

            const importedNumbers = uniqueNumbersInOrder(extractChapterNumbersFromRows(rows));
            clearAnalysisResults();
            updateAnalysisResult(
                file.name || `导入结果_${Date.now()}.md`,
                text,
                true,
                false,
                { expectedChapterNumbers: importedNumbers, imported: true }
            );

            notifySuccess('导入', `已导入 ${file.name}（${rows.length} 行）`);
        } catch (error) {
            notifyError('导入', `导入失败: ${error.message}`);
        } finally {
            event.target.value = '';
        }
    };

    const handleShare = async () => {
        const content = getTableContent();
        if (!content) {
            notifyError('分享', '没有可分享的表格数据');
            return;
        }
        if (!combinedTableData.continuity?.isValid) {
            notifyError('分享', '章节存在缺失/重复/错位，请先修复后再分享');
            return;
        }

        let shareUrl = '';
        try {
            shareUrl = buildShareLink(content, window.location.href);
        } catch (error) {
            notifyError('分享', error.message);
            return;
        }

        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'SmartReads 分析结果',
                    text: '打开这个链接查看我的分析结果',
                    url: shareUrl
                });
                notifySuccess('分享', '已调用系统分享');
                return;
            }
            await navigator.clipboard.writeText(shareUrl);
            notifySuccess('分享', '分享链接已复制到剪贴板');
        } catch (error) {
            if (error?.name !== 'AbortError') {
                notifyError('分享', `分享失败: ${error.message || '未知错误'}`);
            }
        }
    };

    useEffect(() => {
        if (shareImportedRef.current) return;

        let markdown = null;
        try {
            markdown = parseShareLink(window.location.hash);
        } catch (error) {
            notifyError('分享链接', error.message);
            shareImportedRef.current = true;
            return;
        }

        if (!markdown) return;

        try {
            const { headers, rows } = parseMarkdownTable(markdown);
            if (headers.length === 0 || rows.length === 0) {
                throw new Error('分享链接内容不包含有效表格');
            }

            const importedNumbers = uniqueNumbersInOrder(extractChapterNumbersFromRows(rows));
            clearAnalysisResults();
            updateAnalysisResult(
                '分享链接导入.md',
                markdown,
                true,
                false,
                { expectedChapterNumbers: importedNumbers, importedFromShareLink: true }
            );

            shareImportedRef.current = true;
            notifySuccess('分享链接', '已从链接加载分析结果');
        } catch (error) {
            notifyError('分享链接', `加载失败: ${error.message}`);
            shareImportedRef.current = true;
        }
    }, [clearAnalysisResults, notifyError, notifySuccess, updateAnalysisResult]);

    // 获取简化的进度信息
    const getSimpleProgressInfo = useCallback(() => {
        if (!analysisProgress.isAnalyzing && Object.keys(analysisResults).length === 0) {
            return null;
        }
        
        const totalFiles = Object.keys(analysisResults).length;
        const completedFiles = Object.values(analysisResults).filter(r => r.isComplete).length;
        
        if (analysisProgress.isAnalyzing) {
            // 从文件名中提取章节范围信息
            const currentFile = analysisProgress.currentFile;
            if (currentFile) {
                // 尝试从文件名中提取章节信息，如 "第1-50章.txt"
                const chapterMatch = currentFile.match(/第?(\d+)-?(\d+)?章?/);
                if (chapterMatch) {
                    const start = chapterMatch[1];
                    const end = chapterMatch[2] || start;
                    return `正在分析第${start}-${end}章`;
                }
                // 如果没有匹配到章节信息，显示文件名
                return `正在分析: ${currentFile}`;
            }
            return '正在准备分析...';
        }
        
        if (completedFiles > 0) {
            return `已完成 ${completedFiles}/${totalFiles} 个文件的分析`;
        }
        
        return null;
    }, [analysisProgress, analysisResults]);

    // 渲染表格
    const renderTable = () => {
        const { headers, rows } = combinedTableData;
        
        if (headers.length === 0 || rows.length === 0) {
            return (
                <div className={styles.emptyTable}>
                    <div className={styles.emptyIcon}>
                        <FaTable />
                    </div>
                    <p>分析结果将在这里显示</p>
                    <p className={styles.textMuted}>请先选择文件并开始分析</p>
                </div>
            );
        }

        return (
            <div className={styles.tableContainer}>
                <table className={styles.analysisTable}>
                    <thead>
                        <tr>
                            {headers.map((header, index) => (
                                <th key={index}>{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {row.map((cell, cellIndex) => (
                                    <td key={cellIndex}>
                                        {/* 处理JSON数组格式的单元格 */}
                                        {cell.includes('[') && cell.includes(']') ? (
                                            <div className={styles.jsonArrayCell}>
                                                {parseJSONArray(cell).map((item, itemIndex) => (
                                                    <span key={itemIndex} className={styles.arrayItem}>
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            cell
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <section className={styles.contentPanel}>
            <div className={styles.panelHeader}>
                <h2>
                    <FaTable />
                    分析结果
                </h2>
                <div className={styles.panelActions}>
                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".md,.markdown,.txt,text/markdown,text/plain"
                        onChange={handleImportFile}
                        className={styles.hiddenInput}
                    />
                    <button
                        className={styles.actionButton}
                        onClick={handleImportClick}
                        title="导入Markdown表格"
                    >
                        <FaUpload />
                        导入
                    </button>
                    <button 
                        className={styles.actionButton}
                        onClick={handleCopy}
                        disabled={combinedTableData.headers.length === 0 || !combinedTableData.continuity?.isValid}
                        title="复制表格数据"
                    >
                        <FaCopy />
                        复制
                    </button>
                    <button
                        className={styles.actionButton}
                        onClick={handleShare}
                        disabled={combinedTableData.headers.length === 0 || !combinedTableData.continuity?.isValid}
                        title="分享表格数据"
                    >
                        <FaShareAlt />
                        分享
                    </button>
                    <button 
                        className={styles.actionButton}
                        onClick={handleExport}
                        disabled={combinedTableData.headers.length === 0 || !combinedTableData.continuity?.isValid}
                        title="导出表格数据"
                    >
                        <FaDownload />
                        导出
                    </button>
                </div>
            </div>
            
            <div className={styles.resultContent}>
                {/* 简化的进度信息 */}
                {(() => {
                    const progressText = getSimpleProgressInfo();
                    return progressText && (
                        <div className={styles.simpleProgress}>
                            {analysisProgress.isAnalyzing && (
                                <FaSpinner className={styles.spinningIcon} />
                            )}
                            <span>{progressText}</span>
                        </div>
                    );
                })()}

                {!analysisProgress.isAnalyzing && combinedTableData.rows.length > 0 && !combinedTableData.continuity?.isValid && (
                    <div className={styles.simpleProgress}>
                        <span>
                            章节连续性校验未通过：
                            {combinedTableData.continuity?.missing?.length > 0 ? ` 缺失 ${combinedTableData.continuity.missing.join(', ')}` : ''}
                            {combinedTableData.continuity?.duplicates?.length > 0 ? ` 重复 ${combinedTableData.continuity.duplicates.join(', ')}` : ''}
                            {combinedTableData.continuity?.unexpected?.length > 0 ? ` 越界 ${combinedTableData.continuity.unexpected.join(', ')}` : ''}
                            {combinedTableData.continuity?.orderMismatch ? ' 顺序错位' : ''}
                        </span>
                    </div>
                )}
                
                {/* 表格内容 */}
                {renderTable()}
            </div>
        </section>
    );
};

export default ContentPanel; 
