<template>
  <div class="error-book">
    <div class="book-header">
      <h4>📚 错题本</h4>
      <div class="book-controls">
        <button @click="exportErrors" class="export-btn">导出错题</button>
        <button @click="clearErrors" class="clear-btn">清空</button>
      </div>
    </div>
    
    <div v-if="errors.length === 0" class="empty-state">
      <p>暂无错题记录</p>
      <p class="hint">批改试卷后，错误的题目将自动添加到此处</p>
    </div>
    
    <div v-else class="error-list">
      <div v-for="(error, index) in errors" :key="index" class="error-item">
        <div class="error-header">
          <span class="error-index">错题 {{ index + 1 }}</span>
          <span class="error-date">{{ formatDate(error.date) }}</span>
        </div>
        
        <div class="error-content">
          <div class="question-section">
            <span class="label">题目：</span>
            <span class="question">{{ error.question }}</span>
          </div>
          
          <div class="answer-section">
            <div class="student-answer">
              <span class="label">学生答案：</span>
              <span class="wrong-answer">{{ error.studentAnswer }}</span>
            </div>
            
            <div class="correct-answer">
              <span class="label">正确答案：</span>
              <span class="right-answer">{{ error.correctAnswer }}</span>
            </div>
          </div>
          
          <div class="analysis-section" v-if="error.analysis">
            <span class="label">解析：</span>
            <span class="analysis-text">{{ error.analysis }}</span>
          </div>
        </div>
        
        <div class="error-actions">
          <button @click="removeError(index)" class="remove-btn">删除</button>
          <button @click="addAnalysis(index)" class="analysis-btn">添加解析</button>
        </div>
      </div>
    </div>
    
    <!-- 添加解析对话框 -->
    <div v-if="showAnalysisDialog" class="dialog-overlay" @click="closeAnalysisDialog">
      <div class="dialog-content" @click.stop>
        <h5>添加错题解析</h5>
        <textarea v-model="currentAnalysis" placeholder="请输入这道题的解析或备注..."></textarea>
        <div class="dialog-actions">
          <button @click="saveAnalysis" class="save-btn">保存</button>
          <button @click="closeAnalysisDialog" class="cancel-btn">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'

const props = defineProps({
  modelValue: Array
})

const emit = defineEmits(['update:modelValue'])

const errors = ref(props.modelValue || [])
const showAnalysisDialog = ref(false)
const currentAnalysis = ref('')
const currentErrorIndex = ref(-1)

watch(errors, () => {
  emit('update:modelValue', errors.value)
  saveToLocalStorage()
}, { deep: true })

// 从本地存储加载错题
function loadFromLocalStorage() {
  const saved = localStorage.getItem('errorBook')
  if (saved) {
    errors.value = JSON.parse(saved)
  }
}

// 保存到本地存储
function saveToLocalStorage() {
  localStorage.setItem('errorBook', JSON.stringify(errors.value))
}

// 添加错题
function addError(question, studentAnswer, correctAnswer) {
  const error = {
    id: Date.now(),
    date: new Date().toISOString(),
    question: question,
    studentAnswer: studentAnswer,
    correctAnswer: correctAnswer,
    analysis: ''
  }
  errors.value.unshift(error) // 添加到开头
}

// 删除错题
function removeError(index) {
  errors.value.splice(index, 1)
}

// 清空所有错题
function clearErrors() {
  if (confirm('确定要清空所有错题吗？')) {
    errors.value = []
  }
}

// 添加解析
function addAnalysis(index) {
  currentErrorIndex.value = index
  currentAnalysis.value = errors.value[index].analysis || ''
  showAnalysisDialog.value = true
}

// 保存解析
function saveAnalysis() {
  if (currentErrorIndex.value >= 0) {
    errors.value[currentErrorIndex.value].analysis = currentAnalysis.value
  }
  closeAnalysisDialog()
}

// 关闭解析对话框
function closeAnalysisDialog() {
  showAnalysisDialog.value = false
  currentAnalysis.value = ''
  currentErrorIndex.value = -1
}

// 导出错题
function exportErrors() {
  if (errors.value.length === 0) {
    alert('暂无错题可导出')
    return
  }
  
  const content = errors.value.map((error, index) => {
    return `错题 ${index + 1}
日期：${formatDate(error.date)}
题目：${error.question}
学生答案：${error.studentAnswer}
正确答案：${error.correctAnswer}
${error.analysis ? '解析：' + error.analysis : ''}
${'-'.repeat(50)}
`
  }).join('\n')
  
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `错题本_${new Date().toLocaleDateString()}.txt`
  link.click()
  URL.revokeObjectURL(url)
}

// 格式化日期
function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

// 暴露方法给父组件
defineExpose({
  addError,
  clearErrors
})

// 初始化时加载本地存储的错题
loadFromLocalStorage()
</script>

<style scoped lang="scss">
// 错题本组件
.error-book { background: #fff; border-radius: 10px; padding: 20px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  .book-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
    h4 { color: #333; margin: 0 }
    .book-controls { display: flex; gap: 10px;
      .export-btn { background: #4CAF50; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; &:hover { background: #45a049 } }
      .clear-btn { background: #f44336; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; &:hover { background: #d32f2f } }
    }
  }
  .empty-state { text-align: center; padding: 40px; color: #666; .hint { font-size: 14px; margin-top: 10px; color: #999 } }
  .error-list { display: flex; flex-direction: column; gap: 15px;
    .error-item { border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fafafa;
      .error-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
        .error-index { font-weight: 600; color: #333 }
        .error-date { font-size: 12px; color: #666 }
      }
      .error-content { margin-bottom: 10px;
        .question-section, .answer-section, .analysis-section { margin-bottom: 8px }
        .label { font-weight: 500; color: #555; margin-right: 8px }
        .question { color: #333 }
        .wrong-answer { color: #f44336; text-decoration: line-through }
        .right-answer { color: #4CAF50; font-weight: 500 }
        .analysis-text { color: #666; font-size: 14px; line-height: 1.5 }
      }
      .error-actions { display: flex; gap: 10px;
        .remove-btn { background: #f44336; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; &:hover { background: #d32f2f } }
        .analysis-btn { background: #2196F3; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; &:hover { background: #1976D2 } }
      }
    }
  }
  // 对话框
  .dialog-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000 }
  .dialog-content { background: #fff; border-radius: 8px; padding: 20px; width: 90%; max-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    h5 { margin-bottom: 15px; color: #333 }
    textarea { width: 100%; min-height: 100px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; resize: vertical; font-family: inherit; font-size: 14px }
    .dialog-actions { margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;
      .save-btn { background: #4CAF50; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; &:hover { background: #45a049 } }
      .cancel-btn { background: #9e9e9e; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; &:hover { background: #757575 } }
    }
  }
}
</style>