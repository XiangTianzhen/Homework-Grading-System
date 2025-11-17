import { createRouter, createWebHistory } from 'vue-router'
import WorkspaceView from '../views/WorkspaceView.vue'
import GeneratorView from '../views/GeneratorView.vue'
import OCRTestView from '../views/OCRTestView.vue'

const routes = [
  { path: '/', redirect: '/workspace' },
  { path: '/workspace', name: 'workspace', component: WorkspaceView },
  { path: '/generator', name: 'generator', component: GeneratorView },
  { path: '/test-ocr', name: 'test-ocr', component: OCRTestView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router