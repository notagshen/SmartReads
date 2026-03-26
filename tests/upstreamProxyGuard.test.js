import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUpstreamBaseUrl,
  ensureSafeUpstreamBaseUrl,
  buildUpstreamTargetUrl
} from '../src/utils/upstreamProxyGuard.js';

test('normalizeUpstreamBaseUrl trims trailing slash', () => {
  assert.equal(normalizeUpstreamBaseUrl(' https://example.com/v1/ '), 'https://example.com/v1');
});

test('ensureSafeUpstreamBaseUrl allows localhost and private IPv4', () => {
  assert.equal(ensureSafeUpstreamBaseUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(ensureSafeUpstreamBaseUrl('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
  assert.equal(ensureSafeUpstreamBaseUrl('http://192.168.1.20:3000'), 'http://192.168.1.20:3000');
});

test('ensureSafeUpstreamBaseUrl allows public https URL', () => {
  const safe = ensureSafeUpstreamBaseUrl('https://axonhub.052222.xyz/v1');
  assert.equal(safe, 'https://axonhub.052222.xyz/v1');
});

test('buildUpstreamTargetUrl joins base path and endpoint', () => {
  const target = buildUpstreamTargetUrl('https://example.com/v1', '/chat/completions', '?stream=true');
  assert.equal(target, 'https://example.com/v1/chat/completions?stream=true');
});
