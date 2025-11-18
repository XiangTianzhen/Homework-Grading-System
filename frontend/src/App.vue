<script setup>
// 工作台页面：上传图片→区域OCR→评分→历史与错题管理
import AnswerEditor from './components/AnswerEditor.vue'
import ProgressBar from './components/ProgressBar.vue'
import ResultCard from './components/ResultCard.vue'
import AreaSelector from './components/AreaSelector.vue'
import BatchUpload from './components/BatchUpload.vue'
import ErrorBook from './components/ErrorBook.vue'
import { QuestionFilled } from '@element-plus/icons-vue'
import HistoryPanel from './components/HistoryPanel.vue'
import TestImageGenerator from './components/TestImageGenerator.vue'
import { ref, computed, watch } from 'vue'
import { uploadPaper as uploadPaperAPI, gradePaper as gradePaperAPI, batchProcess, recognizeOCR, recognizeOCRWithAreas, paperCutEdu, paperCutByImages, handwritingAreas, accurateAreas, generalAreas, handwritingByImages, accurateByImages, generalByImages, docByImages, handwritingWhole, accurateWhole, generalWhole } from './api'

// 选择的试卷文件与预览
const selectedFile = ref(null)
const imagePreview = ref(null)
const uploadedFile = ref(null)
const ocrResult = ref(null)
const studentAnswers = ref([])
const gradeResult = ref(null)
const loading = ref(false)
const loadingMessage = ref('')
const error = ref(null)
const success = ref(null)
const fileInput = ref(null)
const standardAnswers = ref([])
const answerDetails = ref([])
const selectedAreas = ref([])
const maskAreas = ref([])
const maskWords = ref([])
const newMaskWord = ref('')
const showAreaSelector = ref(false)
const showMaskSelector = ref(false)
const showBatchUpload = ref(false)
const showErrorBook = ref(false)
const showHistory = ref(false)
const batchResults = ref([])
const showGenerator = ref(false)
const showOcrPanel = ref(false)
const showImages = ref(true)
const apiChoice = ref('doc')
const showSettings = ref(false)
const docOptions = ref({ language_type: 'CHN_ENG', result_type: 'big', detect_direction: true, line_probability: true, disp_line_poly: true, words_type: 'handprint_mix', layout_analysis: true, recg_formula: true, recg_long_division: true, disp_underline_analysis: true, recg_alter: false })
const paperOptions = ref({ language_type: 'CHN_ENG', detect_direction: false, words_type: 'handprint_mix', splice_text: true, enhance: true })
const handwritingOptions = ref({ language_type: 'CHN_ENG', recognize_granularity: 'big', probability: false, detect_direction: false, detect_alteration: false })
const accurateOptions = ref({ language_type: 'CHN_ENG', detect_direction: false, paragraph: false, probability: false, multidirectional_recognize: false })
const generalOptions = ref({ language_type: 'CHN_ENG', detect_direction: false, detect_language: false, paragraph: false, probability: false })
const paperRes = ref(null)
const handRes = ref(null)
const accurateRes = ref(null)
const generalRes = ref(null)
const imageSize = ref({ width: 0, height: 0 })
const croppedPreviews = ref([])
const maskPreview = ref(null)
const extracted = ref([])
const ocrTextLines = computed(() => {
  const r = ocrResult.value
  if (!r) return []
  if (Array.isArray(r.results)) return r.results.map(x => x.text || '').filter(Boolean)
  if (Array.isArray(r.answers)) return r.answers
  if (typeof r.text === 'string') return r.text.split('\n')
  return []
})

function triggerFileInput() {
  fileInput.value && fileInput.value.click()
}

function createImagePreview(file) {
  const reader = new FileReader()
  reader.onload = e => { imagePreview.value = e.target.result }
  reader.readAsDataURL(file)
  const img = new Image()
  img.onload = () => { imageSize.value = { width: img.naturalWidth, height: img.naturalHeight } }
  img.src = URL.createObjectURL(file)
}

function clearMessages() {
  error.value = null
  success.value = null
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (file && file.type.startsWith('image/')) {
    selectedFile.value = file
    createImagePreview(file)
    clearMessages()
  } else {
    error.value = '请选择图片文件'
  }
}

function buildDetails() {
  answerDetails.value = standardAnswers.value.map((std, i) => ({
    student: studentAnswers.value[i] || '',
    standard: std.answer,
    score: studentAnswers.value[i] === std.answer ? std.score : 0,
    maxScore: std.score
  }))
}

