import type { MeasurementData } from "@/server/db/schema";
export const initialMeasurement: MeasurementData = { xLabel: "時間", xUnit: "h", yLabel: "OD", yUnit: "", series: ["A", "B"], rows: [{ x: 0, values: [null, null] }] };
export function validMeasurement(data: MeasurementData): boolean {
  return Boolean(data && Array.isArray(data.series) && data.series.length && data.series.length <= 30 && new Set(data.series).size === data.series.length && data.series.every(s => typeof s === "string" && s.trim()) && Array.isArray(data.rows) && data.rows.length <= 10000 && [data.xLabel, data.xUnit, data.yLabel, data.yUnit].every(s => typeof s === "string") && data.rows.every(r => Number.isFinite(r.x) && Array.isArray(r.values) && r.values.length === data.series.length && r.values.every(v => v === null || Number.isFinite(v))));
}
