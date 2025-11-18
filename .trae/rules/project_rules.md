# 项目AI规则（精简合并版）

## 1. 项目概览
- 名称：基于目标检测与手写OCR的校园试卷自动判分系统
- 目标：试卷图片上传→OCR识别→自动评分→历史与错题本；提供试卷图片生成器用于教学测试
- 受众：初中生水平的论文与教学项目；追求可用与可维护，非企业级复杂度
- 非目标：不实现分布式/高并发；不提交任何密钥到仓库

## 2. 技术栈与运行
- 前端：Vue3 + Vite + Vue Router + SCSS
- 后端：Node.js + Express
- OCR：百度智能云 doc_analysis / paper_cut_edu / handwriting / accurate_basic / general_basic
- 端口：后端 `http://localhost:3000`；前端开发 `http://localhost:5173`
- 启动：项目根执行 `npm run dev`（并发前后端）
- 接口前缀与代理：统一使用 `/api/*`，通过 Vite 代理到后端 `http://localhost:3000`

## 3. 前端路由与页面
- 路由：`frontend/src/router/index.js`
- 应用壳：`frontend/src/AppShell.vue`（顶栏导航 + `RouterView`）
- 页面：
  - `/workspace` 工作台：上传、区域OCR、评分、错题本、历史、OCR结果面板
  - `/generator` 生成器：生成测试图片、设置折叠、显示区域框、一键应用识别区域
  - `/test-ocr` 测试页：多模型识别、单/多区域框选、屏蔽区域、参数设置、结果预览
  - `/` 重定向到 `/workspace`
- 约束：生成器仅在 `/generator` 展示；工作台不得嵌入生成器
- 文件：`frontend/src/views/WorkspaceView.vue`、`frontend/src/views/GeneratorView.vue`、`frontend/src/views/OCRTestView.vue`
- 关键组件：
  - `AnswerEditor.vue` 标准答案编辑
  - `AreaSelector.vue` 手动框选区域
  - `BatchUpload.vue` 批量上传
  - `ErrorBook.vue` 错题本
  - `HistoryPanel.vue` 历史记录
  - `ProgressBar.vue` 进度展示
  - `QuestionTypeSelector.vue` 题型设置
  - `ResultCard.vue` 评分结果卡片
  - `TestImageGenerator.vue` 试卷图片生成器（折叠设置、区域导出）
- 本地存储键：
  - `errorBook`（错题本数据）
  - `gradingHistory`（评分历史记录）

## 4. 样式与设计（强制）
- 强制 SCSS：所有组件使用 `<style lang="scss" scoped>` 并采用嵌套结构
- 示例：
  ```scss
  .answer-editor {
    .answer-list { .answer-item { .index {} input {} } }
    .add-row { .add {} }
  }
  ```
- 设计系统：变量 `frontend/src/styles/_variables.scss`；混入 `frontend/src/styles/_mixins.scss`；基础 `frontend/src/styles/base.scss`
- 适配：移动端单列与触控优化；4K 使用 `clamp()` 提升字号与间距；容器 `width: 100%`，统一卡片与滚动条美化

## 5. 试卷图片生成器与测试资源
- 职责：生成测试图片；设置面板默认折叠；显示区域框；一键“应用到识别”（导出 `{x,y,w,h}`）
- 交互：设置面板默认折叠；按钮切换“显示设置/隐藏设置”；“显示区域框”叠加；“应用到识别”导出区域到工作台。
- 等号占位：行内含 `=` 时绘制自适应下划线（`___`），并收集矩形为识别区域
- 参数范围：字体 `18–32`、宽度 `600–1400`、高度 `800–1800`、行距 `1.2–1.8`
- 约定：仅保留生成器作为测试入口；旧的分散测试数据与说明文档不再保留
- 适配：移动端单列；4K 使用 `clamp()` 放大字号与间距；容器全宽。

## 6. 后端结构与职责
- 目录：
  ```
  backend/
  ├── server.js              # Express 主入口（中间件与路由）
  ├── services/baiduOCR.js   # 百度OCR封装：token获取、手写识别、区域分析
  ├── utils/logger.js        # 日志工具：log/ 下按时间生成文件并写入
  ├── package.json           # 后端依赖与脚本
  └── uploads/               # 上传文件目录（静态托管）
  ```
