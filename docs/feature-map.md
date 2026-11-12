# Pi-Mirror 功能地图

> 基于当前代码（2026-11-11）。只列已经能跑的东西；计划中的能力单独标出。
>
> 可视化版本：[feature-map.html](feature-map.html)。
>
> 状态：✅ 可用 · ◐ 部分可用 · ○ 未实现

## 0. 怎么用

第一次：

1. 在 pi 里加载插件：`pi -e ./src/extension.ts`。
2. 输入 `/mirror`，浏览器打开 `127.0.0.1:4317`。
3. 在 Studio 或 Mirror 页点 `Index demo vault`，或按 `Ctrl/Cmd K` 选 `Re-index vault`。
4. 点右上角 `You` → `Persona`，逐条看证据，Confirm 或 Reject。
5. 需要记录发布时，在 `You` → `Consent` 里开 `publishing`。

之后每次，有两条主路径：

```text
Studio：给一个目标
  → agent 自己 plan（看热点 / 翻笔记 / 查网页 / 参考帖子，顺序不固定）
  → 工具轨迹实时出现
  → 草稿 → Guard 自检 → 修 → submit_package
  → 点「保存到作品库」→ Library
```

```text
Mirror：问 或 写
  → 点 [n] 看来源
  → 草稿下方「查看检查」
  → 保存到 Library
  → 在 Library 记录平台 / URL / 时间
```

界面上有三个常驻入口：`Studio`、`Mirror`、`Library`。Persona、Changes、Consent 收在右上角 `You` 抽屉里；旧的 `#/persona` `#/ask` `#/write` `#/guard` `#/timeline` `#/consent` 仍可直达，但不再占导航位。

界面支持**中文 / English** 切换：顶栏地球按钮切整个工作台（导航、模式、抽屉、Guard 结论、状态、日期、命令面板），选择写进 `localStorage`；首次访问跟随浏览器语言。笔记原文和生成的草稿保持原本语言。

## 1. 一页总览

```text
pi
├── workspace 宿主插件
│     /mirror → 本地 HTTP 工作台
│     ├── 静态前端 web/
│     ├── GET /api/state      聚合所有已加载插件的状态
│     ├── GET /api/features   当前实际加载了哪些插件
│     └── 分发 /api/* 给对应功能插件；没有插件认领就 404
│
└── 11 个功能插件，各自注册到 feature registry
      vault · persona · ask · write · guard · timeline · library · consent
      research · reference · studio
      每个插件自带：pi 工具 / pi 命令 / API 路由 / state slice / service
```

用户路径：

```text
索引笔记 → 审阅 Persona
        → Studio：目标 → plan → 研究 / 核实 / 参考 → 起草 → Guard → 内容包
        → Mirror：问 / 写 / 查
        → 保存草稿 → Library 审阅 → Consent 授权 → 记录发布
```

核心原则：

- 每个功能都能单独加载；不加载就没有对应路由、入口和数据。Mirror 只组合当前加载的 ask / write / guard，Studio 依赖 research / reference / guard 的 service。
- Studio 不是固定管道：工具是能力，顺序由模型在运行时写进 plan。热点、旧笔记、参考帖、平台变体都走同一套工具。
- 每个回答、每篇草稿都尽量落到来源；没有来源就显式标 `[unknown]` / `[inference]`，Studio 里则要求引用落在 ledger 内。
- 发布不是自动动作，只是记录事实；没有 `publishing` 授权时服务端直接 403。
- 服务只绑定 loopback。研究可以检索公开网页、把查询发给 Bing/Techmeme；不会调用平台发布接口，也不会把笔记上传到远端。

## 2. 插件清单

