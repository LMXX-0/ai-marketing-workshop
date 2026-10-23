// 商品控制器：创建商品（含多图路径入库）与分页查询商品列表
import Product from '../models/Product.js'

// POST /api/products：multipart/form-data，字段 name/audience/category + 多张 images
export async function createProduct(req, res, next) {
  try {
    const { name, audience = '', category = '' } = req.body
    if (!name?.trim()) return res.status(400).json({ code: 4001, message: '商品名称不能为空' })
    if (!req.files?.length) return res.status(400).json({ code: 4001, message: '请至少上传一张图片' })

    // 只保存可由 /uploads 静态目录访问的相对路径，不暴露服务器磁盘结构
    const images = req.files.map((f) => '/uploads/' + f.filename)
    const product = await Product.create({ name, audience, category, images })
    res.json({ code: 0, message: 'ok', data: product })
  } catch (e) {
    next(e)
  }
}

// GET /api/products：按创建时间倒序分页返回，size 上限 50 防止一次拉取过多
export async function listProducts(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const size = Math.min(parseInt(req.query.size) || 20, 50)
    const [list, total] = await Promise.all([
      Product.find().sort({ createdAt: -1 }).skip((page - 1) * size).limit(size),
      Product.countDocuments(),
    ])
    res.json({ code: 0, message: 'ok', data: { list, total, page, size } })
  } catch (e) {
    next(e)
  }
}
