## 目标
- 将前端改为 Router 路由结构，分离“试卷图片生成器”和“识别/评分工作台”两个页面。
- 对所有样式进行现代化重构，改为 SCSS 嵌套语法，统一设计系统并支持移动端与4K适配。

## 路由结构（Vue Router 4）
- 依赖：`vue-router@4`
- 路由：
  - `/` → 重定向到 `/workspace`
  - `/workspace` → 识别/评分工作台（现有上传、OCR、评分、错题本、历史）
  - `/generator` → 试卷图片生成器（现有 TestImageGenerator，常驻设置折叠、区域导出）
- 文件：
  - `src/router/index.js`（创建路由与导出）
  - `src/main.js`（挂载 `router`）
  - `src/layouts/MainLayout.vue`（统一页头/侧边导航/内容区）
  - `src/views/WorkspaceView.vue`（右侧现有功能页）
  - `src/views/GeneratorView.vue`（左侧生成器页）

## 组件与页面改造
- `App.vue` 精简为仅承载布局与 `router-view`（或直接改为 `MainLayout.vue` + `App.vue` 入口）。
- 将当前 `App.vue` 的右侧功能块迁移到 `WorkspaceView.vue`；左侧生成器迁移到 `GeneratorView.vue`。
- 保留现有组件：`AnswerEditor`、`AreaSelector`、`BatchUpload`、`ErrorBook`、`HistoryPanel`、`ResultCard`、`ProgressBar`；按页面引用。

## SCSS 架构
- 依赖：`sass`（SCSS 编译）
- 新增目录：`src/styles/`
  - `_variables.scss`（颜色/字号/间距/阴影/断点）
  - `_mixins.scss`（响应式 `clamp`、4K/移动端断点工具、卡片阴影等）
  - `base.scss`（重置、排版、滚动条美化、容器）
  - `layout.scss`（布局栅格、侧边栏、顶栏）
- 组件样式统一改为 `<style lang="scss" scoped>` 并使用嵌套结构（BEM/实用类结合）。
- 设计变量建议：
  - 颜色：`$primary: #4CAF50; $secondary: #2196F3; $accent: #FFC107; $bg: #f8f9fa;`
  - 断点：`$bp-mobile: 768px; $bp-4k: 2560px;`
  - 字号：`clamp()` 统一控制；按钮/标题在4K下提升。

## 现代化UI规范
- 布局：侧边栏导航（Generator / Workspace）、顶栏标题与操作入口；内容区卡片化。
- 交互：
  - Generator：设置折叠、显示区域框、应用到识别。
  - Workspace：常驻 OCR 结果面板切换、批量上传、历史/错题本、题型设置。
- 响应式：移动端单列；桌面双列；4K放大字号与间距。

## 具体改动步骤（不执行，仅列出）
1. 安装依赖（需要你的确认后执行）：
   - `npm i vue-router@4`
   - `npm i -D sass`
2. 新增与改造文件：
   - `src/router/index.js`：定义路由
   - `src/layouts/MainLayout.vue`：侧栏+顶栏+内容区
   - `src/views/WorkspaceView.vue`：迁移现有右侧功能
   - `src/views/GeneratorView.vue`：迁移生成器为页面
   - 修改 `src/main.js`：挂载 `router`
   - 精简 `src/App.vue`：承载布局或改为纯入口
   - 新增 `src/styles/` 并全局引入 `base.scss`
3. 将所有组件样式改为 SCSS 嵌套并接入变量/混入。
4. 更新 `README.md`：路由结构、样式架构、运行/导航说明。

## 验证
- 本地运行，分别在移动端视口/桌面/4K检查布局；路由切换是否正常。
- 生成器页面生成/下载图片与区域导出；工作台页面使用区域OCR识别与评分。

## 推送
- 完成后提交：
  - `git add -A`
  - `git commit -m "feat(router+scss): 路由化页面与SCSS重构，现代化布局"`
  - `git push github main`

## 说明（技术选择）
- Vue Router 4 是 Vue3 官方路由库，利于页面分离与后续扩展。
- SCSS 提供变量与嵌套，符合你的偏好并提升维护性。

## 请求确认
- 是否按上述方案实施？同意后我将开始改造并完成推送。