# CHANGELOG

## 2026-02-10
- 将项目从单文件 `index.html` 重构为常规结构：
  - 新增 `src/css/app.css`
  - 新增 `src/js/app.js`
  - `index.html` 改为引用外部 CSS/JS
- 恢复使用 `vendor/viewer.min.css` 与 `vendor/viewer.min.js` 外链方式。
- 更新开发文档：放弃单文件交付策略，改为模块化维护。
- 增加项目管理文档：`README.md`、`docs/ROADMAP.md`、`docs/CHANGELOG.md`。
