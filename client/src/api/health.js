// 健康检查接口：用于验证前端与后端服务是否连通
import http from './http'

export const getHealth = () => http.get('/api/health')
