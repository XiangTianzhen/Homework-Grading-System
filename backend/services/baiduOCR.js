const axios = require('axios');
const fs = require('fs');

// 百度OCR配置
const BAIDU_OCR_CONFIG = {
  apiKey: process.env.BAIDU_OCR_API_KEY,
  secretKey: process.env.BAIDU_OCR_SECRET_KEY,
  ocrUrl: 'https://aip.baidubce.com/rest/2.0/ocr/v1/doc_analysis'
};

class BaiduOCRService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // 获取访问令牌
  async getAccessToken() {
    if (!BAIDU_OCR_CONFIG.apiKey || !BAIDU_OCR_CONFIG.secretKey) {
      throw new Error('缺少环境变量 BAIDU_OCR_API_KEY 或 BAIDU_OCR_SECRET_KEY');
    }
    // 如果令牌还有效，直接返回
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.get('https://aip.baidubce.com/oauth/2.0/token', {
        params: {
          grant_type: 'client_credentials',
          client_id: BAIDU_OCR_CONFIG.apiKey,
          client_secret: BAIDU_OCR_CONFIG.secretKey
        }
      });

      this.accessToken = response.data.access_token;
      // 设置令牌过期时间（提前5分钟过期）
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('获取访问令牌失败:', error.response?.data || error.message);
      throw new Error('无法获取百度OCR访问令牌');
    }
  }

  // 识别手写文字
  async recognizeHandwriting(imagePath) {
    try {
      const accessToken = await this.getAccessToken();
      
      // 读取图片文件
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      const params = new URLSearchParams();
      params.set('image', base64Image);
      params.set('language_type', 'CHN_ENG');
      params.set('result_type', 'big');
      params.set('detect_direction', 'true');
      params.set('words_type', 'handprint_mix');
      params.set('line_probability', 'true');
      params.set('disp_line_poly', 'true');
      params.set('layout_analysis', 'true');
      params.set('recg_formula', 'true');
      params.set('recg_long_division', 'true');
      params.set('disp_underline_analysis', 'true');

      const response = await axios.post(
        `${BAIDU_OCR_CONFIG.ocrUrl}?access_token=${accessToken}`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const data = response.data || {};
      let lines = [];
      let wordsWithPosition = [];

      if (Array.isArray(data.words_result)) {
        lines = data.words_result.map(item => item.words || '');
        wordsWithPosition = data.words_result.map(item => ({
          text: item.words || '',
          confidence: (item.probability && item.probability.average) || 0,
          position: item.location || null
        }));
      } else if (Array.isArray(data.results)) {
        lines = data.results.map(item => item.text || item.content || (item.words && item.words.join('')) || '');
        wordsWithPosition = data.results.map(item => {
          const poly = item.disp_line_poly && item.disp_line_poly.points;
          let position = item.location || null;
          if (!position && Array.isArray(poly) && poly.length > 0) {
            const xs = poly.map(p => p.x);
            const ys = poly.map(p => p.y);
            const left = Math.min.apply(null, xs);
            const top = Math.min.apply(null, ys);
            const right = Math.max.apply(null, xs);
            const bottom = Math.max.apply(null, ys);
            position = { left, top, width: right - left, height: bottom - top };
          }
          return {
            text: item.text || item.content || (item.words && item.words.join('')) || '',
            confidence: (item.probability && item.probability.average) || item.confidence || 0,
            position
          };
        });
      }

      lines = lines.map(s => (typeof s === 'string' ? s.trim() : '')).filter(s => s.length > 0);
      if (lines.length === 0) {
        return { success: false, error: '未识别到文字', rawResponse: data };
      }

      return {
        success: true,
        text: lines.join('\n'),
        words: wordsWithPosition,
        rawResponse: data
      };
    } catch (error) {
      console.error('OCR识别失败:', error.response?.data || error.message);
      return {
        success: false,
        error: 'OCR识别失败: ' + (error.response?.data?.error_msg || error.message)
      };
    }
  }

  // 分析试卷答案（根据位置信息）
  async analyzePaperAnswers(imagePath, questionAreas = []) {
    try {
      const ocrResult = await this.recognizeHandwriting(imagePath);
      
      if (!ocrResult.success) {
        return ocrResult;
      }

      // 如果没有指定题目区域，返回所有识别到的文字
      if (questionAreas.length === 0) {
        return {
          success: true,
          answers: [ocrResult.text],
          fullText: ocrResult.text,
          words: ocrResult.words
        };
      }

      // 根据题目区域提取答案
      const answers = [];
      for (const area of questionAreas) {
        const areaText = ocrResult.words
          .filter(word => this.isWordInArea(word, area))
          .map(word => word.text)
          .join('');
        answers.push(areaText);
      }

      return {
        success: true,
        answers: answers,
        fullText: ocrResult.text,
        words: ocrResult.words
      };
    } catch (error) {
      return {
        success: false,
        error: '分析试卷失败: ' + error.message
      };
    }
  }

  // 判断文字是否在指定区域内
  isWordInArea(word, area) {
    const pos = word.position || {};
    const wordCenterX = (pos.left + (pos.width || 0) / 2);
    const wordCenterY = (pos.top + (pos.height || 0) / 2);
    return wordCenterX >= area.x && 
           wordCenterX <= area.x + area.width &&
           wordCenterY >= area.y && 
           wordCenterY <= area.y + area.height;
  }

  // 分析指定区域
  async analyzeArea(imagePath, area) {
    try {
      const ocrResult = await this.recognizeHandwriting(imagePath);
      
      if (!ocrResult.success) {
        return ocrResult;
      }

      // 提取区域内的文字
      const areaText = ocrResult.words
        .filter(word => this.isWordInArea(word, area))
        .map(word => word.text)
        .join('');

      return {
        success: true,
        text: areaText,
        area: area,
        words: ocrResult.words.filter(word => this.isWordInArea(word, area)),
        rawResponse: ocrResult.rawResponse
      };
    } catch (error) {
      return {
        success: false,
        error: '区域分析失败: ' + error.message
      };
    }
  }
}

module.exports = new BaiduOCRService();