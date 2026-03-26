import React, { useMemo, useCallback } from 'react';
import styles from './ContentPanel.module.css';
import { useOptimizedNotifications } from '../../hooks/useOptimizedNotifications';
import { useAppContext } from '../../contexts/AppContext';
import { FaCopy, FaDownload, FaTable, FaSpinner } from 'react-icons/fa';

const ContentPanel = () => {
    const { notifySuccess, notifyError } = useOptimizedNotifications();
    const { analysisResults, analysisProgress } = useAppContext();

    // 简化的表格解析函数
    const parseMarkdownTable = useCallback((content) => {
        if (!content) return { headers: [], rows: [] };
        
        const lines = content.split('\n').filter(line => line.trim());
        const tableLines = [];
        let inTable = false;
        
        for (const line of lines) {
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                tableLines.push(line.trim());
                inTable = true;
            } else if (inTable && !line.trim().startsWith('|')) {
                break;
            }
        }
        
        if (tableLines.length < 2) return { headers: [], rows: [] };
        
        const headerLine = tableLines[0];
        const headers = headerLine.split('|')
            .slice(1, -1)
            .map(h => h.trim());
        
        const dataLines = tableLines.slice(2);
        const rows = dataLines.map(line => {
            const cells = line.split('|')
                .slice(1, -1)
                .map(cell => cell.trim());
            return cells;
        });
        
        return { headers, rows };
    }, []);

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
        
        // 只处理已完成且无错误的文件
        const completedEntries = Object.entries(analysisResults)
            .filter(([, data]) => data.isComplete && !data.hasError && data.content)
            .sort(([, a], [, b]) => (a.timestamp || 0) - (b.timestamp || 0)); // 按时间正序排列
        
        for (const [fileName, data] of completedEntries) {
            const { headers, rows } = parseMarkdownTable(data.content);
            
            if (headers.length > 0) {
                if (allHeaders.length === 0) {
                    allHeaders = headers;
                }
                allRows.push(...rows);
            }
        }
        
        return { headers: allHeaders, rows: allRows };
    }, [analysisResults, parseMarkdownTable]);

    // 获取表格数据用于复制和导出
    const getTableContent = useCallback(() => {
        const { headers, rows } = combinedTableData;
        
        if (headers.length === 0 || rows.length === 0) {
            return '';
        }
        
        // 生成Markdown表格格式
        const headerRow = '| ' + headers.join(' | ') + ' |';
        const separatorRow = '| ' + headers.map(() => '---').join(' | ') + ' |';
        const dataRows = rows.map(row => '| ' + row.join(' | ') + ' |');
        
        return [headerRow, separatorRow, ...dataRows].join('\n');
    }, [combinedTableData]);

    const handleCopy = async () => {
        const content = getTableContent();
        if (!content) {
            notifyError('复制', '没有可复制的表格数据');
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
                    <button 
                        className={styles.actionButton}
                        onClick={handleCopy}
                        disabled={combinedTableData.headers.length === 0}
                        title="复制表格数据"
                    >
                        <FaCopy />
                        复制
                    </button>
                    <button 
                        className={styles.actionButton}
                        onClick={handleExport}
                        disabled={combinedTableData.headers.length === 0}
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
                
                {/* 表格内容 */}
                {renderTable()}
            </div>
        </section>
    );
};

export default ContentPanel; 