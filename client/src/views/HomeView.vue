<script setup>
// 首页：页面加载时调用后端健康检查接口，展示前后端连通状态
import { ref, onMounted } from 'vue'
import { getHealth } from '../api/health'

// 连接状态文案，随请求结果更新
const status = ref('检测中...')

// 组件挂载后立即请求 /api/health
onMounted(async () => {
  try {
    const res = await getHealth()
    console.log('[health] 后端响应：', res)
    status.value = '后端连接成功：' + res.data.time
  } catch (e) {
    console.error('[health] 请求失败：', e.message)
    status.value = '后端连接失败：' + e.message
  }
})
</script>

<template>
  <!-- 联调结果卡片：成功为绿色标签，其他状态为灰色 -->
  <el-card style="max-width: 560px; margin: 60px auto">
    <h2>AI 出海营销工坊</h2>
    <el-tag :type="status.includes('成功') ? 'success' : 'info'">{{ status }}</el-tag>
  </el-card>
</template>