function handleDrop(e) {
  e.preventDefault()
  const file = e.dataTransfer.files[0]
  if (file && file.type.startsWith('image/')) {
    selectedFile.value = file
    createImagePreview(file)
    clearMessages()
  } else {
    error.value = '请拖拽图片文件'
  }
  e.target.classList.remove('dragover')
}

function dragOver(e) { e.target.classList.add('dragover') }
function dragLeave(e) { e.target.classList.remove('dragover') }

// 上传试卷到后端，返回存储文件信息
async function uploadPaper() {
  if (!selectedFile.value) return
  loading.value = true
  loadingMessage.value = '正在上传试卷...'
  clearMessages()
  const formData = new FormData()
  formData.append('paper', selectedFile.value)
  try {
    const res = await uploadPaperAPI(formData)
    uploadedFile.value = res.data
    success.value = '试卷上传成功'
  } catch (err) {
    error.value = '试卷上传失败：' + (err.response?.data?.error || err.message)
  } finally {
    loading.value = false
  }
}

// 统一OCR流程：支持模型切换、区域分片与屏蔽区域/词后提取
async function startOCR() {
  if (!uploadedFile.value) return
  await runUnifiedOCR()
}

function pretty(v) { return v ? JSON.stringify(v, null, 2) : '' }

function normalizeLatexFraction(s) {
  return s.replace(/\\frac\s*\{\s*(\d+)\s*\}\s*\{\s*(\d+)\s*\}/g, (_, a, b) => `${a}/${b}`)
}
function normalize(s) {
  return normalizeLatexFraction(s).replace(/\s+/g, '').replace(/[，。、．]/g, '').replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[〈⟨]/g, '(').replace(/[〉⟩]/g, ')').replace(/：/g, ':')
}
function isInAnyMask(pos) {
  if (!pos) return false
  const cx = pos.left + (pos.width || 0)/2
  const cy = pos.top + (pos.height || 0)/2
  return maskAreas.value.some(a => cx>=a.x && cx<=a.x+a.width && cy>=a.y && cy<=a.y+a.height)
}
function extractAnswersFromOCR() {
  const words = (ocrResult.value?.words || [])
    .filter(w => !isInAnyMask(w.position))
    .map(w => w.text || '')
  const src = words.join('') || (ocrResult.value?.fullText || '')
  const t = normalize(src)
  const r = []
  const re = /\(([^()]{1,64})\)/g
  let m
  while ((m = re.exec(t)) !== null) { r.push(m[1]) }
  const filtered = r.filter(ans => !maskWords.value.some(w => w && ans.includes(w)))
  extracted.value = filtered
}

