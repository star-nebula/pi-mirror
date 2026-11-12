/* Pi-Mirror UI language pack. Source strings double as keys; a table only
   needs the opposite language. Add both when a string exists in neither. */
(function () {
  const ZH = {
    "personal agent": "个人 agent",
    "Pi-Mirror home": "Pi-Mirror 首页",
    Workspace: "工作区",
    You: "你",
    Search: "搜索",
    "Search notes and commands": "搜索笔记与命令",
    Detail: "详情",
    Close: "关闭",
    "Search and commands": "搜索与命令",
    Language: "语言",
    "Open your context": "打开你的上下文",
    Mirror: "镜像",
    "Knowledge base": "知识库",
    "Your knowledge base": "你的知识库",
    Library: "作品库",
    Persona: "身份",
    Ask: "问",
    Write: "写",
    Guard: "检查",
    Check: "查",
    Timeline: "变化",
    Consent: "授权",
    Drafts: "草稿",
    Published: "已发布",
    Open: "打开",
    Copy: "复制",
    Clear: "清空",
    Saved: "已保存",
    "your agent": "你的 agent",
    "drafts & publishing": "草稿与发布",
    "identity model": "身份模型",
    "answer as you": "以我回答",
    "draft as you": "以我起草",
    "pre-publish check": "发布前检查",
    "how you changed": "观点变化",
    boundaries: "授权边界",
    "vault": "知识库",
    unavailable: "不可用",
    "loading…": "加载中…",
    notes: "笔记",
    traits: "特质",
    evidence: "证据",
    "demo vault": "演示库",
    plugins: "插件",
    "notes read-only": "笔记只读",
    "pi · no model": "pi · 无模型",
    "Configure a default model in pi to enable Ask and Write.":
      "在 pi 中配置默认模型后即可使用问与写。",
    "Personal agent · local notes only": "个人 agent · 只读本地笔记",
    "问、写、查都在这里。它只读你的笔记，每个回答都能点回来源。":
      "Ask, write, and check in one place. It reads only your notes, and every answer links back to its source.",
    "还没有可以对话的能力": "No conversation capability loaded",
    "知识库需要 ask、write 或 guard 插件之一。当前只加载了其他插件。":
      "Knowledge base needs the ask, write, or guard plugin. Only other plugins are loaded right now.",
    "重新读取插件": "Reload plugins",
    "Start here": "从这里开始",
    "先给我一份你的笔记": "Give me your notes first",
    "默认读取 <code>demo/vault</code>。索引之后，我才能以你的口吻回答、起草和检查。要换成自己的库，把 <code>PI_MIRROR_VAULT</code> 指向脱敏后的目录。":
      "Reads <code>demo/vault</code> by default. Once indexed, I can answer, draft, and check in your voice. To use your own vault, point <code>PI_MIRROR_VAULT</code> at a desensitized directory.",
    "Index demo vault": "索引演示库",
    "想写什么？一句 topic 就够。": "What do you want to write? A topic is enough.",
    "粘贴准备发布的文字…": "Paste the text you plan to publish…",
    "问一个只有你的笔记能回答的问题…": "Ask a question only your notes can answer…",
    "起草": "Draft",
    "检查": "Check",
    "发送": "Send",
    "平台": "Platform",
    "写给谁": "Audience",
    "角度": "Angle",
    "例如：做 AI 产品的人": "e.g. people building AI products",
    "例如：反常识，但从证据出发": "e.g. counterintuitive, but evidence-first",
    Mode: "模式",
    "需要 {id} 插件": "requires the {id} plugin",
    "新对话": "New conversation",
    "处理中": "Working…",
    "Enter {label} · Shift + Enter 换行 · 每轮由独立 pi AgentSession 生成":
      "Enter to {label} · Shift + Enter for a new line · each turn runs in its own pi AgentSession",
    "问一个只有你的笔记能回答的问题": "Ask a question only your notes can answer",
    "我会先检索笔记，再以第一人称回答；引用编号可以点回原文。":
      "I search your notes first, then answer in the first person. Citation numbers link back to the source.",
    "给我一个 topic，我以你的口吻起草": "Give me a topic and I'll draft in your voice",
    "会先检索，再动笔；写完后可以直接看 Guard 检查，或保存到 Library。":
      "I search first, then write. Afterward you can run Guard or save it to Library.",
    "贴一段准备发布的文字": "Paste the text you plan to publish",
    "我会检查绝对化措辞、无引用断言、句长偏离和引用覆盖率。":
      "I check absolute wording, unsupported claims, sentence-length drift, and citation coverage.",
    "我最近在反复思考什么？": "What have I been thinking about lately?",
    "我对知识管理的核心判断是什么？": "What is my core view on knowledge management?",
    "我写东西时坚持什么、拒绝什么？": "What do I insist on and refuse when I write?",
    "为什么我不再追热点": "Why I stopped chasing hot takes",
    "我怎么判断一个 AI 产品值不值得用": "How I decide whether an AI product is worth using",
    "我这一年对「慢」的理解": "What slowness has meant to me this year",
    "Enter 提交 · Shift + Enter 换行": "Enter to submit · Shift + Enter for a new line",
    draft: "草稿",
    guard: "检查",
    "保存到 Library": "Save to Library",
    "已保存": "Saved",
    "收起检查": "Hide check",
    "查看检查": "View check",
    "复制": "Copy",
    "先贴一段文字。": "Paste some text first.",
    "先写一个 topic。": "Write a topic first.",
    "先写一个问题。": "Write a question first.",
    "这个模式需要的插件没有加载。": "The plugin for this mode is not loaded.",
    "草稿已保存到 Library。": "Draft saved to Library.",
    "检索笔记中": "Searching notes…",
    "Sources · {n}": "来源 · {n}",
    "Open full note": "打开全文",
    "Note · read-only": "笔记 · 只读",
    "Search result": "搜索结果",
    "Source · {n}": "来源 · {n}",
    "Identity model": "身份模型",
    "这个工作区还没有索引笔记。Pi-Mirror 只读 Markdown，索引与提炼都在本机完成。":
      "This workspace has no indexed notes yet. Pi-Mirror reads Markdown only; indexing and extraction happen on this machine.",
    "先给「你」一份材料": "Give “you” some material first",
    "已有 {n} 篇笔记，但还没有 persona 模型。": "There are {n} notes, but no persona model yet.",
    "One step left": "还差一步",
    "从笔记里提炼 persona": "Extract a persona from your notes",
    "会抽取 values / stances / taboos / goals，并为每一条记录证据句；语气统计也会一起更新。":
      "Extracts values, stances, taboos, and goals, records evidence for each, and updates voice stats.",
    "Build persona": "构建 persona",
    "All {n}": "全部 {n}",
    "Candidates {n}": "候选 {n}",
    Values: "价值",
    Stances: "立场",
    Taboos: "禁忌",
    Goals: "目标",
    Preferences: "偏好",
    Biography: "经历",
    Voice: "语气",
    "这个筛选下没有 trait": "No traits under this filter",
    "换一个分类，或重新索引。": "Try another category or re-index.",
    "重建索引": "重建索引",
    "{name} · v{version} · {traits} 条特质，{evidence} 条证据，来自 {notes} 篇笔记。":
      "{name} · v{version} · {traits} traits, {evidence} evidence, from {notes} notes.",
    "Trait map": "特质地图",
    "点开任意一条，查看它来自哪句话。": "Open any trait to see the sentence it came from.",
    "Voice fingerprint": "语气指纹",
    "来自 {n} 个句子。": "From {n} sentences.",
    Coverage: "覆盖",
    "每条结论都要能回到原文。": "Every claim must trace back to its source.",
    Notes: "笔记",
    Chunks: "片段",
    Traits: "特质",
    Evidence: "证据",
    "Last indexed": "上次索引",
    "Review queue": "待审队列",
    "{candidates} candidate · {confirmed} confirmed": "{candidates} 候选 · {confirmed} 已确认",
    "候选 trait 带着状态进入卡片；对外发布前请逐条确认。确认或拒绝会写回本地库。":
      "Candidate traits enter cards with a status. Confirm each before publishing externally. Confirm or reject writes back to the local database.",
    "Review candidates": "审阅候选",
    "{n} evidence": "{n} 条证据",
    "{n} sentences": "{n} 句",
    "{n} observations": "{n} 次观察",
    "{n} lines": "{n} 行",
    confirmed: "已确认",
    candidate: "候选",
    high: "高",
    medium: "中",
    cited: "带引用",
    Evidence: "证据",
    "no note path": "没有笔记路径",
    "没有证据": "No evidence",
    "这条不该被当作结论。": "This should not be treated as a conclusion.",
    Confirm: "确认",
    Reject: "拒绝",
    "Reset to candidate": "重置为候选",
    "{n}% confidence": "{n}% 置信度",
    "polarity {n}": "极性 {n}",
    "Trait 已标记为 {status}": "Trait marked as {status}",
    "Open full Persona": "打开完整身份模型",
    Identity: "身份",
    "· 每条结论都能回到原文。": "every claim traces back to its source.",
    "每条结论都能回到原文。": "every claim traces back to its source.",
    "to review": "待审",
    "还没有 trait": "No traits yet",
    "重新索引会让候选出现。": "Re-index to surface candidates.",
    "还没有索引笔记": "No notes indexed yet",
    "先索引一次，才会有 persona。": "Index once to build a persona.",
    "还没有 persona 模型": "No persona model yet",
    "已有 {n} 篇笔记，提炼一次就能开始审阅。": "There are {n} notes. Extract once to start reviewing.",
    "Grounded answers": "有据回答",
    "第一人称回答，逐句引用笔记。没有依据的地方会标成 unknown，而不是编一个答案。":
      "First-person answers with sentence-level citations. Anything unsupported is marked unknown instead of invented.",
    "清空对话": "清空对话",
    Question: "问题",
    "Pi-Mirror 会先检索笔记，再以第一人称回答；引用编号可以点回原文。":
      "Pi-Mirror searches your notes first, then answers in the first person. Citation numbers link back to the source.",
    "没有匹配": "没有匹配",
    "换个关键词，或直接搜索笔记内容。": "换个关键词，或直接搜索笔记内容。",
    "Draft in your voice": "以你的口吻起草",
    "先检索，再动笔。草稿会带句子级引用；写完后可以直接丢进 Guard 检查。":
      "Search first, then write. Drafts carry sentence-level citations and can go straight into Guard.",
    "新草稿": "新草稿",
    Brief: "简报",
    "越具体，越容易写出你自己的判断。": "The more specific, the easier it is to write your own judgment.",
    Topic: "主题",
    Platform: "平台",
    Audience: "读者",
    Angle: "角度",
    Points: "要点",
    "一行一个要点。没有也可以，会从笔记里找。":
      "One point per line. Optional; I'll find them in your notes.",
    "会先调用 vault_search，再写。<br />没有依据的段落会标 unknown。":
      "Calls vault_search first, then writes.<br />Unsupported passages are marked unknown.",
    "Draft as me": "以我起草",
    Draft: "草稿",
    "pi AgentSession 正在检索并起草…": "pi AgentSession is searching and drafting…",
    "结果会出现在这里，并带着引用和 Guard 摘要。":
      "The result appears here with citations and a Guard summary.",
    "检索": "检索",
    "先在本地 SQLite 里找相关笔记，中文 1–2 字查询会走 LIKE 兜底。":
      "Find relevant notes in local SQLite; 1–2 character Chinese queries fall back to LIKE.",
    "以第一人称写，事实句带 [n] 引用，推断标 inference。":
      "Write in the first person; factual sentences carry [n] citations, inferences are marked inference.",
    "Guard 会看绝对化措辞、无引用断言、句长偏离和引用覆盖率。":
      "Guard checks absolute wording, unsupported claims, sentence-length drift, and citation coverage.",
    "Draft failed": "起草失败",
    "请求没有完成。": "The request did not finish.",
    "{n} sentences": "{n} 句",
    "在 Guard 中检查": "在 Guard 中检查",
    "Before you publish": "发布之前",
    "发布前的一道机械检查：绝对化措辞、无引用断言、句长偏离、引用覆盖率。它不做审美判断。":
      "A mechanical pre-publish check: absolute wording, unsupported claims, sentence-length drift, citation coverage. It makes no aesthetic judgment.",
    Text: "文本",
    "草稿、回复、帖子都行。": "Drafts, replies, posts — anything.",
    "{n} 字": "{n} characters",
    "粘贴要检查的文本…": "Paste text to check…",
    "基于 {n} 条 trait 和 {m} 项语气特征。": "Based on {n} traits and {m} voice features.",
    "清空": "清空",
    "Run guard": "运行检查",
    Report: "报告",
    "按严重程度排序。": "Sorted by severity.",
    "结果会出现在这里。": "The report appears here.",
    "还没有检查结果": "No check yet",
    "贴一段草稿，或在知识库里写完后点「查看检查」。":
      "Paste a draft, or write in the knowledge base and choose “View check”.",
    "{coverage}% 句子带引用或标注 · {sentences} 句 · {findings} 项发现":
      "{coverage}% of sentences cited or marked · {sentences} sentences · {findings} findings",
    "没有自动发现的问题": "No automatic findings",
    "这不等同于可以发布。Guard 只看可计算的部分。":
      "This does not mean it's ready to publish. Guard only sees what can be computed.",
    "先贴一段文本。": "Paste some text first.",
    "How you changed": "你如何变化",
    "目前显示的是单次观察到的立场。同一话题再次出现、极性变化时，这里会开始显示「变化」。":
      "This shows single observations so far. When a topic reappears with a different polarity, changes will appear here.",
    "同一话题的立场变化，按观察时间排列。": "Stance changes on the same topic, ordered by observation time.",
    "{n} observations": "{n} 次观察",
    "还没有立场记录": "No stance records yet",
    "等笔记里出现可识别的 stance 句，或把 stance_events 写进库。":
      "Wait for recognizable stance sentences in your notes, or write stance_events into the database.",
    "Changes over time": "随时间的变化",
    "目前是单次观察；同一话题再次出现、极性变化时，这里会显示「变化」。":
      "These are single observations; when a topic reappears with a different polarity, changes will show here.",
    "按观察时间排列。": "Ordered by observation time.",
    "Open full Timeline": "打开完整变化",
    "What you made": "你做了什么",
    "草稿与发布记录都在本地。Pi-Mirror 不代你发帖，只记录事实。":
      "Drafts and publish records stay local. Pi-Mirror never posts for you; it records facts.",
    "New draft": "新建草稿",
    Drafts: "草稿",
    "{n} 篇 · 点开查看全文与状态。": "{n} drafts · open one to see the full text and status.",
    Published: "已发布",
    "{n} 条记录。": "{n} records.",
    "还没有草稿": "No drafts yet",
    "回到知识库写一篇，然后保存到这里。": "Go back to the knowledge base, write one, and save it here.",
    Link: "链接",
    "打开": "打开",
    "还没有发布记录": "No publish records yet",
    "在草稿里记录平台和链接；这会同时写入本地 publish_records。":
      "Record the platform and link in a draft; this also writes to local publish_records.",
    "{n} 句": "{n} sentences",
    "Draft · {platform}": "草稿 · {platform}",
    "Mark reviewed": "标记为已审阅",
    Approve: "通过",
    "复制全文": "复制全文",
    "Record a publish": "记录发布",
    "Publishing 授权当前关闭。先去 Consent 打开，再记录发布。":
      "Publishing consent is off. Turn it on in Consent, then record the publish.",
    "Open Consent": "打开授权",
    "发布需要 Consent 插件。当前只加载了 Library，记录发布会被服务端拒绝。":
      "Publishing needs the Consent plugin. Only Library is loaded, so the server will reject publish records.",
    "Mark published": "标记为已发布",
    "草稿状态更新为 {status}": "Draft status updated to {status}",
    "已记录发布事实。": "Publish recorded.",
    Boundaries: "边界",
    "每个 scope 都由你显式开关。关闭 publishing 时，发布接口会直接拒绝，而不是静默跳过。":
      "Every scope is an explicit switch. When publishing is off, the publish endpoint rejects the request instead of silently skipping it.",
    Scopes: "范围",
    "记录是追加式的：每次开启或撤回都会留下时间线，而不是覆盖旧值。":
      "Records are append-only: every grant or revocation leaves a timeline instead of overwriting the old value.",
    "What this app will never do": "这个应用永远不会做的事",
    "写入你的笔记": "写入你的笔记",
    "不会": "不会",
    "自动发帖或调用平台发布接口": "自动发帖或调用平台发布接口",
    "在没有 publishing 授权时标记已发布": "在没有 publishing 授权时标记已发布",
    "把 API key 或 token 写进库": "把 API key 或 token 写进库",
    "granted {time}": "开启于 {time}",
    "revoked {time}": "撤回于 {time}",
    "not granted yet": "尚未开启",
    "已开启 {scope}": "已开启 {scope}",
    "已撤回 {scope}": "已撤回 {scope}",
    "Your context": "你的上下文",
    "What Pi-Mirror knows": "Pi-Mirror 知道什么",
    Changes: "变化",
    "Open full Consent": "打开完整授权",
    "Boundaries": "边界",
    "只有 publishing 会在服务端硬性生效。每次开关都追加一条记录，不覆盖历史。":
      "Only publishing is enforced server-side. Every switch appends a record instead of overwriting history.",
    Navigate: "导航",
    Context: "上下文",
    Actions: "操作",
    Notes: "笔记",
    "身份、证据与审阅": "身份、证据与审阅",
    "立场随时间的变化": "立场随时间的变化",
    "四类授权边界": "四类授权边界",
    "Re-index vault": "重建索引",
    "重建索引、traits 与语气统计": "重建索引、traits 与语气统计",
    "Reload workspace": "重新加载工作区",
    "重新读取本地状态与草稿": "重新读取本地状态与草稿",
    "只看未确认的 trait": "只看未确认的 trait",
    "Ask a question": "问一个问题",
    "回到知识库的问": "回到知识库的问",
    "正在索引并提炼 persona…": "正在索引并提炼 persona…",
    "索引 {files} 篇 / {chunks} 段 · 新增 {traits} 条 trait":
      "索引 {files} 篇 / {chunks} 段 · 新增 {traits} 条 trait",
    "已复制。": "已复制。",
    "复制失败，请手动选择文本。": "复制失败，请手动选择文本。",
    "No model available": "没有可用模型",
    "Request failed": "请求失败",
    "pi 没有可用模型。先在 pi 中配置 provider 与 default model（<code>settings.json</code>），再重试。":
      "pi has no available model. Configure a provider and default model in pi (<code>settings.json</code>), then retry.",
    "连不上 Pi-Mirror 服务": "连不上 Pi-Mirror 服务",
    "重试": "重试",
    "这个页面需要的插件没有加载": "这个页面需要的插件没有加载",
    "还没有加载功能插件": "还没有加载功能插件",
    "知识库会组合当前加载的能力；这个页面依赖的插件不在列表里。可以在 pi 配置里单独启用它。":
      "知识库会组合当前加载的能力；这个页面依赖的插件不在列表里。可以在 pi 配置里单独启用它。",
    "用 pi 加载 src/extensions 下的插件，或运行 pi -e ./src/extension.ts 一次加载全部。":
      "用 pi 加载 src/extensions 下的插件，或运行 pi -e ./src/extension.ts 一次加载全部。",
    "还没有可以对话的能力": "还没有可以对话的能力",
    "Publish recorded.": "已记录发布事实。",
    "Draft status updated to {status}": "草稿状态更新为 {status}",
    "Trait marked as {status}": "Trait 已标记为 {status}",
    "Granted {scope}": "已开启 {scope}",
    "Revoked {scope}": "已撤回 {scope}",
    "Indexed {files} notes / {chunks} chunks · {traits} new traits":
      "索引 {files} 篇 / {chunks} 段 · 新增 {traits} 条 trait",
  };

  const EN = {
    "个人 agent": "personal agent",
    "Pi-Mirror 首页": "Pi-Mirror home",
    工作区: "Workspace",
    你: "You",
    搜索: "Search",
    "搜索笔记与命令": "Search notes and commands",
    详情: "Detail",
    关闭: "Close",
    "搜索与命令": "Search and commands",
    语言: "Language",
    "打开你的上下文": "Open your context",
    镜像: "Mirror",
    作品库: "Library",
    身份: "Persona",
    问: "Ask",
    写: "Write",
    检查: "Guard",
    变化: "Timeline",
    授权: "Consent",
    你的: "your",
    "你的 agent": "your agent",
    草稿与发布: "drafts & publishing",
    身份模型: "identity model",
    以我回答: "answer as you",
    以我起草: "draft as you",
    发布前检查: "pre-publish check",
    观点变化: "how you changed",
    授权边界: "boundaries",
    知识库: "Knowledge base",
    不可用: "unavailable",
    "加载中…": "loading…",
    笔记: "notes",
    特质: "traits",
    证据: "evidence",
    演示库: "demo vault",
    插件: "plugins",
    笔记只读: "notes read-only",
    "pi · 无模型": "pi · no model",
    "在 pi 中配置默认模型后即可使用问与写。":
      "Configure a default model in pi to enable Ask and Write.",
    "个人 agent · 只读本地笔记": "Personal agent · local notes only",
    "还没有可以对话的能力": "No conversation capability loaded",
    "知识库需要 ask、write 或 guard 插件之一。当前只加载了其他插件。":
      "Knowledge base needs the ask, write, or guard plugin. Only other plugins are loaded right now.",
    重新读取插件: "Reload plugins",
    从这里开始: "Start here",
    "先给我一份你的笔记": "Give me your notes first",
    "索引演示库": "Index demo vault",
    "想写什么？一句 topic 就够。": "What do you want to write? A topic is enough.",
    "粘贴准备发布的文字…": "Paste the text you plan to publish…",
    "问一个只有你的笔记能回答的问题…": "Ask a question only your notes can answer…",
    起草: "Draft",
    发送: "Send",
    平台: "Platform",
    写给谁: "Audience",
    角度: "Angle",
    "例如：做 AI 产品的人": "e.g. people building AI products",
    "例如：反常识，但从证据出发": "e.g. counterintuitive, but evidence-first",
    模式: "Mode",
    "需要 {id} 插件": "requires the {id} plugin",
    新对话: "New conversation",
    处理中: "Working…",
    "问一个只有你的笔记能回答的问题": "Ask a question only your notes can answer",
    "我会先检索笔记，再以第一人称回答；引用编号可以点回原文。":
      "I search your notes first, then answer in the first person. Citation numbers link back to the source.",
    "给我一个 topic，我以你的口吻起草": "Give me a topic and I'll draft in your voice",
    "会先检索，再动笔；写完后可以直接看 Guard 检查，或保存到 Library。":
      "I search first, then write. Afterward you can run Guard or save it to Library.",
    "贴一段准备发布的文字": "Paste the text you plan to publish",
    "我会检查绝对化措辞、无引用断言、句长偏离和引用覆盖率。":
      "I check absolute wording, unsupported claims, sentence-length drift, and citation coverage.",
    "我最近在反复思考什么？": "What have I been thinking about lately?",
    "我对知识管理的核心判断是什么？": "What is my core view on knowledge management?",
    "我写东西时坚持什么、拒绝什么？": "What do I insist on and refuse when I write?",
    "为什么我不再追热点": "Why I stopped chasing hot takes",
    "我怎么判断一个 AI 产品值不值得用": "How I decide whether an AI product is worth using",
    "我这一年对「慢」的理解": "What slowness has meant to me this year",
    "Enter 提交 · Shift + Enter 换行": "Enter to submit · Shift + Enter for a new line",
    草稿: "draft",
    保存到作品库: "Save to Library",
    已保存: "Saved",
    收起检查: "Hide check",
    查看检查: "View check",
    复制: "Copy",
    "先贴一段文字。": "Paste some text first.",
    "先写一个 topic。": "Write a topic first.",
    "先写一个问题。": "Write a question first.",
    "这个模式需要的插件没有加载。": "The plugin for this mode is not loaded.",
    "草稿已保存到 Library。": "Draft saved to Library.",
    检索笔记中: "Searching notes…",
    "Open full note": "Open full note",
    "Note · read-only": "Note · read-only",
    "Search result": "Search result",
    "Identity model": "Identity model",
    "这个工作区还没有索引笔记。Pi-Mirror 只读 Markdown，索引与提炼都在本机完成。":
      "This workspace has no indexed notes yet. Pi-Mirror reads Markdown only; indexing and extraction happen on this machine.",
    "先给「你」一份材料": "Give “you” some material first",
    "已有 {n} 篇笔记，但还没有 persona 模型。": "There are {n} notes, but no persona model yet.",
    "还差一步": "One step left",
    "从笔记里提炼 persona": "Extract a persona from your notes",
    "会抽取 values / stances / taboos / goals，并为每一条记录证据句；语气统计也会一起更新。":
      "Extracts values, stances, taboos, and goals, records evidence for each, and updates voice stats.",
    "构建 persona": "Build persona",
    "全部 {n}": "All {n}",
    "候选 {n}": "Candidates {n}",
    价值: "Values",
    立场: "Stances",
    禁忌: "Taboos",
    目标: "Goals",
    偏好: "Preferences",
    经历: "Biography",
    语气: "Voice",
    "这个筛选下没有 trait": "No traits under this filter",
    "换一个分类，或重新索引。": "Try another category or re-index.",
    "重建索引": "Re-index",
    "特质地图": "Trait map",
    "点开任意一条，查看它来自哪句话。": "Open any trait to see the sentence it came from.",
    "语气指纹": "Voice fingerprint",
    "来自 {n} 个句子。": "From {n} sentences.",
    覆盖: "Coverage",
    "每条结论都要能回到原文。": "Every claim must trace back to its source.",
    笔记: "Notes",
    片段: "Chunks",
    特质: "Traits",
    证据: "Evidence",
    上次索引: "Last indexed",
    待审队列: "Review queue",
    "候选 trait 带着状态进入卡片；对外发布前请逐条确认。确认或拒绝会写回本地库。":
      "Candidate traits enter cards with a status. Confirm each before publishing externally. Confirm or reject writes back to the local database.",
    审阅候选: "Review candidates",
    "没有笔记路径": "no note path",
    "没有证据": "No evidence",
    "这条不该被当作结论。": "This should not be treated as a conclusion.",
    确认: "Confirm",
    拒绝: "Reject",
    "重置为候选": "Reset to candidate",
    "打开完整身份模型": "Open full Persona",
    "还没有 trait": "No traits yet",
    "重新索引会让候选出现。": "Re-index to surface candidates.",
    "还没有索引笔记": "No notes indexed yet",
    "先索引一次，才会有 persona。": "Index once to build a persona.",
    "还没有 persona 模型": "No persona model yet",
    "已有 {n} 篇笔记，提炼一次就能开始审阅。": "There are {n} notes. Extract once to start reviewing.",
    "有据回答": "Grounded answers",
    "第一人称回答，逐句引用笔记。没有依据的地方会标成 unknown，而不是编一个答案。":
      "First-person answers with sentence-level citations. Anything unsupported is marked unknown instead of invented.",
    "清空对话": "Clear conversation",
    问题: "Question",
    "Pi-Mirror 会先检索笔记，再以第一人称回答；引用编号可以点回原文。":
      "Pi-Mirror searches your notes first, then answers in the first person. Citation numbers link back to the source.",
    "没有匹配": "No matches",
    "换个关键词，或直接搜索笔记内容。": "Try another keyword or search note content directly.",
    "以你的口吻起草": "Draft in your voice",
    "先检索，再动笔。草稿会带句子级引用；写完后可以直接丢进 Guard 检查。":
      "Search first, then write. Drafts carry sentence-level citations and can go straight into Guard.",
    "新草稿": "New draft",
    简报: "Brief",
    "越具体，越容易写出你自己的判断。": "The more specific, the easier it is to write your own judgment.",
    主题: "Topic",
    读者: "Audience",
    要点: "Points",
    "一行一个要点。没有也可以，会从笔记里找。":
      "One point per line. Optional; I'll find them in your notes.",
    "会先调用 vault_search，再写。<br />没有依据的段落会标 unknown。":
      "Calls vault_search first, then writes.<br />Unsupported passages are marked unknown.",
    "以我起草": "Draft as me",
    "pi AgentSession 正在检索并起草…": "pi AgentSession is searching and drafting…",
    "结果会出现在这里，并带着引用和 Guard 摘要。":
      "The result appears here with citations and a Guard summary.",
    检索: "Search",
    "先在本地 SQLite 里找相关笔记，中文 1–2 字查询会走 LIKE 兜底。":
      "Find relevant notes in local SQLite; 1–2 character Chinese queries fall back to LIKE.",
    "以第一人称写，事实句带 [n] 引用，推断标 inference。":
      "Write in the first person; factual sentences carry [n] citations, inferences are marked inference.",
    "Guard 会看绝对化措辞、无引用断言、句长偏离和引用覆盖率。":
      "Guard checks absolute wording, unsupported claims, sentence-length drift, and citation coverage.",
    "起草失败": "Draft failed",
    "请求没有完成。": "The request did not finish.",
    "在 Guard 中检查": "Check in Guard",
    "发布之前": "Before you publish",
    "发布前的一道机械检查：绝对化措辞、无引用断言、句长偏离、引用覆盖率。它不做审美判断。":
      "A mechanical pre-publish check: absolute wording, unsupported claims, sentence-length drift, citation coverage. It makes no aesthetic judgment.",
    文本: "Text",
    "草稿、回复、帖子都行。": "Drafts, replies, posts — anything.",
    "粘贴要检查的文本…": "Paste text to check…",
    "基于 {n} 条 trait 和 {m} 项语气特征。": "Based on {n} traits and {m} voice features.",
    清空: "Clear",
    "运行检查": "Run guard",
    报告: "Report",
    "按严重程度排序。": "Sorted by severity.",
    "结果会出现在这里。": "The report appears here.",
    "还没有检查结果": "No check yet",
    "贴一段草稿，或在知识库里写完后点「查看检查」。":
      "Paste a draft, or write in the knowledge base and choose “View check”.",
    "没有自动发现的问题": "No automatic findings",
    "这不等同于可以发布。Guard 只看可计算的部分。":
      "This does not mean it's ready to publish. Guard only sees what can be computed.",
    "先贴一段文本。": "Paste some text first.",
    "你如何变化": "How you changed",
    "目前显示的是单次观察到的立场。同一话题再次出现、极性变化时，这里会开始显示「变化」。":
      "This shows single observations so far. When a topic reappears with a different polarity, changes will appear here.",
    "同一话题的立场变化，按观察时间排列。": "Stance changes on the same topic, ordered by observation time.",
    "还没有立场记录": "No stance records yet",
    "等笔记里出现可识别的 stance 句，或把 stance_events 写进库。":
      "Wait for recognizable stance sentences in your notes, or write stance_events into the database.",
    "随时间的变化": "Changes over time",
    "目前是单次观察；同一话题再次出现、极性变化时，这里会显示「变化」。":
      "These are single observations; when a topic reappears with a different polarity, changes will show here.",
    "按观察时间排列。": "Ordered by observation time.",
    "打开完整变化": "Open full Timeline",
    "你做了什么": "What you made",
    "草稿与发布记录都在本地。Pi-Mirror 不代你发帖，只记录事实。":
      "Drafts and publish records stay local. Pi-Mirror never posts for you; it records facts.",
    "新建草稿": "New draft",
    草稿: "Drafts",
    "还没有草稿": "No drafts yet",
    "回到知识库写一篇，然后保存到这里。": "Go back to the knowledge base, write one, and save it here.",
    链接: "Link",
    打开: "Open",
    "还没有发布记录": "No publish records yet",
    "在草稿里记录平台和链接；这会同时写入本地 publish_records。":
      "Record the platform and link in a draft; this also writes to local publish_records.",
    "标记为已审阅": "Mark reviewed",
    通过: "Approve",
    "复制全文": "Copy full text",
    "记录发布": "Record a publish",
    "发布授权当前关闭。先去 Consent 打开，再记录发布。":
      "Publishing consent is off. Turn it on in Consent, then record the publish.",
    "打开授权": "Open Consent",
    "发布需要 Consent 插件。当前只加载了 Library，记录发布会被服务端拒绝。":
      "Publishing needs the Consent plugin. Only Library is loaded, so the server will reject publish records.",
    "标记为已发布": "Mark published",
    "已记录发布事实。": "Publish recorded.",
    边界: "Boundaries",
    "每个 scope 都由你显式开关。关闭 publishing 时，发布接口会直接拒绝，而不是静默跳过。":
      "Every scope is an explicit switch. When publishing is off, the publish endpoint rejects the request instead of silently skipping it.",
    范围: "Scopes",
    "记录是追加式的：每次开启或撤回都会留下时间线，而不是覆盖旧值。":
      "Records are append-only: every grant or revocation leaves a timeline instead of overwriting the old value.",
    "这个应用永远不会做的事": "What this app will never do",
    "写入你的笔记": "Write to your notes",
    不会: "Never",
    自动发帖或调用平台发布接口: "Post automatically or call platform publishing APIs",
    "在没有 publishing 授权时标记已发布": "Mark something published without publishing consent",
    "把 API key 或 token 写进库": "Write API keys or tokens into the database",
    "你的上下文": "Your context",
    "Pi-Mirror 知道什么": "What Pi-Mirror knows",
    "打开完整授权": "Open full Consent",
    "只有 publishing 会在服务端硬性生效。每次开关都追加一条记录，不覆盖历史。":
      "Only publishing is enforced server-side. Every switch appends a record instead of overwriting history.",
    导航: "Navigate",
    上下文: "Context",
    操作: "Actions",
    "身份、证据与审阅": "identity, evidence, and review",
    "立场随时间的变化": "stance changes over time",
    "四类授权边界": "four consent scopes",
    "重建索引、traits 与语气统计": "rebuild the index, traits, and voice stats",
    "重新加载工作区": "Reload workspace",
    "重新读取本地状态与草稿": "re-read local state and drafts",
    "只看未确认的 trait": "show only unconfirmed traits",
    "问一个问题": "Ask a question",
    "回到知识库的问": "go back to the knowledge base · ask",
    "正在索引并提炼 persona…": "Indexing and extracting persona…",
    "已复制。": "Copied.",
    "复制失败，请手动选择文本。": "Copy failed; select the text manually.",
    "没有可用模型": "No model available",
    "请求失败": "Request failed",
    "pi 没有可用模型。先在 pi 中配置 provider 与 default model（<code>settings.json</code>），再重试。":
      "pi has no available model. Configure a provider and default model in pi (<code>settings.json</code>), then retry.",
    "连不上 Pi-Mirror 服务": "Can't reach the Pi-Mirror service",
    重试: "Retry",
    "这个页面需要的插件没有加载": "The plugin this page needs is not loaded",
    "还没有加载功能插件": "No feature plugins are loaded",
    "知识库会组合当前加载的能力；这个页面依赖的插件不在列表里。可以在 pi 配置里单独启用它。":
      "Knowledge base composes whatever is loaded; this page needs a plugin that is not in the list. Enable it in the pi config.",
    "用 pi 加载 src/extensions 下的插件，或运行 pi -e ./src/extension.ts 一次加载全部。":
      "Load the plugins in src/extensions with pi, or run pi -e ./src/extension.ts to load them all.",
    "来源 · {n}": "Sources · {n}",
    "笔记 · 只读": "Note · read-only",
    搜索结果: "Search result",
    "索引 {files} 篇 / {chunks} 段 · 新增 {traits} 条 trait":
      "Indexed {files} notes / {chunks} chunks · {traits} new traits",
    "还没有语气样本": "No voice sample yet",
    正向: "positive",
    反向: "negative",
    中性: "neutral",
    "复制路径": "Copy path",
    "保存到作品库": "Save to Library",
    "句子带引用或标注 · {sentences} 句 · {findings} 项发现":
      "{sentences} sentences cited or marked · {findings} findings",
    "问、写、查都在这里。它只读你的笔记，每个回答都能点回来源。":
      "Ask, write, and check in one place. It reads only your notes, and every answer links back to its source.",
    "默认读取 <code>demo/vault</code>。索引之后，我才能以你的口吻回答、起草和检查。要换成自己的库，把 <code>PI_MIRROR_VAULT</code> 指向脱敏后的目录。":
      "Reads <code>demo/vault</code> by default. Once indexed, I can answer, draft, and check in your voice. To use your own vault, point <code>PI_MIRROR_VAULT</code> at a desensitized directory.",
    "Enter {label} · Shift + Enter 换行 · 每轮由独立 pi AgentSession 生成":
      "Enter to {label} · Shift + Enter for a new line · each turn runs in its own pi AgentSession",
    "{name} · v{version} · {traits} 条特质，{evidence} 条证据，来自 {notes} 篇笔记。":
      "{name} · v{version} · {traits} traits, {evidence} evidence, from {notes} notes.",
    "{n} 字": "{n} characters",
    "{coverage}% 句子带引用或标注 · {sentences} 句 · {findings} 项发现":
      "{coverage}% of sentences cited or marked · {sentences} sentences · {findings} findings",
    "{n} 句": "{n} sentences",
    "{n} 篇 · 点开查看全文与状态。": "{n} drafts · open one to see the full text and status.",
    "{n} 条记录。": "{n} records.",
    "· 每条结论都能回到原文。": "every claim traces back to its source.",
    "每条结论都能回到原文。": "every claim traces back to its source.",
    "Publishing 授权当前关闭。先去 Consent 打开，再记录发布。":
      "Publishing consent is off. Turn it on in Consent, then record the publish.",
  };

  const isZh = () => locale === "zh";
  let locale = detect();

  function detect() {
    try {
      const stored = localStorage.getItem("pi-mirror-locale");
      if (stored === "zh" || stored === "en") return stored;
    } catch {
      /* storage can be unavailable */
    }
    const language = (navigator.language || "").toLowerCase();
    return language.startsWith("zh") ? "zh" : "en";
  }

  function interpolate(text, vars) {
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, (match, key) =>
      vars[key] === undefined || vars[key] === null ? match : String(vars[key]),
    );
  }

  function hasChinese(text) {
    return /[一-龥]/.test(text);
  }

  function t(key, vars) {
    let text = key;
    if (isZh()) {
      if (!hasChinese(key)) text = ZH[key] ?? key;
    } else if (hasChinese(key)) {
      text = EN[key] ?? key;
    }
    return interpolate(text, vars);
  }

  const listeners = [];
  function setLocale(next) {
    const value = next === "en" ? "en" : "zh";
    if (value === locale) return;
    locale = value;
    try {
      localStorage.setItem("pi-mirror-locale", value);
    } catch {
      /* storage can be unavailable */
    }
    document.documentElement.lang = value === "zh" ? "zh-CN" : "en";
    listeners.forEach((listener) => listener(value));
  }

  function onChange(listener) {
    listeners.push(listener);
  }

  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";

  window.I18N = { t, setLocale, onChange, isZh, get locale() { return locale; } };
  window.t = t;
})();
