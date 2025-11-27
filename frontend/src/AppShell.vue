<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">校园试卷自动判分系统</div>
      <nav class="nav">
        <!-- <RouterLink to="/workspace" class="nav-link">工作台</RouterLink>
        <RouterLink to="/generator" class="nav-link">试卷图片生成器</RouterLink>
        <RouterLink to="/test-ocr" class="nav-link">测试页</RouterLink> -->
      </nav>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped lang="scss">
// 应用壳：顶栏导航 + 内容区
.app-shell {
  min-height: 100vh; display: grid; grid-template-rows: auto 1fr; background: #f5f5f5;
  .topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background: linear-gradient(45deg, #4CAF50, #45a049); color: #fff;
    .brand { font-weight: 600 }
    .nav { display: flex; gap: 12px;
      .nav-link { color: #fff; text-decoration: none; padding: 8px 12px; border-radius: 6px;
        &.router-link-active { background: rgba(255,255,255,0.2) }
      }
    }
  }
  .content { width: 100%; margin: 0 auto }
}
@media (min-width: 2560px) { .app-shell { .content { width: 100% } } }
</style>