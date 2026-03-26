# Docker 部署指南

## 快速开始

### 1. 构建并运行容器

```bash
# 构建镜像
docker build -t smartreads-web .

# 运行容器
docker run -p 4173:4173 \
  -e NEON_DATABASE_URL="postgres://user:pass@ep-xxx.neon.tech/db?sslmode=require" \
  smartreads-web
```

### 2. 使用 Docker Compose（推荐）

```bash
# 构建并启动
docker-compose up --build

# 后台运行
docker-compose up -d --build
```

### 3. 访问应用

打开浏览器访问：http://localhost:4173

## 常用命令

```bash
# 停止容器
docker-compose down

# 查看日志
docker-compose logs -f

# 重新构建
docker-compose build --no-cache
```

## 注意事项

- 确保端口4173未被占用
- 首次构建可能需要几分钟时间
- 前端基础URL填写用户自己的上游地址（例如 `https://axonhub.052222.xyz/v1`）
- 项目会通过同源 `/api/proxy` 在后端中转，避免浏览器跨域
- 若要启用“链接分享”（长内容），请配置 `NEON_DATABASE_URL`（或 `DATABASE_URL`）
