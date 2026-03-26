# Docker 部署指南

## 快速开始

### 1. 拉取并运行容器

```bash
# 拉取 ARM64 镜像
docker pull ghcr.io/notagshen/smartreads:arm64-latest

# 运行容器
docker run -p 4173:4173 \
  --name smartreads-web \
  -e NODE_ENV=production \
  -e NEON_DATABASE_URL="postgres://user:pass@ep-xxx.neon.tech/db?sslmode=require" \
  ghcr.io/notagshen/smartreads:arm64-latest
```

### 2. 使用 Docker Compose（推荐）

```bash
# 启动（镜像模式）
docker-compose up -d

# 查看当前服务状态
docker-compose ps
```

### 3. 访问应用

打开浏览器访问：http://localhost:4173

## 常用命令

```bash
# 停止容器
docker-compose down

# 查看日志
docker-compose logs -f

# 拉取最新镜像后重启
docker-compose pull && docker-compose up -d
```

## 注意事项

- 确保端口4173未被占用
- 首次拉取镜像可能需要几分钟时间
- 前端基础URL填写用户自己的上游地址（例如 `https://api.openai.com/v1`）
- 项目会通过同源 `/api/proxy` 在后端中转，避免浏览器跨域
- `UPSTREAM_API_BASE_URL` 为保留兼容变量，当前版本以页面设置中的 `baseUrl` 为准（通过 `X-Upstream-Base-Url` 传入后端）
- 若要启用“链接分享”（长内容），请配置 `NEON_DATABASE_URL`（或 `DATABASE_URL`）
