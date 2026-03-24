# Claude Session Browser

一个本地运行的 Claude 会话浏览器，用来读取 `~/.claude` 下的会话数据，并以左侧列表 + 右侧详情的方式进行浏览和检索。

[English README](./README.en.md)

## 项目亮点

- 本地运行，默认只监听 `127.0.0.1`
- 直接读取 Claude 会话文件，不改原始数据
- 支持全文搜索和多维筛选
- 支持时间范围筛选，适合回看最近会话
- 左侧列表 / 右侧详情的阅读模式，比直接看 JSONL 更直观

## 界面预览

![Claude Session Browser Preview](./shoot.png)

## 背景

Claude CLI 会把会话以本地文件的形式保存下来，但原始 JSONL 不适合直接阅读。这个项目提供了一个轻量 Web 界面，方便按项目、目录、时间范围和关键词查看历史会话。

当前实现读取的是 Claude 的本地会话目录和数据结构，不是 Codex 的数据格式。

## 功能范围

- 读取本地 Claude 会话文件并建立内存索引
- 左侧会话列表浏览，右侧 transcript 详情阅读
- 支持关键词搜索
- 支持按活跃/归档状态筛选
- 支持按项目、目录、来源、入口筛选
- 支持按更新时间做快捷时间筛选和自定义日期范围筛选
- 支持重新扫描本地目录并刷新索引
- 默认仅监听 `127.0.0.1`

非目标：

- 不修改原始会话文件
- 不把会话写入数据库
- 不提供用户认证或多用户权限系统

## 数据来源

默认读取目录：

- 活跃会话：`~/.claude/projects`
- 归档会话：`~/.claude/archived_sessions`

也可以通过环境变量 `CODEX_HOME` 指定一个自定义根目录。虽然变量名叫 `CODEX_HOME`，但当前代码实际读取的是 Claude 会话目录，这只是历史命名遗留。

## 安全说明

这个项目本身不会把你的本地会话复制进仓库，也不会额外落盘存储。它的工作方式是：

- 启动时扫描本地会话文件
- 解析后放进服务进程的内存
- 前端通过本地 API 读取这些内存数据

这意味着：

- 分享这份源码仓库，通常不会连带分享你的本地会话数据
- 但如果你把运行中的服务暴露给别人访问，对方就能看到这台机器上被读取到的会话内容

默认启动方式只监听本机地址，相对安全。只有在你主动使用局域网模式时，局域网内其他设备才可能访问。

## 快速开始

环境要求：

- Node.js 20+
- npm

安装依赖：

```bash
npm install
```

开发模式：

```bash
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:4318
```

生产构建：

```bash
npm run build
```

启动构建产物：

```bash
npm start
```

运行测试：

```bash
npm test
```

## 局域网访问

如果你明确知道自己在做什么，可以启动局域网模式：

```bash
npm run dev:lan
```

或：

```bash
npm run start:lan
```

局域网模式下服务会监听 `0.0.0.0`，并允许来自私有网段和本机的访问请求。不要在不受信任的网络环境下这样运行。

## 环境变量

- `CODEX_HOME`
  自定义会话根目录。默认值是 `~/.claude`。
- `PORT`
  服务端口，默认 `4318`。
- `HOST`
  服务监听地址。默认本地模式下为 `127.0.0.1`，局域网模式下为 `0.0.0.0`。
- `ACCESS_MODE`
  可选值为 `localhost` 或 `lan`。未设置时默认为本地模式。

示例：

```bash
CODEX_HOME=/data/claude-sessions PORT=8080 npm run dev
```

## 使用说明

1. 启动服务后，左侧会显示会话列表。
2. 可以在顶部搜索框输入关键词，搜索标题、预览、项目名和目录信息。
3. 点击“筛选项”后，可以按项目、目录、来源、入口和更新时间缩小范围。
4. 点击任意会话后，右侧会展示整理后的 transcript。
5. 点击“刷新索引”会重新扫描本地目录，但不会修改原始数据。

## 项目结构

```text
.
├─ src/                  前端界面（React + Vite）
├─ server/               Express 服务、索引与解析逻辑
├─ shared/               前后端共享类型
├─ tests/                解析与接口测试
├─ dist/                 构建产物
├─ index.html            前端入口模板
└─ package.json          脚本与依赖
```

主要目录说明：

- `src/App.tsx`
  页面主布局和筛选状态管理。
- `src/components/Sidebar.tsx`
  左侧会话列表和筛选区。
- `src/components/DetailPane.tsx`
  右侧会话详情阅读区。
- `server/store.ts`
  本地文件扫描、内存索引和列表筛选。
- `server/parser.ts`
  Claude JSONL 解析与 transcript 整理。

## API 概览

当前项目没有 `openapi.json`，接口以实现为准。

- `GET /api/health`
  健康检查。
- `GET /api/sessions`
  获取会话列表，支持 `q`、`scope`、`repo`、`cwd`、`source`、`originator`、`from`、`to`、`sort`、`order`、`page`、`pageSize`。
- `GET /api/sessions/:id`
  获取单个会话详情。
- `POST /api/reindex`
  重新扫描本地目录并重建内存索引。

示例：

```bash
curl "http://127.0.0.1:4318/api/sessions?scope=active&sort=updated&order=desc&pageSize=20"
```

## 常见问题

### 为什么还有 `CODEX_HOME` 这个环境变量名？

这是历史命名遗留。当前项目实际读取的是 Claude 会话数据，文案和包名已经按 Claude 调整，但环境变量名暂时还保留为 `CODEX_HOME`。

### 点击“刷新索引”会不会改动原始数据？

不会。它只会重新扫描并重建内存索引。

### 为什么我看不到任何会话？

先检查以下几项：

- `~/.claude/projects` 或 `~/.claude/archived_sessions` 下是否真的有会话文件
- 是否通过 `CODEX_HOME` 指向了错误目录
- 当前筛选条件是否过严

## 现状说明

- 当前解析器面向 Claude 会话文件结构
- `source`、`originator`、`cliVersion` 等字段目前没有完整填充
- 项目更适合个人本地使用，不适合作为公网服务直接暴露
