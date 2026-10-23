**多模态 AI 跨境电商智能出海营销工坊**

# 实战8-海报排版导出与 Token 审计看板

|  |  |
| --- | --- |
| 对应阶段 | 第 4 天（周四）· 下午实战单元 |
| 建议用时 | 约 2 节课（90 分钟左右） |
| 截止时间 | 周四 18:00 前（与作业 7 一并提交） |
| 满分 | 100 分（占总成绩 10%） |
| 提交方式 | 在线实训实战平台上传（见“提交物”） |

## 一、作业目标

素材做出来之后要能**交付**，AI 用了多少钱要能**核算**。本次作业完成两件事：把场景主图和多语言文案一键打包成 ZIP 营销包；给所有大模型调用加上统一的 Token 埋点，并用 ECharts 做成运营数据看板。完成后你应该能做到：

- 用 jszip 在浏览器端把图片与文本打包成 ZIP 并下载；
- 在后端统一拦截每一次大模型调用，记录 Prompt / Completion Tokens、耗时、成功与否；
- 用 MongoDB 聚合查询统计“每日 Token 消耗”和“API 成功率”；
- 用 ECharts 绘制折线图与饼图，做出运营数据看板。

> **提示：**埋点要放在统一的 `llmClient` 里，而不是散落在每个业务函数里。这样以后新增任何 AI 功能，都自动被统计，不会漏。

## 二、ZIP 营销包结构约定

```
示例商品-营销包.zip
└─ 示例商品-营销包/
   ├─ images/
   │  ├─ scene-1.png
   │  └─ scene-2.png
   ├─ copy/
   │  ├─ amazon-en-1.txt
   │  ├─ tiktok-ja-2.txt
   │  └─ instagram-es-3.txt
   └─ README.txt
```

## 三、操作步骤

### 步骤 1　前端：ZIP 营销包打包

```js
安装依赖：cd client && npm install jszip file-saver。
新建 client/src/utils/exportPack.js：
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { fetchAssets } from '../api/asset'

const BASE = import.meta.env.VITE_API_BASE ?? ''
const safeName = (s) => s.replace(/[\\/:*?"<>|]/g, '_')

export async function exportPack(product) {
  const assets = (await fetchAssets({ productId: product._id })).data.filter((a) => a.status === 'done')
  const images = assets.filter((a) => a.type === 'image')
  const copies = assets.filter((a) => a.type === 'copy')
  if (!images.length && !copies.length) throw new Error('该商品还没有可导出的素材，请先生成文案或场景图')

  const rootName = safeName(product.name) + '-营销包'
  const folder = new JSZip().folder(rootName)

  // 图片：同源下载为 Blob 后放进 images/
  await Promise.all(images.map(async (a, i) => {
    const res = await fetch(BASE + a.imageUrl)
    if (!res.ok) throw new Error('下载图片失败：' + a.imageUrl)
    folder.file(`images/scene-${i + 1}.png`, await res.blob())
  }))

  // 文案：每条保存为一个 .txt
  copies.forEach((a, i) => folder.file(`copy/${a.channel}-${a.language}-${i + 1}.txt`, a.content))

  folder.file('README.txt',
    `商品：${product.name}\n导出时间：${new Date().toLocaleString()}\n场景图：${images.length} 张\n文案：${copies.length} 条\n`)

  const blob = await folder.generateAsync({ type: 'blob' })   // 注意是从 folder 的根生成
  saveAs(blob, rootName + '.zip')
}
```

1. 在 `ProductList.vue` 每张卡片里增加“导出营销包”按钮：

```js
<el-button size="small" plain @click="doExport(p)">导出营销包</el-button>
// 脚本中新增
import { exportPack } from '../utils/exportPack'
async function doExport(p) {
  try { await exportPack(p); ElMessage.success('已开始下载') }
  catch (e) { ElMessage.error(e.message) }
}
```

2. 先为同一个商品准备好至少 1 张场景图和 2 条不同渠道的文案，点击导出，解压 ZIP，对照上面的结构检查。

**说明：**`folder.generateAsync` 和 `zip.generateAsync` 的区别：从子文件夹生成，压缩包内就不会多一层空目录。如果解压后多了一层，检查这里。

注意：浏览器 `fetch` 图片要求后端允许跨域。我们在 `app.js` 里把 `cors()` 放在了 `/uploads` 静态目录之前，所以开发环境下可以直接下载；顺序放反会报跨域错误。

### 步骤 2　后端：设计 Token 审计模型

