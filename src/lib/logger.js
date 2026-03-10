export function logError(msg, err) {
  if (import.meta.env.DEV) console.error(msg, err);
}
