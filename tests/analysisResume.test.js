import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionQueueByResults, shouldAutoResume, createResumeLogEntry } from '../src/utils/analysisResume.js';

test('partitionQueueByResults reuses completed successful results', () => {
  const queue = [
    { name: 'a.txt' },
    { name: 'b.txt' },
    { name: 'c.txt' }
  ];

  const analysisResults = {
    'a.txt': { content: 'A', isComplete: true, hasError: false },
    'b.txt': { content: 'B-partial', isComplete: false, hasError: false },
    'c.txt': { content: 'C-error', isComplete: true, hasError: true }
  };

  const { cachedResults, filesToAnalyze } = partitionQueueByResults(queue, analysisResults);

  assert.deepEqual(cachedResults, { 'a.txt': 'A' });
  assert.deepEqual(filesToAnalyze.map((x) => x.name), ['b.txt', 'c.txt']);
});

test('shouldAutoResume is true only when previous session was running and queue has tasks', () => {
  assert.equal(shouldAutoResume(true, [{ name: 'x.txt' }]), true);
  assert.equal(shouldAutoResume(false, [{ name: 'x.txt' }]), false);
  assert.equal(shouldAutoResume(true, []), false);
  assert.equal(shouldAutoResume(true, null), false);
});

test('createResumeLogEntry should generate structured resume log', () => {
  const item = createResumeLogEntry('detected', '检测到中断任务');
  assert.equal(item.type, 'detected');
  assert.equal(item.message, '检测到中断任务');
  assert.equal(typeof item.id, 'string');
  assert.equal(typeof item.timestamp, 'number');
  assert.ok(item.id.length > 6);
});