| 插件 | 用户功能 | Web 视图 | pi 命令 | pi 工具 | HTTP API |
|---|---|---|---|---|---|
| `workspace` | 工作台外壳、启停、状态聚合 | 全局 | `/mirror` `/mirror status` `/mirror stop` | — | `/api/health` `/api/state` `/api/features` |
| `vault` | 索引、检索、读原文、写提案 | — | `/vault <query>` | `vault_index` `vault_search` `note_read` `propose_note` | `/api/search` `/api/note` `/api/index` |
| `persona` | 特质、证据、审阅队列、语气指纹 | Persona | `/persona` | `persona_card` | `/api/persona` `/api/traits/status` |
| `ask` | 第一人称问答、引用、历史 | Ask | `/ask <question>` | — | `/api/ask` `/api/history` |
| `write` | 按 brief 起草、保存草稿 | Write | `/draft <topic>` | — | `/api/write` `/api/drafts` |
| `guard` | 发布前检查 | Guard | `/guard <text>` | `guard_text` | `/api/guard` |
| `timeline` | 立场变化 | Timeline | `/timeline` | — | `/api/timeline` |
| `library` | 草稿状态、发布记录 | Library | `/drafts` | — | `GET/POST /api/publish` `POST /api/drafts/status` |
| `consent` | 四类授权、追加式记录 | Consent | `/consent [scope on\|off]` | — | `GET/POST /api/consent` |
| `research` | 热搜 / 网页搜索 / 读页 / 核实 | —（Studio 内使用） | — | `web_search` `fetch_page` `verify_claim` `trend_scan` | `/api/research/search` `/api/research/fetch` `/api/research/verify` `/api/research/trends` |
| `reference` | 参考帖库、互动指标、结构拆解 | Studio 侧栏 | — | `reference_search` `reference_analyze` | `GET/POST /api/references` `POST /api/references/analyze` |
| `studio` | 目标驱动的内容研究 agent | Studio | — | 13 个工具（plan / research / notes / reference / guard / submit） | `POST/GET /api/studio/runs` `GET /api/studio/run` `POST /api/studio/save` |

加载方式：

```bash
# 全部
pi -e ./src/extension.ts

# 子集：只加载 Ask 和工作台
pi -e ./src/extensions/ask.ts -e ./src/extensions/workspace.ts

# 构建产物
pi -e ./dist/extension.js
```

`package.json` 的 `pi.extensions` 已把 12 个入口拆开（11 个功能插件 + workspace），pi 的资源开关可以逐项启停。

## 3. 界面分层

常驻入口有三个：

| 入口 | 位置 | 作用 |
|---|---|---|
| **Studio** | 左侧导航 | 目标驱动的创作工作台。表单只给目标 / 平台 / 受众；运行后显示 plan、工具轨迹、证据、claim 判定和内容包 |
| **Mirror** | 左侧导航 | 一个对话面。问、写、查共用一条线程；答案、草稿、Guard 结果、引用都在同一处展开 |
| **Library** | 左侧导航 | 草稿状态与发布记录；Library 插件未加载时不出现 |

Studio 的界面状态：

| 状态 | 看到什么 |
|---|---|
| 没有运行 | 目标表单 + 6 个能力卡（明确写「不是固定流水线」）+ 最近运行 + 参考库 |
| 运行中 | 表单收起；plan 逐步勾选，工具轨迹逐条出现，正在调用的工具显示 live |
| 完成 | 内容包在上：标题、角度、why-now、标题候选、正文（引用可点）、claim、备选角度、参考帖、问题、风险、平台变体、Guard；工具轨迹在下 |
| 出错 | 红色错误条；不会伪造内容包。没有 `submit_package` 的运行直接标 error |

其余能力收在右上角 `You` 抽屉：

| 抽屉标签 | 内容 | 完整页 |
|---|---|---|
| **Persona** | trait 列表、置信度、证据条数、审阅入口 | `#/persona` |
| **Changes** | 立场观察/变化，点笔记看原文 | `#/timeline` |
| **Consent** | 四个 scope 开关，追加式记录 | `#/consent` |

Mirror 的三种模式：

| 模式 | 输入 | 输出 |
|---|---|---|
| **问** | 一个问题 | 第一人称回答 + `[n]` 引用；点引用看来源 |
| **写** | topic + 平台 / 受众 / 角度 | 草稿 + 引用 + Guard 摘要；可保存到 Library、展开检查、复制 |
| **查** | 任意文本 | Guard 的引用覆盖率和 high / medium / low findings |

旧的单功能视图仍保留深链：`#/persona` `#/ask` `#/write` `#/guard` `#/timeline` `#/consent`。它们用于调试、书签和完整审阅，不在主导航里。

全局交互：

