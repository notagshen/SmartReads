import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { Readable } from 'node:stream';
import { buildUpstreamTargetUrl, ensureSafeUpstreamBaseUrl } from './src/utils/upstreamProxyGuard.js';

const PROXY_PREFIX = '/api/proxy';
const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control'];

const readRequestBody = async (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const asSingleHeaderValue = (value) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const writeJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const createProxyMiddleware = () => async (req, res, next) => {
  try {
    const requestUrl = req.url || '';
    if (!requestUrl.startsWith(PROXY_PREFIX)) {
      next();
      return;
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const parsed = new URL(requestUrl, 'http://localhost');
    const endpointPath = parsed.pathname.slice(PROXY_PREFIX.length) || '/';
    const upstreamHeader = asSingleHeaderValue(req.headers['x-upstream-base-url']);

    if (!upstreamHeader) {
      writeJson(res, 400, { error: { message: '缺少 X-Upstream-Base-Url 请求头' } });
      return;
    }

    let upstreamBaseUrl;
    try {
      upstreamBaseUrl = ensureSafeUpstreamBaseUrl(upstreamHeader);
    } catch (error) {
      writeJson(res, 400, { error: { message: error.message } });
      return;
    }

    const targetUrl = buildUpstreamTargetUrl(upstreamBaseUrl, endpointPath, parsed.search);

    const headers = new Headers();
    FORWARDED_REQUEST_HEADERS.forEach((headerName) => {
      const value = asSingleHeaderValue(req.headers[headerName]);
      if (value) {
        headers.set(headerName, value);
      }
    });

    const hasBody = !['GET', 'HEAD'].includes((req.method || 'GET').toUpperCase());
    const bodyBuffer = hasBody ? await readRequestBody(req) : undefined;

    const upstreamResponse = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers,
      body: hasBody ? bodyBuffer : undefined
    });

    res.statusCode = upstreamResponse.status;
    FORWARDED_RESPONSE_HEADERS.forEach((headerName) => {
      const value = upstreamResponse.headers.get(headerName);
      if (value) {
        res.setHeader(headerName, value);
      }
    });

    if (!upstreamResponse.body) {
      res.end();
      return;
    }

    Readable.fromWeb(upstreamResponse.body).pipe(res);
  } catch (error) {
    writeJson(res, 502, { error: { message: `代理请求失败: ${error.message}` } });
  }
};

const dynamicUpstreamProxyPlugin = () => {
  const middleware = createProxyMiddleware();

  return {
    name: 'dynamic-upstream-proxy',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    }
  };
};

export default defineConfig({
  plugins: [react(), dynamicUpstreamProxyPlugin()]
});
