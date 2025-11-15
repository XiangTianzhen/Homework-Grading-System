<template>
  <div class="history-panel">
    <div class="panel-header">
      <h4>📚 历史记录</h4>
      <div class="panel-controls">
        <input 
          v-model="searchTerm" 
          placeholder="搜索文件名或日期"
          class="search-input"
        />
        <button @click="clearHistory" class="clear-btn">清空历史</button>
      </div>
    </div>
    
    <div v-if="filteredHistory.length === 0" class="empty-state">
      <p>暂无历史记录</p>
      <p class="hint">批改过的试卷将自动保存到此处</p>
    </div>
    
    <div v-else class="history-list">
      <div 
        v-for="item in filteredHistory" 
        :key="item.id"
        class="history-item"
        :class="{ selected: selectedId === item.id }"
        @click="selectItem(item)"
      >
        <div class="item-header">
          <span class="file-name">{{ item.fileName }}</span>
          <span class="score" :class="scoreClass(item.score, item.totalScore)">
            {{ item.score }}/{{ item.totalScore }}
          </span>
        </div>
        
        <div class="item-details">
          <span class="date">{{ formatDate(item.date) }}</span>
          <span class="accuracy">正确率: {{ item.accuracy }}%</span>
        </div>
        
        <div class="item-preview" v-if="item.previewImage">
          <img :src="item.previewImage" alt="预览" />
        </div>
        
        <div class="item-actions">
          <button @click.stop="viewDetails(item)" class="view-btn">查看详情</button>
          <button @click.stop="regrade(item)" class="regrade-btn">重新批改</button>
          <button @click.stop="deleteItem(item.id)" class="delete-btn">删除</button>
        </div>
      </div>
    </div>
    
    <!-- 详情对话框 -->
    <div v-if="showDetails" class="dialog-overlay" @click="closeDetails">
      <div class="dialog-content" @click.stop>
        <div class="dialog-header">
          <h5>试卷详情</h5>
          <button @click="closeDetails" class="close-btn">×</button>
        </div>
        
        <div class="dialog-body" v-if="selectedItem">
          <div class="detail-section">
            <h6>基本信息</h6>
            <p>文件名: {{ selectedItem.fileName }}</p>
            <p>批改时间: {{ formatDate(selectedItem.date) }}</p>
            <p>得分: {{ selectedItem.score }}/{{ selectedItem.totalScore }}</p>
            <p>正确率: {{ selectedItem.accuracy }}%</p>
          </div>
          
          <div class="detail-section" v-if="selectedItem.answers && selectedItem.answers.length">
            <h6>答题情况</h6>
            <div v-for="(answer, index) in selectedItem.answers" :key="index" class="answer-item">
              <span>第{{ index + 1 }}题:</span>
              <span :class="{ correct: answer.isCorrect, wrong: !answer.isCorrect }">
                {{ answer.studentAnswer }} 
                <template v-if="!answer.isCorrect">
                  → {{ answer.correctAnswer }}
                </template>
              </span>
            </div>
          </div>
          
          <div class="detail-image" v-if="selectedItem.previewImage">
            <h6>试卷图片</h6>
            <img :src="selectedItem.previewImage" alt="试卷预览" />
          </div>
        </div>
        
        <div class="dialog-actions">
          <button @click="exportThisItem" class="export-btn">导出结果</button>
          <button @click="closeDetails" class="close-btn">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue'

const props = defineProps({
  modelValue: Array
})

const emit = defineEmits(['update:modelValue', 'regrade'])

const history = ref(props.modelValue || [])
const searchTerm = ref('')
const selectedId = ref(null)
const showDetails = ref(false)
const selectedItem = ref(null)

// 计算属性：过滤后的历史记录
const filteredHistory = computed(() => {
  if (!searchTerm.value) return history.value
  
  const term = searchTerm.value.toLowerCase()
  return history.value.filter(item => 
    item.fileName.toLowerCase().includes(term) ||
    formatDate(item.date).toLowerCase().includes(term)
  )
})

// 监听历史记录变化
watch(history, () => {
  emit('update:modelValue', history.value)
  saveToLocalStorage()
}, { deep: true })

// 本地存储相关
function saveToLocalStorage() {
  localStorage.setItem('gradingHistory', JSON.stringify(history.value))
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('gradingHistory')
  if (saved) {
    history.value = JSON.parse(saved)
  }
}

// 添加历史记录
function addHistory(item) {
  const historyItem = {
    id: Date.now(),
    fileName: item.fileName,
    date: new Date().toISOString(),
    score: item.score,
    totalScore: item.totalScore,
    accuracy: item.accuracy,
    previewImage: item.previewImage,
    answers: item.answers || []
  }
  history.value.unshift(historyItem) // 添加到开头
}

