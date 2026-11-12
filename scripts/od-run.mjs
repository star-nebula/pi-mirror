import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const exe = "D:\\AIPrograms\\Open Design\\Open Design.exe";
const cli = "D:\\AIPrograms\\Open Design\\resources\\app\\prebundled\\daemon\\daemon-cli.mjs";
const pipe = process.env.OD_PIPE ?? "open-design-sidecar-0a0df0561657e1920b343ac36ffb685d";
const requestId = process.env.OD_REQUEST ?? "4c88226c-c5d4-4922-b43b-06146cfeb432";
const externalPluginContext = {
  id: "open-design",
  version: "0.5.3",
  distributionMechanism: "git_marketplace",
  publisherClass: "open_design_first_party",
};
const projectId = "pi-mirror";
const projectName = "Pi-Mirror";
const promptPath = resolve("docs/design-prompt.md");
const statePath = resolve(".pi-mirror/od-run.json");
const prompt = readFileSync(promptPath, "utf8");

const env = {
  ...process.env,
  OD_DATA_DIR: "C:\\Users\\stars\\AppData\\Roaming\\Open Design\\namespaces\\release-stable-win\\data",
  OD_SIDECAR_CLIENT_ENDPOINT: `\\\\.\\pipe\\${pipe}`,
  OD_MCP_BOOTSTRAP_COMMAND: exe,
  OD_MCP_BOOTSTRAP_ARGS: '["--headless"]',
  ELECTRON_RUN_AS_NODE: "1",
};

const child = spawn(exe, [cli, "mcp"], { env, stdio: ["pipe", "pipe", "pipe"] });
let buffer = "";
let nextId = 1;
const pending = new Map();

child.stdout.on("data", (data) => {
  buffer += data.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
child.stderr.on("data", (data) => process.stderr.write("ERR " + data.toString()));
child.on("exit", (code) => console.log("mcp exited", code));

function request(method, params, timeoutMs = 30000) {
  const id = nextId++;
  return new Promise((resolvePromise, reject) => {
    pending.set(id, resolvePromise);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => reject(new Error(`timeout: ${method}`)), timeoutMs);
  });
}

async function call(name, args, timeoutMs = 60000) {
  const res = await request("tools/call", { name, arguments: args }, timeoutMs);
  const text = res?.result?.content?.map((item) => item.text).join("\n") ?? "";
  if (res?.result?.isError) {
    const error = new Error(text || JSON.stringify(res));
    error.toolName = name;
    throw error;
  }
  let parsed = {};
  try { parsed = JSON.parse(text); } catch { parsed = text ? { text } : {}; }
  return res?.result?.structuredContent ? { ...parsed, ...res.result.structuredContent } : parsed;
}

function save(state) {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let workflowId = null;

try {
  await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "pi-mirror-runner", version: "0.1.0" },
  });

  let project = null;

  const brief = await call("collect_brief", {
    artifactType: "website",
    projectTitle: projectName,
    locale: "zh-CN",
    externalPluginContext,
  });
  const confirmed = await call("confirm_brief", {
    briefDraftId: brief.briefDraftId,
    nonce: brief.nonce,
    locale: "zh-CN",
    pluginWorkflowId: brief.pluginWorkflowId,
    answers: {
      "website.goal": "showcase-work",
      "website.scope": "small-multi-page",
      "website.character": "refined-tech",
    },
  });
  workflowId = confirmed.pluginWorkflowId ?? brief.pluginWorkflowId;
  console.log("workflow", workflowId);
  save({ workflowId, requestId, stage: "brief-confirmed" });

  const projects = await call("list_projects", {});
  const existing = (projects.projects ?? []).find((p) => p.id === projectId || p.name === projectName);
  if (existing) {
    project = existing;
    console.log("using existing project", existing.id);
  } else {
    try {
      project = await call("create_project", { name: projectName, id: projectId });
      console.log("created project", project.id ?? project);
    } catch (error) {
      console.log("create_project failed:", error.message.slice(0, 400));
      const again = await call("list_projects", {});
      project = (again.projects ?? []).find((p) => p.id === projectId || p.name === projectName) ?? null;
      if (!project) throw error;
      console.log("project appeared after retry:", project.id);
    }
  }

  const run = await call("start_run", {
    project: project.id ?? projectId,
    prompt,
    requestId,
    pluginWorkflowId: workflowId,
    agent: "amr",
  }, 120000);
  const runId = run.runId ?? run.id;
  console.log("run started", runId, run.status ?? "");
  save({ runId, workflowId, requestId, projectId: project.id ?? projectId, status: run.status ?? "queued", startedAt: new Date().toISOString(), studioUrl: run.studioUrl ?? null, previewUrl: run.previewUrl ?? null });

  for (let i = 0; i < 60; i++) {
    await sleep(30000);
    let state;
    try {
      state = await call("get_run", { runId, pluginWorkflowId: workflowId });
    } catch (error) {
      console.log("poll error:", error.message.slice(0, 300));
      continue;
    }
    const status = state.status ?? "unknown";
    console.log(`[${i + 1}] ${status}`, state.studioUrl ?? state.previewUrl ?? "");
    save({
      runId,
      workflowId,
      requestId,
      projectId: project.id ?? projectId,
      status,
      startedAt: new Date().toISOString(),
      studioUrl: state.studioUrl ?? null,
      previewUrl: state.previewUrl ?? null,
      error: state.error ?? null,
    });
    if (status === "succeeded" || status === "failed" || status === "canceled") {
      console.log("TERMINAL", status, state.studioUrl ?? state.previewUrl ?? "");
      break;
    }
  }
} catch (error) {
  console.log("FATAL", error.toolName ?? "", error.message.slice(0, 1000));
  save({ error: error.message, at: new Date().toISOString(), workflowId, requestId });
} finally {
  child.kill();
  process.exit(0);
}
