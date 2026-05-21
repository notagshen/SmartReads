# 使用官方Node.js镜像作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制项目文件
COPY . .

# 构建项目
RUN npm run build

# 生成运行时前端配置
RUN chmod +x /app/docker-entrypoint.sh

# 暴露端口
EXPOSE 4173

# 启动应用
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "preview"]
