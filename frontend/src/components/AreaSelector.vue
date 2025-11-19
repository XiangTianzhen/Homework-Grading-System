<template>
  <div class="area-selector" v-if="imageSrc">
    <div class="selector-header">
      <h4>框选题目区域</h4>
      <p>在图片上拖拽框选每道题目的答题区域</p>
    </div>
    
    <div class="image-container" ref="imageContainer">
      <img 
        ref="imageElement"
        :src="imageSrc" 
        alt="试卷图片"
        @mousedown="startSelection"
        @mousemove="updateSelection"
        @mouseup="endSelection"
        @dragstart.prevent
      />
      
      <!-- 已框选的区域 -->
      <div 
        v-for="(area, index) in areas" 
        :key="index"
        class="selected-area"
        :style="areaStyle(area)"
      >
        <span class="area-label">{{ index + 1 }}</span>
        <button 
          class="remove-area"
          @click="removeArea(index)"
          title="删除此区域"
        >×</button>
      </div>
      
      <!-- 正在框选的区域 -->
      <div 
        v-if="isSelecting && currentArea"
        class="selecting-area"
        :style="currentAreaStyle()"
      ></div>
    </div>
    
    <div class="selector-controls">
      <button @click="clearAll" class="clear-btn">清除所有</button>
      <span class="area-count">已选择 {{ areas.length }} 个区域</span>
      <div class="action-buttons">
        <button @click="$emit('close')" class="cancel-btn">取消</button>
        <button @click="saveAreas" class="save-btn">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  imageSrc: String,
  modelValue: Array,
  single: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'areas-selected', 'close'])

const areas = ref(props.modelValue || [])
const isSelecting = ref(false)
const currentArea = ref(null)
const imageContainer = ref(null)
const imageElement = ref(null)
const scaleX = ref(1)
const scaleY = ref(1)

watch(areas, () => {
  emit('update:modelValue', areas.value)
}, { deep: true })

watch(() => props.modelValue, (newVal) => {
  areas.value = newVal || []
})

// 获取鼠标在图片上的相对坐标
function getMousePosition(e) {
  const rect = imageElement.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / (scaleX.value || 1)
  const y = (e.clientY - rect.top) / (scaleY.value || 1)
  return { x, y }
}

function areaStyle(a) {
  return {
    left: (a.x * scaleX.value) + 'px',
    top: (a.y * scaleY.value) + 'px',
    width: (a.width * scaleX.value) + 'px',
    height: (a.height * scaleY.value) + 'px'
  }
}

function currentAreaStyle() {
  const a = currentArea.value
  if (!a) return {}
  return {
    left: (a.x * scaleX.value) + 'px',
    top: (a.y * scaleY.value) + 'px',
    width: (a.width * scaleX.value) + 'px',
    height: (a.height * scaleY.value) + 'px'
  }
}

function startSelection(e) {
  if (e.target !== imageElement.value) return
  
  calculateScale()
  isSelecting.value = true
  const pos = getMousePosition(e)
  currentArea.value = {
    x: pos.x,
    y: pos.y,
    width: 0,
    height: 0
  }
}

function updateSelection(e) {
  if (!isSelecting.value || !currentArea.value) return
  
  const pos = getMousePosition(e)
  currentArea.value.width = pos.x - currentArea.value.x
  currentArea.value.height = pos.y - currentArea.value.y
}

function endSelection(e) {
  if (!isSelecting.value || !currentArea.value) return
  
  isSelecting.value = false
  
  // 过滤掉太小或负尺寸的区域
  const area = currentArea.value
  if (Math.abs(area.width) < 20 || Math.abs(area.height) < 20) {
    currentArea.value = null
    return
  }
  
  // 标准化坐标（确保宽高为正）
  const normalizedArea = {
    x: area.width < 0 ? area.x + area.width : area.x,
    y: area.height < 0 ? area.y + area.height : area.y,
    width: Math.abs(area.width),
    height: Math.abs(area.height)
  }
  
  if (props.single) {
    areas.value = [normalizedArea]
  } else {
    areas.value.push(normalizedArea)
  }
  currentArea.value = null
}

function removeArea(index) {
  areas.value.splice(index, 1)
}

function clearAll() {
  areas.value = []
}

function saveAreas() {
  emit('areas-selected', areas.value)
}

// 计算图片缩放比例
function calculateScale() {
  nextTick(() => {
    if (imageElement.value) {
      const rect = imageElement.value.getBoundingClientRect()
      const imgW = imageElement.value.naturalWidth || 1
      const imgH = imageElement.value.naturalHeight || 1
      scaleX.value = (rect.width || 0) / imgW || 1
      scaleY.value = (rect.height || 0) / imgH || 1
    }
  })
}

watch(() => props.imageSrc, () => {
  if (props.imageSrc) {
    nextTick(() => {
      if (imageElement.value) {
        imageElement.value.onload = calculateScale
      }
      calculateScale()
    })
  }
})

// 监听窗口大小变化
if (typeof window !== 'undefined') {
  window.addEventListener('resize', calculateScale)
}

let ro
onMounted(() => {
  nextTick(() => {
    if (typeof ResizeObserver !== 'undefined' && imageElement.value) {
      ro = new ResizeObserver(() => calculateScale())
      ro.observe(imageElement.value)
    }
  })
})

onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  if (typeof window !== 'undefined') window.removeEventListener('resize', calculateScale)
})
</script>

<style scoped lang="scss">
// 区域框选组件
.area-selector {
  margin-top: 20px; background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  .selector-header { margin-bottom: 15px;
    h4 { color: #333; margin-bottom: 5px }
    p { color: #666; font-size: 14px }
  }
  .image-container { position: relative; display: inline-block; max-width: 100%; border: 2px solid #e0e0e0; border-radius: 8px; overflow: hidden;
    img { max-width: 100%; height: auto; display: block; cursor: crosshair }
    .selected-area { position: absolute; border: 2px solid #4CAF50; background: rgba(76,175,80,0.1); pointer-events: none;
      .area-label { position: absolute; top: -25px; left: 0; background: #4CAF50; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold }
      .remove-area { position: absolute; top: -10px; right: -10px; background: #f44336; color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 14px; cursor: pointer; pointer-events: auto; display: flex; align-items: center; justify-content: center;
        &:hover { background: #d32f2f }
      }
    }
    .selecting-area { position: absolute; border: 2px dashed #2196F3; background: rgba(33,150,243,0.1); pointer-events: none }
  }
  .selector-controls { margin-top: 15px; display: flex; justify-content: space-between; align-items: center;
    .clear-btn { background: #f44336; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;
      &:hover { background: #d32f2f }
    }
    .area-count { color: #666; font-size: 14px }
    .action-buttons { display: flex; gap: 10px;
      .cancel-btn { background: #9e9e9e; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; &:hover { background: #757575 } }
      .save-btn { background: #4CAF50; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; &:hover { background: #45a049 } }
    }
  }
}
</style>