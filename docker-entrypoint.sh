#!/bin/sh
set -eu

node <<'NODE'
const fs = require('fs');

const config = {
  VITE_SETTINGS_PASSWORD: process.env.VITE_SETTINGS_PASSWORD || ''
};

fs.writeFileSync(
  '/app/dist/env-config.js',
  `window.__SMARTREADS_CONFIG__ = ${JSON.stringify(config)};\n`,
  'utf8'
);
NODE

exec "$@"
