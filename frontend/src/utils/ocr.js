/**
 * OCR 工具库（前端）：统一几何、文本与各模型识别流程，并提供共享状态组合函数
 */
import { ref } from 'vue'
/**
 * 后端 API 封装（frontend/src/api）
 */
import {
  recognizeOCR,           // doc_analysis 整图识别（POST /ocr）
  recognizeOCRWithAreas,  // doc_analysis 选区/分片识别（POST /ocr/areas 或 /ocr/doc/images）
  paperCutEdu,            // 试卷切题识别（POST /paper-cut）
  paperCutByImages,       // 试卷切题按图片数组识别（分片）
  handwritingAreas,       // 手写识别（区域）（POST /ocr/handwriting/areas）
  handwritingWhole,       // 手写识别（整图）（POST /ocr/handwriting）
  accurateAreas,          // 高精度版（区域）（POST /ocr/accurate/areas）
  accurateWhole,          // 高精度版（整图）（POST /ocr/accurate）
  accurateByImages,       // 高精度版（图片数组）（POST /ocr/accurate/images）
  generalAreas,           // 标准版（区域）（POST /ocr/general/areas）
  generalWhole,           // 标准版（整图）（POST /ocr/general）
  generalByImages         // 标准版（图片数组）（POST /ocr/general/images）
} from '../api'

/**
 * 默认识别选项（各模型）
 * doc_analysis 参数含义（官方文档参考：https://cloud.baidu.com/doc/OCR/index.html）：
 * - language_type：语言类型（如 `CHN_ENG` 为中英文混合）
 * - result_type：返回结构类型（`big` 包含行/词位置信息等完整结构）
 * - detect_direction：是否检测图像朝向
 * - line_probability：是否返回每行识别置信度
 * - disp_line_poly：是否返回每行四角点坐标（polygon）
 * - words_type：文字类型（`handprint_mix` 手写与印刷混合）
 * - layout_analysis：版面结构分析
 * - recg_formula：数学公式识别
 * - recg_long_division：竖式除法识别
 * - disp_underline_analysis：下划线/填空位分析显示
 * - recg_alter：涂改/篡改识别
 */
const DEFAULT_DOC_OPTIONS = {
  language_type: 'CHN_ENG',       // 语言类型（中英文混合）
  result_type: 'big',             // 返回结构类型：包含行/词位置与结构
  detect_direction: true,         // 检测图像朝向
  line_probability: true,         // 行级识别置信度
  disp_line_poly: true,           // 返回每行四角点坐标
  words_type: 'handprint_mix',    // 文字类型：手写/印刷混合
  layout_analysis: true,          // 版面结构分析
  recg_formula: true,             // 数学公式识别
  recg_long_division: true,       // 竖式除法识别
  disp_underline_analysis: true,  // 下划线/填空位分析
  recg_alter: false               // 涂改/篡改识别
}
const DEFAULT_PAPER_OPTIONS = {
  language_type: 'CHN_ENG',       // 语言类型
  detect_direction: false,        // 朝向检测（通常关闭以提升速度）
  words_type: 'handprint_mix',    // 文字类型：手写/印刷混合
  splice_text: true,              // 分片结果文本拼接
  enhance: true                   // 增强识别（图像预处理）
}
const DEFAULT_HANDWRITING_OPTIONS = {
  language_type: 'CHN_ENG',       // 语言类型
  recognize_granularity: 'big',   // 粒度：按行/段（big）
  probability: false,             // 返回置信度
  detect_direction: false,        // 朝向检测
  detect_alteration: false        // 涂改检测
}
const DEFAULT_ACCURATE_OPTIONS = {
  language_type: 'CHN_ENG',            // 语言类型
  detect_direction: false,             // 朝向检测
  paragraph: false,                    // 段落信息输出
  probability: false,                  // 返回置信度
  multidirectional_recognize: false    // 多方向识别
}
const DEFAULT_GENERAL_OPTIONS = {
  language_type: 'CHN_ENG',       // 语言类型
  detect_direction: false,        // 朝向检测
  detect_language: false,         // 自动检测语言
  paragraph: false,               // 段落信息输出
  probability: false              // 返回置信度
}

