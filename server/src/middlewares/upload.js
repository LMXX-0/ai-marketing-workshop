// 图片上传中间件：负责存储位置、随机文件名、类型白名单与大小/数量限制
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 上传目录固定在 server/uploads，启动时自动创建
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

// 类型白名单：MIME 与扩展名一一对应，未命中的类型一律拒绝
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // 不使用用户原始文件名，既避免路径穿越，也避免同名覆盖
  filename: (req, file, cb) => cb(null, randomUUID() + ALLOWED[file.mimetype]),
})

// 单张 5MB、最多 5 张，字段名固定为 images
export const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      const err = new Error('仅支持 JPG / PNG / WebP 图片')
      err.status = 400
      err.code = 4001
      return cb(err)
    }
    cb(null, true)
  },
}).array('images', 5)
