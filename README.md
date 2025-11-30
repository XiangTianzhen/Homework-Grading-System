# 校园试卷自动判分系统

## 项目概览
- 论文主题：基于目标检测与手写OCR的校园试卷自动判分系统设计与实现
- 目标：提供网页平台完成试卷图片上传 → OCR识别 → 自动评分 → 错题与历史管理，并内置试卷图片生成器便于测试与教学
- 受众：以初中生为使用群体，强调清晰、易用与教学辅助

## 技术架构（概述）
- 前端路由：
  - `/workspace` 工作台：上传/OCR/评分/错题本/历史/题型设置
  - `/generator` 生成器：试卷图片生成、设置折叠、导出识别区域与叠加显示
  - `/test-ocr` 测试页：多模型识别、区域框选、屏蔽区域、参数设置、结果预览
  - `/` → 重定向到 `/workspace`
- 应用壳：`frontend/src/AppShell.vue`（顶栏导航 + RouterView）
- 错误拦截：前端 Axios 拦截器按状态码输出友好文案（400/404/413/500）并附加后端错误说明
- 后端接口：覆盖试卷分析与识别、试卷切题识别、手写文字识别、通用文字识别（高精度/标准）等整图与分片场景

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
│   ├── BatchEdit.vue
│   ├── ErrorBook.vue
│   ├── HistoryPanel.vue
│   ├── ProgressBar.vue
│   ├── QuestionTypeSelector.vue
│   ├── ResultCard.vue
│   ├── OCRSettings.vue
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

**请求体大小**
- 后端 `express.json/urlencoded` 已提升到 `50MB`，建议裁剪图片数量与尺寸合理控制，避免触发 `413`。

## 部署与运行（本地与 Docker）
- 本地开发（Windows PowerShell）：
  - 安装依赖：
    ```
    npm install; npm --prefix frontend install; npm --prefix backend install
    ```
  - 设置环境变量并并发启动前后端：
    ```
    $env:BAIDU_OCR_API_KEY="你的API Key"; $env:BAIDU_OCR_SECRET_KEY="你的Secret Key"; npm run dev
    ```
  - 访问：前端 `http://localhost:5173`，后端 `http://localhost:3000`

- 生产构建（非容器）：
  - 构建前端：
    ```
    cd frontend; npm run build
    ```
  - 启动后端：
    ```
    cd ../backend; $env:BAIDU_OCR_API_KEY="你的API Key"; $env:BAIDU_OCR_SECRET_KEY="你的Secret Key"; npm run start
    ```

- 容器化部署（Docker Compose）：
  - 前置：安装 Docker Desktop；使用配置文件夹管理端口与密钥：
    - 复制示例并填写：
      ```
      Copy-Item config\backend.env.example config\backend.env
      Copy-Item config\compose.env.example config\compose.env
      ```
    - 编辑 `config/backend.env`（容器内环境）：
      ```
      PORT=3000
      BAIDU_OCR_API_KEY=你的APIKey
      BAIDU_OCR_SECRET_KEY=你的SecretKey
      ```
    - 编辑 `config/compose.env`（宿主机端口映射）：
      ```
      BACKEND_HOST_PORT=3000
      FRONTEND_HOST_PORT=5173
      ```
  - 构建并启动（引用配置文件夹）：
    ```
    docker compose --env-file config/compose.env up -d --build
    ```
  - 访问：前端 `http://localhost:5173`（Nginx 静态资源 + 反向代理 `/api` 到后端），后端 `http://localhost:3000`
  - 常用命令：
    ```
    docker compose logs -f backend
    docker compose logs -f frontend
    docker compose down
    ```
  - 数据持久化：`uploads/` 与 `log/` 目录已绑定为宿主机卷，容器重启不丢失上传文件与日志。

