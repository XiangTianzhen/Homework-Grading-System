# 校园试卷自动判分系统

## 项目简介
基于目标检测与手写OCR的校园试卷自动判分系统，使用Vue3 + Vite 与 Node.js开发。

## 技术栈
- **前端**: Vue3 + Vite + HTML5 + CSS3
- **后端**: Node.js + Express
- **OCR API**: 百度智能云手写识别

## 项目结构
```
校园试卷自动判分系统/
├── frontend/                # 前端代码（Vite + Vue3）
│   ├── index.html           # 前端入口
│   ├── package.json         # 前端依赖
│   └── src/
│       ├── main.js
│       ├── App.vue
│       └── components/
│           ├── AnswerEditor.vue
│           ├── AreaSelector.vue
│           ├── BatchUpload.vue
│           ├── ErrorBook.vue
│           ├── HistoryPanel.vue
│           ├── ProgressBar.vue
│           ├── QuestionTypeSelector.vue
│           ├── ResultCard.vue
│           └── TestImageGenerator.vue   # 测试图片生成器（内置）
├── backend/                # 后端代码
│   ├── server.js           # 服务器主文件
│   └── package.json        # 后端依赖
├── uploads/                # 上传文件目录
└── package.json            # 顶层项目配置
```

## 快速开始

### 1. 安装依赖
```bash
# 进入后端目录
cd backend
npm install

# 返回根目录
cd ..

# 安装并发运行工具
npm install
```

### 2. 配置百度OCR（可选）
1. 访问 [百度智能云](https://cloud.baidu.com/product/ocr)
2. 注册账号并创建应用
3. 获取API Key和Secret Key
4. 在backend/server.js中配置

### 3. 启动项目
```bash
npm run dev
```

访问后端服务：`http://localhost:3000`
前端开发服务：运行后访问 `http://localhost:5173`

## 功能特点
- ✅ 拖拽上传试卷图片
- ✅ 图片预览功能
- ✅ OCR手写文字识别
- ✅ 自动评分计算
- ✅ 结果可视化展示
- ✅ 区域框选识别
- ✅ 批量上传处理
- ✅ 错题本管理
- ✅ 历史记录管理
- ✅ 题型设置
- ✅ 测试图片生成器（前端内置）
- ✅ OCR识别结果面板（常驻按钮切换显示）

## 使用说明
- 首页左侧常驻显示“试卷图片生成器”，无需上传即可生成测试图片。
- 上传试卷图片（支持拖拽），点击`开始识别`进行OCR文字识别，再点击`开始评分`进行自动判分。
- 使用`显示OCR结果`常驻按钮切换识别结果面板，便于测试。
- 生成器在题目包含`=`时将自动绘制下划线占位（___），用于答案留空。
- 页面容器宽度铺满屏幕；4K 与移动端均已适配。
- 生成器设置默认折叠，通过“显示设置/隐藏设置”按钮切换。

## 学习资源
- [Vue2官方文档](https://cn.vuejs.org/v2/guide/)
- [Node.js教程](https://nodejs.org/zh-cn/docs/guides/)
- [百度OCR文档](https://cloud.baidu.com/doc/OCR/index.html)

## 后续优化建议
1. 添加更多题型支持
2. 提高OCR识别准确率
3. 丰富错题分析功能
4. 增强高分辨率适配与打印布局（当前已支持4K与移动端双布局）