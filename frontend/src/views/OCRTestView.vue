<script setup>
import { ref, watch } from 'vue'
import AreaSelector from '../components/AreaSelector.vue'
import { uploadPaper as uploadPaperAPI, recognizeOCR, recognizeOCRWithAreas } from '../api'

const fileInput = ref(null)
const selectedFile = ref(null)
const imagePreview = ref(null)
const uploaded = ref(null)
const ocrRes = ref(null)
const showAreaSelector = ref(false)
const areas = ref([])
const showMaskSelector = ref(false)
const maskAreas = ref([])
const maskWords = ref([])
const newMaskWord = ref('')
const extracted = ref([])
const loading = ref(false)
const msg = ref('')
const err = ref('')
const showUploadRes = ref(false)
const showOcrRes = ref(false)
const showImages = ref(false)
const showAreaRes = ref(false)
const imageSize = ref({ width: 0, height: 0 })
const croppedPreviews = ref([])
const maskPreview = ref(null)

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

async function runOCR() {
  if (!uploaded.value) return
  loading.value = true; msg.value = '整图OCR中...'; err.value = ''
  try {
    const res = await recognizeOCR(uploaded.value.filename)
    ocrRes.value = res.data
    msg.value = '整图OCR完成'
  } catch (e) { err.value = e.response?.data?.error || e.message } finally { loading.value = false }
}

function onAreasSelected(list) { areas.value = list; showAreaSelector.value = false }

 

function pretty(v) { return v ? JSON.stringify(v, null, 2) : '' }

function normalizeLatexFraction(s) {
  return s.replace(/\\frac\s*\{\s*(\d+)\s*\}\s*\{\s*(\d+)\s*\}/g, (_, a, b) => `${a}/${b}`)
}
function normalize(s) {
  return normalizeLatexFraction(s).replace(/\s+/g, '').replace(/[，。、．]/g, '').replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[〈⟨]/g, '(').replace(/[〉⟩]/g, ')').replace(/：/g, ':')
}
function extractAnswers() {
  // 从整图 OCR 的 words 过滤屏蔽区域和屏蔽词重新拼接文本再提取括号
  const words = (ocrRes.value?.words || [])
    .filter(w => !isInAnyMask(w.position))
    .map(w => w.text || '')
  const src = words.join('') || (ocrRes.value?.fullText || '')
  const t = normalize(src)
  const r = []
  const re = /\(([^()]{1,64})\)/g
  let m
  while ((m = re.exec(t)) !== null) {
    r.push(m[1])
  }
  const filtered = r.filter(ans => !maskWords.value.some(w => w && ans.includes(w)))
  extracted.value = filtered
}

function onMaskSelected(list) { maskAreas.value = list; showMaskSelector.value = false }
function addMaskWord() { const v = normalize(newMaskWord.value || ''); if (!v) return; if (!maskWords.value.includes(v)) maskWords.value.push(v); newMaskWord.value = '' }
function removeMaskWord(i) { maskWords.value.splice(i,1) }
function clearMasks() { maskAreas.value = []; maskWords.value = [] }
function isInAnyMask(pos) {
  if (!pos) return false
  const cx = pos.left + (pos.width || 0)/2
  const cy = pos.top + (pos.height || 0)/2
  return maskAreas.value.some(a => cx>=a.x && cx<=a.x+a.width && cy>=a.y && cy<=a.y+a.height)
}
 

async function runUnifiedOCR() {
  if (!uploaded.value) return
  await runOCR()
  extractAnswers()
  renderCrops()
}

function renderCrops() {
  if (!imagePreview.value || areas.value.length === 0 || !imageSize.value.width) { croppedPreviews.value = []; return }
  const img = new Image(); img.src = imagePreview.value
  img.onload = () => {
    const out = []
    for (const a of areas.value) {
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
      <button class="btn" @click="runUnifiedOCR" :disabled="!uploaded || loading">{{ loading ? '识别中...' : 'OCR识别' }}</button>
      <button class="btn" @click="showImages = !showImages">{{ showImages ? '隐藏图片' : '显示图片' }}</button>
      <button class="btn" @click="showUploadRes = !showUploadRes">{{ showUploadRes ? '隐藏上传返回' : '显示上传返回' }}</button>
      <button class="btn" @click="showOcrRes = !showOcrRes">{{ showOcrRes ? '隐藏识别返回' : '显示识别返回' }}</button>
    </div>

    <div class="preview-grid" v-if="showImages">
      <div class="preview-item" v-if="imagePreview">
        <h3>原图预览</h3>
        <el-image class="img-fit" :src="imagePreview" :preview-src-list="[imagePreview]" fit="contain" />
      </div>
      <div class="preview-item" v-if="croppedPreviews[0]">
        <h3>区域裁剪预览</h3>
        <el-image class="img-fit" :src="croppedPreviews[0]" :preview-src-list="[croppedPreviews[0]]" fit="contain" />
      </div>
      <div class="preview-item" v-if="maskPreview">
        <h3>屏蔽区域预览</h3>
        <el-image class="img-fit" :src="maskPreview" :preview-src-list="[maskPreview]" fit="contain" />
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
      <pre>{{ pretty(ocrRes) }}</pre>
    </div>

    

    <div class="block">
      <h3>括号答案提取</h3>
      <pre>{{ pretty(extracted) }}</pre>
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
        <AreaSelector :imageSrc="imagePreview" :single="true" :modelValue="areas" @areas-selected="onAreasSelected" @close="showAreaSelector = false" />
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
.preview-grid { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; margin: 12px 0 }
.preview-item { flex: 1 1 320px; min-width: 280px }
.img-fit { width: 100%; height: auto; border-radius: 8px }
  .block { background: #fff; border-radius: 8px; padding: 12px; margin-top: 12px; border: 1px solid #eee;
    pre { white-space: pre-wrap; font-family: Consolas, Monaco, monospace; font-size: 12px }
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
