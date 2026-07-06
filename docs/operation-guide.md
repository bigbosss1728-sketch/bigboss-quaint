# 个人量化平台操作手册

本手册用于本地启动和使用当前 MVP。默认环境为 Windows PowerShell，项目根目录为命令执行目录。

## 1. 准备环境

项目依赖已安装时，可以直接启动。首次配置或环境缺失时，先执行：

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

注意：`.env` 已被 `.gitignore` 忽略，不要把真实 token 写入 README、提交记录或截图。

## 2. 启动服务

先启动后端：

```powershell
.\start-backend.cmd
```

后端地址：

```text
http://127.0.0.1:8000
```

再打开一个 PowerShell 窗口启动前端：

```powershell
.\start-frontend.cmd
```

前端地址：

```text
http://127.0.0.1:5173
```

两个启动窗口都需要保持打开。

## 3. 使用页面

1. 打开 `http://127.0.0.1:5173`。
2. 查看顶部指标：
   - `Signal Source`：信号来源，`sample` 表示示例数据，`tushare` 表示真实 Tushare 数据。
   - `Trade Date`：当前股票池对应的交易日。
   - `Buy Candidates`：买入候选数量。
   - `Watch List`：观察候选数量。
3. 点击 `Refresh` 读取后端保存的最新股票池。
4. 选择交易日后点击 `Run Tushare`，拉取该交易日数据并生成股票池。
5. 在 `Daily Stock Pool` 表格查看代码、名称、评级、动作、得分、建议仓位和原因。

## 4. 常用命令

健康检查：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health
```

读取最新股票池：

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

### 页面显示 Backend unavailable

通常是后端未启动或端口不是 `8000`。先确认后端窗口正在运行，再访问：

```text
http://127.0.0.1:8000/api/health
```

### 浏览器提示 127.0.0.1 拒绝连接

对应服务没有运行。访问前端前，先执行：

```powershell
.\start-frontend.cmd
```

访问后端前，先执行：

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

### 构建时出现 Ant Design `use client` 警告

这是 Vite 打包 Ant Design 时的已知警告，当前不影响构建产物。
