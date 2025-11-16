<script setup>
import { ref, onMounted } from 'vue'

const title = ref('数学测试卷')
const content = ref('1. 3 + 5 = 8\n2. 12 × 4 = 48\n3. 25 ÷ 5 = 5\n4. 9 - 7 = 2\n5. 6 × 7 = 42')
const fontSize = ref(28)
const width = ref(800)
const height = ref(1000)
const textColor = ref('#000000')
const bgColor = ref('#ffffff')
const lineHeight = ref(1.6)
const canvasRef = ref(null)

const presets = {
  math: {
    title: '数学测试卷',
    content: '数学测试题：\n1. 3 + 5 = 8\n2. 12 × 4 = 48\n3. 25 ÷ 5 = 5\n4. 9 - 7 = 2\n5. 6 × 7 = 42'
  },
  chinese: {
    title: '语文测试卷',
    content: '语文测试题：\n1. 中国的首都是北京\n2. "春眠不觉晓"的下一句是"处处闻啼鸟"\n3. "苹果"的英文是apple\n4. 一年有12个月'
  },
  english: {
    title: '英语测试卷',
    content: '英语测试题：\n1. Hello的汉语意思是你好\n2. "book"是指书\n3. "water"是指水\n4. "cat"是指猫\n5. "sun"是指太阳'
  },
  mixed: {
    title: '综合测试卷',
    content: '综合测试题：\n1. 8 + 7 = 15\n2. 中国的首都是北京\n3. "apple"是指苹果\n4. 25 ÷ 5 = 5\n5. 一年有春夏秋冬四个季节'
  },
  choice: {
    title: '选择题测试卷',
    content: '选择题：\n1. 下列哪个是最大的数？\n   A. 5  B. 8  C. 3  D. 9\n   答案：D\n\n2. 下列哪个是最小的数？\n   A. 15  B. 12  C. 18  D. 20\n   答案：B'
  }
}

function loadPreset(type) {
  const p = presets[type]
  title.value = p.title
  content.value = p.content
  generatePaper()
}

function updateCanvasSize() {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = width.value
  canvas.height = height.value
}

