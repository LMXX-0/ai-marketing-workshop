// 路由汇总入口：各业务模块的路由在此注册，由 app.js 统一挂载到 /api
import { Router } from 'express'
import { health } from '../controllers/healthController.js'
import { uploadImages } from '../middlewares/upload.js'
import { createProduct, listProducts } from '../controllers/productController.js'

const router = Router()

// 健康检查：GET /api/health
router.get('/health', health)

// 商品素材：上传（先经过 multer 解析多图）与列表查询
router.post('/products', uploadImages, createProduct)
router.get('/products', listProducts)

export default router
