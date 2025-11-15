const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const baiduOCR = require('./services/baiduOCR');
const Logger = require('./utils/logger');

const app = express();
const PORT = 3000;
const logger = new Logger();

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// 创建上传目录
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
logger.write('server_init');

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// 简单的路由
app.get('/', (req, res) => {
  logger.write('ping_root');
  res.json({ message: '校园试卷自动判分系统后端服务启动成功！' });
});

// 文件上传接口
app.post('/upload', upload.single('paper'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传试卷图片' });
  logger.write('upload_success', { file: req.file.filename });
  res.json({ message: '试卷上传成功', filename: req.file.filename, path: req.file.path });
});

// OCR识别接口（集成百度OCR）
app.post('/ocr', async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: '请提供文件名' });
    }

    const imagePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const result = await baiduOCR.analyzePaperAnswers(imagePath);
    
    if (result.success) {
      logger.write('ocr_success', { answersCount: (result.answers || []).length });
      res.json({ message: 'OCR识别成功', answers: result.answers, fullText: result.fullText, words: result.words });
    } else {
      logger.write('ocr_failed', { error: result.error });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.write('ocr_exception', { error: error.message });
    res.status(500).json({ error: 'OCR识别失败: ' + error.message });
  }
});

// 试卷评分接口
app.post('/grade', async (req, res) => {
  try {
    const { answers, studentAnswers } = req.body;
    let score = 0;
    let totalScore = 0;
    for (let i = 0; i < answers.length; i++) {
      totalScore += answers[i].score;
      if (studentAnswers[i] && studentAnswers[i].trim() === answers[i].answer.trim()) {
        score += answers[i].score;
      }
    }
    logger.write('grade_done', { score, totalScore });
    res.json({ score, totalScore, percentage: Math.round((score / totalScore) * 100) });
  } catch (error) {
    logger.write('grade_failed', { error: error.message });
    res.status(500).json({ error: '评分失败' });
  }
});

app.listen(PORT, () => {
  logger.write('server_start', { port: PORT });
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;