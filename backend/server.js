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
    const { filename, options } = req.body;
    if (!filename) {
      return res.status(400).json({ error: '请提供文件名' });
    }

    const imagePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const result = await baiduOCR.analyzePaperAnswers(imagePath, [], options || {});
    
    if (result.success) {
      logger.write('ocr_success', { answersCount: (result.answers || []).length });
      res.json({ message: 'OCR识别成功', answers: result.answers, fullText: result.fullText, words: result.words, rawResponse: result.rawResponse });
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

// 区域OCR识别接口
app.post('/ocr/areas', async (req, res) => {
  try {
    const { filename, areas, options } = req.body;
    if (!filename || !areas || !Array.isArray(areas)) {
      return res.status(400).json({ error: '请提供文件名和区域信息' });
    }

    const imagePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const results = [];
    for (const area of areas) {
      const result = await baiduOCR.analyzeArea(imagePath, area, options || {});
      results.push(result);
    }
    
    logger.write('area_ocr_success', { areasCount: areas.length });
    res.json({ message: '区域OCR识别成功', results });
  } catch (error) {
    logger.write('area_ocr_failed', { error: error.message });
    res.status(500).json({ error: '区域OCR识别失败: ' + error.message });
  }
});

// 试卷切题识别（paper_cut_edu）
app.post('/paper-cut', async (req, res) => {
  try {
    const { filename, options } = req.body;
    if (!filename) return res.status(400).json({ error: '请提供文件名' });
    const imagePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(imagePath)) return res.status(404).json({ error: '文件不存在' });

    const result = await baiduOCR.paperCutEdu(imagePath, options || {});
    if (result.success) {
      logger.write('paper_cut_success', { questions: result.questions.length });
      res.json({ message: '试卷切题识别成功', questions: result.questions, rawResponse: result.rawResponse });
    } else {
      logger.write('paper_cut_failed', { error: result.error });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.write('paper_cut_exception', { error: error.message });
    res.status(500).json({ error: '试卷切题识别失败: ' + error.message });
  }
});

// 批量处理接口
app.post('/batch', upload.array('papers'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '请上传试卷文件' });
    }

    const results = [];
    for (const file of req.files) {
      try {
        const ocrResult = await baiduOCR.analyzePaperAnswers(file.path);
        if (ocrResult.success) {
          results.push({
            filename: file.filename,
            originalname: file.originalname,
            success: true,
            answers: ocrResult.answers,
            fullText: ocrResult.fullText
          });
        } else {
          results.push({
            filename: file.filename,
            originalname: file.originalname,
            success: false,
            error: ocrResult.error
          });
        }
      } catch (error) {
        results.push({
          filename: file.filename,
          originalname: file.originalname,
          success: false,
          error: error.message
        });
      }
    }
    
    logger.write('batch_process_done', { totalFiles: req.files.length, successCount: results.filter(r => r.success).length });
    res.json({ message: '批量处理完成', results });
  } catch (error) {
    logger.write('batch_process_failed', { error: error.message });
    res.status(500).json({ error: '批量处理失败: ' + error.message });
  }
});

app.listen(PORT, () => {
  logger.write('server_start', { port: PORT });
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;