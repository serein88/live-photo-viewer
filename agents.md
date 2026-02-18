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

### Android USB 实机调试 SOP（Chrome / Edge，已验证）
- 前置条件：
  - 手机开启 USB 调试，`adb devices -l` 可见 `device`。
  - 本机服务已启动（示例：`http://localhost:8080/live-photo-viewer/`）。
- 必做端口映射：
  1. `adb reverse tcp:8080 tcp:8080`（让手机访问本机服务）。
  2. 远程调试端口优先用 `9322`，避免与本机 `9222` 冲突：
     - Chrome：`adb forward tcp:9322 localabstract:chrome_devtools_remote`
     - Edge（推荐）：先定位 socket，再绑定：
       - `adb shell cat /proc/net/unix | findstr /i devtools`
       - 找到类似 `@chrome_devtools_remote_<pid>`（本次为 `@chrome_devtools_remote_25392`）
       - `adb forward tcp:9322 localabstract:chrome_devtools_remote_25392`
- 目标确认（必须做）：
  - `Invoke-WebRequest http://127.0.0.1:9322/json/version`：
    - `Android-Package: com.android.chrome` 表示 Chrome；
    - `Android-Package: com.microsoft.emmx` 表示 Edge。
  - `Invoke-WebRequest http://127.0.0.1:9322/json/list` 确认目标页是 `http://localhost:8080/live-photo-viewer/`。
- 自动化执行策略（CDP）：
  - 优先使用 `Runtime.evaluate` 在手机页面内执行脚本（可稳定验证链路状态与日志）。
  - `Runtime.evaluate` 建议传 `awaitPromise=true`、`returnByValue=true`，播放相关用例建议 `userGesture=true`，减少自动播放策略干扰。
  - 导入样本有两种方式：
    1. 页面已有文件时直接复用；
    2. 在页面内 `fetch('/live-photo-viewer/test/...')` 构造 `File` 后调用 `handleSelectedFiles(...)`。
  - 注意：第 2 种并非“直接读取手机本地目录文件”，而是读取本机服务映射到手机的样本资源。
- 常见问题与处理：
  - `9222` 被占用：不要抢占，直接改用 `9322` 并重绑 `adb forward`。
  - Chrome 与 Edge 同时开：`chrome_devtools_remote` 可能不稳定，优先按 `/proc/net/unix` 绑定到指定 `@chrome_devtools_remote_<pid>`。
  - 若无法通过命令自动打开手机页面（命令被策略拦截），让用户手动在手机浏览器打开目标 URL 后继续自动化。
- 会话结束建议：
  - 把页面恢复到 `mode=auto`、`liveMuted=false`，避免影响下一轮人工验收。
