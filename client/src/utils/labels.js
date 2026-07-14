export function statusLabel(value) {
  return String(value || "Unknown").replaceAll("_", " ").toLowerCase();
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function formatDateOnly(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export function formatHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return String(parseFloat(n.toFixed(2)));
}

export function todayInputDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
