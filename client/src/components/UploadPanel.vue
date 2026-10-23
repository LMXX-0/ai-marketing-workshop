<script setup>
// 上传面板：商品信息表单 + 拖拽多图选择，提交时合并为一个 FormData 请求
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createProduct } from '../api/product'

// 上传成功后通知父组件刷新列表
const emit = defineEmits(['created'])

const form = reactive({ name: '', audience: '', category: '' })
const fileList = ref([])
const submitting = ref(false)

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 5

// 前端校验只用于即时提示，真正的安全兜底在后端 multer
function beforeAdd(rawFile) {
  if (!ALLOWED.includes(rawFile.type)) {
    ElMessage.error('仅支持 JPG / PNG / WebP 图片')
    return false
  }
  if (rawFile.size > MAX_MB * 1024 * 1024) {
    ElMessage.error(`单张图片不能超过 ${MAX_MB}MB`)
    return false
  }
  return true
}

// 选中文件时逐个校验，不合格的文件从列表中移除
function onChange(file, files) {
  if (!file.raw || !beforeAdd(file.raw)) {
    fileList.value = files.filter((f) => f.uid !== file.uid)
  } else {
    fileList.value = files
  }
}

function onExceed() {
  ElMessage.warning('最多上传 5 张图片')
}

async function submit() {
  if (!form.name.trim()) return ElMessage.warning('请填写商品名称')
  if (!fileList.value.length) return ElMessage.warning('请至少选择一张图片')

  const fd = new FormData()
  Object.entries(form).forEach(([k, v]) => fd.append(k, v))
  // 字段名 images 必须与后端 upload.array('images', 5) 一致
  fileList.value.forEach((f) => fd.append('images', f.raw))

  submitting.value = true
  try {
    await createProduct(fd)
    ElMessage.success('上传成功')
    form.name = form.audience = form.category = ''
    fileList.value = []
    emit('created')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-card header="上传商品素材">
    <el-form :model="form" label-width="80px">
      <el-form-item label="商品名称" required>
        <el-input v-model="form.name" maxlength="60" placeholder="例如：折叠收纳箱" />
      </el-form-item>
      <el-form-item label="目标受众">
        <el-select v-model="form.audience" placeholder="请选择" clearable style="width: 100%">
          <el-option
            v-for="a in ['欧美年轻人', '日本上班族', '拉美家庭用户', '东南亚学生']"
            :key="a"
            :label="a"
            :value="a"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="商品品类">
        <el-select v-model="form.category" placeholder="请选择" clearable style="width: 100%">
          <el-option
            v-for="c in ['家居收纳', '3C 配件', '美妆个护', '服饰箱包', '户外运动']"
            :key="c"
            :label="c"
            :value="c"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="商品图片" required>
        <el-upload
          drag
          multiple
          :auto-upload="false"
          :limit="5"
          accept=".jpg,.jpeg,.png,.webp"
          list-type="picture"
          v-model:file-list="fileList"
          :on-change="onChange"
          :on-exceed="onExceed"
        >
          <div class="upload-text">将图片拖到此处，或 <em>点击选择</em></div>
          <template #tip>
            <div class="el-upload__tip">支持 JPG / PNG / WebP，单张不超过 5MB，最多 5 张</div>
          </template>
        </el-upload>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="submitting" @click="submit">上传并保存</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<style scoped>
.upload-text {
  color: #606266;
}
</style>
