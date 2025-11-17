import { createApp } from 'vue'
import router from './router/index.js'
import './styles/base.scss'
import AppShell from './AppShell.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

createApp(AppShell).use(router).use(ElementPlus).mount('#app')
