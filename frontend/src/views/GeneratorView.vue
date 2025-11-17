<script setup>
import TestImageGenerator from '../components/TestImageGenerator.vue'
</script>

<template>
  <div class="generator-page">
    <div class="header">
      <h2>试卷图片生成器</h2>
      <p>按示例试卷版式生成测试图片，支持导出识别区域。</p>
    </div>
    <TestImageGenerator />
  </div>
</template>

<style scoped lang="scss">
.generator-page {
  padding: 24px;
  .header {
    margin-bottom: 12px;
    h2 { font-size: clamp(1.4rem, 1.2vw, 2rem); }
    p { color: #666; }
  }
}
</style>