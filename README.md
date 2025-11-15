# 校园试卷自动判分系统

## 项目简介
基于目标检测与手写OCR的校园试卷自动判分系统，使用Vue2和Node.js开发。

## 技术栈
- **前端**: Vue2 + HTML5 + CSS3
- **后端**: Node.js + Express
- **OCR API**: 百度智能云手写识别

## 项目结构
```
校园试卷自动判分系统/
├── frontend/          # 前端代码
│   └── index.html    # 主页面
├── backend/          # 后端代码
│   ├── server.js     # 服务器主文件
│   └── package.json  # 后端依赖
├── uploads/          # 上传文件目录
└── package.json      # 项目配置
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

访问 http://localhost:3000 查看后端服务
直接打开 frontend/index.html 查看前端页面

## 功能特点
- ✅ 拖拽上传试卷图片
- ✅ 图片预览功能
- ✅ OCR手写文字识别
- ✅ 自动评分计算
- ✅ 结果可视化展示

## 使用说明
1. 上传试卷图片（支持拖拽）
2. 点击"开始识别"进行OCR文字识别
3. 点击"开始评分"进行自动判分
4. 查看评分结果和正确率

## 学习资源
- [Vue2官方文档](https://cn.vuejs.org/v2/guide/)
- [Node.js教程](https://nodejs.org/zh-cn/docs/guides/)
- [百度OCR文档](https://cloud.baidu.com/doc/OCR/index.html)

## 后续优化建议
1. 添加更多题型支持
2. 提高OCR识别准确率
3. 添加错题分析功能
4. 支持批量处理