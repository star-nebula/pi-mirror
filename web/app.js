/* Pi-Mirror workspace — no framework, real APIs, local only. */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const t = (key, vars) => I18N.t(key, vars);
const isZh = () => I18N.locale === "zh";
const ui = (zh, en) => (isZh() ? zh : en);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });

const icon = (name, cls = "") =>
  `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

const pct = (value) => Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);

const num = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10);
};

const rate = (value) => `${Math.round((Number(value) || 0) * 100)}%`;

const fmtDate = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return new Intl.DateTimeFormat(isZh() ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return new Intl.DateTimeFormat(isZh() ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const shortModel = (model) => {
  if (!model) return "";
  const tail = model.includes("/") ? model.split("/").pop() : model;
  return tail.length > 22 ? `${tail.slice(0, 20)}…` : tail;
};

const KINDS = {
  value: { label: "Values", zh: "价值", dot: "k-value" },
  stance: { label: "Stances", zh: "立场", dot: "k-stance" },
  taboo: { label: "Taboos", zh: "禁忌", dot: "k-taboo" },
  goal: { label: "Goals", zh: "目标", dot: "k-goal" },
  preference: { label: "Preferences", zh: "偏好", dot: "k-preference" },
  biography: { label: "Biography", zh: "经历", dot: "k-biography" },
  voice: { label: "Voice", zh: "语气", dot: "k-voice" },
};

const kindLabel = (kind) => {
  const meta = KINDS[kind];
  return meta ? (isZh() ? meta.zh : meta.label) : kind;
};

const VIEWS = {
  studio: { label: "Studio", labelZh: "创作", sub: "research → draft", subZh: "研究到成稿", icon: "studio" },
  mirror: { label: "Knowledge base", labelZh: "知识库", sub: "ask, write, check", subZh: "问、写、查", icon: "spark" },
  library: { label: "Library", labelZh: "作品库", sub: "drafts & publishing", subZh: "草稿与发布", icon: "library" },
  persona: { label: "Persona", labelZh: "身份", sub: "identity model", subZh: "身份模型", icon: "persona" },
  ask: { label: "Ask", labelZh: "问", sub: "answer as you", subZh: "以我回答", icon: "ask" },
  write: { label: "Write", labelZh: "写", sub: "draft as you", subZh: "以我起草", icon: "write" },
  guard: { label: "Guard", labelZh: "检查", sub: "pre-publish check", subZh: "发布前检查", icon: "guard" },
  timeline: { label: "Timeline", labelZh: "变化", sub: "how you changed", subZh: "观点变化", icon: "timeline" },
  consent: { label: "Consent", labelZh: "授权", sub: "boundaries", subZh: "授权边界", icon: "consent" },
};

const viewLabel = (id) => {
  const view = VIEWS[id];
  return view ? (isZh() ? view.labelZh : view.label) : id;
};
const viewSub = (id) => {
  const view = VIEWS[id];
  return view ? (isZh() ? view.subZh : view.sub) : "";
};

const STATUS_LABELS = {
  draft: ["draft", "草稿"],
  reviewed: ["reviewed", "已审阅"],
  approved: ["approved", "已通过"],
  published: ["published", "已发布"],
  candidate: ["candidate", "候选"],
  confirmed: ["confirmed", "已确认"],
  rejected: ["rejected", "已拒绝"],
  outdated: ["outdated", "已过期"],
  queued: ["queued", "排队中"],
  running: ["running", "运行中"],
  done: ["done", "完成"],
  error: ["error", "出错"],
};
const statusLabel = (status) => {
  const row = STATUS_LABELS[status];
  return row ? (isZh() ? row[1] : row[0]) : status;
};

const severityLabel = (severity) =>
  isZh() ? ({ high: "高", medium: "中", low: "低" }[severity] || severity) : severity;

const VOICE_META = {
  avgSentenceLen: { label: "平均句长 · 字", en: "Avg sentence · chars", fmt: num },
  questionRate: { label: "问句率", en: "Questions", fmt: rate },
  exclaimRate: { label: "感叹句率", en: "Exclamations", fmt: rate },
  firstPersonRate: { label: "第一人称", en: "First person", fmt: rate },
  listRate: { label: "列表占比", en: "Lists", fmt: rate },
  avgParagraphLen: { label: "平均段长", en: "Avg paragraph", fmt: num },
  emojiRate: { label: "emoji / 句", en: "Emoji / sentence", fmt: num },
  englishMixRate: { label: "中英混排", en: "English mix", fmt: rate },
};

const CONSENT_META = {
  modeling: {
    title: "Modeling",
    titleZh: "建模",
    desc: "Extract persona traits, voice, and stances from notes. Read and written on this machine only.",
    descZh: "从笔记里提炼 persona traits、语气和立场。只在本机读写，不离开这台机器。",
  },
  drafting: {
    title: "Drafting",
    titleZh: "起草",
    desc: "Allow the agent to draft in the first person, citing your notes as evidence.",
    descZh: "允许 agent 以第一人称起草内容，并引用你的笔记作为依据。",
  },
  publishing: {
    title: "Publishing",
    titleZh: "发布",
    desc: "Allow a draft to be marked published, with platform and link. When off, the publish endpoint is rejected.",
    descZh: "允许把草稿标记为已发布，并记录平台与链接。关闭时发布接口会被拒绝。",
  },
  demo: {
    title: "Public demo",
    titleZh: "公开演示",
    desc: "Allow desensitized excerpts in the public demo. Content with source text stays off by default.",
    descZh: "允许把脱敏后的片段用于公开演示。含原文的内容默认关闭。",
  },
};

const consentMeta = (scope) => {
  const meta = CONSENT_META[scope] || { title: scope, titleZh: scope, desc: "", descZh: "" };
  return {
    title: isZh() ? meta.titleZh : meta.title,
    desc: isZh() ? meta.descZh : meta.desc,
  };
};

const PLATFORMS = [
  ["xiaohongshu", "小红书", "Xiaohongshu"],
  ["wechat", "公众号", "WeChat"],
  ["x", "X", "X"],
  ["newsletter", "Newsletter", "Newsletter"],
];

const platformLabel = (id) => {
  const row = PLATFORMS.find(([key]) => key === id) || [id, id, id];
  return isZh() ? row[1] : row[2];
};

const app = {
  data: null,
  error: null,
  view: "mirror",
  featureMeta: [],
  traitFilter: "all",
  onlyCandidates: false,
  mirror: null,
  mirrorMode: "ask",
  mirrorText: "",
  mirrorBrief: { platform: "xiaohongshu", audience: "", angle: "" },
  mirrorBusy: false,
  mirrorCleared: false,
  mirrorFetching: false,
  contextTab: null,
  ask: null,
  askLoaded: false,
  askBusy: false,
  askCleared: false,
  askFetching: false,
  write: null,
  writeBusy: false,
  writeForm: { topic: "", platform: "xiaohongshu", audience: "", angle: "", points: "" },
  guardText: "",
  guard: null,
  guardBusy: false,
  studio: {
    goal: "",
    platform: "xiaohongshu",
    audience: "",
    run: null,
    runs: [],
    composeOpen: false,
    busy: false,
    error: null,
    pollToken: 0,
    pollingId: null,
    references: null,
    refCount: 0,
    refsLoaded: false,
    importOpen: false,
    pendingRun: null,
  },
  reindexing: false,
  palette: { items: [], index: 0, token: 0 },
  drawerToken: 0,
  lastFocus: null,
};

/* ---------- api ---------- */

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error((data && data.error) || `${response.status} ${response.statusText}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

/* ---------- boot ---------- */

document.addEventListener("DOMContentLoaded", () => {
  applyStaticCopy();
  app.view = readRoute();
  bindGlobal();
  I18N.onChange(() => {
    applyStaticCopy();
    closeDrawer(false);
    closePalette(false);
    renderChrome();
    render();
  });
  loadState();
});

function applyStaticCopy() {
  const tagline = $(".brand-text small");
  if (tagline) tagline.textContent = t("personal agent");
  $(".brand")?.setAttribute("aria-label", t("Pi-Mirror home"));
  $("#nav")?.setAttribute("aria-label", t("Workspace"));

  const context = $("#contextTrigger");
  if (context) {
    context.setAttribute("aria-label", t("Open your context"));
    const label = context.querySelector("span");
    if (label) label.textContent = t("You");
  }

  const search = $("#searchTrigger");
  if (search) {
    search.setAttribute("aria-label", t("Search notes and commands"));
    const label = search.querySelector("span");
    if (label) label.textContent = t("Search");
  }

  $("#langTrigger")?.setAttribute("aria-label", t("Language"));
  const langLabel = $("#langLabel");
  if (langLabel) langLabel.textContent = isZh() ? "中文" : "EN";
  $$("#langMenu [data-lang]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.lang === I18N.locale);
  });

  const drawerKicker = $("#drawerKicker");
  if (drawerKicker && !$("#drawerLayer")?.classList.contains("is-open")) {
    drawerKicker.textContent = t("Detail");
  }
  $(".palette")?.setAttribute("aria-label", t("Search and commands"));
  const paletteInput = $("#paletteInput");
  if (paletteInput) {
    paletteInput.placeholder = ui("搜索笔记，或跳转模块…", "Search notes or jump to a module…");
  }
  const hint1 = $("#paletteHint1");
  const hint2 = $("#paletteHint2");
  const hint3 = $("#paletteHint3");
  if (hint1) hint1.textContent = ui("↑ ↓ 选择", "↑ ↓ select");
  if (hint2) hint2.textContent = ui("↵ 打开", "↵ open");
  if (hint3) hint3.textContent = ui("笔记全文只在本机读取", "notes are read on this machine");
}

function toggleLangMenu(open) {
  const menu = $("#langMenu");
  const trigger = $("#langTrigger");
  if (!menu || !trigger) return;
  const next = open ?? menu.hidden;
  menu.hidden = !next;
  trigger.setAttribute("aria-expanded", next ? "true" : "false");
}

function closeLangMenu() {
  toggleLangMenu(false);
}

function navFeatures() {
  return (app.data?.features || []).filter((feature) => feature.nav);
}

function primaryNav() {
  const items = [];
  const studio = (app.data?.features || []).find((feature) => feature.id === "studio");
  if (studio) {
    items.push({ id: "studio", label: viewLabel("studio"), sub: viewSub("studio"), icon: "studio" });
  }
  items.push({ id: "mirror", label: viewLabel("mirror"), sub: viewSub("mirror"), icon: "spark" });
  const library = (app.data?.features || []).find((feature) => feature.id === "library");
  if (library) {
    items.push({ id: "library", label: viewLabel("library"), sub: viewSub("library"), icon: "library" });
  }
  return items;
}

function featureLoaded(id) {
  return (app.data?.features || []).some((feature) => feature.id === id);
}

function featureLabel(feature) {
  return isZh() ? feature.zh || feature.label : feature.label;
}

function mirrorModes() {
  return [
    { id: "ask", label: ui("问", "Ask"), available: featureLoaded("ask"), hint: ui("以你的笔记回答", "answer from your notes") },
    { id: "write", label: ui("写", "Write"), available: featureLoaded("write"), hint: ui("以你的口吻起草", "draft in your voice") },
    { id: "check", label: ui("查", "Check"), available: featureLoaded("guard"), hint: ui("发布前机械检查", "mechanical pre-publish check") },
  ];
}

function viewAvailable(id) {
  if (id === "mirror") return true;
  return navFeatures().some((feature) => feature.id === id);
}

function firstView() {
  return app.data && viewAvailable("studio") ? "studio" : "mirror";
}

function readRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [id, query] = raw.split("?");
  if (id === "mirror") {
    const mode = new URLSearchParams(query || "").get("mode");
    if (["ask", "write", "check"].includes(mode)) app.mirrorMode = mode;
  }
  if (id === "studio") {
    const runId = new URLSearchParams(query || "").get("run");
    if (runId) app.studio.pendingRun = runId;
  }
  return VIEWS[id] ? id : firstView();
}

function go(id) {
  if (!VIEWS[id]) return;
  if (app.data && !viewAvailable(id)) return;
  if (location.hash === `#/${id}`) {
    app.view = id;
    render();
  } else {
    location.hash = `#/${id}`;
  }
}