async function runUnifiedOCR() {
  loading.value = true
  loadingMessage.value = selectedAreas.value.length ? 'doc分析（分片）中...' : 'OCR识别中...'
  clearMessages()
  try {
    if (apiChoice.value === 'paper') {
      const res = await paperCutEdu(uploadedFile.value.filename, paperOptions.value)
      const qs = (res.data?.questions || [])
      // 先按选区过滤，再按屏蔽过滤（均使用原图坐标）
      const inArea = selectedAreas.value.length
        ? qs.filter(q => {
            const b = q.bbox; if (!b) return false
            const cx = b.left + (b.width || 0)/2
            const cy = b.top + (b.height || 0)/2
            return selectedAreas.value.some(a => cx>=a.x && cx<=a.x+a.width && cy>=a.y && cy<=a.y+a.height)
          })
        : qs
      const filtered = inArea.filter(q => {
        const b = q.bbox; if (!b) return true
        const cx = b.left + (b.width || 0)/2
        const cy = b.top + (b.height || 0)/2
        return !maskAreas.value.some(a => cx>=a.x && cx<=a.x+a.width && cy>=a.y && cy<=a.y+a.height)
      })
      paperRes.value = { questions: filtered }
      const arr = filtered.map(q => (q.answer || '').trim()).filter(Boolean)
      extracted.value = arr.length ? arr : filtered.map(q => (q.stem || '').match(/\(([^()]{1,64})\)/)?.[1] || '').filter(Boolean)
      success.value = selectedAreas.value.length ? '试卷切题识别完成（选区）' : '试卷切题识别完成'
    } else if (apiChoice.value === 'handwriting') {
      if (selectedAreas.value.length) {
        const res = await handwritingAreas(uploadedFile.value.filename, selectedAreas.value, handwritingOptions.value)
        const results = res.data?.results || []
        const texts = results.map(r => {
          const words = (r.words || [])
          const filtered = words.filter(w => !isInAnyMask(w.position))
          return filtered.map(w => w.text || '').join('') || (r.text || '')
        })
        handRes.value = { text: texts.join('\n') }
        extracted.value = texts.map(t => (t || '').trim())
        success.value = '手写区域识别完成'
      } else {
        const res = await handwritingWhole(uploadedFile.value.filename, handwritingOptions.value)
        const words = (res.data?.words || [])
        const filtered = words.filter(w => !isInAnyMask(w.position))
        const text = filtered.map(w => w.text || '').join('') || (res.data?.text || '')
        handRes.value = { ...res.data, words: filtered, text }
        extracted.value = [text.trim()]
        success.value = '手写整图识别完成'
      }
    } else if (apiChoice.value === 'accurate') {
      if (selectedAreas.value.length) {
        const res = await accurateAreas(uploadedFile.value.filename, selectedAreas.value, accurateOptions.value)
        const results = res.data?.results || []
        const texts = results.map(r => {
          const words = (r.words || [])
          const filtered = words.filter(w => !isInAnyMask(w.position))
          return filtered.map(w => w.text || '').join('') || (r.text || '')
        })
        accurateRes.value = { text: texts.join('\n') }
        extracted.value = texts.map(t => (t || '').trim())
        success.value = '高精度区域识别完成'
      } else {
        const res = await accurateWhole(uploadedFile.value.filename, accurateOptions.value)
        const words = (res.data?.words || [])
        const filtered = words.filter(w => !isInAnyMask(w.position))
        const text = filtered.map(w => w.text || '').join('') || (res.data?.text || '')
        accurateRes.value = { ...res.data, words: filtered, text }
        extracted.value = [text.trim()]
        success.value = '高精度整图识别完成'
      }
    } else if (apiChoice.value === 'general') {
      if (selectedAreas.value.length) {
        const res = await generalAreas(uploadedFile.value.filename, selectedAreas.value, generalOptions.value)
        const results = res.data?.results || []
        const texts = results.map(r => {
          const words = (r.words || [])
          const filtered = words.filter(w => !isInAnyMask(w.position))
          return filtered.map(w => w.text || '').join('') || (r.text || '')
        })
        generalRes.value = { text: texts.join('\n') }
        extracted.value = texts.map(t => (t || '').trim())
        success.value = '通用区域识别完成'
      } else {
        const res = await generalWhole(uploadedFile.value.filename, generalOptions.value)
        const words = (res.data?.words || [])
        const filtered = words.filter(w => !isInAnyMask(w.position))
        const text = filtered.map(w => w.text || '').join('') || (res.data?.text || '')
        generalRes.value = { ...res.data, words: filtered, text }
        extracted.value = [text.trim()]
        success.value = '通用整图识别完成'
      }
    } else {
      if (selectedAreas.value.length) {
        const res = await recognizeOCRWithAreas(uploadedFile.value.filename, selectedAreas.value, docOptions.value)
        const results = res.data?.results || []
        const allWords = results.flatMap(r => r.words || [])
        const filteredWords = allWords.filter(w => !isInAnyMask(w.position))
        const fullText = filteredWords.map(w => w.text || '').join('') || results.map(r => r.text || '').join('')
        ocrResult.value = { fullText, words: filteredWords }
        extractAnswersFromOCR()
        success.value = 'doc分析（选区）完成'
      } else {
        const res = await recognizeOCR(uploadedFile.value.filename, docOptions.value)
        ocrResult.value = res.data
        extractAnswersFromOCR()
        success.value = 'doc分析完成'
      }
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
    renderCrops()
  }
}

// 根据标准答案与识别答案进行评分，并写入历史
async function gradePaper() {
  if (!ocrResult.value) return
  loading.value = true
  loadingMessage.value = '正在进行智能评分...'
  clearMessages()
  try {
    const res = await gradePaperAPI(standardAnswers.value, studentAnswers.value)
    gradeResult.value = res.data
    buildDetails()
    success.value = '评分完成'
    // 保存到历史记录
    saveToHistory()
  } catch (err) {
    error.value = '评分失败：' + (err.response?.data?.error || err.message)
  } finally {
    loading.value = false
  }
}

function handleAreaSelected(areas) {
  selectedAreas.value = areas
  showAreaSelector.value = false
}

function onMaskSelected(list) { maskAreas.value = list; showMaskSelector.value = false }
function addMaskWord() { const v = normalize(newMaskWord.value || ''); if (!v) return; if (!maskWords.value.includes(v)) maskWords.value.push(v); newMaskWord.value = '' }
function removeMaskWord(i) { maskWords.value.splice(i,1) }
function clearMasks() { maskAreas.value = []; maskWords.value = []; maskPreview.value = null }

function handleBatchUploadComplete(results) {
  batchResults.value = results
  showBatchUpload.value = false
  success.value = `批量处理完成，成功 ${results.filter(r => r.success).length} 个文件`
}

function addToErrorBook(question, studentAnswer, correctAnswer) {
  const errorBook = JSON.parse(localStorage.getItem('errorBook') || '[]')
  errorBook.push({
    id: Date.now(),
    question,
    studentAnswer,
    correctAnswer,
    addTime: new Date().toISOString(),
    analysis: ''
  })
  localStorage.setItem('errorBook', JSON.stringify(errorBook))
}

// 保存评分记录到本地历史
function saveToHistory() {
  const history = JSON.parse(localStorage.getItem('gradingHistory') || '[]')
  history.unshift({
    id: Date.now(),
    filename: selectedFile.value.name,
    score: gradeResult.value.score,
    totalScore: gradeResult.value.totalScore,
    percentage: gradeResult.value.percentage,
    answers: studentAnswers.value,
    details: answerDetails.value,
    timestamp: new Date().toISOString()
  })
  // 只保留最近50条记录
  if (history.length > 50) {
    history.splice(50)
  }
  localStorage.setItem('gradingHistory', JSON.stringify(history))
}

function renderCrops() {
  if (!imagePreview.value || selectedAreas.value.length === 0 || !imageSize.value.width) { croppedPreviews.value = []; return }
  const img = new Image(); img.src = imagePreview.value
  img.onload = () => {
    const out = []
    for (const a of selectedAreas.value) {
      const canvas = document.createElement('canvas')
      canvas.width = a.width; canvas.height = a.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, a.x, a.y, a.width, a.height, 0, 0, a.width, a.height)
      out.push(canvas.toDataURL('image/png'))
    }
    croppedPreviews.value = out
  }
}

