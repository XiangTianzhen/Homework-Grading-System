<template>
  <div class="result-card">
    <div class="header-row">
      <span>第{{ index + 1 }}题</span>
      <span :class="statusClass">{{ statusText }}</span>
    </div>
    <div class="row">
      <span>学生答案：</span>
      <span>{{ student }}</span>
    </div>
    <div class="row">
      <span>标准答案：</span>
      <span>{{ standard }}</span>
    </div>
    <div class="row">
      <span>得分：</span>
      <span :class="scoreClass">{{ score }}</span>
    </div>
    <div v-if="score < maxScore" class="error-book-row">
      <button class="add-to-error-book" @click="addToErrorBook">添加到错题本</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ index: Number, student: String, standard: String, score: Number, maxScore: Number })
const emit = defineEmits(['add-to-error-book'])

const statusClass = computed(() => (props.score === props.maxScore ? 'correct' : 'wrong'))
const statusText = computed(() => (props.score === props.maxScore ? '✅ 正确' : '❌ 错误'))
const scoreClass = computed(() => (props.score === props.maxScore ? 'correct' : 'wrong'))

function addToErrorBook() {
  const question = `第${props.index + 1}题`
  emit('add-to-error-book', question, props.student, props.standard)
}
</script>

<style scoped lang="scss">
// 单题结果卡片
.result-card { background: #fff; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; box-shadow: 0 2px 6px rgba(0,0,0,.05);
  .header-row { display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 8px }
  .row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 14px }
  .correct { color: #4CAF50 }
  .wrong { color: #f44336 }
  .error-book-row { margin-top: 8px; text-align: right;
    .add-to-error-book { background: #ff9800; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer }
  }
}
</style>