- 职责：
  - `server.js`：健康检查、上传、OCR、评分、区域OCR、批量处理
  - `services/baiduOCR.js`：`access_token` 获取、文档分析、整图与区域过滤
  - `utils/logger.js`：`log/yyyymmddHHMMSS.log` 写入事件与数据

## 7. API接口
- 健康检查 `GET /` → `{ message }`
- 上传 `POST /upload`（FormData: `paper`）→ `{ message, filename, path }`
- 评分 `POST /grade`（`{ answers:[{answer,score}], studentAnswers:[str] }`）→ `{ score, totalScore, percentage }`

- 试卷分析与识别（doc_analysis）
  - 整图识别 `POST /ocr`（`{ filename, options? }`）→ `{ message, answers, fullText, words }`
  - 分片识别并拼接 `POST /ocr/doc/images`（`{ images:[base64], options? }`）→ `{ message, fullText, parts:[{ success, text, words }] }`

- 试卷切题识别（paper_cut_edu）
  - `POST /paper-cut`（`{ filename, options? }`）→ `{ message, questions:[{ type, stem, answer, options, bbox, probability }], rawResponse }`

- 手写文字识别（handwriting）
  - 整图识别 `POST /ocr/handwriting`（`{ filename, options? }`）→ `{ message, text, words }`
  - 区域识别（定位过滤）`POST /ocr/handwriting/areas`（`{ filename, areas, options? }`）→ `{ message, results:[{ success, text, area, words }] }`
  - 图片数组识别 `POST /ocr/handwriting/images`（`{ images:[base64], options? }`）→ `{ message, results:[{ success, text, words }] }`

- 通用文字识别（高精度版 accurate_basic）
  - 整图识别 `POST /ocr/accurate`（`{ filename, options? }`）→ `{ message, text, words }`
  - 区域识别 `POST /ocr/accurate/areas`（`{ filename, areas, options? }`）→ `{ message, results:[{ success, text, area, words }] }`
  - 图片数组识别 `POST /ocr/accurate/images`（`{ images:[base64], options? }`）→ `{ message, results:[{ success, text, words }] }`

- 通用文字识别（标准版 general_basic）
  - 整图识别 `POST /ocr/general`（`{ filename, options? }`）→ `{ message, text, words }`
  - 区域识别 `POST /ocr/general/areas`（`{ filename, areas, options? }`）→ `{ message, results:[{ success, text, area, words }] }`
  - 图片数组识别 `POST /ocr/general/images`（`{ images:[base64], options? }`）→ `{ message, results:[{ success, text, words }] }`

- 旧版通用区域识别（保留）
  - `POST /ocr/areas`（`{ filename, areas:[{x,y,width,height}], options? }`）→ `{ message, results:[{ success, text, area, words }] }`

- 批量处理 `POST /batch`（FormData: `papers[]`）→ `{ message, results:[...] }`

- 日志事件键：`server_start/server_init/ping_root/upload_start/upload_end`，`doc_analysis_start/doc_analysis_end/doc_analysis_failed/doc_analysis_exception`，`area_ocr_start/area_ocr_end/area_ocr_failed`，`paper_cut_edu_start/paper_cut_edu_end/paper_cut_edu_failed/paper_cut_edu_exception`，`handwriting/accurate_basic/general_basic` 系列的 start/end/failed/exception，`grade_done/grade_failed`，`batch_process_done/batch_process_failed`

## 8. OCR工具与配置
- 接口：授权 `https://aip.baidubce.com/oauth/2.0/token`；
  - 试卷分析与识别 `https://aip.baidubce.com/rest/2.0/ocr/v1/doc_analysis`
  - 试卷切题识别 `https://aip.baidubce.com/rest/2.0/ocr/v1/paper_cut_edu`
  - 手写文字识别 `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting`
  - 通用文字识别（高精度）`https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic`
  - 通用文字识别（标准）`https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic`
- 参数示例：`language_type=CHN_ENG`、`result_type=big`、`detect_direction=true`、`words_type=handprint_mix` 等
- 请求体大小：后端 `express.json/urlencoded` 限制提升为 `50MB`
- 环境变量：`BAIDU_OCR_API_KEY`、`BAIDU_OCR_SECRET_KEY`
  - PowerShell 当前会话：`$env:BAIDU_OCR_API_KEY="..."`；`$env:BAIDU_OCR_SECRET_KEY="..."`
- Token策略：令牌提前5分钟判过期；失败抛错并记录日志
- 官方文档：`https://cloud.baidu.com/doc/OCR/index.html`

