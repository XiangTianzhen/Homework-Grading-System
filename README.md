# 校园试卷自动判分系统

## 项目概览
- 论文主题：基于目标检测与手写OCR的校园试卷自动判分系统设计与实现
- 目标：提供网页平台完成试卷图片上传 → OCR识别 → 自动评分 → 错题与历史管理，并内置试卷图片生成器便于测试与教学
- 受众：以初中生为使用群体，强调清晰、易用与教学辅助

## 技术架构（概述）
- 前端路由：
  - `/workspace` 工作台：上传/OCR/评分/错题本/历史/题型设置
  - `/generator` 生成器：试卷图片生成、设置折叠、导出识别区域与叠加显示
  - `/` → 重定向到 `/workspace`
- 应用壳：`frontend/src/AppShell.vue`（顶栏导航 + RouterView）
- 后端接口：`/upload`、`/ocr`、`/ocr/areas`、`/grade`、`/batch`

## 目录结构（更新）
```
frontend/src/
├── AppShell.vue
├── router/index.js
├── views/
│   ├── WorkspaceView.vue
│   └── GeneratorView.vue
├── components/
│   ├── AnswerEditor.vue
│   ├── AreaSelector.vue
│   ├── BatchUpload.vue
│   ├── ErrorBook.vue
│   ├── HistoryPanel.vue
│   ├── ProgressBar.vue
│   ├── QuestionTypeSelector.vue
│   ├── ResultCard.vue
│   └── TestImageGenerator.vue
└── styles/
    ├── _variables.scss
    ├── _mixins.scss
    └── base.scss

backend/
├── server.js
├── services/baiduOCR.js
└── utils/logger.js
```

## 配置说明（OCR与代理）
**百度OCR 环境变量（PowerShell 会话）**
```
$env:BAIDU_OCR_API_KEY = "你的API Key"
$env:BAIDU_OCR_SECRET_KEY = "你的Secret Key"
```
**端口与代理约定**
- 前端统一以 `/api/*` 调用接口，并通过 Vite 代理到后端 `http://localhost:3000`
- PowerShell 命令链请使用 `;` 分隔（避免 `&&` 在 PS5 下的问题）

## API 概览（后端）
- `GET /`：健康检查 → `{ message }`
- `POST /upload`（FormData: `paper`）→ `{ message, filename, path }`
- `POST /ocr`（JSON: `{ filename }`）→ `{ message, answers, fullText, words }`
- `POST /grade`（JSON: `{ answers:[{answer,score}], studentAnswers:[string] }`）→ `{ score, totalScore, percentage }`
- `POST /ocr/areas`（JSON: `{ filename, areas:[{x,y,width,height}] }`）→ `{ message, results:[{ success, text, area, words }] }`
- `POST /batch`（FormData: `papers`）→ `{ message, results:[{ filename, originalname, success, answers, fullText, error }] }`

## 日志规范
- 路径：`backend/log/`
- 文件名：`yyyyMMddHHmmss.log`（本地时区）
- 记录项建议：事件名、文件名、区域坐标、识别文本与置信度、得分与耗时、异常信息

## 样式与 SCSS 嵌套
- 强制使用 `<style lang="scss" scoped>` 并采用嵌套结构（示例）：
```
.answer-editor {
  .answer-list {
    .answer-item { .index {} input {} }
  }
  .add-row { .add {} }
}
```
- 变量/混入：`styles/_variables.scss`、`styles/_mixins.scss`
- 移动端：单列布局、触控面积优化、Canvas 自适应；4K：`clamp()` 动态字号与间距

## 贡献指南
- 提交类型：`feat` / `fix` / `docs` / `style` / `refactor` / `test` / `build` / `chore`
- 模板：`<type>(<scope>): <简要变更说明>`
- 示例：
  - `feat(generator): 生成器导出区域并接入区域OCR`
  - `fix(workspace): 移除生成器并改为单列布局`
  - `style(scss): 全局嵌套重构与4K适配`
- 分支与流程：`local -> branch -> test -> pr -> review -> merge -> release`
- 远程同步：`github` 与 `gitee`（推送前需确认）
- 参考规范：`https://zhuanlan.zhihu.com/p/182553920`

## 许可证与鸣谢
- 许可证：MIT
- 鸣谢：百度智能云 OCR · Vue · Vite · Express

## FAQ
- OCR 精度不稳定？建议清晰度≥300DPI，手写工整；优先使用区域OCR并开启“显示区域框”检查覆盖
- 令牌获取失败？确认已设置 `BAIDU_OCR_API_KEY` 与 `BAIDU_OCR_SECRET_KEY`，重启终端使其生效
- 4K 显示过小？已使用 `clamp()` 动态字号与间距；如需更大字号，可在 `_variables.scss` 中调整