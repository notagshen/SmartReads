import { uniqueNumbersInOrder } from './chapterNumber.js';

const isSeparatorRow = (line) =>
    /^\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line.trim());

const splitRow = (line) =>
    line
        .trim()
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/<br\s*\/?>/gi, '\n'));

const sanitizeCellForMarkdown = (cell) =>
    String(cell ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/\n/g, '<br/>');

export const parseMarkdownTable = (content = '') => {
    const lines = String(content)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const tableLines = [];
    let started = false;

    for (const line of lines) {
        if (line.startsWith('|') && line.endsWith('|')) {
            tableLines.push(line);
            started = true;
        } else if (started) {
            break;
        }
    }

    if (tableLines.length < 2) {
        return { headers: [], rows: [] };
    }

    const headers = splitRow(tableLines[0]);
    const rows = tableLines
        .slice(1)
        .filter((line) => !isSeparatorRow(line))
        .map(splitRow)
        .filter((cells) => cells.length > 0);

    return { headers, rows };
};

export const buildMarkdownTable = (headers = [], rows = []) => {
    if (!Array.isArray(headers) || headers.length === 0 || !Array.isArray(rows) || rows.length === 0) {
        return '';
    }

    const headerLine = `| ${headers.map(sanitizeCellForMarkdown).join(' | ')} |`;
    const sepLine = `| ${headers.map(() => '---').join(' | ')} |`;
    const rowLines = rows.map((row) => `| ${row.map(sanitizeCellForMarkdown).join(' | ')} |`);

    return [headerLine, sepLine, ...rowLines].join('\n');
};

export const extractChapterNumbersFromRows = (rows = []) =>
    rows
        .map((row) => Number.parseInt(row?.[0], 10))
        .filter((n) => Number.isInteger(n) && n > 0);

export const validateChapterContinuity = (rows = [], expectedNumbers = []) => {
    const actualNumbers = extractChapterNumbersFromRows(rows);
    const expected = uniqueNumbersInOrder(expectedNumbers);
    const duplicates = [];
    const seen = new Set();

    for (const n of actualNumbers) {
        if (seen.has(n) && !duplicates.includes(n)) {
            duplicates.push(n);
        }
        seen.add(n);
    }

    let missing = [];
    let unexpected = [];
    let orderMismatch = false;

    if (expected.length > 0) {
        const expectedSet = new Set(expected);
        const actualSet = new Set(actualNumbers);
        missing = expected.filter((n) => !actualSet.has(n));
        unexpected = actualNumbers.filter((n) => !expectedSet.has(n));
        orderMismatch =
            expected.length !== actualNumbers.length ||
            expected.some((n, idx) => actualNumbers[idx] !== n);
    } else if (actualNumbers.length > 0) {
        const min = Math.min(...actualNumbers);
        const max = Math.max(...actualNumbers);
        for (let i = min; i <= max; i += 1) {
            if (!seen.has(i)) missing.push(i);
        }
    }

    const isValid =
        duplicates.length === 0 &&
        missing.length === 0 &&
        unexpected.length === 0 &&
        !orderMismatch;

    return {
        isValid,
        actualNumbers,
        expectedNumbers: expected,
        duplicates,
        missing,
        unexpected,
        orderMismatch
    };
};

export const applyExpectedChapterNumbers = (rows = [], expectedNumbers = []) => {
    const expected = uniqueNumbersInOrder(expectedNumbers);
    if (expected.length === 0) return rows;
    if (rows.length !== expected.length) return null;

    return rows.map((row, idx) => {
        const next = Array.isArray(row) ? [...row] : [];
        if (next.length === 0) next.push('');
        next[0] = String(expected[idx]);
        return next;
    });
};
