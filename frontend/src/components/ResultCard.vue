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
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ index: Number, student: String, standard: String, score: Number, maxScore: Number })
const statusClass = computed(() => (props.score === props.maxScore ? 'correct' : 'wrong'))
const statusText = computed(() => (props.score === props.maxScore ? '✅ 正确' : '❌ 错误'))
const scoreClass = computed(() => (props.score === props.maxScore ? 'correct' : 'wrong'))
</script>

<style scoped>
.result-card { background: #fff; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; box-shadow: 0 2px 6px rgba(0,0,0,.05) }
.header-row { display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 8px }
.row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 14px }
.correct { color: #4CAF50 }
.wrong { color: #f44336 }
</style>