async function loadState() {
  try {
    const data = await api("/api/state");
    app.data = data;
    app.featureMeta = Array.isArray(data.features) ? data.features : [];
    app.error = null;

    app.studio.runs = Array.isArray(data.studio?.runs) ? data.studio.runs : [];
    if (data.referenceLibrary) {
      if (app.studio.references === null) app.studio.references = data.referenceLibrary.recent || [];
      app.studio.refCount = data.referenceLibrary.count ?? app.studio.refCount;
    }
    const activeRun = app.studio.runs.find((run) => run.status === "running" || run.status === "queued");
    if (activeRun) {
      app.studio.run = activeRun;
      app.studio.busy = true;
      startStudioPolling(activeRun.id);
    } else if (!app.studio.run && app.studio.runs[0]) {
      app.studio.run = app.studio.runs[0];
    }

    const explicitRoute = location.hash.replace(/^#\/?/, "").split("?")[0];
    if (!explicitRoute && viewAvailable("studio")) {
      app.view = "studio";
      history.replaceState(null, "", "#/studio");
    }
    if (!viewAvailable(app.view)) {
      app.view = firstView();
      if (location.hash !== `#/${app.view}`) history.replaceState(null, "", `#/${app.view}`);
    }
  } catch (error) {
    app.data = null;
    app.error = error.message;
    app.featureMeta = [];
  }
  renderChrome();
  render();
}

/* ---------- chrome ---------- */

function renderNav() {
  const nav = $("#nav");
  const features = primaryNav();
  if (!features.length) {
    nav.innerHTML = "";
    return;
  }
  nav.innerHTML = features
    .map(
      (feature) => `<button class="nav-item" data-view="${esc(feature.id)}" type="button" title="${esc(feature.sub)}">
        ${icon(feature.icon)}
        <span>${esc(feature.label)}</span>
      </button>`,
    )
    .join("");
}

function renderChrome() {
  const data = app.data;
  renderNav();
  if (!data) {
    $("#vaultName").textContent = t("Your knowledge base");
    $("#vaultMeta").textContent = app.error ? t("unavailable") : t("loading…");
    $("#vaultTags").innerHTML = "";
    $("#contextTrigger").hidden = true;
    return;
  }

  $("#contextTrigger").hidden = !["persona", "timeline", "consent"].some(featureLoaded);

  const name = (data.meta.vaultRoot || "vault").split(/[\\/]/).filter(Boolean).pop() || "vault";
  const counts = data.counts || {};
  $("#vaultName").textContent = name === "vault" ? t("Your knowledge base") : name;
  $("#vaultMeta").textContent = `${counts.notes ?? 0} ${t("notes")} · ${counts.traits ?? 0} ${t("traits")} · ${counts.evidence ?? 0} ${t("evidence")}`;

  const tags = [];
  if (data.meta.demo) tags.push(`<span class="tag lime">${t("demo vault")}</span>`);
  tags.push(`<span class="tag">${app.featureMeta.length} ${t("plugins")}</span>`);
  tags.push(`<span class="tag">${t("notes read-only")}</span>`);
  $("#vaultTags").innerHTML = tags.join("");

  const chip = $("#modelChip");
  if (data.meta.model) {
    chip.className = "model-chip";
    chip.textContent = `pi · ${shortModel(data.meta.model)}`;
    chip.title = `${data.meta.model}${data.meta.provider ? ` · ${data.meta.provider}` : ""}`;
  } else {
    chip.className = "model-chip off";
    chip.textContent = t("pi · no model");
    chip.title = t("Configure a default model in pi to enable Ask and Write.");
  }
  $(".live-dot")?.classList.toggle("off", !data.meta.model);
}

/* ---------- render ---------- */

function render() {
  document.body.dataset.view = app.view || "";
  $$(".nav-item").forEach((item) => {
    item.setAttribute("aria-current", item.dataset.view === app.view ? "page" : "false");
  });
  renderRailRecent();

  const host = $("#view");
  if (app.error) {
    host.innerHTML = `<div class="view-inner"><div class="card"><div class="empty"><span class="ring">${icon("guard")}</span><strong>${t("连不上 Pi-Mirror 服务")}</strong><span>${esc(app.error)}</span><button class="btn ghost sm" onclick="location.reload()">${t("重试")}</button></div></div></div>`;
    return;
  }
  if (!app.data) {
    host.innerHTML = `<div class="view-inner"><div class="skeleton"><div class="sk big"></div><div class="sk" style="width:52%"></div><div class="sk card"></div><div class="sk card"></div></div></div>`;
    return;
  }
  if (!viewAvailable(app.view)) {
    host.innerHTML = `<div class="view-inner">${renderFeatureMissing()}</div>`;
    return;
  }

  host.innerHTML = `<div class="view-inner">${renderView(app.view)}</div>`;
  bindView(app.view);

  if (app.view === "mirror" && app.mirror === null) {
    app.mirror = [];
    refreshMirrorHistory();
  }

  if (app.view === "ask" && app.ask === null) {
    app.ask = [];
    refreshAskHistory();
  }

  if (app.view === "studio" && !app.studio.refsLoaded) {
    app.studio.refsLoaded = true;
    void refreshStudioReferences();
  }
}

function renderFeatureMissing() {
  const loaded = app.featureMeta.length;
  const tags = (app.data?.features || [])
    .filter((feature) => feature.nav)
    .map((feature) => `<span class="tag">${esc(featureLabel(feature))}</span>`)
    .join("");
  return `<div class="card"><div class="empty">
    <span class="ring">${icon("spark")}</span>
    <strong>${loaded ? t("这个页面需要的插件没有加载") : t("还没有加载功能插件")}</strong>
    <span>${
      loaded
        ? t("知识库会组合当前加载的能力；这个页面依赖的插件不在列表里。可以在 pi 配置里单独启用它。")
        : t("用 pi 加载 src/extensions 下的插件，或运行 pi -e ./src/extension.ts 一次加载全部。")
    }</span>
    <div class="vault-tags">${tags}</div>
    <button class="btn ghost sm" onclick="location.reload()">${t("重新读取插件")}</button>
  </div></div>`;
}

function renderView(id) {
  switch (id) {
    case "studio":
      return renderStudio();
    case "mirror":
      return renderMirror();
    case "persona":
      return renderPersona();
    case "ask":
      return renderAsk();
    case "write":
      return renderWrite();
    case "guard":
      return renderGuard();
    case "timeline":
      return renderTimeline();
    case "library":
      return renderLibrary();
    case "consent":
      return renderConsent();
    default:
      return "";
  }
}

function bindView(id) {
  switch (id) {
    case "studio":
      bindStudio();
      break;
    case "mirror":
      bindMirror();
      break;
    case "persona":
      bindPersona();
      break;
    case "ask":
      bindAsk();
      break;
    case "write":
      bindWrite();
      break;
    case "guard":
      bindGuard();
      break;
    case "timeline":
      bindTimeline();
      break;
    case "library":
      bindLibrary();
      break;
    case "consent":
      bindConsent();
      break;
    default:
      break;
  }
}

function viewHead({ kicker, title, lead, actions = "" }) {
  return `<div class="view-head">
    <div>
      ${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ""}
      <h1>${esc(title)}</h1>
      <p class="lead">${lead}</p>
    </div>
    ${actions ? `<div class="view-actions">${actions}</div>` : ""}
  </div>`;
}

/* ---------- mirror ---------- */

function renderMirror() {
  const data = app.data;
  const counts = data.counts || {};
  const modes = mirrorModes();
  const available = modes.filter((mode) => mode.available);

  const head = `<div class="mirror-head">
    <div>
      <h1>${t("Knowledge base")}</h1>
      <p class="lead">${t("问、写、查都在这里。它只读你的笔记，每个回答都能点回来源。")}</p>
    </div>
    <div class="mirror-stats">
      <span><b>${counts.notes ?? 0}</b> ${t("notes")}</span>
      <span><b>${counts.traits ?? 0}</b> ${t("traits")}</span>
      <span><b>${counts.evidence ?? 0}</b> ${t("evidence")}</span>
    </div>
  </div>`;

  if (!available.length) {
    return (
      head +
      `<div class="card"><div class="empty">
        <span class="ring">${icon("spark")}</span>
        <strong>${t("还没有可以对话的能力")}</strong>
        <span>${t("知识库需要 ask、write 或 guard 插件之一。当前只加载了其他插件。")}</span>
        <button class="btn ghost sm" onclick="location.reload()">${t("重新读取插件")}</button>
      </div></div>`
    );
  }

  if (!counts.notes) {
    return (
      head +
      `<section class="card onboarding mirror-onboarding">
        <div class="kicker">${t("Start here")}</div>
        <h2>${t("先给我一份你的笔记")}</h2>
        <p>${t("默认读取 <code>demo/vault</code>。索引之后，我才能以你的口吻回答、起草和检查。要换成自己的库，把 <code>PI_MIRROR_VAULT</code> 指向脱敏后的目录。")}</p>
        <button class="btn primary" data-action="reindex">${icon("refresh")}${t("Index demo vault")}</button>
      </section>`
    );
  }

  if (!available.some((mode) => mode.id === app.mirrorMode)) {
    app.mirrorMode = available[0].id;
  }
  const mode = modes.find((item) => item.id === app.mirrorMode);
  const messages = app.mirror || [];
  const placeholder =
    mode.id === "write"
      ? t("想写什么？一句 topic 就够。")
      : mode.id === "check"
        ? t("粘贴准备发布的文字…")
        : t("问一个只有你的笔记能回答的问题…");
  const sendLabel = mode.id === "write" ? t("起草") : mode.id === "check" ? t("检查") : t("发送");
  const sendIcon = mode.id === "check" ? "guard" : "spark";

  const brief =
    mode.id === "write"
      ? `<div class="mirror-brief" id="mirrorBrief">
          <label><span>${t("平台")}</span><select id="mirrorPlatform">${PLATFORMS.map(
            ([id]) => `<option value="${id}" ${app.mirrorBrief.platform === id ? "selected" : ""}>${platformLabel(id)}</option>`,
          ).join("")}</select></label>
          <label><span>${t("写给谁")}</span><input id="mirrorAudience" value="${esc(app.mirrorBrief.audience)}" placeholder="${t("例如：做 AI 产品的人")}" /></label>
          <label><span>${t("角度")}</span><input id="mirrorAngle" value="${esc(app.mirrorBrief.angle)}" placeholder="${t("例如：反常识，但从证据出发")}" /></label>
        </div>`
      : "";

  return (
    head +
    `<section class="card chat mirror-chat">
      <div class="chat-log" id="chatLog">${
        messages.length ? messages.map((message, index) => renderMirrorMessage(message, index)).join("") : mirrorWelcome()
      }</div>
      <div class="mirror-bar">
        <div class="mirror-modes" role="tablist" aria-label="${t("Mode")}">
          ${modes
            .map(
              (item) => `<button class="mirror-mode ${item.id === app.mirrorMode ? "is-active" : ""}" data-mode="${item.id}" type="button" role="tab" aria-selected="${item.id === app.mirrorMode}" ${
                item.available ? "" : `disabled title="${t("需要 {id} 插件", { id: item.id })}"`
              }>${item.label}</button>`,
            )
            .join("")}
        </div>
        <span class="mirror-mode-hint">${esc(mode.hint)}</span>
        <span class="spacer"></span>
        ${messages.length ? `<button class="mirror-new" data-action="mirror-clear" type="button">${t("新对话")}</button>` : ""}
      </div>
      <form class="mirror-composer" id="mirrorForm">
        ${brief}
        <div class="composer">
          <textarea id="mirrorInput" rows="1" placeholder="${esc(placeholder)}" aria-label="${esc(sendLabel)}" ${
            app.mirrorBusy ? "disabled" : ""
          }>${esc(app.mirrorText)}</textarea>
          <button class="btn primary" type="submit" ${app.mirrorBusy ? "disabled" : ""}>${icon(sendIcon)}${app.mirrorBusy ? t("处理中") : sendLabel}</button>
        </div>
      </form>
      <div class="composer-hint">${t("Enter {label} · Shift + Enter 换行 · 每轮由独立 pi AgentSession 生成", { label: isZh() ? sendLabel : sendLabel.toLowerCase() })}</div>
    </section>`
  );
}

function mirrorWelcome() {
  const mode = app.mirrorMode;
  const suggestions =
    mode === "ask"
      ? ["我最近在反复思考什么？", "我对知识管理的核心判断是什么？", "我写东西时坚持什么、拒绝什么？"].map((text) => t(text))
      : mode === "write"
        ? ["为什么我不再追热点", "我怎么判断一个 AI 产品值不值得用", "我这一年对「慢」的理解"].map((text) => t(text))
        : [];
  const copy = {
    ask: [t("问一个只有你的笔记能回答的问题"), t("我会先检索笔记，再以第一人称回答；引用编号可以点回原文。")],
    write: [t("给我一个 topic，我以你的口吻起草"), t("会先检索，再动笔；写完后可以直接看 Guard 检查，或保存到 Library。")],
    check: [t("贴一段准备发布的文字"), t("我会检查绝对化措辞、无引用断言、句长偏离和引用覆盖率。")],
  }[mode];
  return `<div class="chat-welcome mirror-welcome">
    <span class="empty ring" style="margin:0 auto 4px">${icon(mode === "check" ? "guard" : "spark")}</span>
    <h2>${esc(copy[0])}</h2>
    <p>${esc(copy[1])}</p>
    ${
      suggestions.length
        ? `<div class="suggestions">${suggestions
            .map((text) => `<button class="suggestion" data-suggest="${esc(text)}">${esc(text)}</button>`)
            .join("")}</div>`
        : `<div class="mirror-welcome-hint">${t("Enter 提交 · Shift + Enter 换行")}</div>`
    }
  </div>`;
}

function renderMirrorMessage(message, index) {
  if (message.role === "draft") return renderDraftMessage(message, index);
  if (message.role === "guard") return renderGuardMessage(message, index);
  return renderMessage(message, index);
}

function renderDraftMessage(message, index) {
  if (message.error) {
    return `<div class="msg">
      <div class="msg-avatar"></div>
      <div class="msg-body">
        <div class="msg-name"><b>Pi-Mirror</b><span>${t("draft")}</span></div>
        ${errorCard(message.error, message.code)}
      </div>
    </div>`;
  }

  return `<div class="msg">
    <div class="msg-avatar"></div>
    <div class="msg-body">
      <div class="msg-name"><b>Pi-Mirror</b><span>${t("draft")}</span>${message.model ? `<span>${esc(shortModel(message.model))}</span>` : ""}</div>
      ${message.guard ? `<div class="result-meta">${guardChips(message.guard)}</div>` : ""}
      <div class="prose">${renderMd(message.text, index, message.sources || [])}</div>
      ${message.sources?.length ? sourcesBlock(message.sources, index) : ""}
      ${message.showGuard && message.guard ? `<div class="mirror-guard">${guardReportHtml(message.guard)}</div>` : ""}
      <div class="result-actions">
        <button class="btn primary sm" data-mirror-action="save" data-mi="${index}" ${message.saved ? "disabled" : ""}>${icon("check")}${message.saved ? t("已保存") : t("保存到作品库")}</button>
        ${
          message.guard
            ? `<button class="btn ghost sm" data-mirror-action="toggle-guard" data-mi="${index}">${icon("guard")}${message.showGuard ? t("收起检查") : t("查看检查")}</button>`
            : ""
        }
        <button class="btn ghost sm" data-mirror-action="copy" data-mi="${index}">${icon("copy")}${t("复制")}</button>
      </div>
    </div>
  </div>`;
}

function renderGuardMessage(message, index) {
  if (message.error) {
    return `<div class="msg">
      <div class="msg-avatar"></div>
      <div class="msg-body">
        <div class="msg-name"><b>Pi-Mirror</b><span>${t("guard")}</span></div>
        ${errorCard(message.error, message.code)}
      </div>
    </div>`;
  }
  return `<div class="msg">
    <div class="msg-avatar"></div>
    <div class="msg-body">
      <div class="msg-name"><b>Pi-Mirror</b><span>${t("guard")}</span></div>
      <div class="mirror-guard">${guardReportHtml(message.report)}</div>
    </div>
  </div>`;
}

function bindMirror() {
  $$('#view [data-action="reindex"]').forEach((button) => {
    button.addEventListener("click", () => reindex(button));
  });

  const form = $("#mirrorForm");
  const input = $("#mirrorInput");
  if (!form || !input) return;

  input.addEventListener("input", () => {
    app.mirrorText = input.value;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    mirrorSubmit();
  });

  $$("#view [data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      app.mirrorMode = button.dataset.mode;
      render();
      setTimeout(() => $("#mirrorInput")?.focus(), 40);
    });
  });

  $("#mirrorPlatform")?.addEventListener("change", (event) => {
    app.mirrorBrief.platform = event.target.value;
  });
  $("#mirrorAudience")?.addEventListener("input", (event) => {
    app.mirrorBrief.audience = event.target.value;
  });
  $("#mirrorAngle")?.addEventListener("input", (event) => {
    app.mirrorBrief.angle = event.target.value;
  });

  $$("#view .suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      app.mirrorText = button.dataset.suggest;
      if (app.mirrorMode === "ask") {
        mirrorSubmit();
      } else {
        render();
        setTimeout(() => $("#mirrorInput")?.focus(), 40);
      }
    });
  });

  $$('#view [data-action="mirror-clear"]').forEach((button) => {
    button.addEventListener("click", () => {
      app.mirror = [];
      app.mirrorCleared = true;
      app.mirrorText = "";
      render();
    });
  });

  $("#chatLog")?.addEventListener("click", (event) => {
    const citation = event.target.closest("[data-mi][data-si]");
    if (citation) {
      openSource(Number(citation.dataset.mi), Number(citation.dataset.si));
      return;
    }
    const action = event.target.closest("[data-mirror-action]");
    if (!action) return;
    const index = Number(action.dataset.mi);
    if (action.dataset.mirrorAction === "save") saveMirrorDraft(index, action);
    if (action.dataset.mirrorAction === "toggle-guard") toggleMirrorGuard(index);
    if (action.dataset.mirrorAction === "copy") copyText(app.mirror?.[index]?.text || "");
  });

  scrollChat();
}

async function mirrorSubmit() {
  const mode = app.mirrorMode;
  const text = app.mirrorText.trim();
  if (!text) {
    toast(mode === "check" ? t("先贴一段文字。") : mode === "write" ? t("先写一个 topic。") : t("先写一个问题。"), "err");
    $("#mirrorInput")?.focus();
    return;
  }
  if (app.mirrorBusy) return;
  const available = mirrorModes().find((item) => item.id === mode)?.available;
  if (!available) {
    toast(t("这个模式需要的插件没有加载。"), "err");
    return;
  }

  if (!app.mirror) app.mirror = [];
  app.mirrorCleared = false;
  const brief = { ...app.mirrorBrief };
  app.mirror.push({ role: "user", text });
  app.mirror.push({ role: "pending" });
  app.mirrorBusy = true;
  app.mirrorText = "";
  render();

  try {
    let message;
    if (mode === "ask") {
      const result = await api("/api/ask", { method: "POST", body: { question: text } });
      message = {
        role: "assistant",
        text: result.answer || "",
        sources: result.sources || [],
        model: result.model,
        error: result.error,
        code: result.code,
      };
    } else if (mode === "write") {
      const result = await api("/api/write", {
        method: "POST",
        body: {
          topic: text,
          platform: brief.platform,
          audience: brief.audience,
          angle: brief.angle,
          points: [],
        },
      });
      message = {
        role: "draft",
        text: result.answer || "",
        sources: result.sources || [],
        model: result.model,
        guard: result.guard,
        error: result.error,
        code: result.code,
        topic: text,
        brief,
        saved: false,
        showGuard: false,
      };
    } else {
      const report = await api("/api/guard", { method: "POST", body: { text } });
      message = { role: "guard", report, text };
    }
    app.mirror = app.mirror.filter((item) => item.role !== "pending");
    app.mirror.push(message);
  } catch (error) {
    app.mirror = app.mirror.filter((item) => item.role !== "pending");
    app.mirror.push({
      role: "assistant",
      text: "",
      sources: [],
      error: error.message,
      code: error.data?.code,
    });
  } finally {
    app.mirrorBusy = false;
    render();
    scrollChat();
    setTimeout(() => $("#mirrorInput")?.focus(), 40);
  }
}

async function saveMirrorDraft(index, button) {
  const message = app.mirror?.[index];
  if (!message?.text || message.saved) return;
  button.disabled = true;
  try {
    await api("/api/drafts", {
      method: "POST",
      body: {
        content: message.text,
        topic: message.topic || ui("无标题草稿", "Untitled draft"),
        platform: message.brief?.platform || app.mirrorBrief.platform,
        audience: message.brief?.audience || app.mirrorBrief.audience,
      },
    });
    message.saved = true;
    toast(t("草稿已保存到 Library。"), "ok");
    render();
    await loadState();
  } catch (error) {
    toast(error.message, "err");
    button.disabled = false;
  }
}

function toggleMirrorGuard(index) {
  const message = app.mirror?.[index];
  if (!message) return;
  message.showGuard = !message.showGuard;
  render();
}

