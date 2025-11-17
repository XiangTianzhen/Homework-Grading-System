## 将新增并完善的内容

* **后端结构与职责**：列出 `backend/` 目录树与关键文件（`server.js`、`services/baiduOCR.js`、`utils/logger.js`），说明职责与调用关系。

* **API接口文档**：逐个接口（`GET /`、`POST /upload`、`POST /ocr`、`POST /grade`、`POST /ocr/areas`、`POST /batch`）写明请求方法、路径、请求体与响应示例、错误码与日志事件键。

* **OCR工具与配置**：详细说明百度OCR使用的 API 与参数、获取 `access_token` 的流程、环境变量 `BAIDU_OCR_API_KEY/BAIDU_OCR_SECRET_KEY` 的配置方法（Windows/Powershell）、官方文档链接与端点地址。

* **日志规范**：统一日志文件路径与内容项（事件名、文件名、区域坐标、文本与得分、耗时）。

* **Git提交流程与规则**：

  * 远程命名与使用（`github`、`gitee`）

  * 提交规范：中文语义化，类型（feat/fix/docs/style/refactor/test/build/chore）、scope与消息模板、示例

  * 分支与PR流程：分支命名、提测、PR、合并、同步两端远程

  * PowerShell 命令链注意事项（`;` 分隔）

* **前端路由与页面约定**：说明 `/workspace` 与 `/generator` 路由职责、`AppShell.vue` 导航、生成器仅在 `/generator` 展示约束。

* **样式与SCSS嵌套规范**：重申嵌套写法强制、变量与混入位置、4K与移动端适配要求。

* **注释规范**：JS 与 SCSS 注释原则（简洁、功能说明、关键函数/区块）。

## 输出位置

* 直接更新 `c:\Projects\作业批改系统\.trae\rules\project_rules.md`，按 `user_rules.md` 风格分节编排，条目清晰、示例充分、路径与命令可直接复制。

## 验证

* 完成后我会复核 README 是否需要同步新增的链接或说明，并在必要时建议更新（不强制创建新文档）。

## 请求确认

* 是否同意我按上述内容完善并写入项目规则文件？确认后我将立即实施。

