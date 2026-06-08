export function statusLabel(value) {
  return String(value || "Unknown").replaceAll("_", " ").toLowerCase();
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}
