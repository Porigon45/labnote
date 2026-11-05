export const collections = { protocols: { kind: "protocol", title: "プロトコル" }, samples: { kind: "sample", title: "試料台帳" }, memos: { kind: "memo", title: "研究メモ" } } as const;
export type Collection = keyof typeof collections;
export const sampleTypes = { strain: "株", plasmid: "プラスミド", primer: "プライマー", medium: "培地", other: "その他" } as const;
export const memoCategories = ["培地・作業記録", "装置・操作Tips", "参考資料", "保管場所", "一般メモ"] as const;
