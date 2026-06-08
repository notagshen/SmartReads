import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  normalizePersistedSettings
} from '../src/utils/settingsPersistence.js';

test('normalizePersistedSettings keeps all API configuration fields', () => {
  const result = normalizePersistedSettings({
    apiKey: 'sk-test',
    baseUrl: 'https://api.example.com/v1',
    model: 'gemini-2.5-pro',
    temperature: 0.3,
    maxTokens: 16000,
    truncationThresholdChars: 180000,
    theme: 'dark',
    version: '1.0.0',
    lastModified: '2026-06-08T00:00:00.000Z'
  });

  assert.deepEqual(result.settings, {
    apiKey: 'sk-test',
    baseUrl: 'https://api.example.com/v1',
    model: 'gemini-2.5-pro',
    temperature: 0.3,
    maxTokens: 16000,
    truncationThresholdChars: 180000
  });
  assert.equal(result.theme, 'dark');
});

test('normalizePersistedSettings fills missing settings with defaults', () => {
  const result = normalizePersistedSettings({
    model: 'gpt-4o-mini'
  });

  assert.deepEqual(result.settings, {
    ...DEFAULT_SETTINGS,
    model: 'gpt-4o-mini'
  });
});
