/**
 * The one message the embedded app sends its host.
 *
 * `web/app.js` posts `{ type: "pi-mirror:ready" }` to its parent once the first
 * state load settles, so the Obsidian pane can tell "still booting" from "the
 * frame is blank". Kept free of `obsidian` imports so it can be unit tested.
 */
export const READY_TYPE = "pi-mirror:ready";

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isReadyMessage(data: unknown, origin: string, expectedUrl: string | null): boolean {
  if (!data || typeof data !== "object") return false;
  if ((data as { type?: unknown }).type !== READY_TYPE) return false;
  const expected = expectedUrl ? originOf(expectedUrl) : null;
  // A loopback origin is unique per port, so this also rejects a stale frame.
  return Boolean(expected) && origin === expected;
}
