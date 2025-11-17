import { createApp } from 'vue'
import router from './router/index.js'
import './styles/base.scss'
import AppShell from './AppShell.vue'

createApp(AppShell).use(router).mount('#app')
