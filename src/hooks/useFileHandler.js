import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useNotification } from '../contexts/NotificationContext';
import { useEpubParser } from './useEpubParser';
import JSZip from 'jszip';
import { extractChapterNumberFromTitle, uniqueNumbersInOrder } from '../utils/chapterNumber';

/**
 * 自定义Hook，用于处理文件选择、读取、解析和下载等操作。
 * 封装了浏览器端文件操作的复杂性。
 */
export const useFileHandler = () => {
    const { addNotification } = useNotification();
    const [isProcessing, setIsProcessing] = useState(false);

    // 集成EPUB解析器
    const { 
        parseEpubFile: parseEpubForAnalysis, // 用于解析成章节数组
        convertEpubToTxt: convertEpubToTxtContent, // 用于转换成单个TXT文件内容
        getEpubMetadata 
    } = useEpubParser();

    // 创建文件输入元素
    const createFileInput = useCallback((accept, multiple = false, directory = false) => {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.multiple = multiple;

            // 如果是文件夹选择
            if (directory) {
                input.webkitdirectory = true;
                input.directory = true;
            }

            input.onchange = (event) => {
                const files = Array.from(event.target.files);
                if (files.length > 0) {
                    resolve(multiple || directory ? files : files[0]);
                } else {
                    reject(new Error('用户取消选择'));
                }
            };

            input.onclick = () => {
                // 每次点击时重置value，确保可以选择相同文件
                input.value = null;
            };

            input.onerror = (error) => {
                reject(new Error('文件选择错误: ' + error.message));
            };

            input.click();
        });
    }, []);

    // 选择单个文件
    const selectFile = useCallback(async (accept = '*') => {
        try {
            setIsProcessing(true);
            const file = await createFileInput(accept);
            return file;
        } catch (error) {
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [createFileInput]);

    // 选择多个文件
    const selectFiles = useCallback(async (accept = '*') => {
        try {
            setIsProcessing(true);
            const files = await createFileInput(accept, true);
            return files;
        } catch (error) {
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [createFileInput]);

    // 选择文件夹
    const selectFolder = useCallback(async () => {
        try {
            setIsProcessing(true);
            const files = await createFileInput('*', true, true);
            return files;
        } catch (error) {
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [createFileInput]);

    // 读取文本文件内容
    const readTextFile = useCallback(async (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                return reject(new Error('未选择文件'));
            }
            if (!file.type.startsWith('text/') && !file.name.endsWith('.txt')) {
                return reject(new Error('请选择文本文件'));
            }
            if (file.size > 50 * 1024 * 1024) { // 50MB
                return reject(new Error('文件过大，请选择小于50MB的文本文件'));
            }

            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('读取文件失败: ' + e.target.error));
            reader.readAsText(file);
        });
    }, []);

    // EPUB转TXT功能（返回单个TXT文件内容）
    const parseEpubFile = useCallback(async (file) => {
        try {
            setIsProcessing(true);
            
            // 验证文件类型
            if (!file.name.toLowerCase().endsWith('.epub')) {
                throw new Error('请选择有效的EPUB文件');
            }
            
            // 检查文件大小
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (file.size > maxSize) {
                throw new Error('文件过大，请选择小于50MB的EPUB文件');
            }
            
            // 使用专业的EPUB解析器转换为TXT
            const result = await convertEpubToTxtContent(file);
            
            if (!result || !result.content) {
                throw new Error('转换失败，未能生成有效的TXT内容');
            }
            
            // 返回单个TXT文件的信息
            const txtFile = {
                id: '1',
                name: result.fileName,
                content: result.content,
                originalName: file.name,
                chapterCount: result.chapterCount,
                wordCount: result.wordCount
            };
            
            addNotification(`EPUB转TXT完成！生成文件: ${result.fileName}`, 'success');
            
            return [txtFile]; // 返回数组格式以保持接口一致性
            
        } catch (error) {
            const errorMessage = `EPUB转TXT失败: ${error.message}`;
            addNotification(errorMessage, 'error');
            throw new Error(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    }, [addNotification, convertEpubToTxtContent]);

    // 解析EPUB用于分析（返回章节数组）
    const parseEpubForAnalysisFunction = useCallback(async (file) => {
        try {
            setIsProcessing(true);
            
            // 验证文件类型
            if (!file.name.toLowerCase().endsWith('.epub')) {
                throw new Error('请选择有效的EPUB文件');
            }
            
            // 检查文件大小
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (file.size > maxSize) {
                throw new Error('文件过大，请选择小于50MB的EPUB文件');
            }
            
            // 使用专业的EPUB解析器
            const chapters = await parseEpubForAnalysis(file);
            
            if (!chapters || chapters.length === 0) {
                throw new Error('未能从EPUB文件中提取到有效章节');
            }
            
            addNotification(`EPUB文件解析完成，共 ${chapters.length} 个章节`, 'success');
            
            // 格式化章节数据以供后续处理
            const formattedChapters = chapters.map((chapter, index) => ({
                id: uuidv4(),
                name: chapter.title || `第 ${index + 1} 章`,
                content: chapter.content,
                originalName: file.name,
                wordCount: chapter.content.length
            }));
            
            return formattedChapters;
            
        } catch (error) {
            const errorMessage = `EPUB解析失败: ${error.message}`;
            addNotification(errorMessage, 'error');
            throw new Error(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    }, [addNotification, parseEpubForAnalysis]);

    // 按“章节标题行”进行精准拆分，并按组大小聚合
    const splitTextToChapters = useCallback(async (text, groupSize = 5) => {
        try {
            setIsProcessing(true);
            if (!text || text.trim().length === 0) {
                throw new Error('文本内容为空，无法拆分');
            }

            // 参考 Python analyzer.detect_chapters：
            // 1) 只把出现在“行首”的章节标题识别为有效标题；
            // 2) 标题行允许带后缀文字（直到换行）；
            // 3) 使用捕获组进行 split，得到 [前言, 标题1, 内容1, 标题2, 内容2, ...]
            const headingPattern = /(^\s*(?:第\s*[0-9一二三四五六七八九十百千零]+\s*[章回节卷篇]|(?:Chapter|CHAPTER)\s*\d+|序章|楔子|尾声|后记|番外)[^\n]*\n)/gm;
            const parts = text.split(headingPattern);

            const chapters = [];
            if (parts.length > 1) {
                for (let i = 1; i < parts.length; i += 2) {
                    const rawTitleLine = parts[i] || '';
                    const nextContent = (i + 1 < parts.length ? parts[i + 1] : '').trim();

                    // 标题行去掉换行与首尾空白
                    const title = rawTitleLine.replace(/\n/g, '').trim();
                    const chapterNo = extractChapterNumberFromTitle(title);

                    // 仅过滤空内容，短章节也保留，避免章节号断档
                    if (nextContent) {
                        chapters.push({ title, content: nextContent, chapterNo });
                    }
                }
            }

            // 如果没有识别到可靠的章节，回退到“按段落数分组”策略
            if (chapters.length === 0) {
                const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
                const groups = [];
                for (let i = 0; i < paragraphs.length; i += groupSize) {
                    const groupParagraphs = paragraphs.slice(i, i + groupSize);
                    const groupContent = groupParagraphs.join('\n\n');
                    groups.push({
                        name: `段落组${Math.floor(i / groupSize) + 1}(${i + 1}-${Math.min(i + groupSize, paragraphs.length)}).txt`,
                        content: groupContent.trim()
                    });
                }
                addNotification(`拆分完成，生成 ${groups.length} 个文件组`, 'success');
                return groups;
            }

            // 将“章节”按 groupSize 聚合为文件组
            const groups = [];
            for (let i = 0; i < chapters.length; i += groupSize) {
                const groupChapters = chapters.slice(i, i + groupSize);
                const groupContent = groupChapters.map(ch => `${ch.title}\n\n${ch.content}`).join('\n\n');
                const chapterNumbers = uniqueNumbersInOrder(
                    groupChapters.map((ch) => ch.chapterNo).filter((n) => Number.isInteger(n) && n > 0)
                );
                const startChapter = chapterNumbers.length > 0 ? chapterNumbers[0] : i + 1;
                const endChapter = chapterNumbers.length > 0
                    ? chapterNumbers[chapterNumbers.length - 1]
                    : Math.min(i + groupSize, chapters.length);
                const groupName = `第${startChapter}-${endChapter}章.txt`;
                groups.push({
                    name: groupName,
                    content: groupContent.trim(),
                    chapterNumbers,
                    chapterStart: startChapter,
                    chapterEnd: endChapter
                });
            }

            addNotification(`拆分完成，生成 ${groups.length} 个文件组`, 'success');
            return groups;
        } catch (error) {
            const errorMessage = `文本拆分失败: ${error.message}`;
            addNotification(errorMessage, 'error');
            throw new Error(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    }, [addNotification]);

    // 下载单个文件
    const downloadFile = useCallback((content, filename, type = 'text/plain') => {
        try {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            addNotification(`文件 ${filename} 下载成功`, 'success');
        } catch (error) {
            addNotification('文件下载失败: ' + error.message, 'error');
        }
    }, [addNotification]);

    // ZIP打包下载多个文件
    const downloadAsZip = useCallback(async (files, zipFileName = null) => {
        try {
            setIsProcessing(true);
            
            const zip = new JSZip();
            
            // 添加文件到ZIP
            files.forEach((file, index) => {
                const fileName = file.name || `文件${index + 1}.txt`;
                zip.file(fileName, file.content);
            });
            
            // 生成ZIP文件
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            // 生成文件名
            const defaultZipName = `章节文件组_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`;
            const finalZipName = zipFileName || defaultZipName;
            
            // 下载ZIP文件
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = finalZipName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            addNotification(`ZIP文件下载成功: ${finalZipName}`, 'success');
            
        } catch (error) {
            addNotification('ZIP打包下载失败: ' + error.message, 'error');
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [addNotification]);

    // 批量下载文件（保留兼容性，现在使用ZIP）
    const downloadMultipleFiles = useCallback(async (files) => {
        return downloadAsZip(files);
    }, [downloadAsZip]);

    return {
        isProcessing,
        selectFile,
        selectFiles,
        selectFolder,
        readTextFile,
        parseEpubFile, // EPUB转TXT（单个文件）
        parseEpubForAnalysisFunction, // EPUB解析用于分析（章节数组）
        splitTextToChapters,
        downloadFile,
        downloadAsZip,
        downloadMultipleFiles
    };
}; 
