/** Locally-unique id — no server, no collisions to guard against beyond a single device. */
export function generateId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}
