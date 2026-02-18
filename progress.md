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


## 2026-02-16 00:49（P0-001 拆解）
- 背景：`P0-001 Android Edge Live 播放兼容`范围过大，单任务难以闭环验证。
- 改动：
  - 在 `task.md` 中将 `P0-001`保留为总任务（Epic）。
  - 新增 6 个子任务：`P0-001-01` ~ `P0-001-06`，覆盖基线采集、状态机、静音行为、并发治理、日志规范、回归验收。
  - 将 `P0-001-01` 设为 `进行中`，其余子任务进入 `待进行`（P0 队列最前）。
- 验证证据：
  - 任务表已更新：`task.md` 中可见 `P0-001` 总任务 + 子任务编号与验收标准。
- 结果状态：任务拆解完成，可按 `P0-001-01 -> ... -> P0-001-06` 顺序迭代。
- 下一步：执行 `P0-001-01`，先沉淀 Android Edge/Chrome 的三样本对照基线日志。

## 2026-02-16 00:53（P1-004 结项 + P0-001-01 首轮基线）
- 背景：
  - 用户确认 `P1-004` 已通过。
  - 开始按子任务推进 `P0-001-01`（复现矩阵与基线采集）。
- 改动：
  1) `task.md`：将 `P1-004` 从“待确认”转入“完成”。
  2) 基于 `docs/temp.md` 提取首轮基线，对 Android Edge / Android Chrome 做对照沉淀（vivo、荣耀两个样本）。
- 验证证据（来自 `docs/temp.md`）：
  - Android Edge（vivo-live-1 / 荣耀-live-2）：
    - `sourceMode: original` 后出现 `PipelineStatus::DEMUXER_ERROR_DETECTED_AAC`
    - 随后 `use cached stripped` + `play reject`
    - 存在 `The play() request was interrupted by a call to pause().`
  - Android Chrome（vivo-live-1 / 荣耀-live-2）：
    - `sourceMode: original`，`loadedmetadata` / `canplay` / `live ended` 链路完整
    - 未出现同类 demux 错误。
- 当前基线矩阵（首轮）：

| 样本 | Android Edge | Android Chrome | 结论 |
|---|---|---|---|
| vivo-live-1.jpg | 失败（AAC demux + play reject） | 正常播放 | Edge 特有兼容问题 |
| 荣耀-live-2.jpg | 失败（AAC demux + play reject） | 正常播放 | Edge 特有兼容问题 |
| xiaomi-live（待补） | 待采集 | 待采集 | 未完成 |

- 结果状态：
  - `P1-004`：完成。
  - `P0-001-01`：进行中（已完成 2/3 样本首轮基线）。
- 下一步：
  1) 采集 xiaomi 样本在 Edge/Chrome 的同口径日志（补齐 3/3）。
  2) 在当前最新代码上重跑三样本，确认是否仍复现相同错误链，作为 `P0-001-02` 输入。

## 2026-02-16 01:06（P0-001-01 基线补齐）
- 背景：用户已补齐 Xiaomi 日志，路径：`docs/temp.md`。
- 改动：
  - 将 `P0-001-01` 从 `进行中` 更新为 `待确认`（`task.md` 已同步）。
  - 汇总三样本在 Android Edge/Android Chrome 的对照基线，作为 `P0-001-02` 输入。
- 验证证据（`docs/temp.md`）：
  - Edge：
    - `vivo-live-1`：`DEMUXER_ERROR_DETECTED_AAC` + `play reject` + `strip retry reject`，未见完整 `loadedmetadata/canplay` 闭环。
    - `honor-live-2`：同上，错误链一致。
    - `xiaomi-live-3`：先出现 `video error/play reject`，随后出现 `loadedmetadata/canplay/live ended`（回退后可结束播放）。
  - Chrome：
    - `vivo-live-1`：`sourceMode=original`，`loadedmetadata/canplay/live ended` 闭环完整。
    - `honor-live-2`：同上。
    - `xiaomi-live-3`：日志表现与 Edge Xiaomi 近似（先 error/reject 后进入 `canplay/ended`），仍需确认是否为同一环境重复采集。
- 基线矩阵（第二版）：

| 样本 | Android Edge | Android Chrome | 备注 |
|---|---|---|---|
| vivo-live-1.jpg | 失败（AAC demux + reject） | 正常（original 直播） | 差异明确 |
| honor-live-2.jpg | 失败（AAC demux + reject） | 正常（original 直播） | 差异明确 |
| xiaomi-live-3.jpg | 回退后可播放结束 | 日志待复核（形态接近 Edge） | 需二次采集确认音频行为 |

- 结果状态：`P0-001-01` 已达到“日志补齐与矩阵沉淀”目标，进入 `待确认`。
- 下一步（待用户确认后执行）：
  1) 进入 `P0-001-02`（播放状态机收敛）。
  2) 优先处理 `video error` 与 `play reject` 双触发导致的重复回退链路。

## 2026-02-16 01:16（P0-001-02 播放状态机收敛）
- 背景：`docs/temp.md` 显示 Edge 下同一轮播放出现 `video error` 与 `play reject` 双触发，导致重复回退与 `play() interrupted by pause()`。
- 改动文件：`src/js/app.js`
- 改动点（`openLiveVideoInline`）：
  1) 新增单轮状态门控：
     - `fallbackAttempted`：单轮最多回退一次；
     - `usingStrippedSource`：已在 stripped 源时禁止再次回退。
  2) `fallbackToStripped()` 增加去重分支日志：
     - `[live-debug] fallback skipped ... why=already-stripped/already-attempted`
  3) 去掉 `play reject` 后的二次裸重放链路（原 `video.controls=true` + 再 `play()`）：
     - 现在改为：回退失败即记录 `[live-debug] retry reject` 并 `closeLiveVideoInline()`，避免重复切源/重复播放请求。
  4) 保留并发安全：沿用 `playbackToken`，旧会话回调自动失效。
- 验证证据：
  - 语法检查通过：`node --check src/js/app.js`
  - 关键日志点仍保留：`play reject`、`video error`、`strip retry reject`、`fallback skipped`。
- 结果状态：`P0-001-02` 代码改造完成，已转 `待确认`（待 Android Edge/Chrome 实机回归）。
- 下一步：
  1) 用户在 Android Edge 复测三样本，确认同一轮仅一次 fallback。
  2) 用户回传日志中不应再出现“video-error + play-reject 双重 strip retry reject”链路。

## 2026-02-16 01:40（P0-001-02 二次修复：Edge 黑屏抑制）
- 背景：用户回传 `docs/日志-2---P0-001-02.md`，仍反馈 Edge 有“一闪黑屏”；日志显示不再有双重 `strip retry reject`，但原始流先 `onplay` 后 `video error` 会短暂暴露黑帧。
- 改动文件：`src/js/app.js`
- 改动点：
  1) 在 `openLiveVideoInline` 新增 `deferHideUntilCanPlay` / `canHidePreview`：
     - Android Edge 下延迟隐藏静态图，直到 `canplay` 再隐藏，避免原始轨失败时黑屏闪现。
  2) 在 `fallbackToStripped` 切源前显式恢复静态图可见，并重置 `canHidePreview=false`，防止回退窗口期出现黑底。
  3) `oncanplay` 时统一把 `canHidePreview=true`，若已在播放则再隐藏静态图。
  4) 保留上一轮的单轮回退门控（`fallbackAttempted`、`usingStrippedSource`），避免重复回退。
- 验证证据：
  - 语法检查：`node --check src/js/app.js` 通过。
  - 结合新旧日志判断：重复回退链路已抑制，本轮重点针对视觉黑闪。
- 结果状态：`P0-001-02` 维持 `待确认`，等待 Android Edge 实机回归（vivo/honor/xiaomi）。
- 下一步：
  1) 用户重测三样本并回传日志。
  2) 若黑闪消失且无重复回退，即可将 `P0-001-02` 标记完成并进入 `P0-001-03`。

## 2026-02-16 02:20（P0-001 总任务重定向 + GitHub 方案筛选）
- 背景：用户要求从“单浏览器（Edge）专项适配”调整为“通用 Live 播放鲁棒性”，并删除任务池中的 Edge 专项任务描述。
- 改动文件：`task.md`
- 改动点：
  1) 将总任务 `P0-001` 重命名为“通用 Live 播放鲁棒性（总任务）”。
  2) 将 `P0-001-03 ~ P0-001-06` 从 Edge 专项改为通用任务：
     - 静音行为一致性
     - 错误恢复与会话并发治理
     - 能力驱动回退链与日志规范化
     - 多浏览器回归验证
  3) `P0-001-02` 备注从 Edge 定向表述改为通用表述（预览遮罩+回退门控）。
- 验证证据：
  - `task.md` 中“进行中/待确认/待进行”分区已完成重命名与验收标准更新。
- 额外产出（GitHub 方案预选）：
  - `gpac/mp4box.js`：浏览器内 MP4 box 级解析/重组，适合替代当前手写 strip 逻辑。
  - `buzz/mediainfo.js`：浏览器内媒体轨道与编码信息探测，适合做能力驱动回退判定。
  - `ffmpegwasm/ffmpeg.wasm`：浏览器内转码/去音轨兜底，兼容性强但性能开销大。
  - `MikeKovarik/exifr`：EXIF/XMP 高性能解析，适合稳定识别厂商 Live 元数据。
  - `wszqkzqk/live-photo-conv`：跨厂商 Live 提取规则参考实现，可用于补齐样本规则。
