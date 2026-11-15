"use client";

import { clipEnd } from "@cinemind/timeline-engine";
import { useEffect, useRef, useState } from "react";
import { Photo } from "@/components/visual/Photo";
import { Film, Music, Plus, TextIcon, Upload } from "@/components/ui/icons";
import { API_URL, api, getToken } from "@/lib/api";
import { useEditor } from "./EditorContext";
import { VoiceRecorder } from "./VoiceRecorder";
import { FPS, type EditorAsset } from "./model";
import { storageEstimate } from "@/lib/localMedia";

type Tab = "media" | "audio" | "text" | "elements" | "stock";

const STATUS: Record<string, string> = {
  uploading: "Adding",
  offline: "Offline on this device",
  uploaded: "Queued",
  processing: "Processing",
  analyzing: "Analysing",
  failed: "Failed",
};

export function MediaLibrary({ initialTab = "media", onCollapse }: { initialTab?: Tab; onCollapse?: () => void }) {
  const { assets, importFiles, doc, run, playhead, projectId, relink, selectedId, select, notify } = useEditor();
  const relinkRef = useRef<HTMLInputElement>(null);
  const [relinkId, setRelinkId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [over, setOver] = useState(false);
  const [recording, setRecording] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ mode: "device" | "server"; userUsedBytes: number; userQuotaBytes: number } | null>(null);
  const [storageError, setStorageError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    api<{ mode: "device" | "server"; userUsedBytes?: number; userQuotaBytes?: number }>("GET", `/projects/${projectId}/media/storage`)
      .then((info) => { if (active) { setStorageInfo({ mode: info.mode, userUsedBytes: info.userUsedBytes ?? 0, userQuotaBytes: info.userQuotaBytes ?? 0 }); setStorageError(false); } })
      .catch(() => { if (active) { setStorageInfo(null); setStorageError(true); } });
    return () => { active = false; };
  }, [projectId, assets.length]);

  const shown = assets.filter((a) => (tab === "audio" ? a.kind === "audio" : tab === "media" ? a.kind !== "audio" : false) && a.name.toLowerCase().includes(query.toLowerCase()));

  const usage = (id: string) => doc.tracks.reduce((n, t) => n + t.clips.filter((c) => c.assetId === id).length, 0);
  const usable = (a: EditorAsset) => a.durationFrames > 0 && a.status !== "uploading" && a.status !== "failed" && a.status !== "offline";

  /** Append to the end of the first matching unlocked track. */
  const addToTimeline = (a: EditorAsset) => {
    if (!usable(a)) return;
    const track = doc.tracks
      .filter((t) => (a.kind === "audio" ? t.kind === "audio" : t.kind === "video") && !t.locked)
      .sort((x, y) => x.order - y.order)[0];
    if (!track) return;
    const start = Math.max(0, ...track.clips.map(clipEnd));
    run([{ type: "clip.insert", assetId: a.id, trackId: track.id, timelineStartFrames: start }], `Added ${a.name} to ${track.name}`);
  };

  const addTitle = () => {
    const t1 = doc.tracks.find((t) => t.kind === "text");
    if (!t1) return;
    let start = playhead;
    while (t1.clips.some((c) => start < clipEnd(c) && start + 3 * FPS > c.timelineStartFrames)) start += FPS;
    run([{ type: "title.add", trackId: t1.id, text: "New title", startFrame: start, durationFrames: 3 * FPS }], "Added title");
  };

  const addTransition = (kind: "dissolve" | "fade" | "dip-to-black") => {
    const videoTracks = doc.tracks.filter((t) => t.kind === "video");
    const selectedTrack = videoTracks.find((t) => t.clips.some((c) => c.id === selectedId));
    const track = selectedTrack ?? videoTracks.find((t) => t.clips.length >= 2);
    const clips = track?.clips ?? [];
    const index = selectedTrack ? clips.findIndex((c) => c.id === selectedId) : clips.length - 2;
    const from = clips[index];
    const to = clips[index + 1];
    if (!from || !to) {
      notify("error", "Add another video clip after this one before adding a transition.");
      return;
    }
    const durationFrames = Math.min(from.sourceOutFrames - from.sourceInFrames, to.sourceOutFrames - to.sourceInFrames, Math.floor(FPS / 2));
    run([{ type: "transition.add", fromClipId: from.id, toClipId: to.id, kind, durationFrames }], `Added ${kind} transition`);
  };

  const importSelection = (files: FileList | File[]) => {
    const selected = Array.from(files).filter((file) => tab === "audio" ? file.type.startsWith("audio/") : file.type.startsWith("video/") || file.type.startsWith("image/"));
    if (!selected.length) {
      notify("error", tab === "audio" ? "Choose an audio file such as MP3 or WAV." : "Choose a video or image file.");
      return;
    }
    importFiles(selected);
  };

  return (
    <aside
      className={`flex min-h-0 flex-col border-r border-line bg-surface ${over ? "ring-2 ring-inset ring-accent/60" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) importSelection(e.dataTransfer.files);
      }}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3 text-[12px]">
        <span className="font-semibold text-soft">Project bin</span>
        <div className="flex items-center gap-2"><span className="text-faint">{tab === "text" ? doc.tracks.filter((t) => t.kind === "text").reduce((n, t) => n + t.clips.length, 0) : assets.length} items</span>{onCollapse && <button type="button" onClick={onCollapse} title="Collapse media bin" aria-label="Collapse media bin" className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-accent/10 hover:text-accent">−</button>}</div>
      </div>
      <div className="grid shrink-0 grid-cols-5 gap-1 border-b border-line p-1.5">
        {([ ["media", "Media"], ["audio", "Audio"], ["text", "Text"], ["elements", "Effects"], ["stock", "Stock"] ] as const).map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-md py-2 text-[10px] font-semibold transition ${tab === id ? "bg-accent/10 text-accent" : "text-muted hover:bg-white/5 hover:text-text"}`}>{label}</button>)}
      </div>
      <div className="space-y-3 p-3">
        {storageError && projectId && (tab === "media" || tab === "audio") && <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-[10px] leading-relaxed text-[#ffb3a8]">CineMind could not verify where this project stores media. Upload is paused so files are not silently saved to the wrong place. Reload the project and try again.</div>}
        {storageInfo?.mode === "server" && storageInfo.userQuotaBytes > 0 && (tab === "media" || tab === "audio") && <div className="rounded-lg border border-line bg-bg-deep/70 px-2.5 py-2" aria-label="Project media storage usage">
          <div className="flex items-center justify-between gap-2 text-[10px]"><span className="font-semibold text-soft">Account storage</span><span className="text-faint">{(storageInfo.userUsedBytes / 1e9).toFixed(1)} / {(storageInfo.userQuotaBytes / 1e9).toFixed(0)} GB</span></div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.min(100, (storageInfo.userUsedBytes / storageInfo.userQuotaBytes) * 100)}%` }} /></div>
          <p className="mt-1 text-[9px] text-faint">Media is saved to this project’s Hetzner storage.</p>
        </div>}
        {(tab === "media" || tab === "audio") && <button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-line-strong py-3 text-[13px] font-semibold text-soft transition-colors hover:border-accent/60 hover:text-accent"><Upload size={15} /> {tab === "audio" ? "Import audio" : "Import video or image"}</button>}
        {(tab === "media" || tab === "audio") && <button onClick={() => setRecording(true)} className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-line py-2 text-[12px] font-semibold text-soft transition-colors hover:border-danger/60 hover:text-danger"><span className="h-2.5 w-2.5 rounded-full bg-danger" /> Record voice-over</button>}
        {recording && <VoiceRecorder onClose={() => setRecording(false)} onDone={(f) => importFiles([f])} />}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={tab === "audio" ? "audio/*" : "video/*,image/*"}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) importSelection(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={relinkRef}
          type="file"
          accept="video/*,audio/*,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && relinkId) void relink(relinkId, f);
            e.target.value = "";
            setRelinkId(null);
          }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search media"
          className="w-full rounded-[10px] border border-line bg-bg-deep px-3 py-1.5 text-[13px] outline-none placeholder:text-faint focus:border-accent/50"
        />
        {(tab === "media" || tab === "audio") && <p className="text-[10px] text-faint">Select a clip below to add it to your timeline.</p>}
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {(tab === "media" || tab === "audio") && <div className="space-y-2">
          {shown.map((a) => (
            <div key={a.id} className="group flex min-w-0 items-center gap-2 overflow-hidden rounded-[9px] border border-line bg-bg-deep transition hover:border-accent/50">
              <div className="relative h-[62px] w-[92px] shrink-0 overflow-hidden">
                <AssetThumb asset={a} />
                {a.durationFrames > 0 && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 font-mono text-[9px] text-white/80">{(a.durationFrames / FPS).toFixed(0)}s</span>
                )}
                {a.bpm ? <span className="absolute bottom-1 left-1 rounded bg-sun px-1 font-mono text-[9px] font-bold text-black">{Math.round(a.bpm)} BPM</span> : null}
                {usage(a.id) > 0 && <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-green-text" title="Used in timeline" />}
                {a.status && a.status !== "ready" && (
                  <div className="absolute inset-0 grid place-items-center bg-black/60 text-[10px] font-semibold text-soft">
                    <div className="w-3/4 text-center">
                      {STATUS[a.status]}
                      {a.status === "uploading" ? "…" : a.status !== "failed" && a.status !== "offline" ? "…" : ""}
                      {a.status === "offline" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRelinkId(a.id);
                            relinkRef.current?.click();
                          }}
                          className="mt-1.5 inline-block rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold text-accent-ink"
                        >
                          Relink file
                        </button>
                      )}
                      {a.status !== "failed" && a.status !== "offline" && (
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
                          <div className={`h-full rounded-full bg-accent ${a.status !== "uploading" ? "w-1/2 animate-pulse" : ""}`} style={a.status === "uploading" ? { width: `${a.progress ?? 0}%` } : undefined} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 p-2">
                <p className="truncate text-[11px] font-semibold text-soft" title={a.name}>{a.name}</p>
                <p className="truncate text-[10px] text-faint">{a.sizeLabel}</p>
                {usable(a) && <button type="button" onClick={() => addToTimeline(a)} className="mt-2 flex min-h-8 w-full items-center justify-center gap-1 rounded-md bg-accent/10 px-2 text-[10px] font-bold text-accent transition hover:bg-accent hover:text-accent-ink"><Plus size={12} /> Add to timeline</button>}
              </div>
            </div>
          ))}
        </div>}
        {(tab === "media" || tab === "audio") && !shown.length && <p className="py-8 text-center text-[12px] text-faint">{assets.length ? "No media matches." : tab === "audio" ? "Import music or record a voice-over to start." : "Import a video or image to start."}</p>}
        {tab === "text" && <div className="space-y-3 pt-2"><button onClick={addTitle} className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-[12px] font-bold text-accent-ink"><TextIcon size={15} /> Add title at playhead</button>{doc.tracks.filter((t) => t.kind === "text").flatMap((t) => t.clips.map((c) => <button key={c.id} onClick={() => select(c.id)} className={`w-full rounded-lg border p-3 text-left text-[12px] ${selectedId === c.id ? "border-accent bg-accent/10 text-accent" : "border-line text-soft"}`}>{c.text || "Untitled text"}</button>))}<p className="text-[11px] text-faint">Select a title on the timeline to edit its text, timing, position and style in Inspector.</p></div>}
        {tab === "elements" && <div className="space-y-3 pt-2"><p className="text-[11px] leading-relaxed text-muted">Transitions join adjacent video clips. Select a clip on the timeline, then apply a transition to the next clip.</p>{([ ["dissolve", "Cross dissolve"], ["fade", "Fade through"], ["dip-to-black", "Dip to black"] ] as const).map(([kind, label]) => <button key={kind} onClick={() => addTransition(kind)} className="w-full rounded-lg border border-line bg-surface-2 p-3 text-left text-[12px] font-semibold text-soft hover:border-accent/50 hover:text-accent">{label}<span className="mt-1 block text-[10px] font-normal text-faint">Add between adjacent clips</span></button>)}</div>}
        {tab === "stock" && <StockAssetBrowser />}
        <p className="mt-4 text-[11px] leading-relaxed text-faint">
          {(tab === "media" || tab === "audio") && (projectId
            ? storageError ? "Media storage could not be confirmed." : !storageInfo ? "Checking this project's media storage…" : storageInfo.mode === "server" ? "Project media is stored on CineMind server storage. Export fetches the required media to this device for rendering." : "Original media stays on this device. Only your edit and lightweight analysis sync. Re-link media on another device, and keep a backup of original files."
            : "Demo mode: imported files stay on this device. Sign in to sync your edit; media itself remains local. Keep original files backed up.")}
        </p>
      </div>
    </aside>
  );
}

type StockAsset = {
  id: string; name: string; description: string; category: string; tags: string[];
  thumbnailUrl: string | null; previewUrl?: string; authors: string[]; sourceUrl: string;
  provider: string; license: string; commercialUse: boolean; attributionRequired: boolean; mediaKind: "asset" | "video" | "image";
};

function StockAssetBrowser() {
  const { projectId, importFiles, notify } = useEditor();
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<"polyhaven" | "pixabay">("polyhaven");
  const [kind, setKind] = useState<"video" | "image">("video");
  const [items, setItems] = useState<StockAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<{ id: string; status: string; progress: number; error?: string } | null>(null);
  const importAbort = useRef<AbortController | null>(null);
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) { setError("Enter at least two characters to search."); return; }
    setLoading(true); setError(null);
    try {
      const result = await api<{ items: StockAsset[] }>("GET", `/creative-assets/search?provider=${provider}&kind=${kind}&q=${encodeURIComponent(query.trim())}`);
      setItems(result.items);
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    } finally { setLoading(false); }
  };
  const trackImport = async (jobId: string) => {
    const abort = new AbortController(); importAbort.current = abort;
    let clientImportStarted = false;
    setImporting({ id: jobId, status: "queued", progress: 0 });
    try {
      for (let i = 0; i < 1200; i++) {
        if (abort.signal.aborted) return;
        const job = await api<{ id: string; status: string; progress: number; errorMessage?: string; fileName?: string; mimeType?: string; sizeBytes?: number }>("GET", `/projects/${projectId}/creative-assets/imports/${jobId}`);
        setImporting({ id: jobId, status: job.status, progress: job.progress, error: job.errorMessage });
        if (job.status === "failed" || job.status === "cancelled") throw new Error(job.errorMessage ?? "Asset import failed.");
        if (job.status === "duplicate") { notify("info", "This stock file is already in the project's media bin."); setImporting(null); return; }
        if (job.status === "imported") { notify("ok", "Stock asset imported to this device and added to the media bin."); setImporting(null); return; }
        if (job.status === "ready" && !clientImportStarted) {
          setImporting({ id: jobId, status: "Saving to this device", progress: 98 });
          const token = getToken();
          const response = await fetch(`${API_URL}/api/v1/projects/${projectId}/creative-assets/imports/${jobId}/file`, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: abort.signal, cache: "no-store" });
          if (!response.ok) throw new Error(`Could not retrieve verified asset (${response.status}).`);
          const reader = response.body?.getReader();
          if (!reader) throw new Error("This browser cannot stream the stock file download.");
          const chunks: Uint8Array[] = [];
          let received = 0;
          const total = Number(response.headers.get("content-length") ?? job.sizeBytes ?? 0);
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value); received += value.byteLength;
            const progress = total > 0 ? 98 + Math.min(1, received / total) : 98;
            setImporting({ id: jobId, status: "Downloading to this device", progress: Math.floor(progress) });
          }
          const blobParts = chunks.map((chunk) => new Uint8Array(chunk).buffer);
          const blob = new Blob(blobParts, { type: job.mimeType ?? "application/octet-stream" });
          if (!blob.size || (job.sizeBytes && blob.size !== job.sizeBytes)) throw new Error("Downloaded asset size did not match its verified metadata.");
          const estimate = await storageEstimate();
          if (estimate && estimate.quota > 0 && estimate.quota - estimate.usage < blob.size * 1.1) throw new Error("This device is low on browser storage. Free space before importing this asset.");
          const type = job.mimeType ?? blob.type;
          const file = new File([blob], job.fileName ?? `stock-${jobId}`, { type });
          importFiles([file], jobId);
          clientImportStarted = true;
        }
        await new Promise((resolve) => setTimeout(resolve, 850));
      }
      throw new Error("Import is taking longer than expected. You can retry from this panel.");
    } catch (e) {
      if (abort.signal.aborted) return;
      setImporting((state) => state ? { ...state, error: (e as Error).message } : null);
    } finally { if (importAbort.current === abort) importAbort.current = null; }
  };
  const beginImport = async (item: StockAsset) => {
    if (!projectId) { setError("Sign in and open a saved project to import stock media."); return; }
    if (provider !== "pixabay" || item.mediaKind === "asset") { setError("This provider item must be downloaded at its source and imported from your device."); return; }
    setError(null);
    try {
      const job = await api<{ id: string; status: string }>("POST", `/projects/${projectId}/creative-assets/import`, { provider: "pixabay", assetId: item.id, mediaKind: item.mediaKind });
      await trackImport(job.id);
    } catch (e) { setError((e as Error).message); }
  };
  const cancelImport = async () => {
    const current = importing;
    if (!current || !projectId) return;
    importAbort.current?.abort();
    await api("POST", `/projects/${projectId}/creative-assets/imports/${current.id}/cancel`).catch(() => {});
    setImporting(null);
    notify("info", "Asset import cancelled.");
  };
  const retryImport = async () => {
    if (!importing || !projectId) return;
    const current = importing;
    if (["failed", "cancelled"].includes(current.status)) {
      try { await api("POST", `/projects/${projectId}/creative-assets/imports/${current.id}/retry`); }
      catch (e) { setImporting({ ...current, error: (e as Error).message }); return; }
    }
    await trackImport(current.id);
  };
  return <div className="space-y-3 pt-2">
    <form onSubmit={(e) => void search(e)} className="space-y-1.5">
      <select value={provider} onChange={(e) => { setProvider(e.target.value as "polyhaven" | "pixabay"); setItems([]); setError(null); }} className="w-full rounded-lg border border-line bg-bg-deep px-2.5 py-2 text-[11px] text-soft outline-none focus:border-accent/50"><option value="polyhaven">Poly Haven · CC0 assets</option><option value="pixabay">Pixabay · stock video</option></select>
      {provider === "pixabay" && <select value={kind} onChange={(e) => { setKind(e.target.value as "video" | "image"); setItems([]); }} className="w-full rounded-lg border border-line bg-bg-deep px-2.5 py-2 text-[11px] text-soft outline-none focus:border-accent/50"><option value="video">Video</option><option value="image">Image</option></select>}
      <div className="flex gap-1.5">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={provider === "polyhaven" ? "Search CC0 assets" : "Search stock video"} className="min-w-0 flex-1 rounded-lg border border-line bg-bg-deep px-3 py-2 text-[12px] outline-none focus:border-accent/50" />
      <button disabled={loading} className="rounded-lg bg-accent px-3 text-[11px] font-bold text-accent-ink disabled:opacity-50">{loading ? "…" : "Search"}</button>
      </div>
    </form>
    <div className="rounded-lg border border-line bg-bg-deep/70 p-2.5">
      <p className="text-[11px] font-semibold text-soft">{provider === "polyhaven" ? "Poly Haven · CC0" : "Pixabay · Content License"}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-muted">{provider === "polyhaven" ? "Commercial use is allowed under CC0. Credit Poly Haven when using its live catalog. Choose an asset to inspect and download it from the original source." : "Commercial use is allowed as part of a creative work; do not redistribute stock files on their own. Search results identify Pixabay. API access requires a key configured on the server."}</p>
    </div>
    {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-[11px] text-[#ffb3a8]">{error}</p>}
    {importing && <div className="rounded-lg border border-accent/25 bg-accent/[0.06] p-2.5">
      <div className="flex items-center justify-between gap-2"><p className="truncate text-[10px] font-semibold text-soft">{importing.status === "Saving to this device" ? importing.status : `Import: ${importing.status}`}</p><span className="font-mono text-[10px] text-accent">{importing.progress}%</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${importing.progress}%` }} /></div>
      {importing.error ? <div className="mt-2 flex gap-2"><button onClick={() => void retryImport()} className="rounded border border-accent/40 px-2 py-1 text-[10px] font-semibold text-accent">Retry</button><button onClick={() => setImporting(null)} className="rounded border border-line px-2 py-1 text-[10px] text-muted">Dismiss</button><p className="min-w-0 flex-1 text-[10px] text-danger">{importing.error}</p></div> : importing.status !== "registered" && <button onClick={() => void cancelImport()} className="mt-2 rounded border border-line px-2 py-1 text-[10px] text-muted">Cancel import</button>}
    </div>}
    {items.length > 0 && <p className="text-[10px] text-faint">{items.length} matching assets</p>}
    <div className="space-y-2">
      {items.map((item) => <article key={item.id} className="overflow-hidden rounded-lg border border-line bg-bg-deep">
        {item.mediaKind === "video" && item.previewUrl ? <video src={item.previewUrl} poster={item.thumbnailUrl ?? undefined} controls preload="none" className="h-28 w-full bg-black object-contain" aria-label={`Preview ${item.name}`} /> : item.thumbnailUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" title={`Preview ${item.name} at ${item.provider}`} className="block h-28 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.thumbnailUrl} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
        </a>}
        <div className="p-2.5"><div className="flex items-start justify-between gap-2"><h3 className="text-[11px] font-semibold leading-snug text-text">{item.name}</h3><span className="shrink-0 rounded border border-ok/25 px-1.5 py-0.5 text-[9px] text-ok">CC0</span></div>
          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted">{item.description || item.category}</p>
          <p className="mt-1 truncate text-[9px] text-faint">{item.authors.length ? `By ${item.authors.join(", ")}` : item.category} · {item.provider}</p>
          {provider === "pixabay" && <button disabled={!!importing} onClick={() => void beginImport(item)} className="mt-2 flex min-h-8 w-full items-center justify-center rounded-md bg-accent px-2 text-[10px] font-bold text-accent-ink disabled:opacity-40">Import to this project</button>}
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-1.5 flex min-h-8 items-center justify-center rounded-md border border-line-strong text-[10px] font-semibold text-soft transition hover:border-accent/50 hover:text-accent">View at source ↗</a>
        </div>
      </article>)}
    </div>
    {!items.length && !loading && !error && <p className="py-3 text-center text-[10px] text-faint">Search Poly Haven's live catalog. Original files remain on the source site until you choose to download them.</p>}
    <a href={provider === "polyhaven" ? "https://polyhaven.com" : "https://pixabay.com"} target="_blank" rel="noreferrer" className="block text-center text-[10px] font-semibold text-accent hover:underline">Powered by {provider === "polyhaven" ? "Poly Haven" : "Pixabay"}</a>
  </div>;
}

function AssetThumb({ asset }: { asset: EditorAsset }) {
  if (asset.kind === "audio")
    return (
      <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#17652f,#062a14)] text-[#bdf5c8]">
        <Music size={20} />
      </div>
    );
  if (asset.thumbUrl)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset.thumbUrl} alt="" className="h-full w-full object-cover" />;
  if (asset.photo) return <Photo photo={asset.photo} sizes="140px" />;
  if (asset.url && asset.kind === "video") return <video src={`${asset.url}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" />;
  if (asset.url && asset.kind === "image")
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset.url} alt="" className="h-full w-full object-cover" />;
  return (
    <div className="grid h-full w-full place-items-center text-muted">
      <Film size={18} />
    </div>
  );
}
