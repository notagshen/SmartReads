import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShareLink,
  parseShareLink,
  buildRemoteShareUrl,
  parseRemoteShareId,
  updateRemoteShareMarkdown
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

test('updateRemoteShareMarkdown should call PUT /api/share/:id', async () => {
  const originalFetch = global.fetch;
  let capturedUrl = '';
  let capturedOptions = null;

  global.fetch = async (url, options) => {
    capturedUrl = String(url);
    capturedOptions = options;
    return {
      ok: true,
      json: async () => ({ id: 'abc123', updated: true })
    };
  };

  try {
    const payload = await updateRemoteShareMarkdown('abc123', '| a | b |');
    assert.equal(capturedUrl, '/api/share/abc123');
    assert.equal(capturedOptions.method, 'PUT');
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.match(String(capturedOptions.body), /markdown/);
    assert.equal(payload.updated, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('updateRemoteShareMarkdown should throw backend error message', async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: { message: '缺少 markdown 内容' } })
  });

  try {
    await assert.rejects(
      () => updateRemoteShareMarkdown('abc123', ''),
      /缺少 markdown 内容/
    );
  } finally {
    global.fetch = originalFetch;
  }
});
