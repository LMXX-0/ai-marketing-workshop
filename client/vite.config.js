// Vite 构建配置：注册 Vue 插件并固定开发端口
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()], // 解析 .vue 单文件组件
  server: {
    port: 5173, // 与后端 CORS_ORIGIN 保持一致
  },
})
