<script setup>
// 素材中心页面：左侧上传表单，右侧瀑布流商品列表
import { ref } from 'vue'
import UploadPanel from '../components/UploadPanel.vue'
import ProductList from '../components/ProductList.vue'

const listRef = ref()

// 上传成功后刷新列表
function reload() {
  listRef.value?.reload()
}
</script>

<template>
  <div class="asset-center">
    <el-row :gutter="20">
      <el-col :xs="24" :md="9" :lg="8">
        <UploadPanel @created="reload" />
      </el-col>
      <el-col :xs="24" :md="15" :lg="16">
        <ProductList ref="listRef" />
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.asset-center {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
