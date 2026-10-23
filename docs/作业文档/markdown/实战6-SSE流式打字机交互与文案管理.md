**多模态 AI 跨境电商智能出海营销工坊**

# 实战6-SSE 流式打字机交互与文案管理

|  |  |
| --- | --- |
| 对应阶段 | 第 3 天（周三）· 下午实战单元 |
| 建议用时 | 约 2 节课（90 分钟左右） |
| 截止时间 | 周三 18:00 前（与作业 5 一并提交） |
| 满分 | 100 分（占总成绩 10%） |
| 提交方式 | 在线实训实战平台上传（见“提交物”） |

## 一、作业目标

作业 5 的文案要等模型全部生成完才能看到，通常要等十几秒，体验很差。现在把它改造成像 ChatGPT 一样“边生成边显示”的打字机效果。完成后你应该能做到：

- 理解 SSE（Server-Sent Events）协议，并在 Express 中输出 `text/event-stream`；
- 打开大模型的 `stream` 模式，把上游的流式数据转发给前端；
- 前端用 Fetch 的 ReadableStream 读取并解析事件；
- 用 Markdown 渲染库实时渲染，并支持“停止生成”；
- 生成完毕后把文案保存到数据库，并能在列表中管理。

> **提示：**前端常见的 `EventSource` 只支持 GET，没法带 JSON 请求体，所以我们改用 `fetch` + `ReadableStream` 来读 POST 的流式响应。

## 二、背景知识

### 2.1 SSE 报文格式

SSE 是一种服务器向浏览器单向推送文本流的协议，响应头是 `Content-Type: text/event-stream`，每条消息以**空行**结尾：

```
event: delta
data: {"text":"Hello"}

event: delta
data: {"text":" world"}

event: done
data: {"assetId":"66f...","content":"Hello world"}

```

| 字段 | 含义 |
| --- | --- |
| `event` | 事件名，本项目约定：`delta`（增量文本）、`done`（完成）、`error`（出错） |
| `data` | 事件数据，约定用单行 JSON |
| 空行 | 一条消息的结束标志，不能省略 |

### 2.2 整体数据流

```
浏览器 fetch ──POST──> Express ──stream:true──> 大模型
   ▲                      │  (逐块读取上游数据)
   └── event: delta ──────┘  (逐块写给浏览器)
```

## 三、操作步骤

### 步骤 1　后端：给 llmClient 增加流式调用

1. 在 `server/src/services/llmClient.js` 末尾追加一个异步生成器 `streamChat`。它会逐块产出文本增量，最后产出一次 Token 用量：

```js
/**
 * 流式对话（异步生成器）。逐步 yield：
 *   { type: 'delta', text }     增量文本
 *   { type: 'usage', usage }    结束时的 Token 用量
 */
export async function* streamChat({ model, messages, temperature = 0.8, purpose = 'chat', signal }) {
  const key = process.env.DASHSCOPE_API_KEY
  if (!key) throw new LLMError('服务器未配置 DASHSCOPE_API_KEY', 500)

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, messages, temperature,
      stream: true,
      stream_options: { include_usage: true },   // 让最后一个数据块带上 usage
    }),
    signal,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new LLMError(`大模型返回 ${res.status}：${data.error?.message || '未知错误'}`)
  }

  const decoder = new TextDecoder()
  let buf = ''
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()                              // 最后一行可能不完整，留到下一轮
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const payload = t.slice(5).trim()
      if (payload === '[DONE]') return
      let json
      try { json = JSON.parse(payload) } catch { continue }
      const text = json.choices?.[0]?.delta?.content
      if (text) yield { type: 'delta', text }
      if (json.usage) {
        yield { type: 'usage', usage: { promptTokens: json.usage.prompt_tokens ?? 0, completionTokens: json.usage.completion_tokens ?? 0 } }
      }
    }
  }
}
```

**说明：**上游的数据块边界和一行 JSON 的边界不一定对齐，所以必须用 `buf` 缓冲，按换行拆分，把最后不完整的一行留到下一次处理。

### 步骤 2　后端：编写 SSE 流式 Controller

