## 问题与目标
- 修复：工作台页面仍显示“试卷图片生成器”的问题。
- 重构：将所有样式改为 SCSS 嵌套语法，统一现代化审美与维护性。
- 注释：在 JS 与 SCSS 中增加简洁且明确的功能说明注释。

## 技术原因分析
- 目前 `WorkspaceView.vue` 直接渲染 `App.vue`，而 `App.vue` 内仍包含左侧的生成器（`<TestImageGenerator />`），导致工作台也显示生成器。

## 解决方案概览
- 将 `App.vue` 重构为“仅工作台内容”的页面（移除左侧生成器与两列布局），生成器独立留在 `/generator` 路由页面。
- 对以下文件进行 SCSS 嵌套改造与注释补充：
  - 页面与布局：`src/App.vue`、`src/AppShell.vue`
  - 组件目录：`src/components/*`（含 `AnswerEditor.vue`、`AreaSelector.vue`、`BatchUpload.vue`、`ErrorBook.vue`、`HistoryPanel.vue`、`ProgressBar.vue`、`QuestionTypeSelector.vue`、`ResultCard.vue`、`TestImageGenerator.vue`）
- 统一设计系统：颜色、字号、间距、断点使用 `src/styles/_variables.scss`；常用样式使用 `src/styles/_mixins.scss`；结构化嵌套与语义化 BEM/实用类结合。

## 详细实施步骤
### 1. 修复工作台生成器显示
- 编辑 `src/App.vue`：
  - 删除左侧生成器与 `.layout` 双列布局，保留右侧上传/OCR/评分区域，改为单列结构。
  - 保留 OCR 结果面板、历史/错题本、题型设置模态等逻辑。
- 更新 `src/views/WorkspaceView.vue`：
  - 不再引用 `App.vue` 时带生成器；保留渲染工作台页面（若继续复用 `App.vue`，则 `App.vue` 仅作为工作台）。

### 2. SCSS 嵌套重构规范
- 样式改造示例（应用到所有组件）：
```
.answer-editor {
  .answer-list {
    .answer-item { .index {} input {} }
  }
  .add-row { .add {} }
}
```
- `App.vue`：
```
.container {
  .header { h1 {} p {} }
  .content {
    .upload-section { .upload-area { .upload-btn {} .file-input {} } }
    .preview-section { .preview-image {} }
    .btn-group { .btn {} }
    .ocr-panel { .ocr-text {} }
    .results-section { .score-display {} .details {} }
  }
}
```
- `AppShell.vue`：
```
.app-shell { .topbar { .brand {} .nav { .nav-link {} } } .content {} }
```
- 统一引入变量与混入，使用 `@use '../styles/_variables.scss'` 与 `@use '../styles/_mixins.scss'`。

### 3. 注释规范
- JS（`<script setup>` 顶部与关键函数前）：
  - 组件职责简述（1-2 行）
  - 关键方法用途与输入/输出简述（1 行）
- SCSS：
  - 区块注释（如“上传区域”“按钮组”“结果面板”）；
  - 响应式段落注释（移动端/4K）。

### 4. 验证与测试
- 路由检查：
  - `/workspace` 不显示生成器，仅工作台功能
  - `/generator` 显示生成器，设置折叠与区域导出正常
- 响应式与4K：移动端、桌面与4K分别检查布局与字号；滚动与模态显示正常。

### 5. 文档与推送
- 更新 `README.md`：说明工作台与生成器路由分离、SCSS嵌套规范与设计系统路径。
- 推送：
  - `git add -A`
  - `git commit -m "fix(workspace): 移除生成器并改为单列；style: 全站SCSS嵌套与注释"`
  - `git push github main`

## 风险与回滚
- 改动聚焦样式与页面结构，不涉及 API；如出现样式错乱，可快速回滚提交或关闭嵌套层级。

## 请求确认
- 是否同意按照以上方案执行代码修改与样式重构？确认后我将立即开始并完成后推送到 GitHub 与 Gitee。