import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeMaxTokens,
  sanitizeTemperature,
  sanitizeTruncationThreshold
} from '../src/utils/settingsValidation.js';

test('sanitizeMaxTokens keeps large positive integers without upper bound', () => {
  assert.equal(sanitizeMaxTokens('999999'), 999999);
});

test('sanitizeMaxTokens falls back when value is invalid', () => {
  assert.equal(sanitizeMaxTokens(''), 4000);
  assert.equal(sanitizeMaxTokens('abc'), 4000);
  assert.equal(sanitizeMaxTokens('0'), 4000);
  assert.equal(sanitizeMaxTokens('-1'), 4000);
});

test('sanitizeTemperature parses numeric value and falls back for invalid input', () => {
  assert.equal(sanitizeTemperature('0.9'), 0.9);
  assert.equal(sanitizeTemperature('oops', 0.7), 0.7);
});

test('sanitizeTruncationThreshold parses positive integer and falls back', () => {
  assert.equal(sanitizeTruncationThreshold('150000'), 150000);
  assert.equal(sanitizeTruncationThreshold(''), 120000);
  assert.equal(sanitizeTruncationThreshold('0'), 120000);
});
