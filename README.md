# SmartReads - 小说拆书工具

<div align="center">

*一个基于React的现代化小说文本分析和章节拆分工具*

[![GitHub stars](https://img.shields.io/github/stars/Ggbond626/SmartReads?style=social)](https://github.com/Ggbond626/SmartReads)
[![GitHub forks](https://img.shields.io/github/forks/Ggbond626/SmartReads?style=social)](https://github.com/Ggbond626/SmartReads)
[![GitHub issues](https://img.shields.io/github/issues/Ggbond626/SmartReads)](https://github.com/Ggbond626/SmartReads/issues)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

</div>

## 📸 应用截图

### 🌟 主界面 - 明亮主题
![主界面明亮主题](images/screenshot-light.png)

### 🌙 主界面 - 深色主题  
![主界面深色主题](images/screenshot-dark.png)

## 🆕 更新（改动重点）

- 跨域（CORS）问题已解决：
  - 前端统一通过同源 `/api/proxy` 调用上游接口，不再由浏览器直接跨域访问上游。
  - 支持每位用户独立配置 `baseUrl`，由后端按请求头动态转发。

- 拆分与上下文策略调整：
  - 章节分组新增 `5章/组`，并改为默认 `5章/组`。
  - `maxTokens` 输入框取消前端上限限制。
  - 分析改为“默认不截断”，仅在超阈值时进行章节均衡截断。
  - 新增“章节均衡截断阈值(字符)”可配置项（默认 `120000`）。

- 分享与导入体验升级：
  - 支持链接分享（远程 Neon 存储 + 本地压缩链接回退）。
  - 分享链接进入后为“分享视图”：只展示分享内容，不覆盖本地结果；离开分享链接后恢复本地内容。

- 顶部导航行为：
  - 点击 Header 中的 `SmartReads` 可回到主机域名首页（`window.location.origin`）。

- CI / 部署补充：
  - 新增 GitHub Actions：`.github/workflows/docker-arm64.yml`，在仓库变更时自动构建 ARM64 镜像并推送 GHCR（默认分支推送）。

- 章节连续性增强：
  - 分析结果增加章节连续性校验与自动重试。
  - 修复章节号推断逻辑：优先使用 `chapterNumbers`，其次文件名范围，最后才回退正文扫描，避免误把正文中的 `第1章/第3章` 混入期望章节。
  - 手动点击“开始分析”时会先清理旧结果，防止历史批次混入导致重复章号和顺序错位（仅“刷新后续跑”场景复用快照）。

## ✨ 主要特性

### 📚 智能章节管理
- 🔄 支持多种文件格式（TXT、EPUB等）
- 📋 直观的章节选择和队列管理
- 📊 实时显示文件信息（字数、章节数等）
- 🗂️ 智能缓存机制，提升处理效率

### 🤖 AI驱动的深度分析
- 🧠 集成先进的AI模型进行内容分析
- ⚡ 支持批量处理，提高工作效率
- 📈 实时进度显示和状态反馈
- 🎯 精准提取情节、人物、情感等关键要素

### 🎨 现代化用户界面
- 🌈 紫色渐变玻璃态设计风格
- 🌓 明暗主题无缝切换
- 📱 完美的移动端响应式适配
- ✨ 流畅的动画和交互效果

### ⚙️ 灵活的配置管理
- 🔑 安全的API密钥管理
- 🎛️ 丰富的参数调整选项
- 🔧 多种AI模型支持
- 💾 本地设置持久化存储

### 📊 专业的结果展示
- 📋 结构化的分析结果展示
- 📄 支持Markdown格式导出
- 📋 一键复制功能
- 🔗 支持分享链接（可接入 Neon 存储大内容）
- 🔍 详细的调试信息查看

## 🚀 快速开始

### 环境要求
- Node.js 16+
- 现代浏览器（Chrome、Firefox、Safari、Edge）
- 稳定的网络连接

### 安装步骤

```bash
# 克隆项目
git clone https://github.com/notagshen/SmartReads.git
cd SmartReads

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### Docker 部署

```bash
# 拉取 ARM64 镜像
docker pull ghcr.io/notagshen/smartreads:arm64-latest

# 使用 Docker Compose（推荐）
docker-compose up -d

# 或直接使用 Docker
docker run -p 4173:4173 \
  --name smartreads-web \
  -e NODE_ENV=production \
  -e NEON_DATABASE_URL="postgres://user:pass@ep-xxx.neon.tech/db?sslmode=require" \
  ghcr.io/notagshen/smartreads:arm64-latest
```

访问 http://localhost:4173 开始使用

#### 动态服务端代理（每用户独立上游）

项目内置同源代理路径 `/api/proxy`。前端会把用户在页面填写的上游 `baseUrl` 通过请求头传给本项目后端，再由后端转发到对应上游。

- 每个用户可填写自己的上游 `baseUrl`
- 后端会校验上游 URL 格式与协议（`http/https`），支持本地/私网地址（如 `http://localhost:3000`）
- 可选配置 `NEON_DATABASE_URL`（或 `DATABASE_URL`）开启链接分享存储接口：`POST /api/share`、`GET /api/share/:id`

#### Docker/服务端环境变量参数表

| 参数 | 说明 | 是否必选 | 默认值 | 示例 |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Node 运行环境标识（容器中通常设为生产模式） | 否 | `development`（未设置时） | `production` |
| `NEON_DATABASE_URL` | 分享链接存储数据库连接串（优先使用） | 否 | 无 | `postgres://user:pass@ep-xxx.neon.tech/db?sslmode=require` |
| `DATABASE_URL` | 备用数据库连接串（当未设置 `NEON_DATABASE_URL` 时使用） | 否 | 无 | `postgres://user:pass@host:5432/db` |

## 📖 使用指南

### 1. 配置API设置
1. 点击右上角设置按钮 ⚙️
2. 在"API设置"中配置：
   - API密钥
   - 基础URL（填写你自己的上游地址，如 `https://api.openai.com/v1`）
   - 模型选择
   - 参数调整
3. 测试连接确保配置正确

#### API设置参数表

| 参数 | 说明 | 是否必选 | 默认值 | 示例 |
| --- | --- | --- | --- | --- |
| `apiKey` | 上游模型服务的访问密钥 | 是 | 无 | `sk-xxxx` |
| `baseUrl` | 上游 API 基础地址（由本项目后端同源中转） | 否 | `https://api.openai.com/v1` | `https://api.openai.com/v1` |
| `model` | 调用的模型名称 | 否 | `gpt-3.5-turbo` | `gemini-2.5-pro` / `gpt-5` |
| `temperature` | 采样温度，越低越稳定、越高越发散 | 否 | `0.7` | `0.2` / `0.9` |
| `maxTokens` | 单次生成最大 token 数（前端不再限制上限） | 否 | `4000` | `8000` / `32000` |
| `truncationThresholdChars` | 章节均衡截断触发阈值（字符）；正文超过该值才截断 | 否 | `120000` | `150000` |
> 服务端代理与环境变量配置请见上方 **Docker 部署** 章节。

### 2. 上传小说文件
1. 在"预处理"面板选择文件
2. 支持拖拽上传或点击浏览
3. 自动解析章节信息
4. 选择需要分析的章节

### 3. 开始分析
1. 切换到"分析"面板
2. 添加章节到分析队列
3. 点击"开始分析"
4. 实时查看分析进度

### 4. 查看结果
1. 在"分析结果"面板查看详细分析
2. 支持复制或导出Markdown
3. 可展开调试信息查看详情

## 🛠️ 技术栈

- **前端框架**: React 18
- **样式方案**: CSS Modules + CSS Variables
- **图标库**: React Icons
- **状态管理**: React Context API
- **构建工具**: Vite
- **容器化**: Docker + Docker Compose

## 📁 项目结构

```
src/
├── components/          # 组件目录
│   ├── common/         # 通用组件
│   │   ├── Button/     # 按钮组件
│   │   ├── FileInput/  # 文件输入组件
│   │   └── ...
│   ├── Header/         # 顶部导航栏
│   ├── Sidebar/        # 左侧面板
│   │   ├── AnalysisPanel/      # 分析面板
│   │   └── PreprocessPanel/    # 预处理面板
│   ├── ContentPanel/   # 右侧内容区域
│   ├── SettingsModal/  # 设置模态框
│   └── StatusBar/      # 底部状态栏
├── contexts/           # React Context
├── hooks/              # 自定义Hooks
├── utils/              # 工具函数
└── index.css          # 全局样式和设计令牌
```

## 🎯 功能特色

- ✅ **智能文件处理**: 自动识别章节结构
- ✅ **实时反馈**: 进度条和状态提示
- ✅ **结果导出**: Markdown格式输出
- ✅ **主题切换**: 明暗主题支持
- ✅ **移动适配**: 响应式设计
- ✅ **缓存机制**: 提升处理效率
- ✅ **错误处理**: 友好的错误提示


## ⚠️ 注意事项

- 需要配置有效的AI API密钥
- 建议在安全环境中使用，保护API密钥
- 分析效果取决于AI模型和文本质量
- 大文件处理可能需要较长时间

## 📄 许可证

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

本项目采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 许可证。

**简单说明：**
- ✅ **可以自由使用** - 个人学习、研究、非商业用途
- ✅ **可以修改分享** - 可以基于此项目进行修改和分享
- ❌ **禁止商业使用** - 不得用于任何商业目的
- 📝 **需要署名** - 使用时需要注明原作者
- 🔄 **相同许可** - 修改后的作品需要使用相同许可证

查看 [LICENSE](LICENSE) 文件了解完整条款。

**商业使用许可：** 如需商业使用，请联系作者获得授权。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个Star支持一下！**

Made with ❤️ by [Ggbond626](https://github.com/Ggbond626)

</div>