/**
 * 选区减去屏蔽区域，返回可用裁剪块（避免相交覆盖）
 * @param {Array<{x:number,y:number,width:number,height:number}>} areas
 * @param {Array<{x:number,y:number,width:number,height:number}>} masks
 * @returns 同结构的非覆盖子矩形数组
 */
export function areasMinusMasks(areas, masks) {
  const res = []
  for (const a of areas || []) {
    const xs = [a.x, a.x + a.width]
    const ys = [a.y, a.y + a.height]
    for (const m of masks || []) {
      const ax2 = a.x + a.width, ay2 = a.y + a.height
      const mx2 = m.x + m.width, my2 = m.y + m.height
      const overlap = !(ax2 <= m.x || mx2 <= a.x || ay2 <= m.y || my2 <= a.y)
      if (overlap) { xs.push(m.x, mx2); ys.push(m.y, my2) }
    }
    xs.sort((p,q)=>p-q); ys.sort((p,q)=>p-q)
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const rx = xs[i], ry = ys[j]
        const rw = xs[i+1] - xs[i], rh = ys[j+1] - ys[j]
        if (rw <= 0 || rh <= 0) continue
        const cell = { x: rx, y: ry, width: rw, height: rh }
        const inside = rx >= a.x && ry >= a.y && rx+rw <= a.x+a.width && ry+rh <= a.y+a.height
        if (!inside) continue
        const covered = (masks || []).some(m => !(cell.x + cell.width <= m.x || m.x + m.width <= cell.x || cell.y + cell.height <= m.y || m.y + m.height <= cell.y))
        if (!covered) res.push(cell)
      }
    }
  }
  return res.length ? res : (areas || [])
}

/**
 * 判断词/行框是否被屏蔽（与任一屏蔽区域相交）
 * @param {{left:number,top:number,width:number,height:number}|null} pos
 * @param {Array<{x:number,y:number,width:number,height:number}>} masks
 */
export function isMasked(pos, masks) {
  if (!pos) return false
  const wl = pos.left || 0
  const wt = pos.top || 0
  const ww = pos.width || 0
  const wh = pos.height || 0
  return (masks || []).some(a => !(wl + ww <= a.x || a.x + a.width <= wl || wt + wh <= a.y || a.y + a.height <= wt))
}

/** 过滤被屏蔽的词数组 */
export function filterWordsByMasks(words, masks) {
  return (words || []).filter(w => !isMasked(w.position, masks))
}

/** 将 LaTeX 分数 \\frac{a}{b} 规整为 a/b */
export function normalizeLatexFraction(s) {
  return String(s || '').replace(/\\frac\s*\{\s*(\d+)\s*\}\s*\{\s*(\d+)\s*\}/g, (_, a, b) => `${a}/${b}`)
}

/** 文本规整：空白/标点/括号统一 */
export function normalizeText(s) {
  return normalizeLatexFraction(s || '')
    .replace(/\s+/g, '')
    .replace(/[，。、．]/g, '')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[〈⟨]/g, '(')
    .replace(/[〉⟩]/g, ')')
    .replace(/：/g, ':')
}

/** 将词数组拼接成连续文本 */
export function buildTextFromWords(words) {
  return (words || []).map(w => w.text || '').join('')
}

/** 从规整文本中抽取括号答案 (xxx) */
export function extractBracketAnswersFromText(t) {
  const r = []
  const re = /\(([^()]{1,64})\)/g
  let m
  const src = normalizeText(t || '')
  while ((m = re.exec(src)) !== null) r.push(m[1])
  return r
}

/**
 * 抽取答案（词过滤 + 文本规整 + 括号提取 + 屏蔽词剔除）
 * @returns {string[]}
 */
export function extractAnswers(words, maskAreas, maskWords, fallbackText = '') {
  const filtered = filterWordsByMasks(words || [], maskAreas)
  const src = buildTextFromWords(filtered) || (fallbackText || '')
  const arr = extractBracketAnswersFromText(src)
  const masks = (maskWords || []).filter(Boolean)
  return arr.filter(ans => !masks.some(w => ans === w))
}

/** 过滤裁题返回题目，剔除与屏蔽区域相交的题框 */
export function paperFilterQuestions(questions, maskAreas) {
  return (questions || []).filter(q => {
    const b = q && q.bbox
    if (!b) return true
    return !(maskAreas || []).some(a => !((b.left + (b.width || 0)) <= a.x || (a.x + a.width) <= b.left || (b.top + (b.height || 0)) <= a.y || (a.y + a.height) <= b.top))
  })
}

