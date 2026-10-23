// 商品状态管理：集中维护素材列表与加载状态，供上传组件与列表组件共享
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchProducts } from '../api/product'

export const useProductStore = defineStore('product', () => {
  const list = ref([])
  const loading = ref(false)

  // 拉取最新的商品列表（当前素材中心一次展示 50 条）
  async function load() {
    loading.value = true
    try {
      const res = await fetchProducts({ page: 1, size: 50 })
      list.value = res.data.list
    } finally {
      loading.value = false
    }
  }

  return { list, loading, load }
})
