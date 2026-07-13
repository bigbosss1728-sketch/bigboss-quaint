# 个人量化平台操作手册

本手册用于本地启动和使用当前 React + TypeScript 量化分析平台。默认环境为 Windows PowerShell，命令从项目根目录 `D:\codex\bigboss quaint` 执行。

## 1. 准备环境

首次配置或依赖缺失时执行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".\backend[dev]"
cd frontend
npm.cmd install
cd ..
```

在项目根目录创建或更新 `.env`：

```env
TUSHARE_TOKEN=你的 Tushare Pro Token
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
VITE_API_BASE_URL=http://127.0.0.1:8000
```

`.env` 已被 `.gitignore` 忽略，不要把真实 token 写入 README、提交记录或截图。

## 2. 启动服务

后端：

```powershell
.\start-backend.cmd
```

后端地址：

```text
http://127.0.0.1:8000
```

前端：

```powershell
.\start-frontend.cmd
```

前端地址：

```text
http://127.0.0.1:5173
```

两个启动窗口都需要保持打开。

## 3. 当前前端界面

当前 UI 是深色金融终端布局，技术栈为 React、TypeScript、TailwindCSS、本地 shadcn 风格组件和 TradingView `lightweight-charts`。

- 左侧导航栏：支持展开 240px 和折叠 64px。
- 中间图表区：上方为主 K 线图，下方为指标副图面板。
- 分栏拖拽：拖动主图和指标区之间的细线可调整高度。
- 底部工具栏：支持周期切换、画线、指标叠加、添加指标、截图导出、数据导出和清空画线。
- 右侧抽屉：点击页面最右侧窄按钮打开，包含行情、五档盘口、持仓订单、策略参数和日志告警。

## 4. 数据初始化与增量更新

数据任务由后端创建后交给独立 worker 执行，HTTP 请求只负责入队，不会等待 Tushare 下载完成。同一时间只运行一个数据任务，其余任务保持 `queued`。

首次初始化历史数据（未指定日期时从 `20150101` 更新到当天）：

```powershell
$task = Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/tasks/data/initialize `
  -ContentType 'application/json' `
  -Body '{}'
$task
```

也可以先用较短日期范围检查配置：

```powershell
$body = @{ start_date = '20260701'; end_date = '20260710' } | ConvertTo-Json
$task = Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/tasks/data/initialize `
  -ContentType 'application/json' `
  -Body $body
$task
```

日常增量更新（建议明确填写最近需要补齐的交易日范围）：

```powershell
$body = @{ start_date = '20260710'; end_date = '20260710' } | ConvertTo-Json
$task = Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/tasks/data/update `
  -ContentType 'application/json' `
  -Body $body
$task
```

日期格式均为 `YYYYMMDD`。重复运行同一日期范围会跳过已有 Parquet 分区和已发布股票池，不需要手工去重。

## 5. 查看任务状态

创建任务返回 `id` 和 `queued` 状态。使用返回的任务 ID 查询进度：

```powershell
$id = $task.id
Invoke-RestMethod "http://127.0.0.1:8000/api/tasks/$id"
```

查看最近 50 个任务：

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/tasks?limit=50&offset=0'
```

状态含义：

- `queued`：等待 worker。
- `running`：正在下载、校验或发布。
- `succeeded`：任务完成。
- `failed`：任务失败，查看 `error_message`。
- `interrupted`：后端启动时发现上次进程异常退出留下的运行中任务。

运行阶段依次为 `calendar`、`static_data`、`market_data`、`validation`、`universe`、`publish`；同时可查看 `progress`、起止时间和 `duration_ms`。任务执行期间 `/api/health` 和任务查询接口仍可响应。

读取最新股票池：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/universe/latest
```

读取单只股票的本地日线：

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/stocks/000001.SZ/bars?limit=100'
```

## 6. 运行时目录

所有 Phase-1 运行数据位于项目根目录下的 `backend\.data`，该目录已被 Git 忽略：

```text
backend/.data/
├── quant.db
└── market/raw/<dataset>/trade_date=YYYYMMDD/data.parquet
```

- `quant.db`：任务、股票池批次和股票池成员。
- `market/raw`：`daily`、`adj_factor`、`suspend`、`limit` 等按交易日保存的 Parquet 分区，以及静态快照。
- `latest_signals.json`：旧版信号接口生成的兼容数据（运行旧版 `/api/pipeline/run` 后出现）。

不要在任务为 `running` 时移动、覆盖或删除这些文件。备份时先停止后端，复制整个 `backend\.data` 目录即可。

## 7. 其他常用命令

健康检查：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health
```

读取最新信号：

```http
GET /api/signals/latest
```

运行 Tushare 日线任务：

```http
POST /api/pipeline/run?trade_date=20260703&limit=200
```

`trade_date` 使用 `YYYYMMDD` 格式。

运行后端测试：

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
```

运行前端构建：

```powershell
cd frontend
npm.cmd run build
```

## 8. 失败恢复

### 任务停在 queued

先确认后端仍在运行，再手动唤醒一个单次 worker：

```powershell
.\.venv\Scripts\python.exe -m backend.app.worker --once
```

然后重新查询任务。worker 每次只处理一个任务；如仍有排队任务，完成当前任务后会自动唤醒下一个 worker。

### 任务显示 failed

先读取 `error_message`，修复日期、Tushare 权限、网络或数据校验问题，再重新提交相同初始化或增量请求。已成功写入的分区会被复用，不必删除 `backend\.data`。

```powershell
Invoke-RestMethod "http://127.0.0.1:8000/api/tasks/$id"
```

### 任务显示 interrupted

这表示上次后端或 worker 在运行中退出。确认没有遗留 worker 进程后，重新提交相同日期范围；已有分区会被跳过。不要直接修改 `quant.db` 中的状态。

### 数据文件需要恢复

停止后端后，用之前的完整备份覆盖 `backend\.data`。如果没有备份，保留现有目录并重新提交缺失日期范围，让任务按分区补齐；不要只删除 `quant.db`，否则数据库记录与 Parquet 分区可能不一致。

## 9. 常见问题

### 页面一片黑

先打开浏览器开发者工具查看 Console。当前已修复一类已知原因：示例 K 线数据日期重复，`lightweight-charts` 运行时要求时间序列严格递增，重复或倒序会导致图表初始化异常。

如果再次出现黑屏：

1. 停止前端窗口。
2. 在 `frontend` 目录执行：

```powershell
npm.cmd run build
npm.cmd run dev
```

3. 如果 Vite 提示无法写入 `node_modules\.vite`，关闭占用的 node 进程后重试，或删除 `frontend\node_modules\.vite` 后重新执行 `npm.cmd run dev`。

### 浏览器提示 127.0.0.1 拒绝连接

对应服务没有运行。访问前端前先执行：

```powershell
.\start-frontend.cmd
```

访问后端前先执行：

```powershell
.\start-backend.cmd
```

### Run Tushare 返回 token 相关错误

检查项目根目录 `.env` 是否存在，并确认其中有有效的 `TUSHARE_TOKEN`。

### Run Tushare 返回空数据

确认选择的是 A 股交易日。周末、节假日或未来日期通常没有日线数据。

### npm 命令被 PowerShell 拒绝

使用 `npm.cmd`，不要直接使用 `npm`：

```powershell
npm.cmd run dev -- --port 5173
```

### 构建出现 `use client` 警告

`lucide-react` 在 Vite 打包时可能出现 `"use client" was ignored` 警告。当前不影响构建产物。
