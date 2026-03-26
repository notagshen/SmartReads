import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isGpt5Model,
  buildChatCompletionRequestBody,
  extractCompletionTextFromJson,
  extractStreamChunkText
} from '../src/utils/chatApiCompat.js';

test('isGpt5Model should detect gpt-5 family models', () => {
  assert.equal(isGpt5Model('gpt-5.4'), true);
  assert.equal(isGpt5Model('gpt-5'), true);
  assert.equal(isGpt5Model('gpt-4o'), false);
});

test('buildChatCompletionRequestBody uses max_completion_tokens for gpt-5', () => {
  const body = buildChatCompletionRequestBody({
    model: 'gpt-5.4',
    prompt: 'hello',
    temperature: 0.7,
    maxTokens: 32000,
    stream: true
  });

  assert.equal(body.max_completion_tokens, 32000);
  assert.equal('max_tokens' in body, false);
  assert.equal(body.stream, true);
});

test('buildChatCompletionRequestBody uses max_tokens for non gpt-5', () => {
  const body = buildChatCompletionRequestBody({
    model: 'gpt-4o-mini',
    prompt: 'hello',
    temperature: 0.2,
    maxTokens: 2048,
    stream: true
  });

  assert.equal(body.max_tokens, 2048);
  assert.equal('max_completion_tokens' in body, false);
});

test('extractCompletionTextFromJson reads message.content', () => {
  const data = {
    choices: [
      {
        message: {
          role: 'assistant',
          content: '最终输出文本'
        }
      }
    ]
  };

  assert.equal(extractCompletionTextFromJson(data), '最终输出文本');
});

test('extractCompletionTextFromJson falls back to reasoning_content', () => {
  const data = {
    choices: [
      {
        message: {
          role: 'assistant',
          reasoning_content: '推理内容文本'
        }
      }
    ]
  };

  assert.equal(extractCompletionTextFromJson(data), '推理内容文本');
});

test('extractStreamChunkText supports delta.content and delta.reasoning_content', () => {
  const contentChunk = {
    choices: [
      {
        delta: {
          content: 'A'
        }
      }
    ]
  };

  const reasoningChunk = {
    choices: [
      {
        delta: {
          reasoning_content: 'B'
        }
      }
    ]
  };

  assert.equal(extractStreamChunkText(contentChunk), 'A');
  assert.equal(extractStreamChunkText(reasoningChunk), 'B');
});