async function refreshMirrorHistory() {
  if (!featureLoaded("ask") || app.mirrorFetching || app.mirrorCleared) return;
  if (app.mirror && app.mirror.length > 0) return;
  app.mirrorFetching = true;
  try {
    const history = await api("/api/history");
    if (!history.length || (app.mirror && app.mirror.length > 0)) return;
    app.mirror = history
      .slice()
      .reverse()
      .flatMap((entry) => [
        { role: "user", text: entry.question },
        {
          role: "assistant",
          text: entry.answer,
          sources: entry.sources || [],
          model: entry.model,
          error: entry.error,
          code: entry.error ? "model_unavailable" : undefined,
        },
      ]);
    if (app.view === "mirror") render();
  } catch {
    // History is a convenience; a fresh conversation still works.
  } finally {
    app.mirrorFetching = false;
  }
}

/* ---------- persona ---------- */

function renderPersona() {
  const data = app.data;

  if (!data.counts.notes) {
    return (
      viewHead({
        kicker: t("Identity model"),
        title: viewLabel("persona"),
        lead: t("这个工作区还没有索引笔记。Pi-Mirror 只读 Markdown，索引与提炼都在本机完成。"),
      }) +
      `<div class="card onboarding">
        <div class="kicker">${t("Start here")}</div>
        <h2>${t("先给「你」一份材料")}</h2>
        <p>${t("默认读取 <code>demo/vault</code>。索引之后，我才能以你的口吻回答、起草和检查。要换成自己的库，把 <code>PI_MIRROR_VAULT</code> 指向脱敏后的目录。")}</p>
        <button class="btn primary" data-action="reindex">${icon("refresh")}${t("Index demo vault")}</button>
      </div>`
    );
  }

  if (!data.profile) {
    return (
      viewHead({
        kicker: t("Identity model"),
        title: viewLabel("persona"),
        lead: t("已有 {n} 篇笔记，但还没有 persona 模型。", { n: data.counts.notes }),
      }) +
      `<div class="card onboarding">
        <div class="kicker">${t("One step left")}</div>
        <h2>${t("从笔记里提炼 persona")}</h2>
        <p>${t("会抽取 values / stances / taboos / goals，并为每一条记录证据句；语气统计也会一起更新。")}</p>
        <button class="btn primary" data-action="reindex">${icon("refresh")}${t("Build persona")}</button>
      </div>`
    );
  }

  const traits = data.traits;
  const candidates = traits.filter((trait) => trait.status === "candidate").length;
  const confirmed = traits.filter((trait) => trait.status === "confirmed").length;
  const total = traits.length || 1;
  const byKind = {};
  for (const trait of traits) {
    byKind[trait.kind] = (byKind[trait.kind] || 0) + 1;
  }

  const filters = [
    `<button class="filter ${!app.onlyCandidates && app.traitFilter === "all" ? "active" : ""}" data-filter="all">${t("All {n}", { n: traits.length })}</button>`,
    ...Object.keys(KINDS)
      .filter((kind) => byKind[kind])
      .map(
        (kind) =>
          `<button class="filter ${!app.onlyCandidates && app.traitFilter === kind ? "active" : ""}" data-filter="${kind}">${kindLabel(kind)} ${byKind[kind]}</button>`,
      ),
    candidates
      ? `<button class="filter ${app.onlyCandidates ? "active" : ""}" data-filter="candidates">${t("Candidates {n}", { n: candidates })}</button>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const visible = traits.filter((trait) => {
    if (app.onlyCandidates) return trait.status === "candidate";
    return app.traitFilter === "all" || trait.kind === app.traitFilter;
  });

  const rows = visible.length
    ? visible.map(traitRow).join("")
    : `<div class="empty small"><strong>${t("这个筛选下没有 trait")}</strong><span>${t("换一个分类，或重新索引。")}</span></div>`;

  const voiceCells = data.voice.slice(0, 6).map((feature) => {
    const meta = VOICE_META[feature.feature] || { label: feature.feature, en: feature.feature, fmt: num };
    return `<div class="voice-cell"><strong>${esc(meta.fmt(feature.value))}</strong><span>${esc(isZh() ? meta.label : meta.en)}</span></div>`;
  });

  return (
    viewHead({
      kicker: t("Identity model"),
      title: viewLabel("persona"),
      lead: t("{name} · v{version} · {traits} 条特质，{evidence} 条证据，来自 {notes} 篇笔记。", {
        name: data.profile.name,
        version: data.profile.version,
        traits: traits.length,
        evidence: data.counts.evidence,
        notes: data.counts.notes,
      }),
      actions: `<button class="btn ghost" data-action="reindex">${icon("refresh")}${t("重建索引")}</button>`,
    }) +
    `<div class="persona-grid">
      <section class="card">
        <div class="card-head">
          <div><h2>${t("Trait map")}</h2><p>${t("点开任意一条，查看它来自哪句话。")}</p></div>
          <div class="filters">${filters}</div>
        </div>
        <div class="trait-list">${rows}</div>
      </section>
      <aside class="stack">
        <section class="card">
          <div class="card-head"><div><h2>${t("Voice fingerprint")}</h2><p>${t("来自 {n} 个句子。", { n: data.voice[0]?.sampleSize || 0 })}</p></div></div>
          <div class="voice-grid">${voiceCells.join("") || `<div class="voice-cell"><strong>—</strong><span>${t("还没有语气样本")}</span></div>`}</div>
        </section>
        <section class="card">
          <div class="card-head"><div><h2>${t("Coverage")}</h2><p>${t("每条结论都要能回到原文。")}</p></div></div>
          <div class="stat-row"><span>${t("Notes")}</span><strong>${data.counts.notes}</strong></div>
          <div class="stat-row"><span>${t("Chunks")}</span><strong>${data.counts.chunks}</strong></div>
          <div class="stat-row"><span>${t("Traits")}</span><strong>${data.counts.traits}</strong></div>
          <div class="stat-row"><span>${t("Evidence")}</span><strong>${data.counts.evidence}</strong></div>
          <div class="stat-row"><span>${t("Last indexed")}</span><strong>${fmtDate(data.counts.lastIndexed)}</strong></div>
        </section>
        <section class="card">
          <div class="card-head"><div><h2>${t("Review queue")}</h2><p>${t("{candidates} candidate · {confirmed} confirmed", { candidates, confirmed })}</p></div></div>
          <div class="stack-bar">
            <i style="width:${pct(confirmed / total)};background:#63c52c"></i>
            <i style="width:${pct(candidates / total)};background:#e9b657"></i>
          </div>
          <div class="legend">
            <span><b style="background:#63c52c"></b>${t("confirmed")} ${confirmed}</span>
            <span><b style="background:#e9b657"></b>${t("candidate")} ${candidates}</span>
          </div>
          <p class="small muted" style="margin:10px 0 0;line-height:1.6">${t("候选 trait 带着状态进入卡片；对外发布前请逐条确认。确认或拒绝会写回本地库。")}</p>
          ${
            candidates
              ? `<button class="btn ghost sm" style="margin-top:11px" data-action="review">${icon("check")}${t("Review candidates")}</button>`
              : ""
          }
        </section>
      </aside>
    </div>`
  );
}

function traitRow(trait) {
  const kind = KINDS[trait.kind] || { dot: "k-biography" };
  const confidence = pct(trait.confidence);
  return `<button class="trait-row" data-trait="${esc(trait.id)}">
    <span class="kind-dot ${kind.dot}"></span>
    <span>
      <span class="trait-text">${esc(trait.text)}</span>
      <span class="trait-meta">
        <span>${confidence}%</span>
        <span>${t("{n} evidence", { n: trait.evidenceCount })}</span>
        <span class="pill ${esc(trait.status)}">${esc(statusLabel(trait.status))}</span>
      </span>
    </span>
    <span class="trait-score"><span>${confidence}%</span><span class="meter"><i style="width:${confidence}%;background:${trait.status === "confirmed" ? "#4cbf1a" : "#262626"}"></i></span></span>
    <span class="chev">${icon("arrow")}</span>
  </button>`;
}

function bindPersona() {
  $$("#view .filter").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      if (filter === "candidates") {
        app.onlyCandidates = true;
      } else {
        app.onlyCandidates = false;
        app.traitFilter = filter;
      }
      render();
    });
  });

  $$("#view .trait-row").forEach((row) => {
    row.addEventListener("click", () => openTrait(row.dataset.trait));
  });

  $$('#view [data-action="reindex"]').forEach((button) => {
    button.addEventListener("click", () => reindex(button));
  });

  $$('#view [data-action="review"]').forEach((button) => {
    button.addEventListener("click", () => {
      app.onlyCandidates = true;
      render();
    });
  });
}

/* ---------- ask ---------- */

function renderAsk() {
  const messages = app.ask || [];
  return (
    viewHead({
      kicker: t("Grounded answers"),
      title: viewLabel("ask"),
      lead: t("第一人称回答，逐句引用笔记。没有依据的地方会标成 unknown，而不是编一个答案。"),
      actions: messages.length
        ? `<button class="btn ghost" data-action="clear-ask">${icon("close")}${t("清空对话")}</button>`
        : "",
    }) +
    `<section class="card chat">
      <div class="chat-log" id="chatLog">${
        messages.length ? messages.map((message, index) => renderMessage(message, index)).join("") : askWelcome()
      }</div>
      <form class="composer" id="askForm">
        <textarea id="askInput" rows="1" placeholder="${t("问一个只有你的笔记能回答的问题…")}" aria-label="${t("Question")}"></textarea>
        <button class="btn primary" id="askSend" type="submit">${icon("spark")}${t("发送")}</button>
      </form>
      <div class="composer-hint">${t("Enter {label} · Shift + Enter 换行 · 每轮由独立 pi AgentSession 生成", { label: isZh() ? t("发送") : t("发送").toLowerCase() })}</div>
    </section>`
  );
}

function askWelcome() {
  const suggestions = [
    "我最近在反复思考什么？",
    "我对知识管理的核心判断是什么？",
    "我写东西时坚持什么、拒绝什么？",
  ].map((text) => t(text));
  return `<div class="chat-welcome">
    <span class="empty ring" style="margin:0 auto 4px">${icon("spark")}</span>
    <h2>${t("问一个只有你的笔记能回答的问题")}</h2>
    <p>${t("Pi-Mirror 会先检索笔记，再以第一人称回答；引用编号可以点回原文。")}</p>
    <div class="suggestions">
      ${suggestions.map((text) => `<button class="suggestion" data-suggest="${esc(text)}">${esc(text)}</button>`).join("")}
    </div>
  </div>`;
}

function renderMessage(message, index) {
  if (message.role === "user") {
    return `<div class="msg-user">${esc(message.text)}</div>`;
  }

  if (message.role === "pending") {
    return `<div class="msg">
      <div class="msg-avatar"></div>
      <div class="msg-body">
        <div class="msg-name"><b>Pi-Mirror</b><span>${t("检索笔记中")}</span></div>
        <div class="typing"><i></i><i></i><i></i></div>
      </div>
    </div>`;
  }

  const body = message.error
    ? errorCard(message.error, message.code)
    : `<div class="prose">${renderMd(message.text, index, message.sources || [])}</div>`;

  const sources = message.sources?.length ? sourcesBlock(message.sources, index) : "";
  const model = message.model ? `<span>${esc(shortModel(message.model))}</span>` : "";

  return `<div class="msg">
    <div class="msg-avatar"></div>
    <div class="msg-body">
      <div class="msg-name"><b>Pi-Mirror</b>${model}</div>
      ${body}
      ${sources}
    </div>
  </div>`;
}

function sourcesBlock(sources, messageIndex) {
  if (!sources.length) return "";
  return `<div class="sources">
    <div class="sources-head">${t("Sources · {n}", { n: sources.length })}</div>
    ${sources
      .map(
        (source, index) =>
          `<button class="source" data-mi="${messageIndex}" data-si="${index}">
            <b>[${source.number ?? index + 1}]</b>
            <span class="src-path">${esc(source.path)}${source.heading ? ` · ${esc(source.heading)}` : ""}</span>
          </button>`,
      )
      .join("")}
  </div>`;
}

function bindAsk() {
  const input = $("#askInput");
  const form = $("#askForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value;
    input.value = "";
    askQuestion(text);
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  $$("#view .suggestion").forEach((button) => {
    button.addEventListener("click", () => askQuestion(button.dataset.suggest));
  });

  $$('#view [data-action="clear-ask"]').forEach((button) => {
    button.addEventListener("click", () => {
      app.ask = [];
      app.askCleared = true;
      render();
    });
  });

  if ((app.ask || []).length === 0 && !app.askCleared && !app.askBusy) {
    refreshAskHistory();
  }

  $("#chatLog")?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-mi][data-si]");
    if (trigger) {
      openSource(Number(trigger.dataset.mi), Number(trigger.dataset.si));
    }
  });

  scrollChat();
}

function scrollChat() {
  requestAnimationFrame(() => {
    const log = $("#chatLog");
    if (log) log.scrollTop = log.scrollHeight;
  });
}

async function refreshAskHistory() {
  if (app.askFetching || app.askCleared) return;
  if (app.ask && app.ask.length > 0) return;
  app.askFetching = true;
  try {
    const history = await api("/api/history");
    if (!history.length || (app.ask && app.ask.length > 0)) return;
    app.ask = history
      .slice()
      .reverse()
      .flatMap((entry) => [
        { role: "user", text: entry.question },
        {
          role: "assistant",
          text: entry.answer,
          sources: entry.sources || [],
          model: entry.model,
          error: entry.error,
          code: entry.error ? "model_unavailable" : undefined,
        },
      ]);
    if (app.view === "ask") render();
  } catch {
    // History is a convenience; a fresh conversation still works.
  } finally {
    app.askFetching = false;
  }
}

async function askQuestion(text) {
  const question = String(text || "").trim();
  if (!question || app.askBusy) return;
  if (!app.ask) app.ask = [];
  app.askCleared = false;

  app.ask.push({ role: "user", text: question });
  app.ask.push({ role: "pending" });
  app.askBusy = true;
  render();

  try {
    const result = await api("/api/ask", { method: "POST", body: { question } });
    app.ask = app.ask.filter((message) => message.role !== "pending");
    app.ask.push({
      role: "assistant",
      text: result.answer || "",
      sources: result.sources || [],
      model: result.model,
      error: result.error,
      code: result.code,
    });
  } catch (error) {
    app.ask = app.ask.filter((message) => message.role !== "pending");
    app.ask.push({
      role: "assistant",
      text: "",
      sources: [],
      error: error.message,
      code: error.data?.code,
    });
  } finally {
    app.askBusy = false;
    render();
  }
}

/* ---------- markdown ---------- */

function renderMd(text, messageIndex, sources) {
  const escaped = esc(text || "");
  const lines = escaped.split(/\r?\n/);
  let html = "";
  let paragraph = [];
  let inList = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      html += `<p>${inline(paragraph.join(" "), messageIndex, sources)}</p>`;
      paragraph = [];
    }
  };

  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }
    if (/^#{1,4}\s+/.test(line)) {
      flushParagraph();
      closeList();
      html += `<h3>${inline(line.replace(/^#{1,4}\s+/, ""), messageIndex, sources)}</h3>`;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ""), messageIndex, sources)}</li>`;
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(line.replace(/^\d+\.\s+/, ""), messageIndex, sources)}</li>`;
      continue;
    }
    if (inList) closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  return html || "<p></p>";
}

function inline(text, messageIndex, sources) {
  let out = text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  out = out.replace(/\[(\d{1,2})\]/g, (match, digits) => {
    const number = Number(digits);
    const found = sources ? sources.findIndex((source) => Number(source.number) === number) : -1;
    const sourceIndex = found >= 0 ? found : number - 1;
    if (!sources || !sources[sourceIndex]) return match;
    return `<button class="cite" data-mi="${messageIndex}" data-si="${sourceIndex}" title="${esc(sources[sourceIndex].path)}">${digits}</button>`;
  });

  out = out
    .replace(/\[unknown\]/gi, '<span class="marker unknown">unknown</span>')
    .replace(/\[inference\]/gi, '<span class="marker inference">inference</span>');

  return out;
}

/* ---------- write ---------- */

function renderWrite() {
  const form = app.writeForm;
  const result = renderWriteResult();

  return (
    viewHead({
      kicker: t("Draft in your voice"),
      title: viewLabel("write"),
      lead: t("先检索，再动笔。草稿会带句子级引用；写完后可以直接丢进 Guard 检查。"),
      actions: app.write
        ? `<button class="btn ghost" data-action="reset-write">${icon("write")}${t("新草稿")}</button>`
        : "",
    }) +
    `<div class="form-grid">
      <form class="card" id="writeForm">
        <div class="card-head"><div><h2>${t("Brief")}</h2><p>${t("越具体，越容易写出你自己的判断。")}</p></div></div>
        <label class="field"><span>${t("Topic")}</span><input name="topic" value="${esc(form.topic)}" placeholder="${t("为什么我不再追热点")}" /></label>
        <div class="two-col">
          <label class="field"><span>${t("Platform")}</span><select name="platform">${PLATFORMS.map(
            ([id]) => `<option value="${id}" ${form.platform === id ? "selected" : ""}>${platformLabel(id)}</option>`,
          ).join("")}</select></label>
          <label class="field"><span>${t("Audience")}</span><input name="audience" value="${esc(form.audience)}" placeholder="${t("例如：做 AI 产品的人")}" /></label>
        </div>
        <label class="field"><span>${t("Angle")}</span><input name="angle" value="${esc(form.angle)}" placeholder="${t("例如：反常识，但从证据出发")}" /></label>
        <label class="field"><span>${t("Points")}</span><textarea name="points" rows="4" placeholder="${t("一行一个要点。没有也可以，会从笔记里找。")}">${esc(form.points)}</textarea></label>
        <div class="form-foot">
          <span class="note">${t("会先调用 vault_search，再写。<br />没有依据的段落会标 unknown。")}</span>
          <button class="btn primary" type="submit" ${app.writeBusy ? "disabled" : ""}>${icon("spark")}${t("Draft as me")}</button>
        </div>
      </form>
      <div id="writeResult">${result}</div>
    </div>`
  );
}

function renderWriteResult() {
  if (app.writeBusy) {
    return `<section class="card"><div class="card-head"><div><h2>${t("Draft")}</h2><p>${t("pi AgentSession 正在检索并起草…")}</p></div></div><div class="typing"><i></i><i></i><i></i></div><div class="skeleton" style="margin-top:18px"><div class="sk"></div><div class="sk"></div><div class="sk" style="width:72%"></div><div class="sk" style="width:88%"></div><div class="sk" style="width:54%"></div></div></section>`;
  }

  const result = app.write;
  if (!result) {
    return `<section class="card">
      <div class="card-head"><div><h2>${t("Draft")}</h2><p>${t("结果会出现在这里，并带着引用和 Guard 摘要。")}</p></div></div>
      <div class="placeholder-steps">
        <div class="step"><b>1</b><div><strong>${t("检索")}</strong><p>${t("先在本地 SQLite 里找相关笔记，中文 1–2 字查询会走 LIKE 兜底。")}</p></div></div>
        <div class="step"><b>2</b><div><strong>${t("起草")}</strong><p>${t("以第一人称写，事实句带 [n] 引用，推断标 inference。")}</p></div></div>
        <div class="step"><b>3</b><div><strong>${t("检查")}</strong><p>${t("Guard 会看绝对化措辞、无引用断言、句长偏离和引用覆盖率。")}</p></div></div>
      </div>
    </section>`;
  }

  if (result.error) {
    return `<section class="card"><div class="card-head"><div><h2>${t("Draft failed")}</h2><p>${t("请求没有完成。")}</p></div></div>${errorCard(result.error, result.code)}</section>`;
  }

  const sentenceCount = (result.answer.match(/[。！？.!?]/g) || []).length + (result.answer ? 1 : 0);
  return `<section class="card">
    <div class="result-meta">
      <span class="chip ok">pi agent</span>
      ${result.model ? `<span class="chip">${esc(shortModel(result.model))}</span>` : ""}
      <span class="chip">${t("{n} sentences", { n: sentenceCount })}</span>
      ${guardChips(result.guard)}
    </div>
    <div class="draft-body">${renderMd(result.answer, -1, result.sources || [])}</div>
    ${result.sources?.length ? sourcesBlock(result.sources, -1) : ""}
    <div class="result-actions">
      <button class="btn primary sm" data-action="save-draft" ${result.saved ? "disabled" : ""}>${icon("check")}${result.saved ? t("已保存") : t("保存到作品库")}</button>
      <button class="btn ghost sm" data-action="open-guard">${icon("guard")}${t("在 Guard 中检查")}</button>
      <button class="btn ghost sm" data-action="copy-draft">${icon("copy")}${t("复制")}</button>
    </div>
  </section>`;
}

function guardChips(guard) {
  if (!guard) return "";
  const summary = guard.summary;
  return [
    `<span class="chip ${summary.high ? "high" : "ok"}">${summary.high} ${t("high")}</span>`,
    `<span class="chip ${summary.medium ? "medium" : "ok"}">${summary.medium} ${t("medium")}</span>`,
    `<span class="chip">${summary.coverage}% ${t("cited")}</span>`,
  ].join("");
}

function bindWrite() {
  const form = $("#writeForm");
  if (!form) return;

  form.addEventListener("input", () => {
    const data = new FormData(form);
    app.writeForm = {
      topic: String(data.get("topic") || ""),
      platform: String(data.get("platform") || "xiaohongshu"),
      audience: String(data.get("audience") || ""),
      angle: String(data.get("angle") || ""),
      points: String(data.get("points") || ""),
    };
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (app.writeBusy) return;
    if (!app.writeForm.topic.trim()) {
      toast(t("先写一个 topic。"), "err");
      $('[name="topic"]')?.focus();
      return;
    }

    app.writeBusy = true;
    app.write = null;
    render();

    try {
      const result = await api("/api/write", {
        method: "POST",
        body: {
          topic: app.writeForm.topic,
          platform: app.writeForm.platform,
          audience: app.writeForm.audience,
          angle: app.writeForm.angle,
          points: app.writeForm.points.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        },
      });
      app.write = { ...result, saved: false };
    } catch (error) {
      app.write = { error: error.message, code: error.data?.code };
    } finally {
      app.writeBusy = false;
      render();
    }
  });

  $$('#view [data-action="reset-write"]').forEach((button) => {
    button.addEventListener("click", () => {
      app.write = null;
      app.writeForm = { topic: "", platform: "xiaohongshu", audience: "", angle: "", points: "" };
      render();
    });
  });

  $$('#view [data-action="save-draft"]').forEach((button) => {
    button.addEventListener("click", () => saveWrite(button));
  });

  $$('#view [data-action="open-guard"]').forEach((button) => {
    button.addEventListener("click", () => {
      if (!app.write?.answer) return;
      app.guardText = app.write.answer;
      app.guard = app.write.guard || null;
      go("guard");
    });
  });

  $$('#view [data-action="copy-draft"]').forEach((button) => {
    button.addEventListener("click", () => copyText(app.write?.answer || ""));
  });

  $("#writeResult")?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-mi][data-si]");
    if (trigger) openSource(Number(trigger.dataset.mi), Number(trigger.dataset.si));
  });
}

async function saveWrite(button) {
  const result = app.write;
  if (!result?.answer || result.saved) return;
  button.disabled = true;
  try {
    await api("/api/drafts", {
      method: "POST",
      body: {
        content: result.answer,
        topic: app.writeForm.topic || result.brief?.split("\n")[0] || ui("无标题草稿", "Untitled draft"),
        platform: app.writeForm.platform,
        audience: app.writeForm.audience,
      },
    });
    result.saved = true;
    toast(t("草稿已保存到 Library。"), "ok");
    await loadState();
  } catch (error) {
    toast(error.message, "err");
    button.disabled = false;
  }
}

/* ---------- guard ---------- */

function renderGuard() {
  const report = app.guard;
  const reportHtml = guardReportHtml(report);

  return (
    viewHead({
      kicker: t("Before you publish"),
      title: viewLabel("guard"),
      lead: t("发布前的一道机械检查：绝对化措辞、无引用断言、句长偏离、引用覆盖率。它不做审美判断。"),
    }) +
    `<div class="guard-grid">
      <form class="card" id="guardForm">
        <div class="card-head"><div><h2>${t("Text")}</h2><p>${t("草稿、回复、帖子都行。")}</p></div><span class="chip" id="guardCount">${t("{n} 字", { n: app.guardText.length })}</span></div>
        <label class="field"><span>${t("Draft")}</span><textarea id="guardText" rows="14" placeholder="${t("粘贴要检查的文本…")}">${esc(app.guardText)}</textarea></label>
        <div class="form-foot">
          <span class="note">${t("基于 {n} 条 trait 和 {m} 项语气特征。", { n: app.data.counts?.traits ?? 0, m: (app.data.voice || []).length })}</span>
          <div style="display:flex;gap:7px">
            <button class="btn ghost sm" type="button" data-action="clear-guard">${t("清空")}</button>
            <button class="btn primary" type="submit" ${app.guardBusy ? "disabled" : ""}>${icon("guard")}${t("Run guard")}</button>
          </div>
        </div>
      </form>
      <section class="card">
        <div class="card-head"><div><h2>${t("Report")}</h2><p>${app.guard ? t("按严重程度排序。") : t("结果会出现在这里。")}</p></div></div>
        ${reportHtml}
      </section>
    </div>`
  );
}

const GUARD_TITLES = {
  "Absolute claims": "绝对化措辞",
  "Tension with a taboo": "与禁忌冲突",
  "Unsupported claims": "无依据断言",
  "Unbacked personal narrative": "没有来源的个人叙述",
  "Style distance": "风格偏离",
  "Punctuation drift": "标点漂移",
  "Disputed claim": "说法有争议",
  "Unverified claim": "说法未核实",
  "Single-source claim": "只有单一来源",
  "Stale claim": "说法可能过期",
  "Low citation coverage": "引用覆盖率低",
};

function localizedFinding(finding) {
  if (!isZh()) return finding;
  let detail = finding.detail;
  const absolute = detail.match(/^Found (\d+) absolute phrases?/);
  const unsupported = detail.match(/^(\d+) sentences? make a claim/);
  const taboo = detail.match(/^The draft uses language close to a declared taboo: “(.+)”\.$/);
  const style = detail.match(/^Average sentence length is (\d+) characters; your vault averages (\d+)\.$/);
  const exclaim = detail.match(/^(\d+) exclamation marks? across (\d+) sentences\.$/);
  const coverage = detail.match(/^Only (\d+)% of sentences carry a citation or an inference marker\.$/);
  if (absolute) detail = `发现 ${absolute[1]} 处难以用笔记支撑的绝对化措辞。`;
  else if (unsupported) detail = `${unsupported[1]} 句没有引用，也没有标出 inference。`;
  else if (taboo) detail = `草稿使用了接近已声明禁忌的措辞：“${taboo[1]}”。`;
  else if (destructureUnbacked(detail)) detail = "第一人称叙述没有笔记引用。persona 不应替你编排经历，即使标了 inference。";
  else if (style) detail = `平均句长 ${style[1]} 字；你的库平均 ${style[2]} 字。`;
  else if (exclaim) detail = `${exclaim[2]} 句里有 ${exclaim[1]} 个感叹号。`;
  else if (coverage) detail = `只有 ${coverage[1]}% 的句子带引用或 inference 标记。`;
  return { ...finding, title: GUARD_TITLES[finding.title] || finding.title, detail };
}

function destructureUnbacked(detail) {
  return detail.startsWith("A first-person anecdote has no note citation.");
}

function guardReportHtml(report) {
  if (!report) {
    return `<div class="empty"><span class="ring">${icon("guard")}</span><strong>${t("还没有检查结果")}</strong><span>${t("贴一段草稿，或在知识库里写完后点「查看检查」。")}</span></div>`;
  }
  const findings = (report.findings || []).map(localizedFinding);
  return `<div class="guard-score"><strong>${report.summary.coverage}%</strong><span>${t("句子带引用或标注 · {sentences} 句 · {findings} 项发现", { sentences: report.summary.sentences, findings: findings.length })}</span></div>
    ${
      findings.length
        ? findings
            .map(
              (finding) => `<div class="finding ${finding.severity}">
                <div class="finding-head"><strong>${esc(finding.title)}</strong><span class="pill ${finding.severity === "high" ? "rejected" : finding.severity === "medium" ? "candidate" : "outdated"}">${esc(severityLabel(finding.severity))}</span></div>
                <p>${esc(finding.detail)}</p>
                ${finding.evidence ? `<div class="ev">${esc(finding.evidence)}</div>` : ""}
              </div>`,
            )
            .join("")
        : `<div class="empty small"><span class="ring">${icon("check")}</span><strong>${t("没有自动发现的问题")}</strong><span>${t("这不等同于可以发布。Guard 只看可计算的部分。")}</span></div>`
    }`;
}

function bindGuard() {
  const form = $("#guardForm");
  const textarea = $("#guardText");
  if (!form || !textarea) return;

  textarea.addEventListener("input", () => {
    app.guardText = textarea.value;
    const count = $("#guardCount");
    if (count) count.textContent = t("{n} 字", { n: textarea.value.length });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (app.guardBusy) return;
    if (!app.guardText.trim()) {
      toast(t("先贴一段文本。"), "err");
      textarea.focus();
      return;
    }
    app.guardBusy = true;
    render();
    try {
      app.guard = await api("/api/guard", { method: "POST", body: { text: app.guardText } });
    } catch (error) {
      toast(error.message, "err");
    } finally {
      app.guardBusy = false;
      render();
    }
  });

  $$('#view [data-action="clear-guard"]').forEach((button) => {
    button.addEventListener("click", () => {
      app.guardText = "";
      app.guard = null;
      render();
    });
  });
}

/* ---------- timeline ---------- */

function renderTimeline() {
  const items = app.data.timeline;
  const observed = app.data.timelineKind === "observed_traits";

  const body = items.length
    ? `<div class="tl">${items
        .map((item) => {
          const polarity = Number(item.polarity) || 0;
          const tone = polarity > 0.2 ? "pos" : polarity < -0.2 ? "neg" : "";
          const label = polarity > 0.2 ? t("正向") : polarity < -0.2 ? t("反向") : t("中性");
          return `<div class="tl-item ${tone}">
            <div class="tl-date">${fmtDate(item.observedAt)}</div>
            <div class="tl-topic">${esc(item.topic)} <span class="polarity ${tone}">${label}</span></div>
            ${item.quote ? `<p class="tl-quote">${esc(item.quote)}</p>` : ""}
            ${item.notePath ? `<button class="tl-note" data-note="${esc(item.notePath)}">${icon("note")}${esc(item.notePath)}</button>` : ""}
          </div>`;
        })
        .join("")}</div>`
    : `<div class="empty"><span class="ring">${icon("timeline")}</span><strong>${t("还没有立场记录")}</strong><span>${t("等笔记里出现可识别的 stance 句，或把 stance_events 写进库。")}</span></div>`;

  return (
    viewHead({
      kicker: t("How you changed"),
      title: viewLabel("timeline"),
      lead: observed
        ? t("目前显示的是单次观察到的立场。同一话题再次出现、极性变化时，这里会开始显示「变化」。")
        : t("同一话题的立场变化，按观察时间排列。"),
      actions: `<span class="chip">${t("{n} observations", { n: items.length })}</span>`,
    }) + `<section class="card">${body}</section>`
  );
}

function bindTimeline() {
  $$("#view [data-note]").forEach((button) => {
    button.addEventListener("click", () => openNote(button.dataset.note));
  });
}

/* ---------- library ---------- */

function renderLibrary() {
  const drafts = app.data.drafts;
  const published = app.data.publish;

  const draftCards = drafts.length
    ? `<div class="draft-grid">${drafts
        .map(
          (draft) => `<button class="draft-card" data-draft="${esc(draft.id)}">
            <span class="draft-top"><span>${esc(platformLabel(draft.platform))}</span><span class="pill ${esc(draft.status)}">${esc(statusLabel(draft.status))}</span></span>
            <span class="draft-topic">${esc(draft.topic)}</span>
            <span class="draft-preview">${esc(draft.preview)}</span>
            <span class="draft-foot"><span>${t("{n} 句", { n: draft.sentenceCount })}</span><span>${fmtDate(draft.updatedAt)}</span></span>
          </button>`,
        )
        .join("")}</div>`
    : `<div class="empty"><span class="ring">${icon("library")}</span><strong>${t("还没有草稿")}</strong><span>${t("回到知识库写一篇，然后保存到这里。")}</span></div>`;

  const publishRows = published.length
    ? `<div style="overflow-x:auto"><table class="table"><thead><tr><th>${t("Platform")}</th><th>${t("Topic")}</th><th>${t("Published")}</th><th>${t("Link")}</th></tr></thead><tbody>${published
        .map(
          (record) => `<tr>
            <td>${esc(platformLabel(record.platform))}</td>
            <td>${esc(record.topic)}</td>
            <td class="nowrap">${fmtDate(record.publishedAt || record.createdAt)}</td>
            <td>${record.url ? `<a href="${esc(record.url)}" target="_blank" rel="noreferrer noopener">${t("打开")}</a>` : `<span class="muted">—</span>`}</td>
          </tr>`,
        )
        .join("")}</tbody></table></div>`
    : `<div class="empty small"><strong>${t("还没有发布记录")}</strong><span>${t("在草稿里记录平台和链接；这会同时写入本地 publish_records。")}</span></div>`;

  return (
    viewHead({
      title: viewLabel("library"),
      lead: t("草稿与发布记录都在本地。Pi-Mirror 不代你发帖，只记录事实。"),
      actions: `<a class="btn ghost" href="#/mirror?mode=write">${icon("write")}${t("New draft")}</a>`,
    }) +
    `<div class="stack">
      <section class="card">
        <div class="card-head"><div><h2>${t("Drafts")}</h2><p>${t("{n} 篇 · 点开查看全文与状态。", { n: drafts.length })}</p></div></div>
        ${draftCards}
      </section>
      <section class="card">
        <div class="card-head"><div><h2>${t("Published")}</h2><p>${t("{n} 条记录。", { n: published.length })}</p></div></div>
        ${publishRows}
      </section>
    </div>`
  );
}

function bindLibrary() {
  $$("#view [data-draft]").forEach((button) => {
    button.addEventListener("click", () => openDraft(button.dataset.draft));
  });
}

/* ---------- studio ---------- */

const CLAIM_STATUS_LABELS = {
  confirmed: ["confirmed", "已核实"],
  "single-source": ["single source", "单一来源"],
  disputed: ["disputed", "有争议"],
  unverified: ["unverified", "未核实"],
  stale: ["stale", "可能过期"],
  opinion: ["opinion", "观点"],
};

const STUDIO_FORMATS = {
  note: ["Note", "笔记"],
  article: ["Article", "长文"],
  script: ["Script", "视频文案"],
};

const FOLLOWER_TIERS = {
  nano: ["nano", "纳米"],
  micro: ["micro", "微型"],
  mid: ["mid", "中腰部"],
  macro: ["macro", "头部"],
  unknown: ["unknown", "未知"],
};

const SOURCE_KINDS = {
  note: ["note", "笔记"],
  web: ["web", "网页"],
  reference: ["reference", "参考"],
};

function claimStatusLabel(status) {
  const row = CLAIM_STATUS_LABELS[status];
  return row ? (isZh() ? row[1] : row[0]) : status;
}

function formatLabel(format) {
  const row = STUDIO_FORMATS[format] || [format, format];
  return isZh() ? row[1] : row[0];
}

function tierLabel(tier) {
  const row = FOLLOWER_TIERS[tier] || [tier, tier];
  return isZh() ? row[1] : row[0];
}

function sourceKindLabel(kind) {
  const row = SOURCE_KINDS[kind] || [kind, kind];
  return isZh() ? row[1] : row[0];
}

function fmtDuration(ms) {
  if (ms === null || ms === undefined) return "";
  const n = Number(ms);
  if (!Number.isFinite(n)) return "";
  return n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(1)} s`;
}

function renderStudio() {
  const run = app.studio.run;
  const busy = app.studio.busy;
  const showCompose = !run || app.studio.composeOpen;
  const platformOptions = PLATFORMS.map(
    ([id]) => `<option value="${id}" ${app.studio.platform === id ? "selected" : ""}>${platformLabel(id)}</option>`,
  ).join("");

  const compose = `<form class="card studio-compose" id="studioCompose">
    <div class="studio-compose-head">
      <div>
        <div class="kicker">${ui("目标进来，路径由它决定", "Goal in, path out")}</div>
        <h2>${ui("今天想写什么？", "What do you want to publish?")}</h2>
      </div>
      <span class="studio-agent-tag">${icon("spark")}${ui("pi agent · 真实工具调用", "pi agent · real tool calls")}</span>
    </div>
    <label class="field studio-goal">
      <span>${ui("目标", "Goal")}</span>
      <textarea id="studioGoal" rows="3" placeholder="${ui(
        "例如：今天 X 上 Cursor 的多人协作很热。先核实，再从我的笔记里找一个角度，写成小红书笔记。",
        "e.g. Cursor multiplayer is hot on X today. Verify it, pick an angle from my notes, and draft a Xiaohongshu note.",
      )}">${esc(app.studio.goal)}</textarea>
    </label>
    <div class="studio-quick">
      ${[
        ["今天 X 上有什么值得写？先核实，再选一个角度。", "What is worth writing about on X today? Verify it, then pick an angle."],
        ["从我的笔记里找今天的方向，不要追和我无关的热点。", "Find today's direction in my notes. Don't chase topics I don't care about."],
        ["把这个热点写成小红书笔记：先核实事实，再参考低粉高赞的结构。", "Turn this hot topic into a Xiaohongshu note: verify facts, then borrow structure from low-follower, high-engagement posts."],
      ]
        .map(
          ([zh, en]) =>
            `<button class="studio-quick-btn" type="button" data-studio-suggest="${esc(ui(zh, en))}">${esc(ui(zh, en))}</button>`,
        )
        .join("")}
    </div>
    <div class="studio-controls">
      <label class="field"><span>${ui("平台", "Platform")}</span><select id="studioPlatform">${platformOptions}</select></label>
      <label class="field"><span>${ui("写给谁", "Audience")}</span><input id="studioAudience" value="${esc(app.studio.audience)}" placeholder="${ui("例如：做 AI 产品的人", "e.g. people building AI products")}" /></label>
      <div class="studio-start">
        <button class="btn primary" type="submit" ${busy ? "disabled" : ""}>${icon(busy ? "refresh" : "spark")}${busy ? ui("agent 正在跑…", "agent running…") : ui("开始", "Start")}</button>
        <span class="studio-start-hint">${ui("通常 2–6 分钟 · 工具调用会实时出现", "Usually 2–6 min · tool calls appear live")}</span>
      </div>
    </div>
    <div class="studio-boundary">${ui(
      "它会检索网页、读取你的笔记、核实说法、参考公开笔记的结构。它不会自动发帖；成稿要你点保存。",
      "It searches the web, reads your notes, verifies claims and studies public posts. It never publishes; you save the draft.",
    )}</div>
  </form>`;

  const runTitle = run?.package?.title || run?.goal || ui("新的目标", "New goal");
  const titleBar = `<div class="studio-titlebar">
    <h1 class="studio-title" title="${esc(runTitle)}">${esc(runTitle)}</h1>
    <div class="studio-title-actions">
      <button class="btn ghost sm" type="button" data-studio-action="new-goal">${icon("write")}${ui("新目标", "New goal")}</button>
      <a class="btn ghost sm" href="#/library">${icon("library")}${t("Library")}</a>
    </div>
  </div>`;

  const center = `${titleBar}
    ${showCompose ? compose : ""}
    ${run ? "" : renderStudioIdle()}
    ${run?.package ? renderStudioPackage(run) : ""}
    ${run && !run.package ? renderStudioPackage(run) : ""}
    <div class="studio-recent-inline">${renderStudioRecent()}</div>`;

  const side = `${run ? renderStudioRun(run) : ""}${renderReferencePanel()}`;

  // On a desktop the shell owns the viewport: the center scrolls, the right
  // rail stays put and only scrolls while the pointer is over it.
  return `<div class="studio-shell">
    <div class="studio-center">${center}</div>
    <aside class="studio-side">${side}</aside>
  </div>`;
}

function renderStudioIdle() {
  const items = [
    ["globe", ui("扫热点", "Scan trends"), ui("从 X、Techmeme 或本地热点包看今天在发生什么。", "X, Techmeme or a local trend pack — what is moving today.")],
    ["search", ui("查公开资料", "Search the web"), ui("找到原始公告、报道和反证，而不是只看一条帖子。", "Find the original announcement, coverage and counter-evidence.")],
    ["guard", ui("核实说法", "Verify claims"), ui("给关键说法标上 confirmed、single-source 或 unverified。", "Mark key claims confirmed, single-source or unverified.")],
    ["note", ui("翻你的笔记", "Read your notes"), ui("找旧观点、旧例子和语气，不凭空编经历。", "Find old arguments, examples and voice — never invent history.")],
    ["library", ui("借参考结构", "Study references"), ui("看低粉高赞笔记的开头、节奏和结构，只借方法不抄句子。", "Study hooks and structure from high-engagement posts; never copy sentences.")],
    ["check", ui("自检后再交", "Guard the draft"), ui("提交前先跑 Guard，引用覆盖率和风险一起给你。", "Run Guard before submitting: citation coverage and risks together.")],
  ];
  return `<section class="card studio-idle">
    <div class="studio-idle-head">
      <div>
        <div class="kicker">${ui("不是固定流水线", "No fixed pipeline")}</div>
        <h2>${ui("同一条目标，它自己决定先做什么", "Same goal, it decides where to start")}</h2>
        <p>${ui(
          "下面不是写死的步骤顺序，而是它可以调用的能力。计划由模型在运行时提交；有的目标先看热点，有的目标先翻你的旧笔记。",
          "These are capabilities, not a fixed order. The plan is written by the model at runtime: some goals start with trends, others start with your old notes.",
        )}</p>
      </div>
    </div>
    <div class="capability-grid">
      ${items
        .map(
          ([iconName, title, desc]) => `<div class="capability">
            <span class="capability-icon">${icon(iconName)}</span>
            <strong>${esc(title)}</strong>
            <p>${esc(desc)}</p>
          </div>`,
        )
        .join("")}
    </div>
  </section>`;
}

function renderStudioRun(run) {
  const plan = Array.isArray(run.plan) ? run.plan : [];
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const sources = Array.isArray(run.sources) ? run.sources : [];
  const claims = Array.isArray(run.claims) ? run.claims : [];
  const planDone = plan.filter((step) => step.status === "done").length;
  const running = run.status === "running" || run.status === "queued";

  const planHtml = plan.length
    ? `<ol class="run-plan">${plan
        .map(
          (step) => `<li class="plan-step ${esc(step.status)}">
            <span class="plan-marker">${step.status === "done" ? "✓" : step.status === "active" ? "●" : step.status === "skipped" ? "–" : "○"}</span>
            <span>${esc(step.title)}</span>
          </li>`,
        )
        .join("")}</ol>`
    : `<p class="run-empty">${ui("还没有提交计划。它可能正在决定从哪里开始。", "No plan yet. It may still be deciding where to start.")}</p>`;

  const traceHtml = steps.length
    ? `<div class="run-trace">${steps
        .map(
          (step) => `<div class="trace-step ${esc(step.status)}">
            <span class="trace-dot"></span>
            <div class="trace-main">
              <div class="trace-title">
                <b>${esc(step.title || step.tool || "tool")}</b>
                ${step.tool ? `<code>${esc(step.tool)}</code>` : ""}
                ${step.durationMs !== null && step.durationMs !== undefined ? `<span>${fmtDuration(step.durationMs)}</span>` : ""}
                ${step.status === "running" ? `<span class="trace-live">${ui("运行中", "live")}</span>` : ""}
              </div>
              ${step.detail ? `<p>${esc(step.detail)}</p>` : ""}
            </div>
          </div>`,
        )
        .join("")}</div>`
    : `<p class="run-empty">${ui("还没有工具调用。", "No tool calls yet.")}</p>`;

  const sourceHtml = sources.length
    ? `<div class="run-sources">${sources
        .map(
          (source) => `<button class="run-source" data-studio-source="${source.number}" type="button">
            <b>[${source.number}]</b>
            <span class="run-source-main">
              <strong>${esc(source.title)}</strong>
              <small>${esc(sourceKindLabel(source.kind))}${source.locator ? ` · ${esc(source.locator)}` : ""}</small>
            </span>
          </button>`,
        )
        .join("")}</div>`
    : `<p class="run-empty">${ui("还没有来源。", "No sources yet.")}</p>`;

  const claimHtml = claims.length
    ? `<div class="run-claims">${claims
        .map(
          (claim) => `<div class="run-claim">
            <span class="claim-status ${esc(claim.status)}">${esc(claimStatusLabel(claim.status))}</span>
            <span>${esc(claim.text)}</span>
          </div>`,
        )
        .join("")}</div>`
    : "";

  return `<section class="card studio-run">
    <div class="studio-run-head">
      <div class="studio-run-title">
        <span class="run-status ${esc(run.status)}"><i></i>${esc(statusLabel(run.status))}</span>
        <h2>${esc(run.goal)}</h2>
        <div class="run-meta">
          ${run.platform ? `<span>${esc(platformLabel(run.platform))}</span>` : ""}
          <span>${fmtDateTime(run.createdAt)}</span>
          ${run.model ? `<span>${esc(shortModel(run.model))}</span>` : ""}
          ${run.draftId ? `<span class="run-saved">${icon("check")}${ui("已保存", "saved")}</span>` : ""}
        </div>
      </div>
      <span class="chip">${esc(run.id)}</span>
    </div>
    ${run.error ? `<div class="run-error">${esc(run.error)}</div>` : ""}
    ${running ? `<div class="run-live"><span class="typing"><i></i><i></i><i></i></span><span>${ui("agent 正在调用工具，轨迹会自动刷新。", "The agent is calling tools; the trace refreshes automatically.")}</span></div>` : ""}
    <div class="run-block">
      <div class="run-block-head"><span>${ui("计划", "Plan")}</span><span>${planDone}/${plan.length}</span></div>
      ${planHtml}
    </div>
    <div class="run-block">
      <div class="run-block-head"><span>${ui("工具轨迹", "Tool trace")}</span><span>${steps.length}</span></div>
      ${traceHtml}
    </div>
    <div class="run-block">
      <div class="run-block-head"><span>${ui("证据", "Evidence")}</span><span>${sources.length}</span></div>
      ${sourceHtml}
    </div>
    ${claimHtml ? `<div class="run-block"><div class="run-block-head"><span>${ui("核实过的说法", "Checked claims")}</span><span>${claims.length}</span></div>${claimHtml}</div>` : ""}
  </section>`;
}

function renderStudioPackage(run) {
  const pkg = run.package;
  if (!pkg) {
    if (run.status === "error") return "";
    return `<section class="card studio-package is-waiting">
      <div class="card-head"><div><h2>${ui("内容包", "Content package")}</h2><p>${ui("只有通过校验的内容包才会出现在这里。", "Only a package that passes validation appears here.")}</p></div></div>
      <div class="empty small"><span class="ring">${icon("write")}</span><strong>${ui("还在写", "Still working")}</strong><span>${ui("agent 会先查、先核实，再调用 submit_package。", "The agent researches and verifies before calling submit_package.")}</span></div>
    </section>`;
  }

  const sources = (run.sources || []).map((source) => ({
    number: source.number,
    path: source.locator || source.title,
  }));
  const claims = Array.isArray(pkg.claims) && pkg.claims.length ? pkg.claims : run.claims || [];
  const refs = Array.isArray(pkg.referencesUsed) ? pkg.referencesUsed : [];
  const referenceIndex = new Map((app.studio.references || []).map((item) => [item.id, item]));
  const angles = Array.isArray(pkg.angles) ? pkg.angles : [];
  const variants = Array.isArray(pkg.variants) ? pkg.variants : [];

  return `<section class="card studio-package" id="studioPackage">
    <div class="studio-package-top">
      <div class="result-meta">
        <span class="chip">${esc(platformLabel(pkg.platform || run.platform || "xiaohongshu"))}</span>
        <span class="chip">${esc(formatLabel(pkg.format))}</span>
        <span class="chip">${t("{n} 字", { n: pkg.body.length })}</span>
        ${run.guard ? guardChips(run.guard) : ""}
      </div>
      <span class="pill ${run.draftId ? "published" : "draft"}">${run.draftId ? ui("已保存", "saved") : ui("未保存", "not saved")}</span>
    </div>
    <p class="package-angle">${esc(pkg.angle || pkg.chosenAngle)}</p>

    <div class="package-why">
      <span>${ui("为什么是现在", "Why now")}</span>
      <p>${esc(pkg.whyNow)}</p>
    </div>

    ${pkg.titleOptions?.length ? `<div class="package-block"><div class="run-block-head"><span>${ui("标题候选", "Title options")}</span><span>${pkg.titleOptions.length}</span></div>
      <div class="title-options">${pkg.titleOptions
        .map((title) => `<button class="title-option" type="button" data-studio-copy="${esc(title)}" title="${ui("复制", "Copy")}">${esc(title)}</button>`)
        .join("")}</div></div>` : ""}

    <div class="package-block">
      <div class="run-block-head"><span>${ui("正文", "Draft")}</span><span>${ui("引用编号可点开", "citations open sources")}</span></div>
      <div class="prose package-body">${renderMd(pkg.body, -2, sources)}</div>
    </div>

    ${claims.length ? `<div class="package-block">
      <div class="run-block-head"><span>${ui("关键说法", "Claims")}</span><span>${claims.length}</span></div>
      <div class="package-claims">${claims
        .map(
          (claim) => `<div class="package-claim">
            <span class="claim-status ${esc(claim.status)}">${esc(claimStatusLabel(claim.status))}</span>
            <span>${esc(claim.text)}</span>
            ${claim.sources?.length ? `<small>${claim.sources.map((n) => `[${n}]`).join(" ")}</small>` : ""}
          </div>`,
        )
        .join("")}</div>
    </div>` : ""}

    ${angles.length ? `<div class="package-block">
      <div class="run-block-head"><span>${ui("备选角度", "Other angles")}</span><span>${angles.length}</span></div>
      <div class="angle-grid">${angles
        .map(
          (angle) => `<button class="angle-card" type="button" data-studio-angle="${esc(angle.title)}">
            <strong>${esc(angle.title)}</strong>
            <p>${esc(angle.rationale)}</p>
            <span class="angle-foot">${angle.evidence?.length ? angle.evidence.map((n) => `[${n}]`).join(" ") : ui("无引用", "no citations")}${angle.risk ? ` · ${esc(angle.risk)}` : ""}</span>
          </button>`,
        )
        .join("")}</div>
      <p class="package-hint">${ui("点一个角度，会把它填回上面的目标；不会自动重跑。", "Pick an angle to put it back into the goal; it won't rerun automatically.")}</p>
    </div>` : ""}

    ${refs.length ? `<div class="package-block">
      <div class="run-block-head"><span>${ui("参考过的笔记", "References used")}</span><span>${refs.length}</span></div>
      <div class="package-refs">${refs
        .map((ref) => {
          const item = referenceIndex.get(ref.id);
          return `<div class="package-ref">
            <strong>${esc(item?.title || ref.id)}</strong>
            <span>${esc(ref.pattern || (item?.patterns || []).slice(0, 2).join(" · ") || ui("结构参考", "structure"))}</span>
          </div>`;
        })
        .join("")}</div>
    </div>` : ""}

    ${pkg.questions?.length ? `<div class="package-block">
      <div class="run-block-head"><span>${ui("还需要你确认", "Open questions")}</span><span>${pkg.questions.length}</span></div>
      <ul class="package-list">${pkg.questions.map((question) => `<li>${esc(question)}</li>`).join("")}</ul>
    </div>` : ""}

    ${pkg.risks?.length ? `<div class="package-block">
      <div class="run-block-head"><span>${ui("风险", "Risks")}</span><span>${pkg.risks.length}</span></div>
      <ul class="package-list risks">${pkg.risks.map((risk) => `<li>${esc(risk)}</li>`).join("")}</ul>
    </div>` : ""}

    ${variants.length ? `<div class="package-block">
      <div class="run-block-head"><span>${ui("平台变体", "Platform variants")}</span><span>${variants.length}</span></div>
      <div class="variants">${variants
        .map(
          (variant) => `<details class="variant">
            <summary><span>${esc(platformLabel(variant.platform))}</span><small>${t("{n} 字", { n: variant.body.length })}</small></summary>
            <div class="variant-body">${esc(variant.body)}</div>
            <button class="btn ghost sm" type="button" data-studio-copy="${esc(variant.body)}">${icon("copy")}${t("复制")}</button>
          </details>`,
        )
        .join("")}</div>
    </div>` : ""}

    ${run.guard ? `<details class="package-guard">
      <summary>${icon("guard")}${ui("发布前检查", "Pre-publish check")}${guardChips(run.guard)}</summary>
      <div class="package-guard-body">${guardReportHtml(run.guard)}</div>
    </details>` : ""}

    <div class="result-actions">
      <button class="btn primary sm" type="button" data-studio-action="save" ${run.draftId ? "disabled" : ""}>${icon("check")}${run.draftId ? ui("已保存", "Saved") : ui("保存到作品库", "Save to Library")}</button>
      <button class="btn ghost sm" type="button" data-studio-action="copy">${icon("copy")}${t("复制")}</button>
      ${run.draftId ? `<a class="btn ghost sm" href="#/library">${icon("library")}${ui("打开作品库", "Open Library")}</a>` : ""}
    </div>
  </section>`;
}

function renderStudioRecent() {
  const runs = app.studio.runs || [];
  return `<section class="card studio-recent">
    <div class="card-head">
      <div><h2>${ui("最近的运行", "Recent runs")}</h2><p>${ui("每次目标都会留下计划、轨迹和成稿。", "Every goal leaves a plan, trace and package.")}</p></div>
      <button class="icon-btn" type="button" data-studio-action="refresh" aria-label="${ui("刷新", "Refresh")}">${icon("refresh")}</button>
    </div>
    ${
      runs.length
        ? `<div class="run-list">${runs
            .map(
              (run) => `<button class="run-row ${run.id === app.studio.run?.id ? "is-active" : ""}" type="button" data-studio-run="${esc(run.id)}">
                <span class="run-row-top"><span class="run-status ${esc(run.status)}"><i></i>${esc(statusLabel(run.status))}</span><span>${fmtDateTime(run.createdAt)}</span></span>
                <strong>${esc(run.goal)}</strong>
                <span class="run-row-foot">${run.package ? esc(run.package.title) : ui("还没有内容包", "no package yet")}</span>
              </button>`,
            )
            .join("")}</div>`
        : `<div class="empty small"><span class="ring">${icon("spark")}</span><strong>${ui("还没有运行", "No runs yet")}</strong><span>${ui("给一个目标，它就会开始。", "Give it a goal and it starts.")}</span></div>`
    }
  </section>`;
}

function renderRailRecent() {
  const box = $("#railRecent");
  if (!box) return;
  const runs = (app.studio?.runs || []).slice(0, 6);
  const show = app.view === "studio" && runs.length > 0;
  box.hidden = !show;
  if (!show) return;

  $("#railRecentHead").textContent = ui("最近的运行", "Recent runs");
  const list = $("#railRecentList");
  list.innerHTML = runs
    .map(
      (run) => `<button class="rail-run ${run.id === app.studio.run?.id ? "is-active" : ""}" type="button" data-rail-run="${esc(run.id)}" title="${esc(run.goal)}">
        <span class="rail-run-top"><i class="rail-dot ${esc(run.status)}"></i><time>${fmtDateTime(run.createdAt)}</time></span>
        <span class="rail-run-title">${esc(run.package?.title || run.goal)}</span>
      </button>`,
    )
    .join("");
  $$("#railRecentList [data-rail-run]").forEach((button) => {
    button.addEventListener("click", () => void loadStudioRun(button.dataset.railRun));
  });
}

function renderReferencePanel() {
  if (!featureLoaded("reference")) return "";
  const refs = app.studio.references || [];
  const count = app.studio.refCount || refs.length;
  return `<section class="card studio-refs">
    <div class="card-head">
      <div><h2>${ui("参考库", "Reference library")}</h2><p>${ui("低粉高赞优先，只借结构不抄句子。", "Low-follower, high-engagement posts; structure only, never sentences.")}</p></div>
      <button class="btn ghost sm" type="button" data-studio-action="toggle-import">${icon("library")}${ui("导入", "Import")}</button>
    </div>
    ${app.studio.importOpen ? renderReferenceForm() : ""}
    ${
      refs.length
        ? `<div class="ref-list">${refs
            .slice(0, 8)
            .map(
              (ref) => `<button class="ref-item" type="button" data-ref-id="${esc(ref.id)}">
                <span class="ref-top">
                  <span class="ref-platform">${esc(platformLabel(ref.platform))}</span>
                  <span class="ref-tier">${esc(tierLabel(ref.followerTier))}</span>
                  <span class="ref-engagement">${ui("互动", "eng")} ${Math.round(ref.engagement)}</span>
                </span>
                <strong>${esc(ref.title || ui("无标题", "Untitled"))}</strong>
                <span class="ref-meta">${[
                  ref.author,
                  ref.followers !== null ? `${ref.followers} ${ui("粉", "followers")}` : "",
                  ref.likes !== null ? `${ref.likes} ${ui("赞", "likes")}` : "",
                  ref.collects !== null ? `${ref.collects} ${ui("藏", "saves")}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}</span>
                <span class="ref-patterns">${(ref.patterns || []).slice(0, 3).map((pattern) => `<span>${esc(pattern)}</span>`).join("")}</span>
              </button>`,
            )
            .join("")}</div>`
        : `<div class="empty small"><span class="ring">${icon("library")}</span><strong>${ui("还没有参考笔记", "No references yet")}</strong><span>${ui("贴一条公开帖子的链接或正文，Studio 会拆结构。", "Paste a public post URL or body; Studio will analyze its structure.")}</span></div>`
    }
    ${refs.length ? `<div class="ref-foot">${ui("{n} 篇在本地。", "{n} posts on this machine.").replace("{n}", String(count))}</div>` : ""}
  </section>`;
}

function renderReferenceForm() {
  return `<form class="ref-form" id="studioRefForm">
    <label class="field"><span>${ui("公开链接", "Public URL")}</span><input name="url" placeholder="https://x.com/…" /></label>
    <div class="two-col">
      <label class="field"><span>${ui("平台", "Platform")}</span><select name="platform">${PLATFORMS.map(
        ([id]) => `<option value="${id}">${platformLabel(id)}</option>`,
      ).join("")}</select></label>
      <label class="field"><span>${ui("作者", "Author")}</span><input name="author" placeholder="@handle" /></label>
    </div>
    <label class="field"><span>${ui("标题", "Title")}</span><input name="title" placeholder="${ui("可留空，从链接抓取", "Optional; fetched from URL")}" /></label>
    <label class="field"><span>${ui("正文", "Body")}</span><textarea name="body" rows="3" placeholder="${ui("链接抓不到时，把帖子正文贴进来", "If the URL is not public, paste the post body")}"></textarea></label>
    <div class="ref-metrics">
      <label class="field"><span>${ui("粉丝", "Followers")}</span><input name="followers" inputmode="numeric" placeholder="0" /></label>
      <label class="field"><span>${ui("赞", "Likes")}</span><input name="likes" inputmode="numeric" placeholder="0" /></label>
      <label class="field"><span>${ui("收藏", "Saves")}</span><input name="collects" inputmode="numeric" placeholder="0" /></label>
      <label class="field"><span>${ui("评论", "Comments")}</span><input name="comments" inputmode="numeric" placeholder="0" /></label>
    </div>
    <div class="form-foot">
      <span class="note">${ui("指标可以留空；不知道就不要编。", "Metrics are optional. Don't invent them.")}</span>
      <button class="btn primary sm" type="submit">${icon("library")}${ui("导入并拆解", "Import & analyze")}</button>
    </div>
  </form>`;
}

function bindStudio() {
  const form = $("#studioCompose");
  const goal = $("#studioGoal");
  if (form && goal) {
    goal.addEventListener("input", () => {
      app.studio.goal = goal.value;
    });
    $("#studioPlatform")?.addEventListener("change", (event) => {
      app.studio.platform = event.target.value;
    });
    $("#studioAudience")?.addEventListener("input", (event) => {
      app.studio.audience = event.target.value;
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void startStudio();
    });
  }

  $$("#view [data-studio-suggest]").forEach((button) => {
    button.addEventListener("click", () => {
      app.studio.goal = button.dataset.studioSuggest || "";
      const field = $("#studioGoal");
      if (field) {
        field.value = app.studio.goal;
        field.focus();
      }
    });
  });

  $$("#view [data-studio-run]").forEach((button) => {
    button.addEventListener("click", () => void loadStudioRun(button.dataset.studioRun));
  });

  $$("#view [data-studio-source]").forEach((button) => {
    button.addEventListener("click", () => openStudioSource(Number(button.dataset.studioSource)));
  });

  $$("#view [data-studio-angle]").forEach((button) => {
    button.addEventListener("click", () => {
      const base = app.studio.goal || app.studio.run?.goal || "";
      app.studio.goal = `${base}\n\n${ui("优先从这个角度写：", "Prioritize this angle: ")}${button.dataset.studioAngle}`;
      render();
      $("#studioGoal")?.focus();
    });
  });

  $$("#view [data-studio-copy]").forEach((button) => {
    button.addEventListener("click", () => copyText(button.dataset.studioCopy || ""));
  });

  $$("#view [data-studio-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.studioAction;
      if (action === "save") void saveStudioDraft(button);
      if (action === "copy") copyText(app.studio.run?.package?.body || "");
      if (action === "new-goal") {
        app.studio.composeOpen = true;
        app.studio.goal = "";
        render();
        $("#studioGoal")?.focus();
      }
      if (action === "toggle-import") {
        app.studio.importOpen = !app.studio.importOpen;
        render();
      }
      if (action === "refresh") void refreshStudioRuns();
    });
  });

  $("#studioPackage")?.addEventListener("click", (event) => {
    const cite = event.target.closest(".cite[data-si]");
    if (cite) {
      event.preventDefault();
      const index = Number(cite.dataset.si);
      const source = (app.studio.run?.sources || [])[index];
      openStudioSource(source?.number ?? index + 1);
    }
  });

  $$("#view [data-ref-id]").forEach((button) => {
    button.addEventListener("click", () => openReference(button.dataset.refId));
  });

  const refForm = $("#studioRefForm");
  if (refForm) {
    refForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void importReference(refForm);
    });
  }

  if (app.studio.pendingRun) {
    const id = app.studio.pendingRun;
    app.studio.pendingRun = null;
    void loadStudioRun(id);
  }
}

async function startStudio(goalOverride) {
  if (app.studio.busy) return;
  const goal = String(goalOverride ?? app.studio.goal).trim();
  if (!goal) {
    toast(ui("先写一个目标。", "Write a goal first."), "err");
    $("#studioGoal")?.focus();
    return;
  }
  app.studio.goal = goal;
  app.studio.busy = true;
  app.studio.error = null;
  app.studio.composeOpen = false;
  app.studio.run = {
    id: "",
    goal,
    platform: app.studio.platform,
    audience: app.studio.audience || null,
    status: "queued",
    plan: [],
    steps: [],
    sources: [],
    claims: [],
    package: null,
    guard: null,
    error: null,
    model: null,
    draftId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    finishedAt: null,
  };
  render();

  try {
    const created = await api("/api/studio/runs", {
      method: "POST",
      body: { goal, platform: app.studio.platform, audience: app.studio.audience || undefined },
    });
    app.studio.run.id = created.id;
    if (app.view === "studio") render();
    startStudioPolling(created.id);
  } catch (error) {
    app.studio.busy = false;
    app.studio.composeOpen = true;
    app.studio.error = error.message;
    app.studio.run.status = "error";
    app.studio.run.error = error.message;
    toast(error.message, "err");
    render();
  }
}

function startStudioPolling(runId) {
  if (!runId || app.studio.pollingId === runId) return;
  app.studio.pollingId = runId;
  const token = ++app.studio.pollToken;
  void pollStudio(runId, token);
}

async function pollStudio(runId, token) {
  while (app.studio.pollToken === token) {
    try {
      const response = await api(`/api/studio/run?id=${encodeURIComponent(runId)}`);
      if (token !== app.studio.pollToken) return;
      const run = response.run;
      app.studio.run = run;
      app.studio.runs = [run, ...(app.studio.runs || []).filter((item) => item.id !== run.id)].slice(0, 8);
      app.studio.busy = run.status === "running" || run.status === "queued";
      if (app.view === "studio" && !document.activeElement?.closest("#studioCompose, #studioRefForm")) {
        render();
      }
      if (!app.studio.busy) {
        app.studio.pollingId = null;
        return;
      }
    } catch (error) {
      if (token !== app.studio.pollToken) return;
      app.studio.busy = false;
      app.studio.pollingId = null;
      app.studio.error = error.message;
      toast(error.message, "err");
      if (app.view === "studio") render();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  app.studio.pollingId = null;
}

async function loadStudioRun(id) {
  if (!id) return;
  try {
    const response = await api(`/api/studio/run?id=${encodeURIComponent(id)}`);
    app.studio.run = response.run;
    app.studio.composeOpen = false;
    app.studio.busy = response.run.status === "running" || response.run.status === "queued";
    if (app.studio.busy) startStudioPolling(id);
    if (app.view === "studio") render();
  } catch (error) {
    toast(error.message, "err");
  }
}

async function refreshStudioRuns() {
  try {
    const response = await api("/api/studio/runs?limit=8");
    app.studio.runs = response.runs || [];
    if (app.view === "studio") render();
  } catch (error) {
    toast(error.message, "err");
  }
}

async function refreshStudioReferences() {
  try {
    const response = await api("/api/references?limit=12");
    app.studio.references = response.references || [];
    app.studio.refCount = response.count ?? app.studio.references.length;
    if (app.view === "studio") render();
  } catch {
    /* reference plugin may not be loaded */
  }
}

async function importReference(form) {
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  const data = new FormData(form);
  const value = (key) => String(data.get(key) || "").trim();
  try {
    await api("/api/references", {
      method: "POST",
      body: {
        url: value("url") || undefined,
        platform: value("platform") || "unknown",
        author: value("author") || undefined,
        title: value("title") || undefined,
        body: value("body") || undefined,
        followers: value("followers") || undefined,
        likes: value("likes") || undefined,
        collects: value("collects") || undefined,
        comments: value("comments") || undefined,
      },
    });
    app.studio.importOpen = false;
    toast(ui("参考笔记已导入。", "Reference imported."), "ok");
    await refreshStudioReferences();
  } catch (error) {
    toast(error.message, "err");
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function saveStudioDraft(button) {
  const run = app.studio.run;
  if (!run?.package || run.draftId) return;
  button.disabled = true;
  try {
    const response = await api("/api/studio/save", { method: "POST", body: { runId: run.id } });
    run.draftId = response.id;
    toast(ui("已保存到作品库。", "Saved to Library."), "ok");
    await loadState();
    render();
  } catch (error) {
    toast(error.message, "err");
    button.disabled = false;
  }
}

function openStudioSource(number) {
  const source = (app.studio.run?.sources || []).find((item) => Number(item.number) === Number(number));
  if (!source) return;
  if (source.kind === "note" && source.locator) {
    openNote(source.locator);
    return;
  }
  const url = source.kind === "web" && source.locator && /^https?:\/\//.test(source.locator) ? source.locator : "";
  openDrawer({
    kicker: `${sourceKindLabel(source.kind)} · [${source.number}]`,
    title: source.title,
    html: `<div class="drawer-meta">
        ${source.locator ? `<span class="chip">${esc(source.locator)}</span>` : ""}
        ${source.publishedAt ? `<span class="chip">${fmtDate(source.publishedAt)}</span>` : ""}
        <span class="chip">${ui("读取于", "read")} ${fmtDateTime(source.retrievedAt)}</span>
      </div>
      ${source.quote ? `<div class="evidence"><blockquote>${esc(source.quote)}</blockquote></div>` : ""}
      ${url ? `<a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noreferrer noopener">${icon("external")}${ui("打开原网页", "Open page")}</a>` : ""}`,
  });
}

function openReference(id) {
  const ref = (app.studio.references || []).find((item) => item.id === id);
  if (!ref) return;
  const stats = [
    ref.followers !== null ? `${ref.followers} ${ui("粉", "followers")}` : "",
    ref.likes !== null ? `${ref.likes} ${ui("赞", "likes")}` : "",
    ref.collects !== null ? `${ref.collects} ${ui("藏", "saves")}` : "",
    ref.comments !== null ? `${ref.comments} ${ui("评", "comments")}` : "",
  ].filter(Boolean);
  openDrawer({
    kicker: `${platformLabel(ref.platform)} · ${tierLabel(ref.followerTier)}`,
    title: ref.title || ui("无标题参考", "Untitled reference"),
    html: `<div class="drawer-meta">
        ${stats.map((item) => `<span class="chip">${esc(item)}</span>`).join("")}
        <span class="chip">${ui("互动", "engagement")} ${Math.round(ref.engagement)}</span>
        ${ref.author ? `<span class="chip">${esc(ref.author)}</span>` : ""}
      </div>
      <h3>${ui("结构拆解", "Structure")}</h3>
      <div class="ref-patterns drawer-patterns">${(ref.patterns || []).map((pattern) => `<span>${esc(pattern)}</span>`).join("")}</div>
      <div class="ref-stats">
        <span>${ui("开头", "Hook")} · ${esc(ref.hook || "—")}</span>
        <span>${ui("句子", "Sentences")} · ${ref.stats.sentences}</span>
        <span>${ui("平均句长", "Avg sentence")} · ${num(ref.stats.avgSentenceLength)}</span>
        <span>${ui("列表行", "List lines")} · ${ref.stats.listLines}</span>
      </div>
      <h3>${ui("正文", "Body")}</h3>
      <div class="drawer-draft">${esc(ref.body)}</div>
      ${ref.url ? `<a class="btn ghost sm" href="${esc(ref.url)}" target="_blank" rel="noreferrer noopener">${icon("external")}${ui("打开原帖", "Open post")}</a>` : ""}`,
  });
}

/* ---------- consent ---------- */

function renderConsent() {
  const records = app.data.consent;
  const cards = consentCards(records);

  return (
    viewHead({
      kicker: t("Boundaries"),
      title: viewLabel("consent"),
      lead: t("每个 scope 都由你显式开关。关闭 publishing 时，发布接口会直接拒绝，而不是静默跳过。"),
    }) +
    `<div class="card">
      <div class="card-head"><div><h2>${t("Scopes")}</h2><p>${t("记录是追加式的：每次开启或撤回都会留下时间线，而不是覆盖旧值。")}</p></div></div>
      <div class="consent-grid">${cards}</div>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="card-head"><div><h2>${t("What this app will never do")}</h2></div></div>
      <div class="stat-row"><span>${t("写入你的笔记")}</span><strong>${t("不会")}</strong></div>
      <div class="stat-row"><span>${t("自动发帖或调用平台发布接口")}</span><strong>${t("不会")}</strong></div>
      <div class="stat-row"><span>${t("在没有 publishing 授权时标记已发布")}</span><strong>${t("不会")}</strong></div>
      <div class="stat-row"><span>${t("把 API key 或 token 写进库")}</span><strong>${t("不会")}</strong></div>
    </div>`
  );
}

function consentCards(records) {
  return records
    .map((record) => {
      const meta = consentMeta(record.scope);
      const metaLine = record.granted
        ? t("granted {time}", { time: fmtDateTime(record.grantedAt) })
        : record.revokedAt
          ? t("revoked {time}", { time: fmtDateTime(record.revokedAt) })
          : t("not granted yet");
      return `<div class="consent-card">
        <div class="consent-top">
          <div><strong>${esc(meta.title)}</strong><code>${esc(record.scope)}</code></div>
          <button class="switch" role="switch" aria-checked="${record.granted ? "true" : "false"}" aria-label="${esc(meta.title)}" data-scope="${esc(record.scope)}"></button>
        </div>
        <p>${esc(meta.desc)}</p>
        <div class="consent-meta">${metaLine}</div>
      </div>`;
    })
    .join("");
}

function bindConsent() {
  $$("#view .switch").forEach((button) => {
    button.addEventListener("click", () => {
      const granted = button.getAttribute("aria-checked") !== "true";
      toggleConsent(button.dataset.scope, granted, button);
    });
  });
}

async function toggleConsent(scope, granted, button) {
  button.disabled = true;
  try {
    const record = await api("/api/consent", { method: "POST", body: { scope, granted } });
    app.data.consent = app.data.consent.map((item) => (item.scope === scope ? record : item));
    toast(granted ? t("Granted {scope}", { scope }) : t("Revoked {scope}", { scope }), granted ? "ok" : "");
    if (app.view === "consent") render();
    if (app.contextTab === "consent") refreshContextPanel("consent");
  } catch (error) {
    toast(error.message, "err");
    button.disabled = false;
  }
}

/* ---------- drawer ---------- */

function openDrawer({ kicker, title, html, mount }) {
  app.lastFocus = document.activeElement;
  app.drawerToken += 1;
  $("#drawerKicker").textContent = kicker;
  $("#drawerTitle").textContent = title;
  const body = $("#drawerBody");
  body.innerHTML = html;
  body.scrollTop = 0;

  const layer = $("#drawerLayer");
  layer.classList.add("is-open");
  layer.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");

  if (mount) mount(body);
  requestAnimationFrame(() => $("#drawerClose")?.focus());
}

function closeDrawer(restore = true) {
  app.contextTab = null;
  $("#drawerLayer").classList.remove("is-open");
  $("#drawerLayer").setAttribute("aria-hidden", "true");
  if (!$("#paletteLayer").classList.contains("is-open")) {
    document.body.classList.remove("locked");
  }
  if (restore && app.lastFocus && typeof app.lastFocus.focus === "function") {
    try {
      app.lastFocus.focus();
    } catch {
      /* ignore */
    }
  }
}

function contextTabs() {
  const tabs = [];
  if (featureLoaded("persona")) tabs.push(["persona", t("Persona")]);
  if (featureLoaded("timeline")) tabs.push(["timeline", t("Changes")]);
  if (featureLoaded("consent")) tabs.push(["consent", t("Consent")]);
  return tabs;
}

function contextTabsHtml(tabs, active) {
  return `<div class="ctx-tabs" role="tablist">${tabs
    .map(
      ([id, label]) =>
        `<button class="ctx-tab ${id === active ? "is-active" : ""}" data-ctx-tab="${id}" type="button" role="tab" aria-selected="${id === active}">${label}</button>`,
    )
    .join("")}</div>`;
}

function openContext(tab) {
  const tabs = contextTabs();
  if (!tabs.length) return;
  const active = tabs.some(([id]) => id === tab) ? tab : tabs[0][0];
  app.contextTab = active;
  openDrawer({
    kicker: t("Your context"),
    title: t("What Pi-Mirror knows"),
    html: `<div id="ctxRoot">${contextTabsHtml(tabs, active)}<div class="ctx-panel" id="ctxPanel">${contextPanel(active)}</div></div>`,
    mount(body) {
      $("#ctxRoot")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-ctx-tab]");
        if (!button) return;
        switchContextTab(button.dataset.ctxTab);
      });
      bindContextPanel($("#ctxPanel"), active);
    },
  });
}

function switchContextTab(tab) {
  const tabs = contextTabs();
  if (!tabs.some(([id]) => id === tab)) return;
  app.contextTab = tab;
  const root = $("#ctxRoot");
  if (!root) return;
  const host = root.querySelector(".ctx-tabs");
  if (host) host.outerHTML = contextTabsHtml(tabs, tab);
  refreshContextPanel(tab);
}

function refreshContextPanel(tab) {
  const panel = $("#ctxPanel");
  if (!panel || app.contextTab !== tab) return;
  panel.innerHTML = contextPanel(tab);
  bindContextPanel(panel, tab);
}

function contextPanel(tab) {
  if (tab === "persona") {
    const data = app.data;
    if (!data.counts.notes) {
      return `<div class="empty small"><span class="ring">${icon("spark")}</span><strong>${t("还没有索引笔记")}</strong><span>${t("先索引一次，才会有 persona。")}</span><button class="btn primary sm" data-action="reindex">${icon("refresh")}${t("Index demo vault")}</button></div>`;
    }
    if (!data.profile) {
      return `<div class="empty small"><span class="ring">${icon("persona")}</span><strong>${t("还没有 persona 模型")}</strong><span>${t("已有 {n} 篇笔记，提炼一次就能开始审阅。", { n: data.counts.notes })}</span><button class="btn primary sm" data-action="reindex">${icon("refresh")}${t("Build persona")}</button></div>`;
    }
    const traits = data.traits || [];
    const candidates = traits.filter((trait) => trait.status === "candidate");
    const confirmed = traits.filter((trait) => trait.status === "confirmed");
    const rows = [...candidates, ...confirmed]
      .slice(0, 8)
      .map((trait) => {
        const kind = KINDS[trait.kind] || { dot: "k-biography" };
        return `<button class="ctx-row" data-trait="${esc(trait.id)}" type="button">
          <span class="kind-dot ${kind.dot}"></span>
          <span class="ctx-row-main"><span>${esc(trait.text)}</span><small>${esc(kindLabel(trait.kind))} · ${t("{n} evidence", { n: trait.evidenceCount })} · ${pct(trait.confidence)}%</small></span>
          <span class="pill ${esc(trait.status)}">${esc(statusLabel(trait.status))}</span>
        </button>`;
      })
      .join("");
    return `<div class="ctx-stats">
        <div class="ctx-stat"><strong>${data.counts.traits ?? 0}</strong><span>${t("traits")}</span></div>
        <div class="ctx-stat"><strong>${candidates.length}</strong><span>${t("to review")}</span></div>
        <div class="ctx-stat"><strong>${data.counts.evidence ?? 0}</strong><span>${t("evidence")}</span></div>
      </div>
      <div class="ctx-section"><span class="ctx-label">${t("Identity")}</span><p>${esc(data.profile.name || t("You"))} · v${data.profile.version} · ${t("每条结论都能回到原文。")}</p></div>
      <div class="ctx-list">${rows || `<div class="empty small"><strong>${t("还没有 trait")}</strong><span>${t("重新索引会让候选出现。")}</span></div>`}</div>
      <div class="ctx-actions">
        <a class="btn ghost sm" href="#/persona">${t("Open full Persona")}</a>
        <button class="btn ghost sm" data-action="reindex">${icon("refresh")}${t("重建索引")}</button>
      </div>`;
  }

  if (tab === "timeline") {
    const items = (app.data.timeline || []).slice(0, 7);
    const rows = items
      .map((item) => {
        const polarity = Number(item.polarity) || 0;
        const tone = polarity > 0.2 ? "pos" : polarity < -0.2 ? "neg" : "";
        const label = polarity > 0.2 ? t("正向") : polarity < -0.2 ? t("反向") : t("中性");
        return `<button class="ctx-row ctx-tl ${tone}" type="button" ${item.notePath ? `data-note="${esc(item.notePath)}"` : "disabled"}>
          <span class="ctx-tl-date">${fmtDate(item.observedAt)}</span>
          <span class="ctx-row-main"><span>${esc(item.topic)}</span>${item.quote ? `<small class="ctx-quote">${esc(item.quote)}</small>` : ""}</span>
          <span class="polarity ${tone}">${label}</span>
        </button>`;
      })
      .join("");
    return `<div class="ctx-section"><span class="ctx-label">${t("Changes over time")}</span><p>${
      app.data.timelineKind === "observed_traits"
        ? t("目前是单次观察；同一话题再次出现、极性变化时，这里会显示「变化」。")
        : t("按观察时间排列。")
    }</p></div>
      <div class="ctx-list">${rows || `<div class="empty small"><strong>${t("还没有立场记录")}</strong><span>${t("等笔记里出现可识别的 stance 句，或把 stance_events 写进库。")}</span></div>`}</div>
      <div class="ctx-actions"><a class="btn ghost sm" href="#/timeline">${t("Open full Timeline")}</a></div>`;
  }

  if (tab === "consent") {
    return `<div class="ctx-section"><span class="ctx-label">${t("Boundaries")}</span><p>${t("只有 publishing 会在服务端硬性生效。每次开关都追加一条记录，不覆盖历史。")}</p></div>
      <div class="consent-grid ctx-consent">${consentCards(app.data.consent || [])}</div>
      <div class="ctx-actions"><a class="btn ghost sm" href="#/consent">${t("Open full Consent")}</a></div>`;
  }

  return "";
}

function bindContextPanel(panel, tab) {
  if (!panel) return;
  if (tab === "persona") {
    panel.querySelectorAll("[data-trait]").forEach((button) => {
      button.addEventListener("click", () => openTrait(button.dataset.trait));
    });
    panel.querySelectorAll('[data-action="reindex"]').forEach((button) => {
      button.addEventListener("click", () => reindex(button));
    });
  }
  if (tab === "timeline") {
    panel.querySelectorAll("[data-note]").forEach((button) => {
      button.addEventListener("click", () => openNote(button.dataset.note));
    });
  }
  if (tab === "consent") {
    panel.querySelectorAll(".switch").forEach((button) => {
      button.addEventListener("click", () => {
        const granted = button.getAttribute("aria-checked") !== "true";
        toggleConsent(button.dataset.scope, granted, button);
      });
    });
  }
}

function openTrait(id) {
  const trait = app.data.traits.find((item) => item.id === id);
  if (!trait) return;
  const evidence = trait.evidence?.length
    ? trait.evidence
        .map(
          (item) => `<div class="evidence">
            <blockquote>${esc(item.quote)}</blockquote>
            ${
              item.notePath
                ? `<button class="note-link" data-note="${esc(item.notePath)}">${icon("note")}${esc(item.notePath)}</button>`
                : `<span class="small muted">${t("no note path")}</span>`
            }
          </div>`,
        )
        .join("")
    : `<div class="empty small"><strong>${t("没有证据")}</strong><span>${t("这条不该被当作结论。")}</span></div>`;

  const statusAction =
    trait.status === "candidate"
      ? `<button class="btn primary sm" data-trait-status="confirmed">${icon("check")}${t("Confirm")}</button>
         <button class="btn ghost sm" data-trait-status="rejected">${t("Reject")}</button>`
      : `<button class="btn ghost sm" data-trait-status="candidate">${t("Reset to candidate")}</button>`;

  openDrawer({
    kicker: `${kindLabel(trait.kind)} · ${statusLabel(trait.status)}`,
    title: trait.text,
    html: `<div class="drawer-meta">
        <span class="chip">${t("{n}% confidence", { n: pct(trait.confidence) })}</span>
        <span class="chip">${t("{n} evidence", { n: trait.evidenceCount })}</span>
        <span class="pill ${esc(trait.status)}">${esc(statusLabel(trait.status))}</span>
        ${trait.polarity !== null ? `<span class="chip">${t("polarity {n}", { n: `${trait.polarity > 0 ? "+" : ""}${trait.polarity}` })}</span>` : ""}
      </div>
      <h3>${t("Evidence")}</h3>
      ${evidence}
      <div class="drawer-actions">${statusAction}</div>`,
    mount(body) {
      body.querySelectorAll("[data-note]").forEach((button) => {
        button.addEventListener("click", () => openNote(button.dataset.note));
      });
      body.querySelectorAll("[data-trait-status]").forEach((button) => {
        button.addEventListener("click", () => setTraitStatus(trait.id, button.dataset.traitStatus));
      });
    },
  });
}

async function setTraitStatus(id, status) {
  try {
    await api("/api/traits/status", { method: "POST", body: { id, status } });
    toast(t("Trait marked as {status}", { status: statusLabel(status) }), "ok");
    closeDrawer(false);
    await loadState();
  } catch (error) {
    toast(error.message, "err");
  }
}

function sourceFor(messageIndex, sourceIndex) {
  if (messageIndex === -1) return app.write?.sources?.[sourceIndex];
  const primary = app.view === "mirror" ? app.mirror : app.ask;
  const message = primary?.[messageIndex];
  if (message) return message.sources?.[sourceIndex];
  const fallback = app.view === "mirror" ? app.ask : app.mirror;
  return fallback?.[messageIndex]?.sources?.[sourceIndex];
}

function openSource(messageIndex, sourceIndex) {
  const source = sourceFor(messageIndex, sourceIndex);
  if (!source) return;
  openDrawer({
    kicker: t("Source · {n}", { n: sourceIndex + 1 }),
    title: source.heading || source.path,
    html: `<div class="drawer-meta">
        <span class="chip">${esc(source.line)}</span>
        <span class="chip">${esc(source.path)}</span>
      </div>
      <div class="evidence">
        <blockquote>${esc(source.quote)}</blockquote>
        <button class="note-link" data-note="${esc(source.path)}">${icon("note")}${t("Open full note")}</button>
      </div>`,
    mount(body) {
      body.querySelector("[data-note]")?.addEventListener("click", () => openNote(source.path));
    },
  });
}

function openSourceHit(hit) {
  openDrawer({
    kicker: t("Search result"),
    title: hit.heading || hit.notePath,
    html: `<div class="drawer-meta"><span class="chip">${esc(hit.notePath)}</span><span class="chip">L${hit.start + 1}–L${hit.end + 1}</span></div>
      <div class="evidence"><blockquote>${esc(hit.text.replace(/\s+/g, " ").trim())}</blockquote>
      <button class="note-link" data-note="${esc(hit.notePath)}">${icon("note")}${t("Open full note")}</button></div>`,
    mount(body) {
      body.querySelector("[data-note]")?.addEventListener("click", () => openNote(hit.notePath));
    },
  });
}

async function openNote(path) {
  openDrawer({
    kicker: t("Note · read-only"),
    title: path,
    html: `<div class="skeleton"><div class="sk"></div><div class="sk"></div><div class="sk" style="width:64%"></div></div>`,
  });
  const token = app.drawerToken;
  try {
    const note = await api(`/api/note?path=${encodeURIComponent(path)}`);
    if (token !== app.drawerToken) return;
    const body = $("#drawerBody");
    body.innerHTML = `<div class="drawer-meta">
        <span class="chip">${t("{n} lines", { n: note.text.split(/\r?\n/).length })}</span>
        <button class="btn ghost sm" data-copy-note>${icon("copy")}${t("复制路径")}</button>
      </div>
      <pre class="note-body">${esc(note.text)}</pre>`;
    body.querySelector("[data-copy-note]")?.addEventListener("click", () => copyText(path));
  } catch (error) {
    if (token !== app.drawerToken) return;
    $("#drawerBody").innerHTML = errorCard(error.message);
  }
}

function openDraft(id) {
  const draft = app.data.drafts.find((item) => item.id === id);
  if (!draft) return;

  const consentLoaded = featureLoaded("consent");
  const publishingGranted = consentLoaded && (app.data.consent || []).find((item) => item.scope === "publishing")?.granted;
  const nextStatus =
    draft.status === "draft"
      ? ["reviewed", t("Mark reviewed")]
      : draft.status === "reviewed"
        ? ["approved", t("Approve")]
        : null;

  openDrawer({
    kicker: t("Draft · {platform}", { platform: platformLabel(draft.platform) }),
    title: draft.topic,
    html: `<div class="drawer-meta">
        <span class="pill ${esc(draft.status)}">${esc(statusLabel(draft.status))}</span>
        <span class="chip">${t("{n} sentences", { n: draft.sentenceCount })}</span>
        <span class="chip">${fmtDate(draft.updatedAt)}</span>
      </div>
      <div class="drawer-draft">${esc(draft.content)}</div>
      <div class="drawer-actions">
        ${
          nextStatus
            ? `<button class="btn ghost sm" data-status="${nextStatus[0]}">${icon("check")}${nextStatus[1]}</button>`
            : ""
        }
        <button class="btn ghost sm" data-copy-draft>${icon("copy")}${t("复制全文")}</button>
      </div>
      <div class="drawer-form">
        <h3>${t("Record a publish")}</h3>
        ${
          publishingGranted
            ? `<div class="field"><span>${t("Platform")}</span><select id="pubPlatform">${PLATFORMS.map(
                ([key]) => `<option value="${key}" ${key === draft.platform ? "selected" : ""}>${platformLabel(key)}</option>`,
              ).join("")}</select></div>
               <div class="field"><span>${t("Link")}</span><input id="pubUrl" placeholder="https://…" /></div>
               <button class="btn primary sm" id="pubBtn">${icon("external")}${t("Mark published")}</button>`
            : consentLoaded
              ? `<p class="small muted" style="margin:0 0 10px">${t("Publishing 授权当前关闭。先去 Consent 打开，再记录发布。")}</p><a class="btn ghost sm" href="#/consent">${t("Open Consent")}</a>`
              : `<p class="small muted" style="margin:0">${t("发布需要 Consent 插件。当前只加载了 Library，记录发布会被服务端拒绝。")}</p>`
        }
      </div>`,
    mount(body) {
      body.querySelector("[data-copy-draft]")?.addEventListener("click", () => copyText(draft.content));
      const statusButton = body.querySelector("[data-status]");
      if (statusButton) {
        statusButton.addEventListener("click", async () => {
          statusButton.disabled = true;
          try {
            const response = await api("/api/drafts/status", {
              method: "POST",
              body: { id: draft.id, status: statusButton.dataset.status },
            });
            app.data.drafts = response.drafts;
            toast(t("Draft status updated to {status}", { status: statusLabel(statusButton.dataset.status) }), "ok");
            closeDrawer(false);
            render();
          } catch (error) {
            toast(error.message, "err");
            statusButton.disabled = false;
          }
        });
      }
      body.querySelector("#pubBtn")?.addEventListener("click", async (event) => {
        event.preventDefault();
        const platform = $("#pubPlatform")?.value || draft.platform;
        const url = $("#pubUrl")?.value.trim() || "";
        const button = event.currentTarget;
        button.disabled = true;
        try {
          const response = await api("/api/publish", {
            method: "POST",
            body: { draftId: draft.id, platform, url },
          });
          app.data.publish = response.records;
          app.data.drafts = response.drafts;
          toast(t("Publish recorded."), "ok");
          closeDrawer(false);
          render();
        } catch (error) {
          toast(error.message, "err");
          button.disabled = false;
        }
      });
    },
  });
}

/* ---------- palette ---------- */

function paletteCommands() {
  const commands = primaryNav().map((feature) => ({
    group: t("Navigate"),
    title: feature.label,
    sub: feature.sub,
    icon: feature.icon,
    kind: ui("视图", "view"),
    run: () => go(feature.id),
  }));
  if (featureLoaded("persona")) {
    commands.push({
      group: t("Context"),
      title: t("Persona"),
      sub: t("身份、证据与审阅"),
      icon: "persona",
      kind: ui("抽屉", "drawer"),
      run: () => openContext("persona"),
    });
  }
  if (featureLoaded("timeline")) {
    commands.push({
      group: t("Context"),
      title: t("Changes"),
      sub: t("立场随时间的变化"),
      icon: "timeline",
      kind: ui("抽屉", "drawer"),
      run: () => openContext("timeline"),
    });
  }
  if (featureLoaded("consent")) {
    commands.push({
      group: t("Context"),
      title: t("Consent"),
      sub: t("四类授权边界"),
      icon: "consent",
      kind: ui("抽屉", "drawer"),
      run: () => openContext("consent"),
    });
  }
  if (featureLoaded("vault")) {
    commands.push({
      group: t("Actions"),
      title: t("Re-index vault"),
      sub: t("重建索引、traits 与语气统计"),
      icon: "refresh",
      kind: ui("操作", "action"),
      run: () => reindex(),
    });
  }
  commands.push({
    group: t("Actions"),
    title: t("Reload workspace"),
    sub: t("重新读取本地状态与草稿"),
    icon: "refresh",
    kind: ui("操作", "action"),
    run: () => loadState(),
  });
  if (viewAvailable("persona")) {
    commands.push({
      group: t("Actions"),
      title: t("Review candidates"),
      sub: t("只看未确认的 trait"),
      icon: "check",
      kind: ui("操作", "action"),
      run: () => {
        app.onlyCandidates = true;
        go("persona");
      },
    });
  }
  commands.push({
    group: t("Actions"),
    title: t("Ask a question"),
    sub: t("回到知识库的问"),
    icon: "spark",
    kind: ui("操作", "action"),
    run: () => {
      app.mirrorMode = "ask";
      go("mirror");
      setTimeout(() => $("#mirrorInput")?.focus(), 120);
    },
  });
  return commands;
}

function openPalette() {
  app.lastFocus = document.activeElement;
  const layer = $("#paletteLayer");
  layer.classList.add("is-open");
  layer.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");

  const input = $("#paletteInput");
  input.value = "";
  app.palette.items = paletteCommands();
  app.palette.index = 0;
  app.palette.token += 1;
  renderPaletteList();
  requestAnimationFrame(() => input.focus());
}

function closePalette(restore = true) {
  $("#paletteLayer").classList.remove("is-open");
  $("#paletteLayer").setAttribute("aria-hidden", "true");
  $("#paletteInput").value = "";
  app.palette.token += 1;
  if (!$("#drawerLayer").classList.contains("is-open")) {
    document.body.classList.remove("locked");
  }
  if (restore && app.lastFocus && typeof app.lastFocus.focus === "function") {
    try {
      app.lastFocus.focus();
    } catch {
      /* ignore */
    }
  }
}

function renderPaletteList() {
  const list = $("#paletteList");
  if (!app.palette.items.length) {
    list.innerHTML = `<div class="empty small"><strong>${t("没有匹配")}</strong><span>${t("换个关键词，或直接搜索笔记内容。")}</span></div>`;
    return;
  }

  let html = "";
  let group = "";
  app.palette.items.forEach((item, index) => {
    if (item.group !== group) {
      group = item.group;
      html += `<div class="palette-group">${esc(group)}</div>`;
    }
    html += `<button class="palette-item ${index === app.palette.index ? "active" : ""}" data-idx="${index}" type="button">
      ${icon(item.icon || "note")}
      <span class="pi-main">
        <span class="pi-title">${esc(item.title)}</span>
        ${item.sub ? `<span class="pi-sub">${esc(item.sub)}</span>` : ""}
      </span>
      <span class="pi-kind">${esc(item.kind)}</span>
    </button>`;
  });
  list.innerHTML = html;
  const active = list.querySelector(".palette-item.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function paletteInput(value) {
  const query = value.trim();
  app.palette.index = 0;
  const base = paletteCommands().filter((command) => {
    if (!query) return true;
    return `${command.title} ${command.sub}`.toLowerCase().includes(query.toLowerCase());
  });
  app.palette.items = base;
  renderPaletteList();

  const token = ++app.palette.token;
  if (!query || !featureLoaded("vault")) return;

  api(`/api/search?q=${encodeURIComponent(query)}`)
    .then((hits) => {
      if (token !== app.palette.token) return;
      const notes = hits.map((hit) => ({
        group: t("Notes"),
        title: hit.notePath,
        sub: `${hit.heading ? `${hit.heading} · ` : ""}${hit.text.replace(/\s+/g, " ").trim().slice(0, 90)}`,
        icon: "note",
        kind: ui("笔记", "note"),
        hit,
      }));
      app.palette.items = [...base, ...notes];
      renderPaletteList();
    })
    .catch(() => {
      /* keep command results */
    });
}

function paletteRun() {
  const item = app.palette.items[app.palette.index];
  if (!item) return;
  closePalette(false);
  if (item.hit) {
    openSourceHit(item.hit);
  } else if (item.run) {
    item.run();
  }
}

/* ---------- global ---------- */

function bindGlobal() {
  $("#nav").addEventListener("click", (event) => {
    const item = event.target.closest(".nav-item");
    if (item?.dataset.view) go(item.dataset.view);
  });

  $("#searchTrigger").addEventListener("click", openPalette);
  $("#contextTrigger").addEventListener("click", () => openContext("persona"));
  $("#drawerClose").addEventListener("click", () => closeDrawer());

  $("#langTrigger").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleLangMenu();
  });
  $("#langMenu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-lang]");
    if (!button) return;
    I18N.setLocale(button.dataset.lang);
    closeLangMenu();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".lang-wrap")) closeLangMenu();
  });

  $$("[data-close]").forEach((backdrop) => {
    backdrop.addEventListener("click", () => {
      if (backdrop.dataset.close === "drawer") closeDrawer();
      if (backdrop.dataset.close === "palette") closePalette();
    });
  });

  $("#paletteInput").addEventListener("input", (event) => paletteInput(event.target.value));
  $("#paletteInput").addEventListener("keydown", (event) => {
    const count = app.palette.items.length;
    if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      app.palette.index = (app.palette.index + 1) % count;
      renderPaletteList();
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      app.palette.index = (app.palette.index - 1 + count) % count;
      renderPaletteList();
    } else if (event.key === "Enter") {
      event.preventDefault();
      paletteRun();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    }
  });

  $("#paletteList").addEventListener("click", (event) => {
    const item = event.target.closest("[data-idx]");
    if (!item) return;
    app.palette.index = Number(item.dataset.idx);
    paletteRun();
  });

  document.addEventListener("keydown", (event) => {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if ($("#paletteLayer").classList.contains("is-open")) closePalette();
      else openPalette();
      return;
    }
    if (event.key === "Escape") {
      if (!$("#langMenu").hidden) {
        closeLangMenu();
        return;
      }
      if ($("#paletteLayer").classList.contains("is-open")) {
        closePalette();
        return;
      }
      if ($("#drawerLayer").classList.contains("is-open")) {
        closeDrawer();
      }
    }
  });

  window.addEventListener("hashchange", () => {
    app.view = readRoute();
    closeDrawer(false);
    closePalette(false);
    window.scrollTo({ top: 0, behavior: "auto" });
    render();
  });
}

/* ---------- actions ---------- */

async function reindex(button) {
  if (app.reindexing) return;
  app.reindexing = true;
  if (button) button.disabled = true;
  toast(t("正在索引并提炼 persona…"), "", 7000);
  try {
    const result = await api("/api/index", { method: "POST", body: {} });
    toast(
      t("索引 {files} 篇 / {chunks} 段 · 新增 {traits} 条 trait", {
        files: result.index.files,
        chunks: result.index.chunks,
        traits: result.traits.traitsCreated,
      }),
      "ok",
    );
    await loadState();
    if (app.contextTab) refreshContextPanel(app.contextTab);
  } catch (error) {
    toast(error.message, "err");
  } finally {
    app.reindexing = false;
  }
}

async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast(t("已复制。"), "ok");
  } catch {
    toast(t("复制失败，请手动选择文本。"), "err");
  }
}

function errorCard(message, code) {
  const hint =
    code === "model_unavailable"
      ? `<p class="small" style="margin:6px 0 0;line-height:1.5">${t("pi 没有可用模型。先在 pi 中配置 provider 与 default model（<code>settings.json</code>），再重试。")}</p>`
      : "";
  return `<div class="error-card"><strong>${code === "model_unavailable" ? t("No model available") : t("Request failed")}</strong>${esc(message)}${hint}</div>`;
}

let toastTimer = 0;
function toast(message, type = "", duration = 3600) {
  const host = $("#toasts");
  const element = document.createElement("div");
  element.className = `toast ${type}`.trim();
  element.textContent = message;
  host.appendChild(element);

  const id = ++toastTimer;
  setTimeout(() => {
    if (id < toastTimer - 6) return;
    element.style.opacity = "0";
    element.style.transform = "translateY(4px)";
    element.style.transition = "opacity .2s ease, transform .2s ease";
    setTimeout(() => element.remove(), 220);
  }, duration);
}
