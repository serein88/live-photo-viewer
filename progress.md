# Progress.md

## 记录规范
- 每轮仅记录一个任务或子任务。
- 必须包含：背景、改动、验证证据、结果状态、下一步。
- 关键日志建议保留前缀：`[viewer]`、`[live-debug]`、`[scan]`。

## 2026-02-15（流程迁移）
- 将旧流程文件 `claude.md`、`task.json`、`todo.md`、`progress.txt` 合并为新规范：`agents.md` + `task.md` + `progress.md`。
- `agents.md` 不再作为兼容入口，改为正式规范文件。
- 后续任务状态只在 `task.md` 维护；每轮摘要只在 `progress.md` 追加。

## 历史记录（迁移自 progress.txt）
[2026-02-02] 预览器 UI 与交互重构
- 预览改为暗色画布 + 右侧信息栏；移除占空间底栏。
- 增加上一张/下一张悬浮按钮（自动隐藏）。
- 支持滚轮缩放、拖拽、缩放中心修正。

[2026-02-03] 引入 Viewer.js
- 采用 `vendor/viewer.min.js` + `vendor/viewer.min.css` 替换自研预览层。
- 重做为 Google Photos 风格 UI。
- live 播放改为同画布层播放，结束后回退静态图。

[2026-02-04] 交互细节与布局修复
- 面板固定右侧，非 live 隐藏播放/静音按钮。
- 动图切换自动播放一次以区分静图。
- 增强日志：`[viewer]`、`[live-debug]`。

[2026-02-05] 缩略图与性能优化
- 修复缩略图丢失、URL 反复创建导致内存增长。
- EXIF 读取改为小块读取，降低首轮解析开销。
- 预览默认 contain，图片/视频尺寸规则趋同。

[2026-02-06] 跨平台目录选择分流
- 增加平台检测与目录选择优先级策略。
- iOS 强制回退多文件；增加 `[dir-pick]` 调试日志。

[2026-02-10] 项目结构工程化
- 从单文件演进为 `index.html + src + vendor`。
- 新增/更新 README 与开发文档，规范协作流程。

[2026-02-11] Android live 黑屏与导航稳定性
- live 播放增加完整事件链日志，优化隐藏图片时机。
- 播放失败回退策略：重试 + 兼容配置。
- 修复 Windows 下一张卡住：改为外部索引驱动，稳定 Viewer 可导航列表。

[2026-02-12] 大目录扫描与网格性能重构
- 扫描改为“先索引占位 + 后台渐进识别”。
- 网格分批渲染 + 滚动预取 + 缩略图并发队列。
- 修复荣耀 live 大文件夹漏检；增加按需即时识别兜底。

[2026-02-13 17:05] 标准流程文件初始化
- 新增 `task.json`：任务单一来源（优先级/状态/验收）。
- 新增 `claude.md`：固定六步执行流程（Codex/Claude 通用）。
- 新增 `scripts/init-dev.ps1`：会话初始化并输出下一任务。
- 本轮仅文档治理，未改业务代码。

[2026-02-13 17:18] 历史日志结构化迁移
- 将 `agents.md` 历史内容迁移汇总到 `progress.txt`。
- `agents.md` 改为轻量索引与交接入口，避免重复维护。
- 归档原则：
  1) 任务状态仅以 `task.json` 为准；
  2) 执行流水仅写 `progress.txt`；
  3) 架构与约束仅写 `开发文档.md`；
  4) 操作流程仅写 `claude.md` 与 `docs/VIBE_CODING_HARNESS.md`。

[2026-02-13 17:30] P1-004 修复 stats UI 乱码（执行完成，待用户验收）
- 任务创建：`task.json` 新增 `P1-004`，状态置为 `review`。
- 问题定位：`src/js/app.js` 的 `updateStats()` 使用了错误编码字符串，导致 `#stats` 显示乱码。
- 修复内容：统计文案改为 `总计 {total} · Live {live} · 已选 {selected}`。
- 同步：`todo.md` 已加入“待检查”条目。
- 验收建议：导入文件后切换筛选、选择/取消选择，确认 `#stats` 全程中文正常。

[2026-02-13 17:45] P1-004 扩展检查：全量排查 UI 乱码并修复
- 范围：`src/js/app.js` + `index.html`（排除 `vendor/` 与二进制文件）。
- 结果：除 `#stats` 外，额外修复状态栏、iOS 提示、取消提示、顶部栏（返回/预览/信息）、信息面板（关闭/添加说明）、静音按钮标题等乱码。
- 检查：使用 `rg` 扫描常见乱码特征串，当前未发现剩余乱码命中。

