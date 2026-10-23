// 后端服务入口：初始化 Express、注册中间件与路由、连接 MongoDB 后启动 HTTP 服务
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDB } from './config/db.js'
import routes from './routes/index.js'
import { UPLOAD_DIR } from './middlewares/upload.js'

const app = express()

// 跨域配置：CORS_ORIGIN 支持用逗号配置多个来源，未配置时允许所有来源
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }))
// 请求体解析：JSON 上限 2MB（后续商品信息与图片路径），同时兼容表单格式
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// 上传目录对外只读访问，前端通过 /uploads/文件名 加载图片
app.use('/uploads', express.static(UPLOAD_DIR))

// 所有业务接口统一挂载在 /api 前缀下
app.use('/api', routes)

// 统一错误处理：必须放在所有路由之后，按 { code, message } 结构返回
app.use((err, req, res, next) => {
  // multer 的限制类错误默认没有 status，这里翻译成可读提示
  if (err.name === 'MulterError') {
    const map = {
      LIMIT_FILE_SIZE: '单张图片不能超过 5MB',
      LIMIT_FILE_COUNT: '最多上传 5 张图片',
      LIMIT_UNEXPECTED_FILE: '上传字段名应为 images',
    }
    return res.status(400).json({ code: 4001, message: map[err.code] || err.message })
  }
  console.error('[error]', err)
  res.status(err.status || 500).json({
    code: err.code || 5001,
    message: err.message || '服务器内部错误',
  })
})

const port = process.env.PORT || 3000

// 先连接数据库，成功后再监听端口，避免数据库不可用时服务“假启动”
connectDB()
  .then(() => app.listen(port, () => console.log(`[server] http://localhost:${port}`)))
  .catch((e) => {
    console.error('[启动失败]', e.message)
    process.exit(1)
  })
