"use client";
import { createReactBlockSpec } from "@blocknote/react";
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { initialMeasurement, validMeasurement } from "@/lib/measurement";
import type { MeasurementData } from "@/server/db/schema";

function Measurement({ data, view, onData, onView }: { data: MeasurementData; view: string; onData: (data: MeasurementData) => void; onView: (view: string) => void }) {
  const colors = ["#32644d", "#bd7837", "#6079b2", "#935d95"];
  const rows = data.rows.map(row => Object.fromEntries([["x", row.x], ...row.values.map((v, i) => [`s${i}`, v])]));
  return <div className="measurement" contentEditable={false}><div className="editor-toolbar"><strong>測定表</strong><label>表示<select aria-label="測定の表示" value={view} onChange={e => onView(e.target.value)}><option value="table">表</option><option value="line">折れ線</option><option value="scatter">散布図</option></select></label></div>
    <div className="measurement-labels">{(["xLabel", "xUnit", "yLabel", "yUnit"] as const).map((key, i) => <label key={key}>{["横軸", "横軸単位", "縦軸", "縦軸単位"][i]}<input aria-label={["横軸", "横軸単位", "縦軸", "縦軸単位"][i]} value={data[key]} onChange={e => onData({ ...data, [key]: e.target.value })} /></label>)}</div>
    {!validMeasurement(data) && <p role="alert">系列名は空欄や重複にせず、有限の数値を入力してください。</p>}
    {view === "table" ? <><div className="table-scroll"><table><thead><tr><th>{data.xLabel} ({data.xUnit})</th>{data.series.map((s, i) => <th key={i}><input aria-label={`系列${i + 1}`} value={s} onChange={e => onData({ ...data, series: data.series.map((n, j) => i === j ? e.target.value : n) })} /></th>)}<th>行操作</th></tr></thead><tbody>{data.rows.map((r, i) => <tr key={i}><td><input type="number" step="any" aria-label={`時刻${i + 1}`} value={r.x} onChange={e => onData({ ...data, rows: data.rows.map((row, j) => j === i ? { ...row, x: Number(e.target.value) } : row) })} /></td>{r.values.map((v, j) => <td key={j}><input type="number" step="any" aria-label={`${data.series[j]} 値${i + 1}`} value={v ?? ""} onChange={e => onData({ ...data, rows: data.rows.map((row, n) => n === i ? { ...row, values: row.values.map((old, k) => k === j ? e.target.value === "" ? null : Number(e.target.value) : old) } : row) })} /></td>)}<td><button onClick={() => onData({ ...data, rows: data.rows.filter((_, j) => i !== j) })}>行を削除</button></td></tr>)}</tbody></table></div><div className="editor-toolbar"><button onClick={() => onData({ ...data, rows: [...data.rows, { x: (data.rows.at(-1)?.x ?? -1) + 1, values: data.series.map(() => null) }] })}>測定行を追加</button><button disabled={data.series.length >= 30} onClick={() => onData({ ...data, series: [...data.series, `試料${data.series.length + 1}`], rows: data.rows.map(r => ({ ...r, values: [...r.values, null] })) })}>系列を追加</button></div></> : <div aria-label="測定グラフ" style={{ width: "100%", height: 280 }}><ResponsiveContainer>{view === "line" ? <LineChart data={rows}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="x" name={data.xLabel} unit={data.xUnit} /><YAxis name={data.yLabel} unit={data.yUnit} /><Tooltip /><Legend />{data.series.map((s, i) => <Line key={i} type="linear" dataKey={`s${i}`} name={s} stroke={colors[i % 4]} isAnimationActive={false} connectNulls={false} />)}</LineChart> : <ScatterChart><CartesianGrid /><XAxis type="number" dataKey="x" name={data.xLabel} unit={data.xUnit} /><YAxis type="number" dataKey="y" name={data.yLabel} unit={data.yUnit} /><Tooltip /><Legend />{data.series.map((s, i) => <Scatter key={i} name={s} data={data.rows.filter(r => r.values[i] !== null).map(r => ({ x: r.x, y: r.values[i] }))} fill={colors[i % 4]} isAnimationActive={false} />)}</ScatterChart>}</ResponsiveContainer></div>}
  </div>;
}
export const measurementBlock = createReactBlockSpec({ type: "measurement", propSchema: { data: { default: JSON.stringify(initialMeasurement) }, view: { default: "table" } }, content: "none" }, {
  render: ({ block, editor }) => {
    let data: MeasurementData;
    try { data = JSON.parse(block.props.data); } catch { return <p role="alert">測定データを読み込めません。</p>; }
    return <Measurement data={data} view={block.props.view} onData={next => editor.updateBlock(block, { props: { data: JSON.stringify(next) } })} onView={view => editor.updateBlock(block, { props: { view } })} />;
  },
})();
