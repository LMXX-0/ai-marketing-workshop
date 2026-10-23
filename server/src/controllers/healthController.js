// 健康检查控制器：用于前端联调与部署探活
export function health(req, res) {
  // 统一响应结构；data.time 便于确认服务当前时间
  res.json({
    code: 0,
    message: 'ok',
    data: { status: 'up', time: new Date().toISOString() },
  })
}
