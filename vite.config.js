import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { buildUpstreamTargetUrl, ensureSafeUpstreamBaseUrl } from './src/utils/upstreamProxyGuard.js';

const PROXY_PREFIX = '/api/proxy';
const SHARE_PREFIX = '/api/share';
const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control'];
const MAX_SHARE_MARKDOWN_SIZE = 2 * 1024 * 1024; // 2MB
const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
const SHARE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS shared_analyses (
  id TEXT PRIMARY KEY,
  markdown TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_count INTEGER NOT NULL DEFAULT 0
);
`;

let sharePool = null;
let shareTableReady = null;

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

const parseJsonBody = async (req) => {
  const bodyBuffer = await readRequestBody(req);
  if (!bodyBuffer?.length) return {};
  try {
    return JSON.parse(bodyBuffer.toString('utf-8'));
  } catch (_error) {
    throw new Error('请求体不是合法JSON');
  }
};

const getSharePool = () => {
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!sharePool) {
    sharePool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }
  return sharePool;
};

const ensureShareTable = async (pool) => {
  if (!shareTableReady) {
    shareTableReady = pool.query(SHARE_TABLE_SQL);
  }
  await shareTableReady;
};

const generateShareId = () => randomBytes(8).toString('base64url');

const createShare = async (pool, markdown) => {
  for (let i = 0; i < 6; i += 1) {
    const id = generateShareId();
    const result = await pool.query(
      `INSERT INTO shared_analyses (id, markdown)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [id, markdown]
    );
    if (result.rowCount === 1) return id;
  }
  throw new Error('生成分享链接失败，请重试');
};

const getShareById = async (pool, id) => {
  const result = await pool.query(
    'SELECT markdown, created_at, view_count FROM shared_analyses WHERE id = $1',
    [id]
  );
  if (result.rowCount === 0) return null;
  return result.rows[0];
};

const updateShareById = async (pool, id, markdown) => {
  const result = await pool.query(
    `UPDATE shared_analyses
     SET markdown = $2
     WHERE id = $1
     RETURNING id`,
    [id, markdown]
  );
  return result.rowCount === 1;
};

const increaseShareViewCount = (pool, id) => {
  pool.query(
    'UPDATE shared_analyses SET view_count = view_count + 1 WHERE id = $1',
    [id]
  ).catch(() => {});
};

const handleShareApiRequest = async (req, res, parsed) => {
  const pool = getSharePool();
  if (!pool) {
    writeJson(res, 503, { error: { message: '分享服务未配置，请设置 NEON_DATABASE_URL' } });
    return true;
  }

  try {
    await ensureShareTable(pool);
  } catch (error) {
    writeJson(res, 500, { error: { message: `初始化分享数据表失败: ${error.message}` } });
    return true;
  }

  const method = (req.method || 'GET').toUpperCase();
  const pathname = parsed.pathname;

  if (method === 'POST' && pathname === SHARE_PREFIX) {
    try {
      const body = await parseJsonBody(req);
      const markdown = typeof body.markdown === 'string' ? body.markdown.trim() : '';
      if (!markdown) {
        writeJson(res, 400, { error: { message: '缺少 markdown 内容' } });
        return true;
      }
      if (Buffer.byteLength(markdown, 'utf8') > MAX_SHARE_MARKDOWN_SIZE) {
        writeJson(res, 413, { error: { message: '分享内容过大，请改用文件导出' } });
        return true;
      }

      const id = await createShare(pool, markdown);
      writeJson(res, 200, { id });
      return true;
    } catch (error) {
      writeJson(res, 400, { error: { message: error.message } });
      return true;
    }
  }

  if (method === 'GET' && pathname.startsWith(`${SHARE_PREFIX}/`)) {
    const id = decodeURIComponent(pathname.slice(`${SHARE_PREFIX}/`.length));
    if (!SHARE_ID_PATTERN.test(id)) {
      writeJson(res, 400, { error: { message: '分享ID格式无效' } });
      return true;
    }

    try {
      const share = await getShareById(pool, id);
      if (!share) {
        writeJson(res, 404, { error: { message: '分享内容不存在或已失效' } });
        return true;
      }
      increaseShareViewCount(pool, id);
      writeJson(res, 200, {
        id,
        markdown: share.markdown,
        createdAt: share.created_at,
        viewCount: share.view_count
      });
      return true;
    } catch (error) {
      writeJson(res, 500, { error: { message: `读取分享内容失败: ${error.message}` } });
      return true;
    }
  }

  if (method === 'PUT' && pathname.startsWith(`${SHARE_PREFIX}/`)) {
    const id = decodeURIComponent(pathname.slice(`${SHARE_PREFIX}/`.length));
    if (!SHARE_ID_PATTERN.test(id)) {
      writeJson(res, 400, { error: { message: '分享ID格式无效' } });
      return true;
    }

    try {
      const body = await parseJsonBody(req);
      const markdown = typeof body.markdown === 'string' ? body.markdown.trim() : '';
      if (!markdown) {
        writeJson(res, 400, { error: { message: '缺少 markdown 内容' } });
        return true;
      }
      if (Buffer.byteLength(markdown, 'utf8') > MAX_SHARE_MARKDOWN_SIZE) {
        writeJson(res, 413, { error: { message: '分享内容过大，请改用文件导出' } });
        return true;
      }

      const updated = await updateShareById(pool, id, markdown);
      if (!updated) {
        writeJson(res, 404, { error: { message: '分享内容不存在或已失效' } });
        return true;
      }
      writeJson(res, 200, { id, updated: true });
      return true;
    } catch (error) {
      writeJson(res, 400, { error: { message: error.message } });
      return true;
    }
  }

  writeJson(res, 404, { error: { message: '分享接口不存在' } });
  return true;
};

const createProxyMiddleware = () => async (req, res, next) => {
  try {
    const requestUrl = req.url || '';
    const parsed = new URL(requestUrl, 'http://localhost');

    if (parsed.pathname.startsWith(SHARE_PREFIX)) {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      await handleShareApiRequest(req, res, parsed);
      return;
    }

    if (!requestUrl.startsWith(PROXY_PREFIX)) {
      next();
      return;
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

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