/** 将选区裁剪为 base64 图片（用于预览/分片识别） */
export async function cropAreasToBase64(imageSrc, areas) {
  if (!imageSrc || !areas || !areas.length) return []
  const img = new Image()
  img.src = imageSrc
  await new Promise(r => { img.onload = r })
  const out = []
  for (const a of areas) {
    const sx = Math.max(0, Math.min(Math.round(a.x), img.naturalWidth))
    const sy = Math.max(0, Math.min(Math.round(a.y), img.naturalHeight))
    const sw = Math.max(1, Math.min(Math.round(a.width), img.naturalWidth - sx))
    const sh = Math.max(1, Math.min(Math.round(a.height), img.naturalHeight - sy))
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    out.push(canvas.toDataURL('image/png'))
  }
  return out
}

/** doc_analysis：整图/选区统一识别 */
export async function docRecognize({ filename, areas = [], maskAreas = [], maskWords = [], options = {} }) {
  if (areas.length) {
    const res = await recognizeOCRWithAreas(filename, areasMinusMasks(areas, maskAreas), options)
    const results = res.data?.results || []
    const allWords = results.flatMap(r => r.words || [])
    const words = filterWordsByMasks(allWords, maskAreas)
    const fullText = buildTextFromWords(words) || results.map(r => r.text || '').join('')
    const extracted = extractAnswers(words, maskAreas, maskWords, fullText)
    return { words, fullText, extracted }
  } else {
    const res = await recognizeOCR(filename, options)
    const words = filterWordsByMasks(res.data?.words || [], maskAreas)
    const fullText = buildTextFromWords(words) || (res.data?.fullText || res.data?.text || '')
    const extracted = extractAnswers(words, maskAreas, maskWords, fullText)
    return { words, fullText, extracted }
  }
}

/** paper_cut_edu：整图/分片统一识别 */
export async function paperRecognize({ filename, imageSrc, areas = [], maskAreas = [], maskWords = [], options = {} }) {
  if (areas.length) {
    const areasCropped = areasMinusMasks(areas, maskAreas)
    const images = (await cropAreasToBase64(imageSrc, areasCropped)).map(u => (u || '').split(',')[1])
    const resp = await paperCutByImages(images, options)
    const results = resp.data?.results || []
    const qs = results.flatMap(r => r.questions || [])
    const answers = qs.map(q => (q.answer || '').trim()).filter(Boolean)
    const base = answers.length ? answers : qs.map(q => (q.stem || '').match(/\(([^()]{1,64})\)/)?.[1] || '').filter(Boolean)
    const extracted = base.filter(ans => !maskWords.some(w => w && normalizeText(ans) === w))
    return { questions: qs, extracted }
  } else {
    const res = await paperCutEdu(filename, options)
    const qs = (res.data?.questions || [])
    const filtered = paperFilterQuestions(qs, maskAreas)
    const answers = filtered.map(q => (q.answer || '').trim()).filter(Boolean)
    const base = answers.length ? answers : filtered.map(q => (q.stem || '').match(/\(([^()]{1,64})\)/)?.[1] || '').filter(Boolean)
    const extracted = base.filter(ans => !maskWords.some(w => w && normalizeText(ans) === w))
    return { questions: filtered, extracted }
  }
}

/** handwriting：整图/选区统一识别 */
export async function handwritingRecognize({ filename, areas = [], maskAreas = [], maskWords = [], options = {} }) {
  if (areas.length) {
    const res = await handwritingAreas(filename, areasMinusMasks(areas, maskAreas), options)
    const results = res.data?.results || []
    const allWords = results.flatMap(r => r.words || [])
    const words = filterWordsByMasks(allWords, maskAreas)
    const text = buildTextFromWords(words) || results.map(r => (r.text || '')).join('')
    const extracted = extractAnswers(words, maskAreas, maskWords, text)
    return { text, words, extracted }
  } else {
    const res = await handwritingWhole(filename, options)
    const words = filterWordsByMasks(res.data?.words || [], maskAreas)
    const text = buildTextFromWords(words) || (res.data?.text || '')
    const extracted = extractAnswers(words, maskAreas, maskWords, text)
    return { text, words, extracted }
  }
}

