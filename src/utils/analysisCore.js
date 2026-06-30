import { createChapterHeadingPattern, resolveExpectedChapterNumbers } from './chapterNumber.js';
import {
    parseMarkdownTable,
    buildMarkdownTable,
    applyExpectedChapterNumbers,
    validateChapterContinuity
} from './chapterTable.js';
import {
    shouldApplyBalancedTruncation,
    getBalancedTruncationTargetLength,
    getBalancedTruncationThreshold
} from './truncationPolicy.js';

export const buildChapterBalancedExcerpt = (content, targetLength) => {
    const headingPattern = createChapterHeadingPattern();
    const parts = String(content).split(headingPattern);

    if (parts.length <= 1) {
        return String(content).slice(0, targetLength);
    }

    const chapterBlocks = [];
    for (let i = 1; i < parts.length; i += 2) {
        const title = parts[i] || '';
        const body = i + 1 < parts.length ? parts[i + 1] : '';
        chapterBlocks.push(`${title}${body}`);
    }

    if (chapterBlocks.length === 0) {
        return String(content).slice(0, targetLength);
    }

    const minPerChapter = 500;
    const chapterBudget = Math.max(minPerChapter, Math.floor(targetLength / chapterBlocks.length));
    const clipped = chapterBlocks.map((block) => {
        if (block.length <= chapterBudget) return block;
        return `${block.slice(0, chapterBudget)}\n...(本章内容已截断)...\n`;
    }).join('\n\n');

    return clipped.slice(0, targetLength);
};

export const normalizeAndValidateAnalysisResult = (rawResult, expectedNumbers = []) => {
    const { headers, rows } = parseMarkdownTable(rawResult);
    if (headers.length === 0 || rows.length === 0) {
        throw new Error('响应中未解析到有效Markdown表格');
    }

    const normalizedRows = applyExpectedChapterNumbers(rows, expectedNumbers);
    if (expectedNumbers.length > 0 && !normalizedRows) {
        throw new Error(`输出行数与预期章节数不一致（预期 ${expectedNumbers.length} 行，实际 ${rows.length} 行）`);
    }

    const finalRows = normalizedRows || rows;
    const continuity = validateChapterContinuity(finalRows, expectedNumbers);
    if (!continuity.isValid) {
        throw new Error(
            [
                continuity.missing.length > 0 ? `缺失章节: ${continuity.missing.join(',')}` : '',
                continuity.duplicates.length > 0 ? `重复章节: ${continuity.duplicates.join(',')}` : '',
                continuity.unexpected.length > 0 ? `越界章节: ${continuity.unexpected.join(',')}` : '',
                continuity.orderMismatch ? '章节顺序不一致' : ''
            ].filter(Boolean).join('；') || '章节连续性校验失败'
        );
    }

    const rebuilt = buildMarkdownTable(headers, finalRows);
    if (!rebuilt) {
        throw new Error('表格重建失败');
    }
    return rebuilt;
};

export const prepareAnalysisInput = (file, settings = {}) => {
    const fileName = file?.name || '未命名文件';
    const content = file?.content || '';

    if (!content || content.trim().length === 0) {
        throw new Error('文件内容为空，无法进行分析');
    }
    if (content.length < 100) {
        throw new Error('文件内容过短，建议至少100字符以上');
    }

    const expectedNumbers = resolveExpectedChapterNumbers({
        fileName,
        content,
        chapterNumbers: file?.chapterNumbers
    });

    let analysisContent = content;
    const notices = [];
    if (shouldApplyBalancedTruncation(content.length, settings.maxTokens, settings.truncationThresholdChars)) {
        const threshold = getBalancedTruncationThreshold(settings.maxTokens, settings.truncationThresholdChars);
        const targetLength = getBalancedTruncationTargetLength(content.length, settings.maxTokens, settings.truncationThresholdChars);
        analysisContent = buildChapterBalancedExcerpt(content, targetLength);
        notices.push(
            `\n⚠️ 注意：内容超过阈值（${Math.round(threshold / 1000)}千字），已按章节均衡截断到约${Math.round(analysisContent.length / 1000)}千字\n\n`
        );
    }

    return { fileName, analysisContent, expectedNumbers, notices };
};

