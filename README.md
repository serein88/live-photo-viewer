# Live Photo Viewer

## Run
- Static frontend project, no backend required.
- Start any static server in project root, then open `index.html`.

## Standardized Agent Files
- `task.json`: single source of truth for task queue and status.
- `progress.txt`: append-only execution log for handoff.
- `claude.md`: fixed six-step workflow prompt (Codex/Claude compatible).
- `scripts/init-dev.ps1`: session bootstrap script (prints next pending task).

## Structure
- `index.html`: app entry
- `src/css/app.css`: app styles
- `src/js/app.js`: app logic
- `vendor/`: third-party libs (Viewer.js)
- `todo.md`: human-readable backlog snapshot
- `agents.md`: legacy entrypoint (redirects to structured docs)
- `开发文档.md`: architecture and engineering constraints
- `docs/`: workflow and session templates

## Quick Start for Each Session
1. `powershell -ExecutionPolicy Bypass -File scripts/init-dev.ps1`
2. Pick first `pending` task in `task.json` and set to `in_progress`
3. Implement + verify
4. Write result to `progress.txt`
5. Update `task.json` status and append `progress.txt`
6. Commit with task id in message