```js
在 server/src/controllers/copyController.js 中新增 stream：
import MarketingAsset from '../models/MarketingAsset.js'
import { streamChat } from '../services/llmClient.js'
import { buildCopyMessages } from '../services/promptBuilder.js'
import { findViolations, maskViolations } from '../middlewares/compliance.js'

export async function stream(req, res) {
  const { productId, language, channel, extra } = req.body

  // 1) 参数校验：必须在开启 SSE 之前，仍然用普通 JSON 返回错误
  const product = await Product.findById(productId).catch(() => null)
  if (!product) return res.status(404).json({ code: 4004, message: '商品不存在' })
  if (!product.aiAnalysis?.core_selling_points?.length)
    return res.status(400).json({ code: 4001, message: '请先对该商品执行“AI 一键识别”' })
  let messages
  try { messages = buildCopyMessages({ product, language, channel, extra }) }
  catch (e) { return res.status(e.status || 400).json({ code: 4001, message: e.message }) }

  // 2) 开启 SSE
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',        // 告诉 Nginx 不要缓冲，作业 9 会再配置
  })
  res.flushHeaders()
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  // 3) 用户点“停止生成”（浏览器断开连接）时，同步中断上游请求，避免白白消耗额度
  const upstream = new AbortController()
  let clientGone = false
  res.on('close', () => {
    if (!res.writableEnded) { clientGone = true; upstream.abort() }
  })

  let full = ''
  try {
    for await (const ev of streamChat({
      model: process.env.TEXT_MODEL || 'qwen-plus',
      messages, purpose: 'copy', signal: upstream.signal,
    })) {
      if (ev.type === 'delta') { full += ev.text; send('delta', { text: ev.text }) }
    }
    // 4) 生成完毕：遮蔽敏感词、保存、通知前端
    const warnings = findViolations(full)
    const content = maskViolations(full)
    const asset = await MarketingAsset.create({ productId, type: 'copy', language, channel, content, status: 'done' })
    send('done', { assetId: asset._id, content, warnings })
  } catch (e) {
    if (!clientGone) send('error', { message: e.message || '生成失败' })
  } finally {
    res.end()
  }
}
在路由中注册：router.post('/copy/stream', inputGuard(['extra']), stream)。
```

1. 不要给整个应用加 `compression()` 之类的压缩中间件，否则响应可能被缓冲，导致“一次性吐出”。
2. 用终端测试流式效果（`-N` 表示不缓冲），应该看到一条一条的 `event: delta`：

```bash
curl -N -X POST http://localhost:3000/api/copy/stream \
  -H "Content-Type: application/json" \
  -d '{"productId":"你的商品ID","language":"en","channel":"instagram"}'
```

注意：监听断开要用 `res.on('close')`，不要用 `req.on('close')`。在较新的 Node 版本里，请求体读完后 `req` 的 close 就可能触发，会导致生成刚开始就被中断。

```js
说明：这个 stream Controller 的核心部分（设置响应头、for await 转发、res.write、断开处理）就是提交物 3 要截图的内容。
```

### 步骤 3　前端：用 Fetch 读取 ReadableStream

```js
新建 client/src/utils/useCopyStream.js，封装成可复用的组合式函数：
import { ref } from 'vue'

const BASE = import.meta.env.VITE_API_BASE ?? ''

export function useCopyStream() {
  const text = ref('')
  const streaming = ref(false)
  const error = ref('')
  const result = ref(null)          // done 事件携带的数据：assetId、warnings
  let controller = null

  // 解析一条 SSE 消息（以空行分隔的一个块）
  function handleBlock(block) {
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return
    const json = JSON.parse(data)
    if (event === 'delta') text.value += json.text
    else if (event === 'done') { text.value = json.content; result.value = json }
    else if (event === 'error') error.value = json.message
  }

  async function start(body) {
    text.value = ''; error.value = ''; result.value = null
    streaming.value = true
    controller = new AbortController()
    try {
      const res = await fetch(`${BASE}/api/copy/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {                                  // 校验失败时后端返回的是普通 JSON
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || `请求失败（${res.status}）`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const blocks = buf.split('\n\n')
        buf = blocks.pop()                            // 末尾不完整的块留到下一轮
        blocks.forEach(handleBlock)
      }
    } catch (e) {
      if (e.name !== 'AbortError') error.value = e.message
    } finally {
      streaming.value = false
      controller = null
    }
  }

  const stop = () => controller?.abort()
  return { text, streaming, error, result, start, stop }
}
```

**说明：**`stop()` 调用 `abort()` 后，浏览器会断开连接，后端的 `res.on('close')` 就会触发并中断上游请求。这一条链路要自己用日志验证一次。

### 步骤 4　前端：Markdown 打字机界面

```
安装 Markdown 渲染与安全净化库：cd client && npm install marked dompurify。
```

1. 新建 `client/src/components/MarkdownView.vue`。**必须净化**渲染后的 HTML，否则模型输出里夹带的脚本会造成 XSS：

```vue
<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps({ source: String, streaming: Boolean })
const html = computed(() => DOMPurify.sanitize(marked.parse(props.source || '')))
</script>

