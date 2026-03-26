import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_UPSTREAM_BASE_URL,
  normalizeApiBaseUrl,
  buildApiUrl
} from '../src/utils/apiBaseUrl.js';

test('normalizeApiBaseUrl returns default when empty', () => {
  assert.equal(normalizeApiBaseUrl(''), DEFAULT_UPSTREAM_BASE_URL);
  assert.equal(normalizeApiBaseUrl('   '), DEFAULT_UPSTREAM_BASE_URL);
  assert.equal(normalizeApiBaseUrl(null), DEFAULT_UPSTREAM_BASE_URL);
  assert.equal(normalizeApiBaseUrl(undefined), DEFAULT_UPSTREAM_BASE_URL);
});

test('normalizeApiBaseUrl trims and removes trailing slash', () => {
  assert.equal(normalizeApiBaseUrl(' /api/v1/ '), '/api/v1');
  assert.equal(normalizeApiBaseUrl('https://example.com/v1/'), 'https://example.com/v1');
});

test('buildApiUrl joins base and endpoint safely', () => {
  assert.equal(buildApiUrl('/api/v1', '/models'), '/api/v1/models');
  assert.equal(buildApiUrl('/api/v1/', 'models'), '/api/v1/models');
  assert.equal(buildApiUrl('https://example.com/v1', '/chat/completions'), 'https://example.com/v1/chat/completions');
});

test('buildApiUrl falls back to default proxy base', () => {
  assert.equal(buildApiUrl('', '/models'), 'https://api.openai.com/v1/models');
});
