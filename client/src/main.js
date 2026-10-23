// 前端入口：创建 Vue 应用并注册状态管理、路由与 UI 组件库
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'

createApp(App)
  .use(createPinia()) // 状态管理
  .use(router) // 页面路由
  .use(ElementPlus) // Element Plus 组件库
  .mount('#app')