[2026-02-13 18:05] P0-001 Android Edge Live 播放兼容（阶段修复）
- 输入证据：Edge Android 日志显示 `original` 源触发 `DEMUXER_ERROR_DETECTED_AAC`，随后回退 `stripped` 可播；静音按钮解静音后会重新触发失败链路。
- 改动文件：`src/js/app.js`
- 改动点：
  1) 新增 `isAndroidEdgeBrowser()`，识别 Android Edge。
  2) Edge 下 `openLiveVideoInline()` 预先尝试去音轨，优先稳定播放路径。
  3) Edge 下禁止解静音切换到原始音轨，给出状态提示并保持静音播放。
  4) 修复播放按钮标题乱码：`播放 Live`。
- 预期效果：Edge 点击静音按钮不再触发不可播放/黑屏；vivo/荣耀在 Edge 走稳定视频轨播放。
- 待用户回归：安卓 Edge 分别验证 vivo-live-1 与 荣耀-live-2 的首次播放、重复播放、点击静音按钮行为。

[2026-02-13 18:18] P0-001 Android Edge 播放策略调整（第二轮）
- 调整目标：不再全局强制 Edge 预去音轨，改为“先尝试原始轨，失败再回退 stripped”。
- 关键改动：
  1) Edge 下默认优先 original 源；仅当该文件触发 AAC/DEMUXER 错误后，标记 `_edgeForceStripped=true`。
  2) 触发回退后自动静音并锁定当前文件的静音按钮（显示不兼容提示）。
  3) 未触发回退的文件，静音按钮可正常切换；取消静音时会重新按原始轨重开播放。
- 预期：在 Edge 上尽量获得与 Chrome 一致的“有声优先”行为；仅对不兼容样本降级为静音可播。

[2026-02-13 18:28] P0-001 Android Edge 回归修正（第三轮）
- 现象复盘：用户日志显示 `sourceMode` 持续为 `stripped`，说明文件被历史 `_edgeForceStripped` 状态锁住，导致后续每次播放都绕过 original 探测。
- 修正：`openLiveVideoInline()` 在 Edge 新一轮播放开始时先清除历史 `_edgeForceStripped`，每轮重新探测 original；若再次触发 AAC 错误再即时回退 stripped。
- 目标：避免“一次失败后永久静音模式”导致的按钮失效感。

[2026-02-13 18:40] P0-001 Android Edge 回归修正（第四轮）
- 用户反馈：`sourceMode: original` 已恢复，但静音按钮仍“失效”；荣耀样本在 Edge 仍无法播放。
- 修复：
  1) 取消对静音按钮的 `disabled` 锁死，改为保留可点击并仅提示当前文件音频不兼容。
  2) Edge 下视频错误回退策略放宽：不再仅匹配 AAC/DEMUXER 文本，Edge 发生媒体错误时统一尝试 stripped 回退。
- 目的：
  - 避免按钮被锁导致“无响应”感。
  - 提高荣耀样本在 Edge 的回退成功率。

[2026-02-13 19:05] P0-001 Edge/Chrome 差异修复（第五轮）
- 新增视频源切换工具：`setVideoBlobSource` / `resetVideoElementSource`，避免同一 `<video>` 反复切源时残留错误状态。
- Edge 回退策略改造：
  1) 先尝试 original；
  2) `onerror` 或 `play-reject` 均触发 stripped 回退（不再依赖单一路径）；
  3) 回退后对当前文件标记 `_edgeForceStripped` 并提示“音频不兼容”。
- 静音按钮行为：
  - 对已降级文件，点击取消静音会清除 `_edgeForceStripped` 并重试原始音轨（用户可主动重试，不再“无效”）。
- 目标：修复 Edge 上荣耀样本“无法播放”与回退不稳定问题，同时保持 Chrome 原始轨播放路径不受影响。

[2026-02-13 19:18] P0-001 Edge 播放异常并发修复（第六轮）
- 根据 temp.md 新日志定位：`video-error` 与 `play-reject` 同时触发 stripped 回退，重复切源导致 `play() request was interrupted by a call to pause()`。
- 修复：
  1) 为每次 `openLiveVideoInline` 引入 `playbackToken`，旧会话异步回调自动失效。
  2) `fallbackToStripped` 增加并发去重（`fallbackPromise`），同一轮只执行一次回退。
  3) `closeLiveVideoInline` 时递增 token，避免关闭后的旧异步继续操作 video。
- 预期：Edge 上不再出现同一轮双重回退引发的黑屏闪烁与 retry reject 中断错误。

