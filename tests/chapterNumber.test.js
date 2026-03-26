import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chineseNumeralToInt,
  extractChapterNumberFromTitle,
  extractChapterNumbersFromFileName,
  uniqueNumbersInOrder
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
