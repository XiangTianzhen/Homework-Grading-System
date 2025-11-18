const axios = require('axios');
const fs = require('fs');

// 百度OCR配置（试卷分析与识别 doc_analysis）
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

  // 工具：从 source 获取 base64（支持 { path } 或 { base64 } 或 直接字符串）
  getImageBase64(source) {
    if (!source) throw new Error('缺少图片源');
    if (typeof source === 'string') {
      const idx = source.indexOf('base64,');
      if (idx >= 0) return source.substring(idx + 7);
      if (fs.existsSync(source)) {
        const buf = fs.readFileSync(source);
        return buf.toString('base64');
      }
      return source;
    }
    if (source.base64) {
      const s = source.base64;
      const idx = s.indexOf('base64,');
      return idx >= 0 ? s.substring(idx + 7) : s;
    }
    if (source.path) {
      const buf = fs.readFileSync(source.path);
      return buf.toString('base64');
    }
    throw new Error('无法解析图片源');
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

  // 试卷分析与识别（doc_analysis）
  async docAnalysis(imagePathOrBase64, options = {}) {
    try {
      const accessToken = await this.getAccessToken();
      const base64Image = this.getImageBase64(imagePathOrBase64);
      
      const params = new URLSearchParams();
      params.set('image', base64Image);
      params.set('language_type', options.language_type || 'CHN_ENG');
      params.set('result_type', options.result_type || 'big');
      params.set('detect_direction', options.detect_direction !== undefined ? String(options.detect_direction) : 'true');
      params.set('words_type', options.words_type || 'handprint_mix');
      params.set('line_probability', options.line_probability !== undefined ? String(options.line_probability) : 'true');
      params.set('disp_line_poly', options.disp_line_poly !== undefined ? String(options.disp_line_poly) : 'true');
      params.set('layout_analysis', options.layout_analysis !== undefined ? String(options.layout_analysis) : 'true');
      params.set('recg_formula', options.recg_formula !== undefined ? String(options.recg_formula) : 'true');
      params.set('recg_long_division', options.recg_long_division !== undefined ? String(options.recg_long_division) : 'true');
      params.set('disp_underline_analysis', options.disp_underline_analysis !== undefined ? String(options.disp_underline_analysis) : 'true');
      if (options.recg_alter !== undefined) params.set('recg_alter', String(options.recg_alter));

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
        lines = data.results.map(item => {
          const w = item.words;
          const wordsText = Array.isArray(w) ? w.join('') : (typeof w === 'string' ? w : '');
          return item.text || item.content || wordsText || '';
        });
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
          const w = item.words;
          const wordsText = Array.isArray(w) ? w.join('') : (typeof w === 'string' ? w : '');
          return {
            text: item.text || item.content || wordsText || '',
            confidence: (item.probability && item.probability.average) || item.confidence || 0,
            position
          };
        });
      }

      lines = lines.map(s => (typeof s === 'string' ? s.trim() : '')).filter(s => s.length > 0);
      if (lines.length === 0) {
        // 回退到高精度通用识别，提高无区域整图的可用性
        const fallbackAcc = await this.accurateBasicOnly(imagePathOrBase64, options);
        if (fallbackAcc && fallbackAcc.success) {
          return {
            success: true,
            text: fallbackAcc.text,
            words: fallbackAcc.words,
            rawResponse: { primary: data, fallback: 'accurate_basic' }
          };
        }
        const fallbackGen = await this.generalBasicOnly(imagePathOrBase64, options);
        if (fallbackGen && fallbackGen.success) {
          return {
            success: true,
            text: fallbackGen.text,
            words: fallbackGen.words,
            rawResponse: { primary: data, fallback: 'general_basic' }
          };
        }
        return { success: false, error: '未识别到文字', rawResponse: data };
      }

      return {
        success: true,
        text: lines.join('\n'),
        words: wordsWithPosition,
        rawResponse: data
      };
    } catch (error) {
      console.error('doc_analysis 识别失败:', error.response?.data || error.message);
      return {
        success: false,
        error: 'doc_analysis 识别失败: ' + (error.response?.data?.error_msg || error.message)
      };
    }
  }
  async docImages(imagesBase64, options = {}) {
    try {
      const results = []
      for (const img of imagesBase64) {
        const r = await this.docAnalysis({ base64: img }, options)
        results.push(r.success ? { success: true, text: r.text, words: r.words } : { success: false, error: r.error })
      }
      return { success: true, results }
    } catch (e) {
      return { success: false, error: 'doc_analysis 图片批量识别失败: ' + e.message }
    }
  }

  // 试卷切题识别（paper_cut_edu）
  async paperCutEdu(imagePathOrBase64, options = {}) {
    try {
      const accessToken = await this.getAccessToken();
      const base64Image = this.getImageBase64(typeof imagePathOrBase64 === 'string' ? imagePathOrBase64 : (imagePathOrBase64.base64 ? imagePathOrBase64 : { path: imagePathOrBase64 }));

      const params = new URLSearchParams();
      params.set('image', base64Image);
      // 默认参数设置（与 recognizeHandwriting 的风格一致）
      params.set('language_type', options.language_type || 'CHN_ENG');
      params.set('detect_direction', options.detect_direction !== undefined ? String(options.detect_direction) : 'false');
      params.set('words_type', options.words_type || 'handprint_mix');
      params.set('splice_text', options.splice_text !== undefined ? String(options.splice_text) : 'true');
      params.set('enhance', options.enhance !== undefined ? String(options.enhance) : 'true');

      const url = 'https://aip.baidubce.com/rest/2.0/ocr/v1/paper_cut_edu';
      const response = await axios.post(
        `${url}?access_token=${accessToken}`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const data = response.data || {};
      const questions = [];
      const typeMap = { 0: 'choice', 1: 'judge', 2: 'fill', 3: 'qa', 4: 'other' };

      if (Array.isArray(data.qus_result)) {
        for (const q of data.qus_result) {
          const t = typeMap[q.qus_type] || 'unknown';
          const elem = q.qus_element || [];
          let stem = '';
          let answer = '';
          let optionsText = '';
          // 优先使用 elem_text 聚合结果
          if (q.elem_text) {
            stem = q.elem_text.stem_text || stem;
            answer = q.elem_text.answer_text || answer;
            optionsText = q.elem_text.option_text || optionsText;
          }
          // 回退到元素逐项拼接
          if ((!stem || !answer) && Array.isArray(elem)) {
            for (const e of elem) {
              const lines = (e.elem_word || []).map(w => w.word || '').join('');
              if (e.elem_type === 0 && !stem) stem = lines;
              if (e.elem_type === 2 && !answer) answer = lines;
              if (e.elem_type === 3) optionsText += lines;
            }
          }

          // 位置转换：四点坐标转矩形
          let bbox = null;
          if (Array.isArray(q.qus_location)) {
            const xs = q.qus_location.map(p => p.x);
            const ys = q.qus_location.map(p => p.y);
            const left = Math.min.apply(null, xs);
            const top = Math.min.apply(null, ys);
            const right = Math.max.apply(null, xs);
            const bottom = Math.max.apply(null, ys);
            bbox = { left, top, width: right - left, height: bottom - top };
          }
          questions.push({ type: t, stem, answer, options: optionsText, bbox, probability: q.qus_probability });
        }
      }

      if (questions.length === 0) {
        return { success: false, error: '未识别到题目', rawResponse: data };
      }

      return { success: true, questions, rawResponse: data };
    } catch (error) {
      return { success: false, error: '试卷切题识别失败: ' + (error.response?.data?.error_msg || error.message) };
    }
  }

  async paperCutEduImages(imagesBase64, options = {}) {
    try {
      const results = []
      for (const img of imagesBase64) {
        const r = await this.paperCutEdu({ base64: img }, options)
        results.push(r.success ? { success: true, questions: r.questions } : { success: false, error: r.error })
      }
      return { success: true, results }
    } catch (e) {
      return { success: false, error: '试卷切题图片批量识别失败: ' + e.message }
    }
  }

  // 手写文字识别（handwriting）
  async handwritingOnly(imagePathOrBase64, options = {}) {
    try {
      const accessToken = await this.getAccessToken();
      const base64Image = this.getImageBase64(imagePathOrBase64);

      const params = new URLSearchParams();
      params.set('image', base64Image);
      if (options.recognize_granularity) params.set('recognize_granularity', options.recognize_granularity);
      if (options.probability !== undefined) params.set('probability', String(options.probability));
      if (options.detect_direction !== undefined) params.set('detect_direction', String(options.detect_direction));
      if (options.detect_alteration !== undefined) params.set('detect_alteration', String(options.detect_alteration));
      params.set('language_type', options.language_type || 'CHN_ENG');

      const url = 'https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting';
      const response = await axios.post(
        `${url}?access_token=${accessToken}`,
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
        lines = data.results.map(item => item.text || item.content || '');
        wordsWithPosition = data.results.map(item => ({
          text: item.text || item.content || '',
          confidence: item.confidence || 0,
          position: item.location || null
        }));
      }

      lines = lines.map(s => (typeof s === 'string' ? s.trim() : '')).filter(s => s.length > 0);
      if (lines.length === 0) {
        return { success: false, error: '未识别到手写文字', rawResponse: data };
      }
      return { success: true, text: lines.join('\n'), words: wordsWithPosition, rawResponse: data };
    } catch (error) {
      return { success: false, error: '手写识别失败: ' + (error.response?.data?.error_msg || error.message) };
    }
  }

  async handwritingAreas(imagePath, areas, options = {}) {
    try {
      const ocrResult = await this.handwritingOnly(imagePath, options);
      if (!ocrResult.success) return ocrResult;
      const results = [];
      for (const area of areas) {
        const words = ocrResult.words.filter(w => this.isWordInArea(w, area));
        const text = words.map(w => w.text).join('');
        results.push({ success: true, text, area, words });
      }
      return { success: true, results, rawResponse: ocrResult.rawResponse };
    } catch (error) {
      return { success: false, error: '手写区域识别失败: ' + error.message };
    }
  }

  async handwritingImages(imagesBase64, options = {}) {
    try {
      const results = []
      for (const img of imagesBase64) {
        const r = await this.handwritingOnly({ base64: img }, options)
        results.push(r.success ? { success: true, text: r.text, words: r.words } : { success: false, error: r.error })
      }
      return { success: true, results }
    } catch (e) {
      return { success: false, error: '手写图片批量识别失败: ' + e.message }
    }
  }

  // 通用文字识别（高精度版） accurate_basic
  async accurateBasicOnly(imagePathOrBase64, options = {}) {
    try {
      const accessToken = await this.getAccessToken();
      const base64Image = this.getImageBase64(imagePathOrBase64);

      const params = new URLSearchParams();
      params.set('image', base64Image);
      params.set('language_type', options.language_type || 'CHN_ENG');
      if (options.detect_direction !== undefined) params.set('detect_direction', String(options.detect_direction));
      if (options.paragraph !== undefined) params.set('paragraph', String(options.paragraph));
      if (options.probability !== undefined) params.set('probability', String(options.probability));
      if (options.multidirectional_recognize !== undefined) params.set('multidirectional_recognize', String(options.multidirectional_recognize));

      const url = 'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic';
      const response = await axios.post(
        `${url}?access_token=${accessToken}`,
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
      }
      lines = lines.map(s => (typeof s === 'string' ? s.trim() : '')).filter(s => s.length > 0);
      if (lines.length === 0) {
        return { success: false, error: '未识别到文字', rawResponse: data };
      }
      return { success: true, text: lines.join('\n'), words: wordsWithPosition, rawResponse: data };
    } catch (error) {
      return { success: false, error: '高精度识别失败: ' + (error.response?.data?.error_msg || error.message) };
    }
  }

  async accurateBasicAreas(imagePath, areas, options = {}) {
    try {
      const ocrResult = await this.accurateBasicOnly(imagePath, options);
      if (!ocrResult.success) return ocrResult;
      const results = [];
      for (const area of areas) {
        const words = ocrResult.words.filter(w => this.isWordInArea(w, area));
        const text = words.map(w => w.text).join('');
        results.push({ success: true, text, area, words });
      }
      return { success: true, results, rawResponse: ocrResult.rawResponse };
    } catch (error) {
      return { success: false, error: '高精度区域识别失败: ' + error.message };
    }
  }

  async accurateBasicImages(imagesBase64, options = {}) {
    try {
      const results = []
      for (const img of imagesBase64) {
        const r = await this.accurateBasicOnly({ base64: img }, options)
        results.push(r.success ? { success: true, text: r.text, words: r.words } : { success: false, error: r.error })
      }
      return { success: true, results }
    } catch (e) {
      return { success: false, error: '高精度图片批量识别失败: ' + e.message }
    }
  }

  // 通用文字识别（标准版） general_basic
  async generalBasicOnly(imagePathOrBase64, options = {}) {
    try {
      const accessToken = await this.getAccessToken();
      const base64Image = this.getImageBase64(imagePathOrBase64);

      const params = new URLSearchParams();
      params.set('image', base64Image);
      params.set('language_type', options.language_type || 'CHN_ENG');
      if (options.detect_direction !== undefined) params.set('detect_direction', String(options.detect_direction));
      if (options.detect_language !== undefined) params.set('detect_language', String(options.detect_language));
      if (options.paragraph !== undefined) params.set('paragraph', String(options.paragraph));
      if (options.probability !== undefined) params.set('probability', String(options.probability));

      const url = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';
      const response = await axios.post(
        `${url}?access_token=${accessToken}`,
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
      }
      lines = lines.map(s => (typeof s === 'string' ? s.trim() : '')).filter(s => s.length > 0);
      if (lines.length === 0) {
        return { success: false, error: '未识别到文字', rawResponse: data };
      }
      return { success: true, text: lines.join('\n'), words: wordsWithPosition, rawResponse: data };
    } catch (error) {
      return { success: false, error: '通用识别失败: ' + (error.response?.data?.error_msg || error.message) };
    }
  }

  async generalBasicAreas(imagePath, areas, options = {}) {
    try {
      const ocrResult = await this.generalBasicOnly(imagePath, options);
      if (!ocrResult.success) return ocrResult;
      const results = [];
      for (const area of areas) {
        const words = ocrResult.words.filter(w => this.isWordInArea(w, area));
        const text = words.map(w => w.text).join('');
        results.push({ success: true, text, area, words });
      }
      return { success: true, results, rawResponse: ocrResult.rawResponse };
    } catch (error) {
      return { success: false, error: '通用区域识别失败: ' + error.message };
    }
  }

  async generalBasicImages(imagesBase64, options = {}) {
    try {
      const results = []
      for (const img of imagesBase64) {
        const r = await this.generalBasicOnly({ base64: img }, options)
        results.push(r.success ? { success: true, text: r.text, words: r.words } : { success: false, error: r.error })
      }
      return { success: true, results }
    } catch (e) {
      return { success: false, error: '通用图片批量识别失败: ' + e.message }
    }
  }

  // 分析试卷答案（根据位置信息）
  async analyzePaperAnswers(imagePath, questionAreas = [], options = {}) {
    try {
      const ocrResult = await this.docAnalysis({ path: imagePath }, options);
      
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
    const wl = pos.left || 0;
    const wt = pos.top || 0;
    const ww = pos.width || 0;
    const wh = pos.height || 0;
    const al = area.x;
    const at = area.y;
    const aw = area.width;
    const ah = area.height;
    // 中心点命中
    const cx = wl + ww / 2;
    const cy = wt + wh / 2;
    const centerHit = (cx >= al && cx <= al + aw && cy >= at && cy <= at + ah);
    // 矩形相交（行框覆盖区域也算命中）
    const overlap = !(wl + ww < al || al + aw < wl || wt + wh < at || at + ah < wt);
    return centerHit || overlap;
  }

  // 分析指定区域
  async analyzeArea(imagePath, area, options = {}) {
    try {
      const ocrResult = await this.docAnalysis({ path: imagePath }, options);
      
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