- 左侧导航只显示 Studio / Mirror / Library；Studio 或 Library 依赖的插件未加载时不显示。
- 顶栏 `You` 打开 Context 抽屉，标签按已加载插件出现；没有 Persona / Timeline / Consent 时按钮隐藏。
- `Ctrl/Cmd K` 命令面板：跳转 Studio / Mirror / Library；打开 Context 三个标签；搜索笔记（需要 `vault`）；重建索引（需要 `vault`）；重读状态；审阅候选。
- 顶栏 model chip 读取 pi 的默认模型；没有模型时提示不可用。
- 顶栏地球按钮切换中文 / English；日期、状态、Guard 标题与细节、命令面板提示同步切换，选择跨刷新保留。
- 1440 与 390 宽度均可用；移动端顶部导航横向滚动，Mirror 输入区始终可见。

## 4. 端到端流程

### 索引

```text
POST /api/index
  → indexVault()             Markdown 分块、去 frontmatter、保留 offset
  → ensureProfile()          建立默认 persona profile
  → extractTraits()          规则抽取 value / stance / taboo / goal + evidence
  → computeVoiceStats()      句长、问句率、感叹率、第一人称、列表占比等
```

### Studio

```text
目标 + 平台 + 受众
  → POST /api/studio/runs
  → createRun() 写 studio_runs(status=queued)
  → runtime.startStudio() 抢单运行锁（并发 429）
  → runStudioAgent() 新建独立 pi AgentSession
      ├── update_plan            plan_json
      ├── trend_scan             本地 demo/trends + Techmeme RSS
      ├── web_search / fetch_page Bing HTML + 公开网页（SSRF 检查）
      ├── verify_claim           域名数 + 支持/反证 → claim 状态
      ├── note_search/read/recent/stance_history
      ├── reference_search/analyze
      ├── guard_text             对当前正文跑 Guard，记录 hash
      └── submit_package         校验 citation / guard / claim / 参考相似度
  → studio_steps 每一步 tool_call_id ↔ seq
  → 前端 GET /api/studio/run?id= 轮询，实时渲染 plan / trace / sources / package
  → 完成：studio_packages + studio_runs.status=done
  → 用户点保存 → POST /api/studio/save → drafts
```

校验失败时 `submit_package` 返回错误清单，agent 继续修；运行结束仍没有 accepted package 就标 error。这样「没做完」不会变成一篇看起来完成的假稿。

### Ask

```text
问题
  → POST /api/ask
  → runtime.ask() 抢 busy 锁（并发时 429）
  → askPersona() 新建独立 pi AgentSession
      ├── vault_search
      ├── note_read
      └── persona_card
  → 全局引用账本给来源编号 [1]…[n]
  → 引用为 0 或密度 < 0.2 时补一轮 repair
  → 写入内存 history
  → 返回 answer + sources + model
```

### Write

```text
表单
  → composeBrief() 生成英文 brief
  → POST /api/write
  → draftAsPersona() 新建独立 AgentSession
  → agent 必须调用 submit_draft(markdown) 提交终稿
  → 对终稿跑 Guard
  → 用户点保存 → POST /api/drafts → drafts 表
```

### Guard

```text
文本
  → guardWithDb() 读取 trait + voice
  → guardText()
  → 返回 high / medium / low findings + 引用覆盖率
```

### 发布

```text
Library → 记录发布
  → POST /api/publish
  → 通过 service("consent") 读取 Consent 插件
  → 未加载 Consent 或 publishing=false → 403
  → 写入 publish_records
  → drafts.status = published
```

### 插件组合

```text
GET /api/features
  → 只返回已加载插件
GET /api/state
  → meta + counts + 各插件 state() 的合并结果
GET /api/persona（persona 未加载）
  → 404 No loaded feature plugin handles GET /api/persona
```

## 5. Persona Guard 规则

| 检查 | severity | 触发条件 |
|---|---|---|
| `absolute-claims` | high | 命中「所有人 / 一定 / 必然 / 100% / 毫无疑问」等绝对化词 |
| `taboo-tension` | high | 有绝对化表达，且 persona 声明了 taboo |
| `unsupported-claims` | high（>2 句） / medium | 句子里有论断词，但没有 `[n]` 或 `[inference]` / `[unknown]` |
| `unbacked-narrative` | high | 第一人称 + 过去叙事词（以前 / 那年 / 曾经…），且没有数字引用 |
| `style-distance` | high（≥30 字） / medium（≥18 字） | 平均句长与库内均值差距过大 |
| `exclaim-rate` | low | 感叹号占句子数 > 15% |
| `disputed-claim` | high | 正文里出现的 claim 被来源标为 disputed |
| `unverified-claim` | high | claim 没有可靠来源 |
| `single-source` | medium | claim 只落在一个来源上 |
| `stale-claim` | medium | claim 对「今天」的稿子已经太旧 |
| `citation-coverage` | high（<25%） / medium（<50%） | 带引用或标记的句子占比过低 |