```js
新建 server/src/models/TokenLog.js：
import mongoose from 'mongoose'

const tokenLogSchema = new mongoose.Schema(
  {
    purpose: { type: String, enum: ['vision', 'copy', 'prompt', 'image', 'chat'], index: true },
    model: String,
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    success: { type: Boolean, default: true },
    latencyMs: Number,
    errorMessage: String,
    demo: { type: Boolean, default: false },       // 演示数据标记（步骤 5 用）
  },
  { timestamps: true }
)
tokenLogSchema.index({ createdAt: 1 })

export default mongoose.model('TokenLog', tokenLogSchema)
```

1. 新建 `server/src/services/usageLogger.js`。**记录失败绝不能影响主流程**，所以要吞掉异常：

```js
import TokenLog from '../models/TokenLog.js'

export async function recordUsage(data) {
  try {
    await TokenLog.create(data)
  } catch (e) {
    console.error('[token-log] 写入失败：', e.message)
  }
}
```

### 步骤 3　后端：在 llmClient 中统一埋点

```js
打开 server/src/services/llmClient.js，把原来的 chatCompletion 重命名为 rawChatCompletion（去掉 export），再新增一个同名的包装函数：
import { recordUsage } from './usageLogger.js'

export async function chatCompletion(opts) {
  const started = Date.now()
  try {
    const result = await rawChatCompletion(opts)
    recordUsage({ purpose: opts.purpose, model: result.model, ...result.usage, success: true, latencyMs: Date.now() - started })
    return result
  } catch (e) {
    recordUsage({ purpose: opts.purpose, model: opts.model, success: false, latencyMs: Date.now() - started, errorMessage: e.message })
    throw e
  }
}
```

1. 同样把 `streamChat` 重命名为 `rawStreamChat`，再新增包装生成器。注意**用户点“停止生成”不算接口失败**：

```js
export async function* streamChat(opts) {
  const started = Date.now()
  let usage = null
  let ok = true
  let errMsg
  try {
    for await (const ev of rawStreamChat(opts)) {
      if (ev.type === 'usage') usage = ev.usage
      yield ev
    }
  } catch (e) {
    if (e.name !== 'AbortError') { ok = false; errMsg = e.message }
    throw e
  } finally {
    recordUsage({
      purpose: opts.purpose, model: opts.model,
      promptTokens: usage?.promptTokens ?? 0, completionTokens: usage?.completionTokens ?? 0,
      success: ok, latencyMs: Date.now() - started, errorMessage: errMsg,
    })
  }
}
```

2. 生图不消耗文本 Token，但同样要计入“调用次数与成功率”。在 `imageService.js` 的 `createImageTask` 中记录：

```js
import { recordUsage } from './usageLogger.js'

export async function createImageTask(prompt, size = '1024*1024') {
  const started = Date.now()
  const model = process.env.IMAGE_MODEL || 'wanx2.1-t2i-turbo'
  try {
    // ……原有的下发任务逻辑不变，得到 taskId……
    recordUsage({ purpose: 'image', model, success: true, latencyMs: Date.now() - started })
    return taskId
  } catch (e) {
    recordUsage({ purpose: 'image', model, success: false, latencyMs: Date.now() - started, errorMessage: e.message })
    throw e
  }
}
```

3. 把识图、文案、生图各跑一次，再到 Compass 打开 `tokenlogs` 集合，应当能看到几条记录，`promptTokens` 与 `completionTokens` 有数值。

**说明：**只改 `llmClient` 就能覆盖识图、文案、提示词扩写三类调用。这就是“统一出口”的价值。

### 步骤 4　后端：统计接口

```js
新建 server/src/controllers/statsController.js：
import TokenLog from '../models/TokenLog.js'

const DAY = 24 * 3600 * 1000
const fmt = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })   // 输出 YYYY-MM-DD

export async function overview(req, res, next) {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 30)
    const today = new Date(fmt(new Date()) + 'T00:00:00+08:00')
    const since = new Date(today.getTime() - (days - 1) * DAY)
    const labels = Array.from({ length: days }, (_, i) => fmt(new Date(since.getTime() + i * DAY)))
    const match = { $match: { createdAt: { $gte: since } } }

    const [daily, outcome, byPurpose, demoCount] = await Promise.all([
      TokenLog.aggregate([match, { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Shanghai' } },
        promptTokens: { $sum: '$promptTokens' }, completionTokens: { $sum: '$completionTokens' }, calls: { $sum: 1 },
      } }]),
      TokenLog.aggregate([match, { $group: { _id: '$success', count: { $sum: 1 } } }]),
      TokenLog.aggregate([match, { $group: { _id: '$purpose', calls: { $sum: 1 },
        tokens: { $sum: { $add: ['$promptTokens', '$completionTokens'] } } } }]),
      TokenLog.countDocuments({ createdAt: { $gte: since }, demo: true }),
    ])

    // 没有数据的日期补 0，折线图才不会断
    const map = Object.fromEntries(daily.map((d) => [d._id, d]))
    const series = labels.map((date) => ({
      date, promptTokens: map[date]?.promptTokens ?? 0, completionTokens: map[date]?.completionTokens ?? 0, calls: map[date]?.calls ?? 0,
    }))
    const success = outcome.find((o) => o._id === true)?.count ?? 0
    const failed = outcome.find((o) => o._id === false)?.count ?? 0
    const totalTokens = series.reduce((s, d) => s + d.promptTokens + d.completionTokens, 0)

    res.json({ code: 0, message: 'ok', data: {
      series, success, failed, byPurpose, totalTokens,
      totalCalls: success + failed,
      successRate: success + failed ? +(success / (success + failed) * 100).toFixed(1) : 0,
      hasDemo: demoCount > 0,
    } })
  } catch (e) { next(e) }
}
路由：router.get('/stats/overview', overview)，浏览器直接访问 http://localhost:3000/api/stats/overview 检查返回的数据结构。
```

