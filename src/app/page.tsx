"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScanLine, Upload, Camera, FileImage, X, Check, Loader2, Sparkles, ReceiptText,
  Search, Download, Trash2, Pencil, Plus, Eye, ChevronDown, ChevronUp, Filter,
  Store, Calendar, CreditCard, Tag, DollarSign, TrendingUp, Receipt, Zap, AlertCircle,
  FileSpreadsheet, Wand2, RefreshCw, Image as ImageIcon, CheckCircle2, Clock, Landmark
} from "lucide-react";

type Item = { name: string; quantity: number; unitPrice: number; total: number };
type ReceiptRow = {
  id: number; merchant: string; merchantAddress?: string | null; receiptDate?: string | null;
  receiptTime?: string | null; receiptNumber?: string | null; category: string; paymentMethod: string;
  currency: string; subtotal: string; tax: string; tip: string; discount: string; total: string;
  items: Item[]; notes?: string | null; fileName?: string | null; imageUrl?: string | null;
  confidence?: string | null; createdAt: string;
};
type Draft = Omit<ReceiptRow, "id" | "createdAt" | "subtotal" | "tax" | "tip" | "discount" | "total" | "confidence"> & {
  subtotal: number; tax: number; tip: number; discount: number; total: number; confidence?: number | null; date?: string | null;
};
type QueueItem = {
  uid: string; file: File; preview: string; thumbnail?: string;
  status: "queued" | "scanning" | "done" | "error" | "saved";
  error?: string; draft?: Draft; elapsed?: number;
};

const CATEGORIES = ["Groceries", "Dining", "Coffee", "Transport", "Shopping", "Utilities", "Healthcare", "Entertainment", "Travel", "Fuel", "Other"];
const PAYMENTS = ["Card", "Cash", "Mobile Pay", "Bank Transfer", "Other"];

const catColor: Record<string, string> = {
  Groceries: "bg-emerald-100 text-emerald-800", Dining: "bg-orange-100 text-orange-800", Coffee: "bg-amber-100 text-amber-800",
  Transport: "bg-sky-100 text-sky-800", Shopping: "bg-pink-100 text-pink-800", Utilities: "bg-indigo-100 text-indigo-800",
  Healthcare: "bg-red-100 text-red-800", Entertainment: "bg-violet-100 text-violet-800", Travel: "bg-cyan-100 text-cyan-800",
  Fuel: "bg-yellow-100 text-yellow-800", Other: "bg-slate-100 text-slate-700",
};

function money(n: number | string, cur = "USD") {
  const v = Number(n) || 0;
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(v); }
  catch { return `$${v.toFixed(2)}`; }
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
async function makeThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxW = 640; const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => resolve("");
    img.src = url;
  });
}
function emptyDraft(): Draft {
  return {
    merchant: "", merchantAddress: "", receiptDate: new Date().toISOString().slice(0, 10), date: new Date().toISOString().slice(0, 10),
    receiptTime: "", receiptNumber: "", category: "Other", paymentMethod: "Card", currency: "USD",
    subtotal: 0, tax: 0, tip: 0, discount: 0, total: 0, items: [{ name: "", quantity: 1, unitPrice: 0, total: 0 }],
    notes: "", fileName: "manual-entry", imageUrl: "", confidence: null,
  };
}

