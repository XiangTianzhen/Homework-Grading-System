<script setup>
import { ref, watch, computed } from 'vue'
import AreaSelector from '../components/AreaSelector.vue'
import OCRSettings from '../components/OCRSettings.vue'
import { areasMinusMasks, docRecognize, paperRecognize, handwritingRecognize, accurateRecognize, generalRecognize, normalizeText, useOcrState } from '../utils/ocr'
import { uploadPaper as uploadPaperAPI } from '../api'

const {
  fileInput,
  selectedFile,
  imagePreview,
  uploaded,
  ocrRes,
  areas,
  showAreaSelector,
  showMaskSelector,
  maskAreas,
  maskWords,
  newMaskWord,
  extracted,
  loading,
  msg,
  err,
  showUploadRes,
  showOcrRes,
  showImages,
  apiChoice,
  showSettings,
  docOptions,
  paperOptions,
  handwritingOptions,
  accurateOptions,
  generalOptions,
  paperRes,
  handRes,
  accurateRes,
  generalRes,
  
  imageSize,
  croppedPreviews,
  maskPreview
} = useOcrState({ showImagesDefault: false })

function chooseFile() { fileInput.value && fileInput.value.click() }

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file || !file.type.startsWith('image/')) { err.value = '请选择图片文件'; return }
  selectedFile.value = file
  const reader = new FileReader()
  reader.onload = ev => imagePreview.value = ev.target.result
  reader.readAsDataURL(file)
  // 获取原图尺寸
  const img = new Image()
  img.onload = () => { imageSize.value = { width: img.naturalWidth, height: img.naturalHeight } }
  img.src = URL.createObjectURL(file)
}

async function upload() {
  if (!selectedFile.value) return
  loading.value = true; msg.value = '上传中...'; err.value = ''
  const fd = new FormData(); fd.append('paper', selectedFile.value)
  try {
    const res = await uploadPaperAPI(fd)
    uploaded.value = res.data
    msg.value = '上传成功'
  } catch (e) {
    err.value = e.response?.data?.error || e.message
  } finally { loading.value = false }
}

 

function onAreasSelected(list) { areas.value = list; showAreaSelector.value = false }

 

function pretty(v) { return v ? JSON.stringify(v, null, 2) : '' }

 

function onMaskSelected(list) { maskAreas.value = list; showMaskSelector.value = false }
function addMaskWord() { const v = normalizeText(newMaskWord.value || ''); if (!v) return; if (!maskWords.value.includes(v)) maskWords.value.push(v); newMaskWord.value = '' }
function removeMaskWord(i) { maskWords.value.splice(i,1) }
function clearMasks() { maskAreas.value = []; maskWords.value = []; maskPreview.value = null }

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


async function runUnifiedOCR() {
  if (!uploaded.value) return
    if (apiChoice.value === 'paper') {
      loading.value = true; msg.value = '试卷切题识别中...'; err.value = ''
    try {
      const r = await paperRecognize({ filename: uploaded.value.filename, imageSrc: imagePreview.value, areas: areas.value, maskAreas: maskAreas.value, maskWords: maskWords.value, options: paperOptions.value })
      paperRes.value = { questions: r.questions }
      extracted.value = r.extracted
      msg.value = areas.value.length ? '试卷切题识别完成（区域）' : '试卷切题识别完成'
      } catch (e) { err.value = e.response?.data?.error || e.message } finally { loading.value = false }
      renderCrops()
  } else {
    if (apiChoice.value === 'handwriting') {
      loading.value = true; err.value = ''
      try {
        const r = await handwritingRecognize({ filename: uploaded.value.filename, areas: areas.value, maskAreas: maskAreas.value, maskWords: maskWords.value, options: handwritingOptions.value })
        handRes.value = { text: r.text, words: r.words || [] }
        extracted.value = r.extracted
        msg.value = areas.value.length ? '手写区域识别完成' : '手写整图识别完成'
      } catch (e) { err.value = e.response?.data?.error || e.message } finally { loading.value = false }
    } else if (apiChoice.value === 'accurate') {
      loading.value = true; err.value = ''
      try {
        const r = await accurateRecognize({ filename: uploaded.value.filename, imageSrc: imagePreview.value, areas: areas.value, maskAreas: maskAreas.value, maskWords: maskWords.value, imageSize: imageSize.value, options: accurateOptions.value })
        accurateRes.value = { text: r.text }
        extracted.value = r.extracted
        msg.value = areas.value.length ? '高精度区域识别完成' : '高精度整图识别完成'
      } catch (e) { err.value = e.response?.data?.error || e.message } finally { loading.value = false }
    } else if (apiChoice.value === 'general') {
      loading.value = true; err.value = ''
      try {
        const r = await generalRecognize({ filename: uploaded.value.filename, imageSrc: imagePreview.value, areas: areas.value, maskAreas: maskAreas.value, maskWords: maskWords.value, imageSize: imageSize.value, options: generalOptions.value })
        generalRes.value = { text: r.text }
        extracted.value = r.extracted
        msg.value = areas.value.length ? '通用区域识别完成' : '通用整图识别完成'
      } catch (e) { err.value = e.response?.data?.error || e.message } finally { loading.value = false }
    } else {
      loading.value = true; msg.value = areas.value.length ? 'doc分析（分片）中...' : 'doc分析中...'; err.value = ''
      try {
        const r = await docRecognize({ filename: uploaded.value.filename, areas: areas.value, maskAreas: maskAreas.value, maskWords: maskWords.value, options: docOptions.value })
        ocrRes.value = { fullText: r.fullText, words: r.words }
        extracted.value = r.extracted
        msg.value = areas.value.length ? 'doc分析（选区）完成' : 'doc分析完成'
      } catch (e) {
        err.value = e.response?.data?.error || e.message
      } finally {
        loading.value = false
        renderCrops()
      }
    }
  }
}