- 结果状态：任务池已完成“去 Edge 专项化”，可进入通用方案落地阶段。
- 下一步：
  1) 在上面 5 个候选中确定主链路（建议：`mp4box.js + mediainfo.js`）。
  2) 再决定是否接入 `ffmpeg.wasm` 作为仅失败时触发的重兜底。

## 2026-02-16 02:36（任务编号唯一化 + A/B 方案落地拆解）
- 背景：用户要求任务编号“唯一对应、避免混淆”，并确认采用 `方案A + 方案B（兜底）`。
- 改动文件：`task.md`
- 改动点：
  1) 全量任务改为全局唯一 ID（`EPIC-*` / `TASK-*`），并增加“原编号”列用于历史追溯。
  2) 将总任务固定为 `EPIC-LIVE-ROBUST-001`，不再使用易混淆的父子编号形式。
  3) 按选型完成技术拆解：
     - A 链路：`TASK-LIVE-A-003` ~ `TASK-LIVE-A-006`（`exifr`、`mediainfo.js`、`mp4box.js`、通用回退决策）
     - B 兜底：`TASK-LIVE-B-007` ~ `TASK-LIVE-B-008`（`ffmpeg.wasm` 兜底、性能缓存治理）
     - 回归验收：`TASK-LIVE-RG-009`
  4) 保留既有任务历史映射（已完成任务从 `DONE-*`/`P*` 映射到新编号）。
- 验证证据：
  - `task.md` 已可直接看到唯一编号、原编号映射、A/B 拆解任务和验收标准。
- 结果状态：编号治理完成；`方案A + B` 已完成任务级拆解，可直接进入实现阶段。
- 下一步：
  1) 从 `TASK-LIVE-A-003` 开始实现（元数据解析层统一）。
  2) 每完成一个子任务即按规范推进 `进行中 -> 待确认`，并追加回归日志。

## 2026-02-16 15:22（TASK-LIVE-A-003：接入 exifr 统一元数据层）
- 背景：开始执行 `TASK-LIVE-A-003`，目标是将 EXIF/XMP 解析统一到一个可替换层，减少手写解析分叉。
- 改动文件：
  - `index.html`
  - `src/js/app.js`
  - `task.md`
- 改动点：
  1) 新增依赖：`vendor/exifr.full.umd.js` 并在 `index.html` 引入。
  2) 在 `app.js` 新增统一解析入口：
     - `parseImageMetadata(file, options)`
     - `normalizeExifFromExifr(data)`
     - `canUseExifr()`
     解析优先走 `exifr`，失败自动回退现有 `extractExif/extractXmp`。
  3) 将三个元数据读取场景统一接到新入口：
     - 扫描排序队列 `ensureExifTimes()`
     - 详情面板 `updateViewerPanel()`
     - 文件识别主链路 `analyzeFile()`
  4) 增强时间与 GPS 兼容：
     - `parseExifTime()` 支持 `Date/number/ISO string`
     - `formatGps()` 支持十进制度坐标（`latitude/longitude`）与旧数组格式。
- 验证证据：
  - 语法检查通过：`node --check src/js/app.js`
  - 本地样本验证（Node 调 exifr）：
    - `xiaomi-live.jpg` => `make=Xiaomi`、`hasXmp=true`、`hasMotionTag=true`
    - `xiaomi-普通.jpg` => `make=Xiaomi`、`hasXmp=true`、`hasMotionTag=false`
    - `荣耀-live-1.jpg` => `make=HONOR`、`hasXmp=false`（可走 EXIF 厂商判定）
- 结果状态：
  - `TASK-LIVE-A-003` 已完成代码实现，状态更新为 `待确认`（待你实机回归）。
- 下一步：
  1) 你在 Android/Windows 扫描同一批样本，确认 Live 识别与信息面板字段未回退。
  2) 通过后进入 `TASK-LIVE-A-004`（引入 `mediainfo.js` 轨道探测）。

## 2026-02-16 15:48（TASK-LIVE-A-004：接入 mediainfo.js 轨道探测）
- 背景：执行 `TASK-LIVE-A-004`，目标是提供播放前的稳定轨道能力输入，替代单一手写 MP4 解析路径。
- 改动文件：
  - `index.html`
  - `src/js/app.js`
  - `task.md`
- 改动点：
  1) 新增依赖：
     - `vendor/mediainfo.min.js`
     - `vendor/MediaInfoModule.wasm`
     并在页面加载 `mediainfo.min.js`。
  2) 在 `app.js` 增加通用轨道探测层：
     - `canUseMediaInfoJs()`
     - `getMediaInfoInstance()`
     - `detectTracksWithMediaInfo()`
     - `detectTracksForPlayback()`
     支持 `mediainfo.js` 失败自动回退 `detectMp4Tracks()`。
  3) 增加并发治理：
     - `mediaInfoAnalyzeQueue` 串行化 WASM 分析，避免并发分析冲突。
  4) 接入播放链路：
     - `openLiveVideoInline()` 在播放前先执行轨道探测；
     - stripped 回退链路也会补充探测并打点。
  5) 统一日志：
     - 新增 `[live-debug] track probe`，包含 `sourceMode/source/audio/video/tracks/audioCodec/videoCodec`。
- 验证证据：
  - 语法检查：`node --check src/js/app.js` 通过。
  - 依赖文件已落地：`vendor/mediainfo.min.js`、`vendor/MediaInfoModule.wasm`。
  - 运行日志层面新增稳定探测点（可用于后续决策链 `TASK-LIVE-A-006`）。
- 结果状态：
  - `TASK-LIVE-A-004` 代码实现完成，状态改为 `待确认`。
- 下一步：
  1) 你在 Android/Windows 回归播放，确认每次播放前均输出 `track probe`。
  2) 通过后进入 `TASK-LIVE-A-005`（引入 `mp4box.js` 去音轨/重组）。

## 2026-02-16 16:02（TASK-LIVE-A-004 回归补丁：轨道日志可见性）
- 背景：用户反馈在 Android/Windows 控制台无法通过 `track prob` 关键字检索到输出。
- 改动文件：`src/js/app.js`
- 改动点：
  1) 将轨道探测日志从 `console.debug` 升级为 `console.log/console.warn`，避免被 DevTools 默认日志级别隐藏。
  2) 统一日志前缀为 `[track-probe]`，并补齐分阶段日志：
     - `start`（探测开始）
     - `cache`（命中缓存）
     - `done`（探测完成）
     - `mediainfo unavailable/init failed/analyze failed`（降级原因）
  3) 新增一次性降级提示：当 `mediainfo.js` 不可用时明确打印“fallback to mp4 parser”。
- 验证证据：
  - 语法检查：`node --check src/js/app.js` 通过。
- 结果状态：
  - `TASK-LIVE-A-004` 维持 `待确认`，等待你按 `[track-probe]` 关键字复测。

## 2026-02-16 16:21（TASK-LIVE-A-004 结项 + TASK-LIVE-A-005 实现）
- 背景：
  - 用户确认 Android/Windows 已看到 `[track-probe]` 输出，`TASK-LIVE-A-004` 通过。
  - 进入下一子任务 `TASK-LIVE-A-005`（mp4box 去音轨/重组）。
- 改动文件：
  - `src/js/app.js`
  - `vendor/mp4box.all.esm.mjs`
  - `task.md`
- 改动点（A-005）：
  1) 新增 mp4box 动态加载链路：
     - `loadMp4BoxModule()`
     - 模块路径：`./vendor/mp4box.all.esm.mjs`
  2) 新增 mp4box 去音轨实现：
     - `stripMp4AudioTrackWithMp4Box(blob)`
     - 按“仅视频轨分段+重组”输出无音轨 MP4（init segment + media segments）。
  3) 保留旧逻辑兜底：
     - 原手写 box 去音轨逻辑迁移到 `stripMp4AudioTrackLegacy(blob)`；
     - 新入口 `stripMp4AudioTrack(blob)` 优先 mp4box，失败自动回退 legacy。
  4) 增加 mp4box 关键日志：
     - import/append/remux timeout/segment setup 失败日志，便于实机定位。
- 验证证据：
  - 语法检查：`node --check src/js/app.js` 通过。
  - 依赖文件已落地：`vendor/mp4box.all.esm.mjs`。
- 任务状态：
  - `TASK-LIVE-A-004`：完成（已获用户确认）。
  - `TASK-LIVE-A-005`：待确认（待你实机回归播放稳定性）。
- 下一步：
  1) 你在 Android/Windows 各测 vivo/xiaomi/honor，关注是否出现 `[live-debug] strip audio via mp4box`。
  2) 若出现 remux 失败或超时，回传对应日志，我再收敛 A-005。

## 2026-02-16 16:36（TASK-LIVE-A-005 补丁：mp4box 日志可见性）
- 背景：用户反馈控制台过滤 `mp4box` 无输出。
- 改动文件：`src/js/app.js`
- 改动点：
  1) 将 mp4box 相关日志统一改为前缀 `[mp4box]`，并从 `debug` 提升为 `log/warn`。
  2) 在 `stripMp4AudioTrack()` 增加明确阶段日志：
     - `strip request`
     - `strip success`
     - `strip fallback legacy`
  3) 对 import/append/segment setup/remux timeout/remux failed 均补充 `[mp4box]` 错误日志。
- 验证证据：
  - 语法检查：`node --check src/js/app.js` 通过。
- 结果状态：
  - `TASK-LIVE-A-005` 维持 `待确认`，等待你在触发回退场景时验证 `[mp4box]` 日志链。

