#!/bin/sh
set -eu

node <<'NODE'
const fs = require('fs');

const config = {
  SETTINGS_PASSWORD_REQUIRED: Boolean((process.env.VITE_SETTINGS_PASSWORD || '').trim())
};

fs.writeFileSync(
  '/app/dist/env-config.js',
  `window.__SMARTREADS_CONFIG__ = ${JSON.stringify(config)};\n`,
  'utf8'
);
NODE

exec "$@"
