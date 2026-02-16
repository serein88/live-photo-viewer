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