function addDecorations(ctx, w, h, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.3
  for (let i = 0; i < w; i += 50) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, h)
    ctx.stroke()
  }
  for (let i = 0; i < h; i += 50) {
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(w, i)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function addHandwritingEffect(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 50) {
      const jitter = (Math.random() - 0.5) * 10
      data[i] = Math.max(0, data[i] + jitter)
      data[i + 1] = Math.max(0, data[i + 1] + jitter)
      data[i + 2] = Math.max(0, data[i + 2] + jitter)
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

function generatePaper() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bgColor.value
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = textColor.value
  ctx.font = `bold ${fontSize.value + 8}px KaiTi, STKaiti, serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(title.value, 50, 50)
  ctx.beginPath()
  ctx.moveTo(50, 50 + fontSize.value + 20)
  ctx.lineTo(canvas.width - 50, 50 + fontSize.value + 20)
  ctx.strokeStyle = textColor.value
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.font = `${fontSize.value}px KaiTi, STKaiti, serif`
  const lines = content.value.split('\n')
  let y = 50 + fontSize.value + 60
  const lineSpacing = fontSize.value * lineHeight.value
  lines.forEach(line => {
    const maxWidth = canvas.width - 100
    const words = line.split('')
    let currentLine = ''
    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine + words[i]
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && currentLine !== '') {
        ctx.fillText(currentLine, 50, y)
        y += lineSpacing
        currentLine = words[i]
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) {
      ctx.fillText(currentLine, 50, y)
      y += lineSpacing
    }
  })
  addDecorations(ctx, canvas.width, canvas.height, textColor.value)
  addHandwritingEffect(ctx, canvas.width, canvas.height)
}

function downloadImage() {
  const canvas = canvasRef.value
  if (!canvas) return
  const link = document.createElement('a')
  link.download = `${title.value}.png`
  link.href = canvas.toDataURL()
  link.click()
}

function clearCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

onMounted(() => {
  updateCanvasSize()
  generatePaper()
})
</script>

<template>
  <div class="container">
    <h1>试卷图片生成器</h1>
    <div class="instructions">
      <p>选择预设或自定义内容，生成并下载测试图片。</p>
    </div>
    <div class="preset-buttons">
      <button class="preset-btn" @click="loadPreset('math')">数学测试卷</button>
      <button class="preset-btn" @click="loadPreset('chinese')">语文测试卷</button>
      <button class="preset-btn" @click="loadPreset('english')">英语测试卷</button>
      <button class="preset-btn" @click="loadPreset('mixed')">综合测试卷</button>
      <button class="preset-btn" @click="loadPreset('choice')">选择题测试</button>
    </div>
    <div class="controls">
      <div class="control-group">
        <label>试卷标题</label>
        <input v-model="title" type="text" />
      </div>
      <div class="control-group">
        <label>题目内容</label>
        <textarea v-model="content" rows="8" />
      </div>
      <div class="control-group">
        <label>字体大小</label>
        <input type="range" min="20" max="40" v-model="fontSize" @input="generatePaper" />
        <span>{{ fontSize }}px</span>
      </div>
      <div class="control-group">
        <label>图片宽度</label>
        <input type="range" min="600" max="1200" v-model="width" @input="updateCanvasSize(); generatePaper()" />
        <span>{{ width }}px</span>
      </div>
      <div class="control-group">
        <label>图片高度</label>
        <input type="range" min="600" max="1200" v-model="height" @input="updateCanvasSize(); generatePaper()" />
        <span>{{ height }}px</span>
      </div>
      <div class="control-group">
        <label>字体颜色</label>
        <input type="color" v-model="textColor" @input="generatePaper" />
      </div>
      <div class="control-group">
        <label>背景颜色</label>
        <input type="color" v-model="bgColor" @input="generatePaper" />
      </div>
      <div class="control-group">
        <label>行间距</label>
        <input type="range" min="1.2" max="2.0" step="0.1" v-model="lineHeight" @input="generatePaper" />
        <span>{{ lineHeight }}</span>
      </div>
    </div>
    <div class="button-group">
      <button class="generate-btn" @click="generatePaper">生成试卷图片</button>
      <button class="download-btn" @click="downloadImage">下载图片</button>
      <button class="clear-btn" @click="clearCanvas">清除画布</button>
    </div>
    <div class="canvas-container">
      <canvas ref="canvasRef"></canvas>
    </div>
  </div>
</template>

<style scoped>
body { font-family: 'Microsoft YaHei', Arial, sans-serif }
.container { background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 1000px }
h1 { color: #333; text-align: center; margin-bottom: 20px }
.instructions { background: #e3f2fd; border-left: 4px solid #2196F3; padding: 12px; border-radius: 5px; margin-bottom: 15px }
.preset-buttons { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin: 10px 0 }
.preset-btn { background: #9C27B0; color: #fff; padding: 8px 15px; font-size: 12px; border: none; border-radius: 5px }
.controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px }
.control-group { display: flex; flex-direction: column }
label { font-weight: 600; margin-bottom: 6px; color: #555 }
input, select, textarea { padding: 8px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px }
.button-group { display: flex; gap: 10px; justify-content: center; margin: 15px 0 }
.generate-btn { background: #4CAF50; color: #fff; border: none; padding: 10px 20px; border-radius: 5px }
.download-btn { background: #2196F3; color: #fff; border: none; padding: 10px 20px; border-radius: 5px }
.clear-btn { background: #f44336; color: #fff; border: none; padding: 10px 20px; border-radius: 5px }
.canvas-container { text-align: center; margin: 10px 0; border: 2px dashed #ccc; border-radius: 10px; padding: 10px; background: #fafafa }
canvas { border: 1px solid #ddd; border-radius: 5px; background: #fff; max-width: 100% }
</style>