export const createAnalysisPrompt = (content, expectedNumbers = []) => {
    const expectedHint = expectedNumbers.length > 0
        ? `\n# 硬性约束（必须满足）\n你必须且只分析这些章节号：${expectedNumbers.join(', ')}。\n输出行数必须严格等于 ${expectedNumbers.length} 行，且按上述顺序逐行对应。\n若正文中存在“序章/番外”等无数字章节标题，请不要单独输出为一行。\n`
        : '';

    return `# 角色
你是一位经验丰富的小说编辑和金牌剧情分析师。你擅长解构故事，洞察每一章节的功能、节奏和情感，并能将其转化为高度结构化的分析报告。

# 任务
我将提供一部小说的部分章节正文。你的任务是通读并深刻理解这些章节，然后逐章进行分析，最终输出一个单一、完整的Markdown格式的章节规划分析表。

# 表格结构与规则
输出的表格必须严格遵循以下8列结构和内容要求：

| 栏目 | 填写指南 |
| :--- | :--- |
| **1. 章节号** | **准确提取**章节标题中的数字（无论是阿拉伯数字还是中文数字），并统一转换为阿拉伯数字。**必须与原文的章节号保持一致**，例如，如果章节标题是"第五十一章"，则此列应填写"51"。 |
| **2. 章节标题** | 准确提取该章节的标题。 |
| **3. 章节核心剧情梗概** | **[摘要能力]** 用2-3句精炼地概括本章的核心事件。必须清晰地回答：**谁？做了什么？导致了什么？** |
| **4. 本章核心功能/目的** | **[分析能力]** 站在作者的角度，分析本章对整个故事的战略意义。例如：**引入核心冲突、塑造主角性格、制造关键误会、为后期剧情埋下伏笔、揭示世界观设定、推动感情线发展**等。 |
| **5. 画面感/镜头序列** | **[视觉化能力]** 想象本章的影视化改编。列出3-5个最关键、最具代表性的视觉画面或镜头。**必须使用JSON数组格式**，例如：\`["主角在雨中奔跑", "反派在暗处微笑的特写", "一个重要信物掉落在地"]\`。 |
| **6. 关键情节点 (Key Points)** | **[结构化能力]** 提炼出本章情节发展的几个关键节点，这些是驱动本章故事前进的骨架。**必须使用JSON数组格式**，例如：\`["主角接到一个神秘电话", "主角与盟友发生争执", "结尾处发现新的线索"]\`。 |
| **7. 本章氛围/情绪** | **[情感洞察能力]** 描述本章带给读者的主要情感体验或整体氛围。**必须使用JSON数组格式**，例如：\`["紧张悬疑", "温馨治愈", "悲伤压抑", "轻松幽默"]\`。 |
| **8. 结尾"钩子" (Hook)** | **[悬念设置能力]** 提炼出章节结尾留给读者的最大悬念、疑问或期待。是什么让读者迫不及待地想看下一章？ |

# 学习范例
为了确保你完全理解任务要求，请参考以下范例：

| 章节号 | 章节标题 | 章节核心剧情梗概 | 本章核心功能/目的 | 画面感/镜头序列 | 关键情节点 (Key Points) | 本章氛围/情绪 | 结尾"钩子" (Hook) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 重逢 | 女主角倪雾带女儿岁岁去医院看病，偶遇主治医生竟是七年前的前男友裴淮聿。他没认出改名换姓且变瘦的她。回家后，岁岁问给她看病的医生叔叔是不是爸爸。 | 引入男女主及核心人物（女儿），建立七年后再遇的核心戏剧冲突，抛出"他没认出她"和"女儿身世"两大悬念。 | \`["诊室门被推开", "裴淮聿戴着金丝眼镜抬头", "倪雾脸色煞白，匆忙戴上口罩", "过去与现在的裴淮聿形象重叠", "女儿仰头问妈妈：那是爸爸吗？"]\` | \`["倪雾与裴淮聿在诊室重逢。", "裴淮聿未认出已改名换姓的倪雾。", "裴淮聿从高中班长电话中听到旧名"程青渺"，情绪波动。", "女儿岁岁直接提问："医生叔叔是爸爸吗？""]\` | \`["震惊", "紧张", "心痛", "昔日回忆的苦涩", "悬念感"]\` | 女儿关于"爸爸"的惊人提问，直接将剧情推向第一个小高潮。 |

# 输出要求
请严格按照上述规则和范例，开始分析我接下来提供的正文，并生成完整的章节分析
**绝对禁止**在你的回答中包含任何Markdown表格之外的内容。
你的回答**必须**以 \`| 章节号 |\` 开头，并以表格的最后一行结束。
不要添加任何介绍、总结、解释或任何其他文字。
${expectedHint}

以下是小说正文：

${content}`;
};