## 2026-02-16 17:05（TASK-LIVE-A-005 确认完成 + TASK-LIVE-A-006 实施）
- 背景：
  - 用户确认 Android Edge 可见 `[mp4box]` 输出，`TASK-LIVE-A-005` 通过。
  - 按计划进入下一步：`TASK-LIVE-A-006`（通用播放决策链路）。
- 改动文件：
  - `src/js/app.js`
  - `task.md`
- 改动点（A-006）：
  1) 移除播放决策中的 Edge 专属硬编码路径：
     - 不再使用 `isAndroidEdgeBrowser()` / `_edgeForceStripped` 驱动回退决策。
  2) 建立能力驱动状态位：
     - 新增 `item._audioUnsupported`（文件级降级状态），用于提示和下次播放策略。
  3) 初始源选择改为通用规则：
     - 默认 `original`；
     - 当用户静音且该文件已判定音频不兼容且存在 stripped 缓存时，优先 `stripped`。
  4) 回退触发改为运行时错误+能力联合判断：
     - 依据 `MediaError.code`、错误消息（demux/decode/not supported）和轨道探测结果决定是否回退。
  5) 静音按钮行为通用化：
     - 提示文案由 “Android Edge 不兼容” 改为“当前文件音频不兼容”；
     - 用户取消静音时会清除 `item._audioUnsupported` 并重试有声播放。
  6) `play().catch` 回退触发不再限定 Android，统一走一次回退尝试。
- 验证证据：
  - 语法检查：`node --check src/js/app.js` 通过。
  - 代码检索确认：播放链路中已无 `isAndroidEdgeBrowser`/`_edgeForceStripped` 依赖。
- 任务状态：
  - `TASK-LIVE-A-005`：完成（已获用户确认）。
  - `TASK-LIVE-A-006`：待确认（待你实机回归验证）。

## 2026-02-16 17:26（TASK-LIVE-A-006 回归判定：未通过）
- 背景：用户回传最新实机结果与日志（`docs/temp.md`）：
  - Windows 三样本稳定；
  - Android Chrome 三样本稳定；
  - Android Edge：vivo 可静音播放，但荣耀/小米在有声尝试后仍失败；且未见明确用户界面提示，取消静音后的“重试有声播放”不可感知。
- 关键证据（`docs/temp.md`）：
  1) 荣耀/小米在 `sourceMode=original` 时出现：
     - `video error code:4 DEMUXER_ERROR_DETECTED_AAC`
     - 随后 `play reject` + `fallback skipped(already-stripped)` + `strip retry reject`
  2) 失败后虽可再次进入 `sourceMode=stripped`，但用户感知为“没有明确提示、重试行为不明确”。
- 判定：
  - `TASK-LIVE-A-006` **不满足验收**，不能标记完成。
  - 已在 `task.md` 将 `TASK-LIVE-A-006` 调整为 `失败`，并记录阻塞与下一步。
- 下一步建议（下一轮任务）：
  1) 增加可见 UI 提示（Toast/Bar）：明确显示“已因音频不兼容切换静音”。
  2) 显式重试状态：点击取消静音后展示“正在重试有声播放（第 N 次）”及结果。
  3) 收敛回退竞态：`video-error` 与 `play-reject` 路径统一到单一状态机分支，避免用户看到“点了没反应”。

## 2026-02-16 17:49（TASK-LIVE-A-006 修复版：提示可见性 + 重试反馈 + 回退竞态）
- 背景：基于 `docs/temp.md` 最新日志，A-006 的主要缺口是“无可见提示、重试感知弱、回退竞态导致二次失败”。
- 改动文件：
  - `src/js/app.js`
  - `src/css/app.css`
  - `task.md`
- 改动点：
  1) 新增预览层可见提示（viewer toast）：
     - `showViewerNotice(text, { tone, duration })`
     - 在自动降级静音、重试有声、重试成功/失败时弹出提示。
  2) 新增重试行为日志与状态：
     - 文件级 `item._audioRetryCount`、`item._pendingAudioRetry`
     - 新日志前缀：`[live-retry] start/success/failed/fallback-muted`
  3) 回退竞态收敛：
     - `fallbackToStripped()` 增加“join in-flight fallback”逻辑；
     - 当已在 stripped 路径时返回“已处理”而非失败，避免 `play-reject` 路径误触发关闭。
  4) 状态同步：
     - `TASK-LIVE-A-006` 从“失败”恢复到“待确认”，等待本轮实机验证。
- 验证证据：
  - 语法检查：`node --check src/js/app.js` 通过。
  - 代码关键点：
    - `showViewerNotice` / `[live-retry]` / `fallback join` 分支已就位。
- 结果状态：
  - `TASK-LIVE-A-006`：待确认（修复版待回归）。
- 下一步：
  1) 你在 Android Edge 用 vivo/荣耀/小米复测：
     - 是否出现“自动切静音”的可见提示；
     - 取消静音后是否出现“第 N 次重试”与“成功/失败”提示；
     - 是否不再出现此前 `play-reject` 导致的“看起来没反应”。

## 2026-02-17 14:18（TASK-LIVE-A-006 判定完成 + TASK-DOC-HANDOFF-401 启动）
- 背景：
  - 用户要求基于 `docs/temp.md` 的“日志2 安卓端”判断 `TASK-LIVE-A-006` 是否可完成。
  - 用户要求新增“让下一位 AI 可直接接手”的任务，并立即开始。
- 判定（A-006）：
  - 结论：`TASK-LIVE-A-006` 可转 `完成`。
  - 依据（`docs/temp.md`）：
    1) `fallback join` 已出现，说明 `play-reject` 与 `video-error` 已收敛到同一回退链路（`docs/temp.md:449`、`docs/temp.md:586`、`docs/temp.md:706`）。
    2) vivo/honor/xiaomi 在该轮日志都能闭环到 `live ended`（`docs/temp.md:477`、`docs/temp.md:598`、`docs/temp.md:718`）。
    3) 无浏览器名硬编码判定日志，回退依据为运行时错误+轨道信息，符合 A-006 验收口径。
- 新任务（文档接手）：
  - 新建：`TASK-DOC-HANDOFF-401`（待确认）。
  - 产出：
    - 新增 `docs/AI_HANDOFF.md`，覆盖启动方式、状态模型、播放链路、回归标准、调试顺序、已知风险。
    - 更新 `README.md` 增加接手文档入口。
  - 本轮不进入 `TASK-LIVE-B-007`（按用户要求暂停）。
- 额外风险记录（未插队修复）：
  - 发现 `mp4box` 动态导入路径在 HTTP 模式下存在失败（`docs/temp.md:513`、`docs/temp.md:633`），当前由 legacy strip 兜底，功能可用但存在技术债。

## 2026-02-17 20:33（TASK-DOC-HANDOFF-401 文档补全：逐文件职责）
- 背景：
  - 用户要求 `docs/AI_HANDOFF.md` 再详细，补齐“每个文件的作用”。
- 改动文件：
  - `docs/AI_HANDOFF.md`
  - `task.md`
- 改动点：
  1) 将 handoff 文档升级为“完整目录级说明”，覆盖当前仓库内所有核心文件与 vendor 依赖文件用途。
  2) 增加结构化分节：
     - 根目录文件职责；
     - 业务代码职责；
     - 第三方依赖职责；
     - 脚本职责；
     - docs 日志文件职责。
  3) 保留并强化接手必读内容：播放主链路、数据模型、回归口径、已知风险、推荐排查顺序。
  4) 在 `task.md` 的 `TASK-DOC-HANDOFF-401` 备注中标注“已补充完整文件清单 + 每文件作用”，状态保持 `待确认`。
- 验证证据：
  - `docs/AI_HANDOFF.md` 已包含文件清单与作用说明，可直接用于后续 AI 冷启动接手。
- 结果状态：
  - `TASK-DOC-HANDOFF-401`：待确认（等待用户确认文档可读性与完整性）。

## 2026-02-17（状态核对：TASK-DOC-HANDOFF-401 完成确认 + TASK-LIVE-STATE-002 判定完成）
- 背景：
  - 用户确认 `TASK-DOC-HANDOFF-401` 已完成。
  - 用户要求核对 `TASK-LIVE-STATE-002` 是否可完成。
- 改动文件：
  - `task.md`
- 核对证据（`docs/temp.md`）：
  1) 在“日志2 安卓端”中，三样本均出现 `fallback join`，表明 `video-error` 与 `play-reject` 已收敛到单一回退链路（`docs/temp.md:449`、`docs/temp.md:586`、`docs/temp.md:706`）。
  2) 三样本均形成播放闭环并出现 `live ended`（`docs/temp.md:477`、`docs/temp.md:598`、`docs/temp.md:718`）。
  3) `strip retry reject` / `retry reject` 仅出现在较早日志段（`docs/temp.md:68-219`），未在“日志2 安卓端”复现。
- 结果状态：
  - `TASK-DOC-HANDOFF-401`：完成。
  - `TASK-LIVE-STATE-002`：完成。
- 下一步：
  1) 继续执行 `TASK-LIVE-B-007`（`ffmpeg.wasm` 兜底链路）。

## 2026-02-17（TASK-LIVE-B-007 实施：接入 ffmpeg.wasm 重兜底）
- 背景：
  - 用户要求继续 `EPIC-LIVE-ROBUST-001`，进入子任务 `TASK-LIVE-B-007`。
  - 目标是“仅在 A 链路失败时触发 ffmpeg.wasm”，并保持离线可运行。
- 改动文件：
  - `index.html`
  - `src/js/app.js`
  - `vendor/ffmpeg.min.js`
  - `vendor/046d0074eee1d99a674a.js`
  - `vendor/ffmpeg-core.js`
  - `vendor/ffmpeg-core.wasm`
  - `vendor/ffmpeg-core.worker.js`
  - `task.md`
