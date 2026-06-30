import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FILE_PICKER_CANCEL_MESSAGE,
  openFileInput
} from '../src/utils/browserFileInput.js';

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  dispatch(type, payload = {}) {
    for (const handler of this.listeners.get(type) || []) {
      handler({ type, ...payload });
    }
  }
}

class FakeInput extends FakeTarget {
  constructor() {
    super();
    this.files = [];
    this.style = {};
    this.removed = false;
    this.clicked = false;
  }

  click() {
    this.clicked = true;
  }

  remove() {
    this.removed = true;
  }
}

const installDom = () => {
  const input = new FakeInput();
  const fakeWindow = new FakeTarget();
  fakeWindow.setTimeout = (callback) => {
    callback();
    return 1;
  };
  fakeWindow.clearTimeout = () => {};

  globalThis.document = {
    createElement: () => input,
    body: { appendChild: () => {} }
  };
  globalThis.window = fakeWindow;

  return {
    input,
    window: fakeWindow,
    cleanup: () => {
      delete globalThis.document;
      delete globalThis.window;
    }
  };
};

test('openFileInput resolves selected single file', async () => {
  const env = installDom();
  const file = { name: 'novel.txt' };

  try {
    const selected = openFileInput({ accept: '.txt' });
    env.input.files = [file];
    env.input.dispatch('change');

    assert.equal(await selected, file);
    assert.equal(env.input.clicked, true);
    assert.equal(env.input.removed, true);
  } finally {
    env.cleanup();
  }
});

test('openFileInput rejects when file picker sends cancel event', async () => {
  const env = installDom();

  try {
    const selected = openFileInput({ accept: '.txt' });
    env.input.dispatch('cancel');

    await assert.rejects(selected, { message: FILE_PICKER_CANCEL_MESSAGE });
    assert.equal(env.input.removed, true);
  } finally {
    env.cleanup();
  }
});

test('openFileInput rejects on focus fallback after Windows cancel', async () => {
  const env = installDom();

  try {
    const selected = openFileInput({ accept: '.txt' });
    env.window.dispatch('focus');

    await assert.rejects(selected, { message: FILE_PICKER_CANCEL_MESSAGE });
    assert.equal(env.input.removed, true);
  } finally {
    env.cleanup();
  }
});
