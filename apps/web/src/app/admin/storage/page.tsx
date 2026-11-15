"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type StorageStatus = {
  mode: "server" | "device";
  configured?: boolean;
  volumeCapacityBytes?: number;
  volumeUsedBytes?: number;
  volumeReservedBytes?: number;
  physicalFreeBytes?: number;
  minimumFreeBytes?: number;
  maxUploadBytes?: number;
  defaultAccountQuotaBytes?: number;
  percentUsed?: number;
};

const gb = (n = 0) => `${(n / 1_000_000_000).toFixed(1)} GB`;

export default function AdminStoragePage() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setStatus(await api<StorageStatus>("GET", "/admin/media-storage")); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const percent = Math.min(100, Math.max(0, status?.percentUsed ?? 0));

  return <main className="min-h-screen bg-bg px-4 py-8 text-text sm:px-8">
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-accent">CineMind Admin</p><h1 className="mt-1 text-2xl font-bold">Media storage</h1><p className="mt-2 text-sm text-muted">Monitor account quotas and the capacity guard for the attached Hetzner Volume.</p></div>
        <div className="flex gap-2"><Link href="/admin/assets" className="rounded-lg border border-line px-3 py-2 text-sm text-soft hover:border-accent/50">Asset review</Link><Link href="/editor" className="rounded-lg border border-line px-3 py-2 text-sm text-soft hover:border-accent/50">Editor</Link></div>
      </header>

      {error && <div role="alert" className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-[#ffb3a8]"><span>{error}</span><button onClick={() => void refresh()} className="shrink-0 underline">Retry</button></div>}
      {loading && !status ? <p className="mt-8 text-sm text-muted">Reading storage status…</p> : status?.mode === "device" ? <section className="mt-8 rounded-xl border border-line bg-surface p-6"><h2 className="font-semibold">Server media storage is disabled</h2><p className="mt-2 text-sm leading-relaxed text-muted">Projects are currently configured to keep source media on each user’s device. Attach and mount a Hetzner Volume, then enable server media storage in the API configuration.</p></section> : status?.configured && <>
        <section className="mt-8 rounded-xl border border-line bg-surface p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Volume usage</p><p className="mt-2 text-3xl font-bold">{gb(status.volumeUsedBytes)} <span className="text-base font-medium text-muted">of {gb(status.volumeCapacityBytes)}</span></p></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${percent >= 90 ? "border-danger/40 bg-danger/10 text-danger" : percent >= 75 ? "border-sun/40 bg-sun/10 text-sun" : "border-ok/30 bg-ok/10 text-ok"}`}>{percent}% used</span></div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-bg-deep"><div className={`h-full rounded-full transition-all ${percent >= 90 ? "bg-danger" : percent >= 75 ? "bg-sun" : "bg-accent"}`} style={{ width: `${percent}%` }} /></div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted"><span>{gb(status.physicalFreeBytes)} physically free</span><span>{gb(status.volumeReservedBytes)} reserved by active uploads</span></div>
          {percent >= 85 && <p role="status" className="mt-4 rounded-lg border border-sun/30 bg-sun/10 p-3 text-sm text-sun">Storage is nearing its configured limit. Expand the Hetzner Volume or remove unused media before new uploads are blocked.</p>}
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          {[["Default account quota", gb(status.defaultAccountQuotaBytes)], ["Maximum file upload", gb(status.maxUploadBytes)], ["Protected free-space reserve", gb(status.minimumFreeBytes)]].map(([label, value]) => <article key={label} className="rounded-xl border border-line bg-surface p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-xl font-semibold text-text">{value}</p></article>)}
        </section>
        <button onClick={() => void refresh()} disabled={loading} className="mt-5 rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-soft hover:border-accent/50 hover:text-text disabled:opacity-50">{loading ? "Refreshing…" : "Refresh storage status"}</button>
      </>}
    </div>
  </main>;
}
