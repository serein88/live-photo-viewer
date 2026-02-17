# Live Photo Viewer

## Run
- Static frontend project, no backend required.
- Start any static server in project root, then open `index.html`.

## Vibe Coding Files (Current Standard)
- `agents.md`: project goal, development rules, reusable engineering patterns.
- `task.md`: task board with statuses (`待进行 / 进行中 / 待确认 / 失败 / 完成`).
- `progress.md`: per-round execution log with evidence.
- `docs/AI_HANDOFF.md`: 给后续 AI 的快速接手文档（架构、链路、风险、调试顺序）。

## Session Start
1. `powershell -ExecutionPolicy Bypass -File scripts/init-dev.ps1`
2. Pick one task from `task.md`
3. Implement minimal changes
4. Verify with reproducible steps and logs
5. Update `task.md` + `progress.md`
6. Commit with task name/ID

## Structure
- `index.html`: app entry
- `src/css/app.css`: app styles
- `src/js/app.js`: app logic
- `vendor/`: third-party libs (Viewer.js)
