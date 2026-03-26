const CHINESE_DIGITS = {
    '零': 0,
    '〇': 0,
    '一': 1,
    '二': 2,
    '两': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9
};

const CHINESE_UNITS = {
    '十': 10,
    '百': 100,
    '千': 1000,
    '万': 10000
};

const toInteger = (value) => {
    const num = Number(value);
    return Number.isInteger(num) && num > 0 ? num : null;
};

export const chineseNumeralToInt = (input = '') => {
    const text = String(input).trim();
    if (!text) return null;

    if (/^\d+$/.test(text)) {
        return toInteger(text);
    }

    // Pure digit-form Chinese like "二零二四"
    if ([...text].every((c) => Object.prototype.hasOwnProperty.call(CHINESE_DIGITS, c))) {
        const parsed = [...text].map((c) => CHINESE_DIGITS[c]).join('');
        return toInteger(parsed);
    }

    let total = 0;
    let section = 0;
    let number = 0;

    for (const ch of text) {
        if (Object.prototype.hasOwnProperty.call(CHINESE_DIGITS, ch)) {
            number = CHINESE_DIGITS[ch];
            continue;
        }

        const unit = CHINESE_UNITS[ch];
        if (!unit) {
            return null;
        }

        if (unit === 10000) {
            section = (section + (number || 0)) * unit;
            total += section;
            section = 0;
            number = 0;
            continue;
        }

        const base = number || 1;
        section += base * unit;
        number = 0;
    }

    const value = total + section + (number || 0);
    return toInteger(value);
};

export const extractChapterNumberFromTitle = (title = '') => {
    const text = String(title).trim();
    if (!text) return null;

    let match = text.match(/第\s*([0-9]+)\s*[章回节卷篇]/i);
    if (match) {
        return toInteger(match[1]);
    }

    match = text.match(/第\s*([一二三四五六七八九十百千万零两〇]+)\s*[章回节卷篇]/);
    if (match) {
        return chineseNumeralToInt(match[1]);
    }

    match = text.match(/(?:chapter|chap)\s*([0-9]+)/i);
    if (match) {
        return toInteger(match[1]);
    }

    return null;
};

export const extractChapterNumbersFromText = (content = '') => {
    const lines = String(content).split(/\r?\n/);
    const numbers = [];

    for (const line of lines) {
        const n = extractChapterNumberFromTitle(line);
        if (n !== null) numbers.push(n);
    }

    return numbers;
};

export const buildSequentialNumbers = (start, end) => {
    const s = toInteger(start);
    const e = toInteger(end);
    if (!s || !e || s > e) return [];

    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
};

export const extractChapterNumbersFromFileName = (fileName = '') => {
    const text = String(fileName);
    let match = text.match(/第?\s*([0-9]+)\s*-\s*([0-9]+)\s*章?/i);
    if (match) {
        return buildSequentialNumbers(match[1], match[2]);
    }

    match = text.match(/第?\s*([0-9]+)\s*章?/i);
    if (match) {
        const n = toInteger(match[1]);
        return n ? [n] : [];
    }

    return [];
};

export const uniqueNumbersInOrder = (numbers = []) => {
    const seen = new Set();
    const out = [];

    for (const item of numbers) {
        const n = toInteger(item);
        if (!n || seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }

    return out;
};
