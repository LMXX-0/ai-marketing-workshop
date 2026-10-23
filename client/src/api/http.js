// axios 实例：统一 API 基础地址、超时时间与响应解包逻辑
import axios from 'axios'

const http = axios.create({
  // 开发环境指向本地后端；生产环境留空，由 Nginx 同域反向代理 /api
  baseURL: import.meta.env.VITE_API_BASE ?? '',
  timeout: 60000, // 60 秒超时，兼容 AI 生成等耗时接口
})

// 响应拦截器：统一解包 { code, message, data }，code 不为 0 视为业务失败
http.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && body.code !== undefined && body.code !== 0) {
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return body // 直接返回业务数据体，调用方无需再取 res.data
  },
  // 网络或 HTTP 异常：优先使用后端返回的 message
  (err) => Promise.reject(new Error(err.response?.data?.message || err.message))
)

export default http