/** accurate_basic：整图/选区统一识别（分片回退） */
export async function accurateRecognize({ filename, imageSrc, areas = [], maskAreas = [], maskWords = [], imageSize = { width: 0, height: 0 }, options = {} }) {
  if (areas.length) {
    const res = await accurateAreas(filename, areasMinusMasks(areas, maskAreas), options)
    const results = res.data?.results || []
    const allWords = results.flatMap(r => r.words || [])
    const words = filterWordsByMasks(allWords, maskAreas)
    let texts = results.map(r => buildTextFromWords(filterWordsByMasks(r.words || [], maskAreas)) || (r.text || ''))
    if (!texts.some(t => (t || '').trim().length)) {
      const images = (await cropAreasToBase64(imageSrc, areasMinusMasks(areas, maskAreas))).map(u => (u || '').split(',')[1])
      const byImg = await accurateByImages(images, options)
      texts = (byImg.data?.results || []).map(r => (r.text || '').trim())
    }
    const text = texts.join('\n')
    const extracted = extractAnswers(words || [], maskAreas, maskWords, text)
    return { text, extracted }
  } else {
    const res = await accurateWhole(filename, options)
    const words = filterWordsByMasks(res.data?.words || [], maskAreas)
    let text = buildTextFromWords(words) || (res.data?.text || '')
    if (maskAreas.length && (!words.length)) {
      const whole = [{ x: 0, y: 0, width: imageSize.width, height: imageSize.height }]
      const areas = areasMinusMasks(whole, maskAreas)
      const ar = await accurateAreas(filename, areas, options)
      const texts = (ar.data?.results || []).map(r => buildTextFromWords(r.words || []) || (r.text || '')).filter(Boolean)
      text = texts.join('') || text
    }
    const extracted = extractAnswers(words, maskAreas, maskWords, text)
    return { text, extracted }
  }
}

/** general_basic：整图/选区统一识别（分片回退） */
export async function generalRecognize({ filename, imageSrc, areas = [], maskAreas = [], maskWords = [], imageSize = { width: 0, height: 0 }, options = {} }) {
  if (areas.length) {
    const res = await generalAreas(filename, areasMinusMasks(areas, maskAreas), options)
    const results = res.data?.results || []
    const allWords = results.flatMap(r => r.words || [])
    const words = filterWordsByMasks(allWords, maskAreas)
    let texts = results.map(r => buildTextFromWords(filterWordsByMasks(r.words || [], maskAreas)) || (r.text || ''))
    if (!texts.some(t => (t || '').trim().length)) {
      const images = (await cropAreasToBase64(imageSrc, areasMinusMasks(areas, maskAreas))).map(u => (u || '').split(',')[1])
      const byImg = await generalByImages(images, options)
      texts = (byImg.data?.results || []).map(r => (r.text || '').trim())
    }
    const text = texts.join('\n')
    const extracted = extractAnswers(words || [], maskAreas, maskWords, text)
    return { text, extracted }
  } else {
    const res = await generalWhole(filename, options)
    const words = filterWordsByMasks(res.data?.words || [], maskAreas)
    let text = buildTextFromWords(words) || (res.data?.text || '')
    if (maskAreas.length && (!words.length)) {
      const whole = [{ x: 0, y: 0, width: imageSize.width, height: imageSize.height }]
      const areas = areasMinusMasks(whole, maskAreas)
      const ar = await generalAreas(filename, areas, options)
      const texts = (ar.data?.results || []).map(r => buildTextFromWords(r.words || []) || (r.text || '')).filter(Boolean)
      text = texts.join('') || text
    }
    const extracted = extractAnswers(words, maskAreas, maskWords, text)
    return { text, extracted }
  }
}

/**
 * 共享 OCR 状态组合函数
 * @param {{ showImagesDefault?: boolean }} options
 */
