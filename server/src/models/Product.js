// 商品模型：保存商品基础信息、图片路径与 AI 视觉分析结果
import mongoose from 'mongoose'

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // 商品名称
    audience: { type: String, default: '' }, // 目标受众
    category: { type: String, default: '' }, // 品类
    images: [{ type: String }], // 图片相对路径，如 /uploads/xxx.png
    aiAnalysis: {
      // AI 视觉分析结果，作业 4 识别后回写
      visual_elements: [String], // 外观视觉元素
      core_selling_points: [String], // 核心卖点
      scene_suggestions: [String], // 场景建议
      analyzedAt: Date, // 最近一次分析时间
    },
  },
  { timestamps: true } // 自动维护 createdAt / updatedAt
)

export default mongoose.model('Product', productSchema)