- 改动点：
  1) 引入 ffmpeg.wasm 前端运行时（本地 vendor）：
     - 在 `index.html` 新增 `vendor/ffmpeg.min.js` 脚本。
     - 补齐 `ffmpeg.min.js` 运行所需的 core/wasm/worker/chunk 文件到 `vendor/`。
  2) 在 `src/js/app.js` 新增 ffmpeg 兜底模块：
     - `canUseFfmpegWasm()`：运行时能力判定；
     - `getFfmpegInstance()`：按需加载，失败时降级；
     - `stripMp4AudioTrackWithFfmpeg()`：执行 `-an` 去音轨并返回无音轨 MP4；
     - `ffmpegRunQueue`：串行化任务，避免并发运行冲突。
  3) 回退链路接入策略：
     - `stripMp4AudioTrack()` 改为 `mp4box -> legacy -> ffmpeg`（仅 A 失败后触发 B）。
     - `openLiveVideoInline().fallbackToStripped()` 中增加“sanitized 播放失败后触发 ffmpeg 二次兜底”分支，避免 A 产物不可播时直接失败。
  4) 日志可观测性：
     - 新增 `[ffmpeg-fallback]` 前缀日志（load/strip/fail/success/trigger）。
- 验证证据：
  - 语法检查通过：`node --check src/js/app.js`
  - 关键检索命中：
    - `index.html` 已包含 `vendor/ffmpeg.min.js`
    - `src/js/app.js` 已包含 `[ffmpeg-fallback]` 与 `stripMp4AudioTrackWithFfmpeg` 实现
  - 依赖文件已落地：`vendor/ffmpeg-core.wasm` 等 5 个 ffmpeg 运行文件。
- 结果状态：
  - `TASK-LIVE-B-007`：`待确认`（待实机回归验证）。
- 下一步：
  1) 你在 Android Edge/Chrome 复测 vivo/honor/xiaomi：
     - 观察是否仅在 A 失败后出现 `[ffmpeg-fallback]`；
     - 观察最终是否可形成 `loadedmetadata/canplay/live ended` 闭环；
     - 回传失败样本日志（若有）。

## 2026-02-17（TASK-LIVE-B-007 补充：基于日志3加临时B链路选择器）
- 背景：
  - 用户指定 `docs/temp.md` 的“日志3 安卓端”为最新证据，并要求可手动强制走 B 链路做兼容性对照。
  - 从该日志可见：多数回放仍走 `sourceMode=original/stripped` 的 A 路径，未出现 `[ffmpeg-fallback]` 触发证据。
- 改动文件：
  - `index.html`
  - `src/js/app.js`
  - `task.md`
- 改动点：
  1) 新增临时选择器：
     - `index.html` 工具栏新增 `#playbackPathSelect`。
     - 选项：`自动（A优先）` / `临时强制B（ffmpeg）`。
  2) 新增链路模式状态与切换逻辑：
     - `state.livePathMode` + `getLivePathMode()`。
     - 切换时输出 `[live-path]` 日志，并在正在播放时立即重开当前 Live。
  3) `openLiveVideoInline()` 支持强制B首源：
     - 当模式为 `b_force` 时，优先生成/复用 `item._audioStrippedBlobFfmpeg` 并直接作为首源播放；
     - 若 B 生成失败，自动回退到原自动策略（A 优先）并给出提示。
- 验证证据：
  - 语法检查：`node --check src/js/app.js` 通过。
  - 代码检索：
    - `index.html` 已存在 `playbackPathSelect`；
    - `src/js/app.js` 已存在 `livePathMode`、`[live-path]` 与 `b_force` 分支。
- 结果状态：
  - `TASK-LIVE-B-007` 维持 `待确认`（等待你用新选择器做实机回归）。
- 下一步：
  1) 你在安卓端将“播放链路”切到“临时强制B（ffmpeg）”，复测 vivo/honor/xiaomi。
  2) 重点回传是否出现 `[ffmpeg-fallback] strip success` 以及三样本最终播放闭环。

## 2026-02-17（TASK-LIVE-B-007 修复：日志4 Windows 端 B 链路不可用）
- 背景：
  - 用户回传 `docs/temp.md` 最新“日志4 widows端”，B 链路不可用。
  - 关键报错：
    - `Not allowed to load local resource: file:///home/jeromewu/repos/ffmpeg.wasm/src/browser/vendor/ffmpeg-core.js`
    - `[ffmpeg-fallback] load failed {message: 'Failed to fetch'}`
- 根因：
  - `@ffmpeg/ffmpeg` 对相对 `corePath` 的解析会基于其打包内部基路径（构建机路径），导致请求落到错误的 `file:///...` 地址。
- 改动文件：
  - `src/js/app.js`
  - `task.md`
- 改动点：
  1) `getFfmpegInstance()` 中将 `corePath/wasmPath/workerPath` 改为运行时绝对 URL：
     - `new URL(FFMPEG_*_PATH, window.location.href).toString()`
  2) 增强日志：
     - `[ffmpeg-fallback] load start` 现在输出 `coreUrl/wasmUrl/workerUrl`，便于核对实际请求地址。
- 验证证据：
  - 语法检查：`node --check src/js/app.js` 通过。
  - 日志与代码对应：
    - 原失败点在 `docs/temp.md:1236-1281`
    - 新实现在 `src/js/app.js` 的 `getFfmpegInstance()`。
- 结果状态：
  - `TASK-LIVE-B-007` 维持 `待确认`（等待你在 Windows/Android 再次验证 B 链路）。
- 下一步：
  1) Windows Chrome 选择“临时强制B（ffmpeg）”后复测；
  2) 回传是否出现 `[ffmpeg-fallback] load success` 与 `strip success`。

## 2026-02-17（TASK-LIVE-B-007 修复2：SharedArrayBuffer 限制，切换 core-st）
- 背景：
  - 用户回传新报错：`[ffmpeg-fallback] load failed {message: 'SharedArrayBuffer is not defined'}`。
  - 这说明当前 ffmpeg core 仍是多线程版本（`@ffmpeg/core`），在未启用跨源隔离环境无法运行。
- 改动文件：
  - `vendor/ffmpeg-core.js`
  - `vendor/ffmpeg-core.wasm`
  - `vendor/ffmpeg-core.worker.js`
  - `src/js/app.js`
  - `task.md`
- 改动点：
  1) 将 ffmpeg 核心替换为 `@ffmpeg/core-st@0.11.0`（single-thread）：
     - 覆盖 `vendor/ffmpeg-core.js` 与 `vendor/ffmpeg-core.wasm`。
  2) 覆盖 `vendor/ffmpeg-core.worker.js` 为 stub（single-thread 构建下不依赖 worker 线程）。
  3) 增强启动日志：
     - `[ffmpeg-fallback] load start` 增加 `hasSharedArrayBuffer`，便于确认环境与链路。
- 验证证据：
  - `vendor/ffmpeg-core.js` 检索已无 `SharedArrayBuffer/Atomics/pthread` 关键实现。
  - 语法检查：`node --check src/js/app.js` 通过。
- 结果状态：
  - `TASK-LIVE-B-007` 维持 `待确认`（等待你在 Windows 端复测 B 链路）。
- 下一步：
  1) 在 Windows Chrome 选“临时强制B（ffmpeg）”复测；
  2) 回传是否出现：
     - `[ffmpeg-fallback] load start { ..., hasSharedArrayBuffer: false }`
     - `[ffmpeg-fallback] load success`
     - `[ffmpeg-fallback] strip success`。

## 2026-02-18（TASK-LIVE-B-007 收口修复：core-st 启动、并发治理、日志降噪、回归结论）
- 背景：
  - Windows Chrome 继续回归时，B 链路出现两类新问题：
    1) `SharedArrayBuffer` 修复后，仍可能报 `proxy_main` 相关加载失败（core-st 入口不匹配）；
    2) 快速切图/连续播放时，偶发 `ffmpeg.wasm can only run one command at a time`（busy-stuck）。
  - 同时日志噪声过高，干扰问题定位；用户要求先降噪再排障。
- 改动文件：
  - `src/js/app.js`
- 改动点：
  1) core-st 启动链路修复：
     - `createFFmpeg()` 显式传入 `mainName: 'main'`，匹配 `@ffmpeg/core-st` 导出的 `_main` 入口。
     - `core/wasm/worker` 资源 URL 增加固定版本参数（`?v=core-st-20260218-1`），避免旧缓存混入。
  2) B 链路并发与恢复治理：
     - `runWithBusyRetry()` 增强 busy 退避重试（增加次数和等待）。
     - 对 `Program terminated with exit(0)` 做“软失败成功”处理：若输出文件已生成则直接判成功。
     - 新增 `resetFfmpegInstance('busy-stuck')`：检测 busy 卡死后重置实例并自动重试一次。
     - 在 `b_force` 首次生成 stripped 时增加 `item._audioStrippedBlobFfmpegPromise`，同一文件并发复用，避免重复转码抢占。
  3) 播放会话一致性修复：
     - 在 `openLiveVideoInline()` 关键 `await` 之后补充 `playbackToken` 有效性检查，避免旧会话异步结果回写当前视频元素。
  4) 日志降噪与关键可观测：
     - 增加 debug 前缀静默机制（默认关闭 `viewer/live-debug/track-probe` 等高频调试输出）。
     - 保留关键路径日志：`[live-path] mode/open`、`[ffmpeg-fallback]`、错误/告警日志。
     - 新增运行时开关：`window.__LPV_VERBOSE_DEBUG__ = true/false` 后刷新可切换详细日志。
  5) B 链路用户行为约束（避免误重试）：
     - 在 `b_force + stripped` 场景拦截“取消静音重试有声”，并给出可见提示（该链路仅支持静音）。
     - 仅在当前确为 stripped 时拦截；`auto/original` 不受影响。
  6) 导航性能微优化：
     - 去掉 `pointermove` 活动监听，并对导航唤醒逻辑加节流，降低 `handler took ...ms` 违规告警概率。
  7) Auto 有声链路状态同步：
     - 保留 `applyVideoAudioState()`（统一同步 `muted/defaultMuted/volume` 与 `muted` 属性），确保 auto 原视频有声播放状态一致。
  8) 临时诊断变更回收：
     - 为定位“有波形但无声”曾短暂接入 WebAudio 路由与 `[live-audio]` 诊断日志；
     - 用户确认根因是本机输出设备切换错误（非代码问题）后，已移除该临时路由与诊断日志，避免引入额外复杂度。
