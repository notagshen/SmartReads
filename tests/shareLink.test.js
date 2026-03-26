import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShareLink,
  parseShareLink,
  buildRemoteShareUrl,
  parseRemoteShareId
} from '../src/utils/shareLink.js';

test('buildShareLink and parseShareLink should round-trip markdown payload', () => {
  const markdown = '| 章节号 | 章节标题 |\n| --- | --- |\n| 1 | 开始 |';
  const url = buildShareLink(markdown, 'https://example.com/app');
  const hash = new URL(url).hash;
  const decoded = parseShareLink(hash);
  assert.equal(decoded, markdown);
});

test('buildRemoteShareUrl and parseRemoteShareId should round-trip id', () => {
  const url = buildRemoteShareUrl('abc123XYZ', 'https://example.com/app?x=1#old');
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('share'), 'abc123XYZ');
  assert.equal(parsed.hash, '');
  assert.equal(parseRemoteShareId(parsed.search), 'abc123XYZ');
});

test('parseRemoteShareId should return null when query missing', () => {
  assert.equal(parseRemoteShareId('?a=1&b=2'), null);
});
