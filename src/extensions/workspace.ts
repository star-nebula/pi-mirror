import { spawn } from "node:child_process";
import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { startWorkspace, type WorkspaceHandle } from "../server/app.js";
import { mirrorPaths } from "../features/helpers.js";
import { listFeatures } from "../features/registry.js";

function openBrowser(url: string): void {
  if (process.env.PI_MIRROR_NO_OPEN === "1") return;
  const [command, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    // Opening a browser is best-effort; the URL is always shown in the TUI.
  }
}

/**
 * Workspace host plugin.
 *
 * It owns only the HTTP shell and the /mirror command. Every product capability
 * is contributed by a separate feature plugin that registered itself before
 * this server starts, so loading a subset of plugins produces a smaller product
 * with 404s for the missing features.
 */
export default function workspace(pi: ExtensionAPI) {
  const paths = mirrorPaths();
  let handle: WorkspaceHandle | null = null;
  let starting: Promise<WorkspaceHandle> | null = null;

  const ensureWorkspace = async (): Promise<WorkspaceHandle> => {
    if (handle) return handle;
    if (!starting) {
      starting = startWorkspace(paths)
        .then((started) => {
          handle = started;
          return started;
        })
        .finally(() => {
          starting = null;
        });
    }
    return starting;
  };

  const stopWorkspace = async (): Promise<boolean> => {
    const current = handle;
    handle = null;
    if (!current) return false;
    await current.close();
    return true;
  };

  pi.registerCommand("mirror", {
    description: "Open the Pi-Mirror workspace. Subcommands: status, stop",
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase();

      if (action === "stop") {
        const stopped = await stopWorkspace();
        ctx.ui.notify(
          stopped ? "Pi-Mirror workspace stopped." : "Pi-Mirror workspace is not running.",
          "info",
        );
        return;
      }

      if (action === "status") {
        ctx.ui.notify(
          handle
            ? `Pi-Mirror is running at ${handle.url}`
            : "Pi-Mirror is idle. Run /mirror to open the workspace.",
          "info",
        );
        return;
      }

      try {
        const started = await ensureWorkspace();
        const features = listFeatures();
        ctx.ui.notify(
          `Pi-Mirror workspace: ${started.url}\nvault: ${started.vaultRoot}\nfeatures: ${features.map((feature) => feature.id).join(", ") || "none"}\nModel turns run through pi.`,
          "info",
        );
        if (action !== "no-open") openBrowser(started.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Pi-Mirror could not start: ${message}`, "error");
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus("pi-mirror", "ready");
  });

  pi.on("session_shutdown", async () => {
    await stopWorkspace();
  });
}
