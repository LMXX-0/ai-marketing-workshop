// 商品素材接口封装：上传需使用 multipart/form-data，查询走普通 GET
import http from './http'

// 提交“表单字段 + 多张图片”，由 axios 自动处理 multipart 边界
export const createProduct = (formData) => http.post('/api/products', formData)

// 分页查询商品列表
export const fetchProducts = (params) => http.get('/api/products', { params })