<template>
  <div class="md" :class="{ typing: streaming }" v-html="html"></div>
</template>

<style>
.md { line-height: 1.75; word-break: break-word; }
.md table { border-collapse: collapse; margin: 8px 0; }
.md th, .md td { border: 1px solid #dcdfe6; padding: 6px 10px; }
.md th { background: #f5f7fa; }
.md.typing > :last-child::after {            /* 光标闪烁效果 */
  content: '▍'; margin-left: 2px; color: #409eff; animation: blink 1s steps(2) infinite;
}
@keyframes blink { 50% { opacity: 0 } }
</style>
```

2. 改造 `CopyStudio.vue`：把 `run()` 换成流式调用，并增加“停止生成”按钮。脚本部分：

```js
import { useCopyStream } from '../utils/useCopyStream'
import MarkdownView from '../components/MarkdownView.vue'

const { text, streaming, error, result, start, stop } = useCopyStream()

function run() {
  if (!form.value.productId) return ElMessage.warning('请先选择商品')
  start(form.value)
}
// 生成完毕后刷新历史文案列表（步骤 5 实现）
import { watch } from 'vue'
watch(result, (r) => { if (r) loadAssets() })
```

3. 模板中，把原来的按钮与结果区替换为：

```html
<el-button v-if="!streaming" type="primary" @click="run">生成文案</el-button>
<el-button v-else type="danger" @click="stop">停止生成</el-button>

<!-- 右侧结果区 -->
<el-alert v-if="error" type="error" show-icon :closable="false" :title="error" style="margin-bottom: 12px" />
<el-alert v-if="result?.warnings?.length" type="warning" show-icon :closable="false"
          :title="'已遮蔽敏感词：' + result.warnings.join('、')" style="margin-bottom: 12px" />
<MarkdownView :source="text || '这里实时显示生成的文案'" :streaming="streaming" />
```

4. 点击“生成文案”，应能看到文字一个一个蹦出来，末尾有闪烁光标；点击“停止生成”后立即停止。**这就是提交物 2 的截图时机**：要在文字还在输出的过程中截图。

### 步骤 5　文案管理：保存、查看、复制、删除

```js
新建 server/src/controllers/assetController.js：
import MarketingAsset from '../models/MarketingAsset.js'

export async function listAssets(req, res, next) {
  try {
    const { productId, type } = req.query
    const filter = {}
    if (productId) filter.productId = productId
    if (type) filter.type = type
    const list = await MarketingAsset.find(filter).sort({ createdAt: -1 }).limit(100).populate('productId', 'name')
    res.json({ code: 0, message: 'ok', data: list })
  } catch (e) { next(e) }
}

export async function removeAsset(req, res, next) {
  try {
    await MarketingAsset.findByIdAndDelete(req.params.id)
    res.json({ code: 0, message: 'ok' })
  } catch (e) { next(e) }
}
```

1. 注册路由：

```js
import { listAssets, removeAsset } from '../controllers/assetController.js'
router.get('/assets', listAssets)
router.delete('/assets/:id', removeAsset)
前端新增 client/src/api/asset.js：
import http from './http'
export const fetchAssets = (params) => http.get('/api/assets', { params })
export const deleteAsset = (id) => http.delete(`/api/assets/${id}`)
```

2. 在 `CopyStudio.vue` 下方增加“历史文案”表格，支持查看、复制、删除：

```js
// 一、追加到 CopyStudio.vue 的 <script setup> 中
import { fetchAssets, deleteAsset } from '../api/asset'
const assets = ref([])
const viewing = ref(null)

async function loadAssets() {
  assets.value = (await fetchAssets({ type: 'copy' })).data
}
async function copyText(row) {
  await navigator.clipboard.writeText(row.content)
  ElMessage.success('已复制到剪贴板')
}
async function remove(row) {
  await deleteAsset(row._id)
  ElMessage.success('已删除')
  loadAssets()
}
onMounted(loadAssets)
```

3. 再把下面这段追加到 `CopyStudio.vue` 的 `<template>` 末尾，与最外层的 `<el-row>` 同级（Vue 3 支持多个根节点，不用再包一层）：

```html
  <el-card header="历史文案" style="margin-top: 20px">
    <el-table :data="assets" empty-text="暂无文案">
      <el-table-column label="商品" min-width="140"><template #default="{ row }">{{ row.productId?.name }}</template></el-table-column>
      <el-table-column prop="language" label="语言" width="80" />
      <el-table-column prop="channel" label="渠道" width="110" />
      <el-table-column label="生成时间" width="170"><template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template></el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button link type="primary" @click="viewing = row">查看</el-button>
          <el-button link type="primary" @click="copyText(row)">复制</el-button>
          <el-popconfirm title="确定删除？" @confirm="remove(row)"><template #reference><el-button link type="danger">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
  <el-drawer :model-value="!!viewing" title="文案详情" size="45%" @close="viewing = null">
    <MarkdownView :source="viewing?.content" />
  </el-drawer>
```

> **提示：**`navigator.clipboard` 只在 HTTPS 或 localhost 下可用。作业 9 用局域网 IP 通过 HTTP 访问时，复制功能可能失效，到时可以用降级方案（选中文本 + `document.execCommand('copy')`）。

### 步骤 6　联调与验证

| 测试项 | 操作 | 预期结果 |
| --- | --- | --- |
| 流式输出 | 点击生成 | 文字逐步出现，不是一次性出现 |
| 停止生成 | 输出一半点击“停止生成” | 立即停止；后端日志没有继续输出 |
| 完成保存 | 等待输出完毕 | 历史列表出现新记录，Compass 中有对应文档 |
| Markdown 渲染 | 选 TikTok 渠道 | 分镜表以表格形式渲染 |
| 校验失败 | 未识别的商品直接请求 | 给出明确错误提示，而不是一直转圈 |
| 敏感词 | 补充要求中写“全球最好” | 提示被拦截 |
| 安全 | 在文案里手工加入 `<script>alert(1)</script>` 再渲染 | 不会弹窗，被净化掉 |

## 四、常见问题

| 现象 | 处理办法 |
| --- | --- |
| 文字等全部生成完才一次性出现 | 检查是否加了压缩中间件；确认调用了 `res.flushHeaders()`；`curl -N` 先排查是后端还是前端的问题 |
| 一开始就中断，没有输出 | 把 `req.on('close')` 改成 `res.on('close')` |
| 前端提示 `Unexpected token` | 解析 SSE 时没有按空行分块，或把多行 `data` 拼错；打印原始 block 排查 |
| 中文出现乱码 | 响应头要写 `charset=utf-8`，并在前端用 `TextDecoder` 且开启 `{ stream: true }` |
| 点击停止后后端仍在继续 | 检查 `upstream.abort()` 是否被调用，并把 `signal` 传给了 `fetch` |
| 渲染后表格没有样式 | 检查 `.md table` 样式是否被 `scoped` 限制了，`v-html` 内的元素需要用全局样式或 `:deep()` |
| 历史文案不更新 | `watch(result)` 里调用 `loadAssets`，确认 `done` 事件已解析 |

## 五、自检清单

```
后端响应头为 text/event-stream，调用了 flushHeaders，事件格式为 event + data + 空行；
```

- `streamChat` 开启了上游 `stream` 模式，并正确处理了数据块边界；
- 浏览器断开后上游请求被同步中断；
- 前端使用 `fetch` 读取 `ReadableStream`，有打字机效果与闪烁光标；
- Markdown 渲染经过 DOMPurify 净化；
- “停止生成”可用；
- 生成完毕自动保存，历史列表可查看、复制、删除。

## 六、提交物（在线实训实战平台上传）

本次作业对应第 3 天提交要求中的**提交物 2、提交物 3**，与作业 5 的提交物一起在周三 18:00 前提交。

| 编号 | 提交物 | 要求 |
| --- | --- | --- |
| 提交物 2 | 前端流式打字机效果正在输出时的动态界面截图 | 要在输出中途截图，能看到光标和“停止生成”按钮；建议再附一张完成后的整页图 |
| 提交物 3 | 后端 SSE 流式推送的 Controller 核心代码截图 | 包含响应头设置、`for await` 转发、`res.write` 和断开处理，不出现 Key |

## 七、评分标准（满分 100）

| 评分项 | 要求 | 分值 |
| --- | --- | --- |
| 后端 SSE 实现 | 响应头正确、事件格式规范、上游 stream 模式、断开中断 | 30 |
| 前端流式读取 | Fetch + ReadableStream，正确分块解析，错误处理 | 25 |
| 打字机界面 | Markdown 渲染并净化，闪烁光标，停止生成可用 | 20 |
| 文案管理 | 完成后入库，列表可查看、复制、删除 | 15 |
| 测试验证 | 完成步骤 6 的测试表，含停止与安全测试 | 5 |
| 规范 | 截图清晰、代码已提交 | 5 |

扣分项：使用 `v-html` 渲染但未做净化，扣 5 分。
