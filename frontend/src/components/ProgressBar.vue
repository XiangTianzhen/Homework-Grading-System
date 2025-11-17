<template>
  <div class="progress-bar">
    <div class="bar" :style="{ width: percent + '%' }"></div>
    <span class="label">{{ label }}</span>
  </div>
</template>

<script setup>
defineProps({ percent: Number, label: String })
</script>

<style scoped lang="scss">
// 进度条样式
.progress-bar { position: relative; width: 100%; height: 24px; background: #e0e0e0; border-radius: 12px; overflow: hidden; margin: 10px 0;
  .bar { height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); transition: width .3s }
  .label { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 12px; color: #333; font-weight: 600 }
}
</style>