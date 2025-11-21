<template>
  <div class="batch-upload">
    <h4>批量上传试卷</h4>
    <div 
      class="drop-zone"
      @drop="handleDrop"
      @dragover.prevent
      @dragenter="dragEnter"
      @dragleave="dragLeave"
      :class="{ active: isDragOver }"
    >
      <div v-if="files.length === 0" class="empty-state">
        <p>📁 拖拽多张图片到此处</p>
        <p>或</p>
        <button @click="selectFiles" class="select-btn">选择多张图片</button>
      </div>
      
      <div v-else class="file-list">
        <div v-for="(file, index) in files" :key="index" class="file-item">
          <img :src="file.preview" alt="预览" class="preview-img" />
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatSize(file.size) }}</span>
          </div>
          <button @click="removeFile(index)" class="remove-btn">×</button>
        </div>
      </div>
    </div>
    
    <div class="batch-controls" v-if="files.length > 0">
      <button @click="uploadAll" :disabled="uploading" class="upload-btn">
        {{ uploading ? '上传中...' : '批量上传' }}
      </button>
      <button @click="clearAll" class="clear-btn">清空</button>
    </div>
    
    <div class="upload-results" v-if="results.length > 0">
      <h5>上传结果</h5>
      <div v-for="(result, index) in results" :key="index" class="result-item" :class="result.status">
        <span class="result-name">{{ result.name }}</span>
        <span class="result-status">{{ result.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { batchProcess } from '../api'

const emit = defineEmits(['batch-complete'])

const files = ref([])
const isDragOver = ref(false)
const uploading = ref(false)
const results = ref([])

function formatSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function dragEnter() {
  isDragOver.value = true
}

function dragLeave() {
  isDragOver.value = false
}

function handleDrop(e) {
  e.preventDefault()
  isDragOver.value = false
  
  const droppedFiles = Array.from(e.dataTransfer.files)
  addFiles(droppedFiles)
}

function selectFiles() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = 'image/*'
  input.onchange = (e) => {
    const selectedFiles = Array.from(e.target.files)
    addFiles(selectedFiles)
  }
  input.click()
}

function addFiles(newFiles) {
  const imageFiles = newFiles.filter(file => file.type.startsWith('image/'))
  
  imageFiles.forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => {
      files.value.push({
        file: file,
        name: file.name,
        size: file.size,
        preview: e.target.result
      })
    }
    reader.readAsDataURL(file)
  })
}

function removeFile(index) {
  files.value.splice(index, 1)
}

function clearAll() {
  files.value = []
  results.value = []
}

async function uploadAll() {
  if (files.value.length === 0) return
  
  uploading.value = true
  results.value = []
  
  try {
    const fileArray = files.value.map(f => f.file)
    const response = await batchProcess(fileArray)
    const previewMap = Object.fromEntries(files.value.map(f => [f.name, f.preview]))

    results.value = response.data.results.map(result => ({
      name: result.originalname,
      filename: result.filename,
      preview: previewMap[result.originalname] || '',
      status: result.success ? 'success' : 'error',
      message: result.success ? '处理成功' : result.error,
      data: result
    }))

    emit('batch-complete', results.value)
  } catch (error) {
    results.value = files.value.map(file => ({
      name: file.name,
      status: 'error',
      message: error.response?.data?.error || '批量处理失败'
    }))
  }
  
  uploading.value = false
}
</script>

<style scoped lang="scss">
// 批量上传组件
.batch-upload {
  background: #fff; border-radius: 10px; padding: 20px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  h4 { margin-bottom: 15px; color: #333 }
  .drop-zone { border: 2px dashed #ccc; border-radius: 8px; padding: 30px; text-align: center; transition: all .3s; min-height: 200px; display: flex; flex-direction: column; justify-content: center;
    &.active { border-color: #4CAF50; background: #f8f9fa }
    .empty-state { p { margin: 10px 0; color: #666 } }
    .select-btn { background: #4CAF50; color: #fff; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px; &:hover { background: #45a049 } }
    .file-list { display: flex; flex-direction: column; gap: 10px;
      .file-item { display: flex; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 5px; position: relative;
        .preview-img { width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 10px }
        .file-info { flex: 1; display: flex; flex-direction: column;
          .file-name { font-size: 14px; color: #333; margin-bottom: 2px }
          .file-size { font-size: 12px; color: #666 }
        }
        .remove-btn { position: absolute; top: 5px; right: 5px; background: #f44336; color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; &:hover { background: #d32f2f } }
      }
    }
  }
  .batch-controls { margin-top: 15px; display: flex; gap: 10px; justify-content: center;
    .upload-btn { background: #2196F3; color: #fff; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px; &:hover:not(:disabled) { background: #1976D2 } &:disabled { background: #ccc; cursor: not-allowed } }
    .clear-btn { background: #f44336; color: #fff; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px; &:hover { background: #d32f2f } }
  }
  .upload-results { margin-top: 20px;
    h5 { margin-bottom: 10px; color: #333 }
    .result-item { display: flex; justify-content: space-between; padding: 8px 12px; border-radius: 4px; margin-bottom: 5px; font-size: 14px;
      &.success { background: #e8f5e8; color: #2e7d32 }
      &.error { background: #ffebee; color: #c62828 }
      .result-name { font-weight: 500 }
      .result-status { font-size: 12px }
    }
  }
}
</style>
