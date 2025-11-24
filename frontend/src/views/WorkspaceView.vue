<script setup>
import AnswerEditor from '../components/AnswerEditor.vue'
import ProgressBar from '../components/ProgressBar.vue'
import ResultCard from '../components/ResultCard.vue'
import AreaSelector from '../components/AreaSelector.vue'
import BatchEdit from '../components/BatchEdit.vue'
import ErrorBook from '../components/ErrorBook.vue'
import HistoryPanel from '../components/HistoryPanel.vue'
import OCRSettings from '../components/OCRSettings.vue'
import { ref, watch, computed } from 'vue'
import { uploadPaper as uploadPaperAPI, gradePaper as gradePaperAPI, handwritingByImages, accurateByImages, generalByImages, docByImages } from '../api'
import { filterWordsByMasks, buildTextFromWords, cropAreasToBase64 } from '../utils/ocr'
import { areasMinusMasks, docRecognize, paperRecognize, handwritingRecognize, accurateRecognize, generalRecognize, normalizeText, useOcrState } from '../utils/ocr'

const {
  fileInput,
  selectedFile,
  imagePreview,
  uploadedFile,
  ocrResult,
  selectedAreas,
  maskAreas,
  maskWords,
  newMaskWord,
  showAreaSelector,
  showMaskSelector,
  showImages,
  apiChoice,
  showSettings,
  docOptions,
  paperOptions,
  handwritingOptions,
  accurateOptions,
  generalOptions,
  imageSize,
  croppedPreviews,
  maskPreview,
  extracted
} = useOcrState({ showImagesDefault: true })
const studentAnswers = ref([])
const gradeResult = ref(null)
const loading = ref(false)
const loadingMessage = ref('')
const error = ref(null)
const success = ref(null)
const autoFillWhenEmptyOnly = ref(false)
const batchResults = ref([])
const standardAnswers = ref([])
const answerDetails = ref([])
const showBatchEdit = ref(false)
const showErrorBook = ref(false)
const showHistory = ref(false)
const showOcrPanel = ref(false)
const showBatchDetail = ref(false)
const selectedBatch = ref(null)

const isAreasCountMatch = computed(() => {
  const a = (selectedAreas.value || []).length
  const s = (standardAnswers.value || []).length
  return a === 0 || a === s
})

 

function triggerFileInput() { fileInput.value && fileInput.value.click() }
function createImagePreview(file) {
  const reader = new FileReader()
  reader.onload = e => { imagePreview.value = e.target.result }
  reader.readAsDataURL(file)
  const img = new Image()
  img.onload = () => { imageSize.value = { width: img.naturalWidth, height: img.naturalHeight } }
  img.src = URL.createObjectURL(file)
}
const displayFileName = computed(() => fixDisplayName(selectedFile.value?.name || ''))
function fixDisplayName(str) {
  const s = String(str || '')
  let decoded = s
  try { decoded = decodeURIComponent(escape(s)) } catch (e) {}
  decoded = decoded.replace(/\.[^.]+$/, '')
  return decoded
}
function clearMessages() { error.value = null; success.value = null }
function handleFileSelect(e) {
  const file = e.target.files[0]
  if (file && file.type.startsWith('image/')) { selectedFile.value = file; createImagePreview(file); clearMessages() } else { error.value = '请选择图片文件' }
}
function buildDetails() {
  function normJudge(s) { const v = (s || '').trim(); if (!v) return ''; if (/^(√|v|V|✔|t|T|true)$/i.test(v)) return '√'; if (/^(×|x|X|✖|f|F|false)$/i.test(v)) return '×'; return v }
  function normChoice(s) { const v = (s || '').trim(); if (!v) return ''; return v.toUpperCase() }
  function isCorrect(std, s) {
    const type = std.type || 'fill'
    const stdAns = String(std.answer || '')
    const stuAns = String(s || '')
    if (type === 'judge') { const sj = normJudge(stuAns); const st = normJudge(stdAns); return sj === st || normalizeText(stuAns).includes(normalizeText(stdAns)) }
    if (type === 'choice') { const sc = normChoice(stuAns); const st = normChoice(stdAns); return sc === st || normalizeText(stuAns).includes(normalizeText(stdAns)) }
    return normalizeText(stuAns) === normalizeText(stdAns)
  }
  answerDetails.value = standardAnswers.value.map((std, i) => {
    const s = studentAnswers.value[i] || ''
    const ok = isCorrect(std, s)
    return { student: s, standard: std.answer, score: ok ? std.score : 0, maxScore: std.score }
  })
}
function handleDrop(e) { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && file.type.startsWith('image/')) { selectedFile.value = file; createImagePreview(file); clearMessages() } else { error.value = '请拖拽图片文件' } e.target.classList.remove('dragover') }
function dragOver(e) { e.target.classList.add('dragover') }
function dragLeave(e) { e.target.classList.remove('dragover') }

