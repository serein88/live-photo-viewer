# agents.md（兼容入口）

此文件保留用于兼容旧链接，不再承载完整历史流水。

## 当前规范
- 任务清单与状态：`task.json`
- 执行流水与交接：`progress.txt`
- 执行流程提示词：`claude.md`
- 架构与约束：`开发文档.md`
- 长会话规范：`docs/VIBE_CODING_HARNESS.md`

## 当前活跃目标
- 以 `task.json` 中最高优先级 `pending` 任务为下一执行项。
- 每轮只处理 1 个任务，状态流转：`pending -> in_progress -> review -> done/failed`。

## 迁移说明（2026-02-13）
- 旧 `agents.md` 的历史会话摘要已迁移并结构化汇总至 `progress.txt`。
- 之后不再在此重复记录长日志，避免多源漂移。