## 6. 数据地图

当前产品实际读写：

| 表 | 用途 |
|---|---|
| `notes` `chunks` | 笔记索引与 FTS5 检索 |
| `persona_profiles` `persona_traits` `persona_trait_evidence` | persona 与证据 |
| `voice_features` | 语气统计 |
| `stance_events` | 立场事件；为空时 Timeline 回退到 observed trait |
| `briefs` `drafts` | 写作 brief 与草稿 |
| `publish_records` | 发布事实 |
| `consent_records` | 追加式授权 |
| `write_proposals` | 经 diff + hash 校验的写入门禁 |
| `studio_runs` `studio_steps` | 每次 Studio 运行的目标、plan、状态与工具轨迹 |
| `studio_sources` `studio_claims` | 每次运行的编号证据与 claim 判定 |
| `studio_packages` | 通过校验的内容包版本 + Guard 报告 |
| `reference_notes` | 参考帖正文、平台、作者、互动指标、结构分析 |

Schema 已建但当前 UI 未接入：`sources` `note_links` `claims` `claim_links` `draft_claims` `assets` `voice_profiles` `voice_samples` `eval_runs` `redaction_runs` `voice_evals` `turing_trials` `app_settings`。

本地状态默认在运行目录的 `.pi-mirror/pi-mirror.db`。数据库是可重建索引，笔记原文才是权威。

## 7. 插件机制

```ts
interface FeaturePlugin {
  id; label; zh; icon; order; nav; description;
  tools; commands;                    // 展示与文档
  routes(runtime): FeatureRoute[];    // 自己的 HTTP API
  state?(runtime): object;            // 合并进 /api/state
  services?(runtime): Record<string, unknown>; // 给别的插件用
}
```

- 插件在 extension 默认导出函数里调用 `registerFeature()`；注册表放在 `globalThis`，jiti 重载后按 id 覆盖，不会重复。
- 宿主 `workspace` 启动时读取注册表，展开路由、收集 service、合并 state；重复的 `METHOD /path` 或重复 service 名会直接启动失败。
- 功能之间不互相 import；跨功能协作走 service。`library` 只认识 `ConsentService` 接口，不认识 Consent 插件实现。
- 宿主路由永远存在：`/api/state`、`/api/features`、`/api/health`、静态文件。
- 任何一个功能缺失，只会少掉它自己的路由和导航项。

## 8. 安全边界

- 只绑定 `127.0.0.1`；Host 必须是 localhost / 127.0.0.1 / [::1] 对应当前端口。
- CSP `default-src 'self'`，`frame-ancestors 'none'`，`x-frame-options: DENY`，无 CORS 头。
- 笔记读取有路径逃逸检查；产品不直接改笔记，写入走 `propose_note` + diff + hash 校验。
- 不存 API key；Ask/Write/Studio 复用 pi 自己的模型配置。
- 不自动发布、不调用平台发布接口。研究阶段会向 Bing/Techmeme 发送搜索词并抓取公开页面；SSRF 检查只允许 http/https，拒绝 localhost 与私网地址。
- 发布需要 `publishing` 授权；Consent 插件未加载时按关闭处理。

## 9. 当前边界

**已可用**

- 11 个独立 pi 插件；Studio + Mirror + Library 三个常驻入口，Persona / Changes / Consent 收进 `You` 抽屉；旧视图保留深链。
- Studio 目标驱动运行：plan、工具轨迹、编号证据、claim 判定、Guard 循环、内容包、保存草稿。
- 研究链路：本地热点包 + Techmeme RSS、Bing 搜索、公开网页读取、SSRF 防护、来源域名还原、claim 状态。
- 参考帖库：互动指标、粉丝层级、结构拆解、4-gram Jaccard 近似检测。
- 中文长查询检索修复、全局引用编号、引用 repair、`submit_draft` 确定性终稿。
- Persona 证据链与审阅、Guard 十一类检查、追加式 consent、草稿与发布记录。
- 中文 / English 双语界面，含 Studio、Guard 结论本地化与语言偏好持久化。
- 37 条测试；源码与构建产物均通过 pi RPC 加载；全量与子集组合都验证过。