## 9. 评分与容错（建议默认）
- 字符：去除前后空格；括号与标点归一化
- 数值：允许误差（建议 `±0.01`）；分数约分后比较（`2/4 == 1/2`）
- 单位：常见单位映射（`米==m`、`厘米==cm`）；数值+单位组合比较
- 选择题：圈选 A-D 容错（手写体与近似字形）；圈在选项附近判命中
- 简答题：关键词匹配加分（如命中 2/3 记部分分）；大小写与全角半角归一
- 图表/坐标题：坐标值与标注文本数值归一后比较；条形图识别数字或字母选项
- 错题本：保存错误题目、学生/正确答案，支持解析与导出

## 10. 日志规范
- 路径：`log/`；文件名：`yyyyMMddHHmmss.log`
- 结构：`[ISO][level] message {json}`，包含 `start/end/failed/exception`
- 记录：事件名、文件名、参数摘要、区域坐标、识别文本摘要、得分、耗时；异常完整记录与栈
- 示例事件：
  - 上传：`upload_start/upload_end`
  - doc_analysis：`doc_analysis_start/doc_analysis_end/doc_analysis_failed/doc_analysis_exception`
  - 区域识别：`area_ocr_start/area_ocr_end/area_ocr_failed`
  - 切题识别：`paper_cut_edu_start/paper_cut_edu_end/...`
  - 手写/高精度/通用：`*_start/*_end/*_failed/*_exception`

## 11. Git提交与远程同步
- 远程：`github` 与 `gitee`
- 提交规范（中文语义化）：
  - 类型：`feat` / `fix` / `docs` / `style` / `refactor` / `test` / `build` / `chore`
  - 模板：`<type>(<scope>): <简要变更说明>`
  - 示例：
    - `feat(generator): 生成器导出区域并接入区域OCR`
    - `fix(workspace): 移除生成器并改为单列布局`
    - `style(scss): 全局嵌套重构与4K适配`
- 分支与流程：`feature/<desc>`、`fix/<desc>`、`chore/<desc>`；本地→分支→测试与lint→PR→评审→合并→发布
- 推送（需确认）：首次 `git remote add`；PowerShell 链式用 `;`；同步两端 `git push github main` 与 `git push gitee main`
- 参考：`https://zhuanlan.zhihu.com/p/182553920`

## 12. 注释规范
- JS：顶部写组件职责1–2句；关键函数用途与输入/输出1句
- SCSS：区块用途注释；移动端/4K 响应式段落注释

## 13. Agent工作规范
- 执行前：展示计划/命令/影响并征得确认
- 执行后：检查并报告 `README.md` 与本规则是否需同步更新
- 敏感动作需确认：远程推送、批量修改文件、引入新后端/数据库、访问非工作区文件

## 14. 代码位置索引（溯源）
- 健康检查：`backend/server.js:38-41`
- 上传：`backend/server.js:44-49`
- doc_analysis（整图）：`backend/server.js:52-82`
- 评分：`backend/server.js:85-102`
- 通用区域OCR（旧）：`backend/server.js:105-130`
- 试卷切题识别：`backend/server.js:133-154`
- 手写区域识别：`backend/server.js:157-178`
- 高精度区域识别：`backend/server.js:181-202`
- doc_analysis 图片数组：`backend/server.js:205-224`
- 手写整图：`backend/server.js:227-239`
- 高精度整图：`backend/server.js:241-253`
- 通用整图：`backend/server.js:255-267`
- 手写图片数组：`backend/server.js:269-280`
- 高精度图片数组：`backend/server.js:283-293`
- 通用图片数组：`backend/server.js:295-306`
- 通用区域识别：`backend/server.js:309-328`
- 批量处理：`backend/server.js:331-373`
- OCR服务：`backend/services/baiduOCR.js:66-149,150-161,163-236,238-315,317-357,359-386,388-457,459-551`
- 日志工具：`backend/utils/logger.js:19-40`

## 15. 变更说明
- 本规则更新后，应在最近一次提交中说明，并检查 `README.md` 是否需新增链接或说明

## 16.调试工具与验证
- 生成器：显示区域框叠加、折叠设置、应用到识别；下载图片用于测试。
- 工作台：OCR 结果面板常驻按钮切换；批量上传与历史/错题导出。
- 单题重识别（建议）：对失败区域支持再次识别。

## 17.安全与隐私
- 不提交任何密钥或敏感信息到仓库；使用环境变量管理。