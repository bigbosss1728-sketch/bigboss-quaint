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

## 4. 常用命令

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

## 5. 常见问题

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