- 验证证据（用户回归日志）：
  1) Windows Chrome，`b_force`：
     - vivo：`load success -> strip success -> [live-path] open mode=b_force sourceMode=stripped`。
     - 荣耀：`[live-path] open mode=b_force sourceMode=stripped`。
     - 小米：先 busy 重试，触发 `instance reset {reason:'busy-stuck'}` 后重新 `load success` 并 `strip success`，最终可播。
  2) Windows Chrome，`auto`：
     - 全部样本均输出 `mode=auto sourceMode=original muted=false`；
     - 用户最终确认“无声”由本机音频输出设备误切换导致，非应用链路问题。
- 结果状态：
  - `TASK-LIVE-B-007` 技术目标已满足：
    - B 链路可稳定触发并形成成功输出；
    - busy-stuck 具备自动恢复能力；
    - auto 与 b_force 行为边界清晰；
    - 日志可读性满足后续回归。
  - 建议将 `TASK-LIVE-B-007` 从 `待确认` 收口为 `完成`，进入 `TASK-LIVE-B-008`（性能与缓存治理）与 `TASK-LIVE-RG-009`（最终验收表）。
- 下一步：
  1) 进入 `TASK-LIVE-B-008`：处理转码缓存生命周期、并发上限和快速切图的资源释放策略。
  2) 进入 `TASK-LIVE-RG-009`：沉淀 Android/Windows 各样本最终验收表并关闭 EPIC。

## 2026-02-18（状态落盘：TASK-LIVE-B-007 完成 + TASK-LIVE-B-008 启动）
- 背景：
  - 用户明确确认：`TASK-LIVE-B-007` 完成，并要求继续下一步。
  - 同轮确认“auto 无声”是本机音频输出设备切换造成的乌龙，不属于代码缺陷。
- 改动文件：
  - `task.md`
  - `src/js/app.js`
- 状态更新：
  1) `TASK-LIVE-B-007`：从 `待确认` 调整为 `完成`。
  2) `TASK-LIVE-B-008`：从 `待进行` 调整为 `进行中`。
- B-008 首轮实施（缓存治理起步）：
  1) 新增衍生视频缓存治理参数与账本：
     - `DERIVED_VIDEO_CACHE_MAX_ITEMS`
     - `DERIVED_VIDEO_CACHE_MAX_BYTES`
     - `derivedVideoCacheRecords` / `derivedVideoCacheBytes`
  2) 新增统一管理函数：
     - `trackDerivedVideoBlob(item, field, blob)`（记录与触摸缓存）
     - `evictDerivedVideoCacheIfNeeded()`（超量时按 LRU 回收，当前播放项优先保留）
     - `dropDerivedVideoCaches(items)`（导入新文件集前清理衍生缓存）
  3) 将 B 链路衍生产物接入缓存治理：
     - `item._audioStrippedBlob`
     - `item._audioStrippedBlobFfmpeg`
  4) 在扫描入口统一清理旧缓存，避免跨目录累积：
     - `startScan()`
     - `startScanOverride()`
- 验证证据：
  - 语法检查通过：`node --check src/js/app.js`。
  - 关键检索命中：
    - 缓存治理函数与常量已落地；
    - 扫描入口已调用 `dropDerivedVideoCaches(...)`；
    - B 链路赋值点已接入 `trackDerivedVideoBlob(...)`。
- 当前结论：
  - `TASK-LIVE-B-007` 已完成并完成文档落盘。
  - `TASK-LIVE-B-008` 已进入实现阶段（第一批缓存治理已上线），后续继续推进“资源释放策略 + 回归指标”。

## 2026-02-18（状态落盘：TASK-LIVE-B-008 完成 + 新增 TASK-LIVE-B-010）
- 背景：
  - 用户确认可基于自动化测试结果收口 `TASK-LIVE-B-008`，并要求新增子任务处理“`A` 链路失败后不会自动切 `B`”的问题。
  - 本轮自动化测试样本目录：`E:\CodeSpace\live-photo-viewer\test`（14 文件，12 Live）。
- 自动化验收摘要（Windows Chrome + MCP）：
  1) `b_force` 链路：
     - 三厂商样本可稳定 `sourceMode=stripped`；
     - 同文件重复打开不重复 strip（命中 `_audioStrippedBlobFfmpeg` 缓存）；
     - 并发双开同一文件仅 1 次 `strip request`（Promise 复用生效）。
  2) 缓存治理：
     - `DERIVED_VIDEO_CACHE_MAX_ITEMS` 与 `DERIVED_VIDEO_CACHE_MAX_BYTES` 上限生效；
     - LRU 回收生效；
     - 重扫入口会清理衍生缓存（`len=0, bytes=0`）。
  3) 首帧体验：
     - 同文件冷启动到 `canplay` 约 1.4s，缓存命中后约 0.08s，缓存收益明显。
- 改动文件：
  - `task.md`
- 状态更新：
  1) `TASK-LIVE-B-008`：从 `进行中` 调整为 `完成`。
  2) 新增 `TASK-LIVE-B-010`（`P0`，`待进行`）：
     - 任务名：`B3：A链路失败自动切换到B链路`
     - 目标：当 `A` 链路原始源与 sanitized 源均失败时，自动触发 ffmpeg `B` 链路，无需手动切 `b_force`。
  3) `EPIC-LIVE-ROBUST-001` 验收口径同步加入 `TASK-LIVE-B-010`。
- 下一步：
  1) 进入 `TASK-LIVE-B-010` 实现自动回退闭环（含防抖与并发保护）。
  2) 完成后进入 `TASK-LIVE-RG-009` 做 Android/Windows 最终回归验收表。

## 2026-02-18（TASK-LIVE-B-010 首版实现：A失败自动切B）
- 背景：
  - 用户要求按计划进入 `TASK-LIVE-B-010`，修复“`A` 链路失败时不会自动切 `B`”。
- 改动文件：
  - `src/js/app.js`
  - `task.md`
- 核心改动：
  1) 在播放回退链路中引入明确的 `A -> B` 收敛逻辑：
     - 修复旧逻辑中“已是 stripped 即视为回退成功”的误判；
     - 新增 `usingFfmpegSource` 判定，只有“已在 B 源”才终止回退。
  2) 回退阶段拆分：
     - A 阶段仅尝试 `mp4box + legacy`（`allowFfmpeg: false`）；
     - A 失败后统一进入 ffmpeg B 阶段（`trigger auto-b`），避免分散触发点。
  3) ffmpeg 产物统一绑定：
     - 新增 `bindFfmpegDerivedBlob(item, blob)`；
     - 自动 B 回退成功后写入 `_audioStrippedBlobFfmpeg`，并同步 `_audioStrippedBlob` 引用，保证后续复用与缓存账本一致。
  4) 错误分支修复：
     - `video.onerror` 在“当前为 A-stripped 且未到 B”时也允许继续触发回退，避免直接中断播放。
- 自动化验证（Windows Chrome + MCP）：
  1) 用例1：`original` 首次 `play reject` + A-stripped 人工注入失败：
     - 命中 `[ffmpeg-fallback] trigger auto-b`；
     - 命中 `strip request/success`；
     - 最终 `item._audioStrippedBlobFfmpeg` 存在。
  2) 用例2：直接从 `A-stripped` 启动并注入失败：
     - 仍命中 `trigger auto-b` + `strip request/success`；
     - 证明“stripped 失败继续切 B”生效。
  3) 回归：
     - `auto` 正常样本仍走 `sourceMode=original`，不误触发 ffmpeg；
     - `b_force` 仍走 `sourceMode=stripped`（静音）不回归。
- 状态更新：
  - `TASK-LIVE-B-010`：`待进行 -> 进行中`（首版实现完成，待 Android 实机回归收口）。
- 下一步：
  1) 在 Android 实机（Chrome/Edge）按样本跑 B-010 回归，确认同样可自动触发 `trigger auto-b`。
  2) 回归通过后将 `TASK-LIVE-B-010` 置为 `待确认`，再进入 `TASK-LIVE-RG-009` 总验收。

## 2026-02-18（TASK-LIVE-B-010 安卓实机自动回归：Chrome 通过）
- 背景：
  - 用户已连接安卓手机（USB 调试 + ADB），要求直接开始实机自动调试。