async function uploadPaper() {
  if (!selectedFile.value) return
  loading.value = true; loadingMessage.value = '正在上传试卷...'; clearMessages()
  const formData = new FormData(); formData.append('paper', selectedFile.value)
  try { const res = await uploadPaperAPI(formData); uploadedFile.value = res.data; success.value = '试卷上传成功' } catch (err) { error.value = '试卷上传失败：' + (err.response?.data?.error || err.message) } finally { loading.value = false }
}

 

async function startOCR() { if (!uploadedFile.value) return; await runUnifiedOCR() }
function pretty(v) { return v ? JSON.stringify(v, null, 2) : '' }

async function runUnifiedOCR() {
  loading.value = true; loadingMessage.value = selectedAreas.value.length ? '选区识别中...' : 'OCR识别中...'; clearMessages()
  try {
    switch (apiChoice.value) {
      case 'paper': await runPaper(); break
      case 'handwriting': await runHandwriting(); break
      case 'accurate': await runAccurate(); break
      case 'general': await runGeneral(); break
      default: await runDoc(); break
    }
  } catch (err) { error.value = err.response?.data?.error || err.message } finally { loading.value = false; renderCrops() }
}

async function runDoc() {
  const r = await docRecognize({ filename: uploadedFile.value.filename, areas: selectedAreas.value, maskAreas: maskAreas.value, maskWords: maskWords.value, options: docOptions.value })
  ocrResult.value = { fullText: r.fullText, words: r.words }
  extracted.value = r.extracted
  autoFillStudentAnswers()
  success.value = selectedAreas.value.length ? 'doc分析（选区）完成' : 'doc分析完成'
}

async function runPaper() {
  const r = await paperRecognize({ filename: uploadedFile.value.filename, imageSrc: imagePreview.value, areas: selectedAreas.value, maskAreas: maskAreas.value, maskWords: maskWords.value, options: paperOptions.value })
  extracted.value = r.extracted
  autoFillStudentAnswers()
  success.value = selectedAreas.value.length ? '试卷切题识别完成（区域）' : '试卷切题识别完成'
}

async function runHandwriting() {
  const r = await handwritingRecognize({ filename: uploadedFile.value.filename, areas: selectedAreas.value, maskAreas: maskAreas.value, maskWords: maskWords.value, options: handwritingOptions.value })
  extracted.value = r.extracted
  autoFillStudentAnswers()
  success.value = selectedAreas.value.length ? '手写区域识别完成' : '手写整图识别完成'
}

async function runAccurate() {
  const r = await accurateRecognize({ filename: uploadedFile.value.filename, imageSrc: imagePreview.value, areas: selectedAreas.value, maskAreas: maskAreas.value, maskWords: maskWords.value, imageSize: imageSize.value, options: accurateOptions.value })
  extracted.value = r.extracted
  autoFillStudentAnswers()
  success.value = selectedAreas.value.length ? '高精度区域识别完成' : '高精度整图识别完成'
}

async function runGeneral() {
  const r = await generalRecognize({ filename: uploadedFile.value.filename, imageSrc: imagePreview.value, areas: selectedAreas.value, maskAreas: maskAreas.value, maskWords: maskWords.value, imageSize: imageSize.value, options: generalOptions.value })
  extracted.value = r.extracted
  autoFillStudentAnswers()
  success.value = selectedAreas.value.length ? '通用区域识别完成' : '通用整图识别完成'
}

async function runWholeBracket() {
  loading.value = true; loadingMessage.value = '整图识别中...'; clearMessages()
  try {
    switch (apiChoice.value) {
      case 'paper': {
        const r = await paperRecognize({ filename: uploadedFile.value.filename, imageSrc: imagePreview.value, areas: [], maskAreas: maskAreas.value, maskWords: maskWords.value, options: paperOptions.value })
        extracted.value = r.extracted
        autoFillStudentAnswers()
        break
      }
      case 'handwriting': {
        const r = await handwritingRecognize({ filename: uploadedFile.value.filename, areas: [], maskAreas: maskAreas.value, maskWords: maskWords.value, options: handwritingOptions.value })
        extracted.value = r.extracted
        autoFillStudentAnswers()
        break
      }
      case 'accurate': {
        const r = await accurateRecognize({ filename: uploadedFile.value.filename, imageSrc: imagePreview.value, areas: [], maskAreas: maskAreas.value, maskWords: maskWords.value, imageSize: imageSize.value, options: accurateOptions.value })
        extracted.value = r.extracted
        autoFillStudentAnswers()
        break
      }
      case 'general': {
        const r = await generalRecognize({ filename: uploadedFile.value.filename, imageSrc: imagePreview.value, areas: [], maskAreas: maskAreas.value, maskWords: maskWords.value, imageSize: imageSize.value, options: generalOptions.value })
        extracted.value = r.extracted
        autoFillStudentAnswers()
        break
      }
      default: {
        const r = await docRecognize({ filename: uploadedFile.value.filename, areas: [], maskAreas: maskAreas.value, maskWords: maskWords.value, options: docOptions.value })
        extracted.value = r.extracted
        autoFillStudentAnswers()
        break
      }
    }
    success.value = '整图识别括号答案提取完成'
  } catch (err) { error.value = err.response?.data?.error || err.message } finally { loading.value = false }
}

