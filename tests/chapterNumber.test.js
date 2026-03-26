import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chineseNumeralToInt,
  extractChapterNumberFromTitle,
  extractChapterNumbersFromFileName,
  uniqueNumbersInOrder,
  resolveExpectedChapterNumbers
} from '../src/utils/chapterNumber.js';

test('chineseNumeralToInt parses common numerals', () => {
  assert.equal(chineseNumeralToInt('十二'), 12);
  assert.equal(chineseNumeralToInt('一百零三'), 103);
  assert.equal(chineseNumeralToInt('二零二四'), 2024);
  assert.equal(chineseNumeralToInt(''), null);
});

test('extractChapterNumberFromTitle handles chinese and english forms', () => {
  assert.equal(extractChapterNumberFromTitle('第八十三章 赴约'), 83);
  assert.equal(extractChapterNumberFromTitle('Chapter 12 Reunion'), 12);
  assert.equal(extractChapterNumberFromTitle('序章'), null);
});

test('extractChapterNumbersFromFileName parses range and single', () => {
  assert.deepEqual(extractChapterNumbersFromFileName('第71-80章.txt'), [71, 72, 73, 74, 75, 76, 77, 78, 79, 80]);
  assert.deepEqual(extractChapterNumbersFromFileName('第9章.txt'), [9]);
  assert.deepEqual(extractChapterNumbersFromFileName('novel.txt'), []);
});

test('uniqueNumbersInOrder removes duplicates and invalid values', () => {
  assert.deepEqual(uniqueNumbersInOrder([1, 2, '2', null, 3, 1, 0]), [1, 2, 3]);
});

test('resolveExpectedChapterNumbers prioritizes explicit metadata then filename then text', () => {
  const fromMeta = resolveExpectedChapterNumbers({
    fileName: '第10-14章.txt',
    content: '第1章 重逢\n一些正文',
    chapterNumbers: [10, 11, 12, 13, 14]
  });
  assert.deepEqual(fromMeta, [10, 11, 12, 13, 14]);

  const fromName = resolveExpectedChapterNumbers({
    fileName: '第20-24章.txt',
    content: '第1章 重逢\n一些正文',
    chapterNumbers: []
  });
  assert.deepEqual(fromName, [20, 21, 22, 23, 24]);

  const fromText = resolveExpectedChapterNumbers({
    fileName: 'novel.txt',
    content: '第八章 测试\n正文\n第九章 继续',
    chapterNumbers: []
  });
  assert.deepEqual(fromText, [8, 9]);
});
