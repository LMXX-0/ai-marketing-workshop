// 数据库连接封装：从环境变量读取 MongoDB 连接串，供服务入口在启动时调用
import mongoose from 'mongoose'

export async function connectDB() {
  // 必须显式配置连接串，避免连到默认地址而误判启动成功
  const uri = process.env.MONGO_URI
  if (!uri) throw new Error('缺少 MONGO_URI 环境变量')
  await mongoose.connect(uri)
  console.log('[db] MongoDB 已连接')
}