async function runAreaAnswers() {
  if (!selectedAreas.value.length) { error.value = '请先进行区域框选'; return }
  loading.value = true; loadingMessage.value = '答案区域检测中...'; clearMessages()
  try {
    const areasCropped = areasMinusMasks(selectedAreas.value, maskAreas.value)
    const imgs = (await cropAreasToBase64(imagePreview.value, areasCropped)).map(u => (u || '').split(',')[1])
    switch (apiChoice.value) {
      case 'handwriting': {
        const by = await handwritingByImages(imgs, handwritingOptions.value)
        const results = by.data?.results || []
        const perTexts = results.map(r => toBracketAnswer(buildTextFromWords(r.words || []) || (r.text || '')))
        extracted.value = perTexts
        autoFillStudentAnswers()
        break
      }
      case 'accurate': {
        const by = await accurateByImages(imgs, accurateOptions.value)
        const results = by.data?.results || []
        const perTexts = results.map(r => toBracketAnswer(buildTextFromWords(r.words || []) || (r.text || '')))
        extracted.value = perTexts
        autoFillStudentAnswers()
        break
      }
      case 'general': {
        const by = await generalByImages(imgs, generalOptions.value)
        const results = by.data?.results || []
        const perTexts = results.map(r => toBracketAnswer(buildTextFromWords(r.words || []) || (r.text || '')))
        extracted.value = perTexts
        autoFillStudentAnswers()
        break
      }
      case 'paper': {
        error.value = '答案区域检测暂不支持 paper_cut_edu 接口';
        break
      }
      default: {
        const by = await docByImages(imgs, docOptions.value)
        const parts = by.data?.parts || []
        const perTexts = parts.map(p => toBracketAnswer(buildTextFromWords(p.words || []) || (p.text || '')))
        extracted.value = perTexts
        autoFillStudentAnswers()
        break
      }
    }
    if (!error.value) success.value = '答案区域检测完成'
  } catch (err) { error.value = err.response?.data?.error || err.message } finally { loading.value = false; renderCrops() }
}

async function gradePaper() { loading.value = true; loadingMessage.value = '正在进行智能评分...'; clearMessages(); try { const res = await gradePaperAPI(standardAnswers.value, studentAnswers.value); gradeResult.value = res.data; buildDetails(); success.value = '评分完成'; saveToHistory() } catch (err) { error.value = '评分失败：' + (err.response?.data?.error || err.message) } finally { loading.value = false } }

function handleAreaSelected(areas) { selectedAreas.value = areas; showAreaSelector.value = false }
function onMaskSelected(list) { maskAreas.value = list; showMaskSelector.value = false }
function addMaskWord() { const v = normalizeText(newMaskWord.value || ''); if (!v) return; if (!maskWords.value.includes(v)) maskWords.value.push(v); newMaskWord.value = '' }
function removeMaskWord(i) { maskWords.value.splice(i,1) }
function clearMasks() { maskAreas.value = []; maskWords.value = []; maskPreview.value = null }


function addToErrorBook(question, studentAnswer, correctAnswer) { const errorBook = JSON.parse(localStorage.getItem('errorBook') || '[]'); errorBook.push({ id: Date.now(), question, studentAnswer, correctAnswer, addTime: new Date().toISOString(), analysis: '' }); localStorage.setItem('errorBook', JSON.stringify(errorBook)) }
function saveToHistory() { const history = JSON.parse(localStorage.getItem('gradingHistory') || '[]'); history.unshift({ id: Date.now(), filename: selectedFile.value.name, score: gradeResult.value.score, totalScore: gradeResult.value.totalScore, percentage: gradeResult.value.percentage, answers: studentAnswers.value, details: answerDetails.value, timestamp: new Date().toISOString() }); if (history.length > 50) { history.splice(50) } localStorage.setItem('gradingHistory', JSON.stringify(history)) }

function addAnswerToMask(ans) {
  const v = normalizeText(ans || '')
  if (!v) return
  if (!maskWords.value.includes(v)) maskWords.value.push(v)
}