### 步骤 5　（可选）补充演示数据

如果当天额度紧张、历史数据太少，可以用脚本补充近 7 天的**演示数据**。这些数据必须标记 `demo: true`，并在看板上明确提示，不能冒充真实数据。新建 `server/src/scripts/seed-token-log.js`：

```js
import 'dotenv/config'
import mongoose from 'mongoose'
import TokenLog from '../models/TokenLog.js'

await mongoose.connect(process.env.MONGO_URI)
const purposes = ['vision', 'copy', 'prompt', 'image']
const docs = []
for (let d = 6; d >= 1; d--) {
  for (let i = 0; i < 8; i++) {
    const p = purposes[i % purposes.length]
    const ts = new Date(Date.now() - d * 24 * 3600 * 1000 + i * 3600 * 1000)
    docs.push({
      purpose: p, model: 'demo', success: Math.random() > 0.1,
      promptTokens: p === 'image' ? 0 : 300 + Math.floor(Math.random() * 900),
      completionTokens: p === 'image' ? 0 : 200 + Math.floor(Math.random() * 700),
      latencyMs: 1000 + Math.floor(Math.random() * 4000), demo: true, createdAt: ts, updatedAt: ts,
    })
  }
}
await TokenLog.insertMany(docs)
console.log('已插入演示数据', docs.length, '条')
await mongoose.disconnect()
运行：node src/scripts/seed-token-log.js。需要清除时在 Compass 中用 { "demo": true } 筛选后删除。
```

注意：提交的截图里如果包含演示数据，页面必须显示“含演示数据”的提示（下面的看板代码已包含）。

### 步骤 6　前端：ECharts 运营数据看板

```js
新建 client/src/api/stats.js：
import http from './http'
export const getOverview = (days = 7) => http.get('/api/stats/overview', { params: { days } })
新建 client/src/views/Dashboard.vue：
<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { getOverview } from '../api/stats'

const data = ref(null)
const days = ref(7)
const lineEl = ref()
const pieEl = ref()
let line, pie

function render() {
  const d = data.value
  line ||= echarts.init(lineEl.value)
  pie ||= echarts.init(pieEl.value)

  line.setOption({
    title: { text: '每日 Token 消耗走势', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['Prompt Tokens', 'Completion Tokens'] },
    grid: { left: 50, right: 24, top: 56, bottom: 48 },
    xAxis: { type: 'category', data: d.series.map((s) => s.date.slice(5)) },
    yAxis: { type: 'value', name: 'Tokens' },
    series: [
      { name: 'Prompt Tokens', type: 'line', smooth: true, data: d.series.map((s) => s.promptTokens), itemStyle: { color: '#409eff' } },
      { name: 'Completion Tokens', type: 'line', smooth: true, data: d.series.map((s) => s.completionTokens), itemStyle: { color: '#e6a23c' } },
    ],
  })

  pie.setOption({
    title: { text: 'API 调用成功率', left: 'center' },
    tooltip: { trigger: 'item', formatter: '{b}：{c} 次（{d}%）' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['40%', '65%'], center: ['50%', '48%'],
      data: [
        { name: '成功', value: d.success, itemStyle: { color: '#67c23a' } },
        { name: '失败', value: d.failed, itemStyle: { color: '#f56c6c' } },
      ],
    }],
  })
}

async function load() {
  try {
    data.value = (await getOverview(days.value)).data
    await nextTick()
    render()
  } catch (e) { ElMessage.error(e.message) }
}

const onResize = () => { line?.resize(); pie?.resize() }
onMounted(() => { load(); window.addEventListener('resize', onResize) })
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  line?.dispose(); pie?.dispose()
})
</script>

<template>
  <div v-if="data">
    <el-alert v-if="data.hasDemo" type="warning" show-icon :closable="false" title="当前统计包含演示数据（非真实调用）" style="margin-bottom: 16px" />
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="8"><el-card><el-statistic title="近期 Token 消耗" :value="data.totalTokens" /></el-card></el-col>
      <el-col :span="8"><el-card><el-statistic title="API 调用次数" :value="data.totalCalls" /></el-card></el-col>
      <el-col :span="8"><el-card><el-statistic title="成功率" :value="data.successRate" suffix="%" /></el-card></el-col>
    </el-row>
    <el-row :gutter="16">
      <el-col :span="14"><el-card><div ref="lineEl" style="height: 340px"></div></el-card></el-col>
      <el-col :span="10"><el-card><div ref="pieEl" style="height: 340px"></div></el-card></el-col>
    </el-row>
    <el-card header="各功能消耗明细" style="margin-top: 16px">
      <el-table :data="data.byPurpose">
        <el-table-column prop="_id" label="功能" />
        <el-table-column prop="calls" label="调用次数" />
        <el-table-column prop="tokens" label="Token 总量" />
      </el-table>
    </el-card>
  </div>
  <el-skeleton v-else animated :rows="8" />
</template>
在 App.vue 的标签页里新增“运营看板”：<el-tab-pane label="运营看板" name="stats" lazy><Dashboard /></el-tab-pane>。
```

