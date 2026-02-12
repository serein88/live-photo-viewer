# 开发日志（Live 图查看器）

> 便于后续 AI 或开发者接手。记录关键决策、已实现功能、已知问题与下一步。

## 项目概况
- 单文件应用：`index.html`
- 目标：本地 Live 图扫描、识别、相册式浏览、预览与导出
- 兼容：桌面浏览器 + 移动端（含 iOS Safari）

## 已实现功能
- 文件导入：
  - 桌面优先 `showDirectoryPicker`
  - Android 兼容 `webkitdirectory` 回退
  - iOS/不支持目录选择时：多选文件
- 扫描与列表：
  - 异步扫描（分批处理）
  - 万级列表惰性缩略图（IntersectionObserver）
- Live 识别：
  - iOS Live Photo：同名 `.mov`
  - XMP 内含关键词：Motion Photo / Xiaomi / vivo / OPPO / HONOR
  - 兜底：JPEG 内嵌 MP4 `ftyp` 检测
- 预览：
  - 相册式预览弹层
  - Live 预览支持视频播放（autoplay/muted/playsInline）
  - 失败回退为静态图
- 详情：
  - EXIF 读取（DateTimeOriginal/Model/Make/Lens/尺寸等）
  - 详情面板可展开/收起
- 导出：
  - 兼容优先：直接下载视频 blob 或静态图
- UI：
  - 自动识别手机/电脑布局 + 手动切换
  - Live 缩略图标记改为图标（非文字）

## 关键文件
- `D:\CodeSpace\live-photo-viewer\index.html`
- `D:\CodeSpace\live-photo-viewer\开发文档.md`

## 已知问题
- Live 播放在部分机型仍可能“转圈不播放”（需进一步采样与兼容处理）

## 当前实现要点（供接手参考）
- 缩略图显示逻辑：`renderGrid()` + `loadThumbnail()`
- Live 识别：`analyzeFile()`
- 预览渲染：`renderPreview()`
- EXIF 解析：`extractExif()` + `parseIFD()`

## 建议下一步
1) 修复电脑端预览裁切问题：
   - 检查 `.preview-card` 的 height/overflow
   - 考虑把预览改成 `position: relative` + 内部绝对布局
   - 或改为 `img { max-height: calc(88vh - header - footer) }`
2) Live 视频播放稳定性：
   - 对 `videoBlob` 强制 `type` 为 `video/mp4` 或 `video/quicktime`
   - 对 motion photo 抽取视频时验证 mp4 header 是否完整
3) 补充导出能力：
   - GIF 导出通道
   - 更明确的导出预设
4) 性能：
   - EXIF 解析移到 Web Worker（避免主线程卡顿）

## 最近变更摘要
- 调整：预览界面改为“暗色主画布 + 右侧信息栏”布局，按钮改为图标风格
- 修复：电脑端竖图预览裁切问题，预览媒体改为自适应最大宽高
- 新增：预览静音/取消静音图标按钮（无文字）
- 修复：缩略图显示逻辑，使用容器内 img，避免替换节点破坏布局
- 增强：Android 文件夹选择（webkitdirectory）
- 调整：Live 标识改为图标
- 新增：EXIF 详情面板
- 优化：视频预览自动播放、失败回退

## 本次对话摘要（2026-02-02）
- 预览布局：改为全屏暗色画布 + 右侧信息栏；顶部工具条图标化；移除底部栏释放画面空间。
- 预览交互：加入左右边缘“上一张/下一张”悬浮按钮（自动隐藏）；点击播放一次（不循环）；静音按钮保留。
- 缩放与拖拽：支持滚轮缩放 + 左键拖拽；缩放加入缓动与变速；修正缩放中心点偏移。
- 显示优化：预览头部改为半透明覆盖；视频区域自适应占满容器；去掉预览白色圆角残留；光标仅在拖拽时显示抓手。

