<script setup>
import AnswerEditor from './components/AnswerEditor.vue'
import ProgressBar from './components/ProgressBar.vue'
import ResultCard from './components/ResultCard.vue'
import { ref } from 'vue'
import { uploadPaper, recognizeOCR, gradePaper } from './api'

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
const standardAnswers = ref([
  { answer: '苹果', score: 20 },
  { answer: '北京', score: 20 },
  { answer: '3.14', score: 20 },
  { answer: '李白', score: 20 },
  { answer: '2024', score: 20 }
])
const answerDetails = ref([])

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

async function uploadPaper() {
  if (!selectedFile.value) return
  loading.value = true
  loadingMessage.value = '正在上传试卷...'
  clearMessages()
  const formData = new FormData()
  formData.append('paper', selectedFile.value)
  try {
    const res = await uploadPaper(formData)
    uploadedFile.value = res.data
    success.value = '试卷上传成功'
  } catch (err) {
    error.value = '试卷上传失败：' + (err.response?.data?.error || err.message)
  } finally {
    loading.value = false
  }
}

async function startOCR() {
  if (!uploadedFile.value) return
  loading.value = true
  loadingMessage.value = '正在进行OCR识别...'
  clearMessages()
  try {
    const res = await recognizeOCR(uploadedFile.value.filename)
    ocrResult.value = res.data
    studentAnswers.value = res.data.answers || []
    success.value = 'OCR识别完成'
  } catch (err) {
    error.value = 'OCR识别失败：' + (err.response?.data?.error || err.message)
    studentAnswers.value = ['苹果', '北京', '3.14', '李白', '2024']
    success.value = '使用演示数据继续评分'
  } finally {
    loading.value = false
  }
}

async function gradePaper() {
  if (!ocrResult.value) return
  loading.value = true
  loadingMessage.value = '正在进行智能评分...'
  clearMessages()
  try {
    const res = await gradePaper(standardAnswers.value, studentAnswers.value)
    gradeResult.value = res.data
    buildDetails()
    success.value = '评分完成'
  } catch (err) {
    error.value = '评分失败：' + (err.response?.data?.error || err.message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container">
    <div class="header">
      <h1>校园试卷自动判分系统</h1>
      <p>基于OCR的手写试卷识别与评分</p>
    </div>
    <div class="content">
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
          <ResultCard v-for="(d, i) in answerDetails" :key="i" :index="i" :student="d.student" :standard="d.standard" :score="d.score" :maxScore="d.maxScore" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box }
body { font-family: 'Microsoft YaHei', Arial, sans-serif }
.container { max-width: 1200px; margin: 0 auto; background: #fff; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden }
.header { background: linear-gradient(45deg, #4CAF50, #45a049); color: #fff; padding: 30px; text-align: center }
.header h1 { font-size: 2em; margin-bottom: 10px }
.header p { font-size: 1em; opacity: .9 }
.content { padding: 40px }
.upload-section { text-align: center; margin-bottom: 40px }
.upload-area { border: 3px dashed #4CAF50; border-radius: 15px; padding: 60px 20px; background: #f8f9fa; transition: .3s; cursor: pointer }
.upload-area:hover { background: #e8f5e8; border-color: #45a049 }
.upload-area.dragover { background: #e8f5e8; border-color: #45a049 }
.upload-btn { background: #4CAF50; color: #fff; border: none; padding: 15px 30px; border-radius: 25px; font-size: 1.1em; cursor: pointer; transition: .3s }
.upload-btn:hover { background: #45a049; transform: translateY(-2px) }
.file-input { display: none }
.preview-section { margin-top: 30px; text-align: center }
.preview-image { max-width: 100%; max-height: 400px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.2) }
.results-section { margin-top: 40px; padding: 30px; background: #f8f9fa; border-radius: 15px }
.score-display { text-align: center; font-size: 1.6em; color: #4CAF50; margin-bottom: 20px }
.loading { text-align: center; padding: 20px; font-size: 1.1em; color: #666 }
.error { background: #ffebee; color: #c62828; padding: 15px; border-radius: 10px; margin: 10px 0 }
.success { background: #e8f5e8; color: #2e7d32; padding: 15px; border-radius: 10px; margin: 10px 0 }
.btn-group { text-align: center; margin-top: 20px }
.btn { background: #2196F3; color: #fff; border: none; padding: 12px 25px; border-radius: 20px; margin: 0 10px; cursor: pointer; font-size: 1em; transition: .3s }
.btn:hover { background: #1976D2; transform: translateY(-2px) }
.btn:disabled { background: #ccc; cursor: not-allowed; transform: none }
.details { margin-top: 20px }
</style>