export function useOcrState({ showImagesDefault = false } = {}) {
  // 文件与预览控制
  const fileInput = ref(null)              // `<input type="file">` 引用，触发选择文件
  const selectedFile = ref(null)           // 已选择的图片文件（前端）
  const imagePreview = ref(null)           // 预览的 base64（前端显示）
  const uploaded = ref(null)               // 后端上传返回（包含 `filename`）
  const uploadedFile = uploaded            // 兼容别名（Workspace 使用）

  // OCR 识别结果（doc_analysis）与兼容别名
  const ocrRes = ref(null)
  const ocrResult = ocrRes

  // 区域与屏蔽设置
  const areas = ref([])                    // 选区（OCRTestView 使用）
  const selectedAreas = areas              // 兼容别名（Workspace 使用）
  const maskAreas = ref([])                // 屏蔽区域矩形列表
  const maskWords = ref([])                // 屏蔽词列表（提取答案时剔除命中项）
  const newMaskWord = ref('')              // 屏蔽词输入框值

  // 过程提示与 UI 切换
  const loading = ref(false)               // 加载中状态
  const msg = ref('')                      // 过程消息（测试页）
  const err = ref('')                      // 错误消息（测试页）
  const success = ref(null)                // 成功消息（工作台）
  const showAreaSelector = ref(false)      // 是否展示区域选择器
  const showMaskSelector = ref(false)      // 是否展示屏蔽区域选择器
  const showUploadRes = ref(false)         // 是否展示上传返回
  const showOcrRes = ref(false)            // 是否展示识别返回
  const showImages = ref(showImagesDefault)// 是否展示图片预览（由调用方默认值控制）
  const apiChoice = ref('doc')             // 当前选用的识别模型：doc/paper/handwriting/accurate/general
  const showSettings = ref(false)          // 是否展示 OCR 设置对话框

  // 各模型识别参数（默认值参考上方常量与官方文档）
  const docOptions = ref({ ...DEFAULT_DOC_OPTIONS })
  const paperOptions = ref({ ...DEFAULT_PAPER_OPTIONS })
  const handwritingOptions = ref({ ...DEFAULT_HANDWRITING_OPTIONS })
  const accurateOptions = ref({ ...DEFAULT_ACCURATE_OPTIONS })
  const generalOptions = ref({ ...DEFAULT_GENERAL_OPTIONS })

  // 识别结果快照（用于测试页的返回展示）
  const paperRes = ref(null)
  const handRes = ref(null)
  const accurateRes = ref(null)
  const generalRes = ref(null)

  // 预览辅助（区域裁剪与屏蔽叠加）
  const imageSize = ref({ width: 0, height: 0 }) // 原图自然尺寸（裁剪/分片回退使用）
  const croppedPreviews = ref([])                // 选区裁剪的 base64 列表
  const maskPreview = ref(null)                  // 叠加屏蔽的整图预览 base64

  // 提取的答案（按当前模型与屏蔽设置得到的结果）
  const extracted = ref([])
  return {
    fileInput,             // 文件选择 input 引用
    selectedFile,          // 前端选中的图片文件对象
    imagePreview,          // 图片预览 base64
    uploaded,              // 后端上传返回（含 filename）
    uploadedFile,          // 别名兼容（Workspace）
    ocrRes,                // doc_analysis 返回结果（测试页）
    ocrResult,             // 别名兼容（Workspace）
    areas,                 // 选区数组（测试页）
    selectedAreas,         // 别名兼容（Workspace）
    maskAreas,             // 屏蔽区域数组
    maskWords,             // 屏蔽词列表
    newMaskWord,           // 屏蔽词输入框值
    loading,               // 加载状态
    msg,                   // 过程消息（测试页）
    err,                   // 错误消息（测试页）
    success,               // 成功消息（工作台）
    showAreaSelector,      // 区域选择器开关
    showMaskSelector,      // 屏蔽选择器开关
    showUploadRes,         // 显示上传返回开关
    showOcrRes,            // 显示识别返回开关
    showImages,            // 显示图片预览开关
    apiChoice,             // 当前识别模型
    showSettings,          // 设置面板开关
    docOptions,            // doc_analysis 参数
    paperOptions,          // paper_cut_edu 参数
    handwritingOptions,    // handwriting 参数
    accurateOptions,       // accurate_basic 参数
    generalOptions,        // general_basic 参数
    paperRes,              // 测试页：切题识别返回快照
    handRes,               // 测试页：手写识别返回快照
    accurateRes,           // 测试页：高精度识别返回快照
    generalRes,            // 测试页：标准识别返回快照
    imageSize,             // 原图自然尺寸（裁剪/分片回退用）
    croppedPreviews,       // 选区裁剪预览 base64 列表
    maskPreview,           // 屏蔽叠加整图预览 base64
    extracted              // 提取答案数组
  }
}
