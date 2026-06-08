export const IMPORT_MODES = {
    OVERWRITE: 'overwrite',
    APPEND: 'append'
};

const splitFileName = (fileName) => {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex <= 0) {
        return { name: fileName, extension: '' };
    }

    return {
        name: fileName.slice(0, lastDotIndex),
        extension: fileName.slice(lastDotIndex)
    };
};

export const getImportResultFileName = (
    existingResults,
    requestedFileName,
    importMode = IMPORT_MODES.OVERWRITE,
    fallbackTimestamp = Date.now()
) => {
    const baseFileName = requestedFileName || `导入结果_${fallbackTimestamp}.md`;
    if (importMode !== IMPORT_MODES.APPEND || !existingResults?.[baseFileName]) {
        return baseFileName;
    }

    const { name, extension } = splitFileName(baseFileName);
    let index = 2;
    let candidate = `${name}（新增${index}）${extension}`;

    while (existingResults[candidate]) {
        index += 1;
        candidate = `${name}（新增${index}）${extension}`;
    }

    return candidate;
};
