import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareDisplayResults } from '../src/utils/shareDisplay.js';

test('buildShareDisplayResults keeps local results when share view is absent', () => {
  const local = { '本地.md': { content: 'x', isComplete: true, hasError: false } };
  const result = buildShareDisplayResults(local, null);
  assert.deepEqual(result, local);
});

test('buildShareDisplayResults returns share-only result when share view exists', () => {
  const local = { '本地.md': { content: 'x', isComplete: true, hasError: false } };
  const shareView = {
    fileName: '远程分享_abc.md',
    content: '| 章节号 |\n| --- |\n| 1 |',
    meta: { importedFromShareLink: true },
    timestamp: 123
  };
  const result = buildShareDisplayResults(local, shareView);
  assert.equal(Object.keys(result).length, 1);
  assert.equal(result['远程分享_abc.md'].content, shareView.content);
  assert.equal(result['远程分享_abc.md'].isComplete, true);
});