// 删除历史记录
function deleteItem(id) {
  if (confirm('确定要删除这条历史记录吗？')) {
    history.value = history.value.filter(item => item.id !== id)
  }
}

// 选择项目
function selectItem(item) {
  selectedId.value = item.id
}

// 查看详情
function viewDetails(item) {
  selectedItem.value = item
  showDetails.value = true
}

// 关闭详情
function closeDetails() {
  showDetails.value = false
  selectedItem.value = null
}

// 重新批改
function regrade(item) {
  emit('regrade', item)
}

// 导出单项
function exportThisItem() {
  if (!selectedItem.value) return
  
  const content = `试卷批改报告
================
文件名: ${selectedItem.value.fileName}
批改时间: ${formatDate(selectedItem.value.date)}
得分: ${selectedItem.value.score}/${selectedItem.value.totalScore}
正确率: ${selectedItem.value.accuracy}%

答题详情:
${selectedItem.value.answers.map((ans, i) => 
  `第${i+1}题: ${ans.studentAnswer} ${ans.isCorrect ? '✓' : '✗'} ${!ans.isCorrect ? '正确答案: ' + ans.correctAnswer : ''}`
).join('\n')}
`
  
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `批改报告_${selectedItem.value.fileName.replace(/\.[^/.]+$/, '')}.txt`
  link.click()
  URL.revokeObjectURL(url)
}

// 清空历史
function clearHistory() {
  if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
    history.value = []
  }
}

// 分数样式类
function scoreClass(score, total) {
  const percentage = (score / total) * 100
  if (percentage >= 90) return 'excellent'
  if (percentage >= 80) return 'good'
  if (percentage >= 60) return 'pass'
  return 'fail'
}

// 格式化日期
function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 暴露方法给父组件
defineExpose({
  addHistory
})

// 初始化时加载本地存储的历史记录
loadFromLocalStorage()
</script>

<style scoped>
.history-panel {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.panel-header h4 {
  color: #333;
  margin: 0;
}

.panel-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.search-input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  min-width: 200px;
}

.search-input:focus {
  outline: none;
  border-color: #4CAF50;
}

.clear-btn {
  background: #f44336;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.clear-btn:hover {
  background: #d32f2f;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.empty-state .hint {
  font-size: 14px;
  margin-top: 10px;
  color: #999;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: 500px;
  overflow-y: auto;
}

.history-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.3s ease;
}

.history-item:hover {
  background: #f5f5f5;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.history-item.selected {
  border-color: #4CAF50;
  background: #e8f5e8;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.file-name {
  font-weight: 500;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score {
  font-weight: bold;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
}

.score.excellent {
  background: #e8f5e8;
  color: #2e7d32;
}

.score.good {
  background: #e3f2fd;
  color: #1976d2;
}

.score.pass {
  background: #fff3e0;
  color: #f57c00;
}

.score.fail {
  background: #ffebee;
  color: #d32f2f;
}

.item-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 14px;
  color: #666;
}

.item-preview {
  margin: 10px 0;
  text-align: center;
}

.item-preview img {
  max-width: 100px;
  max-height: 100px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.item-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.view-btn, .regrade-btn, .delete-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s ease;
}

.view-btn {
  background: #2196F3;
  color: white;
}

.view-btn:hover {
  background: #1976D2;
}

.regrade-btn {
  background: #FF9800;
  color: white;
}

.regrade-btn:hover {
  background: #F57C00;
}

.delete-btn {
  background: #f44336;
  color: white;
}

.delete-btn:hover {
  background: #d32f2f;
}

/* 详情对话框样式 */
.dialog-overlay {
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

.dialog-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-header h5 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.close-btn:hover {
  color: #333;
}

.dialog-body {
  padding: 20px;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h6 {
  color: #333;
  margin-bottom: 10px;
  font-size: 16px;
}

.detail-section p {
  margin: 5px 0;
  color: #555;
}

.answer-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.answer-item:last-child {
  border-bottom: none;
}

.answer-item .correct {
  color: #4CAF50;
}

.answer-item .wrong {
  color: #f44336;
}

.detail-image {
  text-align: center;
}

.detail-image img {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 20px;
  border-top: 1px solid #e0e0e0;
}

.export-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
}

.export-btn:hover {
  background: #45a049;
}

.dialog-actions .close-btn {
  background: #9e9e9e;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
}

.dialog-actions .close-btn:hover {
  background: #757575;
}
</style>