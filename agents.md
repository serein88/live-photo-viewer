# Agents.md

## 1) 项目目标与用途
- 项目：`live-photo-viewer`
- 目标：离线扫描本地图片，识别 Live Photo，并提供稳定预览/播放。
- 重点场景：Android/Windows 大量文件扫描、跨浏览器（Chrome/Edge）播放兼容。

## 2) 三个流程文件（唯一来源）
- `agents.md`：项目目标、开发规范、可复用经验。
- `task.md`：任务池与状态（待进行 / 进行中 / 待确认 / 失败 / 完成）。
- `progress.md`：每轮任务摘要与验证证据。

## 3) 标准开发步骤（必须执行）
1. 领取一个任务（从 `task.md` 选择，默认按优先级）。
2. 开始编码（仅改任务相关文件，保持最小改动）。
3. 测试验证（给出可复现步骤 + 关键日志/可观察结果）。
4. 更新任务状态：
   - 成功：`进行中 -> 待确认`（用户确认后再 `完成`）
   - 失败：`进行中 -> 失败`（记录阻塞点和下一步）
   - 同时把本轮摘要写入 `progress.md`
5. 提交代码：每一小步可回滚，commit message 包含任务名/任务ID。

## 4) 强约束
- 一轮只做一个任务。
- 没有验证证据，不得标记完成。
- 每轮结束必须更新 `progress.md` 和 `task.md`。

## 5) 可复用经验（当前项目）
- Android Edge 与 Chrome 同为 Chromium，但媒体管线策略可能不同；AAC 轨道在 Edge 可能触发 demux 错误。
- Live 播放回退策略建议：`original -> stripped`，并记录 `[live-debug]` 关键日志。
- 对 `<video>` 反复切源需做并发防抖（会话 token + 回退去重），否则可能出现 `play() interrupted by pause()`。
- 大目录扫描采用“先占位后渐进识别”能显著改善可用性。

## 6) 新问题处理规则
- 开发中发现新问题：不插队；写入 `task.md`（或在 `progress.md` 先记录，再回填任务）。
- 高优问题可由用户显式指定插队。

## 7) MCP 调试经验沉淀（2026-02）
- `C:\Users\languoer\.codex\config.toml` 的 MCP 改动不会热加载，**必须重启 VSCode** 才会生效。
- `chrome-devtools-mcp` 推荐配置（已验证可起服务）：
  - `command = "npx.cmd"`
  - `args = ["-y","chrome-devtools-mcp@latest","--browser-url=http://127.0.0.1:9222","--logFile=C:\\Users\\languoer\\.codex\\chrome-devtools-mcp.log"]`
- 常见故障信号：
  - `timed out awaiting tools/call after 60s`
  - `Transport closed`
  - 日志出现 `Parent death detected (stdin end)`（表示 MCP 进程被上游会话中断，不是浏览器端口本身挂掉）。
- 标准排查顺序（固定执行）：
  1. `Invoke-WebRequest http://127.0.0.1:9222/json/version` 返回 `200`
  2. `codex mcp list` / `codex mcp get chrome-devtools` 确认配置已加载
  3. 运行 MCP `list_pages` 验证链路
  4. 失败则看 `C:\Users\languoer\.codex\chrome-devtools-mcp.log`
- 强制重置流程（MCP异常时）：
  1. 关闭 VSCode
  2. `taskkill /F /IM node.exe`
  3. 重新打开 VSCode
  4. 再执行 `list_pages` 验证
- Android 远程调试实操结论：
  - 在 `chrome://inspect/#devices` 可看到设备 `V2502A / com.microsoft.emmx` 与 `Live 图查看器 (http://localhost:8080/)`。
  - 若出现 `Remote browser is newer than client browser`，优先尝试 `inspect fallback`。
  - 远程页面容易断连，调试时需保持手机端目标页在前台。
