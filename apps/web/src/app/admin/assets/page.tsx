"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type ReviewAsset = {
  id: string; project_id: string; media_asset_id: string; provider: string; external_asset_id: string;
  source_url: string; creator: string | null; license_id: string; license_url: string;
  commercial_use: boolean; redistribution_allowed: boolean; attribution_required: boolean;
  attribution_text: string | null; sha256: string; acquired_at: string; original_name: string;
  media_kind: string; size_bytes: string; importer_email: string;
};

export default function AssetReviewPage() {
  const [items, setItems] = useState<ReviewAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await api<{ items: ReviewAsset[] }>("GET", "/admin/creative-assets/review")).items); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const review = async (id: string, decision: "approve" | "reject") => {
    setBusy(id); setError(null);
    try {
      await api("POST", `/admin/creative-assets/${id}/review`, { decision, note });
      setItems((all) => all.filter((item) => item.id !== id)); setNote("");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };
  return <main className="min-h-screen bg-bg px-4 py-8 text-text sm:px-8">
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-accent">CineMind Admin</p><h1 className="mt-1 text-2xl font-bold">Creative asset review</h1><p className="mt-2 text-sm text-muted">Review the source, license and attribution. Approval never overrides a provider's license or redistribution restrictions.</p></div><Link href="/editor" className="rounded-lg border border-line px-3 py-2 text-sm text-soft hover:border-accent/50">Back to editor</Link></div>
      {error && <div role="alert" className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-[#ffb3a8]"><span>{error}</span><button onClick={() => void refresh()} className="shrink-0 underline">Retry</button></div>}
      {loading ? <p className="mt-8 text-sm text-muted">Loading review queue…</p> : !items.length ? <div className="mt-8 rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">No assets are waiting for review.</div> : <div className="mt-6 space-y-4">{items.map((item) => <article key={item.id} className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{item.original_name}</h2><p className="mt-1 text-xs text-muted">{item.media_kind} · {item.provider} · {(Number(item.size_bytes) / 1e6).toFixed(1)} MB</p><p className="mt-1 text-xs text-faint">Imported by {item.importer_email} · {new Date(item.acquired_at).toLocaleString()}</p></div><span className="rounded-full border border-sun/30 px-2.5 py-1 text-[11px] text-sun">Pending review</span></div>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-faint">Creator</dt><dd className="mt-0.5 text-soft">{item.creator || "Not provided"}</dd></div><div><dt className="text-faint">License</dt><dd className="mt-0.5"><a href={item.license_url} target="_blank" rel="noreferrer" className="text-accent underline">{item.license_id}</a></dd></div><div><dt className="text-faint">Commercial use</dt><dd className="mt-0.5 text-soft">{item.commercial_use ? "Allowed by provider license (subject to rights checks)" : "Not confirmed"}</dd></div><div><dt className="text-faint">Standalone redistribution</dt><dd className="mt-0.5 text-soft">{item.redistribution_allowed ? "Allowed by license" : "Not allowed / not confirmed"}</dd></div><div><dt className="text-faint">Attribution</dt><dd className="mt-0.5 text-soft">{item.attribution_required ? item.attribution_text || "Required" : "Not required by license"}</dd></div><div><dt className="text-faint">File SHA-256</dt><dd className="mt-0.5 break-all font-mono text-soft">{item.sha256}</dd></div></dl>
        <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs font-semibold text-accent underline">Open original provider page ↗</a>
        <label className="mt-4 block text-xs text-muted">Review note<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Why is this asset approved or rejected?" className="mt-1.5 w-full rounded-lg border border-line bg-bg-deep px-3 py-2 text-sm text-text outline-none focus:border-accent/50" /></label>
        <div className="mt-4 flex justify-end gap-2"><button disabled={busy === item.id} onClick={() => void review(item.id, "reject")} className="rounded-lg border border-danger/40 px-4 py-2 text-xs font-semibold text-[#ffb3a8] hover:bg-danger/10 disabled:opacity-50">Reject</button><button disabled={busy === item.id} onClick={() => void review(item.id, "approve")} className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-ink disabled:opacity-50">Approve</button></div>
      </article>)}</div>}
    </div>
  </main>;
}