export default function Home() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [payFilter, setPayFilter] = useState("All");
  const [sortKey, setSortKey] = useState<"date" | "total" | "merchant">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<ReceiptRow | null>(null);
  const [editing, setEditing] = useState<{ mode: "draft"; qid: string; draft: Draft } | { mode: "edit"; id: number; draft: Draft } | { mode: "new"; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3400); };

  const fetchReceipts = useCallback(async () => {
    try { const r = await fetch("/api/receipts"); const j = await r.json(); setReceipts(j.receipts || []); }
    catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);

  const scanFile = useCallback(async (q: QueueItem) => {
    const start = Date.now();
    setQueue(prev => prev.map(x => x.uid === q.uid ? { ...x, status: "scanning" } : x));
    try {
      const thumb = await makeThumbnail(q.file);
      const fd = new FormData(); fd.append("image", q.file);
      const res = await fetch("/api/scan", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Scan failed");
      const d = j.data;
      const draft: Draft = {
        merchant: d.merchant, merchantAddress: d.merchantAddress || "", receiptDate: d.date, date: d.date,
        receiptTime: d.time || "", receiptNumber: d.receiptNumber || "", category: d.category, paymentMethod: d.paymentMethod,
        currency: d.currency || "USD", subtotal: d.subtotal, tax: d.tax, tip: d.tip, discount: d.discount, total: d.total,
        items: d.items?.length ? d.items : [{ name: "", quantity: 1, unitPrice: 0, total: 0 }],
        notes: d.notes || "", fileName: q.file.name, imageUrl: thumb, confidence: d.confidence,
      };
      const elapsed = Math.round((Date.now() - start) / 1000);
      setQueue(prev => prev.map(x => x.uid === q.uid ? { ...x, status: "done", draft, thumbnail: thumb, elapsed } : x));

      if (autoSave) {
        const saveRes = await fetch("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, imageUrl: thumb }) });
        if (saveRes.ok) {
          setQueue(prev => prev.map(x => x.uid === q.uid ? { ...x, status: "saved" } : x));
          await fetchReceipts();
          showToast(`✓ ${draft.merchant} — ${money(draft.total, draft.currency)} added to table`);
        }
      } else {
        showToast(`✓ Scanned ${draft.merchant} — review & save`);
      }
    } catch (e: any) {
      setQueue(prev => prev.map(x => x.uid === q.uid ? { ...x, status: "error", error: e.message } : x));
    }
  }, [autoSave, fetchReceipts]);

  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!arr.length) { showToast("Please drop receipt images (JPG / PNG / WebP)"); return; }
    const newQ: QueueItem[] = arr.map(f => ({ uid: Math.random().toString(36).slice(2), file: f, preview: URL.createObjectURL(f), status: "queued" }));
    setQueue(prev => [...newQ, ...prev]);
    newQ.forEach(q => scanFile(q));
  };

  const saveDraft = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const d = editing.draft;
      const payload = { ...d, date: d.receiptDate || d.date };
      if (editing.mode === "edit") {
        const r = await fetch(`/api/receipts/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error("Save failed");
        showToast("Receipt updated");
      } else {
        const r = await fetch("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error("Save failed");
        if (editing.mode === "draft") setQueue(prev => prev.map(x => x.uid === (editing as any).qid ? { ...x, status: "saved" } : x));
        showToast(`${d.merchant} saved to table`);
      }
      setEditing(null); await fetchReceipts();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const del = async (id: number) => { if (!confirm("Delete this receipt?")) return; await fetch(`/api/receipts/${id}`, { method: "DELETE" }); setDetail(null); fetchReceipts(); };
  const bulkDelete = async () => { if (!confirm(`Delete ${selected.size} receipts?`)) return; await Promise.all([...selected].map(id => fetch(`/api/receipts/${id}`, { method: "DELETE" }))); setSelected(new Set()); fetchReceipts(); };

  const seedDemo = async () => { setLoading(true); await fetch("/api/receipts", { method: "PUT" }); await fetchReceipts(); showToast("Demo receipts loaded — try scanning your own above"); };

  const filtered = useMemo(() => {
    let list = receipts.filter(r => {
      const s = search.toLowerCase();
      const okS = !s || r.merchant.toLowerCase().includes(s) || (r.receiptNumber || "").toLowerCase().includes(s) || r.items.some(i => i.name.toLowerCase().includes(s));
      return okS && (catFilter === "All" || r.category === catFilter) && (payFilter === "All" || r.paymentMethod === payFilter);
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "total") cmp = Number(a.total) - Number(b.total);
      else if (sortKey === "merchant") cmp = a.merchant.localeCompare(b.merchant);
      else cmp = new Date(a.receiptDate || a.createdAt).getTime() - new Date(b.receiptDate || b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [receipts, search, catFilter, payFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const total = receipts.reduce((s, r) => s + Number(r.total || 0), 0);
    const thisMonth = receipts.filter(r => { const d = new Date(r.receiptDate || r.createdAt); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).reduce((s, r) => s + Number(r.total), 0);
    const items = receipts.reduce((s, r) => s + (r.items?.length || 0), 0);
    const byCat: Record<string, number> = {};
    receipts.forEach(r => byCat[r.category] = (byCat[r.category] || 0) + Number(r.total));
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    return { total, thisMonth, avg: receipts.length ? total / receipts.length : 0, items, topCat, maxCat: topCat[0]?.[1] || 1 };
  }, [receipts]);

  const exportCSV = () => {
    const header = ["Date", "Merchant", "Category", "Payment", "Receipt #", "Subtotal", "Tax", "Tip", "Total", "Currency", "Items"];
    const rows = filtered.map(r => [r.receiptDate || "", r.merchant, r.category, r.paymentMethod, r.receiptNumber || "", r.subtotal, r.tax, r.tip, r.total, r.currency, r.items.map(i => `${i.quantity}x ${i.name}`).join("; ")]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "receipts-export.csv"; a.click();
  };

  const openEditReceipt = (r: ReceiptRow) => setEditing({
    mode: "edit", id: r.id, draft: {
      merchant: r.merchant, merchantAddress: r.merchantAddress || "", receiptDate: r.receiptDate, date: r.receiptDate, receiptTime: r.receiptTime || "",
      receiptNumber: r.receiptNumber || "", category: r.category, paymentMethod: r.paymentMethod, currency: r.currency,
      subtotal: Number(r.subtotal), tax: Number(r.tax), tip: Number(r.tip), discount: Number(r.discount), total: Number(r.total),
      items: r.items?.length ? r.items : [], notes: r.notes || "", fileName: r.fileName || "", imageUrl: r.imageUrl || "", confidence: r.confidence ? Number(r.confidence) : null,
    }
  });

  const toggleSort = (k: typeof sortKey) => { if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } };

  const scanningCount = queue.filter(q => q.status === "scanning" || q.status === "queued").length;

  return (
    <div className="min-h-screen bg-[#F4F5F0] text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-[#10201B] text-white sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-400 grid place-items-center text-emerald-950"><ScanLine className="w-6 h-6" /></div>
            <div>
              <p className="font-black text-lg leading-none tracking-tight">ReceiptScan <span className="text-emerald-400">AI</span></p>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">Payment receipt scanner → table • NVIDIA Mistral Large</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:flex items-center gap-1.5 text-xs bg-white/10 px-3 py-1.5 rounded-full"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> AI Online</span>
            <button onClick={exportCSV} className="hidden sm:flex items-center gap-1.5 bg-white text-slate-900 px-3 py-2 rounded-full text-xs font-bold hover:bg-emerald-50"><Download className="w-4 h-4" /> Export CSV</button>
            <button onClick={() => setEditing({ mode: "new", draft: emptyDraft() })} className="flex items-center gap-1.5 bg-emerald-400 text-emerald-950 px-3 py-2 rounded-full text-xs font-bold hover:bg-emerald-300"><Plus className="w-4 h-4" /> Add Manually</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Spent (all time)", value: money(stats.total), icon: DollarSign, sub: `${receipts.length} receipts` },
            { label: "This Month", value: money(stats.thisMonth), icon: TrendingUp, sub: "current calendar month" },
            { label: "Average Receipt", value: money(stats.avg), icon: ReceiptText, sub: `${stats.items} line items extracted` },
            { label: "AI Extractions", value: String(receipts.length), icon: Sparkles, sub: scanningCount ? `${scanningCount} scanning now…` : "Mistral Large 4 vision" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl p-4 border shadow-sm">
              <div className="flex justify-between"><p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{c.label}</p><c.icon className="w-4 h-4 text-emerald-600" /></div>
              <p className="text-2xl font-black mt-1">{c.value}</p><p className="text-xs text-slate-500">{c.sub}</p>
            </div>
          ))}
        </section>

        <div className="grid lg:grid-cols-5 gap-5 items-start">
          {/* Upload */}
          <section className="lg:col-span-3 bg-white rounded-3xl border shadow-sm overflow-hidden">
            <div className="p-5 pb-3 flex items-start justify-between">
              <div><h1 className="text-xl font-black tracking-tight">Scan a payment receipt</h1><p className="text-sm text-slate-500">Take a photo or drop images — AI extracts merchant, date, items & totals into the table.</p></div>
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><Zap className="w-3 h-3" /> mistral-large-4</span>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
              className={`mx-5 mb-4 border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition ${dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50"}`}
            >
              <div className="w-14 h-14 mx-auto bg-emerald-600 rounded-2xl grid place-items-center text-white shadow-lg shadow-emerald-200"><Upload className="w-7 h-7" /></div>
              <p className="font-bold mt-3">Drag & drop receipt images here, or click to browse</p>
              <p className="text-xs text-slate-500 mt-1">JPG, PNG, WebP • Max 12MB each • Multiple files supported • Works with phone photos</p>
              <div className="flex justify-center gap-2 mt-4">
                <span className="text-xs bg-slate-900 text-white px-3 py-2 rounded-full font-semibold flex items-center gap-1"><FileImage className="w-3.5 h-3.5" /> Choose Files</span>
                <button onClick={e => { e.stopPropagation(); cameraRef.current?.click(); }} className="text-xs bg-white border px-3 py-2 rounded-full font-semibold flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Use Camera</button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
            </div>
            <div className="px-5 pb-5 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer bg-slate-50 border rounded-full pl-2 pr-3 py-1.5">
                <button onClick={() => setAutoSave(v => !v)} className={`w-9 h-5 rounded-full p-0.5 transition ${autoSave ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`block w-4 h-4 bg-white rounded-full transition ${autoSave ? "translate-x-4" : ""}`} /></button>
                Auto-save to table after scan
              </label>
              <span className="text-[11px] text-slate-500 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Powered by NVIDIA Integrate API — your key stays server-side</span>
              {receipts.length === 0 && <button onClick={seedDemo} className="ml-auto text-xs font-bold bg-amber-400 hover:bg-amber-300 px-3 py-2 rounded-full">Load demo receipts →</button>}
            </div>

            {/* How it works */}
            <div className="grid grid-cols-3 border-t divide-x text-center">
              {[["1. Upload", "Photo / screenshot"], ["2. AI Extracts", "Merchant • Items • Tax • Total"], ["3. Table & Export", "Search, edit, CSV"]].map(s => (
                <div key={s[0]} className="p-3"><p className="text-xs font-black">{s[0]}</p><p className="text-[11px] text-slate-500">{s[1]}</p></div>
              ))}
            </div>
          </section>

          {/* Queue / Category breakdown */}
          <section className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-3xl border shadow-sm p-5">
              <h2 className="font-black flex items-center gap-2"><ScanLine className="w-5 h-5 text-emerald-600" /> Scan Queue {queue.length > 0 && <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{queue.length}</span>}</h2>
              {queue.length === 0 ? (
                <div className="text-center py-8 text-slate-400"><ImageIcon className="w-10 h-10 mx-auto opacity-40" /><p className="text-sm mt-2">No scans yet.<br />Upload a receipt to see AI magic here.</p></div>
              ) : (
                <div className="space-y-3 mt-3 max-h-[320px] overflow-auto pr-1">
                  {queue.map(q => (
                    <div key={q.uid} className="flex gap-3 border rounded-2xl p-2.5 bg-slate-50">
                      <img src={q.preview} alt="" className="w-14 h-[70px] object-cover rounded-lg border" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{q.file.name}</p>
                        <p className="text-[11px] text-slate-500">{(q.file.size / 1024).toFixed(0)} KB</p>
                        {q.status === "scanning" && <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1 mt-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI reading receipt…</p>}
                        {q.status === "queued" && <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Clock className="w-3.5 h-3.5" /> Queued</p>}
                        {q.status === "error" && <p className="text-xs text-red-600 flex gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{q.error}</p>}
                        {(q.status === "done" || q.status === "saved") && q.draft && (
                          <div className="mt-1">
                            <p className="text-xs font-black">{q.draft.merchant} • {money(q.draft.total, q.draft.currency)}</p>
                            <p className="text-[11px] text-slate-500">{q.draft.items.length} items • {q.draft.confidence ?? 90}% confidence {q.elapsed ? `• ${q.elapsed}s` : ""}</p>
                            <div className="flex gap-1.5 mt-2">
                              {q.status === "saved" ? <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Saved to table</span>
                                : <button onClick={() => setEditing({ mode: "draft", qid: q.uid, draft: q.draft! })} className="text-[11px] bg-slate-900 text-white px-2.5 py-1.5 rounded-full font-bold">Review & Save</button>}
                              {q.status === "done" && <button onClick={() => setEditing({ mode: "draft", qid: q.uid, draft: q.draft! })} className="text-[11px] bg-white border px-2 py-1.5 rounded-full font-bold flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>}
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={() => setQueue(p => p.filter(x => x.uid !== q.uid))} className="self-start text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              {queue.some(q => q.status === "error") && <button onClick={() => queue.filter(q => q.status === "error").forEach(q => scanFile(q))} className="mt-3 text-xs font-bold flex items-center gap-1 text-emerald-700"><RefreshCw className="w-3.5 h-3.5" /> Retry failed scans</button>}
            </div>

            <div className="bg-[#10201B] text-white rounded-3xl p-5 shadow-sm">
              <h3 className="font-black text-sm">Spending by Category</h3>
              {stats.topCat.length === 0 ? <p className="text-xs text-emerald-200/70 mt-2">Scan receipts to see breakdown.</p> : (
                <div className="space-y-2.5 mt-3">
                  {stats.topCat.slice(0, 5).map(([cat, amt]) => (
                    <div key={cat}><div className="flex justify-between text-xs"><span>{cat}</span><span className="font-bold">{money(amt)}</span></div><div className="h-2 bg-white/10 rounded-full mt-1"><div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.max(6, (amt / stats.maxCat) * 100)}%` }} /></div></div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Table */}
        <section className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-3">
            <div><h2 className="text-lg font-black flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Receipts Table</h2><p className="text-xs text-slate-500">{filtered.length} of {receipts.length} receipts • Click a row for details & line items</p></div>
            <div className="lg:ml-auto flex flex-wrap gap-2 items-center">
              <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search merchant, item, #" className="pl-9 pr-3 py-2 text-sm border rounded-full w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-sm border rounded-full px-3 py-2 bg-white"><option>All</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
              <select value={payFilter} onChange={e => setPayFilter(e.target.value)} className="text-sm border rounded-full px-3 py-2 bg-white"><option>All</option>{PAYMENTS.map(c => <option key={c}>{c}</option>)}</select>
              {selected.size > 0 && <button onClick={bulkDelete} className="text-xs bg-red-600 text-white px-3 py-2 rounded-full font-bold flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Delete ({selected.size})</button>}
              <button onClick={exportCSV} className="text-xs bg-slate-900 text-white px-3 py-2 rounded-full font-bold flex items-center gap-1"><Download className="w-3.5 h-3.5" /> CSV</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead><tr className="bg-slate-50 border-y text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="p-3 w-8"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={e => setSelected(e.target.checked ? new Set(filtered.map(r => r.id)) : new Set())} /></th>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort("merchant")}>Merchant {sortKey === "merchant" ? (sortDir === "asc" ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />) : ""}</th>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort("date")}>Date {sortKey === "date" ? (sortDir === "asc" ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />) : ""}</th>
                <th className="p-3">Category</th><th className="p-3">Payment</th><th className="p-3">Items</th>
                <th className="p-3">Tax</th><th className="p-3 cursor-pointer text-right" onClick={() => toggleSort("total")}>Total</th><th className="p-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={9} className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" /><p className="text-sm text-slate-500 mt-2">Loading receipts…</p></td></tr>
                  : filtered.length === 0 ? <tr><td colSpan={9} className="p-12 text-center"><Receipt className="w-12 h-12 mx-auto text-slate-300" /><p className="font-bold mt-2">No receipts yet</p><p className="text-sm text-slate-500">Scan your first receipt above or load demo data.</p>{receipts.length === 0 && <button onClick={seedDemo} className="mt-3 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-full">Load Demo Receipts</button>}</td></tr>
                  : filtered.map(r => (
                    <tr key={r.id} onClick={() => setDetail(r)} className="border-b hover:bg-emerald-50/60 cursor-pointer">
                      <td className="p-3" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(r.id)} onChange={e => { const s = new Set(selected); e.target.checked ? s.add(r.id) : s.delete(r.id); setSelected(s); }} /></td>
                      <td className="p-3"><div className="flex items-center gap-3">{r.imageUrl ? <img src={r.imageUrl} alt="" className="w-9 h-11 object-cover rounded-md border" /> : <div className="w-9 h-11 bg-slate-100 rounded-md grid place-items-center"><Store className="w-4 h-4 text-slate-400" /></div>}<div><p className="font-bold leading-tight">{r.merchant}</p><p className="text-[11px] text-slate-500">{r.receiptNumber ? `#${r.receiptNumber} • ` : ""}{r.items?.length || 0} items {r.confidence ? `• ${Number(r.confidence)}% AI` : ""}</p></div></div></td>
                      <td className="p-3 whitespace-nowrap">{fmtDate(r.receiptDate)}<p className="text-[11px] text-slate-500">{r.receiptTime || ""}</p></td>
                      <td className="p-3"><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${catColor[r.category] || catColor.Other}`}>{r.category}</span></td>
                      <td className="p-3"><span className="flex items-center gap-1 text-xs"><CreditCard className="w-3.5 h-3.5 text-slate-400" />{r.paymentMethod}</span></td>
                      <td className="p-3 text-xs text-slate-600 max-w-[220px]"><span className="line-clamp-2">{r.items?.slice(0, 3).map(i => i.name).join(", ")}{r.items?.length > 3 ? ` +${r.items.length - 3} more` : ""}</span></td>
                      <td className="p-3">{money(r.tax, r.currency)}</td>
                      <td className="p-3 text-right font-black">{money(r.total, r.currency)}</td>
                      <td className="p-3" onClick={e => e.stopPropagation()}><div className="flex justify-end gap-1"><button onClick={() => setDetail(r)} className="p-2 hover:bg-slate-100 rounded-full"><Eye className="w-4 h-4" /></button><button onClick={() => openEditReceipt(r)} className="p-2 hover:bg-slate-100 rounded-full"><Pencil className="w-4 h-4" /></button><button onClick={() => del(r.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button></div></td>
                    </tr>
                  ))}
              </tbody>
              {filtered.length > 0 && <tfoot><tr className="bg-slate-900 text-white font-bold"><td colSpan={7} className="p-3 text-right text-xs uppercase tracking-wider">Filtered Total</td><td className="p-3 text-right">{money(filtered.reduce((s, r) => s + Number(r.total), 0))}</td><td /></tr></tfoot>}
            </table>
          </div>
        </section>

        <p className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1"><Landmark className="w-3 h-3" /> Tip: For best AI accuracy, photograph receipts flat, well-lit, and fill the frame. Screenshots of e-receipts & PDFs exported as images also work.</p>
      </main>

      {/* Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex"><div className="flex-1 bg-black/50" onClick={() => setDetail(null)} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl p-5 animate-in slide-in-from-right">
            <div className="flex justify-between items-start"><div><p className="text-[11px] uppercase font-bold text-emerald-600">Receipt #{detail.id}</p><h3 className="text-xl font-black">{detail.merchant}</h3><p className="text-xs text-slate-500">{detail.merchantAddress}</p></div><button onClick={() => setDetail(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button></div>
            {detail.imageUrl && <img src={detail.imageUrl} alt="receipt" className="w-full h-64 object-contain bg-slate-50 border rounded-2xl mt-4" />}
            <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
              {[["Date", `${fmtDate(detail.receiptDate)} ${detail.receiptTime || ""}`], ["Category", detail.category], ["Payment", detail.paymentMethod], ["Receipt #", detail.receiptNumber || "—"], ["File", detail.fileName || "—"], ["AI Confidence", detail.confidence ? `${Number(detail.confidence)}%` : "—"]].map(([k, v]) => (<div key={k} className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500 font-semibold">{k}</p><p className="font-bold mt-0.5">{v}</p></div>))}
            </div>
            <h4 className="font-black mt-5 mb-2">Line Items</h4>
            <div className="border rounded-2xl overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-left"><th className="p-2.5">Item</th><th className="p-2.5">Qty</th><th className="p-2.5">Price</th><th className="p-2.5 text-right">Total</th></tr></thead><tbody>{detail.items?.map((it, i) => (<tr key={i} className="border-t"><td className="p-2.5 font-semibold">{it.name}</td><td className="p-2.5">{it.quantity}</td><td className="p-2.5">{money(it.unitPrice, detail.currency)}</td><td className="p-2.5 text-right font-bold">{money(it.total, detail.currency)}</td></tr>))}</tbody></table></div>
            <div className="space-y-1.5 mt-4 text-sm bg-slate-50 rounded-2xl p-4">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(detail.subtotal, detail.currency)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{money(detail.tax, detail.currency)}</span></div>
              {Number(detail.tip) > 0 && <div className="flex justify-between"><span>Tip</span><span>{money(detail.tip, detail.currency)}</span></div>}
              {Number(detail.discount) > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{money(detail.discount, detail.currency)}</span></div>}
              <div className="flex justify-between font-black text-base border-t pt-2"><span>Total</span><span>{money(detail.total, detail.currency)}</span></div>
            </div>
            {detail.notes && <p className="text-xs text-slate-500 mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">{detail.notes}</p>}
            <div className="flex gap-2 mt-5"><button onClick={() => { openEditReceipt(detail); setDetail(null); }} className="flex-1 bg-slate-900 text-white py-2.5 rounded-full text-sm font-bold flex items-center justify-center gap-1"><Pencil className="w-4 h-4" /> Edit</button><button onClick={() => del(detail.id)} className="flex-1 bg-red-50 text-red-600 py-2.5 rounded-full text-sm font-bold">Delete</button></div>
          </div>
        </div>
      )}

      {/* Edit / Review Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-3 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl my-6">
            <div className="p-5 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-3xl z-10">
              <div><h3 className="font-black text-lg flex items-center gap-2"><Wand2 className="w-5 h-5 text-emerald-600" /> {editing.mode === "edit" ? "Edit Receipt" : editing.mode === "draft" ? "Review AI Extraction" : "Add Receipt Manually"}</h3><p className="text-xs text-slate-500">Correct any field — AI isn&apos;t perfect. Items & totals recalc below.</p></div>
              <button onClick={() => setEditing(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid md:grid-cols-[220px_1fr] gap-5">
              <div>{editing.draft.imageUrl ? <img src={editing.draft.imageUrl} className="w-full h-72 object-contain bg-slate-50 border rounded-2xl" alt="" /> : <div className="h-72 bg-slate-50 border border-dashed rounded-2xl grid place-items-center text-slate-400 text-xs text-center p-4">No image<br />Manual entry</div>}{editing.draft.confidence != null && <p className="text-center text-xs mt-2 bg-emerald-50 text-emerald-800 py-1.5 rounded-full font-bold">AI Confidence: {editing.draft.confidence}%</p>}</div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2 text-xs font-bold">Merchant<input value={editing.draft.merchant} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, merchant: e.target.value } } as any)} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-normal" placeholder="e.g. Starbucks" /></label>
                  <label className="text-xs font-bold">Date<input type="date" value={editing.draft.receiptDate || ""} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, receiptDate: e.target.value, date: e.target.value } } as any)} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-normal" /></label>
                  <label className="text-xs font-bold">Time<input value={editing.draft.receiptTime || ""} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, receiptTime: e.target.value } } as any)} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-normal" placeholder="14:32" /></label>
                  <label className="text-xs font-bold">Category<select value={editing.draft.category} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, category: e.target.value } } as any)} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-normal bg-white">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
                  <label className="text-xs font-bold">Payment<select value={editing.draft.paymentMethod} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, paymentMethod: e.target.value } } as any)} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-normal bg-white">{PAYMENTS.map(c => <option key={c}>{c}</option>)}</select></label>
                  <label className="text-xs font-bold">Receipt #<input value={editing.draft.receiptNumber || ""} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, receiptNumber: e.target.value } } as any)} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-normal" /></label>
                  <label className="text-xs font-bold">Currency<input value={editing.draft.currency} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, currency: e.target.value.toUpperCase() } } as any)} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-normal" maxLength={3} /></label>
                </div>

                <div><div className="flex justify-between items-center"><p className="text-xs font-bold">LINE ITEMS</p><button onClick={() => setEditing({ ...editing, draft: { ...editing.draft, items: [...editing.draft.items, { name: "", quantity: 1, unitPrice: 0, total: 0 }] } } as any)} className="text-xs font-bold text-emerald-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add item</button></div>
                  <div className="space-y-2 mt-2 max-h-56 overflow-auto pr-1">
                    {editing.draft.items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_56px_84px_84px_28px] gap-2 items-center">
                        <input value={it.name} placeholder="Item name" onChange={e => { const items = [...editing.draft.items]; items[idx] = { ...items[idx], name: e.target.value }; setEditing({ ...editing, draft: { ...editing.draft, items } } as any); }} className="border rounded-lg px-2 py-1.5 text-xs" />
                        <input type="number" value={it.quantity} onChange={e => { const items = [...editing.draft.items]; const q = Number(e.target.value) || 0; items[idx] = { ...items[idx], quantity: q, total: Math.round(q * items[idx].unitPrice * 100) / 100 }; setEditing({ ...editing, draft: { ...editing.draft, items } } as any); }} className="border rounded-lg px-2 py-1.5 text-xs" />
                        <input type="number" step="0.01" value={it.unitPrice} onChange={e => { const items = [...editing.draft.items]; const p = Number(e.target.value) || 0; items[idx] = { ...items[idx], unitPrice: p, total: Math.round(p * items[idx].quantity * 100) / 100 }; setEditing({ ...editing, draft: { ...editing.draft, items } } as any); }} className="border rounded-lg px-2 py-1.5 text-xs" />
                        <input type="number" step="0.01" value={it.total} onChange={e => { const items = [...editing.draft.items]; items[idx] = { ...items[idx], total: Number(e.target.value) || 0 }; setEditing({ ...editing, draft: { ...editing.draft, items } } as any); }} className="border rounded-lg px-2 py-1.5 text-xs font-bold" />
                        <button onClick={() => setEditing({ ...editing, draft: { ...editing.draft, items: editing.draft.items.filter((_, i) => i !== idx) } } as any)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 bg-slate-50 rounded-2xl p-3">
                  {(["subtotal", "tax", "tip", "total"] as const).map(k => (
                    <label key={k} className="text-[11px] font-bold capitalize">{k}<input type="number" step="0.01" value={editing.draft[k]} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, [k]: Number(e.target.value) || 0 } } as any)} className={`mt-1 w-full border rounded-lg px-2 py-1.5 text-sm ${k === "total" ? "font-black bg-emerald-50 border-emerald-300" : ""}`} /></label>
                  ))}
                  <button onClick={() => { const sub = editing.draft.items.reduce((s, i) => s + Number(i.total || 0), 0); const tot = Math.round((sub + editing.draft.tax + editing.draft.tip - editing.draft.discount) * 100) / 100; setEditing({ ...editing, draft: { ...editing.draft, subtotal: Math.round(sub * 100) / 100, total: tot } } as any); }} className="col-span-4 text-[11px] font-bold bg-white border rounded-full py-1.5 hover:bg-emerald-50">↻ Recalculate subtotal & total from items + tax + tip</button>
                </div>
                <label className="text-xs font-bold block">Notes / Address<input value={editing.draft.notes || editing.draft.merchantAddress || ""} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, notes: e.target.value } } as any)} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-normal" placeholder="Optional notes" /></label>
              </div>
            </div>
            <div className="p-5 border-t flex gap-2 sticky bottom-0 bg-white rounded-b-3xl">
              <button onClick={() => setEditing(null)} className="px-5 py-2.5 border rounded-full text-sm font-bold">Cancel</button>
              <button onClick={saveDraft} disabled={saving || !editing.draft.merchant} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-full text-sm font-bold flex items-center justify-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {editing.mode === "edit" ? "Save Changes" : "Save to Table"} • {money(editing.draft.total, editing.draft.currency)}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{toast}</div>}
    </div>
  );
}
