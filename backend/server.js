const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const baiduOCR = require('./services/baiduOCR');
const Logger = require('./utils/logger');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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
      if ((result.error || '').includes('未识别到文字')) {
        res.json({ message: '未识别到文字', answers: [], fullText: '', words: [] });
      } else {
        res.status(500).json({ error: result.error });
      }
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

// 手写识别：按区域输出答案
app.post('/ocr/handwriting/areas', async (req, res) => {
  try {
    const { filename, areas, options } = req.body;
    if (!filename || !Array.isArray(areas)) return res.status(400).json({ error: '请提供文件名与区域列表' });
    const imagePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(imagePath)) return res.status(404).json({ error: '文件不存在' });

    const result = await baiduOCR.handwritingAreas(imagePath, areas, options || {});
    if (result.success) {
      logger.write('handwriting_areas_success', { areasCount: areas.length });
      res.json({ message: '手写区域识别成功', results: result.results, rawResponse: result.rawResponse });
    } else {
      logger.write('handwriting_areas_failed', { error: result.error });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.write('handwriting_areas_exception', { error: error.message });
    res.status(500).json({ error: '手写区域识别失败: ' + error.message });
  }
});

// 高精度识别：按区域输出答案
app.post('/ocr/accurate/areas', async (req, res) => {
  try {
    const { filename, areas, options } = req.body;
    if (!filename || !Array.isArray(areas)) return res.status(400).json({ error: '请提供文件名与区域列表' });
    const imagePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(imagePath)) return res.status(404).json({ error: '文件不存在' });

    const result = await baiduOCR.accurateBasicAreas(imagePath, areas, options || {});
    if (result.success) {
      logger.write('accurate_areas_success', { areasCount: areas.length });
      res.json({ message: '高精度区域识别成功', results: result.results, rawResponse: result.rawResponse });
    } else {
      logger.write('accurate_areas_failed', { error: result.error });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.write('accurate_areas_exception', { error: error.message });
    res.status(500).json({ error: '高精度区域识别失败: ' + error.message });
  }
});

// 试卷分析与识别：按图片数组识别并拼接
app.post('/ocr/doc/images', async (req, res) => {
  try {
    const { images, options } = req.body;
    if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: '请提供图片数组' });
    const result = await baiduOCR.docImages(images, options || {});
    if (result.success) {
      const fullText = (result.results || []).map(r => (r.text || '')).join('\n');
      res.json({ message: 'doc_analysis 拼接识别成功', fullText, parts: result.results });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: 'doc_analysis 图片识别失败: ' + error.message });
  }
});

// 手写/高精度/通用：整图识别（filename）
app.post('/ocr/handwriting', async (req, res) => {
  try {
    const { filename, options } = req.body;
    if (!filename) return res.status(400).json({ error: '请提供文件名' });
    const imagePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(imagePath)) return res.status(404).json({ error: '文件不存在' });
    const result = await baiduOCR.handwritingOnly({ path: imagePath }, options || {});
    res.json(result.success ? { message: '手写整图识别成功', text: result.text, words: result.words } : { error: result.error });
  } catch (error) { res.status(500).json({ error: '手写整图识别失败: ' + error.message }) }
});

app.post('/ocr/accurate', async (req, res) => {
  try {
    const { filename, options } = req.body;
    if (!filename) return res.status(400).json({ error: '请提供文件名' });
    const imagePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(imagePath)) return res.status(404).json({ error: '文件不存在' });
    const result = await baiduOCR.accurateBasicOnly({ path: imagePath }, options || {});
    res.json(result.success ? { message: '高精度整图识别成功', text: result.text, words: result.words } : { error: result.error });
  } catch (error) { res.status(500).json({ error: '高精度整图识别失败: ' + error.message }) }
});

app.post('/ocr/general', async (req, res) => {
  try {
    const { filename, options } = req.body;
    if (!filename) return res.status(400).json({ error: '请提供文件名' });
    const imagePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(imagePath)) return res.status(404).json({ error: '文件不存在' });
    const result = await baiduOCR.generalBasicOnly({ path: imagePath }, options || {});
    res.json(result.success ? { message: '通用整图识别成功', text: result.text, words: result.words } : { error: result.error });
  } catch (error) { res.status(500).json({ error: '通用整图识别失败: ' + error.message }) }
});

// 手写识别：直接按图片数组识别
app.post('/ocr/handwriting/images', async (req, res) => {
  try {
    const { images, options } = req.body;
    if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: '请提供图片数组' });
    const result = await baiduOCR.handwritingImages(images, options || {});
    if (result.success) res.json({ message: '手写图片识别成功', results: result.results });
    else res.status(500).json({ error: result.error });
  } catch (error) {
    res.status(500).json({ error: '手写图片识别失败: ' + error.message });
  }
});

// 高精度识别：直接按图片数组识别
app.post('/ocr/accurate/images', async (req, res) => {
  try {
    const { images, options } = req.body;
    if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: '请提供图片数组' });
    const result = await baiduOCR.accurateBasicImages(images, options || {});
    if (result.success) res.json({ message: '高精度图片识别成功', results: result.results });
    else res.status(500).json({ error: result.error });
  } catch (error) {
    res.status(500).json({ error: '高精度图片识别失败: ' + error.message });
  }
});

// 通用识别：直接按图片数组识别
app.post('/ocr/general/images', async (req, res) => {
  try {
    const { images, options } = req.body;
    if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: '请提供图片数组' });
    const result = await baiduOCR.generalBasicImages(images, options || {});
    if (result.success) res.json({ message: '通用图片识别成功', results: result.results });
    else res.status(500).json({ error: result.error });
  } catch (error) {
    res.status(500).json({ error: '通用图片识别失败: ' + error.message });
  }
});

// 通用识别（标准版）：按区域输出答案
app.post('/ocr/general/areas', async (req, res) => {
  try {
    const { filename, areas, options } = req.body;
    if (!filename || !Array.isArray(areas)) return res.status(400).json({ error: '请提供文件名与区域列表' });
    const imagePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(imagePath)) return res.status(404).json({ error: '文件不存在' });

    const result = await baiduOCR.generalBasicAreas(imagePath, areas, options || {});
    if (result.success) {
      logger.write('general_areas_success', { areasCount: areas.length });
      res.json({ message: '通用区域识别成功', results: result.results, rawResponse: result.rawResponse });
    } else {
      logger.write('general_areas_failed', { error: result.error });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.write('general_areas_exception', { error: error.message });
    res.status(500).json({ error: '通用区域识别失败: ' + error.message });
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