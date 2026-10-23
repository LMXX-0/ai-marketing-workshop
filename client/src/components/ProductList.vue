<script setup>
// 商品瀑布流列表：多列布局展示首图、名称、品类与受众
import { onMounted } from 'vue'
import { useProductStore } from '../stores/product'

const store = useProductStore()
// 图片是后端相对路径，开发环境需拼接后端地址才能加载
const base = import.meta.env.VITE_API_BASE ?? ''
const imgUrl = (p) => base + p

// 暴露 reload 供父组件在上传成功后刷新
defineExpose({ reload: () => store.load() })
onMounted(() => store.load())
</script>

<template>
  <div v-loading="store.loading" class="product-panel">
    <el-empty
      v-if="!store.loading && !store.list.length"
      description="还没有商品，先上传一个吧"
    />
    <div v-else class="waterfall">
      <el-card
        v-for="p in store.list"
        :key="p._id"
        shadow="hover"
        class="item"
        :body-style="{ padding: 0 }"
      >
        <el-image
          :src="imgUrl(p.images[0])"
          :preview-src-list="p.images.map(imgUrl)"
          fit="cover"
          class="cover"
          lazy
        />
        <div class="info">
          <h4>{{ p.name }}</h4>
          <div class="tags">
            <el-tag v-if="p.category" size="small">{{ p.category }}</el-tag>
            <el-tag v-if="p.audience" size="small" type="success">{{ p.audience }}</el-tag>
          </div>
          <div class="time">{{ new Date(p.createdAt).toLocaleString() }}</div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.product-panel {
  min-height: 200px;
}
.waterfall {
  column-count: 3;
  column-gap: 16px;
}
.item {
  break-inside: avoid;
  margin-bottom: 16px;
}
.cover {
  width: 100%;
  display: block;
}
.info {
  padding: 12px;
}
.info h4 {
  margin: 0 0 8px;
}
.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.time {
  margin-top: 8px;
  color: #999;
  font-size: 12px;
}
@media (max-width: 900px) {
  .waterfall {
    column-count: 2;
  }
}
@media (max-width: 560px) {
  .waterfall {
    column-count: 1;
  }
}
</style>
