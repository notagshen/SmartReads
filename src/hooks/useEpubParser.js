import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { useNotification } from '../contexts/NotificationContext';

/**
 * 专门的EPUB解析Hook
 * 使用JSZip库实现真正的EPUB文件解析
 */
export const useEpubParser = () => {
    const { addNotification } = useNotification();
    const [isProcessing, setIsProcessing] = useState(false);

    // 从HTML内容中提取纯文本
    const extractTextFromHTML = useCallback((htmlContent) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // 移除script、style、nav等不需要的标签
        const unwantedElements = tempDiv.querySelectorAll('script, style, nav, header, footer, aside');
        unwantedElements.forEach(el => el.remove());
        
        // 获取纯文本内容
        let text = tempDiv.textContent || tempDiv.innerText || '';
        
        // 清理文本（参考Python项目的BeautifulSoup处理逻辑）
        const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        // 处理多个空格并合并短行（参考Python项目逻辑）
        const chunks = [];
        lines.forEach(line => {
            const cleanLine = line.replace(/\s+/g, ' ').trim();
            if (cleanLine && cleanLine.length > 3) { // 过滤过短的行
                chunks.push(cleanLine);
            }
        });
        
        return chunks.join('\n').replace(/\n+/g, '\n\n'); // 统一段落间距
    }, []);

    // 解析container.xml文件找到OPF文件路径
    const parseContainer = useCallback(async (zip) => {
        try {
            const containerFile = zip.file('META-INF/container.xml');
            if (!containerFile) {
                throw new Error('未找到container.xml文件');
            }
            
            const containerXml = await containerFile.async('text');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(containerXml, 'text/xml');
            
            const rootfileElement = xmlDoc.querySelector('rootfile');
            if (!rootfileElement) {
                throw new Error('container.xml格式错误');
            }
            
            return rootfileElement.getAttribute('full-path');
        } catch (error) {
            throw new Error(`解析container.xml失败: ${error.message}`);
        }
    }, []);

    // 解析OPF文件获取章节信息
    const parseOPF = useCallback(async (zip, opfPath) => {
        try {
            const opfFile = zip.file(opfPath);
            if (!opfFile) {
                throw new Error(`未找到OPF文件: ${opfPath}`);
            }
            
            const opfXml = await opfFile.async('text');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(opfXml, 'text/xml');
            
            // 获取manifest中的所有项目
            const manifestItems = {};
            const manifestElements = xmlDoc.querySelectorAll('manifest item');
            manifestElements.forEach(item => {
                manifestItems[item.getAttribute('id')] = {
                    href: item.getAttribute('href'),
                    mediaType: item.getAttribute('media-type')
                };
            });
            
            // 获取spine中的阅读顺序
            const spineItems = [];
            const spineElements = xmlDoc.querySelectorAll('spine itemref');
            spineElements.forEach(itemref => {
                const idref = itemref.getAttribute('idref');
                if (manifestItems[idref] && manifestItems[idref].mediaType === 'application/xhtml+xml') {
                    spineItems.push({
                        id: idref,
                        href: manifestItems[idref].href
                    });
                }
            });
            
            return {
                basePath: opfPath.substring(0, opfPath.lastIndexOf('/') + 1),
                spineItems
            };
        } catch (error) {
            throw new Error(`解析OPF文件失败: ${error.message}`);
        }
    }, []);

    // 解析单个章节文件
    const parseChapter = useCallback(async (zip, chapterPath, index) => {
        try {
            const chapterFile = zip.file(chapterPath);
            if (!chapterFile) {
                console.warn(`章节文件不存在: ${chapterPath}`);
                return null;
            }
            
            const htmlContent = await chapterFile.async('text');
            
            // 解析HTML获取标题
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            
            // 尝试多种方式获取章节标题
            let title = '';
            const titleSelectors = ['h1', 'h2', 'h3', 'title', '.chapter-title', '.title'];
            for (const selector of titleSelectors) {
                const element = tempDiv.querySelector(selector);
                if (element && element.textContent.trim()) {
                    title = element.textContent.trim();
                    break;
                }
            }
            
            // 如果没有找到标题，使用默认标题
            if (!title) {
                title = `第${index + 1}章`;
            }
            
            // 提取正文内容
            const content = extractTextFromHTML(htmlContent);
            
            // 过滤过短的内容
            if (content.length < 50) {
                console.warn(`章节内容过短，跳过: ${chapterPath}`);
                return null;
            }
            
            return {
                id: String(index + 1),
                title: title,
                content: content,
                originalPath: chapterPath
            };
        } catch (error) {
            console.error(`解析章节失败 ${chapterPath}:`, error);
            return null;
        }
    }, [extractTextFromHTML]);

    // 解析EPUB并返回章节数组（用于分析功能）
    const parseEpubFile = useCallback(async (file) => {
        try {
            setIsProcessing(true);
            addNotification('正在解析EPUB文件结构...', 'info');
            
            // 读取EPUB文件
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // 验证EPUB格式
            const mimetypeFile = zip.file('mimetype');
            if (mimetypeFile) {
                const mimetype = await mimetypeFile.async('text');
                if (mimetype.trim() !== 'application/epub+zip') {
                    addNotification('警告：文件可能不是标准EPUB格式', 'warning');
                }
            }
            
            addNotification('正在解析目录结构...', 'info');
            
            // 解析container.xml获取OPF文件路径
            const opfPath = await parseContainer(zip);
            addNotification(`找到内容文件: ${opfPath}`, 'info');
            
            // 解析OPF文件获取章节列表
            const { basePath, spineItems } = await parseOPF(zip, opfPath);
            addNotification(`发现${spineItems.length}个章节文件`, 'info');
            
            if (spineItems.length === 0) {
                throw new Error('未找到有效的章节内容');
            }
            
            // 解析每个章节
            const chapters = [];
            const totalChapters = spineItems.length;
            
            for (let i = 0; i < spineItems.length; i++) {
                const spineItem = spineItems[i];
                const chapterPath = basePath + spineItem.href;
                
                addNotification(`正在处理章节 ${i + 1}/${totalChapters}...`, 'info');
                
                const chapter = await parseChapter(zip, chapterPath, i);
                if (chapter) {
                    chapters.push(chapter);
                }
                
                // 添加小延迟避免阻塞UI
                if (i % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
            
            if (chapters.length === 0) {
                throw new Error('未能提取到有效的章节内容');
            }
            
            // 清理和优化章节内容
            const cleanedChapters = chapters.map(chapter => {
                // 移除过短的段落
                const paragraphs = chapter.content.split('\n\n')
                    .filter(p => p.trim().length > 10);
                
                return {
                    ...chapter,
                    content: paragraphs.join('\n\n')
                };
            }).filter(chapter => chapter.content.length > 100);
            
            addNotification(`EPUB解析完成！成功提取${cleanedChapters.length}个章节`, 'success');
            
            return cleanedChapters;
            
        } catch (error) {
            const errorMessage = `EPUB文件解析失败: ${error.message}`;
            addNotification(errorMessage, 'error');
            throw new Error(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    }, [addNotification, parseContainer, parseOPF, parseChapter]);

    // 新增：EPUB转TXT功能（将所有章节合并为一个TXT文件内容）
    const convertEpubToTxt = useCallback(async (file) => {
        try {
            setIsProcessing(true);
            addNotification('正在转换EPUB为TXT格式...', 'info');
            
            // 首先解析EPUB获取所有章节
            const chapters = await parseEpubFile(file);
            
            if (!chapters || chapters.length === 0) {
                throw new Error('未能从EPUB文件中提取到有效内容');
            }
            
            addNotification('正在合并章节内容...', 'info');
            
            // 合并所有章节为一个完整的TXT内容（参考Python项目逻辑）
            const txtContent = chapters.map(chapter => {
                // 每个章节的格式：标题 + 空行 + 内容 + 空行
                return `${chapter.title}\n\n${chapter.content}`;
            }).join('\n\n'); // 章节间用两个空行分隔
            
            // 生成文件名
            const fileName = file.name.replace(/\.epub$/i, '.txt');
            
            const result = {
                content: txtContent,
                fileName: fileName,
                chapterCount: chapters.length,
                wordCount: txtContent.length
            };
            
            addNotification(`转换完成！生成TXT文件包含${chapters.length}个章节，约${Math.round(txtContent.length/1000)}千字`, 'success');
            
            return result;
            
        } catch (error) {
            const errorMessage = `EPUB转TXT失败: ${error.message}`;
            addNotification(errorMessage, 'error');
            throw new Error(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    }, [addNotification, parseEpubFile]);

    // 获取EPUB元数据
    const getEpubMetadata = useCallback(async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // 解析OPF文件获取元数据
            const opfPath = await parseContainer(zip);
            const opfFile = zip.file(opfPath);
            const opfXml = await opfFile.async('text');
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(opfXml, 'text/xml');
            
            // 提取元数据
            const metadata = {};
            const metadataElements = xmlDoc.querySelectorAll('metadata > *');
            
            metadataElements.forEach(element => {
                const tagName = element.tagName.toLowerCase();
                const content = element.textContent.trim();
                
                switch (tagName) {
                    case 'dc:title':
                        metadata.title = content;
                        break;
                    case 'dc:creator':
                        metadata.author = content;
                        break;
                    case 'dc:publisher':
                        metadata.publisher = content;
                        break;
                    case 'dc:language':
                        metadata.language = content;
                        break;
                    case 'dc:date':
                        metadata.date = content;
                        break;
                    case 'dc:description':
                        metadata.description = content;
                        break;
                }
            });
            
            return metadata;
        } catch (error) {
            console.warn('获取EPUB元数据失败:', error);
            return {};
        }
    }, [parseContainer]);

    return {
        isProcessing,
        parseEpubFile,
        convertEpubToTxt,
        getEpubMetadata,
        extractTextFromHTML
    };
}; 