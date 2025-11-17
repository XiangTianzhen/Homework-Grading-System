<script setup>
import { ref, watch } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'
import AreaSelector from '../components/AreaSelector.vue'
import { uploadPaper as uploadPaperAPI, recognizeOCR, recognizeOCRWithAreas, paperCutEdu } from '../api'

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
const apiChoice = ref('doc')
const showSettings = ref(false)
const docOptions = ref({ language_type: 'CHN_ENG', result_type: 'big', detect_direction: false, line_probability: false, disp_line_poly: false, words_type: 'handprint_mix', layout_analysis: false, recg_formula: false, recg_long_division: false, disp_underline_analysis: false, recg_alter: false })
const paperOptions = ref({ language_type: 'CHN_ENG', detect_direction: false, words_type: 'handprint_mix', splice_text: true, enhance: true })
const paperRes = ref(null)
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
function clearMasks() { maskAreas.value = []; maskWords.value = []; maskPreview.value = null }
function isInAnyMask(pos) {
  if (!pos) return false
  const cx = pos.left + (pos.width || 0)/2
  const cy = pos.top + (pos.height || 0)/2
  return maskAreas.value.some(a => cx>=a.x && cx<=a.x+a.width && cy>=a.y && cy<=a.y+a.height)
}
 

async function runUnifiedOCR() {
  if (!uploaded.value) return
  if (apiChoice.value === 'paper') {
    loading.value = true; msg.value = '试卷切题识别中...'; err.value = ''
    try {
      const res = await paperCutEdu(uploaded.value.filename, paperOptions.value)
      paperRes.value = res.data
      // 从 questions 中尝试提取答案文本
      const arr = (paperRes.value.questions || []).map(q => (q.answer || '').trim()).filter(Boolean)
      extracted.value = arr.length ? arr : (paperRes.value.questions || []).map(q => (q.stem || '').match(/\(([^()]{1,64})\)/)?.[1] || '').filter(Boolean)
      msg.value = '试卷切题识别完成'
    } catch (e) { err.value = e.response?.data?.error || e.message } finally { loading.value = false }
    renderCrops()
  } else {
    const res = await recognizeOCR(uploaded.value.filename, docOptions.value)
    ocrRes.value = res.data
    extractAnswers()
    renderCrops()
  }
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
      <el-select v-model="apiChoice" placeholder="选择识别接口" style="width: 180px">
        <el-option label="文档分析（doc_analysis）" value="doc" />
        <el-option label="试卷切题识别（paper_cut_edu）" value="paper" />
      </el-select>
      <button class="btn" @click="showSettings = true">设置</button>
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
      <pre v-if="apiChoice==='doc'">{{ pretty(ocrRes) }}</pre>
      <pre v-else>{{ pretty(paperRes) }}</pre>
    </div>

    <div v-if="showSettings" class="modal" @click="showSettings = false">
      <div class="modal-body" @click.stop>
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
          <div v-else>
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
          <div style="text-align:right;margin-top:10px"><button class="btn" @click="showSettings=false">关闭</button></div>
        </div>
      </div>
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
.preview-grid { display: flex; flex-wrap: nowrap; gap: 12px; align-items: flex-start; margin: 12px 0 }
.preview-item { flex: 1 1 0; min-width: 0 }
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
  .settings { max-width: 720px }
  .tip-icon { margin-left: 6px; cursor: help; vertical-align: middle }
}
</style>