## 本次对话摘要（2026-02-03）
- 使用 Viewer.js 替换自研预览层；引入 `vendor/viewer.min.js`/`vendor/viewer.min.css`。
- Viewer UI 重做为 Google Photos 风格：顶部栏、右侧信息面板、暗色画布；隐藏 Viewer 原生 UI 后逐步恢复底部工具栏。
- Live 交互改为同画布内播放：右下播放按钮 → 顶栏按钮组；播放时隐藏图片层，播放结束自动恢复。
- 右侧信息面板：改为与画布并列布局（flex）；展开时画布缩小；面板内容间距加大并自适应宽度。
- 底部工具栏改为悬浮居中并自动隐藏；按钮图标居中对齐；新增静音按钮（状态跨图片保持）。
- 增加左右翻页按钮；展开面板时右侧按钮自动左移。
- 修复缩略图点击无效：使用 `#grid` 事件委托绑定点击/右键选择。

## 本次对话摘要（2026-02-04）
- Viewer 面板强制右侧展开：`viewer-container` 采用 flex，面板与画布并列；展开时画布缩小不遮挡。
- Live/静音按钮逻辑调整：非动图隐藏播放/静音按钮；动图显示并支持静音状态跨图片保持。
- 切换到动图自动播放一次，用于区分动图/非动图；播放结束自动恢复图片层。
- 底部工具栏改为悬浮居中且自动隐藏，不挤压画布；图标对齐优化（居中对齐）。
- 事件绑定改为 `#grid` 事件委托，避免缩略图点击失效。
- 调试输出：增加 `viewer` 打开、面板状态、按钮显示、自动播放等 console 日志。

## 当前调试进展（2026-02-04 晚）
- 发现问题：信息面板展开后，图片仍按全屏宽度居中；视频已能在剩余画布中居中。
- 诊断：Viewer.js 的 `viewerData` 仍用窗口宽度（如 1920），未用 `.viewer-canvas` 实际宽度（如 1560）；因此图片的 `imageData.x` 基于错误宽度。
- 结论：需在面板展开/收起或容器变化时，把 `viewer.viewerData` 和 `viewer.containerData` 重新设为 `.viewer-canvas` 的 `getBoundingClientRect()` 宽高，并触发 `initImage()` + `renderImage()` 以重新计算居中。
- 追加调试：已用 MCP 检查 `state.viewer.viewerData` 与 `imageData`，并在控制台验证手动更新后图片可居中。
- 待修复：视频播放与图片展示尺寸/位置仍不一致，需要让视频尺寸对齐图片框（可用图片的 `imageData.width/height` 或统一用 canvas 适配规则）。

## 本次对话摘要（2026-02-05）
- 修复缩略图丢失：排序/右键选择后卡片重建，改为“卡片里没有 img 就加载”，不再依赖 `thumbLoaded` 状态。
- 缩略图与查看器图片复用同一 `objectUrl`，避免反复创建 URL 导致内存膨胀；重新扫描时统一回收。
- EXIF 排序性能优化：拍摄时间只读文件头 256KB，首次扫描顺带解析 EXIF；对无 EXIF 的文件只解析一次；节流 `renderGrid`，并在 EXIF 队列期间跳过 `viewerGallery` 更新。
- EXIF 解析边界保护增强：防止截断 buffer 造成异常解析与卡顿。
- 默认预览改为“完整显示不裁切”：`fitImageToCanvas` 改为 contain（`Math.min`）；Live 视频层 `object-fit: contain` 并与图片位置/尺寸同步。
- Live 播放按钮支持播放/暂停切换：播放时按钮变为暂停图标，点击可暂停/继续，结束后恢复。
- 打包整合：内联 `viewer.min.css` 与 `viewer.min.js` 到 `index.html`，便于安卓本地单文件打开，避免散落资源引用失败。
- 安卓文件夹选择修复：不再依赖隐藏 input，改为点击时动态创建 `webkitdirectory` input 并触发选择，解决“选中目录无反应”。

## 本次对话摘要（2026-02-06）
- 目录选择按平台分流：新增 `detectPlatform()`（Windows/Android/iOS），iOS 强制回退多文件选择。
- 目录 API 优先级：`showDirectoryPicker` → `webkitdirectory`，统一入口 `pickDirectoryByPlatform()`。
- 增加目录选择调试日志：`[dir-pick] platform / showDirectoryPicker / webkitdirectory / fallback`，用于定位安卓端“选择文件夹失效”问题。