function renderMaskPreview() {
  if (!imagePreview.value || !imageSize.value.width) { maskPreview.value = null; return }
  const img = new Image(); img.src = imagePreview.value
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    ctx.strokeStyle = '#e53935'; ctx.lineWidth = 3
    for (const a of maskAreas.value) {
      ctx.fillStyle = 'rgba(229,57,53,0.15)'
      ctx.fillRect(a.x, a.y, a.width, a.height)
      ctx.strokeRect(a.x, a.y, a.width, a.height)
    }
    maskPreview.value = canvas.toDataURL('image/png')
  }
}

watch(selectedAreas, renderCrops, { deep: true })
watch(maskAreas, renderMaskPreview, { deep: true })
watch(imagePreview, () => { renderCrops(); renderMaskPreview() })
</script>

<template>
  <div class="container">
    <div class="header">
      <h1>校园试卷自动判分系统</h1>
      <p>基于OCR的手写试卷识别与评分</p>
    </div>
    <div class="content">
      <div class="right-panel">
        <div class="upload-section">
          <div class="upload-area" @click="triggerFileInput" @drop="handleDrop" @dragover.prevent @dragenter.prevent @dragenter="dragOver" @dragleave="dragLeave">
            <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/*" class="file-input">
            <div v-if="!selectedFile">
              <h3>拖拽或点击上传试卷图片</h3>
              <p>支持 JPG、PNG</p>
              <button class="upload-btn">选择图片</button>
            </div>
            <div v-else>
              <h3>已选择文件</h3>
              <p>{{ selectedFile.name }}</p>
            </div>
          </div>
        </div>
        <div class="preview-section" v-if="showImages">
          <div class="preview-grid">
            <div class="preview-item">
              <h3>原图预览</h3>
              <img v-if="imagePreview" :src="imagePreview" alt="试卷预览" class="img-fit">
              <div v-else class="placeholder">未选择图片</div>
            </div>
            <div class="preview-item">
              <h3>区域裁剪预览</h3>
              <div class="crops" v-if="apiChoice!=='paper' && croppedPreviews.length">
                <img v-for="(u,i) in croppedPreviews" :key="i" class="img-fit" :src="u" />
              </div>
              <div v-else class="placeholder">未框选区域</div>
            </div>
            <div class="preview-item">
              <h3>屏蔽区域预览</h3>
              <img v-if="apiChoice!=='paper' && maskPreview" class="img-fit" :src="maskPreview" />
              <div v-else class="placeholder">未设置屏蔽</div>
            </div>
          </div>
        </div>
        <div class="btn-group" v-if="selectedFile">
          <button class="btn" @click="uploadPaper" :disabled="loading">{{ loading ? '上传中...' : '上传试卷' }}</button>
          <el-select v-model="apiChoice" placeholder="选择识别接口" style="width: 220px">
            <el-option label="试卷分析与识别（doc_analysis）" value="doc" />
            <el-option label="试卷切题识别（paper_cut_edu）" value="paper" />
            <el-option label="手写文字识别（handwriting）" value="handwriting" />
            <el-option label="通用文字识别（高精度版）accurate_basic" value="accurate" />
            <el-option label="通用文字识别（标准版）general_basic" value="general" />
          </el-select>
          <button class="btn" @click="showAreaSelector = true">区域框选</button>
          <button class="btn" v-if="apiChoice!=='paper'" @click="showMaskSelector = true">屏蔽区域</button>
          <button class="btn" @click="showSettings = true">设置</button>
          <button class="btn" @click="startOCR" :disabled="!uploadedFile || loading">{{ loading ? '识别中...' : 'OCR识别' }}</button>
          <button class="btn" @click="gradePaper" :disabled="!studentAnswers.length || !standardAnswers.length || loading">{{ loading ? '评分中...' : '开始评分' }}</button>
          <button class="btn" @click="showBatchUpload = true">批量上传</button>
        </div>
        <div class="btn-group">
          <button class="btn" @click="showErrorBook = true">错题本</button>
          <button class="btn" @click="showHistory = true">历史记录</button>
          <button class="btn" @click="showOcrPanel = !showOcrPanel">{{ showOcrPanel ? '关闭OCR结果' : '显示OCR结果' }}</button>
          <button class="btn" @click="showImages = !showImages">{{ showImages ? '隐藏图片' : '显示图片' }}</button>
          
        </div>
        <div class="ocr-panel" v-if="showOcrPanel">
          <h3>提取答案（按顺序）</h3>
          <pre class="ocr-text">{{ pretty(extracted) }}</pre>
        </div>
        <AnswerEditor v-model="standardAnswers" />
        <div class="block">
          <h3>识别答案编辑</h3>
          <div class="answer-list">
            <div v-for="(ans,i) in studentAnswers" :key="i" class="answer-item">
              <span class="index">第{{ i+1 }}题</span>
              <input v-model="studentAnswers[i]" placeholder="学生答案" />
              <button class="remove" @click="studentAnswers.splice(i,1)">删除</button>
            </div>
          </div>
          <div class="add-row">
            <button class="add" @click="studentAnswers.push('')">+ 添加答案</button>
            <button class="add" style="background:#ff9800" @click="studentAnswers = [...extracted]">用提取结果填充</button>
          </div>
        </div>
        <div v-if="loading" class="loading">{{ loadingMessage }}</div>
        <div v-if="error" class="error">{{ error }}</div>
        <div v-if="success" class="success">{{ success }}</div>
        <div class="results-section" v-if="gradeResult">
          <h3>评分结果</h3>
          <ProgressBar :percent="gradeResult.percentage" :label="`正确率 ${gradeResult.percentage}%`" />
          <div class="score-display">得分：{{ gradeResult.score }} / {{ gradeResult.totalScore }}</div>
          <div class="details">
            <ResultCard 
              v-for="(d, i) in answerDetails" 
              :key="i" 
              :index="i" 
              :student="d.student" 
              :standard="d.standard" 
              :score="d.score" 
              :maxScore="d.maxScore"
              @add-to-error-book="addToErrorBook"
            />
          </div>
        </div>
      </div>
    </div>
    
    <!-- 区域框选模态框 -->
    <div v-if="showAreaSelector" class="modal-overlay" @click="showAreaSelector = false">
      <div class="modal-content" @click.stop>
        <AreaSelector :imageSrc="imagePreview" :modelValue="selectedAreas" @areas-selected="handleAreaSelected" @close="showAreaSelector = false" />
      </div>
    </div>
    
    <!-- 屏蔽区域选择 -->
    <div v-if="showMaskSelector" class="modal-overlay" @click="showMaskSelector = false">
      <div class="modal-content" @click.stop>
        <AreaSelector :imageSrc="imagePreview" :modelValue="maskAreas" @areas-selected="onMaskSelected" @close="showMaskSelector = false" />
      </div>
    </div>
    
    <!-- 批量上传模态框 -->
    <div v-if="showBatchUpload" class="modal-overlay" @click="showBatchUpload = false">
      <div class="modal-content" @click.stop>
        <BatchUpload @batch-complete="handleBatchUploadComplete" @close="showBatchUpload = false" />
      </div>
    </div>
    
    <!-- 错题本模态框 -->
    <div v-if="showErrorBook" class="modal-overlay" @click="showErrorBook = false">
      <div class="modal-content" @click.stop>
        <ErrorBook @close="showErrorBook = false" />
      </div>
    </div>
    
    <!-- 历史记录模态框 -->
    <div v-if="showHistory" class="modal-overlay" @click="showHistory = false">
      <div class="modal-content" @click.stop>
        <HistoryPanel @close="showHistory = false" />
      </div>
    </div>
    
    

    <!-- 识别参数设置 -->
    <div v-if="showSettings" class="modal-overlay" @click="showSettings = false">
      <div class="modal-content" @click.stop>
        <div class="settings">
          <h3>识别参数设置</h3>
          <div v-if="apiChoice==='doc'">
            <el-form label-width="160px">
              <el-form-item>
                <template #label>
                  language_type
                  <el-tooltip placement="top" content="识别语言类型：CHN_ENG（中英文，默认）/ ENG（英文）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-select v-model="docOptions.language_type" style="width:220px"><el-option label="CHN_ENG" value="CHN_ENG"/><el-option label="ENG" value="ENG"/></el-select>
              </el-form-item>
              <el-form-item>
                <template #label>
                  result_type
                  <el-tooltip placement="top" content="返回级别：big（行级，默认）/ small（行+字级）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-select v-model="docOptions.result_type" style="width:220px"><el-option label="big" value="big"/><el-option label="small" value="small"/></el-select>
              </el-form-item>
              <el-form-item>
                <template #label>
                  detect_direction
                  <el-tooltip placement="top" content="是否检测图像朝向：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="docOptions.detect_direction"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  line_probability
                  <el-tooltip placement="top" content="是否返回每行识别置信度：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="docOptions.line_probability"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  disp_line_poly
                  <el-tooltip placement="top" content="是否返回每行四角点坐标：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="docOptions.disp_line_poly"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  words_type
                  <el-tooltip placement="top" content="文字类型：handwring_only（仅手写）/ handprint_mix（手写印刷混排，默认）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-select v-model="docOptions.words_type" style="width:220px"><el-option label="handwring_only" value="handwring_only"/><el-option label="handprint_mix" value="handprint_mix"/></el-select>
              </el-form-item>
              <el-form-item>
                <template #label>
                  layout_analysis
                  <el-tooltip placement="top" content="版面分析输出 layout/attribute：默认false。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="docOptions.layout_analysis"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  recg_formula
                  <el-tooltip placement="top" content="检测并识别公式（返回LaTeX）：默认false。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="docOptions.recg_formula"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  recg_long_division
                  <el-tooltip placement="top" content="检测并识别手写竖式：默认false。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="docOptions.recg_long_division"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  disp_underline_analysis
                  <el-tooltip placement="top" content="开启下划线识别并在 underline 字段返回：默认false。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="docOptions.disp_underline_analysis"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  recg_alter
                  <el-tooltip placement="top" content="返回涂改识别结果，涂改部分统一用“☰”：默认false。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="docOptions.recg_alter"/>
              </el-form-item>
            </el-form>
          </div>
          <div v-else-if="apiChoice==='paper'">
            <el-form label-width="160px">
              <el-form-item>
                <template #label>
                  language_type
                  <el-tooltip placement="top" content="识别语言类型：CHN_ENG（中英文，默认）/ ENG（英文）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-select v-model="paperOptions.language_type" style="width:220px"><el-option label="CHN_ENG" value="CHN_ENG"/><el-option label="ENG" value="ENG"/></el-select>
              </el-form-item>
              <el-form-item>
                <template #label>
                  detect_direction
                  <el-tooltip placement="top" content="是否检测图像朝向：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="paperOptions.detect_direction"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  words_type
                  <el-tooltip placement="top" content="文字类型：handwring_only（仅手写）/ handprint_mix（手写印刷混排，默认）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-select v-model="paperOptions.words_type" style="width:220px"><el-option label="handwring_only" value="handwring_only"/><el-option label="handprint_mix" value="handprint_mix"/></el-select>
              </el-form-item>
              <el-form-item>
                <template #label>
                  splice_text
                  <el-tooltip placement="top" content="是否拼接题目元素每行文本到 elem_text：true/false。开启通常耗时增加约 1s。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="paperOptions.splice_text"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  enhance
                  <el-tooltip placement="top" content="图像矫正与增强：true/false（默认true）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="paperOptions.enhance"/>
              </el-form-item>
            </el-form>
          </div>
          <div v-else-if="apiChoice==='handwriting'">
            <el-form label-width="160px">
              <el-form-item>
                <template #label>
                  language_type
                  <el-tooltip placement="top" content="识别语言类型：CHN_ENG（中英文，默认）/ ENG 等。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-select v-model="handwritingOptions.language_type" style="width:220px"><el-option label="CHN_ENG" value="CHN_ENG"/><el-option label="ENG" value="ENG"/></el-select>
              </el-form-item>
              <el-form-item>
                <template #label>
                  recognize_granularity
                  <el-tooltip placement="top" content="是否定位单字符：big（不定位，默认）/ small（定位单字符）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-select v-model="handwritingOptions.recognize_granularity" style="width:220px"><el-option label="big" value="big"/><el-option label="small" value="small"/></el-select>
              </el-form-item>
              <el-form-item>
                <template #label>
                  probability
                  <el-tooltip placement="top" content="是否返回每行置信度：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="handwritingOptions.probability"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  detect_direction
                  <el-tooltip placement="top" content="是否检测图像朝向：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="handwritingOptions.detect_direction"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  detect_alteration
                  <el-tooltip placement="top" content="是否检测涂改痕迹（涂改部分用“☰”返回）：默认false。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="handwritingOptions.detect_alteration"/>
              </el-form-item>
            </el-form>
          </div>
          <div v-else-if="apiChoice==='accurate'">
            <el-form label-width="160px">
              <el-form-item>
                <template #label>
                  language_type
                  <el-tooltip placement="top" content="识别语言类型：CHN_ENG（默认）/ ENG 等。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-select v-model="accurateOptions.language_type" style="width:220px"><el-option label="CHN_ENG" value="CHN_ENG"/><el-option label="ENG" value="ENG"/></el-select>
              </el-form-item>
              <el-form-item>
                <template #label>
                  detect_direction
                  <el-tooltip placement="top" content="是否检测图像朝向：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="accurateOptions.detect_direction"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  paragraph
                  <el-tooltip placement="top" content="是否输出段落信息：true/false。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="accurateOptions.paragraph"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  probability
                  <el-tooltip placement="top" content="是否返回每行置信度：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="accurateOptions.probability"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  multidirectional_recognize
                  <el-tooltip placement="top" content="行级多方向识别：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="accurateOptions.multidirectional_recognize"/>
              </el-form-item>
            </el-form>
          </div>
          <div v-else>
            <el-form label-width="160px">
              <el-form-item>
                <template #label>
                  language_type
                  <el-tooltip placement="top" content="识别语言类型：CHN_ENG（默认）/ ENG 等。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-select v-model="generalOptions.language_type" style="width:220px"><el-option label="CHN_ENG" value="CHN_ENG"/><el-option label="ENG" value="ENG"/></el-select>
              </el-form-item>
              <el-form-item>
                <template #label>
                  detect_direction
                  <el-tooltip placement="top" content="是否检测图像朝向：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="generalOptions.detect_direction"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  detect_language
                  <el-tooltip placement="top" content="是否检测语言：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="generalOptions.detect_language"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  paragraph
                  <el-tooltip placement="top" content="是否输出段落信息：true/false。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="generalOptions.paragraph"/>
              </el-form-item>
              <el-form-item>
                <template #label>
                  probability
                  <el-tooltip placement="top" content="是否返回每行置信度：true/false（默认false）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
                </template>
                <el-switch v-model="generalOptions.probability"/>
              </el-form-item>
            </el-form>
          </div>
          <div style="text-align:right;margin-top:10px"><button class="btn" @click="showSettings=false">关闭</button></div>
        </div>
      </div>
    </div>

    <!-- 屏蔽词与预览 -->
    <div class="block">
      <h3>屏蔽词</h3>
      <div class="mask-words">
        <input v-model="newMaskWord" placeholder="输入屏蔽词" />
        <button class="btn" @click="addMaskWord">添加</button>
      </div>
      <div class="chips">
        <span v-for="(w,i) in maskWords" :key="i" class="chip">{{ w }} <b @click="removeMaskWord(i)">×</b></span>
      </div>
      <div class="mask-actions">
        <button class="btn" @click="clearMasks">清空屏蔽</button>
        <span>屏蔽区域数：{{ maskAreas.length }}</span>
      </div>
    </div>
    
  </div>
  
</template>

<style scoped lang="scss">
// 页面容器与头部
.container {
  width: 100%; margin: 0 auto; background: #fff; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden;
  .header {
    background: linear-gradient(45deg, #4CAF50, #45a049); color: #fff; padding: 30px; text-align: center;
    h1 { font-size: 2em; margin-bottom: 10px }
    p { font-size: 1em; opacity: .9 }
  }
  .content { padding: 40px }
}

// 上传与预览区域
.right-panel {
  .upload-section { text-align: center; margin-bottom: 40px }
  .upload-area { border: 3px dashed #4CAF50; border-radius: 15px; padding: 60px 20px; background: #f8f9fa; transition: .3s; cursor: pointer;
    &:hover { background: #e8f5e8; border-color: #45a049 }
    &.dragover { background: #e8f5e8; border-color: #45a049 }
    .upload-btn { background: #4CAF50; color: #fff; border: none; padding: 15px 30px; border-radius: 25px; font-size: 1.1em; cursor: pointer; transition: .3s;
      &:hover { background: #45a049; transform: translateY(-2px) }
    }
    .file-input { display: none }
  }
  .preview-section { margin-top: 30px; text-align: center;
    .preview-image { max-width: 100%; max-height: 400px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.2) }
  }
}

// 操作按钮与结果区域
.btn-group { text-align: center; margin-top: 20px;
  .btn { background: #2196F3; color: #fff; border: none; padding: 12px 25px; border-radius: 20px; margin: 0 10px; cursor: pointer; font-size: 1em; transition: .3s;
    &:hover { background: #1976D2; transform: translateY(-2px) }
    &:disabled { background: #ccc; cursor: not-allowed; transform: none }
  }
}

.results-section { margin-top: 40px; padding: 30px; background: #f8f9fa; border-radius: 15px;
  .score-display { text-align: center; font-size: 1.6em; color: #4CAF50; margin-bottom: 20px }
  .details { margin-top: 20px }
}

// OCR结果面板
.ocr-panel { margin-top: 20px; padding: 20px; background: #fff8e1; border-radius: 12px; border: 1px solid #ffe082;
  .ocr-text { white-space: pre-wrap; font-family: Consolas, Monaco, monospace; background: #fff; border: 1px dashed #ffc107; padding: 12px; border-radius: 8px }
}

.block { background: #fff; border-radius: 8px; padding: 12px; margin-top: 12px; border: 1px solid #eee;
  pre { white-space: pre-wrap; font-family: Consolas, Monaco, monospace; font-size: 12px }
  .answer-list { display: flex; flex-direction: column; gap: 10px;
    .answer-item { display: flex; align-items: center; gap: 10px;
      .index { min-width: 60px; font-weight: 600 }
      input { flex: 1; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px }
      .remove { background: #f44336; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer }
    }
  }
  .add-row { margin-top: 10px; display: flex; gap: 10px; justify-content: flex-end;
    .add { background: #4CAF50; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer }
  }
}

.preview-grid { display: flex; flex-wrap: nowrap; gap: 12px; align-items: flex-start; margin: 12px 0 }
.preview-item { flex: 1 0 33.33%; min-width: 0 }
.img-fit { width: 100%; height: auto; border-radius: 8px }
.placeholder { width: 100%; height: 200px; border: 1px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #888 }
.mask-words { display: flex; gap: 8px; align-items: center; margin-bottom: 8px;
  input { flex: 1; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px }
}
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0;
  .chip { background: #e0f2f1; color: #00695c; padding: 4px 8px; border-radius: 12px; font-size: 12px;
    b { margin-left: 6px; cursor: pointer }
  }
}
.mask-actions { display: flex; gap: 10px; align-items: center }

// 提示与信息条
.loading { text-align: center; padding: 20px; font-size: 1.1em; color: #666 }
.error { background: #ffebee; color: #c62828; padding: 15px; border-radius: 10px; margin: 10px 0 }
.success { background: #e8f5e8; color: #2e7d32; padding: 15px; border-radius: 10px; margin: 10px 0 }

// 模态框样式
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5);
  display: flex; justify-content: center; align-items: center; z-index: 1000;
}
.modal-content {
  background: white; border-radius: 15px; padding: 20px; max-width: 90%; max-height: 90%; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}

.settings { max-width: 720px }
.tip-icon { margin-left: 6px; cursor: help; vertical-align: middle }

// 移动端适配
@media (max-width: 768px) {
  .container { .content { padding: 16px } }
  .right-panel { .upload-area { padding: 30px 12px } .preview-section { .preview-image { max-height: 260px } } }
  .btn-group { .btn { padding: 10px 18px; border-radius: 16px } }
}

// 4K适配
@media (min-width: 2560px) {
  .container { width: 100%; .header { h1 { font-size: clamp(2.2em, 1.6vw, 3em) } p { font-size: clamp(1.1em, 1vw, 1.6em) } } }
  .right-panel { .upload-area { padding: 80px 30px } .preview-section { .preview-image { max-height: 600px } } }
  .btn-group { .btn { font-size: clamp(1em, 0.9vw, 1.4em); padding: 16px 28px } }
}
</style>
