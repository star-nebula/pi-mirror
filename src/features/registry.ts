import type { FeatureMeta, FeaturePlugin } from "./contract.js";

/**
 * Extensions load through jiti and may be reloaded independently. The registry
 * lives on globalThis so every loaded feature plugin writes to the same map,
 * and re-registering an id replaces the old definition instead of duplicating it.
 */
const KEY = Symbol.for("pi-mirror.features.v1");

type Registry = Map<string, FeaturePlugin>;

function registry(): Registry {
  const global = globalThis as typeof globalThis & { [KEY]?: Registry };
  if (!global[KEY]) global[KEY] = new Map();
  return global[KEY];
}

export function registerFeature(feature: FeaturePlugin): void {
  registry().set(feature.id, feature);
}

export function listFeatures(): FeaturePlugin[] {
  return [...registry().values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function featureDescriptor(feature: FeaturePlugin): FeatureMeta {
  const { id, label, zh, icon, order, nav, description, tools, commands } = feature;
  return { id, label, zh, icon, order, nav, description, tools, commands };
}

export function resetFeatures(): void {
  registry().clear();
}
