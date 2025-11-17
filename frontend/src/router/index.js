import { createRouter, createWebHistory } from 'vue-router'
import WorkspaceView from '../views/WorkspaceView.vue'
import GeneratorView from '../views/GeneratorView.vue'

const routes = [
  { path: '/', redirect: '/workspace' },
  { path: '/workspace', name: 'workspace', component: WorkspaceView },
  { path: '/generator', name: 'generator', component: GeneratorView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router