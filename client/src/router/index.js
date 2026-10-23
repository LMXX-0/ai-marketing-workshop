// 路由配置：使用 History 模式管理页面路径
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  // 默认进入素材中心，上传与浏览商品图
  { path: '/', redirect: '/assets' },
  {
    path: '/assets',
    name: 'asset-center',
    component: () => import('../views/AssetCenterView.vue'),
  },
  // 前后端连通性检测页（作业 2 的联调页）
  { path: '/health', name: 'health', component: () => import('../views/HomeView.vue') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