**部分可用**

- Timeline 依赖 `stance_events`，当前 demo 主要显示 observed traits。
- Trait 审阅 UI 只有 Confirm / Reject，`outdated` 只有 API。
- 发布只记录事实，不校验链接可访问，不拉平台数据。
- `modeling` / `drafting` / `demo` 三个 consent scope 目前只是记录，不影响行为。
- 研究搜索走 Bing HTML，没有搜索 API key；X.com 登录墙内的内容由本地 `demo/trends` 热点包或手动参考帖补齐。
- 参考帖指标由导入者填写；不知道就留空，不推断粉丝数或点赞数。

**未实现**

- LLM trait 抽取与更大的审阅队列。
- 脱敏真实库、泄漏扫描、公开只读 demo。
- 评测集（citation coverage、忠实度、「像我」评分）。
- 登录/多用户（当前设计就是单机单人）。
- 流式输出、多轮改写、平台发布 API。
- 多 profile / 多人格。

## 10. 文件地图

```text
src/
├── extension.ts                 一次加载全部插件的聚合入口
├── extensions/
│   ├── workspace.ts             宿主：/mirror、静态资源、启停
│   ├── vault.ts                 索引 / 检索 / 读笔记 / 写提案
│   ├── persona.ts               trait + evidence + 审阅
│   ├── ask.ts                   第一人称问答 + 历史
│   ├── write.ts                 brief → 草稿 → 保存
│   ├── guard.ts                 发布前检查
│   ├── timeline.ts              立场变化
│   ├── library.ts               草稿状态 + 发布记录
│   ├── consent.ts               授权账本 + consent service
│   ├── research.ts              搜索 / 读页 / 核实 / 热点 API
│   ├── reference.ts             参考帖库与结构分析 API
│   └── studio.ts                运行创建、查询与保存草稿
├── features/
│   ├── contract.ts              插件契约
│   ├── registry.ts              globalThis 注册表
│   ├── helpers.ts               校验、brief、草稿创建
│   └── all.ts                   给 dev harness / 测试的静态组合
├── studio/
│   ├── agent.ts                 Studio 的 pi AgentSession + 13 个工具
│   ├── research.ts              Bing / 读页 / RSS / 热点包 / claim 判定
│   ├── reference.ts             参考帖分析、互动分、相似度
│   ├── store.ts                 run / step / source / claim / package 读写
│   ├── validate.ts              引用、Guard、claim、近似度校验
│   ├── services.ts              research / reference service
│   └── types.ts                 内容包与运行类型
├── persona/
│   ├── agent.ts                 Ask/Write 的 pi AgentSession
│   ├── guard.ts                 Guard 规则
│   ├── guard-db.ts              Guard + 数据库
│   ├── extract.ts               规则 trait 抽取 + 语气统计
│   └── card.ts                  persona card 渲染
├── server/
│   ├── app.ts                   HTTP 宿主、状态聚合、路由分发
│   ├── data.ts                  SQLite 读取/写入
│   └── index.ts                 `npm run serve` 开发壳
├── vault/                       索引、检索、写提案
├── tools/vault-tools.ts         pi 工具定义
└── db/                          schema、连接、迁移
web/                             index.html / styles.css / app.js / i18n.js
tests/                           vault / persona / guard / server / features
```

## 11. 验证现状

```bash
npm run typecheck   # 通过
npm test            # 37 tests / 8 files
npm run build       # tsc + 复制 schema 与 web 到 dist
```

RPC 实测：

- 全量 12 个 `-e`：`/api/features` 返回 11 个功能；`/mirror` 启停、`session_shutdown` 关闭正常。
- 只加载 `ask + workspace`：`/api/features` 仅 `["ask"]`；`/api/persona` 404；UI 导航只剩 Ask。
- `/consent` `/vault` `/persona` 在 pi TUI 内独立可用，不依赖 Web 工作台。
