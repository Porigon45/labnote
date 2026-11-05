export function bodyText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(bodyText).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  const o = value as Record<string, unknown>;
  return [o.text, o.content, o.children, o.rows, o.cells, o.props && typeof o.props === "object" ? Object.values(o.props).filter(v => typeof v === "string").join(" ") : ""].map(bodyText).filter(Boolean).join("\n");
}
