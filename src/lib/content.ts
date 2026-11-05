export function bodyText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(bodyText).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  const o = value as Record<string, unknown>;
  const props = o.props && typeof o.props === "object" ? o.props as Record<string, unknown> : {};
  const labels = [props.time, props.formula, props.label, props.caption, props.name].filter(v => typeof v === "string");
  return [o.text, o.content, o.children, o.rows, o.cells, ...labels].map(bodyText).filter(Boolean).join("\n");
}
