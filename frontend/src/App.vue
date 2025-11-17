<script setup>
// 工作台页面：上传图片→区域OCR→评分→历史与错题管理
import AnswerEditor from './components/AnswerEditor.vue'
import ProgressBar from './components/ProgressBar.vue'
import ResultCard from './components/ResultCard.vue'
import AreaSelector from './components/AreaSelector.vue'
import BatchUpload from './components/BatchUpload.vue'
import ErrorBook from './components/ErrorBook.vue'
import QuestionTypeSelector from './components/QuestionTypeSelector.vue'
import HistoryPanel from './components/HistoryPanel.vue'
import TestImageGenerator from './components/TestImageGenerator.vue'
import { ref, computed } from 'vue'
import { uploadPaper as uploadPaperAPI, recognizeOCR, gradePaper as gradePaperAPI, recognizeOCRWithAreas, batchProcess } from './api'

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
const questionTypes = ref({})
const currentQuestionType = ref(null)
const showAreaSelector = ref(false)
const showBatchUpload = ref(false)
const showErrorBook = ref(false)
const showHistory = ref(false)
const batchResults = ref([])
const showGenerator = ref(false)
const showOcrPanel = ref(false)
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

// 启动OCR识别：若有选定区域则按区域识别，否则整图识别
async function startOCR() {
  if (!uploadedFile.value) return
  loading.value = true
  loadingMessage.value = '正在进行OCR识别...'
  clearMessages()
  try {
    let res
    // 如果有选定区域，使用区域OCR
    if (selectedAreas.value.length > 0) {
      res = await recognizeOCRWithAreas(uploadedFile.value.filename, selectedAreas.value)
      // 从区域结果中提取答案
      studentAnswers.value = res.data.results.map(result => result.text || '').filter(text => text)
    } else {
      res = await recognizeOCR(uploadedFile.value.filename)
      studentAnswers.value = res.data.answers || []
    }
    ocrResult.value = res.data
    success.value = 'OCR识别完成'
  } catch (err) {
    error.value = 'OCR识别失败：' + (err.response?.data?.error || err.message)
  } finally {
    loading.value = false
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
        <div class="preview-section" v-if="imagePreview">
          <h3>试卷预览</h3>
          <img :src="imagePreview" alt="试卷预览" class="preview-image">
        </div>
        <div class="btn-group" v-if="selectedFile">
          <button class="btn" @click="uploadPaper" :disabled="loading">{{ loading ? '上传中...' : '上传试卷' }}</button>
          <button class="btn" @click="startOCR" :disabled="!uploadedFile || loading">{{ loading ? '识别中...' : '开始识别' }}</button>
          <button class="btn" @click="gradePaper" :disabled="!ocrResult || loading">{{ loading ? '评分中...' : '开始评分' }}</button>
          <button class="btn" @click="showAreaSelector = true">区域框选</button>
          <button class="btn" @click="showBatchUpload = true">批量上传</button>
        </div>
        <div class="btn-group">
          <button class="btn" @click="showErrorBook = true">错题本</button>
          <button class="btn" @click="showHistory = true">历史记录</button>
          <button class="btn" @click="currentQuestionType = 'choice'">题型设置</button>
          <button class="btn" @click="showOcrPanel = !showOcrPanel">{{ showOcrPanel ? '关闭OCR结果' : '显示OCR结果' }}</button>
        </div>
        <div class="ocr-panel" v-if="showOcrPanel">
          <h3>OCR识别结果</h3>
          <pre class="ocr-text" v-if="ocrTextLines.length">{{ ocrTextLines.join('\n') }}</pre>
          <p v-else>暂无识别结果</p>
        </div>
        <AnswerEditor v-model="standardAnswers" />
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
        <AreaSelector :imageSrc="imagePreview" @areas-selected="handleAreaSelected" @close="showAreaSelector = false" />
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
    
    <!-- 题型设置模态框 -->
    <div v-if="currentQuestionType" class="modal-overlay" @click="currentQuestionType = null">
      <div class="modal-content" @click.stop>
        <QuestionTypeSelector :currentType="currentQuestionType" @save-config="questionTypes = $event" @close="currentQuestionType = null" />
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