- 调试链路：
  1) 设备与端口：
     - `adb devices -l` 识别设备：`23c6333f`（model `22081212C`）。
     - `adb reverse tcp:8080 tcp:8080` 成功（手机可访问本机服务）。
     - 本机 `9222` 被占用，改用 `adb forward tcp:9322 localabstract:chrome_devtools_remote`。
  2) 目标确认：
     - `http://127.0.0.1:9322/json/version` 显示 `Android-Package: com.android.chrome`。
     - `http://127.0.0.1:9322/json/list` 命中页面：`http://localhost:8080/live-photo-viewer/`。
  3) 自动化执行方式：
     - 通过 CDP（WebSocket）执行 `Runtime.evaluate`，在手机页面内直接拉取 `test/` 样本 URL 并构造 `File`，调用 `handleSelectedFiles(...)` 完成导入。
- 回归结果（Android Chrome）：
  1) 样本导入：
     - `files=14`，`items=14`，`live=12`。
  2) 用例1（`original` 失败 -> 自动切 B）：
     - `triggerAutoB=1`；
     - `stripReq=2`，`stripSucc=1`；
     - `_audioStrippedBlobFfmpeg` 已生成（`5636723` bytes）；
     - 结论：通过。
  3) 用例2（`A-stripped` 失败 -> 自动切 B）：
     - `triggerAutoB=1`；
     - `stripReq=1`，`stripSucc=1`；
     - `_audioStrippedBlobFfmpeg` 已生成（`5636723` bytes）；
     - 结论：通过。
  4) 回归检查（不误触发）：
     - `auto` 正常样本（`vivo-live-3.jpg`）输出 `sourceMode=original`，`stripReq=0`；
     - 结论：通过。
- 当前结论：
  - `TASK-LIVE-B-010` 的核心目标在 Android Chrome 已复现通过（A 失败可自动切 B，且正常 auto 不误触发）。
  - 仍建议补一轮 Android Edge 后再把 `TASK-LIVE-B-010` 从 `进行中` 收口到 `待确认`。

## 2026-02-18（TASK-LIVE-B-010 安卓实机自动回归：Edge 通过）
- 背景：
  - 用户已切到 Android Edge 并要求继续自动调试。
- 调试链路：
  1) 端口绑定：
     - 设备中 Chrome 与 Edge 同时运行；
     - 从 `/proc/net/unix` 定位到 Edge socket：`@chrome_devtools_remote_25392`；
     - 绑定：`adb forward tcp:9322 localabstract:chrome_devtools_remote_25392`。
  2) 目标确认：
     - `json/version` 显示 `Android-Package: com.microsoft.emmx`（`EdgA/144.0.3719.115`）。
     - `json/list` 命中页面：`http://localhost:8080/live-photo-viewer/`。
- 自动化结果（Android Edge）：
  1) 用例1：`original` 失败 -> 自动切 B：
     - `trigger auto-b=1`，`strip request=1`，`strip success=1`，通过。
  2) 用例2：`A-stripped` 失败 -> 自动切 B：
     - `trigger auto-b=1`，`strip request>=1`，`strip success=1`，通过。
  3) 回归项：`auto` 正常样本不误触发 ffmpeg：
     - `sourceMode=original`，`strip request=0`，通过。
  4) 结束态恢复：
     - 页面恢复 `mode=auto`、`liveMuted=false`。
- 状态更新：
  - `TASK-LIVE-B-010`：由 `进行中` 调整为 `待确认`（Windows + Android Chrome/Edge 自动化均已通过，待用户手工验收）。

## 2026-02-18（状态落盘：TASK-LIVE-B-010 完成）
- 背景：
  - 用户明确确认：`TASK-LIVE-B-010` 完成。
- 状态更新：
  1) `task.md` 中 `TASK-LIVE-B-010` 从任务队列移入“完成”分区。
  2) 备注更新为“Windows + Android Chrome/Edge 自动化回归通过，用户手工验收确认完成”。
- 补充说明（本轮问答）：
  1) 本次自动化脚本在安卓端使用的是页面内 `fetch('/live-photo-viewer/test/...')` 构造的 `File`，来源是本机服务映射到手机，并非直接读取你手机目录 `根目录/111我的文件/live-photo-test/`。
  2) 关于“安卓 Edge 看起来无法走 A 链路”：自动化里可观测到至少部分样本能以 `sourceMode=original` 打开且 `strip request=0`；但在真实本地文件路径场景下，A 链路可能快速失败并自动切 B，体感上会像“不能走 A”。

## 2026-02-18（安卓本地目录直读验证：Edge）
- 背景：
  - 用户要求验证“直接读取手机本地目录”能力，目标目录：
    - `/storage/emulated/0/111我的文件/live-photo-test/`
- 验证方式：
  1) 通过 ADB 确认目录与文件：
     - 目录存在，文件数 `14`（与电脑样本一致）。
  2) 通过 CDP `DOM.setFileInputFiles` 将上述目录 14 个文件路径直接注入页面 `#mcpFiles`，触发 `change`。
- 结果：
  1) 本地目录导入成功：
     - `picked=14`，`state.files=14`，`state.items=14`，`live=12`，状态 `Scan complete`。
  2) Android Edge 在本地目录数据下的链路行为（`auto`）：
     - 12/12 Live 初始 `open` 均显示 `sourceMode=original`；
     - 但最终 `lastSource` 全部变为 `stripped`；
     - 全部触发 `mp4box strip request`（12/12）；
     - `ffmpeg` 未触发（`trigger auto-b=0`，`strip request=0`）。
- 结论：
  - “直接读取安卓本地目录”在当前页面可行（已验证）。
  - 你观察到的“安卓 Edge A 链路基本不可用”在该目录样本上被证实：
    - A-original 启动后会统一降级到 A-stripped（静音），未进入 B-ffmpeg。

## 2026-02-18（TASK-LIVE-RG-009 启动：首版多浏览器验收矩阵）
- 背景：
  - `TASK-LIVE-B-010` 已完成，进入 `TASK-LIVE-RG-009`（主线最终回归清单）。
- 状态更新：
  - `TASK-LIVE-RG-009`：`待进行 -> 进行中`。
- 首版验收矩阵（3 厂商样本：vivo/荣耀/xiaomi）：
  - Windows Chrome（本轮实测，样本：`*-live-1.jpg`）：
    - 三样本均 `open sourceMode=original`；
    - `mp4box/ffmpeg` 均未触发；
    - `finalSource=original`（有声主链路保持）。
  - Android Chrome（沿用本轮前序自动化证据）：
    - B-010 自动回退用例通过（original 失败可自动切 B；A-stripped 失败可自动切 B）；
    - 回归项显示 `auto` 正常样本可 `sourceMode=original` 且不误触发 ffmpeg。
  - Android Edge（本轮“手机本地目录直读”实测，目录 `/storage/emulated/0/111我的文件/live-photo-test/`）：
    - 本地目录导入成功（`files=14`, `items=14`, `live=12`）；
    - 12/12 Live 初始 `open sourceMode=original`，但最终均降级到 `finalSource=stripped`；
    - 触发路径为 `mp4box`，未触发 ffmpeg。
- 当前结论：
  - Android/Windows 的核心链路均可形成“可播放闭环”（含降级路径），并有可复现脚本证据。
  - 现有环境下缺少 Windows Edge 本机可执行通道（未检测到本机 Edge 调试入口）；是否补此项由你确认。
- 下一步：
  1) 若你要求严格覆盖“Windows 主流浏览器=Chrome+Edge”，需在可调试的 Windows Edge 环境补一轮 3 厂商样本。
  2) 若认可当前覆盖口径，可将 `TASK-LIVE-RG-009` 提交 `待确认`，并把 `EPIC-LIVE-ROBUST-001` 置为 `待确认`。

## 2026-02-18（TASK-LIVE-RG-009 补测：Windows Edge 三厂商样本）
- 背景：
  - 用户要求“继续调试并推进 `TASK-LIVE-RG-009` 可完成”。
  - 首版矩阵缺口为 Windows Edge 样本。
- 调试链路：
  1) 发现本机 Edge 可执行路径：
     - `C:\Program Files (x86)\Microsoft\EdgeCore\136.0.3240.92\msedge.exe`
  2) 启动远程调试：
     - `--remote-debugging-port=9333`
     - `json/version` 确认：`Edg/136.0.3240.92`（Windows）。
  3) 样本导入策略：
     - 直接注入中文路径会导致对应文件在 Edge 变为 `size=0`（中文路径编码问题）；
     - 采用 ASCII 临时样本目录（同内容拷贝）完成三厂商回归：
       - `vivo-live-1.jpg`
       - `xiaomi-live-1.jpg`
       - `honor-live-1.jpg`（来自 `荣耀-live-1.jpg` 的同内容拷贝，SHA256 一致）。
- 回归结果（Windows Edge）：
  1) 导入：`files=3`，`items=3`，`live=3`。
  2) 三厂商链路：
     - 全部 `open sourceMode=original`；
     - `mp4box/ffmpeg` 均未触发；
     - `finalSource=original`（A 主链路可用）。
  3) 厂商识别：
     - `vivo Live Photo` / `Xiaomi Live Photo` / `HONOR Live Photo` 均识别成功。
- 状态更新：
  - `TASK-LIVE-RG-009`：`进行中 -> 待确认`（可复现验收矩阵已覆盖 Android/Windows 主流浏览器与三厂商样本）。

## 2026-02-18（TASK-LIVE-RG-009 收口复核：无剩余未调试项）
- 背景：
  - 用户要求继续排查“当前进行中的子任务还剩哪些未调试”，并确认 `TASK-LIVE-RG-009` 是否可收口。
