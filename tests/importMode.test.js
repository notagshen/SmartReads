import test from 'node:test';
import assert from 'node:assert/strict';
import { IMPORT_MODES, getImportResultFileName } from '../src/utils/importMode.js';

test('getImportResultFileName keeps requested name in overwrite mode', () => {
  assert.equal(
    getImportResultFileName({ '分析.md': {} }, '分析.md', IMPORT_MODES.OVERWRITE, 1),
    '分析.md'
  );
});

test('getImportResultFileName keeps requested name when append has no conflict', () => {
  assert.equal(
    getImportResultFileName({}, '分析.md', IMPORT_MODES.APPEND, 1),
    '分析.md'
  );
});

test('getImportResultFileName avoids replacing existing result in append mode', () => {
  assert.equal(
    getImportResultFileName(
      {
        '分析.md': {},
        '分析（新增2）.md': {}
      },
      '分析.md',
      IMPORT_MODES.APPEND,
      1
    ),
    '分析（新增3）.md'
  );
});
