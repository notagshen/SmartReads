import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMarkdownTable,
  buildMarkdownTable,
  applyExpectedChapterNumbers,
  validateChapterContinuity
} from '../src/utils/chapterTable.js';

test('parseMarkdownTable parses first markdown table block', () => {
  const text = `
prefix
| 章节号 | 章节标题 |
| --- | --- |
| 1 | A |
| 2 | B |
suffix
`;
  const { headers, rows } = parseMarkdownTable(text);
  assert.deepEqual(headers, ['章节号', '章节标题']);
  assert.deepEqual(rows, [
    ['1', 'A'],
    ['2', 'B']
  ]);
});

test('applyExpectedChapterNumbers rewrites first column and validates row count', () => {
  const rows = [
    ['100', 'A'],
    ['999', 'B']
  ];
  assert.deepEqual(applyExpectedChapterNumbers(rows, [7, 8]), [
    ['7', 'A'],
    ['8', 'B']
  ]);
  assert.equal(applyExpectedChapterNumbers(rows, [7]), null);
});

test('validateChapterContinuity finds missing and duplicates', () => {
  const rows = [
    ['1', 'A'],
    ['1', 'B'],
    ['3', 'C']
  ];
  const result = validateChapterContinuity(rows);
  assert.equal(result.isValid, false);
  assert.deepEqual(result.duplicates, [1]);
  assert.deepEqual(result.missing, [2]);
});

test('buildMarkdownTable rebuilds markdown output', () => {
  const md = buildMarkdownTable(['A', 'B'], [['1', 'x']]);
  assert.equal(md, '| A | B |\n| --- | --- |\n| 1 | x |');
});

test('buildMarkdownTable should encode multiline cell safely', () => {
  const md = buildMarkdownTable(['A', 'B'], [['1', 'line1\nline2']]);
  assert.equal(md, '| A | B |\n| --- | --- |\n| 1 | line1<br/>line2 |');
});

test('parseMarkdownTable should decode <br/> back to newline', () => {
  const text = `
| 章节号 | 章节标题 |
| --- | --- |
| 1 | 第一行<br/>第二行 |
`;
  const { rows } = parseMarkdownTable(text);
  assert.equal(rows[0][1], '第一行\n第二行');
});