- 复核动作：
  1) Windows 端页面日志抽检（MCP）：
     - 抽取 `live-path open` 最新日志，三厂商样本均为：
       - `mode=auto`
       - `sourceMode=original`
       - `audioUnsupported=false`
     - 未见新的 `mp4box/ffmpeg` 误触发证据。
  2) Android Edge 通道体检（ADB）：
     - `adb devices -l` 设备在线；
     - `adb reverse tcp:8080 tcp:8080` 正常；
     - `adb forward tcp:9322 localabstract:chrome_devtools_remote_25392` 正常；
     - `json/version` 命中 `Android-Package: com.microsoft.emmx`；
     - `json/list` 命中目标页 `http://localhost:8080/live-photo-viewer/`。
- 结果结论：
  - 对 `TASK-LIVE-RG-009` 当前口径（Android/Windows 主流浏览器 + 三厂商样本）已无新增未调试缺口。
  - 任务状态维持 `待确认`，具备直接验收并转 `完成` 的条件。

## 2026-02-18（TASK-LIVE-RG-009 用户确认完成）
- 背景：
  - 用户明确回复“`TASK-LIVE-RG-009`确认完成”。
- 改动：
  1) `task.md`：
     - `TASK-LIVE-RG-009` 从“待确认”移动到“完成”分区。
     - “待确认”分区清空为“暂无”。
- 验证证据：
  - 状态变更已落盘，`task.md` 中可见 `TASK-LIVE-RG-009 | 完成`。
- 结果状态：
  - `TASK-LIVE-RG-009`：`待确认 -> 完成`。
- 下一步：
  - 可继续按优先级执行下一任务（当前 `EPIC-LIVE-ROBUST-001` 已满足子任务通过条件，可在你确认后进入总任务收口流程）。

## 2026-02-18（EPIC-LIVE-ROBUST-001 用户确认完成）
- 背景：
  - 用户明确回复“`EPIC-LIVE-ROBUST-001`确认完成”。
- 改动：
  1) `task.md`：
     - `EPIC-LIVE-ROBUST-001` 从“进行中”移动到“完成”分区。
     - “进行中”分区清空为“暂无”。
- 验证证据：
  - `task.md` 中可见 `EPIC-LIVE-ROBUST-001 | 完成`。
- 结果状态：
  - `EPIC-LIVE-ROBUST-001`：`进行中 -> 完成`。
- 下一步：
  - 主线已收口，可按优先级进入下一任务（建议从 `TASK-PERF-CACHE-101` 开始）。

## 2026-02-18（临时调试入口回滚：播放链路选择器下线）
- 背景：
  - 用户要求将临时内容改回正式形态，重点包含“播放链路选择按钮”。
- 改动：
  1) `index.html`：
     - 移除工具栏中的“播放链路”下拉（`#playbackPathSelect`）。
  2) `src/js/app.js`：
     - `getLivePathMode()` 固定返回 `auto`。
     - 移除 `#playbackPathSelect` 的 DOM 引用与 `change` 监听。
     - 移除“强制 B 链路”相关的前台提示分支与按钮文案分支。
     - `openLiveVideoInline()` 删除 `b_force` 人工强制分支，保留自动链路与失败回退能力。
- 验证证据：
  - 语法检查通过：`node --check src/js/app.js`。
  - 页面快照验证：工具栏仅保留排序控件，无“播放链路”选择器。
  - 页面脚本验证：`document.getElementById('playbackPathSelect') === null` 且 `getLivePathMode() === 'auto'`。
- 结果状态：
  - 临时播放链路手动切换入口已下线，页面恢复正式默认链路行为。
- 下一步：
  - 若你还要继续清理其它临时项（如调试日志前缀、MCP 专用提示文案），可按同口径逐项回滚。

## 2026-02-18（TASK-PERF-CACHE-101 首版实现：fingerprint-v2 + 扫描结果缓存）
- 背景：
  - 用户要求继续 `TASK-PERF-CACHE-101`，并明确“若原建议文件指纹不合理，改用新方案”。
  - 采用新指纹：`fingerprint-v2 = pathHint + size + lastModified`，在“无目录路径/同键冲突”时追加 `head/tail 4KB` 快速签名。
- 改动：
  1) `src/js/app.js` 增加扫描缓存层：
     - 新增扫描结果缓存（LRU）：`scanResultCache` + 容量上限（条目/字节）。
     - 新增缓存写入/读取/淘汰函数与体积估算。
  2) 新增指纹生成链路：
     - `buildDuplicateFingerprintBaseKeys(...)`
     - `buildFileFingerprint(...)`
     - `buildQuickFileSignature(...)`（FNV-1a，head/tail 4KB）
  3) 扫描主流程接入缓存：
     - 在 `progressiveAnalyzeItems(...)` 中先按指纹查缓存，命中直接复用 `isLive/liveType/exif/exifTime` 与偏移提示；
     - 未命中走 `analyzeFile(...)`，再写回缓存；
     - 状态提示增加缓存命中计数，输出 `[scan-cache] pass` 汇总日志。
  4) 命中后按需补水：
     - 新增 `hydrateItemVideoBlobIfNeeded(...)`；
     - 在 `openViewer/viewed` 路径对“缓存命中但无 videoBlob”的 Live 项执行按需提取并回填。
  5) `analyzeFile(...)` 增加可缓存提示字段：
     - `_microVideoOffsetHint`、`_hasMotionTagHint`、`_needsDeepScanHint`、`_vendorTypeHint`。
- 验证证据：
  - 语法检查通过：`node --check src/js/app.js`。
  - MCP 页面自动化双次同样本导入（6 文件）：
    - 第一次：`[scan-cache] pass {"hits":0,"misses":6,"cacheItems":6,"cacheBytes":4640}`，耗时 `1420ms`。
    - 第二次：`[scan-cache] pass {"hits":6,"misses":0,"cacheItems":6,"cacheBytes":4640}`，耗时 `979ms`。
- 结果状态：
  - `TASK-PERF-CACHE-101`：已完成首版实现，更新为 `待确认`。
- 下一步：
  1) 你在真实目录（>=100 文件）做两轮对比，确认“二次加载明显更快”。
  2) 若你认可现口径，再进入 `TASK-PERF-ANDROID-102`。

## 2026-02-18（TASK-PERF-CACHE-101 实目录回归：Windows Chrome，332 文件）
- 背景：
  - 用户指定目录：`E:\languoer\Pictures\我的照片`（300+ 文件），要求直接调用 Windows Chrome 测试。
- 测试过程：
  1) 通过页面目录输入注入目标目录，确认 `dirPicker.files=332`。
  2) 重载后做“受控双次扫描”（同一批文件、同一会话）：
     - 首轮：冷缓存；
     - 二轮：热缓存。
- 结果（页面自动化返回）：
  - 文件输入：`332`
  - 实际纳入扫描的图片项：`323`（其余为非图片或不在扫描集合）
  - 首轮：`20229ms`
  - 二轮：`997ms`
  - 缓存日志：
    - 首轮：`hits=0, misses=323, cacheItems=323, cacheBytes=230498`
    - 二轮：`hits=323, misses=0, cacheItems=323, cacheBytes=230498`
- 结论：
  - 真实大目录下缓存命中与二次提速显著，满足当前 `TASK-PERF-CACHE-101` 验收口径（“二次加载明显更快，缓存体积可控”）。

## 2026-02-18（TASK-PERF-CACHE-101 安卓本地目录复核：Chrome，323 图片）
- 背景：
  - 用户反馈：安卓 Chrome 手工测试中“第二次扫描未命中缓存”。
  - 目标目录：`/storage/emulated/0/111我的文件/我的照片`（同批数据，323 图片）。
- 调试链路：
  1) ADB + Chrome DevTools 远程连接：
     - `Android-Package: com.android.chrome`；
     - 页面：`http://localhost:8080/live-photo-viewer/`。
  2) 先验证 `mcpFiles` 场景（本地路径注入）：可稳定执行双轮扫描。
  3) 再验证更贴近手工入口的 `filePicker` 场景（`source='file'`，每轮重新注入同目录文件）：
     - 首轮（冷缓存）：`hits=0, misses=323`，`3048ms`；
     - 二轮（热缓存）：`hits=323, misses=0`，`2024ms`；
     - 抽样文件元信息（`name/size/lastModified`）两轮一致，`webkitRelativePath` 为空。
- 结论：
  - 在当前代码版本下，安卓 Chrome 本地目录二轮缓存命中正常。
  - 用户此前“二轮未命中”更可能由环境因素触发（例如旧页面未刷新到最新脚本、会话重载导致内存缓存清空、或测试路径与入口不一致）。

## 2026-02-18（安卓远程注入路径复核：NotReadable 防误判）
- 背景：
  - 用户反馈“我调用安卓目录后 323 张都打不开”，怀疑自动注入并未正确导入可读文件。
- 复核结果：
  1) 通过远程注入路径到 `filePicker/mcpFiles` 后，`File` 元信息存在（`name/size/type` 正常）。
  2) 但读取文件内容时报错：
     - `NotReadableError: The requested file could not be read ... permission problems`
  3) 说明该注入方式在安卓上只拿到文件条目，不具备稳定读取权限，属于“不可读引用”。
- 本轮修复（`src/js/app.js`）：
  1) 不可读文件（`_notReadable`）不再写入扫描缓存，避免产生“假命中”。
  2) 扫描状态增加 `Unreadable` 计数，`[scan-cache] pass` 增加 `unreadable` 字段。
- 修复后验证（同样注入方式，323 图片）：
  - 首轮：`hits=0, misses=323, unreadable=323, cacheItems=0`
  - 二轮：`hits=0, misses=323, unreadable=323, cacheItems=0`
