// 营销资产模型：保存 AI 生成的文案与场景图，按商品维度关联
import mongoose from 'mongoose'

const assetSchema = new mongoose.Schema(
  {
    // 关联商品，按商品查询资产时使用索引
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    type: { type: String, enum: ['copy', 'image'], required: true }, // 资产类型：文案 / 图片
    language: String, // en / ja / es
    channel: String, // amazon / tiktok / instagram
    content: String, // 文案正文
    imageUrl: String, // 场景图路径
    prompt: String, // 生图提示词
    taskId: String, // 生图异步任务 ID
    status: { type: String, enum: ['pending', 'done', 'failed'], default: 'done' }, // 生图任务状态
  },
  { timestamps: true } // 自动维护 createdAt / updatedAt
)

export default mongoose.model('MarketingAsset', assetSchema)