- 安全与密钥：
  - 不要将密钥写入代码仓库；通过环境变量或 CI/CD Secrets 注入。
  - 如需使用 `.env` 文件，请确保加入 `.gitignore` 且使用占位符示例文件（例如 `.env.example`）。
  - 本项目已提供 `config/backend.env.example` 与 `config/compose.env.example`；真实文件已在 `.gitignore` 忽略。

## API 概览（后端）
- `GET /`：健康检查 → `{ message }`
- 上传 `POST /upload`（FormData: `paper`）→ `{ message, filename, path }`
- 评分 `POST /grade`（`{ answers:[{answer,score}], studentAnswers:[string] }`）→ `{ score, totalScore, percentage }`

**试卷分析与识别（doc_analysis）**
- 整图识别 `POST /ocr`（`{ filename, options? }`）→ `{ message, answers, fullText, words }`
- 分片识别并拼接 `POST /ocr/doc/images`（`{ images:[base64], options? }`）→ `{ message, fullText, parts:[{ success, text, words }] }`

**试卷切题识别（paper_cut_edu）**
- `POST /paper-cut`（`{ filename, options? }`）→ `{ message, questions:[{ type, stem, answer, options, bbox, probability }], rawResponse }`

**手写文字识别（handwriting）**
- 区域裁剪图片识别 `POST /ocr/handwriting/images`（`{ images:[base64], options? }`）→ `{ message, results:[{ success, text, words }] }`
- 整图识别 `POST /ocr/handwriting`（`{ filename, options? }`）→ `{ message, text, words }`

**通用文字识别（高精度版 accurate_basic）**
- 区域裁剪图片识别 `POST /ocr/accurate/images`（`{ images:[base64], options? }`）→ `{ message, results:[{ success, text, words }] }`
- 整图识别 `POST /ocr/accurate`（`{ filename, options? }`）→ `{ message, text, words }`

**通用文字识别（标准版 general_basic）**
- 区域裁剪图片识别 `POST /ocr/general/images`（`{ images:[base64], options? }`）→ `{ message, results:[{ success, text, words }] }`
- 整图识别 `POST /ocr/general`（`{ filename, options? }`）→ `{ message, text, words }`

**通用区域识别（旧版）**
- `POST /ocr/areas`（`{ filename, areas:[{x,y,width,height}], options? }`）→ `{ message, results:[{ success, text, area, words }] }`
- 批量处理 `POST /batch`（FormData: `papers`）→ `{ message, results:[{ filename, originalname, success, answers, fullText, error }] }`
  - `originalname` 已按 Latin-1→UTF-8 解码，中文名不再乱码；前端批量详情展示预览、原始与过滤答案及题目状态。

## 日志规范
- 路径：`backend/log/`
- 文件名：`yyyyMMddHHmmss.log`
- 结构：`[ISO][level] message {json}`
- 记录项：
  - 上传：`upload_start/upload_end`（原文件名/大小/类型/保存路径）
  - doc_analysis：`doc_analysis_start/doc_analysis_end`（文件名、参数、耗时），失败 `doc_analysis_failed`，异常 `doc_analysis_exception`
  - 区域识别：`area_ocr_start/area_ocr_end`（区域数量、耗时），失败/异常
  - 切题识别：`paper_cut_edu_start/paper_cut_edu_end`（题目数、耗时），失败/异常
  - 手写/高精度/通用（整图与图片数组）均记录开始/结束/耗时，失败/异常含栈

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
- OCR 精度不稳定？建议清晰度≥300DPI；对符号（√/×）可用“手写文字识别”，并开启“高精度兜底”。
- 413 请求体过大？减少裁剪图片数量或尺寸，或改用“整图识别”。
- 令牌获取失败？确认已设置 `BAIDU_OCR_API_KEY` 与 `BAIDU_OCR_SECRET_KEY`，重启终端使其生效。
- 4K 显示过小？已使用 `clamp()` 动态字号与间距；如需更大字号，可在 `_variables.scss` 中调整。