function renderCrops() {
  if (!imagePreview.value || areas.value.length === 0 || !imageSize.value.width) { croppedPreviews.value = []; return }
  const img = new Image(); img.src = imagePreview.value
  img.onload = () => {
    const out = []
    const areasToCrop = areasMinusMasks(areas.value, maskAreas.value)
    for (const a of areasToCrop) {
      const sx = Math.max(0, Math.min(Math.round(a.x), img.naturalWidth))
      const sy = Math.max(0, Math.min(Math.round(a.y), img.naturalHeight))
      const sw = Math.max(1, Math.min(Math.round(a.width), img.naturalWidth - sx))
      const sh = Math.max(1, Math.min(Math.round(a.height), img.naturalHeight - sy))
      const canvas = document.createElement('canvas')
      canvas.width = sw; canvas.height = sh
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
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

watch(areas, renderCrops, { deep: true })
watch(maskAreas, renderMaskPreview, { deep: true })
watch(imagePreview, () => { renderCrops(); renderMaskPreview() })
</script>

<template>
  <div class="ocr-test">
    <h2>OCR 测试页（单图）</h2>
    <div class="controls">
      <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/*" class="file-input" />
      <button class="btn" @click="chooseFile">选择图片</button>
      <button class="btn" @click="upload" :disabled="!selectedFile || loading">{{ loading ? '上传中...' : '上传' }}</button>
      <button class="btn" @click="showAreaSelector = true" :disabled="!imagePreview">区域框选</button>
      <button class="btn" @click="showMaskSelector = true" :disabled="!imagePreview">屏蔽区域</button>
      <el-select v-model="apiChoice" placeholder="选择识别接口" style="width: 220px">
        <el-option label="试卷分析与识别（doc_analysis）" value="doc" />
        <el-option label="试卷切题识别（paper_cut_edu）" value="paper" />
        <el-option label="手写文字识别（handwriting）" value="handwriting" />
        <el-option label="通用文字识别（高精度版）accurate_basic" value="accurate" />
        <el-option label="通用文字识别（标准版）general_basic" value="general" />
      </el-select>
      <button class="btn" @click="showSettings = true">设置</button>
      <button class="btn" @click="runUnifiedOCR" :disabled="!uploaded || loading">{{ loading ? '识别中...' : 'OCR识别' }}</button>
      <button class="btn" @click="showImages = !showImages">{{ showImages ? '隐藏图片' : '显示图片' }}</button>
      <button class="btn" @click="showUploadRes = !showUploadRes">{{ showUploadRes ? '隐藏上传返回' : '显示上传返回' }}</button>
      <button class="btn" @click="showOcrRes = !showOcrRes">{{ showOcrRes ? '隐藏识别返回' : '显示识别返回' }}</button>
    </div>

    <div class="preview-grid" v-if="showImages">
      <div class="preview-item">
        <h3>原图预览</h3>
        <el-image v-if="imagePreview" class="img-fit" :src="imagePreview" fit="contain" />
        <div v-else class="placeholder">未选择图片</div>
      </div>
      <div class="preview-item">
        <h3>区域裁剪预览</h3>
        <div class="crops" v-if="croppedPreviews.length">
          <el-image v-for="(u,i) in croppedPreviews" :key="i" class="img-fit" :src="u" fit="contain" />
        </div>
        <div v-else class="placeholder">未框选区域</div>
      </div>
      <div class="preview-item">
        <h3>屏蔽区域预览</h3>
        <el-image v-if="maskPreview" class="img-fit" :src="maskPreview" fit="contain" />
        <div v-else class="placeholder">未设置屏蔽</div>
      </div>
    </div>

    <div class="msg" v-if="msg">{{ msg }}</div>
    <div class="err" v-if="err">{{ err }}</div>

    <div class="block" v-if="showUploadRes">
      <h3>上传返回</h3>
      <pre>{{ pretty(uploaded) }}</pre>
    </div>

    <div class="block" v-if="showOcrRes">
      <h3>OCR识别返回</h3>
      <pre v-if="apiChoice==='doc'">{{ pretty(ocrRes) }}</pre>
      <pre v-else-if="apiChoice==='paper'">{{ pretty(paperRes) }}</pre>
      <pre v-else-if="apiChoice==='handwriting'">{{ pretty(handRes) }}</pre>
      <pre v-else-if="apiChoice==='accurate'">{{ pretty(accurateRes) }}</pre>
      <pre v-else>{{ pretty(generalRes) }}</pre>
    </div>

    <div v-if="showSettings" class="modal" @click="showSettings = false">
      <div class="modal-body" @click.stop>
        <OCRSettings :apiChoice="apiChoice" v-model:docOptions="docOptions" v-model:paperOptions="paperOptions" v-model:handwritingOptions="handwritingOptions" v-model:accurateOptions="accurateOptions" v-model:generalOptions="generalOptions" @close="showSettings=false" />
      </div>
    </div>

    

    <div class="block">
      <h3 v-if="apiChoice!=='handwriting'">括号答案提取</h3>
      <h3 v-else>答案（按框选顺序）</h3>
      <div class="answers-list" v-if="filteredExtracted.length">
        <div class="answer-row" v-for="(ans,i) in filteredExtracted" :key="i">
          <span class="text">{{ ans }}</span>
          <button class="btn" @click="addAnswerToMask(ans)">加为屏蔽词</button>
          <button class="btn del" @click="removeExtracted(ans)">删除</button>
        </div>
      </div>
      <div v-else class="placeholder">暂无提取答案</div>
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

    <div v-if="showAreaSelector" class="modal" @click="showAreaSelector = false">
      <div class="modal-body" @click.stop>
        <AreaSelector :imageSrc="imagePreview" :modelValue="areas" @areas-selected="onAreasSelected" @close="showAreaSelector = false" />
      </div>
    </div>

    <div v-if="showMaskSelector" class="modal" @click="showMaskSelector = false">
      <div class="modal-body" @click.stop>
        <AreaSelector :imageSrc="imagePreview" :modelValue="maskAreas" @areas-selected="onMaskSelected" @close="showMaskSelector = false" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ocr-test { padding: 24px;
  .controls { display: flex; gap: 10px; align-items: center; margin-bottom: 16px;
    .file-input { display: none }
    .btn { background: #2196F3; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer }
    .btn:disabled { background: #ccc; cursor: not-allowed }
  }
.preview-grid { display: flex; flex-wrap: nowrap; gap: 12px; align-items: flex-start; margin: 12px 0 }
.preview-item { flex: 1 0 33.33%; min-width: 0 }
.img-fit { width: 100%; height: auto; border-radius: 8px }
  .placeholder { width: 100%; height: 200px; border: 1px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #888 }
  .block { background: #fff; border-radius: 8px; padding: 12px; margin-top: 12px; border: 1px solid #eee;
    pre { white-space: pre-wrap; font-family: Consolas, Monaco, monospace; font-size: 12px }
    .answers-list { display: flex; flex-direction: column; gap: 8px;
      .answer-row { display: flex; align-items: center; gap: 8px;
        .text { flex: 1 }
        .btn { background: #2196F3; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer }
        .btn.del { background: #f44336 }
      }
    }
  }
  .msg { background: #e8f5e9; color: #2e7d32; padding: 8px 12px; border-radius: 6px }
  .err { background: #ffebee; color: #c62828; padding: 8px 12px; border-radius: 6px }
  .modal { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center;
    .modal-body { background: #fff; padding: 12px; border-radius: 8px; max-width: 90%; max-height: 90%; overflow: auto }
  }
  .mask-words { display: flex; gap: 8px; align-items: center; margin-bottom: 8px;
    input { flex: 1; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px }
  }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0;
    .chip { background: #e0f2f1; color: #00695c; padding: 4px 8px; border-radius: 12px; font-size: 12px;
      b { margin-left: 6px; cursor: pointer }
    }
  }
  .mask-actions { display: flex; gap: 10px; align-items: center }
}
</style>