function removeExtracted(val) {
  const v = normalizeText(val || '')
  const idx = (extracted.value || []).findIndex(x => normalizeText(x || '') === v)
  if (idx >= 0) extracted.value.splice(idx, 1)
}

const filteredExtracted = computed(() => (extracted.value || []).filter(ans => !maskWords.value.includes(normalizeText(ans || ''))))

function hasManualInputs() {
  return (studentAnswers.value || []).some(a => (String(a || '').trim().length > 0))
}

function autoFillStudentAnswers() {
  const list = [...filteredExtracted.value]
  if (autoFillWhenEmptyOnly.value && hasManualInputs()) { success.value = '已生成提取答案，检测到手动输入，未自动覆盖'; return }
  studentAnswers.value = list
}

function openBatchDetail(b) { selectedBatch.value = b; showBatchDetail.value = true }

async function handleBatchEditComplete(list) {
  showBatchEdit.value = false
  success.value = `批量修改完成，共 ${list.length} 项`
  batchResults.value = []
  if ((selectedAreas.value || []).length && (selectedAreas.value.length !== (standardAnswers.value || []).length)) {
    error.value = `区域框选数量（${selectedAreas.value.length}）与标准答案题数（${(standardAnswers.value || []).length}）不一致，请调整后再进行批量识别`
    return
  }
  for (const item of list) {
    const entry = { name: item.name, filename: item.filename, preview: item.preview, success: item.status === 'success', score: 0, totalScore: 0, percentage: 0, answersRaw: [], answers: [], details: [], error: item.message, show: false }
    if (!entry.success) { batchResults.value.push(entry); continue }
    try {
      let answers = []
      if ((selectedAreas.value || []).length) {
        const areasCropped = areasMinusMasks(selectedAreas.value, maskAreas.value)
        const imgs = (await cropAreasToBase64(item.preview, areasCropped)).map(u => (u || '').split(',')[1])
        if (apiChoice.value === 'handwriting') {
          const by = await handwritingByImages(imgs, handwritingOptions.value)
          const results = by.data?.results || []
          answers = results.map(r => toBracketAnswer(buildTextFromWords(r.words || []) || (r.text || '')))
        } else if (apiChoice.value === 'accurate') {
          const by = await accurateByImages(imgs, accurateOptions.value)
          const results = by.data?.results || []
          answers = results.map(r => toBracketAnswer(buildTextFromWords(r.words || []) || (r.text || '')))
        } else if (apiChoice.value === 'general') {
          const by = await generalByImages(imgs, generalOptions.value)
          const results = by.data?.results || []
          answers = results.map(r => toBracketAnswer(buildTextFromWords(r.words || []) || (r.text || '')))
        } else {
          const by = await docByImages(imgs, docOptions.value)
          const parts = by.data?.parts || []
          answers = parts.map(p => toBracketAnswer(buildTextFromWords(p.words || []) || (p.text || '')))
        }
      } else {
        if (apiChoice.value === 'paper') {
          const r = await paperRecognize({ filename: item.filename, imageSrc: item.preview, areas: [], maskAreas: maskAreas.value, maskWords: maskWords.value, options: paperOptions.value })
          answers = r.extracted || []
        } else if (apiChoice.value === 'handwriting') {
          const r = await handwritingRecognize({ filename: item.filename, areas: [], maskAreas: maskAreas.value, maskWords: maskWords.value, options: handwritingOptions.value })
          answers = r.extracted || []
        } else if (apiChoice.value === 'accurate') {
          const r = await accurateRecognize({ filename: item.filename, imageSrc: item.preview, areas: [], maskAreas: maskAreas.value, maskWords: maskWords.value, imageSize: imageSize.value, options: accurateOptions.value })
          answers = r.extracted || []
        } else if (apiChoice.value === 'general') {
          const r = await generalRecognize({ filename: item.filename, imageSrc: item.preview, areas: [], maskAreas: maskAreas.value, maskWords: maskWords.value, imageSize: imageSize.value, options: generalOptions.value })
          answers = r.extracted || []
        } else {
          const r = await docRecognize({ filename: item.filename, areas: [], maskAreas: maskAreas.value, maskWords: maskWords.value, options: docOptions.value })
          answers = r.extracted || []
        }
      }
      entry.answersRaw = answers || []
      const filtered = (answers || []).filter(ans => !maskWords.value.includes(normalizeText(ans || '')))
      const grade = await gradePaperAPI(standardAnswers.value, filtered)
      entry.score = grade.data?.score || 0
      entry.totalScore = grade.data?.totalScore || (standardAnswers.value || []).length
      entry.percentage = grade.data?.percentage || 0
      entry.answers = filtered
      entry.details = buildDetailsFor(filtered)
    } catch (e) {
      entry.error = e.response?.data?.error || e.message
      entry.success = false
    }
    batchResults.value.push(entry)
  }
}

