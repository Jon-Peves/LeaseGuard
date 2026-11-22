// The app talks to the Django API for properties, units, invites, photos and
// inspections. Jest keeps using the in-memory demo store so screen tests stay
// fast and offline.
const env = (
  globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env;
export const LEASE_API_ENABLED = !env?.JEST_WORKER_ID;

export function newKey(prefix: string) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${random}`;
}

// Dev builds only: lets a tenant pick inspection photos from the gallery so
// real test images can be fed to the AI. Release builds stay camera-only.
export const TENANT_LIBRARY_FOR_TESTING = __DEV__ && LEASE_API_ENABLED;