## 本次对话摘要（2026-02-10）
- 架构迁移：放弃单文件主形态，将 `index.html` 拆分为常规结构：
  - `src/css/app.css`（业务样式）
  - `src/js/app.js`（业务脚本）
  - `vendor/viewer.min.css`、`vendor/viewer.min.js`（第三方依赖外链）
- `index.html` 角色收敛为入口装配层（结构 + 资源引用），避免继续膨胀。
- 文档更新：重写 `开发文档.md`，明确模块化架构、目录职责、协作流程、后续拆分计划。
- 项目管理补齐：新增 `README.md`、`docs/ROADMAP.md`、`docs/CHANGELOG.md`，用于规划、变更记录和团队交接。

## 本次对话摘要（2026-02-11）
- 安卓 Live 黑屏排查增强（`src/js/app.js`）：
  - 在 `openLiveVideoInline()` 增加调试日志：`[live-debug] open/loadedmetadata/canplay/waiting/stalled/video error/play reject/retry reject/onplay/onpause`。
  - 播放策略调整：不再在播放开始前立即隐藏图片层，改为 `onplay` 时再隐藏，避免视频未起播导致黑屏。
  - 安卓回退：首次 `video.play()` 失败时，自动切到 `muted=true + controls=true` 并重试，便于触摸端手动接管播放。
  - 清理补全：`closeLiveVideoInline()` 增加 `oncanplay/onwaiting/onstalled/onerror` 解绑并恢复 `controls=false`。
- 缩略图 Live 标识恢复（`src/css/app.css`）：
  - 为 `.live-icon` 增加 `z-index: 3`，保证左上角 Live 图标不被缩略图内容遮挡。
- 网格调试信息（`src/js/app.js`）：
  - `renderGrid` 增加 `[grid] render` 日志，输出当前筛选结果总数与 live 数，便于区分“识别失败”与“展示层被遮挡”。

## Android Live 黑屏调试步骤（接手即用）
1. Android 设备连接 PC，使用 Chrome `chrome://inspect` 远程调试页面。
2. 打开一张 Live 图，过滤控制台关键字：`live-debug`。
3. 重点查看：
   - `blobType/blobSize`（是否抽出视频）
   - `canPlayMp4/canPlayQuickTime`（浏览器是否声明支持）
   - 是否出现 `loadedmetadata`
   - 是否出现 `video error`（含 `code`）
   - 是否触发 `play reject`/`retry reject`
4. 结论判定建议：
   - 若 `video error` 且 `canPlay*` 为空，优先怀疑编码兼容（需转码样本验证）。
   - 若只有 `waiting/stalled`，优先排查资源读取/URL 生命周期问题。

## 本次对话摘要（2026-02-11，Windows 导航稳定性）
- 问题现象（用户反馈）：预览界面点击“下一张”会出现两类异常：
  - 早期：未到最后一张时偶发跳回第一张。
  - 修复后阶段：不再回第一张，但点几次“下一张”后会卡住不动。
- 复现与定位（MCP 在已打开标签页直接调试）：
  - `state.filtered.length = 14`，但 `viewer.index` 在中途卡住（例如 6），而外部索引还能继续增长。
  - 根因是 Viewer 内部可导航列表依赖 `img[src]`，之前“按需加载 + 删除 src”导致内部长度被截断。
- 已实施修复（`src/js/app.js`）：
  1. 导航索引管控：
     - 新增 `viewAtIndex()`，所有上一张/下一张都基于 `state.filtered` 计算目标索引。
     - 接管 Viewer 原生 `Previous/Next` 按钮点击，避免直接依赖 `viewer.next()/prev()` 的内部状态。
  2. 索引同步：
     - 新增 `state.currentViewerIndex`，在 `openViewer`、`viewed`、`viewAtIndex` 中同步更新。
     - 侧边按钮与禁用状态判定改为优先使用 `currentViewerIndex`。
  3. Viewer 列表长度稳定：
     - 新增 `VIEWER_PLACEHOLDER_SRC`（1x1 占位图），保证 `viewerGallery` 所有项始终有 `src`。
     - 内存回收时不再删除 `src`，而是恢复占位图；窗口内按需替换为真实 `blob:`。