1. 在页面里分别触发几次识图、文案、生图（可以故意让一次失败），再打开看板，应看到折线图当天有数据，饼图中有成功与失败的占比。

> **提示：**ECharts 实例必须在页面销毁时 `dispose`，并监听窗口 `resize`，否则切换标签页后图表会变形或内存泄漏。

## 四、常见问题

| 现象 | 处理办法 |
| --- | --- |
| ZIP 里图片是 0 字节或打不开 | 确认 `fetch` 返回 `res.ok`，并用 `res.blob()`，不要用 `res.text()` |
| 解压后中文文件名乱码 | 部分 Windows 自带解压工具对 UTF-8 文件名支持差，换用 7-Zip 或在 README 中提示 |
| 导出时报跨域错误 | 检查 `app.js` 中 `cors()` 是否在 `/uploads` 静态路由之前 |
| `tokenlogs` 里没有记录 | 确认业务代码调用的是包装后的 `chatCompletion`、`streamChat`，而不是 `raw` 版本 |
| 流式调用 Token 全为 0 | 请求体中需带 `stream_options: { include_usage: true }`（作业 6 已配置） |
| 折线图只有一个点 | 数据只有当天一天；用补充演示数据脚本，或把天数调大 |
| 看板打开是空白 | 容器高度为 0：给图表 `div` 设置明确的 `height`，并在 `nextTick` 后再初始化 |
| 日期对不上 | 聚合时指定 `timezone: 'Asia/Shanghai'`，与前端展示口径一致 |

## 五、自检清单

- 能把场景图与文案一键打包下载 ZIP，解压结构与约定一致；
- 所有文本、识图、提示词扩写调用都在 `llmClient` 统一埋点；
- 记录失败不会影响主业务，用户主动停止不被算作失败；
- 生图调用也被计入调用次数与成功率；
- 统计接口按天聚合，缺失日期补 0；
- 看板包含折线图、饼图与汇总数字，并正确 `dispose`；
- 若使用演示数据，已标记并在页面提示。

## 六、提交物（在线实训实战平台上传）

本次作业对应第 4 天提交要求中的**提交物 2、提交物 3**，与作业 7 的提交物一起在周四 18:00 前提交。

| 编号 | 提交物 | 要求 |
| --- | --- | --- |
| 提交物 2 | 生成的 ZIP 营销包解压后的文件结构截图 | 能看到 `images/`、`copy/`、`README.txt` 及其中的文件 |
| 提交物 3 | 包含 Token 消耗统计的 ECharts 数据大屏界面截图 | 能同时看到折线图、饼图和汇总数字；有演示数据时需带“含演示数据”提示 |

## 七、评分标准（满分 100）

| 评分项 | 要求 | 分值 |
| --- | --- | --- |
| ZIP 打包 | 结构规范、图片与文案齐全、文件可正常打开 | 20 |
| Token 埋点 | 统一出口埋点、记录用量与耗时与成败、不影响主流程 | 25 |
| 统计接口 | 按天聚合、补零、成功率计算正确 | 15 |
| ECharts 看板 | 折线图 + 饼图 + 汇总，数据真实，图表生命周期处理 | 30 |
| 规范 | 截图清晰，演示数据已标注，代码已提交 | 10 |

扣分项：用演示数据冒充真实调用且未标注，扣 10 分。