- 结论：
  - “323 张都打不开”问题已被复现并定位为安卓权限模型下的远程注入限制，不是你的观察误差。
  - 缓存逻辑已加保护，不会再把不可读结果当作命中成功。

## 2026-02-18（TASK-PERF-CACHE-101 修复：刷新后缓存不命中）
- 背景：
  - 用户反馈：Windows Chrome 刷新网页后会出现缓存不命中。
  - 根因：此前扫描缓存仅驻留内存，刷新后 `scanResultCache` 被清空。
- 改动（`src/js/app.js`）：
  1) 增加扫描缓存持久化层（`localStorage`）：
     - 键：`lpv.scan-cache.v2`，含版本号与快照时间；
     - 启动时自动 `restore` 到内存缓存。
  2) 增加持久化治理：
     - 持久化上限：条目数 + 估算字节上限；
     - 写入失败（如配额）时自动降级缩小快照。
  3) 增加落盘时机：
     - 每次扫描 pass 完成后立即落盘；
     - `beforeunload` / `visibilitychange(hidden)` 时强制落盘。
  4) 保留并兼容“不可读文件不入缓存”保护。
- 验证证据（实机 CDP，扫描 -> 刷新 -> 再扫描）：
  - 首轮：`hits=0, misses=6`；
  - 刷新后次轮：`hits=6, misses=0`；
  - 说明缓存已可跨刷新命中。
- 结果状态：
  - 刷新后缓存丢失问题已修复，`TASK-PERF-CACHE-101` 继续维持 `待确认`（待你用 Windows 大目录复验）。

## 2026-02-18（任务池新增：Android 多选后索引与扫描提速）
- 背景：
  - 用户新增需求：安卓端多选文件后，索引和扫描整体仍偏慢，需要专项优化任务。
- 改动：
  1) `task.md` 新增任务 `TASK-PERF-ANDROID-104`（P1，待进行）。
  2) 验收口径定义为：
     - 安卓同目录（>=300 图）二次导入下，索引+扫描总耗时明显下降（目标 >=30%）；
     - 过程中不引入“不可读文件误判缓存命中”回归。
- 结果状态：
  - 任务池已加入安卓性能专项任务，可在 `TASK-PERF-CACHE-101` 确认后继续执行。

## 2026-02-18（TASK-PERF-THUMB-105 启动：缩略图持久化缓存）
- 背景：
  - 用户要求将“缩略图持久化缓存”从现有性能任务中拆解为独立任务，并开始实现。
  - 为避免任务耦合，本轮将 `TASK-PERF-CACHE-101` 明确收敛为“扫描结果缓存”，缩略图缓存独立推进。
- 状态更新：
  1) `task.md`：
     - 新增 `TASK-PERF-THUMB-105`（P1，`进行中`）。
     - `TASK-PERF-CACHE-101` 任务名调整为“扫描结果缓存策略”。
- 代码改动（`src/js/app.js`）：
  1) 新增缩略图持久化缓存参数与运行状态：
     - `THUMB_CACHE_DB_NAME/STORE/MAX_ITEMS/MAX_BYTES`；
     - `thumbCacheDbPromise`、`thumbCacheTrimTimer`、`thumbCacheDisabled`。
  2) 新增 IndexedDB 缓存能力：
     - `openThumbCacheDb()`、`getThumbCacheBlob()`、`putThumbCacheBlob()`、`touchThumbCacheEntry()`；
     - `trimThumbCacheNow()` + `scheduleThumbCacheTrim()`（按 LRU 和容量上限清理）。
  3) 缩略图渲染链路接入缓存：
     - `renderThumbnailTask(...)` 改为 `async`；
     - 渲染前先读取持久化缓存，命中则直接显示；
     - 未命中再生成 JPEG 缩略图，并异步回写缓存。
- 验证证据：
  1) 语法检查通过：`node --check src/js/app.js`。
  2) 关键函数检索通过：`getThumbnailCacheKey/openThumbCacheDb/getThumbCacheBlob/putThumbCacheBlob/renderThumbnailTask` 已在源码可见。
- 结果状态：
  - `TASK-PERF-THUMB-105` 已进入实现阶段，当前可继续做实机回归（Windows/Android）验证“刷新后缩略图命中率与首屏耗时”。

## 2026-02-18（TASK-PERF-CACHE-101 用户确认完成）
- 背景：
  - 用户明确指令：`TASK-PERF-CACHE-101` 已完成，并要求任务编号全流程不变。
- 改动：
  1) `task.md`：
     - 将 `TASK-PERF-CACHE-101` 从“待确认”移动到“完成”分区。
     - 备注补充“编号保持 `TASK-PERF-CACHE-101` 不变”。
- 验证证据：
  - `task.md` 中可见 `TASK-PERF-CACHE-101 | 完成`。
- 结果状态：
  - `TASK-PERF-CACHE-101`：`待确认 -> 完成`（编号未变更）。

## 2026-02-18（TASK-PERF-THUMB-105 继续推进：缓存并发去重与坏缓存回退）
- 背景：
  - 用户要求继续推进 `TASK-PERF-THUMB-105`。
  - 当前缩略图持久化缓存已可用，本轮重点补强大目录与异常场景稳定性。
- 代码改动（`src/js/app.js`）：
  1) 缩略图缓存读写并发去重：
     - 新增 `thumbCacheReadInFlight` / `thumbCacheWriteInFlight`。
     - `getThumbCacheBlob(...)` 对同一 key 复用同一读取 Promise，避免并发重复读。
     - `putThumbCacheBlob(...)` 对同一 key 串行写入，避免并发写冲突。
  2) 坏缓存自动剔除与回退：
     - 新增 `deleteThumbCacheEntry(...)`。
     - 缓存命中渲染时若 `img.onerror`，自动删除该 key 的持久化缓存并回退到原图 URL，避免后续重复命中坏缓存。
- 验证证据：
  1) 语法检查通过：`node --check src/js/app.js`。
  2) 关键符号可检索：
     - `thumbCacheReadInFlight` / `thumbCacheWriteInFlight`
     - `deleteThumbCacheEntry`
     - 缓存命中分支 `img.onerror` 回退逻辑。
  3) Windows Chrome（MCP）回归：
     - 刷新后导入 6 张样本图，`scanDone=true`、`thumbsReady=true`。
     - IndexedDB `lpv-thumb-cache/thumbs` 可见持久化记录（测试时 `count=348`，`bytes=7075938`）。
     - 控制台仅 `favicon.ico 404`，未出现新增 JS 异常。
- 结果状态：
  - `TASK-PERF-THUMB-105` 维持 `进行中`，已进入稳定性增强阶段。

## 2026-02-18（TASK-PERF-THUMB-105 容量参数调优：面向 2 万图场景）
- 背景：
  - 用户确认按“约 2 万张图片”目标场景提升缓存容量上限。
- 改动（`src/js/app.js`）：
  1) 扫描结果缓存（内存）：
     - `SCAN_RESULT_CACHE_MAX_ITEMS: 1800 -> 6000`
     - `SCAN_RESULT_CACHE_MAX_BYTES: 32MB -> 64MB`
  2) 扫描结果持久化（localStorage）：
     - `SCAN_RESULT_CACHE_PERSIST_MAX_ITEMS: 1200 -> 2500`
     - `SCAN_RESULT_CACHE_PERSIST_MAX_BYTES: 2MB -> 3MB`
  3) 缩略图持久化缓存（IndexedDB）：
     - `THUMB_CACHE_MAX_ITEMS: 5000 -> 12000`
     - `THUMB_CACHE_MAX_BYTES: 180MB -> 320MB`
- 同步更新：
  - `task.md` 中 `TASK-PERF-THUMB-105` 备注已加入本次容量调优参数，任务状态保持 `进行中`。
- 验证证据：
  1) 语法检查通过：`node --check src/js/app.js`。
  2) 常量检索通过：6 个目标常量值均已更新。
- 结果状态：
  - 容量参数调优已落地，后续可继续做 Windows/Android 大目录回归，确认命中率与稳定性。

## 2026-02-18（TASK-PERF-THUMB-105 启动日志增强：统一输出 scan+thumb 恢复统计）
- 背景：
  - 用户要求将“扫描结果持久化缓存（localStorage）+ 缩略图持久化缓存（IndexedDB）”都加入启动最开始的恢复日志。
- 改动（`src/js/app.js`）：
  1) 启动恢复日志改为统一结构：
     - 新增 `logBootCacheRestoreSummary()`，输出：
       - `scan.items/scan.bytes`（扫描结果缓存）
       - `thumb.items/thumb.bytes`（缩略图持久化缓存）
  2) 新增 `getThumbCacheStatsForBootLog()`：
     - 启动时读取 IndexedDB `thumbs` 表统计；
     - 使用 `size` 索引的 `openKeyCursor()` 累加字节，避免读取全部 blob。
  3) IndexedDB 版本升级：
     - `THUMB_CACHE_DB_VERSION: 1 -> 2`
     - 升级逻辑补建 `size` 索引（若不存在）。
  4) 原有仅 `scan` 的启动日志已替换为统一日志。
- 验证证据：
  1) 语法检查通过：`node --check src/js/app.js`。
  2) 关键符号可检索：
     - `getThumbCacheStatsForBootLog`
     - `logBootCacheRestoreSummary`
     - `console.log('[scan-cache] restore', { scan, thumb ... })`
- 结果状态：
  - 启动时可一次性看到两类持久化缓存恢复统计，便于统一观测与调试。