- 关联修复（同轮）：
  - 修复多处历史乱码字符串导致的 `app.js` 语法中断（此前会造成按钮“无反应”假象）。
  - 针对 `test/荣耀-live-1.jpg` 增强识别：无 XMP 时增加中段 MP4 (`ftyp`) 探测与提取兜底。
- 验证状态：
  - `node --check src/js/app.js` 通过。
  - 在已打开页面可复现并验证“导航不再随机回首张”；后续重点回归“连续点击下一张直到末尾，按钮应稳定禁用”。

## 本次对话摘要（2026-02-12，Android 大目录性能与体验）
- 安卓文件选择策略落地：
  - `folderBtn` 在 Android 统一改为“系统文件多选”路径（不再依赖目录模式），与实测最佳兼容方案一致。
  - 新增选择器诊断日志 `[picker-debug] diagnose`，输出 `source/browser/inferredPicker/confidence`。
  - 诊断改为采样（最多 400 文件）避免大批量选择时前置卡顿。
- 扫描架构重构（大批量可先浏览再补全）：
  - 由“全量扫描完成后再展示”改为“先索引+占位，再后台渐进识别 Live/EXIF”。
  - `startScanOverride`：先构建 `state.items` 占位条目并立即 `renderGrid`，随后 `progressiveAnalyzeItems` 后台扫描。
  - 扫描优先队列先处理首屏项（`priorityIds`），提升首屏可用性。
- 网格渲染与滚动加载优化：
  - 网格改为分批渲染（首屏 burst + 分页追加），并在 Android 扫描中支持“尽快补齐全部占位符”。
  - 新增滚动预取与加载提示（`grid-sentinel` + `grid-load-hint`），快速下滑时显示“加载中，继续下滑会自动加载”。
- 缩略图稳定性优化（减少反复重载）：
  - 新增缩略图任务队列（Windows 并发=3，Android 并发=2）。
  - 缩略图生成后写入 `item.thumbUrl` 持久复用，避免查看器开关/来回滚动时重复重建。
  - 生成策略改为压缩小图（canvas + jpeg），降低内存与解码压力。
- Live 识别修复与回归：
  - 荣耀 Live 在大文件夹漏检问题修复：恢复稳定 EXIF 解析路径（含 `Make/Model` 识别链路）。
  - 增加 `[live-detect] honor exif` 调试日志，便于确认 HONOR 命中来源。
  - 若用户点开某项时后台尚未扫到，增加“按需即时识别”兜底，避免误判非 live。
- Android Live 播放兼容补充（本轮延续）：
  - 针对 `DEMUXER_ERROR_DETECTED_AAC` 增加去音轨回退（`stripMp4AudioTrack`），并缓存 `_audioStrippedBlob`。
  - 重新播放时优先策略修正，避免每次重复触发同一 AAC 错误。
- Indexing 体验持续优化（仍在迭代）：
  - 提前显示 `scanOverlay`（`preShowScanOverlay`），并在扫描前用双帧让出保证首帧可见。
  - 进度更新粒度调细（Android：索引 chunk 40、占位 chunk 80），避免一上来跳到较大值。
  - 当前用户反馈：出现时机已提前但在超大选择场景仍可能偏晚（曾出现约 40 张后显示），该项仍为优先体验优化点。

## 接手建议（下一位 AI）
- 首先复核 `src/js/app.js` 中覆盖函数链：`startScanOverride`、`progressiveAnalyzeItems`、`renderGridOverride`、`loadThumbnailOverride`。
- 若继续优化 Indexing 首帧：
  - 进一步压缩 `handleSelectedFiles` 同步段（避免任何循环/日志在首帧前执行）。
  - 必要时将 `preShowScanOverlay` 提前到 picker click 前（用户点击后立即显示“等待选择”）。
- 若继续优化大目录稳定性：
  - 引入卡片 DOM 复用（避免 `renderGrid` 全量清空重建）。
  - 为 `thumbUrl` 增加 LRU 回收策略（超大目录长期滚动时控制内存峰值）。