function buildDetailsFor(list) {
  const std = standardAnswers.value || []
  const stu = list || []
  function normJudge(s) { const v = (s || '').trim(); if (!v) return ''; if (/^(√|v|V|✔|t|T|true)$/i.test(v)) return '√'; if (/^(×|x|X|✖|f|F|false)$/i.test(v)) return '×'; return v }
  function normChoice(s) { const v = (s || '').trim(); if (!v) return ''; return v.toUpperCase() }
  function isCorrect(std, s) {
    const type = std.type || 'fill'
    const stdAns = String(std.answer || '')
    const stuAns = String(s || '')
    if (type === 'judge') { const sj = normJudge(stuAns); const st = normJudge(stdAns); return sj === st || normalizeText(stuAns).includes(normalizeText(stdAns)) }
    if (type === 'choice') { const sc = normChoice(stuAns); const st = normChoice(stdAns); return sc === st || normalizeText(stuAns).includes(normalizeText(stdAns)) }
    return normalizeText(stuAns) === normalizeText(stdAns)
  }
  return std.map((ans, i) => {
    const s = stu[i] || ''
    const ok = isCorrect(ans, s)
    return { index: i + 1, type: ans.type || 'fill', standard: ans.answer, student: s, correct: ok, score: ok ? ans.score : 0, maxScore: ans.score }
  })
}

function toBracketAnswer(raw) {
  const s = String(raw || '')
  const t = s.replace(/（/g, '(').replace(/）/g, ')')
  const i = t.indexOf('(')
  if (i >= 0) {
    const j = t.indexOf(')', i + 1)
    return (j >= 0 ? t.slice(i + 1, j) : t.slice(i + 1)).trim()
  }
  return t.trim()
}

function renderCrops() { if (!imagePreview.value || selectedAreas.value.length === 0 || !imageSize.value.width) { croppedPreviews.value = []; return } const img = new Image(); img.src = imagePreview.value; img.onload = () => { const out = []; const areasToCrop = areasMinusMasks(selectedAreas.value, maskAreas.value); for (const a of areasToCrop) { const sx = Math.max(0, Math.min(Math.round(a.x), img.naturalWidth)); const sy = Math.max(0, Math.min(Math.round(a.y), img.naturalHeight)); const sw = Math.max(1, Math.min(Math.round(a.width), img.naturalWidth - sx)); const sh = Math.max(1, Math.min(Math.round(a.height), img.naturalHeight - sy)); const canvas = document.createElement('canvas'); canvas.width = sw; canvas.height = sh; const ctx = canvas.getContext('2d'); ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh); out.push(canvas.toDataURL('image/png')) } croppedPreviews.value = out } }
function renderMaskPreview() { if (!imagePreview.value || !imageSize.value.width) { maskPreview.value = null; return } const img = new Image(); img.src = imagePreview.value; img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); ctx.strokeStyle = '#e53935'; ctx.lineWidth = 3; for (const a of maskAreas.value) { ctx.fillStyle = 'rgba(229,57,53,0.15)'; ctx.fillRect(a.x, a.y, a.width, a.height); ctx.strokeRect(a.x, a.y, a.width, a.height) } maskPreview.value = canvas.toDataURL('image/png') } }

