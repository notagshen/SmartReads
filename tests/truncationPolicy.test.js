import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBalancedTruncationThreshold,
  getBalancedTruncationTargetLength,
  shouldApplyBalancedTruncation
} from '../src/utils/truncationPolicy.js';

test('default maxTokens should not truncate moderate content', () => {
  const threshold = getBalancedTruncationThreshold(4000);
  assert.equal(threshold, 120000);
  assert.equal(shouldApplyBalancedTruncation(50000, 4000), false);
});

test('content over threshold should trigger balanced truncation', () => {
  assert.equal(shouldApplyBalancedTruncation(130000, 4000), true);
  assert.equal(getBalancedTruncationTargetLength(130000, 4000), 120000);
});

test('larger maxTokens should raise truncation threshold', () => {
  assert.equal(getBalancedTruncationThreshold(50000), 300000);
  assert.equal(shouldApplyBalancedTruncation(200000, 50000), false);
});

test('custom threshold should be respected when larger than dynamic threshold', () => {
  assert.equal(getBalancedTruncationThreshold(4000, 200000), 200000);
  assert.equal(shouldApplyBalancedTruncation(150000, 4000, 200000), false);
  assert.equal(getBalancedTruncationTargetLength(250000, 4000, 200000), 200000);
});
