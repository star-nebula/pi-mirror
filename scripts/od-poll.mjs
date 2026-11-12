import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const exe = "D:\\AIPrograms\\Open Design\\Open Design.exe";
const cli = "D:\\AIPrograms\\Open Design\\resources\\app\\prebundled\\daemon\\daemon-cli.mjs";
const pipe = process.env.OD_PIPE ?? "open-design-sidecar-0a0df0561657e1920b343ac36ffb685d";
const statePath = resolve(".pi-mirror/od-run.json");
const state = JSON.parse(readFileSync(statePath, "utf8"));
const { runId, workflowId, projectId } = state;

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
  if (res?.result?.isError) throw new Error(text || JSON.stringify(res));
  let parsed = {};
  try { parsed = JSON.parse(text); } catch { parsed = text ? { text } : {}; }
  return res?.result?.structuredContent ? { ...parsed, ...res.result.structuredContent } : parsed;
}

function save(next) {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(next, null, 2), "utf8");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "pi-mirror-poller", version: "0.1.0" },
  });

  for (let i = 0; i < 90; i++) {
    let current;
    try {
      current = await call("get_run", { runId, pluginWorkflowId: workflowId });
    } catch (error) {
      console.log(new Date().toISOString(), "poll error", error.message.slice(0, 300));
      await sleep(60000);
      continue;
    }
    const status = current.status ?? "unknown";
    let files = null;
    try {
      const listing = await call("list_files", { project: projectId });
      files = (listing.files ?? listing.entries ?? []).length;
    } catch {
      files = null;
    }
    console.log(new Date().toISOString(), status, `files=${files ?? "?"}`, current.studioUrl ?? current.previewUrl ?? "");
    save({
      runId,
      workflowId,
      requestId: state.requestId,
      projectId,
      status,
      studioUrl: current.studioUrl ?? state.studioUrl ?? null,
      previewUrl: current.previewUrl ?? null,
      files,
      error: current.error ?? null,
      updatedAt: new Date().toISOString(),
    });
    if (status === "succeeded" || status === "failed" || status === "canceled") {
      console.log("TERMINAL", status, current.studioUrl ?? current.previewUrl ?? "");
      break;
    }
    await sleep(60000);
  }
} catch (error) {
  console.log("FATAL", error.message.slice(0, 800));
} finally {
  child.kill();
  process.exit(0);
}
