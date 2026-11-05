"use client";
import { useActionState, useState } from "react";
import { saveLibrary } from "../library-actions";
import { memoCategories, sampleTypes, type Collection } from "@/lib/library";
import type { ResearchRecord } from "@/server/research";
type Sample = { type: string; parentSampleId: string | null; origin: string; location: string };
export function LibraryForm({ collection, record, sample, samples, date }: { collection: Collection; record?: ResearchRecord; sample?: Sample; samples: ResearchRecord[]; date: string }) {
  const [state, action, pending] = useActionState(saveLibrary, {});
  const [values, setValues] = useState({ title: record?.title ?? "", category: record?.category || (collection === "memos" ? "一般メモ" : ""), purpose: record?.purpose ?? "", status: record?.status ?? "active", date: record?.date ?? date, type: sample?.type ?? "strain", parentSampleId: sample?.parentSampleId ?? "", origin: sample?.origin ?? "", location: sample?.location ?? "" });
  const input = (key: keyof typeof values) => ({ name: key, value: values[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues(v => ({ ...v, [key]: e.target.value })) });
  return <form action={action} className="record-form"><input type="hidden" name="collection" value={collection} /><input type="hidden" name="id" value={record?.id ?? ""} /><input type="hidden" name="revision" value={record?.revision ?? 1} />
    <label>タイトル<input required {...input("title")} /></label><label>状態<select {...input("status")}><option value="active">進行中</option><option value="planned">予定</option><option value="completed">完了</option></select></label>
    {collection === "memos" ? <label>カテゴリ<select {...input("category")}>{memoCategories.map(c => <option key={c}>{c}</option>)}</select></label> : collection === "protocols" ? <label>カテゴリ<input {...input("category")} /></label> : null}
    {collection === "samples" && <><label>種類<select {...input("type")}>{Object.entries(sampleTypes).map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></label><label>作製日<input type="date" required {...input("date")} /></label><label>親試料<select {...input("parentSampleId")}><option value="">なし</option>{samples.filter(s => s.id !== record?.id).map(s => <option value={s.id} key={s.id}>{s.title}</option>)}</select></label><label>由来<input {...input("origin")} /></label><label>保管場所<input {...input("location")} /></label></>}
    <label>{collection === "samples" ? "備考" : "概要"}<textarea rows={3} {...input("purpose")} /></label>
    {state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}<button disabled={pending}>{pending ? "保存中…" : record ? "変更を保存" : "作成する"}</button>
  </form>;
}