watch(selectedAreas, renderCrops, { deep: true }); watch(maskAreas, renderMaskPreview, { deep: true }); watch(imagePreview, () => { renderCrops(); renderMaskPreview() })
function toTypeLabel(t) { const m = { fill: '填空题', choice: '选择题', judge: '判断题' }; return m[String(t||'')] || '填空题' }
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
              <p>{{ displayFileName }}</p>
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
              <div class="crops" v-if="croppedPreviews.length">
                <img v-for="(u,i) in croppedPreviews" :key="i" class="img-fit" :src="u" />
              </div>
              <div v-else class="placeholder">未框选区域</div>
            </div>
            <div class="preview-item">
              <h3>屏蔽区域预览</h3>
              <img v-if="maskPreview" class="img-fit" :src="maskPreview" />
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
          <button class="btn" @click="showMaskSelector = true">屏蔽区域</button>
          <button class="btn" @click="showSettings = true">设置</button>
          <button class="btn" @click="runWholeBracket" :disabled="!uploadedFile || loading">{{ loading ? '识别中...' : '整图识别括号答案提取' }}</button>
          <button class="btn" @click="runAreaAnswers" :disabled="!uploadedFile || !selectedAreas.length || loading">{{ loading ? '检测中...' : '答案区域检测' }}</button>
          <button class="btn" @click="gradePaper" :disabled="!studentAnswers.length || !standardAnswers.length || loading">{{ loading ? '评分中...' : '开始评分' }}</button>
          <button class="btn" @click="showBatchEdit = true" :disabled="!uploadedFile || !standardAnswers.length || loading || !isAreasCountMatch">批量修改</button>
        </div>
        <div class="btn-group">
          <button class="btn" @click="showErrorBook = true">错题本</button>
          <button class="btn" @click="showHistory = true">历史记录</button>
          <button class="btn" @click="showOcrPanel = !showOcrPanel">{{ showOcrPanel ? '关闭OCR结果' : '显示OCR结果' }}</button>
          <button class="btn" @click="showImages = !showImages">{{ showImages ? '隐藏图片' : '显示图片' }}</button>
        </div>
        <div class="ocr-panel" v-if="showOcrPanel">
          <h3>提取答案（按顺序）</h3>
          <div class="answers-list" v-if="filteredExtracted.length">
            <div class="answer-row" v-for="(ans,i) in filteredExtracted" :key="i">
              <span class="text">{{ ans }}</span>
              <button class="btn" @click="addAnswerToMask(ans)">加为屏蔽词</button>
              <button class="btn del" @click="removeExtracted(ans)">删除</button>
            </div>
          </div>
          <div v-else class="placeholder">暂无提取答案</div>
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
            <button class="add" style="background:#ff9800" @click="studentAnswers = [...filteredExtracted]">用提取结果填充</button>
            <label class="toggle"><input type="checkbox" v-model="autoFillWhenEmptyOnly" /> 自动填充仅覆盖空答案</label>
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
            <ResultCard v-for="(d, i) in answerDetails" :key="i" :index="i" :student="d.student" :standard="d.standard" :score="d.score" :maxScore="d.maxScore" @add-to-error-book="addToErrorBook" />
          </div>
        </div>
        <div class="block" v-if="batchResults.length">
          <h3>批量识别与评分结果</h3>
          <div class="batch-list">
            <div class="batch-item" v-for="(b,i) in batchResults" :key="i">
              <div class="summary">
                <span class="name">{{ b.name }}</span>
                <span class="score">{{ b.score }}/{{ b.totalScore }}（{{ b.percentage }}%）</span>
                <span class="state" :class="b.success ? 'ok' : 'fail'">{{ b.success ? '成功' : '失败' }}</span>
                <button class="btn" @click="openBatchDetail(b)">查看详情</button>
              </div>
              <div class="detail" v-if="b.show">
                <div class="image" v-if="b.preview">
                  <img :src="b.preview" alt="预览" class="img-fit" />
                </div>
                <div class="answers">
                  <div>识别答案（原始）：</div>
                  <ul>
                    <li v-for="(a,j) in b.answersRaw" :key="'r'+j">{{ j+1 }}. {{ a || '未填写' }}</li>
                  </ul>
                </div>
                <div class="answers">
                  <div>识别答案（过滤后）：</div>
                  <ul>
                    <li v-for="(a,j) in b.answers" :key="'f'+j">{{ j+1 }}. {{ a || '未填写' }}</li>
                  </ul>
                </div>
                <div class="table">
                  <div class="row head"><span>题号</span><span>学生答案</span><span>题型</span><span>标准答案</span><span>分数</span><span>是否正确</span></div>
                  <div class="row" v-for="d in b.details" :key="d.index">
                    <span class="center">{{ d.index }}</span>
                    <span>{{ d.student || '未填写' }}</span>
                    <span class="type">{{ toTypeLabel(d.type) }}</span>
                    <span>{{ d.standard }}</span>
                    <span class="center">{{ d.score }}/{{ d.maxScore }}</span>
                    <span :class="d.correct ? 'status ok' : 'status fail'">{{ d.correct ? '✓' : '✗' }}</span>
                  </div>
                </div>
                <div class="answers" v-if="b.details && b.details.some(x=>!x.correct)">
                  <div>错题：</div>
                  <ul>
                    <li v-for="d in b.details.filter(x => !x.correct)" :key="'w'+d.index">第{{ d.index }}题</li>
                  </ul>
                </div>
                <div class="error" v-if="!b.success && b.error">{{ b.error }}</div>
              </div>
              </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showAreaSelector" class="modal-overlay" @click="showAreaSelector = false">
      <div class="modal-content" @click.stop>
        <AreaSelector :imageSrc="imagePreview" :modelValue="selectedAreas" @areas-selected="handleAreaSelected" @close="showAreaSelector = false" />
      </div>
    </div>
    <div v-if="showMaskSelector" class="modal-overlay" @click="showMaskSelector = false">
      <div class="modal-content" @click.stop>
        <AreaSelector :imageSrc="imagePreview" :modelValue="maskAreas" @areas-selected="onMaskSelected" @close="showMaskSelector = false" />
      </div>
    </div>
    <div v-if="showBatchEdit" class="modal-overlay" @click="showBatchEdit = false">
      <div class="modal-content" @click.stop>
        <BatchEdit @batch-edit-complete="handleBatchEditComplete" @close="showBatchEdit = false" />
      </div>
    </div>
    <div v-if="showBatchDetail" class="modal-overlay" @click="showBatchDetail = false">
      <div class="modal-content" @click.stop>
        <div v-if="selectedBatch" class="batch-detail">
          <div class="summary">
            <span class="name">{{ selectedBatch.name }}</span>
            <span class="score">{{ selectedBatch.score }}/{{ selectedBatch.totalScore }}（{{ selectedBatch.percentage }}%）</span>
            <span class="state" :class="selectedBatch.success ? 'ok' : 'fail'">{{ selectedBatch.success ? '成功' : '失败' }}</span>
          </div>
          <div class="image" v-if="selectedBatch.preview">
            <img :src="selectedBatch.preview" alt="预览" class="img-fit" />
          </div>
          <div class="answers">
            <div>识别答案（原始）：</div>
            <ul>
              <li v-for="(a,j) in selectedBatch.answersRaw" :key="'r'+j">{{ j+1 }}. {{ a || '未填写' }}</li>
            </ul>
          </div>
          <div class="answers">
            <div>识别答案（过滤后）：</div>
            <ul>
              <li v-for="(a,j) in selectedBatch.answers" :key="'f'+j">{{ j+1 }}. {{ a || '未填写' }}</li>
            </ul>
          </div>
          <div class="table">
            <div class="row head"><span>题号</span><span>学生答案</span><span>题型</span><span>标准答案</span><span>分数</span><span>是否正确</span></div>
            <div class="row" v-for="d in selectedBatch.details" :key="d.index">
              <span class="center">{{ d.index }}</span>
              <span>{{ d.student || '未填写' }}</span>
              <span class="type">{{ toTypeLabel(d.type) }}</span>
              <span>{{ d.standard }}</span>
              <span class="center">{{ d.score }}/{{ d.maxScore }}</span>
              <span :class="d.correct ? 'status ok' : 'status fail'">{{ d.correct ? '✓' : '✗' }}</span>
            </div>
          </div>
          <div class="answers" v-if="selectedBatch.details && selectedBatch.details.some(x=>!x.correct)">
            <div>错题：</div>
            <ul>
              <li v-for="d in selectedBatch.details.filter(x => !x.correct)" :key="'w'+d.index">第{{ d.index }}题</li>
            </ul>
          </div>
          <div class="error" v-if="!selectedBatch.success && selectedBatch.error">{{ selectedBatch.error }}</div>
          <div style="text-align:right;margin-top:10px"><button class="btn" @click="showBatchDetail = false">关闭</button></div>
        </div>
      </div>
    </div>
    <div v-if="showErrorBook" class="modal-overlay" @click="showErrorBook = false">
      <div class="modal-content" @click.stop>
        <ErrorBook @close="showErrorBook = false" />
      </div>
    </div>
    <div v-if="showHistory" class="modal-overlay" @click="showHistory = false">
      <div class="modal-content" @click.stop>
        <HistoryPanel @close="showHistory = false" />
      </div>
    </div>
    <div v-if="showSettings" class="modal-overlay" @click="showSettings = false">
      <div class="modal-content" @click.stop>
        <OCRSettings :apiChoice="apiChoice" v-model:docOptions="docOptions" v-model:paperOptions="paperOptions" v-model:handwritingOptions="handwritingOptions" v-model:accurateOptions="accurateOptions" v-model:generalOptions="generalOptions" @close="showSettings=false" />
      </div>
    </div>
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
.container {
  width: 100%;
  margin: 0 auto;
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  overflow: hidden;

  .header {
    background: linear-gradient(45deg, #4CAF50, #45a049);
    color: #fff;
    padding: 30px;
    text-align: center;

    h1 { font-size: 2em; margin-bottom: 10px; }
    p { font-size: 1em; opacity: .9; }
  }

  .content { padding: 40px; }
}

.right-panel {
  .upload-section {
    text-align: center;
    margin-bottom: 40px;
  }

  .upload-area {
    border: 3px dashed #4CAF50;
    border-radius: 15px;
    padding: 60px 20px;
    background: #f8f9fa;
    transition: .3s;
    cursor: pointer;

    &:hover {
      background: #e8f5e8;
      border-color: #45a049;
    }

    &.dragover {
      background: #e8f5e8;
      border-color: #45a049;
    }

    .upload-btn {
      background: #4CAF50;
      color: #fff;
      border: none;
      padding: 15px 30px;
      border-radius: 25px;
      font-size: 1.1em;
      cursor: pointer;
      transition: .3s;

      &:hover { background: #45a049; transform: translateY(-2px); }
    }

    .file-input { display: none; }
  }
}

.btn-group {
  text-align: center;
  margin-top: 20px;

  .btn {
    background: #2196F3;
    color: #fff;
    border: none;
    padding: 12px 25px;
    border-radius: 20px;
    margin: 0 10px;
    cursor: pointer;
    font-size: 1em;
    transition: .3s;

    &:hover { background: #1976D2; transform: translateY(-2px); }
    &:disabled { background: #ccc; cursor: not-allowed; transform: none; }
  }
}

.results-section {
  margin-top: 40px;
  padding: 30px;
  background: #f8f9fa;
  border-radius: 15px;

  .score-display {
    text-align: center;
    font-size: 1.6em;
    color: #4CAF50;
    margin-bottom: 20px;
  }

  .details { margin-top: 20px; }
}

.ocr-panel {
  margin-top: 20px;
  padding: 20px;
  background: #fff8e1;
  border-radius: 12px;
  border: 1px solid #ffe082;

  .ocr-text {
    white-space: pre-wrap;
    font-family: Consolas, Monaco, monospace;
    background: #fff;
    border: 1px dashed #ffc107;
    padding: 12px;
    border-radius: 8px;
  }

  .answers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .answer-row {
      display: flex;
      align-items: center;
      gap: 8px;

      .text { flex: 1; }
      .btn { background: #2196F3; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
      .btn.del { background: #f44336; }
    }
  }
}

.block {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
  border: 1px solid #eee;

  pre {
    white-space: pre-wrap;
    font-family: Consolas, Monaco, monospace;
    font-size: 12px;
  }

  .answer-list {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .answer-item {
      display: flex;
      align-items: center;
      gap: 10px;

      .index { min-width: 60px; font-weight: 600; }
      input { flex: 1; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; }
      .remove { background: #f44336; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
    }
  }

  .add-row {
    margin-top: 10px;
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    align-items: center;

    .add {
      background: #4CAF50;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
    }

    .toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
  }

  .batch-list {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .batch-item {
      border: 1px dashed #e0e0e0;
      border-radius: 8px;
      padding: 10px;

      .summary {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: space-between;

        .name { font-weight: 600; }
        .score { color: #4CAF50; }
        .state.ok { color: #4CAF50; }
        .state.fail { color: #f44336; }
      }

      .detail {
        margin-top: 8px;

        .answers { margin-bottom: 8px; }

        .table {
          display: grid;
          grid-template-columns: 60px 1fr 100px 1fr 100px 80px;
          gap: 6px;

          .row { display: contents; }
          .row.head span { font-weight: 600; background: #f6f7f9; padding: 8px 10px; border-radius: 6px }
          .row span { padding: 8px 10px; background: #fff; border-bottom: 1px solid #eee }
          .row .center { text-align: center }
          .row .type { color: #00695c; font-weight: 600 }
          .row .status { display: inline-block; text-align: center; border-radius: 12px; padding: 2px 8px }
          .row .status.ok { background: #e8f5e9; color: #2e7d32 }
          .row .status.fail { background: #ffebee; color: #c62828 }
        }

        .error { color: #f44336; margin-top: 6px; }
      }
    }
  }
}

.preview-grid {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  align-items: flex-start;
  margin: 12px 0;
}

.preview-item { flex: 1 0 33.33%; min-width: 0; }

.img-fit { width: 100%; height: auto; border-radius: 8px; }

.placeholder {
  width: 100%;
  height: 200px;
  border: 1px dashed #ccc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
}

.mask-words {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;

  input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
  }
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0;

  .chip {
    background: #e0f2f1;
    color: #00695c;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;

    b { margin-left: 6px; cursor: pointer; }
  }
}

.mask-actions { display: flex; gap: 10px; align-items: center; }

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 15px;
  padding: 20px;
  max-width: 90%;
  max-height: 90%;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}

.settings { max-width: 720px; }

.tip-icon { margin-left: 6px; cursor: help; vertical-align: middle; }

@media (max-width: 768px) {
  .container { .content { padding: 16px; } }

  .right-panel {
    .upload-area { padding: 30px 12px; }
    .preview-section { .preview-image { max-height: 260px; } }
  }

  .btn-group { .btn { padding: 10px 18px; border-radius: 16px; } }
}

@media (min-width: 2560px) {
  .container {
    width: 100%;

    .header {
      h1 { font-size: clamp(2.2em, 1.6vw, 3em); }
      p { font-size: clamp(1.1em, 1vw, 1.6em); }
    }
  }

  .right-panel {
    .upload-area { padding: 80px 30px; }
    .preview-section { .preview-image { max-height: 600px; } }
  }

  .btn-group { .btn { font-size: clamp(1em, 0.9vw, 1.4em); padding: 16px 28px; } }
}
</style>
